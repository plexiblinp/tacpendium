// Package static はフロントエンド(web/dist)の SPA 静的配信ハンドラを提供する。
//
// DES-002 §5.1: ビルド済み SPA を embed して配信し、未知パスは index.html へ
// フォールバックする(React Router のクライアントルートを直 URL・リロード・共有
// リンクで開けるようにするため)。
//
// 最重要の落とし穴(指示書 §8.2):
//   - /api/* を SPA フォールバックに飲ませない。API パスは静的配信より優先される
//     よう、本ハンドラは catch-all `/*` に登録し、/api 始まりのパスは index.html を
//     返さず 404 を返す(未登録 API パスが index.html を返す事故の防止)。
package static

import (
	"errors"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/labstack/echo/v4"
)

const (
	// indexFile は SPA のエントリポイント。未知パスのフォールバック先。
	indexFile = "index.html"
	// assetsPrefix は Vite がフィンガープリント付きで出力するアセットのパス接頭辞。
	assetsPrefix = "/assets/"
	// cacheControlImmutable はフィンガープリント付きアセット向けの長期キャッシュ。
	cacheControlImmutable = "public, max-age=31536000, immutable"
	// cacheControlNoCache は index.html 向け(SPA 更新を反映させる)。
	cacheControlNoCache = "no-cache"
)

// Register は dist(web/dist をルートとした fs.FS)を SPA として配信する
// catch-all ルートを echo に登録する。API ルート登録の後に呼ぶこと
// (echo の具体ルート > catch-all の優先順位に依存)。
func Register(e *echo.Echo, dist fs.FS) {
	h := &handler{dist: dist}
	e.GET("/*", h.serve)
	e.HEAD("/*", h.serve)
}

type handler struct {
	dist fs.FS
}

// serve はリクエストパスに対応する静的ファイルを返す。存在しない場合は
// SPA フォールバックとして index.html を返す。ただし:
//   - /api 始まりのパスは 404(API を SPA に飲ませない)
//   - /assets 始まりで実体が無いパスは 404(本来 404 であるべきアセット欠落)
func (h *handler) serve(c echo.Context) error {
	reqPath := c.Request().URL.Path

	// /api/* は静的配信の対象外。未登録 API パスでも index.html を返さない。
	if reqPath == "/api" || strings.HasPrefix(reqPath, "/api/") {
		return echo.NewHTTPError(http.StatusNotFound)
	}

	// 先頭スラッシュを除去し fs.FS のキーへ。"/" は index.html へ。
	name := strings.TrimPrefix(reqPath, "/")
	if name == "" {
		return h.serveIndex(c)
	}
	// クリーンアップ(.. によるトラバーサルを防ぐ)。fs.FS は元々 .. を許さないが念のため。
	name = path.Clean(name)
	if name == "." || strings.HasPrefix(name, "../") {
		return h.serveIndex(c)
	}

	if h.tryServeFile(c, name) {
		return nil
	}

	// 実体が無い場合の扱い:
	//   - /assets/* はフィンガープリント付き静的資産。欠落は 404(SPA に飲ませない)。
	//   - それ以外(クライアントルート)は index.html フォールバック。
	if strings.HasPrefix(reqPath, assetsPrefix) {
		return echo.NewHTTPError(http.StatusNotFound)
	}
	return h.serveIndex(c)
}

// tryServeFile は name のファイルを配信する。存在しない/ディレクトリの場合は
// false を返し、それ以外は配信して true を返す。
func (h *handler) tryServeFile(c echo.Context, name string) bool {
	f, err := h.dist.Open(name)
	if err != nil {
		return false
	}
	defer func() { _ = f.Close() }()

	info, err := f.Stat()
	if err != nil || info.IsDir() {
		return false
	}

	rs, ok := f.(io.ReadSeeker)
	if !ok {
		// embed.FS / fstest.MapFS のファイルは io.ReadSeeker を満たす。満たさない
		// 実装に備えたフォールバック: 全読みしてから配信する。
		data, readErr := io.ReadAll(f)
		if readErr != nil {
			return false
		}
		setStaticHeaders(c, name)
		_ = c.Blob(http.StatusOK, contentType(name), data)
		return true
	}

	setStaticHeaders(c, name)
	// http.ServeContent が Content-Type(未設定時)/Range/If-Modified-Since を処理する。
	http.ServeContent(c.Response(), c.Request(), name, info.ModTime(), rs)
	return true
}

// serveIndex は SPA フォールバックとして index.html を no-cache で返す。
func (h *handler) serveIndex(c echo.Context) error {
	data, err := fs.ReadFile(h.dist, indexFile)
	if err != nil {
		// index.html が無いのは embed 不備。500 ではなく明示的なエラーにする。
		if errors.Is(err, fs.ErrNotExist) {
			return echo.NewHTTPError(http.StatusNotFound)
		}
		return echo.NewHTTPError(http.StatusInternalServerError)
	}
	c.Response().Header().Set("Cache-Control", cacheControlNoCache)
	return c.HTMLBlob(http.StatusOK, data)
}

// setStaticHeaders は Cache-Control と Content-Type を設定する。
// /assets 配下(フィンガープリント付き)は長期 immutable、それ以外は no-cache。
func setStaticHeaders(c echo.Context, name string) {
	if strings.HasPrefix("/"+name, assetsPrefix) {
		c.Response().Header().Set("Cache-Control", cacheControlImmutable)
	} else {
		c.Response().Header().Set("Cache-Control", cacheControlNoCache)
	}
	if ct := contentType(name); ct != "" {
		c.Response().Header().Set(echo.HeaderContentType, ct)
	}
}

// contentType は拡張子から Content-Type を推定する。不明な場合は空文字。
func contentType(name string) string {
	return mime.TypeByExtension(path.Ext(name))
}
