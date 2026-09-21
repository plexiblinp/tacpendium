package config

import "github.com/labstack/echo/v4"

// RegisterRoutes は Echo の /api グループに設定 API のルートを登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/config", h.Get)
	g.PUT("/config", h.Update)
}
