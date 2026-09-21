package setup

import (
	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/recipehash"
)

// CalcSetupRecipeHash は setup_steps 列を正規化して SHA-256 ハッシュの hex 文字列を返す。
//
// 計算そのものは internal/recipehash が持つ唯一の実装に委ねる。アルゴリズムの逐語は
// recipehash.Calc の godoc を参照すること。combo 側の CalcRecipeHash と同じ計算であり、
// 同じレシピからは同じ値が出る(recipehash の golden 対照が両入口で固定している)。
//
// ★中身を書かないこと —— 書くとコンボ側と黙ってずれる。
func CalcSetupRecipeHash(steps []model.SetupStep) string {
	return recipehash.CalcSetup(steps)
}
