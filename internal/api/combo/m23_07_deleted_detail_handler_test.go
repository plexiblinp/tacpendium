package combo_test

// ★M23-07 §4.2-2: GET /api/combos/:id/deleted(ゴミ箱の読み取り専用詳細)のハンドラ層。
//
// ★本ファイルが守るのは「別の入口であること」である。mockService の
// getDeletedFn と getFn は別のフィールドであり、片方だけ設定したテストは
// もう片方の経路に落ちたら失敗する——経路を取り違えた実装が黙って通らない。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

func TestHandler_GetDeleted_200(t *testing.T) {
	deletedAt := time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC)
	svc := &mockService{
		getDeletedFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{
				ID:            id,
				CharacterID:   1,
				Version:       1,
				Steps:         []model.ComboStep{},
				DeletedAt:     &deletedAt,
				DefaultRecipe: "弱P > 弱K",
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42/deleted", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.ID != 42 {
		t.Errorf("ID = %d, want 42", resp.ID)
	}
	if resp.DeletedAt == nil {
		t.Error("deletedAt が応答に無い。ゴミ箱の行であることが画面から判定できない")
	}
	// ★§4.2-4: 削除済み行の recipe_cache は NULL だが、レシピは combo_steps から
	// 組み立てて応答に載る(サービス層が埋める)。
	if resp.DefaultRecipe != "弱P > 弱K" {
		t.Errorf("defaultRecipe = %q, want 非空(完全削除の前に中身を確認できない)", resp.DefaultRecipe)
	}
	// ★§4.2-5: セットプレイは載せない(単独の詳細という概念が無い)。
	if len(resp.Setups) != 0 {
		t.Errorf("setups = %d 件, want 0(読み取り専用詳細はセットプレイを載せない)", len(resp.Setups))
	}
}

func TestHandler_GetDeleted_404(t *testing.T) {
	svc := &mockService{
		getDeletedFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return nil, combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/999/deleted", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestHandler_GetDeleted_400_InvalidID(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/abc/deleted", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ★別の入口であることの確認。GET /api/combos/:id は getFn を通り、
// GET /api/combos/:id/deleted は getDeletedFn を通る。
// 片方の実装をもう片方へ寄せると、ここが赤くなる。
func TestHandler_GetDeleted_UsesSeparateServicePath(t *testing.T) {
	var getCalls, getDeletedCalls int
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			getCalls++
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
		getDeletedFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			getDeletedCalls++
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
	}
	e := newTestServer(t, svc)

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/combos/7/deleted", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if getDeletedCalls != 1 {
		t.Errorf("GetDeleted 呼出 = %d 回, want 1", getDeletedCalls)
	}
	if getCalls != 0 {
		t.Errorf("Get 呼出 = %d 回, want 0(読み取り専用詳細が通常詳細の経路へ落ちている)", getCalls)
	}
}
