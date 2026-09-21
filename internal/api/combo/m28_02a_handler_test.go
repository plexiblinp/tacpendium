package combo_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M28-02a: FR702 の API 面(§2.6)。
// ★経路の中身(判定そのもの)は service 層のテストが持つ。ここは入口の形だけを見る。

// TestList_AffectedByGameUpdateFilter は一覧の絞り込みが既存の形に揃っていることを固定する。
func TestList_AffectedByGameUpdateFilter(t *testing.T) {
	cases := []struct {
		name     string
		query    string
		wantCode int
		wantSet  bool
		wantVal  bool
	}{
		{"true", "?affected_by_game_update=true", http.StatusOK, true, true},
		{"false", "?affected_by_game_update=false", http.StatusOK, true, false},
		{"省略", "", http.StatusOK, false, false},
		// ★値域外は 400。「絞り込まない」に倒すと typo が全件返却に見える
		//   (setup_in_corner と同じ扱い)。
		{"値域外", "?affected_by_game_update=maybe", http.StatusBadRequest, false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got *bool
			svc := &mockService{
				listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
					got = filter.AffectedByGameUpdate
					return []*model.Combo{}, nil
				},
			}
			e := newTestServer(t, svc)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/combos"+tc.query, nil))

			if rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d (body=%s)", rec.Code, tc.wantCode, rec.Body.String())
			}
			if tc.wantCode != http.StatusOK {
				return
			}
			if !tc.wantSet {
				if got != nil {
					t.Errorf("絞り込みが設定された(want nil): %v", *got)
				}
				return
			}
			if got == nil {
				t.Fatal("絞り込みが設定されていない")
			}
			if *got != tc.wantVal {
				t.Errorf("filter = %v, want %v", *got, tc.wantVal)
			}
		})
	}
}

// TestComboResponse_CarriesGameUpdateFields は応答に FR702 の 2 欄が載ることを固定する。
//
// ★JSON は camelCase(CLAUDE.md §4)。
// ★affectedByGameUpdate は false でもキーが出ること —— omitempty を付けると
//
//	「影響なし」と「判定していない」が区別できなくなる。
func TestComboResponse_CarriesGameUpdateFields(t *testing.T) {
	baseline := "2026.08.03.01"
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{
				ID:                   id,
				CharacterID:          1,
				BaselineVersion:      &baseline,
				AffectedByGameUpdate: false,
			}, nil
		},
	}
	e := newTestServer(t, svc)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/combos/1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got := body["baselineVersion"]; got != baseline {
		t.Errorf("baselineVersion = %v, want %q", got, baseline)
	}
	v, ok := body["affectedByGameUpdate"]
	if !ok {
		t.Error("★affectedByGameUpdate のキーが出ていない(false でも出すこと)")
	}
	if v != false {
		t.Errorf("affectedByGameUpdate = %v, want false", v)
	}
}

// TestAcknowledgeGameVersion_Route は「確認した」の経路が生えていることを固定する。
func TestAcknowledgeGameVersion_Route(t *testing.T) {
	called := int64(0)
	svc := &mockService{
		acknowledgeGameVersionFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			called = id
			return &model.Combo{ID: id}, nil
		},
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1}, nil
		},
	}
	e := newTestServer(t, svc)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/combos/42/acknowledge-version", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	if called != 42 {
		t.Errorf("サービスへ渡った id = %d, want 42", called)
	}

	// 不正な id は 400。
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/combos/abc/acknowledge-version", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("不正な id の status = %d, want 400", rec.Code)
	}

	// 存在しない id は 404。
	svc.acknowledgeGameVersionFn = func(ctx context.Context, id int64) (*model.Combo, error) {
		return nil, combosvc.ErrNotFound
	}
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/combos/999/acknowledge-version", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("存在しない id の status = %d, want 404", rec.Code)
	}
}
