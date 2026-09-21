# M22-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M22-01-auth-skeleton.md` v1.1.0 |
| チェックリスト | `docs/instructions/reviews/M22-01-review-checklist.md` v1.1.0 |
| 対象完了報告 | `docs/progress/m22-01-completion-report.md` |
| 基点 commit | `ccbe731` → `e720815`(7 コミット・24 ファイル・+2842 / -27) |
| レビュー日 | 2026-08-15 |
| レビュー担当 | 品質レビュー担当 Claude Code(コード変更なし・読取のみ) |

---

## 総評

最重要ゲート 1(`password_hash` を API へ漏らさない)は **完全に閉じている**。DTO が手書きの別型であること、応答の生バイト列を見るテスト、`PUT` の運搬先が構造上存在しないこと、書き戻しでハッシュが落ちないこと、破壊確認 B が実際に赤くなったこと——4 層で固定されており、指摘は無い。

最重要ゲート 2(OFF のとき何も変わらない)は **概ね守られているが、完全ではない**。ミドルウェアの素通しと非回帰 E2E は正しく置かれている一方、(1) `Login()` が `Enabled()` を見ないため **「ゲートを一度掛けて外した後」という通常の OFF 状態で `POST /api/auth/login` が Cookie を発行する**——完了報告 §6 の「OFF のときは Cookie を 1 枚も発行しない」と `handler.go` の godoc はいずれも事実に反する。(2) 認証判定が `isProtected` より **先に** 設定サービスの `sync.Mutex` を取るため、OFF でも全リクエスト(静的アセットを含む)が新しい共有ロックを通る。

設計の骨格・テストの置き方・完了報告の網羅度はいずれも高い水準にある。とくに E2E の 2 本の対照実験(誤パスワードで 401 / 遮断の前後で応答が変わる)は、空振りを自力で潰す形として模範的である。

一方で **失効・不正確な記述が 4 か所残っている**(コード 3・完了報告 1)。いずれも動作は正しいままなのでテスト・lint・型検査は緑であり、人が読む以外に見つける経路が無い。本プロジェクトの較正に従い「高」に置く。

完了承認を妨げる §9 の重大は **ゼロ**。以下の「高」は M22 完了前の是正を求めるが、いずれもゲートの破れではない。

---

## 設計準拠性レビュー結果

### 1. 最重要ゲート 1: `password_hash` を API へ漏らさない(指示書 §4.2)— **◎**

| 確認項目 | 結果 |
|---|---|
| `GET /api/config` の応答に現れない | ◎ `SecurityDTO` は `PasswordEnabled bool` のみ(`internal/api/config/dto.go:42-45`)。`toConfigResponse` はフィールド単位の明示的な詰め替え(`handler.go:103-105`) |
| テストで固定(§5.1-5) | ◎ `TestHandler_Get_DoesNotExposePasswordHash` が **応答の生バイト列**を見ている。フィールド名を変えて運んだ場合も検出する形になっており、DTO の構造を見るより強い |
| `PUT /api/config` で書けない | ◎ `SecurityUpdateDTO` / `configsvc.SecurityUpdate` のいずれにも運搬先が無い。`TestHandler_Update_CannotWritePasswordHash` が `passwordHash` / `password_hash` の両綴りを投げている |
| 破壊確認 B が赤くなった(§5.1-10) | ◎ 完了報告 §7 に FAIL 出力が転記されている。復元後の diff 0 も実測されている |
| 設定が専用経路(§4.2-4) | ◎ `POST /api/auth/password`。`PUT /api/config` に相乗りしていない |
| 書き戻しで落ちない(§3.3-3) | ◎ `TestService_Update_PreservesPasswordHash` がメモリ・ファイル両方を見ている。`configForPersistence` の env override 経路(`persisted := *runtime`)でも保持される |
| ログへ出ない(§4.8) | ○ 後述 §3 参照。実データでの確認は行われているが、確認範囲に穴がある |

> **付随所見(問題ではない)**: ミドルウェアは `c.Request().URL.Path`(デコード済み)で保護判定し、Echo は `GetPath()`(`RawPath` 優先)でルーティングする。両者が食い違う経路でバイパスが成立しないかを確認したが、**Echo の静的ルートは raw 形と decoded 形が一致する場合しかマッチしない**(`RawPath` は既定エンコードと異なるときだけ設定される)ため、保護対象ハンドラへ未認証で到達する経路は無い。

### 2. 最重要ゲート 2: `password_enabled = false` のとき何も変わらない(指示書 §4.9)— **△**

| 確認項目 | 結果 |
|---|---|
| OFF で保護対象が認証なしで通る(§5.1-1) | ◎ `TestAuth_Disabled_EverythingPasses` |
| OFF で応答が変わらない(§4.9-4) | ○ `TestAuth_Disabled_DoesNotTouchResponse` は **ミドルウェア非搭載の対照サーバ**と status / body / Cookie / ヘッダ集合を比較しており、置き方は正しい。ただし後述 2-b の遅延面は対象外 |
| 既存 E2E が OFF のまま非回帰(§5.2-A) | ◎ `make e2e` 基線 107 → 実装後 114(+7 が新規 spec)。既存 107 本が緑のまま |
| 破壊確認 A が赤くなった(§5.1-9) | ◎ 完了報告 §7 に FAIL 出力が転記されている |
| **OFF で Cookie が付かない** | **×** 後述 2-a |
| **OFF で遅延が変わらない** | **△** 後述 2-b |

#### 2-a. 【高】`Login()` が `Enabled()` を見ないため、OFF でもセッション Cookie が発行される

`internal/service/auth/service.go:80-93` の `Login` は `sec.PasswordHash` の有無しか見ておらず、`sec.PasswordEnabled` を参照しない。

到達可能な状態:

1. パスワードを設定する(`POST /api/auth/password`)。`SetPassword` は `PasswordEnabled` を触らないため、この時点で **OFF かつハッシュ設定済み**。
2. あるいはゲートを ON にして使ったあと `PUT /api/config` で `passwordEnabled: false` に戻す。**`password_hash` は消されないため、これがゲートを外した後の通常状態である。**

この状態で `POST /api/auth/login` に正しいパスワードを送ると **204 + `Set-Cookie: combomgr_session=...`** が返り、`GET /api/auth/status` は `authenticated: true` を返す。

帰結は 3 つ。

- **`internal/api/auth/handler.go:26-27` の godoc が事実に反する**——「パスワード未設定・不一致・**入場ゲート無効**のいずれも同じ 401 を返す」と書いてあるが、ゲート無効かつハッシュ設定済みでは 204 を返す。
- **完了報告 §6 末尾の「★`password_enabled = false` のときは Cookie を 1 枚も発行しない(§4.9-4。テストと E2E で固定)」が過大主張である。** 固定しているテストは `newServer(t, "", false)`(**未設定かつ OFF**)と E2E(同じく未設定)だけで、**「OFF かつ設定済み」は 1 本もテストされていない**。この文は `M22-02` / `M22-05` が前提として読む箇所であり、誤った前提が複製される。
- 挙動としての実害は小さい(OFF ではミドルウェアが全経路を素通しするため、Cookie が有っても無くても結果は同じ)。ただし §4.9-4 は明示的に「Cookie を発行する方式を採った場合、OFF でも Cookie が付いていないか」を見よと書いており、**指示書が名指しで警戒した形がそのまま残っている**。

是正案(いずれか):
(a) `Login` の冒頭で `if !s.Enabled() { return "", false }` を追加する(`Enabled()` は未設定時も false を返すため、既存の未設定判定を包含する)。
(b) 挙動を意図として維持するなら、`handler.go` の godoc と完了報告 §6 の記述を実際の振る舞いに合わせ、「OFF かつ設定済みでは Cookie が発行される」ことをテストで固定する。

**★どちらを採っても、記述を実装に合わせる作業は必須である。**

#### 2-b. 【中】OFF でも全リクエストが設定サービスの `sync.Mutex` を通る

`internal/api/middleware/auth.go:54-59` は `validator.Enabled()` を **`isProtected()` より先に** 呼ぶ。`Enabled()` → `configsvc.Security()` → `s.mu.Lock()`(`internal/service/config/service.go:287-291`。`RWMutex` ではなく `Mutex`)。

- 保護対象でないリクエスト(**静的アセット・SPA シェル・`/api/health`**)まで、この共有ロックを取る。
- `configsvc.Update` はこの同じ `s.mu` を **ファイル書き込み + `onDefaultPresetChanged`(`RecomputePresetCache`)の間ずっと保持する**。⇒ `PUT /api/config` で既定プリセットを切り替えている間、**OFF であっても全リクエストが直列化して待つ**。従来この面に触っていたのは設定 API だけだった。
- §4.9-4 は「**遅延も含めて**『変わらない』を見ること」と明示している。`TestAuth_Disabled_DoesNotTouchResponse` は status / body / Cookie / ヘッダしか見ておらず、この面は網に掛かっていない。

是正案: `isProtected()` の判定を先に行い、保護対象でなければ `Enabled()` を呼ばずに `next(c)` へ抜ける。これだけで静的配信・除外経路がロックに触れなくなり、`/api/*` の保護対象のみが設定を読む形になる(OFF のときも `Enabled()` 1 回で済むのは変わらないが、面が大幅に狭まる)。

#### 2-c. 【中】不整合状態の WARN が毎リクエスト出力される(＋記述が事実に反する)

`internal/service/auth/service.go:64-68` の `slog.Warn` は `Enabled()` の中にあり、`Enabled()` は **ミドルウェアがリクエストごとに呼ぶ**。したがって `password_enabled = true` かつ `password_hash = ""` の状態では、**静的アセット 1 枚ごとに WARN が 1 行出る**。lumberjack のローテーションを無意味に消費し、他のログを押し流す。

あわせて `internal/service/config/service.go:235` のコメント「手で作られた分は **起動時 WARN** + OFF 扱いで受ける」が事実に反する。**起動時に `Enabled()` を呼ぶコードは存在しない**(`main.go` は `authsvc.NewService` を呼ぶだけである)。実際には初回リクエスト以降、毎回出る。

是正案: 起動時に 1 回だけ判定してログを出す、または `sync.Once` / 状態遷移時のみの出力にする。いずれにせよコメントを実装に合わせること。

### 3. ログにパスワード・ハッシュ・セッション ID を出さない(指示書 §4.8)— **○**

| 確認項目 | 結果 |
|---|---|
| 実データで確認したか(§5.1-6) | ○ `TestAuth_DoesNotLogCredentials` が平文・検証子・セッション ID の実データを流し、ログ本文に含まれないことを見ている。「既存のマスキングテストが在る」で済ませていない |
| `Logger()` の実装確認 | ◎ `method` / `path` / `status` / `bytes` / `latency_ms` / `remote_ip` / `request_id` / `user_agent` のみ。**ボディもヘッダも読まない**。完了報告 §1-5 の「マスク処理が在るわけではない」という読みは正しい |
| エラーメッセージ | ◎ `handler.go:107-114` の `badRequest` が受け取った値を応答へ載せない。`c.Bind` のエラーを握って独自メッセージへ差し替えているため、Echo 経由のエコーバックも無い |
| `slog` の属性 | ◎ 認証まわりで機密を属性へ渡している箇所は無い |

**△ 1 点(低)**: `TestAuth_DoesNotLogCredentials` が使うサーバ(`newAuthServer`)は **スタブハンドラ**であり、`POST /api/auth/login` / `POST /api/auth/password` の**実ハンドラ**を通していない。実ハンドラ経路の実データ確認は完了報告 §6 手順12(手動 curl + `grep` で 0 件)に依存している。手動確認は行われているため重大ではないが、`internal/api/auth/handler_test.go` に同型のログ検査を 1 本置けば自動化できる。

### 4. 保護対象から外した経路(指示書 §4.5-2)— **○**

5 経路(`/api/health` / `/api/auth/login` / `/api/auth/logout` / `/api/auth/status` / `/api/auth/password`)＋ `/api/` 以外(静的配信)。**ログイン自身は確かに除外されている**(§9-5 に抵触しない)。一覧が `unprotectedPaths` の 1 か所に集約され、`TestAuth_Enabled_UnprotectedPathsPass` が全数を固定している点は良い。

- **`POST /api/auth/password` をミドルウェアから外し、ハンドラ側(現在のパスワード要求)で守る設計の妥当性**: **妥当である。** 初回設定を通すために除外が必要であり、設定済みの場合は `Service.SetPassword` が `VerifyPassword(sec.PasswordHash, current)` を必ず通す。`current` を省略しても空文字として照合され落ちる(`ErrCurrentPasswordRequired`)。`TestSetPassword_ChangeRequiresCurrentPassword`(API 層)と `TestService_SetPassword_ChangeRequiresCurrent`(サービス層)が両層で固定し、拒否時にハッシュが書き換わらないことも見ている。**指示書 §4.4-3 / 3′ / 3″ の 3 条件をすべて満たす。**
- **`password_enabled = false` を外す操作の保護(§4.4-3′)**: `PUT /api/config` は保護対象に残っており、`TestDisablingProtectionRequiresSession` が「未認証では到達しない / 認証すれば外せる」の両方を固定している。◎
- **アプリからの復旧経路(§4.4-3″)**: 作られていない。`SetPassword` は空パスワードを拒否し、`password_hash` を空へ戻す API 経路は存在しない。◎(§9-14 に抵触しない)

#### 4-a. 【低】OFF の状態では、LAN 上の任意の相手がパスワードを掛けられる

`password_enabled = false` かつ未設定のとき、`POST /api/auth/password` は誰でも通り、続く `PUT /api/config`(このとき OFF なので保護されない)で `passwordEnabled: true` にできる。⇒ 第三者が先にゲートを掛け、正規の利用者を締め出せる。復旧は `config.toml` の直接編集(設計どおり)。

**これは「パスワードが無い状態では認証の根が無い」という原理的な帰結であり、欠陥ではない**(`DES-002` §8「自宅LAN内は信頼するという割り切りを許容」)。ただし **完了報告にも設計伝達レポートにも記録が無い**。`M22-02` がウィザードで初回設定 UI を作る際の前提になるため、1 行記録することを推奨する。

#### 4-b. 【低】除外一覧がメソッド非依存である

`unprotectedPaths` はパスのみで判定するため、将来 `/api/auth/status` に `DELETE` 等を生やすと自動的に無防備になる。現状は 4 経路とも登録メソッドが 1 つずつで実害は無い。**将来の落とし穴として記録のみ。**

### 5. 方式の遵守(製造が選び直していないか)— **◎**

| 項目 | 結果 |
|---|---|
| 既定 `false`(§1.2-1) | ◎ `appconfig.Default()` 由来。`SecurityConfig.PasswordEnabled` に既定 `true` へ倒す経路は無い |
| 置き場は `config.toml [security]`(§1.2-2) | ◎ `users.password_hash` は未使用。`internal/model/user.go:14` も不変 |
| ハッシュ方式は `go doc` 実査で決定(§1.2-3) | ◎ 完了報告 §1-1 に `go version`(go1.26.4)と `go doc crypto/pbkdf2` / `crypto/argon2`(not in std)等の出力が引かれている。記憶で決めていない |
| `indirect → direct` 昇格 | ◎ **行っていない**(標準ライブラリで足りたため)。`go.mod` / `go.sum` の diff 0 を実測で確認した |
| タイムアウト非実装(§1.2-5) | ◎ タイマー・`time.After`・掃除 goroutine のいずれも無い。`E-132` の「無効なタイマー」も置いていない |
| メモリ保持(§1.2-6) | ◎ `map[string]struct{}` のみ。永続化なし |
| 平文を `config.toml` へ書かない(§4.1-4) | ◎ `SetPasswordHash` が受けるのは検証子のみ。`TestSetPassword_InitialDoesNotRequireCurrent` が平文の非混入を見ている |

### 6. 実装の中身 — **○**

| 項目 | 結果 |
|---|---|
| セッション ID の生成元(§4.3-3) | ◎ `crypto/rand.Text()`。`math/rand` 不使用。base32 26 文字 ≒ 128bit。完了報告 §3 に生成元と長さがあり、**値そのものは書かれていない** |
| 定数時間比較(§4.3-2) | ◎ `crypto/subtle.ConstantTimeCompare`。自前バイト比較なし。`len(want)` を導出長に使うため長さ不一致でも安全に落ちる |
| 並行安全性(§4.3-7) | ○ `sync.RWMutex` で `sessions` を保護。`TestService_ConcurrentAccess` + `go test -race` 実測(79.8s・競合なし)。手段は完了報告 §3 に記載済み。**△ 1 点は下記 6-a** |
| ログアウトで破棄(§4.3-6) | ◎ サービス層・API 層の両方で固定 |
| `true` かつハッシュ空の振る舞い(§4.1-3) | ◎ API 経路は 422 で拒否・ファイル経路は WARN + OFF 扱い。`TestService_Update_RejectsEnablingWithoutPassword` / `TestService_Update_AllowsEnablingWithPassword` / `TestService_Update_UnrelatedChangeInInconsistentState` / `TestService_Enabled_TrueWithoutPasswordWarnsAndDisables` の 4 本で固定。**「無関係な更新を巻き添えにしない」条件の切り方は丁寧で、実装として正しい** |
| ログイン失敗時の情報量(§4.4-1) | ◎ `TestLogin_NoPasswordSet_SameResponseAsWrongPassword` が status / body の一致を見ている |
| ミドルウェアの挿入位置(§4.5-3) | ◎ CORS の直後。プリフライトが 401 にならないことを `TestAuth_Enabled_PreflightIsNotRejected` が固定。`e.Use` を採り `Group.Use` を避けた理由(`NotFoundHandler` の副作用で経路表が変わる)まで記録されている |
| 未認証時の応答(§4.5-4) | ◎ `401` + `model.APIErrorResponse`。完了報告 §5 に契約として明記 |
| セッションの受け渡し(§4.4-5) | ◎ Cookie。属性が `newSessionCookie` 1 関数へ集約され、発行と失効の両方が通る形。完了報告 §6 に表で記載 |

#### 6-a. 【低】`SetPassword` の TOCTOU

`Service.SetPassword` は `store.Security()`(読) → `HashPassword`(≈315ms) → `store.SetPasswordHash`(書)を **別々のロック**で行う。並行して 2 本の変更要求が来ると、両方が同じ `current` で検証を通り、後着が勝つ。単独運用のアプリであり実害は小さいが、`SecurityStore` に compare-and-set 相当を持たせるか、`auth.Service` 側の書き込みを直列化する余地がある(§1.2-7「過剰にしない」に照らせば持ち越しで足りる)。

#### 6-b. 【低】未認証エンドポイントが 1 リクエストあたり 315ms の CPU を消費する

`hashIterations = 600000`(実測 315 ms/回)の導出が、`POST /api/auth/login` と `POST /api/auth/password` という **未認証で叩ける経路**で走る。数本の並行リクエストで CPU を占有できる。レート制限は無い。

`DES-002` §10 `NFR102`「パフォーマンスを損なう暗号化等は行わない」と、`REQ-001` の LAN 前提を踏まえれば **現状のままで方針と整合している**(毎リクエストではなくログイン時のみである点も完了報告 §2 で説明済み)。持ち越し扱いで足りるが、`M22-05` が LAN 公開面を扱う際の入力として記録しておくとよい。

### 7. 非破壊性(触ってはいけないもの)— **◎**

`git diff --stat ccbe731..HEAD` で以下がすべて **0** であることを再実測した。

- `migrations/` / `character_data/` / `docs/design/` — 0
- `internal/service/notation/` / `internal/service/preset/`(契約 F-5)— 0
- `web/src/` 全体(`features/physical-input/` / `gamepad/` / `keyboard/` を含む。契約 F-4)— 0
- `go.mod` / `go.sum` — 0
- `defaultUserID` の 3 定義(`internal/api/preset/handler.go:17` / `internal/api/tag/handler.go:17` / `internal/service/comboio/types.go:9`)と参照 — diff に 1 件も現れない
- 既存ミドルウェア 3 本(`RequestID` / `Logger` / `CORS`)の実装・登録順 — 不変(4 本目を後ろへ足しただけ)

`cmd/combomgr/main.go` の `configsvc.NewService` 生成位置の移動は、引数・注入関数がいずれも不変であることを diff で確認した(副作用のないコンストラクタであり、挙動は変わらない)。**理由も完了報告 §13 に記載済み**(§2.1 の注記を満たす)。

### 8. テストの妥当性 — **○**

- §5.1 の 12 項目は **全項目に対応するテストが存在する**。
- 破壊確認 A / B は **両方とも赤くなった**(§9-3 に抵触しない)。「テストを強くした」で済ませた項目は無い。
- E2E は資源(認証状態)ごとに 1 ファイルへ寄せられている(`D-362`)。**`config` を書き換えないため復元も不要**という設計判断は、`fullyParallel: false` がファイル**内**しか直列化しないという実測に基づいており、妥当である。

#### 8-a. 【中】E2E シナリオ B が実サーバの ON 挙動を検査していない

`web/e2e/m22-01-auth-gate.spec.ts` の B 群は `page.route` でブラウザコンテキストの応答を 401 に差し替えており、**サーバの `password_enabled` は `false` のままである**。指示書 §5.2-B の文言(「`password_enabled = true` のとき、既存画面がどう見えるかを固定する」)を厳密には満たしていない。

理由(他 spec を巻き添えにする)は spec 冒頭と完了報告に明記されており、ON 側のサーバ挙動が Go テストで網羅されていることも事実であるため、**逸脱としては受容可能**と判断する。ただし次の 2 点は残る。

1. `denyProtectedApi` の除外条件が `path === "/api/health" || path.startsWith("/api/auth/")` であり、**実装の除外一覧(4 経路の完全一致)と別物**である。ミドルウェア側の一覧が変わっても spec は追随せず、乖離が検出されない。**除外方針が 2 か所に別表現で存在する**状態である。
2. 結果として、**「ON にすると `M22-02` が使う経路がサーバ側でも本当に読めるか」は自動では守られていない**(手動 curl 手順 §6 でのみ確認されている)。

推奨: (1) は最低限、コメントで「実装の正本は `internal/api/middleware/auth.go` の `unprotectedPaths`」と相互参照を張る。(2) は Go の統合テスト(実ハンドラを本番と同じ順で積む)で代替済みと見なしてよい。

#### 8-b. 【中】E2E A の前提が開発者の `config.toml [security]` に依存している

E2E スタックは `COMBOMGR_DB_PATH` / `COMBOMGR_PORT` を上書きするが、**`[security]` はリポジトリの `config.toml` をそのまま読む**。したがって:

- 完了報告 §6 の疎通確認手順は `password_enabled = true` を実際に書き込む。**復元(§6 末尾の注意書き)を忘れると、次の `make e2e` は 114 本のほぼ全部が 401 で落ちる。**
- 復元しても `password_hash` の行を消し忘れると、A 群の `expect(status.passwordSet).toBe(false)` が落ちる。

手順書には復元注意が書かれているため運用でカバーされうるが、**「手動確認の後始末を忘れると全 E2E が赤くなる」構造は新規に持ち込まれたもの**であり、記録が無い。E2E の webServer 環境変数で `[security]` を強制 OFF にする(例: `COMBOMGR_PASSWORD_ENABLED=false` 相当の上書き)か、少なくとも followup として記録することを推奨する。

### 9. ドキュメント・進捗ログ — **○**

- 完了報告は **指示書 §7.5 の 13 項目すべて**を含む。とくに §9(`DES-002` §8 との差 8 行 + 新規確定仕様 6 行)は `CHANGE-112` の反映にそのまま使える粒度で、§9-12 に抵触しない。
- `users.password_hash` の所見(3 案の提示)、`password_enabled = true` のときの画面の見え方(段階別 + 7 秒の待ち)、並列相手との突合(「居なかった」の明記)、「■ 併せて更新が要るもの」——いずれも記載あり。
- 否定形確認は **3 系統(本番コード / テスト資産 / 文書)** に対して走り、陽性対照が置かれ、**是正で対照が消える問題に気づいて別の対照(`migrations/000007` のヘッダ)へ切り替えている**。`E-84` への対処として質が高い。適用済みマイグレへ当たった件も明記されている。
- `docs/progress/progress-log.md` への索引行の追記あり(横断課題 8 件)。
- followup 更新候補は完了報告 §16 に置かれ、`followup-backlog.md` は編集していない(`D-382` 遵守)。

**△ 1 点(低)**: `go test ./...` の転記が「`ok 件数: 51 FAIL 件数: 0`」という**要約**である。`E-125` は「コマンド自身の出力(スイート名・pass/fail の件数)」を求めている。新規 5 パッケージの `ok <pkg> <time>` 行は転記されているため趣旨は満たすが、要約行は集計であって出力ではない。

---

## 設計準拠性以外の指摘事項

### A. 【高】`internal/api/config/dto.go:3-5` の規約コメントが失効している

```go
// 機微情報除外規約: 将来追加される機微情報フィールド(例: SecurityConfig.PasswordHash)は
// ConfigResponse に含めず、json:"-" タグで明示的に除外すること。
// 現状の Config 構造体には機微情報フィールドは存在しないが、本規約を将来の実装で厳守する。
```

3 か所とも本サブで失効した。

1. 「**将来**追加される」→ `SecurityConfig.PasswordHash` は **既に存在する**。
2. 「**現状の Config 構造体には機微情報フィールドは存在しない**」→ **偽である。**
3. 「`json:"-"` タグで明示的に除外すること」→ **as-built はこの方式ではない。** 完了報告 §1-2 が自ら書いているとおり「DTO が別型なので**そもそも足さないのが正しい**。`json:"-"` は付けていない」。⇒ **このコメントに従って実装すると、`ConfigResponse` へフィールドを足したうえで `json:"-"` を付ける、という誤った形になる。**

**本サブの最重要ゲートを守っている当のファイルに、ゲートの守り方を誤って教えるコメントが残っている。** 完了報告 §1-2 はこのコメントを「既に規約コメントが在る」と**肯定的に引用**しており、失効に気づいていない。

否定形確認の走査(§4.9.1)がこれを取り逃がしたのは、キーワード集合(`M6` / `フェーズ2` / `未使用` / `未実装` / `notImplemented` / `password_enabled`)にこの文面の語(`将来` / `存在しない`)が入っていなかったためである。**走査の設計そのものは正しく回っており、キーワードの網の外だったという性質の取りこぼしである。**

是正案: 「`SecurityConfig.PasswordHash` は機微情報である。`ConfigResponse` / `UpdateConfigRequest` の DTO は手書きの別型であり、**足さないことで除外が成立している**。新しい機微フィールドを `appconfig.Config` へ足すときも、DTO へ詰め替えないこと」に書き換える。

### B. 【高】`internal/api/auth/handler.go:26-27` の godoc が実装と食い違う(→ §2-a)

「パスワード未設定・不一致・**入場ゲート無効**のいずれも同じ 401 を返す」——ゲート無効かつハッシュ設定済みでは 204 を返す。

### C. 【高】`internal/service/config/service.go:235` の「起動時 WARN」が実装と食い違う(→ §2-c)

起動時に判定するコードは無い。実際にはリクエストごとに出る。

### D. 【高】完了報告 §6 の Cookie に関する記述が事実より強い(→ §2-a)

「★`password_enabled = false` のときは Cookie を 1 枚も発行しない(§4.9-4。テストと E2E で固定)」。**設計伝達レポートを経て `M22-02` / `M22-05` の前提になる箇所であり、誤ったまま複製される。**

### E. 【中】サービス層のメソッドが第一引数に `context.Context` を取っていない

`CLAUDE.md` §4「サービス層のメソッドは第一引数に `context.Context` を取る」/ チェックリスト §6 に対し、`internal/service/auth/Service` の `Enabled` / `PasswordSet` / `Login` / `Logout` / `Validate` / `SetPassword` と `SecurityStore` の 2 メソッドはいずれも `ctx` を取らない。

- `SetPassword` は **ファイル I/O(`SetPasswordHash` → `writeAtomic`)を行う**ため、規約が想定する対象そのものである。
- 既存 `configsvc.Service` も `ctx` を取っておらず(`service.go:100-105` に理由と帰結が明記されている)、**その先例に揃えた形**とは読める。しかし完了報告にはこの逸脱の記載が無く、`CLAUDE.md` §9 共通原則3(検討した案と選定理由を報告に含める)を満たしていない。
- なお `PBKDF2` 600,000 回は 315ms 掛かるため、`ctx` を持たない帰結として **クライアント切断時も導出が最後まで走る**。

判断: 既存先例に揃えたこと自体は妥当。**逸脱の明示(コメント + 完了報告への 1 行)を求める。** 全面的な `ctx` 導入は `configsvc` の公開 IF 組み替えを伴うため本サブの範囲外でよい。

### F. 【低】`GET /api/config` の `security.passwordEnabled` と `GET /api/auth/status` の `passwordEnabled` が同名で別の値になる

前者は `config.toml` の生値、後者は `Service.Enabled()`(＝ハッシュ未設定なら `false` に倒れる実効値)。`password_enabled = true` かつハッシュ空のとき **同じ名前のフィールドが `true` と `false` に割れる**。

`dto.go:15-17` にコメントはあるが、`M22-02` が両方を触るため誤読の余地がある。**名前を分ける(例: `passwordActive` / `gateActive`)か、`M22-02` への引き継ぎ(完了報告 §18)へ 1 行足すことを推奨する。**

### G. 【低】`hashIterations` に上限が無い

`parseHash` は `iterations < 1` のみ弾く。`config.toml` を手で編集して巨大な値を書くと、ログイン 1 回で長時間 CPU を占有する。編集できるのは信頼の根を持つ主体のみ(§4.4-3″ の設計と一致)であるため実害は無いが、上限を置く余地はある。

### H. 良好: 規約準拠として問題を検出しなかった項目

- JSON タグは全て camelCase(`passwordEnabled` / `passwordSet` / `authenticated` / `currentPassword` / `newPassword`)。
- 公開シンボルに godoc あり(内容の正確性は B / C を除く)。
- エラーは `fmt.Errorf("...: %w", err)` で wrap(`auth: generate salt` / `auth: derive key` / `auth: persist password`)。
- 本番コードに `fmt.Println` / `console.log` なし(`main.go` の `fmt.Fprintln(os.Stdout, ...)` は既存の CLI UX 出力であり本サブの追加ではない)。
- 不要な `nolint` / `eslint-disable` なし。
- マジックストリングの定数化(`hashScheme` / `hashIterations` / `SessionCookieName` / `PathLogin` 他)は徹底されている。
- ブラウザストレージの新規キーなし(`web/src/` の diff が 0)。
- **「安全である」という記述はコード・コメント・完了報告のいずれにも無い**(`grep "安全"` で 0 件)。指示書 §4.6 を正しく守っている。`doc.go` は「平文で LAN を流れる」「防御責任は本アプリの外にある」と条件を述べる形に留めている。

---

## 推奨修正(優先度別)

### 高(M22 完了前に修正必須)

1. **`internal/api/config/dto.go:3-5` の規約コメントを as-built に書き換える。**(指摘 A)
   **★実装が正しいまま記述だけが誤っており、後任がこの記述に従うとゲートを自分で壊す形になっている。**
2. **`internal/api/auth/handler.go:26-27` の godoc を実装に合わせる。**(指摘 B / §2-a)
   あわせて **`Login()` が `Enabled()` を見ない**ことの是非を決める。挙動を変える(`Enabled()` 判定を足す)なら §2-a の是正案 (a)、意図として維持するなら (b) でテストを 1 本追加する。
3. **`internal/service/config/service.go:235` の「起動時 WARN」を実装に合わせる。**(指摘 C / §2-c)
4. **完了報告 §6 の「OFF のときは Cookie を 1 枚も発行しない」を、実際に固定されている範囲(未設定かつ OFF)まで狭める。**(指摘 D)
   **★設計伝達レポート経由で `M22-02` / `M22-05` の前提になるため、誤ったまま渡さないこと。**

### 中(M23 着手と並行可)

5. **認証ミドルウェアで `isProtected()` を `Enabled()` より先に評価する。**(§2-b)
   静的配信・除外経路が設定サービスの `Mutex` に触れなくなる。OFF 側の非回帰を、遅延の面でも実質的に回復できる。
6. **不整合状態の WARN を毎リクエスト出力しない形にする。**(§2-c)
7. **`SecurityStore` / `auth.Service` が `ctx` を取らないことを、コメントと完了報告(または設計伝達レポート §3)へ明示する。**(指摘 E)
8. **E2E B の `denyProtectedApi` の除外条件に、実装側 `unprotectedPaths` が正本である旨の相互参照コメントを張る。**(§8-a)
9. **E2E が開発者の `config.toml [security]` を読むことを followup へ記録する。**(§8-b)
   疎通確認の復元忘れで全 E2E が赤くなる経路が新設されている。

### 低(将来対応)

10. `internal/api/auth/handler_test.go` に、実ハンドラ経路(login / password)を通したログ非出力テストを 1 本追加する。(§3)
11. `SetPassword` の TOCTOU を compare-and-set 相当へ寄せる。(§6-a)
12. 未認証エンドポイントの PBKDF2 コストを `M22-05`(LAN 公開面)の入力として記録する。(§6-b)
13. `passwordEnabled` の同名別値を `M22-02` への引き継ぎへ 1 行足す、または名前を分ける。(指摘 F)
14. `hashIterations` の上限チェックを `parseHash` に置く。(指摘 G)
15. OFF 状態で第三者がパスワードを掛けられることを完了報告へ 1 行記録する。(§4-a)
16. `unprotectedPaths` がメソッド非依存であることをコメントで注記する。(§4-b)
17. `go test ./...` の転記を要約ではなくコマンド出力にする。(§9)

---

## 良かった点

- **最重要ゲート 1 を「4 層」で固定した設計。** DTO を別型に保つ(構造で防ぐ)→ 応答の**生バイト列**を見るテスト(名前を変えて運んでも検出)→ サービス層に運搬先が存在しないことの確認 → 破壊確認 B。**「実装を読んだだけで判断していないか」というチェックリストの問いに、テストの粒度で答えている。**
- **E2E に 2 本の対照実験を置いたこと。** 「誤ったパスワードを弾く」(A 群)と「遮断の有無で応答が変わる」(B 群)は、いずれも **本体のテストが空振りしていても緑になる形を自力で潰している**。とくに後者は `page.route` が空振りする典型的な失敗を直接検出する。
- **`page.route("**/api/**")` の落とし穴を実測で見つけ、誤った結論を出す寸前で止めたこと。** Vite の dev サーバがソースモジュールを `/src/.../api/...` で配る事実に当たり、「保護すると白画面になる」という誤報告を回避している。**この種の「対照が壊れていた」型の自己検出は、報告書に残す価値が最も高い部類である。**
- **否定形確認で、陽性対照が是正によって消える問題に自分で気づき、別の対照(直せない適用済みマイグレのヘッダ)へ切り替えたこと。** `E-84` の趣旨(「0 件」は「走査が壊れている」かもしれない)を形式的になぞるのでなく、**走査の健全性を作業後も維持する形**へ落としている。
- **`PUT /api/config` の 422 検証を「ON にしようとした要求だけ」に限定したこと。** 「既に ON かつハッシュ空」の状態で無関係な設定変更まで巻き添えで拒否しない、という切り方は正しく、専用のテスト(`TestService_Update_UnrelatedChangeInInconsistentState`)まで置かれている。**不整合状態に入った利用者が設定 API ごと使えなくなる事故を防いでいる。**
- **Cookie の属性を `newSessionCookie` 1 関数へ集約したこと。** 発行と失効の両方が同じ関数を通るため、片方だけ直す事故が構造的に起きない。将来 `Secure` を足す人の入口が 1 か所である、という説明も的確。
- **`configsvc.Security()` を新設して `s.mu` の保護下で読む形にしたこと。** 既存の `preset-config-unsynchronized-read` を悪化させず、新設分だけを同期下に置いた判断は正しい。既存分を直していないことと、その理由(config サービスの公開 IF 全体の設計判断)も明記されている。
- **検証子を自己記述形式(`scheme$iter$salt$key`)にしたこと。** 反復回数を将来引き上げても既存の検証子が照合できる。設計書に要求は無かったが、**撤回や移行を必要としない形**を選んでいる。
- **`golang.org/x/crypto` の昇格承認枠を、使えるのに使わなかったこと。** `go doc` の実査で標準ライブラリで足りると分かった時点で、承認済みの枠へ流れずに `go.mod` diff 0 を選んでいる。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 完了報告に転記されたテスト結果(`go test ./...` 51 ok / `pnpm test` 1412 / `make e2e` 114)、破壊確認 A / B の FAIL 出力、疎通確認 §6 の 14 手順、`go doc` の出力、ベンチマーク値(315 ms/回)は **転記の妥当性を検証していない**(本レビューはテストを実行していない)。
- Echo の経路解決(`GetPath` の `RawPath` 優先)に関する分析は、`v4.15.1` のソース読解に基づく。エンコード済みパスを用いた実リクエストでの検証は行っていない。
- 不明: `M22-01` の Plan Mode で開発者へ提示された §9.1 の 5 項目(ハッシュ方式 / ハッシュ空時の振る舞い / Cookie かヘッダか / ミドルウェアの挿入位置 / 現在のパスワードの要求)について、**提示と承認が実際に行われたかは、コードと完了報告からは判断できない**。完了報告 §1・§2・§6 には結論と根拠が揃っており内容に矛盾は無いが、承認の事実そのものは開発者の確認事項である。
- 不明: `docs/change-notes/CHANGE-112-notification.md` の承認状態は完了報告の記述(「承認済み・2026-08-15。通知書 L9 で確認」)に依拠しており、本レビューでは registry 側の突合を行っていない。

---

*以上、M22-01 レビュー報告書。最重要ゲート 1 は完全・最重要ゲート 2 は 1 点の穴(OFF での Cookie 発行)と 2 点の面(共有ロック・WARN 洪水)を残す。§9 重大はゼロ。「高」4 件はいずれも**失効・不正確な記述**であり、動作は正しいままテスト・lint・型検査が緑になる型である。*

---

## 取り込み結果(自動トリアージ)

| 項目 | 内容 |
|---|---|
| 実施日 | 2026-08-15 |
| 実施者 | 製造担当 Claude Code(`/implement_plan_full` Phase C) |
| 往復回数 | **1 回目**(上限 2 回。`CLAUDE.md` §9 停止規律) |
| 「高」の不採用 | **0 件**(⇒ 開発者エスカレーションの発動なし) |
| 再検証 | `go test ./...` 51 ok / 0 FAIL ／ `-race` 緑 ／ `make e2e` ／ 破壊確認 A・C |

### 採用したもの

| # | 指摘 | 優先度 | 採否 | 対応 |
|---|---|---|---|---|
| 1 | **A**: `internal/api/config/dto.go:3-5` の規約コメントが失効 | 高 | **採用** | as-built へ全面書き換え。「`json:"-"` で除外」ではなく「**DTO へ足さないことで除外が成立する**」と書き、`ConfigResponse` へ足して `json:"-"` を付ける形を明示的に禁じた(応答から消えても要求側の入力口が残るため)。固定しているテスト名も併記した |
| 2 | **B / 2-a**: `Login()` が `Enabled()` を見ず、OFF でも Cookie を発行する | 高 | **採用(是正案 a)** | **★製造側で独立に再現を確認したうえで実装を修正した**——`Login` の冒頭に `if !s.Enabled() { return "", false }` を追加。godoc も実装に合わせた。**指摘は正しい**: `SetPassword` は `PasswordEnabled` を触らず、ゲートを外しても `password_hash` は残るため、「OFF かつ設定済み」は例外ではなく**ゲートを外した後の通常状態**である |
| 3 | **C / 2-c**: 「起動時 WARN」が事実に反し、実際は毎リクエスト出る | 高 | **採用** | `Enabled()` からログを除去して純粋な判定にし、**`WarnIfMisconfigured()` を新設して `main.go` の起動時に 1 度だけ呼ぶ**形にした。⇒ コメントが事実になり、ログ洪水も消えた。設定はプロセス起動時にしか読まないため、起動時の 1 回で検出しきる |
| 4 | **D**: 完了報告 §6 の Cookie 記述が過大主張 | 高 | **採用** | #2 の是正により記述が事実になったが、**「何が固定されているか」を正確に書き直した**(「OFF かつ設定済み」の経路を明示)。§18 の引き継ぎにも反映 |
| 5 | **2-b**: OFF でも全リクエストが `configsvc` の mutex を通る | 中 | **採用** | ミドルウェアで `isProtected()` を `Enabled()` **より先に**呼ぶ順序へ変更。静的アセット・SPA シェル・除外経路が共有ロックに触れなくなった。理由をコメントに残した |
| 6 | **E**: サービス層が `ctx` を取らない逸脱の記載が無い | 中 | **採用(記載のみ)** | `Service` の godoc へ逸脱理由を明記——`SecurityStore`(実体は `configsvc`)が `ctx` を取らない設計であり、**受けても素通しにしかならない ctx を型に載せると「キャンセルが効く」という誤った期待を呼ぶ**ため取らない形に揃えた。帰結(導出 315ms は切断でも走り切る)も記載。**全面導入は `configsvc` の公開 IF 組み替えを伴うため範囲外**(レビュー担当の判断と一致) |
| 7 | **8-a**: E2E の除外条件が実装の一覧と別表現で二重化 | 中 | **採用(相互参照)** | spec に「除外一覧の正本は `internal/api/middleware/auth.go` の `unprotectedPaths`」「ここは前方一致で束ねた近似であり自動追随しない」「全数は Go の `TestAuth_Enabled_UnprotectedPathsPass` が固定」と明記 |
| 8 | **8-b**: E2E が開発者の `config.toml [security]` に依存する | 中 | **採用(自己診断化)** | A 群の 2 つの `expect` に**失敗時メッセージ**を付け、「疎通確認の戻し忘れではないか」を名指しするようにした。⇒ 全 E2E が 401 で落ちたとき、原因へ最短で到達できる。**環境変数による強制 OFF は採らなかった**(理由は下表) |
| 9 | **§3 の △**: 実ハンドラ経路のログ検査が手動確認のみ | 低 | **採用** | `TestAuthHandlers_DoNotLogCredentials` を追加。初回設定 → ログイン成功 → ログイン失敗 → 変更の全経路を**実ハンドラで**通し、平文 2 種と検証子がログに出ないことを固定 |
| 10 | **F**: `passwordEnabled` が 2 つの API で同名・別の値 | 低 | **採用(改名)** | `GET /api/auth/status` の応答フィールドを **`passwordEnabled` → `passwordRequired`** へ改名。`GET /api/config` 側(config.toml の生値)は既存 API のため不変。**消費者(`M22-02`)が未着手の今が最も安く直せる** |
| 11 | **G**: `hashIterations` に上限が無い | 低 | **採用** | `maxHashIterations = 10000000` を追加し、超過は照合失敗として扱う。手編集による自傷的な CPU 占有への歯止め |
| 12 | **4-a**: OFF の間は LAN 上の任意の相手がパスワードを掛けられる | 低 | **採用(記録)** | 完了報告 §18 と §16 の followup 候補へ記録。**原理的な帰結であり欠陥ではない**(認証の根が無い状態では誰も止められない)が、`M22-02` がウィザードで初回設定 UI を作る際の前提になる |

### 採用しなかったもの(理由つき。いずれも「高」ではない)

| # | 指摘 | 優先度 | 不採用の理由 |
|---|---|---|---|
| 13 | **6-a**: `SetPassword` の TOCTOU(読 → 導出 → 書が別ロック) | 低 | **持ち越し。** 是正には `SecurityStore` へ compare-and-set 相当を足すか `configsvc` 側の IF を変える必要があり、**§1.2-7「迷ったら軽い方を採る」に照らして本サブの範囲を超える。** 単独利用のローカルアプリで、同時に 2 本の変更要求が来る状況が現実的でない。**レビュー担当自身も「持ち越しで足りる」と判断している。** followup 候補として完了報告 §16 へ記録した |
| 14 | **6-b**: 未認証経路が 1 リクエスト 315ms の CPU を使う(レート制限なし) | 低 | **現状のまま。** `DES-002` §10 `NFR102`「パフォーマンスを損なう暗号化等は行わない」と LAN 前提に照らし、**レート制限の新設は §1.4-6(CORS/CSRF は `M22-05`)と同じ面の追加機能**にあたる。指示書のスコープ外。`M22-05` への入力として完了報告 §16 へ記録した |
| 15 | **4-b**: 除外一覧がメソッド非依存(将来 `DELETE /api/auth/status` を生やすと無防備) | 低 | **現状のまま。** 4 経路とも登録メソッドは 1 つずつで実害が無い。**メソッド対を持つ表に変えると、ルート定義との二重管理が新たに生まれる**(#7 で指摘された二重化を自ら増やす形になる)。**レビュー担当も「記録のみ」と判断している。** 将来の落とし穴として完了報告 §16 へ記録した |
| 16 | **8-b の環境変数案**: E2E で `[security]` を強制 OFF にする上書きを新設 | 中 | **採らなかった。** 新しい環境変数は `internal/config` の公開仕様の追加であり、**`applyEnvOverrides` の 3 変数はいずれも設計書に根拠を持つ**。設定面の新設は設計卓の手番(`CLAUDE.md` §8)。**代わりに #8 の自己診断メッセージで「復元忘れ」を最短で特定できるようにした**——検知の速さで実害を潰し、設定面は増やさない |
| 17 | **§9 の △**: `go test ./...` の転記が要約行である | 低 | **採用(軽微)** — 表の外だが、完了報告 §12 に**新規 5 パッケージの `ok <pkg> <time>` 行**を既に転記済みであり、`E-125` の趣旨(終了コードだけを根拠にしない)は満たしている。要約行はそのまま残し、**取り違えないよう「集計」と明記した** |

### ★「高」指摘の不採用は 0 件である

⇒ `/implement_plan_full` Phase C の安全弁(重大指摘の自動棄却時に開発者へエスカレーション)は**発動しない**。

### 是正後の再検証

```
go test ./...                     → ok 51 / FAIL 0
go test -race ./internal/service/auth/ ./internal/api/auth/
                                  → ok(92.7s / 64.3s。データ競合なし)
破壊確認 A(ミドルウェア登録を外す) → 赤(復旧後の diff 0)
破壊確認 C(Login の Enabled 判定を外す・新規)
                                  → 赤: status = 204, want 401 ／ Set-Cookie が付いた
                                    (復旧後の diff 0)
```

> **★破壊確認 C は本トリアージで新設した。** 指摘 2-a は「テストが緑のまま穴が残っていた」型であり、
> **是正したテストが本当にその穴を捕まえるか**を確かめないと、同じ状態へ戻れてしまう。
