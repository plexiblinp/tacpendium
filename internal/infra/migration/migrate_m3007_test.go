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

// M30-07(CHANGE なし・マイグレ 000112)の是正結果を固定する。
//
// 射程は 10 行——guile の【ジャスト】版 move_code を接頭形 `perfect_timing_<強度>_<技>` から
// 接尾形 `<技>_perfect_<強度>` へ揃える。一次源は開発者の裁定(2026-09-12・D-836。
// 逐語＝「Seed側を修正します」)。
//
// ★★直っている実害 —— 同じ「【ジャスト】版」という UI 概念が、キャラによって別の見え方を
//
//	していた。web/src/features/combo/inputResolution.ts の splitSpecialVariant は変種接尾辞
//	(`_max_holding` / `_holding` / `_perfect`)を接尾形でしか見ない。
//	⇒ luke の `flash_knuckle_perfect_light` は基底へ畳まれて変種軸で選べるのに、
//	  guile の `perfect_timing_light_sonic_boom` は畳まれず別ファミリー 3 行として並んでいた。
//	★エラーにはならず「並び方が違うだけ」であり、どのテストも赤くならなかった。
//
// ★本ファイルは「件数」ではなく「v112 時点の状態」で固定する(SUPP-001 §5.5.4 (6))。
//
//	golden 2 本(000026 / 000034)にも同じ是正を入れてあるため、新規 DB は最初から是正後の
//	code で seed される。したがって 000112 の UPDATE は新規 DB では 1 行も当たらず、それでも
//	成功する。「UPDATE が 10 行に当たった」で固定すると、CI では常に 0 行になるため何も守れない。
//
// 判定値は const に置き、テスト名には数字を埋め込まない(M14-03d §3.3-1 /
// followup `migration-version-literals-in-tests`)。
const m3007Char = "guile"

const ()

// m3007Renames は改名の全数(旧 code -> 新 code)。
//
// ★旧 0 件・新 1 件を **対で**固定する。片方だけだと「旧が残っている」か「新が増えている」かの
//
//	どちらかを取り落とす。
var m3007Renames = []struct{ old, neu string }{
	{"perfect_timing_light_sonic_boom", "sonic_boom_perfect_light"},
	{"perfect_timing_medium_sonic_boom", "sonic_boom_perfect_medium"},
	{"perfect_timing_heavy_sonic_boom", "sonic_boom_perfect_heavy"},
	{"perfect_timing_light_somersault_kick", "somersault_kick_perfect_light"},
	{"perfect_timing_medium_somersault_kick", "somersault_kick_perfect_medium"},
	{"perfect_timing_heavy_somersault_kick", "somersault_kick_perfect_heavy"},
	{"perfect_timing_light_sonic_cross", "sonic_cross_perfect_light"},
	{"perfect_timing_medium_sonic_cross", "sonic_cross_perfect_medium"},
	{"perfect_timing_heavy_sonic_cross", "sonic_cross_perfect_heavy"},
	{"perfect_timing_sonic_cross_od", "sonic_cross_perfect_od"},
}

// m3007Projectiles は新 code のうち is_projectile = 1 でなければならないもの。
//
// ★★出所は 000039 の guile の code 列挙である(サマーソルトキックは飛び道具ではないので入らない)。
//
//	⇒ 本表は「000039 の列挙が新 code へ追随できているか」を測る対照そのものである。
//	  追随を落とすと、新規 DB では v39 の UPDATE が 1 行も当たらず、is_projectile が静かに
//	  0 のまま残る。★エラーにはならず、有利フレーム自動走査が相手技候補として誤って拾うだけである。
var m3007Projectiles = []string{
	"sonic_boom_perfect_light", "sonic_boom_perfect_medium", "sonic_boom_perfect_heavy",
	"sonic_cross_perfect_light", "sonic_cross_perfect_medium", "sonic_cross_perfect_heavy",
	"sonic_cross_perfect_od",
}

// m3007Cross2 は 000063 の B-2 が空けた code。
//
// ★★★本サブ固有の危険はここに在る。000063 B-2 は
//
//	`code = 'sonic_cross_2_meter_od' AND NOT EXISTS(改名先)` という形で改名を当てる。
//	改名先が旧 code のまま残っていると、新規 DB では「改名先が不在」に見えてガードが**反転して通り**、
//	ODソニッククロス２ が【ジャスト】側の旧 code へ誤改名される。
//	⇒ 続く 000064 が別の技へ startup_basis と move_derivations を書き込む。
//	★本 const と TestRun_M3007_NoResurrectedOldCode がその形を赤で捕まえる床である。
const m3007Cross2 = "sonic_cross_2_meter_od"

// countCodeM3007 は指定キャラの指定 code の件数を返す。
//
// ★キャラを JOIN で絞る。moves.code はテーブル全体では一意ではなく(UNIQUE は
//
//	(character_id, code))、code だけで数えると他キャラの同名を巻き込む。
func countCodeM3007(t *testing.T, db *sql.DB, code string) int {
	t.Helper()
	return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
		m3007Char, code)
}

// moveIDM3007 は指定 code の moves.id を返す。
func moveIDM3007(t *testing.T, db *sql.DB, code string) int {
	t.Helper()
	return scanInt(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
		m3007Char, code)
}

// assertRenamedM3007 は「是正後」の状態を主張する。
func assertRenamedM3007(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, r := range m3007Renames {
		if got := countCodeM3007(t, db, r.old); got != 0 {
			t.Errorf("是正後の %s %s = %d 件, want 0", m3007Char, r.old, got)
		}
		if got := countCodeM3007(t, db, r.neu); got != 1 {
			t.Errorf("是正後の %s %s = %d 件, want 1", m3007Char, r.neu, got)
		}
	}
}

// TestRun_M3007_CorrectedState は v112 時点の最終状態を固定する。
func TestRun_M3007_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	assertRenamedM3007(t, db)
}

// TestRun_M3007_VariantFoldsIntoBase は本サブの目的そのものを固定する——
// 「新 code が `<基底>_perfect_<強度>` の形になっており、その基底が同じキャラに実在する」こと。
//
// ★★これが splitSpecialVariant が畳むための必要十分条件である。
//
//	同関数は変種接尾辞を剥がした基底が**実在するときだけ**畳む。
//	⇒ 基底の実在まで見ないと、「命名は接尾形になったが基底が無く、やはり別ファミリーのまま」を通す。
//
// ★luke 側は 1 文字も触っていない。⇒ 対照として同じ形が成立していることを併せて見る。
func TestRun_M3007_VariantFoldsIntoBase(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (1) guile: 新 code から `_perfect` を抜いた形の基底が実在すること。
	for _, c := range []struct{ base, strength string }{
		{"sonic_boom", "light"}, {"sonic_boom", "medium"}, {"sonic_boom", "heavy"},
		{"somersault_kick", "light"}, {"somersault_kick", "medium"}, {"somersault_kick", "heavy"},
		{"sonic_cross", "light"}, {"sonic_cross", "medium"}, {"sonic_cross", "heavy"},
		{"sonic_cross", "od"},
	} {
		variant := c.base + "_perfect_" + c.strength
		base := c.base + "_" + c.strength
		if got := countCodeM3007(t, db, variant); got != 1 {
			t.Errorf("変種 %s = %d 件, want 1", variant, got)
		}
		if got := countCodeM3007(t, db, base); got != 1 {
			t.Errorf("基底 %s = %d 件, want 1 (基底が無いと変種が畳まれない)", base, got)
		}
	}

	// (2) 対照: luke 側は着手前から接尾形である(本サブは 1 文字も触っていない)。
	for _, code := range []string{
		"flash_knuckle_perfect_light", "flash_knuckle_perfect_medium", "flash_knuckle_perfect_heavy",
	} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = 'luke' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
			code); got != 1 {
			t.Errorf("luke %s = %d 件, want 1 (ルーク側を触っている)", code, got)
		}
	}
}

// TestRun_M3007_EarlierMigrationsFollowed は、本サブ固有の危険——
// **000112 より前の版の手書きマイグレが旧 code で行を解決していたこと**——を床にする。
//
// ★★★golden を再生成すると、新規 DB では v26 の時点から新 code になる。⇒ 旧 code を書いた
//
//	ままの 000039 / 000063 / 000064 は 1 行も当たらなくなり、次が静かに落ちる:
//	  (a) is_projectile = 1 が 7 行に付かない(000039)
//	  (b) startup_basis が 'unknown' のまま残る(000064。CSV 正本は 'standalone')
//	  (c) move_derivations の 3 対が入らない(000064 の D ブロック)
//	★どれもエラーにならず、go test も lint も型検査も緑のままである。
//	⇒ 追随は「案 1 = 適用済みマイグレの code 列挙の書き換え」で行った(開発者裁定 2026-09-12。
//	  先例＝000063 ヘッダ「is_projectile の追随は 000039 の code 列挙の書き換えで行った」)。
//	★本テストはその追随が生きていることを実測で見る。
func TestRun_M3007_EarlierMigrationsFollowed(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (a) 000039(v39)の is_projectile。★飛び道具 7 行と、非飛び道具 3 行を対で見る。
	for _, code := range m3007Projectiles {
		if got := scanInt(t, db, `SELECT m.is_projectile FROM moves m
			JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
			m3007Char, code); got != 1 {
			t.Errorf("%s の is_projectile = %d, want 1 (000039 の code 列挙が追随していない)", code, got)
		}
	}
	for _, code := range []string{
		"somersault_kick_perfect_light", "somersault_kick_perfect_medium", "somersault_kick_perfect_heavy",
	} {
		if got := scanInt(t, db, `SELECT m.is_projectile FROM moves m
			JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
			m3007Char, code); got != 0 {
			t.Errorf("%s の is_projectile = %d, want 0 (サマーソルトキックは飛び道具ではない)", code, got)
		}
	}

	// (b) 000064(v64)の startup_basis。10 行すべてが 'standalone' であること。
	for _, r := range m3007Renames {
		var basis string
		if err := db.QueryRow(`SELECT m.startup_basis FROM moves m
			JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
			m3007Char, r.neu).Scan(&basis); err != nil {
			t.Fatalf("%s の startup_basis を読めない: %v", r.neu, err)
		}
		if basis != "standalone" {
			t.Errorf("%s の startup_basis = %q, want \"standalone\" (000064 の code 列挙が追随していない)",
				r.neu, basis)
		}
	}

	// (c) 000064(v64)の move_derivations 3 対。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		WHERE d.child_move_id = ?`, moveIDM3007(t, db, "sonic_cross_perfect_od")); got != 3 {
		t.Errorf("sonic_cross_perfect_od の move_derivations = %d 対, want 3 "+
			"(000064 の D ブロックが追随していない)", got)
	}
}

// TestRun_M3007_NoResurrectedOldCode は 000063 の B-2 のガード反転を床にする。
//
// ★★★旧 code を 000063 に残したままだと、新規 DB では B-2 の NOT EXISTS が「改名先が不在」と
//
//	判定してガードが通り、`sonic_cross_2_meter_od`(ODソニッククロス２)が
//	`perfect_timing_sonic_cross_od` へ**誤改名**される。★UNIQUE 違反も起きず、マイグレは成功する。
//	⇒ 旧 code が 1 件「復活」し、ODソニッククロス２ が消える。
//	★件数だけでなく **name_ja まで**見る——code が 1 件在るだけでは「どの技に付いているか」を
//	  取り落とし、誤改名を通してしまう。
func TestRun_M3007_NoResurrectedOldCode(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (1) 旧 code が 1 件も復活していないこと。
	for _, r := range m3007Renames {
		if got := countCodeM3007(t, db, r.old); got != 0 {
			t.Errorf("旧 code %s が %d 件 復活している(000063 B-2 のガードが反転した疑い)", r.old, got)
		}
	}

	// (2) ODソニッククロス２ が在り、かつ【ジャスト】側と別の行であること。
	if got := countCodeM3007(t, db, m3007Cross2); got != 1 {
		t.Fatalf("%s = %d 件, want 1 (000063 B-2 が誤改名した疑い)", m3007Cross2, got)
	}
	cross2 := moveIDM3007(t, db, m3007Cross2)
	justOD := moveIDM3007(t, db, "sonic_cross_perfect_od")
	if cross2 == justOD {
		t.Fatalf("%s と sonic_cross_perfect_od が同じ行を指している (move_id=%d)", m3007Cross2, cross2)
	}

	// (3) ODソニッククロス２ に【ジャスト】側の派生が付いていないこと。
	//     ★000064 の D ブロックが誤改名後の行へ書き込むと、ここが 3 になる。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations WHERE child_move_id = ?`,
		cross2); got != 0 {
		t.Errorf("%s に move_derivations が %d 対 付いている, want 0 "+
			"(【ジャスト】側の派生が誤って書き込まれた疑い)", m3007Cross2, got)
	}
}
