// Package comboio はコンボ/セットプレイの CSV エクスポート(FR401)・インポート(FR405)の
// サービス層を提供する。シリアライズ/検証コアは csvcore に委ね、本層は本体ドメイン
// (combo/setup/tag/character/move)との接続(code→id 解決・starter 導出・重複判定・
// タグ解決・セットプレイ親解決・行単位 commit)を担う。
package comboio

const (
	// gameCodeSF6 は対象ゲーム code(本アプリはフェーズ3 時点で SF6 単一)。
	gameCodeSF6 = "sf6"

	// zip 内のファイル名。
	comboCSVName = "combos.csv"
	setupCSVName = "setups.csv"
)

// ExportRangeKind は export 対象範囲(DES-005 §5.13)。
type ExportRangeKind string

const (
	RangeAll      ExportRangeKind = "all"      // 全コンボ
	RangeFilter   ExportRangeKind = "filter"   // フィルタ中
	RangeSelected ExportRangeKind = "selected" // 選択中
	RangeMyCombo  ExportRangeKind = "mycombo"  // マイコンボ(タグ絞り込み)
)

// ExportQuery は ExportCSV の対象指定。
type ExportQuery struct {
	Range ExportRangeKind
	// Filter は Range=filter/mycombo 時の絞り込み(CharacterID / TagIDs / Position 等)。
	CharacterID    *int64
	TagIDs         []int64
	Position       *string
	HitType        *string
	OpponentStance *string
	IsDraft        *bool
	// SelectedIDs は Range=selected 時の対象コンボ ID 列。
	SelectedIDs []int64
	// UserID は「誰として出力するか」。載るタグをこの利用者のものへ絞る
	// (M22-02 §4.5-9・§4.5-16)。★同じコンボでも出力する利用者によって
	// 載るタグが変わる。これは D-402 の帰結であって欠陥ではない
	// ——タグは各人が貼る付箋である。
	UserID int64
}

// ExportResult は ExportCSV の結果。zip 本体に加えて「黙って落ちたもの」の観測を持つ。
//
// ★★観測を戻り値に持たせる理由(M29-02 §2.1) —— 以前は上限に当たったことを
// slog.WarnContext でサーバ側ログへ書くだけだった。ログは利用者の画面にも応答にも
// 出ないため、利用者は一部だけのファイルを完全なものと信じてしまう。
// これは FR307(破綻の自動断定をしない)の逆向き = 「成功の自動断定」である。
// ⇒ 呼び出し元が利用者へ伝えられる形にする。
type ExportResult struct {
	// Data は zip 本体(combos.csv + setups.csv)。
	Data []byte
	// TotalCombos は対象範囲に一致するコンボの総数(上限を掛けない数)。
	TotalCombos int
	// IncludedCombos は実際に zip へ載ったコンボ件数。
	IncludedCombos int
	// SetupRows は zip へ載ったセットプレイ行数。
	SetupRows int
	// SetupRowsOverLimit は、載ったセットプレイ行数が取込側の行数上限を超えているか。
	//
	// ★★書出には行数上限が無いのに取込は上限で弾く、という非対称の観測である。
	// ⇒ true のとき、この zip は「自分が出したのに自分の取込が拒否する」ファイルになる。
	SetupRowsOverLimit bool
	// BytesOverLimit は、いずれかの CSV が取込側のバイト上限を超えているか(同上の非対称)。
	BytesOverLimit bool
}

// Truncated は上限で切り捨てが起きたか。
//
// ★「>= 上限」で判定しない —— ちょうど上限ぴったりのときは 1 件も落ちていないのに
// 「切り捨てた」と言ってしまう(着手前の export.go:29 がその形だった)。
// 総数と実際に載った件数を比べるのが唯一の正しい判定である。
func (r *ExportResult) Truncated() bool {
	return r.TotalCombos > r.IncludedCombos
}

// ReimportBlocked は、この出力を取込に掛けると上限で弾かれるか。
func (r *ExportResult) ReimportBlocked() bool {
	return r.SetupRowsOverLimit || r.BytesOverLimit
}

// DupAction は import commit 時の重複動作(M17-05a: skip / setups_only)。
// 「新規追加(add)」は dup キー同一のまま挿入して必ず再衝突する死選択肢のため廃止した(B-6)。
// 「上書き(overwrite)」は M13-i として繰延(CHANGE-051)。将来ここに要素を足すだけで済む。
type DupAction string

const (
	DupSkip DupAction = "skip" // 重複コンボをスキップ(既定)
	// DupSetupsOnly は重複コンボ本体は skip しつつ、その配下セットプレイを
	// 重複相手の既存コンボへ親解決して取り込む(B-6・同一コンボへセットプレイだけ追加する動線)。
	DupSetupsOnly DupAction = "setups_only"
)

// ── プレビュー DTO(サービス層・camelCase 変換は handler）─────────────────

// ComboPreviewRow はコンボ CSV 1 行のプレビュー結果。
type ComboPreviewRow struct {
	RowNumber        int
	LocalID          string
	CharacterCode    string
	StarterMoveCode  string // レシピ先頭から導出(空=非技始動/レシピ空)
	IsDraft          bool
	StepCount        int
	Duplicate        bool   // VAL-C02 既存重複あり
	DuplicateComboID *int64 // 重複先(あれば)
	Warnings         []string
	Errors           []string
	Importable       bool // ERROR なし(取り込み候補)
}

// SetupPreviewRow はセットプレイ CSV 1 行のプレビュー結果。
type SetupPreviewRow struct {
	RowNumber          int
	ParentComboLocalID string
	Name               string
	StepCount          int
	ParentResolvable   bool // 親が同一バッチ local_id か既存コンボ ID として解決可能
	Warnings           []string
	Errors             []string
	Importable         bool
}

// PreviewResult は preview の全体結果。
type PreviewResult struct {
	Combos         []ComboPreviewRow
	Setups         []SetupPreviewRow
	ComboFileError string // 非空でコンボ CSV 全体拒否(VAL-I01〜I04)
	SetupFileError string // 非空でセットプレイ CSV 全体拒否
	Summary        PreviewSummary
}

// PreviewSummary は件数サマリ(VAL-I09)。
type PreviewSummary struct {
	ComboTotal   int
	ComboOK      int
	ComboWarning int
	ComboError   int
	SetupTotal   int
}

// ── commit DTO ───────────────────────────────────────────────────────

// CommitResult は commit の行単位レポート。
type CommitResult struct {
	Rows    []CommitRowResult
	Summary CommitSummary
}

// CommitRowResult は 1 行(コンボ or セットプレイ)の取り込み結果。
type CommitRowResult struct {
	Kind      string // "combo" / "setup"
	RowNumber int
	LocalID   string // コンボの local_id(セットプレイは親 local_id)
	Status    string // "created" / "skipped" / "failed"
	Reason    string
	ComboID   *int64 // 作成されたコンボ ID(あれば)
}

// CommitSummary は commit 件数サマリ。
type CommitSummary struct {
	Success int
	Skipped int
	Failed  int
}
