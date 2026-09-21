# M7-01 レビュー報告書

## 総評

shadcn/ui 統一導入(Dialog + Popover 系 17 件移行)+ Header 共通化 + ハンバーガーメニュー化 + 残課題 3 解消を網羅的に実施した、本プロジェクト最大規模の指示書に対する製造結果として高品質。shadcn/ui 初期化・17 件のラッパー移行・Props 命名是正・モーダル実装パターン統一・`window.confirm` 除去・Header 共通化 + ハンバーガーが指示書に沿って完了している。テスト 387 件全 PASS、ビルドもエラーなし。スコープ外への逸脱もなく、設計書本体・補足資料への変更もない。指摘事項は軽微なものに限られる。

## 設計準拠性レビュー結果

### 1. ファイル一覧（§2.1 / §2.2 / §2.3 / §2.4）

**◎ 適合**

- `web/components.json` 新設 ✓
- `web/src/lib/utils.ts`（`cn()` 関数）新設 ✓
- `web/src/components/ui/` 新設 → 12 件 + `button.tsx` = 計 13 件。`button.tsx` は `alert-dialog.tsx` が内部で `buttonVariants` を参照するため shadcn/ui CLI が自動生成した依存コンポーネント。§2.1 の 12 件リストには明記されていないが CLI 動作の必然的結果であり問題なし
- `web/src/components/Header.tsx` + `Header.test.tsx` 新設 ✓
- `web/src/lib/utils.test.ts` 新設 ✓
- 17 件のラッパー修正 ✓
- 呼び出し元 Props 渡し修正 ✓
- Header 共通化 7 ページ ✓

### 2. shadcn/ui 初期化の妥当性（§4.1）

**◎ 適合**

- `components.json`: `style: "default"`, `baseColor: "slate"`, `rsc: false`, `cssVariables: true` — §3.4.10 必須項目 2 の推奨値と完全一致
- `tailwind.config.js`: `darkMode: ["class"]`, `theme.extend.colors`（CSS 変数参照）, `borderRadius`, `keyframes`（accordion-down/up）, `plugins: [tailwindcssAnimate]` — shadcn/ui CLI 標準生成内容と整合
- `web/src/index.css`: `:root` + `.dark` CSS 変数定義 — shadcn/ui Slate テーマの標準値
- `web/src/lib/utils.ts`: `clsx` + `tailwind-merge` の `cn()` 関数 — dead dependency 解消 ✓
- `vite.config.ts` の `@/` エイリアス: 既存設定維持、追加変更不要 ✓
- 依存追加（package.json）: `@radix-ui/react-*` 10 件 + `class-variance-authority` + `tailwind-merge` + `tailwindcss-animate` + `cmdk` + `@radix-ui/react-slot` — CLAUDE.md §6 許可ライセンス（MIT）準拠 ✓

### 3. 17 件移行の妥当性（§4.3 / §4.4 / §4.5）

**○ 良好（軽微指摘あり）**

- 全 17 件が shadcn/ui ベースに移行完了
- `dialog` / `alert-dialog` の使い分け: PutConfirmDialog / PermanentDeleteConfirm / DuplicateWarning / TagDeleteConfirmDialog / SetupAccordionItem / PromoteToFinalButton = `alert-dialog`、AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / TagFormDialog / LinkExistingSetupModal / ModifiersEditor = `dialog` — §3.4.10 必須項目 6 の推奨と完全一致 ✓
- 内部状態維持: 全 17 件で `useState` / `useMutation` / `useQuery` を指示書通り維持 ✓
- `console.warn` 温存（ModifiersEditor P-01 相当）: ✓

**指摘 3-a（低）**: `TagSelector`（#12）は指示書 §2.2 表 A で `popover` + `command` を指定しているが、実装は `Popover` + ネイティブ `<input>` + カスタムリストで構成されており、`command`（cmdk）コンポーネントを使用していない。`cmdk` 依存は package.json に追加済みだが、`web/src/components/ui/command.tsx` は生成されているもののプロダクションコード内で一切 import されていない（dead code）。機能的には同等の UI を実現しているが、指示書の shadcn/ui コンポーネント指定との乖離がある。

### 4. Header 共通化の妥当性（§4.2 / §4.6）

**◎ 適合**

- `Header.tsx`: `useLocation` 内部呼出、`sticky` Props、PC ナビ + ハンバーガー Sheet — 指示書 §4.2 概形例に忠実
- ナビリンク構成 7 項目: ロゴ（CombMgr → /combos）+ コンボ一覧 + マイコンボ + コンボ比較 + タグ管理 + プリセット管理（disabled）+ ゴミ箱 + 設定 — §4.2.2 定義と一致
- 現在ページ判定: `pathname === link.to` 完全一致 + `pointer-events-none` + `text-gray-400` + `aria-current="page"` — §4.2.4 方針と一致
- M6-02 SettingsPage の「設定」リンク非表示 → disabled スタイルに統一: Header 共通化で自動達成 ✓
- Header 表示 7 ページ: ComboListPage / MyComboPage / ComboDetailPage / ComparePage / SettingsPage / TagManagementPageRoute / TrashPage — 全置換完了 ✓
- **Header 非表示 4 ページ（案 A 採用）**: ComboEditorPage / SetupEditorPage / WizardPage / HomePage — Header 追加なし ✓
- TrashPage: `<Header sticky />` で `sticky top-0 z-10` 温存 ✓
- 残課題 3 解消: 全 7 ページに「設定」+ プリセット disabled 自動反映 ✓

### 5. ハンバーガーメニュー化の妥当性

**◎ 適合**

- shadcn/ui Sheet 使用、`side="right"` ✓
- 表示閾値: `sm:hidden`（ハンバーガー）/ `hidden sm:flex`（PC ナビ）✓
- `lucide-react` `Menu` アイコン ✓
- Sheet 内: `SheetClose asChild` + `Link` でリンククリック時自動閉 ✓
- Sheet 内ナビ: PC と同構成 + 現在ページ disabled ✓
- `aria-label="メニューを開く"` ✓

### 6. Props 命名是正の妥当性

**◎ 適合**

- 全 17 件で `open: boolean` 統一（`isOpen` 残存なし）✓
- 全 17 件で `onOpenChange: (open: boolean) => void` 採用 ✓
- `onClose` / `onCancel` Props はラッパー側から完全削除 ✓
- 呼び出し元で `onOpenChange={(open) => { if (!open) handleClose(); }}` ラップパターンを一貫適用 ✓
- 意味付き callback（`onConfirm` / `onSubmit` / `onSelect` / `onAdd` / `onSave` / `onLinked` 等）は維持 ✓
- **注記**: `QRCodeModal`（M6-02 由来、`features/config/`）は 17 件スコープ外のため `onClose` Props が残存しているが、これは正しいスコープ維持

### 7. モーダル実装パターン分裂解消の妥当性

**◎ 適合**

- `createPortal`（4 件: PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog）→ shadcn/ui 標準 portal で自動代替、コード完全削除 ✓
- fixed overlay div（6 件: AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / LinkExistingSetupModal / ModifiersEditor）→ 同上 ✓
- スコープ外の `QRCodeModal` は `createPortal` 残存（正しい温存）✓

### 8. `window.confirm` 除去の妥当性

**◎ 適合**

- SetupAccordionItem: `window.confirm` → shadcn/ui AlertDialog に置換 ✓
- PromoteToFinalButton: インラインダイアログが AlertDialog に置換 ✓
- ComboListPage / ComboDetailPage / MyComboPage の `window.confirm`（コンボ削除確認）はスコープ外で正しく温存 ✓

### 9. テスト要件の充足（§5）

**○ 良好**

- `utils.test.ts` 3 テスト — §4.1.4 のテストケースと完全一致 ✓
- `Header.test.tsx` 7 テスト — §4.2.5 の 6 観点 + α ✓
- 既存テスト修正: PermanentDeleteConfirm / KnockdownAdvantageChangeModal / ModifiersEditor / SetupAccordionItem 等で shadcn/ui DOM 構造対応済み ✓
- 全 387 件 PASS ✓
- `pnpm build` エラーなし ✓
- テスト件数: M6-04 時点 380 件 → 387 件（+7 件）。指示書見込み 390 件前後に対して若干少ないが、有意な差ではない

### 10. スコープ外への変更がないこと（§2.3、最重要）

**◎ 適合**

- 設計書本体（REQ-001 / DES-001〜006）変更なし ✓
- 補足資料（SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log）変更なし ✓
- CHANGE 通知書起票なし ✓
- Form / Toast / Button（shadcn/ui Button コンポーネントとしての利用） / Tooltip / Badge / Card / Table / List 系の shadcn/ui 化なし ✓
- 分離パターン逸脱解消なし（内部 `useMutation` / `useQuery` 維持）✓
- C-2 / C-3 / C-4 解消なし ✓
- Header 非表示 4 ページに Header 追加なし ✓
- バックエンド変更なし ✓

### 11. retrospective-log §1 構造的アンチパターンの再発なし

**◎ 適合**

- 実コード確認の省略 → §3.4 着手前確認を計画提示に含めた上で着手 ✓
- スコープ外作業 → §2.3 境界を厳守 ✓
- Props 命名揺れ → 一括是正完了 ✓

## 設計準拠性以外の指摘事項

### コーディング規約準拠

**指摘 C-1（低）**: `web/src/components/ui/command.tsx` は生成されているが一切使用されていない dead code。`cmdk` 依存も package.json に追加済み。M7-02 以降で使用予定がなければ削除を推奨。ただし M7-02 で TagSelector の `popover` + `command` 化が予定されている場合は温存可。

### セキュリティ

指摘なし。ブラウザストレージの不正使用なし。

### パフォーマンス

**指摘 P-1（低）**: ビルド成果物 `index-DOsb15dB.js` が 675.84 kB（gzip 202.25 kB）で Vite の 500 kB 警告が出ている。M7-01 で Radix UI / shadcn/ui 依存が大量追加されたことが原因の一つ。M7 完了後のフェーズ 2 でコード分割（dynamic import）検討を推奨。ただし現時点ではブロッカーではない。

## 推奨修正（優先度別）

- **高（M7 完了前に修正必須）**: なし

- **中（M8 着手と並行可）**:
  - **指摘 3-a**: `TagSelector` が `command` コンポーネントを使用していない件。M7-02 で TagSelector の分離パターン逸脱解消時に `popover` + `command`（combobox パターン）への移行を検討。対応決定前に、`cmdk` 依存と `command.tsx` の温存/削除を開発者確認

- **低（将来対応）**:
  - **指摘 C-1**: `command.tsx` dead code + `cmdk` dead dependency。M7-02 で使用予定があれば温存、なければ削除
  - **指摘 P-1**: ビルドサイズ 500 kB 超過。フェーズ 2 でコード分割検討

## 良かった点

1. **Props 命名是正の一貫性**: 全 17 件 + 呼び出し元で `open` / `onOpenChange` を一切の例外なく統一。呼び出し元の `onOpenChange={(open) => { if (!open) ... }}` パターンも完全に一貫しており、コードベース全体の可読性が大幅に向上した

2. **スコープ厳守**: 本プロジェクト最大規模の指示書でありながら、§2.3 のスコープ外項目に一切手を出していない。特に Modal 内の `<input>` / `<label>` を温存（Form 全体は M7-02）、分離パターン逸脱解消を温存（M7-02）、Header 非表示 4 ページを温存（案 A）という判断が正確

3. **`createPortal` / fixed overlay div の完全除去**: 10 件のモーダル実装パターン分裂が shadcn/ui の標準 portal で自動統一され、コードベースからは `createPortal` が対象範囲内で完全に消えている

4. **Header テストの充実**: `MemoryRouter` + `initialEntries` による pathname 注入テストパターンが簡潔で再利用性が高い

5. **SetupAccordionItem の `window.confirm` → AlertDialog 置換**: 確認ダイアログのテストケースも充実しており、`Accordion` ラッパー内でのレンダリングテストが正しく構成されている

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要
- ハンバーガーメニューの実機スマホ表示確認（640px 未満でのシート開閉動作）は本レビューでは未検証
- shadcn/ui コンポーネント（`web/src/components/ui/` 配下 13 件）は CLI 自動生成のため、内容の詳細レビューは省略
