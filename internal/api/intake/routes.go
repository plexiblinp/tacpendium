package intake

import "github.com/labstack/echo/v4"

// RegisterRoutes は「他から引っ越し」API のルートを Echo グループに登録する。
//   - POST /api/intake/resolve : 候補トークン列 → move_code の厳密照合(未解決は未解決のまま返す)
//   - POST /api/intake/csv     : 解決済みコンボ群 → 取込 CSV(既存 import 動線へ乗せる)
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.POST("/intake/resolve", h.Resolve)
	g.POST("/intake/csv", h.BuildCSV)
}
