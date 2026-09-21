package datadir

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Status は移行の結果区分。
type Status string

const (
	// StatusSkipped は移行が不要または対象外だったことを表す(経路 b / c)。
	StatusSkipped Status = "skipped"
	// StatusMigrated は移行が成功したことを表す(経路 a)。
	StatusMigrated Status = "migrated"
	// StatusFailed は検証に失敗し、何も動かさずに中止したことを表す(経路 d)。
	StatusFailed Status = "failed"
	// StatusBlocked は他プロセスが移行中で手を出さなかったことを表す。
	StatusBlocked Status = "blocked"
)

// Reason は Status を細分する機械可読な理由コード。利用者向け文面は呼出側が組み立てる。
type Reason string

const (
	ReasonNone            Reason = ""
	ReasonNoLegacyDir     Reason = "no_legacy_dir"      // 旧ディレクトリが無い(経路 c)
	ReasonNoLegacyDB      Reason = "no_legacy_db"       // 旧 DB ファイルが無い/空(経路 c)
	ReasonNewDBExists     Reason = "new_db_exists"      // 新 DB が既に在る(経路 b・良性)
	ReasonOldDataStranded Reason = "old_data_stranded"  // ★経路 b のうち、新が空で旧にデータが在る
	ReasonExplicitDBPath  Reason = "explicit_db_path"   // 利用者が明示したパスを使っている
	ReasonLegacyDirSymlnk Reason = "legacy_dir_symlink" // 旧ディレクトリがシンボリックリンク
	ReasonLockHeld        Reason = "lock_held"          // 別プロセスが移行中
	ReasonVerifyFailed    Reason = "verify_failed"      // 検証に失敗した
)

// Decision は「移行すべきか」の判定結果。副作用を持たない純関数 Decide が返す。
type Decision struct {
	Proceed bool
	Reason  Reason
	// Detail は Reason を補足する 1 行(利用者向けメッセージの材料)。
	Detail string
}

// Decide は旧・新の状態から移行すべきかを判定する。ファイルシステムを読むだけで書かない。
//
// ★★「新ディレクトリが空でないか」では判定しない ————————————————————————
// applog.Init / migration.Run / db.Open はいずれも書き込み先の親ディレクトリを MkdirAll する。
// どれか 1 つでも移行判定より先に走ると、新ディレクトリは「存在するが DB は無い」状態になる。
// 「空でなければ skip」だと、そこで経路 a が経路 b へ化け、利用者のデータが旧に取り残される。
// しかもエラーにならないので誰も気づかない。
// ⇒ 判定に使うのは **新 DB ファイルが在り、かつサイズが 0 でないこと** だけにする。
//
// ★旧ディレクトリがシンボリックリンクなら移行しない。退避のリネームがリンク自体を
// 動かしてしまい、実体(別ディスクに置いた大きなデータかもしれない)との対応が壊れるため。
func Decide(oldDir, newDir, oldDBName, newDBName string) (Decision, error) {
	if fi, err := os.Lstat(oldDir); err != nil {
		if os.IsNotExist(err) {
			return Decision{Reason: ReasonNoLegacyDir}, nil
		}
		return Decision{}, fmt.Errorf("datadir: lstat %q: %w", oldDir, err)
	} else if fi.Mode()&os.ModeSymlink != 0 {
		return Decision{
			Reason: ReasonLegacyDirSymlnk,
			Detail: fmt.Sprintf("%s はシンボリックリンクです。自動移行の対象外です", oldDir),
		}, nil
	} else if !fi.IsDir() {
		return Decision{Reason: ReasonNoLegacyDir}, nil
	}

	if !isNonEmptyFile(filepath.Join(oldDir, oldDBName)) {
		return Decision{Reason: ReasonNoLegacyDB}, nil
	}

	if isNonEmptyFile(filepath.Join(newDir, newDBName)) {
		return Decision{
			Reason: ReasonNewDBExists,
			Detail: fmt.Sprintf("移行先 %s に既存のデータがあるため移行しません。旧データは %s に残っています", newDir, oldDir),
		}, nil
	}

	return Decision{Proceed: true}, nil
}

// isNonEmptyFile は path が通常ファイルとして存在し、サイズが 0 でないかを返す。
func isNonEmptyFile(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.Mode().IsRegular() && fi.Size() > 0
}

// samePath は 2 つのパスが同じ場所を指すかを返す。シンボリックリンクを解決し、
// Windows / macOS では大文字小文字を無視する。
func samePath(a, b string, caseInsensitive bool) bool {
	norm := func(p string) string {
		c := filepath.Clean(p)
		if r, err := filepath.EvalSymlinks(c); err == nil {
			c = r
		}
		if caseInsensitive {
			c = strings.ToLower(c)
		}
		return c
	}
	return norm(a) == norm(b)
}

// ReadyToRetire は旧ディレクトリを退避してよいかを返す。よくないときは理由を返す。
//
// ★★これが無いと、config の書き換えが空振りしたときに旧が消える ————————————
// 移行の要否を決める UsesLegacyDefault は EvalSymlinks で正規化し、Windows / macOS では
// 大小を無視する。一方 config の書き換え(config.RewriteRelocatedPaths → withinRoot)は
// **純粋な字句一致**である。両者が食い違う綴り〔シンボリックリンク経由のホーム、
// Windows のドライブ文字の大小 等〕で database.path が書かれていると、
// 「移行はする ／ config は書き換わらない ／ 旧は退避される」が成立してしまう。
// その次の起動で database.path は消えた旧パスを指し、SQLite がそこへ**空の DB を新規作成**する。
//
// ★★綴りを網羅しにいかない。「これから開く DB が実体として在るか」で判定する。
// 想定していない綴りの食い違いにも同じ 1 つの判定で効くためである。
func ReadyToRetire(resolvedDBPath, oldDir string) (bool, string) {
	if strings.TrimSpace(resolvedDBPath) == "" {
		return false, "開く DB のパスを決められなかった"
	}
	ci := caseInsensitiveFS()
	if isUnder(resolvedDBPath, oldDir, ci) {
		return false, fmt.Sprintf("設定が移行前の場所(%s)を指したままである", resolvedDBPath)
	}
	if !isNonEmptyFile(resolvedDBPath) {
		return false, fmt.Sprintf("移行先に開くべき DB(%s)が見当たらない", resolvedDBPath)
	}
	return true, ""
}

// isUnder は path が dir と同一、または dir 配下にあるかを返す。
// samePath と同じ正規化(シンボリックリンクの解決・OS 別の大小無視)を通す。
func isUnder(path, dir string, caseInsensitive bool) bool {
	norm := func(p string) string {
		c := filepath.Clean(p)
		if r, err := filepath.EvalSymlinks(c); err == nil {
			c = r
		} else if parent, base := filepath.Split(c); parent != "" {
			// path 自体が存在しない場合があるので親だけ解決する
			if r, rerr := filepath.EvalSymlinks(filepath.Clean(parent)); rerr == nil {
				c = filepath.Join(r, base)
			}
		}
		if caseInsensitive {
			c = strings.ToLower(c)
		}
		return c
	}
	np, nd := norm(path), norm(dir)
	if np == nd {
		return true
	}
	rel, err := filepath.Rel(nd, np)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}
