package model

// TagCategoryMyComboStatus はマイコンボ管理用のタグ予約カテゴリ定数（DES-003 §3.6）。
const TagCategoryMyComboStatus = "mycombo_status"

const (
	// MyComboStatusInUse はマイコンボステータス「使用中」を表す内部コード値。
	MyComboStatusInUse = "in_use"
	// MyComboStatusPracticing はマイコンボステータス「練習中」を表す内部コード値。
	MyComboStatusPracticing = "practicing"
	// MyComboStatusReduced はマイコンボステータス「頻度低下」を表す内部コード値。
	MyComboStatusReduced = "reduced"
)

// MyComboStatusTagNames はマイコンボステータスの内部コード → タグ name のマッピング。
var MyComboStatusTagNames = map[string]string{
	MyComboStatusInUse:      "使用中",
	MyComboStatusPracticing: "練習中",
	MyComboStatusReduced:    "頻度低下",
}

// DefaultMyComboStatusTag は利用者を作ったときに生成する既定タグ 1 件の定義。
type DefaultMyComboStatusTag struct {
	// Name はタグ名。★画面側は名前で引く(web/src/constants/mycombo.ts)。
	Name string
	// Color は UI 表示色(HEX)。
	Color string
}

// DefaultMyComboStatusTags は利用者作成時に生成する既定タグ(3 件・投入順)。
//
// ★値は migrations/000009_seed_initial_users_tags.up.sql の逐語と一致させてある。
// 同マイグレは user_id = 1 にのみ投入する(M33-02 が 9 群へ潰す前は 000007_seed_initial_tags_user1
// が同じ 3 行を入れていた。旧ヘッダが「本来は初回起動ウィザードで生成」「M6 着手時に
// ウィザード経由生成へ切り替える」と宣言していた=SUPP-001 §3.6)。
// M22-02 が users の CRUD を作る担当として引き取った。
//
// ★タグは利用者ごとに閉じている(読みが WHERE user_id = ? で絞る＝D-402)。
// ⇒ 生成しないと 2 人目はマイコンボのステータスを 1 件も引けず機能不全になる。
// ★同名のタグが利用者ごとに並存するのは正常である(一意制約は UNIQUE (user_id, name))。
var DefaultMyComboStatusTags = []DefaultMyComboStatusTag{
	{Name: MyComboStatusTagNames[MyComboStatusInUse], Color: "#10B981"},
	{Name: MyComboStatusTagNames[MyComboStatusPracticing], Color: "#3B82F6"},
	{Name: MyComboStatusTagNames[MyComboStatusReduced], Color: "#6B7280"},
}

// Tag はタグマスタ(DES-003 §3.6)。
//
// Color は UI 表示色を HEX("#10B981" 等)で保持する。
// 初期タグ「使用中」「練習中」「頻度低下」は初回起動ウィザード時に自動生成(SUPP-001 §3.5)。
type Tag struct {
	ID         int64   `db:"id"          json:"id"`
	UserID     int64   `db:"user_id"     json:"userId"`
	Name       string  `db:"name"        json:"name"`
	Category   *string `db:"category"    json:"category,omitempty"`
	Color      *string `db:"color"       json:"color,omitempty"`
	UsageCount *int    `db:"-"           json:"usageCount,omitempty"` // include_usage=true 時のみ設定
}

// CreateTagInput はタグ作成 API の入力(M3-01 §4.2.2)。
type CreateTagInput struct {
	Name     string  `json:"name"`
	Category *string `json:"category,omitempty"`
	Color    *string `json:"color,omitempty"`
}

// UpdateTagInput はタグ部分更新 API の入力(M3-01 §4.2.2)。
type UpdateTagInput struct {
	Name     *string `json:"name,omitempty"`
	Category *string `json:"category,omitempty"`
	Color    *string `json:"color,omitempty"`
}

// ComboTag は combos と tags の関連(DES-003 §3.7)。
//
// 関連レコード自体は最小情報のみ。リポジトリ層は必要に応じて Tag/Combo の集約として
// この構造体を直接使うのではなく、ID 列のみで扱うこともある。
type ComboTag struct {
	ComboID int64 `db:"combo_id" json:"comboId"`
	TagID   int64 `db:"tag_id"   json:"tagId"`
}
