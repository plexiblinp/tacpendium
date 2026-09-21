package combo_test

// ★M19-03 §4.2 / §5.1-7: 識別キー変更編集でセットプレイ成立条件の検証結果が失われないこと。
//
// 実装漏れは「ユーザーが実機で検証した結果が、コンボを編集しただけで消える」という
// データ消失に直結するため、本サブの最重要回帰テストとして 3 経路すべてを押さえる。
//
// 実装形(§3.3-1 の実査結果):
//   - 識別キー変更編集は「旧コンボ論理削除 → 新コンボ INSERT(新 combo_id 発番)
//     → UPDATE combo_setups SET combo_id」を同一 Tx で行う。
//   - combo_setup_results の FK 親は combo_setups であり、その親キーが UPDATE されるため
//     FK=ON の接続では ON UPDATE CASCADE が子行を追従させる。
//   - M19-03 当時の infra/db.Open は PRAGMA foreign_keys=ON をプール中の 1 接続にしか
//     適用しておらず FK=OFF の接続が混在したため、MoveSetupResultReferences による
//     明示再ポイントを併用している。★M23-10 で全接続が FK=ON になった後も撤去しない。
//     本テストは接続を固定しないので、どちらの経路でも結果が保たれることを見ている。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// newSetupSvc は同一 DB 上に setup サービスを構築する(採用経路の検証用)。
func newSetupSvc(t *testing.T, db *sql.DB) setupsvc.Service {
	t.Helper()
	repo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	notationSvc := notation.New(db, presetrepo.New(db), repo, sRepo)
	return setupsvc.New(db, sRepo, setupsvc.ValidationDeps{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		// ★★M24-13 §4.6: 本番配線(cmd/tacpendium/main.go)と同じくアダプタを挟む。
		//   sRepo を直に渡すと txScopedValidDeps が tx を束ねられず、VAL-S04 の判定が
		//   *sql.DB 直読みへ落ちる ⇒ 競合を塞いだことをテストが観測できなくなる。
		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
	}, notationSvc, repo, func() int64 { return 1 })
}

// linkSetupWithResults は comboID にセットプレイを 1 本作り、成立条件を 2 セル記録する。
func linkSetupWithResults(t *testing.T, db *sql.DB, comboID int64) int64 {
	t.Helper()
	move := lookupMoveID(t, db, 1, "standing_light_punch")
	res, err := db.Exec(`INSERT INTO setups (character_id, step_count, version) VALUES (1, 1, 1)`)
	if err != nil {
		t.Fatalf("insert setup: %v", err)
	}
	setupID, _ := res.LastInsertId()
	if _, err := db.Exec(`INSERT INTO setup_steps (setup_id, step_order, move_id) VALUES (?, 1, ?)`, setupID, move); err != nil {
		t.Fatalf("insert setup step: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID); err != nil {
		t.Fatalf("insert combo_setup: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO combo_setup_results (combo_id, setup_id, tech_type, in_corner, result, note)
		 VALUES (?, ?, 'neutral_tech', 0, 'ok', NULL), (?, ?, 'back_tech', 1, 'ng', '端の後ろ受け身では届かない')`,
		comboID, setupID, comboID, setupID); err != nil {
		t.Fatalf("insert setup results: %v", err)
	}
	return setupID
}

func countSetupResults(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setup_results WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count setup results: %v", err)
	}
	return n
}

// ★経路 1: SetupCarryOptions 未指定(既定の全転写)。
func TestUpdateWithKeyChange_CarriesSetupResults_Default(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	setupID := linkSetupWithResults(t, db, base.ID)

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self") // 識別キーを変える
	newCombo, result, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}

	// 検証結果が新コンボ側で引ける(消えていない)。
	if got := countSetupResults(t, db, newCombo.ID); got != 2 {
		t.Fatalf("新コンボ側の検証結果 = %d 行, want 2(キー変更編集で失われないこと)", got)
	}
	if got := countSetupResults(t, db, base.ID); got != 0 {
		t.Errorf("旧コンボ側に検証結果が %d 行残存", got)
	}

	// 内容(result / note / セル座標)も不変。
	var res, note string
	if err := db.QueryRow(
		`SELECT result, COALESCE(note,'') FROM combo_setup_results
		 WHERE combo_id = ? AND setup_id = ? AND tech_type = 'back_tech' AND in_corner = 1`,
		newCombo.ID, setupID).Scan(&res, &note); err != nil {
		t.Fatalf("query carried result: %v", err)
	}
	if res != model.SetupResultNG {
		t.Errorf("result = %q, want %q", res, model.SetupResultNG)
	}
	if note != "端の後ろ受け身では届かない" {
		t.Errorf("note = %q, want 保持されていること", note)
	}
	// 紐付けも新コンボへ移っている(結果行だけが移る片肺状態でない)。
	var linkCombo int64
	if err := db.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&linkCombo); err != nil {
		t.Fatalf("query combo_setups: %v", err)
	}
	if linkCombo != newCombo.ID {
		t.Errorf("combo_setups の combo_id = %d, want %d", linkCombo, newCombo.ID)
	}
}

// ★経路 2: carry_all(明示的に全転写)。
func TestUpdateWithKeyChange_CarriesSetupResults_CarryAll(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	linkSetupWithResults(t, db, base.ID)

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "carry_all"}
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}
	if got := countSetupResults(t, db, newCombo.ID); got != 2 {
		t.Errorf("carry_all 後の検証結果 = %d 行, want 2", got)
	}
}

// ★経路 3: individual(選んだセットプレイのみ引き継ぐ)。
// 引き継いだ組の結果は残り、解除した組の結果は消える(孤児にならない)。
func TestUpdateWithKeyChange_CarriesSetupResults_Individual(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	keepSetupID := linkSetupWithResults(t, db, base.ID)
	dropSetupID := linkSetupWithResults(t, db, base.ID)
	if got := countSetupResults(t, db, base.ID); got != 4 {
		t.Fatalf("前提: 検証結果 = %d 行, want 4", got)
	}

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{
		Mode:          "individual",
		CarrySetupIDs: []int64{keepSetupID},
	}
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}

	if got := countSetupResults(t, db, newCombo.ID); got != 2 {
		t.Errorf("引き継いだ組の検証結果 = %d 行, want 2", got)
	}
	var kept int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE setup_id = ?`, keepSetupID).Scan(&kept); err != nil {
		t.Fatalf("count kept: %v", err)
	}
	if kept != 2 {
		t.Errorf("引き継いだ setup の結果 = %d 行, want 2", kept)
	}
	// 解除した組の結果は残らない(未検証でない状態の孤児を作らない＝§4.1.3)。
	var dropped int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE setup_id = ?`, dropSetupID).Scan(&dropped); err != nil {
		t.Fatalf("count dropped: %v", err)
	}
	if dropped != 0 {
		t.Errorf("解除した setup の結果 = %d 行, want 0(孤児にしない)", dropped)
	}
}

// unlink_all では紐付けごと解除されるため結果も残らない。
func TestUpdateWithKeyChange_UnlinkAllDropsSetupResults(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	linkSetupWithResults(t, db, base.ID)

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "unlink_all"}
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}
	if got := countSetupResults(t, db, newCombo.ID); got != 0 {
		t.Errorf("unlink_all 後の新コンボ側の結果 = %d 行, want 0", got)
	}
	var total int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setup_results`).Scan(&total); err != nil {
		t.Fatalf("count all: %v", err)
	}
	if total != 0 {
		t.Errorf("unlink_all 後に結果行が %d 行残存(孤児)", total)
	}
}

// 引き継ぎの原子性: キー変更編集の途中で失敗すると全体がロールバックし、
// 検証結果は旧コンボに残ったまま(片方だけ移らない)。
func TestUpdateWithKeyChange_SetupResultCarryIsAtomic(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	linkSetupWithResults(t, db, base.ID)

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.TagIDs = []int64{999999} // 存在しないタグ → tx 後半で失敗させる
	if _, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput); err == nil {
		t.Fatal("存在しないタグ id でエラーになるはず")
	}

	if got := countSetupResults(t, db, base.ID); got != 2 {
		t.Errorf("ロールバック後の旧コンボ側の結果 = %d 行, want 2(巻き戻ること)", got)
	}
}

// ★FK=OFF の接続でもキー変更編集で結果が失われないこと(明示再ポイントの決定的検証)。
//
// M19-03 当時の infra/db.Open は PRAGMA foreign_keys=ON をプール中の 1 接続にしか
// 適用しておらず、実運用で FK=OFF の接続がキー変更編集を処理し得た(実測で 16 接続中
// 7 本が OFF)。その接続では ON UPDATE CASCADE が発火しないので、
// MoveSetupResultReferences による明示再ポイントだけが結果を守る。
// ここでは PRAGMA を一切適用しない生接続に固定してその経路を決定的に通す
// (この経路が無ければ本テストは落ちる)。
//
// ★M23-10 で db.Open 経由の接続はすべて FK=ON になったため、本テストが再現するのは
// もう「実運用で起こりうる状態」ではなく「明示再ポイントが実在すること」である。
// 役割は変わったが必要性は変わっていない —— 明示再ポイントは撤去しないため。
// なお本テストは db.Open を使わず生接続を自前に開いているので、M23-10 の影響を受けない。
func TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff(t *testing.T) {
	_, dbPath := dbtest.SetupWithPath(t)

	raw, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open raw db: %v", err)
	}
	defer raw.Close()
	// PRAGMA を一切適用しないため、この *sql.DB が開く接続はすべて FK=OFF になる
	// (SQLite の既定)。接続数を絞ると tx 内から非 tx 読取を行う経路でプール枯渇する
	// ため、あえて絞らない。
	var fk int
	if err := raw.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if fk != 0 {
		t.Skipf("生接続の既定が FK=ON(%d)のため、本ケースの前提が成立しない", fk)
	}

	repo := comborepo.New(raw)
	sRepo := setuprepo.New(raw)
	notationSvc := notation.New(raw, presetrepo.New(raw), repo, sRepo)
	svc := combosvc.New(raw, repo, validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: raw},
		MoveRepo:      &combosvc.MoveAdapter{DB: raw},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}, notationSvc, nil, func() int64 { return 1 })

	base := createBase(t, raw, svc, baseComboInput(t, raw))
	setupID := linkSetupWithResults(t, raw, base.ID)

	newInput := baseComboInput(t, raw)
	newInput.Position = ptr("corner_self")
	newCombo, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}

	if got := countSetupResults(t, raw, newCombo.ID); got != 2 {
		t.Fatalf("FK=OFF 接続での検証結果 = %d 行, want 2(明示再ポイントが効いていない＝データ消失)", got)
	}
	if got := countSetupResults(t, raw, base.ID); got != 0 {
		t.Errorf("FK=OFF 接続で旧 combo_id に結果が %d 行取り残されている", got)
	}
	var linkCombo int64
	if err := raw.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&linkCombo); err != nil {
		t.Fatalf("query combo_setups: %v", err)
	}
	if linkCombo != newCombo.ID {
		t.Errorf("combo_setups の combo_id = %d, want %d", linkCombo, newCombo.ID)
	}
}

// 識別キーが変わらない編集(PATCH=UpdateMetadata)では検証結果は動かない。
func TestUpdateMetadata_DoesNotMoveSetupResults(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	linkSetupWithResults(t, db, base.ID)

	updated, result, err := svc.UpdateMetadata(context.Background(), base.ID, base.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("メタ編集"),
	})
	if err != nil {
		t.Fatalf("update metadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}
	if updated.ID != base.ID {
		t.Fatalf("メタデータ編集で id が変わっている: got %d want %d", updated.ID, base.ID)
	}
	if got := countSetupResults(t, db, base.ID); got != 2 {
		t.Errorf("メタデータ編集後の結果 = %d 行, want 2(同じコンボに残る)", got)
	}
}

// 採用時の「確認できた条件」はセットプレイ作成と同一トランザクションで書かれる(§4.5)。
// 途中で失敗した場合、setups ごと巻き戻り結果行だけが残ることはない。
func TestCreateSetup_VerifiedConditionsAreInSameTx(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	move := lookupMoveID(t, db, 1, "standing_light_punch")

	setupSvc := newSetupSvc(t, db)
	name := "採用したセットプレイ"
	resp, vres, err := setupSvc.CreateSetup(context.Background(), base.ID, setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        &name,
		Steps:       []model.SetupStep{{StepOrder: 1, MoveID: &move}},
		VerifiedConditions: []setupsvc.SetupResultCondition{
			{TechType: model.OkiTechTypeNeutral, InCorner: false},
			{TechType: model.OkiTechTypeNeutral, InCorner: true},
		},
	})
	if err != nil {
		t.Fatalf("create setup: %v", err)
	}
	if vres.HasError() {
		t.Fatalf("unexpected validation: %+v", vres.Issues)
	}

	if got := countSetupResults(t, db, base.ID); got != 2 {
		t.Fatalf("採用時に記録された結果 = %d 行, want 2", got)
	}
	// 記録されるのは成立(ok)のみ。不成立は採用ダイアログからは書けない。
	var ng int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE combo_id = ? AND result <> 'ok'`, base.ID).Scan(&ng); err != nil {
		t.Fatalf("count ng: %v", err)
	}
	if ng != 0 {
		t.Errorf("採用時に ok 以外が %d 行記録されている, want 0", ng)
	}
	// note は採用ダイアログでは扱わない。
	var withNote int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE combo_id = ? AND note IS NOT NULL`, base.ID).Scan(&withNote); err != nil {
		t.Fatalf("count note: %v", err)
	}
	if withNote != 0 {
		t.Errorf("採用時に note が %d 行書かれている, want 0", withNote)
	}
	if resp.Setup == nil || resp.Setup.ID == 0 {
		t.Errorf("セットプレイが作成されていない")
	}
}

// チェックせずに採用できる(既定は全て未チェック＝結果行 0 行)。
func TestCreateSetup_WithoutVerifiedConditions(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	move := lookupMoveID(t, db, 1, "standing_light_punch")

	setupSvc := newSetupSvc(t, db)
	name := "条件未チェックで採用"
	if _, vres, err := setupSvc.CreateSetup(context.Background(), base.ID, setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        &name,
		Steps:       []model.SetupStep{{StepOrder: 1, MoveID: &move}},
	}); err != nil {
		t.Fatalf("create setup: %v", err)
	} else if vres.HasError() {
		t.Fatalf("unexpected validation: %+v", vres.Issues)
	}

	if got := countSetupResults(t, db, base.ID); got != 0 {
		t.Errorf("未チェック採用時の結果 = %d 行, want 0", got)
	}
	if got := countSetups(t, db); got != 1 {
		t.Errorf("セットプレイが作成されていない: %d 件", got)
	}
}
