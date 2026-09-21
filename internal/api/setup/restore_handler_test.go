package setup_test

// ★M23-02: ゴミ箱(復元・完全削除)のハンドラ層テスト。
//
// 本ファイルの主目的は、拒否の応答の形(ステータス・code・details の構造)を
// 線を流れる文字列として固定することである。指示書 §4.4-5 が完了報告へ逐語で
// 書くことを求めており、M23-04 がこれを VAL コード化する。
//
// ★実 DB 側の担保は internal/service/setup/restore_test.go と
//   internal/repository/setup/restore_test.go が持つ(SUPP-001 §5.5.4 規約 14)。

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ★あえてリテラルで書く(既存の wantVersionConflictCode と同じ理由)。
// 定数を参照すると値を変えたときにテストも一緒に動き、契約が変わったことを検出できない。
const (
	wantSetupInUseCode      = "setup_in_use"
	wantSetupNotInTrashCode = "setup_not_in_trash"
)

func TestHandler_PermanentDelete_204(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204(コンボ側と揃える)", rec.Code)
	}
}

// ★拒否の応答の形を固定する。details.combos に参照元コンボが入る。
func TestHandler_PermanentDelete_409_SetupInUse(t *testing.T) {
	memo := "対空から拾うルート"
	svc := &mockService{
		permanentDeleteFn: func(_ context.Context, _ int64) error {
			return &setupsvc.SetupInUseError{Combos: []model.ComboRef{
				{ID: 12, Memo: &memo},
				{ID: 34}, // memo が無い行もある(combos に name 列は存在しない)
			}}
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
			Details struct {
				Combos []struct {
					ID   int64   `json:"id"`
					Memo *string `json:"memo"`
				} `json:"combos"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v (body=%s)", err, rec.Body.String())
	}
	if body.Error.Code != wantSetupInUseCode {
		t.Errorf("code = %q, want %q", body.Error.Code, wantSetupInUseCode)
	}
	if body.Error.Message == "" {
		t.Error("message が空。★無反応にしないため、画面はこれを表示する(§4.4-3c)")
	}
	if len(body.Error.Details.Combos) != 2 {
		t.Fatalf("details.combos = %d 件, want 2", len(body.Error.Details.Combos))
	}
	if body.Error.Details.Combos[0].ID != 12 ||
		body.Error.Details.Combos[0].Memo == nil ||
		*body.Error.Details.Combos[0].Memo != memo {
		t.Errorf("details.combos[0] = %+v, want {id:12, memo:%q}", body.Error.Details.Combos[0], memo)
	}
	if body.Error.Details.Combos[1].ID != 34 || body.Error.Details.Combos[1].Memo != nil {
		t.Errorf("details.combos[1] = %+v, want {id:34, memo 無し}", body.Error.Details.Combos[1])
	}
}

func TestHandler_PermanentDelete_409_NotInTrash(t *testing.T) {
	svc := &mockService{
		permanentDeleteFn: func(_ context.Context, _ int64) error {
			return setupsvc.ErrSetupNotInTrash
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Error.Code != wantSetupNotInTrashCode {
		t.Errorf("code = %q, want %q", body.Error.Code, wantSetupNotInTrashCode)
	}
}

func TestHandler_PermanentDelete_404(t *testing.T) {
	svc := &mockService{
		permanentDeleteFn: func(_ context.Context, _ int64) error { return setupsvc.ErrNotFound },
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1/permanent", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// ★復元は成功後に再取得して 200 + SetupResponse を返す(コンボ側と同型)。
func TestHandler_Restore_200(t *testing.T) {
	svc := &mockService{
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return &setupsvc.SetupResponse{
				Setup:          sampleSetup(),
				DefaultRecipe:  "5LP > 236LP",
				ParentComboIDs: []int64{12, 34},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/setups/1/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(コンボ側と揃える)", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["id"] == nil || body["defaultRecipe"] != "5LP > 236LP" {
		t.Errorf("復元応答が SetupResponse になっていない: %v", body)
	}
	// 生きた行なので deletedAt は省略される(omitempty)。
	if _, ok := body["deletedAt"]; ok {
		t.Errorf("復元後の応答に deletedAt が入っている: %v", body["deletedAt"])
	}
}

// ===========================================================================
// M23-04 §5.2: 復元の 200 応答へ warnings が載る / 0 件ならキーごと出ない
// ===========================================================================

// ★JSON レベルで見る。Go の構造体で見ると omitempty の効きを検査できず、
// 「空配列を返している」形(フロントが誤って分岐する＝§4.3-2)を見逃す。
func TestHandler_Restore_200_WithWarnings(t *testing.T) {
	var warned validation.ValidationResult
	warned.AddWarningWithDetails(validation.CodeR02AllParentCombosDeleted, "",
		"紐付いている親コンボがすべてゴミ箱にあります",
		map[string]any{"combos": []any{model.ComboRef{ID: 12}}})

	svc := &mockService{
		restoreFn: func(_ context.Context, _ int64) (validation.ValidationResult, error) {
			return warned, nil
		},
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return &setupsvc.SetupResponse{
				Setup:          sampleSetup(),
				DefaultRecipe:  "5LP > 236LP",
				ParentComboIDs: []int64{},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/setups/1/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	// ★警告はエラーではない。200 のままであること(§4.1)。
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(警告はエラーではない)", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	raw, ok := body["warnings"]
	if !ok {
		t.Fatalf("応答に warnings が無い: %v", body)
	}
	items, ok := raw.([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("warnings = %v, want 1 件の配列", raw)
	}
	first, _ := items[0].(map[string]any)
	if first["code"] != validation.CodeR02AllParentCombosDeleted {
		t.Errorf("warnings[0].code = %v, want %s", first["code"], validation.CodeR02AllParentCombosDeleted)
	}
	// ★details は「どれが問題か」を id 付きで返す(§4.3-3。M23-02 の details.combos と同形)。
	details, ok := first["details"].(map[string]any)
	if !ok {
		t.Fatalf("warnings[0].details が無い: %v", first)
	}
	if _, ok := details["combos"]; !ok {
		t.Errorf("details.combos が無い: %v", details)
	}
}

// ★警告 0 件のときはキーごと出さない(§4.3-2)。空配列だとフロントが
// 「警告があった」と誤って分岐しうる。
func TestHandler_Restore_200_OmitsWarningsWhenEmpty(t *testing.T) {
	svc := &mockService{
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return &setupsvc.SetupResponse{
				Setup:          sampleSetup(),
				DefaultRecipe:  "5LP > 236LP",
				ParentComboIDs: []int64{12},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/setups/1/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if v, ok := body["warnings"]; ok {
		t.Errorf("警告 0 件なのに warnings キーが出ている: %v", v)
	}
}

func TestHandler_Restore_404(t *testing.T) {
	svc := &mockService{
		restoreFn: func(_ context.Context, _ int64) (validation.ValidationResult, error) {
			return validation.ValidationResult{}, setupsvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/setups/1/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404(不在・既に生きている のどちらも)", rec.Code)
	}
}

// ★onlyDeleted=true でゴミ箱を返す。綴りは本経路の camelCase に揃えてある。
func TestHandler_ListSetups_OnlyDeleted(t *testing.T) {
	var calledDeleted, calledAlive bool
	svc := &mockService{
		listDeletedSetupsFn: func(_ context.Context, _ *int64) ([]*setupsvc.SetupResponse, error) {
			calledDeleted = true
			return []*setupsvc.SetupResponse{}, nil
		},
		listSetupsFn: func(_ context.Context, _ *int64) ([]*setupsvc.SetupResponse, error) {
			calledAlive = true
			return []*setupsvc.SetupResponse{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups?characterId=1&onlyDeleted=true", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !calledDeleted || calledAlive {
		t.Errorf("onlyDeleted=true でゴミ箱側が呼ばれていない(deleted=%v, alive=%v)", calledDeleted, calledAlive)
	}

	// 省略時は従来どおり生きた一覧(既存の挙動を変えていない)。
	calledDeleted, calledAlive = false, false
	req2 := httptest.NewRequest(http.MethodGet, "/api/setups?characterId=1", nil)
	rec2 := httptest.NewRecorder()
	e.ServeHTTP(rec2, req2)
	if calledDeleted || !calledAlive {
		t.Errorf("省略時に生きた一覧が呼ばれていない(deleted=%v, alive=%v)", calledDeleted, calledAlive)
	}
}
