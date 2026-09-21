package model

// 組み込みプリセットの code(SUPP-001 §3.4 / DES-004 §3.1)。
// CHANGE-007 で `code` カラムが追加されたため、機械可読識別子としての一意な値。
//
// M20-01(旧 000069)で 5 種から 3 種へ整理した(D-288 / D-299 / D-300)。
// official_ja_command と numeric_en は提供しない。numeric_ja は numeric へ改称した。
const (
	PresetCodeOfficialJaMove = "official_ja_move"
	PresetCodeNumeric        = "numeric"
	PresetCodeSRK            = "srk"
)

// Preset は表記プリセット(DES-003 §3.8、CHANGE-007 反映後)。
//
// UserID が NULL のレコードは組み込みプリセットを示す(IsBuiltin = true)。
// カスタムプリセットは BasePresetCode で派生元プリセットを記録する。
// 全体上限は 8 件(組み込み 3 + カスタム 5)。組み込みは M20-01(旧 000069)で 3 種になった。
// 上限の強制は M20-04 で実装済み(internal/service/preset の Create が
// PresetTotalLimit を検査する。DES-006 VAL-P05)。
//
// CHANGE-007 で Code(機械可読識別子、UNIQUE)が追加された。Name は表示用名(日本語)。
// 国際化(name_ja / name_en の分離)はフェーズ 2 以降で検討する方針(指示書 v1.4.0 §4.6.4)。
//
// DES-003 §3.8 にタイムスタンプカラムは定義されていないため、CreatedAt / UpdatedAt は持たない。
type Preset struct {
	ID             int64   `db:"id"               json:"id"`
	UserID         *int64  `db:"user_id"          json:"userId,omitempty"`
	Code           string  `db:"code"             json:"code"` // CHANGE-007: 機械可読識別子(UNIQUE)
	Name           string  `db:"name"             json:"name"` // 日本語表示名
	BasePresetCode *string `db:"base_preset_code" json:"basePresetCode,omitempty"`
	IsBuiltin      bool    `db:"is_builtin"       json:"isBuiltin"`
}

// PresetAlias は (preset, move) ペアの表示用エイリアス(DES-003 §3.9)。
//
// AliasText が未定義の (preset, move) ペアはフォールバック解決される
// (DES-004 §5.3: base_preset_code → official_ja_move → moves.code)。
//
// DES-003 §3.9 にタイムスタンプカラムは定義されていないため、CreatedAt / UpdatedAt は持たない。
type PresetAlias struct {
	ID        int64  `db:"id"         json:"id"`
	PresetID  int64  `db:"preset_id"  json:"presetId"`
	MoveID    int64  `db:"move_id"    json:"moveId"`
	AliasText string `db:"alias_text" json:"aliasText"`
}

// PresetAliasDetail はプリセット編集画面(DES-005 §5.11)向けに、エイリアス 1 行へ
// 技側の識別情報を付けた読み取り用の型。M20-04 で追加。
//
// ★AliasTextEn は表示専用である。編集 UI を作らない(DES-004 §5.4 の生成規則が入れる列で
// あり、利用者が編集すると次の seed 波の再適用で消える。指示書 M20-04 §1.3・§4.6-4)。
//
// OfficialAliasText は official_ja_move プリセットの同 move のエイリアス(公式技名)。
// numeric / srk のような記法プリセットを編集するとき、「どの技の欄か」を人が判別する
// ための参照表示に使う(moves に技の表示名カラムは無く、表示名は preset_aliases が
// プリセット別に保持するため。SUPP-001 §7.3)。
type PresetAliasDetail struct {
	MoveID            int64   `json:"moveId"`
	MoveCode          string  `json:"moveCode"`
	MoveCategory      string  `json:"moveCategory"`
	CharacterID       int64   `json:"characterId"`
	AliasText         string  `json:"aliasText"`
	AliasTextEn       *string `json:"aliasTextEn,omitempty"`
	OfficialAliasText *string `json:"officialAliasText,omitempty"`
}

// AliasEntry は逆引き(表記 → 内部表現)の辞書 1 行。M20-07 で追加。
//
// ★用途は他から引っ越しの逆引き索引の材料に限る。表示には使わない
// (表示の解決順序は DES-004 §5.3 が持つ別の仕組みである)。
//
// AliasTextEn が nil / 空なのは「この行は英語表記を持たない」であって
// 「エイリアスが未定義」ではない(DES-003 §3.9・D-317)。したがって
// フォールバックの引き金にしない——索引へ英語キーを足さないだけである。
type AliasEntry struct {
	MoveCode    string
	AliasText   string
	AliasTextEn *string
}
