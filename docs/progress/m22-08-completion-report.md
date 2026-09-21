# M22-08 完了報告: 入場まわりの仕上げ（パスワードの検証・ログアウトの導線・利用者の改名）

| 項目 | 内容 |
|------|------|
| 作業ID | M22-08 |
| 対象指示書 | `docs/instructions/M22-08-auth-finishing.md` **v1.3.0** |
| チェックリスト | `docs/instructions/reviews/M22-08-review-checklist.md` v1.1.0 |
| CHANGE | `CHANGE-119`（2026-08-16 承認済み＝**D-410**。**着手前ゲート通過を確認**） |
| ブランチ | `claude/m22-08-parallel-feasibility-emyq84` |
| 基点コミット | `3494660` |
| 実施日 | 2026-08-16 |
| 消費マイグレーション | **0 本**（`migrations/` の diff 0 ファイル） |
| 消費 CHANGE 番号 | **なし**（既存 `CHANGE-119` に紐づく。「次に採番する番号」は不変） |

> **★指示書 v1.3.0 は開発者から直接受領したものであり、本ブランチへコミットしていない**（開発者の明示的な指示）。**⇒ ディスク上の `docs/instructions/M22-08-auth-finishing.md` は v1.2.0 のままである。** v1.2.0 → v1.3.0 の差分は機械 diff で確認済みで、**§2.1 の i18n 行に「キーを足す位置」の規定が入った 1 点だけ**（**D-416**）。ほかはメタ表の版数・更新履歴・巻末の版数のみ。

---

## 1. §3.3 着手前の実査（9 項目）の結果

### 1-1. ★§1.2 の実測との突き合わせ（§7.5-1・§7.5-2）

**★全 9 行が一致した。行番号まで正確であり、転記の誤りは無い。**

| 層 | 指示書 §1.2 の記述 | 実査結果 |
|---|---|---|
| `Service.SetPassword`（`service.go:150-157`） | `next == ""` のみ | **一致**。`:150` が `if next == ""`。長さ・文字種・正規化・前後の空白はすべて無検査 |
| `Service.Login`（同 `:106`） | 無検査 | **一致**。`:106` が関数宣言。`Enabled()` と `VerifyPassword` だけを通る |
| `Handler.SetPassword` | `ErrEmptyPassword` → 400 のみ | **一致**。コードは `invalid_request` |
| `PasswordSetForm.tsx:35,89` | `password === ""` で送信を止めるだけ | **一致** |
| `PasswordChangeForm.tsx:38,110` | 現在欄・新欄とも空でないことだけ | **一致** |
| `LoginScreen.tsx:69` | 空でも押せる | **一致**。`disabled={login.isPending}` のみ |
| 本文サイズ | `middleware.BodyLimit` 未導入 | **一致**。`BodyLimit` は**リポジトリ全体で本番・テストとも 0 件**。`main.go:285-296` のミドルウェア列は RequestID → Logger → CORS → Auth → UserContext の 5 本 |
| `trim()` | `internal/{api,service}/auth/` と `web/src/features/auth/` に 0 件 | **一致** |
| 導出 | `password.go:52` が受け取ったバイト列をそのまま `pbkdf2.Key` へ | **一致** |

### 1-2. ★本文サイズの上限を掛ける範囲（§7.5-5 と対）

**採った範囲＝`/api/auth/*` の 4 経路のみ**（指示書 §4.2-2 の既定どおり）。**全経路へは掛けていない。**

**実測した根拠**——`POST /api/import/csv[/preview]` は **multipart/form-data** で次を同時に受ける（`internal/api/comboio/handler.go:37-47`）。

- `combo_file`（コンボ CSV または zip）: **上限 10MiB**（`maxUploadBytes = 10 << 20`。VAL-I01 と対称）
- `setup_file`（任意のセットプレイ CSV）: **同じく上限 10MiB**
- `selected`（取り込む `local_id` の JSON 配列）・`dupAction` のフォーム値 ＋ multipart の境界

**⇒ 正当な要求が 20MiB を超えうる。** 全経路へ掛けるなら上限は 21MiB 超が必要で、それでは認証経路の防御にならない。

**上限値＝8KiB**（`internal/api/auth/bodylimit.go` の `MaxBodyBytes`）。根拠は、認証経路の最大の要求が `{"currentPassword":"<128 文字>","newPassword":"<128 文字>"}` で **300 バイト未満**であること。25 倍以上の余裕を持たせつつ、鍵導出（約 315ms）を叩く前段で頭打ちにできる。

### 1-3. ★既存の検証子の状態

**作業ツリーに `config.toml` は存在しない**（`config.toml.example` のみ。`make e2e` が初回に生成する）。**⇒ このクローンには非 ASCII の検証子は無い。開発者の手元には在りうる。**

**⇒ 守れることはテストで確かめた。** `HashPassword("ぱすわーど")` と `HashPassword("ab")` で「M22-08 より前に決められた検証子」を作り、それで入れることを固定してある（§3 の網 2・3）。**あわせて破壊確認 A を実施し、照合側へ検査を掛けると実際に赤くなることを確認した**（§4）。

### 1-4. `Service.SetPassword` と `Service.Login` の境界

**検査はサービス層に置いた**（指示書 §9.2-1 の裁量。**推測ではなく選択であり、理由を以下に記す**）。

- `SetPassword(current, next)` の **`next` だけ**を検査する。**`current` は検査しない。**
- `Login(password)` は**検査しない**。前後の空白の除去だけを掛ける。

**⇒「決めるときだけ」がサービス層 1 か所で成立し、ハンドラを経由しない呼び出しでも破れない。** 既存の `ErrEmptyPassword` と同じ層であり、先例も在る（`internal/service/user/service.go:66-86` が trim ＋ 長さ ＋ sentinel をサービス層で行う）。

### 1-5. 設定画面の実体（ログアウト・改名の置き場）

`web/src/pages/SettingsPage.tsx:26-35` が 6 節を並べ、**2 番目が `SettingsSectionUser`**（`DES-005` §5.16 の「2. ユーザー」に対応）。

- **ログアウト**＝`web/src/features/config/SettingsSectionUser.tsx` のパスワード欄の**下に、罫線で仕切った別のまとまり**として置いた。同ファイルは既に `useAuthStatus()` を呼んでおり `passwordRequired` がその場で読める。
- **改名**＝`web/src/features/user/UserManagement.tsx` の「ユーザー追加」と並ぶインライン form。

**★ログアウトを `UserManagement` に置かなかった理由**——あの欄は「誰として操作するか」を扱い、`user.reselect`（使う人を選び直す）と隣り合う。**指示書 §4.3-4 が禁じた混同がまさにそこで起きる。** 別のまとまりへ分け、見出しと文言でも役割を書き分けた。

### 1-6. `PATCH /api/users/:id` の実体

**実装済みであり、サーバ側の検証は作り直していない。**

| 経路 | 実装 |
|---|---|
| `internal/api/user/routes.go:13` | `g.PATCH("/users/:id", h.Update)` |
| `internal/api/user/handler.go:56-91` | 空名 **400 `user_name_empty`** ／ 重複名 **409 `user_name_duplicate`** ／ 不在 **404 `user_not_found`** ／ 成功 200 `UserResponse` |
| `internal/service/user/service.go:66-86` | `TrimSpace` ＋ 50 rune 上限 ＋ `ExistsByName` |

**フロントの `userApi.rename` も既に在った**（`web/src/features/user/userApi.ts:17`）。**呼び出し元が 0 件だっただけである** ⇒ 本サブは配線だけを足した。

### 1-7. ★標準ライブラリ／フレームワークの仕組みで足りるか（§7.5-12 と対＝D-410）

**3 つとも標準の仕組みで足りた。自前の実装は書いていない。**（詳細は §7）

### 1-8. ★`M22-04` との交差点（§7.5-10 と対）

**★実査時点で `M22-04` は走っていなかった。**（詳細は §8）

### 1-9. `make e2e` がクリーンな状態で完走するか

**着手前の前提が 2 つ欠けていた。いずれも既知の followup と同型であり、導入して解消した。**

| # | 欠けていたもの | 症状 | 対処 |
|---|---|---|---|
| 1 | `web/node_modules` | `make e2e` が `@playwright/test` を見つけられない | `cd web && pnpm install` |
| 2 | `markdown-it-py` | `python3 -c "import markdown_it"` が `ModuleNotFoundError`。`check-md-emphasis.sh` が「未実行」判定になり `check-artifact-integrity.sh` が NG | `pip install markdown-it-py`（4.2.0） |

**⇒ 導入後、着手前ベースラインを取得した**（§6 の「着手前」列）。**着手前から落ちている状態ではなかった**ため §9.3-6 の停止条件には当たらない。

---

## 2. ★§1.2 の転記に誤りがあったか（§7.5-2）

**★一致した。誤りは無い。** 9 行すべてが実装と合っており、行番号まで正確だった（§1-1 の表）。

---

## 3. ★前後の空白の除去で受け入れた代償（§7.5-3）

**★前後に空白を含む既存のパスワードは使えなくなる。**

- **理由**: `Service.Login` が照合の前に `NormalizePassword`（＝`strings.TrimSpace`）を掛けるため、`" hunter2 "` で決めてあった検証子に対して `" hunter2 "` を打っても `"hunter2"` として照合され、一致しない。
- **確率**: 極めて低い。**意図して空白で囲んだ場合にだけ起きる。**
- **復旧経路は在る**: `config.toml` の `[security]` から**有効化フラグと検証子の 2 行とも消す**（`D-407`）。1 行だけでは復旧できない。
- **受け入れた理由**: 指示書 §4.1-5 が「決めるときと入れるときの両方に掛ける」と定めている。IME の確定操作で末尾に空白が入っても、マスク表示では気づけない——**その失敗のほうが起こりやすく、しかも原因が分からない。**

**★全角スペース（U+3000）も落ちる。** `strings.TrimSpace` が Unicode の空白の定義を持つためで、自前で列挙していない。

---

## 4. ★破壊確認 A の結果（§7.5-4）

**★赤くなった。** 手順と結果を残す。

**手順**——`internal/service/auth/service.go` の `Login` へ、検査を一時的に足した。

```go
	password = NormalizePassword(password)
	// [破壊確認 A] 一時的に照合側へも検査を掛ける。
	if err := validateNewPassword(password); err != nil {
		return "", false
	}
```

**結果——4 本が赤くなった。**

```
--- FAIL: TestLogin_ExistingNonASCIIVerifierStillWorks (0.12s)
--- FAIL: TestLogin_ExistingShortVerifierStillWorks (0.12s)
FAIL	github.com/plexiblinp/combomgr/internal/api/auth	6.016s
--- FAIL: TestService_Login_IssuesDistinctSessions (0.12s)
--- FAIL: TestService_ConcurrentAccess (0.12s)
FAIL	github.com/plexiblinp/combomgr/internal/service/auth	4.698s
```

**★狙って置いた 2 本が赤くなった**（`TestLogin_ExistingNonASCIIVerifierStillWorks` / `TestLogin_ExistingShortVerifierStillWorks`）。**これが最重要ゲート 1 の網である。**

**★あわせて既存の 2 本も赤くなった。これは偶然であり、網として当てにできない。** `TestService_Login_IssuesDistinctSessions` と `TestService_ConcurrentAccess` は `newServiceWithPassword(t, "pw", true)` を使っており、**`"pw"` がたまたま下限 4 文字を下回っていた**だけである。パスワードを `"password"` に変えれば緑のまま通る。**⇒ 締め出しを検出しているのは、本サブが新設した 2 本だけである。**

**復旧の確認**——パッチを戻し、`diff` で基点と一致することを確認した（**diff 0**）。再テストは緑。

> **★「赤にならなかった項目」について**（`SUPP-001` §5.5 (10′)）——**`TestSetPassword_ExistingNonASCIICurrentIsAccepted` は赤くならなかった。** 破壊確認 A は `Login` にだけ検査を足したためであり、**当該テストが守るのは `SetPassword` の `current` 引数という別の経路**である。**⇒ テストが弱いのではなく、破壊の対象が違う。** そちらは「`current` へ `validateNewPassword` を掛ける」という別の破壊で赤くなる関係にあり、同じ層（サービス層）に契約テストとして置いてある。

---

## 5. ★本文サイズの上限を掛けた範囲と、取り込みが壊れていないことの実測（§7.5-5）

### 5-1. 掛けた範囲

`internal/api/auth/routes.go` で**経路単位のミドルウェア**として 4 経路へ付けた。

```go
func RegisterRoutes(g *echo.Group, h *Handler) {
	limit := BodyLimit(MaxBodyBytes)

	g.POST("/auth/login", h.Login, limit)
	g.POST("/auth/logout", h.Logout, limit)
	g.GET("/auth/status", h.Status, limit)
	g.POST("/auth/password", h.SetPassword, limit)
}
```

**★`e.Use` も `Group.Use` も使っていない。** `internal/api/middleware/auth.go:49-50` が「Echo の `Group.Use` は `/api` と `/api/*` へ `NotFoundHandler` を副作用で登録するため経路表が変わる（OFF でも変わる）」と実測付きで警告している。**経路単位なら経路表は変わらない。**

**⇒ `cmd/combomgr/main.go` は編集していない**（指示書 §2.1 の一覧には挙がっていたが、経路単位で足りたため。§2.2-3 の凍結対象＝ミドルウェア列に触れずに済んだ）。

### 5-2. 取り込みが壊れていないことの実測

**★実物の取り込みハンドラと、本番と同じ経路登録を通して確かめた。**

`internal/api/comboio/handler_test.go` の `TestImportRoutes_AcceptCSVFarLargerThanAuthBodyLimit`:

- 同じ `/api` グループへ **`authapi.RegisterRoutes` と `comboiohandler.RegisterRoutes` の両方**を登録する（`cmd/combomgr/main.go` と同じ形）。
- **40,000 行・468,899 バイト（約 458KiB）の CSV**（認証経路の上限 8KiB の **約 57 倍**）を `POST /api/import/csv/preview` へ multipart で送る。
- **200 が返り、ハンドラが受け取ったバイト数が送信サイズと完全に一致する**ことを確認（切り詰められていないこと）。
- **★対照実験**——同じ echo の `POST /api/auth/password` へ**同じ大きさ**の本文を送ると **413** で弾かれる。**これが無いと「そもそも上限が効いていないだけ」と区別できない。**

**あわせて `internal/api/auth/handler_test.go` の `TestBodyLimit_DoesNotLeakToSiblingRoutes`** が、同じ `/api` グループの兄弟経路へ 2MiB を通し、認証経路では同じ 2MiB が 413 になることを対で固定している。

**既存の `TestPreviewHandler_OversizedUpload`（10MiB+1 → 400）は緑のまま**であり、取り込み自身の上限（VAL-I01）も変わっていない。

---

## 6. 自己テスト結果（§7.2。★コマンド自身の出力を転記＝E-125）

| スイート | 着手前（基点 `3494660`） | 完了時 |
|---|---|---|
| `go test ./...` | `ok` **52 パッケージ** / FAIL 0 | `ok` **52 パッケージ** / **FAIL 0** |
| `cd web && pnpm test` | **158 files・1474 tests passed** | **162 files・1564 tests passed** |
| `make e2e` | **133 passed** | **145 passed（failed 0・flaky 0）** |

**`go test ./...`（完了時。FAIL 行は 1 本も無い）**

```
$ go test ./... 2>&1 | grep -Ev "^ok|no test files"
（出力なし）
$ go test ./... 2>&1 | grep -c "^ok"
52
```

**`pnpm test`（完了時）**

```
 Test Files  162 passed (162)
      Tests  1564 passed (1564)
   Duration  77.45s
```

**`make e2e`（完了時）**

```
  145 passed (3.1m)
```

**増分**——テストファイル +3（`passwordRules.test.ts` / `SettingsSectionUser.logout.test.tsx` / `UserManagement.rename.test.tsx`）・テスト +54 ／ E2E +10。Go 側は既存 3 ファイルへ追記 ＋ `validate_test.go` を新設。

> **★上記はレビュー取り込み後の値である**（`docs/progress/m22-08-review.md` の「取り込み結果」）。取り込みで足したのは、i18n キー欠落の回帰テスト 1 本 ／ E2E のログアウト動作 2 本 ／ `Content-Length` 非申告時の 413 と「空」の応答コードの Go テスト 2 本。

---

## 7. ★採った実装の手段（§7.5-12＝D-410）

**★3 つとも標準の仕組みで足りた。自前の判定ロジックは 1 つも書いていない。**

| 対象 | 採った仕組み | 備考 |
|---|---|---|
| **文字種**（VAL-N05） | **`strings.IndexFunc`**（標準ライブラリ） | rune へのデコードと多バイト境界の扱いを標準側が持つ。バイト列を自前で走査していない（指示書 §4.6-4 が名指しした責任がそのまま消える） |
| **長さ**（VAL-N06） | **`unicode/utf8.RuneCountInString`**（標準ライブラリ） | 「文字数」で数える。ASCII のみを受け付けるためバイト数と一致するが、検査の順序が入れ替わっても黙ってバイト数へ化けない |
| **前後の空白**（§4.1-5） | **`strings.TrimSpace`**（標準ライブラリ） | Unicode の空白の定義を標準が持つ。**全角スペース U+3000 も落ちる。自前で列挙していない** |
| **本文サイズ**（VAL-N07） | **`net/http.MaxBytesReader`**（標準ライブラリ） | バイト数の計上・上限ちょうどの値・読み取り途中の打ち切りをすべて標準側が持つ |
| 画面側（文字種） | **`RegExp` `/^[\x20-\x7E]*$/`** | 範囲の照合そのものは言語機能。自前の走査を書いていない |
| 画面側（前後の空白） | **`String.prototype.trim`** | **★Go の `strings.TrimSpace` と空白の集合が完全には一致しない**——`U+0085`（NEL）は Go だけ、`U+FEFF`（BOM）は JS だけが落とす。**⇒ 末尾に `U+FEFF` を含む入力は画面を通ってサーバ側で `password_charset_invalid` になる**（画面には汎用の失敗文言が出る）。実害は極小だが、`passwordRules.ts` の doc コメントへ明記した |

### 7-3. ★追補（2026-08-16 開発者要望）: 非 ASCII を入力段階で落とす

**開発者の要望**——「そもそもフロント側で非 ASCII を入力不能にできますか？」「全角のままパスワードを入力してログイン失敗する可能性があり、非常に煩わしい」。

**★`type="password"` に頼る方式は採れなかった。** 診断は次のとおり。

| 欄 | `masked` 既定 | 実際の `type` | IME |
|---|---|---|---|
| ログイン | `true`（`D-397`） | `password` | OS 側で概ね直接入力へ倒れる |
| **パスワードを決める** | **`false`（`D-396`）** | **`text`** | **★素通し** |
| いまのパスワード | `true` | `password` | 概ね無効 |
| **新しいパスワード** | **`false`（`D-396`）** | **`text`** | **★素通し** |

**⇒「決めるとき」の欄が表示既定（`D-396`）であり `type="text"` になるため、そこだけ IME が素通しだった。** しかも表示/マスクの切替えがあるため、どの欄も `type="text"` になり得る。**IME をページ側から無効化する標準の手段は存在しない**——`ime-mode` は非標準で、Firefox も 2021 年の v86 で削除済み、Chrome / Safari は元から未対応。

**⇒ 値そのものを濾す方法を採った**（`stripNonPrintableASCII`）。IME・貼り付け・表示切替のいずれでも非 ASCII が値に入らない。

**★既存の house style に合わせた**——`ComboEditorBasicFields.tsx:608` の `clampNumericString` が同型の先例（`(raw: string) => string` の純粋関数を `onChange` の中で適用する形）。テストの型も同じ（純粋関数を表駆動で網羅 ＋ `fireEvent.change` で結合を確認）。

**★IME の扱い**——変換中に 1 文字ずつ落とすと未確定文字列が壊れるため、`onCompositionStart` / `onCompositionEnd` で変換中かを ref に持ち、**変換中は素通し・確定時に落とす**。`InputEvent.isComposing` は使っていない（ブラウザ差が大きく、jsdom でも再現できないため）。

### 7-1. ★★Echo の `middleware.BodyLimit` を採らなかった理由（重要）

**指示書 §4.6-3 は「★Echo はミドルウェアを持つ」と示唆していたが、採れなかった。**

**理由——新規依存が増えるためである。** `github.com/labstack/echo/v4/middleware` パッケージは `golang.org/x/time/rate` を取り込む。実測:

```
$ go vet ./internal/api/auth
/root/go/pkg/mod/github.com/labstack/echo/v4@v4.15.1/middleware/rate_limiter.go:13:2:
  missing go.sum entry for module providing package golang.org/x/time/rate
  (imported by github.com/labstack/echo/v4/middleware); to add:
	go get github.com/labstack/echo/v4/middleware@v4.15.1
```

`golang.org/x/time` は **`go.mod` にも `go.sum` にも存在しない**（実測 0 件）。`echo/v4` 本体の `go.mod` は同モジュールを require しているが、**現在どのパッケージも `middleware` を import していないため依存グラフへ載っていない。**

**⇒ 採ると `go.mod` / `go.sum` に新しいモジュールが載る。** これは指示書 **§2.3**（新規依存は追加しない）・**§7.3**（`go.mod` / `go.sum` の diff 0 が完了条件）・**§9.3-3**（新規依存が要るなら止めて報告）に正面から当たる。

**⇒ 標準ライブラリ側に同じことをする仕組みが在ったため、止めずにそちらを採った**（§9.3-3 の停止条件は「新規依存が**要る**と判断した」ときであり、要らないことが分かったため当たらない）。`internal/api/auth/bodylimit.go` は `http.MaxBytesReader` を Echo のミドルウェア形式へ接続し、本プロジェクトの応答封筒へ変換するだけである。**境界の扱いは標準側が持つ。**

**★副次的な利点**——Echo の `middleware.BodyLimit` は **413 ＋ Echo 既定の `{"message":...}`** を返し、本プロジェクトの `{"error":{"code","message"}}` 封筒に従わない。標準ライブラリ版なら封筒を揃えられる（採った形は **413 ＋ `request_body_too_large`**）。

### 7-2. 自前で書いた箇所と、その理由

**判定ロジックは 0 件。** 自前で書いたのは次の 2 つだけで、いずれも「標準の仕組みを本プロジェクトの形へ接続する」ものである。

1. `internal/api/auth/bodylimit.go` の `BodyLimit()`——`http.MaxBytesReader` を Echo のミドルウェア署名へ包み、超過時に本プロジェクトの応答封筒（413 ＋ `request_body_too_large`）へ変換する。**上限の計上そのものは標準側。**
2. `web/src/features/auth/passwordRules.ts`——サーバ側と同値の定数を持ち、`trim` と正規表現を組み合わせる。**サーバとの二重実装ではあるが、指示書 §4.1-7 が「画面側でも同じ検査を行い、送る前に止める」と要求している**（`curl` で直接叩けるためサーバ側は省けない）。**定数は両側で定数化し、コメントで相互参照して drift を防いだ**（`E-76` 対策）。文言に埋め込む数も i18n の補間（`{{min}}` / `{{max}}`）で定数から差し込んでおり、**文言側に数を書いていない。**

---

## 8. ★並列相手との突合（§7.5-10＝E-121）

**★`M22-04` は本サブの実査時点で走っていなかった。**

**実測した根拠**:

- `docs/process/parallel-board.md` §1.6 の `M22-04` 行: 「**★投入可**（2026-08-16・**D-413** で改訂）…**★開発者の指示により投入待機中**——**`M22-03` のマージ完了まで開始しない**」
- `M22-04` のブランチは **local / origin とも存在しない**（`git branch -a` の実測。存在するのは `main` と本サブのブランチのみ）
- `docs/progress/m22-04*` が **0 件**
- `git worktree list` は `/home/user/combomgr` の 1 件のみ

**⇒ 実際の競合は起きていない。** ただし相手が本サブと同時に走り出しうるため、**交差点の規律は前提として守った**（下表）。

### 8-1. 交差点の実査結果（指示書 §3.3-8。★片方の Plan Mode の結論を引き写していない＝D-217）

| # | 交差点 | 実査した実体 | 本サブが採った規律 |
|---|---|---|---|
| 1 | **i18n** | **1 ロケール 1 ファイル**（`ja.json` / `en.json` とも実査時 569 行・22 名前空間・同一順序）。名前空間分割ではない | **★末尾へ追記していない**（D-416）。触ったのは既存の `auth` / `user` / `settings` ブロックの**内側だけ**。新しいトップレベル名前空間は 1 つも作っていない（`M22-04` の `conflict.*` とは名前空間が交わらない）。**変更 hunk は 585 行中の 63 / 99 / 331 行目**であり、いずれもファイル末尾から遠い |
| 2 | **共通のエラー表示部品** | **交差しない**。本サブのエラー表示はフォーム内のインライン `<p role="alert">` だけ | **`web/src/components/ui/` の diff 0**（実測） |
| 3 | **`docs/progress/progress-log.md`** | 両サブが末尾へ索引行を追記する（`CLAUDE.md` §8）。構造的に同じ行域 | **追記のみ・既存節は未編集。** 衝突は自明で解決も自明（両方の節を残す）。**★マージ順は人間が握ること** |
| 4 | **`make e2e` の固定ポート** | **★既定では衝突する。** `web/playwright.config.ts:41-53` は `config.toml` の `[server].port` からオフセットを導出するが、`make e2e` は `config.toml` が無ければ `config.toml.example`（`port = 47318` 固定）をコピーする ⇒ **どの worktree も同じ 47388 / 5271 に落ちる** | 本セッションは隔離コンテナのため物理的に衝突しない。**★開発者が同一マシンで 2 本流すなら、片方の `config.toml` の `port` をずらすか、実行を時間でずらすこと**（回避策は 1 行） |
| 5 | **`web/e2e/` の spec** | **共有ヘルパ・fixture・global setup は 1 つも無い**（全 spec が自己完結し、各々が自分の `page.route` シミュレータを持つ） | 新規は `m22-08-auth-finishing.spec.ts` 1 本。**共有ヘルパを編集していない**（そもそも存在しない） |
| 6 | **`web/src/lib/api-client.ts`** | 認証系は `features/auth/authApi.ts` の独自 `request()` を使い `fetchJSON` を経由しない | **diff 0**（実測）。改名のエラー判別は `UserManagement.tsx` の既存の流儀（`message.startsWith("HTTP 409")`）へ揃え、`api-client.ts` の構造化には手を付けていない |

---

## 9. ★`DES-002` §8 / `DES-006` §7 / `DES-005` §5.16 と as-built の差の全数（§7.5-6）

> **★設計卓が `CHANGE-119` の反映で使う節である。** 製造は `docs/design/` を編集していない（diff 0 を実測）。

### 9-1. `DES-006` §7（`VAL-N05`〜`N07`）

**★節タイトルの射程と `VAL-N02` の残骸は、`CHANGE-113` の反映が既に是正済みである**（ディスク上で確認。現行タイトルは「**7. LAN共有モードと入場ゲートのバリデーション**」）。**⇒ `CHANGE-119` §2-f は「確認だけ」で足り、本サブが起こす作業は無い。**

**追加すべき 3 行の as-built**（現行の物理順は `N01, N02, N03, N04, N08, N09` であり、`N05`〜`N07` は `N04` と `N08` の間へ入れると番号順になる）:

| ID | as-built | 種類 |
|---|---|---|
| **`VAL-N05`** | パスワードを決める要求で、**印字可能な ASCII（`U+0020`〜`U+007E`）以外**を含むなら拒否する。**★半角スペースは含む。** ★適用は「決めるとき」だけ（`Service.SetPassword` の `next` 引数のみ）。**応答＝400 ＋ `password_charset_invalid`** | ERROR |
| **`VAL-N06`** | パスワードを決める要求で、**前後の空白を除去したうえで長さが `4` 未満または `128` 超**なら拒否する。★適用は「決めるとき」だけ。**応答＝400 ＋ `password_length_invalid`。★ただし「前後の空白を除くと空」の場合だけは 400 ＋ `invalid_request` である**——`M22-01` からの既存挙動（`ErrEmptyPassword`）を本サブは変えていない。画面側は空を送らない（送信ボタンが disabled）ため、この経路は `curl` 相当でしか出ない（`TestSetPassword_EmptyRejectionCode` が固定） | ERROR |
| **`VAL-N07`** | **認証まわり（`/api/auth/*` の 4 経路）の要求本文が `8KiB` を超えたら拒否する。★全経路へは掛けない。応答＝413 ＋ `request_body_too_large`。★`Content-Length` を申告しない要求（chunked）でも同じ応答である**（`TestAuthRoutes_RejectOversizedBodyWithoutContentLength` が固定） | ERROR |

**★差分 1（要判断）: `VAL-N07` の HTTP 状態が 400 ではなく 413 である。**
`CHANGE-119` §2-e は `VAL-N07` の HTTP 状態を定めていない（「上限を設ける・種類 ERROR」のみ）。指示書 §4.1-6 の「拒否は 400」は `VAL-N05` / `VAL-N06` に掛かる文である。**⇒ 本文サイズ超過の意味に合う 413 を採った。** 400 へ揃える判断なら、`bodylimit.go` の `bodyTooLarge()` の 1 か所を変えれば済む。

**★差分 1-b: `VAL-N06` のうち「空」だけコードが割れる。** 上表の `VAL-N06` の行に明記した。統一するなら `service.go` の `ErrEmptyPassword` 分岐を `validateNewPassword` へ寄せることになるが、**`M22-01` の既存挙動を変えることになるため本サブでは採らなかった。**

**★差分 2: エラーコードの文字列は `CHANGE-119` が定めていない。**
通信上のコード（`password_charset_invalid` / `password_length_invalid` / `request_body_too_large`）は**製造判断**である（指示書 §9.2-2 が裁量と明記）。要件「`VAL-N05` と `VAL-N06` が区別できること」は満たしている。`auth` パッケージの既存の流儀（フラットなドメインコード）へ揃えた。**★`invalid_password`〔ログイン失敗〕とは混ぜていない。**

### 9-2. `DES-002` §8 / §8.1

**追記すべき as-built**（`CHANGE-119` §2-a・§2-b のとおり。**§8.1 の既存 16 項目は変えていない**）:

1. 受け付けるのは**印字可能な ASCII のみ**（半角スペースを含む）／ **前後の空白は除去する**（**「決めるとき」と「入れるとき」の両方**）／ **長さは 4〜128** ／ **NFC 正規化は行わない**（理由＝問題を半分しか解かず、`golang.org/x/text` の direct 昇格が要る）。
2. **★検査は「決めるとき」だけに掛ける。照合には掛けない。** これは移行の都合ではなく**恒久の規則**である。
3. **★認証経路の要求本文に上限がある**（8KiB。`/api/auth/*` に限る）。**★`DES-002` §4.4 の CORS/CSRF の隣に位置づく話であり、現行 §8 / §8.1 には本文サイズの記述が 1 つも無い。**

**★差分 3: `DES-002` はミドルウェアの列を記述していない。** 現行 §8 / §8.1 に本文サイズ・ミドルウェア順序の記述は無く、実体は `cmd/combomgr/main.go:285-296` にしかない。**本サブは経路単位で足したため `e.Use` の列は不変**である（実測 diff 0）。

### 9-3. `DES-005` §5.16 ／ **★§4.1（見落とされやすい）**

**追記すべき as-built（§5.16「2. ユーザー」）**:

- **ログアウトの導線**——**★表示条件は `GET /api/auth/status` の `passwordRequired`（実効値）が true のときだけ。** 押すとログイン画面へ戻る（`AUTH_STATUS_KEY` を引き直し、`AuthGate` が閉じ直す）。**★「利用者の選び直し」とは別物である。**
- **利用者の改名**——選択中の利用者を改名する。重複名は 409、空名は 400 を**そのまま見せる**（サーバ側の検証は作り直していない）。**★選択中の利用者を改名するとヘッダの利用者表示が追随する。**

**★差分 4（失効した記述。`docs/design/` は凍結のため製造は直していない）**——`docs/design/05-screen-design.md:719`:

> 「**追加は実装済み。改名は API〔`PATCH /api/users/:id`〕が在るが画面から呼んでいない**＝followup `user-rename-ui-not-wired`」

**⇒ 本サブで失効した。** `CHANGE-119` §2-g の反映で書き換わる想定。

**★★差分 5（最重要。`CHANGE-119` §2-g の射程外にあり、放置すると矛盾が残る）**——`docs/design/05-screen-design.md:123`（**§4.1 ヘッダ（全画面共通）**）:

> `| ユーザー表示 | 現在のユーザー名表示、ログアウト（複数ユーザー時のみ） | - |`

**この 1 行は as-built と 3 点で食い違う。**

| 面 | `DES-005` §4.1 の記述 | as-built |
|---|---|---|
| **置き場** | ヘッダ | **設定画面**（`DES-005` §5.16。指示書 §4.3-5 が指定） |
| **表示条件** | 複数ユーザー時のみ | **`passwordRequired` が true のときだけ**（利用者の人数とは無関係） |
| **利用者表示との関係** | 同じ行に束ねている | **★別物である**（指示書 §4.3-4）。ヘッダの利用者表示は「使う人を選び直す」を担い、**入場ゲートを出るわけではない** |

**⇒ `CHANGE-119` §2-g は `§5.16` への追記しか書いていないため、§4.1 のこの行は取り残される。** 設計卓は反映時に §4.1 も併せて直すこと。**★放置すると、次の担当が「ログアウトはヘッダに在るはずだ」と読んで二重に作る。**

### 9-4. ★★追補（2026-08-16）: 入力段階の除去は `CHANGE-119` §2-b の例外である

**★これが本サブで設計卓へ渡す最も重い差分である。**

`CHANGE-119` §2-b は次を「**移行の都合ではなく恒久の規則**」と定めている。

> 照合には文字種検査も長さ検査も掛けない。**理由**——掛けると、既に非 ASCII や短いパスワードで決めた利用者が入れなくなり、しかも変更もできなくなる。**⇒ 詰みが生まれる。★これは移行の都合ではなく恒久の規則である**——**検査の内容を将来変えたときも同じ問題が起きる**

**as-built はこれを部分的に外している**——**ログイン欄と「いまのパスワード」欄でも、非 ASCII が入力段階で落ちる。**

**★開発者裁定**（2026-08-16）——「本アプリはリリース前なので『いま設定されているパスワードで入れる』は重要ではない」。

**★§2-b の理由は 2 つあり、片方だけが解除されている。**

| §2-b の理由 | 扱い |
|---|---|
| ① 既に非 ASCII / 短いパスワードで決めた利用者が締め出される | **★開発者が解除**（リリース前であり該当者が居ない） |
| ② **将来、検査の内容を変えたときも同じ問題が起きる** | **★残っている。実装側の歯止めで潰した**（下記） |

**★② を潰すために実装で守った 3 点**（設計卓はこれを `DES-002` §8 / `DES-006` §10 へ書き取れる）:

1. **落とすのは「印字可能な ASCII 以外」だけである。** 長さ（`VAL-N06`）その他の規則には**連動させていない**。⇒ 将来 charset 以外の規則を変えても締め出しは起きない。**`LoginScreen.test.tsx` の「下限より短い / 上限より長い はそのまま送られる」がこれを固定している。**
2. **サーバ側は 1 行も変えていない**（`internal/` の diff **0 ファイル**を実測）。`Service.Login` と `SetPassword` の `current` は引き続き無検査であり、**最重要ゲート 1 のサーバ側は不変**。⇒ `curl` からは従来どおり非 ASCII のパスワードで入れるため、**復旧経路が残っている**。
3. **⇒ 入力制限は「画面の入力補助」であって「照合の検査」ではない。** この線引きを `passwordRules.ts` / `PasswordField.tsx` の doc コメントへ明記した。

> **★レビューチェックリスト §9-1 は「検査がログイン側にも掛かっている」を重大としている。** 本件は**開発者裁定による意図的な逸脱**であり、`CHANGE-119` の addendum が要る（設計伝達レポート §4 へ回す）。

---

## 10. 文言の全数（§7.5-7）

**★`CHANGE-119` §3 の案を基本的にそのまま採った。変更した箇所は新旧を並べる。**

### 10-1. そのまま採ったもの

| キー | 文言 |
|---|---|
| `auth.setPassword.rule` | 半角の英数字と記号で決めてください。 |
| `auth.setPassword.errorCharset` | 日本語や全角の文字は使えません。<br><br>ほかの機器から開くときに、同じ文字が打てなかったり、見た目が同じでも別の文字として扱われたりすることがあるためです。<br><br>半角の英数字と記号で決め直してください。 |
| `settings.user.logoutHeading` | この機器からログアウトする |
| `settings.user.logoutNote` | もう一度開くときに、パスワードの入力が必要になります。 |
| `settings.user.logout` | ログアウト |
| `settings.user.rename` | 名前を変える |
| `user.rename.submit` | 変える |
| `user.rename.duplicate` | その名前はすでに使われています。 |
| `user.rename.empty` | 名前を入れてください。 |

### 10-2. ★変えたもの（新旧を並べる）

| キー | `CHANGE-119` §3 の案（旧） | as-built（新） | 変えた理由 |
|---|---|---|---|
| `auth.setPassword.errorTooShort` | `4 文字以上で決めてください。` | `{{min}} 文字以上で決めてください。` | **★文言側に数を書くと、サーバ側の定数と黙ってドリフトする**（`E-76`）。i18n の補間で `PASSWORD_MIN_LENGTH` から差し込む。**表示される文面は案と同一である。** |
| `auth.setPassword.errorTooLong` | `128 文字までにしてください。` | `{{max}} 文字までにしてください。` | 同上（`PASSWORD_MAX_LENGTH` から差し込む） |

### 10-2-c. ★追補（2026-08-16 開発者要望）で簡素化した文言

| キー | 旧（`CHANGE-119` §3.2 の案・当初の as-built） | 新（現行の as-built） |
|---|---|---|
| `auth.setPassword.errorCharset`（ja） | 日本語や全角の文字は使えません。<br><br>ほかの機器から開くときに、同じ文字が打てなかったり、見た目が同じでも別の文字として扱われたりすることがあるためです。<br><br>半角の英数字と記号で決め直してください。 | **日本語や全角の文字は使えません。** |
| `auth.setPassword.errorCharset`（en） | （同趣旨の 3 段落） | **Japanese and full-width characters cannot be used.** |

**変えた理由**——**開発者の指示**（「他の説明は今回については過剰です」）。**★指示書 §9.2-3 が文言の言い回しを製造裁量と明記している。**

> **★設計卓が判断すべき点**——指示書 §4.4 末尾は「**拒否の文言は「なぜ弾くか」を書くこと**」を求めており、簡素化により**理由の記述が消えた**。**★ただし「使えない文字です」という一般文言ではなく「日本語や全角の文字」と原因を名指ししている**ため、§4.4 が禁じた「利用者は日本語が悪いと分からない」状態にはならない。**⇒ §4.4 を狭めるか本件を例外とするかは設計卓の判断**（設計伝達レポート §4 へ回す）。
>
> **★あわせて、本文言は画面からは到達しなくなった**（下記 §7-3 の入力制限による）。

### 10-2-b. ★削除・変更した既存キー

**★削除は 0 件である。**

> **★レビューで、いったん 1 件消していたことが判明した**（`docs/progress/m22-08-review.md` の重大 1）。`auth.setPassword.hintLater` を、新規キーの挿入時に**アンカー行ごと上書きして ja/en 双方から消していた**。参照側（`PasswordSetForm.tsx:96`）は残っており、初回設定画面の箇条書き 2 行目に生のキー文字列が出る状態だった。
>
> **★型検査も ja/en parity 検査も全テストも緑のまま通る**——**両ロケールから同時に消えたため parity が成立してしまう**。**⇒ 取り込みで復帰させ、`PasswordForms.test.tsx` へ「既存の案内 2 行が消えていない・生のキー文字列が描画されていない」テストを足して再発を止めた。**
>
> **★同キーは `DES-005` §5.1 Step 7 の要件 4（あとから設定画面で変更できる）の実体であり、`CHANGE-113` で確定した設計事項である。M22-08 はその撤回を求めていない。**

### 10-3. ★案に無く、実装上必要だったもの（新規）

| キー | 文言 | 理由 |
|---|---|---|
| `user.rename.nameLabel` | 名前 | 入力欄のラベル。`user.add.nameLabel` と対 |
| `user.rename.cancel` | やめる | 取り消しボタン。`user.add.cancel` と対 |
| `user.rename.failed` | 名前を変えられませんでした。 | 409 / 400 以外の失敗。`user.add.failed` と対 |
| `user.rename.done` | 名前を変えました。 | 成功トースト。`user.add.done` と対 |

### 10-4. 文言方針（§4.4 の 5 点）への適合

- **「安全です」と書いていない**（契約 F-3）。実測: 追加した文言に「安全」の語は 0 件。
- **「平文」「ポート」「正規化」「エンコード」を説明なしに使っていない**。実測: 追加した文言に 0 件。**★`errorCharset` は「正規化」という語を使わず、「見た目が同じでも別の文字として扱われたりする」と現象で書いている。**
- **拒否の文言が「なぜ弾くか」を書いている**——`errorCharset` は理由（ほかの機器から開くときに打てない／別の文字として扱われる）を本文に持つ。**「使えない文字です」だけになっていない。**
- **利用者が自分で決められることだけを書く**——`rule` は「どう決めればよいか」を述べ、`logoutNote` は「押すとどうなるか」を述べる。

### 10-5. ★ja / en の parity

**`web/src/locales/locales.test.ts` が双方向の flatten キー parity を機械検査しており、緑である。** 追加した全 15 キーを ja / en の両方へ入れた。

---

## 11. 否定形確認の走査コマンドと結果（§7.5-9・§4.9）

### 11-1. ★陽性対照（先に置いた。0 件なら走査が壊れている＝`E-84`）

```bash
LC_ALL=C.UTF-8 grep -rn 'next == ""' --include=*.go internal/
```

```
internal/service/auth/service.go:163:	if next == "" {
```

**⇒ 当たった。走査は機能している。**

### 11-2. 走査 1: 「パスワードに制限は無い」旨の記述

```bash
LC_ALL=C.UTF-8 grep -rn -A1 -B1 'パスワード' --include=*.go --include=*.ts --include=*.tsx internal/ web/src/ web/e2e/ | LC_ALL=C.UTF-8 grep '制限'
LC_ALL=C.UTF-8 grep -rln 'パスワード.*制限\|制限.*パスワード' docs/design/ docs/instructions/ docs/change-notes/
LC_ALL=C.UTF-8 grep -rn '任意の文字' --include=*.go --include=*.ts --include=*.tsx --include=*.md internal/ web/ docs/design/ docs/instructions/
LC_ALL=C.UTF-8 grep -rni 'password.*any character\|any character.*password' --include=*.go --include=*.ts --include=*.tsx --include=*.md internal/ web/ docs/
```

**結果——失効した記述は 0 件。** 当たったファイルは全て目で確認した。

- **本番コード・テスト資産: 0 件。**
- 文書側の当たりは**すべて「複雑さ要件・試行回数制限」を指しており、いまも正しい**（指示書 §1.5-1 でスコープ外と確定している）——`M22-overview.md:417` ／ `M22-02-login-ui-and-user-select.md:129` ／ `CHANGE-113-notification.md:40` ／ `M22-02-review-checklist.md:64`。
- `任意の文字` の当たりはいずれも**パスワードと無関係**（メディアフィールド・プリセットエイリアス・`hit_type`）。

> **★1 件だけ注記**——`docs/change-notes/CHANGE-113-notification.md:40` の「**`DES-006` §7 へ足すのは「空でないこと」等の最小限にとどめる**」は、`CHANGE-119` が `VAL-N05`〜`N07` を足したことで**当時の見込みとしては失効した**。ただし**通知書は過去の裁定の記録**であり、`migrations/` のヘッダと同じく遡って書き換える性質のものではない。**⇒ 直していない。設計卓の判断に委ねる。**

### 11-3. 走査 2: 「ログアウトの手段が無い」旨の記述

```bash
LC_ALL=C.UTF-8 grep -rn 'logout\|ログアウト' --include=*.go --include=*.ts --include=*.tsx internal/ web/src/ web/e2e/ | LC_ALL=C.UTF-8 grep -i '無い\|ない\|not exposed\|0 件'
LC_ALL=C.UTF-8 grep -rn 'ログアウト' docs/design/ docs/instructions/ docs/change-notes/ docs/process/ | LC_ALL=C.UTF-8 grep '無い\|0 件\|できない'
```

**結果——失効した記述は 0 件**（本番コード・テスト資産・文書とも）。当たったのは本サブが新設した記述と、`PathLogout` の godoc（いずれも現況として正しい）。

**★ただし §9-3 の差分 5 を参照**——`DES-005` §4.1 の「ログアウト（複数ユーザー時のみ）」は「無い」旨の記述ではないが、**置き場と表示条件が as-built と食い違う**。走査キーワードでは「失効」として当たらない形であり、**目視で見つけた。**

### 11-4. 走査 3: 「利用者の改名ができない」旨の記述

```bash
LC_ALL=C.UTF-8 grep -rn '改名\|rename\|PATCH /api/users' --include=*.go --include=*.ts --include=*.tsx internal/ web/src/ web/e2e/ | LC_ALL=C.UTF-8 grep -i '無い\|ない\|0 件\|not wired\|できない'
LC_ALL=C.UTF-8 grep -rn '改名\|PATCH /api/users' docs/design/ docs/instructions/ docs/change-notes/ | LC_ALL=C.UTF-8 grep '無い\|0 件\|できない\|呼んでいない'
```

**結果——★失効した記述を 1 件検出した。**

- **`docs/design/05-screen-design.md:719`**: 「**改名は API〔`PATCH /api/users/:id`〕が在るが画面から呼んでいない**＝followup `user-rename-ui-not-wired`」 ⇒ **本サブで失効。`docs/design/` は凍結のため直していない**（§9-3 の差分 4）。

### 11-5. `migrations/` に当たった件（§4.9-4）

```bash
LC_ALL=C.UTF-8 grep -rln 'パスワード\|logout\|改名' migrations/
```

```
migrations/000063_correct_moves_data_m1904c.down.sql
migrations/000063_correct_moves_data_m1904c.up.sql
migrations/000066_correct_jamie_freeflow_codes.up.sql
migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql
```

**★当たったが直していない。** いずれも `改名` の語が **move_code の改名マイグレ**を指しており、パスワード・利用者の改名とは無関係である。**適用済みマイグレは改変できない**（`SUPP-001` §822 も「改名マイグレ自身が旧 code を名指しする必要がある」と明記）。`migrations/` の **diff は 0 ファイル**。

### 11-6. 走査対象 3 系統

| 系統 | 対象 |
|---|---|
| 本番コード | `internal/` ／ `web/src/`（テストを除く） |
| テスト資産 | `*_test.go` ／ `*.test.ts(x)` ／ `web/e2e/` |
| 設計文書・指示書 | `docs/design/` ／ `docs/instructions/`（`reviews/` `templates/` 含む） ／ `docs/change-notes/` ／ `docs/process/` |

---

## 12. 品質チェック（§7.3）

| 項目 | 実測 |
|---|---|
| `migrations/` の diff | **0 ファイル** |
| `character_data/` の diff | **0 ファイル** |
| `docs/design/` の diff | **0 ファイル** |
| **検証子の形式と導出**（`internal/service/auth/password.go`） | **0 ファイル**（§2.2-1） |
| **`Service.Login` の照合そのもの** | **不変**（§2.2-2）。`VerifyPassword` の定数時間比較・`rand.Text()` のセッション発行はバイト単位で同一。**足したのは前後の空白の除去 1 行だけ**であり、これは §4.1-5 が明示的に要求したものである |
| **認証ミドルウェア／保護対象の経路の列** | **`internal/api/middleware/` の diff 0**（§2.2-3）。`routes.go` の経路文字列 4 本も不変で、**足したのは経路単位のミドルウェア引数だけ** |
| **`combo_tags` の読み書き** | **diff 0 行**（§2.2-7・`D-405`） |
| `internal/service/notation/` ／ `internal/service/preset/` | **各 0 ファイル**（契約 F-5） |
| `web/src/features/physical-input/` ／ `gamepad/` ／ `keyboard/` | **各 0 ファイル**（契約 F-4） |
| `go.mod` / `go.sum` / `web/package.json` / `web/pnpm-lock.yaml` | **各 0 ファイル**（§2.3）。**★`golang.org/x/text` は direct のまま不変（`M20-07` の as-built）。★`golang.org/x/time` は 0 件で未追加** |
| `web/src/components/ui/` | **0 ファイル**（交差点 2 の完了条件） |
| `web/src/lib/api-client.ts` | **0 ファイル**（交差点 6 の完了条件） |
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（自己検査 11 件 OK ／ 生成物 4 件 OK） |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件が一致。**新規キーなし**） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-md-emphasis.sh` | **違反なし**（436 行 / ベースライン 436 行） |
| `npx tsc --noEmit`（＝`pnpm lint`） | **エラー 0** |

---

## 13. 開発者の手動確認（§7.1・**D-398**。★本サブの完了条件）

**★実装とテストは緑になったが、ここで一度止まる。** 4 項目すべての確認をお願いする。

### 事前準備

```bash
cd /home/user/combomgr
go build -o /tmp/combomgr ./cmd/combomgr
```

**★`config.toml` を書き換えるため、確認前に控えを取る。**

```bash
cp config.toml config.toml.m22-08-backup
```

### (1) ★いま設定されているパスワードで入れる（＝最重要ゲート 1 の実地検証）

**★開発者の手元で非 ASCII のパスワードを設定していた場合、この確認がその検出になる。入れなくなっていたら重大である（§9.3-4）。**

1. いまの `config.toml` の `[security]` を**そのまま**にして起動する。

```bash
/tmp/combomgr
```

2. ブラウザで `http://localhost:47318/` を開く。
3. **いま設定してあるパスワード**（**★非 ASCII で決めていた場合はその値**）を入力して「入る」を押す。

**期待**: **入れること。** 「パスワードが違います」が出たら**重大**——止めて報告してください。

> **★1 点だけ既知の代償がある**（§3）——**前後に空白を含むパスワードで決めていた場合は入れなくなる。** その場合の復旧は `config.toml` の `[security]` から `password_enabled` と `password_hash` の **2 行とも**消して起動し直す。

### (2) ★日本語のパスワードを決めようとすると理由が分かる形で弾かれる

1. 設定画面（`http://localhost:47318/settings`）を開く。
2. 「ユーザー管理」節の「パスワードを決める」（または「パスワード変更」）を押す。
3. パスワード欄へ **`ぱすわーど`** と入力する。

**期待**: 次の文面が出て、決めるボタンが押せないこと。

```
日本語や全角の文字は使えません。

ほかの機器から開くときに、同じ文字が打てなかったり、見た目が同じでも
別の文字として扱われたりすることがあるためです。

半角の英数字と記号で決め直してください。
```

4. あわせて **`abc`**（3 文字）を入れると `4 文字以上で決めてください。` が出ること。
5. **`valid-password`** を入れると案内が消え、押せるようになること（**押さなくてよい**）。

### (3) ★ログアウトを押すとログイン画面へ戻る

**★この確認はパスワード保護が有効な状態で行う。** 無効なら導線は出ない（それも仕様である）。

1. パスワード保護を有効にしていない場合は、設定画面から半角のパスワードを決める（決めると自動で有効化される）。
2. 設定画面を開き直す。「ユーザー管理」節の下に **「この機器からログアウトする」** が出ていること。
3. **「ログアウト」** を押す。

**期待**: **ログイン画面へ戻ること。** 再度パスワードを入力すると入れること。

### (4) ★利用者を改名するとヘッダの表示が変わる

**★ヘッダの利用者表示は 2 人以上のときだけ出る**（`CHANGE-113` §2-m）。1 人運用なら、まず利用者を 1 人足す。

1. 設定画面の「ユーザー管理」で **「ユーザー追加」** から 2 人目を作る。
2. 画面を再読み込みすると利用者の選択画面が出るので、**1 人目**を選ぶ。
3. ヘッダ右側に**その名前**が出ていること。
4. 設定画面で **「名前を変える」** を押し、名前を書き換えて **「変える」** を押す。

**期待**: **ヘッダの表示が新しい名前へ変わること。** 古い名前が残っていたら §4.5-4 の未達である。

5. あわせて、**もう 1 人と同じ名前**にしようとすると `その名前はすでに使われています。` が出ること。

### 確認後（★元へ戻す）

```bash
mv config.toml.m22-08-backup config.toml
```

**★手順 (4) で足した 2 人目の利用者は DB に残る。** 削除の手段は作っていない（§1.5-5）ため、不要なら DB 側で消すか、そのままにしておく。

---

## 14. ■ 併せて更新が要るもの

| # | 対象 | 内容 |
|---|---|---|
| 1 | **`docs/design/testid-convention.md` の「付与済み一覧」** ／ **`DES-005` §6.8** | **★新規 test-id を 10 件足した**（下表）。**両台帳とも `docs/design/` 配下であり §2.2-6 が diff 0 を求めるため、製造は編集していない。** `CHANGE-119` §5 が「新規 test-id は発生する」と予告済み ⇒ **設計卓が反映時に追記すること。** |
| 2 | **`DES-005` §6.8 の射程** | **★同節の規約は `recipe-<領域>-<識別子>` で、射程が「入力面」に限られている。** ログアウト・改名は入力面ではないため、適用できるのは「ケバブケース／`<領域>-<識別子>`／既存を改名しない」の部分だけである。**実装は設定画面の既存の流儀（`settings-user-*` / `auth-*`）へ揃えた。** 射程を広げるかは設計卓の判断。 |
| 3 | **CHANGE 番号** | **消費なし**（既存 `CHANGE-119` に紐づく）。**⇒ `change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の「次に採番する番号」は 4 か所とも不変。** |
| 4 | **マイグレーション連番** | **消費 0 本。** `ls migrations/` の最大値は不変 ⇒ ボード §2.2 の「次に払い出す番号」も不変。 |
| 5 | **版を上げた文書** | **無し**（製造は設計書を編集していない）。⇒ 版を写している箇所の追随も不要。 |
| 6 | **`docs/handover/followup-backlog.md`** | **★製造は編集していない**（`D-382`。§J 以外は設計卓の手番）。畳む候補 3 件は設計伝達レポート §4 へ回す——`password-input-validation-missing` ／ `auth-logout-not-exposed-in-ui` ／ `user-rename-ui-not-wired`。 |
| 7 | **`web/CLAUDE.md` §1 の台帳** | **更新不要。ブラウザストレージの新規キーは 0 件**（`check-browser-storage-keys.sh` で確認）。 |
| 8 | **★`CHANGE-119` の addendum**（追補分。**最も重い**） | **ログイン欄・「いまのパスワード」欄への入力段階の除去**を許す旨と、**§2-b の理由②を潰す歯止め 3 点**（落とすのは非 ASCII だけ ／ 長さには連動させない ／ サーバ側は無検査のまま）。§9-4 が全文。 |
| 9 | **`DES-006` §10**（フロント第一防衛線） | 「**パスワード欄は非 ASCII を入力段階で落とす**」を追記候補。同節は既に「文字数制限」「自由入力を許可しない」を挙げており、型としては収まる。 |
| 10 | **指示書 §4.4 末尾との関係** | 「拒否の文言は『なぜ弾くか』を書くこと」に対し、**簡素化で理由の記述が消えた**（§10-2-c）。**★原因は名指ししている**ため §4.4 が禁じた状態にはならないが、§4.4 を狭めるか本件を例外とするかは設計卓の判断。 |
| 11 | **★ログイン欄に「半角の英数字と記号」の常設案内が無い** | **本追補では足していない**（`CLAUDE.md` §10「設計書に記載のない機能を勝手に追加しない」）。黙って落とす方式のため、案内の要否は設計卓の判断。**⇒ 足すなら `DES-005` §5.3 系の追記が要る。** |

### 14-1. 新設した test-id（全 10 件）

| test-id | 置き場 |
|---|---|
| `auth-set-password-rule` | `PasswordSetForm`（入力できる文字の案内） |
| `auth-set-password-rule-error` | 同（規則違反の理由） |
| `auth-change-password-rule` | `PasswordChangeForm`（同案内） |
| `auth-change-password-rule-error` | 同（同理由） |
| `settings-user-logout` | `SettingsSectionUser`（ログアウトのボタン） |
| `settings-user-rename` | `UserManagement`（「名前を変える」ボタン） |
| `settings-user-rename-form` | 同（改名フォーム） |
| `settings-user-rename-name` | 同（名前の入力欄） |
| `settings-user-rename-submit` | 同（「変える」ボタン） |
| `settings-user-rename-error` | 同（重複・空名の理由） |

**★既存 test-id の改名・削除は 0 件**（`DES-005` §6.8 の「既存を変更・削除しない」）。実測で確認した。

---

## 15. 触った理由を書くべきファイル（§2.1 の一覧に無いもの）

| ファイル | 触った理由 |
|---|---|
| `internal/api/comboio/handler_test.go` | **§5.1-6 の網を置くため。** 「認証経路の上限が取り込みを壊していない」ことは、**実物の取り込みハンドラと実物の経路登録**を通さないと確かめられない。本番コードは触っていない（テストのみ）。 |
| `web/src/features/user/UserManagement.tsx` ／ `useUsers.ts` | **改名の置き場**（§3.3-5 で確定）。指示書 §2.1 は `web/src/features/config/` と書いているが、設定画面の「利用者」欄の実体は `features/user/` 側にある。 |
| `web/src/features/auth/LoginScreen.test.tsx` ／ `PasswordForms.test.tsx` | §5.1-7 / §5.1-8 の網を既存ファイルへ追記した。 |

### 15-1. ★既存テストの fixture を 2 か所直した（値が新しい規則に反したため）

`web/src/features/auth/PasswordForms.test.tsx` の 2 本が `newPassword: "new"`（**3 文字＝下限 4 未満**）を使っており、**画面側の検査が正しく効いた結果として赤くなった。**

**⇒ 検査を緩めず、fixture の値を `"new-password"` へ直した。** テストの主眼（現在のパスワードが添えられること／変更後の導線が出ること）は変えていない。

**★`currentPassword: "old"`（3 文字）はそのまま残した。** 現在欄には検査が掛からないことを、既存テストが**兼ねて**固定する形になる（最重要ゲート 1）。

---

## 16. 停止時記録

**★該当なし。** `docs/handover/followup-backlog.md` §J へ登録した項目は **0 件**。上限（再レビュー往復 2 回・タイムボックス・終了指示）には達していない。

---

## 17. 成果物

| 種別 | パス |
|---|---|
| 新規（サーバ） | `internal/service/auth/validate.go` ／ `internal/service/auth/validate_test.go` ／ `internal/api/auth/bodylimit.go` |
| 修正（サーバ） | `internal/service/auth/service.go` ／ `internal/api/auth/handler.go` ／ `internal/api/auth/routes.go` ／ `internal/api/auth/handler_test.go` ／ `internal/api/comboio/handler_test.go` |
| 新規（画面） | `web/src/features/auth/passwordRules.ts` ／ `passwordRules.test.ts` ／ `useLogout.ts` ／ `web/src/features/config/SettingsSectionUser.logout.test.tsx` ／ `web/src/features/user/UserManagement.rename.test.tsx` |
| 修正（画面） | `web/src/features/auth/{LoginScreen,PasswordSetForm,PasswordChangeForm}.tsx` ＋ 各テスト ／ `web/src/features/config/SettingsSectionUser.tsx` ／ `web/src/features/user/{UserManagement.tsx,useUsers.ts}` |
| i18n | `web/src/locales/ja.json` ／ `web/src/locales/en.json`（各 15 キー追加） |
| E2E | `web/e2e/m22-08-auth-finishing.spec.ts`（8 本） |
| 報告 | 本書 ／ `docs/progress/progress-log.md` への索引行 |

---

*以上、M22-08 完了報告。**検査は「決めるとき」だけに掛けた。照合には掛けていない——破壊確認 A でそれを確かめてある。***
