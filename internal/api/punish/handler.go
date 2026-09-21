// Package punish は確定反撃サーチ(M18-02)の HTTP ハンドラ層である。
//
// handler は薄く保ち(パラメータ検証と JSON 変換のみ)、走査規則はサービス層
// (service/punishfinder)に一元化する(inputresolve と同型・DES-002 §4.2)。
package punish

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	punishfinder "github.com/plexiblinp/tacpendium/internal/service/punishfinder"
	punishlist "github.com/plexiblinp/tacpendium/internal/service/punishlist"
)

// Handler は確定反撃サーチ(探す・M18-02)とマイリスト(使う・M18-03a)の API ハンドラ集合。
//
// 探す＝走査 / 使う＝取得 の非対称に合わせてサービスも 2 本に分かれる。handler は薄いまま、
// どちらへ委譲するかだけを担う。
type Handler struct {
	service punishfinder.Service
	list    punishlist.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service punishfinder.Service, list punishlist.Service) *Handler {
	return &Handler{service: service, list: list}
}

func badRequest(c echo.Context, code, msg string) error {
	return c.JSON(http.StatusBadRequest, model.NewAPIError(code, msg))
}

func internalError(c echo.Context, where string, err error) error {
	slog.ErrorContext(c.Request().Context(), where, slog.String("err", err.Error()))
	return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
}

func parsePositive(raw string) (int64, bool) {
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}

// PunishFinder は GET /api/punish-finder を処理する。
// 未 seed・不存在の(有効な)ID は 200＋空ツリー。不正な guard_type や非正の ID は 400。
func (h *Handler) PunishFinder(c echo.Context) error {
	self, ok1 := parsePositive(c.QueryParam("self_character_id"))
	opp, ok2 := parsePositive(c.QueryParam("opponent_character_id"))
	if !ok1 || !ok2 {
		return badRequest(c, "invalid_character_id", "self_character_id と opponent_character_id は正の整数で指定してください")
	}
	guard := c.QueryParam("guard_type")

	tree, err := h.service.Scan(c.Request().Context(), punishfinder.ScanParams{
		SelfCharacterID:     self,
		OpponentCharacterID: opp,
		GuardType:           guard,
	})
	if err != nil {
		if errors.Is(err, punishfinder.ErrInvalidGuardType) {
			return badRequest(c, "invalid_guard_type", err.Error())
		}
		return internalError(c, "punish finder scan", err)
	}
	return c.JSON(http.StatusOK, tree)
}

// CreateStarter は POST /api/combo-punish-starters を処理する(始動技の検証結果を登録/更新)。
func (h *Handler) CreateStarter(c echo.Context) error {
	var req StarterVerdictRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.SelfCharacterID <= 0 || req.OpponentMoveID <= 0 || req.StarterMoveID <= 0 {
		return badRequest(c, "invalid_id", "selfCharacterId / opponentMoveId / starterMoveId は正の整数で指定してください")
	}
	if err := h.service.SetStarterVerdict(c.Request().Context(), req.SelfCharacterID, req.OpponentMoveID, req.StarterMoveID, req.Verdict, req.Note); err != nil {
		if errors.Is(err, punishfinder.ErrInvalidVerdict) {
			return badRequest(c, "invalid_verdict", err.Error())
		}
		return internalError(c, "create starter", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// DeleteStarter は DELETE /api/combo-punish-starters を処理する(検証結果の解除)。
func (h *Handler) DeleteStarter(c echo.Context) error {
	var req StarterVerdictRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.SelfCharacterID <= 0 || req.OpponentMoveID <= 0 || req.StarterMoveID <= 0 {
		return badRequest(c, "invalid_id", "selfCharacterId / opponentMoveId / starterMoveId は正の整数で指定してください")
	}
	if err := h.service.DeleteStarterVerdict(c.Request().Context(), req.SelfCharacterID, req.OpponentMoveID, req.StarterMoveID); err != nil {
		return internalError(c, "delete starter", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// CreatePunish は POST /api/combo-punishes を処理する(コンボ採用の登録)。
func (h *Handler) CreatePunish(c echo.Context) error {
	var req PunishRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.ComboID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "comboId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.service.AddPunish(c.Request().Context(), req.ComboID, req.OpponentMoveID, req.Note); err != nil {
		return internalError(c, "create punish", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// DeletePunish は DELETE /api/combo-punishes を処理する(コンボ採用の解除)。
func (h *Handler) DeletePunish(c echo.Context) error {
	var req PunishRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.ComboID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "comboId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.service.RemovePunish(c.Request().Context(), req.ComboID, req.OpponentMoveID); err != nil {
		return internalError(c, "delete punish", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// PunishList は GET /api/punish-list を処理する(確定反撃マイリスト＋隠したもの一覧)。
//
// query: self(必須)/ opp(任意・全相手キャラなら省略)/ guard(既定 just_parry)。副作用なし。
// 未 seed・不存在の(有効な)ID は 200＋空(404/500 にしない)。
func (h *Handler) PunishList(c echo.Context) error {
	self, ok := parsePositive(c.QueryParam("self"))
	if !ok {
		return badRequest(c, "invalid_character_id", "self は正の整数で指定してください")
	}
	var opp *int64
	if raw := c.QueryParam("opp"); raw != "" {
		v, ok := parsePositive(raw)
		if !ok {
			return badRequest(c, "invalid_character_id", "opp は正の整数で指定してください")
		}
		opp = &v
	}
	guard := c.QueryParam("guard")
	if guard == "" {
		guard = model.PunishGuardTypeJustParry // 既定＝ジャストパリィ(探す画面と一貫)
	}

	list, err := h.list.List(c.Request().Context(), punishlist.ListParams{
		SelfCharacterID:     self,
		OpponentCharacterID: opp,
		GuardType:           guard,
	})
	if err != nil {
		if errors.Is(err, punishlist.ErrInvalidGuardType) {
			return badRequest(c, "invalid_guard_type", err.Error())
		}
		return internalError(c, "punish list", err)
	}
	return c.JSON(http.StatusOK, list)
}

// CreateCuration は POST /api/combo-punish-curations を処理する(使わない反撃の登録)。
func (h *Handler) CreateCuration(c echo.Context) error {
	var req CurationRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.ComboID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "comboId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.list.AddCuration(c.Request().Context(), req.ComboID, req.OpponentMoveID, req.Note); err != nil {
		return internalError(c, "create curation", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// DeleteCuration は DELETE /api/combo-punish-curations を処理する(解除)。
// キー項目をボディで受ける(M18-02 で確立した DELETE の実装形)。
func (h *Handler) DeleteCuration(c echo.Context) error {
	var req CurationRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.ComboID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "comboId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.list.RemoveCuration(c.Request().Context(), req.ComboID, req.OpponentMoveID); err != nil {
		return internalError(c, "delete curation", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// CreatePruning は POST /api/combo-punish-prunings を処理する(pruning の登録)。
func (h *Handler) CreatePruning(c echo.Context) error {
	var req PruningRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.SelfCharacterID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "selfCharacterId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.service.AddPruning(c.Request().Context(), req.SelfCharacterID, req.OpponentMoveID, req.Note); err != nil {
		return internalError(c, "create pruning", err)
	}
	return c.NoContent(http.StatusNoContent)
}

// DeletePruning は DELETE /api/combo-punish-prunings を処理する(pruning の解除)。
func (h *Handler) DeletePruning(c echo.Context) error {
	var req PruningRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "invalid_body", "リクエストボディが不正です")
	}
	if req.SelfCharacterID <= 0 || req.OpponentMoveID <= 0 {
		return badRequest(c, "invalid_id", "selfCharacterId / opponentMoveId は正の整数で指定してください")
	}
	if err := h.service.RemovePruning(c.Request().Context(), req.SelfCharacterID, req.OpponentMoveID); err != nil {
		return internalError(c, "delete pruning", err)
	}
	return c.NoContent(http.StatusNoContent)
}
