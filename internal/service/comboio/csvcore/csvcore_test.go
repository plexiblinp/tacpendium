package csvcore

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func ip(n int) *int                { return &n }
func fp(f float64) *float64        { return &f }
func bp(b bool) *bool              { return &b }
func raw(s string) json.RawMessage { return json.RawMessage(s) }

// goldenCombos は往復テスト用のゴールデン行。local_id / drive_damage 小数 /
// oki nil-false 混在 / situation JSON / memo 特殊文字 / tags / recipe を網羅。
func goldenCombos() []Combo {
	return []Combo{
		{
			LocalID:                    "c1",
			CharacterCode:              "ryu",
			IsDraft:                    false,
			Damage:                     ip(2400),
			DriveAvailableAtStart:      fp(2.5), // 小数(0.5 刻み・M16-01)
			SAAvailableAtStart:         ip(3),
			DriveDamage:                fp(2.5), // 小数
			SAGaugeConsumed:            ip(5),   // 消費 SA(M16-02)
			DriveGaugeConsumed:         fp(3.5), // 消費 drive・小数(M16-02)
			Position:                   "corner_self",
			OpponentStance:             "standing",
			HitType:                    "punish_counter",
			OpponentSize:               "standard",
			Situation:                  raw(`{"custom_states":{"burnout":true}}`),
			OkiMeatyNeutralTechThrow:   bp(true),
			OkiMeatyNeutralTechThrowDR: bp(true),
			OkiMeatyBackTechThrow:      bp(false), // 明示 false
			OkiMeatyBackTechThrowDR:    nil,       // NULL
			OkiShimmyNeutralTech:       nil,
			OkiShimmyBackTech:          bp(true),
			KnockdownAdvantage:         ip(46),
			Memo:                       "コーナー,\"確反\"\nテスト",
			Link:                       "https://example.com/combo-guide?id=1&lang=ja", // メディア(M17-01)
			VideoPath:                  "videos/ryu bnb #1.mp4",                        // 空白・記号込み verbatim
			ImagePath:                  "images/ryu-bnb.png",
			Tags:                       []Tag{{Name: "主力", Category: "playstyle", Color: "#10B981"}, {Name: "難"}},
			Steps: []Step{
				{MoveCode: "5lp", Modifiers: Modifiers{Flags: []string{"just"}, Notes: "目押し"}},
				{MoveCode: "", Modifiers: Modifiers{Type: "parry_drive_rush"}},
			},
		},
		{
			LocalID:       "c2",
			CharacterCode: "manon",
			IsDraft:       true,
			Damage:        ip(0), // 0 と nil の区別
			DriveDamage:   fp(-6),
			Memo:          "=cmd|' /C calc'!A1", // VAL-I10 式注入ベクタ
			Steps:         []Step{{MoveCode: "2mk", Modifiers: Modifiers{}}},
		},
		{
			// ★★M29-02 §2.2: 「本登録として成立する最小の行」。
			//
			//   着手前はここが「レシピ 0 ステップ・必須欄すべて nil」だった。
			//   その形は **確定(commit)では VAL-C09 / VAL-C15 で必ず落ちる行**
			//   であり、プレビューだけが通していた。⇒ プレビューを確定へ揃えた結果、
			//   本行は「取り込めない行」になったので、実際に成立する最小形へ改めた。
			//
			//   ★実データを弱めていない —— M27-02b 以降、必須欄が空の本登録は
			//   そもそも保存できない。⇒ export がこの形を出すことはない。
			//   ★他の任意欄が nil のまま往復することは引き続き主張している。
			LocalID:            "c3",
			CharacterCode:      "ken",
			Damage:             ip(0),
			KnockdownAdvantage: ip(0),
			DriveGaugeConsumed: fp(0),
			SAGaugeConsumed:    ip(0),
			Steps:              []Step{{MoveCode: "5lp", Modifiers: Modifiers{}}},
		},
	}
}

// draftMinimal は「仮登録として成立する最小の行」を作る。
//
// ★★M29-02 §2.2: 本登録の必須欄(VAL-C15)は仮登録では見ない。⇒ 検証したいのが
// 列の往復(hit_type / opponent_size / 式注入など)であって本登録の必須欄ではない
// テストは、仮登録にしておくのが素直である。4 欄を毎回埋めると、テストの主題と
// 関係のない値がゴールデンに混ざって読みにくくなる。
//
// ★レシピは 1 ステップ入れる —— VAL-C09(空レシピ)は仮登録にも適用される
// (M24-13 / CHANGE-139 の裁定)。
func draftMinimal(c Combo) Combo {
	c.IsDraft = true
	if len(c.Steps) == 0 {
		c.Steps = []Step{{MoveCode: "5lp", Modifiers: Modifiers{}}}
	}
	return c
}

func TestRoundTrip(t *testing.T) {
	in := goldenCombos()
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	if res.FileError != nil {
		t.Fatalf("unexpected FileError: %+v", res.FileError)
	}
	if len(res.Combos) != len(in) {
		t.Fatalf("got %d combos, want %d (rowResults=%+v)", len(res.Combos), len(in), res.RowResults)
	}
	if !reflect.DeepEqual(res.Combos, in) {
		for i := range in {
			if !reflect.DeepEqual(res.Combos[i], in[i]) {
				t.Errorf("combo[%d] mismatch:\n got=%+v\nwant=%+v", i, res.Combos[i], in[i])
			}
		}
	}
}

// hitTypeEnumIssues は res 内の hit_type 列に対する VAL-ENUM 指摘を集める。
func hitTypeEnumIssues(res *Result) []Issue {
	var out []Issue
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == "hit_type" && is.Code == "VAL-ENUM" {
				out = append(out, is)
			}
		}
	}
	return out
}

// TestHitTypeJustParryRoundTrip は M18-01(CHANGE-082)の新値 just_parry_punish_counter が
// export→import で round-trip し、既定 whitelist(DefaultHitTypes)で警告なく通ることを検証する。
func TestHitTypeJustParryRoundTrip(t *testing.T) {
	in := []Combo{draftMinimal(Combo{
		LocalID:       "c1",
		CharacterCode: "ryu",
		HitType:       "just_parry_punish_counter",
		Steps:         []Step{{MoveCode: "5lp", Modifiers: Modifiers{}}},
	})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	if issues := hitTypeEnumIssues(res); len(issues) != 0 {
		t.Errorf("新値が whitelist を通らず VAL-ENUM 指摘: %+v", issues)
	}
	if len(res.Combos) != 1 || res.Combos[0].HitType != "just_parry_punish_counter" {
		t.Errorf("hit_type round-trip 失敗: %+v", res.Combos)
	}
}

// TestHitTypeM2701RoundTrip は M27-01 で足した 4 値が export→import で round-trip し、
// 既定 whitelist(DefaultHitTypes)で警告なく通ることを検証する。
//
// ★TestHitTypeJustParryRoundTrip(M18-01)と同じ形である。値を足すたびにここへ 1 行増やす。
// ★破壊確認: rules.go の DefaultHitTypes から新値を 1 つ抜くと本テストが赤くなる。
func TestHitTypeM2701RoundTrip(t *testing.T) {
	for _, ht := range []string{
		"drive_impact_wall_splat_hit",
		"drive_impact_wall_splat_block",
		"drive_impact_punish_counter",
		"stun",
	} {
		in := []Combo{draftMinimal(Combo{
			LocalID:       "c1",
			CharacterCode: "ryu",
			HitType:       ht,
			Steps:         []Step{{MoveCode: "5lp", Modifiers: Modifiers{}}},
		})}
		csvText, err := ExportCSV(in)
		if err != nil {
			t.Fatalf("ExportCSV(%s): %v", ht, err)
		}
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate(%s): %v", ht, err)
		}
		if issues := hitTypeEnumIssues(res); len(issues) != 0 {
			t.Errorf("新値 %s が whitelist を通らず VAL-ENUM 指摘: %+v", ht, issues)
		}
		if len(res.Combos) != 1 || res.Combos[0].HitType != ht {
			t.Errorf("hit_type %s の round-trip 失敗: %+v", ht, res.Combos)
		}
	}
}

// opponentSizeEnumIssues は res 内の opponent_size 列に対する VAL-ENUM 指摘を集める。
func opponentSizeEnumIssues(res *Result) []Issue {
	var out []Issue
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == "opponent_size" && is.Code == "VAL-ENUM" {
				out = append(out, is)
			}
		}
	}
	return out
}

// TestOpponentSizeRoundTrip は相手の大きさ 4 値の往復を見る。
//
// ★★着手前、opponent_size を通すテストは Go に 1 件も無かった(使用値は全件 "medium")。
//
//	large1 / large2 を通す経路が 0 件だったため、ホワイトリストが本体と 1/3 しか
//	一致していない状態が誰にも気づかれず残っていた
//	(followup `csv-import-opponent-size-whitelist-stale`)。⇒ 4 値すべてを通す。
//
// ★large1 / large2 が WARNING になるのは **現時点の正しい姿**である
//
//	(ホワイトリストの是正は開発者裁定でスコープ外)。値そのものは保持され、
//	取込も止まらない(importable: true)。⇒ 「往復で値が失われないこと」を主に見る。
func TestOpponentSizeRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		size      string
		wantIssue bool // ホワイトリストに無く VAL-ENUM が付くか
	}{
		{"standard", false},
		{"large", false},
		// ★既知のズレ。解消したら wantIssue を false にすること。
		{"large1", true},
		{"large2", true},
	} {
		in := []Combo{draftMinimal(Combo{
			LocalID:       "c1",
			CharacterCode: "ryu",
			OpponentSize:  tc.size,
			Steps:         []Step{{MoveCode: "5lp", Modifiers: Modifiers{}}},
		})}
		csvText, err := ExportCSV(in)
		if err != nil {
			t.Fatalf("ExportCSV(%s): %v", tc.size, err)
		}
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate(%s): %v", tc.size, err)
		}

		// ★★主眼: 未知値であっても値は保持される(往復で失われない)。
		if len(res.Combos) != 1 || res.Combos[0].OpponentSize != tc.size {
			t.Errorf("opponent_size %s の round-trip 失敗: %+v", tc.size, res.Combos)
		}

		issues := opponentSizeEnumIssues(res)
		if tc.wantIssue && len(issues) == 0 {
			t.Errorf("%s は現時点ではホワイトリスト外のはずだが VAL-ENUM が出ていない。"+
				"既知のズレが解消したなら本テストの wantIssue を更新すること", tc.size)
		}
		if !tc.wantIssue && len(issues) != 0 {
			t.Errorf("%s がホワイトリストを通らず VAL-ENUM 指摘: %+v", tc.size, issues)
		}
		// ★既定(EnumStrict なし)では WARNING に留まり取込は止まらない。
		for _, is := range issues {
			if is.Severity == SeverityError {
				t.Errorf("%s の指摘が既定で ERROR になっている(既定は WARNING のはず): %+v", tc.size, is)
			}
		}
	}
}

// TestHitTypeUnknownRejected は既知 8 値が通り、未知値が EnumStrict で ERROR になることを検証する
// (既存値の挙動不変・新値受理・未知値棄却)。
// ★M27-01 で 4 値 → 8 値。値を足したらここへも足すこと。
func TestHitTypeUnknownRejected(t *testing.T) {
	for _, ht := range []string{
		"normal", "counter", "punish_counter", "just_parry_punish_counter",
		"drive_impact_wall_splat_hit", "drive_impact_wall_splat_block",
		"drive_impact_punish_counter", "stun",
	} {
		csvText, err := ExportCSV([]Combo{draftMinimal(Combo{LocalID: "c", CharacterCode: "ryu", HitType: ht})})
		if err != nil {
			t.Fatalf("ExportCSV(%s): %v", ht, err)
		}
		res, err := ParseAndValidate(csvText, Options{EnumStrict: true})
		if err != nil {
			t.Fatalf("ParseAndValidate(%s): %v", ht, err)
		}
		if issues := hitTypeEnumIssues(res); len(issues) != 0 {
			t.Errorf("既知値 %s が EnumStrict で棄却された: %+v", ht, issues)
		}
	}

	csvText, err := ExportCSV([]Combo{draftMinimal(Combo{LocalID: "c", CharacterCode: "ryu", HitType: "bogus_hit_type"})})
	if err != nil {
		t.Fatalf("ExportCSV(unknown): %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{EnumStrict: true})
	if err != nil {
		t.Fatalf("ParseAndValidate(unknown): %v", err)
	}
	issues := hitTypeEnumIssues(res)
	if len(issues) == 0 {
		t.Fatalf("未知 hit_type が棄却されていない")
	}
	if issues[0].Severity != SeverityError {
		t.Errorf("EnumStrict 下で未知値の重大度 = %v, want ERROR", issues[0].Severity)
	}
}

func TestFormulaInjectionSanitized(t *testing.T) {
	in := []Combo{draftMinimal(Combo{CharacterCode: "ryu", Memo: "=SUM(A1)"})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	// CSV 上では先頭に ' が付いて無害化されている。
	if !strings.Contains(csvText, "'=SUM(A1)") {
		t.Errorf("expected sanitized memo with leading quote in CSV, got:\n%s", csvText)
	}
	// import で剥がして元に戻る(往復同一性)。
	res, _ := ParseAndValidate(csvText, Options{})
	if got := res.Combos[0].Memo; got != "=SUM(A1)" {
		t.Errorf("desanitize failed: got %q want %q", got, "=SUM(A1)")
	}
}

func TestDriveDamageDecimalRange(t *testing.T) {
	// 範囲外(7)は VAL-C13 ERROR。
	csvText, _ := ExportCSV([]Combo{draftMinimal(Combo{CharacterCode: "ryu", DriveDamage: fp(7)})})
	res, _ := ParseAndValidate(csvText, Options{})
	if res.Summary.Error != 1 {
		t.Fatalf("expected 1 error row for out-of-range drive_damage, got summary=%+v", res.Summary)
	}
}

func TestDriveAvailableDecimalRange(t *testing.T) {
	// M16-01: 0.5 刻みの小数は範囲内なら往復成立、範囲外(6.5)は VAL-C04 ERROR。
	okText, _ := ExportCSV([]Combo{draftMinimal(Combo{CharacterCode: "ryu", DriveAvailableAtStart: fp(5.5)})})
	okRes, _ := ParseAndValidate(okText, Options{})
	if okRes.Summary.Error != 0 {
		t.Fatalf("expected 0 error for in-range 5.5, got summary=%+v", okRes.Summary)
	}
	if got := okRes.Combos[0].DriveAvailableAtStart; got == nil || *got != 5.5 {
		t.Errorf("round-trip drive_available_at_start = %v, want 5.5", got)
	}

	badText, _ := ExportCSV([]Combo{draftMinimal(Combo{CharacterCode: "ryu", DriveAvailableAtStart: fp(6.5)})})
	badRes, _ := ParseAndValidate(badText, Options{})
	if badRes.Summary.Error != 1 {
		t.Fatalf("expected 1 error row for out-of-range drive_available_at_start, got summary=%+v", badRes.Summary)
	}
}

type fakeLookup struct {
	chars map[string]bool
	moves map[string]bool // key: char|move
}

func (f fakeLookup) CharacterExists(code string) bool { return f.chars[code] }
func (f fakeLookup) MoveExists(c, m string) bool      { return f.moves[c+"|"+m] }

// backwardCompatDraftRow は「旧 CSV の 1 行」を作る。
//
// ★★M29-02 §2.2: 後方互換テストの主題は **列が無くても取り込めること** であり、
// 本登録の必須欄(VAL-C15)ではない。⇒ 行は仮登録にして、主題だけを残す。
// 仮登録にしても「消費列/メディア列が無い旧 CSV が読める」ことの主張は 1 つも減らない。
//
// ★レシピを 1 ステップ入れるのは VAL-C09(空レシピ)が仮登録にも適用されるため
// (M24-13 / CHANGE-139 の裁定)。
func backwardCompatDraftRow(cols []string) []string {
	row := make([]string, len(cols))
	for i, col := range cols {
		switch col {
		case ColCharacterCode:
			row[i] = "ryu"
		case ColIsDraft:
			row[i] = "true"
		case ColRecipe:
			row[i] = `"[{""move_code"":""5lp""}]"`
		}
	}
	return row
}

func TestCodeLookupValidation(t *testing.T) {
	in := []Combo{
		draftMinimal(Combo{CharacterCode: "ryu", Steps: []Step{{MoveCode: "5lp"}, {MoveCode: "unknownmv"}}}),
		draftMinimal(Combo{CharacterCode: "ghost"}),
	}
	csvText, _ := ExportCSV(in)
	lk := fakeLookup{chars: map[string]bool{"ryu": true}, moves: map[string]bool{"ryu|5lp": true}}
	res, _ := ParseAndValidate(csvText, Options{Lookup: lk})
	// row1: 未知 move は VAL-I07 WARNING → 取り込み候補(Warning)。
	// row2: 未知 character は VAL-I06 ERROR → 除外。
	if res.Summary.Error != 1 {
		t.Errorf("expected 1 error (unknown character), got %+v", res.Summary)
	}
	if res.Summary.Warning != 1 {
		t.Errorf("expected 1 warning (unknown move), got %+v", res.Summary)
	}
}

func TestRowLimit(t *testing.T) {
	var b strings.Builder
	b.WriteString(strings.Join(CSVColumns, ",") + "\n")
	for i := 0; i < 3; i++ {
		b.WriteString("c,ryu,false,,,,,,,,,,,,,,,,,,,\n")
	}
	res, err := ParseAndValidate(b.String(), Options{MaxRows: 2})
	if err == nil || res.FileError == nil || res.FileError.Code != "VAL-I03" {
		t.Fatalf("expected VAL-I03 row limit, got err=%v fileError=%+v", err, res.FileError)
	}
}

func TestMissingColumn(t *testing.T) {
	res, err := ParseAndValidate("character_code\nryu\n", Options{})
	if err == nil || res.FileError == nil || res.FileError.Code != "VAL-I04" {
		t.Fatalf("expected VAL-I04 missing column, got err=%v fileError=%+v", err, res.FileError)
	}
}

// TestGaugeConsumedRoundTrip: 消費列(SA=整数・drive=小数 0.5 刻み)が往復すること(M16-02)。
func TestGaugeConsumedRoundTrip(t *testing.T) {
	in := []Combo{draftMinimal(Combo{CharacterCode: "ryu", SAGaugeConsumed: ip(6), DriveGaugeConsumed: fp(10.5)})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("ParseAndValidate: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	got := res.Combos[0]
	if got.SAGaugeConsumed == nil || *got.SAGaugeConsumed != 6 {
		t.Errorf("sa_gauge_consumed = %v, want 6", got.SAGaugeConsumed)
	}
	if got.DriveGaugeConsumed == nil || *got.DriveGaugeConsumed != 10.5 {
		t.Errorf("drive_gauge_consumed = %v, want 10.5", got.DriveGaugeConsumed)
	}
}

// TestGaugeConsumedBackwardCompatImport: 消費列を含まない旧 CSV(列末尾追加前)の import が
// 成立し、消費列は nil(欠損=NULL)となること(M16-02・DES-002 §7.6 後方互換)。
func TestGaugeConsumedBackwardCompatImport(t *testing.T) {
	// 旧 CSV ヘッダ = CSVColumns から消費 2 列を除いたもの(= requiredImportColumns)。
	header := strings.Join(requiredImportColumns, ",")
	row := backwardCompatDraftRow(requiredImportColumns)
	oldCSV := header + "\n" + strings.Join(row, ",") + "\n"

	res, err := ParseAndValidate(oldCSV, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("old CSV should import: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	got := res.Combos[0]
	if got.SAGaugeConsumed != nil || got.DriveGaugeConsumed != nil {
		t.Errorf("missing consumed columns should be nil: sa=%v drive=%v", got.SAGaugeConsumed, got.DriveGaugeConsumed)
	}
}

// TestGaugeConsumedNoValidation: 消費列は VAL 非連動(範囲外値でも ERROR/WARNING を出さない)。
// SA=999・drive=100.5 は UI 上限を超えるが、import は範囲検証しないため OK 行になる(M16-02)。
func TestGaugeConsumedNoValidation(t *testing.T) {
	in := []Combo{draftMinimal(Combo{CharacterCode: "ryu", SAGaugeConsumed: ip(999), DriveGaugeConsumed: fp(100.5), Steps: []Step{{MoveCode: "5lp"}}})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("ParseAndValidate: err=%v fileError=%+v", err, res.FileError)
	}
	if res.Summary.Error != 0 {
		t.Errorf("consumed out-of-range should not error: summary=%+v rowResults=%+v", res.Summary, res.RowResults)
	}
	// 消費列由来の Issue が 1 件も無いことを確認。
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == ColSAGaugeConsumed || is.Column == ColDriveGaugeConsumed {
				t.Errorf("unexpected issue on consumed column: %+v", is)
			}
		}
	}
}

// TestMediaRoundTrip: メディア 3 列(M17-01)が verbatim で往復すること(解決・正規化・書換なし)。
// 相対パス・危険スキーム風文字列・式トリガ先頭もそのまま保存される(緩検証)。
func TestMediaRoundTrip(t *testing.T) {
	in := []Combo{draftMinimal(Combo{
		CharacterCode: "ryu",
		Link:          "javascript:alert(1)", // 保存は任意文字列可(リンク化制限は表示層の責務)
		VideoPath:     "../videos/回り込み.mp4",
		ImagePath:     "=IMAGE(A1).png", // 式トリガ先頭(VAL-I10 対象)も verbatim 往復
	})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("ParseAndValidate: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	got := res.Combos[0]
	if got.Link != in[0].Link || got.VideoPath != in[0].VideoPath || got.ImagePath != in[0].ImagePath {
		t.Errorf("media round-trip mismatch:\n got=link=%q video=%q image=%q\nwant=link=%q video=%q image=%q",
			got.Link, got.VideoPath, got.ImagePath, in[0].Link, in[0].VideoPath, in[0].ImagePath)
	}
}

// TestMediaBackwardCompatImport: メディア 3 列を含まない旧 CSV(列末尾追加前)の import が
// 成立し、3 列は空(=NULL)となること(M17-01・DES-002 §7.6 後方互換)。
func TestMediaBackwardCompatImport(t *testing.T) {
	// 旧 CSV ヘッダ = 必須列のみ(メディア 3 列は optionalImportColumns のため含まれない)。
	header := strings.Join(requiredImportColumns, ",")
	row := backwardCompatDraftRow(requiredImportColumns)
	oldCSV := header + "\n" + strings.Join(row, ",") + "\n"

	res, err := ParseAndValidate(oldCSV, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("old CSV should import: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	got := res.Combos[0]
	if got.Link != "" || got.VideoPath != "" || got.ImagePath != "" {
		t.Errorf("missing media columns should be empty(=NULL): link=%q video=%q image=%q",
			got.Link, got.VideoPath, got.ImagePath)
	}
}

// TestMediaNoValidation: メディア 3 列は緩検証(URL/パス形式が不正でも ERROR/WARNING を出さない)。
// 閲覧不可(リンク切れ・ファイル不在)も import では検証しない(M17-01・DES-006 §6)。
func TestMediaNoValidation(t *testing.T) {
	in := []Combo{draftMinimal(Combo{
		CharacterCode: "ryu",
		Link:          "not a url at all",
		VideoPath:     "C:\\Windows\\system32\\???",
		ImagePath:     "no-such-file.png",
		Steps:         []Step{{MoveCode: "5lp"}},
	})}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("ParseAndValidate: err=%v fileError=%+v", err, res.FileError)
	}
	if res.Summary.Error != 0 {
		t.Errorf("media values should not error: summary=%+v rowResults=%+v", res.Summary, res.RowResults)
	}
	// メディア列由来の Issue が 1 件も無いことを確認。
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == ColLink || is.Column == ColVideoPath || is.Column == ColImagePath {
				t.Errorf("unexpected issue on media column: %+v", is)
			}
		}
	}
}

func TestSizeLimit(t *testing.T) {
	// VAL-I01: maxBytes 超過でファイル全体拒否。
	big := strings.Repeat("a", 100)
	res, err := ParseAndValidate(big, Options{MaxBytes: 10})
	if err == nil || res.FileError == nil || res.FileError.Code != "VAL-I01" {
		t.Fatalf("expected VAL-I01 size reject, got err=%v fileError=%+v", err, res.FileError)
	}
}

func TestInvalidUTF8(t *testing.T) {
	// VAL-I02: 不正 UTF-8 でファイル全体拒否(コンボ CSV)。
	bad := "character_code\n\xff\xfe\n"
	res, err := ParseAndValidate(bad, Options{})
	if err == nil || res.FileError == nil || res.FileError.Code != "VAL-I02" {
		t.Fatalf("expected VAL-I02 utf8 reject (combo), got err=%v fileError=%+v", err, res.FileError)
	}
	// セットプレイ CSV も対称に拒否。
	sres, serr := ParseSetupsCSV("parent_combo_local_id\n\xff\xfe\n", Options{})
	if serr == nil || sres.FileError == nil || sres.FileError.Code != "VAL-I02" {
		t.Fatalf("expected VAL-I02 utf8 reject (setup), got err=%v fileError=%+v", serr, sres.FileError)
	}
}

func TestFormulaTriggersAllSanitized(t *testing.T) {
	// 式トリガ全 4 種(= + - @)が export で ' 付与され、import で対称剥がしされる。
	for _, payload := range []string{"=SUM(1)", "+1+1", "-2+3", "@cmd"} {
		in := []Combo{draftMinimal(Combo{CharacterCode: "ryu", Memo: payload})}
		csvText, err := ExportCSV(in)
		if err != nil {
			t.Fatalf("ExportCSV(%q): %v", payload, err)
		}
		if !strings.Contains(csvText, "'"+payload) {
			t.Errorf("payload %q not sanitized with leading quote in CSV:\n%s", payload, csvText)
		}
		res, _ := ParseAndValidate(csvText, Options{})
		if got := res.Combos[0].Memo; got != payload {
			t.Errorf("desanitize %q failed: got %q", payload, got)
		}
	}
}

func TestEmptyTagNameWarning(t *testing.T) {
	// 空 name タグは VAL-T02 WARNING(行は取り込み可能)。
	in := []Combo{draftMinimal(Combo{CharacterCode: "ryu", Tags: []Tag{{Name: ""}}})}
	csvText, _ := ExportCSV(in)
	res, _ := ParseAndValidate(csvText, Options{})
	if res.Summary.Warning != 1 {
		t.Fatalf("expected 1 warning row for empty tag name, got %+v", res.Summary)
	}
	found := false
	for _, is := range res.RowResults[0].Issues {
		if is.Code == "VAL-T02" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected VAL-T02 issue, got %+v", res.RowResults[0].Issues)
	}
}

func TestSetupRoundTrip(t *testing.T) {
	in := []Setup{
		{ParentComboLocalID: "c1", Name: "詐欺飛び", Description: "+46 から", Steps: []Step{{MoveCode: "j.hk"}}},
		// 既存コンボ実 ID 紐付け。
		// ★M29-02: レシピを 1 ステップ持たせた。着手前は Steps が空だったが、
		//   ★その形は確定側(internal/service/setup の VAL-S02)が必ず ERROR で
		//   落とす行であり、export がこの形を出すことはない。⇒ 主題(実 ID 紐付けの
		//   往復)は 1 つも減らさずに、成立する行へ改めた。
		{ParentComboLocalID: "42", Name: "重ね", Steps: []Step{{MoveCode: "5mp"}}},
	}
	csvText, err := ExportSetupsCSV(in)
	if err != nil {
		t.Fatalf("ExportSetupsCSV: %v", err)
	}
	res, err := ParseSetupsCSV(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseSetupsCSV: %v", err)
	}
	if !reflect.DeepEqual(res.Setups, in) {
		t.Errorf("setup round-trip mismatch:\n got=%+v\nwant=%+v", res.Setups, in)
	}
}

// ★★M24-13 / CHANGE-139: プレビュー層の VAL-C09 は仮登録も対象にする。
//
// ★★M29-02 §2.2b(2026-09-07・開発者選択): severity を WARNING → ERROR へ揃えた。
//
//	着手前、本テストは「WARNING であること」「行が取込候補のままであること」を
//	主張していた。それは M24-13 が「取込可否を変えないため」に据え置いた状態を
//	固定したものである。⇒ 主張を反転させた。テストは消していない。
//
//	★★揃えても取り込める行は 1 件も変わらない —— 0 ステップの行は、いまでも
//	確定(commit)で internal/service/validation が ERROR で落としている。
//	変わるのは「プレビューが嘘をつかなくなる」ことだけである。
//	★DES-006 §2.1 の正典も ERROR であり、M24-13 の裁定の向きとも一致する。
func TestVALC09_EmptyRecipe_ErrorsForDraftAndPublished(t *testing.T) {
	for _, tc := range []struct {
		name    string
		isDraft bool
	}{
		{"published", false},
		{"draft", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			csvText, _ := ExportCSV([]Combo{{CharacterCode: "ryu", IsDraft: tc.isDraft}})
			res, err := ParseAndValidate(csvText, Options{})
			if err != nil {
				t.Fatalf("ParseAndValidate: %v", err)
			}
			found := false
			for _, is := range res.RowResults[0].Issues {
				if is.Code == "VAL-C09" {
					found = true
					if is.Severity != SeverityError {
						t.Errorf("VAL-C09 severity = %v, want ERROR", is.Severity)
					}
				}
			}
			if !found {
				t.Errorf("expected VAL-C09 for an empty recipe, got %+v", res.RowResults[0].Issues)
			}
			// ★★プレビューで止める。確定で初めて落ちる形を消すのが本サブの目的である。
			if res.RowResults[0].Status != StatusError {
				t.Errorf("VAL-C09 は行を取込不可にすべき: status=%v", res.RowResults[0].Status)
			}
		})
	}
}

// ★★M29-02 §2.2: VAL-C15(本登録の必須欄)をプレビュー層でも見ること。
//
// 着手前、本層にはこの検査そのものが無かった。⇒ 必須欄が空の本登録行は
// プレビューで **課題が 1 件も出ず**、確定で ERROR が出ていた。
// §2.2 の非対称の中で最も黙っていた 1 件である。
//
// ★★★【M38-01・射程 3 / 追補2】**必須は damage / knockdown_advantage の 2 列だけ**。
// ★★開始残量 2 列は追補2 で**任意**になった(2026-09-18 開発者裁定)。
// ⇒ CSV でも**空セル＝「不問」**として通る。
// ★★消費ゲージ 2 列も必須から外れている(下の対照 t.Run が両方を固定する)。
func TestVALC15_RequiredFields_ErrorsForPublishedOnly(t *testing.T) {
	t.Run("published は damage / knockdown_advantage を咎める", func(t *testing.T) {
		csvText, _ := ExportCSV([]Combo{{
			CharacterCode: "ryu",
			IsDraft:       false,
			Steps:         []Step{{MoveCode: "5lp"}},
		}})
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate: %v", err)
		}
		cols := map[string]bool{}
		for _, is := range res.RowResults[0].Issues {
			if is.Code == "VAL-C15" {
				if is.Severity != SeverityError {
					t.Errorf("VAL-C15 severity = %v, want ERROR", is.Severity)
				}
				cols[is.Column] = true
			}
		}
		for _, want := range []string{ColDamage, ColKnockdownAdvantage} {
			if !cols[want] {
				t.Errorf("VAL-C15 が %s を咎めていない(issues=%+v)", want, res.RowResults[0].Issues)
			}
		}

		// ★★★対照: 空セルを咎めない 2 組。どちらも VAL-C15 の必須から外れている。
		//   ★開始残量 2 列 = 追補2 で外れた。空セルは「不問」である。
		//   ★消費ゲージ 2 列 = M38-01 本体で外れた。
		for _, notWant := range []string{
			ColDriveAvailableAtStart, ColSAAvailableAtStart,
			ColDriveGaugeConsumed, ColSAGaugeConsumed,
		} {
			if cols[notWant] {
				t.Errorf("★VAL-C15 が %s を咎めている(issues=%+v)", notWant, res.RowResults[0].Issues)
			}
		}
	})

	t.Run("draft は 1 件も咎めない", func(t *testing.T) {
		// ★仮登録は「うろ覚えや机上アイデア」の記録である(FR009 / FR305)。
		//   確定側(validateC15RequiredFields)も仮登録はスキップする。揃えている。
		csvText, _ := ExportCSV([]Combo{{
			CharacterCode: "ryu",
			IsDraft:       true,
			Steps:         []Step{{MoveCode: "5lp"}},
		}})
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate: %v", err)
		}
		for _, is := range res.RowResults[0].Issues {
			if is.Code == "VAL-C15" {
				t.Errorf("★仮登録に VAL-C15 が出ている: %+v", is)
			}
		}
	})

	t.Run("4 欄が埋まっていれば咎めない", func(t *testing.T) {
		csvText, _ := ExportCSV([]Combo{{
			CharacterCode:      "ryu",
			IsDraft:            false,
			Damage:             ip(2400),
			KnockdownAdvantage: ip(46),
			DriveGaugeConsumed: fp(3.5),
			SAGaugeConsumed:    ip(2),
			Steps:              []Step{{MoveCode: "5lp"}},
		}})
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate: %v", err)
		}
		if res.RowResults[0].Status == StatusError {
			t.Errorf("★必須欄が埋まっているのに取込不可になっている: %+v", res.RowResults[0].Issues)
		}
	})

	t.Run("0 は未入力ではない(nil との区別)", func(t *testing.T) {
		// ★★「空かどうか」だけを見る(値域は見ない)。0 は立派な入力である。
		//   ここを取り違えると、ダメージ 0 のコンボが取り込めなくなる。
		csvText, _ := ExportCSV([]Combo{{
			CharacterCode:      "ryu",
			IsDraft:            false,
			Damage:             ip(0),
			KnockdownAdvantage: ip(0),
			DriveGaugeConsumed: fp(0),
			SAGaugeConsumed:    ip(0),
			Steps:              []Step{{MoveCode: "5lp"}},
		}})
		res, err := ParseAndValidate(csvText, Options{})
		if err != nil {
			t.Fatalf("ParseAndValidate: %v", err)
		}
		for _, is := range res.RowResults[0].Issues {
			if is.Code == "VAL-C15" {
				t.Errorf("★0 を未入力として咎めている: %+v", is)
			}
		}
	})
}

// ★M24-13: ステップが 1 本あれば、技が未指定でも VAL-C09 は出ない。
// ★数えているのがステップの本数だけであることの固定(move_code の中身は見ていない)。
func TestVALC09_SingleStepWithoutMoveCode_NoWarning(t *testing.T) {
	csvText, _ := ExportCSV([]Combo{{
		CharacterCode: "ryu",
		IsDraft:       true,
		Steps:         []Step{{MoveCode: "", Modifiers: Modifiers{Type: "parry_drive_rush"}}},
	}})
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	for _, is := range res.RowResults[0].Issues {
		if is.Code == "VAL-C09" {
			t.Errorf("VAL-C09 must not fire for a 1-step recipe: %+v", res.RowResults[0].Issues)
		}
	}
}

// ★★M29-02 レビュー高-2: VAL-S02(セットプレイのレシピが空)をプレビューでも見ること。
//
// VAL-C09 の完全な双子である —— 確定側(internal/service/setup)は ERROR で落とすのに、
// 本層には検査そのものが無かった。★向きも同じ「プレビューで通ったものが確定で落ちる」。
//
// ★★初回の是正が VAL-S06 だけを見て本件を見落としたのは、「非対称を 1 件ずつ潰した」
// ためである。⇒ 確定側の検証器が持つ VAL を列挙して突き合わせる数え方をしていれば
// 落ちなかった。本テストはその再発を防ぐ。
func TestVALS02_EmptySetupRecipe_Errors(t *testing.T) {
	in := []Setup{{ParentComboLocalID: "c1", Name: "重ね"}} // レシピ無し
	csvText, err := ExportSetupsCSV(in)
	if err != nil {
		t.Fatalf("ExportSetupsCSV: %v", err)
	}
	res, err := ParseSetupsCSV(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseSetupsCSV: %v", err)
	}
	found := false
	for _, is := range res.RowResults[0].Issues {
		if is.Code == "VAL-S02" {
			found = true
			if is.Severity != SeverityError {
				t.Errorf("VAL-S02 severity = %v, want ERROR", is.Severity)
			}
		}
	}
	if !found {
		t.Fatalf("レシピが空のセットプレイに VAL-S02 が出ていない: %+v", res.RowResults[0].Issues)
	}
	// ★確定で初めて落ちる形を消すのが目的である。⇒ プレビューで取込不可にする。
	if res.RowResults[0].Status != StatusError {
		t.Errorf("VAL-S02 は行を取込不可にすべき: status=%v", res.RowResults[0].Status)
	}
}

func TestVALS02_NonEmptySetupRecipe_NoIssue(t *testing.T) {
	// ★対照。1 ステップ在れば咎めない(偽陽性を出さない)。
	in := []Setup{{ParentComboLocalID: "c1", Name: "重ね", Steps: []Step{{MoveCode: "5mp"}}}}
	csvText, _ := ExportSetupsCSV(in)
	res, err := ParseSetupsCSV(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseSetupsCSV: %v", err)
	}
	for _, is := range res.RowResults[0].Issues {
		if is.Code == "VAL-S02" {
			t.Errorf("★1 ステップ在るのに VAL-S02 が出ている: %+v", is)
		}
	}
}

// ★★M29-02 レビュー中: 「旧 CSV の本登録行」の主張を取り戻す。
//
// 後方互換テスト(TestGaugeConsumedBackwardCompatImport 等)は、本サブで
// VAL-C15 をプレビューへ足したことに合わせて行を仮登録へ差し替えた。⇒ その結果
// 「消費列を持たない旧 CSV の *本登録* 行がどうなるか」の主張が消えていた。
//
// ★★答えは「取り込めない」である。★これは本サブが作った状態ではない ——
// M27-02b(VAL-C15)以降、必須欄が空の本登録は確定で必ず落ちていた。
// 本サブはそれをプレビューでも見えるようにしただけである。
//
// ★★★【M38-01・射程 3】**咎める列が変わった。結論は変わっていない。**
//
//	★以下は失効した記述:「消費ゲージが空の本登録は確定で必ず落ちていた」——
//	  消費ゲージ 2 列は VAL-C15 の必須から外れた。
//	★旧 CSV は damage / knockdown_advantage も持たないため、**同じ行が
//	  同じ理由(値の不在)で同じように落ちる。** ⇒ 本テストの主張は不変である。
//	★開始残量 2 列も旧 CSV に無いが、そちらは咎めない(追補2 で必須から外れ、
//	  空セルが「不問」を意味するため。validate.go の requiredPublishedCSVFields の注記)。
//
// ★★DES-002 §7.6 は「旧 CSV(消費列なし)を後方互換で受理する」と定めている。
// ⇒ 列の不在は受理するが、値の不在は本登録では受理しない。この緊張関係は
// 設計卓へ申し送っている(M29-02 完了報告 §11-7)。本テストはその実態を固定する。
func TestBackwardCompatOldCSV_PublishedRowIsRejectedByC15(t *testing.T) {
	header := strings.Join(requiredImportColumns, ",")
	row := make([]string, len(requiredImportColumns))
	for i, col := range requiredImportColumns {
		switch col {
		case ColCharacterCode:
			row[i] = "ryu"
		case ColIsDraft:
			row[i] = "false" // ★本登録
		case ColRecipe:
			row[i] = `"[{""move_code"":""5lp""}]"`
		}
	}
	oldCSV := header + "\n" + strings.Join(row, ",") + "\n"

	res, err := ParseAndValidate(oldCSV, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("列構成そのものは受理されるはず: err=%v fileError=%+v", err, res.FileError)
	}
	// ★列の不在では弾かれない(VAL-I04 は出ない)。値の不在で弾かれる。
	codes := map[string]bool{}
	for _, is := range res.RowResults[0].Issues {
		codes[is.Code] = true
	}
	if codes["VAL-I04"] {
		t.Error("★列の不在で弾いている(後方互換が壊れている)")
	}
	if !codes["VAL-C15"] {
		t.Fatalf("必須欄が空の本登録行が VAL-C15 で咎められていない: %+v", res.RowResults[0].Issues)
	}
	if res.RowResults[0].Status != StatusError {
		t.Errorf("status = %v, want ERROR(確定側と同じ結論)", res.RowResults[0].Status)
	}
}

func TestBackwardCompatOldCSV_DraftRowStillImports(t *testing.T) {
	// ★対照。仮登録なら旧 CSV はこれまでどおり取り込める(後方互換は生きている)。
	header := strings.Join(requiredImportColumns, ",")
	row := backwardCompatDraftRow(requiredImportColumns)
	oldCSV := header + "\n" + strings.Join(row, ",") + "\n"

	res, err := ParseAndValidate(oldCSV, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("old CSV should import: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
}
