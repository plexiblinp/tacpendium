package combo_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// モック notation.Service(GetRecipe テスト用)
// ===========================================================================

type mockNotationService struct {
	resolveFn func(ctx context.Context, comboID, presetID int64) (string, error)
}

func (m *mockNotationService) ResolveComboRecipe(ctx context.Context, comboID, presetID int64) (string, error) {
	if m.resolveFn != nil {
		return m.resolveFn(ctx, comboID, presetID)
	}
	return "", nil
}

// 以下は notation.Service の他メソッドの no-op 実装(handler テストでは未使用)。
func (m *mockNotationService) RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
	return nil
}
func (m *mockNotationService) DeleteComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
	return nil
}
func (m *mockNotationService) RecomputePresetCache(ctx context.Context, presetID int64) error {
	return nil
}
func (m *mockNotationService) DeletePresetCache(ctx context.Context, tx *sql.Tx, presetID int64) error {
	return nil
}
func (m *mockNotationService) ComputeSingleCache(ctx context.Context, comboID, presetID int64) (string, error) {
	return "", nil
}
func (m *mockNotationService) RenderSteps(ctx context.Context, presetID int64, steps []model.ComboStep) (string, error) {
	return "", nil
}
func (m *mockNotationService) ResolveSetupRecipe(ctx context.Context, setupID, presetID int64) (string, error) {
	return "", nil
}
func (m *mockNotationService) ResolveDeletedSetupRecipes(ctx context.Context, setupIDs []int64, presetID int64) (map[int64]string, error) {
	return map[int64]string{}, nil
}
func (m *mockNotationService) RecomputeSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error {
	return nil
}
func (m *mockNotationService) DeleteSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error {
	return nil
}
func (m *mockNotationService) ComputeSingleSetupCache(ctx context.Context, setupID, presetID int64) (string, error) {
	return "", nil
}

// ===========================================================================
// モック Service
// ===========================================================================

type mockService struct {
	createFn                 func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error)
	getFn                    func(ctx context.Context, id int64) (*model.Combo, error)
	getDeletedFn             func(ctx context.Context, id int64) (*model.Combo, error)
	listFn                   func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error)
	countFn                  func(ctx context.Context, filter combosvc.ListFilter) (int, error)
	updateMFn                func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error)
	updateKFn                func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error)
	deleteFn                 func(ctx context.Context, id int64) error
	restoreFn                func(ctx context.Context, id int64) (validation.ValidationResult, error)
	acknowledgeGameVersionFn func(ctx context.Context, id int64) (*model.Combo, error)
	permanentDeleteFn        func(ctx context.Context, id int64) error
	checkDuplicateFn         func(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error)
	materializeFn            func(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error)
	// M23-05: VAL-C14。nil のときは警告 0 件として振る舞う(既存テストを触らないため)。
	checkTrashDuplicateFn func(ctx context.Context, comboID int64) validation.ValidationResult
}

func (m *mockService) Create(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
	return m.createFn(ctx, input)
}
func (m *mockService) Get(ctx context.Context, id, userID int64) (*model.Combo, error) {
	return m.getFn(ctx, id)
}

// GetDeleted は M23-07 §4.2-2 の読み取り専用取得。未設定なら getFn へ落とさず
// 明示的に失敗させる(Get と取り違えたテストが黙って通るのを防ぐ)。
func (m *mockService) GetDeleted(ctx context.Context, id, userID int64) (*model.Combo, error) {
	if m.getDeletedFn == nil {
		return nil, errors.New("getDeletedFn not set")
	}
	return m.getDeletedFn(ctx, id)
}
func (m *mockService) List(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
	return m.listFn(ctx, filter)
}
func (m *mockService) Count(ctx context.Context, filter combosvc.ListFilter) (int, error) {
	// ★countFn 未設定のテストは「総数 = 一覧の件数」に倒す(切り捨て無しの既定)。
	//   総数を主張したいテストだけが countFn を差す。
	if m.countFn == nil {
		items, err := m.listFn(ctx, filter)
		return len(items), err
	}
	return m.countFn(ctx, filter)
}
func (m *mockService) UpdateMetadata(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
	return m.updateMFn(ctx, id, version, input)
}
func (m *mockService) UpdateWithKeyChange(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
	return m.updateKFn(ctx, oldID, version, input)
}
func (m *mockService) Delete(ctx context.Context, id int64) error { return m.deleteFn(ctx, id) }

// CheckTrashDuplicate は M23-05 の VAL-C14。★未設定なら空を返す——既存テストは本経路を
// 意識していないため、nil ガードが無いと全件 panic する。
func (m *mockService) CheckTrashDuplicate(ctx context.Context, comboID int64) validation.ValidationResult {
	if m.checkTrashDuplicateFn == nil {
		return validation.ValidationResult{}
	}
	return m.checkTrashDuplicateFn(ctx, comboID)
}
func (m *mockService) Restore(ctx context.Context, id int64) (validation.ValidationResult, error) {
	return m.restoreFn(ctx, id)
}

// AcknowledgeGameVersion は FR702 の「確認した」(M28-02a)。
// ★本モックは既存ハンドラテストを通すためのものであり、経路の検証は
//
//	m28_02a_handler_test.go と service 層のテストが持つ。
func (m *mockService) AcknowledgeGameVersion(ctx context.Context, id int64) (*model.Combo, error) {
	if m.acknowledgeGameVersionFn != nil {
		return m.acknowledgeGameVersionFn(ctx, id)
	}
	return &model.Combo{ID: id}, nil
}
func (m *mockService) PermanentDelete(ctx context.Context, id int64) error {
	if m.permanentDeleteFn != nil {
		return m.permanentDeleteFn(ctx, id)
	}
	return nil
}
func (m *mockService) Materialize(ctx context.Context, input combosvc.MaterializeInput) (*combosvc.MaterializeResult, validation.ValidationResult, error) {
	if m.materializeFn != nil {
		return m.materializeFn(ctx, input)
	}
	return &combosvc.MaterializeResult{}, validation.ValidationResult{}, nil
}
func (m *mockService) CheckDuplicate(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error) {
	if m.checkDuplicateFn != nil {
		return m.checkDuplicateFn(ctx, input)
	}
	return &combosvc.CheckDuplicateResult{}, nil
}

// ===========================================================================
// モック setupSvc
// ===========================================================================

type mockSetupService struct {
	listSetupsByComboIDFn func(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error)
	listResultsFn         func(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error)
}

func (m *mockSetupService) CreateSetup(ctx context.Context, parentComboID int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return nil, validation.ValidationResult{}, nil
}

// CheckSetupDuplicate は M23-09 の保存前チェック。本パッケージのテストは呼ばない。
func (m *mockSetupService) CheckSetupDuplicate(_ context.Context, _ int64, _ setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error) {
	return &setupsvc.CheckSetupDuplicateResult{
		Duplicates:        []model.SetupRef{},
		DeletedDuplicates: []model.SetupRef{},
	}, nil
}
func (m *mockSetupService) CreateSetupInTx(_ context.Context, _ *sql.Tx, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return nil, validation.ValidationResult{}, nil
}
func (m *mockSetupService) CreateSetupLink(ctx context.Context, comboID, setupID int64) error {
	return nil
}
func (m *mockSetupService) DeleteSetupLink(ctx context.Context, comboID, setupID int64) error {
	return nil
}
func (m *mockSetupService) GetSetup(ctx context.Context, setupID int64) (*setupsvc.SetupResponse, error) {
	return nil, nil
}
func (m *mockSetupService) UpdateSetup(ctx context.Context, setupID int64, input setupsvc.UpdateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return nil, validation.ValidationResult{}, nil
}
func (m *mockSetupService) DeleteSetup(ctx context.Context, setupID int64, unlinkFrom *int64) error {
	return nil
}
func (m *mockSetupService) GetSetupCandidates(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
	return nil, nil
}
func (m *mockSetupService) GetSetupCandidatesByKnockdown(ctx context.Context, characterID int64, knockdownAdvantage *int) ([]*setupsvc.SetupResponse, error) {
	return nil, nil
}
func (m *mockSetupService) ListSetups(ctx context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error) {
	return nil, nil
}
func (m *mockSetupService) ListSetupsByComboID(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
	if m.listSetupsByComboIDFn != nil {
		return m.listSetupsByComboIDFn(ctx, comboID)
	}
	return []*setupsvc.SetupResponse{}, nil
}
func (m *mockSetupService) ListSetupsByComboIDs(_ context.Context, _ []int64) (map[int64][]*setupsvc.SetupResponse, error) {
	return map[int64][]*setupsvc.SetupResponse{}, nil
}

// M19-03: セットプレイ成立条件。
func (m *mockSetupService) ListResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error) {
	if m.listResultsFn != nil {
		return m.listResultsFn(ctx, comboID)
	}
	return nil, nil
}
func (m *mockSetupService) UpsertResult(_ context.Context, _, _ int64, _ setupsvc.UpsertResultInput) error {
	return nil
}
func (m *mockSetupService) DeleteResult(_ context.Context, _, _ int64, _ string, _ bool) error {
	return nil
}

// M23-02: ゴミ箱(復元・完全削除・削除済み一覧)。本テストは combo 側の経路のみを見るため未使用。
func (m *mockSetupService) Restore(_ context.Context, _ int64) (validation.ValidationResult, error) {
	return validation.ValidationResult{}, nil
}

// FindDeletedSetupRefsByComboIDInTx は M23-04 で Service へ追加された(VAL-R01 用)。
// 本モックは削除済みセットプレイを持たないため、常に空を返す。
func (m *mockSetupService) FindDeletedSetupRefsByComboIDInTx(_ context.Context, _ *sql.Tx, _ int64) ([]model.SetupRef, error) {
	return nil, nil
}

// CheckTrashDuplicateSetup は M23-05 の VAL-S07。本モックは警告 0 件で固定する
// (コンボ側ハンドラのテストはセットプレイ側の警告を対象にしていない)。
func (m *mockSetupService) CheckTrashDuplicateSetup(_ context.Context, _, _ int64) validation.ValidationResult {
	return validation.ValidationResult{}
}
func (m *mockSetupService) PermanentDelete(_ context.Context, _ int64) error { return nil }
func (m *mockSetupService) ListDeletedSetups(_ context.Context, _ *int64) ([]*setupsvc.SetupResponse, error) {
	return []*setupsvc.SetupResponse{}, nil
}

// 静的アサーション
var _ setupsvc.Service = (*mockSetupService)(nil)

// ===========================================================================
// テスト用 server セットアップ
// ===========================================================================

func newTestServer(t *testing.T, svc *mockService) *echo.Echo {
	t.Helper()
	return newTestServerWithNotation(t, svc, nil)
}

func newTestServerWithNotation(t *testing.T, svc *mockService, n notation.Service) *echo.Echo {
	t.Helper()
	e := echo.New()
	api := e.Group("/api")
	combohandler.RegisterRoutes(api, combohandler.NewHandler(svc, n, nil))
	return e
}

func newTestServerWithSetup(t *testing.T, svc *mockService, setupSvc *mockSetupService) *echo.Echo {
	t.Helper()
	e := echo.New()
	api := e.Group("/api")
	combohandler.RegisterRoutes(api, combohandler.NewHandler(svc, nil, setupSvc))
	return e
}

func ptr[T any](v T) *T { return &v }

// ===========================================================================
// POST /api/combos
// ===========================================================================

func TestHandler_Create_201(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: 1, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false,"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ID != 1 {
		t.Errorf("ID = %d, want 1", resp.ID)
	}
}

func TestHandler_Create_400_ValidationError(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			r := validation.ValidationResult{}
			r.AddError("VAL-C09", "steps", "レシピが空です")
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "validation_failed" {
		t.Errorf("Error.Code = %q, want validation_failed", resp.Error.Code)
	}
	if resp.Error.Details == nil {
		t.Fatal("expected Details to be set")
	}
	if _, ok := resp.Error.Details["validations"]; !ok {
		t.Errorf("expected Details to contain validations")
	}
}

func TestHandler_Create_400_BadJSON(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			t.Error("service should not be called for bad JSON")
			return nil, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(`{"x":`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// GET /api/combos/:id
// ===========================================================================

func TestHandler_Get_200(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.ID != 42 {
		t.Errorf("ID = %d, want 42", resp.ID)
	}
}

func TestHandler_Get_404(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return nil, combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestHandler_Get_400_InvalidID(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/abc", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// GET /api/combos
// ===========================================================================

func TestHandler_List_200(t *testing.T) {
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			return []*model.Combo{
				{ID: 1, CharacterID: 1, Version: 1},
				{ID: 2, CharacterID: 1, Version: 1},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?character_id=1&limit=50", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var resp combohandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Count != 2 || len(resp.Items) != 2 {
		t.Errorf("count/items mismatch: %+v", resp)
	}
}

func TestHandler_List_OnlyDeleted(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?character_id=1&only_deleted=true", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if !capturedFilter.OnlyDeleted {
		t.Error("OnlyDeleted should be true when only_deleted=true")
	}
	if capturedFilter.IncludeDeleted {
		t.Error("IncludeDeleted should be false when only_deleted=true overrides")
	}
}

func TestHandler_List_OnlyDeleted_OverridesIncludeDeleted(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?only_deleted=true&include_deleted=true", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if !capturedFilter.OnlyDeleted {
		t.Error("OnlyDeleted should be true")
	}
	if capturedFilter.IncludeDeleted {
		t.Error("IncludeDeleted should be false when only_deleted=true is specified")
	}
}

func TestHandler_List_TagIds_Parsed(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?tag_ids=1,2,3", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	want := []int64{1, 2, 3}
	if len(capturedFilter.TagIDs) != len(want) {
		t.Fatalf("TagIDs len = %d, want %d", len(capturedFilter.TagIDs), len(want))
	}
	for i, v := range want {
		if capturedFilter.TagIDs[i] != v {
			t.Errorf("TagIDs[%d] = %d, want %d", i, capturedFilter.TagIDs[i], v)
		}
	}
}

func TestHandler_List_TagIds_Invalid(t *testing.T) {
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?tag_ids=abc", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	var errResp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
		t.Fatal(err)
	}
	if errResp.Error.Code != "invalid_query_param" {
		t.Errorf("error code = %q, want invalid_query_param", errResp.Error.Code)
	}
}

func TestHandler_List_SituationFilters_Parsed(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?position=mid_screen&hit_type=counter&opponent_stance=standing", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedFilter.Position == nil || *capturedFilter.Position != "mid_screen" {
		t.Errorf("Position = %v, want mid_screen", capturedFilter.Position)
	}
	if capturedFilter.HitType == nil || *capturedFilter.HitType != "counter" {
		t.Errorf("HitType = %v, want counter", capturedFilter.HitType)
	}
	if capturedFilter.OpponentStance == nil || *capturedFilter.OpponentStance != "standing" {
		t.Errorf("OpponentStance = %v, want standing", capturedFilter.OpponentStance)
	}
}

// ★★M27-03(P4M-022): 始動技による絞り込み。
//
// リポジトリ層は着手前から StarterMoveIDs と `starter_move_id IN (…)` を持っており、
// 足りていなかったのは本ハンドラの受け口だけだった。⇒ ここが唯一の新しい面である。
func TestHandler_List_StarterMoveID_Parsed(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?starter_move_id=42", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if len(capturedFilter.StarterMoveIDs) != 1 || capturedFilter.StarterMoveIDs[0] != 42 {
		t.Errorf("StarterMoveIDs = %v, want [42]", capturedFilter.StarterMoveIDs)
	}
}

// ★指定が無いときは nil のままであること。空スライスを入れると
// `starter_move_id IN ()` の側へ落ちる実装を書いたときに気づけなくなる。
func TestHandler_List_StarterMoveID_AbsentIsNil(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if capturedFilter.StarterMoveIDs != nil {
		t.Errorf("StarterMoveIDs = %v, want nil", capturedFilter.StarterMoveIDs)
	}
}

func TestHandler_List_400_InvalidStarterMoveID(t *testing.T) {
	// ★★エラーコードは既存の 2 系統へ合わせる(`DES-002` §4.2)。
	//   パース失敗＝`invalid_query` ／ 値不正＝`invalid_query_param`。
	//   ★コードまで見る。status だけを見ると、1 本にまとめた実装でも緑になる。
	cases := []struct {
		q    string
		code string
	}{
		{"abc", "invalid_query"},
		{"1.5", "invalid_query"},
		{"0", "invalid_query_param"},
		{"-1", "invalid_query_param"},
	}
	for _, tc := range cases {
		svc := &mockService{
			listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
				t.Errorf("starter_move_id=%q でサービスが呼ばれた(400 で止まるべき)", tc.q)
				return []*model.Combo{}, nil
			},
		}
		e := newTestServer(t, svc)

		req := httptest.NewRequest(http.MethodGet, "/api/combos?starter_move_id="+tc.q, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("starter_move_id=%q: status = %d, want 400", tc.q, rec.Code)
			continue
		}
		if !strings.Contains(rec.Body.String(), tc.code) {
			t.Errorf("starter_move_id=%q: body = %s, want code %s", tc.q, rec.Body.String(), tc.code)
		}
	}
}

func TestHandler_List_CombinedFilters(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?character_id=1&tag_ids=5&position=corner_self&is_draft=true&sort=damage&order=asc", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedFilter.CharacterID == nil || *capturedFilter.CharacterID != 1 {
		t.Errorf("CharacterID = %v, want 1", capturedFilter.CharacterID)
	}
	if len(capturedFilter.TagIDs) != 1 || capturedFilter.TagIDs[0] != 5 {
		t.Errorf("TagIDs = %v, want [5]", capturedFilter.TagIDs)
	}
	if capturedFilter.Position == nil || *capturedFilter.Position != "corner_self" {
		t.Errorf("Position = %v, want corner_self", capturedFilter.Position)
	}
	if capturedFilter.IsDraft == nil || !*capturedFilter.IsDraft {
		t.Errorf("IsDraft = %v, want true", capturedFilter.IsDraft)
	}
	if capturedFilter.Sort != "damage" {
		t.Errorf("Sort = %q, want damage", capturedFilter.Sort)
	}
	if capturedFilter.Order != "asc" {
		t.Errorf("Order = %q, want asc", capturedFilter.Order)
	}
}

// is_draft のパース失敗は character_id / tag_ids と同様に 400 を返す(B10)。
// 以前は黙殺されフィルタ未適用のまま全件を返していた。
func TestHandler_List_400_InvalidIsDraft(t *testing.T) {
	called := false
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			called = true
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?is_draft=yes", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if called {
		t.Error("List service should not be called when is_draft is invalid")
	}
}

// ---------------------------------------------------------------------------
// 成立条件による絞り込み(M19-06 §4-6)
// ---------------------------------------------------------------------------

func TestHandler_List_SetupResultFilters_Parsed(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet,
		"/api/combos?setup_result=unverified&setup_tech_type=back_tech&setup_in_corner=true", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedFilter.SetupResult == nil || *capturedFilter.SetupResult != model.SetupResultUnverified {
		t.Errorf("SetupResult = %v, want unverified", capturedFilter.SetupResult)
	}
	if capturedFilter.SetupTechType == nil || *capturedFilter.SetupTechType != model.OkiTechTypeBack {
		t.Errorf("SetupTechType = %v, want back_tech", capturedFilter.SetupTechType)
	}
	if capturedFilter.SetupInCorner == nil || !*capturedFilter.SetupInCorner {
		t.Errorf("SetupInCorner = %v, want true", capturedFilter.SetupInCorner)
	}
}

// 未指定なら 3 項目とも nil(＝絞り込まない)であることの対固定。
func TestHandler_List_SetupResultFilters_AbsentAreNil(t *testing.T) {
	var capturedFilter combosvc.ListFilter
	svc := &mockService{
		listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
			capturedFilter = filter
			return []*model.Combo{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?position=mid_screen", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedFilter.SetupResult != nil || capturedFilter.SetupTechType != nil || capturedFilter.SetupInCorner != nil {
		t.Errorf("want all nil, got result=%v tech=%v corner=%v",
			capturedFilter.SetupResult, capturedFilter.SetupTechType, capturedFilter.SetupInCorner)
	}
}

// 値域外は 400。ok / ng / unverified 以外、OKI_TECH_TYPES 外、真偽値でない画面端。
func TestHandler_List_400_InvalidSetupResultFilters(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{"成立状態が値域外", "setup_result=maybe"},
		{"成立状態に保存値でない語", "setup_result=OK"},
		{"受け身種別が値域外", "setup_result=ok&setup_tech_type=quick_rise"},
		{"画面端が真偽値でない", "setup_result=ok&setup_in_corner=corner"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			svc := &mockService{
				listFn: func(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error) {
					called = true
					return []*model.Combo{}, nil
				},
			}
			e := newTestServer(t, svc)

			req := httptest.NewRequest(http.MethodGet, "/api/combos?"+tc.query, nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
			if called {
				t.Error("値域外のときに List サービスを呼んではいけない")
			}
		})
	}
}

// wantVersionConflictCode は版不一致のときに応答本文へ現れるべきコード文字列。
//
// ★あえてリテラルで書く。model.ErrorCodeVersionConflict を参照すると、定数の値を
// 変えたときにテストも一緒に動いてしまい、「通信の契約が変わった」ことを検出できない
// (M22-03 の破壊確認 B で実際に空振りした)。ここが固定するのは Go の内部整合ではなく
// 線を流れる文字列である。
const wantVersionConflictCode = "version_conflict"

// ===========================================================================
// PATCH /api/combos/:id
// ===========================================================================

func TestHandler_UpdateMetadata_200(t *testing.T) {
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: id, Version: version + 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1,"memo":"updated"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
}

// presence-detection の JSON デコード経路を検証する(CHANGE-043)。
// repo テストは struct リテラル(Some/Null)で UnmarshalJSON を経由しないため、
// 「キー不在 / null / 値」の3状態が実 JSON から正しく Optional へ写ることを本テストで確認する。
func TestHandler_UpdateMetadata_Tristate(t *testing.T) {
	var captured combosvc.UpdateMetadataInput
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			captured = input
			return &model.Combo{ID: id, Version: version + 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	// memo=値(更新) / damage=null(NULL クリア) / situation 不在(不変更)。
	body := `{"version":1,"memo":"hello","damage":null}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	// memo: present + 値
	if !captured.Memo.Present || captured.Memo.Value == nil || *captured.Memo.Value != "hello" {
		t.Errorf("memo: want present+value 'hello', got %+v", captured.Memo)
	}
	// damage: present + null(NULL クリア)
	if !captured.Damage.Present || captured.Damage.Value != nil {
		t.Errorf("damage: want present+null, got %+v", captured.Damage)
	}
	// situation: 不在(不変更)
	if captured.Situation.Present {
		t.Errorf("situation: want absent, got present %+v", captured.Situation)
	}
}

// メディア 3 列(M17-01)の presence-detection JSON デコード経路を検証する。
// link=値(更新) / videoPath=null(NULL クリア) / imagePath 不在(不変更)。
func TestHandler_UpdateMetadata_MediaTristate(t *testing.T) {
	var captured combosvc.UpdateMetadataInput
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			captured = input
			return &model.Combo{ID: id, Version: version + 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1,"link":"https://example.com/guide","videoPath":null}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	// link: present + 値
	if !captured.Link.Present || captured.Link.Value == nil || *captured.Link.Value != "https://example.com/guide" {
		t.Errorf("link: want present+value, got %+v", captured.Link)
	}
	// videoPath: present + null(NULL クリア)
	if !captured.VideoPath.Present || captured.VideoPath.Value != nil {
		t.Errorf("videoPath: want present+null, got %+v", captured.VideoPath)
	}
	// imagePath: 不在(不変更)
	if captured.ImagePath.Present {
		t.Errorf("imagePath: want absent, got present %+v", captured.ImagePath)
	}
}

// M22-03 §5.1-1: 版が古いとき 409 かつエラーコード version_conflict が返ること。
//
// ★ステータスだけを見るテストにしないこと(§4.1-2)。409 は一意制約違反でも返るため
// (プリセットの表記衝突 alias_conflict 等)、ステータスのみの固定では版の突き合わせを
// 外しても別の理由の 409 で緑になりうる。⇒ コード文字列まで固定する。
func TestHandler_UpdateMetadata_409_VersionConflict(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			gotVersion = version
			return nil, validation.ValidationResult{}, combosvc.ErrConflict
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":99,"memo":"x"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != wantVersionConflictCode {
		t.Errorf("Error.Code = %q, want %q", resp.Error.Code, wantVersionConflictCode)
	}
	// 受け取った version が突き合わせ側まで届いていること(絞り込みの網)。
	if gotVersion != 99 {
		t.Errorf("version passed to service = %d, want 99", gotVersion)
	}
}

// M22-03 §5.1-2: 版が一致するときは通ること。
//
// ★拒否側だけを固定すると「常に拒否する」実装でも緑になる(§4.1-4)。
func TestHandler_UpdateMetadata_200_VersionMatches(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			gotVersion = version
			return &model.Combo{ID: 5, CharacterID: 1, Version: version + 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":3,"memo":"x"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if gotVersion != 3 {
		t.Errorf("version passed to service = %d, want 3", gotVersion)
	}
}

// 本登録昇格(is_draft: false)時のフルバリデーションで ERROR が出たケース。
// サービスは combo=nil, result(error あり), err=nil を返す。
// ハンドラはこれを 400 + validations で返さなければならない(以前は nil の
// toComboResponse で 500 panic になっていた = バグ #5 の真の原因)。
func TestHandler_UpdateMetadata_400_PromoteValidationError(t *testing.T) {
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			r := validation.ValidationResult{}
			r.AddError("VAL-C09", "steps", "レシピが空です")
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1,"isDraft":false}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "validation_failed" {
		t.Errorf("Error.Code = %q, want validation_failed", resp.Error.Code)
	}
	if resp.Error.Details == nil {
		t.Fatal("expected Details to be set")
	}
	if _, ok := resp.Error.Details["validations"]; !ok {
		t.Errorf("expected Details to contain validations")
	}
}

func TestHandler_UpdateMetadata_404(t *testing.T) {
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/999", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// PUT /api/combos/:id
// ===========================================================================

// M22-03 §5.1-2 も兼ねる: 版が一致するときは通ること(PUT 経路)。
func TestHandler_UpdateWithKeyChange_201(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateKFn: func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			gotVersion = version
			return &model.Combo{ID: 100, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	reqBody, _ := json.Marshal(combohandler.PutRequest{
		Version: 1,
		CreateRequest: combohandler.CreateRequest{
			CharacterID: 1,
			Position:    ptr("corner_self"),
		},
	})
	req := httptest.NewRequest(http.MethodPut, "/api/combos/5", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if gotVersion != 1 {
		t.Errorf("version passed to service = %d, want 1", gotVersion)
	}
}

// M22-03 §5.1-1: PUT 経路も 409 ＋ version_conflict で固定する。
// ★PATCH と同じ理由でコード文字列まで見る(§4.1-2)。
func TestHandler_UpdateWithKeyChange_409_VersionConflict(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateKFn: func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			gotVersion = version
			return nil, validation.ValidationResult{}, combosvc.ErrConflict
		},
	}
	e := newTestServer(t, svc)

	reqBody, _ := json.Marshal(combohandler.PutRequest{Version: 99})
	req := httptest.NewRequest(http.MethodPut, "/api/combos/5", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != wantVersionConflictCode {
		t.Errorf("Error.Code = %q, want %q", resp.Error.Code, wantVersionConflictCode)
	}
	if gotVersion != 99 {
		t.Errorf("version passed to service = %d, want 99", gotVersion)
	}
}

func TestHandler_UpdateWithKeyChange_InvalidTagID_400(t *testing.T) {
	svc := &mockService{
		updateKFn: func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrInvalidTagID
		},
	}
	e := newTestServer(t, svc)

	reqBody, _ := json.Marshal(combohandler.PutRequest{
		Version: 1,
		CreateRequest: combohandler.CreateRequest{
			CharacterID: 1,
			TagIDs:      []int64{9999},
		},
	})
	req := httptest.NewRequest(http.MethodPut, "/api/combos/5", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "invalid_tag_id") {
		t.Errorf("expected invalid_tag_id in body, got: %s", rec.Body.String())
	}
}

// ===========================================================================
// DELETE /api/combos/:id
// ===========================================================================

func TestHandler_Delete_204(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, id int64) error { return nil },
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/5", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
}

func TestHandler_Delete_404(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, id int64) error { return combosvc.ErrNotFound },
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// TestHandler_Delete_204_OnAlreadyDeleted は論理削除済みコンボに対して再度 DELETE を
// 投げた場合も 204 が返ることを保証する。
//
// ★冪等に成功することは契約である(DES-002 §4.2・CHANGE-123 / M23-03)。削除は「消す」
// 意図であり、2 度目に 404 を返すと「消したいのに消せない」経路が生まれる。
// この挙動を仕様として明示テストで担保する(M1-03 機械レビュー指摘・低-5)。
//
// ★M23-08 §4.4 で根拠が変わった。リポジトリ層の SoftDelete は
// `WHERE id = ? AND deleted_at IS NULL` を課すため、2 度目は RowsAffected=0 になる。
// 0 行のときに行の存在を数え直し、既に削除済みなら成功(nil)を返すことで冪等性を保つ
// (deleted_at は最初の値のまま＝消した日がずれない)。ハンドラ層の 204 は不変である。
// ★本テストは mockService を使うため実 DB を見ない。リポジトリ層の実挙動は
// internal/repository/combo/soft_delete_idempotent_test.go が守っている。
func TestHandler_Delete_204_OnAlreadyDeleted(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, id int64) error { return nil },
	}
	e := newTestServer(t, svc)

	// 1 回目の DELETE: 204
	req1 := httptest.NewRequest(http.MethodDelete, "/api/combos/5", nil)
	rec1 := httptest.NewRecorder()
	e.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusNoContent {
		t.Errorf("first DELETE: status = %d, want 204", rec1.Code)
	}

	// 2 回目の DELETE(既に削除済み)も 204
	req2 := httptest.NewRequest(http.MethodDelete, "/api/combos/5", nil)
	rec2 := httptest.NewRecorder()
	e.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNoContent {
		t.Errorf("second DELETE (idempotent): status = %d, want 204", rec2.Code)
	}
}

// ===========================================================================
// POST /api/combos/:id/restore
// ===========================================================================

func TestHandler_Restore_200(t *testing.T) {
	svc := &mockService{
		restoreFn: func(ctx context.Context, id int64) (validation.ValidationResult, error) {
			return validation.ValidationResult{}, nil
		},
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/5/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

// ===========================================================================
// M23-04 §5.2: 復元の 200 応答へ warnings が載る / 0 件ならキーごと出ない
// ===========================================================================

// ★JSON レベルで見る。Go の構造体で見ると omitempty の効きを検査できず、
// 「空配列を返している」形(フロントが誤って分岐する＝§4.3-2)を見逃す。
func TestHandler_Restore_200_WithWarnings(t *testing.T) {
	var warned validation.ValidationResult
	warned.AddWarningWithDetails(validation.CodeR01LinkedSetupsDeleted, "",
		"紐付いているセットプレイ 1 件がゴミ箱にあります",
		map[string]any{"setups": []any{model.SetupRef{ID: 7}}})

	svc := &mockService{
		restoreFn: func(ctx context.Context, id int64) (validation.ValidationResult, error) {
			return warned, nil
		},
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/5/restore", nil)
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
	items, ok := body["warnings"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("warnings = %v, want 1 件の配列", body["warnings"])
	}
	first, _ := items[0].(map[string]any)
	if first["code"] != validation.CodeR01LinkedSetupsDeleted {
		t.Errorf("warnings[0].code = %v, want %s", first["code"], validation.CodeR01LinkedSetupsDeleted)
	}
	// ★details は「どれが問題か」を id 付きで返す(§4.3-3)。
	details, ok := first["details"].(map[string]any)
	if !ok {
		t.Fatalf("warnings[0].details が無い: %v", first)
	}
	if _, ok := details["setups"]; !ok {
		t.Errorf("details.setups が無い: %v", details)
	}
	// ★既存の validations フィールドは別物であり、混ざっていないこと。
	if v, ok := body["validations"]; ok {
		t.Errorf("復元応答に validations が入っている(warnings と混同している): %v", v)
	}
}

// ★警告 0 件のときはキーごと出さない(§4.3-2)。
func TestHandler_Restore_200_OmitsWarningsWhenEmpty(t *testing.T) {
	svc := &mockService{
		restoreFn: func(ctx context.Context, id int64) (validation.ValidationResult, error) {
			return validation.ValidationResult{}, nil
		},
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/5/restore", nil)
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
		restoreFn: func(ctx context.Context, id int64) (validation.ValidationResult, error) {
			return validation.ValidationResult{}, combosvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPost, "/api/combos/999/restore", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// 500 internal error 経路
// ===========================================================================

func TestHandler_Get_500_InternalError(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return nil, errors.New("db gone")
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

// ===========================================================================
// GET /api/combos/:id/recipe
// ===========================================================================

func TestHandler_GetRecipe_200(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1}, nil
		},
	}
	notSvc := &mockNotationService{
		resolveFn: func(ctx context.Context, comboID, presetID int64) (string, error) {
			return "立ち弱P > 立ち中P > 中波動拳", nil
		},
	}
	e := newTestServerWithNotation(t, svc, notSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42/recipe?preset_id=1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.RecipeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ComboID != 42 || resp.PresetID != 1 {
		t.Errorf("ids mismatch: %+v", resp)
	}
	if resp.Text == "" {
		t.Errorf("text should be populated")
	}
}

func TestHandler_GetRecipe_400_MissingPresetID(t *testing.T) {
	svc := &mockService{}
	notSvc := &mockNotationService{}
	e := newTestServerWithNotation(t, svc, notSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42/recipe", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestHandler_GetRecipe_404_ComboNotFound(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return nil, combosvc.ErrNotFound
		},
	}
	notSvc := &mockNotationService{}
	e := newTestServerWithNotation(t, svc, notSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/999/recipe?preset_id=1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestHandler_GetRecipe_404_PresetNotFound(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1}, nil
		},
	}
	notSvc := &mockNotationService{
		resolveFn: func(ctx context.Context, comboID, presetID int64) (string, error) {
			return "", fmt.Errorf("resolve combo recipe: %w", notation.ErrPresetNotFound)
		},
	}
	e := newTestServerWithNotation(t, svc, notSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42/recipe?preset_id=9999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

// ===========================================================================
// tagIds(M3-02)
// ===========================================================================

func TestHandler_Create_WithTagIDs_OK(t *testing.T) {
	var capturedInput combosvc.CreateInput
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			capturedInput = input
			return &model.Combo{ID: 1, CharacterID: 1, Tags: []model.Tag{}}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false,"tagIds":[1,2],"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if len(capturedInput.TagIDs) != 2 || capturedInput.TagIDs[0] != 1 || capturedInput.TagIDs[1] != 2 {
		t.Errorf("TagIDs not passed correctly: %v", capturedInput.TagIDs)
	}
}

func TestHandler_Create_InvalidTagID_400(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrInvalidTagID
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false,"tagIds":[9999],"steps":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "invalid_tag_id") {
		t.Errorf("expected invalid_tag_id in body, got: %s", rec.Body.String())
	}
}

func TestHandler_UpdateMetadata_WithTagIDs_OK(t *testing.T) {
	var capturedInput combosvc.UpdateMetadataInput
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			capturedInput = input
			return &model.Combo{ID: id, Version: version + 1, Tags: []model.Tag{}}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1,"tagIds":[3,4]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedInput.TagIDs == nil {
		t.Fatal("TagIDs should not be nil")
	}
	if len(*capturedInput.TagIDs) != 2 {
		t.Errorf("expected 2 tagIds, got %d", len(*capturedInput.TagIDs))
	}
}

func TestHandler_UpdateMetadata_WithoutTagIDs_NilTagIDs(t *testing.T) {
	var capturedInput combosvc.UpdateMetadataInput
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			capturedInput = input
			return &model.Combo{ID: id, Version: version + 1, Tags: []model.Tag{}}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	// tagIds フィールド自体を含まないリクエスト
	body := `{"version":1,"memo":"no tag change"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedInput.TagIDs != nil {
		t.Errorf("TagIDs should be nil when tagIds field is absent, got %v", capturedInput.TagIDs)
	}
}

func TestHandler_UpdateMetadata_EmptyTagIDs_RemovesAll(t *testing.T) {
	var capturedInput combosvc.UpdateMetadataInput
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			capturedInput = input
			return &model.Combo{ID: id, Version: version + 1, Tags: []model.Tag{}}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	// tagIds: [] で全解除
	body := `{"version":1,"tagIds":[]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if capturedInput.TagIDs == nil {
		t.Fatal("TagIDs should not be nil for empty array")
	}
	if len(*capturedInput.TagIDs) != 0 {
		t.Errorf("TagIDs should be empty slice for []")
	}
}

func TestHandler_UpdateMetadata_InvalidTagID_400(t *testing.T) {
	svc := &mockService{
		updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, combosvc.ErrInvalidTagID
		},
	}
	e := newTestServer(t, svc)

	body := `{"version":1,"tagIds":[9999]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/combos/5", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "invalid_tag_id") {
		t.Errorf("expected invalid_tag_id in body, got: %s", rec.Body.String())
	}
}

// ===========================================================================
// GET /api/combos — DefaultRecipe / StarterMoveCode フィールド変換
// ===========================================================================

func TestHandler_List_200_Fields(t *testing.T) {
	code := "standing_light_punch"
	svc := &mockService{
		listFn: func(_ context.Context, _ combosvc.ListFilter) ([]*model.Combo, error) {
			return []*model.Combo{
				{
					ID: 1, CharacterID: 1, Version: 1,
					DefaultRecipe:   "立ち弱P > 弱波動拳",
					StarterMoveCode: &code,
				},
				{
					ID: 2, CharacterID: 1, Version: 1,
					DefaultRecipe:   "",
					StarterMoveCode: nil,
				},
			}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos?character_id=1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp combohandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Items))
	}

	// combo1: DefaultRecipe / StarterMoveCode が JSON に反映される
	if resp.Items[0].DefaultRecipe != "立ち弱P > 弱波動拳" {
		t.Errorf("Items[0].DefaultRecipe = %q, want %q", resp.Items[0].DefaultRecipe, "立ち弱P > 弱波動拳")
	}
	if resp.Items[0].StarterMoveCode != "standing_light_punch" {
		t.Errorf("Items[0].StarterMoveCode = %q, want %q", resp.Items[0].StarterMoveCode, "standing_light_punch")
	}

	// combo2: nil StarterMoveCode は derefString により空文字に変換される
	if resp.Items[1].DefaultRecipe != "" {
		t.Errorf("Items[1].DefaultRecipe = %q, want empty", resp.Items[1].DefaultRecipe)
	}
	if resp.Items[1].StarterMoveCode != "" {
		t.Errorf("Items[1].StarterMoveCode = %q, want empty (nil→derefString)", resp.Items[1].StarterMoveCode)
	}
}

// 静的アサーション: モックが notation.Service インタフェースを満たすことを保証。
var _ notation.Service = (*mockNotationService)(nil)

// ===========================================================================
// GET /api/combos/:id — setups フィールドが埋め込まれること (M4-02 案 B1)
// ===========================================================================

func TestHandler_Get_200_IncludesSetups(t *testing.T) {
	name := "テストセットプレイ"
	setupResp := &setupsvc.SetupResponse{
		Setup: &model.Setup{
			ID:          10,
			CharacterID: 1,
			Name:        &name,
			StepCount:   2,
			Version:     1,
		},
		DefaultRecipe:  "立ち弱P > 弱波動拳",
		ParentComboIDs: []int64{42},
	}

	comboSvc := &mockService{
		getFn: func(_ context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
	}
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
			if comboID != 42 {
				t.Errorf("comboID = %d, want 42", comboID)
			}
			return []*setupsvc.SetupResponse{setupResp}, nil
		},
	}
	e := newTestServerWithSetup(t, comboSvc, setupSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/42", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Setups) != 1 {
		t.Fatalf("Setups len = %d, want 1; body=%s", len(resp.Setups), rec.Body.String())
	}
	if resp.Setups[0].ID != 10 {
		t.Errorf("Setups[0].ID = %d, want 10", resp.Setups[0].ID)
	}
	if resp.Setups[0].DefaultRecipe != "立ち弱P > 弱波動拳" {
		t.Errorf("Setups[0].DefaultRecipe = %q", resp.Setups[0].DefaultRecipe)
	}
}

// TestHandler_Get_200_SetupsEmptyArray は setupSvc が空スライスを返した場合に
// レスポンス JSON の setups フィールドが [] (null でない空配列) になることを確認する。
// dto.go から omitempty を除去したことの回帰テスト。
func TestHandler_Get_200_SetupsEmptyArray(t *testing.T) {
	comboSvc := &mockService{
		getFn: func(_ context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{ID: id, CharacterID: 1, Version: 1, Steps: []model.ComboStep{}}, nil
		},
	}
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{}, nil
		},
	}
	e := newTestServerWithSetup(t, comboSvc, setupSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, `"setups":[]`) {
		t.Errorf("expected setups:[] in JSON, got: %s", body)
	}
}

// ===========================================================================
// POST /api/combos — M4-04 bundled setups
// ===========================================================================

func TestHandler_Create_201_WithSetups(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return &model.Combo{ID: 10, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
	}
	setupSvc := &mockSetupService{
		listSetupsByComboIDFn: func(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{
				{
					Setup:          &model.Setup{ID: 100, CharacterID: 1, Name: ptr("テストSP"), StepCount: 1, Version: 1},
					DefaultRecipe:  "立ち弱P",
					ParentComboIDs: []int64{10},
				},
			}, nil
		},
	}
	e := newTestServerWithSetup(t, svc, setupSvc)

	body := `{"characterId":1,"isDraft":false,"steps":[],"setups":[{"characterId":1,"steps":[{"moveId":1}]}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}

	var resp combohandler.ComboResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Setups) != 1 {
		t.Fatalf("expected 1 setup in response, got %d", len(resp.Setups))
	}
	if resp.Setups[0].ID != 100 {
		t.Errorf("setup ID = %d, want 100", resp.Setups[0].ID)
	}
}

func TestHandler_Create_400_SetupValidationError(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			r := validation.ValidationResult{}
			r.AddError("VAL-S02", "setups[0].steps", "レシピは 1 ステップ以上必要です")
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false,"steps":[{"stepOrder":1,"moveId":1}],"setups":[{"characterId":1,"steps":[]}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "validation_failed" {
		t.Errorf("Error.Code = %q, want validation_failed", resp.Error.Code)
	}
}

// M27-02a(combo-put-error-message-empty): 検証エラー応答の message が空にならないこと。
//
// ★★本テストの主眼は「1 経路が非空であること」ではなく「3 経路で非対称が無いこと」
//
//	である。着手前の実測では POST だけが文言を持ち、PUT / PATCH は Message: の行を
//	書き忘れて "message":"" を返していた。★APIError.Message に omitempty は無い。
//	⇒ 書き忘れはキーの消失ではなく空文字として応答に出る。
//
// ★★それが誰にも気づかれなかった理由は、検証エラーのテストが Error.Code しか
//
//	見ていなかったからである(着手前の実測＝Error.Message を検査するテストは
//	リポジトリ全体で 1 件も無かった)。⇒ 1 経路ずつ足すのではなく、3 経路を同じ表で
//	回して値の一致まで見る形にした。
func TestHandler_ValidationFailed_MessageIsUniformAcrossVerbs(t *testing.T) {
	failing := func() validation.ValidationResult {
		r := validation.ValidationResult{}
		r.AddError("VAL-C09", "steps", "レシピが空です")
		return r
	}
	newSvc := func() *mockService {
		return &mockService{
			createFn: func(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, failing(), nil
			},
			updateMFn: func(ctx context.Context, id int64, version int, input combosvc.UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, failing(), nil
			},
			updateKFn: func(ctx context.Context, oldID int64, version int, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
				return nil, failing(), nil
			},
		}
	}

	putBody, _ := json.Marshal(combohandler.PutRequest{
		Version:       1,
		CreateRequest: combohandler.CreateRequest{CharacterID: 1},
	})

	cases := []struct {
		name   string
		method string
		path   string
		body   []byte
	}{
		{"POST /api/combos", http.MethodPost, "/api/combos", []byte(`{"characterId":1,"isDraft":false}`)},
		{"PATCH /api/combos/:id", http.MethodPatch, "/api/combos/5", []byte(`{"version":1,"isDraft":false}`)},
		{"PUT /api/combos/:id", http.MethodPut, "/api/combos/5", putBody},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newTestServer(t, newSvc())
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
			}
			var resp model.APIErrorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if resp.Error.Code != model.ErrorCodeValidationFailed {
				t.Errorf("Error.Code = %q, want %q", resp.Error.Code, model.ErrorCodeValidationFailed)
			}
			if resp.Error.Message == "" {
				t.Errorf("Error.Message is empty; want %q", model.MessageValidationFailed)
			}
			if resp.Error.Message != model.MessageValidationFailed {
				t.Errorf("Error.Message = %q, want %q", resp.Error.Message, model.MessageValidationFailed)
			}
			if _, ok := resp.Error.Details["validations"]; !ok {
				t.Error("expected Details to contain validations")
			}
		})
	}
}
