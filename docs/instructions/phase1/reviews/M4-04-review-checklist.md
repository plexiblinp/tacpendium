# M4-04 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M4-04: コンボ + セットプレイ同時登録(API DTO 拡張 + 同時登録 UI + useCreateCombo 拡張) |
| バージョン | 1.0.2 |
| 推奨モデル | Sonnet 4.6(機械レビュー) |
| 役割 | M4-04 の実装が指示書通りか、構造的問題がないかを機械的に検査する。**実機テストは別途実施が必要**(playbook §14、M4-02 E2E 由来の運用知見: レビュー完了承認 ≠ サブマイルストーン完了承認) |
| 作成日 | 2026-05-19 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-19 | 初版作成。M4-04 指示書 v1.0.0 に対応 |
| 1.0.1 | 2026-05-20 | M4-04 指示書 v1.0.1 改訂(個別 VC 採用 + copy モード対応)に追随。§7.3 仮想コントローラの取り扱い検査を「個別 VC レンダリング」検査に変更(フォーカス管理ロジック検査削除)、§9.1 / §9.2 で new + copy 両方の同時登録セクション表示検査に変更、§1.4 スコープ外検査に「RecipeBuilder の変更がないこと」追加、§13 重大判定基準に「RecipeBuilder の変更が含まれていないこと」「copy モードでコピー元 setups が引き継がれていないこと」を追加 |
| 1.0.2 | 2026-05-20 | M4-04 指示書 v1.0.2 改訂(SetupSelectorModal 新設)に追随。§8 「LinkExistingSetupModal 再利用チェック」を「SetupSelectorModal 新設チェック」に全面改訂。§13 重大判定基準の §8 関連項目を「`LinkExistingSetupModal` が再利用されていない(新規モーダルを実装している)」検査から「`SetupSelectorModal` の新設が v1.0.2 の規定通りか + `LinkExistingSetupModal` を Props 拡張で統合していないか(M4-5 反省踏襲)」検査に変更。**注**: 本改訂は当初 CHANGE-014 通知書とともに進めたが、開発者指摘で設計書本体の変更を伴わないため CHANGE-014 を欠番化(retrospective-log v1.0.15 §5.1 M4-15 参照)|

---

## 0. レビュー実施前の確認

- [ ] M4-04 指示書 v1.0.0 を読了している
- [ ] DES-005 v2.8.0 §5.7 item 10(セットプレイ登録セクション)を確認している
- [ ] M4-01 §4.2.1 コンボ作成 API DTO 予約形(`Setups json.RawMessage`)を確認している
- [ ] M4-02 §4.2 / §4.7(LinkExistingSetupModal 再利用前提)を確認している
- [ ] architecture-patterns.md v1.0.2 §1 フック分離、§1.1 queryKey 規約(flat tuple + number 正規化)を確認している
- [ ] retrospective-log v1.0.12 §5.3 教訓(特に M4-10 由来「SQL 境界値網羅検証」「E2E 不具合診断時のリロード後確認」)を踏まえる
- [ ] CHANGE-012 §6.2 R-2 対策(VAL-S05 サービス層引数レベル適用)を確認している

---

## 1. ファイル一覧チェック(§2.1)

### 1.1 バックエンド修正ファイル

- [ ] `internal/api/combo/dto.go`(または相当)の `CreateComboInput` の `Setups` フィールドが `json.RawMessage` から `[]CreateSetupInput` に置換されている
- [ ] `internal/service/combo/create.go`(または相当)でコンボ作成サービスにトランザクション処理が追加されている
- [ ] `internal/service/combo/create_test.go`(または相当)に setups 束受領のテストが追加されている
- [ ] `internal/api/combo/handler.go`(または相当)でリクエストパース時に `Setups []CreateSetupInput` を受け取る形に対応している
- [ ] `internal/api/combo/handler_test.go`(または相当)にハンドラのテストが追加されている

### 1.2 フロントエンド新設ファイル

- [ ] `web/src/features/combo/components/SetupRegistrationSection.tsx` が存在
- [ ] `web/src/features/combo/components/SetupRegistrationSection.test.tsx` が存在
- [ ] `web/src/features/combo/components/SetupInputRow.tsx` が存在
- [ ] `web/src/features/combo/components/SetupInputRow.test.tsx` が存在
- [ ] **`web/src/features/setup/components/SetupSelectorModal.tsx` が存在**(v1.0.2 で追加)
- [ ] **`web/src/features/setup/components/SetupSelectorModal.test.tsx` が存在**(v1.0.2 で追加)

### 1.3 フロントエンド修正ファイル

- [ ] `web/src/features/combo/hooks/useCreateCombo.ts`(または相当)が `setups` 引数に対応している
- [ ] `web/src/features/combo/api/comboApi.ts`(または相当)の `createCombo` メソッドに `setups` が追加されている
- [ ] `web/src/features/combo/types.ts`(または相当)の `CreateComboInput` 型に `setups?: CreateSetupInput[]` が追加されている
- [ ] `web/src/pages/ComboEditorPage.tsx`(または相当)に同時登録セクションが追加されている(新規登録モードのみ)
- [ ] `web/src/pages/ComboEditorPage.test.tsx`(または相当)にテストが追加されている

### 1.4 スコープ外への変更がないこと(§2.2 / §2.3)

- [ ] §4.2 / §4.3 以外のバックエンド変更が含まれていない(M4-01 で完成した setup CRUD API のシグネチャ変更、コンボ更新 API の修正等は禁止)
- [ ] M4-02 で実装した setup フロントエンド既存ファイルが変更されていない(useCreateCombo の setups 対応と CreateComboInput 型拡張のみが許容)
- [ ] M4-03 で実装した knockdown_advantage 確認モーダル等が変更されていない
- [ ] **`RecipeBuilder` の変更が含まれていない**(v1.0.1 で確定: 個別 VC レンダリング採用、`RecipeBuilder` への変更不要、最重要)
- [ ] **M4 統合 E2E シナリオが本指示書に含まれていない**(M4-05 のスコープ)
- [ ] **L-01 オプショナル型解消が本指示書に含まれていない**(M4-05 のスコープ)
- [ ] **下書き保存仕様(DES-005 §5.7 L343)が含まれていない**(M5 以降)
- [ ] **編集モードでの同時登録セクションが含まれていない**(本指示書 §1.4 / §4.9 規定、新規登録モードのみ)
- [ ] **セットプレイ並び替え UI が含まれていない**(M5 以降)
- [ ] **copy モードでコピー元の setups が引き継がれていない**(v1.0.1 で確定: 引き継がない、空表示、選択肢 c、最重要)
- [ ] DB マイグレーションが新規追加されていない(本指示書ではテーブル DDL 変更なし)

---

## 2. コンボ作成 API DTO 拡張チェック(§4.2)

### 2.1 DTO 型修正

- [ ] `CreateComboInput.Setups` の型が `json.RawMessage` から `[]CreateSetupInput` に置換されている
- [ ] JSON タグが `json:"setups,omitempty"` で前方互換が確保されている
- [ ] `CreateSetupInput` には `parent_combo_id` フィールドが **含まれていない**(VAL-S05 / CHANGE-012 §6.2 R-2 対策、サービス層引数レベルで適用)

### 2.2 ハンドラ層

- [ ] リクエストパース時に `Setups []CreateSetupInput` が正しくデシリアライズされる
- [ ] setups 未指定(nil)・空配列で 200 / 201 が返る(既存挙動の回帰なし)
- [ ] エラーレスポンスが `model.APIErrorResponse` で返される(architecture-patterns.md §3、独自ヘルパなし)

### 2.3 レスポンス形式

- [ ] レスポンスは既存の `ComboResponse` を再利用(本指示書では拡張しない)
- [ ] 同時登録した setups は `combo.setups` フィールドに含まれて返ってくる(M4-02 で確立した形)

---

## 3. サービス層トランザクション処理チェック(§4.3、最重要)

### 3.1 トランザクション原子性(最重要)

- [ ] コンボ作成 + setups 作成 + combo_setups 紐付けが **同一トランザクション内** で実行されている
- [ ] setups ループ中のいずれかが失敗した場合、**全体ロールバック**(コンボ本体も含めて作成されない)
- [ ] トランザクション開始 → コミットの順序が正しい

### 3.2 VAL-S05 サービス層引数レベル適用(CHANGE-012 §6.2 R-2 対策、最重要)

- [ ] **setup 作成サービスの引数に `parentComboID int64` が明示的に渡されている**(`setupService.Create(ctx, tx, input, combo.ID)` 等)
- [ ] リクエスト DTO の `CreateSetupInput` には `parent_combo_id` フィールドが **含まれていない**(混入できない構造)
- [ ] CHANGE-012 §6.2 R-2 対策が正しく実装されている

### 3.3 境界値ケース(§4.3.4 表)の網羅(M4-10 反省踏襲)

サービス層テストで以下の境界値ケースが網羅されている:

- [ ] setups 未指定(nil): 既存のコンボ作成と同じ、setups 関連処理なし
- [ ] setups = []: 既存のコンボ作成と同じ、setups 関連処理なし
- [ ] setups = [valid setup 1 件]: コンボ + setup 1 件作成、combo_setups 1 件紐付け
- [ ] setups = [valid setup 複数件]: コンボ + setup 複数件作成、combo_setups 複数件紐付け
- [ ] setups[i] のバリデーションエラー(VAL-S01〜S04): 全体ロールバック、エラーメッセージに `setups[i]` プレフィックス
- [ ] setups[i] のサービス層エラー(VAL-S05): 全体ロールバック
- [ ] コンボ本体作成失敗: 既存挙動、setups 処理に進まない
- [ ] 同一トランザクション内での setup 作成失敗(DB 整合性違反等): 全体ロールバック

### 3.4 エラーメッセージ

- [ ] setups 由来のバリデーションエラーは `setups[i]` プレフィックスで位置明示されている
- [ ] エラーコードが既存パターン踏襲(setup 系は小文字スネーク)

---

## 4. フロント CreateComboInput 型拡張チェック(§4.4)

- [ ] `web/src/features/combo/types.ts`(または相当)の `CreateComboInput` に `setups?: CreateSetupInput[]` が追加されている
- [ ] `CreateSetupInput` は `web/src/features/setup/types.ts`(M4-02 で確立)から import している(新規型定義しない、M4-5 反省踏襲)
- [ ] フィールド名は camelCase(CLAUDE.md §4)

---

## 5. useCreateCombo フック拡張チェック(§4.5)

### 5.1 引数対応

- [ ] `useCreateCombo` の mutation 引数 `CreateComboInput` で `setups` オプションを受け取る
- [ ] 既存呼び出し元は引数に setups を含めない形のままで動作する(オプショナルなので)

### 5.2 onSuccess での queryKey invalidate(M4-03 E2E 由来教訓)

- [ ] 既存: `['combos']`、`['combos', characterId]` を invalidate
- [ ] **M4-04 で追加**: setups が含まれて作成された場合(`data.setups && data.setups.length > 0`)、`['setups', characterId]`、`['setupCandidates']` も invalidate
- [ ] queryKey が **flat tuple 形式**(architecture-patterns.md v1.0.2 §1.1)

### 5.3 architecture-patterns.md v1.0.2 §1.1 踏襲(M4-9 反省踏襲)

- [ ] queryKey が flat tuple 形式(`['combos', characterId]` 等)で書かれている(object 形式 `{ id }` ではない)
- [ ] characterId が number 型(URL パラメータの場合は number 正規化済み)

---

## 6. SetupRegistrationSection コンポーネントチェック(§4.6)

### 6.1 Props 設計(Props 最小化、M4-5 反省踏襲)

- [ ] `SetupRegistrationSectionProps` が `value: CreateSetupInput[]` + `onChange: (setups) => void` + `characterId: number` の 3 つのみ
- [ ] `mode` prop を持たない(新規登録モード専用、YAGNI 違反回避)
- [ ] loading / error 状態は受け取らない

### 6.2 表示仕様

- [ ] セクション見出し「このコンボに紐づくセットプレイ」(または同等の文言)
- [ ] 各 `value[i]` に対して `SetupInputRow` をレンダリング(削除ボタン付き)
- [ ] 「+ セットプレイを追加」ボタン
- [ ] 「既存のセットプレイを紐付け」ボタン

### 6.3 既存セットプレイ紐付けの動線

- [ ] 「既存のセットプレイを紐付け」クリックで `LinkExistingSetupModal`(M4-02 §4.7)が開く
- [ ] 既存セットプレイ選択結果は **`value` ではなく** 別の state(`linkedSetupIds: number[]`)に追加される(§4.6.4 規定)
- [ ] コンボ作成 API のリクエストには **新規作成 setup(`value`)のみ** が含まれる(既存紐付け setup は別フロー)

### 6.4 文字数制限・console.warn の仕様(M4-7 反省踏襲)

- [ ] セクション見出し・ボタンラベルに文字数制限なし、console.warn なし

---

## 7. SetupInputRow コンポーネントチェック(§4.7)

### 7.1 Props 設計(Props 最小化)

- [ ] `SetupInputRowProps` が `value` + `onChange` + `onRemove` + `characterId` の 4 つのみ

### 7.2 表示仕様

- [ ] セットプレイ名入力フィールド(text input)
- [ ] 説明入力フィールド(textarea)
- [ ] レシピ入力(仮想コントローラ共用 + ステップ一覧)
- [ ] 行削除ボタン

### 7.3 仮想コントローラの取り扱い(v1.0.1 で改訂: 個別 VC 採用)

- [ ] 各 `SetupInputRow` が `SetupRecipeEditor`(VC 内蔵型)を **個別にレンダリング** している
- [ ] `RecipeBuilder` への変更が含まれていない(最重要、M4-04 スコープ外)
- [ ] フォーカス管理ロジック(`editingSetupIndex` 状態、VC 入力ルーティング等)が **実装されていない**(個別 VC 方式では不要)
- [ ] v1.0.0 §4.7.3 の共用 VC 方式(フォーカス管理で切替)が **実装されていない**

### 7.4 文字数制限・console.warn の仕様(M4-7 反省踏襲)

- [ ] セットプレイ名 / 説明 / レシピステップに文字数制限なし、console.warn なし(M4-02 §4.6.2 / M4-03 §4.7.3 と整合)

---

## 8. SetupSelectorModal 新設チェック(§4.8、v1.0.2 で全面改訂)

### 8.1 SetupSelectorModal の新規実装

- [ ] `web/src/features/setup/components/SetupSelectorModal.tsx` が新規実装されている
- [ ] `web/src/features/setup/components/SetupSelectorModal.test.tsx` が新規実装されている
- [ ] **`LinkExistingSetupModal`(M4-02 §4.7 実装済み)が変更されていない**(本指示書 §2.2 規定、最重要)

### 8.2 SetupSelectorModal の責務(選択のみのピッカー)

- [ ] **mutation 実行ロジック(`useCreateSetupLink` 等)を内包していない**(`LinkExistingSetupModal` との明確な責務分離、最重要)
- [ ] `onSelect: (setupId: number) => void` コールバックを Props として公開している
- [ ] 紐付け処理は呼び出し元(`SetupRegistrationSection`)の責務(コンボ作成成功後に `useCreateSetupLink` を順次発火)

### 8.3 Props 設計(Props 最小化、M4-5 反省踏襲)

- [ ] `SetupSelectorModalProps` が `isOpen` + `onClose` + `onSelect` + `characterId` + `excludeSetupIds?`(任意)のみ
- [ ] **mutation 実行関連の Props(`parentComboId`、`onLinkSuccess` 等)を持っていない**(M4-5 反省「mode prop YAGNI 違反」回避)
- [ ] `parentComboId` を nullable にして「null 時は mutation を呼ばない」のような複数モード分岐を実装していない(`LinkExistingSetupModal` の Props 拡張統合を行っていない、最重要)

### 8.4 表示仕様

- [ ] モーダルウィンドウ(標準 HTML + Tailwind、shadcn/ui 不使用、playbook §4.6 踏襲)
- [ ] 同一キャラの既存 setup 一覧表示(`useListSetupsByCharacter` 等の M4-02 フックを再利用)
- [ ] 行クリックで `onSelect(setupId)` 発火 + モーダル閉じる
- [ ] `excludeSetupIds` に含まれる setup を一覧から除外(UX 改善、任意機能)

---

## 9. ComboEditorPage 修正チェック(§4.9)

### 9.1 新規登録モードでの同時登録セクション表示(v1.0.1 で改訂: new + copy 両方対応)

- [ ] **新規登録モード**(`POST /api/combos` でコンボを新規作成するフロー全般、**`/combos/new` および `/combos/:id/copy` 両方**)で `SetupRegistrationSection` が render される
- [ ] copy モードの場合、コンボ本体(レシピ・メタデータ等)はコピー元から初期値投入されるが、**同時登録セクションは空の状態で表示**(コピー元の setups を初期値として投入しない、§1.4 規定、最重要)
- [ ] セクション位置: DES-005 §5.7 表示項目順(タグ選択の前、コンボ後情報の後)
- [ ] モード判定ロジック例: `const isCreateMode = mode === 'create' || mode === 'copy';`(または等価判定、§3.4.2 で実態確認した既存パターンに準拠)

### 9.2 編集モードでの非表示(最重要)

- [ ] **編集モード(`mode === 'edit'` 相当)で `SetupRegistrationSection` が render されない**(本指示書 §1.4 / §4.9 規定、最重要)
- [ ] 編集モードでは既存の「セットプレイ追加ボタン」(M4-02 で実装済み)動線が変わらない

### 9.3 保存フロー

- [ ] 保存ボタン押下時、`useCreateCombo({ ..., setups: setupsToCreate })` が発火
- [ ] コンボ作成成功後、`linkedSetupIds` がある場合に `useCreateSetupLink` が順次発火
- [ ] 保存成功後にコンボ詳細画面へ遷移(既存フロー)

### 9.4 既存登録機能の回帰なし

- [ ] setupsToCreate / linkedSetupIds がともに空の場合、既存のコンボ作成挙動と同一
- [ ] 編集モードでは本機能が完全に非表示(既存の編集機能に影響なし)

---

## 10. テストの妥当性(§5.1)

### 10.1 バックエンドテスト

- [ ] コンボ作成 API DTO 拡張テスト(§5.1.1 の 8 ケース全網羅)
- [ ] サービス層トランザクションテスト(原子性確保、setups 空配列 / nil 時のスキップ動作)

### 10.2 フロントエンドテスト(フック)

- [ ] `useCreateCombo` の setups 引数対応テスト
- [ ] `onSuccess` での invalidate 対象テスト(setups あり / なしで invalidate 対象が変わる)

### 10.3 フロントエンドテスト(コンポーネント)

- [ ] `SetupRegistrationSection` テスト(§5.1.3)
- [ ] `SetupInputRow` テスト(§5.1.3)

### 10.4 ページコンポーネントテスト

- [ ] `ComboEditorPage`(新規登録モード)で `SetupRegistrationSection` 表示
- [ ] `ComboEditorPage`(編集モード)で `SetupRegistrationSection` 非表示
- [ ] `ComboEditorPage`(新規登録モード)で保存時に setups 引数付きで `useCreateCombo` 発火
- [ ] `ComboEditorPage` 編集モードの既存機能が回帰なし

### 10.5 ビルド・型チェック

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] `go test ./...` が全通過する(新規 + 既存テスト回帰なし)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

### 10.6 動作確認シナリオ手順書(M4-02 E2E 由来知見、本指示書では E2E は M4-05 で実施)

- [ ] 製造担当の完了報告に §5.2 動作確認シナリオ A〜H の手順書が含まれている
- [ ] シナリオ A: 新規登録モードで setup を 1 件同時登録
- [ ] シナリオ B: 新規登録モードで setup を複数件同時登録
- [ ] シナリオ C: 新規登録モードで setup なし(従来通り)
- [ ] シナリオ D: 新規登録モードで既存セットプレイ紐付け
- [ ] シナリオ E: 新規 setup + 既存紐付けの併用
- [ ] シナリオ F: setup 入力中のバリデーションエラー + 全体ロールバック
- [ ] シナリオ G: 編集モードで本機能が非表示
- [ ] シナリオ H: 既存機能の回帰
- [ ] **レビュー完了承認 ≠ M4-04 完了承認**: 動作確認シナリオの実機確認が完了判定の必須ゲートであることを完了報告で明示

---

## 11. コード品質・規約遵守

- [ ] CLAUDE.md §4 TypeScript / Go 規約に準拠(camelCase、関数コンポーネント + Hooks、JSON タグ camelCase)
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層・コンポーネント層・ページ層・サービス層・リポジトリ層・ハンドラ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない
- [ ] **architecture-patterns.md v1.0.2 §1 フック分離パターンに準拠**(コンポーネントから API 直接呼びなし、フック経由)
- [ ] **architecture-patterns.md v1.0.2 §1.1 TanStack Query queryKey 規約(flat tuple + number 正規化)に準拠**(M4-9 反省踏襲)
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-02 で確定した `CreateSetupInput` 型を再利用**(新規型定義しない、M4-5 反省踏襲)
- [ ] **M4-02 で実装した `LinkExistingSetupModal` を再利用**(新規モーダル実装しない、M4-5 反省踏襲)
- [ ] **VAL-S05 がサービス層関数の引数レベルで適用されている**(CHANGE-012 §6.2 R-2 対策、最重要)
- [ ] **トランザクション原子性が確保されている**(setups 作成中の失敗で全体ロールバック)
- [ ] **playbook §4.5 フローの素直さ原則**に抵触していない(エラー駆動再試行禁止、N+1 回避、原子性確保)
- [ ] setup 系のエラーコードが **小文字スネーク** で統一されている
- [ ] **共通エラー型 `model.APIErrorResponse`** を直接呼び出している(architecture-patterns.md §3、独自ヘルパなし)
- [ ] **編集モードでは同時登録セクションが非表示**(本指示書 §1.4 / §4.9 規定、最重要)

---

## 12. ドキュメント・進捗ログ

- [ ] `docs/progress/progress-log.md` に M4-04 完了報告が追記されている
- [ ] §3.4 着手前確認結果(全 6 項目、特に §3.4.1 M4-01 予約形・§3.4.2 トランザクション・§3.4.3 setup 作成サービスのシグネチャ)が含まれている
- [ ] §4.10 設計判断事項表の各項目が指示書通りに実装された旨が明記されている
- [ ] **§5.2 動作確認シナリオ A〜H の実機確認結果** が明記されている
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)が明記されている
- [ ] **境界値ケース全網羅の検証結果**(§4.3.4 表、M4-10 反省踏襲)が明記されている

---

## 13. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** と判定し M4-04 完了承認を保留する:

- §1.1〜§1.3 ファイル一覧チェックで 3 件以上の未充足(バックエンド新設・修正 + フロントエンド新設・修正)
- §1.4 スコープ外への変更が含まれている(§4.2 / §4.3 以外のバックエンド変更、M4-01 setup CRUD API シグネチャ変更、M4 統合 E2E 実装、L-01 解消、下書き保存仕様、編集モードでの同時登録セクション実装、セットプレイ並び替え UI、DB マイグレーション追加等)
- **§1.4 / §7.3 `RecipeBuilder` の変更が含まれている**(v1.0.1 で確定: 個別 VC レンダリング採用、最重要)
- **§3.1〜§3.2 トランザクション原子性違反**(setups 作成中の失敗で全体ロールバックされない、最重要)
- **§3.2 VAL-S05 サービス層引数レベル適用違反**(CreateSetupInput に parent_combo_id が含まれている、または setup 作成サービスの引数に parentComboID が渡されていない、CHANGE-012 §6.2 R-2 対策違反、最重要)
- **§9.2 編集モードで同時登録セクションが表示されている**(本指示書 §1.4 / §4.9 規定違反、最重要)
- **§9.1 copy モードでコピー元の setups が引き継がれている**(v1.0.1 で確定: 引き継がない、空表示、選択肢 c、最重要)
- §5.2 useCreateCombo の onSuccess で setups 作成時に `['setups']` / `['setupCandidates']` が invalidate されていない(M4-03 E2E 由来教訓違反)
- §5.3 queryKey が flat tuple 形式でない(architecture-patterns.md v1.0.2 §1.1 違反、M4-9 反省踏襲違反)
- §6.1 / §7.1 Props 設計で YAGNI 違反(現時点で内部で使わない props が含まれている、M4-5 反省踏襲違反)
- §8 **`SetupSelectorModal` の新設が v1.0.2 の規定通りに行われていない**(新規実装ファイルが欠落している、または `LinkExistingSetupModal` を変更している)
- §8 **`SetupSelectorModal` 内に mutation 実行ロジック(`useCreateSetupLink` 等)が含まれている**(責務分離違反、最重要)
- §8 **`LinkExistingSetupModal` を Props 拡張で統合している**(`parentComboId` nullable 化等、M4-5 反省「mode prop YAGNI 違反」回避違反、最重要)
- §10.5 / §10.6 M3-05 統合 E2E シナリオが回帰している(最重要)
- §3.3 境界値ケースの網羅が不足している(M4-10 反省踏襲違反、特に「setups[i] バリデーション失敗時の全体ロールバック」のテストが欠落)
- §11 shadcn/ui が使用されている(playbook §4.6 違反)
- §11 architecture-patterns.md §1 フック分離パターン違反(コンポーネントに API 呼び出し直書き等)

---

## 14. レビュー報告書フォーマット

機械レビュー完了時に以下を含む報告書を `docs/progress/m4-04-review.md` として出力:

```markdown
# M4-04 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ ファイル一覧: 全 NN 件中 NN 件確認
- ✅ / ⚠️ / ❌ §3.1 トランザクション原子性
- ✅ / ⚠️ / ❌ §3.2 VAL-S05 サービス層引数レベル適用
- ✅ / ⚠️ / ❌ §9.2 編集モードでの同時登録セクション非表示
- ✅ / ⚠️ / ❌ §3.3 境界値ケース網羅
- ✅ / ⚠️ / ❌ §5.2 onSuccess での invalidate 対象
- ...

## 3. 検出した問題
### 3.1 重大な問題(完了承認保留)
- (該当する場合)

### 3.2 軽微な問題(完了承認可、改善推奨)
- (該当する場合)

### 3.3 改善提案(次回マイルストーン以降)
- (該当する場合)

## 4. 制約事項
- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、動作確認シナリオ A〜H の実行)は別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見)
- **M4 統合 E2E は M4-05 で実施**(本指示書では本機能の動作確認のみ)
- 動作確認シナリオ A〜H の手動確認は開発者の責任範囲

## 5. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
```

---

*以上*
