package preset_test

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	presethandler "github.com/plexiblinp/tacpendium/internal/api/preset"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// newHandler はマイグレ済みの一時 DB 上に Handler を組み立てる。
//
// M20-04 で Handler がリポジトリ直参照からサービス経由へ変わった(保護・上限・
// トランザクションを持つ層を通す必要が出たため)。★応答 DTO と HTTP 契約は不変である。
func newHandler(t *testing.T) (*sql.DB, *presethandler.Handler) {
	t.Helper()
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	return db, presethandler.NewHandler(presetsvc.New(db, repo, nil, nil), nil)
}

func TestHandler_List_200(t *testing.T) {
	_, h := newHandler(t)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/presets", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp []presethandler.PresetResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// 組み込みプリセットは M20-01(000069)で 5 種 → 3 種になった。
	if len(resp) != 3 {
		t.Fatalf("expected 3 presets, got %d", len(resp))
	}
	if resp[0].Code != "official_ja_move" {
		t.Errorf("first preset code = %q, want %q", resp[0].Code, "official_ja_move")
	}
}

func TestHandler_Get_200(t *testing.T) {
	_, h := newHandler(t)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/presets/1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.Get(c); err != nil {
		t.Fatalf("Get: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp presethandler.PresetResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Code != "official_ja_move" {
		t.Errorf("code = %q, want %q", resp.Code, "official_ja_move")
	}
}

func TestHandler_Get_404(t *testing.T) {
	_, h := newHandler(t)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/presets/99999", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("99999")

	if err := h.Get(c); err != nil {
		t.Fatalf("Get: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandler_Get_BadRequest(t *testing.T) {
	_, h := newHandler(t)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/presets/abc", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("abc")

	if err := h.Get(c); err != nil {
		t.Fatalf("Get: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}
