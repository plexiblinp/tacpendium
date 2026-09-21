package intake

import (
	"regexp"
	"strconv"
	"strings"
)

// ParseInput は ① アプリ外プロンプトの出力(Markdown パイプ表)を Step 列へパースする。
//
// 列順(TOOL-002 §9.9 準拠のプロンプトが出力する形): #(コンボ番号) / step(ステップ番号) /
// 元の表記 / トークン列 / 技名の候補 / 確信度 / 備考。1 行 1 ステップ。
//
// 区切りは行ごとに自動判定する: タブがあればタブ、無ければパイプ `|`(Markdown 表)。
// AI チャットのコピーではタブが空白へ潰れやすく、フィールド内にも空白を含む(例 "d plus p_l")
// ため、空白区切りは復元不能。LLM が安定生成し区切りが曖昧にならないパイプ表を主形式とする。
//
// 寛容にパースする(貼り付け前提のため):
//   - 空行・空白のみの行はスキップ。
//   - 先頭列が整数でない行(ヘッダ `| # | … |`・区切り線 `|---|---|`・前置き/後書き)はスキップ。
//   - 各セルの前後空白と、トークン/技名を囲む可能性のあるバッククォートを剥がす。
//   - 列が足りない行は、埋まっている列だけ採用する。
func ParseInput(text string) []Step {
	var steps []Step
	for rawLine := range strings.SplitSeq(text, "\n") {
		line := strings.TrimRight(rawLine, "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		cols := splitRow(line)
		for i := range cols {
			cols[i] = strings.TrimSpace(cols[i])
		}

		comboIdx, err := strconv.Atoi(cols[0])
		if err != nil {
			// ヘッダ行・区切り線・散文はスキップ(先頭が # 番号でない行は照合対象にしない)。
			continue
		}

		s := Step{ComboIndex: comboIdx}
		if len(cols) > 1 {
			s.StepOrder, _ = strconv.Atoi(cols[1])
		}
		if len(cols) > 2 {
			s.RawText = cols[2]
		}
		if len(cols) > 3 {
			s.Tokens = trimToken(cols[3])
		}
		if len(cols) > 4 {
			s.NameCandidate = trimToken(cols[4])
		}
		if len(cols) > 5 {
			s.Confidence = cols[5]
		}
		if len(cols) > 6 {
			s.Note = cols[6]
		}
		steps = append(steps, s)
	}
	return steps
}

// splitRow は 1 行を列へ分割する。タブがあればタブ区切り、無ければパイプ `|`(Markdown 表)。
// パイプの場合は両端の `|`(表の枠)を落としてから分割する。どちらの区切りも無い行は
// 1 セルとして返す(先頭が数字にならず後段でスキップされる)。
func splitRow(line string) []string {
	if strings.Contains(line, "\t") {
		return strings.Split(line, "\t")
	}
	t := strings.TrimSpace(line)
	if strings.Contains(t, "|") {
		return strings.Split(strings.Trim(t, "|"), "|")
	}
	return []string{line}
}

// trimToken はセル値の前後空白とバッククォートを剥がす(Markdown 由来の `...` 装飾に備える)。
func trimToken(s string) string {
	return strings.TrimSpace(strings.Trim(strings.TrimSpace(s), "`"))
}

// hedgeSeparator は多候補ハッジの区切り。前後に空白を伴う "or" だけを採る(大文字小文字は問わない)。
//
// ★区切りを実データで決めた(指示書 §4.3-3。"or" 決め打ちにしない、という要求への回答)。
// preset_aliases 全 4,184 行を走査した結果:
//
//   - " or " を含む行は 0 件 ⇒ この区切りで割っても正規の別名を壊さない。
//   - 対して "/" は 42 行・"・" は 82 行に実在する(`5/6LP+LK` / `[4]646LP/MP (SA1)` /
//     `CA 真・昇龍拳` 等)。⇒ これらを区切りに採ってはならない。技名を割ってしまう。
//   - "／" "、" "，" "," "|" "または" "もしくは" はいずれも 0 件だが、実際のハッジで
//     使われている証拠も無いため採らない(推測で区切りを増やさない)。
//
// ★空白を要求するのは、技名の中に現れる "or" を割らないため(例 "Order of the Sun")。
var hedgeSeparator = regexp.MustCompile(`(?i)\s+or\s+`)

// SplitHedge は技名候補の多候補ハッジ("A or B or C")を候補ごとに分割する(G-14b)。
// ハッジでなければ nil を返す(呼び出し側が丸ごとの照合を二度行わないため)。
//
// ★出どころは辞書ではなくアプリ外プロンプトの出力である。プロンプトは
// 「この列に『A or B』と併記しない」と指示しているが(web/src/features/intake/prompt.ts)、
// 守られないことがあり、そのとき 1 つの文字列として扱われて必ず 0 件になっていた。
//
// ★分割の結果は候補であって確定ではない。1 件に解けても確定させてはならない——
// どれが正しいかはメモの書き手しか知らない(指示書 §4.3-2)。
func SplitHedge(nameCandidate string) []string {
	parts := hedgeSeparator.Split(nameCandidate, -1)
	if len(parts) < 2 {
		return nil
	}

	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" && p != unknownMark {
			out = append(out, p)
		}
	}
	// ★残った片が 1 つでも返す。"立ち中P or ?" のように片方が不明でも、
	// 分かっている側は候補として出す値がある(丸ごとの照合は既に 0 件で終わっている)。
	if len(out) == 0 {
		return nil
	}
	return out
}
