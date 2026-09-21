package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
)

// HeaderRequestID はリクエスト ID の HTTP ヘッダ名。
const HeaderRequestID = "X-Request-ID"

// requestIDContextKey は echo.Context に request_id を保存するキー。
const requestIDContextKey = "request_id"

// RequestID は受信リクエストごとに request_id を採番し、ヘッダ・コンテキストに付与する。
//
// クライアントが X-Request-ID を送ってきた場合は再利用する。空ならランダム16byte hex を採番。
// google/uuid を依存に追加していないため crypto/rand 由来の hex 文字列で代用する(M1-01 範囲)。
func RequestID() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()
			id := req.Header.Get(HeaderRequestID)
			if id == "" {
				id = newRequestID()
			}
			c.Set(requestIDContextKey, id)
			c.Response().Header().Set(HeaderRequestID, id)
			return next(c)
		}
	}
}

// Logger はアクセスログを slog.Default() に出力するミドルウェアを返す。
//
// 出力項目: method、path、status、bytes、latency_ms、remote_ip、request_id、user_agent。
// SUPP-001 §5.6 のログ戦略に沿う(センシティブ情報は出力しない)。
func Logger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			latency := time.Since(start)
			req := c.Request()
			res := c.Response()

			rid, _ := c.Get(requestIDContextKey).(string)

			level := slog.LevelInfo
			if res.Status >= 500 {
				level = slog.LevelError
			} else if res.Status >= 400 {
				level = slog.LevelWarn
			}

			attrs := []slog.Attr{
				slog.String("method", req.Method),
				slog.String("path", req.URL.Path),
				slog.Int("status", res.Status),
				slog.Int64("bytes", res.Size),
				slog.Int64("latency_ms", latency.Milliseconds()),
				slog.String("remote_ip", c.RealIP()),
				slog.String("request_id", rid),
				slog.String("user_agent", req.UserAgent()),
			}
			if err != nil {
				attrs = append(attrs, slog.String("error", err.Error()))
			}
			slog.LogAttrs(req.Context(), level, "http.request", attrs...)
			return err
		}
	}
}

// RequestIDFromContext は echo.Context に格納された request_id を取得する。
func RequestIDFromContext(c echo.Context) string {
	if v, ok := c.Get(requestIDContextKey).(string); ok {
		return v
	}
	return ""
}

func newRequestID() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// 取得失敗時は時刻ベースのフォールバックでも十分(衝突リスクは無視)。
		return time.Now().UTC().Format("20060102T150405.000000000")
	}
	return hex.EncodeToString(buf[:])
}
