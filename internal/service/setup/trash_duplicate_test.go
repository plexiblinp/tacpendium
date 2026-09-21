package setup_test

// ★M23-05: 削除済み行と再登録の衝突(VAL-S07 / VAL-R04)のサービス層テスト。
//
// ★VAL-S04 の判定内容は本サブで変えていない。既存の
// TestService_CreateSetup_VAL_S04_Duplicate と
// TestRepository_FindDuplicateInCombo_IgnoresDeletedSetup が緑のままであることが
// その担保である——後者は「削除済みは VAL-S04 の候補に入らない」を仕様として固定している。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

// secondComboID は同じ DB へ 2 本目の親コンボを作る(§5.1-9 の「別の親コンボ」用)。
func secondComboID(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	cRepo := comborepo.New(db)
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)
	return createTestCombo(t, db, cRepo, nSvc)
}

// createAndTrashSetup はセットプレイを作ってゴミ箱へ入れる(VAL-S07 の母集団を作る)。
func createAndTrashSetup(t *testing.T, svc setupsvc.Service, comboID int64, input setupsvc.CreateSetupInput) int64 {
	t.Helper()
	resp, result, err := svc.CreateSetup(context.Background(), comboID, input)
	if err != nil || result.HasError() {
		t.Fatalf("create setup: err=%v issues=%+v", err, result.Issues)
	}
	if err := svc.DeleteSetup(context.Background(), resp.Setup.ID, nil); err != nil {
		t.Fatalf("delete setup: %v", err)
	}
	return resp.Setup.ID
}

// createSetupOK はセットプレイを作って id を返す。
func createSetupOK(t *testing.T, svc setupsvc.Service, comboID int64, input setupsvc.CreateSetupInput) int64 {
	t.Helper()
	resp, result, err := svc.CreateSetup(context.Background(), comboID, input)
	if err != nil || result.HasError() {
		t.Fatalf("create setup: err=%v issues=%+v", err, result.Issues)
	}
	return resp.Setup.ID
}

func setupIssueByCode(issues []validation.ValidationIssue, code string) *validation.ValidationIssue {
	for i := range issues {
		if issues[i].Code == code {
			return &issues[i]
		}
	}
	return nil
}

// detailSetupIDs は警告の details.setups に載っている id を取り出す。
func detailSetupIDs(t *testing.T, issue *validation.ValidationIssue) []int64 {
	t.Helper()
	raw, ok := issue.Details["setups"]
	if !ok {
		t.Fatalf("details.setups が無い: %+v", issue.Details)
	}
	refs, ok := raw.([]any)
	if !ok {
		t.Fatalf("details.setups が []any でない: %T", raw)
	}
	ids := make([]int64, 0, len(refs))
	for _, r := range refs {
		ref, ok := r.(model.SetupRef)
		if !ok {
			t.Fatalf("details.setups の要素が model.SetupRef でない: %T", r)
		}
		ids = append(ids, ref.ID)
	}
	return ids
}

func setupIsAlive(t *testing.T, db *sql.DB, id int64) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM setups WHERE id = ? AND deleted_at IS NULL`, id).Scan(&n); err != nil {
		t.Fatalf("select alive setup: %v", err)
	}
	return n == 1
}

// ---------------------------------------------------------------------------
// §5.1-8: 同一親コンボに同一レシピの削除済みセットプレイが在るとき VAL-S07 が返る
// ---------------------------------------------------------------------------

func TestCheckTrashDuplicateSetup_VALS07_FiresWhenTrashHasSameRecipe(t *testing.T) {
	env := newTestEnv(t)

	trashedID := createAndTrashSetup(t, env.svc, env.comboID, validSetupInput(t, env.db))
	// ★VAL-S04 は削除済みの setup を候補に入れない(FindDuplicateInCombo の
	//   AND s.deleted_at IS NULL)ため、同じレシピを作り直せてしまう。
	newID := createSetupOK(t, env.svc, env.comboID, validSetupInput(t, env.db))

	result := env.svc.CheckTrashDuplicateSetup(context.Background(), env.comboID, newID)
	issue := setupIssueByCode(result.Issues, setupsvc.CodeS07DuplicateInTrash)
	if issue == nil {
		t.Fatalf("VAL-S07 が返らない: %+v", result.Issues)
	}
	if issue.Severity != validation.SeverityWarning {
		t.Errorf("VAL-S07 は WARNING であるべき: %s", issue.Severity)
	}
	if ids := detailSetupIDs(t, issue); len(ids) != 1 || ids[0] != trashedID {
		t.Errorf("details.setups = %v, want [%d]", ids, trashedID)
	}

	// §5.1-11: 警告が付いても登録は成功している(§4.1-1)。
	if !setupIsAlive(t, env.db, newID) {
		t.Errorf("VAL-S07 が付いたことで登録が取り消された")
	}
	if result.HasError() {
		t.Errorf("VAL-S07 は ERROR を含んではならない: %+v", result.Errors())
	}
}

// ★対照: レシピが違えば返らない(ハッシュ比較が効いている)。
func TestCheckTrashDuplicateSetup_VALS07_NotFiredWhenRecipeDiffers(t *testing.T) {
	env := newTestEnv(t)

	createAndTrashSetup(t, env.svc, env.comboID, validSetupInput(t, env.db))

	other := validSetupInput(t, env.db)
	move3 := lookupMoveID(t, env.db, 1, "crouching_light_kick")
	other.Steps = append(other.Steps, model.SetupStep{MoveID: &move3})
	newID := createSetupOK(t, env.svc, env.comboID, other)

	result := env.svc.CheckTrashDuplicateSetup(context.Background(), env.comboID, newID)
	if issue := setupIssueByCode(result.Issues, setupsvc.CodeS07DuplicateInTrash); issue != nil {
		t.Errorf("レシピが違うのに VAL-S07 が返った: %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-9: 別の親コンボに同一レシピのセットプレイが在っても VAL-S07 が返らない
// ---------------------------------------------------------------------------

// ★VAL-S04 と同じ意味論である——異なる親への同一レシピは正当(§4.1-2)。
// 母集団を親コンボで絞れていないと、ここが赤くなる。
func TestCheckTrashDuplicateSetup_VALS07_NotFiredForOtherParentCombo(t *testing.T) {
	env := newTestEnv(t)
	otherComboID := secondComboID(t, env.db)

	// ゴミ箱の同一レシピは「別の親コンボ」の下に置く。
	createAndTrashSetup(t, env.svc, otherComboID, validSetupInput(t, env.db))

	newID := createSetupOK(t, env.svc, env.comboID, validSetupInput(t, env.db))

	result := env.svc.CheckTrashDuplicateSetup(context.Background(), env.comboID, newID)
	if issue := setupIssueByCode(result.Issues, setupsvc.CodeS07DuplicateInTrash); issue != nil {
		t.Errorf("別の親コンボの削除済みセットプレイに対して VAL-S07 が返った: %+v", issue)
	}
}

// ---------------------------------------------------------------------------
// §5.1-10: 同一親コンボに同一レシピの生きたセットプレイが在るとき VAL-R04 が返る
// ---------------------------------------------------------------------------

func TestRestoreSetup_VALR04_FiresWhenAliveDuplicateExists(t *testing.T) {
	env := newTestEnv(t)

	trashedID := createAndTrashSetup(t, env.svc, env.comboID, validSetupInput(t, env.db))
	aliveID := createSetupOK(t, env.svc, env.comboID, validSetupInput(t, env.db))

	result, err := env.svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	issue := setupIssueByCode(result.Issues, setupsvc.CodeR04DuplicateAliveSetup)
	if issue == nil {
		t.Fatalf("VAL-R04 が返らない: %+v", result.Issues)
	}

	ids := detailSetupIDs(t, issue)
	if len(ids) != 1 || ids[0] != aliveID {
		t.Errorf("details.setups = %v, want [%d]", ids, aliveID)
	}
	// ★復元対象自身を数えていないこと(§4.3)。
	for _, id := range ids {
		if id == trashedID {
			t.Errorf("復元対象自身(%d)が details に載っている", trashedID)
		}
	}

	// §5.1-11: 警告が付いても復元は成功している。
	if !setupIsAlive(t, env.db, trashedID) {
		t.Errorf("VAL-R04 が付いたことで復元が取り消された")
	}
	if result.HasError() {
		t.Errorf("VAL-R04 は ERROR を含んではならない: %+v", result.Errors())
	}
}

// ★★復元対象自身を母集団に入れていないこと(§4.3)。
// 復元は deleted_at を NULL に戻してから検証するため、除外しないと必ずヒットする。
func TestRestoreSetup_VALR04_ExcludesRestoredSetupItself(t *testing.T) {
	env := newTestEnv(t)

	trashedID := createAndTrashSetup(t, env.svc, env.comboID, validSetupInput(t, env.db))

	result, err := env.svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if issue := setupIssueByCode(result.Issues, setupsvc.CodeR04DuplicateAliveSetup); issue != nil {
		t.Errorf("重複相手が居ないのに VAL-R04 が返った(自分自身を数えている): %+v", issue)
	}
	if !setupIsAlive(t, env.db, trashedID) {
		t.Errorf("復元が成立していない")
	}
}

// ★対照: 別の親コンボに同一レシピが居ても VAL-R04 は返らない。
func TestRestoreSetup_VALR04_NotFiredForOtherParentCombo(t *testing.T) {
	env := newTestEnv(t)
	otherComboID := secondComboID(t, env.db)

	trashedID := createAndTrashSetup(t, env.svc, env.comboID, validSetupInput(t, env.db))
	createSetupOK(t, env.svc, otherComboID, validSetupInput(t, env.db))

	result, err := env.svc.Restore(context.Background(), trashedID)
	if err != nil {
		t.Fatalf("restore: %v", err)
	}
	if issue := setupIssueByCode(result.Issues, setupsvc.CodeR04DuplicateAliveSetup); issue != nil {
		t.Errorf("別の親コンボの生きたセットプレイに対して VAL-R04 が返った: %+v", issue)
	}
}
