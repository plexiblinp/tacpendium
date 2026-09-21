package model

import "testing"

// M28-02a: 始動位置の区分表(D-730 / D-731 / D-733)。
//
// ★★本表は「開発者が実測した値」であり、計算式ではない。⇒ 値そのものを固定する。

// TestPositionBands_Boundaries は区分の境界を固定する(チェックリスト §2-1)。
//
// ★★v1.2.0 が載せていた 91〜111 / 112〜134 は開発者の入力ミスであり失効した(D-731)。
// 正しくは 91〜112 / 113〜134 である。⇒ 誤った値へ戻っていないことをここで見る。
func TestPositionBands_Boundaries(t *testing.T) {
	want := []struct {
		code             string
		min, max, repVal int
	}{
		{PositionCornerSelf, 0, 25, 12},
		{PositionCornerSelfNear, 26, 47, 36},
		{PositionMidSelf, 48, 69, 58},
		{PositionMidScreen, 70, 90, 80},
		{PositionMidOpponent, 91, 112, 102},
		{PositionCornerOpponentNear, 113, 134, 124},
		{PositionCornerOpponent, 135, 160, 148},
	}
	if len(PositionBands) != len(want) {
		t.Fatalf("区分の数 = %d, want %d", len(PositionBands), len(want))
	}
	for i, w := range want {
		b := PositionBands[i]
		if b.Code != w.code || b.MinMass != w.min || b.MaxMass != w.max || b.RepresentativeMass != w.repVal {
			t.Errorf("区分 %d = %+v, want {%s %d %d %d}", i, b, w.code, w.min, w.max, w.repVal)
		}
	}
}

// TestPositionBands_ContiguousAndSymmetric は表が構造的に正しいことを見る。
//
// ★★設計卓の検算(指示書 §2.4.1)をコードで固定する ——
// 連続しており隙間も重複も無い / 鏡像が全区分で一致する。
// ⇒ 誰かが境界を 1 つ動かしたとき、ここで捕まる。
func TestPositionBands_ContiguousAndSymmetric(t *testing.T) {
	// 連続・隙間なし・重複なし。
	if PositionBands[0].MinMass != 0 {
		t.Errorf("先頭の下限 = %d, want 0", PositionBands[0].MinMass)
	}
	if last := PositionBands[len(PositionBands)-1]; last.MaxMass != MaxPositionMass {
		t.Errorf("末尾の上限 = %d, want %d", last.MaxMass, MaxPositionMass)
	}
	total := 0
	for i, b := range PositionBands {
		if b.MinMass > b.MaxMass {
			t.Errorf("区分 %s の範囲が逆転している(%d〜%d)", b.Code, b.MinMass, b.MaxMass)
		}
		if i > 0 && b.MinMass != PositionBands[i-1].MaxMass+1 {
			t.Errorf("区分 %s の下限 = %d, want %d(隙間か重複がある)",
				b.Code, b.MinMass, PositionBands[i-1].MaxMass+1)
		}
		total += b.MaxMass - b.MinMass + 1
		// 代表値は自分の区分の中に在ること。
		if b.RepresentativeMass < b.MinMass || b.RepresentativeMass > b.MaxMass {
			t.Errorf("区分 %s の代表値 %d が範囲外(%d〜%d)", b.Code, b.RepresentativeMass, b.MinMass, b.MaxMass)
		}
	}
	if total != MaxPositionMass+1 {
		t.Errorf("区分が覆うマスの数 = %d, want %d", total, MaxPositionMass+1)
	}

	// 鏡像: mirror(x) = 160 - x。i 番目と 末尾から i 番目 が対称であること。
	n := len(PositionBands)
	for i := 0; i < n; i++ {
		a, b := PositionBands[i], PositionBands[n-1-i]
		if a.MinMass != MaxPositionMass-b.MaxMass {
			t.Errorf("鏡像が一致しない: %s の下限 %d ↔ %s の上限 %d", a.Code, a.MinMass, b.Code, b.MaxMass)
		}
		if a.RepresentativeMass != MaxPositionMass-b.RepresentativeMass {
			t.Errorf("代表値の鏡像が一致しない: %s=%d ↔ %s=%d(丸めで計算していないか)",
				a.Code, a.RepresentativeMass, b.Code, b.RepresentativeMass)
		}
	}
}

// TestPositionFromMass はマス数 → 区分の導出を固定する。境界値を重点的に見る。
func TestPositionFromMass(t *testing.T) {
	cases := []struct {
		mass int
		want string
	}{
		{0, PositionCornerSelf},
		{25, PositionCornerSelf},
		{26, PositionCornerSelfNear},
		{47, PositionCornerSelfNear},
		{48, PositionMidSelf},
		{69, PositionMidSelf},
		{70, PositionMidScreen},
		{80, PositionMidScreen},
		{90, PositionMidScreen},
		{91, PositionMidOpponent},
		{112, PositionMidOpponent},
		{113, PositionCornerOpponentNear},
		{134, PositionCornerOpponentNear},
		{135, PositionCornerOpponent},
		{160, PositionCornerOpponent},
	}
	for _, tc := range cases {
		got, ok := PositionFromMass(tc.mass)
		if !ok || got != tc.want {
			t.Errorf("PositionFromMass(%d) = (%q, %v), want (%q, true)", tc.mass, got, ok, tc.want)
		}
	}
	for _, mass := range []int{-1, 161, 1000} {
		if _, ok := PositionFromMass(mass); ok {
			t.Errorf("PositionFromMass(%d) が値域外を受け入れた", mass)
		}
	}
}

// TestRepresentativeMassOf は区分 → 代表値を固定する。
//
// ★★チェックリスト §8-4 の破壊確認に対応する ——
// 「自分画面端」を選んだら 12 が入ること。13 なら丸めで計算しており左右対称が崩れている。
func TestRepresentativeMassOf(t *testing.T) {
	if got, ok := RepresentativeMassOf(PositionCornerSelf); !ok || got != 12 {
		t.Errorf("自分画面端の代表値 = %d(ok=%v), want 12。★13 なら中央値の丸めで計算している", got, ok)
	}
	if got, ok := RepresentativeMassOf(PositionCornerOpponent); !ok || got != 148 {
		t.Errorf("相手画面端の代表値 = %d(ok=%v), want 148", got, ok)
	}
	if got, ok := RepresentativeMassOf(PositionMidScreen); !ok || got != 80 {
		t.Errorf("画面中央の代表値 = %d(ok=%v), want 80(開発者の逐語と一致すること)", got, ok)
	}
	if _, ok := RepresentativeMassOf("bogus"); ok {
		t.Error("未知の区分が受け入れられた")
	}
	if _, ok := RepresentativeMassOf(""); ok {
		t.Error("空文字(不問)が区分として受け入れられた")
	}
}

// TestPositionValuesInDisplayOrder は表示順を固定する(指示書 §2.4.1)。
//
// ★★既存 5 値の間に 2 つ挿入するだけではない。末尾 2 値の順序も入れ替わっている。
func TestPositionValuesInDisplayOrder(t *testing.T) {
	want := []string{
		PositionCornerSelf,         // 自分画面端
		PositionCornerSelfNear,     // 自分画面端寄り
		PositionMidSelf,            // 自分中央寄り(新)
		PositionMidScreen,          // 画面中央
		PositionMidOpponent,        // 相手中央寄り(新)
		PositionCornerOpponentNear, // 相手画面端寄り
		PositionCornerOpponent,     // 相手画面端
	}
	got := PositionValuesInDisplayOrder()
	if len(got) != len(want) {
		t.Fatalf("値の数 = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("表示順 %d = %q, want %q", i, got[i], want[i])
		}
	}
	for _, v := range want {
		if !IsValidPosition(v) {
			t.Errorf("IsValidPosition(%q) = false", v)
		}
	}
	if IsValidPosition("bogus") || IsValidPosition("") {
		t.Error("未知の値が有効と判定された")
	}
}
