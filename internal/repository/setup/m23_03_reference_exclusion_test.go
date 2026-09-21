package setup_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M23-03: 参照側の deleted_at 除外(setups 側 / #5・#6)。
//
// ★#6 の 2 本(表示用 Live / 検証用 AllowDeleted)は必ず対で書く。
// 片方だけでは「関数を分けた意味」を主張できない。

func softDeleteM2303Combo(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	cRepo := comborepo.New(db)
	withTx(t, db, func(tx *sql.Tx) {
		if err := cRepo.SoftDelete(context.Background(), tx, comboID); err != nil {
			t.Fatalf("combo SoftDelete: %v", err)
		}
	})
}

func restoreM2303Combo(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	cRepo := comborepo.New(db)
	withTx(t, db, func(tx *sql.Tx) {
		if err := cRepo.Restore(context.Background(), tx, comboID); err != nil {
			t.Fatalf("combo Restore: %v", err)
		}
	})
}

// 指示書 §5-3 / §4.2: #5 は削除済みの行を返さない(combos 側の #2 と対)。
func TestM2303_SetupGetRecipeCache_ExcludesSoftDeletedSetup(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "hadoken_light")

	if err := repo.UpdateRecipeCache(ctx, setupID, `{"1":"弱P > 弱波動"}`); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}
	cache, err := repo.GetRecipeCache(ctx, setupID)
	if err != nil {
		t.Fatalf("GetRecipeCache(生存): %v", err)
	}
	if cache == nil {
		t.Fatalf("GetRecipeCache(生存) = nil, want キャッシュ本体")
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, setupID); err != nil {
			t.Fatalf("SoftDelete: %v", err)
		}
	})

	if _, err := repo.GetRecipeCache(ctx, setupID); !errors.Is(err, setuprepo.ErrNotFound) {
		t.Fatalf("GetRecipeCache(削除済み) err = %v, want ErrNotFound", err)
	}
}

// 指示書 §5-6 / §4.5-3: 表示用は削除済みのコンボを返さない。
// 指示書 §5-7 / §4.5-3: 検証用は削除済みのコンボを返し続ける。
//
// ★★1 本の中で対にしてある。片方が壊れれば必ずここで落ちる。
func TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboA := createCombo(t, db)
	comboB := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboA, "standing_light_punch", "hadoken_light")
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.InsertComboSetup(ctx, tx, comboB, setupID); err != nil {
			t.Fatalf("InsertComboSetup(B): %v", err)
		}
	})

	assertIDs := func(label string, got []int64, want []int64) {
		t.Helper()
		if len(got) != len(want) {
			t.Fatalf("%s = %v, want %v", label, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("%s = %v, want %v", label, got, want)
			}
		}
	}

	// 前提: どちらの関数も生存中は同じ集合を返す。
	live, err := repo.FindLiveComboIDsBySetupID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindLiveComboIDsBySetupID: %v", err)
	}
	assertIDs("Live(削除前)", live, []int64{comboA, comboB})

	all, err := repo.FindComboIDsBySetupIDAllowDeleted(ctx, setupID)
	if err != nil {
		t.Fatalf("FindComboIDsBySetupIDAllowDeleted: %v", err)
	}
	assertIDs("AllowDeleted(削除前)", all, []int64{comboA, comboB})

	softDeleteM2303Combo(t, db, comboA)

	// §5-6: 表示用からは消える。
	live, err = repo.FindLiveComboIDsBySetupID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindLiveComboIDsBySetupID(削除後): %v", err)
	}
	assertIDs("Live(削除後)", live, []int64{comboB})

	// §5-7: 検証用には残り続ける(★ここが分割の意味そのもの)。
	all, err = repo.FindComboIDsBySetupIDAllowDeleted(ctx, setupID)
	if err != nil {
		t.Fatalf("FindComboIDsBySetupIDAllowDeleted(削除後): %v", err)
	}
	assertIDs("AllowDeleted(削除後)", all, []int64{comboA, comboB})

	// 復元したら表示用にも戻る(対で確認する)。
	restoreM2303Combo(t, db, comboA)
	live, err = repo.FindLiveComboIDsBySetupID(ctx, setupID)
	if err != nil {
		t.Fatalf("FindLiveComboIDsBySetupID(復元後): %v", err)
	}
	assertIDs("Live(復元後)", live, []int64{comboA, comboB})
}

// 複数版も表示用である(単数版と同じ扱いになっていること)。
func TestM2303_FindLiveComboIDsBySetupIDs_ExcludesSoftDeletedCombo(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboA := createCombo(t, db)
	comboB := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboA, "standing_light_punch", "hadoken_light")
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.InsertComboSetup(ctx, tx, comboB, setupID); err != nil {
			t.Fatalf("InsertComboSetup(B): %v", err)
		}
	})

	softDeleteM2303Combo(t, db, comboA)

	got, err := repo.FindLiveComboIDsBySetupIDs(ctx, []int64{setupID})
	if err != nil {
		t.Fatalf("FindLiveComboIDsBySetupIDs: %v", err)
	}
	ids := got[setupID]
	if len(ids) != 1 || ids[0] != comboB {
		t.Fatalf("FindLiveComboIDsBySetupIDs = %v, want [%d]", ids, comboB)
	}
}
