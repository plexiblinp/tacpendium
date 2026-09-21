// template_exclusion_test.go —— 本パッケージだけはテスト DB のテンプレート化を使わない
// (M24-09d / CHANGE-145 §2.1.2-3)。
//
// ★★理由 —— 本パッケージはマイグレーションの適用過程そのものを検証している。
// 「出来上がった DB」を配ると、マイグレーションが 1 度も走らないままテストが緑になる。
// **再生させること自体が目的である。**
//
// ★除外の対象がこの 1 パッケージだけであることは M24-09d §3.3-6 の実査で確認した
// (migration.Run の直接呼出・schema_migrations・sqlite_master・PRAGMA table_info 系・
//
//	golang-migrate の import・MigrationsFS・journal_mode 系・WAL サイドカー・
//	SetupWithPath の 9 本の走査軸)。除外を増やすときは同じ軸で数え直すこと。
package migration_test

import (
	"os"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// TestMain は本パッケージのテストが 1 本でも走る前にテンプレート方式を止める。
//
// ★★ここでしか止められない。テンプレートは sync.Once で構築されるため、
// どれか 1 本のテストが先に dbtest.Setup を呼ぶと、以後フラグは効かない。
func TestMain(m *testing.M) {
	dbtest.DisableTemplate()
	os.Exit(m.Run())
}

// TestTemplate_DisabledInThisPackage は、除外が実際に効いていることを
// **速度以外の指標**で観測する(指示書 §5.3-2 / §7.1-4)。
//
// ★★速度は根拠にならない —— 除外し忘れても速くなる。コピーに失敗しても速くなる。
// ⇒ 「dbtest がマイグレーションを何回流したか」を直接数える。
// テンプレート方式なら Setup を何回呼んでも 1 のままであり、除外されていれば
// 呼んだ回数だけ増える。
//
// ★差分で見ているのは、本パッケージの他のテストも dbtest.Setup を使うためである
// (テストの実行順に依存しない形にしてある)。
func TestTemplate_DisabledInThisPackage(t *testing.T) {
	before := dbtest.MigrationRunCount()

	_ = dbtest.Setup(t)
	_ = dbtest.Setup(t)

	if got := dbtest.MigrationRunCount() - before; got != 2 {
		t.Errorf("dbtest.Setup を 2 回呼んだときのマイグレーション実行回数の増分 = %d, want 2"+
			"\n  2 でないなら、本パッケージがテンプレート方式を使ってしまっている"+
			"\n  (TestMain の dbtest.DisableTemplate() が消えていないか見ること)", got)
	}
}
