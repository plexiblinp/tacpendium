package migration_test

import (
	"database/sql"
	"testing"
)

// 本ファイルは ★HEAD スコープ★ のテストを置く場所である。
//
// マイグレの「契約テスト」は比較区間を自サブに閉じる(始端＝自サブの最初の連番の直前、
// 終端＝自サブの最終連番)。契約 F-2 が求めているのは「そのサブが書き換えていないこと」で
// あって「以後のどのサブも書き換えないこと」ではないためである。HEAD 終端を
// TestRun_M14xx_* のような名前空間へ相乗りさせると、後続サブの正当な変更で
// 「そのサブのテスト」が落ち、原因が名前から辿れなくなる(M19-04d §4.3)。
//
// ★主張が 2 つあるならテストも 2 つに分ける。HEAD が何であっても成り立つべき不変条件は、
//   名前に HEAD を含めてここへ置く。ここのテストは、後続サブが正当に壊したときに
//   「期待値を更新するのが正しい対応」になるテストである(契約テストとは扱いが違う)。
//
// ★★M33-03 で収録が 3 本になった。⇒ M33-02 が旧 111 本を新系列 9 本へ潰した結果、
// 版数を名指しして区間を閉じる形そのものが成立しなくなった(区間が 1 つしか無い)。
// 区間の主張として書かれていたテスト群のうち「HEAD で成り立つべき不変条件」だけを
// ここへ引き上げてある(M33-03 段 2)。

// TestRun_HEAD_NoDanglingForeignKeys は HEAD 適用後に宙吊りの外部キー参照が無いことを検証する。
//
// ★これは波に依存しない。どのキャラを seed しようと、どの列を backfill しようと、
// FK の参照先が消えていてよい理由は無い。したがって「正当な変更で落ちる」ことがなく、
// HEAD 終端で持つ価値がある(閉じた契約テストでは、その波の中しか見られない)。
//
// ★とくに本プロジェクトでは、マイグレーション接続は FK=OFF である
// (migration.Run は db.Open を通らず独自に sql.Open する。旧 000044 の down が明記していた)。
// つまり「FK 違反を作っても、マイグレ実行中はエラーにならない」。
// ★M23-10 で db.Open 経由の接続はすべて FK=ON になったが、マイグレーション接続は
// 意図的に FK=OFF のままである(表を作り直すマイグレを FK=ON で走らせないため)。
// ⇒ 本テストの必要性は M23-10 で減っていない。
// seed 再生成波(DELETE → INSERT で moves.id が再発番される型。旧 000029 → 000030 が実例)が
// 参照元の明示削除・明示再ポイントを怠ると、静かに宙吊りが残る
// (DES-003 §3.19 / §3.20 の「明示削除の責務」)。それを HEAD で拾うのが本テストである。
func TestRun_HEAD_NoDanglingForeignKeys(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	fkCheck(t, db)
}

// TestRun_HEAD_DownUpRoundTrip は新系列の down が up を巻き戻し、再 up で復帰することを固定する。
//
// ★★なぜ HEAD スコープに置くか(M33-03・開発者裁定 2026-09-19)——着手時点では
// 「版 N を適用して Steps(-1) で戻す」型の down 往復テストが 48 本あったが、名指しした版が
// すべて消えたため 1 本も成立しなかった。⇒ 主張の芯は「down が up を正しく巻き戻す」であり、
// これは HEAD が何であっても成り立つべき不変条件である。
//
// ★★★新系列 9 本の down は、本テストを入れるまで 1 本もテストされていなかった。
// ⇒ 48 本を消した穴ではなく、着手時点から空いていた穴である。
//
// ★down の全戻しでは schema_migrations 以外のテーブルが残らないことまで見る。
// 「down を書いたが DROP を書き忘れた」は、up だけを流す経路では永遠に出ない。
func TestRun_HEAD_DownUpRoundTrip(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	tablesBefore := userTableNames(t, db)
	if len(tablesBefore) == 0 {
		t.Fatalf("HEAD 適用後に表が 1 つも無い(母集団が壊れている)")
	}

	if err := m.Down(); err != nil {
		t.Fatalf("down to 0: %v", err)
	}
	if left := userTableNames(t, db); len(left) != 0 {
		t.Errorf("down 全戻しの後も表が残っている: %v", left)
	}

	if err := m.Up(); err != nil {
		t.Fatalf("re-up to HEAD: %v", err)
	}
	if got := userTableNames(t, db); len(got) != len(tablesBefore) {
		t.Errorf("再 up 後の表数 = %d, want %d\n  got=%v\n want=%v",
			len(got), len(tablesBefore), got, tablesBefore)
	}
	fkCheck(t, db)
}

// TestRun_HEAD_StartupBasisPartitionsAllMoves は startup_basis が moves の全行を
// ちょうど 3 値へ分割することを固定する。
//
// ★★M33-03 で旧 TestRun_M19P2_ManualBackfill から引き上げた。⇒ 同テストは
// 「000064 の直後の状態」を per-character の件数で固定していたため、seed 波が進むたびに
// 落ちる形だった(17 キャラ時点の実測値を写していた)。★分割そのものは件数に依存しない。
//
// ★件数を書かない。⇒ 「3 値のどれでもない行が 0 である」ことだけを見る。
// 新しいキャラが増えても、新しい値が増えなければ緑のままである。
//
// ★★対になるテストが head_seed_invariants_test.go に在る ——
//
//	TestRun_HEAD_StartupBasisUnknownWhenStartupNull(D-187)。
//	本テストは「値が 3 値のどれかか」を見る(値域＝構造の主張)。あちらは
//	「その値が startup と整合するか」を見る(seed の中身＝行の主張)。
//	⇒ 主張が 2 つあるのでテストもファイルも 2 つに分けてある。
func TestRun_HEAD_StartupBasisPartitionsAllMoves(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	total := scanInt(t, db, `SELECT count(*) FROM moves`)
	if total == 0 {
		t.Fatalf("moves が 0 行(母集団が壊れている)")
	}
	if got := scanInt(t, db, `SELECT count(*) FROM moves
		WHERE startup_basis IS NULL
		   OR startup_basis NOT IN ('standalone', 'through', 'unknown')`); got != 0 {
		t.Errorf("startup_basis が 3 値のどれでもない行 = %d, want 0(母数 %d 行)", got, total)
	}
}

// userTableNames は sqlite_* を除いた表名を返す。
func userTableNames(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.Query(`SELECT name FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'
		ORDER BY name`)
	if err != nil {
		t.Fatalf("list tables: %v", err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatalf("scan table name: %v", err)
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate tables: %v", err)
	}
	return out
}
