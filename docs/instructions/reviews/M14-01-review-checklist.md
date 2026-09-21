# M14-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-01-schema-cleanup.md` v1.0.0（スキーマ整理＝moves 6 列削除 ＋ recovery 追加 ＋ raw_data 退避キー除去） |
| 対象指示書ID | M14-01 |
| レビューモデル | Sonnet 4.6（model-allocation v1.24.0 参照。実使用は開発者判断） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（指示書 v1.0.0 と対）。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: `docs/instructions/M14-01-schema-cleanup.md` v1.0.0、`docs/instructions/M14-overview.md` v1.0.0 §2.2/§2.3/§4.1/§4.5、DES-003（`docs/design/03-data-model.md`）§3.3、DES-002（`docs/design/02-architecture.md`）§4.2、DES-005（`docs/design/05-screen-design.md`）§5.18、M14-RESEARCH-01-report（`docs/progress/M14-RESEARCH-01-report.md`）§A/§D、code-facts（`docs/handover/code-facts.md`）§8/§9/§10、retrospective-digest §5。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.4 の **7 項目すべて**（1 削除6列の消費者 grep / 2 参照経路の全列挙 / 3 recovery 仕様 / 4 raw_data UPDATE 方式 / 5 マイグレ 000018 技法 / 6 警告再導出の縮小 / 7 total 据置）に Plan Mode 質問書 + 開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大（§9 = 推測実装）。

### 0.2 レビューの基本姿勢

- 機械的チェック（§1〜§4・§6・§7）に加え、設計意図（§5）の精神に沿うかを確認する。
- 破壊的マイグレは E2E が重い。**マイグレ up/down・dbtest.Setup 波及・down 整合**をコードとテストで確認し、目視は手順書で補う。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。重大は完了承認を妨げる。

---

## 1. 設計書本体・上位文書との照合（最重要）

### 1.1 削除6列（DES-003 §3.3・指示書 §4.1）

- [ ] DB から `properties` / `combo_scaling` / `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase` が 000018 で DROP されているか。
- [ ] Go の `model.Move`・`MoveDetailResponse`・`MoveResponse`（narrow）・`UpdateMoveRequest`・repository `UpdateMoveFields` と関連 SELECT/INSERT/UPDATE 列から削除6列が消えているか。
- [ ] FE の `Move` 型・`MoveEditGrid`（`web/src/features/moves/MoveEditGrid.tsx`）から削除6列の編集欄/列が消えているか。
- [ ] `properties` の PATCH 値域検証（`movesimport.IsKnownProperty` 呼び出し・`internal/service/move/service.go`）が除去されているか（関数本体の削除は M14-02）。

### 1.2 recovery 追加（指示書 §4.2）

- [ ] DB に `recovery INTEGER`（NULL 可）が 000018 で ADD されているか。
- [ ] `model.Move`（`Recovery *int`）・dto.go（Detail/Update/必要なら narrow に `recovery,omitempty`）・repository `UpdateMoveFields`（`Recovery *int`）に追加されているか。
- [ ] FE `Move` 型（`recovery?: number`）・`MoveEditGrid` の手入力編集欄（整数・`-`/`e`/`.` 不可＝既存 total/フレーム入力同方式）が追加されているか。
- [ ] 既存 ryu 56 行の `recovery` が NULL 据置（backfill は M14-03）で、`total` が再計算されず据置か。

### 1.3 raw_data 退避5キー除去（指示書 §4.3）

- [ ] 000018 で既存行の raw_data から `command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes` のみが除去され、`notes`/`notes_tool` が**温存**されているか（巻き込み無し）。
- [ ] 空オブジェクトになる行の扱い（NULL 化 or `{}`）が DES-003 §3.3「空なら省略」に沿うか。
- [ ] 画面18 の `notes` 表示・`notes_tool` 編集（PATCH `rawData`）が不変か。

### 1.4 警告再導出の縮小（DES-002 §4.2・DES-005 §5.18・指示書 §4.5）

- [ ] GET `/api/moves` / `/api/moves/:id` の再導出 warnings から `unknown_properties` / `unknown_combo_scaling_key` が消え、`total_null` / `extra_throw` が温存されているか。
- [ ] `DeriveStoredWarnings` / `StoredMove` / `WarningCode` enum から削除列由来の参照・コードが除去されているか。
- [ ] **`service/movesimport` パッケージ自体は温存**されているか（移設・削除は M14-02。本サブで削除していないか）。
- [ ] FE `web/src/constants/move-warning.ts`（共有 SSOT）が温存され、消失コードのラベル使用のみ整理されているか。

### 1.5 DES 直接編集の禁止

- [ ] スキーマ・警告・編集グリッドの変更詳細を製造担当が DES に直接書いていないか（DES 反映は設計担当判断。実装具体化は伝達メモで申し送り）。

---

## 2. マイグレーションの健全性（retro・digest §5）

- [ ] **FK=OFF と明示 DELETE が同一指示書に同居していない**か（digest §5・M12-5）。本サブは列 DROP/ADD ＋ JSON UPDATE で子行 DELETE を伴わない想定 — 伴う場合は同居回避を確認。
- [ ] 削除6列が FK 非参照（report D-3）で、`ALTER TABLE DROP COLUMN`（or 必要時の再構築 000016 技法）が当環境 SQLite バージョンで成立しているか。
- [ ] `dbtest.Setup` が 000018 を含む全マイグレを適用し、**全既存テストが新スキーマで通過**するか（M9-1 波及）。
- [ ] `migrate_test.go` 等の down 整合（000018.down で復元）。
- [ ] 既存マイグレ（000004 ryu seed 等・編集禁止）を改変していないか。

---

## 3. データ層・API の整合（指示書 §4・code-facts §8/§9）

- [ ] `model.Move` の db/json タグが新列構成（recovery 追加・6列削除）と一致するか。
- [ ] PATCH（`UpdateMoveRequest`→`UpdateMoveFields`）の経路が recovery を受け、削除6列を受けないか（presence-detection／nil=不変更の既存方式を踏襲）。
- [ ] narrow（一覧）と full（詳細 `GET /api/moves/:id`）のレスポンス型が新列構成で齟齬ないか。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 Go

- [ ] マイグレ up/down（6列消失・recovery 追加・raw_data 退避5キー消失・notes/notes_tool 温存・down 復元）。
- [ ] model/DTO/repository（削除6列消失・recovery read/write・PATCH で recovery 更新）。
- [ ] 警告再導出（warnings が total_null/extra_throw のみ）。
- [ ] raw_data UPDATE（退避5キーのみ消え notes/notes_tool 残存）。

### 4.2 FE（Vitest）

- [ ] MoveEditGrid に削除6列の編集欄が無く recovery 編集欄があり整数入力が PATCH に乗る。
- [ ] notes_tool 編集の非回帰。
- [ ] 削除列参照箇所が型エラーなくビルド。

### 4.3 E2E / 手順書

- [ ] 画面18 で recovery 編集→保存→リロード反映。
- [ ] M13 CSV export/import が削除6列・recovery 追加後も往復成立（意味単位の非回帰）。

---

## 5. 設計意図との整合（精神の確認）

- [ ] **「観測できない列は持たない」**: 削除6列が編集欄からも消え、手入力できない列を残していないか。
- [ ] **「raw_data は技編集メモの器として温存」**: notes/notes_tool を残し取込退避のみ消したか（全削除していないか）。
- [ ] **「意味単位 export の頑健性を壊さない」**: コンボ CSV 契約（FR401/405）に手を入れていないか（回帰確認のみ）。
- [ ] **「movesimport の削除は M14-02」**: 本サブで警告縮小に留め、パッケージ・取込経路を削除していないか。

---

## 6. コード品質・規約遵守

- [ ] 曖昧語に依存した実装判断になっていないか（playbook §4.1）。
- [ ] db/json タグ・命名が既存パターン（code-facts §8）に整合するか。
- [ ] 削除6列の grep が 0 件（参照表示のみ）の確証が完了報告にあるか（指示書 §3.4-1）。

---

## 7. 既存挙動の温存（非破壊性）

- [ ] 画面18 の total/各フレーム編集・is_aerial トグル・rush 生成・name_ja 表示が不変か。
- [ ] `notes`/`notes_tool` 表示・編集が不変か。
- [ ] M13 CSV export/import 経路が不変（回帰通過）か。
- [ ] `total` 既存値が再計算・改変されていないか。

---

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（7 項目）・テストケース数・既知の制約（ryu recovery=NULL は M14-03 backfill 等）が含まれるか（指示書 §7.4）。
- [ ] DES 反映が要る具体化点（raw_data 空行の扱い・recovery FE 入力方式・warnings 縮小）を**設計担当への伝達メモ**で申し送っているか（DES 反映は設計担当判断）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 7 項目（§3.4）のいずれかが未確認のまま実装されている（推測実装）。
- 削除6列を消費する箇所があるのに削除している（grep 裏取り不履行・データ破壊リスク）。
- `recovery` が追加されていない、or PATCH で更新できない。
- raw_data 全削除で `notes`/`notes_tool` を失っている（指示書違反）。
- `service/movesimport` パッケージ・取込エンドポイント・画面17 を本サブで削除している（M14-02 越権）。
- マイグレ 000018 が dbtest.Setup 経由で既存テストを壊す、or down 整合が無い。
- FK=OFF と明示 DELETE が同居している（digest §5 違反）。
- 既存マイグレ（編集禁止）を改変している。
- 製造担当が DES 本体を直接編集している。

## 10. 軽微な問題の判定基準（持ち越し許容）

- recovery 編集欄の配置・ラベル細部。
- raw_data 空オブジェクト行の NULL 化 vs `{}` 維持（DES-003 §3.3 に沿う範囲の選択）。
- move-warning.ts のラベル整理の細部（SSOT 温存が満たされていれば）。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / 設計書 DES-00N（実パス）§Y に対し、実装が Z。意図確認したい」の形で根拠節を併記して設計担当へ。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の Plan Mode 着手前確認結果（7 項目）が揃っている。§10 軽微は持ち越し可。

---

*以上、M14-01 レビューチェックリスト v1.0.0。配置 `docs/instructions/reviews/M14-01-review-checklist.md`。*
