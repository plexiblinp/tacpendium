# CHANGE-078 通知書: combo_punishes 中間テーブル新設（G-c・combo↔相手技の多対多）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-078 |
| サブマイルストーン | M18-01（スキーマ基盤） |
| 起票日 | 2026-07-19 |
| 起票者 | 設計担当 Claude（M18 期・中央） |
| 承認者 | 開発者（承認ゲート G-c・2026-07-19 個別承認済／実装・レビューは後続） |
| ステータス | **起票（着手前ゲート・実装待ち）**。REQ 不変予定 / DES-003・DES-002 → 実装後に改訂 / 他 DES 変更なし予定 |
| 影響設計書 | **DES-003（データモデル）**（combo_punishes 追加）・**DES-002 §7（API）**（紐づけ endpoint 候補）。**DES 本体反映は実装完了後**（M17-D10） |
| 関連 | M18-overview v0.1.1 §3・M18 物理設計プラン v0.5.0-plan §3.1・spec §6-1・phase3-overview §2.4 G-c |

---

## 1. 変更の概要
確定反撃のコンボと「どの相手技への反撃か」を結ぶ**多対多の中間テーブル `combo_punishes`** を新設する。**キュレート分（採用した紐づけ）のみ保存**し、「刺さり得る」全集合は導出（非保存）。**非破壊**（新規 CREATE TABLE・既存行への影響なし）。本通知書は着手前ゲート＝反映案。DES 本体反映・change-report は実装完了後。

## 2. 変更の内容（DES-003 / DES-002）

| # | 対象 | 変更 |
|---|------|------|
| a | 新テーブル combo_punishes | `id` / `combo_id`(FK combos ON DELETE CASCADE) / `opponent_move_id`(FK moves) / `note`(TEXT nullable=採用理由) / `created_at` / `updated_at` |
| b | 制約・index | **UNIQUE(combo_id, opponent_move_id)**／INDEX(opponent_move_id) |
| c | guard_type | **持たない**（block/ジャストパリィ の別は紐づくコンボの hit_type で判別＝CHANGE-082） |
| d | API（DES-002 §7 候補） | combo↔相手技 の紐づけ CRUD endpoint（実装時に §7 へ具体化） |

## 4. 確定した設計判断（プラン §3.1・決定 #8）

| 項目 | 判断 | 根拠 |
|------|------|------|
| キー | combo_id＋opponent_move_id で十分（自/相手キャラ id は join 導出・明示列なし） | 決定#8・非正規化は将来必要時 |
| 一意性 | UNIQUE(combo_id, opponent_move_id)。block/ジャストパリィ両立は別コンボ（hit_type）で表現 | #3 で confirm#a 消滅 |
| note | (コンボ↔相手技) 固有の採用理由。combo 全体は既存 memo を流用 | 要望② |
| dup/recipe_hash | 非対象（紐づけは同一性に影響しない） | プラン §3.1 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 | combo_punishes 定義追加（実装後反映） |
| 設計書本体 | DES-002 §7 | 紐づけ endpoint（実装後反映） |
| 設計書本体 | REQ-001・DES-001・DES-004・DES-005・DES-006・SUPP-001 | **変更なし予定**（本 CHANGE はスキーマ追加のみ） |
| マイグレ | 新規連番（見込み 000036） | **実装着手時に中央が実査払い出し**（予約帯なし・§21.1）。CREATE TABLE・down で DROP |
| リスク | FK CASCADE | combo 削除時に紐づけも削除（意図どおり）。**FK=OFF × 明示 DELETE を同一指示書に同居させない**（digest §5） |

## 6. 直列化・後続
registry v1.70.0 で 078 起票（次 083）。搬送順 G-c(078)→G-d(079)→G-e(080)→G-b(081)、hit_type(082)。**実装完了後**に改訂 DES-003/002＋change-report-078＋registry（078 反映）で三点セット確定。実装は M18-01（Opus 4.8＋Plan）。

## 7. 開発者への確認事項
なし（承認ゲート G-c 承認済・キー/一意性/note は決定反映済）。実装着手時にマイグレ連番の払い出しを中央へ請求のこと。

---

> 起票（着手前ゲート・反映案）。実装完了後に改訂 DES-003/DES-002 ＋ change-report-078 ＋ registry（078 反映・次 083）を確定。

*以上、CHANGE-078 通知書。配置 `docs/change-notes/CHANGE-078-notification.md`。*
