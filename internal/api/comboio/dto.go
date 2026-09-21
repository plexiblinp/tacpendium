package comboio

import (
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

// ── preview レスポンス(camelCase。サービス層 DTO を API 形へ変換)──────────

type previewResponse struct {
	Combos         []comboPreviewRowDTO `json:"combos"`
	Setups         []setupPreviewRowDTO `json:"setups"`
	ComboFileError string               `json:"comboFileError,omitempty"`
	SetupFileError string               `json:"setupFileError,omitempty"`
	Summary        previewSummaryDTO    `json:"summary"`
}

type comboPreviewRowDTO struct {
	RowNumber        int      `json:"rowNumber"`
	LocalID          string   `json:"localId"`
	CharacterCode    string   `json:"characterCode"`
	StarterMoveCode  string   `json:"starterMoveCode"`
	IsDraft          bool     `json:"isDraft"`
	StepCount        int      `json:"stepCount"`
	Duplicate        bool     `json:"duplicate"`
	DuplicateComboID *int64   `json:"duplicateComboId,omitempty"`
	Warnings         []string `json:"warnings"`
	Errors           []string `json:"errors"`
	Importable       bool     `json:"importable"`
}

type setupPreviewRowDTO struct {
	RowNumber          int      `json:"rowNumber"`
	ParentComboLocalID string   `json:"parentComboLocalId"`
	Name               string   `json:"name"`
	StepCount          int      `json:"stepCount"`
	ParentResolvable   bool     `json:"parentResolvable"`
	Warnings           []string `json:"warnings"`
	Errors             []string `json:"errors"`
	Importable         bool     `json:"importable"`
}

type previewSummaryDTO struct {
	ComboTotal   int `json:"comboTotal"`
	ComboOK      int `json:"comboOk"`
	ComboWarning int `json:"comboWarning"`
	ComboError   int `json:"comboError"`
	SetupTotal   int `json:"setupTotal"`
}

func toPreviewResponse(r *comboiosvc.PreviewResult) previewResponse {
	out := previewResponse{
		Combos:         make([]comboPreviewRowDTO, len(r.Combos)),
		Setups:         make([]setupPreviewRowDTO, len(r.Setups)),
		ComboFileError: r.ComboFileError,
		SetupFileError: r.SetupFileError,
		Summary: previewSummaryDTO{
			ComboTotal:   r.Summary.ComboTotal,
			ComboOK:      r.Summary.ComboOK,
			ComboWarning: r.Summary.ComboWarning,
			ComboError:   r.Summary.ComboError,
			SetupTotal:   r.Summary.SetupTotal,
		},
	}
	for i, c := range r.Combos {
		out.Combos[i] = comboPreviewRowDTO{
			RowNumber:        c.RowNumber,
			LocalID:          c.LocalID,
			CharacterCode:    c.CharacterCode,
			StarterMoveCode:  c.StarterMoveCode,
			IsDraft:          c.IsDraft,
			StepCount:        c.StepCount,
			Duplicate:        c.Duplicate,
			DuplicateComboID: c.DuplicateComboID,
			Warnings:         orEmpty(c.Warnings),
			Errors:           orEmpty(c.Errors),
			Importable:       c.Importable,
		}
	}
	for i, st := range r.Setups {
		out.Setups[i] = setupPreviewRowDTO{
			RowNumber:          st.RowNumber,
			ParentComboLocalID: st.ParentComboLocalID,
			Name:               st.Name,
			StepCount:          st.StepCount,
			ParentResolvable:   st.ParentResolvable,
			Warnings:           orEmpty(st.Warnings),
			Errors:             orEmpty(st.Errors),
			Importable:         st.Importable,
		}
	}
	return out
}

// ── commit レスポンス ────────────────────────────────────────────────

type commitResponse struct {
	Results []commitRowResultDTO `json:"results"`
	Summary commitSummaryDTO     `json:"summary"`
}

type commitRowResultDTO struct {
	Kind      string `json:"kind"`
	RowNumber int    `json:"rowNumber"`
	LocalID   string `json:"localId"`
	Status    string `json:"status"`
	Reason    string `json:"reason,omitempty"`
	ComboID   *int64 `json:"comboId,omitempty"`
}

type commitSummaryDTO struct {
	Success int `json:"success"`
	Skipped int `json:"skipped"`
	Failed  int `json:"failed"`
}

func toCommitResponse(r *comboiosvc.CommitResult) commitResponse {
	out := commitResponse{Results: make([]commitRowResultDTO, len(r.Rows))}
	for i, row := range r.Rows {
		out.Results[i] = commitRowResultDTO{
			Kind:      row.Kind,
			RowNumber: row.RowNumber,
			LocalID:   row.LocalID,
			Status:    row.Status,
			Reason:    row.Reason,
			ComboID:   row.ComboID,
		}
	}
	out.Summary = commitSummaryDTO{
		Success: r.Summary.Success,
		Skipped: r.Summary.Skipped,
		Failed:  r.Summary.Failed,
	}
	return out
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
