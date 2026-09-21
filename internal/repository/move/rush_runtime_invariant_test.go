package move_test

// 本ファイルは `D-187` の不変条件を **実行時の経路** に対して固定する(M39-02)。
//
// ★★★M39-01 が置いたガードとは性格が違う。混同しないこと。
//
//	internal/infra/migration/head_seed_invariants_test.go の
//	  TestRun_HEAD_StartupBasisUnknownWhenStartupNull   ……… **新規 DB の最終状態** を見る。
//	    ⇒ マイグレを HEAD まで当てた直後の moves を数えるだけであり、
//	      **利用者が操作して作った行は 1 行も見ない**。
//	本ファイル                                          ……… **実行時の経路** を見る。
//	    ⇒ ラッシュ版の生成(POST /api/moves/:id/rush-variant → InsertRushVariant)が
//	      不変条件を破らないことを主張する。
//
// ★★★なぜ分ける必要があったか(M39-02 の存在理由そのもの)——
//
//	ラッシュ生成経路は startup_basis に 'through' をリテラルで INSERT しつつ startup を
//	元技からコピーしていた。⇒ startup が NULL の元技から生成すると
//	`startup NULL` ＋ `startup_basis='through'` の行ができ、これは新たな D-187 違反である。
//	**そしてこの違反を、上の HEAD ガードは緑のまま素通りする**——ガードは毎回まっさらな DB を
//	作って見るため、汚れた利用者 DB を一度も読まない。
//	⇒ 「HEAD ガードが在るから大丈夫」は本経路には効かない。だから本ファイルが要る。
//	(SUPP-001 §5.5 規約 (24)-3 が同じことを述べている。)

import (
	"context"
	"testing"

	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// d187InvariantSQL は `D-187` の不変条件の検出式である(DES-003 §3.3 (i)＝
// 「本列は *格納されている startup の由来* を表すのであって、値が無い行に由来は無い」)。
//
// ★★正本は internal/infra/migration/head_seed_invariants_test.go の
// startupBasisInvariantSQL である。**式を変えるときは両方を変えること**(あちらにも同じ
// 相互参照を置いてある)。
//
// ★★★これは「共有できない」のではなく「**共有しないことを選んだ**」である。
// ⇒ 正本は package migration_test に属し *そのままでは* import できないが、
//
//	両パッケージが既に import している internal/testutil/dbtest へ述語を移せば共有できた
//	(循環もしない)。採らなかったのは、同 helper が **DB を用意する道具** であり、
//	不変条件の述語を置く場所ではないと判断したためである。
//
// ⇒ 代償は「2 か所を同時に直す必要がある」こと。相互参照コメントがその歯止めである。
const d187InvariantSQL = `SELECT count(*) FROM moves
	WHERE startup IS NULL AND startup_basis <> 'unknown'`

// pickNullStartupRushSourceSQL は「ラッシュ版を生成できるが startup を持たない元技」を選ぶ。
//
// ★述語で選び、id も code も直書きしない(M39-02 §4.5)。⇒ 次の seed 波で母数が動いても生き残る。
// ★述語は rushEligible(internal/service/move/service.go)と同じ——
// category ∈ {normal, unique} ∧ !is_aerial。**startup の有無を見ていない** ことが穴の源である。
// ★rush_<code> が既に占有されている元技は除く(InsertRushVariant が ErrConflict を返すため)。
const pickNullStartupRushSourceSQL = `
SELECT m.id FROM moves m
WHERE m.category IN ('normal', 'unique')
  AND m.is_aerial = 0
  AND m.startup IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM moves r WHERE r.character_id = m.character_id AND r.code = 'rush_' || m.code
  )
ORDER BY m.id
LIMIT 1`

// TestInsertRushVariant_StartupNullSourceKeepsInvariant は
// **startup を持たない元技からラッシュ版を作っても D-187 の不変条件が保たれる** ことを主張する。
//
// ★これが M39-02 の是正そのもののガードである。是正(rush.go の rushStartupBasis)を外すと、
// 生成行が `startup NULL` ＋ `startup_basis='through'` になり、本テストは赤くなる。
//
// ★環境変数でゲートしない。⇒ skip するテストは緑のまま素通りし、ガードの役を果たさない
// (TACPENDIUM_AUDIT_DB 型の前例がある。M39-01 §7-2)。
func TestInsertRushVariant_StartupNullSourceKeepsInvariant(t *testing.T) {
	db := dbtest.Setup(t)
	repo := moverepo.New(db)
	ctx := context.Background()

	// ★母数の生存確認。該当する元技が 0 件なら、不変条件が保たれていても空振りである。
	var srcID int64
	if err := db.QueryRowContext(ctx, pickNullStartupRushSourceSQL).Scan(&srcID); err != nil {
		t.Fatalf("startup を持たないラッシュ生成可能な元技を選べない"+
			"(母数が無く本テストが空回りしている。seed の前提が変わった可能性): %v", err)
	}

	src, err := repo.GetByID(ctx, srcID)
	if err != nil {
		t.Fatalf("GetByID(%d): %v", srcID, err)
	}
	if src.Startup != nil {
		t.Fatalf("選んだ元技 %q の startup = %d(述語が効いていない)", src.Code, *src.Startup)
	}

	var before int
	if err := db.QueryRowContext(ctx, d187InvariantSQL).Scan(&before); err != nil {
		t.Fatalf("生成前の違反件数: %v", err)
	}
	if before != 0 {
		t.Fatalf("生成前の違反 = %d, want 0(HEAD が既に違反しており、本テストの主張が立たない)", before)
	}

	newID, err := repo.InsertRushVariant(ctx, &src.Move)
	if err != nil {
		t.Fatalf("InsertRushVariant(%s): %v", src.Code, err)
	}

	var (
		rushStartup *int
		basis       string
	)
	if err := db.QueryRowContext(ctx,
		`SELECT startup, startup_basis FROM moves WHERE id = ?`, newID,
	).Scan(&rushStartup, &basis); err != nil {
		t.Fatalf("生成された rush 行の読み出し: %v", err)
	}

	// 前提の確認——startup は元技のコピーなので NULL のままであること。
	// ⇒ ここが非 NULL なら、本テストが見たかった状況が再現できていない。
	if rushStartup != nil {
		t.Fatalf("rush 行の startup = %d, want NULL(元技 %q は startup を持たない)", *rushStartup, src.Code)
	}

	// ★主張。startup が無い行に 'through'(=通し値である、という由来の主張)を書いてはならない。
	if basis != "unknown" {
		t.Errorf("startup が NULL の元技 %q から作った rush 行の startup_basis = %q, want %q"+
			"(DES-003 §3.3 (i)＝値が無い行に由来は無い。D-187 / M39-02)", src.Code, basis, "unknown")
	}

	var after int
	if err := db.QueryRowContext(ctx, d187InvariantSQL).Scan(&after); err != nil {
		t.Fatalf("生成後の違反件数: %v", err)
	}
	if after != 0 {
		t.Errorf("ラッシュ版生成後の D-187 違反 = %d, want 0"+
			"(実行時にこの経路で不変条件が破れている。元技 = %q / 生成 id = %d)", after, src.Code, newID)
	}
}

// TestInsertRushVariant_RuntimeInvariantDetectorBites は上のガードの **破壊確認** である。
//
// ★★★是正 *前* の経路が作っていた形(rush 行に `startup NULL` ＋ `'through'`)を 1 行だけ
// 作り直し、検出式が 0 → 1 で噛むことを示す。⇒ 噛まないなら、上のガードは何も見ていない。
// ★「緑である」ことと「見ている」ことは別である。
//
// ★戻す行は述語で選ぶ(id や code を直書きしない)。★当たった行数を必ず確かめる——
// 0 行に当たったまま「検出 0」を見ても、それは対照ではない。
// ★DB は dbtest.Setup が t.TempDir() に作る使い捨てであり、他のテストへ影響しない。
func TestInsertRushVariant_RuntimeInvariantDetectorBites(t *testing.T) {
	db := dbtest.Setup(t)
	repo := moverepo.New(db)
	ctx := context.Background()

	var srcID int64
	if err := db.QueryRowContext(ctx, pickNullStartupRushSourceSQL).Scan(&srcID); err != nil {
		t.Fatalf("startup を持たないラッシュ生成可能な元技を選べない(母数が無い): %v", err)
	}
	src, err := repo.GetByID(ctx, srcID)
	if err != nil {
		t.Fatalf("GetByID(%d): %v", srcID, err)
	}
	newID, err := repo.InsertRushVariant(ctx, &src.Move)
	if err != nil {
		t.Fatalf("InsertRushVariant(%s): %v", src.Code, err)
	}

	var before int
	if err := db.QueryRowContext(ctx, d187InvariantSQL).Scan(&before); err != nil {
		t.Fatalf("破壊前の違反件数: %v", err)
	}
	if before != 0 {
		t.Fatalf("破壊前の違反 = %d, want 0(是正が効いておらず、対照にならない)", before)
	}

	// ★是正を外した経路が書いていた値へ戻す。⇒ startup は NULL のままである。
	res, err := db.ExecContext(ctx,
		`UPDATE moves SET startup_basis = 'through' WHERE id = ? AND startup IS NULL`, newID)
	if err != nil {
		t.Fatalf("破壊用 UPDATE: %v", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		t.Fatalf("RowsAffected: %v", err)
	}
	if n != 1 {
		t.Fatalf("破壊用 UPDATE が当たった行 = %d, want 1(対照が空振りしている)", n)
	}

	var after int
	if err := db.QueryRowContext(ctx, d187InvariantSQL).Scan(&after); err != nil {
		t.Fatalf("破壊後の違反件数: %v", err)
	}
	t.Logf("破壊確認: 違反件数 %d -> %d(rush 行 id=%d を是正前の 'through' へ戻した。元技 = %q)",
		before, after, newID, src.Code)
	if after != 1 {
		t.Errorf("破壊後の違反 = %d, want 1(検出式が噛んでいない＝ガードは何も見ていない)", after)
	}
}
