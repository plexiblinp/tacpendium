package static

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/labstack/echo/v4"
)

// newTestServer は fstest.MapFS をフロントエンドに見立てた echo を構築する。
// /api/health を「実 API ルート」として先に登録し、その後に静的配信を登録して
// 実運用(API → catch-all)の登録順序を再現する。
func newTestServer() *echo.Echo {
	dist := fstest.MapFS{
		"index.html":              {Data: []byte("<!doctype html><div id=root></div>")},
		"assets/index-abc123.js":  {Data: []byte("console.log(1)")},
		"assets/index-abc123.css": {Data: []byte("body{}")},
	}
	e := echo.New()
	// 実 API ルート(具体ルートは catch-all より優先される)。
	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	Register(e, dist)
	return e
}

func do(e *echo.Echo, method, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestRoot_ServesIndexNoCache(t *testing.T) {
	e := newTestServer()
	rec := do(e, http.MethodGet, "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET / = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "id=root") {
		t.Errorf("GET / body = %q, want index.html", rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheControlNoCache {
		t.Errorf("GET / Cache-Control = %q, want %q", got, cacheControlNoCache)
	}
}

func TestClientRoute_FallsBackToIndex(t *testing.T) {
	e := newTestServer()
	// React Router の直 URL(/combos/:id 相当)は index.html を 200 で返す。
	rec := do(e, http.MethodGet, "/combos/123")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /combos/123 = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "id=root") {
		t.Errorf("GET /combos/123 should fall back to index.html, got %q", rec.Body.String())
	}
}

func TestAPIRoute_NotSwallowed(t *testing.T) {
	e := newTestServer()
	// 実 API は JSON を返す(index.html を返さない)。
	rec := do(e, http.MethodGet, "/api/health")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/health = %d, want 200", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "id=root") {
		t.Errorf("GET /api/health returned index.html; SPA fallback swallowed API")
	}
}

func TestUnknownAPIRoute_Returns404(t *testing.T) {
	e := newTestServer()
	// 未登録の /api/* は 404。index.html を返してはならない(最重要の落とし穴)。
	rec := do(e, http.MethodGet, "/api/does-not-exist")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET /api/does-not-exist = %d, want 404", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "id=root") {
		t.Errorf("unknown /api path returned index.html; must be 404")
	}
}

func TestAsset_ServedWithImmutableCacheAndMIME(t *testing.T) {
	e := newTestServer()
	rec := do(e, http.MethodGet, "/assets/index-abc123.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET asset = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheControlImmutable {
		t.Errorf("asset Cache-Control = %q, want %q", got, cacheControlImmutable)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("asset Content-Type = %q, want javascript", ct)
	}
}

func TestMissingAsset_Returns404(t *testing.T) {
	e := newTestServer()
	// 欠落アセットは index.html ではなく 404(本来 404 であるべき)。
	rec := do(e, http.MethodGet, "/assets/missing.js")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET /assets/missing.js = %d, want 404", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "id=root") {
		t.Errorf("missing asset returned index.html; must be 404")
	}
}

func TestHead_AssetReturnsHeadersWithoutBody(t *testing.T) {
	e := newTestServer()
	// HEAD はステータス・ヘッダ(キャッシュ/MIME)を返しつつボディは空であること
	// (e.HEAD("/*") 登録の意図を明示。net/http が HEAD のボディを抑止する)。
	rec := do(e, http.MethodHead, "/assets/index-abc123.js")
	if rec.Code != http.StatusOK {
		t.Fatalf("HEAD asset = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheControlImmutable {
		t.Errorf("HEAD asset Cache-Control = %q, want %q", got, cacheControlImmutable)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("HEAD asset Content-Type = %q, want javascript", ct)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("HEAD asset body len = %d, want 0", rec.Body.Len())
	}
}

func TestHead_ClientRouteFallsBackToIndex(t *testing.T) {
	e := newTestServer()
	// クライアントルートへの HEAD も 200(index.html フォールバック)を返す。
	rec := do(e, http.MethodHead, "/combos/123")
	if rec.Code != http.StatusOK {
		t.Fatalf("HEAD /combos/123 = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != cacheControlNoCache {
		t.Errorf("HEAD /combos/123 Cache-Control = %q, want %q", got, cacheControlNoCache)
	}
}

func TestHead_APIRouteNotSwallowed(t *testing.T) {
	e := newTestServer()
	// 未登録 /api/* への HEAD も 404(SPA フォールバックに飲ませない)。
	rec := do(e, http.MethodHead, "/api/does-not-exist")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("HEAD /api/does-not-exist = %d, want 404", rec.Code)
	}
}
