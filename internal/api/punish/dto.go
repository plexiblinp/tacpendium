package punish

// リクエスト DTO(camelCase・POST/DELETE で共用。DELETE はキー項目のみ使用)。
//
// レスポンス(走査ツリー)はサービス層 punishfinder.Tree をそのまま JSON 返却する
// (規則を BE に一元化＝FE は引くだけ・DES-002 §4.2)。

// StarterVerdictRequest は POST/DELETE /api/combo-punish-starters の body。
type StarterVerdictRequest struct {
	SelfCharacterID int64   `json:"selfCharacterId"`
	OpponentMoveID  int64   `json:"opponentMoveId"`
	StarterMoveID   int64   `json:"starterMoveId"`
	Verdict         string  `json:"verdict"` // POST のみ使用(adopted|unreachable)
	Note            *string `json:"note"`    // POST のみ使用
}

// PunishRequest は POST/DELETE /api/combo-punishes の body。
type PunishRequest struct {
	ComboID        int64   `json:"comboId"`
	OpponentMoveID int64   `json:"opponentMoveId"`
	Note           *string `json:"note"` // POST のみ使用(採用理由)
}

// PruningRequest は POST/DELETE /api/combo-punish-prunings の body。
type PruningRequest struct {
	SelfCharacterID int64   `json:"selfCharacterId"`
	OpponentMoveID  int64   `json:"opponentMoveId"`
	Note            *string `json:"note"` // POST のみ使用
}

// CurationRequest は POST/DELETE /api/combo-punish-curations の body(M18-03a)。
// 粒度はコンボ × 相手技(pruning の自キャラ × 相手技とは別軸)。
type CurationRequest struct {
	ComboID        int64   `json:"comboId"`
	OpponentMoveID int64   `json:"opponentMoveId"`
	Note           *string `json:"note"` // POST のみ使用(隠す理由)
}
