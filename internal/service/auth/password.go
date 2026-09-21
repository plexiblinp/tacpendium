package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

// パスワード検証子のパラメータ。
//
// 鍵導出には標準ライブラリの crypto/pbkdf2 を使う(Go 1.24 で標準入り)。
// golang.org/x/crypto を直接依存へ昇格させずに済む(M22-01 §1.2-3・§3.3-1 の実査結果)。
const (
	// hashScheme は検証子の先頭に置く方式識別子。
	hashScheme = "pbkdf2-sha256"
	// hashIterations は PBKDF2 の反復回数。
	//
	// 導出はログイン時とパスワード設定時にしか走らない(セッション検証は
	// メモリ上の索引を引くだけである)ため、1 リクエスト分の待ちで収まる。
	hashIterations = 600000
	// hashSaltLen はソルトのバイト長。
	hashSaltLen = 16
	// hashKeyLen は導出鍵のバイト長。
	hashKeyLen = 32
	// hashFieldCount は検証子の "$" 区切りフィールド数。
	hashFieldCount = 4
	// maxHashIterations は照合時に受け付ける反復回数の上限。
	//
	// ★config.toml を手で編集して巨大な値を書かれたときに、ログイン 1 回で
	// CPU を長時間占有させないための歯止め。上限超えは照合失敗として扱う。
	// 現行の hashIterations から十分な引き上げ余地を残してある。
	maxHashIterations = 10000000
)

// b64 はパディング無しの base64。検証子を config.toml へ 1 行で収めるために使う。
var b64 = base64.RawStdEncoding

// HashPassword は平文パスワードから検証子を生成する。
//
// 返す形式は "pbkdf2-sha256$<反復回数>$<ソルト>$<導出鍵>"。反復回数とソルトを
// 検証子自身に埋めるため、後から hashIterations を上げても既存の検証子は照合できる。
func HashPassword(password string) (string, error) {
	salt := make([]byte, hashSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("auth: generate salt: %w", err)
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, hashIterations, hashKeyLen)
	if err != nil {
		return "", fmt.Errorf("auth: derive key: %w", err)
	}
	return fmt.Sprintf("%s$%d$%s$%s", hashScheme, hashIterations, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword は平文パスワードが検証子と一致するかを返す。
//
// 検証子が空・形式不正・未知の方式のいずれの場合も false を返す(エラーにしない)。
// ★呼び分けを増やさないための設計である。照合に使えない検証子は「合わない」で足りる。
func VerifyPassword(encoded, password string) bool {
	scheme, iterations, salt, want, ok := parseHash(encoded)
	if !ok || scheme != hashScheme {
		return false
	}
	got, err := pbkdf2.Key(sha256.New, password, salt, iterations, len(want))
	if err != nil {
		return false
	}
	// 定数時間比較(指示書 §4.3-2)。長さが違っても ConstantTimeCompare は 0 を返す。
	return subtle.ConstantTimeCompare(got, want) == 1
}

// parseHash は検証子を分解する。形式が壊れていれば ok = false を返す。
func parseHash(encoded string) (scheme string, iterations int, salt, key []byte, ok bool) {
	parts := strings.Split(encoded, "$")
	if len(parts) != hashFieldCount {
		return "", 0, nil, nil, false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 1 || iterations > maxHashIterations {
		return "", 0, nil, nil, false
	}
	salt, err = b64.DecodeString(parts[2])
	if err != nil || len(salt) == 0 {
		return "", 0, nil, nil, false
	}
	key, err = b64.DecodeString(parts[3])
	if err != nil || len(key) == 0 {
		return "", 0, nil, nil, false
	}
	return parts[0], iterations, salt, key, true
}
