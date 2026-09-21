// Package inputresolve は段階2 解決表配信 API のハンドラ層である(M17-02 G-k・CHANGE-069 §2.3-k)。
package inputresolve

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	resolvesvc "github.com/plexiblinp/tacpendium/internal/service/inputresolve"
)

// CommandIndexResponse は GET /api/characters/:characterId/command-index のレスポンス。
//
// entries はキャラ 1 体分の畳み済み解決表(token_key → move_code)。キーの形状は
// 「方向テンキー数字(1-9・ニュートラルは数字なし)+ボタン名(LP/MP/HP/LK/MK/HK)」
// (例 "2MP"・"6HP"・"MP")。FE(M17-03)はキャラ選択時に 1 回取得し、入力状態からキーを
// 構築して引くだけ=解決規則を持たない。未 seed キャラは空(=段階1 だけが動く)。
type CommandIndexResponse struct {
	CharacterID int64             `json:"characterId"`
	Entries     map[string]string `json:"entries"`
}

// MotionCommandDTO は索引 1 行(M21-06 §4.6)。
type MotionCommandDTO struct {
	TokenKey string `json:"tokenKey"`
	MoveCode string `json:"moveCode"`
}

// MotionCommandsResponse は GET /api/characters/:characterId/motion-commands のレスポンス。
//
// ★CommandIndexResponse とは別物である。あちらは段階2 用に畳み済みの 1 対 1 マップ、こちらは
// 索引の素通し(畳まない・絞らない)。物理モーション入力(M21-06)が前方一致・最長一致で
// 突き合わせるための表であり、解決規則そのものは FE が持つ(§4.6-5)。
//
// ★マップにしない。同一 token_key に複数の move が載る組が実データに 49 件あり、マップにすると
// 「同じ長さで複数残るなら解決しない」(§4.2-4)が表現できなくなる。
//
// ★FE はキャラ選択時に 1 回取得する(§4.6-3)。入力ごとに呼ばない。取得に失敗しても
// モードに入れないだけで、既存の入力経路は今までどおり動く(§4.6-6)。
type MotionCommandsResponse struct {
	CharacterID int64              `json:"characterId"`
	Commands    []MotionCommandDTO `json:"commands"`
}

// Handler は段階2 解決 API のハンドラ集合。
type Handler struct {
	service resolvesvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service resolvesvc.Service) *Handler {
	return &Handler{service: service}
}

// CommandIndex は GET /api/characters/:characterId/command-index を処理する。
func (h *Handler) CommandIndex(c echo.Context) error {
	raw := c.Param("characterId")
	characterID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || characterID <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_id", "characterId must be a positive integer"))
	}

	entries, err := h.service.CommandIndex(c.Request().Context(), characterID)
	if err != nil {
		if errors.Is(err, resolvesvc.ErrInvalidCharacterID) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_id", err.Error()))
		}
		slog.ErrorContext(c.Request().Context(), "command index", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, CommandIndexResponse{CharacterID: characterID, Entries: entries})
}

// MotionCommands は GET /api/characters/:characterId/motion-commands を処理する(M21-06 §4.6)。
//
// ★CommandIndex と同じ 400 / 500 の扱いに揃えてある。未 seed キャラは 200 ＋ 空配列で、
// 「壊れない」流儀(DES-005 §6.4)を踏襲する。
func (h *Handler) MotionCommands(c echo.Context) error {
	raw := c.Param("characterId")
	characterID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || characterID <= 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_id", "characterId must be a positive integer"))
	}

	commands, err := h.service.MotionCommands(c.Request().Context(), characterID)
	if err != nil {
		if errors.Is(err, resolvesvc.ErrInvalidCharacterID) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_id", err.Error()))
		}
		slog.ErrorContext(c.Request().Context(), "motion commands", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	// ★空でも null ではなく [] を返す(FE が length を見るため)。
	dto := make([]MotionCommandDTO, 0, len(commands))
	for _, cmd := range commands {
		dto = append(dto, MotionCommandDTO{TokenKey: cmd.TokenKey, MoveCode: cmd.MoveCode})
	}
	return c.JSON(http.StatusOK, MotionCommandsResponse{CharacterID: characterID, Commands: dto})
}
