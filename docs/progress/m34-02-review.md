# M34-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | `M34-02`(常駐ランチャと黒窓の除去) |
| 指示書 | `docs/instructions/M34-02-tray-residency-and-no-console.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M34-02-review-checklist.md` v1.0.0 |
| 着手基点 | `0660fa2` / 対象コミット 7 本(`cfd08aa` `bcc03e7` `0403e5a` `4d98b53` `f51a14b` `7922d3d` `59ab289`) |
| 実施日 | 2026-09-10 |
| 指摘件数 | 高 5 / 中 7 / 低 7 |

---

## 総評

段の順序は完全に守られている。コミットは段 1 から段 6 へ 1 段 1 本で並び、段 5(`f51a14b`)の前に段 1 から段 4 の全ファイルが着地している。束 A は 3 項目すべて満たしており、これが本サブで最も重い点である以上、設計は守られたと判断する。テストの設計も水準が高い ——「門を置いた」ではなく「門が効く」を測る形が段 1・段 3・段 5 のそれぞれに入っている。

一方で、その最重要の門である束 D-1 に **1 段の隙間**がある。PE サブシステムの検査は `Makefile` の変数の値だけを読み、`build-windows` レシピがその変数を実際に渡していることを見ていない。レシピから `-ldflags` を落とすと黒窓は復活するがテストは緑になる。本サブが最も避けたかった「緑でも壊れている」の形がここに残っている。

もう 1 件、報告に現れていない実害がある。ブラウザ自動起動の URL を `localhost` から `127.0.0.1` へ変えたことで **ブラウザの origin が変わり**、`web/CLAUDE.md` §1 台帳の 9 キー(キーボード割当 17 件・パッド校正 14 件を含む)が既存利用者から黙って消える。かつ起動案内は今も `localhost` を案内しており、2 つの導線が別 origin を指す。

「撤回済み・失効した記述がコード上に残っている」型は 3 件(`OpenURL` の godoc 1 行目 ／ `args.go` の `notifyFatal` ／ `Makefile` の門の範囲の記述)。移植物を初めて呼ぶ手番として想定どおり出やすい面であり、いずれも高として置く。

---

## 設計準拠性レビュー結果

### 束別の判定

| 束 | 判定 | 根拠と問題点 |
|---|---|---|
| **A** 段の順序 | **◎** | A-1: コミット順が段 1 から段 6。段 5 は 5 本目の `f51a14b` で、段 1 から段 4 のファイルはすべてそれより前に着地している。A-2: 段 1 の破壊確認(報告 §2)と段 4 の破壊確認(§5.3)はいずれも段 5 より前の実測として記録されている。A-3: 6 段が独立コミットで、混在は無い。**本サブで最も重い束を落としていない** |
| **B** ログと `config.toml` の基準 | **○** | B-1 実測あり(報告 §2。exe の隣とカレントディレクトリの両方に別ポートの `config.toml` を置き、exe 側だけが読まれること・もう一方へ落ちないことを実バイナリで測っている)。B-2 案 3 つの欠点あり。B-4「変えない ＋ WARN 1 行」を理由付きで記録。B-5 移行手順あり。**B-3 が部分的** —— Linux は実測、Windows は `make check-windows` のコンパイルのみ、macOS は未実行(報告 §1.3 が明記)。単体テストは OS 分岐を持たない実装を突いており妥当だが、「全 OS の既存挙動」の 3 分の 1 は未測である |
| **C** 失敗時の通知経路 | **○** | C-2 4 項目すべての失敗が `Notify` へ載り、表題が項目名と一致することをテストが固定。C-3 段 5 より前にログ経路を実測(§5.4)。C-4 引数エラーも同経路(`TestParseArgsErrorRidesTheSameChannel`)。**C-1 は代替測定である** —— 実測したのは「失敗が `desktop.Alert` へ到達すること」であり、`MessageBox` そのものは出ていない(Linux では stderr)。報告はこれを隠していないが、チェックリストが求めた実測は満たされていない。指摘 中-6 |
| **D** 黒窓の除去 | **△** | D-1 PE ヘッダの Subsystem 判定 ＋ 陽性対照(フラグ無しで CUI=3)まで在り、形としては要求以上である。**しかし配布物を守っていない**(指摘 高-4)。D-2 `make check-windows` を当方で実行し緑を確認。D-3 `WINDOWS_GUI_LDFLAGS` は `build-windows` だけが参照し、`build` / `build-darwin` / `build-linux` / `build-debug` / `check-windows` へ漏れていないことを `Makefile` 実読で確認 |
| **E** `internal/desktop/` の契約 | **◎** | E-1 `runResident` は `ErrUnsupported` を専用分岐で受け、通知もエラー返却もしない。`TestRunResident_UnsupportedTrayKeepsServing` が「即座に返らないこと」まで固定しており、待ち合わせに `waitStarted` を挟んで検査が空振りしない形にしてある。E-2 非 Windows にトレイが出ないため `Confirm` の false で詰まる経路が無い。E-3 `ValidateURL` は委譲の前に必ず通り、拒否 6 パターンの回帰テストあり。E-4 `desktop.OpenFolder` をそのまま渡しており `os.Stat` を迂回していない。E-5 バルーン通知・アニメーション・スタートアップ登録・サービス化はいずれも 0 件。公開 API の追加・削除も無い(`browserCommand` は非公開) |
| **F** 依存・ライセンス・射程 | **◎** | F-1 `go.mod` / `go.sum` は `git diff --numstat 0660fa2` の対象に現れず差分 0 行。F-2 `scripts/` 配下への追加 0 件(`build-windows.ps1` は移植しない判断。役目を `Makefile` とテストへ寄せた説明も妥当)。F-3 `REUSE.toml` 差分 0 行。F-4 `determineBindHost` / `determineBindAddr` は diff に現れず無改変。F-5 `printStartupNotice` の文面は出し分けで是正済み(ただし指摘 高-2 の別問題が同関数に残る) |
| **G** メニューの中身 | **◎** | G-1 確定 4 件が順序どおり在り、`TestBuildTrayMenu_ConfirmedItems` が項目数・順序・`Default` が 1 件だけであることまで固定。G-2 候補 2 件の採否が段 1 の選択と結び付いており、「exe のフォルダを開く」が入っていないことを**テストが明示的に見ている**のは良い形である。G-3 トレイ側の QR 描画 0 件、Go の QR ライブラリも 0 件。G-4 LAN の出し分けは無く、`local` モードで `?qr=1` でも出ないことをテストが固定 |

### followup-backlog §CI の 5 件

| スラッグ | 対応 | 判定 |
|---|---|---|
| `log-path-cwd-relative` | 段 1。`AppBaseDir()` / `ResolveAppPath()` で `config.toml` と `logging.file` が同じ関数を通る | ◎ |
| `cli-arg-parsing-is-a-spec-change` | 段 2。(a) エラーにして終了。フラグ定義 0 件 | ◎ |
| `startup-notice-text-stale-on-tray` | 段 6。トレイの有無で出し分け | ◎ |
| `browser-launch-duplication` | 段 6。`pkg/browser` へ寄せ、呼び手 3 つが `desktop.OpenURL` 1 本を通る | ○(指摘 高-1) |
| `porting-target-layer-c-collision` | 移植しないことで回避 | ◎ |

### 新規ファイルの deletions(教訓 `E-225` の観点)

`git diff --numstat 0660fa2` を当方でも読んだ。**新規 12 ファイルはすべて `+N / -0`** であり、上書きで消えた行は無い。

`internal/desktop/desktop_test.go` の 2 本撤去(`TestBrowserCommandPerOS` / `TestBrowserCommandValidates`)は **意図した撤去と判定する**。理由は 2 つ。(1) 検査対象の `browserCommand` そのものが撤去されており、残すことは不可能である。(2) 関門(`ValidateURL`)の検査は `TestOpenURLKeepsTheValidateURLGate` として残り、旧 `TestBrowserCommandValidates` が 1 パターンだったところを 6 パターンへ増やしている。**ただし旧テストが併せて固定していたものが 1 つ落ちている**(指摘 低-3)。

---

## 設計準拠性以外の指摘事項

以下は上表に現れない実装・規約面の指摘である。番号は次節の推奨修正と対応する。

### 高-1: `OpenURL` の godoc 1 行目が委譲後の実態と食い違う

`internal/desktop/desktop.go:150-151`

```go
// OpenURL launches the user's default browser. It returns as soon as the child
// process is spawned; the tool never waits for the browser.
```

この 1 行目は自前 `spawn`(= `exec.Command(...).Start()`)を前提にしており、委譲後は成立しない。実測(`/root/go/pkg/mod/github.com/pkg/browser@v0.0.0-20240102092130-5ac0b6a4141c`):

- `browser_linux.go` / `browser_darwin.go` → `runCmd()` → `exec.Command(...).Run()`。**子プロセスの終了を待つ**
- `browser_windows.go` → `windows.ShellExecute(...)`。**そもそも子プロセスを spawn していない**

直下に足された委譲の注記(155 行目以降)は「なぜ委譲したか」を書いているだけで、この 1 行目を訂正していない。動作は正しいままなのでテストも lint も型検査も緑であり、人が読む以外に見つける経路が無い。加えて後任は 1 行目をコピーする。優先度較正の指示どおり **高**。

`OpenFolder` の godoc(`The directory is stat'd first: the file manager is started and never waited on`)は `spawn` を使い続けているので今も正しい。**片方だけが失効している状態**である。

### 高-2: 自動起動 URL の origin 変更で、ブラウザストレージの UI 状態が黙って失われる

`cmd/tacpendium/main.go` の `launchBrowser`:

```
-	accessURL := fmt.Sprintf("http://localhost:%d", port)
+	accessURL := localAppURL(port)          // = http://127.0.0.1:<port>/
```

`localStorage` / `sessionStorage` は **origin 単位**であり、`http://localhost:47318` と `http://127.0.0.1:47318` は別 origin である。`web/CLAUDE.md` §1 台帳の実装済み 9 キーは、すべて新しい origin から見えなくなる。とくに代償が大きいのは次の 2 つ。

- `keyboard-bindings-v1`(17 件。**既定を持たず全件を利用者が登録する** = `D-370`)。origin が変わった時点でキーボード入力が丸ごと未割当へ戻る
- `gamepad-profiles-v1`(14 件。物理コントローラの校正結果)

さらに **導線が 2 つに割れたままである** —— `printStartupNotice` は今も `この PC からアクセス: http://localhost:<port>/` を案内し、トレイと自動起動は `127.0.0.1` を開く。以後は「どちらの導線から入ったか」で UI 状態が変わる。

指示書の判断 2 は「ブラウザで開く URL だけを `127.0.0.1` にする」であり、文面上は本変更を許している。しかし `launchBrowser` は**既存の導線**であって、そこを変えると既存利用者に影響が出る。完了報告 §9-1 は「`127.0.0.1` にしたのはブラウザで開く URL だけである」と書くだけで、origin が変わることとその帰結を評価していない。台帳が絡む以上、判断は開発者・設計卓の側にある(`CLAUDE.md` §10.X ／ ハード列「ユーザー体験に影響する選択」)。

**判断できないこと**: 既存利用者が実際に `localhost` 側へ状態を持っているかは、開発者の実機でしか確認できない。ただし `printStartupNotice` が着手前から `localhost` を案内していた事実と、`launchBrowser` が `localhost` を開いていた事実の 2 点から、`localhost` 側に在る可能性が高いと考える。

### 高-3: `args.go` のコメントが存在しない識別子を指している

`cmd/tacpendium/args.go:24`

```
// ★★エラーは段 4 の通知経路へ載る —— 本関数は run() の先頭で呼ばれ、返したエラーは
// main() の致命終了経路(notifyFatal)を通る。
```

`notifyFatal` はリポジトリ全体で 0 件である(`grep -rn "notifyFatal" --include=*.go .` は本コメント 1 行のみ)。実体は `notify.go` の `reportFatal`。段 4 で名前が変わったときにコメントが追随していない。後任が `notifyFatal` を探しに行って見つからない形であり、失効記述として **高**。

### 高-4: 束 D-1 の門が、配布物のリンク指定を守っていない

`cmd/tacpendium/windows_gui_link_test.go` は次の 2 つを見る。

1. `Makefile` の `WINDOWS_GUI_LDFLAGS` 行を正規表現で読み、値に `-H=windowsgui` が含まれること
2. その値でリンクした exe の PE Subsystem が 2(GUI)であること。フラグ無しなら 3(CUI)であること

**見ていないもの** = `build-windows` レシピが `-ldflags="$(WINDOWS_GUI_LDFLAGS)"` を実際に渡していること。当方で `scripts/` と `.github/` を走査したが、レシピ側を見る検査は他にも 0 件である(`grep -rn "build-windows\|windowsgui\|WINDOWS_GUI" scripts/ .github/` は `nightly-crossbuild.yml` のコメント 2 行だけ)。

⇒ **レシピから `-ldflags=` を落とすと、配布 exe は CUI に戻って黒窓が復活するのに、`go test ./...` は緑のままである。** 変数の定義は残っているので (1) も (2) も通る。本サブが避けようとした「緑でも壊れている」の形そのものである。加えて `nightly-crossbuild.yml` の `make build-all` は実際の `dist/tacpendium-windows-amd64.exe` を作るが、その成果物の Subsystem は誰も見ていない。**門は成果物から 1 段離れた場所に立っている。**

あわせて `Makefile` のコメントが門の範囲を過大に述べている(**失効記述として同じ高**)。

```
#   cmd/tacpendium/windows_gui_link_test.go が本行を読み、その指定で実際にリンクした
#   exe の PE ヘッダのサブシステム値を見る。⇒ フラグを消すと go test が赤くなる。
```

赤くなるのは「変数行を消したか値を空にしたとき」だけである。レシピの `-ldflags` を消しても赤くならない。

安い直し方が 2 つある。(a) テストが `build-windows` レシピ行も読み、`$(WINDOWS_GUI_LDFLAGS)` を参照していることを検査する。(b) テストがリンクではなく `make build-windows` の成果物を見る(ただし `pnpm build` を伴うので重い)。(a) を推す。

### 高-5: `progress-log.md` への追記が無い

`bash scripts/check-progress-log-index.sh` を当方で実行した結果:

```
NG  作業 ID `m34-02` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/M34-02-completion-report.md)
結果: 違反 1 件
```

`docs/progress/progress-log.md` の末尾は `M34-01` の節で終わっている。`CLAUDE.md` §8 は「サブ完了時の追記は必須」と定め、指示書 §4-8 も必須として挙げている。

なお完了報告 §8 の表は 7 行目で `docs/progress/progress-log.md` を **「追記した(Phase D)」** と過去形で書いている。commit `59ab289` の時点では存在しないので、**報告に事実でない記述が 1 行ある**。Phase D で埋めるつもりの欄を過去形で書いたものと読めるが、報告は as-built の記録であり、この形は次の読み手に「済んでいる」と読ませる。

### 中-6: 束 C-1 と D-1 の「実物側」が未実測であることを、レビューとしても明示する

報告は誠実に書いている(§5.3「Linux では `MessageBox` そのものは出ない」／ §14-4「ダイアログが出ることは実機のみ」)。ただしレビュー側として次を記録しておく。

- 束 C-1 が求めた「わざと起動を失敗させて `MessageBox` が出ることを実測」は、`desktop.Alert` への到達までしか測れていない
- 束 A-2 の「段 5 より前に測る」は、**Linux では `-H=windowsgui` が無効なので、そもそも順序が効かない**。順序が意味を持つのは Windows 側であり、そちら側の実測は 1 件も無い

⇒ 段の順序はコミットで守られているが、**「段 1 と段 4 が段 5 の害を実際に塞げているか」の検証は、開発者の実機確認が済むまで完了していない**。指示書 §5 が実機へ割り付けている事項であり本サブの不備ではないが、`M34` を閉じる判断はこの 2 点の実機結果を待つべきである。

### 中-7: `runResident` の正常終了分岐が「`quit` が既に走った」ことを前提にしている

`cmd/tacpendium/tray.go`

```go
	err := tray.Run(buildMenu(quit))
	switch {
	case err == nil:
		// 終了要求でメッセージループを抜けた。サーバの停止を待つ。
```

`internal/desktop/tray_windows.go:186-189` の実装では、`RunTray` は **`GetMessageW` が 0 を返したとき(WM_QUIT)に nil を返す**。WM_QUIT は `StopTray` の `PostMessageW(wmTrayQuit)` 以外からも来る(Windows のログオフ・シャットダウン処理、任意の `PostQuitMessage`)。その場合 `quit` は 1 度も呼ばれておらず、`srv.Shutdown` も走らないので `srv.Start` は返らない。⇒ **`<-done` で永久にブロックし、アイコンも窓も無い状態でプロセスが残る。**

`quit` は `sync.Once` で包まれているので、この分岐で `quit()` を呼んでも二重実行にならない。1 行で塞げる。

### 中-8: アイコンを出せなかったとき、利用者が正規の手順で止められない

同じ `switch` の `default:` 分岐は「アイコンが出せなくてもアプリは使える」として常駐を続ける。判断そのものは妥当だが、`-H=windowsgui` の配布ビルドでは次の 3 つが同時に無い。

- コンソール窓(段 5 で消えた)
- トレイアイコン(この分岐は出せなかった場合である)
- 画面側の終了ボタン(報告 §7.2 が「作っていない」と明記)

⇒ 利用者に残る手段はタスクマネージャだけである。通知文面 `Tacpendium: 通知領域にアイコンを表示できませんでした` にもその案内が無い。文面へ 1 行足す(ブラウザからは使えること ／ 止めるにはタスクマネージャが要ること)だけで足りる。

### 中-9: `appDataRoots()` の拡張は、パス検証(セキュリティ封止)の許可範囲の拡張である

`internal/config/config.go` の `appDataRoots()` へ `AppBaseDir()` が追加された。同関数は `ValidateDataPath` が絶対パスを許すルート集合であり、`CHANGE-049` が「設定経由の未検証パスがアプリ管轄外の既存ファイルを上書き・破損させる隙」を塞ぐために置いた検証である(`SUPP-001` §5.8:1471)。同節は **LAN モードの未認証 `PUT /api/config` 経由の破壊的パス植え込みも本検証で封止する**と明記している。

段 1 の帰結として拡張が必要であることは理解できる(相対の基準が exe の隣へ移ったので、同じ場所を絶対で書いたら弾かれてはならない)。実害の増分も小さい —— exe をダブルクリックした場合はカレントディレクトリが exe の隣になるので、着手前から許可されていた。増えるのは「ショートカットの作業フォルダが exe と別の場所」の場合だけである。

問題は扱いの側にある。`CLAUDE.md` §10 は「セキュリティ関連の自己判断」を禁止事項として挙げている。完了報告は CHANGE 候補 1 として「相対パスの解決基準を明文化する」と書くだけで、**許可ルートが 1 つ増えたこと自体**とその評価を書いていない。設計伝達レポート §4 では、明文化ではなく「セキュリティ検証の許可範囲を広げた」として起こすべきである。

### 中-10: 二重起動の判別が `health.Response` の形と暗黙に結合しており、テストがそれを守っていない

`cmd/tacpendium/instance.go` の `tacpendiumRespondsAt` は、`internal/api/health.Response` と同じ 2 フィールドの匿名構造体へ `DisallowUnknownFields()` 付きでデコードする。

`cmd/tacpendium/instance_test.go` は **手書きのリテラル JSON** で 6 パターンを測っている。⇒ 誰かが `health.Response` にフィールドを 1 つ足すと、**自分自身の応答が「未知のキーあり」で弾かれ、二重起動の判別が黙って無効化する**。`go test ./...` は全部緑である(テストは古い 2 キー JSON を送り続けるため)。

`main.go` は既に `healthapi` を import している。デコード先を `healthapi.Response` にすれば、フィールド追加はコンパイル単位で結合する。あるいは実ハンドラ(`healthapi.Handler`)の応答を `httptest` で流して固定する検査を 1 本足す。どちらも安い。

### 中-11: 指示書 §2.6-2 の「画面とトレイから」を、呼び手 1 つで満たしたことになっている

指示書 §2.6-2 は「**画面とトレイから**共通の終了処理を呼び、HTTP サーバを停止してアイコンを削除する」。実装は関数を用意して呼び手をトレイ 1 つにした(報告 §7.2)。理由(停止用の HTTP ルートが存在せず、新設は認証・LAN 共有と絡む設計判断)は妥当であり、`M34-overview` §1-6 が「画面内の終了ボタン、**または** アイコンの右クリックメニューから」と "または" で書いていることから、マイルストーンの要求としては満たせている。

ただし `M34` は 2 段構成であり本サブで閉じる。⇒ **画面側の終了ボタンを持たないまま `M34` を閉じてよいか**は設計卓の確認事項である。報告は §9-9(射程外)へ置いたが §10(横断課題)には上げていないため、このままでは行き先が無い。設計伝達レポート §4 へ回すこと。

### 中-12: `ValidateDataPath` の拒否メッセージが実装より狭い

```go
return "絶対パスはアプリのデータディレクトリ(またはアプリ本体の在るフォルダ)配下のみ指定できます"
```

実装が許可するルートは 4 つ(既定データディレクトリ ／ 旧既定データディレクトリ ／ `AppBaseDir()` ／ カレントディレクトリ)である。旧メッセージは「またはカレントディレクトリ」と書いていたので、**カレントディレクトリの言及だけが落ちた**。利用者から見ると「拒否理由の説明にない場所を指定したのに通る」形になる。godoc のポリシー欄(`絶対パスはアプリ既定データディレクトリ、または AppBaseDir() 配下のみ許可`)も同じくカレントディレクトリを落としている。実装が 4 ルートを持つのは意図した設計(開発時の挙動を変えないため)なので、直すのは文面の側である。

### 低-1: `printStartupNotice` の godoc が別の関数に貼られている(着手前からの不整合)

`cmd/tacpendium/main.go:659` から始まるコメントブロックは `printStartupNotice` の説明で始まり、途中から `ensureDefaultPresetExists` の説明に切り替わって `func ensureDefaultPresetExists` に付いている。`printStartupNotice` 自身(:698)には godoc が無い。

`git show 0660fa2:cmd/tacpendium/main.go` で確認したところ **着手前から同じ状態**であり、本サブが作った不整合ではない。ただし本サブは同関数の signature を変えて第 5 引数 `trayResident bool` を足しており、その説明を書く場所が無い状態である。ついでに直す価値がある。

### 低-2: `HideWindow = true` 側の検査が消えた

旧 `TestBrowserCommandPerOS` は `launchCmd` の `HideWindow` を OS ごとに固定していた(Windows の `rundll32` は `true`)。委譲によって `true` を立てる呼び手が 0 になり、残るのは `TestFolderCommandNeverHidesWindow`(explorer を隠さないこと)だけである。

`HideWindow` フィールドを残す判断(報告 §7.4-4)は 2026-08-04 の実機知見を型で保つためであり妥当だが、**「隠すべきヘルパは隠す」側の検査が無い**状態になった。将来 `true` を立てる呼び手が現れたとき、`desktop_windows.go:77` の `if c.HideWindow` が壊れていても Linux では誰も気づけない。`spawn` は OS 依存で Linux 側は `HideWindow` を無視するため、テストの追加は容易ではない。**現時点では無害なので低とするが、フィールドを残すなら申し送りが要る。**

### 低-3: `TestRunResident_TrayFailureIsNotNotFatal` の名前が二重否定

`IsNotNotFatal` は「致命でない」を言いたいはずだが読めない。`TrayFailureIsNotFatal` で足りる。

### 低-4: `parseArgs` が `-h` でも exit 1 になる

`flag.ErrHelp` を受けて `errors.New(argUsage)` を返すため、`main()` は `reportFatal` を通って `os.Exit(1)` する。Windows では `-h` に対して `MessageBox` が出る。「オプションを取らない」ことを伝える設計としては一貫しているが、`-h` が 0 を返すのは広く共有された慣習であり、スクリプトから叩かれたときに紛れる。仕様として意図したのであれば報告へ 1 行書いておく価値がある。

### 低-5: `?qr=1` を URL から落としていない

`SettingsPage` は `searchParams` を読むだけで消さない。⇒ 利用者がモーダルを閉じてページをリロードすると、また QR が開く。`replaceState` 相当で落とすか、意図的にそうしているなら注記が要る。

### 低-6: 二重起動の判別の記録がファイルログに残らない

`detectRunningInstance` は `applog.Init` より前に置かれている(意図どおり)。その結果、`another instance is already running` の `slog.Info` と `openExistingInstance` 失敗時の `slog.Error` は **`slog` の既定ハンドラ(stderr)にしか出ない**。`-H=windowsgui` では stderr の接続先が無いので、**どこにも残らない**。

利用者へのフィードバックは「既存の画面が開くこと」と `Alert` があるので実害は小さい。ただし報告 §5.4 の「ログへ書く経路が生きていること」はこの経路には及んでいない。二重起動が疑われる問い合わせが来たとき、ログに手掛かりが 1 行も無い。

### 低-7: followup-backlog §CI の 5 件が「未着手」のまま

5 件はすべて本サブで畳まれているが、`docs/handover/followup-backlog.md` §CI の状態列は 5 件とも「未着手」である。製造は同ファイルを編集できない(`D-382`。§J のみ)ため製造の不備ではない。**設計伝達レポート §4 へ「§CI の 5 件の状態更新」を明示して請求すること。**

---

## 推奨修正(優先度別)

### 高(M34 完了前に修正必須)

- **高-1** `internal/desktop/desktop.go:150-151` の `OpenURL` godoc 1 行目を委譲後の実態へ直す。`pkg/browser` は Linux/macOS で `cmd.Run()`(子の終了を待つ)、Windows で `ShellExecute`(子プロセスを spawn しない)であり、現在の記述はどちらでも成立しない
- **高-2** 自動起動 URL を `localhost` から `127.0.0.1` へ変えた判断を、開発者・設計卓へ上げる。origin が変わると `web/CLAUDE.md` §1 台帳の 9 キー(`keyboard-bindings-v1` 17 件は既定を持たない)が既存利用者から消える。あわせて `printStartupNotice` の案内 URL と自動起動・トレイの URL を **同じ origin へ揃える**(どちらへ揃えるかは開発者の判断)
- **高-3** `cmd/tacpendium/args.go:24` の `notifyFatal` を `reportFatal` へ直す
- **高-4** `windows_gui_link_test.go` に `build-windows` レシピが `$(WINDOWS_GUI_LDFLAGS)` を渡していることの検査を足す。あわせて `Makefile` のコメント「フラグを消すと go test が赤くなる」を、実際に赤くなる範囲(変数行の削除・値の空化)へ書き直す
- **高-5** `docs/progress/progress-log.md` へ `M34-02` の索引行を追記し、`bash scripts/check-progress-log-index.sh` を緑にする。あわせて完了報告 §8 の 7 行目の「追記した(Phase D)」を実態と一致させる

### 中(次サブ着手と並行可)

- **中-7** `runResident` の `case err == nil:` で `quit()` を呼ぶ(`sync.Once` により冪等)。WM_QUIT が `StopTray` 以外から来た場合に `<-done` で永久ブロックする経路を塞ぐ
- **中-8** `notifyTitleTrayFailed` の通知本文へ、ブラウザからは使えること・止めるにはタスクマネージャが要ることを 1 行足す
- **中-9** `appDataRoots()` の拡張を「パス検証の許可ルートを 1 つ増やした」として設計伝達レポート §4 へ起こす(現在は「明文化」として書かれている)
- **中-10** `tacpendiumRespondsAt` のデコード先を `healthapi.Response` にする、または実ハンドラの応答で固定する検査を 1 本足す
- **中-11** 画面側の終了ボタンを持たないまま `M34` を閉じてよいかを設計伝達レポート §4 へ上げる(報告 §9-9 のままでは行き先が無い)
- **中-12** `ValidateDataPath` の拒否メッセージと godoc のポリシー欄へ、カレントディレクトリが今も許可ルートであることを戻す
- **中-6**(記録のみ・修正不要) 束 C-1 と D-1 の実物側は開発者の実機確認待ちである。`M34` を閉じる判断はその結果を待つこと

### 低(将来対応)

- **低-1** `printStartupNotice` の godoc を同関数へ付け直し、第 5 引数を説明する(着手前からの不整合)
- **低-2** `HideWindow = true` 側の検査が無いことを申し送る(フィールドを残す判断とセットで)
- **低-3** `TestRunResident_TrayFailureIsNotNotFatal` を `TestRunResident_TrayFailureIsNotFatal` へ
- **低-4** `-h` の終了コードを 0 にするか、1 のままにする理由を報告へ書く
- **低-5** モーダルを開いた後に `?qr=1` を URL から落とす
- **低-6** 二重起動の判別の結果を、ロガー初期化後に 1 行だけ再掲するか、この経路がファイルログに残らないことを申し送る
- **低-7** 設計伝達レポート §4 で followup-backlog §CI の 5 件の状態更新を請求する

---

## 良かった点

Claude Code へのフィードバックとして残す。

1. **段の順序をコミットで証明している。** 6 段が 1 段 1 本で並び、段 5 は 5 本目である。束 A が本チェックリストで最も重い項目であることを踏まえた形になっている。1 コミットに畳んでいれば、他がすべて緑でも設計が守られたとは言えなかった。
2. **陽性対照を 3 か所で持っている。** PE サブシステム検査はフラグ無しで CUI(3)になることまで測り、`Makefile` の値を空にした場合・行を消した場合の赤も実測している。フロントの `openQr` は受け渡しを外して赤になることを測っている。「門を置いた」を「門が効く」の証拠と読ませない形が定着している。
3. **`trayRunner` / `httpServer` の注入で、Windows 専用の常駐ループを Linux でテストしている。** 4 経路(非対応 ／ 終了要求 ／ サーバ落ち ／ アイコン失敗)を固定し、`ErrUnsupported` を fatal にする改変が Linux で赤になる形を作った。契約 E-1 は「Linux の `go test` では捕まらない」ものであり、それを捕まえられるようにしたのは本サブの独自の価値である。
4. **`waitStarted` を挟んで検査の空振りを防いでいる。** コメントに「これが無いと『まだ返っていない』の判定が、単に `runResident` が始まる前だっただけという形で常に成立してしまう」と書いてある。検査が存在しないのと同じになる形を、書いた本人が自覚して塞いでいる。
5. **`isGoBuildTempDir` の分岐を、実測値の 3 形と『名前が似ているだけのディレクトリ』で固定している。** `go run` と worktree のポート分離を壊さないという判断そのものが、指示書に書かれていない自己判断のうち最も重いものであり、その根拠と検査を両方置いている。
6. **メニューの「採らなかった項目」をテストで固定している。** `exe のフォルダを開く` が入っていないことを明示的に見ているので、後任が「便利だから足しておく」で段 1 の選択と切り離れる形を防げる。
7. **報告が限界を隠していない。** macOS 未実測 ／ `MessageBox` そのものは Linux では出ない ／ `/api/health` にアプリ識別子が無いので別ソフトと区別できない ／ 書けない場所ではログを作れない ―― いずれも自分に不利な事実を先に書いている。`E-225` の観点で `git diff --numstat` を読んで新規 12 ファイルが `+N / -0` であることを自分で確認しているのも同じ姿勢である。
8. **`ValidateURL` を委譲の前に必ず通し、回帰テストを 1 パターンから 6 パターンへ増やしている。** 束 E-3 が「委譲のときに外すと関門ごと消える」と警告した点で、拒否側だけを測る(正常系を書くと実際に `xdg-open` が走る)判断も正しい。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 当方で実行した読み取り系コマンドと結果: `go build ./...` 緑 ／ `go vet ./...` 緑 ／ `gofmt -l cmd internal` 出力なし ／ `go test -count=1 ./cmd/... ./internal/config/... ./internal/infra/log/... ./internal/desktop/...` 緑 ／ `make check-windows` 緑 ／ `scripts/check-artifact-integrity.sh` 違反なし ／ `check-stop-discipline` `check-doc-refs` `check-browser-storage-keys` `check-import-order` `check-enum-sync` `check-doc-inventory` `check-completion-report-md-emphasis` `check-instruction-format` `check-public-snapshot` `check-migration-license` いずれも違反なし ／ **`scripts/check-progress-log-index.sh` は違反 1 件**(指摘 高-5)。
- 束 C-1(`MessageBox` が実際に出ること)と 束 D-1(配布 exe で黒窓が出ないこと)は、いずれも Windows 実機でしか最終判定できない。本レビューが判定したのは「そこへ至る経路がコード上で成立しているか」と「機械の門が成果物を守っているか」までである。
- チェックリスト §8 に従い、`internal/desktop/` の Win32 呼び出しの中身・二重起動判別のアルゴリズムの良し悪し・`data-testid` の登録は見ていない。ただし `tray_windows.go` の `RunTray` の戻り値の契約(WM_QUIT で nil)は、本サブの `runResident` が依存しているため読んだ(指摘 中-7)。
- **不明: 既存利用者のブラウザストレージが実際に `http://localhost:<port>` 側に在るかは判断できない**(指摘 高-2)。着手前の `launchBrowser` と `printStartupNotice` がいずれも `localhost` を案内していた事実から可能性が高いと考えるが、実機での確認が要る。
