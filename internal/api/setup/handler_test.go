package setup_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	setuphandler "github.com/plexiblinp/tacpendium/internal/api/setup"
	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// wantVersionConflictCode は版不一致のときに応答本文へ現れるべきコード文字列。
//
// ★あえてリテラルで書く。model.ErrorCodeVersionConflict を参照すると、定数の値を
// 変えたときにテストも一緒に動いてしまい、「通信の契約が変わった」ことを検出できない
// (M22-03 の破壊確認 B で実際に空振りした)。ここが固定するのは Go の内部整合ではなく
// 線を流れる文字列である。
const wantVersionConflictCode = "version_conflict"

// ===========================================================================
// モック Service
// ===========================================================================

type mockService struct {
	createSetupFn                   func(ctx context.Context, parentComboID int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error)
	createSetupLinkFn               func(ctx context.Context, comboID, setupID int64) error
	deleteSetupLinkFn               func(ctx context.Context, comboID, setupID int64) error
	getSetupFn                      func(ctx context.Context, setupID int64) (*setupsvc.SetupResponse, error)
	updateSetupFn                   func(ctx context.Context, setupID int64, input setupsvc.UpdateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error)
	deleteSetupFn                   func(ctx context.Context, setupID int64, unlinkFrom *int64) error
	getSetupCandidatesFn            func(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error)
	getSetupCandidatesByKnockdownFn func(ctx context.Context, characterID int64, knockdownAdvantage *int) ([]*setupsvc.SetupResponse, error)
	listSetupsFn                    func(ctx context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error)
	listSetupsByComboIDFn           func(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error)
	// M19-03: セットプレイ成立条件。
	listResultsFn  func(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error)
	upsertResultFn func(ctx context.Context, comboID, setupID int64, input setupsvc.UpsertResultInput) error
	deleteResultFn func(ctx context.Context, comboID, setupID int64, techType string, inCorner bool) error
	// M23-02: ゴミ箱(復元・完全削除・削除済み一覧)。
	restoreFn           func(ctx context.Context, setupID int64) (validation.ValidationResult, error)
	permanentDeleteFn   func(ctx context.Context, setupID int64) error
	listDeletedSetupsFn func(ctx context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error)
	// M23-05: VAL-S07。nil のときは警告 0 件として振る舞う(既存テストを触らないため)。
	checkTrashDuplicateSetupFn func(ctx context.Context, parentComboID, setupID int64) validation.ValidationResult
	// M23-09: 保存前チェック。nil のときは 0 件として振る舞う(既存テストを触らないため)。
	checkSetupDuplicateFn func(ctx context.Context, parentComboID int64, input setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error)
}

// CheckSetupDuplicate は M23-09 の保存前チェック。★未設定なら 0 件を返す。
func (m *mockService) CheckSetupDuplicate(ctx context.Context, parentComboID int64, input setupsvc.CheckSetupDuplicateInput) (*setupsvc.CheckSetupDuplicateResult, error) {
	if m.checkSetupDuplicateFn == nil {
		return &setupsvc.CheckSetupDuplicateResult{
			Duplicates:        []model.SetupRef{},
			DeletedDuplicates: []model.SetupRef{},
		}, nil
	}
	return m.checkSetupDuplicateFn(ctx, parentComboID, input)
}

// CheckTrashDuplicateSetup は M23-05 の VAL-S07。★未設定なら空を返す——既存テストは
// 本経路を意識していないため、nil ガードが無いと CreateSetup 系が全件 panic する。
func (m *mockService) CheckTrashDuplicateSetup(ctx context.Context, parentComboID, setupID int64) validation.ValidationResult {
	if m.checkTrashDuplicateSetupFn == nil {
		return validation.ValidationResult{}
	}
	return m.checkTrashDuplicateSetupFn(ctx, parentComboID, setupID)
}

func (m *mockService) CreateSetup(ctx context.Context, parentComboID int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return m.createSetupFn(ctx, parentComboID, input)
}
func (m *mockService) CreateSetupInTx(_ context.Context, _ *sql.Tx, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return nil, validation.ValidationResult{}, nil
}
func (m *mockService) CreateSetupLink(ctx context.Context, comboID, setupID int64) error {
	return m.createSetupLinkFn(ctx, comboID, setupID)
}
func (m *mockService) DeleteSetupLink(ctx context.Context, comboID, setupID int64) error {
	return m.deleteSetupLinkFn(ctx, comboID, setupID)
}
func (m *mockService) GetSetup(ctx context.Context, setupID int64) (*setupsvc.SetupResponse, error) {
	return m.getSetupFn(ctx, setupID)
}
func (m *mockService) UpdateSetup(ctx context.Context, setupID int64, input setupsvc.UpdateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
	return m.updateSetupFn(ctx, setupID, input)
}
func (m *mockService) DeleteSetup(ctx context.Context, setupID int64, unlinkFrom *int64) error {
	return m.deleteSetupFn(ctx, setupID, unlinkFrom)
}
func (m *mockService) GetSetupCandidates(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
	return m.getSetupCandidatesFn(ctx, comboID)
}
func (m *mockService) GetSetupCandidatesByKnockdown(ctx context.Context, characterID int64, knockdownAdvantage *int) ([]*setupsvc.SetupResponse, error) {
	if m.getSetupCandidatesByKnockdownFn != nil {
		return m.getSetupCandidatesByKnockdownFn(ctx, characterID, knockdownAdvantage)
	}
	return []*setupsvc.SetupResponse{}, nil
}
func (m *mockService) ListSetups(ctx context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error) {
	if m.listSetupsFn != nil {
		return m.listSetupsFn(ctx, characterID)
	}
	return []*setupsvc.SetupResponse{}, nil
}
func (m *mockService) ListSetupsByComboID(ctx context.Context, comboID int64) ([]*setupsvc.SetupResponse, error) {
	if m.listSetupsByComboIDFn != nil {
		return m.listSetupsByComboIDFn(ctx, comboID)
	}
	return []*setupsvc.SetupResponse{}, nil
}
func (m *mockService) ListSetupsByComboIDs(_ context.Context, _ []int64) (map[int64][]*setupsvc.SetupResponse, error) {
	return map[int64][]*setupsvc.SetupResponse{}, nil
}

// M19-03: セットプレイ成立条件。
func (m *mockService) ListResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error) {
	if m.listResultsFn != nil {
		return m.listResultsFn(ctx, comboID)
	}
	return nil, nil
}
func (m *mockService) UpsertResult(ctx context.Context, comboID, setupID int64, input setupsvc.UpsertResultInput) error {
	if m.upsertResultFn != nil {
		return m.upsertResultFn(ctx, comboID, setupID, input)
	}
	return nil
}
func (m *mockService) DeleteResult(ctx context.Context, comboID, setupID int64, techType string, inCorner bool) error {
	if m.deleteResultFn != nil {
		return m.deleteResultFn(ctx, comboID, setupID, techType, inCorner)
	}
	return nil
}

// M23-02: ゴミ箱(復元・完全削除・削除済み一覧)。
func (m *mockService) Restore(ctx context.Context, setupID int64) (validation.ValidationResult, error) {
	if m.restoreFn != nil {
		return m.restoreFn(ctx, setupID)
	}
	return validation.ValidationResult{}, nil
}

// FindDeletedSetupRefsByComboIDInTx は M23-04 で Service へ追加された。
// 本モックはコンボ側の復元検証を持たないため、常に空を返す。
func (m *mockService) FindDeletedSetupRefsByComboIDInTx(_ context.Context, _ *sql.Tx, _ int64) ([]model.SetupRef, error) {
	return nil, nil
}
func (m *mockService) PermanentDelete(ctx context.Context, setupID int64) error {
	if m.permanentDeleteFn != nil {
		return m.permanentDeleteFn(ctx, setupID)
	}
	return nil
}
func (m *mockService) ListDeletedSetups(ctx context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error) {
	if m.listDeletedSetupsFn != nil {
		return m.listDeletedSetupsFn(ctx, characterID)
	}
	return []*setupsvc.SetupResponse{}, nil
}

// 静的アサーション(インターフェース追加時にモックの追随漏れを検知する)。
var _ setupsvc.Service = (*mockService)(nil)

// ===========================================================================
// テスト用 server
// ===========================================================================

func newTestServer(t *testing.T, svc *mockService) *echo.Echo {
	t.Helper()
	e := echo.New()
	api := e.Group("/api")
	setuphandler.RegisterRoutes(api, setuphandler.NewHandler(svc))
	return e
}

func sampleSetup() *model.Setup {
	name := "test setup"
	return &model.Setup{
		ID:          1,
		CharacterID: 1,
		Name:        &name,
		StepCount:   2,
		Version:     1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func sampleResponse() *setupsvc.SetupResponse {
	return &setupsvc.SetupResponse{
		Setup:          sampleSetup(),
		DefaultRecipe:  "立ち弱P > 弱波動拳",
		ParentComboIDs: []int64{10},
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setups — 正常系
// ===========================================================================

func TestHandler_CreateSetup_200(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			return sampleResponse(), validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[{"moveId":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp setuphandler.SetupResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ID != 1 {
		t.Errorf("ID = %d, want 1", resp.ID)
	}
	if resp.DefaultRecipe != "立ち弱P > 弱波動拳" {
		t.Errorf("DefaultRecipe = %q", resp.DefaultRecipe)
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setups — VAL-S05 (400 + validation_failed)
// ===========================================================================

func TestHandler_CreateSetup_400_ValidationFailed(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			r := validation.ValidationResult{}
			r.AddError("VAL-S05", "parentComboId", "親コンボ ID は必須です")
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[{"moveId":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups", strings.NewReader(body))
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

// ===========================================================================
// POST /api/combos/:comboId/setups — VAL-S04 (409 + duplicate_setup)
// ===========================================================================

func TestHandler_CreateSetup_409_DuplicateSetup(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			r := validation.ValidationResult{}
			r.AddError("VAL-S04", "", "同一レシピのセットプレイが既にこのコンボに紐付いています")
			return nil, r, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[{"moveId":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setups", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "duplicate_setup" {
		t.Errorf("Error.Code = %q, want duplicate_setup", resp.Error.Code)
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setups — 404 (combo not found)
// ===========================================================================

func TestHandler_CreateSetup_404_ComboNotFound(t *testing.T) {
	svc := &mockService{
		createSetupFn: func(_ context.Context, _ int64, _ setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{}, setupsvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"steps":[{"moveId":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/999/setups", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404; body=%s", rec.Code, rec.Body.String())
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setups — invalid comboId
// ===========================================================================

func TestHandler_CreateSetup_400_InvalidComboID(t *testing.T) {
	e := newTestServer(t, &mockService{})

	body := `{"characterId":1,"steps":[{"moveId":1}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/abc/setups", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setup-links — 正常系
// ===========================================================================

func TestHandler_CreateSetupLink_200(t *testing.T) {
	svc := &mockService{
		createSetupLinkFn: func(_ context.Context, _, _ int64) error {
			return nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"setupId":5}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setup-links", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
}

// ===========================================================================
// POST /api/combos/:comboId/setup-links — 404
// ===========================================================================

func TestHandler_CreateSetupLink_404(t *testing.T) {
	svc := &mockService{
		createSetupLinkFn: func(_ context.Context, _, _ int64) error {
			return setupsvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	body := `{"setupId":999}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos/10/setup-links", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// DELETE /api/combos/:comboId/setup-links/:setupId — 204
// ===========================================================================

func TestHandler_DeleteSetupLink_204(t *testing.T) {
	svc := &mockService{
		deleteSetupLinkFn: func(_ context.Context, _, _ int64) error {
			return nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/combos/10/setup-links/5", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204; body=%s", rec.Code, rec.Body.String())
	}
}

// ===========================================================================
// GET /api/setups/:id — 正常系
// ===========================================================================

func TestHandler_GetSetup_200(t *testing.T) {
	svc := &mockService{
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return sampleResponse(), nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp setuphandler.SetupResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.CharacterID != 1 {
		t.Errorf("characterId = %d, want 1", resp.CharacterID)
	}
}

// ===========================================================================
// GET /api/setups/:id — 404
// ===========================================================================

func TestHandler_GetSetup_404(t *testing.T) {
	svc := &mockService{
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return nil, setupsvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups/999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// PATCH /api/setups/:id — 正常系
// ===========================================================================

// M22-03 §5.1-2 も兼ねる: 版が一致するときは通ること。
// ★拒否側だけを固定すると「常に拒否する」実装でも緑になる(§4.1-4)。
func TestHandler_UpdateSetup_200(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateSetupFn: func(_ context.Context, _ int64, in setupsvc.UpdateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			gotVersion = in.Version
			return sampleResponse(), validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"name":"updated","version":1}`
	req := httptest.NewRequest(http.MethodPatch, "/api/setups/1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if gotVersion != 1 {
		t.Errorf("version passed to service = %d, want 1", gotVersion)
	}
}

// ===========================================================================
// PATCH /api/setups/:id — version conflict → 409
// ===========================================================================

// M22-03 §5.1-1: 版が古いとき 409 ＋ version_conflict。
// ★combos 系(handler_test.go の同型 2 本)と固定の強度を揃えてある(§4.1-5)。
func TestHandler_UpdateSetup_409_VersionConflict(t *testing.T) {
	var gotVersion int
	svc := &mockService{
		updateSetupFn: func(_ context.Context, _ int64, in setupsvc.UpdateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error) {
			gotVersion = in.Version
			return nil, validation.ValidationResult{}, setupsvc.ErrConflict
		},
	}
	e := newTestServer(t, svc)

	body := `{"name":"updated","version":99}`
	req := httptest.NewRequest(http.MethodPatch, "/api/setups/1", strings.NewReader(body))
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

// ===========================================================================
// DELETE /api/setups/:id — 204
// ===========================================================================

func TestHandler_DeleteSetup_204(t *testing.T) {
	svc := &mockService{
		deleteSetupFn: func(_ context.Context, _ int64, _ *int64) error {
			return nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
}

// ===========================================================================
// ★★M31-01(P4M-019) レビュー(中): DELETE /api/setups/:id?unlinkFrom= のパース
// ===========================================================================

func TestHandler_DeleteSetup_UnlinkFrom_PassedThrough(t *testing.T) {
	var got *int64
	svc := &mockService{
		deleteSetupFn: func(_ context.Context, _ int64, unlinkFrom *int64) error {
			got = unlinkFrom
			return nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1?unlinkFrom=42", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204 (body=%s)", rec.Code, rec.Body.String())
	}
	if got == nil || *got != 42 {
		t.Errorf("unlinkFrom = %v, want 42", got)
	}
}

// ★省略時は nil。⇒ 着手前と 1 バイトも変わらない挙動である。
func TestHandler_DeleteSetup_UnlinkFrom_OmittedIsNil(t *testing.T) {
	called := false
	var got *int64
	svc := &mockService{
		deleteSetupFn: func(_ context.Context, _ int64, unlinkFrom *int64) error {
			called, got = true, unlinkFrom
			return nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if !called {
		t.Fatal("service が呼ばれていない")
	}
	if got != nil {
		t.Errorf("unlinkFrom = %v, want nil", *got)
	}
}

// ★★不正値は 400。0 や負数を素通しすると、意味の無い DELETE がサービスへ届く。
func TestHandler_DeleteSetup_UnlinkFrom_Invalid400(t *testing.T) {
	for _, raw := range []string{"abc", "0", "-1"} {
		t.Run(raw, func(t *testing.T) {
			svc := &mockService{
				deleteSetupFn: func(_ context.Context, _ int64, _ *int64) error {
					t.Fatal("不正な unlinkFrom でサービスが呼ばれた")
					return nil
				},
			}
			e := newTestServer(t, svc)

			req := httptest.NewRequest(http.MethodDelete, "/api/setups/1?unlinkFrom="+raw, nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400 (body=%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

// ===========================================================================
// DELETE /api/setups/:id — 404
// ===========================================================================

func TestHandler_DeleteSetup_404(t *testing.T) {
	svc := &mockService{
		deleteSetupFn: func(_ context.Context, _ int64, _ *int64) error {
			return setupsvc.ErrNotFound
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodDelete, "/api/setups/999", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// GET /api/combos/:comboId/setup-candidates — 正常系（スタブ）
// ===========================================================================

func TestHandler_GetSetupCandidates_200(t *testing.T) {
	svc := &mockService{
		getSetupCandidatesFn: func(_ context.Context, _ int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/combos/10/setup-candidates", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
}

// ===========================================================================
// GET /api/setups/candidates?characterId=X&knockdownAdvantage=Y (C-08)
// ===========================================================================

func TestHandler_GetSetupCandidatesByCharacter_200(t *testing.T) {
	var gotCharacterID int64
	var gotKDA *int
	svc := &mockService{
		getSetupCandidatesByKnockdownFn: func(_ context.Context, characterID int64, kda *int) ([]*setupsvc.SetupResponse, error) {
			gotCharacterID = characterID
			gotKDA = kda
			return []*setupsvc.SetupResponse{sampleResponse()}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups/candidates?characterId=1&knockdownAdvantage=26", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if gotCharacterID != 1 {
		t.Errorf("characterID = %d, want 1", gotCharacterID)
	}
	if gotKDA == nil || *gotKDA != 26 {
		t.Errorf("knockdownAdvantage = %v, want 26", gotKDA)
	}
	var resp setuphandler.SetupCandidatesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Errorf("Items len = %d, want 1", len(resp.Items))
	}
}

func TestHandler_GetSetupCandidatesByCharacter_400_BadCharacterId(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups/candidates?knockdownAdvantage=26", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// GET /api/setups?characterId=X — 正常系(件数あり)
// ===========================================================================

func TestHandler_ListSetups_200_WithCharacterId(t *testing.T) {
	svc := &mockService{
		listSetupsFn: func(_ context.Context, characterID *int64) ([]*setupsvc.SetupResponse, error) {
			if characterID == nil || *characterID != 1 {
				t.Errorf("characterID = %v, want &1", characterID)
			}
			return []*setupsvc.SetupResponse{sampleResponse()}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups?characterId=1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp setuphandler.SetupListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Errorf("Items len = %d, want 1", len(resp.Items))
	}
}

// ===========================================================================
// GET /api/setups?characterId=X — 正常系(空)
// ===========================================================================

func TestHandler_ListSetups_200_EmptyResult(t *testing.T) {
	svc := &mockService{
		listSetupsFn: func(_ context.Context, _ *int64) ([]*setupsvc.SetupResponse, error) {
			return []*setupsvc.SetupResponse{}, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups?characterId=99", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var resp setuphandler.SetupListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Errorf("Items len = %d, want 0", len(resp.Items))
	}
}

// ===========================================================================
// GET /api/setups?characterId=abc — 400 (invalid)
// ===========================================================================

func TestHandler_ListSetups_400_InvalidCharacterId(t *testing.T) {
	e := newTestServer(t, &mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/setups?characterId=abc", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "invalid_query_parameter" {
		t.Errorf("Error.Code = %q, want invalid_query_parameter", resp.Error.Code)
	}
}

// ===========================================================================
// GET /api/setups (characterId 未指定) — 400 (required)
// ===========================================================================

func TestHandler_ListSetups_400_MissingCharacterId(t *testing.T) {
	e := newTestServer(t, &mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/setups", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "invalid_query_parameter" {
		t.Errorf("Error.Code = %q, want invalid_query_parameter", resp.Error.Code)
	}
}

// ===========================================================================
// camelCase JSON フィールド名確認
// ===========================================================================

func TestHandler_ResponseJSON_CamelCase(t *testing.T) {
	svc := &mockService{
		getSetupFn: func(_ context.Context, _ int64) (*setupsvc.SetupResponse, error) {
			return sampleResponse(), nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/setups/1", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	body := rec.Body.String()
	for _, field := range []string{"characterId", "stepCount", "defaultRecipe", "parentComboIds", "createdAt", "updatedAt"} {
		if !strings.Contains(body, `"`+field+`"`) {
			t.Errorf("expected camelCase field %q in response JSON, got: %s", field, body)
		}
	}

	for _, snakeField := range []string{"character_id", "step_count", "default_recipe", "parent_combo_ids", "created_at", "updated_at"} {
		if strings.Contains(body, `"`+snakeField+`"`) {
			t.Errorf("unexpected snake_case field %q in response JSON", snakeField)
		}
	}
}
