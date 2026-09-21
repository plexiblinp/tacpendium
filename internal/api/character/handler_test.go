package character_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	charhandler "github.com/plexiblinp/tacpendium/internal/api/character"
	"github.com/plexiblinp/tacpendium/internal/model"
	charrepo "github.com/plexiblinp/tacpendium/internal/repository/character"
	charsvc "github.com/plexiblinp/tacpendium/internal/service/character"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func TestHandler_List_200(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	svc := charsvc.New(repo)
	h := charhandler.NewHandler(svc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games/1/characters", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/games/:gameId/characters")
	c.SetParamNames("gameId")
	c.SetParamValues("1")

	if err := h.List(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp charhandler.CharacterListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(resp.Items) == 0 {
		t.Fatal("expected at least 1 character, got 0")
	}

	ryu := resp.Items[0]
	if ryu.Code != "ryu" {
		t.Errorf("code = %q, want %q", ryu.Code, "ryu")
	}
	if ryu.NameJa != "リュウ" {
		t.Errorf("nameJa = %q, want %q", ryu.NameJa, "リュウ")
	}
	if ryu.NameEn != "Ryu" {
		t.Errorf("nameEn = %q, want %q", ryu.NameEn, "Ryu")
	}
}

func TestHandler_List_BadGameID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	svc := charsvc.New(repo)
	h := charhandler.NewHandler(svc)

	cases := []struct {
		name    string
		paramID string
	}{
		{"non-numeric", "abc"},
		{"zero", "0"},
		{"negative", "-1"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodGet, "/api/games/"+tc.paramID+"/characters", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetPath("/api/games/:gameId/characters")
			c.SetParamNames("gameId")
			c.SetParamValues(tc.paramID)

			if err := h.List(c); err != nil {
				t.Fatalf("handler returned error: %v", err)
			}

			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}

			var resp struct {
				Error struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if resp.Error.Code != "invalid_game_id" {
				t.Errorf("error code = %q, want %q", resp.Error.Code, "invalid_game_id")
			}
		})
	}
}

func TestHandler_List_EmptyResult(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	svc := charsvc.New(repo)
	h := charhandler.NewHandler(svc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games/999/characters", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/games/:gameId/characters")
	c.SetParamNames("gameId")
	c.SetParamValues("999")

	if err := h.List(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp charhandler.CharacterListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(resp.Items) != 0 {
		t.Errorf("expected 0 items for non-existent game, got %d", len(resp.Items))
	}
}

func TestHandler_List_JSONFormat(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	svc := charsvc.New(repo)
	h := charhandler.NewHandler(svc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games/1/characters", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/games/:gameId/characters")
	c.SetParamNames("gameId")
	c.SetParamValues("1")

	if err := h.List(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if _, ok := raw["items"]; !ok {
		t.Error("response missing 'items' key")
	}

	var items []model.Character
	if err := json.Unmarshal(raw["items"], &items); err != nil {
		t.Fatalf("unmarshal items: %v", err)
	}

	if len(items) == 0 {
		t.Fatal("expected at least 1 item")
	}

	ryu := items[0]
	if ryu.GameID != 1 {
		t.Errorf("gameId = %d, want 1", ryu.GameID)
	}
}
