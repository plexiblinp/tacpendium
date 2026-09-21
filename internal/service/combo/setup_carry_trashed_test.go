package combo_test

// ★M23-02 §4.1-6 (a)・D-491: 案 P1 の撤回で壊れる不変条件の後始末を守る回帰テスト。
//
// 案 P1(M4-01・フェーズ1)の撤回により、セットプレイを論理削除しても combo_setups の
// 行が残るようになった。⇒「combo_setups に行が在れば必ず生きたセットプレイを指す」
// という不変条件が失われる。
//
// CountComboSetupsByComboID はその不変条件に寄りかかって setups へ結合していなかった。
// 結合しないままだと、次の連鎖で利用者に見える劣化が出る:
//
//	1. 画面の引き継ぎモーダルはコンボ詳細の setups[] の長さで発火する。
//	   setups[] は ListSetupsByComboID(s.deleted_at IS NULL を持つ)由来のため、
//	   紐付いたセットプレイが全部ゴミ箱に居ると 0 件になる ⇒ モーダルが出ない。
//	2. ⇒ setupCarryOptions が未指定のままサーバへ届く。
//	3. ⇒ 結合していない COUNT が残存行を数えて count > 0 となり
//	      ErrMissingSetupCarryOptions(400 missing_setup_carry_options)で拒まれる。
//	4. ⇒ 利用者は knockdown_advantage を変更できず、しかも選択肢が出ないので
//	      解消もできない。★撤回前は通っていた操作である。
//
// ★既存テストはこの組み合わせを持たないため、本テストが唯一の歯止めである。
// 落とすと、動作テストが緑のまま劣化が出荷される。

import (
	"context"
	"database/sql"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// softDeleteSetup はセットプレイをゴミ箱へ入れる(紐付けは残る＝案 P1 撤回後の挙動)。
func softDeleteSetup(t *testing.T, db *sql.DB, setupID int64) {
	t.Helper()
	if _, err := db.Exec(
		`UPDATE setups SET deleted_at = datetime('now') WHERE id = ?`, setupID); err != nil {
		t.Fatalf("soft delete setup: %v", err)
	}
}

func countLinks(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setups WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count links: %v", err)
	}
	return n
}

// ★PATCH 経路: 紐付いたセットプレイが全部ゴミ箱に居るコンボの
// knockdown_advantage を、引き継ぎオプション未指定で変更できること。
func TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	base := createBase(t, db, svc, baseComboInput(t, db))
	setupID := linkSetupWithResults(t, db, base.ID)

	softDeleteSetup(t, db, setupID)

	// ★前提の確認: 撤回により紐付けの行は残っている。
	// 残っていないなら本テストは何も検査できていない(案 P1 が復活した可能性)。
	if got := countLinks(t, db, base.ID); got != 1 {
		t.Fatalf("論理削除後の combo_setups 行数 = %d, want 1(案 P1 撤回により残ること)", got)
	}

	got, result, err := svc.UpdateMetadata(ctx, base.ID, base.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Optional[int]{Present: true, Value: ptr(45)},
		UserID:             1,
	})
	if err != nil {
		t.Fatalf("ゴミ箱のセットプレイしか紐付いていないコンボの KA 変更が拒まれた: %v"+
			"\n★引き継ぎモーダルは生きたセットプレイ 0 件では出ないため、"+
			"利用者はこの拒否を解消できない(M23-02 §4.1-6 (a))", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}
	if got.KnockdownAdvantage == nil || *got.KnockdownAdvantage != 45 {
		t.Errorf("knockdownAdvantage = %v, want 45", got.KnockdownAdvantage)
	}
}

// ★対照: 生きたセットプレイが紐付いている場合は、これまでどおり
// 引き継ぎオプションの指定を要求する(是正が拒否を丸ごと無効化していないこと)。
func TestUpdateMetadata_StillRequiresCarryOptionsWhenSetupIsAlive(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	base := createBase(t, db, svc, baseComboInput(t, db))
	linkSetupWithResults(t, db, base.ID)

	_, _, err := svc.UpdateMetadata(ctx, base.ID, base.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Optional[int]{Present: true, Value: ptr(45)},
		UserID:             1,
	})
	if err == nil {
		t.Fatal("生きたセットプレイが紐付いているのに KA 変更が通った" +
			"(ErrMissingSetupCarryOptions を期待)")
	}
}

// ★PUT 経路(UpdateWithKeyChange)も同じ不変条件に依存している。
func TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	base := createBase(t, db, svc, baseComboInput(t, db))
	setupID := linkSetupWithResults(t, db, base.ID)

	softDeleteSetup(t, db, setupID)

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self") // 識別キーを変える
	newInput.KnockdownAdvantage = ptr(45)  // かつ KA も変える
	// SetupCarryOptions は未指定のまま(画面がモーダルを出せないため)。

	if _, result, err := svc.UpdateWithKeyChange(ctx, base.ID, base.Version, newInput); err != nil {
		t.Fatalf("ゴミ箱のセットプレイしか紐付いていないコンボの KA 変更(PUT)が拒まれた: %v", err)
	} else if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}
}
