package csvcore

// VAL-I10(CSV 式注入無害化・DES-006 §6 / CHANGE-050)。
//
// 表計算ソフトは先頭が = + - @ のセルを式(数式/DDE)として解釈しうる。再 export
// する CSV が Excel/Sheets で開かれても式評価されないよう、自由文セルの先頭が危険
// 文字のとき ' を付して無害化する。import は対称的に剥がすため往復は同一性を保つ。
//
// 適用範囲は **トップレベルの自由文セル(memo)のみ**。理由:
//   - character_code/enum/数値は値域が制御され、危険文字始まりにならない(数値の
//     先頭 "-" は表計算では数値扱いで式でないが、念のため自由文に限定して数値往復を壊さない)。
//   - tags/recipe/situation はセルが JSON("["/"{")始まりのため、セル全体が式評価されない。
//
// 注意: ユーザが意図的に先頭 ' を含む自由文を入力した稀なケースで、import 側の
// 剥がし(危険文字が続く ' のみ剥がす)により 1 文字失われうる。実害は軽微。

var csvFormulaTriggers = [...]byte{'=', '+', '-', '@'}

func isFormulaTrigger(b byte) bool {
	for _, t := range csvFormulaTriggers {
		if b == t {
			return true
		}
	}
	return false
}

// sanitizeFreeText は s の先頭が式トリガ文字なら ' を前置して無害化する(export 時)。
func sanitizeFreeText(s string) string {
	if s == "" {
		return s
	}
	if isFormulaTrigger(s[0]) {
		return "'" + s
	}
	return s
}

// desanitizeFreeText は sanitizeFreeText を打ち消す(import 時)。
// 先頭が ' で、かつその次が式トリガ文字のときのみ ' を 1 個剥がす。これにより
// export(危険時のみ ' 付与)と対称になり、危険でない自由文は無改変で往復する。
func desanitizeFreeText(s string) string {
	if len(s) >= 2 && s[0] == '\'' && isFormulaTrigger(s[1]) {
		return s[1:]
	}
	return s
}
