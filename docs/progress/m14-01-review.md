# M14-01 レビュー報告書

対象: feature/m14-01（`git diff main...HEAD`）。製造コミット 3 件（fa911c0 backend / f7e88de web / 42102f4 model doc）＋投入前ドキュメント整理 b2fd744。
レビュー実施: コード読取 ＋ 検証実行（`go build ./...` OK / `go test ./internal/...` 全 OK / `go vet` OK / `pnpm exec tsc --noEmit` OK / `pnpm exec vitest run`（moves/import）26 passed）。コードは変更していない。

## 総評

M14-01 の中核要件（観測不能6列削除・recovery 追加・raw_data 退避5キー除去・警告再導出の縮小）は設計準拠で、削除6列の消費者残存ゼロを grep で裏取り済み（recipe_cache / 比較 / 一覧 / combo 経路に move 列の消費なし）。マイグレ 000018 は ALTER + UPDATE のみで FK=OFF×明示 DELETE の同居を回避し、json_remove/json_each の modernc.org/sqlite 動作も `TestRun_Migration000018_SchemaCleanup` で実証されている。down 整合・dbtest.Setup 波及・既存マイグレ非改変も確認。スコープ線引き（import 本体は M14-02 まで温存、コンパイル必須箇所のみ最小編集）も指示書 §1.3/§2.2/§2.3 に整合。**重大（§9）はゼロ**。軽微な dead code とテンポラリな FE/BE 契約ずれ（いずれも M14-02 で解消予定の温存領域）を低優先で 2 件指摘するに留まる。完了承認可能。

## 設計準拠性レビュー結果

### §1.1 削除6列（DES-003 §3.3・指示書 §4.1）: ◎
- DB: `migrations/000018_..._up.sql:23-28` で 6 列 DROP。`damage` は削除対象外で温存（model/DTO/repo の SELECT・INSERT・UPDATE に残存）— 正しい。
- Go: `model.Move`（`internal/model/move.go:39-55`）・`MoveDetailResponse`（`internal/api/move/dto.go:65-82`）・`MoveResponse`（同 12-32）・`UpdateMoveRequest`（同 109-119）・repository `UpdateMoveFields`（`internal/repository/move/repository.go:57-67`）・SELECT/INSERT/UPDATE（`queries.go` / `upsert.go` / `rush.go` / `edit.go`）から 6 列が完全に消えている。
- FE: `web/src/features/moves/types.ts` の `Move`/`MoveDetail`/`UpdateMoveRequest`、`MoveEditGrid.tsx` の編集欄/列から 6 列が消えている。
- PATCH 値域検証除去: `internal/service/move/service.go:120-132` で `properties`（`IsKnownProperty`）・`combo_scaling` の値域・整形式検証を撤去。`IsKnownProperty` 本体は movesimport 側に温存（M14-02）。

### §1.2 recovery 追加（指示書 §4.2）: ◎
- DB: `up.sql:33` で `recovery INTEGER`（NULL 可）ADD。
- Go: `model.Move.Recovery *int`（move.go:51）、`MoveDetailResponse`/`MoveResponse`/`UpdateMoveRequest`/`MoveListItem`/`UpdateMoveFields` 全てに `recovery,omitempty` 追加。SELECT/INSERT/UPDATE・scan 先（`repository.go:127,141,157` / `edit.go:40,62,106-108` / `queries.go:19,37` / `upsert.go:17,28,43` / `rush.go:21,67`）が一貫。
- FE: `types.ts` 3 型に `recovery?: number | null`、`MoveEditGrid.tsx:78,107-108,212-219` に手入力欄（既存 total/フレームと同方式の `parseNum`）。ソート列・SortKey にも追加。一覧（narrow）にも recovery を載せており、グリッドが一覧データから編集初期値を取る導線と整合。
- 既存行 NULL 据置・total 非再計算: `up.sql` は recovery を backfill せず、total への UPDATE も無い。`migrate_test.go:440-447` で既存行 recovery=NULL を検証。

### §1.3 raw_data 退避5キー除去（指示書 §4.3）: ◎
- `up.sql:41-50` で `json_remove` により command/condition_ja/condition_en/properties_extra/import_notes のみ除去。`json_remove` は不在キーを無視するため一部キー行も安全。
- 空オブジェクト→NULL 化（`up.sql:54-57`、`json_each` カウント 0 判定）。DES-003 §3.3「空なら省略」に整合。
- notes/notes_tool 温存を `migrate_test.go:415-429` で実証（退避5キー不在・notes/notes_tool 残存）、退避キーのみ行の NULL 化も検証（同 431-438）。
- 画面18 の notes 表示・notes_tool 編集（PATCH `rawData`）不変（`MoveEditGrid.tsx:40-58,110-117`）。

### §1.4 警告再導出の縮小（DES-002 §4.2・指示書 §4.5）: ◎
- `WarningCode` enum から `WarnUnknownComboScaling`/`WarnUnknownProperties` を除去（`types.go` diff）。`StoredMove` から Properties/ComboScaling フィールド除去（`warning.go`）。`DeriveStoredWarnings` は total_null/extra_throw のみ再導出（`warning.go:36-53`）。
- `service/movesimport` パッケージ・取込エンドポイント（`internal/api/movesimport/`）・画面17（`web/src/pages/ImportMovesPage`）は**削除されていない**（M14-02 越権なし）。
- FE SSOT `web/src/constants/move-warning.ts` は温存。`MoveEditGrid.tsx` は server が返す warnings のみをラベル表示（unknown_* はもはや送られないため発火しない）。
- テスト裏取り: `handler_test.go`（warnings に unknown_* 不在を assert）、`warning_test.go`（unknown ケース撤去）、`MoveEditGrid.test.tsx`（warnings total_null/extra_throw）。

### §1.5 DES 直接編集の禁止: ◎
- 製造3コミット（fa911c0/f7e88de/42102f4）は `docs/design/` を一切触れていない（`git diff --stat` で空）。DES-001（01-tech-stack.md）の編集は b2fd744「投入前ドキュメント整理」= CHANGE-053 の設計側反映であり製造工程外（指示書 §1.3 で別管理と明記）。`internal/model/doc.go`・各 godoc コメントの M14-01 注記はコード内ドキュメントで DES 本体ではない。

### §2 マイグレーション健全性: ◎
- FK=OFF×明示 DELETE 同居なし（`up.sql` は ALTER と UPDATE のみ、子行 DELETE 無し）。digest §5 違反なし。
- 削除6列は索引・FK 非参照（唯一の索引 idx_moves_character_category は (character_id, category)）。`ALTER TABLE DROP COLUMN`（SQLite 3.35+、前例 000008/000013）で個別削除、再構築不要。
- `dbtest.Setup` 経由の全既存テスト（service/move・repository/move・api/move 等）が新スキーマで通過。
- down 整合: `down.sql` が recovery を DROP し 6 列を元型（combo_scaling/properties=TEXT、ゲージ系4列=INTEGER）で復元。原型は 000001/000013 と一致（型照合済み）。`migrate_test.go:449-461` で down 復元を検証。値は復元不可（非可逆）を down.sql コメントで明示、000008/000013 down と同方針。
- 既存マイグレ 000001〜000017 は無改変（追記のみ）。

### §3 データ層・API 整合: ◎
- `model.Move` の db/json タグが新列構成と一致。narrow（`MoveListItem`/`MoveResponse`）と full（`MoveDetail`/`MoveDetailResponse`）が齟齬なし。divergence_test 系も通過（repository/move テスト OK）。
- PATCH 経路は presence-detection（nil=不変更）を踏襲し recovery を受領・削除6列を受けない。`handler_test.go` の `{"total":42,"recovery":13,...}` で保存・反映を検証。

### §4 テスト妥当性: ◎
- Go: マイグレ up/down・raw_data UPDATE・recovery read/write/PATCH・警告縮小を網羅（migrate_test/handler_test/service_test/warning_test）。
- FE: MoveEditGrid に削除6列欄なし・recovery 整数が PATCH に乗る（`{ recovery: 13 }`）・notes_tool 非回帰・warnings 表示を Vitest 14 ケースで担保。tsc clean。

### §5 設計意図整合: ◎
- 観測できない列は編集欄からも消失。raw_data は技編集メモの器として温存。意味単位 export（FR401/405・comboio）の CSV 契約は無改変（combo 経路で move 列非依存、回帰通過）。movesimport 削除は M14-02 に正しく繰延。

### §6 コード品質・規約: ○（軽微 2 件、後述）
### §7 既存挙動温存: ◎（total/フレーム編集・is_aerial・rush 生成・name_ja・notes 表示すべて不変）
### §8 ドキュメント・進捗ログ: ○（完了報告/伝達メモ本体は本レビュー対象差分に未確認。コード側の M14-01 注記は十分。設計担当への CHANGE 申し送り（054〜）が別途必要な点は指示書 §7.5 どおり）

## 設計準拠性以外の指摘事項

1. **dead code（低）**: `internal/service/movesimport/parse.go:293 validateComboScaling` と `:51 comboScalingKeys` は、unknown_combo_scaling_key 導出の撤去により**呼び出し元が消失**（`grep "validateComboScaling("` は定義行のみヒット）。指示書 §2.2/スコープ上 import 本体は M14-02 まで温存が明示されているため**意図的な温存**だが、現状は未使用の非公開関数/変数。`go vet`/`go build` は通る（未使用パッケージ関数は非エラー）。M14-02 の movesimport 整理で除去される想定であり放置はされない見込み。`normalizeProperties` は `parseRow` から呼ばれ `knownProperties` も経由するため、これらは dead ではない。
2. **FE/BE 契約のテンポラリずれ（低）**: `internal/api/movesimport/dto.go` は `previewRowDTO` から `Properties`/`ComboScaling` を削除（model.Move から両フィールドが消えたためコンパイル必須の最小編集）。一方 FE `web/src/features/import/types.ts:24` は `comboScaling: string | null` を保持し、FE 取込テストも当該フィールドを構築する。結果、画面17 のプレビューで当該フィールドは実行時 undefined になる。画面17・FE 取込型は M14-01 の FE 改修対象外（指示書の FE タッチ一覧に非掲載）かつ M14-02 で削除予定の温存領域のため**スコープ整合**だが、M14-02 着手まで残る一時的不整合として追跡が望ましい。
3. **SSOT のラベル温存（情報）**: `move-warning.ts` は recovery_word/unknown_combo_scaling_key/unknown_properties のラベルを保持。recovery_word は取込プレビュー専用警告として正当に温存（`parse.go:179` で発火）。unknown_* の2ラベルは server から送られなくなり死蔵だが、SSOT ファイル自体の整理は M14-02 まで温存（指示書 §2.2）で整合。

## 推奨修正（優先度別）

- 高（M14 完了前に修正必須）: なし。
- 中（M15 着手と並行可）: なし。
- 低（将来対応＝M14-02 で自然解消見込み）:
  - 指摘1: `validateComboScaling`/`comboScalingKeys` の未使用化。M14-02 の movesimport 整理で除去されることを followup-backlog 等に明記しておくと取りこぼし防止になる。
  - 指摘2: FE 取込型 `comboScaling`/関連プレビュー欄と backend previewRowDTO のずれ。M14-02 の画面17 削除タスクに含める旨を確認。

## 良かった点

- 削除6列の消費者ゼロを「DB列名・Go フィールド名・TS フィールド名」の3表記で全数 grep し、recipe_cache/比較/一覧/combo 経路に残存が無いことを裏取りした点（指示書 §3.4-1 のゲートを忠実に履行）。
- マイグレ 000018 の冒頭コメントで技法選択（DROP COLUMN 採用・再構築不要・FK=OFF×DELETE 非該当）の根拠を明記し、`json_remove`/`json_each` の動作をテストで実証した点。modernc.org/sqlite 依存の不確実性をコードではなくテストで潰している。
- スコープ線引きが明快。コンパイル必須箇所（parse.go の代入除去・previewRowDTO の2フィールド削除）のみ最小編集し、csvColumns・raw_data 退避キー生成・validateComboScaling 等の import 本体を温存。M14-02 越権（パッケージ削除・画面17・取込エンドポイント削除）を一切犯していない。
- down.sql の非可逆性（値復元不可）を明示コメント化し、既存 000008/000013 down の前例に整合させた点。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認（画面18 での recovery 編集→保存→リロード反映）・M13 CSV export/import 往復の実機回帰・パフォーマンスは別途実施が必要。
- 完了報告書（伝達メモ）本体は本レビュー差分内に未確認のため、§8 の Plan Mode 7項目の質問書・開発者回答の現存は完了報告で別途確認されたい（コード・テスト側の整合は全項目満たしている）。

---

## 取り込み結果（自動トリアージ）

> implement_plan_full Phase C。レビュー報告書の各指摘を製造担当 Claude が自動トリアージした記録（事後監査用）。
> 安全弁: 優先度「高」指摘の不採用時のみ開発者へエスカレーションする。本レビューは**高・中ともゼロ**、低のみ 2 件のため自動で確定。

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|--------|------|------|------|
| 1 | 低 | `validateComboScaling` / `comboScalingKeys` が呼び出し元消失で未使用化（dead code） | **不採用（コード変更せず）／追跡は採用** | 指示書 §1.3/§2.2/§2.3 が movesimport 本体（取込パイプライン）の整理を **M14-02** に明示的に繰延しており、本サブで関数本体を削除するのは越権（チェックリスト §9「movesimport パッケージ・取込経路を本サブで削除していないか」に抵触）。`go build`/`go vet` は通過（未使用パッケージ関数は非エラー）。M14-02 で除去されるよう **progress-log に followup を記録**する（取りこぼし防止）。 |
| 2 | 低 | FE 取込型 `import/types.ts.comboScaling` と backend `previewRowDTO`（2フィールド削除済）のテンポラリ契約ずれ | **不採用（コード変更せず）／追跡は採用** | 画面17・FE 取込型は M14-01 の FE 改修対象外（指示書 §2.2 の FE タッチ一覧に非掲載）かつ M14-02 で画面17 ごと削除予定の温存領域。backend 側は model.Move からのフィールド消失に伴うコンパイル必須の最小編集。実行時は当該プレビュー欄が undefined（"—"表示）になるのみで機能影響なし。M14-02 の画面17 削除タスクに含めるよう **progress-log に followup を記録**する。 |
| 3 | 情報 | `move-warning.ts` SSOT が unknown_* ラベルを温存（死蔵） | 対応不要 | 指示書 §2.2 が FE SSOT を M14-02 まで温存と明示。recovery_word ラベルは取込プレビュー専用警告として正当に現役。 |

**結論**: コード修正を要する採用指摘はゼロ（重大・高・中なし）。低 2 件は M14-02 境界の意図的温存につきコード変更せず、追跡のみ progress-log へ記録。完了承認可能。
