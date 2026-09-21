package model

import "time"

// hit_type の取り得る値(DES-003 §3.4、CHANGE-006 で counter_type からリネーム)。
// CHECK 制約は DB 側に付けず、アプリ層で制約する方針(DES-003 §3.4)。
// just_parry_punish_counter は M18-01(CHANGE-082)で追加＝ジャストパリィ始動の確定反撃を
// 別コンボとして一意化する(FR301 dup キーが hit_type を含むため同一レシピでも別扱い)。
//
// M27-01 で 4 値 → 8 値。DI(ドライブインパクト)系 3 種と stun を追加した(源泉 SM-033 /
// SM-106 / SM-116 / P4M-025、開発者確定 2026-09-02)。既存 4 値は変更していない＝足すだけ。
//
// ★★新しい値は必ず末尾へ足すこと。web/src/constants/punish.ts が
// HIT_TYPE_VALUES を **位置インデックス**で引いており、途中へ挿入すると
// 確定反撃の写像が型検査もテストも通ったまま静かにずれる(M27-01 で名前参照へ是正済みだが、
// 順序に意味を持たせない習慣そのものを保つ)。
//
// ★HitTypeDriveImpactPunishCounter は「名前だけパニッシュカウンター」である
// (開発者確定 2026-09-02)。確定反撃ロジックのうち **生成の対象外判定にだけ**
// 既存 PC 2 値と並べてある(Materialize の対象外分岐)。
// ★タブ分け(punishlist の punishHitTypes)には入れていない —— どのタブに置くか、
//
//	「始動技がインパクトのときだけ使う」制約をどう掛けるかは別サブの判断である。
//	⇒ 本値は引き続き「区分を判定できない反撃」に出る。
const (
	HitTypeNormal                 = "normal"
	HitTypeCounter                = "counter"
	HitTypePunishCounter          = "punish_counter"
	HitTypeJustParryPunishCounter = "just_parry_punish_counter"
	// 以下 M27-01 追加。
	HitTypeDriveImpactWallSplatHit   = "drive_impact_wall_splat_hit"
	HitTypeDriveImpactWallSplatBlock = "drive_impact_wall_splat_block"
	HitTypeDriveImpactPunishCounter  = "drive_impact_punish_counter"
	HitTypeStun                      = "stun"
)

// opponent_size の取り得る値(DES-003 §3.4)。
// CHECK 制約は DB 側に付けず、アプリ層で制約する方針(hit_type と同じ)。
//
// M27-01 で新設した。それまで状況 4 軸のうち相手サイズだけパッケージ定数を持たず、
// 値の正典がフロント側の web/src/constants/combo-list.ts にしか無かった(CLAUDE.md §4 違反)。
//
// M27-01 で 3 値 → 4 値(開発者確定 2026-09-02)。
//   - medium → standard へ改名(表示名「中」→「標準」。旧マイグレ 000081 で既存データを移行)
//   - large を新設(既存行なし)
//   - large1 / large2 は値を変えずラベルだけ例示付きにした
//
// ★check-enum-sync.sh は本ブロックを拾わない。同スクリプトの抽出パターンは接尾辞が
// Category|Status|Type|Code のものにしか一致せず、OpponentSize* は対象外である。
// ⇒ 「検査が緑」は相手サイズの同期の担保にならない。フロントとの対応は
// web/src/constants/label-keys.test.ts の KEY_MAPS が見ている。
const (
	OpponentSizeStandard = "standard"
	OpponentSizeLarge    = "large"
	OpponentSizeLarge1   = "large1"
	OpponentSizeLarge2   = "large2"
)

// opponent_stance の取り得る値(DES-003 §3.4、CHANGE-003 で any 追加)。
const (
	OpponentStanceStanding  = "standing"
	OpponentStanceCrouching = "crouching"
	OpponentStanceAirborne  = "airborne"
	OpponentStanceAny       = "any"
)

// position の取り得る値(DES-003 §6 OPEN-001 確定、M3-03)。
//
// ★★M28-02a(D-733)で 5 → 7 へ増えた。PositionMidSelf / PositionMidOpponent が新設。
// ★既存 5 値はそのまま残る。間に 2 つ挿入されるだけであり、既存データの移行は要らない。
// ★区分の境界・代表値・表示順は PositionBands(internal/model/position.go)が正本。
const (
	PositionMidScreen          = "mid_screen"
	PositionCornerSelf         = "corner_self"
	PositionCornerSelfNear     = "corner_self_near"
	PositionCornerOpponent     = "corner_opponent"
	PositionCornerOpponentNear = "corner_opponent_near"
	// PositionMidSelf は「自分中央寄り」(48〜69・代表値 58)。M28-02a・D-733。
	PositionMidSelf = "mid_self"
	// PositionMidOpponent は「相手中央寄り」(91〜112・代表値 102)。M28-02a・D-733。
	PositionMidOpponent = "mid_opponent"
)

// modifiers.type の取り得る値(SUPP-001 §3.3.3、非技ステップ識別子)。
//
// dash(方向別)は M16-04(④” dash 一本化)で撤去した。移動は「1入力=1move」で
// system move dash(move.code=dash_forward/dash_back)として表現するのが canonical
// (DES-004 §2.1)。非技ステップ type は「技でも移動でもない、隣接ステップの出し方」に
// 限る(生ラッシュ/キャンセルラッシュ)。既存 modifier.type dash は旧マイグレ 000022 で
// system move dash へ移行済み。
const (
	ModifierTypeParryDriveRush  = "parry_drive_rush"
	ModifierTypeCancelDriveRush = "cancel_drive_rush"
)

// combo_oki_options.attack_type の取り得る値(M16-03・DES-003 §3.4 正規化)。
// 語彙は開発者確定(2026-07-05)。CHECK 制約は DB 側に付けず、アプリ層で制約する。
// フロント側の対応定数は web/src/constants/oki.ts(CLAUDE.md §4 の列挙同期)。
const (
	OkiAttackTypeThrowMeaty  = "throw_meaty"  // 投げ重ね
	OkiAttackTypeShimmy      = "shimmy"       // シミー
	OkiAttackTypeStrikeMeaty = "strike_meaty" // 打撃重ね(M16-03 新規)
)

// combo_oki_options.tech_type の取り得る値(M16-03)。
const (
	OkiTechTypeNeutral = "neutral_tech" // その場受け身
	OkiTechTypeBack    = "back_tech"    // 後ろ受け身
)

// OkiTechTypes は tech_type の値域の正典(M19-06 で追加)。
//
// 値そのものだけでなく「いくつあるか」を必要とする箇所があるため、定数の列挙を
// スライスとして持つ。フロント側の対応定数は web/src/constants/oki.ts の
// OKI_TECH_TYPES(CLAUDE.md §4 の列挙同期)。値を足すときは両側を同時に更新する。
var OkiTechTypes = []string{OkiTechTypeNeutral, OkiTechTypeBack}

// Modifiers はコンボ / セットプレイのステップに付与される修飾情報(SUPP-001 §3.3 準拠)。
//
// DB 上は combo_steps.modifiers / setup_steps.modifiers の TEXT カラムに JSON 文字列として
// 保存される。リポジトリ層が SELECT 時に json.Unmarshal、INSERT/UPDATE 時に json.Marshal を
// 行い、サービス層 / ハンドラ層は本構造体を直接扱う(M1-02 計画 §Phase E item 20、案 B)。
//
// Flags の全数は DES-004 §2.3 の 14 値(★「代表値」ではない。旧記述は 4 値しか挙げて
// おらず失効していた —— M37-02 で是正。★★M37-06 で 10 → 14 値):
//
//	delay / link / first_hit_cancel / no_cancel / late_cancel /
//	low_jump / juggle_high / juggle_low / whiff / meaty / cross_under /
//	od_lm / od_mh / od_lh
//
// ★★★これとは別に、選択肢から外したが**既存行が持っている** 3 値がある:
//
//	just / neutral_jump / forward_jump
//	⇒ 新規には選べないが、表示語は残す。消すと既存行が `{just}` のような内部識別子
//	  むき出しで表示され、M37-02(B04)が消したフォールバックが戻る(M37-06 §4.1)。
//
// ★表示語は internal/service/notation/resolver.go の flagText と
//
//	web/src/features/combo/labels.ts が持つ。値を増やすときは 3 か所を同時に直すこと。
//
// ★本フィールドが []string であって型付き定数でないのは、DB 制約ではなく画面 UI
//
//	(固定選択式)で担保する設計だからである(DES-004 §2.3)。
//
// Type の全数は DES-004 §2.3 の 2 値: parry_drive_rush / cancel_drive_rush
// (dash は M16-04 で system move へ一本化・撤去済み。DES-004 §2.1)
type Modifiers struct {
	Flags []string `json:"flags,omitempty"`
	Type  string   `json:"type,omitempty"`
	Notes string   `json:"notes,omitempty"`
}

// ComboStep はコンボのステップ(DES-003 §3.5)。
//
// MoveID は技ステップでは技を指し、非技ステップ(modifiers.type 指定)では NULL になる。
// MoveCode は moves テーブルとの JOIN で取得する読取専用フィールド(DB マッピング対象外)。
// API 応答での技 code 直接表示などに利用する想定(SUPP-001 §5.1 想定)。
//
// Modifiers は型付き struct(*Modifiers)で扱い、生 JSON はリポジトリ層が変換する(案 B)。
type ComboStep struct {
	ID        int64      `db:"id"         json:"id"`
	ComboID   int64      `db:"combo_id"   json:"-"`
	StepOrder int        `db:"step_order" json:"stepOrder"`
	MoveID    *int64     `db:"move_id"    json:"moveId,omitempty"`
	MoveCode  *string    `db:"-"          json:"moveCode,omitempty"`  // JOIN で取得、DB マップ対象外
	Modifiers *Modifiers `db:"-"          json:"modifiers,omitempty"` // リポジトリ層で JSON 変換
}

// OkiOption は起き攻めオプション 1 件(combo_oki_options の 1 行・M16-03 正規化)。
//
// sparse: 行の存在＝そのオプションが成立する。available 列は持たない(開発者確定 2026-07-05)。
// AttackType/TechType は OkiAttackType* / OkiTechType* 定数のいずれか。UsesDR は
// ドライブラッシュ版か否か(全 attack_type に一様適用＝シミーの 4 区分化)。
//
// ★★M27-02b(P4M-011): 「まだ調べていない」と「調べたが成立するものが無かった」の
// 区別は、**セル単位ではなくコンボ単位**の Combo.OkiVerified が持つ。
//
//	OkiVerified=false               → 未検証
//	OkiVerified=true かつ 行 0 件   → 調べたが成立する起き攻めは無かった
//	OkiVerified=true かつ 行あり    → 調べた結果、その行が成立する
//
// ★★一度セル単位の 3 状態(available 列)で作ったが、**入力量が増えるだけで
// 欲しかったものと違う**と実機確認で分かり、コンボ単位のフラグへ改めた
// (2026-09-03 開発者確認)。⇒ 本 struct は M16-03 当時のまま変えていない。
type OkiOption struct {
	AttackType string `db:"attack_type" json:"attackType"`
	TechType   string `db:"tech_type"   json:"techType"`
	UsesDR     bool   `db:"uses_dr"     json:"usesDr"`
}

// Combo はコンボの集約モデル(DES-003 §3.4、CHANGE-001 / CHANGE-003 / CHANGE-006 反映)。
//
// 集約境界: 1 コンボに紐付く `combo_steps` の全ステップを Steps スライスで保持する。
//
// Steps の規約:
//   - nil   → 未ロード(リポジトリ層が SELECT で取得しなかった状態。一覧 API ではこちら)
//   - 非 nil → ロード済み(詳細 API で IN 句バッチ + バケット化により注入される)
//   - 空スライスは「ロード済みかつ 0 件」だが、業務上コンボは 1+ ステップを持つため
//     実質発生しない。実装上は nil と空を厳密に区別しない(omitempty で API 応答からも消える)
//
// CHANGE-006: counter_type → hit_type にリネーム済み。取り得る値は本ファイル冒頭の
// HitType* 定数 8 種(DB CHECK 制約は付けず、アプリ層で制約)。OpponentSize も同様に
// OpponentSize* 定数 4 種(M27-01)。
//
// ★値を列挙し直さないこと——旧記述は HitTypeJustParryPunishCounter を落としたまま
// M18-01 から M27-01 まで失効し続けた。定数ブロック 1 か所を正典にする。
//
// JSON カラム(Situation、RecipeCache)は生 JSON 文字列で保持。RecipeCache は API 応答から
// 除外(json:"-")し、サービス層がプリセット選択に応じてデコードして返す。
type Combo struct {
	ID                    int64    `db:"id"                                json:"id"`
	CharacterID           int64    `db:"character_id"                      json:"characterId"`
	IsDraft               bool     `db:"is_draft"                          json:"isDraft"`
	Damage                *int     `db:"damage"                            json:"damage,omitempty"`
	DriveAvailableAtStart *float64 `db:"drive_available_at_start"          json:"driveAvailableAtStart,omitempty"` // 0〜6・0.5 刻み(M16-01)。DB は REAL
	SAAvailableAtStart    *int     `db:"sa_available_at_start"             json:"saAvailableAtStart,omitempty"`
	DriveDamage           *float64 `db:"drive_damage"                      json:"driveDamage,omitempty"`        // -6〜6・小数許容(C-11)。DB は REAL
	SAGaugeConsumed       *int     `db:"sa_gauge_consumed"                 json:"saGaugeConsumed,omitempty"`    // 消費 SA(0〜6・M16-02)。記録/表示/比較のみ・VAL 非連動
	DriveGaugeConsumed    *float64 `db:"drive_gauge_consumed"              json:"driveGaugeConsumed,omitempty"` // 消費 drive(0〜20・0.5 刻み・M16-02)。DB は REAL・VAL 非連動
	StarterMoveID         *int64   `db:"starter_move_id"                   json:"starterMoveId,omitempty"`
	Position              *string  `db:"position"                          json:"position,omitempty"`
	// StartPositionMass は始動位置のマス数(0〜160・M28-02a・マイグレ 000105)。
	//
	// ★★保存する正本はこちらである(D-731)。Position(区分)はここから導出できるが、
	//   重複判定キーに使われているため列としても残している。⇒ 2 つは常に整合させる。
	//   整合の規則は combo サービス層が持つ(マス数が勝つ)。
	// ★★パーセントは保存しない —— 1% = 1.6 マスであり、マス → % → マス の往復で
	//   値が動く(利用者が触っていないのに数字が変わる)。
	// ★NULL = 不問 / 未入力。0 は「自分画面端にぴったり」であって未入力ではない。
	// ★DES-003 §3.4: dup / recipe_hash の非対象(重複判定に使うのは区分の側である)。
	StartPositionMass *int `db:"start_position_mass" json:"startPositionMass,omitempty"`
	// CarryDistanceMass は運び量(0〜160・M28-02a・マイグレ 000105)。
	//
	// ★★始動位置とは別の値である(D-731)。開発者の逐語:
	//   「そもそも運び量と今の話は別。コンボを始める前の立ち位置です。なお必ずしも
	//   画面端にぴったり送るコンボとは限らないので、運び量は別の列として欲しいです。」
	// ★同じ 160 マスの物差しを使うが、共有させない。
	// ★★区分へ丸めない —— 区分を持つのは始動位置だけである(指示書 §2.4.5-4)。
	// ★DES-003 §3.4: dup / recipe_hash の非対象(M28-overview §3.6-3)。
	CarryDistanceMass *int    `db:"carry_distance_mass" json:"carryDistanceMass,omitempty"`
	OpponentStance    *string `db:"opponent_stance"                   json:"opponentStance,omitempty"`
	HitType           *string `db:"hit_type"                          json:"hitType,omitempty"` // CHANGE-006: 旧 counter_type
	OpponentSize      *string `db:"opponent_size"                     json:"opponentSize,omitempty"`
	// StarterMeaty は「このコンボの始動技を持続当てしたか」(M37-07・マイグレ 000117)。
	//
	// ★★重複判定キーの 8 つ目である(SUPP-001 §2.2・開発者裁定 D-874)。⇒ レシピも状況も
	//   同じでも、本欄が違えば別コンボとして登録できる。hit_type と同じ立ち位置である。
	// ★★hit_type とは別枠である(開発者の逐語 =「始動技用としては別枠として欲しい。
	//   ヒット種別とも別枠」)。持続当ては*ヒットの種類*ではなく*当て方*であり、
	//   「持続当てのカウンターヒット」がありうる。⇒ 1 つの列に畳めない。
	// ★★combo_oki_options の打撃重ね(oki_strike_meaty_*)とは**向きが違う**。あちらは
	//   このコンボの*後に*何ができるか(出る側)、本欄はこのコンボの*始動が*どうだったか(入る側)。
	// ★NOT NULL DEFAULT 0 のためポインタにしない(OkiVerified と同じ理由。「未設定」が無い)。
	//   ⇒ 重複判定キーに入るため NULL を許さない —— SQL では NULL != NULL であり、
	//     「不明どうし」が別コンボになる意味の無い分岐が生まれる。
	// ★step の modifier `meaty`(中途の技の持続当て)とは別物である。あちらは M37-06 の射程。
	StarterMeaty       bool    `db:"starter_meaty"                     json:"starterMeaty"`
	Situation          *string `db:"situation"                         json:"situation,omitempty"` // JSON
	KnockdownAdvantage *int    `db:"knockdown_advantage"               json:"knockdownAdvantage,omitempty"`
	// OkiVerified は起き攻めを一度でも調べたか(M27-02b / P4M-011・旧マイグレ 000096)。
	//
	// ★★これが無いと「チェックが 1 つも無い」が **「まだ調べていない」なのか
	// 「調べたが成立するものが無かった」なのか区別できない**。それが本欄の存在理由である。
	// ★セル単位ではなくコンボ単位である(開発者確定 2026-09-03)。
	// ★NOT NULL DEFAULT 0 のためポインタにしない(「未設定」という状態が無い)。
	OkiVerified bool       `db:"oki_verified" json:"okiVerified"`
	Memo        *string    `db:"memo"                              json:"memo,omitempty"`
	Link        *string    `db:"link"                              json:"link,omitempty"`      // 外部リンク URL(M17-01)。文字列参照のみ・dup/recipe 非対象
	VideoPath   *string    `db:"video_path"                        json:"videoPath,omitempty"` // 動画の相対パス(M17-01)。本体は解決・再生しない
	ImagePath   *string    `db:"image_path"                        json:"imagePath,omitempty"` // 画像の相対パス(M17-01)。本体は解決・表示読込しない
	StepCount   int        `db:"step_count"                        json:"stepCount"`
	RecipeCache *string    `db:"recipe_cache"                      json:"-"`       // JSON(presetId→displayString)。サービス層がデコード
	Version     int        `db:"version"                           json:"version"` // 楽観的排他用
	CreatedAt   time.Time  `db:"created_at"                        json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at"                        json:"updatedAt"`
	DeletedAt   *time.Time `db:"deleted_at"                        json:"-"` // 論理削除、API には出さない
	// MaterializedFromComboID は materialize(確定反撃版の生成)で作られたコンボの出自(基底コンボの id)。
	// M18-03b(CHANGE-089)で消費開始。NULL=通常のコンボ。生成後は独立フォークで基底の変更に追従しない。
	// DES-003 §3.4: dup / recipe_hash の非対象(DuplicateKey / CalcRecipeHash に混ぜない)。
	// 列の宣言元は 000001_init_schema の combos.materialized_from_combo_id(INTEGER・nullable・self-FK。
	// M33-02 が 9 群へ潰す前は M18-01 の 000038 が足していた)。
	MaterializedFromComboID *int64 `db:"materialized_from_combo_id" json:"materializedFromComboId,omitempty"`
	// SupersededByComboID は「この行を置き換えた後継コンボの id」(M23-01 / CHANGE-121)。
	// PUT /api/combos/:id(キー変更編集)が旧行を論理削除して新 id を採番し直す際に、
	// 旧行へ新行の id を書く。NULL=通常の削除行 or 現役行、非 NULL=編集で積まれた旧行。
	// ゴミ箱の絞り込み(OnlyDeleted)は本列が NULL の行だけを返す(指示書 §4.3-1)。
	// 本列を読むのはその述語だけであり、値を表示する画面は作らない(指示書 §1.3-1)。
	// DES-003 §3.4: dup / recipe_hash の非対象。列の宣言元は 000001_init_schema。
	SupersededByComboID *int64 `db:"superseded_by_combo_id" json:"supersededByComboId,omitempty"`
	// BaselineVersion は「このコンボが前提としているゲームバージョン」(FR702 の基準・M28-02a)。
	//
	// ★★持ち場をコンボ単位にした決め手は「部分消化できるか」である(M28-overview §3.2.7)。
	//   影響コンボを 1 件ずつ「確認した」にできるのは、この形だけである。
	// ★登録・更新時に「当時の最新」(games.current_data_version)が入る。
	//   ★★入れるのはリポジトリ層の INSERT である —— 呼び出し側が忘れうる形にしない
	//   (先例 `materialize-bypasses-required-fields`: 経路が 1 本増えると静かに抜ける)。
	// ★NULL は「不明」であり、判定では安全側 = 影響可能性ありへ倒す(指示書 §2.3-3)。
	// ★形式は internal/gameversion。マイグレ 000104 で追加、CHECK 付き。
	// ★DES-003 §3.4: dup / recipe_hash の非対象(いつ登録したかは同一性に影響しない)。
	// ★CSV へは出さない(DB 管理列であって利用者の入力ではない。指示書 §2.5-2)。
	BaselineVersion *string `db:"baseline_version" json:"baselineVersion,omitempty"`
	// AffectedByGameUpdate は「このコンボが使っている move のうち、マーカーが基準より
	// 新しいものが 1 つでもあるか」(FR702 の判定・M28-02a)。
	//
	// ★★保存しない。SELECT のたびに combo_steps 経由で導出する(checklist §5.1 確定事項 3)。
	//   ⇒ 影響コンボを持つテーブルは作らない。
	// ★★これは「影響可能性」であって破綻の断定ではない(FR307 整合)。
	//   検証はユーザーに委ねる。アプリは的を絞って見せるだけである。
	// ★db:"-" ではない —— SELECT 句の派生列として scan する。INSERT/UPDATE には現れない。
	AffectedByGameUpdate bool `db:"affected_by_game_update" json:"affectedByGameUpdate"`
	// AffectedMoves は「そのコンボが使っている move のうち、実際に基準より後に変わったもの」
	// (FR702 の目的そのもの・M28-02c / CHANGE-162 §1)。
	//
	// ★★AffectedByGameUpdate と同じ 1 本の述語から導く(affectedMoveCondSQL)。
	//   ⇒ 式を書き写さない。書き写すと表示と絞り込みが静かにずれる。
	// ★★真偽の正本は AffectedByGameUpdate の 1 本である。
	//   ⇒ len(AffectedMoves) > 0 で影響の有無を判定しないこと(真偽が 2 か所で表せてしまう)。
	// ★db:"-" —— 派生列ではなくバッチ取得で注入する(N+1 回避。先例 = ListSetupsByComboIDs)。
	AffectedMoves []AffectedMove `db:"-" json:"-"`
	// 集約: 子エンティティ。DB マップ対象外、リポジトリ層がバッチ取得して注入する。
	Steps []ComboStep `db:"-" json:"steps,omitempty"`
	// Tags は combo_tags 経由で取得するタグ一覧。DB マップ対象外。
	// nil は未ロード(一部の内部クエリ)、非 nil は取得済み(API 応答では必ず非 nil)。
	Tags []Tag `db:"-" json:"-"`
	// OkiOptions は combo_oki_options（正規化・M16-03）から取得する起き攻めオプション一覧。
	// DB マップ対象外、リポジトリ層がバッチ取得して注入する。
	// nil は未ロード、非 nil はロード済み（0 件は空スライス）。
	// ★含まれる＝そのオプションが成立する。★「調べたか」は OkiVerified が持つ。
	OkiOptions []OkiOption `db:"-" json:"okiOptions,omitempty"`
	// DefaultRecipe は一覧 API 用の既定レシピ文字列。recipe_cache から抽出。DB マップ対象外。
	DefaultRecipe string `db:"-" json:"-"`
	// StarterMoveCode は始動技の技コード。moves テーブルから取得。DB マップ対象外。
	StarterMoveCode *string `db:"-" json:"-"`
	// StarterMoveNameJa は始動技の表示名(公式日本語)。official_ja_move プリセットの
	// alias_text 由来であり、未登録なら nil(ラッシュ版は alias を持たない)。DB マップ対象外。
	//
	// ★★M24-07(SM-006 = SM-059): 一覧の始動状況が内部の英語 move code から始まって
	// いたため、表示名を返せるようにした。punish 側(StarterMoveNameJa)と同じ形である。
	StarterMoveNameJa *string `db:"-" json:"-"`
}

// AffectedMove はゲームの更新で変わった技 1 本(FR702・M28-02c / CHANGE-162 §1.2)。
//
// ★NameJa は NULL 可 —— 表示名は moves の列ではなく preset_aliases(official_ja_move)由来で
// あり、ラッシュ版は alias を持たない。★サーバ側では code へ落とさない。落とすのは画面側の
// 1 関数である(先例 = StarterMoveNameJa / web の formatStarterStatus)。
type AffectedMove struct {
	MoveID                 int64   `json:"moveId"`
	Code                   string  `json:"code"`
	NameJa                 *string `json:"nameJa,omitempty"`
	LastChangedGameVersion string  `json:"lastChangedGameVersion"`
}
