// Package db は SQLite 接続の生成とアプリ標準 PRAGMA 適用を提供する。
//
// 設計参照: M1-02 指示書 §4.1.3、SUPP-001。
package db

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"

	_ "modernc.org/sqlite" // CGO 不要の純 Go SQLite ドライバ
)

// driverName は database/sql.Open に渡すドライバ名。modernc.org/sqlite が "sqlite" として登録する。
const driverName = "sqlite"

// dsnPragmaParams はアプリ標準 PRAGMA を接続文字列へ載せた形。
//
// ★★なぜ 4 つとも接続文字列へ移すのか(M23-10 §4.1-2)——————————————————
// 接続の開き方を 1 か所に集めるためである。4 つは性質が同じではない:
// foreign_keys / busy_timeout / synchronous は接続単位の設定だが、
// journal_mode は DB 単位で永続化される設定であり、接続ごとに指定しても意味が変わらない。
// 性質の違いは承知のうえで「指定箇所を割らないこと」を優先した。
// ⇒ journal_mode だけをここから外して別扱いに戻さないこと。
//
// ★なぜプール確立後の Exec ではないのか(M23-10 §4.1-1・ボード P-04)————————
// PRAGMA は接続単位の設定であり、*sql.DB.Exec はプールから 1 本借りて実行するだけである。
// 旧実装は Open 直後に PRAGMA を Exec しており、プール中の 1 本にしか届いていなかった。
// 2026-08-23 の実測では、同時に張った 16 接続のうち 15 本が foreign_keys=OFF だった
// (docs/progress/20260823-m23-08-p04-root-fix-feasibility.md)。
// 接続文字列に載せると modernc.org/sqlite が newConn の中で適用するため、
// 「接続が張られるたび」に効く。
//
// ★この形が戻されたことは TestOpen_AllPooledConnectionsHaveAppPragmas が検出する。
const dsnPragmaParams = "_pragma=busy_timeout(5000)" +
	"&_pragma=foreign_keys(1)" +
	"&_pragma=journal_mode(WAL)" +
	"&_pragma=synchronous(NORMAL)"

// dsnTxLockParam は書き込みトランザクションを BEGIN IMMEDIATE で開始させる指定である
// (M24-11 / CHANGE-136)。
//
// ★★なぜ要るのか———————————————————————————————————————————
// SQLite 既定の BEGIN(DEFERRED)は「最初の書き」で write lock を取る。したがって
// 2 つのトランザクションが両方 SELECT して「重複なし」を見たあと、順に INSERT できる
// ——VAL-C02 の check-then-act はこの隙で起きた(M24-09c 設計伝達レポート §4-1)。
// BEGIN IMMEDIATE は「開始時点」で write lock を取るため、2 本目は 1 本目の commit を
// 待ち、その後の SELECT は commit 済みの行を見る。
//
// ★これは新たな悲観ロックの導入ではない。SQLite は WAL でも writer を元来 1 本に
// 直列化しており、変わるのは「ロックを取る時刻」だけである(NFR203 の
// 「悲観ロックは採用しない」には抵触しない)。
//
// ★★_pragma とは効き方の粒度が違う。混ぜないこと(M23-10 の型と混同しない)—————
// _pragma は「接続を作るとき 1 回」効く接続単位の設定である。_txlock は接続に保持され、
// BeginTx を呼ぶたびに参照される「既定の begin モード」であり、トランザクション単位の
// 話である。同じ DSN に載るが別物であるため、定数も別に置いてある。
//
// ★★読み取り専用トランザクションには効かない———————————————————————
// modernc.org/sqlite v1.50.0 の tx.go:22-25 が opts.ReadOnly を見て beginMode を外す:
//
//	sql := "begin"
//	if !opts.ReadOnly && c.beginMode != "" { sql = "begin " + c.beginMode }
//
// ⇒ sql.TxOptions{ReadOnly: true} で開けば DEFERRED のままであり、不要に write lock を
// 取らせない(指示書 M24-11 §4.1.2 の要求)。本リポジトリに読み取り専用 tx は現時点で
// 0 件だが、増えたときに自動で除外される。
//
// ★なぜ書き込み用ヘルパ 1 本ではなく DSN なのか(M24-11 の実査で決めた)——————
// 書き込み tx の開始点は 24 か所あり、共通ヘルパは無い。DSN に載せれば呼び出し側を
// 1 行も変えずに全数へ効き、「次に足す経路が忘れる」形が構造的に起きない。ヘルパ方式は
// 使い忘れると DEFERRED へ戻る＝危険側へ倒れる既定を残す。
//
// ★この形が外されたことは TestOpen_WriteTxUsesBeginImmediate が検出する。
const dsnTxLockParam = "_txlock=immediate"

// escapeDBPath は dbPath を SQLite の file: URI に載せられる形へエスケープする。
//
// url.URL{Path:...}.EscapedPath() は '?' '#' '%' '\' 空白・非 ASCII をパーセント
// エンコードし、'/' と ':' は素のまま残す(Windows のドライブ文字 "C:" と区切りを壊さない)。
// SQLite 側が %HH をデコードして元のパスへ戻す。
func escapeDBPath(dbPath string) string {
	return (&url.URL{Path: dbPath}).EscapedPath()
}

// buildDSN は dbPath からアプリ標準 PRAGMA 付きの接続文字列を組み立てる。
//
// ★なぜ "file:" 形式なのか(M23-10 §4.1-3)————————————————————————
// modernc.org/sqlite は DSN を「最初の '?'」でパスとクエリに割る(conn.go newConn)。
// "file:" 接頭辞が無いとパス側が '?' の手前で切り詰められるため、'?' を含むパスは
// 壊れる。利用者は config の database.path / TACPENDIUM_DB_PATH で任意のパスを与えられ、
// config.ValidateDataPath は '?' '#' '%' を禁止していない。
// "file:" 形式なら DSN 全体が SQLITE_OPEN_URI 付きで SQLite に渡り、SQLite 自身が
// URI として解釈する(パーセントデコードを含む)。
func buildDSN(dbPath string) string {
	return "file:" + escapeDBPath(dbPath) + "?" + dsnTxLockParam + "&" + dsnPragmaParams
}

// Open は dbPath に対する *sql.DB を返す。
//
// 親ディレクトリが存在しなければ作成し、アプリ標準 PRAGMA
// (journal_mode=WAL / foreign_keys=ON / busy_timeout / synchronous=NORMAL)を
// 接続文字列で指定する。最後に Ping で疎通確認する。
//
// ★PRAGMA は接続文字列側で指定している。プール中の「すべての」接続へ効かせるためであり、
// プール確立後に Exec する形へ戻してはならない(理由は dsnPragmaParams の注記。ボード P-04)。
//
// ★接続数の上限(SetMaxOpenConns)は設定していない。FK とは独立の論点であり、
// 本関数の責務に混ぜない(M23-10 §1.5-3)。
//
// ★マイグレーションは本関数を通らない —— internal/infra/migration が独自に
// sql.Open しており、従来どおり foreign_keys=OFF で走る(M23-10 §1.3-1。表を作り直す
// マイグレーションを FK=ON で走らせないための意図的な分離である)。
func Open(dbPath string) (*sql.DB, error) {
	if dbPath == "" {
		return nil, fmt.Errorf("db: empty dbPath")
	}
	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("db: mkdir %q: %w", dir, err)
		}
	}

	conn, err := sql.Open(driverName, buildDSN(dbPath))
	if err != nil {
		return nil, fmt.Errorf("db: open %q: %w", dbPath, err)
	}

	if pingErr := conn.Ping(); pingErr != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("db: ping: %w", pingErr)
	}
	return conn, nil
}

// アプリ既定データディレクトリのフォルダ名と DB ファイル名。
//
// ★M28-01(正式名リネーム)で combomgr → tacpendium へ変わった。旧名は移行元の特定にだけ
// 使うため legacy* として残してある。リテラルを散らさないための定数化(CLAUDE.md §4)。
const (
	appDirName = "tacpendium"
	dbFileName = "tacpendium.db"

	// legacyAppDirName / legacyDBFileName は M28-01 より前の既定名。
	// ★利用者のデータの移行元を指すためだけに存在する。新規の書き込み先には使わない。
	legacyAppDirName = "combomgr"
	legacyDBFileName = "combomgr.db"
)

// AppDirName はアプリ既定データディレクトリのフォルダ名を返す。
func AppDirName() string { return appDirName }

// DBFileName は既定 DB ファイル名を返す。
func DBFileName() string { return dbFileName }

// LegacyAppDirName は M28-01 より前の既定データディレクトリ名を返す。移行元の特定にのみ使う。
func LegacyAppDirName() string { return legacyAppDirName }

// LegacyDBFileName は M28-01 より前の既定 DB ファイル名を返す。移行元の特定にのみ使う。
func LegacyDBFileName() string { return legacyDBFileName }

// ResolveDBPath は cfgPath が空のとき OS 別アプリデータディレクトリ配下の
// 既定 DB パスを返す。明示パスが指定されていればそのまま返す。
//
// OS 別既定パス(M1-02 指示書 §4.1.3。名前は M28-01 で変更):
//   - Windows: %APPDATA%\tacpendium\tacpendium.db
//   - macOS:   ~/Library/Application Support/tacpendium/tacpendium.db
//   - Linux:   ~/.local/share/tacpendium/tacpendium.db (XDG_DATA_HOME 仕様)
//
// os.UserConfigDir() は Linux で ~/.config を返してしまうため使わず、
// OS 別に手動で組み立てる。
func ResolveDBPath(cfgPath string) (string, error) {
	if cfgPath != "" {
		return cfgPath, nil
	}
	return defaultDBPath(appDirName, dbFileName)
}

// LegacyResolveDBPath は M28-01 より前の既定 DB パスを返す。
//
// ★移行元の特定にのみ使う(internal/infra/datadir)。cfgPath 相当の引数を取らないのは、
// 「利用者が明示したパス」には旧既定が関係しないためである。
func LegacyResolveDBPath() (string, error) {
	return defaultDBPath(legacyAppDirName, legacyDBFileName)
}

// defaultDBPath は OS 別のアプリデータ基底 + dirName + fileName を組み立てる。
func defaultDBPath(dirName, fileName string) (string, error) {
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("APPDATA")
		if base == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", fmt.Errorf("db: resolve home dir on windows: %w", err)
			}
			base = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(base, dirName, fileName), nil

	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("db: resolve home dir on darwin: %w", err)
		}
		return filepath.Join(home, "Library", "Application Support", dirName, fileName), nil

	default: // linux と未知の Unix 系
		// XDG_DATA_HOME を尊重(設定されていれば $XDG_DATA_HOME/<dirName>/<fileName>)
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, dirName, fileName), nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("db: resolve home dir on linux: %w", err)
		}
		return filepath.Join(home, ".local", "share", dirName, fileName), nil
	}
}

// DataDir はアプリ既定のデータディレクトリ(OS 別の tacpendium フォルダ)を返す。
// ResolveDBPath("") の親ディレクトリに一致する。設定パス検証で「書き込みを許可する
// ルート」として再利用するために公開している(database.path / logging.file の脱出防止)。
func DataDir() (string, error) {
	p, err := ResolveDBPath("")
	if err != nil {
		return "", err
	}
	return filepath.Dir(p), nil
}

// LegacyDataDir は M28-01 より前の既定データディレクトリ(OS 別の combomgr フォルダ)を返す。
//
// ★2 つの用途しか無い。(1) internal/infra/datadir の移行元 (2) config.appDataRoots が
// 移行前に書かれた config.toml の絶対パスを検証で弾かないための経過措置。
// ★新規の書き込み先として使ってはならない。
func LegacyDataDir() (string, error) {
	p, err := LegacyResolveDBPath()
	if err != nil {
		return "", err
	}
	return filepath.Dir(p), nil
}
