# M3-01 レビュー報告書

## 総評

M3-01「タグ機能とタグ管理 UI」の実装は全体的に高品質。バックエンド 3 層（リポジトリ・サービス・ハンドラ）が明確に分離され、VAL-T01/T02/T03 のバリデーション体系、テストカバレッジ（Go 全層 + フロント主要コンポーネント）、エラーハンドリングのいずれも水準を満たしている。設計書本体との照合では 1 点の JSON 命名逸脱（`user_id` → `userId`）と型変更（`string` → `*string`）が確認されたが、いずれも progress-log.md に理由付きで記録済みであり、既存 API との一貫性という観点から合理的な判断と評価する。**重大な問題は 0 件、M3-01 完了承認が妥当と判定する。**

---

## 設計準拠性レビュー結果

### §1 設計書本体との照合

| 項目 | 評価 | 詳細 |
|------|------|------|
| 1.1 tags DDL（DES-003 §3.6） | ◎ | migration 000001 の DDL が設計書と一致。`UNIQUE(user_id, name)` ✓。`ON DELETE CASCADE` が user_id FK に追加されているが設計意図の範囲内 |
| 1.2 combo_tags DDL（DES-003 §3.7） | ○ | `combo_id`, `tag_id`, `PRIMARY KEY(combo_id, tag_id)` ✓。両 FK に `ON DELETE CASCADE` が追加されている（設計書には明記なし）。タグ削除時の cascade 削除がリポジトリコメントに明記されており意図的であることは確認 |
| 1.3 migration 000007（up/down） | ◎ | up.sql: 暫定措置コメント・M6 切り替え方針を明確に記載 ✓。3タグ・色コード一致 ✓。down.sql: `user_id=1 AND category='mycombo_status' AND name IN (...)` で手作成タグ保護 ✓ |
| 1.4 Tag モデル（Go 構造体） | △ | `UsageCount *int db:"-"` ✓。**JSON 命名: 指示書は `user_id`（snake_case）だが実装は `userId`（camelCase）に変更**。`Category`/`Color` は指示書 `string` に対し `*string` を採用。いずれも progress-log.md に記録済み |
| 1.5 サービス層シグネチャ | ◎ | `ListTags/GetTag/CreateTag/UpdateTag/DeleteTag` 全メソッドが指示書 §4.2.4 と一致。`context.Context` 第一引数 ✓ |
| 1.6 リポジトリ層 | ◎ | `List` で `includeUsage=true` 時に LEFT JOIN + GROUP BY の 1 クエリ ✓（N+1 回避）。`CountUsage` 関数 ✓ |
| 1.7 ハンドラ層（5 エンドポイント） | ◎ | GET/GET(:id)/POST/PATCH/DELETE 全 5 エンドポイント実装 ✓。`category`・`include_usage`・`force` クエリパラメータ対応 ✓ |
| 1.8 画面（DES-005 §5.12） | ◎ | TagManagementPage・TagListTable・TagFormDialog・TagDeleteConfirmDialog の 4 コンポーネント分割 ✓。一覧・新規作成・編集・削除フロー ✓。使用コンボ数表示 ✓ |
| 1.9 ルートパス・メニューリンク | ◎ | `/tags/manage` が router.tsx に登録 ✓。ComboListPage・ComboDetailPage・TrashPage に導線リンク追加 ✓ |

### §2 API 整合性

| 項目 | 評価 | 詳細 |
|------|------|------|
| 2.1 DTO 整合性 | ○ | バックエンド JSON と TypeScript 型は相互に一致（どちらも `userId` camelCase）。`category`・`color` の省略可否も整合 ✓。`usageCount` フィールドも整合 ✓ |
| 2.2 エラーレスポンス形式 | ◎ | `{ "error": { "code": "...", "message": "...", "details": {...} } }` が DES-002 §4.3 に準拠 ✓。`details.usage_count`・`details.force_delete_query` の追加情報も適切 |
| 2.3 curl 動作確認 | ◎ | progress-log.md に各エンドポイント（正常系・VAL-T01/T02/T03）の curl 結果を記録 ✓ |

### §3 フロントエンド動作仕様

| 項目 | 評価 | 詳細 |
|------|------|------|
| 3.1 コンポーネント分割 | ◎ | 指示書 §4.3.1 の 4 コンポーネント構成と一致 ✓ |
| 3.2 useTagManagement フック | ○ | TanStack Query の `useQuery`・`useMutation`・`invalidateQueries` 使用 ✓。queryKey の粒度（useQuery は `["tags", { include_usage: true }]`、無効化は `["tags"]`）はやや不一致だが、TanStack Query の前方一致無効化で実用上問題なし |
| 3.3 zod バリデーション | ◎ | name: 必須・trim・min(1) ✓。color: 空文字または `#RRGGBB` 形式 ✓。`TAG_NAME_DUPLICATE` のサーバーエラーを `setError` で UI に反映 ✓ |
| 3.4 削除フロー（VAL-T03） | ○ | `TagDeleteConfirmDialog` で `usageCount` による表示分岐 ✓。警告メッセージ ✓。`force: usageCount > 0` での API 呼び出し ✓。**ただし `handleDeleteConfirm` に TAG_IN_USE エラー時の再試行ハンドラが残存しており、`usageCount > 0` で `force=true` が既に設定されるため実質到達しない dead code** |
| 3.5 メニュー導線 | ○ | 複数ページに `/tags/manage` リンク追加 ✓。`TagManagementPageRoute` は独立ヘッダを定義しており、他ページの共通 Header との差異があるが、M3-01 スコープ内の指示には違反なし（DES-005 §5.12 は画面要件のみ記述） |

### §4 テストの妥当性

| 項目 | 評価 | 詳細 |
|------|------|------|
| 4.1 サービス層テスト | ◎ | CreateTag（正常 3 パターン・VAL-T01・VAL-T02）・UpdateTag（正常系・VAL-T01 自己除外確認・VAL-T02）・DeleteTag（未使用・force=false 使用中・force=true 使用中）・ListTags（全件・カテゴリフィルタ・includeUsage）・GetTag（存在・不存在）を網羅 ✓ |
| 4.2 リポジトリ層テスト | ◎ | `TestListWithUsage`（LEFT JOIN + GROUP BY の usage_count 算出）・`TestCountUsage`（0 → 1 遷移）の複雑クエリをカバー ✓ |
| 4.3 ハンドラ層テスト | ◎ | 15 テストケースで全 5 エンドポイントの正常系・主要異常系を網羅 ✓。エラーコード文字列まで検証 ✓ |
| 4.4 フロントテスト | ◎ | `TagDeleteConfirmDialog.test.tsx`（usage_count 分岐）・`TagListTable.test.tsx`（テーブル描画・空配列）・`TagFormDialog.test.tsx`（zod バリデーション・新規/編集モード）実装 ✓。`pnpm test` 123 件全通過 ✓。TypeScript 型エラーなし・ビルド成功 ✓ |

### §5 設計意図との整合

| 項目 | 評価 | 詳細 |
|------|------|------|
| 5.1 migration 000007 暫定措置コメント | ◎ | 「本来は M6 初回起動ウィザードで生成」「M6 着手時にウィザード経由生成へ切り替える」を up.sql 冒頭に明記 ✓ |
| 5.2 責務分離（M3-01 は API 整備のみ） | ◎ | combo_tags への登録（タグ付与 UI）は M3-02 スコープとして明確に分離 ✓ |
| 5.3 N+1 問題回避 | ◎ | `includeUsage=true` 時の LEFT JOIN + GROUP BY で 1 クエリ完結 ✓ |
| 5.4 バリデーション一貫性 | ◎ | フロント zod ↔ バックエンド VAL-T01/T02/T03 が対称 ✓ |
| 5.5 M3-01 スコープ外明示 | ◎ | タグ列は引き続き「-」固定（M1-05 暫定処理の継続）。スコープ外のため手つかずが正しい ✓ |

### §6 コード品質・規約遵守

| 項目 | 評価 | 詳細 |
|------|------|------|
| 6.1 Go 規約 | ◎ | `fmt.Errorf("...: %w", err)` ✓。`context.Context` 第一引数 ✓。公開 API に godoc コメント ✓。命名規則（PascalCase 型・CamelCase 関数・短小文字パッケージ名）✓ |
| 6.2 TypeScript 規約 | ◎ | `any` 未使用 ✓。関数コンポーネント + Hooks ✓。PascalCase コンポーネント・`useXxx` フック ✓。import 順（React → サードパーティ → `@/`）✓ |
| 6.3 ブラウザストレージ未使用 | ◎ | tag 機能配下の全ファイルで `localStorage`/`sessionStorage`/`IndexedDB` の使用なし ✓ |
| 6.4 マジックナンバー・console.log | ◎ | `TagCategoryMyComboStatus` 定数化 ✓。`defaultUserID = 1` 定数化 ✓。`console.log`/`fmt.Println` の残存なし ✓ |

### §7 既存挙動温存（非破壊性）

| 項目 | 評価 | 詳細 |
|------|------|------|
| 7.1 tags/combo_tags DDL 変更なし | ◎ | migration 000001〜000006 は無変更。000007 は seed データのみ追加 ✓ |
| 7.2 既存 API の動作変更なし | ◎ | tag ハンドラは独立した `/api/tags` 系ルートのみ追加。既存コンボ・キャラ・ムーブ API に変更なし ✓ |
| 7.3 既存画面の動作変更なし | ○ | コンボ一覧・編集・M2 系画面はタグ列「-」固定のまま継続 ✓。各画面への `/tags/manage` リンク追加は非破壊 ✓ |
| 7.4 マイグレーション実行順序 | ◎ | 000001〜000006 無変更、000007 追加で実行順序破損なし ✓ |

### §8 ドキュメント・進捗ログ

| 項目 | 評価 | 詳細 |
|------|------|------|
| 8.1 progress-log.md M3-01 完了報告 | ◎ | 完了ステータス表・API 動作確認・実装上の決定事項（JSON 命名・型選択・エラーフォーマット）が記録 ✓ |
| 8.2 着手前確認の出力 | ○ | DDL 確認・マイグレーション番号・user_id=1 の確認が progress-log.md に記録（形式は SUPP-001 テンプレートに準拠）✓ |
| 8.3 migration 実行確認 | ◎ | 初期タグ 3 件の API 確認結果を記録 ✓ |

---

## 設計準拠性以外の指摘事項

### TS-01: `handleDeleteConfirm` の dead code（軽微）

`web/src/features/tag/components/TagManagementPage.tsx` の `handleDeleteConfirm` 内に、TAG_IN_USE エラー時に `force=true` で再試行するエラーハンドラが存在する。しかし `deleteMutation.mutate({ id, force: usageCount > 0 })` の時点ですでに `force=true` が渡るため、このエラーハンドラは実際には到達しない。動作への影響はないが、コードの意図が分かりにくい。

### TS-02: queryKey の粒度（軽微）

`useTagManagement.ts` の `useQuery` が `["tags", { include_usage: true }]` を使い、mutations の `invalidateQueries` が `["tags"]` を使用。TanStack Query の前方一致仕様により実用上は動作するが、正確なキーを渡す方がキャッシュ管理の意図が明確になる。

### TS-03: `TagManagementPageRoute` の独立ヘッダ（要確認）

`TagManagementPageRoute.tsx` が独自のヘッダ要素（ロゴ・ゴミ箱リンク・タグ管理リンク）を内部に定義している。`web/src/layouts/` ディレクトリが存在しないことから他ページも同様の構造と推測されるが、設計書（DES-005）にレイアウト構造の明示がないため確認不能。M3-01 スコープ内での指示には違反していない。

---

## 推奨修正（優先度別）

- **高（M3 完了前に修正必須）**: なし

- **中（M3 後続タスク着手と並行可）**:
  - [TS-01] `handleDeleteConfirm` の TAG_IN_USE 再試行ハンドラの意図をコメントで補足するか、dead code であれば削除

- **低（将来対応）**:
  - [TS-02] `invalidateQueries` に `["tags", { include_usage: true }]` を渡すことでキャッシュ無効化の明確化を検討
  - [TS-03] 将来の画面追加時に共通 AppLayout の導入を検討（M5〜M6 の画面設計時に判断）
  - down.sql の名前フィルタ（`name IN (...)` 条件）は設計書記述（`user_id=1 AND category='mycombo_status'` のみ）より限定的。安全側での実装だが、設計書との乖離を progress-log.md に追記することを推奨

---

## 良かった点

1. **サービス層テストの充実度**: VAL-T01 の「同 ID は重複対象外」確認、VAL-T03 の `force=false`/`force=true` 両パターン、`TagInUseError.UsageCount` フィールド値検証まで含めた高品質なテスト設計
2. **`TagInUseError` 構造体の設計**: `errors.Is()` 対応の `Is()` メソッド実装で、エラー型の型安全な取り回しが可能になっている
3. **マイグレーション 000007 の暫定措置コメント**: `M6 着手時にウィザード経由生成へ切り替える` という将来の作業者への明確なメッセージが up.sql 冒頭に記述されており、技術的負債の可視化として優れている
4. **`errors.go` 分離**: サービス層のエラー定義を別ファイルに分離したことで可読性・保守性が向上
5. **アクセシビリティ対応**: フォームダイアログに `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-invalid`, `aria-describedby` を付与し、スクリーンリーダー対応が実装されている
6. **リポジトリの動的 SET 句**: `UpdateTag` の動的 SET 句構築により、部分更新が DB レベルで正確に実現されている

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- combo_tags の `ON DELETE CASCADE` による実際の cascade 動作（タグ削除時にコンボとの関連が正しく切れるか）の E2E レベル確認は本レビュー範囲外。
