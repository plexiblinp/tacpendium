package character

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

type stubRepo struct {
	chars []model.Character
	err   error
}

func (s *stubRepo) ListByGame(_ context.Context, _ int64) ([]model.Character, error) {
	return s.chars, s.err
}

// 取込専用メソッド(M9-02)。character サービスの読み取りテストでは使用しないためスタブ。
func (s *stubRepo) GameIDByCode(_ context.Context, _ string) (int64, error) {
	return 0, s.err
}

func (s *stubRepo) UpsertByCode(_ context.Context, _ *sql.Tx, _ int64, _ string) (int64, error) {
	return 0, s.err
}

func TestListByGame_InvalidGameID(t *testing.T) {
	svc := New(&stubRepo{})

	for _, id := range []int64{0, -1, -100} {
		_, err := svc.ListByGame(context.Background(), id)
		if !errors.Is(err, ErrInvalidGameID) {
			t.Errorf("ListByGame(%d): want ErrInvalidGameID, got %v", id, err)
		}
	}
}

func TestListByGame_Success(t *testing.T) {
	want := []model.Character{
		{ID: 1, GameID: 1, Code: "ryu", NameJa: "リュウ", NameEn: "Ryu"},
	}
	svc := New(&stubRepo{chars: want})

	got, err := svc.ListByGame(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].ID != 1 {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestListByGame_NilToEmptySlice(t *testing.T) {
	svc := New(&stubRepo{chars: nil})

	got, err := svc.ListByGame(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Error("expected non-nil empty slice, got nil")
	}
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %d items", len(got))
	}
}

func TestListByGame_RepoError(t *testing.T) {
	svc := New(&stubRepo{err: errors.New("db error")})

	_, err := svc.ListByGame(context.Background(), 1)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
