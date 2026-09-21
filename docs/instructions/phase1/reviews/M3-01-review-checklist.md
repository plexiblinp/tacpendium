# M3-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| チェックリストID | M3-01-REVIEW |
| バージョン | 1.0.0 |
| 対象指示書 | `docs/instructions/M3-01-tag-feature-and-management.md` v1.0.0 |
| 対象マイルストーン | M3-01: タグ機能(バックエンド + 管理 UI、初期タグ seed 投入) |
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

1. `CLAUDE.md`(全体方針、§4 TypeScript 規約、§10 禁止事項、§10.X ブラウザストレージ運用ルール)
2. `docs/instructions/M3-01-tag-feature-and-management.md` v1.0.0(本チェックリストの対象指示書)
3. `docs/instructions/M3-overview.md` v1.0.1(M3 全体運用ルール、特に §6.6 レビューチェックリスト強化)
4. `docs/design/03-data-model.md` §3.6 / §3.7(tags / combo_tags テーブル定義)
5. `docs/design/05-screen-design.md` §5.12(タグ管理画面)
6. `docs/design/06-validation.md` §5(タグ編集時のバリデーション VAL-T01〜T03)
7. `docs/design/02-architecture.md` §4.3(エラーハンドリング共通フォーマット)
8. `docs/design/supp-001-detailed-design.md` §3.5 / §3.6 / §5.4 / §5.5
9. 製造担当の実装完了報告書(本リスト適用前に受領済み)

### 0.2 レビューの基本姿勢

- **設計書本体との行レベル照合を最優先**(playbook §5、retro R-01 対策)。実装が指示書と一致しているだけでは不十分で、指示書が引用した設計書本体の節と実装が一致しているかを確認する
- **機械的チェックリスト確認に加え、設計意図との整合を読み取る**(playbook §9.3、retro R-08)
- **「副次効果として〜される」「自動的に〜される」という前提が指示書・実装に紛れ込んでいないか確認**(playbook §4.1、M2-04 反省、v1.1.0 で追加)
- 重大な問題と軽微な問題を区別する(§9 / §10 参照)
- 不明な箇所は §11 のフォーマットで質問・確認事項として記録する

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

### 1.1 tags テーブル DDL(DES-003 §3.6 L446-458)

実装ファイル: `migrations/000001_init_schema.up.sql`(M1-02 で整備済み、本指示書では変更しない)

- [ ] tags テーブルのカラムが DES-003 §3.6 と一致している:
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `user_id INTEGER NOT NULL REFERENCES users(id)`
  - `name TEXT NOT NULL`
  - `category TEXT`(NULL 可)
  - `color TEXT`(NULL 可)
  - UNIQUE 制約 `(user_id, name)`

製造担当が §3.4.1 着手前確認を実施した結果報告を確認し、実態が DES-003 §3.6 と一致していることを検証する。一致していない場合は **重大な問題** として扱う。

### 1.2 combo_tags テーブル DDL(DES-003 §3.7 L460-467)

- [ ] combo_tags テーブルのカラムが DES-003 §3.7 と一致している:
  - `combo_id INTEGER NOT NULL REFERENCES combos(id)`
  - `tag_id INTEGER NOT NULL REFERENCES tags(id)`
  - PK `(combo_id, tag_id)`
- [ ] FK の `ON DELETE CASCADE` 設定の有無を製造担当が報告書に記録しているか確認(M3-01 §4.2.3 で実装方針が分岐するため)

### 1.3 マイグレーション 000007 の内容(M3-01 §4.1.2 / §4.1.3)

実装ファイル: `migrations/000007_seed_initial_tags_user1.up.sql` および `.down.sql`

- [ ] up.sql の冒頭コメントに「暫定措置である事実」「M6 でウィザード経由生成へ切り替える方針」「SUPP-001 §3.6 / M3-overview.md §3.1 への参照」が明記されている
- [ ] up.sql の INSERT 文が指示書 §4.1.2 と一致している:
  - 3行とも `user_id = 1`、`category = 'mycombo_status'`
  - name と color の組み合わせ:
    - `'使用中'` / `'#10B981'`
    - `'練習中'` / `'#3B82F6'`
    - `'頻度低下'` / `'#6B7280'`
- [ ] down.sql が `WHERE user_id = 1 AND category = 'mycombo_status' AND name IN ('使用中', '練習中', '頻度低下')` の条件で対称削除している
- [ ] down.sql が他のタグデータ(ユーザーが手で追加したもの)を削除しないことを確認

### 1.4 Tag モデル定義(M3-01 §4.2.2)

実装ファイル: `internal/model/tag.go`

- [ ] Go 構造体のフィールドが指示書 §4.2.2 と一致している:
  - `ID int64 \`json:"id" db:"id"\``
  - `UserID int64 \`json:"user_id" db:"user_id"\``
  - `Name string \`json:"name" db:"name"\``
  - `Category string \`json:"category,omitempty" db:"category"\``
  - `Color string \`json:"color,omitempty" db:"color"\``
  - `UsageCount *int \`json:"usage_count,omitempty" db:"-"\``
- [ ] `UsageCount` がポインタ型(`*int`)で `db:"-"` タグを持つ(JOIN で動的に算出するためテーブルカラムには対応しない)
- [ ] フロント側 `web/src/types/tag.ts` の TypeScript 型が指示書 §4.2.2 と一致している:
  - `id: number`、`user_id: number`、`name: string`
  - `category?: string`(undefined 可)、`color?: string`(undefined 可)、`usage_count?: number`
- [ ] `CreateTagInput` / `UpdateTagInput` 型がフロント・バックエンドで対応する形で定義されている

### 1.5 サービス層関数シグネチャ(M3-01 §4.2.4)

実装ファイル: `internal/service/tag/service.go`

- [ ] 公開関数のシグネチャが指示書 §4.2.4 と一致している:
  - `ListTags(ctx, userID, category, includeUsage) ([]model.Tag, error)`
  - `GetTag(ctx, userID, tagID) (*model.Tag, error)`
  - `CreateTag(ctx, userID, input) (*model.Tag, error)`
  - `UpdateTag(ctx, userID, tagID, input) (*model.Tag, error)`
  - `DeleteTag(ctx, userID, tagID, force) error`
- [ ] エラー定数が `internal/service/tag/errors.go` に定義され、`errors.Is` で判定可能(M1-03 のコンボサービスと同パターン)
- [ ] `context.Context` が全公開関数の第一引数になっている(CLAUDE.md §4 Go 規約)

### 1.6 リポジトリ層関数シグネチャ(M3-01 §4.2.5)

実装ファイル: `internal/repository/tag/repository.go`

- [ ] 公開関数が指示書 §4.2.5 と一致している
- [ ] `List` クエリで `includeUsage=true` の場合、LEFT JOIN + GROUP BY で `usage_count` が算出される(N+1 回避)
- [ ] `CountUsage` 関数が `combo_tags` の COUNT(*) を返す(VAL-T03 用)

### 1.7 ハンドラ層エンドポイント(M3-01 §4.2.1 / §4.2.6)

実装ファイル: `internal/api/tag/handler.go`

- [ ] 5エンドポイントが登録されている:
  - `GET /api/tags`
  - `GET /api/tags/:id`
  - `POST /api/tags`
  - `PATCH /api/tags/:id`
  - `DELETE /api/tags/:id`
- [ ] `cmd/combomgr/main.go` でルートグループに登録されている(M1-03 のコンボハンドラ登録と同パターン)
- [ ] クエリパラメータ `category` / `include_usage` / `force` が指示書 §4.2.1 のとおり処理される

### 1.8 タグ管理画面(DES-005 §5.12 L412-420、M3-01 §4.3)

実装ファイル: `web/src/features/tag/components/*` および `web/src/pages/TagManagementPageRoute.tsx`

- [ ] DES-005 §5.12 の表示項目が網羅されている:
  - タグ一覧(名前、カテゴリ、色、使用コンボ数)
  - 新規作成ボタン
- [ ] DES-005 §5.12 のアクションが実装されている: タグ作成、編集、削除
- [ ] 使用中のタグ削除時に警告ダイアログが表示される(VAL-T03 対応)
- [ ] レスポンシブ動作: PC/スマホとも一覧表示が動作する

### 1.9 ルートパス(M3-01 §4.3.1、DES-005 §3 画面遷移図)

- [ ] ルートパス `/tags/manage` が登録されている
- [ ] サイドバー/ヘッダーメニューに「タグ管理」リンクが追加されている
- [ ] DES-005 §3 画面遷移図と整合する位置(コンボ一覧 → タグ管理 への遷移リンクが存在)に配置されている

---

## 2. API 整合性(retro R-08)

### 2.1 リクエスト/レスポンス DTO の整合

- [ ] バックエンド DTO(`internal/model/tag.go`)とフロント DTO(`web/src/types/tag.ts`)が同じフィールド・同じ型で対応している
- [ ] フロント側 `tagApi.ts` の関数引数と戻り値の型が DTO と整合している
- [ ] `useTagManagement` フックの mutation 引数・戻り値の型が DTO と整合している

### 2.2 エラーレスポンス共通フォーマット(DES-002 §4.3)

- [ ] エラーレスポンスが `{error: {code, message, details?}}` の構造に従っている
- [ ] HTTP ステータスコードと code の対応が指示書 §4.2.3 と一致:
  - 400 + `TAG_NAME_EMPTY`(VAL-T02)
  - 404(タグ不存在)
  - 409 + `TAG_NAME_DUPLICATE`(VAL-T01、details に `existing_tag_id`)
  - 409 + `TAG_IN_USE`(VAL-T03、details に `usage_count`、`force_delete_query`)

### 2.3 各エンドポイントの動作確認

製造担当の curl 結果報告を確認:

- [ ] `GET /api/tags` が 200 で配列を返す(初期 3 タグ含む)
- [ ] `GET /api/tags?category=mycombo_status` が 200 でカテゴリ絞り込み結果を返す
- [ ] `GET /api/tags?include_usage=true` のレスポンスに `usage_count` フィールドが含まれる
- [ ] `GET /api/tags/:id` が存在 ID で 200、不存在 ID で 404
- [ ] `POST /api/tags` が正常入力で 201、空 name で 400、重複 name で 409
- [ ] `PATCH /api/tags/:id` が正常入力で 200、空 name で 400、重複 name で 409、不存在 ID で 404
- [ ] `DELETE /api/tags/:id` が未使用タグで 204、使用中タグ + force なしで 409、使用中タグ + `?force=true` で 204

---

## 3. フロントエンドの動作仕様

### 3.1 コンポーネント分割(M3-01 §4.3.3)

- [ ] `TagManagementPage.tsx` がページ本体として機能する
- [ ] `TagListTable.tsx` がタグ一覧テーブルを描画する
- [ ] `TagFormDialog.tsx` が新規作成・編集兼用のダイアログとして実装されている
- [ ] `TagDeleteConfirmDialog.tsx` が `usage_count` による表示分岐を含む

### 3.2 useTagManagement フック(M3-01 §4.3.4)

- [ ] TanStack Query の `useQuery` で一覧取得、`useMutation` で create / update / delete を実装
- [ ] mutation 成功時に `queryClient.invalidateQueries({ queryKey: ['tags'] })` で再取得をトリガーしている
- [ ] queryKey にクエリパラメータ(`include_usage` 等)を含めてキャッシュ分離している

### 3.3 フォームバリデーション(M3-01 §4.3.5)

- [ ] zod スキーマで以下を検証:
  - `name`: 必須、trim 後の長さ 1 以上(VAL-T02)
  - `color`: `#RRGGBB` 形式(指定時のみ)
- [ ] サーバー側 VAL-T01 エラー(409)を `react-hook-form` の `setError` で name フィールドにエラー表示

### 3.4 削除フロー(M3-01 §4.3.6)

- [ ] `usage_count === 0` の場合: シンプル確認ダイアログ「このタグを削除しますか?」
- [ ] `usage_count > 0` の場合: 警告ダイアログ「このタグは {N} 件のコンボで使用中です。削除すると、これらのコンボからタグが外れます。続行しますか?」
- [ ] 確定時に `deleteMutation.mutate({ id, force: usage_count > 0 })` が呼ばれる

### 3.5 メニュー導線(M3-01 §4.3.7)

- [ ] サイドバーまたはヘッダーメニューに「タグ管理」リンクが追加されている
- [ ] クリックで `/tags/manage` に遷移する
- [ ] 既存 Layout.tsx の構造と齟齬がないことを確認(製造担当が齟齬を発見した場合の Plan Mode 報告内容を確認)

---

## 4. テストの妥当性

### 4.1 バックエンドテスト

#### 4.1.1 サービス層テスト(M3-01 §5.1.1)

- [ ] `internal/service/tag/service_test.go` で以下が網羅されている:
  - CreateTag: name のみ / name + category / name + category + color の3パターン正常系
  - CreateTag VAL-T01 違反(同一ユーザー同名)
  - CreateTag VAL-T02 違反(空文字、空白のみ)
  - UpdateTag: name のみ / category のみ / color のみ / 複合 の正常系
  - UpdateTag VAL-T01 違反(別タグの name と衝突)
  - UpdateTag VAL-T02 違反(name を空文字に更新試行)
  - DeleteTag 未使用、使用中 force=false(ErrTagInUse)、使用中 force=true
  - ListTags カテゴリフィルタなし、あり、includeUsage=true
  - GetTag 存在、不存在(ErrNotFound)
- [ ] テストが全通過している(製造担当の `make test` または `go test ./...` 結果報告)

#### 4.1.2 リポジトリ層テスト(M3-01 §5.1.2)

- [ ] `internal/repository/tag/repository_test.go` で以下のみテストされている(SUPP-001 §5.4「複雑クエリのみ」):
  - List includeUsage=true の JOIN クエリが usage_count を正しく返す
  - CountUsage が combo_tags の正しい件数を返す
- [ ] その他の単純 CRUD はサービス層テストでカバーされていることを確認

#### 4.1.3 ハンドラ層テスト(M3-01 §5.1.3)

- [ ] `internal/api/tag/handler_test.go` が `httptest` を使い、各エンドポイントの正常系と主要異常系をテストしている
- [ ] エラーレスポンスのボディ構造が DES-002 §4.3 と一致している

### 4.2 フロントエンドテスト(M3-01 §5.1.4)

- [ ] `TagFormDialog.test.tsx` で zod バリデーション(name 空、color 形式違反)の発火を確認
- [ ] `TagDeleteConfirmDialog.test.tsx` で usage_count による表示分岐(警告メッセージ有無)を確認
- [ ] `TagListTable.test.tsx` で行数・列内容の描画を確認
- [ ] `pnpm test` が全通過している
- [ ] `pnpm build` が成功している
- [ ] TypeScript 型エラーが残っていない

### 4.3 E2E シナリオ動作確認手順書(M3-01 §5.2)

- [ ] 製造担当が「動作確認手順書」を実装完了報告に含めているか
- [ ] §5.2 の12ステップが手順書に網羅されているか
- [ ] 各ステップの期待結果が具体的に記述されているか

開発者がブラウザで手動実行して全ステップが通ることが M3-01 完了の前提条件。レビュー担当はこの動作確認自体は実行不可だが、手順書の品質をレビューする。

---

## 5. 設計意図との整合(機械的チェックを超えた観点)

### 5.1 暫定措置である事実の明示性

- [ ] マイグレーション 000007 の冒頭コメントが「M3 期間限定の暫定措置」「M6 でウィザード経由生成へ切り替える」「移行手順への言及」を明確に伝えているか
- [ ] M6 着手担当が将来このコメントを読んだとき、「なぜ seed が存在するか」「どう移行するか」を迷わず判断できる粒度になっているか

### 5.2 タグ機能の責務分離

- [ ] M3-01 が「タグ機能の整備」に集中し、「コンボへのタグ付与 UI」(M3-02 スコープ)に踏み込んでいないか
- [ ] `combo_tags` 中間テーブルへの登録・更新処理が M3-01 で実装されていないか(これは M3-02 で実装される)
- [ ] M3-01 の DELETE 処理で combo_tags の関連レコードを削除する処理は、CASCADE 削除または force 削除時の付随処理として位置づけられているか(タグ付与 UI 側の責務ではないか)

### 5.3 N+1 問題の回避

- [ ] `usage_count` の算出が LEFT JOIN + GROUP BY で1クエリ取得されているか(タグ件数 × COUNT クエリの N+1 になっていないか)
- [ ] 一覧 API のレスポンスタイムが現実的な値か(初期 3 タグでは問題ないが、将来 100 タグ程度に増えても N+1 にならない実装か)

### 5.4 バリデーションの一貫性

- [ ] バックエンドの VAL-T01 / VAL-T02 / VAL-T03 とフロントの zod バリデーションが一貫しているか
- [ ] フロント側で先に弾けるエラー(name 空)とサーバーでしか判定できないエラー(name 重複、使用中削除)が指示書 §4.3.5 / §4.2.3 で示された通りに分離されているか
- [ ] `react-hook-form` の `setError` でサーバーエラーをフォームフィールドにマッピングする経路が整っているか

### 5.5 「副次効果として〜される」表現の有無

- [ ] 指示書本文・実装コード・PR 説明・実装完了報告に「副次効果として〜される」「自動的に〜される」という表現が紛れ込んでいないか(playbook §4.1、M2-04 反省)
- [ ] 例えば「コンボ一覧のタグ列が副次効果として表示される」のような記述が指示書・実装に紛れていないか(タグ列の実データ反映は M3-02 で実装される、M3-01 では起きない)

---

## 6. コード品質・規約遵守

### 6.1 Go 規約(CLAUDE.md §4)

- [ ] エラーが `fmt.Errorf("...: %w", err)` で wrap されている
- [ ] サービス層メソッドの第一引数が `context.Context`
- [ ] 公開 API(大文字始まり)に godoc コメントが付いている
- [ ] パッケージ名が短く小文字、型名が PascalCase、関数が CamelCase
- [ ] パニックが回復不能な初期化以外で使われていない

### 6.2 TypeScript 規約(CLAUDE.md §4)

- [ ] `strict` モードで型エラーなし
- [ ] `any` が原則使われていない
- [ ] 関数コンポーネント + Hooks のみ(class コンポーネント不使用)
- [ ] コンポーネントが PascalCase、フックが `useXxx`、定数が SCREAMING_SNAKE_CASE
- [ ] import 順が React → サードパーティ → エイリアスパス → 相対パス

### 6.3 ブラウザストレージ未使用の確認(M3-01 では機会なし)

M3-01 ではブラウザストレージを使用する機能がない(タグデータは全てサーバー永続化)。

- [ ] `localStorage` / `sessionStorage` / `IndexedDB` の使用がないことを `grep -rn 'localStorage\|sessionStorage\|IndexedDB' web/src` で確認
- [ ] 万一使用が検出された場合、CLAUDE.md §10.X 許容範囲(コンボ一覧表示列カスタマイズ、仮想コントローラ選択保持、下書き自動保存)外と判定された場合は **重大な問題**

### 6.4 共通(CLAUDE.md §4)

- [ ] マジックナンバー・マジックストリングが定数化されている
- [ ] TODO コメントが `// TODO(<対応予定>): <内容>` 形式で書かれている
- [ ] 不要なコメントアウトコードが削除されている
- [ ] `console.log` / `fmt.Println` が本番コードに残っていない(テストコード・開発時デバッグは除く)

---

## 7. 既存挙動の温存(過去マイルストーンへの非破壊性)

### 7.1 既存テーブルへの影響

- [ ] tags / combo_tags テーブルの DDL(M1-02 で整備済み)を本マイルストーンで変更していない
- [ ] 他の既存テーブル(combos / users / presets 等)に予期しない変更が加わっていない

### 7.2 既存 API への影響

- [ ] M1-03 で実装済みのコンボ系 API(`/api/combos` 系)が動作を変えていない
- [ ] M1-02 で実装済みの characters / moves API が動作を変えていない
- [ ] M2 系で実装済みの API(重複検知、ゴミ箱復元等)が動作を変えていない

### 7.3 既存フロント画面への影響

- [ ] M1-05 のコンボ一覧画面が動作を変えていない(タグ列は引き続き「-」固定表示でよい、解消は M3-02)
- [ ] M1-06 のコンボ編集画面が動作を変えていない(タグ選択 UI は M3-02 で追加)
- [ ] M2 系で実装済みの画面(仮想コントローラ、ゴミ箱、修飾情報編集等)が動作を変えていない

### 7.4 既存マイグレーションへの影響

- [ ] マイグレーション 000001〜000006 が変更されていない(本指示書 §2.3 で「変更しないもの」と明記)
- [ ] 000007 の追加で既存マイグレーションの実行順序が壊れていない(`make run-server-debug` での起動成功確認)

---

## 8. ドキュメント・進捗ログ

### 8.1 progress-log.md への記録(M3-01 §7.4)

- [ ] `docs/progress/progress-log.md` に M3-01 完了報告が追記されている
- [ ] 記録テンプレート(SUPP-001 §6.7)に従っている:
  - 状態(完了)
  - 着手日 / 完了日
  - DoD 達成状況
  - 自己テスト結果
  - 暫定処理(該当する場合)
  - 持ち越し課題(該当する場合)
- [ ] M1-05 暫定処理2(タグ列ハイフン固定表示)について「M3-01 ではタグ API のみ整備、フロント側のタグ列実データ反映は M3-02 で対応」と明記されている

### 8.2 着手前確認の出力

- [ ] 製造担当が §3.4.1〜§3.4.3 の確認コマンド出力を実装完了報告に含めている

### 8.3 マイグレーション実行確認の出力

- [ ] M3-01 §4.1.4 のマイグレーション実行確認コマンド出力(SELECT 結果3件)が報告書に含まれている

---

## 9. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** として M3-01 完了承認を妨げる:

- 設計書本体(DES-003 §3.6 / §3.7、DES-005 §5.12、DES-006 §5)と実装が乖離している
- マイグレーション 000007 の up.sql / down.sql が指示書 §4.1.2 / §4.1.3 と乖離している
- VAL-T01 / VAL-T02 / VAL-T03 のいずれかが正しく動作しない(該当エラーケースで期待される HTTP ステータスとレスポンスが返らない)
- E2E シナリオの12ステップのうち1つでも通らない
- 既存挙動が壊れている(M1 / M2 で動作していた API・画面が動作しなくなった)
- ブラウザストレージが許容範囲外で使用されている
- バックエンド3層(リポジトリ / サービス / ハンドラ)のいずれかが欠落している
- サービス層テスト(必須)が一部または全て未実装
- TypeScript / Go の型エラーが残っている、またはビルドが失敗する
- マイグレーション 000007 実行時にエラーが発生する

---

## 10. 軽微な問題の判定基準

以下は **軽微な問題** として記録するが、M3-01 完了承認は妨げない(M4 以降への持ち越しを許容):

- godoc コメントの書き漏れ(主要公開関数以外)
- マジックストリングの定数化漏れ(機能動作に影響しないもの)
- リポジトリ層テストの単純クエリ部分のテスト追加(SUPP-001 §5.4 では「複雑クエリのみ」のため必須ではない)
- フォーム UI の見た目調整(spacing、color の微差)
- エラーメッセージの日本語表現の改善余地
- TODO コメントの形式逸脱(`// TODO:` のみで `// TODO(M4):` 等の対応予定が省略されている)

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
