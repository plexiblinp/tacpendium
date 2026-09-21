package preset_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-04: 書き込み経路のリポジトリ層テスト。
//
// ★本ファイルが守るのは「SQL が意図どおりの列を書いているか」だけである。
// 保護(403)・上限(8 件)・トランザクション境界はサービス層の責務であり、
// internal/service/preset/service_test.go が主張する。

func beginTx(t *testing.T, db *sql.DB) *sql.Tx {
	t.Helper()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback() })
	return tx
}

// TestRepository_AliasCounts_Baseline は組み込み 3 種のエイリアス実数を記録する。
//
// ★指示書 §3.3-8「コピー 1 回で実体化する行数」の実測点である。値そのものを固定すると
// 新キャラ波のたびに落ちるため、下限だけを主張し、実数は t.Logf で報告する。
func TestRepository_AliasCounts_Baseline(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	total := 0
	for _, code := range []string{
		model.PresetCodeOfficialJaMove,
		model.PresetCodeNumeric,
		model.PresetCodeSRK,
	} {
		id := lookupPresetIDByCode(t, db, code)
		n, err := repo.CountAliasesByPreset(ctx, id)
		if err != nil {
			t.Fatalf("CountAliasesByPreset(%s): %v", code, err)
		}
		if n < 500 {
			t.Errorf("%s のエイリアスが %d 件しかない。seed が欠けている可能性がある", code, n)
		}
		t.Logf("§3.3-8 実測: preset %s (id=%d) のエイリアス = %d 行", code, id, n)
		total += n
	}
	t.Logf("§3.3-8 実測: preset_aliases 合計 = %d 行", total)

	// ★全プリセットで character_id が埋まっていること(M20-03 の 000074 backfill の主張)。
	// コピー元が汚れていればコピー先も汚れるため、コピーのテストの前提になる。
	for _, code := range []string{
		model.PresetCodeOfficialJaMove,
		model.PresetCodeNumeric,
		model.PresetCodeSRK,
	} {
		id := lookupPresetIDByCode(t, db, code)
		n, err := repo.CountAliasesWithNullCharacter(ctx, id)
		if err != nil {
			t.Fatalf("CountAliasesWithNullCharacter(%s): %v", code, err)
		}
		if n != 0 {
			t.Errorf("%s に character_id が NULL の行が %d 件ある", code, n)
		}
	}
}

// TestRepository_CopyAliasesTx は ★コピーが character_id と alias_text_en を
// 引き継ぐことを守る(DES-004 §5.7-1 / 指示書 §4.3-2,3)。
func TestRepository_CopyAliasesTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	srcID := lookupPresetIDByCode(t, db, model.PresetCodeNumeric)
	srcCount, err := repo.CountAliasesByPreset(ctx, srcID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset: %v", err)
	}

	tx := beginTx(t, db)
	dstID, err := repo.CreatePresetTx(ctx, tx, 1, "custom_1", "テスト用コピー", model.PresetCodeNumeric)
	if err != nil {
		t.Fatalf("CreatePresetTx: %v", err)
	}
	copied, err := repo.CopyAliasesTx(ctx, tx, srcID, dstID)
	if err != nil {
		t.Fatalf("CopyAliasesTx: %v", err)
	}
	if int(copied) != srcCount {
		t.Errorf("複製行数 = %d, want %d", copied, srcCount)
	}

	// ★(b) character_id が NULL の行が 0 件。nullable であり、入れ忘れても
	// INSERT は通るうえ UNIQUE にも当たらない。落ちないため唯一の検出手段である。
	var nullChar int
	if err := tx.QueryRowContext(ctx,
		`SELECT count(*) FROM preset_aliases WHERE preset_id = ? AND character_id IS NULL`,
		dstID).Scan(&nullChar); err != nil {
		t.Fatalf("count null character_id: %v", err)
	}
	if nullChar != 0 {
		t.Errorf("コピー直後に character_id が NULL の行が %d 件ある(want 0)", nullChar)
	}

	// character_id はコピー元と 1 行ずつ一致していること(取り違えの検出)。
	var mismatch int
	if err := tx.QueryRowContext(ctx, `
SELECT count(*)
FROM preset_aliases dst
JOIN preset_aliases src ON src.preset_id = ? AND src.move_id = dst.move_id
WHERE dst.preset_id = ?
  AND (dst.character_id IS NOT src.character_id
       OR dst.alias_text <> src.alias_text
       OR dst.alias_text_en IS NOT src.alias_text_en)`,
		srcID, dstID).Scan(&mismatch); err != nil {
		t.Fatalf("count mismatch: %v", err)
	}
	if mismatch != 0 {
		t.Errorf("コピー元と値が食い違う行が %d 件ある(want 0)", mismatch)
	}

	// ★alias_text_en が複製されていること(指示書 §4.3-3)。
	// ★【2026-08-14 更新 = M20-06】旧記述「numeric は micro_forward / micro_back の
	//   2 code に英語表記を持つ」は失効した——層 C-3(P-34 の 13 code)も持つ(D-373)。
	// ★件数は書かない。本アサーションは「1 行でも複製されたか」しか主張しておらず、
	//   件数を書くと投入のたびに失効する(実際 38 → 51 で失効した)。
	//   件数の正本は internal/infra/migration/migrate_m2006_test.go である。
	var enCount int
	if err := tx.QueryRowContext(ctx,
		`SELECT count(*) FROM preset_aliases WHERE preset_id = ? AND alias_text_en IS NOT NULL`,
		dstID).Scan(&enCount); err != nil {
		t.Fatalf("count alias_text_en: %v", err)
	}
	if enCount == 0 {
		t.Error("alias_text_en が 1 行も複製されていない(numeric は英語表記を持つ行を必ず含む)")
	}
	t.Logf("複製実測: %d 行(うち alias_text_en 非 NULL = %d 行)", copied, enCount)
}

// TestRepository_CreatePresetTx_DoesNotReuseGap は ★欠番(2 / 4)を詰めないことを守る。
// presets.id は preset_aliases / recipe_cache キー / config / SUPP-001 §7.4.1 の
// 4 経路から参照されており、詰めると全部ずれる(指示書 §3.3-3・§4.3-6)。
func TestRepository_CreatePresetTx_DoesNotReuseGap(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	tx := beginTx(t, db)
	newID, err := repo.CreatePresetTx(ctx, tx, 1, "custom_1", "テスト", model.PresetCodeSRK)
	if err != nil {
		t.Fatalf("CreatePresetTx: %v", err)
	}
	if newID == 2 || newID == 4 {
		t.Fatalf("欠番 %d が再利用された。AUTOINCREMENT に任せること", newID)
	}
	if newID <= 5 {
		t.Errorf("新 id = %d。既存最大 id(5)より大きいはず", newID)
	}

	// 欠番が埋まっていないこと。
	for _, missing := range []int64{2, 4} {
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM presets WHERE id = ?`, missing).Scan(&n); err != nil {
			t.Fatalf("count preset id=%d: %v", missing, err)
		}
		if n != 0 {
			t.Errorf("id=%d が欠番でない(=%d 行)", missing, n)
		}
	}
}

// TestRepository_DeleteAliasesByPresetTx_LeavesNoOrphan は ★CASCADE に頼らない
// 削除が孤児行を残さないことを守る(指示書 §4.5-3)。
// M20 当時は P-04 により CASCADE が発火しないことが前提だった。★M23-10 で全接続が
// FK=ON になり CASCADE も発火するが、明示削除は二重の保険として残している。
func TestRepository_DeleteAliasesByPresetTx_LeavesNoOrphan(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	srcID := lookupPresetIDByCode(t, db, model.PresetCodeSRK)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	dstID, err := repo.CreatePresetTx(ctx, tx, 1, "custom_1", "消す予定", model.PresetCodeSRK)
	if err != nil {
		t.Fatalf("CreatePresetTx: %v", err)
	}
	if _, err := repo.CopyAliasesTx(ctx, tx, srcID, dstID); err != nil {
		t.Fatalf("CopyAliasesTx: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	tx2, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx2: %v", err)
	}
	deleted, err := repo.DeleteAliasesByPresetTx(ctx, tx2, dstID)
	if err != nil {
		t.Fatalf("DeleteAliasesByPresetTx: %v", err)
	}
	if deleted == 0 {
		t.Error("子行が 1 行も削除されていない")
	}
	if err := repo.DeletePresetTx(ctx, tx2, dstID); err != nil {
		t.Fatalf("DeletePresetTx: %v", err)
	}
	if err := tx2.Commit(); err != nil {
		t.Fatalf("commit tx2: %v", err)
	}

	orphans, err := repo.CountOrphanAliases(ctx)
	if err != nil {
		t.Fatalf("CountOrphanAliases: %v", err)
	}
	if orphans != 0 {
		t.Errorf("削除後に孤児行が %d 件残っている(want 0)", orphans)
	}
}

// TestRepository_ListAliasDetails は編集画面用の読み取りが技の識別情報を伴うことを守る。
func TestRepository_ListAliasDetails(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	presetID := lookupPresetIDByCode(t, db, model.PresetCodeNumeric)
	details, err := repo.ListAliasDetails(ctx, presetID, 1) // character_id=1 (ryu)
	if err != nil {
		t.Fatalf("ListAliasDetails: %v", err)
	}
	if len(details) == 0 {
		t.Fatal("エイリアスが 0 件。前提が崩れている")
	}
	for _, d := range details {
		if d.MoveCode == "" {
			t.Errorf("move_id=%d の moveCode が空", d.MoveID)
		}
		if d.CharacterID != 1 {
			t.Errorf("move_id=%d の characterId = %d, want 1", d.MoveID, d.CharacterID)
		}
	}

	// ★official_ja_move の公式技名が参照として付いていること
	// (moves に技の表示名カラムが無いため、編集画面で技を識別する唯一の手掛かり)。
	withOfficial := 0
	for _, d := range details {
		if d.OfficialAliasText != nil && *d.OfficialAliasText != "" {
			withOfficial++
		}
	}
	if withOfficial == 0 {
		t.Error("officialAliasText が 1 件も解決できていない")
	}
	t.Logf("ryu / numeric のエイリアス = %d 件(公式技名が引けたもの = %d 件)", len(details), withOfficial)
}

// TestRepository_UpdateAliasTextTx は ★alias_text のみを更新することを守る
// (character_id / alias_text_en を巻き込まない)。
func TestRepository_UpdateAliasTextTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	presetID := lookupPresetIDByCode(t, db, model.PresetCodeNumeric)
	moveID := lookupMoveID(t, db, 1, "micro_forward") // alias_text_en を持つ数少ない move

	var beforeEn sql.NullString
	var beforeChar sql.NullInt64
	if err := db.QueryRow(
		`SELECT alias_text_en, character_id FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, moveID).Scan(&beforeEn, &beforeChar); err != nil {
		t.Fatalf("read before: %v", err)
	}

	tx := beginTx(t, db)
	n, err := repo.UpdateAliasTextTx(ctx, tx, presetID, moveID, "テスト表記")
	if err != nil {
		t.Fatalf("UpdateAliasTextTx: %v", err)
	}
	if n != 1 {
		t.Fatalf("更新行数 = %d, want 1", n)
	}

	var afterText string
	var afterEn sql.NullString
	var afterChar sql.NullInt64
	if err := tx.QueryRowContext(ctx,
		`SELECT alias_text, alias_text_en, character_id FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, moveID).Scan(&afterText, &afterEn, &afterChar); err != nil {
		t.Fatalf("read after: %v", err)
	}
	if afterText != "テスト表記" {
		t.Errorf("alias_text = %q, want %q", afterText, "テスト表記")
	}
	if afterEn != beforeEn {
		t.Errorf("alias_text_en が巻き込まれた: %v → %v", beforeEn, afterEn)
	}
	if afterChar != beforeChar {
		t.Errorf("character_id が巻き込まれた: %v → %v", beforeChar, afterChar)
	}
}

// TestRepository_UpdateAliasTextTx_UnknownMove は存在しない (preset, move) の
// 組で 0 行更新が返ることを守る(サービス層がこれを 400 に写像する)。
func TestRepository_UpdateAliasTextTx_UnknownMove(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	presetID := lookupPresetIDByCode(t, db, model.PresetCodeNumeric)
	tx := beginTx(t, db)
	n, err := repo.UpdateAliasTextTx(ctx, tx, presetID, 999999, "x")
	if err != nil {
		t.Fatalf("UpdateAliasTextTx: %v", err)
	}
	if n != 0 {
		t.Errorf("更新行数 = %d, want 0", n)
	}
}

func TestRepository_CountPresets(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	n, err := repo.CountPresets(context.Background(), nil)
	if err != nil {
		t.Fatalf("CountPresets: %v", err)
	}
	// 組み込み 3 種(M20-01)。
	if n != 3 {
		t.Errorf("CountPresets = %d, want 3", n)
	}
}

func TestRepository_CountPresetsByName(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	tx := beginTx(t, db)
	if _, err := repo.CreatePresetTx(ctx, tx, 1, "custom_1", "わたしの記法", model.PresetCodeSRK); err != nil {
		t.Fatalf("CreatePresetTx: %v", err)
	}

	n, err := repo.CountPresetsByName(ctx, tx, 1, "わたしの記法", 0)
	if err != nil {
		t.Fatalf("CountPresetsByName: %v", err)
	}
	if n != 1 {
		t.Errorf("CountPresetsByName = %d, want 1", n)
	}

	// 別ユーザーからは見えない(VAL-P03 は同一ユーザー内の一意性)。
	n, err = repo.CountPresetsByName(ctx, tx, 2, "わたしの記法", 0)
	if err != nil {
		t.Fatalf("CountPresetsByName(other user): %v", err)
	}
	if n != 0 {
		t.Errorf("別ユーザーで %d 件見えた, want 0", n)
	}
}
