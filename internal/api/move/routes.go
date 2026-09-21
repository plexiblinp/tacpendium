package move

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group(通常 "/api")配下に技マスタのルートを登録する。
//
// 登録されるルート:
//   - GET    /moves?character_id=N        指定キャラクターの全技一覧(M1-06、契約不変)
//   - GET    /moves/:id                    技 1 件のフル項目取得(M9-03、編集グリッド用)
//   - PATCH  /moves/:id                    技フィールドの部分更新(M9-03、FR703)
//   - POST   /moves/:id/rush-variant       ラッシュ版 move の派生生成(M9-03、FR703)
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/moves", h.List)
	g.GET("/moves/:id", h.Get)
	g.PATCH("/moves/:id", h.Update)
	g.POST("/moves/:id/rush-variant", h.GenerateRushVariant)
}
