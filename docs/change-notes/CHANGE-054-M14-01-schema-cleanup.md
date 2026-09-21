# CHANGE-054 通知書: M14-01 実装反映（moves スキーマ整理＝観測不能6列削除＋recovery追加＋raw_data退避キー除去）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-054 |
| サブマイルストーン | M14-01 |
| 起票日 | 2026-06-30 |
| 起票者 | 設計担当 Claude（M14 担当） |
| 承認者 | 開発者（M14-01 実装・レビュー・E2E 完了。本通知書は実装で確定したスキーマの DES 反映） |
| ステータス | **反映案（commit は開発者）**。DES-003 / DES-005 / DES-002 を更新。本通知書 §2 を正とする |
| 影響設計書 | DES-003 / DES-005 / DES-002。**DES-006 は変更なし（漏れ検知＝§3-B）**。DES-001/004/REQ-001 変更なし |
| 関連 | M14-01 設計担当伝達メモ（製造→設計）§1〜§5 / 指示書 M14-01 v1.0.0 / M14-overview v1.0.0 §2.2/§2.3/§4.1/§4.5 / **CHANGE-022（recovery 非保持決定を本 CHANGE で反転）** |

---

## 1. 変更の概要

M14-01（moves スキーマ整理）の実装・レビュー・E2E 完了に伴い、確定したスキーマを設計書本体へ反映する（M13-01 の CHANGE-051 と同型＝実装後反映）。観測不能6列の削除・`recovery` 追加・`raw_data` 退避キー除去を DES-003 §3.3 / DES-005 §5.18 / DES-002 §4.2 に反映。

> **CHANGE-022 の方針反転**: CHANGE-022 は「`recovery` は moves に保持しない（total 算出材料として取込時のみ使用）」とした。M14-01 は `recovery` を**観測可能＝手入力で再現可**と判断し**列として追加**＝CHANGE-022 の当該決定を反転する。`total` は引き続き stored（既存行は再計算せず据置・新 seed は M14-03 で算出）。

> **集約**: M14-01 が触れた DES-003/005/002 を**本 CHANGE-054 に集約**して 1 件で反映（digest M13-4・番号節約・関心一貫）。DES-006 は recovery VAL 非新設のため変更なし。

## 2. 変更の内容

### DES-003 §3.3（moves 列定義・raw_data キー構造）

- **削除（6 列）**: `properties` / `combo_scaling` / `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase`。理由＝フレームデータのみに存在しゲーム上から観測できない（正確値が画面非表示）ため、配布禁止フレームデータ無しに手入力できない。FR307 下で自動消費されず参照表示のみ（消費者 grep 0 件で確証済み）。
- **追加（1 列）**: `recovery INTEGER`（NULL 可・手入力）。観測可能（training フレームメーター）。**CHANGE-022 の非保持決定を反転**。`total` 算出式（`startup+active−1+recovery`・案B）との関係は不変（既存行 total は stored 据置・新 seed で算出）。
- **raw_data**: 取込退避 5 サブキー（`command` / `condition_ja` / `condition_en` / `properties_extra` / `import_notes`）を除去。`notes` / `notes_tool`（技編集が表示/編集する自由メモ）は**温存**。**退避キー除去後に空オブジェクトになる行は NULL 化**（`{}` を残さない。§3-A）。これは §3.3「いずれも空なら省略」と整合。

### DES-005 §5.18（技編集グリッド）

- 編集対象から `properties`（Select）・`combo_scaling`（詳細欄）を削除。
- `recovery` 整数入力欄を追加（列ラベル「**硬直**」・既存 total/フレーム入力と同方式）。
- 表示列 `properties` → `recovery`。total / 各フレーム / is_aerial / rush 生成 / notes 付記（notes_tool）/ name_ja 表示は不変。

### DES-002 §4.2（GET/PATCH /api/moves）

- GET / PATCH `/api/moves` のフィールドから削除6列を除去、`recovery` を追加。
- **warnings 再導出を `total_null` / `extra_throw` のみに縮小**（`unknown_properties` / `unknown_combo_scaling_key` を撤去＝該当列消失で moot）。
- **一覧（`MoveResponse`）にも `recovery` を露出**（§3-C）。一覧 narrow は「技編集グリッドが直接編集するフレーム最小集合（total/startup/active/onHit/onBlock）」を持つ設計で、`recovery` はその一員として整合（「最小フィールド」原則の範囲内）。

## 3. 確定した設計判断（伝達メモ §1 への回答）

| 項目 | 判断 | 根拠 |
|------|------|------|
| (A) raw_data 空→NULL 化 | **是認・反映**（DES-003 §3.3 に「空オブジェクトは NULL 化・保持しない」を明記） | §3.3「いずれも空なら省略」と整合。`{}` 残置は矛盾 |
| (B) recovery 値域 VAL | **新設しない**（DES-006 変更なし） | 既存フレーム列（startup/active 等）と同じ寛容方式で一貫・取込寛容と整合。0+ 検証を入れるなら全フレーム列統一の別件 |
| (C) MoveResponse に recovery 露出 | **是認・反映**（DES-002 §4.2 に明記） | narrow は既にグリッド編集対象のフレーム最小集合を保持。recovery はその一員。「最小」原則の範囲内 |

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 §3.3 | §2（6列削除・recovery 追加・raw_data 退避5キー除去/空→NULL・CHANGE-022 反転） |
| 設計書本体 | DES-005 §5.18 | §2（編集グリッド項目・列ラベル「硬直」） |
| 設計書本体 | DES-002 §4.2 | §2（フィールド増減・warnings 縮小・一覧 recovery 露出） |
| 設計書本体 | DES-006 | **変更なし**（recovery VAL 非新設・漏れ検知） |
| 設計書本体 | DES-001/004/REQ-001 | **変更なし** |
| 実装 | M14-01（feature/m14-01・実装/レビュー/E2E 済） | 本反映と一致 |
| 一時不整合（M14-02 で解消） | 取込が退避キーを再生成 | §6 ガードレール参照（伝達メモ §2-D・§3-F3） |

## 5. 移行影響・リスク

- **破壊的スキーマ変更（列削除）**だが、export/import（FR401/405）は意味単位（code ベース・DB 管理列除外）で moves 列に非依存のため**往復は不変**（M13-6・E2E 確認済み）。
- マイグレ 000018 は `ALTER TABLE DROP COLUMN`（再構築不要・索引/FK 非参照）＋`recovery` ADD＋raw_data JSON UPDATE。`dbtest.Setup` 経由の全テスト通過・down 整合済み（伝達メモ §5）。
- 既存 ryu 56 行の `recovery` は NULL（M14-03 で backfill）。

## 6. 直列化・ガードレール

- **M14-01 → M14-02 は直列**（共有シンボル・movesimport 整理の順序依存）。
- **ガードレール（重要・伝達メモ §2-D/§3-F3）**: M14-01〜M14-02 の間に**公式データ取込（画面17）を実行しない**こと。取込は退避キー（command/condition_*/properties_extra/import_notes）を raw_data に再生成し続けるため、000018 でクリーンにしたデータが汚れる。M14-02 で取込を削除すれば恒久解消。
- DES-003/005/002 を触る他 CHANGE は現時点でなし（M14-02 は別 §＝FR704/§7.5/§5.17・REQ-001）。

## 7. 開発者への確認事項

1. **本反映の確定**: §2 の DES-003 §3.3 / DES-005 §5.18 / DES-002 §4.2 反映でよいか（CHANGE-022 の recovery 非保持反転を含む）。
2. **DES 外ガードレールの周知**: M14-02 着手までの取込実行禁止（§6）を運用上守れるか（単一開発者・直列運用のため低リスク）。
3. **改訂 DES ファイルの適用**: DES-003/005/002 の改訂ファイル生成を要するか（DES-001 と同様。要すれば本 §2 を適用したファイルを生成）。

---

> 反映案（commit は開発者）。承認後に change-report-054 / change-number-registry（054 反映・次 055）を確定。

*以上、CHANGE-054 通知書。配置 `docs/change-notes/CHANGE-054-M14-01-schema-cleanup.md`。*
