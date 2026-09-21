package setup_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// ===========================================================================
// スタブ実装
// ===========================================================================

type stubCharacterReader struct {
	existsByID map[int64]bool
}

func (s *stubCharacterReader) ExistsByID(_ context.Context, id int64) (bool, error) {
	return s.existsByID[id], nil
}

type stubMoveReader struct {
	existsForCharacter map[[2]int64]bool
}

func (s *stubMoveReader) ExistsForCharacter(_ context.Context, characterID, moveID int64) (bool, error) {
	return s.existsForCharacter[[2]int64{characterID, moveID}], nil
}

type stubDuplicateChecker struct {
	duplicateID *int64
}

func (s *stubDuplicateChecker) FindDuplicateInCombo(_ context.Context, _, _ int64, _ string, _ *int64) (*int64, error) {
	return s.duplicateID, nil
}

func ptr[T any](v T) *T { return &v }

func defaultDeps() setupsvc.ValidationDeps {
	return setupsvc.ValidationDeps{
		CharacterRepo: &stubCharacterReader{existsByID: map[int64]bool{1: true}},
		MoveRepo: &stubMoveReader{existsForCharacter: map[[2]int64]bool{
			{1, 10}: true,
			{1, 11}: true,
		}},
		SetupRepo: &stubDuplicateChecker{},
	}
}

func validInput() setupsvc.CreateSetupInput {
	return setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        ptr("テストセットプレイ"), // VAL-S06: 名前必須(C-03)
		Steps: []model.SetupStep{
			{StepOrder: 1, MoveID: ptr(int64(10))},
			{StepOrder: 2, MoveID: ptr(int64(11))},
		},
	}
}

// ===========================================================================
// VAL-S05: 親コンボ ID 必須
// ===========================================================================

func TestValidateSetupCreate_S05_ParentRequired(t *testing.T) {
	input := validInput()
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 0, input, hash, defaultDeps())

	if !result.HasError() {
		t.Fatal("expected error for parentComboID == 0")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S05" {
			found = true
			if issue.Severity != "error" {
				t.Errorf("VAL-S05 severity = %q, want error", issue.Severity)
			}
		}
	}
	if !found {
		t.Error("VAL-S05 issue not found")
	}
}

// ===========================================================================
// VAL-S01: キャラ存在確認
// ===========================================================================

func TestValidateSetupCreate_S01_CharacterNotExists(t *testing.T) {
	deps := defaultDeps()
	deps.CharacterRepo = &stubCharacterReader{existsByID: map[int64]bool{}}

	input := validInput()
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, deps)

	if !result.HasError() {
		t.Fatal("expected error for non-existent character")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S01" {
			found = true
		}
	}
	if !found {
		t.Error("VAL-S01 issue not found")
	}
}

func TestValidateSetupCreate_S01_CharacterIDZero(t *testing.T) {
	input := validInput()
	input.CharacterID = 0
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, defaultDeps())

	if !result.HasError() {
		t.Fatal("expected error for characterID == 0")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S01" {
			found = true
		}
	}
	if !found {
		t.Error("VAL-S01 issue not found")
	}
}

// ===========================================================================
// VAL-S02: レシピ空チェック
// ===========================================================================

func TestValidateSetupCreate_S02_EmptySteps(t *testing.T) {
	input := validInput()
	input.Steps = []model.SetupStep{}
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, defaultDeps())

	if !result.HasError() {
		t.Fatal("expected error for empty steps")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S02" {
			found = true
		}
	}
	if !found {
		t.Error("VAL-S02 issue not found")
	}
}

// ===========================================================================
// VAL-S03: 技存在確認（WARNING であること）
// ===========================================================================

func TestValidateSetupCreate_S03_MoveNotExists_Warning(t *testing.T) {
	input := validInput()
	input.Steps = []model.SetupStep{
		{StepOrder: 1, MoveID: ptr(int64(999))},
	}
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, defaultDeps())

	if result.HasError() {
		t.Fatal("VAL-S03 should be WARNING, not ERROR")
	}
	if !result.HasWarning() {
		t.Fatal("expected warning for non-existent move")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S03" {
			found = true
			if issue.Severity != "warning" {
				t.Errorf("VAL-S03 severity = %q, want warning", issue.Severity)
			}
		}
	}
	if !found {
		t.Error("VAL-S03 issue not found")
	}
}

// ===========================================================================
// VAL-S04: 同一コンボ内重複
// ===========================================================================

func TestValidateSetupCreate_S04_Duplicate(t *testing.T) {
	deps := defaultDeps()
	dupID := int64(42)
	deps.SetupRepo = &stubDuplicateChecker{duplicateID: &dupID}

	input := validInput()
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, deps)

	if !result.HasError() {
		t.Fatal("expected error for duplicate recipe")
	}
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S04" {
			found = true
		}
	}
	if !found {
		t.Error("VAL-S04 issue not found")
	}
}

// ===========================================================================
// 正常系: 全バリデーション通過
// ===========================================================================

func TestValidateSetupCreate_AllPass(t *testing.T) {
	input := validInput()
	hash := setupsvc.CalcSetupRecipeHash(input.Steps)
	result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, defaultDeps())

	if result.HasError() {
		t.Errorf("unexpected error: %+v", result.Issues)
	}
}

// VAL-S06: セットプレイ名必須(C-03)
func TestValidateSetupCreate_S06_NameRequired(t *testing.T) {
	cases := []struct {
		name    string
		setName *string
	}{
		{"nil_name", nil},
		{"empty_name", ptr("")},
		{"whitespace_name", ptr("   ")},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			input := validInput()
			input.Name = tc.setName
			hash := setupsvc.CalcSetupRecipeHash(input.Steps)
			result := setupsvc.ValidateSetupCreate(context.Background(), 1, input, hash, defaultDeps())

			found := false
			for _, issue := range result.Issues {
				if issue.Code == "VAL-S06" && issue.Severity == "error" {
					found = true
				}
			}
			if !found {
				t.Errorf("expected VAL-S06 error, got: %+v", result.Issues)
			}
		})
	}
}

// VAL-S06: 更新で名前を空文字へクリアしようとするとエラー
func TestValidateSetupUpdate_S06_EmptyNameRejected(t *testing.T) {
	input := setupsvc.UpdateSetupInput{
		Name:    ptr("  "),
		Version: 1,
	}
	result := setupsvc.ValidateSetupUpdate(context.Background(), 1, []int64{1}, input, 1, "", defaultDeps())
	found := false
	for _, issue := range result.Issues {
		if issue.Code == "VAL-S06" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-S06 error on empty name update, got: %+v", result.Issues)
	}
}

// ===========================================================================
// ValidateSetupUpdate
// ===========================================================================

func TestValidateSetupUpdate_StepsNil_NoValidation(t *testing.T) {
	input := setupsvc.UpdateSetupInput{
		Name:    ptr("new name"),
		Version: 1,
	}
	result := setupsvc.ValidateSetupUpdate(context.Background(), 1, []int64{1}, input, 1, "", defaultDeps())

	if result.HasError() || result.HasWarning() {
		t.Error("no validation should run when Steps is nil")
	}
}

func TestValidateSetupUpdate_S02_EmptySteps(t *testing.T) {
	emptySteps := []model.SetupStep{}
	input := setupsvc.UpdateSetupInput{
		Steps:   &emptySteps,
		Version: 1,
	}
	hash := setupsvc.CalcSetupRecipeHash(emptySteps)
	result := setupsvc.ValidateSetupUpdate(context.Background(), 1, []int64{1}, input, 1, hash, defaultDeps())

	if !result.HasError() {
		t.Fatal("expected error for empty steps in update")
	}
}
