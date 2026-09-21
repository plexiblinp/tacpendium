// Package health はヘルスチェックエンドポイント GET /api/health を提供する。
package health

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// Version はバイナリバージョン。M1 では固定文字列、ビルド時上書き対応は将来検討。
const Version = "0.1.0"

// Response はヘルスチェック応答。
type Response struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

// Handler は GET /api/health を処理し {"status":"ok","version":"<v>"} を返す。
func Handler(c echo.Context) error {
	return c.JSON(http.StatusOK, Response{
		Status:  "ok",
		Version: Version,
	})
}
