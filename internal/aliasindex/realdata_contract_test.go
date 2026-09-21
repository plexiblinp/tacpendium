package aliasindex_test

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 本ファイルは M20-07 §5 (b)「正規化で別の技が同一視されない」を実データ全数で固定する。
//
// ★★本サブで唯一「緩めすぎ」を検出できる機構である。
// 正規化を緩めた側の失敗は赤くならない——別の技が同じものとして解決されても、動作は
// 「解決できた」ように見え、通常のテストも lint も型検査も緑のまま利用者のデータへ入る。
// ⇒ 合成 fixture ではなく、seed 済みの実データ全行を走査して主張する。
//
// ★将来だれかが aliasnorm.Normalize の範囲を広げたら、このテストが赤くなる。
// 赤くなったときに「テストを直す」のではなく「正規化を狭める」こと(指示書 §4.1-5)。

func allCharacterCodes(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.QueryContext(context.Background(), `SELECT code FROM characters ORDER BY code`)
	if err != nil {
		t.Fatalf("list characters: %v", err)
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			t.Fatalf("scan character code: %v", err)
		}
		codes = append(codes, c)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	return codes
}

// TestRealData_StrictStageHasNoCollisions は第 1 段の正規化が別の技を同一視しないことを
// 全キャラ・全プリセットの実データで主張する(§5 (b)・チェックリスト 重大 1)。
func TestRealData_StrictStageHasNoCollisions(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	chars := allCharacterCodes(t, db)
	if len(chars) == 0 {
		t.Fatal("キャラが 0 件(検査が対象を見ていない)")
	}

	var totalScanned, totalCollisions int
	for _, charCode := range chars {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
		}
		ix := aliasindex.Build(entries)
		totalScanned += ix.Scanned()

		for _, c := range ix.StrictCollisions() {
			totalCollisions++
			t.Errorf("★第 1 段で別の技が同一視された: char=%s key=%q moves=%v", charCode, c.Key, c.MoveCodes)
		}
	}

	// ★「0 件」が「対象が無い」と読めないようにする(E-84)。
	// 見つかった件数だけでなく、検査した件数を必ず出す。
	t.Logf("走査: キャラ %d / 表記 %d / 第 1 段の同一視 %d 組", len(chars), totalScanned, totalCollisions)
	if totalScanned == 0 {
		t.Fatal("表記を 1 つも走査していない(検査が空回りしている)")
	}
}

// TestRealData_RelaxedStageCollisionsAreOnlyCAvsSA3 は第 2 段の衝突が
// 「Critical Art と SA3 が同一コマンド」という既知の形だけであることを主張する。
//
// ★第 2 段に衝突があること自体は欠陥ではない(設計上の前提)。
// 欠陥になるのは、想定していない別の形の衝突が混ざったときである——そのとき第 2 段は
// 「利用者が注記を省いた」以外の理由で複数件を返し始める。
func TestRealData_RelaxedStageCollisionsAreOnlyCAvsSA3(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	chars := allCharacterCodes(t, db)
	var groups int
	for _, charCode := range chars {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
		}
		ix := aliasindex.Build(entries)

		// 第 1 段の衝突は上のテストが 0 を主張しているため、ここでは第 2 段だけを見る。
		for _, c := range ix.RelaxedCollisions() {
			groups++
			if len(c.MoveCodes) != 2 {
				t.Errorf("第 2 段の衝突が 2 件でない: char=%s key=%q moves=%v", charCode, c.Key, c.MoveCodes)
				continue
			}
			hasCA := strings.HasPrefix(c.MoveCodes[0], "ca_") || strings.HasPrefix(c.MoveCodes[1], "ca_")
			hasSA3 := strings.HasPrefix(c.MoveCodes[0], "sa3_") || strings.HasPrefix(c.MoveCodes[1], "sa3_")
			if !hasCA || !hasSA3 {
				t.Errorf("第 2 段に想定外の衝突: char=%s key=%q moves=%v", charCode, c.Key, c.MoveCodes)
			}
		}
	}

	t.Logf("走査: キャラ %d / 第 2 段の衝突 %d 組(すべて CA vs SA3)", len(chars), groups)
	// ★対照: 衝突が 0 組なら、それは「第 2 段が効いていない」可能性が高い
	// (SA / CA 注記つきのエイリアスは実測 132 行ある)。
	if groups == 0 {
		t.Fatal("第 2 段の衝突が 0 組(第 2 段が構築されていない疑い)")
	}
}

// TestRealData_FullWidthAliasResolvesFromHalfWidthInput は §5 (a) の実データ版。
// D-307 の実例そのもの(ingrid のソーラー系は同一文字列に半角と全角が混在する)。
func TestRealData_FullWidthAliasResolvesFromHalfWidthInput(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "ingrid")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}
	ix := aliasindex.Build(entries)

	// 辞書側は `ソーラーフレア(Lv1)（前方）`(Lv は半角括弧・方向は全角括弧)。
	// 利用者が全て半角で打った入力で解決できること。
	got := ix.Lookup("ソーラーフレア(Lv1)(前方)")
	if len(got) != 1 {
		t.Fatalf("半角入力で全角括弧の別名を引けなかった: %v", got)
	}
	// 対照: 辞書に無い表記は当たらない(索引が何にでも当たる状態ではない)。
	if other := ix.Lookup("ソーラーフレア(Lv9)(前方)"); len(other) != 0 {
		t.Errorf("存在しない表記が当たった: %v", other)
	}
}
