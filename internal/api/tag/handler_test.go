package tag_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/labstack/echo/v4"

	taghandler "github.com/plexiblinp/tacpendium/internal/api/tag"
	"github.com/plexiblinp/tacpendium/internal/model"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
)

// ===========================================================================
// モックサービス
// ===========================================================================

type mockService struct {
	listFn   func(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error)
	getFn    func(ctx context.Context, userID, tagID int64) (*model.Tag, error)
	createFn func(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)
	updateFn func(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error)
	deleteFn func(ctx context.Context, userID, tagID int64, force bool) error
}

func (m *mockService) ListTags(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
	if m.listFn != nil {
		return m.listFn(ctx, userID, category, includeUsage, characterID)
	}
	return []model.Tag{}, nil
}

func (m *mockService) GetTag(ctx context.Context, userID, tagID int64) (*model.Tag, error) {
	if m.getFn != nil {
		return m.getFn(ctx, userID, tagID)
	}
	return nil, tagsvc.ErrNotFound
}

func (m *mockService) CreateTag(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
	if m.createFn != nil {
		return m.createFn(ctx, userID, input)
	}
	return &model.Tag{ID: 1, UserID: userID, Name: input.Name}, nil
}

func (m *mockService) UpdateTag(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, userID, tagID, input)
	}
	return &model.Tag{ID: tagID, UserID: userID}, nil
}

func (m *mockService) DeleteTag(ctx context.Context, userID, tagID int64, force bool) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, userID, tagID, force)
	}
	return nil
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func newEcho(svc tagsvc.Service) *echo.Echo {
	e := echo.New()
	h := taghandler.NewHandler(svc)
	g := e.Group("/api")
	taghandler.RegisterRoutes(g, h)
	return e
}

func doRequest(e *echo.Echo, method, path string, body interface{}) *httptest.ResponseRecorder {
	var bodyBytes []byte
	if body != nil {
		bodyBytes, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func ptrStr(s string) *string { return &s }

// ===========================================================================
// GET /api/tags
// ===========================================================================

func TestListTags_200(t *testing.T) {
	svc := &mockService{
		listFn: func(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
			return []model.Tag{{ID: 1, UserID: 1, Name: "タグ1"}}, nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodGet, "/api/tags", nil)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	var result []model.Tag
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(result) != 1 || result[0].Name != "タグ1" {
		t.Errorf("unexpected result: %v", result)
	}
}

func TestListTags_WithCategoryFilter_200(t *testing.T) {
	var gotCategory string
	svc := &mockService{
		listFn: func(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
			gotCategory = category
			return []model.Tag{}, nil
		},
	}
	doRequest(newEcho(svc), http.MethodGet, "/api/tags?category=mycombo_status", nil)
	if gotCategory != "mycombo_status" {
		t.Errorf("category = %q, want mycombo_status", gotCategory)
	}
}

// E-3: character_id クエリが service に *int64 で渡る(マイコンボ件数のキャラ追従)。
func TestListTags_WithCharacterID_200(t *testing.T) {
	var gotCharacterID *int64
	svc := &mockService{
		listFn: func(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
			gotCharacterID = characterID
			return []model.Tag{}, nil
		},
	}
	doRequest(newEcho(svc), http.MethodGet, "/api/tags?include_usage=true&character_id=3", nil)
	if gotCharacterID == nil || *gotCharacterID != 3 {
		t.Errorf("characterID = %v, want 3", gotCharacterID)
	}
}

// E-3: character_id が不正(0 / 非数値)なら 400。
func TestListTags_WithInvalidCharacterID_400(t *testing.T) {
	svc := &mockService{}
	rec := doRequest(newEcho(svc), http.MethodGet, "/api/tags?character_id=abc", nil)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

// ===========================================================================
// GET /api/tags/:id
// ===========================================================================

func TestGetTag_200(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, userID, tagID int64) (*model.Tag, error) {
			return &model.Tag{ID: tagID, UserID: userID, Name: "タグ"}, nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodGet, "/api/tags/1", nil)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestGetTag_404(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, userID, tagID int64) (*model.Tag, error) {
			return nil, tagsvc.ErrNotFound
		},
	}
	rec := doRequest(newEcho(svc), http.MethodGet, "/api/tags/9999", nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

// ===========================================================================
// POST /api/tags
// ===========================================================================

func TestCreateTag_201(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
			return &model.Tag{ID: 1, UserID: userID, Name: input.Name}, nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPost, "/api/tags", map[string]string{"name": "新タグ"})
	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201", rec.Code)
	}
}

func TestCreateTag_400_EmptyName(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
			return nil, tagsvc.ErrTagNameEmpty
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPost, "/api/tags", map[string]string{"name": ""})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	assertErrorCode(t, rec.Body.Bytes(), "tag_name_empty")
}

func TestCreateTag_409_Duplicate(t *testing.T) {
	svc := &mockService{
		createFn: func(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
			return nil, tagsvc.ErrTagNameDuplicate
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPost, "/api/tags", map[string]string{"name": "重複"})
	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
	assertErrorCode(t, rec.Body.Bytes(), "tag_name_duplicate")
}

// ===========================================================================
// PATCH /api/tags/:id
// ===========================================================================

func TestUpdateTag_200(t *testing.T) {
	svc := &mockService{
		updateFn: func(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
			return &model.Tag{ID: tagID, UserID: userID, Name: *input.Name}, nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPatch, "/api/tags/1", map[string]string{"name": "更新後"})
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
}

func TestUpdateTag_404(t *testing.T) {
	svc := &mockService{
		updateFn: func(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
			return nil, tagsvc.ErrNotFound
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPatch, "/api/tags/9999", map[string]string{"name": "更新"})
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestUpdateTag_400_EmptyName(t *testing.T) {
	svc := &mockService{
		updateFn: func(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
			return nil, tagsvc.ErrTagNameEmpty
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPatch, "/api/tags/1", map[string]*string{"name": ptrStr("")})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestUpdateTag_409_Duplicate(t *testing.T) {
	svc := &mockService{
		updateFn: func(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
			return nil, tagsvc.ErrTagNameDuplicate
		},
	}
	rec := doRequest(newEcho(svc), http.MethodPatch, "/api/tags/1", map[string]string{"name": "重複"})
	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

// ===========================================================================
// DELETE /api/tags/:id
// ===========================================================================

func TestDeleteTag_204_Unused(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, userID, tagID int64, force bool) error {
			return nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodDelete, "/api/tags/1", nil)
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
}

func TestDeleteTag_409_InUse_NoForce(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, userID, tagID int64, force bool) error {
			return &tagsvc.TagInUseError{UsageCount: 3}
		},
	}
	rec := doRequest(newEcho(svc), http.MethodDelete, "/api/tags/1", nil)
	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
	assertErrorCode(t, rec.Body.Bytes(), "tag_in_use")
}

// TestDeleteTag_409_InUse_DetailKeysAreCamelCase は 409 tag_in_use の details が
// 規約どおり camelCase の生キーで出ることを固定する(M35-01 段 2 / CLAUDE.md §4)。
//
// ★★型検査は歯止めにならない —— BE と FE の両方を同時に書き換えれば型は通る。
// ⇒ ここはキー文字列そのものを見る。旧 snake_case が残っていないことも併せて見る。
// ★下の wantBody は web/src/features/tag/api/tagApi.test.ts の fixture と逐語同一である。
// 片方を変えたらもう片方も変えること(変えなければ、どちらかが実物とずれる)。
func TestDeleteTag_409_InUse_DetailKeysAreCamelCase(t *testing.T) {
	svc := &mockService{
		deleteFn: func(ctx context.Context, userID, tagID int64, force bool) error {
			return &tagsvc.TagInUseError{UsageCount: 3}
		},
	}
	rec := doRequest(newEcho(svc), http.MethodDelete, "/api/tags/1", nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}

	// ★構造体へ decode すると「キーが違っても零値で通る」ため、生の map で見る。
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v (body=%s)", err, rec.Body.String())
	}
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error field missing (body=%s)", rec.Body.String())
	}
	details, ok := errObj["details"].(map[string]any)
	if !ok {
		t.Fatalf("details field missing (body=%s)", rec.Body.String())
	}

	if got := details["usageCount"]; got != float64(3) {
		t.Errorf("details[\"usageCount\"] = %v, want 3", got)
	}
	if got := details["forceDeleteQuery"]; got != "?force=true" {
		t.Errorf("details[\"forceDeleteQuery\"] = %v, want \"?force=true\"", got)
	}
	for _, legacy := range []string{"usage_count", "force_delete_query", "existing_tag_id"} {
		if _, exists := details[legacy]; exists {
			t.Errorf("★旧キー %q が残っている(片側だけ直した形)", legacy)
		}
	}

	// ★FE 側 fixture との逐語一致。web/src/features/tag/api/tagApi.test.ts の
	// IN_USE_409_BODY と同じ JSON であること。
	// ★★メッセージ本文も固定しているため、文言を変えるときは 2 ファイルである
	// (こちらは DeepEqual で赤くなるが、FE 側はキーしか見ないので緑のまま古くなる)。
	const wantBody = `{"error":{"code":"tag_in_use","message":"このタグは使用中です。確認の上削除してください","details":{"forceDeleteQuery":"?force=true","usageCount":3}}}`
	var want map[string]any
	if err := json.Unmarshal([]byte(wantBody), &want); err != nil {
		t.Fatalf("unmarshal want: %v", err)
	}
	if !reflect.DeepEqual(body, want) {
		t.Errorf("body = %s\nwant %s", rec.Body.String(), wantBody)
	}
}

func TestDeleteTag_204_ForceTrue(t *testing.T) {
	var gotForce bool
	svc := &mockService{
		deleteFn: func(ctx context.Context, userID, tagID int64, force bool) error {
			gotForce = force
			return nil
		},
	}
	rec := doRequest(newEcho(svc), http.MethodDelete, "/api/tags/1?force=true", nil)
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if !gotForce {
		t.Error("force should be true")
	}
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func assertErrorCode(t *testing.T, body []byte, wantCode string) {
	t.Helper()
	var resp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("unmarshal error response: %v (body: %s)", err, body)
	}
	if resp.Error.Code != wantCode {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, wantCode)
	}
}

// errors パッケージを使うためのコンパイル通過用(実際はモックで使用済み)
var _ = errors.Is
