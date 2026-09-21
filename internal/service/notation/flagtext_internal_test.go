package notation

import (
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// M37-02 / B04 → M37-06: modifier flag の表示語が**全数**埋まっていること。
//
// ★★★指示書 §5-3 の破壊確認である。「一部だけ直して閉じる」を防ぐために全数を
//   回し、あわせて**逆向き**——表示語を 1 つ外すと再びフォールバックが出ること——も見る。
//   逆向きを見ないと、この検査が効いていることの証拠にならない(表示語がすべて埋まって
//   いるのか、検査が何も見ていないのかを区別できない)。
//
// ★本ファイルが `package notation`(内部テスト)なのは、`flagText` / `applyFlags` が
//   非公開だからである。resolver_test.go は `package notation_test` であり触れない。
//   ⇒ あわせて DB を立てずに済み、全数 × 2 方向を純粋関数として直接見られる。
//
// ★★★【M37-06】数が 2 つある。混ぜないこと:
//     選択肢 = 14 値 … 編集 UI が出す値
//     表示語 = 17 件 … 上記 ＋ 選択肢から外した 3 値(表示語だけ残す)

// selectableFlagValues は編集 UI の選択肢に出る flag(**14 値**・指示書 §2.2)。
// ★フロント側の写しは web/src/features/combo/labels.ts の
//
//	MODIFIER_FLAGS_COMMON(11) + MODIFIER_OD_VARIANT_FLAGS(3)。
var selectableFlagValues = []string{
	// タイミング系
	"delay", "link",
	// キャンセル系
	"first_hit_cancel", "no_cancel", "late_cancel",
	// 空中・浮かせ系
	"low_jump", "juggle_high", "juggle_low",
	// 当て方・位置系
	"whiff", "meaty", "cross_under",
	// OD ボタン組
	"od_lm", "od_mh", "od_lh",
}

// retiredFlagValues は選択肢から外したが**表示語は残す** flag(3 値・指示書 §2.3)。
//
// ★★★既存行が持っている。⇒ 表示語を消すと `{just}` のような内部識別子が画面へ戻り、
//
//	M37-02(B04)が消したフォールバックが復活する(指示書 §4.1 の「最大の危険」)。
var retiredFlagValues = []string{"just", "neutral_jump", "forward_jump"}

// allFlagTextKeys は flagText が持つべき全数(14 + 3 = 17)。
func allFlagTextKeys() []string {
	return append(append([]string{}, selectableFlagValues...), retiredFlagValues...)
}

func TestFlagText_CoversSelectableAndRetiredValues(t *testing.T) {
	want := allFlagTextKeys()

	// ★母数を先に固定する。片方だけ増えたら落ちる。
	if len(flagText) != len(want) {
		t.Fatalf("flag 数の不一致: 期待 %d 件(選択肢 %d ＋ 選択肢外 %d), flagText は %d 件",
			len(want), len(selectableFlagValues), len(retiredFlagValues), len(flagText))
	}

	for _, flag := range want {
		text, ok := flagText[flag]
		if !ok {
			t.Errorf("flag %q に表示語が無い ⇒ 画面へ内部識別子がそのまま出る", flag)
			continue
		}
		// ★波括弧そのものは残す —— B04 の要求は「生の内部識別子を出さない」ことで
		//   あって波括弧の撤去ではない(`D-867`。バッジにできない面では波括弧が
		//   修飾を示す唯一の代替である)。
		if !strings.HasPrefix(text, "{") || !strings.HasSuffix(text, "}") {
			t.Errorf("flag %q の表示語が波括弧で囲まれていない: %q", flag, text)
		}
		if strings.Contains(text, flag) {
			t.Errorf("flag %q の表示語が内部識別子を含んでいる: %q", flag, text)
		}
	}
}

// TestFlagText_LowJumpWordIsLowAir は表示語の変更 1 件(指示書 §2.2)を固定する。
// ★コードは `low_jump` のまま。変えるのは表示語だけである(CHANGE-057)。
func TestFlagText_LowJumpWordIsLowAir(t *testing.T) {
	if got, want := flagText["low_jump"], "{低空}"; got != want {
		t.Errorf("low_jump の表示語: got %q, want %q", got, want)
	}
}

// TestApplyFlags_NoInternalIdentifierLeaks は applyFlags の出力を全数で見る。
func TestApplyFlags_NoInternalIdentifierLeaks(t *testing.T) {
	for _, flag := range allFlagTextKeys() {
		got := applyFlags("立ち弱P", &model.Modifiers{Flags: []string{flag}})

		if strings.Contains(got, "{"+flag+"}") {
			t.Errorf("flag %q が内部識別子のまま出ている: %q", flag, got)
		}
		if want := flagText[flag]; !strings.Contains(got, want) {
			t.Errorf("flag %q の表示語 %q が出ていない: %q", flag, want, got)
		}
	}
}

// TestApplyFlags_RetiredFlagsStillRender は**削除の安全性**の破壊確認(指示書 §5-4)。
//
// ★★★選択肢から外した 3 値を持つ既存行を描いて、内部識別子が出ないことを見る。
//
//	⇒ 上の全数検査と重なるように見えるが、見ているものが違う——こちらは
//	  「*選択肢から外した*値でも表示語が残っていること」を名指しで主張する。
//	  全数検査は allFlagTextKeys() の中身を変えれば黙るが、本テストは
//	  retiredFlagValues を空にしない限り黙らない。
func TestApplyFlags_RetiredFlagsStillRender(t *testing.T) {
	for _, flag := range retiredFlagValues {
		got := applyFlags("ジャンプ強K", &model.Modifiers{Flags: []string{flag}})
		if strings.Contains(got, "{"+flag+"}") {
			t.Errorf("選択肢から外した flag %q が内部識別子で出ている: %q\n"+
				"⇒ 表示語まで消している。M37-02(B04)の逆行である", flag, got)
		}
	}
}

// TestApplyFlags_MissingFlagFallsBack は**逆向きの確認**である。
//
// ★表示語を 1 つ外すと再びフォールバックが出ることを見る。⇒ 上の各本が
//
//	「本当に表示語の有無を見ている」ことの証拠になる。これが無いと、上の検査は
//	常に緑を返すだけの飾りかもしれない。
//
// ★★★選択肢の値(od_lm)と**選択肢から外した値(just)の両方**で見る。
//
//	§5-4 が「表示語を消すと出ることも確かめる」を retired 側について求めている。
//
// ★★本テストはパッケージ変数 flagText を一時的に壊す。⇒ このパッケージのテストを
//
//	t.Parallel() で並列化しないこと(現在 internal/service/notation に t.Parallel は 0 件)。
//	並列化すると他のテストが壊れた状態の flagText を読み、静かに落ちる。
func TestApplyFlags_MissingFlagFallsBack(t *testing.T) {
	for _, victim := range []string{"od_lm", "just"} {
		t.Run(victim, func(t *testing.T) {
			saved, ok := flagText[victim]
			if !ok {
				t.Fatalf("前提が崩れた: flagText に %q が無い", victim)
			}
			delete(flagText, victim)
			t.Cleanup(func() { flagText[victim] = saved })

			got := applyFlags("立ち弱P", &model.Modifiers{Flags: []string{victim}})
			if !strings.Contains(got, "{"+victim+"}") {
				t.Errorf("表示語を外してもフォールバックが出ない: %q\n"+
					"⇒ 上の全数検査は何も見ていない可能性がある", got)
			}
		})
	}
}

// TestApplyFlags_LinkAndNoCancelAreNotExclusive は指示書 §5-5。
//
// ★★`link`(難易度の注記)と `no_cancel`(接続の事実)は別の要素であり、両方が付く行が
//
//	ありうる(指示書 §0.3。設計卓が「同じものではないか」と疑い開発者が否定した＝D-873)。
//	⇒ 排他にしていないこと・両方描かれることを固定する。
func TestApplyFlags_LinkAndNoCancelAreNotExclusive(t *testing.T) {
	got := applyFlags("中P", &model.Modifiers{Flags: []string{"link", "no_cancel"}})

	for _, want := range []string{"{目押し}", "{ノーキャン}"} {
		if !strings.Contains(got, want) {
			t.Errorf("%q が出ていない: %q", want, got)
		}
	}
}
