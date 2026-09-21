package setup

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// SetupListResponse は GET /api/setups の一覧レスポンス。
type SetupListResponse struct {
	Items []SetupResponse `json:"items"`
}

// Handler はセットプレイ API のハンドラ集合。
type Handler struct {
	service setupsvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service setupsvc.Service) *Handler {
	return &Handler{service: service}
}

// ===========================================================================
// POST /api/combos/:comboId/setups
// ===========================================================================

func (h *Handler) CreateSetup(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}

	var req CreateSetupRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	resp, result, err := h.service.CreateSetup(c.Request().Context(), comboID, toServiceCreateInput(req))
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "create setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "セットプレイ作成中にサーバーエラーが発生しました"))
	}
	if result.HasError() {
		if hasDuplicateSetup(result) {
			return c.JSON(http.StatusConflict, model.NewAPIError("duplicate_setup", "同一レシピのセットプレイが既にこのコンボに紐付いています"))
		}
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(result))
	}
	out := toSetupResponse(resp, &result)

	// M23-05: VAL-S07(同じ親コンボのゴミ箱に同じレシピがある)。★本経路だけで走らせる
	// (M23-05 §4.5)——CreateSetupInTx(コンボ同時登録)は内部呼び出しで警告を返す先が無く、
	// PATCH は重複判定キーを変えられないため重複が新しく生まれない。
	// ★警告であって登録は既に成功している。VAL-S04 の 409 とは別物である(§4.1-1)。
	// ★0 件のときはキーごと出さない(M23-04 §4.3-2)。
	if trashWarnings := h.service.CheckTrashDuplicateSetup(c.Request().Context(), comboID, resp.Setup.ID); len(trashWarnings.Issues) > 0 {
		out.Warnings = trashWarnings.Issues
	}

	return c.JSON(http.StatusOK, out)
}

// ===========================================================================
// POST /api/combos/:comboId/setup-links
// ===========================================================================

func (h *Handler) CreateSetupLink(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}

	var req CreateSetupLinkRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	if req.SetupID == 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "setupId は必須です"))
	}

	err = h.service.CreateSetupLink(c.Request().Context(), comboID, req.SetupID)
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボまたはセットプレイが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "create setup link", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "紐付け作成中にサーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, ComboSetupLinkResponse{ComboID: comboID, SetupID: req.SetupID})
}

// ===========================================================================
// DELETE /api/combos/:comboId/setup-links/:setupId
// ===========================================================================

func (h *Handler) DeleteSetupLink(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}
	setupID, err := parseIDParam(c, "setupId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_setup_id", "セットプレイ ID が不正です"))
	}

	err = h.service.DeleteSetupLink(c.Request().Context(), comboID, setupID)
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "紐付けが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "delete setup link", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "紐付け解除中にサーバーエラーが発生しました"))
	}
	return c.NoContent(http.StatusNoContent)
}

// ===========================================================================
// GET /api/setups?characterId=X
// ===========================================================================

func (h *Handler) ListSetups(c echo.Context) error {
	v := c.QueryParam("characterId")
	if v == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "characterId は必須です"))
	}
	id, err := strconv.ParseInt(v, 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "characterId は正の整数"))
	}
	characterID := &id

	// onlyDeleted=true でゴミ箱(論理削除済み)を返す(M23-02 §4.2-8)。
	// ★引数の綴りは本経路の既存の流儀(camelCase)に揃えてある。コンボ側の
	//   GET /api/combos は snake_case(only_deleted)だが、同じ経路の中で綴りが
	//   割れるほうが、経路をまたいで揃っていないことより害が大きい(D-491)。
	var svcResps []*setupsvc.SetupResponse
	if c.QueryParam("onlyDeleted") == "true" {
		svcResps, err = h.service.ListDeletedSetups(c.Request().Context(), characterID)
	} else {
		svcResps, err = h.service.ListSetups(c.Request().Context(), characterID)
	}
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "list setups", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "セットプレイ一覧取得中にサーバーエラーが発生しました"))
	}

	items := make([]SetupResponse, len(svcResps))
	for i, r := range svcResps {
		items[i] = toSetupResponse(r, nil)
	}
	return c.JSON(http.StatusOK, SetupListResponse{Items: items})
}

// ===========================================================================
// GET /api/setups/:id
// ===========================================================================

func (h *Handler) GetSetup(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "セットプレイ ID が不正です"))
	}

	resp, err := h.service.GetSetup(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "セットプレイが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "セットプレイ取得中にサーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, toSetupResponse(resp, nil))
}

// ===========================================================================
// PATCH /api/setups/:id
// ===========================================================================

func (h *Handler) UpdateSetup(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "セットプレイ ID が不正です"))
	}

	var req UpdateSetupRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	resp, result, err := h.service.UpdateSetup(c.Request().Context(), id, toServiceUpdateInput(req))
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "セットプレイが見つかりません"))
		}
		if errors.Is(err, setupsvc.ErrConflict) {
			return c.JSON(http.StatusConflict, model.NewAPIError(model.ErrorCodeVersionConflict, "セットプレイが他で更新されています。最新版を取得してから再実行してください"))
		}
		slog.ErrorContext(c.Request().Context(), "update setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "セットプレイ更新中にサーバーエラーが発生しました"))
	}
	if result.HasError() {
		if hasDuplicateSetup(result) {
			return c.JSON(http.StatusConflict, model.NewAPIError("duplicate_setup", "同一レシピのセットプレイが既にこのコンボに紐付いています"))
		}
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(result))
	}
	return c.JSON(http.StatusOK, toSetupResponse(resp, &result))
}

// ===========================================================================
// DELETE /api/setups/:id
// ===========================================================================

func (h *Handler) DeleteSetup(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "セットプレイ ID が不正です"))
	}

	// ★★M31-01(P4M-019): `?unlinkFrom=<comboId>` を渡すと、そのコンボとの紐付けも
	//   同時に外す。**省略時は着手前と同じ挙動**であり、既存の呼び出しは影響を受けない。
	//   ★クエリで受けるのは DELETE に本文を持たせないためである(既存の DELETE 系と統一)。
	var unlinkFrom *int64
	if raw := c.QueryParam("unlinkFrom"); raw != "" {
		v, convErr := strconv.ParseInt(raw, 10, 64)
		if convErr != nil || v <= 0 {
			return c.JSON(http.StatusBadRequest,
				model.NewAPIError("invalid_request", "unlinkFrom が不正です"))
		}
		unlinkFrom = &v
	}

	err = h.service.DeleteSetup(c.Request().Context(), id, unlinkFrom)
	if err != nil {
		if errors.Is(err, setupsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "セットプレイが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "delete setup", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "セットプレイ削除中にサーバーエラーが発生しました"))
	}
	return c.NoContent(http.StatusNoContent)
}

// ===========================================================================
// GET /api/combos/:comboId/setup-candidates (FR011)
// ===========================================================================

// GetSetupCandidates は同一キャラ＋同一 knockdown_advantage の他コンボの setup を候補として返す。
func (h *Handler) GetSetupCandidates(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}

	candidates, err := h.service.GetSetupCandidates(c.Request().Context(), comboID)
	if err != nil {
		if errors.Is(err, setupsvc.ErrComboNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get setup candidates", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "候補取得中にサーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, toSetupCandidatesResponse(candidates))
}

// ===========================================================================
// GET /api/setups/candidates?characterId=X&knockdownAdvantage=Y (C-08)
// ===========================================================================

// GetSetupCandidatesByCharacter は新規コンボ登録時の紐付け候補を返す。
// comboID が無いため characterId + knockdownAdvantage を直接受け取り、
// 同一キャラ + 同一 knockdown_advantage の他コンボに紐付く setup を候補として返す。
// knockdownAdvantage 未指定時は候補なし(空配列)を返す。
func (h *Handler) GetSetupCandidatesByCharacter(c echo.Context) error {
	cv := c.QueryParam("characterId")
	cid, err := strconv.ParseInt(cv, 10, 64)
	if err != nil || cid <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "characterId は正の整数"))
	}

	var kda *int
	if kv := c.QueryParam("knockdownAdvantage"); kv != "" {
		n, err := strconv.Atoi(kv)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "knockdownAdvantage は整数"))
		}
		kda = &n
	}

	candidates, err := h.service.GetSetupCandidatesByKnockdown(c.Request().Context(), cid, kda)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "get setup candidates by knockdown", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "候補取得中にサーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, toSetupCandidatesResponse(candidates))
}

// toSetupCandidatesResponse は候補 SetupResponse を API レスポンス DTO へ変換する。
func toSetupCandidatesResponse(candidates []*setupsvc.SetupResponse) SetupCandidatesResponse {
	items := make([]SetupCandidateSummary, len(candidates))
	for i, sr := range candidates {
		pIDs := sr.ParentComboIDs
		if pIDs == nil {
			pIDs = []int64{}
		}
		items[i] = SetupCandidateSummary{
			ID:             sr.Setup.ID,
			CharacterID:    sr.Setup.CharacterID,
			Name:           sr.Setup.Name,
			Description:    sr.Setup.Description,
			StepCount:      sr.Setup.StepCount,
			Version:        sr.Setup.Version,
			DefaultRecipe:  sr.DefaultRecipe,
			ParentComboIDs: pIDs,
		}
	}
	return SetupCandidatesResponse{Items: items}
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func parseIDParam(c echo.Context, name string) (int64, error) {
	s := c.Param(name)
	if s == "" {
		return 0, errors.New("param is empty")
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}

func hasDuplicateSetup(result validation.ValidationResult) bool {
	for _, issue := range result.Issues {
		if issue.Code == setupsvc.CodeS04Duplicate {
			return true
		}
	}
	return false
}
