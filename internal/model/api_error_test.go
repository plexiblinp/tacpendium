package model_test

import (
	"encoding/json"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

func TestAPIErrorResponse_JSONMarshal_CodeAndMessage(t *testing.T) {
	resp := model.APIErrorResponse{
		Error: model.APIError{
			Code:    "INVALID_TAG_ID",
			Message: "tag_id must be a positive integer",
		},
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	want := `{"error":{"code":"INVALID_TAG_ID","message":"tag_id must be a positive integer"}}`
	if string(b) != want {
		t.Errorf("got  %s\nwant %s", string(b), want)
	}
}

func TestAPIErrorResponse_JSONMarshal_DetailsOmitted(t *testing.T) {
	resp := model.APIErrorResponse{
		Error: model.APIError{
			Code:    "not_found",
			Message: "resource not found",
		},
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	errObj, ok := m["error"].(map[string]any)
	if !ok {
		t.Fatal("error field missing or not object")
	}
	if _, hasDetails := errObj["details"]; hasDetails {
		t.Error("details should be omitted when nil/empty")
	}
}

func TestAPIErrorResponse_JSONMarshal_WithDetails(t *testing.T) {
	resp := model.APIErrorResponse{
		Error: model.APIError{
			Code:    "DUPLICATE_TAG",
			Message: "同名タグが存在します",
			Details: map[string]any{
				"existing_tag_id": float64(42),
			},
		},
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	errObj := m["error"].(map[string]any)
	details, ok := errObj["details"].(map[string]any)
	if !ok {
		t.Fatal("details field missing")
	}
	if details["existing_tag_id"] != float64(42) {
		t.Errorf("existing_tag_id = %v, want 42", details["existing_tag_id"])
	}
}

// M22-03 §5.1-5: 版不一致のコードが、409 を共有する他の事象と衝突しないこと。
//
// ★これが「ステータスだけを見るテストは何も守らない」理由である(M22-03 §1.4)。
// 409 は本アプリで 11 種類の事象に使われており、うち 1 つが版不一致である。
// ⇒ 版の突き合わせを外しても、別の理由の 409 でステータスのみのテストは緑になりうる。
//
// 本テストは (1) 版不一致のコードが総称でないこと (2) 409 を返す他のコードと
// 重ならないことを契約として固定し、いずれかへ寄せる変更を赤にする。
// 実際の応答本文に現れる文字列は各ハンドラのテストがリテラルで固定している
// (internal/api/{combo,setup}/handler_test.go ／ internal/api/preset/write_handler_test.go)。
func TestErrorCodeVersionConflict_DistinctFromOther409Codes(t *testing.T) {
	// ★実測で洗い出した「409 を返す他のコード」の全数(M22-03 完了報告 §1.5)。
	// 走査: rg -n 'http.StatusConflict' internal/ --glob '!*_test.go' -A3
	other409 := []string{
		"alias_conflict",
		"combo_not_in_trash",
		"duplicate_setup",
		"preset_in_use_by_config",
		"preset_limit_exceeded",
		"preset_name_duplicate",
		"rush_variant_exists",
		"tag_in_use",
		"tag_name_duplicate",
		"user_name_duplicate",
	}
	for _, c := range other409 {
		if model.ErrorCodeVersionConflict == c {
			t.Fatalf("版不一致が %q と同じコードを使っている。409 のステータスだけでは区別できなくなる", c)
		}
	}

	// ★総称を版不一致に割り当ててはならない(M22-03 §4.3-2)。
	// どの衝突かが読めず、上の 10 種と意味の上で重なる。
	if model.ErrorCodeVersionConflict == "conflict" {
		t.Errorf("ErrorCodeVersionConflict = %q。総称ではどの衝突か読めない", model.ErrorCodeVersionConflict)
	}
}
