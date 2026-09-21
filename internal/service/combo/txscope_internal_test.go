package combo

import (
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// M24-11: txScopedDeps が重複判定を実際に tx 経由へ差し替えていることを固定する。
//
// ★★なぜ内部テスト(package combo)なのか———————————————————————
// 本パッケージのテストは通例 combo_test(外部テストパッケージ)に置かれている。
// ここだけ内部に置くのは、破壊確認 3(「検証に *sql.Tx ではなく *sql.DB を渡す」)を
// 観測可能にするためである。
//
// ★★経緯を残す———————————————————————————————————————————
// 当初 TxScopedDeps_BindsTxToDuplicateChecker(外部テスト)だけを置いていたが、
// 同テストはアダプタを自分で組み立てて WithTx を呼ぶため、txScopedDeps を壊しても
// 緑のままだった。⇒ 破壊確認 3 が空振りしていた(playbook §4.32＝その壊し方で
// 観測が動くか)。配線そのものを通る経路をここで固定する。
//
// ★2 本は役割が違う。どちらも要る:
//   - 外部テスト: 束ねが効いていれば未コミット行が見える(振る舞いの主張)
//   - 本テスト  : 配線が実際に束ねている(経路の主張)
func TestTxScopedDeps_ReplacesComboRepoWithTxBoundAdapter(t *testing.T) {
	original := &ComboDuplicateAdapter{}
	s := &service{validDeps: validation.Dependencies{ComboRepo: original}}

	tx := &sql.Tx{} // ★実行しないため、ゼロ値で足りる(同一性だけを見る)

	got := s.txScopedDeps(tx)

	bound, ok := got.ComboRepo.(*ComboDuplicateAdapter)
	if !ok {
		t.Fatalf("ComboRepo の型が変わっている: %T", got.ComboRepo)
	}
	if bound.Tx != tx {
		t.Error("txScopedDeps が tx を束ねていない。判定が *sql.DB 直読みのままになる" +
			"(D-360＝tx を取るならその tx を読みにも使うこと)")
	}
	if original.Tx != nil {
		t.Error("元のアダプタが書き換えられている。WithTx は複製を返すこと" +
			"(共有インスタンスを書き換えると、他の呼び出しへ漏れる)")
	}
	if bound.Repo != original.Repo {
		t.Error("複製で Repo が失われている")
	}
}
