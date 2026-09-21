package setup_test

// ★M23-02: 復元・完全削除のリポジトリ層テスト。
//
// §5-3 は実 DB で行う(SUPP-001 §5.5.4 規約 14＝モックを使うハンドラ層テストがある
// 経路は、E2E か実 DB テストを 1 本必ず持つ)。dbtest.Setup が使い捨て DB を張る。

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func softDeleteSetupRow(t *testing.T, db *sql.DB, setupID int64) {
	t.Helper()
	if _, err := db.Exec(
		`UPDATE setups SET deleted_at = datetime('now') WHERE id = ?`, setupID); err != nil {
		t.Fatalf("soft delete setup: %v", err)
	}
}

func setupVersion(t *testing.T, db *sql.DB, setupID int64) int {
	t.Helper()
	var v int
	if err := db.QueryRow(`SELECT version FROM setups WHERE id = ?`, setupID).Scan(&v); err != nil {
		t.Fatalf("read version: %v", err)
	}
	return v
}

// ===========================================================================
// §5-3: 論理削除中のセットプレイが生きたコンボの詳細・一覧に出ない(実 DB)
// ===========================================================================

// ★案 P1 を撤回して紐付けを残すようにしたため、「紐付けが在るのに出ない」ことを
// 参照側の述語が担保しているかを実 DB で確かめる。撤回の安全性の根拠そのもの。
func TestRestore_SoftDeletedSetupIsHiddenFromLiveCombos(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboA := createCombo(t, db)
	comboB := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboA, "standing_light_punch", "crouching_light_kick")
	if _, err := db.Exec(
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboB, setupID); err != nil {
		t.Fatalf("link to combo B: %v", err)
	}

	softDeleteSetupRow(t, db, setupID)

	// ★前提: 紐付けは残っている(案 P1 の撤回)。残っていないと本テストは無意味。
	var links int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&links); err != nil {
		t.Fatalf("count links: %v", err)
	}
	if links != 2 {
		t.Fatalf("前提: 紐付け数 = %d, want 2", links)
	}

	// 単体取得(コンボ詳細)
	for _, comboID := range []int64{comboA, comboB} {
		got, err := repo.ListSetupsByComboID(ctx, comboID)
		if err != nil {
			t.Fatalf("ListSetupsByComboID(%d): %v", comboID, err)
		}
		if len(got) != 0 {
			t.Errorf("combo %d: 論理削除中のセットプレイが %d 件見えている, want 0", comboID, len(got))
		}
	}

	// バッチ取得(一覧)
	batch, err := repo.ListSetupsByComboIDs(ctx, []int64{comboA, comboB})
	if err != nil {
		t.Fatalf("ListSetupsByComboIDs: %v", err)
	}
	for comboID, list := range batch {
		if len(list) != 0 {
			t.Errorf("batch combo %d: %d 件見えている, want 0", comboID, len(list))
		}
	}

	// 復元すると両方から見える(除外が効いていただけで、行は生きている)。
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.Restore(ctx, tx, setupID); err != nil {
			t.Fatalf("Restore: %v", err)
		}
	})
	for _, comboID := range []int64{comboA, comboB} {
		got, err := repo.ListSetupsByComboID(ctx, comboID)
		if err != nil {
			t.Fatalf("ListSetupsByComboID(%d): %v", comboID, err)
		}
		if len(got) != 1 {
			t.Errorf("combo %d: 復元後 %d 件, want 1", comboID, len(got))
		}
	}
}

// ===========================================================================
// §5-8: 復元は version を動かさない
// ===========================================================================

// ★コンボ側の Restore と揃える(M23-RESEARCH-01 §D-5 の実測)。
// 論理削除中は編集経路が deleted_at IS NULL で締め出されており version が動く経路が
// 無いため、据え置きでも復元が楽観排他をすり抜けることはない。
func TestRestore_DoesNotBumpVersion(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	before := setupVersion(t, db, setupID)

	softDeleteSetupRow(t, db, setupID)
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.Restore(ctx, tx, setupID); err != nil {
			t.Fatalf("Restore: %v", err)
		}
	})

	if after := setupVersion(t, db, setupID); after != before {
		t.Errorf("復元後の version = %d, want %d(据え置き。コンボ側と揃える)", after, before)
	}
}

// 既に生きている行への復元は ErrNotFound(コンボ側と同挙動)。
func TestRestore_ReturnsNotFoundForAliveRow(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.Restore(ctx, tx, setupID); !errors.Is(err, setuprepo.ErrNotFound) {
			t.Fatalf("生きた行への Restore = %v, want ErrNotFound", err)
		}
	})
}

// ===========================================================================
// FindLiveReferencingCombos の述語(ゴミ箱のコンボを数えない)
// ===========================================================================

// ★判定に使う述語は combos.deleted_at IS NULL だけである(D-486)。
// 結合を挟まずに combo_setups の件数だけを数えると、ゴミ箱のコンボからの参照まで
// 数えてしまい、利用者が完全削除できなくなる。
func TestFindLiveReferencingCombos_ExcludesTrashedCombos(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()

	liveCombo := createCombo(t, db)
	trashedCombo := createCombo(t, db)
	setupID := insertSetup(t, db, repo, liveCombo, "standing_light_punch", "crouching_light_kick")
	if _, err := db.Exec(
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, trashedCombo, setupID); err != nil {
		t.Fatalf("link to trashed combo: %v", err)
	}
	if _, err := db.Exec(
		`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, trashedCombo); err != nil {
		t.Fatalf("soft delete combo: %v", err)
	}

	withTx(t, db, func(tx *sql.Tx) {
		refs, err := repo.FindLiveReferencingCombos(ctx, tx, setupID)
		if err != nil {
			t.Fatalf("FindLiveReferencingCombos: %v", err)
		}
		if len(refs) != 1 || refs[0].ID != liveCombo {
			t.Fatalf("参照元 = %v, want [%d] のみ(ゴミ箱のコンボを数えないこと)", refs, liveCombo)
		}
	})
}
