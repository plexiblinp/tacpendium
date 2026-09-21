package csvcore

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

// Severity は1件の指摘の重大度。
type Severity int

const (
	// SeverityWarning は非ブロッキング(行は取り込み可)。DES-006 の WARNING に対応。
	SeverityWarning Severity = iota
	// SeverityError はブロッキング(該当行 NG)。DES-006 の ERROR に対応。
	SeverityError
)

func (s Severity) String() string {
	switch s {
	case SeverityError:
		return "ERROR"
	default:
		return "WARNING"
	}
}

// Status は1行の取り込み判定結果。
type Status int

const (
	StatusOK Status = iota
	StatusWarning
	StatusError
)

func (s Status) String() string {
	switch s {
	case StatusWarning:
		return "WARNING"
	case StatusError:
		return "ERROR"
	default:
		return "OK"
	}
}

// Issue は1件の検証指摘。
type Issue struct {
	Column   string
	Code     string
	Severity Severity
	Message  string
}

// RowResult はコンボ CSV 1データ行の取り込み結果。
type RowResult struct {
	RowNumber int
	Status    Status
	// Combo は復元したコンボ DTO。Status==Error のときは nil。
	Combo  *Combo
	Issues []Issue
}

// Summary は取り込み結果の件数サマリ(DES-006 VAL-I09)。
type Summary struct {
	Total   int
	OK      int
	Warning int
	Error   int
}

// Result は ParseAndValidate の構造化結果。DB へは書かずプレビューとして返す。
type Result struct {
	// Combos は取り込み候補(OK/Warning 行)の復元 DTO を入力順に並べたもの。
	Combos []Combo
	// RowResults は全データ行の結果(Error 行も含む)。
	RowResults []RowResult
	Summary    Summary
	// FileError は非 nil のときファイル全体が拒否されたことを表す。
	FileError *Issue
	// FileWarnings はファイル全体に関わる非致命の警告(例: 未知列の無視)。
	FileWarnings []Issue
}

// ParseAndValidate はコンボ CSV を解析・検証し、復元コンボ DTO と行ごとの結果を返す。
// 返り値の error はファイル全体を拒否する致命エラー(VAL-I01/I02/I03/I04)のときのみ
// 非 nil。行レベルのエラーは Result.RowResults に集約する(行は落とさず理由を返す)。
func ParseAndValidate(csvText string, opts Options) (*Result, error) {
	cfg := opts.resolve()
	res := &Result{}

	// VAL-I01: サイズ上限。
	if len(csvText) > cfg.maxBytes {
		return fileReject(res, "VAL-I01",
			fmt.Sprintf("input size %d bytes exceeds limit %d", len(csvText), cfg.maxBytes))
	}

	csvText = strings.TrimPrefix(csvText, "\ufeff") // BOM 除去

	// VAL-I02: 文字コードが UTF-8 か。
	if !utf8.ValidString(csvText) {
		return fileReject(res, "VAL-I02", "input is not valid UTF-8")
	}

	r := csv.NewReader(strings.NewReader(csvText))
	r.Comma = CSVComma
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err == io.EOF {
		return res, nil // 空入力 → 0 件
	}
	if err != nil {
		return fileReject(res, "VAL-I04", "malformed header row: "+err.Error())
	}

	// 必須列は requiredImportColumns(消費ゲージ列は任意列＝旧 CSV 後方互換、M16-02)。
	// 既知列判定(unknownColumns)は CSVColumns 全体を使う(消費列を "unknown" 扱いしない)。
	idx, fe := buildHeaderIndex(header, requiredImportColumns)
	if fe != nil {
		res.FileError = fe
		return res, errFromIssue(fe)
	}
	if extras := unknownColumns(header, CSVColumns); len(extras) > 0 {
		res.FileWarnings = append(res.FileWarnings, Issue{
			Code:     "VAL-I04",
			Severity: SeverityWarning,
			Message:  "ignored unknown column(s): " + strings.Join(extras, ", "),
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
			return fileReject(res, "VAL-I03",
				fmt.Sprintf("row count exceeds limit %d", cfg.maxRows))
		}
		if err != nil {
			res.RowResults = append(res.RowResults, RowResult{
				RowNumber: rowNum,
				Status:    StatusError,
				Issues: []Issue{{
					Code:     "VAL-I05",
					Severity: SeverityError,
					Message:  "malformed CSV row: " + err.Error(),
				}},
			})
			continue
		}
		rr := cfg.decodeRow(rowNum, rec, get)
		res.RowResults = append(res.RowResults, rr)
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
		if rr.Combo != nil {
			res.Combos = append(res.Combos, *rr.Combo)
		}
	}
	return res, nil
}

// buildHeaderIndex はヘッダ→列番号を作る。重複ヘッダと必須列の欠落を検出する(VAL-I04)。
func buildHeaderIndex(header, required []string) (map[string]int, *Issue) {
	idx := make(map[string]int, len(header))
	for i, h := range header {
		if _, dup := idx[h]; dup {
			return nil, &Issue{
				Column:   h,
				Code:     "VAL-I04",
				Severity: SeverityError,
				Message:  fmt.Sprintf("duplicate header column %q", h),
			}
		}
		idx[h] = i
	}
	for _, col := range required {
		if _, ok := idx[col]; !ok {
			return nil, &Issue{
				Column:   col,
				Code:     "VAL-I04",
				Severity: SeverityError,
				Message:  fmt.Sprintf("missing required column %q", col),
			}
		}
	}
	return idx, nil
}

func unknownColumns(header, known []string) []string {
	set := make(map[string]bool, len(known))
	for _, c := range known {
		set[c] = true
	}
	var extras []string
	for _, h := range header {
		if !set[h] {
			extras = append(extras, h)
		}
	}
	return extras
}

func fileReject(res *Result, code, msg string) (*Result, error) {
	fe := &Issue{Code: code, Severity: SeverityError, Message: msg}
	res.FileError = fe
	return res, errFromIssue(fe)
}

func errFromIssue(i *Issue) error {
	return fmt.Errorf("csvcore: %s: %s", i.Code, i.Message)
}
