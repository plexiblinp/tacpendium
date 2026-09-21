package notice

import "github.com/labstack/echo/v4"

// RegisterRoutes は告知 API のルートを登録する。
//
// ★/api グループ配下に置く。素通しの GET /api/health には載せない。
// ★★ただし「保護されている」とは言えない —— mw.Auth は password_enabled = false の
// とき素通しであり、それが既定である。露出の条件と、それでも絶対パスを載せる理由は
// handler.go の Response の注記にある。
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/notices/data-migration", h.Get)
	g.POST("/notices/data-migration/ack", h.Ack)
}

// RegisterGameUpdateRoutes はゲーム更新の告知 API のルートを登録する
// (FR702・M28-02c / CHANGE-162 §2)。
//
// ★★GET は常に 200 である。204 の作法から意図して外れている —— 返すのは
// 「有無」ではなく件数と現在版であり、204 では表現できない(game_update.go の注記)。
// ★POST は要求本文を取らない。サーバが games.current_data_version を読んで書く。
func RegisterGameUpdateRoutes(g *echo.Group, h *GameUpdateHandler) {
	g.GET("/notices/game-update", h.Get)
	g.POST("/notices/game-update/postpone", h.Postpone)
}
