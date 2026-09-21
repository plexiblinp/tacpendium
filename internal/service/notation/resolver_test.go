package notation_test

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func lookupMoveID(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

func lookupPresetIDByCode(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM presets WHERE code = ?`, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup preset id (code=%s): %v", code, err)
	}
	return id
}

func newNotationSvc(t *testing.T) (*sql.DB, notation.Service) {
	t.Helper()
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	return db, notation.New(db, pRepo, cRepo, sRepo)
}

func ptrInt64(i int64) *int64 { return &i }
func ptrStr(s string) *string { return &s }

// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture へ数値欄を入れるためのヘルパ。
// ★M38-01 追補2 の時点で必須は 2 欄である。⇒ 「必須 4 欄のためのヘルパ」ではない。
func intPtr(i int) *int           { return &i }
func floatPtr(f float64) *float64 { return &f }

func TestRenderSteps_OfficialJaMove(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1), MoveCode: ptrStr("standing_light_punch")},
		{StepOrder: 2, MoveID: ptrInt64(move2), MoveCode: ptrStr("hadoken_light")},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	expected := "立ち弱P > 弱波動拳"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

// ★M20-02(2026-08-13)で対象 move を付け替えた。
//
// 旧: numeric x standing_light_punch。numeric がエイリアス空だったため必ずフォールバックし、
// 「立ち弱P」が出ていた。M20-02 で numeric へ実データが入り(5LP)、フォールバックしなくなった。
// ⇒ 落ちるべくして落ちたテストである。期待値を緩めるのではなく、
// フォールバックが実際に起きる move へ付け替えて主張を保った(D-308)。
//
// 新: numeric x ryu/denjin_charge_hadoken。同 move は is_derived=true で生成規則の
// 層 A の対象外(U-2)であり、numeric / srk のどちらにもエイリアスが無い。
// ⇒ DES-004 §5.3 の 2 段目(official_ja_move で解決)が働き「[電刃錬気]波動拳」が出る。
//
// ★これは仕様どおりの縮退であって欠陥ではない(指示書 §4.8)。3 段目(moves.code 素出し)へ
// 落ちる行が 0 件であることは migrate_m2002_test.go が別に固定している。
func TestRenderSteps_FallbackToOfficialJaMove(t *testing.T) {
	db, svc := newNotationSvc(t)
	numericID := lookupPresetIDByCode(t, db, "numeric")
	move1 := lookupMoveID(t, db, 1, "denjin_charge_hadoken")

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1), MoveCode: ptrStr("denjin_charge_hadoken")},
	}

	text, err := svc.RenderSteps(context.Background(), numericID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if text != "[電刃錬気]波動拳" {
		t.Errorf("text = %q, want %q (fallback to official_ja_move)", text, "[電刃錬気]波動拳")
	}
}

// TestRenderSteps_NumericPresetUsesRealData は M20-02 の投入が表示へ届いていることを守る。
//
// ★旧 TestRenderSteps_FallbackToOfficialJaMove が守っていた「numeric は空」の裏返しである。
// 同テストを付け替えただけだと「numeric に実データが入った」ことを守る資産が 1 つも
// 無くなるため、対で新設する。
func TestRenderSteps_NumericPresetUsesRealData(t *testing.T) {
	db, svc := newNotationSvc(t)
	numericID := lookupPresetIDByCode(t, db, "numeric")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1), MoveCode: ptrStr("standing_light_punch")},
		{StepOrder: 2, MoveID: ptrInt64(move2), MoveCode: ptrStr("hadoken_light")},
	}

	text, err := svc.RenderSteps(context.Background(), numericID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	// DES-004 §3.4 サンプル表の固定点(層 B の 5LP と層 A の 236LP)を連結子 '>' で結合した形。
	if want := "5LP > 236LP"; text != want {
		t.Errorf("text = %q, want %q(numeric の実データが表示へ届いていない)", text, want)
	}
}

func TestRenderSteps_FallbackToMoveCode(t *testing.T) {
	_, svc := newNotationSvc(t)

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(99999), MoveCode: ptrStr("unknown_move")},
	}

	text, err := svc.RenderSteps(context.Background(), 1, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if text != "unknown_move" {
		t.Errorf("text = %q, want %q", text, "unknown_move")
	}
}

func TestRenderSteps_NonMoveStep(t *testing.T) {
	_, svc := newNotationSvc(t)

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    nil,
			Modifiers: &model.Modifiers{Type: model.ModifierTypeParryDriveRush},
		},
	}

	text, err := svc.RenderSteps(context.Background(), 1, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if text != "生ラッシュ" {
		t.Errorf("text = %q, want %q", text, "生ラッシュ")
	}
}

func TestRenderSteps_WithFlags(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    ptrInt64(move1),
			MoveCode:  ptrStr("standing_light_punch"),
			Modifiers: &model.Modifiers{Flags: []string{"low_jump"}},
		},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	// ★★★M37-06(§2.2): 「低ジャンプ」から「低空」へ変えた。**意図した床の更新である。**
	//   理由＝「低ジャンプ」は一般語から遠い(M37-DESIGN-01 §4.3-1)。★M37-02 は
	//   サーバ側の「最低空」をフロントの「低ジャンプ」へ揃えたが、揃える向きが逆であった。
	//   ⇒ 本サブは設計書とフロントの側を「低空」へ直し、サーバもそこへ合わせる。
	//   ★★コードは `low_jump` のまま(CHANGE-057＝flag コードは内部正典として不変)。
	//
	// 以下は前版の記述: ★★M37-02(B05-3): 「最低空」から「低ジャンプ」へ変えた。
	expected := "立ち弱P {低空}"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

func TestRenderSteps_Connector(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "standing_medium_punch")
	move3 := lookupMoveID(t, db, 1, "hadoken_medium")

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1), MoveCode: ptrStr("standing_light_punch")},
		{StepOrder: 2, MoveID: ptrInt64(move2), MoveCode: ptrStr("standing_medium_punch")},
		{StepOrder: 3, MoveID: ptrInt64(move3), MoveCode: ptrStr("hadoken_medium")},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	expected := "立ち弱P > 立ち中P > 中波動拳"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

func TestRenderSteps_WithNotes(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    ptrInt64(move1),
			MoveCode:  ptrStr("standing_light_punch"),
			Modifiers: &model.Modifiers{Notes: "目押し1F"},
		},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	expected := "立ち弱P (目押し1F)"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

func TestRenderSteps_WithFlagsAndNotes(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    ptrInt64(move1),
			MoveCode:  ptrStr("standing_light_punch"),
			Modifiers: &model.Modifiers{
				Flags: []string{"link"},
				Notes: "目押し1F",
			},
		},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	expected := "立ち弱P {目押し} (目押し1F)"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

func TestRenderSteps_NotesOnNonMoveStep(t *testing.T) {
	_, svc := newNotationSvc(t)

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    nil,
			Modifiers: &model.Modifiers{
				Type:  model.ModifierTypeParryDriveRush,
				Notes: "ヒット確認",
			},
		},
	}

	text, err := svc.RenderSteps(context.Background(), 1, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	expected := "生ラッシュ (ヒット確認)"
	if text != expected {
		t.Errorf("text = %q, want %q", text, expected)
	}
}

func TestRenderSteps_WithEmptyNotes(t *testing.T) {
	db, svc := newNotationSvc(t)
	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	steps := []model.ComboStep{
		{
			StepOrder: 1,
			MoveID:    ptrInt64(move1),
			MoveCode:  ptrStr("standing_light_punch"),
			Modifiers: &model.Modifiers{Notes: ""},
		},
	}

	text, err := svc.RenderSteps(context.Background(), presetID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if text != "立ち弱P" {
		t.Errorf("text = %q, want %q (empty notes should not produce parentheses)", text, "立ち弱P")
	}
	if strings.Contains(text, "(") {
		t.Errorf("text = %q, should not contain parentheses for empty notes", text)
	}
}

func TestRenderSteps_EmptySteps(t *testing.T) {
	_, svc := newNotationSvc(t)

	text, err := svc.RenderSteps(context.Background(), 1, nil)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if text != "" {
		t.Errorf("text = %q, want empty", text)
	}
}
