package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	authapi "github.com/plexiblinp/tacpendium/internal/api/auth"
	"github.com/plexiblinp/tacpendium/internal/model"
)

// apiPrefix は保護対象の判定に使う接頭辞。これで始まらないパスは保護しない。
const apiPrefix = "/api/"

// healthPath はヘルスチェック。保護対象から外す。
const healthPath = "/api/health"

// SessionValidator はセッションの検証と入場ゲートの有効判定を提供する
// (internal/service/auth.Service が実装)。
type SessionValidator interface {
	// Enabled は入場ゲートが実際に効いているかを返す。
	Enabled() bool
	// Validate はセッション ID が有効かを返す。
	Validate(sessionID string) bool
}

// unprotectedPaths は認証を要求しない /api 配下のパス(M22-01 §4.5-2)。
//
// ★除外し忘れるとログインすらできなくなるため、一覧を 1 か所に集めて
// 各エントリに理由を持たせる。個別の理由は internal/api/auth/routes.go にある。
var unprotectedPaths = map[string]struct{}{
	healthPath:           {},
	authapi.PathLogin:    {},
	authapi.PathLogout:   {},
	authapi.PathStatus:   {},
	authapi.PathPassword: {},
}

// Auth は簡易パスワードによる入場ゲートのミドルウェアを返す(M22-01 §4.5)。
//
// ★password_enabled = false のときは何も要求せず、Cookie もヘッダも足さずに
// 次のハンドラを呼ぶだけである。既定は OFF であり、いまの全利用者は OFF のまま
// 使い続けるため、OFF のときに挙動が変わらないことが本ミドルウェアの第一の要件である。
//
// ★登録位置は CORS の後ろであること。CORS は OPTIONS を 204 で早期に返して
// next を呼ばないため、後ろに置けばプリフライトが 401 にならない。
//
// ★e.Use によるグローバル登録であること。Echo の Group.Use は /api と /api/* へ
// NotFoundHandler を副作用で登録するため、経路表が変わってしまう(OFF でも変わる)。
func Auth(validator SessionValidator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// ★経路の判定を先に行う。isProtected は文字列比較だけで済むのに対し、
			// Enabled() は設定サービスの mutex を取る。順序を逆にすると、
			// 静的アセット 1 枚ごとに共有ロックを通ることになる——そのロックは
			// PUT /api/config がプリセット再計算の間ずっと保持するため、
			// password_enabled = false でも全リクエストが待たされうる(§4.9-4 の遅延面)。
			if !isProtected(c.Request().URL.Path) {
				return next(c)
			}
			if !validator.Enabled() {
				return next(c)
			}

			cookie, err := c.Cookie(authapi.SessionCookieName)
			if err != nil || !validator.Validate(cookie.Value) {
				return c.JSON(http.StatusUnauthorized, model.APIErrorResponse{
					Error: model.APIError{
						Code:    "unauthorized",
						Message: "authentication required",
					},
				})
			}
			return next(c)
		}
	}
}

// isProtected はパスが認証を要求する対象かを返す。
//
// 保護するのは /api/ 配下のうち unprotectedPaths に無いものだけ。静的配信
// (SPA シェル・アセット)は保護しない——シェルが読めないとログイン画面を出せない。
func isProtected(path string) bool {
	if !strings.HasPrefix(path, apiPrefix) {
		return false
	}
	_, unprotected := unprotectedPaths[path]
	return !unprotected
}
