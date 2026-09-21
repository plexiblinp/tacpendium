package tag_test

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

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	taghandler "github.com/plexiblinp/tacpendium/internal/api/tag"
	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M22-02 §5.1-11 / §5.1-17: 選んだ利用者の userID がタグ経路へ届いていること。
//
// ★本ファイルは実 DB と実サービスを通す。既存の handler_test.go はサービスを
// モックしており、userID が実際に SQL の絞り込みへ届くかは見ていない。
// ★破壊確認 B(供給元を定数へ戻す)で赤くなるのはここである。

type defaultResolver struct{ id int64 }

func (d defaultResolver) DefaultUserID(context.Context) (int64, error) { return d.id, nil }

func newScopedRouter(t *testing.T) (*sql.DB, *echo.Echo) {
	t.Helper()
	db := dbtest.Setup(t)
	e := echo.New()
	e.Use(mw.UserContext(defaultResolver{id: 1}))
	h := taghandler.NewHandler(tagsvc.New(tagrepo.New(db)))
	taghandler.RegisterRoutes(e.Group("/api"), h)
	return db, e
}

func request(t *testing.T, e *echo.Echo, method, path, body, userID string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	if userID != "" {
		req.Header.Set(mw.UserIDHeader, userID)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func decodeTags(t *testing.T, rec *httptest.ResponseRecorder) []model.Tag {
	t.Helper()
	var tags []model.Tag
	if err := json.NewDecoder(rec.Body).Decode(&tags); err != nil {
		t.Fatalf("decode: %v (body=%s)", err, rec.Body.String())
	}
	return tags
}

func addUser(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO users (name) VALUES (?)`, name)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return id
}

// ★§5.1-11: X-User-Id がタグ経路の SQL 絞り込みまで届く。
// ★§5.1-17: 別の利用者のタグは見えない(D-402 の絞り込みが維持されている)。
func TestList_IsScopedToRequestingUser(t *testing.T) {
	db, e := newScopedRouter(t)
	userB := addUser(t, db, "B")

	// user 1 は migrations/000007 の 3 件を持つ。B はまだ 0 件。
	recA := request(t, e, http.MethodGet, "/api/tags", "", "1")
	if recA.Code != http.StatusOK {
		t.Fatalf("A status = %d", recA.Code)
	}
	if len(decodeTags(t, recA)) == 0 {
		t.Fatal("user 1 のタグが見えていない(対照)")
	}

	recB := request(t, e, http.MethodGet, "/api/tags", "", strconv.FormatInt(userB, 10))
	if recB.Code != http.StatusOK {
		t.Fatalf("B status = %d", recB.Code)
	}
	if got := decodeTags(t, recB); len(got) != 0 {
		t.Errorf("★B に user 1 のタグが見えている: %+v", got)
	}
}

// ★§5.1-11: 作成したタグが「送った利用者」のものになる。
func TestCreate_BelongsToRequestingUser(t *testing.T) {
	db, e := newScopedRouter(t)
	userB := addUser(t, db, "B")

	rec := request(t, e, http.MethodPost, "/api/tags", `{"name":"B のタグ"}`, strconv.FormatInt(userB, 10))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}

	var owner int64
	if err := db.QueryRow(`SELECT user_id FROM tags WHERE name = ?`, "B のタグ").Scan(&owner); err != nil {
		t.Fatalf("query owner: %v", err)
	}
	if owner != userB {
		t.Errorf("★作成したタグの所有者 = %d, want %d(別人のものになっている)", owner, userB)
	}
}

// ★§5.1-17: 書き込み経路でも守られている(他人のタグは更新・削除できない)。
// ★確定-a: タグの Update / Delete は既に WHERE id = ? AND user_id = ? で絞っている。
// 本テストはその契約が userID の差し替え後も生きていることを固定する。
func TestUpdate_CannotTouchAnotherUsersTag(t *testing.T) {
	db, e := newScopedRouter(t)
	userB := addUser(t, db, "B")

	var tagOfUser1 int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE user_id = 1 LIMIT 1`).Scan(&tagOfUser1); err != nil {
		t.Fatalf("query tag: %v", err)
	}

	rec := request(t, e, http.MethodPatch, "/api/tags/"+strconv.FormatInt(tagOfUser1, 10), `{"name":"乗っ取り"}`, strconv.FormatInt(userB, 10))
	if rec.Code == http.StatusOK {
		t.Errorf("★B が user 1 のタグを更新できてしまった")
	}

	var name string
	if err := db.QueryRow(`SELECT name FROM tags WHERE id = ?`, tagOfUser1).Scan(&name); err != nil {
		t.Fatalf("query name: %v", err)
	}
	if name == "乗っ取り" {
		t.Errorf("★user 1 のタグ名が書き換えられた")
	}
}

// ★§5.1-17: 削除経路でも守られている(他人のタグは削除できない)。
// M35-01 段 1: :126 のコメントが主張する「確定-a」のうち、これまで Update 側しか
// テストが無かった片肺を埋める(followup `tag-delete-user-scope-untested`)。
//
// ★★本テストだけでは repository.Delete の `AND user_id = ?` を守れない —— service.DeleteTag は
// repo.Get(userID, tagID) を先に通すため、DELETE の絞りを外しても本テストは緑のままである
// (M35-01 完了報告の破壊確認 B-1)。repo 層の絞りは
// internal/repository/tag/repository_test.go の TestDelete_IsScopedToUser が個別に見る。
// ⇒ 2 本で 1 組であり、片方だけ消さないこと。
func TestDelete_CannotTouchAnotherUsersTag(t *testing.T) {
	db, e := newScopedRouter(t)
	userB := addUser(t, db, "B")

	var tagOfUser1 int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE user_id = 1 LIMIT 1`).Scan(&tagOfUser1); err != nil {
		t.Fatalf("query tag: %v", err)
	}

	rec := request(t, e, http.MethodDelete, "/api/tags/"+strconv.FormatInt(tagOfUser1, 10), "", strconv.FormatInt(userB, 10))
	if rec.Code == http.StatusNoContent {
		t.Errorf("★B が user 1 のタグを削除できてしまった")
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404(他人のタグは存在しないものとして扱う)", rec.Code)
	}

	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM tags WHERE id = ?`, tagOfUser1).Scan(&remaining); err != nil {
		t.Fatalf("count tag: %v", err)
	}
	if remaining != 1 {
		t.Errorf("★user 1 のタグが消えている(残存 = %d, want 1)", remaining)
	}
}

// ★★§5.1-17 の続き: 他人の「使用中」タグでも、存在と使用件数が漏れないこと。
//
// M35-01 レビュー 高-1。上の TestDelete_CannotTouchAnotherUsersTag は
// migrations/000007 の seed タグ(どのコンボにも使われていない)を拾うため、
// 409 tag_in_use の経路へ入らない。⇒ service.go:106 の repo.Get ガードを外しても緑のままである
// (M35-01 完了報告 §5.1 の B-2)。
//
// ★★穴の実体は repository.CountUsage が tag リポジトリで唯一 userID を取らないことである
// (`SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?`)。前段の repo.Get だけが
// 他人の tagID がそこへ届くのを止めている。⇒ ガードを外すと 409 と usageCount が返り、
// 他人のタグの存在と使用件数が漏れる。
//
// ★本テストはその前段ガードを固定する。破壊確認 B-2 で赤くなるのはここである。
func TestDelete_DoesNotLeakAnotherUsersTagUsage(t *testing.T) {
	db, e := newScopedRouter(t)
	userB := addUser(t, db, "B")

	var tagOfUser1 int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE user_id = 1 LIMIT 1`).Scan(&tagOfUser1); err != nil {
		t.Fatalf("query tag: %v", err)
	}

	// user 1 のタグを「使用中」にする(これが無いと 409 経路へ入らず、本テストは何も見ない)。
	comboID := dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": 1,
		"is_draft":     0,
		"step_count":   0,
		"version":      1,
		"created_at":   dbtest.Raw("datetime('now')"),
		"updated_at":   dbtest.Raw("datetime('now')"),
	})
	dbtest.Insert(t, db, "combo_tags", dbtest.Cols{"combo_id": comboID, "tag_id": tagOfUser1})

	// 対照: 所有者が force なしで消そうとすれば 409 になる(使用中であることの確認)。
	recOwner := request(t, e, http.MethodDelete, "/api/tags/"+strconv.FormatInt(tagOfUser1, 10), "", "1")
	if recOwner.Code != http.StatusConflict {
		t.Fatalf("対照: 所有者からの削除 status = %d, want 409(使用中にできていない)", recOwner.Code)
	}

	// 本題: 他人から撃つと 404 であり、使用件数が漏れないこと。
	rec := request(t, e, http.MethodDelete, "/api/tags/"+strconv.FormatInt(tagOfUser1, 10), "", strconv.FormatInt(userB, 10))
	if rec.Code == http.StatusConflict {
		t.Errorf("★他人のタグが「使用中」として 409 を返した(存在が漏れている): %s", rec.Body.String())
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "usageCount") {
		t.Errorf("★応答に usageCount が含まれる(使用件数が漏れている): %s", rec.Body.String())
	}
}
