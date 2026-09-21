// Package intake は「他から引っ越し」(既存フォーマットの取り込み)の ② 照合(候補トークン列 → move_code の厳密照合)を担う
// (M17-04)。二段の役割分担のうち、① 表記正規化(自由表記 → 候補トークン列)は本体外のアプリ外プロンプトが
// 行い、本パッケージはその出力(候補トークン列)を受けて move マスタへ決定論で厳密照合する。
//
// 死守事項(M17-04 §1.2):
//   - AI に move_code を生成・確定させない。確定は必ず本パッケージ(索引への厳密照合)で行う。
//   - 照合は決定論。曖昧一致・編集距離・「たぶんこれ」を実装しない。引けなければ未解決のまま返す。
//   - フォールバックしない(段階2 inputresolve は「通常技へ落とす」を持つが取込側は持たない=別の消費者)。
//   - エンジンを二度作らない(internal/moveindex の消費者拡張。LoadIndex 経由で索引 IF を引くだけ)。
package intake

// Step は照合前の 1 ステップ(① アプリ外プロンプトが出力した TSV の 1 行)。
type Step struct {
	ComboIndex    int    // 入力の何件目のコンボか(# 列)。1 始まり
	StepOrder     int    // そのコンボ内の何ステップ目か。1 始まり
	RawText       string // 元の表記(発信者のメモそのまま・verbatim。人が突き合わせる材料)
	Tokens        string // 候補トークン列(空白区切り。TOOL-002 §9.9 の 24 種)。"?" は不明
	NameCandidate string // 技名の候補(技一覧の技名)。"?" は不明
	Confidence    string // 確信度(高/中/低)。参考表示のみ・照合には使わない
	Note          string // 備考(AI の解釈メモ)
}

// ResolvedStep は照合結果を付与した 1 ステップ。
type ResolvedStep struct {
	Step
	// MoveCode は確定した move_code(未解決は "")。
	MoveCode string
	// Resolved は照合が確定したか。
	Resolved bool
	// ResolvedVia は確定手段("token"=トークン列照合 / "alias"=別名照合 / ""=未解決)。
	ResolvedVia string
	// Candidates は人レビュー用の候補 move_code 一覧。未解決時のヒント、および
	// 複数候補時の上書き候補として提示する。
	//
	// ★M20-07 で出どころが 3 系統になった(M17-04 はトークン索引だけだった)。
	//   (1) トークン列に対する索引の候補(moveindex.LookupAll・id 昇順)
	//   (2) 別名照合が複数件になったときの move_code(M17-04 では捨てていた)
	//   (3) 多候補ハッジ("A or B")を分割して引いた move_code
	// 順序は (1) → (2) → (3) の出現順で、重複は先勝ちで除く。
	//
	// ★空か否かに意味がある。空でない = 候補はあったが 1 件に決まらなかった、
	// 空 = そもそも 1 つも当たらなかった。この 2 つを同じ顔で出さない(E-84)。
	// フロントは web/src/features/intake/review.ts の unresolvedKind で判別する。
	Candidates []string
}

// ResolvedCombo は 1 コンボ分の照合結果(入力の # でまとめる)。
type ResolvedCombo struct {
	ComboIndex int
	Steps      []ResolvedStep
}

// ResolveResult は照合全体の結果。
type ResolveResult struct {
	CharacterCode string
	// MovesAvailable は当該キャラの索引が存在するか。未投入キャラ・キャラ不明は false
	// (この場合は全行未解決になるが、エラーにはしない=壊れない。M17-04 §3.3-5)。
	MovesAvailable bool
	Combos         []ResolvedCombo
	Summary        ResolveSummary
}

// ResolveSummary は件数サマリ。
type ResolveSummary struct {
	TotalSteps int
	Resolved   int
	Unresolved int
}

const (
	viaToken = "token"
	viaAlias = "alias"
	// unknownMark は AI が「不明」を示すトークン。照合対象にしない。
	unknownMark = "?"
)
