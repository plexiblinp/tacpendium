package preset_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/labstack/echo/v4"

	presethandler "github.com/plexiblinp/tacpendium/internal/api/preset"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M24-08 第 2 部 B(CHANGE-148 / D-615): POST /api/presets/:id/recipe-cache/rebuild。
//
// ★本ルートの要点は「組み込みプリセットでも 403 にしないこと」である。
//   recipe_cache は preset_aliases(真実)から組み立てた表示文字列であり、
//   作り直しはプリセットの編集ではない。★むしろ組み込み(official_ja_move)でこそ
//   必要になる —— 同プリセットは PUT が 403 のため、エイリアス更新経由の
//   再計算に乗せられないからである。
//   ⇒ ここが 403 になっていたら、地上ダッシュの是正は配布後に直らない。

// newRebuildHandler は再構築関数を差し替えられる Handler を組み立てる。
func newRebuildHandler(t *testing.T, fn presethandler.RecipeCacheRebuilder) *presethandler.Handler {
	t.Helper()
	db := dbtest.Setup(t)
	return presethandler.NewHandler(presetsvc.New(db, presetrepo.New(db), nil, nil), fn)
}

func postRebuild(t *testing.T, h *presethandler.Handler, id string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/presets/"+id+"/recipe-cache/rebuild", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(id)
	if err := h.RebuildRecipeCache(c); err != nil {
		t.Fatalf("RebuildRecipeCache: %v", err)
	}
	return rec
}

// ★★組み込みプリセットでも 200 になること。本ルートの存在理由そのものである。
func TestRebuildRecipeCache_Builtin_200(t *testing.T) {
	var called []int64
	h := newRebuildHandler(t, func(_ context.Context, presetID int64) error {
		called = append(called, presetID)
		return nil
	})

	// official_ja_move は組み込みであり id=1(000005 / 000069 の seed)。
	rec := postRebuild(t, h, "1")

	if rec.Code != http.StatusOK {
		t.Fatalf("★組み込みプリセットで status = %d(want 200)。403 にしてはいけない —— "+
			"組み込みは PUT が 403 のため、ここまで塞ぐと作り直す手段が無くなる", rec.Code)
	}
	var resp presethandler.RecipeCacheRebuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.PresetID != 1 {
		t.Errorf("presetId = %d, want 1", resp.PresetID)
	}
	if len(called) != 1 || called[0] != 1 {
		t.Errorf("再構築が当該プリセットへ 1 回だけ呼ばれていない: %v", called)
	}
}

func TestRebuildRecipeCache_NotFound_404(t *testing.T) {
	h := newRebuildHandler(t, func(context.Context, int64) error {
		t.Error("★実在しないプリセットで再構築を呼んではいけない")
		return nil
	})
	if rec := postRebuild(t, h, "999999"); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestRebuildRecipeCache_InvalidID_400(t *testing.T) {
	h := newRebuildHandler(t, func(context.Context, int64) error { return nil })
	if rec := postRebuild(t, h, "abc"); rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

// 再構築が失敗したら握り潰さず 500 を返す(D-360＝失敗は呼び出し元へ返す)。
func TestRebuildRecipeCache_Failure_500(t *testing.T) {
	h := newRebuildHandler(t, func(context.Context, int64) error {
		return errors.New("boom")
	})
	if rec := postRebuild(t, h, "1"); rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

// 再構築関数が注入されていないときは 501。★成功したふりをしない(E-84)。
func TestRebuildRecipeCache_NotWired_501(t *testing.T) {
	h := newRebuildHandler(t, nil)
	if rec := postRebuild(t, h, "1"); rec.Code != http.StatusNotImplemented {
		t.Fatalf("status = %d, want 501", rec.Code)
	}
}

// ★ルートが実際に登録されていること(ハンドラだけ在ってルートが無い形を防ぐ)。
func TestRebuildRecipeCache_RouteRegistered(t *testing.T) {
	h := newRebuildHandler(t, func(context.Context, int64) error { return nil })
	e := echo.New()
	presethandler.RegisterRoutes(e.Group("/api"), h)

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(
		http.MethodPost, "/api/presets/"+strconv.Itoa(1)+"/recipe-cache/rebuild", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("ルート経由の status = %d(want 200)。RegisterRoutes に載っているか", rec.Code)
	}
}
