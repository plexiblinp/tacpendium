package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	authapi "github.com/plexiblinp/tacpendium/internal/api/auth"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
)

// ===========================================================================
// M22-05: CORS / CSRF の境界の契約テスト(指示書 §5.1)
//
// ★本ファイルが固定するのは「締めすぎていない」ことである。
//
// 締めすぎの壊れ方は localhost で操作している限り 1 度も現れないため、通常の
// 画面操作でも E2E でも検出できない。検出できる層はここしかない。
//
// ★CHANGE-116(案 A・D-423)により、CSRF の補助対策(独自ヘッダの要求)は撤回された。
// サーバ側に検証は無く、CSRF 対策は SameSite=Strict Cookie の 1 本立てである。
// ⇒ 本ファイルは「独自ヘッダが要求されないこと」も併せて固定する。
// ===========================================================================

const (
	// boundaryPort は許可 Origin を組み立てるときの実ポート。
	// cmd/tacpendium の buildAllowedOrigins が生む形と同じ綴りにしてある。
	boundaryPort = "47318"

	// boundaryLoopbackOrigin / boundaryLocalhostOrigin は local・lan の両モードで
	// 許可される 2 本(buildAllowedOrigins の固定部分)。
	boundaryLocalhostOrigin = "http://localhost:" + boundaryPort
	boundaryLoopbackOrigin  = "http://127.0.0.1:" + boundaryPort

	// boundaryLANOrigin は lan モードで追加される代表 LAN IP の Origin。
	// ★最重要ゲート 1 —— スマートフォンがここから叩く。
	boundaryLANOrigin = "http://192.168.1.23:" + boundaryPort

	// boundaryForeignOrigin は許可リストに無い別ホストの Origin。
	boundaryForeignOrigin = "http://evil.example"

	// boundaryLegacyHeader は撤回された補助対策の独自ヘッダ(CHANGE-116 案 A)。
	// ★サーバがこれを要求しないことを固定するために使う。
	boundaryLegacyHeader = "X-Requested-With"
)

// boundaryLocalOrigins / boundaryLANOrigins は buildAllowedOrigins が
// 各モードで生む許可リストと同じ内容。
var (
	boundaryLocalOrigins = []string{boundaryLocalhostOrigin, boundaryLoopbackOrigin}
	boundaryLANOrigins   = []string{boundaryLocalhostOrigin, boundaryLoopbackOrigin, boundaryLANOrigin}
)

// boundaryNonGETRoutes は非回帰の確認に使う代表的な非 GET 経路。
//
// ★全 41 経路を並べる代わりに、登録ファイルが異なるものを選んである
// (combo / tag / config / setup / punish)。「全部拒否する」実装ならここで落ちる。
var boundaryNonGETRoutes = []struct {
	method string
	path   string
}{
	{http.MethodPost, "/api/combos"},
	{http.MethodPut, "/api/combos/1"},
	{http.MethodDelete, "/api/combos/1"},
	{http.MethodPatch, "/api/tags/1"},
	{http.MethodPut, "/api/config"},
	{http.MethodPost, "/api/combos/1/setups"},
	{http.MethodPost, "/api/combo-punishes"},
}

// newBoundaryServer は本番と同じ順序でミドルウェアを積んだ echo を返す。
//
// ★順序は cmd/tacpendium/main.go:285-291 と同じ(RequestID → Logger → CORS → Auth)。
// UserContext は利用者解決であって境界ではないため積まない。
func newBoundaryServer(allowedOrigins []string, v *stubValidator) *echo.Echo {
	e := echo.New()
	e.Use(mw.RequestID())
	e.Use(mw.Logger())
	e.Use(mw.CORS(allowedOrigins))
	e.Use(mw.Auth(v))

	ok := func(c echo.Context) error { return c.String(http.StatusOK, "reached") }
	e.GET("/api/health", ok)
	e.GET("/api/combos", ok)
	e.POST(authapi.PathLogin, ok)
	e.POST(authapi.PathLogout, ok)
	e.GET(authapi.PathStatus, ok)
	e.POST(authapi.PathPassword, ok)
	for _, r := range boundaryNonGETRoutes {
		e.Add(r.method, r.path, ok)
	}
	return e
}

// boundaryRequest は Origin を任意に付けた要求を投げる。origin が空なら
// Origin ヘッダを付けない(＝同一オリジンからの要求と curl 相当が採る形)。
func boundaryRequest(e *echo.Echo, method, path, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if origin != "" {
		req.Header.Set(echo.HeaderOrigin, origin)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// assertNoCORSHeaders は境界を成すCORS 応答ヘッダが付いていないことを主張する。
//
// ★Vary は意図して対象外にしてある。Vary は キャッシュのヒントであって境界ではなく、
// 「常に Vary: Origin を付ける」は HTTP としてむしろ正しい方向の修正である。
// ここで不在まで契約にすると、その修正が非回帰違反に見えてしまう。
// ⇒ 境界として固定するのは Allow-Origin と Allow-Credentials の 2 本だけにする
// (許可 Origin に対して Vary が付くことは LANOriginNonGETIsAllowed が別途主張する)。
func assertNoCORSHeaders(t *testing.T, rec *httptest.ResponseRecorder, ctx string) {
	t.Helper()
	for _, h := range []string{
		echo.HeaderAccessControlAllowOrigin,
		echo.HeaderAccessControlAllowCredentials,
	} {
		if got := rec.Header().Get(h); got != "" {
			t.Errorf("%s: %s = %q, want empty", ctx, h, got)
		}
	}
}

// ===========================================================================
// §5.1-1 ★最重要ゲート 2: curl 相当の復旧経路
//
// DES-002 §8.2 の歯止め b —— 「curl 相当の経路が唯一の復旧経路である」。
// パスワードを非 ASCII で決めてしまった利用者は、そこからしか戻れない。
// ===========================================================================

// TestBoundary_CurlEquivalentReachesAuthRoutes は、入場ゲートが有効で
// セッションを持たない相手でも、Origin ヘッダ無し・独自ヘッダ無しの要求で
// /api/auth/* へ到達できることを固定する(指示書 §5.1-1)。
//
// ★これが赤くなったら復旧経路が消えている。CHANGE-116 §4.1-4 が案 A を推した
// 最大の理由であり、レビューチェックリスト §9-1 の重大判定に当たる。
func TestBoundary_CurlEquivalentReachesAuthRoutes(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: true, valid: map[string]bool{}})

	cases := []struct {
		method string
		path   string
	}{
		{http.MethodPost, authapi.PathLogin},
		{http.MethodPost, authapi.PathLogout},
		{http.MethodGet, authapi.PathStatus},
		{http.MethodPost, authapi.PathPassword},
	}
	for _, c := range cases {
		rec := boundaryRequest(e, c.method, c.path, "")
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s = %d, want 200 (curl 相当の復旧経路が塞がれている＝DES-002 §8.2 歯止め b)",
				c.method, c.path, rec.Code)
		}
	}
}

// TestBoundary_GateIsActuallyOn は上のテストの対照である。
//
// ★これが無いと「そもそもゲートが効いていないだけ」でも §5.1-1 が緑になる。
func TestBoundary_GateIsActuallyOn(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: true, valid: map[string]bool{}})

	rec := boundaryRequest(e, http.MethodGet, "/api/combos", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("GET /api/combos = %d, want 401 (対照が成立していない＝ゲートが効いていない)", rec.Code)
	}
	for _, r := range boundaryNonGETRoutes {
		rec := boundaryRequest(e, r.method, r.path, "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s = %d, want 401", r.method, r.path, rec.Code)
		}
	}
}

// TestBoundary_AuthRoutesDoNotRequireLegacyHeader は、撤回された補助対策の
// 独自ヘッダを付けなくても認証経路が通ることを固定する(CHANGE-116 案 A)。
//
// ★案 B へ倒す実装が入ると赤くなる。レビューチェックリスト §9-5 に当たる。
func TestBoundary_AuthRoutesDoNotRequireLegacyHeader(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: true, valid: map[string]bool{}})

	req := httptest.NewRequest(http.MethodPost, authapi.PathLogin, nil)
	if got := req.Header.Get(boundaryLegacyHeader); got != "" {
		t.Fatalf("前提が壊れている: %s = %q, want empty", boundaryLegacyHeader, got)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("POST %s(独自ヘッダ無し) = %d, want 200 (案 A では独自ヘッダを要求しない)",
			authapi.PathLogin, rec.Code)
	}
}

// ===========================================================================
// §5.1-2 ★最重要ゲート 1: LAN の他端末を塞がない
// ===========================================================================

// TestBoundary_LANOriginNonGETIsAllowed は、lan モードの許可リストに載る
// LAN IP の Origin から非 GET が通り、CORS の応答ヘッダが付くことを固定する
// (指示書 §5.1-2)。
//
// ★AllowCredentials を返すため AllowOrigin に "*" は使えない(§4.1-4)。
// 実際に Origin を逐語で返していることを併せて主張する。
func TestBoundary_LANOriginNonGETIsAllowed(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: false})

	for _, r := range boundaryNonGETRoutes {
		rec := boundaryRequest(e, r.method, r.path, boundaryLANOrigin)
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s from %s = %d, want 200 (LAN 端末が塞がれている)",
				r.method, r.path, boundaryLANOrigin, rec.Code)
			continue
		}
		if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != boundaryLANOrigin {
			t.Errorf("%s %s: Allow-Origin = %q, want %q", r.method, r.path, got, boundaryLANOrigin)
		}
		if got := rec.Header().Get(echo.HeaderAccessControlAllowCredentials); got != "true" {
			t.Errorf("%s %s: Allow-Credentials = %q, want %q", r.method, r.path, got, "true")
		}
		if got := rec.Header().Get(echo.HeaderVary); got != echo.HeaderOrigin {
			t.Errorf("%s %s: Vary = %q, want %q", r.method, r.path, got, echo.HeaderOrigin)
		}
	}
}

// TestBoundary_LANOriginPreflightIsAllowed はプリフライトが LAN Origin に対して
// 許可メソッドを返すことを固定する。
//
// ★入場ゲートが有効でもプリフライトは 401 にならない(CORS が OPTIONS を 204 で
// 早期に返し、Auth を呼ばないため)。ミドルウェアの順序が守っている性質である。
func TestBoundary_LANOriginPreflightIsAllowed(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: true, valid: map[string]bool{}})

	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, boundaryLANOrigin)
	req.Header.Set(echo.HeaderAccessControlRequestMethod, http.MethodPost)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != boundaryLANOrigin {
		t.Errorf("Allow-Origin = %q, want %q", got, boundaryLANOrigin)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowMethods); got == "" {
		t.Error("Allow-Methods is empty, want the allowed method list")
	}
}

// ===========================================================================
// §5.1-3 別ホストの Origin の扱い
//
// ★主張: サーバは止めない。CORS ヘッダを付けないことでブラウザ側が拒否する。
//
// これは意図した挙動である —— サーバ側で拒否すると、Origin を送らない
// curl 相当の経路(最重要ゲート 2)と、Vite dev proxy 経由の開発・E2E
// (Origin: http://localhost:5173 が転送されるが許可リストには無い)が壊れる。
// ===========================================================================

// TestBoundary_ForeignOriginNonGETIsProcessedWithoutCORSHeaders は、許可外の
// Origin からの非 GET が「到達するが CORS ヘッダが付かない」ことを固定する
// (指示書 §5.1-3)。
//
// ★破壊確認 A で赤くなるのはこのテストである(§5.1-4)。
func TestBoundary_ForeignOriginNonGETIsProcessedWithoutCORSHeaders(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: false})

	for _, r := range boundaryNonGETRoutes {
		rec := boundaryRequest(e, r.method, r.path, boundaryForeignOrigin)
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s from %s = %d, want 200 (サーバ側では止めない)",
				r.method, r.path, boundaryForeignOrigin, rec.Code)
		}
		assertNoCORSHeaders(t, rec, r.method+" "+r.path)
	}
}

// TestBoundary_ForeignOriginPreflightGetsNoCORSHeaders は、許可外 Origin の
// プリフライトが 204 を返しつつ許可メソッドを一切明かさないことを固定する。
func TestBoundary_ForeignOriginPreflightGetsNoCORSHeaders(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: false})

	req := httptest.NewRequest(http.MethodOptions, "/api/combos", nil)
	req.Header.Set(echo.HeaderOrigin, boundaryForeignOrigin)
	req.Header.Set(echo.HeaderAccessControlRequestMethod, http.MethodPost)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get(echo.HeaderAccessControlAllowMethods); got != "" {
		t.Errorf("Allow-Methods = %q, want empty (許可外へ許可メソッドを明かさない)", got)
	}
	assertNoCORSHeaders(t, rec, "preflight from "+boundaryForeignOrigin)
}

// ===========================================================================
// §5.1-5 非回帰 ＋ 本アプリの主経路
// ===========================================================================

// TestBoundary_SameOriginPathNeverEngagesCORS は、Origin ヘッダの無い要求が
// 通り、かつ CORS ヘッダが 1 つも付かないことを固定する。
//
// ★これが本アプリの主経路である —— 本番(embed 配信)・Vite dev proxy 経由・
// E2E・スマートフォンのいずれも同一オリジンであり、ブラウザは同一オリジン要求に
// CORS を適用しない。⇒ 許可リストの内容は主経路の可否を左右しない。
func TestBoundary_SameOriginPathNeverEngagesCORS(t *testing.T) {
	e := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: false})

	for _, r := range boundaryNonGETRoutes {
		rec := boundaryRequest(e, r.method, r.path, "")
		if rec.Code != http.StatusOK {
			t.Errorf("%s %s = %d, want 200", r.method, r.path, rec.Code)
		}
		assertNoCORSHeaders(t, rec, r.method+" "+r.path)
	}
}

// TestBoundary_ModeDoesNotChangeTheMainPath は、許可リストが local モードの
// ものでも lan モードのものでも、主経路(Origin 無し)の扱いが変わらないことを
// 固定する(指示書 §5.1-8 のうちミドルウェア側で主張できる部分)。
//
// ★buildAllowedOrigins のモード差そのものは cmd/tacpendium/main_test.go が持つ。
// ★境界を守っているのは bind アドレスであって CORS ではない(DES-002 §3.2)。
func TestBoundary_ModeDoesNotChangeTheMainPath(t *testing.T) {
	local := newBoundaryServer(boundaryLocalOrigins, &stubValidator{enabled: false})
	lan := newBoundaryServer(boundaryLANOrigins, &stubValidator{enabled: false})

	for _, r := range boundaryNonGETRoutes {
		localRec := boundaryRequest(local, r.method, r.path, "")
		lanRec := boundaryRequest(lan, r.method, r.path, "")
		if localRec.Code != lanRec.Code {
			t.Errorf("%s %s: local = %d, lan = %d, want identical",
				r.method, r.path, localRec.Code, lanRec.Code)
		}
		assertNoCORSHeaders(t, localRec, "local "+r.method+" "+r.path)
		assertNoCORSHeaders(t, lanRec, "lan "+r.method+" "+r.path)
	}
}

// TestBoundary_LoopbackOriginAllowedInBothModes は、local・lan の両モードで
// ループバックの 2 本が等しく許可されることを固定する。
//
// ★lan モードは local の許可リストへ 1 本足す形であって、置き換えではない。
// 置き換えにすると自機のブラウザから使えなくなる。
func TestBoundary_LoopbackOriginAllowedInBothModes(t *testing.T) {
	for _, mode := range []struct {
		name    string
		origins []string
	}{
		{"local", boundaryLocalOrigins},
		{"lan", boundaryLANOrigins},
	} {
		e := newBoundaryServer(mode.origins, &stubValidator{enabled: false})
		for _, origin := range []string{boundaryLocalhostOrigin, boundaryLoopbackOrigin} {
			rec := boundaryRequest(e, http.MethodPut, "/api/config", origin)
			if rec.Code != http.StatusOK {
				t.Errorf("%s mode, origin %s: = %d, want 200", mode.name, origin, rec.Code)
			}
			if got := rec.Header().Get(echo.HeaderAccessControlAllowOrigin); got != origin {
				t.Errorf("%s mode, origin %s: Allow-Origin = %q, want %q", mode.name, origin, got, origin)
			}
		}
	}
}
