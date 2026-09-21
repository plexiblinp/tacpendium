package combo_test

// ★M23-05 §5.2: 登録経路の応答に warnings が載ること、0 件ならキーごと出ないこと、
// PUT には載らないこと。
//
// ★「0 件でキーが出ない」を見るために生の JSON を map で読む。DTO へ Unmarshal すると
// omitempty はデコード側では効かず、キーの有無を判定できない(M23-04 と同じ作法)。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// val14Result は VAL-C14 の警告 1 件を持つ結果を作る。
func val14Result() validation.ValidationResult {
	r := validation.ValidationResult{}
	r.AddWarningWithDetails(validation.CodeC14DuplicateInTrash, "",
		"同じ内容のコンボ 1 件がゴミ箱にもあります(登録は成功しています)",
		map[string]any{
			"combos":     []any{model.ComboRef{ID: 7}},
			"totalCount": 1,
		})
	return r
}

func postComboM2305(t *testing.T, svc *mockService) *httptest.ResponseRecorder {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, "/api/combos",
		strings.NewReader(`{"characterId":1,"isDraft":false,"steps":[]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// §5.2-1: POST /api/combos の成功応答に warnings が載る。
func TestHandler_Create_CarriesVALC14Warning(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: 1, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
		checkTrashDuplicateFn: func(ctx context.Context, comboID int64) validation.ValidationResult {
			return val14Result()
		},
	}
	rec := postComboM2305(t, svc)

	// ★警告が付いても 201 のままである。4xx へ倒さない(M23-05 §4.1-1)。
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
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
	if issue["code"] != validation.CodeC14DuplicateInTrash {
		t.Errorf("code = %v, want %s", issue["code"], validation.CodeC14DuplicateInTrash)
	}
	if issue["severity"] != string(validation.SeverityWarning) {
		t.Errorf("severity = %v, want warning", issue["severity"])
	}
	// details は M23-04 と同じ形(combos に {id, memo})＋ M23-05 の totalCount。
	details, ok := issue["details"].(map[string]any)
	if !ok {
		t.Fatalf("details が object でない: %#v", issue["details"])
	}
	if _, ok := details["combos"]; !ok {
		t.Errorf("details.combos が無い: %#v", details)
	}
}

// §5.2-2: 警告 0 件のとき warnings キー自体が無い(空配列を返さない)。
func TestHandler_Create_OmitsWarningsKeyWhenNone(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: 1, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
		checkTrashDuplicateFn: func(ctx context.Context, comboID int64) validation.ValidationResult {
			return validation.ValidationResult{}
		},
	}
	rec := postComboM2305(t, svc)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// ★空配列を返すと、フロント側が「警告があった」と誤って分岐しうる(M23-04 §4.3-2)。
	if _, ok := body["warnings"]; ok {
		t.Errorf("警告 0 件なのに warnings キーが出た: %s", rec.Body.String())
	}
}

// §5.2-3: ★PUT の応答に VAL-C14 が載らない(§4.5-1)。
//
// ★ハンドラは PUT 経路で CheckTrashDuplicate を呼ばない。モックが呼ばれたら記録して
// 落とす——「たまたま警告が空だった」ではなく「呼んでいない」ことを主張する。
func TestHandler_UpdateWithKeyChange_DoesNotCarryVALC14(t *testing.T) {
	called := false
	svc := &mockService{
		updateKFn: func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: 2, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
		checkTrashDuplicateFn: func(ctx context.Context, comboID int64) validation.ValidationResult {
			called = true
			return val14Result()
		},
	}
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPut, "/api/combos/1",
		strings.NewReader(`{"version":1,"characterId":1,"isDraft":false,"steps":[]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if called {
		t.Errorf("PUT の経路で CheckTrashDuplicate が呼ばれた(§4.5-1 違反)")
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := body["warnings"]; ok {
		t.Errorf("PUT の応答に warnings が載った: %s", rec.Body.String())
	}
}
