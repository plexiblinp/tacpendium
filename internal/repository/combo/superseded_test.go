package combo_test

import (
	"context"
	"database/sql"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M23-01 §5-1 / §5-5: ゴミ箱の絞り込みと復元の扱いを実 DB で固定する。
// SUPP-001 §5.5.4 規約 14: モックを使うハンドラ層テストがある経路は、実 DB のテストを
// 1 本必ず持つ。ここが「隠れている」ことの一次証跡である。

// insertDeletedCombo は削除済みのコンボを 1 行作る。supersededBy が非 nil なら
// 「PUT が積んだ旧行」を模す。
func insertDeletedCombo(t *testing.T, db *sql.DB, stance string, supersededBy *int64) int64 {
	t.Helper()
	return dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id":           1,
		"is_draft":               0,
		"opponent_stance":        stance,
		"version":                1,
		"step_count":             1,
		"deleted_at":             dbtest.Raw("datetime('now')"),
		"superseded_by_combo_id": supersededBy,
	})
}

// insertAliveCombo は現役(未削除)のコンボを 1 行作る。superseded_by_combo_id の参照先に使う。
func insertAliveCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	return dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": 1,
		"is_draft":     0,
		"version":      1,
		"step_count":   1,
	})
}

// §5-1: ゴミ箱の絞り込みが superseded_by_combo_id IS NOT NULL の行を返さない。
// ★同時に「手動削除の行は返る」ことを対で確認する(片方だけでは、全部隠れている
// 状態と区別できない)。
func TestRepository_ListOnlyDeleted_ExcludesSupersededRows(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	// 後継となる現役行(印の参照先)
	successorID := insertAliveCombo(t, db)

	manualID := insertDeletedCombo(t, db, "standing", nil)
	supersededID := insertDeletedCombo(t, db, "crouching", &successorID)

	got, err := repo.List(ctx, comborepo.ListFilter{OnlyDeleted: true})
	if err != nil {
		t.Fatalf("List(OnlyDeleted): %v", err)
	}

	seen := map[int64]bool{}
	for _, c := range got {
		seen[c.ID] = true
	}
	if !seen[manualID] {
		t.Errorf("手動削除の行 %d がゴミ箱に返っていない(隠れすぎ)", manualID)
	}
	if seen[supersededID] {
		t.Errorf("編集で積まれた旧行 %d がゴミ箱に返っている", supersededID)
	}
	if seen[successorID] {
		t.Errorf("現役の後継行 %d がゴミ箱に返っている", successorID)
	}
}

// §4.3-4: 件数(ハンドラは len(items) を返す)も絞り込み後の値に揃う。
func TestRepository_ListOnlyDeleted_CountFollowsFilter(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	successorID := insertAliveCombo(t, db)

	insertDeletedCombo(t, db, "standing", nil)
	insertDeletedCombo(t, db, "crouching", &successorID)
	insertDeletedCombo(t, db, "airborne", &successorID)

	got, err := repo.List(ctx, comborepo.ListFilter{OnlyDeleted: true})
	if err != nil {
		t.Fatalf("List(OnlyDeleted): %v", err)
	}
	if len(got) != 1 {
		t.Errorf("ゴミ箱の件数 = %d, want 1(手動削除の 1 行のみ)", len(got))
	}
}

// §4.3: character_id の絞り込みは従来どおり効く(述語の追加で壊れていない)。
func TestRepository_ListOnlyDeleted_KeepsCharacterFilter(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	ryuID := insertDeletedCombo(t, db, "standing", nil)

	got, err := repo.List(ctx, comborepo.ListFilter{OnlyDeleted: true, CharacterID: ptrInt64(1)})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	found := false
	for _, c := range got {
		if c.ID == ryuID {
			found = true
		}
		if c.CharacterID != 1 {
			t.Errorf("character_id = %d の行が混ざった", c.CharacterID)
		}
	}
	if !found {
		t.Errorf("character_id 指定でリュウの削除行 %d が返らない", ryuID)
	}
}

// §5-5: 復元した行の superseded_by_combo_id の扱い。
// ★復元経路は本サブで変えないため、現状の挙動を固定するテストである。
// 現状: Restore は deleted_at のみを NULL にし、本列には触れない。
// ⇒ 旧行を(API を直接叩くなどして)復元すると、印を持ったまま現役へ戻る。
// 現役行はゴミ箱の絞り込みを通らないため、利用者に見える影響は無い。
func TestRepository_Restore_LeavesSupersededMarkUntouched(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	successorID := insertAliveCombo(t, db)
	oldID := insertDeletedCombo(t, db, "crouching", &successorID)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.Restore(ctx, tx, oldID); err != nil {
			t.Fatalf("Restore: %v", err)
		}
	})

	var mark sql.NullInt64
	if err := db.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&mark); err != nil {
		t.Fatalf("select mark: %v", err)
	}
	if !mark.Valid || mark.Int64 != successorID {
		t.Errorf("復元後の superseded_by_combo_id = %v, want %d(現状の挙動: 触らない)", mark, successorID)
	}

	// 復元後は現役行であり、ゴミ箱には出ない。
	got, err := repo.List(ctx, comborepo.ListFilter{OnlyDeleted: true})
	if err != nil {
		t.Fatalf("List(OnlyDeleted): %v", err)
	}
	for _, c := range got {
		if c.ID == oldID {
			t.Errorf("復元した行 %d がゴミ箱に残っている", oldID)
		}
	}
}

// InsertCombo / FindByID の round-trip で新列が往復すること(scan のズレ検出も兼ねる)。
func TestRepository_SupersededByComboID_RoundTrip(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	successorID := insertAliveCombo(t, db)

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	combo.SupersededByComboID = &successorID

	var newID int64
	withTx(t, db, func(tx *sql.Tx) {
		var insErr error
		newID, insErr = repo.InsertCombo(ctx, tx, combo)
		if insErr != nil {
			t.Fatalf("InsertCombo: %v", insErr)
		}
	})

	got, err := repo.FindByID(ctx, newID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got.SupersededByComboID == nil || *got.SupersededByComboID != successorID {
		t.Errorf("SupersededByComboID = %v, want %d", got.SupersededByComboID, successorID)
	}
	// 既存列が 1 つずれていないことの簡易確認。
	if got.HitType == nil || *got.HitType != "normal" {
		t.Errorf("HitType が壊れている: %v(scan のズレを疑う)", got.HitType)
	}
}
