package migration_test

import (
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// mustExec1801 は M18-01 テスト用の Exec ラッパ(失敗即 Fatal)。
func mustExec1801(t *testing.T, db *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.Exec(q, args...); err != nil {
		t.Fatalf("exec %q: %v", q, err)
	}
}

// TestRun_M1801_UniqueConstraints は 3 新表の UNIQUE が重複 INSERT を弾くことを検証する。
// マイグレ接続は FK=OFF のため、FK を伴わない任意 id で UNIQUE のみを検証する。
func TestRun_M1801_UniqueConstraints(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	cases := []struct {
		name   string
		insert string
	}{
		{"combo_punishes", `INSERT INTO combo_punishes(combo_id,opponent_move_id) VALUES(1,1)`},
		{"combo_punish_prunings", `INSERT INTO combo_punish_prunings(self_character_id,opponent_move_id) VALUES(1,1)`},
		{"combo_punish_curations", `INSERT INTO combo_punish_curations(combo_id,opponent_move_id) VALUES(1,1)`},
	}
	for _, c := range cases {
		if _, err := db.Exec(c.insert); err != nil {
			t.Fatalf("%s 初回 INSERT が失敗: %v", c.name, err)
		}
		if _, err := db.Exec(c.insert); err == nil {
			t.Errorf("%s の重複 INSERT が UNIQUE で弾かれていない", c.name)
		}
	}
}

// TestRun_M1801_FKCascade は FK=ON 接続(dbtest)で ON DELETE CASCADE と粒度の非対称を検証する:
// combo 削除で combo_punishes / combo_punish_curations は消え、combo_punish_prunings は残る。
// あわせて materialized_from_combo_id の self-FK(有効参照は通り・不正参照は弾かれる)を検証する。
func TestRun_M1801_FKCascade(t *testing.T) {
	db := dbtest.Setup(t)
	// ★M23-10 以降、この固定は FK=ON の根拠ではない(db.Open 経由は全接続 FK=ON)。
	// 当時の名残であり、外すかどうかは M23-10 の判断事項ではないため残している。
	db.SetMaxOpenConns(1)

	charID := scanInt(t, db, `SELECT id FROM characters LIMIT 1`)
	moveID := scanInt(t, db, `SELECT id FROM moves LIMIT 1`)

	res, err := db.Exec(`INSERT INTO combos(character_id) VALUES(?)`, charID)
	if err != nil {
		t.Fatalf("combo insert: %v", err)
	}
	comboID, _ := res.LastInsertId()

	mustExec1801(t, db, `INSERT INTO combo_punishes(combo_id,opponent_move_id) VALUES(?,?)`, comboID, moveID)
	mustExec1801(t, db, `INSERT INTO combo_punish_curations(combo_id,opponent_move_id) VALUES(?,?)`, comboID, moveID)
	mustExec1801(t, db, `INSERT INTO combo_punish_prunings(self_character_id,opponent_move_id) VALUES(?,?)`, charID, moveID)

	mustExec1801(t, db, `DELETE FROM combos WHERE id=?`, comboID)

	if got := scanInt(t, db, `SELECT count(*) FROM combo_punishes WHERE combo_id=?`, comboID); got != 0 {
		t.Errorf("combo_punishes が CASCADE していない: %d 行残存", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combo_punish_curations WHERE combo_id=?`, comboID); got != 0 {
		t.Errorf("combo_punish_curations が CASCADE していない: %d 行残存", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combo_punish_prunings WHERE self_character_id=?`, charID); got != 1 {
		t.Errorf("combo_punish_prunings が誤って消えた: %d, want 1(combo 非依存で残るべき)", got)
	}

	// self-FK: 有効な基底コンボ参照は INSERT できる。
	base, err := db.Exec(`INSERT INTO combos(character_id) VALUES(?)`, charID)
	if err != nil {
		t.Fatalf("base combo insert: %v", err)
	}
	baseID, _ := base.LastInsertId()
	if _, err := db.Exec(`INSERT INTO combos(character_id, materialized_from_combo_id) VALUES(?,?)`, charID, baseID); err != nil {
		t.Errorf("有効な materialized_from_combo_id 参照の INSERT が失敗: %v", err)
	}
	// 存在しない出自参照は FK=ON で弾かれる。
	if _, err := db.Exec(`INSERT INTO combos(character_id, materialized_from_combo_id) VALUES(?, 999999)`, charID); err == nil {
		t.Errorf("存在しない materialized_from_combo_id が FK で弾かれていない")
	}
}
