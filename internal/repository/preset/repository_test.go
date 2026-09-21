package preset_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func lookupPresetIDByCode(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM presets WHERE code = ?`, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup preset id (code=%s): %v", code, err)
	}
	return id
}

func lookupMoveID(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

func TestRepository_ListAllPresets(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	presets, err := repo.ListAllPresets(context.Background())
	if err != nil {
		t.Fatalf("ListAllPresets: %v", err)
	}
	// 組み込みプリセットは M20-01(000069)で 5 種 → 3 種になった。
	if len(presets) != 3 {
		t.Fatalf("expected 3 presets, got %d", len(presets))
	}
	if presets[0].Code != "official_ja_move" {
		t.Errorf("first preset code = %q, want %q", presets[0].Code, "official_ja_move")
	}
	for _, p := range presets {
		if !p.IsBuiltin {
			t.Errorf("preset %q is not builtin", p.Code)
		}
	}
}

func TestRepository_FindPresetByID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	id := lookupPresetIDByCode(t, db, "official_ja_move")
	p, err := repo.FindPresetByID(context.Background(), id)
	if err != nil {
		t.Fatalf("FindPresetByID: %v", err)
	}
	if p.Code != "official_ja_move" {
		t.Errorf("code = %q, want %q", p.Code, "official_ja_move")
	}
}

func TestRepository_FindPresetByID_NotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	_, err := repo.FindPresetByID(context.Background(), 99999)
	if !errors.Is(err, presetrepo.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestRepository_FindPresetByCode(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	p, err := repo.FindPresetByCode(context.Background(), "srk")
	if err != nil {
		t.Fatalf("FindPresetByCode: %v", err)
	}
	if p.Code != "srk" {
		t.Errorf("code = %q, want %q", p.Code, "srk")
	}
	if p.Name != "SRK 記法" {
		t.Errorf("name = %q, want %q", p.Name, "SRK 記法")
	}
}

func TestRepository_FindPresetByCode_NotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	_, err := repo.FindPresetByCode(context.Background(), "nonexistent")
	if !errors.Is(err, presetrepo.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestRepository_FindAlias(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	moveID := lookupMoveID(t, db, 1, "standing_light_punch")

	alias, err := repo.FindAlias(context.Background(), presetID, moveID)
	if err != nil {
		t.Fatalf("FindAlias: %v", err)
	}
	if alias == nil {
		t.Fatal("expected alias, got nil")
	}
	if alias.AliasText != "立ち弱P" {
		t.Errorf("alias_text = %q, want %q", alias.AliasText, "立ち弱P")
	}
}

// ★M20-02(2026-08-13)で対象 move を付け替えた。
//
// 旧: numeric x standing_light_punch。numeric がエイリアス空だったため nil が返っていた。
// M20-02 で numeric へ実データが入り(5LP)、この主張は成立しなくなった。
// ⇒ 落ちるべくして落ちたテストであり、期待値を緩めるのではなく主張を作り替えた(D-308)。
//
// 新: numeric x ryu/denjin_charge_hadoken。同 move は is_derived=true であり、
// 生成規則の層 A の対象外である(U-2。move_commands が派生技を載せないのと同じ境界)。
// ⇒ numeric / srk のどちらにもエイリアスが無く、DES-004 §5.3 のフォールバックが働く。
// この「実在プリセット x エイリアス未定義の move」こそがフォールバックの入口であり、
// nil が返ることを守るのが本テストの目的である。
func TestRepository_FindAlias_NotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	presetID := lookupPresetIDByCode(t, db, "numeric")
	moveID := lookupMoveID(t, db, 1, "denjin_charge_hadoken")

	alias, err := repo.FindAlias(context.Background(), presetID, moveID)
	if err != nil {
		t.Fatalf("FindAlias: %v", err)
	}
	if alias != nil {
		t.Fatalf("expected nil alias for a move with no numeric alias, got %+v", alias)
	}
}

func TestRepository_ListAliasesByPreset(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	presetID := lookupPresetIDByCode(t, db, "official_ja_move")
	aliases, err := repo.ListAliasesByPreset(context.Background(), presetID)
	if err != nil {
		t.Fatalf("ListAliasesByPreset: %v", err)
	}
	if len(aliases) < 50 {
		t.Fatalf("expected at least 50 aliases for official_ja_move, got %d", len(aliases))
	}
}

// ★M20-02(2026-08-13)で主張を作り替えた(関数名も付け替えた)。
//
// 旧: TestRepository_ListAliasesByPreset_Empty。srk がエイリアス空であることを守っていた
// (M20-01 が意図的に残した仕掛け = D-308)。M20-02 で srk へ 1,260 行が入り、
// 「エイリアスが空のプリセット」は 1 つも無くなったため、旧関数は成立しなくなった。
//
// 新: 存在しない preset_id で 0 件が返ることを守る。関数を削除せず作り替えたのは、
// 「該当 0 件で空スライスを返す(nil ではなくエラーでもない)」という戻り値の契約自体は
// 依然としてテストする価値があるためである。★プリセット削除(M20-04)を実装すると
// 「消えたプリセットの id で引く」経路が実際に生まれる。
func TestRepository_ListAliasesByPreset_UnknownPreset(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	// 実在しない id。presets は 1 / 3 / 5 の 3 行のみ(M20-01)。
	const unknownPresetID = 999
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM presets WHERE id = ?`, unknownPresetID).Scan(&n); err != nil {
		t.Fatalf("count presets: %v", err)
	}
	if n != 0 {
		t.Fatalf("preset id=%d が実在する。テストの前提が崩れている", unknownPresetID)
	}

	aliases, err := repo.ListAliasesByPreset(context.Background(), unknownPresetID)
	if err != nil {
		t.Fatalf("ListAliasesByPreset: %v", err)
	}
	if len(aliases) != 0 {
		t.Fatalf("expected 0 aliases for unknown preset, got %d", len(aliases))
	}
}
