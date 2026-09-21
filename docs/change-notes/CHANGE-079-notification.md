# CHANGE-079 通知書: 距離除外の 2 層フラグ（G-d・pruning＝マッチアップ単位／curation＝個別コンボ単位の 2 表）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-079 |
| サブマイルストーン | M18-01（スキーマ基盤） |
| 起票日 | 2026-07-19（**再起票**＝当初は単一表 combo_punish_exclusions。M18 指示書担当の粒度指摘＋開発者承認 2026-07-19 で 2 表へ是正。番号 079 保持） |
| 起票者 | 設計担当 Claude（M18 期・中央） |
| 承認者 | 開発者（承認ゲート G-d・粒度是正〔案 G-d-A〕承認 2026-07-19／実装・レビューは後続） |
| ステータス | **起票（着手前ゲート・実装待ち）**。DES-003・DES-005 → 実装後に改訂 / 他 変更なし予定 |
| 影響設計書 | **DES-003**（combo_punish_prunings・combo_punish_curations 追加）・**DES-005**（pruning/curation UI＝M18-02/03）。**反映は実装後** |
| 関連 | M18-overview §3・プラン **v0.5.0-plan** §3.2・spec §4.1／§4.2／§6-3／**§8-3（残す単位＝個別コンボ）**・phase3-overview §2.4 G-d |

---

## 1. 変更の概要
確定反撃の**距離除外を 2 層**で永続化する。**pruning**（物理的に無理＝候補ですらない）と **curation**（届くが使わない＝**非採用を隠す**）は**粒度が異なる**（spec §8-3「マイリストの残す単位＝個別コンボ」）ため、**2 表**で表す：
- `combo_punish_prunings`＝**マッチアップ単位**（この相手技はこのマッチアップで届かない）。
- `combo_punish_curations`＝**個別コンボ単位**（この始動技/コンボの反撃候補を隠す）。keep（combo_punishes）と対称。

**非破壊**（新規 CREATE TABLE ×2・1 マイグレ）。除外理由メモ `note` を各表に持つ。着手前ゲート＝反映案。

> **再起票の経緯**: 当初 079 は単一表 `combo_punish_exclusions(self_character_id, opponent_move_id, exclusion_type)`（両層マッチアップ単位）で起票したが、これでは curation の「個別コンボ単位の隠し」を表現できない（相手技への反撃を一括で隠すことしかできない）。M18 指示書担当が spec §8-3 と突合して指摘。開発者承認（案 G-d-A・2 表）を得て再起票。**未実装のため低コスト・番号 079 保持**。

## 2. 変更の内容（DES-003 / DES-005）

| # | 対象 | 変更 |
|---|------|------|
| a | 新テーブル combo_punish_prunings | `id` / `self_character_id`(FK characters) / `opponent_move_id`(FK moves) / `note`(TEXT nullable) / timestamps。**UNIQUE(self_character_id, opponent_move_id)**／INDEX(opponent_move_id) |
| b | 新テーブル combo_punish_curations | `id` / `combo_id`(FK combos ON DELETE CASCADE) / `opponent_move_id`(FK moves) / `note`(TEXT nullable) / timestamps。**UNIQUE(combo_id, opponent_move_id)**／INDEX(opponent_move_id) |
| c | 粒度 | pruning=マッチアップ単位／curation=個別コンボ単位（非対称は意図＝pruning は物理事実・curation はコンボ単位の取捨） |

## 4. 確定した設計判断（プラン v0.5.0-plan §3.2・決定 #6 精緻化）

| 項目 | 判断 | 根拠 |
|------|------|------|
| pruning 粒度 | マッチアップ単位 (self_char, opponent_move) | spec §4.1「そもそも届かない」＝物理事実 |
| curation 粒度 | 個別コンボ単位 (combo_id, opponent_move) | **spec §8-3「残す単位＝個別コンボ」**。keep と対称 |
| 構造 | 2 表（案 G-d-A） | 粒度・UNIQUE・finder クエリが素直（案 B 単一表 nullable より明快） |
| note | 各表に除外理由メモ | 要望②（距離判断等の記録） |
| 相手キャラ id | join 導出（明示列なし） | #8 と同方針 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 | combo_punish_prunings・combo_punish_curations 追加（実装後反映） |
| 設計書本体 | DES-005 | pruning UI（探す＝§4.1）／curation UI（使う＝§4.2）（M18-02/03・実装後反映） |
| 設計書本体 | REQ-001・DES-001/002/004/006・SUPP-001 | **変更なし予定** |
| マイグレ | 新規連番 1 本（見込み 000037） | 実装時払い出し（予約帯なし）。**両表を 1 マイグレで CREATE**。down で 2 表 DROP |
| リスク | curation の CASCADE | combo 削除で当該 curation 行も削除（意図どおり）。pruning は combo 非依存（マッチアップ事実）で残る |

## 6. 直列化・後続
registry で 079 を **2 表版へ再起票**（版 bump・番号保持）。搬送順 G-c(078)→G-d(079)→G-e(080)→G-b(081)。実装完了後に改訂 DES-003/005＋change-report-079＋registry（079 反映）で三点セット確定。実装は M18-01（Opus 4.8＋Plan）。UI は M18-02（pruning・探す）／M18-03（curation・使う）。

## 7. 開発者への確認事項
なし（案 G-d-A 承認済・粒度是正反映済）。

---

> 起票（着手前ゲート・反映案・**再起票**）。実装完了後に改訂 DES-003/DES-005 ＋ change-report-079 ＋ registry（079 反映）を確定。

*以上、CHANGE-079 通知書（再起票・2 表版）。配置 `docs/change-notes/CHANGE-079-notification.md`。*
