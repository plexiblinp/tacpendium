# M3-02 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| チェックリストID | M3-02-REVIEW |
| バージョン | 1.0.0 |
| 対象指示書 | `docs/instructions/M3-02-tag-assignment-ui.md` v1.0.0 |
| 対象マイルストーン | M3-02: コンボへのタグ付け UI(編集画面のタグ選択 + 一覧/詳細のタグ表示) |
| 推奨レビューモデル | **Sonnet 4.6**(model-allocation.md v1.2.0 準拠) |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

レビュー開始前に以下を必ず読む:

1. `CLAUDE.md`(全体方針、特に **§4「JSON タグ・API DTO 型は camelCase で統一」**、§10 禁止事項、§10.X ブラウザストレージ運用ルール)
2. `docs/instructions/M3-02-tag-assignment-ui.md` v1.0.0(本チェックリストの対象指示書)
3. `docs/instructions/M3-overview.md` v1.0.1(M3 全体運用ルール、特に §6.6 レビューチェックリスト強化、§6.9「副次効果」表現禁止)
4. `docs/instructions/M3-01-tag-feature-and-management.md`(M3-01 で整備済みのタグ API・型定義の前提知識)
5. `docs/design/03-data-model.md` §3.4(combos + version)、§3.6(tags)、§3.7(combo_tags)
6. `docs/design/05-screen-design.md` §5.4(コンボ一覧 タグ列 L207)、§5.6(コンボ詳細)、§5.7(コンボ編集 タグ選択 L329)
7. `docs/design/02-architecture.md` §4.2 PATCH /api/combos の説明(L138)、§4.3 エラーハンドリング
8. `docs/design/06-validation.md` VAL-C01〜C12
9. `docs/design/supp-001-detailed-design.md` §3.4 編集2方式分離、§5.4 / §5.5 テスト規約、§6.4 JSON 命名規則
10. `docs/handover/design-instruction-playbook.md` v1.2.0 **§4.5 フローの素直さ原則**(M3-01 完了報告で追加された運用ルール)
11. 製造担当の実装完了報告書(本リスト適用前に受領済み)

### 0.2 レビューの基本姿勢

- **設計書本体との行レベル照合を最優先**(playbook §5、retro R-01 対策)
- **JSON タグ・API DTO 型の camelCase 統一を厳格にチェック**(M3-01 完了報告で明文化された規則、本マイルストーンが初の本格適用)
- **playbook §4.5 フローの素直さ原則の遵守を厳格にチェック**(M3-01 完了報告で追加された規則、本マイルストーンが初の適用)
- **「副次効果として〜される」「自動的に〜される」という前提が指示書・実装に紛れ込んでいないか確認**(playbook §4.1)
- **楽観的排他制御 + tag 操作のトランザクション整合性を厳格にチェック**(本マイルストーン固有の重要観点)
- **M1-05 暫定処理2(タグ列ハイフン)の解消が完了していることを確認**
- 機械的チェックリスト確認に加え、設計意図との整合を読み取る(playbook §9.3)
- 重大な問題と軽微な問題を区別する(§9 / §10 参照)

### 0.3 レビュー結果の報告フォーマット

レビュー完了時に以下のフォーマットで報告する:

```
## レビュー結果サマリ

- 重大な問題: {件数}件
- 軽微な問題: {件数}件
- 質問・確認事項: {件数}件

## 重大な問題詳細
(各問題の節番号、対象ファイル、内容、修正提案を記載)

## 軽微な問題詳細
(同上)

## 質問・確認事項
(設計担当 Claude または開発者への確認事項)

## レビュー判定
- [ ] 重大な問題なし → 承認
- [ ] 重大な問題あり → 製造担当に修正依頼
```

---

## 1. 設計書本体との照合(retro R-01 対応、最重要観点)

### 1.1 combos テーブル + version カラム(DES-003 §3.4 L329 付近)

実装ファイル: 既存(M1-02 で整備済み)、本マイルストーンでは変更しない

- [ ] `combos.version` カラムの楽観的排他制御が PATCH /api/combos/:id で従来通り機能している(製造担当の curl 結果で 409 エラー確認を求める)
- [ ] tag 更新時も version チェックが効く(version 古い PATCH リクエストで tag も更新されないことが §1.7 で確認できる)

### 1.2 tags テーブル DDL(DES-003 §3.6 L446-458)

実装ファイル: 既存(M1-02 / M3-01 で整備済み)、本マイルストーンでは変更しない

- [ ] tags テーブルの DDL が変更されていないことを `sqlite3 .schema tags` で確認

### 1.3 combo_tags テーブル DDL(DES-003 §3.7 L460-467)

実装ファイル: 既存(M1-02 で整備済み)、本マイルストーンでは変更しない

- [ ] combo_tags テーブルのカラムが DES-003 §3.7 と一致している(combo_id, tag_id, PK `(combo_id, tag_id)`)
- [ ] **`ON DELETE CASCADE` 設定の確認結果**(M3-02 §3.4.5 で製造担当が確認した結果)を報告書で確認:
  - **設定されている場合**: 重複判定キー変更編集時の旧コンボ combo_tags は CASCADE で連動削除される。このまま OK
  - **設定されていない場合**: M3-02 §9.1 で「Plan Mode で停止」と指示されているため、製造担当が停止 → 開発者協議 → 何らかの対処(設計書本体修正 + マイグレーション追加 等)を経たはず。その対処内容が設計書本体と整合しているかを確認

### 1.4 CreateComboInput / UpdateMetadataInput DTO 拡張(M3-02 §4.3.1)

実装ファイル: `internal/model/combo.go`(または既存の DTO 定義場所)

- [ ] `CreateComboInput` に `TagIDs []int64 \`json:"tagIds,omitempty"\`` フィールドが追加されている
- [ ] `UpdateMetadataInput` に `TagIDs *[]int64 \`json:"tagIds,omitempty"\`` フィールドが追加されている(**ポインタ型** であること、スライス型 `[]int64` ではない)
- [ ] **JSON タグが camelCase**(`tagIds`)で定義されている(snake_case `tag_ids` ではない)
- [ ] フロント側 `web/src/features/combo/api/comboApi.ts`(または相当)の TypeScript 型に `tagIds?: number[]` フィールドが追加されている
- [ ] フロント側 TypeScript 型のフィールド名も camelCase で統一されている

### 1.5 サービス層トランザクション処理(M3-02 §4.3.2)

実装ファイル: `internal/service/combo/service.go`

- [ ] `CreateCombo` 内で combo 作成 + combo_tags 操作が同一トランザクション内で実行されている
- [ ] `UpdateMetadata` 内で combos 更新(version チェック含む) + combo_tags 操作が同一トランザクション内で実行されている
- [ ] `UpdateMetadata` で `input.TagIDs == nil` の場合、combo_tags は変更されないこと(指示書 §4.3.1 の3状態区別:nil = 変更なし)
- [ ] `UpdateMetadata` で `*input.TagIDs == []int64{}`(空配列)の場合、既存 combo_tags が全削除されること
- [ ] `UpdateMetadata` で `*input.TagIDs != nil` かつ要素ありの場合、既存削除 + 新規 INSERT で置き換えされること
- [ ] version チェックが失敗した場合(409)は combo_tags の操作も行われないこと(トランザクションロールバック確認、§5.1.1 のテストでカバー)

### 1.6 ReplaceTagAssociations 補助関数(M3-02 §4.3.3)

実装ファイル: `internal/repository/combo/repository.go`

- [ ] `ReplaceTagAssociations(ctx, tx, comboID, tagIDs) error` のシグネチャで実装されている
- [ ] `tx *sql.Tx` を引数で受け取り、独立トランザクションを作らないこと
- [ ] 実装: DELETE 全件 → INSERT 一括(tagIDs が空の場合は INSERT スキップ)
- [ ] FK 違反エラーが発生した場合、`ErrInvalidTagID` に変換されてサービス層に伝わること(§4.3.4)
- [ ] この補助関数が `combo` リポジトリに置かれていること(`tag` リポジトリ側に置かれていないこと、責務分離の維持)

### 1.7 タグ ID 検証(M3-02 §4.3.4)

- [ ] **事前の SELECT による存在チェックが実装されていない**(playbook §4.5 フローの素直さ原則、不要な事前検証)
- [ ] 存在しないタグ ID 指定時に FK 違反エラーをキャッチして `ErrInvalidTagID` に変換
- [ ] エラーレスポンスが `{error: {code: "INVALID_TAG_ID", details: {invalid_ids: [...]}}}` の構造で返ること
- [ ] HTTP ステータスが 400 であること

### 1.8 一覧 API レスポンスの tags フィールド(M3-02 §4.4.1 / §4.4.2)

実装ファイル: `internal/repository/combo/repository.go` の List 系クエリ、`internal/service/combo/service.go`

- [ ] レスポンス DTO に `Tags []Tag \`json:"tags"\`` フィールドが追加されている
- [ ] `omitempty` が **付いていないこと**(空配列 `[]` で返すため、`omitempty` だと `null` または省略になる)
- [ ] **2 クエリ + IN 句方式** で実装されている(GROUP_CONCAT 等の文字列パース方式ではない)
- [ ] サービス層で `tags == nil` 時に `[]Tag{}` で初期化している(JSON シリアライズで `null` ではなく `[]` を返すため)
- [ ] N+1 クエリになっていない(コンボ件数に関わらずクエリ回数は常に 2 回)

### 1.9 詳細 API レスポンスの tags フィールド(M3-02 §4.4.3)

実装ファイル: `internal/repository/combo/repository.go` の Get 系クエリ

- [ ] レスポンス DTO に `Tags []Tag \`json:"tags"\`` フィールドが追加されている
- [ ] 単純な JOIN クエリで実装されている(`SELECT t.* FROM combo_tags ct INNER JOIN tags t ON t.id = ct.tag_id WHERE ct.combo_id = ?`)
- [ ] サービス層で `tags == nil` 時に `[]Tag{}` で初期化している

### 1.10 コンボ一覧画面のタグ列実データ反映(M3-02 §4.4.4)

実装ファイル: `web/src/features/combo/components/ComboTableRow.tsx`(または相当)

- [ ] M1-05 暫定処理2(`<td>-</td>` 固定表示)が解消されている
- [ ] `<TagBadgeList tags={combo.tags} excludeCategories={["mycombo_status"]} />` または相当の実装になっている
- [ ] タグ 0 件のコンボでセル内容が空(ハイフン表示にならない、§4.5.1 の指示書方針)
- [ ] フロント側 `web/src/types/combo.ts`(または相当)のコンボ DTO 型に `tags?: Tag[]` または `tags: Tag[]` が追加されている

### 1.11 タグ選択 UI(M3-02 §4.1、DES-005 §5.7 表示項目11)

実装ファイル: `web/src/features/tag/components/TagSelector.tsx`

- [ ] 既存タグの **複数選択** が動作する
- [ ] 検索可能なタグ一覧(検索文字列でフィルタ動作)
- [ ] 選択中タグのバッジ表示(色付き)
- [ ] バッジ右の × ボタンで個別解除
- [ ] **新規タグ作成**: 検索ボックスに既存タグ名と一致しない名称を入力時に「『xxx』を新規作成」オプションが表示され、クリックで作成 + 自動選択
- [ ] Props 設計が指示書 §4.1.2 の `TagSelectorProps` インターフェースと一致(`selectedTagIds`、`onChange`、`excludeCategories`、`disabled`)
- [ ] M3-01 の `useTagManagement().createMutation` を内部で使っている(独自 API 呼び出しを再実装していない)
- [ ] DES-005 §5.7 表示項目11「タグ選択(既存タグから複数選択、新規作成も可能)」の要件を満たしている

### 1.12 タグセレクタ用フック(M3-02 §4.2)

実装ファイル: `web/src/features/tag/hooks/useTagsForSelector.ts`

- [ ] M3-01 の `GET /api/tags`(`include_usage` 不指定)を呼ぶ
- [ ] queryKey が `['tags', { include_usage: false }]` で、M3-01 の `useTagManagement` の queryKey `['tags', { include_usage: true }]` と分離されている
- [ ] `excludeCategories` オプション指定時にフィルタ動作

### 1.13 タグ表示コンポーネント(M3-02 §4.5)

実装ファイル: `web/src/features/tag/components/TagBadgeList.tsx`

- [ ] `tags: Tag[]` を受け取り色付きバッジ群を描画
- [ ] タグが空または excludeCategories で全件除外された場合、何も表示しない(セル内容が空)
- [ ] `excludeCategories` props でカテゴリフィルタ
- [ ] `maxVisible` props で省略表示(`+N` バッジ)
- [ ] `color` NULL 時のデフォルト色(指示書 §4.5.3 では `#9CA3AF` 相当を推奨、製造担当が別値を採用した場合はコメントで根拠が明示されているか)
- [ ] 文字色の自動選択(輝度判定、白または黒)

### 1.14 コンボ詳細画面のタグ表示(M3-02 §4.6、DES-005 §5.6)

実装ファイル: `web/src/features/combo/components/ComboDetailPage.tsx`(または相当)

- [ ] `<TagBadgeList tags={combo.tags} />` が組み込まれている(excludeCategories **未指定**、詳細画面では全タグ表示)
- [ ] 配置位置が DES-005 §5.6 と整合している

---

## 2. API 整合性(retro R-08)

### 2.1 リクエスト/レスポンス DTO の整合

- [ ] バックエンド `CreateComboInput.TagIDs` とフロント `CreateComboInput.tagIds` が同じ意味で対応
- [ ] バックエンド `UpdateMetadataInput.TagIDs *[]int64` とフロント `UpdateMetadataInput.tagIds?: number[]` が対応(ただしフロント TypeScript ではポインタ概念がないため、3状態区別はリクエストボディに `tagIds` キーを含めるか含めないかで表現)
- [ ] レスポンス DTO の `Tags []Tag` とフロント `tags: Tag[]` が対応
- [ ] フロント Tag 型と バックエンド Tag DTO(M3-01 で確定)が camelCase で完全一致

### 2.2 エラーレスポンス共通フォーマット(DES-002 §4.3)

- [ ] エラーレスポンスが `{error: {code, message, details?}}` 構造に従っている
- [ ] HTTP ステータスとエラーコードの対応:
  - 400 + `INVALID_TAG_ID`(存在しないタグ ID 指定、details に `invalid_ids: number[]`)
  - 404(コンボ不存在、PATCH 時)
  - 409 + 楽観的排他制御エラー(version 古い、tag 更新も同時実行されない)

### 2.3 各エンドポイントの動作確認

製造担当の curl 結果報告を確認:

- [ ] `POST /api/combos` with `tagIds: [1, 2]` → 201、レスポンスに `tags` 配列(2件)
- [ ] `POST /api/combos` with `tagIds: [9999]`(存在しない ID) → 400 + INVALID_TAG_ID
- [ ] `GET /api/combos` → 200、各コンボに `tags` フィールド(空でも `[]`、`null` ではない)
- [ ] `GET /api/combos/:id` → 200、`tags` フィールド(空でも `[]`)
- [ ] `PATCH /api/combos/:id` with `tagIds: [3]` → 200、tags 置き換え
- [ ] `PATCH /api/combos/:id` with `tagIds: []` → 200、全解除
- [ ] `PATCH /api/combos/:id` without `tagIds` field → 200、tags は変更されない(リクエストボディから完全に欠落していること)
- [ ] `PATCH /api/combos/:id` with `tagIds: [9999]` → 400 + INVALID_TAG_ID
- [ ] `PATCH /api/combos/:id` with 古い version + `tagIds: [3]` → 409、combo_tags も変更されていない(DB を直接 SELECT で確認した結果)

### 2.4 JSON 命名規則の統一(CLAUDE.md §4)

- [ ] **すべての JSON タグが camelCase で統一されている**(`tagIds`、`tags`、`tagId` 等、スネークケースの混入なし)
- [ ] バックエンド側 `grep -rn 'json:"' internal/model/` の結果に snake_case が含まれていない
- [ ] フロント側 `grep -rn '\\b\\w*_\\w*\\b' web/src/types/` で API DTO 型に snake_case が含まれていない
- [ ] DB カラム名(`db:"user_id"` 等)は snake_case のまま、JSON タグとの分離が保たれている

---

## 3. フロントエンドの動作仕様

### 3.1 ComboEditor へのタグ選択 UI 統合(M3-02 §2.2)

実装ファイル: `web/src/features/combo/components/ComboEditor.tsx`

- [ ] 既存のタグ選択箇所(プレースホルダー)に `<TagSelector excludeCategories={["mycombo_status"]} ... />` が組み込まれている
- [ ] `tagIds` state が追加され、保存時のリクエストボディに含まれている
- [ ] copy モード(M2-02 で実装)で既存コンボの `tagIds` が引き継がれること(E2E シナリオ C で確認)
- [ ] PATCH 経由のメタデータ編集時、tagIds に変更がないなら `tagIds` フィールドをリクエストボディに含めない(または `undefined` で送信して JSON.stringify で除外させる)。**「変更なし」と「全解除」の区別** がリクエストレベルで実現されているか

### 3.2 重複判定キー変更編集時のタグ引き継ぎ(M3-02 §4.3.5)

- [ ] `ComboEditor` の保存ロジックで、重複判定キー変更編集(POST 経由、論理削除 + 新規)の場合、編集前の `tagIds` を保持して `CreateComboInput.tagIds` に渡している
- [ ] M2-02 で確立した copy モードのフィールド引き継ぎパターンと同じ思想で実装されている
- [ ] バックエンド側で「旧コンボの combo_tags を新コンボに自動引き継ぎ」のような副次的処理が **入っていない**(指示書 §4.7 確定の「フロント側引き継ぎ」と整合)

### 3.3 mycombo_status カテゴリ除外(M3-02 §4.7)

- [ ] `TagSelector` を ComboEditor から呼ぶ箇所で `excludeCategories={["mycombo_status"]}` が渡されている
- [ ] `TagBadgeList` を ComboTableRow から呼ぶ箇所で `excludeCategories={["mycombo_status"]}` が渡されている
- [ ] `TagBadgeList` を ComboDetailPage から呼ぶ箇所で `excludeCategories` が **未指定**(全タグ表示)
- [ ] `useTagsForSelector({ excludeCategories: ["mycombo_status"] })` のパターンで使われている

### 3.4 楽観的排他制御エラーのフロント表示

- [ ] PATCH 409(version 古い)エラー時、フロント側で適切なエラー表示(M2-02 で確立した既存の挙動を踏襲、本マイルストーンで新規挙動を追加していないことを確認)

---

## 4. テストの妥当性

### 4.1 バックエンドテスト

#### 4.1.1 サービス層テスト(M3-02 §5.1.1)

`internal/service/combo/service_test.go` で以下が **追加** されているか:

- [ ] `CreateCombo with empty TagIDs`: タグなしで正常作成、combo_tags にレコードなし
- [ ] `CreateCombo with valid TagIDs`: 複数タグ ID で正常作成、combo_tags に対応レコード
- [ ] `CreateCombo with invalid TagID`: 存在しないタグ ID → ErrInvalidTagID、コンボも作成されていない(トランザクションロールバック確認)
- [ ] `UpdateMetadata with TagIDs nil`: タグ関連が変更されない
- [ ] `UpdateMetadata with TagIDs empty array`: 既存タグが全解除
- [ ] `UpdateMetadata with TagIDs values`: 既存タグが置き換えられる
- [ ] `UpdateMetadata version conflict + TagIDs`: 楽観的排他制御で version が古い場合、tag 操作も行われない(トランザクションロールバック)
- [ ] 既存テストが温存されている(回帰なし)
- [ ] テストが全通過(`make test` または `go test ./...` の結果報告)

#### 4.1.2 リポジトリ層テスト(M3-02 §5.1.2)

`internal/repository/combo/repository_test.go` で以下が追加されているか:

- [ ] List クエリの tags 取得(2クエリ方式)が動作する(複数コンボ + 各コンボ 0〜N タグの状態でテスト)
- [ ] `ReplaceTagAssociations`: tagIDs 空配列 / 値あり の両ケース動作

#### 4.1.3 ハンドラ層テスト(M3-02 §5.1.3)

`internal/api/combo/handler_test.go` で以下が追加されているか:

- [ ] `POST /api/combos with tagIds`: 正常系
- [ ] `PATCH /api/combos/:id with tagIds`: 置き換え動作
- [ ] `PATCH /api/combos/:id without tagIds field`: tags 不変
- [ ] `PATCH /api/combos/:id with tagIds: []`: 全解除
- [ ] `POST with invalid tagIds`: 400 + INVALID_TAG_ID

### 4.2 フロントエンドテスト(M3-02 §5.1.4)

- [ ] `TagSelector.test.tsx`:
  - selectedTagIds の表示状態
  - 選択追加/解除での onChange 発火
  - 検索フィルタ動作
  - 新規タグ作成オプションの表示条件
  - excludeCategories の動作
- [ ] `TagBadgeList.test.tsx`:
  - 0件、1件、N件、N+1 件の表示分岐
  - excludeCategories 動作
  - color NULL 時のデフォルト色
- [ ] `ComboEditor` 既存テストへの **追加**:
  - tagIds を含む保存リクエストの組み立て
- [ ] `pnpm test` 全通過
- [ ] `pnpm build` 成功
- [ ] TypeScript 型エラーなし

### 4.3 E2E シナリオ動作確認手順書(M3-02 §5.2)

- [ ] 製造担当が「動作確認手順書」を実装完了報告に含めているか
- [ ] §5.2 シナリオ A〜E が手順書に網羅されているか:
  - シナリオ A: 新規コンボにタグ付与(8 ステップ)
  - シナリオ B: 既存コンボのタグ編集(メタデータ編集)(6 ステップ)
  - シナリオ C: 重複判定キー変更編集との連携(3 ステップ)
  - シナリオ D: mycombo_status カテゴリ除外(3 ステップ)
  - シナリオ E: バリデーション(2 ステップ)
- [ ] 各ステップの期待結果が具体的に記述されているか

開発者がブラウザで手動実行して全シナリオが通ることが M3-02 完了の前提条件。

---

## 5. 設計意図との整合(機械的チェックを超えた観点)

### 5.1 楽観的排他制御 + tag 操作のトランザクション整合性(M3-02 固有の最重要観点)

- [ ] PATCH /api/combos/:id でメタデータ更新と combo_tags 操作が **同一トランザクション** 内で実行されているか
- [ ] version チェックが先に実行され、失敗時(409)は combo_tags も更新されないか(部分的にタグだけ更新される事故が起きないか)
- [ ] §1.7 のテスト(`UpdateMetadata version conflict + TagIDs`)で、ロールバック後の DB 状態が「combos も combo_tags も変更されていない」ことを確認しているか

### 5.2 編集2方式分離(SUPP-001 §3.4)との整合

- [ ] PATCH 経由のメタデータ編集でタグ更新が完結しているか(指示書 §4.3.5)
- [ ] 重複判定キー変更編集(POST 経由、論理削除 + 新規)でタグが引き継がれる経路が明確か:
  - 旧コンボの combo_tags は CASCADE で連動削除(または明示削除)
  - 新コンボの作成時に `CreateComboInput.TagIDs` で再付与(フロント側引き継ぎ)
- [ ] バックエンド側で「旧コンボの combo_tags を新コンボに自動引き継ぎ」のような副次的処理が実装されていない(playbook §4.1「副次効果として〜される」表現の防止)

### 5.3 フローの素直さ原則(playbook §4.5、M3-01 完了報告で追加)

- [ ] **事前 SELECT による存在チェックが実装されていない**(タグ ID 検証は FK 違反エラーのキャッチ + 変換で実現)
- [ ] エラー駆動の再試行フローを書いていない(クライアントが 400 を受けて別の方法でリトライする等)
- [ ] フロント側で 1 回の保存リクエストで完結している(タグ操作と combo 操作が別 API 呼び出しになっていない)
- [ ] 「副次効果として〜される」「自動的に〜される」という表現が指示書本文・実装コード・PR 説明・実装完了報告に紛れていないか:
  - 例えば「タグ列が副次効果として更新される」「重複判定キー変更時にタグが自動引き継がれる」のような記述

### 5.4 N+1 問題の回避(M3-02 §4.4.2)

- [ ] 一覧 API のタグ取得が 2 クエリ + IN 句方式で実装されている(コンボ件数に依存せずクエリ回数 2 回固定)
- [ ] レスポンスタイムが許容範囲(数百コンボでも問題なし)
- [ ] GROUP_CONCAT 等の代替方式が **採用されていない**(指示書 §4.4.2 の判断と一致)

### 5.5 M3-01 で整備したタグ機能との整合

- [ ] M3-01 の `useTagManagement().createMutation` が新規タグ作成で再利用されている(独自実装の重複なし)
- [ ] `useTagsForSelector` と `useTagManagement` のキャッシュキーが分離されている(`include_usage: false` vs `true`)
- [ ] M3-01 で確立した Tag DTO 型(camelCase)が変更されていない

### 5.6 暫定処理2(タグ列ハイフン)解消の確認

- [ ] M1-05 暫定処理2「コンボ一覧タグ列が `-` 固定表示」が完全に解消されている
- [ ] progress-log.md に解消事実が記録されているか
- [ ] 一覧画面のタグ列の表示が:
  - タグありの場合 → バッジ群が表示される
  - タグなしの場合 → セル内容が空(ハイフン表示にならない)
  - 全タグが mycombo_status カテゴリの場合 → セル内容が空(excludeCategories でフィルタされる)

---

## 6. コード品質・規約遵守

### 6.1 Go 規約(CLAUDE.md §4)

- [ ] エラーが `fmt.Errorf("...: %w", err)` で wrap されている
- [ ] サービス層メソッドの第一引数が `context.Context`
- [ ] 公開 API(大文字始まり)に godoc コメントが付いている
- [ ] パッケージ名が短く小文字、型名が PascalCase、関数が CamelCase
- [ ] **JSON タグが camelCase で統一**(指示書 §4.7、CLAUDE.md §4 で明文化)
- [ ] パニックが回復不能な初期化以外で使われていない

### 6.2 TypeScript 規約(CLAUDE.md §4)

- [ ] `strict` モードで型エラーなし
- [ ] `any` が原則使われていない
- [ ] 関数コンポーネント + Hooks のみ
- [ ] コンポーネントが PascalCase、フックが `useXxx`、定数が SCREAMING_SNAKE_CASE
- [ ] import 順が React → サードパーティ → エイリアスパス → 相対パス
- [ ] **API DTO 型が camelCase で統一**(CLAUDE.md §4)

### 6.3 ブラウザストレージ未使用の確認(M3-02 では機会なし)

M3-02 ではブラウザストレージを使用する機能がない(タグデータは全てサーバー永続化、表示列カスタマイズは M3-03 のスコープ)。

- [ ] `localStorage` / `sessionStorage` / `IndexedDB` の使用がないことを `grep -rn 'localStorage\|sessionStorage\|IndexedDB' web/src` で確認
- [ ] 万一使用が検出された場合、CLAUDE.md §10.X 許容範囲(コンボ一覧表示列カスタマイズ、仮想コントローラ選択保持、下書き自動保存)外と判定された場合は **重大な問題**

### 6.4 共通(CLAUDE.md §4)

- [ ] マジックナンバー・マジックストリングが定数化されている(例: `excludeCategories` の値 `"mycombo_status"` を定数化することが望ましい)
- [ ] TODO コメントが `// TODO(<対応予定>): <内容>` 形式
- [ ] 不要なコメントアウトコードが削除されている
- [ ] `console.log` / `fmt.Println` が本番コードに残っていない

---

## 7. 既存挙動の温存(過去マイルストーンへの非破壊性)

### 7.1 既存テーブルへの影響

- [ ] tags / combo_tags / combos テーブルの DDL を本マイルストーンで変更していない
- [ ] 他の既存テーブルに予期しない変更が加わっていない

### 7.2 既存 API への影響

- [ ] `GET /api/combos` のレスポンスに `tags` フィールドが追加されたが、それ以外の既存フィールドが変更されていない
- [ ] `GET /api/combos/:id` 同上
- [ ] `POST /api/combos` のリクエストに `tagIds` フィールドが追加されたが、`tagIds` 未指定時の挙動が従来と変わらない
- [ ] `PATCH /api/combos/:id` 同上
- [ ] M3-01 で実装済みのタグ CRUD API(`/api/tags` 系)が動作を変えていない
- [ ] M2-02 の重複検知 API、M2-03 のゴミ箱 API、M2-04 の memo 関連 API が動作を変えていない

### 7.3 既存フロント画面への影響

- [ ] M1-05 のコンボ一覧画面が動作を変えていない(タグ列のみ実データ表示に変更、他の列は不変)
- [ ] M1-06 のコンボ詳細画面が動作を変えていない(タグ表示のみ追加、他の表示は不変)
- [ ] M2-02 のコンボ編集画面が動作を変えていない(タグ選択 UI のみ追加・有効化、他の編集機能は不変)
- [ ] M3-01 のタグ管理画面が動作を変えていない
- [ ] M2-01 仮想コントローラ、M2-03 ゴミ箱画面が動作を変えていない

### 7.4 楽観的排他制御の動作

- [ ] M2-02 で確立した楽観的排他制御(combos.version の PATCH チェック)が引き続き動作している
- [ ] tag 更新を含む PATCH でも version チェックが正しく機能する

### 7.5 マイグレーションへの影響

- [ ] マイグレーション 000001〜000007 が変更されていない
- [ ] 新規マイグレーションが追加されていない(本マイルストーンは既存テーブル変更なし、かつ §3.4.5 で `combo_tags` の CASCADE 設定が **設定されていなかった** 場合のみ追加マイグレーションの可能性あり、それ以外は追加なし)

---

## 8. ドキュメント・進捗ログ

### 8.1 progress-log.md への記録(M3-02 §7.4)

- [ ] `docs/progress/progress-log.md` に M3-02 完了報告が追記されている
- [ ] 記録テンプレート(SUPP-001 §6.7)に従っている
- [ ] **M1-05 暫定処理2(タグ列ハイフン固定表示)の解消事実** が明記されている(完全解消、M3 で持ち越されない)
- [ ] 暫定処理3(始動技 ID 表示)について引き続き M3-05 で対応予定の旨が明記されている
- [ ] 製造担当が新たに発見した制限事項・既知問題が報告書に記録されているか(発見ゼロの場合はその旨を明記)

### 8.2 着手前確認の出力

- [ ] 製造担当が §3.4.1〜§3.4.5 の確認コマンド出力を実装完了報告に含めている

### 8.3 設計担当への連絡事項

- [ ] 製造担当が M3-01 完了時のように設計担当へ連絡したい改善点が報告書に明記されているか(連絡事項ゼロの場合はその旨を明記)

---

## 9. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** として M3-02 完了承認を妨げる:

- 設計書本体(DES-002 §4.2、DES-003 §3.4 / §3.6 / §3.7、DES-005 §5.4 / §5.6 / §5.7、DES-006)と実装が乖離している
- **JSON タグまたは API DTO 型が camelCase で統一されていない**(snake_case の混入があり、CLAUDE.md §4 違反)
- **楽観的排他制御 + tag 操作のトランザクション整合性が崩れている**(version チェック失敗時に combo_tags が部分的に更新される、等の事故)
- 一覧 API のタグ取得が N+1 になっている(コンボ件数 × 1 クエリ)
- E2E シナリオ A〜E のうち1つでも通らない
- M1-05 暫定処理2(タグ列ハイフン)が解消されていない、または部分的にしか解消されていない
- 既存挙動が壊れている(M1 / M2 / M3-01 で動作していた API・画面が動作しなくなった)
- ブラウザストレージが許容範囲外で使用されている
- バックエンド3層(リポジトリ / サービス / ハンドラ)のいずれかで TagIDs 関連実装が欠落
- サービス層の楽観的排他制御テスト(`UpdateMetadata version conflict + TagIDs`)が欠落
- TypeScript / Go の型エラー、またはビルド失敗
- **playbook §4.5 フローの素直さ原則違反**(事前 SELECT 検証、エラー駆動再試行フロー、不要な往復通信、副次効果前提の記述)
- **新規 API が追加されている**(M3-02 §2.4 で「既存パスのみ拡張、新規 API 追加なし」と明記)

---

## 10. 軽微な問題の判定基準

以下は **軽微な問題** として記録するが、M3-02 完了承認は妨げない(M4 以降への持ち越しを許容):

- godoc コメントの書き漏れ(主要公開関数以外)
- マジックストリングの定数化漏れ(`"mycombo_status"` 等、機能動作に影響しないもの)
- TagBadgeList の表示細部(maxVisible デフォルト値、文字色判定閾値、デフォルト色値)
- TagSelector の検索デバウンス時間調整
- リポジトリ層テストの単純クエリ部分のテスト追加
- フォーム UI の見た目調整
- エラーメッセージの日本語表現の改善余地
- TODO コメントの形式逸脱

これらは進捗ログに「軽微な持ち越し課題」として記録し、後続マイルストーンで対応判断する。

---

## 11. 質問・確認事項のフォーマット

レビュー中に判断不能・設計担当 Claude または開発者の確認が必要な事項が発生した場合、以下のフォーマットで記録する:

```
### Q-{連番}: {タイトル}

**観点**: §{節番号}
**対象ファイル**: {ファイルパス}:{行番号}
**現状**: (実装または指示書の記述)
**疑問点**: (なぜ判断不能か)
**自分の見立て**: (案 X か案 Y か等、レビュー担当の暫定判断)
**確認したい相手**: 設計担当 Claude / 開発者
```

レビュー報告書の「質問・確認事項」節にまとめて記載する。

---

## 12. レビュー完了の判定

以下を全て満たした時点でレビュー完了とする:

- [ ] §1〜§8 の各チェック項目を全て確認した
- [ ] §9 重大な問題が0件、または製造担当に修正依頼を出した
- [ ] §10 軽微な問題は記録済み
- [ ] §11 質問・確認事項は設計担当 Claude / 開発者に転送する形でまとめた
- [ ] §0.3 のレポートフォーマットに従ってレビュー結果を作成した

レビュー判定:

- **承認**: 重大な問題なし、軽微な問題は許容、製造担当の実装が指示書通り完了している
- **修正依頼**: 重大な問題あり、製造担当に修正を依頼する(修正後に再レビュー)
- **保留**: 質問・確認事項に対する設計担当 Claude / 開発者の回答待ち

レビュー完了後、開発者に結果を報告する。

---

*以上*
