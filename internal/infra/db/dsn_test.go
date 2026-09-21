package db

import (
	"os"
	"path/filepath"
	"testing"
)

// TestBuildDSN は接続文字列の組み立てを固定する(M23-10 §4.1-3)。
//
// ★Windows のケースは文字列レベルの主張に留めている。本テストが走る環境で
// C:\ 形式の実パスを開けないためであり、実挙動は確かめていない。
//
// ★M24-11: 期待値へ _txlock=immediate を足した。★_pragma 4 種と "file:" 形式は
// 1 文字も変えていない(M23-10 / CHANGE-142 の根治は不変)。_txlock は _pragma とは
// 効き方の粒度が違う別物であり、定数も別である(db.go の dsnTxLockParam を参照)。
func TestBuildDSN(t *testing.T) {
	tests := []struct {
		name     string
		dbPath   string
		wantPath string // "file:" と "?" の間に現れるべき文字列
	}{
		{"通常の絶対パス", "/home/u/.local/share/combomgr/combomgr.db", "/home/u/.local/share/combomgr/combomgr.db"},
		{"相対パス", "combomgr.db", "combomgr.db"},
		{"疑問符を含む", "/data/my?db.db", "/data/my%3Fdb.db"},
		{"シャープを含む", "/data/my#db.db", "/data/my%23db.db"},
		{"パーセントを含む", "/data/my%db.db", "/data/my%25db.db"},
		{"空白を含む", "/data/my db.db", "/data/my%20db.db"},
		{"非ASCIIを含む", "/data/コンボ.db", "/data/%E3%82%B3%E3%83%B3%E3%83%9C.db"},
		{"Windows風のドライブとバックスラッシュ", `C:\Users\u\AppData\Roaming\combomgr\combomgr.db`,
			`C:%5CUsers%5Cu%5CAppData%5CRoaming%5Ccombomgr%5Ccombomgr.db`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildDSN(tt.dbPath)
			want := "file:" + tt.wantPath + "?" + dsnTxLockParam + "&" + dsnPragmaParams
			if got != want {
				t.Errorf("buildDSN(%q)\n got = %q\nwant = %q", tt.dbPath, got, want)
			}
		})
	}
}

// TestOpen_PathWithSpecialCharacters は、接続文字列のクエリ境界を壊しうる文字を
// 含むパスでも接続でき、DB ファイルが「そのパスに」作られることを主張する
// (M23-10 §5.1-4)。
//
// ★利用者は config の database.path / TACPENDIUM_DB_PATH で任意のパスを与えられ、
// config.ValidateDataPath は '?' '#' '%' を 1 文字も禁止していない。
func TestOpen_PathWithSpecialCharacters(t *testing.T) {
	for _, name := range []string{"q?mark.db", "hash#mark.db", "per%cent.db", "with space.db", "コンボ.db"} {
		t.Run(name, func(t *testing.T) {
			dbPath := filepath.Join(t.TempDir(), name)

			conn, err := Open(dbPath)
			if err != nil {
				t.Fatalf("Open(%q): %v", dbPath, err)
			}
			t.Cleanup(func() { _ = conn.Close() })

			// PRAGMA が届いていること(= クエリ側も壊れていないこと)。
			var fk int
			if err := conn.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
				t.Fatalf("PRAGMA foreign_keys: %v", err)
			}
			if fk != 1 {
				t.Errorf("foreign_keys = %d, want 1", fk)
			}

			// 書き込みを起こして実ファイルを確定させる。
			if _, err := conn.Exec(`CREATE TABLE probe (id INTEGER PRIMARY KEY)`); err != nil {
				t.Fatalf("CREATE TABLE: %v", err)
			}

			// ★DB ファイルが「指定したパスそのもの」に作られていること。
			//   パスが切り詰められていれば別名のファイルができる。
			if _, err := os.Stat(dbPath); err != nil {
				t.Errorf("DB ファイルが %q に作られていない: %v", dbPath, err)
			}
		})
	}
}
