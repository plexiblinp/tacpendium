package combo

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// Materialize は POST /api/combos/:id/materialize のハンドラ(M18-03b §4.4)。
// 基底コンボ(:id)から確定反撃(パニッシュカウンター版)を別コンボとして生成し、
// combo_punishes を同時に作る。FR301 で既存が見つかった場合は生成せず既存 id を返す。
func (h *Handler) Materialize(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	var req MaterializeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}
	if req.OpponentMoveID == 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "opponentMoveId is required"))
	}

	result, vres, err := h.service.Materialize(c.Request().Context(), combosvc.MaterializeInput{
		UserID:         mw.UserIDFrom(c),
		BaseComboID:    id,
		OpponentMoveID: req.OpponentMoveID,
		Note:           req.Note,
	})
	if err != nil {
		switch {
		case errors.Is(err, combosvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		case errors.Is(err, combosvc.ErrMaterializeIneligibleHitType):
			// FE がボタンを出さないだけでは API 直叩きで二重計上が起こるため BE でも弾く。
			// UI が理由を表示できる専用コードを添える(M19-01 の knockdown_advantage_required と同じ流儀)。
			return c.JSON(http.StatusBadRequest, model.NewAPIError("hit_type_not_materializable",
				"このコンボはすでにパニッシュカウンター版のため、生成対象外です"))
		}
		// M24-11: write lock を取れなかった。入力の誤り(400)でも版の衝突(409)でもない。
		if errors.Is(err, combosvc.ErrDatabaseBusy) {
			return c.JSON(http.StatusServiceUnavailable,
				model.NewAPIError(model.ErrorCodeDatabaseBusy,
					"データベースが混み合っています。少し時間をおいて再度お試しください"))
		}
		slog.ErrorContext(c.Request().Context(), "materialize", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	// ★★M31-01: VAL-C15(本登録の必須 4 欄)は ERROR であり、生成を止める。
	//   ⇒ POST /api/combos と同じ 400 validation_failed で返す(FE は同じ表示経路に乗る)。
	//   ★着手前、本経路だけが VAL-C15 を素通りしていた
	//     (followup `materialize-bypasses-required-fields`)。
	if vres.HasError() {
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(vres))
	}

	// 既存ありでも生成時でも 200。FE は alreadyExisted で表示を分岐する(エラー扱いにしない)。
	return c.JSON(http.StatusOK, MaterializeResponse{
		ComboID:          result.ComboID,
		AlreadyExisted:   result.AlreadyExisted,
		DamageAdded:      result.DamageAdded,
		DamageSkipReason: result.DamageSkipReason,
	})
}
