package combo_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

func TestHandler_Materialize_200_Generated(t *testing.T) {
	svc := &mockService{
		materializeFn: func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			if input.BaseComboID != 7 || input.OpponentMoveID != 33 {
				t.Errorf("unexpected input: %+v", input)
			}
			return &combosvc.MaterializeResult{ComboID: 88, DamageAdded: true}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/7/materialize", strings.NewReader(`{"opponentMoveId":33}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.MaterializeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ComboID != 88 || !resp.DamageAdded {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestHandler_Materialize_200_AlreadyExisted(t *testing.T) {
	svc := &mockService{
		materializeFn: func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			return &combosvc.MaterializeResult{ComboID: 5, AlreadyExisted: true}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/7/materialize", strings.NewReader(`{"opponentMoveId":33}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	// 既存ありでもエラーにせず 200(FE は alreadyExisted で分岐)。
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.MaterializeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.AlreadyExisted || resp.ComboID != 5 {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestHandler_Materialize_400_MissingOpponentMoveID(t *testing.T) {
	svc := &mockService{
		materializeFn: func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			t.Fatal("service should not be called when opponentMoveId is missing")
			return nil, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/7/materialize", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Materialize_400_IneligibleHitType(t *testing.T) {
	svc := &mockService{
		materializeFn: func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrMaterializeIneligibleHitType
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/7/materialize", strings.NewReader(`{"opponentMoveId":33}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	// UI が理由を表示できる専用コードを添える。
	if !strings.Contains(rec.Body.String(), "hit_type_not_materializable") {
		t.Errorf("expected reason code hit_type_not_materializable; body=%s", rec.Body.String())
	}
}

func TestHandler_Materialize_404_NotFound(t *testing.T) {
	svc := &mockService{
		materializeFn: func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/7/materialize", strings.NewReader(`{"opponentMoveId":33}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

// ★★M31-01 レビュー(中): materialize の 400 validation_failed をハンドラ層で固定する。
//
//	サービスが ValidationResult を返したとき、ハンドラが 400 へ落とし、
//	details.validations を載せることを主張する(POST /api/combos と同型)。
func TestHandler_Materialize_400_ValidationFailed(t *testing.T) {
	svc := &mockService{
		materializeFn: func(context.Context, combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
			var r validation.ValidationResult
			r.AddError(validation.CodeC15RequiredField, "damage", "ダメージは本登録では必須です")
			// ★★生成していないので第 1 戻り値は nil。ハンドラが result を参照すると
			//   nil 参照で落ちる ⇒ vres の判定が先に来ていることを本テストが守る。
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/5/materialize",
		strings.NewReader(`{"opponentMoveId":1}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	errObj, _ := body["error"].(map[string]any)
	if errObj["code"] != "validation_failed" {
		t.Errorf("code = %v, want validation_failed (body=%s)", errObj["code"], rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "VAL-C15") {
		t.Errorf("details.validations に VAL-C15 が載っていない: %s", rec.Body.String())
	}
}
