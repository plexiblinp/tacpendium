# M7-02 実機動作確認シナリオ(E2E)

| 項目 | 内容 |
|------|------|
| 対応指示書 | M7-02 v1.0.0 |
| バージョン | 1.0.1 |
| 役割 | M7-02 製造完了 + 機械レビュー完了後の **実機動作確認** = 開発者が手動で実施。本文書は機械レビュー対象外(`M7-02-review-checklist.md` とは別役割)|
| 実施対象 | PC + スマホサイズ両方(スマホサイズは Chrome / Firefox / Safari DevTools のレスポンシブモードで `iPhone 12 Pro`(390×844) or `iPhone SE`(375×667) 等を選択)|
| 想定所要時間 | 60〜120 分(全シナリオ A〜L 通し)|
| 作成日 | 2026-05-30 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-30 | 初版作成。M7-02 指示書 v1.0.0 に対応、シナリオ A〜L の 12 系統で M7-02 スコープを網羅 |
| 1.0.1 | 2026-05-31 | M7-02 完了承認(2026-05-31)に伴う事後履歴整合修正。シナリオ G-1 (C-2 β 現状維持確定) / G-3 (C-4 HomePage 除外確定) の訂正、開発者 E2E 中の発見訂正(シナリオ E-3 = SetupAccordionItem 削除ボタンなし / シナリオ G-3 = レシピなしセットプレイ登録不可)、新規シナリオ N(Q22 案 A 修正確認)追加 |

---

## 0. 実機テスト実施前の準備

- [ ] M7-02 製造完了報告受領済み
- [ ] M7-02 機械レビュー完了承認受領済み(`docs/progress/m7-02-review.md` 確認)
- [ ] バックエンド + フロント両方の最新コードを pull
- [ ] `pnpm install`(フロント依存追加反映)+ `go mod download`(バックエンド依存反映、変更ある場合のみ)
- [ ] DB マイグレーションの確認(本 M7-02 は SQL DDL 変更なし = JOIN クエリ追加のみのためマイグレーション不要)
- [ ] バックエンド起動: `go run ./cmd/server`(または相当)= http://localhost:8080(または既定ポート)
- [ ] フロント起動: `cd web && pnpm dev` = http://localhost:3000(または既定ポート)
- [ ] テストデータの準備:
  - 既存セットプレイ紐付き済みコンボ(複数件)= 指摘 6 軸 SetupTreeRow 確認用
  - 既存セットプレイ紐付きなしコンボ(複数件)= 展開アイコン条件表示確認用
  - ドライブ/SA ゲージ「開始残量」が設定済みコンボ + 未設定コンボ = Q10 表示確認用
  - システムタグ + ユーザータグの両方が登録済み = M7-01 追加タスク維持確認用
  - 多数の候補セットプレイを持つキャラ = Dialog scroll 制約確認用

---

## シナリオ A: ビルド + 起動確認

### A-1: shadcn/ui 追加コンポーネント導入後のビルド + 起動
- [ ] `pnpm install` がエラーなく完了(react-hook-form / sonner / 関連 Radix UI 依存追加)
- [ ] `pnpm build` がエラーなく完了
- [ ] `pnpm dev` がエラーなく起動
- [ ] `go build ./...` がエラーなく完了
- [ ] `go run ./cmd/server` がエラーなく起動
- [ ] ブラウザで http://localhost:3000 アクセス → ホーム / コンボ一覧画面が正常表示

### A-2: コンソールエラーなし確認
- [ ] ブラウザ DevTools Console に React エラー / Warning がない(無視可能な開発時 Warning 除く)
- [ ] バックエンドのログにエラー / Panic がない

---

## シナリオ B: Form 系移行の動作確認(自作ラッパー Form/Field 3 件)

### B-1: ComboEditorBasicFields(コンボ編集画面のフォーム部分)
- [ ] コンボ新規登録画面 / コンボ編集画面でフォームフィールドが shadcn/ui Form ベースで表示
- [ ] 各フィールド(キャラ選択 / 始動技 / ダメージ / その他)の入力が動作
- [ ] バリデーションエラー時のエラーメッセージ表示が shadcn/ui FormMessage で表示
- [ ] フォーム送信(保存)で値が正しく POST/PATCH される

### B-2: SetupBasicInfoForm(セットプレイ編集画面のフォーム部分)
- [ ] セットプレイ編集画面 / 新規登録画面で shadcn/ui Form ベースの表示
- [ ] キャラ名取得(useQuery)が正常動作 + 表示
- [ ] 入力 + 保存が動作

### B-3: ComboListFilters(コンボ一覧画面のフィルタ)
- [ ] コンボ一覧画面のフィルタが shadcn/ui Select ベースで表示
- [ ] 複数の filter select が正常動作
- [ ] フィルタ適用でコンボ一覧が絞り込まれる
- [ ] フィルタリセットで全件表示に戻る
- [ ] 列表示設定(ColumnVisibility)が動作

---

## シナリオ C: Badge / Display 系移行の動作確認(2 件)

### C-1: TagBadgeList(タグバッジ表示)
- [ ] コンボ詳細画面 / コンボ一覧画面でタグバッジが shadcn/ui Badge ベースで表示
- [ ] `excludeCategories`(システムタグ非表示時)が動作
- [ ] `maxVisible`(最大表示数)が動作
- [ ] `size` Props(sm / md)が動作

### C-2: ValidationDisplay(バリデーション結果表示)
- [ ] コンボ編集画面でバリデーション警告 / エラーが shadcn/ui Card + Badge ベースで表示
- [ ] 警告アイコン / エラーアイコン(lucide-react)が表示
- [ ] バリデーション結果なし時は非表示

---

## シナリオ D: Table / List 系移行の動作確認(4 件)

### D-1: ComboTable(コンボ一覧画面のテーブル、最重要 = 指摘 6 軸統合)
- [ ] shadcn/ui Table コンポーネントで表示
- [ ] 列ヘッダ表示が正常
- [ ] 各行のデータ表示が正常
- [ ] チェックボックス列(選択モード時)が shadcn/ui Checkbox で動作
- [ ] **指摘 6 軸 F-3 確認**: 展開アイコン(`▶` / `▼`)が **セットプレイ紐付きコンボのみ** 表示される(紐付けなしコンボでは非表示)
- [ ] 展開アイコンクリックで SetupTreeRow が表示される
- [ ] SetupTreeRow に `└ セットプレイ名 [レシピ]` 形式でインデント表示
- [ ] レシピなしセットプレイは「(レシピなし)」表示(C-4 統一)
- [ ] **展開状態が `sessionStorage` で保持**: ページ遷移 → 戻ると展開状態が復元される
- [ ] **タブを閉じる → 再開すると展開状態がリセットされる**(`localStorage` ではない確認、DES-005 §5.4 規定整合)
- [ ] セットプレイ行クリックでセットプレイ編集画面に遷移

### D-2: CompareTable(コンボ比較画面のテーブル)
- [ ] shadcn/ui Table ベースで表示
- [ ] 比較対象コンボの並列表示が動作
- [ ] 削除ボタン(onRemove)が動作

### D-3: TrashList(ゴミ箱画面のテーブル)
- [ ] shadcn/ui Table + Checkbox ベースで表示
- [ ] 全選択チェックボックスの indeterminate 状態が動作(部分選択時 = 半チェック表示)
- [ ] 個別選択 → 全選択 → 全解除の状態遷移が動作

### D-4: TagListTable(タグ管理画面のテーブル、M7-01 追加タスク継承)
- [ ] shadcn/ui Table + Button ベースで表示
- [ ] **M7-01 追加タスクで実装したシステムタグ表示制御が温存**:
  - [ ] システムタグ(`category === "mycombo_status"`)行で **編集・削除ボタンが非表示**
  - [ ] 通常タグ行で編集・削除ボタンが表示
  - [ ] システムタグの存在自体は一覧表示(タグ名 / カテゴリ / 色 / 使用コンボ数)

---

## シナリオ E: Modal 内 Form 化 + Toast 移行の動作確認

### E-1: TagFormDialog(react-hook-form + zod + shadcn/ui Form 統合の新パターン、最重要)
- [ ] タグ管理画面で「新規タグ」ボタン → TagFormDialog が開く
- [ ] フォーム入力が shadcn/ui Form + Input + Label ベースで表示
- [ ] 入力中のリアルタイムバリデーション(zod 経由)が動作:
  - タグ名空欄 → 「タグ名を入力してください」表示
  - タグ名 50 文字超過 → 「50文字以内で入力してください」表示
  - カラーコード形式不正 → 「正しいカラーコードを入力してください」表示
- [ ] バリデーション通過 + 送信 → タグ追加成功 → **shadcn/ui Toast(sonner)で成功通知表示**
- [ ] サーバーエラー時 → Toast でエラー通知表示

### E-2: ModifiersEditor / KnockdownAdvantageChangeModal の動作確認(M7-01 で移行済み + 本 M7-02 で追加修正)
- [ ] ModifiersEditor の動作変化なし(M7-01 状態維持)
- [ ] KnockdownAdvantageChangeModal の動作変化なし(M7-01 状態維持)
- [ ] **ModifiersEditor の `console.warn` 残存温存確認**(notes 文字数超過時に console.warn が出る、P-01 別観点温存)

### E-3: Toast 移行確認(M4-03 / M5-01 由来全件、開発者 E2E 訂正反映 2026-05-31)
- [ ] コンボ保存完了 → shadcn/ui Toast(sonner)で「保存しました」等の成功通知表示
- [ ] エラー発生 → Toast で「エラーが発生しました」等のエラー通知表示
- [ ] セットプレイ引き継ぎ通知(M5-01 由来)→ Toast で表示
- [ ] **既存 topMessage コンポーネントが表示されない**(完全移行確認)

**訂正注記**: SetupAccordionItem には削除ボタンが **存在しない**(M7-01 完了報告 + 開発者 E2E 確認結果による訂正、2026-05-31)。本シナリオでは削除ボタン動作の確認項目を含めない。なお SetupAccordionItem からのセットプレイ削除操作(`useDeleteSetupLink`)は親 ComboDetailPage 側の他 UI 要素経由で実施される。

---

## シナリオ F: 分離パターン逸脱 4 件解消の動作確認

### F-1: LinkExistingSetupModal(D-1)
- [ ] コンボ詳細画面で「既存セットプレイから紐付け」ボタン → LinkExistingSetupModal が開く
- [ ] セットプレイ選択 → 紐付け成功 → Toast で通知 + コンボ詳細表示が更新
- [ ] 内部実装が `useLinkExistingSetupForm.ts` ロジックフック経由になっている(view 時のコード確認)
- [ ] **C-3 連動確認**: callback 委譲方式統一(`onSelect` callback で呼び出し元が後続処理)
- [ ] コンボ新規登録画面で「既存セットプレイから紐付け」ボタン(CHANGE-018「登録画面のみ」)→ 同様に動作

### F-2: SetupAccordionItem(D-2)
- [ ] コンボ詳細画面でセットプレイのアコーディオン展開 → 内容表示
- [ ] 削除ボタンクリック → shadcn/ui AlertDialog で確認(M7-01 で window.confirm 置換済み)
- [ ] 削除実行 → 削除成功 → コンボ詳細から該当セットプレイが消える
- [ ] 内部実装が `useSetupAccordionActions.ts` ロジックフック経由

### F-3: TagSelector(D-3)
- [ ] コンボ編集画面でタグ選択フィールド → TagSelector(Popover)展開
- [ ] 検索入力で候補絞り込み
- [ ] 既存タグ選択で適用
- [ ] **インライン新規タグ作成**(creating 状態経由)が動作 → タグ追加 → 適用
- [ ] 内部実装が `useTagSelectorForm.ts` ロジックフック経由
- [ ] **伝達 1 cmdk 判断確認**: 候補 (θ) 確定時 = M7-01 代替実装維持 / 候補 (η) 確定時 = cmdk + Popover 構造

### F-4: TagFormDialog(D-4、E-1 と統合確認)
- [ ] E-1 で確認した内容 + 内部実装が `useTagFormDialog.ts` ロジックフック経由

---

## シナリオ G: C-2 / C-3 / C-4 解消の動作確認

### G-1: C-2(VirtualController + ステップ変換ロジック、候補 (β) 現状維持確定)
- [ ] コンボ編集画面 + セットプレイ編集画面の両方で VirtualController からの入力 → レシピ追加が動作
- [ ] **ステップ変換ロジックは RecipeBuilder + SetupRecipeEditor の各ハンドラで分散実行**(共通フック経由ではない、候補 (β) 現状維持確定 2026-05-30)
- [ ] コンボ編集 + セットプレイ編集の両方で機能動作が正常(UX 上の差異は型構造差異の結果として許容、retrospective-log v1.0.25 §6.6 M7-9 + §6.10)
- [ ] VirtualController の Props 契約変更なし

### G-2: C-3(LinkExistingSetupModal + SetupSelectorModal 統合方式)
- [ ] F-1 で確認した内容 + コンボ新規登録画面の SetupSelectorModal 動作
- [ ] 両モーダルの責務が callback 委譲方式に統一
- [ ] **コンポーネント本体は 1 つに統合されていない**(別ファイル維持、過剰統合回避)

### G-3: C-4(`setup.defaultRecipe` / `combo.defaultRecipe` 条件描画統一、HomePage 除外確定 + 開発者 E2E 訂正反映 2026-05-31)
- [ ] コンボ一覧画面 / コンボ詳細画面 / コンボ比較画面 / SetupAccordionItem / SetupTreeRow 等、`setup.defaultRecipe` / `combo.defaultRecipe` を表示する画面で:
  - レシピなし → 「(レシピなし)」表示(統一フォールバック文字列)
  - レシピあり → レシピ表示
- [ ] パターン 1 由来 2 箇所(SetupRegistrationSection / SetupCandidateList)で空文字列が「(レシピなし)」になっている
- [ ] パターン 3 由来 2 箇所(LinkExistingSetupModal / SetupSelectorModal)で空文字列が「(レシピなし)」になっている
- [ ] **HomePage(スマホ専用ホーム画面)は除外**:`{combo.defaultRecipe || combo.starterMoveCode}` の starterMoveCode フォールバックを維持(C-4 統一対象外、Q19 Plan Mode 反問 2026-05-30 確定)。HomePage では「レシピなければ技名表示」の挙動を確認

**訂正注記**: バックエンド VAL-S02 により **レシピなしセットプレイは登録できない**(開発者 E2E 確認結果による訂正、2026-05-31)。本シナリオの `setup.defaultRecipe` 空文字列ケースのテストは通常フローでは発生しにくい。仮登録モード等の特殊ケース(VAL-C09 違反状態の可視化)でフォールバック表示動作を確認することで代替可能。コンボ(`combo.defaultRecipe`)の場合は VAL-C09 違反の仮登録モードで発生可能のため、フォールバック表示「(レシピなし)」の動作確認はコンボ側で実施可能。

---

## シナリオ H: 指摘 6 軸 List API 拡張 + SetupTreeRow 本実装の動作確認(最重要)

### H-1: List API レスポンス確認(DevTools Network)
- [ ] コンボ一覧画面読込時、GET /api/combos のレスポンスを DevTools Network で確認
- [ ] 各 combo オブジェクトに `setups` フィールドが含まれている
- [ ] 紐付きセットプレイありコンボ → `setups: [{...}, ...]`(実値配列)
- [ ] 紐付きセットプレイなしコンボ → `setups: []`(空配列、null ではない)
- [ ] **N+1 クエリが発生していない**(コンボ数 N に対して 1 〜 2 クエリで完結、サーバーログで確認)

### H-2: SetupTreeRow 本実装(D-1 と同等)
- [ ] D-1 で確認した内容を再確認
- [ ] DES-005 §5.4 表示例整合: `└ セットプレイ1 [レシピ]` 形式
- [ ] 複数セットプレイ紐付きコンボで全件表示

### H-3: 展開アイコン条件表示(D-1 と同等)
- [ ] D-1 で確認した内容を再確認
- [ ] セットプレイ紐付きなしコンボでは展開アイコン非表示

### H-4: ブラウザセッション保持(`sessionStorage`)
- [ ] コンボ A を展開 → ページ遷移(コンボ詳細画面等)→ コンボ一覧に戻る → **コンボ A が展開状態維持**
- [ ] ブラウザリロード(F5)→ **展開状態維持**(sessionStorage は同タブ内維持)
- [ ] **タブを閉じる → 同じ URL を新タブで開く → 展開状態リセット**(sessionStorage はタブ単位)
- [ ] DevTools Application タブで sessionStorage 確認 → キー `combo-list-expanded-ids-v1` に展開中の combo ID 配列が保存されている

---

## シナリオ I: Q10 ComboDetailMetadata 表示項目変更の動作確認

### I-1: 表示フィールド変更
- [ ] コンボ詳細画面の ComboDetailMetadata 部分を確認
- [ ] **表示ラベルが「ドライブゲージ開始残量」「SAゲージ開始残量」**(変更前: 「ドライブゲージ消費」「SAゲージ消費」)
- [ ] 開始残量が設定済みコンボ → 値が表示される(例: 3 / 3 等の値)
- [ ] 開始残量未設定コンボ → 「-」表示
**注記(2026-05-31 追記)**: 本シナリオの ComboDetailPage 表示確認時、ComboEditorBasicFields の 6 つの select(キャラ選択 / 始動技 / 始動状況 / ルート / ダメージ / その他)は **native `<select>` のまま CSS のみ統一**(Q16 (P) 確定、Radix Select の `value=""` 制約により非置換、architecture-patterns v1.0.9 §1.2.6 例外条項)。「(未指定)」プレースホルダー UX が引き続き動作することを確認。

### I-2: バックエンドフィールド温存確認(Q15)
- [ ] DevTools Network で GET /api/combos/{id} レスポンス確認
- [ ] レスポンスに `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` フィールドが **含まれている**(null 値でも可、削除されていない確認)
- [ ] 同時に `driveAvailableAtStart` / `saAvailableAtStart` フィールドも含まれている

### I-3: i18n キー名温存確認
- [ ] `web/src/locales/ja.json`(または相当)で `comboDetail.metadata.driveGauge` / `comboDetail.metadata.saGauge` キー名が維持されている(値のみ変更)

---

## シナリオ J: 伝達 2 Dialog scroll 制約パターンの動作確認
**注記(2026-05-31 追記)**: 本シナリオの Dialog scroll 制約パターンは M7-02 完了承認時に正式パターン化完了(候補 → 正式、architecture-patterns v1.0.9 §7、retrospective-log v1.0.25 §6.6 持ち越し課題「伝達 2」解消済み)。

### J-1: 候補 (c) リスト含む Dialog の内部リスト max-h
- [ ] **LinkExistingSetupModal**: 多数のセットプレイ候補を持つキャラで開く → リストが viewport を超える長さでもダイアログ自体は固定、内部リストのみスクロール
- [ ] **AddComboToCompareModal**: 多数のコンボ候補がある状態で開く → 同上
- [ ] **SetupSelectorModal**: 多数のセットプレイ候補 → 同上
- [ ] **KnockdownAdvantageChangeModal individual モード**: 多数の紐付きセットプレイがある状態で個別モード → チェックボックスリストが内部スクロール

### J-2: 候補 (a) fallback 確認
- [ ] 他の任意の Dialog(`alert-dialog` 含む)で `max-h-[85vh]` が `dialog.tsx` デフォルトスタイルに含まれている確認(`web/src/components/ui/dialog.tsx` の view 確認)

---

## シナリオ K: M7-01 確立物の温存確認(回帰なし)

### K-1: Header / Footer / Header 非表示 4 ページ
- [ ] M7-01 で確立した Header が PC + スマホで正常表示
- [ ] ハンバーガーメニュー(スマホサイズ)が動作
- [ ] Footer(M6-03 確立、スマホ専用)が動作
- [ ] **Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)で Header が表示されない**(案 A 確定継続)

### K-2: M7-01 既存 shadcn/ui 12 コンポーネント
- [ ] Dialog / AlertDialog / Sheet / Popover / DropdownMenu / Select / Tabs / Accordion / Command / Checkbox / RadioGroup / Textarea が動作変化なし

### K-3: M7-01 追加タスク確認(システムタグ + ComboEditorPage)
- [ ] D-4 で確認したシステムタグ表示制御
- [ ] **コンボ編集画面に「既存セットプレイから紐付け」ボタンが表示されない**(CHANGE-018 v1.0.1 「登録画面のみ」)
- [ ] コンボ新規登録画面 + コンボ詳細画面では同ボタン表示

---

## シナリオ L: 既存機能の回帰なし(M1〜M6 + M7-01)

### L-1: M1 機能(コンボ CRUD + プリセット解決 + 仮想コントローラ)
- [ ] コンボ新規登録 → 編集 → 削除 → 復元の一連動作が変わらず
- [ ] プリセット切替が動作
- [ ] 仮想コントローラからの入力が動作

### L-2: M2 機能(リアルタイム重複検知 + ゴミ箱)
- [ ] コンボ編集中のリアルタイム重複検知 → DuplicateWarning AlertDialog 表示
- [ ] ゴミ箱画面でのソフトデリート復元 + 完全削除動作

### L-3: M3 機能(タグ + マイコンボ)
- [ ] タグ管理画面でのタグ CRUD(システムタグ表示制御維持)
- [ ] コンボへのタグ紐付け / 解除
- [ ] マイコンボ画面でのステータス管理 / ステータスタブ / ステータスセレクト

### L-4: M4 機能(セットプレイ + knockdown_advantage)
- [ ] セットプレイ CRUD
- [ ] セットプレイ紐付け(コンボ詳細画面 + コンボ新規登録画面)
- [ ] **コンボ編集画面ではセットプレイ紐付けボタン非表示**(CHANGE-018 確認)
- [ ] knockdown_advantage 変更時の KnockdownAdvantageChangeModal(3 モード)動作
- [ ] コンボ + セットプレイ同時新規登録

### L-5: M5 機能(コンボ比較 + 選択モード)
- [ ] コンボ比較画面の動作
- [ ] 選択モードでのコンボ追加 / 削除

### L-6: M6 機能(設定 + ウィザード + ホーム + フッター)
- [ ] 設定画面の動作(プリセット切替 + キャラ選択)
- [ ] 初回起動ウィザード 7 ステップ動作(Header なし、案 A 確定)
- [ ] スマホ専用ホーム画面動作(タイトルバー + 主要機能ボタン + 最近更新)
- [ ] スマホフッターの動作(M6-03 確立)

### L-7: M7-01 機能(全件)
- [ ] M7-01 で確立した shadcn/ui 17 件移行コンポーネントの動作変化なし
- [ ] Header / Footer / ハンバーガー / Header 非表示 4 ページ(K-1 と同等)
- [ ] **Q22 案 A 修正による既存機能への影響なし**:警告なし PUT 動作 / コンボ削除 / コンボ復元 / 通常編集の動作変化なし(M7-02 で `useUpdateComboWithKeyChange` の onSuccess を変更したが、warning ありケース以外の挙動は変わらない)

---

## M. UX 評価項目(画面ショット提示推奨、playbook §14)

機能動作確認とは別に、開発者は UX 観点で以下を評価:

- [ ] shadcn/ui Form のフィールド表示 = 旧自作ラッパーと比較した見た目変化の許容性
- [ ] shadcn/ui Table の行高 / 余白 / 罫線 = 旧自作テーブルと比較した可読性
- [ ] shadcn/ui Toast(sonner)の表示位置 / アニメーション = M4-03 topMessage と比較した違和感
- [ ] shadcn/ui Badge の見た目 = 旧 TagBadgeList と比較した整合性
- [ ] Dialog scroll 制約の動作 = 候補 (c) 内部リストスクロール時の UX(操作性 / 視覚的な区切り)
- [ ] SetupTreeRow のインデント表示 = DES-005 §5.4 表示例との見た目整合
- [ ] 展開アイコン条件表示の UX = セットプレイ紐付きなしコンボでアイコン非表示時のレイアウト
- [ ] react-hook-form の入力中バリデーション = エラー表示タイミング(blur / change / submit)が違和感ないか
- [ ] M7-02 完了承認時の確定方針(Q16 native `<select>` 維持 / Q17 「(レシピなし)」統一 / Q18 CompareTable "-" 維持 / C-2 β / 必須項目 5 b / C-4 HomePage 除外 / Q22 案 A)の UX 上の妥当性最終評価

---

---

## シナリオ N: Q22 案 A 修正確認(VAL-C03 警告ダイアログのエラー遷移なし、本セッション編入 2026-05-31)

### N-1: 始動技と実レシピ 1 件目の不一致で PUT(キー変更)実行
1. コンボ編集画面で始動技を例えば「弱P」、レシピ 1 件目を例えば「中K」に変更(VAL-C03 警告発生条件)
2. 保存ボタンクリック
3. PUT(キー変更)成功 → 警告ダイアログ表示(「始動技と実レシピ 1 件目が異なります」等)
4. **数秒待機しても、ダイアログがエラーページに遷移しない**(Q22 修正確認、案 A 適用後の期待動作)
5. ダイアログで「移動」選択 → 新 ID のコンボ詳細画面に遷移
6. **ブラウザ URL が `/combos/新ID` で正常表示**

### N-2: ブラウザリロード(F5)後の動作
1. N-1 完了後、新 ID のコンボ詳細画面でブラウザリロード
2. 新 ID で正常表示
3. 旧 URL `/combos/旧ID/edit` には遷移しない(旧 ID は論理削除済み = 404、ただし新 ID の URL を使う通常フロー)

### N-3: DevTools Network での確認
1. N-1 で PUT(キー変更)実行直後、DevTools Network タブを確認
2. **GET /api/combos/旧ID** リクエストが **発生していない**(`invalidateQueries` 削除確認、旧 ID への再フェッチが走らない)
3. 警告ダイアログで「移動」選択後、新 ID のコンボ詳細画面遷移時に **GET /api/combos/新ID は発生せず、キャッシュから即表示**(`setQueryData` で prefetch 済み確認)

### N-4: 警告なしの PUT(VAL-C03 非該当)の動作確認
1. 始動技とレシピ 1 件目を一致させた状態で PUT(キー変更)実行
2. 警告ダイアログ表示なし → 即 navigate で新 ID のコンボ詳細画面に遷移
3. 動作が従来どおりであることを確認(Q22 修正が警告なしケースに影響していない確認)

---

## 完了承認判断

開発者は以下のいずれかを判断:

- ✅ **完了承認**: シナリオ A〜L 全件 PASS + UX 評価で重大な違和感なし
- ⚠️ **条件付き承認**: 軽微な修正要望あり(後続マイルストーンで対応 or M7-02 内で即時修正)
- ❌ **完了承認保留**: 重大な動作不良 or UX 退化 → 機械レビュー報告書を再確認 + 製造担当に再実装依頼

---

## 関連ドキュメント

| 種類 | ファイル | 役割 |
|------|---------|------|
| 本文書 | 本ファイル(`m7-02-e2e-scenarios.md`)| M7-02 実機動作確認シナリオ |
| 対応指示書 | `M7-02-shadcn-ui-form-toast-pattern-cleanup-and-list-api-expansion.md` v1.0.0 | M7-02 製造工程指示書 |
| 機械レビュー | `M7-02-review-checklist.md` v1.0.0 | 静的コードレビュー(本文書とは別役割)|
| 機械レビュー報告書 | `docs/progress/m7-02-review.md`(本 M7-02 完了時に生成) | 機械レビュー結果 |
| 関連調査 | `M7-RESEARCH-03-report.md` | 指摘 1 軸 + 指摘 6 軸の調査結果 |
| 連動 CHANGE 通知書 | `CHANGE-018-edit-page-link-existing-setup-removal.md` v1.0.1 | DES-005 §5.7 / §5.9「登録画面のみ」注記方式(本 M7-02 関連 = K-3 シナリオで動作確認)|

---

*以上、M7-02 実機動作確認シナリオ v1.0.0*
