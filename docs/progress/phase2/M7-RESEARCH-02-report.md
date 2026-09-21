# M7-RESEARCH-02 調査結果レポート

| 項目 | 内容 |
|------|------|
| 文書ID | M7-RESEARCH-02-REPORT |
| 作成日 | 2026-05-27 |
| 作成者 | 製造担当 Claude Code（調査担当として運用、Opus 4.6） |
| 前提指示書 | M7-RESEARCH-02-responsive-variability-check.md v1.0.0 |

---

## 結論サマリ（調査担当による事実集約、最初に読む）

- **項目 A（Tailwind ブレークポイント全画面集計）**: プロジェクト全体で Tailwind ブレークポイントを使用しているファイルは **5 ファイルのみ**（合計 7 箇所）。11 画面のページコンポーネント本体は **全画面 0 件**。ブレークポイント使用は App.tsx（1 件 `sm:`）、Footer.tsx（1 件 `sm:`）、ComboDetailHeader.tsx（1 件 `md:`）、ComboDetailMetadata.tsx（2 件 `md:`）、ComboListFilters.tsx（2 件 `md:`）に限定。`lg:` / `xl:` / `2xl:` は **プロジェクト全体で使用ゼロ**。
- **項目 B（DES-005 §4.4 規定との整合性）**: DES-005 §4.4 規定と Tailwind デフォルト値は **概ね整合するが、タブレット範囲の定義に差異あり**（DES-005: `641px〜1024px` = `md` + `lg` / Tailwind デフォルト: `md = 768px` で DES-005 の `641px` と不一致）。`tailwind.config.js` はデフォルト設定のまま（`theme.screens` のカスタマイズなし）。
- **項目 C（スマホ表示崩れ可能性）**: 固定幅パターン 3 件（`max-w-[200px]` × 2、`min-w-[160px]` × 1）、テーブル系 4 件（ComboTable / CompareTable / TrashList / TagListTable いずれも `min-w-full` のテーブルに `overflow-x-auto` でスクロール対応のみ、列非表示等のスマホ最適化なし）。Header のインライン実装がスマホ対応なし（ハンバーガーメニュー化の実装なし）。
- **R-2 / R-3 状況**: シミー DR 有データは **ComboDetailMetadata と CompareTable で表示あり**、ComboTable（一覧）では **表示なし**（起き攻め関連列自体が一覧テーブルにない）。キャラクターフィルタ UI は AddComboToCompareModal に **なし**（`INITIAL_CHARACTER_ID` 固定でクエリ）。
- **想定外の発見**: あり（特記事項参照）

---

## 4.1 Tailwind ブレークポイントの全画面集計（項目 A）

### (a) 各画面ファイルのブレークポイント使用箇所カウント

#### ページコンポーネント本体（11 画面）

| # | 画面名 | ファイルパス | `sm:` | `md:` | `lg:` | `xl:` | `2xl:` | 合計 |
|---|--------|-------------|-------|-------|-------|-------|--------|------|
| 1 | コンボ一覧 | `web/src/pages/ComboListPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | マイコンボ | `web/src/pages/MyComboPageRoute.tsx` → `web/src/features/mycombo/components/MyComboPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | コンボ詳細 | `web/src/pages/ComboDetailPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | コンボ登録・編集 | `web/src/pages/ComboEditorPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | コンボ比較 | `web/src/pages/ComparePage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 6 | セットプレイ登録・編集 | `web/src/pages/SetupEditorPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 7 | タグ管理 | `web/src/pages/TagManagementPageRoute.tsx` → `web/src/features/tag/components/TagManagementPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 8 | ゴミ箱 | `web/src/pages/TrashPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 9 | 設定 | `web/src/pages/SettingsPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 10 | 初回起動ウィザード | `web/src/pages/WizardPage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| 11 | ホーム（スマホ専用） | `web/src/pages/HomePage.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |

#### 主要 features コンポーネント

| コンポーネント | ファイルパス | `sm:` | `md:` | `lg:` | `xl:` | `2xl:` | 合計 |
|---------------|-------------|-------|-------|-------|-------|--------|------|
| ComboTable | `web/src/features/combo/components/ComboTable.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| ComboTableRow | `web/src/features/combo/components/ComboTableRow.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| CompareTable | `web/src/features/combo/components/CompareTable.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| TrashList | `web/src/features/combo/components/TrashList.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| TagListTable | `web/src/features/tag/components/TagListTable.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| ComboEditor | `web/src/features/combo/components/ComboEditor.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| ComboEditorBasicFields | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| SetupRecipeEditor | `web/src/features/setup/components/SetupRecipeEditor.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| CompareTargetList | `web/src/features/combo/components/CompareTargetList.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| ComboListFilters | `web/src/features/combo/components/ComboListFilters.tsx` | 0 | **2** | 0 | 0 | 0 | **2** |
| ComboDetailHeader | `web/src/features/combo/components/ComboDetailHeader.tsx` | 0 | **1** | 0 | 0 | 0 | **1** |
| ComboDetailMetadata | `web/src/features/combo/components/ComboDetailMetadata.tsx` | 0 | **2** | 0 | 0 | 0 | **2** |
| ColumnVisibilityMenu | `web/src/features/combo/components/ColumnVisibilityMenu.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| MyComboStatusTabs | `web/src/features/mycombo/components/MyComboStatusTabs.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| AddComboToCompareModal | `web/src/features/combo/components/AddComboToCompareModal.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |
| QRCodeModal | `web/src/features/config/QRCodeModal.tsx` | 0 | 0 | 0 | 0 | 0 | 0 |

#### 共通 UI・ルートレイアウト

| コンポーネント | ファイルパス | `sm:` | `md:` | `lg:` | `xl:` | `2xl:` | 合計 |
|---------------|-------------|-------|-------|-------|-------|--------|------|
| App | `web/src/App.tsx` | **1** | 0 | 0 | 0 | 0 | **1** |
| Footer | `web/src/components/Footer.tsx` | **1** | 0 | 0 | 0 | 0 | **1** |

#### ブレークポイント使用の詳細（全 7 箇所）

| # | ファイル | 行 | 使用クラス | 用途（推測） |
|---|---------|-----|-----------|------------|
| 1 | `App.tsx` | 34 | `sm:pb-0` | Footer 表示時の下部パディング（スマホのみ Footer が出るため sm 以上では 0） |
| 2 | `Footer.tsx` | 25 | `sm:hidden` | Footer をスマホのみ表示（sm 以上では非表示） |
| 3 | `ComboDetailHeader.tsx` | 53 | `md:grid-cols-4` | メタデータグリッドを md 以上で 4 列化（md 未満は 2 列） |
| 4 | `ComboDetailMetadata.tsx` | 37 | `md:grid-cols-4` | 起き攻めメタデータグリッドを md 以上で 4 列化 |
| 5 | `ComboDetailMetadata.tsx` | 75 | `md:grid-cols-2` | 追加メタデータグリッドを md 以上で 2 列化 |
| 6 | `ComboListFilters.tsx` | 64 | `md:flex-row` | フィルタ行を md 以上で横並びに（md 未満は縦並び） |
| 7 | `ComboListFilters.tsx` | 64 | `md:items-end` | フィルタ行の md 以上での縦位置揃え |

### (b) ブレークポイント未使用画面の特定

**全 11 画面のページコンポーネント本体がブレークポイント未使用**。

主要 features コンポーネントでブレークポイント未使用のもの（テーブル・エディタ等の主要 UI）:

- `ComboTable.tsx` — ブレークポイント使用なし
- `ComboTableRow.tsx` — ブレークポイント使用なし
- `CompareTable.tsx` — ブレークポイント使用なし
- `TrashList.tsx` — ブレークポイント使用なし
- `TagListTable.tsx` — ブレークポイント使用なし
- `ComboEditor.tsx` — ブレークポイント使用なし
- `ComboEditorBasicFields.tsx` — ブレークポイント使用なし
- `SetupRecipeEditor.tsx` — ブレークポイント使用なし
- `CompareTargetList.tsx` — ブレークポイント使用なし
- `ColumnVisibilityMenu.tsx` — ブレークポイント使用なし
- `MyComboStatusTabs.tsx` — ブレークポイント使用なし
- `AddComboToCompareModal.tsx` — ブレークポイント使用なし
- `QRCodeModal.tsx` — ブレークポイント使用なし

### (c) Tailwind 標準ブレークポイント値の確認

`web/tailwind.config.js` は **デフォルト設定のまま**。`theme.extend` 内に `screens` 等のブレークポイント拡張なし（全 8 行、`content` + 空の `theme.extend` + 空の `plugins` のみ）。

Tailwind デフォルト値が適用される:

- `sm` = 640px
- `md` = 768px
- `lg` = 1024px
- `xl` = 1280px
- `2xl` = 1536px

---

## 4.2 DES-005 §4.4 規定との整合性（項目 B）

### (a) DES-005 §4.4 規定の実値抽出

`docs/design/05-screen-design.md` §4.4「レスポンシブブレークポイント」の原文引用:

> TailwindCSSの標準ブレークポイントを使用。
>
> - スマホ：〜640px（sm未満）
> - タブレット：641px〜1024px（md、lg）
> - PC：1025px〜（xl以上）

### (b) DES-005 §4.4 規定値と Tailwind 標準値の整合確認

| 範囲 | DES-005 規定 | Tailwind デフォルト | 整合状況 |
|------|-------------|-------------------|----------|
| スマホ | 〜640px（sm 未満） | `sm` = 640px（640px 未満が sm 未満） | **一致** |
| タブレット | 641px〜1024px（md、lg） | `md` = 768px, `lg` = 1024px | **差異あり**: DES-005 は 641px〜1024px としているが、Tailwind の `md` は 768px から開始。641px〜767px の範囲は Tailwind では `sm`（640px〜767px）に該当し、DES-005 の「タブレット」とは異なる |
| PC | 1025px〜（xl 以上） | `xl` = 1280px | **差異あり**: DES-005 は 1025px 以上を PC としているが、Tailwind の `xl` は 1280px から。1025px〜1279px は Tailwind の `lg`（1024px〜1279px）に該当 |

DES-005 §4.4 は「TailwindCSSの標準ブレークポイントを使用」と記載しつつ、具体的な境界値がTailwind 標準とは一致しない部分がある。ただし、現状の実装ではブレークポイント使用が極めて少ない（7 箇所のみ、使用されているのは `sm:` と `md:` のみ）ため、実際の不整合による影響範囲は限定的。

---

## 4.3 スマホ表示で崩れる可能性が高い箇所の特定（項目 C）

### (a) 横スクロール発生の可能性が高いパターン

#### 固定幅 px の使用箇所

| ファイル | 行 | パターン | 使用クラス | 影響度（推測） |
|---------|-----|---------|-----------|--------------|
| `CompareTargetList.tsx` | 50 | 固定 max-w | `max-w-[200px]` | 低（truncate との組み合わせ、コンテンツ切り詰め用） |
| `AddComboToCompareModal.tsx` | 95 | 固定 max-w | `max-w-[200px]` | 低（同上、truncate 用） |
| `ColumnVisibilityMenu.tsx` | 55 | 固定 min-w | `min-w-[160px]` | 低（ドロップダウンメニュー、absolute 配置） |

#### overflow-x-auto 使用箇所（横スクロール対応済み）

| ファイル | 行 | コンテキスト |
|---------|-----|------------|
| `ComboTable.tsx` | 84 | テーブルラッパーに `overflow-x-auto`。テーブル本体は `min-w-full` |
| `CompareTable.tsx` | 256 | テーブルラッパーに `overflow-x-auto`。テーブル本体は `min-w-full` |
| `TrashList.tsx` | 34 | テーブルラッパーに `overflow-x-auto`。テーブル本体は `w-full` |
| `TagListTable.tsx` | 17 | テーブルラッパーに `overflow-x-auto`。テーブル本体は `w-full` |
| `MyComboStatusTabs.tsx` | 44 | タブバーに `overflow-x-auto`（タブ横スクロール対応） |

#### コンテナ幅の使用パターン

| コンテナ幅 | 使用画面 |
|-----------|---------|
| `max-w-7xl`（1280px） | ComboListPage, ComboDetailPage, ComparePage, TagManagementPageRoute, SettingsPage（ヘッダー部）, MyComboPage |
| `max-w-5xl`（1024px） | TrashPage |
| `max-w-3xl`（768px） | ComboEditorPage, SetupEditorPage, SettingsPage（コンテンツ部） |
| `max-w-lg`（512px） | HomePage, WizardPage |
| `max-w-md`（448px） | 各種モーダル（KnockdownAdvantageChangeModal, PromoteToFinalButton, TagFormDialog, ModifiersEditor, SetupSelectorModal, LinkExistingSetupModal, PutConfirmDialog, PermanentDeleteConfirm, ComboEditor 内確認ダイアログ, DuplicateWarning, TagDeleteConfirmDialog） |
| `max-w-sm`（384px） | QRCodeModal |

### (b) テーブル系コンポーネントのスマホ表示対応の有無

#### ComboTable（`web/src/features/combo/components/ComboTable.tsx`）

- ブレークポイント使用: **なし**
- `overflow-x-auto`: **あり**（テーブルラッパー、行 84）
- テーブル本体: `min-w-full`（行 85）— コンテナ幅を下回らないが、列数が多い場合にスマホで横スクロール発生
- 列幅: `w-10`（展開ボタン列、行 88-89）、その他は固定幅指定なし（`px-3 py-2` のみ）
- 列の表示・非表示切替: `ColumnVisibility` による制御あり（`visibility.starterSituation` / `visibility.damage` / `visibility.recipe` / `visibility.tags` / `visibility.draftStatus` / `visibility.memo`）だがブレークポイントによる自動切替ではなく、ユーザーの手動設定による
- スマホ向けカード形式への切替: **なし**

#### CompareTable（`web/src/features/combo/components/CompareTable.tsx`）

- ブレークポイント使用: **なし**
- `overflow-x-auto`: **あり**（テーブルラッパー、行 256）
- テーブル本体: `min-w-full`（行 257）
- ラベル列: `sticky left-0`（行 57）— 横スクロール時にラベル列が固定される実装あり
- ルート列: `max-w-xs`（行 194）— truncate で切り詰め
- スマホ向けカード形式への切替: **なし**

#### TrashList（`web/src/features/combo/components/TrashList.tsx`）

- ブレークポイント使用: **なし**
- `overflow-x-auto`: **あり**（テーブルラッパー、行 34）
- テーブル本体: `w-full`（行 35）
- 列幅: 固定幅指定なし
- 8 列固定（チェックボックス / 始動状況 / ダメージ / ルート / タグ / 削除日時 / 残日数 / 操作）— スマホでは横スクロール必至
- スマホ向けカード形式への切替: **なし**

#### TagListTable（`web/src/features/tag/components/TagListTable.tsx`）

- ブレークポイント使用: **なし**
- `overflow-x-auto`: **あり**（テーブルラッパー、行 17）
- テーブル本体: `w-full`（行 18）
- 列幅: 固定幅指定なし
- 5 列固定（名前 / カテゴリ / 色 / 使用数 / 操作）— スマホでも比較的収まる可能性あり
- スマホ向けアコーディオン形式への切替: **なし**

### (c) 共通 UI 要素（Header / Footer）のレスポンシブ実装状況

#### Header

**共通 Header コンポーネントは存在しない**。`web/src/layouts/` ディレクトリや `web/src/components/Header.tsx` は存在しない。各ページが独自に `<header>` 要素をインライン実装している。

インライン Header 実装の画面別パターン:

| 画面 | Header 実装 | スタイル | ナビゲーションリンク |
|------|------------|---------|-----------------|
| ComboListPage | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, ゴミ箱, タグ管理, マイコンボ, 設定 |
| MyComboPage | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, コンボ一覧, ゴミ箱, タグ管理, 設定 |
| ComboDetailPage | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, マイコンボ, ゴミ箱, タグ管理, 設定 |
| ComparePage | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, コンボ一覧, マイコンボ, 設定 |
| SettingsPage | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, ゴミ箱, タグ管理, マイコンボ（設定リンクなし = 現在ページ） |
| TagManagementPageRoute | インライン `<header>` | `bg-white border-b shadow-sm` / `max-w-7xl` | CombMgr, ゴミ箱, タグ管理, マイコンボ, 設定 |
| TrashPage | インライン `<header>` | `sticky top-0 z-10 border-b bg-white` | CombMgr, コンボ一覧, ゴミ箱, タグ管理, マイコンボ, 設定 |
| ComboEditorPage | **Header なし** | — | — |
| SetupEditorPage | **Header なし**（戻るリンクのみ） | — | コンボ詳細への戻るリンク + 戻るボタン |
| WizardPage | **Header なし** | — | — |
| HomePage | **Header なし**（タイトルバーのみ） | `bg-white border-b` / テキスト中央揃え | アプリタイトル表示のみ、ナビリンクなし |

**全 Header にブレークポイント使用なし**。DES-005 §4.1 規定の「スマホ版ではハンバーガーメニュー化」は **未実装**。PC 表示のナビゲーションリンク横並びがスマホでもそのまま表示される。

各 Header のナビゲーションリンク構成はページごとに異なる（リンク先・順序・テキスト・スタイルが不統一）。

#### Footer（`web/src/components/Footer.tsx`）

- 共有コンポーネントとして `web/src/components/Footer.tsx` に実装済み
- ブレークポイント使用: `sm:hidden`（行 25）— `sm`（640px）以上で非表示 = **スマホのみ表示**
- `App.tsx` で全画面共通に配置（行 37）、ウィザードページのみ非表示（行 30: `location.pathname !== "/wizard"`）
- `App.tsx` 行 34: `pb-16 sm:pb-0` — Footer 分の下部パディング、sm 以上では解除
- ナビゲーションボタン: コンボ一覧 / マイコンボ / 新規登録（中央・大きめ・青丸） / 設定 — **DES-005 §4.2 規定に準拠**
- 固定配置: `fixed bottom-0 left-0 right-0 z-50`

#### App.tsx（ルートレイアウト）

- `useIsMobile()` フック使用（`web/src/hooks/useIsMobile.ts`）: `(max-width: 639px)` で判定
- `isMobile` の用途: ルート `/` アクセス時、PC ではコンボ一覧へリダイレクト、スマホではホーム画面を表示（行 26）
- Footer 表示制御: ウィザード以外の全画面で Footer を表示（行 30-37）

---

## 4.4 R-2 / R-3 持ち越し関連の状態確認

### (a) R-2 関連: シミー DR 有データのカラム表示状況

| コンポーネント | シミー関連フィールドの表示 | DR 有データの表示 |
|---------------|----------------------|----------------|
| **ComboTable**（コンボ一覧） | **表示なし** — 起き攻め関連の列自体がテーブルに存在しない | **表示なし** |
| **ComboTableRow** | **表示なし** — 起き攻め関連のレンダリングなし | **表示なし** |
| **ComboDetailMetadata**（コンボ詳細） | **表示あり** — `okiShimmyNeutralTech`（行 110-113）、`okiShimmyBackTech`（行 118-121）を `YesNo` コンポーネントで表示 | **表示あり** — `okiMeatyNeutralTechThrowDr`（行 86-89）、`okiMeatyBackTechThrowDr`（行 102-105）を `YesNo` コンポーネントで表示 |
| **CompareTable**（コンボ比較） | **表示あり** — `formatOkiDrNone` 関数内で `shimmyVal` を参照（行 29-35）、`okiShimmyNeutralTech` / `okiShimmyBackTech` を使用（行 97-100） | **表示あり** — `formatOkiDrYes` 関数で `throwDrVal`（`okiMeatyNeutralTechThrowDr` / `okiMeatyBackTechThrowDr`）を表示（行 38-45, 93-96） |
| **ComboEditor**（コンボ登録・編集） | **編集可能** — `okiShimmyNeutralTech` / `okiShimmyBackTech` の初期値設定あり（行 151-152, 174-175, 518-519, 551-552） | **編集可能** — `okiMeatyNeutralTechThrowDr` / `okiMeatyBackTechThrowDr` の初期値設定あり（行 148, 150, 171, 173, 515, 517, 548, 550） |

### (b) R-3 関連: AddComboToCompareModal キャラクターフィルタ UI の状況

`web/src/features/combo/components/AddComboToCompareModal.tsx` の事実:

- **キャラクターフィルタ UI: なし**
- `CharacterSelector` コンポーネントの import / 使用: **なし**
- キャラクターフィルタ用の `useState`: **なし**
- `useCharacters` フック: **なし**
- コンボ取得クエリ: `useCombos(open ? { characterId: INITIAL_CHARACTER_ID } : { characterId: -1 })` — `INITIAL_CHARACTER_ID`（定数値）で固定（行 21-23）
- `CharacterSelector` コンポーネントは `web/src/features/mycombo/components/CharacterSelector.tsx` に存在するが、AddComboToCompareModal では使用されていない

---

## 4.5 関連設計書記述と実装の乖離

### (a) 発見した乖離

| # | 設計書 | 規定内容 | 実装の事実 |
|---|--------|---------|-----------|
| 1 | DES-005 §4.1 | 「スマホ版ではハンバーガーメニュー化」 | ハンバーガーメニューは未実装。PC 版と同じナビゲーションリンク横並びがスマホでもそのまま表示される |
| 2 | DES-005 §4.1 | 「プリセット切替」「言語切替」「ユーザー表示」「モード表示」がヘッダーに含まれる | いずれも Header に未実装（プリセットは M7+ 以降、言語切替・ユーザー表示・モード表示は現状なし） |
| 3 | DES-005 §4.4 | タブレット範囲: 641px〜1024px | Tailwind デフォルトでは `md` = 768px〜。641px〜767px は `sm` 範囲に該当し、DES-005 の「タブレット」定義と齟齬あり |
| 4 | DES-005 §4.4 | PC 範囲: 1025px〜（xl 以上） | Tailwind デフォルトでは `xl` = 1280px〜。1025px〜1279px は `lg` 範囲に該当 |
| 5 | DES-005 §5.6 レスポンシブ | コンボ一覧: 「スマホ：カード形式、フィルタはボトムシート展開」 | カード形式・ボトムシートいずれも未実装。スマホでもテーブル表示（overflow-x-auto による横スクロール） |
| 6 | DES-005 §5.8 レスポンシブ | コンボ比較: 「スマホ：横スクロール可能な表、または縦並びカード形式（切替可能）」 | 横スクロールは実装済み（overflow-x-auto + sticky ラベル列）。縦並びカード形式切替は未実装 |
| 7 | DES-005 §5.9 レスポンシブ | タグ管理: 「PCはテーブル、スマホはアコーディオン形式でキャラごとに展開」 | アコーディオン形式は未実装。スマホでもテーブル表示 |
| 8 | DES-005 §5.10 レスポンシブ | ゴミ箱: 「PCはテーブル、スマホはカード形式」 | カード形式は未実装。スマホでもテーブル表示（overflow-x-auto による横スクロール） |
| 9 | DES-005 §7 | 「フィルタ・ソートはボトムシート型UIで表示」「長いリストはカード形式で見やすく、スワイプ操作でアクション」 | ボトムシート・カード形式・スワイプ操作いずれも未実装 |

### (b) なければ

上記 9 件の乖離を発見した。

---

## 特記事項

1. **`lg:` / `xl:` / `2xl:` がプロジェクト全体で使用ゼロ**: ブレークポイント使用は `sm:`（2 箇所: App.tsx, Footer.tsx）と `md:`（5 箇所: ComboDetailHeader, ComboDetailMetadata × 2, ComboListFilters × 2）のみ。DES-005 §4.4 で定義された 3 段階（スマホ / タブレット / PC）のうち、PC 向け（`xl:` 以上）のブレークポイントは一度も使用されていない。

2. **Header が共通コンポーネント化されていない**: 各ページが独自に `<header>` をインライン実装しており、ナビゲーションリンクの構成（リンク先・順序・テキスト・スタイル）がページごとに異なる。Header 非表示のページも 4 つある（ComboEditorPage, SetupEditorPage, WizardPage, HomePage）。

3. **`useIsMobile()` フックの使用が限定的**: `useIsMobile()` は App.tsx でのルーティング分岐（ルート `/` → スマホはホーム / PC はコンボ一覧）にのみ使用されており、各画面のレイアウト切替（テーブル ↔ カード等）には使用されていない。`@media` クエリの CSS 直書きや `window.matchMedia` の直接使用も `useIsMobile.ts` 以外には存在しない。

4. **Header のスマホ対応が一切ない**: DES-005 §4.1 規定のハンバーガーメニュー化は未実装。PC 表示のナビリンク横並び（4〜5 リンク）がスマホでもそのまま表示される。ナビリンクは `gap-4` で横並びのため、画面幅が狭いとリンク群が画面外にはみ出す可能性がある。

5. **TrashPage の Header スタイルが他ページと異なる**: TrashPage のみ `sticky top-0 z-10` を使用（他ページは `sticky` なし）。また、TrashPage のみナビリンクが `<nav>` タグで囲まれている（他ページは `<div>` 内に直接 `<Link>` を配置）。

6. **Footer の `sm:hidden` と `useIsMobile()` の閾値が一致している**: Footer は `sm:hidden`（640px 以上で非表示）、`useIsMobile()` は `(max-width: 639px)` で判定しており、両者の閾値は整合している。

---

## 調査担当からの完了宣言

調査内容（§4.1 / §4.2 / §4.3 / §4.4 / §4.5）について、本指示書 §0.2 read-only 厳守 + §0.3 判断・提案を含めない運用に従って事実列挙を完了した。本調査結果を設計担当が受け取り、M7-03（系統 C: レスポンシブ仕上げ）の指示書スコープ確定に活用する想定。

調査担当のセッションはこの完了報告の出力をもって閉じる（製造作業は行わない）。
