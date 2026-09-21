package model

// 始動位置の区分と 160 マスの物差し(M28-02a・D-730 / D-731 / D-733)。
//
// ★★物差しはトレーニングモードの床のマスである(0〜160)。
// 開発者の逐語: 「スト6の画面は 160 マスをベースに感覚を記載する。(トレーニングモードの床のマス)」
//
// ★★保存する正本はマス数 1 本である。区分(combos.position)はマス数から導出できるが、
// 列としても残している —— 重複判定キーに使われており、6 か所の SQL 述語が直接比較するためである
// (DES-006 §2.3)。⇒ 2 つは常に整合させる。整合の規則は combo サービス層が持つ。

// PositionBand は始動位置の 1 区分。
type PositionBand struct {
	// Code は combos.position に入る値。
	Code string
	// MinMass / MaxMass は区分の範囲(両端含む)。
	MinMass int
	MaxMass int
	// RepresentativeMass は「区分を選んだとき」に入るマス数。
	//
	// ★★中央値を計算して丸める形にしないこと(指示書 §2.4.2)。
	// 四捨五入・切り捨て・切り上げはいずれも左右対称にならない
	// 〔例: 四捨五入だと 12.5 → 13 と 147.5 → 148 で、160 - 13 = 147 ≠ 148〕。
	// 対称になるのは half-even だけである。⇒ 7 個しかないので直書きする。
	// 丸め規則を実装するより確実で、説明も要らない。
	RepresentativeMass int
}

// MaxPositionMass は物差しの上限(トレーニングモードの床のマス)。
const MaxPositionMass = 160

// PositionBands は始動位置の 7 区分を表示順に並べたもの(D-731 / D-733)。
//
// ★★本スライスの順序が表示順の正本である。フロント側の web/src/constants/position.ts と
// 1 対 1 で対応させること(CLAUDE.md §4 の列挙定数同期)。
//
// ★★並びは「不問」を先頭に置いた 8 値である。不問は値を持たない(NULL / 空文字)ため
// 本スライスには含まれない ——
// 不問 / 自分画面端 / 自分画面端寄り / 自分中央寄り / 画面中央 / 相手中央寄り / 相手画面端寄り / 相手画面端
//
// ★★これは既存 5 値の間に 2 つ挿入するだけの変更ではない。末尾 2 値の順序も入れ替わる
// (旧: corner_opponent, corner_opponent_near → 新: corner_opponent_near, corner_opponent)。
//
// ★区分は連続しており隙間も重複も無い(26+22+22+21+22+22+26 = 161 = 0〜160 の値の数)。
// ★鏡像も全区分で一致する(mirror(x) = 160 - x)。
var PositionBands = []PositionBand{
	{Code: PositionCornerSelf, MinMass: 0, MaxMass: 25, RepresentativeMass: 12},
	{Code: PositionCornerSelfNear, MinMass: 26, MaxMass: 47, RepresentativeMass: 36},
	{Code: PositionMidSelf, MinMass: 48, MaxMass: 69, RepresentativeMass: 58},
	{Code: PositionMidScreen, MinMass: 70, MaxMass: 90, RepresentativeMass: 80},
	{Code: PositionMidOpponent, MinMass: 91, MaxMass: 112, RepresentativeMass: 102},
	{Code: PositionCornerOpponentNear, MinMass: 113, MaxMass: 134, RepresentativeMass: 124},
	{Code: PositionCornerOpponent, MinMass: 135, MaxMass: 160, RepresentativeMass: 148},
}

// PositionValuesInDisplayOrder は position の取り得る値を表示順で返す。
func PositionValuesInDisplayOrder() []string {
	out := make([]string, 0, len(PositionBands))
	for _, b := range PositionBands {
		out = append(out, b.Code)
	}
	return out
}

// IsValidPosition は code が既知の区分かを返す。
func IsValidPosition(code string) bool {
	for _, b := range PositionBands {
		if b.Code == code {
			return true
		}
	}
	return false
}

// PositionFromMass はマス数から区分を導出する。値域外なら false を返す。
func PositionFromMass(mass int) (string, bool) {
	for _, b := range PositionBands {
		if mass >= b.MinMass && mass <= b.MaxMass {
			return b.Code, true
		}
	}
	return "", false
}

// RepresentativeMassOf は区分の代表値を返す。未知の区分なら false を返す。
func RepresentativeMassOf(position string) (int, bool) {
	for _, b := range PositionBands {
		if b.Code == position {
			return b.RepresentativeMass, true
		}
	}
	return 0, false
}
