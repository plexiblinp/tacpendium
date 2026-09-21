# M7-01 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M7-01: shadcn/ui 統一導入(Dialog + Popover 系)+ Header 共通化 + ハンバーガーメニュー化 + 残課題 3 解消 v1.0.0 |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6(機械レビュー)|
| 役割 | M7-01 の実装が指示書通りか + 構造的問題がないかを機械的に検査する。**実機テスト + E2E シナリオ実行は別途実施が必要**(playbook §14、E2E シナリオは別ファイルで開発者が実行) |
| 作成日 | 2026-05-27 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-27 | 初版作成。M7-01 指示書 v1.0.0 に対応 |

---

## 0. レビュー実施前の確認

- [ ] M7-01 指示書 v1.0.0 を読了している
- [ ] M6-04 完了報告 + M7-RESEARCH-01 / M7-RESEARCH-02 完了報告を確認している
- [ ] CHANGE-017 通知書(DES-005 §4.4 整合化、反映完了済)を確認している
- [ ] DES-005 v2.10.0 / DES-002 v1.8.0 / DES-001 v1.3.0 を確認している
- [ ] playbook v1.8.0 §4.6 / §4.9 / §17.2 を確認している
- [ ] architecture-patterns v1.0.7 §1 / §1.1 / §6 を確認している
- [ ] retrospective-log v1.0.22 §1 構造的アンチパターン + §6.1〜§6.6 を確認している
- [ ] M7-overview v1.0.1 §2.3(案 β 採用) + §2.9(R-1 解消基準再定義 + 案 Y 採用) + §4.3(M7-01 スコープ)を確認している
- [ ] **Plan Mode 質問書(8 項目)+ 開発者回答ファイル**を確認している(複数項目の Plan Mode 協議は質問書ファイル方式で実施、playbook 改訂見込みの新運用)

---

## 1. ファイル一覧チェック(指示書 §2.1 / §2.2 / §2.3 / §2.4)

### 1.1 新規作成ファイル(§2.1)

#### shadcn/ui 初期化系
- [ ] `web/components.json` が新設されている(`pnpm dlx shadcn-ui@latest init` で生成)
- [ ] `web/src/lib/utils.ts` が新設されている(`cn()` 関数定義、`clsx` + `tailwind-merge` 使用)
- [ ] `web/src/components/ui/` ディレクトリが新設されている
- [ ] `web/src/components/ui/` 配下に shadcn/ui コンポーネントが追加されている(12 件想定: `dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `popover.tsx` / `dropdown-menu.tsx` / `select.tsx` / `tabs.tsx` / `accordion.tsx` / `command.tsx` / `checkbox.tsx` / `radio-group.tsx` / `textarea.tsx`、`shadcn-ui add` で生成)
- [ ] 追加された shadcn/ui コンポーネントは Plan Mode 必須項目 1 で確定した範囲のみ(`label` / `input` 等の Form 関連は **追加されていない**、M7-02 スコープ)

#### Header 共通化系
- [ ] `web/src/components/Header.tsx` が新設されている
- [ ] `web/src/components/Header.test.tsx` が新設されている

#### テスト系
- [ ] `web/src/lib/utils.test.ts` が新設されている(`cn()` 関数の単体テスト)

### 1.2 修正ファイル(§2.2)

#### A. 自作ラッパー 17 件 → shadcn/ui ベース差し替え

##### Modal / Dialog 系 10 件
- [ ] `combo/PutConfirmDialog.tsx` が shadcn/ui `alert-dialog` ベースに移行
- [ ] `combo/PermanentDeleteConfirm.tsx` が shadcn/ui `alert-dialog` ベースに移行、**`isOpen` → `open` リネーム完了**、`useEffect`(Escape)削除確認
- [ ] `combo/AddComboToCompareModal.tsx` が shadcn/ui `dialog` ベースに移行、`useQuery`(useCombos)維持
- [ ] `combo/KnockdownAdvantageChangeModal.tsx` が shadcn/ui `dialog` + `radio-group` + `checkbox` ベースに移行、`useState`×2(mode / checkedIds)維持
- [ ] `combo/SetupSelectorModal.tsx` が shadcn/ui `dialog` ベースに移行、`useQuery`(useCharacterSetups)維持
- [ ] `combo/DuplicateWarning.tsx` が shadcn/ui `alert-dialog` ベースに移行
- [ ] `tag/TagFormDialog.tsx` が shadcn/ui `dialog` ベースに移行、`useState`×5 + Zod + 内部 `<input>` / `<label>` は **既存ネイティブのまま温存**(部分導入回避)
- [ ] `tag/TagDeleteConfirmDialog.tsx` が shadcn/ui `alert-dialog` ベースに移行
- [ ] `setup/LinkExistingSetupModal.tsx` が shadcn/ui `dialog` ベースに移行、`useQuery` + `useMutation` 維持(M7-02 で分離)
- [ ] `combo/ModifiersEditor.tsx` が shadcn/ui `dialog` + `checkbox` + `radio-group` + `textarea` ベースに移行、`useState`×3 維持、**`console.warn` 残存温存**(P-01 別観点)

##### Dropdown / Select 系 5 件
- [ ] `combo/ColumnVisibilityMenu.tsx` が shadcn/ui `dropdown-menu` + `checkbox` ベースに移行、`useState`(open) + `useRef` + `useEffect`(click-outside) **削除完了**
- [ ] `tag/TagSelector.tsx` が shadcn/ui `popover` + `command` ベースに移行、`useState`(creating) + `useMutation` 維持
- [ ] `combo/PresetSwitcher.tsx` が shadcn/ui `select` ベースに移行
- [ ] `mycombo/CharacterSelector.tsx` が shadcn/ui `select` ベースに移行、`useQuery` 維持
- [ ] `mycombo/MyComboStatusSelect.tsx` が shadcn/ui `select` ベースに移行

##### Tabs / Accordion 系 2 件
- [ ] `mycombo/MyComboStatusTabs.tsx` が shadcn/ui `tabs` ベースに移行、`value` / `onValueChange` ラップ確認
- [ ] `setup/SetupAccordionItem.tsx` が shadcn/ui `accordion`(または `collapsible`、Plan Mode 必須項目 6 確定値)+ `alert-dialog` ベースに移行、**`window.confirm` 除去完了**、`useState`(open) 削除確認、`useMutation` 維持

#### B. 呼び出し元 18 ファイルの Props 渡し修正
- [ ] §2.2 表 B の 18 ファイルすべてで `onOpenChange={(open) => { if (!open) handleClose(); }}` ラップへの修正完了
- [ ] PermanentDeleteConfirm 呼び出し元 2 件(TrashListRow.tsx + TrashBulkActions.tsx)で `isOpen` → `open` Props 名変更完了
- [ ] 意味付き callback(`onConfirm` / `onSubmit` / `onSelect` / `onAdd` / `onLinked` / `onSave` / `onChange` / `onReset` / `onDelete` / `onEdit` / `onUnlink` / `onComboChanged` / `onSelectionChange` / `onStatusChange` / `onClearFilters` / `onToggleSelect` / `onFilterChange` / `onVisibilityChange` / `onVisibilityReset` / `onRemove`)は **すべて維持** されている

#### C. Header 共通化に伴う既存 7 ページ修正
- [ ] `ComboListPage.tsx` のインライン `<header>` 削除 + `<Header />` 呼び出しに置換
- [ ] `MyComboPage.tsx` 同上
- [ ] `ComboDetailPage.tsx` 同上
- [ ] `ComparePage.tsx` 同上
- [ ] `SettingsPage.tsx` 同上(M6-02 v1.0.2 で SettingsPage のみ設定リンク削除 + プリセット disabled 反映していた状態が、共通 Header により全 7 ページに自動展開されることを確認)
- [ ] `TagManagementPage.tsx` 同上
- [ ] `TrashPage.tsx` 同上、**`<Header sticky />` で `sticky top-0 z-10` 温存** 確認

#### D. shadcn/ui 初期化に伴う既存ファイル修正
- [ ] `web/package.json` に依存追加(`@radix-ui/react-*` 各 / `class-variance-authority` / `tailwind-merge` / `tailwindcss-animate`(CLI 要求時のみ))
- [ ] `web/tailwind.config.js` に `darkMode: "class"` + `theme.extend.colors` + `theme.extend.borderRadius` + `tailwindcss-animate` plugin(必要時)が追加
- [ ] global CSS(`web/src/index.css` または相当)に `:root` + `.dark` の shadcn/ui CSS 変数定義が追加
- [ ] `web/src/App.tsx`(必要時のみ、Header 配置方式に応じて修正、Plan Mode 必須項目 5 確定値に従う)

### 1.3 スコープ外への変更がないこと(§2.3、最重要)

- [ ] **設計書本体(REQ-001 / DES-001〜DES-006)に変更がない**(M7-overview §9.2 既定、最重要)
- [ ] **補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)に変更がない**(本指示書スコープ内で改訂見込みなし、最重要)
- [ ] **新規 CHANGE 通知書が起票されていない**(本指示書スコープ内では起票見込みなし)
- [ ] **Form / Input / Select(汎用化) / Checkbox / Radio / Switch / Textarea の shadcn/ui 化**が実施されていない(Modal 内の構成要素として shadcn/ui 化したものは除く = KnockdownAdvantageChangeModal / ModifiersEditor 内の radio/checkbox/textarea のみ許容)
- [ ] **Toast 系**(M4-03 由来 topMessage、M5-01 活用パターン)に変更がない
- [ ] **Button / Tooltip / Badge / Card / Table / List 系 9 件**の差し替えが実施されていない(M7-02 スコープ)
- [ ] **C-2(VirtualController + SetupRecipeEditor)/ C-3(LinkExistingSetupModal + SetupSelectorModal 統合)/ C-4(setup.defaultRecipe 条件描画統一)** が解消されていない(M7-02 スコープ)
- [ ] **architecture-patterns §1 分離パターン逸脱 4 件**(LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の `useMutation` / 内部バリデーション)が **解消されていない**(M7-02 スコープ、本 M7-01 では維持が正)
- [ ] **PromoteToFinalButton インラインダイアログの独立コンポーネント化**が実施されていない(M7-02 スコープ、本 M7-01 ではインライン構造内で AlertDialog 置換のみ)
- [ ] **ModifiersEditor の `console.warn`** が **残存**(P-01 別観点、本 M7-01 では触らない)
- [ ] **Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)に Header が追加されていない**(案 A 採用、現状維持、最重要)
- [ ] 既存 routes 定義の **変更がない**
- [ ] `web/src/components/Footer.tsx`(M6-03 確立)に **変更がない**
- [ ] `web/src/App.tsx` の `useIsMobile()` フック + リダイレクト分岐(M6-03 確立)に **変更がない**(Header 配置方式の修正は許容)
- [ ] バックエンド全般(handler / service / repository / model / migration / config / netutil)に **変更がない**
- [ ] **R-1 / R-2 / R-3** に関するレスポンシブ仕上げ(本格スマホ UI 整備、カード形式 / アコーディオン / ボトムシート / スワイプ)が実施されていない(M7-03 / フェーズ 3 送り)
- [ ] **Header 内追加要素**(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)が実施されていない(フェーズ 2 以降送り)
- [ ] **既存固定幅 3 件**(`max-w-[200px]` × 2 / `min-w-[160px]` × 1)が温存されている(M7-03 で対応)
- [ ] **テーブル系 4 件の `overflow-x-auto` 横スクロール対応**が温存されている(フェーズ 3 送り)
- [ ] **i18n キー追加なし**(Header 共通コンポーネントのナビリンクラベル + ハンバーガー / メニュータイトルは日本語ハードコード)
- [ ] **残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久テスト**が実施されていない(M7-04 スコープ)
- [ ] **リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定**が実施されていない(M7-05 スコープ)

### 1.4 例外条項適用箇所のチェック(§2.4)

- [ ] (a) 依存追加が `@radix-ui/*` / `class-variance-authority` / `tailwind-merge` / `tailwindcss-animate`(CLI 要求時のみ)の範囲内、Plan Mode で承認済み
- [ ] (b) `web/components.json` / `web/src/components/ui/` / `web/src/lib/utils.ts` の新設が shadcn/ui 慣例どおり
- [ ] (c) `tailwind.config.js` 拡張が shadcn/ui CLI 生成内容に準拠(独自カスタマイズなし、Plan Mode 必須項目 4 確定どおり)
- [ ] (d) global CSS の CSS 変数定義が shadcn/ui CLI 生成内容に準拠
- [ ] (e) ラッパー 17 件 + 呼び出し元 18 ファイル修正が §2.2 範囲内
- [ ] (f) Header 共通化 + 既存 7 ページ `<header>` 削除が §2.2 範囲内
- [ ] (g) ハンバーガーメニュー化が shadcn/ui Sheet で実装
- [ ] (h) `window.confirm` 除去(SetupAccordionItem)+ PromoteToFinalButton AlertDialog 置換が必要最小限(独立コンポーネント化は M7-02)
- [ ] (i) Props 命名是正が `open` 統一 + `onOpenChange` ラップで一貫

---

## 2. 着手前確認結果のチェック(指示書 §3.4)

製造担当の作業報告に以下の確認結果が **すべて含まれている** こと:

### 2.1 §3.4.1 既存ファイル構造の確認
- [ ] `web/package.json` 現状依存の確認結果(M7-RESEARCH-01 §4.1 (a) との一致確認)
- [ ] `web/tailwind.config.js` 現状の確認結果(M7-RESEARCH-01 §4.1 (d) との一致確認)
- [ ] global CSS(`web/src/index.css` 等)の存在 + 内容確認結果
- [ ] `web/src/lib/` 配下確認(`utils.ts` 不存在を確認)
- [ ] `web/src/components/` 配下確認(`ui/` ディレクトリ + `Header.tsx` 不存在を確認)
- [ ] `web/src/components/Footer.tsx` の view 確認結果(対称的参考)

### 2.2 §3.4.2 既存自作ラッパー 17 件の view 確認(3 点セット、最重要)
- [ ] 17 件すべての **構造 + 責務 + Props の 3 点セット** view 確認結果
- [ ] M7-RESEARCH-01 §4.2 (b) との一致 / 差分の有無を明示
- [ ] SetupAccordionItem の `window.confirm` 使用箇所が grep で確認されている

### 2.3 §3.4.3 既存呼び出し元 18 ファイルの view 確認
- [ ] 18 ファイルすべての view 確認結果
- [ ] 各ラッパーの Props 渡し方確認 = Props 命名揺れ是正の影響範囲確定

### 2.4 §3.4.4 Header 既存実装 7 ページの view 確認
- [ ] 7 ページのインライン `<header>` 実装の view 確認結果
- [ ] ナビリンク構成(順序付き)の集約結果
- [ ] M7-RESEARCH-02 §4.3 (c) との一致 / 差分の有無を明示
- [ ] TrashPage の `sticky top-0 z-10` + `<nav>` タグ使用の特殊実装確認

### 2.5 §3.4.5 Header 非表示 4 ページの現状維持確認(案 A、最重要)
- [ ] ComboEditorPage / SetupEditorPage / WizardPage / HomePage の `<header>` 不存在を `grep` で確認した結果
- [ ] **これら 4 ページに本 M7-01 で Header を追加していないこと** を明示

### 2.6 §3.4.6 shadcn/ui CLI / 依存追加の事前確認
- [ ] shadcn/ui Vite プロジェクト向けインストール手順の確認結果
- [ ] `pnpm dlx shadcn-ui@latest init` 対話入力項目の事前列挙
- [ ] `vite.config.ts` の `@/` エイリアス設定確認結果

### 2.7 §3.4.7 shadcn/ui 慣例 Props / 命名仕様の確認
- [ ] Dialog / AlertDialog / Sheet / Popover / DropdownMenu / Select / Tabs / Accordion / Command / Checkbox / RadioGroup / Textarea 各標準 API 確認結果
- [ ] Props 命名揺れ是正方針の確定(`open` 統一 + `isOpen` リネーム 1 件 + `onOpenChange` ラップ + 意味付き callback 維持)

### 2.8 §3.4.8 既存 App.tsx / Footer / 共通レイアウト構造の確認
- [ ] `web/src/App.tsx` 現状 view 確認結果(Footer 配置方式 / useIsMobile / 既存ルート)
- [ ] Header 配置方式の選択(候補 a or b、Plan Mode 必須項目 5 で確定値)

### 2.9 §3.4.9 対応表 5 表(A〜E)完全埋め確認(最重要)
- [ ] **表 A: shadcn/ui 初期化対応表** の全行が view 結果 + 確定方針で埋まっている
- [ ] **表 B: 自作ラッパー 17 件 ↔ shadcn/ui 対応表**(指示書 §2.2 表 A の確認結果列)の全行が埋まっている
- [ ] **表 C: モーダル実装パターン分裂 → 統一表** が確認されている(10 件すべて shadcn/ui Dialog portal で統一見込み)
- [ ] **表 D: Header 共通化対応表** の全行(7 ページ移行 + 4 ページ現状維持)が確認されている
- [ ] **表 E: ハンバーガーメニュー化対応表** の全行(アイコン / 閾値 / Sheet 方向 / 内部ナビ構成 / 閉じる動作)が確認されている

### 2.10 §3.4.10 Plan Mode 必須項目 8 件確定確認(最重要)
- [ ] **質問書ファイル方式で実施されている**(複数項目 8 件の Plan Mode 協議は CLI 上ではなく質問書ファイルで実施、playbook 改訂見込みの新運用)
- [ ] 必須項目 1: `shadcn-ui add` 対象コンポーネント列挙の最終確定値
- [ ] 必須項目 2: `shadcn-ui init` 対話入力値の確定値
- [ ] 必須項目 3: `web/components.json` 初期設定値の確定
- [ ] 必須項目 4: `tailwind.config.js` 拡張 + global CSS 変数定義の確定
- [ ] 必須項目 5: Header ナビリンク構成 + 配置方式 + 現在ページ判定 + TrashPage sticky 対応の確定
- [ ] 必須項目 6: `dialog` vs `alert-dialog` 使い分け + `accordion` vs `collapsible` 使い分けの確定
- [ ] 必須項目 7: Props 命名是正の実装方針確定(候補 i = shadcn/ui 慣例準拠ラップ採用)
- [ ] 必須項目 8: ハンバーガー詳細確定(表示閾値 `sm` / Sheet 方向 `right` 等)

---

## 3. shadcn/ui 初期化の妥当性(指示書 §4.1)

### 3.1 依存追加
- [ ] §2.2 D の依存リストが `pnpm add` で正しく追加されている
- [ ] 不要な追加依存(`label` / `input` 等)が含まれていない(M7-02 で追加するため)

### 3.2 CLI 実行
- [ ] `pnpm dlx shadcn-ui@latest init` が Plan Mode 必須項目 2 で確定した対話入力値で実行されている
- [ ] `pnpm dlx shadcn-ui@latest add` で 12 件のコンポーネントが追加されている
- [ ] 生成された `web/src/components/ui/*.tsx` が **shadcn/ui CLI 生成内容のまま**(独自カスタマイズなし、案 β 準拠)

### 3.3 `cn()` 関数
- [ ] `web/src/lib/utils.ts` の `cn()` 関数が `clsx` + `tailwind-merge` で構成されている
- [ ] `web/src/lib/utils.test.ts` が単体テスト 3 件以上を含み、全件 PASS

### 3.4 `clsx` dead dependency 解消
- [ ] `grep -rn "clsx" web/src/` で `web/src/lib/utils.ts` 含めて利用箇所が複数件確認できる(dead 状態解消)

### 3.5 ビルド + 起動確認
- [ ] `pnpm build` がエラーなく完了
- [ ] `pnpm dev` がエラーなく起動

---

## 4. 17 件移行の妥当性(指示書 §4.3 / §4.4 / §4.5)

### 4.1 Modal / Dialog 系 10 件
- [ ] 各コンポーネントの shadcn/ui 対応物との一致(§2.2 表 A 個別差分列に従う)
- [ ] 内部状態(`useState` / `useMutation` / `useQuery`)が **指示書通り維持**(原則維持、分離パターン逸脱解消は M7-02)
- [ ] Props 命名が `open` + `onOpenChange` + 意味付き callback 維持に統一
- [ ] `createPortal` / fixed overlay div の使用が **完全削除**(shadcn/ui Dialog 内部の portal で代替)

### 4.2 Dropdown / Select 系 5 件
- [ ] shadcn/ui Select / DropdownMenu / Popover + Command への移行が完了
- [ ] `useState`(open)+ `useRef`(containerRef)+ `useEffect`(click-outside)の **削除完了**(shadcn/ui 標準動作で代替)
- [ ] 既存 Props 契約(意味付き API)が維持されており、呼び出し元への影響なし(`PresetSwitcher` / `CharacterSelector` / `MyComboStatusSelect` の呼び出し元 Props 渡し変更なし)
- [ ] **TagSelector の `useState`(creating) + `useMutation` は維持**(M7-02 で分離)

### 4.3 Tabs / Accordion 系 2 件
- [ ] MyComboStatusTabs が shadcn/ui Tabs に移行、`value` / `onValueChange` 内部ラップ + カウントバッジ表示
- [ ] SetupAccordionItem が shadcn/ui Accordion(Plan Mode 必須項目 6 で確定した `type`)+ AlertDialog に移行
- [ ] **SetupAccordionItem の `window.confirm` 完全削除**(M7-RESEARCH-01 特記事項 5 由来、最重要)
- [ ] SetupAccordionItem の `useMutation` は **維持**(分離パターン逸脱解消は M7-02)

---

## 5. Header 共通化 + ハンバーガーの妥当性(指示書 §4.2 / §4.6)

### 5.1 Header 共通コンポーネント
- [ ] `Header.tsx` の Props 設計が `sticky?: boolean` のみ(現在ページ判定は内部 `useLocation`)
- [ ] ナビリンク定義が指示書 §4.2.2 の 7 項目 + ロゴ(計 8 項目: ロゴ / コンボ一覧 / マイコンボ / コンボ比較 / タグ管理 / プリセット管理 disabled / ゴミ箱 / 設定)
- [ ] **プリセット管理リンクが disabled + ツールチップ「今後実装予定」**(M6-02 v1.0.2 と統一文言、P-1 持ち越し)
- [ ] **現在ページのリンクが disabled スタイル**(`pointer-events-none + text-gray-400` 等、リンク自体は表示維持、レイアウト動的変化回避)
- [ ] `sticky` Props が `true` で渡された場合のみ `sticky top-0 z-10` クラス付与
- [ ] aria 属性(`aria-current="page"` / `aria-label="メニューを開く"` 等)が過不足なく付与

### 5.2 ハンバーガーメニュー
- [ ] shadcn/ui Sheet 採用、`side="right"`(Plan Mode 必須項目 8 確定値)
- [ ] `sm:hidden` でスマホのみハンバーガー表示、`hidden sm:flex` で PC ナビ表示
- [ ] ハンバーガーアイコンが `lucide-react` の `Menu`
- [ ] Sheet 内ナビ構成が PC 横並びと同じリンク + 現在ページ disabled
- [ ] Sheet 内のリンククリックで **自動閉**(`SheetClose` ラップ)
- [ ] Sheet 閉じる動作が X ボタン / 背景クリック / ESC キーで動作

### 5.3 既存 7 ページの置換
- [ ] 各ページのインライン `<header>` ブロックが **完全削除**
- [ ] 各ページが `<Header />` 呼び出しに置換(TrashPage のみ `<Header sticky />`)
- [ ] 残課題 3 解消の確認: 全 7 ページに「設定」リンク + プリセット disabled が自動反映(M6-02 v1.0.2 で SettingsPage のみだった状態が共通 Header で全展開)

### 5.4 Header 非表示 4 ページ現状維持(案 A、最重要)
- [ ] `ComboEditorPage.tsx` に Header が **追加されていない**
- [ ] `SetupEditorPage.tsx` に Header が **追加されていない**(戻るリンクのみの現状維持)
- [ ] `WizardPage.tsx` に Header が **追加されていない**
- [ ] `HomePage.tsx` に Header が **追加されていない**(タイトルバーのみの現状維持)

### 5.5 Header 単体テスト
- [ ] `Header.test.tsx` が以下を網羅:
  - PC サイズで NAV_LINKS の全リンク表示
  - スマホサイズで PC ナビ非表示 + ハンバーガーアイコン表示
  - ハンバーガークリックで Sheet が開く + Sheet 内ナビ表示
  - 現在ページのリンクが disabled スタイル
  - プリセット管理リンクが disabled + ツールチップ
  - `sticky` Props で `sticky top-0 z-10` クラス付与
- [ ] テスト全件 PASS

---

## 6. Props 命名是正の妥当性(指示書 §2.2 / §3.4.10 必須項目 7)

### 6.1 ラッパー側
- [ ] `isOpen` → `open` リネーム(PermanentDeleteConfirm 1 件のみ、他は元から `open`)
- [ ] `onClose` / `onCancel` → `onOpenChange: (open: boolean) => void` の置換
- [ ] 意味付き callback が **すべて維持**(変換されていない、削除されていない)
- [ ] 例外コンポーネント(既存 API 維持)が **ない**(案 β 全件適用)

### 6.2 呼び出し元 18 ファイル側
- [ ] `onOpenChange={(open) => { if (!open) handleClose(); }}` ラップに統一
- [ ] 意味付き callback の Props 渡しが変更されていない(callback 自体は維持)

---

## 7. モーダル実装パターン分裂解消 + `window.confirm` 除去(指示書 §3.4.9 表 C + §4.5.2 + §4.7)

### 7.1 `createPortal` 4 件 → shadcn/ui Dialog portal 統一
- [ ] PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog から `createPortal` 直接使用が **完全削除**
- [ ] shadcn/ui Dialog / AlertDialog 内部の `@radix-ui/react-portal` で代替されていることをコードで確認

### 7.2 fixed overlay div 6 件 → shadcn/ui Dialog portal 統一
- [ ] AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / LinkExistingSetupModal / ModifiersEditor から fixed overlay div の直接使用が **完全削除**

### 7.3 `window.confirm` 除去
- [ ] `grep -rn "window.confirm" web/src/` で **0 件**(SetupAccordionItem で完全削除完了)
- [ ] 削除した `window.confirm` 箇所が shadcn/ui AlertDialog に置換され、確認時のみ `useDeleteSetupLink` mutation 実行する形になっている

### 7.4 PromoteToFinalButton インラインダイアログ → AlertDialog 置換
- [ ] `PromoteToFinalButton.tsx` 内のインライン確認ダイアログが shadcn/ui AlertDialog ベースに置換されている
- [ ] **独立コンポーネント化されていない**(本 M7-01 ではインライン構造維持、独立化は M7-02)

---

## 8. テスト要件(指示書 §5.1)

- [ ] `web/src/lib/utils.test.ts` 新規 + 全件 PASS
- [ ] `web/src/components/Header.test.tsx` 新規 + 全件 PASS
- [ ] 既存テスト(shadcn/ui DOM 構造影響を受けたもの)修正後 + 全件 PASS
- [ ] **特に `PermanentDeleteConfirm.test.tsx`** で `isOpen` → `open` リネーム反映済み
- [ ] `pnpm test --run` 全件 PASS、件数 390 件前後(M6-04 時点 380 件 + 本 M7-01 追加 10〜15 件)
- [ ] `pnpm build` エラーなし
- [ ] `pnpm dev` エラーなし
- [ ] E2E シナリオ動作確認は **別ファイル(`m7-01-e2e-scenarios.md` 相当)** で開発者が実施する想定(本指示書スコープ外、本機械レビューでも対象外)

---

## 9. 構造的アンチパターン再発なし(retrospective-log v1.0.22 §1 + §6)

### 9.1 retrospective-log §1 構造的アンチパターン
- [ ] §1.1 統合エディタの直接編集パターン: shadcn/ui 移行時にロジック処理を直接埋め込んでいない(分離パターン逸脱の **新規発生** なし、既存逸脱は維持で M7-02 解消)
- [ ] §1.2 実コード確認の省略: §3.4.2 / §3.4.3 で 17 件 + 18 件 view 確認完了済み
- [ ] §1.3 ジェネリック化のしすぎ: Header.tsx で過剰な汎用化なし(NAV_LINKS は固定配列 + sticky のみ Props 化)
- [ ] §1.4 並行作業の同期不整合: 本指示書は単独着手(並列性なし)
- [ ] §1.5 Migration の前置忘れ: 本指示書はバックエンド変更なし
- [ ] §1.6 設計書本体・既存実装の整合確認漏れ: §3.4.9 対応表 5 表で完全網羅、M6-3/4/5/6 連続発生の再発なし

### 9.2 retrospective-log §6 各反省踏襲
- [ ] §6.6 M7 着手後課題(M7-RESEARCH-01 由来の自作ラッパー想定数誤差等)が指示書本体で反映済み
- [ ] M6-3 / M6-4 / M6-5 / M6-6 反省(設計書本体表示項目 + 既存実装実態の対応表確認漏れ)= 対応表 5 表で再発防止
- [ ] M6-2 反省(Plan Mode 必須項目の明示列挙漏れ)= 必須項目 8 件で再発防止
- [ ] M5-1 反省(設計書本体・補足資料の確認漏れ)= 案 A 採用判断で再発防止

---

## 10. 重大判定 / 軽微判定

### 10.1 重大欠陥(完了承認保留)

以下に該当する場合は **重大欠陥** = 機械レビュー完了承認保留 + 製造担当に再実装依頼:

- 設計書本体(REQ-001 / DES-001〜DES-006)が改変されている(CHANGE 通知書未起票での改変)
- 補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)が改変されている
- 新規 CHANGE 通知書が起票されている(本指示書スコープ内では起票見込みなしと宣言)
- 既存機能(M1〜M6)の回帰がある
- スコープ外コンポーネントの shadcn/ui 化(Form / Toast / Button / Tooltip / Badge / Card / Table / List 系のいずれかが M7-02 を待たず移行されている)
- C-2 / C-3 / C-4 が解消されている(M7-02 スコープ侵食)
- 分離パターン逸脱 4 件(LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の `useMutation` / 内部バリデーション)の **解消が誤って実装されている**(本 M7-01 では維持が正)
- **Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)に Header が追加されている**(案 A 違反)
- PromoteToFinalButton が独立コンポーネント化されている(M7-02 スコープ侵食)
- ModifiersEditor の `console.warn` が削除されている(P-01 別観点、本 M7-01 では触らない)
- バックエンド変更がある(handler / service / repository / model / migration / config / netutil)
- `pnpm test --run` で失敗テストが存在
- `pnpm build` または `pnpm dev` でエラー発生
- `window.confirm` が **完全削除されていない**(SetupAccordionItem で残存)
- 17 件移行のうち **shadcn/ui 化されていない** ものが残存(部分実装、ハイブリッド状態)
- Header 共通化対象 7 ページのうち **インライン `<header>` が残存** している
- Props 命名是正が **未完了**(`isOpen` 残存、`onClose` / `onCancel` の `onOpenChange` 未置換)
- 対応表 5 表(§3.4.9 A〜E)が **完全に埋まっていない**(Plan Mode 計画提示時)
- Plan Mode 必須項目 8 件のいずれかが **未確定** のまま実装着手されている

### 10.2 軽微欠陥(完了承認可、改善推奨)

以下は軽微な問題で、完了承認は可だが次回マイルストーン以降の改善対象として記録:

- §1.4 例外条項適用箇所の理由明記が不十分
- Tailwind クラス順序揺れ(機能には影響なし)
- shadcn/ui コンポーネントの import パス記述スタイルが既存コードと微妙に異なる
- Header.tsx の Tailwind クラス細部が指示書 §4.2.3 概形例と完全一致しない(機能 + UX に影響なければ軽微、`max-w-7xl` / `h-14` / `gap-4` 等のサイズ調整含む)
- コメント不足(shadcn/ui CLI 生成コード以外の部分)
- テストの assert メッセージが指示書記載例と異なる(網羅性が確保されていれば軽微)
- 完了報告書の節構成 / 文体が過去マイルストーンと完全一致しない

### 10.3 質問フォーマット(レビュー時の指摘形式)

```
[Major / Minor] <該当節>: <観点>
該当ファイル: <ファイルパス + 行番号>
事実: <コードの状態>
判定根拠: <指示書のどの節 + retrospective-log のどのアンチパターン>
修正案: <具体提案>
```

---

## 11. レビュー報告書フォーマット

機械レビュー完了時に以下を含む報告書を `docs/progress/m7-01-review.md` として出力:

```markdown
# M7-01 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ / ⚠️ / ❌ §1 ファイル一覧(新規 + 修正 + スコープ外無変更 + 例外条項)
- ✅ / ⚠️ / ❌ §2 着手前確認結果(§3.4.1〜§3.4.10、特に §3.4.9 対応表 5 表 + §3.4.10 必須項目 8 件)
- ✅ / ⚠️ / ❌ §3 shadcn/ui 初期化の妥当性
- ✅ / ⚠️ / ❌ §4 17 件移行の妥当性
- ✅ / ⚠️ / ❌ §5 Header 共通化 + ハンバーガーの妥当性(特に Header 非表示 4 ページ現状維持 = 案 A)
- ✅ / ⚠️ / ❌ §6 Props 命名是正の妥当性
- ✅ / ⚠️ / ❌ §7 モーダル実装パターン分裂解消 + window.confirm 除去
- ✅ / ⚠️ / ❌ §8 テスト要件
- ✅ / ⚠️ / ❌ §9 構造的アンチパターン再発なし

## 3. 対応表 5 表(§3.4.9)+ Plan Mode 必須項目 8 件(§3.4.10)の確認(最重要)
- 表 A(shadcn/ui 初期化対応): ○ / ×
- 表 B(自作ラッパー 17 件 ↔ shadcn/ui 対応): ○ / ×
- 表 C(モーダル実装パターン分裂解消): ○ / ×
- 表 D(Header 共通化対応): ○ / ×
- 表 E(ハンバーガー化対応): ○ / ×
- Plan Mode 必須項目 1〜8(質問書ファイル方式で実施): ○ / ×

## 4. Header 非表示 4 ページ現状維持(案 A)の確認(最重要)
- ComboEditorPage への Header 追加なし: ○ / ×
- SetupEditorPage への Header 追加なし: ○ / ×
- WizardPage への Header 追加なし: ○ / ×
- HomePage への Header 追加なし: ○ / ×

## 5. スコープ外への変更がないことの確認(最重要)
- 設計書本体 / 補足資料の無変更: ○ / ×
- Form / Toast / Button / Tooltip / Badge / Card / Table / List 系の無変更: ○ / ×
- C-2 / C-3 / C-4 の無解消: ○ / ×
- 分離パターン逸脱 4 件の **維持**(誤って解消されていない): ○ / ×
- バックエンド全般の無変更: ○ / ×
- 新規 CHANGE 通知書起票なし: ○ / ×

## 6. 検出した問題

### 6.1 重大な問題(完了承認保留)
(該当する場合、§10.1 判定基準のどれに該当するか明記)

### 6.2 軽微な問題(完了承認可、改善推奨)
(該当する場合、§10.2 判定基準のどれに該当するか明記)

### 6.3 改善提案(次回マイルストーン以降)
(該当する場合、M7-02 / M7-03 / M7-05 / フェーズ 2/3 のいずれかのスコープへの送り先を明示)

## 7. 制約事項
- 本レビューは静的コードレビュー。**実機テスト(E2E シナリオ A〜H の開発者実機検証 + UX 評価 + ハンバーガー実機確認 + モバイル LAN 確認)は別ファイル(`m7-01-e2e-scenarios.md` 相当)で開発者が実施が必要**(playbook §14)
- 動作確認シナリオの手動確認は開発者の責任範囲

## 8. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
```

---

*以上、M7-01 機械レビューチェックリスト v1.0.0*
