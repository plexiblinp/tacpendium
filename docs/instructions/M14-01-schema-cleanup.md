# 指示書 M14-01: スキーマ整理（moves 観測不能 6 列削除 ＋ `recovery` 追加 ＋ `raw_data` 退避キー除去）

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-01 |
| マイルストーン | M14（公式データ配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.24.0） |
| 上位文書 | M14-overview v1.0.0（`docs/instructions/M14-overview.md`）§2.2/§2.3/§4.1/§4.5 |
| 関連 | M14-RESEARCH-01-report §A/§D（`docs/progress/M14-RESEARCH-01-report.md`）/ m13-to-m14-handover §4-2/§4-5 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版。 |

---

## 1. 背景と目的

### 1.1 背景

M14 は公式フレームデータ HTML 配布禁止への是正クラスタ。配布 DB は開発者の手入力データで構成する（取込廃止）。本サブ M14-01 は、その前提となる **moves スキーマの整理**を行う。

moves の一部の列は**フレームデータのみに存在し、ゲーム上から観測できない**（正確な数値が画面非表示）。これらは配布禁止フレームデータ無しには手入力できず、編集もできないため、配布する手入力 DB モデルでは**削除**する。逆に観測可能な硬直（`recovery`）は、現在 DB 非永続だが手入力で再現できるため**列として追加**する。

M13 の export は意味単位（code ベース・DB 管理列除外）で設計されており、本サブの moves 列増減に頑健（digest M13-6・順序依存リスクなし）。

### 1.2 目的

- moves から**観測不能 6 列を削除**: `properties` / `combo_scaling` / `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase`。
- moves に **`recovery`（INTEGER・NULL 可・手入力）を追加**。`total` は既存行で stored 維持（再計算しない）。
- `raw_data` を**器として温存**し、取込退避 5 サブキー（`command` / `condition_ja` / `condition_en` / `properties_extra` / `import_notes`）を能動除去。`notes` / `notes_tool`（技編集が表示/編集する自由メモ）は**温存**。
- 上記をデータ層（model / DTO / repository）・技編集 UI（画面18）・マイグレ（000018）・警告再導出に反映。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **取込パイプラインの削除**（`service/movesimport` パッケージ削除・画面17・取込エンドポイント・FR704 降格）＝**M14-02**。本サブは movesimport の警告再導出から削除列由来コードを除くのみで、**パッケージ自体は温存**（M14-02 が移設・削除）。
- **配布 seed の投入**（全 30 キャラ・recovery backfill 含む）＝**M14-03**。本サブは列追加まで。既存 ryu 56 行の `recovery` は NULL 据置（M14-03 で backfill）。
- **DES-001 の旧スタック是正・MIT 確定**＝M14-CHANGE（CHANGE-053・反映済み）。
- `total` の stored→導出化＝将来送り（M14-overview §2.4）。
- `recovery` の値域 VAL 新設は本サブでは設けない（§4.4・取込寛容方針と一貫。開発者確認 #3 の暫定）。

---

## 2. 成果物

### 2.1 作成するファイル

- `migrations/000018_*.up.sql` / `000018_*.down.sql`（命名は既存連番規約に合わせる。実配置は code-facts §10 に従う）。

### 2.2 修正するファイル（実コードの実態に合わせる。下記は code-facts 由来の想定接地点・Plan Mode で全数確認）

- **Go model**: `internal/model/move.go` の `Move` 構造体 — 削除6列のフィールド除去 ＋ `Recovery *int`（db:recovery, json:recovery,omitempty）追加。
- **Go DTO**: `internal/api/move/dto.go` —
  - `MoveDetailResponse`: `comboScaling` / `driveGaugeIncrease` / `driveGaugeDecreaseGuard` / `driveGaugeDecreasePunish` / `superArtGaugeIncrease` / `properties` 除去 ＋ `recovery` 追加。
  - `MoveResponse`（narrow list）: `properties` / `driveGaugeDecreaseGuard` 除去 ＋（一覧で recovery 表示が要るなら）`recovery` 追加。`warnings` は §4.5 の縮小に追従。
  - `UpdateMoveRequest`（PATCH）: `driveGaugeIncrease` / `driveGaugeDecreaseGuard` / `driveGaugeDecreasePunish` / `superArtGaugeIncrease` / `properties` / `comboScaling` 除去 ＋ `recovery,omitempty *int` 追加。
- **Go repository**: `internal/repository/move/repository.go` の `UpdateMoveFields` — 削除6列除去 ＋ `Recovery *int` 追加。SELECT/INSERT/UPDATE の列リスト・スキャン先を追従。
- **Go 警告再導出**: `service/movesimport` の `DeriveStoredWarnings` / `StoredMove`（および `WarningCode` の値集合）— `unknown_properties` / `unknown_combo_scaling_key` の導出・コードを除去（削除列を読む経路の除去）。`total_null` / `extra_throw` は温存。**パッケージ自体は削除しない**（M14-02）。
- **Go service**: `internal/service/move/service.go` — PATCH の `properties` 値域検証（`movesimport.IsKnownProperty` 呼び出し）を除去（properties 列消失に伴う）。`IsKnownProperty` 関数本体の削除は M14-02。
- **FE 型**: TypeScript の `Move` 型定義（Plan Mode で所在特定。`web/src/features/moves/` or `web/src/types/`）— 削除6列のフィールド除去 ＋ `recovery?: number` 追加。
- **FE 技編集グリッド**: `web/src/features/moves/MoveEditGrid.tsx` — `properties` / `combo_scaling` / ゲージ系の編集欄・列を除去 ＋ `recovery`（手入力・INTEGER）編集欄を追加。`total` / 各フレーム / is_aerial / rush 生成 / notes 付記（`notes_tool`）/ name_ja 表示は温存。
- **FE 警告表示**: `web/src/constants/move-warning.ts`（共有 SSOT・温存）から `unknown_properties` / `unknown_combo_scaling_key` のラベル使用を整理（コード消失で発火しなくなるため）。SSOT ファイル自体は M14-02 まで温存。

### 2.3 変更しないもの（原則）

- export/import（comboio・FR401/405）の CSV 契約（意味単位・code ベース・DB 管理列除外で moves 列に非依存＝digest M13-6）。回帰のみ確認。
- 画面18 の `notes` 表示・`notes_tool` 編集（raw_data 経由・PATCH `rawData`）。
- `total` 既存行の値（再計算しない）。
- `service/movesimport` パッケージの存在（M14-02 まで温存）。取込エンドポイント・画面17（M14-02）。

### 2.4 例外条項

- code-facts と実コードに差があれば**実コードを正**とし、相違を完了報告に記録（記憶で進めない・playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M14-overview v1.0.0（`docs/instructions/M14-overview.md`）§2.2/§2.3/§4.1/§4.5。
- DES-003（`docs/design/03-data-model.md`）§3.3 moves 列定義・raw_data キー構造・total 算出式（案B）。
- DES-002（`docs/design/02-architecture.md`）§4.2 `GET/PATCH /api/moves`・warnings 再導出。
- DES-005（`docs/design/05-screen-design.md`）§5.18 技編集グリッド（編集対象フィールド）。
- M14-RESEARCH-01-report（`docs/progress/M14-RESEARCH-01-report.md`）§A（列の到達経路）/§D（マイグレ）。
- code-facts（`docs/handover/code-facts.md`）§8 model / §9 repository / §10 マイグレ / DTO。
- retrospective-digest（`docs/handover/retrospective-digest.md`）§5 破壊的マイグレ規律。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- moves は 20 列。削除候補6列はいずれも FR307 下で**自動消費されず参照表示のみ**（report A-1）。`combo_scaling`/`properties`/ゲージ系は `MoveDetailResponse`・`UpdateMoveRequest`・`UpdateMoveFields`・`model.Move`・`MoveEditGrid` に出現（code-facts）。
- `recovery` は現在 moves 非永続（CSV のみ・total 算出材料）。total は `startup+active−1+recovery`（案B・CHANGE-028）。
- `raw_data` 7 サブキーのうち `notes`/`notes_tool` は技編集由来（取込でない）。残り5キーは取込退避（DES-003 §3.3）。
- 次マイグレ連番 = **000018**（000017 が最新・code-facts §10）。
- 削除6列は FK 非参照（report D-3）。

### 3.3 参照不要

- M14-02（取込削除）・M14-03（seed）の詳細。本サブはスキーマ・データ層・技編集 UI に限定。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **7 項目**を Plan Mode で実コード確認のうえ計画提示すること（推測で実装しない）。

1. **削除6列の消費者 grep（裏取りゲート・最重要）**: `combo_scaling` / `properties` / `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase`（DB 列名・Go フィールド名・TS フィールド名）を **recipe_cache / 比較 / 一覧 / その他で読む箇所が無い**ことを全数 grep で確認。読む箇所があれば重大（削除不可・要設計判断として設計担当へ差し戻し）。
2. **削除6列の参照経路の全列挙**: model.Move / dto.go の 3 レスポンス（MoveResponse / MoveDetailResponse / 必要なら ListResponse）/ UpdateMoveRequest / repository UpdateMoveFields の SELECT・INSERT・UPDATE 列 / FE Move 型 / MoveEditGrid / DeriveStoredWarnings の property/scaling 導出 — 触る箇所を漏れなく列挙。
3. **`recovery` 仕様**: INTEGER・NULL 可・手入力。model / DTO（Detail・Update・必要なら narrow）/ repository / FE 型 / MoveEditGrid 編集欄の追加位置。**既存 ryu 56 行は NULL 据置**（backfill は M14-03）。total は再計算しない。
4. **`raw_data` JSON UPDATE 方式**: 退避5キー（command/condition_ja/condition_en/properties_extra/import_notes）のみ削除し `notes`/`notes_tool` を巻き込まない方式（SQLite `json_remove` 等 or アプリ側変換）。NULL/空 raw_data 行の扱い。
5. **マイグレ 000018 技法**: 削除6列の `ALTER TABLE moves DROP COLUMN`（SQLite 3.35+。当環境バージョン・前例 000008/000013.down を確認）。再構築（000016 技法）が必要か否か。`recovery` ADD COLUMN。`raw_data` UPDATE。**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5・M12-5）。`dbtest.Setup` 全テスト波及（M9-1）。`migrate_test.go` の down 整合。
6. **`DeriveStoredWarnings` 縮小範囲**: `unknown_properties` / `unknown_combo_scaling_key` の導出・WarningCode 値を除去し `total_null` / `extra_throw` を温存。`StoredMove` から削除6列を除去。**movesimport パッケージ自体は温存**（M14-02 が移設・削除）。FE move-warning.ts のラベル整理（SSOT は温存）。
7. **`total` の扱い**: 既存行は stored 据置（再計算しない）。新 seed の total 算出は M14-03。本サブで total の値は変更しない。

---

## 4. 詳細仕様

### 4.1 削除6列（DES-003 §3.3・DES-005 §5.18）

- DB: `properties` / `combo_scaling` / `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase` を 000018 で DROP。
- Go: model.Move・dto.go（MoveDetailResponse / MoveResponse / UpdateMoveRequest）・repository UpdateMoveFields・関連 SELECT/INSERT/UPDATE 列から除去。
- FE: Move 型・MoveEditGrid の編集欄/列から除去。
- 削除に伴い `properties` の PATCH 値域検証（`movesimport.IsKnownProperty` 呼び出し・service/move/service.go）を除去。

### 4.2 `recovery` 追加

- DB: `recovery INTEGER`（NULL 可）を 000018 で ADD COLUMN。
- Go: model.Move に `Recovery *int`、dto.go（Detail・Update・必要なら narrow）に `recovery,omitempty`、repository UpdateMoveFields に `Recovery *int`。
- FE: Move 型に `recovery?: number`、MoveEditGrid に手入力編集欄（整数・既存 total/フレーム入力と同方式＝`-`/`e`/`.` 不可）。
- 既存 ryu 56 行は recovery=NULL（M14-03 で backfill）。total は据置。

### 4.3 `raw_data` 退避5キー除去（器は温存）

- 000018 で既存行の raw_data から `command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes` を JSON UPDATE で除去。`notes`/`notes_tool` は温存。
- 削除後に raw_data が空オブジェクトになる行は NULL 化 or `{}` 維持（DES-003 §3.3「空なら省略」に従い Plan Mode で確定）。
- 画面18 の notes 表示・notes_tool 編集（PATCH `rawData`）は不変。

### 4.4 検証（DES-006）

- 削除6列に専用 VAL は無い（取込寛容方針・02 §7.4）ため DES-006 改訂は基本不要（M14-overview §確認事項5）。
- `recovery` の値域 VAL は本サブで設けない（手入力・UI 制約で担保。取込寛容と一貫）。要すれば設計担当が別途 VAL 新設を判断。

### 4.5 警告再導出の縮小（DES-002 §4.2・DES-005 §5.18）

- GET `/api/moves` / `/api/moves/:id` の再導出 warnings から `unknown_properties` / `unknown_combo_scaling_key` を除去（列消失で moot）。`total_null` / `extra_throw` は温存。
- `DeriveStoredWarnings` / `StoredMove`（movesimport）から削除列の参照を除去。WarningCode enum から該当2値を除去。movesimport パッケージは温存（M14-02）。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **マイグレ 000018**: up で6列が消え `recovery` が追加され raw_data 退避5キーが消えること（notes/notes_tool 温存）。down で復元（down 整合）。`dbtest.Setup` 適用後に全既存テストが新スキーマで通過。
- **model/DTO/repository**: 削除6列が構造体・列リストから消え、`recovery` の read/write が成立。PATCH（UpdateMoveRequest）で recovery が更新でき、削除6列フィールドが存在しない。
- **警告再導出**: GET 応答の warnings が `total_null`/`extra_throw` のみ（`unknown_properties`/`unknown_combo_scaling_key` が出ない）。
- **raw_data UPDATE**: notes/notes_tool を持つ行で退避5キーのみ消え notes/notes_tool が残る。

### 5.2 FE テスト（Vitest）

- MoveEditGrid に削除6列の編集欄が無く、`recovery` 編集欄があり整数入力が PATCH に乗る。
- notes 付記（notes_tool）編集が不変。
- 削除列を参照していた箇所が型エラーなくビルドできる。

### 5.3 E2E / 手順書

- 画面18 でキャラを選び、recovery を編集→保存→リロードで反映（既存編集導線の非回帰）。
- M13 CSV export/import が削除6列・recovery 追加後も往復成立（意味単位の非回帰）。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/reviews/M14-01-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- 削除6列が DB・Go・FE から消え、`recovery` が追加され手入力で編集・保存できる。
- raw_data が notes/notes_tool のみ保持し退避5キーが消える。
- 警告再導出が `total_null`/`extra_throw` のみ。
- 画面18 の notes_tool 編集・total/フレーム編集・rush 生成・name_ja 表示が不変。

### 7.2 自己テスト結果

- §5 の Go/FE/E2E をケース数で報告。`dbtest.Setup` 経由の全テスト通過・down 整合を明記。

### 7.3 品質チェック

- 削除6列の消費者 grep 結果（0 件＝参照表示のみ）を報告。禁則表現（「適切に」「必要に応じて」等）の grep 除去。

### 7.4 ドキュメント

- Plan Mode 確定方式（7 項目）・テストケース数・既知の制約（ryu recovery=NULL は M14-03 backfill 等）を完了報告に含める。
- 実装で具体化した点（raw_data 空行の扱い・recovery FE 入力方式等）で DES 反映要否があれば**設計担当への伝達メモ**で申し送り（DES 反映は設計担当判断）。

### 7.5 完了報告

- 上記＋ DES-003/005/002 への CHANGE 見込み（削除列・recovery・warnings 縮小）の具体化点を伝達メモで申し送り（設計担当が CHANGE 起票）。

---

## 8. 参照ドキュメント

- M14-overview v1.0.0 §2.2/§2.3/§4.1/§4.5 / DES-003 §3.3 / DES-002 §4.2 / DES-005 §5.18 / DES-006 §6 / M14-RESEARCH-01-report §A/§D / code-facts §8/§9/§10 / retrospective-digest §5。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 削除6列の消費者の有無（§3.4-1 の grep で確証。読む箇所があれば設計担当へ差し戻し）。
- 削除列の参照経路（§3.4-2 の全列挙。漏れは型エラー or 実行時破壊）。
- マイグレ技法（DROP COLUMN 可否・再構築要否・FK=OFF×明示DELETE 非同居）。

### 9.2 推測で進めてよい事項（その旨を明示）

- raw_data 空オブジェクト行の NULL 化 or `{}` 維持（DES-003 §3.3 に沿う範囲で）。
- recovery FE 編集欄の配置（既存 total/フレーム入力に倣う）。

### 9.3 不明事項発見時の対応

- 削除6列を消費する箇所を発見した場合は実装を止め、設計担当へ差し戻す（削除可否の再判断・観測可能性のドメイン確認）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 7 項目すべて（消費者 grep / 参照経路全列挙 / recovery 仕様 / raw_data UPDATE / マイグレ技法 / 警告縮小 / total 据置）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて、設計担当が DES-003（削除列・recovery・raw_data §3.3）/ DES-005 §5.18（編集グリッド項目）/ DES-002 §4.2（PATCH フィールド・warnings 縮小）の CHANGE を起票（054〜）。
- M14-02（取込パイプライン段階削除）に着手。本サブで `properties` 削除＝`IsKnownProperty` 消費者消失済みのため、共有シンボル移設が縮小（M14-overview §4.2）。

---

*以上、指示書 M14-01 v1.0.0。配置 `docs/instructions/M14-01-schema-cleanup.md`。対のレビューチェックリストは `docs/instructions/reviews/M14-01-review-checklist.md`。*
