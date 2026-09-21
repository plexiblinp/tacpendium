package migration_test

import (
	"testing"
)

// TestRun_M1802_StartersUnique は combo_punish_starters の UNIQUE(self,opp,starter)が重複 INSERT を
// 弾くことを検証する。マイグレ接続は FK=OFF のため、FK を伴わない任意 id で UNIQUE のみを検証する。
func TestRun_M1802_StartersUnique(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	insert := `INSERT INTO combo_punish_starters(self_character_id,opponent_move_id,starter_move_id,verdict) VALUES(?,?,?,?)`
	if _, err := db.Exec(insert, 1, 1, 1, "adopted"); err != nil {
		t.Fatalf("初回 INSERT が失敗: %v", err)
	}
	// 同一 (self,opp,starter) の重複は弾かれる。
	if _, err := db.Exec(insert, 1, 1, 1, "unreachable"); err == nil {
		t.Errorf("(self,opp,starter) 重複 INSERT が UNIQUE で弾かれていない")
	}
	// starter_move_id だけ異なれば別行として通る(UNIQUE は 3 列複合)。
	if _, err := db.Exec(insert, 1, 1, 2, "adopted"); err != nil {
		t.Errorf("starter_move_id 違いの INSERT が通らない: %v", err)
	}
}
