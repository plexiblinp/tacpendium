package migration_test

import (
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// mustExec1903 は M19-03 テスト用の Exec ラッパ(失敗即 Fatal)。
func mustExec1903(t *testing.T, db *sql.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.Exec(q, args...); err != nil {
		t.Fatalf("exec %q: %v", q, err)
	}
}

// TestRun_M1903_PrimaryKeyLimitsToFourRows は 1 組あたり最大 4 行(受け身 2 × 端 2)を
// PK が構造的に保証することを検証する(§5.1-4)。
// マイグレ接続は FK=OFF のため FK を伴わない任意 id で PK のみを検証する。
func TestRun_M1903_PrimaryKeyLimitsToFourRows(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	for _, tech := range []string{"neutral_tech", "back_tech"} {
		for _, corner := range []int{0, 1} {
			mustExec1903(t, db,
				`INSERT INTO combo_setup_results(combo_id,setup_id,tech_type,in_corner,result) VALUES(1,1,?,?,'ok')`,
				tech, corner)
		}
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combo_setup_results WHERE combo_id=1 AND setup_id=1`); got != 4 {
		t.Fatalf("1 組の行数 = %d, want 4", got)
	}
	// 5 行目(同一キーの再 INSERT)は PK で弾かれる。
	if _, err := db.Exec(`INSERT INTO combo_setup_results(combo_id,setup_id,tech_type,in_corner,result) VALUES(1,1,'neutral_tech',0,'ng')`); err == nil {
		t.Errorf("同一キーの重複 INSERT が PK で弾かれていない")
	}
}

// TestRun_M1903_FKCascade は FK=ON 接続(dbtest)で本表の FK 挙動を検証する:
//   - 紐付けが存在しない組への INSERT は複合 FK で弾かれる(§5.1-5)
//   - combo_setups の削除(紐付け解除)で結果行が CASCADE で消える(§5.1-6)
//   - combo_setups.combo_id の UPDATE(識別キー変更編集の再ポイント)に ON UPDATE CASCADE で追従する(§4.2)
func TestRun_M1903_FKCascade(t *testing.T) {
	db := dbtest.Setup(t)
	// ★M23-10 以降、この固定は FK=ON の根拠ではない(db.Open 経由は全接続 FK=ON)。
	// 当時の名残であり、外すかどうかは M23-10 の判断事項ではないため残している。
	db.SetMaxOpenConns(1)

	charID := scanInt(t, db, `SELECT id FROM characters LIMIT 1`)

	res, err := db.Exec(`INSERT INTO combos(character_id) VALUES(?)`, charID)
	if err != nil {
		t.Fatalf("combo insert: %v", err)
	}
	comboID, _ := res.LastInsertId()
	sres, err := db.Exec(`INSERT INTO setups(character_id, step_count) VALUES(?, 1)`, charID)
	if err != nil {
		t.Fatalf("setup insert: %v", err)
	}
	setupID, _ := sres.LastInsertId()

	// 紐付けが存在しない組への書き込みは複合 FK で弾かれる。
	if _, err := db.Exec(
		`INSERT INTO combo_setup_results(combo_id,setup_id,tech_type,in_corner,result) VALUES(?,?,'neutral_tech',0,'ok')`,
		comboID, setupID); err == nil {
		t.Errorf("紐付け(combo_setups)が無い組への INSERT が複合 FK で弾かれていない")
	}

	mustExec1903(t, db, `INSERT INTO combo_setups(combo_id,setup_id) VALUES(?,?)`, comboID, setupID)
	mustExec1903(t, db,
		`INSERT INTO combo_setup_results(combo_id,setup_id,tech_type,in_corner,result,note) VALUES(?,?,'back_tech',1,'ng','端では届かない')`,
		comboID, setupID)

	// ★ON UPDATE CASCADE: 識別キー変更編集は combo_setups.combo_id を UPDATE する
	// (repository/combo UpdateSetupReferences)。結果行がこれに追従する。
	nres, err := db.Exec(`INSERT INTO combos(character_id) VALUES(?)`, charID)
	if err != nil {
		t.Fatalf("new combo insert: %v", err)
	}
	newComboID, _ := nres.LastInsertId()
	if _, err := db.Exec(`UPDATE combo_setups SET combo_id = ? WHERE combo_id = ?`, newComboID, comboID); err != nil {
		t.Fatalf("combo_setups の再ポイントが失敗した(ON UPDATE CASCADE 未設定の疑い): %v", err)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combo_setup_results WHERE combo_id=?`, newComboID); got != 1 {
		t.Errorf("再ポイント後の新 combo_id で引ける結果行 = %d, want 1", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combo_setup_results WHERE combo_id=?`, comboID); got != 0 {
		t.Errorf("旧 combo_id に結果行が %d 行残存", got)
	}

	// ON DELETE CASCADE: 紐付け解除で結果行が消える。
	mustExec1903(t, db, `DELETE FROM combo_setups WHERE combo_id=? AND setup_id=?`, newComboID, setupID)
	if got := scanInt(t, db, `SELECT count(*) FROM combo_setup_results`); got != 0 {
		t.Errorf("紐付け解除後も結果行が %d 行残存", got)
	}
}
