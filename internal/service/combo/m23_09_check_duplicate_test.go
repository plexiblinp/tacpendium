package combo_test

// ★M23-09: 保存前の重複チェック(POST /api/combos/check-duplicate)のサービス層テスト。
//
// ★★本サブは判定を書いていない。母集団は VAL-C14 と同一の 1 本
// (findDeletedDuplicateRefsByKey)を通る。⇒ ここで守りたいのは
// 「保存の前から、VAL-C14 とまったく同じものが見えていること」である。
//
// ★「出ること」より「出すぎないこと」のほうが壊れやすい(M23-05 と同じ較正)。
// 発火 1 本に対し、非発火の対照を 3 つ(旧行 / 仮登録 / 生存行)置いてある。

import (
	"context"
	"testing"

	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

// checkInputOf は CreateInput と同じ内容の保存前チェック入力を組む。
//
// ★同じ入力から組むこと。片方だけ手で書くと、判定キーが 1 項ずれても
// テストが「一致しなかった」を正常として通してしまう。
func checkInputOf(in combosvc.CreateInput) combosvc.CheckDuplicateInput {
	return combosvc.CheckDuplicateInput{
		CharacterID:    in.CharacterID,
		StarterMoveID:  in.StarterMoveID,
		Position:       in.Position,
		OpponentStance: in.OpponentStance,
		HitType:        in.HitType,
		OpponentSize:   in.OpponentSize,
		Steps:          in.Steps,
	}
}

func deletedIDs(result *combosvc.CheckDuplicateResult) []int64 {
	ids := make([]int64, 0, len(result.DeletedDuplicates))
	for _, r := range result.DeletedDuplicates {
		ids = append(ids, r.ID)
	}
	return ids
}

func aliveIDs(result *combosvc.CheckDuplicateResult) []int64 {
	ids := make([]int64, 0, len(result.Duplicates))
	for _, d := range result.Duplicates {
		ids = append(ids, d.ID)
	}
	return ids
}

// ---------------------------------------------------------------------------
// §5.1-1: 削除済みの一致を返す
// ---------------------------------------------------------------------------

func TestCheckDuplicate_ReturnsDeletedMatch(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	trashedID := createAndTrash(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := deletedIDs(result); len(got) != 1 || got[0] != trashedID {
		t.Errorf("deletedDuplicates = %v, want [%d]", got, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-2: 生きた側と削除済み側を別のキーで返す
// ---------------------------------------------------------------------------

func TestCheckDuplicate_SeparatesAliveAndDeleted(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	trashedID := createAndTrash(t, svc, input)
	// ★VAL-C02 は削除済み行を候補に入れないため、同じものを作り直せる(M23-RESEARCH-01 H-2)。
	aliveID := createPublished(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := aliveIDs(result); len(got) != 1 || got[0] != aliveID {
		t.Errorf("duplicates(生きた側) = %v, want [%d]", got, aliveID)
	}
	if got := deletedIDs(result); len(got) != 1 || got[0] != trashedID {
		t.Errorf("deletedDuplicates = %v, want [%d]", got, trashedID)
	}
}

// ---------------------------------------------------------------------------
// §5.1-3: 母集団が VAL-C14 と一致している(旧行・仮登録・生存行を返さない)
// ---------------------------------------------------------------------------

// ★★PUT が積んだ旧行(superseded_by_combo_id IS NOT NULL)は返さない。
// 旧行はゴミ箱の一覧に出ず利用者が復元できない——対処できない候補を選ばせない。
func TestCheckDuplicate_DeletedSide_ExcludesSupersededOldRow(t *testing.T) {
	db, svc := newSvc(t)

	base := validRyuInput(t, db)
	oldID := createPublished(t, svc, base)

	changed := base
	changed.Position = ptr("corner_self")
	if _, r, err := svc.UpdateWithKeyChange(context.Background(), oldID, 1, changed); err != nil || r.HasError() {
		t.Fatalf("put: err=%v issues=%+v", err, r.Issues)
	}

	var mark *int64
	if err := db.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&mark); err != nil {
		t.Fatalf("select superseded: %v", err)
	}
	if mark == nil {
		t.Fatalf("前提が崩れている: PUT の旧行に superseded の印が付いていない")
	}

	// base(mid_screen)で保存前チェックすると、旧行がキー一致するが返ってはならない。
	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(base))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := deletedIDs(result); len(got) != 0 {
		t.Errorf("★PUT の旧行を返している: %v", got)
	}
}

// ★仮登録は母集団に入らない(is_draft = 0)。試案を作るたびに候補へ出てはならない。
func TestCheckDuplicate_DeletedSide_ExcludesDraftRows(t *testing.T) {
	db, svc := newSvc(t)

	draft := validRyuInput(t, db)
	draft.IsDraft = true
	createAndTrash(t, svc, draft)

	published := validRyuInput(t, db)
	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(published))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := deletedIDs(result); len(got) != 0 {
		t.Errorf("★削除済みの仮登録を返している: %v", got)
	}
}

// ★★破壊確認 1 の受け皿(指示書 §5.3-1)。母集団から deleted_at IS NOT NULL を外すと
// 生存行が削除済み側へ紛れ込む。それを検出するのは本テストである。
// ★フロントテストは応答を stub するため、この種のずれを原理的に検出できない。
func TestCheckDuplicate_DeletedSide_ExcludesAliveRows(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	aliveID := createPublished(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := deletedIDs(result); len(got) != 0 {
		t.Errorf("★生きた行が削除済み側に載っている: %v (aliveID=%d)", got, aliveID)
	}
	if got := aliveIDs(result); len(got) != 1 || got[0] != aliveID {
		t.Errorf("生きた側 = %v, want [%d]", got, aliveID)
	}
}

// ★レシピが違えば返さない(SQL の絞り込みだけで済ませていないことの確認)。
func TestCheckDuplicate_DeletedSide_NotFiredWhenRecipeDiffers(t *testing.T) {
	db, svc := newSvc(t)

	trashed := validRyuInput(t, db)
	createAndTrash(t, svc, trashed)

	other := validRyuInput(t, db)
	other.Steps = other.Steps[:1] // レシピだけ変える(判定キー 7 項は同じ)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(other))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := deletedIDs(result); len(got) != 0 {
		t.Errorf("★レシピが違うのに返している: %v", got)
	}
}

// ---------------------------------------------------------------------------
// §5.1-4: 既存の応答のキーと意味が変わっていない
// ---------------------------------------------------------------------------

// ★生きた側は従来どおり削除済みを見ない(M2-02 のまま)。
func TestCheckDuplicate_AliveSide_StillExcludesDeleted(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	createAndTrash(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := aliveIDs(result); len(got) != 0 {
		t.Errorf("★生きた側にゴミ箱の行が載っている: %v", got)
	}
}

// ★excludeComboId は従来どおり生きた側にだけ効く。
func TestCheckDuplicate_ExcludeComboID_StillAppliesToAliveSide(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	aliveID := createPublished(t, svc, input)

	in := checkInputOf(input)
	in.ExcludeComboID = &aliveID
	result, err := svc.CheckDuplicate(context.Background(), in)
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if got := aliveIDs(result); len(got) != 0 {
		t.Errorf("★excludeComboId が効いていない: %v", got)
	}
}

// ---------------------------------------------------------------------------
// §5.1-7: 応答が人が読める文字列を持つ
// ---------------------------------------------------------------------------

// ★★id だけでは「どれを復元するのか」を利用者が判断できない(§4.1-3)。
func TestCheckDuplicate_DeletedSide_CarriesHumanReadableMemo(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	input.Memo = ptr("画面端 中央運び")
	createAndTrash(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if len(result.DeletedDuplicates) != 1 {
		t.Fatalf("deletedDuplicates = %+v, want 1 件", result.DeletedDuplicates)
	}
	memo := result.DeletedDuplicates[0].Memo
	if memo == nil || *memo != "画面端 中央運び" {
		t.Errorf("memo = %v, want %q", memo, "画面端 中央運び")
	}
}

// ★生きた側にも memo を載せた(§3.3-4)。既存キーは 1 つも変えていない。
func TestCheckDuplicate_AliveSide_CarriesHumanReadableMemo(t *testing.T) {
	db, svc := newSvc(t)

	input := validRyuInput(t, db)
	input.Memo = ptr("生きているほう")
	createPublished(t, svc, input)

	result, err := svc.CheckDuplicate(context.Background(), checkInputOf(input))
	if err != nil {
		t.Fatalf("check duplicate: %v", err)
	}
	if len(result.Duplicates) != 1 {
		t.Fatalf("duplicates = %+v, want 1 件", result.Duplicates)
	}
	memo := result.Duplicates[0].Memo
	if memo == nil || *memo != "生きているほう" {
		t.Errorf("memo = %v, want %q", memo, "生きているほう")
	}
}
