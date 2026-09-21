// Package csvcore はコンボ/セットプレイの CSV エクスポート・インポートの
// シリアライズと検証のコアを担う。
//
// 由来: autopilot-combomgr の先行成果物 combo-export-csv(往復ロジック)と
// combo-csv-import(検証層)を本体へソースコピーし、M13-01 の契約差を埋めて
// 統合したもの(両 Go を一体化・replace 解消)。改修点は次のとおり:
//   - コンボ CSV 先頭に local_id 列を追加(セットプレイ CSV の parent_combo_local_id と対称)。
//   - drive_damage を *int → *float64(本体 REAL・小数 -6〜6。CHANGE-046/DES-003)へ整合。
//   - 起き攻め 6 列を bool → *bool(NULL 可。空セル=NULL / true,false は明示値)へ整合。
//   - セットプレイ CSV(別ファイル)を新設。
//   - VAL-I10 式注入無害化(再 export 時の ' 付与・import で対称的に剥がす)を追加。
//
// 本パッケージの JSON タグは CSV シリアライズ専用の snake_case であり、本体 API
// DTO(camelCase)とは別レイヤである(CLAUDE.md §4)。API 境界の DTO 変換は
// comboio サービス/ハンドラ側が担う。
package csvcore

// 区切り文字。CSV はカンマ(RFC 4180)。
const CSVComma = ','

// ── コンボ CSV(FR401/405・往復)の列ヘッダ名 ───────────────────────────
// 値はそのまま CSV ヘッダ行に出力され、インポート時のキーにもなる。
// 名前は DES-003 §3.4/§3.5 のカラム名(スネークケース)に合わせている。
const (
	ColLocalID                    = "local_id" // export バッチ内一時 ID。setplay の parent 紐付け用(M13-01 追加)
	ColCharacterCode              = "character_code"
	ColIsDraft                    = "is_draft"
	ColDamage                     = "damage"
	ColDriveAvailableAtStart      = "drive_available_at_start"
	ColSAAvailableAtStart         = "sa_available_at_start"
	ColDriveDamage                = "drive_damage" // REAL・小数 -6〜6(M13-01 で float 化)
	ColPosition                   = "position"
	ColOpponentStance             = "opponent_stance"
	ColHitType                    = "hit_type"
	ColOpponentSize               = "opponent_size"
	ColSituation                  = "situation" // セル内 JSON(combos.situation を verbatim)
	ColOkiMeatyNeutralTechThrow   = "oki_meaty_neutral_tech_throw"
	ColOkiMeatyNeutralTechThrowDR = "oki_meaty_neutral_tech_throw_dr"
	ColOkiMeatyBackTechThrow      = "oki_meaty_back_tech_throw"
	ColOkiMeatyBackTechThrowDR    = "oki_meaty_back_tech_throw_dr"
	ColOkiShimmyNeutralTech       = "oki_shimmy_neutral_tech"
	ColOkiShimmyBackTech          = "oki_shimmy_back_tech"
	ColKnockdownAdvantage         = "knockdown_advantage"
	// ColOkiVerified は起き攻めを一度でも調べたか(M27-02b・列末尾追加の任意列)。
	ColOkiVerified = "oki_verified"
	// ★M28-02a: 始動位置のマス数と運び量(列末尾追加の任意列)。
	//   ★載せる理由は ColOkiVerified と同じである —— 載せないと
	//     **出力 → 取込で値が消える**。始動位置は position の代表値へ丸め戻され、
	//     運び量に至っては逆算する術が無く完全に失われる。
	//   ★combos.baseline_version は載せない。DB 管理列であって利用者の入力ではない
	//     (先例＝materialized_from_combo_id / superseded_by_combo_id)。
	ColStartPositionMass = "start_position_mass"
	ColCarryDistanceMass = "carry_distance_mass"
	// ColStarterMeaty は始動技を持続当てしたか(M37-07・列末尾追加の任意列)。
	//   ★載せる理由は ColOkiVerified と同じである —— 載せないと **出力 → 取込で値が消える**。
	//     しかも本列は重複判定キーであるため、消えると往復のたびに別コンボへ化ける。
	ColStarterMeaty = "starter_meaty"
	ColMemo         = "memo"
	ColTags         = "tags"   // セル内 JSON: [{name,category,color}]
	ColRecipe       = "recipe" // セル内 JSON: [{move_code,modifiers}]
	// 消費ゲージ列(M16-02)。列末尾追加・import では任意列(旧 CSV 後方互換、下記 requiredImportColumns 参照)。
	ColSAGaugeConsumed    = "sa_gauge_consumed"    // 消費 SA(0〜6)。VAL 非連動(範囲検証なし)
	ColDriveGaugeConsumed = "drive_gauge_consumed" // 消費 drive(0〜20・0.5 刻み)。VAL 非連動(範囲検証なし)
	// 起き攻め正規化の新オプション列(M16-03)。列末尾追加・import では任意列(旧 CSV 後方互換)。
	// シミーのドライブラッシュ版 2 列 + 打撃重ね 4 列。
	ColOkiShimmyNeutralTechDR      = "oki_shimmy_neutral_tech_dr"
	ColOkiShimmyBackTechDR         = "oki_shimmy_back_tech_dr"
	ColOkiStrikeMeatyNeutralTech   = "oki_strike_meaty_neutral_tech"
	ColOkiStrikeMeatyNeutralTechDR = "oki_strike_meaty_neutral_tech_dr"
	ColOkiStrikeMeatyBackTech      = "oki_strike_meaty_back_tech"
	ColOkiStrikeMeatyBackTechDR    = "oki_strike_meaty_back_tech_dr"
	// メディア 3 列(M17-01/CHANGE-068)。列末尾追加・import では任意列(旧 CSV 後方互換)。
	// 値は verbatim(パス/URL の解決・正規化・書換なし)。緩検証=import 検証エラーを出さない。
	ColLink      = "link"       // 外部リンク URL
	ColVideoPath = "video_path" // 動画の相対パス(本体は解決・再生しない)
	ColImagePath = "image_path" // 画像の相対パス(本体は解決・表示読込しない)
)

// CSVColumns はコンボ CSV(往復)の正準の列順。ExportCSV はこの順で行を組み、
// ParseAndValidate はヘッダ名でマッピングしたうえで本リストの全列が存在することを要求する。
var CSVColumns = []string{
	ColLocalID,
	ColCharacterCode,
	ColIsDraft,
	ColDamage,
	ColDriveAvailableAtStart,
	ColSAAvailableAtStart,
	ColDriveDamage,
	ColPosition,
	ColOpponentStance,
	ColHitType,
	ColOpponentSize,
	ColSituation,
	ColOkiMeatyNeutralTechThrow,
	ColOkiMeatyNeutralTechThrowDR,
	ColOkiMeatyBackTechThrow,
	ColOkiMeatyBackTechThrowDR,
	ColOkiShimmyNeutralTech,
	ColOkiShimmyBackTech,
	ColKnockdownAdvantage,
	ColMemo,
	ColTags,
	ColRecipe,
	// 消費ゲージ列(M16-02)は列末尾に追加する(意味単位・後方互換)。
	ColSAGaugeConsumed,
	ColDriveGaugeConsumed,
	// 起き攻め正規化の新オプション列(M16-03)は列末尾に追加する(後方互換)。
	ColOkiShimmyNeutralTechDR,
	ColOkiShimmyBackTechDR,
	ColOkiStrikeMeatyNeutralTech,
	ColOkiStrikeMeatyNeutralTechDR,
	ColOkiStrikeMeatyBackTech,
	ColOkiStrikeMeatyBackTechDR,
	// メディア 3 列(M17-01)は列末尾に追加する(後方互換)。
	ColLink,
	ColVideoPath,
	ColImagePath,
	// ★M27-02b: 起き攻めを調べたかのフラグも列末尾に追加する(後方互換)。
	//   ★載せない選択もあったが、載せないと **出力 → 取込でフラグが消える**。
	ColOkiVerified,
	// ★M28-02a: 始動位置のマス数と運び量も列末尾に追加する(後方互換)。
	ColStartPositionMass,
	ColCarryDistanceMass,
	// ★M37-07: 始動技の持続当ても列末尾に追加する(後方互換)。
	ColStarterMeaty,
}

// optionalImportColumns は import で「読むが必須ではない」列(M16-02)。
// 消費ゲージ列は往復(export/import)に含めるが、これらを含まない旧 CSV も import を成立させる
// ため必須列から外す(欠損セル=NULL 扱い)。export と unknownColumns は CSVColumns(既知列)を
// 使うため、新 CSV での誤 "unknown" 警告は出さない(DES-002 §7.6・列末尾追加の後方互換)。
var optionalImportColumns = map[string]bool{
	ColSAGaugeConsumed:    true,
	ColDriveGaugeConsumed: true,
	// 起き攻め正規化の新オプション列(M16-03)。旧 CSV(既存 6 起き攻め列のみ)の import を通す。
	ColOkiShimmyNeutralTechDR:      true,
	ColOkiShimmyBackTechDR:         true,
	ColOkiStrikeMeatyNeutralTech:   true,
	ColOkiStrikeMeatyNeutralTechDR: true,
	ColOkiStrikeMeatyBackTech:      true,
	ColOkiStrikeMeatyBackTechDR:    true,
	// メディア 3 列(M17-01)。旧 CSV(3 列なし)の import を通す(欠損セル=NULL)。
	ColLink:      true,
	ColVideoPath: true,
	ColImagePath: true,
	// ★M27-02b: 旧 CSV(本列なし)の import を通す。欠損セル = false(未検証)。
	ColOkiVerified: true,
	// ★M28-02a: 旧 CSV(本列なし)の import を通す。欠損セル = NULL(未入力)。
	//   ★始動位置のマス数は欠損でも position から代表値が入る(サービス層の不変条件)。
	//     ⇒ 旧 CSV を取り込んでも「不問」に落ちない。
	ColStartPositionMass: true,
	ColCarryDistanceMass: true,
	// ★M37-07: 旧 CSV(本列なし)の import を通す。欠損セル = false(通常始動)。
	//   ★列は NOT NULL DEFAULT 0 であり、「不明」という状態を持たない。
	ColStarterMeaty: true,
}

// requiredImportColumns は buildHeaderIndex が存在を要求する必須列(= CSVColumns から
// optionalImportColumns を除いたもの)。旧 CSV(消費列なし)の import を通すために用いる。
var requiredImportColumns = func() []string {
	out := make([]string, 0, len(CSVColumns))
	for _, c := range CSVColumns {
		if !optionalImportColumns[c] {
			out = append(out, c)
		}
	}
	return out
}()

// ── セットプレイ CSV(FR401/405・別ファイル・M13-01 新設)の列ヘッダ名 ───────
const (
	ColSetupParentComboLocalID = "parent_combo_local_id" // コンボ CSV の local_id を参照
	ColSetupName               = "name"                  // setups.name(VAL-S06 必須)
	ColSetupDescription        = "description"           // setups.description
	ColSetupRecipe             = "recipe"                // セル内 JSON: [{move_code,modifiers}]
)

// SetupCSVColumns はセットプレイ CSV の正準の列順。
var SetupCSVColumns = []string{
	ColSetupParentComboLocalID,
	ColSetupName,
	ColSetupDescription,
	ColSetupRecipe,
}
