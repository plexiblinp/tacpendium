package combo_test

// ★★M29-02 §2.1: 一覧の既定上限 100 件が「黙って」効いていたことの回帰。
//
// List は filter.Limit が未指定のとき既定 100 件へ、1000 超を 1000 へ
// 「黙ってクランプ」する(repository.go の limit 補正)。返ってくるのは行だけで
// あり、切り捨てたかどうかはどこにも現れない。
//
// ★★その結果、画面は「全 100 件をエクスポート」と表示して 100 件だけを出し、
//   利用者はそれが全件だと信じてしまう —— これは FR307(破綻の自動断定をしない)の
//   逆向き、すなわち「成功の自動断定」である。
//
// ★本テストが守るのは「100 という値」ではなく、**Count が上限を掛けずに数える**
//   ことである。⇒ total > len(items) が「切り捨てた」の唯一の観測になる。
//   Count が List と同じクランプを踏むようになったら、観測は静かに死ぬ。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// ★既定上限をちょうど 1 件超える件数。
//
// ★★「上限の 2 倍」で試さないこと(チェックリスト §6-2)。境界の 1 件で
//
//	検出できるかが要点であり、2 倍で試すと off-by-one を素通しする。
const listDefaultLimit = 100

func insertNCombos(t *testing.T, db *sql.DB, repo comborepo.Repository, n int) {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	withTx(t, db, func(tx *sql.Tx) {
		for i := 0; i < n; i++ {
			if _, err := repo.InsertCombo(ctx, tx, &model.Combo{
				CharacterID:   1,
				StarterMoveID: ptrInt64(move1),
				Version:       1,
			}); err != nil {
				t.Fatalf("InsertCombo(%d): %v", i, err)
			}
		}
	})
}

func TestCountIsNotClampedByListLimit(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	want := listDefaultLimit + 1 // ★境界 +1
	insertNCombos(t, db, repo, want)

	// List は既定上限で切り捨てる(挙動そのものは変えていない)。
	items, err := repo.List(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != listDefaultLimit {
		t.Fatalf("List の件数 = %d, want %d(既定上限で切り捨てられるはず)",
			len(items), listDefaultLimit)
	}

	// ★Count は上限を掛けずに数える。ここが「切り捨てた」の観測である。
	total, err := repo.Count(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if total != want {
		t.Fatalf("Count = %d, want %d(上限を掛けずに数えるはず)", total, want)
	}

	// ★★この不等式が成立しないと、切り捨ては観測不能なまま残る。
	if !(total > len(items)) {
		t.Fatal("★total > len(items) が成立しない ⇒ 切り捨てを検出できない")
	}
}

func TestCountAppliesTheSameFilterAsList(t *testing.T) {
	// ★★WHERE を List と共有していることの主張(buildListWhere)。
	//   条件を 2 か所に書くと、片方だけ直したときに「一覧の件数」と「総数」が
	//   静かにずれる。ずれても両方とも正常に見えるため、他のテストは緑のまま通る。
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	insertNCombos(t, db, repo, 3)

	// 存在しないキャラで絞れば、List も Count も 0 でなければならない。
	other := int64(2)
	items, err := repo.List(ctx, comborepo.ListFilter{CharacterID: &other})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	total, err := repo.Count(ctx, comborepo.ListFilter{CharacterID: &other})
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if total != len(items) {
		t.Fatalf("絞り込みが List と Count でずれている: Count=%d List=%d", total, len(items))
	}

	// 絞らなければ両方 3 件(上限未満なので一致する)。
	items, err = repo.List(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	total, err = repo.Count(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if total != 3 || len(items) != 3 {
		t.Fatalf("Count=%d List=%d, want 3/3", total, len(items))
	}
}

func TestCountExcludesSoftDeletedLikeList(t *testing.T) {
	// ★論理削除の扱いが List と一致していることの主張。
	//   ここがずれると「ゴミ箱の行を数えて『切り捨てた』と言う」偽陽性になる。
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	insertNCombos(t, db, repo, 2)
	if _, err := db.ExecContext(ctx,
		`UPDATE combos SET deleted_at = '2020-01-01 00:00:00' WHERE id = (SELECT MIN(id) FROM combos)`,
	); err != nil {
		t.Fatalf("soft delete: %v", err)
	}

	total, err := repo.Count(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if total != 1 {
		t.Fatalf("Count = %d, want 1(論理削除は数えない)", total)
	}
}
