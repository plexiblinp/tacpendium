package user

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	usersvc "github.com/plexiblinp/tacpendium/internal/service/user"
)

// Handler は user API のハンドラ。
type Handler struct {
	svc usersvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(svc usersvc.Service) *Handler {
	return &Handler{svc: svc}
}

// List は GET /api/users を処理する。
//
// ★画面はこの件数で「ユーザー選択を出すか」を決める。1 人なら出さない(FR502)。
func (h *Handler) List(c echo.Context) error {
	users, err := h.svc.List(c.Request().Context())
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "list users", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError,
			model.NewAPIError("internal_error", "ユーザー一覧の取得中にサーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, toUserResponses(users))
}

// Create は POST /api/users を処理する。
//
// ★既定タグ(mycombo_status の 3 件)も同時に生成される(service 側で 1 トランザクション)。
func (h *Handler) Create(c echo.Context) error {
	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	u, err := h.svc.Create(c.Request().Context(), req.Name)
	if err != nil {
		return h.writeServiceError(c, err, "create user")
	}
	return c.JSON(http.StatusCreated, toUserResponse(u))
}

// Update は PATCH /api/users/:id を処理する(名前の変更のみ)。
func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	u, err := h.svc.Rename(c.Request().Context(), id, req.Name)
	if err != nil {
		return h.writeServiceError(c, err, "rename user")
	}
	return c.JSON(http.StatusOK, toUserResponse(u))
}

func (h *Handler) writeServiceError(c echo.Context, err error, op string) error {
	switch {
	case errors.Is(err, usersvc.ErrNameEmpty):
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("user_name_empty", "利用者名を入力してください"))
	case errors.Is(err, usersvc.ErrNameDuplicate):
		return c.JSON(http.StatusConflict,
			model.NewAPIError("user_name_duplicate", "同じ名前の利用者が既にいます"))
	case errors.Is(err, usersvc.ErrNotFound):
		return c.JSON(http.StatusNotFound,
			model.NewAPIError("user_not_found", "対象の利用者が見つかりません"))
	default:
		slog.ErrorContext(c.Request().Context(), op, slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError,
			model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
}
