package combo_test

// コンボ詳細への成立条件の同梱(M19-03 §4.3.1 の (a))と後方互換の検証(§5.2)。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

func setupRespFor(id int64, name string) *setupsvc.SetupResponse {
	return &setupsvc.SetupResponse{
		Setup: &model.Setup{
			ID: id, CharacterID: 1, Name: &name, StepCount: 2, Version: 1,
		},
		DefaultRecipe:  "立ち弱P > 弱波動拳",
		ParentComboIDs: []int64{42},
	}
}

func getComboDetail(t *testing.T, setupSvc *mockSetupService) *httptest.ResponseRecorder {
	t.Helper()
	comboSvc := &mockService{
		getFn: func(_ context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
	}
	e := newTestServerWithSetup(t, comboSvc, setupSvc)
	req := httptest.NewRequest(http.MethodGet, "/api/combos/42", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// 成立条件がセットプレイごとに振り分けられて同梱される。
func TestHandler_Get_200_IncludesSetupResults(t *testing.T) {
	note := "端では届かない"
	calls := 0
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{setupRespFor(10, "A"), setupRespFor(11, "B")}, nil
		},
		listResultsFn: func(_ context.Context, comboID int64) ([]model.ComboSetupResult, error) {
			calls++
			if comboID != 42 {
				t.Errorf("comboID = %d, want 42", comboID)
			}
			return []model.ComboSetupResult{
				{ComboID: 42, SetupID: 10, TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultOK},
				{ComboID: 42, SetupID: 10, TechType: model.OkiTechTypeBack, InCorner: true, Result: model.SetupResultNG, Note: &note},
				{ComboID: 42, SetupID: 11, TechType: model.OkiTechTypeNeutral, InCorner: true, Result: model.SetupResultOK},
			}, nil
		},
	}
	rec := getComboDetail(t, setupSvc)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	// ★N+1 になっていない: セットプレイ 2 本でも成立条件の取得は 1 回だけ。
	if calls != 1 {
		t.Errorf("ListResultsByComboID 呼び出し = %d 回, want 1(N+1 にしない)", calls)
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Setups) != 2 {
		t.Fatalf("Setups = %d 件, want 2", len(resp.Setups))
	}
	bySetupID := map[int64][]model.ComboSetupResult{}
	for _, s := range resp.Setups {
		bySetupID[s.ID] = s.Results
	}
	if len(bySetupID[10]) != 2 {
		t.Errorf("setup 10 の results = %d 件, want 2", len(bySetupID[10]))
	}
	if len(bySetupID[11]) != 1 {
		t.Errorf("setup 11 の results = %d 件, want 1", len(bySetupID[11]))
	}
	// 別セットプレイの結果が混ざらない。
	for _, r := range bySetupID[11] {
		if r.SetupID != 11 {
			t.Errorf("setup 11 に別 setup の結果が混入: %+v", r)
		}
	}
	// note と三値が伝わる。
	var foundNG bool
	for _, r := range bySetupID[10] {
		if r.Result == model.SetupResultNG {
			foundNG = true
			if r.Note == nil || *r.Note != note {
				t.Errorf("note が伝わっていない: %v", r.Note)
			}
		}
	}
	if !foundNG {
		t.Errorf("不成立(ng)のセルがレスポンスに現れない")
	}
}

// 全 4 セル未検証(結果 0 行)なら results キー自体が出ない(hidden-when-empty の前提)。
func TestHandler_Get_200_OmitsResultsWhenAllUnverified(t *testing.T) {
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{setupRespFor(10, "A")}, nil
		},
		listResultsFn: func(_ context.Context, _ int64) ([]model.ComboSetupResult, error) {
			return nil, nil
		},
	}
	rec := getComboDetail(t, setupSvc)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if strings.Contains(rec.Body.String(), `"results"`) {
		t.Errorf("未検証のみなのに results キーが出ている: %s", rec.Body.String())
	}
}

// 成立条件の取得に失敗しても、コンボ詳細自体は 200 で返る(表示欠落に留める)。
func TestHandler_Get_200_SetupResultsFailureIsNonBlocking(t *testing.T) {
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{setupRespFor(10, "A")}, nil
		},
		listResultsFn: func(_ context.Context, _ int64) ([]model.ComboSetupResult, error) {
			return nil, context.DeadlineExceeded
		},
	}
	rec := getComboDetail(t, setupSvc)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(成立条件の取得失敗は詳細をブロックしない)", rec.Code)
	}
	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Setups) != 1 {
		t.Errorf("Setups = %d 件, want 1(セットプレイ一覧は従来どおり返る)", len(resp.Setups))
	}
}

// ★後方互換: 既存フィールドの型・意味が不変で、成立条件は追加のみ(§2.3)。
func TestHandler_Get_200_SetupSummaryBackwardCompatible(t *testing.T) {
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{setupRespFor(10, "テストセットプレイ")}, nil
		},
		listResultsFn: func(_ context.Context, _ int64) ([]model.ComboSetupResult, error) {
			return []model.ComboSetupResult{
				{ComboID: 42, SetupID: 10, TechType: model.OkiTechTypeNeutral, InCorner: false, Result: model.SetupResultOK},
			}, nil
		},
	}
	rec := getComboDetail(t, setupSvc)

	var raw struct {
		Setups []map[string]any `json:"setups"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(raw.Setups) != 1 {
		t.Fatalf("setups = %d 件, want 1", len(raw.Setups))
	}
	s := raw.Setups[0]
	// 既存キーが従来の名前・型で存在する。
	for _, key := range []string{"id", "characterId", "name", "stepCount", "version", "defaultRecipe", "parentComboIds"} {
		if _, ok := s[key]; !ok {
			t.Errorf("既存キー %q が消えている: %v", key, s)
		}
	}
	if _, ok := s["id"].(float64); !ok {
		t.Errorf("id の型が変わっている: %T", s["id"])
	}
	if _, ok := s["defaultRecipe"].(string); !ok {
		t.Errorf("defaultRecipe の型が変わっている: %T", s["defaultRecipe"])
	}
	// 追加された results は配列で、各要素に comboId を含まない。
	results, ok := s["results"].([]any)
	if !ok {
		t.Fatalf("results が配列でない: %T", s["results"])
	}
	if len(results) != 1 {
		t.Fatalf("results = %d 件, want 1", len(results))
	}
	cell, _ := results[0].(map[string]any)
	for _, key := range []string{"setupId", "techType", "inCorner", "result"} {
		if _, ok := cell[key]; !ok {
			t.Errorf("results に %q が無い: %v", key, cell)
		}
	}
	if _, exists := cell["comboId"]; exists {
		t.Errorf("results に comboId が含まれている(URL 側で表現するはず): %v", cell)
	}
	// note は未設定なら省略される。
	if _, exists := cell["note"]; exists {
		t.Errorf("note 未設定なのにキーが出ている: %v", cell)
	}
}
