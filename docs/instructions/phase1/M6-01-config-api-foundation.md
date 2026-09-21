# 指示書 M6-01: 設定 API 基盤(`GET /api/config` / `PUT /api/config` + サービス層 + ハンドラ層新設)

| 項目 | 内容 |
|------|------|
| 指示書ID | M6-01 |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6 |
| Plan Mode | **必須**(下記 §3.4.7 / §9.4 に必須項目あり) |
| 機械レビュー | 必須(レビューモデル: Sonnet 4.6、別ファイル M6-01-review-checklist.md) |
| 並列性 | 単独 |
| 依存指示書 | M6-RESEARCH-01 完了済み(2026-05-23) |
| 想定所要時間 | 90〜120 分 |
| 作成者・作成日 | 設計担当 Claude(M6 期間担当)、2026-05-23 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-23 | 初版作成。M6-overview v1.0.0 §4.2 で確定したスコープ + M6-RESEARCH-01 調査結果(2026-05-23)を踏まえて作成 |

---

## 1. 背景と目的

### 1.1 背景

M6(初期体験系)スコープのうち、設定 API 基盤を M6-01 として独立サブマイルストーンで実装する。

M6-RESEARCH-01 調査結果(2026-05-23)で以下が判明済み:

- **`GET /api/config` / `PUT /api/config` は未実装**(`internal/api/config/doc.go` のみ存在し、handler.go / routes.go / service 層は未着手)
- **`config.toml` 読込実装と LAN バインドロジックは M1 期間で既に実装済み**(`internal/config/config.go` + `cmd/combomgr/main.go:determineBindAddr()`、テスト 7 ケース整備済み)

本指示書では設定 API 基盤のみを実装し、LAN バインドロジックには手を加えない。後続の M6-02(設定画面 + 初回起動ウィザード)が本 API を消費するため、API クライアントを 1 セット作って 2 画面で共有する設計に向けた基盤整備を担う。

### 1.2 目的

本指示書完了時に以下を達成する:

- `GET /api/config` が動作し、現在の設定値 + `isInitialized: bool` フィールド(= `config.toml` 存在有無)を JSON で返す
- `PUT /api/config` が動作し、リクエストボディの設定値を検証 → `config.toml` 書き戻し → メモリ上の `*config.Config` 更新を行う
- バックエンド 3 層パターン(architecture-patterns.md §2)で `internal/api/config/handler.go` + `internal/api/config/routes.go` + `internal/service/config/service.go` が新設されている
- 既存の `internal/config/config.go` / `cmd/combomgr/main.go:determineBindAddr()` / `cmd/combomgr/main.go:buildAllowedOrigins()` には変更を加えず、既存挙動を温存する
- 機微情報(`PasswordHash` 等、将来追加予定フィールド)はレスポンス DTO から除外する規約が明文化されている
- 既存テスト(`internal/config/config_test.go` の 7 ケース + 他全テスト)に回帰なし

### 1.3 このマイルストーンで作らないもの

- **フロント側 UI 全般**(設定画面 / 初回起動ウィザード)— M6-02 で実装
- **LAN バインドロジック実装**(`determineBindAddr` / `buildAllowedOrigins`) — M1 既存実装をそのまま使用、変更なし
- **認証ロジック**(SUPP-001 §4.2 / CLAUDE.md §10 でフェーズ 2 送り、`SecurityConfig.PasswordEnabled` 既定フィールドは存在するが M6 では UI 表示のみ・認証フローには組み込まない)
- **ポート競合フォールバック実装**(DES-002 §3.3 既定義だが未実装、M6-RESEARCH-01 §4.5 (1) で発覚、新規持ち越し L-04 として m6-to-m7-handover で次工程に引き継ぎ)
- **`config.toml` 自動生成処理**(SUPP-001 §5.8 で「初回起動ウィザード完了時に自動生成」と既定義済み、本 M6-01 では既存の「ファイル不在時は `Default()` で続行」挙動を温存し、自動生成自体は M6-02 で `PUT /api/config` 経由で実現)
- **既存 `internal/config/config.go` の関数変更**(`Load()` / `Default()` / `validate()` を変更しない)
- **既存テスト(`internal/config/config_test.go` 7 ケース)の変更**
- **設計書本体(REQ-001 / DES-001〜DES-006)の改訂** — 現時点で改訂事項は想定なし(CHANGE 通知書起票見込みなし、M6-overview §9)

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド(config ドメイン 3 層、新設)

- `internal/api/config/handler.go`(新規) — HTTP レイヤー、リクエスト/レスポンス JSON 変換、エラー応答
- `internal/api/config/routes.go`(新規) — Echo ルーター登録関数 `RegisterRoutes(g *echo.Group, h *Handler)`
- `internal/service/config/service.go`(新規) — ビジネスロジック、`*config.Config` の読み書き、`config.toml` ファイル操作、バリデーション呼出

#### モデル定義(既存パッケージへの追加または新設、Plan Mode で確定)

- `internal/api/config/dto.go`(新規推奨) — リクエスト/レスポンス DTO 型(`ConfigResponse` / `UpdateConfigRequest`)

**注**: DTO を `internal/api/config/handler.go` 内に同居させるか、`dto.go` に分離するかは Plan Mode で確定する。既存ハンドラ(combo / preset / move 等)の慣例に揃える(M6-RESEARCH-01 では確認外、§3.4.3 で確認)。

#### テスト(新規)

- `internal/api/config/handler_test.go`(新規) — ハンドラ層テスト(httptest 使用、CLAUDE.md §5)
- `internal/service/config/service_test.go`(新規) — サービス層テスト(CLAUDE.md §5)

### 2.2 修正するファイル

#### バックエンド(既存ファイル)

- `cmd/combomgr/main.go` — `confighandler.RegisterRoutes(apiGroup, configHandler)` を既存のルーター登録群(150〜168 行付近、M6-RESEARCH-01 §4.1 (c) 確認済み)に 1 行追加。DI 配線で `*config.Config` を `configService` → `configHandler` に渡す処理を追加

### 2.3 変更しないもの(原則)

- `internal/config/config.go`(既存): `Default()` / `Load()` / `validate()` / Config 構造体定義はすべて変更しない
- `internal/config/config_test.go`(既存 7 テストケース)はすべて変更しない
- `cmd/combomgr/main.go` の `determineBindAddr()`(行 176-185)・`buildAllowedOrigins()`(行付近)・`e.Start(bindAddr)` 起動行(行 170)はすべて変更しない
- `cmd/combomgr/main.go` の既存ルーター登録 7 行(combohandler / presethandler / movehandler / taghandler / charhandler / setuphandler / debughandler)はすべて変更しない
- 設計書本体(REQ-001 / DES-001〜DES-006)
- SUPP-001 / playbook / architecture-patterns.md / handover
- 他ドメインのハンドラ・サービス・リポジトリ(combo / preset / move / tag / character / setup / debug)

### 2.4 例外条項

以下は本指示書スコープ内で実施を **許容** する例外:

- (a) **`internal/api/config/doc.go` のコメント更新**: 既存ファイル(M6-RESEARCH-01 §4.1 (d) で確認済み)の「M6 で実装」コメントを、本 M6-01 完了時に「M6-01 で実装済み(YYYY-MM-DD)」へ更新する程度の修正は許容。ただし `package config` 宣言行は変更しない
- (b) **新規 DTO 型のフィールド設計**: ConfigResponse / UpdateConfigRequest の具体的なフィールド構成は §4.2 で確定範囲を指示するが、JSON タグ命名(camelCase)・ポインタ型適用(SUPP-001 §5.9 PATCH 系省略可能フィールド方針)等の細部は製造担当の実装裁量範囲で決定可能(指示書 §4.2 のサンプルから逸脱する場合は理由を完了報告に明記)
- (c) **エラーコード文字列の新規追加**: `model.APIError.Code` 用の文字列定数(例: `"invalid_config"`、`"config_write_failed"` 等)を新規に追加することは許容。命名は **小文字スネークケース**(M3-05 / M4-01 setup 系統一済み、handover §4.1 L-02 で他ドメインは未対応)に従う

許容しないもの(再掲、§2.3 参照):

- 既存 `internal/config/config.go` / `cmd/combomgr/main.go` の LAN バインド系処理への変更
- 設計書本体への変更
- 新規 CHANGE 通知書の起票(M6-01 スコープ内では起票見込みなし、必要発生時は Plan Mode 停止 → 開発者協議)

---

## 3. 前提条件

### 3.1 必読ドキュメント

| ID / ファイル | 関連箇所 |
|--------------|---------|
| DES-002 v1.8.0(`docs/design/02-architecture.md`) | §4.1 API スタイル、§4.2 主要エンドポイント表(`GET /api/config` / `PUT /api/config` 行)、§4.3 エラーハンドリング(`model.APIErrorResponse` 共通型)、§4.4 CORS・CSRF |
| SUPP-001 v1.13.0(`docs/design/supp-001-detailed-design.md`) | §4.2 LAN 共有バインドロジック先行実装、§5.8 設定ファイルフォーマット(TOML、設定ファイル例)、§5.9 PATCH 系省略可能フィールド送信ポリシー |
| architecture-patterns.md v1.0.3 | §2 バックエンドの 3 層パターン、§3 エラーレスポンス共通型(CHANGE-010 / CHANGE-011) |
| CLAUDE.md | §2 技術スタック(`github.com/BurntSushi/toml` 採用)、§3 ディレクトリ構成、§4 規約、§5 テスト規約、§10 禁止事項 |
| M6-RESEARCH-01 調査レポート(2026-05-23) | §4.1 設定 API 未実装の状態確認、§4.2 既存 Config 構造体全フィールド、§4.3 既存サーバー起動コード、§4.5 関連設計書記述と実装の乖離 |
| M6-overview v1.0.0 | §1.3 このマイルストーンで作らないもの、§2.2 設定 API のスコープ、§2.7 初回起動ウィザードの判定方法、§4.2 M6-01 概要 |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 用途 |
|--------------|------|
| `internal/api/setup/handler.go`(M4-01 で実装) | 直近の新規ハンドラ実装パターン参照(エラーレスポンス・JSON バインド・echo Context 取り扱い) |
| `internal/api/character/handler.go`(M3-04 で実装) | 軽量 BE 実装の参照例(read-only API + 単一サービス層) |
| `internal/service/setup/service.go`(M4-01 で実装) | サービス層 3 層パターン + トランザクション境界の参照例 |
| `internal/config/config_test.go` | 既存テストの命名規則・テストデータ作成パターン参照 |

### 3.3 参照不要

- `internal/repository/` 配下(本 M6-01 では DB アクセスを使わない、`config.toml` ファイル I/O のみ)
- フロントエンド全般(`web/` 配下、M6-02 で対応)
- マイグレーション関連(`internal/infra/migration/`、本 M6-01 では DB マイグレーション追加なし)
- M1〜M5 の指示書本体(必要箇所は本指示書で要約済み)

### 3.4 着手前の確認(製造担当 Plan Mode で実施、結果を計画提示に含める)

製造担当 Claude Code は §4 着手前に、以下を `view` で実コード確認し、Plan Mode の計画提示に **結果を含める**。M4 期間 9 件・M5 期間で再発防止に成功した「実コード確認の省略」(handover §6.3 構造的アンチパターン)を本指示書でも厳格に防ぐ。

#### 3.4.1 既存 `internal/config/config.go` 全体の view 確認

`view internal/config/config.go` で以下を確認:

- [ ] `Default()` 関数のシグネチャと戻り値型(`*Config`)
- [ ] `Load(path string) (*Config, error)` のシグネチャと、ファイル不在時の挙動(M6-RESEARCH-01 §4.2 (a) で「Default() 返却」確認済み、コード行レベルで再確認)
- [ ] `validate()` の中身(Server.Mode は `"local"` / `"lan"` のみ許容、Server.Port のバリデーション内容)
- [ ] Config 構造体の **すべてのフィールド** の TOML タグと JSON タグ(JSON タグが既に付与されているか、未付与なら本 M6-01 で追加する必要があるかを判断)

#### 3.4.2 既存 `cmd/combomgr/main.go` のルーター登録周辺の view 確認

`view cmd/combomgr/main.go` で以下を確認:

- [ ] 150〜168 行付近の `<XXXhandler>.RegisterRoutes(apiGroup, <XXX>Handler)` パターン(M6-RESEARCH-01 §4.1 (c) で確認済み、追加場所の位置と既存パターンの整合確認)
- [ ] DI 配線の現状: `*config.Config` がどう作成されて(`config.Load(configPath)` の戻り値受取)、どの変数(`cfg`)で保持されているか
- [ ] `confighandler` パッケージ(import エイリアスの想定)が既に import 済みかを確認(`internal/api/config/doc.go` のみのため未 import の可能性が高い)
- [ ] `determineBindAddr` / `buildAllowedOrigins` の呼出箇所(128 / 130 行付近)— これらは **変更しない**(本 §3.4.2 では位置確認のみ)

#### 3.4.3 既存 BE ハンドラの DTO ファイル配置パターン確認

以下を `view` または `ls` で確認:

- [ ] `internal/api/combo/`、`internal/api/setup/`、`internal/api/character/`、`internal/api/preset/` の各パッケージで、DTO 型が `handler.go` 内に同居しているか、`dto.go` 別ファイルに分離されているかを確認
- [ ] 既存パターンに合わせて M6-01 の DTO 配置を決定(本指示書 §2.1 では `dto.go` 分離を「推奨」としているが、実態に揃える)

#### 3.4.4 共通エラー型 `model.APIError` / `model.APIErrorResponse` の現状確認

- [ ] `view internal/model/api_error.go` で型定義を確認(架空のフィールド名を書かない)
- [ ] バリデーションエラー時の `Details` 構造(`map[string]any{"validations": result}` 形式、DES-002 §4.3.1 / architecture-patterns.md §3)を確認

#### 3.4.5 既存テスト命名規則の確認

`internal/config/config_test.go` および `internal/api/setup/handler_test.go`(または相当ファイル)を `view` で開き、テスト関数の命名規則(`TestLoad_ValidFile` のような `Test<Function>_<Scenario>` 形式)を確認。本 M6-01 で追加するテスト関数も同じ規則に揃える。

#### 3.4.6 SUPP-001 §5.9 PATCH 系省略可能フィールド送信ポリシーの確認

本 M6-01 は `PUT /api/config`(全件更新)であり PATCH ではないが、Update 系リクエスト DTO で **部分更新を許容するか全件必須とするか** の方針を SUPP-001 §5.9 を参照しつつ Plan Mode で確定する(§3.4.7 必須項目 2 と関連)。

#### 3.4.7 Plan Mode で開発者協議が必要な必須項目(計画提示に必ず含める)

製造担当は Plan Mode で計画提示時に **以下 5 項目すべての方針** を開発者に提示し、判断を仰ぐ:

1. **`isInitialized` フィールドの判定ロジック実装位置**: サービス層(`internal/service/config/service.go` で `os.Stat(configPath)` を呼ぶ)とハンドラ層のどちらに置くか。**設計担当の推奨はサービス層**(ハンドラ層はリクエスト/レスポンス変換に専念、3 層パターン踏襲)。製造担当の見解を提示し開発者判断を仰ぐ
2. **`PUT /api/config` のバリデーション失敗時の挙動**: 全件失敗(原子性重視)か、部分更新可否(失敗フィールドのみエラー、他は更新)か。**設計担当の推奨は全件失敗 + 422 Unprocessable Entity 返却 + `model.APIErrorResponse` の `details.validations.issues` 構造**(architecture-patterns.md §3 / DES-002 §4.3.1)。`config.toml` への書き戻しを原子的に保つため、検証失敗時は書き戻し前に中断する
3. **`config.toml` 書き戻しのアトミック性確保**: 一時ファイル(`config.toml.tmp`)書き込み → `os.Rename()` でアトミックに置換するパターンを採用するか、`os.WriteFile` で直接書く(クラッシュ時に破損リスク許容)か。**設計担当の推奨は一時ファイル + `os.Rename()` 方式**(`PUT` 中のプロセスクラッシュ時の `config.toml` 破損を防ぐ、技術的に容易)
4. **メモリ上の `*config.Config` の DI 方針**: アプリ起動時の `cfg` 変数(`main.go` の `cfg *config.Config`)を、`PUT /api/config` で書き換えるためにどう Echo ハンドラへ渡すか。候補: (a) ポインタを直接渡す + `sync.Mutex` でハンドラ層保護、(b) サービス層に状態保持(`type Service struct { mu sync.Mutex; cfg *config.Config }` のように包む)、(c) `atomic.Pointer[config.Config]` を使う。**設計担当の推奨は (b)**(サービス層が状態を保持し、ハンドラはサービスのメソッド呼出のみ、3 層パターン踏襲)
5. **`PUT /api/config` の API スタイル**: 全件 PUT(クライアントが全フィールドを送信、サーバーは丸ごと置換)とするか、部分 PUT(SUPP-001 §5.9 PATCH 風、`*T` ポインタで未指定フィールドは変更なし)とするか。**設計担当の推奨は部分 PUT(SUPP-001 §5.9 ポリシー踏襲)**: 設定画面で 1 フィールドだけ変更するケースに対応しやすく、初回ウィザードで全件送信するケースにも対応できる(クライアントが全フィールド送信すれば事実上全件置換)。HTTP メソッドは `PUT` 維持(DES-002 §4.2 既定義に従う)

#### 3.4.8 §4 着手の前提条件

§3.4.1〜§3.4.7 すべての確認結果を Plan Mode の計画提示に含めること。未確認のまま §4 詳細仕様の実装に着手しないこと(handover §6.3「実コード確認の省略」防止)。

---

## 4. 詳細仕様

### 4.1 config ドメイン全体構成

architecture-patterns.md §2 の 3 層パターンに従う:

```
internal/api/config/
  ├ doc.go         (既存、コメント更新のみ許容)
  ├ handler.go     (新規) HTTP レイヤー
  ├ routes.go      (新規) Echo ルーター登録
  └ dto.go         (新規推奨、§3.4.3 結果次第) リクエスト/レスポンス DTO

internal/service/config/
  └ service.go     (新規) ビジネスロジック、*config.Config 状態保持、TOML 書き戻し

internal/config/    (既存、変更なし)
  ├ config.go     (既存、変更しない) Config 構造体 + Load() / Default() / validate()
  └ config_test.go (既存、変更しない)
```

**重要**: `internal/config/` パッケージは設定 **ファイル読込・パース** を担い、`internal/service/config/` は設定 **API としてのビジネスロジック**(状態保持、書き戻し、`isInitialized` 判定)を担う。両者は明確に責務分離する。

### 4.2 API エンドポイント設計

#### 4.2.1 `GET /api/config`(設定取得)

**機能**: 現在メモリ上にある `*config.Config` の値 + `isInitialized: bool` フィールドを JSON で返す。

**レスポンス DTO**(`ConfigResponse`、推奨形式、§3.4.7 必須項目 1 / 5 の Plan Mode 判断結果に依存):

```json
{
  "server": {
    "mode": "local",
    "port": 47318
  },
  "database": {
    "path": ""
  },
  "logging": {
    "level": "info",
    "file": "logs/combomgr.log",
    "maxSizeMb": 10,
    "maxBackups": 5,
    "maxAgeDays": 30
  },
  "security": {
    "passwordEnabled": false
  },
  "isInitialized": false
}
```

**JSON タグ命名規約**:

- 構造体フィールド名(Go)は PascalCase(`MaxSizeMB`)
- JSON タグは camelCase(`maxSizeMb`、CLAUDE.md §4 規約)
- TOML タグは snake_case(`max_size_mb`、SUPP-001 §5.8 既定)
- 各タグは既存 `internal/config/config.go` の TOML タグ実態を保ちつつ、レスポンス DTO 側でのみ JSON タグ camelCase を付与する。**`internal/config/config.go` の Config 構造体に JSON タグを追加する変更は避ける**(M6-RESEARCH-01 §4.2 (c) で JSON タグの現状を §3.4.1 で確認、未付与の可能性大、未付与なら DTO 側で別途定義)

**機微情報除外規約**(本指示書で確立):

- レスポンス DTO に **将来追加される機微情報フィールド**(例: `SecurityConfig.PasswordHash`(将来追加予定))は **JSON タグ `-` で除外** する
- 現状の Config 構造体には機微情報フィールドは存在しない(M6-RESEARCH-01 §4.2 (c) で全フィールド確認済み)が、将来追加時の規約として `internal/api/config/dto.go` の冒頭コメントに明記する

**`isInitialized` 判定ロジック**(§3.4.7 必須項目 1 で確定):

- サービス層で `os.Stat(configPath)` を呼び、ファイル存在なら `true`、ファイル不在(`os.IsNotExist(err)`)なら `false`
- 他のエラー(権限エラー等)は `false` を返すか、ハンドラ層にエラー伝搬してエラー応答するかを Plan Mode で確定

**エラー応答**:

- 500 Internal Server Error: サービス層からの読込エラー(`config.toml` 読込中の I/O エラー等、通常発生しない、ファイル不在は `isInitialized: false` で正常応答)

**ステータスコード**: 200 OK

#### 4.2.2 `PUT /api/config`(設定更新、部分更新可)

**機能**: リクエストボディの設定値で `*config.Config` を更新し、`config.toml` に書き戻す。

**リクエスト DTO**(`UpdateConfigRequest`、SUPP-001 §5.9 PATCH 系省略可能フィールド方針踏襲):

```json
{
  "server": {
    "mode": "lan",
    "port": 47318
  },
  "logging": {
    "level": "debug"
  }
}
```

- 各フィールドはポインタ型(`*ServerUpdate`、`*int`、`*string` 等)で受け取り、JSON に含まれないフィールドは変更なし(SUPP-001 §5.9 ポリシー)
- 値あり = 指定値で更新
- ゼロ値ポインタ(空文字、0 等)の解釈は **フィールドごとに明示**(SUPP-001 §5.9.1)。本 M6-01 では原則「ゼロ値も明示的に上書き」と解釈する(`port: 0` は不正値だがバリデーションで弾く)
- `isInitialized` フィールドは **リクエストでは受け付けない**(Read-only、サーバー側でのみ算出)

**処理フロー**:

1. リクエストボディを `UpdateConfigRequest` にバインド
2. サービス層に渡し、現在の `*config.Config` のコピーに対して、リクエストで指定されたフィールドを上書き
3. 上書き後の `*config.Config` を `internal/config/config.go` の既存 `validate()` 関数に通すか、独自バリデーションを行う(Plan Mode で確定、既存 `validate()` は非エクスポート関数のため呼出には export 化が必要だがそれは「既存ファイル変更」になる。**推奨: サービス層に同等のバリデーションロジックを書く**)
4. バリデーション失敗時 → 422 Unprocessable Entity + `details.validations.issues` 構造(architecture-patterns.md §3)で応答、`config.toml` 書き戻しは行わない
5. バリデーション成功時 → 一時ファイル(`config.toml.tmp`)に TOML エンコード書き込み → `os.Rename(tmpPath, configPath)` でアトミック置換
6. メモリ上の `*config.Config` を更新(`sync.Mutex` 保護、§3.4.7 必須項目 4)
7. 200 OK + 更新後の `ConfigResponse` を返す

**レスポンス DTO**: `ConfigResponse`(§4.2.1 と同一形式)

**エラー応答**:

| HTTP ステータス | エラーコード(`code`) | 発生条件 |
|---------------|-----------------|---------|
| 400 Bad Request | `"invalid_request"` | JSON パース失敗、リクエストボディの型不正 |
| 422 Unprocessable Entity | `"validation_failed"` | バリデーション失敗(mode が `"local"` / `"lan"` 以外、port が範囲外 等) |
| 500 Internal Server Error | `"config_write_failed"` | TOML エンコード失敗、ファイル書き込み失敗、`os.Rename` 失敗等 |

**ステータスコード**: 200 OK(成功時)

**LAN モード変更時の挙動について**(設計担当注): `PUT /api/config` で `server.mode` を `"local"` → `"lan"` に変更した場合でも、本 M6-01 ではアプリ再起動なしでは `e.Start(bindAddr)` のバインドアドレスは変わらない(SUPP-001 §4.2「`config.toml` を直接編集してアプリ再起動」運用方針)。本 M6-01 ではこの挙動を温存し、API ドキュメント(コメント)に「mode 変更はアプリ再起動後に有効になります」と明記する。再起動を要求する `restart_required` フラグをレスポンスに含めるかは Plan Mode で確定(設計担当の推奨: 含める、`"isInitialized": false, "restartRequired": true` のように)。

> **設計判断補足(Plan Mode 必須項目 6 として追加)**: `restart_required: bool` フィールドを ConfigResponse に含めるか否か、含める場合の判定ロジック(mode 変更があった場合のみ true)を Plan Mode で開発者協議。

### 4.3 サービス層実装

#### 4.3.1 サービス層関数シグネチャ(推奨、Plan Mode で確定)

```go
// internal/service/config/service.go
package config

import (
    "os"
    "sync"

    appconfig "github.com/<org>/<repo>/internal/config" // 既存パッケージ
)

type Service struct {
    mu         sync.Mutex
    cfg        *appconfig.Config // メモリ上の現在の設定
    configPath string            // "config.toml" 等
}

func NewService(cfg *appconfig.Config, configPath string) *Service {
    return &Service{cfg: cfg, configPath: configPath}
}

// 現在の設定 + isInitialized を返す
func (s *Service) Get() (cfg *appconfig.Config, isInitialized bool, err error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    cfgCopy := *s.cfg // 値コピー(ハンドラ側でレスポンス DTO 変換時の保護)
    initialized := fileExists(s.configPath)
    return &cfgCopy, initialized, nil
}

// 設定を更新し、config.toml に書き戻す
func (s *Service) Update(req UpdateRequest) (updated *appconfig.Config, validationErrs []ValidationIssue, restartRequired bool, err error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 1. 現在の cfg をコピー
    next := *s.cfg

    // 2. req のフィールドを next に上書き(部分更新)
    //    req.Server != nil なら server を上書き、等

    // 3. バリデーション
    issues := validateConfig(&next)
    if len(issues) > 0 {
        return nil, issues, false, nil
    }

    // 4. mode 変更を検知(restart_required 判定)
    restart := s.cfg.Server.Mode != next.Server.Mode

    // 5. config.toml に書き戻し(アトミック)
    if err := writeAtomic(s.configPath, &next); err != nil {
        return nil, nil, false, err
    }

    // 6. メモリ上の cfg を更新
    *s.cfg = next

    return &next, nil, restart, nil
}
```

**ポイント**:

- `sync.Mutex` で並行アクセス保護(M6-01 では並行アクセス可能性は低いが、念のため)
- `Get()` は値コピーを返し、ハンドラ層で DTO 変換中の不整合を防ぐ
- `Update()` は内部で部分更新ロジックを実装
- TOML 書き戻しは別関数 `writeAtomic` に切り出し

#### 4.3.2 `writeAtomic` 関数(アトミック書き戻し、§3.4.7 必須項目 3)

```go
func writeAtomic(path string, cfg *appconfig.Config) error {
    tmpPath := path + ".tmp"

    f, err := os.Create(tmpPath)
    if err != nil {
        return fmt.Errorf("config: create tmp: %w", err)
    }
    defer f.Close()

    if err := toml.NewEncoder(f).Encode(cfg); err != nil {
        os.Remove(tmpPath)
        return fmt.Errorf("config: encode: %w", err)
    }

    if err := f.Sync(); err != nil {
        os.Remove(tmpPath)
        return fmt.Errorf("config: sync tmp: %w", err)
    }

    if err := os.Rename(tmpPath, path); err != nil {
        os.Remove(tmpPath)
        return fmt.Errorf("config: rename: %w", err)
    }

    return nil
}
```

**ポイント**:

- 一時ファイルに書く → fsync → リネーム の順
- 失敗時は一時ファイル削除
- `os.Rename()` は同一ファイルシステム内ではアトミック

#### 4.3.3 `validateConfig` 関数(サービス層、§3.4.7 必須項目 2)

既存 `internal/config/config.go:validate()` は非エクスポート関数のため、本サービス層に同等のバリデーションロジックを書く。検証内容は **既存実装と同一**:

```go
func validateConfig(cfg *appconfig.Config) []ValidationIssue {
    var issues []ValidationIssue

    switch cfg.Server.Mode {
    case "local", "lan":
        // ok
    default:
        issues = append(issues, ValidationIssue{
            Field:   "server.mode",
            Message: fmt.Sprintf("invalid server.mode %q (want \"local\" or \"lan\")", cfg.Server.Mode),
        })
    }

    if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
        issues = append(issues, ValidationIssue{
            Field:   "server.port",
            Message: fmt.Sprintf("invalid server.port %d (want 1-65535)", cfg.Server.Port),
        })
    }

    // 他のフィールドのバリデーション(必要なら追加、Plan Mode で確定)

    return issues
}
```

**重要**: 既存 `internal/config/config.go:validate()` を変更してエクスポート化することは行わない(§2.3「変更しないもの」)。本サービス層に独立した同等ロジックを書く。

将来 `internal/config/config.go:validate()` のロジックが変わった際に二重メンテになるリスクはあるが、本 M6-01 では「既存実装の温存」を優先する。L-02 / L-03 のような恒久統一は M7+ で別途検討(必要なら m6-to-m7-handover に持ち越し記録)。

### 4.4 ハンドラ層実装

#### 4.4.1 ハンドラ層の共通方針(architecture-patterns.md §3)

- エラーレスポンスは **必ず `model.APIErrorResponse` 共通型を使う**(独自エラー型を新設しない)
- `echo.Context.JSON(http.Status..., model.APIErrorResponse{Error: model.APIError{...}})` を直接書くパターンを採用(ハンドラ独自ヘルパを増やさない、handover §4.2 L-03 整合)
- バリデーションエラーは `Details: map[string]any{"validations": result}` 形式(DES-002 §4.3.1 / architecture-patterns.md §3)

#### 4.4.2 ハンドラ関数シグネチャ

```go
// internal/api/config/handler.go
package config

import (
    "net/http"

    "github.com/labstack/echo/v4"
    "github.com/<org>/<repo>/internal/model"
    configsvc "github.com/<org>/<repo>/internal/service/config"
)

type Handler struct {
    svc *configsvc.Service
}

func NewHandler(svc *configsvc.Service) *Handler {
    return &Handler{svc: svc}
}

// GET /api/config
func (h *Handler) Get(c echo.Context) error {
    cfg, isInitialized, err := h.svc.Get()
    if err != nil {
        return c.JSON(http.StatusInternalServerError, model.APIErrorResponse{
            Error: model.APIError{
                Code:    "config_read_failed",
                Message: "failed to read config",
            },
        })
    }
    return c.JSON(http.StatusOK, toConfigResponse(cfg, isInitialized, false))
}

// PUT /api/config
func (h *Handler) Update(c echo.Context) error {
    var req UpdateConfigRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
            Error: model.APIError{
                Code:    "invalid_request",
                Message: "invalid JSON body",
            },
        })
    }

    updated, issues, restart, err := h.svc.Update(req.ToServiceRequest())
    if err != nil {
        return c.JSON(http.StatusInternalServerError, model.APIErrorResponse{
            Error: model.APIError{
                Code:    "config_write_failed",
                Message: "failed to write config.toml",
            },
        })
    }
    if len(issues) > 0 {
        return c.JSON(http.StatusUnprocessableEntity, model.APIErrorResponse{
            Error: model.APIError{
                Code:    "validation_failed",
                Message: "configuration validation failed",
                Details: map[string]any{
                    "validations": map[string]any{
                        "issues": toIssueMaps(issues),
                    },
                },
            },
        })
    }

    isInitialized := true // PUT 成功後は必ず config.toml が存在する
    return c.JSON(http.StatusOK, toConfigResponse(updated, isInitialized, restart))
}
```

**注**: 上記コード例は **指示の補助**(参考実装)であり、製造担当は M4-01 / M3-04 / M3-05 で確立した既存パターンと整合させて実装する。コード例の細部(変数名、関数名、import エイリアス等)は実装裁量範囲。

#### 4.4.3 ルーター登録(`routes.go`)

```go
// internal/api/config/routes.go
package config

import "github.com/labstack/echo/v4"

func RegisterRoutes(g *echo.Group, h *Handler) {
    g.GET("/config", h.Get)
    g.PUT("/config", h.Update)
}
```

`cmd/combomgr/main.go` 側で:

```go
configService := configsvc.NewService(cfg, configPath)
configHandler := confighandler.NewHandler(configService)
confighandler.RegisterRoutes(apiGroup, configHandler)
```

を既存ルーター登録群の末尾(debughandler の前後、配置順は実態の慣例に揃える)に追加。

### 4.5 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠・備考 |
|------|---------|----------|
| LAN バインドロジック | 既存 M1 実装を変更しない | M6-RESEARCH-01 §4.3、M6-overview §2.1 |
| 認証 | M6-01 では実装しない | SUPP-001 §4.2、CLAUDE.md §10 |
| `isInitialized` 判定 | `os.Stat(configPath)` でファイル存在確認、サービス層に置く | M6-overview §2.7、本指示書 §3.4.7 必須項目 1 推奨 |
| `PUT` のスタイル | 部分更新(`*T` ポインタ型、SUPP-001 §5.9 ポリシー) | 本指示書 §3.4.7 必須項目 5 推奨 |
| バリデーション失敗時の挙動 | 全件失敗 + 422 + `details.validations.issues` 構造 | architecture-patterns.md §3、本指示書 §3.4.7 必須項目 2 推奨 |
| `config.toml` 書き戻し | アトミック(一時ファイル + `os.Rename`) | 本指示書 §3.4.7 必須項目 3 推奨 |
| メモリ上 `*config.Config` の状態保持 | サービス層に `sync.Mutex` で保護して保持 | 本指示書 §3.4.7 必須項目 4 推奨 |
| `restart_required` フィールド | レスポンス DTO に含める(mode 変更検知時のみ true) | 本指示書 §3.4.7 必須項目 6 推奨 |
| エラーコード文字列の命名 | 小文字スネークケース(`invalid_request` / `validation_failed` / `config_write_failed` 等) | M4-01 setup 系統一済み、handover §4.1 L-02 |
| ハンドラ独自ヘルパ | 新設しない、`c.JSON` 直接呼出 | architecture-patterns.md §3、handover §4.2 L-03 |
| 既存 `internal/config/config.go` の変更 | しない(`validate()` 非エクスポートのままサービス層に同等ロジックを書く) | 本指示書 §4.3.3、既存挙動温存 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 サービス層テスト(必須、CLAUDE.md §5)

`internal/service/config/service_test.go`(新規)に以下を含む:

- [ ] **TestService_Get_Initialized**: `config.toml` が存在する状態で `Get()` を呼び、`isInitialized: true` + cfg の値が正しく返ることを確認
- [ ] **TestService_Get_NotInitialized**: `config.toml` が存在しない状態で `Get()` を呼び、`isInitialized: false` が返ることを確認(`t.TempDir()` で一時ディレクトリを作って `configPath` を未存在ファイルに指定)
- [ ] **TestService_Update_Success**: `Update()` で部分更新リクエストを送り、メモリ上の cfg と `config.toml` の両方が更新されることを確認
- [ ] **TestService_Update_ValidationFailure**: 不正な mode(`"invalid"`)で `Update()` を呼び、`validationErrs` が返ること + `config.toml` が変更されていないこと(原子性確認)を確認
- [ ] **TestService_Update_RestartRequired**: mode を `"local"` → `"lan"` に変更し、`restartRequired: true` が返ることを確認
- [ ] **TestService_Update_AtomicWrite**: 書き戻し中の一時ファイル `.tmp` が成功時に削除されていること(`os.Rename` 後は元の `.tmp` が存在しない)を確認
- [ ] **TestService_Update_PartialUpdate**: `server.mode` のみ送って `server.port` を送らないリクエストで、port が変更されないことを確認(SUPP-001 §5.9 ポリシー)

#### 5.1.2 ハンドラ層テスト(必須、httptest 使用、CLAUDE.md §5)

`internal/api/config/handler_test.go`(新規)に以下を含む:

- [ ] **TestHandler_Get_Success**: モックサービスを差し込み、200 OK + `ConfigResponse` の JSON 構造が正しいことを確認
- [ ] **TestHandler_Get_InternalError**: サービス層がエラーを返した場合、500 + `model.APIErrorResponse` 構造を返すことを確認
- [ ] **TestHandler_Update_Success**: 正常なリクエストで 200 OK + 更新後のレスポンスを返すことを確認
- [ ] **TestHandler_Update_InvalidJSON**: 不正な JSON ボディで 400 Bad Request + `code: "invalid_request"` を返すことを確認
- [ ] **TestHandler_Update_ValidationFailure**: バリデーション失敗で 422 Unprocessable Entity + `code: "validation_failed"` + `details.validations.issues` 配列を返すことを確認
- [ ] **TestHandler_Update_WriteFailure**: サービス層が書き込みエラーを返した場合、500 + `code: "config_write_failed"` を返すことを確認

#### 5.1.3 既存テストの回帰確認(必須)

- [ ] `internal/config/config_test.go` の既存 7 テストケースが **すべて通過** することを確認(本 M6-01 では変更しないが、`internal/config/config.go` を間接的に呼ぶため念のため確認)
- [ ] `internal/api/setup/handler_test.go` 等の既存ハンドラテストが回帰していないことを確認
- [ ] `go test ./...` 全件通過

#### 5.1.4 ビルド・型チェック

- [ ] `go build ./...` 成功
- [ ] `go vet ./...` でエラーなし
- [ ] `gofmt -l` で未整形ファイルなし

### 5.2 E2E シナリオ(curl 検証、開発者の責任範囲)

製造担当は以下の curl コマンドを完了報告に含め、開発者が実機検証する。

#### A. 正常系: 初期状態(`config.toml` 不在)での `GET /api/config`

```bash
# config.toml を削除(または初回起動状態をエミュレート)
rm -f config.toml

# サーバー起動後
curl -s http://localhost:47318/api/config | jq .
```

期待結果: `"isInitialized": false` + デフォルト値(`mode: "local"`, `port: 47318` 等)が返る

#### B. 正常系: `PUT /api/config` で部分更新

```bash
curl -s -X PUT http://localhost:47318/api/config \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"logging":{"level":"debug"}}' | jq .
```

期待結果: 200 OK + `logging.level` が `"debug"` に変わる + `config.toml` ファイルが新規作成されている + 他フィールドは変更されていない

#### C. 異常系: バリデーション失敗

```bash
curl -s -X PUT http://localhost:47318/api/config \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"server":{"mode":"invalid"}}' | jq .
```

期待結果: 422 Unprocessable Entity + `code: "validation_failed"` + `details.validations.issues[].field: "server.mode"` を含む

#### D. 異常系: 不正な JSON

```bash
curl -s -X PUT http://localhost:47318/api/config \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d 'not a json' | jq .
```

期待結果: 400 Bad Request + `code: "invalid_request"`

#### E. 正常系: mode 変更 → `restart_required: true` 検証

```bash
curl -s -X PUT http://localhost:47318/api/config \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"server":{"mode":"lan"}}' | jq .
```

期待結果: 200 OK + `restartRequired: true` + `config.toml` の `[server].mode` が `"lan"` に書き換わっている。**ただしアプリ再起動なしではバインドアドレスは変わらない**(既存挙動温存)。

#### F. アトミック性確認(任意、開発者の手動確認)

`PUT /api/config` 実行中(複数回連続実行)に `config.toml.tmp` が一時的にも残らないことを確認(成功時には `.tmp` は存在しない)。

#### G. 既存機能の回帰確認

```bash
# M1〜M5 の主要 API が動作していること
curl -s http://localhost:47318/api/characters | jq '.[0:2]'
curl -s http://localhost:47318/api/combos | jq '.[0:2]'
curl -s http://localhost:47318/api/setups | jq '.[0:2]'  # M4-01 由来
```

期待結果: 既存 API が回帰していない(M6-01 の追加で破壊されていない)

---

## 6. レビュー観点(別ファイル参照)

機械レビュー観点は別ファイル `M6-01-review-checklist.md`(v1.0.0、設計担当作成)を参照する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] `internal/api/config/handler.go` / `routes.go` / `dto.go`(または handler.go 内同居)が新設されている
- [ ] `internal/service/config/service.go` が新設されている
- [ ] `internal/api/config/doc.go` のコメントが M6-01 完了状態に更新されている(例外条項 (a))
- [ ] `cmd/combomgr/main.go` に `confighandler.RegisterRoutes(apiGroup, configHandler)` の 1 行が追加され、DI 配線が正しく行われている
- [ ] `GET /api/config` が動作し、`ConfigResponse` 形式(`isInitialized` 含む)で 200 OK を返す
- [ ] `PUT /api/config` が動作し、部分更新 + `config.toml` 書き戻し + メモリ更新を行う
- [ ] バリデーション失敗時に 422 + `details.validations.issues` 構造を返す
- [ ] エラーレスポンスがすべて `model.APIErrorResponse` 共通型を使用している(独自エラー型なし)
- [ ] `config.toml` 書き戻しがアトミック(一時ファイル + `os.Rename`)である
- [ ] mode 変更時に `restartRequired: true` がレスポンスに含まれる

### 7.2 自己テスト結果(製造担当の責任範囲)

- [ ] §5.1.1 サービス層テスト 7 件すべて通過
- [ ] §5.1.2 ハンドラ層テスト 6 件すべて通過
- [ ] §5.1.3 既存テスト回帰なし(`go test ./...` 全件通過)
- [ ] §5.1.4 ビルド・型チェック通過(`go build ./...` / `go vet ./...` / `gofmt -l`)

### 7.3 品質チェック

- [ ] `internal/config/config.go` を変更していない(M6-RESEARCH-01 §4.2 で確認した既存実装の温存)
- [ ] `internal/config/config_test.go` の既存 7 ケースを変更していない
- [ ] `cmd/combomgr/main.go:determineBindAddr()` / `buildAllowedOrigins()` / `e.Start(bindAddr)` を変更していない
- [ ] 設計書本体(REQ-001 / DES-001〜DES-006)を変更していない
- [ ] エラーコード文字列が小文字スネークケース統一(M4-01 setup 系踏襲)
- [ ] ハンドラ独自エラーヘルパを新設していない(`c.JSON` 直接呼出)
- [ ] `architecture-patterns.md` §2 3 層パターン遵守
- [ ] `architecture-patterns.md` §3 エラーレスポンス共通型遵守
- [ ] CLAUDE.md §4 規約遵守(JSON タグ camelCase、TOML タグ snake_case、Go フィールド PascalCase)
- [ ] CLAUDE.md §10 禁止事項に抵触なし

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M6-01 完了報告が追記されている
- [ ] §3.4 着手前確認の結果が完了報告に含まれている
- [ ] §3.4.7 Plan Mode 必須項目 5(+ 6)の開発者承認結果が完了報告に含まれている
- [ ] §4.5 設計判断事項表との整合確認(逸脱が発生した場合は理由を明記)
- [ ] §5.2 E2E シナリオ A〜G の curl 実行結果が完了報告に含まれている(製造担当の curl 検証 + 開発者の実機検証)

### 7.5 完了報告

開発者と機械レビュー担当へ以下を伝える:

- 実装ファイル一覧(新規 + 修正)
- 自己テスト結果(サービス層 7 件 + ハンドラ層 6 件 + 既存回帰)
- §5.2 E2E シナリオ実行結果
- §3.4.7 Plan Mode 必須項目の開発者承認結果(議事録的に)
- 例外条項適用箇所(§2.4 (a) (b) (c))の明示
- M5-RESEARCH-01 / M6-RESEARCH-01 で確立した「製造担当からの実装完了後連絡事項」歓迎運用(handover §6.2)— 本指示書執筆時の認識と実装後の認識に乖離が生じた場合は開発者に提示

---

## 8. 参照ドキュメント

| ID | パス | 用途 |
|----|------|------|
| DES-002 | `docs/design/02-architecture.md` v1.8.0 | §4.1 〜 §4.4 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` v1.13.0 | §4.2 / §5.8 / §5.9 |
| architecture-patterns | `docs/handover/architecture-patterns.md` v1.0.3 | §2 / §3 / §5 |
| CLAUDE.md | `CLAUDE.md` | §2 / §3 / §4 / §5 / §10 |
| M6-RESEARCH-01 レポート | `docs/instructions/M6-RESEARCH-01-report.md` | 既存実装状態の確認(2026-05-23 完了) |
| M6-overview | `docs/instructions/M6-overview.md` v1.0.0 | §2.1 / §2.2 / §2.7 / §4.2 |
| playbook | `docs/handover/design-instruction-playbook.md` v1.8.0 | §2 標準節構成 / §5 view 確認義務 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 既存 Config 構造体のフィールド名・型・タグを **推測で書かない**(M6-RESEARCH-01 §4.2 (c) で全フィールド確認済み、§3.4.1 で再 view 確認)
- 既存ハンドラの DTO 配置パターン(`handler.go` 同居 vs `dto.go` 分離)を **推測で決めない**(§3.4.3 で実態確認)
- 既存テストの命名規則を **推測で書かない**(§3.4.5 で実態確認)
- `internal/model/api_error.go` の型定義を **推測で書かない**(§3.4.4 で実態確認)
- 既存ルーター登録パターンを **推測で書かない**(§3.4.2 で実態確認)
- `internal/config/config.go:validate()` の検証内容を **推測で書き写さない**(§3.4.1 で実態確認 → サービス層に同等ロジック実装、§4.3.3)

### 9.2 推測で進めてよい事項(その旨を明示)

- 製造担当が自身の実装裁量範囲(変数名、関数名、import エイリアス、コメント文言、行内コード構成)で決めてよい事項は推測で進めてよい
- 本指示書 §4.3.1 / §4.4.2 のコード例は **参考実装**、製造担当が既存パターンと整合させて実装する(完了報告で逸脱が発生した場合は理由を明記)
- エラーメッセージ文字列の英語表現は製造担当の裁量範囲(ただしユーザー向けではなく開発者向け、CLAUDE.md §4 ログ規約に整合)

### 9.3 不明事項発見時の対応

- 既存実装と本指示書 §4 規定が矛盾する場合: Plan Mode で開発者に報告 + 協議
- 既存 `internal/config/config.go` を変更する必要が出た場合: **Plan Mode で停止 + 開発者協議**(本指示書 §2.3 違反のため、設計担当の判断ミスの可能性)
- `cmd/combomgr/main.go` の LAN バインド系処理を変更する必要が出た場合: **Plan Mode で停止 + 開発者協議**(本指示書 §2.3 違反)
- 設計書本体への影響が発覚した場合: **Plan Mode で停止 + 開発者協議**(CHANGE 通知書起票判断、playbook §16 厳格適用、M6-overview §9 既定)

### 9.4 Plan Mode で計画提示時に含めるべき項目(必須)

- §3.4.1〜§3.4.6 着手前確認結果(view 確認の結果サマリ)
- §3.4.7 必須項目 5 + 6 すべての方針(`isInitialized` 判定位置 / バリデーション失敗時挙動 / アトミック書き戻し / 状態保持方針 / 部分 PUT 採用 / `restart_required` フィールド)
- §4 詳細仕様の実装順序(推奨: モデル定義 → サービス層 → ハンドラ層 → ルーター → DI 配線 → テスト)
- §5.1 必須テストの実装範囲(13 件 + 既存回帰確認)
- §5.2 E2E シナリオの実行計画
- 既存パターンと逸脱する箇所がある場合の理由

---

## 10. 完了後の次ステップ

設計担当 Claude が M6-01 完了承認を受け取り、以下に進む:

1. M6-02 指示書(設定画面 + 初回起動ウィザード)+ レビューチェックリストの作成
2. M6-02 では本 M6-01 で実装した `GET /api/config` / `PUT /api/config` を消費する `web/src/lib/configApi.ts`(新規)を作成する想定
3. M6-02 着手前に M6-01 完了時点のレスポンス DTO 構造(`ConfigResponse` 実装結果)を改めて view し、フロント側 TypeScript 型と整合させる

---

*以上、M6-01 v1.0.0 ドラフト*
