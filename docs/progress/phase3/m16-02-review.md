# M16-02 レビュー報告書

## 総評

M16-02（ゲージ消費列の追加・G-f）の製造成果物は、マイグレ 000020／データ層／CSV 往復／FE 表示のいずれも接地経路の網羅性が高く、`git diff` 上でも SELECT・INSERT・scan の列順が完全対称（`drive_available_at_start` と `sa_gauge_consumed` の出現回数が 7/7 で一致）で、実行時ズレのリスクは無い。マイグレは ADD COLUMN のみで down 整合・既存行 NULL も検証済み。dup/recipe 非対象・CSV 後方互換・既存始動列不変も守られている。
ただし本サブ**最重要の性格差＝「消費列に検証を連動させない（VAL 非連動）」に、FE zod の 1 点で明確な違反**がある。`schema.ts` で消費列に範囲 ERROR を付与し、`schema.test.ts` が範囲外の拒否を積極的にアサートしている。これは指示書 §3.4-5／§9.1 の明示禁止（「zod で範囲 ERROR にしない」「範囲 ERROR を勝手に足さない」）およびチェックリスト §9 の重大判定に該当する。BE 側（CSV range=nil・validation 無改変・rules.go 未追加）は正しく非連動であり、違反は FE zod に限局している。
この 1 点を除けば設計準拠性は高く、テストも Go/FE ともに要件のケースを網羅している。

## 設計準拠性レビュー結果（§3.4 の 7 項目に対応）

### 1. 列名確定・物理宣言 view — ◎
- `sa_gauge_consumed`（INTEGER・NULL 可・DEFAULT 無）/ `drive_gauge_consumed`（REAL・同）。既存 nullable 数値列（`sa_available_at_start` INTEGER・`drive_damage` REAL）の物理宣言と同方式。
- `*_total` を持たず、000008.down が復元する旧 auto-cache 列（`drive_gauge_consumed_total`/`sa_gauge_consumed_total`）と非衝突。`migrations/000020_add_gauge_consumed_columns.up.sql:14-15`。

### 2. マイグレ 000020 技法 — ◎
- `ALTER TABLE combos ADD COLUMN` ×2（再構築不要・行 DELETE なし）。down は `DROP COLUMN` ×2（`.down.sql:3-4`）。
- 連番 000020（000019 の後）。`migrate_test.go` に up/down/再 up の 3 相を検証する `TestRun_GaugeConsumedColumnsAdded` / `TestRun_GaugeConsumedColumnsDownRollback` を追加。宣言型（INTEGER/REAL）・既存 seed 行の全 NULL・round-trip（SA=6・drive=3.5）・down 後の `drive_available_at_start=REAL` 不変まで確認。FK=OFF×明示 DELETE の同居なし。既存マイグレ改変なし。

### 3. 全接地経路 grep — ◎
- model / DTO（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`）/ service（`CreateInput`/`applyMetadataInput`/`buildComboFromInput`）/ repository（`UpdateMetadataInput`・INSERT bind・scan・全 SELECT 5 箇所・UPDATE の `addOptInt`/`addOptFloat`）/ CSV（csvcore DTO・contract・csvexport・validate・comboio import/export）/ FE（types 4 型・widget×2・詳細・比較・locale）まで漏れなし。
- 列順検証: `internal/repository/combo/repository.go` の全 SELECT・INSERT・scan で `sa_gauge_consumed, drive_gauge_consumed` を `drive_damage` 直後に統一配置。`grep -c` で `drive_available_at_start`＝7、`sa_gauge_consumed`＝7 と対称一致（scan/SELECT ズレ無し）。
- `SELECT recipe_cache FROM combos`（repository.go:998）は単列 select のため対象外で正しく除外。

### 4. 入力 widget（始動と判別） — ◎
- `ComboEditorBasicFields.tsx:252-278`。SA 消費＝整数（`combo-editor-sa-consumed`・min0/max6・`blockNonNumericKeys(false)`）、drive 消費＝小数（`combo-editor-drive-consumed`・min0/max20/step0.5・`blockNonNumericKeys(false,true)`）。test-id は既存 `combo-editor-<field>` 規約準拠。
- ラベルに「消費」を明示（"SAゲージ消費(0〜6)" / "ドライブゲージ消費(0〜20本・0.5刻み)"）。`ComboEditorBasicFields.test.tsx` で始動ラベルとの判別を回帰確認。friend FB #11 の主眼を満たす。

### 5. 検証を設けない（VAL 非連動・最重要） — △（重大な部分違反）
- **BE は正しく非連動（◎ 相当）**: `internal/service/validation` 無改変、`rules.go` に新 Range 追加なし、CSV `validate.go:86-89` は `intField`/`floatField` を **range=nil** で呼び型安全のみ。`TestGaugeConsumedNoValidation` が SA=999・drive=100.5 でも Issue ゼロを確認。
- **FE zod は範囲 ERROR を付与（×＝指示違反）**: `schema.ts:52-53` で `saGaugeConsumed: optInt(0, 6)` / `driveGaugeConsumed: optFloat(0, 20)`。`optInt`/`optFloat`（`schema.ts:13-24`）は `.min()`/`.max()` を**エラーメッセージ付きで強制**するため、消費列に**ブロッキングな範囲 ERROR** が付く。`ComboEditor.tsx:224-236` で `parseComboForm` 失敗時は `toast.error` して `return`（保存中断）＝実際に保存を阻む検証。
- `schema.test.ts:44-53` が `saGaugeConsumed: 7` / `driveGaugeConsumed: 20.5` を `success: false`（拒否）と積極的にアサート。コメント「FE 第一防衛線として範囲は付ける」は、指示書 §3.4-5「zod で範囲 ERROR にしない」・§9.1「範囲 ERROR を勝手に足さない」に真っ向から反する意図的判断。
- 副作用として **FE/BE の受理範囲が不整合**: BE/CSV は SA=999・drive=100.5 を受理（仕様）する一方、FE は SA=7・drive=20.5 すら弾く。記録の自由度（FR303 廃止の精神）を FE 側だけが縛っている。
- チェックリスト §9 は「消費列に検証（VAL-C/D or **FE zod 範囲 ERROR**）を付けている」を**重大＝完了承認を妨げる**と明記。よって高優先で是正が必要。

### 6. CSV 後方互換 — ◎
- `contract.go`: `ColSAGaugeConsumed`/`ColDriveGaugeConsumed` を `CSVColumns` 末尾に追加。新設 `optionalImportColumns` / `requiredImportColumns`（= CSVColumns − 消費 2 列）を導入。
- `csvimport.go:122` は `buildHeaderIndex(header, requiredImportColumns)` で必須列から消費列を除外、`:127` の `unknownColumns(header, CSVColumns)` は全既知列を使い新 CSV での誤 unknown 警告を回避。`get`（`csvimport.go:135-136`）は idx 非存在列に "" を返し、旧 CSV（消費列ヘッダなし）でも安全。
- `TestGaugeConsumedRoundTrip`（SA=6・drive=10.5 往復）・`TestGaugeConsumedBackwardCompatImport`（旧 CSV import→消費 nil）で担保。列末尾追加で DES-002 §7.6 契約を維持。

### 7. dup/recipe 非対象 — ◎
- `DuplicateKey`（repository.go:35-42）は 6 フィールドのまま不変・消費列非含有。service 側 `validation.DuplicateKey` も無改変。`recipe_cache` 経路にも消費列は混入していない。`FindActiveByDuplicateKey` は SELECT 列（scan 用）に 2 列を足したのみで WHERE 条件は不変＝重複判定ロジックに波及なし。

## 設計準拠性以外の指摘事項

- **DES 本体は未改変**（`docs/design` に差分なし）。CHANGE 見込み（DES-003 §3.4 / DES-005 §5.6/§5.7/§5.8 / DES-006 §2.4）は完了報告 §6 の伝達メモで正しく申し送り。ルール遵守。
- **命名・タグ規約**: JSON camelCase（`saGaugeConsumed`）/ DB snake_case（`sa_gauge_consumed`）/ CSV snake_case で統一。model のタグ列は既存整形に合わせて整列済み。規約準拠。
- **列挙的マジックストリング**: CSV 列名は `Col...` 定数化、FE i18n キーは locale 集約。散在なし。
- **i18n キー整合**: 詳細は `comboDetail.metadata.saGaugeConsumed`（ja.json:91/98）、比較は `compare.row.saGaugeConsumed`（ja.json:162/169）で ja/en とも解決。ラベル欠落なし。
- **軽微（既存パターン踏襲・新規劣化なし）**: (a) editor widget のラベルはハードコード日本語だが、M16-01 の始動欄と同一パターン（同コンポーネント内既存の非 i18n 慣習）。(b) `ComboEditor.tsx:695-696` の `FIELD_LABELS` もハードコード日本語だが既存の同マップに追従。(c) `validate.go` で消費列に `code=""`・`sev=0` を渡すのは range=nil ガードで未使用のため無害だが、意図が読み取りにくい（コメントで補足済み）。
- 簡体字・`console.log`/`fmt.Println` 残置は確認範囲で無し。禁則表現（「適切に」等）の新規追加も無し。

## 推奨修正（優先度別）

- **高（M16 完了前に修正必須）**:
  - `web/src/features/combo/schema.ts:52-53` の消費列 zod から**範囲 ERROR（`.min()`/`.max()`）を除去**する。SA 消費は整数型チェックのみ（例: `z.number().int().nullable().optional()`）、drive 消費は数値型チェックのみ（例: `z.number().nullable().optional()`）に留め、CSV の range=nil（型安全のみ）と揃える。指示書 §3.4-5／§9.1・チェックリスト §9（重大）に該当。
  - `web/src/features/combo/schema.test.ts:44-53` の「範囲外を弾く」アサート（SA=7→false / drive=20.5→false）を、**範囲外でも success:true**（VAL 非連動）を確認する内容へ改める。
  - ※ 上記は VAL 非連動という本サブの確定方針に対する明示違反のため高に分類。ただし BE は既に非連動で、被害は FE の保存ブロックに限局・修正も局所的。取り込み判断時は本コンテキストを併記のうえトリアージされたい。

- **中（M17 着手と並行可）**:
  - なし（データ層・マイグレ・CSV・表示は要件充足）。

- **低（将来対応 / 設計担当へ申し送り）**:
  - 比較画面（`CompareTable`）は**始動ゲージの比較行を元々持たない**まま消費行のみ新設された（完了報告 §4-2 で認識済み）。始動残量の比較行要否は設計担当判断に委ねる（本サブスコープ外・据置は妥当）。
  - FE 画像/クリップボード・エクスポートカード（`features/combo-io`）への消費項目追加（完了報告 §4-3・§6 の follow-up）。指示書列挙外のため未対応で妥当、M16-06 等で判断。

## 良かった点

- 接地経路の網羅が徹底しており、SELECT/INSERT/scan の列順を機械的に対称化（grep 対称一致で検証容易）。retrospective-digest §1-A（論理型≠物理宣言・全接地調査）を正しく実践。
- マイグレのテストが up だけでなく down→再 up の可逆性、既存無関係列（`drive_available_at_start=REAL`）の不変まで検証しており、digest §5 の破壊的マイグレ教訓を踏まえた堅い作り。
- CSV 後方互換を `requiredImportColumns` と `unknownColumns(CSVColumns)` の分離で丁寧に設計し、旧 CSV import・新 CSV 無警告の両立を専用テストで担保。
- 完了報告の「実コードと指示書想定の相違」節（service の型エイリアス・比較表の既存状態・エクスポートカードのスコープ判断）が透明で、例外条項の運用が模範的。BE VAL 非連動（CSV range=nil・validation 無改変）は正確に実装されている。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。

---

## 取り込み結果（自動トリアージ）

`implement_plan_full` Phase C により、製造担当（Opus 4.8）が自動でトリアージ・取り込みを実施（2026-07-05）。判断根拠を事後監査可能にするため採否と理由を記録する。

| # | 指摘（優先度） | 採否 | 理由 |
|---|----------------|------|------|
| 1 | **高**: `schema.ts:52-53` の消費列 zod に範囲 ERROR（`.min()`/`.max()`）を付与しており VAL 非連動に違反。`schema.test.ts:44-53` が範囲外拒否を積極アサート | **採用（修正済み）** | 指示書 §3.4-5「zod で範囲 ERROR にしない」・§4.4「FE zod も範囲 ERROR を設けない」・§9.1「範囲 ERROR を勝手に足さない」・チェックリスト §9（重大）に明示違反。承認済みプランに混入した逸脱をレビューが正しく検出。**高指摘の採用のため自動取り込み（安全弁のエスカレーション不要＝エスカレーションは「高の不採用」時のみ）**。 |
| 2 | **低**: 比較画面に始動ゲージ行が元々無いまま消費行のみ追加 | 不採用（据置・申し送り） | 始動行の新設は本サブ（消費列）スコープ外。完了報告 §4-2・§6 で設計担当へ申し送り済み。据置は妥当。 |
| 3 | **低**: FE 画像/クリップボード・エクスポートカードへの消費項目追加 | 不採用（follow-up） | 当該カードは `ExportItemKey` opt-in 体系の別機能面で、指示書 §2.2 の列挙（詳細・比較・CSV）外。完了報告 §4-3・§6 で follow-up として申し送り済み。M16-06 等で判断。 |

### 採用 #1 の修正内容

- `web/src/features/combo/schema.ts`: 消費列を範囲なしへ変更。`saGaugeConsumed: z.number().int().nullable().optional()`（整数型のみ）/ `driveGaugeConsumed: z.number().nullable().optional()`（数値型のみ）。widget の `min`/`max`（UI ステッパー上限）は据置＝範囲は UI のみで担保。BE/CSV の range=nil と整合。
- `web/src/features/combo/schema.test.ts`: 「範囲外を弾く」アサートを「**範囲外（SA=7/999・drive=20.5/100.5）でも success:true**（VAL 非連動）」を確認する内容へ改訂。
- 検証: `tsc --noEmit` エラーなし、schema/editor 関連 49 テスト通過。BE の `TestGaugeConsumedNoValidation`（SA=999・drive=100.5 で Issue ゼロ）と方針が完全一致し FE/BE の受理範囲不整合を解消。

**中優先の指摘は無し（0 件）**。高 1 件を採用・修正済み、低 2 件は既に完了報告で申し送り済みのため追加対応なし。
