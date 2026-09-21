# CHANGE-080 通知書: combos.materialized_from_combo_id 追加（G-e・materialize 出自参照）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-080 |
| サブマイルストーン | M18-01（スキーマ基盤） |
| 起票日 | 2026-07-19 |
| 起票者 | 設計担当 Claude（M18 期・中央） |
| 承認者 | 開発者（承認ゲート G-e・2026-07-19 個別承認済／実装・レビューは後続） |
| ステータス | **起票（着手前ゲート・実装待ち）**。DES-003・DES-002 → 実装後に改訂 / 他 変更なし予定 |
| 影響設計書 | **DES-003**（combos 列追加）・**DES-002 §7**（materialize endpoint 候補）。**反映は実装後** |
| 関連 | M18-overview §3・プラン v0.5.0-plan §3.3・spec §2／§6・phase3-overview §2.4 G-e |

---

## 1. 変更の概要
確定反撃版を**別コンボとして materialize**（実体化）する際の**出自（生成元＝基底コンボ）参照**列を combos に追加する。**combos は相手技列を持たない**（相手技は combo_punishes 側）。生成後は独立フォーク。ドリフト検出（基底更新後に古い版を検出・再生成）は出自列で可能。**非破壊**（ADD COLUMN・nullable）。着手前ゲート＝反映案。

## 2. 変更の内容（DES-003 / DES-002）

| # | 対象 | 変更 |
|---|------|------|
| a | combos 列追加 | `materialized_from_combo_id INTEGER REFERENCES combos(id)`（self-FK・nullable。NULL=通常コンボ） |
| b | 意味 | 生成物はこの列で出自を記録・**生成後は独立フォーク**（基底の変更に自動追従しない） |
| c | 相手技参照 | combos は**持たない**（combo_punishes 側＝CHANGE-078） |
| d | API（DES-002 §7 候補） | materialize（生成）endpoint（実装時に §7 具体化・ダメージ規則/hit_type は M18-03） |

## 4. 確定した設計判断（プラン §3.3・決定 #4・確認#c）

| 項目 | 判断 | 根拠 |
|------|------|------|
| dup/recipe_hash | **非対象**（出自は同一性に影響しない） | 確認#c OK |
| ドリフト | 出自列で古い PC 版を検出・再生成可能 | spec §2 |
| 生成規則・hit_type | 本 CHANGE の対象外（M18-03＝CHANGE-082 hit_type と materialize 実装） | 二段分離 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 | combos.materialized_from_combo_id 追加（実装後反映） |
| 設計書本体 | DES-002 §7 | materialize endpoint（実装後反映） |
| 設計書本体 | REQ-001・DES-001/004/005/006・SUPP-001 | **変更なし予定** |
| マイグレ | 新規連番（見込み 000038） | 実装時払い出し（予約帯なし）。ADD COLUMN・down で DROP COLUMN（SQLite 再構築の要否は実装時判断） |

## 6. 直列化・後続
registry v1.70.0 で 080 起票。搬送順で G-d(079) の後・G-b(081) の前。実装完了後に改訂 DES-003/002＋change-report-080＋registry（080 反映）で三点セット確定。実装は M18-01（Opus 4.8＋Plan）。materialize の生成規則・ダメージ・登録導線は M18-03。

## 7. 開発者への確認事項
なし（G-e 承認済・dup 非対象は確認済）。

---

> 起票（着手前ゲート・反映案）。実装完了後に改訂 DES-003/DES-002 ＋ change-report-080 ＋ registry（080 反映）を確定。

*以上、CHANGE-080 通知書。配置 `docs/change-notes/CHANGE-080-notification.md`。*
