# M22-05 完了報告: CORS / CSRF の境界（LAN の他端末を塞がずに、設定変更系を守る）

| 項目 | 内容 |
|------|------|
| 作業ID | M22-05 |
| 対象指示書 | `docs/instructions/M22-05-cors-csrf-boundary.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M22-05-review-checklist.md` v1.1.0 |
| CHANGE | `CHANGE-116`（2026-08-16 承認済み＝**D-423**。**着手前ゲート通過を確認**。方式は**案 A**で確定） |
| ブランチ | `claude/m22-05-implementation-plan-wpjxm8` |
| 基点コミット | `1b50017` |
| 実施日 | 2026-08-16 |
| 消費マイグレーション | **0 本**（`migrations/` の diff 0 ファイル） |
| 消費 CHANGE 番号 | **なし**（既存 `CHANGE-116` に紐づく。「次に採番する番号」は不変） |
| 開発者の実機確認（§7.1・`D-398`） | **★実施済み・合格**（2026-08-17。§12） |

> **★本サブの結論を先に書く——境界は 1 か所も締めていない。**
>
> **`internal/` の CSRF 差分は 0 であり、CORS の許可 Origin も 1 文字も変えていない。** これは実装の不足ではなく、**締めることで得られるものが無いと実測で判定した結果**である（§3・§7）。**指示書 §9.4 が「得られるものが書けないなら、締めない方が正しい」と定めており、本報告 §7 がその答えである。**
>
> 実際に行ったのは (1) **撤回された補助対策の残骸の撤去**、(2) **境界の契約テストの新設**、(3) **`DES-002` §4.4 と as-built の差の全数の確定**（§8）の 3 点である。
>
> **★開発者の実機確認（§7.1・`D-398`）は 2026-08-17 に実施され、合格した**（§12）——**スマートフォンから LAN 共有モードのサーバを開き、コンボの保存に加えてセットプレイの登録も通った。** **⇒ 機械が判定できない唯一の項目が埋まり、チェックリスト §9-3 の重大は解消した。**

---

## 1. §3.3 着手前の実査（8 項目）の結果

### 1-1. CORS ミドルウェアの実体と許可 Origin の実値

**実体**: `internal/api/middleware/cors.go`（**70 行**）。**★本報告の行番号はすべて本サブの HEAD 基準である**（本サブで同ファイルへコメントを 5 行足したため、着手前の行番号とは 27 行目以降が 5 行ずれる）。**完全に自前実装**であり、`echo/v4/middleware` はリポジトリ全体で import **0 件**（`golang.org/x/time` は `go.mod` に indirect でも不在）。

| 項目 | 実値 |
|---|---|
| 構築 | **起動時 1 回**。`buildAllowedOrigins()`（`cmd/combomgr/main.go:495-512`）が生成し、`CORS()` が `map[string]struct{}` へ凍結する（`cors.go:20-23`）。**リクエスト時に NIC を再列挙しない** |
| 許可 Origin（local） | `http://localhost:{port}` ／ `http://127.0.0.1:{port}` の **2 本** |
| 許可 Origin（lan） | 上記 2 本 ＋ `http://{SelectPrimaryLANIP()}:{port}` の **3 本** |
| 綴り | **すべて `http://`**（平文 HTTP が前提＝契約 F-3）。**ワイルドカード不使用・完全一致**（スキーム＋ホスト＋ポート） |
| ポート追従 | **実ポートに追従する**。`main.go:211-235` が listener を確保して `cfg.Server.Port = actualPort` を確定させた**後**に `buildAllowedOrigins` を呼ぶ |
| 許可メソッド | `GET, POST, PUT, DELETE, PATCH, OPTIONS`（`cors.go:26`。プリフライト応答時のみ） |
| 許可ヘッダ | 既定 `Content-Type, Origin, Accept, X-Requested-With`（`cors.go:32`）。**ただし `Access-Control-Request-Headers` が来ればそれを逐語エコーする**（`:55-60`）。既定値は ACRH が空のときのフォールバックにすぎない |
| **`AllowCredentials`** | **`"true"` を設定する**（`cors.go:46`）。**許可 Origin のときだけ**。`AllowOrigins` に `*` を使っていないため**組み合わせは成立している**（§4.1-4 クリア） |
| `Vary: Origin` | **許可 Origin のときだけ**付与（`cors.go:45`）。許可外・Origin 不在の応答には付かない |
| **許可外 Origin の扱い** | **★CORS ヘッダを付けないだけで、リクエストは `next(c)` へ通る**（`cors.go:48,67`）。**サーバ側でブロックしない** |
| OPTIONS | **すべて 204 で早期 return し、`next` を呼ばない**（`cors.go:64`） |

**ミドルウェア列**（`cmd/combomgr/main.go:285-296`）: **RequestID → Logger → CORS → Auth → UserContext**。加えて `/api/auth/*` の 4 経路にのみ経路単位の `BodyLimit(8KiB)`。**本サブでこの列の構成・順序は 1 文字も変えていない。**

### 1-2. `X-Requested-With` の付与状況（**全数**）

**★指示書 §1.2 の「フロントは `PUT /api/config` の 1 経路にだけ付与」は陳腐化していた。実測は 6 経路である**（followup `instruction-total-counts-stale-at-start` と同型）。

| # | 付与サイト（着手前） | メソッド | 経路 |
|---|---|---|---|
| 1 | `web/src/lib/configApi.ts:9` | PUT | `/api/config` |
| 2 | `web/src/features/user/userApi.ts:5,13` | POST | `/api/users` |
| 3 | `web/src/features/user/userApi.ts:5,20` | PATCH | `/api/users/:id` |
| 4 | `web/src/features/auth/authApi.ts:49,59` | POST | `/api/auth/login` |
| 5 | `web/src/features/auth/authApi.ts:49,67` | POST | `/api/auth/logout` |
| 6 | `web/src/features/auth/authApi.ts:49,79` | POST | `/api/auth/password` |

- **横断付与ではない。** `web/src/lib/api-client.ts` は `Content-Type` のみ、`web/src/lib/http-interceptor.ts`（`window.fetch` ラッパ）は `X-User-Id` のみを足す。**残り 35 の非 GET 経路には付いていない。**
- **サーバ側の検証は 0 件。** `internal/` の非テストコードにある受信ヘッダの読み取りは **4 箇所だけ**である——`X-User-Id`（`middleware/user.go:45`）／ request-ID（`middleware/logger.go:26`）／ `Origin`（`cors.go:40`）／ `Access-Control-Request-Headers`（`cors.go:55`）。**⇒ 6 経路の付与は完全に装飾だった。**
- **実測でも確認した**——後述 §4 の probe で、`X-Requested-With` を付けずに `PUT /api/config` が 200 で通っている。
- テストで固定されていた箇所が 1 つ: `web/src/features/config/useUpdateConfig.test.ts:53`。

> **★失効した記述を 1 件発見した。** `web/src/features/auth/authApi.ts:48` のコメントが `X-Requested-With` を「**CSRF 第一対策の踏襲**」と記述していた。**`DES-002` §4.4 では第一対策は `SameSite=Strict` Cookie であり、`X-Requested-With` は補助対策である。** **⇒ 案 A 確定以前の時点で既に誤りだった。** 撤去により解消した（§2）。

### 1-3. 非 GET ルートの全数（**数え直した**）

**41 経路**。`/api/auth/*` の 3 本を除くと **38** であり、指示書が引いていた「`M22-03` の実測は 38」と整合する（同じ数を別の母集団で数えていた）。

| メソッド | 件数 | | パッケージ | 件数 |
|---|---|---|---|---|
| POST | 21 | | combo 8 ／ punish 8 ／ setup 7 | 23 |
| DELETE | 11 | | preset 3 ／ tag 3 ／ auth 3 | 9 |
| PATCH | 5 | | comboio 2 ／ intake 2 ／ move 2 ／ user 2 | 8 |
| PUT | 4 | | config 1 | 1 |
| **計** | **41** | | **計** | **41** |

全経路が単一の `apiGroup := e.Group("/api")`（`main.go:301`）に登録されており、**サブグループは存在しない**（`Group.Use` は `/api` と `/api/*` へ `NotFoundHandler` を副作用登録して経路表を変えるため、リポジトリ全体で使用 0 件）。`internal/api/debug/` は GET のみかつ `//go:build debug` のため本数に含めない。

### 1-4. `server.mode` によるミドルウェア構成の分岐

**★変わらない**（`E-84` に従い明示的に記す）。

`main.go:285-296` に条件分岐は 1 つも無く、**登録本数・順序・構成は local / lan で同一**である。`cfg.Server.Mode` を読むのはリポジトリ全体で次の 5 箇所のみ:

| 箇所 | 用途 | ミドルウェアへの影響 |
|---|---|---|
| `main.go:211` | `determineBindHost` | **無し**（bind ホスト） |
| `main.go:233` | `determineBindAddr` | **無し**（bind アドレス） |
| `main.go:235` | `buildAllowedOrigins` | **引数の値のみ**（許可 Origin が 2 本か 3 本か） |
| `main.go:242,249` | ログ・LAN 案内 | **無し** |
| `main.go:350,353` | 起動時通知の IP 一覧 | **無し** |

`internal/api/middleware/` の 5 ファイルはいずれも設定としての `mode` を読まない。**⇒ 境界を守っているのは bind アドレス（`127.0.0.1` vs `0.0.0.0`）であって CORS ではない**（`DES-002` §3.2）。**⇒ §9.3-4 の停止条件には当たらないため、止めずに続行した。**

### 1-5. 設定変更系 API の特別扱い

**無い。** `PUT /api/config` は他の 40 経路とまったく同じ扱いであり、掛かっているのはグローバルな `Auth` だけである。**唯一の経路単位ミドルウェアは `/api/auth/*` の `BodyLimit` であり、これは保護ではなく入力サイズの上限**（`M22-08` の as-built）。

### 1-6. `curl` で非 GET を叩けるか（**最重要ゲート 2**）

**叩ける。実バイナリで確認した**（§4 に着手前後のコマンドと出力）。静的には 3 つの理由による——(a) CORS は Origin 不在時に何もせず通す（`cors.go:42,67`）、(b) `/api/auth/{login,logout,status,password}` は `unprotectedPaths`（`middleware/auth.go:32-38`）、(c) `password_enabled = false`（既定）ならそもそも全経路素通し（`auth.go:62-64`）。

### 1-7. スマートフォン相当の Origin から叩けるか（**最重要ゲート 1**）

**叩ける。** しかも**許可リストに載っていてもいなくても叩ける**——CORS はサーバ側でブロックしないためである（§4 の P3）。**⇒ ブラウザから見ても問題にならない。理由は §3 に記す。**

### 1-8. `make e2e` の前提

**★着手前から落ちる状態だった**（§9.3-6。**自分の変更を疑う前に前提を確認した**）。

| 前提 | 着手前の状態 | 対応 |
|---|---|---|
| `web/node_modules` | **不在** → `Cannot find package '@playwright/test'`（followup `e2e-requires-pnpm-install-on-clean-clone`） | `pnpm install` を実行 |
| `markdown-it-py` | **不在** → `check-artifact-integrity.sh` が 1 本目で赤 | `pip install markdown-it-py`（4.2.0） |
| `config.toml` | **不在** | `make e2e` が `config.toml.example` から生成（Makefile:86-94）。⇒ E2E ポートのオフセットは 0＝**backend 47390 / Vite 5273** |
| `/opt/pw-browsers/chromium` | 在り | `playwright install` はスキップされた |

> **★`markdown-it-py` 不在は M22-01 §4-5 から数えて 5 回目の再発である**（コンテナが使い捨てのため毎セッション再現する）。

---

## 2. 採った案と、実際に行った変更

### 2-1. 方式＝**案 A**（`CHANGE-116` §4・**D-423**。選び直していない）

**★「補助対策を実装しなかった」のではない。案 A の確定に従って実装しない**（指示書 §4.2-4 ／ `CHANGE-116` §4.2）。

**`X-Requested-With` の要求を撤回し、CSRF 対策は `SameSite=Strict` Cookie の 1 本立てとする。** サーバ側に検証は 1 つも足していない（`internal/` の CSRF 差分 **0**）。

### 2-2. 変更したファイル（全数）

| ファイル | 変更内容 | 挙動の変化 |
|---|---|---|
| `web/src/lib/configApi.ts` | `X-Requested-With` の付与を撤去 | **無し**（サーバが読まない） |
| `web/src/features/user/userApi.ts` | 同上（`MUTATION_HEADERS` ごと。2 呼び出し側） | **無し** |
| `web/src/features/auth/authApi.ts` | 同上（3 呼び出し側）＋**誤ったコメントの削除**（§1-2 の枠） | **無し** |
| `web/src/features/config/useUpdateConfig.test.ts` | 期待値から `headers` を削除 | — |
| `internal/api/middleware/cors.go` | **コメントのみ**。`allowedHeaders` に残る `X-Requested-With` が「許可であって要求ではない」ことを明示 | **無し** |
| `internal/api/middleware/boundary_test.go` | **新規**。境界の契約テスト 10 本 | — |
| `cmd/combomgr/main_test.go` | `buildAllowedOrigins` のテスト 4 本を追加（従来 0 件） | — |
| `internal/api/auth/cookie.go` | **コメントのみ**（レビュー取り込み・軽微-1）。`Secure` を付けない理由の参照先 `DES-002 §11` が誤り（同 §11 は「対応 OS とパッケージング・配布」）だったため、`DES-002` §8.1-10 自身が用いている **`§3・契約 F-3`** へ是正 | **無し** |

**★`X-Requested-With` を撤去するか残すかは指示書 §4.2-2 が「どちらでもよい」と定めており、開発者へ判断材料を提示して確認した上で「撤去」を選んだ**（2026-08-16。`CLAUDE.md` §9 ハード列「正解がなく好みが決め手」）。**撤去の理由は機能ではなく記述である**——挙動はどちらでも同一だが、残すと設計卓が `DES-002` §4.4 から補助対策を撤回した後も**コードだけが「CSRF 対策として送っている」と主張し続ける**。

**★`cors.go:32` の応答側 `allowedHeaders` からは外していない。** これは「送ってもよい」の許可であって要求ではなく、外しても得るものが無いためである（指示書 §9.2-3「迷ったら塞がない側」）。**要求と誤読されないよう理由をコメントで明示した。**

### 2-3. 触っていないもの（§2.2 の凍結列・全数確認）

```
$ git diff --stat 1b50017..HEAD -- internal/api/middleware/auth.go internal/api/auth/ \
    internal/service/notation/ internal/service/preset/ \
    web/src/features/physical-input/ web/src/features/gamepad/ web/src/features/keyboard/ \
    migrations/ character_data/ docs/design/ \
    go.mod go.sum web/package.json web/pnpm-lock.yaml
（出力なし＝全対象で diff 0）
```

- 認証ミドルウェア・保護対象の経路の列: **diff 0**
- Cookie の属性（`internal/api/auth/cookie.go`）: **diff 0**（**`Secure` を足していない**）
- 契約 F-4 / F-5 の面: **diff 0**
- `migrations/` ／ `character_data/` ／ `docs/design/`: **diff 0**
- `go.mod` / `go.sum` / `package.json` / `pnpm-lock.yaml`: **diff 0**。**`golang.org/x/time` は不在**（`grep -n "golang.org/x/time" go.mod` → 0 件）
- 競合モーダル・保存エラーの分類（`M22-04` の as-built）: **diff 0**
- `combo_tags` の読み書き: **diff 0**

---

## 3. ★中心的な発見: 本アプリにクロスオリジン経路は存在しない

**この 1 点が、本サブで「締めない」を選んだ根拠である。**

| 経路 | ブラウザから見た Origin 関係 | 根拠 |
|---|---|---|
| 本番（単一バイナリ） | **同一オリジン** | SPA を Go が embed 配信し、API は同じ host:port |
| 開発（Vite dev server・**`:5173`**） | **同一オリジン** | `web/vite.config.ts` が `/api` を backend へ proxy、`web/src/lib/api-client.ts:4` は `API_BASE = ""` |
| E2E（Playwright・**`:5273`**） | **同一オリジン** | 同上（Vite 経由。`baseURL = http://localhost:5273`） |
| スマートフォン | **同一オリジン** | `http://<LAN IP>:47318` を開き、同じ host:port の `/api` を叩く |

**帰結が 3 つある。**

1. **★指示書 §4.1-3 の「LAN IP は 1 つとは限らない」問題は実害を持たない。** 副 NIC の IP・mDNS 名・ポート転送のいずれで開いても、**その端末から見れば同一オリジン**であり CORS は発動しない。**⇒ 許可リストが代表 IP 1 本でも塞がらない。** これが「許可 Origin の組み立て方を変えなかった」理由である（§9.2-3 の自己判断事項）。
2. **★許可外 Origin を「拒否する」ように締めると、開発と E2E が壊れる。** Vite proxy は `changeOrigin: false` のためクライアントの `Origin` を backend へ逐語で転送する——**dev は `http://localhost:5173`、E2E は `http://localhost:5273`**（`web/playwright.config.ts` の `BASE_E2E_VITE_PORT`）。**`buildAllowedOrigins` はそのどちらも生成しない。** **いま dev と E2E が動いているのは「許可外 Origin でも `next(c)` へ通す」という現行実装のおかげである。**
3. **★プリフライトはそもそも飛ばない**（同一オリジンのため）。`AllowCredentials` / `Vary` / `Max-Age` の設定は、**実運用では 1 度も評価されない経路**にある。

---

## 4. `curl` 相当の経路が着手前後で変わっていないことの証跡（§7.5-4）

**★実バイナリを起動して実測した。** local モードのポート 47500（着手前）／ 47501（着手後）、使い捨ての DB と `config.toml`。

> **★lan モードでの実測はできなかった（環境要因）。** 本コンテナの非ループバックアドレスは **`192.0.2.2`（RFC 5737 の TEST-NET-1）1 本のみ**であり、`netutil.IsPrivateIPv4` が正しく RFC1918 外として弾くため `SelectPrimaryLANIP` が `ErrNoLANIP` を返し、**lan モードは起動時に中止される**（実測: `fatal: build allowed origins: LAN モードで起動できる IP が見つかりません`）。**⇒ これは実装の欠陥ではなく、仕様どおりの挙動である。** lan モードの許可リストの検証は Go テスト側で許可リストを注入して行った（§6）。**⇒ §7.1 の開発者による実機確認の重みが、その分だけ増している。**

### 4-1. 着手前（コミット `1b50017` の状態でビルドしたバイナリ）

```bash
$ curl -s -i -X POST http://127.0.0.1:47500/api/auth/login \
    -H 'Content-Type: application/json' -d '{"password":"probe"}'
HTTP/1.1 401 Unauthorized
{"error":{"code":"invalid_password","message":"incorrect password"}}
```
**★`invalid_password` はハンドラが返すコードである。** ミドルウェアの `unauthorized` ではない。**⇒ 要求はハンドラまで到達している。**

```bash
$ curl -s -i -X POST http://127.0.0.1:47500/api/tags -H 'Origin: http://127.0.0.1:47500' ...
HTTP/1.1 201 Created
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: http://127.0.0.1:47500
Vary: Origin

$ curl -s -i -X POST http://127.0.0.1:47500/api/tags -H 'Origin: http://192.168.1.50:47500' ...
HTTP/1.1 201 Created        ← ★許可外だが到達する。CORS ヘッダは付かない

$ curl -s -i -X POST http://127.0.0.1:47500/api/tags -H 'Origin: http://evil.example' ...
HTTP/1.1 201 Created        ← ★同上
```

**入場ゲートを ON にした状態（`passwordRequired: true`）:**

```
--- 対照: 保護対象は 401 でブロックされる（ゲートが実際に効いている証拠）---
  POST /api/tags   -> {"error":{"code":"unauthorized",...}} [401]
  POST /api/combos -> {"error":{"code":"unauthorized",...}} [401]
  PUT  /api/config -> {"error":{"code":"unauthorized",...}} [401]
  GET  /api/combos -> {"error":{"code":"unauthorized",...}} [401]

--- ★最重要ゲート 2: curl 相当（Origin なし・独自ヘッダなし）で /api/auth/* ---
  GET  /api/auth/status   -> {"passwordRequired":true,"passwordSet":true,"authenticated":false} [200]
  POST /api/auth/logout   -> [204]
  POST /api/auth/login(誤)-> {"error":{"code":"invalid_password",...}} [401]
  POST /api/auth/login(正)-> [204]
  → そのセッションで POST /api/tags -> [201]   ★復旧経路が最後まで機能する
```

### 4-2. 着手後（`HEAD` でビルドしたバイナリ）

**★すべて同一である**（ポート番号を除いて出力が一致）。

```
P1 curl 相当 POST /api/auth/login              -> HTTP/1.1 401 Unauthorized   （同一）
P2 許可 Origin POST /api/tags                  -> 201 + Allow-Origin/Allow-Credentials/Vary（同一）
P3 未登録の LAN 風 Origin POST /api/tags       -> 201、CORS ヘッダなし        （同一）
P4 evil.example POST /api/tags                 -> 201、CORS ヘッダなし        （同一）
P5 プリフライト（許可 Origin）                 -> 204 + Allow-Methods/Headers/Max-Age（同一）
P6 プリフライト（evil.example）                -> 204、CORS ヘッダなし        （同一）

入場ゲート ON:
  対照 POST /api/tags      -> {"error":{"code":"unauthorized",...}} [401]      （同一）
  GET  /api/auth/status    -> [200]                                            （同一）
  POST /api/auth/logout    -> [204]                                            （同一）
  POST /api/auth/login     -> [204]                                            （同一）
  → そのセッションで POST /api/tags -> [201]                                    （同一）
```

**⇒ `DES-002` §8.2 の歯止め b（`curl` 相当が唯一の復旧経路）は、着手前後で 1 つも変わっていない。**

> **★併せて実測した——`PUT /api/config` が `X-Requested-With` 無しで 200 を返した**（入場ゲートを ON にする操作そのものを curl で行った）。**これが「サーバ側の検証が 0 件」の実行時の裏付けである。**

### 4-3. Cookie の属性（§5.1-7）

```
$ curl -s -i -X POST .../api/auth/login -d '{"password":"..."}' | grep -i '^Set-Cookie:'
Set-Cookie: combomgr_session=<SESSION>; Path=/; HttpOnly; SameSite=Strict
```

**★`Secure` が付いていない**（着手前後とも）。平文 HTTP の LAN 構成では、付けると Cookie が保存されず入場できなくなる（契約 F-3 ／ `DES-002` §8.1-10）。**属性は 1 つも変えていない。**

---

## 5. 破壊確認 A の結果（§5.1-4・チェックリスト §1-4）

**改変内容**: `cors.go` の**境界の判定（許可リストの照合）を外した**——`if _, ok := allowed[origin]; ok` を `ok || true` に倒し、すべての Origin を許可扱いにした（2 箇所＝通常応答とプリフライト）。**この改変はコミットしていない**（実施後ただちに復旧し、`git diff` が空であることを確認済み）。

```
--- PASS: TestBoundary_CurlEquivalentReachesAuthRoutes (0.00s)          ★§5.1-1 緑のまま
--- PASS: TestBoundary_GateIsActuallyOn (0.00s)
--- PASS: TestBoundary_AuthRoutesDoNotRequireLegacyHeader (0.00s)
--- PASS: TestBoundary_LANOriginNonGETIsAllowed (0.00s)                 ★§5.1-2 緑のまま
--- PASS: TestBoundary_LANOriginPreflightIsAllowed (0.00s)              ★§5.1-2 緑のまま
--- FAIL: TestBoundary_ForeignOriginNonGETIsProcessedWithoutCORSHeaders ★§5.1-3 赤くなった
--- FAIL: TestBoundary_ForeignOriginPreflightGetsNoCORSHeaders          ★§5.1-3 赤くなった
--- PASS: TestBoundary_SameOriginPathNeverEngagesCORS (0.00s)
--- PASS: TestBoundary_ModeDoesNotChangeTheMainPath (0.00s)
--- PASS: TestBoundary_LoopbackOriginAllowedInBothModes (0.00s)
FAIL	github.com/plexiblinp/combomgr/internal/api/middleware	0.008s
```

失敗の中身:
```
boundary_test.go:275: POST /api/combos: Access-Control-Allow-Origin = "http://evil.example", want empty
boundary_test.go:275: POST /api/combos: Access-Control-Allow-Credentials = "true", want empty
boundary_test.go:275: POST /api/combos: Vary = "Origin", want empty
```

**判定**: **§5.1-3 が赤くなり、§5.1-1 と §5.1-2 は緑のままだった。** **⇒ これが「締めすぎていない」の証拠である**（チェックリスト §1-4）——境界の判定を外しても復旧経路と LAN 経路には影響が出ない、すなわちそれらは境界の判定に依存していない。

**復旧の確認**:
```
$ git diff --stat internal/api/middleware/cors.go
（出力なし）
$ go test -run 'TestBoundary_' ./internal/api/middleware/
ok  	github.com/plexiblinp/combomgr/internal/api/middleware	0.009s
```

> **★赤にならなかった項目について「何が代わりに守っていたか」**（`SUPP-001` §5.5 (10′)）——§5.1-1 と §5.1-2 を守っているのは **CORS の許可判定ではなく、(a) 認証ミドルウェアの `unprotectedPaths`（`middleware/auth.go:32-38`）と (b) 「CORS は許可外 Origin をブロックしない」という設計**である。**⇒ この 2 つは別の層にあり、本サブでどちらも変更していない。**

---

## 6. テスト（§5.1 の 8 項目・§5.2）

### 6-1. §5.1 の 8 項目の対応

| § | 確認項目 | 置き場 | 結果 |
|---|---|---|---|
| 1 | `curl` 相当で `/api/auth/*` を叩ける | `TestBoundary_CurlEquivalentReachesAuthRoutes` ＋ 対照 `TestBoundary_GateIsActuallyOn` ＋ §4 の実測 | **PASS** |
| 2 | LAN IP の Origin から非 GET を叩ける | `TestBoundary_LANOriginNonGETIsAllowed` ／ `TestBoundary_LANOriginPreflightIsAllowed` | **PASS** |
| 3 | 別ホストの Origin が意図どおり扱われる | `TestBoundary_ForeignOriginNonGETIsProcessedWithoutCORSHeaders` ／ `..._ForeignOriginPreflightGetsNoCORSHeaders` | **PASS** |
| 4 | 破壊確認 A | §5（手動・コミットせず） | **実施済み**（3 が赤、1・2 は緑） |
| 5 | 既存の全経路が通る（非回帰） | `TestBoundary_SameOriginPathNeverEngagesCORS`（代表 7 経路）＋ `go test ./...` 全緑 ＋ `make e2e` | **PASS** |
| 6 | 独自ヘッダの横断付与 | **★該当なし**（案 A は独自ヘッダを要求しないため発動しない） | **該当なし** |
| 7 | Cookie に `Secure` が付いていない | **既存の `internal/api/auth/handler_test.go:120-132` が既に主張済み**。重複させず、§4-3 の実測で裏付けた | **PASS**（既存） |
| 8 | `server.mode` を切り替えても境界の構成が変わらない | `TestBuildAllowedOrigins_*` 4 本 ＋ `TestBoundary_ModeDoesNotChangeTheMainPath` ＋ §1-4 の全数実査 | **PASS**（1 件 skip・下記） |

**★§5.1-3 の「主張」を明記する**——**「CORS では止まらない」**を採った。別ホストの Origin からの非 GET は**サーバに到達して処理される**。守っているのは CORS ではなく `SameSite=Strict` Cookie であり、クロスサイト起点の要求には Cookie が載らないため入場ゲートが 401 を返す（§4-1 の対照が実測）。**主張と実装は一致している。**

**★環境依存の skip が 1 件ある**——`TestBuildAllowedOrigins_LanModeAppendsToLocalList` は、代表 LAN IP を検出できない環境では `t.Skip` する。**本コンテナでは skip された**（理由は §4 冒頭）。**⇒ 開発者機（RFC1918 の IP を持つ）では実行される。** lan モードの許可リストの中身そのものは `TestBoundary_LANOriginNonGETIsAllowed`（許可リストを注入）が別途カバーしている。

**★新設したテストのケース数**: `internal/api/middleware/boundary_test.go` **10 本**（新規ファイル）、`cmd/combomgr/main_test.go` **4 本**（追加。同ファイルの `buildAllowedOrigins` 系テストは従来 **0 本**だった）。

### 6-2. §5.2 E2E

- **A（通常の保存が通る・非回帰）**: **既存 spec で充足するため新規 spec を追加していない。** 実査した結果、本サブが触った 4 経路はいずれも既存 E2E が踏んでいる——`PUT /api/config` が **19 spec**、`POST/PATCH /api/users` が **11 spec**（`m22-02` が作成・選択、`m22-08 C` が改名を直接検査）、`/api/auth/{login,logout,password}` が `m22-01` / `m22-02` / `m22-08` の 3 spec、コンボ保存が `combo-crud.spec.ts`。**⇒ 新規 spec を足すと、弱い証拠と引き換えにサーバの共有状態を書き換えるリスク（D-399 (1)）だけが増える。**
- **B**: **★該当なし**（案 A は独自ヘッダを要求しないため発動しない）。

> **★E2E は同一オリジンで走るため、「締めすぎていない」の弱い証拠にしかならない**（チェックリスト §5）。**本サブで強い証拠になっているのは §5 の破壊確認 A と §4 の実バイナリ probe であり、E2E は非回帰の確認に限る。**

### 6-3. 機械検査の結果（§7.2）

**★コマンド自身の出力で記す**（教訓 `E-125`）。

| 検査 | 着手前（ベースライン） | 着手後 |
|---|---|---|
| `go vet ./...` | 出力なし（緑） | **出力なし（緑）** |
| `go test ./...` | 全緑 | **`ok` 52 パッケージ / `FAIL` 0 件** |
| `pnpm test` | `Test Files 167 passed (167)` / `Tests 1664 passed (1664)` | **`Test Files 167 passed (167)` / `Tests 1664 passed (1664)`** |
| `pnpm lint`（`tsc --noEmit`） | 出力なし（緑） | **出力なし（緑）** |
| `make e2e` | `149 passed (2.9m)` | **`149 passed (2.8m)`（flaky 0。§6-4）** |

### 6-4. `make e2e`（着手後）

**★最終状態（レビュー取り込み後）**——**ベースラインと完全に一致した。**

```
149 passed (2.8m)
[exited with code 0]
```

**⇒ flaky 0 件。着手前ベースライン（`149 passed`）と同数である。**

**★取り込み前の 1 回目には flaky が 1 件出ていた**ので、経緯を残す。

```
148 passed (2.8m)
  1 flaky
    [chromium] › e2e/m18-03a-punish-mylist.spec.ts:268:3 › M18-03a 確定反撃マイリスト ›
      B: pruning で隠す→探す画面から消える→マイリストで解除→戻る(片道操作の解消)
[exited with code 0]
```

**終了コード 0（緑）だが flaky が出たため、開発者の指示（2026-08-16）に従い個別実行で切り分けた。**

```bash
$ PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm exec playwright test \
    e2e/m18-03a-punish-mylist.spec.ts --reporter=line
3 passed (10.1s)
```

**⇒ 個別実行では spec ファイル全 3 本が通る。****そして最終状態の一括実行では再現しなかった（`149 passed`・flaky 0）。****⇒ 一括実行時にだけ、しかも再現性なく出る事象である。**

**★本サブの変更とは無関係と判断した根拠**（「自分の変更が壊した」と即断しないこと）:
1. **着手前のベースラインでは `149 passed` で flaky 0 件**だった。同じ spec が通っていた
2. 当該 spec は**確定反撃マイリストの pruning 動線**であり、本サブが触った 4 経路（`/api/config`・`/api/users`・`/api/auth/*`・コンボ保存）とは**別の面**である
3. 撤去した `X-Requested-With` は**サーバが 1 度も読まないヘッダ**であり（§1-2・§4-2 の実測）、有無で挙動が変わりうる経路が存在しない
4. **個別実行で 3 本とも緑**（上記）、**かつ取り込み後の一括実行で再現せず 149 passed**（ベースラインと同数）

> **★切り分けの過程で 1 度誤った赤を踏んだので記録する。** 最初 `pnpm exec playwright test` を素で叩いたところ `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1223/...` で落ちた。**これはテストの失敗ではなく環境の問題である**——`make e2e` は `PW_EXECUTABLE_PATH` を `/opt/pw-browsers/chromium` に設定してから `pnpm e2e` を呼ぶ（Makefile:84,95-104）が、`pnpm exec playwright test` を直接叩くとその env が渡らず、既定の headless shell（未導入）を探しに行く。**⇒ 個別実行するときは `PW_EXECUTABLE_PATH` を明示すること。**

---

## 7. ★締めた／締めなかったことの理由（§7.5-3・§9.4・チェックリスト §9-12）

### 7-1. 「締めることで何が得られるか」— **得られるものが無い**

**★指示書 §9.4 は「得られるものが書けないなら、締めない方が正しい」と定めている。以下がその実査結果である。**

| 締める候補 | 得られるもの | 失うもの | 判断 |
|---|---|---|---|
| 許可外 Origin を**サーバ側で拒否**する | **無い。** ブラウザは同一オリジン要求に CORS を適用せず、本アプリの全経路が同一オリジンである（§3）。攻撃者のクロスサイト要求は既に `SameSite=Strict` により Cookie を載せられず 401 になる（§4-1 の対照が実測） | **`curl` 相当の復旧経路**（`DES-002` §8.2 歯止め b）／ **Vite dev proxy 経由の開発と E2E**（`Origin` は dev が `:5173`・E2E が `:5273` で、いずれも許可リストに無い） | **締めない** |
| 許可 Origin を**代表 IP 1 本から全 NIC へ広げる** | **無い。** 副 NIC 経由のアクセスも当該端末から見れば同一オリジンであり CORS が発動しない（§3-1） | 起動時の NIC 列挙が増える | **変えない** |
| 非 GET の全経路へ**独自ヘッダを要求**する（案 B） | 設計書どおりの多層防御の見かけ。**ただし `CHANGE-116` §4.1-3 のとおり 2 層は独立していない**（どちらもブラウザが仕様どおり動くことに乗っている） | **`curl` からの操作が `/api/auth/*` 以外で全部壊れる** | **案 A 確定済み。採らない** |
| `cors.go` の `allowedHeaders` から `X-Requested-With` を外す | **無い**（許可であって要求ではなく、ACRH があれば逐語エコーされるため実質 inert） | 将来送りたくなったときの手数 | **外さない** |

### 7-2. 締めた箇所

**★1 つも無い。** `internal/` の境界の挙動に対する差分は **0** である（`cors.go` の変更はコメントのみ）。

**これは `NFR102`「過剰でない対策」と整合する。** `DES-002` §4.4 の脅威モデル（「LAN 内は信頼する」＝同一 LAN 内の悪意あるデバイスはネットワーク側の防御責任）は**変更していない**。

> **★文言について**——本報告は「安全である」と書いていない（契約 F-3 ／ 指示書 §1.3）。書けるのは**平文 HTTP の LAN 構成という条件下で、この境界がこう振る舞う**までである。

---

## 8. ★`DES-002` §4.4 と as-built の差の全数（§6.5・§7.5-5）

**設計卓が `CHANGE-116` の反映で使う。★網羅を意図して全数で書く。**

### 8-1. §4.4 の既存記述に対する差

| # | §4.4 の記述（逐語） | as-built | 差 |
|---|---|---|---|
| 1 | 「Origin は同一ホスト（サーバー自身の IP:PORT）のみ許可する」 | local: `http://localhost:{port}` ＋ `http://127.0.0.1:{port}` の **2 本**。lan: それに `http://{代表 LAN IP}:{port}` を足した **3 本** | **★差あり（両方向）。** 「同一ホスト」より**広い**（`localhost` という名前も別 Origin として許可している）と同時に**狭い**（複数 NIC のうち代表 1 本だけ）。**⇒ 実値で書き直しが要る** |
| 2 | 「第一対策：SameSite=Strict Cookie による Cookie 送信制限」 | **成立している**（`M22-01`）。`combomgr_session; Path=/; HttpOnly; SameSite=Strict`、**`Secure` なし**、`Max-Age` なし | **差なし。ただし属性の実値が §4.4 に無い**（`Secure` を付けない理由は §8.1-10 にあるが §4.4 側にも要る） |
| 3 | 「補助対策：POST/PUT/DELETE/PATCH リクエストに独自ヘッダ（`X-Requested-With`）を要求し、CORS preflight と組み合わせて簡易的な検証を行う」 | **★サーバ側の検証は最初から 0 件。フロント側の付与（6 経路）も本サブで撤去した** | **★撤回が要る。** `CHANGE-116` §4.2 のとおり「**実装しなかった**」ではなく「**要らないと判断した**」と理由（§4.1 の 1〜3）付きで書くこと |
| 4 | 脅威モデル「LAN 内は信頼する」 | **変更なし** | **差なし** |

### 8-2. §4.4 に記述が無く、書き足しが要る as-built（`CHANGE-116` §2 の (c)(d) に対応）

| # | 書き足す内容 | 根拠 |
|---|---|---|
| 5 | **許可外 Origin をサーバ側でブロックしない。** CORS 応答ヘッダを付けないだけで、要求はハンドラまで到達する。ブラウザ側が応答の読み取りを拒否する | `cors.go:48,67`。§4 の P3/P4 で実測 |
| 6 | **★これは意図した設計である。** サーバ側で拒否すると `curl` 相当の復旧経路（§8.2 歯止め b）と Vite dev proxy 経由の開発・E2E が壊れる | §3-2 |
| 7 | **本アプリの主経路はクロスオリジンではない**（本番・dev・E2E・スマートフォンのすべてが同一オリジン）。**⇒ CORS が実際に評価される場面は無く、プリフライトも飛ばない** | §3 |
| 8 | **境界を守っているのは bind アドレス**（local=`127.0.0.1` / lan=`0.0.0.0`）**であって CORS ではない。⇒ `server.mode` で CORS/CSRF の構成を変えない** | §1-4。`DES-002` §3.2 |
| 9 | **許可メソッドの実値** `GET, POST, PUT, DELETE, PATCH, OPTIONS` | `cors.go:26` |
| 10 | **許可ヘッダの実値** 既定 `Content-Type, Origin, Accept, X-Requested-With`。**ただし `Access-Control-Request-Headers` が来ればそれを逐語エコーする**（既定値は ACRH 空時のフォールバック）。**★`X-Requested-With` がここに残るのは許可であって要求ではない** | `cors.go:32,55-60` |
| 10-a | **★既定の一覧は as-built の説明として二重に古い。** 撤回された `X-Requested-With` を挙げている一方、**実際にフロントが送っている独自ヘッダ `X-User-Id`（`web/src/lib/http-interceptor.ts` が `window.fetch` を包んで付与）を挙げていない。** **⇒ 実害は無い**（主経路は同一オリジンでプリフライトが飛ばず、仮に飛んでも ACRH が逐語エコーされるため通る）**が、この一覧を「送ってよいヘッダの正本」として読むと誤る** | `cors.go:32`。`web/src/lib/http-interceptor.ts:17,107-109` |
| 11 | **`Access-Control-Allow-Credentials: true` を返す。許可 Origin のときだけ。** ワイルドカードを使っていないため成立している | `cors.go:46` |
| 12 | **`Vary: Origin` は許可 Origin のときだけ付く** | `cors.go:45` |
| 13 | **OPTIONS はすべて 204 で早期 return し、後続ミドルウェアを呼ばない。** ⇒ 入場ゲートが有効でもプリフライトが 401 にならない（CORS を Auth より前に置く理由） | `cors.go:64`。`main.go:288-290` |
| 14 | **許可リストは起動時に 1 回だけ構築し、実ポート（競合フォールバック後）に追従する。空リストは全拒否を意味し、ワイルドカードは使わない** | `cors.go:10-23`。`main.go:211-235` |

---

## 9. 否定形確認の走査コマンドと結果（§4.9）

**★陽性対照を混ぜてある**（`E-84`。「0 件だった」は「無い」ではなく「走査が壊れている」かもしれない）。

### 9-1. 走査 1: 撤回した `X-Requested-With` の残骸

```bash
$ LC_ALL=C.UTF-8 grep -rl -E "X-Requested-With|XMLHttpRequest" internal/ web/src/ web/e2e/
internal/api/middleware/boundary_test.go
internal/api/middleware/cors.go

$ LC_ALL=C.UTF-8 grep -rn -A1 -B1 -E "X-Requested-With|XMLHttpRequest" internal/ web/src/ web/e2e/
internal/api/middleware/boundary_test.go-45-	// ★サーバがこれを要求しないことを固定するために使う。
internal/api/middleware/boundary_test.go:46:	boundaryLegacyHeader = "X-Requested-With"
internal/api/middleware/boundary_test.go-47-)
--
internal/api/middleware/cors.go-28-		//
internal/api/middleware/cors.go:29:		// ★X-Requested-With を検証するコードは無い(CHANGE-116・案 A で補助対策は
internal/api/middleware/cors.go-30-		// 撤回された)。ここに残っているのは許可であり、外しても得るものが無いため
internal/api/middleware/cors.go-31-		// 残してある。「独自ヘッダを要求している」と読まないこと。
internal/api/middleware/cors.go:32:		allowedHeaders = "Content-Type, Origin, Accept, X-Requested-With"
internal/api/middleware/cors.go-33-		maxAge         = "600"

# ★陽性対照（E-84）: DES-002 §4.4 は必ず当たること
$ LC_ALL=C.UTF-8 grep -rn "X-Requested-With" docs/design/02-architecture.md
341:- **補助対策**：POST/PUT/DELETE/PATCH リクエストに独自ヘッダ（`X-Requested-With`）を要求し、…
```

**陽性対照が命中したため、走査は機能している。**

**残った 2 件はいずれも意図的である**（**★当たったファイルは全文を目で見た**）:
1. `cors.go:32` — **応答側の許可リスト**。§2-2 のとおり残す判断。要求と誤読されないようコメントを付けた
2. `boundary_test.go:46` — **「サーバがこれを要求しないこと」を固定するためのテスト定数**。案 B へ倒す実装が入ると赤くなる

**⇒ `web/src/` ／ `web/e2e/` からは 0 件になった**（着手前は `web/src/` に 3 ファイル 7 行）。

### 9-2. 走査 2: 「CSRF 対策は未実装である」旨の記述

```bash
$ LC_ALL=C.UTF-8 grep -rl "CSRF" docs/ internal/ web/src web/e2e
（48 ファイル。うち実装コードは internal/api/auth/cookie.go と web/src/features/auth/authApi.ts の 2 件）
```

**実装コード側の 2 件を目視した**:
- `internal/api/auth/cookie.go:22` — 「`SameSite=Strict`: 外部サイト起点のリクエストで送られない（`DES-002` §4.4 が CSRF 第一対策として前提にしている形）」。**★正しい記述であり、案 A 確定後もそのまま有効。手を入れていない**
- `web/src/features/auth/authApi.ts:48` — 「CSRF 第一対策の踏襲」と**誤って**書かれていた。**★撤去済み**（§1-2）

**⇒ 着手後、`web/src/` に `CSRF` の記述は 0 件。** 設計文書・指示書・followup 側の記述は設計卓の担当であり、製造は触らない（`CLAUDE.md` §8）。

### 9-3. 走査 3: `Secure` 属性

```bash
$ LC_ALL=C.UTF-8 grep -rn "Secure\b|secure: true|Secure:" --include=*.go internal/ cmd/   （-E）
internal/api/auth/cookie.go:24://   - Secure: 付けない。本アプリの LAN 構成は平文 HTTP であり(DES-002 §11)、
```

**本番コードで `Secure` を設定している箇所は 0 件**（唯一のヒットは「付けない」と書いたコメント）。テスト側には `internal/api/auth/handler_test.go:129-131` が**付いていないことを主張する**アサーションを持つ。**§4-3 の実バイナリでの `Set-Cookie` 実測とも一致した。**

---

## 10. 並列相手が居なかったこと（§7.5-8・`E-121`）

**★本サブは直列である**（`m22-contract` §3.3。指示書 §11「並列性: ★直列。並列にしない」）。**並列で走っていた他サブは無く、`M22-01`〜`M22-04` / `M22-08` はいずれもマージ済みの状態を基点（`1b50017`）としている。** 作業ツリーは本サブの変更のみを含み、他レーンとの突合は発生していない。

---

## 11. スコープ外として閉じた項目

| 項目 | 判断 |
|---|---|
| **`auth-unauthenticated-kdf-cost`**（`M22-01` 設計伝達レポート §4-1 が **`M22-05` へ割り付けた** followup） | **★実査した上で現状維持。** `POST /api/auth/login` / `/password` は未認証で叩け、1 回あたり約 315ms の CPU を使うがレート制限が無い。指示書 §1.5-2 がスコープ外と明示し、判定は「`NFR102`「過剰でない対策」と LAN 前提から、現状のままで方針と整合している」。**加えてレート制限は `echo/v4/middleware` 経由で `golang.org/x/time/rate` の新規依存を招き、§2.3 が禁じている。⇒ 実装しない** |
| `auth-unprotected-paths-are-method-agnostic` | 記録のみ・低（指示書 §1.5-3）。現状 4 経路とも登録メソッドが 1 つずつで実害が無く、メソッド対の表はルート定義との二重管理を生む。**触っていない** |
| `csrf-design-vs-implementation-gap` | **★本サブが案 A で決着させた対象そのもの。** 設計卓が `DES-002` §4.4 を改訂した時点で閉じられる（§8-1 の #3） |
| HTTPS の導入 ／ `server.mode` の切替 UI・警告文言 ／ Cookie 属性の変更 ／ 認証ミドルウェアの構成 | 指示書 §1.5 のとおりスコープ外。**いずれも diff 0**（§2-3） |

---

## 12. 開発者の手動確認（§7.1・**D-398**）— **★実施済み・合格**（2026-08-17）

**確認事項は 1 項目だけである。**

> **スマートフォン（または別の端末）から LAN 共有モードのサーバを開き、コンボを 1 つ保存できる。**

**手順**:
1. `config.toml` の `[server].mode` を `"lan"` にして起動する
2. 起動ログの `allowed_origins` に `http://<自機の LAN IP>:<port>` が入っていることを確認する（**★入っていなければ代表 IP の選定が想定と違う**）
3. スマートフォンを**同じ Wi-Fi** につなぎ、`http://<その LAN IP>:<port>/` を開く
4. **コンボを 1 つ保存する**
5. （任意）入場ゲートを ON にしている場合は、スマートフォンからログインできることも確認する

### 結果（開発者報告・2026-08-17）

| # | 項目 | 結果 |
|---|---|---|
| 1 | スマートフォンから LAN 共有モードのサーバを開けた | **合格** |
| 2 | **コンボを 1 つ保存できた**（＝§7.1 の必須項目） | **合格** |
| 3 | **セットプレイの登録も通った**（**★要求範囲外の追加確認**） | **合格** |

**⇒ 最重要ゲート 1（LAN の他端末を塞がないこと）は実機で成立した。**

**★項目 3 は指示書が求めていない追加確認であり、本サブの主張を 1 段強めている。** 理由——セットプレイの登録は `POST /api/combos/:comboId/setups` 等の**別パッケージの非 GET 経路**（`internal/api/setup/routes.go`）を通る。コンボ保存（`internal/api/combo/routes.go`）だけなら「その 1 経路がたまたま通った」possibility が残るが、**登録ファイルの異なる 2 系統が LAN 端末から通った**ことで、非 GET 全体が塞がれていないことの証拠になる。**⇒ §5.1-5（既存の全経路が通る）の実機側の裏づけとしても働く。**

> **★開発者が明示的に報告していない項目**（過大に主張しないために記す）——手順 2 の `allowed_origins` の目視確認、および手順 5（入場ゲート ON でのスマートフォンからのログイン）は**報告に含まれていない**。**★ただしどちらも合否判定に影響しない**——手順 2 は失敗時の切り分け用であり、成功した以上代表 IP の選定は正しく働いている。手順 5 は指示書側でも任意である。

### 機械が判定できなかったものが、これで埋まった

**★本サブで機械が判定できないのはこの 1 項目だけだった**（チェックリスト §9-3 は未実施を重大＝完了承認を妨げると定めていた）。**⇒ 実施済み・合格により、この重大は解消した。**

**★あわせて、本セッション側の測定の穴も実機で埋まった。** §4 冒頭のとおり**クラウド実行環境では lan モードの起動自体ができず**（非ループバックが `192.0.2.2`＝TEST-NET-1 のみで `SelectPrimaryLANIP` が `ErrNoLANIP` を返す）、LAN IP の Origin は**注入した許可リストに対する Go テストでしか確認できていなかった**。**⇒ 実物の代表 LAN IP で `buildAllowedOrigins` が働くことは、この手動確認だけが確かめている。**

> **★「壊していない」側の根拠も揃っていた**——境界の挙動に対する差分が 0 であり（§2-3・§7-2）、着手前後の実バイナリ probe が同一の出力を返していた（§4）。**⇒ 事前の見立て（LAN 経路を壊した可能性はきわめて低い）と実機の結果は一致した。** それでも手動確認が要ったのは、`localhost` では現れない壊れ方（`M22-overview` §4.4.1 の (c) 型）を潰すためである。

---

## 13. ■ 併せて更新が要るもの（§7.5-9・教訓 `E-114` ／ D-277・D-297）

**★該当なし。** 内訳を全数で示す。

| 対象 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** 本サブは `CHANGE-116`（設計卓が起票済み）に紐づき、**新規採番していない**（指示書 §6.5「製造は新規採番しない」）。**⇒ `docs/handover/change-number-registry.md` §1 への追記は不要** |
| **「次の番号」の写し先 4 か所**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4） | **不変**（新規採番が無いため）。**★総数 4 は先例の実査値であり、本サブでは消費が無いので突き合わせ対象そのものが発生していない** |
| **消費したマイグレ連番** | **なし。** `ls migrations/` と `git diff --stat migrations/` の双方で変化 0。ボード §2.2 の「次に払い出す番号」は不変 |
| **版を上げた文書の参照元** | **なし。** 本サブは設計書・指示書・チェックリストのいずれの版も上げていない（`docs/design/` は diff 0） |
| **`web/CLAUDE.md` §1 ブラウザストレージ台帳** | **不要。** 本サブはブラウザストレージを 1 件も追加・変更していない |
| **列挙定数の同期**（`scripts/check-enum-sync.sh`） | **不要。** 新しい列挙定数を追加していない（拒否の実装を足さないため、エラーコードの新設も無い） |

---

## 13.5. ★設計伝達レポート（§4 残課題）へ上げる項目

**レビュー指摘【中-3】による。本サブでは直さない。**

| 項目 | 内容 |
|---|---|
| **ミドルウェア列の順序を実組立で検査できない** | 本サブの `boundary_test.go` は本番と同じ順序（RequestID → Logger → CORS → Auth）を**テスト内で再構成**しており、`cmd/combomgr/main.go:285-296` の実組立そのものは検査していない。**⇒ 誰かが `main.go` で Auth を CORS より前へ動かしても、全テストが緑のまま通る**——そしてその変更は「プリフライトが 401 になる」形で、**同一オリジンの主経路では 1 度も現れない**（プリフライトが飛ばないため）。**★本サブで直さない理由**: 実組立を検査するには `main.go` のルータ組立を関数として切り出す必要があり、**指示書 §2.2-1（認証ミドルウェアと保護対象の経路の列は `M22-01` の as-built・触ると入場ゲートが壊れる）に抵触しうる**。**⇒ 次にルータ組立を触るサブで検討すること。** |

---

## 14. 参照

| 文書 | 節 |
|------|-----|
| `docs/instructions/M22-05-cors-csrf-boundary.md` | v1.1.0 全文 |
| `docs/instructions/reviews/M22-05-review-checklist.md` | v1.1.0 |
| `docs/change-notes/CHANGE-116-notification.md` | §2・§4・§4.1・§4.2 |
| `DES-002` `docs/design/02-architecture.md` | §3.2・**§4.4**・§8.1・**§8.2**・§10 |
| `REQ-001` `docs/design/requirements.md` | `FR406`・`FR501`・`NFR102`・`NFR105` |
| `docs/handover/design-reports/20260815-m22-01-design-exceptions.md` | §1-4・§3.2-5・§4-1 |
| `docs/process/m22-contract.md` | §1.2・§4・§5（F-3 / F-4 / F-5） |

---

*以上、M22-05 完了報告。**境界は 1 か所も締めていない——締めることで得られるものが無いと実測で判定したためである。** **そして `curl` 相当の経路は、着手前後で 1 つも変わっていない。***
