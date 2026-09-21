package aliasnorm_test

import (
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasnorm"
)

func TestNormalize(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		// D-307 の本体。全角括弧を半角へ揃える。
		{"全角括弧", "サイコマイン（自動爆発）", "サイコマイン(自動爆発)"},
		// 同一文字列に半角と全角が混在する実データ(ingrid のソーラー系 12 行)。
		{"半角と全角の混在", "ソーラーフレア(Lv1)（前方）", "ソーラーフレア(lv1)(前方)"},
		// 全角数字(guile の 3 行)。
		{"全角数字", "ODソニッククロス１", "odソニッククロス1"},
		{"前後空白", "  波動拳  ", "波動拳"},
		{"全角空白", "　波動拳　", "波動拳"},
		{"大文字小文字", "Back Microwalk", "back microwalk"},
		{"ひらがな漢字は不変", "立ち弱P", "立ち弱p"},
		{"既に正規形なら不変", "236lp", "236lp"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := aliasnorm.Normalize(tt.in); got != tt.want {
				t.Errorf("Normalize(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// TestNormalize_IsIdempotent は 2 回掛けても結果が変わらないことを主張する。
// 索引の投入側とクエリ側で掛かる回数が食い違っても壊れないことの保証。
func TestNormalize_IsIdempotent(t *testing.T) {
	for _, s := range []string{"ソーラーフレア(Lv1)（前方）", "  Back Microwalk ", "236236P (SA1)"} {
		once := aliasnorm.Normalize(s)
		if twice := aliasnorm.Normalize(once); twice != once {
			t.Errorf("Normalize は冪等でない: %q → %q → %q", s, once, twice)
		}
	}
}

// TestNormalize_DoesNotStripDistinguishingSuffix は「採らなかった範囲」を固定する。
// ★このテストは、将来だれかが正規化を広げた瞬間に赤くなるために置いてある。
// 落とすと別の技が同一視される注記(実測: (ラッシュ) 272 組 / (単発) 24 組 / (hold) 23 組)。
func TestNormalize_DoesNotStripDistinguishingSuffix(t *testing.T) {
	pairs := []struct{ base, variant string }{
		{"しゃがみ中K", "しゃがみ中K(ラッシュ)"},
		{"214HP", "214HP(hold)"},
		{"スクトゥム", "スクトゥム(当身)"},
		{"コンドルダイブ", "コンドルダイブ(派生)"},
		{"微歩き", "微歩き(後)"},
	}
	for _, p := range pairs {
		if aliasnorm.Normalize(p.base) == aliasnorm.Normalize(p.variant) {
			t.Errorf("正規化が %q と %q を同一視した(別の技である)", p.base, p.variant)
		}
	}
}

func TestNormalizeRelaxed(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"SA1 を落とす", "236236P (SA1)", "236236p"},
		{"SA2 を落とす", "214214P (SA2)", "214214p"},
		{"SA3 を落とす", "[4]646K (SA3)", "[4]646k"},
		{"CA を落とす", "[4]646K (CA)", "[4]646k"},
		{"全角括弧の注記も落とす", "236236Ｐ（ＳＡ１）", "236236p"},
		{"注記が無ければ Normalize と同じ", "波動拳", "波動拳"},
		// ★末尾のみ。途中に現れる (SA1) 様の文字列は落とさない。
		{"末尾以外は落とさない", "236236P (SA1) 追撃", "236236p (sa1) 追撃"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := aliasnorm.NormalizeRelaxed(tt.in); got != tt.want {
				t.Errorf("NormalizeRelaxed(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// TestNormalizeRelaxed_DoesNotStripOtherSuffixes は第 2 段の対象が SA / CA に限られることを固定する。
// 広げると (ラッシュ) 等が落ちて別の技が同一視される。
func TestNormalizeRelaxed_DoesNotStripOtherSuffixes(t *testing.T) {
	for _, s := range []string{"しゃがみ中K(ラッシュ)", "214HP(hold)", "スクトゥム(当身)", "微歩き(後)", "ソーラーフレア(Lv1)"} {
		if aliasnorm.NormalizeRelaxed(s) == aliasnorm.Normalize(stripParen(s)) {
			t.Errorf("NormalizeRelaxed が %q の注記を落とした(SA / CA 以外は落とさない)", s)
		}
	}
}

// stripParen は上記テスト専用の素朴な末尾括弧除去(期待値の生成用であり、実装ではない)。
func stripParen(s string) string {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '(' {
			return s[:i]
		}
	}
	return s
}

// TestNormalizeRelaxed_CAAndSA3Collide は「第 2 段では別の技が同じキーへ落ちる」という
// 既知の事実を固定する。★これは欠陥ではなく、第 2 段の設計上の前提である。
// この組が 2 件になるからこそ、呼び出し側の「1 件のときだけ確定」が未解決へ倒す。
// 実装が「片方を選ぶ」形へ変わったら、このテストの存在意義そのものが問い直される。
func TestNormalizeRelaxed_CAAndSA3Collide(t *testing.T) {
	ca := aliasnorm.NormalizeRelaxed("[4]646K (CA)")
	sa3 := aliasnorm.NormalizeRelaxed("[4]646K (SA3)")
	if ca != sa3 {
		t.Fatalf("前提が崩れた: CA と SA3 は第 2 段で同じキーになるはず (%q vs %q)", ca, sa3)
	}
	// 第 1 段では区別されていること(だから第 1 段を先に引く意味がある)。
	if aliasnorm.Normalize("[4]646K (CA)") == aliasnorm.Normalize("[4]646K (SA3)") {
		t.Fatal("第 1 段で CA と SA3 が同一視された")
	}
}
