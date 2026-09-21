package movewarning

import (
	"slices"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

func ptrInt(v int) *int { return &v }

// hasCode は WarningCode スライスに目的の code が含まれるかを返す(テスト補助)。
func hasCode(codes []WarningCode, w WarningCode) bool {
	return slices.Contains(codes, w)
}

func TestDeriveStoredWarnings_TotalNull(t *testing.T) {
	t.Run("total_null は total==nil で付与", func(t *testing.T) {
		got := DeriveStoredWarnings([]StoredMove{{Total: nil, Category: model.MoveCategoryNormal}})
		if !hasCode(got[0], WarnTotalNull) {
			t.Errorf("total nil should flag total_null, got %v", got[0])
		}
	})
	t.Run("total ありなら total_null は付かない", func(t *testing.T) {
		got := DeriveStoredWarnings([]StoredMove{{Total: ptrInt(40), Category: model.MoveCategoryNormal}})
		if hasCode(got[0], WarnTotalNull) {
			t.Errorf("non-nil total should not flag total_null, got %v", got[0])
		}
	})
}

func TestDeriveStoredWarnings_ExtraThrow(t *testing.T) {
	// キャラ内の通常投げ 3 件目以降に extra_throw を付与する。
	moves := []StoredMove{
		{Total: ptrInt(1), Category: model.MoveCategoryThrow}, // 1 件目
		{Total: ptrInt(1), Category: model.MoveCategoryThrow}, // 2 件目
		{Total: ptrInt(1), Category: model.MoveCategoryThrow}, // 3 件目 → 要確認
		{Total: ptrInt(1), Category: model.MoveCategoryThrow}, // 4 件目 → 要確認
	}
	got := DeriveStoredWarnings(moves)
	if hasCode(got[0], WarnExtraThrow) || hasCode(got[1], WarnExtraThrow) {
		t.Error("1st/2nd throw should not flag extra_throw")
	}
	if !hasCode(got[2], WarnExtraThrow) || !hasCode(got[3], WarnExtraThrow) {
		t.Error("3rd/4th throw should flag extra_throw")
	}
}

func TestDeriveStoredWarnings_ExtraThrowPerCharacter(t *testing.T) {
	// 複数キャラ混在でも extra_throw はキャラ単位で独立採番される。
	moves := []StoredMove{
		{CharacterID: 1, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch1: 1
		{CharacterID: 2, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch2: 1
		{CharacterID: 1, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch1: 2
		{CharacterID: 2, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch2: 2
		{CharacterID: 1, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch1: 3 → 要確認
		{CharacterID: 2, Total: ptrInt(1), Category: model.MoveCategoryThrow}, // ch2: 3 → 要確認
	}
	got := DeriveStoredWarnings(moves)
	for _, i := range []int{0, 1, 2, 3} {
		if hasCode(got[i], WarnExtraThrow) {
			t.Errorf("idx %d (各キャラ 1〜2 件目) should not flag extra_throw", i)
		}
	}
	for _, i := range []int{4, 5} {
		if !hasCode(got[i], WarnExtraThrow) {
			t.Errorf("idx %d (各キャラ 3 件目) should flag extra_throw", i)
		}
	}
}

func TestDeriveStoredWarnings_ThrowCountIgnoresNonThrow(t *testing.T) {
	// 非 throw 行は throw カウントに影響しない。
	moves := []StoredMove{
		{Total: ptrInt(1), Category: model.MoveCategoryThrow},  // 1
		{Total: ptrInt(1), Category: model.MoveCategoryNormal}, // カウント対象外
		{Total: ptrInt(1), Category: model.MoveCategoryThrow},  // 2
		{Total: ptrInt(1), Category: model.MoveCategoryThrow},  // 3 → 要確認
	}
	got := DeriveStoredWarnings(moves)
	if hasCode(got[2], WarnExtraThrow) {
		t.Error("2nd throw (idx 2) should not flag extra_throw")
	}
	if !hasCode(got[3], WarnExtraThrow) {
		t.Error("3rd throw (idx 3) should flag extra_throw")
	}
}

func TestDeriveStoredWarnings_EmptyAndShape(t *testing.T) {
	// 要確認なしの行は nil ではなく空スライス、返り値は入力と同順・同要素数。
	moves := []StoredMove{
		{Total: ptrInt(40), Category: model.MoveCategoryNormal},
	}
	got := DeriveStoredWarnings(moves)
	if len(got) != 1 {
		t.Fatalf("expected 1 row, got %d", len(got))
	}
	if got[0] == nil {
		t.Error("clean row should be empty slice, not nil")
	}
	if len(got[0]) != 0 {
		t.Errorf("clean row should have no warnings, got %v", got[0])
	}
}
