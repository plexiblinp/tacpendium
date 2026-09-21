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
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

type setupTestEnv struct {
	ctx         context.Context
	db          *sql.DB
	setupRepo   setuprepo.Repository
	notationSvc notation.Service
	comboID     int64
	setupID     int64
}

func createTestSetup(t *testing.T) *setupTestEnv {
	t.Helper()
	db := dbtest.Setup(t)
	cRepo := comborepo.New(db)
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)
	deps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: cRepo},
	}
	cSvc := combosvc.New(db, cRepo, deps, nSvc, nil, func() int64 { return 1 })

	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	combo, _, err := cSvc.Create(ctx, combosvc.CreateInput{
		CharacterID:    1,
		IsDraft:        false,
		StarterMoveID:  &move1,
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		// ★M38-01 で必須欄が 2 欄になり、Create が咎めるのは
		//   damage / knockdownAdvantage だけになった。⇒ 消費ゲージは余分である。欠けると検証エラーを返し、
		//   戻り値の combo が nil になる(本 fixture は result を捨てているため nil 参照で落ちる)。
		Damage:             intPtr(1000),
		KnockdownAdvantage: intPtr(30),
		DriveGaugeConsumed: floatPtr(1.0),
		SAGaugeConsumed:    intPtr(0),
		Steps: []model.ComboStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		},
	})
	if err != nil {
		t.Fatalf("create combo: %v", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	setup := &model.Setup{CharacterID: 1, StepCount: 2, Version: 1}
	setupID, err := sRepo.InsertSetup(ctx, tx, setup)
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert setup: %v", err)
	}
	err = sRepo.InsertSteps(ctx, tx, setupID, []model.SetupStep{
		{StepOrder: 1, MoveID: &move1},
		{StepOrder: 2, MoveID: &move2},
	})
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert setup steps: %v", err)
	}
	err = sRepo.InsertComboSetup(ctx, tx, combo.ID, setupID)
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("insert combo_setup: %v", err)
	}
	err = nSvc.RecomputeSetupCache(ctx, tx, setupID)
	if err != nil {
		_ = tx.Rollback()
		t.Fatalf("recompute setup cache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	return &setupTestEnv{
		ctx:         ctx,
		db:          db,
		setupRepo:   sRepo,
		notationSvc: nSvc,
		comboID:     combo.ID,
		setupID:     setupID,
	}
}

// ===========================================================================
// ResolveSetupRecipe — cache ヒット
// ===========================================================================

func TestResolveSetupRecipe_CacheHit(t *testing.T) {
	env := createTestSetup(t)
	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	text, err := env.notationSvc.ResolveSetupRecipe(env.ctx, env.setupID, presetID)
	if err != nil {
		t.Fatalf("ResolveSetupRecipe: %v", err)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}
}

// ===========================================================================
// ResolveSetupRecipe — cache ミス → 計算 → カラム更新
// ===========================================================================

func TestResolveSetupRecipe_CacheMiss(t *testing.T) {
	env := createTestSetup(t)
	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	tx, err := env.db.BeginTx(env.ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := env.setupRepo.SetRecipeCacheNullTx(env.ctx, tx, env.setupID); err != nil {
		_ = tx.Rollback()
		t.Fatalf("set cache null: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	cacheJSON, _ := env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if cacheJSON != nil {
		t.Fatal("expected nil cache before resolve")
	}

	text, err := env.notationSvc.ResolveSetupRecipe(env.ctx, env.setupID, presetID)
	if err != nil {
		t.Fatalf("ResolveSetupRecipe: %v", err)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}

	cacheJSON, err = env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("expected cache to be populated after resolve")
	}
}

// ===========================================================================
// RecomputeSetupCache — 全プリセット分の JSON マップ生成
// ===========================================================================

func TestRecomputeSetupCache_PopulatesAllPresets(t *testing.T) {
	env := createTestSetup(t)

	cacheJSON, err := env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("recipe_cache is nil")
	}

	cache := map[string]string{}
	if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// setup 側の recipe_cache もプリセット 1 件 = キー 1 つ(setup_resolver.go の
	// RecomputeSetupCache が ListAllPresets を回す)。M20-01(000069)で 5 → 3。
	if len(cache) != 3 {
		t.Fatalf("expected 3 preset entries, got %d: %v", len(cache), cache)
	}
	for k, v := range cache {
		if v == "" {
			t.Errorf("empty recipe text for preset %s", k)
		}
	}
}

// ===========================================================================
// DeleteSetupCache — recipe_cache を NULL に
// ===========================================================================

func TestDeleteSetupCache_NullifiesCache(t *testing.T) {
	env := createTestSetup(t)

	tx, err := env.db.BeginTx(env.ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := env.notationSvc.DeleteSetupCache(env.ctx, tx, env.setupID); err != nil {
		_ = tx.Rollback()
		t.Fatalf("DeleteSetupCache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	cacheJSON, err := env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON != nil {
		t.Fatalf("expected nil recipe_cache, got %q", *cacheJSON)
	}
}

// ===========================================================================
// RecomputePresetCache 拡張 — コンボ + セットプレイ両方を再計算
// ===========================================================================

func TestRecomputePresetCache_IncludesSetups(t *testing.T) {
	env := createTestSetup(t)
	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	tx, err := env.db.BeginTx(env.ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := env.setupRepo.SetRecipeCacheNullTx(env.ctx, tx, env.setupID); err != nil {
		_ = tx.Rollback()
		t.Fatalf("set cache null: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	if err := env.notationSvc.RecomputePresetCache(env.ctx, presetID); err != nil {
		t.Fatalf("RecomputePresetCache: %v", err)
	}

	cacheJSON, err := env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("expected setup cache to be populated after RecomputePresetCache")
	}

	cache := map[string]string{}
	if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	key := strconv.FormatInt(presetID, 10)
	if _, ok := cache[key]; !ok {
		t.Errorf("preset key %q not found in setup cache", key)
	}
}

// ===========================================================================
// DeletePresetCache 拡張 — セットプレイ側からもプリセットキーを削除
// ===========================================================================

func TestDeletePresetCache_RemovesFromSetups(t *testing.T) {
	env := createTestSetup(t)
	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	tx, err := env.db.BeginTx(env.ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := env.notationSvc.DeletePresetCache(env.ctx, tx, presetID); err != nil {
		_ = tx.Rollback()
		t.Fatalf("DeletePresetCache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	cacheJSON, err := env.setupRepo.GetRecipeCache(env.ctx, env.setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("cache should not be nil, just missing the deleted key")
	}

	cache := map[string]string{}
	if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	key := strconv.FormatInt(presetID, 10)
	if _, ok := cache[key]; ok {
		t.Errorf("preset key %q should have been removed from setup cache", key)
	}
}
