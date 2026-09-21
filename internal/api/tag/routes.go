package tag

import "github.com/labstack/echo/v4"

// RegisterRoutes はタグ API のルートを Echo グループに登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/tags", h.List)
	g.GET("/tags/:id", h.Get)
	g.POST("/tags", h.Create)
	g.PATCH("/tags/:id", h.Update)
	g.DELETE("/tags/:id", h.Delete)
}
