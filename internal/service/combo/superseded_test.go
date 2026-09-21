package combo_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M23-01: PUT(キー変更編集)が積む旧行の判別と、ゴミ箱の既定からの除外。
//
// ★本ファイルの最重要ゲートは TestSuperseded_ManualDelete_StaysVisible である
// (レビューチェックリスト §9)。「隠れている」ことだけを確認して合格にすると、
// 述語が広すぎて手動削除まで隠れる欠陥を見逃す——それは FR601 の目的そのものを壊す。

// supersededBy は combos.superseded_by_combo_id を直接読む(サービス層は本列を返さない
// 経路もあるため、DB の実値を見る)。
func supersededBy(t *testing.T, db *sql.DB, comboID int64) *int64 {
	t.Helper()
	var v sql.NullInt64
	if err := db.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, comboID).Scan(&v); err != nil {
		t.Fatalf("select superseded_by_combo_id (id=%d): %v", comboID, err)
	}
	if !v.Valid {
		return nil
	}
	return &v.Int64
}

// trashIDs はゴミ箱一覧(OnlyDeleted)が返す id の並びを取る。
// 画面・一括操作の対象集合はこの結果と同一である(一括操作は別クエリを通らない)。
func trashIDs(t *testing.T, svc combosvc.Service) []int64 {
	t.Helper()
	rows, err := svc.List(context.Background(), comborepo.ListFilter{OnlyDeleted: true})
	if err != nil {
		t.Fatalf("List(OnlyDeleted): %v", err)
	}
	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
	}
	return ids
}

func containsID(ids []int64, want int64) bool {
	for _, id := range ids {
		if id == want {
			return true
		}
	}
	return false
}

// §5-2: PUT の後、旧行の superseded_by_combo_id が新行の id に等しい。
func TestSuperseded_PutWritesSuccessorID(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), saved.ID, saved.Version, newInput)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	got := supersededBy(t, db, saved.ID)
	if got == nil {
		t.Fatalf("旧行 %d の superseded_by_combo_id が NULL のまま(後継 id が書かれていない)", saved.ID)
	}
	if *got != newCombo.ID {
		t.Errorf("superseded_by_combo_id = %d, want %d(新行 id)", *got, newCombo.ID)
	}
	// 新行そのものは印を持たない。
	if v := supersededBy(t, db, newCombo.ID); v != nil {
		t.Errorf("新行 %d に印が付いている: %d", newCombo.ID, *v)
	}
	// §4.2-3: version を動かしていない(旧行は 1 のまま)。
	var oldVersion int
	if err := db.QueryRow(`SELECT version FROM combos WHERE id = ?`, saved.ID).Scan(&oldVersion); err != nil {
		t.Fatalf("select version: %v", err)
	}
	if oldVersion != saved.Version {
		t.Errorf("旧行の version が動いた: %d → %d", saved.Version, oldVersion)
	}
}

// §5-2 後半: 新行の作成に続く処理が失敗したとき、旧行へ書かれていない(同一 tx の巻き戻り)。
func TestSuperseded_NotWrittenOnRollback(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.TagIDs = []int64{999999} // 存在しないタグ → tx 後半で失敗させる

	if _, _, err := svc.UpdateWithKeyChange(context.Background(), saved.ID, saved.Version, newInput); !errors.Is(err, combosvc.ErrInvalidTagID) {
		t.Fatalf("expected ErrInvalidTagID to trigger rollback, got %v", err)
	}

	if v := supersededBy(t, db, saved.ID); v != nil {
		t.Errorf("ロールバック後も旧行へ後継 id が書かれている: %d", *v)
	}
	// 旧行は有効なまま(論理削除も巻き戻っている)。
	if _, getErr := svc.Get(context.Background(), saved.ID, 1); getErr != nil {
		t.Errorf("ロールバック後の旧行は有効であるべき: %v", getErr)
	}
}

// ★§5-3(最重要ゲート): 手動削除では印が付かない = 手動で消した行は隠れない。
func TestSuperseded_ManualDelete_StaysVisible(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if err := svc.Delete(context.Background(), saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	if v := supersededBy(t, db, saved.ID); v != nil {
		t.Fatalf("手動削除で superseded_by_combo_id が書かれた(%d)。ゴミ箱から消えてしまう", *v)
	}
	if ids := trashIDs(t, svc); !containsID(ids, saved.ID) {
		t.Fatalf("手動で消した行 %d がゴミ箱に出ていない: %v", saved.ID, ids)
	}
}

// §5-1 の対: PUT で積まれた旧行はゴミ箱に出ず、手動削除の行は出る(対で確認する)。
func TestSuperseded_TrashHidesOldRowButKeepsManualDelete(t *testing.T) {
	db, svc := newSvc(t)

	// (a) 編集で積まれる旧行
	edited, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create edited: %v", err)
	}
	putInput := validRyuInput(t, db)
	putInput.Position = ptr("corner_self")
	successor, _, err := svc.UpdateWithKeyChange(context.Background(), edited.ID, edited.Version, putInput)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	// (b) 手動で消す行(キーを変えて重複判定を避ける)
	manualInput := validRyuInput(t, db)
	manualInput.OpponentStance = ptr("crouching")
	manual, _, err := svc.Create(context.Background(), manualInput)
	if err != nil {
		t.Fatalf("create manual: %v", err)
	}
	if err := svc.Delete(context.Background(), manual.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	ids := trashIDs(t, svc)
	if containsID(ids, edited.ID) {
		t.Errorf("編集で積まれた旧行 %d がゴミ箱に出ている: %v", edited.ID, ids)
	}
	if !containsID(ids, manual.ID) {
		t.Errorf("手動で消した行 %d がゴミ箱に出ていない: %v", manual.ID, ids)
	}
	if containsID(ids, successor.ID) {
		t.Errorf("現役の新行 %d がゴミ箱に出ている: %v", successor.ID, ids)
	}
}

// §5-4: 一括復元の対象が絞り込み後の集合に揃う(画面に出ていない行が戻らない)。
func TestSuperseded_BulkRestoreMatchesVisibleSet(t *testing.T) {
	db, svc := newSvc(t)

	edited, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create edited: %v", err)
	}
	putInput := validRyuInput(t, db)
	putInput.Position = ptr("corner_self")
	if _, _, err := svc.UpdateWithKeyChange(context.Background(), edited.ID, edited.Version, putInput); err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	manualInput := validRyuInput(t, db)
	manualInput.OpponentStance = ptr("crouching")
	manual, _, err := svc.Create(context.Background(), manualInput)
	if err != nil {
		t.Fatalf("create manual: %v", err)
	}
	if err := svc.Delete(context.Background(), manual.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// 画面の「全選択 → 選択を復元」と同じ集合に対して復元する。
	visible := trashIDs(t, svc)
	for _, id := range visible {
		if _, err := svc.Restore(context.Background(), id); err != nil {
			t.Fatalf("Restore(%d): %v", id, err)
		}
	}

	// 手動削除の行は戻る。
	if _, err := svc.Get(context.Background(), manual.ID, 1); err != nil {
		t.Errorf("一括復元で手動削除の行 %d が戻っていない: %v", manual.ID, err)
	}
	// 画面に出ていなかった旧行は戻らない(削除済みのまま)。
	if _, err := svc.Get(context.Background(), edited.ID, 1); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("画面に出ていない旧行 %d が一括復元で戻った", edited.ID)
	}
}

// §5-4: 一括完全削除の対象も絞り込み後の集合に揃う(画面に出ていない行が消えない)。
func TestSuperseded_BulkPermanentDeleteMatchesVisibleSet(t *testing.T) {
	db, svc := newSvc(t)

	edited, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create edited: %v", err)
	}
	putInput := validRyuInput(t, db)
	putInput.Position = ptr("corner_self")
	if _, _, err := svc.UpdateWithKeyChange(context.Background(), edited.ID, edited.Version, putInput); err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	manualInput := validRyuInput(t, db)
	manualInput.OpponentStance = ptr("crouching")
	manual, _, err := svc.Create(context.Background(), manualInput)
	if err != nil {
		t.Fatalf("create manual: %v", err)
	}
	if err := svc.Delete(context.Background(), manual.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	visible := trashIDs(t, svc)
	for _, id := range visible {
		if err := svc.PermanentDelete(context.Background(), id); err != nil {
			t.Fatalf("PermanentDelete(%d): %v", id, err)
		}
	}

	if got := countRowsByID(t, db, manual.ID); got != 0 {
		t.Errorf("一括完全削除で手動削除の行 %d が消えていない", manual.ID)
	}
	if got := countRowsByID(t, db, edited.ID); got != 1 {
		t.Errorf("画面に出ていない旧行 %d が一括完全削除で消えた", edited.ID)
	}
}

func countRowsByID(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count combos by id: %v", err)
	}
	return n
}
