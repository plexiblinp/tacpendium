package auth

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// パスワードの検査(DES-006 VAL-N05 / VAL-N06。CHANGE-119 が採番した)。
//
// ★★検査は「決めるとき」だけに掛ける。照合には掛けない(M22-08 §4.1-2)。
// 掛けると、既に非 ASCII や短いパスワードで決めた利用者が入れなくなり、しかも
// 変更もできなくなる(変更は現在のパスワードを要求するため)。⇒ 詰みが生まれる。
// これは移行の都合ではなく恒久の規則である——検査の内容を将来変えたときも同じ問題が起きる。
const (
	// PasswordMinLength は前後の空白を除去したあとの最小文字数(VAL-N06)。
	//
	// ★目的は「打ち間違いで空に近い値が通るのを防ぐ」ことであり、強度ではない
	// (REQ-001 FR501「簡易的なログイン」/ DES-002 §10 NFR102「過剰でない対策」)。
	PasswordMinLength = 4
	// PasswordMaxLength は同じく最大文字数(VAL-N06)。
	//
	// ★上限は鍵導出の反復コストには効かない(PBKDF2 は HMAC の鍵正規化で長い鍵を
	// 1 度ハッシュしてから反復するため)。効くのはメモリと帯域である。
	PasswordMaxLength = 128

	// passwordRuneMin / passwordRuneMax は受け付ける文字の範囲(VAL-N05)。
	// 印字可能な ASCII のみ。★半角スペース(U+0020)を含む——合い言葉の形を残すため。
	passwordRuneMin = 0x20
	passwordRuneMax = 0x7E
)

// エラー。呼出側(ハンドラ)が拒否の理由を区別するためだけに持つ。
var (
	// ErrPasswordCharset は印字可能な ASCII 以外の文字を含むことを表す(VAL-N05)。
	ErrPasswordCharset = errors.New("auth: password contains characters outside printable ASCII")
	// ErrPasswordLength は前後の空白を除去した長さが範囲外であることを表す(VAL-N06)。
	ErrPasswordLength = errors.New("auth: password length is out of range")
)

// NormalizePassword は前後の空白を除去する。
//
// ★「決めるとき」と「入れるとき」の両方に掛ける(M22-08 §4.1-5)。理由は IME の
// 確定操作で末尾に空白が入っても、マスク表示では気づけないためである。
//
// ★受け入れた代償: 前後に空白を含む既存のパスワードは使えなくなる。意図して空白で
// 囲んだ場合にだけ起きるため確率は極めて低く、復旧経路も在る(config.toml の
// [security] から有効化フラグと検証子の 2 行とも消す＝D-407)。
//
// ★strings.TrimSpace は Unicode の空白の定義を持つため、全角スペース(U+3000)も落ちる。
// 自前で書かない(M22-08 §4.6＝D-410)。
func NormalizePassword(password string) string {
	return strings.TrimSpace(password)
}

// validateNewPassword は「これから決めるパスワード」を検査する。
//
// ★★照合へ適用しないこと(M22-08 §4.1-2＝最重要ゲート 1)。Login の照合や
// SetPassword の current 引数へ掛けると、既に決めてある値が検査を通らない利用者が
// 入れなくなり、変更もできなくなる。
//
// 引数は NormalizePassword 済みであることを前提とする。
// ★戻り値へ入力値を載せない(SUPP-001 §5.6。パスワードはログにも応答にも出さない)。
func validateNewPassword(next string) error {
	// 文字種を先に見る(VAL-N05)。
	// ★strings.IndexFunc が rune へのデコードと多バイト境界の扱いを持つ。
	// バイト列を自前で走査しない(M22-08 §4.6-4)。
	if strings.IndexFunc(next, isOutsidePrintableASCII) >= 0 {
		return ErrPasswordCharset
	}
	// 長さ(VAL-N06)。★「文字数」で数える。ここまで来れば 1 文字 = 1 バイトだが、
	// 検査の順序が入れ替わってもバイト数に化けないよう rune 数で数える。
	if n := utf8.RuneCountInString(next); n < PasswordMinLength || n > PasswordMaxLength {
		return ErrPasswordLength
	}
	return nil
}

// isOutsidePrintableASCII は印字可能な ASCII(U+0020〜U+007E)の外かを返す。
func isOutsidePrintableASCII(r rune) bool {
	return r < passwordRuneMin || r > passwordRuneMax
}
