package aliasnorm_test

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// importPath は本パッケージの import パス。
const importPath = `"github.com/plexiblinp/tacpendium/internal/aliasnorm"`

// allowedImporters は internal/aliasnorm を import してよいディレクトリ(リポジトリルート相対)。
//
// ★本パッケージは照合専用である。表示経路から参照した瞬間、preset_aliases.alias_text の
// 見え方が変わり、D-307 が「採らない」と決めたデータ書き換えと同じ結果になる
// (指示書 M20-07 §4.5-2・チェックリスト 重大 6)。
//
// ★逆引きの照合は internal/aliasindex に閉じている。サービス層・ハンドラ層・表示側の
// notation 系から直接 import する必要は無い——必要になったと感じたら、それは
// 「表示へ正規化を掛けようとしている」合図である可能性が高い。まず設計卓へ上げること。
var allowedImporters = []string{
	"internal/aliasnorm", // 自分自身(テスト)
	"internal/aliasindex",
}

// TestImportBoundary_NotReferencedFromDisplayPaths は §5 (f) を静的に固定する。
//
// 「表示の見え方が変わらない」ことは、表示結果を比べるテストだけでは守りきれない——
// 正規化を表示側へ掛けても、たまたまその技の表記が正規形と一致していれば緑のままになる。
// ⇒ 参照そのものを禁じる形で守る。
func TestImportBoundary_NotReferencedFromDisplayPaths(t *testing.T) {
	root := repoRoot(t)

	var scannedFiles, importers int
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			// 走査対象は Go のソースだけ(node_modules や web は見ない)。
			if name := d.Name(); name == "node_modules" || name == ".git" || name == "web" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		scannedFiles++

		src, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if !strings.Contains(string(src), importPath) {
			return nil
		}
		importers++

		rel, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		dir := filepath.ToSlash(filepath.Dir(rel))
		if !slices.Contains(allowedImporters, dir) {
			t.Errorf("★internal/aliasnorm が %s から参照されている。\n"+
				"本パッケージは照合専用であり、表示経路から参照してはならない(M20-07 §4.5-2)。\n"+
				"表示へ掛けると alias_text の見え方が変わる。", rel)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk: %v", err)
	}

	// ★「0 件」が「対象が無い」と読めないようにする(E-84)。
	// 検査した件数と、実際に import している件数の両方を出す。
	t.Logf("走査: .go ファイル %d / aliasnorm を import している %d", scannedFiles, importers)
	if scannedFiles == 0 {
		t.Fatal("ファイルを 1 つも走査していない(検査が空回りしている)")
	}
	if importers == 0 {
		t.Fatal("aliasnorm を import しているファイルが 0(パスが変わって検査が当たっていない疑い)")
	}
}

// repoRoot は go.mod のあるディレクトリを遡って探す。
func repoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for {
		if _, statErr := os.Stat(filepath.Join(dir, "go.mod")); statErr == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod が見つからない")
		}
		dir = parent
	}
}
