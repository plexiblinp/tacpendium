package combo_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// M24-11 §4.3.1 / CHANGE-136: SQLITE_BUSY の応答が、重複エラー(400)とも
// 版不一致(409)とも区別されることを固定する。
//
// ★★3 つを 1 本のテストで並べているのは意図である———————————————————
// 「503 が返ること」だけを主張しても、区別されていることの証明にはならない。
// 3 つの入口が 3 つの別々のステータス・コードへ落ちることを 1 か所で見て初めて、
// DES-006 §11.2 の「見分けはエラーコードで行う」が成立していると言える。
// ★片方だけを固定すると、まとめて 1 つに畳んでも緑のままになる。

const (
	wantDatabaseBusyCode   = "database_busy"
	wantValidationFailCode = "validation_failed"
)

// TestHandler_UpdateWithKeyChange_DistinguishesBusyFromDuplicateAndConflict は
// 3 つの応答を並べる。
//
// ★PUT を選んだのは、この 1 経路が 3 つすべてを返しうるためである。POST は版を
// 受け取らないため 409 を返す筋が無く、3 つを同じ入口で並べられない。
func TestHandler_UpdateWithKeyChange_DistinguishesBusyFromDuplicateAndConflict(t *testing.T) {
	dupResult := validation.ValidationResult{}
	dupResult.AddError(validation.CodeC02Duplicate, "",
		"同一キャラ・同一レシピ・同一状況のコンボが既に存在します(id=1)")

	tests := []struct {
		name       string
		fn         func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error)
		wantStatus int
		wantCode   string
	}{
		{
			name: "重複(VAL-C02)は 400 validation_failed",
			fn: func(context.Context, int64, int, combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, dupResult, nil
			},
			wantStatus: http.StatusBadRequest,
			wantCode:   wantValidationFailCode,
		},
		{
			name: "版不一致は 409 version_conflict",
			fn: func(context.Context, int64, int, combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, validation.ValidationResult{}, combosvc.ErrConflict
			},
			wantStatus: http.StatusConflict,
			wantCode:   wantVersionConflictCode,
		},
		{
			name: "write lock を取れないときは 503 database_busy",
			fn: func(context.Context, int64, int, combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				// ★実際の経路と同じく、ラップされた形で返す(errors.Is で辿れること)
				return nil, validation.ValidationResult{}, fmt.Errorf("begin tx: %w", combosvc.ErrDatabaseBusy)
			},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   wantDatabaseBusyCode,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newTestServer(t, &mockService{updateKFn: tt.fn})

			body := `{"version":1,"characterId":1,"isDraft":false,"steps":[{"stepOrder":1,"moveId":1}]}`
			req := httptest.NewRequest(http.MethodPut, "/api/combos/5", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			var resp model.APIErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if resp.Error.Code != tt.wantCode {
				t.Errorf("Error.Code = %q, want %q", resp.Error.Code, tt.wantCode)
			}
		})
	}
}

// TestErrorCodeDatabaseBusy_IsDistinctFromOtherCodes は、コード文字列そのものが
// 既存のどれとも衝突していないことを主張する。
//
// ★総称語(conflict / error)を避ける規約は internal/model/api_error.go が持っており、
// version_conflict については api_error_test.go が同型の検査を持っている。
func TestErrorCodeDatabaseBusy_IsDistinctFromOtherCodes(t *testing.T) {
	busy := model.ErrorCodeDatabaseBusy
	for _, other := range []string{
		model.ErrorCodeVersionConflict,
		model.ErrorCodeSetupInUse,
		model.ErrorCodeSetupNotInTrash,
		"validation_failed",
		"internal_error",
		"conflict",
	} {
		if busy == other {
			t.Errorf("database_busy が %q と同じ値になっている。区別が付かない", other)
		}
	}
	if busy != wantDatabaseBusyCode {
		t.Errorf("ErrorCodeDatabaseBusy = %q, want %q(web/src/constants/api-error.ts と同期)", busy, wantDatabaseBusyCode)
	}
}

// TestHandler_Create_And_Materialize_MapDatabaseBusy は、残り 2 経路でも
// ErrDatabaseBusy が 503 へ落ちることを固定する(レビュー指摘 低-2)。
//
// ★上の PUT のテストは「3 つが区別されること」を主張する。本テストは
// 「同じ翻訳が 3 経路すべてに掛かっていること」を主張する。役割が違う。
// ★errors.Is の分岐が switch の落穂(500 internal_error)より前に在ることを見ている——
// 位置を誤ると素通りして 500 になる。
func TestHandler_Create_And_Materialize_MapDatabaseBusy(t *testing.T) {
	busy := fmt.Errorf("begin tx: %w", combosvc.ErrDatabaseBusy)

	t.Run("POST /api/combos", func(t *testing.T) {
		e := newTestServer(t, &mockService{
			createFn: func(context.Context, combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, validation.ValidationResult{}, busy
			},
		})
		body := `{"characterId":1,"isDraft":false,"steps":[{"stepOrder":1,"moveId":1}]}`
		req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		assertDatabaseBusy(t, rec)
	})

	t.Run("POST /api/combos/:id/materialize", func(t *testing.T) {
		e := newTestServer(t, &mockService{
			materializeFn: func(context.Context, combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
				return nil, validation.ValidationResult{}, busy
			},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/combos/5/materialize",
			strings.NewReader(`{"opponentMoveId":1}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		assertDatabaseBusy(t, rec)
	})
}

func assertDatabaseBusy(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != wantDatabaseBusyCode {
		t.Errorf("Error.Code = %q, want %q", resp.Error.Code, wantDatabaseBusyCode)
	}
}
