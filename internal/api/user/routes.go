package user

import "github.com/labstack/echo/v4"

// RegisterRoutes は user API のルートを登録する。
//
// ★DELETE は提供しない。tags / presets が ON DELETE CASCADE で users を参照しており、
// 利用者を消すとその人のタグ・プリセットが一括で消える。
// ⇒ 消す手段は本サブでは作らない(M22-02 §9.2-4 の「軽い方を採る」判断)。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/users", h.List)
	g.POST("/users", h.Create)
	g.PATCH("/users/:id", h.Update)
}
