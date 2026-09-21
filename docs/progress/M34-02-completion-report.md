# M34-02 完了報告: 常駐ランチャと黒窓の除去

| 項目 | 内容 |
|------|------|
| 作業 ID | `M34-02` |
| 指示書 | `docs/instructions/M34-02-tray-residency-and-no-console.md` v1.0.0 |
| 上位 | `docs/instructions/M34-overview.md` v1.5.0 |
| チェックリスト | `docs/instructions/reviews/M34-02-review-checklist.md` v1.0.0 |
| 実施日 | 2026-09-10 |
| 着手基点 | `0660fa2` |
| CHANGE 消費 | **0 本**(設計書は 1 文字も触っていない。**★起票は設計卓であり自採番しない**。候補は §8) |
| マイグレ消費 | 0 本(データに触れない) |
| 新規依存 | **0 件**(`go.mod` / `go.sum` の差分 **0 行**。§7 で実測) |
| レビュー | `docs/progress/m34-02-review.md`(指摘 19 件 = 高 5 / 中 7 / 低 7。**「高」の不採用 0 件**) |

---

## 0. 本サブが達成したこと

Windows の配布 exe を GUI サブシステムでリンクし、黒いコンソール窓を消した。**その前に、消すことで見えなくなるものを 4 段ぶん塞いだ。**

**★段の順序そのものが本サブの設計である**(指示書 §0.1)。コミットは段ごとに 6 本へ分けてある。

| 段 | コミット | 内容 |
|---|---|---|
| 1 | `cfd08aa` | ログと `config.toml` の基準を実行ファイルの位置へ一意化 |
| 2 | `bcc03e7` | 未知の引数をエラーにする |
| 3 | `0403e5a` | トレイの結線とメニュー |
| 4 | `4d98b53` | 失敗時の通知経路 |
| 5 | `f51a14b` | `-H=windowsgui` でリンクし、PE サブシステムを機械で確かめる |
| 6 | `7922d3d` | 二重起動の判別・起動案内の文面・ブラウザ起動の一本化 |
| — | `59ab289` | 完了報告(★レビュー参照欄はプレースホルダのまま) |
| — | `8cc2ef8` | **Phase C** —— レビュー指摘 19 件の取り込み(§13) |
| — | `c65bacb` | 設計伝達レポート |
| — | **追補** | **★2026-09-12 実機確認の回答で 1 件追加**(§4.6 設定ファイルのフォルダを開く)＋ **origin の裁定を反映**(§4.5) |

**★段 1 と段 4 の破壊確認は、いずれも段 5 より前の時点で実測している**(§2.4 / §5.3)。段 5 の後に測ると、失敗が見えないので測れない。

---

## 1. 段 1 —— ログと `config.toml` の基準(指示書 §2.1)

### 1.1 採った案と、採らなかった案の欠点

**採った案 = A(`os.Executable()` の在るディレクトリを基準にする)。ただし相対値の既定は変えない。**

`logging.file` の既定は `logs/tacpendium.log` のまま、`config.toml` も名前のまま置き、**解決の基準だけ**を実行ファイルのディレクトリへ移した。実装は `internal/config/basedir.go` の `AppBaseDir()` / `ResolveAppPath()` 1 組であり、`config.toml` の解決(`cmd/tacpendium/main.go` の `resolveConfigPath`)と `logging.file` の解決(`internal/infra/log.Init`)が同じ関数を通る。

| 案 | 中身 | 採否と理由 |
|---|---|---|
| **A** | `os.Executable()` の在るディレクトリを基準にする | **採った。** ポータブル配布(zip を展開して使う)と噛み合い、`DES-001` の単一バイナリ配布と一致する。**★設計書は元から「アプリ実行ディレクトリ直下」と書いていた**(`SUPP-001` §5.8 / `DES-002` §7)。⇒ 本変更は規定の変更ではなく、実装を規定へ寄せたものである |
| B | ログも DB と同じ `%APPDATA%/tacpendium/` へ寄せる | **採らなかった。** 欠点が 3 つある。(1) **既存利用者のログの出先が黙って変わる**(現在は起動フォルダ配下に在る)。(2) 既定値そのもの(`logs/tacpendium.log`)と `config.toml.example` の書き換えが要り、利用者が写した設定と食い違う。(3) 開発時のログもリポジトリ外へ出る。⇒ **変更の量に対して得るものが「書き込み権限の確実さ」だけである** |
| C | 相対パスを起動時に絶対へ解決して起動ログに出すだけ(基準は変えない) | **採らなかった。** 出先が起動経路ごとに動く問題がそのまま残る。★「ログフォルダを開く」が毎回別の場所を指すのを直せない |

**★A の既知の欠点を隠さない** —— `Program Files` のような書き込めない場所へ置かれると、ログを作れない。**本サブではその場合に黙って別の場所へ逃げない**ことにした。理由は 2 つある。(1) 逃げると基準が一意でなくなり、本段の成果が消える。(2) 段 4 の通知経路が入ったので、**書けなければ MessageBox で見える**(`log: mkdir ...` が `run()` のエラーとして `reportFatal` を通る)。★配布はインストーラを持たない zip の単一バイナリであり(`DES-001`)、既定の置き場は利用者が選んだフォルダである。

### 1.2 開発時だけカレントディレクトリへ倒す(★本サブで最も重い自己判断)

**実行ファイルの祖先に `go-build*` ディレクトリが在るときは、従来どおりカレントディレクトリを基準にする。**

実測: `go run` の実行ファイルは `/tmp/go-build30358198/b001/exe/tacpendium` に置かれる(`go test` のテストバイナリも `go-build*` 配下)。**これを実行ファイル基準で扱うと、リポジトリ直下の `config.toml` が読まれなくなる。**

| 倒さなかった場合に壊れるもの | 根拠 |
|---|---|
| `make run-server`(= `go run ./cmd/tacpendium`) | `CLAUDE.md` §11 の頻用コマンドである |
| **worktree ごとのポート分離** | `scripts/wt-new.sh` が worktree ごとの `config.toml` に別ポートを書き、`web/playwright.config.ts` の `readDevBackendPort()` がそれを読んで E2E ポートを決める |
| 開発時のログの出先 | `go run` の基準は一時ビルドディレクトリであり、ログがそこへ出て消える |

**★配布された exe がこの分岐へ入ることはない。** 判定は `isGoBuildTempDir` として切り出し、実測値の形(Linux / Windows / macOS の 3 形)と「名前が似ているだけのディレクトリ」を単体テストで固定した(`internal/config/basedir_test.go`)。

### 1.3 全 OS の既存挙動が変わらないことの試験(指示書 §2.1.2-2 / チェックリスト B-3)

| 何を | どうやって | 結果 |
|---|---|---|
| テスト中は従来どおりカレントディレクトリ基準である | `TestAppBaseDirUnderGoTest`(テストバイナリ自身が `go-build` 配下に在ることを利用する) | 緑 |
| 相対の `logging.file` が基準へ寄る / 絶対は素通し / `cfg` を書き換えない | `internal/infra/log/log_test.go` 3 本(新設。同パッケージは着手前テスト 0 件だった) | 緑 |
| `ValidateDataPath` の許可ルートが増えても既存の判定が変わらない | 既存 `TestValidateDataPath` / `TestLoad_RejectsAbsoluteOutsideDataDir` | 緑 |
| **開発時の実挙動**(Linux・`go run`) | リポジトリ直下に `config.toml`(port 47455)を置いて `go run ./cmd/tacpendium` | **port 47455 で起動し、`logs/tacpendium.log` もリポジトリ直下に出た**(従来どおり) |
| E2E スタックが従来どおり起動すること | `make e2e-only P=character-default` | **2 passed**(バックエンドは `go run` + `TACPENDIUM_CONFIG_PATH`) |
| Windows 側のコンパイル | `make check-windows` | 緑 |

**★macOS は実行して確かめていない。** `AppBaseDir` の実装は `os.Executable()` と名前判定だけで GOOS 分岐を持たず、`make check-windows` と Linux の実測が両端を押さえている。⇒ 判定に OS 固有の経路は無い。

### 1.4 `config.toml` の不在の扱い(指示書 §2.1.2-4 / チェックリスト B-4)

**変えない。従来どおり既定値で続行する。**⇒ `DES-002` の CHANGE は起こさない。

理由 = **初回起動では不在が正常である**。ウィザードの `isInitialized` も不在の状態を前提にしており、ここをエラーにすると初回起動が落ちる。

**★ただし黙らせない。** 解決後のパス付きで起動ログへ WARN を 1 行出す。

```
{"level":"WARN","msg":"config file not found; started with built-in defaults",
 "path":"…/exe-dir/config.toml"}
```

**★この 1 行が効くのは段 1 の成果があるからである** —— ログの出先が一意になったので、必ず同じ場所に出る。

### 1.5 既存利用者への移行(指示書 §2.1.2-3 / チェックリスト B-5)

**大多数に移行は要らない。** exe をダブルクリックした場合、プロセスのカレントディレクトリは exe の在るフォルダであり、**従来もそこの `config.toml` を読んでいた**。⇒ 同じファイルが同じように読まれる。

**移行が要るのは 1 通りだけである** —— **ショートカットの「作業フォルダ」を exe とは別の場所にしていた利用者**。その場合は従来その作業フォルダの `config.toml` が読まれていたが、今後は読まれない。

| 手順 | 内容 |
|---|---|
| 1 | `config.toml` を **exe と同じフォルダ**へ移す(または複製する) |
| 2 | 過去のログが要るなら、作業フォルダ配下の `logs/` も exe の隣へ移す |
| 3 | 移行が済んだかは、起動後に **exe の隣の `logs/tacpendium.log`** が更新されることで判る。★上記 WARN が出ていれば `config.toml` が見つかっていない |

**★この手順は `M32`(説明書・`README`)へ載せる必要がある。**⇒ §8 の候補へ挙げた。

---

## 2. 段 1 の破壊確認(★指示書 §2.1 / チェックリスト B-1)

**要求 = 基準を変えた後、`config.toml` を意図的に別の場所へ置いて「読まれないこと」を実測すること。**

実測は Linux の実バイナリ(`go build` した exe。`go run` ではない)で行った。★`go run` では §1.2 の分岐に入るため、この確認にならない。

| 段取り | 中身 |
|---|---|
| exe の置き場 | `…/dc/exe-dir/tacpendium` ／ 隣に `config.toml`(**port 47411**) |
| プロセスのカレントディレクトリ | `…/dc/cwd-dir` ／ そこにも `config.toml`(**port 47422**) |
| DB | `TACPENDIUM_DB_PATH=db/t.db`(dev の DB に触らないため) |

**(a) 両方に置いた状態:**

```
server starting" version=0.1.0 mode=local addr=127.0.0.1:47411 port=47411
  allowed_origins="[http://localhost:47411 http://127.0.0.1:47411]"
$ ls …/dc/exe-dir/logs/tacpendium.log   → 在る(18101 bytes)
$ ls …/dc/cwd-dir/logs/                 → No such file or directory
```

**⇒ exe の隣が読まれ、カレントディレクトリ側の 47422 は読まれない。ログも exe の隣にだけ出る。**

**(b) exe の隣の `config.toml` を外した状態**(★「読まれないこと」を、もう一方が拾われないことでも確かめる):

```
server starting" … addr=127.0.0.1:47318 port=47318
config file not found; started with built-in defaults" path=…/dc/exe-dir/config.toml
```

**⇒ 既定値(47318)で起動し、カレントディレクトリ側の 47422 へは落ちない。⇒ 基準は一意である。** あわせて §1.4 の WARN が実際に出ることを確かめた。

---

## 3. 段 2 —— CLI 引数の扱い(指示書 §2.2 / followup `cli-arg-parsing-is-a-spec-change`)

**採った扱い = (a) エラーにして終了。**(設計卓案と同じ)

| # | 内容 |
|---|---|
| 理由 | **黙って無視すると、打ち間違えたオプションが効いていないことに気づけない。**★黒窓を消した後は「効かないうえ、何も出ない」になる |
| 採らなかった (b) 無視を維持 | 着手前の挙動そのものである。⇒ 常駐モードの判定を入れる以上、引数の意味を決めないまま放置すると、後から誰かが `flag.Parse()` を足した瞬間に既定の挙動が黙って変わる |
| 採らなかった (c) 警告して続行 | `-H=windowsgui` 下では警告の行き先が無い。⇒ (b) と実質同じになる |
| フラグの定義 | **0 件。**★設計書に無い起動オプションを増やさない(`CLAUDE.md` §10)。`flag` は「引数なしが唯一の起動形」を機械で固定するためだけに使う |
| 出力 | `flag` の既定出力は捨て、伝え方は返り値のエラー 1 本に寄せた。⇒ 段 4 の通知経路へそのまま載る(指示書 §2.4-4) |
| 実測 | `tacpendium --serve` → `exit 1` / `fatal: 本アプリは起動オプションを取りません。引数なしで起動してください。 (flag provided but not defined: -serve)` |

**★`M34-01` 実査 1 との衝突は無い** —— 本体に CLI サブコマンドは無く(`cmd/seedgen` は配布 exe ではない別バイナリ)、引数なしが唯一の起動形だからである。⇒ `AttachConsole` の分岐も要らない(§9)。

---

## 4. 段 3 —— トレイの結線とメニューの最終形(指示書 §2.3 / §4-4)

### 4.1 メニューの最終形

| # | 項目 | 状態 | 実装 |
|---|---|---|---|
| 1 | **ブラウザで開く** | 確定 | `TrayItem.Default = true`(左ダブルクリックでも走る)。`http://localhost:<port>/`(★origin は §4.5) |
| 2 | **設定画面をブラウザで開く** | 確定 | `http://localhost:<port>/settings?qr=1`。フロントは `SettingsPage` がクエリを解釈し、既存の `QRCodeModal` を初期表示する |
| 3 | **設定ファイルのフォルダを開く** | **★2026-09-12 追加**(§4.6) | `filepath.Dir(config.ResolveAppPath(configPath))`。**実際に読んでいる `config.toml` の側**を開く |
| 4 | **ログフォルダを開く** | 確定 | 段 1 で解決したログの出先を `desktop.OpenFolder` で開く |
| 5 | **DB のフォルダを開く** | **★候補を採った** | `filepath.Dir(dbPath)` |
| 6 | **終了** | 確定 | `desktop.Confirm` を挟み、画面とトレイ共通の終了処理(`Shutdown` → `StopTray`)を呼ぶ |
| — | exe のフォルダを開く | **★項目としては作らない** | 同じ場所は項目 3 が用途名で開く(§4.6) |

### 4.2 候補 2 件の採否は段 1 の選択で決まった(★チェックリスト G-2)

| 候補 | 採否 | 段 1 との関係 |
|---|---|---|
| **DB のフォルダを開く** | **採る** | 段 1 で採った案 A は**ログを exe の隣に置く**。DB は既定で `%APPDATA%/tacpendium/`(絶対)であり、**両者は重ならない**。⇒ 項目として意味がある。★案 B(ログも `%APPDATA%` へ)を採っていたら重なり、項目は 1 つで足りた |
| **exe のフォルダを開く** | **採らない** | 段 1 で基準を exe の位置へ寄せた結果、**exe のフォルダはログフォルダの親になった**。⇒ `M34-overview` §5.1.6-6 が「ログの基準を exe の位置へ寄せたなら、また親になる。そのときは足さない」と書いた条件に当たる |

**★この採否をテストで固定した** —— `TestBuildTrayMenu_ConfirmedItems` が項目 5 件と順序を検査し、「exe のフォルダを開く」が入っていないことも明示的に見る。

### 4.3 QR と LAN 共有(指示書 §2.3.2 / §3-3 / チェックリスト G-3・G-4)

- **トレイ側で QR は描かない。**⇒ 設定画面のネットワーク節を開くところまでである。Go の QR ライブラリと Win32 の描画ウィンドウを増やさない。
- **LAN 共有の ON / OFF による出し分けは作らない**(開発者判断・2026-09-09)。LAN が OFF のとき QR ボタンは**非描画**であり(`M22-06` が固定)、トレイから開いても QR は出ない。**これは仕様どおりである。**
- フロントの追加は `openQr?: boolean` の 1 プロパティだけで、既定は `false`。⇒ **クエリが無いときの挙動は従来と同一**である。

固定したテスト(`web/src/pages/SettingsPage.test.tsx` 3 本):

| # | 主張 |
|---|---|
| 1 | `?qr=1` で開くと `role="dialog"` が出て、その中に `lanUrl` が読める |
| 2 | クエリが無ければモーダルは出ない(ボタンだけ在る) |
| 3 | `local` モードでは `?qr=1` でも QR は出ない(出し分けを作っていない) |

**★陽性対照を測った** —— `SettingsPage` から `openQr` の受け渡しを外すと 1 本目が赤になり、戻すと緑に戻る(実測)。

### 4.5 ★ブラウザで開く URL の origin(レビュー指摘 高-2。**開発者判断待ち**)

**着手直後の実装は `127.0.0.1` を使っていた**(判断 2 の文面「ブラウザで開く URL だけを `127.0.0.1` にする」に従った)。**レビューでその帰結が指摘され、`localhost` へ戻した。**

| # | 事実 |
|---|---|
| 1 | **`localStorage` / `sessionStorage` は origin 単位である。**`http://localhost:<port>` と `http://127.0.0.1:<port>` は別 origin である |
| 2 | **着手前の `launchBrowser` と `printStartupNotice` はどちらも `localhost` を案内していた。**⇒ 既存利用者の UI 状態は `localhost` 側に在る可能性が高い |
| 3 | `127.0.0.1` へ変えると `web/CLAUDE.md` §1 台帳の**実装済み 9 キー**が見えなくなる。**★とくに `keyboard-bindings-v1`**(17 件)**は既定を持たず全件を利用者が登録する**(`D-370`)**。⇒ キーボード入力が丸ごと未割当へ戻る** |
| 4 | 着手直後の実装は **導線が 2 つに割れていた** —— `printStartupNotice` は `localhost` を案内し、自動起動とトレイは `127.0.0.1` を開いていた |

**⇒ 暫定で「着手前と同じ origin」= 失うものが無い側を採った**。3 導線(自動起動・トレイ・起動案内)が同じ origin を指すことを `TestAppURLsShareOneOrigin` が固定する(★陽性対照: 定数を `127.0.0.1` に変えると赤になることを実測)。

**★★どちらへ揃えるかは開発者の判断である** (`CLAUDE.md` §9 ハード列 = ユーザー体験に影響 ／ §10.X のブラウザストレージ台帳が絡む ／ `D-790` の文面に触れる)。**⇒ `docs/handover/followup-backlog.md` §J の `tray-browser-url-origin-choice` へ記録した**。変更は定数 `localAppHost` 1 つである。

> **★★【2026-09-12 決着】開発者の裁定 = 「`localhost` 維持」**(逐語「ブラウザで開く URL ⇒ localhost 維持」)。
>
> **⇒ 実装の変更は無い**(暫定で採っていた側がそのまま確定した)。**★`M34-overview` §5 判断 2 の文面**(「ブラウザで開く URL だけを `127.0.0.1` にする」)**は as-built と食い違うため、設計卓の側で補正が要る**(設計伝達レポート §2-1 / §6-8)。

**★判断 2 の実体(待ち受けを `127.0.0.1` へ固定しない)は守っている** —— `determineBindHost` / `determineBindAddr` は無改変である。

### 4.6 ★【2026-09-12 開発者要求】設定ファイルのフォルダを開く

**開発者の逐語**(実機確認 2 の回答)**=「ここに config.toml の場所を開くメニューも追加してもらえますか？ パスワードリセット等の時に直接いじるので、ないと困ることがわかりました。」**

| # | 事実 |
|---|---|
| 1 | **簡易パスワードを忘れたときの復旧手段は `config.toml` の手編集だけである。**`config.toml.example` のコメントが唯一の手順であり(`password_enabled = false` へ戻す ＋ `password_hash` の行を消す)、**アプリからは復旧できない** |
| 2 | 段 1 で `config.toml` の置き場は `AppBaseDir()`(配布では exe の隣)に**一意化された**。⇒ 開く先が決まった |
| 3 | **`TACPENDIUM_CONFIG_PATH` で差し替えている場合は、そちら側のフォルダを開く。**⇒ 「いま読んでいる設定ファイル」と開く先がずれない |

**★候補 6「exe のフォルダを開く」との関係を書いておく。** 開く場所は配布では同じである。それでも `M34-overview` §5.1.6-6 の判断(**ログフォルダの親だから足さない**)を覆したのではなく、**用途が別**という理由で 1 項目にした。⇒ **「exe のフォルダを開く」という項目は作らない**(同じ場所を指す項目が 2 つ出る)。`TestBuildTrayMenu_ConfirmedItems` が重複を検査する。

### 4.4 常駐ループの形

| # | 決めたこと | 理由 |
|---|---|---|
| 1 | HTTP サーバを goroutine へ、`RunTray` を **main の goroutine** で回す | `RunTray` はブロックし、メインスレッドを握る goroutine から呼ぶ契約である(`tray_windows.go` の注記) |
| 2 | **`ErrUnsupported` は致命にしない** | `SUPP-001` §5.2 の契約。非 Windows では従来どおりサーバの終了まで待つ。★致命にすると Linux/macOS でアプリが起動しなくなる |
| 3 | **アイコンを出せなかった場合も致命にしない** | ブラウザからは使えるため。⇒ 通知だけ出して常駐を続ける |
| 4 | サーバが落ちたらアイコンを畳んでエラーを返す | 黙って常駐し続けない。★通知は出さない(段 4 の `reportFatal` が唯一の致命出口。2 か所で出すと二重に出る) |

**★Linux の `go test` は「トレイが無い側」しか通らない。**⇒ 4 経路(非対応 / 終了要求 / サーバ落ち / アイコン失敗)を差し替え可能な `trayRunner` と `httpServer` で組み、`cmd/tacpendium/tray_test.go` で固定した。**これが無いと、誰かが `ErrUnsupported` を fatal にしても Linux では誰も気づけない**(Windows だけで動き、開発機で起動しなくなる)。

---

## 5. 段 4 —— 失敗時の通知経路(指示書 §2.4)

### 5.1 形

| 経路 | 実装 | 何が載るか |
|---|---|---|
| **致命(起動できない)** | `reportFatal`(`main()` の唯一の出口) | 引数エラー / 設定の読込失敗 / ポートの枯渇 / ログを作れない / サーバの異常終了 |
| **致命ではない** | `notifyProblem` | メニュー各項目の失敗 / アイコンを出せなかった / 既存インスタンスの画面を開けなかった |

どちらも `desktop.Alert` を通る(**Windows は `MessageBoxW`、他 OS は stderr** = 従来と同じ挙動)。**★標準エラーへの `fatal:` 1 行は残した** —— コンソールの在るビルド(開発 / Linux・macOS 配布)では従来どおりの手掛かりであり、消す理由が無い。

### 5.2 メニュー項目の失敗も同じ経路に載っている(★チェックリスト C-2)

`buildTrayMenu` は 4 項目すべての失敗を `Notify` へ渡す。`TestBuildTrayMenu_FailuresAreNotified` が **4 件すべてで通知が出ること**と、**通知の表題が項目名と一致すること**を固定する。**★「黙って何も起きない」が最悪である** —— ブラウザもファイラも起動して待たないため、失敗しても例外は出ず、利用者からは「選んでも何も起きない」に見える。

### 5.3 破壊確認(★指示書 §2.4 / チェックリスト C-1)

**要求 = わざと起動を失敗させて、通知が出ることを実測すること。**

ポート探索範囲(`47411`〜`47430`、`netutil.DefaultPortScanRange` = 20)を **25 ポート占有**してから実バイナリを起動した。

```
occupied 25 ports
exit=1
fatal: listen: netutil: no available port in range 47411-47430: listen tcp 127.0.0.1:47430: bind: address already in use
[Tacpendium を起動できませんでした] listen: netutil: no available port in range 47411-47430: listen tcp 127.0.0.1:47430: bind: address already in use
```

**⇒ 2 行目が本段で足した経路である**(`[表題] 本文` は非 Windows の `desktop.Alert` の形。Windows では同じ内容が `MessageBoxW` になる)。

**★Linux では `MessageBox` そのものは出ない。**⇒ **ダイアログが実際に出ることの確認は実機確認 §5-4 に残る**(指示書 §5 の 4 番)。ここで確かめたのは「失敗が `desktop.Alert` へ到達すること」であり、そこから先は `M34-01` で受理済みの `MessageBoxW` 実装である。

### 5.4 ログへ書く経路が生きていること(★指示書 §2.4-3)

**標準出力が消える前に**確かめた。上の失敗が **exe の隣のログファイル**にも入っている。

```json
{"level":"ERROR","msg":"Tacpendium を起動できませんでした",
 "err":"listen: netutil: no available port in range 47411-47430: …"}
```

**⇒ 段 1 の成果(出先が一意)と段 4 の成果(伝わる)が、同じ 1 回の実測で噛み合っていることを確かめた。**

---

## 6. 段 5 —— GUI サブシステムであることの機械的な確認(★指示書 §2.5-2 / チェックリスト D-1)

### 6.1 形

| 場所 | 中身 |
|---|---|
| `Makefile` | `WINDOWS_GUI_LDFLAGS := -H=windowsgui` を **1 か所**に定義し、`build-windows` から参照する。★他のターゲットへは広げない(Linux / macOS のリンカは解釈しない) |
| `cmd/tacpendium/windows_gui_link_test.go` | **`Makefile` から同指定を読み**、`GOOS=windows GOARCH=amd64` で実際にリンクし、**`debug/pe` で PE の Subsystem を判定する**(`2` = GUI) |

**★「窓が出なかった」を完了条件にしない**(指示書 §6-2)。判定は PE ヘッダの値である。**★正本は `Makefile` 1 か所**であり、テストがそこを読むので二重管理にならない。

### 6.2 陽性対照(★同じテストの中に持たせた)

| 実行したもの | 結果 |
|---|---|
| 本番の指定でリンク | **Subsystem = 2(GUI)** → 緑 |
| **指定を外してリンク**(テスト内の対照) | **Subsystem = 3(CUI)** → 緑(= 判定がフラグを見ている証拠) |
| `Makefile` の値を空にする | **赤**: `Makefile の WINDOWS_GUI_LDFLAGS に -H=windowsgui が無い: ""` |
| `Makefile` の行を消す | **赤**: `Makefile に WINDOWS_GUI_LDFLAGS の行が無い。⇒ 黒窓が復活する変更である` |
| 戻す | 緑 |

**⇒ 「門を置いた」ではなく「門が効く」を測った**(`M34-01` がサイズガードで実演したのと同じ形)。**★本テストは PR CI の `go test ./...` で毎回走る**(所要は約 2 秒。パッケージのコンパイル結果はキャッシュされ、2 回目はリンクのみ)。

### 6.3 `make check-windows` は引き続き緑(★チェックリスト D-2)

実測で緑。**★同ターゲットには `-ldflags` を足していない**(D-3)。理由 = 同ターゲットの役目は「Windows 専用ファイルがコンパイルできること」であり、リンクの形はサブシステム検査の担当だからである。

### 6.4 `scripts/build-windows.ps1` は移植しない(★チェックリスト F-2 / followup `porting-target-layer-c-collision`)

**`scripts/**` は `REUSE.toml` の層 C(`MIT`)である。**⇒ 層 A(`AGPL-3.0-or-later`)であるべき移植物をそこへ置くと、ライセンスの層が変わる。**移植そのものを行わない**ことで回避した(指示書 §2.5-4 は「移植するなら」という条件付きの要求である)。同スクリプトの役目は 2 つ(黒窓を出さないビルド指定 ／ 成果物の検証)であり、**どちらも `Makefile` と上記テストが担っている。**

`REUSE.toml` の差分は **0 行**(§7)。

---

## 7. 段 6 —— 仕上げ 4 件

### 7.1 二重起動の判別(`M34-overview` §4.4)

| # | 決めたこと |
|---|---|
| 1 | 既定ポートの `/api/health` を **700ms の上限**で叩く。★起動のたびに必ず通る経路なので短く保つ |
| 2 | **同一アプリと判定する条件は 3 つ** = 200 ／ `status == "ok"` かつ `version` が空でない ／ **未知のキーを許さない**(`DisallowUnknownFields`)。⇒ 別のソフトが偶然 200 を返しただけで「同じアプリ」と読まないため |
| 3 | 見つけたら**その画面を開いて `exit 0` で退く。**★フィードバックは「既存の画面が開くこと」そのものなので、`MessageBox` は出さない(正常な結果である)。開けなかったときだけ通知する |
| 4 | **ロガー初期化とデータディレクトリ移行より前**に置いた。⇒ 後から起動したプロセスは何にも触らずに退く |

**★残る限界を隠さない** —— `/api/health` の応答にアプリ名が入っていないため、**同じ 2 キーだけを返す別のソフトがそのポートに居た場合は区別できない**。⇒ 応答へ識別子を足すのは API 契約の変更(CHANGE)であり、本サブでは踏み込まなかった。§8 の候補へ挙げた。

**実測**(実バイナリ 2 本):

```
--- 1 本目 health ---  {"status":"ok","version":"0.1.0"}
--- 2 本目を起動 ---   second exit=0
INFO  another instance is already running; opening its window instead url=http://127.0.0.1:47411/
ERROR Tacpendium は既に起動しています err="… を開けませんでした: exec: \"xdg-open,…\": executable file not found in $PATH"
[Tacpendium は既に起動しています] http://127.0.0.1:47411/ を開けませんでした: …
```

⇒ 2 本目が 1 本目を見つけて退いた。**ブラウザが無いコンテナなので、開けなかったことが通知経路(§5)から出ている**(この環境ではこれが正しい振る舞いである)。

**★E2E への影響を書いておく** —— 前回の E2E バックエンドが専用ポートに残っていた場合、2 本目は即座に `exit 0` する。⇒ `playwright` の `webServer` はコマンドの終了を検出して明示的に失敗する(従来は次のポートへ逃げて、`playwright` が古いプロセスを相手にし続けた)。**どちらも壊れた状態だが、新しい方が早く失敗する。**

### 7.2 終了確認

段 3 で入れた共通の終了処理(`Shutdown(5s)` → `StopTray`)を、トレイの「終了」が `desktop.Confirm` を挟んで呼ぶ。`sync.Once` で二重実行を防いでいる。

**★画面側の終了ボタンは作っていない**(§9)。`M34-overview` §1-6 は「画面内の終了ボタン、または アイコンの右クリックメニューから」と書いているが、**停止用の HTTP ルートは実装に存在せず**、外から停止できる口を新設するのは認証・LAN 共有と絡む設計判断である。⇒ 指示書 §2.6-2 が求める「共通の終了処理」は関数として用意し、呼び手が 1 つ(トレイ)である状態にした。

### 7.3 起動案内の文面(followup `startup-notice-text-stale-on-tray`)

`printStartupNotice` の末尾を**出し分け**にした。

| 条件 | 文面 |
|---|---|
| トレイの在る OS(Windows) | ` 終了するには通知領域のアイコンを右クリックし、「終了」を選んでください。` |
| トレイの無い OS(Linux / macOS 配布) | ` 終了するにはこのウィンドウを閉じてください。`(**従来のまま。そちらでは今も正しい**) |

**★一律に書き換えなかった理由** —— 非 Windows の配布ビルドにはトレイが無く(`RunTray` が `ErrUnsupported`)、**端末で動いて窓を閉じて止めるのが実際の使い方**である。⇒ 「常駐しているから窓を閉じるな」は Windows だけの事実である。

判定 `trayResident()` は `runtime.GOOS` で持つ。**権威ある信号(`ErrUnsupported`)は `RunTray` がブロックしてからしか得られない**ため、案内を出す時点では使えない。⇒ 境界がずれないことを `TestTrayResidentMatchesDesktopContract` が非 Windows 側で突き合わせる(`trayResident() == false` なら `RunTray` は `ErrUnsupported` を返す)。

### 7.4 ブラウザ起動の一本化(★followup `browser-launch-duplication`)

**`desktop.OpenURL` が `ValidateURL` を通したうえで `github.com/pkg/browser` へ委譲する形にした**。自前の `rundll32` 実装と `browserCommand`(OS ごとのコマンド組み立て)は撤去した。

| # | 内容 |
|---|---|
| 1 | **`ValidateURL` は捨てていない**(★チェックリスト E-3)。委譲の前に必ず通る。回帰テスト `TestOpenURLKeepsTheValidateURLGate` が `file:` / `javascript:` / `ftp:` / ホスト無し / 空を拒否することを固定する |
| 2 | **移植元の選定理由は本体では成立しない**。移植元は「`cmd /c start` だと黒窓が一瞬出る」を理由に自前実装を選んだが、`pkg/browser` の Windows 実装は `ShellExecute` である(実測: `browser_windows.go` は `windows.ShellExecute(...)` 1 行)。⇒ 移植元が外部依存 0 本のリポジトリだったという前提が効いていた |
| 3 | `internal/desktop` のパッケージ doc の「Go 標準ライブラリのみ」を**実態へ是正した**。★撤回済みの記述をコード上に残さない |
| 4 | `launchCmd.HideWindow` は残した。**現在 `true` を立てる呼び手は無い**が、「explorer を隠してはならない」という 2026-08-04 の実機知見をこの `false` が型で保っている(回帰テスト `TestFolderCommandNeverHidesWindow` が対応する)。⇒ 残す理由をフィールドの doc に書いた |

**呼び出し箇所の全数**(実測):

```
$ grep -rn "pkg/browser" --include=*.go .        # 注記を除く import は 1 か所
internal/desktop/desktop.go   ← 唯一の import
(他 5 件はすべてコメント本文での言及)

$ grep -rn "OpenURL(" --include=*.go cmd/ internal/ | grep -v _test
cmd/tacpendium/notify.go   : var desktopOpenURL = desktop.OpenURL   ← 差し替え口(テスト用)
cmd/tacpendium/main.go     : launchBrowser → desktopOpenURL(accessURL)
cmd/tacpendium/main.go     : trayDeps.OpenURL = desktopOpenURL
cmd/tacpendium/instance.go : openExistingInstance → desktopOpenURL
internal/desktop/desktop.go: func OpenURL(...)                      ← 実装
```

**⇒ 起動時 / トレイ / 二重起動の 3 つの呼び手が 1 本を通る。**

**`go.mod` / `go.sum` の差分**(★チェックリスト F-1):

```
$ git diff --stat 0660fa2 -- go.mod go.sum | wc -l
0
```

**0 行である。**`pkg/browser` は元から direct 依存(BSD-2-Clause)であり、**依存は増えていない**。版を固定する仕組み(`replace` / `toolchain` / `pnpm.overrides`)も足していない。

---

## 8. 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | CHANGE 番号の登録(`docs/handover/change-number-registry.md` §1 ほか 4 か所) | **不要**。本サブの CHANGE 消費は 0 本であり、番号を払い出していない(★起票は設計卓 = `D-293`)。⇒ 設計書へ反映が要る事項は下の「CHANGE 候補」として請求だけ残す |
| 2 | マイグレ連番(ボード §2.2) | **不要**。マイグレ消費 0 本。`migrations/` に触れていない |
| 3 | 版を上げた文書の参照元 | **不要**。設計書・指示書の版を 1 つも上げていない |
| 4 | `REUSE.toml` | **不要であることを確かめた**。差分 0 行(`git diff --stat 0660fa2 -- REUSE.toml` が空) |
| 5 | `scripts/public-snapshot-manifest.txt` | **不要であることを確かめた**。`check-public-snapshot.sh` が manifest 無変更のまま緑(母数 2954 / 公開 2925 / 除外 29) |
| 6 | `web/CLAUDE.md` §1 のブラウザストレージ台帳 | **不要**。ストレージキーを 1 つも足していない(`check-browser-storage-keys.sh` 緑)。★`?qr=1` は URL クエリであり保存しない |
| 7 | `docs/progress/progress-log.md` | **追記した**(Phase D。★`check-progress-log-index.sh` が緑になることを確認済み。**レビュー指摘 高-5 の是正**——本欄は当初、追記前に過去形で書かれていた) |

### CHANGE 候補(★起票は設計卓。設計伝達レポート §4 へ回すもの)

| # | 対象 | 内容 |
|---|---|---|
| 1 | `SUPP-001` §5.8 / `DES-002` | **相対パスの解決基準を明文化する。**`config.toml` は元から「アプリ実行ディレクトリ直下」と書かれており本サブはそれに寄せただけだが、**`logging.file` の相対値の基準**は「実行時 CWD 配下」と書かれている(§5.8 のパス検証ポリシー・`CHANGE-049` 由来)。⇒ as-built は「アプリ本体の在るフォルダ基準(開発時のみ CWD)」である |
| **1b** | `SUPP-001` §5.8(`CHANGE-049` の系) | **★★これは明文化ではなく、パス検証の許可ルートの拡張である**(レビュー指摘 中-9)。`ValidateDataPath` が絶対パスを許すルートへ `AppBaseDir()` が 1 つ増えた。同検証は **LAN モードの未認証 `PUT /api/config` 経由の破壊的パス植え込みも封止対象**としている。⇒ 実害の増分は「ショートカットの作業フォルダが exe と別の場所」のときだけだが(ダブルクリック起動では着手前から許可されていた)、**セキュリティ検証の範囲変更として起票すること**(`CLAUDE.md` §10) |
| 2 | `SUPP-001` §5.2 | **`internal/desktop/` の公開 API の注記へ 1 行足す** = `OpenURL` の実際の起動は `github.com/pkg/browser` へ委譲する(`ValidateURL` は内部で通す)。★現行の注記は「既定ブラウザで開く」までしか書いていない |
| 3 | `DES-002` / `SUPP-001` | **常駐の as-built** = 通知領域アイコンのメニュー 5 項目 ／ 二重起動の判別(`/api/health` の厳密一致) ／ 終了は `Confirm` → `Shutdown` → `StopTray` ／ 起動オプションは受け取らない(未知の引数はエラー) |
| 4 | `DES-001` / `SUPP-001` | **`build-windows` は `-H=windowsgui` でリンクする**(配布物は GUI サブシステム)。★検査は `cmd/tacpendium/windows_gui_link_test.go` |
| 5 | `M32`(説明書・`README`) | **§1.5 の移行手順**(ショートカットの作業フォルダを変えていた利用者向け)と、「**終了は通知領域のアイコンから**」を載せること。★`M34-overview` §0-2 が「説明書の負債になる」と書いた箇所である |
| 6 | `SUPP-001` §5.2 | `cmd/tacpendium` の構成に本サブが足したファイル(`args.go` / `tray.go` / `notify.go` / `instance.go`)。★`M34-01` の請求(`internal/desktop/` を §5.2 へ)と同じ型である |
| **7** | `docs/handover/followup-backlog.md` §CI | **★5 件はすべて本サブで畳んだが、状態列は「未着手」のままである**。製造は同ファイルの §J しか書けない(`D-382`)。⇒ **状態更新を設計伝達レポート §4 で請求する**(レビュー指摘 低-7) |
| **8** | `M34-overview` / 設計卓の確認 | **★画面側の終了ボタンを持たないまま `M34` を閉じてよいか**(レビュー指摘 中-11)。★`M34-overview` §1-6 は「画面内の終了ボタン、**または** アイコンの右クリックメニューから」と *または* で書いているため要求としては満たせているが、**`M34` は 2 段構成で本サブで閉じる** |

---

## 9. 射程外として手を付けなかったもの

| # | 何を | なぜ |
|---|---|---|
| 1 | 待ち受けを `127.0.0.1` へ固定すること | **判断 2 で決着している**(`D-790`)。`determineBindHost` / `determineBindAddr` は**無改変**(★チェックリスト F-4)。⇒ **ブラウザで開く URL の origin は §4.5 の未決事項**であり、暫定で着手前と同じ `localhost` に揃えている |
| 2 | Windows 起動時の自動起動(スタートアップ登録) | 指示書 §3-2。レジストリを触り、アンインストール時の後始末が要る |
| 3 | トレイ側で QR を描くこと | 指示書 §3-3。新規依存 0 件の前提が崩れる |
| 4 | LAN 共有の ON / OFF をトレイへ置くこと | 指示書 §3-4。画面側に既に在る |
| 5 | `REUSE.toml` の書き換え | 指示書 §3-5。層 A は既定で解決される |
| 6 | バルーン通知・アイコンのアニメーション | 指示書 §3-6 / `M34-01` が「持たせなかったもの」として明記している |
| 7 | `AttachConsole`(`cmd/movestool/console_windows.go` 相当) | **要らない。**`M34-01` 実査 1 より本体に CLI サブコマンドが無く、コンソールへ書き戻す用途が無い(`M34-01` §9-3 が「要否そのものが `M34-02` の判断」としていた) |
| 8 | `scripts/build-windows.ps1` の移植 | §6.4。層 C の衝突を避け、役目は `Makefile` とテストへ寄せた |
| 9 | 画面側の終了ボタン(停止用の HTTP ルート) | §7.2。実装に存在せず、新設は認証・LAN 共有と絡む設計判断である |
| 10 | `database.path` が**相対**のときの解決基準 | **段 1 の射程外とした**。既定は絶対へ解決されるため本サブが塞いだ害(利用者の設定が黙って無視される)に当たらず、`M28-01` のデータディレクトリ移行判定(`prepareDataDirWith` の `SamePath` 比較)に手を入れる危険が大きい。⇒ §10 の横断課題へ |
| 11 | 設定画面に「ログの実際の出先」を出すこと | 画面は `logging.file` の生の値(相対)を見せている。⇒ 実際の出先は「ログフォルダを開く」で足りる。表示を変えるなら応答 DTO の追加であり CHANGE が要る。§10 の横断課題へ |
| 12 | `debug` ビルドを GUI サブシステムにするか | **しない。**`build-debug` は開発時の入口であり、コンソールが要る(`M34-overview` §4.2 が決めることとしていた項目。⇒ 「コンソールのまま残す」を採った) |

---

## 10. 横断課題(他サブ・他マイルストーンへ波及するもの)

| # | 課題 | 宛先 |
|---|---|---|
| 1 | **`database.path` の相対値だけがカレントディレクトリ基準のまま残っている**(§9-10)。★既定(空)では絶対へ解決されるため通常は当たらないが、利用者が相対で指定すると起動経路ごとに DB の場所が動く。⇒ 直すなら `M28-01` の移行判定と併せて見る必要がある | 改善レーン / 設計卓 |
| 2 | **`/api/health` にアプリ識別子が無い**(§7.1)。⇒ 二重起動の判別が「2 キーだけを返す別のソフト」と区別できない。応答へ `app` 相当を足すのは API 契約の変更である | 設計卓(CHANGE 候補) |
| 3 | **`scripts/check-import-order.sh` がベースラインより 2 ファイル少ないと報告する**(`現在 99 / ベースライン 101`)。★本サブの変更由来ではない(本サブが触った本番ファイルは違反リストに載っていない)。⇒ スクリプト自身が「BASELINE を 99 へ下げること」と促している | 改善レーン |
| 4 | **派生資料 3 件が陳腐化疑いである**(`code-facts` 21% / `docs-map` 13% / `custom-commands` 38%)。★本サブは `internal/desktop` の呼び手を初めて作ったので `code-facts` の該当節は実物と食い違う。⇒ 再生成はマイルストーン境界の手番 | 改善レーン / 境界の手番 |
| 5 | **クラウド実行環境の `markdown-it-py`** は本セッションでは導入済みで、`check-artifact-integrity.sh` は緑だった。★`M34-01` の横断課題 2 と同じ環境依存であり、素のクローンでは再発する | 改善レーン(既知) |
| **6** | **★★★ブラウザで開く URL の origin は開発者判断が要る(未決)** 。`localStorage` は origin 単位であり、`127.0.0.1` へ揃えると既存利用者の UI 状態(**`keyboard-bindings-v1` 17 件は既定を持たない**)が消える。⇒ 暫定で着手前と同じ `localhost` に揃えた。**変更は定数 1 つ**。記録は §J の `tray-browser-url-origin-choice` | **開発者** |
| **7** | **★★`appDataRoots()` の許可ルートが 1 つ増えた**(`AppBaseDir()`)。⇒ `CHANGE-049` の**パス検証の許可範囲の拡張**である(§8 の候補 1b) | 設計卓(CHANGE 候補) |
| **8** | **★★画面側の終了ボタンを持たないまま `M34` を閉じてよいか**(§8 の候補 8)。⇒ 停止用の HTTP ルートは実装に無く、新設は認証・LAN 共有と絡む | 設計卓 |
| **9** | **★★束 C-1(`MessageBox` が実際に出ること)と 束 D-1(配布 exe で黒窓が出ないこと)は Windows 実機でしか最終判定できない。⇒ `M34` を閉じる判断は実機確認の結果を待つこと**(レビュー指摘 中-6) | 開発者(実機確認) |
| **10** | **★`followup-backlog.md` §CI の 5 件の状態更新**(製造は §J しか書けない = `D-382`) | 設計卓(設計伝達レポート §4) |
| **11** | **★`launchCmd.HideWindow` に `true` を立てる呼び手が 0 になった**(ブラウザ起動の委譲による)。⇒ 「隠すべきヘルパは隠す」側の検査が無い状態である。★Linux では `spawn` が同フィールドを無視するためテストで守れない。**フィールドを残す判断とセットでの申し送りである**(レビュー指摘 低-2) | 次に `spawn` を使う手番 |
| **12** | **★二重起動の判別の記録はファイルログに残らない。**`applog.Init` より前に置いているためである(**何にも触らずに退く**ための位置であり、動かさない)。⇒ 二重起動が疑われる問い合わせでは、ログに手掛かりが 1 行も無い(レビュー指摘 低-6) | 改善レーン |

---

## 11. 変更統計と自己検査

```
$ git diff --stat 0660fa2   # Phase C 取り込み後(最終)
 Makefile                                           |  24 +-
 cmd/tacpendium/args.go                             |  45 ++
 cmd/tacpendium/args_test.go                        |  39 ++
 cmd/tacpendium/instance.go                         |  98 ++++
 cmd/tacpendium/instance_test.go                    | 140 +++++
 cmd/tacpendium/main.go                             | 184 +++++-
 cmd/tacpendium/main_test.go                        |  82 ++-
 cmd/tacpendium/notify.go                           |  55 ++
 cmd/tacpendium/notify_test.go                      |  65 +++
 cmd/tacpendium/tray.go                             | 191 +++++++
 cmd/tacpendium/tray_test.go                        | 409 ++++++++++++++
 cmd/tacpendium/windows_gui_link_test.go            | 157 ++++++
 docs/handover/followup-backlog.md                  |   1 +
 docs/progress/M34-02-completion-report.md          | 621 +++++++++++++++++++++
 docs/progress/m34-02-review.md                     | 299 ++++++++++
 docs/progress/progress-log.md                      |  13 +
 internal/config/basedir.go                         |  88 +++
 internal/config/basedir_test.go                    |  72 +++
 internal/config/config.go                          |  26 +-
 internal/desktop/desktop.go                        |  66 ++-
 internal/desktop/desktop_test.go                   |  45 +-
 internal/infra/log/log.go                          |  13 +-
 internal/infra/log/log_test.go                     |  73 +++
 web/src/features/config/SettingsSectionNetwork.tsx |  17 +-
 web/src/pages/SettingsPage.test.tsx                |  35 +-
 web/src/pages/SettingsPage.tsx                     |  13 +-
 26 files changed, 2781 insertions(+), 90 deletions(-)
```

**★新規ファイル 14 件はすべて `+N -0` である**(教訓 `E-225` の観点で読んだ。`git diff --numstat` で実測)。

```
$ git diff --numstat 0660fa2   # 新規 14 ファイル(すべて deletions 0)
 45 / 0  cmd/tacpendium/args.go              140 / 0  cmd/tacpendium/instance_test.go
 39 / 0  cmd/tacpendium/args_test.go          55 / 0  cmd/tacpendium/notify.go
 98 / 0  cmd/tacpendium/instance.go           65 / 0  cmd/tacpendium/notify_test.go
191 / 0  cmd/tacpendium/tray.go              409 / 0  cmd/tacpendium/tray_test.go
157 / 0  cmd/tacpendium/windows_gui_link_test.go
 88 / 0  internal/config/basedir.go           72 / 0  internal/config/basedir_test.go
 73 / 0  internal/infra/log/log_test.go
621 / 0  docs/progress/M34-02-completion-report.md
299 / 0  docs/progress/m34-02-review.md
```

**deletions 83 行の内訳は、すべて意図した既存ファイルの書き換えである。**★とくに `internal/desktop/desktop_test.go` からは**テスト 2 本を意図して外した**(`TestBrowserCommandPerOS` / `TestBrowserCommandValidates` = 撤去した `browserCommand` の検査)。⇒ 代わりに `TestOpenURLKeepsTheValidateURLGate` を置き、**関門の検査は残した**。

### 実行した検査

| 検査 | 結果 |
|---|---|
| `go build ./...` / `go vet ./...`(Linux) | 緑 |
| `go test -count=1 ./...` | 緑(**FAIL 0 件**) |
| `go test -count=1 -race ./cmd/tacpendium/` | 緑(常駐ループは goroutine を持つため) |
| `make check-windows` | 緑 |
| `gofmt -l cmd internal` | 出力なし |
| `cd web && pnpm exec tsc --noEmit` | 出力なし |
| `cd web && pnpm test -- --run` | **224 ファイル / 2674 件すべて緑** |
| `make e2e-only P=character-default` | **2 passed**(起動経路を変えたため確認) |
| `scripts/check-artifact-integrity.sh` | 違反なし(★1 本目に回した) |
| `scripts/check-public-snapshot.sh` | 違反なし(manifest 無変更) |
| `scripts/check-migration-license.sh` | 違反なし |
| `scripts/check-browser-storage-keys.sh` | 違反なし |
| `scripts/check-doc-refs.sh` | dead reference なし |
| `scripts/check-enum-sync.sh` | ベースラインどおり(増加なし) |
| `scripts/check-import-order.sh` | 違反なし(★§10-3 の注記) |
| `scripts/check-doc-inventory.sh` | 型に無いファイルなし |
| `scripts/check-md-emphasis.sh <本報告>` | §13 に記載 |

---

## 12. 推測で進めた箇所(★自己判断の記録)

| # | 推測・自己判断 | 確認方法 |
|---|---|---|
| 1 | **推測: 実行ファイルの祖先に `go-build*` が在るときはカレントディレクトリを基準にする**(§1.2)。指示書は「基準を一意にする」までしか書いておらず、開発時の扱いは書いていない。⇒ 倒さないと `make run-server` と worktree のポート分離が壊れるため、こちらを採った | 単体テスト(実測値 3 形)＋ `go run` の実挙動 ＋ `make e2e-only` |
| 2 | **推測: `config.toml` の不在は今までどおり既定値で続行し、WARN を 1 行出すだけにする**(§1.4)。指示書 §2.1.2-4 が「変えない判断でもよいが理由を書くこと」としている | 実機で WARN が出ることを実測(§2-b) |
| 3 | **推測: 二重起動の判別は配布ビルド限定にせず常時有効にした**(§7.1)。受領方式に条件が書かれていないため素直に採った。⇒ 開発時に 2 本目を起こすと退くようになる(従来はポート探索で別ポートへ逃げていた) | `go test` ＋ 実バイナリ 2 本の実測 |
| 4 | **推測: 書けない場所に置かれたときの `%APPDATA%` フォールバックは作らない**(§1.1)。⇒ 逃げると基準が一意でなくなる。段 4 の通知が入ったので、書けないことは見える | `log: mkdir` 失敗が `reportFatal` を通る経路は §5.1 の形と同一 |
| 5 | **推測: 起動案内の終了文面はトレイの有無で出し分ける**(§7.3)。一律に書き換えると非 Windows 配布で嘘になる | `TestPrintStartupNotice_ExitHintFollowsTray` ／ `TestTrayResidentMatchesDesktopContract` |
| 6 | **推測: `launchCmd.HideWindow` は呼び手が居なくなっても残す**(§7.4-4) | フィールド doc に理由を書き、回帰テストが対応する。★「隠す側」の検査が無いことは §10-11 へ申し送った |
| 7 | **判断: `-h` も `exit 1` にする**(レビュー指摘 低-4)。本アプリは起動オプションを取らないので `-h` は「引数の誤り」の 1 形であり、**致命の出口を 1 本に保つほうが `-H=windowsgui` 下で確実に伝わる**。★`exit 0` にすると「受け付けた」と読める | `TestParseArgs` が `-h` を拒否側で固定している |
| 8 | **判断: `?qr=1` は URL から落とさない**(レビュー指摘 低-5)。ディープリンクであり、リロードで同じ画面へ戻るのが素直である。★落とすと履歴を書き換えることになる | `SettingsPage` のコメントに理由を書いた |

---

## 13. レビュー結果と取り込み(Phase C)

| 項目 | 内容 |
|---|---|
| レビュー報告書 | `docs/progress/m34-02-review.md` |
| 指摘件数 | **19 件**(高 5 / 中 7 / 低 7) |
| **「高」指摘の不採用** | **0 件**(5 件すべて採用した) |
| 再レビュー往復 | **0 回**(上限 2 回に対して未使用) |
| 束別の判定 | A ◎ / B ○ / C ○ / **D △** / E ◎ / F ◎ / G ◎ |
| `check-md-emphasis.sh` | 本報告・レビュー報告書とも**検出 0 行**(ファイル引数モード) |

### 高(5 件・すべて採用)

**★5 件のうち 3 件は「失効した記述がコード上に残っている」型である**。移植物を初めて呼ぶ手番として想定どおり出やすい面だった(`M34-01` も高 4 件すべてがこの型だった)。

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 高-1 | `OpenURL` の godoc 1 行目「子プロセスを spawn したらすぐ返る / 待たない」が委譲後に不成立。実測で `pkg/browser` は Linux/macOS が `cmd.Run()`(**子の終了を待つ**)、Windows が `ShellExecute`(**子プロセスを spawn しない**) | **採用** | godoc を実態へ書き直し、**OS ごとにいつ返るかを明記**した。あわせて呼び手 3 つの扱い(トレイと `launchBrowser` は待たない形、`openExistingInstance` だけ同期)も書いた。★`OpenFolder` の godoc は `spawn` を使い続けているので今も正しい —— **片方だけが失効していた** |
| 高-2 | 自動起動 URL を `localhost` → `127.0.0.1` へ変えたことで **origin が変わり**、`web/CLAUDE.md` §1 台帳の 9 キーが既存利用者から消える。かつ起動案内は `localhost` のままで**導線が 2 origin に割れている** | **採用** | **`localhost` へ戻し、3 導線を同じ origin へ揃えた**(§4.5)。`TestAppURLsShareOneOrigin` で固定し、定数を `127.0.0.1` にすると赤になることを実測。**★どちらへ揃えるかは開発者の判断**であり、`followup-backlog.md` §J の `tray-browser-url-origin-choice` へ記録した |
| 高-3 | `args.go:24` が存在しない識別子 `notifyFatal` を参照(実体は `reportFatal`) | **採用** | 直した。`grep -rn "notifyFatal" --include=*.go .` は **0 件**になった |
| 高-4 | **束 D-1 の門が配布物を守っていない** —— 検査は `Makefile` の変数の値だけを読み、`build-windows` レシピが `-ldflags="$(WINDOWS_GUI_LDFLAGS)"` を渡していることを見ない。⇒ レシピから落とすと黒窓が復活するのに `go test` は緑 | **採用** | レシピ行の検査(`assertRecipePassesLdflags`)を足した。**★陽性対照を実測**——レシピから `-ldflags=` を落とすと**赤**(「`build-windows` が `$(WINDOWS_GUI_LDFLAGS)` を渡していない」)、戻すと緑。あわせて `Makefile` のコメントを「赤くなるのは 3 通り」へ書き直した(**門の範囲の過大な記述**も失効記述である) |
| 高-5 | `progress-log.md` への追記が無く `check-progress-log-index.sh` が違反 1 件。かつ本報告 §8 が「追記した(Phase D)」と**過去形で**書いていた | **採用** | Phase D で索引行を追記し、同検査が**緑**になることを確認した(`検査した 89 件すべてが progress-log に現れる`)。§8 の行も実態に合わせた。**★`D-510` が禁じた「レビュー前に断定を書く」と同じ型を、本サブは別の欄でやっていた** |

### 中(7 件・すべて採用)

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 中-6 | 束 C-1 と D-1 の「実物側」は実機確認待ちである(記録のみ) | **採用(記録)** | §5.3 / §14 で開示済みの内容だが、**`M34` を閉じる判断は実機結果を待つ**ことを §10 の横断課題へ格上げした |
| 中-7 | `runResident` の `case err == nil:` が「`quit` が既に走った」前提。`RunTray` は WM_QUIT で nil を返し、**WM_QUIT は `StopTray` 以外からも来る**(ログオフ等) ⇒ `<-done` で永久ブロックし、窓もアイコンも無い状態でプロセスが残る | **採用** | 同分岐で `quit()` を呼ぶ(`sync.Once` で冪等)。**★回帰テストを足し、陽性対照を実測**——`quit()` を外すと `TestRunResident_QuitIsCalledWhenTheLoopEndsOnItsOwn` が **5 秒のタイムアウトで赤**、戻すと緑 |
| 中-8 | アイコンを出せなかったとき、コンソール窓・アイコン・画面の終了ボタンのどれも無く、**利用者に止める手段が残っていない**のに文面に案内が無い | **採用** | 通知本文へ「ブラウザから使える URL」と「終了はタスク マネージャー」を足した。`runResident` は `appURL` を受け取る形にした |
| 中-9 | `appDataRoots()` への `AppBaseDir()` 追加は **`CHANGE-049` のパス検証(セキュリティ封止)の許可範囲の拡張** であり、報告は「明文化」として扱っている | **採用** | §8 の CHANGE 候補 1 を「**許可ルートを 1 つ増やした**」として書き直し、§10 の横断課題へも上げた。**★`CLAUDE.md` §10「セキュリティ関連の自己判断」に当たる面である** |
| 中-10 | 二重起動の判別が `health.Response` の形と暗黙結合しているのに、テストは手書きリテラル JSON。⇒ フィールドが 1 つ増えると**自分自身を認識できなくなる**のに全緑 | **採用** | デコード先を **`healthapi.Response` そのもの**に変え、実ハンドラの応答で固定するテストを足した。**★結果として失敗モードごと消えた**——実測で `Response` へフィールドを 1 つ足しても判別は成立したままだった(型が追随するため)。⇒ 「検出できるようにした」ではなく「起こらなくした」である |
| 中-11 | **画面側の終了ボタンを持たないまま `M34` を閉じてよいか**が設計卓の確認事項なのに、報告は §9(射程外)へ置いただけで行き先が無い | **採用** | §10 の横断課題へ上げ、設計伝達レポート §4 へ回す |
| 中-12 | `ValidateDataPath` の拒否メッセージと godoc から**カレントディレクトリの言及だけが落ちた**(実装は 4 ルートを許可している) | **採用** | メッセージと godoc の両方へ戻した |

### 低(7 件・すべて採用)

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 低-1 | `printStartupNotice` の godoc が `ensureDefaultPresetExists` に貼られている(**着手前からの不整合**)。本サブは同関数へ第 5 引数を足したのに説明を書く場所が無い | **採用** | godoc を同関数へ貼り直し、第 5 引数を説明した |
| 低-2 | `HideWindow = true` 側の検査が消えた(委譲で `true` を立てる呼び手が 0 になった) | **採用(申し送り)** | コードは変えない。**フィールドを残す判断とセットで §10 の横断課題へ申し送った。**★Linux では `spawn` が `HideWindow` を無視するためテストで守れない |
| 低-3 | `TestRunResident_TrayFailureIsNotNotFatal` が二重否定で読めない | **採用** | `TestRunResident_TrayFailureIsNotFatal` へ改名 |
| 低-4 | `-h` でも `exit 1` になる。意図なら報告へ 1 行 | **採用(記録)** | **意図である**。理由 = 本アプリは起動オプションを取らないので `-h` は「引数の誤り」の 1 形であり、致命の出口を 1 本に保つほうが `-H=windowsgui` 下で確実に伝わる。★`exit 0` にすると「受け付けた」と読める |
| 低-5 | `?qr=1` を URL から落としていない(リロードでまた QR が開く) | **採用(記録)** | **意図である**。ディープリンクなのでリロードで同じ画面へ戻るのが素直であり、落とすと履歴を書き換えることになる。⇒ その旨を `SettingsPage` のコメントへ書いた |
| 低-6 | 二重起動の判別の記録が**ファイルログに残らない**(`applog.Init` より前に置いたため) | **採用(申し送り)** | 位置は変えない(**何にも触らずに退く**ためにロガー初期化より前で判定する必要がある)。⇒ **この経路だけログに残らないことを §10 の横断課題へ申し送った** |
| 低-7 | `followup-backlog.md` §CI の 5 件が「未着手」のまま(製造は同ファイルの §J しか書けない) | **採用** | §8 の CHANGE 候補 / §10 の横断課題へ「§CI の 5 件の状態更新」を明示して請求した |

### 取り込み後の再検証

| 実行したもの | 結果 |
|---|---|
| `go build ./...` / `go vet ./...` | 緑 |
| `go test -count=1 ./...` | 緑(**FAIL 0 件**) |
| `make check-windows` | 緑 |
| `gofmt -l cmd internal` | 出力なし |
| `cd web && pnpm exec tsc --noEmit` | 出力なし |
| `cd web && pnpm test -- --run` | 緑 |
| `scripts/check-progress-log-index.sh` | **違反なし**(高-5 の是正) |
| `scripts/check-stop-discipline.sh` | 違反なし(§J へ 1 件登録) |
| `scripts/check-artifact-integrity.sh` | 違反なし |

## 14. 実機確認のお願い(指示書 §5)

**★本サブは Windows で実際に動かさないと確かめられないものが多い。**

### 14.1 ★★★確認の前提(2026-09-12 に実際に踏んだ)

**devContainer の dev サーバを止めてから確かめること。⇒ 止めないと、確認が静かに別のものを測る。**

**実測**——`Get-NetTCPConnection` で `127.0.0.1:47318` と `:47331` の持ち主が **`Code`(VS Code)** だった。**VS Code が devContainer(または WSL)のポートを Windows 側の loopback へ転送している**ためである(47318 = dev サーバの既定ポート、47331 = `scripts/wt-new.sh` が割り当てる worktree の dev ポート)。

**⇒ その状態で Windows の exe を起動すると、二重起動の判別が `devContainer 側の Tacpendium` を見つけて `exit 0` する**(ブラウザだけ開く)。**★判別は設計どおりに働いている**——本当に同じアプリが `/api/health` に応答しているためである。**★しかし「起動に失敗したときの `MessageBox`」を測ろうとしていると、何も出ないので失敗に見える。**

### 14.2 確認項目と結果

| # | 確かめてほしいこと | 本報告での状態 | **実機の結果**(2026-09-12) |
|---|---|---|---|
| **★★1** | **黒窓が出ないこと** | PE の Subsystem = 2 まで機械で確認(§6) | **OK** |
| **★★2** | トレイにアイコンが出て、右クリックでメニューが出ること。**左ダブルクリックでブラウザが開くこと** | 結線とメニュー構成はテストで固定(§4) | **OK**(★あわせて追加要求が 1 件。§4.6) |
| **★★3** | メニュー **6 項目**がそれぞれ正しい場所を開くこと | 開く先はテストで固定 | **OK**(★2026-09-12 に追加した「設定ファイルのフォルダを開く」も実機で確認) |
| **★★★4** | **起動に失敗したとき `MessageBox` が出ること** | 失敗が `desktop.Alert` へ到達することまで実測(§5.3) | **OK**。実機の表示 = 表題「Tacpendium を起動できませんでした」／ 本文 `load config: config: invalid server.mode "xxxx" (want "local" or "lan")`。★**この確認がきっかけで §15 の追加要求が出た** |
| **★★5** | **`config.toml` が読まれること**(ポートを変えて、その値で待ち受けること) | Linux の実バイナリで実測(§2) | **OK** |
| **★6** | 二重起動の判別と終了確認 | Linux で実測(§7.1) | **OK** |
| **★7** | **【2026-09-12 追加分】起動失敗ダイアログに設定ファイルのパスが出て、[OK] でフォルダが開くこと** | Linux では `Alert` 到達と `OpenFolder` 呼び出しまで(§15.3) | **OK**(§15.4) |

**★4 と 5 が最も重い**(指示書 §5)。⇒ この 2 つが通らないなら、黒窓を消したことが害になっている。

### 14.3 ★`MessageBox` の測り方(**2026-09-12 に実施済み。手順として残す**)

**ポートを埋める方法は採らない**。指示書 §5-4 は例としてそれを挙げているが、**14.1 の転送があると成立せず、VS Code を閉じる必要が出る**。⇒ **設定値を不正にする方が同じ経路(`run()` のエラー → `reportFatal` → `desktop.Alert`)を通り、ポートに触らない。**

```
config.toml の [server] を mode = "xxx" にして保存 → exe をダブルクリック
→ ダイアログ「Tacpendium を起動できませんでした」/ 本文 config: invalid server.mode "xxx"
→ 確認後 mode = "local" へ戻す
```

---

---

## 15. ★【2026-09-12 追加】起動失敗時の導線(設定ファイルのパス表示 ＋ 自動で開く)

### 15.1 由来

**実機で `MessageBox` を確認した開発者の逐語**——**「起動失敗についてですが、どんな契機で起きるか教えてもらえますか？ 設定ファイル契機が多いのであれば、MessageBox に設定ファイルのパスを出したり、設定ファイルのフォルダを勝手に開いたりは欲しい気がしました。」**

### 15.2 ★起動失敗の契機の全数(`run()` が返しうるエラー)

**実装から洗い出した。⇒ 15 種のうち 8 種が「`config.toml` を直せば直る」ものである。**

| # | 契機 | 出どころ | 分類 |
|---|---|---|---|
| 1 | 未知の引数 | `parseArgs` | 操作 |
| 2 | **TOML の構文エラー** | `config.Load`(`config: decode`) | **★設定** |
| 3 | **`mode` が不正** | `validate`(実機で踏んだもの) | **★設定** |
| 4 | **`port` が範囲外** | `validate` | **★設定** |
| 5 | **`defaults.character_id` / `preset_id` が 1 未満** | `validate` | **★設定** |
| 6 | **`database.path` / `logging.file` が管轄外** | `ValidateDataPath` | **★設定** |
| 7 | **`logging.level` のタイポ** | `log.Init`(`unknown level`)。★`validate` は level を見ていない | **★設定** |
| 8 | **`logging.file` が空** | `log.Init`(`empty file path`) | **★設定** |
| 9 | **LAN モードで IP が見つからない** | `buildAllowedOrigins` | **★設定＋環境** |
| 10 | ログの出先を作れない | `log.Init`(`mkdir`) | 環境(★設定の `logging.file` 次第) |
| 11 | ポートが全滅 | `netutil.ListenAvailable` | 環境 |
| 12 | データディレクトリ移行の衝突 | `prepareDataDir` | 環境 |
| 13 | マイグレーション失敗 / DB を開けない | `migration.Run` / `db.Open` | データ |
| 14 | 既定プリセットを解決できない | `ensureDefaultPresetExists` | データ |
| 15 | 埋め込みフロントを開けない | `tacpendium.WebFS` | 配布物 |

**★9 のメッセージは着手前から「`config.toml` の `[server].mode` を `local` に変更するか…」と案内していた。**⇒ **「どこを直すか」を伝える形はそこだけに在り、他が揃っていなかった。**

### 15.3 実装(開発者の選択 = 「パス表示 ＋ 自動で開く」)

| # | 挙動 |
|---|---|
| 1 | **本文へ設定ファイルの絶対パスを常に添える。**★設定由来でないときは **`(参考)`** と断る(原因だと読ませないため) |
| 2 | **設定ファイル由来のときだけ**、ダイアログを閉じた後に**その置き場を開く**。⇒ 直す先が目の前に出る |
| 3 | 分類は `configProblem` の目印で行う。**目印を付けるのは 3 か所**(`config.Load` / `log.Init` / `buildAllowedOrigins`)。⇒ 上表の 2〜10 が該当する |
| 4 | **DB の破損・ポートの枯渇・配布物の異常では開かない。**★直す先が違う |
| 5 | 引数エラー(上表 1)は設定を読む前に落ちるため、パス行を出さない |

**実測**(Linux の実バイナリ。`mode = "xxxx"`):

```
[Tacpendium を起動できませんでした] load config: config: invalid server.mode "xxxx" (want "local" or "lan")

設定ファイル: …/exe-dir/config.toml
［OK］を押すと、このフォルダを開きます。
WARN could not open the config folder dir=…/exe-dir err="exec: \"xdg-open\": executable file not found in $PATH"
```

**★Linux にファイラが無いので開けず、警告 1 行で続行している**(致命にしない)。**Windows では `explorer.exe` が開く。**

**テスト**: 設定由来 = パス・原因・次の操作の 3 つが本文に揃い、フォルダを開く ／ 設定由来でない = `(参考)` 表記で**開かない** ／ パス不明(引数エラー)= 何も足さない ／ 目印が `fmt.Errorf` で包まれても `errors.As` で拾えること。

### 15.4 ★実機の観測(2026-09-12・Windows)

**開発者の確認 = OK**。逐語 = **「MessageBox に設定ファイルのパスもフォルダも出ました、確認 OK です。」**

⇒ **Windows で次の 2 つが揃って出ることを実測した。**

| # | 観測 |
|---|---|
| 1 | **ダイアログ本文に設定ファイルの絶対パスが出る** |
| 2 | **[OK] を押した後に `explorer.exe` でそのフォルダが開く** |

**★Linux 側で測れていたのは「`desktop.Alert` へ到達すること」と「`OpenFolder` を呼ぶこと」までであった**(§15.3。ファイラが無いため警告 1 行で続行していた)。**⇒ 実機で初めて、利用者が見る形として閉じた。**

---

*以上、`M34-02` 完了報告。* **★本サブの設計は段の順序そのものであり、段 1〜4(見えなくなって困るものを塞ぐ)を先に着地させてから段 5 で黒窓を消した。** **★最も重い段 1 は「実装を設計書の規定へ寄せた」変更であり、開発時だけは従来の基準を保っている。**
