package combo

import (
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
)

// M37-05: 補完の半分(representativeMassFor)と PATCH 用の補完
// (fillStartPositionMassForPatch)の単体試験。
//
// ★★★in-package テストである —— 両関数は非公開であり、外からは
//   「補完が効いた/効かなかった」の結果しか見えない。★A-4 が求める
//   「補完を外すと NULL のまま」の対照は、ここで直接押さえるのが最も確実である。

// TestRepresentativeMassFor_OnlyFillsWhenBandIsKnown は「埋めない 3 通り」を固定する。
//
// ★★★埋めてしまうと不変条件の逆向き(NULL ⇔ 不問)が壊れる ——
//
//	不問の行にマス数が入ると「不問なのに位置が分かっている」行ができる。
func TestRepresentativeMassFor_OnlyFillsWhenBandIsKnown(t *testing.T) {
	band := "mid_screen"
	unknown := "no_such_band"
	existing := 33

	cases := []struct {
		name     string
		position *string
		mass     *int
		want     *int
	}{
		{"区分あり・マス無し ⇒ 代表値", &band, nil, intp(80)},
		{"★不問(nil)・マス無し ⇒ 埋めない", nil, nil, nil},
		{"★マス数が既に在る ⇒ 上書きしない", &band, &existing, nil},
		{"★未知の区分 ⇒ 代表値が定義できない", &unknown, nil, nil},
		{"★不問 ＋ マス数あり ⇒ 触らない", nil, &existing, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := representativeMassFor(tc.position, tc.mass)
			switch {
			case tc.want == nil && got != nil:
				t.Errorf("got %d, want nil", *got)
			case tc.want != nil && got == nil:
				t.Errorf("got nil, want %d", *tc.want)
			case tc.want != nil && got != nil && *got != *tc.want:
				t.Errorf("got %d, want %d", *got, *tc.want)
			}
		})
	}
}

// TestRepresentativeMassFor_CoversAllBands は 7 区分すべてで代表値が引けることを見る。
//
// ★代表値の出所は model.PositionBands の 1 本だけである(指示書 §4.5)。
//
//	⇒ ここでは表を写経せず、同じ表から期待値を作る。★3 本目を作らないための形。
func TestRepresentativeMassFor_CoversAllBands(t *testing.T) {
	if len(model.PositionBands) != 7 {
		t.Fatalf("区分の数 = %d, want 7", len(model.PositionBands))
	}
	for _, b := range model.PositionBands {
		code := b.Code
		got := representativeMassFor(&code, nil)
		if got == nil {
			t.Errorf("%s: 埋まらなかった", code)
			continue
		}
		if *got != b.RepresentativeMass {
			t.Errorf("%s: got %d, want %d", code, *got, b.RepresentativeMass)
		}
	}
}

// TestFillStartPositionMassForPatch_ResolvesUpdatedValue は「更新後のマス数」の
// 決め方 3 通り(present+値 / present+nil / キー不在)を固定する(指示書 §2.2-1)。
//
// ★★★position は 1 バイトも触らない。⇒ UpdateMetadataInput には Position 欄が
//
//	そもそも無いため構造的に不可能だが、carry を触らないことは本テストが押さえる。
func TestFillStartPositionMassForPatch_ResolvesUpdatedValue(t *testing.T) {
	band := "corner_self" // 代表値 12
	cases := []struct {
		name        string
		currentMass *int
		currentPos  *string
		input       comborepo.Optional[int]
		wantPresent bool
		wantValue   *int
	}{
		{"present+値 ⇒ 触らない", intp(99), &band, comborepo.Some(5), true, intp(5)},
		{"present+nil(明示クリア) ⇒ 代表値", intp(99), &band, comborepo.Null[int](), true, intp(12)},
		{"キー不在 ＋ DB が NULL ⇒ 代表値", nil, &band, comborepo.Optional[int]{}, true, intp(12)},
		{"キー不在 ＋ DB に値あり ⇒ 触らない", intp(99), &band, comborepo.Optional[int]{}, false, nil},
		{"★不問 ＋ 明示クリア ⇒ NULL のまま", intp(99), nil, comborepo.Null[int](), true, nil},
		{"★不問 ＋ キー不在 ⇒ 触らない", nil, nil, comborepo.Optional[int]{}, false, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			current := &model.Combo{Position: tc.currentPos, StartPositionMass: tc.currentMass}
			input := UpdateMetadataInput{StartPositionMass: tc.input}
			fillStartPositionMassForPatch(current, &input)

			if input.StartPositionMass.Present != tc.wantPresent {
				t.Errorf("Present = %v, want %v", input.StartPositionMass.Present, tc.wantPresent)
			}
			got := input.StartPositionMass.Value
			switch {
			case tc.wantValue == nil && got != nil:
				t.Errorf("Value = %d, want nil", *got)
			case tc.wantValue != nil && got == nil:
				t.Errorf("Value = nil, want %d", *tc.wantValue)
			case tc.wantValue != nil && got != nil && *got != *tc.wantValue:
				t.Errorf("Value = %d, want %d", *got, *tc.wantValue)
			}
			// ★current を書き換えていないこと(読み取り専用の引数である)。
			if current.Position != tc.currentPos {
				t.Errorf("current.Position を書き換えた")
			}
		})
	}
}

// TestFillStartPositionMassForPatch_NeverTouchesCarry は運び量に手を出さないことを
// 関数のレベルで固定する(指示書 §0.5 / §4.3・チェックリスト C-1)。
//
// ★★運び量は区分を持たない(D-731 不変条件 2)。⇒ 代表値という概念が存在しない。
//
//	★「2 欄あるから両方そろえよう」と考えたら、それは誤りである。
func TestFillStartPositionMassForPatch_NeverTouchesCarry(t *testing.T) {
	band := "mid_screen"
	current := &model.Combo{Position: &band, StartPositionMass: nil, CarryDistanceMass: nil}

	for _, in := range []comborepo.Optional[int]{
		{},                    // キー不在
		comborepo.Null[int](), // 明示クリア
		comborepo.Some(7),     // 値あり
	} {
		input := UpdateMetadataInput{CarryDistanceMass: in}
		fillStartPositionMassForPatch(current, &input)
		if input.CarryDistanceMass.Present != in.Present {
			t.Errorf("CarryDistanceMass.Present が変わった: %v → %v", in.Present, input.CarryDistanceMass.Present)
		}
		if input.CarryDistanceMass.Value != in.Value {
			t.Errorf("CarryDistanceMass.Value が変わった")
		}
	}
}

func intp(n int) *int { return &n }
