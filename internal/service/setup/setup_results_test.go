package setup_test

// セットプレイ成立条件のサービス層テスト(M19-03 §5.1-8 値域・多層防御)。

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// newSetupService は既存の newTestEnv を借りてサービスと DB を返す。
func newSetupService(t *testing.T) (*sql.DB, setupsvc.Service) {
	t.Helper()
	env := newTestEnv(t)
	return env.db, env.svc
}

// seedLinkedSetup は紐付け済みの (comboID, setupID) を 1 組作る。
func seedLinkedSetup(t *testing.T, db *sql.DB, svc setupsvc.Service) (int64, int64) {
	t.Helper()
	comboID := insertBareCombo(t, db)
	move := lookupMoveID(t, db, 1, "standing_light_punch")
	name := "検証用セットプレイ"
	resp, result, err := svc.CreateSetup(context.Background(), comboID, setupsvc.CreateSetupInput{
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
	return comboID, resp.Setup.ID
}

// insertBareCombo は最小構成のコンボを 1 件作る(紐付け不在ケース用)。
func insertBareCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	cRepo := comborepo.New(db)
	nSvc := notation.New(db, presetrepo.New(db), cRepo, setuprepo.New(db))
	return createTestCombo(t, db, cRepo, nSvc)
}

func TestUpsertResult_RejectsOutOfRangeValues(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	ctx := context.Background()

	cases := []struct {
		name  string
		input setupsvc.UpsertResultInput
	}{
		{"tech_type が値域外", setupsvc.UpsertResultInput{TechType: "quick_rise", InCorner: false, Result: model.SetupResultOK}},
		{"tech_type が空", setupsvc.UpsertResultInput{TechType: "", InCorner: false, Result: model.SetupResultOK}},
		{"result が値域外", setupsvc.UpsertResultInput{TechType: model.OkiTechTypeNeutral, InCorner: false, Result: "unstable"}},
		{"result が空", setupsvc.UpsertResultInput{TechType: model.OkiTechTypeNeutral, InCorner: false, Result: ""}},
		// 「未検証」を意味する result の値は作らない(未検証は行の有無で表す)。
		{"result に未検証相当の値", setupsvc.UpsertResultInput{TechType: model.OkiTechTypeNeutral, InCorner: false, Result: "unverified"}},
		{"result に position の値を流用", setupsvc.UpsertResultInput{TechType: model.OkiTechTypeNeutral, InCorner: false, Result: "corner_self"}},
		{"tech_type に position の値を流用", setupsvc.UpsertResultInput{TechType: "corner_opponent", InCorner: false, Result: model.SetupResultOK}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := svc.UpsertResult(ctx, comboID, setupID, c.input)
			if !errors.Is(err, setupsvc.ErrInvalidResultValue) {
				t.Errorf("err = %v, want ErrInvalidResultValue", err)
			}
		})
	}

	// 値域内は通る。
	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeBack, InCorner: true, Result: model.SetupResultNG,
	}); err != nil {
		t.Errorf("値域内の書き込みが失敗した: %v", err)
	}
}

func TestUpsertResult_RejectsWriteWithoutLink(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	otherComboID := insertBareCombo(t, db) // setupID と紐付いていない
	ctx := context.Background()

	err := svc.UpsertResult(ctx, otherComboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultOK,
	})
	if !errors.Is(err, setupsvc.ErrSetupLinkNotFound) {
		t.Errorf("err = %v, want ErrSetupLinkNotFound(API 層に届く前にサービス層で弾く多層防御)", err)
	}

	// 存在しない setup_id でも同様。
	err = svc.UpsertResult(ctx, comboID, 999999, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultOK,
	})
	if !errors.Is(err, setupsvc.ErrSetupLinkNotFound) {
		t.Errorf("存在しない setupId: err = %v, want ErrSetupLinkNotFound", err)
	}
}

func TestDeleteResult_ValidatesAndRequiresLink(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	otherComboID := insertBareCombo(t, db)
	ctx := context.Background()

	if err := svc.DeleteResult(ctx, comboID, setupID, "quick_rise", false); !errors.Is(err, setupsvc.ErrInvalidResultValue) {
		t.Errorf("値域外 techType: err = %v, want ErrInvalidResultValue", err)
	}
	if err := svc.DeleteResult(ctx, otherComboID, setupID, model.OkiTechTypeNeutral, false); !errors.Is(err, setupsvc.ErrSetupLinkNotFound) {
		t.Errorf("紐付け不在: err = %v, want ErrSetupLinkNotFound", err)
	}
}

// 三値の往復: 未検証 → 成立 → 不成立 → 未検証。
func TestUpsertAndDeleteResult_ThreeStateRoundTrip(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	ctx := context.Background()

	// 未検証(行なし)
	results, err := svc.ListResultsByComboID(ctx, comboID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("初期状態 = %d 行, want 0(未検証)", len(results))
	}

	// → 成立
	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultOK,
	}); err != nil {
		t.Fatalf("upsert ok: %v", err)
	}
	results, _ = svc.ListResultsByComboID(ctx, comboID)
	if len(results) != 1 || results[0].Result != model.SetupResultOK {
		t.Fatalf("成立への遷移が反映されていない: %+v", results)
	}

	// → 不成立(note 付き)
	note := "距離がシビア"
	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultNG, Note: &note,
	}); err != nil {
		t.Fatalf("upsert ng: %v", err)
	}
	results, _ = svc.ListResultsByComboID(ctx, comboID)
	if len(results) != 1 || results[0].Result != model.SetupResultNG {
		t.Fatalf("不成立への遷移が反映されていない: %+v", results)
	}
	if results[0].Note == nil || *results[0].Note != note {
		t.Errorf("note = %v, want %q", results[0].Note, note)
	}

	// → 未検証(物理削除)
	if err := svc.DeleteResult(ctx, comboID, setupID, model.OkiTechTypeNeutral, false); err != nil {
		t.Fatalf("delete: %v", err)
	}
	results, _ = svc.ListResultsByComboID(ctx, comboID)
	if len(results) != 0 {
		t.Errorf("未検証へ戻っていない: %+v", results)
	}
}

// note は成立(ok)のセルにも書ける(§4.4.3)。
func TestUpsertResult_NoteOnOkCell(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	ctx := context.Background()

	note := "端では距離がシビア"
	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeBack, InCorner: true, Result: model.SetupResultOK, Note: &note,
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	results, _ := svc.ListResultsByComboID(ctx, comboID)
	if len(results) != 1 {
		t.Fatalf("行数 = %d, want 1", len(results))
	}
	if results[0].Result != model.SetupResultOK || results[0].Note == nil || *results[0].Note != note {
		t.Errorf("成立セルの note が保存されていない: %+v", results[0])
	}
}

// 採用時の「確認できた条件」は値域検証され、値域外はセットプレイごと作られない。
func TestCreateSetup_VerifiedConditionsOutOfRange(t *testing.T) {
	db, svc := newSetupService(t)
	comboID := insertBareCombo(t, db)
	move := lookupMoveID(t, db, 1, "standing_light_punch")
	ctx := context.Background()

	name := "値域外チェック"
	_, _, err := svc.CreateSetup(ctx, comboID, setupsvc.CreateSetupInput{
		CharacterID:        1,
		Name:               &name,
		Steps:              []model.SetupStep{{StepOrder: 1, MoveID: &move}},
		VerifiedConditions: []setupsvc.SetupResultCondition{{TechType: "quick_rise", InCorner: false}},
	})
	if !errors.Is(err, setupsvc.ErrInvalidResultValue) {
		t.Fatalf("err = %v, want ErrInvalidResultValue", err)
	}
	// トランザクションが巻き戻り、セットプレイも作られていない。
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM setups`).Scan(&n); err != nil {
		t.Fatalf("count setups: %v", err)
	}
	if n != 0 {
		t.Errorf("値域外で失敗したのに setups が %d 件作られている", n)
	}
}

// ===========================================================================
// M23-02 §4.1-6 (b): ゴミ箱のセットプレイへ検証結果を書けないこと
// ===========================================================================

// TestUpsertResult_RejectsSoftDeletedSetup は、論理削除済みのセットプレイに対する
// 検証結果の書き込みが拒否されることを検査する(M23-02 §4.1-6 (b)・D-491)。
//
// ★案 P1 の撤回で「combo_setups の行は必ず生きたセットプレイを指す」という不変条件が
// 失われたため、紐付け存在確認が setups へ結合していないと、ゴミ箱に居るセットプレイへ
// 検証結果を書けてしまう。撤回前は combo_setups の行ごと消えていたため書けなかった。
// ⇒ 本サブが壊した不変条件の後始末であり、その歯止めが本テストである。
//
// ★画面から到達できるかどうかで線を引いていない。到達経路が後で増えたときに
// 誰も気づけないため、依存の有無で線を引く(D-491)。
func TestUpsertResult_RejectsSoftDeletedSetup(t *testing.T) {
	db, svc := newSetupService(t)
	comboID, setupID := seedLinkedSetup(t, db, svc)
	ctx := context.Background()

	// 先に 1 件書けることを確かめる(拒否が「常に拒否」ではないことの対照)。
	if err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeNeutral,
		InCorner: false,
		Result:   model.SetupResultOK,
	}); err != nil {
		t.Fatalf("論理削除前の UpsertResult が失敗した: %v", err)
	}

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// ★撤回により combo_setups の行は残っている。残っていることが前提のテストである。
	var links int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&links); err != nil {
		t.Fatalf("count links: %v", err)
	}
	if links != 1 {
		t.Fatalf("論理削除後の combo_setups 行数 = %d, want 1(案 P1 撤回により残る)", links)
	}

	err := svc.UpsertResult(ctx, comboID, setupID, setupsvc.UpsertResultInput{
		TechType: model.OkiTechTypeBack,
		InCorner: false,
		Result:   model.SetupResultOK,
	})
	if !errors.Is(err, setupsvc.ErrSetupLinkNotFound) {
		t.Fatalf("ゴミ箱のセットプレイへの UpsertResult = %v, want ErrSetupLinkNotFound", err)
	}

	if err := svc.DeleteResult(ctx, comboID, setupID, model.OkiTechTypeNeutral, false); !errors.Is(err, setupsvc.ErrSetupLinkNotFound) {
		t.Fatalf("ゴミ箱のセットプレイへの DeleteResult = %v, want ErrSetupLinkNotFound", err)
	}
}
