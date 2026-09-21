# M3-02 レビュー報告書

## 総評

M3-02「タグ割り当て UI」の実装は全体的に設計準拠度が高く、3-state nil/empty/values 区別、トランザクション整合性、N+1 防止の 2-query IN-clause パターン、FK エラー駆動バリデーションなど、設計書・指示書の核心的要件を正確に実装できている。フロントエンドの TagSelector・TagBadgeList も機能要件を満たした自前実装となっており、品質は高い。

ただし、PUT エンドポイント（`UpdateWithKeyChange`）で `ErrInvalidTagID` のハンドリングが欠落しており、無効タグ ID を含むリクエストが 500 を返す Critical バグが 1 件存在する。このバグは対応するテストも未記載であり、M3 完了前に修正必須。その他、中優先度・低優先度の指摘事項が数件あるが、機能の正確性に影響するものではない。

## 設計準拠性レビュー結果

### §4.2 DTO 変更
**評価: ◎**
- `CreateRequest.TagIDs []int64 json:"tagIds,omitempty"` ✓
- `UpdateMetadataRequest.TagIDs *[]int64 json:"tagIds,omitempty"`（pointer 3-state）✓
- `ComboResponse.Tags []model.Tag json:"tags"`（omitempty なし → 常に `[]` を返す）✓
- `toComboResponse` で `resp.Tags = []model.Tag{}` 初期化（JSON null 防止）✓
- camelCase JSON タグ統一 ✓

### §4.3 リポジトリ層
**評価: ◎**
- `ReplaceTagAssociations(ctx, tx, comboID, tagIDs)`: DELETE all + bulk INSERT、呼び出し元 TX 内で実行 ✓
- `findTagsByComboIDs`: 2-query IN-clause バッチ取得、`map[int64][]model.Tag` 返却 ✓
- `FindByID` / `List` でタグ取得を統合 ✓
- N+1 防止確認 ✓

### §4.4 サービス層・トランザクション整合性
**評価: ◎**
- `Create`: TX 内で版数 + タグ操作を一体化 ✓
- `UpdateMetadata`: version チェック + タグ差し替えを同一 TX ✓
- `UpdateWithKeyChange`: タグ操作を TX 内で実行 ✓
- Optimistic concurrency（combos.version）との整合性 ✓

### §4.5 FK エラー駆動バリデーション
**評価: ○**（設計準拠は正しいが、ハンドラ側に欠落あり）
- `isInvalidTagIDErr`: "FOREIGN KEY constraint failed" 検出 ✓
- `ErrInvalidTagID` への変換 ✓
- Create / UpdateMetadata でのエラー変換 ✓
- **× `UpdateWithKeyChange` ハンドラが `ErrInvalidTagID` を処理せず 500 を返す**（後述）

### §4.6 API レスポンス整合性
**評価: ◎**
- tags フィールドは常に配列（null でない）✓
- GET /api/combos と GET /api/combos/:id 両方でタグ付き応答 ✓

### §5.1 TagBadgeList
**評価: ◎**
- props: `{tags, excludeCategories?, maxVisible?, size?}` ✓
- maxVisible オーバーフロー "+N" バッジ ✓
- excludeCategories フィルタリング ✓
- ルミナンスベースのテキスト色（白/ダーク）✓
- DEFAULT_COLOR `"#9CA3AF"` ✓

### §5.2 TagSelector
**評価: ◎**
- props: `{selectedTagIds, onChange, excludeCategories?, disabled?}` ✓
- ドロップダウン + 検索 ✓
- 外クリック閉（useEffect + mousedown）✓
- 新規タグ作成 ✓
- useTagsForSelector + useTagManagement 使用 ✓
- shadcn/ui 非依存 ✓

### §5.3 useTagsForSelector
**評価: ◎**
- queryKey `["tags", {include_usage: false}]`（キャッシュ分離）✓
- useMemo で excludeCategories フィルタ ✓

### §5.4 ComboEditorBasicFields 統合
**評価: ◎**
- TagSelector 配置 ✓
- `excludeCategories={["mycombo_status"]}` ✓
- `tagIds: number[]` を BasicFieldsValue に追加 ✓

### §5.5 ComboEditor.tsx
**評価: △**（PATCH の tagIds 常時送信、後述）
- `initialBasic.tagIds` 初期化 ✓
- `buildCreatePayload` に tagIds 含む ✓
- `buildPatchPayload` に tagIds を常時含める → タグ未変更時も差し替え処理が走る（中優先度指摘）

### §5.6 ComboTableRow.tsx
**評価: ◎**
- M1-05 暫定処理2を解消 ✓
- `excludeCategories={["mycombo_status"]}` ✓
- `maxVisible={3}` ✓

### §5.7 ComboDetailMetadata.tsx
**評価: ○**（i18n 未対応、後述）
- tags.length > 0 条件付き表示 ✓
- excludeCategories 指定なし（詳細画面は全タグ表示）✓
- **△ 「タグ」見出しが i18n 未対応**（低優先度指摘）

### §6 テスト
**評価: ○**（UpdateWithKeyChange の handler test が欠落）
- サービス層: 7 ケース（空タグ / with / invalid ロールバック / nil 変更なし / 空で全削除 / 差し替え / バージョン競合）✓
- ハンドラ層: Create/UpdateMetadata のタグケース一式 ✓
- **× `UpdateWithKeyChange` ハンドラの InvalidTagID テスト未記載**
- TagSelector: 7 テスト ✓
- TagBadgeList: 6 テスト ✓

## 設計準拠性以外の指摘事項

### コード品質

1. フロントエンドで `"mycombo_status"` を文字列リテラルで直接記述している箇所が複数存在する（`ComboEditorBasicFields.tsx`, `ComboTableRow.tsx`）。バックエンドには `model.TagCategoryMyComboStatus` 定数が定義されているが、フロントエンドに対応する定数が未定義。タイプミスのリスクがある。

2. `TagSelector.tsx` 内でタグ色のフォールバック値 `"#9CA3AF"` をインラインで記述している（line 150）。`TagBadgeList.tsx` の `DEFAULT_COLOR` と二重管理になっており、将来的な変更漏れのリスクがある。

## 推奨修正（優先度別）

- **高（M3完了前に修正必須）**:
  1. **`handler.go` `UpdateWithKeyChange` の ErrInvalidTagID 未処理**
     - `internal/api/combo/handler.go` の `UpdateWithKeyChange` ハンドラに、`Create`/`UpdateMetadata` と同様の以下の処理を追加すること:
       ```go
       case errors.Is(err, combosvc.ErrInvalidTagID):
           return echo.NewHTTPError(http.StatusBadRequest, map[string]string{"error": "INVALID_TAG_ID"})
       ```
     - 対応テスト `TestHandler_UpdateWithKeyChange_InvalidTagID_400` も `internal/api/combo/handler_test.go` に追加すること

- **中（M4着手と並行可）**:
  1. **`buildPatchPayload` が tagIds を常時送信する問題**
     - `web/src/features/combo/components/ComboEditor.tsx` の `buildPatchPayload` で `tagIds: basic.tagIds` を常に含めているため、タグ未変更時もサーバー側でタグ差し替え処理（DELETE + INSERT）が実行される
     - `initialBasic.tagIds` と `basic.tagIds` を比較し、変更がある場合のみ `tagIds` を含める対応が望ましい（`undefined` を送れば `*[]int64` は nil になり no-change 扱い）
     - 現状でも機能は正しいが、不要な DB 書き込みが毎 PATCH で発生する点は将来の監査ログ等に影響しうる

- **低（将来対応）**:
  1. **`ComboDetailMetadata.tsx` の「タグ」ハードコード**
     - `web/src/features/combo/components/ComboDetailMetadata.tsx` line 129: `<h3>タグ</h3>` が i18n 対象外。他のラベルは `t("comboDetail.xxx")` を使用しており不整合
     - i18n キー `comboDetail.tags` を追加し、`{t("comboDetail.tags")}` に置換すること

  2. **フロントエンドの `"mycombo_status"` 文字列定数化**
     - `web/src/features/tag/` 以下にカテゴリ定数ファイル（例: `constants.ts`）を追加し、直接文字列記述を排除することを推奨

  3. **`TagSelector.tsx` のカラーフォールバック値の共通化**
     - `TagBadgeList` の `DEFAULT_COLOR` を共通モジュールに移し、`TagSelector.tsx` でも参照する形に統一すること

## 良かった点

1. **3-state nil/empty/values の正確な実装**: `UpdateMetadataRequest.TagIDs *[]int64` のポインタ使用と、サービス層の `if input.TagIDs != nil` 分岐が設計意図通りに実装できており、nil=変更なし / `&[]`=全削除 / 値=差し替え が正しく機能している

2. **N+1 防止の 2-query IN-clause パターン**: `findTagsByComboIDs` でコンボ ID 一覧を 1 クエリで取得し、`map[int64][]model.Tag` で返す実装が設計書の指示通りに実装できており、一覧 API でのパフォーマンスを正しく確保している

3. **FK エラー駆動バリデーションの採用**: 事前 SELECT ではなく INSERT の FK 制約エラーを検出して `ErrInvalidTagID` に変換するアプローチを、`isInvalidTagIDErr` 関数として適切に実装している。余分なクエリを発生させない設計判断として評価できる

4. **TagBadgeList のルミナンス計算**: RGB 成分からルミナンスを計算し、背景色に応じてテキスト色を白/ダークに自動切替する実装がシンプルかつ実用的

5. **サービス層テストの網羅性**: 7 ケース（空タグ / 有効タグ / 無効タグ ID ロールバック / nil 変更なし / 空で全削除 / 差し替え / バージョン競合）が設計書の各シナリオを正確にカバーしており、境界値の意識が高い

6. **フロントエンドテストの独立性**: `TagSelector.test.tsx` と `TagBadgeList.test.tsx` が独立したユニットテストとして適切に分離されており、モックの粒度も明快

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
