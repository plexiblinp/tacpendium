package csvcore

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

// decodeRow は1データ行(rec)をコンボ DTO へ復元し、DES-006 準拠の検証を掛けて
// RowResult を組み立てる。1件でも ERROR があれば Status=Error(Combo は nil)。
// ERROR が無く WARNING があれば Status=Warning、いずれも無ければ Status=OK。
func (cfg resolved) decodeRow(rowNum int, rec []string, get func([]string, string) string) RowResult {
	rr := RowResult{RowNumber: rowNum}
	cell := func(col string) string { return get(rec, col) }
	add := func(col, code string, sev Severity, msg string) {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: code, Severity: sev, Message: msg})
	}

	// 防御: セル肥大の早期拒否(VAL-I01 を行レベルで補完)。
	for _, col := range CSVColumns {
		if v := cell(col); len(v) > cfg.maxCellBytes {
			add(col, "VAL-I01", SeverityError,
				fmt.Sprintf("cell size %d bytes exceeds limit %d", len(v), cfg.maxCellBytes))
		}
	}

	var c Combo

	// local_id: 検証なし(往復・紐付け用の一時 ID)。
	c.LocalID = cell(ColLocalID)

	// character_code: 必須(空は ERROR)。存在検証は Lookup 注入時のみ(VAL-I06)。
	c.CharacterCode = cell(ColCharacterCode)
	if c.CharacterCode == "" {
		add(ColCharacterCode, "VAL-I05", SeverityError, "character_code is required")
	} else if cfg.lookup != nil && !cfg.lookup.CharacterExists(c.CharacterCode) {
		add(ColCharacterCode, "VAL-I06", SeverityError,
			fmt.Sprintf("unknown character_code %q", c.CharacterCode))
	}

	// is_draft: 厳密 bool。
	c.IsDraft = cfg.boolField(&rr, ColIsDraft, cell)

	// 起き攻めフラット 12 フラグ: nullable bool(空=NULL)。M16-03 正規化(sparse・フラット列維持)。
	// 既存 6 列。
	c.OkiMeatyNeutralTechThrow = cfg.boolPtrField(&rr, ColOkiMeatyNeutralTechThrow, cell)
	c.OkiMeatyNeutralTechThrowDR = cfg.boolPtrField(&rr, ColOkiMeatyNeutralTechThrowDR, cell)
	c.OkiMeatyBackTechThrow = cfg.boolPtrField(&rr, ColOkiMeatyBackTechThrow, cell)
	c.OkiMeatyBackTechThrowDR = cfg.boolPtrField(&rr, ColOkiMeatyBackTechThrowDR, cell)
	c.OkiShimmyNeutralTech = cfg.boolPtrField(&rr, ColOkiShimmyNeutralTech, cell)
	c.OkiShimmyBackTech = cfg.boolPtrField(&rr, ColOkiShimmyBackTech, cell)
	// M16-03 新規任意列(欠損セル=NULL・旧 CSV 後方互換)。
	c.OkiShimmyNeutralTechDR = cfg.boolPtrField(&rr, ColOkiShimmyNeutralTechDR, cell)
	c.OkiShimmyBackTechDR = cfg.boolPtrField(&rr, ColOkiShimmyBackTechDR, cell)
	c.OkiStrikeMeatyNeutralTech = cfg.boolPtrField(&rr, ColOkiStrikeMeatyNeutralTech, cell)
	c.OkiStrikeMeatyNeutralTechDR = cfg.boolPtrField(&rr, ColOkiStrikeMeatyNeutralTechDR, cell)
	c.OkiStrikeMeatyBackTech = cfg.boolPtrField(&rr, ColOkiStrikeMeatyBackTech, cell)
	c.OkiStrikeMeatyBackTechDR = cfg.boolPtrField(&rr, ColOkiStrikeMeatyBackTechDR, cell)
	// ★M27-02b: 空セル(旧 CSV)は nil。後段で false(未検証)として読む。
	c.OkiVerified = cfg.boolPtrField(&rr, ColOkiVerified, cell)
	// ★M28-02a: 始動位置マス数・運び量(0〜160)。空=NULL=nil。
	//   ★値域外は ERROR。DB の CHECK と同じ値域であり、通しても INSERT で落ちる
	//     ——そのときは行ごと失敗し、どのセルが悪いのか利用者に伝わらない。
	//   ★★VAL-Cxx の番号を自採番しない(D-293 と同じ理由)。DES-006 へ検証コードが
	//     要るかは設計卓の手番であり、製造は docs/design/ を編集しない(指示書 §2.2-3-b)。
	//     ⇒ CSV 層に閉じた記述的コードを使う(先例＝VAL-ENUM。DES-006 に番号を持たない)。
	c.StartPositionMass = cfg.intField(&rr, ColStartPositionMass, cell,
		&PositionMassRange, "VAL-RANGE", SeverityError)
	c.CarryDistanceMass = cfg.intField(&rr, ColCarryDistanceMass, cell,
		&PositionMassRange, "VAL-RANGE", SeverityError)
	// ★M37-07: 空セル(旧 CSV)は nil。後段で false(通常始動)として読む。
	c.StarterMeaty = cfg.boolPtrField(&rr, ColStarterMeaty, cell)

	// VAL-C11: 起き攻め整合性(DR 版が true なら同 (attack,tech) の非 DR 版も true であるべき)。WARNING。
	// M16-03: 全 attack_type(throw_meaty / shimmy / strike_meaty)へ一様適用(開発者確定 2026-07-05)。
	// 仮登録(is_draft)は DES-006 §2.2 により C11 を適用しない。
	if !c.IsDraft {
		checkC11 := func(drCol string, dr, base *bool) {
			if derefBool(dr) && !derefBool(base) {
				add(drCol, "VAL-C11", SeverityWarning,
					fmt.Sprintf("DR flag %q is true but its no-gauge counterpart is false", drCol))
			}
		}
		checkC11(ColOkiMeatyNeutralTechThrowDR, c.OkiMeatyNeutralTechThrowDR, c.OkiMeatyNeutralTechThrow)
		checkC11(ColOkiMeatyBackTechThrowDR, c.OkiMeatyBackTechThrowDR, c.OkiMeatyBackTechThrow)
		checkC11(ColOkiShimmyNeutralTechDR, c.OkiShimmyNeutralTechDR, c.OkiShimmyNeutralTech)
		checkC11(ColOkiShimmyBackTechDR, c.OkiShimmyBackTechDR, c.OkiShimmyBackTech)
		checkC11(ColOkiStrikeMeatyNeutralTechDR, c.OkiStrikeMeatyNeutralTechDR, c.OkiStrikeMeatyNeutralTech)
		checkC11(ColOkiStrikeMeatyBackTechDR, c.OkiStrikeMeatyBackTechDR, c.OkiStrikeMeatyBackTech)
	}

	// 整数列(空=NULL)。範囲は DES-006 §2.1。
	// drive/sa(C04/C05)は仮登録でも ERROR。knockdown(C10)は仮登録で範囲チェックを外す。
	var kdRange *IntRange
	if !c.IsDraft {
		kdRange = &KnockdownRange
	}
	c.Damage = cfg.intField(&rr, ColDamage, cell, nil, "", 0)
	// drive_available_at_start: 空=NULL=nil、非空=厳密 *float64。範囲 0〜6・0.5 刻み許容(VAL-C04、ERROR、M16-01)。
	c.DriveAvailableAtStart = cfg.floatField(&rr, ColDriveAvailableAtStart, cell,
		&DriveAvailableRange, "VAL-C04", SeverityError)
	c.SAAvailableAtStart = cfg.intField(&rr, ColSAAvailableAtStart, cell,
		&SAAvailableRange, "VAL-C05", SeverityError)
	c.KnockdownAdvantage = cfg.intField(&rr, ColKnockdownAdvantage, cell,
		kdRange, "VAL-C10", SeverityWarning)

	// drive_damage: 空=NULL=nil、非空=厳密 *float64。範囲 -6〜6(VAL-C13、ERROR)。
	c.DriveDamage = cfg.floatField(&rr, ColDriveDamage, cell, &DriveDamageRange, "VAL-C13", SeverityError)

	// 消費ゲージ列(M16-02): 空=NULL=nil、非空=厳密 *int / *float64。範囲検証なし(VAL 非連動、
	// range=nil)。型エラーのみ VAL-I05(既存 damage 列と同じ扱い)。範囲外値でも ERROR/WARNING は出さない。
	c.SAGaugeConsumed = cfg.intField(&rr, ColSAGaugeConsumed, cell, nil, "", 0)
	c.DriveGaugeConsumed = cfg.floatField(&rr, ColDriveGaugeConsumed, cell, nil, "", 0)

	// enum 列(空は許容=NULL)。未知値は既定 WARNING(EnumStrict で ERROR)。
	c.Position = cfg.enumField(&rr, ColPosition, cell, cfg.positions)
	c.OpponentStance = cfg.enumField(&rr, ColOpponentStance, cell, cfg.stances)
	c.HitType = cfg.enumField(&rr, ColHitType, cell, cfg.hitTypes)
	c.OpponentSize = cfg.enumField(&rr, ColOpponentSize, cell, cfg.sizes)

	// 自由入力(VAL-I10 で export 時に付与された ' を剥がして verbatim 復元)。
	c.Memo = desanitizeFreeText(cell(ColMemo))

	// メディア 3 列(M17-01): 緩検証=検証エラーを出さない。verbatim 復元(解決・書換なし)。
	// 旧 CSV(3 列なし)は欠損セル("")=NULL 扱い(任意列・後方互換)。
	c.Link = desanitizeFreeText(cell(ColLink))
	c.VideoPath = desanitizeFreeText(cell(ColVideoPath))
	c.ImagePath = desanitizeFreeText(cell(ColImagePath))

	// situation: セル内 JSON を verbatim 保持。空=nil(DB NULL)、"null"=JSON の null。
	if s := cell(ColSituation); s != "" {
		if !json.Valid([]byte(s)) {
			add(ColSituation, "VAL-I05", SeverityError, "situation is not valid JSON")
		} else {
			c.Situation = json.RawMessage(s)
		}
	}

	// tags: セル内 JSON 配列 [{name, category?, color?}]。
	if s := cell(ColTags); s != "" {
		if err := json.Unmarshal([]byte(s), &c.Tags); err != nil {
			add(ColTags, "VAL-I05", SeverityError, "tags JSON: "+err.Error())
			c.Tags = nil
		} else {
			for i, tg := range c.Tags {
				if tg.Name == "" {
					// VAL-T02 相当。
					//
					// ★★M29-02 §2.2: VAL-C09 / VAL-S06 と違い、ここは WARNING のままが
					//   正しい。確定側(import.go の commitOneCombo)は名前が空のタグを
					//   **読み飛ばすだけで行は取り込む**。⇒ 「警告を出して処理を続行する」
					//   という DES-006 §1.2 の WARNING の定義に、確定側の挙動が一致している。
					//
					//   ★★ここを ERROR へ揃えると、いままで取り込めていた行が取り込めなく
					//   なる —— 本サブで唯一そうなる箇所である(指示書 §0.2)。だから揃えない。
					//   ★見た目の非対称に引きずられて「揃え忘れ」と読まないこと。
					add(ColTags, "VAL-T02", SeverityWarning,
						fmt.Sprintf("tag[%d] name is empty", i))
				}
			}
		}
	}

	// recipe: セル内 JSON 配列 [{move_code, modifiers}]。
	recipeParsed := true
	if s := cell(ColRecipe); s != "" {
		if err := json.Unmarshal([]byte(s), &c.Steps); err != nil {
			add(ColRecipe, "VAL-I05", SeverityError, "recipe JSON: "+err.Error())
			c.Steps = nil
			recipeParsed = false
		}
	}
	if recipeParsed {
		// VAL-C09: 空レシピ。
		//
		// ★★M29-02 §2.2b: severity を WARNING → ERROR へ揃えた(開発者選択・2026-09-07)。
		//
		//   経緯 —— M24-13 / CHANGE-139 は「仮登録でもレシピは 1 ステップ以上を要する」
		//   と裁定したうえで、取込可否を変えないために本層の severity だけ WARNING に
		//   据え置いた。その結果「プレビューは警告どまり → 確定で ERROR」という
		//   非対称が残り、DES-006 §6 自身が「揃えるべきかは設計判断である」として
		//   後続へ送っていた(followup csv-preview-commit-severity-asymmetry)。
		//
		//   ★★揃えても取り込める行は 1 件も変わらない —— 0 ステップの行は、
		//   いまでも確定時に internal/service/validation が ERROR で落としている。
		//   変わるのは「プレビューが嘘をつかなくなる」ことだけである。
		//   ★DES-006 §2.1 の正典も ERROR であり、M24-13 の裁定の向きとも一致する。
		if len(c.Steps) == 0 {
			add(ColRecipe, "VAL-C09", SeverityError, "recipe is empty (0 steps)")
		}
		for i, st := range c.Steps {
			if st.MoveCode == "" && st.Modifiers.Type == "" {
				add(ColRecipe, "VAL-I05", SeverityWarning,
					fmt.Sprintf("step[%d]: empty move_code without modifiers.type", i))
			}
			// 技存在検証は Lookup 注入時のみ(VAL-I07)。WARNING(NULL 扱いで取り込み)。
			if st.MoveCode != "" && cfg.lookup != nil && !cfg.lookup.MoveExists(c.CharacterCode, st.MoveCode) {
				add(ColRecipe, "VAL-I07", SeverityWarning,
					fmt.Sprintf("step[%d]: unknown move_code %q for character %q", i, st.MoveCode, c.CharacterCode))
			}
		}
	}

	// ★★VAL-C15: 本登録の必須欄(M29-02 §2.2)。★現在は 2 欄である(M38-01 追補2)。
	//
	// ★着手前、本層にはこの検査そのものが無かった。⇒ 必須欄が空の本登録行は
	// プレビューで **課題が 1 件も出ず**、確定で ERROR が出ていた。
	// §2.2 の非対称の中で最も黙っていた 1 件である。
	//
	// ★取り込める行は変わらない —— 同じ行は確定側の
	// internal/service/validation.ValidateComboForCreate がすでに落としている。
	validateC15RequiredForPublished(&c, add)

	rr.Status, rr.Combo = finalize(rr.Issues, &c)
	return rr
}

// requiredPublishedCSVFields は本登録(is_draft=false)で必須になる欄。
//
// ★★正典は internal/service/validation の requiredPublishedFields である
// (M27-02b / CHANGE-153)。**片側だけ足すと、プレビューは通るのに確定で落ちる**
// (またはその逆)になる。⇒ 足すときは必ず両側を直す。
// ★列名は CSV の列(snake_case)で持つ。csvcore は CSV 契約の層であり、
// フロント DTO 名(camelCase)ではなく列名で場所を指すのが本層の作法である。
//
// ★★★【M38-01・射程 3】欄は 2 度動いた。**現在は 2 欄である**(2026-09-18 追補2)。
//
//	着手前:     damage / knockdown_advantage / drive_gauge_consumed / sa_gauge_consumed
//	追補1 まで: damage / knockdown_advantage / drive_available_at_start / sa_available_at_start
//	**現在:     damage / knockdown_advantage の 2 欄だけ**
//
// ★★開始残量 2 欄を必須から外したのは開発者裁定である(2026-09-18)。⇒ 同 2 欄の
// NULL は「不問」1 つの意味しか持たない。**CSV でも空セル = 不問**として通る。
// ⇒ 詳しい経緯は正典(validation/combo.go の requiredPublishedFields)に在る。
var requiredPublishedCSVFields = []struct {
	column  string
	present func(*Combo) bool
}{
	{ColDamage, func(c *Combo) bool { return c.Damage != nil }},
	{ColKnockdownAdvantage, func(c *Combo) bool { return c.KnockdownAdvantage != nil }},
}

// validateC15RequiredForPublished は本登録行の必須欄が埋まっているかを見る。
//
// ★★値域は見ない。空かどうかだけを見る(確定側と同じ)。範囲は VAL-C04/C05/C10/C13 の
// 持ち場であり、消費ゲージ 2 欄は DES-006 §2.5 が「範囲 VAL 非連動」と定めている。
// ⇒ 必須化を口実に範囲チェックを足さない。
//
// ★仮登録はスキップする(確定側と同じ)。仮登録は「うろ覚えや机上アイデア」の記録
// だからである(FR009 / FR305)。
func validateC15RequiredForPublished(c *Combo, add func(col, code string, sev Severity, msg string)) {
	if c.IsDraft {
		return
	}
	for _, f := range requiredPublishedCSVFields {
		if !f.present(c) {
			add(f.column, "VAL-C15", SeverityError,
				fmt.Sprintf("%s is required for published combos", f.column))
		}
	}
}

// finalize は Issues から行ステータスを確定する。
func finalize(issues []Issue, c *Combo) (Status, *Combo) {
	hasErr, hasWarn := false, false
	for _, is := range issues {
		if is.Severity == SeverityError {
			hasErr = true
		} else {
			hasWarn = true
		}
	}
	switch {
	case hasErr:
		return StatusError, nil
	case hasWarn:
		return StatusWarning, c
	default:
		return StatusOK, c
	}
}

func derefBool(p *bool) bool { return p != nil && *p }

// boolField は厳密 bool を解釈し、失敗時は ERROR を積んで false を返す。
func (cfg resolved) boolField(rr *RowResult, col string, cell func(string) string) bool {
	v, err := parseBool(cell(col))
	if err != nil {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: "VAL-I05", Severity: SeverityError, Message: err.Error()})
		return false
	}
	return v
}

// boolPtrField は nullable bool(空=NULL)を解釈し、失敗時は ERROR を積んで nil を返す。
func (cfg resolved) boolPtrField(rr *RowResult, col string, cell func(string) string) *bool {
	v, err := parseBoolPtr(cell(col))
	if err != nil {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: "VAL-I05", Severity: SeverityError, Message: err.Error()})
		return nil
	}
	return v
}

// intField は空=nil(NULL)、非空=厳密 *int を解釈する。型エラーは ERROR。範囲外は code/sev。
func (cfg resolved) intField(rr *RowResult, col string, cell func(string) string, rng *IntRange, code string, sev Severity) *int {
	s := cell(col)
	if s == "" {
		return nil
	}
	p, err := parseIntPtr(s)
	if err != nil {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: "VAL-I05", Severity: SeverityError, Message: err.Error()})
		return nil
	}
	if rng != nil && !rng.Contains(*p) {
		rr.Issues = append(rr.Issues, Issue{
			Column: col, Code: code, Severity: sev,
			Message: fmt.Sprintf("value %d out of range [%d, %d]", *p, rng.Min, rng.Max),
		})
	}
	return p
}

// floatField は空=nil(NULL)、非空=厳密 *float64 を解釈する。型エラーは ERROR。範囲外は code/sev。
func (cfg resolved) floatField(rr *RowResult, col string, cell func(string) string, rng *FloatRange, code string, sev Severity) *float64 {
	s := cell(col)
	if s == "" {
		return nil
	}
	p, err := parseFloatPtr(s)
	if err != nil {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: "VAL-I05", Severity: SeverityError, Message: err.Error()})
		return nil
	}
	if rng != nil && !rng.Contains(*p) {
		rr.Issues = append(rr.Issues, Issue{
			Column: col, Code: code, Severity: sev,
			Message: fmt.Sprintf("value %v out of range [%v, %v]", *p, rng.Min, rng.Max),
		})
	}
	return p
}

// enumField は空=許容(NULL)、非空かつ許可リスト外を未知値として指摘する。値は保持。
func (cfg resolved) enumField(rr *RowResult, col string, cell func(string) string, allowed map[string]bool) string {
	v := cell(col)
	if v == "" || allowed[v] {
		return v
	}
	sev := SeverityWarning
	if cfg.enumStrict {
		sev = SeverityError
	}
	rr.Issues = append(rr.Issues, Issue{
		Column: col, Code: "VAL-ENUM", Severity: sev,
		Message: fmt.Sprintf("unknown %s value %q", col, v),
	})
	return v
}

// ── セットプレイ CSV(M13-01・別ファイル)─────────────────────────────

// SetupRowResult はセットプレイ CSV 1データ行の取り込み結果。
type SetupRowResult struct {
	RowNumber int
	Status    Status
	Setup     *Setup
	Issues    []Issue
}

// SetupResult は ParseSetupsCSV の構造化結果。
type SetupResult struct {
	Setups       []Setup
	RowResults   []SetupRowResult
	Summary      Summary
	FileError    *Issue
	FileWarnings []Issue
}

// ParseSetupsCSV はセットプレイ CSV を解析・検証する(DB 書込なし)。
// 親コンボ紐付け(parent_combo_local_id 解決)は本体サービス層が行う。
func ParseSetupsCSV(csvText string, opts Options) (*SetupResult, error) {
	cfg := opts.resolve()
	res := &SetupResult{}

	if len(csvText) > cfg.maxBytes {
		fe := &Issue{Code: "VAL-I01", Severity: SeverityError,
			Message: fmt.Sprintf("input size %d bytes exceeds limit %d", len(csvText), cfg.maxBytes)}
		res.FileError = fe
		return res, errFromIssue(fe)
	}
	csvText = strings.TrimPrefix(csvText, "\ufeff")

	// VAL-I02: \u6587\u5b57\u30b3\u30fc\u30c9\u304c UTF-8 \u304b(\u30b3\u30f3\u30dc CSV \u3068\u5bfe\u79f0)\u3002
	if !utf8.ValidString(csvText) {
		fe := &Issue{Code: "VAL-I02", Severity: SeverityError, Message: "input is not valid UTF-8"}
		res.FileError = fe
		return res, errFromIssue(fe)
	}

	r := csv.NewReader(strings.NewReader(csvText))
	r.Comma = CSVComma
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err == io.EOF {
		return res, nil
	}
	if err != nil {
		fe := &Issue{Code: "VAL-I04", Severity: SeverityError, Message: "malformed header row: " + err.Error()}
		res.FileError = fe
		return res, errFromIssue(fe)
	}
	idx, fe := buildHeaderIndex(header, SetupCSVColumns)
	if fe != nil {
		res.FileError = fe
		return res, errFromIssue(fe)
	}
	if extras := unknownColumns(header, SetupCSVColumns); len(extras) > 0 {
		res.FileWarnings = append(res.FileWarnings, Issue{
			Code: "VAL-I04", Severity: SeverityWarning,
			Message: "ignored unknown column(s): " + strings.Join(extras, ", "),
		})
	}
	get := func(row []string, col string) string {
		if i, ok := idx[col]; ok && i < len(row) {
			return row[i]
		}
		return ""
	}

	rowNum := 0
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if rowNum > cfg.maxRows {
			fe := &Issue{Code: "VAL-I03", Severity: SeverityError,
				Message: fmt.Sprintf("row count exceeds limit %d", cfg.maxRows)}
			res.FileError = fe
			return res, errFromIssue(fe)
		}
		if err != nil {
			res.RowResults = append(res.RowResults, SetupRowResult{
				RowNumber: rowNum, Status: StatusError,
				Issues: []Issue{{Code: "VAL-I05", Severity: SeverityError, Message: "malformed CSV row: " + err.Error()}},
			})
			continue
		}
		res.RowResults = append(res.RowResults, cfg.decodeSetupRow(rowNum, rec, get))
	}

	res.Summary.Total = len(res.RowResults)
	for i := range res.RowResults {
		rr := &res.RowResults[i]
		switch rr.Status {
		case StatusError:
			res.Summary.Error++
		case StatusWarning:
			res.Summary.Warning++
		default:
			res.Summary.OK++
		}
		if rr.Setup != nil {
			res.Setups = append(res.Setups, *rr.Setup)
		}
	}
	return res, nil
}

func (cfg resolved) decodeSetupRow(rowNum int, rec []string, get func([]string, string) string) SetupRowResult {
	rr := SetupRowResult{RowNumber: rowNum}
	cell := func(col string) string { return get(rec, col) }
	add := func(col, code string, sev Severity, msg string) {
		rr.Issues = append(rr.Issues, Issue{Column: col, Code: code, Severity: sev, Message: msg})
	}

	for _, col := range SetupCSVColumns {
		if v := cell(col); len(v) > cfg.maxCellBytes {
			add(col, "VAL-I01", SeverityError,
				fmt.Sprintf("cell size %d bytes exceeds limit %d", len(v), cfg.maxCellBytes))
		}
	}

	var s Setup
	s.ParentComboLocalID = cell(ColSetupParentComboLocalID)
	if s.ParentComboLocalID == "" {
		add(ColSetupParentComboLocalID, "VAL-I05", SeverityError, "parent_combo_local_id is required")
	}
	// 自由文(VAL-I10 ' 剥がし)。
	s.Name = desanitizeFreeText(cell(ColSetupName))
	s.Description = desanitizeFreeText(cell(ColSetupDescription))
	// VAL-S06: セットプレイ名は必須。
	//
	// ★★M29-02 §2.2: VAL-C09 と同型の非対称だったため同じ向きへ揃えた。
	//   着手前は「プレビューでは WARNING(commit 時に本体が ERROR で弾く)」であり、
	//   利用者から見ると「取り込めます」と言われた行が確定で落ちていた。
	//   ★取り込める行は変わらない(確定側の internal/service/setup が同じ行を
	//   すでに ERROR で落としている)。プレビューが嘘をつかなくなるだけである。
	if s.Name == "" {
		add(ColSetupName, "VAL-S06", SeverityError, "setup name is empty")
	}

	recipeParsed := true
	if str := cell(ColSetupRecipe); str != "" {
		if err := json.Unmarshal([]byte(str), &s.Steps); err != nil {
			add(ColSetupRecipe, "VAL-I05", SeverityError, "recipe JSON: "+err.Error())
			s.Steps = nil
			recipeParsed = false
		}
	}

	// ★★VAL-S02: セットプレイのレシピが空(0 ステップ)でないか。
	//
	// ★M29-02 のレビュー指摘(高-2)。VAL-C09 の完全な双子であり、向きも同じ
	// 「プレビューで通ったものが確定で落ちる」である —— 確定側の
	// internal/service/setup/validate.go は VAL-S02 を ERROR で落とすのに、
	// 本層には検査そのものが無かった。
	//
	// ★★初回の是正が VAL-S06 だけを見て VAL-S02 を見落としたのは、
	// 「非対称を 1 件ずつ潰した」ためである。⇒ 確定側の検証器が持つ VAL を
	// 列挙して突き合わせる、という数え方をしていれば落ちなかった。
	//
	// ★取り込める行は変わらない(確定側がすでに同じ行を ERROR で落としている)。
	if recipeParsed && len(s.Steps) == 0 {
		add(ColSetupRecipe, "VAL-S02", SeverityError, "setup recipe is empty (0 steps)")
	}

	hasErr, hasWarn := false, false
	for _, is := range rr.Issues {
		if is.Severity == SeverityError {
			hasErr = true
		} else {
			hasWarn = true
		}
	}
	switch {
	case hasErr:
		rr.Status = StatusError
	case hasWarn:
		rr.Status = StatusWarning
		rr.Setup = &s
	default:
		rr.Status = StatusOK
		rr.Setup = &s
	}
	return rr
}
