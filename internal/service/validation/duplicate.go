package validation

// 削除済み行と再登録の衝突に関するバリデーション。M23-05 で新設。
//
// 設計参照:
//   - 指示書 M23-05 §4.1(4 件の 2×2)/ §4.2(母集団)/ §4.6(応答と見せ方)
//   - DES-006 §2.3(deleted_at IS NULL が在る理由)
//
// ★★本ファイルの検証は登録・復元を止めない。どれも WARNING である(M23-05 §4.1-1)。
// VAL-C02 が ERROR で「同じものは作らせない」を守るのに対し、こちらは
// 「判定の候補集合の外に同じものが居る」ことを告げるだけである——落とすと
// 利用者は作るすべを失う。★後から「重複なのに止めていない」を不具合として直さないこと。
//
// ★★VAL-C02 の述語・母集団・判定内容は本サブで一切変えていない。外すと PUT が
// 自分の消した旧行に衝突して、あらゆる編集が重複エラーで落ちる(DES-006 §2.3)。

import (
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// 削除済み行との衝突に関する VAL-ID 定数(M23-05 §4.1)。採番は設計卓が行った。
const (
	// CodeC14DuplicateInTrash は、登録しようとしたコンボと重複判定キー + レシピが
	// 一致する論理削除済みのコンボが在ることを表す(WARNING)。
	// ★POST /api/combos でのみ走る。PUT では走らせない(M23-05 §4.5-1)。
	CodeC14DuplicateInTrash = "VAL-C14"
	// CodeR03DuplicateAliveCombo は、復元するコンボと重複判定キー + レシピが一致する
	// 生きたコンボが在ることを表す(WARNING)。
	CodeR03DuplicateAliveCombo = "VAL-R03"
)

// MaxDuplicateRefsInDetails は警告の details へ載せる参照の上限(M23-05 §9.2)。
//
// ★推測: 上限を切り、超過分は件数だけ伝えると仮定した。指示書 §9.2 が製造判断へ
// 委ねている項目であり、暫定案は「上限を切り『他 N 件』を伝える」である(§11-2)。
// 実データでは 1 対 1 が 3 組であり、多数一致は現実には起きていない。
const MaxDuplicateRefsInDetails = 5

// DuplicateComboRef は重複候補 1 件分の、判定と表示に要る材料(M23-05 §4.4)。
//
// ★RecipeHash を持つのは、SQL で絞った候補をサービス層でハッシュ比較するためである
// (M23-RESEARCH-01 H-3＝recipe_hash は列ではなくサービス層の計算値)。
type DuplicateComboRef struct {
	ID         int64
	Memo       *string
	RecipeHash string
}

// ValidateC14DuplicateInTrash は VAL-C14 を判定する(M23-05 §4.1)。
//
// candidates は「ゴミ箱に居り、判定キー 7 項が一致し、PUT が積んだ旧行ではない」候補。
// ★M37-07 で 6 項 → 7 項になった(starter_meaty を追加)。
// 母集団の絞り込みはリポジトリ層が担い(FindDeletedByDuplicateKey)、ここでは
// レシピハッシュの一致だけを見る——VAL-C02 と同じ 2 段構造である(§4.1-2)。
func ValidateC14DuplicateInTrash(r *ValidationResult, newComboRecipeHash string, candidates []DuplicateComboRef) {
	matched := matchByRecipeHash(newComboRecipeHash, candidates)
	if len(matched) == 0 {
		return
	}
	r.AddWarningWithDetails(CodeC14DuplicateInTrash, "",
		fmt.Sprintf("同じ内容のコンボ %d 件がゴミ箱にもあります(登録は成功しています)", len(matched)),
		comboRefDetails(matched))
}

// ValidateR03DuplicateAliveCombo は VAL-R03 を判定する(M23-05 §4.1)。
//
// candidates は「生きており、判定キー 7 項が一致し、復元対象自身ではない」候補。
// ★M37-07 で 6 項 → 7 項になった(starter_meaty を追加)。
// ★復元対象自身の除外はリポジトリ層(FindActiveByDuplicateKeyExcludingTx)が担う。
// 復元は deleted_at を NULL に戻してから検証するため(M23-04 §4.2)、除外を落とすと
// 必ず 1 件ヒットする(§4.3)。
func ValidateR03DuplicateAliveCombo(r *ValidationResult, restoredRecipeHash string, candidates []DuplicateComboRef) {
	matched := matchByRecipeHash(restoredRecipeHash, candidates)
	if len(matched) == 0 {
		return
	}
	r.AddWarningWithDetails(CodeR03DuplicateAliveCombo, "",
		fmt.Sprintf("同じ内容のコンボ %d 件が既に登録されています。復元したので重複して並んでいます", len(matched)),
		comboRefDetails(matched))
}

// MatchDuplicatesByRecipeHash は matchByRecipeHash の公開点(M23-09 §4.1-1)。
//
// ★保存前チェック(POST /api/combos/check-duplicate)が、VAL-C14 とまったく同じ絞り込みを
// 通すために要る。★新しい判定を書かないこと——本関数は既存の matchByRecipeHash へ
// 委譲するだけであり、VAL-C14 / VAL-R03 と 1 バイトも違わない結果を返す(M23-09 §2.2)。
func MatchDuplicatesByRecipeHash(hash string, candidates []DuplicateComboRef) []DuplicateComboRef {
	return matchByRecipeHash(hash, candidates)
}

// ToComboRefs は候補を model.ComboRef へ写す(M23-09 §4.1-3)。
//
// ★comboRefDetails が details 用に行っていた写像をそのまま切り出したものである。
// 保存前チェックの応答も同じ形を返す(D-417＝新しい見せ方を作らない)。
// ★上限(MaxDuplicateRefsInDetails)はここでは掛けない——あれは警告 details 専用であり、
// ダイアログは「該当が複数のとき選ばせる」ため全件が要る(M23-09 §4.3-2)。
func ToComboRefs(refs []DuplicateComboRef) []model.ComboRef {
	out := make([]model.ComboRef, len(refs))
	for i, c := range refs {
		out[i] = model.ComboRef{ID: c.ID, Memo: c.Memo}
	}
	return out
}

// matchByRecipeHash はレシピハッシュが一致する候補だけを残す。
func matchByRecipeHash(hash string, candidates []DuplicateComboRef) []DuplicateComboRef {
	matched := make([]DuplicateComboRef, 0, len(candidates))
	for _, c := range candidates {
		if c.RecipeHash == hash {
			matched = append(matched, c)
		}
	}
	return matched
}

// comboRefDetails は details.combos を組む(M23-05 §4.6)。
//
// ★形は M23-02 の 409 setup_in_use / M23-04 の VAL-R02 に揃える(D-417＝新しい見せ方を
// 作らない)。★totalCount は上限で切ったときに画面が総数を出せるようにするためであり、
// message 側にも総数が入っている(DES-002 §4.3 規則 2＝message は単体で成立させる)。
func comboRefDetails(matched []DuplicateComboRef) map[string]any {
	shown := matched
	if len(shown) > MaxDuplicateRefsInDetails {
		shown = shown[:MaxDuplicateRefsInDetails]
	}
	comboRefs := ToComboRefs(shown)
	refs := make([]any, len(comboRefs))
	for i, r := range comboRefs {
		refs[i] = r
	}
	return map[string]any{"combos": refs, "totalCount": len(matched)}
}

// SetupRefDetails は details.setups を組む(M23-05 §4.6)。VAL-S07 / VAL-R04 が使う。
//
// ★setup パッケージから呼ぶため export している。comboRefDetails と同じ規則で、
// 上限で切ったうえで totalCount に総数を入れる。
func SetupRefDetails(matched []model.SetupRef) map[string]any {
	shown := matched
	if len(shown) > MaxDuplicateRefsInDetails {
		shown = shown[:MaxDuplicateRefsInDetails]
	}
	refs := make([]any, len(shown))
	for i, s := range shown {
		refs[i] = s
	}
	return map[string]any{"setups": refs, "totalCount": len(matched)}
}
