package setup_test

// combo_setup_results(セットプレイ成立条件の検証結果)のリポジトリテスト(M19-03 §5.1)。
//
// 観点対応:
//   #1 upsert       TestSetupResults_UpsertIsIdempotent
//   #2 三値         TestSetupResults_ThreeStatesAreDistinguishable / TestSetupResults_ResultIsNeverNull
//   #3 未検証へ戻す TestSetupResults_DeleteRestoresUnverified
//   #4 4 行上限     TestSetupResults_PrimaryKeyLimitsToFourRows
//   #5 複合 FK      TestSetupResults_RejectsWriteWithoutLink
//   #6 CASCADE      TestSetupResults_UnlinkRemovesResults
//   #8 値域         サービス層(setup_results_service_test.go)で検証
//   #9 組単位取得   TestSetupResults_ListByComboIDIsSingleQuery

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func strPtr(s string) *string { return &s }

// upsertResult は 1 セル分を書き込むテストヘルパ。
func upsertResult(t *testing.T, db *sql.DB, repo setuprepo.Repository, comboID, setupID int64, tech string, corner bool, result string, note *string) {
	t.Helper()
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.UpsertSetupResult(context.Background(), tx, model.ComboSetupResult{
			ComboID:  comboID,
			SetupID:  setupID,
			TechType: tech,
			InCorner: corner,
			Result:   result,
			Note:     note,
		}); err != nil {
			t.Fatalf("upsert setup result: %v", err)
		}
	})
}

func countResults(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setup_results WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count results: %v", err)
	}
	return n
}

// #1 upsert: 同一キーへの 2 回目の書き込みが行を増やさず更新する。
func TestSetupResults_UpsertIsIdempotent(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultNG, strPtr("やり直したら駄目だった"))

	if got := countResults(t, db, comboID); got != 1 {
		t.Fatalf("行数 = %d, want 1(upsert で増えないこと)", got)
	}
	results, err := repo.ListSetupResultsByComboID(context.Background(), comboID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if results[0].Result != model.SetupResultNG {
		t.Errorf("result = %q, want %q(2 回目で更新される)", results[0].Result, model.SetupResultNG)
	}
	if results[0].Note == nil || *results[0].Note != "やり直したら駄目だった" {
		t.Errorf("note が更新されていない: %v", results[0].Note)
	}
}

// #2 三値: 行なし=未検証 / ok=成立 / ng=不成立 が区別できる。
func TestSetupResults_ThreeStatesAreDistinguishable(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeBack, false, model.SetupResultNG, strPtr("後ろ受け身では届かない"))
	// (neutral, corner) と (back, corner) は書かない = 未検証

	results, err := repo.ListSetupResultsByComboID(context.Background(), comboID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("行数 = %d, want 2(未検証の 2 セルは行が無いこと)", len(results))
	}
	byKey := map[string]model.ComboSetupResult{}
	for _, r := range results {
		byKey[r.TechType] = r
	}
	if byKey[model.OkiTechTypeNeutral].Result != model.SetupResultOK {
		t.Errorf("その場受け身(中央) = %q, want ok", byKey[model.OkiTechTypeNeutral].Result)
	}
	if byKey[model.OkiTechTypeBack].Result != model.SetupResultNG {
		t.Errorf("後ろ受け身(中央) = %q, want ng", byKey[model.OkiTechTypeBack].Result)
	}
	// 未検証セルは戻り値に現れない(NULL 行として存在しない)。
	for _, r := range results {
		if r.InCorner {
			t.Errorf("書いていない端のセルが行として存在する: %+v", r)
		}
	}
}

// #2 三値(否定形): result に NULL が入る経路が無いこと。
func TestSetupResults_ResultIsNeverNull(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, true, model.SetupResultOK, nil)

	var n int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setup_results WHERE result IS NULL`).Scan(&n); err != nil {
		t.Fatalf("count null result: %v", err)
	}
	if n != 0 {
		t.Errorf("result が NULL の行 = %d, want 0(未検証は行の有無で表す)", n)
	}
	// スキーマ上も NOT NULL であり、直接 NULL を書こうとしても弾かれる。
	if _, err := db.Exec(
		`INSERT INTO combo_setup_results(combo_id,setup_id,tech_type,in_corner,result) VALUES(?,?,'back_tech',1,NULL)`,
		comboID, setupID); err == nil {
		t.Errorf("result=NULL の INSERT が NOT NULL 制約で弾かれていない")
	}
}

// #3 未検証へ戻す: 削除で行が消える。
func TestSetupResults_DeleteRestoresUnverified(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeBack, true, model.SetupResultNG, strPtr("端では無理"))
	if got := countResults(t, db, comboID); got != 1 {
		t.Fatalf("前提: 行数 = %d, want 1", got)
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteSetupResult(ctx, tx, comboID, setupID, model.OkiTechTypeBack, true); err != nil {
			t.Fatalf("delete: %v", err)
		}
	})
	if got := countResults(t, db, comboID); got != 0 {
		t.Errorf("削除後の行数 = %d, want 0(未検証へ戻る)", got)
	}

	// 既に未検証(行なし)の再削除は冪等でエラーにならない。
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteSetupResult(ctx, tx, comboID, setupID, model.OkiTechTypeBack, true); err != nil {
			t.Errorf("行が無い状態での削除がエラーになった: %v", err)
		}
	})
}

// #4 4 行上限: 1 組に対し受け身 2 × 端 2 の最大 4 行(PK で保証)。
func TestSetupResults_PrimaryKeyLimitsToFourRows(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	for _, tech := range []string{model.OkiTechTypeNeutral, model.OkiTechTypeBack} {
		for _, corner := range []bool{false, true} {
			upsertResult(t, db, repo, comboID, setupID, tech, corner, model.SetupResultOK, nil)
		}
	}
	if got := countResults(t, db, comboID); got != 4 {
		t.Fatalf("行数 = %d, want 4", got)
	}
	// 全セルを再度書いても 4 行のまま(5 行目は構造上あり得ない)。
	for _, tech := range []string{model.OkiTechTypeNeutral, model.OkiTechTypeBack} {
		for _, corner := range []bool{false, true} {
			upsertResult(t, db, repo, comboID, setupID, tech, corner, model.SetupResultNG, nil)
		}
	}
	if got := countResults(t, db, comboID); got != 4 {
		t.Errorf("再書き込み後の行数 = %d, want 4(1 組あたり最大 4 行)", got)
	}
}

// #5 複合 FK: 紐付けが存在しない組への書き込みが拒否される。
func TestSetupResults_RejectsWriteWithoutLink(t *testing.T) {
	db := dbtest.Setup(t)
	// ★M23-10 以降、この固定は FK=ON の根拠ではない(db.Open 経由は全接続 FK=ON)。
	// M19-03 当時の名残であり、外すかどうかは M23-10 の判断事項ではないため残している。
	db.SetMaxOpenConns(1)
	repo := setuprepo.New(db)
	ctx := context.Background()

	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	otherComboID := createCombo(t, db) // setupID とは紐付いていない

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()
	err = repo.UpsertSetupResult(ctx, tx, model.ComboSetupResult{
		ComboID:  otherComboID,
		SetupID:  setupID,
		TechType: model.OkiTechTypeNeutral,
		InCorner: false,
		Result:   model.SetupResultOK,
	})
	if err == nil {
		t.Errorf("紐付け(combo_setups)が無い組への書き込みが複合 FK で弾かれていない")
	}
}

// #6 紐付け解除で結果行が消える(§3.3-3 の実査どおり、紐付け解除は物理 DELETE)。
func TestSetupResults_UnlinkRemovesResults(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeBack, true, model.SetupResultNG, nil)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteComboSetup(ctx, tx, comboID, setupID); err != nil {
			t.Fatalf("delete combo_setup: %v", err)
		}
	})
	if got := countResults(t, db, comboID); got != 0 {
		t.Errorf("紐付け解除後の結果行 = %d, want 0", got)
	}
}

// #6 派生: DeleteComboSetupsBySetupID(setup_id の全紐付け解除)でも結果行が消える。
//
// ★M23-02(D-483)で案 P1 を撤回したため、本関数は論理削除の経路からは呼ばれなくなり、
//
//	セットプレイの完全削除(HardDelete)の 1・2 段目としてのみ使われる。
//	⇒ 「セットプレイ削除」ではなく「全紐付け解除」の検査である。
func TestSetupResults_DeleteComboSetupsBySetupIDRemovesResults(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteComboSetupsBySetupID(ctx, tx, setupID); err != nil {
			t.Fatalf("delete combo_setups by setup_id: %v", err)
		}
	})
	if got := countResults(t, db, comboID); got != 0 {
		t.Errorf("全紐付け解除後の結果行 = %d, want 0", got)
	}
}

// レビュー M-1: コンボの完全削除(物理削除)でも結果行が残らない。
// 2 段の ON DELETE CASCADE に依存せず明示削除しているため、FK=OFF の接続でも消える。
func TestSetupResults_HardDeleteRemovesResults(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	cRepo := comborepo.New(db)
	ctx := context.Background()
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	upsertResult(t, db, repo, comboID, setupID, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)

	withTx(t, db, func(tx *sql.Tx) {
		if err := cRepo.HardDelete(ctx, tx, comboID); err != nil {
			t.Fatalf("hard delete: %v", err)
		}
	})

	if got := countResults(t, db, comboID); got != 0 {
		t.Errorf("完全削除後の結果行 = %d, want 0", got)
	}
	var links int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setups WHERE combo_id = ?`, comboID).Scan(&links); err != nil {
		t.Fatalf("count links: %v", err)
	}
	if links != 0 {
		t.Errorf("完全削除後の紐付け = %d, want 0", links)
	}
}

// レビュー L-3: 紐付け確認と書き込みが同一 Tx で行われる(TOCTOU を塞ぐ)。
// ここでは Tx 版の存在確認が Tx 内の変更を見ることを検証する。
func TestSetupResults_ComboSetupExistsTxSeesTxState(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	ctx := context.Background()
	comboID := createCombo(t, db)
	setupID := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	exists, err := repo.ComboSetupExistsTx(ctx, tx, comboID, setupID)
	if err != nil {
		t.Fatalf("exists tx: %v", err)
	}
	if !exists {
		t.Fatalf("Tx 内で既存の紐付けが見えていない")
	}

	// 同一 Tx 内で解除すると、同じ Tx からは «無い» と見える。
	if err := repo.DeleteComboSetup(ctx, tx, comboID, setupID); err != nil {
		t.Fatalf("delete combo_setup: %v", err)
	}
	exists, err = repo.ComboSetupExistsTx(ctx, tx, comboID, setupID)
	if err != nil {
		t.Fatalf("exists tx after delete: %v", err)
	}
	if exists {
		t.Errorf("Tx 内の解除が同一 Tx の存在確認に反映されていない(TOCTOU が残る)")
	}
}

// #9 組単位の取得: 1 コンボの全セットプレイ分を 1 クエリで取得できる(N+1 になっていない)。
func TestSetupResults_ListByComboIDIsSingleQuery(t *testing.T) {
	db := dbtest.Setup(t)
	repo := setuprepo.New(db)
	comboID := createCombo(t, db)
	setupA := insertSetup(t, db, repo, comboID, "standing_light_punch", "crouching_light_kick")
	setupB := insertSetup(t, db, repo, comboID, "standing_medium_punch", "crouching_light_kick")

	upsertResult(t, db, repo, comboID, setupA, model.OkiTechTypeNeutral, false, model.SetupResultOK, nil)
	upsertResult(t, db, repo, comboID, setupA, model.OkiTechTypeBack, true, model.SetupResultNG, nil)
	upsertResult(t, db, repo, comboID, setupB, model.OkiTechTypeNeutral, true, model.SetupResultOK, nil)

	results, err := repo.ListSetupResultsByComboID(context.Background(), comboID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("行数 = %d, want 3(1 コンボの全セットプレイ分が 1 回で取れること)", len(results))
	}
	perSetup := map[int64]int{}
	for _, r := range results {
		perSetup[r.SetupID]++
		if r.ComboID != comboID {
			t.Errorf("ComboID が埋まっていない: %+v", r)
		}
	}
	if perSetup[setupA] != 2 || perSetup[setupB] != 1 {
		t.Errorf("setup 別件数 = %v, want {A:2, B:1}", perSetup)
	}

	// 別コンボの結果は混ざらない。
	otherCombo := createCombo(t, db)
	otherResults, err := repo.ListSetupResultsByComboID(context.Background(), otherCombo)
	if err != nil {
		t.Fatalf("list other: %v", err)
	}
	if len(otherResults) != 0 {
		t.Errorf("別コンボの取得件数 = %d, want 0", len(otherResults))
	}
}
