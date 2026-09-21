# M15-04 完了報告(製造)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M15-04-tag-color-picker.md` v1.0.1(タグ色選択 UI・FB⑭⑮) |
| 作業環境 | git worktree `wt-m15-04`(コミットは開発者が実施。本ワークツリー内では git 書き込み操作を行っていない) |
| 実装モデル | Sonnet 5 |
| 作成日 | 2026-07-04 |
| 関連 | レビュー報告書 `docs/progress/phase3/m15-04-review.md`(取り込み結果を末尾に追記済み) |

---

## 1. Plan Mode 確定方式(指示書 §3.3 #1〜#5)

1. **現行の色入力 UI と既定灰色の出所**: 「灰色固定」はハードコードされたグレー値ではなく、新規作成時の既定値が空文字列 `""` であることに起因する連鎖バグと判明。`useTagFormDialog.ts` の `color: values.color`(category と異なり `|| undefined` 正規化なし)→ `TagManagementPage.tsx` の `?? undefined`(空文字列を捕捉しない)→ バックエンド `omitempty` が非nilポインタを許容 → DB に `""` が保存 → 表示側 `tag.color ?? DEFAULT_COLOR` も `??` のため空文字列を捕捉できず `style.backgroundColor=""` がブラウザに無視され `Badge` の既定 Tailwind クラス(意図しない灰色)が透けて見える、という経路を grep とコード読解で特定した。
2. **パレットの色数・配色・色名**: 指示書 §4.1 の例示(赤/橙/黄/緑/青/藍/紫/桃/茶/灰)をそのまま採用し10色に具体 HEX を割当(`web/src/features/tag/constants/tagColorPalette.ts`)。色相だけでなく明度も分散させ、かつ色名を常時テキスト表示(ホバー Tooltip 非依存)することで色覚特性に依存しないアクセシビリティを確保。
3. **HEX 直接入力の扱い**: 指示書 §11 の確定事項どおりパレットを主導線としつつ HEX 直接入力を併存。既存の `data-testid="color-input"` を温存し、パレット外 HEX(既存タグ)は「そのまま保持」(どのスウォッチも選択状態にならない)方式を採用。
4. **test-id 命名**: 既存 tag 系 test-id は `color-input` の1件のみ(grep 確認)。アプリ全体の `recipe-*`/`combo-editor-*`/`info-mark-<topic>` の kebab-case・機能プレフィックス規約に倣い `tag-color-palette`(コンテナ)/`tag-color-swatch-<key>`(各スウォッチ)を新規採用(衝突なし確認済み)。
5. **DES-005 CHANGE 要否**: **不要と判定**。DES-005 §5.12(画面12 タグ管理)は「色」を一覧の表示列として挙げるのみで、色の入力方式・既定値には一切言及がなく、パレット化はこれと矛盾しない。

### 追加スコープ(開発者確認済み)

`TagSelector` のインライン「タグ名で即時作成」(`useTagSelectorForm.ts`)は `TagFormDialog` を経由せず常に無色タグを作成しており、これも表示上「灰色」に見える同種の症状であったため、開発者確認の上、本サブで併せて既定色 `DEFAULT_TAG_COLOR` を配線した。

---

## 2. 変更点(成果物)

- **新規** `web/src/features/tag/constants/tagColorPalette.ts`: `TAG_COLOR_PALETTE`(10色・色名+HEX)、`DEFAULT_TAG_COLOR`(パレットの「青」エントリから導出)、`UNSET_TAG_COLOR_FALLBACK`(色未設定タグの表示フォールバック、`TagBadgeList`/`TagSelector` で共有)。
- **新規** `web/src/features/tag/components/TagColorPalette.tsx`: shadcn `RadioGroup`(`@/components/ui/radio-group`)のルートと、Radix `RadioGroupPrimitive.Item` を直接スウォッチ見た目に再スタイリングした単一選択パレット(`role="radiogroup"`/`role="radio"` のネイティブ ARIA セマンティクス・キーボード操作を継承)。
- **変更** `TagFormDialog.tsx`: color フィールドを `TagColorPalette` 主導線 + 既存 HEX 入力(上級者向け併存)に改修。
- **変更** `useTagFormDialog.ts`: 新規作成時のみ `DEFAULT_TAG_COLOR` を初期値に適用(既存タグ編集は非破壊のまま)。送信時 `color: values.color || undefined` で空文字列を正規化(根本原因の修正)。`onSubmit` の引数型を既存 DTO `CreateTagInput` から導出した `TagFormSubmitValues` に変更(重複型定義を解消)。
- **変更** `useTagSelectorForm.ts`: quick-create にも `color: DEFAULT_TAG_COLOR` を配線。
- **変更** `TagBadgeList.tsx`/`TagSelector.tsx`: 表示フォールバックを `??` → `||`(truthy チェック)に修正し、`UNSET_TAG_COLOR_FALLBACK` を共有インポートに統一。
- **テスト**: 新規 `TagColorPalette.test.tsx`。既存 `TagFormDialog.test.tsx`/`useTagFormDialog.test.ts`/`TagBadgeList.test.tsx`/`TagSelector.test.tsx`/`useTagSelectorForm.test.ts` にケース追加・更新。

---

## 3. テストケース数

| 対象 | ファイル | ケース数 |
|------|---------|---------|
| パレット選択 UI | `TagColorPalette.test.tsx` | 4(新規) |
| ダイアログ(既定色・パレット連動・非破壊編集含む) | `TagFormDialog.test.tsx` | 10(既存7+新規3) |
| 既定色・送信正規化(FB⑭本体) | `useTagFormDialog.test.ts` | 13(既存9+新規4) |
| 表示フォールバック(空文字列回帰) | `TagBadgeList.test.tsx` | 8(既存7+新規1) |
| 表示フォールバック(空文字列回帰) | `TagSelector.test.tsx` | 11(既存10+新規1) |
| quick-create 既定色 | `useTagSelectorForm.test.ts` | 5(既存4+新規1) |
| (変更なし) | `TagListTable.test.tsx` | 6 |
| (変更なし) | `TagDeleteConfirmDialog.test.tsx` | 3 |

- **タグ機能サブツリー: 60 件全通過**。
- **フロントエンド全体: 97 ファイル / 616 件全通過**(`pnpm test`)。`tsc --noEmit` エラーゼロ。
- **`make e2e`: 18/18 通過**(`combo-crud.spec.ts` の1件は既知のフレーキーでリトライ後成功、本サブと無関係)。タグ管理画面を対象にした既存 E2E spec は無し(非回帰確認のみ)。
- **実機確認**: バックエンド(`go run ./cmd/combomgr`)+フロントエンド(`pnpm run dev`)を起動し、Playwright スクリプトで `/tags/manage` から新規作成ダイアログを開き、(1) 既定で青スウォッチが選択済み、(2) スウォッチクリックで選択色・HEX 入力欄が連動、(3) パレット外 HEX を直接入力してもどのスウォッチも選択されない、の3点を実機で確認(コンソールエラーなし)。

---

## 4. 命名規約(後続参照)

### tag-color-* test-id
- `tag-color-palette` … パレットのコンテナ(RadioGroup ルート)
- `tag-color-swatch-<key>` … 各スウォッチ(`key` はパレット定数の英語スラッグ: `red`/`orange`/`yellow`/`green`/`blue`/`indigo`/`purple`/`pink`/`brown`/`gray`)
- `color-input` … 既存の HEX 直接入力(本サブ以前から存在、変更なし)

### パレット配色(`TAG_COLOR_PALETTE`)
赤 `#ef4444` / 橙 `#f97316` / 黄 `#eab308` / 緑 `#22c55e` / 青 `#3b82f6`(既定色) / 藍 `#6366f1` / 紫 `#a855f7` / 桃 `#ec4899` / 茶 `#92400e` / 灰 `#6b7280`。

---

## 5. DES-005 CHANGE-058 要否判定

**不要**。DES-005 §5.12(画面12 タグ管理)は「色」を一覧表示列として挙げるのみで、色の入力方式(HEX テキストかパレットか)・既定値については一切規定していない。パレット化・既定色の是正はこの記述と矛盾しない。`tags.color`(DES-003 §3.6)の格納形態(TEXT/HEX)・API・マイグレーションは不変。

---

## 6. 既知の制約

- **HEX 欄を空にして保存しても既存タグの色はクリアされない**: 修正前は(バグにより)空文字列 `""` が書き込まれ実質的に色クリアの代替になっていたが、修正後は `color: undefined` となり、バックエンドの PATCH セマンティクス(`internal/repository/tag/repository.go` の `if input.Color != nil`)により color 列は更新されず元の色が保持される。「空欄=変更なし」という意図した挙動で、回帰テストでロック済み。タグの色を明示的に「未設定に戻す」UI は本サブのスコープ外。
- **`TagSelector` のクイック作成フロー**にも既定色を適用したが、色を選ぶ UI 自体は追加していない(名前のみでの即時作成という既存の軽量フローを維持)。
- **`web/src/features/tag/constants/` という新規ディレクトリパターン**: 指示書 §2.1 の配置指定に従ったが、既存の定数群(`combo-list.ts`/`move-warning.ts`/`mycombo.ts` 等)は全て `web/src/constants/`(フラット)に置かれており、`features/<feature>/constants/` は本プロジェクト初出のパターン。今後の配置一貫性について設計担当への申し送り候補。
- **アクセシビリティの軽微な残課題**: `TagColorPalette` は `FormItem` 内で `FormControl` に包まれていない(HEX 入力側は `FormControl` 配下)。実質的なエラー表示は HEX 入力側で担保されるため致命的ではないが、将来の微調整候補として記録。

---

## 7. レビュー自動トリアージ結果(要約)

レビュー報告書(`docs/progress/phase3/m15-04-review.md`)の指摘のうち、高2件・中2件を採用、低4件のうち2件を採用・2件を理由付きで持ち越し。詳細は同報告書末尾「## 取り込み結果(自動トリアージ)」参照。

- **採用(高)**: (1) `TagColorPalette` を独自 `<button>` 実装から shadcn `RadioGroup` + Radix `RadioGroupPrimitive.Item`(スウォッチ見た目に再スタイリング)へ置換。(2) 本完了報告の作成。
- **採用(中)**: (1) `TagSelector.test.tsx` に空文字列 color のフォールバック回帰テストを追加。(2) `TagFormSubmitValues` を既存 DTO `CreateTagInput` から導出する形に整理。
- **採用(低)**: (1) `DEFAULT_TAG_COLOR` をパレットの「青」エントリから導出(二重管理解消)。(2) 未参照になった `TagFormValues` の `export` を削除。
- **持ち越し(理由付き・低)**: (1) `TagColorPalette` を `FormControl` 配下に含めるかの検討(実害なし、微調整扱い)。(2) `web/src/features/tag/constants/` という新規ディレクトリパターンの扱い(指示書起因のため製造の落ち度ではなく、設計担当との将来的なすり合わせ事項)。
