package setup_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// M23-03 §4.5: #6 を表示用と検証用へ分けたことを、サービス層の応答と検証で対にして確かめる。
//
// ★§5-6(表示用は返さない)と §5-8(検証は緩んでいない)は必ず両方在ること。
// どちらか一方だけでは「関数を分けた意味」を主張できていない。

func m2303SoftDeleteCombo(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, comboID); err != nil {
		t.Fatalf("soft delete combo %d: %v", comboID, err)
	}
}

func m2303RestoreCombo(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	if _, err := db.Exec(`UPDATE combos SET deleted_at = NULL WHERE id = ?`, comboID); err != nil {
		t.Fatalf("restore combo %d: %v", comboID, err)
	}
}

// m2303SecondCombo は env とは別のコンボをもう 1 件作る。
func m2303SecondCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	cRepo := comborepo.New(db)
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)
	return createTestCombo(t, db, cRepo, nSvc)
}

// 指示書 §5-6: 表示用の経路(応答の ParentComboIDs)が削除済みコンボを返さないこと。
// 復元したら戻ることまで対で確認する。
func TestM2303_GetSetup_ParentComboIDsExcludesTrashedCombo(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	secondCombo := m2303SecondCombo(t, env.db)
	resp, result, err := env.svc.CreateSetup(ctx, env.comboID, validSetupInput(t, env.db))
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	setupID := resp.Setup.ID
	if err := env.svc.CreateSetupLink(ctx, secondCombo, setupID); err != nil {
		t.Fatalf("CreateSetupLink: %v", err)
	}

	got, err := env.svc.GetSetup(ctx, setupID)
	if err != nil {
		t.Fatalf("GetSetup(削除前): %v", err)
	}
	if len(got.ParentComboIDs) != 2 {
		t.Fatalf("ParentComboIDs(削除前) = %v, want 2 件", got.ParentComboIDs)
	}

	m2303SoftDeleteCombo(t, env.db, env.comboID)

	got, err = env.svc.GetSetup(ctx, setupID)
	if err != nil {
		t.Fatalf("GetSetup(削除後): %v", err)
	}
	if len(got.ParentComboIDs) != 1 || got.ParentComboIDs[0] != secondCombo {
		t.Fatalf("ParentComboIDs(削除後) = %v, want [%d] — ゴミ箱のコンボ id が応答に残っている",
			got.ParentComboIDs, secondCombo)
	}

	// 一覧側(複数版)も同じ扱いであること。
	list, err := env.svc.ListSetupsByComboID(ctx, secondCombo)
	if err != nil {
		t.Fatalf("ListSetupsByComboID: %v", err)
	}
	found := false
	for _, s := range list {
		if s.Setup.ID != setupID {
			continue
		}
		found = true
		if len(s.ParentComboIDs) != 1 || s.ParentComboIDs[0] != secondCombo {
			t.Fatalf("一覧の ParentComboIDs = %v, want [%d]", s.ParentComboIDs, secondCombo)
		}
	}
	if !found {
		t.Fatalf("setup %d が一覧に出ていない", setupID)
	}

	m2303RestoreCombo(t, env.db, env.comboID)
	got, err = env.svc.GetSetup(ctx, setupID)
	if err != nil {
		t.Fatalf("GetSetup(復元後): %v", err)
	}
	if len(got.ParentComboIDs) != 2 {
		t.Fatalf("ParentComboIDs(復元後) = %v, want 2 件 — 復元しても戻っていない", got.ParentComboIDs)
	}
}

// 指示書 §5-7 / §5-8: 検証用の母集団は削除済みコンボを保ち続ける。
//
// ★★これが #6 を分けた理由そのものである。緩めると
// 「ゴミ箱へ入れる → 同じレシピを作る → 復元する」で同一レシピが 2 本並ぶ。
func TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	move1 := lookupMoveID(t, env.db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, env.db, 1, "hadoken_light")
	move3 := lookupMoveID(t, env.db, 1, "crouching_light_kick")

	nameA, nameB := "既存A", "編集対象B"
	stepsA := []model.SetupStep{{MoveID: &move1}, {MoveID: &move2}}
	stepsB := []model.SetupStep{{MoveID: &move3}, {MoveID: &move2}}

	_, resA, err := env.svc.CreateSetup(ctx, env.comboID, setupsvc.CreateSetupInput{
		CharacterID: 1, Name: &nameA, Steps: stepsA,
	})
	if err != nil || resA.HasError() {
		t.Fatalf("CreateSetup(A): err=%v issues=%+v", err, resA.Issues)
	}
	respB, resB, err := env.svc.CreateSetup(ctx, env.comboID, setupsvc.CreateSetupInput{
		CharacterID: 1, Name: &nameB, Steps: stepsB,
	})
	if err != nil || resB.HasError() {
		t.Fatalf("CreateSetup(B): err=%v issues=%+v", err, resB.Issues)
	}

	// ★親コンボをゴミ箱へ入れる。検証の母集団はここでも変わってはならない。
	m2303SoftDeleteCombo(t, env.db, env.comboID)

	// B を A と同一レシピへ変更 → 母集団が保たれていれば VAL-S04 で弾かれる。
	dupSteps := stepsA
	_, result, err := env.svc.UpdateSetup(ctx, respB.Setup.ID, setupsvc.UpdateSetupInput{
		Steps:   &dupSteps,
		Version: respB.Setup.Version,
	})
	if err != nil {
		t.Fatalf("UpdateSetup: %v", err)
	}
	if !result.HasError() {
		t.Fatalf("ゴミ箱のコンボ内の重複が弾かれていない — 検証の母集団が緩んでいる(M23-03 §4.5-4)")
	}
	hasS04 := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S04" {
			hasS04 = true
		}
	}
	if !hasS04 {
		t.Fatalf("VAL-S04 が出ていない: %+v", result.Issues)
	}
}

// 対照: 検証が「常に拒否する」状態になっていないこと(重複でなければ通る)。
func TestM2303_UpdateSetup_AllowsNonDuplicateInsideTrashedCombo(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	move1 := lookupMoveID(t, env.db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, env.db, 1, "hadoken_light")
	move3 := lookupMoveID(t, env.db, 1, "crouching_light_kick")

	name := "編集対象"
	resp, res, err := env.svc.CreateSetup(ctx, env.comboID, setupsvc.CreateSetupInput{
		CharacterID: 1, Name: &name, Steps: []model.SetupStep{{MoveID: &move1}, {MoveID: &move2}},
	})
	if err != nil || res.HasError() {
		t.Fatalf("CreateSetup: err=%v issues=%+v", err, res.Issues)
	}

	m2303SoftDeleteCombo(t, env.db, env.comboID)

	newSteps := []model.SetupStep{{MoveID: &move3}, {MoveID: &move2}}
	_, result, err := env.svc.UpdateSetup(ctx, resp.Setup.ID, setupsvc.UpdateSetupInput{
		Steps:   &newSteps,
		Version: resp.Setup.Version,
	})
	if err != nil {
		t.Fatalf("UpdateSetup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("重複でない編集が拒否された: %+v", result.Issues)
	}
}
