package intake

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/service/comboio/csvcore"
	intakesvc "github.com/plexiblinp/tacpendium/internal/service/intake"
)

// resolver は照合サービスの IF(テスト差し替え用)。
type resolver interface {
	Resolve(ctx context.Context, characterCode, text string) (*intakesvc.ResolveResult, error)
}

// Handler は「他から引っ越し」API のハンドラ集合。
type Handler struct {
	service resolver
}

// NewHandler は Handler を構築する。
func NewHandler(service resolver) *Handler {
	return &Handler{service: service}
}

// Resolve は POST /api/intake/resolve を処理する。
// characterCode 必須(空は 400)。未投入キャラ・キャラ不明は 200＋全行未解決(エラーにしない)。
func (h *Handler) Resolve(c echo.Context) error {
	var req resolveRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエストの形式が不正です"))
	}
	if strings.TrimSpace(req.CharacterCode) == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_code", "characterCode は必須です"))
	}

	result, err := h.service.Resolve(c.Request().Context(), req.CharacterCode, req.Text)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "intake resolve", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, toResolveResponse(result))
}

// BuildCSV は POST /api/intake/csv を処理する。解決済みコンボ群から combos.csv を生成する。
// csvcore.ExportCSV を再利用し、列順・recipe JSON をエンジンに委ねて CSV 契約(DES-002 §7.6)を守る。
func (h *Handler) BuildCSV(c echo.Context) error {
	var req buildCSVRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエストの形式が不正です"))
	}
	if strings.TrimSpace(req.CharacterCode) == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_character_code", "characterCode は必須です"))
	}
	if len(req.Combos) == 0 {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("empty_combos", "取込対象のコンボがありません"))
	}

	combos := make([]csvcore.Combo, 0, len(req.Combos))
	for i, cb := range req.Combos {
		if len(cb.Steps) == 0 {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("empty_steps", "ステップの無いコンボは取り込めません"))
		}
		steps := make([]csvcore.Step, 0, len(cb.Steps))
		for _, st := range cb.Steps {
			// 未解決(空 move_code)は取込 CSV へ載せない(決定論・不完全は通さない)。
			// FE は解決済みだけを送るため通常は起きないが、契約として BE でも拒否する。
			if strings.TrimSpace(st.MoveCode) == "" {
				return c.JSON(http.StatusBadRequest, model.NewAPIError("unresolved_step", "未解決のステップが含まれています"))
			}
			steps = append(steps, csvcore.Step{MoveCode: st.MoveCode})
		}
		combos = append(combos, csvcore.Combo{
			LocalID:       fmt.Sprintf("intake-%d", i+1),
			CharacterCode: req.CharacterCode,
			IsDraft:       cb.IsDraft,
			Memo:          cb.Memo,
			Steps:         steps,
		})
	}

	csvText, err := csvcore.ExportCSV(combos)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "intake build csv", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "CSV の生成に失敗しました"))
	}

	return c.JSON(http.StatusOK, buildCSVResponse{CSVText: csvText})
}

// toResolveResponse はサービス結果を API DTO へ変換する。
func toResolveResponse(r *intakesvc.ResolveResult) resolveResponse {
	combos := make([]resolvedComboDTO, 0, len(r.Combos))
	for _, cb := range r.Combos {
		steps := make([]resolvedStepDTO, 0, len(cb.Steps))
		for _, st := range cb.Steps {
			candidates := st.Candidates
			if candidates == nil {
				candidates = []string{}
			}
			steps = append(steps, resolvedStepDTO{
				StepOrder:     st.StepOrder,
				RawText:       st.RawText,
				Tokens:        st.Tokens,
				NameCandidate: st.NameCandidate,
				Confidence:    st.Confidence,
				Note:          st.Note,
				MoveCode:      st.MoveCode,
				Resolved:      st.Resolved,
				ResolvedVia:   st.ResolvedVia,
				Candidates:    candidates,
			})
		}
		combos = append(combos, resolvedComboDTO{ComboIndex: cb.ComboIndex, Steps: steps})
	}
	return resolveResponse{
		CharacterCode:  r.CharacterCode,
		MovesAvailable: r.MovesAvailable,
		Combos:         combos,
		Summary: resolveSummaryDTO{
			TotalSteps: r.Summary.TotalSteps,
			Resolved:   r.Summary.Resolved,
			Unresolved: r.Summary.Unresolved,
		},
	}
}
