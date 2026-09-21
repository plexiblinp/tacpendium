# M7-02 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M7-02: shadcn/ui 統一導入 系統 A 後半(Form + Toast + その他) + C-2/C-3/C-4 解消 + 分離パターン逸脱 4 件整理 + List API 拡張 + ComboDetailMetadata 表示項目整合 v1.0.0 |
| バージョン | 1.0.1 |
| 推奨モデル | Sonnet 4.6(機械レビュー)|
| 役割 | M7-02 の実装が指示書通りか + 構造的問題がないかを機械的に検査する。**実機テスト + E2E シナリオ実行は別途実施が必要**(`m7-02-e2e-scenarios.md` で開発者が実行)|
| 作成日 | 2026-05-30 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-30 | 初版作成。M7-02 指示書 v1.0.0 に対応。M7-01 機械レビューチェックリスト 12 章を 14 章に拡張(Toast 移行 + List API 拡張 + ロジックフック分離 + C-2/3/4 解消 + Q10〜Q15 反映確認の章を追加)|
| 1.0.1 | 2026-05-31 | M7-02 完了承認(2026-05-31)に伴う事後履歴整合修正。Plan Mode 反問 3 件確定(C-2 β / 必須項目 5 b / C-4 HomePage 除外)+ Q16〜Q22 確定事項 + Q22 案 A `api.ts` 修正の反映。§1.1 ファイル一覧チェック、§4 自作ラッパー 9 件移行、§7 分離パターン逸脱、§8 C-2/3/4 解消、§9 指摘 6 軸、§14.1 重大欠陥列挙 を修正 + §16「Q22 案 A 修正反映確認」新規章を追加 |

---

## 0. レビュー実施前の確認

- [ ] M7-02 指示書 v1.0.0 を読了している
- [ ] M7-01 完了承認(2026-05-27)+ M7-RESEARCH-03 完了報告(2026-05-30)を確認している
- [ ] CHANGE-018 v1.0.1 反映済み + DES-005 v2.11.0 を確認している
- [ ] playbook v1.9.0 §4.6 / §4.9 / §8.4 / §17.2 を確認している
- [ ] architecture-patterns v1.0.8 §1(プレ層/ロジック層分離)+ §1.1(queryKey 規約)+ **§1.2 shadcn/ui 統一導入パターン**(M7-01 確立、本 M7-02 で適用継続)+ **§7 Dialog scroll 制約パターン候補**(本 M7-02 で正式化判断)を確認している
- [ ] retrospective-log v1.0.24 §1 構造的アンチパターン + §6.6 M7 着手後課題 + §6.7 / §6.8 / §6.9 運用知見 + §7.2 M7-3 候補を確認している
- [ ] M7-overview v1.0.1 §2.3(案 β 採用)+ §4.4(M7-02 スコープ)を確認している
- [ ] **Plan Mode 質問書(`m7-02-plan-mode-questions.md` 等、必須項目 10 件)+ 開発者一括ご回答ファイル**を確認している(playbook v1.9.0 §8.4.2 = 必須項目 2 件以上で質問書ファイル方式必須)

---

## 1. ファイル一覧チェック(指示書 §2.1 / §2.2 / §2.3 / §2.4)

### 1.1 新規作成ファイル(§2.1)

#### shadcn/ui 追加コンポーネント
- [ ] `web/src/components/ui/form.tsx` が新設されている(react-hook-form ベース)
- [ ] `web/src/components/ui/input.tsx` が新設されている
- [ ] `web/src/components/ui/label.tsx` が新設されている
- [ ] `web/src/components/ui/button.tsx` が新設されている
- [ ] `web/src/components/ui/badge.tsx` が新設されている
- [ ] `web/src/components/ui/card.tsx` が新設されている
- [ ] `web/src/components/ui/table.tsx` が新設されている
- [ ] `web/src/components/ui/sonner.tsx`(または相当の Toast コンポーネント)が新設されている(Plan Mode 必須項目 2 候補 (a) 確定時)
- [ ] `web/src/components/ui/switch.tsx`(必須項目 1 で必要時のみ)
- [ ] `web/src/components/ui/tooltip.tsx`(必須項目 1 で必要時のみ)
- [ ] 追加された shadcn/ui コンポーネントは shadcn/ui CLI 生成内容のまま(独自カスタマイズなし、案 β 準拠、architecture-patterns v1.0.8 §1.2.1)
- [ ] 例外: §3.4.10 必須項目 3 で候補 (a) 採用時のみ `dialog.tsx` の DialogContent デフォルトスタイル拡張 = `max-h-[85vh] overflow-y-auto` 追加(§2.4 例外条項 (k))

#### 分離パターン逸脱解消のロジックフック新設
- [ ] `web/src/features/setup/hooks/useLinkExistingSetupForm.ts` が新設されている(D-1)
- [ ] `web/src/features/setup/hooks/useSetupAccordionActions.ts` が新設されている(D-2)
- [ ] `web/src/features/tag/hooks/useTagSelectorForm.ts` が新設されている(D-3)
- [ ] `web/src/features/tag/hooks/useTagFormDialog.ts` が新設されている(D-4)
- [ ] 上記 4 件の配置 + 命名が §3.4.10 必須項目 7 確定どおり

#### C-2 共通フック新設(候補 (β) 確定 = 現状維持)
- [ ] **C-2 共通フックは新設されていない**(候補 (β) 現状維持確定、retrospective-log v1.0.25 §6.6 M7-9)
- [ ] ステップ変換ロジックが RecipeBuilder + SetupRecipeEditor の各ハンドラに分散する現状実装が **承認**(変更なし)

#### ブラウザセッション保持フック(指摘 6 軸 F-3)
- [ ] `web/src/hooks/useSessionStorage.ts`(自作採用時)が新設されている、または既存ライブラリの導入

#### テスト
- [ ] 上記 4 ロジックフック + C-2 共通フック + useSessionStorage 各の単体テストが新設されている
- [ ] SetupTreeRow 本実装テストが新設されている

### 1.2 修正ファイル(§2.2)

#### A. 自作ラッパー 9 件 → shadcn/ui ベース差し替え

##### Form/Field 系 3 件
- [ ] `combo/ComboListFilters.tsx` 同上、**native `<select>` 7 件は維持**(同上の Radix Select 制約理由)、ステートレス維持
- [ ] `setup/SetupBasicInfoForm.tsx` 同上、`useQuery`(キャラ名取得)維持
- [ ] `combo/ComboListFilters.tsx` 同上、ステートレス維持

##### Badge/Display 系 2 件
- [ ] `tag/TagBadgeList.tsx` が shadcn/ui `badge` ベースに移行、Props 契約維持
- [ ] `combo/ValidationDisplay.tsx` が shadcn/ui `card` + `badge` ベースに移行、Props 契約維持

##### Table/List 系 4 件
- [ ] `combo/ComboTable.tsx` が shadcn/ui `table` + `checkbox` ベースに移行、**指摘 6 軸 F-3 連携完了**(展開アイコン条件表示 + ブラウザセッション保持、useState → useSessionStorage)
- [ ] `combo/CompareTable.tsx` 同上、ステートレス維持
- [ ] `combo/TrashList.tsx` 同上、`useState`(indeterminate 制御)維持
- [ ] `tag/TagListTable.tsx` 同上、**M7-01 追加タスクで実装したシステムタグ表示制御(`category === "mycombo_status"` で編集・削除ボタン非表示)= 温存** 確認

#### B. Modal 内 input / label / textarea の shadcn/ui 化(M7-01 で温存した部分)
- [ ] `tag/TagFormDialog.tsx` 内の `<input>` / `<label>` が shadcn/ui Form + Input + Label に置換(D-4 統合実施)
- [ ] `combo/ModifiersEditor.tsx` 内に input / label の残存があれば置換、`useState`×3 + `useEffect`(notes 文字数警告)維持、**`console.warn` 残存(P-01)温存**
- [ ] `combo/KnockdownAdvantageChangeModal.tsx` 内の残存要素処理(対象なしの場合は確認のみ)

#### C. Toast 系の shadcn/ui 移行
- [ ] `App.tsx`(または相当)に `<Toaster />` 配置(sonner)
- [ ] M4-03 由来 topMessage パターンが sonner ベースに置換(完全削除確認)
- [ ] M5-01 由来活用パターン(保存完了 / セットプレイ引き継ぎ通知等)が sonner ベースに置換
- [ ] 既存 topMessage コンポーネント + 関連ファイルが削除されている
- [ ] `grep -rn "topMessage\|setMessage" web/src/` で 0 件(完全移行確認)

#### D. 分離パターン逸脱 4 件解消
- [ ] D-1: `setup/LinkExistingSetupModal.tsx` の `useCharacterSetups` + `useCreateSetupLink` が `useLinkExistingSetupForm.ts` に分離、コンポーネント本体は presentation-only
- [ ] D-2: `setup/SetupAccordionItem.tsx` の `useDeleteSetupLink` が `useSetupAccordionActions.ts` に分離
- [ ] D-3: `tag/TagSelector.tsx` の `useTagManagement().createMutation` + `useState`(creating)が `useTagSelectorForm.ts` に分離
- [ ] D-4: `tag/TagFormDialog.tsx` の `useState`×5 + `useEffect` + Zod バリデーション + onSubmit ロジックが `useTagFormDialog.ts` に分離(react-hook-form + zodResolver 統合)
- [ ] 各呼び出し元(ComboDetailPage / コンボ新規登録画面 / ComboEditorBasicFields / TagManagementPage)で hook 呼出 + Props 渡しに変更

#### E. C-2 / C-3 / C-4 解消

##### C-2(候補 (α) 確定時)
- [ ] ステップ変換ロジック(`StepInput` → `Step` / `SetupStepInput`)が共通フック(`useStepConverter.ts`)に集約
- [ ] RecipeBuilder.tsx + SetupRecipeEditor.tsx の各ハンドラから共通フック呼出に修正
- [ ] VirtualController の Props 契約は変更なし

##### C-3(候補 (γ) 確定時)
- [ ] LinkExistingSetupModal が **callback 委譲方式に統一**(`onSelect: (setupId: number) => void`)、内部 mutation 完結を廃止(D-1 と整合)
- [ ] SetupSelectorModal は既存 callback 委譲方式維持
- [ ] 呼び出し元 ComboDetailPage / コンボ新規登録画面で `useLinkExistingSetupForm.handleSelect` を `onSelect` callback として渡す
- [ ] **コンポーネント本体の 1 つ化(統合)は実施されていない**(命名 + Props 差異は責務文脈で残す、過剰統合回避、§8.2 既明示)

##### C-4(候補 (ε) 確定時)
- [ ] `setup.defaultRecipe` 条件描画 9 ファイル × 15 箇所がパターン 2(`{value || "..."}`)に統一
- [ ] フォールバック文字列が統一されている(推奨「(レシピなし)」、SetupAccordionItem 既存値と整合)
- [ ] パターン 1 由来 2 箇所(SetupRegistrationSection.tsx:96-98 / SetupCandidateList.tsx:51-53)修正済み
- [ ] パターン 3 由来 2 箇所(LinkExistingSetupModal:86 / SetupSelectorModal:78)修正済み

#### F. 指摘 6 軸: SetupTreeRow 本実装 + List API レスポンス拡張

##### F-1: List API レスポンス拡張(バックエンド)
- [ ] `repository.go` の List クエリで `combo_setups` テーブルが LEFT JOIN または別クエリで取得されている(候補 (a)/(b) 確定どおり、N+1 回避設計)
- [ ] `handler.go` の `toComboResponse(combo, setups)` 呼出で setups を渡す形に変更
- [ ] `ComboResponse.Setups` JSON タグ `json:"setups"` 維持(omitempty 追加なし)
- [ ] List API レスポンスに setups フィールドが含まれる(空配列 `[]` 含む実値返却、現状 `null` から変更)
- [ ] バックエンド単体テストで List API の setups フィールド返却が検証されている

##### F-2: SetupTreeRow 本実装
- [ ] Props 拡張: `{ setups: SetupResponse[]; colSpan: number; onSetupClick?: (setupId: number) => void; }`
- [ ] DES-005 §5.4 表示例整合: `└ セットプレイ名 [レシピ]` インデント付き表示
- [ ] setups.length === 0 時は本コンポーネント自体を呼出元で非表示(展開アイコン条件表示と連動)
- [ ] フォールバック文字列「(レシピなし)」が C-4 統一と整合

##### F-3: 展開アイコン条件表示 + ブラウザセッション保持
- [ ] `ComboTable.tsx` または `ComboTableRow.tsx` の展開アイコン(`ChevronDown` / `ChevronRight`)が `combo.setups.length > 0` で条件表示(DES-005 §5.4 規定整合)
- [ ] 展開状態が `useState` → `useSessionStorage` に変更
- [ ] キー設計: `combo-list-expanded-ids-v1`(architecture-patterns v1.0.8 §5 ブラウザストレージ運用整合)
- [ ] `sessionStorage` 採用確認(`localStorage` ではない、DES-005 §5.4「ブラウザセッション内で保持」規定整合)

#### G. ComboDetailMetadata 表示項目変更(Q10 (X) 確定)
- [ ] `combo/components/ComboDetailMetadata.tsx`(または相当パス)の表示フィールドが `driveAvailableAtStart` / `saAvailableAtStart`(開始残量)に変更
- [ ] i18n キー値 `comboDetail.metadata.driveGauge` = "ドライブゲージ開始残量" / `comboDetail.metadata.saGauge` = "SAゲージ開始残量" に変更
- [ ] **i18n キー名(`driveGauge` / `saGauge`)自体は変更されていない**(値のみ変更、影響範囲限定)
- [ ] **バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム = 温存**(削除されていない、Q15 確定)
- [ ] **API レスポンスフィールド `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` = 温存**(削除されていない、Q15 確定)
- [ ] **フロント型定義 `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` フィールド = 温存**(削除されていない、Q15 確定)
- [ ] フィールド削除と表示変更が混同されていない(§8.2 既明示の重要観点)

#### H. 伝達 1 対応: TagSelector cmdk 再採用判断(必須項目 4)
- [ ] 候補 (θ) 不採用継続確定の場合: M7-01 代替実装(Popover + ネイティブ input + カスタムリスト)が維持されている
- [ ] 候補 (η) cmdk 再採用確定の場合: jsdom モック追加 + cmdk + Popover 構造への再変更が完了

#### I. 伝達 2 対応: Dialog scroll 制約パターン(必須項目 3)
- [ ] 候補 (c) 基本: リスト含む Dialog の内部リスト要素に `max-h-[60vh] overflow-y-auto` 適用
  - [ ] LinkExistingSetupModal(M7-01 修正済み、本実装で同方針継続)
  - [ ] AddComboToCompareModal
  - [ ] SetupSelectorModal
  - [ ] KnockdownAdvantageChangeModal(individual モード)
  - [ ] その他 §3.4.2 view 確認で発見されたリスト含む Dialog
- [ ] 候補 (a) fallback: `dialog.tsx` の DialogContent デフォルトスタイルに `max-h-[85vh] overflow-y-auto` 追加(例外条項 §2.4 (k))

### 1.3 スコープ外への変更がないこと(§2.3、最重要)

- [ ] **設計書本体(REQ-001 / DES-001〜DES-006)に変更がない**(M7-02 製造担当の対象外、最重要)
- [ ] **補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)に変更がない**(M7-02 製造担当の対象外、設計担当が完了承認後に retrospective-log v1.0.25 + architecture-patterns v1.0.9 を別タイミングで自由改訂)
- [ ] **新規 CHANGE 通知書が起票されていない**(本指示書スコープ内では起票見込みなし)
- [ ] **バックエンドキャッシュ計算(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` 自動集計関数)が実装されていない**(M7-04 Q11 γ-2 確定)
- [ ] **VAL-C06 / VAL-C07 のバリデーション復活が実装されていない**(M7-04 Q11 γ-2 確定、nil 早期 return 維持)
- [ ] **`moves` テーブルに `drive_gauge_increase` / `sa_gauge_increase` カラム追加が実装されていない**(M7-04 スコープ)
- [ ] **ComboDetailMetadata の「消費量」表示復活が実装されていない**(フェーズ 2 候補要望、Q15 確定)
- [ ] **R-1 / R-2 / R-3 関連のレスポンシブ仕上げが実装されていない**(M7-03)
- [ ] **残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久テストが含まれていない**(M7-04)
- [ ] **リファクタ + 統合 E2E + LAN 検証 + フェーズ 1 完了判定が含まれていない**(M7-05)
- [ ] M7-01 確立物への変更なし:
  - [ ] `web/src/components/ui/` 配下の既存 12 コンポーネント(`dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `popover.tsx` / `dropdown-menu.tsx` / `select.tsx` / `tabs.tsx` / `accordion.tsx` / `command.tsx` / `checkbox.tsx` / `radio-group.tsx` / `textarea.tsx`)= **変更なし**(例外: §2.4 (k) で許容された `dialog.tsx` の DialogContent デフォルトスタイル拡張のみ)
  - [ ] `web/src/components/Header.tsx`(M7-01 確立)= **変更なし**
  - [ ] `web/src/components/Footer.tsx`(M6-03 確立)= **変更なし**
  - [ ] `App.tsx` の `useIsMobile()` + リダイレクト分岐(M6-03 確立)= **変更なし**(Toaster 配置のみ追加許容)
  - [ ] Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)= **現状維持(案 A 確定継続)**
  - [ ] M7-01 追加タスクで実装したシステムタグ表示制御 = **温存**(削除されていない)
- [ ] ModifiersEditor の `console.warn` 残存(P-01)= **継続温存**(本 M7-02 でも触らない)
- [ ] PromoteToFinalButton の独立コンポーネント化が **実施されていない**(フェーズ 2 以降検討)
- [ ] Header 内追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)が **実装されていない**(フェーズ 2 以降)
- [ ] 本格スマホ UI(カード形式 / アコーディオン / ボトムシート / スワイプ)が **実装されていない**(フェーズ 3 以降)
- [ ] i18n 英語ロケール追加が **実装されていない**(日本語ラベル変更のみ許容)
- [ ] virtual-controller-layout-v1 ブラウザストレージが **実装されていない**(フェーズ 3 送り)
- [ ] 既存固定幅 3 件 + `overflow-x-auto` 横スクロール温存(本 M7-02 では触らない)
- [ ] 既存 routes 定義の変更なし

### 1.4 例外条項適用箇所のチェック(§2.4)

- [ ] (a) 依存追加が `react-hook-form` / `@hookform/resolvers` / `sonner` / `@radix-ui/react-tooltip` / `@radix-ui/react-switch` 等の範囲内、Plan Mode 必須項目 1 で承認済み
- [ ] (b) shadcn/ui 追加コンポーネント新設 9 件程度
- [ ] (c) ロジックフック 4 件新設(D-1 / D-2 / D-3 / D-4)+ C-2 共通フック(候補 (α) 確定時)+ useSessionStorage
- [ ] (d) 自作ラッパー 9 件の shadcn/ui ベース差し替え + 呼び出し元修正
- [ ] (e) Modal 内 input / label / textarea の shadcn/ui 化(M7-01 で温存した部分)
- [ ] (f) Toast 系の shadcn/ui 移行
- [ ] (g) C-2 / C-3 / C-4 解消
- [ ] (h) List API レスポンス拡張 + SetupTreeRow 本実装
- [ ] (i) ComboDetailMetadata 表示項目変更 + i18n ラベル変更
- [ ] (j) Dialog scroll 制約パターン適用
- [ ] (k) `dialog.tsx` の DialogContent デフォルトスタイル拡張(候補 (a) 採用時のみ)

---

## 2. 着手前確認結果のチェック(指示書 §3.4)

製造担当の作業報告に以下の確認結果が **すべて含まれている** こと:

### 2.1 §3.4.1 既存ファイル構造の確認
- [ ] `web/package.json` の現状依存確認(M7-01 完了後の状態 = `@radix-ui/react-*` 12 件 + 関連依存確認)
- [ ] `web/tailwind.config.js` の現状確認(M7-01 反映状態維持確認)
- [ ] `web/src/components/ui/` 配下の現状確認(M7-01 で生成された 12 コンポーネント存在確認)
- [ ] `web/src/lib/utils.ts` の `cn()` 関数の現状確認(M7-01 確立、変更不要)
- [ ] `web/src/components/Header.tsx` / `Footer.tsx` の現状確認(変更不要)

### 2.2 §3.4.2 既存自作ラッパー 9 件 + Modal 内残存要素の view 確認(3 点セット)
- [ ] 9 件すべての構造 + 責務 + Props の 3 点セット view 確認結果
- [ ] M7-RESEARCH-01 §4.2 (b) + M7-01 完了状態との一致 / 差分を明示
- [ ] TagFormDialog / ModifiersEditor / KnockdownAdvantageChangeModal 内の input / label / textarea 残存箇所の view 確認

### 2.3 §3.4.3 既存呼び出し元 + 分離パターン逸脱 4 件の view 確認
- [ ] LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の view 確認
- [ ] 各コンポーネント内部 `useMutation` / `useQuery` / `useState` / Zod の完全列挙
- [ ] 呼び出し元(ComboDetailPage / コンボ新規登録画面 / ComboEditorBasicFields / TagManagementPage)の view 確認

### 2.4 §3.4.4 C-2 / C-3 / C-4 関連の view 確認
- [ ] C-2: VirtualController / RecipeBuilder / SetupRecipeEditor の view 確認
- [ ] C-3: LinkExistingSetupModal / SetupSelectorModal の責務差異確認
- [ ] C-4: 9 ファイル × パターン 1/2/3 混在の view 確認(15 箇所)

### 2.5 §3.4.5 指摘 6 軸 SetupTreeRow + List API の現状確認
- [ ] SetupTreeRow.tsx の現状(プレースホルダー実装)view 確認
- [ ] ComboTable.tsx / ComboTableRow.tsx の view 確認
- [ ] バックエンド repository.go の List クエリ + handler.go の view 確認

### 2.6 §3.4.6 ComboDetailMetadata 現状 + Q10 変更対象の view 確認
- [ ] ComboDetailMetadata.tsx の view 確認
- [ ] フロント型定義 + i18n キーファイル + バックエンドモデル + handler レスポンス DTO の view 確認

### 2.7 §3.4.7 Toast 系現状 + shadcn/ui Toast 移行対象の特定
- [ ] `grep -rn "topMessage\|showToast\|setMessage" web/src/` 結果
- [ ] M4-03 / M5-01 由来パターンの全件特定

### 2.8 §3.4.8 shadcn/ui 追加コンポーネント + 依存追加の事前確認
- [ ] 公式ドキュメント確認結果
- [ ] `pnpm dlx shadcn-ui@latest add` の対話入力項目 + 自動追加依存の事前列挙
- [ ] react-hook-form + zod 統合パターンの確認結果

### 2.9 §3.4.9 対応表 6 表完全埋め確認(最重要)
- [ ] 表 A: shadcn/ui 追加コンポーネント対応表(全行埋め)
- [ ] 表 B: 自作ラッパー 9 件 ↔ shadcn/ui 対応表(全行埋め、§2.2 A 表)
- [ ] 表 C: 分離パターン逸脱 4 件 → ロジックフック分離対応表
- [ ] 表 D: C-2 / C-3 / C-4 解消対応表
- [ ] 表 E: 指摘 6 軸 List API 拡張対応表
- [ ] 表 F: ComboDetailMetadata 表示項目変更対応表

### 2.10 §3.4.10 Plan Mode 必須項目 10 件確定確認(最重要)
- [ ] **質問書ファイル方式で実施されている**(playbook v1.9.0 §8.4.2、必須項目 2 件以上で質問書方式必須)
- [ ] 必須項目 1: shadcn/ui 追加コンポーネント `add` 対象 + 依存追加の確定
- [ ] 必須項目 2: shadcn/ui Toast 採用方式(sonner / 旧 Toast)
- [ ] 必須項目 3: Dialog scroll 制約パターン適用方針(候補 a / b / c)
- [ ] 必須項目 4: TagSelector cmdk 再採用判断(候補 η / θ)
- [ ] 必須項目 5: List API レスポンス拡張の N+1 回避設計(候補 a / b)
- [ ] 必須項目 6: Toast 移行対象の最終特定
- [ ] 必須項目 7: 分離パターン逸脱 4 件解消の新設ロジックフック命名 + 配置
- [ ] 必須項目 8: C-2 解消方針(候補 α / β)
- [ ] 必須項目 9: C-3 解消方針(候補 γ / δ)
- [ ] 必須項目 10: C-4 + 指摘 6 軸 F-3 ブラウザセッション保持の統合確定

---

## 3. shadcn/ui 追加コンポーネント導入の妥当性(指示書 §4.1)

### 3.1 依存追加 + `add` 実行
- [ ] §2.2 D の依存リストが `pnpm add` で正しく追加されている
- [ ] 不要な追加依存が含まれていない

### 3.2 Toast 初期化(sonner)
- [ ] `App.tsx` に `<Toaster />` 配置
- [ ] 表示位置(`position` Props)が M4-03 既存 UX と整合

### 3.3 ビルド + 起動確認
- [ ] `pnpm build` エラーなし
- [ ] `pnpm dev` エラーなし
- [ ] `go test ./...` エラーなし
- [ ] `go build ./...` エラーなし

---

## 4. 自作ラッパー 9 件移行の妥当性(指示書 §4.2)

### 4.1 Form/Field 系 3 件
- [ ] shadcn/ui Form + react-hook-form 連携で再構築されている
- [ ] ネイティブ `<input>` / `<select>` / `<label>` が shadcn/ui Input / Select / Label に置換されている
- [ ] Props 契約は基本的に維持されている

### 4.2 Badge/Display 系 2 件
- [ ] shadcn/ui Badge / Card + Badge 構造で再構築されている
- [ ] Props 契約維持

### 4.3 Table/List 系 4 件
- [ ] shadcn/ui Table コンポーネント(`<Table>` / `<TableHeader>` / `<TableBody>` / `<TableRow>` / `<TableHead>` / `<TableCell>`)で再構築
- [ ] `<Checkbox>` 列は shadcn/ui Checkbox に置換(M7-01 で `checkbox.tsx` 導入済み)
- [ ] ComboTable: 指摘 6 軸 F-3 連携完了(展開アイコン条件表示 + ブラウザセッション保持)
- [ ] TagListTable: M7-01 追加タスクのシステムタグ表示制御温存

---

## 5. Modal 内 input / label / textarea の shadcn/ui 化の妥当性(指示書 §4.3)

- [ ] TagFormDialog 内 `<input>` / `<label>` が shadcn/ui Form + Input + Label に置換、内部状態は D-4 ロジックフックに分離
- [ ] ModifiersEditor 内残存要素処理、`useState`×3 / `useEffect` 維持、`console.warn` 残存温存(P-01)
- [ ] KnockdownAdvantageChangeModal 内残存要素処理(対象なしの場合は確認のみ)

---

## 6. Toast 移行の妥当性(指示書 §4.4)

- [ ] 既存 topMessage / showToast パターンが shadcn/ui Toast(sonner)API に置換
- [ ] M4-03 / M5-01 由来 UX(表示位置 / 表示時間 / アクションリンク)が維持
- [ ] 既存 topMessage コンポーネント + 関連ファイルが削除されている
- [ ] `grep -rn "topMessage" web/src/` 結果が 0 件

---

## 7. 分離パターン逸脱 4 件解消の妥当性(指示書 §4.5)

### 7.1 D-1: LinkExistingSetupModal
- [ ] `useCharacterSetups` + `useCreateSetupLink` が `useLinkExistingSetupForm.ts` に分離
- [ ] LinkExistingSetupModal が presentation-only に変更
- [ ] 呼び出し元 ComboDetailPage + コンボ新規登録画面で hook 呼出

### 7.2 D-2: SetupAccordionItem
- [ ] `useDeleteSetupLink` が `useSetupAccordionActions.ts` に分離
- [ ] SetupAccordionItem が presentation-only に変更
- [ ] 呼び出し元 ComboDetailPage で hook 呼出

### 7.3 D-3: TagSelector
- [ ] `useTagManagement().createMutation` + `useState`(creating)が `useTagSelectorForm.ts` に分離
- [ ] 呼び出し元 ComboEditorBasicFields で hook 呼出
- [ ] cmdk 再採用判断(必須項目 4)反映

### 7.4 D-4: TagFormDialog
- [ ] `useState`×5 + `useEffect` + Zod バリデーション + onSubmit ロジックが `useTagFormDialog.ts` に分離
- [ ] react-hook-form + zodResolver 統合パターン採用
- [ ] TagFormDialog が presentation-only に変更
- [ ] 呼び出し元 TagManagementPage で hook 呼出

---

## 8. C-2 / C-3 / C-4 解消の妥当性(指示書 §4.6)

### 8.1 C-2(候補 (β) 確定 = 現状維持)
- [ ] **共通フック(`useStepConverter.ts`)新設なし**(候補 (β) 現状維持確定)
- [ ] RecipeBuilder.tsx + SetupRecipeEditor.tsx のステップ変換ロジック分散状態が **承認**(変更なし)
- [ ] VirtualController の Props 契約は変更なし
- [ ] 判断根拠: `Step` / `SetupStepInput` の型構造差異が深く、共通化コスト > 利得(retrospective-log v1.0.25 §6.6 M7-9)

### 8.2 C-3(候補 (γ) 確定時)
- [ ] callback 委譲方式統一
- [ ] LinkExistingSetupModal の内部 mutation 完結廃止
- [ ] **コンポーネント本体の 1 つ化が実施されていない**(過剰統合回避、§8.2 既明示)

### 8.3 C-4(候補 (ε) 確定時 = パターン 2 統一)
- [ ] `setup.defaultRecipe` / `combo.defaultRecipe` 条件描画 9 ファイル × **8 箇所修正 + HomePage 1 箇所除外** がパターン 2 に統一(15 箇所のうち HomePage 除外確定 2026-05-30)
- [ ] フォールバック文字列「(レシピなし)」がコンボ / セットプレイ両方に統一(Q17 (M) 確定)
- [ ] パターン 1 由来 2 箇所(SetupRegistrationSection.tsx:96-98 / SetupCandidateList.tsx:51-53)修正済み
- [ ] パターン 3 由来 2 箇所(LinkExistingSetupModal:86 / SetupSelectorModal:78)修正済み
- [ ] **HomePage 1 箇所は現状維持**(`{combo.defaultRecipe || combo.starterMoveCode}` の starterMoveCode フォールバックは別 UX 意図、C-4 統一対象外、Q19 Plan Mode 反問 2026-05-30 確定)

---

## 9. 指摘 6 軸 SetupTreeRow + List API レスポンス拡張の妥当性(指示書 §4.7)

### 9.1 List API レスポンス拡張(バックエンド)
- [ ] List クエリで **`ListSetupsByComboIDs(comboIDs)` 一括取得 + Go 側結合(候補 (b) 2 クエリ方式確定)**(既存 Tags バッチロードパターン `combo_id IN(...)` と整合、retrospective-log v1.0.25 §6.6 M7-10)
- [ ] N+1 クエリ回避達成(コンボ数 N に対して **2 クエリ固定**、サーバーログで確認、コンボ数 N が増えてもクエリ数は 2 固定)
- [ ] `handler.go` の `toComboResponse(combo, setups)` 呼出で setups を渡す
- [ ] `ComboResponse.Setups` JSON タグ `json:"setups"` 維持
- [ ] レスポンスに setups フィールドが含まれる(空配列含む実値)
- [ ] バックエンド単体テストで setups フィールド返却検証

### 9.2 SetupTreeRow 本実装
- [ ] DES-005 §5.4 表示例整合(`└ セットプレイ名 [レシピ]` インデント付き)
- [ ] Props 拡張: `setups` / `colSpan` / `onSetupClick?`
- [ ] setups.length === 0 時の表示制御(呼出元で非表示)
- [ ] クリック時のセットプレイ編集画面遷移
- [ ] フォールバック文字列「(レシピなし)」が C-4 統一と整合

### 9.3 展開アイコン条件表示 + ブラウザセッション保持
- [ ] 展開アイコンが `combo.setups.length > 0` で条件表示
- [ ] 展開状態が `useState` → `useSessionStorage` に変更
- [ ] キー: `combo-list-expanded-ids-v1`
- [ ] `sessionStorage` 採用(`localStorage` ではない)

---

## 10. ComboDetailMetadata 表示項目変更の妥当性(指示書 §4.8)

- [ ] 表示フィールドが `driveAvailableAtStart` / `saAvailableAtStart`(開始残量)に変更
- [ ] i18n キー値が "ドライブゲージ開始残量" / "SAゲージ開始残量" に変更
- [ ] **i18n キー名(`driveGauge` / `saGauge`)自体は変更されていない**
- [ ] **バックエンドカラム + API レスポンスフィールド + フロント型定義の `*ConsumedTotal` 系は温存**(削除なし、Q15 確定)

---

## 11. 伝達 1 / 伝達 2 対応の妥当性(指示書 §4.9 / §4.10)

### 11.1 伝達 1: TagSelector cmdk 判断
- [ ] 候補 (θ) 不採用継続 = M7-01 代替実装維持、または候補 (η) 再採用 = cmdk 再導入
- [ ] Plan Mode 必須項目 4 確定どおり

### 11.2 伝達 2: Dialog scroll 制約パターン
- [ ] 候補 (c): リスト含む Dialog(LinkExistingSetupModal / AddComboToCompareModal / SetupSelectorModal / KnockdownAdvantageChangeModal individual モード等)の内部リスト要素に `max-h-[60vh] overflow-y-auto` 適用
- [ ] 候補 (a) fallback: `dialog.tsx` の DialogContent デフォルトスタイル拡張(`max-h-[85vh] overflow-y-auto`)
- [ ] 二段構え採用が完了

---

## 12. テスト要件の充足(指示書 §5)

- [ ] 新規追加テスト全件 PASS(ロジックフック 4 件 + C-2 共通フック + useSessionStorage + SetupTreeRow 本実装)
- [ ] 既存テスト修正後 + 全件 PASS
- [ ] `pnpm test --run` 全件 PASS(420〜450 件前後)
- [ ] `go test ./...` 全件 PASS(List API 拡張テスト含む)
- [ ] `pnpm build` + `pnpm dev` エラーなし
- [ ] `go build ./...` エラーなし

---

## 13. 構造的アンチパターン再発なし(retrospective-log v1.0.24 §1 + §6 + §7.2)

### 13.1 retrospective-log §1 構造的アンチパターン
- [ ] §1.1 統合エディタの直接編集パターン: ロジックを直接埋め込まず、ロジックフック分離が完了(本 M7-02 の中核成果)
- [ ] §1.2 実コード確認の省略: §3.4.2〜§3.4.7 で全対象の view 確認完了
- [ ] §1.3 ジェネリック化のしすぎ: ロジックフック 4 件は各コンポーネント専用(過剰汎化なし)、useSessionStorage のみ汎用
- [ ] §1.4 並行作業の同期不整合: 本指示書は単独着手
- [ ] §1.5 Migration の前置忘れ: 本指示書はバックエンド変更を含む(List API 拡張)が、SQL の DDL 変更はなし(JOIN クエリ追加のみ、マイグレーション不要)
- [ ] §1.6 設計書本体・既存実装の整合確認漏れ: 対応表 6 表で完全網羅、M6-3/4/5/6 + M7-5 連続発生の再発なし

### 13.2 retrospective-log §6 / §7.2 各反省踏襲
- [ ] §6.6 M7 着手後課題: 持ち越し課題 4 件(指摘 1 / 指摘 6 / 伝達 1 / 伝達 2)の処理状況 = 指摘 1 軸問題 b + 指摘 6 軸 + 伝達 1 + 伝達 2 を本 M7-02 で解消、指摘 1 軸問題 a/d は M7-04 へ繰り送り
- [ ] §6.9 CHANGE-018 起票運用知見: 本 M7-02 では新規 CHANGE 起票なし、運用維持
- [ ] §7.2 M7-3 候補: 分離パターン逸脱 4 件解消(本 M7-02 で完了)+ Dialog scroll 制約パターン正式化(M7-02 完了承認時に architecture-patterns v1.0.9 で実施)= M7-3 候補のクローズ判断材料

### 13.3 M7-5 反省踏襲(設計書本体節タイトル多モード性確認)
- [ ] 本 M7-02 は設計書本体改訂を含まない(M7-5 のような節タイトル多モード性見落としは発生しえない)
- [ ] DES-005 §5.4 / §5.6 / §5.7 等の節タイトルが「複数モード / 複数対象 / 複数機能」を扱う場合の解釈は §3.4 着手前確認で完了済み

---

## 14. 重大判定 / 軽微判定

### 14.1 重大欠陥(完了承認保留)

以下に該当する場合は **重大欠陥** = 機械レビュー完了承認保留 + 製造担当に再実装依頼:

- 設計書本体(REQ-001 / DES-001〜DES-006)が改変されている(CHANGE 通知書未起票での改変)
- 補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)が改変されている
- 新規 CHANGE 通知書が起票されている(本指示書スコープ内では起票見込みなし)
- 既存機能(M1〜M6 + M7-01)の回帰がある
- スコープ外コンポーネントの shadcn/ui 化または機能追加(Header 追加要素 / 本格スマホ UI / i18n 英語ロケール等が M7-03 / M7-04 / M7-05 / フェーズを待たず実装)
- **バックエンドキャッシュ計算実装が含まれている**(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` 自動集計関数、M7-04 スコープ侵食、重大)
- **VAL-C06 / VAL-C07 のバリデーション復活が含まれている**(M7-04 スコープ侵食、重大)
- **`moves` テーブルに `drive_gauge_increase` / `sa_gauge_increase` カラム追加マイグレーションが含まれている**(M7-04 スコープ侵食、重大)
- **ComboDetailMetadata の「消費量」表示復活が含まれている**(フェーズ 2 候補要望逸脱、重大)
- **バックエンド `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド + フロント型定義の削除が含まれている**(Q15 温存方針違反、重大)
- 分離パターン逸脱 4 件解消で **新たな分離パターン逸脱が発生**(過剰汎化 / 別コンポーネントへのロジック侵食等)
- C-3 解消で **コンポーネント本体の 1 つ化(統合)が実施されている**(過剰統合、§8.2 違反)
- M7-01 確立物の変更(Header.tsx / Footer.tsx / shadcn/ui 既存 12 コンポーネント本体 / Header 非表示 4 ページ / システムタグ表示制御等)
- バックエンド変更が本指示書スコープ外(List API 拡張以外)に及んでいる
- `pnpm test --run` または `go test ./...` で失敗テストが存在
- `pnpm build` / `pnpm dev` / `go build ./...` でエラー発生
- `topMessage` / `showToast` が完全に削除されていない(部分的移行、ハイブリッド状態)
- 自作ラッパー 9 件のうち **shadcn/ui 化されていない** ものが残存(部分実装、ハイブリッド状態)
- Toast 移行が **未完了**(M4-03 / M5-01 由来パターンが残存)
- 対応表 6 表(§3.4.9 A〜F)が **完全に埋まっていない** 状態で Plan Mode 計画提示
- Plan Mode 必須項目 10 件のいずれかが **未確定** のまま実装着手
- **Plan Mode 質問書ファイル方式が実施されていない**(必須項目 2 件以上で必須、playbook v1.9.0 §8.4.2)
- 指摘 6 軸 List API レスポンス拡張で **N+1 クエリが発生している**(必須項目 5 確定方針違反)
- 展開状態が **`localStorage` で保持**(`sessionStorage` 必須、DES-005 §5.4 規定違反)
- **C-2 共通フック(`useStepConverter.ts`)が新設されている**(候補 (β) 現状維持確定違反、retrospective-log v1.0.25 §6.6 M7-9 由来、重大)
- **HomePage の `{combo.defaultRecipe || combo.starterMoveCode}` が `{combo.defaultRecipe || "(レシピなし)"}` に変更されている**(C-4 HomePage 除外確定違反、別 UX 意図破壊、重大)
- **N+1 クエリが発生している**(候補 (b) 2 クエリ方式違反、ListSetupsByComboIDs 不使用 / コンボごとに setups 個別 fetch / LEFT JOIN 採用、重大)
- **native `<select>` が Radix Select に置換されている**(Q16 (P) 確定違反、「(未指定)」プレースホルダー UX 機能停止、重大)
- **CompareTable のドライブ/SA 消費表示が "-" 以外に変更されている**(Q18 (S) 確定違反、行非表示や別ラベル変更は M7-04 スコープへの侵食、重大)
- **`api.ts:195-196` 周辺の `useUpdateComboWithKeyChange` の onSuccess が修正されていない**(Q22 案 A 確定違反、本セッション編入合意違反、重大)

### 14.2 軽微欠陥(完了承認可、改善推奨)

以下は軽微な問題で、完了承認は可だが次回マイルストーン以降の改善対象として記録:

- §1.4 例外条項適用箇所の理由明記が不十分
- Tailwind クラス順序揺れ
- shadcn/ui コンポーネント import パス記述スタイルが既存コードと微妙に異なる
- Toast の表示位置が M4-03 既存 UX と微妙に異なる(機能に影響なければ軽微)
- ロジックフック新設の命名が必須項目 7 確定方針と完全一致しない(機能に影響なければ軽微)
- フォールバック文字列「(レシピなし)」の用字が微妙に異なる(「（レシピなし）」全角括弧版等)
- コメント不足(shadcn/ui CLI 生成コード以外の部分)
- テストの assert メッセージが指示書記載例と異なる(網羅性が確保されていれば軽微)
- 完了報告書の節構成 / 文体が過去マイルストーンと完全一致しない

### 14.3 質問フォーマット(レビュー時の指摘形式)

```
[Major / Minor] <該当節>: <観点>
該当ファイル: <ファイルパス + 行番号>
事実: <コードの状態>
判定根拠: <指示書のどの節 + retrospective-log のどのアンチパターン>
修正案: <具体提案>
```

---

## 15. レビュー報告書フォーマット

機械レビュー完了時に以下を含む報告書を `docs/progress/m7-02-review.md` として出力:

```markdown
# M7-02 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ / ⚠️ / ❌ §1 ファイル一覧(新規 + 修正 + スコープ外無変更 + 例外条項)
- ✅ / ⚠️ / ❌ §2 着手前確認結果(§3.4.1〜§3.4.10、特に §3.4.9 対応表 6 表 + §3.4.10 必須項目 10 件)
- ✅ / ⚠️ / ❌ §3 shadcn/ui 追加コンポーネント導入の妥当性
- ✅ / ⚠️ / ❌ §4 自作ラッパー 9 件移行の妥当性
- ✅ / ⚠️ / ❌ §5 Modal 内要素の shadcn/ui 化
- ✅ / ⚠️ / ❌ §6 Toast 移行の妥当性
- ✅ / ⚠️ / ❌ §7 分離パターン逸脱 4 件解消の妥当性
- ✅ / ⚠️ / ❌ §8 C-2 / C-3 / C-4 解消の妥当性
- ✅ / ⚠️ / ❌ §9 指摘 6 軸 SetupTreeRow + List API レスポンス拡張の妥当性
- ✅ / ⚠️ / ❌ §10 ComboDetailMetadata 表示項目変更の妥当性
- ✅ / ⚠️ / ❌ §11 伝達 1 / 伝達 2 対応の妥当性
- ✅ / ⚠️ / ❌ §12 テスト要件
- ✅ / ⚠️ / ❌ §13 構造的アンチパターン再発なし

## 3. 対応表 6 表(§3.4.9)+ Plan Mode 必須項目 10 件(§3.4.10)の確認(最重要)
- 表 A〜表 F: ○ / ×(各)
- Plan Mode 必須項目 1〜10(質問書ファイル方式で実施): ○ / ×

## 4. Q10 (X) / Q11 (γ-2) / Q12 (P) / Q13 (η-1) / Q15 確定方針の遵守(最重要)
- Q10: ComboDetailMetadata 開始残量表示 + 消費量フィールド温存: ○ / ×
- Q11: バックエンドキャッシュ計算 + VAL-C06/C07 復活が含まれていない: ○ / ×
- Q12: List API レスポンス拡張(N+1 回避): ○ / ×
- Q13: 指摘 6 軸が M7-02 で解消: ○ / ×
- Q15: 消費量フィールド温存(削除なし): ○ / ×
- Q16 (P) native `<select>` 維持: ○ / ×
- Q17 (M) 「(レシピなし)」統一維持(コンボ + setup): ○ / ×
- Q18 (S) CompareTable "-" 現状維持: ○ / ×
- Q22 案 A api.ts 修正: ○ / ×

## 5. スコープ外への変更がないことの確認(最重要)
- 設計書本体 / 補足資料の無変更: ○ / ×
- M7-03 / M7-04 / M7-05 スコープに該当する変更なし: ○ / ×
- M7-01 確立物への変更なし: ○ / ×
- バックエンド変更が List API 拡張のみ: ○ / ×
- 新規 CHANGE 通知書起票なし: ○ / ×

## 6. 検出した問題

### 6.1 重大な問題(完了承認保留)
(該当する場合、§14.1 判定基準のどれに該当するか明記)

### 6.2 軽微な問題(完了承認可、改善推奨)
(該当する場合、§14.2 判定基準のどれに該当するか明記)

### 6.3 改善提案(次回マイルストーン以降)
(該当する場合、M7-03 / M7-04 / M7-05 / フェーズ 2/3 のいずれかのスコープへの送り先を明示)

## 7. 制約事項
- 本レビューは静的コードレビュー。**実機テスト + E2E 動作確認は `m7-02-e2e-scenarios.md` で開発者が実施**(本機械レビュー対象外、playbook §14)
- 動作確認シナリオの手動確認は開発者の責任範囲

## 8. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
- ✅ / ⚠️ / ❌ §16 Q22 案 A 修正反映確認
```

---

## 16. Q22 案 A 修正反映確認(M7-02 完了承認スコープ編入、本セッション 2026-05-31)

- [ ] `web/src/features/combo/api.ts:195-196` 周辺の `useUpdateComboWithKeyChange` の onSuccess が以下のとおり修正されている:
  - [ ] `qc.invalidateQueries({ queryKey: ["combo", id] })` 行が **削除されている**(旧 ID 論理削除済み = 404 になる原因の除去)
  - [ ] `qc.setQueryData(["combo", data.id], data)` 行が **追加されている**(新 ID のキャッシュをレスポンスデータで設定)
  - [ ] onSuccess の引数で `data` を受け取る形に変更(`onSuccess: (data) => {...}`)
- [ ] `qc.invalidateQueries({ queryKey: ["combos"] })`(コンボリスト全体)は **維持**(削除されていない)
- [ ] `useUpdateComboWithKeyChange.test.ts`(または相当)で以下のテストが追加されている:
  - [ ] 旧 ID の `invalidateQueries` が呼ばれていないことの確認
  - [ ] 新 ID の `setQueryData` が呼ばれていることの確認
  - [ ] `combos` リスト全体の `invalidateQueries` は維持されていることの確認
- [ ] バックエンドテストは変更なし(本修正はフロントのみ)
- [ ] VAL-C03 警告ダイアログ表示中の挙動: 数秒待機してもエラー画面に遷移しないことを実機確認(`m7-02-e2e-scenarios.md` シナリオ N で確認)

---

*以上、M7-02 機械レビューチェックリスト v1.0.0*
