// Package setplay(api) はセットプレイ自動提案エンドポイント(M19-01)のハンドラを提供する。
package setplay

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"
)

// Handler はセットプレイ提案 API のハンドラ。
type Handler struct {
	service setplaysvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(service setplaysvc.Service) *Handler {
	return &Handler{service: service}
}

// GetSuggestions は GET /api/combos/:comboId/setplay-suggestions を処理する。
//
//	?n_min=1              // 省略時 1(gap モードでは無視)
//	&n_max=5              // 任意。meaty のみ。N の上限(持続の長い技で深い N を除外)
//	&sort=n|target        // 省略時 n(meaty=N 降順 / gap=G 昇順)
//	&target_move_id=123   // 任意。指定時はその技のみを target とする
//	&mode=meaty|gap       // 省略時 meaty(既存挙動・後方互換)
//	&g_min=1&g_max=13     // gap のときのみ。省略時 1〜13。範囲外は丸める
//	&limit=200            // 返却件数の上限。省略時既定・上限超過は丸める
//
// 副作用なし(非永続)。KA が NULL のコンボは 400 系(code=knockdown_advantage_required)。
// KA が負のコンボは 200 + reason=knockdown_advantage_negative + items 空(§4.2)。
func (h *Handler) GetSuggestions(c echo.Context) error {
	comboID, err := parseIDParam(c, "comboId")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_combo_id", "コンボ ID が不正です"))
	}

	var params setplaysvc.SuggestParams

	if v := c.QueryParam("n_min"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "n_min は整数"))
		}
		params.NMin = n
	}

	switch setplaysvc.SuggestSort(c.QueryParam("sort")) {
	case "", setplaysvc.SortByN:
		params.Sort = setplaysvc.SortByN
	case setplaysvc.SortByTarget:
		params.Sort = setplaysvc.SortByTarget
	default:
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "sort は n または target"))
	}

	// target_types: カンマ区切り。省略時は既定(通常技・特殊技・必殺技(弾))。
	if v := c.QueryParam("target_types"); v != "" {
		params.TargetTypes = splitCSV(v)
	} else {
		params.TargetTypes = defaultTargetTypes()
	}

	if v := c.QueryParam("include_zero_damage"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "include_zero_damage は真偽値"))
		}
		params.IncludeZeroDamage = b
	}

	if v := c.QueryParam("target_move_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "target_move_id は正の整数"))
		}
		params.TargetMoveID = &id
	}

	// mode: 省略時 meaty(後方互換)。それ以外の未知値は 400。
	switch v := c.QueryParam("mode"); v {
	case "", setplaysvc.ModeMeaty:
		params.Mode = setplaysvc.ModeMeaty
	case setplaysvc.ModeGap:
		params.Mode = setplaysvc.ModeGap
	default:
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", "mode は meaty または gap"))
	}

	// g_min / g_max / limit: 整数のみ検査し、範囲丸めはサービス側(絞り込み設定＝不正入力ではない)。
	for _, p := range []struct {
		key string
		dst *int
	}{
		{"n_max", &params.NMax},
		{"g_min", &params.GMin},
		{"g_max", &params.GMax},
		{"limit", &params.Limit},
	} {
		if v := c.QueryParam(p.key); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil {
				return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_parameter", p.key+" は整数"))
			}
			*p.dst = n
		}
	}

	res, err := h.service.SuggestForCombo(c.Request().Context(), comboID, params)
	if err != nil {
		switch {
		case errors.Is(err, setplaysvc.ErrComboNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		case errors.Is(err, setplaysvc.ErrKnockdownNotSet):
			// UI はこの code を見て「有利フレーム未入力のため提案できません」と表示する。
			return c.JSON(http.StatusBadRequest, model.NewAPIError("knockdown_advantage_required", "有利フレーム未入力のため提案できません"))
		default:
			slog.ErrorContext(c.Request().Context(), "get setplay suggestions", slog.String("err", err.Error()))
			return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "提案取得中にサーバーエラーが発生しました"))
		}
	}

	return c.JSON(http.StatusOK, toResponse(res))
}

// defaultTargetTypes は target_types 省略時の既定(通常技・特殊技・必殺技(弾))。
func defaultTargetTypes() []string {
	return []string{
		setplaysvc.TargetTypeNormal,
		setplaysvc.TargetTypeUnique,
		setplaysvc.TargetTypeSpecialProjectile,
	}
}

// splitCSV はカンマ区切り文字列を trim 済み・空要素除去のスライスにする。
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

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
