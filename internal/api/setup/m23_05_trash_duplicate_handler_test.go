package setup_test

// ★M23-05 §5.2 相当（セットプレイ側）。指示書はコンボ側しか名指ししていないが、
// 器を広げたのは登録 2 経路であり、片側だけ主張が無いと非対称になる
// （M23-05 レビュー 中-2）。
//
// ★「0 件でキーが出ない」を見るために生の JSON を map で読む。DTO へ Unmarshal すると
// omitempty はデコード側では効かず、キーの有無を判定できない（M23-04 と同じ作法）。

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

// val07Result は VAL-S07 の警告 1 件を持つ結果を作る。
func val07Result() validation.ValidationResult {
	name := "起き攻めA"
	r := validation.ValidationResult{}
	r.AddWarningWithDetails(setupsvc.CodeS07DuplicateInTrash, "",
		"同じレシピのセットプレイ 1 件が同じ親コンボのゴミ箱にもあります(登録は成功しています)",
		map[string]any{
			"setups":     []any{model.SetupRef{ID: 7, Name: &name}},
			"totalCount": 1,
		})
	return r
}

func postSetupM2305(t *testing.T, svc *mockService) *httptest.ResponseRecorder {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups",
		strings.NewReader(`{"characterId":1,"name":"x","steps":[{"moveId":1}]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// POST /api/combos/:comboId/setups の成功応答に warnings が載る。
func TestHandler_CreateSetup_CarriesVALS07Warning(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			return sampleResponse(), validation.ValidationResult{}, nil
		},
		checkTrashDuplicateSetupFn: func(_ context.Context, _, _ int64) validation.ValidationResult {
			return val07Result()
		},
	}
	rec := postSetupM2305(t, svc)

	// ★警告が付いても 200 のままである。VAL-S04 の 409 とは別物（M23-05 §4.1-1）。
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	raw, ok := body["warnings"]
	if !ok {
		t.Fatalf("warnings キーが無い: %s", rec.Body.String())
	}
	warnings, ok := raw.([]any)
	if !ok || len(warnings) != 1 {
		t.Fatalf("warnings = %#v, want 1 件", raw)
	}
	issue, ok := warnings[0].(map[string]any)
	if !ok {
		t.Fatalf("warnings[0] が object でない: %#v", warnings[0])
	}
	if issue["code"] != setupsvc.CodeS07DuplicateInTrash {
		t.Errorf("code = %v, want %s", issue["code"], setupsvc.CodeS07DuplicateInTrash)
	}
	if issue["severity"] != string(validation.SeverityWarning) {
		t.Errorf("severity = %v, want warning", issue["severity"])
	}
	details, ok := issue["details"].(map[string]any)
	if !ok {
		t.Fatalf("details が object でない: %#v", issue["details"])
	}
	if _, ok := details["setups"]; !ok {
		t.Errorf("details.setups が無い: %#v", details)
	}
}

// 警告 0 件のとき warnings キー自体が無い（空配列を返さない）。
func TestHandler_CreateSetup_OmitsWarningsKeyWhenNone(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			return sampleResponse(), validation.ValidationResult{}, nil
		},
		checkTrashDuplicateSetupFn: func(_ context.Context, _, _ int64) validation.ValidationResult {
			return validation.ValidationResult{}
		},
	}
	rec := postSetupM2305(t, svc)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// ★空配列を返すと、フロント側が「警告があった」と誤って分岐しうる（M23-04 §4.3-2）。
	if _, ok := body["warnings"]; ok {
		t.Errorf("警告 0 件なのに warnings キーが出た: %s", rec.Body.String())
	}
}
