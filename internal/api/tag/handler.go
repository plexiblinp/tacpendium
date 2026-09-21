// Package tag はタグ管理の HTTP ハンドラを提供する。M3 で実装。
package tag

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
)

// Handler はタグ API のハンドラ集合。
type Handler struct {
	service tagsvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service tagsvc.Service) *Handler {
	return &Handler{service: service}
}

// ===========================================================================
// GET /api/tags
// ===========================================================================

// List はタグ一覧を返す。
// クエリパラメータ:
//   - category: カテゴリ絞り込み(任意)
//   - include_usage: true の場合 usageCount フィールドを付与
//   - character_id: 正の整数の場合、usageCount を当該キャラのコンボのみで集計(E-3、任意)
func (h *Handler) List(c echo.Context) error {
	category := c.QueryParam("category")
	includeUsage := c.QueryParam("include_usage") == "true"

	var characterID *int64
	if v := c.QueryParam("character_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "character_id は正の整数で指定してください"))
		}
		characterID = &id
	}

	tags, err := h.service.ListTags(c.Request().Context(), mw.UserIDFrom(c), category, includeUsage, characterID)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "list tags", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "タグ一覧の取得中にサーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, tags)
}

// ===========================================================================
// GET /api/tags/:id
// ===========================================================================

// Get は単一タグを返す。
func (h *Handler) Get(c echo.Context) error {
	id, err := parseID(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	tag, err := h.service.GetTag(c.Request().Context(), mw.UserIDFrom(c), id)
	if err != nil {
		if errors.Is(err, tagsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "タグが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get tag", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "タグ取得中にサーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, tag)
}

// ===========================================================================
// POST /api/tags
// ===========================================================================

// Create は新規タグを作成する。
func (h *Handler) Create(c echo.Context) error {
	var input model.CreateTagInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	tag, err := h.service.CreateTag(c.Request().Context(), mw.UserIDFrom(c), input)
	if err != nil {
		switch {
		case errors.Is(err, tagsvc.ErrTagNameEmpty):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("tag_name_empty", "タグ名は必須です"))
		case errors.Is(err, tagsvc.ErrTagNameDuplicate):
			return c.JSON(http.StatusConflict, model.NewAPIError("tag_name_duplicate", "同名のタグが既に存在します"))
		default:
			slog.ErrorContext(c.Request().Context(), "create tag", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "タグ作成中にサーバーエラーが発生しました"))
		}
	}
	return c.JSON(http.StatusCreated, tag)
}

// ===========================================================================
// PATCH /api/tags/:id
// ===========================================================================

// Update はタグを部分更新する。
func (h *Handler) Update(c echo.Context) error {
	id, err := parseID(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	var input model.UpdateTagInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	tag, err := h.service.UpdateTag(c.Request().Context(), mw.UserIDFrom(c), id, input)
	if err != nil {
		switch {
		case errors.Is(err, tagsvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "タグが見つかりません"))
		case errors.Is(err, tagsvc.ErrTagNameEmpty):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("tag_name_empty", "タグ名は必須です"))
		case errors.Is(err, tagsvc.ErrTagNameDuplicate):
			return c.JSON(http.StatusConflict, model.NewAPIError("tag_name_duplicate", "同名のタグが既に存在します"))
		default:
			slog.ErrorContext(c.Request().Context(), "update tag", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "タグ更新中にサーバーエラーが発生しました"))
		}
	}
	return c.JSON(http.StatusOK, tag)
}

// ===========================================================================
// DELETE /api/tags/:id
// ===========================================================================

// Delete はタグを削除する。
// クエリパラメータ:
//   - force: true の場合、使用中タグも強制削除する(VAL-T03)
func (h *Handler) Delete(c echo.Context) error {
	id, err := parseID(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}
	force := c.QueryParam("force") == "true"

	err = h.service.DeleteTag(c.Request().Context(), mw.UserIDFrom(c), id, force)
	if err != nil {
		switch {
		case errors.Is(err, tagsvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "タグが見つかりません"))
		case errors.Is(err, tagsvc.ErrTagInUse):
			var inUse *tagsvc.TagInUseError
			errors.As(err, &inUse)
			return c.JSON(http.StatusConflict, model.NewAPIErrorWithDetails("tag_in_use",
				"このタグは使用中です。確認の上削除してください",
				map[string]any{
					"usageCount":       inUse.UsageCount,
					"forceDeleteQuery": "?force=true",
				},
			))
		default:
			slog.ErrorContext(c.Request().Context(), "delete tag", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "タグ削除中にサーバーエラーが発生しました"))
		}
	}
	return c.NoContent(http.StatusNoContent)
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func parseID(c echo.Context, param string) (int64, error) {
	raw := c.Param(param)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("ID は正の整数で指定してください")
	}
	return id, nil
}
