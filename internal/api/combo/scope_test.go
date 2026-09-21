package combo_test

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

	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M22-02 §5.1-11 / §5.1-22: コンボの書き込み経路にも userID が届いていること。
//
// ★★ 本ファイルが在る理由 ★★
// 既存の handler_test.go は**サービスをモックしている**ため、ハンドラが
// `UserID` を組み立てているかを一切見ていない。実際 M22-02 の初版は
// `toServiceCreateInput` / `toServiceUpdateMetadataInput` / `Materialize` の
// 3 か所で `UserID` を設定し忘れており、**サービス層のテストも E2E も緑のまま**
// だった(サービス層テストは入力を直接組み立てるため、API 層の欠落を踏まない)。
//
// 症状は 500 である——`UserID` が 0 だと
// `DELETE ... WHERE tag_id IN (SELECT id FROM tags WHERE user_id = 0)` が 0 行になり、
// 続く `INSERT INTO combo_tags` が主キー (combo_id, tag_id) に衝突する。
// ⇒ **タグの付いたコンボを編集保存すると必ず落ちる**(パスワード無効・利用者 1 人でも)。
//
// ⇒ 本ファイルは実 DB と実サービスを HTTP から通す。

// defaultUserResolver は X-User-Id 未指定時の既定利用者を固定で返す。
type defaultUserResolver struct{ id int64 }

func (d defaultUserResolver) DefaultUserID(context.Context) (int64, error) { return d.id, nil }

func newComboRouter(t *testing.T) (*sql.DB, *echo.Echo) {
	t.Helper()
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	deps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}
	notationSvc := notation.New(db, presetrepo.New(db), repo, setuprepo.New(db))
	svc := combosvc.New(db, repo, deps, notationSvc, nil, func() int64 { return 1 })

	e := echo.New()
	e.Use(mw.UserContext(defaultUserResolver{id: 1}))
	combohandler.RegisterRoutes(e.Group("/api"), combohandler.NewHandler(svc, notationSvc, nil))
	return db, e
}

func callAs(t *testing.T, e *echo.Echo, method, path, body string, userID int64) *httptest.ResponseRecorder {
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

// firstRyuMove は seed 済みのリュウの技を 1 つ返す。
func firstRyuMove(t *testing.T, db *sql.DB) (characterID, moveID int64) {
	t.Helper()
	err := db.QueryRow(`
		SELECT m.character_id, m.id FROM moves m
		JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'ryu' ORDER BY m.id LIMIT 1`).Scan(&characterID, &moveID)
	if err != nil {
		t.Fatalf("seed の技が引けない: %v", err)
	}
	return characterID, moveID
}

func tagIDOf(t *testing.T, db *sql.DB, userID int64, name string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE user_id = ? AND name = ?`, userID, name).Scan(&id); err != nil {
		t.Fatalf("tag %q(user %d): %v", name, userID, err)
	}
	return id
}

func decodeCombo(t *testing.T, rec *httptest.ResponseRecorder) struct {
	ID      int64 `json:"id"`
	Version int   `json:"version"`
	Tags    []struct {
		ID     int64 `json:"id"`
		UserID int64 `json:"userId"`
	} `json:"tags"`
} {
	t.Helper()
	var out struct {
		ID      int64 `json:"id"`
		Version int   `json:"version"`
		Tags    []struct {
			ID     int64 `json:"id"`
			UserID int64 `json:"userId"`
		} `json:"tags"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return out
}

// ★タグを付けたコンボを作って編集保存できること。
// ★これが H-1 の回帰テストである。UserID を渡し忘れると 500 になる。
func TestCombo_SaveWithTags_DoesNotFail(t *testing.T) {
	db, e := newComboRouter(t)
	charID, moveID := firstRyuMove(t, db)
	tagID := tagIDOf(t, db, 1, "使用中")

	body := `{"characterId":` + strconv.FormatInt(charID, 10) +
		`,"tagIds":[` + strconv.FormatInt(tagID, 10) + `]` +
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		//   ★400 になるのは damage / knockdownAdvantage を欠いたときだけである
		//     (M38-01 追補2 の時点で必須は damage / knockdownAdvantage の 2 欄である)。
		`,"damage":1000,"knockdownAdvantage":30` +
		`,"driveGaugeConsumed":1,"saGaugeConsumed":0` +
		`,"steps":[{"stepOrder":1,"moveId":` + strconv.FormatInt(moveID, 10) + `}]}`
	rec := callAs(t, e, http.MethodPost, "/api/combos", body, 1)
	if rec.Code != http.StatusCreated {
		t.Fatalf("作成の status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	created := decodeCombo(t, rec)

	// ★作成応答に自分のタグが載る(UserID が届いていないと空になる)。
	if len(created.Tags) != 1 || created.Tags[0].ID != tagID {
		t.Errorf("作成応答のタグ = %+v, want 1 件(id=%d)", created.Tags, tagID)
	}

	// ★同じタグを保ったまま編集保存する。ここが H-1 で 500 になっていた。
	patch := `{"version":` + strconv.Itoa(created.Version) +
		`,"memo":"編集した","tagIds":[` + strconv.FormatInt(tagID, 10) + `]}`
	rec = callAs(t, e, http.MethodPatch, "/api/combos/"+strconv.FormatInt(created.ID, 10), patch, 1)
	if rec.Code != http.StatusOK {
		t.Fatalf("★編集保存の status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	updated := decodeCombo(t, rec)
	if len(updated.Tags) != 1 || updated.Tags[0].ID != tagID {
		t.Errorf("編集応答のタグ = %+v, want 1 件(id=%d)", updated.Tags, tagID)
	}

	// combo_tags は 1 行のまま(二重付与になっていない)。
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_tags WHERE combo_id = ?`, created.ID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("combo_tags = %d 行, want 1", n)
	}
}

// ★§5.1-22: 2 人目が HTTP から保存しても 1 人目の紐づけが残る。
// service 層の multiuser_test と同じ性質を、配線を含めて固定する。
func TestCombo_SaveByOtherUser_KeepsFirstUsersTagLink(t *testing.T) {
	db, e := newComboRouter(t)
	charID, moveID := firstRyuMove(t, db)
	tagA := tagIDOf(t, db, 1, "使用中")

	res, err := db.Exec(`INSERT INTO users (name) VALUES (?)`, "B")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	userB, _ := res.LastInsertId()
	res, err = db.Exec(`INSERT INTO tags (user_id, name, category) VALUES (?, ?, ?)`,
		userB, "使用中", "mycombo_status")
	if err != nil {
		t.Fatalf("create tag for B: %v", err)
	}
	tagB, _ := res.LastInsertId()

	// A がタグ付きで作る。
	body := `{"characterId":` + strconv.FormatInt(charID, 10) +
		`,"tagIds":[` + strconv.FormatInt(tagA, 10) + `]` +
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		//   ★400 になるのは damage / knockdownAdvantage を欠いたときだけである
		//     (M38-01 追補2 の時点で必須は damage / knockdownAdvantage の 2 欄である)。
		`,"damage":1000,"knockdownAdvantage":30` +
		`,"driveGaugeConsumed":1,"saGaugeConsumed":0` +
		`,"steps":[{"stepOrder":1,"moveId":` + strconv.FormatInt(moveID, 10) + `}]}`
	rec := callAs(t, e, http.MethodPost, "/api/combos", body, 1)
	if rec.Code != http.StatusCreated {
		t.Fatalf("作成の status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	created := decodeCombo(t, rec)

	// B が同じコンボを開くと、A のタグは見えない。
	rec = callAs(t, e, http.MethodGet, "/api/combos/"+strconv.FormatInt(created.ID, 10), "", userB)
	if rec.Code != http.StatusOK {
		t.Fatalf("B の取得 status = %d", rec.Code)
	}
	if got := decodeCombo(t, rec); len(got.Tags) != 0 {
		t.Errorf("★B に A のタグが見えている: %+v", got.Tags)
	}

	// B が自分のタグを付けて保存する。
	patch := `{"version":` + strconv.Itoa(created.Version) +
		`,"tagIds":[` + strconv.FormatInt(tagB, 10) + `]}`
	rec = callAs(t, e, http.MethodPatch, "/api/combos/"+strconv.FormatInt(created.ID, 10), patch, userB)
	if rec.Code != http.StatusOK {
		t.Fatalf("B の保存 status = %d (body=%s)", rec.Code, rec.Body.String())
	}

	// ★A の紐づけが残っている。
	var n int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM combo_tags WHERE combo_id = ? AND tag_id = ?`, created.ID, tagA).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("★B の保存で A の紐づけが消えた(残 %d 行)", n)
	}
}
