package setup_test

// ★M23-09 §4.1-2: セットプレイの保存前重複チェックのハンドラ層テスト。
//
// ★★エラーコードまで主張する。status だけを見ると、完了報告に写す逐語形
// (CHANGE-141 が DES-002 §4.2 へ写す原稿)と実装がずれても検出できない。
//
// ★「0 件でもキーを出し空配列を返す」を見るために生の JSON を map で読む。
// DTO へ Unmarshal するとキーの有無を判定できない(M23-05 と同じ作法)。

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

func postCheckSetupDuplicate(t *testing.T, svc *mockService, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// errorCode は APIError の code を取り出す。
func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v (body=%s)", err, rec.Body.String())
	}
	errObj, ok := raw["error"].(map[string]any)
	if !ok {
		t.Fatalf("error オブジェクトが無い: %s", rec.Body.String())
	}
	code, _ := errObj["code"].(string)
	return code
}

// ---------------------------------------------------------------------------
// 200: 生きた側と削除済み側が別のキーで返る
// ---------------------------------------------------------------------------

func TestHandler_CheckSetupDuplicate_200_SeparatesAliveAndDeleted(t *testing.T) {
	aliveName := "生きている重ね"
	deletedName := "投げ後の重ね"
	svc := &mockService{
		checkSetupDuplicateFn: func(_ context.Context, parentComboID int64, input setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error) {
			if parentComboID != 5 {
				t.Errorf("parentComboID = %d, want 5", parentComboID)
			}
			if input.CharacterID != 1 {
				t.Errorf("characterId = %d, want 1", input.CharacterID)
			}
			// ★StepOrder は配列順に 1 起算であること(登録経路と同じ採番＝ハッシュが揃う)。
			if len(input.Steps) != 2 || input.Steps[0].StepOrder != 1 || input.Steps[1].StepOrder != 2 {
				t.Errorf("steps の採番が登録経路と違う: %+v", input.Steps)
			}
			return &setupsvc.CheckSetupDuplicateResult{
				Duplicates:        []model.SetupRef{{ID: 11, Name: &aliveName}},
				DeletedDuplicates: []model.SetupRef{{ID: 22, Name: &deletedName}},
			}, nil
		},
	}

	body := `{"characterId":1,"steps":[{"moveId":12},{"moveId":30}]}`
	rec := postCheckSetupDuplicate(t, svc, "/api/combos/5/setups/check-duplicate", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	alive, ok := raw["duplicates"].([]any)
	if !ok || len(alive) != 1 {
		t.Fatalf("duplicates = %v, want 1 件", raw["duplicates"])
	}
	deleted, ok := raw["deletedDuplicates"].([]any)
	if !ok || len(deleted) != 1 {
		t.Fatalf("deletedDuplicates = %v, want 1 件", raw["deletedDuplicates"])
	}
	// ★人が読める文字列を持つ(§4.1-3)。id だけでは「どれを復元するのか」が判らない。
	first, _ := deleted[0].(map[string]any)
	if first["name"] != deletedName {
		t.Errorf("deletedDuplicates[0].name = %v, want %q", first["name"], deletedName)
	}
}

// ---------------------------------------------------------------------------
// ★0 件でもキーを出し空配列を返す(warnings の omitempty とは逆・意図的)
// ---------------------------------------------------------------------------

func TestHandler_CheckSetupDuplicate_200_EmptyArraysNotOmitted(t *testing.T) {
	svc := &mockService{
		checkSetupDuplicateFn: func(_ context.Context, _ int64, _ setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error) {
			return &setupsvc.CheckSetupDuplicateResult{
				Duplicates:        []model.SetupRef{},
				DeletedDuplicates: []model.SetupRef{},
			}, nil
		},
	}

	rec := postCheckSetupDuplicate(t, svc, "/api/combos/5/setups/check-duplicate", `{"characterId":1,"steps":[]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, key := range []string{"duplicates", "deletedDuplicates"} {
		v, ok := raw[key]
		if !ok {
			t.Errorf("★%s のキーが出ていない。画面は length で分岐する", key)
			continue
		}
		if arr, isArr := v.([]any); !isArr || len(arr) != 0 {
			t.Errorf("%s = %v, want 空配列(null 不可)", key, v)
		}
	}
}

// ---------------------------------------------------------------------------
// ★エラー契約(400 の 2 種のみ。404 は無い)
// ---------------------------------------------------------------------------

func TestHandler_CheckSetupDuplicate_400_InvalidComboID(t *testing.T) {
	rec := postCheckSetupDuplicate(t, &mockService{}, "/api/combos/abc/setups/check-duplicate", `{"characterId":1,"steps":[]}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "invalid_combo_id" {
		t.Errorf("code = %q, want %q", got, "invalid_combo_id")
	}
}

func TestHandler_CheckSetupDuplicate_400_MissingCharacterID(t *testing.T) {
	rec := postCheckSetupDuplicate(t, &mockService{}, "/api/combos/5/setups/check-duplicate", `{"steps":[]}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "invalid_request" {
		t.Errorf("code = %q, want %q", got, "invalid_request")
	}
}

// ★★存在しない親コンボでも 404 を返さない。チェックの失敗で登録という主目的を
// 巻き添えにしない規律(§4.2-3)。⇒ 返らない 404 分岐を実装に持たせないこと。
func TestHandler_CheckSetupDuplicate_UnknownCombo_Returns200Empty(t *testing.T) {
	svc := &mockService{
		checkSetupDuplicateFn: func(_ context.Context, _ int64, _ setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error) {
			return &setupsvc.CheckSetupDuplicateResult{
				Duplicates:        []model.SetupRef{},
				DeletedDuplicates: []model.SetupRef{},
			}, nil
		},
	}
	rec := postCheckSetupDuplicate(t, svc, "/api/combos/999999/setups/check-duplicate", `{"characterId":1,"steps":[]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// ★登録経路(POST /api/combos/:comboId/setups)を壊していないこと
// ---------------------------------------------------------------------------

// ★新ルートは登録ルートの下に生えている。echo のルーティングで登録側が食われて
// いないことを確かめる——食われると VAL-S04 の 409 が出なくなる。
func TestHandler_CreateSetup_StillRoutedAfterCheckDuplicateAdded(t *testing.T) {
	called := false
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			called = true
			return &setupsvc.SetupResponse{Setup: sampleSetup(), DefaultRecipe: ""}, validation.ValidationResult{}, nil
		},
	}
	rec := postCheckSetupDuplicate(t, svc, "/api/combos/5/setups", `{"characterId":1,"steps":[{"moveId":12}]}`)
	if !called {
		t.Fatalf("★登録経路が呼ばれていない(ルーティングが食われた可能性): status=%d body=%s", rec.Code, rec.Body.String())
	}
}
