# M22-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | `git diff ee06d48..9d087ee`（76 ファイル / +4938 −209） |
| 対象指示書 | `docs/instructions/M22-02-login-ui-and-user-select.md`（**HEAD 実物は v1.1.0**。完了報告は v1.5.0 を参照＝下記 §3 M-6） |
| チェックリスト | `docs/instructions/reviews/M22-02-review-checklist.md`（HEAD 実物は v1.1.0） |
| レビュー実施日 | 2026-08-15 |
| 判定 | **不合格（完了承認を妨げる重大 5 件）**。うち 1 件は **既定構成（`password_enabled = false`・利用者 1 人）で既存機能が 500 になる回帰**である |

---

## 総評

段 1（パスワードの面）の作りは良い。最重要ゲート 1 の固定の仕方（`AuthGate.test.tsx` が `useConfig` を「生値 true」で常時モックし、生値を見に行った瞬間に赤くなる罠を張る）と、E2E の対照実験 2 本は、指示書が要求した「破っても緑になる型」への対処として的確である。凍結領域の diff 0・新規依存 0・マイグレ消費 0 も実測どおりで、`internal/api/tag/scope_test.go` の新設（既存 handler_test がモックで無力であることを見抜いた）も良い判断である。

しかし段 2 の中核に**配線の欠落**がある。`D-405` 案 B の SQL とコメントは正しく書かれているのに、**`internal/api/combo` から `userID` が 1 度も渡されていない**。実行時は常に `UserID = 0` になり、combo_tags の置換が「削除 0 行 → 既存ペアを再 INSERT」になって主キーに衝突する。**タグが 1 つでも付いたコンボを編集画面から保存すると 500 になる。** これはパスワードも複数利用者も無関係に、いまの全利用者へ効く。テストがサービス層で `UserID: 1` を明示的に足して通してあるため、`go test` も E2E も緑のまま素通りしている。

もう 1 件、`security.passwordEnabled` を true にする経路がフロントに存在しない。パスワードを決めても入場ゲートは効かず、確認ダイアログは「開くときにパスワードの入力が必要です」と**事実に反する説明**を出す。§1.3 の 1・5・6 が UI から到達できない。

そのほか、開発者が名指しで否定した旧文言（「ポート {{port}}」「外部に公開されていないことをご確認ください」）が i18n に**参照ゼロのまま残置**されている。優先度較正の指示どおり「高」に置いた。

---

## 設計準拠性レビュー結果

### チェックリスト §1 最重要ゲート

| # | 観点 | 判定 | 根拠 |
|---|------|------|------|
| 1-1 | 画面が `GET /api/auth/status` の `passwordRequired`（実効値）を見ている | **◎** | `web/src/features/auth/AuthGate.tsx:63`。`useAuthStatus.ts` のみを参照し、`useConfig` は import すらしていない |
| 1-2 | `GET /api/config` の生値を出し分けに使っていない／テストで固定 | **◎** | `web/src/features/auth/AuthGate.test.tsx:16,46-51,77-84`。`useConfig` を「生値 true」で常時モックし、割れた状態で実効値に従うことを固定。**罠として残す設計が正しい** |
| 1-3 | 破壊確認 A が赤くなった | **○** | 報告 §3 の主張は妥当。実際に `AuthGate` を `useConfig` 参照へ替えれば 77 行目のテストは必ず落ちる（`data.security.passwordEnabled === true && !authenticated` になるため） |
| 1-4 | `password_enabled = false` で挙動が変わらない | **×（重大 H-1・M-2）** | **コンボ編集の保存が 500 になる**（H-1）。無効・1 人でも同じ。あわせて起動時のブロッキング往復が 1 → 3 に増えた（M-2） |
| 1-5 | 利用者 1 人ならユーザー選択が出ない | **◎** | `CurrentUserProvider.tsx:68-72,93`。E2E `m22-02-...spec.ts` の「対照: 利用者が 1 人なら選択画面は出ない」で固定 |
| 1-6 | 既存 E2E が無効のまま非回帰 | **△** | 128 passed は事実だが、**既存 E2E にタグ書き込みの経路が無い**ため H-1 を素通りしている。「非回帰の網」として機能していない |
| 1-7 | `userID` が 3 経路（タグ／プリセット／取込ヘルパー）へ届く | **○（配線）／△（固定）** | コードは 3 経路とも配線済（`tag/handler.go` 5 か所・`preset/handler.go` 3 か所・`comboio/handler.go` 2 か所）。ただし**契約テストがあるのは tag だけ**（M-1） |
| 1-8 | 破壊確認 B が赤くなった | **△** | 赤くなったのは `internal/api/tag/scope_test.go` の 3 件のみ。§5.1-11 が要求する 3 経路のうち preset / comboio は赤くならない（M-1） |
| 1-9 | 赤にならなかった項目の「何が代わりに守っていたか」 | **×** | 報告 §3 は「特定する必要のある項目は生じなかった」とするが、上記のとおり 3 経路のうち 2 経路は赤くなっていない。**チェックリスト §9-4 に該当** |
| 1-10 | 他人のプリセットが編集できないことが利用者に伝わる | **◎（挙動）／△（i18n）** | `PresetListTable.tsx:150-172`。印＋理由＋ボタン非表示で「無反応にしない」を満たす。ただし文言が日本語ベタ書き（H-5） |

### チェックリスト §2 方式の遵守

| 観点 | 判定 | 備考 |
|------|------|------|
| ユーザー選択とパスワードが別画面 | **◎** | `LoginScreen` / `UserSelectScreen` が独立。選択でパスワードを求めていない |
| フロントが Cookie を触っていない | **◎** | `document.cookie` は `web/src` に 0 件。`http-interceptor.ts` はヘッダのみ操作 |
| ブラウザストレージへ認証状態・利用者を保存していない | **◎** | `check-browser-storage-keys.sh` 実行 → 違反なし（台帳 9 / 実装 8 / 新規 0）。案 (α) の帰結として正しい |
| 初回設定は現在のパスワード不要／変更では要求 | **◎** | `PasswordSetForm.tsx:34`（`currentPassword: ""`）／`PasswordChangeForm.tsx:38-42` |
| 変更後にログインへ戻る導線 | **◎** | `PasswordChangeForm.tsx:47-61`。案内 →「ログイン画面へ」で `AUTH_STATUS_KEY` を invalidate。黙って 401 にしていない |
| 401 を捕まえる場所が 1 か所 | **◎** | `web/src/lib/http-interceptor.ts:116`。`fetchJSON` へ一本化されていない実情（独自 `request`・素の `fetch` 併存）を実測したうえで `window.fetch` を選んだ判断は妥当 |
| ログイン経路自身の 401 を巻き込まない | **◎** | 同 `AUTH_PREFIX` 除外。E2E「パスワードを間違えても入力欄が消えず、そばに理由が出る」で固定 |

### チェックリスト §3 実装の中身

| 観点 | 判定 | 備考 |
|------|------|------|
| 生の応答本文が出ない | **◎** | 保護中は `AuthGate` が App を描かない。E2E で `/unauthorized/` が出ないことを固定 |
| セッション切れの文言 | **◎** | `auth.login.expired*`。時間切れを書いていない（`D-395` 準拠） |
| 設定欄が表示既定・ログインがマスク既定 | **◎** | `PasswordSetForm.tsx:27`（`masked=false`）／`LoginScreen.tsx:30`（`masked=true`）。確認入力なし |
| 「忘れたとき」の案内 | **◎** | `PasswordForgotHelp.tsx`。`config.toml` のどの行をどう直すかを明示。**アプリからの復旧経路は作っていない**（§9-9 非該当） |
| `LanModeConfirmDialog` にパスワード状態を配線 | **○（配線）／×（意味）** | `passwordSet` prop は入った。ただし `passwordSet` は「保護が効いている」ことを意味しない（H-2）。**表示が事実に反する** |
| 未設定でも続行できる（必須化しない） | **◎** | `LanModeConfirmDialog.tsx:83-89` の「決めずに ON にする」。§9-10 非該当 |
| `internal/service/preset/` の所有者チェックに触れていない | **◎** | 本番コード diff 0（テスト 3 行のみ） |
| サービス層・リポジトリ層の受け口を変えていない | **△（コンボのみ変更・妥当）** | 報告 §18-D のとおり、§4.5-2 の射程はタグ・プリセットに限られる。コンボの受け口追加は案 B の必須要件であり、**違反として扱わない** |
| 更新しても入り直しにならない | **◎** | E2E「通ったあと画面を更新しても入り直しにならない」。§9-20 非該当 |
| 済んだ画面へ戻さない | **◎** | URL を持たない条件表示。E2E 2 本で固定 |
| 履歴の扱いが Plan Mode で提示され判断を経ている | **◎** | 報告 §1-11 / §13 |
| 選ばれていないときの既定 | **◎** | 報告 §4。`users.id` の最小値へ倒す判断は「いままでどおり」を保つうえで妥当。`middleware/user.go:32-34` の「解決に失敗しても止めない」も理由が明示されている |
| `user/` 3 レイヤが埋まっている・`doc.go` を実体へ是正 | **◎** | api / service / repository とも実装。`doc.go` 3 本を書き換え済み |
| マイグレーションを消費していない | **◎** | `migrations/` diff 0。既定タグ生成を Go 側（`model.DefaultMyComboStatusTags` ＋ `usersvc.Create` の同一トランザクション）に寄せた設計は妥当 |

### チェックリスト §4 文言

| 観点 | 判定 | 備考 |
|------|------|------|
| 「平文」「ポート」「ポートフォワーディング」を説明なしに使わない | **×（H-4）** | **新規文言では守られている**が、旧文言 `settings.network.enableConfirmBody`（「ポート {{port}}」「外部(インターネット)に公開されていないことを念のためご確認ください」）が ja/en 両方に**参照ゼロで残置**されている |
| 「ルーター」の言い換え | **◎** | `externalNote`「Wi-Fi の機械（ルーター）」 |
| 状態を先に書く | **◎** | `auth.setPassword.shownNote` を注意書きより前に配置 |
| 「心当たりがなければ〜」 | **◎** | `externalNote` 末尾 |
| 「安全です」と書いていない | **◎** | 全数確認。該当なし |
| モバイル通信での確認を案内していない | **◎** | 「外出先のスマートフォンなど、別の回線からは開けません」は説明であり手順ではない。`D-396 (6)` 準拠 |
| 案から変えた箇所の新旧 | **◎** | 報告 §6.1 に 3 件。とくに §3.8 の絶対パス省略は**理由が正しい**（未認証画面では `GET /api/config` を読めない） |
| ja/en parity | **○（機械）／×（実効・H-5）** | `locales.test.ts` は緑。ただし `user.otherOwner.*` を追加しながら画面は日本語ベタ書きで、**en 利用者には日本語が出る** |

### チェックリスト §5 テストの妥当性

| 観点 | 判定 | 備考 |
|------|------|------|
| §5.1 の項目が揃っている | **△** | 段 1 側は揃っている。段 2 側は §5.1-11 が 3 経路のうち 1 経路しか固定していない（M-1）。**コンボのタグ書き込みは HTTP 層でまったく固定されていない**（H-1） |
| E2E の A / B / C | **◎** | 3 群とも存在 |
| サーバの共有状態を書き換えていない | **◎** | コンテキスト単位の `page.route`。`config.toml` を触っていない |
| モックの照合パターンが対象以外に当たらない | **◎** | `/^https?:\/\/[^/]+\/api\//` でオリジン直下に固定。`**/api/**` を避けた理由もコメントに残っている |
| 対照実験 | **◎** | 「遮断しなければ 200」「保護を再現するとログイン画面が出る」「1 人なら出ない」の 3 本 |
| 段 1 完了時点でも回した | **◎** | 報告 §17 |
| テスト結果がコマンド出力で書かれている | **◎** | スイート名・件数を転記（`E-125` 準拠） |
| 着手前の `make e2e` の状態を確認 | **◎** | 報告 §1-9（`pnpm install` 後 114 passed のベースライン取得） |

### チェックリスト §6 コード品質・規約

| 観点 | 判定 | 備考 |
|------|------|------|
| JSON タグ camelCase | **◎** | `internal/api/user/dto.go`（`mainCharacterId`）。DTO 型も camelCase |
| エラー wrap ／ サービス層の `ctx` | **◎** | `usersvc` は全メソッドが `ctx` 第一引数。`fmt.Errorf(...: %w)` を使用 |
| 公開 API の godoc | **◎** | 新設パッケージ 3 本とも付与 |
| `any` 不使用・関数コンポーネント | **◎** | `src/features/auth` `src/features/user` `src/lib/http-interceptor.ts` に `any` 0 件 |
| `console.log` / `fmt.Println` | **◎** | 0 件 |
| test-id の命名 | **◎** | `auth-*` / `user-select-*` / `settings-user-*` / `preset-other-owner-*`。ケバブケース規約に沿う |
| `gofmt` / `go vet` | **◎** | いずれもクリーン |
| `check-enum-sync.sh` | **◎** | ベースラインどおり（増加なし） |

### チェックリスト §7 既存挙動の温存

| 対象 | 実測 |
|------|------|
| `internal/api/auth/` `internal/service/auth/` `internal/api/middleware/auth.go` | **diff 0**（実測） |
| `internal/service/notation/` | **diff 0** |
| `internal/service/preset/` | 本番 0。テスト 1 ファイル 3 行のみ |
| `web/src/features/physical-input/` `gamepad/` `keyboard/` | **diff 0** |
| `migrations/` `character_data/` `docs/design/` | **diff 0** |
| `go.mod` `go.sum` `package.json` `pnpm-lock.yaml` | **diff 0** |
| `users.password_hash` | 使用も削除もなし（`repository/user/repository.go:108` に「書かない」旨のコメントあり） |

**⇒ §7 はすべて OK。報告の実測値は正しい。**

### チェックリスト §8 ドキュメント

| 観点 | 判定 | 備考 |
|------|------|------|
| §7.5 の項目 | **○** | 13 項目に対応する節がある |
| 履歴操作の実測 | **◎** | 報告 §13 |
| 実査結果・`user_id` の分布 | **◎** | 報告 §1 / §2。**「presets はすべて `user_id IS NULL`（組み込み）であり、指示書 §4.5-3 の前提は実測では成り立たない」という訂正は価値が高い**。測定環境の限界も明記されており `research-db-dependent-items-m22` を閉じる根拠として妥当 |
| as-built との差の全数 | **◎** | 報告 §10 に 8 件 |
| 手動確認の手順と結果 | **×（H-3）** | 手順が実行不能（下記） |
| 否定形確認 | **◎** | 走査コマンド・陽性対照 2 本・`LC_ALL=C.UTF-8`・適用済みマイグレの明記まで揃っている。**陽性対照に `git show HEAD~4` を使ったのは良い** |
| 並列相手との突合 | **◎** | 報告 §11。「居なかった」を明記し、`M22-06` への申し送りも書いている |
| 「■ 併せて更新が要るもの」 | **◎** | 報告 §12 |
| `progress-log.md` への追記 | **◎** | `check-progress-log-index.sh` 違反なし |

---

## 設計準拠性以外の指摘事項

- **未使用 i18n キー 13 件**（本サブが触った名前空間のみ）: `auth.forgot.title` / `auth.forgot.close` / `auth.setPassword.empty` / `auth.changePassword.title` / `user.add.title` / `user.add.empty` / `user.add.duplicate` / `user.otherOwner.preset` / `user.otherOwner.presetShort` / `settings.user.editUser` / `settings.user.notImplemented` / `settings.network.enableConfirmBody` / `wizard.stepPassword.title`。うち 3 件は下記「高」に相当する（H-4 / H-5）。
- `model.DefaultMyComboStatusTag.Status` フィールドは定義されているが `usersvc.Create` は `Name` / `Color` しか読まない。未使用。
- `Step07Complete` が step 8 を担当している（`WizardPage.tsx:116-118`）。命名が段番号とずれた。
- `middleware.UserContext` は `X-User-Id` を検証せずそのまま採用する。設計上「認証ではない・詐称は防がない」（`user.go:12-14` に明記）ので方針としては正しいが、**`users` に存在しない id を送ると下流の FK 制約で 500 になる**。値域の扱いを完了報告に残しておくとよい。
- `resolveUserID` はヘッダが壊れているとき「既定へ倒す」。壊れた値を黙って別人として扱う形なので、ログを 1 行出す余地はある（既定は無効側で害は小さいため低）。

---

## 推奨修正（優先度別）

### 高（M22 完了前に修正必須）

**H-1. コンボ書き込み経路へ `userID` を配線する。案 B の片翼が未接続で、既存機能が 500 になる。**

- 事実:
  - `internal/api/combo/dto.go:309` `toServiceCreateInput` と `:377` `toServiceUpdateMetadataInput`、`internal/api/combo/materialize_handler.go:31` の 3 か所とも `UserID` を設定していない。`internal/api/combo/handler.go` で `mw.UserIDFrom(c)` を使っているのは `Get`×3（:112,:439,:471）と `List`（:259）**だけ**である。⇒ 実行時は常に `CreateInput.UserID = UpdateMetadataInput.UserID = MaterializeInput.UserID = 0`。
  - `internal/repository/combo/repository.go:1444` の DELETE は `tag_id IN (SELECT id FROM tags WHERE user_id = 0)` となり **0 行**。続く `INSERT INTO combo_tags`（`:1465`、`OR IGNORE` なし）が `PRIMARY KEY (combo_id, tag_id)`（`migrations/000001_init_schema.up.sql:123`）に衝突する。
  - `isInvalidTagIDErr`（`service.go:1183`）は `"FOREIGN KEY constraint failed"` しか見ないため、UNIQUE 違反は `internal_error` へ落ちる。
- 再現（既定構成・パスワード無効・利用者 1 人で起きる）:
  1. タグを 1 つ付けたコンボを開く → 編集画面 → メモだけ変えて保存。
  2. `ComboEditor.buildPatchPayload`（`web/src/features/combo/components/ComboEditor.tsx:256`）は常に `tagIds: basic.tagIds` を送る。初期値は `initial.tags.map(t => t.id)`（同 `:752`）。
  3. `PATCH /api/combos/:id` → 500「サーバーエラーが発生しました」。
- 併発する 2 件:
  - マイコンボのステータス変更（`web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts:20-24`）で**旧ステータスタグが消えず二重に付く**。元の値へ戻すと 500。
  - `filterTagsByUser(saved, 0)` により Create / PATCH / PUT の応答 `tags` が**常に空**。`useUpdateComboWithKeyChange` はその応答を `qc.setQueryData(["combo", data.id], data)` でキャッシュへ入れる（`web/src/features/combo/api.ts:207`）。
- なぜ緑のままだったか（**ここが本件の本質**）:
  - サービス層テストは `validRyuInput` に `UserID: 1` を足し（`service_test.go` の diff）、`TestService_UpdateMetadata_TagIDs_Empty_RemovesAll` にも `UserID: 1` を**個別に追記**して通している。⇒ **コンパイル／テストの赤を、本番の配線ではなくテスト側の値で消している**。
  - API 層テスト（`internal/api/combo/handler_test.go`）はサービスをモックし、`capturedInput.UserID` を一切検証していない（`TestHandler_Create_WithTagIDs_OK` / `TestHandler_UpdateMetadata_WithTagIDs_OK`）。
  - E2E にコンボのタグ書き込み経路が無い（`m15-02-info-mark.spec.ts` はマイコンボ画面への遷移確認のみ）。
  - ⇒ **破壊確認 C はサービス層／リポジトリ層でしか行われておらず、HTTP の配線を見ていない。** 完了報告 §16 の「(1) と (3) を同じ手番で入れた」は受け口の話であり、供給元は入っていない。
- 修正: 4 経路（`Create` / `UpdateMetadata` / `UpdateWithKeyChange` / `Materialize`）で `mw.UserIDFrom(c)` を入力へ載せる。**あわせて、`internal/api/combo` に実 DB を通す契約テスト**（`internal/api/tag/scope_test.go` と同じ形）を置き、「PATCH で `X-User-Id` を変えると自分の紐づけだけが入れ替わる」「同じ tagIds を送り直しても 200」を固定すること。テスト側の `UserID: 1` で赤を消す形へ戻さないこと。

**H-2. `security.passwordEnabled` を true にする経路がフロントに無い。§1.3 の 1・5・6 が UI から到達できない。**

- 事実:
  - `POST /api/auth/password` はハッシュのみ保存（`internal/service/auth/service.go:143` `SetPassword`）。`Enabled()` は `PasswordEnabled && PasswordHash != ""`（同 `:74`）。
  - `M22-01` は「ハッシュを入れてから ON にする」二段構えを前提に、`PATCH /api/config` へ検証を置いている（`internal/service/config/service.go:238-244`「password is not set; set a password before enabling」）。
  - しかし `web/src` のどこも `security.passwordEnabled` を送らない（`grep -rn "passwordEnabled" web/src` の非テストヒットは `SettingsSectionUser.tsx` の**ラベル文言**と `AuthGate.test.tsx` のモックだけ）。
- 帰結:
  - ウィザード Step 7・設定画面・LAN 確認ダイアログの「パスワードを決める（おすすめ）」でパスワードを決めても、**入場ゲートは効かない**。§1.3-1「`password_enabled = true` のときログイン画面が出て通ると使える」を UI から到達できず、`config.toml` の手編集が要る。
  - **事実に反する説明が出る**（契約 F-3 ／ §4.6-4 に抵触）:
    - `LanModeConfirmDialog.tsx:67-69` は `passwordSet` だけで `enableConfirmBodyWithPassword`「開くときに、決めておいたパスワードの入力が必要です」を出す。実際は要求されない。
    - `SettingsSectionUser.tsx:36-39` は「パスワード保護: はい」と表示する（値は `passwordSet`）。保護されていない。
  - `SettingsSectionUser.tsx:58-59` のコメント「★設定した瞬間にゲートが効き始める。認証状態を引き直すと AuthGate がログイン画面へ切り替わる（正しい振る舞いである）」は、既定（`password_enabled = false`）では**偽**である。
- 修正案（いずれも本サブの範囲内。`internal/api/auth/` は触らない）:
  - パスワード設定成功後に `PATCH /api/config` で `security.passwordEnabled: true` を送る（`M22-01` の検証はハッシュ設定後なら通る）。または
  - 設定画面のネットワーク／ユーザー欄に「パスワードでの保護を有効にする」トグルを置く。
  - どちらを採るにせよ、**「決めた＝効いている」と読める文言を、実効値（`passwordRequired`）で出し分ける**こと。`passwordSet` と `passwordRequired` は割れる——それがこのサブの最重要ゲート 1 そのものである。

**H-3. 開発者の手動確認の手順（§7.1・DoD）が実行不能。**

- 完了報告 §7 (1) は「`config.toml` の `[security]` が既定（`password_enabled = false`）であることを確認し」と書き、(2) は「設定画面 →「パスワードを決める」でパスワードを設定する。**設定した瞬間にログイン画面へ切り替わる**」と書いている。H-2 のとおり切り替わらない。
- `config.toml` を書き換える手順が本文に無いのに、「後始末」だけ `git checkout -- config.toml` を指示している。⇒ 手順が内部で矛盾している。
- 5 項目のうち (2)(3)(4) が回せない。**チェックリスト §9-19（手動確認の欠け）に該当しうる状態**である。H-2 を直したうえで手順を書き直すこと。

**H-4. 撤回済みの文言が i18n に残置されている（ja / en 両方・参照ゼロ）。**

- `web/src/locales/ja.json` / `en.json` の `settings.network.enableConfirmBody`:
  - 旧: 「ポート {{port}} で、同じネットワーク上の他のデバイス(スマートフォン等)からアクセスできるようになります。**このポートが外部(インターネット)に公開されていないことを念のためご確認ください。**…」
  - これは開発者が 2026-08-15 に名指しで否定した表現そのものである（指示書 §4.6-5 ／ `CHANGE-113` §3 方針 5）。`enableConfirmTitle` は新文言へ差し替えられたのに、**本文だけ旧のまま隣に残った**。
  - 参照は 0 件（`LanModeConfirmDialog` は `enableConfirmBodyNoPassword` / `WithPassword` を使う）。⇒ 動作は正しく、型検査も lint もテストも緑。**人が読む以外に見つける経路が無い。**
- 同じ理由で `settings.user.notImplemented`（「今後実装予定」＝本サブで実装済み）と `settings.user.editUser`（改名 UI 未実装）も失効している。
- 修正: `enableConfirmBody` を削除する。`notImplemented` / `editUser` は、削除するか「未実装である」旨を報告 §12 の followup 候補へ明記する。

**H-5. `user.otherOwner.*` を i18n へ追加しながら画面で使わず、`FR013` の説明文を日本語ベタ書きにした。**

- `web/src/features/preset/components/PresetListTable.tsx:150`（「ほかの人が作ったプリセット」）と `:163-168`（「これは○○さんが作ったプリセットです。…」）が生文字列。
- ja/en へ追加した `user.otherOwner.presetShort` / `user.otherOwner.preset` は**参照 0 件**。⇒ en ロケールの利用者には日本語が出る。
- 完了報告 §6 は「`CHANGE-113` §3 の案を i18n キーへ写した」「parity は緑（全 450 キー）」と書いているが、**この 2 件は画面へ届いていない**。機械 parity（キーの有無）は緑でも、実効 parity は破れている。
- 同ファイルには本サブ以前からの日本語ベタ書き（「編集」「削除」「ベース:」）があるため慣行としては整合するが、**キーを作ったうえで使わなかった**点が問題である。使うか、キーを消して報告の文言全数から外すかを選ぶこと。

### 中（M23 着手と並行可）

**M-1. `userID` の 3 経路のうち契約テストがあるのは tag だけ。破壊確認 B の網が 1/3 しかない。**

- `internal/api/preset/write_handler_test.go` は `stubUserResolver{id: 1}` 固定で、**別の `X-User-Id` を送ると `presets.user_id` が変わる**ことを見ていない。
- `internal/api/comboio/handler_test.go:36` のモックは `Commit(..., userID int64)` を受け取りながら `m.commitFn(ctx, comboCSV, setupCSV, selected, action)` と**捨てている**。⇒ ハンドラが `mw.UserIDFrom(c)` を渡しているかを検証していない。
- `internal/service/comboio/multiuser_test.go` は `svc.Commit(ctx, ..., 1)` / `(..., userB)` とサービス層で直に渡しており、HTTP の配線は範囲外。
- ⇒ 報告 §3 の「3 つの破壊確認はいずれも狙った項目が赤くなったため、『何が代わりに守っていたか』を特定する必要のある項目は生じなかった」は、§5.1-11 が要求する 3 経路のうち 2 経路について成立しない。**同じ層（HTTP）に契約テストを置き直すこと**（`SUPP-001` §5.5 (10′)）。

**M-2. 起動時のブロッキング往復が 1 → 3 に増えた（既定構成でも通る）。**

- `main.tsx:40-44` の入れ子により、`AuthGate`（`GET /api/auth/status`）→ `CurrentUserProvider`（`GET /api/users`）→ `App`（`GET /api/config`）が**直列**になる。各段が全画面ローディングを出す（`AuthGate.tsx:53`・`CurrentUserProvider.tsx:83`・`App.tsx:16`）。
- `GET /api/users` は `FR502`（1 人なら出さない）の判断に要るため必要だが、**直列にする必然性は無い**（`/api/auth/status` と並行に投げられる）。
- §4.2-2 は「余計な問い合わせを増やさない／起動が遅くならない」を求めている。ローカル前提なので実害は小さいが、**完了報告に評価が無い**。実測（初回描画までの往復数と時間）を記録するか、`useUsers` を `AuthGate` と同じ層で先行させること。

**M-3. `Materialize` が絞っていない `base.Tags` を複製する。**

- `internal/service/combo/service.go:891` の `base` は `repo.FindByID`（無絞り）。`:1018-1023` で `base.Tags` 全件の id を新コンボへ紐づける。⇒ **他人のタグ紐づけが生成コンボへ伝播する**。
- `D-405` 案 B の「読みは自分のものへ絞る／置換は自分の分だけ」という対称性と食い違う。読み出し側で隠れるため画面には出ないが、`combo_tags` には他人名義の行が増える。
- 修正: `Materialize` でも `filterTagsByUser` 相当を通してから id を集めること（H-1 の配線と同じ手番で入れられる）。

**M-4. `PasswordChangeForm.tsx:69-71` のコメントが実装と矛盾している。**

- コメント: 「★現在のパスワードはマスク既定にしない理由が無いが、変更操作は自宅で自分が打つ場面であり、**新パスワード欄と挙動を揃える方が分かりやすい**。新パスワード側は D-396 により表示既定である。」
- 実装: 現在のパスワードは `type="password"` 固定・切替なし（`:74-81`）、新パスワードは `masked=false` 既定・切替あり（`:31,84-92`）。**揃っていない。**
- 挙動自体は `CHANGE-113` §3.7 の案どおりで正しい。**コメントだけが誤っている**ため、読んだ後任が「揃っているはず」と誤解する。書き直すこと。

**M-5. 利用者名の重複（409）が一般文言に潰れている。**

- `internal/api/user/handler.go:80-82` は `user_name_duplicate` を 409 で返すが、`UserManagement.tsx:92` は常に `user.add.failed`（「追加できませんでした。」）を出す。`user.add.duplicate`（「同じ名前の人がすでにいます。」）は未使用。
- 「なぜできないか」が分からない形であり、`CHANGE-113` §3.10 と同じ考え方に反する。

**M-6. 指示書・チェックリストの版が repo に無く、完了報告の根拠が追えない。**（設計卓側の課題として申し送り）

- 完了報告は対象指示書を **v1.5.0** とし、§4.5-6〜§4.5-17 / §5.1-17〜§5.1-23 / §3.3 の 13 項目 / §9.3-9 / `D-402` `D-404` `D-405` を引いている。
- しかし HEAD の `docs/instructions/M22-02-login-ui-and-user-select.md` は **v1.1.0**（`git log` の最終更新は `e8203ee`）、チェックリストも **v1.1.0**、`docs/process/parallel-board.md` の裁定は **D-401 が最新**で D-402 以降が存在しない。
- ⇒ 本レビューは v1.1.0 ＋ レビュー依頼で指示された観点（案 B・`D-405`・破壊確認 C）で判定した。**設計卓が指示書 v1.2.0〜v1.5.0 とボードの D-402〜D-405 をコミットしていない**（`E-114` の同型＝同じ手番で直す先が複数あり、1 か所が落ちても他が緑に見える）。次サブの前に同期すること。
- なお完了報告 §18 が指示書・チェックリストの不整合 6 件（A〜F）を実装前に報告している点は正しい振る舞いである。

### 低（将来対応）

- 未使用 i18n キーの掃除: `auth.forgot.title` / `auth.forgot.close` / `auth.setPassword.empty` / `auth.changePassword.title` / `user.add.title` / `user.add.empty` / `wizard.stepPassword.title`。
- `model.DefaultMyComboStatusTag.Status` の未使用フィールド。使う予定が無ければ落とす。
- `Step07Complete` が step 8 を担当している命名ドリフト（`WizardPage.tsx`）。
- `UserSelectScreen.tsx:15-16` の「`DES-005` §5.3 の現行記述は as-built と食い違っており、`CHANGE-113` で改訂される」は、`CHANGE-113` 反映後に失効する。反映時に落とす前提を報告 §12 へ足しておくとよい。
- `middleware.UserContext` が壊れた `X-User-Id` を黙って既定へ倒す点（ログ 1 行の余地）。

---

## 良かった点

- **最重要ゲート 1 の固定の仕方が優れている。** `AuthGate.test.tsx` で `useConfig` を「生値 true」で常時モックし、罠として残した。実装が生値を見に行った瞬間に必ず赤くなる。「テストでしか固定できない」という指示書の要求へ、正面から答えた形である。
- **E2E の対照実験 3 本。** 「遮断しなければ 200」「保護を再現するとログイン画面が出る」「1 人なら出ない」。`M22-01` で踏んだ `**/api/**` の取り違えを踏まえ、照合パターンをオリジン直下へ固定し、その理由をコメントに残している。
- **`internal/api/tag/scope_test.go` の新設判断。** 既存 `handler_test.go` がサービスをモックしていて `userID` が SQL へ届くかを見ていない、という診断が正確で、実 DB を通す層を正しく選んでいる。**この診断を `internal/api/combo` にも適用していれば H-1 は出なかった**——同じ方法論が 1 つのパッケージにだけ適用された形である。
- **401 を捕まえる場所の選定。** `fetchJSON` へ一本化されていない実情（独自 `request`・素の `fetch` 8 か所）を実測したうえで `window.fetch` を選び、`/api/auth/*` を除外し、応答を改変せず新規リクエストも発行しない設計にした。理由が `http-interceptor.ts` 冒頭に残っている。
- **完了報告 §2 の実測訂正。** 「`presets` は 3 行すべて `user_id IS NULL`（組み込み）であり、『既存のプリセットはすべて `user_id = 1` に紐づいている』という指示書 §4.5-3 の前提は実測では成り立たない」。`VAL-P01` と `VAL-P07` の別まで分けて書いており、測定環境の限界（クラウド実行に長期運用 DB が無い）も明記されている。**指示書の前提を実測で否定して報告する**のは、最も価値の高い報告の形である。
- **否定形確認の作法。** 陽性対照に `git show HEAD~4:internal/api/tag/handler.go` を使い、「撤去したから 0 件」と「走査が壊れて 0 件」を弁別している（`E-84`）。適用済みマイグレのヘッダに当たったことも指示どおり明記。
- **`ReplaceTagAssociations` の SQL とコメント。** 「消えても双方の画面に何も出ない。1 人目のマイコンボから項目が静かに落ちるだけで、テストが無ければ永久に気づかれない」——危険の性質を正確に言語化している。**内容は正しく、欠けているのは配線だけである**（H-1）。
- 凍結領域の diff 0・新規依存 0・マイグレ消費 0・ブラウザストレージ新規キー 0 が、いずれも実測どおり。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- H-1 の 500 は静的解析（`toServiceUpdateMetadataInput` に `UserID` の代入が無い ／ `combo_tags` の主キーが `(combo_id, tag_id)` ／ `ComboEditor.buildPatchPayload` が常に `tagIds` を送る ／ `isInvalidTagIDErr` が FK のみを見る）から導いた。**サーバを起動しての再現は行っていない**（本レビューは read-only のため）。取り込み時に実機で 1 度確認すること。
- **不明: 指示書 v1.2.0〜v1.5.0 と裁定 `D-402` / `D-404` / `D-405` の本文が repo に無いため、それらが課した個別要件（§4.5-6〜17・§5.1-17〜23・§9.3-9 等）への適合は、レビュー依頼で明示された観点（案 B の対・タグの読みの絞り込み維持・破壊確認 A/B/C）以外は判断できない。**
- 本レビューはコードを一切変更していない。作成したファイルは本報告書のみ。
