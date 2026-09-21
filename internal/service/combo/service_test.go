package combo_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// ===========================================================================
// テスト用ヘルパ
// ===========================================================================

func newSvc(t *testing.T) (*sql.DB, combosvc.Service) {
	t.Helper()
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	deps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	notationSvc := notation.New(db, pRepo, repo, sRepo)
	svc := combosvc.New(db, repo, deps, notationSvc, nil, func() int64 { return 1 })
	return db, svc
}

func newSvcWithSetups(t *testing.T) (*sql.DB, combosvc.Service) {
	t.Helper()
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	deps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	notationSvc := notation.New(db, pRepo, repo, sRepo)
	setupValidDeps := setupsvc.ValidationDeps{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		// ★★M24-13 §4.6: 本番配線(cmd/tacpendium/main.go)と同じくアダプタを挟む。
		//   sRepo を直に渡すと txScopedValidDeps が tx を束ねられず、VAL-S04 の判定が
		//   *sql.DB 直読みへ落ちる ⇒ 競合を塞いだことをテストが観測できなくなる。
		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
	}
	setupSvc := setupsvc.New(db, sRepo, setupValidDeps, notationSvc, repo, func() int64 { return 1 })
	svc := combosvc.New(db, repo, deps, notationSvc, setupSvc, func() int64 { return 1 })
	return db, svc
}

func countSetups(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM setups`).Scan(&n); err != nil {
		t.Fatalf("count setups: %v", err)
	}
	return n
}

func countCombos(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	// M7-04-2: 耐久テスト用 seed(aki/jamie/guile)を除外し、テストが作成したコンボのみ数える。
	// M12-05(000017): ajg は除去済みのため NOT IN サブクエリは空集合 = 実質全 combos を数える
	// (新規 DB に seed combos は無い)。除外句は冗長だが将来 ajg 同型 seed が再登場した場合の
	// 防御として残す。意味は「テストが作成したコンボ件数」で不変。
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos
		WHERE character_id NOT IN (SELECT id FROM characters WHERE code IN ('aki','jamie','guile'))`).Scan(&n); err != nil {
		t.Fatalf("count combos: %v", err)
	}
	return n
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

func validRyuInput(t *testing.T, db *sql.DB) combosvc.CreateInput {
	t.Helper()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	return combosvc.CreateInput{
		// ★M22-02: タグの紐づけを入れ替える利用者。テストのタグは user_id = 1。
		UserID:         1,
		CharacterID:    1,
		IsDraft:        false,
		StarterMoveID:  &move1,
		Position:       ptr("mid_screen"),
		OpponentStance: ptr("standing"),
		HitType:        ptr("normal"),
		OpponentSize:   ptr("standard"),
		// ★★M27-02b(VAL-C15) / ★★M38-01: **本登録の fixture には必ず要る**
		//   ——欠けると Create が検証エラーで nil を返し、以降が nil 参照で落ちる。
		//   ★仮登録(IsDraft: true)の fixture には要らない(VAL-C15 はスキップされる)。
		// ★★M38-01 追補2 の時点で必須は 2 欄である。⇒ Create が咎めるのは
		//   damage / knockdownAdvantage だけである。★消費ゲージ 2 欄は必須から外れた
		//   (余分に埋めているだけで害は無い。**そのまま写さないこと**)。
		Damage:             ptr(1000),
		KnockdownAdvantage: ptr(30),
		DriveGaugeConsumed: ptr(1.0),
		SAGaugeConsumed:    ptr(0),
		Steps: []model.ComboStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		},
	}
}

func ptr[T any](v T) *T { return &v }

// ===========================================================================
// Create — 正常系
// ===========================================================================

func TestService_Create_Published_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Error("expected ID to be set")
	}
	if got.Version != 1 {
		t.Errorf("expected Version 1, got %d", got.Version)
	}
	if len(got.Steps) != 2 {
		t.Errorf("expected 2 steps, got %d", len(got.Steps))
	}
}

// C-11: drive_damage を REAL/*float64 化した後の round-trip(負値・小数・整数互換)。
func TestService_Create_DriveDamage_FloatRoundTrip(t *testing.T) {
	cases := []struct {
		name string
		val  float64
	}{
		{"negative_decimal", -2.5},
		{"positive_decimal", 3.5},
		{"integer_value", 2},
		{"max", 6},
		{"min", -6},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, svc := newSvc(t)
			input := validRyuInput(t, db)
			dd := tc.val
			input.DriveDamage = &dd

			got, result, err := svc.Create(context.Background(), input)
			if err != nil {
				t.Fatalf("Create: %v", err)
			}
			if result.HasError() {
				t.Fatalf("unexpected validation errors: %+v", result.Issues)
			}
			if got.DriveDamage == nil || *got.DriveDamage != tc.val {
				t.Fatalf("Create returned DriveDamage=%v, want %g", got.DriveDamage, tc.val)
			}

			// 再取得して REAL 永続化が小数・負値を保持していることを確認。
			fetched, err := svc.Get(context.Background(), got.ID, 1)
			if err != nil {
				t.Fatalf("Get: %v", err)
			}
			if fetched.DriveDamage == nil || *fetched.DriveDamage != tc.val {
				t.Errorf("round-trip DriveDamage=%v, want %g", fetched.DriveDamage, tc.val)
			}
		})
	}
}

// ComboEditor のキャラ選択 UI を作らない(閲覧のみ)方針のため、custom_states を持つ
// 非リュウキャラの作成パスを service レベルで担保する。
// (a) エラーなしで作成でき ID が振られること、(b) recipe_cache が全プリセット分計算されること。
//
// M12-05(000017): aki/jamie/guile を除去したため、custom_states を持つ非リュウキャラとして
// ingrid(000015 で sun_crest を投入・先行リリース5体)を用いる。ingrid の moves は M14-03b(000026)で
// seed 済みになったため、seed 済みの技を用いて作成パスを検証する。
func TestService_Create_NonRyu_CustomStatesCharacter_OK(t *testing.T) {
	db, svc := newSvc(t)

	var ingridID int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE code = 'ingrid'`).Scan(&ingridID); err != nil {
		t.Fatalf("lookup ingrid character id: %v", err)
	}
	// 前提: ingrid は custom_states(sun_crest)を持つ非リュウキャラであること。
	var customStates sql.NullString
	if err := db.QueryRow(`SELECT custom_states FROM characters WHERE id = ?`, ingridID).Scan(&customStates); err != nil {
		t.Fatalf("lookup ingrid custom_states: %v", err)
	}
	if !customStates.Valid || customStates.String == "" {
		t.Fatalf("precondition: ingrid should have custom_states (sun_crest)")
	}
	// M14-03b(000026): ingrid の moves は seed 済みになったため、手動 INSERT は不要
	// (以前は seed に無く手動投入していたが、UNIQUE(character_id, code) 衝突を避けるため seed 済みを利用)。
	move1 := lookupMoveID(t, db, ingridID, "standing_medium_punch")
	move2 := lookupMoveID(t, db, ingridID, "standing_heavy_punch")
	input := combosvc.CreateInput{
		CharacterID:    ingridID,
		IsDraft:        false,
		StarterMoveID:  &move1,
		Position:       ptr("mid_screen"),
		OpponentStance: ptr("standing"),
		HitType:        ptr("normal"),
		OpponentSize:   ptr("standard"),
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		//   ★M38-01 追補2 の時点で必須は damage / knockdownAdvantage の 2 欄である。
		Damage:             ptr(1000),
		KnockdownAdvantage: ptr(30),
		DriveGaugeConsumed: ptr(1.0),
		SAGaugeConsumed:    ptr(0),
		Steps: []model.ComboStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		},
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Fatal("expected ID to be set")
	}

	// recipe_cache が全プリセット分計算されていること(SUPP-001 §7)。
	var cacheJSON sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, got.ID).Scan(&cacheJSON); err != nil {
		t.Fatalf("query recipe_cache: %v", err)
	}
	if !cacheJSON.Valid || cacheJSON.String == "" {
		t.Fatal("expected recipe_cache to be populated for non-Ryu combo")
	}
	var cache map[string]string
	if err := json.Unmarshal([]byte(cacheJSON.String), &cache); err != nil {
		t.Fatalf("recipe_cache is not valid JSON: %v", err)
	}
	var presetCount int
	if err := db.QueryRow(`SELECT count(*) FROM presets`).Scan(&presetCount); err != nil {
		t.Fatalf("count presets: %v", err)
	}
	if len(cache) != presetCount {
		t.Errorf("recipe_cache has %d preset entries, want %d (all presets)", len(cache), presetCount)
	}
}

// ★★M24-13 / CHANGE-139: 仮登録の空レシピは ERROR になった。
// 以前は SUPP-001 §2.1 を根拠に許容していた(TestService_Create_Draft_AllowsEmptyRecipe)。
func TestService_Create_Draft_RejectsEmptyRecipe(t *testing.T) {
	_, svc := newSvc(t)
	input := combosvc.CreateInput{
		CharacterID: 1,
		IsDraft:     true,
		// Steps: nil(空レシピ)
	}
	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !result.HasError() {
		t.Fatalf("draft with empty recipe must be rejected: %+v", result.Issues)
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC09RecipeNotEmpty {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-C09 in errors, got: %+v", result.Errors())
	}
	if got != nil {
		t.Error("no combo should be persisted when validation fails")
	}
}

// ★★M24-13: 技が未指定のステップ 1 本の仮登録は保存できる(「うろ覚え」を守っている)。
// ★サービス層まで通して見る——検証単体が通っても、書き込み経路が落とせば同じことである。
func TestService_Create_Draft_SingleStepWithoutMoveID_OK(t *testing.T) {
	_, svc := newSvc(t)
	input := combosvc.CreateInput{
		CharacterID: 1,
		IsDraft:     true,
		Steps:       []model.ComboStep{{StepOrder: 1, MoveID: nil}},
	}
	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("1-step draft without move_id must be saveable: %+v", result.Errors())
	}
	if got == nil || !got.IsDraft {
		t.Fatal("expected a saved draft combo")
	}
	if got.StepCount != 1 {
		t.Errorf("step_count = %d, want 1", got.StepCount)
	}
}

// ★M24-13: 非技ステップ(modifiers.type のみ)1 本の仮登録も保存できる。
func TestService_Create_Draft_SingleNonMoveStep_OK(t *testing.T) {
	_, svc := newSvc(t)
	input := combosvc.CreateInput{
		CharacterID: 1,
		IsDraft:     true,
		Steps: []model.ComboStep{
			{StepOrder: 1, MoveID: nil, Modifiers: &model.Modifiers{Type: "parry_drive_rush"}},
		},
	}
	_, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("1-step non-move draft must be saveable: %+v", result.Errors())
	}
}

// ===========================================================================
// Create — VAL-C02 重複判定
// ===========================================================================

func TestService_Create_VAL_C02_PublishedDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)

	// 1 回目: 成功
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("first create failed: err=%v issues=%+v", err, r.Issues)
	}

	// 2 回目(同一キー、同一レシピ): VAL-C02 が ERROR で返る
	_, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("second create returned error (should be validation): %v", err)
	}
	if !result.HasError() {
		t.Error("expected VAL-C02 duplicate error")
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC02Duplicate {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-C02 in errors, got: %+v", result.Errors())
	}
}

func TestService_Create_VAL_C02_DraftAllowsDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	// Q3 確定: 仮登録時は VAL-C02 完全スキップ → published と同じキー+レシピでも通る
	pub := validRyuInput(t, db)
	if _, r, err := svc.Create(context.Background(), pub); err != nil || r.HasError() {
		t.Fatalf("published create failed: %v %+v", err, r.Issues)
	}

	draft := validRyuInput(t, db)
	draft.IsDraft = true
	_, result, err := svc.Create(context.Background(), draft)
	if err != nil {
		t.Fatalf("draft create error: %v", err)
	}
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC02Duplicate {
			t.Errorf("VAL-C02 should be skipped for drafts: %+v", i)
		}
	}
}

// TestService_Create_VAL_C02_MediaNotInDuplicateKey は M17-01 のメディア 3 列が
// 重複判定キー(VAL-C02)に関与しないことを検証する。メディアだけ異なる同一キー・
// 同一レシピのコンボは「重複と判定される」のが正(メディアはコンボの同一性を定義しない)。
func TestService_Create_VAL_C02_MediaNotInDuplicateKey(t *testing.T) {
	db, svc := newSvc(t)

	// 1 本目: メディアなし
	first := validRyuInput(t, db)
	if _, r, err := svc.Create(context.Background(), first); err != nil || r.HasError() {
		t.Fatalf("first create failed: err=%v issues=%+v", err, r.Issues)
	}

	// 2 本目: メディア 3 列だけ異なる(キー・レシピは同一) → VAL-C02 が ERROR で返る
	second := validRyuInput(t, db)
	second.Link = ptr("https://example.com/guide")
	second.VideoPath = ptr("videos/ryu-bnb.mp4")
	second.ImagePath = ptr("images/ryu-bnb.png")
	_, result, err := svc.Create(context.Background(), second)
	if err != nil {
		t.Fatalf("second create returned error (should be validation): %v", err)
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC02Duplicate {
			found = true
		}
	}
	if !found {
		t.Errorf("media-only difference must still be VAL-C02 duplicate, got: %+v", result.Errors())
	}
}

// ===========================================================================
// Create — VAL-C01(キャラ存在)
// ===========================================================================

func TestService_Create_VAL_C01_UnknownCharacter(t *testing.T) {
	_, svc := newSvc(t)
	input := combosvc.CreateInput{
		CharacterID: 99999,
		IsDraft:     false,
	}
	_, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC01CharacterExists {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-C01 error: %+v", result.Errors())
	}
}

// ===========================================================================
// Get / List
// ===========================================================================

func TestService_Get_NotFound(t *testing.T) {
	_, svc := newSvc(t)
	_, err := svc.Get(context.Background(), 99999, 1)
	if !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestService_List_FilterByCharacter(t *testing.T) {
	db, svc := newSvc(t)

	// 5 件作成
	for i := 0; i < 5; i++ {
		input := validRyuInput(t, db)
		// 重複回避のため毎回 Position を変える
		positions := []string{"mid_screen", "corner_self", "corner_self_near", "corner_opponent", "corner_opponent_near"}
		input.Position = ptr(positions[i])
		if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
			t.Fatalf("create %d: err=%v issues=%+v", i, err, r.Issues)
		}
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{CharacterID: ptr(int64(1))})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) < 5 {
		t.Errorf("expected at least 5 results, got %d", len(got))
	}
}

func TestService_List_FilterByPosition(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.Position = ptr("corner_self")
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create corner_self: err=%v issues=%+v", err, r.Issues)
	}
	input2 := validRyuInput(t, db)
	input2.Position = ptr("mid_screen")
	if _, r, err := svc.Create(context.Background(), input2); err != nil || r.HasError() {
		t.Fatalf("create mid_screen: err=%v issues=%+v", err, r.Issues)
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{Position: ptr("corner_self")})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range got {
		if c.Position == nil || *c.Position != "corner_self" {
			t.Errorf("expected position corner_self, got %v", c.Position)
		}
	}
}

func TestService_List_FilterByHitType(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.HitType = ptr("counter")
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, r.Issues)
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{HitType: ptr("counter")})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) == 0 {
		t.Error("expected at least 1 result")
	}
	for _, c := range got {
		if c.HitType == nil || *c.HitType != "counter" {
			t.Errorf("expected hit_type counter, got %v", c.HitType)
		}
	}
}

func TestService_List_FilterByIsDraft(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.IsDraft = true
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create draft: err=%v issues=%+v", err, r.Issues)
	}
	input2 := validRyuInput(t, db)
	input2.IsDraft = false
	input2.Position = ptr("corner_self")
	if _, r, err := svc.Create(context.Background(), input2); err != nil || r.HasError() {
		t.Fatalf("create official: err=%v issues=%+v", err, r.Issues)
	}

	drafts, err := svc.List(context.Background(), combosvc.ListFilter{IsDraft: ptr(true)})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range drafts {
		if !c.IsDraft {
			t.Error("expected is_draft=true")
		}
	}

	officials, err := svc.List(context.Background(), combosvc.ListFilter{IsDraft: ptr(false)})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range officials {
		if c.IsDraft {
			t.Error("expected is_draft=false")
		}
	}
}

func TestService_List_SortByDamage(t *testing.T) {
	db, svc := newSvc(t)

	positions := []string{"mid_screen", "corner_self", "corner_self_near"}
	damages := []int{300, 100, 200}
	for i, pos := range positions {
		input := validRyuInput(t, db)
		input.Position = ptr(pos)
		input.Damage = ptr(damages[i])
		if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
			t.Fatalf("create %d: err=%v issues=%+v", i, err, r.Issues)
		}
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{
		CharacterID: ptr(int64(1)),
		Sort:        "damage",
		Order:       "desc",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) < 3 {
		t.Fatalf("expected at least 3 results, got %d", len(got))
	}
	if got[0].Damage == nil || *got[0].Damage < *got[1].Damage {
		t.Errorf("damage not sorted desc: first=%v second=%v", got[0].Damage, got[1].Damage)
	}
}

func TestService_List_SortDefault(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, r.Issues)
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{Sort: "default"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) == 0 {
		t.Error("expected at least 1 result")
	}
}

func TestService_List_InvalidSortFallsBack(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, r.Issues)
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{Sort: "nonexistent_field"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) == 0 {
		t.Error("expected at least 1 result with fallback sort")
	}
}

// ===========================================================================
// UpdateMetadata + 楽観的排他
// ===========================================================================

func TestService_UpdateMetadata_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, _, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("updated note"),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if got.Memo == nil || *got.Memo != "updated note" {
		t.Errorf("memo not updated: %+v", got.Memo)
	}
	if got.Version != saved.Version+1 {
		t.Errorf("version not incremented: was %d, now %d", saved.Version, got.Version)
	}
}

// TestService_UpdateMetadata_MediaTristate_NoRecipeRecompute は M17-01 のメディア 3 列が
// PATCH で保存・クリアでき、かつ recipe_cache(recipe 非対象)が 3 列変更で不変であることを検証する。
func TestService_UpdateMetadata_MediaTristate_NoRecipeRecompute(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	var cacheBefore sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, saved.ID).Scan(&cacheBefore); err != nil {
		t.Fatalf("read recipe_cache before: %v", err)
	}

	// 値=更新
	got, _, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		Link:      comborepo.Some("https://example.com/guide"),
		VideoPath: comborepo.Some("videos/ryu-bnb.mp4"),
		ImagePath: comborepo.Some("images/ryu-bnb.png"),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata(media set): %v", err)
	}
	if got.Link == nil || *got.Link != "https://example.com/guide" {
		t.Errorf("link not updated: %+v", got.Link)
	}
	if got.VideoPath == nil || *got.VideoPath != "videos/ryu-bnb.mp4" {
		t.Errorf("videoPath not updated: %+v", got.VideoPath)
	}
	if got.ImagePath == nil || *got.ImagePath != "images/ryu-bnb.png" {
		t.Errorf("imagePath not updated: %+v", got.ImagePath)
	}

	// null=クリア
	got, _, err = svc.UpdateMetadata(context.Background(), saved.ID, got.Version, combosvc.UpdateMetadataInput{
		Link: comborepo.Null[string](),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata(media clear): %v", err)
	}
	if got.Link != nil {
		t.Errorf("link should be cleared, got %v", *got.Link)
	}

	// recipe_cache 不変(メディアは recipe 非対象=RecomputeComboCache 非発火)。
	var cacheAfter sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, saved.ID).Scan(&cacheAfter); err != nil {
		t.Fatalf("read recipe_cache after: %v", err)
	}
	if cacheBefore != cacheAfter {
		t.Errorf("recipe_cache must be unchanged by media PATCH:\n before=%v\n after=%v", cacheBefore, cacheAfter)
	}
}

func TestService_UpdateMetadata_VersionConflict(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	_, _, err = svc.UpdateMetadata(context.Background(), saved.ID, 999, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("x"),
	})
	if !errors.Is(err, combosvc.ErrConflict) {
		t.Errorf("expected ErrConflict, got %v", err)
	}
}

func TestService_UpdateMetadata_PromoteDraft_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.IsDraft = true
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if !saved.IsDraft {
		t.Fatal("expected draft combo")
	}

	isDraft := false
	promoted, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		IsDraft: &isDraft,
	})
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error on promote: %+v", result.Issues)
	}
	if promoted.IsDraft {
		t.Error("expected is_draft=false after promotion")
	}
}

// ★★M27-02b(VAL-C15): 必須欄が空の仮登録は本登録へ昇格できない。
//
// ★★M38-01 追補2 の時点で必須は 2 欄である。⇒ 昇格で咎められるのは
//
//	damage / knockdownAdvantage の 2 件である(下の期待値 2 がそれ)。
//
// ★昇格は PATCH の中で isDraft=false としてフルバリデーションを走らせる経路であり、
//
//	**完了報告が「昇格では効く」と主張している箇所**である。⇒ 固定しておく。
//	固定しないと、次に promoting 分岐を触った人が黙って壊せる。
func TestService_UpdateMetadata_PromoteDraft_BlockedByRequiredFields(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.IsDraft = true
	// ★**サーバが咎める必須欄**を空にする。仮登録なので作成そのものは通る。
	//   ★★M38-01: 消費ゲージ 2 欄は必須から外れたため、空にしても昇格は止まらない。
	//     ⇒ 空にするのは damage / knockdownAdvantage だけでよい。
	//     ★開始残量 2 欄も咎められない(「不問」を NULL で表すため空と区別できない)。
	input.Damage = nil
	input.KnockdownAdvantage = nil

	saved, createResult, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if createResult.HasError() {
		t.Fatalf("仮登録の作成が止まっている(VAL-C15 が仮登録へ掛かっている): %+v", createResult.Issues)
	}

	isDraft := false
	_, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		IsDraft: &isDraft,
	})
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	if !result.HasError() {
		t.Fatal("必須欄が空のまま昇格できてしまった")
	}
	var fields []string
	for _, is := range result.Issues {
		if is.Code == validation.CodeC15RequiredField {
			fields = append(fields, is.Field)
		}
	}
	// ★★★【M38-01・射程 3】期待を 4 → 2 件へ。**緩和ではない。**
	//   ⇒ VAL-C15 の 4 欄は入れ替わったが、開始残量 2 欄は「不問」を NULL で表すため
	//     サーバからは不問と未入力を区別できず、咎めようがない
	//     (internal/service/validation/combo.go の requiredPublishedFields の注記)。
	//     消費ゲージ 2 欄は必須から外れた。
	//   ★本テストの主題は「昇格が止まること」であり、それは上の HasError で見ている。
	if len(fields) != 2 {
		t.Errorf("C15 の件数 = %d (%v), want 2", len(fields), fields)
	}

	// ★昇格は止まっているので仮登録のままであること(部分適用されていない)。
	after, err := svc.Get(context.Background(), saved.ID, 1)
	if err != nil {
		t.Fatalf("get after blocked promote: %v", err)
	}
	if !after.IsDraft {
		t.Error("昇格が止まったのに is_draft=false になっている")
	}
}

// ★★M27-02b(VAL-C15): 本登録コンボの必須欄を PATCH で空にはできない。
//
// ★★編集画面の保存は識別キーが変わらない限り PATCH である。⇒ ここを塞がないと
//
//	必須化を守るのがフロントの zod だけになる(レビュー 高-1)。
func TestService_UpdateMetadata_CannotClearRequiredFieldOnPublished(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create published: %v", err)
	}

	// present + null = NULL クリア。
	_, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version,
		combosvc.UpdateMetadataInput{Damage: comborepo.Null[int]()})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if !result.HasError() {
		t.Fatal("本登録コンボのダメージを PATCH で空にできてしまった")
	}

	// ★触っていない欄は咎めない(マージ後の姿で見ていることの確認)。
	var fields []string
	for _, is := range result.Issues {
		if is.Code == validation.CodeC15RequiredField {
			fields = append(fields, is.Field)
		}
	}
	if len(fields) != 1 || fields[0] != "damage" {
		t.Errorf("C15 の field = %v, want [damage] のみ", fields)
	}
}

// ★★M27-02b(P4M-011): 起き攻めを調べたかのフラグが往復すること。
//
// ★★本フラグの存在理由は「チェックが 1 つも無い」の曖昧さを解くことである。
//
//	⇒ **行 0 件 かつ OkiVerified=true**（調べたが成立するものが無かった）が
//	保存でき、読み直せることを固定する。これが表現できないなら本サブは目的を果たさない。
func TestService_OkiVerified_RoundTripWithNoOptions(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.OkiVerified = true
	input.OkiOptions = nil // ★成立する起き攻めは 1 つも無い

	saved, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}

	got, err := svc.Get(context.Background(), saved.ID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !got.OkiVerified {
		t.Error("調べた(OkiVerified=true)が保存されていない")
	}
	if len(got.OkiOptions) != 0 {
		t.Errorf("起き攻めの行 = %d 件, want 0", len(got.OkiOptions))
	}
}

// ★既定は未検証である。★ここが true に転ぶと、調べていないコンボが
//
//	「調べたが無かった」と主張することになり、本サブの目的と逆になる。
func TestService_OkiVerified_DefaultsToFalse(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := svc.Get(context.Background(), saved.ID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.OkiVerified {
		t.Error("指定していないのに OkiVerified=true になっている")
	}
}

// ★PATCH で付け外しできること(編集画面から直せる＝開発者確定 2026-09-03)。
func TestService_OkiVerified_PatchTogglesBothWays(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	on := true
	updated, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version,
		combosvc.UpdateMetadataInput{OkiVerified: comborepo.Some(on)})
	if err != nil || result.HasError() {
		t.Fatalf("patch on: err=%v vr=%+v", err, result.Errors())
	}
	if !updated.OkiVerified {
		t.Error("PATCH で true にできていない")
	}

	off := false
	updated2, result, err := svc.UpdateMetadata(context.Background(), saved.ID, updated.Version,
		combosvc.UpdateMetadataInput{OkiVerified: comborepo.Some(off)})
	if err != nil || result.HasError() {
		t.Fatalf("patch off: err=%v vr=%+v", err, result.Errors())
	}
	if updated2.OkiVerified {
		t.Error("PATCH で false へ戻せていない")
	}
}

// ★★省略した PATCH がフラグを落とさないこと。
//
//	★Optional にしてある理由そのものである——値型だと、本欄を持たない要求本文が
//	ゼロ値 false を送り、**メモを直しただけで「未検証」へ戻る**。
func TestService_OkiVerified_OmittedPatchKeepsValue(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.OkiVerified = true
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	updated, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version,
		combosvc.UpdateMetadataInput{Memo: comborepo.Some("メモだけ直す")})
	if err != nil || result.HasError() {
		t.Fatalf("patch: err=%v vr=%+v", err, result.Errors())
	}
	if !updated.OkiVerified {
		t.Error("okiVerified を省略した PATCH でフラグが落ちた")
	}
}

// ★対照: 必須欄に触らない PATCH は従来どおり通る。
//
// ★★ここが落ちると「タグやメモだけ直す」ができなくなる。⇒ 必須化の副作用が
//
//	編集画面の保存を超えて広がっていないことの歯止めである。
func TestService_UpdateMetadata_UnrelatedPatchStillPasses(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create published: %v", err)
	}

	_, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version,
		combosvc.UpdateMetadataInput{Memo: comborepo.Some("メモだけ直す")})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if result.HasError() {
		t.Fatalf("必須欄に触らない PATCH が止まっている: %+v", result.Issues)
	}
}

// ★★M24-13 / CHANGE-139 のリスク 1 を固定する。
//
// 本サブより前に作られた「ステップ 0 本の仮登録」は **行としては残る**。
// 変わるのは「編集の保存が通らなくなること」だけである。それをここで観測する。
// ★行そのものは消していない(既存データを書き換えていないことの確認でもある)。
// ★昇格経路は元から isDraft=false で検証しており、本サブで変化していない
//
//	——それでも観測が 1 本も無かったため、ここで埋める。
func TestService_LegacyZeroStepDraft_RowSurvives_ButSaveIsBlocked(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// M24-13 より前の状態を作る(サービス経由ではもう作れないため直接書く)。
	res, err := db.ExecContext(ctx,
		`INSERT INTO combos (character_id, is_draft, step_count, version) VALUES (1, 1, 0, 1)`)
	if err != nil {
		t.Fatalf("seed legacy draft: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}

	// (1) 行は残っている。
	var n int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM combos WHERE id = ?`, id).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Fatalf("legacy row must survive, count = %d", n)
	}

	// (2) 本登録への昇格は VAL-C09 で止まる。
	isDraft := false
	_, result, err := svc.UpdateMetadata(ctx, id, 1, combosvc.UpdateMetadataInput{IsDraft: &isDraft})
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == validation.CodeC09RecipeNotEmpty {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-C09 when promoting a zero-step draft, got: %+v", result.Errors())
	}

	// (3) 行はやはり残っている(検証で落ちても消えない)。
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM combos WHERE id = ?`, id).Scan(&n); err != nil {
		t.Fatalf("count after promote: %v", err)
	}
	if n != 1 {
		t.Errorf("legacy row must still survive after a rejected promote, count = %d", n)
	}
}

func TestService_UpdateMetadata_PromoteDraft_DuplicateBlocks(t *testing.T) {
	db, svc := newSvc(t)

	// 本登録コンボを先に作成
	input := validRyuInput(t, db)
	input.IsDraft = false
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create final: err=%v issues=%+v", err, r.Issues)
	}

	// 同一レシピで仮登録コンボを作成（仮登録は重複チェックスキップ）
	draftInput := validRyuInput(t, db)
	draftInput.IsDraft = true
	draft, _, err := svc.Create(context.Background(), draftInput)
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}

	// 昇格 → VAL-C02 重複エラーで阻止されるべき
	isDraft := false
	_, result, err := svc.UpdateMetadata(context.Background(), draft.ID, draft.Version, combosvc.UpdateMetadataInput{
		IsDraft: &isDraft,
	})
	if err != nil {
		t.Fatalf("promote err: %v", err)
	}
	if !result.HasError() {
		t.Error("expected VAL-C02 duplicate error on promote, but got no errors")
	}
}

// TestService_UpdateMetadata_RangeValidation_Blocks は PATCH 経路の範囲バリデーション。
// 推測: Create 経路で ERROR となる範囲外値(VAL-C04/C05/C13)は PATCH でも保存を
// 中止すべきと仮定した(DES-006 の範囲規定は登録経路によらないため)。
func TestService_UpdateMetadata_RangeValidation_Blocks(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	cases := []struct {
		name  string
		input combosvc.UpdateMetadataInput
		code  string
	}{
		{"drive out of range", combosvc.UpdateMetadataInput{DriveAvailableAtStart: comborepo.Some(999.0)}, validation.CodeC04DriveRange},
		{"sa out of range", combosvc.UpdateMetadataInput{SAAvailableAtStart: comborepo.Some(99)}, validation.CodeC05SARange},
		{"drive damage out of range", combosvc.UpdateMetadataInput{DriveDamage: comborepo.Some(7.5)}, validation.CodeC13DriveDamageRange},
		// ★M37-01: マス数 2 列を PATCH で運べるようにしたぶん、範囲検証もこの経路へ足した。
		//   ★無いと DB の CHECK 違反になり 500 で返る(400 + validations が他の値域欄と同じ扱い)。
		{"start position mass out of range", combosvc.UpdateMetadataInput{StartPositionMass: comborepo.Some(161)}, validation.CodePositionMassRange},
		{"carry distance mass out of range", combosvc.UpdateMetadataInput{CarryDistanceMass: comborepo.Some(-1)}, validation.CodePositionMassRange},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, tc.input)
			if err != nil {
				t.Fatalf("UpdateMetadata: %v", err)
			}
			if !result.HasError() {
				t.Fatalf("expected validation error %s, got issues=%+v", tc.code, result.Issues)
			}
			found := false
			for _, issue := range result.Issues {
				if issue.Code == tc.code && issue.Severity == validation.SeverityError {
					found = true
				}
			}
			if !found {
				t.Errorf("expected error code %s, got issues=%+v", tc.code, result.Issues)
			}
			after, getErr := svc.Get(context.Background(), saved.ID, 1)
			if getErr != nil {
				t.Fatalf("get after blocked update: %v", getErr)
			}
			if after.Version != saved.Version {
				t.Errorf("blocked update must not modify combo: version %d -> %d", saved.Version, after.Version)
			}
		})
	}
}

// TestService_UpdateMetadata_KnockdownWarning_StillSaves は VAL-C10(WARNING)の既存挙動固定。
// 警告は保存を妨げない(DES-006 §1.2)。
func TestService_UpdateMetadata_KnockdownWarning_StillSaves(t *testing.T) {
	db, svc := newSvc(t)
	saved, _, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, result, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(999),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("warning must not block save: %+v", result.Issues)
	}
	warned := false
	for _, issue := range result.Issues {
		if issue.Code == validation.CodeC10KnockdownRange && issue.Severity == validation.SeverityWarning {
			warned = true
		}
	}
	if !warned {
		t.Errorf("expected VAL-C10 warning, got issues=%+v", result.Issues)
	}
	if got.KnockdownAdvantage == nil || *got.KnockdownAdvantage != 999 {
		t.Errorf("knockdownAdvantage not saved: %+v", got.KnockdownAdvantage)
	}
}

// TestService_UpdateMetadata_PromoteDraft_ValidatesNewValues は昇格時のフルバリデーションが
// 「同一リクエストで渡された新値を反映した状態」に対して実行されることを検証する。
// 推測: 昇格後に DB に存在する状態(新値適用後)が検証対象であるべきと仮定した。
func TestService_UpdateMetadata_PromoteDraft_ValidatesNewValues(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.IsDraft = true
	draft, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}

	isDraft := false
	_, result, err := svc.UpdateMetadata(context.Background(), draft.ID, draft.Version, combosvc.UpdateMetadataInput{
		IsDraft:            &isDraft,
		SAAvailableAtStart: comborepo.Some(99),
	})
	if err != nil {
		t.Fatalf("promote: %v", err)
	}
	if !result.HasError() {
		t.Fatal("expected VAL-C05 error for out-of-range new value passed together with promotion")
	}
	after, getErr := svc.Get(context.Background(), draft.ID, 1)
	if getErr != nil {
		t.Fatalf("get after blocked promote: %v", getErr)
	}
	if !after.IsDraft {
		t.Error("combo must remain draft when promotion validation fails")
	}
}

// ===========================================================================
// UpdateWithKeyChange(PUT)
// ===========================================================================

func TestService_UpdateWithKeyChange_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// 新コンボ: Position を変えてキー変更を発生させる
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newCombo, result, err := svc.UpdateWithKeyChange(context.Background(), saved.ID, saved.Version, newInput)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected errors: %+v", result.Issues)
	}
	if newCombo.ID == saved.ID {
		t.Error("new combo should have a different ID")
	}

	// 旧コンボは論理削除されているため Get は ErrNotFound
	if _, err := svc.Get(context.Background(), saved.ID, 1); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("old combo should be soft-deleted: %v", err)
	}
}

func TestService_UpdateWithKeyChange_VersionConflict(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	_, _, err = svc.UpdateWithKeyChange(context.Background(), saved.ID, 999, newInput)
	if !errors.Is(err, combosvc.ErrConflict) {
		t.Errorf("expected ErrConflict, got %v", err)
	}
}

func TestService_UpdateWithKeyChange_PreservesSetupLink(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	// セットプレイを作成して旧コンボに紐付け
	_, err = db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test setup", 1)
	if err != nil {
		t.Fatal(err)
	}
	var setupID int64
	if err := db.QueryRow(`SELECT last_insert_rowid()`).Scan(&setupID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, saved.ID, setupID); err != nil {
		t.Fatal(err)
	}

	// キー変更編集を実行
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), saved.ID, saved.Version, newInput)
	if err != nil {
		t.Fatal(err)
	}

	// combo_setups が新コンボに付け替わっていること
	var actualComboID int64
	if err := db.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&actualComboID); err != nil {
		t.Fatal(err)
	}
	if actualComboID != newCombo.ID {
		t.Errorf("setup link should be transferred: got combo_id=%d, want %d", actualComboID, newCombo.ID)
	}
}

// ===========================================================================
// Delete + Restore
// ===========================================================================

func TestService_DeleteAndRestore(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.Delete(context.Background(), saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := svc.Get(context.Background(), saved.ID, 1); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("after Delete Get should return ErrNotFound, got %v", err)
	}

	if _, err := svc.Restore(context.Background(), saved.ID); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if _, err := svc.Get(context.Background(), saved.ID, 1); err != nil {
		t.Errorf("after Restore Get should succeed, got %v", err)
	}
}

func TestService_Delete_NotFound(t *testing.T) {
	_, svc := newSvc(t)
	if err := svc.Delete(context.Background(), 99999); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestService_Restore_NotFound(t *testing.T) {
	_, svc := newSvc(t)
	if _, err := svc.Restore(context.Background(), 99999); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// ===========================================================================
// PermanentDelete
// ===========================================================================

// ===========================================================================
// TagIDs(M3-02)
// ===========================================================================

func createTestTag(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO tags (user_id, name) VALUES (1, ?)`, name)
	if err != nil {
		t.Fatalf("create tag %q: %v", name, err)
	}
	id, _ := res.LastInsertId()
	return id
}

func comboTagCount(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_tags WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count combo_tags: %v", err)
	}
	return n
}

func TestService_Create_EmptyTagIDs_NoTags(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.TagIDs = []int64{}

	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if comboTagCount(t, db, saved.ID) != 0 {
		t.Errorf("expected 0 combo_tags, got %d", comboTagCount(t, db, saved.ID))
	}
	if len(saved.Tags) != 0 {
		t.Errorf("expected empty tags slice, got %v", saved.Tags)
	}
}

func TestService_Create_WithTagIDs_OK(t *testing.T) {
	db, svc := newSvc(t)
	tagID1 := createTestTag(t, db, "tag1")
	tagID2 := createTestTag(t, db, "tag2")

	input := validRyuInput(t, db)
	input.TagIDs = []int64{tagID1, tagID2}

	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if comboTagCount(t, db, saved.ID) != 2 {
		t.Errorf("expected 2 combo_tags, got %d", comboTagCount(t, db, saved.ID))
	}
	if len(saved.Tags) != 2 {
		t.Errorf("expected 2 tags in response, got %d", len(saved.Tags))
	}
}

func TestService_Create_InvalidTagID_RollbacksCombo(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.TagIDs = []int64{99999}

	_, _, err := svc.Create(context.Background(), input)
	if !errors.Is(err, combosvc.ErrInvalidTagID) {
		t.Fatalf("expected ErrInvalidTagID, got %v", err)
	}
	// コンボが作成されていないこと(トランザクションロールバック確認)
	// M7-04-2: 耐久 seed を除外したヘルパで数える。
	if count := countCombos(t, db); count != 0 {
		t.Errorf("combo should have been rolled back, got count=%d", count)
	}
}

func TestService_UpdateMetadata_TagIDs_Nil_NoChange(t *testing.T) {
	db, svc := newSvc(t)
	tagID := createTestTag(t, db, "existing")
	input := validRyuInput(t, db)
	input.TagIDs = []int64{tagID}
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// TagIDs=nil で PATCH → タグ関連は変化しない
	got, _, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("no tag change"),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if comboTagCount(t, db, got.ID) != 1 {
		t.Errorf("expected 1 combo_tag (unchanged), got %d", comboTagCount(t, db, got.ID))
	}
}

func TestService_UpdateMetadata_TagIDs_Empty_RemovesAll(t *testing.T) {
	db, svc := newSvc(t)
	tagID := createTestTag(t, db, "to-remove")
	input := validRyuInput(t, db)
	input.TagIDs = []int64{tagID}
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	emptyTags := []int64{}
	got, _, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		UserID: 1,
		TagIDs: &emptyTags,
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if comboTagCount(t, db, got.ID) != 0 {
		t.Errorf("expected 0 combo_tags after full removal, got %d", comboTagCount(t, db, got.ID))
	}
	if len(got.Tags) != 0 {
		t.Errorf("expected empty tags in response, got %v", got.Tags)
	}
}

func TestService_UpdateMetadata_TagIDs_Replace(t *testing.T) {
	db, svc := newSvc(t)
	tagID1 := createTestTag(t, db, "old-tag")
	tagID2 := createTestTag(t, db, "new-tag")

	input := validRyuInput(t, db)
	input.TagIDs = []int64{tagID1}
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newTags := []int64{tagID2}
	got, _, err := svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		UserID: 1,
		TagIDs: &newTags,
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if comboTagCount(t, db, got.ID) != 1 {
		t.Errorf("expected 1 combo_tag after replace, got %d", comboTagCount(t, db, got.ID))
	}
	if len(got.Tags) != 1 || got.Tags[0].ID != tagID2 {
		t.Errorf("expected tag %d, got %v", tagID2, got.Tags)
	}
	// M22-03 §5.1-8: タグだけを送る PATCH でも combos.version が上がること。
	//
	// ★集約単位が維持されていることの網である(D-394)。ここが崩れると、タグだけ
	// 変えた編集が他端末の持つ版を失効させず、続く保存が古い版のまま通る。
	// リポジトリ層の TestRepository_UpdateMetadata_EmptySetStillBumpsVersion は
	// 「SET 対象が空でも +1」の代理であり、本アサートは「タグだけの更新が実際に
	// UpdateMetadata へ到達して版を上げる」ことをサービス層で主張する。
	if got.Version != saved.Version+1 {
		t.Errorf("version = %d, want %d (タグだけの更新でも集約の版は上がる)", got.Version, saved.Version+1)
	}
}

func TestService_UpdateMetadata_VersionConflict_TagIDs_NoChange(t *testing.T) {
	db, svc := newSvc(t)
	tagID := createTestTag(t, db, "conflict-tag")
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newTags := []int64{tagID}
	_, _, err = svc.UpdateMetadata(context.Background(), saved.ID, 999, combosvc.UpdateMetadataInput{
		UserID: 1,
		TagIDs: &newTags,
	})
	if !errors.Is(err, combosvc.ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
	// combo_tags が変化していないこと(ロールバック確認)
	if comboTagCount(t, db, saved.ID) != 0 {
		t.Errorf("combo_tags should not have changed, got %d", comboTagCount(t, db, saved.ID))
	}
}

func TestService_PermanentDelete_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Delete(context.Background(), saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := svc.PermanentDelete(context.Background(), saved.ID); err != nil {
		t.Fatalf("PermanentDelete: %v", err)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id = ?`, saved.ID).Scan(&count); err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 0 {
		t.Errorf("expected combo to be permanently deleted from DB, got count=%d", count)
	}
}

func TestService_PermanentDelete_NotFound(t *testing.T) {
	_, svc := newSvc(t)
	if err := svc.PermanentDelete(context.Background(), 99999); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestService_PermanentDelete_NotInTrash(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.PermanentDelete(context.Background(), saved.ID); !errors.Is(err, combosvc.ErrComboNotInTrash) {
		t.Errorf("expected ErrComboNotInTrash, got %v", err)
	}
}

// ===========================================================================
// CheckDuplicate
// ===========================================================================

func TestService_CheckDuplicate_NoDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)

	created, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result)
	}

	move3 := lookupMoveID(t, db, 1, "hadoken_medium")
	checkInput := combosvc.CheckDuplicateInput{
		CharacterID:    1,
		StarterMoveID:  created.StarterMoveID,
		Position:       created.Position,
		OpponentStance: created.OpponentStance,
		HitType:        created.HitType,
		OpponentSize:   created.OpponentSize,
		Steps: []model.ComboStep{
			{StepOrder: 1, MoveID: created.StarterMoveID},
			{StepOrder: 2, MoveID: &move3},
		},
	}
	dupResult, err := svc.CheckDuplicate(context.Background(), checkInput)
	if err != nil {
		t.Fatalf("CheckDuplicate: %v", err)
	}
	if len(dupResult.Duplicates) != 0 {
		t.Errorf("duplicates = %d, want 0", len(dupResult.Duplicates))
	}
}

func TestService_CheckDuplicate_WithDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)

	created, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result)
	}

	checkInput := combosvc.CheckDuplicateInput{
		CharacterID:    created.CharacterID,
		StarterMoveID:  created.StarterMoveID,
		Position:       created.Position,
		OpponentStance: created.OpponentStance,
		HitType:        created.HitType,
		OpponentSize:   created.OpponentSize,
		Steps:          input.Steps,
	}
	dupResult, err := svc.CheckDuplicate(context.Background(), checkInput)
	if err != nil {
		t.Fatalf("CheckDuplicate: %v", err)
	}
	if len(dupResult.Duplicates) != 1 {
		t.Fatalf("duplicates = %d, want 1", len(dupResult.Duplicates))
	}
	dup := dupResult.Duplicates[0]
	if dup.ID != created.ID {
		t.Errorf("duplicate ID = %d, want %d", dup.ID, created.ID)
	}
	if dup.CharacterID != created.CharacterID {
		t.Errorf("CharacterID = %d, want %d", dup.CharacterID, created.CharacterID)
	}
	if dup.StepCount != created.StepCount {
		t.Errorf("StepCount = %d, want %d", dup.StepCount, created.StepCount)
	}
}

func TestService_CheckDuplicate_ExcludeComboID(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)

	created, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result)
	}

	checkInput := combosvc.CheckDuplicateInput{
		CharacterID:    created.CharacterID,
		StarterMoveID:  created.StarterMoveID,
		Position:       created.Position,
		OpponentStance: created.OpponentStance,
		HitType:        created.HitType,
		OpponentSize:   created.OpponentSize,
		Steps:          input.Steps,
		ExcludeComboID: &created.ID,
	}
	dupResult, err := svc.CheckDuplicate(context.Background(), checkInput)
	if err != nil {
		t.Fatalf("CheckDuplicate: %v", err)
	}
	if len(dupResult.Duplicates) != 0 {
		t.Errorf("duplicates = %d, want 0 (excluded own ID)", len(dupResult.Duplicates))
	}
}

// ===========================================================================
// M3-03 追加テスト: フィルタ・ソート拡張
// ===========================================================================

func TestService_List_FilterByTagIDs(t *testing.T) {
	db, svc := newSvc(t)
	tag1 := createTestTag(t, db, "tag-a")
	tag2 := createTestTag(t, db, "tag-b")
	tag3 := createTestTag(t, db, "tag-c")

	// コンボ1: tag1 + tag2
	input1 := validRyuInput(t, db)
	input1.TagIDs = []int64{tag1, tag2}
	combo1, _, err := svc.Create(context.Background(), input1)
	if err != nil {
		t.Fatal(err)
	}

	// コンボ2: tag3 のみ
	input2 := validRyuInput(t, db)
	input2.Position = ptr("corner_self")
	input2.TagIDs = []int64{tag3}
	if _, _, err := svc.Create(context.Background(), input2); err != nil {
		t.Fatal(err)
	}

	// tag1 OR tag2 でフィルタ → コンボ1 のみ返るべき
	got, err := svc.List(context.Background(), combosvc.ListFilter{TagIDs: []int64{tag1, tag2}})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 result, got %d", len(got))
	}
	if got[0].ID != combo1.ID {
		t.Errorf("expected combo %d, got %d", combo1.ID, got[0].ID)
	}
}

func TestService_List_FilterByOpponentStance(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.OpponentStance = ptr("crouching")
	if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, r.Issues)
	}
	input2 := validRyuInput(t, db)
	input2.Position = ptr("corner_self")
	input2.OpponentStance = ptr("standing")
	if _, r, err := svc.Create(context.Background(), input2); err != nil || r.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, r.Issues)
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{OpponentStance: ptr("crouching")})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range got {
		if c.OpponentStance == nil || *c.OpponentStance != "crouching" {
			t.Errorf("expected opponent_stance crouching, got %v", c.OpponentStance)
		}
	}
}

func TestService_List_CombinedFilters(t *testing.T) {
	db, svc := newSvc(t)

	// 本登録 + corner_self
	input1 := validRyuInput(t, db)
	input1.Position = ptr("corner_self")
	input1.IsDraft = false
	if _, r, err := svc.Create(context.Background(), input1); err != nil || r.HasError() {
		t.Fatalf("create1: err=%v issues=%+v", err, r.Issues)
	}

	// 仮登録 + corner_self
	input2 := validRyuInput(t, db)
	input2.Position = ptr("corner_self")
	input2.IsDraft = true
	if _, r, err := svc.Create(context.Background(), input2); err != nil || r.HasError() {
		t.Fatalf("create2: err=%v issues=%+v", err, r.Issues)
	}

	// 本登録 + mid_screen
	input3 := validRyuInput(t, db)
	input3.Position = ptr("mid_screen")
	input3.IsDraft = false
	if _, r, err := svc.Create(context.Background(), input3); err != nil || r.HasError() {
		t.Fatalf("create3: err=%v issues=%+v", err, r.Issues)
	}

	// character_id=1 + position=corner_self + is_draft=false → 1件
	got, err := svc.List(context.Background(), combosvc.ListFilter{
		CharacterID: ptr(int64(1)),
		Position:    ptr("corner_self"),
		IsDraft:     ptr(false),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 result with combined filters, got %d", len(got))
	}
}

func TestService_List_SortByDamage_Asc(t *testing.T) {
	db, svc := newSvc(t)

	positions := []string{"mid_screen", "corner_self", "corner_self_near"}
	damages := []int{300, 100, 200}
	for i, pos := range positions {
		input := validRyuInput(t, db)
		input.Position = ptr(pos)
		input.Damage = ptr(damages[i])
		if _, r, err := svc.Create(context.Background(), input); err != nil || r.HasError() {
			t.Fatalf("create %d: err=%v issues=%+v", i, err, r.Issues)
		}
	}

	got, err := svc.List(context.Background(), combosvc.ListFilter{
		CharacterID: ptr(int64(1)),
		Sort:        "damage",
		Order:       "asc",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) < 3 {
		t.Fatalf("expected at least 3 results, got %d", len(got))
	}
	if got[0].Damage == nil || got[1].Damage == nil || *got[0].Damage > *got[1].Damage {
		t.Errorf("damage not sorted asc: first=%v second=%v", got[0].Damage, got[1].Damage)
	}
}

func TestService_List_OnlyDeleted(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Delete(context.Background(), saved.ID); err != nil {
		t.Fatal(err)
	}

	// only_deleted=true → 削除済みのみ
	got, err := svc.List(context.Background(), combosvc.ListFilter{OnlyDeleted: true})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range got {
		if c.ID == saved.ID {
			found = true
		}
	}
	if !found {
		t.Errorf("deleted combo %d not found in only_deleted list", saved.ID)
	}

	// 通常 List では返らない
	normal, err := svc.List(context.Background(), combosvc.ListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range normal {
		if c.ID == saved.ID {
			t.Errorf("deleted combo %d should not appear in normal list", saved.ID)
		}
	}
}

// ===========================================================================
// List — DefaultRecipe（extractDefaultRecipe 間接テスト）
// ===========================================================================

func TestService_List_DefaultRecipe(t *testing.T) {
	ctx := context.Background()

	cases := []struct {
		name     string
		cacheVal *string
		want     string
	}{
		{
			name:     "normal: preset1 key returns recipe string",
			cacheVal: ptr(`{"1":"立ち弱P > 弱波動拳"}`),
			want:     "立ち弱P > 弱波動拳",
		},
		{
			name:     "null: recipe_cache NULL returns empty",
			cacheVal: nil,
			want:     "",
		},
		{
			name:     "empty: recipe_cache empty string returns empty",
			cacheVal: ptr(""),
			want:     "",
		},
		{
			name:     "invalid_json: parse failure returns empty",
			cacheVal: ptr("not-json"),
			want:     "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, svc := newSvc(t)

			combo, _, err := svc.Create(ctx, validRyuInput(t, db))
			if err != nil {
				t.Fatalf("Create: %v", err)
			}

			// svc.Create() が notation service 経由で recipe_cache を書く可能性があるため
			// テスト対象の値で明示的に上書きする。
			if tc.cacheVal == nil {
				if _, err := db.ExecContext(ctx, "UPDATE combos SET recipe_cache = NULL WHERE id = ?", combo.ID); err != nil {
					t.Fatalf("reset recipe_cache to NULL: %v", err)
				}
			} else {
				if _, err := db.ExecContext(ctx, "UPDATE combos SET recipe_cache = ? WHERE id = ?", *tc.cacheVal, combo.ID); err != nil {
					t.Fatalf("set recipe_cache: %v", err)
				}
			}

			got, err := svc.List(ctx, combosvc.ListFilter{CharacterID: ptr(int64(1))})
			if err != nil {
				t.Fatalf("List: %v", err)
			}

			var found *model.Combo
			for _, c := range got {
				if c.ID == combo.ID {
					found = c
					break
				}
			}
			if found == nil {
				t.Fatalf("combo %d not found in List result", combo.ID)
			}
			if found.DefaultRecipe != tc.want {
				t.Errorf("DefaultRecipe = %q, want %q", found.DefaultRecipe, tc.want)
			}
		})
	}
}

// ===========================================================================
// SetupCarryOptions — UpdateMetadata (PATCH)
// ===========================================================================

func createComboWithKAAndSetup(t *testing.T, db *sql.DB, svc combosvc.Service, ka *int) (comboID int64, setupID int64) {
	t.Helper()
	input := validRyuInput(t, db)
	input.KnockdownAdvantage = ka
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	comboID = saved.ID

	_, err = db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test setup", 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT last_insert_rowid()`).Scan(&setupID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID); err != nil {
		t.Fatal(err)
	}
	return comboID, setupID
}

func countComboSetups(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_setups WHERE combo_id = ?`, comboID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func TestService_UpdateMetadata_CarryAll(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	_, _, err := svc.UpdateMetadata(context.Background(), comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "carry_all"},
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if countComboSetups(t, db, comboID) != 1 {
		t.Error("expected setup link to remain with carry_all")
	}
}

func TestService_UpdateMetadata_UnlinkAll(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	_, _, err := svc.UpdateMetadata(context.Background(), comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "unlink_all"},
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if countComboSetups(t, db, comboID) != 0 {
		t.Error("expected all setup links removed with unlink_all")
	}
}

func TestService_UpdateMetadata_Individual(t *testing.T) {
	db, svc := newSvc(t)
	comboID, setupID := createComboWithKAAndSetup(t, db, svc, ptr(20))

	// 2 つ目の setup を追加
	_, err := db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test setup 2", 1)
	if err != nil {
		t.Fatal(err)
	}
	var setupID2 int64
	if err := db.QueryRow(`SELECT last_insert_rowid()`).Scan(&setupID2); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID2); err != nil {
		t.Fatal(err)
	}

	combo, _ := svc.Get(context.Background(), comboID, 1)
	_, _, err = svc.UpdateMetadata(context.Background(), comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "individual", CarrySetupIDs: []int64{setupID}},
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if countComboSetups(t, db, comboID) != 1 {
		t.Error("expected only 1 setup link remaining with individual")
	}
}

func TestService_UpdateMetadata_InvalidMode(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	_, _, err := svc.UpdateMetadata(context.Background(), comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "invalid_mode"},
	})
	if !errors.Is(err, combosvc.ErrInvalidSetupCarryMode) {
		t.Fatalf("expected ErrInvalidSetupCarryMode, got %v", err)
	}
}

func TestService_UpdateMetadata_MissingCarryOptions(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	_, _, err := svc.UpdateMetadata(context.Background(), comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
	})
	if !errors.Is(err, combosvc.ErrMissingSetupCarryOptions) {
		t.Fatalf("expected ErrMissingSetupCarryOptions, got %v", err)
	}
}

func TestService_UpdateMetadata_KAChange_NoSetups_OK(t *testing.T) {
	db, svc := newSvc(t)
	input := validRyuInput(t, db)
	input.KnockdownAdvantage = ptr(20)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}

	_, _, err = svc.UpdateMetadata(context.Background(), saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
	})
	if err != nil {
		t.Fatalf("expected no error when KA changes with 0 setups, got %v", err)
	}
}

// ===========================================================================
// SetupCarryOptions — UpdateWithKeyChange (PUT)
// ===========================================================================

func TestService_UpdateWithKeyChange_CarryAll(t *testing.T) {
	db, svc := newSvc(t)
	comboID, setupID := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.KnockdownAdvantage = ptr(30)
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "carry_all"}

	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), comboID, combo.Version, newInput)
	if err != nil {
		t.Fatal(err)
	}

	var actualComboID int64
	if err := db.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&actualComboID); err != nil {
		t.Fatal(err)
	}
	if actualComboID != newCombo.ID {
		t.Errorf("setup should be transferred to new combo: got %d, want %d", actualComboID, newCombo.ID)
	}
}

func TestService_UpdateWithKeyChange_UnlinkAll(t *testing.T) {
	db, svc := newSvc(t)
	comboID, setupID := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.KnockdownAdvantage = ptr(30)
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "unlink_all"}

	_, _, err := svc.UpdateWithKeyChange(context.Background(), comboID, combo.Version, newInput)
	if err != nil {
		t.Fatal(err)
	}

	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("expected setup link deleted with unlink_all, got count=%d", count)
	}
}

func TestService_UpdateWithKeyChange_Individual(t *testing.T) {
	db, svc := newSvc(t)
	comboID, setupID := createComboWithKAAndSetup(t, db, svc, ptr(20))

	// 2 つ目の setup を追加
	_, err := db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test setup 2", 1)
	if err != nil {
		t.Fatal(err)
	}
	var setupID2 int64
	if err := db.QueryRow(`SELECT last_insert_rowid()`).Scan(&setupID2); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID2); err != nil {
		t.Fatal(err)
	}

	combo, _ := svc.Get(context.Background(), comboID, 1)
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.KnockdownAdvantage = ptr(30)
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{
		Mode:          "individual",
		CarrySetupIDs: []int64{setupID},
	}

	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), comboID, combo.Version, newInput)
	if err != nil {
		t.Fatal(err)
	}

	if countComboSetups(t, db, newCombo.ID) != 1 {
		t.Error("expected only 1 setup link on new combo with individual")
	}
}

func TestService_UpdateWithKeyChange_InvalidMode(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "bad_mode"}

	_, _, err := svc.UpdateWithKeyChange(context.Background(), comboID, combo.Version, newInput)
	if !errors.Is(err, combosvc.ErrInvalidSetupCarryMode) {
		t.Fatalf("expected ErrInvalidSetupCarryMode, got %v", err)
	}
}

func TestService_UpdateWithKeyChange_MissingCarryOptions(t *testing.T) {
	db, svc := newSvc(t)
	comboID, _ := createComboWithKAAndSetup(t, db, svc, ptr(20))

	combo, _ := svc.Get(context.Background(), comboID, 1)
	newInput := validRyuInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.KnockdownAdvantage = ptr(30)

	_, _, err := svc.UpdateWithKeyChange(context.Background(), comboID, combo.Version, newInput)
	if !errors.Is(err, combosvc.ErrMissingSetupCarryOptions) {
		t.Fatalf("expected ErrMissingSetupCarryOptions, got %v", err)
	}
}

// ===========================================================================
// M4-04: Create with bundled setups
// ===========================================================================

func validSetupInput(t *testing.T, db *sql.DB, characterID int64) setupsvc.CreateSetupInput {
	t.Helper()
	moveID := lookupMoveID(t, db, characterID, "standing_light_punch")
	return setupsvc.CreateSetupInput{
		CharacterID: characterID,
		Name:        ptr("テストセットプレイ"), // VAL-S06: 名前必須(C-03)
		Steps: []model.SetupStep{
			{MoveID: &moveID},
		},
	}
}

// validSetupInputWithDistinctRecipe は同一コンボへ **もう 1 本** 同梱するための入力を返す。
//
// ★★M24-13 §4.6: VAL-S04 は名前を見ない(DES-006 §3)。同じレシピのセットプレイを
// 同じ親コンボへ 2 本足すのは、名前が違っても重複である。
// ★以前は同一リクエスト内の 2 本目が **見えていなかった** ため、同じレシピのまま
// 通っていた(判定が *sql.DB 直読みで、同じ tx が書いた 1 本目を見られなかった)。
// ⇒ 複数同梱を見たいテストは、レシピを分けること。★検証を緩めるのではない。
func validSetupInputWithDistinctRecipe(t *testing.T, db *sql.DB, characterID int64, moveCode string) setupsvc.CreateSetupInput {
	t.Helper()
	in := validSetupInput(t, db, characterID)
	moveID := lookupMoveID(t, db, characterID, moveCode)
	in.Steps = []model.SetupStep{{MoveID: &moveID}}
	return in
}

func TestService_Create_WithNilSetups_OK(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = nil

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Error("expected ID to be set")
	}
	if countComboSetups(t, db, got.ID) != 0 {
		t.Errorf("expected 0 combo_setups, got %d", countComboSetups(t, db, got.ID))
	}
	if countSetups(t, db) != 0 {
		t.Errorf("expected 0 setups, got %d", countSetups(t, db))
	}
}

func TestService_Create_WithEmptySetups_OK(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Error("expected ID to be set")
	}
	if countComboSetups(t, db, got.ID) != 0 {
		t.Errorf("expected 0 combo_setups, got %d", countComboSetups(t, db, got.ID))
	}
}

func TestService_Create_WithOneSetup_OK(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		validSetupInput(t, db, 1),
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Error("expected ID to be set")
	}
	if countComboSetups(t, db, got.ID) != 1 {
		t.Errorf("expected 1 combo_setups, got %d", countComboSetups(t, db, got.ID))
	}
	if countSetups(t, db) != 1 {
		t.Errorf("expected 1 setup, got %d", countSetups(t, db))
	}
}

func TestService_Create_WithMultipleSetups_OK(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)

	s1 := validSetupInput(t, db, 1)
	s1.Name = ptr("setup A")
	// ★M24-13: レシピを分ける。VAL-S04 は名前を見ないため、同じレシピの 2 本目は
	//   同じ親コンボに対して重複である(以前は同一 tx 内で見えていなかった)。
	s2 := validSetupInputWithDistinctRecipe(t, db, 1, "standing_medium_punch")
	s2.Name = ptr("setup B")
	input.Setups = []setupsvc.CreateSetupInput{s1, s2}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation errors: %+v", result.Issues)
	}
	if countComboSetups(t, db, got.ID) != 2 {
		t.Errorf("expected 2 combo_setups, got %d", countComboSetups(t, db, got.ID))
	}
	if countSetups(t, db) != 2 {
		t.Errorf("expected 2 setups, got %d", countSetups(t, db))
	}
}

func TestService_Create_SetupValidationError_Rollback(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		{CharacterID: 1, Steps: []model.SetupStep{}},
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil combo on validation error, got ID=%d", got.ID)
	}
	if !result.HasError() {
		t.Fatal("expected validation error")
	}
	foundField := false
	for _, issue := range result.Issues {
		if issue.Field == "setups[0].steps" {
			foundField = true
		}
	}
	if !foundField {
		t.Errorf("expected issue with field setups[0].steps, got: %+v", result.Issues)
	}
	if countCombos(t, db) != 0 {
		t.Errorf("combo should be rolled back, got count=%d", countCombos(t, db))
	}
	if countSetups(t, db) != 0 {
		t.Errorf("setup should be rolled back, got count=%d", countSetups(t, db))
	}
}

func TestService_Create_SecondSetupValidationError_Rollback(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		validSetupInput(t, db, 1),
		{CharacterID: 1, Steps: []model.SetupStep{}},
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil combo on validation error, got ID=%d", got.ID)
	}
	if !result.HasError() {
		t.Fatal("expected validation error")
	}
	foundField := false
	for _, issue := range result.Issues {
		if issue.Field == "setups[1].steps" {
			foundField = true
		}
	}
	if !foundField {
		t.Errorf("expected issue with field setups[1].steps, got: %+v", result.Issues)
	}
	if countCombos(t, db) != 0 {
		t.Errorf("combo should be rolled back, got count=%d", countCombos(t, db))
	}
	if countSetups(t, db) != 0 {
		t.Errorf("first setup should also be rolled back, got count=%d", countSetups(t, db))
	}
}

func TestService_Create_SetupCharacterMismatch_Rollback(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		{CharacterID: 99999, Steps: []model.SetupStep{{MoveID: ptr(int64(1))}}},
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil combo on validation error, got ID=%d", got.ID)
	}
	if !result.HasError() {
		t.Fatal("expected validation error for character mismatch")
	}
	if countCombos(t, db) != 0 {
		t.Errorf("combo should be rolled back, got count=%d", countCombos(t, db))
	}
}
