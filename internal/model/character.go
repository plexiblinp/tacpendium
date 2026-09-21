package model

// Character はキャラクターマスタ(DES-003 §3.2)。
//
// CustomStates は JSON 文字列としてそのまま保持する。
// 構造の詳細は DES-003 §3.2 を参照(キャラ固有状態を表現する柔軟スキーマ)。
//
// DES-003 §3.2 にタイムスタンプカラムは定義されていないため、CreatedAt / UpdatedAt は持たない。
type Character struct {
	ID           int64   `db:"id"            json:"id"`
	GameID       int64   `db:"game_id"       json:"gameId"`
	Code         string  `db:"code"          json:"code"`
	NameJa       string  `db:"name_ja"       json:"nameJa"`
	NameEn       string  `db:"name_en"       json:"nameEn"`
	CustomStates *string `db:"custom_states" json:"customStates,omitempty"`
}
