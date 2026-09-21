// template_test.go は「テスト DB のテンプレート化(M24-09d / CHANGE-145)が、
// テストの検証内容を 1 つも変えていないこと」を固定する。
//
// ★★本ファイルが要る理由 —— テンプレート方式は「壊れると落ちる」ではなく
// 「壊れると何も検証しないまま緑になる」形をとりうる。テンプレートのコピーに失敗して
// 空の DB でテストが走っても、「その行は存在しない」を確かめているテストは緑のまま
// であり、しかも速くなる。**⇒ 速度を正しさの根拠にできない面である。**
//
// ★★比較相手はテンプレートを通さないこと。本ファイルは migration.Run を自分で呼んで
// 素の DB を作り、それと突き合わせる。テンプレート由来どうしを比べると、
// 壊れたときに両方が同じように壊れて検出できない。
package dbtest_test

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"

	_ "modernc.org/sqlite"
)

// openFreshlyMigrated は、テンプレートを一切通さずマイグレーションを流した DB を開く。
// ★db.Open は使わない。dbtest と同じ経路を使うと「同じ壊れ方」を共有してしまう。
func openFreshlyMigrated(t *testing.T) *sql.DB {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "fresh.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("比較相手のマイグレーションに失敗: %v", err)
	}
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("比較相手を開けない: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

// queryRows は任意のクエリ/PRAGMA の結果を「列名=値」の行文字列にして返す。
// 列構成を先に決め打ちしないため、table_info / index_list / foreign_key_list を
// 同じ関数で全列そのまま拾える(列を取りこぼさない)。
func queryRows(t *testing.T, conn *sql.DB, query string) []string {
	t.Helper()

	rows, err := conn.Query(query)
	if err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	defer func() { _ = rows.Close() }()

	cols, err := rows.Columns()
	if err != nil {
		t.Fatalf("columns %q: %v", query, err)
	}

	var out []string
	for rows.Next() {
		vals := make([]sql.NullString, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			t.Fatalf("scan %q: %v", query, err)
		}
		var b strings.Builder
		for i, c := range cols {
			if i > 0 {
				b.WriteString("|")
			}
			v := "<NULL>"
			if vals[i].Valid {
				v = vals[i].String
			}
			fmt.Fprintf(&b, "%s=%s", c, v)
		}
		out = append(out, b.String())
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err %q: %v", query, err)
	}
	return out
}

func queryOneColumn(t *testing.T, conn *sql.DB, query string) []string {
	t.Helper()

	rows, err := conn.Query(query)
	if err != nil {
		t.Fatalf("query %q: %v", query, err)
	}
	defer func() { _ = rows.Close() }()

	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatalf("scan %q: %v", query, err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows.Err %q: %v", query, err)
	}
	return out
}

func userTables(t *testing.T, conn *sql.DB) []string {
	t.Helper()
	return queryOneColumn(t, conn,
		`SELECT name FROM sqlite_master
		  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
		  ORDER BY name`)
}

// schemaDump はスキーマを「テーブル・列・インデックス・外部キーの全数」で文字列化する。
// ★「テーブルが在る」だけで済ませないこと。列の型・NOT NULL・既定値・主キー、
//
//	インデックスの一意性と構成列、外部キーの参照先と ON DELETE まで含める。
func schemaDump(t *testing.T, conn *sql.DB) string {
	t.Helper()

	var lines []string
	for _, r := range queryRows(t, conn,
		`SELECT type, name, tbl_name, COALESCE(sql, '<NULL>') AS sql
		   FROM sqlite_master ORDER BY type, name, tbl_name`) {
		lines = append(lines, "sqlite_master: "+r)
	}

	for _, tbl := range userTables(t, conn) {
		q := strings.ReplaceAll(tbl, "'", "''")
		for _, r := range queryRows(t, conn, fmt.Sprintf("PRAGMA table_info('%s')", q)) {
			lines = append(lines, "table_info["+tbl+"]: "+r)
		}
		for _, r := range queryRows(t, conn, fmt.Sprintf("PRAGMA foreign_key_list('%s')", q)) {
			lines = append(lines, "foreign_key_list["+tbl+"]: "+r)
		}
		for _, r := range queryRows(t, conn, fmt.Sprintf("PRAGMA index_list('%s')", q)) {
			lines = append(lines, "index_list["+tbl+"]: "+r)
		}
		// 自動生成インデックス(UNIQUE 制約由来)も含めて構成列まで見る。
		for _, idx := range queryOneColumn(t, conn,
			fmt.Sprintf("SELECT name FROM pragma_index_list('%s') ORDER BY name", q)) {
			qi := strings.ReplaceAll(idx, "'", "''")
			for _, r := range queryRows(t, conn, fmt.Sprintf("PRAGMA index_info('%s')", qi)) {
				lines = append(lines, "index_info["+tbl+"."+idx+"]: "+r)
			}
		}
	}
	return strings.Join(lines, "\n")
}

// rowCountDump は全テーブルの行数を返す。
//
// ★★指示書 §5.1-1 はスキーマの一致だけを求めているが、行数も突き合わせる。
// スキーマだけを比べると、**seed が 1 行も入っていないテンプレートが緑で通る。**
// それは本サブが最も恐れている壊れ方そのものである(空 DB でも「無いこと」を
// 確かめるテストは緑のままで、しかも速い)。
func rowCountDump(t *testing.T, conn *sql.DB) string {
	t.Helper()

	var lines []string
	for _, tbl := range userTables(t, conn) {
		var n int64
		q := strings.ReplaceAll(tbl, `"`, `""`)
		if err := conn.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, q)).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", tbl, err)
		}
		lines = append(lines, fmt.Sprintf("%s=%d", tbl, n))
	}
	return strings.Join(lines, "\n")
}

// TestTemplate_SchemaMatchesFreshMigration —— 指示書 §5.1-1。
func TestTemplate_SchemaMatchesFreshMigration(t *testing.T) {
	fromTemplate := dbtest.Setup(t)
	fresh := openFreshlyMigrated(t)

	gotSchema := schemaDump(t, fromTemplate)
	wantSchema := schemaDump(t, fresh)

	if gotSchema != wantSchema {
		t.Errorf("テンプレート由来の DB のスキーマが、マイグレーションを流した DB と一致しない\n%s",
			firstDifference(wantSchema, gotSchema))
	}

	// ★スキーマが一致していても中身が空なら意味がない。行数まで見る。
	gotRows := rowCountDump(t, fromTemplate)
	wantRows := rowCountDump(t, fresh)
	if gotRows != wantRows {
		t.Errorf("テンプレート由来の DB の行数が、マイグレーションを流した DB と一致しない\n%s",
			firstDifference(wantRows, gotRows))
	}

	// 「両方とも空だから一致した」を排除する。seed が入っていることを直接主張する。
	var characters int64
	if err := fromTemplate.QueryRow(`SELECT COUNT(*) FROM characters`).Scan(&characters); err != nil {
		t.Fatalf("count characters: %v", err)
	}
	if characters == 0 {
		t.Fatal("テンプレート由来の DB に characters が 1 行も無い。seed が届いていない")
	}
}

// firstDifference は 2 つのダンプの最初の差異を、行番号つきで返す。
func firstDifference(want, got string) string {
	wantLines := strings.Split(want, "\n")
	gotLines := strings.Split(got, "\n")
	for i := 0; i < len(wantLines) || i < len(gotLines); i++ {
		var w, g string
		if i < len(wantLines) {
			w = wantLines[i]
		}
		if i < len(gotLines) {
			g = gotLines[i]
		}
		if w != g {
			return fmt.Sprintf("  最初の差異 (行 %d / want %d 行・got %d 行)\n  want: %s\n  got : %s",
				i+1, len(wantLines), len(gotLines), w, g)
		}
	}
	return "  (行単位の差異なし。末尾の改行等を疑うこと)"
}

// TestTemplate_BuiltOnlyOnce —— 指示書 §5.1-2。sync.Once が効いていること。
//
// ★★これは「速度以外の指標」である。テンプレートが毎回作り直されていても速度は
// 元に戻るだけで、テストは全部緑のままになる。⇒ 回数そのものを主張する。
func TestTemplate_BuiltOnlyOnce(t *testing.T) {
	// 本パッケージは DisableTemplate() を呼んでいないため、テンプレート方式で動く。
	_ = dbtest.Setup(t)
	_ = dbtest.Setup(t)
	_ = dbtest.Setup(t)

	if got := dbtest.MigrationRunCount(); got != 1 {
		t.Errorf("dbtest.MigrationRunCount() = %d, want 1"+
			"\n  1 でないなら、テンプレートがテストごとに作り直されている"+
			"\n  (テストの実行順によらず、テンプレート方式なら常に 1 である)", got)
	}
}

// TestTemplate_NoWalSidecarFiles —— 指示書 §5.1-3。
//
// ★テンプレートそのものにサイドカーが残っていないことは buildTemplate が構築時に
// 検査しており、残っていれば **本プロセスのすべての Setup が落ちる**(黙って進まない)。
// 本テストはその外側、「配られた DB を閉じたあとに余計なファイルが残らない」を見る。
func TestTemplate_NoWalSidecarFiles(t *testing.T) {
	conn, dbPath := dbtest.SetupWithPath(t)

	// 使っている最中は WAL のサイドカーが在ってよい(db.Open が journal_mode=WAL を
	// 指定するため)。見るのは「最後の接続を閉じたあと」である。
	if err := conn.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	for _, suffix := range []string{"-wal", "-shm"} {
		if _, err := os.Stat(dbPath + suffix); err == nil {
			t.Errorf("接続を閉じたあとも %s が残っている", filepath.Base(dbPath+suffix))
		} else if !os.IsNotExist(err) {
			t.Fatalf("stat %s: %v", dbPath+suffix, err)
		}
	}

	entries, err := os.ReadDir(filepath.Dir(dbPath))
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	if len(entries) != 1 || entries[0].Name() != filepath.Base(dbPath) {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("DB ディレクトリに %v が在る。want [%s] だけ", names, filepath.Base(dbPath))
	}
}
