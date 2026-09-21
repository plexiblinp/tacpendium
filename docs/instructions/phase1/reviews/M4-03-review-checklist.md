# M4-03 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M4-03: FR011 転用支援 + knockdown_advantage 確認モーダル |
| バージョン | 1.0.1 |
| 推奨モデル | Sonnet 4.6(機械レビュー) |
| 役割 | M4-03 の実装が指示書通りか、構造的問題がないかを機械的に検査する。**実機テストは別途実施が必要**(playbook §14、M4-02 E2E 由来の運用知見: レビュー完了承認 ≠ サブマイルストーン完了承認) |
| セルフチェック上の注意 | 本書 §10.2 はトースト通知文言として DES-005 §5.7 v2.8.0 規定を引用しているため、grep セルフチェック(playbook §4 系禁則表現)で「必要に応じて」が検出されるが、引用部分であり「DES-005 §5.7 規定の引用」と明示済み。指示の曖昧表現ではない |
| 作成日 | 2026-05-18 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-18 | 初版作成。M4-03 指示書 v1.0.0 に対応 |
| 1.0.1 | 2026-05-18 | M4-03 指示書 v1.0.1 改訂(トースト通知実装方針確定: 既存 topMessage 流用)に追随。§10.2 トースト通知検査を topMessage 流用パターンに変更、トースト系ライブラリ新規追加が含まれていないことの検査追加、§15 重大判定基準にトースト系ライブラリ追加違反を追加 |

---

## 0. レビュー実施前の確認

- [ ] M4-03 指示書 v1.0.0 を読了している
- [ ] DES-005 v2.8.0 §5.6 item 9 / §5.7(CHANGE-013 反映後)を確認している
- [ ] M4-01 §4.2.7 GetSetupCandidates スタブ実装、M4-02 §4.2 / §4.13 SetupSummary 規約を確認している
- [ ] architecture-patterns.md v1.0.1 §1 フック分離、§1.1 queryKey 規約を確認している
- [ ] retrospective-log v1.0.8 §5.3 教訓「E2E 実機確認を完了判定の必須ゲートに位置づける」を踏まえる

---

## 1. ファイル一覧チェック(§2.1)

### 1.1 バックエンド新設・修正ファイル

#### setup ドメイン(GetSetupCandidates 本実装)

- [ ] `internal/service/setup/service.go` の `GetSetupCandidates` がスタブから本実装に書き換えられている
- [ ] `internal/service/setup/service_test.go` に `GetSetupCandidates` のテストが追加されている
- [ ] `internal/repository/setup/repository.go` に候補抽出クエリ(`ListCandidatesByCharacterAndKnockdownAdvantage` 等)が追加されている
- [ ] `internal/repository/setup/repository_test.go` に候補抽出クエリのテストが追加されている
- [ ] `internal/api/setup/handler.go` の `GetSetupCandidates` ハンドラがスタブから本実装に書き換えられている(レスポンス JSON が `SetupSummary[]`)
- [ ] `internal/api/setup/handler_test.go` にハンドラのテストが追加されている

#### combo ドメイン(setupCarryOptions 追加)

- [ ] `internal/api/combo/dto.go`(または相当)の `UpdateComboInput` / `PatchComboInput` に `SetupCarryOptions *SetupCarryOptionsInput` フィールドが追加されている
- [ ] `internal/api/combo/dto.go`(または相当)に `SetupCarryOptionsInput` 構造体が定義されている(`Mode string` + `CarrySetupIDs []int64`)
- [ ] `internal/service/combo/update.go`(または相当)でコンボ更新時に `setupCarryOptions` を解釈、combo_setups の引き継ぎ判断が反映されている
- [ ] `internal/service/combo/update_test.go`(または相当)に引き継ぎ判断のテストが追加されている
- [ ] `internal/repository/combo_setup/repository.go`(または相当)に combo_setups の操作関数(`DeleteByComboID` / `DeleteByComboIDExcludingSetupIDs` 等)が追加されている

### 1.2 フロントエンド新設ファイル

- [ ] `web/src/features/setup/hooks/useSetupCandidates.ts` が存在
- [ ] `web/src/features/setup/hooks/useSetupCandidates.test.ts` が存在
- [ ] `web/src/features/setup/components/SetupCandidateList.tsx` が存在
- [ ] `web/src/features/setup/components/SetupCandidateList.test.tsx` が存在
- [ ] `web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx` が存在
- [ ] `web/src/features/combo/components/KnockdownAdvantageChangeModal.test.tsx` が存在

### 1.3 フロントエンド修正ファイル

- [ ] `web/src/features/setup/api/setupApi.ts` に `getCandidates(comboId)` メソッドが追加されている
- [ ] `web/src/features/setup/api/setupApi.test.ts` にテストが追加されている
- [ ] `web/src/features/combo/hooks/useUpdateCombo.ts`(または相当)が `setupCarryOptions` 引数に対応している
- [ ] `web/src/features/combo/types.ts` に `SetupCarryOptions` 型定義が追加されている
- [ ] `web/src/pages/ComboDetailPage.tsx`(または相当)に §5.6 item 9 セクションが追加されている
- [ ] `web/src/pages/ComboDetailPage.test.tsx`(または相当)にテストが追加されている
- [ ] `web/src/pages/ComboEditorPage.tsx`(または相当)に knockdown_advantage 確認モーダル分岐が追加されている
- [ ] `web/src/pages/ComboEditorPage.test.tsx`(または相当)にテストが追加されている

### 1.4 スコープ外への変更がないこと(§2.2 / §2.3)

- [ ] §4.4 / §4.5 以外のバックエンド変更が含まれていない(M4-01 で完成した setup CRUD API のシグネチャ変更、コンボ作成 API・削除 API の本体ロジック変更等は禁止)
- [ ] M4-02 で実装した setup フロントエンド既存ファイルが変更されていない(setupApi.getCandidates 追加と、useUpdateCombo の setupCarryOptions 対応のみが許容)
- [ ] M4-00 / M4-00b で実装した RecipeBuilder / ModifiersEditor のフロント側ファイルが変更されていない
- [ ] コンボ + セットプレイ同時登録セクション(DES-005 §5.7 item 10)が **含まれていない**(M4-04 のスコープ)
- [ ] セットプレイ削除ボタン UI / ゴミ箱 / 復元 UI が **含まれていない**(M5 以降スコープ)
- [ ] knockdown_advantage 確認モーダルの **モック実装** が含まれていない(2026-05-16 確定で実物実装、§1.3)
- [ ] セットプレイ独立一覧画面が新設されていない
- [ ] DB マイグレーションが新規追加されていない(本指示書 §4.4 / §4.5 でテーブル DDL 変更はない)

---

## 2. setup フロント型定義チェック(§4.2)

- [ ] `web/src/features/setup/types.ts` に `ListSetupCandidatesResponse` 型が追加されている(`items: SetupSummary[]`)
- [ ] M4-02 v1.0.4 で確定済みの `SetupSummary` 型が変更されていない
- [ ] M4-02 v1.0.4 で確定済みの `SetupResponse` 型が変更されていない
- [ ] フィールド名がすべて camelCase(CLAUDE.md §4)

---

## 3. setupApi.getCandidates チェック(§4.3)

- [ ] `setupApi.getCandidates(comboId: number)` メソッドが追加されている
- [ ] 戻り値型が `Promise<SetupSummary[]>`(SetupResponse[] ではない)
- [ ] レスポンス JSON `{"items": [...]}` をフック内部で展開して `SetupSummary[]` を返している
- [ ] 既存の setupApi メソッド(create / get / update / remove / createLink / deleteLink)のシグネチャが変更されていない

---

## 4. GetSetupCandidates バックエンド本実装チェック(§4.4)

### 4.1 サービス層

- [ ] `GetSetupCandidates(ctx, parentComboID)` が `[]SetupSummary` を返す(SetupResponse[] でない)
- [ ] 親コンボの情報(character_id, knockdown_advantage)を取得してから候補抽出している
- [ ] 親コンボが存在しない場合は `not_found` エラー(M4-01 の既存エラーパターンを再利用)
- [ ] 親コンボの `knockdown_advantage` が NULL のときは候補 0 件(SQL `=` 比較の自然な挙動)
- [ ] 親コンボ自身を候補から除外する条件が含まれている

### 4.2 リポジトリ層

- [ ] 候補抽出クエリで `WHERE character_id = ?` + `knockdown_advantage = ?` + `combos.id != ?` の条件が含まれる
- [ ] `setups.deleted_at IS NULL` で論理削除済み setup を除外
- [ ] `combos.deleted_at IS NULL` で論理削除済み combo を除外
- [ ] **N+1 問題が発生していない**(`parentComboIds` の取得が IN 句で一括化、playbook §4.5 / M4-02 §4.13.1 と同パターン)
- [ ] `defaultRecipe` の取得が `setups.recipe_cache` カラムから default preset ID = 1 のエントリを抽出する形(M4-01 案 R2 / M4-02 と同パターン)

### 4.3 ハンドラ層

- [ ] レスポンス JSON が `{"items": [...]}` 形式
- [ ] レスポンス要素型が `SetupSummary`(steps なし、createdAt / updatedAt なし)
- [ ] `comboId` 不正値で 400 + `invalid_combo_id`(小文字スネークケース)
- [ ] 親コンボが存在しないときに 404 + `not_found`(M4-01 の既存エラーパターン)
- [ ] エラーレスポンスが `model.APIErrorResponse` で返される(architecture-patterns.md §3、独自ヘルパなし)

---

## 5. コンボ更新 API 引き継ぎオプションチェック(§4.5)

### 5.1 入力 DTO(SetupCarryOptionsInput)

- [ ] `UpdateComboInput` / `PatchComboInput` に `SetupCarryOptions *SetupCarryOptionsInput \`json:"setupCarryOptions,omitempty"\`` フィールドが追加されている
- [ ] `*` ポインタ型で「設定なし」を nil で表現できる
- [ ] `SetupCarryOptionsInput.Mode` が `string` 型
- [ ] `SetupCarryOptionsInput.CarrySetupIDs` が `[]int64`、JSON タグ `json:"carrySetupIds,omitempty"`(camelCase)

### 5.2 サービス層: 引き継ぎ判断

- [ ] knockdown_advantage 変更検知ロジックが追加されている
- [ ] `Mode = "carry_all"`: combo_setups を変更しない
- [ ] `Mode = "unlink_all"`: combo_setups をすべて削除
- [ ] `Mode = "individual"`: `CarrySetupIDs` に含まれる setup のみ維持、それ以外は削除
- [ ] `Mode` が不正値: `invalid_setup_carry_mode` バリデーションエラー(`model.ValidationError`)
- [ ] knockdown_advantage 変更 + setupCarryOptions = nil + 紐付き setup ≥ 1 件: `missing_setup_carry_options` バリデーションエラー
- [ ] knockdown_advantage 変更なし + setupCarryOptions = nil: 既存挙動通り(エラーなし、M2-02 既存処理踏襲)
- [ ] knockdown_advantage 変更 + 紐付き setup 0 件 + setupCarryOptions = nil: エラーなし
- [ ] 引き継ぎ判断とコンボ更新が **1 つのトランザクション内** で実行される(原子性確保)

### 5.3 エラーコード(setup 系小文字スネーク統一、M4-01 規約踏襲)

- [ ] `invalid_setup_carry_mode`(小文字スネーク)
- [ ] `missing_setup_carry_options`(小文字スネーク)
- [ ] 既存エラーコードのケース(大文字混在)が新規ファイルで使われていない

### 5.4 既存 API への影響(M2-02 既存処理の保持)

- [ ] M2-02 で確立した編集 2 方式分離の判定ロジックが変更されていない
- [ ] M3-05 統合 E2E シナリオが回帰しない(`GET /api/combos/{id}` レスポンス・PATCH 既存挙動)

---

## 6. useSetupCandidates フックチェック(§4.6)

- [ ] `queryKey: ['setupCandidates', { comboId }]` 形式
- [ ] **comboId が number 型**(architecture-patterns.md §1.1 queryKey number 統一規約踏襲、URL パラメータからは呼び出し側で number 変換済み)
- [ ] `enabled: !!comboId && comboId > 0`(0 や NaN を弾く)
- [ ] 戻り値型が `SetupSummary[]`(SetupResponse[] ではない)
- [ ] フックが SetupApi.getCandidates を経由(コンポーネントから API を直接呼ばない、architecture-patterns.md §1)

---

## 7. SetupCandidateList コンポーネントチェック(§4.7)

### 7.1 Props 設計(Props 最小化、M4-5 反省踏襲)

- [ ] `SetupCandidateListProps` が `parentComboId: number` + `candidates: SetupSummary[]` の 2 つのみ(YAGNI 違反なし)
- [ ] loading 状態は受け取らない(ComboDetailPage 側で判定する責務分担)

### 7.2 表示仕様

- [ ] セクション見出しに「転用可能なセットプレイ候補(N 件)」(候補数を表示)
- [ ] 各候補に setup 名・ステップ数・レシピプレビュー(defaultRecipe)が表示される
- [ ] 「このコンボにも紐付ける」ボタンが各候補に配置されている
- [ ] ボタンクリックで `useCreateSetupLink({ comboId: parentComboId, setupId: candidate.id })` が発火される
- [ ] 紐付け成功時に TanStack Query キャッシュ無効化により候補一覧と紐付き setup 一覧が連動更新される

### 7.3 文字数制限の仕様確認(M4-7 反省踏襲)

- [ ] `setup.name` / `setup.description` / `setup.defaultRecipe` に **文字数制限なし、console.warn なし**(M4-02 §4.6.2 と整合)
- [ ] 表示崩れ対策の CSS truncate / ellipsis 等は技術判断として実装側に任せている

### 7.4 SetupAccordionItem との共通化なし

- [ ] SetupAccordionItem(M4-02 §4.7)と SetupCandidateList は **共通化されていない**(M5 以降のリファクタ候補、用途が異なる)

---

## 8. KnockdownAdvantageChangeModal チェック(§4.8)

### 8.1 Props 設計(Props 最小化、M4-5 反省踏襲)

- [ ] `KnockdownAdvantageChangeModalProps` が `open` / `linkedSetups: SetupResponse[]` / `onConfirm: (options) => void` / `onCancel: () => void` の 4 つのみ
- [ ] linkedSetups の取得を ComboEditorPage 側に委ねている(`useCombo` の戻り値の `combo.setups`)

### 8.2 表示・動作仕様

- [ ] モーダル本文が DES-005 §5.7 修正後の文言と一致(「knockdown_advantage が変わるため、紐づくセットプレイ N 件が成立しなくなる可能性があります。引き継ぎますか?」)
- [ ] ラジオボタン 3 つ:「すべて引き継ぐ」(carry_all、デフォルト選択)/「紐付けを外す」(unlink_all)/「個別に選択」(individual)
- [ ] 「個別に選択」モード時にチェックボックス UI が展開される
- [ ] チェックボックスのデフォルトはすべて ON(carry_all と同等から個別調整する自然な流れ)
- [ ] 「保存続行」クリックで `onConfirm(SetupCarryOptionsInput)` が呼ばれる:
  - Mode = "carry_all" のとき CarrySetupIDs は nil
  - Mode = "unlink_all" のとき CarrySetupIDs は nil
  - Mode = "individual" のとき CarrySetupIDs はチェック ON の setup ID 配列
- [ ] 「キャンセル」クリックで `onCancel` が呼ばれる(保存処理を実行しない)

### 8.3 モーダル実装方針

- [ ] 標準 HTML + Tailwind 自作(playbook §4.6、shadcn/ui 不使用)
- [ ] M4-02 LinkExistingSetupModal と同パターンで実装されている

---

## 9. ComboDetailPage 修正チェック(§4.9)

### 9.1 §5.6 item 9 セクション追加

- [ ] item 9 が item 8 セットプレイ一覧 と item 10 メタデータ の間に配置されている
- [ ] `useSetupCandidates(comboId)` で候補一覧を取得している
- [ ] 候補 0 件時に **セクション自体を非表示**(DES-005 §5.6 item 9 規定通り、セクションタイトルも表示されない)
- [ ] ローディング中はセクションを表示しない(チラつき回避)
- [ ] 候補 1 件以上で `SetupCandidateList` を render

### 9.2 既存表示項目(§5.6 item 1〜8、10)の回帰なし

- [ ] M4-02 完了状態の表示項目 1〜8、10 が変わらない
- [ ] M4-02 で実装したセットプレイ展開セクション(item 8)の動作が変わらない
- [ ] M4-02 で実装した SetupAccordionItem(行クリック = 編集遷移 / 展開アイコン = トグル)が変わらない

---

## 10. ComboEditorPage 修正チェック(§4.10)

### 10.1 knockdown_advantage 確認モーダル分岐

- [ ] 保存ボタン押下時に knockdown_advantage 変更検知ロジックが実行される
- [ ] 紐付き setup ≥ 1 件の場合 + knockdown_advantage 変更で `KnockdownAdvantageChangeModal` が表示される
- [ ] 紐付き setup 0 件の場合 + knockdown_advantage 変更でモーダル非表示、保存処理が直接実行される
- [ ] knockdown_advantage 変更なしの場合、モーダル非表示、保存処理が直接実行される
- [ ] モーダル「保存続行」で `useUpdateCombo` が `setupCarryOptions` 付きで発火される
- [ ] モーダル「キャンセル」で保存処理が中断され、変更前のコンボ状態が維持される

### 10.2 通知(§4.10.2、v1.0.1 で実装方針確定: 既存 topMessage 流用)

- [ ] (a) 保存方式 + knockdown_advantage 変わらない場合: 既存 ComboEditor topMessage パターン経由で「紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください」(DES-005 §5.7 規定の引用)が表示される
- [ ] (b) 保存方式 + knockdown_advantage 変わらない場合: 通知なし
- [ ] **トースト系ライブラリの新規追加が含まれていない**(`react-hot-toast` / `sonner` / `@radix-ui/react-toast` 等が web/package.json に追加されていない、v1.0.1 で確定したスコープ外条項)
- [ ] §3.4.5 着手前確認で確認した既存 topMessage パターンを再利用している(新規のメッセージ表示基盤を実装していない)
- [ ] setup 詳細画面への遷移リンクは v1.0.1 では含めない仕様であり、完了報告で本判断が明記されている(複数 setup 対応で UX 設計が必要、M5 以降で再検討)

### 10.3 既存編集機能の回帰なし

- [ ] M4-02 完了状態の編集機能が変わらない
- [ ] M2-02 で確立した編集 2 方式分離が変わらない
- [ ] M3-05 統合 E2E シナリオが回帰しない

---

## 11. CHANGE-013 (DES-005 §5.7 v2.8.0) 整合性チェック(最重要)

### 11.1 確認モーダルの発火条件

- [ ] **確認モーダルが (a)(b) どちらの保存フローでも発火する**(CHANGE-013 確定仕様、案 X 採用、最重要)
- [ ] (a) 重複判定キー変更編集 + knockdown_advantage 変更 + 紐付き setup ≥ 1 件: モーダル発火
- [ ] (b) メタデータ編集 + knockdown_advantage 変更 + 紐付き setup ≥ 1 件: モーダル発火

### 11.2 knockdown_advantage が変わらない場合の挙動

- [ ] (a) 保存方式 + knockdown_advantage 変わらない: 既存の自動引き継ぎロジック + トースト通知
- [ ] (b) 保存方式 + knockdown_advantage 変わらない: combo_setups は変化しない、トースト通知なし

---

## 12. テストの妥当性(§5.1)

### 12.1 バックエンドテスト

- [ ] `GetSetupCandidates` サービス層テスト:
  - 同一キャラ + 同一 knockdown_advantage で候補が返る
  - 親コンボ自身を除外
  - 論理削除済み除外
  - knockdown_advantage NULL で候補 0 件
  - 親コンボが存在しないとき not_found
  - 候補 0 件で空配列
- [ ] `GetSetupCandidates` ハンドラ層テスト:
  - レスポンス JSON が `{"items": []}` 形式
  - 要素型が `SetupSummary`(steps なし、createdAt / updatedAt なし)
- [ ] コンボ更新 API テスト:
  - `Mode = "carry_all"` で combo_setups 変化なし
  - `Mode = "unlink_all"` で combo_setups 全削除
  - `Mode = "individual"` で指定 ID のみ維持
  - `Mode = "invalid"` で 400 + `invalid_setup_carry_mode`
  - knockdown_advantage 変更 + setupCarryOptions nil + 紐付き ≥ 1 で 400 + `missing_setup_carry_options`
  - knockdown_advantage 変更なし + setupCarryOptions nil で既存挙動

### 12.2 フロントエンドテスト

- [ ] `useSetupCandidates` テスト:
  - comboId 指定で fetch 成功
  - null / 0 で disabled
  - queryKey が number 正規化済み
- [ ] `SetupCandidateList` テスト:
  - 候補一覧の表示
  - 紐付け追加ボタンで `useCreateSetupLink` 発火
- [ ] `KnockdownAdvantageChangeModal` テスト:
  - モード選択 3 つ
  - 「個別に選択」でチェックボックス展開
  - デフォルト全 ON
  - 「保存続行」で onConfirm 呼び出し(各モードの構造確認)
  - 「キャンセル」で onCancel 呼び出し
- [ ] `ComboDetailPage` テスト:
  - §5.6 item 9 セクションが候補 ≥ 1 件で表示
  - 候補 0 件で非表示
  - item 1〜8、10 が回帰なし
- [ ] `ComboEditorPage` テスト:
  - knockdown_advantage 変更 + 紐付き ≥ 1 件でモーダル表示
  - knockdown_advantage 変更 + 紐付き 0 件でモーダル非表示
  - knockdown_advantage 変更なしでモーダル非表示
  - モーダル「保存続行」で `useUpdateCombo` が setupCarryOptions 付きで発火

### 12.3 ビルド・型チェック

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] `go test ./...` が全通過する(setup / combo 系の新規 + 既存テスト回帰なし)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

### 12.4 E2E シナリオ動作確認手順書(M4-02 E2E 由来知見: 完了判定の必須ゲート)

- [ ] 製造担当の完了報告に §5.2 E2E シナリオ A〜I の手順書が含まれている
- [ ] シナリオ A: FR011 候補表示(候補あり)
- [ ] シナリオ B: FR011 候補表示(候補なし、セクション非表示)
- [ ] シナリオ C: FR011 候補から紐付け追加
- [ ] シナリオ D: knockdown_advantage 確認モーダル(carry_all)
- [ ] シナリオ E: knockdown_advantage 確認モーダル(unlink_all)
- [ ] シナリオ F: knockdown_advantage 確認モーダル(individual)
- [ ] シナリオ G: knockdown_advantage 確認モーダル(キャンセル)
- [ ] シナリオ H: knockdown_advantage 変更なし(モーダル非表示)
- [ ] シナリオ I: 既存機能の回帰(M3-05 統合 E2E 含む)
- [ ] **レビュー完了承認 ≠ M4-03 完了承認**: E2E 実機確認が完了判定の必須ゲートであることを完了報告で明示

---

## 13. コード品質・規約遵守

- [ ] CLAUDE.md §4 TypeScript / Go 規約に準拠(camelCase、関数コンポーネント + Hooks、JSON タグ camelCase)
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層・コンポーネント層・ページ層・サービス層・リポジトリ層・ハンドラ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない(意図的な console.warn を除いて console.log が残っていない)
- [ ] **architecture-patterns.md §1 フック分離パターンに準拠**(コンポーネントから API 直接呼びなし、フック経由)
- [ ] **architecture-patterns.md §1.1 TanStack Query queryKey 規約**(URL パラメータの number 正規化)に準拠
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-02 で確定した SetupSummary 軽量型を再利用**(候補一覧は SetupResponse[] ではなく SetupSummary[])
- [ ] **playbook §4.5 フローの素直さ原則**に抵触していない(エラー駆動再試行禁止、N+1 回避、原子性確保)
- [ ] **playbook §4.5.2 サーバーサイド防御**(`missing_setup_carry_options` を API 単体使用時の防御として実装)
- [ ] setup 系のエラーコードが **小文字スネーク** で統一されている(`invalid_setup_carry_mode` / `missing_setup_carry_options` / `invalid_combo_id` / `not_found`)
- [ ] **共通エラー型 `model.APIErrorResponse` を直接呼び出している**(architecture-patterns.md §3、独自ヘルパなし)

---

## 14. ドキュメント・進捗ログ

- [ ] `docs/progress/progress-log.md` に M4-03 完了報告が追記されている
- [ ] §3.4 着手前確認結果(全 4 項目、特に §3.4.2 M2-02 編集 2 方式分離の実態確認)が含まれている
- [ ] §4.11 設計判断事項表の各項目が指示書通りに実装された旨が明記されている
- [ ] CHANGE-013 (DES-005 §5.7 v2.8.0) を前提とした実装(確認モーダルが (a)(b) 両方の保存フローで発火)が明記されている
- [ ] **§5.2 E2E シナリオ A〜I の実機確認結果**(回帰なし)が明記されている
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)が明記されている

---

## 15. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** と判定し M4-03 完了承認を保留する:

- §1.1 ファイル一覧チェックで 3 件以上の未充足(バックエンド新設・修正 + フロントエンド新設・修正)
- §1.4 スコープ外への変更が含まれている(§4.4 / §4.5 以外のバックエンド変更、M4-01 setup CRUD API シグネチャ変更、コンボ + セットプレイ同時登録実装、削除 UI 実装、モック実装、DB マイグレーション追加、**トースト系ライブラリの新規追加(react-hot-toast / sonner / @radix-ui/react-toast 等、v1.0.1 で確定したスコープ外条項)** 等)
- **§11.1 CHANGE-013 違反**(確認モーダルが (a) のみまたは (b) のみで発火、両保存方式での発火条件を満たしていない、最重要)
- **§4.2 型定義違反**: 候補一覧 API のレスポンス要素型が `SetupResponse[]`(詳細型)になっている(SetupSummary 軽量型を使うべき)
- §6 useSetupCandidates の queryKey が string のまま(number 正規化されていない、architecture-patterns.md §1.1 違反)
- §7.1 / §8.1 Props 設計で YAGNI 違反(現時点で内部で使わない props が含まれている)
- §10.1 knockdown_advantage 変更 + 紐付き setup ≥ 1 件の場合にモーダル表示されない、または変更なしでモーダル表示される
- §5.4 M3-05 統合 E2E シナリオが回帰している(`GET /api/combos/{id}` 既存呼び出しや M2-02 編集挙動が影響を受けた、最重要)
- §5.3 エラーコードが小文字スネークで統一されていない(`VALIDATION_FAILED` 等大文字混在)
- §13 shadcn/ui が使用されている(playbook §4.6 違反)
- §13 architecture-patterns.md §1 フック分離パターン違反(コンポーネントに API 呼び出し直書き等)
- §4.2 リポジトリ層で N+1 問題が発生している(parentComboIds の個別取得等、playbook §4.5 違反)

---

## 16. レビュー報告書フォーマット

機械レビュー完了時に以下を含む報告書を `docs/progress/m4-03-review.md` として出力:

```markdown
# M4-03 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ ファイル一覧: 全 NN 件中 NN 件確認
- ✅ / ⚠️ / ❌ CHANGE-013 (DES-005 §5.7) 整合性
- ✅ / ⚠️ / ❌ §11.1 確認モーダルの発火条件((a)(b) 両保存方式)
- ✅ / ⚠️ / ❌ §4.2 SetupSummary 軽量型の利用
- ...

## 3. 検出した問題
### 3.1 重大な問題(完了承認保留)
- (該当する場合)

### 3.2 軽微な問題(完了承認可、改善推奨)
- (該当する場合)

### 3.3 改善提案(次回マイルストーン以降)
- (該当する場合)

## 4. 制約事項
- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、E2E シナリオの実行)は別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見)
- E2E シナリオ A〜I の手動確認は開発者の責任範囲

## 5. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
```

---

*以上*
