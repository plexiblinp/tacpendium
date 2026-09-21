# M6-RESEARCH-01 調査レポート

| 項目 | 内容 |
|------|------|
| 調査者 | 製造担当 Claude Code(M6-RESEARCH-01 担当、Sonnet 4.6) |
| 調査日 | 2026-05-23 |
| 使用ツール | view / bash(grep / cat / ls / find 等の参照系のみ) |
| 書き込み系操作 | 一切なし(read-only 厳守) ※本レポートファイル出力を除く |

---

## 結論サマリ(調査担当による事実集約、最初に読む)

主目的 2 項目に対する yes / no 回答:

| 項目 | 実装有無 | 補足 |
|------|---------|------|
| 項目 A: `GET /api/config` / `PUT /api/config` | **no(未実装)** | `internal/api/config/doc.go` のみ。handler.go / routes.go / service 層なし。詳細は §4.1 |
| 項目 B: `config.toml` `[server].mode` 読込 + バインド切替 | **yes(実装済み)** | **想定外の発見**。`internal/config/config.go` + `main.go:determineBindAddr()` で完全実装済み。詳細は §4.2 / §4.3 |

---

## 4.1 `GET /api/config` / `PUT /api/config` の実装有無

### (a) GET /api/config ハンドラ実装

- 実装有無: **no**

### (b) PUT /api/config ハンドラ実装

- 実装有無: **no**

### (c) ルーター登録

- 実装有無: **no**
- `cmd/combomgr/main.go` の登録済みルート(150〜168 行付近):
  ```go
  combohandler.RegisterRoutes(apiGroup, comboHandler)   // M1-03
  presethandler.RegisterRoutes(apiGroup, presetHandler) // M1-04
  movehandler.RegisterRoutes(apiGroup, moveHandler)     // M1-06
  taghandler.RegisterRoutes(apiGroup, tagHandler)       // M3-01
  charhandler.RegisterRoutes(apiGroup, charHandler)     // M3-04
  setuphandler.RegisterRoutes(apiGroup, setupHandler)   // M4-01
  debughandler.RegisterRoutes(apiGroup, debugHandler)   // M1-07
  ```
  `confighandler.RegisterRoutes(...)` の呼び出しは存在しない。

### (d) `internal/api/config/` パッケージ

- 存在: **yes**
- 配下ファイル一覧: `doc.go` のみ(handler.go / routes.go は未作成)
- `doc.go` の内容:
  ```go
  // Package config は設定取得・更新の HTTP ハンドラを提供する。M6 で実装。
  //
  // 注: 設定ファイル読込ロジックは internal/config(別パッケージ)で扱う。
  package config
  ```

### (e) サービス層 `internal/service/config/`

- 存在: **no**
- `internal/service/` 配下に `config/` ディレクトリは存在しない。

### (f) 総合判定

**設定 API は未実装。** `internal/api/config/` パッケージの doc.go に「M6 で実装」とコメントがあり、M6 での新規実装を想定した状態で M5 完了している。

---

## 4.2 `config.toml` 読込実装と `[server].mode` 利用状況

### (a) `internal/config/` パッケージ

- 存在: **yes**
- 配下ファイル一覧:
  - `internal/config/config.go`(136 行)
  - `internal/config/config_test.go`(150 行)
- 主要関数名:
  - `Default() *Config` — デフォルト設定値を返す
  - `Load(path string) (*Config, error)` — config.toml から設定を読み込む(ファイル不在時は Default() 返却)
  - `validate() error` — server.mode と server.port を検証(非公開)

### (b) TOML パース呼出

- 有無: **yes**
- 呼出ファイル + 行番号: `internal/config/config.go:102`
- 呼出コード:
  ```go
  if _, decodeErr := toml.Decode(string(data), cfg); decodeErr != nil {
      return nil, fmt.Errorf("config: decode %q: %w", path, decodeErr)
  }
  ```
- 使用ライブラリ: `github.com/BurntSushi/toml`

### (c) Go 側の Config 構造体定義

- 有無: **yes**
- 構造体定義の全フィールド一覧:

| 構造体 | フィールド名 | 型 | TOML タグ | 備考 |
|--------|------------|-----|---------|------|
| `Config` | `Server` | `ServerConfig` | `toml:"server"` | |
| `Config` | `Database` | `DatabaseConfig` | `toml:"database"` | |
| `Config` | `Logging` | `LoggingConfig` | `toml:"logging"` | |
| `Config` | `Security` | `SecurityConfig` | `toml:"security"` | |
| `ServerConfig` | `Mode` | `string` | `toml:"mode"` | "local" または "lan" |
| `ServerConfig` | `Port` | `int` | `toml:"port"` | デフォルト 47318 |
| `DatabaseConfig` | `Path` | `string` | `toml:"path"` | 空ならアプリ既定パス |
| `LoggingConfig` | `Level` | `string` | `toml:"level"` | デフォルト "info" |
| `LoggingConfig` | `File` | `string` | `toml:"file"` | デフォルト "logs/combomgr.log" |
| `LoggingConfig` | `MaxSizeMB` | `int` | `toml:"max_size_mb"` | デフォルト 10 |
| `LoggingConfig` | `MaxBackups` | `int` | `toml:"max_backups"` | デフォルト 5 |
| `LoggingConfig` | `MaxAgeDays` | `int` | `toml:"max_age_days"` | デフォルト 30 |
| `SecurityConfig` | `PasswordEnabled` | `bool` | `toml:"password_enabled"` | M6 以降で扱う、M1 では未使用 |

デフォルト値(抜粋):
```go
defaultServerMode    = "local"
defaultServerPort    = 47318
defaultLoggingLevel  = "info"
defaultLoggingFile   = "logs/combomgr.log"
defaultLogMaxSizeMB  = 10
defaultLogMaxBackups = 5
defaultLogMaxAgeDays = 30
```

バリデーション:
```go
switch c.Server.Mode {
case "local", "lan":
    // ok
default:
    return fmt.Errorf("config: invalid server.mode %q (want \"local\" or \"lan\")", c.Server.Mode)
}
```

### (d) `[server].mode` 利用コード

- 有無: **yes**
- 利用箇所:

| ファイルパス | 行番号 | 用途 |
|------------|--------|------|
| `cmd/combomgr/main.go` | 128 | `determineBindAddr(cfg.Server.Mode, cfg.Server.Port)` — バインドアドレス決定 |
| `cmd/combomgr/main.go` | 130 | `buildAllowedOrigins(cfg.Server.Mode, cfg.Server.Port)` — CORS 許可 Origin 構築 |
| `cmd/combomgr/main.go` | 137 | `slog.String("mode", cfg.Server.Mode)` — サーバー起動時ログ出力 |

### (e) `config.toml` ファイル

- 存在: **no**
- リポジトリ(`/workspaces/combomgr/`) 配下に `config.toml` は存在しない。
- 読込パス定数: `cmd/combomgr/main.go:52` で `configPath = "config.toml"` と定義。ファイル不在時は `Default()` で続行する設計。

### (f) 総合判定

**読込実装はあるが `[server].mode` 利用実装も実装済み。**

具体的には「`[server].mode` 利用実装あり」に該当する。`internal/config/config.go` で TOML 読込・バリデーションが実装済みであり、`cmd/combomgr/main.go` の `determineBindAddr()` / `buildAllowedOrigins()` が `cfg.Server.Mode` の値を実際に使ってバインドアドレスと CORS Origin を決定している。

---

## 4.3 サーバー起動時のバインドアドレス決定ロジック

### (a) サーバー起動コード

- ファイルパス: `cmd/combomgr/main.go`
- 行番号: 170(`e.Start(bindAddr)` 呼び出し行)

### (b) 起動関数の引数の実態

```go
// cmd/combomgr/main.go:128
bindAddr := determineBindAddr(cfg.Server.Mode, cfg.Server.Port)

// cmd/combomgr/main.go:170
if err := e.Start(bindAddr); err != nil {
    return fmt.Errorf("server: %w", err)
}

// cmd/combomgr/main.go:176-185
func determineBindAddr(mode string, port int) string {
    host := "127.0.0.1"
    if mode == "lan" {
        host = "0.0.0.0"
    }
    return fmt.Sprintf("%s:%d", host, port)
}
```

引数の実態: `bindAddr` 変数(文字列リテラルではなく、`determineBindAddr()` の戻り値)。
- `mode = "local"` の場合: `"127.0.0.1:47318"`(デフォルト)
- `mode = "lan"` の場合: `"0.0.0.0:47318"`

### (c) ポート番号の決定方法

`config.toml` 由来(`cfg.Server.Port`)。デフォルト値は 47318。

### (d) ポート競合時のフォールバック実装

- 有無: **no**
- `e.Start(bindAddr)` を直接呼び出しており、ポート使用中の場合に次の空きポートを探索する実装は存在しない。

### (e) 総合判定

**`config.toml` から動的決定。**

`determineBindAddr(cfg.Server.Mode, cfg.Server.Port)` により、`config.toml` の `[server].mode` と `[server].port` を読み込んでバインドアドレスを動的に決定している。固定文字列リテラルの使用はなし。

CORS Origin の構築(`buildAllowedOrigins()`) も同様に `mode` に応じて動的に構築している:
- `local` モード: `http://localhost:<port>` および `http://127.0.0.1:<port>` を許可
- `lan` モード: 上記に加え、`netutil.SelectPrimaryLANIP()` で得た代表 LAN IP の `http://<ip>:<port>` を許可。LAN IP が見つからない場合は起動中止(エラーを返す)。

---

## 4.4 関連する既存テストコードの存在

### (a) `internal/config/` 配下のテストファイル

- `internal/config/config_test.go`(150 行)

### (b) `internal/infra/` 配下のサーバー起動関連テストファイル

サーバー起動コードは `cmd/combomgr/main.go` に実装されており、`internal/infra/` 配下ではなく、以下の関連テストが存在:
- `internal/infra/netutil/private_ip_test.go`(186 行) — `SelectPrimaryLANIP()` / `ListPrivateIPv4()` 等のテスト

その他 `internal/infra/` 配下のテストファイル:
- `internal/infra/db/db_test.go`(126 行) — SQLite 接続・PRAGMA テスト
- `internal/infra/migration/migrate_test.go`(231 行) — マイグレーション冪等性テスト

### (c) テスト関数名一覧

#### `internal/config/config_test.go`

- `TestDefault`
- `TestLoad_FileMissing_ReturnsDefault`
- `TestLoad_ValidFile`(mode="lan" のケースを含む)
- `TestLoad_InvalidTOML`
- `TestLoad_InvalidMode`
- `TestLoad_EnvOverride_LogLevel`
- `TestLoad_EnvOverride_OverridesFileValue`

#### `internal/infra/netutil/private_ip_test.go`

- `TestIsVirtualInterface`
- `TestIsPrivateIPv4`
- `TestIsPrivateIPv4_IPv6Unspecified`
- `TestSelectByPriority`
- `TestListPrivateIPv4_DoesNotError`

#### `internal/infra/db/db_test.go`

- `TestOpen_AppliesPragmas`
- `TestOpen_CreatesParentDir`
- `TestOpen_EmptyPath`
- `TestResolveDBPath_ExplicitPath`
- `TestResolveDBPath_DefaultByOS`
- `TestResolveDBPath_XDGDataHome`

#### `internal/infra/migration/migrate_test.go`

- `TestRun_FirstAndIdempotent`
- `TestRun_AllTablesExist`
- `TestRun_HitTypeColumnExists`
- `TestRun_PresetsCodeColumn`
- `TestRun_MovesNoNameColumns`
- `TestRun_SeedRowCounts`
- `TestRun_RushVariantOriginalMoveID`

### (d) 総合判定

**関連テスト整備済み。** `internal/config/config_test.go`(7 ケース)は config 読込・バリデーション・デフォルト値・環境変数上書きを網羅している。サーバー起動コード(`cmd/combomgr/main.go` の `determineBindAddr` / `buildAllowedOrigins`)に直接対応するテストは未整備。

---

## 4.5 関連設計書記述と実装の乖離

### (a) 発見した乖離

1. **DES-002 §3.3「ポート競合フォールバック」が未実装**
   - 設計書: 「使用中の場合は次の空きポートを探索する」と記載
   - 実装: `e.Start(bindAddr)` を直接呼び出しており、ポート競合フォールバック機構なし

2. **`SecurityConfig.PasswordEnabled` フィールドが存在するが未使用**
   - 実装: `internal/config/config.go` に `SecurityConfig` 構造体と `PasswordEnabled bool` フィールドが定義済み
   - 実装コメント: 「M6 以降で扱う。M1 では未使用」との記載あり
   - 設計書への明示: SUPP-001 §5.8 設定ファイル例との対応確認が必要(本調査の範囲外)

3. **`config.toml` のサンプルファイルがリポジトリに存在しない**
   - SUPP-001 §5.8 に設定ファイルフォーマット例が記載されているが、リポジトリに `config.toml` / `config.toml.example` 等のサンプルファイルは存在しない

### (b) 乖離以外の事実確認

SUPP-001 §4.2「LAN 共有バインドロジックの先行実装」と `determineBindAddr()` の実装は対応している。設計書に記載の「local→127.0.0.1 / lan→0.0.0.0」の切替が実装済み。

---

## 特記事項

**想定外の発見**: 指示書 §0.4 では「項目 B: `[server].mode` 読込 + バインド切替は未実装」と想定されていたが、**実装済みであることが確認された**。

詳細:
- `internal/config/config.go` — TOML 読込・Config 構造体定義・バリデーション・デフォルト値処理がすべて実装済み(136 行)
- `internal/config/config_test.go` — 7 ケースのテストコードも整備済み(150 行)
- `cmd/combomgr/main.go:determineBindAddr()` — mode="local" で 127.0.0.1、mode="lan" で 0.0.0.0 に切替する関数が実装済み
- `cmd/combomgr/main.go:buildAllowedOrigins()` — CORS 許可 Origin も mode に応じて動的構築する関数が実装済み
- 上記は SUPP-001 §4.2 の「LAN 共有バインドロジックの先行実装」に該当する記述と対応していると推測される(本調査では SUPP-001 の当該節との対照は実施していない)

その他特記事項:
- `internal/api/config/doc.go` に「M6 で実装」との明示コメントがあり、設定 API(項目 A)が M6 スコープとして明示的に予約されている
- `cmd/combomgr/main.go` のサーバー起動シーケンスは以下の順で整備済み: config 読込 → logging 初期化 → DB パス決定 → マイグレーション → DB 接続 → DI 配線 → バインドアドレス決定 → CORS 構築 → Echo 起動
- `netutil.SelectPrimaryLANIP()` は仮想 NIC(docker/veth/vEthernet/tailscale 等 12 パターン)を除外し、RFC1918 プライベート IP を優先度(192.168 > 10 > 172.16-31)で選定する実装が完備している

---

## 調査担当からの完了宣言

本指示書 §0.2 read-only 厳守を遵守し、view / bash 参照系コマンドのみで調査を完了した。書き込み系操作(ファイル新規作成・編集・削除、git 操作、ビルド・テスト実行、マイグレーション、設定ファイル編集)は一切行っていない。本レポートファイルの出力のみを書き込み系操作として実施した。
