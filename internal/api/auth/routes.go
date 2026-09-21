package auth

import "github.com/labstack/echo/v4"

// 認証ミドルウェアの保護対象から外すパス(M22-01 §4.5-2)。
//
// ★中央の一覧はここではなく internal/api/middleware/auth.go にある。本定数は
// ルート定義と除外一覧が同じ文字列を指すことを保証するために公開している。
const (
	// PathLogin はログイン。★除外しないとログインできない。
	PathLogin = "/api/auth/login"
	// PathLogout はログアウト。冪等で情報を返さない。
	PathLogout = "/api/auth/logout"
	// PathStatus は状態問い合わせ。未認証の画面が「パスワードを求めるべきか」を
	// 知る唯一の経路であるため除外する。
	PathStatus = "/api/auth/status"
	// PathPassword はパスワードの設定・変更。
	//
	// ★除外するのは未設定からの初回設定を通すためである。設定済みの場合の保護は
	// ミドルウェアではなくハンドラ側で成立する——サービス層が現在のパスワードを
	// 要求するため、セッションを持たない相手はパスワードを変えられない。
	PathPassword = "/api/auth/password"
)

// RegisterRoutes は Echo の /api グループに認証 API のルートを登録する。
//
// ★本文サイズの上限(VAL-N07)は経路単位のミドルウェアとして付ける(M22-08 §4.2-2)。
// ★g.Use や e.Group("/api/auth") を使わないこと——Echo の Group.Use は /api と
// /api/* へ NotFoundHandler を副作用で登録するため経路表が変わる
// (internal/api/middleware/auth.go の注記に同じ実測がある)。経路単位なら変わらない。
// ★保護対象の経路の列(M22-08 §2.2-3 の凍結対象)は本変更で 1 件も動いていない。
func RegisterRoutes(g *echo.Group, h *Handler) {
	limit := BodyLimit(MaxBodyBytes)

	g.POST("/auth/login", h.Login, limit)
	g.POST("/auth/logout", h.Logout, limit)
	g.GET("/auth/status", h.Status, limit)
	g.POST("/auth/password", h.SetPassword, limit)
}
