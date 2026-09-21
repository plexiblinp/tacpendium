package setup

import "github.com/labstack/echo/v4"

// RegisterRoutes は echo.Group(通常 "/api")配下にセットプレイ CRUD ルートを登録する。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.POST("/combos/:comboId/setups", h.CreateSetup)
	// M23-09: 保存前の重複チェック。★登録経路(上行)の直下に置く——同じ親コンボ id を
	// 要し、コンボ側の POST /api/combos/check-duplicate と対称の位置である(§4.1-2)。
	g.POST("/combos/:comboId/setups/check-duplicate", h.CheckDuplicate)
	g.POST("/combos/:comboId/setup-links", h.CreateSetupLink)
	g.DELETE("/combos/:comboId/setup-links/:setupId", h.DeleteSetupLink)
	g.GET("/setups", h.ListSetups)
	g.GET("/setups/candidates", h.GetSetupCandidatesByCharacter)
	g.GET("/setups/:id", h.GetSetup)
	g.PATCH("/setups/:id", h.UpdateSetup)
	g.DELETE("/setups/:id", h.DeleteSetup)
	// M23-02: ゴミ箱(復元・完全削除)。コンボ側の 2 経路と同じ並び。
	g.POST("/setups/:id/restore", h.Restore)
	g.DELETE("/setups/:id/permanent", h.PermanentDelete)
	g.GET("/combos/:comboId/setup-candidates", h.GetSetupCandidates)
	// M19-03: セットプレイ成立条件(1 セル単位)。取得はコンボ詳細に同梱するため GET は無い。
	g.PUT("/combos/:comboId/setups/:setupId/results", h.UpsertSetupResult)
	g.DELETE("/combos/:comboId/setups/:setupId/results", h.DeleteSetupResult)
}
