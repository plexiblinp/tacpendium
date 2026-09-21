# CHANGE-025 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-025 v0.1.0(FR701 実データ反映訂正①: スキーマ・enum・seed) |
| 反映日 | 2026-06-11(同期フロー手順2) |
| 反映者 | 設計担当 Claude(フェーズ2 継続担当) |
| 承認 | 開発者(2026-06-11) |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-003 | v1.17.0 → v1.18.0 | §3.3 `startup` / `total` を NOT NULL → NULL 可(「全技値を持つ前提」撤回)、category enum に `critical_art` 追加、code 例を `standing_medium_punch` へ、status 更新 |
| DES-004 | v1.5.0 → v1.6.0 | §2.1 code 規約を英語表示名の機械変換へ統一(`standing_`/`crouching_`/`jumping_` 接頭辞・強度接尾辞・slug 連結 `aki`/`c_viper`/`m_bison`・`_2` フォールバック・`ca`/critical_art・`throw_forward`/`throw_back`)、rush 例を `standing_` 形へ、status 更新 |

## 派生反映(自由改訂)

- M8-01 製造指示書 v1.0.0 → v1.1.0:nullable ADD COLUMN 化・一時 DEFAULT / backfill 廃止。
- change-number-registry:§1 で 025 を反映済み、§3 改訂表に 2 行、§4 履歴 v1.13.0。

## 移行の確定

- 既存 seed(moves 186件・characters)は削除・ツール再生成前提。参照 combos / combo_steps / recipe_cache はクリア(配布 DB・開発 DB ともクリーン再構築)。seed クリア + 再生成のマイグレーションは M9 で設計、M8-01 はスキーマ追加(nullable)のみ。

## 留意(後続)

- `total` NULL の下流影響(ソート・表示・バリデーション)は DES-005 / DES-006 で確認し、M9 / CHANGE-026 で追従。
- code 接頭辞 `crouching_` / `jumping_` は「英語表示名機械変換」の正規形として `standing_` と同規約で更新(開発者が明示したのは `standing_`)。差異があれば指摘されたい。

*以上、CHANGE-025 反映レポート*
