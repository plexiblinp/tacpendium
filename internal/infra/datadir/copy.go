package datadir

import (
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// copyTree は src 配下を dst 配下へ複製する。skip に一致する相対パスは複製しない。
// 複製した「元の絶対パス → 先の絶対パス」の対応表と、飛ばした項目の一覧を返す。
//
// ★シンボリックリンクは辿らず、飛ばして報告する。辿るとツリー外へ出たり循環したりする。
// ★通常ファイル・ディレクトリ以外(fifo / socket / デバイス)も飛ばして報告する。
// ★各ファイルは close 前に fsync する。しないと、退避のリネームが済んだ直後に電源が
// 落ちたとき「旧は退避済み・新は中身が空」という復旧不能な状態が作れる。
func copyTree(src, dst string, skip map[string]bool) (mapping map[string]string, skipped []string, err error) {
	mapping = make(map[string]string)

	walkErr := filepath.WalkDir(src, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, relErr := filepath.Rel(src, path)
		if relErr != nil {
			return relErr
		}
		if rel == "." {
			return nil
		}
		if skip[rel] {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		target := filepath.Join(dst, rel)
		info, infoErr := d.Info()
		if infoErr != nil {
			return infoErr
		}

		switch {
		case info.Mode()&os.ModeSymlink != 0:
			skipped = append(skipped, rel+" (シンボリックリンク)")
			return nil
		case d.IsDir():
			return os.MkdirAll(target, 0o755)
		case !info.Mode().IsRegular():
			skipped = append(skipped, rel+" (通常ファイルではない)")
			return nil
		}

		if copyErr := copyFile(path, target, info.Mode().Perm()); copyErr != nil {
			return copyErr
		}
		absSrc, _ := filepath.Abs(path)
		absDst, _ := filepath.Abs(target)
		mapping[filepath.Clean(absSrc)] = filepath.Clean(absDst)
		return nil
	})
	if walkErr != nil {
		return nil, skipped, fmt.Errorf("datadir: copy %q -> %q: %w", src, dst, walkErr)
	}
	return mapping, skipped, nil
}

// copyFile は 1 ファイルを複製し、close の前に fsync する。
func copyFile(src, dst string, perm os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, perm)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		return err
	}
	if err := out.Sync(); err != nil {
		_ = out.Close()
		return err
	}
	return out.Close()
}

// syncDir はディレクトリエントリを永続化する。rename / create をクラッシュに耐えさせる。
// Windows ではディレクトリを開けないため何もしない。
func syncDir(path string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	syncErr := f.Sync()
	closeErr := f.Close()
	return firstErr(syncErr, closeErr)
}

// openSource は移行元 DB を開く。
//
// ★★アプリ標準の db.Open は使わない ————————————————————————————————
// db.Open は journal_mode(WAL) を接続文字列で当てる。移行元に対してそれをやると、
// 「動かさないはずの旧ファイル」のヘッダを書き換えることになる。
// ⇒ 移行元は PRAGMA を当てない素の接続で開き、接続を 1 本に絞る
// (複数接続が読みロックを持つと wal_checkpoint(TRUNCATE) が busy で失敗する)。
func openSource(dbPath string) (*sql.DB, error) {
	dsn := "file:" + (&urlPath{dbPath}).escaped() + "?_pragma=busy_timeout(5000)"
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("datadir: open source %q: %w", dbPath, err)
	}
	conn.SetMaxOpenConns(1)
	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("datadir: ping source %q: %w", dbPath, err)
	}
	return conn, nil
}

// checkpointWAL は WAL を本体へ畳み、-wal を切り詰める。
//
// ★★戻り値を読むこと ————————————————————————————————————————————
// PRAGMA wal_checkpoint(TRUNCATE) は (busy, log, checkpointed) の 1 行を返す。
// Exec で捨てると busy=1(畳めなかった)を見逃す。その状態でコピーすると、
// -wal にしか無いコミット済みデータが移行先に載らない。
// しかもファイル名が変わる(combomgr.db → tacpendium.db)ため -wal は孤児になり、
// 後から拾い直すこともできない。本サブで最も静かなデータ欠損の経路である。
func checkpointWAL(conn *sql.DB) error {
	var busy, logFrames, checkpointed int64
	if err := conn.QueryRow(`PRAGMA wal_checkpoint(TRUNCATE)`).Scan(&busy, &logFrames, &checkpointed); err != nil {
		return fmt.Errorf("datadir: wal_checkpoint: %w", err)
	}
	if busy != 0 {
		return fmt.Errorf("datadir: WAL を畳めませんでした(busy=%d)。他のプロセスが DB を開いている可能性があります", busy)
	}
	if logFrames != checkpointed {
		return fmt.Errorf("datadir: WAL を畳みきれませんでした(log=%d / checkpointed=%d)", logFrames, checkpointed)
	}
	return nil
}

// vacuumInto は移行元の接続から dst へ 1 ファイルの複製を書き出す。
//
// ★★DB 本体はバイトコピーではなく VACUUM INTO で運ぶ ————————————————————
// バイトコピーは (1) コピー中の書き込みで裂ける (2) -wal / -shm を連れ回す
// (3) 壊れた元をそのまま複製する、の 3 つを避けられない。
// VACUUM INTO はトランザクション内で全ページを読み直して単一ファイルを書くため、
// 裂けず、-wal / -shm を残さず、元が壊れていればその場でエラーになる。
// journal_mode は引き継がれないが、db.Open が接続文字列で WAL を当て直すので実害は無い。
func vacuumInto(conn *sql.DB, dst string) error {
	// VACUUM INTO はパラメータバインドを受け付けないためリテラルで渡す。
	// dst は本パッケージが組み立てた一時ディレクトリ配下のパスであり利用者入力ではない。
	if _, err := conn.Exec(`VACUUM INTO '` + strings.ReplaceAll(dst, "'", "''") + `'`); err != nil {
		return fmt.Errorf("datadir: vacuum into %q: %w", dst, err)
	}
	return nil
}
