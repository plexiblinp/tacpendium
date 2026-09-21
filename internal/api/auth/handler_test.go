package auth_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/labstack/echo/v4"

	authapi "github.com/plexiblinp/tacpendium/internal/api/auth"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/model"
	authsvc "github.com/plexiblinp/tacpendium/internal/service/auth"
)

// memStore は SecurityStore のインメモリ実装。
type memStore struct {
	mu  sync.Mutex
	sec appconfig.SecurityConfig
}

func (m *memStore) Security() appconfig.SecurityConfig {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sec
}

func (m *memStore) SetPasswordHash(hash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sec.PasswordHash = hash
	return nil
}

// newServer は認証 API と、認証ミドルウェアで保護した経路を 1 本持つ echo を返す。
// ★本番と同じ経路構成にする(認証 API は保護対象から外れている)。
func newServer(t *testing.T, password string, enabled bool) (*echo.Echo, *memStore) {
	t.Helper()

	store := &memStore{sec: appconfig.SecurityConfig{PasswordEnabled: enabled}}
	if password != "" {
		hash, err := authsvc.HashPassword(password)
		if err != nil {
			t.Fatalf("HashPassword: %v", err)
		}
		store.sec.PasswordHash = hash
	}

	svc := authsvc.NewService(store)
	e := echo.New()
	e.Use(mw.Auth(svc))
	api := e.Group("/api")
	authapi.RegisterRoutes(api, authapi.NewHandler(svc))
	api.GET("/combos", func(c echo.Context) error { return c.String(http.StatusOK, "reached") })
	return e, store
}

func post(e *echo.Echo, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func get(e *echo.Echo, path string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// sessionFrom は応答の Set-Cookie からセッション Cookie を取り出す。
func sessionFrom(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == authapi.SessionCookieName {
			return c
		}
	}
	t.Fatalf("no %s cookie in the response", authapi.SessionCookieName)
	return nil
}

// ===========================================================================
// §5.1-4: ログインしてセッションで保護対象が通る
// ===========================================================================

func TestLogin_IssuesSessionThatPassesProtectedRoute(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)

	// 前提: セッション無しでは通らない。
	if rec := get(e, "/api/combos"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("precondition: status = %d, want 401", rec.Code)
	}

	rec := post(e, authapi.PathLogin, `{"password":"s3cret"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("login status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}

	cookie := sessionFrom(t, rec)
	if cookie.Value == "" {
		t.Fatal("the session cookie must carry a value")
	}
	if !cookie.HttpOnly {
		t.Error("the session cookie must be HttpOnly")
	}
	if cookie.SameSite != http.SameSiteStrictMode {
		t.Errorf("SameSite = %v, want Strict", cookie.SameSite)
	}
	if cookie.Path != "/" {
		t.Errorf("Path = %q, want %q", cookie.Path, "/")
	}
	// Secure は付けない(平文 HTTP の LAN 構成。付けると Cookie が保存されない)。
	if cookie.Secure {
		t.Error("the session cookie must not be Secure while the app is served over plain HTTP")
	}

	if rec := get(e, "/api/combos", cookie); rec.Code != http.StatusOK {
		t.Errorf("protected route with a session: status = %d, want 200", rec.Code)
	}
}

// TestLogin_WrongPassword は失敗時に理由以上の情報を返さないことを固定する(指示書 §4.4-1)。
func TestLogin_WrongPassword(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)

	rec := post(e, authapi.PathLogin, `{"password":"wrong"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Error("a failed login must not set a cookie")
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "invalid_password" {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, "invalid_password")
	}
	if strings.Contains(rec.Body.String(), "s3cret") || strings.Contains(rec.Body.String(), "wrong") {
		t.Errorf("the response must not echo any password: %s", rec.Body.String())
	}
}

// TestLogin_NoPasswordSet_SameResponseAsWrongPassword は「未設定」と「不一致」が
// 区別できないことを固定する(指示書 §4.4-1)。
func TestLogin_NoPasswordSet_SameResponseAsWrongPassword(t *testing.T) {
	unset, _ := newServer(t, "", false)
	set, _ := newServer(t, "s3cret", true)

	a := post(unset, authapi.PathLogin, `{"password":"anything"}`)
	b := post(set, authapi.PathLogin, `{"password":"anything"}`)

	if a.Code != b.Code {
		t.Errorf("status differs: unset = %d, wrong = %d", a.Code, b.Code)
	}
	if a.Body.String() != b.Body.String() {
		t.Errorf("body differs:\n unset = %s\n wrong = %s", a.Body.String(), b.Body.String())
	}
}

func TestLogin_InvalidJSON(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)
	if rec := post(e, authapi.PathLogin, "not json"); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// §5.1-8: ログアウト後はそのセッションで通らない
// ===========================================================================

func TestLogout_InvalidatesSession(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)

	cookie := sessionFrom(t, post(e, authapi.PathLogin, `{"password":"s3cret"}`))
	if rec := get(e, "/api/combos", cookie); rec.Code != http.StatusOK {
		t.Fatalf("precondition: status = %d, want 200", rec.Code)
	}

	rec := post(e, authapi.PathLogout, "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout status = %d, want 204", rec.Code)
	}
	if cleared := sessionFrom(t, rec); cleared.MaxAge >= 0 {
		t.Errorf("logout should expire the cookie, MaxAge = %d", cleared.MaxAge)
	}

	if rec := get(e, "/api/combos", cookie); rec.Code != http.StatusUnauthorized {
		t.Errorf("after logout: status = %d, want 401", rec.Code)
	}
}

// TestLogout_WithoutSessionIsIdempotent はセッション無しのログアウトが 204 を返すことを固定する。
func TestLogout_WithoutSessionIsIdempotent(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)
	if rec := post(e, authapi.PathLogout, ""); rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
}

// ===========================================================================
// GET /api/auth/status
// ===========================================================================

// TestStatus_ReadableWithoutSession は未認証でも状態を読めることを固定する(指示書 §4.4-4)。
// ★M22-02 が「パスワードを求めるべきか」を知る唯一の経路である。
func TestStatus_ReadableWithoutSession(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)

	rec := get(e, authapi.PathStatus)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp authapi.StatusResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.PasswordRequired {
		t.Error("passwordRequired should be true")
	}
	if !resp.PasswordSet {
		t.Error("passwordSet should be true")
	}
	if resp.Authenticated {
		t.Error("authenticated should be false without a session")
	}
}

// TestStatus_DoesNotLeakVerifier は状態応答に検証子が含まれないことを固定する。
func TestStatus_DoesNotLeakVerifier(t *testing.T) {
	e, store := newServer(t, "s3cret", true)

	body := get(e, authapi.PathStatus).Body.String()
	if strings.Contains(body, store.Security().PasswordHash) {
		t.Errorf("the status response leaks the password verifier: %s", body)
	}
	if strings.Contains(body, "s3cret") {
		t.Errorf("the status response leaks the password: %s", body)
	}
}

func TestStatus_ReflectsSession(t *testing.T) {
	e, _ := newServer(t, "s3cret", true)
	cookie := sessionFrom(t, post(e, authapi.PathLogin, `{"password":"s3cret"}`))

	var resp authapi.StatusResponse
	if err := json.Unmarshal(get(e, authapi.PathStatus, cookie).Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.Authenticated {
		t.Error("authenticated should be true with a valid session")
	}
}

// TestStatus_EnabledWithoutPasswordReportsDisabled は「有効かつ未設定」が
// 無効として見えることを固定する(指示書 §4.1-3)。
func TestStatus_EnabledWithoutPasswordReportsDisabled(t *testing.T) {
	e, _ := newServer(t, "", true)

	var resp authapi.StatusResponse
	if err := json.Unmarshal(get(e, authapi.PathStatus).Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.PasswordRequired {
		t.Error("passwordRequired should be false when no password is set")
	}
	if resp.PasswordSet {
		t.Error("passwordSet should be false")
	}
}

// ===========================================================================
// §5.1-12: パスワードの変更は現在のパスワードなしでは通らない
// ===========================================================================

func TestSetPassword_ChangeRequiresCurrentPassword(t *testing.T) {
	e, store := newServer(t, "old-password", true)
	before := store.Security().PasswordHash

	rec := post(e, authapi.PathPassword, `{"newPassword":"new-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", rec.Code, rec.Body.String())
	}
	if store.Security().PasswordHash != before {
		t.Error("a rejected change must not modify the stored verifier")
	}

	rec = post(e, authapi.PathPassword, `{"currentPassword":"guess","newPassword":"new-password"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("wrong current password: status = %d, want 401", rec.Code)
	}
	if store.Security().PasswordHash != before {
		t.Error("a rejected change must not modify the stored verifier")
	}

	// 対照: 現在のパスワードを添えれば通る。
	rec = post(e, authapi.PathPassword, `{"currentPassword":"old-password","newPassword":"new-password"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}
	if store.Security().PasswordHash == before {
		t.Error("the stored verifier should have changed")
	}
	if rec := post(e, authapi.PathLogin, `{"password":"new-password"}`); rec.Code != http.StatusNoContent {
		t.Errorf("login with the new password: status = %d, want 204", rec.Code)
	}
}

// TestSetPassword_InitialDoesNotRequireCurrent は初回設定を通すことを固定する
// (指示書 §4.4-3。この経路を塞ぐとパスワードを一度も設定できない)。
func TestSetPassword_InitialDoesNotRequireCurrent(t *testing.T) {
	e, store := newServer(t, "", false)

	rec := post(e, authapi.PathPassword, `{"newPassword":"first-password"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}
	if store.Security().PasswordHash == "" {
		t.Fatal("the verifier should have been stored")
	}
	if strings.Contains(store.Security().PasswordHash, "first-password") {
		t.Error("the stored verifier must not contain the plaintext password")
	}
}

func TestSetPassword_RejectsEmpty(t *testing.T) {
	e, _ := newServer(t, "", false)
	if rec := post(e, authapi.PathPassword, `{"newPassword":""}`); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// TestSetPassword_InvalidatesExistingSessions は変更で既存セッションが失効することを固定する。
func TestSetPassword_InvalidatesExistingSessions(t *testing.T) {
	e, _ := newServer(t, "old-password", true)
	cookie := sessionFrom(t, post(e, authapi.PathLogin, `{"password":"old-password"}`))

	if rec := post(e, authapi.PathPassword,
		`{"currentPassword":"old-password","newPassword":"new-password"}`, cookie); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if rec := get(e, "/api/combos", cookie); rec.Code != http.StatusUnauthorized {
		t.Errorf("the old session should be invalid after a password change: status = %d, want 401", rec.Code)
	}
}

// ===========================================================================
// §5.1-11: ON のとき認証なしで password_enabled を false にできない
// ===========================================================================

// TestDisablingProtectionRequiresSession は、入場ゲートを外す操作そのものが
// 保護対象であることを固定する(指示書 §4.4-3′)。
//
// ★これが破れると、パスワードを知らない相手がゲートを外せてしまい、
// パスワードを掛けた意味がその場で消える。
//
// 切替は PUT /api/config に置いたままであり(既存の設定 API)、保護は認証
// ミドルウェアが与える。本テストはその組み合わせを固定する。
func TestDisablingProtectionRequiresSession(t *testing.T) {
	store := &memStore{sec: appconfig.SecurityConfig{PasswordEnabled: true}}
	hash, err := authsvc.HashPassword("s3cret")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	store.sec.PasswordHash = hash

	svc := authsvc.NewService(store)
	e := echo.New()
	e.Use(mw.Auth(svc))
	api := e.Group("/api")
	authapi.RegisterRoutes(api, authapi.NewHandler(svc))

	// PUT /api/config の代役。到達したら実際に password_enabled を false にする。
	api.PUT("/config", func(c echo.Context) error {
		store.mu.Lock()
		store.sec.PasswordEnabled = false
		store.mu.Unlock()
		return c.NoContent(http.StatusOK)
	})

	// 未認証では到達しない。
	req := httptest.NewRequest(http.MethodPut, "/api/config",
		strings.NewReader(`{"security":{"passwordEnabled":false}}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", rec.Code, rec.Body.String())
	}
	if !store.Security().PasswordEnabled {
		t.Fatal("password protection was disabled by an unauthenticated request")
	}

	// 対照: ログインすれば外せる。
	cookie := sessionFrom(t, post(e, authapi.PathLogin, `{"password":"s3cret"}`))
	req = httptest.NewRequest(http.MethodPut, "/api/config",
		strings.NewReader(`{"security":{"passwordEnabled":false}}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("authenticated disable: status = %d, want 200", rec.Code)
	}
	if store.Security().PasswordEnabled {
		t.Error("an authenticated request should be able to disable password protection")
	}
}

// ===========================================================================
// §4.9-4: OFF のときはセッション Cookie を発行しない
// ===========================================================================

// TestLogin_DisabledButPasswordSet_IssuesNoCookie は、入場ゲートが無効なら
// 正しいパスワードでもセッションを発行しないことを固定する(指示書 §4.9-4)。
//
// ★「OFF かつパスワード設定済み」は例外的な状態ではない——ゲートを一度掛けて
// 外すと password_hash は残るため、これがゲートを外した後の通常状態である。
// ここが抜けていると、OFF なのに Set-Cookie が付く(レビュー指摘 2-a で発覚)。
func TestLogin_DisabledButPasswordSet_IssuesNoCookie(t *testing.T) {
	e, store := newServer(t, "s3cret", false) // ゲートは OFF・パスワードは設定済み
	if store.Security().PasswordHash == "" {
		t.Fatal("precondition: a password should be set")
	}

	rec := post(e, authapi.PathLogin, `{"password":"s3cret"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 (password protection is off)", rec.Code)
	}
	if cookies := rec.Result().Cookies(); len(cookies) != 0 {
		t.Errorf("no cookie must be issued while password protection is off, got %v", cookies)
	}

	// 対照: 同じパスワード・同じストアで ON にすれば発行される。
	on, _ := newServer(t, "s3cret", true)
	if rec := post(on, authapi.PathLogin, `{"password":"s3cret"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("control: status = %d, want 204", rec.Code)
	}
}

// TestStatus_DisabledButPasswordSet は OFF かつ設定済みのときの状態表現を固定する。
func TestStatus_DisabledButPasswordSet(t *testing.T) {
	e, _ := newServer(t, "s3cret", false)

	var resp authapi.StatusResponse
	if err := json.Unmarshal(get(e, authapi.PathStatus).Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.PasswordRequired {
		t.Error("passwordRequired should be false while protection is off")
	}
	// ★passwordSet は true のままである。M22-02 はこの組み合わせで
	// 「パスワードは登録済みだが今は要求されない」を表示できる。
	if !resp.PasswordSet {
		t.Error("passwordSet should stay true — the hash is not cleared when protection is turned off")
	}
}

// ===========================================================================
// §4.8: 実ハンドラ経路でも認証情報がログへ出ない
// ===========================================================================

// TestAuthHandlers_DoNotLogCredentials は、スタブではなく実ハンドラ
// (ログイン・パスワード設定)を通したときにログへ機密が出ないことを固定する。
//
// ★middleware 側の同型テストはスタブハンドラを通すため、実ハンドラ経路は
// 手動 curl でしか確かめられていなかった(レビュー指摘 §3 の △)。
func TestAuthHandlers_DoNotLogCredentials(t *testing.T) {
	const (
		initial = "initial-secret-password"
		changed = "changed-secret-password"
	)

	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))
	defer slog.SetDefault(prev)

	e, store := newServer(t, "", false)

	// 初回設定 → 有効化 → ログイン → 変更 の全経路を実ハンドラで通す。
	if rec := post(e, authapi.PathPassword, `{"newPassword":"`+initial+`"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("set password: status = %d", rec.Code)
	}
	verifier := store.Security().PasswordHash
	if verifier == "" {
		t.Fatal("a verifier should have been stored")
	}
	post(e, authapi.PathLogin, `{"password":"`+initial+`"}`)
	post(e, authapi.PathLogin, `{"password":"wrong-password-attempt"}`)
	post(e, authapi.PathPassword, `{"currentPassword":"`+initial+`","newPassword":"`+changed+`"}`)

	logged := buf.String()
	for _, secret := range []struct{ name, value string }{
		{"initial password", initial},
		{"changed password", changed},
		{"password verifier", verifier},
	} {
		if strings.Contains(logged, secret.value) {
			t.Errorf("log output contains the %s.\nlog: %s", secret.name, logged)
		}
	}
}

// ===========================================================================
// M22-08 §5.1-1: 非 ASCII を「決める」と 400 で拒否される(VAL-N05)
// ===========================================================================

func TestSetPassword_RejectsNonASCII(t *testing.T) {
	// ★日本語・全角英数・全角スペースの 3 通り(指示書 §5.1-1)。
	cases := []struct {
		name     string
		password string
	}{
		{"日本語", "ぱすわーど"},
		{"全角英数", "ＡＢＣ１２３"},
		{"全角スペースを含む", "abc　def"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, store := newServer(t, "", false)

			body, err := json.Marshal(map[string]string{"newPassword": tc.password})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			rec := post(e, authapi.PathPassword, string(body))

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			// ★契約はリテラルで固定する。定数を参照すると値を変えたとき一緒に動き、
			// 通信の契約が変わったことを検出できない(M22-03 の横断課題 1)。
			if got := errorCodeOf(t, rec); got != "password_charset_invalid" {
				t.Errorf("error code = %q, want password_charset_invalid", got)
			}
			// 拒否したなら検証子は書かれていないこと。
			if store.Security().PasswordHash != "" {
				t.Error("a rejected password must not be stored")
			}
			// ★弾いた値を応答へ載せていないこと(SUPP-001 §5.6)。
			if strings.Contains(rec.Body.String(), tc.password) {
				t.Errorf("the response echoes the rejected password: %s", rec.Body.String())
			}
		})
	}
}

// ===========================================================================
// M22-08 §5.1-5: 長さの下限・上限で拒否される(VAL-N06)
// ===========================================================================

func TestSetPassword_RejectsOutOfRangeLength(t *testing.T) {
	cases := []struct {
		name     string
		password string
	}{
		{"下限未満(3 文字)", "abc"},
		{"前後の空白を除くと下限未満", "   ab   "},
		{"上限超過(129 文字)", strings.Repeat("a", 129)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, store := newServer(t, "", false)

			body, err := json.Marshal(map[string]string{"newPassword": tc.password})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			rec := post(e, authapi.PathPassword, string(body))

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if got := errorCodeOf(t, rec); got != "password_length_invalid" {
				t.Errorf("error code = %q, want password_length_invalid", got)
			}
			if store.Security().PasswordHash != "" {
				t.Error("a rejected password must not be stored")
			}
		})
	}
}

// TestSetPassword_AcceptsBoundaryLengths は上限・下限ちょうどが通ることを固定する。
// ★「上限ちょうど」は自前実装で最も間違えやすい境界である(指示書 §4.6-4)。
func TestSetPassword_AcceptsBoundaryLengths(t *testing.T) {
	for _, tc := range []struct {
		name     string
		password string
	}{
		{"下限ちょうど(4 文字)", "abcd"},
		{"上限ちょうど(128 文字)", strings.Repeat("a", 128)},
		{"半角スペースを含む(合い言葉の形)", "open the gate please"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e, store := newServer(t, "", false)

			body, err := json.Marshal(map[string]string{"newPassword": tc.password})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			if rec := post(e, authapi.PathPassword, string(body)); rec.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want 204. body = %s", rec.Code, rec.Body.String())
			}
			if store.Security().PasswordHash == "" {
				t.Error("an accepted password should have been stored")
			}
		})
	}
}

// ===========================================================================
// M22-08 §5.1-2 / §5.1-3: ★最重要ゲート 1
// 検査は「決めるとき」だけに掛かる。既に決めてある検証子では入れ続けられる。
// ===========================================================================

// TestLogin_ExistingNonASCIIVerifierStillWorks は、非 ASCII で決めてあった利用者が
// 入れることを固定する(指示書 §4.1-2・§5.1-2)。
//
// ★★破壊確認 A の対象である。Service.Login へ文字種・長さの検査を掛けると本テストが
// 赤くなる。新機能のテストは新しく決めた ASCII のパスワードを使うため、締め出しは
// 緑のまま通る——本テストと下の変更経路のテストだけが判定材料である。
func TestLogin_ExistingNonASCIIVerifierStillWorks(t *testing.T) {
	const legacy = "ぱすわーど" // M22-08 より前に決められた検証子を再現する
	e, _ := newServer(t, legacy, true)

	body, err := json.Marshal(map[string]string{"password": legacy})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	rec := post(e, authapi.PathLogin, string(body))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204 (a non-ASCII verifier must keep working)", rec.Code)
	}
	// セッションが実際に発行され、保護対象を通れること。
	session := sessionFrom(t, rec)
	if got := get(e, "/api/combos", session); got.Code != http.StatusOK {
		t.Fatalf("protected route status = %d, want 200", got.Code)
	}
}

// TestLogin_ExistingShortVerifierStillWorks は、下限より短いパスワードで決めてあった
// 利用者が入れることを固定する(指示書 §5.1-5 後段)。
func TestLogin_ExistingShortVerifierStillWorks(t *testing.T) {
	const legacy = "ab" // 下限 4 文字を下回る
	e, _ := newServer(t, legacy, true)

	body, err := json.Marshal(map[string]string{"password": legacy})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if rec := post(e, authapi.PathLogin, string(body)); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204 (a short verifier must keep working)", rec.Code)
	}
}

// TestSetPassword_ExistingNonASCIICurrentIsAccepted は「変更時のいまのパスワード」にも
// 検査が掛かっていないことを固定する(指示書 §4.1-2・§5.1-2 後段)。
//
// ★★これが「詰み」の判定である。current に検査を掛けると、非 ASCII で決めた利用者は
// 入れないうえに変更もできなくなり、config.toml を手で編集する以外に出口が無くなる。
func TestSetPassword_ExistingNonASCIICurrentIsAccepted(t *testing.T) {
	const legacy = "ぱすわーど"
	e, store := newServer(t, legacy, true)
	before := store.Security().PasswordHash

	body, err := json.Marshal(map[string]string{
		"currentPassword": legacy,
		"newPassword":     "new-ascii-password",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if rec := post(e, authapi.PathPassword, string(body)); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204 (a non-ASCII current password must be accepted)", rec.Code)
	}
	if after := store.Security().PasswordHash; after == before || after == "" {
		t.Error("the verifier should have been replaced")
	}
}

// ===========================================================================
// M22-08 §5.1-4: 前後の空白が除去される(決めるときも入れるときも)
// ===========================================================================

func TestPassword_SurroundingWhitespaceIsTrimmed(t *testing.T) {
	// 決めるとき: 前後に空白を付けて決めると、除去した値の検証子が保存される。
	e, store := newServer(t, "", false)
	if rec := post(e, authapi.PathPassword, `{"newPassword":"  spaced-out  "}`); rec.Code != http.StatusNoContent {
		t.Fatalf("set: status = %d, want 204", rec.Code)
	}
	stored := store.Security().PasswordHash
	if !authsvc.VerifyPassword(stored, "spaced-out") {
		t.Error("the stored verifier should match the trimmed password")
	}
	if authsvc.VerifyPassword(stored, "  spaced-out  ") {
		t.Error("the stored verifier should not match the untrimmed password")
	}

	// 入れるとき: 空白の有無にかかわらず通る。
	// ★有効化しないと Login はセッションを出さない(DES-002 §8.1)ため、
	//   検証子を持つ有効なサーバを別に立てる。
	e2, _ := newServer(t, "spaced-out", true)
	for _, attempt := range []string{"spaced-out", "  spaced-out  ", "\tspaced-out\n"} {
		body, err := json.Marshal(map[string]string{"password": attempt})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		if rec := post(e2, authapi.PathLogin, string(body)); rec.Code != http.StatusNoContent {
			t.Errorf("login with %q: status = %d, want 204", attempt, rec.Code)
		}
	}
}

// ===========================================================================
// M22-08 §5.1-8 相当(サーバ側): ログインは理由を区別しない
// ===========================================================================

// TestLogin_RejectionCodeIsNotSplitByReason は、ログイン失敗のコードが
// パスワードの検査コードへ化けていないことを固定する(指示書 §4.1-6)。
func TestLogin_RejectionCodeIsNotSplitByReason(t *testing.T) {
	e, _ := newServer(t, "correct-horse", true)

	for _, attempt := range []string{"", "ぱすわーど", "ab", strings.Repeat("a", 200)} {
		body, err := json.Marshal(map[string]string{"password": attempt})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		rec := post(e, authapi.PathLogin, string(body))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("login with %q: status = %d, want 401", attempt, rec.Code)
		}
		if got := errorCodeOf(t, rec); got != "invalid_password" {
			t.Errorf("login with %q: error code = %q, want invalid_password", attempt, got)
		}
	}
}

// ===========================================================================
// M22-08 §4.2 / VAL-N07: 本文サイズの上限
// ===========================================================================

func TestAuthRoutes_RejectOversizedBody(t *testing.T) {
	e, store := newServer(t, "", false)

	// 上限を大きく超える本文。JSON としては妥当な形にしておく
	// (「JSON が壊れているから 400」と区別するため)。
	huge := `{"newPassword":"` + strings.Repeat("a", 64<<10) + `"}`
	rec := post(e, authapi.PathPassword, huge)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
	if got := errorCodeOf(t, rec); got != "request_body_too_large" {
		t.Errorf("error code = %q, want request_body_too_large", got)
	}
	if store.Security().PasswordHash != "" {
		t.Error("an oversized request must not reach the key derivation")
	}
}

// TestAuthRoutes_RejectOversizedBodyWithoutContentLength は、Content-Length を
// 申告しない要求(chunked 相当)でも VAL-N07 の応答が変わらないことを固定する。
//
// ★これが無いと「Content-Length を申告した要求だけ 413、申告しない要求は
// 400 invalid_request」という食い違いに気づけない。上限の防御そのものは
// どちらでも効くため、応答だけが静かに割れる型である。
func TestAuthRoutes_RejectOversizedBodyWithoutContentLength(t *testing.T) {
	e, store := newServer(t, "", false)

	huge := `{"newPassword":"` + strings.Repeat("a", 64<<10) + `"}`
	req := httptest.NewRequest(http.MethodPost, authapi.PathPassword, strings.NewReader(huge))
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = -1 // 申告なし。ContentLength の事前判定は効かない
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413. body = %s", rec.Code, rec.Body.String())
	}
	if got := errorCodeOf(t, rec); got != "request_body_too_large" {
		t.Errorf("error code = %q, want request_body_too_large", got)
	}
	if store.Security().PasswordHash != "" {
		t.Error("an oversized request must not reach the key derivation")
	}
}

// TestSetPassword_EmptyRejectionCode は「trim 後に空」の応答コードを固定する。
//
// ★空は長さ 0 であり VAL-N06 の一種だが、応答コードは M22-01 からの既存挙動である
// invalid_request のままにしてある(本サブは既存の拒否の意味づけを変えない)。
// ★画面側は空を送らない(送信ボタンが disabled)ため、この経路は curl 相当でしか出ない。
// ⇒ 完了報告 §9-1 の VAL-N06 の as-built にこの 1 点を明記してある。
func TestSetPassword_EmptyRejectionCode(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"空文字", `{"newPassword":""}`},
		{"空白だけ(trim すると空)", `{"newPassword":"   "}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e, _ := newServer(t, "", false)
			rec := post(e, authapi.PathPassword, tc.body)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			if got := errorCodeOf(t, rec); got != "invalid_request" {
				t.Errorf("error code = %q, want invalid_request", got)
			}
		})
	}
}

// TestAuthRoutes_AcceptBodyUnderLimit は上限内の要求が通ることを固定する
// (上限が小さすぎて通常の要求を弾いていないことの対照)。
func TestAuthRoutes_AcceptBodyUnderLimit(t *testing.T) {
	e, _ := newServer(t, "", false)

	// 上限 128 文字ちょうどの新パスワード + 128 文字の現在パスワード相当の大きさ。
	body, err := json.Marshal(map[string]string{"newPassword": strings.Repeat("a", 128)})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if rec := post(e, authapi.PathPassword, string(body)); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204. body = %s", rec.Code, rec.Body.String())
	}
}

// errorCodeOf は応答本文から error.code を取り出す。
func errorCodeOf(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error response %q: %v", rec.Body.String(), err)
	}
	return resp.Error.Code
}

// TestBodyLimit_DoesNotLeakToSiblingRoutes は本文サイズの上限が /api/auth/* の外へ
// 漏れていないことを固定する。
//
// ★★これが最重要ゲート 2 の網である(指示書 §4.2-1)。上限を e.Use や Group.Use で
// 掛けると同じ /api グループの全経路へ及び、POST /api/import/* が大きい CSV を
// 受けられなくなる。壊れ方は「大きいファイルのときだけ失敗する」であり、
// 小さい CSV のテストは緑のまま通る。⇒ 経路の外側から実際に大きい本文を通して固定する。
func TestBodyLimit_DoesNotLeakToSiblingRoutes(t *testing.T) {
	store := &memStore{sec: appconfig.SecurityConfig{}}
	svc := authsvc.NewService(store)

	e := echo.New()
	api := e.Group("/api")
	// 本番と同じ順序・同じグループへ登録する(cmd/tacpendium/main.go)。
	authapi.RegisterRoutes(api, authapi.NewHandler(svc))
	// 取り込み経路の代役。受け取ったバイト数をそのまま返す。
	api.POST("/import/csv", func(c echo.Context) error {
		n, err := io.Copy(io.Discard, c.Request().Body)
		if err != nil {
			return err
		}
		return c.String(http.StatusOK, strconv.FormatInt(n, 10))
	})

	// 認証経路の上限をはるかに超える大きさ(2MiB)。取り込みでは日常的な大きさである。
	const size = 2 << 20
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv", bytes.NewReader(bytes.Repeat([]byte("a"), size)))
	req.Header.Set("Content-Type", "text/csv")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (the auth body limit must not apply here). body = %s",
			rec.Code, rec.Body.String())
	}
	if got := rec.Body.String(); got != strconv.Itoa(size) {
		t.Fatalf("received %s bytes, want %d — the body was truncated", got, size)
	}

	// 対照: 同じ echo の認証経路では、同じ大きさの本文が実際に弾かれる。
	// ★これが無いと「そもそも上限が効いていないだけ」と区別できない。
	big := httptest.NewRequest(http.MethodPost, authapi.PathPassword,
		bytes.NewReader(bytes.Repeat([]byte("a"), size)))
	big.Header.Set("Content-Type", "application/json")
	bigRec := httptest.NewRecorder()
	e.ServeHTTP(bigRec, big)
	if bigRec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("control: auth route status = %d, want 413", bigRec.Code)
	}
}
