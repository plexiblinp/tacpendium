//go:build debug

package debug_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/labstack/echo/v4"

	debughandler "github.com/plexiblinp/tacpendium/internal/api/debug"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func newTestServer(t *testing.T) *echo.Echo {
	t.Helper()
	db := dbtest.Setup(t)
	e := echo.New()
	api := e.Group("/api")
	// ★dir はデータディレクトリ(M28-02c で足した)。告知ファイルの位置を知るために要る。
	h := debughandler.NewHandler(db, t.TempDir())
	debughandler.RegisterRoutes(api, h)
	return e
}

func TestListTables_OK(t *testing.T) {
	e := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/debug/tables", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body struct {
		Tables []struct {
			Name  string `json:"name"`
			Count int64  `json:"count"`
		} `json:"tables"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if len(body.Tables) == 0 {
		t.Fatal("want at least one table, got 0")
	}

	// combos テーブルが含まれており count が正しいことを確認。
	// dbtest.Setup は combos に seed データを入れないので count=0 が期待値。
	found := false
	for _, tbl := range body.Tables {
		if tbl.Name == "combos" {
			found = true
			if tbl.Count != 0 {
				t.Errorf("want combos count=0 (no seed), got %d", tbl.Count)
			}
			break
		}
	}
	if !found {
		t.Error("want 'combos' table in response, not found")
	}
}

func TestDumpTable_OK(t *testing.T) {
	e := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/debug/dump/combos", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body struct {
		Table     string           `json:"table"`
		Count     int64            `json:"count"`
		Truncated bool             `json:"truncated"`
		Rows      []map[string]any `json:"rows"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if body.Table != "combos" {
		t.Errorf("want table=combos, got %q", body.Table)
	}
	if body.Rows == nil {
		t.Error("want rows to be non-nil array")
	}
}

func TestDumpTable_NotFound(t *testing.T) {
	e := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/debug/dump/nonexistent_table", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDumpTable_SQLInjection(t *testing.T) {
	e := newTestServer(t)

	attacks := []string{
		"combos; DROP TABLE combos;",
		"combos' OR '1'='1",
		"combos--",
		"' UNION SELECT * FROM sqlite_master--",
	}

	for _, attack := range attacks {
		path := "/api/debug/dump/" + url.PathEscape(attack)
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("SQL injection %q: want 404, got %d", attack, rec.Code)
		}
	}
}
