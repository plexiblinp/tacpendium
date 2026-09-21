package setup_test

// セットプレイ成立条件のエンドポイントのハンドラテスト(M19-03 §5.2)。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

func putResult(t *testing.T, svc *mockService, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPut, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func deleteResult(t *testing.T, svc *mockService, path string) *httptest.ResponseRecorder {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodDelete, path, nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// ---------------------------------------------------------------------------
// PUT /api/combos/:comboId/setups/:setupId/results — 正常系
// ---------------------------------------------------------------------------

func TestHandler_UpsertSetupResult_200(t *testing.T) {
	var got setupsvc.UpsertResultInput
	var gotCombo, gotSetup int64
	svc := &mockService{
		upsertResultFn: func(_ context.Context, comboID, setupID int64, input setupsvc.UpsertResultInput) error {
			gotCombo, gotSetup, got = comboID, setupID, input
			return nil
		},
	}
	rec := putResult(t, svc, "/api/combos/10/setups/7/results",
		`{"techType":"back_tech","inCorner":true,"result":"ng","note":"端では届かない"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if gotCombo != 10 || gotSetup != 7 {
		t.Errorf("(comboID, setupID) = (%d, %d), want (10, 7)", gotCombo, gotSetup)
	}
	if got.TechType != model.OkiTechTypeBack || !got.InCorner || got.Result != model.SetupResultNG {
		t.Errorf("サービスへ渡った入力が不正: %+v", got)
	}
	if got.Note == nil || *got.Note != "端では届かない" {
		t.Errorf("note が渡っていない: %v", got.Note)
	}

	var resp model.ComboSetupResult
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.SetupID != 7 || resp.TechType != model.OkiTechTypeBack || !resp.InCorner || resp.Result != model.SetupResultNG {
		t.Errorf("レスポンスが不正: %+v", resp)
	}
	// combo_id は URL 側で表現するため JSON に出さない。
	if strings.Contains(rec.Body.String(), "comboId") {
		t.Errorf("レスポンスに comboId が含まれている: %s", rec.Body.String())
	}
}

// 成立(ok)のセルにも note を書ける(§4.4.3)。
func TestHandler_UpsertSetupResult_NoteOnOkCell(t *testing.T) {
	var got setupsvc.UpsertResultInput
	svc := &mockService{
		upsertResultFn: func(_ context.Context, _, _ int64, input setupsvc.UpsertResultInput) error {
			got = input
			return nil
		},
	}
	rec := putResult(t, svc, "/api/combos/10/setups/7/results",
		`{"techType":"neutral_tech","inCorner":false,"result":"ok","note":"距離がシビア"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got.Result != model.SetupResultOK || got.Note == nil {
		t.Errorf("成立セルの note が渡っていない: %+v", got)
	}
}

// ---------------------------------------------------------------------------
// 値域外は 400(§4.3.2)
// ---------------------------------------------------------------------------

func TestHandler_UpsertSetupResult_400_OutOfRange(t *testing.T) {
	svc := &mockService{
		upsertResultFn: func(_ context.Context, _, _ int64, _ setupsvc.UpsertResultInput) error {
			return setupsvc.ErrInvalidResultValue
		},
	}
	cases := []struct {
		name string
		body string
	}{
		{"tech_type が値域外", `{"techType":"quick_rise","inCorner":false,"result":"ok"}`},
		{"result が値域外", `{"techType":"neutral_tech","inCorner":false,"result":"unstable"}`},
		{"result が未検証相当", `{"techType":"neutral_tech","inCorner":false,"result":"unverified"}`},
		{"result が空", `{"techType":"neutral_tech","inCorner":false,"result":""}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := putResult(t, svc, "/api/combos/10/setups/7/results", c.body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 紐付けが存在しない組への書き込みは API 層でも弾かれる(多層防御・§4.3.2)
// ---------------------------------------------------------------------------

func TestHandler_UpsertSetupResult_404_LinkNotFound(t *testing.T) {
	svc := &mockService{
		upsertResultFn: func(_ context.Context, _, _ int64, _ setupsvc.UpsertResultInput) error {
			return setupsvc.ErrSetupLinkNotFound
		},
	}
	rec := putResult(t, svc, "/api/combos/999/setups/7/results",
		`{"techType":"neutral_tech","inCorner":false,"result":"ok"}`)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

func TestHandler_UpsertSetupResult_400_InvalidIDs(t *testing.T) {
	svc := &mockService{}
	for _, path := range []string{
		"/api/combos/abc/setups/7/results",
		"/api/combos/10/setups/abc/results",
		"/api/combos/0/setups/7/results",
	} {
		rec := putResult(t, svc, path, `{"techType":"neutral_tech","inCorner":false,"result":"ok"}`)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", path, rec.Code)
		}
	}
}

// ---------------------------------------------------------------------------
// DELETE = 「未検証へ戻す」
// ---------------------------------------------------------------------------

func TestHandler_DeleteSetupResult_204(t *testing.T) {
	var gotTech string
	var gotCorner bool
	var gotCombo, gotSetup int64
	svc := &mockService{
		deleteResultFn: func(_ context.Context, comboID, setupID int64, techType string, inCorner bool) error {
			gotCombo, gotSetup, gotTech, gotCorner = comboID, setupID, techType, inCorner
			return nil
		},
	}
	rec := deleteResult(t, svc, "/api/combos/10/setups/7/results?techType=back_tech&inCorner=true")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}
	if gotCombo != 10 || gotSetup != 7 || gotTech != model.OkiTechTypeBack || !gotCorner {
		t.Errorf("サービスへ渡った引数が不正: combo=%d setup=%d tech=%q corner=%t", gotCombo, gotSetup, gotTech, gotCorner)
	}
}

func TestHandler_DeleteSetupResult_400_MissingOrInvalidQuery(t *testing.T) {
	svc := &mockService{}
	cases := []struct {
		name string
		path string
	}{
		{"techType なし", "/api/combos/10/setups/7/results?inCorner=true"},
		{"inCorner なし", "/api/combos/10/setups/7/results?techType=back_tech"},
		{"inCorner が真偽値でない", "/api/combos/10/setups/7/results?techType=back_tech&inCorner=maybe"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := deleteResult(t, svc, c.path)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestHandler_DeleteSetupResult_400_OutOfRangeTechType(t *testing.T) {
	svc := &mockService{
		deleteResultFn: func(_ context.Context, _, _ int64, _ string, _ bool) error {
			return setupsvc.ErrInvalidResultValue
		},
	}
	rec := deleteResult(t, svc, "/api/combos/10/setups/7/results?techType=quick_rise&inCorner=false")
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestHandler_DeleteSetupResult_404_LinkNotFound(t *testing.T) {
	svc := &mockService{
		deleteResultFn: func(_ context.Context, _, _ int64, _ string, _ bool) error {
			return setupsvc.ErrSetupLinkNotFound
		},
	}
	rec := deleteResult(t, svc, "/api/combos/999/setups/7/results?techType=back_tech&inCorner=false")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// 採用時の「確認できた条件」がサービスへ渡る(§4.5)
// ---------------------------------------------------------------------------

func TestHandler_CreateSetup_PassesVerifiedConditions(t *testing.T) {
	var got []setupsvc.SetupResultCondition
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			got = input.VerifiedConditions
			return sampleResponse(), validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)
	body := `{"characterId":1,"steps":[{"moveId":1}],
	          "verifiedConditions":[{"techType":"neutral_tech","inCorner":false},
	                                {"techType":"neutral_tech","inCorner":true}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if len(got) != 2 {
		t.Fatalf("verifiedConditions = %d 件, want 2", len(got))
	}
	if got[0].TechType != model.OkiTechTypeNeutral || got[0].InCorner {
		t.Errorf("1 件目が不正: %+v", got[0])
	}
	if !got[1].InCorner {
		t.Errorf("2 件目の inCorner が渡っていない: %+v", got[1])
	}
}

// verifiedConditions を省略しても採用できる(既定は全て未チェック・§4.5)。
func TestHandler_CreateSetup_WithoutVerifiedConditions(t *testing.T) {
	var got []setupsvc.SetupResultCondition
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			got = input.VerifiedConditions
			return sampleResponse(), validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups",
		strings.NewReader(`{"characterId":1,"steps":[{"moveId":1}]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(未チェックでも採用できる)", rec.Code)
	}
	if len(got) != 0 {
		t.Errorf("verifiedConditions = %d 件, want 0", len(got))
	}
}
