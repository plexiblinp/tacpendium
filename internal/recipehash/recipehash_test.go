package recipehash

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ★内部テストパッケージ(package recipehash)にしてある。
// 計算の本体(calc / step / canonicalModifiersJSON / emptyHash)を公開せずに
// golden 主張を書くためである。公開されているのは CalcCombo / CalcSetup の 2 本だけで、
// それ以外を公開すると 2 つの入口を経由しない 3 つ目の呼び元が生えうる。

// 本ファイルの golden 値は、統合前に存在した 3 実装
//
//	internal/service/combo.CalcRecipeHash
//	internal/service/setup.CalcSetupRecipeHash
//	internal/repository/setup.calcSetupRecipeHashFromSteps
//
// を M24-09b の着手時(commit 210ab49)にそのまま実行して採取した実測値である
// (3 実装は下記 9 クラスすべてで一致していた。指示書 §3.3-5 / §4.5 手順 1)。
//
// ★したがって本ファイルが緑であることは「統合後の 1 本が、統合前の 3 実装と
// 同じ値を返す」ことの主張である。値を更新してはならない —— 更新が要るのは
// recipe_hash の定義そのものを変えるときだけであり、それは VAL-C02 の判定結果が
// 変わる契約の変更である(指示書 §9.4-3)。
const (
	goldenEmpty       = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	goldenSingle      = "b62d366e425f8cdff7dadb8ed0ab2f78c991e3d071b9db9f005b1ac01fac7558"
	goldenNullMove    = "9093792ad91b3e9635903979e299021423dbc6d7b0eaafb89d7a74d058156335"
	goldenTwoSteps    = "f63230348f0164d8ba030f56036a3abc6d212016e8f59b34497a544e5a7a02f1"
	goldenModFlags    = "697ba70672258d15d3d2cf9f263762205046bdc364fd9a6d15676209a78f1ef3"
	goldenModEmpty    = "afa0a503af9f8c418edc1ece1c562ed83ff18da31f9415bf6e45f5d0f01a2beb"
	goldenCanonicalJS = `{"flags":["a","b"],"type":"t","notes":"n"}`
)

func mid(v int64) *int64 { return &v }

func modFlags(flags ...string) *model.Modifiers {
	return &model.Modifiers{Flags: flags, Type: "t", Notes: "n"}
}

// TestEmptyHash_EqualsSHA256OfEmptyString は定数 emptyHash が実際に sha256("") であることを
// 固定する。定数にした代償(計算で導出しない)をここで埋める。
func TestEmptyHash_EqualsSHA256OfEmptyString(t *testing.T) {
	sum := sha256.Sum256([]byte(""))
	want := hex.EncodeToString(sum[:])
	if emptyHash != want {
		t.Errorf("emptyHash = %s, want %s (= sha256(\"\"))", emptyHash, want)
	}
	if emptyHash != goldenEmpty {
		t.Errorf("emptyHash = %s, want %s (統合前の 3 実装の実測値)", emptyHash, goldenEmpty)
	}
}

// TestCalc_GoldenValues は統合後の 1 本が統合前の 3 実装と同じ値を返すことを主張する
// (指示書 §5.1-1)。入力は空レシピ / modifier あり / modifier の順序違いを含む。
func TestCalc_GoldenValues(t *testing.T) {
	cases := []struct {
		name  string
		steps []step
		want  string
	}{
		{"nil", nil, goldenEmpty},
		{"空スライス", []step{}, goldenEmpty},
		{"単一ステップ", []step{{StepOrder: 1, MoveID: mid(11)}}, goldenSingle},
		{"move_id が NULL", []step{{StepOrder: 1, MoveID: nil}}, goldenNullMove},
		{
			"2 ステップ(step_order 昇順)",
			[]step{{StepOrder: 1, MoveID: mid(11)}, {StepOrder: 2, MoveID: mid(7)}},
			goldenTwoSteps,
		},
		{
			"2 ステップ(入力が逆順でも同じ)",
			[]step{{StepOrder: 2, MoveID: mid(7)}, {StepOrder: 1, MoveID: mid(11)}},
			goldenTwoSteps,
		},
		{
			"modifier flags 昇順",
			[]step{{StepOrder: 1, MoveID: mid(11), Modifiers: modFlags("a", "b")}},
			goldenModFlags,
		},
		{
			"modifier flags 降順(順序違いでも同じ)",
			[]step{{StepOrder: 1, MoveID: mid(11), Modifiers: modFlags("b", "a")}},
			goldenModFlags,
		},
		{
			"modifier 空 struct",
			[]step{{StepOrder: 1, MoveID: mid(11), Modifiers: &model.Modifiers{}}},
			goldenModEmpty,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := calc(tc.steps); got != tc.want {
				t.Errorf("calc(%s) = %s, want %s (統合前の 3 実装の実測値)", tc.name, got, tc.want)
			}
		})
	}
}

// TestCanonicalModifiersJSON_Golden は正規化 JSON が統合前と同じであることを主張する
// (指示書 §5.1-2)。
func TestCanonicalModifiersJSON_Golden(t *testing.T) {
	if got := canonicalModifiersJSON(nil); got != "null" {
		t.Errorf("canonicalModifiersJSON(nil) = %q, want %q", got, "null")
	}
	// flags は入力順に関わらず昇順で出る。
	for _, in := range [][]string{{"a", "b"}, {"b", "a"}} {
		if got := canonicalModifiersJSON(modFlags(in...)); got != goldenCanonicalJS {
			t.Errorf("canonicalModifiersJSON(%v) = %s, want %s", in, got, goldenCanonicalJS)
		}
	}
}

// TestCalcCombo_And_CalcSetup_AgreeWithCalc は、公開している 2 つの入口が
// 同じレシピに対して同じ値を出すことを主張する。
//
// ★統合前は 3 実装が独立しており、片方だけ変えてもコンパイルが通った(M23-05 実測)。
// 本テストはその「型検査が守ってくれない」部分を埋める。
func TestCalcCombo_And_CalcSetup_AgreeWithCalc(t *testing.T) {
	cases := []struct {
		name  string
		combo []model.ComboStep
		setup []model.SetupStep
		want  string
	}{
		{"nil", nil, nil, goldenEmpty},
		{"空スライス", []model.ComboStep{}, []model.SetupStep{}, goldenEmpty},
		{
			"単一ステップ",
			[]model.ComboStep{{StepOrder: 1, MoveID: mid(11)}},
			[]model.SetupStep{{StepOrder: 1, MoveID: mid(11)}},
			goldenSingle,
		},
		{
			"move_id が NULL",
			[]model.ComboStep{{StepOrder: 1, MoveID: nil}},
			[]model.SetupStep{{StepOrder: 1, MoveID: nil}},
			goldenNullMove,
		},
		{
			"2 ステップ(入力が逆順)",
			[]model.ComboStep{{StepOrder: 2, MoveID: mid(7)}, {StepOrder: 1, MoveID: mid(11)}},
			[]model.SetupStep{{StepOrder: 2, MoveID: mid(7)}, {StepOrder: 1, MoveID: mid(11)}},
			goldenTwoSteps,
		},
		{
			"modifier flags 降順",
			[]model.ComboStep{{StepOrder: 1, MoveID: mid(11), Modifiers: modFlags("b", "a")}},
			[]model.SetupStep{{StepOrder: 1, MoveID: mid(11), Modifiers: modFlags("b", "a")}},
			goldenModFlags,
		},
		{
			"modifier 空 struct",
			[]model.ComboStep{{StepOrder: 1, MoveID: mid(11), Modifiers: &model.Modifiers{}}},
			[]model.SetupStep{{StepOrder: 1, MoveID: mid(11), Modifiers: &model.Modifiers{}}},
			goldenModEmpty,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotCombo := CalcCombo(tc.combo)
			gotSetup := CalcSetup(tc.setup)
			if gotCombo != tc.want {
				t.Errorf("CalcCombo = %s, want %s", gotCombo, tc.want)
			}
			if gotSetup != tc.want {
				t.Errorf("CalcSetup = %s, want %s", gotSetup, tc.want)
			}
			if gotCombo != gotSetup {
				t.Errorf("CalcCombo(%s) と CalcSetup(%s) が食い違った", gotCombo, gotSetup)
			}
		})
	}
}

// TestCalc_DoesNotMutateInput は入力スライス・Flags を破壊しないことを主張する。
//
// ★統合前の 3 実装はいずれもコピーしてからソートしていた。統合で失われていないことを固定する。
func TestCalc_DoesNotMutateInput(t *testing.T) {
	steps := []step{
		{StepOrder: 2, MoveID: mid(7)},
		{StepOrder: 1, MoveID: mid(11), Modifiers: modFlags("b", "a")},
	}
	_ = calc(steps)

	if steps[0].StepOrder != 2 || steps[1].StepOrder != 1 {
		t.Errorf("入力スライスの順序が破壊された: %d, %d", steps[0].StepOrder, steps[1].StepOrder)
	}
	if got := steps[1].Modifiers.Flags; got[0] != "b" || got[1] != "a" {
		t.Errorf("入力 Flags が破壊された: %v", got)
	}
}

// TestCalc_DifferentRecipes_DifferentHashes は異なるレシピが衝突しないことを主張する。
// ★これが破れると VAL-C02 が「別物を重複と判定する」方向へ壊れる。
func TestCalc_DifferentRecipes_DifferentHashes(t *testing.T) {
	a := calc([]step{{StepOrder: 1, MoveID: mid(11)}})
	b := calc([]step{{StepOrder: 1, MoveID: mid(12)}})
	if a == b {
		t.Errorf("異なる move_id が同じハッシュになった: %s", a)
	}

	// modifiers 無しと空 struct は別物として扱う(統合前からの挙動)。
	noMod := calc([]step{{StepOrder: 1, MoveID: mid(11)}})
	emptyMod := calc([]step{{StepOrder: 1, MoveID: mid(11), Modifiers: &model.Modifiers{}}})
	if noMod == emptyMod {
		t.Errorf("modifiers nil と空 struct が同じハッシュになった: %s", noMod)
	}
}
