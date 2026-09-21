package preset

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group(通常 "/api")配下にプリセットのルートを登録する。
//
//   - GET    /presets              プリセット一覧(M1-04、契約不変)
//   - GET    /presets/:id          プリセット 1 件(M1-04、契約不変)
//   - GET    /presets/:id/aliases  エイリアス一覧(M20-04。編集画面用・character_id 必須)
//   - POST   /presets              カスタムプリセット作成=組み込みのコピー(M20-04)
//   - PUT    /presets/:id          名前とエイリアスの更新(M20-04。★組み込みは 403)
//   - DELETE /presets/:id          削除(M20-04。★組み込みは 403・子行を明示削除)
//   - POST   /presets/:id/recipe-cache/rebuild  recipe_cache の作り直し(M24-08。★組み込みでも 403 にしない)
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/presets", h.List)
	g.GET("/presets/:id", h.Get)
	g.GET("/presets/:id/aliases", h.ListAliases)
	g.POST("/presets", h.Create)
	g.PUT("/presets/:id", h.Update)
	g.DELETE("/presets/:id", h.Delete)
	g.POST("/presets/:id/recipe-cache/rebuild", h.RebuildRecipeCache)
}
