package setup

// セットプレイ成立条件(combo_setup_results)のエンドポイント(M19-03 §4.3)。
//
//   PUT    /api/combos/:comboId/setups/:setupId/results   1 セルの upsert
//   DELETE /api/combos/:comboId/setups/:setupId/results   1 セルの削除 =「未検証へ戻す」
//
// 取得は専用エンドポイントを設けず、コンボ詳細レスポンスへ同梱する(§4.3.1 の (a))。
// 項目10 はコンボ詳細を開いた時点で全セットプレイ分を表示するため、専用 GET だと
// N+1 の往復になる(M19-02 の alreadyAdopted で同型の問題があった)。

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// ===========================================================================
// PUT /api/combos/:comboId/setups/:setupId/results
// ===========================================================================

func (h *Handler) UpsertSetupResult(c echo.Context) error {
	comboID, setupID, errResp := parseResultPathParams(c)
	if errResp != nil {
		return errResp
	}

	var req UpsertSetupResultRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	err := h.service.UpsertResult(c.Request().Context(), comboID, setupID, setupsvc.UpsertResultInput{
		TechType: req.TechType,
		InCorner: req.InCorner,
		Result:   req.Result,
		Note:     req.Note,
	})
	if err != nil {
		return h.setupResultError(c, err, "upsert setup result")
	}

	return c.JSON(http.StatusOK, model.ComboSetupResult{
		ComboID:  comboID,
		SetupID:  setupID,
		TechType: req.TechType,
		InCorner: req.InCorner,
		Result:   req.Result,
		Note:     req.Note,
	})
}

// ===========================================================================
// DELETE /api/combos/:comboId/setups/:setupId/results?techType=&inCorner=
// ===========================================================================

func (h *Handler) DeleteSetupResult(c echo.Context) error {
	comboID, setupID, errResp := parseResultPathParams(c)
	if errResp != nil {
		return errResp
	}

	techType := c.QueryParam("techType")
	if techType == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "techType は必須です"))
	}
	inCornerRaw := c.QueryParam("inCorner")
	if inCornerRaw == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "inCorner は必須です"))
	}
	inCorner, parseErr := strconv.ParseBool(inCornerRaw)
	if parseErr != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "inCorner は真偽値である必要があります"))
	}

	if err := h.service.DeleteResult(c.Request().Context(), comboID, setupID, techType, inCorner); err != nil {
		return h.setupResultError(c, err, "delete setup result")
	}
	return c.NoContent(http.StatusNoContent)
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func parseResultPathParams(c echo.Context) (int64, int64, error) {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return 0, 0, c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}
	setupID, err := parseIDParam(c, "setupId")
	if err != nil {
		return 0, 0, c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_setup_id", "セットプレイ ID が不正です"))
	}
	return comboID, setupID, nil
}

// setupResultError はサービス層のセンチネルを HTTP ステータスへ写像する。
func (h *Handler) setupResultError(c echo.Context, err error, op string) error {
	switch {
	case errors.Is(err, setupsvc.ErrInvalidResultValue):
		// 値域外(§4.3.2)。値域の正典は combo_setup_results の定義。
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_setup_result", "受け身種別または検証結果の値が不正です"))
	case errors.Is(err, setupsvc.ErrSetupLinkNotFound):
		// 紐付けが存在しない組への書き込み。複合 FK に加えた API 層の多層防御。
		return c.JSON(http.StatusNotFound,
			model.NewAPIError("setup_link_not_found", "コンボとセットプレイの紐付けが見つかりません"))
	default:
		slog.ErrorContext(c.Request().Context(), op, slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError,
			model.NewAPIError("internal_error", "成立条件の更新中にサーバーエラーが発生しました"))
	}
}
