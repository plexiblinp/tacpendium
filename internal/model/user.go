package model

import "time"

// User はユーザー(DES-003 §3.10)。
//
// PasswordHash は NULL 可(認証不要ユーザー)。設定された場合は bcrypt ハッシュを保持する。
// MainCharacterID は「デフォルト表示キャラ」(DES-003 §3.10、利用キャラ限定の意味ではない)。
//
// PasswordHash は API 応答から完全に除外する(json:"-")。
type User struct {
	ID              int64     `db:"id"                json:"id"`
	Name            string    `db:"name"              json:"name"`
	PasswordHash    *string   `db:"password_hash"     json:"-"` // 絶対に API 応答に出さない
	MainCharacterID *int64    `db:"main_character_id" json:"mainCharacterId,omitempty"`
	CreatedAt       time.Time `db:"created_at"        json:"createdAt"`
}
