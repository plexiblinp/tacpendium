# CHANGE-081 通知書: moves.is_projectile 追加（G-b・飛び道具判別＋ジャストパリィ有利算出の前提）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-081 |
| サブマイルストーン | M18-01（スキーマ基盤） |
| 起票日 | 2026-07-19 |
| 起票者 | 設計担当 Claude（M18 期・中央） |
| 承認者 | 開発者（承認ゲート G-b・2026-07-19 個別承認済／実装・レビューは後続） |
| ステータス | **起票（着手前ゲート・実装待ち）**。DES-003・DES-004 → 実装後に改訂 / 他 変更なし予定 |
| 影響設計書 | **DES-003**（moves 列追加）・**DES-004**（move 正典に is_projectile）。**反映は実装後**。算出式は service 層（M18-02） |
| 関連 | M18-overview §3・プラン v0.5.0-plan §2／§3.4・M18-RESEARCH-01-report・spec §8・phase3-overview §2.4 G-b |

---

## 1. 変更の概要
ジャストパリィ確定反撃の有利フレーム算出において**飛び道具は計算式が異なる**（距離依存で recovery が便宜値 0 になる＝RESEARCH 実測）。飛び道具を判別する列 `moves.is_projectile` を追加する。**初期値は是正後 CSV の is_projectile=true を backfill UPDATE で投入**（seeded-10＝104・うち**是正 7 件を本 CHANGE に同梱**。**seedgen は非改変**＝2026-07-22 中央確定）。**非破壊**（ADD COLUMN・DEFAULT 0）。算出式そのものは service 層で M18-02 が実装（本 CHANGE はスキーマ＋初期値）。着手前ゲート＝反映案。

## 2. 変更の内容（DES-003 / DES-004）

| # | 対象 | 変更 |
|---|------|------|
| a | moves 列追加 | `is_projectile INTEGER NOT NULL DEFAULT 0`（bool 0/1） |
| b | 初期値投入（**backfill 専用・seedgen 非改変**／是正 7 件同梱・中央確定 2026-07-22） | **マイグレ内の決定論 backfill UPDATE のみ**で是正後 CSV の is_projectile=true 群（seeded-10）を 1 に更新。**`internal/seedgen` は改変しない**（seedgen 版数対応＋golden 版数対応が要り M18-01 スコープ外・既作成の M14-03d/e 指示書との齟齬回避＝E-14）。**CSV 是正 7 件を本 CHANGE に同梱**（kimberly `shuriken_bomb_{light,medium,heavy}`＋`_spread_{light,medium,heavy}` 6・juri `fuha_saihasho` 1・false→true・seeded-10・開発者確定）。**検算＝seeded-10 は 97→104（是正 7）／全 CSV は 102→109**（change-report-081 に集約・E-16/E-18）。**★未 seed の manon/luke（true 5 件）は本 backfill の対象外＝既定値 0 のまま残る**（自動反映されない）→ §5 申し送り |
| c | 用途 | **projectile を自動走査から除外**する唯一の一次源（on_block-NULL は判別に使えない＝RESEARCH。除外技は管理画面に「距離依存・手動確認」表示） |

## 4. 確定した設計判断（プラン §2・決定 #3/#4/#5）

| 項目 | 判断 | 根拠 |
|------|------|------|
| 判別源 | is_projectile を唯一の一次源に | 決定#4・on_block-NULL 率は projectile/非で同水準 |
| 初期値 | **backfill 専用**（是正後 seeded-10＝104・是正 7 同梱）。**seedgen 非改変** | 決定#3 を **#3-rev で改訂**（2026-07-22 中央確定・M18 担当上申）。理由＝seedgen 改変は版数/golden 対応を伴い M18-01 スコープ外・既作成 M14-03d/e 指示書との齟齬回避（E-14） |
| 算出式 | 有利＝ガード `-(on_block)`／ジャストパリィ `recovery`・成立⟺始動 startup≤有利。projectile と on_block/recovery NULL は自動走査除外（画面表示・手動入力可） | プラン §2・spec §8 |
| recovery=0（非 projectile） | 有効値 0 として判定に委ねる（条件付き）。**別途 `M18-RESEARCH-01-addendum` でデータ品質確認** | 決定#5 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 | moves.is_projectile 追加（実装後反映） |
| 設計書本体 | DES-004 | move 正典に is_projectile（実装後反映） |
| 設計書本体 | REQ-001・DES-001/002/005/006・SUPP-001 | **変更なし予定** |
| マイグレ | 新規連番（見込み 000039） | 実装時払い出し（予約帯なし）。ADD COLUMN＋是正後 true の決定論 backfill UPDATE（seeded-10＝104・是正 7 同梱）。down で DROP COLUMN |
| 関連 | seedgen | **本 CHANGE では改変しない**（`internal/seedgen` は現状の「is_projectile を保全のみ」を維持）。将来の inline 出力（seedgen 版数対応＋golden 版数対応）は M18-01 スコープ外＝**M14-03d/e 着手時に判断** |
| **★申し送り（未 seed キャラ）** | **M14-03d（manon）／M14-03e（luke）** | seedgen が is_projectile を出力しないため、**後続の seed 波で投入される moves は is_projectile=0 で入る**（manon/luke の true 5 件）。**放置すると M18-02 の走査で飛び道具が projectile 除外されず結果が誤る**。→ **M14-03d/e の作業項目に「is_projectile backfill」を必須で追加**（seed INSERT 後に当該波の true 群を UPDATE）。以降の seed 波も同様（seedgen が inline 出力を持つまで）。followup-backlog に繰越登録 |

## 6. 直列化・後続
registry v1.70.0 で 081 起票。搬送順の末尾（G-b）。実装完了後に改訂 DES-003/004＋change-report-081＋registry（081 反映）で三点セット確定。実装は M18-01（Opus 4.8＋Plan）。算出式・走査サービスは M18-02。データ品質チェック（非 projectile の recovery=0）は addendum で先行実施可。

## 7. 開発者への確認事項
なし（G-b 承認済・型/初期値/算出式は決定反映済）。`M18-RESEARCH-01-addendum` の結果次第でデータ修正の要否を別途判断。

---

> 起票（着手前ゲート・反映案）。実装完了後に改訂 DES-003/DES-004 ＋ change-report-081 ＋ registry（081 反映）を確定。

*以上、CHANGE-081 通知書。配置 `docs/change-notes/CHANGE-081-notification.md`。*
