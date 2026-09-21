package tag_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

const testUserID int64 = 1

// TestListWithUsage は includeUsage=true の JOIN クエリが正しく usage_count を返すことを確認する。
func TestListWithUsage(t *testing.T) {
	db := dbtest.Setup(t)
	repo := tagrepo.New(db)
	ctx := context.Background()

	// タグ2件作成(1件は使用中、1件は未使用)
	usedTag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "使用中タグ"})
	if err != nil {
		t.Fatalf("create used tag: %v", err)
	}
	unusedTag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "未使用タグ"})
	if err != nil {
		t.Fatalf("create unused tag: %v", err)
	}

	// combo を2件作成して usedTag に紐付け
	comboID1 := insertCombo(t, db)
	comboID2 := insertCombo(t, db)
	insertComboTag(t, db, comboID1, usedTag.ID)
	insertComboTag(t, db, comboID2, usedTag.ID)

	tags, err := repo.List(ctx, testUserID, "", true, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	for _, tag := range tags {
		switch tag.ID {
		case usedTag.ID:
			if tag.UsageCount == nil || *tag.UsageCount != 2 {
				t.Errorf("used tag usage_count = %v, want 2", tag.UsageCount)
			}
		case unusedTag.ID:
			if tag.UsageCount == nil || *tag.UsageCount != 0 {
				t.Errorf("unused tag usage_count = %v, want 0", tag.UsageCount)
			}
		}
	}
}

// TestListWithUsage_CharacterFilter は characterID 指定時に usage_count が
// 当該キャラのコンボのみで集計されることを確認する(E-3: マイコンボ件数のキャラ追従)。
func TestListWithUsage_CharacterFilter(t *testing.T) {
	db := dbtest.Setup(t)
	repo := tagrepo.New(db)
	ctx := context.Background()

	tag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "ステータスタグ"})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}

	// M12-05(000017): aki/jamie/guile を除去したため、存在するキャラ(ryu + classic5)の
	// 実 id を code で引いて使う(id 直書きを避け、FK 制約に追従)。
	lookupChar := func(code string) int64 {
		t.Helper()
		var id int64
		if err := db.QueryRow(`SELECT id FROM characters WHERE code = ?`, code).Scan(&id); err != nil {
			t.Fatalf("lookup character %q: %v", code, err)
		}
		return id
	}
	char1 := lookupChar("ryu")
	char2 := lookupChar("ken")
	char3 := lookupChar("ingrid") // コンボを紐付けないキャラ(usage_count=0 の確認用)

	// キャラ1のコンボ2件、キャラ2のコンボ1件を同タグに紐付け
	comboChar1a := insertComboForCharacter(t, db, char1)
	comboChar1b := insertComboForCharacter(t, db, char1)
	comboChar2 := insertComboForCharacter(t, db, char2)
	insertComboTag(t, db, comboChar1a, tag.ID)
	insertComboTag(t, db, comboChar1b, tag.ID)
	insertComboTag(t, db, comboChar2, tag.ID)

	usageFor := func(characterID *int64) int {
		t.Helper()
		tags, err := repo.List(ctx, testUserID, "", true, characterID)
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		for _, tg := range tags {
			if tg.ID == tag.ID {
				if tg.UsageCount == nil {
					t.Fatalf("usage_count is nil")
				}
				return *tg.UsageCount
			}
		}
		t.Fatalf("tag %d not found in list", tag.ID)
		return -1
	}

	if got := usageFor(&char1); got != 2 {
		t.Errorf("character 1 usage_count = %d, want 2", got)
	}
	if got := usageFor(&char2); got != 1 {
		t.Errorf("character 2 usage_count = %d, want 1", got)
	}
	if got := usageFor(&char3); got != 0 {
		t.Errorf("character 3 (no combos) usage_count = %d, want 0", got)
	}
	if got := usageFor(nil); got != 3 {
		t.Errorf("nil (all characters) usage_count = %d, want 3", got)
	}
}

// TestListWithUsage_ExcludesTrashedCombos は usage_count が論理削除(ゴミ箱内)の
// コンボを数えないことを確認する(改善レーン B2)。
// 推測: usage_count の表示先(マイコンボ件数バッジ・タグ管理一覧)はいずれも
// 論理削除済みコンボを表示しないため、集計も可視コンボに揃うべきと仮定した。
// なお削除ガード(CountUsage)は復元時のタグ保護の観点からゴミ箱を含む現挙動を維持する
// (セマンティクス確定は要判断として開発者に委ねる)。
func TestListWithUsage_ExcludesTrashedCombos(t *testing.T) {
	db := dbtest.Setup(t)
	repo := tagrepo.New(db)
	ctx := context.Background()

	tag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "ゴミ箱境界タグ"})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}

	kept := insertCombo(t, db)
	trashed := insertCombo(t, db)
	insertComboTag(t, db, kept, tag.ID)
	insertComboTag(t, db, trashed, tag.ID)

	// 片方を論理削除(ゴミ箱へ)
	if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, trashed); err != nil {
		t.Fatalf("soft delete combo: %v", err)
	}

	tags, err := repo.List(ctx, testUserID, "", true, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, tg := range tags {
		if tg.ID == tag.ID {
			if tg.UsageCount == nil || *tg.UsageCount != 1 {
				t.Errorf("usage_count = %v, want 1 (trashed combo must be excluded)", tg.UsageCount)
			}
			return
		}
	}
	t.Fatalf("tag %d not found in list", tag.ID)
}

// TestCountUsage は combo_tags の COUNT(*) が正しく返ることを確認する。
func TestCountUsage(t *testing.T) {
	db := dbtest.Setup(t)
	repo := tagrepo.New(db)
	ctx := context.Background()

	tag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "カウントタグ"})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}

	count, err := repo.CountUsage(ctx, tag.ID)
	if err != nil {
		t.Fatalf("count usage: %v", err)
	}
	if count != 0 {
		t.Errorf("initial count = %d, want 0", count)
	}

	comboID := insertCombo(t, db)
	insertComboTag(t, db, comboID, tag.ID)

	count, err = repo.CountUsage(ctx, tag.ID)
	if err != nil {
		t.Fatalf("count usage after insert: %v", err)
	}
	if count != 1 {
		t.Errorf("count = %d, want 1", count)
	}
}

// TestDelete_IsScopedToUser は Delete の `AND user_id = ?` が他人のタグを守ることを確認する。
//
// ★★M35-01 段 1。API 層の TestDelete_CannotTouchAnotherUsersTag では本条件を守れない ——
// service.DeleteTag は repo.Get(userID, tagID) を先に通すため、ここの `AND user_id = ?` を
// 外しても API 層のテストは緑のままである(M35-01 完了報告の破壊確認 B-1)。
// ⇒ repo 層の絞りを個別に見る試験がここに要る。2 本で 1 組であり、片方だけ消さないこと。
func TestDelete_IsScopedToUser(t *testing.T) {
	db := dbtest.Setup(t)
	repo := tagrepo.New(db)
	ctx := context.Background()

	tag, err := repo.Create(ctx, testUserID, model.CreateTagInput{Name: "所有者のタグ"})
	if err != nil {
		t.Fatalf("create tag: %v", err)
	}
	otherUserID := dbtest.Insert(t, db, "users", dbtest.Cols{"name": "B"})

	if err := repo.Delete(ctx, otherUserID, tag.ID); !errors.Is(err, tagrepo.ErrNotFound) {
		t.Errorf("★他人のタグを削除できてしまった: err = %v, want ErrNotFound", err)
	}

	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM tags WHERE id = ?`, tag.ID).Scan(&remaining); err != nil {
		t.Fatalf("count tag: %v", err)
	}
	if remaining != 1 {
		t.Errorf("★所有者のタグが消えている(残存 = %d, want 1)", remaining)
	}

	// 対照: 所有者からは消せる(絞りが常に 0 行にしているのではないことを示す)。
	if err := repo.Delete(ctx, testUserID, tag.ID); err != nil {
		t.Fatalf("所有者からの削除が失敗した(対照): %v", err)
	}
}

// ===========================================================================
// ヘルパ
// ===========================================================================

func insertCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	return insertComboForCharacter(t, db, 1)
}

func insertComboForCharacter(t *testing.T, db *sql.DB, characterID int64) int64 {
	t.Helper()
	return dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": characterID,
		"is_draft":     0,
		"step_count":   0,
		"version":      1,
		"created_at":   dbtest.Raw("datetime('now')"),
		"updated_at":   dbtest.Raw("datetime('now')"),
	})
}

func insertComboTag(t *testing.T, db *sql.DB, comboID, tagID int64) {
	t.Helper()
	dbtest.Insert(t, db, "combo_tags", dbtest.Cols{"combo_id": comboID, "tag_id": tagID})
}
