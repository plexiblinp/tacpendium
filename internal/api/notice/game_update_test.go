package notice_test

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	_ "modernc.org/sqlite"

	noticeapi "github.com/plexiblinp/tacpendium/internal/api/notice"
	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M28-02c: ゲーム更新の告知の経路 2 本(CHANGE-162 §2)。

func newGameUpdateServer(dir string, count int, version string, err error) *echo.Echo {
	e := echo.New()
	g := e.Group("/api")
	noticeapi.RegisterGameUpdateRoutes(g, noticeapi.NewGameUpdateHandler(
		dir,
		func(c echo.Context) (int, error) { return count, err },
		func(c echo.Context) (string, error) { return version, err },
	))
	return e
}

func doGameUpdate(t *testing.T, e *echo.Echo, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

// TestGameUpdateNotice_AlwaysReturns200 は 204 になっていないことを固定する。
//
// ★★204 の作法から意図して外れている —— 返すのは「有無」ではなく件数と現在版であり、
//
//	204 では表現できない。★一覧のボタンは延期中でも件数が要る。
func TestGameUpdateNotice_AlwaysReturns200(t *testing.T) {
	cases := []struct {
		name  string
		count int
	}{
		{"影響 0 件", 0},
		{"影響あり", 3},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newGameUpdateServer(t.TempDir(), tc.count, "2026.09.01.00", nil)
			rec := doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
			if rec.Code != http.StatusOK {
				t.Fatalf("★status = %d, want 200(204 にしないこと)。body=%s", rec.Code, rec.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if body["currentDataVersion"] != "2026.09.01.00" {
				t.Errorf("currentDataVersion = %v", body["currentDataVersion"])
			}
			if got, ok := body["affectedCount"]; !ok || int(got.(float64)) != tc.count {
				t.Errorf("affectedCount = %v, want %d", got, tc.count)
			}
			// ★延期していないときはキーごと出ない。
			if _, ok := body["postponedForVersion"]; ok {
				t.Error("延期していないのに postponedForVersion が出ている")
			}
		})
	}
}

// TestGameUpdateNotice_PostponeThenGet は延期の往復を固定する。
//
// ★★件数は延期中でも返る —— 抑止するのはバナーだけであり、一覧のボタンは抑止しない。
//
//	⇒ ここが分水嶺である(CHANGE-162 §2.3)。
func TestGameUpdateNotice_PostponeThenGet(t *testing.T) {
	dir := t.TempDir()
	e := newGameUpdateServer(dir, 3, "2026.09.01.00", nil)

	rec := doGameUpdate(t, e, http.MethodPost, "/api/notices/game-update/postpone")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("postpone status = %d, want 204 (body=%s)", rec.Code, rec.Body.String())
	}
	// ★サーバが自分で版数を読んで書いている(要求本文は取らない)。
	got, ok, err := datadir.PostponedForCurrentVersion(dir, "2026.09.01.00")
	if err != nil || !ok || got != "2026.09.01.00" {
		t.Fatalf("保存された版 = %q ok=%v err=%v", got, ok, err)
	}

	rec = doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
	if rec.Code != http.StatusOK {
		t.Fatalf("get status = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["postponedForVersion"] != "2026.09.01.00" {
		t.Errorf("postponedForVersion = %v, want 2026.09.01.00", body["postponedForVersion"])
	}
	// ★★件数は延期中でも返る。ここが消えると一覧のボタンが件数を出せなくなる。
	if int(body["affectedCount"].(float64)) != 3 {
		t.Errorf("★延期中の affectedCount = %v, want 3(ボタンは抑止しない)", body["affectedCount"])
	}
}

// TestGameUpdateNotice_PostponeIsReleasedOnNewerVersion は版が上がったら抑止が外れることを
// 経路のレベルでも固定する。
func TestGameUpdateNotice_PostponeIsReleasedOnNewerVersion(t *testing.T) {
	dir := t.TempDir()
	if err := datadir.PostponeGameUpdateNotice(dir, "2026.09.01.00", time.Now()); err != nil {
		t.Fatalf("postpone: %v", err)
	}
	e := newGameUpdateServer(dir, 3, "2026.10.01.00", nil) // 版が上がった

	rec := doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := body["postponedForVersion"]; ok {
		t.Error("★版が上がったのに抑止が載っている。⇒ 次の更新の告知が握り潰される")
	}
}

// TestGameUpdateNotice_ErrorContract はエラー契約を固定する(CHANGE-159 §1.1 と同じ粒度)。
func TestGameUpdateNotice_ErrorContract(t *testing.T) {
	t.Run("write lock を取れない = 503 database_busy", func(t *testing.T) {
		e := newGameUpdateServer(t.TempDir(), 0, "", noticeapi.ErrDatabaseBusy)
		rec := doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (body=%s)", rec.Code, rec.Body.String())
		}
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if body.Error.Code != "database_busy" {
			t.Errorf("code = %q, want database_busy", body.Error.Code)
		}
	})

	// ★★センチネルだけを見ていると、呼び手が包み忘れたときに 503 の契約が黙って
	//   到達不能になる(実装は 500 を返し続けるが、本テストは緑のまま通る)。
	//   ⇒ sqlite の busy エラーそのものからも 503 になることを主張する。
	t.Run("sqlite の busy エラーからも 503 になる(包み忘れても届く)", func(t *testing.T) {
		e := newGameUpdateServer(t.TempDir(), 0, "", busyError(t))
		rec := doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503 (body=%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("dir が空なら postpone は成功で返さない", func(t *testing.T) {
		// ★保存できないのに 204 を返すと「延期したのに次も出る」を説明できない。
		e := newGameUpdateServer("", 0, "2026.09.10.01", nil)
		rec := doGameUpdate(t, e, http.MethodPost, "/api/notices/game-update/postpone")
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 (body=%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("それ以外 = 500 internal_error", func(t *testing.T) {
		e := newGameUpdateServer(t.TempDir(), 0, "", errors.New("boom"))
		rec := doGameUpdate(t, e, http.MethodGet, "/api/notices/game-update")
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500", rec.Code)
		}
		var body struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if body.Error.Code != "internal_error" {
			t.Errorf("code = %q, want internal_error", body.Error.Code)
		}
		if body.Error.Message == "" {
			t.Error("★500 は必ず非空の message を持つ(DES-002 §4.2)")
		}
	})
}

// busyError は実 DB で SQLITE_BUSY を起こして本物のエラーを得る。
//
// ★★手で作った sentinel ではなく、実際に dbinfra.IsBusy が true を返す値を使う ——
// 「包み忘れても 503 へ届く」ことを主張するのが目的であり、sentinel を注入したら
// その主張にならない。
func busyError(t *testing.T) error {
	t.Helper()
	db, dbPath := dbtest.SetupWithPath(t)

	// 書き込みトランザクションを 1 本握ったまま、別コネクションから書きに行く。
	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	if _, err := tx.Exec(`UPDATE games SET name_ja = name_ja WHERE code = 'sf6'`); err != nil {
		t.Fatalf("hold write lock: %v", err)
	}

	other, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open second connection: %v", err)
	}
	t.Cleanup(func() { _ = other.Close() })
	_, err = other.Exec(`UPDATE games SET name_ja = name_ja WHERE code = 'sf6'`)
	if err == nil {
		t.Skip("SQLITE_BUSY を再現できなかった(環境依存)。本テストは飛ばす")
	}
	if !dbinfra.IsBusy(err) {
		t.Skipf("得られたのは busy エラーではない: %v", err)
	}
	return err
}
