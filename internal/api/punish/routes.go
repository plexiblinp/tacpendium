package punish

import "github.com/labstack/echo/v4"

// RegisterRoutes は確定反撃サーチ(M18-02)とマイリスト(M18-03a)の API ルートを
// Echo グループに登録する(DES-002 §4.2)。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/punish-finder", h.PunishFinder)
	// マイリストは隠したもの一覧まで 1 本で返す(別 GET を立てない＝FE が 2 系統を混ぜない)。
	g.GET("/punish-list", h.PunishList)

	g.POST("/combo-punish-starters", h.CreateStarter)
	g.DELETE("/combo-punish-starters", h.DeleteStarter)

	g.POST("/combo-punishes", h.CreatePunish)
	g.DELETE("/combo-punishes", h.DeletePunish)

	g.POST("/combo-punish-prunings", h.CreatePruning)
	g.DELETE("/combo-punish-prunings", h.DeletePruning)

	g.POST("/combo-punish-curations", h.CreateCuration)
	g.DELETE("/combo-punish-curations", h.DeleteCuration)
}
