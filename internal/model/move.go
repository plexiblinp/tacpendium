package model

// 技カテゴリの代表的な値(DES-003 §3.3、DES-004 §2.1)。
const (
	MoveCategoryNormal      = "normal"
	MoveCategorySpecial     = "special"
	MoveCategoryUnique      = "unique"
	MoveCategorySuperArt    = "super_art"
	MoveCategoryThrow       = "throw"
	MoveCategorySystem      = "system"
	MoveCategoryTargetCombo = "target_combo"
	MoveCategoryRushVariant = "rush_variant"
	MoveCategoryDriveImpact = "drive_impact"
	// MoveCategoryCriticalArt はクリティカルアーツ(CA)。SA3 とは別行で出現し、
	// code は `ca_` 接頭辞を持つ(DES-003 §3.3 L285 enum、CHANGE-025、M9-02 取込で活性化)。
	MoveCategoryCriticalArt = "critical_art"
)

// 技 code のうち、実装が名指しで参照するもの。
//
// ★リテラル文字列を実装各所に散在させない(CLAUDE.md §4)。フロントエンド側の対応定数は
// web/src/constants/move-code.ts に同期する(新規値の追加時は両側を同時に更新すること)。
const (
	// MoveCodeDriveReversal はドライブリバーサル(M31-04 / SM-098。投入元は 000004_data_seed_moves)。
	//
	// ★category は system であり、全キャラに 1 行ずつ在る(移動 system 技と同じ全キャラ行の形。
	//   投入元は 000004_data_seed_moves)。
	// ★確定反撃の走査では「相手技」として扱う。ただしジャストパリィタブからは除外する
	//   (開発者の逐語「この技をジャストパリィすることはないので取り扱わなくてもいい」。
	//    除外の実体は service/punishfinder の justParryExcludedCodes)。
	// ★入力面(仮想コントローラ)には出さない —— 防御リバーサルでありコンボ部品ではない
	//   (DES-002 §4)。FE 側の除外は web/src/features/combo/moveSurfacing.ts が持つ。
	// ★★ただし他から引っ越し(intake)は「入力面」に含めない(2026-09-10 開発者判断)。
	//   別名照合(internal/service/intake)は本 code を category で絞らず素通しする。
	//   ⇒ これは塞ぎ忘れではなく対象外と決めた結果である。勝手に塞がないこと。
	MoveCodeDriveReversal = "drive_reversal"
)

// startup_basis の値域(DES-003 §3.3、M19-DESIGN-07 §3)。
// 「格納されている startup が何を起点に測った値か」を表す。NOT NULL・既存行は unknown 起点。
//
//   - standalone: 単独で出したときの発生。
//   - through:    親からの通し値(親の入力からの経過フレーム)。親計上ゼロの規約が効く。
//   - unknown:    由来が未確定。unknown を暗黙に単発扱いしない(R4 の三値)。
//
// 本定数は BE 内の消費側でのみ参照する。GET /api/moves には露出しないため、
// 対応するフロントエンド定数は作らない(CLAUDE.md §4 の同期規約は API 露出列が対象)。
const (
	MoveStartupBasisStandalone = "standalone"
	MoveStartupBasisThrough    = "through"
	MoveStartupBasisUnknown    = "unknown"
)

// 技プロパティの代表的な値(DES-003 §3.3)。
const (
	MovePropertyHigh          = "high"
	MovePropertyMid           = "mid"
	MovePropertyLow           = "low"
	MovePropertyThrow         = "throw"
	MovePropertyProjectile    = "projectile"
	MovePropertyAirProjectile = "air_projectile"
)

// Move は技マスタ(DES-003 §3.3)。
//
// JSON フィールド(RawData)は生 JSON 文字列で保持し、必要時にサービス層がパースする。
// OriginalMoveID はラッシュ版技(category=rush_variant)で対応する通常技を指す。
//
// 注意: DES-003 §3.3 に従い、技の表示名(name_ja / name_en)は本構造体では持たない。
// 表示名はエイリアス機構(`preset_aliases.alias_text`)で管理する設計(DES-004 §1.2)。
// API 応答で表示名が必要な場合は、サービス層で preset を JOIN して取得する。
//
// DES-003 §3.3 にタイムスタンプカラムは定義されていないため、CreatedAt / UpdatedAt は持たない。
type Move struct {
	ID             int64  `db:"id"                          json:"id"`
	CharacterID    int64  `db:"character_id"                json:"characterId"`
	Code           string `db:"code"                        json:"code"`
	Category       string `db:"category"                    json:"category"`
	OriginalMoveID *int64 `db:"original_move_id"            json:"originalMoveId,omitempty"`
	Startup        *int   `db:"startup"                     json:"startup,omitempty"` // 発生フレーム（CHANGE-022/025、NULL 可）
	Active         *int   `db:"active"                      json:"active,omitempty"`  // 持続フレーム数（範囲表記を本数へ正規化、NULL 可）
	Total          *int   `db:"total"                       json:"total,omitempty"`   // 全体硬直（取込時算出、算出不能行は NULL）
	OnHit          *int   `db:"on_hit"                      json:"onHit,omitempty"`   // 硬直差ヒット（符号付き、NULL 可）
	OnBlock        *int   `db:"on_block"                    json:"onBlock,omitempty"` // 硬直差ガード（符号付き、NULL 可）
	Damage         *int   `db:"damage"                      json:"damage,omitempty"`
	Recovery       *int   `db:"recovery"                    json:"recovery,omitempty"` // 硬直フレーム（手入力、NULL 可、M14-01）
	IsAerial       bool   `db:"is_aerial"                   json:"isAerial"`           // 空中判定（ラッシュ可否導出に使用、NOT NULL DEFAULT false）
	// SetupOnly はセットプレイ専用フラグ（DES-003 §3.3・旧マイグレ 000013。NOT NULL DEFAULT false）。
	//
	// ★★【2026-09-12 更新・M31-06】「予約列」という旧説明は失効した。⇒ 本列は読まれている ——
	//   true の move はコンボ登録の入力面（仮想コントローラの 8 タブと全技一覧プルダウンの
	//   2 面）から外れ、**入力面としては**セットプレイのレシピ入力にだけ出る。
	//   ★「一覧にも出ない」ではない。表示面の扱いは下記のとおりである。
	// ★判定はフロント側 1 か所である（web/src/features/combo/moveSurfacing.ts の
	//   isInputExcluded）。⇒ サーバは値を配るだけで、出し分けの分岐を持たない。
	// ★★一覧・詳細・比較などの表示面では出す（開発者判断 2026-09-10・D-805）——
	//   setup_only の技は始動技になりうるため、表示面まで隠すと、その技を使った
	//   保存済みのコンボが読めなくなる。★「表示を省く」と「保存を禁止する」は別である。
	// ★★★true を立てる経路はまだ無い（付与口はフェーズ5 の射程＝M31-RESEARCH-01 §6）。
	//   ⇒ 実データは現在 0 件である。**経路だけが先に入っている**状態が正しい。
	// ★setplay の filler/target 提案からは除外しない（M19-02 §4.1「除外しないもの」）。
	SetupOnly bool `db:"setup_only" json:"setupOnly"`

	// IsDerived は派生技フラグ(DES-003 §3.3・CHANGE-069・旧マイグレ 000032)。
	//
	// ★★「単独入力が不可能」を意味しない。DES-003 §3.3 errata③ のとおり、true の行のうち
	//   少なくとも 96 行は「単独では出せるが他技とコマンドが完全一致するため索引衝突を避ける」
	//   ことが付与理由である。⇒ 本列を「入力可能性」の代理として使う設計は成立しない。
	// ★M30-04 でリスト DTO(GET /api/moves)へ露出した。用途は必殺技ファミリー行の並び順
	//   (派生変種を末尾へ回す)であり、入力面の可否判定には使わない(設計卓裁定 D-807)。
	IsDerived bool    `db:"is_derived"                  json:"isDerived"`
	RawData   *string `db:"raw_data"                    json:"rawData,omitempty"` // JSON
	// LastChangedGameVersion は「この技が最後に変わったゲームバージョン」(FR702 のマーカー・M28-02a)。
	//
	// ★★立てるのは配信者(開発者)であり、アプリが導出するものではない(checklist §5.1)。
	// ★★1 本で足りる —— 飛ばし更新で 2 回変わっていても「コンボの基準 < 最終変更」で判定できる。
	// ★NULL は「不明」ではなく「まだ一度も変わっていない」という既知の状態である
	//   (D-725: 初回公開より前は存在しないものとして扱う)。判定では影響なし側へ落ちる。
	// ★形式は internal/gameversion(`YYYY.MM.DD.NN`)。マイグレ 000104 で追加、CHECK 付き。
	// ★持ち場は character_data/*.csv であり、seedgen が SQL へ出力する
	//   (seed 再生成で黙って消えないようにするため。followup `csv-db-frame-cost-columns-drift`)。
	LastChangedGameVersion *string `db:"last_changed_game_version" json:"lastChangedGameVersion,omitempty"`
}
