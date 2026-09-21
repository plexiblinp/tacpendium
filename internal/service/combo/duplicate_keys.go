// Package combo はコンボのビジネスロジック(CRUD、重複判定、編集方式分離、楽観的排他、
// 論理削除、recipe_hash 計算)を集約する。
//
// 設計参照: SUPP-001 §2.1 / §2.2、HANDOVER-001 §3.1、DES-006 §2、M1-03 指示書。
package combo

import (
	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/recipehash"
)

// DuplicateCheckFields は SUPP-001 §2.2 で定義される重複判定キー集合。
//
// CHANGE-006 反映: counter_type → hit_type
// M37-07 反映: starter_meaty を追加し 7 → 8 要素へ(開発者裁定 D-874)。
//
// ★★★本定数は「正本の写し」であって、切り替えスイッチではない(2026-09-14・M37-07 の実査)。
//
//	着手前の SUPP-001 §2.2 は「将来 modifiers を比較から外す等の変更が必要になった場合、
//	リスト定数を 1 箇所修正するだけで挙動を切り替えられる構造とする」と書いていたが、
//	`grep -rn "DuplicateCheckFields"` の結果は**この定義行のみの 1 件**であり、
//	判定ロジックからも自身のテストからも参照されていない。
//	⇒ **本定数を書き換えても挙動は 1 バイトも変わらない。**
//
// ★実際のキーは次の箇所に分かれて持たれている。キーを増減するときは全部を直すこと:
//   - repository/combo.DuplicateKey と 2 つの WHERE ビルダ
//     (FindActiveByDuplicateKey / duplicateKeyPredicates)
//   - service/validation.DuplicateKey とその組み立て(VAL-C02)
//   - service/combo.CheckDuplicateInput / DuplicateInfo / duplicateKeyOf / ComboDuplicateAdapter
//   - api/combo.CheckDuplicateRequest / DuplicateInfoResponse
//   - service/comboio の CSV 取込 事前重複判定
//   - フロントの ComboKeyFields / hasKeyChanges / extractKeyFields(PUT / PATCH の振り分け)
var DuplicateCheckFields = []string{
	"character_id",
	"recipe_hash", // combo_steps の (move_id, modifiers) シーケンスから計算
	"starter_move_id",
	"position",
	"opponent_stance",
	"hit_type",
	"opponent_size",
	"starter_meaty", // M37-07: 始動技を持続当てしたか(NOT NULL・bool)
}

// CalcRecipeHash は combo_steps 列を正規化して SHA-256 ハッシュの hex 文字列を返す。
//
// 計算そのものは internal/recipehash が持つ唯一の実装に委ねる。アルゴリズムの逐語は
// recipehash.Calc の godoc を参照すること。
//
// ★本関数を残してあるのは、combo ドメインの語彙(combo_steps)で呼べる入口を保つためである。
// 中身を書かないこと —— 書くとセットプレイ側と黙ってずれる(M24-09b 以前は 3 実装が独立しており、
// 片方だけ変更してもコンパイルが通った)。
func CalcRecipeHash(steps []model.ComboStep) string {
	return recipehash.CalcCombo(steps)
}
