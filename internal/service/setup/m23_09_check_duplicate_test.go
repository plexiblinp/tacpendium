package setup_test

// ★M23-09: セットプレイの保存前重複チェックのサービス層テスト。
//
// ★★判定は M23-05 のものをそのまま呼んでいる——削除済み側は VAL-S07 と同じ
// FindDeletedDuplicateRefsInCombo、生きた側は VAL-S04 と同じ述語の共有実装である。
// ⇒ ここで守りたいのは「保存の前から、同じものが同じ母集団で見えていること」。
//
// ★誤検知の対照(別の親コンボ / レシピ違い)を必ず置く。親コンボが違えば同一レシピは
// 正当であり、返してしまうと利用者は正しい登録を止められたと感じる。

import (
	"context"
	"testing"

	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// checkSetupInputOf は CreateSetupInput と同じ内容の保存前チェック入力を組む。
func checkSetupInputOf(in setupsvc.CreateSetupInput) setupsvc.CheckSetupDuplicateInput {
	return setupsvc.CheckSetupDuplicateInput{
		CharacterID: in.CharacterID,
		Steps:       in.Steps,
	}
}

func setupDeletedIDs(result *setupsvc.CheckSetupDuplicateResult) []int64 {
	ids := make([]int64, 0, len(result.DeletedDuplicates))
	for _, r := range result.DeletedDuplicates {
		ids = append(ids, r.ID)
	}
	return ids
}

func setupAliveIDs(result *setupsvc.CheckSetupDuplicateResult) []int64 {
	ids := make([]int64, 0, len(result.Duplicates))
	for _, r := range result.Duplicates {
		ids = append(ids, r.ID)
	}
	return ids
}

// ---------------------------------------------------------------------------
// §5.1-5: 同一親コンボの削除済みの一致を返す
// ---------------------------------------------------------------------------

func TestCheckSetupDuplicate_ReturnsDeletedMatch(t *testing.T) {
	env := newTestEnv(t)

	input := validSetupInput(t, env.db)
	trashedID := createAndTrashSetup(t, env.svc, env.comboID, input)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(input))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if got := setupDeletedIDs(result); len(got) != 1 || got[0] != trashedID {
		t.Errorf("deletedDuplicates = %v, want [%d]", got, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-2: 生きた側と削除済み側を別のキーで返す
// ---------------------------------------------------------------------------

func TestCheckSetupDuplicate_SeparatesAliveAndDeleted(t *testing.T) {
	env := newTestEnv(t)

	input := validSetupInput(t, env.db)
	trashedID := createAndTrashSetup(t, env.svc, env.comboID, input)
	// ★VAL-S04 は削除済みを候補に入れないため、同じレシピを作り直せる。
	aliveID := createSetupOK(t, env.svc, env.comboID, input)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(input))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if got := setupAliveIDs(result); len(got) != 1 || got[0] != aliveID {
		t.Errorf("duplicates(生きた側) = %v, want [%d]", got, aliveID)
	}
	if got := setupDeletedIDs(result); len(got) != 1 || got[0] != trashedID {
		t.Errorf("deletedDuplicates = %v, want [%d]", got, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-6: ★別の親コンボの一致を返さない(VAL-S04 と同じ意味論)
// ---------------------------------------------------------------------------

func TestCheckSetupDuplicate_ExcludesOtherParentCombo(t *testing.T) {
	env := newTestEnv(t)

	other := secondComboID(t, env.db)
	input := validSetupInput(t, env.db)
	// ★別の親コンボのゴミ箱へ入れる。
	createAndTrashSetup(t, env.svc, other, input)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(input))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if got := setupDeletedIDs(result); len(got) != 0 {
		t.Errorf("★別の親コンボの一致を返している: %v", got)
	}
	if got := setupAliveIDs(result); len(got) != 0 {
		t.Errorf("★別の親コンボの一致を生きた側に返している: %v", got)
	}
}

// ★★破壊確認 1 の受け皿(セットプレイ側)。生きた行が削除済み側へ紛れ込むのを検出する。
func TestCheckSetupDuplicate_DeletedSide_ExcludesAliveRows(t *testing.T) {
	env := newTestEnv(t)

	input := validSetupInput(t, env.db)
	aliveID := createSetupOK(t, env.svc, env.comboID, input)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(input))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if got := setupDeletedIDs(result); len(got) != 0 {
		t.Errorf("★生きた行が削除済み側に載っている: %v (aliveID=%d)", got, aliveID)
	}
}

// ★レシピが違えば返さない。
func TestCheckSetupDuplicate_NotFiredWhenRecipeDiffers(t *testing.T) {
	env := newTestEnv(t)

	trashed := validSetupInput(t, env.db)
	createAndTrashSetup(t, env.svc, env.comboID, trashed)

	other := validSetupInput(t, env.db)
	other.Steps = other.Steps[:1]

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(other))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if got := setupDeletedIDs(result); len(got) != 0 {
		t.Errorf("★レシピが違うのに返している: %v", got)
	}
}

// ---------------------------------------------------------------------------
// §5.1-7: 応答が人が読める文字列を持つ
// ---------------------------------------------------------------------------

func TestCheckSetupDuplicate_CarriesHumanReadableName(t *testing.T) {
	env := newTestEnv(t)

	input := validSetupInput(t, env.db)
	name := "投げ後の重ね"
	input.Name = &name
	createAndTrashSetup(t, env.svc, env.comboID, input)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), env.comboID, checkSetupInputOf(input))
	if err != nil {
		t.Fatalf("check setup duplicate: %v", err)
	}
	if len(result.DeletedDuplicates) != 1 {
		t.Fatalf("deletedDuplicates = %+v, want 1 件", result.DeletedDuplicates)
	}
	got := result.DeletedDuplicates[0].Name
	if got == nil || *got != name {
		t.Errorf("name = %v, want %q", got, name)
	}
}

// ---------------------------------------------------------------------------
// ★存在しない親コンボでも 0 件で返る(エラーにしない＝§4.2-3 の規律)
// ---------------------------------------------------------------------------

func TestCheckSetupDuplicate_UnknownComboReturnsEmpty(t *testing.T) {
	env := newTestEnv(t)

	result, err := env.svc.CheckSetupDuplicate(context.Background(), 999999, checkSetupInputOf(validSetupInput(t, env.db)))
	if err != nil {
		t.Fatalf("★存在しない親コンボでエラーを返している: %v", err)
	}
	if len(result.Duplicates) != 0 || len(result.DeletedDuplicates) != 0 {
		t.Errorf("want 双方 0 件, got %+v", result)
	}
}
