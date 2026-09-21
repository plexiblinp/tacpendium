package validation

// Severity はバリデーション結果の重要度。
//
// DES-006 §1.2 の 2 種類のみ:
//   - SeverityError: 保存処理を中止する重大な問題
//   - SeverityWarning: 保存は許可するが UI で警告表示する軽微な不整合
type Severity string

const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
)

// ValidationIssue は 1 件のバリデーション結果を表す。
//
// Code は VAL-C01 等の安定識別子。Field はエラーが該当するフィールド名(任意)。
// Message は表示用メッセージ(日本語)。
//
// Details は「どれが問題なのか」を id 付きで返すための任意の付帯情報(M23-04 §4.3-3)。
// ★形は M23-02 の 409 setup_in_use が details.combos へ []ComboRef を返すのに揃えてある
// (D-417＝新しい見せ方を作らない)。nil のときは JSON へ出ない。
// ★既存の 400 validation_failed + details.validations の形は変わらない——本フィールドを
// 設定するのは復元 2 経路(M23-04)と登録 2 経路(M23-05・VAL-C14 / VAL-S07)の成功応答だけで
// あり、他経路では nil のまま omitempty で消える。
// ★★400 validation_failed の経路で Details を設定すると
// details.validations.issues[].details の 2 段入れ子になる(DES-002 §4.3 規則 3)。
// 現時点でそれを行っている経路は無い。
type ValidationIssue struct {
	Code     string         `json:"code"`
	Severity Severity       `json:"severity"`
	Field    string         `json:"field,omitempty"`
	Message  string         `json:"message"`
	Details  map[string]any `json:"details,omitempty"`
}

// ValidationResult は 1 回のバリデーション実行で得た全 Issue を保持する。
type ValidationResult struct {
	Issues []ValidationIssue `json:"issues"`
}

// Add は Issue を追加する。
func (r *ValidationResult) Add(issue ValidationIssue) {
	r.Issues = append(r.Issues, issue)
}

// AddError は Error severity の Issue を追加するショートカット。
func (r *ValidationResult) AddError(code, field, message string) {
	r.Add(ValidationIssue{
		Code:     code,
		Severity: SeverityError,
		Field:    field,
		Message:  message,
	})
}

// AddWarning は Warning severity の Issue を追加するショートカット。
func (r *ValidationResult) AddWarning(code, field, message string) {
	r.Add(ValidationIssue{
		Code:     code,
		Severity: SeverityWarning,
		Field:    field,
		Message:  message,
	})
}

// AddWarningWithDetails は Details 付きの Warning severity の Issue を追加する(M23-04 §4.3-3)。
func (r *ValidationResult) AddWarningWithDetails(code, field, message string, details map[string]any) {
	r.Add(ValidationIssue{
		Code:     code,
		Severity: SeverityWarning,
		Field:    field,
		Message:  message,
		Details:  details,
	})
}

// HasError は Error が 1 件でもあれば true を返す。
// API ハンドラはこの戻り値で 400 / 201 を分岐する。
func (r *ValidationResult) HasError() bool {
	for _, i := range r.Issues {
		if i.Severity == SeverityError {
			return true
		}
	}
	return false
}

// HasWarning は Warning が 1 件でもあれば true を返す。
func (r *ValidationResult) HasWarning() bool {
	for _, i := range r.Issues {
		if i.Severity == SeverityWarning {
			return true
		}
	}
	return false
}

// Errors は Error severity の Issue だけを返す。
func (r *ValidationResult) Errors() []ValidationIssue {
	return r.filter(SeverityError)
}

// Warnings は Warning severity の Issue だけを返す。
func (r *ValidationResult) Warnings() []ValidationIssue {
	return r.filter(SeverityWarning)
}

func (r *ValidationResult) filter(s Severity) []ValidationIssue {
	out := make([]ValidationIssue, 0, len(r.Issues))
	for _, i := range r.Issues {
		if i.Severity == s {
			out = append(out, i)
		}
	}
	return out
}
