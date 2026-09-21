package inputresolve_test

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	inputresolvehandler "github.com/plexiblinp/tacpendium/internal/api/inputresolve"
	movecommandrepo "github.com/plexiblinp/tacpendium/internal/repository/movecommand"
	inputresolvesvc "github.com/plexiblinp/tacpendium/internal/service/inputresolve"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func newHandler(t *testing.T) (*inputresolvehandler.Handler, *sql.DB) {
	t.Helper()
	db := dbtest.Setup(t)
	return inputresolvehandler.NewHandler(inputresolvesvc.New(movecommandrepo.New(db))), db
}

func charID(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(
		`SELECT id FROM characters WHERE code = ? AND game_id IN (SELECT id FROM games WHERE code = 'sf6')`,
		code).Scan(&id); err != nil {
		t.Fatalf("charID(%s): %v", code, err)
	}
	return id
}

func doRequest(t *testing.T, h *inputresolvehandler.Handler, characterID string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/characters/"+characterID+"/command-index", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/characters/:characterId/command-index")
	c.SetParamNames("characterId")
	c.SetParamValues(characterID)
	if err := h.CommandIndex(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	return rec
}

func TestCommandIndex_200_SeededCharacter(t *testing.T) {
	h, db := newHandler(t)
	id := charID(t, db, "ryu")

	rec := doRequest(t, h, strconv.FormatInt(id, 10))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var resp inputresolvehandler.CommandIndexResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.CharacterID != id {
		t.Errorf("characterId = %d, want %d", resp.CharacterID, id)
	}
	if got := resp.Entries["2MP"]; got != "crouching_medium_punch" {
		t.Errorf("entries[2MP] = %q, want crouching_medium_punch", got)
	}
	if got := resp.Entries["6HP"]; got != "solar_plexus_strike" {
		t.Errorf("entries[6HP] = %q, want solar_plexus_strike", got)
	}
}

func TestCommandIndex_200_UnseededCharacterIsEmpty(t *testing.T) {
	h, _ := newHandler(t)
	// 索引を持たないキャラ(未 seed・存在しない id とも索引 0 行=同一経路)。仮データキャラ非依存。
	rec := doRequest(t, h, "999999")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(未 seed キャラは空で壊れない)", rec.Code)
	}
	var resp inputresolvehandler.CommandIndexResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Entries) != 0 {
		t.Errorf("entries = %d 件, want 0", len(resp.Entries))
	}
}

func TestCommandIndex_400_InvalidCharacterID(t *testing.T) {
	h, _ := newHandler(t)
	for _, raw := range []string{"abc", "0", "-1"} {
		rec := doRequest(t, h, raw)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("characterId=%q: status = %d, want 400", raw, rec.Code)
		}
	}
}

// ── M21-06 §4.6: モーション用の素通し経路 ────────────────────────────────────

func doMotionRequest(t *testing.T, h *inputresolvehandler.Handler, characterID string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/characters/"+characterID+"/motion-commands", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPath("/api/characters/:characterId/motion-commands")
	c.SetParamNames("characterId")
	c.SetParamValues(characterID)
	if err := h.MotionCommands(c); err != nil {
		t.Fatalf("handler returned error: %v", err)
	}
	return rec
}

// ★実 seed で多方向コマンドが届くこと。command-index では 1 件も届かない側である。
func TestMotionCommands_200_SeededCharacter(t *testing.T) {
	h, db := newHandler(t)
	id := charID(t, db, "ryu")

	rec := doMotionRequest(t, h, strconv.FormatInt(id, 10))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var resp inputresolvehandler.MotionCommandsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.CharacterID != id {
		t.Errorf("characterId = %d, want %d", resp.CharacterID, id)
	}

	byToken := map[string][]string{}
	for _, c := range resp.Commands {
		byToken[c.TokenKey] = append(byToken[c.TokenKey], c.MoveCode)
	}
	// 波動拳(236LP)と真空波動拳(236236P)。★後者は前者の方向列を先頭に含む＝最長一致の対象。
	if got := byToken["236LP"]; len(got) != 1 || got[0] != "hadoken_light" {
		t.Errorf("236LP = %v, want [hadoken_light]", got)
	}
	if got := byToken["236236P"]; len(got) != 1 || got[0] != "sa1_shinku_hadoken" {
		t.Errorf("236236P = %v, want [sa1_shinku_hadoken]", got)
	}
	if got := byToken["623HP"]; len(got) != 1 || got[0] != "shoryuken_heavy" {
		t.Errorf("623HP = %v, want [shoryuken_heavy]", got)
	}
	// ★同一 token_key に CA と SA3 の 2 技（実データの型）。畳んで 1 件にしていないこと。
	if got := len(byToken["236236K"]); got != 2 {
		t.Errorf("236236K = %d 件 (%v), want 2(CA と SA3 の両方)", got, byToken["236236K"])
	}
}

// ★§4.6-2 の対照。**motion-commands を足しても command-index の応答が変わらないこと。**
// 同じキャラを両経路へ通し、command-index 側に多方向コマンドが 1 件も現れないことを固定する。
func TestCommandIndex_ResponseUnchangedByMotionPath(t *testing.T) {
	h, db := newHandler(t)
	id := charID(t, db, "ryu")

	rec := doRequest(t, h, strconv.FormatInt(id, 10))
	var resp inputresolvehandler.CommandIndexResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// 従来どおりの中身（既存テストと同じ 2 点）。
	if resp.Entries["2MP"] != "crouching_medium_punch" || resp.Entries["6HP"] != "solar_plexus_strike" {
		t.Errorf("既存の解決表が変わっている: 2MP=%q 6HP=%q", resp.Entries["2MP"], resp.Entries["6HP"])
	}
	// ★多方向・溜め・OD は 1 件も載らない（載ったら §4.6-1 違反＝仮想側の解決が変わる）。
	for _, token := range []string{"236LP", "236236P", "623HP", "214K+K", "236P+P"} {
		if _, ok := resp.Entries[token]; ok {
			t.Errorf("command-index に %q が載っている。★絞り込みを広げてはならない(§4.6-1)", token)
		}
	}
}

func TestMotionCommands_200_UnseededCharacterIsEmpty(t *testing.T) {
	h, _ := newHandler(t)
	rec := doMotionRequest(t, h, "999999")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200(未 seed キャラは空で壊れない)", rec.Code)
	}
	// ★null ではなく [] で返すこと（FE が length を見る）。
	if body := rec.Body.String(); !strings.Contains(body, `"commands":[]`) {
		t.Errorf("body = %s, want commands が空配列([])", body)
	}
}

func TestMotionCommands_400_InvalidCharacterID(t *testing.T) {
	h, _ := newHandler(t)
	for _, raw := range []string{"abc", "0", "-1"} {
		rec := doMotionRequest(t, h, raw)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("characterId=%q: status = %d, want 400", raw, rec.Code)
		}
	}
}
