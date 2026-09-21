# M22-08 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象作業 | M22-08（入場まわりの仕上げ — パスワードの検証・ログアウトの導線・利用者の改名） |
| 対象指示書 | `M22-08-auth-finishing.md` **v1.3.0**（★開発者から直接受領。ディスク上は v1.2.0） |
| チェックリスト | `docs/instructions/reviews/M22-08-review-checklist.md` v1.1.0 |
| 対象コミット | `3494660..HEAD`（`a3bab04` 実装 ／ `b160d6c` 報告） |
| 完了報告 | `docs/progress/m22-08-completion-report.md` |
| レビュー実施日 | 2026-08-16 |
| 判定 | **重大 1 件あり（§9 相当）。修正後に完了承認可** |

---

## 総評

**★最重要ゲート 2 つは、いずれも守られている。** 検査は `Service.SetPassword` の `next` 引数だけに掛かり、`Login` の照合にも `current` にも掛かっていない。破壊確認 A も実施され、赤くなった 4 本のうち 2 本が「fixture がたまたま 3 文字だっただけ」であることまで自力で見抜いている——**「破壊確認で N 本赤くなった」を網の厚みと読み違えなかった点は、本サブで最も評価できる**。本文サイズの上限も `/api/auth/*` の 4 経路へ経路単位で掛かり、実物の取り込みハンドラを通した対照実験付きで固定されている。

**★一方で、i18n キーを 1 つ「消したまま参照が残る」形の回帰が入っている。** `auth.setPassword.hintLater` が ja/en 双方から消えたのに `PasswordSetForm.tsx:96` が呼び続けており、初回設定画面にキー文字列がそのまま表示される。**しかもこの記述は `DES-005` §5.1 Step 7 の要件 4（あとから設定画面で変更できる）＝`CHANGE-113` で確定した設計事項の実体である。** 型検査・ja/en parity 検査・全テストのいずれも緑のまま通るため、人が読む以外に見つける経路が無い。

そのほかは軽微〜中程度で、いずれも設計判断の是非ではなく「as-built の記述と実挙動のわずかなずれ」「網の 1 本欠け」に収まる。凍結領域の diff は全項目 0 を実測で確認した。

---

## 設計準拠性レビュー結果

### 1. 最重要ゲート（チェックリスト §1）

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 1-1 | **検査が「決めるとき」だけに掛かっている**（指示書 §4.1-2） | **◎** | `internal/service/auth/service.go:169` が `validateNewPassword(next)` を **`next` にだけ**適用。`current` は `NormalizePassword` のみ（同 :160）。`Login`（同 :115）も `NormalizePassword` のみで検査を通さない。画面側も `PasswordChangeForm.tsx:43` が `validateNewPassword(next)` だけを見ており、`LoginScreen.tsx:40` は `normalizePassword(...) === ""` の空判定のみ |
| 1-2 | **既存の非 ASCII / 短い検証子で入れる** | **◎** | `TestLogin_ExistingNonASCIIVerifierStillWorks` ／ `TestLogin_ExistingShortVerifierStillWorks` ／ `TestSetPassword_ExistingNonASCIICurrentIsAccepted` の 3 本。画面側も `PasswordForms.test.tsx` の「『いまのパスワード』が日本語でも止めない」「同・下限より短くても止めない」で対 |
| 1-3 | **破壊確認 A が赤くなった** | **◎** | 完了報告 §4 に手順（`Login` へ検査を一時的に足すパッチ）と FAIL 出力を転記。**★赤くなった 4 本のうち 2 本が偶然（fixture `"pw"` が 3 文字）であることを特定し、「網として当てにできない」と明記している**。`SUPP-001` §5.5 (10′) の運用として正しく、かつ求められている以上のことをしている |
| 1-4 | **赤にならなかった項目の扱い** | **◎** | `TestSetPassword_ExistingNonASCIICurrentIsAccepted` が赤くならなかった理由を「破壊の対象が違う（`Login` に足したため `current` の経路は動かない）」と特定し、同じ層に契約テストとして置いてあることを示している |
| 1-5 | **本文サイズの上限を掛けた範囲が Plan Mode を経ている** | **◎** | 既定どおり `/api/auth/*` の 4 経路のみ（`routes.go:35-38`）。**実測せずに全経路へ掛けていない**。取り込みの実サイズ（`combo_file` 10MiB ＋ `setup_file` 10MiB ＋ multipart 境界 ⇒ 20MiB 超）を根拠として完了報告 §1-2 に記載 |
| 1-6 | **上限より大きい CSV の取り込みが通る** | **◎** | `TestImportRoutes_AcceptCSVFarLargerThanAuthBodyLimit`（約 458KiB＝上限の 57 倍の CSV を**実物の取り込みハンドラ**へ通し、受信バイト数の完全一致を確認）＋ **同一 echo の認証経路で同じ本文が 413 になる対照実験**。さらに `TestBodyLimit_DoesNotLeakToSiblingRoutes` が外側から 2MiB で押さえている。**★小さい CSV だけのテストになっていない** |
| 1-7 | **非 ASCII を「決める」と 400** | **◎** | `TestSetPassword_RejectsNonASCII` が日本語・全角英数・全角スペースの **3 通り**を網羅。加えて `validate_test.go` が絵文字・制御文字（U+001F）・DEL（U+007F）・アクセント付きラテンまで押さえている |
| 1-8 | **画面とサーバの両方で検査** | **◎** | `passwordRules.ts`（画面）と `validate.go`（サーバ）の二重実装。`PasswordSetForm.tsx:47-49` に「サーバ側を省いてよいということではない（curl で直接叩ける）」と明記 |

### 2. 方式の遵守（チェックリスト §2）

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 2-1 | 文字種が印字可能 ASCII（`U+0020`〜`U+007E`）・半角スペース含む | **◎** | `validate.go:29-30` の `passwordRuneMin/Max`、`passwordRules.ts:28` の `/^[\x20-\x7E]*$/`。`TestValidateNewPassword_Charset` の許可側に「内側の半角スペース」「境界の下端（U+0020）」「境界の上端（U+007E）」がある |
| 2-2 | NFC 正規化を入れていない・`golang.org/x/text` を足していない | **◎** | `go.mod` / `go.sum` の diff **0**（実測）。`golang.org/x/time` も 0 件 |
| 2-3 | 長さの下限・上限が 4 / 128 | **◎** | `PasswordMinLength = 4` / `PasswordMaxLength = 128`。境界ちょうど・±1 のテストあり |
| 2-4 | 前後の空白の除去が「決めるとき」と「入れるとき」の両方 | **◎** | `SetPassword`（`current` / `next` 両方）と `Login` の両方。`TestPassword_SurroundingWhitespaceIsTrimmed` が双方向で固定 |
| 2-5 | 拒否が 400 で `VAL-N05` / `VAL-N06` を区別できる | **○** | `password_charset_invalid` / `password_length_invalid` に分かれ、`invalid_password`（ログイン失敗）と混ざっていない（`TestLogin_RejectionCodeIsNotSplitByReason` が固定）。**ただし「trim 後に空」だけは `ErrEmptyPassword` → `invalid_request` へ落ちる**（後述・中1） |
| 2-6 | ログイン欄で止めているのは空だけ | **◎** | `LoginScreen.test.tsx` の `it.each` が日本語・全角英数・下限未満・上限超過の 4 通りで「押せて、そのまま送られる」ことを固定。さらに「規則違反の案内をログイン画面に出さない」まで押さえている |
| 2-7 | 標準の仕組みで足りるかが実査され、提示されている（D-410） | **◎** | `strings.IndexFunc` / `utf8.RuneCountInString` / `strings.TrimSpace` / `net/http.MaxBytesReader`。**★判定ロジックの自前実装 0 件**。Echo `middleware.BodyLimit` を採らなかった理由を `go vet` の実出力付きで完了報告 §7-1 に記載 |
| 2-8 | 「標準に在るから」で要件を曲げていない | **◎** | Echo のミドルウェアを `e.Use` / `Group.Use` で掛ければ簡単だが、それでは全経路へ及ぶ ⇒ 経路単位を採り、かつ依存が増える方は捨てている。要件が仕組みに優先している |
| 2-9 | 検証コードを製造が採番していない | **◎** | `VAL-N05`〜`N07` のみ使用。新規採番なし |

### 3. 実装の中身（チェックリスト §3）

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 3-1 | 検証子の形式と導出に diff が無い | **◎** | `internal/service/auth/password.go` の diff **0 ファイル** |
| 3-2 | `Service.Login` の照合そのものに diff が無い | **◎** | `VerifyPassword` 呼び出し・`rand.Text()` のセッション発行は不変。足したのは `NormalizePassword` 1 行（§4.1-5 が明示的に要求したもの） |
| 3-3 | ログアウトの導線が保護有効時だけ出る | **◎** | `SettingsSectionUser.tsx:33` が **`passwordRequired`（実効値）**を見ている。`passwordSet` で出し分けていない ⇒ 「一度掛けて外したあと」に誤って出ない。`SettingsSectionUser.logout.test.tsx` が「検証子は在るがゲートが効いていない」ケースを独立して固定している。**★`DES-002` §8.1 の 17 を正しく踏んでいる** |
| 3-4 | 押すとログイン画面へ戻る | **○** | 配線は正しい（`useLogout` が `AUTH_STATUS_KEY` を invalidate ⇒ `AuthGate` が閉じ直す＝`M22-02` の 401 捕捉と同経路）。**ただし「戻ること」を確かめる自動テストが 1 本も無い**（後述・中2） |
| 3-5 | ログアウトと「利用者の選び直し」を混ぜていない | **◎** | 罫線で仕切った別のまとまり＋見出し＋文言で書き分け。`it("「使う人を選び直す」を兼ねていない")` が固定。完了報告 §1-5 に「`UserManagement` に置かなかった理由」まである |
| 3-6 | 改名でき、409 / 400 が見える。サーバ側の検証を作り直していない | **◎** | `useRenameUser` は `userApi.rename` を呼ぶだけ。`UserManagement.tsx:205-209` が 409 / 400 を文言へ振り分ける。サーバ側 `internal/api/user/` の diff **0** |
| 3-7 | 選択中の利用者を改名するとヘッダが追随する | **◎** | `CurrentUserProvider` が `users.find(...)` で導出しているため、`USERS_KEY` の invalidate で自動追随する。**★「自動でそうなる形だからこそ壊れても気づけない」と認識したうえで、`UserManagement.rename.test.tsx` と E2E C の 2 層で固定**。E2E C には「改名しなければ変わらない」対照まである |
| 3-8 | 利用者の削除を作っていない | **◎** | `it("削除の導線を作っていない")` で `settings-user-delete` の不在と「削除」文字列の不在を固定 |

### 4. 非破壊性（チェックリスト §4）

**◎（全項目 0 を実測で確認）**

| 対象 | 実測 |
|---|---|
| `migrations/` ／ `character_data/` ／ `docs/design/` | 各 **0 ファイル** |
| `internal/api/middleware/` | **0 ファイル**。`routes.go` の経路文字列 4 本も不変（足したのはミドルウェア引数のみ） |
| `combo_tags` の読み書き | **0 行** |
| `internal/service/notation/` ／ `internal/service/preset/` | 各 **0 ファイル** |
| `web/src/features/physical-input/` ／ `gamepad/` ／ `keyboard/` | 各 **0 ファイル** |
| `go.mod` / `go.sum` / `web/package.json` / `web/pnpm-lock.yaml` | 各 **0 ファイル** |
| `web/src/components/ui/` ／ `web/src/lib/api-client.ts` | 各 **0 ファイル** |

**★`cmd/combomgr/main.go` を編集せずに済ませた点は積極評価する。** 指示書 §2.1 は同ファイルを成果物一覧に挙げていたが、経路単位のミドルウェアで足りたため §2.2-3 の凍結対象（`e.Use` のミドルウェア列）に一切触れていない。**しかも `internal/api/middleware/auth.go` の「Echo の `Group.Use` は `/api` と `/api/*` へ `NotFoundHandler` を副作用で登録する」という既存の実測注記を読んだうえでその形を避けており**（`routes.go:28-30` に転記）、過去の知見が実際に効いている。

### 5. テストの妥当性（チェックリスト §5）

**○** — §5.1 の 12 項目のうち **11 項目は網が置かれている**。欠けは 9 の後段（「押すとログイン画面へ戻る」）のみ（中2）。

- E2E の A（既定で非回帰・ログアウトが出ない）・B（日本語を弾く）・C（改名でヘッダが変わる）はいずれも存在。**★A と B と C の各々に「対照」テストが添えてある**（保護を再現すると出る／規則を満たせば押せる／改名しなければ変わらない）点は、`E-84` 系の「0 件だったのはセレクタが違うだけ」を潰す作法として正しい。
- **★サーバの共有状態を書き換えていない**（D-399 (1)）。E2E B は「押さない」ことを明記し、C は `page.route` で `/api/users` をコンテキスト内シミュレートしている。照合パターンも `^https?://[^/]+/api/` に絞り、`**/api/**` の緩い glob を避けている（`M22-01` の実測を引き継いでいる）。
- 完了報告のテスト結果はコマンド自身の出力（スイート名・件数）で転記されている（`E-125` 準拠）。着手前ベースラインとの対比表もある。

### 6. コード品質・規約遵守（チェックリスト §6）

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 6-1 | 定数化・命名一貫 | **◎** | `PasswordMinLength` / `PasswordMaxLength` / `passwordRuneMin` / `passwordRuneMax`（Go）と `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH` / `PRINTABLE_ASCII`（TS）。**両側の doc コメントが相互参照しており、`E-76` のドリフト対策になっている** |
| 6-2 | 数がリテラルで散在していない | **◎** | **★文言側にも数を書かず、i18n 補間 `{{min}}` / `{{max}}` で定数から差し込んでいる**。`CHANGE-119` §3 の案（`4 文字以上で決めてください。`）から意図的に変えており、完了報告 §10-2 に新旧が並べてある |
| 6-3 | JSON タグ camelCase | **◎** | 新規 DTO 無し。既存の `currentPassword` / `newPassword` を踏襲 |
| 6-4 | エラーの wrap ／ `context.Context` | **◎** | `internal/service/auth/` の ctx 非採用は `M22-01` の as-built で例外扱い（D-399 (2) / D-401）。`service.go:35-42` に理由が残っている |
| 6-5 | 公開 API に godoc | **◎** | `PasswordMinLength` / `PasswordMaxLength` / `ErrPasswordCharset` / `ErrPasswordLength` / `NormalizePassword` / `MaxBodyBytes` / `CodeBodyTooLarge` / `BodyLimit` / `CodePasswordCharsetInvalid` / `CodePasswordLengthInvalid` に全て付与 |
| 6-6 | `console.log` / `fmt.Println` を残していない | **◎** | 変更ファイル全数を grep して 0 件 |
| 6-7 | **パスワードがログに出ていない** | **◎** | `internal/{api,service}/auth/` の非テストコードに `slog` は既存の `WarnIfMisconfigured` 1 か所のみ（入力値を持たない）。拒否の応答にも入力値を載せていない（`bodyTooLarge` / `badRequestCode` にコメントあり）。`TestValidateNewPassword_DoesNotLeakInput` と `TestAuthHandlers_DoNotLogCredentials` が固定 |
| 6-8 | test-id 命名 | **○** | 既存の流儀（`settings-user-*` / `auth-*`）へ揃えている。`DES-005` §6.8 の規約は `recipe-<領域>-<識別子>` で射程が入力面に限られており、そのままは適用できない——**この射程の食い違いを完了報告 §14-2 が自ら申告している**。既存 test-id の改名・削除 0 件 |
| 6-9 | 検査スクリプト | **◎** | `check-artifact-integrity.sh` / `check-browser-storage-keys.sh` / `check-enum-sync.sh` / `check-md-emphasis.sh` を回し、実測値を完了報告 §12 に転記 |

### 7. 文言（チェックリスト §7）

**△** — 追加した文言そのものは方針に適合しているが、**既存文言を 1 つ壊している**（高1）。

- 「平文」「ポート」「正規化」「エンコード」「安全です」は 0 件。`errorCharset` は「正規化」の語を使わず「見た目が同じでも別の文字として扱われたりする」と現象で書いており、`§4.4-5` の要求を正面から満たしている。
- 拒否の文言が「なぜ弾くか」を持つ（「ほかの機器から開くときに〜」）。「使えない文字です」だけになっていない。
- `CHANGE-119` §3 の案から変えた 2 件（`errorTooShort` / `errorTooLong`）の新旧が完了報告 §10-2 に並べてある。**表示される文面は案と同一**であることまで明記されている。
- ja/en parity は `locales.test.ts` が双方向で機械検査しており緑。**ただし同検査は「参照されているキーが存在するか」を見ないため、高1 を検出できない。**

### 8. ドキュメント・進捗ログ（チェックリスト §8）

**○**

- 指示書 §7.5 の 12 項目は**すべて**存在する。§1.2 の突き合わせは「一致した（行番号まで正確）」と明記、代償（前後空白）も §3 に記載、破壊確認 A の結果も §4 に記載。
- **★`DES-002` §8 / `DES-006` §7 / `DES-005` §5.16 と as-built の差の全数**（§7.5-6）が §9 に整理されている。とくに **差分 5**（`DES-005` §4.1 の「ユーザー表示 ／ 現在のユーザー名表示、ログアウト（複数ユーザー時のみ）」が `CHANGE-119` §2-g の反映射程から外れる）は、走査キーワードでは当たらない形であり、**目視で見つけた旨まで書いてある**。設計卓はこれを必ず反映に含めること。
- 否定形確認は走査コマンドが残っており、**陽性対照（`next == ""`）が先に置かれ、実際に当たっている**（`E-84` 準拠）。走査対象も本番コード／テスト資産／設計文書・指示書の 3 系統を明記。`migrations/` に当たった件も「直さず、当たったことを報告」で §4.9-4 どおり。
- 並列相手（`M22-04`）が居なかったことを、ボード §1.6・ブランチ 0 件・`docs/progress/m22-04*` 0 件・`git worktree list` の 4 経路で実測して明記（`E-121` 準拠）。**★そのうえで交差点 6 点を自分で実査している**（片方の Plan Mode の結論を引き写していない＝D-217）。
- 「■ 併せて更新が要るもの」が §14 に存在し、7 項目を「該当なし」も含めて列挙（`E-114` 準拠）。
- `docs/progress/progress-log.md` へ索引行を追記済み。横断課題 6 件を含む。
- followup 3 件は設計伝達レポート §4 へ回す旨を明記し、`followup-backlog.md` を編集していない（D-382 準拠）。
- **★欠け**: §7.5-7（文言の全数）に **削除した i18n キーの記載が無い**（高1 の一部）。

---

## 設計準拠性以外の指摘事項

### ★重大 1: `auth.setPassword.hintLater` を削除したまま参照が残っている

**該当**: `web/src/locales/ja.json` ／ `web/src/locales/en.json`（削除） ⇄ `web/src/features/auth/PasswordSetForm.tsx:96`（参照）

```
$ node -e "..." # ja/en から直接引く
auth.setPassword.hintLater | ja= undefined | en= undefined
```

```tsx
// web/src/features/auth/PasswordSetForm.tsx:94-97
<ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
  <li>{t("auth.setPassword.hintOtherService")}</li>
  <li>{t("auth.setPassword.hintLater")}</li>   {/* ← キーが両ロケールから消えている */}
</ul>
```

diff を見ると、4 つの新規キーを**既存の `hintLater` 行に上書きする形**で挿入している。

```diff
-      "hintLater": "あとから設定画面で変えられます。いまは決めずに進むこともできます。",
+      "errorCharset": "日本語や全角の文字は使えません。\n\n…",
+      "errorTooLong": "{{max}} 文字までにしてください。",
+      "errorTooShort": "{{min}} 文字以上で決めてください。",
+      "rule": "半角の英数字と記号で決めてください。",
```

**影響は 2 つある。**

1. **初回設定画面（ウィザード Step 7 ／ 設定画面の「パスワードを決める」）の箇条書き 2 行目に、キー文字列 `auth.setPassword.hintLater` がそのまま表示される。** `web/src/lib/i18n.ts` は `parseMissingKeyHandler` を持たないため、i18next の既定どおりキーが返る。**ja / en の両方で起きる。**
2. **`DES-005` §5.1 Step 7 の要件 4「★あとから設定画面で変更できる（§5.16）」が満たされなくなる。** これは `CHANGE-113`（`M22-02` の as-built）で確定した設計事項であり、`CHANGE-113-notification.md:211` の文言案がそのまま実装されていたものである。**M22-08 はこの要件の撤回を一切求めていない**——指示書 §2.2 の注記が許すのは「失効した記述の是正」であって、生きている要件の削除ではない。

**★なぜ「高」なのか。** 型検査（`tsc --noEmit`）は `t()` が任意の文字列を取るため通る。`locales.test.ts` の parity 検査は **ja / en の両方から消えているため両方向とも緑**になる。`PasswordForms.test.tsx` はこの箇条書きを assert していない。E2E も見ていない。**⇒ 全 1527 テスト・141 E2E・型検査がすべて緑のまま、画面に生のキー文字列が出る。人が読む以外に見つける経路が無い。** さらに完了報告 §10（文言の全数）にも §17（成果物）にも「15 キー追加」としか書かれておらず、削除が申告されていないため、後任は「i18n は追加だけだった」と読む。

**修正**: `hintLater` を ja / en の両方へ復帰させる（文言は `CHANGE-113-notification.md:211` の「あとから設定画面で変えられます。いまは決めずに進むこともできます。」／英語は削除前の "You can change it later from the settings screen. You can also move on without choosing one now."）。**あわせて完了報告 §10 と §17 へ「削除は 0 件」を明記すること。**

**★併せて提案（設計卓・改善レーン向け）**: 本件の型は「参照されている i18n キーが存在するか」を機械検査すれば消える。`locales.test.ts` は parity しか見ておらず、この穴は今後も同じ形で再発する。`t("...")` のリテラル引数を抽出してロケールと突き合わせる検査を `scripts/` へ足す価値がある（followup 候補として設計伝達レポート §4 へ）。

### 中1: 「trim 後に空」だけ `VAL-N06` から外れて `invalid_request` になる

**該当**: `internal/service/auth/service.go:163-171` ／ `internal/api/auth/handler.go:105-113`

```go
if next == "" {
    return ErrEmptyPassword          // → 400 invalid_request
}
if err := validateNewPassword(next); err != nil {
    return err                       // → 400 password_length_invalid / password_charset_invalid
}
```

空文字は `VAL-N06`（前後の空白を除いて 4 文字未満）の一種でありながら、**別のコード**を返す。画面側の `passwordRules.ts` は `validateNewPassword("")` に対して `"tooShort"` を返すため、**画面とサーバで分類が割れている**。

実害は小さい（画面は空を送らないため、`curl` 相当の経路でしか出ない）。**ただし完了報告 §9-1 が `VAL-N06` の as-built を「4 未満または 128 超なら 400 ＋ `password_length_invalid`」と設計卓へ渡している。** 設計卓がこれをそのまま `DES-006` §7 へ書くと、`""` のときだけ嘘になる。`ErrEmptyPassword` は `M22-01` からの既存挙動であり、残す判断自体は妥当だが、**as-built として 1 行明記するか、`validateNewPassword` へ寄せて `password_length_invalid` に統一するかを決めること。** `TestSetPassword_RejectsEmpty` も 400 しか見ておらず、コードを固定していない。

### 中2: 「ログアウトを押すとログイン画面へ戻る」の自動テストが無い（§5.1-9 の後段）

**該当**: `web/e2e/m22-08-auth-finishing.spec.ts` ／ `web/src/features/config/SettingsSectionUser.logout.test.tsx`

単体テストは `logoutMutate` が呼ばれることまでしか見ていない。E2E の A は「導線が出ない／出る」だけで、**押していない**。

**★しかも E2E ヘルパ `simulateProtectedServer` には、そのための機構が既に書かれているのに使われていない。**

```ts
if (path === "/api/auth/logout") {
  authenticated = false;        // ← ここを踏むテストが 1 本も無い
  await route.fulfill({ status: 204, body: "" });
  return;
}
// 保護対象。ログアウト後は 401 になる。
if (!authenticated) { ... }     // ← 同上
```

配線そのものは読んで正しいと判断できる（`useLogout` → `AUTH_STATUS_KEY` invalidate → `AuthGate` が `passwordRequired && !authenticated` で閉じ直す＝`M22-02` と同経路）。開発者の手動確認 (3) でも押さえられる。**ただし §5.1-9 は「押すとログイン画面へ戻る（同 3）」を必須テストとして挙げており、そこだけ欠けている。** ヘルパは書けているので、`simulateProtectedServer` を使って「ログアウトを押す → `auth-login-title` が出る」を 1 本足せば埋まる（デッドブランチも解消する）。

### 中3: 申告の無い／偽った本文では 413 にならない（`VAL-N07` の as-built 記述とのずれ）

**該当**: `internal/api/auth/bodylimit.go:41-65`

`BodyLimit` は 2 段構えになっている。

1. `req.ContentLength > limit` → 即 413（**テスト済み**。`TestAuthRoutes_RejectOversizedBody` / `TestBodyLimit_DoesNotLeakToSiblingRoutes` はいずれもこちらを通る）
2. `http.MaxBytesReader` で実読み取りを頭打ち → `errors.As(err, &maxErr)` で 413 へ変換（**未テスト**）

**2 の経路は、認証ハンドラでは成立しない。** `Login` / `SetPassword` は `c.Bind` のエラーを自分で畳んでしまう。

```go
if err := c.Bind(&req); err != nil {
    return badRequest(c, "invalid JSON body")   // ← 400 invalid_request を書き込み、err = nil を返す
}
```

⇒ ミドルウェアへ戻る時点で `err == nil` かつ `c.Response().Committed == true` のため、`errors.As` の分岐へ到達しない。**chunked 転送や `Content-Length` を偽った要求は、413 `request_body_too_large` ではなく 400 `invalid_request` になる。**

**防御そのものは効いている**（本文は 8KiB で打ち切られ、鍵導出には届かない）ので機能上の穴ではない。問題は記述側で、完了報告 §9-1 が `VAL-N07` の as-built を「**応答＝413 ＋ `request_body_too_large`**」と設計卓へ渡している点である。**設計卓がこれを `DES-006` §7 へ書くと、chunked 経路で嘘になる。** 「`Content-Length` を申告した要求は 413、申告が無い／偽っている要求は本文を打ち切ったうえで 400」と正確に書くか、ハンドラ側で `*http.MaxBytesError` を判別して 413 へ寄せるかを決めること。**あわせて 2 の経路のテストが 1 本も無いこと**（`Content-Length` を消した `httptest` 要求で足せる）を記録しておきたい。

---

## 推奨修正（優先度別）

### 高（M22 完了前に修正必須）

1. **`auth.setPassword.hintLater` を ja / en の両ロケールへ復帰させる。**（重大 1）
   - 復帰させる文言は削除前のもの（`CHANGE-113-notification.md:211` と対）。
   - **`DES-005` §5.1 Step 7 の要件 4 を満たすための記述であり、M22-08 はその撤回を求めていない。**
   - 完了報告 §10（文言の全数）へ「削除・変更したキー: なし」を明記し、§17 の「各 15 キー追加」が**追加のみ**であることを裏付けること。
   - 修正後、`PasswordSetForm` を描画するテスト（`PasswordForms.test.tsx`）へ「箇条書きに『あとから設定画面で変えられます』が出る」の 1 行を足すと、同じ形の再発を止められる。

### 中（M23 着手と並行可）

2. **`VAL-N07` の as-built 記述を正確にする**（中3）。完了報告 §9-1 の「応答＝413」を、`Content-Length` 申告時と非申告時で書き分ける。**設計卓が `CHANGE-119` を `DES-006` §7 へ反映する前に直すこと**——反映後だと設計書側に不正確な記述が残る。あわせて `Content-Length` 非申告経路のテストを 1 本足す。
3. **「ログアウトを押すとログイン画面へ戻る」の自動テストを足す**（中2）。E2E に `simulateProtectedServer` を使った 1 本を追加する（ヘルパは既に書けている）。
4. **「trim 後に空」のエラーコードの扱いを決める**（中1）。`password_length_invalid` へ統一するか、`invalid_request` のまま残して完了報告 §9-1 の `VAL-N06` 行へ 1 行注記するか。`TestSetPassword_RejectsEmpty` にコードの assert を足す。

### 低（将来対応）

5. **i18n キーの「参照されているのに存在しない」検査を足す**（重大 1 の恒久策）。`locales.test.ts` は ja↔en parity しか見ておらず、本件のように**両方から消えると緑のまま通る**。followup 候補として設計伝達レポート §4 へ。
6. **`settings.user` の 4 キーがブロック末尾へ追記されている**（D-416 の「名前順で入れる」との差）。`auth.setPassword` と `user` は中途挿入で意図に沿っており、`M22-04` は `conflict.*` 名前空間なので実害は無い見込み。次に同ファイルを触るサブがある場合のみ注意。
7. **Go `strings.TrimSpace` と JS `String.prototype.trim` の空白集合は完全一致しない。** U+0085（NEL）は Go のみ、U+FEFF（ZWNBSP）は JS のみが落とす。完了報告 §7 の「Go 側と同じく Unicode の空白を扱う」は厳密には不正確で、末尾に U+FEFF を含む入力は画面を通過してサーバで `password_charset_invalid` になる（画面には汎用の「保存できませんでした」しか出ない）。実害は極小だが、**この注記は後任がそのままコピーする**性質のものなので 1 語添えておきたい。
8. **サーバが返す `password_charset_invalid` / `password_length_invalid` を画面が文言へ振り分けていない**（`auth.setPassword.failed` の汎用文言に落ちる）。画面側で先に止めるため通常は到達しないが、7 のようなずれが起きたときに理由が見えない。
9. **`user.rename.empty` は画面から到達しない**（submit が `renamed.trim() === ""` で disabled）。テストはモックで 400 を注入して確認しており妥当。「実経路では出ない防御的な分岐である」旨をコメントに残すと、後任が「デッドコードだ」と消さずに済む。
10. **指示書・チェックリストの項目数が食い違っている**（設計卓への差戻し候補）。指示書 v1.3.0 は §3.3 が **9 項目**だが、§7.5-1 は「実査 **7** 項目」、§9.4 は「§3.3 の **8** 項目」と書いている。チェックリスト v1.1.0 も §0.1 / §12 で「**8** 項目」。製造は 9 項目すべてを実施しており実害は出ていないが、`check-instruction-format.sh` が拾わない型のずれである。

---

## 良かった点（Claude Code へのフィードバック）

1. **★破壊確認 A の「赤くなった本数」を鵜呑みにしなかった。** 4 本赤くなったうち 2 本（`TestService_Login_IssuesDistinctSessions` / `TestService_ConcurrentAccess`）が **fixture の `"pw"` がたまたま 3 文字だっただけ**であることを特定し、「パスワードを `"password"` に変えれば緑のまま通る ⇒ 締め出しを検出しているのは新設した 2 本だけ」と結論している。**これは求められていた以上の検証である。** 破壊確認を「何本赤くなったか」で終える例は多く、本件は網の実効本数まで数えた点で質が違う。progress-log の横断課題 3 へ一般化まで書いてある。

2. **★最重要ゲート 2 を「外側」と「内側」の 2 方向から押さえた。** `TestBodyLimit_DoesNotLeakToSiblingRoutes`（認証パッケージ側から兄弟経路へ 2MiB）と `TestImportRoutes_AcceptCSVFarLargerThanAuthBodyLimit`（**実物の取り込みハンドラ + 本番と同じ経路登録**で約 458KiB の CSV）。しかも**両方に「同じ echo の認証経路では同じ本文が 413 になる」対照実験**が付いている。「そもそも上限が効いていないだけ」と区別できない状態を自分で潰している。

3. **★指示書の示唆に盲従しなかった。** §4.6-3 が「★Echo はミドルウェアを持つ」と名指ししていたが、`echo/v4/middleware` が `golang.org/x/time/rate` を引き込むことを `go vet` の実出力付きで実測し、同じ指示書の §2.3 / §7.3 / §9.3-3 と衝突することを示したうえで `net/http.MaxBytesReader` へ寄せている。**「標準の仕組みを使え」と「依存を増やすな」がフレームワークのサブパッケージでは両立しないことがある**という一般化を progress-log へ残した点も良い。

4. **★`CHANGE-119` の反映射程から外れる食い違いを目視で見つけた。** `DES-005` §4.1 の「ユーザー表示 ／ 現在のユーザー名表示、**ログアウト（複数ユーザー時のみ）**」が、as-built（設定画面 ／ `passwordRequired` が true のときだけ ／ 利用者表示とは別物）と 3 点で食い違う。**`CHANGE-119` §2-g は §5.16 への追記しか書いていないため反映しても取り残される**ことまで指摘している。「無い」と書いてある記述だけでなく「別の場所に在る」と書いてある記述も失効しうる、という気付きは否定形確認の運用そのものを一段上げる。

5. **★既存テストを最重要ゲート 1 の網へ転用した。** `PasswordForms.test.tsx` の `newPassword: "new"`（3 文字）は fixture の失効として直しつつ、**`currentPassword: "old"`（3 文字）は意図的に残した**。これで「現在欄には検査が掛からない」ことを既存テストが兼ねて固定する形になり、網が 1 本増えている。赤くなったテストを「実装の欠陥か fixture の失効か」で切り分けた記録も残っている。

6. **★`DES-002` §8.1 の 17（画面は実効値 `passwordRequired` を見る）を正しく踏んだ。** ログアウトの表示条件に `passwordSet` ではなく `passwordRequired` を使い、**「検証子は在るがゲートが効いていない」ケースを独立したテストで固定**している。この 2 つは通常の操作では割れないため、テストでしか押さえられない。

7. **★ドリフト対策が二重に効いている。** 数（4 / 128）を Go / TS の両側で定数化したうえ、**文言側にも数を書かず i18n 補間で差し込んでいる。** `CHANGE-119` §3 の案から意図的に変え、理由（`E-76`）と新旧を完了報告へ並べた。案から離れる判断とその記録の作法が正しい。

8. **★E2E がサーバの共有状態を書き換えていない。** シナリオ B は「押さない」ことを明記し、C は `page.route` でコンテキスト内シミュレートしている。照合パターンも `^https?://[^/]+/api/` に絞り、`**/api/**` が Vite のソースモジュールに当たる（`M22-01` の実測）落とし穴を回避している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **★開発者の手動確認 4 項目（指示書 §7.1＝`D-398`）は未実施である。** とくに **(1) いま設定されているパスワードで入れる**は、開発者の手元に非 ASCII の検証子が在った場合の唯一の実地検証であり、本レビューでは代替できない（作業ツリーに `config.toml` が存在しないため）。完了報告 §13 の手順は貼り付け可能な形で書かれている。
- 指示書 v1.3.0 はリポジトリにコミットされていないため、ディスク上の v1.2.0 ではなく開発者から受領した v1.3.0 を正として判定した。v1.2.0 → v1.3.0 の差分（§2.1 の i18n 行に D-416 の「キーを足す位置」が入った 1 点）は本レビューの §「低 6」で扱っている。
- 重大 1 の「画面にキー文字列が出る」は、i18next の既定挙動（`parseMissingKeyHandler` 未設定 ⇒ キーを返す）と `web/src/lib/i18n.ts` の内容から導出したものであり、ブラウザでの目視確認は行っていない。

---

*以上、M22-08 レビュー報告書。**最重要ゲート 2 つは守られている。修正が要るのは、テストでは絶対に検出できない i18n キーの欠落 1 件である。***

---

## 取り込み結果（自動トリアージ）

| 実施日 | 2026-08-16 |
|---|---|
| 往復 | **1 回目**（上限 2 回。`CLAUDE.md` §9） |
| 判定 | **「高」1 件を採用。「中」3 件すべて採用。「低」6 件のうち 3 件採用・3 件不採用** |
| **「高」の不採用** | **0 件**（⇒ 開発者へのエスカレーションは発生していない） |

### 高

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| 高1 | `auth.setPassword.hintLater` を削除したまま参照が残っている | **採用** | **★指摘のとおりの事故だった。実測で確認**（`ja.json` / `en.json` とも `hintLater` が `undefined`、`PasswordSetForm.tsx:96` は参照を継続）。新規キーの挿入で**アンカー行ごと上書き**していた。**⇒ 両ロケールへ元の文言で復帰させた**（`hintOtherService` の直後＝元の位置）。**あわせて `PasswordForms.test.tsx` へ「既存の案内 2 行が消えていない・生のキー文字列が描画されていない」テストを追加**し、同型の再発を止めた。完了報告へ §10-2-b「削除・変更した既存キー＝0 件」を新設し、事故の経緯も残した |

### 中

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| 中1 | 「trim 後に空」だけ `VAL-N06` から外れて `invalid_request` になる | **採用（記述側で解決）** | **実挙動は変えなかった。** `ErrEmptyPassword` は `M22-01` からの既存挙動であり、**本サブは既存の拒否の意味づけを変えない**方を採った（画面側は空を送らないため実害は `curl` 相当の経路に限られる）。**⇒ 完了報告 §9-1 の `VAL-N06` 行へ 1 行明記し、`TestSetPassword_EmptyRejectionCode` でコードをリテラル固定した**（空文字・空白だけの 2 通り）。設計卓が `DES-006` §7 へそのまま書いても嘘にならない状態にした |
| 中2 | 「ログアウトを押すとログイン画面へ戻る」の自動テストが無い | **採用** | **★指摘のとおり §5.1-9 後段が欠けていた。** E2E へ `M22-08 A-2` を新設（`simulateProtectedServer` を使い、押下 → `auth-login-title` が出る／ログアウト導線が消える）。**対照（押さなければ設定画面のまま）も対で置いた。** 指摘どおり `simulateProtectedServer` のデッドブランチ（`logout` → `authenticated = false` → 401）も解消した。E2E は 141 → **143 passed** |
| 中3 | `Content-Length` 非申告時に 413 にならず、as-built 記述とずれる | **採用（実挙動側で解決）** | **★まず実測で裏を取った**——プローブテストで `status=400 body={"error":{"code":"invalid_request",...}}` を確認（検証子は書かれず、防御自体は効いていた）。**⇒ 記述を合わせるのではなく、応答を揃える方を採った。** `IsBodyTooLarge()` を公開し、`Login` / `SetPassword` の `c.Bind` エラー処理で判別して 413 へ寄せた。**これで `errors.As` 分岐がデッドコードでなくなり、VAL-N07 の応答が経路によらず 413 に揃う。** `TestAuthRoutes_RejectOversizedBodyWithoutContentLength` で固定 |

### 低

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| 低5 | i18n の「参照されているのに存在しない」検査を足す | **不採用（本サブでは）** | **★恒久策として妥当であり、潰すのではなく回す。** ただし `scripts/` への新規スクリプト新設は改善レーンの範囲であり、本サブのスコープ（§2.1）に無い。**⇒ 設計伝達レポート §4 へ followup 候補として起票する。** 当座は高1 で足した回帰テストが同じ穴を塞いでいる |
| 低6 | `settings.user` の 4 キーがブロック末尾へ追記されている | **不採用（現状で D-416 を満たす）** | D-416 の主眼は「**ファイルの末尾へ固めない**」であり、本件は `settings` 名前空間ブロックの内側（585 行中の 331 行目）に在る。**自分が足した 4 キー同士は名前順**（`logout` / `logoutHeading` / `logoutNote` / `rename`）。既存キーの並べ替えは、`M22-04` との衝突面をむしろ広げるため行わない（完了報告 §8-1 に解釈を明記済み）。指摘も「実害は無い見込み」としている |
| 低7 | Go `TrimSpace` と JS `trim` の空白集合が完全一致しない | **採用** | **★完了報告 §7 の「Go 側と同じく Unicode の空白を扱う」は不正確だった。** `U+0085` は Go だけ、`U+FEFF` は JS だけが落とす。**⇒ 完了報告を実態どおりに書き直し、`passwordRules.ts` の doc コメントへも明記した**（「両者が同じ規則であるとは書かないこと——後任がこの注記をそのまま写す」まで添えた） |
| 低8 | サーバの `password_charset_invalid` 等を画面が文言へ振り分けていない | **不採用** | 画面側が先に止めるため通常は到達しない。到達しうるのは低7 の `U+FEFF` の縁だけで、そちらは低7 で文書化した。**汎用文言へ落とすのは `PasswordSetForm` の既存の形**（`auth.setPassword.failed`）であり、本サブで変えると `M22-02` の as-built を動かすことになる |
| 低9 | `user.rename.empty` が画面から到達しない | **採用** | `isEmptyName` の doc コメントへ「画面からは到達しない防御的な分岐である（送信ボタンが disabled）。`curl` 相当の経路で 400 が返ったときに理由が読める状態にしておくために残してある。**デッドコードとして消さないこと**」を明記 |
| 低10 | 指示書・チェックリストの項目数が食い違っている（§3.3 は 9 / §7.5-1 は 7 / §9.4 は 8 / チェックリストは 8） | **不採用（製造の手番ではない）** | **★指示書とチェックリストは設計卓の成果物であり、製造は編集しない**（`CLAUDE.md` §8）。製造は 9 項目すべてを実施済みで実害は出ていない。**⇒ 設計伝達レポート §4 へ差戻し候補として起票する** |

### 取り込み後の再テスト

| スイート | 結果 |
|---|---|
| `go test ./...` | **52 パッケージすべて ok / FAIL 0** |
| `cd web && pnpm test` | **161 files・1528 tests passed** |
| `make e2e` | **143 passed（failed 0）** |

### ★停止規律

**未解消の指摘は 0 件。** `docs/handover/followup-backlog.md` §J への登録も **0 件**。往復は 1 回で完了しており、上限（2 回）には達していない。

**★「高」の指摘を不採用にした件は 0 件**であるため、開発者へのエスカレーションは発生していない。
