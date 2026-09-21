package auth

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// SessionCookieName はセッション ID を運ぶ Cookie の名前。
//
// ★認証ミドルウェアも同じ名前で読む。定数は本パッケージが正本。
const SessionCookieName = "tacpendium_session"

// newSessionCookie はセッション Cookie を組み立てる。
//
// ★Cookie の属性はこの 1 関数に集約する。発行(issueSession)と失効(clearSession)の
// 両方がここを通るため、属性を変えるときに片方だけ直す事故が起きない。
//
// 属性の理由:
//   - HttpOnly: JavaScript から読めなくする。
//   - SameSite=Strict: 外部サイト起点のリクエストで送られない
//     (DES-002 §4.4 が CSRF 第一対策として前提にしている形)。
//   - Path=/: SPA の静的配信と /api/* の両方へ送る。
//   - Secure: 付けない。本アプリの LAN 構成は平文 HTTP であり(DES-002 §3・契約 F-3)、
//     付けると Cookie が保存されず入場できなくなる。
func newSessionCookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   maxAge,
	}
}

// issueSession はセッション Cookie を応答へ載せる。
//
// MaxAge は指定しない(0)。★セッションタイムアウトを設けない決定(M22-01 §1.2-5)に
// 対応する——ブラウザを閉じるまで有効なセッション Cookie として扱われる。
func issueSession(c echo.Context, sessionID string) {
	c.SetCookie(newSessionCookie(sessionID, 0))
}

// clearSession はセッション Cookie を失効させる。
func clearSession(c echo.Context) {
	c.SetCookie(newSessionCookie("", -1))
}

// sessionIDFrom はリクエストの Cookie からセッション ID を取り出す。
// Cookie が無ければ空文字を返す。
func sessionIDFrom(c echo.Context) string {
	cookie, err := c.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
