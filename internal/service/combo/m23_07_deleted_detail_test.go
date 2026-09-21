package combo_test

// ★M23-07 §4.2 / §5.1: ゴミ箱の行から開く読み取り専用のコンボ詳細。
//
// ゴミ箱の行をクリックすると /combos/:id へ遷移し、GET /api/combos/:id が
// deleted_at IS NULL で締め出して 404 を返していた(DES-005 §5.15 の未達)。
// ⇒ 既存経路にフラグを足さず、別の入口(GetDeleted)を新設した。
//
// ★★ここで守るのは 4 点である。
//  1. 削除済み行が返ること(=完全削除の前に中身を確認できること)
//  2. ★GET /api/combos/{id} が削除済みを返さないままであること(退行の防止)
//  3. レシピが combo_steps から組み立てられ、recipe_cache へ書き戻されないこと
//  4. 解決に失敗しても詳細そのものが落ちないこと(縮退の規則)

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// rawComboRecipeCache は combos.recipe_cache を素で読む(書き戻しの検出用)。
func rawComboRecipeCache(t *testing.T, db *sql.DB, comboID int64) sql.NullString {
	t.Helper()
	var cache sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, comboID).Scan(&cache); err != nil {
		t.Fatalf("read recipe_cache: %v", err)
	}
	return cache
}

// createAndTrashRyu は本登録のコンボを作ってゴミ箱へ入れ、id を返す。
func createAndTrashRyu(t *testing.T, db *sql.DB, svc combosvc.Service) int64 {
	t.Helper()
	id := createPublished(t, svc, validRyuInput(t, db))
	if err := svc.Delete(context.Background(), id); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	return id
}

// ---------------------------------------------------------------------------
// §5.1-1 削除済みコンボの読み取り専用取得が、削除済み行を返す
// ---------------------------------------------------------------------------

func TestService_GetDeleted_ReturnsSoftDeletedCombo(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createAndTrashRyu(t, db, svc)

	combo, err := svc.GetDeleted(ctx, id, 1)
	if err != nil {
		t.Fatalf("GetDeleted が削除済み行を返していない: %v(ゴミ箱の行クリックが 404 のままになる)", err)
	}
	if combo.ID != id {
		t.Errorf("id = %d, want %d", combo.ID, id)
	}
	if combo.DeletedAt == nil {
		t.Error("deletedAt = nil, want 非 nil(ゴミ箱の行である)")
	}
	// 詳細として揃うべき子がロードされていること(FindByID と同じ attachComboChildren)。
	if len(combo.Steps) == 0 {
		t.Error("steps が 0 件。読み取り専用詳細でレシピ・手順が出せない")
	}
	if combo.Tags == nil {
		t.Error("tags = nil, want 非 nil(0 件でも空配列)")
	}
	if combo.StarterMoveCode == nil || *combo.StarterMoveCode == "" {
		t.Error("starterMoveCode が空。始動状況が生 ID 表示になる")
	}
}

// ---------------------------------------------------------------------------
// §5.1-2 ★GET /api/combos/{id} は削除済みを返さないまま(退行の防止)
// ---------------------------------------------------------------------------
//
// ★これが本サブでいちばん壊しやすい退行である。「読み取り専用詳細を出す」を
// 既存経路にフラグを足して満たすと、通常の詳細表示で削除済みが返る事故の余地が
// 残る(M23-07 §4.2-2 / チェックリスト §9)。
func TestService_Get_StillExcludesSoftDeletedCombo(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createAndTrashRyu(t, db, svc)

	_, err := svc.Get(ctx, id, 1)
	if !errors.Is(err, combosvc.ErrNotFound) {
		t.Fatalf("Get(削除済み) = %v, want ErrNotFound(通常の詳細表示に削除済みが漏れている)", err)
	}
}

// ---------------------------------------------------------------------------
// §5.1-3 読み取り専用取得の応答にレシピ文字列が載る
// ---------------------------------------------------------------------------
//
// ★M23-06 はゴミ箱「一覧」のルート列を消したが、本サブは「詳細」でレシピを出す。
// 矛盾ではない——一覧は識別、詳細は確認であり、目的が違う(指示書 §1.3)。
// 完全削除は不可逆であるため、詳細では中身を見せる。
func TestService_GetDeleted_FillsRecipeFromComboSteps(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	id := createPublished(t, svc, validRyuInput(t, db))
	live, err := svc.Get(ctx, id, 1)
	if err != nil {
		t.Fatalf("Get(生存): %v", err)
	}
	want := live.DefaultRecipe
	if want == "" {
		t.Fatalf("前提が崩れている: 生存行の defaultRecipe が空")
	}

	if err := svc.Delete(ctx, id); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	// ★「根」の確認: 論理削除で recipe_cache は NULL になっている。
	if cache := rawComboRecipeCache(t, db, id); cache.Valid {
		t.Fatalf("前提が崩れている: 論理削除後の recipe_cache = %q, want NULL", cache.String)
	}

	deleted, err := svc.GetDeleted(ctx, id, 1)
	if err != nil {
		t.Fatalf("GetDeleted: %v", err)
	}
	if deleted.DefaultRecipe != want {
		t.Errorf("削除済み行の defaultRecipe = %q, want %q(combo_steps から組み立て直せていない)",
			deleted.DefaultRecipe, want)
	}
}

// ---------------------------------------------------------------------------
// §5.1-4 ★combo_steps が 0 件でも詳細が返る(レシピ欄が空になるだけ)
// ---------------------------------------------------------------------------

func TestService_GetDeleted_EmptyStepsStillReturnsDetail(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createAndTrashRyu(t, db, svc)

	if _, err := db.Exec(`DELETE FROM combo_steps WHERE combo_id = ?`, id); err != nil {
		t.Fatalf("delete combo_steps: %v", err)
	}

	combo, err := svc.GetDeleted(ctx, id, 1)
	if err != nil {
		t.Fatalf("GetDeleted が steps 0 件で落ちている: %v", err)
	}
	if combo.ID != id {
		t.Errorf("id = %d, want %d", combo.ID, id)
	}
	if combo.DefaultRecipe != "" {
		t.Errorf("defaultRecipe = %q, want 空文字", combo.DefaultRecipe)
	}
}

// ---------------------------------------------------------------------------
// §5.1-5 ★レシピ解決に失敗しても詳細そのものが落ちない
// ---------------------------------------------------------------------------
//
// DES-002 §4.2 の縮退の規則(M23-06 が新設)。1 件の解決失敗で画面を落とすと、
// 完全削除の前に中身を確認する手段そのものが消える。
//
// 壊し方は M23-06 と同型: 既定プリセットの行を消し、resolveMoveStep の
// FindPresetByID がエラーを返す経路へ入れる。
func TestService_GetDeleted_KeepsDetailWhenRecipeResolutionFails(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createAndTrashRyu(t, db, svc)

	if _, err := db.Exec(`DELETE FROM presets WHERE id = 1`); err != nil {
		t.Fatalf("delete default preset: %v", err)
	}

	combo, err := svc.GetDeleted(ctx, id, 1)
	if err != nil {
		t.Fatalf("GetDeleted がレシピ解決の失敗で落ちている: %v(読み取り専用詳細が開けなくなる)", err)
	}
	if combo.ID != id {
		t.Errorf("id = %d, want %d", combo.ID, id)
	}
	if combo.DefaultRecipe != "" {
		t.Errorf("解決に失敗した行の defaultRecipe = %q, want 空文字", combo.DefaultRecipe)
	}
}

// ---------------------------------------------------------------------------
// §5.1-6 ★読み取り専用取得が recipe_cache へ書き戻さない
// ---------------------------------------------------------------------------
//
// M23-06 と同型のテスト。論理削除の副作用(recipe_cache を NULL にする)は
// DES-002 §4.2 の契約であり、読み取りが書き戻すとその契約が崩れる。
// ★2 回呼ぶ——1 回目で書き戻す実装なら 2 回目までに非 NULL になる。
func TestService_GetDeleted_DoesNotWriteBackRecipeCache(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createAndTrashRyu(t, db, svc)

	for i := 0; i < 2; i++ {
		if _, err := svc.GetDeleted(ctx, id, 1); err != nil {
			t.Fatalf("GetDeleted(%d 回目): %v", i+1, err)
		}
	}

	if cache := rawComboRecipeCache(t, db, id); cache.Valid {
		t.Errorf("ゴミ箱の詳細を読んだあとの recipe_cache = %q, want NULL(読み取りが書き戻している)", cache.String)
	}
}

// ---------------------------------------------------------------------------
// §5.1-7 削除済みでないコンボを読み取り専用取得で引いたときの挙動
// ---------------------------------------------------------------------------
//
// ★指示書 §11-2 の暫定案どおり「返す」で決めた。読み取り専用の詳細は生存行にも
// 意味があり、ゴミ箱と通常詳細を跨いだ遷移(復元直後にリロードする等)で 404 を
// 作らないためである。★どちらでもよいが決めてテストで固定する、が要件である。
func TestService_GetDeleted_AlsoReturnsLiveCombo(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	id := createPublished(t, svc, validRyuInput(t, db))

	combo, err := svc.GetDeleted(ctx, id, 1)
	if err != nil {
		t.Fatalf("GetDeleted(生存行) = %v, want 成功(§5.1-7 で「返す」と決めた)", err)
	}
	if combo.ID != id {
		t.Errorf("id = %d, want %d", combo.ID, id)
	}
	if combo.DeletedAt != nil {
		t.Errorf("deletedAt = %v, want nil(生存行である)", combo.DeletedAt)
	}
}
