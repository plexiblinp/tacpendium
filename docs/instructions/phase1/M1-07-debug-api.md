# 指示書 M1-07: デバッグ API(`/api/debug/*`)

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-07 |
| バージョン | 1.1.0 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意** |
| 機械レビュー | **任意**(別チェックリスト: `docs/instructions/reviews/M1-07-review-checklist.md`) |
| 並列性 | M1-01 完了後ならいつでも、独立性高い |
| 依存指示書 | M1-01(Echo サーバー設定が必要)、M1-02(DB接続が必要) |
| 想定所要時間 | 30〜45分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-30 | パッケージマネージャを pnpm 9.13 に統一: §4.3 Makefile の `npm run build` を `pnpm run build` に変更 |

---

## 1. 背景と目的

### 背景

開発中の DB 状態確認を容易にするため、開発専用のデバッグ API を実装する。SUPP-001 §4.4 で確定済みの方針に従い、ビルドタグ `debug` で本番ビルドから除外する。

### 目的

- `GET /api/debug/tables`: 全テーブルのレコード数を返す
- `GET /api/debug/dump/:table`: 指定テーブルの全レコードを JSON で返す(上限100件、超過時は truncated フラグ)
- ビルドタグ `debug` で制御: `go build -tags=debug` のときのみ有効化
- リリースビルド(タグなし)ではエンドポイント自体が存在しない

### このマイルストーンで作らないもの

- 認証・権限制御(本機能は localhost 限定運用前提のため不要)
- 書込系のデバッグ API(read-only に限定)
- フロントエンドからの利用 UI(curl やブラウザでの直接アクセスを想定)

---

## 2. 成果物

### 2.1 作成するファイル

```
combomgr/
├── internal/
│   └── api/
│       └── debug/
│           ├── handler.go             # ハンドラ実装(ビルドタグ debug)
│           ├── handler_test.go        # テスト(ビルドタグ debug)
│           ├── routes.go              # ルート登録ヘルパ(ビルドタグ debug)
│           └── routes_noop.go         # ビルドタグ !debug 時の no-op 実装
└── cmd/combomgr/
    └── main.go                        # 修正: debug ルート登録呼出を追加(常に呼ぶが、no-op で何もしない)
```

### 2.2 修正するファイル

- `cmd/combomgr/main.go`: `debug.RegisterRoutes(api)` 等の呼出を追加

### 2.3 変更しないもの

- M1-01〜M1-06 の他のファイル

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`
- `docs/instructions/M1-overview.md`
- `docs/design/supp-001-detailed-design.md`
  - **§4.4** デバッグ用API(本指示書の中核)

### 任意参照

- `docs/design/02-architecture.md`(全体像)

### 参照不要

- DES-003〜DES-006(実装に直接関係なし、ただし全テーブル名一覧は DB から動的取得するため設計書を読む必要なし)

---

## 4. 詳細仕様

### 4.1 ビルドタグの利用

#### 4.1.1 `routes.go`(ビルドタグ debug)

```go
//go:build debug

package debug

import (
    "github.com/labstack/echo/v4"
)

func RegisterRoutes(g *echo.Group, h *Handler) {
    g.GET("/debug/tables", h.ListTables)
    g.GET("/debug/dump/:table", h.DumpTable)
}
```

#### 4.1.2 `routes_noop.go`(ビルドタグ !debug)

```go
//go:build !debug

package debug

import (
    "github.com/labstack/echo/v4"
)

// Handler は no-op
type Handler struct{}

func NewHandler(_ *sql.DB) *Handler {
    return &Handler{}
}

// RegisterRoutes は何もしない(本番ビルド)
func RegisterRoutes(_ *echo.Group, _ *Handler) {
    // no-op
}
```

#### 4.1.3 `cmd/combomgr/main.go` での呼出

```go
// main 関数内
api := e.Group("/api")
combo.RegisterRoutes(api, comboHandler)
preset.RegisterRoutes(api, presetHandler)

debugHandler := debug.NewHandler(db)
debug.RegisterRoutes(api, debugHandler) // ビルドタグ次第で no-op になる
```

これにより、本番ビルド(`go build`)では debug ルートが**存在しない**(リクエストが来ても 404 になる)。

### 4.2 ハンドラ実装(`handler.go`、ビルドタグ debug)

```go
//go:build debug

package debug

import (
    "context"
    "database/sql"
    "github.com/labstack/echo/v4"
)

type Handler struct {
    db *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
    return &Handler{db: db}
}

// GET /api/debug/tables
// レスポンス: {"tables": [{"name": "combos", "count": 5}, ...]}
func (h *Handler) ListTables(c echo.Context) error {
    // 1. SQLite の sqlite_master から全テーブル名を取得
    //    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_migrations'
    // 2. 各テーブルに対して COUNT(*) を実行
    // 3. JSON で返す
}

// GET /api/debug/dump/:table
// クエリパラメータ: ?limit=100 (default 100, max 100)
// レスポンス: {"table": "combos", "count": 5, "truncated": false, "rows": [...]}
func (h *Handler) DumpTable(c echo.Context) error {
    table := c.Param("table")

    // 1. テーブル名のホワイトリストチェック
    //    sqlite_master から取得した有効なテーブル名のみ受け付ける(SQL Injection 対策)
    // 2. SELECT * FROM <table> LIMIT 100 を実行
    // 3. 行を map[string]interface{} に変換して JSON 返却
    // 4. もし COUNT(*) > 100 なら truncated=true をセット
}
```

#### 4.2.1 セキュリティ上の注意

- **SQL Injection 対策**: `:table` パラメータは `sqlite_master` から取得した有効テーブル名のホワイトリストでチェック。プレースホルダで渡せない部分(テーブル名)はホワイトリスト対応が唯一の安全策
- **無効なテーブル名 → 404 を返す**(エラーメッセージで内部情報を漏らさない)
- **既存のミドルウェア(CORS、Logger)は引き続き有効**(M1-01 で設定済みのものをそのまま通る)
- **localhost 限定運用前提**(SUPP-001 §4.4)、LAN モード時は debug API は使わない想定。ただし機械的な制限は本指示書では実装しない(本番ビルドでビルドタグを外せば有効にならないため、リリース時は安全)

### 4.3 ビルドコマンドのドキュメント追加

`README.md` に以下を追記(または更新)。

```markdown
## ビルド方法

### 本番ビルド(debug API なし)
go build -o combomgr ./cmd/combomgr

### 開発ビルド(debug API 有効)
go build -tags=debug -o combomgr ./cmd/combomgr

### 開発実行(debug API 有効)
go run -tags=debug ./cmd/combomgr
```

`Makefile` にも追加:

```makefile
.PHONY: run-server-debug build-debug

run-server-debug:
	go run -tags=debug ./cmd/combomgr

build-debug:
	cd web && pnpm run build
	go build -tags=debug -o combomgr ./cmd/combomgr
```

### 4.4 動作確認方法

開発時に以下のコマンドで動作確認できることを目指す:

```bash
# サーバー起動(debug 有効)
make run-server-debug

# 別ターミナルで:
curl http://localhost:47318/api/debug/tables | jq
curl http://localhost:47318/api/debug/dump/combos | jq
curl http://localhost:47318/api/debug/dump/moves | jq

# 本番ビルドでは存在しないことを確認
go build -o combomgr ./cmd/combomgr
./combomgr &
curl -i http://localhost:47318/api/debug/tables  # 404 になるはず
```

---

## 5. テスト要件

### 必須テスト

`internal/api/debug/handler_test.go`(ビルドタグ debug):

```go
//go:build debug

package debug_test
```

- `ListTables` の正常系: テーブル一覧が返り、各テーブルの count が正しい
- `DumpTable` の正常系: 既存テーブル(例: combos)を指定した場合、行データが返る
- `DumpTable` の異常系: 存在しないテーブル名 → 404
- `DumpTable` の異常系: SQL Injection 攻撃文字列(`combos; DROP TABLE combos;` 等)→ 404 で安全に拒否される

### 任意テスト

- ビルドタグ `!debug` 時の no-op 動作テスト(`routes_noop.go` のテスト)。ただしビルドタグの性質上、両方を1ビルドではテストできないため、CI で両方ビルドして起動確認するのが確実

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-07-review-checklist.md`**

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧が全て作成されている
- [ ] `make run-server-debug` で起動し、`/api/debug/tables` および `/api/debug/dump/:table` が動作する
- [ ] `make build`(または `go build`)で本番ビルドした場合、`/api/debug/*` が 404 になる
- [ ] テーブル名のホワイトリストチェックが実装されており、SQL Injection 攻撃が試みられても安全に拒否される
- [ ] `make test` が全通過する(debug タグ ON でテスト実行)
- [ ] README に開発ビルド/本番ビルドの違いが記載されている
- [ ] 実装完了後、開発者に「M1-07 が完了しました」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §4.4(中核) |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

- ビルドタグ `debug` の使い方(`//go:build debug` 形式、Go 1.17+ の構文を使う)
- SQL Injection 対策(テーブル名ホワイトリストチェックは必須)

### 推測で進めてよい事項(その旨を明示)

- レスポンス JSON の細部フィールド名
- limit パラメータのデフォルト値(指示書の「100」前後で調整可)
- エラーレスポンスのフォーマット(M1-03 の統一形式に従う)
- 内部関数の命名・分割

### 不明事項発見時の対応

1. ビルドタグの構文が動かない → Go バージョン確認、`//go:build` か `// +build` か(Go 1.17+ なら `//go:build`)
2. テーブル名ホワイトリストの取得方法が不明 → `sqlite_master` の SELECT を使う(本指示書 §4.2 参照)

### Plan Mode で計画提示時に含めるべき項目(任意だが推奨)

- ビルドタグ実装のファイル分割方針
- ホワイトリストチェックの実装方針(キャッシュするか毎回 sqlite_master を引くか)
- limit / offset パラメータの扱い

---

## 10. 完了後の次ステップ

M1-07 完了で M1 全体が完了に近づく。他の並列指示書(M1-04、M1-05、M1-06)の完了を待ち、統合確認を行う。

M1 完了の判定は M1-overview.md §6 に基づき、全7指示書の Definition of Done が満たされ、レビュー報告書で重大な問題がないことを開発者が承認した時点。

---

*以上*
