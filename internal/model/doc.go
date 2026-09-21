// Package model はドメインモデル(DB マッピング構造体・業務モデル)を提供する。
//
// 各構造体は DES-003 §3.1〜§3.13 のテーブル定義と対応する。
// `db:"<col>"` タグはリポジトリ層が手書きクエリで Scan する際の参考、
// `json:"camelCase"` タグはハンドラ層が API レスポンス直列化で使う。
//
// 主要設計判断:
//   - Combo は集約モデル: `Combo.Steps []ComboStep` を持つ(設計担当指示)。
//     一覧 API では `Steps == nil`、詳細 API では IN 句バッチクエリでバケット化して注入。
//     nil = 未ロード規約(リポジトリ層 godoc 参照)。
//   - Modifiers は型付き struct(`*Modifiers`):
//     SUPP-001 §3.3 の flags / type / notes に対応する型安全な構造。
//     DB の生 JSON ↔ Go struct 変換はリポジトリ層が json.Unmarshal/Marshal で行う(案 B)。
//   - JSON カラム(situation、recipe_cache、custom_states、raw_data)は
//     `*string` で生 JSON をそのまま保持し、必要時にサービス層がパースする
//     (moves.combo_scaling は M14-01 で削除)。
//   - NULL 許容カラムは `*T`(ポインタ)で表現する。
//   - 起き攻め BOOLEAN 6 カラム(CHANGE-001 反映)、CHANGE-006: counter_type → hit_type 反映。
package model
