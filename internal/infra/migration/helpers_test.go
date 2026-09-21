package migration_test

// 本パッケージ共通のテスト用小道具。
//
// ★★置き場をここに寄せた理由(M33-03)——着手時点では newMigrator(25 ファイルが利用)と
// scanInt(20 ファイル)が migrate_m1403b_test.go に、fkCheck が migrate_m1403c_test.go に
// 住んでいた。⇒ サブ名のファイルは、そのサブの主張が失効したときに丸ごと消える。
// 実際 M33-02 が旧 111 本を 9 群へ潰した結果、本パッケージの 11 ファイルが
// 「テスト 0 本」になった。★共通の足場がその中に混ざっていると、消す手番で
// 気づかないまま連鎖して壊れる。⇒ 共通のものは共通の置き場へ。
//
// ★新しい小道具をここへ足す基準は「2 ファイル以上から使われること」。
// 1 ファイルしか使わないものは、そのファイルに置いたままにする。

import (
	"database/sql"
	"encoding/csv"
	"os"
	"path/filepath"
	"sort"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"

	"github.com/golang-migrate/migrate/v4"
	sqlitemig "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"
)

// newMigrator は本番同様の embed migrations で golang-migrate インスタンスを作る(往復検証用)。
func newMigrator(t *testing.T) (*migrate.Migrate, *sql.DB) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "migration.db")
	src, err := iofs.New(tacpendium.MigrationsFS, "migrations")
	if err != nil {
		t.Fatalf("iofs.New: %v", err)
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	drv, err := sqlitemig.WithInstance(db, &sqlitemig.Config{})
	if err != nil {
		t.Fatalf("WithInstance: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("NewWithInstance: %v", err)
	}
	return m, db
}

func scanInt(t *testing.T, db *sql.DB, q string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("query %q: %v", q, err)
	}
	return n
}

// fkCheck は PRAGMA foreign_key_check の違反ゼロを検証する(FK=OFF 適用中の宙吊り参照検出)。
//
// ★rows.Err() を必ず確認すること。rows.Next() が false を返す理由は「違反 0」と
// 「イテレーション中のエラー」の 2 通りあり、確認しないと後者を「違反 0」と誤読する。
// 本ヘルパは TestRun_HEAD_NoDanglingForeignKeys の唯一の判定器でもある(M19-04d)。
func fkCheck(t *testing.T, db *sql.DB) {
	t.Helper()
	rows, err := db.Query("PRAGMA foreign_key_check")
	if err != nil {
		t.Fatalf("foreign_key_check: %v", err)
	}
	defer rows.Close()
	if rows.Next() {
		t.Errorf("foreign_key_check に違反行あり(宙吊り FK 参照)")
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("foreign_key_check の走査中にエラー: %v", err)
	}
}

// csvMoveCodes は character_data/<code>.csv の move_code 列を集合で返す。
//
// ★★なぜ CSV を正本に取るか(M33-03 段 2)——着手時点の UpContract 系テストは
// 「ryu moves = 93(CSV 84 + 移動 9)」のように *その波の母数*を写していた。
// ⇒ CSV に行が増えるたび、また全キャラへ system move を足すたびに落ちる。
// 実際 M33-03 の着手時点では CSV 84 行・system 11 種(移動 9 ＋ drive_parry ＋
// drive_reversal)であり、「+9」という前提そのものが失効していた。
//
// ★CSV は seed の正本である(SUPP-001 §5.5 規約 (19))。⇒ 件数を写すのではなく
// CSV と突き合わせる。★突き合わせは件数より強い——「84 行」は 1 行入れ替わっても緑になる。
func csvMoveCodes(t *testing.T, charCode string) map[string]bool {
	t.Helper()
	path := filepath.Join(repoRootForCSV(t), "character_data", charCode+".csv")
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	recs, err := r.ReadAll()
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if len(recs) < 2 {
		t.Fatalf("%s: データ行が無い", path)
	}
	out := make(map[string]bool, len(recs)-1)
	for _, rec := range recs[1:] {
		if len(rec) > 1 && rec[1] != "" {
			out[rec[1]] = true
		}
	}
	if len(out) == 0 {
		t.Fatalf("%s: move_code を 1 件も読めなかった", path)
	}
	return out
}

// assertCharMovesMatchCSV は「CSV の move_code が全部 DB に在り、DB にしか無いのは
// category='system' の行だけである」ことを主張する。
//
// ★件数を書かない。⇒ seed 波が進んでも、全キャラへ system move を足しても緑のままで、
// しかも主張は件数より強い(入れ替わりを検出する)。
func assertCharMovesMatchCSV(t *testing.T, db *sql.DB, charCode string) {
	t.Helper()
	want := csvMoveCodes(t, charCode)

	rows, err := db.Query(`SELECT m.code, m.category FROM moves m
		JOIN characters c ON c.id = m.character_id WHERE c.code = ?`, charCode)
	if err != nil {
		t.Fatalf("query moves for %s: %v", charCode, err)
	}
	defer rows.Close()
	got := map[string]string{}
	for rows.Next() {
		var code, category string
		if err := rows.Scan(&code, &category); err != nil {
			t.Fatalf("scan move: %v", err)
		}
		got[code] = category
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate moves: %v", err)
	}

	var missing, extra []string
	for code := range want {
		if _, ok := got[code]; !ok {
			missing = append(missing, code)
		}
	}
	for code, category := range got {
		if !want[code] && category != "system" {
			extra = append(extra, code)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)
	if len(missing) != 0 {
		t.Errorf("%s: CSV に在って DB に無い move_code = %v (CSV %d 行)", charCode, missing, len(want))
	}
	if len(extra) != 0 {
		t.Errorf("%s: DB にしか無い非 system の move_code = %v", charCode, extra)
	}
}
