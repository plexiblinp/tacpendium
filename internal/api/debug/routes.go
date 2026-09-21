//go:build debug

package debug

import "github.com/labstack/echo/v4"

// RegisterRoutes はデバッグ専用エンドポイントを Echo グループに登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/debug/tables", h.ListTables)
	g.GET("/debug/dump/:table", h.DumpTable)
	// M28-02c: FR702 の状態を E2E から作るための書き込み口。
	// ★★マーカーを立てる経路は本番では DML マイグレしか無い。⇒ E2E からは
	//   「影響コンボが 1 件以上ある状態」を作れず、初回は必ず 0 件のままになる。
	// ★本番ビルドには存在しない(routes_noop.go が何も登録しない)。
	g.GET("/debug/game-version", h.GetCurrentDataVersion)
	g.POST("/debug/moves/:id/game-version", h.SetMoveGameVersion)
	g.POST("/debug/combos/:id/baseline-version", h.SetComboBaselineVersion)
	g.DELETE("/debug/notices/game-update", h.ClearGameUpdateNotice)
}
