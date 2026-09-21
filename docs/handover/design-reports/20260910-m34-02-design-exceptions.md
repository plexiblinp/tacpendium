# 設計伝達レポート（例外レポート） — `M34-02`（常駐ランチャと黒窓の除去）

| 項目 | 内容 |
|---|---|
| **対象** | **親チャット（設計卓）** |
| **発信** | 製造担当 Claude Code（2026-09-10） |
| **指示書** | `docs/instructions/M34-02-tray-residency-and-no-console.md` **v1.0.0** ／ 上位 `M34-overview` v1.5.0 ／ チェックリスト `docs/instructions/reviews/M34-02-review-checklist.md` v1.0.0 |
| **実装コミット** | ブランチ `claude/m34-02-implementation-plan-05yz66`（**push 済み。設計卓は HEAD で読める**） ／ 起点 `0660fa2` ／ **9 コミット**（段 1〜6 が `cfd08aa` `bcc03e7` `0403e5a` `4d98b53` `f51a14b` `7922d3d`、完了報告 `59ab289`、Phase C `8cc2ef8`、統計更新 `d6c7526`）＋ 本レポート自身 |
| **関連** | 完了報告 `docs/progress/M34-02-completion-report.md` ／ レビュー `docs/progress/m34-02-review.md`（指摘 19 件＝高 5 / 中 7 / 低 7・**高の不採用 0 件**） |
| **源泉** | 完了報告 ＋ レビュー報告 ＋ **実装と同一セッション内で生成**（セッション中の実測を反映済み） |
| **CHANGE / マイグレ / 依存** | **CHANGE 0 本**（自採番しない＝`D-293`。候補は §6） ／ マイグレ 0 本 ／ **新規依存 0 件**（`go.mod` / `go.sum` 差分 0 行） |

> **★★【2026-09-12 追記】続きが在る**——実機確認の回答で生じた差分は **`20260912-m34-02-design-exceptions.md`（第 2 報）** にある。**⇒ 両方を読むこと。**
> **本書 §2-1 は裁定済み**（`localhost` 維持）**。§1-4 のメニューは 6 項目になった**（第 2 報 §1-1）**。**

本書は **①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題**に絞る。指示どおりの部分は割愛する。

**★★最重要は §2-1 である**——**開発者裁定 `D-790` の文面と違う形に実装してある。**

**§2 に項目が 3 件ある。★うち §2-1 は 2026-09-12 に開発者が裁定済みであり**（案 (a)「`localhost` 維持」）**、親に残るのは `M34-overview` §5 判断 2 の文面補正だけである。⇒ 残り 2 件（§2-2 / §2-3）は受理／却下の裁定が要る。**

**★2026-09-12 追記**——**実機確認 6 項目はすべて OK で、追加要求が 1 件出た**（トレイへ「設定ファイルのフォルダを開く」。§1-4）**。**

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### §1-1 ★★相対パスの解決基準（`config.toml` / `logging.file`）

**確定した規則**（`internal/config/basedir.go`）:

| 入力 | 解決先 |
|---|---|
| 空文字・絶対パス | **そのまま**（素通し） |
| 相対パス | `AppBaseDir()` からの絶対パス |
| `AppBaseDir()` | **実行ファイルのディレクトリ**（`os.Executable()` → `EvalSymlinks`）。**ただし祖先に `go-build*` があるときはカレントディレクトリ**（`go run` / `go test` の一時ビルド出力）。`os.Executable()` が失敗したときもカレントディレクトリ |

- 適用先は **2 つだけ**である＝`cmd/tacpendium/main.go:resolveConfigPath`（`config.toml`）と `internal/infra/log/log.go:Init`（`logging.file`）。
- **`database.path` には適用していない**（理由は §3-2-8）。⇒ **相対で書かれた `database.path` は今もカレントディレクトリ基準**である。
- **解決結果を `*config.Config` へ書き戻していない。** 書き戻すと `PUT /api/config` の再シリアライズで絶対パスが利用者の `config.toml` へ焼き付く（`internal/infra/log/log.go` の注記）。

**⇒ `SUPP-001` §5.8 と `DES-002` §7 へ明文化してほしい。** 現行の §5.8 は「`config.toml` はアプリ実行ディレクトリ直下」と書いており **本実装はそれに寄せただけ**だが、**同節のパス検証ポリシー（`CHANGE-049` 由来）は `logging.file` の相対値を「実行時 CWD 配下」と書いており、そちらが as-built と食い違う。**

**根拠**: `internal/config/basedir.go:36-84` ／ `internal/config/basedir_test.go`（`TestIsGoBuildTempDir` が実測値 3 形と偽陽性 4 形を固定） ／ `internal/infra/log/log_test.go:22-45`。

### §1-2 ★`config.toml` 不在時の挙動（**変えていない**ことの確定）

**不在は今までどおり既定値で続行する。**⇒ `DES-002` の規定は変えない。**ただし黙らせない**——解決後のパス付きで起動ログへ WARN を 1 行出す。

```
{"level":"WARN","msg":"config file not found; started with built-in defaults","path":"…/exe-dir/config.toml"}
```

**⇒ `DES-002` へ「不在は既定値で続行し、解決後のパスを WARN で残す」を 1 行足してほしい。** 現行は「不在をエラーにしない」ことしか書かれておらず、**黒窓が消えた後は「利用者の設定が黙って無視される」ことの唯一の手掛かりがこの 1 行になる**。

**根拠**: `cmd/tacpendium/main.go:configFileMissing` と `run()` 内の WARN ／ 実測は完了報告 §2-(b)。

### §1-3 ★★起動オプションの契約（**引数なしが唯一の起動形**）

| 入力 | 挙動 |
|---|---|
| 引数なし | 常駐モードで起動（唯一の正規形） |
| 未知のフラグ（`--serve` 等） | **エラーで終了**（`exit 1`）。文面「本アプリは起動オプションを取りません。引数なしで起動してください。」 |
| 位置引数（`tray` / `config.toml` 等） | **同上** |
| `-h` / `--help` | **同上**（`exit 0` にしていない。理由は §3-2-5） |

**フラグは 1 つも定義していない。**⇒ `flag` は「引数なしが唯一の起動形」を機械で固定するためだけに使っている。

**⇒ `DES-002`（起動）へ明文化してほしい。** 着手前は **`flag` も `os.Args` も無く、余分な引数を黙って無視していた**（`M34-01` 実査 1）。**⇒ これは仕様変更であり、設計書のどこにも記述が無い。**

**根拠**: `cmd/tacpendium/args.go:36-56` ／ `TestParseArgs`（6 形の拒否を固定） ／ 実測 `tacpendium --serve` → `exit 1`。

### §1-4 ★★通知領域アイコンのメニュー（as-built・**6 項目**）

| # | ラベル | 動作 | 備考 |
|---|---|---|---|
| 1 | ブラウザで開く | `http://<host>:<port>/` | **`TrayItem.Default`**（左ダブルクリックでも走る） |
| 2 | 設定画面をブラウザで開く | `http://<host>:<port>/settings?qr=1` | **フロントの新しいディープリンク**（§1-5） |
| 3 | **設定ファイルのフォルダを開く** | `filepath.Dir(config.ResolveAppPath(configPath))` | **★2026-09-12 開発者要求で追加**（下記） |
| 4 | ログフォルダを開く | `filepath.Dir(config.ResolveAppPath(cfg.Logging.File))` | 段 1 で一意になった出先 |
| 5 | **DB のフォルダを開く** | `filepath.Dir(dbPath)` | **候補 2 件のうち採った側** |
| 6 | 終了 | `Confirm` → `Shutdown(5s)` → `StopTray` | |

> **★★【2026-09-12 追加】項目 3 の由来**——開発者の逐語「**パスワードリセット等の時に直接いじるので、ないと困る**ことがわかりました」。
>
> **簡易パスワードを忘れたときの復旧手段は `config.toml` の手編集だけである**（`config.toml.example` のコメントが唯一の手順。アプリからは復旧できない）。**⇒ `DES-002` §8（簡易パスワード）の復旧導線として書いてほしい。**
>
> **★`TACPENDIUM_CONFIG_PATH` で差し替えている場合はそちら側のフォルダを開く**（「いま読んでいる設定ファイル」と開く先がずれない）。

- **`exe のフォルダを開く` という項目は作っていない。** 段 1 でログの基準を exe の位置へ寄せた結果、**exe のフォルダはログフォルダの親になった**（`M34-overview` §5.1.6-6 が「親になるなら足さない」と書いた条件）。**★項目 3 は配布では同じ場所を開くが、これは §5.1.6-6 の判断を覆したものではなく「用途が別」という理由で 1 項目にしたものである。**⇒ **同じ場所を指す項目を 2 つ出さないことをテストが検査している。**
- **`DB のフォルダを開く` を採った理由**＝ログは exe の隣、DB は `%APPDATA%/tacpendium/` で**重ならない**（案 B を採っていたら重なり、項目は 1 つで足りた）。
- **ツールチップ**は `Tacpendium 稼働中\n<URL>`（`TrayMenu.Tooltip` が「動いているか」の唯一の表示である）。

**⇒ `M34-overview` §5.1.6 の候補 2 件の欄を「採否確定」へ更新し、`DES-002` へ as-built として 5 項目を書いてほしい。**

**根拠**: `cmd/tacpendium/tray.go`（`buildTrayMenu`） ／ `TestBuildTrayMenu_ConfirmedItems`（**6 項目の順序と、同じ場所を指す項目の重複が無いことを固定している**）。

### §1-5 ★フロントの新しい URL 契約 `/settings?qr=1`

- `SettingsPage` が `useSearchParams()` で `qr` を読み、`SettingsSectionNetwork` へ **`openQr?: boolean`（既定 `false`）** を渡す。⇒ **クエリが無いときの挙動は従来と同一**である。
- **LAN 共有が OFF のときは何も出ない。** QR ボタンは「無効」ではなく**非描画**という `M22-06` の仕様をそのまま踏襲し、**出し分けは作っていない**（開発者判断 2026-09-09）。
- **クエリは URL から落としていない**（リロードで同じ画面へ戻る。理由は §3-2-6）。

**⇒ `DES-005` の設定画面の節へ「`?qr=1` で QR モーダルを初期表示する」を 1 行足してほしい。** **★フロントのルート契約であり、`DES-002` §4.2 の API 経路表には載らない**（新設 API・DTO・エラー契約はいずれも 0 件である）。

**根拠**: `web/src/pages/SettingsPage.tsx:13-20` ／ `web/src/features/config/SettingsSectionNetwork.tsx:11-33` ／ `SettingsPage.test.tsx` の 3 本（`?qr=1` で `role="dialog"` が出る ／ クエリ無しでは出ない ／ `local` では出ない）。

### §1-6 ★★`GET /api/health` が「二重起動の判別」の判定材料になった（**既存契約の新しい消費者**）

**新設 API は無い。** ただし **本サブは `GET /api/health` の応答形そのものを判定に使う消費者を増やした。**⇒ 応答形の変更が起動の挙動に効くようになったため、契約として明示する。

| 項目 | 内容 |
|---|---|
| 呼ぶ先 | `http://127.0.0.1:<config の port>/api/health`（**待ち受けが `0.0.0.0` でも loopback で届く**） |
| 上限 | **700ms**（起動のたびに必ず通る経路のため） |
| 「同一アプリ」と判定する条件 | **3 つすべて**＝(1) `200` (2) `healthapi.Response` へ**未知のキーを許さず**デコードできる（`DisallowUnknownFields`） (3) `status == "ok"` かつ `version` が空でない |
| 判定が真のとき | **既存インスタンスの URL を開いて `exit 0`**。★`MessageBox` は出さない（画面が開くこと自体がフィードバック）。**開けなかったときだけ通知する** |
| 判定が偽のとき | 従来どおり `netutil.ListenAvailable` のポート探索へ進む |
| **持たせなかった分岐** | **アプリ識別子による判定は無い**——`/api/health` の応答は `{status, version}` の 2 キーだけであり、**同じ 2 キーだけを返す別ソフトがそのポートに居た場合は区別できない**（§4-2 の候補） |

**★デコード先は `healthapi.Response` そのものである。**⇒ 同型へフィールドを足しても判別は壊れない（実測: `Extra` を 1 つ足しても判定は成立した）。**手書きの匿名構造体で写していた初版は、フィールド追加で「自分自身を認識できなくなる」形だった**（レビュー 中-10）。

**⇒ `DES-002` の起動の節へ「二重起動は `/api/health` の厳密一致で判別する」を書いてほしい。あわせて `/api/health` の応答形が起動経路の契約になったことを `SUPP-001` §5.9 系へ注記してほしい。**

**根拠**: `cmd/tacpendium/instance.go:28-95` ／ `TestTacpendiumRespondsAt`（6 形） ／ `TestTacpendiumRespondsAt_UsesTheRealHealthHandler`（実ハンドラの応答で固定） ／ 実測は完了報告 §7.1。

### §1-7 ★配布ビルドのリンク指定と、その機械的な門

- `Makefile` に **`WINDOWS_GUI_LDFLAGS := -H=windowsgui`** を 1 か所定義し、**`build-windows` だけ**が参照する（他のターゲットへは広げていない）。
- 門は **`cmd/tacpendium/windows_gui_link_test.go`** である。`Makefile` から値を読み、`GOOS=windows` で実際にリンクし、**`debug/pe` で PE の Subsystem を判定**する（`2` = GUI）。**あわせて `build-windows` レシピが `$(WINDOWS_GUI_LDFLAGS)` を渡していること**も検査する。
- **陽性対照を 4 通り実測した**＝値を空にする／行を消す／レシピから `-ldflags=` を落とす（いずれも赤）／フラグ無しでリンクすると CUI(3) になる。

**⇒ `SUPP-001` §5.2 の「Windows 専用コードのビルド検査」注記（`CHANGE-173`）へ、本門を並べて書いてほしい。** `make check-windows` は**コンパイルの門**、本テストは**リンクの門**であり、守っている面が違う。

**根拠**: `Makefile:46-64` ／ `cmd/tacpendium/windows_gui_link_test.go`。

### §1-8 ★ブラウザ起動の唯一の経路

`desktop.OpenURL` が **`ValidateURL` を通したうえで `github.com/pkg/browser` へ委譲**する。自前の `rundll32` 実装（`browserCommand`）は撤去した。呼び手は 3 つ（起動時の自動起動 ／ トレイ ／ 二重起動時）で、**すべて `desktop.OpenURL` 1 本を通る**。

**★委譲後は「いつ返るか」が OS で違う**（実測）——Windows は `ShellExecute` で**すぐ返る**、Linux/macOS は `exec.Command(...).Run()` で**ヘルパの終了を待つ**。⇒ godoc へ明記した。

**⇒ `SUPP-001` §5.2 の `internal/desktop/` 公開 API 表の `OpenURL` の行へ「実際の起動は `pkg/browser` へ委譲する（`ValidateURL` は内部で通す）」を足してほしい。**

**根拠**: `internal/desktop/desktop.go:145-175` ／ `TestOpenURLKeepsTheValidateURLGate`（拒否 6 形） ／ `go.mod` / `go.sum` 差分 0 行。

### §1-9 ★【2026-09-12 追加】起動失敗ダイアログの導線

**開発者の要求**（実機で `MessageBox` を確認した直後）**＝「設定ファイル契機が多いのであれば、MessageBox に設定ファイルのパスを出したり、設定ファイルのフォルダを勝手に開いたりは欲しい気がしました」。**

**⇒ 実装から `run()` の失敗契機を全数洗い出した。15 種のうち 8 種が「`config.toml` を直せば直る」ものである**（表は完了報告 §15.2）。

| 項目 | as-built |
|---|---|
| 本文 | **エラー文 ＋ 設定ファイルの絶対パスを常に添える。**★設定由来でないときは `(参考)` と断る（原因だと読ませないため） |
| 自動で開く | **設定ファイル由来のときだけ**、ダイアログを閉じた後にその置き場を開く |
| 分類 | `configProblem` の目印。**付けるのは 3 か所**＝`config.Load` ／ `log.Init` ／ `buildAllowedOrigins` |
| 開かない場合 | DB の破損・ポートの枯渇・配布物の異常・引数エラー（**直す先が違う** ／ パスが判る前に落ちる） |

**⇒ `DES-002` の起動の節へ「起動失敗時は `MessageBox` に設定ファイルのパスを添え、設定由来ならその置き場を開く」を書いてほしい。**

**★あわせて 1 件、設計上の小さな歪みを報告する**——**`validate()` は `logging.level` を検証していない**。⇒ タイポは `config.Load` を通り抜け、`log.Init` で初めて落ちる（`log: unknown level`）。**検証の置き場が 2 か所に割れている**。本サブの射程外として触っていない（§4 の候補へは挙げていない。**設計卓が「寄せるべきか」を判断する事項**である）。

**根拠**: `cmd/tacpendium/notify.go`（`configProblem` / `fatalMessage` / `reportFatal`） ／ `TestReportFatal_ConfigProblemShowsThePathAndOpensIt` ／ `TestReportFatal_NonConfigProblemDoesNotOpenTheFolder` ／ 実測は完了報告 §15.3。

---

## §2 契約・設計に反する独自判断（★裁定が要る・3 件）

### §2-1 ★★★開発者裁定 `D-790` の文面と違う origin にした（**ブラウザで開く URL**）

**何に反したか**: `M34-overview` §5 判断 2（`D-790`）の逐語 —
**「⇒ 待ち受けは現行のまま、ブラウザで開く URL だけを `127.0.0.1` にする。」**
指示書 §0.2 の判断 2 も同じ文面を写している。

**実装がどうなっているか**: **`localhost` に揃えてある。**
`cmd/tacpendium/main.go` の定数 **`localAppHost = "localhost"`** を、`localAppURL()` / `settingsQRURL()` / `printStartupNotice` の 3 導線が共有する。

**なぜそう判断したか**: **`localStorage` / `sessionStorage` は origin 単位**であり、`http://localhost:<port>` と `http://127.0.0.1:<port>` は別 origin である。

| # | 事実 |
|---|---|
| 1 | **着手前の `launchBrowser` と `printStartupNotice` はどちらも `localhost` を案内していた**（`git show 0660fa2:cmd/tacpendium/main.go`）。⇒ 既存利用者の UI 状態は `localhost` 側にある |
| 2 | `127.0.0.1` へ変えると **`web/CLAUDE.md` §1 台帳の実装済み 9 キー**が見えなくなる |
| 3 | **`keyboard-bindings-v1`（17 件）は既定を持たず全件を利用者が登録する**（`D-370`）。⇒ **キーボード入力が丸ごと未割当へ戻る**。`gamepad-profiles-v1`（14 件・パッド校正）も同じ |
| 4 | 初版（コミット `0403e5a`〜`7922d3d`）は **導線が 2 origin に割れていた**——案内は `localhost`、自動起動とトレイは `127.0.0.1`。レビュー 高-2 で判明した |

**★判断 2 の実体は守っている**——`determineBindHost` / `determineBindAddr` は**無改変**であり、LAN 共有は壊れていない。**違えたのは「開く URL の綴り」だけである。**

**⇒ 親の裁定を仰ぐ 2 択**:

| 案 | 帰結 | 要る作業 |
|---|---|---|
| **(a) `localhost` のまま受理** | 既存利用者の UI 状態を失わない | **`M34-overview` §5 判断 2 の文面を as-built へ補正**（「`127.0.0.1` にする」→「loopback の綴りは `localhost` に揃える」） |
| **(b) `127.0.0.1` へ揃える（差し戻し）** | 裁定どおりになる | **定数 1 つの変更**（`localAppHost`）＋ **`M32` の説明書へ「キーボード割当・パッド校正・列設定の再登録が要る」告知**が要る |

**★製造は決めない。** `CLAUDE.md` §9 のハード列（ユーザー体験に影響）に当たり、**§10.X のブラウザストレージ台帳が絡む**ためである。**⇒ `followup-backlog.md` §J へ `tray-browser-url-origin-choice` として製造が直接記録した**（§J は製造が書ける唯一の欄）。

**根拠**: `cmd/tacpendium/main.go` の `localAppHost` ／ `TestAppURLsShareOneOrigin`（3 導線が同一 origin であることを固定。**定数を `127.0.0.1` にすると赤になることを実測**） ／ レビュー報告 高-2。

> **★★★【2026-09-12 決着】開発者の裁定 = 案 (a)「`localhost` 維持」**（逐語「ブラウザで開く URL ⇒ localhost 維持」）。
>
> **⇒ 実装の変更は無い。★親に残る作業は 1 つだけである**——**`M34-overview` §5 判断 2 の文面を as-built へ補正すること**（「ブラウザで開く URL だけを `127.0.0.1` にする」→ loopback の綴りは `localhost` に揃える）。**⇒ §6-8 のたたき台はこの形で起票してほしい。**
>
> **★`followup-backlog.md` §J の `tray-browser-url-origin-choice` は「完了」へ更新済み**（製造が §J へ直接記録した行であり、本節の作法どおり本文は書き換えず追記で残した）。

### §2-2 ★★パス検証（`CHANGE-049`）の許可ルートを 1 つ増やした

**何に反したか**: `CLAUDE.md` §10 の禁止事項 **「セキュリティ関連の自己判断」**。
`ValidateDataPath` は `CHANGE-049` が「設定経由の未検証パスがアプリ管轄外の既存ファイルを上書き・破損させる隙」を塞ぐために置いた検証であり、**`SUPP-001` §5.8 は LAN モードの未認証 `PUT /api/config` 経由の破壊的パス植え込みも本検証で封止すると明記している。**

**実装がどうなっているか**: `internal/config/config.go:appDataRoots()` の許可ルートが **3 → 4** になった（既定データディレクトリ ／ 旧既定 ／ **`AppBaseDir()`** ／ カレントディレクトリ）。

**なぜそう判断したか**: 段 1 の帰結として必要だった——**相対パスの基準が exe の隣へ移ったので、利用者が同じ場所を絶対パスで書いたときに検証で弾かれてはならない。**

**★実害の増分は小さい**——exe をダブルクリックすればカレントディレクトリが exe の隣になるので、**着手前から許可されていた**。増えるのは「**ショートカットの作業フォルダが exe と別の場所**」の場合だけである。

**⇒ 親の裁定**: 受理して `SUPP-001` §5.8（`CHANGE-049` の系）へ **「許可ルートは 4 つ」** と反映してほしい。★「相対パスの基準の明文化」として畳まないこと——完了報告の初版はそう書いており、レビュー 中-9 が **「明文化ではなく許可範囲の拡張である」** と是正した。

**根拠**: `internal/config/config.go:425-450`（`appDataRoots`）／ 同 `:389-412`（`ValidateDataPath` の godoc・メッセージも 4 ルートへ是正済み）。

### §2-3 ★指示書 §2.6-2「画面とトレイから」を、呼び手 1 つで満たした

**何に反したか**: 指示書 §2.6-2 の逐語 — **「終了確認（画面とトレイから共通の終了処理を呼び、HTTP サーバを停止してアイコンを削除する）」**。

**実装がどうなっているか**: 共通の終了処理（`Shutdown(5s)` → `StopTray`、`sync.Once` で冪等）は用意したが、**呼び手はトレイの「終了」1 つだけ**である。**画面側の終了ボタンは作っていない。**

**なぜそう判断したか**: **停止用の HTTP ルートが実装に存在しない**（`git grep` で `Shutdown` を叩く API は 0 件）。**外から停止できる口の新設は、認証（`mw.Auth`）と LAN 共有の両方に触れる設計判断**であり、製造の裁量を超える。**★`M34-overview` §1-6 は「画面内の終了ボタン、*または* アイコンの右クリックメニューから」と *または* で書いているため、マイルストーンの要求としては満たせている。**

**⇒ 親の裁定**: **画面側の終了ボタンを持たないまま `M34` を閉じてよいかを決めてほしい。** `M34` は 2 段構成で本サブが最後である。**★作るなら `DES-002` §8（認証）との関係を先に決める必要がある**（LAN の他端末から停止できてよいのか）。

**根拠**: `cmd/tacpendium/tray.go:159-176`（`quit` の定義と唯一の呼び手） ／ レビュー 中-11。

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点

**なし。**

指示書 §0.2 のとおり**開発者判断待ちは 0 件**で着手し、セッション中に新たな確認は発生しなかった（着手前の計画提示に対する承認 1 回のみ）。**§2-1 は「確認した」のではなく「製造が暫定で決めて §J へ記録した」ものである。**

### §3-2 推測で進めた点（指示書 §2.2 の「選んで理由を書く」形を含む）

| # | 判断 | 理由 | 確認方法 |
|---|---|---|---|
| 1 | **`go-build*` 配下の実行ファイルはカレントディレクトリ基準へ倒す**（§1-1） | 倒さないと **`make run-server` ／ worktree のポート分離（`scripts/wt-new.sh` ＋ `playwright.config.ts:readDevBackendPort`）／ E2E スタック**が黙って別の設定で走る。★配布 exe はこの分岐へ入らない | 単体テスト（実測値 3 形＋偽陽性 4 形）／ `go run` の実挙動（repo の `config.toml` port 47455 を読む）／ `make e2e-only P=character-default` 2 passed |
| 2 | **段 1 の案は A を採り、B（ログも `%APPDATA%`）と C（絶対化して出すだけ）を採らない** | B は既定値と `config.toml.example` の書き換えを伴い、**既存利用者のログの出先が黙って変わる**。C は問題が残る | 完了報告 §1.1 に 3 案の欠点を記載 |
| 3 | **`config.toml` 不在は既定値で続行（WARN のみ）** | 初回起動では不在が正常であり、ウィザードの `isInitialized` も不在を前提にする | 実バイナリで WARN を実測 |
| 4 | **書けない場所（`Program Files` 等）で `%APPDATA%` へ逃げない** | 逃げると基準が一意でなくなる。段 4 の通知が入ったので**書けないことは `MessageBox` で見える** | `log: mkdir` 失敗は `reportFatal` を通る |
| 5 | **`-h` も `exit 1`** | 本アプリは起動オプションを取らないので `-h` は「引数の誤り」の 1 形。**致命の出口を 1 本に保つほうが `-H=windowsgui` 下で確実に伝わる**。`exit 0` は「受け付けた」と読める | `TestParseArgs` |
| 6 | **`?qr=1` を URL から落とさない** | ディープリンクであり、リロードで同じ画面へ戻るのが素直。落とすと履歴を書き換える | `SettingsPage` のコメントに理由を記載 |
| 7 | **二重起動の判別は配布ビルド限定にせず常時有効** | 受領方式に条件が無いため素直に採った。★開発時に 2 本目を起こすと退くようになる（従来はポート探索で別ポートへ逃げていた） | 実バイナリ 2 本で実測 |
| 8 | **`database.path` の相対は基準を変えない**（§1-1） | 既定は絶対へ解決されるため本サブが塞いだ害に当たらず、**`M28-01` の移行判定（`prepareDataDirWith` の `SamePath` 比較）に手を入れる危険が大きい** | §4-1 の候補へ回した |
| 9 | **`scripts/build-windows.ps1` を移植しない** | `scripts/**` は `REUSE.toml` の層 C（`MIT`）であり層 A の移植物を置けない。**役目 2 つ（リンク指定・成果物の検証）は `Makefile` とテストが担う** | `REUSE.toml` 差分 0 行 ／ `check-public-snapshot.sh` 緑 |
| 10 | **`launchCmd.HideWindow` を残す**（`true` を立てる呼び手は 0 になった） | 「explorer を隠してはならない」という 2026-08-04 の実機知見を、この `false` が型で保っている | §4-5 へ申し送り |

---

## §4 設計担当が未把握の残課題・申し送り

**★`followup-backlog.md` の本表は製造が編集していない**（`D-382`）。**⇒ 設計卓が畳めるよう、スラッグ・内容・根拠・割付・新規/更新の別を揃えて出す。**

### §4-0 ★★既存行の更新（§CI の 5 件・**すべて本サブで畳んだ**）

| スラッグ | 更新後の状態 | 根拠 |
|---|---|---|
| `log-path-cwd-relative` | **完了**（段 1。`internal/config/basedir.go`） | 完了報告 §1・§2 |
| `cli-arg-parsing-is-a-spec-change` | **完了**（段 2。(a) エラーにして終了） | 完了報告 §3 |
| `browser-launch-duplication` | **完了**（段 6。`pkg/browser` へ委譲・呼び手 3 つが 1 本を通る） | 完了報告 §7.4 |
| `porting-target-layer-c-collision` | **完了**（移植しないことで回避。§3-2-9） | 完了報告 §6.4 |
| `startup-notice-text-stale-on-tray` | **完了**（段 6。トレイの有無で出し分け） | 完了報告 §7.3 |

### §4-1〜§4-6 新規登録の候補

| # | スラッグ | 何が起きるか | 根拠（パス:行・テスト名） | 割付の候補と理由 |
|---|---|---|---|---|
| 1 | **`database-path-relative-cwd-basis`** | **`database.path` を相対で書くと、今もカレントディレクトリ基準で解決される。**⇒ 常駐化で起動経路が増えると DB の場所が動きうる。★既定（空）は絶対へ解決されるため通常は当たらない | `internal/infra/db/db.go:175-180`（`ResolveDBPath` は cfgPath を素通し） ／ 段 1 は `config.toml` と `logging.file` だけを扱った | **改善レーン**。★直すなら `M28-01` の移行判定（`prepareDataDirWith` の `SamePath` 比較）と併せて見る必要があり、単独では危険 |
| 2 | **`health-endpoint-has-no-app-identifier`** | **`/api/health` の応答は `{status, version}` の 2 キーだけで、アプリ名が無い。**⇒ 二重起動の判別が「同じ 2 キーだけを返す別ソフト」と区別できない | `internal/api/health/handler.go:12-24` ／ `cmd/tacpendium/instance.go:64-95` | **設計卓（CHANGE 候補）**。応答へ識別子を足すのは API 契約の変更であり、製造では踏み込まない |
| 3 | **`duplicate-launch-not-in-file-log`** | **二重起動の判別の結果はファイルログに残らない。**`applog.Init` より前に置いているためである（**何にも触らずに退く**ための位置であり動かさない）。⇒ 問い合わせ時に手掛かりが 1 行も無い | `cmd/tacpendium/main.go` の `run()` 冒頭（`detectRunningInstance` は `prepareDataDir` より前） | **改善レーン**。★実害は小さい（画面が開くこと自体がフィードバック） |
| 4 | **`hidewindow-true-side-untested`** | **`launchCmd.HideWindow` に `true` を立てる呼び手が 0 になった**（ブラウザ起動の委譲による）。⇒ 「隠すべきヘルパは隠す」側の検査が無い。★Linux では `spawn` が同フィールドを無視するためテストで守れない | `internal/desktop/desktop.go:81-100` ／ `desktop_windows.go:75-81` ／ 残る検査は `TestFolderCommandNeverHidesWindow`（隠さない側）だけ | **次に `spawn` を使う手番**。フィールドを残す判断（§3-2-10）とセットの申し送り |
| 5 | **`import-order-baseline-ratchet`** | `scripts/check-import-order.sh` が **「現在 99 / ベースライン 101」** と報告し、スクリプト自身が「BASELINE を 99 へ下げること」と促している。**★本サブ由来ではない**（本サブが触った本番ファイルは違反リストに載っていない） | `scripts/check-import-order.sh:70`（`BASELINE=101`） | **改善レーン**。★既存行があれば更新でよい |
| 6 | **`derived-docs-stale-after-m34`** | 派生資料 3 件が陳腐化疑い（`code-facts` 21% / `docs-map` 13% / `custom-commands` 38%）。**★本サブは `internal/desktop` の呼び手を初めて作ったため `code-facts` の該当節は実物と食い違う** | `bash scripts/check-derived-docs.sh` の出力 | **マイルストーン境界の手番**（`/regen_code_facts` ／ `/regen_docs_map` ／ `/sync_command_catalog`） |

### §4-7 ★製造が §J へ直接記録した 1 件（**報告のみ。設計卓の作業は不要**）

| スラッグ | 内容 |
|---|---|
| **`tray-browser-url-origin-choice`** | §2-1 の裁定待ち。**必須 5 フィールド記入済み**（発生元＝`M34-02` ＋ レビュー報告パス ／ 未解消の理由 ／ 再開に必要な条件＝開発者の 2 択 ／ 記録日・状態）。`bash scripts/check-stop-discipline.sh` 緑 |

### §4-8 ★★`M34` を閉じる前に要る実機確認（**開発者の手番**）

**★束 C-1 と 束 D-1 は Windows 実機でしか最終判定できない**（レビュー 中-6）。本サブが測ったのは「失敗が `desktop.Alert` へ到達すること」と「PE の Subsystem が GUI であること」までである。**⇒ 手順は完了報告 §14 を参照。**

> **★★【2026-09-12 実機の結果】6 項目中 5 項目が OK。残るのは「起動失敗時の `MessageBox`」1 件である**（完了報告 §14.2）。
>
> **★あわせて手順側の前提が 1 つ判明した**——**開発機では VS Code が devContainer のポートを Windows の loopback へ転送している**（実測: `127.0.0.1:47318` と `:47331` の持ち主が `Code`）。**⇒ その状態で exe を起動すると二重起動の判別が devContainer 側の Tacpendium を見つけて `exit 0` するため、「起動失敗」を作れない。★判別は設計どおりに働いている**（本当に同じアプリが応答している）**。**
>
> **⇒ `M32` の説明書には関係しないが、`M34` を閉じる手順としては「dev サーバを止めてから確かめる」か「設定値を不正にして確かめる」を書いておくこと**（完了報告 §14.1 / §14.3 に記載済み）。

---

## §5 参考（触れていない＝不変の証跡）

- `go.mod` / `go.sum`: `git diff --stat 0660fa2 -- go.mod go.sum` が **0 行**。
- `REUSE.toml`: 差分 **0 行**（層の割付は既定のまま）。
- `scripts/public-snapshot-manifest.txt`: 差分 **0 行**（`check-public-snapshot.sh` 緑）。
- `migrations/`: 差分 **0 行**（マイグレ消費 0 本）。
- `determineBindHost` / `determineBindAddr`: 無改変（判断 2 の実体）。
- `internal/desktop/tray_windows.go` / `desktop_windows.go` / `tray_sizes_windows_amd64.go`: 無改変（`M34-01` で受理済み）。
- `internal/api/` / `internal/service/` / `internal/repository/` / `internal/model/`: 差分 **0 行**（API 経路の新設・変更なし）。
- `web/CLAUDE.md` §1 の台帳: 追記なし（ストレージキーを 1 つも足していない。`check-browser-storage-keys.sh` 緑）。
- 新規 14 ファイルはすべて `+N / -0`（`git diff --numstat 0660fa2`。教訓 `E-225`）。
- 常設検査: `check-artifact-integrity` ／ `check-progress-log-index` ／ `check-stop-discipline` ／ `check-doc-refs` ／ `check-doc-inventory` ／ `check-enum-sync` ／ `check-import-order` ／ `check-instruction-format` ／ `check-migration-license` いずれも違反なし。

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**番号は起票時に registry で採番すること。マイグレ消費は 0 本**（`migrations/` に触れていないため、連番の払い出しも無い）。

| # | 対象 | 反映内容 | 出所 |
|---|---|---|---|
| 1 | `SUPP-001` §5.8 ／ `DES-002` §7 | **相対パスの解決基準**（§1-1 の表）。★`logging.file` の「実行時 CWD 配下」という現行の記述が as-built と食い違う | §1-1 |
| 2 | `SUPP-001` §5.8（`CHANGE-049` の系） | **★パス検証の許可ルートが 3 → 4 になった**（`AppBaseDir()` の追加）。**「明文化」ではなく許可範囲の拡張として書くこと** | §2-2 |
| 3 | `DES-002`（起動） | **起動オプションの契約**（引数なしが唯一の正規形・未知の引数はエラー）＋ **`config.toml` 不在時の WARN** ＋ **★起動失敗時の導線**（`MessageBox` に設定ファイルのパス、設定由来ならその置き場を開く） | §1-3 / §1-2 / §1-9 |
| 4 | `DES-002` ／ `M34-overview` §5.1.6 | **常駐の as-built**＝**メニュー 6 項目**（候補 2 件の採否確定 ＋ **2026-09-12 追加の「設定ファイルのフォルダを開く」**）／ 二重起動の判別 ／ 終了の経路 ／ 失敗時の通知経路。**★あわせて `DES-002` §8 へ「簡易パスワードの復旧導線はトレイから `config.toml` の置き場を開く」を書いてほしい** | §1-4 / §1-6 |
| 5 | `DES-001` ／ `SUPP-001` §5.2 | **`build-windows` は `-H=windowsgui` でリンクする**（配布物は GUI サブシステム）＋ **リンクの門**（`windows_gui_link_test.go`）。★`make check-windows`（コンパイルの門）とは守る面が違う | §1-7 |
| 6 | `SUPP-001` §5.2（`CHANGE-173` の注記） | **`OpenURL` は `pkg/browser` へ委譲する**（`ValidateURL` は内部で通す）／ `cmd/tacpendium` の構成に `args.go` `tray.go` `notify.go` `instance.go` を追加 | §1-8 |
| 7 | `DES-005`（設定画面） | **`/settings?qr=1` で QR モーダルを初期表示する**。★LAN OFF 時は非描画のまま（出し分けを作らない） | §1-5 |
| 8 | `M34-overview` §5 判断 2 | **★2026-09-12 に裁定済み＝案 (a)「`localhost` 維持」。⇒ 文面を as-built へ補正するだけでよい**（差し戻しは不要。`M32` への告知も不要） | §2-1 |
| 9 | `M32`（説明書・`README`） | **移行手順**（ショートカットの作業フォルダを変えていた利用者は `config.toml` を exe の隣へ）＋ **「終了は通知領域のアイコンから」** | 完了報告 §1.5 |

---

## §7 教訓（`retrospective-log` 行き）

**★親チャットは本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、**実施者は設計担当**（反映担当は 2026-08-11 に廃止）。

1. **★★「門を置いた」と「門が成果物を守っている」は別である。** 本サブの PE サブシステム検査は、**陽性対照まで測ってあったのに配布物を守っていなかった**——`Makefile` の**変数の値**は見ていたが、**`build-windows` レシピがその変数を渡していること**を見ていなかった。⇒ **陽性対照は「検査が赤くなりうること」しか示さない。「守りたい対象そのもの」に届いているかは別に確かめる必要がある。** 一般形＝**門を置いたら、守る対象から門までの経路を 1 本ずつ声に出して辿ること**（変数 → レシピ → 成果物）。
2. **★★origin は「文字列の綴り」ではなく「データの置き場」である。** `localhost` → `127.0.0.1` は URL の見た目の変更に見えるが、**`localStorage` の中身が丸ごと別物になる**。⇒ **ブラウザで開く URL を変える変更は、ブラウザストレージ台帳（`web/CLAUDE.md` §1）を必ず読むこと。** 本件は**既定を持たないキー**（`keyboard-bindings-v1`）が在ったため代償が大きかった。**★裁定の文面（`D-790`）が「`127.0.0.1` にする」と書いていても、その帰結までは裁定していない。**
3. **★委譲は「実装を差し替える」だけでなく「契約を差し替える」。** `desktop.OpenURL` を `pkg/browser` へ委譲した結果、**「すぐ返る」という godoc の 1 行目が OS によって偽になった**（Linux/macOS は子の終了を待つ）。⇒ **委譲するときは、委譲先の同期/非同期・エラー・副作用を実測して godoc を書き直すこと。** 動作は正しいままなのでテストも lint も型検査も緑である。
4. **★「Phase D で書く欄」を過去形で書くと、それは観測ではなく予測である。** 完了報告 §8 が `progress-log.md` を「追記した（Phase D）」と書いた時点で、追記は存在しなかった（レビュー 高-5）。**`D-510` は同じ型を「レビュー結果を参照する欄」について禁じていたが、本サブは別の欄で同じことをやった。**⇒ **一般形＝「まだやっていないことを、やる予定の欄に過去形で書かない」。** 完了報告のどの欄でも同じである。
5. **★メッセージループの戻り値は「誰が止めたか」を語らない。** `RunTray` は WM_QUIT で `nil` を返すが、**WM_QUIT は `StopTray` 以外からも来る**（ログオフ・シャットダウン）。⇒ **「自分が止めたから返ってきたはず」と読むと、外から止められたときに後片付けが走らない。** 一般形＝**冪等な後片付けを、戻ってきた側でもう一度呼ぶ**（`sync.Once` があれば安い）。
6. **★手書きのリテラルで写した構造体は、写した瞬間から乖離する。** 二重起動の判別は `health.Response` と同じ 2 フィールドを匿名構造体で写し、`DisallowUnknownFields` を付けていた。⇒ **フィールドが 1 つ増えると自分自身を認識できなくなるのに、テストは古い JSON を送り続けて全緑になる。** 一般形＝**「相手の型と一致していること」が要件なら、写さずにその型を使う。**
