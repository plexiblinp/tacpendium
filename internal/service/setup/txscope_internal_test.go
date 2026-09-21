package setup

import (
	"context"
	"database/sql"
	"testing"
)

// M24-13 §4.6: txScopedValidDeps が VAL-S04 の判定を実際に tx 経由へ差し替えている
// ことを固定する。★形は M24-11 の combo/txscope_internal_test.go を踏襲している。
//
// ★★なぜ内部テスト(package setup)なのか———————————————————————
// 本パッケージのテストは通例 setup_test(外部テストパッケージ)に置かれている。
// ここだけ内部に置くのは、「判定に *sql.Tx ではなく *sql.DB を渡す」壊し方を
// 観測可能にするためである。
//
// ★2 本は役割が違う。どちらも要る:
//   - 外部テスト(val_s04_race_test.go): 束ねが効いていれば未コミット行が見える(振る舞い)
//   - 本テスト                        : 配線が実際に束ねている(経路)
func TestTxScopedValidDeps_ReplacesSetupRepoWithTxBoundAdapter(t *testing.T) {
	original := &SetupDuplicateAdapter{}
	s := &service{validDeps: ValidationDeps{SetupRepo: original}}

	tx := &sql.Tx{} // ★実行しないため、ゼロ値で足りる(同一性だけを見る)

	got := s.txScopedValidDeps(context.Background(), tx)

	bound, ok := got.SetupRepo.(*SetupDuplicateAdapter)
	if !ok {
		t.Fatalf("SetupRepo の型が変わっている: %T", got.SetupRepo)
	}
	if bound.Tx != tx {
		t.Error("txScopedValidDeps が tx を束ねていない。VAL-S04 の判定が *sql.DB 直読みの" +
			"ままになる(D-360＝tx を取るならその tx を読みにも使うこと)")
	}
	if original.Tx != nil {
		t.Error("元のアダプタが書き換えられている。WithTx は複製を返すこと" +
			"(共有インスタンスを書き換えると、他の呼び出しへ漏れる)")
	}
	if bound.Repo != original.Repo {
		t.Error("複製で Repo が失われている")
	}
}
