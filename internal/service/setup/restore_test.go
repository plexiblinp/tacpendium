package setup_test

// ★M23-02: セットプレイの復元・完全削除のサービス層テスト。
//
// 本サブの中心は「新しい API を 2 本足したこと」ではなく「既存の削除の挙動を
// 変えたこと」である。⇒ 共有の状態(コンボ A・B が同じセットプレイを指す)で
// 見なければ、本サブが直した壊れ方は再現しない(D-484 / 指示書 §5-1)。

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// shareSetupAcrossTwoCombos はコンボ A・B が 1 本のセットプレイを共有する状態を作る。
// 返り値は (comboA, comboB, setupID)。
func shareSetupAcrossTwoCombos(t *testing.T, db *sql.DB, svc setupsvc.Service) (int64, int64, int64) {
	t.Helper()
	ctx := context.Background()
	comboA := insertBareCombo(t, db)
	comboB := insertBareCombo(t, db)

	move := lookupMoveID(t, db, 1, "standing_light_punch")
	name := "共有セットプレイ"
	resp, result, err := svc.CreateSetup(ctx, comboA, setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        &name,
		Steps:       []model.SetupStep{{StepOrder: 1, MoveID: &move}},
	})
	if err != nil {
		t.Fatalf("create setup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("create setup validation: %+v", result.Issues)
	}
	if err := svc.CreateSetupLink(ctx, comboB, resp.Setup.ID); err != nil {
		t.Fatalf("link setup to combo B: %v", err)
	}
	return comboA, comboB, resp.Setup.ID
}

func countResultsBySetup(t *testing.T, db *sql.DB, setupID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE setup_id = ?`, setupID).Scan(&n); err != nil {
		t.Fatalf("count results: %v", err)
	}
	return n
}

func countLinksBySetup(t *testing.T, db *sql.DB, setupID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&n); err != nil {
		t.Fatalf("count links: %v", err)
	}
	return n
}

func softDeleteCombo(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	if _, err := db.Exec(
		`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, comboID); err != nil {
		t.Fatalf("soft delete combo: %v", err)
	}
}

// ===========================================================================
// §5-1 / §5-2: 共有されたセットプレイの論理削除が他のコンボの紐付けを壊さない
// ===========================================================================

// ★本サブの最重要ゲート。開発者要求(D-484)そのものである。
// 1 対 1 の状態でテストすると共有時の壊れ方を検出できないため、必ず 2 コンボで見る。
func TestService_DeleteSetup_KeepsComboSetupsWhenShared(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if got := countLinksBySetup(t, db, setupID); got != 2 {
		t.Fatalf("前提: 共有の紐付け数 = %d, want 2", got)
	}

	// ★検証結果も 1 セル書いておく。§4.1-3 が「紐付けを保つ以上、その紐付けに
	//   対する検証結果も保たれていなければ一貫しない」と定めているため、
	//   紐付けと同じ強さで残存を主張する(レビュー 中-1)。
	if err := svc.UpsertResult(ctx, comboA, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral,
		InCorner: false,
		Result:   model.SetupResultOK,
	}); err != nil {
		t.Fatalf("UpsertResult: %v", err)
	}
	if got := countResultsBySetup(t, db, setupID); got != 1 {
		t.Fatalf("前提: 検証結果 = %d 行, want 1", got)
	}

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// ★案 P1 の撤回により、紐付けは 2 本とも残る。
	if got := countLinksBySetup(t, db, setupID); got != 2 {
		t.Fatalf("論理削除後の紐付け数 = %d, want 2"+
			"\n★共有されたセットプレイの論理削除が他の生きたコンボの紐付けを壊している"+
			"(D-484 の要求そのもの)", got)
	}

	// ★検証結果も残る。撤回前は DeleteComboSetupsBySetupID が
	//   combo_setup_results を先に明示削除していたため 0 行になっていた(§3.3-2 の実査)。
	if got := countResultsBySetup(t, db, setupID); got != 1 {
		t.Fatalf("論理削除後の検証結果 = %d 行, want 1"+
			"\n★紐付けだけ残して検証結果が消えると、復元しても検証記録が戻らない(§4.1-3)", got)
	}

	// ただし、生きたコンボの画面には出ない(除外は参照側に委ねている＝§4.1-5)。
	for _, id := range []int64{comboA, comboB} {
		list, err := svc.ListSetupsByComboID(ctx, id)
		if err != nil {
			t.Fatalf("ListSetupsByComboID(%d): %v", id, err)
		}
		if len(list) != 0 {
			t.Errorf("combo %d: 論理削除中のセットプレイが %d 件見えている, want 0", id, len(list))
		}
	}
}

// ★復元後は A・B の両方から見えること。片方だけ確認して合格にしない(§5-2)。
func TestService_Restore_RevivesLinksForAllSharingCombos(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	if _, err := svc.Restore(ctx, setupID); err != nil {
		t.Fatalf("Restore: %v", err)
	}

	for _, id := range []int64{comboA, comboB} {
		list, err := svc.ListSetupsByComboID(ctx, id)
		if err != nil {
			t.Fatalf("ListSetupsByComboID(%d): %v", id, err)
		}
		if len(list) != 1 || list[0].Setup.ID != setupID {
			t.Fatalf("combo %d: 復元後に見えるセットプレイ = %d 件, want 1(id=%d)"+
				"\n★復元は紐付いていた全コンボへ一斉に戻らなければならない", id, len(list), setupID)
		}
	}

	// recipe_cache が作り直されている(論理削除時に物理削除した分＝§4.2-4)。
	resp, err := svc.GetSetup(ctx, setupID)
	if err != nil {
		t.Fatalf("GetSetup: %v", err)
	}
	if resp.DefaultRecipe == "" {
		t.Error("復元後の defaultRecipe が空。recipe_cache が作り直されていない(§4.2-4)")
	}
}

// ===========================================================================
// §5-4 / §5-5: 完全削除の前チェック(拒否と、通る側の対照)
// ===========================================================================

// ★生きたコンボから参照されている間は拒否する(D-484)。
func TestService_PermanentDelete_RejectsWhenReferencedByLiveCombo(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	err := svc.PermanentDelete(ctx, setupID)
	var inUse *setupsvc.SetupInUseError
	if !errors.As(err, &inUse) {
		t.Fatalf("PermanentDelete = %v, want *SetupInUseError", err)
	}
	if len(inUse.Combos) != 2 {
		t.Fatalf("拒否応答の参照元コンボ = %d 件, want 2", len(inUse.Combos))
	}
	got := map[int64]bool{}
	for _, ref := range inUse.Combos {
		got[ref.ID] = true
	}
	if !got[comboA] || !got[comboB] {
		t.Errorf("拒否応答の参照元 = %v, want %d と %d の両方", inUse.Combos, comboA, comboB)
	}

	// 拒否された以上、行は 1 つも消えていない。
	if countLinksBySetup(t, db, setupID) != 2 {
		t.Error("拒否されたのに紐付けが消えている")
	}
}

// ★参照元がすべてゴミ箱に居る場合は通る(D-486)。§5-4 と対で置く。
// 片方だけでは「常に拒否される」状態と区別できない。
func TestService_PermanentDelete_AllowsWhenAllReferrersAreTrashed(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	softDeleteCombo(t, db, comboA)
	softDeleteCombo(t, db, comboB)

	if err := svc.PermanentDelete(ctx, setupID); err != nil {
		t.Fatalf("参照元が全てゴミ箱なのに完全削除が拒否された: %v"+
			"\n★判定の述語は combos.deleted_at IS NULL だけである(D-486)", err)
	}
}

// ===========================================================================
// §5-6: 完全削除は 4 表すべてから明示的に消す
// ===========================================================================

// ★M23-overview §4.10 が「CASCADE を守るテストが 0 件」と記録している。
// 本サブは同じ穴を作らない。FK=OFF の接続でも消えることを 4 表すべてで見る。
func TestService_PermanentDelete_RemovesRowsFromAllFourTables(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboID, setupID := seedLinkedSetup(t, db, svc)

	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral,
		InCorner: false,
		Result:   model.SetupResultOK,
	}); err != nil {
		t.Fatalf("UpsertResult: %v", err)
	}
	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	softDeleteCombo(t, db, comboID) // 参照元をゴミ箱へ入れて拒否を外す
	if err := svc.PermanentDelete(ctx, setupID); err != nil {
		t.Fatalf("PermanentDelete: %v", err)
	}

	for _, tc := range []struct {
		table string
		query string
	}{
		{"combo_setup_results", `SELECT count(*) FROM combo_setup_results WHERE setup_id = ?`},
		{"combo_setups", `SELECT count(*) FROM combo_setups WHERE setup_id = ?`},
		{"setup_steps", `SELECT count(*) FROM setup_steps WHERE setup_id = ?`},
		{"setups", `SELECT count(*) FROM setups WHERE id = ?`},
	} {
		var n int
		if err := db.QueryRow(tc.query, setupID).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", tc.table, err)
		}
		if n != 0 {
			t.Errorf("完全削除後の %s = %d 行, want 0(明示削除されていない)", tc.table, n)
		}
	}
}

// ===========================================================================
// §5-7: ゴミ箱を経由しない完全削除の経路を作らない
// ===========================================================================

func TestService_PermanentDelete_RejectsSetupNotInTrash(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, setupID := seedLinkedSetup(t, db, svc)

	if err := svc.PermanentDelete(ctx, setupID); !errors.Is(err, setupsvc.ErrSetupNotInTrash) {
		t.Fatalf("生きたセットプレイへの PermanentDelete = %v, want ErrSetupNotInTrash", err)
	}
}

func TestService_PermanentDelete_NotFound(t *testing.T) {
	_, svc := newSetupService(t)
	if err := svc.PermanentDelete(context.Background(), 999999); !errors.Is(err, setupsvc.ErrNotFound) {
		t.Fatalf("存在しない id への PermanentDelete = %v, want ErrNotFound", err)
	}
}

// ===========================================================================
// Restore の異常系(既に生きている行・不在)
// ===========================================================================

// ★既に生きているセットプレイへの復元はコンボ側に揃えて 404 相当にする(§4.2-7)。
func TestService_Restore_NotFoundForAliveSetup(t *testing.T) {
	db, svc := newSetupService(t)
	_, setupID := seedLinkedSetup(t, db, svc)

	if _, err := svc.Restore(context.Background(), setupID); !errors.Is(err, setupsvc.ErrNotFound) {
		t.Fatalf("生きたセットプレイへの Restore = %v, want ErrNotFound(コンボ側と同挙動)", err)
	}
}

// ===========================================================================
// §4.2-8: 削除済みセットプレイ一覧
// ===========================================================================

func TestService_ListDeletedSetups(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, _, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	// 論理削除前はゴミ箱に出ない。
	before, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups: %v", err)
	}
	if len(before) != 0 {
		t.Fatalf("論理削除前のゴミ箱 = %d 件, want 0", len(before))
	}

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	after, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups: %v", err)
	}
	if len(after) != 1 || after[0].Setup.ID != setupID {
		t.Fatalf("ゴミ箱 = %d 件, want 1(id=%d)", len(after), setupID)
	}
	if after[0].Setup.DeletedAt == nil {
		t.Error("ゴミ箱の行に deletedAt が入っていない(画面が削除日時を出せない)")
	}

	// 生きた一覧には出ないままである(既存の ListSetups を壊していない)。
	alive, err := svc.ListSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListSetups: %v", err)
	}
	if len(alive) != 0 {
		t.Errorf("生きた一覧に論理削除済みが %d 件出ている, want 0", len(alive))
	}
}
