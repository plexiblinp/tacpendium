package setplay

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"
)

type fakeService struct {
	res *setplaysvc.SuggestResult
	err error

	gotParams setplaysvc.SuggestParams
	gotCombo  int64
}

func (f *fakeService) SuggestForCombo(ctx context.Context, comboID int64, params setplaysvc.SuggestParams) (*setplaysvc.SuggestResult, error) {
	f.gotCombo = comboID
	f.gotParams = params
	return f.res, f.err
}

func doReq(t *testing.T, h *Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	// :comboId を抽出(target は /api/combos/5/setplay-suggestions?... 形式)。
	c.SetParamNames("comboId")
	// path から comboId を雑に取得。
	parts := strings.Split(strings.TrimPrefix(strings.SplitN(target, "?", 2)[0], "/api/combos/"), "/")
	c.SetParamValues(parts[0])
	if err := h.GetSuggestions(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	return rec
}

func TestHandler_KnockdownNull_Returns400(t *testing.T) {
	h := NewHandler(&fakeService{err: setplaysvc.ErrKnockdownNotSet})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	errObj, _ := body["error"].(map[string]any)
	if errObj["code"] != "knockdown_advantage_required" {
		t.Errorf("want code knockdown_advantage_required, got %v", errObj["code"])
	}
}

func TestHandler_ComboNotFound_Returns404(t *testing.T) {
	h := NewHandler(&fakeService{err: setplaysvc.ErrComboNotFound})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}

func TestHandler_OK_ReturnsItems(t *testing.T) {
	res := &setplaysvc.SuggestResult{
		Proposals: []setplaysvc.Proposal{
			{
				Steps: []setplaysvc.ProposalStep{
					{MoveID: 10, Code: "f", Role: setplaysvc.RoleFiller, Counted: true},
					{MoveID: 11, Code: "t", Role: setplaysvc.RoleTarget, Counted: true},
				},
				S: 38, N: 4, Landing: 41, TargetActive: 4, AlreadyAdopted: false,
			},
		},
		Truncated: false,
	}
	h := NewHandler(&fakeService{res: res})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions?n_min=2&sort=target&target_move_id=11")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var out SuggestionsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 1 || out.Items[0].N != 4 || out.Items[0].Landing != 41 {
		t.Errorf("unexpected response: %+v", out)
	}
	if out.Items[0].Steps[1].Role != "target" {
		t.Errorf("role mapping wrong: %+v", out.Items[0].Steps)
	}
}

func TestHandler_ParsesQueryParams(t *testing.T) {
	fs := &fakeService{res: &setplaysvc.SuggestResult{Proposals: []setplaysvc.Proposal{}}}
	h := NewHandler(fs)
	doReq(t, h, "/api/combos/9/setplay-suggestions?n_min=3&sort=target&target_move_id=42&target_types=normal,throw&include_zero_damage=true")
	if fs.gotCombo != 9 {
		t.Errorf("comboID want 9, got %d", fs.gotCombo)
	}
	if fs.gotParams.NMin != 3 {
		t.Errorf("NMin want 3, got %d", fs.gotParams.NMin)
	}
	if fs.gotParams.Sort != setplaysvc.SortByTarget {
		t.Errorf("Sort want target, got %q", fs.gotParams.Sort)
	}
	if fs.gotParams.TargetMoveID == nil || *fs.gotParams.TargetMoveID != 42 {
		t.Errorf("TargetMoveID want 42, got %v", fs.gotParams.TargetMoveID)
	}
	if len(fs.gotParams.TargetTypes) != 2 || fs.gotParams.TargetTypes[0] != "normal" || fs.gotParams.TargetTypes[1] != "throw" {
		t.Errorf("TargetTypes want [normal throw], got %v", fs.gotParams.TargetTypes)
	}
	if !fs.gotParams.IncludeZeroDamage {
		t.Errorf("IncludeZeroDamage want true")
	}
}

func TestHandler_DefaultTargetTypes(t *testing.T) {
	// target_types 省略時は既定(normal, unique, special_projectile)。
	fs := &fakeService{res: &setplaysvc.SuggestResult{Proposals: []setplaysvc.Proposal{}}}
	h := NewHandler(fs)
	doReq(t, h, "/api/combos/9/setplay-suggestions")
	want := []string{"normal", "unique", "special_projectile"}
	if len(fs.gotParams.TargetTypes) != len(want) {
		t.Fatalf("default types len want %d, got %v", len(want), fs.gotParams.TargetTypes)
	}
	for i, w := range want {
		if fs.gotParams.TargetTypes[i] != w {
			t.Errorf("default type[%d] want %s, got %s", i, w, fs.gotParams.TargetTypes[i])
		}
	}
}

func TestHandler_InvalidSort_Returns400(t *testing.T) {
	h := NewHandler(&fakeService{res: &setplaysvc.SuggestResult{}})
	// sort=steps は廃止 → 400。sort=bogus も 400。
	for _, s := range []string{"steps", "bogus"} {
		rec := doReq(t, h, "/api/combos/5/setplay-suggestions?sort="+s)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("want 400 for sort=%s, got %d", s, rec.Code)
		}
	}
}

func TestHandler_ParsesGapParams(t *testing.T) {
	fs := &fakeService{res: &setplaysvc.SuggestResult{Proposals: []setplaysvc.Proposal{}}}
	h := NewHandler(fs)
	doReq(t, h, "/api/combos/9/setplay-suggestions?mode=gap&g_min=2&g_max=9&limit=50")
	if fs.gotParams.Mode != setplaysvc.ModeGap {
		t.Errorf("Mode want gap, got %q", fs.gotParams.Mode)
	}
	if fs.gotParams.GMin != 2 || fs.gotParams.GMax != 9 {
		t.Errorf("GMin/GMax want 2/9, got %d/%d", fs.gotParams.GMin, fs.gotParams.GMax)
	}
	if fs.gotParams.Limit != 50 {
		t.Errorf("Limit want 50, got %d", fs.gotParams.Limit)
	}
}

func TestHandler_ModeOmittedIsMeaty(t *testing.T) {
	fs := &fakeService{res: &setplaysvc.SuggestResult{Proposals: []setplaysvc.Proposal{}}}
	h := NewHandler(fs)
	doReq(t, h, "/api/combos/9/setplay-suggestions")
	if fs.gotParams.Mode != setplaysvc.ModeMeaty {
		t.Errorf("omitted mode must be meaty, got %q", fs.gotParams.Mode)
	}
}

func TestHandler_InvalidMode_Returns400(t *testing.T) {
	h := NewHandler(&fakeService{res: &setplaysvc.SuggestResult{}})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions?mode=bogus")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("want 400 for mode=bogus, got %d", rec.Code)
	}
}

func TestHandler_NegativeKA_Returns200WithReason(t *testing.T) {
	// 負 KA はサービスが Reason 付き空結果を返す(エラーではない) → ハンドラは 200。
	res := &setplaysvc.SuggestResult{Proposals: []setplaysvc.Proposal{}, Reason: setplaysvc.ReasonKnockdownNegative}
	h := NewHandler(&fakeService{res: res})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 for negative KA, got %d", rec.Code)
	}
	var out SuggestionsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Reason != setplaysvc.ReasonKnockdownNegative {
		t.Errorf("want reason %q, got %q", setplaysvc.ReasonKnockdownNegative, out.Reason)
	}
	if len(out.Items) != 0 {
		t.Errorf("negative KA must yield 0 items, got %d", len(out.Items))
	}
}

func TestHandler_ResponseCarriesTotalFoundAndGapFields(t *testing.T) {
	res := &setplaysvc.SuggestResult{
		Proposals: []setplaysvc.Proposal{
			{Steps: []setplaysvc.ProposalStep{{MoveID: 11, Code: "t", Role: setplaysvc.RoleTarget, Counted: true}}, N: -3, Mode: setplaysvc.ModeGap, G: 4},
		},
		Truncated: false, TotalFound: 42,
	}
	h := NewHandler(&fakeService{res: res})
	rec := doReq(t, h, "/api/combos/5/setplay-suggestions?mode=gap")
	var out SuggestionsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.TotalFound != 42 {
		t.Errorf("totalFound want 42, got %d", out.TotalFound)
	}
	if out.Items[0].Mode != "gap" || out.Items[0].G != 4 {
		t.Errorf("gap fields wrong: mode=%q g=%d", out.Items[0].Mode, out.Items[0].G)
	}
}
