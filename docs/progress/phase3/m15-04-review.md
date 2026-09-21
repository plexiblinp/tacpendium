# M15-04 レビュー報告書

対象: `docs/instructions/phase3/M15-04-tag-color-picker.md` v1.0.1（タグ色選択 UI・FB⑭⑮）。基準: `docs/instructions/phase3/reviews/M15-04-review-checklist.md` v1.0.0。read-only レビュー（コード未変更、`git status`/`git diff` で対象を確認の上 Read ツールのみで実施）。対象は未コミットの作業ツリー差分（新規3・変更9ファイル）。

## 総評

最重要ゲートである「非スキーマ・保存形態不変」（`tags.color` は既存 HEX 列のまま、`internal/`・`migrations/` に差分ゼロ）は完全に満たしている。FB⑭（新規登録の既定色が灰色固定）の根本原因も正しく特定・修正されている：旧実装は `tag.color ?? DEFAULT_COLOR` で `??` を使っていたため、バックエンドが空文字列 `""` を返すケースで nullish 判定に掛からずフォールバックが効かなかった（`""` は null/undefined ではない）。これを `tag.color || UNSET_TAG_COLOR_FALLBACK` に是正し、かつ `TagFormDialog` 本線だけでなく `TagSelector` の「クイック新規作成」経路（`useTagSelectorForm.ts`）にも既定色 `DEFAULT_TAG_COLOR` を配線しており、灰色固定の発生源を横断的に潰せている点は評価できる。HEX 直接入力の温存・パレット外 HEX の非破壊表示・PATCH 時の「空文字→undefined 正規化」（バックエンドの `*string` nil=不変更契約と整合）もテストで裏取りされており、既存タグを壊さない配慮が行き届いている。

一方で、**単一選択のスウォッチ選択 UI を独自の `<button aria-pressed>` グループとして自作しており、本プロジェクトで既に導入・使用実績のある shadcn `RadioGroup`/`RadioGroupItem`（`ModifiersEditor.tsx` で同種の単一選択 UI に実績あり）を実査・流用した形跡がない**。これはチェックリスト §1.2/§9 が名指しで禁止する「既存スウォッチ/shadcn を実査せず自作再発明（playbook §4.6/§4.9）」に直接該当する。加えて、`docs/progress/` に M15-04 の完了報告が存在せず、指示書 §7.4/§7.5 が要求する Plan Mode 確定方式・パレット命名・DES-005 CHANGE 要否判定の記録がリポジトリ上で確認できない。表示整合の Vitest カバレッジも `TagBadgeList` のみ回帰テストが追加され `TagSelector` 側は同種の `??`→`||` 変更が無テストのまま残っている。重大な非破壊性違反・スキーマ逸脱は無いが、上記3点は完了前に手当てすべき事項として指摘する。

## 設計準拠性レビュー結果

### §1.1 非スキーマ・保存形態不変（指示書 §1.1・§2.2・最重要）… ◎
- `git status`/`git diff` で確認した変更範囲は `web/src/features/tag/` 配下のみ（新規3・変更9）。`internal/`・`migrations/`・`go.mod` に差分ゼロ。`tags.color` の格納形態（TEXT/HEX）は不変。
- 選択色は一貫して `TagFormValues.color`（zod: `z.string().regex(/^(#[0-9A-Fa-f]{6}|)$/, ...)`）経由で HEX 文字列として送信される（`useTagFormDialog.ts:12-15`）。保存契約は不変。

### §1.2 パレット選択 UI（指示書 §4.1・FB⑮）… △（既存 shadcn 流用の実査不足）
- ◎ スウォッチ＋色名: `TagColorPalette.tsx`（`grid grid-cols-5`）で10色（赤/橙/黄/緑/青/藍/紫/桃/茶/灰）＋各色名を表示。選択中は `aria-pressed`＋`border-slate-900 ring-2` で可視化（`TagColorPalette.tsx:9-40`）。単一定義（`web/src/features/tag/constants/tagColorPalette.ts`）で散在ハードコードなし。
- ◎ タップ/クリックで選択（`<button type="button" onClick>`）、モバイル/LAN で破綻する要素なし（arch §10）。
- **△ 既存 shadcn コンポーネントの流用確認が不十分**: 本 UI は「固定された選択肢群から厳密に1つを選ぶ」という単一選択（ラジオ）セマンティクスそのものだが、`web/src/components/ui/radio-group.tsx`（`@radix-ui/react-radio-group` ラッパー、`RadioGroup`/`RadioGroupItem`）が既に導入済みで、`ModifiersEditor.tsx:114-128`（`RadioGroup value={localType} onValueChange={setLocalType}` + `RadioGroupItem value={t.value}`）で同種の単一選択 UI に実績がある。今回はこれを検討・流用せず、`<button>` 手組み＋`aria-pressed` トグルボタン群として独自実装している。`RadioGroupItem` の `className` を上書きしてスウォッチ見た目に仕立てる余地は十分にあり（Radix の `data-state=checked` で選択状態のスタイリングも可能）、playbook §4.6/§4.9（既存 UI コンポーネントの3点セット確認＝構造/責務/Props を見てから再利用可否を判断）およびチェックリスト §1.2/§9「既存スウォッチ/shadcn を実査せず自作再発明」に抵触する。機能・アクセシビリティ（`aria-pressed`＋`aria-label`）自体は破綻していないため即座に動作不良ではないが、shadcn 統一導入済み（playbook §4.6.4 M7 完了）以降のプロジェクト方針との整合性の観点で是正を推奨する。

### §1.3 既定色の是正（指示書 §4.2・FB⑭）… ◎
- 新規登録時（`tag == null`）は `DEFAULT_TAG_COLOR`（`#3b82f6`＝パレットの「青」と同値）で初期化（`useTagFormDialog.ts:36-44`）。灰色固定の根本原因（`tag.color ?? DEFAULT_COLOR` で `""` が nullish 扱いされない）を正しく特定し、表示側（`TagBadgeList.tsx:44`）・保存側（新規作成時デフォルト付与）の両方を是正。
- `TagSelector` のクイック新規作成（`useTagSelectorForm.ts:13`）にも同じ `DEFAULT_TAG_COLOR` を配線しており、タグ作成経路が2つ（`TagFormDialog` 本線／`TagSelector` クイック作成）ある事実を実査した上で両方を修正した形跡がある（digest §3 固定前提監査の趣旨に合致）。
- テスト: `useTagFormDialog.test.ts`（FB⑭ ケース）・`TagFormDialog.test.tsx`（FB⑭ ケース）・`useTagSelectorForm.test.ts`（FB⑭ ケース）の3箇所で既定色を検証。

### §1.4 HEX 入力・既存色の保持（指示書 §4.3）… ◎
- HEX 直接入力を維持（`TagFormDialog.tsx:102-117`、`data-testid="color-input"` は既存の test-id を温存）。パレット外 HEX は「そのまま保持」方式（§4.3 の許容選択肢の一つ）を採用：`TagColorPalette` の `active` 判定は完全一致のみのためパレット外色ではどのスウォッチも選択中にならず、HEX 欄の値はそのまま表示される（`TagFormDialog.test.tsx` の「パレット外の HEX を持つ既存タグを編集」ケースで検証）。
- 送信時に空文字列を `undefined` へ正規化する契約（`useTagFormDialog.ts:51`）は、バックエンド `UpdateTagInput.Color *string`（`internal/model/tag.go`）＋リポジトリの `if input.Color != nil { SET color = ? }`（`internal/repository/tag/repository.go:156-158`）という「キー不在=不変更」契約と正しく整合しており、既存タグの色を破壊せず更新できる。テスト（`useTagFormDialog.test.ts` の2ケース）で裏取り済み。

### §1.5 表示整合・test-id（指示書 §4.4）… ○（TagSelector のテスト漏れ）
- `TagBadgeList.tsx:44` は `tag.color || UNSET_TAG_COLOR_FALLBACK` に修正され、空文字列でもフォールバック色になる回帰テストが追加された（`TagBadgeList.test.tsx` 末尾）。
- `TagSelector.tsx:114` も同じ `tag.color || UNSET_TAG_COLOR_FALLBACK` に修正されているが、**`TagSelector.test.tsx` は未変更で、この変更に対応するテスト（空文字列 color のフォールバック表示）が無い**。指示書 §5「表示整合（Vitest）: `TagBadgeList`/`TagSelector` が選択色を反映」およびチェックリスト §4 は両コンポーネントを明示的に要求しており、`TagBadgeList` のみで `TagSelector` が漏れているのはテスト網羅の穴。
- test-id: `tag-color-palette`/`tag-color-swatch-<key>` は新規命名。タグ機能内には（`color-input` を除き）事前の test-id 規約が存在しないことを確認済み（`grep -rln "data-testid" web/src/features/tag/` で該当ファイルは `TagColorPalette.tsx`/`TagFormDialog.tsx` の2件のみ）。ドメインプレフィックス（`tag-color-*`）を付けた命名は既存の `recipe-*`/`combo-editor-*`/`info-mark-<topic>` 系の慣習と整合しており妥当。`color-input` は本サブ以前から存在する既存 test-id で、新規追加ではない。

### §1.6 DES 直接編集の禁止（指示書 §7.4）… △（判定結果の記録なし・DES 自体は非改変）
- `docs/design/` 配下に差分なし（DES 本体を直接編集していない点は問題なし）。
- ただし **DES-005 CHANGE 要否の判定結果が `docs/progress/` のどこにも記録されていない**（`docs/progress/` 配下に M15-04 の完了報告ファイルが存在しない。§8 参照）。`change-number-registry.md` は最新版（1.45.0、次番号=058）で指示書記載の「次番号058」と整合しているため、CHANGE-058 が起票されていないこと自体は矛盾していないが、「要否を判定した」という記録自体が見当たらない。

## 設計準拠性以外の指摘事項

- **型の重複定義**: `useTagFormDialog.ts` に `TagFormSubmitValues`（`{name; category?; color?}`）を新設しているが、これは `@/types/tag` の `CreateTagInput`/`UpdateTagInput` とほぼ同一の形をローカル定義した重複。`TagFormValues`（zod 推論型、`color` は必須 `string`）と名前が紛らわしい2つの型が並存する状態になっている。実害はない（`TagManagementPage.tsx` 側のインライン型と構造的に一致するため型は通る）が、可読性の観点で `Pick`/`Omit` 等での導出や既存 DTO 型の再利用を検討する余地がある。
- **`DEFAULT_TAG_COLOR` の値がパレットと二重管理**: `tagColorPalette.ts` 内で `TAG_COLOR_PALETTE` の「青」エントリ（`hex: "#3b82f6"`）と `DEFAULT_TAG_COLOR = "#3b82f6"` が別々にハードコードされている。同一ファイル内の別々の場所で同じマジックストリングを重複させており、将来パレットの青を変更した際に既定色が追従しない罅裂リスクがある。`TAG_COLOR_PALETTE.find(c => c.key === "blue")!.hex` からの導出が望ましい。
- **`TagFormValues` エクスポートの死蔵**: `useTagFormDialog.ts` がエクスポートする `TagFormValues` 型は、`TagFormDialog.tsx` 側が `TagFormSubmitValues` に切り替わったことで外部からの参照がゼロになった（`grep` 確認済み）。実害はないが不要エクスポートの整理余地あり。
- **`web/src/features/tag/constants/` という新パターン**: 指示書 §2.1 が「`web/src/features/tag/` 配下・定数」と配置を指定しており製造はそれに従っているが、既存の定数群（`combo-list.ts`/`compare.ts`/`move-warning.ts`/`mycombo.ts` 等）は全て機能固有でも `web/src/constants/`（フラット）に置かれており、`features/<feature>/constants/` というネストは本プロジェクト初出のパターンになる。指示書起因のため製造の落ち度ではないが、今後の配置一貫性の観点で設計担当への申し送り候補として記録しておく。
- **`FormControl` 未適用**: `TagColorPalette` は `FormItem` 内で `FormControl` に包まれていない（`Input` のみ `FormControl` 配下）。shadcn Form パターン（architecture-patterns §8）では通常フィールドの実体コントロールを `FormControl` で包み `aria-describedby`/`aria-invalid` を自動配線するが、パレット自体は状態のソースとして機能しているにも関わらずこの配線から外れている。実質的なエラー表示は `Input` 側で担保されるため致命的ではないが、スクリーンリーダーがパレット操作時にエラー状態を認識しない可能性がある。

## 推奨修正（優先度別）

- **高（M15-04完了前に修正必須）**:
  1. `TagColorPalette` を独自 `<button>` 実装のまま採用するか、既存 `RadioGroup`/`RadioGroupItem`（`ModifiersEditor.tsx` 実績）を流用する形に置き換えるかを開発者判断で確定する。チェックリスト §9 の重大判定基準「既存スウォッチ/shadcn を実査せず自作再発明」に直接該当するため、少なくとも実査結果（流用しない理由）を完了報告に明記する。
  2. `docs/progress/` に M15-04 完了報告を作成し、Plan Mode 確定方式（既定灰色の出所・パレット色数/配色・HEX 入力の扱い・test-id 命名）・テストケース数・**DES-005 CHANGE 要否の判定結果**を記録する（指示書 §7.4/§7.5・チェックリスト §8）。
- **中（次マイルストーン着手と並行可）**:
  1. `TagSelector.test.tsx` に空文字列 color のフォールバック表示ケースを追加し、`TagBadgeList` と同水準のテスト網羅にする。
  2. `TagFormSubmitValues` を既存 `CreateTagInput`/`UpdateTagInput`（`@/types/tag`）から導出する形に整理し、`TagFormValues` との役割の違いをコメントで明記する。
- **低（将来対応）**:
  - `DEFAULT_TAG_COLOR` を `TAG_COLOR_PALETTE` から導出し二重管理を解消。
  - 未参照になった `TagFormValues` エクスポートの整理。
  - `TagColorPalette` を `FormControl` 配下に含めるかの検討（アクセシビリティ微調整）。
  - `web/src/features/tag/constants/` という新規ディレクトリパターンの扱いを設計担当と将来的にすり合わせる（既存 `web/src/constants/` フラット規約との整合）。

## 良かった点

- FB⑭ の根本原因（`??` と空文字列の非nullish判定のミスマッチ）を正確に特定し、`TagBadgeList` の表示側だけでなく `TagFormDialog`/`useTagSelectorForm` の両方の新規作成経路を横断的に修正している。回帰防止テスト（「color が空文字列のときもデフォルト色で表示する(旧バグの回帰防止)」）にコメントで意図を明記しているのも良い。
- HEX 空欄送信時に `undefined` へ正規化する設計が、バックエンドの `*string` nil=不変更契約（`internal/repository/tag/repository.go`）と矛盾なく噛み合っており、既存タグの色を破壊しない配慮がコードとテストの両面で徹底されている。
- 非スキーマの原則（`tags.color` 保存形態・API 不変）を完全に守り、バックエンド・マイグレーションに一切手を入れていない。
- パレット外 HEX の保持・既存タグ編集時の既定色の非強制付与（「無色タグ」を開いても勝手に青にしない）など、細部で既存データを壊さない判断が随所に見られる。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `pnpm test`/`tsc --noEmit`/`make e2e` は本レビュー環境では実行していない（read-only の方針に従い Read ツールでの静的確認のみ）。完了報告が存在しないため、テスト全通過の自己申告も確認できていない。
- 不明: Plan Mode で開発者へパレット色数・配色（8〜12色）・色名が実際に提示され確定を得たかどうかは、コード成果物のみからは判断できない（指示書 §11 は開発者確認事項1〜3が事前確定済みとしているが、パレットの具体的配色自体は §9.2「推測で進めてよい事項」に該当するため、コード上の配色自体は不当ではない）。

---

## 取り込み結果（自動トリアージ）

対応: `docs/progress/phase3/m15-04-completion-report.md` §7 参照。以下、各指摘の採否と理由。

### 高（M15-04完了前に修正必須）

1. **採用 — `TagColorPalette` の shadcn 流用**: 独自 `<button aria-pressed>` グループを、shadcn `RadioGroup`（`@/components/ui/radio-group`）ルート + Radix `RadioGroupPrimitive.Item` を直接使い swatch 見た目に再スタイリングする形に置換した。shadcn の `RadioGroupItem` 再エクスポートは丸インジケータ（`<Circle>`）を JSX 内に固定描画しており `children` で上書きできない構造だったため、その1階層下の Radix プリミティブ（既に `radio-group.tsx` がラップしているのと同じ `@radix-ui/react-radio-group`）を直接使用し、`role="radiogroup"`/`role="radio"` のネイティブ ARIA セマンティクスとキーボード操作（roving tabindex）を継承しつつスウォッチ形状を実現した。理由: チェックリスト §9 の重大判定基準に直接該当し、レビュー完了（§12）の必須ゲートのため。副作用として jsdom が `ResizeObserver` 未実装だったため、`TagColorPalette.test.tsx`/`TagFormDialog.test.tsx` にテスト用の最小スタブを追加（Radix の bubble input 機構が内部使用）。
2. **採用 — 完了報告の作成**: `docs/progress/phase3/m15-04-completion-report.md` を新規作成し、Plan Mode 確定方式・パレット命名・DES-005 CHANGE 要否判定（不要）・テストケース数・既知の制約を記録した。

### 中（次マイルストーン着手と並行可）

1. **採用 — `TagSelector.test.tsx` のテスト漏れ補完**: 空文字列 color のフォールバック表示ケースを追加（`TagBadgeList` と同水準の網羅性）。
2. **採用 — `TagFormSubmitValues` の型整理**: ローカル定義を廃し、既存 DTO `CreateTagInput`（`@/types/tag`）からの型エイリアスに変更。

### 低(将来対応)

1. **採用 — `DEFAULT_TAG_COLOR` の二重管理解消**: `TAG_COLOR_PALETTE.find(c => c.key === "blue")!.hex` から導出する形に変更し、マジックストリングの重複を解消した。
2. **採用 — 未参照 `TagFormValues` エクスポートの整理**: 外部からの参照がないことを再確認の上、`export` キーワードを削除しファイルローカル型に変更した。
3. **持ち越し（理由: 実害なし・微調整扱い） — `TagColorPalette` の `FormControl` 配下配置**: エラー表示自体は HEX 入力側で担保されており機能的破綻はないため、アクセシビリティの微調整として完了報告に記録の上、将来対応とした。
4. **持ち越し（理由: 指示書起因のため製造の落ち度ではなく設計担当との将来的なすり合わせ事項） — `web/src/features/tag/constants/` の新規ディレクトリパターン**: 指示書 §2.1 が明示した配置であり本サブでの変更対象ではないため、完了報告に申し送り事項として記録した。
