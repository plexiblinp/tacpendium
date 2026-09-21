package middleware_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	authapi "github.com/plexiblinp/tacpendium/internal/api/auth"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
)

// stubValidator は SessionValidator のテスト実装。
type stubValidator struct {
	enabled bool
	valid   map[string]bool
}

func (s *stubValidator) Enabled() bool { return s.enabled }

func (s *stubValidator) Validate(sessionID string) bool { return s.valid[sessionID] }

// newAuthServer は本番と同じ順序でミドルウェアを積んだ echo を返す。
func newAuthServer(v *stubValidator) *echo.Echo {
	e := echo.New()
	e.Use(mw.RequestID())
	e.Use(mw.Logger())
	e.Use(mw.CORS([]string{"http://localhost:5173"}))
	e.Use(mw.Auth(v))

	ok := func(c echo.Context) error { return c.String(http.StatusOK, "reached") }
	e.GET("/api/health", ok)
	e.GET("/api/combos", ok)
	e.GET("/api/config", ok)
	e.PUT("/api/config", ok)
	e.POST(authapi.PathLogin, ok)
	e.POST(authapi.PathLogout, ok)
	e.GET(authapi.PathStatus, ok)
	e.POST(authapi.PathPassword, ok)
	e.GET("/", ok)
	e.GET("/assets/app.js", ok)
	return e
}

func doRequest(e *echo.Echo, method, path string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func sessionCookie(value string) *http.Cookie {
	return &http.Cookie{Name: authapi.SessionCookieName, Value: value}
}

// ===========================================================================
// §5.1-1 最重要ゲート 2: OFF のとき何も変わらない
// ===========================================================================

// TestAuth_Disabled_EverythingPasses は password_enabled = false のとき、
// 保護対象を含むすべての経路が認証なしで通ることを固定する(指示書 §4.9 / §5.1-1)。
func TestAuth_Disabled_EverythingPasses(t *testing.T) {
	e := newAuthServer(&stubValidator{enabled: false})

	paths := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/combos"},
		{http.MethodGet, "/api/config"},
		{http.MethodPut, "/api/config"},
		{http.MethodGet, "/api/health"},
		{http.MethodPost, authapi.PathLogin},
		{http.MethodGet, "/"},
		{http.MethodGet, "/assets/app.js"},
	}
	for _, p := range paths {
		rec := doRequest(e, p.method, p.path, nil)
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s: status = %d, want 200", p.method, p.path, rec.Code)
		}
	}
}

// TestAuth_Disabled_DoesNotTouchResponse は OFF のとき Cookie も追加ヘッダも
// 足されないことを固定する(指示書 §4.9-4)。
//
// ★OFF の経路が壊れても新機能のテストは ON を通すため緑のままになる。ここが OFF 側の網である。
func TestAuth_Disabled_DoesNotTouchResponse(t *testing.T) {
	withAuth := newAuthServer(&stubValidator{enabled: false})

	// 対照: 認証ミドルウェアを積まない同じ構成。
	without := echo.New()
	without.Use(mw.RequestID())
	without.Use(mw.Logger())
	without.Use(mw.CORS([]string{"http://localhost:5173"}))
	without.GET("/api/combos", func(c echo.Context) error { return c.String(http.StatusOK, "reached") })

	got := doRequest(withAuth, http.MethodGet, "/api/combos", nil)
	want := doRequest(without, http.MethodGet, "/api/combos", nil)

	if got.Code != want.Code {
		t.Errorf("status = %d, want %d (same as without the auth middleware)", got.Code, want.Code)
	}
	if got.Body.String() != want.Body.String() {
		t.Errorf("body = %q, want %q", got.Body.String(), want.Body.String())
	}
	if len(got.Result().Cookies()) != 0 {
		t.Errorf("no cookie should be set when password protection is off, got %v", got.Result().Cookies())
	}

	// ヘッダ集合の比較。X-Request-ID は毎回変わるので名前だけを見る。
	for name := range got.Header() {
		if _, ok := want.Header()[name]; !ok {
			t.Errorf("unexpected response header %q added by the auth middleware", name)
		}
	}
	for name := range want.Header() {
		if _, ok := got.Header()[name]; !ok {
			t.Errorf("response header %q disappeared when the auth middleware was added", name)
		}
	}
}

// ===========================================================================
// §5.1-2 / §5.1-3: ON のときの保護と除外
// ===========================================================================

// TestAuth_Enabled_ProtectedRequiresSession は保護対象がセッション無しで拒否される
// ことを固定する(指示書 §5.1-2)。★破壊確認 A の対象テストである。
func TestAuth_Enabled_ProtectedRequiresSession(t *testing.T) {
	e := newAuthServer(&stubValidator{enabled: true, valid: map[string]bool{}})

	protected := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/combos"},
		{http.MethodGet, "/api/config"},
		{http.MethodPut, "/api/config"},
	}
	for _, p := range protected {
		rec := doRequest(e, p.method, p.path, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: status = %d, want 401", p.method, p.path, rec.Code)
			continue
		}
		var resp model.APIErrorResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Errorf("%s %s: unmarshal: %v", p.method, p.path, err)
			continue
		}
		if resp.Error.Code != "unauthorized" {
			t.Errorf("%s %s: error.code = %q, want %q", p.method, p.path, resp.Error.Code, "unauthorized")
		}
	}
}

// TestAuth_Enabled_UnprotectedPathsPass は保護対象から外した経路の全数が
// 認証なしで通ることを固定する(指示書 §4.5-2 / §5.1-3)。
//
// ★除外し忘れるとログインできなくなる。一覧そのものを固定する。
func TestAuth_Enabled_UnprotectedPathsPass(t *testing.T) {
	e := newAuthServer(&stubValidator{enabled: true, valid: map[string]bool{}})

	unprotected := []struct {
		method string
		path   string
		why    string
	}{
		{http.MethodGet, "/api/health", "ヘルスチェック"},
		{http.MethodPost, authapi.PathLogin, "これが無いとログインできない"},
		{http.MethodPost, authapi.PathLogout, "冪等・情報を返さない"},
		{http.MethodGet, authapi.PathStatus, "未認証の画面が状態を知る唯一の経路"},
		{http.MethodPost, authapi.PathPassword, "初回設定を通すため(変更は現パスワードで守る)"},
		{http.MethodGet, "/", "SPA シェル"},
		{http.MethodGet, "/assets/app.js", "静的アセット"},
	}
	for _, p := range unprotected {
		rec := doRequest(e, p.method, p.path, nil)
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s (%s): status = %d, want 200", p.method, p.path, p.why, rec.Code)
		}
	}
}

// TestAuth_Enabled_ValidSessionPasses は有効なセッションで保護対象が通ることを固定する。
func TestAuth_Enabled_ValidSessionPasses(t *testing.T) {
	const id = "valid-session-id"
	e := newAuthServer(&stubValidator{enabled: true, valid: map[string]bool{id: true}})

	if rec := doRequest(e, http.MethodGet, "/api/combos", sessionCookie(id)); rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if rec := doRequest(e, http.MethodGet, "/api/combos", sessionCookie("stale-session-id")); rec.Code != http.StatusUnauthorized {
		t.Errorf("stale session: status = %d, want 401", rec.Code)
	}
}

// TestAuth_Enabled_PreflightIsNotRejected は ON でもプリフライトが 401 にならない
// ことを固定する(指示書 §4.5-3。CORS の後ろへ置く理由)。
func TestAuth_Enabled_PreflightIsNotRejected(t *testing.T) {
	e := newAuthServer(&stubValidator{enabled: true, valid: map[string]bool{}})

	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, "http://localhost:5173")
	req.Header.Set(echo.HeaderAccessControlRequestMethod, http.MethodGet)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("preflight status = %d, want 204 (auth must sit behind CORS)", rec.Code)
	}
}

// ===========================================================================
// §5.1-6: ログにパスワード・ハッシュ・セッション ID が出ない
// ===========================================================================

// TestAuth_DoesNotLogCredentials は実データ(パスワード・検証子・セッション ID)を
// 流したときに、それらがログへ出ないことを固定する(指示書 §4.8 / §5.1-6)。
//
// ★M22-RESEARCH-01 §9-B-8 の時点では「マスク対象の実データが発生しない」状態だった。
// 本サブで初めて発生するため、実データで確かめる。
func TestAuth_DoesNotLogCredentials(t *testing.T) {
	const (
		plaintext = "actual-plaintext-password"
		verifier  = "pbkdf2-sha256$600000$c2FsdHNhbHQ$ZGVyaXZlZC1rZXk"
		sessionID = "actual-session-identifier"
	)

	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))
	defer slog.SetDefault(prev)

	e := newAuthServer(&stubValidator{enabled: true, valid: map[string]bool{sessionID: true}})

	// 認証済みの保護対象へ、ボディにパスワードと検証子を載せて送る。
	req := httptest.NewRequest(http.MethodPut, "/api/config",
		strings.NewReader(`{"password":"`+plaintext+`","passwordHash":"`+verifier+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(sessionCookie(sessionID))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	// 未認証で拒否される経路も見る(401 は WARN でログに載るため)。
	doRequest(e, http.MethodGet, "/api/combos", sessionCookie("rejected-"+sessionID))

	logged := buf.String()
	for _, secret := range []struct{ name, value string }{
		{"plaintext password", plaintext},
		{"password verifier", verifier},
		{"session id", sessionID},
	} {
		if strings.Contains(logged, secret.value) {
			t.Errorf("log output contains the %s.\nlog: %s", secret.name, logged)
		}
	}
}
