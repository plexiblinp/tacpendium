package character_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	charrepo "github.com/plexiblinp/tacpendium/internal/repository/character"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 改善レーン S3: repository/character は service/api 層にテストがある一方で
// repository 層のみ未カバーだったため、現挙動を固定する characterization テストを追加する。

const sf6GameID int64 = 1

func TestListByGame_ReturnsSeededCharactersOrderedByID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)

	items, err := repo.ListByGame(context.Background(), sf6GameID)
	if err != nil {
		t.Fatalf("ListByGame: %v", err)
	}
	if len(items) == 0 {
		t.Fatal("expected seeded characters, got 0")
	}

	foundRyu := false
	for i, ch := range items {
		if ch.GameID != sf6GameID {
			t.Errorf("items[%d].GameID = %d, want %d", i, ch.GameID, sf6GameID)
		}
		if i > 0 && items[i-1].ID >= ch.ID {
			t.Errorf("items must be ordered by id asc: items[%d].ID=%d >= items[%d].ID=%d",
				i-1, items[i-1].ID, i, ch.ID)
		}
		if ch.Code == "ryu" {
			foundRyu = true
			if ch.NameJa != "リュウ" || ch.NameEn != "Ryu" {
				t.Errorf("ryu names = (%q, %q), want (リュウ, Ryu)", ch.NameJa, ch.NameEn)
			}
		}
	}
	if !foundRyu {
		t.Error("seeded character 'ryu' not found")
	}
}

func TestListByGame_UnknownGame_ReturnsEmptyNonNil(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)

	items, err := repo.ListByGame(context.Background(), 99999)
	if err != nil {
		t.Fatalf("ListByGame: %v", err)
	}
	if items == nil {
		t.Error("expected non-nil empty slice (JSON で null でなく [] を返すため)")
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
}

func TestGameIDByCode(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)

	id, err := repo.GameIDByCode(context.Background(), "sf6")
	if err != nil {
		t.Fatalf("GameIDByCode(sf6): %v", err)
	}
	if id != sf6GameID {
		t.Errorf("id = %d, want %d", id, sf6GameID)
	}

	_, err = repo.GameIDByCode(context.Background(), "no-such-game")
	if err == nil {
		t.Fatal("expected error for unknown code")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("error must wrap sql.ErrNoRows (doc 契約), got %v", err)
	}
}

func TestUpsertByCode_RequiresTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)

	if _, err := repo.UpsertByCode(context.Background(), nil, sf6GameID, "ryu"); err == nil {
		t.Fatal("expected error when tx is nil")
	}
}

func TestUpsertByCode_ExistingKeepsSeedNames(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	ctx := context.Background()

	var wantID int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE game_id = ? AND code = 'ryu'`, sf6GameID).Scan(&wantID); err != nil {
		t.Fatalf("lookup ryu: %v", err)
	}

	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	got, err := repo.UpsertByCode(ctx, tx, sf6GameID, "ryu")
	if err != nil {
		t.Fatalf("UpsertByCode(ryu): %v", err)
	}
	if got != wantID {
		t.Errorf("id = %d, want existing %d", got, wantID)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	// seed の表示名が上書きされていないこと(ON CONFLICT DO NOTHING)
	var nameJa string
	if err := db.QueryRow(`SELECT name_ja FROM characters WHERE id = ?`, wantID).Scan(&nameJa); err != nil {
		t.Fatalf("re-select: %v", err)
	}
	if nameJa != "リュウ" {
		t.Errorf("name_ja = %q, want seed name preserved", nameJa)
	}
}

func TestUpsertByCode_NewCharacterUsesCodeAsProvisionalName(t *testing.T) {
	db := dbtest.Setup(t)
	repo := charrepo.New(db)
	ctx := context.Background()

	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	id, err := repo.UpsertByCode(ctx, tx, sf6GameID, "brand_new_char")
	if err != nil {
		t.Fatalf("UpsertByCode(new): %v", err)
	}
	if id <= 0 {
		t.Fatalf("id = %d, want positive", id)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var nameJa, nameEn string
	if err := db.QueryRow(`SELECT name_ja, name_en FROM characters WHERE id = ?`, id).Scan(&nameJa, &nameEn); err != nil {
		t.Fatalf("re-select: %v", err)
	}
	if nameJa != "brand_new_char" || nameEn != "brand_new_char" {
		t.Errorf("provisional names = (%q, %q), want code as-is", nameJa, nameEn)
	}

	// 同一 code の再 upsert は同じ id を返す(冪等)
	tx2, err := db.Begin()
	if err != nil {
		t.Fatalf("begin2: %v", err)
	}
	defer func() { _ = tx2.Rollback() }()
	id2, err := repo.UpsertByCode(ctx, tx2, sf6GameID, "brand_new_char")
	if err != nil {
		t.Fatalf("UpsertByCode(again): %v", err)
	}
	if id2 != id {
		t.Errorf("idempotent upsert: id2 = %d, want %d", id2, id)
	}
}
