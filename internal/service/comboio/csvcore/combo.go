package csvcore

import "encoding/json"

// Combo は CSV 往復の入力/出力となるコンボ DTO(意味単位・code ベース)。
// 本体 model.Combo のうち書き出し・復元に必要な意味カラムだけを写したもので、
// DB 管理列(id/version/created_at/updated_at/deleted_at/step_count/recipe_cache)は持たない。
//
// M13-01 改修: LocalID を追加、DriveDamage を *float64、起き攻め 6 列を *bool に。
type Combo struct {
	// LocalID は export バッチ内の一時 ID。セットプレイ CSV の ParentComboLocalID が参照する。
	LocalID string `json:"local_id,omitempty"`
	// CharacterCode は characters.code(例: "ryu")。character_id の代わり。
	CharacterCode string `json:"character_code"`
	// IsDraft は仮登録フラグ(combos.is_draft, FR009)。
	IsDraft bool `json:"is_draft"`
	// Damage は手動入力のダメージ値。未入力は nil(NULL 可カラムを *int で表現)。
	Damage *int `json:"damage,omitempty"`
	// DriveAvailableAtStart はコンボ開始時のドライブゲージ残量(REAL・0〜6・0.5 刻み、M16-01)。未設定は nil。
	DriveAvailableAtStart *float64 `json:"drive_available_at_start,omitempty"`
	// SAAvailableAtStart はコンボ開始時の SAゲージ残量段階(0〜3)。
	SAAvailableAtStart *int `json:"sa_available_at_start,omitempty"`
	// DriveDamage は相手に与える D ゲージ削り量(REAL・小数 -6〜6)。未設定は nil。
	DriveDamage *float64 `json:"drive_damage,omitempty"`
	// SAGaugeConsumed はコンボ中に消費する SAゲージ本数(0〜6)。未設定は nil。M16-02・VAL 非連動。
	SAGaugeConsumed *int `json:"sa_gauge_consumed,omitempty"`
	// DriveGaugeConsumed はコンボ中に消費する drive ゲージ本数(REAL・0〜20・0.5 刻み)。未設定は nil。M16-02・VAL 非連動。
	DriveGaugeConsumed *float64 `json:"drive_gauge_consumed,omitempty"`
	// Position は位置関係のコード値(例: "corner_self", "mid_screen")。空=NULL。
	Position string `json:"position,omitempty"`
	// OpponentStance は相手の姿勢コード値(例: "standing", "crouching")。
	OpponentStance string `json:"opponent_stance,omitempty"`
	// HitType はヒット状況コード値(例: "normal", "counter", "punish_counter")。
	HitType string `json:"hit_type,omitempty"`
	// OpponentSize は相手の大きさのコード値。
	OpponentSize string `json:"opponent_size,omitempty"`
	// Situation はその他柔軟性が必要な前提条件(combos.situation)。
	// JSON をそのまま保持し、書き出し時も解釈せず往復させる。空=NULL。
	Situation json.RawMessage `json:"situation,omitempty"`

	// 起き攻め情報(oki_* フラット 12 フラグ)。M16-03 正規化で本体は combo_oki_options 行だが、
	// CSV はフラット列を維持する(DES-002 §7.6・後方互換)。空セル=NULL(nil)=行なし、
	// "true"=行あり(成立する)。sparse モデルのため import では "true" のみ行を作る。
	// ★M27-02b: 「調べたか」は別列 oki_verified が持つ。
	// 既存 6 列(throw_meaty 4 + shimmy nogauge 2)は必須列、新 6 列(shimmy DR 2 + strike_meaty 4)は
	// 任意列として列末尾追加(旧 CSV 後方互換)。
	OkiMeatyNeutralTechThrow   *bool `json:"oki_meaty_neutral_tech_throw,omitempty"`
	OkiMeatyNeutralTechThrowDR *bool `json:"oki_meaty_neutral_tech_throw_dr,omitempty"`
	OkiMeatyBackTechThrow      *bool `json:"oki_meaty_back_tech_throw,omitempty"`
	OkiMeatyBackTechThrowDR    *bool `json:"oki_meaty_back_tech_throw_dr,omitempty"`
	OkiShimmyNeutralTech       *bool `json:"oki_shimmy_neutral_tech,omitempty"`
	OkiShimmyBackTech          *bool `json:"oki_shimmy_back_tech,omitempty"`
	// M16-03 新規任意列(列末尾追加)。
	OkiShimmyNeutralTechDR      *bool `json:"oki_shimmy_neutral_tech_dr,omitempty"`
	OkiShimmyBackTechDR         *bool `json:"oki_shimmy_back_tech_dr,omitempty"`
	OkiStrikeMeatyNeutralTech   *bool `json:"oki_strike_meaty_neutral_tech,omitempty"`
	OkiStrikeMeatyNeutralTechDR *bool `json:"oki_strike_meaty_neutral_tech_dr,omitempty"`
	OkiStrikeMeatyBackTech      *bool `json:"oki_strike_meaty_back_tech,omitempty"`
	OkiStrikeMeatyBackTechDR    *bool `json:"oki_strike_meaty_back_tech_dr,omitempty"`
	// KnockdownAdvantage はダウン後の有利フレーム数。未設定は nil。
	KnockdownAdvantage *int `json:"knockdown_advantage,omitempty"`

	// Memo は自由入力欄(combos.memo)。
	Memo string `json:"memo,omitempty"`
	// メディア 3 フィールド(M17-01)。verbatim 往復(解決・正規化・書換なし)・緩検証。空=NULL。
	Link      string `json:"link,omitempty"`       // 外部リンク URL
	VideoPath string `json:"video_path,omitempty"` // 動画の相対パス(本体は解決・再生しない)
	ImagePath string `json:"image_path,omitempty"` // 画像の相対パス(本体は解決・表示読込しない)

	// OkiVerified は起き攻めを一度でも調べたか(M27-02b)。
	// ★*bool である。空セル(旧 CSV)= nil = false(未検証)として読む。
	OkiVerified *bool `json:"oki_verified,omitempty"`
	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。未設定は nil。
	// ★保存の正本はこちら。取込時に空なら position の代表値がサーバ側で入る。
	StartPositionMass *int `json:"start_position_mass,omitempty"`
	// CarryDistanceMass は運び量(0〜160・M28-02a)。未設定は nil。
	// ★★position から逆算できない ⇒ 往復に載せないと完全に失われる。
	CarryDistanceMass *int `json:"carry_distance_mass,omitempty"`
	// StarterMeaty は始動技を持続当てしたか(M37-07・重複判定キーの 8 つ目)。
	// ★*bool である。空セル(旧 CSV)= nil = false(通常始動)として読む
	//   —— OkiVerified と同じ扱い。★DB 列は NOT NULL であり「不明」を持たない。
	StarterMeaty *bool `json:"starter_meaty,omitempty"`
	// Tags は付与タグ(combo_tags 経由)。順序は呼び出し側の与えた順を保つ。
	Tags []Tag `json:"tags,omitempty"`
	// Steps はレシピ(combo_steps を step_order 昇順で並べたもの)。
	Steps []Step `json:"steps,omitempty"`
}

// Setup はセットプレイ DTO(M13-01・別ファイル)。親コンボへ ParentComboLocalID で紐付く。
type Setup struct {
	// ParentComboLocalID はコンボ CSV の local_id を参照(同時アップロード時)。
	// 既存コンボへ紐付ける場合は実 ID 文字列を指定する。
	ParentComboLocalID string `json:"parent_combo_local_id"`
	// Name は setups.name(VAL-S06 必須)。
	Name string `json:"name,omitempty"`
	// Description は setups.description。
	Description string `json:"description,omitempty"`
	// Steps はセットプレイのレシピ(setup_steps を step_order 昇順)。
	Steps []Step `json:"steps,omitempty"`
}

// Step はレシピ1ステップ(combo_steps / setup_steps の1行)。
type Step struct {
	// MoveCode は moves.code。move_id NULL の非技ステップ(パリィドライブラッシュ等)
	// は空文字とし、種別は Modifiers.Type で識別する(DES-003 §3.5)。
	MoveCode string `json:"move_code"`
	// Modifiers は修飾情報(ジャスト・ディレイ等のフラグ、備考、ステップ種別)。
	Modifiers Modifiers `json:"modifiers"`
}

// Modifiers は combo_steps.modifiers の構造(DES-003 §3.5)。
type Modifiers struct {
	Flags []string `json:"flags,omitempty"`
	Notes string   `json:"notes,omitempty"`
	Type  string   `json:"type,omitempty"`
}

// Tag はコンボに付くタグ(tags テーブル由来)。Name のみ必須。
type Tag struct {
	Name     string `json:"name"`
	Category string `json:"category,omitempty"`
	Color    string `json:"color,omitempty"`
}
