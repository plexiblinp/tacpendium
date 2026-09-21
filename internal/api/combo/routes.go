package combo

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group(通常 "/api")配下にコンボ CRUD ルートを登録する。
//
// 登録される 13 ルート:
//   - POST   /combos                  コンボ作成(M1-03)
//   - POST   /combos/check-duplicate  重複検知(M2-02)
//   - GET    /combos                  一覧(M1-03)
//   - GET    /combos/:id              詳細(Steps 含む)(M1-03)
//   - GET    /combos/:id/deleted      ゴミ箱の行から開く読み取り専用詳細(M23-07 §4.2-2)
//   - PATCH  /combos/:id              メタデータ編集(M1-03)
//   - PUT    /combos/:id              キー変更編集(M1-03)
//   - DELETE /combos/:id              論理削除(M1-03)
//   - POST   /combos/:id/restore      ゴミ箱から復元(M1-03)
//   - DELETE /combos/:id/permanent    完全削除(M2-03)
//   - GET    /combos/:id/recipe       プリセット解決後のレシピ文字列(M1-04 §4.5.3、M1-05 で実装)
//   - POST   /combos/:id/materialize  確定反撃(パニッシュカウンター版)の生成(M18-03b)
//   - POST   /combos/:id/acknowledge-version  FR702 の「確認した」(M28-02a)。
//     ★画面のラベルは「問題なし」である(CHANGE-162 §6.1。経路名とずれることは承知のうえ)
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.POST("/combos", h.Create)
	g.POST("/combos/check-duplicate", h.CheckDuplicate)
	g.GET("/combos", h.List)
	g.GET("/combos/:id", h.Get)
	g.GET("/combos/:id/deleted", h.GetDeleted)
	g.PATCH("/combos/:id", h.UpdateMetadata)
	g.PUT("/combos/:id", h.UpdateWithKeyChange)
	g.DELETE("/combos/:id", h.Delete)
	g.POST("/combos/:id/restore", h.Restore)
	g.DELETE("/combos/:id/permanent", h.PermanentDelete)
	g.GET("/combos/:id/recipe", h.GetRecipe)
	g.POST("/combos/:id/materialize", h.Materialize)
	// FR702 の「確認した」(M28-02a)。基準を現在のデータバージョンへ進める。
	g.POST("/combos/:id/acknowledge-version", h.AcknowledgeGameVersion)
}
