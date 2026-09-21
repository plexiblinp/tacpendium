package inputresolve_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/moveindex"
	movecommandrepo "github.com/plexiblinp/tacpendium/internal/repository/movecommand"
	"github.com/plexiblinp/tacpendium/internal/service/inputresolve"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// stubRepo は畳み込み規則の unit テスト用スタブ(movecommand.Repository を満たす)。
type stubRepo struct {
	rows []movecommandrepo.Row
}

func (s *stubRepo) ListByCharacter(_ context.Context, _ int64) ([]movecommandrepo.Row, error) {
	return s.rows, nil
}

func (s *stubRepo) LoadIndex(_ context.Context) (*moveindex.Index, error) {
	panic("段階2 の畳み込みは LoadIndex を使わない(M17-04 用 IF)")
}

func resolve(t *testing.T, rows []movecommandrepo.Row) map[string]string {
	t.Helper()
	svc := inputresolve.New(&stubRepo{rows: rows})
	got, err := svc.CommandIndex(context.Background(), 1)
	if err != nil {
		t.Fatalf("CommandIndex: %v", err)
	}
	return got
}

func TestCommandIndex_SpecialPriority(t *testing.T) {
	// 同一 token_key に unique と normal → unique を採る(request §1.2)。
	got := resolve(t, []movecommandrepo.Row{
		{MoveID: 1, MoveCode: "standing_heavy_punch", TokenKey: "6HP", Category: "normal"},
		{MoveID: 9, MoveCode: "solar_plexus_strike", TokenKey: "6HP", Category: "unique"},
	})
	if got["6HP"] != "solar_plexus_strike" {
		t.Errorf("6HP = %q; want solar_plexus_strike(特殊技優先)", got["6HP"])
	}
}

func TestCommandIndex_IDMinTiebreak(t *testing.T) {
	// 同格(unique 同士)が複数 → moves.id 最小(決定論タイブレーク)。
	got := resolve(t, []movecommandrepo.Row{
		{MoveID: 20, MoveCode: "later_move", TokenKey: "6MP", Category: "unique"},
		{MoveID: 5, MoveCode: "earlier_move", TokenKey: "6MP", Category: "unique"},
	})
	if got["6MP"] != "earlier_move" {
		t.Errorf("6MP = %q; want earlier_move(id 最小)", got["6MP"])
	}
}

func TestCommandIndex_ExcludesAerial(t *testing.T) {
	// 空中特殊技は解決表から除外(§1.5-4)。lily/great_spin 実データ形。
	got := resolve(t, []movecommandrepo.Row{
		{MoveID: 1, MoveCode: "crouching_heavy_punch", TokenKey: "2HP", Category: "normal"},
		{MoveID: 2, MoveCode: "great_spin", TokenKey: "2HP", Category: "unique", IsAerial: true},
	})
	if got["2HP"] != "crouching_heavy_punch" {
		t.Errorf("2HP = %q; want crouching_heavy_punch(空中除外後の通常技)", got["2HP"])
	}
}

func TestCommandIndex_ShapeFilter(t *testing.T) {
	// 段階2 形状以外(溜め/一回転/モーション/複数ボタン/接続子/強度なし)は表に載せない=直接指定へ。
	rows := []movecommandrepo.Row{
		{MoveID: 1, MoveCode: "hadoken_light", TokenKey: "236LP", Category: "special"},
		{MoveID: 2, MoveCode: "sonic_boom_light", TokenKey: "[4]6LP", Category: "special"},
		{MoveID: 3, MoveCode: "spd_any", TokenKey: "360P", Category: "special"},
		{MoveID: 4, MoveCode: "some_od", TokenKey: "214K+K", Category: "special"},
		{MoveID: 5, MoveCode: "target_like", TokenKey: "MP>HP", Category: "unique"},
		{MoveID: 6, MoveCode: "hold_move", TokenKey: "HK(hold)", Category: "unique"},
		{MoveID: 7, MoveCode: "any_strength", TokenKey: "6P", Category: "unique"},
		{MoveID: 8, MoveCode: "ok_move", TokenKey: "3HP", Category: "unique"},
		{MoveID: 9, MoveCode: "ok_button_only", TokenKey: "MP", Category: "normal"},
	}
	got := resolve(t, rows)
	if len(got) != 2 || got["3HP"] != "ok_move" || got["MP"] != "ok_button_only" {
		t.Errorf("解決表 = %v; want {3HP: ok_move, MP: ok_button_only} のみ", got)
	}
}

func TestCommandIndex_CategoryGuard(t *testing.T) {
	// normal/unique/special 以外は形状が合致しても表に載せない(意味的に決めきれない/スコープ外)。
	got := resolve(t, []movecommandrepo.Row{
		{MoveID: 1, MoveCode: "some_throw", TokenKey: "4HP", Category: "throw"},
		{MoveID: 2, MoveCode: "some_sa", TokenKey: "2HK", Category: "super_art"},
		{MoveID: 3, MoveCode: "ok_move", TokenKey: "6HP", Category: "unique"},
	})
	if len(got) != 1 || got["6HP"] != "ok_move" {
		t.Errorf("解決表 = %v; want {6HP: ok_move} のみ", got)
	}
}

func TestCommandIndex_InvalidCharacterID(t *testing.T) {
	svc := inputresolve.New(&stubRepo{})
	if _, err := svc.CommandIndex(context.Background(), 0); !errors.Is(err, inputresolve.ErrInvalidCharacterID) {
		t.Fatalf("err = %v; want ErrInvalidCharacterID", err)
	}
}

// ---- 実データ(dbtest=マイグレ 000035 まで適用)での統合検証 ----

func realCharID(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(
		`SELECT id FROM characters WHERE code = ? AND game_id IN (SELECT id FROM games WHERE code = 'sf6')`,
		code).Scan(&id); err != nil {
		t.Fatalf("charID(%s): %v", code, err)
	}
	return id
}

func TestCommandIndex_RealData(t *testing.T) {
	db := dbtest.Setup(t)
	svc := inputresolve.New(movecommandrepo.New(db))
	ctx := context.Background()

	cases := []struct {
		char, token, want string
	}{
		// 単方向+ボタンの特殊技(unique)。
		{"ryu", "6MP", "collarbone_breaker"},
		{"ryu", "6HP", "solar_plexus_strike"},
		{"ryu", "4HP", "short_uppercut"},
		{"lily", "3HP", "ridge_thrust"},
		// しゃがみ通常技(解決表経由でも段階1 と同じ出口)。
		{"ryu", "2MP", "crouching_medium_punch"},
		// 空中特殊技との衝突が is_aerial 除外で解消される実データ 3 件(§1.5-4・実測 2026-07-16)。
		{"lily", "2HP", "crouching_heavy_punch"},      // great_spin(空中)ではない
		{"kimberly", "2MP", "crouching_medium_punch"}, // elbow_drop(空中)ではない
		{"zangief", "2HP", "crouching_heavy_punch"},   // flying_body_press(空中)ではない
	}
	for _, tc := range cases {
		entries, err := svc.CommandIndex(ctx, realCharID(t, db, tc.char))
		if err != nil {
			t.Fatalf("CommandIndex(%s): %v", tc.char, err)
		}
		if got := entries[tc.token]; got != tc.want {
			t.Errorf("%s[%s] = %q; want %q", tc.char, tc.token, got, tc.want)
		}
		// 死守契約: モーション・溜め・一回転キーは表に無い(直接指定へ)。
		for k := range entries {
			if len(k) > 3 {
				t.Errorf("%s: 段階2 形状外のキー %q が解決表に混入", tc.char, k)
			}
		}
	}

	// ジャンプ攻撃(is_aerial)がボタン単独キーを奪わない: 立ち通常技が勝つ。
	entries, err := svc.CommandIndex(ctx, realCharID(t, db, "ryu"))
	if err != nil {
		t.Fatalf("CommandIndex(ryu): %v", err)
	}
	if got := entries["MP"]; got != "standing_medium_punch" {
		t.Errorf("ryu[MP] = %q; want standing_medium_punch(ジャンプ攻撃は除外)", got)
	}

	// 索引を持たないキャラ(未 seed=存在しない id と同一経路)は空(壊れない=段階1 のみが動く)。
	// 仮データキャラ(classic5)へは依存しない。
	empty, err := svc.CommandIndex(ctx, 999999)
	if err != nil {
		t.Fatalf("CommandIndex(999999): %v", err)
	}
	if len(empty) != 0 {
		t.Errorf("未 seed キャラの解決表 = %d 件; want 0", len(empty))
	}
}

// ── M21-06 §4.6: モーション用の素通し経路 ────────────────────────────────────

// motionRows は「段階2 の形状フィルタに落ちる行」を含むスタブ入力。
// ★236LP / 236236P / 623HP / [4]6HP は stage2KeyPattern に合致せず CommandIndex からは落ちる。
func motionRows() []movecommandrepo.Row {
	return []movecommandrepo.Row{
		{MoveID: 1, MoveCode: "crouching_medium_punch", TokenKey: "2MP", Category: "normal"},
		{MoveID: 2, MoveCode: "hadoken_light", TokenKey: "236LP", Category: "special"},
		{MoveID: 3, MoveCode: "sa1_shinku_hadoken", TokenKey: "236236P", Category: "super_art"},
		{MoveID: 4, MoveCode: "shoryuken_heavy", TokenKey: "623HP", Category: "special"},
		{MoveID: 5, MoveCode: "sonic_boom_heavy", TokenKey: "[4]6HP", Category: "special"},
		// 同一 token_key に 2 技(CA と SA3 が同一コマンドである実データの型)。
		{MoveID: 6, MoveCode: "ca_shin_shoryuken", TokenKey: "236236K", Category: "critical_art"},
		{MoveID: 7, MoveCode: "sa3_shin_shoryuken", TokenKey: "236236K", Category: "super_art"},
		// 空中技(CommandIndex は is_aerial を落とすが、本経路は落とさない)。
		{MoveID: 8, MoveCode: "aerial_tatsumaki_senpu_kyaku", TokenKey: "214K", Category: "special", IsAerial: true},
	}
}

func motionCommands(t *testing.T, rows []movecommandrepo.Row) []inputresolve.MotionCommand {
	t.Helper()
	svc := inputresolve.New(&stubRepo{rows: rows})
	got, err := svc.MotionCommands(context.Background(), 1)
	if err != nil {
		t.Fatalf("MotionCommands: %v", err)
	}
	return got
}

// ★本サブの核心。多方向コマンドが 1 件も落ちないこと(§4.6 の存在理由そのもの)。
func TestMotionCommands_KeepsMultiDirectionCommands(t *testing.T) {
	got := motionCommands(t, motionRows())
	if len(got) != len(motionRows()) {
		t.Fatalf("件数 = %d, want %d(素通しであり絞り込まない)", len(got), len(motionRows()))
	}
	byToken := map[string][]string{}
	for _, c := range got {
		byToken[c.TokenKey] = append(byToken[c.TokenKey], c.MoveCode)
	}
	for _, token := range []string{"236LP", "236236P", "623HP", "[4]6HP", "214K"} {
		if len(byToken[token]) == 0 {
			t.Errorf("token %q が落ちている(段階2 の形状フィルタを通してはならない)", token)
		}
	}
}

// ★同一 token_key を畳まないこと。畳むと §4.2-4「同じ長さで複数残るなら解決しない」が
// FE 側で表現できなくなる(どちらか 1 技が黙って選ばれた結果しか届かない)。
func TestMotionCommands_DoesNotFoldDuplicateTokenKeys(t *testing.T) {
	got := motionCommands(t, motionRows())
	var codes []string
	for _, c := range got {
		if c.TokenKey == "236236K" {
			codes = append(codes, c.MoveCode)
		}
	}
	if len(codes) != 2 {
		t.Fatalf("236236K の件数 = %d (%v), want 2(CA と SA3 の両方が残る)", len(codes), codes)
	}
}

func TestMotionCommands_UnseededIsEmptyNotError(t *testing.T) {
	got := motionCommands(t, nil)
	if len(got) != 0 {
		t.Errorf("件数 = %d, want 0(未 seed は空・エラーにしない)", len(got))
	}
}

func TestMotionCommands_InvalidCharacterID(t *testing.T) {
	svc := inputresolve.New(&stubRepo{})
	for _, id := range []int64{0, -1} {
		if _, err := svc.MotionCommands(context.Background(), id); !errors.Is(err, inputresolve.ErrInvalidCharacterID) {
			t.Errorf("characterID=%d: err = %v, want ErrInvalidCharacterID", id, err)
		}
	}
}

// ★§4.6-2 の対照。**MotionCommands を足しても CommandIndex の結果が 1 件も変わらないこと。**
//
// 同じ行集合を両方へ通し、CommandIndex 側が従来どおり「段階2 の形状に合う行だけ・畳み済み」で
// あることを固定する。これが崩れると仮想コントローラの一様フォールバックが静かに変わる。
func TestCommandIndex_UnchangedByMotionPath(t *testing.T) {
	got := resolve(t, motionRows())
	// 段階2 の形状に合うのは "2MP" だけ(他は多方向・溜め・OD 等で形状フィルタに落ちる)。
	if len(got) != 1 {
		t.Fatalf("entries = %v, want 1 件のみ(段階2 の絞り込みが変わっている)", got)
	}
	if got["2MP"] != "crouching_medium_punch" {
		t.Errorf("entries[2MP] = %q, want crouching_medium_punch", got["2MP"])
	}
	for _, token := range []string{"236LP", "236236P", "623HP", "[4]6HP", "236236K", "214K"} {
		if _, ok := got[token]; ok {
			t.Errorf("entries に %q が載っている。★段階2 の絞り込みを広げてはならない(§4.6-1)", token)
		}
	}
}
