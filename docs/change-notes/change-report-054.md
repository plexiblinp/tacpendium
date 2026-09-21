# change-report-054: CHANGE-054 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-054（M14-01 実装反映＝moves 観測不能6列削除＋recovery追加＋raw_data退避キー除去） |
| 反映日 | 2026-06-30 |
| 反映担当 | 設計担当 Claude（M14 担当） |
| 起票文書 | `docs/change-notes/CHANGE-054-M14-01-schema-cleanup.md` |
| ステータス | **反映（DES 適用済み・commit は開発者）**。DES-003 v1.22.0→v1.23.0 / DES-005 v2.28.0→v2.29.0 / DES-002 v1.26.0→v1.27.0 |
| 背景 | M14-01 実装・レビュー・E2E 完了。製造→設計 伝達メモ §1〜§5 の確定スキーマを DES-003/005/002 に反映。 |

---

## 1. 反映するファイル（旧→新）

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-003 データモデル | v1.22.0 → **v1.23.0**（§3.3：moves 6列削除・recovery 追加・raw_data 退避5キー除去/空→NULL） |
| DES-005 画面設計 | v2.28.0 → **v2.29.0**（§5.18：編集グリッド項目・列ラベル「硬直」・warnings 縮小） |
| DES-002 アーキテクチャ | v1.26.0 → **v1.27.0**（§4.2：フィールド増減・warnings 縮小・一覧 recovery 露出） |

> **§7.5（取込 CSV 契約）の扱い**: DES-002 §7.5 は recovery 非永続・削除列マッピングを含むが、これは FR704 取込の契約であり **M14-02 の FR704 降格で降格・改訂**する（本 CHANGE では §4.2 技編集経路のみ反映）。M14-01〜M14-02 間の一時不整合は取込実行禁止ガードレール（§6）下で許容し、M14-02 で恒久解消。

DES-006 / DES-001 / DES-004 / REQ-001 は変更なし。

> バージョン bump 値は各 DES の現行版に +0.1.0（着手時に docs-map/実ファイルで現行版を確認して確定）。

## 2. 修正概要

- **DES-003 §3.3**: `properties`/`combo_scaling`/`drive_gauge_increase`/`drive_gauge_decrease_guard`/`drive_gauge_decrease_punish`/`super_art_gauge_increase` を削除。`recovery INTEGER`（NULL 可・手入力）追加（**CHANGE-022 の非保持決定を反転**）。raw_data から退避5キー除去・空→NULL・notes/notes_tool 温存。
- **DES-005 §5.18**: 編集グリッドから properties（Select）・combo_scaling（詳細欄）削除、recovery 整数入力欄追加（列ラベル「硬直」）、表示列 properties→recovery。
- **DES-002 §4.2**: GET/PATCH /api/moves から6列除去・recovery 追加、warnings 再導出を total_null/extra_throw に縮小、一覧 MoveResponse に recovery 露出。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-006 | **変更なし** | recovery 値域 VAL を新設せず（既存フレーム列と同じ寛容方式・伝達メモ §1-B）。削除6列に専用 VAL は元来なし |
| DES-002 §7.6（コンボ CSV 契約） | **変更なし** | 意味単位（code ベース・DB 管理列除外）で moves 列に非依存。往復不変（M13-6） |
| DES-004（move_code 正典） | **変更なし** | code/正典は不変。削除は属性列のみ |
| 取込（DES-002 §7.5 / §4.2 import）・画面17（DES-005 §5.17） | **本 CHANGE 対象外** | M14-02 で FR704 降格・削除（伝達メモ §2-D/§2-E） |

## 4. 整合性チェック結果

- DES-003 §3.3 の moves 列と DES-002 §4.2 の API フィールド・DES-005 §5.18 の編集列が新構成で一致。
- warnings 縮小（total_null/extra_throw）が DES-002 §4.2 と DES-005 §5.18（要確認再導出）で整合。
- recovery 追加と CHANGE-022（旧・非保持）の関係を「M14-01 で反転」と明記し矛盾回避。
- export/import 契約（DES-002 §7.6）は意味単位で moves 列非依存＝非回帰（E2E 確認済み）。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | §1 で 054 を反映（次 055）、§3 改訂表に 3 行（DES-003/005/002）、§4 版ログ追記（**承認・commit 後に確定**） |
| followup-backlog | §C に M14-01 完了・M14-02 回収項目（F1 dead code・F2 FE import 型/画面17 契約ずれ・F3 取込退避キー再生成＋取込実行禁止ガードレール）を追記 |
| 改訂 DES ファイル | 通知書 §7-3 で適用要否を確認（DES-001 と同様。要すれば §2 を適用したファイルを生成。commit は開発者） |
| M14-02 指示書 | F1/F2/F3 と取込実行禁止ガードレールを §1.3/§4 に内包 |
| retrospective-log | M14 教訓は M14 全完了時に追記（CHANGE-022 反転・意味単位 export の頑健性実証・json_remove/DROP COLUMN 技術事実）。本サブでは未追記 |
| docs-map | DES バージョンは次回再生成で追従 |

## 6. 残ゲート（開発者）

- 本 CHANGE（DES-003/005/002）の承認・commit/push。
- 通知書 §7 の確認 3 件（反映確定・ガードレール周知・改訂 DES 適用要否）。

---

*以上、change-report-054（反映案・承認待ち）。配置 `docs/change-notes/change-report-054.md`。*
