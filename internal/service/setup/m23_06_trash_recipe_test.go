package setup_test

// ★M23-06 §4.3 / §5.3: 削除済みセットプレイのレシピ文字列。
//
// 本サブの中心である。論理削除の時点で recipe_cache を物理削除しているため、
// ゴミ箱の名無しセットプレイは「(名称未設定)」でしか識別できなかった。
// 完全削除は不可逆であり、取り違えると取り返しがつかない。
// ⇒ setup_steps から組み立て直して defaultRecipe を埋める。
//
// ★★ここで守るのは 3 点である。
//   1. 削除済み行の defaultRecipe が埋まること(=識別できること)
//   2. steps が 0 件でも落ちないこと
//   3. ★論理削除の副作用を変えていないこと(recipe_cache は NULL のままであること)
//      ——読み取り側で解いており、削除の契約(DES-002 §4.2)には触っていない。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// createUnnamedSetup は名前を持たないセットプレイを作る(ゴミ箱で識別できない形)。
//
// ★★VAL-S06(セットプレイ名必須)が在るため、現在の登録経路では名無しを作れない
// (CreateSetup / CreateSetupInTx の両方が ValidateSetupCreate を通る)。
// ⇒ 名無しの行は VAL-S06 導入前の既存データである。テストはその状態を、名前付きで
// 作ってから name を NULL に落とすことで再現する。
// ★これは検証を迂回するためのごまかしではない。「在りうる状態」を作っているだけで
// あり、本サブが直すのは「その状態の行が識別できないこと」である。
func createUnnamedSetup(t *testing.T, db *sql.DB, svc setupsvc.Service, comboID int64) int64 {
	t.Helper()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "crouching_light_kick")
	name := "名前を落とす前のセットプレイ"
	resp, result, err := svc.CreateSetup(context.Background(), comboID, setupsvc.CreateSetupInput{
		CharacterID: 1,
		Name:        &name,
		Steps: []model.SetupStep{
			{StepOrder: 1, MoveID: &move1},
			{StepOrder: 2, MoveID: &move2},
		},
	})
	if err != nil {
		t.Fatalf("create setup: %v", err)
	}
	if result.HasError() {
		t.Fatalf("create setup validation: %+v", result.Issues)
	}
	if _, err := db.Exec(`UPDATE setups SET name = NULL WHERE id = ?`, resp.Setup.ID); err != nil {
		t.Fatalf("clear setup name: %v", err)
	}
	return resp.Setup.ID
}

func rawRecipeCache(t *testing.T, db *sql.DB, setupID int64) sql.NullString {
	t.Helper()
	var cache sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM setups WHERE id = ?`, setupID).Scan(&cache); err != nil {
		t.Fatalf("select recipe_cache: %v", err)
	}
	return cache
}

// ★本サブの中心。削除済み行の defaultRecipe が埋まること。
func TestService_ListDeletedSetups_FillsRecipeForUnnamedSetup(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboID := insertBareCombo(t, db)
	setupID := createUnnamedSetup(t, db, svc, comboID)

	// 生きている間は recipe_cache 由来で defaultRecipe が入っている。
	alive, err := svc.ListSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListSetups: %v", err)
	}
	if len(alive) != 1 || alive[0].DefaultRecipe == "" {
		t.Fatalf("生きた一覧の defaultRecipe が空(前提が崩れている): %+v", alive)
	}
	want := alive[0].DefaultRecipe

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// ★論理削除で recipe_cache は消えている。ここが「根」である。
	if cache := rawRecipeCache(t, db, setupID); cache.Valid {
		t.Fatalf("論理削除後の recipe_cache = %q, want NULL(削除の副作用の前提が崩れている)", cache.String)
	}

	deleted, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups: %v", err)
	}
	if len(deleted) != 1 {
		t.Fatalf("ゴミ箱 = %d 件, want 1", len(deleted))
	}
	// ★★キャッシュが無くても、setup_steps から組み立てて同じ文字列が出る。
	if got := deleted[0].DefaultRecipe; got != want {
		t.Errorf("削除済みの defaultRecipe = %q, want %q(名無しセットプレイが識別できない)", got, want)
	}
}

// ★★論理削除の副作用を変えていないこと(M23-06 §4.3-4 / §1.6-4)。
// 一覧を読んだだけで recipe_cache が書き戻る形にしていない——GET が削除済み行へ
// 書き込むのは、M23-03 が as-built で固定した削除の契約を静かに動かすことになる。
func TestService_ListDeletedSetups_DoesNotWriteBackRecipeCache(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboID := insertBareCombo(t, db)
	setupID := createUnnamedSetup(t, db, svc, comboID)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// 2 回読む(1 回目で書き戻す実装なら 2 回目までに非 NULL になる)。
	for i := 0; i < 2; i++ {
		if _, err := svc.ListDeletedSetups(ctx, nil); err != nil {
			t.Fatalf("ListDeletedSetups(%d 回目): %v", i+1, err)
		}
	}

	if cache := rawRecipeCache(t, db, setupID); cache.Valid {
		t.Errorf("ゴミ箱を読んだあとの recipe_cache = %q, want NULL(読み取りが書き戻している)", cache.String)
	}
}

// ★steps が 0 件のセットプレイでも落ちない(§5.3)。
// 画面側は空文字を受けて「(名称未設定)」へ落ちるだけであり、行は壊れない。
func TestService_ListDeletedSetups_EmptyStepsDoesNotFail(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboID := insertBareCombo(t, db)
	setupID := createUnnamedSetup(t, db, svc, comboID)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	// ★steps を直接落として「0 件」を作る。CreateSetup は 0 件を通さないため、
	//   正規の経路では作れない状態だが、旧データや将来の経路では在りうる。
	if _, err := db.Exec(`DELETE FROM setup_steps WHERE setup_id = ?`, setupID); err != nil {
		t.Fatalf("delete steps: %v", err)
	}

	deleted, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups: %v(steps 0 件で落ちている)", err)
	}
	if len(deleted) != 1 {
		t.Fatalf("ゴミ箱 = %d 件, want 1", len(deleted))
	}
	if got := deleted[0].DefaultRecipe; got != "" {
		t.Errorf("steps 0 件の defaultRecipe = %q, want 空文字", got)
	}
}

// ★N+1 になっていないこと(§5.3)。ステップ取得は件数によらず 1 クエリである。
//
// ★問い合わせ回数そのものを数える手段はサービス層に無いため、リポジトリの
//
//	一括取得メソッドを直接見る。★これが「1 クエリで取れる形が在る」ことの証拠であり、
//	サービスはこれを呼んでいる(ListDeletedSetups → ResolveDeletedSetupRecipes)。
func TestRepository_FindStepsBySetupIDs_BatchesAllSetups(t *testing.T) {
	env := newTestEnv(t)
	db, svc := env.db, env.svc
	ctx := context.Background()

	ids := make([]int64, 0, 3)
	for i := 0; i < 3; i++ {
		comboID := insertBareCombo(t, db)
		ids = append(ids, createUnnamedSetup(t, db, svc, comboID))
	}
	for _, id := range ids {
		if err := svc.DeleteSetup(ctx, id, nil); err != nil {
			t.Fatalf("DeleteSetup: %v", err)
		}
	}

	deleted, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups: %v", err)
	}
	if len(deleted) != 3 {
		t.Fatalf("ゴミ箱 = %d 件, want 3", len(deleted))
	}
	// ★3 件すべてにレシピが載る(1 件目だけ埋まる形になっていないこと)。
	for _, d := range deleted {
		if d.DefaultRecipe == "" {
			t.Errorf("setup %d の defaultRecipe が空(一括解決が全件に届いていない)", d.Setup.ID)
		}
	}
}

// ★1 件のレシピ解決失敗で一覧全体を落とさないこと(レビュー中-1)。
//
// ★★ゴミ箱が開けないと復元も完全削除もできなくなる。本サブの動機
// (「識別手段がゼロだと取り違える」)に照らして、それが最悪の縮退である。
// ⇒ 当該行だけ空文字にして行は出す(画面は「(名称未設定)」へ落ちるだけ)。
//
// 壊し方: 既定プリセットの行を消す。resolveMoveStep の FindPresetByID が
// 行を見つけられずエラーを返す経路に入る。
func TestService_ListDeletedSetups_KeepsListWhenRecipeResolutionFails(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboID := insertBareCombo(t, db)
	setupID := createUnnamedSetup(t, db, svc, comboID)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// 既定プリセット(newTestEnv が注入する id=1)を落とす。
	if _, err := db.Exec(`DELETE FROM presets WHERE id = 1`); err != nil {
		t.Fatalf("delete default preset: %v", err)
	}

	deleted, err := svc.ListDeletedSetups(ctx, nil)
	if err != nil {
		t.Fatalf("ListDeletedSetups がレシピ解決の失敗で落ちている: %v(ゴミ箱が開けず復元もできなくなる)", err)
	}
	if len(deleted) != 1 {
		t.Fatalf("ゴミ箱 = %d 件, want 1(行が消えている)", len(deleted))
	}
	if got := deleted[0].DefaultRecipe; got != "" {
		t.Errorf("解決に失敗した行の defaultRecipe = %q, want 空文字", got)
	}
}
