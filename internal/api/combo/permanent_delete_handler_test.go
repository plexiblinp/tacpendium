package combo_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// ===========================================================================
// DELETE /api/combos/:id/permanent
// ===========================================================================

func TestHandler_PermanentDelete_204(t *testing.T) {
	svc := &mockService{
		permanentDeleteFn: func(ctx context.Context, id int64) error {
			if id != 99 {
				t.Errorf("unexpected id: %d", id)
			}
			return nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/99/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_PermanentDelete_404(t *testing.T) {
	svc := &mockService{
		permanentDeleteFn: func(ctx context.Context, id int64) error {
			return combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/999/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_PermanentDelete_409_NotInTrash(t *testing.T) {
	svc := &mockService{
		permanentDeleteFn: func(ctx context.Context, id int64) error {
			return combosvc.ErrComboNotInTrash
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/1/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_PermanentDelete_400_InvalidID(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/abc/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
}
