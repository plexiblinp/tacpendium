# M17-05a 完了報告書(import 体験再設計 B-1〜B-6)

| 項目 | 内容 |
|------|------|
| タスクID | M17-05a |
| 指示書 | `docs/instructions/phase3/M17-05a-import-redesign.md` v1.0.1 |
| レビュー報告書 | `docs/progress/phase3/m17-05a-review.md`（fresh subagent・独立レビュー） |
| 完了日 | 2026-07-18 |
| 製造 | Claude Code（implement_plan_full 一気通貫） |
| スキーマ変更 | なし（承認ゲートなし） |

## 1. 概要

import 体験の再設計 B-1〜B-6 を実装した。**CSV 契約（DES-002 §7.6）と BE の検証エラー体系（CHANGE-066 register 分離）は不変**、変更は **UI 動線と重複挙動、および FE の表示層**に閉じている。**核は B-6**（重複時「新規追加」の廃止＋「セットプレイのみ取込」＝既存コンボへの setups 親解決）。BE 追加は setups 親解決経路のみ。

## 2. Plan Mode 確認結果（§3.3 の 9 項目）

| # | 項目 | 実装・判断 |
|---|------|-----------|
| 1 | setups 重複判定（新規設計点） | **実装位置＝import サービス `commitOneSetup`**。判定方式は**既存不変条件 VAL-S04（同一コンボ配下の同一レシピ・名前非依存）を graceful skip へ翻訳**する方式に決定（下記 §4 に根拠）。**combos の `recipe_hash` は流用せず**、`CalcSetupRecipeHash` も自前比較には使わず、setup ドメインの正規の重複判定（`FindDuplicateInCombo`）をそのまま尊重した。 |
| 2 | 親解決 | `commitOneCombo` が `checkDuplicate` の返す重複相手 id（`res.Duplicates[0].ID`）を、`setups_only` 時のみ既存 `createdByLocal` に登録。既存 `resolveSetupParent` がこれを引き、setups が既存コンボへ紐づく。 |
| 3 | 「上書き」枠の予約 | 選択肢を `DUP_OPTIONS` **配列で定義し map 描画（要素数非依存）**。`DupAction` 型（`types.ts`）に将来 `"overwrite"` を足し配列へ 1 要素 push するだけで 3 択化できる構造（コメントで明記）。**UI 非表示・実装しない**（M13-i 繰越）。 |
| 4 | B-1 入口一本化 | setup 欄は残し**従属化**（コンボ CSV 未選択時 `disabled`＋単独導線/ガード文言除去）。`handlePreview`/`handleCommit` の `comboFile` 必須ガードを維持＝**成立しない setups 単独入力を作らせない**送信前ガード。CSV 契約不変。 |
| 5 | B-2 写像 | BE は `[VAL-CODE] column: message` の**単一文字列**（構造化 DTO なし）。FE `formatIssue` が parse→`comboImport.val.*`/`col.*` 写像。**未写像は英語原文フォールバック**、VAL コードは折りたたみ（`<details>`）で保持。両ロケール parity 通過。 |
| 6 | B-3 表示解決 | `usePreviewNames`＝`useCharacters` の code→nameJa と per-character `GET /api/moves`（`useQueries`）の move `nameJa`（official_ja_move）を流用。**未投入キャラ・未知 code は生 code のまま**（フォールバックで自然充足）。 |
| 7 | B-4/B-5 | B-4＝combo テーブルの `local_id` 列削除（CSV 列は維持）・行特定は行番号。setup 表の親は解決した親コンボ名（解決不可時のみ生 local_id）。B-5＝完了トースト（成功/スキップ/エラー件数）＋結果へ自動スクロール＋実行中の無効化・進行表示。 |
| 8 | 非波及 | `setups_only` でも重複 combo は **skip のまま**（Create しない）＝`recipe_hash`/`RecomputeComboCache`/`DuplicateKey` 不発火。setups 追加は `CreateSetup`（`RecomputeSetupCache` のみ＝combo cache 非波及）。Go テストで固定。 |
| 9 | M17-04 連携口 | `ComboImportPage` の自動プレビュー effect（router state→`setTimeout(0)`＋cleanup＋`previewMRef`＋`previewM.data` 購読）を**温存**し外形挙動を変えず。router 層リファクタ（followup §G-15）は**行っていない**。回帰 E2E green。 |

## 3. 成果物（コミット単位）

- **BE**: `internal/service/comboio/types.go`（`DupAdd`→`DupSetupsOnly`）・`import.go`（親解決・VAL-S04 graceful skip）・`internal/api/comboio/handler.go`（`parseDupAction`）＋ Go テスト。
- **FE 写像/解決**: `web/src/features/combo-io/formatIssue.ts`（＋test）・`usePreviewNames.ts`・`web/src/locales/ja.json`／`en.json`（`comboImport.val/col`）。
- **FE 画面**: `web/src/pages/ComboImportPage.tsx`（B-1/B-2/B-3/B-4/B-5/B-6 UI）・`web/src/features/combo-io/types.ts`（`DupAction`）。
- **E2E**: `web/e2e/combo-csv-io.spec.ts`（B-1〜B-6＋B-2 新規テスト）。

## 4. setups 重複判定の実装方式と根拠（§3.3-1・要記載）

- **当初計画**: 親コンボ配下の既存 setups を取得し `(Name, CalcSetupRecipeHash)` の**同名かつ同レシピ一致**で自前 skip する予定だった。
- **実装中に判明した設計衝突**: 既存不変条件 **VAL-S04**（`internal/service/setup/validate.go`・`FindDuplicateInCombo`）が**コンボ配下の同一レシピ setups を名前非依存で拒否**する。このため指示書 §5.1 の 3 ケースのうち**「別名・同レシピ＝取込む」は実現不能**（`CreateSetup` が検証エラー＝failed になる）。承認済み基準（別紙 §4-(4)）自体は「同名＋同レシピでスキップ／名前だけ一致は取込む」のみで、別名・同レシピには言及していない。
- **開発者へエスカレーションし確定（2026-07-18）**: **「レシピ一致で graceful skip（名前非依存）」**を採用。承認基準（同名＋同レシピ=skip・同名別レシピ=取込む）を満たしつつ、既存不変条件 VAL-S04 と整合する。
- **実装**: `commitOneSetup` は `CreateSetup` を呼び、検証結果に **VAL-S04 が含まれる場合のみ**「同一レシピの既存セットプレイのためスキップ」として **skipped 行**に翻訳（それ以外の検証エラーは従来どおり failed）。**`recipe_hash`（combos 用）は流用していない**＝意味の混線回避（§9.3）。setup ドメインの正規重複判定をそのまま使うため、判定ロジックの二重定義も避けられた。
- **テスト**: `TestImportSetupsOnlyDuplicateSetupJudgement`（同名+同レシピ=skip／同名+別レシピ=取込む／**別名+同レシピ=skip（レシピ一致）**）・`TestImportSetupsOnlyParentResolution`・`TestImportSetupsOnlyDoesNotTouchCombo`（version/step_count/recipe_cache 不変）。

## 5. 非波及の証跡

- **M17-04 領域 差分ゼロ**: `git diff -- web/src/features/intake internal/service/intake internal/api/intake web/src/pages/IntakeHelperPage.tsx` が**空**。取込ヘルパーの i18n 直書き境界に写像を作っていない（§2.5 固定 ja 境界）。
- **`DuplicateKey`・`recipe_hash`・`RecomputeComboCache`・CSV 契約・BE エラー体系** 不変（テスト・grep で担保）。
- **回帰 E2E**: `m17-04-intake-helper.spec.ts`（取込ヘルパー→自動プレビュー・`isPending` 非固着）green。`make e2e` 全 37 件 green。

## 6. テスト結果

- `go test ./internal/...` 全 green（B-6 新規 3 テスト群＋非回帰）。
- `pnpm test`（Vitest）776 件 green（`formatIssue` 8 件・`locales` parity 含む）。
- `make e2e` 37 件 green（combo-csv-io 2 件〔B-1〜B-6・B-2〕＋回帰）。
- `tsc --noEmit` クリーン。

## 7. 既知の制約・申し送り

- **B-2 file レベルエラーは英語フォールバック**: BE は file 全体拒否時 `Issue.Message` のみを FE へ渡し（`[VAL-CODE]` prefix 無し・register 分離のため code 非露出）、`formatIssue` は写像できず英語原文になる。行レベル badge（B-2 の主対象）は完全に日本語化される。file レベルまで写像するには BE が code を露出する必要があり本サブのスコープ外（BE 不変原則）。**「未写像は英語原文フォールバック」の許容範囲内**。
- **日本語文言は仮**（§11-1・checklist §10 軽微）。E2E は文言セレクタも一部使うが test-id 優先ではなく安定表示テキスト（列ラベル）を使用。確定時は `ja.json` の `comboImport.*` を差し替え。

## 8. DES 反映要点（設計担当への CHANGE 起票用・製造は DES を直接編集しない）

- **DES-005 §5.14（インポート画面）**: 入口一本化（B-1・setups は従属添付）、local_id 非表示（B-4）、プレビュー表示名化（B-3）、実行フィードバック（B-5）、重複時 2 択「skip／セットプレイのみ取込」＋「上書き」枠の構造予約（B-6）、VAL エラーの日本語表示＋折りたたみ（B-2）。
- **DES-006 §6（重複挙動の正典）**: 「新規追加」廃止。「セットプレイのみ取込」＝重複 combo skip＋setups を既存コンボへ親解決。**setups 重複判定＝レシピ一致で skip（名前非依存＝VAL-S04 に整合。承認基準の「別名・同レシピ＝取込む」は VAL-S04 と衝突するため『レシピ一致で skip』へ確定）**。指示書 §5.1 の「別名・同レシピ＝取込む」記述は本確定に合わせ補正が必要。
- **番号は起票時に registry で採番**。
- **【レビュー指摘 2・繰越の注記候補】** preview の親解決 ○ は batch メンバーシップ判定で、既定 `skip` を選ぶと重複コンボが未作成となり配下 setup は commit で「親未作成」skip になる（preview は選択 dupAction を知らない既存構造の延長）。データ整合の問題ではないが、DES-005 §5.14 の CHANGE 起票時に「preview の親解決可否表示は dupAction 非依存＝実行結果と乖離しうる」旨を注記する候補。

## 9. レビューと取り込み（Phase B/C）

- **レビュー**: `docs/progress/phase3/m17-05a-review.md`（fresh subagent・独立レビュー）。**優先度「高」ゼロ**。核 B-6（VAL-S04 graceful skip 翻訳・非波及のテスト固定）を含め設計準拠性 §1〜§7 は◎。
- **自動トリアージ**（同ファイル末尾「取り込み結果」）: 中 1 件採用（併発エラー時は failed 優先へ＝`isOnlySetupDuplicateError`）、低 2 件は理由付きで繰越。**高の不採用ゼロ＝エスカレーション不要**。
