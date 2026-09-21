package notation_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func TestComputeSingleCache(t *testing.T) {
	env := createTestCombo(t)

	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	text, err := env.notationSvc.ComputeSingleCache(env.ctx, env.combo.ID, presetID)
	if err != nil {
		t.Fatalf("ComputeSingleCache: %v", err)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}
}

func TestDeletePresetCache(t *testing.T) {
	db := dbtest.Setup(t)
	cRepo := comborepo.New(db)
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)

	ctx := context.Background()

	comboID := insertMinimalCombo(t, db, cRepo, nSvc)

	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	key := strconv.FormatInt(presetID, 10)

	cacheJSON, _ := cRepo.GetRecipeCache(ctx, comboID)
	if cacheJSON == nil {
		t.Fatal("recipe_cache is nil before DeletePresetCache")
	}
	cache := map[string]string{}
	json.Unmarshal([]byte(*cacheJSON), &cache)
	if _, ok := cache[key]; !ok {
		t.Fatalf("key %q not in cache before delete", key)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := nSvc.DeletePresetCache(ctx, tx, presetID); err != nil {
		tx.Rollback()
		t.Fatalf("DeletePresetCache: %v", err)
	}
	tx.Commit()

	cacheJSON, _ = cRepo.GetRecipeCache(ctx, comboID)
	if cacheJSON == nil {
		t.Fatal("recipe_cache is nil after DeletePresetCache")
	}
	cache = map[string]string{}
	json.Unmarshal([]byte(*cacheJSON), &cache)
	if _, ok := cache[key]; ok {
		t.Fatalf("key %q still in cache after DeletePresetCache", key)
	}
}

func insertMinimalCombo(t *testing.T, db *sql.DB, cRepo comborepo.Repository, nSvc notation.Service) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}

	combo := &model.Combo{
		CharacterID:    1,
		IsDraft:        false,
		StarterMoveID:  ptrInt64(move1),
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
		Version:        1,
		StepCount:      1,
	}

	id, err := cRepo.InsertCombo(ctx, tx, combo)
	if err != nil {
		tx.Rollback()
		t.Fatalf("InsertCombo: %v", err)
	}

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1)},
	}
	if err := cRepo.InsertSteps(ctx, tx, id, steps); err != nil {
		tx.Rollback()
		t.Fatalf("InsertSteps: %v", err)
	}

	if err := nSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		tx.Rollback()
		t.Fatalf("RecomputeComboCache: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return id
}
