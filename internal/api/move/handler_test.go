package move_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	movehandler "github.com/plexiblinp/tacpendium/internal/api/move"
	"github.com/plexiblinp/tacpendium/internal/model"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	movesvc "github.com/plexiblinp/tacpendium/internal/service/move"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// newHandler は repo + service 配線済みの Handler を構築する(M9-03)。
func newHandler(db *sql.DB) *movehandler.Handler {
	repo := moverepo.New(db)
	return movehandler.NewHandler(repo, movesvc.New(repo))
}

// insertMove はテスト用に moves 1 行を直接 INSERT し、その id を返す(状態を決定的にするため)。
func insertMove(t *testing.T, db *sql.DB, code, category string, isAerial bool) int64 {
	t.Helper()
	res, err := db.ExecContext(context.Background(),
		`INSERT INTO moves (character_id, code, category, is_aerial, setup_only) VALUES (1, ?, ?, ?, 0)`,
		code, category, isAerial)
	if err != nil {
		t.Fatalf("insert move: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return id
}

// doIDRequest は :id パスパラメタ付きのリクエストを実行する。
func doIDRequest(method, body string, id int64, fn func(echo.Context) error) *httptest.ResponseRecorder {
	e := echo.New()
	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(strconv.FormatInt(id, 10))
	_ = fn(c)
	return rec
}

// TestHandler_List_200 はリュウ(character_id=1)の技一覧を取得し、
// 200 + items 配列が返ることと、official_ja_move プリセットの NameJa が
// 主要技で取得できることを確認する。
func TestHandler_List_200(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves?character_id=1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp movehandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) == 0 {
		t.Fatalf("expected non-empty items, got 0")
	}
	// 通常技 18 + 必殺技 + SA + システム + ラッシュ版 が seed 済みのため最低 20 件以上。
	if len(resp.Items) < 20 {
		t.Errorf("expected at least 20 moves, got %d", len(resp.Items))
	}

	// 少なくとも 1 件は NameJa が取得できているはず(official_ja_move エイリアスが seed 済み)。
	hasNameJa := false
	for _, m := range resp.Items {
		if m.NameJa != nil && *m.NameJa != "" {
			hasNameJa = true
			break
		}
	}
	if !hasNameJa {
		t.Errorf("expected at least one move to have NameJa via official_ja_move alias")
	}

	// M8-01: GET レスポンスに新フィールドが JSON レベルで反映され、既存フィールドが欠落・改名して
	// いないことを確認する。bool 3 列(isAerial/setupOnly/isDerived)は常時出力される。NULL 可 6 列は
	// seed 行が全 NULL + omitempty のため JSON に現れないのが仕様どおり(キー存在はアサートしない)。
	// ★isDerived は M30-04 で足した(必殺技ファミリー行の並び順に使う)。
	var raw struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal raw: %v", err)
	}
	if len(raw.Items) == 0 {
		t.Fatalf("expected non-empty raw items, got 0")
	}
	first := raw.Items[0]
	for _, key := range []string{"isAerial", "setupOnly", "isDerived", "id", "characterId", "code", "category"} {
		if _, ok := first[key]; !ok {
			t.Errorf("expected GET moves response item to contain key %q", key)
		}
	}
}

// TestHandler_List_Warnings は GET /api/moves が保存済みデータから WarningCode を再導出して
// 返すこと(M9-04、§4.1)と、既存フィールドが warnings 加算後も不変であることを確認する。
func TestHandler_List_Warnings(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	// リュウ(character_id=1)に決定的な moves を直接 INSERT し、warnings を検証する。
	// total NULL → total_null。clean 行は warnings 空。
	// M14-01: properties / combo_scaling 列を削除したため unknown_properties /
	// unknown_combo_scaling_key は再導出されない(撤去済み。下で不在を確認)。
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.ExecContext(context.Background(), query, args...); err != nil {
			t.Fatalf("exec: %v", err)
		}
	}
	exec(`INSERT INTO moves (character_id, code, category, total, is_aerial, setup_only)
	      VALUES (1, 'warn_total_null', 'normal', NULL, 0, 0)`)
	exec(`INSERT INTO moves (character_id, code, category, total, is_aerial, setup_only)
	      VALUES (1, 'warn_clean', 'normal', 10, 0, 0)`)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves?character_id=1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}

	var resp movehandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	byCode := map[string]movehandler.MoveResponse{}
	for _, m := range resp.Items {
		byCode[m.Code] = m
	}
	want := map[string]string{
		"warn_total_null": "total_null",
	}
	for code, wc := range want {
		m, ok := byCode[code]
		if !ok {
			t.Fatalf("move %q not found in response", code)
		}
		found := false
		for _, w := range m.Warnings {
			if string(w) == wc {
				found = true
			}
		}
		if !found {
			t.Errorf("move %q warnings = %v, want to contain %q", code, m.Warnings, wc)
		}
	}
	// 撤去済み warning は再導出されない(M14-01、§4.5)。
	for _, m := range resp.Items {
		for _, w := range m.Warnings {
			if string(w) == "unknown_properties" || string(w) == "unknown_combo_scaling_key" {
				t.Errorf("move %q が撤去済み warning %q を返した", m.Code, w)
			}
		}
	}
	// clean 行は warnings が空(nil ではなく空配列)。
	clean := byCode["warn_clean"]
	if len(clean.Warnings) != 0 {
		t.Errorf("clean move warnings = %v, want empty", clean.Warnings)
	}

	// 既存フィールド不変 + warnings キーが JSON レベルで常時出力される(空でも [])。
	var raw struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal raw: %v", err)
	}
	for _, item := range raw.Items {
		if _, ok := item["warnings"]; !ok {
			t.Errorf("each item should always include warnings key, got %v", item)
		}
		for _, key := range []string{"id", "characterId", "code", "category", "isAerial", "setupOnly", "isDerived"} {
			if _, ok := item[key]; !ok {
				t.Errorf("existing field %q missing after warnings addition", key)
			}
		}
		// combo_scaling 列は M14-01 で削除済み。MoveResponse JSON に露出しないこと(回帰ガード)。
		if _, ok := item["comboScaling"]; ok {
			t.Errorf("comboScaling must not be exposed in MoveResponse JSON")
		}
	}
}

// TestHandler_List_IsDerived は GET /api/moves が moves.is_derived を isDerived として
// そのまま返すことを確認する(M30-04)。
//
// ★★陽性対照つきで測る —— true 行だけを見ると「常に true を返す実装」でも緑になる。
//
//	⇒ 同じ応答の中に false 行が在り、そちらが false であることまで見る。
//
// ★本列は「単独入力の可否」ではない(DES-003 §3.3 errata③)。本テストが主張するのは
//
//	DB の値がそのまま届くことだけである。
func TestHandler_List_IsDerived(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.ExecContext(context.Background(), query, args...); err != nil {
			t.Fatalf("exec: %v", err)
		}
	}
	exec(`INSERT INTO moves (character_id, code, category, is_aerial, setup_only, is_derived)
	      VALUES (1, 'derived_probe_true', 'special', 0, 0, 1)`)
	exec(`INSERT INTO moves (character_id, code, category, is_aerial, setup_only, is_derived)
	      VALUES (1, 'derived_probe_false', 'special', 0, 0, 0)`)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves?character_id=1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}

	var resp movehandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	byCode := map[string]movehandler.MoveResponse{}
	for _, m := range resp.Items {
		byCode[m.Code] = m
	}
	for code, want := range map[string]bool{
		"derived_probe_true":  true,
		"derived_probe_false": false,
	} {
		m, ok := byCode[code]
		if !ok {
			t.Fatalf("move %q not found in response", code)
		}
		if m.IsDerived != want {
			t.Errorf("move %q isDerived = %v, want %v", code, m.IsDerived, want)
		}
	}

	// ★JSON レベルでも false のキーが消えないこと(omitempty を付けていないこと)。
	var raw struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal raw: %v", err)
	}
	seenFalse := false
	for _, item := range raw.Items {
		v, ok := item["isDerived"]
		if !ok {
			t.Fatalf("item is missing isDerived key: %v", item)
		}
		if string(v) == "false" {
			seenFalse = true
		}
	}
	if !seenFalse {
		t.Errorf("expected at least one item with isDerived=false in JSON")
	}
}

// TestHandler_List_400_MissingCharacterID は character_id 未指定時に 400 が返ることを確認する。
func TestHandler_List_400_MissingCharacterID(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// TestHandler_List_400_InvalidCharacterID は character_id が数値でない場合に 400 が返ることを確認する。
func TestHandler_List_400_InvalidCharacterID(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves?character_id=abc", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

// TestHandler_List_200_UnknownCharacter は存在しない character_id に対して 200 + 空配列が返ることを確認する。
func TestHandler_List_200_UnknownCharacter(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/moves?character_id=99999", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("List: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp movehandler.ListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Items) != 0 {
		t.Errorf("expected empty items for unknown character, got %d", len(resp.Items))
	}
}

// TestHandler_Get_200 は GET /api/moves/:id がフル項目 + 表示用 name_ja を返すことを確認する
// (CHANGE-032: 単一フル取得は official_ja_move エイリアスを name_ja として含む)。
func TestHandler_Get_200(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	id := insertMove(t, db, "test_get_move", model.MoveCategoryNormal, false)
	// official_ja_move エイリアスを付与し、name_ja 結合が効くことを確認する。
	// ★character_id を必ず入れること(M20-03)。nullable であるため入れなくても INSERT は
	//   通るが、UNIQUE(preset_id, character_id, alias_text) に当たらない行ができてしまう。
	if _, err := db.ExecContext(context.Background(),
		`INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
		 SELECT p.id, m.id, m.character_id, ? FROM presets p, moves m
		  WHERE p.code = 'official_ja_move' AND m.id = ?`,
		"テスト技名", id); err != nil {
		t.Fatalf("insert alias: %v", err)
	}

	rec := doIDRequest(http.MethodGet, "", id, h.Get)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	var resp movehandler.MoveDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.ID != id || resp.Code != "test_get_move" {
		t.Errorf("unexpected detail: %+v", resp)
	}
	if resp.NameJa == nil || *resp.NameJa != "テスト技名" {
		t.Errorf("name_ja not resolved: %+v", resp.NameJa)
	}
}

// TestHandler_Get_404 は存在しない id で 404 が返ることを確認する。
func TestHandler_Get_404(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	rec := doIDRequest(http.MethodGet, "", 99999999, h.Get)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// TestHandler_Update_200_ManualTotal は total / recovery 手動入力が保存・反映されることを確認する。
func TestHandler_Update_200_ManualTotal(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	id := insertMove(t, db, "test_patch_move", model.MoveCategoryNormal, false)

	rec := doIDRequest(http.MethodPatch, `{"total":42,"recovery":13,"isAerial":true}`, id, h.Update)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	var resp movehandler.MoveDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Total == nil || *resp.Total != 42 {
		t.Errorf("total not saved: %+v", resp.Total)
	}
	if resp.Recovery == nil || *resp.Recovery != 13 {
		t.Errorf("recovery not saved: %+v", resp.Recovery)
	}
	if !resp.IsAerial {
		t.Errorf("isAerial not toggled")
	}
}

// 注(M14-01): properties 列を削除し PATCH の properties 値域検証を撤去したため、
// TestHandler_Update_400_InvalidProperty は廃止した(§4.5)。

// TestHandler_RushVariant_201_then_409 は normal 技からラッシュ版生成が成功し、
// 同一元技で再生成すると 409 が返ることを確認する。
func TestHandler_RushVariant_201_then_409(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	id := insertMove(t, db, "test_rush_src", model.MoveCategoryNormal, false)

	rec := doIDRequest(http.MethodPost, "", id, h.GenerateRushVariant)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body=%s)", rec.Code, rec.Body.String())
	}
	var resp movehandler.MoveDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Code != "rush_test_rush_src" || resp.Category != "rush_variant" {
		t.Errorf("unexpected rush variant: %+v", resp)
	}
	if resp.OriginalMoveID == nil || *resp.OriginalMoveID != id {
		t.Errorf("original_move_id not set: %+v", resp.OriginalMoveID)
	}
	// レビュー #1: ラッシュ版生成は preset_aliases へ書き込まない(name_ja 編集スコープ外)。
	// 生成された rush_variant の nameJa は nil(エイリアス未書込)であること。
	if resp.NameJa != nil {
		t.Errorf("rush variant should not have an alias (scope外), got nameJa=%q", *resp.NameJa)
	}
	// M17-02 §4.7: 生成された rush_variant は is_derived=true(seed 由来 rush 行と一貫。
	// ドライブラッシュ状態でのみ出る=command 索引の解決対象外)。
	//
	// ★★【2026-09-19・M39-02】あわせて startup_basis も見る——
	// insertMove は startup を与えないため、本テストの元技は **startup が NULL** である。
	// ⇒ 是正前はここで 'through' が入り、`startup NULL` ＋ `'through'` という D-187 違反行が
	//   **利用者が実際に叩く HTTP 経路から** できていた。'unknown' であることを固定する。
	// ★実行時の経路そのもののガードは internal/repository/move/rush_runtime_invariant_test.go
	//   に在る。本アサーションは「HTTP 層まで通しても同じ値になる」ことを見る。
	var (
		isDerived    int
		rushStartup  *int
		startupBasis string
	)
	if err := db.QueryRow(
		`SELECT is_derived, startup, startup_basis FROM moves WHERE id = ?`, resp.ID,
	).Scan(&isDerived, &rushStartup, &startupBasis); err != nil {
		t.Fatalf("query rush variant columns: %v", err)
	}
	if isDerived != 1 {
		t.Errorf("rush variant の is_derived = %d, want 1", isDerived)
	}
	if rushStartup != nil {
		t.Fatalf("前提が崩れている: 元技の startup が NULL でないため本アサーションが対象外になる(= %d)", *rushStartup)
	}
	if startupBasis != "unknown" {
		t.Errorf("startup が NULL の元技から作った rush variant の startup_basis = %q, want %q"+
			"(D-187 / DES-003 §3.3 (i)・M39-02)", startupBasis, "unknown")
	}

	// 2 回目は重複 → 409 + 既存 rush_variant の id(CHANGE-032)。
	rec2 := doIDRequest(http.MethodPost, "", id, h.GenerateRushVariant)
	if rec2.Code != http.StatusConflict {
		t.Fatalf("second call status = %d, want 409", rec2.Code)
	}
	var errResp struct {
		Error struct {
			Code    string         `json:"code"`
			Details map[string]any `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec2.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("unmarshal 409: %v", err)
	}
	// JSON 数値は float64 でデコードされる。既存 id = 初回生成の id。
	if got, ok := errResp.Error.Details["existingId"].(float64); !ok || int64(got) != resp.ID {
		t.Errorf("409 の existingId = %v, want %d", errResp.Error.Details["existingId"], resp.ID)
	}
}

// TestHandler_RushVariant_400_Ineligible は対象外カテゴリ(throw)で 400 が返ることを確認する。
func TestHandler_RushVariant_400_Ineligible(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	id := insertMove(t, db, "test_rush_throw", "throw", false)
	rec := doIDRequest(http.MethodPost, "", id, h.GenerateRushVariant)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%s)", rec.Code, rec.Body.String())
	}
}

// TestHandler_RushVariant_409_CodeCollision はレビュー #3 の堅牢化を確認する:
// rush コード(rush_<元技code>)を別の非 rush_variant move が既に占有している場合でも、
// 生 UNIQUE 制約エラー(→ 500)ではなく 409 + 既存 id を返す。
func TestHandler_RushVariant_409_CodeCollision(t *testing.T) {
	db := dbtest.Setup(t)
	h := newHandler(db)
	src := insertMove(t, db, "collide_src", model.MoveCategoryNormal, false)
	// rush コードを別の通常技が先に占有している状態を作る。
	occupier := insertMove(t, db, "rush_collide_src", model.MoveCategoryNormal, false)

	rec := doIDRequest(http.MethodPost, "", src, h.GenerateRushVariant)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (body=%s)", rec.Code, rec.Body.String())
	}
	var errResp struct {
		Error struct {
			Details map[string]any `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("unmarshal 409: %v", err)
	}
	if got, ok := errResp.Error.Details["existingId"].(float64); !ok || int64(got) != occupier {
		t.Errorf("409 の existingId = %v, want %d(占有 move)", errResp.Error.Details["existingId"], occupier)
	}
}
