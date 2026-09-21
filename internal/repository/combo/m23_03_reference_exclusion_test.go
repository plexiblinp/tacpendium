package combo_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M23-03: 参照側の deleted_at 除外(combos 側)。
//
// ★本ファイルの 1 本目は「塞いでいないこと」を固定する否定形テストである。
// 6 か所のうち #1 だけは意図的に述語を持たず、塞ぐと完全削除が壊れる。
// 通常操作のテストは全部緑のまま通るため、ここでしか気づけない。

// insertM2303Combo は本ファイル専用のコンボを 1 件作って id を返す。
func insertM2303Combo(t *testing.T, db *sql.DB, repo comborepo.Repository) int64 {
	t.Helper()
	ctx := context.Background()
	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		newID, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		id = newID
	})
	return id
}

func softDeleteM2303Combo(t *testing.T, db *sql.DB, repo comborepo.Repository, id int64) {
	t.Helper()
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(context.Background(), tx, id); err != nil {
			t.Fatalf("SoftDelete: %v", err)
		}
	})
}

// 指示書 §5-1 / §4.1: #1 は削除済みの行を返し続ける(★否定形。塞いでいないことを固定する)。
//
// ★対になるのは internal/service/combo/service_test.go の TestService_PermanentDelete_OK
// (指示書 §5-2)。#1 に述語を足すと、全テストのうちその 2 本だけが赤くなる(実測済み)。
// ⇒ 向こうを差し替えるときは、この対が失われないことを確認すること。
// 片方だけになると「塞ぐと完全削除が壊れる」を検出する実 DB の経路が静かに消える。
func TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	id := insertM2303Combo(t, db, repo)
	softDeleteM2303Combo(t, db, repo, id)

	got, err := repo.FindByIDAllowDeleted(ctx, id)
	if err != nil {
		t.Fatalf("FindByIDAllowDeleted は削除済み行を返し続ける必要がある(M23-03 §4.1): %v", err)
	}
	if got == nil || got.ID != id {
		t.Fatalf("FindByIDAllowDeleted = %v, want id=%d", got, id)
	}
	if got.DeletedAt == nil {
		t.Fatalf("DeletedAt が nil。論理削除された行が返っていない")
	}

	// 対照: 通常の FindByID は同じ行を返さない(除外は効いている)。
	if _, err := repo.FindByID(ctx, id); !errors.Is(err, comborepo.ErrNotFound) {
		t.Fatalf("FindByID(削除済み) err = %v, want ErrNotFound", err)
	}
}

// 指示書 §5-3 / §4.2: #2 は削除済みの行を返さない(setups 側の #5 と対で書くこと)。
func TestM2303_GetRecipeCache_ExcludesSoftDeletedCombo(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	id := insertM2303Combo(t, db, repo)
	if err := repo.UpdateRecipeCache(ctx, id, `{"1":"弱P"}`); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}

	// 生存中は引ける(塞ぎすぎていないことの対照)。
	cache, err := repo.GetRecipeCache(ctx, id)
	if err != nil {
		t.Fatalf("GetRecipeCache(生存): %v", err)
	}
	if cache == nil || *cache != `{"1":"弱P"}` {
		t.Fatalf("GetRecipeCache(生存) = %v, want キャッシュ本体", cache)
	}

	softDeleteM2303Combo(t, db, repo, id)

	if _, err := repo.GetRecipeCache(ctx, id); !errors.Is(err, comborepo.ErrNotFound) {
		t.Fatalf("GetRecipeCache(削除済み) err = %v, want ErrNotFound", err)
	}
}
