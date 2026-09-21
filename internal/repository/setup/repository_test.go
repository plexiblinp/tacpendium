package setup_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func lookupMoveID(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

func withTx(t *testing.T, db *sql.DB, fn func(tx *sql.Tx)) {
	t.Helper()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()
	fn(tx)
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
}

func createCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	cRepo := comborepo.New(db)
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	combo := &model.Combo{
		CharacterID: 1,
		IsDraft:     false,
		StepCount:   1,
		Version:     1,
	}
	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		id, err := cRepo.InsertCombo(context.Background(), tx, combo)
		if err != nil {
			t.Fatalf("insert combo: %v", err)
		}
		comboID = id
		err = cRepo.InsertSteps(context.Background(), tx, id, []model.ComboStep{
			{StepOrder: 1, MoveID: &move1},
		})
		if err != nil {
			t.Fatalf("insert combo steps: %v", err)
		}
	})
	return comboID
}

func insertSetup(t *testing.T, db *sql.DB, repo setuprepo.Repository, comboID int64, moveCode1, moveCode2 string) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, moveCode1)
	move2 := lookupMoveID(t, db, 1, moveCode2)
	setup := &model.Setup{
		CharacterID: 1,
		StepCount:   2,
		Version:     1,
	}
	var setupID int64
	withTx(t, db, func(tx *sql.Tx) {
		id, err := repo.InsertSetup(ctx, tx, setup)
		if err != nil {
			t.Fatalf("insert setup: %v", err)
		}
		setupID = id
		err = repo.InsertSteps(ctx, tx, id, []model.SetupStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		})
		if err != nil {
			t.Fatalf("insert setup steps: %v", err)
		}
		err = repo.InsertComboSetup(ctx, tx, comboID, id)
		if err != nil {
			t.Fatalf("insert combo_setup: %v", err)
		}
	})
	return setupID
}

// ===========================================================================
// FindDuplicateInCombo — VAL-S04 の SQL 正確性
// ===========================================================================

func TestRepository_FindDuplicateInCombo_Found(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	existingID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	steps := []model.SetupStep{
		{StepOrder: 1, MoveID: &move1},
		{StepOrder: 2, MoveID: &move2},
	}
	hash := calcHash(steps)

	dupID, err := repo.FindDuplicateInCombo(ctx, comboID, 1, hash, nil)
	if err != nil {
		t.Fatalf("FindDuplicateInCombo: %v", err)
	}
	if dupID == nil {
		t.Fatal("expected duplicate to be found")
	}
	if *dupID != existingID {
		t.Errorf("dupID = %d, want %d", *dupID, existingID)
	}
}

func TestRepository_FindDuplicateInCombo_NotFound_DifferentRecipe(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	_ = insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	move1 := lookupMoveID(t, db, 1, "standing_medium_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	steps := []model.SetupStep{
		{StepOrder: 1, MoveID: &move1},
		{StepOrder: 2, MoveID: &move2},
	}
	hash := calcHash(steps)

	dupID, err := repo.FindDuplicateInCombo(ctx, comboID, 1, hash, nil)
	if err != nil {
		t.Fatalf("FindDuplicateInCombo: %v", err)
	}
	if dupID != nil {
		t.Errorf("expected no duplicate, got %d", *dupID)
	}
}

func TestRepository_FindDuplicateInCombo_ExcludesSelf(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	existingID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	steps := []model.SetupStep{
		{StepOrder: 1, MoveID: &move1},
		{StepOrder: 2, MoveID: &move2},
	}
	hash := calcHash(steps)

	dupID, err := repo.FindDuplicateInCombo(ctx, comboID, 1, hash, &existingID)
	if err != nil {
		t.Fatalf("FindDuplicateInCombo: %v", err)
	}
	if dupID != nil {
		t.Errorf("expected no duplicate when excluding self, got %d", *dupID)
	}
}

func TestRepository_FindDuplicateInCombo_IgnoresDeletedSetup(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, setupID); err != nil {
			t.Fatalf("soft delete: %v", err)
		}
	})

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	steps := []model.SetupStep{
		{StepOrder: 1, MoveID: &move1},
		{StepOrder: 2, MoveID: &move2},
	}
	hash := calcHash(steps)

	dupID, err := repo.FindDuplicateInCombo(ctx, comboID, 1, hash, nil)
	if err != nil {
		t.Fatalf("FindDuplicateInCombo: %v", err)
	}
	if dupID != nil {
		t.Errorf("expected no duplicate for soft-deleted setup, got %d", *dupID)
	}
}

// ===========================================================================
// FindByID + steps 取得
// ===========================================================================

func TestRepository_FindByID_WithSteps(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	name := "test setup"
	desc := "some desc"
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	var setupID int64
	withTx(t, db, func(tx *sql.Tx) {
		s := &model.Setup{
			CharacterID: 1,
			Name:        &name,
			Description: &desc,
			StepCount:   2,
			Version:     1,
		}
		id, err := repo.InsertSetup(ctx, tx, s)
		if err != nil {
			t.Fatalf("insert setup: %v", err)
		}
		setupID = id
		err = repo.InsertSteps(ctx, tx, id, []model.SetupStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		})
		if err != nil {
			t.Fatalf("insert steps: %v", err)
		}
		err = repo.InsertComboSetup(ctx, tx, comboID, id)
		if err != nil {
			t.Fatalf("insert combo_setup: %v", err)
		}
	})

	got, err := repo.FindByID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got.ID != setupID {
		t.Errorf("ID = %d, want %d", got.ID, setupID)
	}
	if got.Name == nil || *got.Name != name {
		t.Errorf("Name = %v, want %q", got.Name, name)
	}
	if got.Description == nil || *got.Description != desc {
		t.Errorf("Description = %v, want %q", got.Description, desc)
	}
	if got.StepCount != 2 {
		t.Errorf("StepCount = %d, want 2", got.StepCount)
	}

	steps, err := repo.FindStepsBySetupID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindStepsBySetupID: %v", err)
	}
	if len(steps) != 2 {
		t.Fatalf("steps count = %d, want 2", len(steps))
	}
	if steps[0].StepOrder != 1 || steps[1].StepOrder != 2 {
		t.Errorf("step order = %d,%d, want 1,2", steps[0].StepOrder, steps[1].StepOrder)
	}

	comboIDs, err := repo.FindLiveComboIDsBySetupID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindLiveComboIDsBySetupID: %v", err)
	}
	if len(comboIDs) != 1 || comboIDs[0] != comboID {
		t.Errorf("comboIDs = %v, want [%d]", comboIDs, comboID)
	}
}

// ===========================================================================
// ListByCharacterID
// ===========================================================================

func TestRepository_ListByCharacterID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	charID := int64(1)
	list, err := repo.ListByCharacterID(ctx, &charID)
	if err != nil {
		t.Fatalf("ListByCharacterID: %v", err)
	}
	found := false
	for _, s := range list {
		if s.ID == setupID {
			found = true
		}
	}
	if !found {
		t.Errorf("created setup (id=%d) not found in ListByCharacterID result", setupID)
	}
}

// ===========================================================================
// ListSetupsByComboID
// ===========================================================================

func TestRepository_ListSetupsByComboID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	list, err := repo.ListSetupsByComboID(ctx, comboID)
	if err != nil {
		t.Fatalf("ListSetupsByComboID: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("list len = %d, want 1", len(list))
	}
	if list[0].ID != setupID {
		t.Errorf("ID = %d, want %d", list[0].ID, setupID)
	}
}

// ===========================================================================
// FindCandidateSetups
// ===========================================================================

func createComboWithKA(t *testing.T, db *sql.DB, ka *int) int64 {
	t.Helper()
	cRepo := comborepo.New(db)
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	combo := &model.Combo{
		CharacterID:        1,
		IsDraft:            false,
		StepCount:          1,
		Version:            1,
		KnockdownAdvantage: ka,
	}
	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		id, err := cRepo.InsertCombo(context.Background(), tx, combo)
		if err != nil {
			t.Fatalf("insert combo: %v", err)
		}
		comboID = id
		err = cRepo.InsertSteps(context.Background(), tx, id, []model.ComboStep{
			{StepOrder: 1, MoveID: &move1},
		})
		if err != nil {
			t.Fatalf("insert combo steps: %v", err)
		}
	})
	return comboID
}

func intPtr(v int) *int { return &v }

func TestRepository_FindCandidateSetups_SameCharKA(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	ka := intPtr(25)
	otherComboID := createComboWithKA(t, db, ka)
	parentComboID := createComboWithKA(t, db, ka)

	setupID := insertSetup(t, db, repo, otherComboID, "standing_light_punch", "hadoken_light")

	candidates, err := repo.FindCandidateSetups(ctx, 1, ka, parentComboID)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(candidates))
	}
	if candidates[0].ID != setupID {
		t.Errorf("candidate ID = %d, want %d", candidates[0].ID, setupID)
	}
}

func TestRepository_FindCandidateSetups_NullKA_Empty(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	candidates, err := repo.FindCandidateSetups(ctx, 1, nil, 1)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates for nil KA, got %d", len(candidates))
	}
}

func TestRepository_FindCandidateSetups_ExcludesParent(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	ka := intPtr(30)
	comboID := createComboWithKA(t, db, ka)
	insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	candidates, err := repo.FindCandidateSetups(ctx, 1, ka, comboID)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates (parent excluded), got %d", len(candidates))
	}
}

func TestRepository_FindCandidateSetups_ExcludesDeletedSetup(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	ka := intPtr(35)
	otherComboID := createComboWithKA(t, db, ka)
	parentComboID := createComboWithKA(t, db, ka)

	setupID := insertSetup(t, db, repo, otherComboID, "standing_light_punch", "hadoken_light")
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, setupID); err != nil {
			t.Fatalf("soft delete: %v", err)
		}
	})

	candidates, err := repo.FindCandidateSetups(ctx, 1, ka, parentComboID)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates (deleted setup), got %d", len(candidates))
	}
}

func TestRepository_FindCandidateSetups_ExcludesDeletedCombo(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	cRepo := comborepo.New(db)
	ctx := context.Background()

	ka := intPtr(40)
	otherComboID := createComboWithKA(t, db, ka)
	parentComboID := createComboWithKA(t, db, ka)

	insertSetup(t, db, repo, otherComboID, "standing_light_punch", "hadoken_light")

	withTx(t, db, func(tx *sql.Tx) {
		if err := cRepo.SoftDelete(ctx, tx, otherComboID); err != nil {
			t.Fatalf("soft delete combo: %v", err)
		}
	})

	candidates, err := repo.FindCandidateSetups(ctx, 1, ka, parentComboID)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates (deleted combo), got %d", len(candidates))
	}
}

func TestRepository_FindCandidateSetups_ExcludesAlreadyLinked(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	ka := intPtr(30)
	otherComboID := createComboWithKA(t, db, ka)
	parentComboID := createComboWithKA(t, db, ka)

	setupID := insertSetup(t, db, repo, otherComboID, "standing_light_punch", "hadoken_light")

	// setup を parentCombo にも紐付ける（＝既に紐付け済み）
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.InsertComboSetup(ctx, tx, parentComboID, setupID); err != nil {
			t.Fatalf("insert combo_setup for parent: %v", err)
		}
	})

	candidates, err := repo.FindCandidateSetups(ctx, 1, ka, parentComboID)
	if err != nil {
		t.Fatalf("FindCandidateSetups: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates (already linked to parent), got %d", len(candidates))
	}
}

// ===========================================================================
// ヘルパ: recipeHash 計算
// ===========================================================================

func calcHash(steps []model.SetupStep) string {
	return setupsvc.CalcSetupRecipeHash(steps)
}
