//go:build !debug

package debug

import (
	"database/sql"

	"github.com/labstack/echo/v4"
)

// Handler は本番ビルド用の no-op 実装。
type Handler struct{}

// NewHandler は no-op Handler を返す。
func NewHandler(_ *sql.DB, _ string) *Handler { return &Handler{} }

// RegisterRoutes は本番ビルドでは何も登録しない。
func RegisterRoutes(_ *echo.Group, _ *Handler) {}
