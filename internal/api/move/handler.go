package move

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	movesvc "github.com/plexiblinp/tacpendium/internal/service/move"
	"github.com/plexiblinp/tacpendium/internal/service/movewarning"
)

// Handler は技マスタ API のハンドラ。
//
// 読み取り(List)は repo を直接使用する(M1-06、契約不変)。
// 編集・派生生成(Get/Update/GenerateRushVariant)は svc 経由(M9-03、FR703)。
type Handler struct {
	repo moverepo.Repository
	svc  *movesvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(repo moverepo.Repository, svc *movesvc.Service) *Handler {
	return &Handler{repo: repo, svc: svc}
}

// List は GET /api/moves?character_id=N を処理する。
//
// character_id クエリパラメタは必須。指定キャラクターの全技を ID 昇順で返す。
func (h *Handler) List(c echo.Context) error {
	raw := c.QueryParam("character_id")
	if raw == "" {
		return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
			Error: model.APIError{Code: "invalid_request", Message: "character_id query parameter is required"},
		})
	}
	characterID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || characterID <= 0 {
		return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
			Error: model.APIError{Code: "invalid_request", Message: "character_id must be a positive integer"},
		})
	}

	items, err := h.repo.ListByCharacter(c.Request().Context(), characterID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError,
			model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	// 要確認(WarningCode)を取込プレビューと同一の共有実装で再導出する(M9-04、§4.1)。
	// extra_throw はキャラ内の通常投げ序数を要するため、全行(ID 昇順)をまとめて渡す。
	stored := make([]movewarning.StoredMove, len(items))
	for i, m := range items {
		stored[i] = movewarning.StoredMove{
			CharacterID: m.CharacterID,
			Total:       m.Total,
			Category:    m.Category,
		}
	}
	warnings := movewarning.DeriveStoredWarnings(stored)

	resp := ListResponse{Items: make([]MoveResponse, len(items))}
	for i, m := range items {
		item := toMoveResponse(m)
		item.Warnings = warnings[i]
		resp.Items[i] = item
	}
	return c.JSON(http.StatusOK, resp)
}

// Get は GET /api/moves/:id を処理する(M9-03、編集グリッド用フル項目取得)。
func (h *Handler) Get(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}
	m, err := h.svc.GetMove(c.Request().Context(), id)
	if errors.Is(err, movesvc.ErrNotFound) {
		return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "技が見つかりません"))
	}
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "get move", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, toMoveDetailResponse(m))
}

// Update は PATCH /api/moves/:id を処理する(M9-03、§4.1 フィールド部分更新)。
func (h *Handler) Update(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}
	var req UpdateMoveRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", err.Error()))
	}

	m, err := h.svc.UpdateMove(c.Request().Context(), id, toUpdateMoveFields(req))
	if err != nil {
		var ve *movesvc.ValidationError
		switch {
		case errors.Is(err, movesvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "技が見つかりません"))
		case errors.As(err, &ve):
			return c.JSON(http.StatusBadRequest, model.NewAPIErrorWithDetails(
				model.ErrorCodeValidationFailed, ve.Message, map[string]any{"field": ve.Field}))
		}
		slog.ErrorContext(c.Request().Context(), "update move", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, toMoveDetailResponse(m))
}

// GenerateRushVariant は POST /api/moves/:id/rush-variant を処理する(M9-03、§4.2)。
func (h *Handler) GenerateRushVariant(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}
	m, err := h.svc.GenerateRushVariant(c.Request().Context(), id)
	if err != nil {
		var re *movesvc.RushTargetError
		var ce *movesvc.RushConflictError
		switch {
		case errors.Is(err, movesvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "技が見つかりません"))
		case errors.As(err, &re):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("rush_target_invalid", re.Message))
		case errors.As(err, &ce):
			// 重複: 409 + 既存 rush_variant の id(UI は既存行へ誘導)。
			return c.JSON(http.StatusConflict, model.NewAPIErrorWithDetails(
				"rush_variant_exists", "この技のラッシュ版は既に存在します",
				map[string]any{"existingId": ce.ExistingID}))
		}
		slog.ErrorContext(c.Request().Context(), "generate rush variant", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusCreated, toMoveDetailResponse(m))
}

// parseIDParam はパスパラメタ :name を int64 として取得する。
func parseIDParam(c echo.Context, name string) (int64, error) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil {
		return 0, errors.New(name + " は整数である必要があります")
	}
	return id, nil
}
