# 指示書 M7-01: shadcn/ui 統一導入(Dialog + Popover 系)+ Header 共通化 + ハンバーガーメニュー化 + 残課題 3 解消

| 項目 | 内容 |
|------|------|
| 指示書ID | M7-01 |
| バージョン | 1.0.0 |
| 推奨モデル | Opus 4.6(関心数 3 = Dialog/Popover 系 17 件移行 + Header 共通化/ハンバーガー + 残課題 3 解消 + Props 命名是正 + モーダル実装パターン分裂解消 + `window.confirm` 除去。shadcn/ui 統一導入は本プロジェクト初の大規模 UI ライブラリ移行で各コンポーネントで判断分岐が発生 + 影響範囲が全画面に及ぶ。M4-01 / M4-03 / M4-04 / M3-03 / M3-05 / M6-02 の Opus 4.6 採用先例と整合、M7-overview v1.0.1 §7 / §4.3 確定済み)|
| Plan Mode | **必須**(下記 §3.4.10 に必須 8 項目あり)|
| 機械レビュー | 必須(レビューモデル: Sonnet 4.6、別ファイル M7-01-review-checklist.md v1.0.0)|
| 並列性 | 単独(M7-02 以降は本指示書完了承認後に順次着手)|
| 依存指示書 | M6-04 完了承認済み(2026-05-24)+ M7-RESEARCH-01 完了承認済み(2026-05-26)+ M7-RESEARCH-02 完了承認済み(2026-05-27)+ CHANGE-017 反映完了(2026-05-27、DES-005 v2.10.0)|
| 想定所要時間 | 200〜280 分(本プロジェクト最大規模) |
| 作成者・作成日 | 設計担当 Claude(M7 期間担当・新セッション、m7-design-session-handover v1.0.0 受領後)、2026-05-27 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-27 | 初版作成。m7-design-session-handover v1.0.0 §3 + M7-overview v1.0.1 §4.3 + M7-RESEARCH-01 §4.2 + 特記事項 7 件 + M7-RESEARCH-02 §4.3 (c) を統合反映。**Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)は現状維持 = 案 A**(2026-05-27 開発者ご判断)|

---

## 1. 背景と目的

### 1.1 背景

#### 1.1.1 shadcn/ui 統一導入の位置づけ

M1-06〜M6 期間で Dialog / Popover / Form / Toast 等を **標準 HTML + Tailwind の自作ラッパー** で実装してきた(M7-RESEARCH-01 で自作ラッパー **26 件** 特定済み)。一方 DES-001 §2 / DES-002 §5.3 / CLAUDE.md §2 で「Tailwind CSS + shadcn/ui」を技術スタックとして記載していたため設計書本体と実装の乖離が継続(M7-RESEARCH-01 §4.4 (a))。

M7-overview v1.0.1 §2.3 で「**shadcn/ui 標準 API に呼び出し側全画面を合わせる(案 β)**」確定。本 M7-01 は **Dialog + Popover 系 17 件**(Modal/Dialog 10 + Dropdown/Select 5 + Tabs/Accordion 2)を shadcn/ui ベースに移行する系統 A 前半に該当。Form + Toast + その他 9 件 + C-2 / C-3 / C-4 解消は M7-02。

#### 1.1.2 Header 共通化 + ハンバーガーメニュー化の M7-01 統合

M7-RESEARCH-02 §4.3 (c) で **「共通 Header コンポーネント不存在、7 ページがインライン個別実装 + 4 ページが Header 非表示、ナビ構成・順序・スタイルがページごとに異なる」** が事実として判明。DES-005 §4.1 規定「スマホ版ではハンバーガーメニュー化」も未実装(§4.5 (a) #1)。

M7-overview v1.0.1 §2.9 / §0.3.3 で R-1 持ち越し課題の解消基準を再定義: 「Header 共通化 + ハンバーガーメニュー化(shadcn/ui Sheet)+ 既存横スクロール温存 + R-2 / R-3 解消 = フェーズ 1 完了レベル」。本 M7-01 で shadcn/ui Sheet を早期活用し、副次的に **残課題 3**(ヘッダの「設定」リンクとプリセット disabled の他ページ反映、M6-02 v1.0.2 で SettingsPage のみ反映)が自動解消。

### 1.2 目的

本指示書完了時に以下を達成する:

- **shadcn/ui 初期化完了**: `pnpm dlx shadcn-ui@latest init` + `web/components.json` + `tailwind.config.js` 拡張 + `web/src/lib/utils.ts`(`cn()` 関数) + 依存追加(`@radix-ui/*` 各 / `class-variance-authority` / `tailwind-merge`)+ `clsx` の dead dependency 解消
- **17 件の自作ラッパーが shadcn/ui ベースに移行完了**(Modal/Dialog 10 + Dropdown/Select 5 + Tabs/Accordion 2、案 β 採用 = shadcn/ui 標準 API 準拠)
- **Header 共通化完了**: `web/src/components/Header.tsx` 新設、7 ページのインライン `<header>` を共通参照に置換
- **ハンバーガーメニュー化完了**(shadcn/ui Sheet、`sm:hidden` でスマホ表示)
- **残課題 3 解消**(全 7 ページに「設定」リンク + プリセット disabled が自動反映)
- **Props 命名揺れ是正完了**(`open` / `isOpen` → `open` 統一、`onClose` / `onCancel` → shadcn/ui 慣例 `onOpenChange` に統一)
- **モーダル実装パターン分裂解消完了**(`createPortal` 4 件 + fixed overlay div 6 件混在 → shadcn/ui Dialog の `@radix-ui/react-portal` 統一で自動解消)
- **`window.confirm` 残存除去完了**(SetupAccordionItem を shadcn/ui AlertDialog に置換)
- 既存機能(M1〜M6)に回帰なし

### 1.3 このマイルストーンで作らないもの

| 項目 | 送り先 / 理由 |
|------|------------|
| Form / Input / Select(汎用化)/ Checkbox / Radio / Switch / Textarea の shadcn/ui 移行 | M7-02(部分導入回避、playbook §4.6.4)。Modal 内の input / textarea も既存ネイティブのまま温存 |
| Toast 系の shadcn/ui 移行(M4-03 由来 topMessage、M5-01 活用パターン) | M7-02 |
| Button / Tooltip / Badge / Card / Table / List 系 9 件の差し替え | M7-02 |
| C-2(VirtualController + SetupRecipeEditor)/ C-3(LinkExistingSetupModal + SetupSelectorModal 統合)/ C-4(setup.defaultRecipe 条件描画統一)解消 | M7-02 |
| architecture-patterns §1 分離パターン逸脱 4 件解消(LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の useMutation・内部バリデーション) | M7-02 |
| 本格スマホ UI 整備(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7 のカード形式 / アコーディオン / ボトムシート / スワイプ) | フェーズ 3 以降(2026-05-27 案 Y 採用、M7-overview §2.9) |
| Header 内の追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示) | フェーズ 2 以降(M7-overview §2.9)|
| **Header 非表示 4 ページへの Header 追加**(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)| **案 A 採用、現状維持**(2026-05-27 開発者ご判断)。編集系 2 ページ = 集中環境 / ウィザード = 初回起動専用フロー / ホーム = スマホフッターからのナビ起点。DES-005 §4.1「全画面共通」は「Header を **表示する画面** では共通コンポーネントを使う」と運用解釈(CHANGE 通知書起票不要) |
| R-1 / R-2 / R-3 解消 | M7-03 |
| 残り 4 プリセット + AKI 追加 + 残り 3 キャラ + スキーマ耐久テスト | M7-04 |
| リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定 | M7-05 |
| 設計書本体(REQ-001 / DES-001〜006)改訂 | 本指示書スコープ内で起票見込みなし(DES-001 §2 / DES-002 §5.3 / CLAUDE.md §2 の shadcn/ui 記述は本指示書完了で自動的に整合)|
| P-1(プリセット管理画面)/ 残課題 1(Step 6 パスワード)/ 残課題 4 関連(LAN CORS/CSRF) | フェーズ 2 |
| L-02 / L-03 / L-04 / M-1〜M-4 / スマホ LAN 実機検証(U-1)/ 日英切替不適応(U-4)| M7-05 / 温存 |
| ModifiersEditor の `console.warn` 残存(P-01 相当)| 本指示書では別観点で温存(M7-RESEARCH-01 特記事項 6)|

---

## 2. 成果物

### 2.1 作成するファイル

#### shadcn/ui 初期化(新設、M7-01 主要スコープ)

- `web/components.json`(shadcn/ui CLI 生成、初期値 = §3.4.10 必須項目 3 で確定)
- `web/src/lib/utils.ts`(`cn()` 関数 = `clsx` + `tailwind-merge`、`clsx` dead dependency 解消)
- `web/src/components/ui/`(新設ディレクトリ、`pnpm dlx shadcn-ui@latest add` で生成):
  `dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `popover.tsx` / `dropdown-menu.tsx` / `select.tsx` / `tabs.tsx` / `accordion.tsx` / `command.tsx` / `checkbox.tsx` / `radio-group.tsx` / `textarea.tsx`(計 12 件、最終確定は §3.4.10 必須項目 1)

#### Header 共通化(新設)

- `web/src/components/Header.tsx`(共通 Header コンポーネント。PC: リンク横並び、スマホ: ハンバーガー + shadcn/ui Sheet)
- `web/src/components/Header.test.tsx`(単体テスト)

#### テスト(新規)

- `web/src/lib/utils.test.ts`(`cn()` 関数の単体テスト)

### 2.2 修正するファイル

##### A. 自作ラッパー 17 件 → shadcn/ui ベースへの差し替え

**共通方針**(全 17 件に適用):
- Props 命名是正: `open: boolean` 統一(`isOpen` → `open`)、`onClose` / `onCancel` → shadcn/ui 慣例の `onOpenChange: (open: boolean) => void` に統一(意味付き callback `onConfirm` / `onSubmit` / `onSelect` 等は維持)
- 内部状態(`useState` / `useMutation` / `useQuery`)は **基本的に維持**(分離パターン逸脱解消 + C-2 / C-3 / C-4 は M7-02)
- `createPortal` / fixed overlay div の差異は shadcn/ui Dialog 内部の `@radix-ui/react-portal` で自動統一

| # | 系統 | ファイル | shadcn/ui 対応 | 個別差分 |
|---|------|---------|--------------|---------|
| 1 | M/D | `combo/PutConfirmDialog.tsx` | `alert-dialog` | — |
| 2 | M/D | `combo/PermanentDeleteConfirm.tsx` | `alert-dialog` | **`isOpen` → `open` リネーム必須**、`useEffect`(Escape)削除(shadcn/ui 標準動作で代替) |
| 3 | M/D | `combo/AddComboToCompareModal.tsx` | `dialog` | `useQuery`(useCombos)維持 |
| 4 | M/D | `combo/KnockdownAdvantageChangeModal.tsx` | `dialog` + `radio-group` + `checkbox` | 内部 `useState`×2(mode / checkedIds)維持、手書き radio/checkbox を shadcn/ui 化 |
| 5 | M/D | `combo/SetupSelectorModal.tsx` | `dialog` | `useQuery`(useCharacterSetups)維持 |
| 6 | M/D | `combo/DuplicateWarning.tsx` | `alert-dialog` | — |
| 7 | M/D | `tag/TagFormDialog.tsx` | `dialog` | `useState`×5 + Zod + 内部 `<input>` / `<label>` は本 M7-01 で維持(M7-02 で分離 + Form 化) |
| 8 | M/D | `tag/TagDeleteConfirmDialog.tsx` | `alert-dialog` | — |
| 9 | M/D | `setup/LinkExistingSetupModal.tsx` | `dialog` | `useQuery` + `useMutation` 維持(M7-02) |
| 10 | M/D | `combo/ModifiersEditor.tsx` | `dialog` + `checkbox` + `radio-group` + `textarea` | `useState`×3 維持、`console.warn` 温存(P-01 別観点) |
| 11 | D/S | `combo/ColumnVisibilityMenu.tsx` | `dropdown-menu` + `checkbox` | `useState`(open)+ `useRef` + `useEffect`(click-outside)削除(shadcn/ui 標準動作で自動代替、コード削減)|
| 12 | D/S | `tag/TagSelector.tsx` | `popover` + `command` | `useState`(creating)+ `useMutation` 維持、open/search/click-outside 関連を shadcn/ui 標準動作で代替 |
| 13 | D/S | `combo/PresetSwitcher.tsx` | `select` | — |
| 14 | D/S | `mycombo/CharacterSelector.tsx` | `select` | `useQuery`(useCharacters)維持 |
| 15 | D/S | `mycombo/MyComboStatusSelect.tsx` | `select` | — |
| 16 | T/A | `mycombo/MyComboStatusTabs.tsx` | `tabs` | shadcn/ui Tabs の `value` / `onValueChange` API を内部でラップ |
| 17 | T/A | `setup/SetupAccordionItem.tsx` | `accordion` または `collapsible`(§3.4.10 必須項目 6)+ `alert-dialog`(`window.confirm` 置換) | `useState`(open)削除(shadcn/ui 標準動作で代替)、`useMutation` 維持、**`window.confirm` 除去必須** |

(系統: M/D = Modal/Dialog、D/S = Dropdown/Select、T/A = Tabs/Accordion)

##### B. 呼び出し元 18 ファイルの Props 渡し修正(M7-RESEARCH-01 §4.2 (c) 由来)

**共通方針**: 上記 A の Props 命名是正に伴い、呼び出し元の Props 渡しを shadcn/ui 慣例にラップ:
```tsx
<XxxModal
  open={isOpen}
  onOpenChange={(open) => { if (!open) handleClose(); }}
  onConfirm={...} // 既存意味付き callback は維持
/>
```

修正対象 18 ファイル:
- ページ: `ComboListPage.tsx` / `ComboDetailPage.tsx` / `ComboEditorPage.tsx` / `ComparePage.tsx` / `SetupEditorPage.tsx` / `TrashPage.tsx` / `SettingsPage.tsx` / `HomePage.tsx` / `WizardPage.tsx`(うち最後 3 つは Header 非表示で本指示書では Header 変更なし、ただしダイアログ呼び出しはあれば該当)
- features: `MyComboPage.tsx` / `TagManagementPage.tsx` / `ComboEditor.tsx` / `TrashListRow.tsx` / `TrashBulkActions.tsx` / `SetupRegistrationSection.tsx` / `PromoteToFinalButton.tsx` / `RecipeBuilder.tsx` / `SetupRecipeEditor.tsx` / `ComboListFilters.tsx` / `ComboEditorBasicFields.tsx` / `ComboDetailRecipe.tsx` / `ComboTableRow.tsx` / `SettingsSectionBasic.tsx` / `Step03Character.tsx` / `Step04Preset.tsx`

##### C. Header 共通化に伴う既存 7 ページ修正

各ページのインライン `<header>` を削除して `<Header />` 呼び出しに置換(現在ページ判定方式は §3.4.10 必須項目 5 で確定):
- `ComboListPage.tsx` / `MyComboPage.tsx` / `ComboDetailPage.tsx` / `ComparePage.tsx` / `SettingsPage.tsx` / `TagManagementPage.tsx` / `TrashPage.tsx`(TrashPage のみ `sticky top-0 z-10` を Header コンポーネントの `sticky` Props で温存、§3.4.10 必須項目 5)

##### D. shadcn/ui 初期化に伴う既存ファイル修正

- `web/package.json`: 依存追加(`@radix-ui/react-dialog` / `@radix-ui/react-alert-dialog` / `@radix-ui/react-popover` / `@radix-ui/react-dropdown-menu` / `@radix-ui/react-select` / `@radix-ui/react-tabs` / `@radix-ui/react-accordion` / `@radix-ui/react-checkbox` / `@radix-ui/react-radio-group` / `@radix-ui/react-slot` / `class-variance-authority` / `tailwind-merge` / `tailwindcss-animate`(CLI 要求時のみ))
- `web/tailwind.config.js`: `darkMode: "class"` + `theme.extend.colors` / `borderRadius` 拡張 + `tailwindcss-animate` plugin(具体値 = §3.4.10 必須項目 4)
- `web/src/index.css`(または相当 global CSS、§3.4.1 で特定): `:root` + `.dark` の shadcn/ui CSS 変数定義追加
- `web/src/App.tsx`(必要時のみ、Header 配置方式に応じて、§3.4.10 必須項目 5 で確定)

### 2.3 変更しないもの(原則)

- Form / Toast / Button / Tooltip / Badge / Card / Table / List 系の shadcn/ui 化(M7-02)、C-2 / C-3 / C-4 関連、architecture-patterns §1 分離パターン逸脱 4 件、PromoteToFinalButton の独立コンポーネント化(M7-02、本 M7-01 ではインライン構造内で `alert-dialog` 置換のみ)、ModifiersEditor の `console.warn`、**Header 非表示 4 ページへの Header 追加**、既存 routes 定義、`web/src/components/Footer.tsx`(M6-03 確立)、`App.tsx` の `useIsMobile()` + リダイレクト分岐、バックエンド全般、設計書本体、補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)

### 2.4 例外条項

本指示書スコープ内で実施を **許容** する例外:

| 項目 | 内容 |
|------|------|
| (a) 依存追加 | `@radix-ui/*` / `class-variance-authority` / `tailwind-merge` / `tailwindcss-animate`(CLI 要求時)、CLAUDE.md §6 ポリシー準拠、Plan Mode 承認 |
| (b) shadcn/ui 慣例ファイル新設 | `web/components.json` / `web/src/components/ui/` / `web/src/lib/utils.ts` |
| (c) `tailwind.config.js` 拡張 | `darkMode` / `theme.extend.colors` / `borderRadius` / `plugins`(§3.4.10 必須項目 4) |
| (d) global CSS 拡張 | `:root` + `.dark` CSS 変数定義 |
| (e) ラッパー 17 件 + 呼び出し元 18 ファイルの Props 修正 | §2.2 既明示 |
| (f) Header 共通化 + 既存 7 ページの `<header>` 削除 | §2.2 既明示 |
| (g) ハンバーガーメニュー化(shadcn/ui Sheet)| §2.2 既明示 |
| (h) `window.confirm` 除去 + PromoteToFinalButton インラインダイアログの AlertDialog 置換 | 独立コンポーネント化は M7-02 |
| (i) Props 命名揺れ是正 | `open` 統一 + `onOpenChange` ラップ、呼び出し元 18 ファイル修正 |

**許容しないもの**: §2.3 既明示の全項目 + 新規 CHANGE 通知書起票(本指示書スコープ内で見込みなし、必要発生時は Plan Mode 停止 → 開発者協議)+ DES-001 §2 / DES-002 §5.3 / CLAUDE.md §2 の shadcn/ui 記述に対する設計書本体改訂(本指示書完了で自動的に整合)

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当は実装着手前に以下を読了する:

- `docs/instructions/M7-overview.md` v1.0.1(最重要、本マイルストーン全体像)
- `docs/instructions/M7-RESEARCH-01-report.md`(最重要、本指示書の事実根拠)
- `docs/instructions/M7-RESEARCH-02-report.md`(最重要、Header 共通化部分の事実根拠)
- `docs/design/05-screen-design.md` v2.10.0 §4.1(ヘッダ) + §4.2(フッター、参考) + §4.4(レスポンシブブレークポイント、CHANGE-017 反映済)
- `docs/design/02-architecture.md` v1.8.0 §5.3(スタイリング)
- `docs/design/01-tech-stack.md` v1.3.0 §2(技術スタック)
- `docs/handover/design-instruction-playbook.md` v1.8.0 §4.6(段階移行禁止)+ §4.9(3 点セット確認)+ §17.2(shadcn/ui 未導入経緯)
- `docs/handover/architecture-patterns.md` v1.0.7 §1 + §1.1 + §6
- `docs/handover/retrospective-log.md` v1.0.22 §1 構造的アンチパターン + §6.6
- `docs/handover/m6-to-m7-handover.md` §3 + §5
- `docs/handover/m7-design-session-handover.md` v1.0.0 §3
- `docs/handover/change-number-registry.md` v1.6.0
- `docs/design/supp-001-detailed-design.md` v1.17.0 §4.1 M7 行 + §4.6
- `CLAUDE.md`(2026-05-26 改訂、§2 + §6 + §10)

### 3.2 任意参照(必要時のみ)

- `docs/design/requirements.md` v2.12.0(NFR301-302 / NFR306)
- `docs/design/06-validation.md` v1.9.0(Modal 内バリデーション維持確認)
- `docs/progress/progress-log.md` M6-03 部(Header 現状の経緯)
- `docs/instructions/M6-03-mobile-home-and-footer.md` v1.0.0(共通 UI 新設パターン、Footer.tsx 実装方針)
- `docs/instructions/M6-02-*.md`(M6-02 v1.0.2 SettingsPage の設定リンク + プリセット disabled パターン)
- shadcn/ui 公式: https://ui.shadcn.com/docs/components
- Radix UI 公式: https://www.radix-ui.com/primitives

### 3.3 参照不要

フェーズ 2/3 機能の REQ-001 §7 / §6.2-6.5 / DES-003 / DES-004 / M5-RESEARCH-01 / M6-RESEARCH-01 報告書 / 過去 handover アーカイブ / M4-00 / M4-00b 指示書

### 3.4 着手前の確認

§4 詳細仕様の実装に着手する前に以下を **すべて** 完了し、結果を Plan Mode 計画提示時に開発者報告する。**§3.4.9 対応表 5 表(UI 全範囲スコープ拡張)** + **§3.4.10 Plan Mode 必須項目 8 件** が本節の中核(M6-3 / M6-4 / M6-5 / M6-6 連続発生の再発防止策、handover §5.2 + retrospective-log v1.0.22 §6.6 + playbook §4.9)。

#### 3.4.1 既存ファイル構造の確認

- [ ] `web/package.json` の現状依存を確認(M7-RESEARCH-01 §4.1 (a) の継続性チェック)
- [ ] `web/tailwind.config.js` の現状確認(M7-RESEARCH-01 §4.1 (d))
- [ ] `web/src/index.css`(または相当 global CSS、Vite プロジェクト想定)の存在 + 内容確認 = shadcn/ui CSS 変数追加対象を特定
- [ ] `web/src/lib/` 配下確認(`utils.ts` が存在しないことを確認 = 新設対象)
- [ ] `web/src/components/` 配下確認(`ui/` ディレクトリ + `Header.tsx` 不存在 = 新設対象)
- [ ] `web/src/components/Footer.tsx`(M6-03 確立)を view 確認 = Header.tsx 実装時の対称的参考

#### 3.4.2 既存自作ラッパー 17 件の view 確認(playbook §4.9、最重要)

§2.2 表 A の 17 件すべてを view で **構造 + 責務 + Props の 3 点セット** 再確認。M7-RESEARCH-01 §4.2 (b) の事実列挙と一致 / 差分の有無を Plan Mode 計画提示時に明示(M6-04 以降の追加修正があれば検出する目的)。

**SetupAccordionItem の `window.confirm` 使用箇所**: `grep -n "window.confirm" web/src/features/setup/components/SetupAccordionItem.tsx` で確認。

#### 3.4.3 既存呼び出し元 18 ファイルの view 確認

§2.2 表 B の 18 ファイルすべてを view で確認、各ラッパーの **Props 渡し方** を確認し Props 命名揺れ是正の影響範囲を確定。

#### 3.4.4 Header 既存実装 7 ページの view 確認

M7-RESEARCH-02 §4.3 (c) のページ別 Header 個別実装表を製造担当が view で再確認し、Header 共通化時の「正本」ナビリンク構成を §3.4.10 必須項目 5 で確定する材料とする。**TrashPage の `sticky top-0 z-10` + `<nav>` タグ使用** は他ページと異なる特殊実装である点を §3.4.10 必須項目 5 で扱う。

#### 3.4.5 Header 非表示 4 ページの現状維持確認(案 A 採用)

**案 A 採用**: 以下 4 ページは Header 追加せず現状維持:
- `ComboEditorPage.tsx` / `SetupEditorPage.tsx` / `WizardPage.tsx` / `HomePage.tsx`

製造担当は `grep -n "<header" <各ファイル>` で `<header>` 不存在を確認。本指示書ではこれら 4 ページに Header を追加しない。DES-005 §4.1「全画面共通」は「Header を **表示する画面** では共通コンポーネントを使う」と解釈する運用判断(CHANGE 通知書起票不要)。

#### 3.4.6 shadcn/ui CLI / 依存追加の事前確認

- [ ] shadcn/ui Vite プロジェクト向けインストール手順を https://ui.shadcn.com/docs/installation/vite で確認(2026-05 時点の現行版)
- [ ] `pnpm dlx shadcn-ui@latest init` 対話入力項目を事前列挙(TypeScript / style / baseColor / globalCSS パス / tailwindConfig パス / importAlias / cssVariables / rsc 等)、§3.4.10 必須項目 2 で値確定
- [ ] `vite.config.ts` の `resolve.alias` 設定を view 確認(`@/` エイリアスの有無、shadcn/ui CLI は `@/` 前提)

#### 3.4.7 shadcn/ui 慣例の Props / 命名仕様の確認

- [ ] shadcn/ui Dialog / AlertDialog / Sheet / Popover / DropdownMenu / Select / Tabs / Accordion / Command / Checkbox / RadioGroup / Textarea の標準 API 確認(`open` / `onOpenChange` Props と各 Trigger / Content / Header / Title / Description / Footer 等の構造)
- [ ] Props 命名揺れ是正方針の確定(`open` 統一 + `isOpen` リネーム 1 件、`onClose` / `onCancel` → `onOpenChange` ラップ、意味付き callback は維持、§3.4.10 必須項目 7)

#### 3.4.8 既存 `App.tsx` / Footer / 共通レイアウト構造の確認

- [ ] `web/src/App.tsx` view 確認(Footer 配置方式 = グローバル / `useIsMobile` フック / 既存ルート定義)
- [ ] Header 配置方式候補:
  - (a) `App.tsx` グローバル配置(Footer と対称、Header 表示ページの条件分岐を追加)
  - (b) 各ページが個別に `<Header />` 呼出(現状のインライン `<header>` を共通参照置換)
- **設計担当の暫定推奨**: (b)。Header 表示 7 / 非表示 4 の半々状態のため、`App.tsx` で出し分け条件を持つよりページ側で明示呼び出しが見通し良い。Footer は「ウィザード以外の全画面」という単純条件で `App.tsx` 配置が自然だったが、Header は逆構成

#### 3.4.9 対応表の作成(M6-6 反省踏襲、最重要、UI 全範囲スコープ拡張)

製造担当は §4 着手前に、**M7-01 で扱う 4 系統(shadcn/ui 初期化 + Dialog/Popover 系 17 件移行 + Header 共通化 + ハンバーガー化)** に対して **表形式で網羅検証** する。

##### 表 A: shadcn/ui 初期化対応表

| 項目 | 既存実装 | M7-01 アクション | 確認結果(製造担当が埋める)|
|------|---------|----------------|---------------------|
| `web/components.json` | 未存在 | 新設(`init` で生成)| |
| `web/src/components/ui/` | 未存在 | 新設(`add` で生成)| |
| `web/src/lib/utils.ts` の `cn()` | 未存在 | 新設 | |
| `clsx` 依存 | 既導入だが dead | `cn()` で活用、dead 解消 | |
| `@radix-ui/*` 依存 | 未導入 | 追加 | |
| `class-variance-authority` 依存 | 未導入 | 追加 | |
| `tailwind-merge` 依存 | 未導入 | 追加 | |
| `tailwindcss-animate` 依存 | 未導入 | 必要時のみ(CLI 要求時)| |
| `lucide-react` 依存 | 既導入 ^0.460.0 | 既存 + ハンバーガー/閉じるアイコン活用 | |
| `tailwind.config.js` `darkMode` | 未設定 | `"class"` 追加 | |
| `tailwind.config.js` `theme.extend.colors` | 空 | CSS 変数参照追加 | |
| `tailwind.config.js` `theme.extend.borderRadius` | 空 | `lg`/`md`/`sm` 追加 | |
| global CSS の CSS 変数 | 未存在 | `:root` + `.dark` 追加 | |
| `vite.config.ts` `@/` エイリアス | §3.4.6 で確認 | 必要時のみ追加 | |

##### 表 B: 自作ラッパー 17 件 ↔ shadcn/ui 対応表

§2.2 表 A を参照(本指示書 §2.2 で 17 件すべての shadcn/ui 対応 + 内部状態維持 + 個別差分を網羅済み)。製造担当は §2.2 表 A の右端列「確認結果」を実際の view 結果で埋める。

##### 表 C: モーダル実装パターン分裂 → 統一(M7-RESEARCH-01 特記事項 2 由来)

| 現状パターン | 対象 | M7-01 アクション |
|-----------|------|----------------|
| `createPortal`(`document.body`)4 件 | PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog | shadcn/ui Dialog/AlertDialog 標準 portal で統一(自動代替)|
| fixed overlay div 6 件 | AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / LinkExistingSetupModal / ModifiersEditor | 同上(自動代替)|

##### 表 D: Header 共通化対応表(M7-RESEARCH-02 §4.3 (c) 由来)

| # | 画面 | M7-01 アクション | currentPath 値 |
|---|------|----------------|---------------|
| 1 | ComboListPage | 共通 Header 呼出 | `/combos` |
| 2 | MyComboPage | 共通 Header 呼出 | `/mycombos` |
| 3 | ComboDetailPage | 共通 Header 呼出 | `/combos/:id` または useLocation 動的判定 |
| 4 | ComparePage | 共通 Header 呼出 | `/compare` |
| 5 | SettingsPage | 共通 Header 呼出 | `/settings`(M6-02 v1.0.2 単独反映状態が全ページに自動展開)|
| 6 | TagManagementPage | 共通 Header 呼出 | `/tags` |
| 7 | TrashPage | 共通 Header 呼出 + `sticky` Props で `sticky top-0 z-10` 温存 | `/trash` |
| 8〜11 | ComboEditorPage / SetupEditorPage / WizardPage / HomePage | **現状維持(案 A)** | N/A |

##### 表 E: ハンバーガーメニュー化対応表

| 項目 | 内容 |
|------|------|
| ハンバーガーアイコン | `lucide-react` の `Menu` アイコン(既導入) |
| 表示閾値 | `sm:hidden` でスマホのみ(640px 未満)+ `hidden sm:flex` で PC リンク横並び |
| Sheet スライド方向 | `right` / `left` / `top` のいずれか(§3.4.10 必須項目 8 で確定)|
| Sheet 内ナビ構成 | PC 横並びと同リンク + 現在ページのリンク disabled |
| Sheet 閉じる動作 | リンククリックで自動閉(`SheetClose` ラップ)+ X ボタン + 背景クリック + ESC |

製造担当は表 A〜E を **完全に埋めた状態** で Plan Mode 計画提示する。未確認のまま §4 着手しないこと(M6-3〜M6-6 + M7-RESEARCH-01/02 と同種見落とし再発防止、最重要)。

#### 3.4.10 Plan Mode で開発者協議が必要な必須項目(8 項目、M6-2 反省踏襲)

製造担当は Plan Mode 計画提示時に **以下 8 項目すべての方針** を開発者に提示し判断を仰ぐ。確認項目が一つではない場合はCLI上のウィザードではなく、docs/human-notesに任意の名前の質問書を作成して待機。確認項目が一つの場合はそのままCLI上で聞く事:

1. **`shadcn-ui add` 対象コンポーネント列挙の最終確定**
   - 候補(§2.1): 12 件(`dialog` / `alert-dialog` / `sheet` / `popover` / `dropdown-menu` / `select` / `tabs` / `accordion` / `command` / `checkbox` / `radio-group` / `textarea`)+ `tailwindcss-animate`(CLI 要求時のみ)
   - 追加候補: `label` / `input`(Modal 内必要時に検討、ただし Form 全体は M7-02)
   - **設計担当の推奨**: §2.1 既明示の 12 件 + CLI 要求依存のみ。`label` / `input` は M7-02 で Form 全体と一括追加(部分導入回避、playbook §4.6.4)

2. **`shadcn-ui init` 対話入力値の確定**
   - `style`: `default` / `new-york` → **推奨 `default`**
   - `baseColor`: `Slate` / `Gray` / `Zinc` / `Neutral` / `Stone` → **推奨 `Slate`**(shadcn/ui デフォルト + 本プロジェクトのトンマナと整合)
   - `cssVariables`: yes
   - `globalCSS`: §3.4.1 確認結果に従う
   - `tailwindConfig`: `tailwind.config.js`
   - `importAlias.components`: `@/components`、`importAlias.utils`: `@/lib/utils`
   - `rsc`: no(Vite + SPA)

3. **`web/components.json` 初期設定値の確定**(必須項目 2 と一括 = CLI 生成内容の確認)

4. **`tailwind.config.js` 拡張 + global CSS の CSS 変数定義の確定**
   - **設計担当の推奨**: shadcn/ui CLI 生成内容をそのまま採用(独自カスタマイズしない、shadcn/ui エコシステム準拠)

5. **Header 共通コンポーネントのナビリンク構成 + 配置方式の確定**(最重要)
   - **ナビリンク構成**(暫定 8 項目): `[ロゴ(/combos)] | [コンボ一覧 /combos] [マイコンボ /mycombos] [コンボ比較 /compare] [タグ管理 /tags] [プリセット管理 disabled「今後実装予定」] [ゴミ箱 /trash] [設定 /settings]`(SettingsPage の M6-02 v1.0.2 構成 + プリセット disabled を全ページ展開)
   - **現在ページ判定**: useLocation の pathname と各リンクの to を比較し disabled スタイル(`pointer-events-none + text-gray-400`)+ リンク自体は表示維持(レイアウト動的変化回避)
   - **配置方式**: §3.4.8 候補 (b)(各ページ個別呼出、設計担当推奨)
   - **TrashPage の `sticky` 対応**: Header コンポーネントの `<Header sticky />` Props で個別対応(他ページは default `sticky=false`)、既存挙動変更を最小化

6. **`dialog` vs `alert-dialog` の使い分け + `accordion` vs `collapsible` の使い分け**
   - `alert-dialog`(強い確認系、ESC/背景クリックで閉じない): PutConfirmDialog / PermanentDeleteConfirm / DuplicateWarning / TagDeleteConfirmDialog / SetupAccordionItem 内 `window.confirm` 置換 / PromoteToFinalButton インラインダイアログ
   - `dialog`(キャンセル可能、選択/フォーム系): AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / TagFormDialog / LinkExistingSetupModal / ModifiersEditor
   - SetupAccordionItem: `accordion`(複数アイテムリスト)推奨、親 ComboDetailPage で `<Accordion type="multiple">` でラップ(`type="single"` / `"multiple"` 選択は Plan Mode 確定)

7. **Props 命名揺れ是正の実装方針確定**
   - 候補 (i): 呼び出し元で `onOpenChange={(open) => { if (!open) onClose(); }}` ラップ、ラッパーは `onOpenChange` のみ受け取る
   - 候補 (ii): ラッパー内部で `onOpenChange` 受け取り内部で `onClose` 呼出(既存 Props 維持、shadcn/ui 慣例から逸脱)
   - **設計担当の推奨**: 候補 (i)(案 β = shadcn/ui 慣例準拠と整合、M7-overview §2.3)。例外コンポーネント(既存 API 維持)はなし

8. **ハンバーガーメニュー化の詳細確定**
   - 表示閾値: **`sm`**(M6-03 Footer の `sm:hidden` と整合、DES-005 §4.4 CHANGE-017 反映後と整合)
   - Sheet スライド方向: **`right`**(shadcn/ui 慣例、UX 違和感少)
   - ハンバーガーアイコン: `lucide-react` の `Menu`
   - Sheet 内ナビ構成: PC 横並びと同じ + 現在ページ disabled(必須項目 5 と一貫)
   - リンククリック動作: 自動閉(`SheetClose` ラップ)

#### 3.4.11 §4 着手の前提条件

§3.4.1〜§3.4.10 すべての確認結果を Plan Mode の計画提示に含めること。未確認のまま §4 詳細仕様の実装に着手しないこと(retrospective-log v1.0.22 §1 構造的アンチパターン「実コード確認の省略」+ §6.1〜§6.6 各反省防止)。

**特に §3.4.9 対応表 5 表(A/B/C/D/E)+ §3.4.10 Plan Mode 必須項目 8 件は本指示書の中核**: 表を完全に埋めた状態 + 必須項目 8 件の方針を完全に提示した状態で開発者へ計画提示することが §4 着手の絶対条件。

---
## 4. 詳細仕様

本節は §3.4 着手前確認 + Plan Mode 計画提示 + 開発者承認後に着手。**§3.4.10 必須項目 8 件すべての方針が確定していない状態で本節の実装に着手しない**。

### 4.1 shadcn/ui 初期化

#### 4.1.1 依存追加

§2.2 D 表の依存リストを `pnpm add` で追加(`pnpm dlx shadcn-ui@latest init` 実行時に自動追加されない依存は手動追加)。最終的な実行は §3.4.10 必須項目 1 で開発者承認後。

#### 4.1.2 `pnpm dlx shadcn-ui@latest init` 実行

§3.4.10 必須項目 2 で確定した対話入力値を順次入力。実行後に生成される `web/components.json` / `web/src/lib/utils.ts` / `web/tailwind.config.js`(更新後) / `web/src/index.css`(または相当 global CSS、更新後)を確認。

#### 4.1.3 `pnpm dlx shadcn-ui@latest add` 実行

§3.4.10 必須項目 1 で確定した対象コンポーネント(12 件想定)を一括追加。`web/src/components/ui/` 配下に各 `.tsx` が生成されることを確認。内部実装は CLI 生成内容をそのまま採用(独自カスタマイズしない、案 β = shadcn/ui 標準 API 準拠)。

#### 4.1.4 `cn()` 関数の動作確認

`web/src/lib/utils.test.ts`(新設)で単体テスト:

```ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("複数クラスをマージできる", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });
  it("条件付きクラスを処理できる", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });
  it("Tailwind の衝突を解決できる", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
```

#### 4.1.5 ビルド + 起動確認

`pnpm build` + `pnpm dev` でエラーなく完了することを確認(§5.2 シナリオ A で再確認)。

### 4.2 Header 共通コンポーネント(`web/src/components/Header.tsx`)

#### 4.2.1 Props 型定義

```ts
interface HeaderProps {
  /** sticky 配置するか(TrashPage のみ true、他はデフォルト false)*/
  sticky?: boolean;
}
```

現在ページ判定は **内部で `useLocation` を呼び出す方式**(呼び出し元 7 ファイルで Props 渡し不要、コード削減)。テストでは `MemoryRouter` + `initialEntries` で代替。

#### 4.2.2 ナビリンク定義

```ts
const NAV_LINKS = [
  { to: "/combos", label: "コンボ一覧" },
  { to: "/mycombos", label: "マイコンボ" },
  { to: "/compare", label: "コンボ比較" },
  { to: "/tags", label: "タグ管理" },
  { to: "/presets", label: "プリセット管理", disabled: true, tooltip: "今後実装予定" }, // P-1 持ち越し
  { to: "/trash", label: "ゴミ箱" },
  { to: "/settings", label: "設定" },
];
```

ロゴ(左上、`/combos` へ遷移、アプリ名「CombMgr」)は別途配置(具体形は §3.4.10 必須項目 5)。

#### 4.2.3 実装概形

```tsx
<header className={cn("bg-white border-b shadow-sm", sticky && "sticky top-0 z-10")}>
  <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
    <Link to="/combos" className="font-bold text-lg">CombMgr</Link>

    {/* PC ナビリンク(sm 以上で表示)*/}
    <nav className="hidden sm:flex items-center gap-4">
      {NAV_LINKS.map((link) => {
        const isCurrent = pathname === link.to;
        if (link.disabled) {
          return <span key={link.to} title={link.tooltip} className="text-gray-400 cursor-not-allowed">{link.label}</span>;
        }
        return (
          <Link key={link.to} to={link.to}
            className={cn("text-sm hover:underline", isCurrent && "font-bold text-gray-400 pointer-events-none")}
            aria-current={isCurrent ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>

    {/* スマホハンバーガー(sm 未満で表示)*/}
    <Sheet>
      <SheetTrigger className="sm:hidden" aria-label="メニューを開く">
        <Menu className="h-6 w-6" />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader><SheetTitle>メニュー</SheetTitle></SheetHeader>
        <nav className="mt-4 flex flex-col gap-2">
          {NAV_LINKS.map((link) => {
            const isCurrent = pathname === link.to;
            if (link.disabled) {
              return <span key={link.to} title={link.tooltip} className="text-gray-400 cursor-not-allowed py-2">{link.label}</span>;
            }
            return (
              <SheetClose asChild key={link.to}>
                <Link to={link.to}
                  className={cn("py-2", isCurrent && "font-bold text-gray-400 pointer-events-none")}
                  aria-current={isCurrent ? "page" : undefined}>
                  {link.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  </div>
</header>
```

上記は概形例。実装細部(Tailwind クラス / aria 属性 / shadcn/ui import パス)は製造担当が shadcn/ui 公式ドキュメント + 既存 Footer.tsx を参考に最終調整。

#### 4.2.4 現在ページ判定の方針

- 完全一致(`pathname === link.to`)を基本(`/combos` ↔ `/combos`)
- `/combos/:id` のような動的パスは前方一致採用しない(コンボ詳細は別ページ扱い、UX 自然)
- 現在ページのリンクは **disabled スタイル**(`pointer-events-none + text-gray-400`)で表示維持(レイアウト動的変化回避、§3.4.10 必須項目 5)。M6-02 v1.0.2 SettingsPage は「設定」リンクを非表示にしていたが、本 M7-01 で **disabled スタイルに統一**

#### 4.2.5 単体テスト(`Header.test.tsx`)

- PC サイズで NAV_LINKS の全リンク表示
- スマホサイズで PC ナビ非表示 + ハンバーガーアイコン表示
- ハンバーガークリックで Sheet が開く + Sheet 内ナビ表示
- 現在ページのリンクが disabled スタイル(`pointer-events-none`)
- プリセット管理リンクが disabled + ツールチップ「今後実装予定」
- `sticky` Props で `sticky top-0 z-10` クラス付与

### 4.3 Modal / Dialog 系 10 件の shadcn/ui 移行

§2.2 表 A の 10 件すべてに **共通方針** を適用:

- shadcn/ui の各コンポーネント標準構造(`<Dialog>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogDescription>` / `<DialogFooter>` 等、AlertDialog も同様)で再構築
- Props: `{ open, onOpenChange, ...意味付き callback ... }`(`onClose` / `onCancel` 削除、`onOpenChange` で代替)
- 呼び出し元の Props 渡しを `onOpenChange={(open) => { if (!open) handleClose(); }}` ラップに変更
- `createPortal` / fixed overlay div は shadcn/ui 内部の `@radix-ui/react-portal` で自動代替(コード削除)
- 内部状態(`useState` / `useMutation` / `useQuery`)は §2.2 表 A の「個別差分」列に従う(原則維持、分離パターン逸脱解消は M7-02)
- `dialog` / `alert-dialog` の使い分けは §3.4.10 必須項目 6 で確定

呼び出し元の典型例(PutConfirmDialog の場合):
```tsx
<PutConfirmDialog
  open={showPutConfirm}
  onOpenChange={(open) => { if (!open) setShowPutConfirm(false); }}
  onConfirm={handleConfirmPut}
/>
```

**個別注記**:

- **PermanentDeleteConfirm**: `isOpen` → `open` リネーム必須(M7-RESEARCH-01 特記事項 4)、`useEffect`(Escape)削除(shadcn/ui 標準動作で代替)
- **KnockdownAdvantageChangeModal / ModifiersEditor**: 内部 radio / checkbox / textarea を shadcn/ui RadioGroup / Checkbox / Textarea に置換(Modal の構成要素として shadcn/ui 化、本 M7-01 スコープ内)
- **TagFormDialog**: 内部の `<input>` / `<label>` は **既存ネイティブのまま温存**(Form 全体の shadcn/ui 化は M7-02、部分導入回避)
- **ModifiersEditor**: `console.warn` 残存(P-01 相当)は触らず温存
- **AddComboToCompareModal**: 既存 `max-w-[200px]` 固定幅(M7-RESEARCH-02 §4.3 (a))は温存、レスポンシブ仕上げは M7-03

### 4.4 Dropdown / Select 系 5 件の shadcn/ui 移行

§2.2 表 A の 5 件(#11〜#15)すべてに **共通方針** を適用:

- shadcn/ui Select / DropdownMenu / Popover + Command の標準構造で再構築
- 既存 Props 契約(`onChange` / `onReset` / `selectedId` 等の意味付き API)は **維持**(`PresetSwitcher` / `CharacterSelector` / `MyComboStatusSelect` 等の `select` 系は内部で shadcn/ui の `value` / `onValueChange` をラップ、呼び出し元は影響なし)
- `useState`(open)+ `useRef`(containerRef)+ `useEffect`(click-outside)は shadcn/ui 標準動作で **自動代替**(コード削減)

**個別注記**:

- **ColumnVisibilityMenu**: `useState`(open)+ click-outside 関連を完全削除、既存 `min-w-[160px]` は温存
- **TagSelector**: `useState`(open / search)+ click-outside 関連削除、`useState`(creating)+ `useMutation`(`useTagManagement().createMutation`)は維持(分離パターン逸脱解消は M7-02)
- **CharacterSelector**: `useQuery`(`useCharacters`)維持
- 呼び出し元(MyComboPage / ComboListFilters / ComboEditorBasicFields / ComboDetailRecipe / SettingsSectionBasic / Step03Character / Step04Preset / ComboTableRow)は Props 渡し変更不要(意味付き API 維持のため)

### 4.5 Tabs / Accordion 系 2 件の shadcn/ui 移行

#### 4.5.1 MyComboStatusTabs → shadcn/ui Tabs

- shadcn/ui `<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>` で再構築
- `value` / `onValueChange` API を内部でラップ、既存 `selected` / `onSelect` / `counts` Props は維持
- カウントバッジは `<TabsTrigger>` の children として配置(ラベル + バッジ)
- 呼び出し元 MyComboPage.tsx:262 は Props 渡し変更不要

#### 4.5.2 SetupAccordionItem → shadcn/ui Accordion + AlertDialog(`window.confirm` 置換)

- shadcn/ui `<AccordionItem>` / `<AccordionTrigger>` / `<AccordionContent>` で再構築
- 親 ComboDetailPage で `<Accordion type="multiple">`(or `"single"`、§3.4.10 必須項目 6)でラップ
- `useState`(open)削除(shadcn/ui Accordion 標準動作で自動代替)
- `useMutation`(`useDeleteSetupLink`)維持(分離パターン逸脱解消は M7-02)
- **`window.confirm` を shadcn/ui AlertDialog に置換**(M7-RESEARCH-01 特記事項 5): 削除ボタンクリック → AlertDialog 開く → 確認時のみ `useDeleteSetupLink` 実行
- 既存 Props(`setup` / `parentComboId` / `onUnlink` / `onEdit`)は維持
- 呼び出し元 ComboDetailPage.tsx:157 で `<Accordion>` ラッパー追加が必要

### 4.6 既存ページの Header 共通コンポーネント呼び出しへの置き換え(7 ページ)

§2.2 C 表の 7 ページで以下の置換を実施:

```tsx
// Before
<header className="bg-white border-b shadow-sm">
  <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
    {/* 個別のロゴ + ナビリンク実装 */}
  </div>
</header>

// After
<Header />
{/* currentPath は内部 useLocation で自動判定 */}
```

これにより自動達成: 残課題 3 解消(全 7 ページに「設定」+ プリセット disabled 反映)+ ナビ構成統一 + ハンバーガー化(DES-005 §4.1)。

**TrashPage の特殊対応**: `<Header sticky />` で `sticky top-0 z-10` 温存(他ページは `<Header />` のみ)。

**Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)は現状維持(案 A)**。各ページの現状実装(`<header>` 不存在 / HomePage タイトルバー / SetupEditorPage 戻るリンク)はそのまま温存。

### 4.7 PromoteToFinalButton インラインダイアログの AlertDialog 置換

`PromoteToFinalButton.tsx` 内に埋め込まれている確認ダイアログ(M7-RESEARCH-01 特記事項 3、独立コンポーネントではなく内部埋込)を shadcn/ui AlertDialog に置換。**独立コンポーネント化は M7-02**(本 M7-01 ではインライン構造を維持しつつ AlertDialog ベースに置換するに留める)。

### 4.8 `clsx` dead dependency 解消

`web/src/lib/utils.ts` の `cn()` 関数(shadcn/ui CLI 生成、`clsx` + `tailwind-merge` 使用)により `clsx` ^2.1.1 が dead 状態から解放。`grep -rn "clsx" web/src/` で利用箇所が増えていることを確認。

### 4.9 i18n の温存

i18n(英語ロケール整備)はスコープ外(M7-overview §2.1、フェーズ 3 送り)。Header 共通コンポーネントのナビリンクラベル + ハンバーガー / メニュータイトルは **日本語ハードコード**。既存翻訳キー(M3 / M6 期間で追加)はそのまま温存、新規追加なし。

### 4.10 既知制限事項の温存

以下は本指示書では触らず後続マイルストーンで対応:

- 既存固定幅 3 件(`max-w-[200px]` × 2 / `min-w-[160px]` × 1、M7-RESEARCH-02 §4.3 (a))→ M7-03
- テーブル系 4 件の `overflow-x-auto` 横スクロール対応 → 温存(本格スマホ UI はフェーズ 3)
- ModifiersEditor `console.warn` 残存(P-01 相当)→ 別観点で温存
- architecture-patterns §1 分離パターン逸脱 4 件 → M7-02

---

## 5. テスト要件

### 5.1 単体テスト

#### 5.1.1 新規追加

- `web/src/lib/utils.test.ts`(`cn()` 関数、§4.1.4)
- `web/src/components/Header.test.tsx`(Header 共通コンポーネント、§4.2.5)

#### 5.1.2 既存テストの修正

17 件の自作ラッパー対応テスト + 呼び出し元 18 ファイルのテストで shadcn/ui DOM 構造に依存する assert があれば修正。shadcn/ui Dialog/AlertDialog は `<div role="dialog">` 形式のため、`screen.getByRole("dialog")` ベースの assert は影響を受けにくい。

特に修正必須:
- `PermanentDeleteConfirm.test.tsx`: `isOpen` → `open` リネーム反映

#### 5.1.3 件数見込み

M6-04 時点 380 件 + 本 M7-01 追加 10〜15 件 = **390 件前後**。

#### 5.1.4 実行コマンド

```bash
cd web && pnpm test --run
```

製造担当は完了報告で結果(成功 / 失敗 / スキップ)を記録。

---

## 6. レビュー観点(別ファイル参照)

機械レビューチェックリストは別ファイル `M7-01-review-checklist.md` v1.0.0 を参照。観点(12 章):

1. ファイル一覧(§2.1 / §2.2 / §2.3 / §2.4)
2. 着手前確認結果(§3.4 全体、特に §3.4.9 対応表 5 表 + §3.4.10 Plan Mode 必須項目 8 件)
3. shadcn/ui 初期化の妥当性(§4.1)
4. 17 件移行の妥当性(§4.3 / §4.4 / §4.5)
5. Header 共通化の妥当性(§4.2 / §4.6)
6. ハンバーガーメニュー化の妥当性
7. Props 命名是正の妥当性
8. モーダル実装パターン分裂解消の妥当性
9. `window.confirm` 除去の妥当性
10. テスト要件の充足(§5)
11. スコープ外への変更がないこと(§2.3、最重要)
12. retrospective-log v1.0.22 §1 構造的アンチパターンの再発なし

---

## 7. 完了条件(Definition of Done)

### 7.1 機能完了

- [ ] shadcn/ui 初期化完了(`components.json` / `lib/utils.ts` / `components/ui/` 12 件 / `tailwind.config.js` 拡張 / global CSS 変数定義)
- [ ] 17 件のラッパーが shadcn/ui ベースに移行完了
- [ ] 18 ファイルの呼び出し元 Props 渡しが shadcn/ui 慣例に修正完了
- [ ] Header 共通コンポーネント新設 + 7 ページの `<header>` 置換完了
- [ ] ハンバーガーメニュー化完了(`sm:hidden` + shadcn/ui Sheet)
- [ ] 残課題 3 解消(全 7 ページに「設定」+ プリセット disabled 自動反映)
- [ ] Props 命名揺れ是正完了(`isOpen` → `open` + `onClose`/`onCancel` → `onOpenChange`)
- [ ] モーダル実装パターン分裂解消完了
- [ ] `window.confirm` 残存除去完了(SetupAccordionItem)
- [ ] PromoteToFinalButton インラインダイアログが AlertDialog に置換完了
- [ ] `clsx` dead dependency 解消完了
- [ ] **Header 非表示 4 ページに Header 追加していない**(案 A 採用)

### 7.2 テスト完了

- [ ] `utils.test.ts` + `Header.test.tsx` 新規 + 全件 PASS
- [ ] 既存テスト修正後 + 全件 PASS
- [ ] `pnpm test --run` 全 PASS(390 件前後)
- [ ] `pnpm build` + `pnpm dev` エラーなし

### 7.3 既存機能回帰なし

- [ ] M1〜M6 全機能が動作変化なし(§5.2 シナリオ H)

### 7.4 Plan Mode 確定事項の遵守

- [ ] §3.4.10 必須項目 8 件すべてが Plan Mode で開発者承認済み + 実装反映済み
- [ ] §3.4.9 対応表 5 表(A/B/C/D/E)を製造担当が完全に埋めた状態で計画提示済み

### 7.5 スコープ外への変更がないこと

- [ ] 設計書本体(REQ-001 / DES-001〜006)変更なし
- [ ] 補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)変更なし
- [ ] 新規 CHANGE 通知書起票なし
- [ ] M7-02〜M7-05 スコープに該当する変更が含まれていない
- [ ] Header 非表示 4 ページに Header 追加なし

### 7.6 進捗ドキュメント更新

- [ ] `docs/progress/progress-log.md` に M7-01 完了報告追記

---

### 8（製造担当に必要のない情報だったため章を廃止）

---

## 9. 注意事項・判断に迷ったら

### 9.1 Plan Mode 停止して開発者協議が必須のケース

以下に該当した場合は §4 詳細仕様の実装を一時停止して開発者協議:

- §3.4.1〜§3.4.10 のいずれかで報告書記述と実態に **大きな差分**(M6-04 以降の追加修正等)が発見された
- shadcn/ui CLI 初期化で予期せぬエラー / 想定外の対話入力項目が発生
- 17 件移行の途中で「設計書本体への影響あり = CHANGE 通知書起票が必要」と判明(本指示書スコープ内では起票見込みなしと想定)
- Header ナビ構成 / 現在ページ判定方式で複数解釈が可能 + Plan Mode 必須項目 5 の確定方針と異なる選択肢が現れた
- 既存機能の回帰が発見された
- 分離パターン逸脱解消(LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の `useMutation` / 内部バリデーション)が誤って実装される傾向が発生(本 M7-01 では維持、M7-02 で解消)
- shadcn/ui のメジャーバージョン更新等で公式ドキュメントと本指示書 §4 の手順が乖離

### 9.2 設計担当の判断意図(製造担当が誤解しやすい点の補足)

- **案 β 採用 = shadcn/ui 標準 API に呼び出し側を合わせる**(M7-overview §2.3)。例外コンポーネント(既存 API 維持)はなし
- **本 M7-01 で触らない範囲**: §1.3 / §2.3 既明示。特に Form 全体 / Toast / Button / Tooltip / Badge / Card / Table / List / 分離パターン逸脱解消 / C-2/3/4 / Header 非表示 4 ページ / 既存固定幅 / ModifiersEditor `console.warn` / i18n キー追加
- **Modal 内の radio / checkbox / textarea は本 M7-01 で shadcn/ui 化**(KnockdownAdvantageChangeModal / ModifiersEditor):Modal の構成要素として shadcn/ui 化、ただし Modal 内の `<input>` / `<label>` は温存(Form 全体は M7-02、部分導入回避)
- **本格スマホ UI**(カード形式 / アコーディオン / ボトムシート / スワイプ)はフェーズ 3 以降送り(案 Y、M7-overview §2.9)、本 M7-01 では Header + ハンバーガーまで

### 9.5 設計担当への質問チャネル

製造担当は **Plan Mode 計画提示の質疑応答**(開発者を介して設計担当に確認)で質問。直接の Q&A セッションは設けない(playbook §1 役割分離)。

---

*以上、M7-01 指示書 v1.0.0*
