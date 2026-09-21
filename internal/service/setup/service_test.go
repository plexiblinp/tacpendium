package setup_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// ===========================================================================
// ヘルパ
// ===========================================================================

type testEnv struct {
	db  *sql.DB
	svc setupsvc.Service
	// repo は VAL-S04 の競合テストが「先行トランザクションの内側で行を書く」ために使う
	// (M24-13 §4.6。サービスを通すと自分でトランザクションを開いてしまう)。
	repo    setuprepo.Repository
	comboID int64
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	db := dbtest.Setup(t)
	cRepo := comborepo.New(db)
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)

	setupValidDeps := setupsvc.ValidationDeps{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		// ★★M24-13 §4.6: 本番配線(cmd/tacpendium/main.go)と同じくアダプタを挟む。
		//   sRepo を直に渡すと txScopedValidDeps が tx を束ねられず、VAL-S04 の判定が
		//   *sql.DB 直読みへ落ちる ⇒ 競合を塞いだことをテストが観測できなくなる。
		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
	}
	svc := setupsvc.New(db, sRepo, setupValidDeps, nSvc, cRepo, func() int64 { return 1 })

	comboID := createTestCombo(t, db, cRepo, nSvc)

	return &testEnv{db: db, svc: svc, repo: sRepo, comboID: comboID}
}

func createTestCombo(t *testing.T, db *sql.DB, cRepo comborepo.Repository, nSvc notation.Service) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	combo := &model.Combo{
		CharacterID: 1,
		IsDraft:     false,
		StepCount:   1,
		Version:     1,
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	id, err := cRepo.InsertCombo(ctx, tx, combo)
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert combo: %v", err)
	}
	err = cRepo.InsertSteps(ctx, tx, id, []model.ComboStep{
		{StepOrder: 1, MoveID: &move1},
	})
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert combo steps: %v", err)
	}
	if err := nSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		_ = tx.Rollback()
		t.Fatalf("recompute combo cache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return id
}

func lookupMoveID(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

func validSetupInput(t *testing.T, db *sql.DB) setupsvc.CreateSetupInput {
	t.Helper()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	name := "テストセットプレイ"
	return setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        &name,
		Steps: []model.SetupStep{
			{MoveID: &move1},
			{MoveID: &move2},
		},
	}
}

// ===========================================================================
// CreateSetup — 正常系
// ===========================================================================

func TestService_CreateSetup_OK(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, result, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	if resp.Setup.ID == 0 {
		t.Error("expected non-zero setup ID")
	}
	if resp.Setup.CharacterID != 1 {
		t.Errorf("CharacterID = %d, want 1", resp.Setup.CharacterID)
	}
	if resp.Setup.StepCount != 2 {
		t.Errorf("StepCount = %d, want 2", resp.Setup.StepCount)
	}
	if resp.DefaultRecipe == "" {
		t.Error("expected non-empty defaultRecipe (recipe_cache)")
	}
	if len(resp.ParentComboIDs) != 1 || resp.ParentComboIDs[0] != env.comboID {
		t.Errorf("ParentComboIDs = %v, want [%d]", resp.ParentComboIDs, env.comboID)
	}
}

// ===========================================================================
// CreateSetup — VAL-S01
// ===========================================================================

func TestService_CreateSetup_VAL_S01_InvalidCharacter(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)
	input.CharacterID = 99999

	_, result, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	if !result.HasError() {
		t.Fatal("expected validation error for invalid character")
	}
	hasS01 := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S01" {
			hasS01 = true
		}
	}
	if !hasS01 {
		t.Error("expected VAL-S01 issue")
	}
}

// ===========================================================================
// CreateSetup — VAL-S02
// ===========================================================================

func TestService_CreateSetup_VAL_S02_EmptySteps(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := setupsvc.CreateSetupInput{
		CharacterID: 1,
		Steps:       []model.SetupStep{},
	}

	_, result, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	if !result.HasError() {
		t.Fatal("expected validation error for empty steps")
	}
}

// ===========================================================================
// CreateSetup — VAL-S04
// ===========================================================================

func TestService_CreateSetup_VAL_S04_Duplicate(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	_, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("first CreateSetup: %v", err)
	}

	_, result, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("second CreateSetup: %v", err)
	}
	if !result.HasError() {
		t.Fatal("expected VAL-S04 error for duplicate recipe")
	}
}

// ===========================================================================
// CreateSetup — VAL-S05
// ===========================================================================

func TestService_CreateSetup_VAL_S05_ParentZero(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	_, result, err := env.svc.CreateSetup(ctx, 0, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	if !result.HasError() {
		t.Fatal("expected validation error for parentComboID == 0")
	}
	hasS05 := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S05" {
			hasS05 = true
		}
	}
	if !hasS05 {
		t.Error("expected VAL-S05 issue")
	}
}

// ===========================================================================
// CreateSetupLink
// ===========================================================================

func TestService_CreateSetupLink_OK(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)
	comboID2 := createTestCombo(t, env.db, cRepo, nSvc)

	err = env.svc.CreateSetupLink(ctx, comboID2, resp.Setup.ID)
	if err != nil {
		t.Fatalf("CreateSetupLink: %v", err)
	}

	got, err := env.svc.GetSetup(ctx, resp.Setup.ID)
	if err != nil {
		t.Fatalf("GetSetup: %v", err)
	}
	if len(got.ParentComboIDs) != 2 {
		t.Errorf("ParentComboIDs count = %d, want 2", len(got.ParentComboIDs))
	}
}

// ===========================================================================
// DeleteSetupLink
// ===========================================================================

func TestService_DeleteSetupLink_SetupRemains(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)
	comboID2 := createTestCombo(t, env.db, cRepo, nSvc)

	err = env.svc.CreateSetupLink(ctx, comboID2, resp.Setup.ID)
	if err != nil {
		t.Fatalf("CreateSetupLink: %v", err)
	}

	err = env.svc.DeleteSetupLink(ctx, comboID2, resp.Setup.ID)
	if err != nil {
		t.Fatalf("DeleteSetupLink: %v", err)
	}

	got, err := env.svc.GetSetup(ctx, resp.Setup.ID)
	if err != nil {
		t.Fatalf("GetSetup after unlink: %v", err)
	}
	if len(got.ParentComboIDs) != 1 || got.ParentComboIDs[0] != env.comboID {
		t.Errorf("ParentComboIDs = %v, want [%d]", got.ParentComboIDs, env.comboID)
	}
}

// ===========================================================================
// GetSetup — 複数紐付き
// ===========================================================================

func TestService_GetSetup_MultipleParents(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)
	comboID2 := createTestCombo(t, env.db, cRepo, nSvc)
	comboID3 := createTestCombo(t, env.db, cRepo, nSvc)

	_ = env.svc.CreateSetupLink(ctx, comboID2, resp.Setup.ID)
	_ = env.svc.CreateSetupLink(ctx, comboID3, resp.Setup.ID)

	got, err := env.svc.GetSetup(ctx, resp.Setup.ID)
	if err != nil {
		t.Fatalf("GetSetup: %v", err)
	}
	if len(got.ParentComboIDs) != 3 {
		t.Errorf("ParentComboIDs count = %d, want 3", len(got.ParentComboIDs))
	}
}

// ===========================================================================
// UpdateSetup — メタデータのみ
// ===========================================================================

func TestService_UpdateSetup_MetadataOnly(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	origRecipe := resp.DefaultRecipe

	newName := "renamed"
	updateInput := setupsvc.UpdateSetupInput{
		Name:    &newName,
		Version: resp.Setup.Version,
	}

	updated, result, err := env.svc.UpdateSetup(ctx, resp.Setup.ID, updateInput)
	if err != nil {
		t.Fatalf("UpdateSetup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	if updated.Setup.Name == nil || *updated.Setup.Name != newName {
		t.Errorf("Name = %v, want %q", updated.Setup.Name, newName)
	}
	if updated.DefaultRecipe != origRecipe {
		t.Errorf("defaultRecipe changed from %q to %q (should be unchanged)", origRecipe, updated.DefaultRecipe)
	}
}

// ===========================================================================
// UpdateSetup — レシピ変更
// ===========================================================================

func TestService_UpdateSetup_RecipeChange(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}
	origRecipe := resp.DefaultRecipe

	move3 := lookupMoveID(t, env.db, 1, "standing_medium_punch")
	newSteps := []model.SetupStep{
		{MoveID: &move3},
	}
	updateInput := setupsvc.UpdateSetupInput{
		Steps:   &newSteps,
		Version: resp.Setup.Version,
	}

	updated, result, err := env.svc.UpdateSetup(ctx, resp.Setup.ID, updateInput)
	if err != nil {
		t.Fatalf("UpdateSetup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	if updated.DefaultRecipe == origRecipe {
		t.Error("expected defaultRecipe to change after recipe update")
	}
	if updated.Setup.StepCount != 1 {
		t.Errorf("StepCount = %d, want 1", updated.Setup.StepCount)
	}
}

// ===========================================================================
// UpdateSetup — バージョン不一致 → ErrConflict
// ===========================================================================

func TestService_UpdateSetup_VersionConflict(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	wrongVersion := resp.Setup.Version + 100
	name := "conflict"
	updateInput := setupsvc.UpdateSetupInput{
		Name:    &name,
		Version: wrongVersion,
	}

	_, _, err = env.svc.UpdateSetup(ctx, resp.Setup.ID, updateInput)
	if !errors.Is(err, setupsvc.ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

// ===========================================================================
// DeleteSetup — 論理削除 + cache 削除
//
// ★combo_setups の物理削除は M23-02(D-483)で撤回した(案 P1 の撤回)。
//   論理削除後も紐付けは残る。その確認は restore_test.go の
//   TestService_DeleteSetup_KeepsComboSetupsWhenShared が持つ。
// ===========================================================================

func TestService_DeleteSetup_SoftDelete(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	err = env.svc.DeleteSetup(ctx, resp.Setup.ID, nil)
	if err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	_, err = env.svc.GetSetup(ctx, resp.Setup.ID)
	if !errors.Is(err, setupsvc.ErrNotFound) {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

// ===========================================================================
// GetSetupCandidates
// ===========================================================================

func createComboWithKA(t *testing.T, db *sql.DB, cRepo comborepo.Repository, nSvc notation.Service, ka *int) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	combo := &model.Combo{
		CharacterID:        1,
		IsDraft:            false,
		StepCount:          1,
		Version:            1,
		KnockdownAdvantage: ka,
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	id, err := cRepo.InsertCombo(ctx, tx, combo)
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert combo: %v", err)
	}
	err = cRepo.InsertSteps(ctx, tx, id, []model.ComboStep{
		{StepOrder: 1, MoveID: &move1},
	})
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert combo steps: %v", err)
	}
	if err := nSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		_ = tx.Rollback()
		t.Fatalf("recompute combo cache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return id
}

func intPtr(v int) *int { return &v }

func TestService_GetSetupCandidates_SameCharKA(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)

	ka := intPtr(25)
	parentComboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)
	otherComboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)

	input := validSetupInput(t, env.db)
	_, _, err := env.svc.CreateSetup(ctx, otherComboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	candidates, err := env.svc.GetSetupCandidates(ctx, parentComboID)
	if err != nil {
		t.Fatalf("GetSetupCandidates: %v", err)
	}
	if len(candidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(candidates))
	}
}

func TestService_GetSetupCandidates_ExcludesOwnSetups(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)

	ka := intPtr(30)
	parentComboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)

	input := validSetupInput(t, env.db)
	_, _, err := env.svc.CreateSetup(ctx, parentComboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	candidates, err := env.svc.GetSetupCandidates(ctx, parentComboID)
	if err != nil {
		t.Fatalf("GetSetupCandidates: %v", err)
	}
	if len(candidates) != 0 {
		t.Fatalf("expected 0 candidates (own setup excluded), got %d", len(candidates))
	}
}

func TestService_GetSetupCandidates_NullKA_Empty(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)

	comboID := createComboWithKA(t, env.db, cRepo, nSvc, nil)

	candidates, err := env.svc.GetSetupCandidates(ctx, comboID)
	if err != nil {
		t.Fatalf("GetSetupCandidates: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates for NULL KA, got %d", len(candidates))
	}
}

func TestService_GetSetupCandidates_ComboNotFound(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	_, err := env.svc.GetSetupCandidates(ctx, 999999)
	if !errors.Is(err, setupsvc.ErrComboNotFound) {
		t.Fatalf("expected ErrComboNotFound, got %v", err)
	}
}

func TestService_GetSetupCandidates_EmptyArray(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)

	ka := intPtr(99)
	comboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)

	candidates, err := env.svc.GetSetupCandidates(ctx, comboID)
	if err != nil {
		t.Fatalf("GetSetupCandidates: %v", err)
	}
	if candidates == nil {
		t.Fatal("expected non-nil empty slice")
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates, got %d", len(candidates))
	}
}

func TestService_GetSetupCandidates_ExcludesDeleted(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	cRepo := comborepo.New(env.db)
	pRepo := presetrepo.New(env.db)
	sRepo := setuprepo.New(env.db)
	nSvc := notation.New(env.db, pRepo, cRepo, sRepo)

	ka := intPtr(40)
	parentComboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)
	otherComboID := createComboWithKA(t, env.db, cRepo, nSvc, ka)

	input := validSetupInput(t, env.db)
	resp, _, err := env.svc.CreateSetup(ctx, otherComboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	err = env.svc.DeleteSetup(ctx, resp.Setup.ID, nil)
	if err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	candidates, err := env.svc.GetSetupCandidates(ctx, parentComboID)
	if err != nil {
		t.Fatalf("GetSetupCandidates: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates (deleted setup excluded), got %d", len(candidates))
	}
}

// ===========================================================================
// ListSetups — characterID フィルタ
// ===========================================================================

func TestService_ListSetups_ByCharacterID(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	charID := int64(1)
	list, err := env.svc.ListSetups(ctx, &charID)
	if err != nil {
		t.Fatalf("ListSetups: %v", err)
	}
	found := false
	for _, r := range list {
		if r.Setup.ID == resp.Setup.ID {
			found = true
		}
	}
	if !found {
		t.Errorf("created setup (id=%d) not found in ListSetups result", resp.Setup.ID)
	}
}

// ===========================================================================
// ListSetupsByComboID
// ===========================================================================

func TestService_ListSetupsByComboID(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	resp, _, err := env.svc.CreateSetup(ctx, env.comboID, input)
	if err != nil {
		t.Fatalf("CreateSetup: %v", err)
	}

	list, err := env.svc.ListSetupsByComboID(ctx, env.comboID)
	if err != nil {
		t.Fatalf("ListSetupsByComboID: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("list len = %d, want 1", len(list))
	}
	if list[0].Setup.ID != resp.Setup.ID {
		t.Errorf("Setup.ID = %d, want %d", list[0].Setup.ID, resp.Setup.ID)
	}
	if list[0].DefaultRecipe == "" {
		t.Error("expected non-empty DefaultRecipe")
	}
}
