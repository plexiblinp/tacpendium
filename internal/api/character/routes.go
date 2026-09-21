package character

import "github.com/labstack/echo/v4"

// RegisterRoutes はキャラクター API のルートを Echo グループに登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/games/:gameId/characters", h.List)
}
