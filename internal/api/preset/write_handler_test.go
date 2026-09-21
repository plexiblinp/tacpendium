package preset_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	presethandler "github.com/plexiblinp/tacpendium/internal/api/preset"
	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-04: 書き込み API のハンドラテスト(正常系 + 主要異常系)。
//
// ★保護がサービス層にあることは service_test.go が主張する。本ファイルは
// 「その拒否が正しい HTTP ステータスで出るか」だけを見る。とくに
// 一意制約違反が 500 になっていないこと(D-275 同型)。

// newRouter は実際のルーティングを通して叩けるテスト用サーバを組み立てる。
// ★ルート定義(routes.go)ごと通すことで、パスやメソッドの取り違えも検出する。
// stubUserResolver は X-User-Id 未指定時の既定利用者を固定で返す。
// ★本番では usersvc が users.id の最小値を返す(M22-02)。
type stubUserResolver struct{ id int64 }

func (s stubUserResolver) DefaultUserID(context.Context) (int64, error) { return s.id, nil }

func newRouter(t *testing.T) (*sql.DB, *echo.Echo) {
	t.Helper()
	db := dbtest.Setup(t)
	e := echo.New()
	// ★本番と同じく利用者の解決を通す。通さないと userID が 0 になり、
	// presets.user_id の FK 制約で落ちる(M22-02 で供給元を差し替えたため)。
	e.Use(mw.UserContext(stubUserResolver{id: 1}))
	h := presethandler.NewHandler(presetsvc.New(db, presetrepo.New(db), nil, nil), nil)
	presethandler.RegisterRoutes(e.Group("/api"), h)
	return db, e
}

func do(t *testing.T, e *echo.Echo, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func decodePreset(t *testing.T, rec *httptest.ResponseRecorder) presethandler.PresetResponse {
	t.Helper()
	var p presethandler.PresetResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("unmarshal preset: %v (body=%s)", err, rec.Body.String())
	}
	return p
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v (body=%s)", err, rec.Body.String())
	}
	return resp.Error.Code
}

func builtinID(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM presets WHERE code = ?`, code).Scan(&id); err != nil {
		t.Fatalf("lookup preset %s: %v", code, err)
	}
	return id
}

func TestHandler_Create_201(t *testing.T) {
	_, e := newRouter(t)

	rec := do(t, e, http.MethodPost, "/api/presets",
		`{"basePresetCode":"srk","name":"わたしの SRK"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body=%s)", rec.Code, rec.Body.String())
	}
	p := decodePreset(t, rec)
	if p.Name != "わたしの SRK" {
		t.Errorf("name = %q", p.Name)
	}
	if p.IsBuiltin {
		t.Error("isBuiltin = true になっている")
	}
	if p.BasePresetCode == nil || *p.BasePresetCode != "srk" {
		t.Errorf("basePresetCode = %v, want srk", p.BasePresetCode)
	}
	if p.UserID == nil || *p.UserID != 1 {
		t.Errorf("userId = %v, want 1", p.UserID)
	}
}

func TestHandler_Create_InvalidBase_400(t *testing.T) {
	_, e := newRouter(t)

	rec := do(t, e, http.MethodPost, "/api/presets",
		`{"basePresetCode":"no_such","name":"x"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "invalid_base_preset" {
		t.Errorf("code = %q, want invalid_base_preset", got)
	}
}

func TestHandler_Create_EmptyName_400(t *testing.T) {
	_, e := newRouter(t)

	rec := do(t, e, http.MethodPost, "/api/presets",
		`{"basePresetCode":"srk","name":"   "}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "preset_name_empty" {
		t.Errorf("code = %q, want preset_name_empty", got)
	}
}

func TestHandler_Create_DuplicateName_409(t *testing.T) {
	_, e := newRouter(t)

	if rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"同名"}`); rec.Code != http.StatusCreated {
		t.Fatalf("1 回目: status = %d", rec.Code)
	}
	rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"同名"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "preset_name_duplicate" {
		t.Errorf("code = %q, want preset_name_duplicate", got)
	}
}

// TestHandler_Create_LimitExceeded_409 は VAL-P05(§5 (f))の HTTP 面。
func TestHandler_Create_LimitExceeded_409(t *testing.T) {
	_, e := newRouter(t)

	// 組み込み 3 件 + カスタム 5 件 = 8 件まで通る
	for i := 1; i <= 5; i++ {
		body := fmt.Sprintf(`{"basePresetCode":"srk","name":"カスタム%d"}`, i)
		if rec := do(t, e, http.MethodPost, "/api/presets", body); rec.Code != http.StatusCreated {
			t.Fatalf("%d 件目: status = %d (body=%s)", i, rec.Code, rec.Body.String())
		}
	}
	// 9 件目
	rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"9件目"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("9 件目: status = %d, want 409 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "preset_limit_exceeded" {
		t.Errorf("code = %q, want preset_limit_exceeded", got)
	}
}

// TestHandler_Update_BuiltinIsForbidden は ★組み込みの編集が 403 であることを
// HTTP 面で固定する(D-290。指示書 §5 (e))。
func TestHandler_Update_BuiltinIsForbidden(t *testing.T) {
	db, e := newRouter(t)

	for _, code := range []string{
		model.PresetCodeOfficialJaMove,
		model.PresetCodeNumeric,
		model.PresetCodeSRK,
	} {
		id := builtinID(t, db, code)
		path := fmt.Sprintf("/api/presets/%d", id)
		rec := do(t, e, http.MethodPut, path, `{"name":"書き換え"}`)
		if rec.Code != http.StatusForbidden {
			t.Errorf("PUT %s (%s): status = %d, want 403 (body=%s)", path, code, rec.Code, rec.Body.String())
		}
		if got := errorCode(t, rec); got != "builtin_protected" {
			t.Errorf("%s: code = %q, want builtin_protected", code, got)
		}
	}
}

// TestHandler_Delete_BuiltinIsForbidden は §5 (d)の HTTP 面。
func TestHandler_Delete_BuiltinIsForbidden(t *testing.T) {
	db, e := newRouter(t)

	for _, code := range []string{
		model.PresetCodeOfficialJaMove,
		model.PresetCodeNumeric,
		model.PresetCodeSRK,
	} {
		id := builtinID(t, db, code)
		path := fmt.Sprintf("/api/presets/%d", id)
		rec := do(t, e, http.MethodDelete, path, "")
		if rec.Code != http.StatusForbidden {
			t.Errorf("DELETE %s (%s): status = %d, want 403 (body=%s)", path, code, rec.Code, rec.Body.String())
		}
		if got := errorCode(t, rec); got != "builtin_protected" {
			t.Errorf("%s: code = %q, want builtin_protected", code, got)
		}
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM presets WHERE id = ?`, id).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		if n != 1 {
			t.Errorf("組み込み %s が消えた", code)
		}
	}
}

func TestHandler_UpdateAndDelete_Custom(t *testing.T) {
	db, e := newRouter(t)

	rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"編集対象"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status = %d", rec.Code)
	}
	created := decodePreset(t, rec)

	var moveID int64
	if err := db.QueryRow(`SELECT move_id FROM preset_aliases WHERE preset_id = ? AND character_id = 1 LIMIT 1`,
		created.ID).Scan(&moveID); err != nil {
		t.Fatalf("lookup move: %v", err)
	}

	body := fmt.Sprintf(`{"name":"編集後","aliases":[{"moveId":%d,"aliasText":"好きな表記"}]}`, moveID)
	rec = do(t, e, http.MethodPut, fmt.Sprintf("/api/presets/%d", created.ID), body)
	if rec.Code != http.StatusOK {
		t.Fatalf("update: status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	if got := decodePreset(t, rec).Name; got != "編集後" {
		t.Errorf("name = %q, want 編集後", got)
	}
	var text string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveID).Scan(&text); err != nil {
		t.Fatalf("read alias: %v", err)
	}
	if text != "好きな表記" {
		t.Errorf("alias_text = %q", text)
	}

	rec = do(t, e, http.MethodDelete, fmt.Sprintf("/api/presets/%d", created.ID), "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete: status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM preset_aliases WHERE preset_id = ?`, created.ID).Scan(&n); err != nil {
		t.Fatalf("count children: %v", err)
	}
	if n != 0 {
		t.Errorf("削除後に子行が %d 件残っている", n)
	}
}

// TestHandler_Update_AliasConflict_NotInternalError は ★一意制約違反を
// 500 で返していないことを固定する。利用者の入力誤りであり、監視から見ると
// 偽の障害として上がる(D-275 と同型。指示書 §4.2 / チェックリスト §1.6)。
func TestHandler_Update_AliasConflict_NotInternalError(t *testing.T) {
	db, e := newRouter(t)

	rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"numeric","name":"衝突検証"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status = %d", rec.Code)
	}
	created := decodePreset(t, rec)

	var moveA, moveB int64
	var textA string
	if err := db.QueryRow(`SELECT move_id, alias_text FROM preset_aliases WHERE preset_id = ? AND character_id = 1 LIMIT 1`,
		created.ID).Scan(&moveA, &textA); err != nil {
		t.Fatalf("lookup move A: %v", err)
	}
	if err := db.QueryRow(`SELECT move_id FROM preset_aliases WHERE preset_id = ? AND character_id = 1 AND move_id <> ? LIMIT 1`,
		created.ID, moveA).Scan(&moveB); err != nil {
		t.Fatalf("lookup move B: %v", err)
	}

	body := fmt.Sprintf(`{"aliases":[{"moveId":%d,"aliasText":%q}]}`, moveB, textA)
	rec = do(t, e, http.MethodPut, fmt.Sprintf("/api/presets/%d", created.ID), body)

	if rec.Code >= 500 {
		t.Fatalf("status = %d。一意制約違反を 5xx で返してはならない (body=%s)", rec.Code, rec.Body.String())
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "alias_conflict" {
		t.Errorf("code = %q, want alias_conflict", got)
	}
	// ★どの表記が衝突したかを伝えていること
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !strings.Contains(resp.Error.Message, textA) {
		t.Errorf("メッセージに衝突表記 %q が含まれない: %q", textA, resp.Error.Message)
	}
	if got, _ := resp.Error.Details["aliasText"].(string); got != textA {
		t.Errorf("details.aliasText = %q, want %q", got, textA)
	}
}

func TestHandler_Update_404(t *testing.T) {
	_, e := newRouter(t)
	rec := do(t, e, http.MethodPut, "/api/presets/99999", `{"name":"x"}`)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestHandler_Delete_404(t *testing.T) {
	_, e := newRouter(t)
	rec := do(t, e, http.MethodDelete, "/api/presets/99999", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// TestHandler_Delete_InUseByConfig_409 は D-313。
func TestHandler_Delete_InUseByConfig_409(t *testing.T) {
	db := dbtest.Setup(t)
	var currentDefault int64
	e := echo.New()
	e.Use(mw.UserContext(stubUserResolver{id: 1}))
	h := presethandler.NewHandler(presetsvc.New(db, presetrepo.New(db), func() int64 { return currentDefault }, nil), nil)
	presethandler.RegisterRoutes(e.Group("/api"), h)

	rec := do(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"既定"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status = %d", rec.Code)
	}
	created := decodePreset(t, rec)
	currentDefault = created.ID

	rec = do(t, e, http.MethodDelete, fmt.Sprintf("/api/presets/%d", created.ID), "")
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (body=%s)", rec.Code, rec.Body.String())
	}
	if got := errorCode(t, rec); got != "preset_in_use_by_config" {
		t.Errorf("code = %q, want preset_in_use_by_config", got)
	}
}

func TestHandler_ListAliases_200(t *testing.T) {
	db, e := newRouter(t)
	id := builtinID(t, db, model.PresetCodeNumeric)

	rec := do(t, e, http.MethodGet, fmt.Sprintf("/api/presets/%d/aliases?character_id=1", id), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var resp []presethandler.AliasResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp) == 0 {
		t.Fatal("0 件")
	}
	for _, a := range resp {
		if a.CharacterID != 1 {
			t.Errorf("characterId = %d, want 1", a.CharacterID)
		}
		if a.MoveCode == "" {
			t.Errorf("moveCode が空 (moveId=%d)", a.MoveID)
		}
	}

	// limit
	rec = do(t, e, http.MethodGet, fmt.Sprintf("/api/presets/%d/aliases?character_id=1&limit=2", id), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("limit: status = %d", rec.Code)
	}
	var limited []presethandler.AliasResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &limited); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(limited) != 2 {
		t.Errorf("limit=2 で %d 件", len(limited))
	}
}

func TestHandler_ListAliases_BadRequest(t *testing.T) {
	db, e := newRouter(t)
	id := builtinID(t, db, model.PresetCodeNumeric)

	for _, path := range []string{
		fmt.Sprintf("/api/presets/%d/aliases", id),
		fmt.Sprintf("/api/presets/%d/aliases?character_id=abc", id),
		fmt.Sprintf("/api/presets/%d/aliases?character_id=0", id),
		fmt.Sprintf("/api/presets/%d/aliases?character_id=1&limit=0", id),
	} {
		rec := do(t, e, http.MethodGet, path, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("GET %s: status = %d, want 400", path, rec.Code)
		}
	}
}

func TestHandler_ListAliases_404(t *testing.T) {
	_, e := newRouter(t)
	rec := do(t, e, http.MethodGet, "/api/presets/99999/aliases?character_id=1", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// TestHandler_ReadRoutes_Unchanged は §5 (j)。
// ★既存の読み取り 2 本の応答が M1-04 から変わっていないことを固定する。
func TestHandler_ReadRoutes_Unchanged(t *testing.T) {
	_, e := newRouter(t)

	rec := do(t, e, http.MethodGet, "/api/presets", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/presets: status = %d", rec.Code)
	}
	var list []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("組み込み = %d 件, want 3", len(list))
	}
	// キー集合が増えていないこと(camelCase・omitempty 込み)。
	wantKeys := map[string]bool{"id": true, "code": true, "name": true, "isBuiltin": true}
	for _, item := range list {
		for k := range item {
			if !wantKeys[k] {
				t.Errorf("組み込みプリセットの応答に想定外のキー %q がある", k)
			}
		}
		for k := range wantKeys {
			if _, ok := item[k]; !ok {
				t.Errorf("応答にキー %q が無い", k)
			}
		}
	}

	rec = do(t, e, http.MethodGet, "/api/presets/1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/presets/1: status = %d", rec.Code)
	}
	one := decodePreset(t, rec)
	if one.Code != model.PresetCodeOfficialJaMove || !one.IsBuiltin {
		t.Errorf("id=1 の応答が変わっている: %+v", one)
	}
}
