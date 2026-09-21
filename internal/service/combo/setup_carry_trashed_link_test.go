package combo_test

// ★M23-08 §4.5 / §5.1-7〜9: 引き継ぎオプションが削除済みセットプレイの紐付けを落とさない。
//
// 引き継ぎの選択肢を作る読み取り(CountComboSetupsByComboID ／ setup リポジトリの
// ListSetupsByComboID(s))はいずれも s.deleted_at IS NULL を持ち、ゴミ箱に居る
// セットプレイを利用者に見せない。ところが解除する側の DELETE には述語が無く、
// combo_setups の全行を対象にしていたため、利用者が選びようのなかった紐付けが
// unlink_all でも individual でも黙って落ちていた。
//
// ⇒ M23-02 の看板「セットプレイを復元すると、紐付いていた全コンボへ一斉に戻る」が、
//    利用者に見えない条件で成立しなくなる。見えない条件で成立しない約束は、
//    成立しない約束より悪い。
//
// ★§5.1-9(生きたセットプレイの挙動が変わっていないこと)を同じテスト内で必ず見る。
//   削除済みを残すだけの実装にして生きた方まで残してしまうと、引き継ぎ機能そのものが
//   壊れるが、削除済み側の主張だけでは検出できない。

import (
	"context"
	"database/sql"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// linkSetup はコンボへセットプレイを 1 件作って紐付け、成立条件の検証結果も 1 行置く。
// trashed=true なら、そのセットプレイを論理削除した状態にする。
//
// ★既存の linkSetupWithResults(setup_results_carry_test.go)と違い、名前を付けて
// 複数件を作り分けられるようにしてある。ゴミ箱へ入れる操作は既存の softDeleteSetup
// (setup_carry_trashed_test.go)を使う。
func linkSetup(t *testing.T, db *sql.DB, comboID int64, name string, trashed bool) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (1, ?, 1)`, name)
	if err != nil {
		t.Fatalf("insert setup %q: %v", name, err)
	}
	setupID, _ := res.LastInsertId()
	if _, err := db.Exec(
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID); err != nil {
		t.Fatalf("insert combo_setups: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO combo_setup_results (combo_id, setup_id, tech_type, in_corner, result)
		 VALUES (?, ?, 'neutral_tech', 0, 'ok')`, comboID, setupID); err != nil {
		t.Fatalf("insert combo_setup_results: %v", err)
	}
	if trashed {
		softDeleteSetup(t, db, setupID)
	}
	return setupID
}

// linkExists は (combo_id, setup_id) の紐付けが在るかを返す。
// ★combo_id を問わず setup_id で引く版も要る —— キー変更編集では紐付けが新しい
// combo_id へ移るためである(linkComboIDOf)。
func linkExists(t *testing.T, db *sql.DB, comboID, setupID int64) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM combo_setups WHERE combo_id = ? AND setup_id = ?`,
		comboID, setupID).Scan(&n); err != nil {
		t.Fatalf("count combo_setups: %v", err)
	}
	return n > 0
}

func linkComboIDOf(t *testing.T, db *sql.DB, setupID int64) (int64, bool) {
	t.Helper()
	var comboID int64
	err := db.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&comboID)
	if err == sql.ErrNoRows {
		return 0, false
	}
	if err != nil {
		t.Fatalf("read combo_setups: %v", err)
	}
	return comboID, true
}

// newComboWithLiveAndTrashedSetups は「生きたセットプレイ 1 件 + 削除済み 1 件」を
// 紐付けたコンボを作る。
func newComboWithLiveAndTrashedSetups(t *testing.T, db *sql.DB, svc combosvc.Service,
	prefix string) (comboID, liveID, trashedID int64) {
	t.Helper()
	input := validRyuInput(t, db)
	input.KnockdownAdvantage = ptr(20)
	saved, _, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("create combo: %v", err)
	}
	comboID = saved.ID
	liveID = linkSetup(t, db, comboID, prefix+"-live", false)
	trashedID = linkSetup(t, db, comboID, prefix+"-trashed", true)
	return comboID, liveID, trashedID
}

// ---------------------------------------------------------------------------
// PATCH(UpdateMetadata)経路
// ---------------------------------------------------------------------------

// §5.1-7: individual で生きた方だけを carry しても、削除済みの紐付けは落ちない。
func TestUpdateMetadata_Individual_KeepsTrashedSetupLink(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "patch-ind")

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	// ★利用者の選択肢には生きたセットプレイしか出ない。削除済みは選びようがない。
	if _, _, err := svc.UpdateMetadata(ctx, comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions: &comborepo.SetupCarryOptionsInput{
			Mode: "individual", CarrySetupIDs: []int64{liveID},
		},
	}); err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}

	if !linkExists(t, db, comboID, liveID) {
		t.Error("carry したはずの生きたセットプレイの紐付けが落ちている")
	}
	if !linkExists(t, db, comboID, trashedID) {
		t.Error("削除済みセットプレイの紐付けが落ちている。" +
			"利用者はこれを選ぶ手段を持たないため、黙って失われる")
	}
}

// §5.1-7 の裏: individual で生きた方を carry しなければ、生きた紐付けは落ちる(退行防止)。
func TestUpdateMetadata_Individual_StillUnlinksLiveSetup(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "patch-ind2")

	live2 := linkSetup(t, db, comboID, "patch-ind2-live2", false)

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if _, _, err := svc.UpdateMetadata(ctx, comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions: &comborepo.SetupCarryOptionsInput{
			Mode: "individual", CarrySetupIDs: []int64{live2},
		},
	}); err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}

	if !linkExists(t, db, comboID, live2) {
		t.Error("carry した生きたセットプレイの紐付けが落ちている")
	}
	if linkExists(t, db, comboID, liveID) {
		t.Error("carry しなかった生きたセットプレイの紐付けが残っている(引き継ぎが機能していない)")
	}
	if !linkExists(t, db, comboID, trashedID) {
		t.Error("削除済みセットプレイの紐付けが落ちている")
	}
}

// §5.1-8: unlink_all でも、削除済みセットプレイの紐付けは落ちない。
// ★生きた方は落ちること(§5.1-9 の退行防止)を同じテストで見る。
func TestUpdateMetadata_UnlinkAll_KeepsTrashedSetupLink(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "patch-unlink")

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if _, _, err := svc.UpdateMetadata(ctx, comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "unlink_all"},
	}); err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}

	if linkExists(t, db, comboID, liveID) {
		t.Error("unlink_all なのに生きたセットプレイの紐付けが残っている")
	}
	if !linkExists(t, db, comboID, trashedID) {
		t.Error("削除済みセットプレイの紐付けが落ちている。" +
			"利用者は「全部外す」と言ったが、外す対象として見えていたのは生きた分だけである")
	}
	// 生きた方の結果行は落ち、削除済み側の結果行は残る。
	var live, trashed int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM combo_setup_results WHERE combo_id = ? AND setup_id = ?`,
		comboID, liveID).Scan(&live); err != nil {
		t.Fatalf("count results(live): %v", err)
	}
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM combo_setup_results WHERE combo_id = ? AND setup_id = ?`,
		comboID, trashedID).Scan(&trashed); err != nil {
		t.Fatalf("count results(trashed): %v", err)
	}
	if live != 0 {
		t.Errorf("解除した生きたセットプレイの結果行が %d 行残っている", live)
	}
	if trashed != 1 {
		t.Errorf("削除済みセットプレイの結果行 = %d 行, want 1", trashed)
	}
}

// §5.1-9: carry_all の挙動は変わっていない(生きた方も削除済みも残る)。
func TestUpdateMetadata_CarryAll_KeepsBoth(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "patch-carry")

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if _, _, err := svc.UpdateMetadata(ctx, comboID, combo.Version, combosvc.UpdateMetadataInput{
		KnockdownAdvantage: comborepo.Some(30),
		SetupCarryOptions:  &comborepo.SetupCarryOptionsInput{Mode: "carry_all"},
	}); err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if !linkExists(t, db, comboID, liveID) {
		t.Error("carry_all なのに生きたセットプレイの紐付けが落ちている")
	}
	if !linkExists(t, db, comboID, trashedID) {
		t.Error("carry_all なのに削除済みセットプレイの紐付けが落ちている")
	}
}

// ---------------------------------------------------------------------------
// PUT(UpdateWithKeyChange)経路
// ---------------------------------------------------------------------------

// §5.1-8(PUT): unlink_all でも削除済みセットプレイの紐付けは落ちず、しかも
// 論理削除された旧行ではなく新コンボへ移る。
//
// ★移さないと「落とさなかった」が「見えない旧行へ取り残した」になり、セットプレイを
//
//	復元しても現役のコンボへ戻らない。M23-02 の看板は別の形で崩れたままである。
func TestUpdateWithKeyChange_UnlinkAll_MovesTrashedSetupLinkToNewCombo(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "put-unlink")

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	newInput := validRyuInput(t, db)
	newInput.KnockdownAdvantage = ptr(30)
	newInput.Position = ptr("corner_self") // 識別キーを変える
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{Mode: "unlink_all"}

	newCombo, _, err := svc.UpdateWithKeyChange(ctx, comboID, combo.Version, newInput)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	if _, ok := linkComboIDOf(t, db, liveID); ok {
		t.Error("unlink_all なのに生きたセットプレイの紐付けが残っている")
	}
	got, ok := linkComboIDOf(t, db, trashedID)
	if !ok {
		t.Fatal("削除済みセットプレイの紐付けが落ちている")
	}
	if got != newCombo.ID {
		t.Errorf("削除済みセットプレイの紐付けが combo_id=%d に居る, want %d(新コンボ)。"+
			"論理削除された旧行に取り残されており、復元しても現役のコンボへ戻らない",
			got, newCombo.ID)
	}
}

// §5.1-7(PUT): individual でも同様に、削除済みの紐付けは新コンボへ移る。
//
// ★carry しなかった「生きた」セットプレイが落ちることも同じテストで見る(§5.1-9)。
// これが無いと、liveSetupScope が広すぎて全行を残す形に壊れても PUT 側は赤くならない。
func TestUpdateWithKeyChange_Individual_MovesTrashedSetupLinkToNewCombo(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	comboID, liveID, trashedID := newComboWithLiveAndTrashedSetups(t, db, svc, "put-ind")
	// carry しない生きたセットプレイ(退行の対照)。
	droppedID := linkSetup(t, db, comboID, "put-ind-live-dropped", false)

	combo, err := svc.Get(ctx, comboID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	newInput := validRyuInput(t, db)
	newInput.KnockdownAdvantage = ptr(30)
	newInput.Position = ptr("corner_self")
	newInput.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{
		Mode: "individual", CarrySetupIDs: []int64{liveID},
	}

	newCombo, _, err := svc.UpdateWithKeyChange(ctx, comboID, combo.Version, newInput)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}

	liveAt, liveOK := linkComboIDOf(t, db, liveID)
	if !liveOK || liveAt != newCombo.ID {
		t.Errorf("carry した生きたセットプレイの紐付けが新コンボに無い(ok=%v, combo_id=%d)",
			liveOK, liveAt)
	}
	trashedAt, trashedOK := linkComboIDOf(t, db, trashedID)
	if !trashedOK {
		t.Fatal("削除済みセットプレイの紐付けが落ちている")
	}
	if trashedAt != newCombo.ID {
		t.Errorf("削除済みセットプレイの紐付けが combo_id=%d に居る, want %d(新コンボ)",
			trashedAt, newCombo.ID)
	}
	// ★退行の対照: carry しなかった生きたセットプレイは解除されること。
	if _, ok := linkComboIDOf(t, db, droppedID); ok {
		t.Error("carry しなかった生きたセットプレイの紐付けが残っている(引き継ぎが機能していない)")
	}
}
