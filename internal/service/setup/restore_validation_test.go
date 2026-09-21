package setup_test

// ★M23-04: セットプレイ復元時のバリデーション(VAL-R02 / VAL-S03)のサービス層テスト。
//
// ★本サブは「警告が出ること」と同じだけ「警告が出ないこと」を守る必要がある——
// 誤検知する警告は、無視される警告になる(指示書 §5 前文)。
// ⇒ 発火 1 本に対し、非発火の対照を必ず置いてある。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// hasCode は結果に指定コードの Issue が含まれるか返す。
func hasCode(issues []validation.ValidationIssue, code string) bool {
	for _, i := range issues {
		if i.Code == code {
			return true
		}
	}
	return false
}

// setupDeletedAt は setups.deleted_at を読む(復元が成立したかの実体確認用)。
func setupDeletedAt(t *testing.T, db *sql.DB, setupID int64) *string {
	t.Helper()
	var v sql.NullString
	if err := db.QueryRow(`SELECT deleted_at FROM setups WHERE id = ?`, setupID).Scan(&v); err != nil {
		t.Fatalf("select setups.deleted_at: %v", err)
	}
	if !v.Valid {
		return nil
	}
	return &v.String
}

// ===========================================================================
// §5.1-4: 親コンボがすべて削除済みのセットプレイを復元すると VAL-R02 が返る
// ===========================================================================

func TestRestoreSetup_VALR02_FiresWhenAllParentCombosDeleted(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	// 親を 2 本とも落としてから、セットプレイ自身を落とす。
	softDeleteCombo(t, db, comboA)
	softDeleteCombo(t, db, comboB)
	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if !hasCode(result.Issues, validation.CodeR02AllParentCombosDeleted) {
		t.Errorf("VAL-R02 が返らない: %+v", result.Issues)
	}
}

// ===========================================================================
// §5.1-5: 生きた親が 1 つでもあれば VAL-R02 は返らない(★§4.7 の非対称)
// ===========================================================================

func TestRestoreSetup_VALR02_SilentWhenOneParentAlive(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, _, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	// ★片方だけ落とす。VAL-R01 と揃えて「1 件でも削除済み」で発火させると、
	// ここが赤になる。非対称を守っていることの実体である。
	softDeleteCombo(t, db, comboA)
	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if hasCode(result.Issues, validation.CodeR02AllParentCombosDeleted) {
		t.Errorf("生きた親が 1 つあるのに VAL-R02 が返った(誤検知): %+v", result.Issues)
	}
}

// ===========================================================================
// §5.1-8: VAL-R02 が「削除済みを含む」側の関数を使っている
// ===========================================================================

// ★M23-03 で FindComboIDsBySetupID は 2 本に分かれた。表示用(削除済みを除外)を
// 使うと、親が全部削除済みのときに母集団まで 0 件になり、警告が永久に出なくなる。
// ★静かに壊れる形なので、両側のデータを 1 本のテストで突く。
//
//	側 A: 親が全部削除済み          → 発火すべき(Live 側を使うと母集団 0 で沈黙する)
//	側 B: 親が全部生存              → 沈黙すべき
//
// この 2 つを同じ表で回すことで、「常に発火」「常に沈黙」のどちらの壊れ方も落ちる。
func TestRestoreSetup_VALR02_UsesAllowDeletedPopulation(t *testing.T) {
	cases := []struct {
		name            string
		deleteAllParent bool
		wantFire        bool
	}{
		{"親が全部削除済み(AllowDeleted 側でないと母集団が 0 になる)", true, true},
		{"親が全部生存", false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, svc := newSetupService(t)
			ctx := context.Background()
			comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

			if tc.deleteAllParent {
				softDeleteCombo(t, db, comboA)
				softDeleteCombo(t, db, comboB)
			}
			if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
				t.Fatalf("DeleteSetup: %v", err)
			}

			result, err := svc.Restore(ctx, setupID)
			if err != nil {
				t.Fatalf("Restore: %v", err)
			}
			got := hasCode(result.Issues, validation.CodeR02AllParentCombosDeleted)
			if got != tc.wantFire {
				t.Errorf("VAL-R02 発火 = %v, want %v: %+v", got, tc.wantFire, result.Issues)
			}
		})
	}
}

// ===========================================================================
// §5.1-6: 警告が付いても復元は成功している(★§4.1 の原則の実体)
// ===========================================================================

func TestRestoreSetup_SucceedsEvenWithWarnings(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	softDeleteCombo(t, db, comboA)
	softDeleteCombo(t, db, comboB)
	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore は警告があっても成功すべき: %v", err)
	}
	if len(result.Issues) == 0 {
		t.Fatal("前提が崩れている: 警告が 1 件も出ていない(陽性対照)")
	}
	// ★警告が付いた状態で deleted_at が NULL に戻っていること。
	if got := setupDeletedAt(t, db, setupID); got != nil {
		t.Errorf("警告付きで復元したのに deleted_at = %q(復元が中止されている)", *got)
	}
	// ★取得経路からも生きて見えること。
	if _, err := svc.GetSetup(ctx, setupID); err != nil {
		t.Errorf("復元後の GetSetup が失敗した: %v", err)
	}
}

// ===========================================================================
// §5.1-7: 警告 0 件のとき Issues が空である(応答へ warnings を出さない条件)
// ===========================================================================

func TestRestoreSetup_NoWarningsWhenHealthy(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, setupID := seedLinkedSetup(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if len(result.Issues) != 0 {
		t.Errorf("健全なセットプレイの復元で警告が出た(誤検知): %+v", result.Issues)
	}
}

// ===========================================================================
// VAL-S03 が復元経路でも走る(指示書 §1.5-2)
// ===========================================================================

// ★「削除中に技が消えた」を見るためではない(moves に削除経路は無い＝§3.3-4)。
// 検証の緩かった経路で登録時から不整合だった行に気づくためである(§4.5-2)。
// ⇒ 直 UPDATE で「他キャラの技を指したステップ」を作り、その状態を再現する。
func TestRestoreSetup_RunsVALS03(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, setupID := seedLinkedSetup(t, db, svc)

	var otherMove int64
	if err := db.QueryRow(
		`SELECT id FROM moves WHERE character_id <> 1 ORDER BY id LIMIT 1`).Scan(&otherMove); err != nil {
		t.Fatalf("他キャラの技が引けない(seed の前提崩れ): %v", err)
	}
	if _, err := db.Exec(
		`UPDATE setup_steps SET move_id = ? WHERE setup_id = ?`, otherMove, setupID); err != nil {
		t.Fatalf("inject foreign move: %v", err)
	}

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if !hasCode(result.Issues, setupsvc.CodeS03MoveExists) {
		t.Errorf("VAL-S03 が復元経路で走っていない: %+v", result.Issues)
	}
	// ★それでも復元は成功している。
	if got := setupDeletedAt(t, db, setupID); got != nil {
		t.Errorf("VAL-S03 警告で復元が中止された(deleted_at = %q)", *got)
	}
}

// ===========================================================================
// §4.2 末尾: 検証処理自体が失敗しても復元は巻き添えにならない
// ===========================================================================

// ★指示書 §5.1 は要求していないが、チェックリスト §1 が観点として挙げている
// (「検証処理自体がエラーになったとき、復元が巻き添えになっていないこと」)。
// コード読解でしか担保されていなかったため、実際に壊して確かめる。
//
// 壊し方＝検証が読む setup_steps を DROP する。復元本体(setups の UPDATE)と
// recipe_cache の再計算は steps を読み終えた後には要らないため、検証だけが失敗する。
func TestRestoreSetup_ValidationFailureDoesNotBreakRestore(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, setupID := seedLinkedSetup(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	// ★検証が引く表を消す。復元そのものは setups の UPDATE だけで成立する。
	if _, err := db.Exec(`DROP TABLE combo_setups`); err != nil {
		t.Fatalf("drop combo_setups: %v", err)
	}

	result, err := svc.Restore(ctx, setupID)
	// ★500 相当のエラーを返さない(§4.2 末尾)。検証は付加価値であり、それが
	//   壊れたことで復元という利用者の主目的を巻き添えにしない。
	if err != nil {
		t.Fatalf("検証が失敗したせいで復元がエラーになった: %v", err)
	}
	// ★VAL-R02 は出せないが、復元は成立している。
	if hasCode(result.Issues, validation.CodeR02AllParentCombosDeleted) {
		t.Errorf("読めなかったはずの母集団から VAL-R02 が出ている: %+v", result.Issues)
	}
	if got := setupDeletedAt(t, db, setupID); got != nil {
		t.Errorf("検証の失敗で復元がロールバックされた(deleted_at = %q)", *got)
	}
}

// ===========================================================================
// §4.3-3: VAL-R02 の details.combos が id だけでなく memo を持つ
// ===========================================================================

// ★VAL-R01 が SetupRef{id, name} を返すのと対称にしてある。details は
// 「どれが問題か」を伝えるためのものであり、id だけでは画面に何も書けない。
// ★実際に M23-06(一括復元の内訳)と M23-07(完全削除の拒否からの紐付け解除)が
// この memo を画面へ出している。落とすと、どちらも「コンボ 12」としか書けなくなる。
func TestRestoreSetup_VALR02_DetailsCarryComboMemo(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	const memo = "M23-04 詳細確認用のメモ"
	if _, err := db.Exec(`UPDATE combos SET memo = ? WHERE id = ?`, memo, comboA); err != nil {
		t.Fatalf("set memo: %v", err)
	}
	softDeleteCombo(t, db, comboA)
	softDeleteCombo(t, db, comboB)
	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}

	result, err := svc.Restore(ctx, setupID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}

	var found bool
	for _, issue := range result.Issues {
		if issue.Code != validation.CodeR02AllParentCombosDeleted {
			continue
		}
		refs, ok := issue.Details["combos"].([]any)
		if !ok {
			t.Fatalf("details.combos が配列でない: %+v", issue.Details)
		}
		for _, raw := range refs {
			ref, ok := raw.(model.ComboRef)
			if !ok {
				t.Fatalf("details.combos の要素が ComboRef でない: %T", raw)
			}
			if ref.ID == comboA {
				if ref.Memo == nil || *ref.Memo != memo {
					t.Errorf("details.combos の memo = %v, want %q", ref.Memo, memo)
				}
				found = true
			}
		}
	}
	if !found {
		t.Fatalf("VAL-R02 の details に comboA(id=%d)が入っていない: %+v", comboA, result.Issues)
	}
}
