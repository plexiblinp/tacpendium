package combo

import (
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// CheckDuplicate は POST /api/combos/check-duplicate のハンドラ(M2-02 / M23-09 §4.1-1)。
//
// 保存する前に、入力内容と重複するコンボを 2 つに分けて返す。
//   - duplicates        … 生きた行。母集団は VAL-C02 と同じ(is_draft = 0 ＋ deleted_at IS NULL)。
//   - deletedDuplicates … ゴミ箱の行。母集団は VAL-C14 と同じ(サービス層で同一関数を共有する)。
//
// ★判定ではなく問い合わせである。VAL コードを 1 つも発火させない——発火させるのは
// 従来どおり POST /api/combos(VAL-C02)と CheckTrashDuplicate(VAL-C14)のままである。
// ★画面は生きた側でダイアログを出さない(既に VAL-C02 が ERROR で止めている)。
// 保存前ダイアログを出すのは削除済み側だけである(M23-09 §4.1-4)。
func (h *Handler) CheckDuplicate(c echo.Context) error {
	var req CheckDuplicateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	if req.CharacterID == 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "characterId is required"))
	}

	steps := make([]model.ComboStep, len(req.Steps))
	for i, sr := range req.Steps {
		steps[i] = model.ComboStep{
			StepOrder: sr.StepOrder,
			MoveID:    sr.MoveID,
			Modifiers: sr.Modifiers,
		}
	}

	input := combosvc.CheckDuplicateInput{
		CharacterID:    req.CharacterID,
		StarterMoveID:  req.StarterMoveID,
		Position:       req.Position,
		OpponentStance: req.OpponentStance,
		HitType:        req.HitType,
		OpponentSize:   req.OpponentSize,
		StarterMeaty:   req.StarterMeaty,
		Steps:          steps,
		ExcludeComboID: req.ExcludeComboID,
	}

	result, err := h.service.CheckDuplicate(c.Request().Context(), input)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "check duplicate", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "重複判定中にサーバーエラーが発生しました"))
	}

	resp := CheckDuplicateResponse{
		Duplicates: make([]DuplicateInfoResponse, len(result.Duplicates)),
		// ★nil のままだと JSON が null になる。空配列で出す(dto.go の godoc 参照)。
		DeletedDuplicates: result.DeletedDuplicates,
	}
	if resp.DeletedDuplicates == nil {
		resp.DeletedDuplicates = make([]model.ComboRef, 0)
	}
	for i, d := range result.Duplicates {
		resp.Duplicates[i] = DuplicateInfoResponse{
			ID:             d.ID,
			CharacterID:    d.CharacterID,
			StarterMoveID:  d.StarterMoveID,
			Position:       d.Position,
			OpponentStance: d.OpponentStance,
			HitType:        d.HitType,
			OpponentSize:   d.OpponentSize,
			StarterMeaty:   d.StarterMeaty,
			StepCount:      d.StepCount,
			Memo:           d.Memo,
		}
	}
	return c.JSON(http.StatusOK, resp)
}
