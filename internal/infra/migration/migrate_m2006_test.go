package migration_test

import (
	"database/sql"
	"testing"
)

// M20-06(000076〜000077)の契約テスト。P-34 の 13 件を numeric / srk へ投入する(D-367 / D-373)。
//
// ★比較区間は自サブに閉じる(SUPP-001 §5.5.2 (1))。始端 = 直前の連番 v75、
// 終端 = 本サブの最終連番 v77。m.Up()(HEAD 終端)を使わない——後続サブが正当に
// マイグレを追加したとき、本サブの契約テストが無関係に落ちるのを避けるためである。
//
// ★HEAD スコープの主張(「現行の配布状態で行数が N」)は本ファイルに置かない(同 (2))。
// それは migrate_test.go の TestRun_SeedRowCounts が持つ。
//
// ★本ファイルが主張するのは「行が入っていること」までである(指示書 §4.9-4)。
// 「英語が表示されること」は主張しない——alias_text_en を表示へ反映する経路も、
// 逆引きが同列を引く経路も実装が 0 件であり(M20-02 から続く状態)、通らないテストになる。
const ()

// p34Targets は投入対象の 13 件(character_code, move_code, alias_text, alias_text_en)。
//
// ★本表は生成器の noInputDerivedTargets とは独立に書く。生成器と同じ源から作ると
// 「生成器が壊れても両方いっしょに壊れる」ため、契約の主張にならない(値は D-367 が正本)。
//
// ★alias_text は character_data/*.csv の name_ja そのままである(括弧の種類・記号を含む)。
// m_bison の 1 件だけが全角括弧 （） を持つ。半角へ直していないことをここで固定する。
var p34Targets = []struct {
	charCode, moveCode, aliasText, aliasTextEn string
}{
	{"jp", "departure_shadow_od", "ODヴィーハト・チェーニ", "departure shadow OD"},
	{"kimberly", "arc_step", "弧空", "arc step"},
	{"kimberly", "arc_step_od", "OD弧空", "arc step OD"},
	{"lily", "condor_dive_follow_up", "コンドルダイブ(派生)", "condor dive follow up"},
	{"lily", "windclad_od_condor_dive_follow_up", "ODコンドルダイブ(派生)", "windclad OD condor dive follow up"},
	{"m_bison", "psycho_mine_auto_detonation", "サイコマイン（自動爆発）", "psycho mine auto detonation"},
	{"marisa", "scutum_counterattack", "スクトゥム(当身)", "scutum counterattack"},
	{"marisa", "scutum_counterattack_od", "ODスクトゥム(当身)", "scutum counterattack OD"},
	{"rashid", "buffed_dash_back", "【強化】後方ステップ", "buffed dash back"},
	{"rashid", "buffed_dash_forward", "【強化】前方ステップ", "buffed dash forward"},
	{"rashid", "buffed_jump_back", "【強化】後ろジャンプ", "buffed jump back"},
	{"rashid", "buffed_jump_forward", "【強化】前ジャンプ", "buffed jump forward"},
	{"rashid", "buffed_jump_neutral", "【強化】垂直ジャンプ", "buffed jump neutral"},
}

// m2006Presets は投入先の 2 プリセット(D-373)。
//
// ★official_ja_move は含まない。13 件すべてに既存行があり、その値は本サブの複製元
// name_ja そのものである。⇒ 入れる必要が無く、入れるなら UPDATE になり §2.2-5 に触れる。
var m2006Presets = []string{"numeric", "srk"}

// aliasRow は 1 行の alias_text / alias_text_en を返す(行が無ければ found=false)。
func aliasRow(t *testing.T, db *sql.DB, presetCode, charCode, moveCode string) (text string, textEn sql.NullString, found bool) {
	t.Helper()
	err := db.QueryRow(`
	    SELECT pa.alias_text, pa.alias_text_en
	    FROM preset_aliases pa
	    JOIN moves m ON m.id = pa.move_id
	    JOIN characters c ON c.id = m.character_id
	    WHERE pa.preset_id = (SELECT id FROM presets WHERE code = ?)
	      AND c.code = ? AND m.code = ?`, presetCode, charCode, moveCode).Scan(&text, &textEn)
	if err == sql.ErrNoRows {
		return "", sql.NullString{}, false
	}
	if err != nil {
		t.Fatalf("aliasRow(%s/%s/%s): %v", presetCode, charCode, moveCode, err)
	}
	return text, textEn, true
}

// TestRun_M2006_P34Rows は §5 (a)(b) を固定する——13 code × 2 プリセット = 26 行。
//
//	(a) alias_text が name_ja と完全一致する(括弧の種類・記号を含む)
//	(b) alias_text_en が move_code の整形結果と一致する(od → OD の 4 か所を含む)
func TestRun_M2006_P34Rows(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	for _, preset := range m2006Presets {
		for _, tc := range p34Targets {
			text, textEn, found := aliasRow(t, db, preset, tc.charCode, tc.moveCode)
			if !found {
				t.Errorf("%s/%s/%s: 行が無い", preset, tc.charCode, tc.moveCode)
				continue
			}
			if text != tc.aliasText {
				t.Errorf("%s/%s/%s: alias_text = %q, want %q(name_ja の複製。括弧を正規化しない)",
					preset, tc.charCode, tc.moveCode, text, tc.aliasText)
			}
			if !textEn.Valid || textEn.String != tc.aliasTextEn {
				t.Errorf("%s/%s/%s: alias_text_en = %v, want %q(move_code の整形。意訳しない)",
					preset, tc.charCode, tc.moveCode, textEn, tc.aliasTextEn)
			}
		}
	}

	// ★行数を対で固定する。個別の主張だけでは「余分に入れた」を検出できない。
	//
	// ★★M33-03: 母集団を「非 system の全行」から「P-34 の対象集合」へ閉じた。
	//   ⇒ 着手時点は全体で 13 行だったが、後続の seed 波で alias_text_en を持つ行が
	//     増えた(現在 18)。★「余分に入れた」を検出したいのは *本サブが触った範囲* であり、
	//     後続サブが正当に足した行まで数えると、波が進むたびに落ちる。
	//   ⇒ 対象集合の中で「ちょうど 13 行」を主張すれば、ガードの強さは変わらない。
	for _, preset := range m2006Presets {
		var n int
		for _, tc := range p34Targets {
			n += scanInt(t, db, `
			    SELECT count(*) FROM preset_aliases pa
			    JOIN moves m ON m.id = pa.move_id
			    JOIN characters c ON c.id = m.character_id
			    WHERE pa.preset_id = (SELECT id FROM presets WHERE code = ?)
			      AND c.code = ? AND m.code = ?
			      AND pa.alias_text_en IS NOT NULL`, preset, tc.charCode, tc.moveCode)
		}
		if n != len(p34Targets) {
			t.Errorf("%s: P-34 対象のうち alias_text_en を持つ行 = %d, want %d", preset, n, len(p34Targets))
		}
	}
}

// TestRun_M2006_NoFourteenthRow は §5 (e) を固定する。
//
// ★jp/departure_window_double_warp_od は D-367 の開発者判断で対象外である
// (エッジケースでありフォールバックでよい)。実データには実在し、is_derived=true かつ
// command 空欄という点で 13 件と見分けが付かない。⇒ 14 件目を足した瞬間にここが赤くなる。
//
// ★同じ理由で、値が未決のまま残る他の 13 件(27 - 13 - 1)も numeric / srk に行を持たない。
func TestRun_M2006_NoFourteenthRow(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// 値が未決のまま残る 14 件(27 件 - 投入した 13 件)。行が無いことを主張する。
	notSeeded := []struct{ charCode, moveCode string }{
		{"jp", "departure_window_double_warp_od"}, // ★14 件目の候補(D-367 で意図的に除外)
		{"guile", "sonic_break"},
		{"manon", "grand_fouette_heavy"}, {"manon", "grand_fouette_light"}, {"manon", "grand_fouette_medium"},
		{"manon", "renverse_feint_heavy"}, {"manon", "renverse_feint_light"},
		{"manon", "renverse_feint_medium"}, {"manon", "renverse_feint_od"},
		{"marisa", "enfold_od"}, {"marisa", "procella_od"},
		{"marisa", "tonitrus_1hit_od"}, {"marisa", "tonitrus_od"},
		{"rashid", "wall_jump"},
	}
	for _, preset := range m2006Presets {
		for _, tc := range notSeeded {
			if _, _, found := aliasRow(t, db, preset, tc.charCode, tc.moveCode); found {
				t.Errorf("%s/%s/%s: 行があってはならない(P-34 で値が未決の 14 件)",
					preset, tc.charCode, tc.moveCode)
			}
		}
	}

	// ★フォールバックの前提——official_ja_move 側には行があること(DES-004 §5.3 の 2 段目)。
	//   ここが無いと「行が無い」の意味が変わる(表示が move_code の生値になる)。
	for _, tc := range notSeeded {
		if _, _, found := aliasRow(t, db, "official_ja_move", tc.charCode, tc.moveCode); !found {
			t.Errorf("official_ja_move/%s/%s: 行が無い(フォールバック先が消えている)", tc.charCode, tc.moveCode)
		}
	}
}
