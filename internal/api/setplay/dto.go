package setplay

import setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"

// SuggestionStepDTO は提案 1 ステップの API 表現。
type SuggestionStepDTO struct {
	MoveID  int64  `json:"moveId"`
	Code    string `json:"code"`
	Role    string `json:"role"` // "filler" | "target" | "parent"(表記用親・M19-05 で出力開始)
	Counted bool   `json:"counted"`
}

// SuggestionDTO は提案 1 件の API 表現(指示書 §4.4)。
// mode / g は M19-02 の追加(後方互換)。既存フィールドの型・意味は不変。
type SuggestionDTO struct {
	Steps          []SuggestionStepDTO `json:"steps"`
	S              int                 `json:"s"`              // 第 1 active の絶対フレーム
	N              int                 `json:"n"`              // 起き上がりに重なる持続フレーム番号(gap では ≥2＝第1activeが起き上がり前)
	Landing        int                 `json:"landing"`        // = KA + 1
	TargetActive   int                 `json:"targetActive"`   //
	AlreadyAdopted bool                `json:"alreadyAdopted"` // 既存 setups とのレシピ一致(VAL-S04 基準)
	Mode           string              `json:"mode"`           // "meaty" | "gap"(§4.4・追加)
	G              int                 `json:"g"`              // gap のとき = 1 − n(隙間フレーム)。meaty では 0(追加)
}

// SuggestionsResponse は提案エンドポイントのレスポンス。
// totalFound / reason は M19-02 の追加(後方互換)。
type SuggestionsResponse struct {
	Items      []SuggestionDTO `json:"items"`
	Truncated  bool            `json:"truncated"`        // 安全上限到達(数え切れていない)ときのみ true(§4.3)
	TotalFound int             `json:"totalFound"`       // ランキング対象の総解数(limit で切る前・追加)
	Reason     string          `json:"reason,omitempty"` // 提案 0 件の理由コード(負 KA 等・追加)
}

// toResponse はサービス結果を API レスポンス DTO へ変換する。
func toResponse(res *setplaysvc.SuggestResult) SuggestionsResponse {
	items := make([]SuggestionDTO, len(res.Proposals))
	for i, p := range res.Proposals {
		steps := make([]SuggestionStepDTO, len(p.Steps))
		for j, st := range p.Steps {
			steps[j] = SuggestionStepDTO{
				MoveID:  st.MoveID,
				Code:    st.Code,
				Role:    st.Role,
				Counted: st.Counted,
			}
		}
		items[i] = SuggestionDTO{
			Steps:          steps,
			S:              p.S,
			N:              p.N,
			Landing:        p.Landing,
			TargetActive:   p.TargetActive,
			AlreadyAdopted: p.AlreadyAdopted,
			Mode:           p.Mode,
			G:              p.G,
		}
	}
	return SuggestionsResponse{
		Items:      items,
		Truncated:  res.Truncated,
		TotalFound: res.TotalFound,
		Reason:     res.Reason,
	}
}
