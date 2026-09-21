package preset_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	presethandler "github.com/plexiblinp/tacpendium/internal/api/preset"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M22-02 §5.1-11 / §5.1-12: 選んだ利用者の userID がプリセット経路へ届いていること。
//
// ★3 経路(タグ / プリセット / 他から引っ越し)のうちプリセットの分。
// 片方だけ差し替えると所有者が別人になる。
// ★プリセットは「見えるが編集できない」形である(List は絞らず、書き込みを
// authorizeMutation が VAL-P07 で弾く)。タグはこれと形が違い、そもそも見えない(D-402)。

// doAs は X-User-Id を添えて叩く。
func doAs(t *testing.T, e *echo.Echo, method, path, body string, userID int64) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	req.Header.Set(mw.UserIDHeader, strconv.FormatInt(userID, 10))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// ★§5.1-11: 作成したプリセットが「送った利用者」のものになる。
func TestCreate_PresetBelongsToRequestingUser(t *testing.T) {
	db := dbtest.Setup(t)
	e := echo.New()
	e.Use(mw.UserContext(stubUserResolver{id: 1}))
	h := presethandler.NewHandler(presetsvc.New(db, presetrepo.New(db), nil, nil), nil)
	presethandler.RegisterRoutes(e.Group("/api"), h)

	res, err := db.Exec(`INSERT INTO users (name) VALUES (?)`, "B")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	userB, _ := res.LastInsertId()

	rec := doAs(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"B のプリセット"}`, userB)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}

	var created struct {
		ID     int64  `json:"id"`
		UserID *int64 `json:"userId"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.UserID == nil {
		t.Errorf("★作成したプリセットに所有者が付いていない, want %d", userB)
	} else if *created.UserID != userB {
		t.Errorf("★作成したプリセットの所有者 = %d, want %d(別人のものになっている)", *created.UserID, userB)
	}
}

// ★§5.1-12（重大 §9-5 の一部）: 別の利用者のプリセットを編集・削除できない。
// ★VAL-P07 の実装(authorizeMutation)には触れていない。渡す値が変わっただけである。
func TestUpdateDelete_CannotTouchAnotherUsersPreset(t *testing.T) {
	db := dbtest.Setup(t)
	e := echo.New()
	e.Use(mw.UserContext(stubUserResolver{id: 1}))
	h := presethandler.NewHandler(presetsvc.New(db, presetrepo.New(db), nil, nil), nil)
	presethandler.RegisterRoutes(e.Group("/api"), h)

	res, err := db.Exec(`INSERT INTO users (name) VALUES (?)`, "B")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	userB, _ := res.LastInsertId()

	// user 1 がカスタムプリセットを作る。
	rec := doAs(t, e, http.MethodPost, "/api/presets", `{"basePresetCode":"srk","name":"1 のプリセット"}`, 1)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var created struct {
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// ★B は編集できない。
	path := "/api/presets/" + strconv.FormatInt(created.ID, 10)
	if got := doAs(t, e, http.MethodPut, path, `{"name":"乗っ取り"}`, userB); got.Code != http.StatusForbidden {
		t.Errorf("★B による更新の status = %d, want 403", got.Code)
	}
	// ★B は削除できない。
	if got := doAs(t, e, http.MethodDelete, path, "", userB); got.Code != http.StatusForbidden {
		t.Errorf("★B による削除の status = %d, want 403", got.Code)
	}

	// 対照: 所有者本人は編集できる。
	if got := doAs(t, e, http.MethodPut, path, `{"name":"改名"}`, 1); got.Code != http.StatusOK {
		t.Errorf("所有者本人の更新の status = %d, want 200 (body=%s)", got.Code, got.Body.String())
	}
}
