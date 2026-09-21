package comboio

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group("/api")配下にコンボ CSV export/import ルートを登録する
// (M13-01、DES-002 §4.2 / §7.6)。
//
//   - GET  /export/csv          コンボ + セットプレイを zip(2 CSV)で返す(FR401)
//   - POST /import/csv/preview  コンボ CSV(+任意セットプレイ CSV / zip)を検証(dry-run)
//   - POST /import/csv          選択行を取り込み(FR405)
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/export/csv", h.Export)
	g.POST("/import/csv/preview", h.Preview)
	g.POST("/import/csv", h.Commit)
}
