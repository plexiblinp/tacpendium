package tag_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

const testUserID int64 = 1

// insertTaggableCombo は combo_tags の参照先にするコンボを 1 行作る。
// 列集合は寄せる前の inline INSERT と同一(character_id / is_draft / step_count /
// version / created_at / updated_at)。
func insertTaggableCombo(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	return dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": 1,
		"is_draft":     0,
		"step_count":   0,
		"version":      1,
		"created_at":   dbtest.Raw("datetime('now')"),
		"updated_at":   dbtest.Raw("datetime('now')"),
	})
}

func newSvc(t *testing.T) tagsvc.Service {
	t.Helper()
	db := dbtest.Setup(t)
	return tagsvc.New(tagrepo.New(db))
}

func ptrStr(s string) *string { return &s }

// ===========================================================================
// CreateTag テスト
// ===========================================================================

func TestCreateTag_NameOnly(t *testing.T) {
	svc := newSvc(t)
	tag, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "新タグ"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tag.Name != "新タグ" {
		t.Errorf("name = %q, want %q", tag.Name, "新タグ")
	}
}

func TestCreateTag_WithCategory(t *testing.T) {
	svc := newSvc(t)
	tag, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{
		Name:     "分類タグ",
		Category: ptrStr("custom"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tag.Category == nil || *tag.Category != "custom" {
		t.Errorf("category = %v, want custom", tag.Category)
	}
}

func TestCreateTag_WithCategoryAndColor(t *testing.T) {
	svc := newSvc(t)
	tag, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{
		Name:     "カラータグ",
		Category: ptrStr("custom"),
		Color:    ptrStr("#FF0000"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tag.Color == nil || *tag.Color != "#FF0000" {
		t.Errorf("color = %v, want #FF0000", tag.Color)
	}
}

func TestCreateTag_VAL_T01_Duplicate(t *testing.T) {
	svc := newSvc(t)
	input := model.CreateTagInput{Name: "重複タグ"}
	if _, err := svc.CreateTag(context.Background(), testUserID, input); err != nil {
		t.Fatalf("first create: %v", err)
	}
	_, err := svc.CreateTag(context.Background(), testUserID, input)
	if !errors.Is(err, tagsvc.ErrTagNameDuplicate) {
		t.Errorf("want ErrTagNameDuplicate, got %v", err)
	}
}

func TestCreateTag_VAL_T02_EmptyName(t *testing.T) {
	svc := newSvc(t)
	for _, name := range []string{"", "   "} {
		_, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: name})
		if !errors.Is(err, tagsvc.ErrTagNameEmpty) {
			t.Errorf("name=%q: want ErrTagNameEmpty, got %v", name, err)
		}
	}
}

// ===========================================================================
// UpdateTag テスト
// ===========================================================================

func TestUpdateTag_NameOnly(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "元の名前"})
	updated, err := svc.UpdateTag(context.Background(), testUserID, created.ID, model.UpdateTagInput{
		Name: ptrStr("変更後"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Name != "変更後" {
		t.Errorf("name = %q, want %q", updated.Name, "変更後")
	}
}

func TestUpdateTag_CategoryOnly(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "カテゴリ変更"})
	updated, err := svc.UpdateTag(context.Background(), testUserID, created.ID, model.UpdateTagInput{
		Category: ptrStr("new_cat"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Category == nil || *updated.Category != "new_cat" {
		t.Errorf("category = %v, want new_cat", updated.Category)
	}
}

func TestUpdateTag_ColorOnly(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "色変更"})
	updated, err := svc.UpdateTag(context.Background(), testUserID, created.ID, model.UpdateTagInput{
		Color: ptrStr("#0000FF"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Color == nil || *updated.Color != "#0000FF" {
		t.Errorf("color = %v, want #0000FF", updated.Color)
	}
}

func TestUpdateTag_MultipleFields(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "複合更新"})
	updated, err := svc.UpdateTag(context.Background(), testUserID, created.ID, model.UpdateTagInput{
		Name:  ptrStr("複合更新後"),
		Color: ptrStr("#123456"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Name != "複合更新後" || updated.Color == nil || *updated.Color != "#123456" {
		t.Errorf("unexpected result: name=%q color=%v", updated.Name, updated.Color)
	}
}

func TestUpdateTag_VAL_T01_DuplicateWithOther(t *testing.T) {
	svc := newSvc(t)
	if _, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "既存タグ"}); err != nil {
		t.Fatalf("create existing: %v", err)
	}
	target, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "変更対象"})
	_, err := svc.UpdateTag(context.Background(), testUserID, target.ID, model.UpdateTagInput{
		Name: ptrStr("既存タグ"),
	})
	if !errors.Is(err, tagsvc.ErrTagNameDuplicate) {
		t.Errorf("want ErrTagNameDuplicate, got %v", err)
	}
}

func TestUpdateTag_VAL_T02_EmptyName(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "空更新対象"})
	for _, name := range []string{"", "  "} {
		_, err := svc.UpdateTag(context.Background(), testUserID, created.ID, model.UpdateTagInput{
			Name: ptrStr(name),
		})
		if !errors.Is(err, tagsvc.ErrTagNameEmpty) {
			t.Errorf("name=%q: want ErrTagNameEmpty, got %v", name, err)
		}
	}
}

// ===========================================================================
// DeleteTag テスト
// ===========================================================================

func TestDeleteTag_Unused(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "削除対象"})
	if err := svc.DeleteTag(context.Background(), testUserID, created.ID, false); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, err := svc.GetTag(context.Background(), testUserID, created.ID)
	if !errors.Is(err, tagsvc.ErrNotFound) {
		t.Errorf("after delete: want ErrNotFound, got %v", err)
	}
}

func TestDeleteTag_InUse_ForcefalseReturnsError(t *testing.T) {
	db := dbtest.Setup(t)
	svc := tagsvc.New(tagrepo.New(db))
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "使用中タグ"})

	// combo_tags に手動で関連付け(テスト用に combos も作成)
	comboID := insertTaggableCombo(t, db)
	dbtest.Insert(t, db, "combo_tags", dbtest.Cols{"combo_id": comboID, "tag_id": created.ID})

	err := svc.DeleteTag(context.Background(), testUserID, created.ID, false)
	if !errors.Is(err, tagsvc.ErrTagInUse) {
		t.Fatalf("want ErrTagInUse, got %v", err)
	}
	// usage count が含まれることを確認
	var inUseErr *tagsvc.TagInUseError
	if errors.As(err, &inUseErr) {
		if inUseErr.UsageCount != 1 {
			t.Errorf("usage_count = %d, want 1", inUseErr.UsageCount)
		}
	} else {
		t.Errorf("error is not TagInUseError: %T", err)
	}
}

func TestDeleteTag_InUse_ForceTrueDeletes(t *testing.T) {
	db := dbtest.Setup(t)
	svc := tagsvc.New(tagrepo.New(db))
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "強制削除対象"})

	comboID := insertTaggableCombo(t, db)
	dbtest.Insert(t, db, "combo_tags", dbtest.Cols{"combo_id": comboID, "tag_id": created.ID})

	if err := svc.DeleteTag(context.Background(), testUserID, created.ID, true); err != nil {
		t.Fatalf("force delete: %v", err)
	}
	// combo_tags も CASCADE 削除されることを確認
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?`, created.ID).Scan(&count); err != nil {
		t.Fatalf("count combo_tags: %v", err)
	}
	if count != 0 {
		t.Errorf("combo_tags count = %d, want 0 after cascade delete", count)
	}
}

// ===========================================================================
// ListTags テスト
// ===========================================================================

func TestListTags_AllCategories(t *testing.T) {
	svc := newSvc(t)
	if _, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "タグA", Category: ptrStr("cat1")}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "タグB", Category: ptrStr("cat2")}); err != nil {
		t.Fatal(err)
	}
	// migration 000007 で mycombo_status カテゴリの3タグが既に存在
	tags, err := svc.ListTags(context.Background(), testUserID, "", false, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	// 少なくとも作成した2件が含まれる
	if len(tags) < 2 {
		t.Errorf("len(tags) = %d, want >= 2", len(tags))
	}
}

func TestListTags_CategoryFilter(t *testing.T) {
	svc := newSvc(t)
	if _, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "フィルタA", Category: ptrStr("target")}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "フィルタB", Category: ptrStr("other")}); err != nil {
		t.Fatal(err)
	}
	tags, err := svc.ListTags(context.Background(), testUserID, "target", false, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	for _, tag := range tags {
		if tag.Category == nil || *tag.Category != "target" {
			t.Errorf("unexpected tag category: %v (name=%s)", tag.Category, tag.Name)
		}
	}
}

func TestListTags_IncludeUsage(t *testing.T) {
	db := dbtest.Setup(t)
	svc := tagsvc.New(tagrepo.New(db))
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "使用数確認"})

	comboID := insertTaggableCombo(t, db)
	dbtest.Insert(t, db, "combo_tags", dbtest.Cols{"combo_id": comboID, "tag_id": created.ID})

	tags, err := svc.ListTags(context.Background(), testUserID, "", true, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	found := false
	for _, tag := range tags {
		if tag.ID == created.ID {
			found = true
			if tag.UsageCount == nil || *tag.UsageCount != 1 {
				t.Errorf("usage_count = %v, want 1", tag.UsageCount)
			}
		}
	}
	if !found {
		t.Errorf("created tag not found in list")
	}
}

// ===========================================================================
// GetTag テスト
// ===========================================================================

func TestGetTag_Exists(t *testing.T) {
	svc := newSvc(t)
	created, _ := svc.CreateTag(context.Background(), testUserID, model.CreateTagInput{Name: "取得対象"})
	got, err := svc.GetTag(context.Background(), testUserID, created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ID != created.ID || got.Name != "取得対象" {
		t.Errorf("got = %+v, want id=%d name=取得対象", got, created.ID)
	}
}

func TestGetTag_NotFound(t *testing.T) {
	svc := newSvc(t)
	_, err := svc.GetTag(context.Background(), testUserID, 99999)
	if !errors.Is(err, tagsvc.ErrNotFound) {
		t.Errorf("want ErrNotFound, got %v", err)
	}
}
