package csvcore

import (
	"fmt"
	"strconv"
)

// 厳密スカラパーサ。エクスポートが書く正準形だけを受理し、黙った型強制(+5→5 等)を
// 防ぐ。export(encode)側のフォーマットと対称になるよう実装している。

// parseBool は CSV セルを bool として厳密に解釈する。
// 受理するのは "true" / "false" / 空("" = false)のみ。
func parseBool(s string) (bool, error) {
	switch s {
	case "true":
		return true, nil
	case "false", "":
		return false, nil
	default:
		return false, fmt.Errorf("invalid bool %q (want true/false/empty)", s)
	}
}

// parseBoolPtr は nullable bool を解釈する。空="" は nil(NULL)、"true"/"false" は明示値。
// 起き攻め 6 列で nil/false を区別するために使う(M13-01)。
func parseBoolPtr(s string) (*bool, error) {
	switch s {
	case "":
		return nil, nil
	case "true":
		v := true
		return &v, nil
	case "false":
		v := false
		return &v, nil
	default:
		return nil, fmt.Errorf("invalid bool %q (want true/false/empty)", s)
	}
}

// parseIntPtr は非空セル s を *int へ厳密に解釈する(空判定は呼び出し側)。
// 正準形(strconv.Itoa と一致する表記)のみ受理する。
func parseIntPtr(s string) (*int, error) {
	n, err := strconv.Atoi(s)
	if err != nil {
		return nil, fmt.Errorf("invalid integer %q", s)
	}
	if strconv.Itoa(n) != s {
		return nil, fmt.Errorf("non-canonical integer %q (want %q)", s, strconv.Itoa(n))
	}
	return &n, nil
}

// parseFloatPtr は非空セル s を *float64 へ厳密に解釈する(空判定は呼び出し側)。
// 正準形(strconv.FormatFloat(n,'f',-1,64) と一致する表記)のみ受理し、"2.0"/"+2"/
// "1e3" 等の非正準形は弾く(再 export で表記が化けて静かな書き換えになるのを防ぐ)。
// drive_damage(REAL・小数)用(M13-01)。
func parseFloatPtr(s string) (*float64, error) {
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid number %q", s)
	}
	if canon := strconv.FormatFloat(n, 'f', -1, 64); canon != s {
		return nil, fmt.Errorf("non-canonical number %q (want %q)", s, canon)
	}
	return &n, nil
}

// ── encode 側ヘルパ(export)──────────────────────────────────────────

func boolToStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// boolPtrToStr は nil → ""、それ以外を "true"/"false" へ。
func boolPtrToStr(p *bool) string {
	if p == nil {
		return ""
	}
	return boolToStr(*p)
}

func intPtrToStr(p *int) string {
	if p == nil {
		return ""
	}
	return strconv.Itoa(*p)
}

// floatPtrToStr は nil → ""、それ以外を小数最短表記('f', -1)へ(2→"2", 2.5→"2.5", -6→"-6")。
func floatPtrToStr(p *float64) string {
	if p == nil {
		return ""
	}
	return strconv.FormatFloat(*p, 'f', -1, 64)
}
