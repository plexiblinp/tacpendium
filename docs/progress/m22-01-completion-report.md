# M22-01 完了報告: 簡易パスワードとセッションの骨格

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M22-01-auth-skeleton.md` v1.1.0 |
| 作業日 | 2026-08-15 |
| 実施者 | 製造担当 Claude Code |
| ブランチ | `claude/m22-01-implementation-plan-k8321w` |
| 基点 commit | `ccbe731` |
| CHANGE | `CHANGE-112`(**承認済み・2026-08-15**。着手ゲート通過を通知書 L9 で確認) |
| 消費マイグレーション | **なし**(§2.1 の見込みどおり。DB スキーマに触れていない) |

---

## 1. §3.3 着手前の実査 9 項目の結果

### 1-1. 標準ライブラリの鍵導出関数 — **在る。よって `x/crypto` は昇格しない**

```
$ go version
go version go1.26.4 linux/amd64

$ go doc crypto/pbkdf2
package pbkdf2 // import "crypto/pbkdf2"

Package pbkdf2 implements the key derivation function PBKDF2 as defined in RFC
8018 (PKCS #5 v2.1).

func Key[Hash hash.Hash](h func() Hash, password string, salt []byte, iter, keyLength int) ([]byte, error)

$ go doc crypto/hkdf
package hkdf // import "crypto/hkdf"
Package hkdf implements the HMAC-based Extract-and-Expand Key Derivation
Function (HKDF) as defined in RFC 5869.

$ go doc crypto/argon2
doc: package crypto/argon2 is not in std (.../src/crypto/argon2)

$ go doc crypto/scrypt
doc: package crypto/scrypt is not in std (.../src/crypto/scrypt)

$ go doc crypto/bcrypt
doc: package crypto/bcrypt is not in std (.../src/crypto/bcrypt)
```

**⇒ §1.2-3 の分岐は「標準ライブラリに在る」側に落ちた。`crypto/pbkdf2` を採用し、`golang.org/x/crypto` の `indirect → direct` 昇格は行っていない**(§1.2-4 の承認枠は未使用)。

併せて実在を確認した標準ライブラリ:

```
$ go doc crypto/rand   | grep '^func'
func Int(rand io.Reader, max *big.Int) (n *big.Int, err error)
func Prime(r io.Reader, bits int) (*big.Int, error)
func Read(b []byte) (n int, err error)
func Text() string

$ go doc crypto/subtle | grep ConstantTimeCompare
func ConstantTimeCompare(x, y []byte) int
```

### 1-2. `GET/PUT /api/config` の `[security]` の扱い — **DTO は手書きの別型。機械的な運搬は無い**

| 箇所 | 実測 |
|---|---|
| `internal/api/config/dto.go:43-45` | `SecurityDTO{ PasswordEnabled bool }`(応答側) |
| `internal/api/config/dto.go:90-92` | `SecurityUpdateDTO{ PasswordEnabled *bool }`(要求側) |
| `internal/api/config/handler.go:103-105` | `toConfigResponse` が**フィールド単位で明示的に**詰め替えている |
| `internal/api/config/dto.go:3-5` | 規約コメントが在った。**★ただし本サブで失効した**——「将来追加される」「現状の Config 構造体には機微情報フィールドは存在しない」がいずれも偽になり、指示する方式(`json:"-"` を付ける)も as-built と別である。**レビュー指摘 A を受けて as-built へ書き換えた**(§19) |
| `internal/model/user.go:14` | `PasswordHash *string \`db:"password_hash" json:"-"\`` と同型の規約が実装済み |

**⇒ §4.2-3 の「`json:"-"` を付けるだけで足りるか」への答え**: 足りるかどうかの問題ではなく、DTO が別型なので**そもそも足さないのが正しい**。`json:"-"` は付けていない
(`toml` タグは要る＝ファイルへは書くため)。**穴は無かった。**

### 1-3. `config.toml` の書き込み経路 — **構造体全体のエンコード。落ちない。ただし競合が 1 つある**

`service.Update` → `configForPersistence`(env override 分だけディスク値へ戻す) → `writeAtomic` →
`toml.NewEncoder(f).Encode(cfg)`(`service.go:391`)＝**`*appconfig.Config` 全体**。
`persisted := *runtime` は `s.cfg` のコピーであるため、`PasswordHash` を `SecurityConfig` に
持たせれば `PUT /api/config` の書き戻しで保存され、落ちない(テストで固定＝
`TestService_Update_PreservesPasswordHash`)。

**★競合**: `Update` は `*s.cfg = next` で構造体ごと差し替えるため、パスワードを `s.cfg` の外で
直接書くと**同じ mutex 下でないかぎり黙って消える**。
⇒ 対策として、パスワードの永続化も config サービス経由(`SetPasswordHash`)にした(§2-2)。

### 1-4. 配置慣行 — 確定

`internal/api/<domain>/{doc.go, handler.go, dto.go, routes.go}` ＋ `internal/service/<domain>/service.go`、
ルート登録は `RegisterRoutes(g *echo.Group, h *Handler)`。
**⇒ 本サブは `internal/service/auth/` ／ `internal/api/auth/` ／ `internal/api/middleware/auth.go`。**

### 1-5. `middleware_test.go:274` のマスキングテストが主張していること

`TestLogger_NoSensitiveBodyLogged` — `POST /api/config` にボディ `{"password":"secret-value"}` を
投げ、ログ出力に `secret-value` が含まれないことを固定している。

**主張の実体はこうである**——「`Logger()` が method / path / status / bytes / latency_ms / remote_ip / request_id / user_agent しか出さない」。**そもそもボディを読まない**のであり、マスク処理が在るわけではない。`M22-RESEARCH-01` §9-B-8 の「マスク対象の実データは発生しない」はこの意味。

**⇒ 本サブで実データが初めて発生するため、実データで確かめた**(§5-6 / §6 手順12)。

### 1-6. `internal/{api,service,repository}/user/` の空パッケージ 3 レイヤ — **残した**

3 つとも `doc.go` 1 ファイルのみ。§1.4-2 により `userID` の供給元を触らないため、
埋めるのは `M22-02` である(§3.3-6 の既定どおり)。
**失効していた文面のみ是正した**(§4.9.1 の走査結果。挙動 diff は 0)。

### 1-7. `preset-config-unsynchronized-read` — **新設分は同期下に置いた。既存分は直していない**

実体は `cmd/combomgr/main.go` の `presetsvc.New(..., func() int64 { return cfg.Defaults.PresetID })` が
`*config.Config` を無同期に読む一方、`configsvc.Update` が `*s.cfg = next` で書く形。

本サブは `[security]` を**毎リクエスト読む**経路を新設するため同じ面に当たる。
**⇒ 新設分は `configsvc.Security()` を足して `s.mu` の保護下で読む形にした。同じ面に無同期のリードを 1 つも増やしていない。**

**★既存の `presetsvc` クロージャは直していない。** config サービスの公開 IF 全体の設計判断であり、
followup の割付(「config サービス側の設計判断待ち」)のまま設計卓へ残す。
**⇒ followup `preset-config-unsynchronized-read` は未解消のままである**(状態は変えていない)。

### 1-8. `make e2e` のクリーンな完走 — **完走した(基線)**

**★1 点だけ環境側の前提が欠けていた**——クリーンな clone は `web/node_modules` を持たないため、
初回の `make e2e` は `Cannot find package '@playwright/test'` で落ちる。
`cd web && pnpm install --frozen-lockfile` を先に実行して解消した(**コード側の問題ではない**)。

```
基線(実装前): 107 passed (3.3m)
```

### 1-9. `M22-RESEARCH-01` の実パスと鮮度

実パス `docs/progress/M22-RESEARCH-01-report.md`(1370 行)。レポートは HEAD `8af2ca6` 時点の
スナップショット、本作業の基点は `ccbe731`。
**差分は `M21-07` のマージ(`web/src/features/physical-input/` 系)と M21 設計反映であり、本サブが触る面には及んでいない。** D-1 / D-3 / D-5 / E-1 / §9-B-8 の記述は
2026-08-15 の実査で**全件そのまま成立**した(上記 1-2 / 1-3 / 1-5)。

---

## 2. 採用したハッシュ方式と選定根拠

**`crypto/pbkdf2`(HMAC-SHA256)。標準ライブラリ。**

- **選定根拠**: §1.2-3 が「標準ライブラリに鍵導出関数が在ればそれを使う」と定めており、
  §3.3-1 の実査で `crypto/pbkdf2` の実在を確認したため(Go 1.24 で標準入り)。
- **`indirect → direct` 昇格: 行っていない。** `go.mod` / `go.sum` の diff は **0 行**。
  `golang.org/x/crypto v0.46.0 // indirect` の行は基点から不変である。
- **検証子の形式**: `pbkdf2-sha256$<反復回数>$<ソルト>$<導出鍵>`(base64 パディング無し)。
  反復回数とソルトを検証子自身へ埋めるため、**将来 `hashIterations` を上げても既存の検証子を照合できる**。
- **パラメータ**: 反復 600,000 ／ ソルト 16 byte(`crypto/rand.Read`) ／ 導出鍵 32 byte。
- **実測コスト**: **1 回あたり 315 ms**(`Intel(R) Xeon(R) @ 2.80GHz` / `go test -bench`)。

  ```
  BenchmarkHashPassword-4   	       5	 314923592 ns/op
  ```

  **★導出はログイン時とパスワード設定時にしか走らない。セッション検証はメモリ上の索引を引くだけであり、毎リクエストの経路に導出は無い。** タイムアウトを設けない
  決定(§1.2-5)により、実質的に 1 セッションにつき 1 回である。
- **照合**: `crypto/subtle.ConstantTimeCompare`(§4.3-2。自前のバイト比較はしていない)。
  **パース不能な検証子は照合失敗として扱う**(エラーにしない＝呼び分けを増やさない)。

---

## 3. セッション ID の生成元と長さ

- **生成元**: `crypto/rand.Text()`(標準ライブラリ。暗号論的乱数)。**`math/rand` は使っていない。**
- **長さ**: base32 で 26 文字 ／ **約 128 bit** のエントロピー。
- **値そのものは本報告に書かない**(§7.5-3)。
- **保持**: サーバのメモリ上の `map[string]struct{}`。`sync.RWMutex` で保護(§4.3-7)。
  **永続化しない。再起動で消える。**
- **失効の契機**: ログアウト ／ プロセス再起動 ／ **パスワード変更**(変更時に全セッションを破棄)。
  **タイムアウト・掃除タイマーは置いていない**(§4.3-5 / `E-132`。無効なタイマーも置いていない)。

---

## 4. 保護対象から外した経路の全数

認証ミドルウェアは **`/api/` で始まるパスのみ**を保護対象とし、そのうち次の 5 本を外す。

| # | 経路 | 外した理由 |
|---|---|---|
| 1 | `GET /api/health` | ヘルスチェック(§4.5-2 明示) |
| 2 | `POST /api/auth/login` | **これが無いとログインできない**(§4.5-2 明示) |
| 3 | `POST /api/auth/logout` | 冪等。情報を返さない |
| 4 | `GET /api/auth/status` | **未認証の画面が「パスワードを求めるべきか」を知る唯一の経路** |
| 5 | `POST /api/auth/password` | **初回設定を通すため。** 変更時の保護はミドルウェアではなく<br>ハンドラ側で成立する(現在のパスワードを要求する) |

**加えて、`/api/` で始まらないパス(SPA シェル・`/assets/*`・`/`)は保護しない。**
シェルが読めないと `M22-02` がログイン画面を出せないため(§4.5-2 の「静的配信」)。

**⇒ 上記以外の `/api/*` はすべて保護対象である**(`GET/PUT /api/config` を含む)。
これにより §4.4-3′「認証なしで `password_enabled` を `false` にできない」が成立している
(§6 手順9 で実測)。

一覧は `internal/api/middleware/auth.go` の `unprotectedPaths` に集約し、
`TestAuth_Enabled_UnprotectedPathsPass` が**全数を固定**している。

---

## 5. 未認証時の応答(**★`M22-02` が受け取る契約**)

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":{"code":"unauthorized","message":"authentication required"}}
```

- **リダイレクトはしない。** API はデータを返す層であり、遷移は画面が決めるため。
- 形式は既存の `model.APIErrorResponse` に揃えてある。
- **ログイン失敗は別の応答である**: `401` ＋ `{"error":{"code":"invalid_password","message":"incorrect password"}}`。
  **理由は区別しない**——「パスワード未設定」と「不一致」が同じ応答になることを
  `TestLogin_NoPasswordSet_SameResponseAsWrongPassword` で固定した。

---

## 6. セッションの受け渡し方法(**★`M22-02` / `M22-05` の前提**)

**Cookie。** 開発者判断(2026-08-15)。

```
Set-Cookie: combomgr_session=<session-id>; Path=/; HttpOnly; SameSite=Strict
```

| 属性 | 値 | 理由 |
|---|---|---|
| 名前 | `combomgr_session` | — |
| `HttpOnly` | あり | JavaScript から読めなくする |
| `SameSite` | `Strict` | 外部サイト起点で送られない。**`DES-002` §4.4 が CSRF 第一対策として前提にしている形**(`M22-05` がこの上に載る) |
| `Path` | `/` | SPA の静的配信と `/api/*` の両方へ送る |
| `Secure` | **なし** | **契約 F-3＝平文 HTTP。付けると LAN で Cookie が保存されず入場できない** |
| `Max-Age` | 指定なし | タイムアウトを設けない決定(§1.2-5)に対応。ブラウザを閉じるまで有効なセッション Cookie |

- **★属性は `internal/api/auth/cookie.go` の `newSessionCookie` 1 関数に集約してある。**
  発行(`issueSession`)と失効(`clearSession`)の両方がそこを通るため、属性を変えるときに
  片方だけ直す事故が起きない。**Web 公開へ改修する人が `Secure` を足すのもこの 1 箇所である**
  (開発者との 2026-08-15 の議論で、拡張性の観点からこの形を選んだ)。
- **`web/src/` を 1 行も触っていない。** フロントの `fetch` は 10 箇所以上が既に
  `credentials: "same-origin"` を持ち、`cors.go:41` が `Access-Control-Allow-Credentials: true` を
  設定済みであるため、Cookie はそのまま乗る(§2.2-7 の凍結と両立した)。
- **★`password_enabled = false` のときは Cookie を 1 枚も発行しない**(§4.9-4)。
  **`Service.Login` が `Enabled()` を見るため、正しいパスワードでも OFF なら 401 で Cookie も付かない。**
  **★初版はこの判定が無く、「OFF かつパスワード設定済み」で 204 + Set-Cookie を返していた**
  (レビュー指摘 2-a。製造側で再現を確認して是正)。**この状態は例外ではない**——
  ゲートを一度掛けて外しても `password_hash` は残るため、**ゲートを外した後の通常状態**である。
  固定しているのは `TestLogin_DisabledButPasswordSet_IssuesNoCookie`(OFF かつ設定済み)、
  `TestService_Login_RequiresEnabled`(サービス層・対照つき)、
  `TestAuth_Disabled_DoesNotTouchResponse`(ミドルウェア非搭載の対照サーバとの比較)、
  および E2E A 群(未設定かつ OFF)である。

### 開発者の疎通確認手順(§4.7 / §7.1)

**★以下は実測の転記である**(専用ポート 47455 ／ 使い捨て DB の別ディレクトリで実行し、
リポジトリの `config.toml` は汚していない)。

起動は `make run-server` ＋ `make run-web` の 2 プロセス、または `make build` した配布バイナリ。
**`config.toml` を書き換えるため、確認後に元へ戻すこと。**

```bash
B=http://127.0.0.1:47318   # 実際のポートに合わせる

# 1) 既定(OFF)では何も要求されない
curl -i -s $B/api/config | head -1
#=> HTTP/1.1 200 OK
curl -s $B/api/config | grep -c password_hash
#=> 0
curl -s -i $B/api/config | grep -ci set-cookie
#=> 0
curl -s $B/api/auth/status
#=> {"passwordEnabled":false,"passwordSet":false,"authenticated":false}

# 2) パスワード未設定のまま ON にはできない(422)
curl -s -X PUT $B/api/config -H 'Content-Type: application/json' \
  -d '{"security":{"passwordEnabled":true}}' -w "\nHTTP %{http_code}\n"
#=> {"error":{"code":"validation_failed",...,"issues":[{"field":"security.passwordEnabled",
#=>   "message":"password is not set; set a password before enabling password protection"}]}}
#=> HTTP 422

# 3) パスワードを設定する(初回は現在のパスワード不要)
curl -s -X POST $B/api/auth/password -H 'Content-Type: application/json' \
  -d '{"newPassword":"lan-pass"}' -w "HTTP %{http_code}\n"
#=> HTTP 204
#   config.toml には検証子だけが入る(平文は入らない):
#     password_hash = "pbkdf2-sha256$600000$9xxxD/Xp8C6JgjEbCkKFiw$2liWvNdHio8..."

# 4) ON にする
curl -s -o /dev/null -X PUT $B/api/config -H 'Content-Type: application/json' \
  -d '{"security":{"passwordEnabled":true}}' -w "HTTP %{http_code}\n"
#=> HTTP 200

# 5) セッション無しでは弾かれる
curl -s $B/api/config -w "\nHTTP %{http_code}\n"
#=> {"error":{"code":"unauthorized","message":"authentication required"}}
#=> HTTP 401

# 6) 誤ったパスワードは通らない
curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"password":"wrong"}' -w "\nHTTP %{http_code}\n"
#=> {"error":{"code":"invalid_password","message":"incorrect password"}}
#=> HTTP 401

# 7) 正しいパスワードでログイン → Cookie 発行
curl -s -i -c cookies.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"password":"lan-pass"}' | grep -iE "^HTTP|^set-cookie"
#=> HTTP/1.1 204 No Content
#=> Set-Cookie: combomgr_session=EKT447ZRAFUHW665Q5QT3XMOLV; Path=/; HttpOnly; SameSite=Strict

# 8) セッションで保護対象が通る。応答にハッシュは出ない
curl -s -b cookies.txt $B/api/config | head -c 200
#=> {"server":{...},"security":{"passwordEnabled":true},...}
curl -s -b cookies.txt $B/api/config | grep -c password_hash
#=> 0

# 9) 認証なしでは OFF に戻せない(§4.4-3′)
curl -s -X PUT $B/api/config -H 'Content-Type: application/json' \
  -d '{"security":{"passwordEnabled":false}}' -w "\nHTTP %{http_code}\n"
#=> {"error":{"code":"unauthorized","message":"authentication required"}}
#=> HTTP 401
curl -s $B/api/auth/status
#=> {"passwordEnabled":true,"passwordSet":true,"authenticated":false}   ← ON のまま

# 10) 現在のパスワード無しの変更は通らない(§5.1-12)
curl -s -X POST $B/api/auth/password -H 'Content-Type: application/json' \
  -d '{"newPassword":"hijack"}' -w "\nHTTP %{http_code}\n"
#=> {"error":{"code":"invalid_password","message":"incorrect current password"}}
#=> HTTP 401

# 11) ログアウトするとそのセッションは通らない
curl -s -o /dev/null -b cookies.txt -X POST $B/api/auth/logout -w "logout HTTP %{http_code}\n"
#=> logout HTTP 204
curl -s -o /dev/null -b cookies.txt $B/api/config -w "HTTP %{http_code}\n"
#=> HTTP 401

# 12) ログに平文・検証子・セッション ID が出ていないこと(実データで確認)
grep -c "lan-pass" logs/*.log
#=> 0
grep -c "pbkdf2-sha256\$600000\$9xxx..." logs/*.log
#=> 0
grep -c "EKT447ZRAFUHW665Q5QT3XMOLV" logs/*.log
#=> 0

# 13) config.toml を手で書いて password_enabled = true / password_hash = "" にして再起動
curl -s $B/api/auth/status
#=> {"passwordEnabled":false,"passwordSet":false,"authenticated":false}
curl -s -o /dev/null $B/api/config -w "HTTP %{http_code}\n"
#=> HTTP 200   ← 認証なしで通る(OFF として扱う)
# サーバは起動している(止まっていない)。WARN が出る:
#   "msg":"auth: password_enabled is true but no password is set;
#          treating password protection as disabled"
```

**★確認後は `config.toml` の `[security]` を元へ戻すこと**(`password_enabled = false`、
`password_hash` の行を削除)。

---

## 7. 破壊確認 A / B の結果

| # | 内容 | 結果 |
|---|---|---|
| **A** | 認証ミドルウェアの登録(`e.Use(mw.Auth(v))`)を外す → §5.1-2 が赤くなるか | **★赤くなった** |
| **B** | `password_hash` を DTO へ載せる → §5.1-5 が赤くなるか | **★赤くなった** |

**破壊確認 A** — `internal/api/middleware/auth_test.go` の `newAuthServer` から
`e.Use(mw.Auth(v))` を外して実行:

```
--- FAIL: TestAuth_Enabled_ProtectedRequiresSession (0.00s)
    auth_test.go:154: GET /api/combos: status = 200, want 401
    auth_test.go:154: GET /api/config: status = 200, want 401
    auth_test.go:154: PUT /api/config: status = 200, want 401
FAIL
```

**破壊確認 B** — `SecurityDTO` に `PasswordHash string \`json:"passwordHash"\`` を足し、
`toConfigResponse` で詰め替えるように変えて実行:

```
--- FAIL: TestHandler_Get_DoesNotExposePasswordHash (0.00s)
    handler_test.go:444: response body contains the password hash: {..."security":
      {"passwordEnabled":true,"passwordHash":"pbkdf2-sha256$600000$c2FsdHNhbHQ$..."},...}
    handler_test.go:447: response body contains a password hash field: {...}
FAIL
```

**⇒ 2 件とも赤くなったため、「何が代わりに守っていたか」の特定は不要である。**

**★いずれも一時的な改変であり、確認後に元へ戻して diff が 0 であることを実測した**
(`git diff --stat internal/api/config/dto.go internal/api/config/handler.go
internal/api/middleware/auth_test.go` → 空)。

---

## 8. `users.password_hash` 列の扱い(§1.4-3)

- **使っていない。消していない。** 列は `migrations/000001_init_schema` のまま残っている。
- 本サブのパスワードは **`config.toml` の `[security] password_hash`** に置いた
  (全ユーザー共通の 1 本＝`DES-002` §8 の逐語「全ユーザー共通の1パスワード」)。
- `internal/model/user.go:14` の `PasswordHash *string \`json:"-"\`` も不変である。

### 所見(設計卓への申し送り)

**★この列は「将来の利用者ごと認証のために予約されている」と読めてしまう。**
実際には本サブの方式決定(§1.2-2)により、**利用者ごとのパスワードは実装されない**。
`M22-02` はユーザー選択(名前を選ぶだけ・認証ではない)を足すため、その後も使われない。

**⇒ 3 つの扱いが考えられる。判断は設計卓・開発者に委ねる。**

1. **列を残したまま、`DES-003` に「未使用である」と明記する**(最も軽い。破壊的変更なし)
2. **列を残し、`internal/repository/user/doc.go` の注記だけで足す**(本サブで実施済み——
   「簡易パスワードは users 表ではなく config.toml に置く。users.password_hash 列は未使用」)
3. **列を削除する**(**破壊的変更。本サブのスコープ外。マイグレーションを消費する**)

本サブでは **2 を実施**した(コメントによる明示)。**1 は設計卓の手番である。**

---

## 9. `DES-002` §8 と as-built の差の全数(§6.5。`CHANGE-112` の反映に使う)

**★as-built が指示書と食い違った箇所は無い。** 以下は `DES-002` §8 の記述と実装の差である。

| # | `DES-002` §8 の記述 | as-built | `CHANGE-112` での扱い |
|---|---|---|---|
| 1 | 「セッションタイムアウトは最低12時間以上に設定する」 | **実装しない**(タイマーを一切置いていない) | **改訂対象**(§1.2-5。通知書に既出) |
| 2 | パスワードの置き場を書いていない | **`config.toml` の `[security] password_hash`**(`users` 表は使わない) | **改訂対象**(通知書に既出) |
| 3 | 「セッション管理はサーバーサイドセッション(メモリ保持)で十分」 | **一致**(メモリ上の `map`。永続化なし) | 変更不要 |
| 4 | パスワードの変更・無効化の導線を書いていない | **変更は現在のパスワードを要求 ／ 忘却時の復旧は `config.toml` の直接編集のみ ／ `password_enabled` を `false` にする操作も保護対象** | **改訂対象**(D-396。通知書に既出) |
| 5 | 「利用者が2人以上の場合：起動時にユーザー選択画面を表示」 | **未実装**(`M22-02` の担当。本サブは `userID` の供給元を変えていない) | **本 CHANGE の対象外**(通知書 §1.1) |
| 6 | 「LAN共有モードON時：簡易パスワード…を要求可能とする」 | **サーバ側は実装済み。UI は `M22-02`** | 実装が追いつくのは `M22-02` |
| 7 | 「LAN共有モードONに切り替える際、パスワード未設定の場合は『パスワード保護を強く推奨します』と警告し、パスワード設定へ誘導する」 | **未実装**(`LanModeConfirmDialog.tsx` は `passwordEnabled` を参照していない。`M22-RESEARCH-01` §9-B-4 のまま) | **`M22-02` の担当**(本サブは `web/src/` を触らない) |
| 8 | 「厳格な認証ではなくラベル付け程度の位置づけ」「防御責任の主体はルーター・ファイアウォール」「必須化はしない」 | **一致**(方針どおり過剰にしていない) | 変更不要 |

### ★新たに確定した仕様(設計書に記述が無かったもの)

| # | 事項 | as-built |
|---|---|---|
| a | **ハッシュ方式** | `crypto/pbkdf2`(HMAC-SHA256・反復 600,000・ソルト 16B・鍵 32B)。検証子は自己記述形式 |
| b | **セッションの受け渡し** | Cookie `combomgr_session`(`HttpOnly` / `SameSite=Strict` / `Path=/` / `Secure` なし) |
| c | **未認証時の応答** | `401` ＋ `{"error":{"code":"unauthorized",...}}`。リダイレクトしない |
| d | **保護対象の範囲** | `/api/*` から 5 経路を除いた全部。`/api/` 以外は保護しない |
| e | **`password_enabled = true` かつ `password_hash` 空** | **API 経路は 422 で拒否 ／ ファイル経路は WARN を出して OFF 扱い**(起動は止めない) |
| f | **パスワード変更時の既存セッション** | **全破棄**(変えた本人だけが入り直せる状態にする) |

**⇒ b・c は `M22-02` の入力、b は `M22-05` の前提である**(§7.5-5・6)。

---

## 10. `password_enabled = true` のときの既存画面の見え方(§4.7-3)

**★白画面にはならない。アプリの外枠は完全に描画され、データ領域が汎用のエラー表示になる。**

| 段階 | 見え方 |
|---|---|
| 0〜約 7 秒 | **ローディング表示のまま**。`GET /api/config` が TanStack Query の既定で再試行(初回 ＋ 3 回)を尽くすまで `App.tsx` の `isLoading` が真であるため |
| 約 7 秒以降 | **ヘッダのナビ・フィルタ・ボタン類がすべて描画される。**<br>データ領域に `エラーが発生しました: HTTP 401: {"error":{"code":"unauthorized","message":"authentication required"}}` |

- **ウィザードへは飛ばない。** `App.tsx:24` の分岐が `data && !data.isInitialized` であり、
  401 のとき `data` は `undefined` になるため成立しない。
  **★ここが崩れると、保護を掛けた瞬間に初期設定ウィザードが出る。** E2E で固定した。
- **⇒ `M22-02` へ渡す既知の状態である。** ログイン画面を載せる土台(シェル)は在る。
  **約 7 秒のローディングと、生のエラー本文がそのまま出ている点は `M22-02` が引き取る。**

> **★危うく誤った結論を出しかけた**——E2E で API を 401 に差し替える `page.route` のパターンを
> `**/api/**` にしたところ、**Vite が dev で配るソースモジュールのパス**
> (例 `/src/features/tag/api/tagApi.ts`)にも当たり、JS モジュールが 401 JSON に化けて
> **アプリが起動せず本当に白画面になった。** 「保護すると白画面になる」と報告する寸前だった。
> オリジン直下の `/api/` に限定する正規表現へ改めて実測し直した(spec 冒頭に注記済み)。

---

## 11. 否定形確認の走査コマンドと結果(§4.9.1)

### 走査コマンド

```bash
# 走査1: 未実装・将来形の記述(★陽性対照 internal/api/user/doc.go の「M6 で実装」を含む)
LC_ALL=C.UTF-8 grep -rn -E "M6 で実装|M6 以降|フェーズ2以降で実装|M1 では未使用|未実装|notImplemented" \
  --include="*.go" --include="*.sql" --include="*.example" --include="*.toml" \
  --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules

# 走査2: password_enabled を散文で前提に語る記述(D-361)
LC_ALL=C.UTF-8 grep -rn "password_enabled" \
  --include="*.go" --include="*.sql" --include="*.example" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules

# 走査3: セッションタイムアウト(実装しない決定 §1.2-5)
LC_ALL=C.UTF-8 grep -rn -E "タイムアウト|timeout|Timeout|12 時間|12時間" \
  --include="*.go" --include="*.sql" --include="*.example" --include="*.toml" . | grep -v node_modules

# 走査4: ファイル単位(行を跨ぐ文脈の取りこぼし対策)
LC_ALL=C.UTF-8 grep -rlE "M6" --include="*.go" --include="*.sql" . | grep -v node_modules
```

### 陽性対照(§4.9.1-3。「0 件だった」が「走査が壊れている」ではないことの確認)

- **是正前**: `internal/api/user/doc.go:1` の「M6 で実装。」が**当たった**(指示書が指定した陽性対照)。
- **是正後**: 同対照は消えるため、**別の陽性対照へ切り替えて健全性を維持**した——
  `migrations/000007_seed_initial_tags_user1.up.sql:6` の「M6 着手時にウィザード経由生成へ切り替える。」が
  **当たり続ける**(直せない対象であるため、常に陽性対照として機能する)。

### 走査結果と処置

| ファイル | 当たった記述 | 処置 |
|---|---|---|
| `config.toml.example:29` | 「フェーズ2以降で実装予定。M1 では未使用。」 | **是正** |
| `internal/config/config.go:79` | 「フェーズ2(M6 以降)で本格利用。」 | **是正** |
| `internal/config/config.go:82` | 「PasswordHash は M6 以降で扱う。M1 では未使用。」 | **是正**(実フィールドへ置換) |
| `internal/api/user/doc.go:1` | 「M6 で実装。」(**陽性対照**) | **是正**(`M22-02 で実装`) |
| `internal/service/user/doc.go:1` | 「フェーズ2(M6 以降)で実装。」 | **是正**(`M22-02 で実装`) |
| `internal/repository/user/doc.go:1` | 「M6 で実装。」 | **是正**(`M22-02 で実装`) |
| **`migrations/000007_*.up.sql:3,5,6`** | 「M6 初回起動ウィザードで生成」「**M6 着手時にウィザード経由生成へ切り替える。**」 | **★直せない。** 適用済みマイグレーションであり改変できない(§4.9.1-3)。**走査で当たったことをここに記録する。**<br>**実体は「切り替えは行われておらず、seed の暫定措置がそのまま残っている」**(`M22-RESEARCH-01` §9-B-7)。`M22-02` の着手時も seed のままである見込み |

**是正後の再走査**: 「M6 で実装」「フェーズ2(M6 以降)で実装」「フェーズ2以降で実装予定」
「M1 では未使用」は **0 件**。

### 走査で当たったが是正しなかったもの(理由つき)

| ファイル | 記述 | 是正しなかった理由 |
|---|---|---|
| `internal/api/config/doc.go:1` ／ `internal/service/config/service.go:3` ／ `cmd/combomgr/main.go` の `M6-01:` コメント | 「M6-01 で実装済み」「M6-01 指示書 §4.3」 | **失効していない。**実装済みの経緯を指す**歴史的な帰属**である |
| `web/src/features/config/SettingsSectionUser.tsx` ／ `locales/*.json` の `notImplemented` | 「今後実装予定」 | **失効していない。** ユーザー選択 UI は実際に未実装(`M22-02` の担当)。かつ `web/src/` は §2.2-7 で凍結 |
| **`internal/service/combo/deps_adapter.go:13`** | **「後続の指示書(M3 タグ、M6 ユーザー)で character リポジトリパッケージが整備される予定。」** | **★失効している**(`internal/repository/character/` は実在する)。**ただし本サブの走査対象(認証・タイムアウト)ではなく、M22-01 以前から失効していた別件である。**⇒ **是正せず、ここに記録して設計卓へ渡す**(§13 の followup 候補) |

### タイムアウト走査(走査3)の結果

**セッションタイムアウトに相当する記述は本番コードに 0 件。**
当たったのは SQLite の `PRAGMA busy_timeout`(無関係)と、
**本サブで新たに書いた「タイムアウトを設けない」という決定の記述のみ**である。
**⇒ 無効なタイマーも「後で足せるように」という記述も置いていない**(§4.3-5 / `E-132`)。

---

## 12. 自己テスト結果(§7.2。**★コマンド自身の出力を転記**)

### `go test ./...`

```
ok 件数: 51   FAIL 件数: 0
```

新規パッケージの内訳:

```
ok  	github.com/plexiblinp/combomgr/internal/service/auth	12.973s
ok  	github.com/plexiblinp/combomgr/internal/api/auth	7.735s
ok  	github.com/plexiblinp/combomgr/internal/api/middleware	0.009s
ok  	github.com/plexiblinp/combomgr/internal/service/config	0.032s
ok  	github.com/plexiblinp/combomgr/internal/api/config	0.011s
```

> **★`internal/service/auth` が 13 秒かかるのは PBKDF2 の反復 600,000 回をテスト内で何度も回すためである**(1 回 315 ms)。実行時のコストではない。

### `go test -race ./internal/service/auth/`(§4.3-7 の並行性)

```
ok  	github.com/plexiblinp/combomgr/internal/service/auth	79.792s
```

**データ競合の検出なし。**

### `cd web && pnpm test`

```
 Test Files  151 passed (151)
      Tests  1412 passed (1412)
   Duration  75.13s
```

### `make e2e`

```
基線(実装前): 107 passed (3.3m)
実装後:       114 passed (2.7m)
```

**+7 本がすべて新規 spec `web/e2e/m22-01-auth-gate.spec.ts`。既存 107 本は全て緑のまま**
(＝§5.2-A「既定 OFF で主要フローが非回帰」の主要な網)。

### 機械検査

```
$ bash scripts/check-artifact-integrity.sh     → 結果: 違反なし
$ bash scripts/check-enum-sync.sh              → 結果: ベースラインどおり(増加なし)
$ bash scripts/check-browser-storage-keys.sh   → 結果: 違反なし
$ bash scripts/check-doc-refs.sh               → 結果: dead reference なし
$ bash scripts/check-md-emphasis.sh            → 結果: 違反なし(436 行 / ベースライン 436 行)
$ go vet ./...                                 → 出力なし
$ gofmt -l <変更ファイル>                       → 出力なし
```

> **★`check-artifact-integrity.sh` は初回 NG だった**——`check-md-emphasis.sh --self-test` が
> 「自己検査: 合格」を出さなかったため。原因は**クリーンな環境に `markdown-it-py` が入っていないこと**であり、**当該検査は依存欠落時に緑を返さず非ゼロ終了する設計どおりに振る舞っていた**(＝検査機構は健全)。`pip install markdown-it-py` で解消し、再実行して緑。
> **コード側の問題ではない。**

---

## 13. 品質チェック(§7.3。**★実測値**)

基点 `ccbe731` からの diff:

| 対象 | 実測 |
|---|---|
| `migrations/` | **0** |
| `character_data/` | **0** |
| `docs/design/` | **0** |
| `internal/service/notation/` | **0**(契約 F-5) |
| `internal/service/preset/` | **0**(契約 F-5) |
| `web/src/features/physical-input/` ／ `gamepad/` ／ `keyboard/` | **0**(契約 F-4) |
| **`web/src/`(全体)** | **0**(§2.2-7。**例外条項 §4.7-3 も使わずに済んだ**) |
| `defaultUserID` の 3 箇所と参照 | **0**(§2.2-3。`grep` で実在 3 定義を確認し、diff に 1 件も現れない) |
| **`go.mod` / `go.sum`** | **0**(§2.3。**pbkdf2 が標準ライブラリのため昇格そのものが不要だった**) |
| 既存ミドルウェア 3 本(`RequestID` / `Logger` / `CORS`) | **実装・登録順ともに 0**(4 本目を後ろへ足しただけ) |

**⇒ §7.3 の全項目を満たしている。**

### `cmd/combomgr/main.go` の変更について(§2.1 の注記「触った理由を書くこと」)

- `configsvc.NewService(...)` の **生成位置**を `echo.New()` より前へ移した。
  認証ミドルウェアが `[security]` を読むために `configService` を必要とし、
  `e.Use` は経路登録より前に呼ぶ必要があるため。
  **引数・注入する 2 つの関数はいずれも不変である**(移動のみ)。
- `e.Use(mw.Auth(authService))` を CORS の直後へ追加。
- `authhandler.RegisterRoutes(apiGroup, ...)` を追加。
- import を 2 行追加。

---

## 14. 並列相手との突合(§7.5-12 / `E-121`)

**★並列相手は居なかった。**

- **`M21-07`**: 本作業の基点 `ccbe731` に**既にマージ済み**(PR #59 / #60)。
  作業中の変更は無く、`web/src/features/{physical-input,gamepad,keyboard}/` の diff は **0**。
- **`M22-06`**(接続 QR コード) / **`M22-07`**(エイリアス辞書拡充): **ブランチが存在しない**
  (`git branch -r` は `origin/main` と本ブランチのみ)。**着手されていない。**
- **⇒ `web/src/` の取り合いは発生していない**(そもそも本サブは `web/src/` を触っていない)。

---

## 15. 実装した内容の一覧

| ファイル | 内容 |
|---|---|
| `internal/config/config.go` | `SecurityConfig.PasswordHash` を追加(`toml:"password_hash"`)。失効コメントを是正 |
| `config.toml.example` | `[security]` の記述を更新(忘却時の復旧が本ファイルの編集のみである旨を含む) |
| `internal/service/config/service.go` | `Security()` / `SetPasswordHash()` を追加。`PUT` の 422 検証を追加 |
| `internal/service/auth/` (新規) | `doc.go` / `password.go`(検証子) / `service.go`(セッション) / `service_test.go` |
| `internal/api/auth/` (新規) | `doc.go` / `cookie.go` / `dto.go` / `handler.go` / `routes.go` / `handler_test.go` |
| `internal/api/middleware/auth.go` (新規) | 認証ミドルウェア。`auth_test.go` を追加 |
| `cmd/combomgr/main.go` | ミドルウェアとルートの登録(§13 に理由) |
| `internal/{api,service,repository}/user/doc.go` | 失効記述の是正のみ(挙動 diff 0) |
| `internal/api/config/handler_test.go` | fake への 2 メソッド追加 ＋ 漏洩テスト 2 本 |
| `web/e2e/m22-01-auth-gate.spec.ts` (新規) | E2E 7 本 |

---

## 16. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の消費** | **なし。** 本サブは `CHANGE-112`(既存・承認済み)に紐づく。**新規の CHANGE を起票していない**ため、`change-number-registry.md` §1 への登録は不要。「次の番号」を写している 4 箇所(registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4)も**変更不要**である |
| 2 | **マイグレーション連番の消費** | **なし。** `ls migrations/` の最終は `000069`(基点から不変)。ボード §2.2 の「次に払い出す番号」は**ずれていない** |
| 3 | **版を上げた文書** | **なし。** 製造は設計書・指示書の版を上げていない。⇒ 参照元の追随も不要 |
| 4 | **`CHANGE-112` の反映に要る情報** | **§9 の差分表(8 行)と「新たに確定した仕様」(6 行)が入力である。** 設計卓が `DES-002` §8(v1.49.0 → v1.50.0)と `SUPP-001` §5.8(v1.39.0 → v1.40.0)の改訂に使う。**とくに §9-a〜f は設計書に記述が無かったもの** |
| 5 | **followup の更新候補**(★製造は `followup-backlog.md` を編集しない＝**D-382**。設計伝達レポート §4 へ回す) | 下表 |

### followup の更新候補(設計卓が畳む)

| スラッグ | 候補 |
|---|---|
| `preset-config-unsynchronized-read` | **状態は「未着手」のまま。**ただし**本サブが新設した読み経路は最初から `s.mu` の保護下**であり、無同期のリードを増やしていない。残るのは `main.go` の `defaultPresetID` クロージャ 1 件である(範囲が狭まった) |
| `user-package-stubs-since-m6` | **3 レイヤの空パッケージは残っている**が、`doc.go` の文面は `M22-02` を指すよう是正済み。**畳むのは `M22-02` の完了後**が妥当 |
| `des002-8-auth-design-vs-implementation-gap` | **§9 の 8 行が差分の全数である。**`CHANGE-112` の反映で大半が解消する見込み。**残るのは §9-5・6・7(UI 側＝`M22-02`)** |
| `config-toml-example-vs-supp001-5-8` | **`[security]` グループのみ解消した。** 残る差分 5 グループ(`[defaults]` 欠落・パス制約コメント欠落 等)は手つかず |
| **(新規候補)** `combo-deps-adapter-stale-comment` | **`internal/service/combo/deps_adapter.go:13` の「後続の指示書(M3 タグ、M6 ユーザー)で character リポジトリパッケージが整備される予定」が失効している**(`internal/repository/character/` は実在)。**本サブの走査対象外の別件であるため是正していない**(§11) |
| **(新規候補)** `e2e-requires-pnpm-install-on-clean-clone` | **クリーンな clone では `make e2e` が `Cannot find package '@playwright/test'` で落ちる**(§1-8)。`make e2e` は `config.toml` 不在は吸収するが `web/node_modules` 不在は吸収しない。**同じ切り分けを次の担当も踏む** |
| **(新規候補)** `auth-401-shows-raw-error-body` | **保護中の既存画面が `エラーが発生しました: HTTP 401: {...}` と生の応答本文を出す**(§10)。**機微情報は含まないが、`M22-02` がログイン画面へ差し替える対象である** |

---

## 17. 停止条件(§9.3)に触れていないことの確認

| # | 停止条件 | 結果 |
|---|---|---|
| 1 | `password_hash` を `GET/PUT /api/config` から切り離せない | **切り離せた**(DTO が別型)。止まらず |
| 2 | `golang.org/x/crypto` 以外の新規依存が要る | **新規依存ゼロ**(標準ライブラリのみ)。止まらず |
| 3 | `password_enabled = false` の挙動を変えずに実装できない | **変えずに実装できた**(グローバル `e.Use` ＋ 即 `next`)。止まらず |
| 4 | `defaultUserID` の 3 箇所を触らないと成立しない | **触らずに成立**。止まらず |
| 5 | マイグレーションが要る | **不要**。止まらず |
| 6 | `DES-002` §8 と §1.2 の決定が食い違う箇所を新たに発見 | **新たな発見なし**(§9 は既知分のみ)。止まらず |
| 7 | `make e2e` が着手前から落ちている | **落ちていた(環境要因)。** `pnpm install` で解消し 107 passed の基線を取得した。**コード側の前提は健全**。止まらず |

**⇒ 7 条件のいずれにも該当しない。開発者裁定を要する未解消項目は無い。**

---

## 18. 到達点と `M22-02` への引き継ぎ

**到達点**(§1.4 の帰結どおり):
**「`password_enabled = true` にするとパスワードを求められ、通ると使える」まで。**
画面はまだ無く、誰として入ったかも区別されない(全員が `id=1` として振る舞う)。

**`M22-02` が受け取る契約**:

1. **未認証時の応答**: `401` ＋ `{"error":{"code":"unauthorized","message":"authentication required"}}`(§5)
2. **セッションの受け渡し**: Cookie `combomgr_session`(§6)。**フロントは何もしなくてよい**
   (`credentials: "same-origin"` が既に在るため)
3. **状態の問い合わせ**: `GET /api/auth/status` → `{passwordRequired, passwordSet, authenticated}`。
   **未認証で読める唯一の経路**(§4)。
   **★`passwordRequired` は実効値である**——`GET /api/config` の `security.passwordEnabled`
   (`config.toml` の生値)とは別物で、`password_enabled = true` かつパスワード未設定のときに
   両者は `true` / `false` へ割れる。**画面が見るべきは `passwordRequired` の方である。**
   同名で違う値になるのを避けるため、名前を分けてある(レビュー指摘 F)
4. **ログイン**: `POST /api/auth/login` `{password}` → 204 ＋ Cookie ／ 401
5. **パスワード設定・変更**: `POST /api/auth/password` `{currentPassword?, newPassword}`
6. **保護中の既存画面の見え方**: §10(約 7 秒のローディング → 外枠 ＋ 生のエラー表示)

---

## 19. レビュー指摘の取り込み(2026-08-15・往復 1 回目)

レビュー報告書 `docs/progress/m22-01-review.md`。**トリアージの全文は同報告書末尾の「取り込み結果(自動トリアージ)」節にある。** ここには結果だけを置く。

| 区分 | 件数 | 内訳 |
|---|---|---|
| 高 | **4 件すべて採用** | A(規約コメント失効) / B・2-a(`Login` が `Enabled()` を見ない) / C・2-c(「起動時 WARN」が事実に反する) / D(完了報告の過大主張) |
| 中 | 4 件採用・1 件不採用 | 採用: 2-b(ロック順) / E(ctx 逸脱の記載) / 8-a(E2E の相互参照) / 8-b(自己診断化)。不採用: 8-b の環境変数案 |
| 低 | 4 件採用・3 件不採用(記録) | 採用: §3 △(実ハンドラのログ検査) / F(フィールド改名) / G(反復回数の上限) / 4-a(記録)。不採用: 6-a(TOCTOU) / 6-b(未認証経路の CPU) / 4-b(メソッド非依存の除外) |

**★「高」の不採用は 0 件**(⇒ 開発者エスカレーションは発動していない)。

### ★実装を変えた 1 件(挙動の修正)

**`Service.Login` が `Enabled()` を見ていなかった**(レビュー指摘 2-a)。
**製造側で独立に再現を確認した**——`password_enabled = false` かつパスワード設定済みの状態で
`POST /api/auth/login` に正しいパスワードを送ると **204 + `Set-Cookie`** が返っていた。

**★これは例外的な状態ではない。** `SetPassword` は `PasswordEnabled` を触らず、
ゲートを外しても `password_hash` は消えないため、**ゲートを一度掛けて外した後の通常状態**である。
指示書 §4.9-4 が「Cookie を発行する方式を採った場合、OFF でも Cookie が付いていないか」と
**名指しで警戒した形がそのまま残っていた**。

是正: `Login` の冒頭に `if !s.Enabled() { return "", false }` を追加。
**破壊確認 C(新設)** でこの判定を外すと `TestLogin_DisabledButPasswordSet_IssuesNoCookie` が
赤くなることを確認した(復旧後の diff 0)。

### その他の実装変更

| 変更 | 内容 |
|---|---|
| `Enabled()` からログを除去 | リクエストごとに呼ばれるため、不整合状態で静的アセット 1 枚ごとに WARN が出ていた。**`WarnIfMisconfigured()` を新設し `main.go` の起動時に 1 度だけ呼ぶ**形へ。⇒ `service.go` の「起動時 WARN」というコメントが事実になった |
| ミドルウェアの判定順 | `isProtected()` を `Enabled()` **より先に**呼ぶ。OFF でも静的アセットを含む全リクエストが `configsvc` の `sync.Mutex`(`PUT /api/config` がプリセット再計算の間ずっと保持する)を通っていた。§4.9-4 の「遅延も含めて変わらない」への対応 |
| `GET /api/auth/status` のフィールド改名 | `passwordEnabled` → **`passwordRequired`**。`GET /api/config` の同名フィールド(生値)と値が割れるため。**消費者(`M22-02`)が未着手の今が最も安く直せる** |
| `maxHashIterations` の追加 | 手編集で巨大な反復回数を書かれたときの CPU 占有への歯止め(超過は照合失敗) |
| テスト追加 3 本 | `TestLogin_DisabledButPasswordSet_IssuesNoCookie` / `TestStatus_DisabledButPasswordSet` / `TestAuthHandlers_DoNotLogCredentials`(**実ハンドラ経路**のログ検査) |

### 記録に留めた指摘(followup 候補。§16 の表へ追加)

| スラッグ(候補) | 内容 |
|---|---|
| `auth-setpassword-toctou` | `SetPassword` は 読(`Security()`)→ 導出(315ms)→ 書(`SetPasswordHash()`)を別ロックで行う。並行 2 本で後着が勝つ。**単独利用のアプリであり §1.2-7 に照らして持ち越し**(レビュー担当も同判断) |
| `auth-unauthenticated-kdf-cost` | `POST /api/auth/login` / `/api/auth/password` は未認証で叩け、1 回 315ms の CPU を使う。レート制限は無い。**`NFR102` と LAN 前提に照らし現状のまま。`M22-05`(LAN 公開面)への入力** |
| `auth-unprotected-paths-are-method-agnostic` | `unprotectedPaths` はパスのみで判定する。将来 `/api/auth/status` に別メソッドを生やすと自動的に無防備になる。**現状は 4 経路とも 1 メソッドずつで実害なし** |
| `auth-anyone-can-set-initial-password-while-off` | **OFF かつ未設定の間は、LAN 上の任意の相手が初回パスワードを設定し、続けてゲートを掛けられる。** 正規の利用者は締め出され、復旧は `config.toml` の直接編集になる。**「認証の根が無い状態では誰も止められない」という原理的な帰結であり欠陥ではない**(`DES-002` §8 の LAN 割り切り)。**★`M22-02` がウィザードで初回設定 UI を作る際の前提である** |

---

*以上、M22-01 完了報告。*
