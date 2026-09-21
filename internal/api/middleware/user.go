package middleware

import (
	"context"
	"strconv"

	"github.com/labstack/echo/v4"
)

// UserIDHeader は「誰として操作するか」を運ぶリクエストヘッダ。
//
// ★これは認証ではない(DES-002 §8)。入場の可否は簡易パスワードが決め、
// 本ヘッダはタグ・プリセットのスコープと「誰の編集か」の札にすぎない
// (FR013 / FR501＝誤上書きの防止)。詐称は防げないし、防ぐ設計にもしていない。
const UserIDHeader = "X-User-Id"

// userIDContextKey は echo.Context へ格納するキー。
const userIDContextKey = "tacpendium_user_id"

// DefaultUserIDResolver はヘッダが無いときの既定値を解決する。
type DefaultUserIDResolver interface {
	DefaultUserID(ctx context.Context) (int64, error)
}

// UserContext は X-User-Id を解決して echo.Context へ載せる。
//
// ★ヘッダが無い・壊れている場合は既定値(users.id の最小値)へ倒す。
// 理由——ヘッダを送らない呼び出し元が実在する(既存の E2E・curl・利用者が
// 1 人で選択画面を出さない場合)。既定へ倒すことで、いままでの挙動と変わらない
// (既存環境の users は migrations/000009 が入れる id=1 の 1 行だけである)。
//
// ★解決に失敗しても要求は止めない。ここで 500 にすると、利用者の面と無関係な
// 全 API が巻き添えで落ちる。値が引けなければ 0 のまま下流へ渡し、
// 下流は FK 制約で弾かれる。
func UserContext(resolver DefaultUserIDResolver) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set(userIDContextKey, resolveUserID(c, resolver))
			return next(c)
		}
	}
}

func resolveUserID(c echo.Context, resolver DefaultUserIDResolver) int64 {
	if raw := c.Request().Header.Get(UserIDHeader); raw != "" {
		if id, err := strconv.ParseInt(raw, 10, 64); err == nil && id > 0 {
			return id
		}
	}
	id, err := resolver.DefaultUserID(c.Request().Context())
	if err != nil {
		return 0
	}
	return id
}

// UserIDFrom は UserContext が載せた利用者 ID を取り出す。
//
// ★ハンドラはこれを使う。定数 1 を書かないこと(M22-02 で供給元を差し替えた)。
func UserIDFrom(c echo.Context) int64 {
	if v, ok := c.Get(userIDContextKey).(int64); ok {
		return v
	}
	return 0
}
