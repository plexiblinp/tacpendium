package combo_test

// ★M23-04: コンボ復元時のバリデーション(VAL-R01 / VAL-C08)のサービス層テスト。
//
// ★本サブは「警告が出ること」と同じだけ「警告が出ないこと」を守る必要がある——
// 誤検知する警告は、無視される警告になる(指示書 §5 前文)。
// ⇒ 発火 1 本に対し、非発火の対照を 2 つ(全部生きている / 0 件)置いてある。

import (
	"context"
	"database/sql"
	"testing"

	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

func hasIssueCode(issues []validation.ValidationIssue, code string) bool {
	for _, i := range issues {
		if i.Code == code {
			return true
		}
	}
	return false
}

// comboDeletedAt は combos.deleted_at を読む(復元が成立したかの実体確認用)。
func comboDeletedAt(t *testing.T, db *sql.DB, comboID int64) *string {
	t.Helper()
	var v sql.NullString
	if err := db.QueryRow(`SELECT deleted_at FROM combos WHERE id = ?`, comboID).Scan(&v); err != nil {
		t.Fatalf("select combos.deleted_at: %v", err)
	}
	if !v.Valid {
		return nil
	}
	return &v.String
}

// softDeleteSetupRow はセットプレイを直 UPDATE で論理削除する。
// ★サービス経由(DeleteSetup)を使わないのは、コンボ側のテストで見たいのが
// 「削除済みのセットプレイが紐付いた状態」そのものであり、削除の手順ではないため。
func softDeleteSetupRow(t *testing.T, db *sql.DB, setupID int64) {
	t.Helper()
	if _, err := db.Exec(
		`UPDATE setups SET deleted_at = datetime('now') WHERE id = ?`, setupID); err != nil {
		t.Fatalf("soft delete setup: %v", err)
	}
}

// setupIDsOfCombo は combo_setups から紐付き setup_id を昇順で返す(削除済みも含む)。
func setupIDsOfCombo(t *testing.T, db *sql.DB, comboID int64) []int64 {
	t.Helper()
	rows, err := db.Query(
		`SELECT setup_id FROM combo_setups WHERE combo_id = ? ORDER BY setup_id`, comboID)
	if err != nil {
		t.Fatalf("select combo_setups: %v", err)
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan setup_id: %v", err)
		}
		ids = append(ids, id)
	}
	return ids
}

// ===========================================================================
// §5.1-1: 削除済みセットプレイを 1 件含むコンボを復元すると VAL-R01 が返る
// ===========================================================================

func TestRestoreCombo_VALR01_FiresWhenAnyLinkedSetupDeleted(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	ctx := context.Background()

	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		validSetupInput(t, db, 1),
		func() setupsvc.CreateSetupInput {
			in := validSetupInput(t, db, 1)
			in.Name = ptr("2 本目")
			in.Steps = append(in.Steps, in.Steps[0]) // レシピを変えて VAL-S04 重複を避ける
			return in
		}(),
	}
	saved, result, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("Create validation: %+v", result.Issues)
	}

	ids := setupIDsOfCombo(t, db, saved.ID)
	if len(ids) != 2 {
		t.Fatalf("前提が崩れている: 紐付きセットプレイ = %d 件, want 2", len(ids))
	}
	// ★1 件だけ落とす。「1 件でも含まれる」で発火することを見る(§4.7 の非対称)。
	softDeleteSetupRow(t, db, ids[0])

	if err := svc.Delete(ctx, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	warnings, err := svc.Restore(ctx, saved.ID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if !hasIssueCode(warnings.Issues, validation.CodeR01LinkedSetupsDeleted) {
		t.Errorf("VAL-R01 が返らない: %+v", warnings.Issues)
	}
	// ★§5.1-6: 警告が付いても復元は成功している。
	if got := comboDeletedAt(t, db, saved.ID); got != nil {
		t.Errorf("警告付きで復元したのに deleted_at = %q(復元が中止されている)", *got)
	}
	if _, err := svc.Get(ctx, saved.ID, 1); err != nil {
		t.Errorf("復元後の Get が失敗した: %v", err)
	}
}

// ===========================================================================
// §5.1-2: セットプレイがすべて生きているコンボでは VAL-R01 が返らない(誤検知防止)
// ===========================================================================

func TestRestoreCombo_VALR01_SilentWhenAllSetupsAlive(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	ctx := context.Background()

	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{validSetupInput(t, db, 1)}
	saved, result, err := svc.Create(ctx, input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("Create validation: %+v", result.Issues)
	}
	if n := len(setupIDsOfCombo(t, db, saved.ID)); n != 1 {
		t.Fatalf("前提が崩れている: 紐付きセットプレイ = %d 件, want 1", n)
	}

	if err := svc.Delete(ctx, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	warnings, err := svc.Restore(ctx, saved.ID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if hasIssueCode(warnings.Issues, validation.CodeR01LinkedSetupsDeleted) {
		t.Errorf("全部生きているのに VAL-R01 が返った(誤検知): %+v", warnings.Issues)
	}
}

// ===========================================================================
// §5.1-3: セットプレイを 1 件も持たないコンボでも VAL-R01 が返らない
// ===========================================================================

// ★0 件と「全部削除済み」を取り違えないこと。集合が空のときに真になる述語を
// 書くと、セットプレイを使っていない大多数のコンボが復元のたびに警告を浴びる。
func TestRestoreCombo_VALR01_SilentWhenNoSetups(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	ctx := context.Background()

	saved, result, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("Create validation: %+v", result.Issues)
	}
	if n := len(setupIDsOfCombo(t, db, saved.ID)); n != 0 {
		t.Fatalf("前提が崩れている: 紐付きセットプレイ = %d 件, want 0", n)
	}

	if err := svc.Delete(ctx, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	warnings, err := svc.Restore(ctx, saved.ID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if hasIssueCode(warnings.Issues, validation.CodeR01LinkedSetupsDeleted) {
		t.Errorf("セットプレイ 0 件なのに VAL-R01 が返った(誤検知): %+v", warnings.Issues)
	}
}

// ===========================================================================
// §5.1-7: 警告 0 件のとき Issues が空である
// ===========================================================================

func TestRestoreCombo_NoWarningsWhenHealthy(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	ctx := context.Background()

	saved, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := svc.Delete(ctx, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	warnings, err := svc.Restore(ctx, saved.ID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if len(warnings.Issues) != 0 {
		t.Errorf("健全なコンボの復元で警告が出た(誤検知): %+v", warnings.Issues)
	}
}

// ===========================================================================
// VAL-C08 が復元経路でも走る(指示書 §1.5-2)
// ===========================================================================

// ★「削除中に技が消えた」を見るためではない(moves に削除経路は無い＝§3.3-4)。
// 検証の緩かった経路(CSV 取込・API 直叩き)で登録時から不整合だった行に気づく
// ためである(§4.5-2)。⇒ 直 UPDATE でその状態を再現する。
func TestRestoreCombo_RunsVALC08(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	ctx := context.Background()

	saved, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	var otherMove int64
	if err := db.QueryRow(
		`SELECT id FROM moves WHERE character_id <> 1 ORDER BY id LIMIT 1`).Scan(&otherMove); err != nil {
		t.Fatalf("他キャラの技が引けない(seed の前提崩れ): %v", err)
	}
	if _, err := db.Exec(
		`UPDATE combo_steps SET move_id = ? WHERE combo_id = ? AND step_order = 1`,
		otherMove, saved.ID); err != nil {
		t.Fatalf("inject foreign move: %v", err)
	}

	if err := svc.Delete(ctx, saved.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	warnings, err := svc.Restore(ctx, saved.ID)
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if !hasIssueCode(warnings.Issues, validation.CodeC08MoveExists) {
		t.Errorf("VAL-C08 が復元経路で走っていない: %+v", warnings.Issues)
	}
	// ★それでも復元は成功している。
	if got := comboDeletedAt(t, db, saved.ID); got != nil {
		t.Errorf("VAL-C08 警告で復元が中止された(deleted_at = %q)", *got)
	}
}
