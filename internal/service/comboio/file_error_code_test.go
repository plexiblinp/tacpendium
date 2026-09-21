package comboio_test

// ★★M29-02 §2.1(付随): ファイルレベルのエラーが「鳴っているのに読めない」形。
//
// 行レベルの課題は `[VAL-I05] recipe: ...` の形で渡されるのに、ファイルレベルだけ
// Message を素で渡していた。フロントの formatIssue は `[CODE]` の接頭辞から
// コードを取り出して訳に当てるため、接頭辞が無いと訳に当たらない。
//
// ★★その結果、ja.json に「行数が上限を超えています」が在るのに一度も出ず、
// 画面には英語の `row count exceeds limit 1000` が出ていた。
// ★鳴ってはいた。読めなかっただけである。だからテストも lint も緑のまま通った。

import (
	"context"
	"strings"
	"testing"

	comboio "github.com/plexiblinp/tacpendium/internal/service/comboio"
	"github.com/plexiblinp/tacpendium/internal/service/comboio/csvcore"
)

// tooManyRowsCSV は行数上限を「ちょうど 1 行」超えるコンボ CSV を作る。
// ★★上限の 2 倍で試さないこと(チェックリスト §6-2)。境界で鳴るかが要点である。
func tooManyRowsCSV() string {
	var b strings.Builder
	b.WriteString(strings.Join(csvcore.CSVColumns, ",") + "\n")
	row := "c1,ryu" + strings.Repeat(",", len(csvcore.CSVColumns)-2) + "\n"
	for i := 0; i <= csvcore.DefaultMaxRows; i++ { // 上限 + 1 行
		b.WriteString(row)
	}
	return b.String()
}

func TestPreviewFileErrorCarriesValCode(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	res, err := h.io.ParsePreview(ctx, tooManyRowsCSV(), "")
	if err != nil {
		t.Fatalf("ParsePreview: %v", err)
	}
	if res.ComboFileError == "" {
		t.Fatal("★行数上限を超えたのにファイルエラーが出ていない")
	}
	// ★★これが本テストの核心。コードが載っていないと画面で訳せない。
	if !strings.HasPrefix(res.ComboFileError, "[VAL-I03]") {
		t.Fatalf("ファイルエラーに VAL コードが載っていない: %q", res.ComboFileError)
	}
}

func TestPreviewAtExactRowLimitIsAccepted(t *testing.T) {
	// ★★境界の反対側。ちょうど上限は通らなければならない。
	//   ここで弾くと、いままで通っていた入力が通らなくなる(指示書 §0.2)。
	h := newHarness(t)
	ctx := context.Background()

	var b strings.Builder
	b.WriteString(strings.Join(csvcore.CSVColumns, ",") + "\n")
	row := "c1,ryu" + strings.Repeat(",", len(csvcore.CSVColumns)-2) + "\n"
	for i := 0; i < csvcore.DefaultMaxRows; i++ { // ちょうど上限
		b.WriteString(row)
	}

	res, err := h.io.ParsePreview(ctx, b.String(), "")
	if err != nil {
		t.Fatalf("ParsePreview: %v", err)
	}
	if res.ComboFileError != "" {
		t.Fatalf("★ちょうど上限で弾いている(1 行も超えていない): %q", res.ComboFileError)
	}
}

func TestCommitFileErrorCarriesValCode(t *testing.T) {
	// ★確定側もプレビューと同じ形で返す。同じ拒否理由が経路によって
	//   別の文字列になる状態を作らない。
	h := newHarness(t)
	ctx := context.Background()

	_, err := h.io.Commit(ctx, tooManyRowsCSV(), "", []string{"c1"}, comboio.DupSkip, 1)
	if err == nil {
		t.Fatal("★行数上限を超えたのに確定が通っている")
	}
	if !strings.Contains(err.Error(), "[VAL-I03]") {
		t.Fatalf("確定のエラーに VAL コードが載っていない: %v", err)
	}
}
