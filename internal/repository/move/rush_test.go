package move_test

import (
	"context"
	"testing"

	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// TestInsertRushVariant_FrameCostColumnDefaults は M19-04 §4.5 のガードである。
//
// ★これは「静かに壊れる」型の失敗モードを止めるためのテストである。
// 新列 startup_basis は insertRushVariantSQL に列挙されないと DDL の DEFAULT('unknown')で入る。
// 機械 backfill(000050)は 1 回きりのマイグレなので、その後にアプリが生成する rush 行だけが
// unknown で取り残される——型エラーにも実行時エラーにもならず、テストも(このテストが無ければ)落ちない。
//
// あわせて chain_cancel_total(NULL)と fastest_unreachable(0)が DEFAULT のままであることも固定する
// (rush 版に実測値は無く、C 型の空中技でもないため)。
//
// ★★【2026-09-19・M39-02】本テストは同時に **対照** である——
//
//	M39-02 は「元技の startup が NULL なら startup_basis に 'unknown' を入れる」を足した
//	(rush.go の rushStartupBasis)。⇒ その是正が 'through' を *一般に* 外していないこと、
//	すなわち **元技が startup を持つ場合の挙動が 1 ビットも変わっていない** ことを主張するのが
//	本テストの第 2 の役目である。
//	★そのため元技の選択述語に `m.startup IS NOT NULL` を足した。⇒ これが無いと、seed の
//	  母集団が動いたときに本テストが黙って NULL-startup の元技を引き、対照の役を失う
//	  (そして 'unknown' が返って赤くなる——赤くなるだけましだが、何を見ていたのかが読めなくなる)。
//	★対になるのは rush_runtime_invariant_test.go の
//	  TestInsertRushVariant_StartupNullSourceKeepsInvariant である。
func TestInsertRushVariant_FrameCostColumnDefaults(t *testing.T) {
	db := dbtest.Setup(t)
	repo := moverepo.New(db)
	ctx := context.Background()

	// 元技は seed 済みの ryu の通常技から述語で選ぶ(非派生・地上・startup を持つ・
	// rush 版が未生成の code)。rush_standing_light_punch は 000030 の seed に含まれるため、
	// 衝突しない別の元技を使う。★id も code も直書きしない(seed 波で母数が動いても生き残る形)。
	var srcID int64
	const pickSrcSQL = `
SELECT m.id FROM moves m
JOIN characters c ON c.id = m.character_id
WHERE c.code = 'ryu'
  AND m.is_derived = 0
  AND m.damage IS NOT NULL
  AND m.startup IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM moves r WHERE r.character_id = m.character_id AND r.code = 'rush_' || m.code
  )
ORDER BY m.id
LIMIT 1`
	if err := db.QueryRowContext(ctx, pickSrcSQL).Scan(&srcID); err != nil {
		t.Fatalf("rush 版が未生成かつ startup を持つ元技を選べない(seed の前提が変わった可能性): %v", err)
	}

	src, err := repo.GetByID(ctx, srcID)
	if err != nil {
		t.Fatalf("GetByID(%d): %v", srcID, err)
	}

	// MoveDetail は model.Move を埋め込む。サービス層(service.go:101)と同じく埋め込み側を渡す。
	newID, err := repo.InsertRushVariant(ctx, &src.Move)
	if err != nil {
		t.Fatalf("InsertRushVariant(%s): %v", src.Code, err)
	}

	var (
		startupBasis       string
		rushStartup        *int
		chainCancelTotal   *int
		fastestUnreachable int
		isDerived          int
	)
	if err := db.QueryRowContext(ctx,
		`SELECT startup_basis, startup, chain_cancel_total, fastest_unreachable, is_derived FROM moves WHERE id = ?`, newID,
	).Scan(&startupBasis, &rushStartup, &chainCancelTotal, &fastestUnreachable, &isDerived); err != nil {
		t.Fatalf("生成された rush 行の読み出し: %v", err)
	}

	// ★本テストの主目的。列挙を落とすと DEFAULT の 'unknown' になり、ここで落ちる。
	// ★★M39-02 以降は「元技が startup を持つ場合は 'through' のままである」の主張も兼ねる。
	if startupBasis != "through" {
		t.Errorf("rush 行の startup_basis = %q, want %q"+
			"(insertRushVariantSQL の列挙漏れ＝機械 backfill 後に生成される rush 行だけが取り残される。"+
			"あるいは M39-02 の rushStartupBasis が startup を持つ元技まで 'unknown' へ倒している)",
			startupBasis, "through")
	}
	// ★対照の本体。元技の startup がそのままコピーされていること(=通し値の *元* が在ること)を見る。
	// ⇒ ここが NULL なら、上の 'through' は「値が無いのに由来を述べている」状態であり D-187 違反である。
	if rushStartup == nil {
		t.Errorf("rush 行の startup = NULL, want 元技 %q の値 %v(対照が成立していない)", src.Code, src.Startup)
	} else if src.Startup == nil || *rushStartup != *src.Startup {
		t.Errorf("rush 行の startup = %d, want 元技 %q の値 %v", *rushStartup, src.Code, src.Startup)
	}
	if chainCancelTotal != nil {
		t.Errorf("rush 行の chain_cancel_total = %v, want NULL(rush 版に実測値は無い)", *chainCancelTotal)
	}
	if fastestUnreachable != 0 {
		t.Errorf("rush 行の fastest_unreachable = %d, want 0", fastestUnreachable)
	}
	// 既存の不変条件(rush 版は常に派生技)も併せて固定する。
	if isDerived != 1 {
		t.Errorf("rush 行の is_derived = %d, want 1", isDerived)
	}
}
