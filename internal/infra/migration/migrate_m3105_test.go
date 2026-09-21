package migration_test

import (
	"database/sql"
	"encoding/json"
	"strings"
	"testing"
)

// M31-05(P4M-023・マイグレ 000110)の投入結果を固定する。
//
// ★★本ファイルは「件数」ではなく「v110 時点の状態」で固定する(SUPP-001 §5.5.4 (6))。
//
//	9 キャラの custom_states は今後も増える見込み(DES-003 §3.2 第64版＝「キャラ固有状態は
//	今後増えていく見込みであり、ステータスを持つキャラの状態は撤回しない」)であり、
//	総数で固定すると次に足す人が数字を合わせるだけになる。
//
// ★★本サブが最も落としてはいけないのは 2 つである。
//
//	(1) 既存 state を消さないこと —— characters.custom_states は JSON 1 列であり、
//	    UPDATE は全置換になる。とくに kimberly の shuriken_bomb_stock と
//	    blanka の blanka_chan_bomb は「残弾」であり、今回の「設置済み」とは別物である
//	    (CHANGE-169 §2.5。★製造が 1 度これで外している)。
//	(2) 足した state がキャラ固有状態タブに出ること —— 指示書 §4.2。
//	    ★「足したのにタブに出ない」は検査が緑のまま起きる形である。⇒ 本ファイルで測る。

// m3105Char は 1 キャラぶんの期待。
//
// ★added は本サブが足した code、kept は本サブより前から在り「消してはいけない」code。
type m3105Char struct {
	char  string
	added []string
	kept  []string
}

// ★9 キャラ 14 state。★ファミリー数より多いのは 3 つを 2 state へ割ってあるためである——
//
//	舞(通常版 / 焔版) ／ イングリッド(レベル / 強度) ／ ダルシムのサンバースト(ホールド段階 / 強度)。
//
// ★aki は入っていない(開発者の逐語＝「いらない事がわかった」)。
var m3105Expect = []m3105Char{
	{"kimberly", []string{"shuriken_bomb_is_set"}, []string{"shuriken_bomb_stock"}},
	{"juri", []string{"saihasho_is_set"}, []string{"fuha_stock", "feng_shui_engine"}},
	{"blanka", []string{"blanka_chan_bomb_is_set"}, []string{"blanka_chan_bomb", "lightning_beast"}},
	{"dhalsim", []string{"yoga_arch_is_set", "yoga_sunburst_is_set", "yoga_sunburst_strength"}, nil},
	{"jp", []string{"departure_is_set", "lovushka"}, nil},
	{"rashid", []string{"ysaar"}, nil},
	{"mai", []string{"kachousen", "flame_kachousen"}, []string{"flame_stock"}},
	{"ingrid", []string{"order_of_the_sun", "order_of_the_sun_strength"}, []string{"sun_crest"}},
	{"yasmine", []string{"pangil_sa_likuran_is_set"}, []string{"bayani_mode", "nakatagong_lakas"}},
}

// m3105Option / m3105ValueDef / m3105State は格納 JSON(DES-003 §3.2)の構造。
type m3105Option struct {
	Value   int    `json:"value"`
	LabelJa string `json:"label_ja"`
	LabelEn string `json:"label_en"`
}

type m3105ValueDef struct {
	Kind        string        `json:"kind"`
	Min         *int          `json:"min"`
	Max         *int          `json:"max"`
	SingleValue bool          `json:"single_value"`
	Options     []m3105Option `json:"options"`
}

type m3105State struct {
	Code     string         `json:"code"`
	NameJa   string         `json:"name_ja"`
	NameEn   string         `json:"name_en"`
	Subject  string         `json:"subject"`
	Type     string         `json:"type"`
	ValueDef *m3105ValueDef `json:"value_definition"`
}

// customStatesM3105 は指定キャラの custom_states を states[] へ解いて返す。
// SQL NULL のときは (nil, false) を返す —— 「定義を持たない」と「空の定義を持つ」を
// 区別するためである(down の主張がこの区別に依る)。
func customStatesM3105(t *testing.T, db *sql.DB, char string) ([]m3105State, bool) {
	t.Helper()
	var raw sql.NullString
	err := db.QueryRow(`SELECT custom_states FROM characters
		WHERE code = ? AND game_id IN (SELECT id FROM games WHERE code = 'sf6')`, char).Scan(&raw)
	if err != nil {
		t.Fatalf("%s の custom_states を引けない: %v", char, err)
	}
	if !raw.Valid {
		return nil, false
	}
	var doc struct {
		States []m3105State `json:"states"`
	}
	if err := json.Unmarshal([]byte(raw.String), &doc); err != nil {
		t.Fatalf("%s の custom_states が JSON として読めない: %v", char, err)
	}
	return doc.States, true
}

func m3105Codes(states []m3105State) []string {
	out := make([]string, 0, len(states))
	for _, s := range states {
		out = append(out, s.Code)
	}
	return out
}

func m3105Has(codes []string, want string) bool {
	for _, c := range codes {
		if c == want {
			return true
		}
	}
	return false
}

// TestRun_M3105_CorrectedState は v110 時点の状態を固定する。
func TestRun_M3105_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	for _, e := range m3105Expect {
		states, ok := customStatesM3105(t, db, e.char)
		if !ok {
			t.Errorf("%s の custom_states が NULL のままである", e.char)
			continue
		}
		codes := m3105Codes(states)
		for _, c := range e.added {
			if !m3105Has(codes, c) {
				t.Errorf("%s に %s が入っていない (実際: %v)", e.char, c, codes)
			}
		}
		// ★★既存 state を 1 つも消していないこと。名前が似ている残弾を名指しで見る。
		for _, c := range e.kept {
			if !m3105Has(codes, c) {
				t.Errorf("%s の既存 state %s が消えている (実際: %v)", e.char, c, codes)
			}
		}
	}
}

// TestRun_M3105_AkiUntouched は aki が対象外であることを固定する。
//
// ★「入っていない」を主張するテストは、入れた本人には要らないように見える。
//
//	★★しかし次に custom_states を触る人は「9 体に足したなら 10 体目も」と読む。
//	  ⇒ aki が外れているのは漏れではなく裁定である、と機械に言わせておく。
func TestRun_M3105_AkiUntouched(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	states, ok := customStatesM3105(t, db, "aki")
	if !ok {
		t.Fatalf("aki の custom_states が NULL になっている")
	}
	if got := m3105Codes(states); len(got) != 1 || got[0] != "poisoned" {
		t.Errorf("aki の custom_states = %v, want [poisoned] (本サブは aki を触らない)", got)
	}
}

// TestRun_M3105_SunCrestUnchanged は案 (vi) の前提を固定する。
//
// ★★「options を持たない level は今までどおり数値入力である」——これが崩れると、
//
//	撤回済みの composite と同じ道(既存の定義を作り替える形)に入る。
//	⇒ ingrid の sun_crest が options を 1 つも持たないことを名指しで見る。
func TestRun_M3105_SunCrestUnchanged(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	states, _ := customStatesM3105(t, db, "ingrid")
	for _, s := range states {
		if s.Code != "sun_crest" {
			continue
		}
		if s.Type != "level" {
			t.Errorf("sun_crest の type = %q, want level", s.Type)
		}
		if s.ValueDef == nil || len(s.ValueDef.Options) != 0 {
			t.Errorf("sun_crest が options を持っている (案 (vi) の前提が崩れている)")
		}
		return
	}
	t.Errorf("ingrid の sun_crest が消えている")
}

// TestRun_M3105_OptionsWellFormed は投入した options の形を固定する。
func TestRun_M3105_OptionsWellFormed(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	for _, e := range m3105Expect {
		states, _ := customStatesM3105(t, db, e.char)
		for _, s := range states {
			if !m3105Has(e.added, s.Code) {
				continue
			}
			// ★subject は 11 件すべて self。「その状態が誰に付いているか」で決めている
			//   (CHANGE-154。★「設置技かどうか」では決めない)。
			if s.Subject != "self" {
				t.Errorf("%s/%s の subject = %q, want self", e.char, s.Code, s.Subject)
			}
			if s.NameJa == "" || s.NameEn == "" {
				t.Errorf("%s/%s に name_ja / name_en が無い", e.char, s.Code)
			}
			if s.ValueDef == nil {
				t.Errorf("%s/%s に value_definition が無い", e.char, s.Code)
				continue
			}
			// ★★M31-05 追補: 本サブが足す int state は 1 つの値として扱う
			//   (2026-09-10 開発者の実機確認。①② はストック系のための拡張であり、
			//   custom_states の原点 CHANGE-040 は「開始時状態の付与のみ」である)。
			//   ⇒ flag 以外は全件 single_value=true でなければならない。
			if s.Type != "flag" && !s.ValueDef.SingleValue {
				t.Errorf("%s/%s に single_value が無い (①②へ分かれてしまう)", e.char, s.Code)
			}
			if len(s.ValueDef.Options) == 0 {
				// flag / options なし stock は本検査の対象外。
				continue
			}
			if s.Type != "level" {
				t.Errorf("%s/%s は options を持つのに type=%q (want level。★composite は撤回済み)",
					e.char, s.Code, s.Type)
			}
			if s.ValueDef.Min == nil || s.ValueDef.Max == nil {
				t.Errorf("%s/%s に min/max が無い", e.char, s.Code)
				continue
			}
			// ★★値域と選択肢が食い違うと、clamp で別の選択肢へ化ける。
			//   ⇒ 「min..max がちょうど選択肢の値の集合である」を主張する。
			seen := map[int]bool{}
			for _, o := range s.ValueDef.Options {
				if o.Value < *s.ValueDef.Min || o.Value > *s.ValueDef.Max {
					t.Errorf("%s/%s の選択肢 %d が値域 [%d,%d] の外に在る",
						e.char, s.Code, o.Value, *s.ValueDef.Min, *s.ValueDef.Max)
				}
				if seen[o.Value] {
					t.Errorf("%s/%s の選択肢 %d が重複している", e.char, s.Code, o.Value)
				}
				seen[o.Value] = true
				if o.LabelJa == "" {
					t.Errorf("%s/%s の選択肢 %d に label_ja が無い", e.char, s.Code, o.Value)
				}
				// ★label_en が無いと optionLabelFor が label_ja へフォールバックし、
				//   EN 画面に日本語が出る。locales/*.json しか見ない
				//   `no-japanese-in-en.test.ts` はこの経路を素通りする。
				if o.LabelEn == "" {
					t.Errorf("%s/%s の選択肢 %d に label_en が無い (EN 画面に日本語が出る)",
						e.char, s.Code, o.Value)
				}
			}
			for v := *s.ValueDef.Min; v <= *s.ValueDef.Max; v++ {
				if !seen[v] {
					t.Errorf("%s/%s の値 %d に対応する選択肢が無い", e.char, s.Code, v)
				}
			}
		}
	}
}

// --- キャラ固有状態タブの照合(指示書 §4.2 / CHANGE-170 §2.5) ---

// m3105StateCodeSuffixes は web/src/features/combo/moveSurfacing.ts の
// STATE_CODE_SUFFIXES の写しである。
//
// ★★正本は TS 側であり、こちらは「投入した code がその規則で当たるか」を DB 側から測るための
//
//	写しにすぎない。規則そのものの主張は web/src/features/combo/moveSurfacing.test.ts に在る。
//
// ★★ドリフトの検出は片方向だけである。**過信しないこと。**
//
//	TS 側から後置語が**減った**場合は、こちらが多い語幹で測るため当たる件数が実物より多くなり、
//	いずれ赤くなる。しかし TS 側へ後置語が**増えた**場合は、こちらが少ない語幹で測るだけであり、
//	`!= 0` の主張は依然として通る。⇒ 増加方向のドリフトは本ファイルでは検出できない。
var m3105StateCodeSuffixes = []string{"_stock", "_mode", "_is_set", "_crest", "_charge"}

func m3105ExpandStateCode(code string) []string {
	out := []string{code}
	for _, suf := range m3105StateCodeSuffixes {
		if strings.HasSuffix(code, suf) {
			out = append(out, strings.TrimSuffix(code, suf))
		}
	}
	return out
}

// m3105TabCount は「そのキャラの state code 群がキャラ固有状態タブへ載せる move の件数」を返す。
func m3105TabCount(t *testing.T, db *sql.DB, char string, codes []string) int {
	t.Helper()
	rows, err := db.Query(`SELECT m.code FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')`, char)
	if err != nil {
		t.Fatalf("%s の moves を引けない: %v", char, err)
	}
	defer rows.Close()

	keys := []string{}
	for _, c := range codes {
		keys = append(keys, m3105ExpandStateCode(c)...)
	}
	n := 0
	for rows.Next() {
		var mc string
		if err := rows.Scan(&mc); err != nil {
			t.Fatalf("scan: %v", err)
		}
		for _, k := range keys {
			if k != "" && strings.Contains(mc, k) {
				n++
				break
			}
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	return n
}

// TestRun_M3105_FlameKachousenCoveredByFlameStock は m3105NoStemMatch の例外の**代わり**である。
//
// ★★`flame_kachousen` は語幹が move_code に当たらないため、単独ヒットの主張から外してある。
//
//	⇒ 外したぶん、「では焔版の技はタブに載っているのか」をここで名指しで測る。
//	★例外を置くだけで代わりを置かないと、「足したのにタブに出ない」(指示書 §4.2)を
//	  検査が緑のまま通す。**例外と代替の主張は必ず対で置くこと。**
//
// ★担保しているのは既存の `flame_stock`(語幹 `flame`)である。⇒ 本 state を足したことで
//
//	タブが減っていないことは TestRun_M3105_CharacterStateTabNotEmpty が別に見ている。
func TestRun_M3105_FlameKachousenCoveredByFlameStock(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// 焔版の花蝶扇 5 件。★`flame_kachousen` state が表す 5 変種そのものである。
	flameKachousen := []string{
		"flame_light_kachousen_holding",
		"flame_medium_kachousen_holding",
		"flame_heavy_kachousen_holding",
		"flame_od_kachousen_holding",
		"flame_midare_kachousen",
	}

	states, ok := customStatesM3105(t, db, "mai")
	if !ok {
		t.Fatalf("mai の custom_states が NULL である")
	}
	codes := m3105Codes(states)

	// ★まず前提を固定する —— この 5 件は実在する move_code である。
	//   (実在しない code を並べておくと、下の「タブに載っている」が空振りで緑になる)
	for _, mc := range flameKachousen {
		n := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`, mc)
		if n != 1 {
			t.Errorf("前提が崩れている: mai の %s が %d 件 (want 1)", mc, n)
		}
	}

	// ★★本題 —— 5 件すべてが、mai の state code 群の語幹のどれかに当たること。
	keys := []string{}
	for _, c := range codes {
		keys = append(keys, m3105ExpandStateCode(c)...)
	}
	for _, mc := range flameKachousen {
		hit := false
		for _, k := range keys {
			if k != "" && strings.Contains(mc, k) {
				hit = true
				break
			}
		}
		if !hit {
			t.Errorf("焔版 %s がキャラ固有状態タブに載らない (語幹: %v)", mc, keys)
		}
	}
}

// TestRun_M3105_StrengthStatesCoveredBySibling は m3105NoStemMatch の `*_strength` 2 件の**代わり**である。
//
// ★★2026-09-10 追補で、ダルシムのヨガサンバーストとイングリッドのサンオーダーを
//
//	「段階 / レベル」と「強度」の 2 state へ割った(開発者の要望＝入力しやすさ)。
//	後置語 `_strength` は STATE_CODE_SUFFIXES に無いため語幹が当たらない。
//	⇒ 外したぶん、「では当該ファミリーの技はタブに載っているのか」をここで名指しで測る。
//
// ★例外を置くだけで代わりを置かないと、「足したのにタブに出ない」(指示書 §4.2)を
//
//	検査が緑のまま通す。**例外と代替の主張は必ず対で置くこと。**
func TestRun_M3105_StrengthStatesCoveredBySibling(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	cases := []struct {
		char     string
		strength string   // 語幹が当たらない側
		sibling  string   // タブを担保する側
		moves    []string // タブに載っていてほしい技
	}{
		{
			char: "dhalsim", strength: "yoga_sunburst_strength", sibling: "yoga_sunburst_is_set",
			moves: []string{
				"sa2_yoga_sunburst", "sa2_yoga_sunburst_holding", "sa2_yoga_sunburst_max_holding",
			},
		},
		{
			char: "ingrid", strength: "order_of_the_sun_strength", sibling: "order_of_the_sun",
			moves: []string{
				"sa2_order_of_the_sun_lv1", "sa2_order_of_the_sun_lv2", "sa2_order_of_the_sun_lv3",
			},
		},
	}

	for _, c := range cases {
		states, ok := customStatesM3105(t, db, c.char)
		if !ok {
			t.Errorf("%s の custom_states が NULL である", c.char)
			continue
		}
		codes := m3105Codes(states)
		if !m3105Has(codes, c.strength) || !m3105Has(codes, c.sibling) {
			t.Errorf("%s に %s / %s が揃っていない (実際: %v)", c.char, c.strength, c.sibling, codes)
			continue
		}

		// ★前提を固定する —— これらは実在する move_code である。
		//   (実在しない code を並べておくと、下の「タブに載っている」が空振りで緑になる)
		for _, mc := range c.moves {
			n := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
				WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
				c.char, mc)
			if n != 1 {
				t.Errorf("前提が崩れている: %s の %s が %d 件 (want 1)", c.char, mc, n)
			}
		}

		// ★本題 —— 強度 state 自身は 0 件だが、兄弟が同じ技を全件拾うこと。
		if n := m3105TabCount(t, db, c.char, []string{c.strength}); n != 0 {
			t.Errorf("%s/%s は語幹が当たらない前提だが %d 件に当たった (例外表を見直すこと)",
				c.char, c.strength, n)
		}
		keys := m3105ExpandStateCode(c.sibling)
		for _, mc := range c.moves {
			hit := false
			for _, k := range keys {
				if k != "" && strings.Contains(mc, k) {
					hit = true
					break
				}
			}
			if !hit {
				t.Errorf("%s の %s が兄弟 %s の語幹で拾えない (語幹: %v)", c.char, mc, c.sibling, keys)
			}
		}
	}
}
