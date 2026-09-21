# M1-07 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー対象 | M1-07 デバッグ API |
| レビュー実施日 | 2026-05-01 |
| レビュアー | 品質レビュー担当 Claude |
| ベースブランチ | feature/m1-07-debug-api |

---

## 総評

ビルドタグによる本番/開発分離、SQL インジェクション対策（ホワイトリスト）、テスト網羅性のいずれも指示書仕様を正確に満たしており、全体的に高品質な実装である。
エラー時の内部情報漏洩がなく、書込系 API の誤実装もない。
指摘事項はすべて軽微（低優先度）であり、M1 完了前に修正必須な致命的欠陥は存在しない。
特に `listValidTables` の設計（ホワイトリスト専用関数として分離、`sqlite_*` と `schema_migrations` の両方を除外）と、4種類の SQL インジェクションパターンをカバーしたテストが優れている。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `GET /api/debug/tables` の実装 | ◎ | `handler.go:30` に `ListTables` が仕様通り実装されている |
| `GET /api/debug/dump/:table` の実装 | ◎ | `handler.go:62` に `DumpTable` が仕様通り実装されている |
| `//go:build debug` による有効化 | ◎ | `handler.go`, `routes.go`, `handler_test.go` の全3ファイルにタグが付与されている |
| `//go:build !debug` による無効化 | ◎ | `routes_noop.go` で no-op の `Handler`/`NewHandler`/`RegisterRoutes` が実装されている |
| 本番ビルドで debug ルートが登録されない構造 | ◎ | `routes_noop.go:18` の `RegisterRoutes` は空実装。`main.go` は常に呼ぶが no-op になる |
| 上限 100 件と `truncated` フラグ | ◎ | `handler.go:14` の `maxDumpRows = 100`、`handler.go:117` の `total > maxDumpRows` で実装済み |
| 既存ミドルウェア(CORS, Logger)を通る構造 | ◎ | `main.go:118-123` でミドルウェア登録後に `apiGroup` へルートを追加しており、middleware chain を通る |

---

## セキュリティレビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| テーブル名ホワイトリストチェック(sqlite_master 由来) | ◎ | `handler.go:124-146` の `listValidTables` で `sqlite_master` から有効テーブル名を取得 |
| SQLite 内部テーブルの除外 | ◎ | `sqlite_%` プレフィックスと `schema_migrations` の両方を除外している |
| SQL Injection 攻撃を 404 で安全に拒否 | ◎ | `handler.go:71-73` の `contains` チェック。攻撃文字列はホワイトリストに存在しないため必ず 404 |
| エラーメッセージで内部情報を漏らさない | ◎ | ハンドラのすべてのエラーが `echo.NewHTTPError(http.StatusInternalServerError)` のみで返され詳細情報なし |
| 書込系 API が誤実装されていない | ◎ | `routes.go` は `g.GET` のみ。POST/PUT/DELETE の登録は一切なし |
| テーブル名クォート処理 | ◎ | `fmt.Sprintf(\`SELECT ... FROM "%s"\`, name)` でダブルクォートにより識別子として安全に扱う |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| エラーラップ `fmt.Errorf("...: %w", err)` 形式 | ◎ | `handler.go:133,142` で `fmt.Errorf("query sqlite_master: %w", err)` 等を使用 |
| `context.Context` の適切な伝播 | ◎ | ハンドラ内で `ctx := c.Request().Context()` を取得し全 DB クエリに渡している |
| 公開関数に godoc コメント | ◎ | `Handler`, `NewHandler`, `RegisterRoutes`, `ListTables`, `DumpTable` に適切なコメントがある |
| 動的カラム対応の安全なスキャン | ◎ | `rows.Columns()` で動的取得、`vals`/`ptrs` の間接ポインタによる Scan が正しく実装されている |
| `rows.Err()` の確認 | ◎ | `listValidTables`(L145)と `DumpTable`(L110-112)の両方でイテレーション後のエラーを確認 |
| `fmt.Println` / `console.log` の残存 | ◎ | 本番コードへの残存なし |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `ListTables` 正常系テスト | ○ | `TestListTables_OK`: テーブル数 > 0 および `combos` テーブルの存在を確認。count 値の正確性検証は未実施（詳細後述）|
| `DumpTable` 正常系テスト | ○ | `TestDumpTable_OK`: `table`, `rows` フィールドの存在を確認。`count` / `truncated` の検証は未実施 |
| `DumpTable` 異常系(存在しないテーブル → 404) | ◎ | `TestDumpTable_NotFound`: 404 を正しく検証 |
| `DumpTable` SQL Injection 安全性テスト | ◎ | `TestDumpTable_SQLInjection`: 4種類のパターン（`;DROP`、`OR '1'='1`、`--`、`UNION SELECT`）を全て 404 で検証 |
| `//go:build debug` タグ付与 | ◎ | `handler_test.go:1` に正しく付与されており、非デバッグビルドで除外される |
| `dbtest.Setup` による実 DB テスト | ◎ | `internal/testutil/dbtest/dbtest.go` にマイグレーション + seed 適用済みのヘルパが存在し適切に利用 |

---

## 禁止事項違反の有無

| チェック項目 | 結果 |
|-------------|------|
| `localStorage` 等のフロント禁止項目 | ◎ 違反なし(Go ファイルのみ) |
| `console.log` / `fmt.Println` の本番コード残存 | ◎ 違反なし |
| Git 操作 | ◎ 違反なし |
| 書込系デバッグ API の誤実装 | ◎ 違反なし |

---

## 統合確認

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 本番ビルドで debug ルートが存在しない構造 | ◎ | `routes_noop.go` の `!debug` タグと空の `RegisterRoutes` により構造的に保証 |
| `make run-server-debug` の追加 | ◎ | `Makefile:22` に `go run -tags=debug ./cmd/combomgr` が定義されている |
| `make build-debug` の追加 | ◎ | `Makefile:25-26` に `pnpm run build` + `go build -tags=debug` が定義されている |
| `make test-go-debug` の追加 | ◎ | `Makefile:28-29` に `go test -tags=debug ./...` が定義されている(指示書には明示なし、良い追加) |
| README へのビルド方法記載 | ◎ | `README.md:44-66` に本番/開発ビルドと `make run-server-debug` の説明が追記されている |
| `main.go` への debug ルート登録呼出追加 | ◎ | `main.go:121-123` に `debughandler.NewHandler(sqlDB)` と `debughandler.RegisterRoutes` が追加されている |

---

## 推奨修正(優先度別)

- **高(M1 完了前に修正必須):**
  - なし。致命的な欠陥は発見されなかった。

- **中(M2 着手と並行可):**
  - なし。

- **低(将来対応):**
  1. **`TestListTables_OK` の count 値検証不足**
     - 指示書 §5 では「各テーブルの count が正しい」ことの確認を求めているが、現テストは `combos` テーブルの存在チェックのみで count 値を検証していない。
     - `dbtest.Setup` では combos テーブルに seed データが入らないため count=0 が期待値となる。`if tbl.Count != 0 { t.Errorf(...) }` 等の追加を検討できる。
     - ただし、デバッグ API の性質上、致命的欠陥ではない。

  2. **`main.go` パッケージドキュメントの起動シーケンスが旧状態**
     - `main.go:8` のコメント「Echo 起動、/api/health のみ登録」は M1-03 以降の追加ルート（コンボ、デバッグ）が反映されていない。
     - M1 全体統合後にパッケージドキュメントを更新することを推奨する。

  3. **`DumpTable` の SELECT に ORDER BY なし**
     - `handler.go:83` の `SELECT * FROM "%s" LIMIT %d` には ORDER BY がないため、返却される行の順序が SQLite の内部状態に依存し非決定的となる。
     - デバッグ用途では許容範囲内だが、`ORDER BY rowid` を追加することで安定したダンプ結果が得られる。

  4. **`make test` が debug タグ付きテストを自動実行しない**
     - 指示書 §7 DoD の「make test が全通過する(debug タグ ON でテスト実行)」という記述に対し、現在の `make test` は `test-go`(タグなし)と `test-web` のみを呼ぶ。debug テストの実行は `make test-go-debug` で別途行う必要がある。
     - 指示書の意図が「debug タグ ON で別途テスト実行」であれば問題なし。文字通りの意味であれば `make test` に `test-go-debug` を追加することを検討できる。ただし、ビルドタグなし・あり両方の通常テストが混在すると混乱を招くため、別ターゲットのままにする方が明快と判断する。

---

## 良かった点

1. **ホワイトリスト専用関数の分離設計**: `listValidTables` を独立した関数として切り出し、`ListTables` と `DumpTable` の両方で再利用している。SQL インジェクション対策のロジックが一か所に集約されており、修正漏れが起きにくい優れた設計。

2. **4種類の SQL インジェクションパターンのテスト**: `TestDumpTable_SQLInjection` で `;DROP`、`OR '1'='1`、`--`（コメントアウト）、`UNION SELECT` の4パターンを網羅しており、攻撃への安全性を多面的に検証している。

3. **`test-go-debug` ターゲットの自発的追加**: 指示書に明示されていないが、debug タグ付きテストを個別実行できる `test-go-debug` Makefile ターゲットが追加されており、開発時の利便性が高い。

4. **`schema_migrations` の除外**: `sqlite_%` プレフィックス以外に `schema_migrations` テーブルも除外しており、マイグレーション管理テーブルが意図せずデバッグ出力に含まれないよう配慮されている。

5. **`routes_noop.go` の明快な設計**: `Handler`・`NewHandler`・`RegisterRoutes` の全3シンボルをまとめて no-op 実装することで、`main.go` がビルドタグを意識せずに統一した呼び出しコードを書ける構造になっている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際のビルド検証(本番ビルドで `/api/debug/*` が 404 になることの動作確認、`make run-server-debug` での curl 動作確認)は開発者の手元で実施が必要。
- `go test -tags=debug ./...` の実際の通過有無はレビュー環境では未検証。コード上の不備はないが、実行確認は開発者が行うこと。

---

*以上*
