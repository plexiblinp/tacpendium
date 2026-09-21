package character

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	charsvc "github.com/plexiblinp/tacpendium/internal/service/character"
)

// CharacterListResponse は GET /api/games/:gameId/characters のレスポンス。
type CharacterListResponse struct {
	Items []model.Character `json:"items"`
}

// Handler はキャラクター API のハンドラ集合。
type Handler struct {
	service charsvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service charsvc.Service) *Handler {
	return &Handler{service: service}
}

// List は GET /api/games/:gameId/characters を処理する。
func (h *Handler) List(c echo.Context) error {
	raw := c.Param("gameId")
	gameID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || gameID <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_game_id", "gameId must be a positive integer"))
	}

	items, err := h.service.ListByGame(c.Request().Context(), gameID)
	if err != nil {
		if errors.Is(err, charsvc.ErrInvalidGameID) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_game_id", err.Error()))
		}
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "internal server error"))
	}

	return c.JSON(http.StatusOK, CharacterListResponse{Items: items})
}
