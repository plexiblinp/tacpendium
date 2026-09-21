package move_test

import (
	"context"
	"testing"

	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// TestGetByID_IsDerived は M30-04 で getByIDSQL に足した is_derived の回帰ガードである。
//
// ★★これも「静かに壊れる」型を止めるためのテストである。MoveDetail は model.Move を
// 埋め込むため、SELECT 列から m.is_derived が落ちても IsDerived が常に false になるだけで、
// 型エラーにも実行時エラーにもならない。MoveDetailResponse へは露出していないので
// E2E からも見えない。⇒ 人が SQL を読む以外に気づく経路が無い。
//
// ★★陽性対照つきで測る —— true 行だけを見ると「常に true を返す実装」でも緑になる。
// ⇒ 同じ seed の中から false の行も引いて、そちらが false であることまで見る。
//
// ★本列は「単独入力の可否」ではない(DES-003 §3.3 errata③)。本テストが主張するのは
// DB の値がそのまま MoveDetail へ載ることだけである。
func TestGetByID_IsDerived(t *testing.T) {
	db := dbtest.Setup(t)
	repo := moverepo.New(db)
	ctx := context.Background()

	pick := func(t *testing.T, wantDerived int) int64 {
		t.Helper()
		var id int64
		const sql = `SELECT id FROM moves WHERE is_derived = ? ORDER BY id LIMIT 1`
		if err := db.QueryRowContext(ctx, sql, wantDerived).Scan(&id); err != nil {
			t.Fatalf("is_derived = %d の行を引けない(seed の前提が変わった可能性): %v", wantDerived, err)
		}
		return id
	}

	for _, tc := range []struct {
		name string
		flag int
		want bool
	}{
		{name: "is_derived=1 の行", flag: 1, want: true},
		{name: "is_derived=0 の行(陽性対照)", flag: 0, want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := pick(t, tc.flag)
			got, err := repo.GetByID(ctx, id)
			if err != nil {
				t.Fatalf("GetByID(%d): %v", id, err)
			}
			if got.IsDerived != tc.want {
				t.Errorf("move id=%d の IsDerived = %v, want %v", id, got.IsDerived, tc.want)
			}
			// ★列を 1 つ足したことで後続の列がずれていないことも見る
			// (位置対応の Scan なので、ずれても型が合えば黙って通る)。
			if got.ID != id {
				t.Errorf("ID = %d, want %d(列のずれの疑い)", got.ID, id)
			}
			if got.Code == "" {
				t.Errorf("Code が空である(列のずれの疑い)")
			}
		})
	}
}
