package move

import (
	"context"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
)

// fakeRepo は moverepo.Repository のテスト用フェイク。
type fakeRepo struct {
	moves map[int64]*model.Move

	updateCalled bool
	lastUpdateID int64
	lastFields   moverepo.UpdateMoveFields
	updateErr    error

	rushSrc     *model.Move
	rushNewID   int64
	rushErr     error
	rushCalled  bool
	getNotFound bool // GetByID で ErrNotFound を返す
	nextGetByID *model.Move
}

func (f *fakeRepo) ListByCharacter(context.Context, int64) ([]moverepo.MoveListItem, error) {
	return nil, nil
}

func (f *fakeRepo) GetByID(_ context.Context, id int64) (*moverepo.MoveDetail, error) {
	if f.getNotFound {
		return nil, moverepo.ErrNotFound
	}
	if f.nextGetByID != nil {
		return &moverepo.MoveDetail{Move: *f.nextGetByID}, nil
	}
	m, ok := f.moves[id]
	if !ok {
		return nil, moverepo.ErrNotFound
	}
	return &moverepo.MoveDetail{Move: *m}, nil
}

func (f *fakeRepo) UpdateFields(_ context.Context, id int64, fields moverepo.UpdateMoveFields) error {
	f.updateCalled = true
	f.lastUpdateID = id
	f.lastFields = fields
	return f.updateErr
}

func (f *fakeRepo) InsertRushVariant(_ context.Context, src *model.Move) (int64, error) {
	f.rushCalled = true
	f.rushSrc = src
	// 重複時も既存 id(rushNewID)を載せて返す(本物の repo と同じ契約、CHANGE-032)。
	return f.rushNewID, f.rushErr
}

func ptrInt(v int) *int       { return &v }
func ptrStr(v string) *string { return &v }

func TestUpdateMove_PartialAndManualTotal(t *testing.T) {
	repo := &fakeRepo{moves: map[int64]*model.Move{
		1: {ID: 1, CharacterID: 7, Code: "cr_mp", Category: model.MoveCategoryNormal, Total: ptrInt(20)},
	}}
	svc := New(repo)

	// total を手動入力(自動算術しない、そのまま保存される)。
	got, err := svc.UpdateMove(context.Background(), 1, moverepo.UpdateMoveFields{Total: ptrInt(20)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.updateCalled || repo.lastUpdateID != 1 {
		t.Fatalf("UpdateFields が id=1 で呼ばれていない")
	}
	if repo.lastFields.Total == nil || *repo.lastFields.Total != 20 {
		t.Errorf("total が手動値で渡っていない: %+v", repo.lastFields.Total)
	}
	// nil フィールドは渡されない(部分更新)。
	if repo.lastFields.Startup != nil || repo.lastFields.IsAerial != nil {
		t.Errorf("指定していないフィールドが nil でない: %+v", repo.lastFields)
	}
	if got == nil || got.ID != 1 {
		t.Errorf("更新後の move が返らない: %+v", got)
	}
}

func TestUpdateMove_RawDataNotesTool(t *testing.T) {
	repo := &fakeRepo{moves: map[int64]*model.Move{1: {ID: 1, Category: model.MoveCategoryNormal}}}
	svc := New(repo)
	raw := `{"notes":"原文","notes_tool":"手動付記"}`
	if _, err := svc.UpdateMove(context.Background(), 1, moverepo.UpdateMoveFields{RawData: ptrStr(raw)}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastFields.RawData == nil || *repo.lastFields.RawData != raw {
		t.Errorf("raw_data が渡っていない: %+v", repo.lastFields.RawData)
	}
}

// 注(M14-01): properties 列を削除し PATCH の properties 値域検証(IsKnownProperty)を撤去したため、
// TestUpdateMove_RejectUnknownProperty は廃止した。raw_data の JSON 整形式検証は温存(下記)。

func TestUpdateMove_RejectMalformedJSON(t *testing.T) {
	repo := &fakeRepo{moves: map[int64]*model.Move{1: {ID: 1}}}
	svc := New(repo)
	// raw_data の JSON オブジェクト整形式検証は M14-01 後も温存(combo_scaling 検証は列削除で撤去)。
	_, err := svc.UpdateMove(context.Background(), 1, moverepo.UpdateMoveFields{RawData: ptrStr("{not json")})
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("ValidationError を期待したが: %v", err)
	}
	if repo.updateCalled {
		t.Errorf("検証失敗時に UpdateFields を呼んではならない")
	}
}

func TestUpdateMove_NotFound(t *testing.T) {
	repo := &fakeRepo{moves: map[int64]*model.Move{}, updateErr: moverepo.ErrNotFound}
	svc := New(repo)
	_, err := svc.UpdateMove(context.Background(), 99, moverepo.UpdateMoveFields{Total: ptrInt(1)})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("ErrNotFound を期待したが: %v", err)
	}
}

func TestGenerateRushVariant_Success(t *testing.T) {
	src := &model.Move{ID: 5, CharacterID: 7, Code: "st_mp", Category: model.MoveCategoryNormal, IsAerial: false}
	repo := &fakeRepo{
		moves:     map[int64]*model.Move{5: src, 50: {ID: 50, Code: "rush_st_mp", Category: model.MoveCategoryRushVariant, OriginalMoveID: ptrInt64(5)}},
		rushNewID: 50,
	}
	svc := New(repo)
	got, err := svc.GenerateRushVariant(context.Background(), 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.rushCalled || repo.rushSrc.ID != 5 {
		t.Fatalf("InsertRushVariant が src=5 で呼ばれていない")
	}
	if got.Code != "rush_st_mp" || got.Category != model.MoveCategoryRushVariant {
		t.Errorf("生成された move が想定外: %+v", got)
	}
	if got.OriginalMoveID == nil || *got.OriginalMoveID != 5 {
		t.Errorf("original_move_id が設定されていない: %+v", got.OriginalMoveID)
	}
}

func TestGenerateRushVariant_Unique(t *testing.T) {
	src := &model.Move{ID: 6, Code: "df_hp", Category: model.MoveCategoryUnique, IsAerial: false}
	repo := &fakeRepo{moves: map[int64]*model.Move{6: src, 60: {ID: 60}}, rushNewID: 60}
	svc := New(repo)
	if _, err := svc.GenerateRushVariant(context.Background(), 6); err != nil {
		t.Fatalf("unique は対象のはず: %v", err)
	}
}

func TestGenerateRushVariant_RejectIneligible(t *testing.T) {
	cases := []struct {
		name string
		src  *model.Move
	}{
		{"special", &model.Move{ID: 1, Category: model.MoveCategorySpecial}},
		{"throw", &model.Move{ID: 1, Category: model.MoveCategoryThrow}},
		{"aerial normal", &model.Move{ID: 1, Category: model.MoveCategoryNormal, IsAerial: true}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{moves: map[int64]*model.Move{1: tc.src}}
			svc := New(repo)
			_, err := svc.GenerateRushVariant(context.Background(), 1)
			var re *RushTargetError
			if !errors.As(err, &re) {
				t.Fatalf("RushTargetError を期待したが: %v", err)
			}
			if repo.rushCalled {
				t.Errorf("対象外で InsertRushVariant を呼んではならない")
			}
		})
	}
}

func TestGenerateRushVariant_Duplicate(t *testing.T) {
	src := &model.Move{ID: 5, Code: "st_mp", Category: model.MoveCategoryNormal}
	// 既存 rush_variant の id=77 を repo が ErrConflict と共に返す想定。
	repo := &fakeRepo{
		moves:     map[int64]*model.Move{5: src},
		rushErr:   moverepo.ErrConflict,
		rushNewID: 77,
	}
	svc := New(repo)
	_, err := svc.GenerateRushVariant(context.Background(), 5)
	var ce *RushConflictError
	if !errors.As(err, &ce) {
		t.Fatalf("RushConflictError を期待したが: %v", err)
	}
	if ce.ExistingID != 77 {
		t.Errorf("ExistingID = %d, want 77", ce.ExistingID)
	}
}

func ptrInt64(v int64) *int64 { return &v }
