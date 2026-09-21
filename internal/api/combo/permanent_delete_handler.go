package combo

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// PermanentDelete は DELETE /api/combos/:id/permanent のハンドラ(M2-03)。
// 論理削除済みコンボを物理削除する。通常コンボへの要求は 409 で拒否する。
func (h *Handler) PermanentDelete(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	if err := h.service.PermanentDelete(c.Request().Context(), id); err != nil {
		switch {
		case errors.Is(err, combosvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		case errors.Is(err, combosvc.ErrComboNotInTrash):
			return c.JSON(http.StatusConflict, model.NewAPIError("combo_not_in_trash", "permanent delete requires the combo to be soft-deleted first"))
		default:
			slog.ErrorContext(c.Request().Context(), "permanent delete combo", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
		}
	}
	return c.NoContent(http.StatusNoContent)
}
