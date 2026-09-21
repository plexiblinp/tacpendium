package punishfinder

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M23-03: 確定反撃サーチ側(#3 / #4)の応答が壊れていないことを実 DB で確かめる。
//
// ★重要な前提: 孫コンボの母集団は combos リポジトリの List(既定で deleted_at IS NULL)で
// 並べているため、ゴミ箱のコンボはツリーに現れない。したがって #3 / #4 を塞いでも
// 応答は変わらない。§5-5 はその「変わらない」を主張するテストであり、
// §5-4 はゴミ箱のコンボが採用済みとして数えられない／復元で戻ることを対で見る。

type m2303Fixture struct {
	db        *sql.DB
	svc       Service
	selfID    int64
	oppMoveA  int64
	comboID   int64
	starterID int64
}

func newM2303Fixture(t *testing.T) *m2303Fixture {
	t.Helper()
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	punishRepo := punish.New(db)

	var selfID, starterID int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE code='ryu'`).Scan(&selfID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(
		`SELECT id FROM moves WHERE character_id=? AND code='standing_light_punch'`, selfID,
	).Scan(&starterID); err != nil {
		t.Fatal(err)
	}
	var oppMoveA int64
	if err := db.QueryRow(
		`SELECT id FROM moves
		   WHERE character_id=? AND code LIKE 'standing_%' AND damage > 0
		     AND is_aerial=0 AND recovery IS NOT NULL
		 ORDER BY id LIMIT 1`, selfID,
	).Scan(&oppMoveA); err != nil {
		t.Fatal(err)
	}

	res, err := db.Exec(
		`INSERT INTO combos(character_id, starter_move_id, hit_type) VALUES(?,?,?)`,
		selfID, starterID, model.HitTypeNormal,
	)
	if err != nil {
		t.Fatal(err)
	}
	comboID, _ := res.LastInsertId()
	if err := punishRepo.AddPunish(ctx, comboID, oppMoveA, nil); err != nil {
		t.Fatal(err)
	}

	return &m2303Fixture{
		db:        db,
		svc:       New(punishRepo, combo.New(db), func() int64 { return 1 }),
		selfID:    selfID,
		oppMoveA:  oppMoveA,
		comboID:   comboID,
		starterID: starterID,
	}
}

// scanComboNode は対象コンボのノードを探す。見つからなければ (ComboNode{}, false)。
func (f *m2303Fixture) scanComboNode(t *testing.T) (ComboNode, bool) {
	t.Helper()
	tree, err := f.svc.Scan(context.Background(), ScanParams{
		SelfCharacterID:     f.selfID,
		OpponentCharacterID: f.selfID,
		GuardType:           model.PunishGuardTypeJustParry,
	})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	for _, opponent := range tree.Nodes {
		if opponent.MoveID != f.oppMoveA {
			continue
		}
		for _, starter := range opponent.Starters {
			for _, c := range starter.Combos {
				if c.ComboID == f.comboID {
					return c, true
				}
			}
		}
	}
	return ComboNode{}, false
}

func (f *m2303Fixture) softDelete(t *testing.T) {
	t.Helper()
	if _, err := f.db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, f.comboID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
}

func (f *m2303Fixture) restore(t *testing.T) {
	t.Helper()
	if _, err := f.db.Exec(`UPDATE combos SET deleted_at = NULL WHERE id = ?`, f.comboID); err != nil {
		t.Fatalf("restore: %v", err)
	}
}

// 指示書 §5-4: ゴミ箱のコンボを「採用済み」と数えない ／ 復元したら再び数える(対)。
func TestM2303_Scan_TrashedComboIsNotCountedAsAdopted_AndReturnsOnRestore(t *testing.T) {
	f := newM2303Fixture(t)

	node, ok := f.scanComboNode(t)
	if !ok {
		t.Fatalf("採用したコンボ %d がツリーに出ていない(fixture の前提崩れ)", f.comboID)
	}
	if !node.Adopted {
		t.Fatalf("Adopted(削除前) = false, want true")
	}

	f.softDelete(t)
	if _, ok := f.scanComboNode(t); ok {
		t.Fatalf("ゴミ箱のコンボ %d がツリーに残っている(採用済みとして数えられている)", f.comboID)
	}

	f.restore(t)
	node, ok = f.scanComboNode(t)
	if !ok {
		t.Fatalf("復元したコンボ %d がツリーに戻っていない", f.comboID)
	}
	if !node.Adopted {
		t.Fatalf("Adopted(復元後) = false, want true — 復元したら再び採用済みに戻ること")
	}
}

// 指示書 §5-5: #4 を塞いでも確定反撃サーチの結果が変わらないこと。
//
// ★過剰包含のシナリオを組む——「ゴミ箱の基底 ＋ 生存する materialize 生成物」。
// 塞ぐ前は基底 id が materializedBaseIDs に載っていたが、それを引く相手(生存コンボ)が
// 居ないため応答には出ていなかった。塞いだ後も応答は同じである。
func TestM2303_Scan_MaterializedFlagUnchangedByBasePredicate(t *testing.T) {
	f := newM2303Fixture(t)

	// 生存する materialize 生成物を作る(基底 = f.comboID)。
	if _, err := f.db.Exec(
		`INSERT INTO combos(character_id, starter_move_id, hit_type, materialized_from_combo_id)
		 VALUES(?,?,?,?)`,
		f.selfID, f.starterID, model.HitTypePunishCounter, f.comboID,
	); err != nil {
		t.Fatalf("insert materialized child: %v", err)
	}

	node, ok := f.scanComboNode(t)
	if !ok {
		t.Fatalf("基底 %d がツリーに出ていない(fixture の前提崩れ)", f.comboID)
	}
	if !node.HasMaterializedVersion {
		t.Fatalf("HasMaterializedVersion(生存) = false, want true")
	}

	// 基底をゴミ箱へ。生成物は生存させたまま = 過剰包含が起きうる形。
	f.softDelete(t)
	if _, ok := f.scanComboNode(t); ok {
		t.Fatalf("ゴミ箱の基底 %d がツリーに出ている — base 側を塞いだことで応答が変わってしまった", f.comboID)
	}

	// 復元すれば元どおり(塞いだことで恒久的に落ちていないことの対照)。
	f.restore(t)
	node, ok = f.scanComboNode(t)
	if !ok {
		t.Fatalf("復元した基底 %d がツリーに戻っていない", f.comboID)
	}
	if !node.HasMaterializedVersion {
		t.Fatalf("HasMaterializedVersion(復元後) = false, want true")
	}
}
