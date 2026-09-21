package combo_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

func TestHandler_CheckDuplicate_200_NoDuplicates(t *testing.T) {
	svc := &mockService{
		checkDuplicateFn: func(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			return &combosvc.CheckDuplicateResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"starterMoveId":12,"position":"mid_screen","opponentStance":"standing","hitType":"normal","opponentSize":"standard","steps":[{"stepOrder":1,"moveId":12}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.CheckDuplicateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Duplicates) != 0 {
		t.Errorf("duplicates = %d, want 0", len(resp.Duplicates))
	}
}

func TestHandler_CheckDuplicate_200_WithDuplicates(t *testing.T) {
	pos := "mid_screen"
	stance := "standing"
	ht := "normal"
	sz := "standard"
	starterID := int64(12)

	svc := &mockService{
		checkDuplicateFn: func(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			return &combosvc.CheckDuplicateResult{
				Duplicates: []combosvc.DuplicateInfo{{
					ID:             17,
					CharacterID:    1,
					StarterMoveID:  &starterID,
					Position:       &pos,
					OpponentStance: &stance,
					HitType:        &ht,
					OpponentSize:   &sz,
					StepCount:      5,
				}},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.CheckDuplicateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Duplicates) != 1 {
		t.Fatalf("duplicates count = %d, want 1", len(resp.Duplicates))
	}
	d := resp.Duplicates[0]
	if d.ID != 17 {
		t.Errorf("ID = %d, want 17", d.ID)
	}
	if d.CharacterID != 1 {
		t.Errorf("CharacterID = %d, want 1", d.CharacterID)
	}
	if d.StepCount != 5 {
		t.Errorf("StepCount = %d, want 5", d.StepCount)
	}
	if d.StarterMoveID == nil || *d.StarterMoveID != 12 {
		t.Errorf("StarterMoveID = %v, want 12", d.StarterMoveID)
	}
	if d.Position == nil || *d.Position != "mid_screen" {
		t.Errorf("Position = %v, want mid_screen", d.Position)
	}
	if d.OpponentStance == nil || *d.OpponentStance != "standing" {
		t.Errorf("OpponentStance = %v, want standing", d.OpponentStance)
	}
	if d.HitType == nil || *d.HitType != "normal" {
		t.Errorf("HitType = %v, want normal", d.HitType)
	}
	if d.OpponentSize == nil || *d.OpponentSize != "standard" {
		t.Errorf("OpponentSize = %v, want standard", d.OpponentSize)
	}
}

func TestHandler_CheckDuplicate_200_ExcludeComboId(t *testing.T) {
	svc := &mockService{
		checkDuplicateFn: func(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			if input.ExcludeComboID == nil || *input.ExcludeComboID != 42 {
				t.Errorf("excludeComboId = %v, want ptr(42)", input.ExcludeComboID)
			}
			return &combosvc.CheckDuplicateResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[],"excludeComboId":42}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestHandler_CheckDuplicate_400_MissingCharacterId(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	body := `{"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_CheckDuplicate_400_InvalidJSON(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	body := `{invalid`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandler_CheckDuplicate_500_ServiceError(t *testing.T) {
	svc := &mockService{
		checkDuplicateFn: func(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			return nil, errors.New("db error")
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body=%s", rec.Code, rec.Body.String())
	}
}
