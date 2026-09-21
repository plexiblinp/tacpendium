// Package intake は他から引っ越し(M17-04)の API ハンドラ層。
// ② 照合(候補トークン列 → move_code)の結果配信と、解決済みコンボの取込 CSV 生成を担う。
// ① 表記正規化(自由表記 → 候補トークン列)はアプリ外プロンプトの領分で、本体は実装しない。
package intake

// ── POST /api/intake/resolve ────────────────────────────────────────────────

// resolveRequest は照合リクエスト。characterCode で対象キャラを明示的に受ける(AI に推測させない)。
// text は ① プロンプトの出力(TSV)をそのまま貼り付けたもの。
type resolveRequest struct {
	CharacterCode string `json:"characterCode"`
	Text          string `json:"text"`
}

// resolveResponse は照合結果。人レビュー動線(FE)がそのまま提示できる形。
type resolveResponse struct {
	CharacterCode  string             `json:"characterCode"`
	MovesAvailable bool               `json:"movesAvailable"`
	Combos         []resolvedComboDTO `json:"combos"`
	Summary        resolveSummaryDTO  `json:"summary"`
}

type resolvedComboDTO struct {
	ComboIndex int               `json:"comboIndex"`
	Steps      []resolvedStepDTO `json:"steps"`
}

type resolvedStepDTO struct {
	StepOrder     int      `json:"stepOrder"`
	RawText       string   `json:"rawText"`
	Tokens        string   `json:"tokens"`
	NameCandidate string   `json:"nameCandidate"`
	Confidence    string   `json:"confidence"`
	Note          string   `json:"note"`
	MoveCode      string   `json:"moveCode"`
	Resolved      bool     `json:"resolved"`
	ResolvedVia   string   `json:"resolvedVia"`
	Candidates    []string `json:"candidates"`
}

type resolveSummaryDTO struct {
	TotalSteps int `json:"totalSteps"`
	Resolved   int `json:"resolved"`
	Unresolved int `json:"unresolved"`
}

// ── POST /api/intake/csv ────────────────────────────────────────────────────

// buildCSVRequest は解決済みコンボ群から取込 CSV(combos.csv)を生成するリクエスト。
// FE は人レビューで全ステップを解決した後にこれを送り、返った CSV を既存 import 動線へ乗せる。
type buildCSVRequest struct {
	CharacterCode string          `json:"characterCode"`
	Combos        []buildComboDTO `json:"combos"`
}

type buildComboDTO struct {
	Memo    string         `json:"memo"`
	IsDraft bool           `json:"isDraft"`
	Steps   []buildStepDTO `json:"steps"`
}

type buildStepDTO struct {
	MoveCode string `json:"moveCode"`
}

// buildCSVResponse は生成した combos.csv 本文。既存 import プレビューへそのまま食わせる。
type buildCSVResponse struct {
	CSVText string `json:"csvText"`
}
