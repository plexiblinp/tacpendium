package middleware_test

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
)

// 改善レーン S2: api/middleware は main.go で全リクエストに配線されるが未カバーだったため、
// 現挙動を固定する characterization テストを追加する(実装は変更しない)。

func runRequest(t *testing.T, m echo.MiddlewareFunc, req *http.Request) (*httptest.ResponseRecorder, echo.Context) {
	t.Helper()
	e := echo.New()
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	handler := m(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})
	if err := handler(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return rec, c
}

// ---------------------------------------------------------------------------
// CORS(SUPP-001 §2.6.1: 起動時固定リスト・完全一致・ワイルドカード不使用)
// ---------------------------------------------------------------------------

func TestCORS_AllowedOrigin_SetsHeaders(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set(echo.HeaderOrigin, "http://localhost:5173")

	rec, _ := runRequest(t, m, req)

	if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != "http://localhost:5173" {
		t.Errorf("Allow-Origin = %q, want origin echo", got)
	}
	if got := rec.Header().Get(echo.HeaderVary); got != echo.HeaderOrigin {
		t.Errorf("Vary = %q, want Origin", got)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowCredentials); got != "true" {
		t.Errorf("Allow-Credentials = %q, want true", got)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 (next handler must run)", rec.Code)
	}
}

func TestCORS_DisallowedOrigin_NoHeaders_ButRequestProceeds(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set(echo.HeaderOrigin, "http://evil.example.com")

	rec, _ := runRequest(t, m, req)

	if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != "" {
		t.Errorf("Allow-Origin = %q, want empty for disallowed origin", got)
	}
	// 許可外でもリクエスト自体は処理される(ブラウザ側でレスポンスが遮断される方式)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestCORS_EmptyAllowList_DeniesAll(t *testing.T) {
	m := mw.CORS(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set(echo.HeaderOrigin, "http://localhost:5173")

	rec, _ := runRequest(t, m, req)

	if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != "" {
		t.Errorf("Allow-Origin = %q, want empty (empty list = deny all)", got)
	}
}

func TestCORS_NoOriginHeader_PassesThrough(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)

	rec, _ := runRequest(t, m, req)

	if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != "" {
		t.Errorf("Allow-Origin = %q, want empty when no Origin header", got)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestCORS_Preflight_AllowedOrigin(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, "http://localhost:5173")

	rec, _ := runRequest(t, m, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowMethods); !strings.Contains(got, "PATCH") {
		t.Errorf("Allow-Methods = %q, want PATCH included", got)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowHeaders); !strings.Contains(got, "Content-Type") {
		t.Errorf("Allow-Headers = %q, want default headers", got)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlMaxAge); got != "600" {
		t.Errorf("Max-Age = %q, want 600", got)
	}
}

func TestCORS_Preflight_EchoesRequestedHeaders(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, "http://localhost:5173")
	req.Header.Set(echo.HeaderAccessControlRequestHeaders, "X-Custom-Header")

	rec, _ := runRequest(t, m, req)

	if got := rec.Header().Get(echo.HeaderAccessControlAllowHeaders); got != "X-Custom-Header" {
		t.Errorf("Allow-Headers = %q, want requested headers echoed", got)
	}
}

func TestCORS_Preflight_DisallowedOrigin_204WithoutHeaders(t *testing.T) {
	m := mw.CORS([]string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, "http://evil.example.com")

	rec, _ := runRequest(t, m, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowMethods); got != "" {
		t.Errorf("Allow-Methods = %q, want empty for disallowed origin", got)
	}
}

// ---------------------------------------------------------------------------
// RequestID
// ---------------------------------------------------------------------------

func TestRequestID_GeneratesWhenAbsent(t *testing.T) {
	m := mw.RequestID()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)

	rec, c := runRequest(t, m, req)

	id := rec.Header().Get(mw.HeaderRequestID)
	if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(id) {
		t.Errorf("generated id = %q, want 32-char hex", id)
	}
	if got := mw.RequestIDFromContext(c); got != id {
		t.Errorf("context id = %q, want %q (response header and context must match)", got, id)
	}
}

func TestRequestID_ReusesClientProvidedID(t *testing.T) {
	m := mw.RequestID()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set(mw.HeaderRequestID, "client-supplied-id")

	rec, c := runRequest(t, m, req)

	if got := rec.Header().Get(mw.HeaderRequestID); got != "client-supplied-id" {
		t.Errorf("response id = %q, want client id reused", got)
	}
	if got := mw.RequestIDFromContext(c); got != "client-supplied-id" {
		t.Errorf("context id = %q, want client id", got)
	}
}

func TestRequestIDFromContext_EmptyWhenUnset(t *testing.T) {
	e := echo.New()
	c := e.NewContext(httptest.NewRequest(http.MethodGet, "/", nil), httptest.NewRecorder())
	if got := mw.RequestIDFromContext(c); got != "" {
		t.Errorf("got %q, want empty when middleware not applied", got)
	}
}

// ---------------------------------------------------------------------------
// Logger(slog 出力とレベル分岐: 2xx=INFO / 4xx=WARN / 5xx=ERROR)
// ---------------------------------------------------------------------------

type capturingHandler struct {
	records *[]slog.Record
}

func (h capturingHandler) Enabled(context.Context, slog.Level) bool { return true }
func (h capturingHandler) Handle(_ context.Context, r slog.Record) error {
	*h.records = append(*h.records, r)
	return nil
}
func (h capturingHandler) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h capturingHandler) WithGroup(string) slog.Handler      { return h }

func TestLogger_LevelByStatus(t *testing.T) {
	cases := []struct {
		name      string
		status    int
		wantLevel slog.Level
	}{
		{"2xx is info", http.StatusOK, slog.LevelInfo},
		{"4xx is warn", http.StatusBadRequest, slog.LevelWarn},
		{"5xx is error", http.StatusInternalServerError, slog.LevelError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var records []slog.Record
			prev := slog.Default()
			slog.SetDefault(slog.New(capturingHandler{records: &records}))
			defer slog.SetDefault(prev)

			e := echo.New()
			req := httptest.NewRequest(http.MethodGet, "/api/test-path", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			handler := mw.Logger()(func(c echo.Context) error {
				return c.String(tc.status, "x")
			})
			if err := handler(c); err != nil {
				t.Fatalf("handler: %v", err)
			}

			if len(records) != 1 {
				t.Fatalf("records = %d, want 1", len(records))
			}
			r := records[0]
			if r.Level != tc.wantLevel {
				t.Errorf("level = %v, want %v", r.Level, tc.wantLevel)
			}
			if r.Message != "http.request" {
				t.Errorf("message = %q, want http.request", r.Message)
			}
			attrs := map[string]slog.Value{}
			r.Attrs(func(a slog.Attr) bool {
				attrs[a.Key] = a.Value
				return true
			})
			if got := attrs["path"].String(); got != "/api/test-path" {
				t.Errorf("path = %q", got)
			}
			if got := attrs["status"].Int64(); got != int64(tc.status) {
				t.Errorf("status = %d, want %d", got, tc.status)
			}
			if got := attrs["method"].String(); got != http.MethodGet {
				t.Errorf("method = %q", got)
			}
		})
	}
}

// TestLogger_NoSensitiveBodyLogged はログにリクエストボディが出力されないことを固定する
// (SUPP-001 §5.6: センシティブ情報は出力しない)。
func TestLogger_NoSensitiveBodyLogged(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	defer slog.SetDefault(prev)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/config", strings.NewReader(`{"password":"secret-value"}`))
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	handler := mw.Logger()(func(c echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	})
	if err := handler(c); err != nil {
		t.Fatalf("handler: %v", err)
	}

	if strings.Contains(buf.String(), "secret-value") {
		t.Errorf("log output contains request body: %s", buf.String())
	}
}
