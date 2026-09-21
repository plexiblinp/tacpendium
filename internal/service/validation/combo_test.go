package validation_test

import (
	"context"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// テスト用モック実装
// ===========================================================================

type mockCharacterRepo struct {
	existing map[int64]bool
}

func (m *mockCharacterRepo) ExistsByID(ctx context.Context, id int64) (bool, error) {
	return m.existing[id], nil
}

type mockMoveRepo struct {
	existsByChar map[int64]map[int64]bool // [characterID][moveID] = bool
	rushVariants map[int64]int64          // [moveID] = originalMoveID(0 なら rush ではない)
}

func (m *mockMoveRepo) ExistsForCharacter(ctx context.Context, characterID, moveID int64) (bool, error) {
	if m.existsByChar == nil {
		return false, nil
	}
	return m.existsByChar[characterID][moveID], nil
}

func (m *mockMoveRepo) IsRushVariant(ctx context.Context, moveID int64) (bool, error) {
	_, ok := m.rushVariants[moveID]
	return ok, nil
}

func (m *mockMoveRepo) FindOriginalMoveID(ctx context.Context, moveID int64) (*int64, error) {
	orig, ok := m.rushVariants[moveID]
	if !ok || orig == 0 {
		return nil, nil
	}
	return &orig, nil
}

type mockDuplicateChecker struct {
	candidates []validation.DuplicateCandidate
}

func (m *mockDuplicateChecker) FindActivePublishedDuplicates(ctx context.Context, key validation.DuplicateKey) ([]validation.DuplicateCandidate, error) {
	return m.candidates, nil
}

func newDeps() validation.Dependencies {
	return validation.Dependencies{
		CharacterRepo: &mockCharacterRepo{existing: map[int64]bool{1: true}},
		MoveRepo: &mockMoveRepo{
			existsByChar: map[int64]map[int64]bool{
				1: {10: true, 11: true, 12: true, 100: true},
			},
			rushVariants: map[int64]int64{
				50: 10, // moveID=50 は moveID=10 のラッシュ版
				51: 99, // moveID=51 のラッシュ版だが元技 99 はキャラに存在しない
				// ★★moveID=52 は original_move_id が NULL の行(M35-03)。
				//   mockMoveRepo.FindOriginalMoveID は 0 のとき (nil, nil) を返す——
				//   本番の MoveAdapter(internal/service/combo/deps_adapter.go:60-74)が
				//   NULL のとき (nil, nil) を返すのと同じ形である。
				52: 0,
			},
		},
		ComboRepo: &mockDuplicateChecker{},
	}
}

func ptrStr(s string) *string     { return &s }
func ptrInt(i int) *int           { return &i }
func ptrFloat(f float64) *float64 { return &f }
func ptrInt64(i int64) *int64     { return &i }

// validBaseCombo は VAL を全部 PASS する最小本登録コンボの雛形。
func validBaseCombo() *model.Combo {
	return &model.Combo{
		CharacterID:           1,
		StarterMoveID:         ptrInt64(10),
		Position:              ptrStr("mid_screen"),
		OpponentStance:        ptrStr("standing"),
		HitType:               ptrStr("normal"),
		OpponentSize:          ptrStr("standard"),
		DriveAvailableAtStart: ptrFloat(6),
		SAAvailableAtStart:    ptrInt(3),
		KnockdownAdvantage:    ptrInt(30),
		// ★M27-02b(VAL-C15) / ★★M38-01: **"valid" を名乗る fixture には要る**
		//   ——欠けていると、他の VAL のテストが「自分のコードだけを見ている」おかげで
		//   偶然通っているだけの状態になる。
		// ★★M38-01 追補2 の時点で必須は 2 欄である。⇒ いま C15 が咎めるのは
		//   damage / knockdownAdvantage だけである(開始残量は上で埋めてある)。
		//   ★消費ゲージ 2 欄は必須から外れたが、fixture からは外さない ——
		//     "valid" は「あらゆる VAL に対して正しい」という意味であり、必須の話に限らない。
		Damage:             ptrInt(1000),
		DriveGaugeConsumed: ptrFloat(1),
		SAGaugeConsumed:    ptrInt(0),
	}
}

func validBaseSteps() []model.ComboStep {
	return []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(10)},
		{StepOrder: 2, MoveID: ptrInt64(11)},
	}
}

// ===========================================================================
// VAL-C01: character_id 存在
// ===========================================================================

func TestC01_CharacterExists_OK(t *testing.T) {
	combo := validBaseCombo()
	r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "hash", newDeps())
	for _, i := range r.Errors() {
		if i.Code == validation.CodeC01CharacterExists {
			t.Errorf("unexpected C01 error: %v", i)
		}
	}
}

func TestC01_CharacterExists_NotFound(t *testing.T) {
	combo := validBaseCombo()
	combo.CharacterID = 999
	r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "hash", newDeps())
	if !hasIssue(r, validation.CodeC01CharacterExists, validation.SeverityError) {
		t.Errorf("expected C01 error, got: %+v", r.Issues)
	}
}

// ===========================================================================
// VAL-C02: 重複判定(本登録時のみ)
// ===========================================================================

func TestC02_Duplicate_Hit(t *testing.T) {
	deps := newDeps()
	deps.ComboRepo = &mockDuplicateChecker{
		candidates: []validation.DuplicateCandidate{
			{ID: 42, RecipeHash: "matching-hash", StepCount: 3},
		},
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), validBaseSteps(), false, "matching-hash", deps)
	if !hasIssue(r, validation.CodeC02Duplicate, validation.SeverityError) {
		t.Errorf("expected C02 error, got: %+v", r.Issues)
	}
}

func TestC02_Duplicate_NoMatch(t *testing.T) {
	deps := newDeps()
	deps.ComboRepo = &mockDuplicateChecker{
		candidates: []validation.DuplicateCandidate{
			{ID: 42, RecipeHash: "different-hash", StepCount: 3},
		},
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), validBaseSteps(), false, "new-hash", deps)
	if hasIssue(r, validation.CodeC02Duplicate, validation.SeverityError) {
		t.Errorf("unexpected C02 error: %+v", r.Issues)
	}
}

func TestC02_Duplicate_DraftSkipped(t *testing.T) {
	// Q3 確定: 仮登録時は VAL-C02 完全スキップ
	deps := newDeps()
	deps.ComboRepo = &mockDuplicateChecker{
		candidates: []validation.DuplicateCandidate{
			{ID: 42, RecipeHash: "matching-hash", StepCount: 3},
		},
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), validBaseSteps(), true, "matching-hash", deps)
	if hasIssue(r, validation.CodeC02Duplicate, validation.SeverityError) {
		t.Errorf("VAL-C02 should be skipped for drafts, but got: %+v", r.Issues)
	}
}

// ===========================================================================
// VAL-C03: starter_move_id とレシピ 1 ステップ目の一致
// ===========================================================================

func TestC03_StarterMatches_OK(t *testing.T) {
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC03StarterMatchesStep1, validation.SeverityWarning) {
		t.Errorf("unexpected C03 warning: %+v", r.Issues)
	}
}

func TestC03_StarterMismatch(t *testing.T) {
	combo := validBaseCombo()
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(11)}, // starter は 10、step1 は 11 → 不一致
	}
	r := validation.ValidateComboForCreate(context.Background(), combo, steps, false, "h", newDeps())
	if !hasIssue(r, validation.CodeC03StarterMatchesStep1, validation.SeverityWarning) {
		t.Errorf("expected C03 warning, got: %+v", r.Issues)
	}
}

func TestC03_DraftStarterNullSkipped(t *testing.T) {
	combo := validBaseCombo()
	combo.StarterMoveID = nil
	steps := []model.ComboStep{{StepOrder: 1, MoveID: ptrInt64(10)}}
	r := validation.ValidateComboForCreate(context.Background(), combo, steps, true, "h", newDeps())
	if hasIssue(r, validation.CodeC03StarterMatchesStep1, validation.SeverityWarning) {
		t.Errorf("C03 should be skipped when draft + starter NULL: %+v", r.Issues)
	}
}

// ===========================================================================
// VAL-C04: drive_available_at_start 範囲(0〜6)
// ===========================================================================

func TestC04_DriveRange_OK(t *testing.T) {
	// M16-01: 0.5 刻みの小数(2.5, 5.5)も範囲内なら許容する。
	for _, v := range []float64{0, 2.5, 3, 5.5, 6} {
		combo := validBaseCombo()
		combo.DriveAvailableAtStart = ptrFloat(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if hasIssue(r, validation.CodeC04DriveRange, validation.SeverityError) {
			t.Errorf("v=%g: unexpected C04 error: %+v", v, r.Issues)
		}
	}
}

func TestC04_DriveRange_OutOfRange(t *testing.T) {
	for _, v := range []float64{-0.5, -1, 6.5, 7, 100} {
		combo := validBaseCombo()
		combo.DriveAvailableAtStart = ptrFloat(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if !hasIssue(r, validation.CodeC04DriveRange, validation.SeverityError) {
			t.Errorf("v=%g: expected C04 error, got: %+v", v, r.Issues)
		}
	}
}

// ===========================================================================
// VAL-C13: drive_damage 範囲(-6〜6・小数許容、C-11)
// ===========================================================================

func TestC13_DriveDamageRange_OK(t *testing.T) {
	for _, v := range []float64{-6, -2.5, 0, 0.5, 6} {
		combo := validBaseCombo()
		dd := v
		combo.DriveDamage = &dd
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if hasIssue(r, validation.CodeC13DriveDamageRange, validation.SeverityError) {
			t.Errorf("v=%g: unexpected C13 error: %+v", v, r.Issues)
		}
	}
}

func TestC13_DriveDamageRange_OutOfRange(t *testing.T) {
	for _, v := range []float64{-6.5, 6.5, 100} {
		combo := validBaseCombo()
		dd := v
		combo.DriveDamage = &dd
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if !hasIssue(r, validation.CodeC13DriveDamageRange, validation.SeverityError) {
			t.Errorf("v=%g: expected C13 error, got: %+v", v, r.Issues)
		}
	}
}

// ===========================================================================
// VAL-C05: sa_available_at_start 範囲(0〜3)
// ===========================================================================

func TestC05_SARange_OK(t *testing.T) {
	for _, v := range []int{0, 1, 2, 3} {
		combo := validBaseCombo()
		combo.SAAvailableAtStart = ptrInt(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if hasIssue(r, validation.CodeC05SARange, validation.SeverityError) {
			t.Errorf("v=%d: unexpected C05 error: %+v", v, r.Issues)
		}
	}
}

func TestC05_SARange_OutOfRange(t *testing.T) {
	for _, v := range []int{-1, 4, 99} {
		combo := validBaseCombo()
		combo.SAAvailableAtStart = ptrInt(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if !hasIssue(r, validation.CodeC05SARange, validation.SeverityError) {
			t.Errorf("v=%d: expected C05 error, got: %+v", v, r.Issues)
		}
	}
}

// VAL-C06 / C07(ゲージ消費合計バリデーション)は CHANGE-019 で廃止したためテストも削除。

// ===========================================================================
// VAL-C08: 各ステップの move_id がキャラに存在
// ===========================================================================

func TestC08_MoveExists_OK(t *testing.T) {
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC08MoveExists, validation.SeverityWarning) {
		t.Errorf("unexpected C08 warning: %+v", r.Issues)
	}
}

func TestC08_MoveNotFound(t *testing.T) {
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(99999)},
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
	if !hasIssue(r, validation.CodeC08MoveExists, validation.SeverityWarning) {
		t.Errorf("expected C08 warning, got: %+v", r.Issues)
	}
}

func TestC08_NullMoveIDSkipped(t *testing.T) {
	// modifiers.type 指定の非技ステップ: move_id NULL 可
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: nil, Modifiers: &model.Modifiers{Type: "parry_drive_rush"}},
		{StepOrder: 2, MoveID: ptrInt64(10)},
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
	if hasIssue(r, validation.CodeC08MoveExists, validation.SeverityWarning) {
		t.Errorf("NULL move_id step should be skipped: %+v", r.Issues)
	}
}

// ===========================================================================
// VAL-C09: レシピが空でない
// ===========================================================================

func TestC09_EmptyRecipe_PublishedError(t *testing.T) {
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), nil, false, "h", newDeps())
	if !hasIssue(r, validation.CodeC09RecipeNotEmpty, validation.SeverityError) {
		t.Errorf("expected C09 error for empty recipe, got: %+v", r.Issues)
	}
}

// ★★M24-13 / CHANGE-139: 仮登録でも C09 が走る(以前はスキップしていた)。
// 「ステップが入っていない仮登録は、何に使おうとしたものか後から分からない」ため。
func TestC09_EmptyRecipe_DraftError(t *testing.T) {
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), nil, true, "h", newDeps())
	if !hasIssue(r, validation.CodeC09RecipeNotEmpty, validation.SeverityError) {
		t.Errorf("expected C09 error for empty draft recipe, got: %+v", r.Issues)
	}
}

// ★★M24-13: 仮登録で「技が未指定のステップ」1 本なら通ること。
//
// ★★本テストが VAL-D02(move_id は指定されていれば存在検証、未指定は許容)が
// 生きていることを見る唯一の観測である。レシピ必須化の巻き添えで「うろ覚え」を
// 壊していないかは、ここでしか分からない(指示書 §5.1・チェックリスト 5-2)。
// ★数えているのがステップの本数だけであることも、同時に固定している
//
//	——move_id の有無で数えていたら 0 本と見なされて C09 が出る。
func TestC09_DraftSingleStepWithoutMoveID_OK(t *testing.T) {
	steps := []model.ComboStep{{StepOrder: 1, MoveID: nil}}
	combo := validBaseCombo()
	combo.StarterMoveID = nil // 技が未指定なので始動技も決まらない(VAL-C03 は starter NULL でスキップ)
	r := validation.ValidateComboForCreate(context.Background(), combo, steps, true, "h", newDeps())
	if hasIssue(r, validation.CodeC09RecipeNotEmpty, validation.SeverityError) {
		t.Errorf("C09 must not fire for a 1-step draft without move_id: %+v", r.Issues)
	}
	if hasIssue(r, validation.CodeC08MoveExists, validation.SeverityWarning) {
		t.Errorf("VAL-D02: NULL move_id must be tolerated (no C08 warning): %+v", r.Issues)
	}
	if r.HasError() {
		t.Errorf("1-step draft without move_id must be saveable, got errors: %+v", r.Errors())
	}
}

// ★★M24-13: 仮登録で「非技ステップ」(modifiers.type のみ・move_id NULL)1 本なら通ること。
//
// ★move_id NULL には 2 つの目的がある(DES-004 §2.2 の非技ステップの正規表現 /
// VAL-D02 の技未指定)。★どちらも 1 本として数える。非技ステップは本登録でも
// 普通に存在するため、これを 0 本扱いにすると本登録の VAL とも整合しなくなる。
func TestC09_DraftSingleNonMoveStep_OK(t *testing.T) {
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: nil, Modifiers: &model.Modifiers{Type: "parry_drive_rush"}},
	}
	combo := validBaseCombo()
	combo.StarterMoveID = nil
	r := validation.ValidateComboForCreate(context.Background(), combo, steps, true, "h", newDeps())
	if hasIssue(r, validation.CodeC09RecipeNotEmpty, validation.SeverityError) {
		t.Errorf("C09 must not fire for a 1-step non-move draft: %+v", r.Issues)
	}
	if r.HasError() {
		t.Errorf("1-step non-move draft must be saveable, got errors: %+v", r.Errors())
	}
}

// ★M24-13: 本登録側の挙動が変わっていないこと(1 本以上なら C09 は出ない)。
// ★本サブは仮登録側の適用範囲を広げただけである(チェックリスト 1-6)。
func TestC09_PublishedSingleStep_NoError(t *testing.T) {
	steps := []model.ComboStep{{StepOrder: 1, MoveID: ptrInt64(10)}}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
	if hasIssue(r, validation.CodeC09RecipeNotEmpty, validation.SeverityError) {
		t.Errorf("C09 must not fire for a published 1-step recipe: %+v", r.Issues)
	}
}

// ★★M24-13(レビュー 中-3): レシピ側の issue の `field` 書式を固定する。
//
// フロントはタブ見出しのエラー件数を **添字付きの前方一致** で振り分けている
// (`web/src/features/combo/editorTabs.ts` の `steps[` / `steps.`)。★その前提は
// 「バックエンドが `steps[0].moveId` の形で返す」ことである。
// ⇒ 書式を変えると、エラーが基本情報タブへ誤計上され、直す欄の無いタブへ
//
//	利用者を誘導する(M24-04 SM-148)。★それでもテストは全部緑になる
//	——振り分け側のテストは同じ文字列を自分でハードコードしているためである。
//
// ★本テストと下の ERROR 版が、実サーバ側の出力を押さえる観測である。
//
//	★押さえている生産者＝`VAL-C08`(WARNING・本テスト) / `VAL-C09`("steps" 完全一致・本テスト)
//	  / `VAL-C12`(ERROR・下のテスト)。★「唯一」ではない——生産者ごとに要る。
func TestIssueFieldFormat_RecipeSideUsesIndexedPrefix(t *testing.T) {
	steps := []model.ComboStep{{StepOrder: 1, MoveID: ptrInt64(999)}} // 存在しない技
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())

	var got string
	for _, i := range r.Issues {
		if i.Code == validation.CodeC08MoveExists {
			got = i.Field
		}
	}
	if got == "" {
		t.Fatalf("C08 の issue が出ていない: %+v", r.Issues)
	}
	// ★フロントの前方一致(`steps[`)に当たる形であること。
	if !strings.HasPrefix(got, "steps[") {
		t.Errorf("field = %q。フロントの振り分け(editorTabs.ts の `steps[` 前方一致)に"+
			"当たらない書式である。⇒ レシピ側のエラーが基本情報タブへ誤計上される", got)
	}
	// ★VAL-C09 は添字を持たない素の "steps" である。
	//   ★こちらは前方一致ではなく完全一致集合(RECIPE_TAB_FIELDS)の側で拾われる。
	empty := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), nil, false, "h", newDeps())
	for _, i := range empty.Issues {
		if i.Code == validation.CodeC09RecipeNotEmpty && i.Field != "steps" {
			t.Errorf("C09 の field = %q, want \"steps\"", i.Field)
		}
	}
}

// ★★TestIssueFieldFormat_… の ERROR 版(レビュー 2 回目 中-A)。
//
// ★★フロントは severity が error の issue しか数えない
// (`web/src/features/combo/editorTabs.ts` の countErrorsByTab)。
// ⇒ **添字付き前方一致 `steps[` を本番で実際に通るのは VAL-C12(ERROR)だけである。**
// VAL-C08 は WARNING、VAL-C03 の starterMoveId も WARNING であり、いずれも捨てられる。
// ★C08 と C12 は同じ書式文字列を使うが**別の呼び出し箇所**であり、片方だけ変えられる。
// ⇒ 生産者ごとに押さえる。
func TestIssueFieldFormat_RushVariantErrorUsesIndexedPrefix(t *testing.T) {
	// moveID=51 はラッシュ版だが元技 99 がキャラに存在しない → VAL-C12(ERROR)
	steps := []model.ComboStep{{StepOrder: 1, MoveID: ptrInt64(51)}}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())

	var got validation.ValidationIssue
	for _, i := range r.Issues {
		if i.Code == validation.CodeC12RushVariantOriginal {
			got = i
		}
	}
	if got.Code == "" {
		t.Fatalf("C12 の issue が出ていない: %+v", r.Issues)
	}
	if got.Severity != validation.SeverityError {
		t.Errorf("C12 の severity = %q, want error。★WARNING だとフロントの件数計上から"+
			"捨てられ、タブ見出しの指し示しが働かない", got.Severity)
	}
	if !strings.HasPrefix(got.Field, "steps[") {
		t.Errorf("field = %q。フロントの振り分け(editorTabs.ts の `steps[` 前方一致)に"+
			"当たらない書式である。⇒ レシピ側のエラーが基本情報タブへ誤計上される", got.Field)
	}
}

// ===========================================================================
// VAL-C10: knockdown_advantage 範囲
// ===========================================================================

func TestC10_KnockdownRange_OK(t *testing.T) {
	for _, v := range []int{-100, 0, 30, 600, -600} {
		combo := validBaseCombo()
		combo.KnockdownAdvantage = ptrInt(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if hasIssue(r, validation.CodeC10KnockdownRange, validation.SeverityWarning) {
			t.Errorf("v=%d: unexpected C10 warning: %+v", v, r.Issues)
		}
	}
}

func TestC10_KnockdownRange_OutOfRange(t *testing.T) {
	for _, v := range []int{-601, 601, 9999} {
		combo := validBaseCombo()
		combo.KnockdownAdvantage = ptrInt(v)
		r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
		if !hasIssue(r, validation.CodeC10KnockdownRange, validation.SeverityWarning) {
			t.Errorf("v=%d: expected C10 warning, got: %+v", v, r.Issues)
		}
	}
}

// ===========================================================================
// VAL-C11: 起き攻め BOOLEAN 整合性
// ===========================================================================

// M16-03: uniform 適用。uses_dr=true の行があるのに同 (attack,tech) の uses_dr=false 行が無い → 不整合。
// throw_meaty だけでなく shimmy / strike_meaty でも WARNING を出す(全 attack_type 一様適用)。
func TestC11_OkiDR_RequiresNoGauge(t *testing.T) {
	cases := []struct {
		name       string
		attackType string
	}{
		{"throw_meaty", model.OkiAttackTypeThrowMeaty},
		{"shimmy", model.OkiAttackTypeShimmy},
		{"strike_meaty", model.OkiAttackTypeStrikeMeaty},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			combo := validBaseCombo()
			combo.OkiOptions = []model.OkiOption{
				{AttackType: tc.attackType, TechType: model.OkiTechTypeNeutral, UsesDR: true}, // DR のみ
			}
			r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
			if !hasIssue(r, validation.CodeC11OkiConsistency, validation.SeverityWarning) {
				t.Errorf("expected C11 warning for %s, got: %+v", tc.name, r.Issues)
			}
		})
	}
}

func TestC11_OkiDR_WithNoGauge_OK(t *testing.T) {
	combo := validBaseCombo()
	combo.OkiOptions = []model.OkiOption{
		{AttackType: model.OkiAttackTypeShimmy, TechType: model.OkiTechTypeNeutral, UsesDR: false},
		{AttackType: model.OkiAttackTypeShimmy, TechType: model.OkiTechTypeNeutral, UsesDR: true},
	}
	r := validation.ValidateComboForCreate(context.Background(), combo, validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC11OkiConsistency, validation.SeverityWarning) {
		t.Errorf("unexpected C11 warning: %+v", r.Issues)
	}
}

// ===========================================================================
// VAL-C12: ラッシュ版 original_move_id 検証
// ===========================================================================

func TestC12_RushVariant_OriginalExists_OK(t *testing.T) {
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(50)}, // 50 = ラッシュ版、元技 10 が存在
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
	if hasIssue(r, validation.CodeC12RushVariantOriginal, validation.SeverityError) {
		t.Errorf("unexpected C12 error: %+v", r.Issues)
	}
}

func TestC12_RushVariant_OriginalNotFound(t *testing.T) {
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(51)}, // 51 = ラッシュ版、元技 99 はキャラに存在しない
	}
	r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
	if !hasIssue(r, validation.CodeC12RushVariantOriginal, validation.SeverityError) {
		t.Errorf("expected C12 error, got: %+v", r.Issues)
	}
}

// TestC12_RushVariant_OriginalIDIsNull は `original_move_id` が NULL の分岐を固定する。
//
// ★★上の 2 本が通っているのは別の分岐である。
//
//	OriginalExists_OK … FindOriginalMoveID が非 nil ＋ ExistsForCharacter が true
//	OriginalNotFound  … FindOriginalMoveID が非 nil ＋ ExistsForCharacter が false
//	⇒ **`origID == nil` の分岐(combo.go:496-499)は 1 本も通っていなかった**(2026-09-11 実測)。
//
// ★★★これが M35-03 が直した 3 件目の実害の経路である。
//
//	`ingrid` 2 / `lily` 1 / `mai` 1 のラッシュ版は `original_move_code` が dangling で
//	`moves.original_move_id` が NULL だった。★入力面には出ていたので編集画面から選べたが、
//	保存すると VAL-C12 が ERROR を立て、service.go:368 の HasError() で巻き戻されて
//	**400 になっていた。** ⇒ 3 件の実害のうち、唯一利用者にエラーとして見えていた経路である。
//
// ★実装は正しい。本テストが守るのはデータ側の前提である——
//
//	「`original_move_id` が解けていないラッシュ版は保存できない」。
//	⇒ ここが緑のまま保存が 400 になるときに疑うべきは規則ではなく seed である。
//	  同じ趣旨の床を setplay 側にも置いてある
//	  (internal/service/setplay/service_test.go の TestService_RushTargetRequiresResolvedOriginal)。
func TestC12_RushVariant_OriginalIDIsNull(t *testing.T) {
	// ★解決できる側と解決できない側を対で見る(SUPP-001 §5.5.2 (3))。
	//   維持側だけを見ていると、条件を広く当てすぎても検出できない。
	for _, tc := range []struct {
		name      string
		moveID    int64
		wantError bool
	}{
		{"original_move_id が NULL → ERROR", 52, true},
		{"元技が解ける → ERROR にしない", 50, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			steps := []model.ComboStep{{StepOrder: 1, MoveID: ptrInt64(tc.moveID)}}
			r := validation.ValidateComboForCreate(context.Background(), validBaseCombo(), steps, false, "h", newDeps())
			got := hasIssue(r, validation.CodeC12RushVariantOriginal, validation.SeverityError)
			if got != tc.wantError {
				t.Errorf("C12 の ERROR = %v, want %v。issues=%+v", got, tc.wantError, r.Issues)
			}
		})
	}
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func hasIssue(r validation.ValidationResult, code string, sev validation.Severity) bool {
	for _, i := range r.Issues {
		if i.Code == code && i.Severity == sev {
			return true
		}
	}
	return false
}

// ===========================================================================
// VAL-C15: 本登録の必須項目
//
// ★M27-02b / P4M-009。開発者確定 2026-09-03。
//
// ★★★【M38-01・射程 3】欄は 2 度動いた。**現在は 2 欄である。**
//
//	着手前:     damage / knockdownAdvantage / driveGaugeConsumed / saGaugeConsumed
//	追補1 まで: damage / knockdownAdvantage / driveAvailableAtStart / saAvailableAtStart
//	**現在:     damage / knockdownAdvantage の 2 欄だけ**(2026-09-18 追補2)
//
// ★★★開始残量 2 欄は**任意**になった(2026-09-18 開発者裁定)。⇒ 空欄＝NULL＝「不問」。
// ★追補1 までは「4 欄の器を保ちつつ、開始残量 2 欄の present() は常に真」という形で
// あった(サーバからは「不問を選んだ null」と「空のまま送られた null」を区別できない
// ため)。⇒ 区別を諦めたので器ごと畳んだ。
// ⇒ 本節の「1 欄ずつ落とす」テストが見るのは damage / knockdownAdvantage の 2 件、
// 開始残量 2 欄は TestC15_StartGauges_NilIsNotError が**逆向きに**固定する。
// ===========================================================================

func TestC15_RequiredFields_AllPresent_OK(t *testing.T) {
	r := validation.ValidateComboForCreate(
		context.Background(), validBaseCombo(), validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC15RequiredField, validation.SeverityError) {
		t.Errorf("すべて埋まっているのに C15 が出た: %+v", r.Issues)
	}
}

// ★★1 欄ずつ落として、その欄だけが咎められることを見る。
//
//	⇒ まとめて 1 つの条件になっていないことを固定する。
//
// ★★★【M38-01】消費ゲージ 2 欄を外した。⇒ 必須から外れ、空でも保存できる
// (TestC15_ConsumedGauges_NilIsNotError が対照として固定する)。
// ★★★開始残量 2 欄をここへ足さないこと —— 追補2 で**必須そのものから外れた**。
// ⇒ 足すと「不問」の保存が 400 で落ちる。
func TestC15_RequiredFields_EachMissing_IsError(t *testing.T) {
	cases := []struct {
		name  string
		blank func(*model.Combo)
		field string
	}{
		{"damage", func(c *model.Combo) { c.Damage = nil }, "damage"},
		{"knockdownAdvantage", func(c *model.Combo) { c.KnockdownAdvantage = nil }, "knockdownAdvantage"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			combo := validBaseCombo()
			tc.blank(combo)
			r := validation.ValidateComboForCreate(
				context.Background(), combo, validBaseSteps(), false, "h", newDeps())

			var got []string
			for _, is := range r.Issues {
				if is.Code == validation.CodeC15RequiredField {
					got = append(got, is.Field)
				}
			}
			if len(got) != 1 || got[0] != tc.field {
				t.Fatalf("C15 の field = %v, want [%s] (issues=%+v)", got, tc.field, r.Issues)
			}
		})
	}
}

// ★★仮登録では掛からない(SUPP-001 §2.1)。**本サブの中心の 1 つである**——
//
//	仮登録は「未確定でも保存できる」入口であり、ここを塞ぐと存在意義が消える。
func TestC15_RequiredFields_Draft_Skipped(t *testing.T) {
	combo := validBaseCombo()
	combo.Damage = nil
	combo.KnockdownAdvantage = nil
	combo.DriveAvailableAtStart = nil
	combo.SAAvailableAtStart = nil

	r := validation.ValidateComboForCreate(
		context.Background(), combo, validBaseSteps(), true, "h", newDeps())
	if hasIssue(r, validation.CodeC15RequiredField, validation.SeverityError) {
		t.Errorf("仮登録なのに C15 が出た: %+v", r.Issues)
	}
}

// ★★★【M38-01・射程 3 / 追補2】**開始残量 2 欄が nil でも VAL-C15 は出ない。**
//
// ★★主張は追補1 から変わらないが、**理由が変わった**。
//
//	追補1 まで: 必須だが「判定できない」ため咎めない(「不問を選んだ null」と
//	           「空のまま送られた null」がサーバからは同じ値に見える。DES-006 §5)。
//	           ⇒ 実効的な門はフロント(requiredPublished.ts)に在った。
//	**現在:     そもそも必須ではない**(2026-09-18 開発者裁定)。⇒ 門ごと消えた。
//
// ★★★requiredPublishedFields へ同 2 欄を戻すと本テストが赤くなる。
// ⇒ その変更は**空欄＝「不問」の保存そのものを 400 で落とす**。
// ★同 2 欄の**値域**は VAL-C04 / VAL-C05 が引き続き見る(どちらも nil はスキップ)。
func TestC15_StartGauges_NilIsNotError(t *testing.T) {
	combo := validBaseCombo()
	combo.DriveAvailableAtStart = nil
	combo.SAAvailableAtStart = nil

	r := validation.ValidateComboForCreate(
		context.Background(), combo, validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC15RequiredField, validation.SeverityError) {
		t.Errorf("開始残量が nil(=不問)なのに C15 が出た。⇒ 不問の保存が落ちる: %+v", r.Issues)
	}
}

// ★★★【M38-01・射程 3】外した 2 欄(消費ゲージ)は**空でも本登録できる**。
//
// ★「必須を外した」ことの対照である。★値域の担保は 1 つも外していない ——
// 同 2 欄は DES-006 §2.5 が「範囲 VAL 非連動」と定めており、BE にも zod にも
// 範囲 ERROR が元から無い(担保は UI クランプのみ)。
func TestC15_ConsumedGauges_NilIsNotError(t *testing.T) {
	combo := validBaseCombo()
	combo.DriveGaugeConsumed = nil
	combo.SAGaugeConsumed = nil

	r := validation.ValidateComboForCreate(
		context.Background(), combo, validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC15RequiredField, validation.SeverityError) {
		t.Errorf("消費ゲージは必須から外れたのに C15 が出た: %+v", r.Issues)
	}
}

// ★値域は見ない。0 や負値でも「入っている」なら通る
//
//	——範囲は C04/C05/C10/C13 の持ち場であり、消費ゲージ 2 欄に至っては
//	DES-006 §2.5 が「範囲 VAL 非連動」と定めている。
func TestC15_RequiredFields_ZeroAndNegative_AreFilled(t *testing.T) {
	combo := validBaseCombo()
	combo.Damage = ptrInt(0)
	combo.KnockdownAdvantage = ptrInt(-10)
	combo.DriveGaugeConsumed = ptrFloat(0)
	combo.SAGaugeConsumed = ptrInt(0)

	r := validation.ValidateComboForCreate(
		context.Background(), combo, validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC15RequiredField, validation.SeverityError) {
		t.Errorf("0 / 負値は未入力ではない: %+v", r.Issues)
	}
}
