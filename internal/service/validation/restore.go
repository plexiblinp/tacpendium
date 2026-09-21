package validation

// 復元(ゴミ箱からの戻し)に固有のバリデーション。M23-04 で新設。
//
// 設計参照:
//   - 指示書 M23-04 §4.1(復元は止めない)/ §4.7(VAL-R01 / VAL-R02)
//   - DES-006 §1.1(バリデーションは非ブロッキング、例外はブロッキング)
//
// ★★本パッケージの復元向け検証は、種類が ERROR のものも含めて復元を中止させない。
// これは DES-006 §1.1 の「例外はブロッキング」に対する明示的な例外である
// (M23-overview §4.1 / D-463)——落とすと利用者は取り返す手段を失い、ゴミ箱が
// 安全網でなくなる。★後から「ERROR なのに止めていない」を不具合として直さないこと。
// 設計書側への反映は設計卓が CHANGE-124 で行う。

import (
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// 復元時バリデーションの VAL-ID 定数(M23-04 §4.7)。
//
// VAL-R は復元(Restore)の接頭辞であり、採番は設計卓が行った。
// ★VAL-R03 以降は未採番である。欠番ではなく「まだ載せていない」状態である。
const (
	// CodeR01LinkedSetupsDeleted は、復元するコンボが紐付けているセットプレイに
	// 論理削除されたものが 1 件でも含まれることを表す(WARNING)。
	CodeR01LinkedSetupsDeleted = "VAL-R01"
	// CodeR02AllParentCombosDeleted は、復元するセットプレイが紐付いている親コンボが
	// すべて論理削除されていることを表す(WARNING)。
	CodeR02AllParentCombosDeleted = "VAL-R02"
)

// ValidateR01LinkedSetupsDeleted は VAL-R01 を判定する(M23-04 §4.7)。
//
// deletedSetups は「復元するコンボに紐付いており、かつ論理削除されている」
// セットプレイの一覧。★1 件でも含まれれば発火する。
//
// ★VAL-R02 と条件が非対称であることに注意。こちらが「1 件でも」なのは、コンボ詳細の
// セットプレイ欄が期待より少なく見えるためである。★揃えないこと(D-494)。
func ValidateR01LinkedSetupsDeleted(r *ValidationResult, deletedSetups []model.SetupRef) {
	if len(deletedSetups) == 0 {
		return
	}
	refs := make([]any, len(deletedSetups))
	for i, s := range deletedSetups {
		refs[i] = s
	}
	r.AddWarningWithDetails(CodeR01LinkedSetupsDeleted, "",
		fmt.Sprintf("紐付いているセットプレイ %d 件がゴミ箱にあります。復元してもコンボ詳細には表示されません", len(deletedSetups)),
		map[string]any{"setups": refs})
}

// ValidateR02AllParentCombosDeleted は VAL-R02 を判定する(M23-04 §4.7)。
//
// allParents は論理削除済みも含めた親コンボの全件(検証用の母集団)。
// liveParentComboIDs はそのうち生存しているものの id。
//
// ★母集団を id ではなく ComboRef で受けるのは、警告の details へ「どれが問題か」を
// memo 付きで載せるためである(§4.3-3)。VAL-R01 が SetupRef{id, name} を返すのと対称。
//
// ★「すべて削除済み」で発火する。セットプレイは親コンボ経由でしか画面に出ないため
// (VAL-S05＝親に紐付かない単独作成は禁止)、生きた親が 1 つでも残っていればそこから
// 見える。0 個のときだけ「戻したのにどこにも出ない」になる。
//
// ★親が 1 件も無い(allParents が空)場合は発火しない。これは「全部削除済み」
// ではなく「紐付けが既に失われている」状態であり(M23-02 §4.2-6＝同サブ適用前に
// 論理削除されたもの)、別の話である。0 件と「全部削除済み」を取り違えない。
func ValidateR02AllParentCombosDeleted(r *ValidationResult, allParents []model.ComboRef, liveParentComboIDs []int64) {
	if len(allParents) == 0 {
		return
	}
	if len(liveParentComboIDs) > 0 {
		return
	}
	refs := make([]any, len(allParents))
	for i, c := range allParents {
		refs[i] = c
	}
	r.AddWarningWithDetails(CodeR02AllParentCombosDeleted, "",
		fmt.Sprintf("紐付いている親コンボ %d 件がすべてゴミ箱にあります。復元しても画面には表示されません", len(allParents)),
		map[string]any{"combos": refs})
}
