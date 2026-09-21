package auth

import (
	"errors"
	"strings"
	"testing"
)

// TestNormalizePassword は前後の空白の除去を固定する(M22-08 §4.1-5)。
func TestNormalizePassword(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"変化なし", "plain", "plain"},
		{"半角の前後空白", "  plain  ", "plain"},
		{"タブと改行", "\tplain\n", "plain"},
		// ★全角スペース(U+3000)も Unicode の空白として落ちる。
		//   strings.TrimSpace が定義を持つため自前で列挙しない(§4.6)。
		{"全角スペース", "　plain　", "plain"},
		{"内側の空白は残す", "  open the gate  ", "open the gate"},
		{"空白だけ", "   ", ""},
		{"空文字", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := NormalizePassword(tc.in); got != tc.want {
				t.Errorf("NormalizePassword(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestValidateNewPassword_Charset は VAL-N05 を固定する。
func TestValidateNewPassword_Charset(t *testing.T) {
	rejected := []struct {
		name string
		in   string
	}{
		{"ひらがな", "ぱすわーど"},
		{"漢字", "合言葉です"},
		{"全角英数", "ＡＢＣ１２３"},
		{"全角スペースを内側に含む", "abc　def"},
		{"絵文字", "pass\U0001F600word"},
		{"制御文字(U+001F)", "password"},
		{"DEL(U+007F)", "password"},
		{"アクセント付きラテン", "pässword"},
	}
	for _, tc := range rejected {
		t.Run("拒否/"+tc.name, func(t *testing.T) {
			if err := validateNewPassword(tc.in); !errors.Is(err, ErrPasswordCharset) {
				t.Errorf("validateNewPassword(%q) = %v, want ErrPasswordCharset", tc.in, err)
			}
		})
	}

	accepted := []struct {
		name string
		in   string
	}{
		{"英数", "password123"},
		{"記号", `p@ssw0rd!"#$%&'()*+,-./:;<=>?[\]^_{|}~`},
		// ★半角スペースは受け付ける(合い言葉の形を残すため＝§4.1-3)。
		{"内側の半角スペース", "open the gate"},
		{"境界の下端(U+0020)", "    "}, // 文字種は通る。長さは別の検査。
		{"境界の上端(U+007E)", "~~~~"},
	}
	for _, tc := range accepted {
		t.Run("許可/"+tc.name, func(t *testing.T) {
			if err := validateNewPassword(tc.in); errors.Is(err, ErrPasswordCharset) {
				t.Errorf("validateNewPassword(%q) rejected the charset, want accepted", tc.in)
			}
		})
	}
}

// TestValidateNewPassword_Length は VAL-N06 を固定する。
//
// ★境界(下限ちょうど・上限ちょうど)を必ず含める。自前実装で最も間違えやすい点である
// (M22-08 §4.6-4)。
func TestValidateNewPassword_Length(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		wantErr bool
	}{
		{"下限より 1 文字短い", strings.Repeat("a", PasswordMinLength-1), true},
		{"下限ちょうど", strings.Repeat("a", PasswordMinLength), false},
		{"下限より 1 文字長い", strings.Repeat("a", PasswordMinLength+1), false},
		{"上限より 1 文字短い", strings.Repeat("a", PasswordMaxLength-1), false},
		{"上限ちょうど", strings.Repeat("a", PasswordMaxLength), false},
		{"上限より 1 文字長い", strings.Repeat("a", PasswordMaxLength+1), true},
		{"空文字", "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateNewPassword(tc.in)
			if tc.wantErr && !errors.Is(err, ErrPasswordLength) {
				t.Errorf("len=%d: err = %v, want ErrPasswordLength", len(tc.in), err)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("len=%d: err = %v, want nil", len(tc.in), err)
			}
		})
	}
}

// TestValidateNewPassword_ChecksCharsetBeforeLength は、非 ASCII で長さも範囲外のとき
// 文字種として報告されることを固定する。
//
// ★順序が入れ替わると、日本語のパスワードに対して「4 文字以上で決めてください」と
// 出てしまい、利用者は日本語が原因だと分からない(§4.4 末尾の要求に反する)。
func TestValidateNewPassword_ChecksCharsetBeforeLength(t *testing.T) {
	// 2 文字(下限未満)かつ非 ASCII。
	if err := validateNewPassword("あい"); !errors.Is(err, ErrPasswordCharset) {
		t.Errorf("err = %v, want ErrPasswordCharset (charset must be reported first)", err)
	}
}

// TestValidateNewPassword_CountsCharactersNotBytes は「文字数」で数えていることを固定する。
//
// ★ASCII のみを受け付けるためバイト数と一致するが、検査の順序を入れ替えたときに
// 黙ってバイト数へ化けないよう、意図を固定しておく。
func TestValidateNewPassword_CountsCharactersNotBytes(t *testing.T) {
	// 128 個の ASCII 文字は 128 バイト。通ること。
	if err := validateNewPassword(strings.Repeat("z", PasswordMaxLength)); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
}

// TestValidateNewPassword_DoesNotLeakInput は戻り値に入力値が載らないことを固定する
// (SUPP-001 §5.6。拒否の経路でパスワードを漏らすのが最も起こりやすい形である)。
func TestValidateNewPassword_DoesNotLeakInput(t *testing.T) {
	secrets := []string{"ぱすわーど-secret", "ab", strings.Repeat("q", 300)}
	for _, secret := range secrets {
		err := validateNewPassword(secret)
		if err == nil {
			t.Fatalf("precondition: %q should have been rejected", secret)
		}
		if strings.Contains(err.Error(), secret) {
			t.Errorf("the error message leaks the input: %v", err)
		}
	}
}
