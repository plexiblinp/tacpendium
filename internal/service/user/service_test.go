package user_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	userrepo "github.com/plexiblinp/tacpendium/internal/repository/user"
	usersvc "github.com/plexiblinp/tacpendium/internal/service/user"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func newSvc(t *testing.T) (*sql.DB, usersvc.Service) {
	t.Helper()
	db := dbtest.Setup(t)
	return db, usersvc.New(db, userrepo.New(db), tagrepo.New(db))
}

func tagNamesOf(t *testing.T, db *sql.DB, userID int64) []string {
	t.Helper()
	rows, err := db.Query(
		`SELECT name FROM tags WHERE user_id = ? AND category = ? ORDER BY id`,
		userID, model.TagCategoryMyComboStatus)
	if err != nil {
		t.Fatalf("query tags: %v", err)
	}
	defer rows.Close()
	names := []string{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatalf("scan: %v", err)
		}
		names = append(names, n)
	}
	return names
}

func countTags(t *testing.T, db *sql.DB, userID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM tags WHERE user_id = ?`, userID).Scan(&n); err != nil {
		t.Fatalf("count tags: %v", err)
	}
	return n
}

// ★§5.1-18（重大 §9-22）: 利用者を作ると既定タグ 3 件が生成される。
// 生成しないと 2 人目はマイコンボのステータスを 1 件も引けず機能不全になる
// (mycombo_status の 3 タグは migrations/000007 が user_id = 1 にのみ投入している)。
func TestCreate_GeneratesDefaultStatusTags(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	before := countTags(t, db, 1)

	created, err := svc.Create(ctx, "2人目")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got := tagNamesOf(t, db, created.ID)
	want := []string{"使用中", "練習中", "頻度低下"}
	if len(got) != len(want) {
		t.Fatalf("既定タグ = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("既定タグ[%d] = %q, want %q", i, got[i], want[i])
		}
	}

	// ★user_id = 1 の既存 3 行は増減しない。
	if after := countTags(t, db, 1); after != before {
		t.Errorf("user_id = 1 のタグ数が %d → %d へ変わった(触ってはならない)", before, after)
	}
}

// 既定タグの色も seed と一致すること(model の定数が実値の正本)。
func TestCreate_DefaultTagsCarrySeedColors(t *testing.T) {
	db, svc := newSvc(t)
	created, err := svc.Create(context.Background(), "色の確認")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	for _, def := range model.DefaultMyComboStatusTags {
		var color sql.NullString
		err := db.QueryRow(`SELECT color FROM tags WHERE user_id = ? AND name = ?`,
			created.ID, def.Name).Scan(&color)
		if err != nil {
			t.Fatalf("query color for %q: %v", def.Name, err)
		}
		if color.String != def.Color {
			t.Errorf("%q の色 = %q, want %q", def.Name, color.String, def.Color)
		}
	}
}

// ★作成が途中で失敗したら利用者も残さない(1 トランザクション)。
func TestCreate_IsAtomic(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// 既定タグと衝突する名前を先回りで作れないため、tags 表を壊して失敗させる。
	if _, err := db.Exec(`DROP TABLE tags`); err != nil {
		t.Fatalf("drop tags: %v", err)
	}

	if _, err := svc.Create(ctx, "失敗する利用者"); err == nil {
		t.Fatal("既定タグの生成に失敗したのにエラーが返らなかった")
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE name = ?`, "失敗する利用者").Scan(&n); err != nil {
		t.Fatalf("count users: %v", err)
	}
	if n != 0 {
		t.Errorf("既定タグの生成に失敗したのに利用者が %d 行残った", n)
	}
}

func TestCreate_RejectsEmptyName(t *testing.T) {
	_, svc := newSvc(t)
	if _, err := svc.Create(context.Background(), "   "); !errors.Is(err, usersvc.ErrNameEmpty) {
		t.Errorf("err = %v, want ErrNameEmpty", err)
	}
}

func TestCreate_RejectsDuplicateName(t *testing.T) {
	_, svc := newSvc(t)
	ctx := context.Background()
	if _, err := svc.Create(ctx, "同じ名前"); err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.Create(ctx, "同じ名前"); !errors.Is(err, usersvc.ErrNameDuplicate) {
		t.Errorf("err = %v, want ErrNameDuplicate", err)
	}
}

// ★§4.5-4 / §9.1-2: 選ばれていないときの既定は users.id の最小値。
// 既存環境では常に 1 になり、いままでの挙動と変わらない。
func TestDefaultUserID_ReturnsSmallestID(t *testing.T) {
	_, svc := newSvc(t)
	ctx := context.Background()

	id, err := svc.DefaultUserID(ctx)
	if err != nil {
		t.Fatalf("default user id: %v", err)
	}
	if id != 1 {
		t.Errorf("既定の利用者 = %d, want 1(migrations/000007 の 'default')", id)
	}

	// 2 人目を足しても既定は動かない。
	if _, err := svc.Create(ctx, "あとから来た人"); err != nil {
		t.Fatalf("create: %v", err)
	}
	again, err := svc.DefaultUserID(ctx)
	if err != nil {
		t.Fatalf("default user id: %v", err)
	}
	if again != id {
		t.Errorf("2 人目を足したら既定が %d → %d へ動いた", id, again)
	}
}

func TestList_ReturnsAllUsersInIDOrder(t *testing.T) {
	_, svc := newSvc(t)
	ctx := context.Background()
	if _, err := svc.Create(ctx, "B"); err != nil {
		t.Fatalf("create: %v", err)
	}

	users, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("利用者数 = %d, want 2", len(users))
	}
	if users[0].ID >= users[1].ID {
		t.Errorf("id 昇順になっていない: %+v", users)
	}
}

func TestRename(t *testing.T) {
	_, svc := newSvc(t)
	ctx := context.Background()
	created, err := svc.Create(ctx, "旧名")
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := svc.Rename(ctx, created.ID, "新名")
	if err != nil {
		t.Fatalf("rename: %v", err)
	}
	if got.Name != "新名" {
		t.Errorf("name = %q, want 新名", got.Name)
	}
}

func TestRename_NotFound(t *testing.T) {
	_, svc := newSvc(t)
	if _, err := svc.Rename(context.Background(), 9999, "誰か"); !errors.Is(err, usersvc.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}
