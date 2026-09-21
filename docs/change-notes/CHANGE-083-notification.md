# CHANGE-083 通知書: combo_punish_starters 新設（M18-02・始動技レベルの検証結果を保存）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-083 |
| サブマイルストーン | M18-02（確定反撃サーチ・探す画面） |
| 起票日 | 2026-07-23 |
| 起票者 | 設計担当 Claude（M18 期・中央） |
| 承認者 | 開発者（**新テーブル＝承認ゲート**。M18-02 承認請求 v1.1.0 請求 1・2026-07-23 承認） |
| ステータス | **起票（着手前ゲート・実装待ち）**。DES-003・DES-005 → 実装後に改訂 |
| 影響設計書 | **DES-003**（新表追加）・**DES-005**（探す画面ツリー 3 階層の検証 UI）。**反映は実装後**（M17-D10） |
| 関連 | M18-02 承認請求 v1.1.0 §1／M18-02-RESEARCH-01-report（2026-07-23）／M18-02 設計骨子 v0.6.0／CHANGE-078・079（既存 3 表との粒度差） |

---

## 1. 変更の概要
確定反撃サーチのツリーを **3 階層（相手技 → 始動技 → コンボ）** にするのに伴い、**ユーザーが実践で距離検証した結果を「始動技レベル」で保存**する表を新設する。既存 3 表はいずれも粒度が合わない（`combo_punishes`／`combo_punish_curations`＝**コンボ単位**、`combo_punish_prunings`＝**相手技ごと一括**）。**非破壊**（新規 CREATE TABLE）。着手前ゲート＝反映案。

## 2. 変更の内容（DES-003 / DES-005）

| # | 対象 | 変更 |
|---|------|------|
| a | 新表 combo_punish_starters | `id` / `self_character_id`(FK characters) / `opponent_move_id`(FK moves) / `starter_move_id`(FK moves) / `verdict`(TEXT NOT NULL='adopted'\|'unreachable') / `note`(TEXT nullable) / `created_at` / `updated_at` |
| b | 制約・index | **UNIQUE(self_character_id, opponent_move_id, starter_move_id)** ／ **INDEX(opponent_move_id)** |
| c | 用途 | **探す画面（M18-02）専用＝検証の作業状態**。採用確定反撃画面（M18-03）は `combo_punishes` だけで引くため **M18-03 は新スキーマ不要の見込み** |
| d | UI（DES-005） | 3 階層ツリーでの始動技単位の採用／到達不能マーク（実装後に §5.x へ反映） |

## 4. 確定した設計判断

| 項目 | 判断 | 根拠 |
|------|------|------|
| 粒度 | **始動技レベル**（self_character × 相手技 × 始動技）。既存 3 表と重複しない | 承認請求 §1・粒度分析 |
| `verdict` の値域 | **自由 TEXT ＋ VAL 担保・DB CHECK は新設しない** | CHANGE-082 で確立した現行方針の踏襲 |
| timestamps | `TEXT` | M18-01 で確立した新表の統一方針（DES-003 §3.17 注記） |
| 相手/自キャラ | 相手キャラは `opponent_move_id → moves.character_id` で導出（明示列なし） | CHANGE-078/079 と同方針 |
| ジャンプ攻撃 | **本表がそのまま使える**（`starter_move_id` に空中技 id が入るだけ）＝追加スキーマ不要 | 承認請求 §3.3・DES-004 §2.3(c)／SUPP-001 §3.3.2（純移動のジャンプ move はステップに含めない） |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 | combo_punish_starters 定義追加（実装後反映） |
| 設計書本体 | DES-005 | 3 階層ツリー・検証 UI（実装後反映） |
| 設計書本体 | REQ-001・DES-001/002/004/006・SUPP-001 | **変更なし予定** |
| マイグレ | 新規連番 1 本（**実装着手時に中央へ請求**・見込み 000040） | CREATE TABLE＋INDEX。down で DROP |
| リスク | 既存 3 表との役割混同 | 用途を「探す画面の検証作業状態」に限定（採用の正＝`combo_punishes`）。DES-003 に役割差を明記 |

## 6. 直列化・後続
registry で 083 起票（次 084）。実装完了後に改訂 DES-003/005＋change-report-083＋registry（083 反映）で三点セット確定。実装は M18-02（Opus 4.8＋Plan 必須）。**マイグレ連番は実装着手時に中央が実査払い出し**（予約帯なし＝§21.1）。

## 7. 開発者への確認事項
なし（新テーブル承認済み・粒度/値域/timestamps は決定反映済み）。

---

> 起票（着手前ゲート・反映案）。実装完了後に改訂 DES-003/DES-005 ＋ change-report-083 ＋ registry（083 反映）を確定。

*以上、CHANGE-083 通知書。配置 `docs/change-notes/CHANGE-083-notification.md`。*
