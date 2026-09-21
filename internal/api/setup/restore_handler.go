package setup

// セットプレイのゴミ箱まわり(復元・完全削除)のハンドラ。M23-02 で新設。
// 形はコンボ側の Restore / PermanentDelete に揃えてある。

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// ===========================================================================
// POST /api/setups/:id/restore
// ===========================================================================

// Restore は論理削除されたセットプレイを復元する(M23-02 §4.2)。
// 成功後に再取得して 200 で返すのはコンボ側の Restore と同型。
func (h *Handler) Restore(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	// ★警告が付いても復元は成功しており、200 で返す(M23-04 §4.1)。
	// warnings はエラーではない——DES-002 §4.2 のとおり 200 OK の本文に載せる。
	warnings, err := h.service.Restore(c.Request().Context(), id)
	if err != nil {
		// 不在も「既に生きている」も 404。コンボ側の Restore と同じ挙動である
		// (リポジトリの WHERE deleted_at IS NOT NULL が 0 行を返すため)。
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "セットプレイが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "restore setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	resp, err := h.service.GetSetup(c.Request().Context(), id)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "post-restore get setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	out := toSetupResponse(resp, nil)
	// ★0 件のときはキーごと出さない(§4.3-2)。空配列を代入しないこと。
	if len(warnings.Issues) > 0 {
		out.Warnings = warnings.Issues
	}
	return c.JSON(http.StatusOK, out)
}

// ===========================================================================
// DELETE /api/setups/:id/permanent
// ===========================================================================

// PermanentDelete はゴミ箱のセットプレイを物理削除する(M23-02 §4.3 / §4.4)。
//
// 生きたコンボから参照されている間は 409 setup_in_use で拒否する(D-484)。
// ★details に参照元コンボを載せる。画面はこれを列挙しない(D-485＝専用の表示は
// 作らない)。★M23-07 §4.3 が画面での列挙と紐付け解除の導線を作り、D-485 を
// 上書きした。画面はこの details だけを使い、解除のための追加取得を行わない。
func (h *Handler) PermanentDelete(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	if err := h.service.PermanentDelete(c.Request().Context(), id); err != nil {
		var inUse *setupsvc.SetupInUseError
		switch {
		case errors.Is(err, setupsvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "セットプレイが見つかりません"))
		case errors.Is(err, setupsvc.ErrSetupNotInTrash):
			return c.JSON(http.StatusConflict, model.NewAPIError(model.ErrorCodeSetupNotInTrash,
				"完全削除の前にセットプレイをゴミ箱へ入れてください"))
		case errors.As(err, &inUse):
			return c.JSON(http.StatusConflict, model.NewAPIErrorWithDetails(model.ErrorCodeSetupInUse,
				"このセットプレイは使用中のコンボに紐づいているため、完全に削除できません",
				map[string]any{"combos": inUse.Combos}))
		default:
			slog.ErrorContext(c.Request().Context(), "permanent delete setup", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
		}
	}
	return c.NoContent(http.StatusNoContent)
}
