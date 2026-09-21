# M4-02 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M4-02-setup-ui-and-link-operations.md` v1.0.0 |
| バージョン | 1.0.4 |
| 推奨レビューモデル | Sonnet 4.6 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-16 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-16 | 初版作成 |
| 1.0.1 | 2026-05-16 | M4-02 指示書 v1.0.1 改訂(Plan Mode 中の問題 A / B 判断結果反映)に追随。§1.1 ファイル一覧チェックにバックエンド追加・修正 12 ファイルを追加、§10 ComboDetailPage の setup 取得経路を案 B1 確定で検査、§11.3 案 A1 / B1 採用後の API 仕様整合性を検査する新節を追加、§15 重大問題判定基準にバックエンド変更スコープ違反項目を追加 |
| 1.0.2 | 2026-05-17 | M4-02 指示書 v1.0.2 改訂(実装完了後の連絡事項 4 件)に追随。§2 setup フロント型定義チェックに `SetupSummary` の存在確認と構成検査を追加、§6 SetupBasicInfoForm の `mode` prop 削除を検査、§11.3 §4.13.1 のレスポンス要素型 `SetupSummary` 検査に変更、軽量型(steps なし、createdAt / updatedAt なし、parentComboIds と defaultRecipe を含む)の各フィールド検査を明示 |
| 1.0.3 | 2026-05-17 | M4-02 指示書 v1.0.3 改訂(開発者 E2E テスト中の 4 件の指摘対応)に追随。§7 SetupAccordionItem の検査項目を **行クリック=編集遷移 / 展開アイコン=展開トグル** の分離検査に変更(DES-005 §5.6 アクション準拠、stopPropagation 動作確認含む)。§10 シナリオ E 削除に伴う検査整理、§15 重大判定基準に「DES-005 §5.6 アクション違反(行クリックで編集遷移しない)」を追加。連絡事項 C / F は指示書側修正不要のため検査項目変更なし(開発者 E2E シナリオ側の修正で対応) |
| 1.0.4 | 2026-05-17 | M4-02 指示書 v1.0.4 改訂(`Setup.description` / `Setup.name` の文字数制限なし明文化)に追随。§6 SetupBasicInfoForm の検査項目に「name / description は文字数制限なし、console.warn なし」を追加。実装変更を伴わない指示書側の明文化のみが対象のため、追加実装の検査項目は不要 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

レビュー担当 Claude Code は以下を読んでからレビューに着手する:

- M4-02 指示書本体(`docs/instructions/M4-02-setup-ui-and-link-operations.md`)
- 本チェックリスト(全節)
- CLAUDE.md(§4 TypeScript 規約、§5 テスト規約、§10 禁止事項)
- DES-005 §5.6 item 8 / §5.9
- **M4-01 指示書 v1.0.2 §4.2 / §4.2.1**(共通 `SetupResponse` 型 / `ParentComboIDs []int64` 配列統一、M4-02 のフロント実装はこの API 形を前提とする)
- architecture-patterns.md §1 フック分離パターン
- CHANGE-003 通知書(セットプレイ編集画面側に紐付け操作を持たせない方針の経緯)
- 製造担当の実装完了報告(`docs/progress/progress-log.md` 末尾、E2E 手順書含む)
- 関連既存ファイル(setup フィーチャの新規ファイル、修正された ComboDetailPage / ComboEditorPage、ルーティング)

### 0.2 レビューの基本姿勢

本指示書は **M4 期間の主要フロント実装**。setup 単体 UI を新設し、コンボ詳細・コンボ編集に紐付け操作 UI を組み込む。以下を意識する:

- **設計書節への一致**: DES-005 §5.6 item 8 / §5.9 と実装が一致しているか
- **CHANGE-003 適用**: セットプレイ編集画面側に紐付け操作 UI を実装していないか(最重要設計判断)
- **M4-01 API との整合**: フロント型定義が共通 `SetupResponse` 型(`parentComboIds: number[]` 配列)と一致しているか、`Setup.deletedAt` / `SetupStep.setupId` が API レスポンスに出ない前提で実装しているか
- **フック分離パターン遵守**: api/ + hooks/ + components/ + types.ts の構造、ロジックがフックに、表示がコンポーネントに分離されているか
- **M3 完了状態の回帰なし**: ComboDetailPage / ComboEditorPage の既存セクションが破壊されていないか
- **shadcn/ui 不使用**: 標準 HTML + Tailwind 自作で書かれているか
- **VAL-S05 整合**: 新規セットプレイ作成エントリポイントがコンボ詳細・コンボ編集の「セットプレイ追加」ボタンのみで、`SetupEditorPage` への直接ルートで新規作成ができない構造か

### 0.3 レビュー結果の報告フォーマット

レビュー結果は以下のフォーマットで開発者に報告する:

```
## M4-02 レビュー結果

### 重大な問題(検出された場合、§12 判定基準)
- (なし / 列挙)

### 軽微な問題(検出された場合、§13 判定基準)
- (なし / 列挙)

### 機械的チェック通過状況
- §1〜§10 各節の通過項目数 / 全項目数

### 設計意図整合確認
- §5(CHANGE-003 適用)で問題なし / 問題あり
- §6(M4-01 API との整合・共通 SetupResponse 型)で問題なし / 問題あり
- §7(フック分離パターン遵守)で問題なし / 問題あり

### 完了判定
- §14 通り「重大な問題なし → 完了承認待ち」/「重大な問題あり → 修正要求」
```

---

## 1. 指示書本体との照合(最重要観点)

### 1.1 §2.1 / §2.2 ファイル一覧との一致

#### setup フィーチャ新規作成

- [ ] `web/src/pages/SetupEditorPage.tsx` および `.test.tsx` が存在
- [ ] `web/src/features/setup/api/setupApi.ts` および `.test.ts` が存在
- [ ] `web/src/features/setup/types.ts` が存在
- [ ] `web/src/features/setup/hooks/useSetup.ts` および `.test.ts` が存在
- [ ] `web/src/features/setup/hooks/useCreateSetup.ts` が存在
- [ ] `web/src/features/setup/hooks/useUpdateSetup.ts` が存在
- [ ] `web/src/features/setup/hooks/useDeleteSetup.ts` が存在
- [ ] `web/src/features/setup/hooks/useSetupLinks.ts` が存在(`useCreateSetupLink` / `useDeleteSetupLink`)
- [ ] `web/src/features/setup/hooks/useCharacterSetups.ts` が存在
- [ ] `web/src/features/setup/components/SetupBasicInfoForm.tsx` および `.test.tsx` が存在
- [ ] `web/src/features/setup/components/SetupRecipeEditor.tsx` および `.test.tsx` が存在
- [ ] `web/src/features/setup/components/SetupAccordionItem.tsx` および `.test.tsx` が存在
- [ ] `web/src/features/setup/components/LinkExistingSetupModal.tsx` および `.test.tsx` が存在

#### 既存ページ修正

- [ ] ComboDetailPage(または相当)にセットプレイ展開セクション(§5.6 item 8)が追加されている
- [ ] ComboDetailPage に「セットプレイ追加」ボタンが配置されている
- [ ] ComboDetailPage に「既存セットプレイから紐付け」ボタンが配置されている
- [ ] ComboEditorPage(または相当)に「既存セットプレイから紐付け」ボタンが配置されている
- [ ] ルーティング(`web/src/router.tsx` 等)に setup 関連ルートが追加されている

#### バックエンド追加・修正(v1.0.1 で追加、§4.13 API 追加・拡張)

- [ ] `internal/api/setup/handler.go` に `ListSetups` ハンドラ追加(`GET /api/setups?characterId=X`)
- [ ] `internal/api/setup/handler_test.go` に `ListSetups` テスト追加
- [ ] `internal/api/setup/dto.go` に `ListSetupsResponse`(`{"items": []SetupResponse}` 形)追加
- [ ] `internal/service/setup/service.go` に `ListSetupsByCharacter` 関数追加
- [ ] `internal/service/setup/service_test.go` にテスト追加
- [ ] `internal/repository/setup/repository.go` にキャラ別 List クエリ追加
- [ ] `internal/repository/setup/repository_test.go` にテスト追加
- [ ] `internal/api/router.go`(または相当) に `GET /api/setups` ルート登録
- [ ] `internal/api/combo/dto.go`(または相当) の `ComboDetailResponse` に `Setups []SetupResponse \`json:"setups"\`` フィールド追加
- [ ] `internal/service/combo/get.go`(または相当) にコンボ詳細取得時の setup 一覧 JOIN 取得追加
- [ ] `internal/service/combo/get_test.go`(または相当) に setup 埋め込みレスポンステスト追加
- [ ] `internal/repository/combo/repository.go`(または相当) に setup 一覧取得用のリポジトリメソッド呼び出し追加

#### スコープ外への変更がないこと(§2.3 / §2.4、v1.0.1 で精密化)

- [ ] **§4.13.1 / §4.13.2 以外のバックエンド変更が含まれていない**(M4-01 で完成した setup CRUD API のシグネチャ変更、コンボ作成・更新・削除 API の本体ロジック変更等は禁止)
- [ ] M4-01 で実装した setup CRUD API の既存エンドポイント(`POST/GET/PATCH/DELETE /api/setups/...`、`POST/DELETE /api/combos/{id}/setup-links/...`)が変更されていない
- [ ] M4-00 / M4-00b で実装した RecipeBuilder / ModifiersEditor のフロント側ファイルに変更が入っていない
- [ ] FR011 候補セクション(DES-005 §5.6 item 9)の実装が **含まれていない**(M4-03 のスコープ)
- [ ] knockdown_advantage 確認モーダル(DES-005 §5.7 (a))の実装が **含まれていない**(M4-03 のスコープ)
- [ ] コンボ + セットプレイ同時登録セクション(DES-005 §5.7 item 10)の実装が **含まれていない**(M4-04 のスコープ)
- [ ] セットプレイ独立一覧画面が新設されていない(DES-005 §2 で「独立一覧なし」と明示)
- [ ] DB マイグレーションが新規追加されていない(本指示書 §4.13 でテーブル DDL 変更はない)

### 1.2 §3.4 着手前確認の報告

- [ ] §3.4.1 setup API 動作確認結果が報告に含まれている(特に `parentComboIds` が配列で返る確認)
- [ ] §3.4.2 既存 RecipeBuilder / SF6Controller / ModifiersEditor の構造確認結果が報告に含まれている
- [ ] §3.4.3 既存 ComboDetailPage / ComboEditorPage の構造確認結果が報告に含まれている
- [ ] §3.4.4 useCharacters / mycombo フックの確認結果が報告に含まれている
- [ ] §3.4.5 既存ルーティング構造の確認結果が報告に含まれている

---

## 2. setup フロント型定義(§4.2)

### 2.1 types.ts の構造

- [ ] `Setup` インターフェースに `recipeCache` / `deletedAt` が **含まれていない**(M4-01 v1.0.2 で `json:"-"` 化、API に出ない前提)
- [ ] `SetupStep` インターフェースに `setupId` が **含まれていない**(M4-01 v1.0.2 で `json:"-"` 化)
- [ ] `SetupResponse` インターフェースに `parentComboIds: number[]`(**配列**)が含まれている(`parentComboId` 単数になっていない)
- [ ] `SetupResponse` が新規作成・詳細取得・更新の 3 経路で共通利用される型として定義されている(M4-01 v1.0.2 と整合)
- [ ] **`SetupSummary` インターフェースが定義されている**(v1.0.2 で追加、`Omit<Setup, 'createdAt' | 'updatedAt'>` 相当 + `defaultRecipe: string` + `parentComboIds: number[]`、steps を **含まない**)
- [ ] **`SetupSummary` は一覧表示用、`SetupResponse` は詳細表示用** という使い分けが types.ts のコメントで明示されている(M3 期間で確立した `ComboSummary` vs `Combo` 規約と整合)
- [ ] `CreateSetupInput` の構造が M4-01 §4.2.1 と整合(`characterId` / `name?` / `description?` / `steps[]`)
- [ ] `UpdateSetupInput` の `version` フィールドが必須(楽観的排他、M4-01 §4.2.5)
- [ ] `UpdateSetupInput.Steps` が `SetupStepInput[]` で `undefined` / `[]` / 値 の 3 状態を区別できる構造
- [ ] フィールド名がすべて camelCase(CLAUDE.md §4、`stepCount` / `defaultRecipe` / `parentComboIds` 等)

---

## 3. API クライアント(§4.3)

### 3.1 setupApi の関数定義

- [ ] `create(comboId, input)` が `POST /api/combos/{comboId}/setups` を呼ぶ
- [ ] `createLink(comboId, setupId)` が `POST /api/combos/{comboId}/setup-links` を呼ぶ
- [ ] `deleteLink(comboId, setupId)` が `DELETE /api/combos/{comboId}/setup-links/{setupId}` を呼ぶ
- [ ] `get(id)` が `GET /api/setups/{id}` を呼ぶ
- [ ] `update(id, input)` が `PATCH /api/setups/{id}` を呼ぶ
- [ ] `remove(id)` が `DELETE /api/setups/{id}` を呼ぶ(`delete` 予約語回避)
- [ ] 既存 API クライアント(`mycomboApi` / `comboApi` 等)と命名規約が一致(§3.4.4)

---

## 4. フック層(§4.4)

### 4.1 各フックの実装

#### useSetup(§4.4.1)

- [ ] `queryKey: ['setup', { id: setupId }]` 形式
- [ ] `enabled: !!setupId && setupId > 0` で null / 0 / 未定義時に fetch しない
- [ ] TanStack Query の `useQuery` を使用

#### useCreateSetup(§4.4.2)

- [ ] `mutationFn` が `setupApi.create(comboId, input)` を呼ぶ
- [ ] `onSuccess` で新規 setup キャッシュをセット(`queryClient.setQueryData`)
- [ ] `onSuccess` で親コンボキャッシュを無効化(`queryClient.invalidateQueries`)

#### useUpdateSetup(§4.4.3)

- [ ] `mutationFn` が `setupApi.update(id, input)` を呼ぶ
- [ ] `onSuccess` で setup キャッシュをセット
- [ ] **`data.parentComboIds.forEach` ですべての紐付くコンボキャッシュを無効化**(配列対応、M4-01 v1.0.2 整合)
- [ ] `version` 必須(`UpdateSetupInput` 型レベル)

#### useDeleteSetup(§4.4.4)

- [ ] `mutationFn` が `setupApi.remove(id)` を呼ぶ
- [ ] 親コンボキャッシュ無効化用に `parentComboIds` を引数で受け取る(削除前に取得した値)
- [ ] `onSuccess` で setup キャッシュ削除 + 親コンボキャッシュ無効化

#### useSetupLinks(§4.4.5)

- [ ] `useCreateSetupLink` / `useDeleteSetupLink` の 2 つを export
- [ ] 両者とも `onSuccess` で combo / setup 両方のキャッシュを無効化

#### useCharacterSetups(§4.4.6、v1.0.2 で SetupSummary 確定)

- [ ] `queryKey: ['setups', { characterId }]` 形式
- [ ] `enabled: !!characterId && characterId > 0`
- [ ] **戻り値型が `SetupSummary[]`**(v1.0.2 で確定、`SetupResponse[]` ではない)
- [ ] API 経路は **案 A1 確定**(`GET /api/setups?characterId=X`、v1.0.1)
- [ ] §3.4.1 確認結果と整合(`GET /api/setups?characterId=X` が動作している)

### 4.2 フック分離パターンの遵守(architecture-patterns.md §1)

- [ ] フックには UI ロジックを含めない(React コンポーネントの JSX を返さない)
- [ ] コンポーネントは表示専用(API 呼び出しを直接含まない、フック経由)
- [ ] api/ + hooks/ + components/ + types.ts の構造が守られている

---

## 5. SetupRecipeEditor(§4.5)

### 5.1 機能要件

- [ ] SF6Controller を内包してステップ追加 UI を提供
- [ ] ステップ並び替え(上下ボタン、ドラッグ&ドロップは実装しない、M4 スコープ外)
- [ ] 各ステップの modifiers 編集が動作する
- [ ] ステップ削除が動作する

### 5.2 console.warn ロジック(§4.5.3、M4-00 / M4-00b と同パターン)

- [ ] `modifiers.notes` 50 文字超時に `console.warn` が発火
- [ ] 警告文言に「50 文字を超えています」と実際の文字数が含まれる
- [ ] `useEffect` の依存配列が `[steps]`(または相当のステップ配列)
- [ ] 50 文字以下に減らした後の追加発火がない
- [ ] M4-00 / M4-00b で確立した RecipeBuilder / ModifiersEditor の console.warn パターンと整合

### 5.3 Props 設計

- [ ] `characterId: number` / `steps: SetupStepInput[]` / `onChange: (newSteps) => void` の最小限の props
- [ ] 不要な props(parent state 直接操作等)が含まれていない

---

## 6. SetupBasicInfoForm(§4.6、v1.0.2 で mode prop 削除)

### 6.1 動作要件(両モード共通、v1.0.2 で統合)

- [ ] **キャラクター選択が常に読み取り専用表示**(新規作成時は親コンボから自動設定された値、編集時は既存 setup の値、いずれも変更不可)
- [ ] 名前・説明は任意入力、空文字許可
- [ ] キャラクター名表示が `useCharacterName`(M3-04 §4.1.2)を使用

### 6.2 Props 設計(v1.0.2 で mode prop 削除)

- [ ] **`SetupBasicInfoFormProps` に `mode` フィールドが含まれていない**(v1.0.2 で削除、YAGNI 違反解消)
- [ ] Props は `characterId` / `name` / `description` / `onChange` の 4 つのみ
- [ ] 親(`SetupEditorPage`)が新規 / 編集モード分岐を吸収し、フォーム本体には渡さない責務分担になっている

### 6.3 文字数制限の仕様確認(v1.0.4 で明示)

- [ ] **`name` / `description` に文字数制限なし**(`maxLength` 属性などフロント側の入力制限がない、API 側 VAL でも文字数チェックなし、`modifiers.notes` の console.warn とは別扱い)
- [ ] **`name` / `description` で console.warn を発火させていない**(50 文字超でも警告ログを出さない)
- [ ] `modifiers.notes` の console.warn 警告は `SetupRecipeEditor` 配下のみが対象で、`SetupBasicInfoForm` には実装されていない

---

## 7. SetupAccordionItem(§4.7、v1.0.3 で行クリック挙動を DES-005 §5.6 アクション準拠に修正)

### 7.1 行クリック / 展開アイコンの動作分離(最重要、v1.0.3 で確定)

- [ ] **行クリック(展開アイコン領域以外のヘッダー部) = 編集画面(`/setups/:setupId`)に遷移**(DES-005 §5.6 アクション「セットプレイ行クリック → セットプレイ編集画面」準拠)
- [ ] **展開アイコン(▶/▼)クリック = 展開・折りたたみトグル**(DES-005 §5.5 コンボ一覧アコーディオン UI 規約準拠)
- [ ] 展開アイコンの onClick で `event.stopPropagation()` が呼ばれ、行クリック(編集遷移)が発火しない
- [ ] 紐付け解除ボタンの onClick で `event.stopPropagation()` が呼ばれ、行クリック(編集遷移)が発火しない
- [ ] `useNavigate` または `onEdit` prop 経由で `/setups/:setupId` に遷移する

### 7.2 表示仕様

- [ ] 展開時に setup 名 + レシピ(defaultRecipe 文字列)+ 紐付け解除ボタンが表示される
- [ ] 折りたたみ時に setup 名 + 展開アイコン(▶)+ 補助情報(ステップ数等)が表示される
- [ ] 紐付け解除ボタンが `useDeleteSetupLink` を発火
- [ ] 紐付け解除時に `window.confirm` で確認ダイアログ
- [ ] **編集ボタンは原則として配置されていない**(行クリック = 編集遷移が DES-005 §5.6 アクションの直接表現のため、独立した編集ボタンを置く必要はない)。展開時の領域内に「編集」と表示する補助テキスト or 視覚ヒントは許容。

---

## 8. LinkExistingSetupModal(§4.8)

### 8.1 機能要件

- [ ] 親コンボのキャラ ID で `useCharacterSetups` を呼ぶ
- [ ] **既に当該コンボに紐付いている setup は候補から除外**(`setup.parentComboIds` に親コンボ ID が含まれる setup は除外、§4.8.1)
- [ ] 候補 0 件時に「同一キャラの紐付け候補がありません」を表示
- [ ] 候補クリックで `useCreateSetupLink` を発火、成功時にモーダルを閉じる

### 8.2 モーダル実装(§4.8.3)

- [ ] **標準 HTML + Tailwind 自作で実装**(shadcn/ui 不使用、playbook §4.6)
- [ ] `open` props で開閉
- [ ] `<div className="fixed inset-0 ...">` 等で全画面オーバーレイ

---

## 9. SetupEditorPage(§4.9)

### 9.1 ルーティング(§4.9.1)

- [ ] 新規作成パス: `/combos/:comboId/setups/new`(親コンボ ID 必須、VAL-S05 整合)
- [ ] 編集パス: `/setups/:setupId`
- [ ] **`/setups/new`(comboId なし)では新規作成できない構造**(VAL-S05 整合、最重要)

### 9.2 ページ動作

- [ ] 新規作成モード: 親コンボから characterId を `useCombo(comboId)` 経由で取得・自動設定
- [ ] 編集モード: `useSetup(setupId)` から初期値ロード、`version` を保存時に PATCH ペイロードに含める
- [ ] 保存ボタンで `useCreateSetup` / `useUpdateSetup` を発火
- [ ] キャンセルボタンで `navigate(-1)`(または相当)
- [ ] 新規作成成功時に親コンボ詳細に遷移
- [ ] 編集保存成功時に元の画面に戻る

### 9.3 バージョン不一致の扱い

- [ ] PATCH の 409 レスポンス時にエラー表示(`version_conflict` エラーコード、M4-01 §4.7)
- [ ] エラー表示後に最新版を取得して再表示する手段がある(再ロード等)

---

## 10. ComboDetailPage / ComboEditorPage の修正(§4.10 / §4.11)

### 10.1 ComboDetailPage(§4.10)

- [ ] **セットプレイ展開セクションが §5.6 item 8 の位置に追加されている**
- [ ] `SetupAccordionItem` で紐付き setup 一覧をアコーディオン展開
- [ ] 「セットプレイ追加」ボタンが配置されている → `/combos/:comboId/setups/new` に遷移
- [ ] 「既存セットプレイから紐付け」ボタンが配置されている → `LinkExistingSetupModal` を開く
- [ ] **FR011 候補セクション(§5.6 item 9)が実装されていない**(M4-03 のスコープ、コードコメントで明記)
- [ ] M3 完了状態の §5.6 item 1〜7、10 が変わらない(回帰なし)

### 10.2 setup 一覧の取得経路(§4.10.2)

### 10.2 setup 一覧の取得経路(§4.10.2、v1.0.1 で案 B1 確定)

- [ ] **`useCombo(id)` のレスポンス `combo.setups: SetupResponse[]` を直接使用している**(案 B1、§4.13.2 で `ComboDetailResponse` 拡張済み)
- [ ] 別 fetch 用フック(`useComboSetups` 等)が新設されていない(案 B2 不採用、v1.0.1 確定)
- [ ] 紐付き setup が 0 件のコンボでは `combo.setups: []`(空配列)が返り、表示も空状態が正しく描画される
- [ ] `useCreateSetup` / `useUpdateSetup` / `useDeleteSetup` / `useCreateSetupLink` / `useDeleteSetupLink` の onSuccess でコンボ詳細キャッシュ(`['combo', { id }]`)が無効化され、setup 一覧の連動更新が動作する

### 10.3 ComboEditorPage(§4.11)

- [ ] 「既存セットプレイから紐付け」ボタンが配置されている
- [ ] **新規セットプレイ同時登録セクション(§5.7 item 10)が実装されていない**(M4-04 のスコープ)
- [ ] M3 完了状態の編集機能が変わらない(回帰なし)

---

## 11. CHANGE-003 適用の確認(最重要設計判断)

### 11.1 セットプレイ編集画面側に紐付け操作 UI を実装していない

- [ ] **`SetupEditorPage` 内に「コンボに紐付ける」「コンボから紐付け解除」操作 UI が存在しない**(CHANGE-003、DES-005 §5.9 アクション末尾)
- [ ] `SetupEditorPage` で表示する内容: キャラ・名前・説明・レシピ・保存/キャンセル/削除のみ
- [ ] 紐付け追加・解除はコンボ詳細・コンボ編集画面側からのみ可能

### 11.2 紐付け関連操作の経路一元化

- [ ] 新規セットプレイ作成エントリポイント: コンボ詳細・コンボ編集の「セットプレイ追加」ボタンのみ
- [ ] 既存セットプレイ紐付け追加: コンボ詳細・コンボ編集の「既存セットプレイから紐付け」ボタンのみ
- [ ] 紐付け解除: コンボ詳細のセットプレイ展開行の「紐付け解除」ボタンのみ

### 11.3 v1.0.1 で追加: API 追加・拡張の整合性確認(§4.13)

#### §4.13.1 `GET /api/setups?characterId=X` の検査

- [ ] エンドポイント `GET /api/setups?characterId=X` が動作する
- [ ] レスポンス JSON が `{"items": [...]}` 形(配列レスポンスの統一形)
- [ ] 各 setup の JSON フィールド名が camelCase(`stepCount` / `defaultRecipe` / `parentComboIds` 等)
- [ ] **レスポンス要素型が `SetupSummary`**(v1.0.2 で確定): `steps` フィールドが含まれない、`createdAt` / `updatedAt` フィールドが含まれない、`defaultRecipe` / `parentComboIds` は含まれる
- [ ] 論理削除済み setup が除外される
- [ ] 各 setup の `parentComboIds` が配列で正しく取得される(`combo_setups` JOIN 検証)
- [ ] **`characterId` 必須**: 未指定で 400 + `invalid_query_parameter`(小文字スネークケース、v1.0.2 で「必須」を明示)
- [ ] 存在しないキャラ ID 指定で 200 + `{"items": []}`(空配列、エラーではない)

#### §4.13.2 `GET /api/combos/{id}` レスポンス拡張の検査

- [ ] レスポンスに `setups: []SetupResponse` フィールドが含まれる(JSON タグ camelCase)
- [ ] 紐付く setup が 0 件のときに `setups: []`(空配列、`null` ではない)
- [ ] 紐付く setup が複数のときに正しく配列で返る
- [ ] 論理削除済み setup が除外される
- [ ] 各 setup の `parentComboIds` 配列が当該 setup の全紐付きコンボを列挙
- [ ] **M3-05 統合 E2E シナリオの再実行で全通過**(`GET /api/combos/{id}` 既存呼び出しが影響を受けない、最重要)
- [ ] N+1 問題が発生していない(1 リクエストあたりの SQL クエリ数が `setup 件数 × N` にならない)

---

## 12. テストの妥当性(§5.1)

### 12.1 フック層テスト(必須)

- [ ] `useSetup` テスト
- [ ] `useCreateSetup` テスト(成功時のキャッシュ操作確認)
- [ ] `useUpdateSetup` テスト(`parentComboIds.forEach` の動作確認)
- [ ] `useDeleteSetup` テスト
- [ ] `useCreateSetupLink` / `useDeleteSetupLink` テスト
- [ ] `useCharacterSetups` テスト

### 12.2 コンポーネントテスト(必須)

- [ ] `SetupBasicInfoForm` テスト(新規 / 編集モード切替)
- [ ] `SetupRecipeEditor` テスト(ステップ管理 + console.warn 発火)
- [ ] `SetupAccordionItem` テスト(展開・紐付け解除)
- [ ] `LinkExistingSetupModal` テスト(候補表示・既紐付け除外・候補 0 件)

### 12.3 ページコンポーネントテスト(必須)

- [ ] `SetupEditorPage` 新規モードテスト
- [ ] `SetupEditorPage` 編集モードテスト
- [ ] バージョン不一致(409)時のエラー表示テスト

### 12.4 既存ページの回帰テスト

- [ ] ComboDetailPage の M3 完了状態が変わらない
- [ ] ComboDetailPage のセットプレイ展開セクションが動作
- [ ] ComboEditorPage の M3 完了状態が変わらない

### 12.5 ビルド・型チェック

- [ ] `cd web && pnpm test` 全通過
- [ ] `cd web && pnpm build` 成功
- [ ] TypeScript 型エラーなし

### 12.6 E2E シナリオ動作確認手順書(v1.0.3 でシナリオ構成更新)

- [ ] 製造担当の完了報告に §5.2 E2E シナリオ A〜G の手順書が含まれている(v1.0.3 構成: A 新規作成、B 編集(行クリック遷移)、C 紐付け追加、D 紐付け解除、E 既存機能の回帰、F アコーディオン展開アイコン挙動、G notes 50 文字超 console.warn)
- [ ] **シナリオ B で「行クリック = 編集画面遷移」が確認されている**(DES-005 §5.6 アクション準拠、v1.0.3 確定)
- [ ] **シナリオ F で「展開アイコンクリック = 展開トグル」と「行クリックには干渉しない」が確認されている**(v1.0.3 新設)
- [ ] **シナリオ E(セットプレイ論理削除)が含まれていない**(v1.0.3 で削除、§1.3 で削除ボタン UI を M4-02 スコープ外と明確化)
- [ ] **シナリオ G で「console.warn 出力のみ」が確認されている、「登録ブロック」を検証ステップに含めていない**(§4.5.3、v1.0.3 で明示)
- [ ] **シナリオ C で「FR011 フレーム一致フィルタ」を検証ステップに含めていない**(M4-03 スコープ、v1.0.3 で明示)
- [ ] 開発者がブラウザで実機確認できる粒度で記述されている

---

## 13. コード品質・規約遵守

- [ ] CLAUDE.md §4 TypeScript 規約に準拠(camelCase、関数コンポーネント + Hooks)
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層 + コンポーネント層 + ページ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない(意図的な `console.warn` を除いて `console.log` が残っていない)
- [ ] **architecture-patterns.md §1 フック分離パターンに準拠**
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-01 共通 `SetupResponse` 型(`parentComboIds: number[]` 配列)を前提として実装**
- [ ] **`Setup.deletedAt` / `SetupStep.setupId` がフロント型定義から除外されている**(M4-01 v1.0.2 で `json:"-"` 化)
- [ ] **playbook §4.5 フローの素直さ原則に抵触していない**(エラー駆動再試行禁止)
- [ ] 既存フィーチャ(mycombo / character / combo)と同一の構造パターン(api/ + hooks/ + components/ + types.ts)

---

## 14. ドキュメント・進捗ログ

- [ ] `docs/progress/progress-log.md` に M4-02 完了報告が追記されている
- [ ] **CHANGE-003 適用**(セットプレイ編集画面側に紐付け操作を持たせない)を厳守した事実が明記されている
- [ ] §3.4 着手前確認結果が含まれている(全 5 項目)
- [ ] §4.12 設計判断事項表の各項目が指示書通りに実装された旨が明記されている
- [ ] **§4.13.1 `GET /api/setups?characterId=X` 追加実装の完了が明記されている**(v1.0.1 で追加、Plan Mode 問題 A の判断結果)
- [ ] **§4.13.2 `GET /api/combos/{id}` レスポンス拡張(`setups` フィールド追加)の実装完了が明記されている**(v1.0.1 で追加、Plan Mode 問題 B の判断結果)
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)が明記されている

---

## 15. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** と判定し M4-02 完了承認を保留する:

- §1.1 ファイル一覧チェックで 3 件以上の未充足(フロント新規 14 + ページ修正 4 + ルーティング + v1.0.1 で追加したバックエンド 12 ファイルを含む)
- **§1.1 スコープ外への変更が含まれている**: §4.13.1 / §4.13.2 以外のバックエンド変更、M4-01 で完成した setup CRUD API のシグネチャ変更、コンボ作成・更新・削除 API の本体ロジック変更、FR011 候補実装、knockdown 確認モーダル実装、同時登録セクション実装、DB マイグレーション追加等
- **§11 CHANGE-003 違反**(セットプレイ編集画面側に紐付け操作 UI が実装されている、最重要)
- **§2.1 型定義違反**: `parentComboId` 単数表記、または `Setup.deletedAt` / `SetupStep.setupId` がフロント型定義に含まれている(M4-01 v1.0.2 違反)
- §4.4.3 `useUpdateSetup` が `parentComboIds.forEach` でなく単一 ID で扱っている
- §9.1 `SetupEditorPage` の `/setups/new`(comboId なし)で新規作成できる構造(VAL-S05 整合違反)
- §10.1 ComboDetailPage の M3 完了状態(§5.6 item 1〜7、10)が破壊されている
- §11.2 新規セットプレイ作成エントリポイントが `SetupEditorPage` への直接ルートで露出している
- **§11.3 §4.13.2 ComboDetailResponse 拡張で M3-05 統合 E2E シナリオが回帰している**(既存呼び出しが影響を受けた、最重要)
- **§11.3 §4.13.1 / §4.13.2 のエラーコードが小文字スネークケースで統一されていない**(`VALIDATION_FAILED` 等大文字混在)
- **§7.1 SetupAccordionItem の DES-005 §5.6 アクション違反**(行クリックで `/setups/:setupId` に遷移しない、または展開アイコンクリックで編集遷移してしまう、v1.0.3 で確定した最重要 UI 規約)
- §13 shadcn/ui が使用されている(playbook §4.6 違反)
- §13 architecture-patterns.md §1 フック分離パターン違反(コンポーネントに API 呼び出し直書き等)
- §13 architecture-patterns.md §2 バックエンド 3 層パターン違反(handler に SQL、service に HTTP、repository にビジネスロジック)

---

## 16. 軽微な問題の判定基準

以下に該当する場合、**軽微な問題** と判定し M4-02 完了承認は許容するが、記録として残す:

- 表示文言の細部が指示書例と多少異なる
- Tailwind クラスの細部
- 確認ダイアログのメッセージ文言
- アコーディオン展開アニメーションの有無
- テストケース名の細部

---

## 17. 質問・確認事項のフォーマット

レビュー中に判断が分かれる事項を発見した場合、以下のフォーマットで開発者に質問する:

```
## 質問: M4-02 §X.Y についての判断確認

### 状況
(発見した事象、該当ファイル・行)

### 案 1: 製造担当の実装通り承認
(理由・リスク)

### 案 2: 修正を要求
(修正方針・理由)

### レビュー担当の推奨
(案 1 または案 2、理由)
```

---

## 18. レビュー完了の判定

すべて以下を満たす場合、レビュー完了として開発者に「重大な問題なし」と報告する:

- §1〜§14 の機械的チェック項目がすべて通過
- §15 重大な問題に該当する項目がゼロ
- §16 軽微な問題が存在する場合は記録されている
- 設計意図整合確認(CHANGE-003 適用 / M4-01 API との整合 / フック分離パターン遵守 / 既存ページ回帰なし)がすべて確認されている

不通過の場合は §15 / §16 のどちらに該当するかを明示し、§17 フォーマットで開発者に質問または修正要求を行う。

---

*以上*
