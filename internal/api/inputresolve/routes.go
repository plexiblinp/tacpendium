package inputresolve

import "github.com/labstack/echo/v4"

// RegisterRoutes は段階2 解決 API のルートを Echo グループに登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/characters/:characterId/command-index", h.CommandIndex)
	// ★M21-06 §4.6: 物理モーション入力用の索引の素通し。command-index とは別経路である
	//   （command-index の絞り込みを広げると仮想コントローラの一様フォールバックが変わる）。
	g.GET("/characters/:characterId/motion-commands", h.MotionCommands)
}
