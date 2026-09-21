package intake

import (
	"strings"
	"testing"
)

func TestParseInput_SkipsHeaderAndBlank(t *testing.T) {
	text := strings.Join([]string{
		"# \t step \t 元の表記 \t トークン列 \t 技名の候補 \t 確信度 \t 備考", // ヘッダ(先頭が # で非整数)
		"", // 空行
		tsv("1", "1", "屈中P", "`2MP`", "`しゃがみ中P`", "高", ""), // トークン/技名がバッククォート装飾
		tsv("2", "1", "立中P", "p_m", "立ち中P", "中", "推定"),
	}, "\n")

	steps := ParseInput(text)
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps (header/blank skipped), got %d: %+v", len(steps), steps)
	}
	if steps[0].ComboIndex != 1 || steps[0].StepOrder != 1 {
		t.Fatalf("indices: %+v", steps[0])
	}
	// バッククォートが剥がされていること。
	if steps[0].Tokens != "2MP" || steps[0].NameCandidate != "しゃがみ中P" {
		t.Fatalf("backtick trim failed: %+v", steps[0])
	}
	if steps[1].RawText != "立中P" || steps[1].Note != "推定" {
		t.Fatalf("row2: %+v", steps[1])
	}
}

func TestParseInput_PipeTable(t *testing.T) {
	// Markdown パイプ表(AI チャットが安定生成する主形式)を読める。
	// ヘッダ行・区切り線(|---|)はスキップされる。
	text := strings.Join([]string{
		"| # | ステップ | 元の表記 | トークン列 | 技名の候補 | 確信度 | 備考 |",
		"|---|---|---|---|---|---|---|",
		"| 1 | 1 | 屈中P | d plus p_m | しゃがみ中P | 高 | |",
		"| 1 | 2 | 弱波動 | d dr r plus p_l | 波動拳(弱) | 高 | 略称から推定 |",
	}, "\n")

	steps := ParseInput(text)
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps (header/separator skipped), got %d: %+v", len(steps), steps)
	}
	if steps[0].ComboIndex != 1 || steps[0].StepOrder != 1 || steps[0].Tokens != "d plus p_m" {
		t.Fatalf("row1: %+v", steps[0])
	}
	// フィールド内の空白(トークン列)が保持される＝パイプ区切りで境界が曖昧にならない。
	if steps[1].Tokens != "d dr r plus p_l" || steps[1].NameCandidate != "波動拳(弱)" || steps[1].Note != "略称から推定" {
		t.Fatalf("row2: %+v", steps[1])
	}
}

func TestParseInput_SpaceSeparatedIsSkipped(t *testing.T) {
	// タブもパイプも無い純粋な空白区切りは区切り境界が復元不能のため 1 セル扱いになり、
	// 先頭が数字にならずスキップされる(=貼り付け不備として静かに落ちる。誤解決しない)。
	steps := ParseInput("1 1 屈中P d plus p_m しゃがみ中P 高")
	if len(steps) != 0 {
		t.Fatalf("space-separated line must be skipped, got %d: %+v", len(steps), steps)
	}
}

func TestParseInput_ShortRows(t *testing.T) {
	// 列が足りない行でも埋まっている分だけ採用する。
	steps := ParseInput(tsv("3", "2", "鎖骨"))
	if len(steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(steps))
	}
	s := steps[0]
	if s.ComboIndex != 3 || s.StepOrder != 2 || s.RawText != "鎖骨" || s.Tokens != "" {
		t.Fatalf("short row parse: %+v", s)
	}
}

// ===========================================================================
// M20-07: 多候補ハッジの分割(G-14b)
// ===========================================================================

func TestSplitHedge(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []string
	}{
		{"2 候補", "立ち中P or しゃがみ中P", []string{"立ち中P", "しゃがみ中P"}},
		{"3 候補", "A or B or C", []string{"A", "B", "C"}},
		{"大文字", "A OR B", []string{"A", "B"}},
		{"前後の空白は落とす", "  A  or  B  ", []string{"A", "B"}},
		// 不明マークは落とすが、分かっている側は候補として残す。
		{"不明マークは落とす", "立ち中P or ?", []string{"立ち中P"}},
		{"ハッジでない", "波動拳", nil},
		// ★区切りは前後に空白を伴う or だけ。技名の中の or では割らない。
		{"技名の中の or", "Order of the Sun", nil},
		{"語中の or", "corner", nil},
		// ★実データに存在する区切り候補では割らない(割ると技名を壊す)。
		{"スラッシュでは割らない", "[4]646LP/MP (SA1)", nil},
		{"中黒では割らない", "CA 真・昇龍拳", nil},
		{"読点では割らない", "立ち中P、しゃがみ中P", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SplitHedge(tt.in)
			if len(got) != len(tt.want) {
				t.Fatalf("SplitHedge(%q) = %v, want %v", tt.in, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("SplitHedge(%q)[%d] = %q, want %q", tt.in, i, got[i], tt.want[i])
				}
			}
		})
	}
}
