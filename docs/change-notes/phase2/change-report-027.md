# CHANGE-027 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-027 v0.1.0(FR701 CSV 契約拡張③: command/condition 列 + raw_data 退避) |
| 反映日 | 2026-06-11(同期フロー手順2) |
| 反映者 | 設計担当 Claude(フェーズ2 継続担当) |
| 承認 | 開発者(2026-06-11) |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-002 | v1.11.0 → v1.12.0 | §7.5 CSV 列に `command` / `condition_ja` / `condition_en` の 3 列追加(反映先 = moves.raw_data 同名キー)+ raw_data 退避方針の明記(moves 専用列なし・マイグレ不要・official_ja_command 接続はフェーズ3以降)。CHANGE-026 と同一版 v1.12.0 に集約 |
| DES-003 | v1.17.0 → v1.18.0 | §3.3 raw_data 注記に退避キー `command`/`condition_ja`/`condition_en` を明記。CHANGE-025 と同一版 v1.18.0 に集約 |

## 確定方針

- スキップでなく **raw_data 退避**を採用(FR703 手動補正への再取込上書き事故を回避)。
- command のトークン語彙・シリアライズは TOOL-002 §9.9 を単一の正とし、本体は参照のみ。
- moves スキーマ変更なし = マイグレーション不要。

## 派生反映(自由改訂)

- change-number-registry:§1 で 027 を反映済み、§4 履歴 v1.13.0。

*以上、CHANGE-027 反映レポート*
