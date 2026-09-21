package setup

// 保存前の重複チェック(M23-09 §4.1-2)。
//
// ★★判定ではなく問い合わせである。VAL-S04 の 409 も VAL-S07 の警告もここでは出さない。
// 出す場所は従来どおり POST /api/combos/:comboId/setups のままである(M23-09 §2.2)。

import (
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// CheckDuplicate は POST /api/combos/:comboId/setups/check-duplicate のハンドラ。
//
// ★エラーは 400(id 不正 / 本文不正 / characterId 欠落)と 500 の 2 種だけである。
// ★★404 を返さない。親コンボの存在は確認しない——存在しなければ双方 0 件になるだけで
// あり、「チェックの失敗で登録という主目的を巻き添えにしない」規律(§4.2-3)と整合する。
// ⇒ 返らない分岐を持たせると、読む側が「存在確認をしている」と誤読する。
func (h *Handler) CheckDuplicate(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}

	var req CheckSetupDuplicateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}
	if req.CharacterID == 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "characterId is required"))
	}

	result, err := h.service.CheckSetupDuplicate(c.Request().Context(), comboID, toServiceCheckDuplicateInput(req))
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "check setup duplicate",
			slog.Int64("comboId", comboID), slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "重複判定中にサーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, CheckSetupDuplicateResponse{
		Duplicates:        result.Duplicates,
		DeletedDuplicates: result.DeletedDuplicates,
	})
}
