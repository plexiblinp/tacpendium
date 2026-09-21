package setup

// 保存前の重複チェック(M23-09 §4.1-2)。
//
// ★★判定ではなく問い合わせである。VAL コードを 1 つも発火させない——発火させるのは
// VAL-S04(CreateSetup 経路)と VAL-S07(CheckTrashDuplicateSetup)のままであり、
// 本ファイルはその母集団を保存の前から覗くだけである(M23-09 §2.2)。
//
// ★restore.go に置かなかったのは、これがゴミ箱の操作ではなく登録経路の付加価値だから
// である。ただし削除済み側の母集団は VAL-S07 と同一のものを共有している。

import (
	"context"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ---------------------------------------------------------------------------
// CheckSetupDuplicate(保存前チェック・M23-09 §4.1-2)
// ---------------------------------------------------------------------------

// CheckSetupDuplicate は保存前に同一親コンボの重複を返す。呼び出し規約と母集団は
// Service インタフェース側の godoc を参照。
//
// ★★VAL-S07 と同じ関数(FindDeletedDuplicateRefsInCombo)を呼んでいる。判定を書き直さない
// (M23-09 §2.2 / §3.3-1)。生きた側も VAL-S04 と同じ述語の共有実装を通る。
//
// ★CheckTrashDuplicateSetup と違い、失敗を握り潰さずエラーを返す。あちらは「登録は既に
// 成功しており巻き戻せない」文脈だが、こちらは保存の前であり、呼び出し側(画面)が
// 「チェックは失敗したが保存は続ける」を選べる(M23-09 §4.2-3)。
func (s *service) CheckSetupDuplicate(ctx context.Context, parentComboID int64, input CheckSetupDuplicateInput) (*CheckSetupDuplicateResult, error) {
	hash := CalcSetupRecipeHash(input.Steps)

	live, err := s.repo.FindLiveDuplicateRefsInCombo(ctx, parentComboID, input.CharacterID, hash)
	if err != nil {
		return nil, fmt.Errorf("find live duplicate refs: %w", err)
	}
	deleted, err := s.repo.FindDeletedDuplicateRefsInCombo(ctx, parentComboID, input.CharacterID, hash)
	if err != nil {
		return nil, fmt.Errorf("find deleted duplicate refs: %w", err)
	}

	// ★0 件でも nil ではなく空スライスにする。API 層が JSON の空配列として出すためである
	//   (M23-09 §4.1-1＝画面は length で分岐する)。
	if live == nil {
		live = make([]model.SetupRef, 0)
	}
	if deleted == nil {
		deleted = make([]model.SetupRef, 0)
	}
	return &CheckSetupDuplicateResult{Duplicates: live, DeletedDuplicates: deleted}, nil
}
