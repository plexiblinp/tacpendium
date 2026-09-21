package combo

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// TestJudgementPredicateExistsOnlyOnce は「FR702 の判定式が 2 本ある状態を作れない」ことを
// 構造として主張する(指示書 M28-02c §5-1 / チェックリスト §1-1)。
//
// ★★なぜ振る舞いのテストでは足りないか ——————————————————————————————
// 表示(SELECT の派生列)と絞り込み(WHERE)と列挙(affectedMoves)と総数(COUNT)がずれるのは、
// マーカーと基準が特定の関係になったときだけである。ふつうのテストデータでは
// どの経路も同じ答えを返し、**テストも lint も型検査も緑のまま通る**
// (チェックリスト §0.4-1)。⇒ 「式が 1 本しか無い」ことをソースの形として押さえる。
//
// ★判定式の定義: 「マーカー(last_changed_game_version)と基準(baseline_version)を
// 突き合わせる文字列」である。⇒ 両方に言及する文字列リテラルは affectedMoveCondSQL の
// 1 本だけでなければならない。
//
//   - 列の読み出しだけの文字列(SELECT ... m.last_changed_game_version など)は
//     基準に言及しないので当たらない。
//   - 逆に基準だけを書く文字列(INSERT の列名など)もマーカーに言及しないので当たらない。
//
// ★★走査範囲は internal/ 全体である(自パッケージだけではない)。
// ⇒ 判定式を別パッケージ(サービス層・別のリポジトリ)へ書き写しても検出する。
// ★自パッケージだけを見る形にすると「よそへ写す」が素通しになり、
// 本テストが守りたいものの半分しか守れない。
func TestJudgementPredicateExistsOnlyOnce(t *testing.T) {
	const marker = "last_changed_game_version"
	const baseline = "baseline_version"

	// internal/ の直下から辿る(本ファイルは internal/repository/combo/ に在る)。
	root := filepath.Join("..", "..")
	var files []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		files = append(files, path)
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}
	if len(files) < 50 {
		t.Fatalf("★走査対象が少なすぎる(%d 件)。パスの前提が崩れている疑い", len(files))
	}

	type hit struct {
		file  string
		line  int
		value string
	}
	var hits []hit

	fset := token.NewFileSet()
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		src, err := os.ReadFile(name)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		f, err := parser.ParseFile(fset, name, src, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", name, err)
		}
		ast.Inspect(f, func(n ast.Node) bool {
			lit, ok := n.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			v, err := strconv.Unquote(lit.Value)
			if err != nil {
				return true
			}
			if strings.Contains(v, marker) && strings.Contains(v, baseline) {
				hits = append(hits, hit{file: name, line: fset.Position(lit.Pos()).Line, value: v})
			}
			return true
		})
	}

	if len(hits) != 1 {
		for _, h := range hits {
			t.Errorf("判定式に見える文字列リテラル: %s:%d\n%s", h.file, h.line, h.value)
		}
		t.Fatalf("★★マーカーと基準の両方に言及する文字列リテラルは internal/ 全体で 1 本で"+
			"なければならない(実測 %d 本)。⇒ 判定式を書き写していないか確かめること。"+
			"足すなら affectedMoveCondSQL を参照して組むこと", len(hits))
	}
	if hits[0].value != affectedMoveCondSQL {
		t.Fatalf("★唯一の判定式が affectedMoveCondSQL ではない: %s:%d", hits[0].file, hits[0].line)
	}
}

// TestDerivedSQLSharesTheSinglePredicate は 3 つの利用者がすべて同じ 1 本から
// 組まれていることを主張する。★片方だけを書き換えても本テストが赤になる。
func TestDerivedSQLSharesTheSinglePredicate(t *testing.T) {
	if !strings.Contains(affectedByGameUpdateCondSQL, affectedMoveCondSQL) {
		t.Error("EXISTS(真偽の判定)が affectedMoveCondSQL を使っていない")
	}
	if !strings.Contains(affectedByGameUpdateExprSQL, affectedMoveCondSQL) {
		t.Error("SELECT の派生列が affectedMoveCondSQL を使っていない")
	}
	if !strings.Contains(listAffectedMovesSQLTemplate, affectedMoveCondSQL) {
		t.Error("affectedMoves の列挙が affectedMoveCondSQL を使っていない")
	}
	// ★総数は判定式を直接持たない。List と同じ WHERE 組み立てを共有する形で担保する
	//   (TestCountMatchesListFilter が実 DB で集合の一致を主張する)。
	if !strings.Contains(comboSelectSQL, affectedByGameUpdateExprSQL) {
		t.Error("combos を読む共有 SELECT 句が派生列を持っていない")
	}
}
