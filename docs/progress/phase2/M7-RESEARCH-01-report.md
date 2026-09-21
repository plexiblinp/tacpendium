# M7-RESEARCH-01 調査結果レポート

| 項目 | 内容 |
|------|------|
| 文書ID | M7-RESEARCH-01-REPORT |
| 作成日 | 2026-05-26 |
| 作成者 | 製造担当 Claude Code（調査担当として運用、Opus 4.6） |
| 前提指示書 | M7-RESEARCH-01-shadcn-ui-implementation-check.md v1.0.0 |

---

## 結論サマリ（調査担当による事実集約、最初に読む）

- 項目 A（shadcn/ui 現状実装状態）: **未導入**。`clsx`（^2.1.1）と `lucide-react`（^0.460.0）のみインストール済み。`@radix-ui/*` / `class-variance-authority` / `tailwind-merge` は未導入。`components.json` / `web/src/components/ui/` / `cn()` 関数いずれも存在しない。`clsx` はインストール済みだがコード内で一切使用されていない。
- 項目 B（自作ラッパー UI コンポーネント）: **shadcn/ui 差し替え対象となりうるラッパー 26 件**発見（Modal/Dialog 系 10 件、Dropdown/Select 系 5 件、Tabs/Accordion 系 2 件、Form/Field 系 3 件、Badge/Display 系 2 件、Table/List 系 4 件）。呼び出し元ファイル 18 件（重複排除）。
- C-2 / C-3 / C-4 持ち越し関連: 該当コンポーネント全件特定済み。
- 想定外の発見: あり（特記事項参照 — `clsx` 未使用、モーダル実装パターンの分裂）。

---

## 4.1 shadcn/ui 関連の現状実装状態（項目 A）

### (a) web/package.json の shadcn/ui 関連依存

grep 結果（`grep -nE 'shadcn|@radix-ui|class-variance-authority|clsx|tailwind-merge' web/package.json`）:

```
16:    "clsx": "^2.1.1",
```

事実列挙:
- `clsx`: ^2.1.1（dependencies に存在）
- `lucide-react`: ^0.460.0（dependencies に存在、shadcn/ui が推奨するアイコンライブラリだが単体でも利用可能）
- `@radix-ui/*`: **存在しない**
- `class-variance-authority`: **存在しない**
- `tailwind-merge`: **存在しない**
- `shadcn` を名前に含むパッケージ: **存在しない**

### (b) web/components.json の有無

```bash
$ ls -la web/components.json 2>/dev/null
# 出力なし
```

ファイルは **存在しない**。

### (c) web/src/components/ui/ ディレクトリの有無

```bash
$ ls -la web/src/components/ui/ 2>/dev/null
# 出力なし
```

ディレクトリは **存在しない**。`web/src/components/` 配下には `Footer.tsx`（+ テスト）のみ。

### (d) tailwind.config.* の shadcn/ui 関連設定

`web/tailwind.config.js` が存在（全8行）:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- `darkMode` 設定: **なし**
- CSS 変数参照（`hsl(var(--background))` 等）: **なし**
- `theme.extend.colors` の拡張: **なし**（`extend: {}` が空）
- `plugins`: **なし**（空配列）

### (e) web/src/lib/utils.ts 等の shadcn/ui 慣例ユーティリティ

- `web/src/lib/utils.ts`: **存在しない**
- `web/src/lib/` 配下のファイル一覧: `api-client.ts` / `browser-storage.ts` / `configApi.ts` / `constants.ts` / `i18n.ts`（+ テストファイル）
- `cn()` 関数: プロジェクト全体で **存在しない**
- `clsx` の import: `grep -rn "clsx" web/src/` で **0 件**（インストール済みだが未使用）
- `class-variance-authority` / `tailwind-merge` の import: **0 件**

### (f) 総合判定

**未導入**。(a)〜(e) の事実から、shadcn/ui は完全に未導入の状態。`clsx` と `lucide-react` の 2 依存のみが shadcn/ui エコシステムと関連するが、`clsx` はコード内で未使用、`lucide-react` は独立したアイコンライブラリとして利用されている。shadcn/ui の初期化（`components.json`）、コンポーネントディレクトリ（`ui/`）、ユーティリティ（`cn()`）、Headless UI 基盤（`@radix-ui`）のいずれも存在しない。

---

## 4.2 自作ラッパー UI コンポーネントの全件特定（項目 B）

### (a) コンポーネント全件列挙

#### web/src/components/（共通）

```
web/src/components/Footer.tsx
```

#### web/src/features/combo/components/（30ファイル、テスト除く）

```
AddComboToCompareModal.tsx
ColumnVisibilityMenu.tsx
ComboDetailHeader.tsx
ComboDetailMetadata.tsx
ComboDetailRecipe.tsx
ComboEditor.tsx
ComboEditorBasicFields.tsx
ComboListFilters.tsx
ComboTable.tsx
ComboTableRow.tsx
CompareTable.tsx
CompareTargetList.tsx
DuplicateRealtimeWarning.tsx
DuplicateWarning.tsx
KnockdownAdvantageChangeModal.tsx
ModifiersEditor.tsx
PermanentDeleteConfirm.tsx
PresetSwitcher.tsx
PromoteToFinalButton.tsx
PutConfirmDialog.tsx
RecipeBuilder.tsx
SetupInputRow.tsx
SetupRegistrationSection.tsx
SetupSelectorModal.tsx
SetupTreeRow.tsx
StepRow.tsx
TrashBulkActions.tsx
TrashList.tsx
TrashListRow.tsx
ValidationDisplay.tsx
VirtualController/VirtualController.tsx
VirtualController/HitBoxLayout.tsx
VirtualController/controllerTypes.ts
VirtualController/useControllerInput.ts
```

#### web/src/features/mycombo/components/（5ファイル）

```
CharacterInfoBar.tsx
CharacterSelector.tsx
MyComboPage.tsx
MyComboStatusSelect.tsx
MyComboStatusTabs.tsx
```

#### web/src/features/setup/components/（5ファイル）

```
LinkExistingSetupModal.tsx
SetupAccordionItem.tsx
SetupBasicInfoForm.tsx
SetupCandidateList.tsx
SetupRecipeEditor.tsx
```

#### web/src/features/tag/components/（6ファイル）

```
TagBadgeList.tsx
TagDeleteConfirmDialog.tsx
TagFormDialog.tsx
TagListTable.tsx
TagManagementPage.tsx
TagSelector.tsx
```

#### web/src/pages/（ページコンポーネント、ラッパーではない）

```
ComboDetailPage.tsx
ComboEditorPage.tsx
ComboListPage.tsx
ComparePage.tsx
HomePage.tsx
SetupEditorPage.tsx
TrashPage.tsx
```

### (b) 自作ラッパー候補の判別 + Props 契約抽出

以下、shadcn/ui 差し替え対象となりうるコンポーネントを種別ごとに列挙する。ページコンポーネント（`*Page.tsx`）、純粋な表示コンポーネント（`ComboDetailHeader` / `ComboDetailMetadata` / `CompareTargetList` / `StepRow` / `SetupTreeRow` / `TrashListRow` / `ComboTableRow` 等）、複合エディタ（`ComboEditor` / `RecipeBuilder` / `SetupRecipeEditor` / `SetupRegistrationSection` / `SetupInputRow`）は shadcn/ui の単一コンポーネントに対応しないため、ラッパー候補からは除外し、ここでは列挙しない。

---

#### Modal / Dialog 系（10 件）

##### コンポーネント: PutConfirmDialog

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/PutConfirmDialog.tsx` |
| 種別 | Dialog（確認ダイアログ） |
| Props 型 | `interface Props { open: boolean; onCancel: () => void; onConfirm: () => void; }` |
| 必須 Props | `open`, `onCancel`, `onConfirm` |
| 任意 Props | なし |
| コールバック Props | `onCancel`, `onConfirm` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | **あり**（`document.body`） |
| 分離パターン | 表示専用 |

##### コンポーネント: PermanentDeleteConfirm

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/PermanentDeleteConfirm.tsx` |
| 種別 | Dialog（確認ダイアログ） |
| Props 型 | `interface Props { isOpen: boolean; count: number; onConfirm: () => void; onCancel: () => void; }` |
| 必須 Props | `isOpen`, `count`, `onConfirm`, `onCancel` |
| 任意 Props | なし |
| コールバック Props | `onConfirm`, `onCancel` |
| 内部状態 | `useEffect`（Escape キーハンドラ） |
| 副作用 | なし |
| createPortal | **あり**（`document.body`） |
| 分離パターン | 表示専用 |

##### コンポーネント: AddComboToCompareModal

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/AddComboToCompareModal.tsx` |
| 種別 | Modal（選択モーダル） |
| Props 型 | `interface Props { open: boolean; currentIds: number[]; onAdd: (id: number) => void; onClose: () => void; }` |
| 必須 Props | `open`, `currentIds`, `onAdd`, `onClose` |
| 任意 Props | なし |
| コールバック Props | `onAdd`, `onClose` |
| 内部状態 | なし（ステートレス） |
| 副作用 | `useQuery`（`useCombos`）— コンボ一覧取得 |
| createPortal | なし（fixed overlay div） |
| 分離パターン | ロジック含む（useQuery） |

##### コンポーネント: KnockdownAdvantageChangeModal

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx` |
| 種別 | Modal（確認 + 選択モーダル） |
| Props 型 | `interface Props { open: boolean; linkedSetups: SetupSummary[]; onConfirm: (options: SetupCarryOptionsInput) => void; onCancel: () => void; }` |
| 必須 Props | `open`, `linkedSetups`, `onConfirm`, `onCancel` |
| 任意 Props | なし |
| コールバック Props | `onConfirm`, `onCancel` |
| 内部状態 | `useState`×2（`mode`: carry_all/unlink_all/individual、`checkedIds`: Set） |
| 副作用 | なし |
| createPortal | なし（fixed overlay div） |
| 分離パターン | ロジック含む（内部状態で radio/checkbox 管理） |

##### コンポーネント: SetupSelectorModal

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/SetupSelectorModal.tsx` |
| 種別 | Modal（選択モーダル） |
| Props 型 | `interface Props { open: boolean; characterId: number; excludeSetupIds: number[]; onSelect: (setup: SetupResponse) => void; onClose: () => void; }` |
| 必須 Props | `open`, `characterId`, `excludeSetupIds`, `onSelect`, `onClose` |
| 任意 Props | なし |
| コールバック Props | `onSelect`, `onClose` |
| 内部状態 | なし（ステートレス） |
| 副作用 | `useQuery`（`useCharacterSetups`）— セットプレイ一覧取得 |
| createPortal | なし（fixed overlay div） |
| 分離パターン | ロジック含む（useQuery） |

##### コンポーネント: DuplicateWarning

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/DuplicateWarning.tsx` |
| 種別 | Dialog（警告ダイアログ） |
| Props 型 | `interface Props { issue: ValidationIssue; onClose: () => void; }` |
| 必須 Props | `issue`, `onClose` |
| 任意 Props | なし |
| コールバック Props | `onClose` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし（fixed overlay div） |
| 分離パターン | 表示専用 |

##### コンポーネント: TagFormDialog

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/tag/components/TagFormDialog.tsx` |
| 種別 | Dialog（フォームダイアログ） |
| Props 型 | `interface Props { open: boolean; tag?: Tag \| null; onClose: () => void; onSubmit: (values: FormValues) => Promise<void>; }` |
| 必須 Props | `open`, `onClose`, `onSubmit` |
| 任意 Props | `tag?`（編集時に既存値を渡す） |
| コールバック Props | `onClose`, `onSubmit` |
| 内部状態 | `useState`×5（`name`, `category`, `color`, `errors`, `serverError`, `submitting`）、`useEffect`×1（open 時の初期値セット） |
| 副作用 | なし（`onSubmit` は親から渡される async 関数） |
| createPortal | **あり**（`document.body`） |
| 分離パターン | ロジック含む（Zod バリデーション + フォーム状態管理） |

##### コンポーネント: TagDeleteConfirmDialog

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/tag/components/TagDeleteConfirmDialog.tsx` |
| 種別 | Dialog（確認ダイアログ） |
| Props 型 | `interface Props { open: boolean; tag: Tag \| null; onCancel: () => void; onConfirm: () => void; isDeleting?: boolean; }` |
| 必須 Props | `open`, `tag`, `onCancel`, `onConfirm` |
| 任意 Props | `isDeleting?`（デフォルト false） |
| コールバック Props | `onCancel`, `onConfirm` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | **あり**（`document.body`） |
| 分離パターン | 表示専用 |

##### コンポーネント: LinkExistingSetupModal

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/setup/components/LinkExistingSetupModal.tsx` |
| 種別 | Modal（選択 + 紐付けモーダル） |
| Props 型 | `interface Props { open: boolean; parentComboId: number; characterId: number; onClose: () => void; onLinked?: () => void; }` |
| 必須 Props | `open`, `parentComboId`, `characterId`, `onClose` |
| 任意 Props | `onLinked?` |
| コールバック Props | `onClose`, `onLinked` |
| 内部状態 | なし（ステートレス） |
| 副作用 | `useQuery`（`useCharacterSetups`）+ `useMutation`（`useCreateSetupLink`）— 内部で直接 mutate 実行 |
| createPortal | なし（fixed overlay div） |
| 分離パターン | ロジック含む（useQuery + useMutation） |

##### コンポーネント: ModifiersEditor

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ModifiersEditor.tsx` |
| 種別 | Dialog（フォームダイアログ） |
| Props 型 | `interface Props { step: Step; stepIndex: number; movesById: Map<number, Move>; onSave: (stepIndex: number, newModifiers: Modifiers \| undefined) => void; onClose: () => void; }` |
| 必須 Props | `step`, `stepIndex`, `movesById`, `onSave`, `onClose` |
| 任意 Props | なし |
| コールバック Props | `onSave`, `onClose` |
| 内部状態 | `useState`×3（`localFlags`, `localType`, `localNotes`）、`useEffect`×1（notes 文字数警告） |
| 副作用 | なし |
| createPortal | なし（fixed overlay div） |
| 分離パターン | ロジック含む（内部状態 + フォーム管理） |

---

#### Dropdown / Select 系（5 件）

##### コンポーネント: ColumnVisibilityMenu

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ColumnVisibilityMenu.tsx` |
| 種別 | Dropdown（カスタムドロップダウンメニュー） |
| Props 型 | `interface ColumnVisibilityMenuProps { visibility: ColumnVisibility; onChange: (next: ColumnVisibility) => void; onReset: () => void; }` |
| 必須 Props | `visibility`, `onChange`, `onReset` |
| 任意 Props | なし |
| コールバック Props | `onChange`, `onReset` |
| 内部状態 | `useState`（open）、`useRef`（containerRef）、`useEffect`（click-outside 検出） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | ロジック含む（open/close + click-outside） |

##### コンポーネント: TagSelector

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/tag/components/TagSelector.tsx` |
| 種別 | Select（カスタムセレクト + インライン新規作成） |
| Props 型 | `interface TagSelectorProps { selectedTagIds: number[]; onChange: (tagIds: number[]) => void; excludeCategories?: string[]; disabled?: boolean; }` |
| 必須 Props | `selectedTagIds`, `onChange` |
| 任意 Props | `excludeCategories?`, `disabled?` |
| コールバック Props | `onChange` |
| 内部状態 | `useState`×3（`open`, `search`, `creating`）、`useRef`（containerRef）、`useEffect`（click-outside 検出） |
| 副作用 | `useQuery`（`useTagsForSelector`）+ `useMutation`（`useTagManagement().createMutation`）— インラインタグ新規作成 |
| createPortal | なし |
| 分離パターン | ロジック含む（useQuery + useMutation + 検索 + click-outside） |

##### コンポーネント: PresetSwitcher

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/PresetSwitcher.tsx` |
| 種別 | Select（ネイティブ `<select>` ラッパー） |
| Props 型 | `interface PresetSwitcherProps { presets: Preset[]; selectedId: number \| undefined; onChange: (presetId: number) => void; disabled?: boolean; }` |
| 必須 Props | `presets`, `selectedId`, `onChange` |
| 任意 Props | `disabled?` |
| コールバック Props | `onChange` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

##### コンポーネント: CharacterSelector

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/mycombo/components/CharacterSelector.tsx` |
| 種別 | Select（ネイティブ `<select>` ラッパー） |
| Props 型 | `interface CharacterSelectorProps { selectedCharacterId: number; onChange: (characterId: number) => void; }` |
| 必須 Props | `selectedCharacterId`, `onChange` |
| 任意 Props | なし |
| コールバック Props | `onChange` |
| 内部状態 | なし（ステートレス） |
| 副作用 | `useQuery`（`useCharacters`）— キャラクター一覧取得 |
| createPortal | なし |
| 分離パターン | ロジック含む（useQuery） |

##### コンポーネント: MyComboStatusSelect

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/mycombo/components/MyComboStatusSelect.tsx` |
| 種別 | Select（ネイティブ `<select>` ラッパー） |
| Props 型 | `interface MyComboStatusSelectProps { currentStatus: MyComboStatus \| ""; onChange: (newStatus: MyComboStatus \| "") => void; disabled?: boolean; isLoading?: boolean; }` |
| 必須 Props | `currentStatus`, `onChange` |
| 任意 Props | `disabled?`, `isLoading?` |
| コールバック Props | `onChange` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

---

#### Tabs / Accordion 系（2 件）

##### コンポーネント: MyComboStatusTabs

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/mycombo/components/MyComboStatusTabs.tsx` |
| 種別 | Tabs（ボタンベースタブ） |
| Props 型 | `interface MyComboStatusTabsProps { selected: MyComboStatus; onSelect: (status: MyComboStatus) => void; counts: MyComboStatusCounts; }` |
| 必須 Props | `selected`, `onSelect`, `counts` |
| 任意 Props | なし |
| コールバック Props | `onSelect` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

##### コンポーネント: SetupAccordionItem

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/setup/components/SetupAccordionItem.tsx` |
| 種別 | Accordion（手動アコーディオン、`role="button"` + expand/collapse） |
| Props 型 | `interface Props { setup: SetupSummary; parentComboId: number; onUnlink?: () => void; onEdit?: () => void; }` |
| 必須 Props | `setup`, `parentComboId` |
| 任意 Props | `onUnlink?`, `onEdit?` |
| コールバック Props | `onUnlink`, `onEdit` |
| 内部状態 | `useState`（open） |
| 副作用 | `useMutation`（`useDeleteSetupLink`）— 紐付け解除 |
| createPortal | なし |
| 分離パターン | ロジック含む（useMutation） |

---

#### Form / Field 系（3 件）

##### コンポーネント: ComboEditorBasicFields

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ComboEditorBasicFields.tsx` |
| 種別 | Form（フォームフィールド群） |
| Props 型 | `interface Props { value: BasicFieldsValue; moves: Move[]; movesLoading: boolean; autoStarterMoveId: number \| null; onChange: (next: BasicFieldsValue) => void; }` |
| 必須 Props | `value`, `moves`, `movesLoading`, `autoStarterMoveId`, `onChange` |
| 任意 Props | なし |
| コールバック Props | `onChange` |
| 内部状態 | `useMemo`（フィールド計算） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用（制御コンポーネントとして親が状態管理） |

##### コンポーネント: SetupBasicInfoForm

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/setup/components/SetupBasicInfoForm.tsx` |
| 種別 | Form（フォームフィールド群） |
| Props 型 | `interface Props { characterId: number; name: string \| null; description: string \| null; onChange: (changes: Partial<{ name: string \| null; description: string \| null }>) => void; }` |
| 必須 Props | `characterId`, `name`, `description`, `onChange` |
| 任意 Props | なし |
| コールバック Props | `onChange` |
| 内部状態 | なし |
| 副作用 | `useQuery`（キャラ名取得） |
| createPortal | なし |
| 分離パターン | ロジック含む（useQuery） |

##### コンポーネント: ComboListFilters

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ComboListFilters.tsx` |
| 種別 | Form（フィルタフォーム群） |
| Props 型 | `interface ComboListFiltersProps { filters: ComboListFiltersState; onFilterChange: (next: ComboListFiltersState) => void; availableTags: Tag[]; visibility: ColumnVisibility; onVisibilityChange: (next: ColumnVisibility) => void; onVisibilityReset: () => void; }` |
| 必須 Props | `filters`, `onFilterChange`, `availableTags`, `visibility`, `onVisibilityChange`, `onVisibilityReset` |
| 任意 Props | なし |
| コールバック Props | `onFilterChange`, `onVisibilityChange`, `onVisibilityReset` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用（複数ネイティブ select 要素を集約） |

---

#### Badge / Display 系（2 件）

##### コンポーネント: TagBadgeList

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/tag/components/TagBadgeList.tsx` |
| 種別 | Badge（インラインバッジリスト） |
| Props 型 | `interface TagBadgeListProps { tags: Tag[]; excludeCategories?: string[]; maxVisible?: number; size?: "sm" \| "md"; }` |
| 必須 Props | `tags` |
| 任意 Props | `excludeCategories?`, `maxVisible?`, `size?` |
| コールバック Props | なし |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

##### コンポーネント: ValidationDisplay

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ValidationDisplay.tsx` |
| 種別 | Display（バリデーション結果表示） |
| Props 型 | `interface Props { result?: ValidationResult \| null; }` |
| 必須 Props | なし |
| 任意 Props | `result?` |
| コールバック Props | なし |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

---

#### Table / List 系（4 件）

##### コンポーネント: ComboTable

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/ComboTable.tsx` |
| 種別 | Table（展開可能行 + チェックボックス付きテーブル） |
| Props 型 | `interface ComboTableProps { combos: ComboSummary[]; onDelete: (id: number) => void; visibility: ColumnVisibility; onStatusChange?: ...; statusChangingId?: number; hasActiveFilters?: boolean; onClearFilters?: () => void; emptyMessage?: string; isSelectMode?: boolean; selectedIds?: number[]; onToggleSelect?: (id: number) => void; isSelectionAtMax?: boolean; }` |
| 必須 Props | `combos`, `onDelete`, `visibility` |
| 任意 Props | `onStatusChange?`, `statusChangingId?`, `hasActiveFilters?`, `onClearFilters?`, `emptyMessage?`, `isSelectMode?`, `selectedIds?`, `onToggleSelect?`, `isSelectionAtMax?` |
| コールバック Props | `onDelete`, `onStatusChange`, `onClearFilters`, `onToggleSelect` |
| 内部状態 | `useState`（expandedId） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用（状態は expandedId のみ） |

##### コンポーネント: CompareTable

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/CompareTable.tsx` |
| 種別 | Table（比較用テーブル） |
| Props 型 | `interface CompareTableProps { combos: (ComboDetail \| undefined)[]; errors: (Error \| null)[]; loadings: boolean[]; ids: number[]; onRemove: (id: number) => void; }` |
| 必須 Props | `combos`, `errors`, `loadings`, `ids`, `onRemove` |
| 任意 Props | なし |
| コールバック Props | `onRemove` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

##### コンポーネント: TrashList

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/combo/components/TrashList.tsx` |
| 種別 | Table（全選択チェックボックス付きテーブル） |
| Props 型 | `interface Props { combos: ComboSummary[]; selectedIds: number[]; onSelectionChange: (ids: number[]) => void; onComboChanged: () => void; }` |
| 必須 Props | `combos`, `selectedIds`, `onSelectionChange`, `onComboChanged` |
| 任意 Props | なし |
| コールバック Props | `onSelectionChange`, `onComboChanged` |
| 内部状態 | `useState`（indeterminate 制御） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

##### コンポーネント: TagListTable

| 項目 | 内容 |
|------|------|
| ファイルパス | `web/src/features/tag/components/TagListTable.tsx` |
| 種別 | Table（インライン編集/削除ボタン付きテーブル） |
| Props 型 | `interface Props { tags: Tag[]; onEdit: (tag: Tag) => void; onDelete: (tag: Tag) => void; }` |
| 必須 Props | `tags`, `onEdit`, `onDelete` |
| 任意 Props | なし |
| コールバック Props | `onEdit`, `onDelete` |
| 内部状態 | なし（ステートレス） |
| 副作用 | なし |
| createPortal | なし |
| 分離パターン | 表示専用 |

---

### (c) 各自作ラッパーの呼び出し元ファイル一覧

#### Modal / Dialog 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| PutConfirmDialog | 1 | `ComboEditor.tsx:432` |
| PermanentDeleteConfirm | 2 | `TrashListRow.tsx:136`, `TrashBulkActions.tsx:91` |
| AddComboToCompareModal | 1 | `pages/ComparePage.tsx:196` |
| KnockdownAdvantageChangeModal | 1 | `ComboEditor.tsx:425` |
| SetupSelectorModal | 1 | `SetupRegistrationSection.tsx:131` |
| DuplicateWarning | 2 | `ComboEditor.tsx:439`, `PromoteToFinalButton.tsx:120` |
| TagFormDialog | 1 | `TagManagementPage.tsx:91` |
| TagDeleteConfirmDialog | 1 | `TagManagementPage.tsx:98` |
| LinkExistingSetupModal | 2 | `pages/ComboEditorPage.tsx:88`, `pages/ComboDetailPage.tsx:183` |
| ModifiersEditor | 2 | `RecipeBuilder.tsx:272`, `SetupRecipeEditor.tsx:286` |

#### Dropdown / Select 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| ColumnVisibilityMenu | 2 | `MyComboPage.tsx:309`, `ComboListFilters.tsx:238` |
| TagSelector | 1 | `ComboEditorBasicFields.tsx:276` |
| PresetSwitcher | 3 | `ComboDetailRecipe.tsx:44`, `features/config/SettingsSectionBasic.tsx:69`, `features/wizard/Step04Preset.tsx:22` |
| CharacterSelector | 3 | `MyComboPage.tsx:206`, `features/config/SettingsSectionBasic.tsx:62`, `features/wizard/Step03Character.tsx:21` |
| MyComboStatusSelect | 2 | `ComboEditorBasicFields.tsx:266`, `ComboTableRow.tsx:195` |

#### Tabs / Accordion 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| MyComboStatusTabs | 1 | `MyComboPage.tsx:262` |
| SetupAccordionItem | 1 | `pages/ComboDetailPage.tsx:157` |

#### Form / Field 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| ComboEditorBasicFields | 1 | `ComboEditor.tsx`（内部から呼出） |
| SetupBasicInfoForm | 1 | `pages/SetupEditorPage.tsx:137` |
| ComboListFilters | 1 | `pages/ComboListPage.tsx:34` |

#### Badge / Display 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| TagBadgeList | 3 | `ComboTableRow.tsx:107`, `ComboDetailMetadata.tsx:130`, `TagSelector.tsx:98` |
| ValidationDisplay | 1 | `ComboEditor.tsx:398,462`（同一ファイル内 2 箇所） |

#### Table / List 系

| コンポーネント | 呼び出し元件数 | 呼び出し元ファイル |
|---|---|---|
| ComboTable | 2 | `pages/ComboListPage.tsx:16`, `MyComboPage.tsx:29` |
| CompareTable | 1 | `pages/ComparePage.tsx:176` |
| TrashList | 1 | `pages/TrashPage.tsx:5` |
| TagListTable | 1 | `TagManagementPage.tsx:84` |

### (d) shadcn/ui 公式提供コンポーネントとの対応関係

| 自作ラッパー名 | shadcn/ui 対応コンポーネント名 |
|---|---|
| PutConfirmDialog | `alert-dialog` |
| PermanentDeleteConfirm | `alert-dialog` |
| AddComboToCompareModal | `dialog` |
| KnockdownAdvantageChangeModal | `dialog` + `radio-group` + `checkbox` |
| SetupSelectorModal | `dialog` |
| DuplicateWarning | `alert-dialog` |
| TagFormDialog | `dialog` + `form` + `input` + `label` |
| TagDeleteConfirmDialog | `alert-dialog` |
| LinkExistingSetupModal | `dialog` |
| ModifiersEditor | `dialog` + `checkbox` + `radio-group` + `textarea` |
| ColumnVisibilityMenu | `dropdown-menu` + `checkbox` |
| TagSelector | `popover` + `command`（検索付きセレクト） |
| PresetSwitcher | `select` |
| CharacterSelector | `select` |
| MyComboStatusSelect | `select` |
| MyComboStatusTabs | `tabs` |
| SetupAccordionItem | `accordion` + `collapsible` |
| ComboEditorBasicFields | `form` + `input` + `select` + `label` |
| SetupBasicInfoForm | `form` + `input` + `textarea` + `label` |
| ComboListFilters | `select`（複数） |
| TagBadgeList | `badge` |
| ValidationDisplay | 公式提供なし（`alert` が類似するが構造が異なる） |
| ComboTable | `table` |
| CompareTable | `table` |
| TrashList | `table` + `checkbox` |
| TagListTable | `table` + `button` |

### (e) 総合事実列挙

- 発見された自作ラッパーの総数: **26 件**
- 種別別カウント: Modal/Dialog 系 10 件 / Dropdown/Select 系 5 件 / Tabs/Accordion 系 2 件 / Form/Field 系 3 件 / Badge/Display 系 2 件 / Table/List 系 4 件
- 呼び出し元ファイル総数（重複排除）: **18 件**（pages 7 + features 内コンポーネント 11）
- createPortal 使用コンポーネント: 4 件（PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog）
- fixed overlay div 使用コンポーネント: 6 件（AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / LinkExistingSetupModal / ModifiersEditor）
- PromoteToFinalButton 内にインライン確認ダイアログが埋め込まれている（独立コンポーネントではないが Dialog パターンを含む）

---

## 4.3 既存パターン参照

### (a) architecture-patterns §1 プレゼンテーション層/ロジック層分離パターンの実態

architecture-patterns.md §1 で規定されたパターン（M3-04 v1.0.5 で確立）:

- **表示専用コンポーネント**: Props のみ、副作用なし
- **ロジックフック**: API 呼出、キャッシュ管理、状態管理
- **統合はページが担当**: ページが表示 + ロジックを結合

26 件の自作ラッパーの分類:

| パターン | 件数 | 代表例 |
|---|---|---|
| 表示専用（Props のみ、副作用なし） | 14 | PutConfirmDialog, DuplicateWarning, TagDeleteConfirmDialog, MyComboStatusTabs, TagBadgeList, ValidationDisplay, PresetSwitcher, MyComboStatusSelect, ComboEditorBasicFields, ComboListFilters, CompareTable, TagListTable 等 |
| ロジック含む（useQuery / useMutation / 内部状態） | 12 | AddComboToCompareModal, KnockdownAdvantageChangeModal, TagFormDialog, LinkExistingSetupModal, ModifiersEditor, ColumnVisibilityMenu, TagSelector, CharacterSelector, SetupAccordionItem 等 |

ロジック含むコンポーネントのうち、architecture-patterns §1 の「ロジックフックに分離」パターンに従っていないもの:

- **LinkExistingSetupModal**: 内部で `useMutation`（`useCreateSetupLink`）を直接呼出。ロジックフックに分離されていない。
- **SetupAccordionItem**: 内部で `useMutation`（`useDeleteSetupLink`）を直接呼出 + `window.confirm` を使用。
- **TagSelector**: 内部で `useMutation`（`useTagManagement().createMutation`）を直接呼出。インラインタグ新規作成ロジックがコンポーネント内に存在。
- **TagFormDialog**: Zod バリデーション + 5 つの `useState` + エラーハンドリングがコンポーネント内に存在。

### (b) C-2 / C-3 / C-4 持ち越し関連コンポーネントの特定

#### C-2 関連: VirtualController + SetupRecipeEditor

**VirtualController**（`web/src/features/combo/components/VirtualController/VirtualController.tsx`）:

Props: `{ characterId: number; moves: Move[]; onStepAdd: (step: StepInput) => void; onStepDelete: () => void; }`

呼び出し元:
- `RecipeBuilder.tsx:128` — コンボレシピ編集で使用
- `SetupRecipeEditor.tsx:140` — セットプレイレシピ編集で使用

VirtualController は presentation-only。ステップ変換ロジック（`StepInput` → `Step` / `SetupStepInput`）は各呼び出し元のハンドラに分散。

**SetupRecipeEditor**（`web/src/features/setup/components/SetupRecipeEditor.tsx`）:

Props: `{ characterId: number; steps: SetupStepInput[]; onChange: (newSteps: SetupStepInput[]) => void; }`

呼び出し元:
- `pages/SetupEditorPage.tsx:146` — セットプレイ編集画面
- `SetupInputRow.tsx:74` — コンボ新規作成時のインラインセットプレイ入力

内部で VirtualController + ModifiersEditor を統合。`useState`×4、`useMemo`、`useEffect`、`useQuery`（技一覧取得）を使用。

#### C-3 関連: LinkExistingSetupModal + SetupSelectorModal

**LinkExistingSetupModal**（`web/src/features/setup/components/LinkExistingSetupModal.tsx`）:

Props: `{ open: boolean; parentComboId: number; characterId: number; onClose: () => void; onLinked?: () => void; }`

呼び出し元:
- `pages/ComboDetailPage.tsx:183` — コンボ詳細画面から既存セットプレイ紐付け
- `pages/ComboEditorPage.tsx:88` — コンボ編集画面から既存セットプレイ紐付け

内部で `useCharacterSetups`（useQuery）+ `useCreateSetupLink`（useMutation）を直接呼出。mutation の onSuccess で `onLinked?.()` + `onClose()` を実行。

**SetupSelectorModal**（`web/src/features/combo/components/SetupSelectorModal.tsx`）:

Props: `{ open: boolean; characterId: number; excludeSetupIds: number[]; onSelect: (setup: SetupResponse) => void; onClose: () => void; }`

呼び出し元:
- `SetupRegistrationSection.tsx:131` — コンボ新規作成時のセットプレイ選択

内部で `useCharacterSetups`（useQuery）を呼出。mutation は持たず、`onSelect` callback で呼び出し元に委譲。

両モーダルの差異:
- LinkExistingSetupModal: 紐付け mutation を **内部で完結**（クリック → mutate → onSuccess → close）
- SetupSelectorModal: 選択を **callback 委譲**（クリック → onSelect(setup) → 呼び出し元が後続処理）

#### C-4 関連: setup.defaultRecipe の条件描画パターン

`defaultRecipe` は型定義上 `string`（never optional）。空文字列 `""` が初期値。

描画箇所一覧（15 件）:

| ファイル | 行 | パターン |
|---|---|---|
| `SetupRegistrationSection.tsx` | 96-98 | `{setup.defaultRecipe && (<span>...)}` |
| `SetupCandidateList.tsx` | 51-53 | `{setup.defaultRecipe && (<span>...)}` |
| `SetupAccordionItem.tsx` | 75 | `{setup.defaultRecipe \|\| "（レシピなし）"}` |
| `LinkExistingSetupModal.tsx` | 86 | `{setup.defaultRecipe}`（条件なし直接表示） |
| `SetupSelectorModal.tsx` | 78 | `{setup.defaultRecipe}`（条件なし直接表示） |
| `AddComboToCompareModal.tsx` | 96, 98 | `title={combo.defaultRecipe}` + `{combo.defaultRecipe \|\| "-"}` |
| `ComboTableRow.tsx` | 52 | `combo.defaultRecipe \|\| "-"` |
| `CompareTable.tsx` | 122, 194-195 | `getSetupDisplayName(...)` + `{c.defaultRecipe \|\| "-"}` |
| `HomePage.tsx` | 92 | `{combo.defaultRecipe \|\| combo.starterMoveCode}` |

条件描画パターンは 3 種類に分裂:
1. `{value && (<element>)}` — 空文字列で非表示（2 箇所）
2. `{value || "フォールバック"}` — 空文字列にフォールバック表示（5 箇所）
3. `{value}` — 条件なし直接表示（2 箇所、空文字列はそのまま空表示）

---

## 4.4 関連設計書記述と実装の乖離

### (a) 発見した乖離

1. **DES-001 §2（01-tech-stack.md 42, 82, 122 行目）**: 全 3 候補スタックで `shadcn/ui + Tailwind CSS` を UI ライブラリとして記載 → 実装は shadcn/ui **未導入**、Tailwind CSS のみで運用。
2. **DES-002 §5.3（02-architecture.md 267 行目）**: 「Tailwind CSS + shadcn/ui」をスタイリング層として記載 → 同上。
3. **CLAUDE.md §2**: 「Tailwind CSS + shadcn/ui（スタイリング）」を技術スタックとして記載 → 同上。

上記 3 件は、playbook §17.2 / handover で「M7 まで未導入」と明示されている既知の状態であり、設計書本体側の記述が「採用予定を含む技術スタック一覧」として書かれているものと解される。ただし、設計書本体の文面自体には「M7 で導入予定」等の時期に関する注記はない。

### (b) なければ

上記 3 件以外に、調査範囲内で設計書記述と実装の乖離は発見されなかった。

---

## 特記事項

1. **`clsx` がインストール済みだが未使用**: `web/package.json` の dependencies に `clsx` ^2.1.1 が登録されているが、`grep -rn "clsx" web/src/` で 0 件。コード内で一切 import / 使用されていない。M7 の shadcn/ui 導入で `cn()` 関数（`clsx` + `tailwind-merge`）を構成する際に活用される可能性があるが、現時点では dead dependency の状態。
2. **モーダル実装パターンの分裂**: Modal/Dialog 系 10 件のうち、`createPortal`（`document.body`）を使用するものが 4 件（PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog）、fixed overlay div（`createPortal` なし）が 6 件。`createPortal` 使用は M2-04 で確立されたパターンだが、M4 / M5 で追加されたモーダルは fixed overlay div を採用しており、2 パターンが混在している。
3. **PromoteToFinalButton のインラインダイアログ**: `PromoteToFinalButton.tsx` 内に確認ダイアログが直接埋め込まれている（独立コンポーネントではない）。shadcn/ui 移行時に、このインラインダイアログ部分も `alert-dialog` 化の対象となる可能性がある。
4. **Props 命名の揺れ**: open/close 系 Props で `open` / `isOpen` の命名揺れが存在する。PutConfirmDialog / AddComboToCompareModal / KnockdownAdvantageChangeModal 等は `open`、PermanentDeleteConfirm は `isOpen`。同様に、閉じるコールバックは `onClose` / `onCancel` が混在している。
5. **`window.confirm` の使用**: `SetupAccordionItem.tsx:29` で `window.confirm()` がネイティブ確認ダイアログとして使用されている。他のコンポーネントはカスタムダイアログを使用しているため、ここだけネイティブ API を使用している。
6. **`console.warn` の残存**: `ModifiersEditor.tsx:31` に `console.warn` が残存している（notes 文字数超過時の警告）。既知課題 P-01 として記録済み。
7. **architecture-patterns §1 分離パターンからの逸脱**: LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog が、ロジック（useMutation / 内部バリデーション）をコンポーネント内に直接保持しており、「ロジックフックに分離」パターンに従っていない。

---

## 調査担当からの完了宣言

調査内容（§4.1 / §4.2 / §4.3 / §4.4）について、本指示書 §0.2 read-only 厳守 + §0.3 判断・提案を含めない運用に従って事実列挙を完了した。本調査結果を設計担当が受け取り、M7-01 / M7-02 の指示書スコープ確定に活用する想定。

調査担当のセッションはこの完了報告の出力をもって閉じる（製造作業は行わない）。
