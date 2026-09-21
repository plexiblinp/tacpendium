package setplay

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group(通常 "/api")配下にセットプレイ提案ルートを登録する。
// 既存の FR011 候補 API(setup ドメイン)とは別系統。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/combos/:comboId/setplay-suggestions", h.GetSuggestions)
}
