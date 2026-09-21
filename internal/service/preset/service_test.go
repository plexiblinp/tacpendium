package preset_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-04 サービス層テスト。指示書 §5 (a)〜(i) を固定する。
//
// ★本サブが実装したものは「抜けても動く」ものばかりである——保護も上限も
// character_id も孤児行の掃除も、無くてもアプリは動く。したがって本ファイルが
// 成果物の本体である。

const testUserID int64 = 1

func setup(t *testing.T) (*sql.DB, presetrepo.Repository, presetsvc.Service) {
	t.Helper()
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	return db, repo, presetsvc.New(db, repo, nil, nil)
}

func presetIDByCode(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM presets WHERE code = ?`, code).Scan(&id); err != nil {
		t.Fatalf("lookup preset id (code=%s): %v", code, err)
	}
	return id
}

func moveIDByCode(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id); err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

// ---------------------------------------------------------------------------
// (a) コピー / (b) ★character_id / (i) presets.id の欠番
// ---------------------------------------------------------------------------

// Test_Create_CopiesAllAliases は §5 (a)(b)(i) をまとめて固定する。
func Test_Create_CopiesAllAliases(t *testing.T) {
	db, repo, svc := setup(t)
	ctx := context.Background()

	baseID := presetIDByCode(t, db, model.PresetCodeNumeric)
	baseCount, err := repo.CountAliasesByPreset(ctx, baseID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset: %v", err)
	}

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "わたしのナンバリング")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// (a) 件数が一致する
	gotCount, err := repo.CountAliasesByPreset(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset(new): %v", err)
	}
	if gotCount != baseCount {
		t.Errorf("複製件数 = %d, want %d", gotCount, baseCount)
	}

	// (b) ★character_id が NULL の行が 0 件。
	// 同列は nullable であり、入れ忘れても INSERT は通るうえ
	// UNIQUE(preset_id, character_id, alias_text) にも当たらない。
	// 落ちないため、本テストが唯一の検出手段である(指示書 §4.3-2)。
	nullChar, err := repo.CountAliasesWithNullCharacter(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesWithNullCharacter: %v", err)
	}
	if nullChar != 0 {
		t.Errorf("コピー直後に character_id が NULL の行が %d 件ある(want 0)", nullChar)
	}

	// メタ情報
	if created.IsBuiltin {
		t.Error("作成されたプリセットが is_builtin = true になっている")
	}
	if created.UserID == nil || *created.UserID != testUserID {
		t.Errorf("user_id = %v, want %d", created.UserID, testUserID)
	}
	if created.BasePresetCode == nil || *created.BasePresetCode != model.PresetCodeNumeric {
		t.Errorf("base_preset_code = %v, want %q", created.BasePresetCode, model.PresetCodeNumeric)
	}

	// (i) ★presets.id の欠番(2 / 4)を詰めていない
	if created.ID == 2 || created.ID == 4 {
		t.Fatalf("欠番 %d が再利用された。4 経路(preset_aliases / recipe_cache キー / config / SUPP-001 §7.4.1)がずれる", created.ID)
	}
	for _, missing := range []int64{2, 4} {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM presets WHERE id = ?`, missing).Scan(&n); err != nil {
			t.Fatalf("count preset id=%d: %v", missing, err)
		}
		if n != 0 {
			t.Errorf("id=%d が欠番でない(=%d 行)", missing, n)
		}
	}
	// 組み込み 3 種の id は 1 / 3 / 5 のまま
	for code, want := range map[string]int64{
		model.PresetCodeOfficialJaMove: 1,
		model.PresetCodeNumeric:        3,
		model.PresetCodeSRK:            5,
	} {
		if got := presetIDByCode(t, db, code); got != want {
			t.Errorf("preset %s の id = %d, want %d", code, got, want)
		}
	}
}

// Test_Create_CopiesAliasTextEn は alias_text_en が引き継がれることを守る(§4.3-3)。
func Test_Create_CopiesAliasTextEn(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	baseID := presetIDByCode(t, db, model.PresetCodeNumeric)
	var baseEn int
	if err := db.QueryRow(
		`SELECT count(*) FROM preset_aliases WHERE preset_id = ? AND alias_text_en IS NOT NULL`,
		baseID).Scan(&baseEn); err != nil {
		t.Fatalf("count base alias_text_en: %v", err)
	}
	if baseEn == 0 {
		t.Fatal("ベースが alias_text_en を 1 行も持たない。テストの前提が崩れている")
	}

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "コピー")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	var gotEn int
	if err := db.QueryRow(
		`SELECT count(*) FROM preset_aliases WHERE preset_id = ? AND alias_text_en IS NOT NULL`,
		created.ID).Scan(&gotEn); err != nil {
		t.Fatalf("count new alias_text_en: %v", err)
	}
	if gotEn != baseEn {
		t.Errorf("alias_text_en の複製件数 = %d, want %d", gotEn, baseEn)
	}
}

// ---------------------------------------------------------------------------
// (h) トランザクション
// ---------------------------------------------------------------------------

// failingCopyRepo は CopyAliasesTx だけを失敗させる。
// presets への INSERT は成功した後にエイリアス複製が落ちる状況を作り、
// ★1 行も残らないこと(§5 (h))を主張する。
type failingCopyRepo struct {
	presetrepo.Repository
}

func (r *failingCopyRepo) CopyAliasesTx(ctx context.Context, tx *sql.Tx, src, dst int64) (int64, error) {
	return 0, errors.New("injected failure in the middle of the copy")
}

func Test_Create_RollsBackEverythingOnFailure(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	svc := presetsvc.New(db, &failingCopyRepo{Repository: repo}, nil, nil)
	ctx := context.Background()

	before, err := repo.CountPresets(ctx, nil)
	if err != nil {
		t.Fatalf("CountPresets: %v", err)
	}

	if _, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "落ちる予定"); err == nil {
		t.Fatal("Create が成功してしまった。失敗を注入している")
	}

	after, err := repo.CountPresets(ctx, nil)
	if err != nil {
		t.Fatalf("CountPresets(after): %v", err)
	}
	if after != before {
		t.Errorf("presets が %d → %d 件に変化した。1 行も残してはならない", before, after)
	}

	var leftover int
	if err := db.QueryRow(`SELECT count(*) FROM presets WHERE name = ?`, "落ちる予定").Scan(&leftover); err != nil {
		t.Fatalf("count leftover: %v", err)
	}
	if leftover != 0 {
		t.Errorf("中途半端な presets 行が %d 件残っている", leftover)
	}
}

// ---------------------------------------------------------------------------
// (d)(e) 保護
// ---------------------------------------------------------------------------

// Test_Delete_BuiltinIsProtected は §5 (d)。
func Test_Delete_BuiltinIsProtected(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	for _, code := range []string{
		model.PresetCodeOfficialJaMove,
		model.PresetCodeNumeric,
		model.PresetCodeSRK,
	} {
		id := presetIDByCode(t, db, code)
		err := svc.Delete(ctx, testUserID, id)
		if !errors.Is(err, presetsvc.ErrBuiltinProtected) {
			t.Errorf("Delete(%s): err = %v, want ErrBuiltinProtected", code, err)
		}
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM presets WHERE id = ?`, id).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		if n != 1 {
			t.Errorf("組み込み %s が消えた", code)
		}
	}
}

// Test_Update_BuiltinAliasEditIsProtected は §5 (e)。
//
// ★サービス層で拒否されることを主張する。UI で操作を出さないだけでは、
// API を直接叩かれたときに組み込みが壊れる(指示書 §4.4-4 の多層防御)。
// ★組み込みは「削除は不可だが編集は可能」ではない。編集も不可が正である(D-290)。
func Test_Update_BuiltinAliasEditIsProtected(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	presetID := presetIDByCode(t, db, model.PresetCodeOfficialJaMove)
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")

	var before string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, moveID).Scan(&before); err != nil {
		t.Fatalf("read before: %v", err)
	}

	_, err := svc.Update(ctx, testUserID, presetID, nil, []presetsvc.AliasUpdate{
		{MoveID: moveID, AliasText: "書き換え"},
	})
	if !errors.Is(err, presetsvc.ErrBuiltinProtected) {
		t.Fatalf("Update: err = %v, want ErrBuiltinProtected", err)
	}

	var after string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, moveID).Scan(&after); err != nil {
		t.Fatalf("read after: %v", err)
	}
	if after != before {
		t.Errorf("組み込みのエイリアスが書き換わった: %q → %q", before, after)
	}
}

// Test_Update_BuiltinNameIsProtected は名前の変更も拒否されることを守る。
func Test_Update_BuiltinNameIsProtected(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	presetID := presetIDByCode(t, db, model.PresetCodeSRK)
	newName := "書き換えた名前"
	if _, err := svc.Update(ctx, testUserID, presetID, &newName, nil); !errors.Is(err, presetsvc.ErrBuiltinProtected) {
		t.Fatalf("Update: err = %v, want ErrBuiltinProtected", err)
	}
	var name string
	if err := db.QueryRow(`SELECT name FROM presets WHERE id = ?`, presetID).Scan(&name); err != nil {
		t.Fatalf("read name: %v", err)
	}
	if name != "SRK 記法" {
		t.Errorf("組み込みの名前が書き換わった: %q", name)
	}
}

// Test_Mutation_OtherUsersPresetIsForbidden は VAL-P07。
func Test_Mutation_OtherUsersPresetIsForbidden(t *testing.T) {
	_, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "ユーザー1のもの")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	const otherUser int64 = 2
	if err := svc.Delete(ctx, otherUser, created.ID); !errors.Is(err, presetsvc.ErrForbidden) {
		t.Errorf("Delete(other user): err = %v, want ErrForbidden", err)
	}
	newName := "横取り"
	if _, err := svc.Update(ctx, otherUser, created.ID, &newName, nil); !errors.Is(err, presetsvc.ErrForbidden) {
		t.Errorf("Update(other user): err = %v, want ErrForbidden", err)
	}
}

// ---------------------------------------------------------------------------
// (f) 上限
// ---------------------------------------------------------------------------

// Test_Create_EnforcesTotalLimit は §5 (f)。
// ★8 件目までは通り、9 件目が拒否される(組み込み 3 + カスタム 5 = 8)。
// ★1 ユーザーあたりの上限は設けない——別ユーザーからの 9 件目も拒否される。
func Test_Create_EnforcesTotalLimit(t *testing.T) {
	db, repo, svc := setup(t)
	ctx := context.Background()

	before, err := repo.CountPresets(ctx, nil)
	if err != nil {
		t.Fatalf("CountPresets: %v", err)
	}
	if before != 3 {
		t.Fatalf("組み込みが %d 件。前提(3 件)が崩れている", before)
	}

	// 8 件目まで通ること
	for i := 1; i <= presetsvc.PresetTotalLimit-before; i++ {
		name := fmt.Sprintf("カスタム%d", i)
		if _, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, name); err != nil {
			t.Fatalf("Create #%d (合計 %d 件目): %v", i, before+i, err)
		}
	}
	total, err := repo.CountPresets(ctx, nil)
	if err != nil {
		t.Fatalf("CountPresets: %v", err)
	}
	if total != presetsvc.PresetTotalLimit {
		t.Fatalf("合計 = %d, want %d", total, presetsvc.PresetTotalLimit)
	}

	// 9 件目が拒否されること
	_, err = svc.Create(ctx, testUserID, model.PresetCodeNumeric, "9件目")
	if !errors.Is(err, presetsvc.ErrLimitExceeded) {
		t.Fatalf("9 件目: err = %v, want ErrLimitExceeded", err)
	}

	// ★1 ユーザーあたりではなく全体の上限であること(別ユーザーでも拒否される)
	_, err = svc.Create(ctx, 2, model.PresetCodeNumeric, "別ユーザーの9件目")
	if !errors.Is(err, presetsvc.ErrLimitExceeded) {
		t.Fatalf("別ユーザーの 9 件目: err = %v, want ErrLimitExceeded", err)
	}

	after, err := repo.CountPresets(ctx, nil)
	if err != nil {
		t.Fatalf("CountPresets: %v", err)
	}
	if after != presetsvc.PresetTotalLimit {
		t.Errorf("拒否後に合計が %d 件になった, want %d", after, presetsvc.PresetTotalLimit)
	}
	var leftover int
	if err := db.QueryRow(`SELECT count(*) FROM presets WHERE name IN ('9件目','別ユーザーの9件目')`).Scan(&leftover); err != nil {
		t.Fatalf("count leftover: %v", err)
	}
	if leftover != 0 {
		t.Errorf("拒否した作成の行が %d 件残っている", leftover)
	}
}

// ---------------------------------------------------------------------------
// (g) 削除
// ---------------------------------------------------------------------------

// Test_Delete_LeavesNoOrphanAliases は §5 (g)。
//
// ★ON DELETE CASCADE に頼っていないことの主張である。
// M20 当時は PRAGMA foreign_keys が接続プール全体に効いておらず(P-04)、CASCADE は
// 発火しなかった。★M23-10 で全接続が FK=ON になったため、孤児 0 件の観測だけでは
// 「CASCADE に頼っていない」を主張しきれない —— 実装の形は
// Test_Delete_DeletesChildrenExplicitly が呼び出し順で固定している。
func Test_Delete_LeavesNoOrphanAliases(t *testing.T) {
	db, repo, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "消す予定")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	childCount, err := repo.CountAliasesByPreset(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset: %v", err)
	}
	if childCount == 0 {
		t.Fatal("子行が 0 件。テストの前提が崩れている")
	}

	if err := svc.Delete(ctx, testUserID, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	orphans, err := repo.CountOrphanAliases(ctx)
	if err != nil {
		t.Fatalf("CountOrphanAliases: %v", err)
	}
	if orphans != 0 {
		t.Errorf("削除後に孤児行が %d 件残っている(want 0)", orphans)
	}
	remaining, err := repo.CountAliasesByPreset(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset(after): %v", err)
	}
	if remaining != 0 {
		t.Errorf("削除したプリセットの子行が %d 件残っている", remaining)
	}

	// ★本テストだけでは「CASCADE に頼っていない」ことを主張しきれない。
	// ★M23-10 以降、db.Open 経由の接続はすべて FK=ON である。つまり CASCADE は
	// 常に発火するので、CASCADE 依存の実装でも孤児 0 件になる。
	// (M23-10 以前は「接続単位のため引いた接続次第」だった。結論は同じで、
	//  本テストが実装の形を主張できないことに変わりはない。)
	// ⇒ 実装の形そのものは Test_Delete_DeletesChildrenExplicitly が別途固定する。
	var fk int
	if err := db.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("M23-10 以降 db.Open 経由は全接続 FK=ON のはず: foreign_keys = %d", fk)
	}

	if _, err := svc.Get(ctx, created.ID); !errors.Is(err, presetsvc.ErrNotFound) {
		t.Errorf("削除後の Get: err = %v, want ErrNotFound", err)
	}
}

// deleteSpyRepo は削除呼び出しの順序を記録する。
type deleteSpyRepo struct {
	presetrepo.Repository
	calls []string
}

func (r *deleteSpyRepo) DeleteAliasesByPresetTx(ctx context.Context, tx *sql.Tx, presetID int64) (int64, error) {
	r.calls = append(r.calls, "aliases")
	return r.Repository.DeleteAliasesByPresetTx(ctx, tx, presetID)
}

func (r *deleteSpyRepo) DeletePresetTx(ctx context.Context, tx *sql.Tx, id int64) error {
	r.calls = append(r.calls, "preset")
	return r.Repository.DeletePresetTx(ctx, tx, id)
}

// Test_Delete_DeletesChildrenExplicitly は ★削除の実装の形を固定する
// (指示書 §4.5-1 / チェックリスト差し戻し事由 4)。
//
// 孤児 0 件の観測だけでは不十分である——FK=ON の接続なら CASCADE が子行を消し、
// CASCADE 依存の実装でも緑になる(★M23-10 以降は常に FK=ON なので必ずそうなる)。
// 本テストは「サービス層が子行を先に、明示的に消している」ことを呼び出し順で主張する。
func Test_Delete_DeletesChildrenExplicitly(t *testing.T) {
	db := dbtest.Setup(t)
	spy := &deleteSpyRepo{Repository: presetrepo.New(db)}
	svc := presetsvc.New(db, spy, nil, nil)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "順序検証")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	spy.calls = nil

	if err := svc.Delete(ctx, testUserID, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	want := []string{"aliases", "preset"}
	if len(spy.calls) != len(want) {
		t.Fatalf("削除呼び出し = %v, want %v", spy.calls, want)
	}
	for i := range want {
		if spy.calls[i] != want[i] {
			t.Fatalf("削除呼び出し = %v, want %v(子行を先に明示削除すること)", spy.calls, want)
		}
	}
}

// Test_Delete_RefusedWhenReferencedByConfig は D-313(§4.5-4)。
func Test_Delete_RefusedWhenReferencedByConfig(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	// 先に何も参照していない状態で作る
	var currentDefault int64
	svc := presetsvc.New(db, repo, func() int64 { return currentDefault }, nil)

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "既定に設定中")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// config が当該プリセットを指している状態にする
	currentDefault = created.ID
	if err := svc.Delete(ctx, testUserID, created.ID); !errors.Is(err, presetsvc.ErrInUseByConfig) {
		t.Fatalf("Delete: err = %v, want ErrInUseByConfig", err)
	}
	if _, err := svc.Get(ctx, created.ID); err != nil {
		t.Errorf("拒否されたのに削除されている: %v", err)
	}

	// 参照を外せば削除できる
	currentDefault = 1
	if err := svc.Delete(ctx, testUserID, created.ID); err != nil {
		t.Fatalf("Delete(参照解除後): %v", err)
	}
}

// ---------------------------------------------------------------------------
// (c) 一意制約
// ---------------------------------------------------------------------------

// Test_UniqueConstraint_RawErrorNamesIntendedColumns は ★破壊テストである。
//
// 「同一プリセット・同一キャラで 2 つの異なる技が同表記」を DB が弾くことを
// 確認するが、★別の理由で落ちても緑になってしまう。したがってエラー文字列に
// 狙った制約の構成列(preset_id / character_id / alias_text)が出ることまで
// 確認する(M20-03 の教訓。指示書 §5 (c))。
func Test_UniqueConstraint_RawErrorNamesIntendedColumns(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "衝突検証用")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	moveA := moveIDByCode(t, db, 1, "standing_light_punch")
	moveB := moveIDByCode(t, db, 1, "standing_medium_punch")
	var textA string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveA).Scan(&textA); err != nil {
		t.Fatalf("read alias A: %v", err)
	}

	_, rawErr := db.ExecContext(ctx,
		`UPDATE preset_aliases SET alias_text = ? WHERE preset_id = ? AND move_id = ?`,
		textA, created.ID, moveB)
	if rawErr == nil {
		t.Fatal("同一キャラ・同表記の UPDATE が通ってしまった。制約が効いていない")
	}
	msg := rawErr.Error()
	t.Logf("生のエラー: %v", msg)
	for _, want := range []string{
		"UNIQUE constraint failed",
		"preset_aliases.preset_id",
		"preset_aliases.character_id",
		"preset_aliases.alias_text",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("エラー文字列に %q が含まれない。別の理由で落ちている可能性がある: %s", want, msg)
		}
	}
}

// Test_Update_AliasConflictIsNotAnInternalError は §4.2 のエラーの形。
//
// ★500 にしない。利用者の入力誤りであり、監視から見ると偽の障害になる
// (ボード D-275 と同型)。★どの表記が衝突したかを伝えられること。
func Test_Update_AliasConflictIsNotAnInternalError(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "衝突検証用")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	moveA := moveIDByCode(t, db, 1, "standing_light_punch")
	moveB := moveIDByCode(t, db, 1, "standing_medium_punch")
	var textA string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveA).Scan(&textA); err != nil {
		t.Fatalf("read alias A: %v", err)
	}

	_, err = svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: moveB, AliasText: textA},
	})
	if !errors.Is(err, presetsvc.ErrAliasConflict) {
		t.Fatalf("Update: err = %v, want ErrAliasConflict", err)
	}
	var conflict *presetsvc.AliasConflictError
	if !errors.As(err, &conflict) {
		t.Fatalf("具体型 AliasConflictError が取れない: %v", err)
	}
	if conflict.AliasText != textA {
		t.Errorf("衝突表記 = %q, want %q", conflict.AliasText, textA)
	}

	// 巻き戻っていること
	var afterB string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveB).Scan(&afterB); err != nil {
		t.Fatalf("read after: %v", err)
	}
	if afterB == textA {
		t.Error("衝突した更新が残っている")
	}
}

// Test_Update_RejectsCrossingWithAliasTextEn は ★DB では守れない交差条件を
// サービス層が守っていることを固定する(D-317)。
//
// 「ある技の alias_text が、同一プリセット・同一キャラの別の技の alias_text_en と
// 一致する」は列を跨ぐ条件であるため UNIQUE では表現できない
// (migrations/000075 の「★DB では守れないもの」)。seed 経路は
// migrate_m2003_test.go (g) が守っているが、M20-04 が作った利用者編集の経路には
// 検査が無く、★放置すると静かに交差した行ができる。
func Test_Update_RejectsCrossingWithAliasTextEn(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "交差検証")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// alias_text_en を持つ行を 1 件取る。
	// ★【2026-08-14 更新 = M20-06】旧記述「micro_forward / micro_back の 2 code のみ」は
	//   失効した——層 C-3(P-34 の 13 件)も alias_text_en を持つ(D-373)。
	//   本テストは「英語表記を持つ行が 1 件でもある」ことしか要求しないため主張は不変である。
	var enMoveID int64
	var enText string
	if err := db.QueryRow(`
SELECT move_id, alias_text_en FROM preset_aliases
WHERE preset_id = ? AND character_id = 1 AND alias_text_en IS NOT NULL LIMIT 1`,
		created.ID).Scan(&enMoveID, &enText); err != nil {
		t.Fatalf("alias_text_en を持つ行が引けない(前提崩れ): %v", err)
	}

	// 同一キャラの別の技へ、その英語表記と同じ alias_text を入れようとする。
	victim := moveIDByCode(t, db, 1, "standing_light_punch")
	if victim == enMoveID {
		t.Fatal("対象が同一 move になった。テストの前提が崩れている")
	}

	_, err = svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: victim, AliasText: enText},
	})
	if !errors.Is(err, presetsvc.ErrAliasConflict) {
		t.Fatalf("交差が通ってしまった: err = %v, want ErrAliasConflict", err)
	}

	// 巻き戻っていること
	var after string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, victim).Scan(&after); err != nil {
		t.Fatalf("read after: %v", err)
	}
	if after == enText {
		t.Error("拒否したのに値が入っている")
	}

	// ★どの alias_text_en とも一致しない表記は通ること(検査を過剰にしていない)。
	//
	// 注: 「別キャラなら通る」は主張にできない。alias_text_en の値は
	// micro_forward / micro_back の 2 code に入る汎用語であり、★全キャラで同一の
	// 文字列である。したがって別キャラへ同じ文字列を入れるのも本物の交差であり、
	// 拒否されるのが正しい(実測で確認済み)。
	if _, err := svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: victim, AliasText: "交差しない表記"},
	}); err != nil {
		t.Errorf("交差していない編集が拒否された(過剰拒否): %v", err)
	}
}

// Test_Update_DifferentCharacterSameTextIsAllowed は ★制約の範囲を守る。
// 別キャラなら同じ表記でよい(鍵に character_id が入っているのはそのため)。
func Test_Update_DifferentCharacterSameTextIsAllowed(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeNumeric, "別キャラ検証用")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	moveChar1 := moveIDByCode(t, db, 1, "standing_light_punch")
	var char2 int64
	if err := db.QueryRow(`SELECT DISTINCT character_id FROM preset_aliases WHERE preset_id = ? AND character_id <> 1 LIMIT 1`,
		created.ID).Scan(&char2); err != nil {
		t.Fatalf("lookup another character: %v", err)
	}
	var moveChar2 int64
	if err := db.QueryRow(`SELECT move_id FROM preset_aliases WHERE preset_id = ? AND character_id = ? LIMIT 1`,
		created.ID, char2).Scan(&moveChar2); err != nil {
		t.Fatalf("lookup move of another character: %v", err)
	}

	const shared = "共通表記テスト"
	if _, err := svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: moveChar1, AliasText: shared},
		{MoveID: moveChar2, AliasText: shared},
	}); err != nil {
		t.Fatalf("別キャラで同表記が拒否された: %v", err)
	}
}

// ---------------------------------------------------------------------------
// 更新の基本形と VAL 群
// ---------------------------------------------------------------------------

func Test_Update_NameAndAliases(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "元の名前")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")

	newName := "新しい名前"
	updated, err := svc.Update(ctx, testUserID, created.ID, &newName, []presetsvc.AliasUpdate{
		{MoveID: moveID, AliasText: "  好きな表記  "},
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Name != newName {
		t.Errorf("name = %q, want %q", updated.Name, newName)
	}

	var text string
	var charID sql.NullInt64
	if err := db.QueryRow(`SELECT alias_text, character_id FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveID).Scan(&text, &charID); err != nil {
		t.Fatalf("read alias: %v", err)
	}
	if text != "好きな表記" {
		t.Errorf("alias_text = %q, want %q(前後の空白は落とす)", text, "好きな表記")
	}
	// ★編集で character_id を巻き込んでいないこと
	if !charID.Valid {
		t.Error("編集後に character_id が NULL になった")
	}
}

func Test_Update_EmptyAliasTextIsRejected(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "VAL-P02 検証")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")
	var before string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveID).Scan(&before); err != nil {
		t.Fatalf("read before: %v", err)
	}

	for _, empty := range []string{"", "   ", "\t"} {
		_, err := svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
			{MoveID: moveID, AliasText: empty},
		})
		if !errors.Is(err, presetsvc.ErrAliasTextEmpty) {
			t.Errorf("AliasText=%q: err = %v, want ErrAliasTextEmpty", empty, err)
		}
	}

	var after string
	if err := db.QueryRow(`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		created.ID, moveID).Scan(&after); err != nil {
		t.Fatalf("read after: %v", err)
	}
	if after != before {
		t.Errorf("拒否したのに値が変わった: %q → %q", before, after)
	}
}

// Test_Update_UnknownMoveIsRejected は ★技の追加をさせないことを守る
// (DES-004 §6.2: 技の追加・削除はカスタムプリセット側では行わない)。
func Test_Update_UnknownMoveIsRejected(t *testing.T) {
	_, repo, svc := setup(t)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "未知 move 検証")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	before, err := repo.CountAliasesByPreset(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset: %v", err)
	}

	_, err = svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: 999999, AliasText: "存在しない技"},
	})
	if !errors.Is(err, presetsvc.ErrAliasMoveNotFound) {
		t.Fatalf("Update: err = %v, want ErrAliasMoveNotFound", err)
	}

	after, err := repo.CountAliasesByPreset(ctx, created.ID)
	if err != nil {
		t.Fatalf("CountAliasesByPreset(after): %v", err)
	}
	if after != before {
		t.Errorf("エイリアス行数が %d → %d に変化した。技を追加してはならない", before, after)
	}
}

func Test_Create_NameValidation(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	// ★users には id=1('default')しか居ない(000007)。presets.user_id は
	// users(id) への FK を持つため、別ユーザーの検証には行を作る必要がある。
	// (M20 当時は PRAGMA foreign_keys が接続単位でしか効かず=P-04、この FK は
	//  引く接続によって発火したりしなかったりした。★M23-10 で全接続が FK=ON に
	//  なったため、常に発火する。いずれにせよ行を作る必要がある点は変わらない。)
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, name) VALUES (2, 'other')`); err != nil {
		t.Fatalf("seed user 2: %v", err)
	}

	// VAL: 空名
	if _, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "   "); !errors.Is(err, presetsvc.ErrNameEmpty) {
		t.Errorf("空名: err = %v, want ErrNameEmpty", err)
	}

	// VAL-P03: 同一ユーザー内で重複
	if _, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "同じ名前"); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "同じ名前"); !errors.Is(err, presetsvc.ErrNameDuplicate) {
		t.Errorf("重複名: err = %v, want ErrNameDuplicate", err)
	}
	// 別ユーザーなら通る(VAL-P03 は同一ユーザー内の一意性)
	if _, err := svc.Create(ctx, 2, model.PresetCodeSRK, "同じ名前"); err != nil {
		t.Errorf("別ユーザーの同名が拒否された: %v", err)
	}
}

// Test_Create_BaseMustBeBuiltin は VAL-P04(DES-004 §6.1)。
func Test_Create_BaseMustBeBuiltin(t *testing.T) {
	_, _, svc := setup(t)
	ctx := context.Background()

	if _, err := svc.Create(ctx, testUserID, "no_such_preset", "x"); !errors.Is(err, presetsvc.ErrBaseNotFound) {
		t.Errorf("存在しないベース: err = %v, want ErrBaseNotFound", err)
	}

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "カスタム")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	// カスタムをベースにしたコピーは設計されていない(DES-004 §6.1)。
	if _, err := svc.Create(ctx, testUserID, created.Code, "カスタムのコピー"); !errors.Is(err, presetsvc.ErrBaseNotFound) {
		t.Errorf("カスタムをベースにしたコピー: err = %v, want ErrBaseNotFound", err)
	}
}

func Test_Create_AssignsUniqueCode(t *testing.T) {
	_, _, svc := setup(t)
	ctx := context.Background()

	seen := map[string]bool{}
	for i := 1; i <= 5; i++ {
		p, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, fmt.Sprintf("c%d", i))
		if err != nil {
			t.Fatalf("Create #%d: %v", i, err)
		}
		if p.Code == "" {
			t.Fatal("code が空")
		}
		if seen[p.Code] {
			t.Fatalf("code %q が重複した", p.Code)
		}
		seen[p.Code] = true
	}
}

// Test_Get_NotFound / Test_ListAliases は読み取り経路の基本形。
func Test_Get_NotFound(t *testing.T) {
	_, _, svc := setup(t)
	if _, err := svc.Get(context.Background(), 99999); !errors.Is(err, presetsvc.ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func Test_ListAliases(t *testing.T) {
	db, _, svc := setup(t)
	ctx := context.Background()

	presetID := presetIDByCode(t, db, model.PresetCodeNumeric)
	all, err := svc.ListAliases(ctx, presetID, 1, 0)
	if err != nil {
		t.Fatalf("ListAliases: %v", err)
	}
	if len(all) == 0 {
		t.Fatal("0 件")
	}

	limited, err := svc.ListAliases(ctx, presetID, 1, 3)
	if err != nil {
		t.Fatalf("ListAliases(limit=3): %v", err)
	}
	if len(limited) != 3 {
		t.Errorf("limit=3 で %d 件返った", len(limited))
	}

	if _, err := svc.ListAliases(ctx, 99999, 1, 0); !errors.Is(err, presetsvc.ErrNotFound) {
		t.Errorf("存在しないプリセット: err = %v, want ErrNotFound", err)
	}
}
