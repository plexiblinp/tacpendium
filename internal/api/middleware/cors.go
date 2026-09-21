package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// CORS は起動時に確定した固定の許可 Origin リストに基づくミドルウェアを返す。
//
// SUPP-001 §2.6.1 厳守:
//   - 許可リストは起動時に一度だけ構築し、リクエスト時に NIC を再列挙したり
//     Origin を動的判定したりしない
//   - ワイルドカード "*" は使わない(空リストは全拒否を意味する)
//   - Origin は完全一致(プロトコル+ホスト+ポート)で比較する
//
// プリフライト(OPTIONS)に対しては 204 No Content を返し、許可ヘッダ・許可メソッドを応答する。
func CORS(allowedOrigins []string) echo.MiddlewareFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}

	const (
		allowedMethods = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
		// allowedHeaders は「送ってもよいヘッダ」の一覧であって、要求ではない。
		//
		// ★X-Requested-With を検証するコードは無い(CHANGE-116・案 A で補助対策は
		// 撤回された)。ここに残っているのは許可であり、外しても得るものが無いため
		// 残してある。「独自ヘッダを要求している」と読まないこと。
		allowedHeaders = "Content-Type, Origin, Accept, X-Requested-With"
		maxAge         = "600"
	)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			res := c.Response()
			origin := req.Header.Get(echo.HeaderOrigin)

			if origin != "" {
				if _, ok := allowed[origin]; ok {
					res.Header().Set(echo.HeaderAccessControlAllowOrigin, origin)
					res.Header().Set(echo.HeaderVary, echo.HeaderOrigin)
					res.Header().Set(echo.HeaderAccessControlAllowCredentials, "true")
				}
				// 許可外 Origin は CORS ヘッダを付けず、ブラウザ側で拒否される。
			}

			if req.Method == http.MethodOptions {
				if origin != "" {
					if _, ok := allowed[origin]; ok {
						res.Header().Set(echo.HeaderAccessControlAllowMethods, allowedMethods)
						reqHeaders := req.Header.Get(echo.HeaderAccessControlRequestHeaders)
						if strings.TrimSpace(reqHeaders) != "" {
							res.Header().Set(echo.HeaderAccessControlAllowHeaders, reqHeaders)
						} else {
							res.Header().Set(echo.HeaderAccessControlAllowHeaders, allowedHeaders)
						}
						res.Header().Set(echo.HeaderAccessControlMaxAge, maxAge)
					}
				}
				return c.NoContent(http.StatusNoContent)
			}

			return next(c)
		}
	}
}
