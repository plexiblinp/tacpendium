package migration_test

import (
	"database/sql"
	"testing"
)

// M14-03f(第四波)の seed テスト。
//
// ★★★【M33-03・2026-09-19】終端は HEAD である。着手時点は旧 000082〜000091 の区間を
// 名指しし「本テストは v80 -> v91 で移動する」と書いていたが、M33-02 が旧 111 本を
// 新系列 9 本へ潰したため、その区間は存在しない。⇒ 区間の主張は消し、
// HEAD で成り立つ主張だけを残してある(詳細は migrate_head_test.go / SUPP-001 §5.5.2 規約 (2))。
// ★旧 000081 が本波では欠番だった経緯は歴史記録として残す(並列タスクが消費した。2026-09-02)。
//
// ★投入した行だけでなく、投入しなかった行も対で固定する(SUPP-001 §5.5 (3))。
// 件数だけを増やす向きの誤りは「投入した件数」からは検出できない。

const (
	// 本波で characters 行が増える 12 キャラ。c_viper / dhalsim は含まない。
	m1403fNew12 = `'aki','akuma','alex','blanka','cammy','chun_li','dee_jay','e_honda','ed','elena','sagat','yasmine'`
)

// m1403fSeeded17 は本波が 1 行も触ってはならない既 seed キャラ。
const m1403fSeeded17 = `'ryu','ken','ingrid','terry','guile','lily','kimberly','juri','mai','zangief',` +
	`'manon','m_bison','rashid','jamie','luke','marisa','jp'`

// m1403fMovementTotals は開発者提供・実測値(2026-09-02 受領)。
//
// ★CSV の notes_tool が独立に 3 件を裏づけている: aki「通常飛びが 45」/
// chun_li「通常飛びが 47」/ dhalsim「ジャンプが 73F」。残りは開発者提供が唯一の根拠。
var m1403fMovementTotals = []struct {
	code                  string
	dashForward, dashBack int
	jump                  int
}{
	{"aki", 19, 23, 45}, {"akuma", 19, 23, 45}, {"alex", 22, 23, 43},
	{"blanka", 19, 23, 43}, {"cammy", 18, 23, 43}, {"chun_li", 19, 25, 47},
	{"dee_jay", 19, 23, 43}, {"e_honda", 19, 23, 43}, {"ed", 19, 23, 43},
	{"elena", 20, 23, 43}, {"sagat", 23, 23, 43}, {"yasmine", 19, 23, 43},
	{"c_viper", 21, 23, 43}, {"dhalsim", 25, 23, 73},
}

// m1403fCustomStates は第二段で投入する 9 状態(第四波 6 ＋ 既 seed キャラの投入漏れ 3)。
//
// ★code は name_en からの機械生成(開発者裁定 2026-09-02)。
// ★showDelta は「方向可変なら true・単調なら省略」(customStates.ts の規約)。
var m1403fCustomStates = []struct {
	charCode, stateCode  string
	nameJA, nameEN       string
	subject, scope, kind string
	trigger              string // conditional のときのみ
	min, max             int    // integer のときのみ(flag は 0/0)
	showDelta            bool
}{
	{"aki", "poisoned", "毒状態", "Poisoned", "opponent", "persistent", "flag", "", 0, 0, false},
	{"blanka", "blanka_chan_bomb", "ブランカちゃん人形", "Blanka-chan Bomb", "self", "persistent", "stock", "", 0, 3, true},
	{"blanka", "lightning_beast", "ライトニングビースト", "Lightning Beast", "self", "conditional", "flag", "sa2_active", 0, 0, false},
	{"e_honda", "sumo_spirit", "肩屋入り", "Sumo Spirit", "self", "persistent", "flag", "", 0, 0, false},
	{"yasmine", "bayani_mode", "バヤニモード", "Bayani Mode", "self", "persistent", "flag", "", 0, 0, false},
	{"yasmine", "nakatagong_lakas", "ナカタゴン・ラカス", "Nakatagong Lakas", "self", "conditional", "flag", "sa2_active", 0, 0, false},
	// ★既 seed キャラの投入漏れ(000094)。第四波のスコープ外だが開発者の明示依頼で直した。
	{"jamie", "drink_level", "酔いレベル", "Drink Level", "self", "persistent", "level", "", 0, 4, false},
	{"jamie", "the_devils_song", "絶唱魔身", "The Devil's Song", "self", "conditional", "flag", "sa2_active", 0, 0, false},
	{"m_bison", "psycho_mine_is_set", "サイコマイン付与", "Psycho Mine is set", "opponent", "persistent", "flag", "", 0, 0, false},
}

// m1403fChainRows は第三段で投入する 38 行の全数。値の出所は
// character_data/chain-cancel-measurements.md v2.6.1 の確定値表。
// ★1 行ずつ固定する。写像を誤ると別の技に値が入るが、それはエラーにならない。
var m1403fChainRows = []struct {
	char string
	move string
	want int
}{
	{"aki", "standing_light_punch", 9}, {"aki", "crouching_light_punch", 9}, {"aki", "crouching_light_kick", 11},
	{"akuma", "standing_light_punch", 9}, {"akuma", "crouching_light_punch", 10}, {"akuma", "crouching_light_kick", 11},
	{"alex", "standing_light_punch", 11}, {"alex", "crouching_light_punch", 11}, {"alex", "crouching_light_kick", 13},
	// ★blanka は Stand LP ではなく Stand LK がグループ員。
	{"blanka", "standing_light_kick", 9}, {"blanka", "crouching_light_punch", 11}, {"blanka", "crouching_light_kick", 11},
	{"c_viper", "standing_light_punch", 9}, {"c_viper", "crouching_light_punch", 10}, {"c_viper", "crouching_light_kick", 11},
	{"cammy", "standing_light_punch", 9}, {"cammy", "crouching_light_punch", 9}, {"cammy", "crouching_light_kick", 10},
	{"chun_li", "standing_light_punch", 9}, {"chun_li", "crouching_light_punch", 10}, {"chun_li", "crouching_light_kick", 11},
	{"dee_jay", "standing_light_punch", 9}, {"dee_jay", "crouching_light_punch", 11}, {"dee_jay", "crouching_light_kick", 11},
	// ★dhalsim は 4 行。agile_kick は category='unique'(特殊技)だがグループ員である。
	{"dhalsim", "standing_light_punch", 12}, {"dhalsim", "crouching_light_punch", 11},
	{"dhalsim", "agile_kick", 11}, {"dhalsim", "crouching_light_punch_rapid", 10},
	// ★e_honda / ed は 2 技のみ(圏外を開発者が明示回答)。
	{"e_honda", "crouching_light_punch", 10}, {"e_honda", "crouching_light_kick", 9},
	{"ed", "standing_light_punch", 9}, {"ed", "crouching_light_punch", 10},
	{"sagat", "standing_light_punch", 13}, {"sagat", "crouching_light_punch", 11}, {"sagat", "crouching_light_kick", 14},
	{"yasmine", "standing_light_punch", 10}, {"yasmine", "crouching_light_punch", 10}, {"yasmine", "crouching_light_kick", 13},
}

func TestRun_M1403f_ThirdStage_ChainCancelTotal(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	if len(m1403fChainRows) != 38 {
		t.Fatalf("期待表の行数 = %d, want 38(表そのものが痩せた)", len(m1403fChainRows))
	}
	for _, r := range m1403fChainRows {
		var got sql.NullInt64
		err := db.QueryRow(`SELECT m.chain_cancel_total FROM moves m
			JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND m.code = ?`, r.char, r.move).Scan(&got)
		if err != nil {
			t.Errorf("%s/%s: %v", r.char, r.move, err)
			continue
		}
		if !got.Valid || int(got.Int64) != r.want {
			t.Errorf("%s/%s の chain_cancel_total = %v, want %d", r.char, r.move, got, r.want)
		}
	}

	// 総数。既存 55 行 + 新規 38 行 = 93。キャラ数は 18 + 13 = 31。
	if got := scanInt(t, db, `SELECT count(*) FROM moves WHERE chain_cancel_total IS NOT NULL`); got != 93 {
		t.Errorf("chain_cancel_total 非 NULL = %d, want 93", got)
	}
	if got := scanInt(t, db, `SELECT count(DISTINCT character_id) FROM moves WHERE chain_cancel_total IS NOT NULL`); got != 31 {
		t.Errorf("chain_cancel_total を持つキャラ数 = %d, want 31", got)
	}

	// ★圏外の対の主張(投入し過ぎの検出)。成果表 §ロースターで開発者が明示回答した 3 件。
	for _, c := range []struct{ char, move string }{
		{"e_honda", "standing_light_punch"},
		{"ed", "crouching_light_kick"},
		{"dhalsim", "crouching_light_kick"},
		{"blanka", "standing_light_punch"},
	} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND m.code = ? AND m.chain_cancel_total IS NOT NULL`, c.char, c.move); got != 0 {
			t.Errorf("圏外のはずの %s/%s に値が入っている", c.char, c.move)
		}
	}

	// ★既存 55 行が 1 行も変わっていないこと(サンプルではなく総数で見る)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code IN ('ryu','juri','zangief','terry','guile','lily','ingrid','kimberly','ken','mai','manon',
		                 'm_bison','rashid','jamie','luke','marisa','jp','elena')
		  AND m.chain_cancel_total IS NOT NULL`); got != 55 {
		t.Errorf("既存 18 キャラの chain_cancel_total 非 NULL = %d, want 55", got)
	}
	// 代表 3 行の値も固定する(総数が合っていても値が入れ替わる事故を捕まえる)。
	for _, r := range []struct {
		char, move string
		want       int
	}{
		{"ryu", "standing_light_punch", 9},
		{"zangief", "crouching_light_punch_rapid", 10},
		{"elena", "crouching_light_kick", 12},
	} {
		if got := scanInt(t, db, `SELECT m.chain_cancel_total FROM moves m
			JOIN characters c ON c.id = m.character_id WHERE c.code = ? AND m.code = ?`, r.char, r.move); got != r.want {
			t.Errorf("既存 %s/%s = %d, want %d", r.char, r.move, got, r.want)
		}
	}
}

func TestRun_M1403f_ThirdStage_DhalsimRapid(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// moves 1 行。値は成果表 v2.6.1 と別紙(4/3/9/15・p=10)。
	var su, act, rec, total, isDerived int
	var basis string
	var dmg, onHit, onBlock sql.NullInt64
	err := db.QueryRow(`SELECT m.startup, m.active, m.recovery, m.total, m.is_derived, m.startup_basis,
		m.damage, m.on_hit, m.on_block
		FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'dhalsim' AND m.code = 'crouching_light_punch_rapid'`).
		Scan(&su, &act, &rec, &total, &isDerived, &basis, &dmg, &onHit, &onBlock)
	if err != nil {
		t.Fatalf("dhalsim 連打版の取得: %v", err)
	}
	if su != 4 || act != 3 || rec != 9 || total != 15 {
		t.Errorf("dhalsim 連打版の単発値 = %d/%d/%d/%d, want 4/3/9/15", su, act, rec, total)
	}
	if isDerived != 1 {
		t.Errorf("is_derived = %d, want 1(単独入力できない)", isDerived)
	}
	if basis != "standalone" {
		t.Errorf("startup_basis = %q, want standalone(000051 のザンギエフ連打版と同じ扱い)", basis)
	}
	// ★実測されていない列は推測で埋めない。
	if dmg.Valid || onHit.Valid || onBlock.Valid {
		t.Errorf("damage/on_hit/on_block は NULL のままであるべき: %v/%v/%v", dmg, onHit, onBlock)
	}

	// official_ja_move alias が対で入り、character_id も埋まっていること(000074 以降の形)。
	var alias string
	var chID sql.NullInt64
	err = db.QueryRow(`SELECT pa.alias_text, pa.character_id FROM preset_aliases pa
		JOIN moves m ON m.id = pa.move_id
		JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'dhalsim' AND m.code = 'crouching_light_punch_rapid'
		  AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')`).Scan(&alias, &chID)
	if err != nil {
		t.Fatalf("dhalsim 連打版の alias: %v", err)
	}
	if alias != "しゃがみ弱P(連打版)" {
		t.Errorf("alias_text = %q", alias)
	}
	if !chID.Valid {
		t.Error("preset_aliases.character_id が NULL(000074 以降は埋めること)")
	}

	// ★親参照はちょうど 2 行。クロス限定なので crouching_light_punch は親にならない。
	parents := map[string]bool{}
	rows, err := db.Query(`SELECT pm.code FROM move_derivations d
		JOIN moves cm ON cm.id = d.child_move_id
		JOIN moves pm ON pm.id = d.parent_move_id
		JOIN characters c ON c.id = cm.character_id
		WHERE c.code = 'dhalsim' AND cm.code = 'crouching_light_punch_rapid'`)
	if err != nil {
		t.Fatalf("親参照の取得: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			t.Fatal(err)
		}
		parents[code] = true
	}
	if len(parents) != 2 || !parents["standing_light_punch"] || !parents["agile_kick"] {
		t.Errorf("親集合 = %v, want {standing_light_punch, agile_kick}", parents)
	}
	// ★対の主張: 同技連打では素が出るため、屈弱P は親ではない。
	if parents["crouching_light_punch"] {
		t.Error("crouching_light_punch が親に入っている(クロス限定の実測と食い違う)")
	}
	// zangief の 9 行(000061)を壊していないこと。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		JOIN moves cm ON cm.id = d.child_move_id
		JOIN characters c ON c.id = cm.character_id
		WHERE c.code = 'zangief' AND cm.code LIKE '%_rapid'`); got != 9 {
		t.Errorf("zangief 連打版の親参照 = %d, want 9", got)
	}
}

func TestRun_M1403f_FourthStage_CammyRename(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	cnt := func(code string) int {
		return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = 'cammy' AND m.code = ?`, code)
	}
	if got := cnt("hooligan_combination_holding"); got != 0 {
		t.Errorf("旧 code が %d 行残っている, want 0", got)
	}
	if got := cnt("hooligan_combination_holding_heavy"); got != 1 {
		t.Errorf("新 code = %d 行, want 1", got)
	}

	// official_ja_move の表記。
	var alias string
	if err := db.QueryRow(`SELECT pa.alias_text FROM preset_aliases pa
		JOIN moves m ON m.id = pa.move_id JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'cammy' AND m.code = 'hooligan_combination_holding_heavy'
		  AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')`).Scan(&alias); err != nil {
		t.Fatalf("alias: %v", err)
	}
	if alias != "【ホールド】強フーリガンコンビネーション" {
		t.Errorf("alias_text = %q", alias)
	}

	// ★巻き添えの検出。旧 code を接頭辞に持つ子 3 件と、同名の強度違い 1 件は無傷であること。
	for _, code := range []string{
		"cannon_strike_heavy_hooligan_combination_holding",
		"reverse_edge_heavy_hooligan_combination_holding",
		"fatal_leg_twister_heavy_hooligan_combination_holding",
		"hooligan_combination_heavy",
	} {
		if got := cnt(code); got != 1 {
			t.Errorf("巻き添え: %s = %d 行, want 1", code, got)
		}
	}

	// golden に載らない列が改名で取り残されていないこと(m19-04c §12.2)。
	var basis string
	var derived int
	if err := db.QueryRow(`SELECT m.startup_basis, m.is_derived FROM moves m
		JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'cammy' AND m.code = 'hooligan_combination_holding_heavy'`).Scan(&basis, &derived); err != nil {
		t.Fatalf("columns: %v", err)
	}
	if basis != "unknown" {
		t.Errorf("startup_basis = %q, want unknown(CSV の値。000089 は当該 code を列挙していない)", basis)
	}
	if derived != 1 {
		t.Errorf("is_derived = %d, want 1", derived)
	}
}

// m1403fDerivationCounts は 000101 が投入するキャラ別の子件数とペア数。
// 出所は開発者の裁定(2026-09-04)。★1 つずつ固定する——INSERT ... SELECT は
// 子や親が居なくても 0 行投入で成功してしまう(サイレント no-op)。
var m1403fDerivationCounts = []struct {
	char     string
	children int
	pairs    int
}{
	{"aki", 6, 6}, {"akuma", 19, 32}, {"alex", 17, 17}, {"blanka", 7, 15},
	{"cammy", 19, 22}, {"chun_li", 7, 7}, {"dee_jay", 13, 15}, {"e_honda", 6, 6},
	{"ed", 2, 2}, {"elena", 18, 72}, {"sagat", 6, 15}, {"yasmine", 14, 32},
	{"c_viper", 26, 45}, {"dhalsim", 9, 27},
}

// TestRun_M1403f_JumpNormalsHaveNoParent は「通常ジャンプ攻撃には jump_*(移動 system move)を
// 親として付けない」という開発者裁定(2026-09-04)を守る回帰ガードである。
//
// ★裁定の経緯: 000101 で jump_* を親にする行が初めて入った(21 子 / 52 行)のを受けて、
//
//	既存キャラのジャンプ系をどうするかを開発者が目視で確認した。そのとき論点が 2 つに
//	割れていることが判明した——
//	  ① ジャンプ攻撃そのもの(jumping_{light,medium,heavy}_{punch,kick} ＋ neutral_jumping_*)
//	  ② ジャンプ前提の必殺技・特殊技(空中竜巻旋風脚・ドリルキック 等)
//	②は 000101 で投入したが、①は「付けない」と裁定された(全 31 キャラで現状維持)。
//
// ★このテストが要る理由: ①は is_derived=0 なので move_derivations の候補表に一度も載って
//
//	いない。「候補表に無い」ことは「判断済み」を意味せず、次の波が抽出条件を変えると
//	静かに破れる。裁定を機械で守る。
func TestRun_M1403f_JumpNormalsHaveNoParent(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// ① 通常ジャンプ攻撃を子に持つ行は全 31 キャラで 0 行。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		JOIN moves cm ON cm.id = d.child_move_id
		WHERE cm.code IN ('jumping_light_punch','jumping_light_kick',
		                  'jumping_medium_punch','jumping_medium_kick',
		                  'jumping_heavy_punch','jumping_heavy_kick')
		   OR cm.code LIKE 'neutral_jumping_%'`); got != 0 {
		t.Errorf("通常ジャンプ攻撃に親が %d 行付いている, want 0（開発者裁定 2026-09-04＝付けない）", got)
	}

	// ★対の主張 1: ②(ジャンプ前提の必殺技・特殊技)が残っていること。
	//   ガードが広すぎて②まで巻き込んでいないことの検出。
	//
	// ★★M33-03: 件数 52 を「0 でないこと」へ置き換えた。⇒ 52 は第四波時点(17 キャラ)の
	//   母数であり、後続の波で増える(現在 108)。★この主張が捕まえたいのは
	//   「ガードが広すぎて②まで消えた」＝0 になる形だけである。⇒ 母数を固定する必要が無い。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		JOIN moves pm ON pm.id = d.parent_move_id
		WHERE pm.code IN ('jump_neutral','jump_forward','jump_back')`); got == 0 {
		t.Errorf("jump_* を親にする行 = 0（②まで巻き込んで消している疑い）")
	}

	// ★対の主張 2: c_viper の high_jumping_*(ハイジャンプ通常攻撃 7 件)は①ではない。
	//   親の high_jump は category='unique' で command 'd u' を持つ入力技であり、
	//   移動 system move の jump_* とは別物である(2026-09-04 に線引きを確認)。
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		JOIN moves cm ON cm.id = d.child_move_id JOIN characters c ON c.id = cm.character_id
		JOIN moves pm ON pm.id = d.parent_move_id
		WHERE c.code = 'c_viper' AND cm.code LIKE 'high_jumping_%' AND pm.code = 'high_jump'`); got != 7 {
		t.Errorf("c_viper の high_jumping_* に付いた high_jump 親 = %d, want 7", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM move_derivations d
		JOIN moves cm ON cm.id = d.child_move_id
		JOIN moves pm ON pm.id = d.parent_move_id
		WHERE cm.code LIKE 'high_jumping_%'
		  AND pm.code IN ('jump_neutral','jump_forward','jump_back')`); got != 0 {
		t.Errorf("high_jumping_* に移動 system move の親が %d 行付いている, want 0", got)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 第五段(2026-09-04 受領・000102)
//
// 既 seed 17 キャラのジャンプ前提技への親付与。開発者の全件目視による裁定であり、
// 機械提案ではない。棚卸し 36 件の多くが「対象外」と裁定され、代わりに棚卸しに
// 載っていなかった技が 6 キャラ分追加された。
//
// ★第一段(v91)・第二段(v95)・第三段(v99)・第四段(v101)のテストは変更しない。
// ─────────────────────────────────────────────────────────────────────────────

// m1403fJumpDerivCounts は 000102 が投入するキャラ別の子件数とペア数。
var m1403fJumpDerivCounts = []struct {
	char     string
	children int
	pairs    int
}{
	{"ryu", 2, 2}, {"ken", 2, 2}, {"ingrid", 14, 14}, {"lily", 4, 8},
	{"kimberly", 4, 4}, {"juri", 2, 2}, {"mai", 2, 4}, {"zangief", 2, 6},
	{"rashid", 4, 4}, {"jamie", 4, 4}, {"luke", 3, 6},
}
