package migration_test

import (
	"database/sql"
	"testing"
)

// ★★★【M33-03・2026-09-19】本ファイルの終端は HEAD である。
//
// ⇒ 着手時点は「HEAD を終端にしない(SUPP-001 §5.5 の規約 (1))」と書いていたが、M33-02 が
// 旧 111 本を新系列 9 本へ潰した結果、閉じるべき区間そのものが 1 つしか無い。
// ★版数を名指しして区間を閉じる形は、機構ごと成立しなくなった。
//
// ⇒ したがって本ファイルのテストは「契約テスト」ではなく HEAD テストである。
// 落ちたときの正しい対応も変わる——実装を疑う前に、期待値の更新が正しいかを
// 見ること(SUPP-001 §5.5.2 規約 (2) の「扱いを混ぜない」)。
//
// ★★★名前空間は未解決である。規約 (2) は「HEAD スコープは migrate_head_test.go に
// TestRun_HEAD_* として置き、サブ名へ相乗りさせない」と定めるが、本ファイルは
// サブ名のままである。⇒ 移設するか規約 (2) を改めるかは設計卓の判断であり、
// M33-03 の設計伝達レポートへ CHANGE 原稿として回してある。

// M35-03(CHANGE なし・マイグレ 000111)の是正結果を固定する。
//
// 射程は 4 行——ラッシュ版 4 件の original_move_code が実在しない move_code を指していた
// (dangling)。一次源は DES-004 §3.2.1 の注記(`_1hits` とすべきところが `_1`。4 件)。
//
// ★★M35-02(000108)と壊れ方が違う。⇒ 同じなのは「三点更新」という形だけである。
//
//	ryu(000108)は move_code が壊れて入力面から到達できず original_move_id は正常だった。
//	本サブは original_move_code が壊れて original_move_id が NULL であり、入力面には出ていた。
//	⇒ 先例をそのまま写せない。★本ファイルが見るのは「参照が解けているか」であって
//	  「code が改名されたか」ではない。
//
// ★★直っている実害は 3 つ。うち 2 つはエラーにならず、動作は正しく見えていた。
//
//	(1) internal/service/setplay/service.go:144 が OriginalMoveID == nil のとき
//	    TargetType を "" にし、collectTargets(:641)が落とす。⇒ セットプレイ自動提案の
//	    候補から静かに脱落していた。★"" は system / SA / 元 special ラッシュと同じ
//	    バケツであり、データ欠陥と意図的除外が区別できない。
//	(2) 表記プリセット numeric / srk の別名が 0 行だった。生成器が「元技が実在しない」行を
//	    ReasonRushNoOriginal として合成から外すためである(D-305＝推測で当てない)。
//	    ★意図的な挙動であり生成器の欠陥ではない。
//	(3) ★★★4 技をレシピに入れると保存が 400 になっていた(2026-09-11 判明)。
//	    VAL-C12(internal/service/validation/combo.go:483-499)が original_move_id の NULL で
//	    ERROR を立て、internal/service/combo/service.go:368 が巻き戻す。
//	    ★4 技は入力面に出ていた。⇒ 編集画面から選べるのに保存できなかった。
//	    ★3 件のうち唯一、利用者にエラーとして見えていた経路である。
//	    対の床は internal/service/validation/combo_test.go の
//	    TestC12_RushVariant_OriginalIDIsNull にある。
//
// ★本ファイルは「件数」ではなく「v111 時点の状態」と「往復」で固定する
//
//	(SUPP-001 §5.5.4 (6))。golden 3 本(000026 / 000072 / 000073)にも同じ是正を入れて
//	あるため、新規 DB は v26 / v72 / v73 の時点で既に是正後である。⇒ 000111 の UPDATE は
//	0 行に当たり、INSERT は NOT EXISTS で弾かれる。「N 行に当たった」で固定すると
//	CI では常に 0 行になるため何も守れない。
//
// 判定値は const / var に置き、テスト名には数字を埋め込まない(M14-03d §3.3-1 /
// followup `migration-version-literals-in-tests`)。

// m3503Rows は是正した 4 行と、期待する別名である。
//
// ★別名の値は再生成した golden の写しである(000072 / 000073 の ingrid / lily / mai ブロック)。
//
//	両プリセットで同値になるのは、元技 4 件がいずれも「方向 + 強度 + ボタン」形
//	(4MK / 4HP / 6HP / 4HK)であり srk が numeric のまま残す領域だからである。
var m3503Rows = []struct{ char, rush, base, alias string }{
	{"ingrid", "rush_glowing_touch_1hits", "glowing_touch_1hits", "DR > 4MK"},
	{"ingrid", "rush_luminous_uppercut_1hits", "luminous_uppercut_1hits", "DR > 4HP"},
	{"lily", "rush_desert_storm_1hits", "desert_storm_1hits", "DR > 6HP"},
	{"mai", "rush_hoshi_kujaku_1hits", "hoshi_kujaku_1hits", "DR > 4HK"},
}

// m3503Control は本サブで 1 文字も触らない対照である。
//
// ★zangief/rush_power_stomps_1hits は original_move_code が最初から正しく解決しており、
//
//	是正前から numeric / srk に `DR > 22MK` を 1 行ずつ持っていた。
//	⇒ ここが動いたら、生成器の別の枝か、マイグレの絞りが広すぎる。
const (
	m3503ControlChar  = "zangief"
	m3503ControlRush  = "rush_power_stomps_1hits"
	m3503ControlBase  = "power_stomps_1hits"
	m3503ControlAlias = "DR > 22MK"
)

const m3503Terminus = 111

// m3503OriginalBaseCode は rush 技の original_move_id が指す move の code を返す。
// 解決できていなければ空文字を返す。
//
// ★キャラを JOIN で絞る。moves.code はテーブル全体では一意ではない(UNIQUE は
//
//	(character_id, code))。code だけで引くと他キャラの同名を巻き込む。
func m3503OriginalBaseCode(t *testing.T, db *sql.DB, char, rush string) string {
	t.Helper()
	var code sql.NullString
	err := db.QueryRow(`SELECT b.code FROM moves m
		JOIN characters c ON c.id = m.character_id
		LEFT JOIN moves b ON b.id = m.original_move_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
		  AND m.code = ?`, char, rush).Scan(&code)
	if err != nil {
		t.Fatalf("original base of %s/%s: %v", char, rush, err)
	}
	return code.String
}

// m3503Alias は指定プリセットでの別名を返す(0 行なら空文字、複数行なら '|' 連結)。
func m3503Alias(t *testing.T, db *sql.DB, preset, char, code string) string {
	t.Helper()
	var s string
	err := db.QueryRow(`SELECT COALESCE(group_concat(pa.alias_text, '|' ORDER BY pa.alias_text), '')
		FROM preset_aliases pa
		JOIN moves m ON m.id = pa.move_id
		JOIN characters c ON c.id = m.character_id
		WHERE pa.preset_id = (SELECT id FROM presets WHERE code = ?)
		  AND c.code = ? AND m.code = ?`, preset, char, code).Scan(&s)
	if err != nil {
		t.Fatalf("alias of %s %s/%s: %v", preset, char, code, err)
	}
	return s
}

// assertCorrectedM3503 は「是正後」の状態を主張する。
func assertCorrectedM3503(t *testing.T, db *sql.DB, at string) {
	t.Helper()
	for _, r := range m3503Rows {
		// ★id の同一性まで見る(SUPP-001 §5.5.4 (8)(iii))。「非 NULL である」だけだと
		//   別の move を指してしまった形を取り落とす。
		if got := m3503OriginalBaseCode(t, db, r.char, r.rush); got != r.base {
			t.Errorf("%s: %s/%s の original_move_id が指す code = %q, want %q",
				at, r.char, r.rush, got, r.base)
		}
		for _, p := range []string{"numeric", "srk"} {
			if got := m3503Alias(t, db, p, r.char, r.rush); got != r.alias {
				t.Errorf("%s: %s の %s/%s の別名 = %q, want %q(1 行ちょうど)",
					at, p, r.char, r.rush, got, r.alias)
			}
			// ★★character_id まで見る。⇒ `IS NOT NULL` では足りず、moves.character_id との
			//   一致を主張する(000074 の列・000075 の UNIQUE 索引 2 本の構成列)。
			//   ★NULL でも INSERT は通り alias は画面にも出るため、動作では気づけない
			//     (M31-04 教訓 §7-1)。
			n := scanInt(t, db, `SELECT count(*) FROM preset_aliases pa
				JOIN moves m ON m.id = pa.move_id
				JOIN characters c ON c.id = m.character_id
				WHERE pa.preset_id = (SELECT id FROM presets WHERE code = ?)
				  AND c.code = ? AND m.code = ?
				  AND pa.character_id IS NOT NULL AND pa.character_id = m.character_id`,
				p, r.char, r.rush)
			if n != 1 {
				t.Errorf("%s: %s の %s/%s で character_id が move と一致する行 = %d, want 1",
					at, p, r.char, r.rush, n)
			}
		}
	}
	assertControlM3503(t, db, at)
}

// assertControlM3503 は対照が動いていないことを主張する。
func assertControlM3503(t *testing.T, db *sql.DB, at string) {
	t.Helper()
	if got := m3503OriginalBaseCode(t, db, m3503ControlChar, m3503ControlRush); got != m3503ControlBase {
		t.Errorf("%s: 対照 %s/%s の元技 = %q, want %q", at, m3503ControlChar, m3503ControlRush, got, m3503ControlBase)
	}
	for _, p := range []string{"numeric", "srk"} {
		if got := m3503Alias(t, db, p, m3503ControlChar, m3503ControlRush); got != m3503ControlAlias {
			t.Errorf("%s: 対照 %s の %s/%s の別名 = %q, want %q",
				at, p, m3503ControlChar, m3503ControlRush, got, m3503ControlAlias)
		}
	}
}

// TestRun_M3503_CorrectedState は v111 時点の最終状態を固定する。
func TestRun_M3503_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	assertCorrectedM3503(t, db, "v111")
}

// TestRun_M3503_NoDanglingRushRemains は「元技を解決できない rush_variant が 0 行」を
// 母数付きで固定する。
//
// ★★上の 4 行を名指しで見るテストだけだと、5 件目の dangling が生まれても気づけない。
//
//	★母数を添えるのは「0 件」が「何も見ていない」と読めないようにするためである。
func TestRun_M3503_NoDanglingRushRemains(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	total := scanInt(t, db, `SELECT count(*) FROM moves WHERE category = 'rush_variant'`)
	if total == 0 {
		t.Fatalf("rush_variant が 0 行(母集団が壊れている)")
	}
	if n := scanInt(t, db, `SELECT count(*) FROM moves
		WHERE category = 'rush_variant' AND original_move_id IS NULL`); n != 0 {
		t.Errorf("元技を解決できない rush_variant = %d 行, want 0(母数 %d 行)", n, total)
	}
	t.Logf("v%d 時点の rush_variant = %d 行・うち original_move_id が NULL = 0 行", m3503Terminus, total)
}
