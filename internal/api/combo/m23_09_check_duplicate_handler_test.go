package combo_test

// ★M23-09 §4.1-1: コンボの保存前チェックへ deletedDuplicates を足したことのハンドラ層テスト。
//
// ★★既存キー(duplicates)の名前と意味を変えていないことを、同じ応答の中で見る。
// ★「0 件でもキーを出し空配列を返す」を見るために生の JSON を map で読む
// (DTO へ Unmarshal するとキーの有無を判定できない)。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

func postCheckDuplicateRaw(t *testing.T, svc *mockService, body string) map[string]any {
	t.Helper()
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, "/api/combos/check-duplicate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return raw
}

const checkDuplicateBody = `{"characterId":1,"starterMoveId":12,"position":"mid_screen","opponentStance":"standing","hitType":"normal","opponentSize":"standard","steps":[{"stepOrder":1,"moveId":12}]}`

// ---------------------------------------------------------------------------
// 生きた側と削除済み側が別のキーで返る(§4.1-1)
// ---------------------------------------------------------------------------

func TestHandler_CheckDuplicate_SeparatesAliveAndDeleted(t *testing.T) {
	aliveMemo := "生きているほう"
	deletedMemo := "画面端 中央運び"
	svc := &mockService{
		checkDuplicateFn: func(_ context.Context, _ combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			return &combosvc.CheckDuplicateResult{
				Duplicates:        []combosvc.DuplicateInfo{{ID: 17, CharacterID: 1, StepCount: 5, Memo: &aliveMemo}},
				DeletedDuplicates: []model.ComboRef{{ID: 91, Memo: &deletedMemo}},
			}, nil
		},
	}

	raw := postCheckDuplicateRaw(t, svc, checkDuplicateBody)

	alive, ok := raw["duplicates"].([]any)
	if !ok || len(alive) != 1 {
		t.Fatalf("duplicates = %v, want 1 件", raw["duplicates"])
	}
	deleted, ok := raw["deletedDuplicates"].([]any)
	if !ok || len(deleted) != 1 {
		t.Fatalf("deletedDuplicates = %v, want 1 件", raw["deletedDuplicates"])
	}

	// ★既存キーの意味は不変。生きた側は従来どおり DuplicateInfoResponse の形で出る。
	firstAlive, _ := alive[0].(map[string]any)
	for _, key := range []string{"id", "characterId", "starterMoveId", "position", "opponentStance", "hitType", "opponentSize", "stepCount"} {
		if _, has := firstAlive[key]; !has {
			t.Errorf("★既存キー %q が duplicates から消えている", key)
		}
	}
	// ★人が読める文字列(§4.1-3 / §3.3-4)。
	if firstAlive["memo"] != aliveMemo {
		t.Errorf("duplicates[0].memo = %v, want %q", firstAlive["memo"], aliveMemo)
	}
	firstDeleted, _ := deleted[0].(map[string]any)
	if firstDeleted["memo"] != deletedMemo {
		t.Errorf("deletedDuplicates[0].memo = %v, want %q", firstDeleted["memo"], deletedMemo)
	}
	if firstDeleted["id"] != float64(91) {
		t.Errorf("deletedDuplicates[0].id = %v, want 91", firstDeleted["id"])
	}
}

// ---------------------------------------------------------------------------
// ★0 件でもキーを出し空配列を返す
// ---------------------------------------------------------------------------

func TestHandler_CheckDuplicate_EmptyDeletedArrayNotOmitted(t *testing.T) {
	svc := &mockService{
		checkDuplicateFn: func(_ context.Context, _ combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
			// ★サービスが nil を返す場合でも null にしない(ハンドラ側の保険)。
			return &combosvc.CheckDuplicateResult{}, nil
		},
	}

	raw := postCheckDuplicateRaw(t, svc, checkDuplicateBody)
	v, ok := raw["deletedDuplicates"]
	if !ok {
		t.Fatalf("★deletedDuplicates のキーが出ていない。画面は length で分岐する")
	}
	arr, isArr := v.([]any)
	if !isArr || len(arr) != 0 {
		t.Errorf("deletedDuplicates = %v, want 空配列(null 不可)", v)
	}
}
