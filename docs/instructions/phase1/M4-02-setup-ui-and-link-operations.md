# 指示書 M4-02: セットプレイ単体 UI + コンボ詳細展開 + 紐付け操作 UI

| 項目 | 内容 |
|------|------|
| 指示書ID | M4-02 |
| バージョン | 1.0.4 |
| 対象マイルストーン | M4(セットプレイ系) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(本指示書は §3.4 着手前確認の精度を上げる方針で Plan Mode 使用を推奨) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M4-02-review-checklist.md`) |
| 並列性 | **単独**(M4 は完全直列、M4-01 完了承認済みが前提) |
| 依存指示書 | M4-01(setup API 動作中)、M3-04(useCharacters / フック分離パターン、参考)、M2-01(SF6Controller、参考) |
| 想定所要時間 | 120〜150 分 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-16 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-16 | 初版作成。M4-overview v1.1.2 §3.3 / DES-005 §5.6 / §5.9 / CHANGE-003(セットプレイ編集画面側に紐付け操作を持たせない方針)を踏まえて起票。M4-01 v1.0.2 で確定した共通 `SetupResponse` 型(`ParentComboIDs []int64`)を前提とする |
| 1.0.1 | 2026-05-16 | 製造担当 Plan Mode 中の確認(問題 A・問題 B)で発覚した M4-01 起票時の API 設計網羅性漏れを反映。(1) §2.4 例外条項に「§4.13 で確定するバックエンド API 追加・拡張」を許容する旨を追加。(2) §4.4.6 useCharacterSetups の API 経路を **案 A1 採用(`GET /api/setups?characterId=X` を M4-02 スコープ拡張で追加実装)** で確定。(3) §4.10.2 ComboDetailPage の setup 一覧取得経路を **案 B1 採用(`GET /api/combos/{id}` レスポンスに `setups: SetupResponse[]` フィールド埋め込み)** で確定。(4) §2.1 / §2.2 にバックエンド追加・修正ファイルを列挙。(5) §3.4.1 着手前確認に `GET /api/setups?characterId=X` 動作確認と `ComboDetailResponse.setups` フィールド確認を追加。(6) §4.13 新節で API 追加・拡張の具体仕様を明示。(7) §4.12 設計判断事項表に案 A1 / B1 採用を追記。(8) §5.1.5 にバックエンドテスト要件を追加。本件は設計担当(M4 期間担当)の指示書執筆ミス(API エンドポイント設計の網羅性漏れ)として retrospective-log v1.0.4 §5.1 M4-4 に記録 |
| 1.0.2 | 2026-05-17 | M4-02 実装完了後の連絡事項(4 件)を受けた事後整合修正。(1) §4.13.1 一覧 API のレスポンス型を `SetupResponse[]` から **`SetupSummary[]`(軽量型、steps なし、createdAt / updatedAt なし、parentComboIds と defaultRecipe を含む)** に修正、SetupSummary 型定義を §4.2 / §4.13.1 で明示。M3 期間で確立した `ComboSummary` vs `Combo` の一覧/詳細型分岐規約(SUPP-001 §4)と整合。(2) §4.6.1 `SetupBasicInfoFormProps` から **`mode` prop を削除**(両モードで同じ振る舞いのため不要、YAGNI 違反の解消)。§4.6.2 / §4.9.2 の関連記述も整合修正。(3) §4.13.1 末尾に「将来『全件取得』ユースケースが必要になった場合は別エンドポイントまたは管理者用クエリとして CHANGE 通知書を起こす」旨の将来課題注記を追加。連絡事項 1(characterId 必須)は §4.13.1 v1.0.1 で既に明記済み、追加修正不要。連絡事項 3(useCombo queryKey の number 統一)は architecture-patterns.md v1.0.1 §1.x として別途明文化。本件は設計担当(M4 期間担当)の指示書執筆ミス(SetupSummary 型定義漏れ + mode prop の YAGNI 違反)として retrospective-log v1.0.5 §5.1 M4-5 に合算記録 |
| 1.0.3 | 2026-05-17 | M4-02 開発者 E2E テスト中の 4 件の指摘を受けた事後整合修正。(1) §4.7 `SetupAccordionItem` の動作仕様を **行クリック = 編集画面遷移 / 展開アイコン(▶/▼)= 展開・折りたたみトグル** に修正(DES-005 §5.6 アクション「セットプレイ行クリック → セットプレイ編集画面」+ §5.5 コンボ一覧のアコーディオン UI 規約との整合)。当初 v1.0.0〜v1.0.2 では「行クリック = 展開トグル + 編集ボタン経由で遷移」と書いていたが、DES-005 §5.6 アクション節を読み込み漏れしていた設計担当(M4 期間担当)のミス。製造担当への追加実装指示として SetupAccordionItem の onClick ハンドラを修正する必要がある。(2) §5.2 シナリオ E「セットプレイ論理削除」を **削除**(§1.3 でセットプレイ削除 UI を M4-02 スコープ外と明記しているのに §5.2 にシナリオを残していた指示書内矛盾の解消)、シナリオ E〜G の番号を E(回帰)→F(行クリック挙動)→G(notes 50 文字超)に組み替え。(3) §1.3 を「セットプレイ削除ボタン UI と復元 UI を含むゴミ箱画面は M4-02 では実装しない、論理削除 API のみ M4-01 で完成済み、関連 UI は M5 以降または M7 で判断」に明確化。(4) 連絡事項 C「フレーム一致フィルタ」は M4-03 FR011 スコープ、連絡事項 F「notes 50 文字超で登録ブロック」は仕様外(console.warn のみ)で、いずれも指示書側に該当記述なし(開発者 E2E シナリオの誤認)、指示書側追加修正不要。本件は設計担当(M4 期間担当)の指示書執筆ミス(DES-005 §5.6 アクション読み込み漏れ + §1.3 と §5.2 の内部矛盾)として retrospective-log v1.0.6 §5.1 M4-6 に合算記録 |
| 1.0.4 | 2026-05-17 | 開発者 E2E テスト後の質問(`Setup.description` の 50 文字超扱い)を受けた指示書側の明文化修正。製造担当の実装は **既に仕様通り**(description / name は無制限、console.warn なし)、E2E でも確認済み。本改訂は **実装変更を伴わない指示書側の明文化のみ** で完結する性質(M4-1〜M4-6 とは異なる新パターン)。(1) §4.6.2 SetupBasicInfoForm 表示・編集仕様に「`name` / `description` は文字数制限なし、console.warn 警告なし、`modifiers.notes` 50 文字警告は setup_steps 配下のメモのみが対象」を明示。(2) §4.6.2 に `modifiers.notes` と `Setup.description` の非対称性の根拠を明示(notes はコンボレシピレンダリング文字列に連結される可能性、description は独立表示で表示崩れの懸念が小さい)。(3) §4.12 設計判断事項表に「`Setup.description` / `Setup.name` の文字数制限なし、`modifiers.notes` との非対称性」を 1 行追加、将来課題注記(上限が必要になった場合は別途 CHANGE 通知書)。本件は設計担当(M4 期間担当)の指示書執筆ミス(DES-006 §10「メモ等のテキスト入力は文字数上限を設ける」一般論との整合性を新ドメインで明文化しなかった規定漏れ)として retrospective-log v1.0.7 §5.1 M4-7 に独立記録 |

---

## 1. 背景と目的

### 1.1 背景

M4-01 で setup ドメインのバックエンド基盤(CRUD API、recipe_cache 連動、VAL-S01〜S05)が完成し、フロント側で setup を扱う準備が整った。本指示書では DES-005 §5.6(コンボ詳細)/ §5.9(セットプレイ登録・編集)の画面実装と、コンボ詳細・コンボ編集からの既存セットプレイ紐付け操作 UI(CHANGE-003 適用)を実装する。

M4-02 完了後、M4-03 で FR011 転用支援とknockdown_advantage 変更時の確認モーダル、M4-04 でコンボ + セットプレイ同時登録に進む。

### 1.2 目的

- **セットプレイ登録・編集画面**(`SetupEditorPage`、DES-005 §5.9)を新設。コンボ登録画面と同じ仮想コントローラ(SF6Controller)を再利用してレシピ入力を実現
- **`web/src/features/setup/`** ディレクトリを新設し、フック分離パターン(architecture-patterns.md §1)で UI ロジックを整備
  - フック: `useSetup` / `useCreateSetup` / `useUpdateSetup` / `useDeleteSetup` / `useSetupLinks`(combo_setups 操作)
  - 表示専用コンポーネント: `SetupRecipeEditor`、`SetupBasicInfoForm` 等
- **コンボ詳細画面のセットプレイ展開**(DES-005 §5.6 item 8): 紐付き setup 一覧をアコーディオン展開、レシピを recipe_cache 経由で表示
- **コンボ詳細・コンボ編集画面からの既存セットプレイ紐付け追加・解除 UI**(CHANGE-003 適用): 独立した紐付けモーダル経由
- **新規セットプレイ作成エントリポイントの一元化**: コンボ詳細画面 or コンボ編集画面の「セットプレイ追加」ボタン経由のみ(VAL-S05 と整合、`SetupEditorPage` への直接ルートは新規作成モード不可)

### 1.3 このマイルストーンで作らないもの

- **FR011 転用候補抽出 UI**(DES-005 §5.6 item 9) — M4-03 で実装。本指示書ではセクション自体を表示しない
- **knockdown_advantage 変更時の確認モーダル**(DES-005 §5.7 (a)) — M4-03 で実装
- **コンボ登録画面内のセットプレイ同時登録セクション**(DES-005 §5.7 item 10) — M4-04 で実装
- **セットプレイの削除ボタン UI・ゴミ箱・復元 UI**(v1.0.3 で明確化) — **論理削除 API(`DELETE /api/setups/{id}`)は M4-01 で完成済み**だが、`SetupEditorPage` 内の削除ボタン UI、ゴミ箱画面、復元 UI は本指示書では実装しない。M5 以降または M7 で判断。`SetupRecipeEditor` 内のステップ単位削除ボタン(レシピのステップ削除)は別物として M4-02 で実装する(セットプレイ本体の削除ではないため)
- **持ち越し L-01 オプショナル型整理** — M4-04 で対応
- **セットプレイ独立一覧画面** — DES-005 §2 表(画面一覧)で「独立一覧なし」と明示されている。本マイルストーンでも作らない

---

## 2. 成果物

### 2.1 作成するファイル

#### フロントエンド(setup フィーチャ、新設)

| ファイル | 内容 |
|---------|------|
| `web/src/pages/SetupEditorPage.tsx` | セットプレイ登録・編集画面(DES-005 §5.9)。新規作成モード / 編集モード分岐 |
| `web/src/pages/SetupEditorPage.test.tsx` | ページコンポーネントの統合テスト |
| `web/src/features/setup/api/setupApi.ts` | setup API クライアント関数(create / get / update / delete / link / unlink) |
| `web/src/features/setup/api/setupApi.test.ts` | API クライアントのテスト |
| `web/src/features/setup/types.ts` | フロント側型定義(`Setup` / `SetupStep` / `SetupResponse` / `SetupSummary` / `CreateSetupInput` 等、M4-01 BE DTO と整合) |
| `web/src/features/setup/hooks/useSetup.ts` | 単一 setup の取得フック(TanStack Query、`queryKey: ['setup', { id }]`) |
| `web/src/features/setup/hooks/useSetup.test.ts` | フック層テスト(M3-04 §5.1.4 パターン踏襲) |
| `web/src/features/setup/hooks/useCreateSetup.ts` | setup 新規作成 mutation フック |
| `web/src/features/setup/hooks/useUpdateSetup.ts` | setup 更新 mutation フック(楽観的排他、`version` 必須) |
| `web/src/features/setup/hooks/useDeleteSetup.ts` | setup 論理削除 mutation フック |
| `web/src/features/setup/hooks/useSetupLinks.ts` | combo_setups 操作 mutation フック(`createLink` / `deleteLink`) |
| `web/src/features/setup/hooks/useCharacterSetups.ts` | キャラ別 setup 候補一覧フック(既存 setup から選んで紐付ける UI で使用) |
| `web/src/features/setup/components/SetupBasicInfoForm.tsx` | 基本情報入力フォーム(キャラ・名前・説明) |
| `web/src/features/setup/components/SetupBasicInfoForm.test.tsx` | コンポーネントテスト |
| `web/src/features/setup/components/SetupRecipeEditor.tsx` | レシピ入力(SF6Controller を内包、setup ステップ管理) |
| `web/src/features/setup/components/SetupRecipeEditor.test.tsx` | コンポーネントテスト |
| `web/src/features/setup/components/SetupAccordionItem.tsx` | コンボ詳細でのアコーディオン展開行 |
| `web/src/features/setup/components/SetupAccordionItem.test.tsx` | コンポーネントテスト |
| `web/src/features/setup/components/LinkExistingSetupModal.tsx` | 既存セットプレイから選択して紐付けるモーダル(コンボ詳細・編集から呼び出し) |
| `web/src/features/setup/components/LinkExistingSetupModal.test.tsx` | コンポーネントテスト |

#### 既存ページの修正(コンボ詳細・コンボ編集)

| ファイル | 修正内容 |
|---------|---------|
| `web/src/pages/ComboDetailPage.tsx`(または相当、M2 期間で実装済み) | セットプレイ展開セクション(§5.6 item 8)を追加。「セットプレイ追加」ボタンと「既存セットプレイから紐付け」ボタンを配置 |
| `web/src/pages/ComboDetailPage.test.tsx` | セットプレイ展開セクションのテスト追加 |
| `web/src/pages/ComboEditorPage.tsx`(または相当、M2 期間で実装済み) | 「既存セットプレイから紐付け」ボタン配置(新規セットプレイ作成セクションは M4-04 で実装、本指示書では既存紐付けのみ) |

#### ルーティング登録

| ファイル | 修正内容 |
|---------|---------|
| `web/src/router.tsx`(または相当) | `SetupEditorPage` のルートを追加。新規作成パスは `/combos/:comboId/setups/new`(親コンボ ID 必須、VAL-S05 と整合)、編集パスは `/setups/:setupId` |

### 2.2 修正するファイル

#### フロントエンド(既存)

| ファイル | 修正内容 |
|---------|---------|
| (上記 §2.1 既存ページの修正参照) | コンボ詳細・コンボ編集ページの拡張 |

#### バックエンド(v1.0.1 で追加、§4.13 で確定した API 追加・拡張)

| ファイル | 修正内容 |
|---------|---------|
| `internal/api/setup/handler.go` | `ListSetups` ハンドラ追加(`GET /api/setups?characterId=X`、§4.13.1) |
| `internal/api/setup/handler_test.go` | `ListSetups` ハンドラのテスト追加 |
| `internal/api/setup/dto.go` | `ListSetupsResponse`(`{"items": []SetupSummary}` 形)+ `SetupSummary` 型追加(v1.0.2 で SetupSummary 確定) |
| `internal/service/setup/service.go` | `ListSetupsByCharacter(ctx, characterId)` 関数追加 |
| `internal/service/setup/service_test.go` | `ListSetupsByCharacter` のテスト追加 |
| `internal/repository/setup/repository.go` | キャラ別 List クエリ追加(`WHERE character_id = ? AND deleted_at IS NULL`) |
| `internal/repository/setup/repository_test.go` | List クエリのテスト追加 |
| `internal/api/router.go`(または相当) | `GET /api/setups` ルート登録 |
| `internal/api/combo/dto.go`(または相当) | `ComboDetailResponse` に `Setups []SetupResponse \`json:"setups"\`` フィールド追加(§4.13.2、案 B1) |
| `internal/service/combo/get.go`(または相当) | コンボ詳細取得時に setup 一覧を JOIN 取得するロジック追加 |
| `internal/service/combo/get_test.go`(または相当) | setup 埋め込みレスポンスのテスト追加 |
| `internal/repository/combo/repository.go`(または相当) | setup 一覧取得用のリポジトリメソッド呼び出し(setup 側 List クエリ再利用) |

### 2.3 変更しないもの(原則)

- M4-01 で実装した setup CRUD API のシグネチャ・既存エンドポイント(動作前提、本指示書では新規エンドポイント追加と既存 ComboDetailResponse の拡張のみ)
- M4-00 / M4-00b で実装した RecipeBuilder / ModifiersEditor の console.warn(完了承認済み、回帰しない)
- M3 までに確立したフロントエンドのフック分離パターン(architecture-patterns.md §1、本指示書でも踏襲)
- 既存の SF6Controller コンポーネント(M2-01 実装、本指示書では再利用のみ)
- 既存の RecipeBuilder / ModifiersEditor(M2-04 / M4-00 / M4-00b で完成、本指示書では参考実装の参照源)
- M3 完了状態のコンボ作成・更新・削除 API の本体ロジック(`ComboDetailResponse` への `setups` フィールド追加のみで既存挙動は不変、M3-05 統合 E2E シナリオが回帰しないこと)

### 2.4 例外: バックエンドへの追加実装が許容される箇所(v1.0.1 で追加)

本指示書は **本来フロントエンド実装中心** だが、Plan Mode 中に発覚した M4-01 起票時の API 設計網羅性漏れを補修するため、以下のバックエンド追加・拡張を **本指示書のスコープに含む**:

- **§4.13.1 `GET /api/setups?characterId=X` 一覧エンドポイント追加**(案 A1、§4.4.6 `useCharacterSetups` の前提)
- **§4.13.2 `GET /api/combos/{id}` レスポンスへの `setups: SetupResponse[]` フィールド追加**(案 B1、§4.10.2 ComboDetailPage の setup 一覧取得の前提)

上記 2 件以外のバックエンド変更は禁止。万一実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当 Claude Code は実装着手前に以下を読む:

| ID / ファイル | 関連節 |
|--------------|--------|
| 本指示書 | 全体 |
| CLAUDE.md | §4 TypeScript 規約(camelCase JSON タグ、列挙定数同期)、§5 テスト規約、§10 禁止事項 |
| **DES-005** | **§5.6 コンボ詳細(item 8 セットプレイ展開、item 9 候補は M4-03 のため本指示書では非表示)、§5.9 セットプレイ登録・編集** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05(フロント側でも事前バリデーション補助。バックエンドが最終判定) |
| **M4-01 指示書 v1.0.2** | **§4.2 API エンドポイント、§4.2.1 共通 `SetupResponse` 型(`ParentComboIDs []int64` 配列)、§4.7 ハンドラ層エラーレスポンス形式** |
| architecture-patterns.md v1.0.0 | **§1 フック分離パターン(本指示書の中核)**、§4 列挙定数同期(本指示書では新規列挙定数なし) |
| CHANGE-003 | セットプレイ編集画面側に紐付け操作を持たせない方針の経緯 |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 参照タイミング |
|--------------|--------------|
| M3-04 指示書 | useCharacters フック / フック分離パターンの実装例参照時 |
| M3-04 §4.9 / §4.10 / §4.11 | 3 経路共通利用コンポーネント設計の参考(本指示書では `LinkExistingSetupModal` が複数経路から呼ばれるため類似構造になる) |
| M2-01 指示書 | SF6Controller コンポーネントの実装(setup レシピ入力で再利用) |
| M2-04 / M4-00 指示書 | RecipeBuilder / ModifiersEditor の console.warn 警告ロジック(本指示書では setup 用に類似ロジックを実装するか判断が必要、§4.5 で確定) |
| SUPP-001 §3.3.0〜§3.3.4 | Modifiers 構造体(setup_steps でも同型を使用) |
| SUPP-001 §5.9 | PATCH 送信ポリシー(`*T` ポインタ型で 3 状態区別) |
| playbook v1.6.0 | §4.5 フローの素直さ原則、§4.6 UI ライブラリ実態確認原則 |

### 3.3 参照不要

- SUPP-001 §7 / §7.5(notation サービス層は M4-01 で実装済み、フロントは API レスポンスの `defaultRecipe` 文字列を表示するのみ)
- DES-002 §4.3(共通エラーレスポンス Go 型はバックエンド規約、フロントは API クライアントでエラー応答 JSON をパースして扱うのみ)
- DES-003 §3.11〜§3.13(永続化テーブル定義はバックエンド領域、フロントは型定義を `web/src/features/setup/types.ts` で M4-01 DTO から composer 構築)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること** を強く推奨(本指示書は既存パターン参照が多く、実態確認の負荷が高いため Plan Mode 使用を推奨)。

#### 3.4.1 M4-01 で実装された setup API の動作確認(M4-01 完成時の既存 API)

```bash
# サーバーを起動した状態で:
curl -X POST http://localhost:8080/api/combos/1/setups \
  -H "Content-Type: application/json" \
  -d '{"characterId":1,"name":"テスト","steps":[{"moveId":1,"modifiers":{}}]}'
curl http://localhost:8080/api/setups/1
```

期待される確認事項:

- M4-01 で実装された setup CRUD API が動作している
- レスポンス JSON のフィールド名が camelCase(`parentComboIds`、`defaultRecipe`、`stepCount` 等)
- **`ParentComboIDs` が配列で返る**(M4-01 v1.0.2 で確定した共通 `SetupResponse` 型、§4.2.1 / §4.2.4 / §4.2.5 すべて配列統一)
- `Setup.DeletedAt` / `SetupStep.SetupID` がレスポンスに **含まれない**(M4-01 v1.0.2 で `json:"-"` 設定済み)
- VAL-S05 違反(`comboId=0`)で `validation_failed` エラーが返る(M4-01 §4.3.2)

**v1.0.1 で追加するバックエンドエンドポイント(本指示書 §4.13 で実装する前提条件、着手前確認時点では未実装)**:

```bash
# §4.13.1 で実装する想定(着手前確認時点では 404 が返るのが正常)
curl http://localhost:8080/api/setups?characterId=1
# 期待: 着手前確認時点で 404(未実装、§4.13.1 実装後に動作)

# §4.13.2 で拡張する想定(着手前確認時点ではレスポンスに setups フィールドが含まれない)
curl http://localhost:8080/api/combos/1 | jq '.setups'
# 期待: 着手前確認時点では null または存在しない(§4.13.2 実装後に配列で返る)
```

着手前確認時点でこれら 2 つが「未実装」状態であることを確認し、§4.13 のバックエンド追加・拡張で実装する流れを Plan Mode で開発者と合意する。

#### 3.4.2 既存 RecipeBuilder / SF6Controller の構造確認(再利用の前提)

```bash
ls web/src/features/combo/components/
cat web/src/features/combo/components/RecipeBuilder.tsx | head -60
ls web/src/components/ 2>/dev/null  # SF6Controller の配置確認
grep -rn 'SF6Controller' web/src/ | head -10
```

期待される確認事項:

- RecipeBuilder.tsx の props 構造、レシピステップ管理ロジック、modifiers 編集の組み立て方
- SF6Controller の配置パス(`web/src/components/`、`web/src/features/combo/components/`、または他)と props 構造
- 本指示書 §4.5 で `SetupRecipeEditor` を組む際に **新規実装するか / RecipeBuilder を再利用するか / 両者の共通フックを抽出するか** の判断材料

判断の指針: M4 期間で過剰なリファクタを避ける方針なので、**SF6Controller は直接再利用、レシピステップ管理は RecipeBuilder を参考にしつつ setup 用に新規実装** が基本案。共通ヘルパフック抽出は handover §8.3 と同じく M5 以降または M7 の課題。

#### 3.4.3 既存 ComboDetailPage / ComboEditorPage の構造確認(修正対象の前提)

```bash
ls web/src/pages/ | grep -i 'combo\|setup'
cat web/src/pages/ComboDetailPage.tsx 2>/dev/null | head -80
# ComboDetailPage が別の名称の場合は実態に合わせて読み替え
grep -rn 'detail\|Detail' web/src/pages/ | head -10
```

期待される確認事項:

- ComboDetailPage(または相当)の現状ファイル名・配置パス
- 現状のセクション構成、§5.6 item 1〜7 / item 10 の実装状況
- セットプレイ展開セクション(item 8)を **どこに挿入するか** の判断
- コンボ編集画面(ComboEditorPage 等)の現状

#### 3.4.4 useCharacters フック・既存 mycombo パターンの確認(フック分離パターンの参考)

```bash
ls web/src/features/character/
cat web/src/features/character/hooks/useCharacters.ts 2>/dev/null
ls web/src/features/mycombo/hooks/ 2>/dev/null
```

期待される確認事項:

- `useCharacters` フックの構造(M3-04 §4.1 で実装済み)、`queryKey: ['characters', { gameId }]`、`useCharacterName` ヘルパの存在
- `useUpdateMyComboStatus` 等の mutation フックの構造(M3-04 §4.9 で実装済み、`useUpdateSetup` 等の参考)
- これらを **直接踏襲する**(setup 用フックも同形で書く)

#### 3.4.5 既存ルーティング構造の確認

```bash
cat web/src/router.tsx 2>/dev/null
# または webpack/vite の設定でルーティングファイルを確認
grep -rn 'createBrowserRouter\|createRoutesFromElements\|<Route' web/src/ | head -10
```

期待される確認事項:

- ルーティングライブラリ(React Router v6 想定、`createBrowserRouter` または `<Routes>`)の使用パターン
- 既存ルート定義(`/combos/new`、`/combos/:id`、`/combos/:id/edit` 等)の命名パターン
- 本指示書 §4.10 で追加する `/combos/:comboId/setups/new` / `/setups/:setupId` のスタイルとの整合

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を Plan Mode で開発者に報告する。特に **§3.4.1 setup API の動作確認結果**(M4-01 で実装された API がフロント実装の前提として機能していること)は明示的に報告すること。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 のすべての確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合(例: M4-01 setup API の挙動が指示書と異なる、既存ファイル名が想定と大きく異なる等)は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 全体構造とフック分離パターン

本指示書のフロント実装は **architecture-patterns.md §1 フック分離パターン** に従う。ロジックは hooks 配下、表示は components 配下に分離。M3-04 で確立した形を踏襲。

#### 4.1.1 ディレクトリ構造

```
web/src/features/setup/
├── api/
│   └── setupApi.ts            # APIクライアント関数(M4-01 §4.2 と整合)
├── hooks/
│   ├── useSetup.ts            # 単一 setup 取得
│   ├── useCreateSetup.ts      # 新規作成 mutation
│   ├── useUpdateSetup.ts      # 更新 mutation(version 必須)
│   ├── useDeleteSetup.ts      # 論理削除 mutation
│   ├── useSetupLinks.ts       # 紐付け追加・解除 mutation
│   └── useCharacterSetups.ts  # キャラ別 setup 候補(既存紐付けモーダル用)
├── components/
│   ├── SetupBasicInfoForm.tsx
│   ├── SetupRecipeEditor.tsx
│   ├── SetupAccordionItem.tsx
│   └── LinkExistingSetupModal.tsx
└── types.ts                    # フロント型定義
```

#### 4.1.2 既存 mycombo / character フィーチャとの構造対称性

`web/src/features/mycombo/`(M3-04 で実装)/ `web/src/features/character/`(M3-04 で実装)と **同一の構造パターン**(api/ + hooks/ + components/ + types.ts)で setup フィーチャを組む。既存フィーチャを実態確認(§3.4.4)してから setup 側を書く。

### 4.2 setup フロント型定義(`web/src/features/setup/types.ts`)

M4-01 BE DTO と整合する型を定義する。

```typescript
// Modifiers は既存 combo 系から型を import(または同形で再定義、§3.4.2 で確認)
import type { Modifiers } from '../combo/types';  // または相当のパス

export interface Setup {
  id: number;
  characterId: number;
  name?: string | null;          // M4-01 §4.1.1 Name *string 対応(NULL 許容)
  description?: string | null;
  stepCount: number;
  version: number;
  createdAt: string;             // ISO 8601 文字列(JSON 経由)
  updatedAt: string;
  // recipeCache / deletedAt は API に出ない(M4-01 v1.0.2 で json:"-")
}

export interface SetupStep {
  id: number;
  // setupId は API に出ない(M4-01 v1.0.2 で json:"-")
  stepOrder: number;
  moveId?: number | null;
  modifiers: Modifiers;
}

export interface SetupResponse extends Setup {
  steps: SetupStep[];
  defaultRecipe: string;          // ResolveSetupRecipe(setupID, 1) の結果文字列
  parentComboIds: number[];       // M4-01 v1.0.2 で配列統一(新規作成・詳細取得・更新すべて配列)
}

// SetupSummary は一覧表示用の軽量型(v1.0.2 で追加)。
// `GET /api/setups?characterId=X` のレスポンス items 配列の要素型として使用。
// steps と createdAt / updatedAt を含まないことで、一覧表示時のペイロードを軽量化する。
// 詳細(steps を含む)が必要な場合は SetupResponse(`GET /api/setups/{id}` 経由)を使う設計。
// M3 期間で確立した `ComboSummary` vs `Combo` の一覧/詳細型分岐規約(SUPP-001 §4)と整合。
export interface SetupSummary extends Omit<Setup, 'createdAt' | 'updatedAt'> {
  defaultRecipe: string;          // ResolveSetupRecipe(setupID, 1) の結果文字列
  parentComboIds: number[];       // 当該 setup が紐付いている全コンボ ID(LinkExistingSetupModal の既紐付け除外で使用)
}

export interface CreateSetupInput {
  characterId: number;
  name?: string | null;
  description?: string | null;
  steps: SetupStepInput[];
}

export interface SetupStepInput {
  moveId?: number | null;
  modifiers: Modifiers;
}

export interface UpdateSetupInput {
  name?: string | null;            // SUPP-001 §5.9 PATCH ポリシー: undefined(送らない) / null(空文字上書き相当)/ 値 で 3 状態区別
  description?: string | null;
  steps?: SetupStepInput[];        // undefined(送らない) / [](全削除) / 値 で 3 状態区別
  version: number;                 // 楽観的排他、必須
}
```

**注**: TypeScript における `undefined`(キー自体を送らない) / `null`(明示的 null) / 値 の 3 状態区別は、JSON.stringify と組み合わせて自然に表現できる。SUPP-001 §5.9 のサーバ側 `*T` ポインタ型(`nil` / `&""` / `&"値"`)と対称構造。

**`SetupSummary` vs `SetupResponse` の使い分け(v1.0.2 で確定)**:

| 型 | 使用箇所 | フィールド |
|----|---------|----------|
| `SetupSummary` | 一覧表示(`GET /api/setups?characterId=X` レスポンス、`LinkExistingSetupModal` の候補表示) | id / characterId / name? / description? / stepCount / version / defaultRecipe / parentComboIds(steps なし、createdAt / updatedAt なし) |
| `SetupResponse` | 詳細表示(`GET /api/setups/{id}`、新規作成・更新レスポンス、`ComboDetailResponse.setups` 配列要素) | SetupSummary のフィールド全部 + steps + createdAt + updatedAt |

ステップ詳細(`steps`)が必要なのは setup 編集画面と コンボ詳細画面のアコーディオン展開のみ。一覧画面では `defaultRecipe` 文字列で十分なので軽量型 `SetupSummary` を使う。

### 4.3 setup API クライアント(`web/src/features/setup/api/setupApi.ts`)

M4-01 §4.2 の各エンドポイントに対応する関数を定義する。

```typescript
import type {
  CreateSetupInput,
  SetupResponse,
  UpdateSetupInput,
} from '../types';

// fetch ラッパ(既存 mycomboApi 等のパターンを踏襲、§3.4.4 で確認)
import { apiClient } from '../../../api/client';  // または相当のパス

export const setupApi = {
  create: (comboId: number, input: CreateSetupInput): Promise<SetupResponse> =>
    apiClient.post(`/api/combos/${comboId}/setups`, input),

  createLink: (comboId: number, setupId: number): Promise<void> =>
    apiClient.post(`/api/combos/${comboId}/setup-links`, { setupId }),

  deleteLink: (comboId: number, setupId: number): Promise<void> =>
    apiClient.delete(`/api/combos/${comboId}/setup-links/${setupId}`),

  get: (id: number): Promise<SetupResponse> =>
    apiClient.get(`/api/setups/${id}`),

  update: (id: number, input: UpdateSetupInput): Promise<SetupResponse> =>
    apiClient.patch(`/api/setups/${id}`, input),

  remove: (id: number): Promise<void> =>
    apiClient.delete(`/api/setups/${id}`),
};
```

**設計判断**: setup の削除メソッドは TypeScript の予約語 `delete` を避けて `remove` を使う。fetch ラッパの命名は既存 `mycomboApi` / `comboApi` に合わせる(§3.4.4 で確認)。

### 4.4 setup フック群(`web/src/features/setup/hooks/`)

#### 4.4.1 useSetup(単一取得)

```typescript
// useSetup.ts
import { useQuery } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';

export function useSetup(setupId: number | null | undefined) {
  return useQuery({
    queryKey: ['setup', { id: setupId }],
    queryFn: () => setupApi.get(setupId!),
    enabled: !!setupId && setupId > 0,
  });
}
```

#### 4.4.2 useCreateSetup(新規作成)

```typescript
// useCreateSetup.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';
import type { CreateSetupInput, SetupResponse } from '../types';

export function useCreateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      input,
    }: {
      comboId: number;
      input: CreateSetupInput;
    }): Promise<SetupResponse> => setupApi.create(comboId, input),
    onSuccess: (data, { comboId }) => {
      // 作成された setup の詳細キャッシュをセット
      queryClient.setQueryData(['setup', { id: data.id }], data);
      // 親コンボの詳細キャッシュを無効化(セットプレイ一覧が更新されるため)
      queryClient.invalidateQueries({ queryKey: ['combo', { id: comboId }] });
    },
  });
}
```

#### 4.4.3 useUpdateSetup(更新)

`version` 必須、`UpdateSetupInput` を受け取る。`Steps` 変更時は M4-01 §4.3.3 でバックエンドが `RecomputeSetupCache` を呼ぶため、フロント側は単純に PATCH を投げてキャッシュ無効化するのみ。

```typescript
// useUpdateSetup.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';
import type { SetupResponse, UpdateSetupInput } from '../types';

export function useUpdateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateSetupInput;
    }): Promise<SetupResponse> => setupApi.update(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['setup', { id: data.id }], data);
      // 紐付いているすべてのコンボ詳細キャッシュを無効化
      data.parentComboIds.forEach((comboId) => {
        queryClient.invalidateQueries({ queryKey: ['combo', { id: comboId }] });
      });
    },
  });
}
```

#### 4.4.4 useDeleteSetup(論理削除)

```typescript
// useDeleteSetup.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';

export function useDeleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      parentComboIds,
    }: {
      id: number;
      parentComboIds: number[];  // キャッシュ無効化対象、削除前に取得しておく
    }): Promise<void> => setupApi.remove(id),
    onSuccess: (_, { id, parentComboIds }) => {
      queryClient.removeQueries({ queryKey: ['setup', { id }] });
      parentComboIds.forEach((comboId) => {
        queryClient.invalidateQueries({ queryKey: ['combo', { id: comboId }] });
      });
    },
  });
}
```

#### 4.4.5 useSetupLinks(紐付け追加・解除)

```typescript
// useSetupLinks.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';

export function useCreateSetupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      setupId,
    }: {
      comboId: number;
      setupId: number;
    }): Promise<void> => setupApi.createLink(comboId, setupId),
    onSuccess: (_, { comboId, setupId }) => {
      queryClient.invalidateQueries({ queryKey: ['combo', { id: comboId }] });
      queryClient.invalidateQueries({ queryKey: ['setup', { id: setupId }] });
    },
  });
}

export function useDeleteSetupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      setupId,
    }: {
      comboId: number;
      setupId: number;
    }): Promise<void> => setupApi.deleteLink(comboId, setupId),
    onSuccess: (_, { comboId, setupId }) => {
      queryClient.invalidateQueries({ queryKey: ['combo', { id: comboId }] });
      queryClient.invalidateQueries({ queryKey: ['setup', { id: setupId }] });
    },
  });
}
```

#### 4.4.6 useCharacterSetups(キャラ別 setup 候補、v1.0.1 で案 A1 確定)

`LinkExistingSetupModal` で「既存セットプレイから選んで紐付ける」UI で使用。同一キャラの既存 setup 一覧を取得する。

**API エンドポイント(v1.0.1 で確定)**: **案 A1 採用**。本指示書 §4.13.1 で `GET /api/setups?characterId=X` 一覧エンドポイントをバックエンド追加実装する。Plan Mode 中の確認(問題 A、2026-05-16)で M4-01 起票時の網羅性漏れが判明したため、M4-02 スコープ拡張(§2.4)としてバックエンド追加を本指示書に含めた。

レスポンス形式は `{"items": SetupSummary[]}` 形(v1.0.2 で確定、§4.13.1、軽量型 SetupSummary を使用)。

```typescript
// useCharacterSetups.ts(案 A1 確定、v1.0.2 で SetupSummary 採用)
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { SetupSummary } from '../types';

interface ListSetupsResponse {
  items: SetupSummary[];
}

export function useCharacterSetups(characterId: number | null | undefined) {
  return useQuery({
    queryKey: ['setups', { characterId }],
    queryFn: async (): Promise<SetupSummary[]> => {
      const response: ListSetupsResponse = await apiClient.get(
        `/api/setups?characterId=${characterId}`
      );
      return response.items;
    },
    enabled: !!characterId && characterId > 0,
  });
}
```

**設計判断(v1.0.2 で更新)**: レスポンス DTO は `{"items": []SetupSummary}` 形でラップする。これは M4-01 §4.2.7 の候補取得スタブと対称、また将来ページネーション(`total` / `page` 等を追加)する余地を残す形。**要素型は `SetupSummary`(軽量型、steps なし、createdAt / updatedAt なし)**: 一覧表示用途では steps 詳細は不要で、ペイロード軽量化のために省略。詳細(steps を含む)が必要な場面は setup 編集画面で個別に `useSetup(id)` を呼ぶ。`LinkExistingSetupModal` の既紐付け除外には `parentComboIds` を使用するため SetupSummary に含める。

### 4.5 SetupRecipeEditor コンポーネント

setup のレシピ入力部分。コンボの RecipeBuilder と類似構造だが setup 用に新規実装する(§3.4.2 で確認した RecipeBuilder のパターンを参考)。

#### 4.5.1 機能要件

- **SF6Controller を内包** してステップ追加・編集 UI を提供
- ステップ並び替え(ドラッグ&ドロップは M4 では実装しない、シンプルな上下ボタンで十分)
- 各ステップの modifiers 編集(`flags` / `type` / `notes` 編集 UI、既存 ModifiersEditor を再利用するか setup 用に新規実装するかは §3.4.2 確認後判断)
- ステップ削除
- 50 文字超 `notes` の console.warn 警告(M4-00 / M4-00b と同パターン、後述 §4.5.3)

#### 4.5.2 Props 設計

```typescript
interface SetupRecipeEditorProps {
  characterId: number;             // SF6Controller / 技選択に必要
  steps: SetupStepInput[];          // 現在のステップ配列
  onChange: (newSteps: SetupStepInput[]) => void;  // ステップ変更時のコールバック
}
```

#### 4.5.3 console.warn 警告ロジック(M4-00 / M4-00b と同パターン)

各ステップの `modifiers.notes` が 50 文字を超えた場合、`useEffect` で `console.warn` を発火する。M4-00b で ModifiersEditor に実装した console.warn パターンを参考。

```typescript
// SetupRecipeEditor 内の各ステップに対して
useEffect(() => {
  steps.forEach((step, index) => {
    if (step.modifiers.notes && step.modifiers.notes.length > 50) {
      console.warn(
        `setup_steps[${index}].modifiers.notes が 50 文字を超えています: ${step.modifiers.notes.length} 文字`
      );
    }
  });
}, [steps]);
```

**設計判断**: ModifiersEditor の console.warn を **再利用するか setup 用に新規実装するか** は §3.4.2 で確認。ModifiersEditor がそのまま再利用できるなら setup 側で直接 ModifiersEditor を組み込む。

### 4.6 SetupBasicInfoForm コンポーネント

setup のメタデータ(キャラ・名前・説明)入力フォーム。

#### 4.6.1 Props 設計(v1.0.2 で mode prop 削除)

```typescript
interface SetupBasicInfoFormProps {
  characterId: number;              // 親コンボから自動設定された値、または既存 setup の値(読み取り専用表示)
  name: string | null;
  description: string | null;
  onChange: (changes: Partial<{ name: string | null; description: string | null }>) => void;
}
```

**v1.0.2 で `mode` prop を削除**: 当初指示書 v1.0.1 では `mode: 'create' | 'edit'` を props に含めていたが、§4.6.2 で確定したとおり新規作成・編集の両モードで本フォームの振る舞いは **完全に同一**(キャラクター読み取り専用 + 名前・説明入力)。`mode` を渡しても内部で分岐が無く YAGNI 違反だったため、製造担当の判断で実装から削除済み(2026-05-17)。指示書側を実態に合わせて修正。

#### 4.6.2 表示・編集仕様(両モード共通、v1.0.2 で統合)

- **キャラクター選択は常に読み取り専用表示**(新規作成時は親コンボから自動設定された値、編集時は既存 setup の `character_id`、いずれも変更不可。setup の `character_id` 変更は M4-01 §4.4 で VAL-S01 を編集時に再評価しないという方針と整合)
- 名前 / 説明: いずれも任意入力、空文字許可
- キャラクター名は `useCharacterName` ヘルパ(M3-04 §4.1.2)経由で表示

**文字数制限の仕様(v1.0.4 で明示)**: `name` および `description` は **文字数制限なし**(VAL-S01〜S05 に含まれず、API 側のバリデーションも検証しない)、**console.warn 警告も出さない**。`modifiers.notes` 50 文字警告は **`setup_steps` 配下のメモのみが対象** で、setup 本体の `name` / `description` は対象外。

**`modifiers.notes` と `Setup.description` / `Setup.name` の非対称性の根拠**: `modifiers.notes` は **コンボレシピのレンダリング文字列に直接連結される可能性** があり、長文化すると表示崩れを起こす UX 上の理由で 50 文字 console.warn を出す(§4.5.3、M4-00 / M4-00b 確立パターン)。一方 `Setup.description` / `Setup.name` は **詳細画面や一覧画面で独立した表示要素** として扱われるテキストで、長文でも表示崩れの懸念が小さく、過剰な制限は UX を損なう。両者は性質が異なるため非対称な扱いが合理的。

DES-006 §10「メモ等のテキスト入力は文字数上限を設ける」一般論との関係: 本一般論の「メモ」は `modifiers.notes`(コンボ・セットプレイの各ステップに付与するメモ)を主に指すと解釈し、setup / コンボ本体の `name` / `description` は対象外と整理する(v1.0.4 で明示)。

**将来課題**: フェーズ 2 以降で `Setup.description` / `Setup.name` に文字数上限が必要となった場合(例: データ品質の劣化、表示崩れの顕在化)は、別途 CHANGE 通知書を起票して制限値を確定する。現時点では制限なしで運用する設計判断。

**設計意図(v1.0.2 で明示)**: 新規作成と編集で本フォームの振る舞いが同一なのは、キャラクター変更を許容しない設計(VAL-S01 整合)の自然な帰結。`SetupBasicInfoForm` 自体はモードを意識せず、親(`SetupEditorPage`)が初期値の取得元(親コンボ or 既存 setup)を吸収する責務分担。

### 4.7 SetupAccordionItem コンポーネント(v1.0.3 で動作仕様を DES-005 §5.6 アクション準拠に修正)

コンボ詳細画面で、紐付き setup 一覧をアコーディオン展開する各行。

**動作仕様の根拠(v1.0.3 で明確化)**: DES-005 §5.6 アクション「セットプレイ行クリック → セットプレイ編集画面」および §5.5 コンボ一覧アコーディオン UI 規約(「展開アイコンクリック → セットプレイ展開/折りたたみ」「セットプレイ行クリック → セットプレイ編集画面」)に従い、**行クリック領域と展開アイコン領域を分離** する。当初 v1.0.0〜v1.0.2 では「行クリック = 展開トグル + 編集ボタン経由で遷移」と書いていたが、設計書本体のアクション節を読み込み漏れしていた設計担当(M4 期間担当)のミス。

#### 4.7.1 Props 設計

```typescript
interface SetupAccordionItemProps {
  setup: SetupResponse;            // setup 詳細(defaultRecipe 含む)
  parentComboId: number;            // 紐付け解除操作用
  onUnlink?: () => void;            // 紐付け解除後のコールバック(任意)
  onEdit?: () => void;              // 編集画面遷移のコールバック(任意、未指定時はデフォルトの遷移処理)
}
```

#### 4.7.2 表示仕様(v1.0.3 で全面改訂、DES-005 §5.5 / §5.6 アコーディオン UI 規約準拠)

- **表示構造**: 各 setup を縦に並べて、各 setup は「ヘッダー行(展開アイコン + setup 名 + 補助情報) + 展開時のレシピ表示領域 + 紐付け解除ボタン」を持つカード/行形式
- **展開アイコン(▶/▼)**: ヘッダー行の左端または右端に配置、**この領域のクリックで展開・折りたたみトグル**(stopPropagation で行クリックと分離)
- **行クリック領域(展開アイコン以外のヘッダー部)**: クリックで **編集画面(`/setups/:setupId`)に遷移**(DES-005 §5.6 アクション直接準拠)
- **展開時の表示内容**: レシピ(`defaultRecipe` 文字列を表示) + 紐付け解除ボタン
- **折りたたみ時の表示内容**: setup 名のみ(または名前 + ステップ数 + 展開アイコン)
- **紐付け解除ボタン**: 展開時の領域内に配置、クリック時に行クリックや展開トグルが発火しないよう stopPropagation で分離。`useDeleteSetupLink` を発火、確認ダイアログ(`window.confirm` で十分、shadcn 不使用)
- **編集ボタンは原則として配置しない**(行クリック = 編集遷移が DES-005 §5.6 アクションの直接表現のため。ただし展開時の領域内に「編集」と表示する補助テキスト or 視覚ヒントは許容)

**実装上の注意**: React の onClick イベントは親要素に伝播するため、展開アイコンと紐付け解除ボタンの onClick で `event.stopPropagation()` を呼んで行クリックの発火を防ぐ。または、行全体の onClick とアイコン/ボタンの onClick で別ハンドラを設定し、要素単位で挙動を分離する。

```typescript
// SetupAccordionItem.tsx 概略(v1.0.3 仕様準拠)
const SetupAccordionItem = ({ setup, parentComboId, onUnlink, onEdit }: SetupAccordionItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const deleteLinkMutation = useDeleteSetupLink();

  // 行クリック = 編集画面遷移
  const handleRowClick = () => {
    if (onEdit) {
      onEdit();
    } else {
      navigate(`/setups/${setup.id}`);
    }
  };

  // 展開アイコンクリック = トグル(行クリックには伝播させない)
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  // 紐付け解除ボタンクリック(行クリックには伝播させない)
  const handleUnlinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('このセットプレイの紐付けを解除しますか?')) {
      deleteLinkMutation.mutate({ comboId: parentComboId, setupId: setup.id });
      onUnlink?.();
    }
  };

  return (
    <div className="border rounded">
      {/* ヘッダー行: クリック = 編集遷移 */}
      <div onClick={handleRowClick} className="cursor-pointer flex items-center p-2">
        <button onClick={handleExpandClick} aria-label="展開/折りたたみ">
          {expanded ? '▼' : '▶'}
        </button>
        <span className="ml-2">{setup.name ?? '(名前なし)'}</span>
        <span className="ml-auto text-sm text-gray-500">{setup.stepCount} ステップ</span>
      </div>
      {/* 展開時: レシピ + 紐付け解除ボタン */}
      {expanded && (
        <div className="p-2 border-t">
          <div>{setup.defaultRecipe}</div>
          <button onClick={handleUnlinkClick} className="mt-2 text-red-600">
            紐付け解除
          </button>
        </div>
      )}
    </div>
  );
};
```

### 4.8 LinkExistingSetupModal コンポーネント

コンボ詳細・コンボ編集画面から「既存セットプレイから紐付け」ボタンで呼び出されるモーダル。

#### 4.8.1 機能要件

- 親コンボのキャラ ID で `useCharacterSetups` を呼ぶ(同一キャラの既存 setup 候補一覧)
- 既に当該コンボに紐付いている setup は **候補から除外**(`setup.parentComboIds` に親コンボ ID が含まれる setup は除く)
- 候補 0 件時は「同一キャラの紐付け候補がありません」を表示
- 各候補をクリックで `useCreateSetupLink` を発火、成功時にモーダルを閉じる

#### 4.8.2 Props 設計

```typescript
interface LinkExistingSetupModalProps {
  open: boolean;
  parentComboId: number;
  characterId: number;
  onClose: () => void;
  onLinked?: () => void;            // 紐付け成功後のコールバック(任意)
}
```

#### 4.8.3 モーダル実装方針

- 標準 HTML + Tailwind 自作(playbook §4.6、shadcn/ui 不使用)
- `open` props で開閉、`<div className="fixed inset-0 ...">` で全画面オーバーレイ
- 既存モーダル実装が `web/src/features/` 配下に存在する場合は §3.4.2 で確認し、同パターンで組む

### 4.9 SetupEditorPage(`web/src/pages/SetupEditorPage.tsx`)

setup の登録・編集画面。

#### 4.9.1 ルーティング

- 新規作成: `/combos/:comboId/setups/new`(親コンボ ID 必須、VAL-S05 整合)
- 編集: `/setups/:setupId`

`useParams` で URL パラメータを取得し、`comboId` の有無で新規 / 編集モード分岐。

#### 4.9.2 ページ構造

```typescript
// SetupEditorPage.tsx 概略
const SetupEditorPage = () => {
  const { comboId, setupId } = useParams<{ comboId?: string; setupId?: string }>();
  // 保存処理の分岐用ローカル変数。SetupBasicInfoForm には mode を渡さない(v1.0.2 で mode prop 削除)
  const mode = setupId ? 'edit' : 'create';
  
  // 編集モード時に既存 setup を取得
  const { data: setup, isLoading } = useSetup(setupId ? Number(setupId) : null);
  
  // 新規作成モード時に親コンボから character_id を取得
  const { data: parentCombo } = useCombo(comboId ? Number(comboId) : null);
  
  // ローカルフォーム状態
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [steps, setSteps] = useState<SetupStepInput[]>([]);
  
  // 編集モード時にフォーム初期化
  useEffect(() => {
    if (setup) {
      setName(setup.name ?? null);
      setDescription(setup.description ?? null);
      setSteps(setup.steps.map(/* SetupStep → SetupStepInput 変換 */));
    }
  }, [setup]);
  
  // 新規作成 / 更新 mutation
  const createMutation = useCreateSetup();
  const updateMutation = useUpdateSetup();
  
  // 保存処理
  const handleSave = () => {
    if (mode === 'create') {
      createMutation.mutate({
        comboId: Number(comboId),
        input: {
          characterId: parentCombo.characterId,
          name,
          description,
          steps,
        },
      });
    } else {
      updateMutation.mutate({
        id: Number(setupId),
        input: {
          name,
          description,
          steps,
          version: setup!.version,
        },
      });
    }
  };
  
  // 描画
  return (
    <div>
      <SetupBasicInfoForm /* ... */ />
      <SetupRecipeEditor /* ... */ />
      <button onClick={handleSave}>保存</button>
      <button onClick={() => navigate(-1)}>キャンセル</button>
    </div>
  );
};
```

#### 4.9.3 新規作成時のキャラ ID 自動設定

新規作成モードでは、親コンボから `characterId` を自動設定する(DES-005 §5.9 item 1「キャラクター選択(新規時のみ、または紐付け元コンボから自動設定)」)。`useCombo(comboId)` で親コンボを取得し、その `characterId` を `SetupBasicInfoForm` に渡す。

#### 4.9.4 編集モードでのバージョン管理

`useSetup(setupId)` で取得した `setup.version` を保存時の PATCH ペイロードに含める(楽観的排他、M4-01 §4.2.5)。更新後は新しい `version` がレスポンスで返るため、`useUpdateSetup` の `onSuccess` でキャッシュが更新されることで以降の保存も正常動作する。

#### 4.9.5 保存後の遷移

- 新規作成成功時: 親コンボの詳細画面(`/combos/:comboId`)に遷移
- 編集保存成功時: 元の画面(`navigate(-1)`)に戻る

### 4.10 コンボ詳細画面の修正(DES-005 §5.6 item 8)

#### 4.10.1 追加するセクション

ComboDetailPage(§3.4.3 で確認した実際のファイル名)に以下を追加:

- 「セットプレイ」見出しセクション(item 8 の位置)
- 紐付き setup 一覧を `SetupAccordionItem` でアコーディオン展開(**v1.0.1 で案 B1 確定: `combo.setups` 配列を直接使用、§4.13.2 で `ComboDetailResponse` に setups フィールドを追加するため**)
- 「セットプレイ追加」ボタン → `/combos/:comboId/setups/new` に遷移
- 「既存セットプレイから紐付け」ボタン → `LinkExistingSetupModal` を開く

#### 4.10.2 親コンボの setup 一覧取得(v1.0.1 で案 B1 確定)

ComboDetailPage が `useCombo(id)` で親コンボを取得する際、レスポンスの `combo.setups: SetupResponse[]` フィールドから直接 setup 一覧を取得する。Plan Mode 中の確認(問題 B、2026-05-16)で M4-01 起票時の網羅性漏れが判明したため、**§4.13.2 で `GET /api/combos/{id}` のレスポンスに `setups` フィールドを追加** する形で M4-02 スコープに含めた。

**設計判断**: 案 B1(`ComboDetail` レスポンスに埋め込み)を採用した理由:

- ユーザーの「コンボ詳細を開く」アクション = API 呼び出し 1 回の素直さ(playbook §4.5)
- DES-005 §5.6 表示項目構造との整合(item 1〜10 が一体)
- ローディング状態管理の単純化(`useCombo(id).isLoading` のみで判定)
- 既存 ComboDetailPage の単一クエリパターン(steps / tags 等を埋め込みで取得)との一貫性
- `useCreateSetup` / `useUpdateSetup` 等の onSuccess でコンボ詳細キャッシュ無効化のみで連動が完結

別 fetch 案(`useComboSetups`)は本指示書では採用しない(M4-02 完了後にもし性能問題が発生したらリファクタ候補だが、現状の setup 数想定では問題化しない)。

#### 4.10.3 FR011 候補セクションは非表示(M4-03 で実装)

DES-005 §5.6 item 9 の「転用可能なセットプレイ候補」セクションは **本指示書では実装しない**(M4-03 のスコープ)。コードコメントで「M4-03 で実装予定」を明記。

### 4.11 コンボ編集画面の修正

ComboEditorPage(§3.4.3 で確認)に以下を追加:

- 「既存セットプレイから紐付け」ボタン → `LinkExistingSetupModal` を開く
- **新規セットプレイ同時登録セクション(§5.7 item 10)は M4-04 で実装、本指示書では追加しない**

### 4.12 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| 新規セットプレイ作成エントリポイント | コンボ詳細・コンボ編集の「セットプレイ追加」ボタンのみ | VAL-S05 整合、DES-005 §5.6 アクション「セットプレイ追加ボタン → セットプレイ登録画面(コンボ紐付け済み状態)」 |
| セットプレイ編集画面側の紐付け操作 | **持たせない** | CHANGE-003 確定方針、DES-005 §5.9 アクション末尾の明記 |
| useCharacterSetups の API 経路 | **v1.0.1 で案 A1 確定**: `GET /api/setups?characterId=X` を §4.13.1 でバックエンド追加実装 | §4.4.6 / §4.13.1 設計判断、Plan Mode 問題 A の判断結果 |
| ComboDetailPage の setup 一覧取得経路 | **v1.0.1 で案 B1 確定**: `GET /api/combos/{id}` レスポンスに `setups: SetupResponse[]` フィールドを埋め込み(§4.13.2 でバックエンド拡張) | §4.10.2 / §4.13.2 設計判断、Plan Mode 問題 B の判断結果 |
| RecipeBuilder / ModifiersEditor の再利用方針 | SF6Controller は直接再利用、レシピステップ管理は setup 用に新規実装、ModifiersEditor は §3.4.2 で判断 | §3.4.2 設計判断、共通フック抽出は M5 以降 |
| ステップ並び替え | 上下ボタンのみ(ドラッグ&ドロップは M4 では実装しない) | §4.5.1、M2-04 で確立した RecipeBuilder のパターンと整合 |
| モーダル実装 | 標準 HTML + Tailwind 自作 | playbook §4.6、shadcn/ui 不使用 |
| 確認ダイアログ | `window.confirm` で十分(紐付け解除等の単純な確認) | §4.7.2、shadcn/ui 不使用と整合 |
| ルーティング | 新規: `/combos/:comboId/setups/new` 編集: `/setups/:setupId` | §4.9.1、VAL-S05 整合(新規作成は親コンボ ID 必須) |
| FR011 候補セクション | 本指示書では非表示、M4-03 で実装 | §4.10.3、M4-overview §3.4 |
| knockdown_advantage 確認モーダル | 本指示書では実装しない、M4-03 で実装 | §1.3、M4-overview §3.4 |
| コンボ同時登録セクション | 本指示書では実装しない、M4-04 で実装 | §1.3 / §4.11、M4-overview §3.5 |
| **`SetupSummary` 軽量型の採用**(v1.0.2 で確定) | **一覧 API(`GET /api/setups?characterId=X`)のレスポンス要素型として `SetupSummary`(steps なし、createdAt / updatedAt なし、parentComboIds と defaultRecipe を含む)を採用**。詳細(`SetupResponse`)は `GET /api/setups/{id}` で取得 | §4.2 / §4.13.1、M3 期間で確立した ComboSummary vs Combo 規約(SUPP-001 §4)と整合 |
| **`SetupBasicInfoFormProps` の `mode` prop 削除**(v1.0.2 で確定) | **新規作成・編集の両モードでフォームの振る舞いが同一のため、`mode` prop は YAGNI 違反として削除**。モード分岐は親(`SetupEditorPage`)が初期値の取得元(親コンボ or 既存 setup)で吸収する責務分担 | §4.6.1 / §4.6.2 |
| **`GET /api/setups?characterId=X` の characterId 必須**(v1.0.2 で明示) | **`characterId` 必須**(全件取得は許容しない)。将来「全件取得」ユースケースが必要になった場合は別エンドポイントまたは管理者用クエリとして CHANGE 通知書を起票 | §4.13.1 末尾の将来課題 |
| **`SetupAccordionItem` UI 規約**(v1.0.3 で確定) | **行クリック = 編集画面遷移 / 展開アイコン(▶/▼)= 展開・折りたたみトグル**。stopPropagation で領域別ハンドラを分離。DES-005 §5.6 アクション「セットプレイ行クリック → セットプレイ編集画面」+ §5.5 コンボ一覧アコーディオン UI 規約準拠 | §4.7.2(v1.0.3 で全面改訂、当初 v1.0.0〜v1.0.2 では「行クリック = 展開トグル + 編集ボタン経由で遷移」と書いていたが設計担当の DES-005 §5.6 アクション読み込み漏れ)|
| **セットプレイ削除ボタン UI の M4-02 スコープ外明確化**(v1.0.3 で明確化) | **`SetupEditorPage` 内の削除ボタン UI、ゴミ箱画面、復元 UI は M4-02 では実装しない**。論理削除 API(`DELETE /api/setups/{id}`)は M4-01 で完成済み。`SetupRecipeEditor` 内のステップ単位削除ボタン(レシピのステップ削除)は別物として M4-02 で実装する | §1.3(v1.0.3 で明確化、§5.2 シナリオ E 削除と整合)|
| **`Setup.description` / `Setup.name` の文字数制限なし**(v1.0.4 で明示) | **`name` / `description` は文字数制限なし、console.warn 警告なし**。`modifiers.notes` 50 文字 console.warn は setup_steps 配下のメモのみが対象、setup 本体の name / description は対象外。非対称性の根拠: `modifiers.notes` はコンボレシピレンダリング文字列に連結される可能性があり表示崩れ防止の意図、`description` / `name` は独立表示要素のため長文でも表示崩れの懸念が小さい。将来上限が必要になった場合は別途 CHANGE 通知書を起票 | §4.6.2(v1.0.4 で明示、DES-006 §10 一般論との解釈整理を含む)|

### 4.13 バックエンド API 追加・拡張(v1.0.1 で新設)

本節は v1.0.1 改訂で追加された。M4-02 製造担当 Plan Mode 中の確認(問題 A / B、2026-05-16)で M4-01 起票時の API 設計網羅性漏れが判明したため、M4-02 スコープ拡張(§2.4)としてバックエンド追加・拡張を含む。

#### 4.13.1 `GET /api/setups?characterId=X` 一覧エンドポイント追加(案 A1)

**用途**: §4.4.6 `useCharacterSetups` フックの前提として、同一キャラの既存 setup 一覧を取得する。

**エンドポイント**: `GET /api/setups?characterId={int}`

**クエリパラメータ**:

- `characterId`(必須): 取得対象のキャラクター ID

**レスポンス**(v1.0.2 で SetupSummary[] に修正):

```json
{
  "items": [
    {
      "id": 1,
      "characterId": 1,
      "name": "投げ抜け後セットアップ",
      "description": null,
      "stepCount": 3,
      "version": 1,
      "defaultRecipe": "立ち弱P > ...",
      "parentComboIds": [1, 5]
    }
  ]
}
```

**設計判断(v1.0.2 で更新)**:

- レスポンス DTO は `{"items": []SetupSummary}` 形(M4-01 §4.2.7 候補取得スタブと対称、配列レスポンスの統一形)
- **要素型は `SetupSummary`(軽量型、v1.0.2 で確定)**: steps を含まず、createdAt / updatedAt も含まない。`defaultRecipe` と `parentComboIds` は含む(`LinkExistingSetupModal` の既紐付け除外で `parentComboIds` を使用するため必須、一覧表示でレシピプレビューを出すため `defaultRecipe` も必須)
- M3 期間で確立した `ComboSummary` vs `Combo` の一覧/詳細型分岐規約(SUPP-001 §4)と整合
- 論理削除済み(`setups.deleted_at IS NOT NULL`)の setup は **除外**
- N+1 問題回避: parentComboIds は **個別取得ではなく一括取得**(setup 詳細取得 M4-01 の実装方針を踏襲、playbook §4.5 フローの素直さ原則)

**エラーレスポンス**:

- `characterId` 未指定または不正値: 400 + `invalid_query_parameter`(setup 系小文字スネークケース統一)
- `characterId` で指定されたキャラが存在しない: 200 + `{"items": []}`(エラーではなく空配列、ユーザビリティを優先)

**将来課題(v1.0.2 で明示)**: 本エンドポイントは **`characterId` 必須** で設計している(全件取得は許容しない)。将来「全キャラの setup を横断的に一覧する」ユースケースが発生した場合(例: setup 独立一覧画面の新設、管理者用バックアップ機能)は、別エンドポイント(例: `GET /api/setups/all`)または管理者用クエリパラメータ(例: `?scope=all`)として **CHANGE 通知書を起票** して追加設計する。現状の `characterId` 必須は意図的な設計で、無条件全件取得を排除する仕様。

**実装範囲(§2.2 バックエンド修正ファイル列挙参照)**:

- `internal/api/setup/handler.go`: `ListSetups` ハンドラ追加
- `internal/api/setup/dto.go`: `ListSetupsResponse` 追加
- `internal/service/setup/service.go`: `ListSetupsByCharacter(ctx, characterId)` 関数追加
- `internal/repository/setup/repository.go`: List クエリ追加(`SELECT ... WHERE character_id = ? AND deleted_at IS NULL`)
- `internal/api/router.go`(または相当): ルート登録

#### 4.13.2 `GET /api/combos/{id}` レスポンスへの `setups` フィールド追加(案 B1)

**用途**: §4.10.2 ComboDetailPage の setup 一覧取得の前提として、コンボ詳細レスポンスに紐付き setup を埋め込む。

**修正対象**: `internal/api/combo/dto.go`(または相当、§3.4.3 で実態確認した実際のファイル)の `ComboDetailResponse` 構造体。

**追加フィールド**:

```go
type ComboDetailResponse struct {
    Combo                              // 既存埋め込み
    Steps         []ComboStep    `json:"steps"`           // 既存
    Tags          []Tag          `json:"tags"`            // 既存
    DefaultRecipe string         `json:"defaultRecipe"`   // 既存(M3-05)
    Setups        []SetupResponse `json:"setups"`         // ★ v1.0.1 で追加
    // ... 既存その他フィールド
}
```

**設計判断**:

- フィールド名は `setups`(camelCase、CLAUDE.md §4 / SUPP-001 §6.4)
- 紐付く setup が 0 件の場合は **空配列 `[]`** を返す(`null` でも `omitempty` 省略でもない、フロント側の null チェック不要にするため)。Go の `[]SetupResponse{}` は JSON エンコード時に `[]` になる(`nil` だと `null` になるので注意)
- 各 setup の `SetupResponse` 型は M4-01 §4.2.1 で確定した共通型(`parentComboIds: []int64` 配列を含む、当該 setup が紐付くすべてのコンボ ID を列挙)
- 論理削除済み setup(`setups.deleted_at IS NOT NULL`)は **除外**
- 順序: `combo_setups.created_at ASC` が存在すればそれで安定ソート、無ければ `setup_id ASC`(§3.4.1 で `combo_setups` テーブルスキーマを実態確認)

**実装範囲(§2.2 バックエンド修正ファイル列挙参照)**:

- `internal/api/combo/dto.go`: `ComboDetailResponse` に `Setups []SetupResponse` フィールド追加
- `internal/service/combo/get.go`(または相当): コンボ詳細取得時に setup 一覧を JOIN 取得するロジック追加
- `internal/repository/combo/repository.go`(または相当): setup 一覧取得用のリポジトリメソッド呼び出し(setup 側 §4.13.1 List クエリの再利用または新規追加)
- N+1 回避: 1 コンボ詳細取得で SQL は (a) コンボ本体 + (b) 紐付き setup 全件 + (c) 各 setup の steps 全件 + (d) 各 setup の parentComboIds の構成を **一括クエリ** で組み立て

**回帰確認(必須)**:

- M3 までのコンボ詳細 API 呼び出しのレスポンス JSON 互換性: `setups` フィールドが追加されるが既存フィールドは不変、JSON エンコード順序は変わらない
- M3-05 統合 E2E シナリオが全通過
- 紐付く setup が 0 件のコンボでは `setups: []` が返る

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 フック層テスト(CLAUDE.md §5、M3-04 §5.1.4 パターン踏襲)

- [ ] `useSetup`: setupId 指定で fetch 成功 / setupId null で disabled
- [ ] `useCreateSetup`: 成功時に親コンボキャッシュ無効化、新規 setup キャッシュセット
- [ ] `useUpdateSetup`: 成功時に紐付くすべての combo キャッシュ無効化
- [ ] `useDeleteSetup`: 成功時に setup キャッシュ削除、親コンボキャッシュ無効化
- [ ] `useCreateSetupLink`: 成功時に combo / setup 両方のキャッシュ無効化
- [ ] `useDeleteSetupLink`: 同上
- [ ] `useCharacterSetups`: characterId 指定で fetch、null で disabled

#### 5.1.2 コンポーネントテスト(必須、CLAUDE.md §5)

- [ ] `SetupBasicInfoForm`: キャラ表示が読み取り専用、name / description 編集が onChange に伝達(v1.0.2 で mode prop 削除のため新規/編集モード分岐の検査は不要)
- [ ] `SetupRecipeEditor`: ステップ追加・削除・並び替え、`notes` 50 文字超で console.warn 発火(M4-00 / M4-00b と同パターン)
- [ ] `SetupAccordionItem`: 展開 / 折りたたみ、紐付け解除確認ダイアログ、編集遷移
- [ ] `LinkExistingSetupModal`: 候補一覧表示、既紐付け除外、候補 0 件メッセージ、クリックで紐付け

#### 5.1.3 ページコンポーネントテスト

- [ ] `SetupEditorPage` 新規モード: 親コンボから characterId 自動設定、保存で `useCreateSetup` 発火
- [ ] `SetupEditorPage` 編集モード: `useSetup` から初期値ロード、version 込みで PATCH
- [ ] `SetupEditorPage` 編集モードでのバージョン不一致: 409 エラー時のエラー表示

#### 5.1.4 既存ページの回帰テスト

- [ ] ComboDetailPage: M3 完了状態の表示項目 1〜7、10 が変わらない
- [ ] ComboDetailPage: セットプレイ展開セクション(item 8)が動作する
- [ ] ComboEditorPage: M3 完了状態の編集機能が変わらない

#### 5.1.5 バックエンドテスト(v1.0.1 で追加、§4.13 API 追加・拡張のテスト)

**§4.13.1 `GET /api/setups?characterId=X` のテスト**:

- [ ] サービス層 `ListSetupsByCharacter`: characterId 指定で該当キャラのみ返る
- [ ] サービス層 `ListSetupsByCharacter`: 論理削除済み setup が除外される
- [ ] サービス層 `ListSetupsByCharacter`: 各 setup の `parentComboIds` が正しく取得される(`combo_setups` JOIN 検証)
- [ ] サービス層 `ListSetupsByCharacter`: characterId に該当する setup が 0 件のとき空配列が返る
- [ ] ハンドラ層 `ListSetups`: クエリパラメータ `characterId` 未指定または不正値で 400 + `invalid_query_parameter`
- [ ] ハンドラ層 `ListSetups`: 存在しないキャラ ID 指定で 200 + `{"items": []}`(空配列)
- [ ] ハンドラ層 `ListSetups`: レスポンス JSON が `{"items": [...]}` 形式、フィールド名 camelCase
- [ ] **レスポンス要素型が `SetupSummary`**(v1.0.2 で確定): `steps` フィールドが含まれない、`createdAt` / `updatedAt` フィールドが含まれない、`defaultRecipe` / `parentComboIds` は含まれる
- [ ] リポジトリ層 List クエリ: `SELECT ... WHERE character_id = ? AND deleted_at IS NULL` の動作確認

**§4.13.2 `GET /api/combos/{id}` レスポンス拡張のテスト**:

- [ ] サービス層: コンボ詳細取得時に紐付き setup が JOIN 取得される
- [ ] レスポンス: `setups: []SetupResponse` フィールドが含まれる(JSON タグ camelCase)
- [ ] レスポンス: 紐付く setup が 0 件のときに `setups: []`(空配列、`null` ではない)が返る
- [ ] レスポンス: 論理削除済み setup が除外される
- [ ] レスポンス: 各 setup の `parentComboIds` 配列が当該 setup の全紐付きコンボを列挙
- [ ] **M3 完了状態の `GET /api/combos/{id}` 互換性**: 既存フィールド(steps / tags / defaultRecipe / コンボ本体)が不変、JSON エンコード時に既存呼び出しが影響を受けない
- [ ] **M3-05 統合 E2E シナリオの再実行で全通過**(本指示書 §4.13.2 で ComboDetailResponse を拡張したことによる回帰がないこと、最重要)

#### 5.1.6 ビルド・型チェック

- [ ] `cd web && pnpm test` が全通過する(setup 系の新規テスト + 既存 mycombo / character / combo 系テストの回帰なし)
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] **`make test` または `go test ./...` が全通過する**(v1.0.1 で追加: setup 系 + combo 系の新規バックエンドテスト含む、M4-01 完了状態の既存テストが回帰しない)
- [ ] **`go build ./...` が成功する**
- [ ] **`go vet ./...` でエラーなし**

### 5.2 E2E シナリオ(開発者の責任範囲)

製造担当 Claude Code は以下のシナリオを実装完了報告に手順書として記載する(開発者がブラウザで動作確認、playbook §14):

#### A. セットプレイ新規作成

1. コンボ一覧 → コンボ詳細(既存コンボ)を開く
2. 「セットプレイ追加」ボタンを押下 → `/combos/:comboId/setups/new` に遷移
3. キャラクター名が親コンボの値で表示(編集不可)
4. 名前・説明を入力、レシピステップを追加
5. 保存ボタン → 親コンボ詳細に戻る、セットプレイ展開セクションに新しい setup が表示される

#### B. セットプレイ編集(v1.0.3 で行クリック挙動明確化)

1. コンボ詳細のセットプレイアコーディオン行(展開アイコン領域以外の **ヘッダー部分**)をクリック → `/setups/:setupId` に遷移(DES-005 §5.6 アクション準拠、v1.0.3 確定)
2. 名前・レシピを変更、保存
3. 元のコンボ詳細に戻る、セットプレイ展開セクションが更新されている

#### C. 既存セットプレイから紐付け追加

1. 別のコンボ詳細を開く
2. 「既存セットプレイから紐付け」ボタン → モーダルが開く
3. 同一キャラの既存 setup 候補が表示される(既に紐付いている setup は除外)
4. 1 つ選んでクリック → 紐付け成功、モーダルが閉じる、セットプレイ展開セクションに追加される

**注(v1.0.3 で明示)**: 本シナリオでは「同一キャラの全候補表示」のみを検証する。`knockdown_advantage` や有利フレーム一致による絞り込み(FR011)は M4-03 のスコープであり、本シナリオには含めない。

#### D. 紐付け解除

1. コンボ詳細のセットプレイアコーディオン行を展開(展開アイコン ▶ をクリック)
2. 展開された領域内の「紐付け解除」ボタンを押下
3. 確認ダイアログで OK → 紐付け解除、セクションから消える
4. 該当 setup 自体は別のコンボ詳細では引き続き表示される(setup 本体は削除されていない)

#### E. 既存機能の回帰(v1.0.3 で前 G を E に繰り上げ)

1. M3 完了状態のコンボ詳細・コンボ編集・マイコンボ画面が動作する
2. M4-00 / M4-00b の RecipeBuilder / ModifiersEditor console.warn が引き続き動作する

#### F. アコーディオン展開アイコンの動作確認(v1.0.3 で新設、案 α 採用に伴う検査)

1. コンボ詳細のセットプレイアコーディオン行の **展開アイコン(▶/▼)** をクリック
2. その setup のみが展開され、レシピ(`defaultRecipe`)と紐付け解除ボタンが表示される
3. 展開アイコンを再度クリック → 折りたたまれる
4. **展開アイコンクリックでは編集画面に遷移しない**(行クリックと挙動が分離されていること、DES-005 §5.5 / §5.6 アコーディオン UI 規約準拠)
5. 紐付け解除ボタンクリックでも編集画面に遷移しない(stopPropagation 動作確認)

#### G. notes 50 文字超で console.warn(v1.0.3 で旧 F を G に繰り下げ)

1. セットプレイ編集画面でステップの notes に 51 文字以上を入力
2. ブラウザのコンソールに「setup_steps[N].modifiers.notes が 50 文字を超えています: NN 文字」が表示される
3. 50 文字以下に減らした後、追加発火がない

**注(v1.0.3 で明示)**: 本シナリオは **console.warn 出力のみ** を検証する。`notes` 50 文字超でセットプレイの新規作成・更新がブロックされる仕様は **存在しない**(§4.5.3 で警告ロジックを `console.warn` のみと明示)。E2E で「登録できない」を検証ステップに含めないこと。

#### v1.0.3 で削除されたシナリオ

- 旧シナリオ E「セットプレイ論理削除」: §1.3 v1.0.3 でセットプレイ削除ボタン UI を M4-02 スコープ外と明確化したため削除。論理削除 API(`DELETE /api/setups/{id}`)は M4-01 で完成済みだが、`SetupEditorPage` 内の削除ボタン UI は本指示書では実装しない。M5 以降または M7 で判断。

---

## 6. レビュー観点(別ファイル参照)

機械レビューは別ファイル `docs/instructions/reviews/M4-02-review-checklist.md` に従う。製造担当 Claude Code は本ファイルを読む必要はない。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧がすべて作成されている(setup フィーチャ 14 ファイル + ページ修正 4 ファイル + ルーティング + **v1.0.1 で追加した §2.2 バックエンド修正 12 ファイル**)
- [ ] §3.4 着手前確認の結果(特に §3.4.1 setup API 動作確認、§3.4.3 ComboDetailPage 構造確認)が実装完了報告に含まれている
- [ ] §4.9 SetupEditorPage が新規作成 / 編集モードで動作する
- [ ] §4.10 ComboDetailPage にセットプレイ展開セクション(§5.6 item 8)が追加されている
- [ ] §4.11 ComboEditorPage に「既存セットプレイから紐付け」ボタンが追加されている
- [ ] §4.4 setup フック群が動作する(create / update / delete / link / unlink)
- [ ] §4.8 LinkExistingSetupModal が動作する(既紐付け除外、候補 0 件メッセージ)
- [ ] **§4.13.1 `GET /api/setups?characterId=X` 一覧エンドポイントが動作する**(v1.0.1 で追加)
- [ ] **§4.13.2 `GET /api/combos/{id}` レスポンスに `setups: []SetupResponse` フィールドが追加されている**(v1.0.1 で追加、紐付き 0 件時は空配列)
- [ ] §5.2 E2E シナリオ A〜G がすべて通過する
- [ ] **CHANGE-003 適用が守られている**(セットプレイ編集画面側に紐付け操作 UI を実装していない)
- [ ] **M3-05 統合 E2E シナリオが回帰しない**(§4.13.2 で ComboDetailResponse を拡張したが既存呼び出しが影響を受けない)

### 7.2 自己テスト結果(製造担当の責任範囲)

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する(setup 系の新規テスト含む、既存テスト回帰なし)
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] §3.4.1〜§3.4.5 着手前確認の出力を含める
- [ ] 開発者向けの「動作確認手順書」(§5.2 E2E シナリオ A〜G の手順を含む)を実装完了報告に含める
- [ ] 開発サーバー起動時にコンソール警告(React の key 警告等)が新規発生していない(意図的な console.warn は除く)

**バックエンド側(v1.0.1 で追加、§4.13 API 追加・拡張対応)**:

- [ ] `make test` または `go test ./...` が全通過する(setup / combo 系の新規テスト含む、M4-01 完了状態の既存テストが回帰しない)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付(§4.13.1 `GET /api/setups?characterId=X`、§4.13.2 `GET /api/combos/{id}` の `setups` フィールド)
- [ ] エラーケース(400 `invalid_query_parameter`、空配列レスポンス)を `curl` で再現
- [ ] **M3-05 統合 E2E シナリオを必ず再実施**(`GET /api/combos/{id}` レスポンス拡張による回帰確認、最重要)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

ブラウザでの実機動作確認は **開発者の責任範囲**(playbook §14)。

### 7.3 品質チェック

- [ ] CLAUDE.md §4 TypeScript 規約に準拠(camelCase JSON タグ、関数コンポーネント + Hooks)
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層・コンポーネント層・ページ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない(`console.log` を本番コードに残していない、意図的な `console.warn` は除く)
- [ ] **architecture-patterns.md §1 フック分離パターンに準拠**(api/ + hooks/ + components/ + types.ts の構造)
- [ ] **CHANGE-003 適用**(セットプレイ編集画面側の紐付け操作 UI を実装していない)
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-01 の共通 `SetupResponse` 型(`parentComboIds: number[]` 配列)を前提として実装している**
- [ ] **`Setup.deletedAt` / `SetupStep.setupId` がフロント型定義から除外されている**(M4-01 v1.0.2 で `json:"-"` 化、API レスポンスに出ない)
- [ ] **playbook §4.5 フローの素直さ原則に抵触していない**(エラー駆動再試行フロー禁止、楽観的排他は `version` で素直に判定)
- [ ] **playbook §4.7 全ハンドラ列挙原則の確認**: 本指示書では新規エラー型を導入していないため対象外

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M4-02 完了報告を追記する
- [ ] **CHANGE-003 適用**(セットプレイ編集画面側に紐付け操作を持たせない)を厳守した事実を明記
- [ ] §3.4 着手前確認結果を含める(全 5 項目、特に §3.4.1 setup API 動作確認 / §3.4.3 ComboDetailPage 構造確認)
- [ ] 設計判断事項表(§4.12)の各項目が指示書通りに実装された旨を明記
- [ ] **§4.13.1 `GET /api/setups?characterId=X` の追加実装が完了した事実を明記**(v1.0.1 で追加、Plan Mode 問題 A の判断結果)
- [ ] **§4.13.2 `GET /api/combos/{id}` レスポンス拡張(`setups` フィールド追加)の実装完了を明記**(v1.0.1 で追加、Plan Mode 問題 B の判断結果)
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)を明記

### 7.5 完了報告

- [ ] 開発者に「M4-02 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める
- [ ] M4-03 着手の前提条件が整ったことを宣言(setup 単体 UI が動作、コンボ詳細・編集からの紐付け操作が完成、FR011 / knockdown 確認モーダルは M4-03 で着手可能)

---

## 8. 参照ドキュメント

| ID / ファイル | 関連節 |
|--------------|--------|
| CLAUDE.md | §4 TypeScript 規約、§5 テスト規約、§10 禁止事項 |
| **DES-005** | **§5.6 コンボ詳細(item 8 セットプレイ展開)、§5.9 セットプレイ登録・編集** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05(フロント側はバックエンドエラー応答を表示) |
| **M4-01 指示書 v1.0.2** | **§4.2 API エンドポイント、§4.2.1 共通 `SetupResponse` 型、§4.7 エラーレスポンス形式** |
| M4-overview v1.1.2 | §3.3 M4-02 詳細、§5 M4 で扱わないもの |
| architecture-patterns.md v1.0.0 | §1 フック分離パターン |
| CHANGE-003 通知書 | セットプレイ編集画面側の紐付け操作除外の経緯 |
| M3-04 指示書 | useCharacters / フック分離パターンの実装例(参考) |
| M2-01 指示書 | SF6Controller の再利用元(参考) |
| M2-04 / M4-00 / M4-00b 指示書 | RecipeBuilder / ModifiersEditor の console.warn パターン(参考) |
| SUPP-001 §3.3.0 / §5.9 | Modifiers 構造体、PATCH 送信ポリシー |
| playbook v1.6.0 | §4.5 / §4.6 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で setup API が想定と異なる挙動を示す場合(M4-01 v1.0.2 で `ParentComboIDs` が配列でない等)
- §3.4.2 で SF6Controller / RecipeBuilder / ModifiersEditor の配置パス・props 構造が想定と大きく異なる場合
- §3.4.3 で ComboDetailPage(または相当)に既にセットプレイ展開セクションの骨組みが存在する場合(M2-03 等で先行実装されている可能性、回帰リスク判定が必要)
- §4.4.6 useCharacterSetups の案 1 が動作しない場合の代替方針(案 2 / 案 3 の判断)
- §4.10.2 ComboDetailPage の `useCombo` レスポンスに `setups` フィールドが含まれない場合の代替取得方法
- 既存コンボ詳細画面の §5.6 item 8 位置が、既存実装の他セクションと整合しない構造になっている場合のレイアウト調整

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは完了報告に明示する:

- 表示文言の細部(「セットプレイ」「セットプレイ追加」「既存セットプレイから紐付け」「紐付け解除」等の和文表現)
- Tailwind クラスの細部(色・余白・タイポグラフィ)
- アコーディオン展開アニメーションの有無(無くてもよい、CSS transition のみで十分)
- 確認ダイアログのメッセージ文言

### 9.3 不明事項発見時の対応

- 設計書本体(DES-005 §5.6 / §5.9)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認
- M4-01 setup API の不備が発覚した場合 → 実装を止めて開発者に報告(M4-01 への補修対応として処理)

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode 使用を推奨(本指示書は §3.4 着手前確認の項目数が多く、実態確認結果を開発者と共有する意義が大きい):

- §3.4 着手前確認の結果(全 5 項目)
- 特に §3.4.1 setup API 動作確認結果(`ParentComboIDs` が配列で返るか、エラー形式が想定通りか)
- §3.4.3 ComboDetailPage の現状構造(既存セクションとの配置整合)
- §4.4.6 useCharacterSetups の API 経路選択(案 1 / 案 2)
- §4.5 SetupRecipeEditor の実装方針(RecipeBuilder 再利用 / 新規実装の判断)
- §4.10.2 ComboDetailPage の setup 一覧取得方法
- 既存ロジック再利用範囲(SF6Controller、useCharacters、useCharacterName 等)

---

## 10. 完了後の次ステップ

M4-02 完了後、開発者が動作確認・承認したら **M4-03(FR011 転用支援 + knockdown_advantage 確認モーダル)** に進む。

M4-03 着手時の前提条件:

- setup CRUD API が動作している(M4-01 で実装)
- setup 単体 UI が動作している(本指示書で実装)
- コンボ詳細・コンボ編集からの既存セットプレイ紐付け UI が動作している(本指示書で実装)
- ComboDetailPage のセットプレイ展開セクション(§5.6 item 8)が組まれているため、M4-03 で item 9「転用候補」セクションを同じ場所に追加できる

---

*以上*
