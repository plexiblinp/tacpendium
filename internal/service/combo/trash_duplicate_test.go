package combo_test

// ★M23-05: 削除済み行と再登録の衝突(VAL-C14)のサービス層テスト。
//
// ★★本サブは「出ること」より「出すぎないこと」のほうが壊れやすい(指示書 §5 前文)。
// 誤検知する警告は、無視される警告になる。⇒ 発火 1 本に対し、非発火の対照を
// 4 つ(レシピ違い / 旧行 / 仮登録 / PUT)置いてある。
//
// ★VAL-C02 の判定内容は本サブで変えていない。既存の service_test.go の
// TestService_Create_VAL_C02_* が緑のままであることがその担保である。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

// createAndTrash は本登録のコンボを作ってゴミ箱へ入れる(VAL-C14 の母集団を作る)。
func createAndTrash(t *testing.T, svc combosvc.Service, input combosvc.CreateInput) int64 {
	t.Helper()
	saved, result, err := svc.Create(context.Background(), input)
	if err != nil || result.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, result.Issues)
	}
	if err := svc.Delete(context.Background(), saved.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	return saved.ID
}

// createPublished は本登録のコンボを作って id を返す。
func createPublished(t *testing.T, svc combosvc.Service, input combosvc.CreateInput) int64 {
	t.Helper()
	saved, result, err := svc.Create(context.Background(), input)
	if err != nil || result.HasError() {
		t.Fatalf("create: err=%v issues=%+v", err, result.Issues)
	}
	return saved.ID
}

// issueByCode は指定コードの Issue を返す(無ければ nil)。
func issueByCode(issues []validation.ValidationIssue, code string) *validation.ValidationIssue {
	for i := range issues {
		if issues[i].Code == code {
			return &issues[i]
		}
	}
	return nil
}

// detailComboIDs は警告の details.combos に載っている id を取り出す。
func detailComboIDs(t *testing.T, issue *validation.ValidationIssue) []int64 {
	t.Helper()
	raw, ok := issue.Details["combos"]
	if !ok {
		t.Fatalf("details.combos が無い: %+v", issue.Details)
	}
	refs, ok := raw.([]any)
	if !ok {
		t.Fatalf("details.combos が []any でない: %T", raw)
	}
	ids := make([]int64, 0, len(refs))
	for _, r := range refs {
		ref, ok := r.(model.ComboRef)
		if !ok {
			t.Fatalf("details.combos の要素が model.ComboRef でない: %T", r)
		}
		ids = append(ids, ref.ID)
	}
	return ids
}

// comboIsAlive は combos.deleted_at が NULL かを返す(登録・復元が成立したかの実体確認)。
func comboIsAlive(t *testing.T, db *sql.DB, id int64) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL`, id).Scan(&n); err != nil {
		t.Fatalf("select alive: %v", err)
	}
	return n == 1
}

// ---------------------------------------------------------------------------
// §5.1-1: ゴミ箱に同じ判定キー + 同じレシピのコンボが在るとき VAL-C14 が返る
// ---------------------------------------------------------------------------

func TestCheckTrashDuplicate_VALC14_FiresWhenTrashHasSameCombo(t *testing.T) {
	db, svc := newSvc(t)

	trashedID := createAndTrash(t, svc, validRyuInput(t, db))
	// ★VAL-C02 は削除済み行を候補に入れないため、同じものを作り直せてしまう(H-2)。
	newID := createPublished(t, svc, validRyuInput(t, db))

	result := svc.CheckTrashDuplicate(context.Background(), newID)
	issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash)
	if issue == nil {
		t.Fatalf("VAL-C14 が返らない: %+v", result.Issues)
	}
	if issue.Severity != validation.SeverityWarning {
		t.Errorf("VAL-C14 は WARNING であるべき: %s", issue.Severity)
	}
	if ids := detailComboIDs(t, issue); len(ids) != 1 || ids[0] != trashedID {
		t.Errorf("details.combos = %v, want [%d]", ids, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-2: 判定キーは一致するがレシピが違うとき VAL-C14 が返らない(ハッシュ比較が効いている)
// ---------------------------------------------------------------------------

func TestCheckTrashDuplicate_VALC14_NotFiredWhenRecipeDiffers(t *testing.T) {
	db, svc := newSvc(t)

	createAndTrash(t, svc, validRyuInput(t, db))

	// キー 7 項(M37-07 で 6 → 7)は同一のまま、レシピだけ変える。
	// ★SQL は候補として拾うが、CalcRecipeHash が一致しないので警告にならない。
	//   ここが落ちるときは、レシピ比較を SQL の近似で済ませている疑いがある(§4.4)。
	other := validRyuInput(t, db)
	move3 := lookupMoveID(t, db, 1, "crouching_light_kick")
	other.Steps = append(other.Steps, model.ComboStep{StepOrder: 3, MoveID: &move3})
	newID := createPublished(t, svc, other)

	result := svc.CheckTrashDuplicate(context.Background(), newID)
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("レシピが違うのに VAL-C14 が返った: %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-3: ★★superseded_by_combo_id を持つ旧行は VAL-C14 の母集団に入らない(§4.2)
// ---------------------------------------------------------------------------

// ★★本テストが M23-05 の最重要ゲートの片方である。
// PUT は旧行を論理削除して新行を積むため、旧行はゴミ箱に居る。しかし旧行は
// ゴミ箱の一覧に出ず(M23-01)、利用者が復元できない。
// ⇒ 告げても対処できない警告になるため、母集団から除く。
//
// ★破壊確認(§5.5-1): FindDeletedByDuplicateKey から
//
//	`superseded_by_combo_id IS NULL` を外すと本テストが赤くなる。
func TestCheckTrashDuplicate_VALC14_ExcludesSupersededOldRow(t *testing.T) {
	db, svc := newSvc(t)

	// A(mid_screen)を作り、position を変える PUT を掛ける。
	// ⇒ A_old(mid_screen・削除済み・superseded 印つき) + A_new(corner_self)。
	original := validRyuInput(t, db)
	oldID := createPublished(t, svc, original)

	changed := validRyuInput(t, db)
	changed.Position = ptr("corner_self")
	if _, r, err := svc.UpdateWithKeyChange(context.Background(), oldID, 1, changed); err != nil || r.HasError() {
		t.Fatalf("put: err=%v issues=%+v", err, r.Issues)
	}

	var mark sql.NullInt64
	if err := db.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&mark); err != nil {
		t.Fatalf("select superseded: %v", err)
	}
	if !mark.Valid {
		t.Fatalf("前提が崩れている: PUT の旧行に superseded の印が付いていない")
	}

	// A_old と同じキー(mid_screen)+ 同じレシピで新規登録する。
	newID := createPublished(t, svc, validRyuInput(t, db))

	result := svc.CheckTrashDuplicate(context.Background(), newID)
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("PUT が積んだ旧行に対して VAL-C14 が返った(母集団から除けていない): %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-4: ★★PUT で VAL-C14 が走らない(§4.5-1)
// ---------------------------------------------------------------------------

// ★★もう片方の最重要ゲートである。走らせると編集のたびに警告が出る。
//
// ★経路で絞れていることの構造的な根拠は「CheckTrashDuplicate の呼び出し元が
//   POST /api/combos のハンドラ 1 か所しかない」ことであり、grep で確認できる。
//   本テストはサービス層から見た振る舞い側の主張である。

// 4a: キーを変える PUT。成功し、返る ValidationResult に VAL-C14 は含まれない。
func TestUpdateWithKeyChange_DoesNotEmitVALC14_KeyChanged(t *testing.T) {
	db, svc := newSvc(t)

	oldID := createPublished(t, svc, validRyuInput(t, db))

	changed := validRyuInput(t, db)
	changed.Position = ptr("corner_self")
	saved, result, err := svc.UpdateWithKeyChange(context.Background(), oldID, 1, changed)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if result.HasError() {
		t.Fatalf("put が検証で落ちた: %+v", result.Issues)
	}
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("PUT の応答に VAL-C14 が載った: %+v", issue)
	}
	if !comboIsAlive(t, db, saved.ID) {
		t.Errorf("PUT で作られた新行が生きていない")
	}
}

// 4b: キーを変えない PUT。
//
// ★この経路は M23-05 以前から VAL-C02(ERROR)で落ちる——旧行はまだ生きているため
//
//	自分自身が重複候補に当たる(service.go の既知コメント)。本サブはその挙動を変えない。
//	主張したいのは「そこへ VAL-C14 が足されていないこと」である。
func TestUpdateWithKeyChange_DoesNotEmitVALC14_KeyUnchanged(t *testing.T) {
	db, svc := newSvc(t)

	oldID := createPublished(t, svc, validRyuInput(t, db))

	same := validRyuInput(t, db)
	same.Memo = ptr("メモだけ変える")
	_, result, err := svc.UpdateWithKeyChange(context.Background(), oldID, 1, same)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("キー不変の PUT に VAL-C14 が載った: %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-5: 仮登録(is_draft = 1)の削除済み行は VAL-C14 の母集団に入らない(§3.3-4)
// ---------------------------------------------------------------------------

func TestCheckTrashDuplicate_VALC14_ExcludesDraftRows(t *testing.T) {
	db, svc := newSvc(t)

	draft := validRyuInput(t, db)
	draft.IsDraft = true
	createAndTrash(t, svc, draft)

	newID := createPublished(t, svc, validRyuInput(t, db))

	result := svc.CheckTrashDuplicate(context.Background(), newID)
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("仮登録の削除済み行に対して VAL-C14 が返った: %+v", issue)
	}
}

// ★対照: 仮登録を「作る」ときも判定しない。
// 「仮登録と本登録の間では重複判定は行わない」は既定の方針である(DES-006 §2.3)。
func TestCheckTrashDuplicate_VALC14_SkippedWhenCreatingDraft(t *testing.T) {
	db, svc := newSvc(t)

	createAndTrash(t, svc, validRyuInput(t, db))

	draft := validRyuInput(t, db)
	draft.IsDraft = true
	draftID := createPublished(t, svc, draft)

	result := svc.CheckTrashDuplicate(context.Background(), draftID)
	if issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash); issue != nil {
		t.Errorf("仮登録の作成で VAL-C14 が返った: %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-12: NULL を含む判定キーで一致が検出される(§4.4)
// ---------------------------------------------------------------------------

// ★NULL 同士を一致として扱えていないと、position 等が未設定のコンボが
// 1 件も検出されなくなる。SQL の三値論理で `col = NULL` が常に偽になるためである。
func TestCheckTrashDuplicate_VALC14_MatchesNullKeyFields(t *testing.T) {
	db, svc := newSvc(t)

	nullKey := func() combosvc.CreateInput {
		in := validRyuInput(t, db)
		in.Position = nil
		in.OpponentStance = nil
		in.HitType = nil
		in.OpponentSize = nil
		return in
	}

	trashedID := createAndTrash(t, svc, nullKey())
	newID := createPublished(t, svc, nullKey())

	result := svc.CheckTrashDuplicate(context.Background(), newID)
	issue := issueByCode(result.Issues, validation.CodeC14DuplicateInTrash)
	if issue == nil {
		t.Fatalf("NULL を含むキーで VAL-C14 が返らない: %+v", result.Issues)
	}
	if ids := detailComboIDs(t, issue); len(ids) != 1 || ids[0] != trashedID {
		t.Errorf("details.combos = %v, want [%d]", ids, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-11: VAL-C14 が返っても登録は成功している(§4.1-1)
// ---------------------------------------------------------------------------

func TestCheckTrashDuplicate_VALC14_DoesNotBlockCreate(t *testing.T) {
	db, svc := newSvc(t)

	createAndTrash(t, svc, validRyuInput(t, db))

	saved, result, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("VAL-C14 の状況で登録が落ちた: %+v", result.Issues)
	}
	if !comboIsAlive(t, db, saved.ID) {
		t.Fatalf("登録したコンボが生きていない")
	}

	warnings := svc.CheckTrashDuplicate(context.Background(), saved.ID)
	if issueByCode(warnings.Issues, validation.CodeC14DuplicateInTrash) == nil {
		t.Fatalf("前提が崩れている: VAL-C14 が返っていない")
	}
	if warnings.HasError() {
		t.Errorf("VAL-C14 は ERROR を含んではならない: %+v", warnings.Errors())
	}
}

// ---------------------------------------------------------------------------
// §5.1-6: 生きた重複が在るコンボを復元すると VAL-R03 が返る
// ---------------------------------------------------------------------------

func TestRestore_VALR03_FiresWhenAliveDuplicateExists(t *testing.T) {
	db, svc := newSvc(t)

	// 削除 → 同じものを再登録 → 復元 の順。どの操作も現在の実装では拒否されない
	// (M23-RESEARCH-01 H-2 / H-4)。⇒ 復元した時点で 2 件が並ぶ。
	trashedID := createAndTrash(t, svc, validRyuInput(t, db))
	aliveID := createPublished(t, svc, validRyuInput(t, db))

	result, err := svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	issue := issueByCode(result.Issues, validation.CodeR03DuplicateAliveCombo)
	if issue == nil {
		t.Fatalf("VAL-R03 が返らない: %+v", result.Issues)
	}
	if issue.Severity != validation.SeverityWarning {
		t.Errorf("VAL-R03 は WARNING であるべき: %s", issue.Severity)
	}

	ids := detailComboIDs(t, issue)
	if len(ids) != 1 || ids[0] != aliveID {
		t.Errorf("details.combos = %v, want [%d]", ids, aliveID)
	}
	// ★復元対象自身が混ざっていないこと(§4.3)。
	for _, id := range ids {
		if id == trashedID {
			t.Errorf("復元対象自身(%d)が details に載っている", trashedID)
		}
	}

	// §5.1-11: 警告が付いても復元は成功している(§4.1-1)。
	if !comboIsAlive(t, db, trashedID) {
		t.Errorf("VAL-R03 が付いたことで復元が取り消された")
	}
	if result.HasError() {
		t.Errorf("VAL-R03 は ERROR を含んではならない: %+v", result.Errors())
	}
}

// ---------------------------------------------------------------------------
// §5.1-7: ★★復元したコンボ自身は VAL-R03 の母集団に入らない(§4.3)
// ---------------------------------------------------------------------------

// ★★復元は deleted_at を NULL に戻してから検証する(M23-04 §4.2)。
// ⇒ 素直に書くと自分が自分の重複相手になり、あらゆる復元で必ず 1 件ヒットする。
//
// ★破壊確認(§5.5-2): FindActiveByDuplicateKeyExcludingTx から `id <> ?` を外すと
//
//	本テストが赤くなる。
func TestRestore_VALR03_ExcludesRestoredComboItself(t *testing.T) {
	db, svc := newSvc(t)

	// 重複相手を作らない。生きた同一キー・同一レシピのコンボは 1 件も無い状態で復元する。
	trashedID := createAndTrash(t, svc, validRyuInput(t, db))

	result, err := svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if issue := issueByCode(result.Issues, validation.CodeR03DuplicateAliveCombo); issue != nil {
		t.Errorf("重複相手が居ないのに VAL-R03 が返った(自分自身を数えている): %+v", issue)
	}
	if !comboIsAlive(t, db, trashedID) {
		t.Errorf("復元が成立していない")
	}
}

// ★対照: 仮登録の復元では VAL-R03 を走らせない(CheckTrashDuplicate と同じ理由)。
func TestRestore_VALR03_SkippedForDraft(t *testing.T) {
	db, svc := newSvc(t)

	draft := validRyuInput(t, db)
	draft.IsDraft = true
	trashedID := createAndTrash(t, svc, draft)

	// 生きた本登録の同一キー・同一レシピを置く。draft を復元しても判定しない。
	createPublished(t, svc, validRyuInput(t, db))

	result, err := svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if issue := issueByCode(result.Issues, validation.CodeR03DuplicateAliveCombo); issue != nil {
		t.Errorf("仮登録の復元で VAL-R03 が返った: %+v", issue)
	}
}
