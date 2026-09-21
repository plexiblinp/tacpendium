# 指示書 M1-01: プロジェクト骨格・基盤構築

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-01 |
| バージョン | 1.3.0 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Opus 4.7** |
| Plan Mode | **必須** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M1-01-review-checklist.md`) |
| 並列性 | **単独**(後続全指示書が依存) |
| 依存指示書 | なし(M0プロトタイプは参考、依存ではない) |
| 想定所要時間 | 90〜120分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-29 | 開発者レビュー反映: §6 のレビュー観点を別ファイル(`docs/instructions/reviews/M1-01-review-checklist.md`)に分離(製造担当のトークン消費削減)、§3 前提条件に `M1-overview.md` 必読を追加 |
| 1.2.0 | 2026-04-30 | M1-01 並列実装中の問題対応反映: §4.1 Go バージョンを `1.22 以上` から `1.26.2`(2026-04-07 リリース、開発者確認済み)に変更 |
| 1.3.0 | 2026-04-30 | パッケージマネージャを pnpm 9.13 に統一: §4.3 にパッケージマネージャ運用方針を追記、§4.10 vite proxy 例の `npm run dev` を `pnpm run dev` に変更、§4.13 Makefile を `pnpm run` ベースに変更、§4.14 .gitignore に `package-lock.json`/`yarn.lock` 除外追加、§7 完了条件に `pnpm-lock.yaml` 生成と `packageManager` フィールド設定を追加 |

---

## 1. 背景と目的

### 背景

M0(プロトタイプ)が完了し、UI方向性が固まった。これからM1(コア基盤)に着手する。M1-01は**M1の最初の指示書であり、後続全指示書が依存する**ため、最高品質で構築する必要がある。

### 目的

- Goプロジェクト骨格の構築(`go.mod`、ディレクトリ構成)
- フロントエンドプロジェクト骨格の構築(`web/`、Vite + React + TypeScript)
- Echo サーバーの起動最小実装(ハンドラの空雛形と、ヘルスチェックエンドポイント1本)
- 設定ファイル読込(`config.toml`)の最小実装
- ロギング(`log/slog` + `lumberjack`)の初期化
- フロントエンド開発サーバーとバックエンドの接続確認(プロキシ設定)
- 全レイヤーの**空のディレクトリと型定義のみ**を先に揃え、後続指示書がスムーズに着手できる土台を作る

### このマイルストーンで作らないもの

以下は M1-02 以降で作る。M1-01 では実装しない。

- マイグレーション実行ロジック(M1-02)
- 実際のCRUD API(M1-03)
- DB接続の開始(M1-02まで未実装、ただし接続できる構造は用意)
- 認証・セッション(フェーズ2)

---

## 2. 成果物

### 2.1 作成するファイル(Go側)

```
combomgr/
├── cmd/combomgr/
│   └── main.go                              # エントリポイント
├── internal/
│   ├── api/
│   │   ├── middleware/
│   │   │   ├── cors.go                      # CORSミドルウェア(設定読込ベース)
│   │   │   ├── logger.go                    # request_id付与とアクセスログ
│   │   │   └── doc.go                       # パッケージdoc
│   │   ├── health/
│   │   │   └── handler.go                   # GET /api/health
│   │   ├── combo/doc.go                     # 空(M1-03で実装)
│   │   ├── setup/doc.go                     # 空(M4で実装)
│   │   ├── preset/doc.go                    # 空(M1-04で実装)
│   │   ├── tag/doc.go                       # 空(M3で実装)
│   │   ├── user/doc.go                      # 空(M6で実装)
│   │   ├── config/doc.go                    # 空(M6で実装)
│   │   └── debug/doc.go                     # 空(M1-07で実装、ビルドタグdebug)
│   ├── service/
│   │   ├── combo/doc.go                     # 空(M1-03で実装)
│   │   ├── setup/doc.go                     # 空
│   │   ├── preset/doc.go                    # 空
│   │   ├── tag/doc.go                       # 空
│   │   ├── user/doc.go                      # 空
│   │   ├── notation/doc.go                  # 空(M1-04で実装)
│   │   └── validation/doc.go                # 空(M1-03で実装)
│   ├── repository/
│   │   ├── combo/doc.go                     # 空
│   │   ├── setup/doc.go                     # 空
│   │   ├── preset/doc.go                    # 空
│   │   ├── tag/doc.go                       # 空
│   │   └── user/doc.go                      # 空
│   ├── model/
│   │   └── doc.go                           # 空(M1-02で実装)
│   ├── config/
│   │   ├── config.go                        # config.toml読込
│   │   └── config_test.go                   # テスト
│   └── infra/
│       ├── db/
│       │   ├── doc.go                       # 空(M1-02で実装)
│       ├── migration/
│       │   └── doc.go                       # 空(M1-02で実装)
│       └── netutil/
│           ├── private_ip.go                # LAN IP検出(SUPP-001 §2.6.2、最小実装)
│           └── private_ip_test.go           # テスト
├── go.mod
├── go.sum
├── config.toml.example                      # 設定ファイルのサンプル
└── Makefile                                 # ビルド・実行・テストのショートカット
```

### 2.2 作成するファイル(フロント側)

```
web/
├── src/
│   ├── App.tsx                              # ルートコンポーネント
│   ├── main.tsx                             # エントリポイント
│   ├── router.tsx                           # ルーティング(空に近い、後続で拡張)
│   ├── pages/
│   │   └── HealthCheckPage.tsx              # /api/health 呼出してOKを表示する確認用ページ
│   ├── lib/
│   │   ├── api-client.ts                    # fetch wrapper
│   │   ├── i18n.ts                          # react-i18next 設定(最小)
│   │   └── constants.ts                     # 表示名長等の定数(SUPP-001 §2.4)
│   ├── locales/
│   │   ├── ja.json                          # 日本語ロケール(キー2-3個でOK)
│   │   └── en.json                          # 英語ロケール(キー2-3個でOK)
│   └── types/
│       └── api.ts                           # 空(後続で型を追加)
├── public/
├── index.html
├── package.json
├── vite.config.ts                           # 開発サーバープロキシ設定含む
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

### 2.3 リポジトリルート

- `.gitignore` に Go・Node.js・SQLite・config.toml の除外を追記(既存があれば追記、なければ作成)
- `README.md`(プロジェクト概要、起動方法を簡潔に記載)

### 2.4 変更しないもの

- `docs/` 配下(設計書・指示書・引継ぎ資料)
- `CLAUDE.md`、`.claude/settings.json`、`.claude/settings.local.json`
- `web/prototypes/`(M0成果物、M7まで残す)

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`(プロジェクト全体の指針)
- `docs/instructions/M1-overview.md`(M1サブマイルストーン全体マップ、依存関係と並列性)
- `docs/design/supp-001-detailed-design.md` の以下節のみ
  - **§5.2** Goパッケージ構成(本指示書のディレクトリ構成の根拠)
  - **§5.3** フロントエンドディレクトリ構成
  - **§5.6** ロギング戦略
  - **§5.8** 設定ファイルフォーマット
  - **§2.6.1** CORS許可Origin(本指示書での実装方針の根拠)
  - **§2.6.2** QRコードIP選定(`netutil/private_ip.go` の最小実装の根拠)

### 任意参照(必要時のみ)

- `docs/design/02-architecture.md` §3(起動フロー)、§4(API設計)、§13(ディレクトリ構成全体図)
  - SUPP-001 §5.2 と矛盾する場合はSUPP-001を優先

### 参照不要(本指示書では触れない)

- DES-003(データモデル) — M1-02で参照
- DES-004(内部表現) — M1-04で参照
- DES-005(画面設計) — M1-05、M1-06で参照
- DES-006(バリデーション) — M1-03で参照

---

## 4. 詳細仕様

### 4.1 Go モジュール

- モジュールパス: `github.com/<your-username>/combomgr`(具体名は開発者に確認、わからなければ`combomgr`単体でも可)
- Go バージョン: `1.26.2`(2026-04-07 リリース、開発者が現時点最新版として確定済み)
- `go.mod` に明記

### 4.2 依存ライブラリ(go.mod に追加するもの)

| ライブラリ | バージョン | 用途 |
|-----------|----------|------|
| `github.com/labstack/echo/v4` | 最新安定版 | Web フレームワーク |
| `modernc.org/sqlite` | 最新安定版 | SQLite ドライバ(M1-02で本格使用、M1-01では import のみ) |
| `github.com/BurntSushi/toml` | 最新安定版 | TOML 解析 |
| `gopkg.in/natefinch/lumberjack.v2` | 最新安定版 | ログローテーション |

**M1-01の go.mod には上記4つのみ追加する。** マイグレーションライブラリは M1-02、UUIDライブラリは必要時に追加。

### 4.3 フロント依存ライブラリ(package.json)

#### 4.3.1 パッケージマネージャ

本プロジェクトのフロントエンドパッケージ管理には **pnpm 9.13** を使用する(npm/yarn は使わない)。

- pnpm のインストール状況確認: `pnpm --version`(devContainer に既にインストール済みの想定)
- 依存追加コマンド: `pnpm add <pkg>`(本番依存)、`pnpm add -D <pkg>`(開発依存)
- 依存インストール: `pnpm install`
- ロックファイルは `pnpm-lock.yaml`(`package-lock.json` や `yarn.lock` は生成しない、もし生成された場合は削除して `.gitignore` に追加)
- npm/yarn のロックファイル(`package-lock.json`、`yarn.lock`)は `.gitignore` で除外
- `package.json` に `"packageManager": "pnpm@9.13.x"` フィールドを設定すると、pnpm のバージョン整合性が保証される

#### 4.3.2 必要なライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `react`、`react-dom` | React |
| `react-router-dom` | ルーティング |
| `@tanstack/react-query` | データ取得(M1-01では設定のみ、利用は後続) |
| `i18next`、`react-i18next` | i18n |
| `tailwindcss`、`postcss`、`autoprefixer` | スタイリング |
| `lucide-react` | アイコン(必要時) |
| `clsx` | クラス名結合 |
| 開発: `vite`、`@vitejs/plugin-react`、`typescript`、`@types/react`、`@types/react-dom`、`vitest`、`@testing-library/react`、`jsdom` | 開発ツール |

**shadcn/ui の導入はこの指示書では不要**(後続指示書で必要に応じて `pnpm dlx shadcn-ui add` で追加する。`npx` ではなく `pnpm dlx` を使うこと)。

### 4.4 設定ファイル(config.toml)の最小実装

`internal/config/config.go` で以下を実装:

```go
type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Logging  LoggingConfig
    Security SecurityConfig
}

type ServerConfig struct {
    Mode string // "local" or "lan"
    Port int    // default: 47318
}

type DatabaseConfig struct {
    Path string // 空ならOS標準のアプリデータディレクトリ
}

type LoggingConfig struct {
    Level       string // "debug" / "info" / "warn" / "error"
    File        string // default: "logs/combomgr.log"
    MaxSizeMB   int    // default: 10
    MaxBackups  int    // default: 5
    MaxAgeDays  int    // default: 30
}

type SecurityConfig struct {
    PasswordEnabled bool
    // PasswordHash は M6 以降で扱う、M1-01 では構造体に含めるが操作しない
}

// Load: config.toml を読み込む。ファイルが存在しない場合はデフォルト値で動作
func Load(path string) (*Config, error) { ... }

// Default: デフォルト値の Config を返す
func Default() *Config { ... }
```

**注意点:**
- ファイルが存在しない場合は **エラーにせず、Default() を返す**(初回起動時の挙動)
- 環境変数 `COMBOMGR_LOG_LEVEL` が設定されていれば Logging.Level を上書きする

### 4.5 ロギング初期化

`internal/infra/log/log.go`(または `cmd/combomgr/main.go` 内の関数として)に以下を実装:

```go
// Init は slog のデフォルトロガーを設定する
// - 開発時(level=debug): テキスト形式、標準出力 + ファイル
// - それ以外: JSON形式、ファイルのみ
// - lumberjack を使ってローテーション
func Init(cfg *config.LoggingConfig) error { ... }
```

**ローテーション設定値**(SUPP-001 §5.6):
- MaxSize: cfg.MaxSizeMB(default 10)
- MaxBackups: cfg.MaxBackups(default 5)
- MaxAge: cfg.MaxAgeDays(default 30)
- Compress: false

### 4.6 サーバー起動と main.go

`cmd/combomgr/main.go`:

```go
func main() {
    // 1. config.toml 読込
    cfg, err := config.Load("config.toml")
    if err != nil { /* fatal */ }

    // 2. ロギング初期化
    if err := log.Init(&cfg.Logging); err != nil { /* fatal */ }

    // 3. バインドアドレス決定
    bindAddr := determineBindAddr(cfg.Server.Mode, cfg.Server.Port)

    // 4. CORS許可Origin構築(SUPP-001 §2.6.1)
    allowedOrigins := buildAllowedOrigins(cfg.Server.Mode, cfg.Server.Port)

    // 5. Echo サーバー初期化
    e := echo.New()
    e.Use(middleware.Logger())              // 自前のlogger
    e.Use(middleware.CORS(allowedOrigins))  // 自前のCORS

    // 6. ルート登録(M1-01 では /api/health のみ)
    e.GET("/api/health", health.Handler)

    // 7. 起動
    slog.Info("server starting", "addr", bindAddr, "mode", cfg.Server.Mode)
    if err := e.Start(bindAddr); err != nil { /* fatal */ }
}
```

**バインドアドレス決定ロジック:**
- `mode=local`: `127.0.0.1:<port>`
- `mode=lan`: `0.0.0.0:<port>`

**CORS許可Origin構築(SUPP-001 §2.6.1 厳守):**
- `mode=local` の場合: `http://localhost:<port>`、`http://127.0.0.1:<port>` のみ許可
- `mode=lan` の場合: 上記に加えて、`netutil.SelectPrimaryLANIP()` で取得した代表IP1つを `http://<ip>:<port>` で許可
- **ワイルドカード `*` 許可は絶対に使わない**
- **OS の NIC 一覧をリクエスト時に取得して動的判定する実装は禁止**(起動時に1回だけ展開してキャッシュ)

### 4.7 netutil/private_ip.go の最小実装

`internal/infra/netutil/private_ip.go` に以下を実装:

```go
// IsVirtualInterface はインタフェース名から仮想NIC判定する
// SUPP-001 §2.6.2 のパターンマッチング
func IsVirtualInterface(name string) bool { ... }

// IsPrivateIPv4 は IPv4 アドレスがプライベート範囲か判定する
// 範囲: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
// CGNAT(100.64.0.0/10) も除外対象として false を返す
func IsPrivateIPv4(ip net.IP) bool { ... }

// ListPrivateIPv4 は除外ロジック適用後のプライベートIPv4一覧を返す
// 仮想NIC、ループバック、無効化IFは除外
func ListPrivateIPv4() ([]net.IP, error) { ... }

// SelectPrimaryLANIP は代表IP1つを返す
// 優先順位: 192.168.x.x > 10.x.x.x > 172.16〜31.x.x
// 同一優先度内では最初に見つかったもの
// 見つからなければエラー
func SelectPrimaryLANIP() (net.IP, error) { ... }
```

**仮想NIC除外パターン**(SUPP-001 §2.6.2 から):
- `docker*`、`veth*`、`br-*`、`vEthernet*`、`tailscale*`、`tun*`、`tap*`、`vmnet*`、`vboxnet*`、`utun*`、`ppp*`、`zt*`

### 4.8 ヘルスチェックエンドポイント

`internal/api/health/handler.go`:

```go
// GET /api/health
// レスポンス: {"status": "ok", "version": "0.1.0"}
func Handler(c echo.Context) error { ... }
```

バージョン定数は `cmd/combomgr/main.go` で `const Version = "0.1.0"` のように定義し、build時に上書き可能なら望ましい(必須ではない)。

### 4.9 フロント: api-client.ts

`web/src/lib/api-client.ts` に以下を実装:

```typescript
const API_BASE = import.meta.env.DEV ? "" : "/api";  // 開発時はviteのproxyに任せる、本番は同一オリジン

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
```

### 4.10 vite.config.ts のプロキシ設定

開発時に `pnpm run dev`(または `pnpm dev`)でフロント(default port 5173)が起動する。`/api/*` をバックエンド(port 47318)にプロキシする設定が必要。

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:47318",
        changeOrigin: false,
      },
    },
  },
});
```

### 4.11 HealthCheckPage の実装

`web/src/pages/HealthCheckPage.tsx`:

- マウント時に `/api/health` を fetch
- 成功なら緑色で「サーバー接続OK: バージョン x.x.x」を表示
- 失敗なら赤色で「サーバー接続失敗: <エラー>」を表示
- このページは開発時の動作確認用、後続でルーティング表から外して構わない

### 4.12 i18n の最小設定

`web/src/lib/i18n.ts` で初期化、`ja.json`/`en.json` には2-3個のキー(例: `app.title`、`health.ok`、`health.error`)のみ。

### 4.13 Makefile

最小限のターゲット:

```makefile
.PHONY: run-server run-web build test

run-server:
	go run ./cmd/combomgr

run-web:
	cd web && pnpm run dev

build:
	cd web && pnpm run build
	go build -o combomgr ./cmd/combomgr

test:
	go test ./...
	cd web && pnpm test
```

### 4.14 .gitignore の追加

既存があれば追記、なければ作成。以下を含める:

```
# Claude Code
.claude/settings.local.json

# Go
*.exe
*.dll
*.so
*.dylib
*.test
*.out
combomgr
combomgr.exe

# DB
*.db
*.db-journal
*.db-shm
*.db-wal

# Logs
logs/
*.log

# Node.js / pnpm
web/node_modules/
web/dist/
web/.vite/
web/coverage/
# 他パッケージマネージャのロックファイル(pnpm-lock.yaml のみコミット対象)
web/package-lock.json
web/yarn.lock

# Env / Secrets
.env
.env.*
!.env.example
secrets/

# Config (本物の config.toml はコミットしない、example のみ)
config.toml
!config.toml.example

# IDE / OS
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
```

---

## 5. テスト要件

### 必須テスト

#### Go側

- `internal/config/config_test.go`:
  - `Load()` の正常系(ファイル存在時)
  - `Load()` の正常系(ファイル不在時、Default が返ること)
  - `Load()` の異常系(不正TOML)
  - 環境変数 `COMBOMGR_LOG_LEVEL` による上書き

- `internal/infra/netutil/private_ip_test.go`:
  - `IsVirtualInterface()` の判定(docker、tailscale、eth0、wlan0 等の代表名)
  - `IsPrivateIPv4()` の判定(プライベート範囲・パブリックIP・CGNAT・ループバック)
  - `SelectPrimaryLANIP()` はモック(ネットワーク依存のため)、または `ListPrivateIPv4()` の戻り値をベースとした優先順位ロジックの単体テスト

#### フロント側

- `web/src/lib/api-client.test.ts`:
  - `fetchJSON()` の正常系
  - HTTPエラー時に例外が投げられること(モック使用)

### 任意テスト(M1-01では省略可)

- ハンドラの httptest 経由のテスト(ヘルスチェックのみなので省略可)
- HealthCheckPageのコンポーネントテスト(機能薄いため任意)

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない(本節はレビュー担当 Claude が使用するチェックリストへのポインタ)。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-01-review-checklist.md`**

レビュー担当 Claude(別ターミナル)は、本指示書(製造担当向け)と上記レビューチェックリストの両方を読み、独立レビューを実施する。製造担当 Claude は本指示書の §1〜§5、§7〜§10 のみを読めば足りる。

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧がすべて作成されている
- [ ] `web/package.json` に `"packageManager": "pnpm@9.13.x"` フィールドが設定されている
- [ ] `web/pnpm-lock.yaml` が生成されている(`package-lock.json`、`yarn.lock` は存在しない)
- [ ] `make run-server` でバックエンドサーバーが起動し、`/api/health` が `{"status":"ok"}` を返す
- [ ] `make run-web` でフロント開発サーバーが起動し、HealthCheckPage がサーバー接続OKを表示する
- [ ] `make test` が全テスト通過する
- [ ] §6 のレビュー観点に該当する重大な問題がない
- [ ] Plan Mode で計画を提示し、開発者承認後に実装着手した
- [ ] 実装完了後、開発者に「M1-01が完了しました、後続指示書に進めます」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.6.1、§2.6.2、§5.2、§5.3、§5.6、§5.8 |
| DES-002 | `docs/design/02-architecture.md` | 任意参照: §3、§4、§13 |
| HANDOVER-001 | `docs/handover/handover_1.md` | プロジェクト全体像 |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

以下は推測で決めず、開発者に確認すること。

- Go モジュールパス(`github.com/<user>/combomgr` の `<user>` 部分)
- ライブラリの**メジャーバージョン選択に迷った場合**(例: Echo v4 vs v5)
- **CORS実装の細部で SUPP-001 §2.6.1 と矛盾しそうな解釈**(機械強制でないため、判断ブレが起きやすい)
- 環境変数名の追加(`COMBOMGR_LOG_LEVEL` 以外を増やしたくなった場合)

### 推測で進めてよい事項(その旨を明示)

以下は推測+明示で進めて構わない。

- 細かな関数シグネチャ(`Init(cfg *Config)` か `Init(cfg LoggingConfig)` かなど)
- ログメッセージの文言
- README.md の文面
- 内部構造体の細かなフィールド命名

### 不明事項の取り扱い

判断不能な事項に出会った場合、以下のいずれかで対応:

1. Plan Mode 段階で気付いた → 計画提示時に開発者に質問
2. 実装中に気付いた → コード内コメントで「TODO(M1-01): 開発者確認」と明示し、ひとまず妥当な仮実装で進める
3. 設計書間で矛盾を発見した → 実装を止め、開発者に報告(設計変更通知書 CHANGE-XXX の対象)

### Plan Mode で計画提示時に含めるべき項目

- 作業順序(Go側 → フロント側、またはその逆、依存関係を考慮)
- 依存ライブラリの選定理由(メジャー安定版を使う前提でOK、特殊な選定があれば明示)
- CORS実装の方針(SUPP-001 §2.6.1 をどう解釈したかを明示)
- 推測で進める箇所(あれば明示)
- 想定所要時間の見積もり

---

## 10. 完了後の次ステップ

M1-01 完了後、以下が並列で進行可能になる:

1. **品質レビュー担当Claudeによる機械レビュー**(別ターミナル、`docs/progress/m1-01-review.md` 作成)
2. **M1-02(マイグレーション基盤・seed SQL)の指示書投入**(製造ターミナル)

並列レビュー運用の手順は本プロジェクトで標準化済み(SUPP-001 §6.6)。

---

*以上*
