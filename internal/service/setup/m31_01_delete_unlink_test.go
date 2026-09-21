package setup_test

import (
	"context"
	"testing"
)

// ===========================================================================
// M31-01(P4M-019): セットプレイ削除時に「このコンボとの紐付け」も外す
//
// 逐語＝「セットプレイ削除時にコンボとの紐づきを一緒に外す方法をつけたい
// (詳細画面、ゴミ箱どっちが最適かは決めていない)」(phase4-memo.txt:63)。
// ⇒ 置き場は **削除ダイアログの任意チェック**(開発者裁定 2026-09-08)。
//
// ★★危険は指示書 §4.4 が名指ししている——**削除は論理削除である**。
//   M23-02(D-483/D-484)は「復元で紐付けが戻る」ようにするため、論理削除時に
//   combo_setups を残す形へ変えた。⇒ ここで紐付けを外すと、**復元しても戻らない**。
//   したがって既定は OFF であり、画面は文面でそれを言う。
// ===========================================================================

// (a) 既定(nil)＝着手前と同じ。復元で紐付けが戻る。
func TestM3101_DeleteSetup_WithoutUnlink_RestoreRevivesLink(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, nil); err != nil {
		t.Fatalf("DeleteSetup: %v", err)
	}
	if got := countLinksBySetup(t, db, setupID); got != 2 {
		t.Fatalf("紐付け数 = %d, want 2(既定では外さない)", got)
	}
	if _, err := svc.Restore(ctx, setupID); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	for _, id := range []int64{comboA, comboB} {
		list, err := svc.ListSetupsByComboID(ctx, id)
		if err != nil {
			t.Fatalf("ListSetupsByComboID(%d): %v", id, err)
		}
		if len(list) != 1 {
			t.Errorf("combo %d: 復元後に %d 件, want 1", id, len(list))
		}
	}
}

// (b) 指定あり＝そのコンボとの紐付けだけが外れ、復元しても戻らない。
//
// ★★「戻らない」ことを主張するのが本テストの主題である。
//
//	戻ってしまうと、画面の文面(「復元しても紐付けは戻りません」)が嘘になる。
func TestM3101_DeleteSetup_WithUnlink_RestoreDoesNotRevive(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	comboA, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	if err := svc.DeleteSetup(ctx, setupID, &comboA); err != nil {
		t.Fatalf("DeleteSetup(unlink from A): %v", err)
	}
	if got := countLinksBySetup(t, db, setupID); got != 1 {
		t.Fatalf("紐付け数 = %d, want 1(A のぶんだけ外れる)", got)
	}

	if _, err := svc.Restore(ctx, setupID); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	listA, err := svc.ListSetupsByComboID(ctx, comboA)
	if err != nil {
		t.Fatalf("ListSetupsByComboID(A): %v", err)
	}
	if len(listA) != 0 {
		t.Errorf("復元後もコンボ A に %d 件見えている, want 0(外した紐付けは戻らない)", len(listA))
	}

	// ★★共有していた別コンボ B の紐付けは無傷である。
	//   ここを壊すと D-484 が撤回した案 P1(全消し)に戻ることになる。
	listB, err := svc.ListSetupsByComboID(ctx, comboB)
	if err != nil {
		t.Fatalf("ListSetupsByComboID(B): %v", err)
	}
	if len(listB) != 1 {
		t.Errorf("共有していたコンボ B が %d 件, want 1(他コンボの紐付けを壊してはならない)", len(listB))
	}
}

// (c) 紐付いていないコンボを指定しても失敗しない(冪等)。
//
// ★利用者の意図は「外れている状態にする」である。⇒ 既に外れていることは誤りではない。
func TestM3101_DeleteSetup_UnlinkUnrelatedCombo_IsIdempotent(t *testing.T) {
	db, svc := newSetupService(t)
	ctx := context.Background()
	_, comboB, setupID := shareSetupAcrossTwoCombos(t, db, svc)

	// 先に B を外してから、もう一度 B を指定して削除しても落ちないこと。
	if err := svc.DeleteSetup(ctx, setupID, &comboB); err != nil {
		t.Fatalf("1 回目: %v", err)
	}
	if _, err := svc.Restore(ctx, setupID); err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if err := svc.DeleteSetup(ctx, setupID, &comboB); err != nil {
		t.Fatalf("2 回目(既に外れている)で失敗した: %v", err)
	}
}
