package notation_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
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

type testEnv struct {
	ctx         context.Context
	db          *sql.DB
	combo       *model.Combo
	comboSvc    combosvc.Service
	comboRepo   comborepo.Repository
	notationSvc notation.Service
}

func createTestCombo(t *testing.T) *testEnv {
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

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	input := combosvc.CreateInput{
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
	}

	ctx := context.Background()
	combo, _, err := cSvc.Create(ctx, input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	return &testEnv{
		ctx:         ctx,
		db:          db,
		combo:       combo,
		comboSvc:    cSvc,
		comboRepo:   cRepo,
		notationSvc: nSvc,
	}
}

func TestRecomputeComboCache_PopulatesAllPresets(t *testing.T) {
	env := createTestCombo(t)

	cacheJSON, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("recipe_cache is nil after Create")
	}

	cache := map[string]string{}
	if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// recipe_cache はプリセット 1 件につきキー 1 つを持つ(cache.go の RecomputeComboCache が
	// ListAllPresets を回す)。M20-01(000069)でプリセットが 5 → 3 になった。
	if len(cache) != 3 {
		t.Fatalf("expected 3 preset entries, got %d: %v", len(cache), cache)
	}

	for _, entry := range cache {
		if entry == "" {
			t.Error("empty recipe text in cache")
		}
	}
}

func TestRecomputeComboCache_OfficialJaContent(t *testing.T) {
	env := createTestCombo(t)

	cacheJSON, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}

	cache := map[string]string{}
	json.Unmarshal([]byte(*cacheJSON), &cache)

	officialID := lookupPresetIDByCode(t, env.db, "official_ja_move")
	key := strconv.FormatInt(officialID, 10)

	text, ok := cache[key]
	if !ok {
		t.Fatalf("key %q not found in cache: %v", key, cache)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("official_ja_move text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}
}

func TestDeleteComboCache_NullifiesCache(t *testing.T) {
	env := createTestCombo(t)

	err := env.comboSvc.Delete(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// ★M23-03 §4.2 以降、観測は列を直接読む。
	// GetRecipeCache は論理削除済みコンボを除外するようになったため、
	// 「キャッシュが NULL 化されたか」の観測手段としては使えない
	// (返るのは nil ではなく ErrNotFound になる)。本テストが主張したいのは
	// DeleteComboCache が列を NULL にすることであり、そこは変わっていない。
	var cache sql.NullString
	if err := env.db.QueryRow(
		`SELECT recipe_cache FROM combos WHERE id = ?`, env.combo.ID,
	).Scan(&cache); err != nil {
		t.Fatalf("select recipe_cache: %v", err)
	}
	if cache.Valid {
		t.Fatalf("expected NULL recipe_cache after Delete, got %q", cache.String)
	}

	// 対で M23-03 の変更も固定する: 論理削除済みコンボは GetRecipeCache から見えない。
	if _, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID); !errors.Is(err, comborepo.ErrNotFound) {
		t.Fatalf("GetRecipeCache(削除済み) err = %v, want ErrNotFound (M23-03 §4.2)", err)
	}
}

func TestRestoreCombo_RecomputesCache(t *testing.T) {
	env := createTestCombo(t)

	if err := env.comboSvc.Delete(env.ctx, env.combo.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	if _, err := env.comboSvc.Restore(env.ctx, env.combo.ID); err != nil {
		t.Fatalf("Restore: %v", err)
	}

	cacheJSON, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("recipe_cache is nil after Restore")
	}

	cache := map[string]string{}
	if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// プリセット数と対。M20-01(000069)で 5 → 3。
	if len(cache) != 3 {
		t.Fatalf("expected 3 preset entries after Restore, got %d", len(cache))
	}
}

func TestResolveComboRecipe_CacheHit(t *testing.T) {
	env := createTestCombo(t)

	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	text, err := env.notationSvc.ResolveComboRecipe(env.ctx, env.combo.ID, presetID)
	if err != nil {
		t.Fatalf("ResolveComboRecipe: %v", err)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}
}

func TestResolveComboRecipe_CacheMiss(t *testing.T) {
	env := createTestCombo(t)

	presetID := lookupPresetIDByCode(t, env.db, "official_ja_move")

	// recipe_cache を NULL に戻す
	tx, err := env.db.BeginTx(env.ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	if err := env.comboRepo.SetRecipeCacheNullTx(env.ctx, tx, env.combo.ID); err != nil {
		tx.Rollback()
		t.Fatalf("SetRecipeCacheNullTx: %v", err)
	}
	tx.Commit()

	cacheJSON, _ := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if cacheJSON != nil {
		t.Fatal("recipe_cache should be nil before ResolveComboRecipe")
	}

	// ResolveComboRecipe でキャッシュ未生成時の計算+挿入を確認
	text, err := env.notationSvc.ResolveComboRecipe(env.ctx, env.combo.ID, presetID)
	if err != nil {
		t.Fatalf("ResolveComboRecipe: %v", err)
	}
	if text != "立ち弱P > 弱波動拳" {
		t.Errorf("text = %q, want %q", text, "立ち弱P > 弱波動拳")
	}

	// recipe_cache が書き込まれていることを確認
	cacheJSON, err = env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON == nil {
		t.Fatal("recipe_cache should be populated after ResolveComboRecipe")
	}
	cache := map[string]string{}
	json.Unmarshal([]byte(*cacheJSON), &cache)
	key := strconv.FormatInt(presetID, 10)
	if v, ok := cache[key]; !ok || v != "立ち弱P > 弱波動拳" {
		t.Errorf("cache[%q] = %q, want %q", key, v, "立ち弱P > 弱波動拳")
	}
}

func TestResolveComboRecipe_PresetNotFound(t *testing.T) {
	env := createTestCombo(t)

	const missingPresetID = int64(99999)
	_, err := env.notationSvc.ResolveComboRecipe(env.ctx, env.combo.ID, missingPresetID)
	if err == nil {
		t.Fatal("expected error for missing preset, got nil")
	}
	if !errors.Is(err, notation.ErrPresetNotFound) {
		t.Errorf("expected ErrPresetNotFound, got %v", err)
	}

	// 存在しないプリセットのエントリが recipe_cache に書き込まれていないこと
	cacheJSON, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cacheJSON != nil {
		cache := map[string]string{}
		json.Unmarshal([]byte(*cacheJSON), &cache)
		if _, ok := cache[strconv.FormatInt(missingPresetID, 10)]; ok {
			t.Error("recipe_cache should not contain an entry for a missing preset")
		}
	}
}

func TestRecomputePresetCache(t *testing.T) {
	env := createTestCombo(t)

	numericID := lookupPresetIDByCode(t, env.db, "numeric")

	if err := env.notationSvc.RecomputePresetCache(env.ctx, numericID); err != nil {
		t.Fatalf("RecomputePresetCache: %v", err)
	}

	cacheJSON, err := env.comboRepo.GetRecipeCache(env.ctx, env.combo.ID)
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

	key := strconv.FormatInt(numericID, 10)
	text, ok := cache[key]
	if !ok {
		t.Fatalf("key %q not found in cache after RecomputePresetCache: %v", key, cache)
	}
	if text == "" {
		t.Errorf("empty text for preset %d in cache", numericID)
	}
}
