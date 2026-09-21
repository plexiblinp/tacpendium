package punish_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/repository/punish"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M23-03 §4.3 / §5-4: #3 は削除済みのコンボを「採用済み」として返さない。
// ★「数えないこと」と「復元したら再び数えること」を対で確認する。
func TestM2303_ListAdoptedComboPunishes_ExcludesTrashedComboAndReturnsOnRestore(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1) // FK=ON 接続を 1 本に固定(既存テストの流儀)
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)
	starter := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='standing_light_punch'`)

	comboID := dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id":    self,
		"starter_move_id": starter,
	})

	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatalf("add punish: %v", err)
	}

	adoptedCount := func(label string) int {
		t.Helper()
		keys, err := repo.ListAdoptedComboPunishes(ctx, self)
		if err != nil {
			t.Fatalf("ListAdoptedComboPunishes(%s): %v", label, err)
		}
		n := 0
		for _, k := range keys {
			if k.ComboID == comboID && k.OpponentMoveID == opp {
				n++
			}
		}
		return n
	}

	if got := adoptedCount("削除前"); got != 1 {
		t.Fatalf("採用済み(削除前) = %d, want 1", got)
	}

	// ゴミ箱へ入れる。combo_punishes の行はそのまま残る(論理削除は子に効かない)。
	if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, comboID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
	if got := adoptedCount("削除後"); got != 0 {
		t.Fatalf("採用済み(削除後) = %d, want 0 — ゴミ箱のコンボが採用済みを主張している", got)
	}
	// 前提の確認: 行そのものは消えていない(除外は述語によるもので、物理削除ではない)。
	if n := scanInt64(t, db, `SELECT COUNT(*) FROM combo_punishes WHERE combo_id = ?`, comboID); n != 1 {
		t.Fatalf("combo_punishes 行数 = %d, want 1(論理削除で子は消えない前提が崩れている)", n)
	}

	// 復元したら再び「採用済み」に戻るのが正しい挙動である(§4.3-4)。
	if _, err := db.Exec(`UPDATE combos SET deleted_at = NULL WHERE id = ?`, comboID); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if got := adoptedCount("復元後"); got != 1 {
		t.Fatalf("採用済み(復元後) = %d, want 1", got)
	}
}

// M23-03 §4.4 / §5-5 の前提: #4 の base 側の述語が実際に効いていること。
// ★これ自体は「集合が変わる」ことの確認である。応答が変わらないことの主張は
// service/punishfinder 側の M23-03 テストが持つ。
func TestM2303_ListMaterializedBaseComboIDs_ExcludesTrashedBase(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	ryu := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)

	baseID := dbtest.Insert(t, db, "combos", dbtest.Cols{"character_id": ryu})
	dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id":               ryu,
		"materialized_from_combo_id": baseID,
	})

	got, err := repo.ListMaterializedBaseComboIDs(ctx, ryu)
	if err != nil {
		t.Fatalf("ListMaterializedBaseComboIDs(削除前): %v", err)
	}
	if !got[baseID] {
		t.Fatalf("生存中の基底が集合に無い: got=%v", got)
	}

	// 基底だけをゴミ箱へ入れる(生成物は生存)。
	if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, baseID); err != nil {
		t.Fatalf("soft delete base: %v", err)
	}
	got, err = repo.ListMaterializedBaseComboIDs(ctx, ryu)
	if err != nil {
		t.Fatalf("ListMaterializedBaseComboIDs(削除後): %v", err)
	}
	if got[baseID] {
		t.Fatalf("ゴミ箱の基底が集合に残っている(base 側の述語が効いていない): got=%v", got)
	}
}
