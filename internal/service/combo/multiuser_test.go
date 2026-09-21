package combo_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M22-02 段 2: コンボは全員で共有し(FR013 前半)、タグは利用者ごとに閉じている(D-402)。
// combo_tags は (combo_id, tag_id) の 2 列で利用者の列を持たないため、
// 「読み出しの絞り込み」と「置換の形」の 2 つが対で要る(D-405 の案 B)。
//
// ★本ファイルが守る性質は、どちらも画面に何も出ない。テストが唯一の網である。

// createUser は追加の利用者を作る(既定タグは付けない——タグの見え方だけを見るため)。
func createUser(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO users (name) VALUES (?)`, name)
	if err != nil {
		t.Fatalf("create user %q: %v", name, err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return id
}

// ensureTagFor は指定利用者のタグ id を返す(無ければ作る)。
//
// ★user_id = 1 には migrations/000007 が「使用中」「練習中」「頻度低下」を
// 投入済みである。一意制約は UNIQUE (user_id, name) なので、同じ名前を
// 作り直そうとすると落ちる。⇒ 既存を引き当ててから作る。
func ensureTagFor(t *testing.T, db *sql.DB, userID int64, name string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM tags WHERE user_id = ? AND name = ?`, userID, name).Scan(&id)
	if err == nil {
		return id
	}
	res, execErr := db.Exec(`INSERT INTO tags (user_id, name, category) VALUES (?, ?, ?)`,
		userID, name, model.TagCategoryMyComboStatus)
	if execErr != nil {
		t.Fatalf("create tag %q for user %d: %v", name, userID, execErr)
	}
	id, err = res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return id
}

// §5.1-21: B の画面に A のタグが出ない。
func TestGet_DoesNotShowOtherUsersTags(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	userB := createUser(t, db, "B")
	tagA := ensureTagFor(t, db, 1, "使用中")
	tagB := ensureTagFor(t, db, userB, "使用中")

	// A が自分のタグを付けたコンボを作る。
	input := validRyuInput(t, db)
	input.UserID = 1
	input.TagIDs = []int64{tagA}
	saved, _, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// B が同じコンボを見る。★コンボ本体は見える(全員で共有する)。
	gotB, err := svc.Get(ctx, saved.ID, userB)
	if err != nil {
		t.Fatalf("get as B: %v", err)
	}
	if len(gotB.Tags) != 0 {
		t.Errorf("B に A のタグが見えている: %+v", gotB.Tags)
	}

	// A には見える(対照)。絞りすぎて全員に見えなくなっていないことを確かめる。
	gotA, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get as A: %v", err)
	}
	if len(gotA.Tags) != 1 || gotA.Tags[0].ID != tagA {
		t.Errorf("A に自分のタグが見えていない: %+v", gotA.Tags)
	}
	_ = tagB
}

// §5.1-21: 一覧でも同じ。
func TestList_DoesNotShowOtherUsersTags(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	userB := createUser(t, db, "B")
	tagA := ensureTagFor(t, db, 1, "使用中")

	input := validRyuInput(t, db)
	input.UserID = 1
	input.TagIDs = []int64{tagA}
	if _, _, err := svc.Create(ctx, input); err != nil {
		t.Fatalf("create: %v", err)
	}

	combosB, err := svc.List(ctx, combosvc.ListFilter{UserID: userB})
	if err != nil {
		t.Fatalf("list as B: %v", err)
	}
	if len(combosB) == 0 {
		t.Fatal("コンボ本体が B に見えていない(共有されるはず)")
	}
	for _, c := range combosB {
		if len(c.Tags) != 0 {
			t.Errorf("B の一覧に A のタグが載っている: %+v", c.Tags)
		}
	}

	combosA, err := svc.List(ctx, combosvc.ListFilter{UserID: 1})
	if err != nil {
		t.Fatalf("list as A: %v", err)
	}
	found := false
	for _, c := range combosA {
		if len(c.Tags) == 1 && c.Tags[0].ID == tagA {
			found = true
		}
	}
	if !found {
		t.Error("A の一覧に自分のタグが載っていない(対照)")
	}
}

// ★§5.1-22（重大 §9-25）: 2 人目が保存しても 1 人目の紐づけが残る。
// ★破壊確認 C の対象。置換を「combo_id で全消し ＋ 挿入」へ戻すと赤くなる。
func TestUpdate_KeepsOtherUsersTagAssociations(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	userB := createUser(t, db, "B")
	tagA := ensureTagFor(t, db, 1, "使用中")
	tagB := ensureTagFor(t, db, userB, "使用中")

	input := validRyuInput(t, db)
	input.UserID = 1
	input.TagIDs = []int64{tagA}
	saved, _, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// B が自分のタグを付けて保存する。B には A のタグが見えていない。
	bTags := []int64{tagB}
	if _, _, err := svc.UpdateMetadata(ctx, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		UserID: userB,
		TagIDs: &bTags,
	}); err != nil {
		t.Fatalf("update as B: %v", err)
	}

	// ★A の紐づけが残っていること。消えると A のマイコンボから項目が静かに落ちる。
	gotA, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get as A: %v", err)
	}
	if len(gotA.Tags) != 1 || gotA.Tags[0].ID != tagA {
		t.Errorf("B の保存で A の紐づけが消えた: %+v", gotA.Tags)
	}

	// B 自身の紐づけは入っていること(対照)。
	gotB, err := svc.Get(ctx, saved.ID, userB)
	if err != nil {
		t.Fatalf("get as B: %v", err)
	}
	if len(gotB.Tags) != 1 || gotB.Tags[0].ID != tagB {
		t.Errorf("B 自身の紐づけが入っていない: %+v", gotB.Tags)
	}

	// 2 人分で 2 行あること。
	if got := comboTagCount(t, db, saved.ID); got != 2 {
		t.Errorf("combo_tags = %d 行, want 2(A と B の 1 行ずつ)", got)
	}
}

// §5.1-22: 空配列での全消しも自分の分だけに効く。
func TestUpdate_EmptyTagIDsRemovesOnlyOwnAssociations(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	userB := createUser(t, db, "B")
	tagA := ensureTagFor(t, db, 1, "使用中")
	tagB := ensureTagFor(t, db, userB, "使用中")

	input := validRyuInput(t, db)
	input.UserID = 1
	input.TagIDs = []int64{tagA}
	saved, _, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	bTags := []int64{tagB}
	if _, _, err := svc.UpdateMetadata(ctx, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		UserID: userB, TagIDs: &bTags,
	}); err != nil {
		t.Fatalf("update as B: %v", err)
	}

	// B が自分の分を全部外す。
	empty := []int64{}
	current, err := svc.Get(ctx, saved.ID, userB)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if _, _, err := svc.UpdateMetadata(ctx, saved.ID, current.Version, combosvc.UpdateMetadataInput{
		UserID: userB, TagIDs: &empty,
	}); err != nil {
		t.Fatalf("clear as B: %v", err)
	}

	if got := comboTagCount(t, db, saved.ID); got != 1 {
		t.Errorf("combo_tags = %d 行, want 1(A の分だけ残る)", got)
	}
	gotA, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get as A: %v", err)
	}
	if len(gotA.Tags) != 1 {
		t.Errorf("A の紐づけが巻き添えで消えた: %+v", gotA.Tags)
	}
}

// ★§5.1-24: ステータスが自分のタグだけで判定される。
// A と B が同名の既定タグ(使用中)を持つ状態で、B の見え方が A の設定に影響されない。
// ★名前一致のままで足りるのは、絞り込み後は UNIQUE (user_id, name) により
// 自分のタグの中で名前が一意になるためである(§4.5-15)。
func TestGet_StatusTagsAreResolvedWithinOwnTagsOnly(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	userB := createUser(t, db, "B")
	tagA := ensureTagFor(t, db, 1, "使用中")
	ensureTagFor(t, db, userB, "使用中") // B も同名を持つ(既定タグの生成と同じ状況)

	input := validRyuInput(t, db)
	input.UserID = 1
	input.TagIDs = []int64{tagA} // A だけが「使用中」を設定した
	saved, _, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	gotB, err := svc.Get(ctx, saved.ID, userB)
	if err != nil {
		t.Fatalf("get as B: %v", err)
	}
	// ★B は設定していない。同名タグがあっても B のステータスとして出てはならない。
	for _, tag := range gotB.Tags {
		if tag.Name == "使用中" {
			t.Errorf("B が設定していない「使用中」が B のものとして見えている: %+v", tag)
		}
	}
}
