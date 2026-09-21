package validation_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// M31-01 §5-4【破壊確認】SD-006 の連動を入れた後も VAL-C11 が鳴る経路が残るか
//
// ★★本サブ最大の落とし穴は「連動が入って警告が鳴らなくなった」を「直った」と
//   読むことである(指示書 §4.2 / チェックリスト §0.2)。
//   SD-006(ノーゲージ版 → DR 版へ連動)と VAL-C11(DR 版だけある → WARNING)は
//   向きが逆であり、連動を入れると「DR 版だけある」状態が生まれにくくなる。
//
// ★★実測の結論＝**VAL-C11 は実質死んでいない。**
//   理由は連動が **片方向** だからである(開発者は片方向しか求めていない
//   ＝`Memo_Someday.txt:366`)。⇒ 利用者が **ドライブラッシュ版を先に押す** だけで
//   「DR のみ」の状態が 1 クリックで作れ、そのまま保存すれば本 VAL が鳴る。
//
// ★★連動を **双方向** にすると、この経路が消えて VAL-C11 が実質死ぬ。
//   ⇒ 将来 双方向化を検討するときは、本 VAL の母集団が消えることを
//     設計卓へ請求してから決めること。**本テストはその歯止めである。**
//
// ★重大度・文言は 1 文字も変えていない(指示書 §3-2 / チェックリスト 3-4)。
// ===========================================================================

// 経路 1: エディタで DR 版を先に押した状態(連動は逆向きに働かないため到達可能)。
//
// ★フロント側の対照は ComboEditorBasicFields.test.tsx の
//
//	「★SD-006 (b) 逆向きは連動しない」である。あちらが「DR のみが作れる」ことを、
//	本テストが「その形が VAL-C11 に当たる」ことを示す。⇒ 2 つで 1 つの主張。
func TestM3101_C11_StillFires_WhenDROnly_ReachableFromEditor(t *testing.T) {
	for _, attack := range []string{
		model.OkiAttackTypeThrowMeaty,
		model.OkiAttackTypeShimmy,
		model.OkiAttackTypeStrikeMeaty,
	} {
		for _, tech := range []string{model.OkiTechTypeNeutral, model.OkiTechTypeBack} {
			combo := validBaseCombo()
			combo.OkiOptions = []model.OkiOption{
				{AttackType: attack, TechType: tech, UsesDR: true},
			}
			r := validation.ValidateComboForCreate(context.Background(), combo,
				validBaseSteps(), false, "h", newDeps())
			if !hasIssue(r, validation.CodeC11OkiConsistency, validation.SeverityWarning) {
				t.Errorf("VAL-C11 が鳴らない(%s / %s)。連動を双方向にした等で母集団が消えていないか: %+v",
					attack, tech, r.Issues)
			}
		}
	}
}

// 経路 2: 連動が入る前に保存された既存行を読み直した場合。
//
// ★連動はエディタの入力補助であり、既に DB に在る行には遡らない。
//
//	⇒ 既存データを開いて保存し直す限り、本 VAL は鳴り続ける。
func TestM3101_C11_StillFires_ForPreExistingRows(t *testing.T) {
	combo := validBaseCombo()
	// 「投げ重ね×その場受け身は対で在るが、シミー×後ろ受け身は DR だけ」という
	// 連動導入前にしか作れない形。
	combo.OkiOptions = []model.OkiOption{
		{AttackType: model.OkiAttackTypeThrowMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: false},
		{AttackType: model.OkiAttackTypeThrowMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: true},
		{AttackType: model.OkiAttackTypeShimmy, TechType: model.OkiTechTypeBack, UsesDR: true},
	}
	r := validation.ValidateComboForCreate(context.Background(), combo,
		validBaseSteps(), false, "h", newDeps())
	if !hasIssue(r, validation.CodeC11OkiConsistency, validation.SeverityWarning) {
		t.Errorf("既存行の形で VAL-C11 が鳴らない: %+v", r.Issues)
	}
}

// 経路 3: 連動が生む「対で付いている」形では鳴らない(退行の確認)。
//
// ★連動の目的はこれである——ノーゲージ版を付けた利用者が、
//
//	意図せず VAL-C11 に当たることが無くなる。
func TestM3101_C11_Silent_ForPairProducedByLinkage(t *testing.T) {
	combo := validBaseCombo()
	combo.OkiOptions = []model.OkiOption{
		{AttackType: model.OkiAttackTypeThrowMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: false},
		{AttackType: model.OkiAttackTypeThrowMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: true},
	}
	r := validation.ValidateComboForCreate(context.Background(), combo,
		validBaseSteps(), false, "h", newDeps())
	if hasIssue(r, validation.CodeC11OkiConsistency, validation.SeverityWarning) {
		t.Errorf("連動が生む対で VAL-C11 が鳴っている: %+v", r.Issues)
	}
}
