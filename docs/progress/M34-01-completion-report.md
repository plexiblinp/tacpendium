# M34-01 完了報告: 実査と移植と OS 分離

| 項目 | 内容 |
|------|------|
| 作業 ID | `M34-01` |
| 指示書 | `docs/instructions/M34-01-desktop-port-and-os-split.md` v1.0.0 |
| 上位 | `docs/instructions/M34-overview.md` v1.3.0 |
| 実施日 | 2026-09-09 |
| 着手基点 | `026aa32` |
| CHANGE 消費 | 0 本（設計書は 1 文字も触っていない） |
| マイグレ消費 | 0 本（データに触れない） |
| 新規依存 | 0 件（`go.mod` / `go.sum` の差分 0 行） |
| レビュー | `docs/progress/m34-01-review.md` |

---

## 0. 本サブが達成したこと

Windows 用の足場を、Linux のビルドを壊さずに置いた。黒窓は消していない（`M34-02` の射程）。

完了条件は「Linux でビルドが通り、Windows 用のコードが置かれている」ことであり、トレイは出ない。実際に出ない（`cmd/` へ結線していないため、`internal/desktop` はコンパイルされるだけで誰からも呼ばれない）。

---

## 1. 実査 4 件の結果（指示書 §2.1）

### 実査 1 — CLI サブコマンドが在るか

**無い。**

`cmd/tacpendium/main.go:247` の `main()` は `run()` を呼ぶだけで、`run()` は引数を 1 つも読まない。`flag` パッケージの import は無く、`os.Args` の参照も無い。外部からの入力は環境変数 2 本だけである。

| 経路 | 場所 |
|---|---|
| `TACPENDIUM_CONFIG_PATH` | `cmd/tacpendium/main.go:95`（`resolveConfigPath`） |
| `TACPENDIUM_PORT` | `cmd/tacpendium/main.go:405`（フォールバックポートを保存するかの判定） |

したがって「引数なしの起動を常駐モードとして扱う」案は、既存の挙動と衝突しない。現状では引数なしが唯一の起動形だからである。

**ただし逆向きの注意が 1 件ある。** いまは `flag.Parse()` が無いため、余分な引数は黙って無視される。`M34-02` で引数の解釈を入れた瞬間、それまで無視されていた文字列が意味を持つ。これは仕様変更にあたるので、`M34-02` で扱うこと。

`cmd/seedgen` は `-mode` で分岐を持つが、配布 exe ではない開発時専用の別バイナリである（`cmd/seedgen/main.go:1-5` に明記）。`AttachConsole` の要否には効かない。

### 実査 2 — `golang.org/x/sys/windows` を使うか `syscall` だけで足りるか

**`syscall` だけで足りる。⇒ 新規依存 0 件で通した。**

移植元の Win32 アクセスは全て `syscall.NewLazyDLL` である。呼び出し箇所は 3 つ（`user32.dll` / `shell32.dll` / `kernel32.dll`、いずれも `desktop_windows.go`）。移植元リポジトリ全体で `golang.org/x` の import は 0 件だった。

`go.mod` の現状（実測）:

- `golang.org/x/sys v0.47.0` は **indirect として既に居る**。`go.sum` にもハッシュが揃っている。
- しかし **direct へ昇格させていない。** 昇格は `CLAUDE.md` §6 の事前提案が要る事項である（2026-08-14 開発者裁定）。本サブでは不要なので触っていない。
- 差分は 0 行である（後述 §5）。

### 実査 3 — `DES-001` の配布方針が他 OS を含むか

**含む。⇒ ビルドタグでの分離が本サブの中心になった。**

`DES-001` §2 案C の配布方式は「各OS向けシングルバイナリ（exe / バイナリ）」である。実装側も 3 OS を配布対象として持っている。

| 証拠 | 場所 |
|---|---|
| `build-windows` / `build-darwin` / `build-linux` / `build-all` | `Makefile` |
| 3 成果物の存在を hard-fail で検証 | `.github/workflows/nightly-crossbuild.yml`（`make build-all` → Verify artifacts） |
| `CGO_ENABLED=0` でクロスコンパイルが成立する前提 | `Makefile` の該当注記（`modernc.org/sqlite` が純 Go のため） |

### 実査 4 — 移植元にライセンスファイルが在るか / 第三者由来の断片が無いか

**ライセンスファイルは何も無い。第三者由来の断片も 0 件。**

`M34-overview` §3.2.2 の表でいう「何も無い」の欄に落ちる。したがって §3.2.1 の根拠（著作権者が開発者本人であること）で取り込んだ。

**「確かめた」ではなく、何をどう見たかを以下に挙げる。**

**★母数は `git ls-files`（追跡ファイル）である。⇒ 未追跡物は母数に入らない。** これは限定であって手抜きではない——**リポジトリの内容として配布されるのは追跡ファイルだけ**であり、移植の可否を左右するのもそれだけだからである。

**★★この限定を書く理由（2026-09-09 開発者の実査で判明）。** 開発者がローカルで `find . -iname 'LICENSE*'` を実行したところ **多数ヒットした。全て `projects/combo-export-image/node_modules/` 配下**であり、(a) 同ディレクトリの `.gitignore` により **git 管理外**、(b) **移植元とは別プロジェクト**にローカル導入された依存、の 2 点でいずれも母数外である。**⇒ `find` / `grep -r` で再現しようとすると結論が食い違って見える。再現には下記を使うこと。**

```
git ls-files | grep -iE '(^|/)(LICENSE|COPYING|NOTICE)'   # 0 件
git grep -l "SPDX-License-Identifier"                      # 0 件
git grep -lniE "copyright|©"                               # 0 件
```

**★移植元 `projects/moves-input-tool/` に限れば、未追跡物を含めても 0 件である**（同プロジェクトは Go のみで `node_modules` を持たない）。**⇒ 移植したものの出所については、母数の取り方によらず結論は同じである。**

| 探した場所 | 結果 |
|---|---|
| `LICENSE` / `LICENSE.md` / `COPYING` / `NOTICE` / `*.license`（`git ls-files` の全数） | 0 件 |
| `SPDX-License-Identifier` ヘッダ（`git grep`） | 0 件 |
| `REUSE.toml` / `.reuse/dep5` | 無し |
| `Copyright` / `(c) YYYY` / `©`（`git grep`） | 0 件 |
| `Based on` / `Adapted from` / `Ported from` / `Derived from` / `参考` / `出典` / `引用` / `流用` / `転載` | hit はあるが、全て本体設計書 DES への参照である（`config/fr704-csv.yaml:6` と `SPEC-fr704-intake.md:4`）。残りは「引用符」＝CSV エスケープの説明語 |
| `vendor/` / `node_modules/` / `third_party/` | 無し |
| バイナリ資産（全ファイルへ `file`） | `internal/desktop/icon.ico` の 1 件のみ。`scripts/genicon/main.go` が Go コードから描いて出力した生成物 |
| フロント資産の外部参照（CDN / `@font-face` / `data:base64`） | 0 件 |
| `go.mod` | `gopkg.in/yaml.v3 v3.0.1`（MIT）1 本のみ。Windows 層からは到達しない |

**唯一の外部影響を 1 件、隠さずに書く。** Win32 の定数値と構造体レイアウトは `winuser.h` / `shellapi.h` の転記である（コード中にも `// MessageBoxW uType flags (winuser.h).` と明記されている）。これは著作物性のないインターフェースの事実であり、`golang.org/x/sys` を含むあらゆる Go の Windows コードが同じ値を持つ。実務上の懸念は無いが、外部の成果物が原文に影響した唯一の箇所なので記録しておく。

**アイコンについて。** 移植元の `INTAKE.md` と `scripts/genicon/main.go` の双方が「自作である（第三者素材ゼロ）」と明記している。本サブでは生成器も `cmd/genicon/` へ移植したので、`.ico` はリポジトリ内でソースから再現でき、自作であることを後任が自分で検証できる（§3 参照）。

---

## 2. OS 分離の形（指示書 §2.2）

### 2.1 置いたファイル

`internal/desktop/` を新設した。`internal/` の既存 5 層（`api` / `service` / `repository` / `model` / `infra`）のどれでもない**新しい面**である。層をまたぐ依存を持たず、`cmd/` からも今はまだ呼ばれていない。

| ファイル | ビルド制約 | 中身 |
|---|---|---|
| `desktop.go` | 無し（全 GOOS） | 純粋関数と OS 非依存 API。`TrayMenu` / `TrayItem` / `ValidateURL` / `OpenURL` / `OpenFolder` / `iconImage` / `//go:embed icon.ico` |
| `desktop_windows.go` | `//go:build windows` | `MessageBoxW` による `Alert` / `Confirm`、`spawn`（ヘルパの窓を隠すかの制御） |
| `desktop_other.go` | `//go:build !windows` | スタブ。`RunTray` は `ErrUnsupported`、`Alert` は stderr へ落ちる |
| `tray_windows.go` | `//go:build windows` | `Shell_NotifyIconW` + メッセージ専用ウィンドウ + メッセージループ |
| `tray_sizes_windows_amd64.go` | ファイル名制約（windows かつ amd64） | 構造体サイズのコンパイル時ガード（976 / 80 / 48） |
| `desktop_test.go` | 無し（全 GOOS） | Linux で走るテスト 9 本 |
| `icon.ico` | — | 自作アイコン。`cmd/genicon` の生成物 |

あわせて `cmd/genicon/main.go` を置いた（§3 で理由を述べる）。

**本リポジトリで初めての GOOS ファイル名制約である。** 着手前の実測では `*_windows.go` / `*_linux.go` / `*_darwin.go` は 0 件で、OS 分岐は全て `runtime.GOOS` の実行時 switch だった（`internal/infra/db/db.go:192` ほか）。既存のビルドタグは `debug` と `embed_web` の 2 種類だけだった。

### 2.2 「通ること」を機械で確かめる形にした

指示書 §2.2-2 は「『通った』ではなく、通ることを機械で確かめる形にすること」を求めている。**そのために、まず着手前の状態を測った。**

**★実測して分かった穴 — PR CI は Windows 専用ファイルを 1 度もコンパイルしない。**

`.github/workflows/pr-checks.yml` の 3 job は全て `ubuntu-latest` でタグ無しで走る。したがって `//go:build windows` の付いたファイルは、PR の時点では**存在しないのと同じに見える**。拾えるのは `nightly-crossbuild.yml` の `make build-all` だけで、検出が最大 1 日遅れる。

そこで 2 か所に門を置いた。

| 置いた場所 | 中身 |
|---|---|
| `Makefile` の `check-windows` | `GOOS=windows GOARCH=amd64` で `go build ./...` / `go vet ./...` / `go build -tags=debug ./...` |
| `pr-checks.yml` の `go-vet-build` job | `make check-windows` を 1 ステップ追加。フラグは直書きせず Makefile を正本にした（`nightly-crossbuild.yml` が `make build-all` を呼ぶのと同じ方針） |

`go test` job には触っていない（同 job が総コストの支配項であり、キャッシュの保存者でもあるため）。

**★陽性対照を実測した。** 検査が赤くなることを確かめない限り、その検査は存在しないのと同じである（教訓 `E-84`）。

`tray_sizes_windows_amd64.go` の構造体サイズガードを `976` から `977` へわざと崩して測った。

| 実行したもの | 結果 |
|---|---|
| `make check-windows` | **赤くなった**（意図どおり） |
| `go build ./...`（Linux） | **緑のまま通った** |

崩した箇所は復元し、`sha256` が移植直後と一致することを確かめた（`2548357361...`）。

**⇒ この誤りを検出できる経路は本ゲートだけである**という指示書 §6-1 の懸念が、実測で裏付けられた。

### 2.3 Linux で通ることの実測出力

着手基点 `026aa32` で同じものを先に測ってあり、いずれも緑だった。変更後も緑である。

| 実行したもの | 結果 |
|---|---|
| `go build ./...` | 緑 |
| `go vet ./...` | 緑 |
| `go test -count=1 ./...` | 緑（全パッケージ `ok`） |
| `make check-windows` | 緑 |
| `GOOS=windows GOARCH=amd64 go build -tags=debug ./...` | 緑（デバッグビルドとの組み合わせも確認） |
| `gofmt -l internal/desktop cmd/genicon` | 出力なし（適合） |

`internal/desktop` のテストは Linux で 9 本が走ることを件数で確かめた（パッケージが空で素通りしていないことの確認）。

```
$ go test ./internal/desktop/ -v | grep -cE "^(=== RUN|--- PASS)"
18          # RUN 9 本 + PASS 9 本
ok  	github.com/plexiblinp/tacpendium/internal/desktop	0.003s
```

### 2.4 規約検査

| 検査 | 結果 |
|---|---|
| `scripts/check-artifact-integrity.sh` | 違反なし（※下記の注記あり） |
| `scripts/check-public-snapshot.sh` | 違反なし。**manifest を 1 行も変えずに緑のまま**であり、新設 3 ファイル群が既存の `ALLOW internal/**` と `ALLOW cmd/**` に収まったことを意味する |
| `scripts/check-doc-inventory.sh` | 型に無いファイルなし |
| `scripts/check-migration-license.sh` | 違反なし |
| `scripts/check-md-emphasis.sh <本報告>` | §6 に記載 |

**★`check-artifact-integrity.sh` は最初 1 件の違反を出した。原因は本サブの変更ではなく実行環境である。** `check-md-emphasis.sh --self-test` が `markdown-it-py` の不在で「未実行」となり、自己検査が不合格になっていた。`scripts/` は本サブで 1 行も触っていない（`git diff 026aa32 -- scripts/` が空）。`pip install markdown-it-py` で導入したところ自己検査は合格し、`check-artifact-integrity.sh` も違反なしになった。**クラウド実行環境の素の状態では、1 本目の検査が赤になり、`D-775` の閉じない強調チェックも回せない。** 横断課題として §7 に挙げる。

---

## 3. 移植したファイルの一覧と、その出所（指示書 §2.3 / `M34-overview` §3.2.5）

### 3.1 出所・根拠・実査（`M34-overview` §3.2.5 の 3 点）

| # | 書くこと | 内容 |
|---|---|---|
| 1 | 出所 | 開発者本人の非公開リポジトリ `autopilot-combomgr` の `projects/moves-input-tool`。**ライセンス表示は無い**（実査結果は §1 の実査 4） |
| 2 | 取り込める根拠 | **著作権者が開発者本人であること。** 開発者が本リポジトリの層 A（`AGPL-3.0-or-later`）として配ることを承認した（2026-09-09）。★「ライセンス表示が無いから自由」ではない。第三者のコードにライセンス表示が無ければ全権利留保であって取り込めない |
| 3 | 第三者由来の断片が無いことの実査 | §1 の実査 4 の表が、探した場所と結果の全数である |

### 3.2 ファイルごとの出所（1 行ずつ）

移植元のパスは全て `autopilot-combomgr/projects/moves-input-tool/` からの相対である。

| 移植先 | 移植元 | 移植時の改変 |
|---|---|---|
| `internal/desktop/desktop.go` | `internal/desktop/desktop.go` | パッケージ doc を本体向けに書き換え（移植元の節番号 `§0.11` → `M34`、生成器のパス、移植元を明記する段落を追加）。`M34-02` でやることを現在形で書いていた箇所を未来形へ直した。ロジックは無改変 |
| `internal/desktop/desktop_windows.go` | `internal/desktop/desktop_windows.go` | 節番号の参照のみ。ロジックは無改変 |
| `internal/desktop/desktop_other.go` | `internal/desktop/desktop_other.go` | 「配布対象は Windows のみ」という移植元の前提を、本体の 3 OS 配布（`DES-001`）に合わせて書き換え。コマンド名を `./cmd/tacpendium` へ。ロジックは無改変 |
| `internal/desktop/tray_windows.go` | `internal/desktop/tray_windows.go` | ウィンドウクラス名 `MovestoolTrayWindow` → `TacpendiumTrayWindow`、ウィンドウ題 `movestool` → `tacpendium`。「本体」を別物として指していた注記を修正。ロジックは無改変 |
| `internal/desktop/tray_sizes_windows_amd64.go` | `internal/desktop/tray_sizes_windows_amd64.go` | 無改変 |
| `internal/desktop/desktop_test.go` | `internal/desktop/desktop_test.go` | 節番号の参照のみ。テスト内容は無改変 |
| `internal/desktop/icon.ico` | `internal/desktop/icon.ico` | 無改変（バイナリ同一） |
| `cmd/genicon/main.go` | `scripts/genicon/main.go` | 節番号と使い方の行のパスのみ。**置き場を `scripts/` から `cmd/` へ移した**（理由は §3.3）。生成ロジックは無改変 |

**★「ロジックは無改変」を機械で確かめた。** 上表はコメントの改変を多く挙げているので、コード側が本当に無改変かを、コメント行を除いた差分で測った。

```
$ for f in desktop.go desktop_windows.go desktop_other.go tray_windows.go \
           tray_sizes_windows_amd64.go desktop_test.go; do
    diff <(grep -vE '^\s*//' "$SRC/$f") <(grep -vE '^\s*//' "internal/desktop/$f") | grep -cE '^[<>]'
  done
0  0  0  4  0  0
```

`tray_windows.go` の 4 行だけが差分であり、その中身は意図した識別子の改名 2 件（行 186 の `MovestoolTrayWindow` → `TacpendiumTrayWindow`、行 207 の `movestool` → `tacpendium`）である。**⇒ 上表の「ロジックは無改変」は実測に裏付けられている。**

### 3.3 生成器を `scripts/` ではなく `cmd/` へ置いた理由

`REUSE.toml` の層 C（`MIT`）は `scripts/**` を含む。移植物は層 A（`AGPL-3.0-or-later`）であるべきなので、`scripts/genicon/` へそのまま置くと**ライセンスの層が変わってしまう**。`cmd/**` は層 C のどの列にも当たらず、既定の `path = "**"` にのみ一致して層 A に落ちる。

既存の `cmd/seedgen`（開発時・ビルド時にだけ使う生成器で、配布 exe ではない）と同じ型でもある。

**★再現することを実測した。** 生成器を移植しても、生成物と一致しなければ「自作である」ことの検証経路にならない。

```
$ go run ./cmd/genicon > /tmp/icon-regen.ico
$ sha256sum /tmp/icon-regen.ico internal/desktop/icon.ico
ee9d8fee87dac5d120a2d8efc8f5a5d874e86dd1da558a70db7cde6af21d88f8  /tmp/icon-regen.ico
ee9d8fee87dac5d120a2d8efc8f5a5d874e86dd1da558a70db7cde6af21d88f8  internal/desktop/icon.ico
```

**バイト単位で一致する。⇒ リポジトリ内で唯一レビューできないバイナリが、ソースから再現できる状態になった。** 後任は `M34-overview` §3.2.2 の「第三者由来の断片が無いこと」を、本報告を信じずに自分で確かめられる。

### 3.4 `REUSE.toml` は書き換えていない

**書き換えないことを確かめた**（`M34-overview` §3.2.3 が明示的に要求している）。

- `REUSE.toml` に `internal/**` や `cmd/**` の列は 1 つも無い。
- したがって新設ファイルは既定の `[[annotations]] path = "**"` にのみ一致し、`AGPL-3.0-or-later` になる。これで正しい。
- `git diff 026aa32 -- REUSE.toml` の差分は **0 行**である。

**★層 C（`MIT`）の列へ足してはならない。** アプリ本体をそこへ入れるとライセンスが崩れる。ライセンスの話が出たことだけを覚えている後任が足しかねないので、ここに残す。

`scripts/public-snapshot-manifest.txt` も同様に **0 行差分**である。`ALLOW cmd/**` と `ALLOW internal/**` が既にあるため追記が要らなかった。「型に無い新種のディレクトリは黙って通らない」検査（`check-public-snapshot.sh`）が緑のままであることで裏付けた。

---

## 4. ログと DB の置き場の実測（指示書 §2.4）

### 4.1 実測値

| 対象 | 既定値 | 決めている場所 | 性質 |
|---|---|---|---|
| DB | `%APPDATA%/tacpendium/tacpendium.db` | `internal/infra/db/db.go:191`（`defaultDBPath`） | **絶対パスへ解決される** |
| ログ | `logs/tacpendium.log` | `internal/config/config.go:57` → `internal/infra/log/log.go:38` が lumberjack へ verbatim で渡す | **相対パスである** |
| 設定ファイル | `config.toml` | `cmd/tacpendium/main.go:87` → `os.ReadFile` へそのまま | **相対パスである** |

**★指示書 §2.4 と `M34-overview` §5.1.7 が挙げた `combomgr/combomgr.db` / `logs/combomgr.log` は、改名前の名前である。** 実物は `tacpendium` である（`M28-01` の改名）。設計書どうしの矛盾ではなく設計卓の実測値の陳腐化なので、止めずに進めて本報告で是正した。DB と ログ が別の場所であるという §5.1.7 の結論そのものは変わらない。

### 4.2 実査 1 — 相対パスは何を基準に解決されているか

**プロセスのカレントディレクトリである。実行ファイルの位置ではない。**

`os.Executable()` はリポジトリ全体で **0 件**である（Go ファイルに限らず全ファイルを grep して 0 件）。実行ファイルの位置を基準にしている箇所は 1 つも無い。

アンカーになっているのは 3 種類だけである。

- カレントディレクトリ（`config.toml` と `logs/`）
- `$APPDATA` / `$XDG_DATA_HOME` / `$HOME`（DB）
- 環境変数の明示指定（`TACPENDIUM_CONFIG_PATH`）

### 4.3 実査 2 — 常駐化すると何が壊れるか

**壊れる。** カレントディレクトリ基準なので、起動経路が増えると出先が動く。

| 起動経路 | カレントディレクトリ |
|---|---|
| 開発時の `go run` / ターミナルからの実行 | リポジトリルート（現状はここしか無い） |
| exe のダブルクリック | exe の在るフォルダ |
| ショートカット | ショートカットの「作業フォルダ」欄。既定では exe の場所だが、利用者が変更できる |
| 将来のスタートアップ登録 | `C:\Windows\System32` になりうる |

**帰結が 2 つある。**

1. `M34-02` の「ログフォルダを開く」が、起動経路ごとに別の場所を指しうる。メニュー項目として成立しない。
2. **さらに重い帰結として、`config.toml` も見つからなくなる。** `internal/config/config.go:147` は不在をエラーにせず既定値で続行する仕様なので、**利用者の設定（ポート・LAN 共有モード・パスワード）が黙って無視され、既定値で起動する。** 黒窓が無ければ、それに気づく手掛かりも無い。

### 4.4 実査 3 — 是正の提案（本サブでは実装しない）

**開発者判断（2026-09-09）により、是正は `M34-02` で「ログフォルダを開く」と同時に行う。** 本サブでは案と影響範囲を残す。

検討した案は 3 つである。

| 案 | 中身 | 評価 |
|---|---|---|
| A | `os.Executable()` の在るディレクトリを基準にする | **設計卓の案であり、本命。** ポータブル配布（zip を展開して使う）と噛み合う。ただし `Program Files` へ置かれると書き込めない |
| B | ログも DB と同じ `%APPDATA%/tacpendium/` へ寄せる | 書き込み権限の問題が無く、DB と同じ場所になるので「ログフォルダ」と「DB のフォルダ」を分ける必要が消える（`M34-overview` §5.1.6 の項目 5 が不要になる）。ただし既存利用者のログの出先が変わる |
| C | 相対パスを起動時に絶対へ解決して起動ログに出すだけ（基準は変えない） | 最小だが、問題そのものは残る |

**推奨は A と B の組み合わせである。** 設定ファイルの探索は A（exe の隣を見る。ポータブル配布の前提）、ログの既定は B（書き込み権限が確実な場所）が素直である。ただし**どちらも既存利用者の挙動を変える**ので、`M34-02` で決めること。

**影響範囲**（`M34-02` の見積り用）:

- `internal/config/config.go:57`（既定値）、`:389-412`（`ValidateDataPath` は相対パスを「CWD 下に解決されるから」という理由で常に許可している。基準を変えるならこの判断の根拠も変わる）
- `cmd/tacpendium/main.go:86-99`（`resolveConfigPath`）
- `internal/infra/log/log.go:24-49`（`cfg.File` を verbatim で lumberjack へ渡している箇所）
- `internal/config/config.go:425-437`（`appDataRoots` が `os.Getwd()` を許可ルートに含めている）

**★`M34-overview` §5.1.6 の候補 2 件へ、実査結果から回答できる。**

| 項目 | 回答 |
|---|---|
| 5「DB のフォルダを開く」 | **意味がある。** 現状 DB は `%APPDATA%/tacpendium/`、ログは CWD 配下であり、重ならない。ただし上記の案 B を採るなら重なるので、項目は 1 つで足りる |
| 6「exe のフォルダを開く」 | **現状では「ログフォルダの親」ではない。** ログの基準はカレントディレクトリであり、exe の位置とは無関係である。⇒ §5.1.6 が「親ではないと分かったら、そのとき足すこと」と書いた条件に当たる |

---

## 5. 新規依存が 0 件であることの確認（指示書 §4-5）

```
$ git diff 026aa32 -- go.mod go.sum | wc -l
0
```

**0 行である。** `go.mod` も `go.sum` も 1 文字も動いていない。

- 移植したコードの import は全て標準ライブラリである（`syscall` / `unsafe` / `os` / `os/exec` / `fmt` / `errors` / `runtime` / `sync` / `time` / `net/url` / `encoding/binary` / `embed`）。
- `golang.org/x/sys` は indirect のまま据え置いた（direct 昇格は `CLAUDE.md` §6 の事前提案が要る）。
- 版を固定する仕組み（`replace` / `toolchain` / `pnpm.overrides`）も一切足していない。

---

## 6. 変更統計と自己検査

```
$ git diff --stat 026aa32
 .github/workflows/pr-checks.yml              |  22 ++
 Makefile                                     |  26 +-
 cmd/genicon/main.go                          | 139 ++++++++
 docs/progress/M34-01-completion-report.md    | 455 +++++++++++++++++++++++++++
 docs/progress/m34-01-review.md               | 201 ++++++++++++
 docs/progress/progress-log.md                |  17 +
 internal/desktop/desktop.go                  | 188 +++++++++++
 internal/desktop/desktop_other.go            |  37 +++
 internal/desktop/desktop_test.go             | 156 +++++++++
 internal/desktop/desktop_windows.go          |  81 +++++
 internal/desktop/icon.ico                    | Bin 0 -> 4286 bytes
 internal/desktop/tray_sizes_windows_amd64.go |  25 ++
 internal/desktop/tray_windows.go             | 423 +++++++++++++++++++++++++
 13 files changed, 1769 insertions(+), 1 deletion(-)
```

**新規ファイルは全て `+N -0` である**（教訓 `E-225` の観点で読んだ）。deletions が付いているのは `Makefile` の 1 行だけで、これは `.PHONY` 行へ `check-windows` を足すために書き換えたものである。**新規のつもりのファイルで既存を上書きした箇所は無い。** `docs/progress/progress-log.md` だけは既存の継続更新ファイルへの追記であり、末尾へ足しただけで既存行は編集していない。

`bash scripts/check-md-emphasis.sh docs/progress/M34-01-completion-report.md` の結果は §8 に記す。

---

## 7. 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | CHANGE 番号の登録（`docs/handover/change-number-registry.md` §1 ほか 4 か所） | **不要。** 本サブの CHANGE 消費は 0 本であり、番号を払い出していない |
| 2 | マイグレ連番（ボード §2.2） | **不要。** マイグレ消費 0 本。`migrations/` に触れていない |
| 3 | 版を上げた文書の参照元 | **不要。** 設計書・指示書の版を 1 つも上げていない |
| 4 | `REUSE.toml` | **不要であることを確かめた**（§3.4）。差分 0 行 |
| 5 | `scripts/public-snapshot-manifest.txt` | **不要であることを確かめた**（§3.4）。差分 0 行 |
| 6 | `docs/progress/progress-log.md` | **追記した**（Phase D） |

### 横断課題（他サブ・他マイルストーンへ波及するもの）

| # | 課題 | 宛先 |
|---|---|---|
| 1 | **`gofmt` が着手前から 2 件の非適合を抱えていた。⇒ 開発者判断により本ブランチで是正した**（2026-09-09）。`internal/infra/migration/migrate_m1403f_test.go` と `migrate_m2703_test.go` が Go 1.19 以降の doc コメント整形規則に沿っていなかった（最終更新は `a36df63`＝`M27-03`）。**★着手基点 `026aa32` の時点で PR CI が赤だった**——`pr-checks.yml` の `gofmt` ステップは出力が非空なら明示的に落とす実装である。**★放置すると赤が既定になり、本物の `gofmt` 違反が混ざっても気づけなくなる**（`M24-08` が 27 ファイルを静かに規約外にしたのと同じ型）。**⇒ `M34-01` の射程外であるため独立したコミットに分けた**（`d51ecd3`）。変更は `gofmt -w` の機械的整形のみで、**コード行の差分は 0 件**である | **是正済み**（射程外・別コミット） |
| 2 | **クラウド実行環境に `markdown-it-py` が入っていない。** そのため素の状態では `check-artifact-integrity.sh`（1 本目に回す検査）が赤になり、`D-775` の閉じない強調チェックも「未実行」になる。`pip install markdown-it-py` で解消する。既存の `followup` の `clean-clone-missing-toolchain-deps` と同型である | 改善レーン |
| 3 | **`M34-02` は引数解釈の追加が仕様変更にあたる。** 現状は `flag.Parse()` が無く余分な引数が黙って無視される（§1 実査 1） | `M34-02` |
| 4 | **`scripts/build-windows.ps1` の置き場に論点がある。** `scripts/**` は `REUSE.toml` の層 C（`MIT`）なので、移植物をそのまま置くと層が変わる（§3.3 と同じ理由）。`M34-02` で置き場を決めること | `M34-02` |
| 5 | **★既定ブラウザを開く経路が 2 本になった。`M34-02` で 1 本に決めること。** 本体は既に `github.com/pkg/browser`（BSD-2-Clause・`go.mod` の direct 依存）を持ち、`cmd/tacpendium/main.go:637` の `launchBrowser` が使っている。新設の `desktop.OpenURL` は `rundll32` を自前で叩く別実装である。**★移植元のコメントが挙げる「`cmd /c start` だと黒窓が一瞬出る」という理由は、本体では自前実装を正当化しない**——`pkg/browser` の Windows 実装は `ShellExecute` であって黒窓を出さない。移植元が外部依存 0 本のリポジトリだったという前提が効いている。**両方残すと `CLAUDE.md` §6 の「重複機能ライブラリは導入しない」方針から外れる。** ⇒ どちらを残すかは `M34-02` の判断（配線がそちらの射程のため、本サブではコードを変えていない）。あわせて `launchBrowser` と `printStartupNotice` は `WebEmbedded` でガードされており、タグ無しビルドではブラウザを開かない。`printStartupNotice` の末尾は「終了するにはこのウィンドウを閉じてください。」であり、常駐化したら文面が失効する | `M34-02` |
| 6 | **ログ・設定の相対パス問題**（§4）。`M34-02` の「ログフォルダを開く」の前提である | `M34-02` |
| 7 | **★`SUPP-001` §5.2 の Go パッケージ構成に `internal/desktop/` が無い。** `cmd/` も `tacpendium` しか載っていない。**設計書の編集は製造の手番ではないので、請求だけを残す。** ⇒ 設計伝達レポート §4 へ CHANGE 候補として書くこと。先例は `internal/recipehash/` を §5.2 へ足した `CHANGE-132` | 設計卓（設計伝達レポート §4） |

---

## 8. レビュー結果と取り込み（Phase C）

| 項目 | 内容 |
|---|---|
| レビュー報告書 | `docs/progress/m34-01-review.md` |
| 指摘件数 | 14 件（高 4 / 中 5 / 低 5） |
| **「高」指摘の不採用** | **0 件**（4 件すべて採用した） |
| 再レビュー往復 | 0 回（上限 2 回に対して未使用） |
| `check-md-emphasis.sh` | 本報告に対して**検出 0 行**（ファイル引数モード）。レビュー側の代行実行でも 0 行で一致 |

### 採否と理由

**高（4 件・すべて採用）。** いずれも「移植元の記述が本体では失効している」型であり、動作は正しくテストも lint も型検査も緑のまま通る。人が読む以外に見つける経路が無く、後任が次サブの前提として複製する。**本サブは移植なので、この型が最も出やすい面だった。**

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 高-1 | `desktop.go` と `desktop_test.go` の `--addr` 参照。本体に `flag` は無い | **採用** | 「設定(ホスト・ポート)から組み立てた URL」へ書き換えた。**本報告 §1 実査 1 が自ら「引数を 1 つも読まない」と実証しており、報告本文と移植物のコメントが食い違っていた** |
| 高-2 | `OpenFolder` の godoc「workspace JSON と exported CSV が置かれる場所」 | **採用** | 本体に workspace の概念は無く、CSV は `Content-Disposition: attachment` のダウンロードである。ログファイルと DB の置き場へ書き換え、`M34-overview` §5.1.6 の 2 項目を参照させた |
| 高-3 | `desktop_test.go` の「データフォルダを開く」 | **採用** | `D-792` が「ログフォルダ」へ確定させた撤回済みの名称だった。確定名へ揃え、移植元の名称であることを併記した |
| 高-4 | `cmd/genicon/main.go` の「UI と同じアクセント色(#5b9dd9)」「表の入力ツール」 | **採用** | 本体の `--accent` は `210 40% 96.1%` 等で一致せず、`--bg2` / `--fg` も本体に無い。本アプリは表の入力ツールでもない。事実主張を外し、「移植元の絵柄をそのまま持ち込んでおり本体の UI 配色とは対応していない」と書き直した |

**中（5 件・すべて採用）。**

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 中-1 | `desktop.OpenURL` と既存の `github.com/pkg/browser` でブラウザ起動が 2 本になった | **採用（記録として）** | コードは変えない。**配線は `M34-02` の射程であり、どちらを残すかもそちらの判断**だからである。⇒ §7 の横断課題 5 を書き足し、判断事項として明示した。**移植元のコメントが挙げる「`cmd /c start` だと黒窓が出る」という理由は本体では自前実装を正当化しない**（`pkg/browser` の Windows 実装は `ShellExecute` である）点も記録した |
| 中-2 | `launchCmd` の godoc 1 行目が `browserCommand` の説明になっている | **採用** | 移植元からの複製事故。1 行目を削り、godoc を識別子名で始まる形へ直した |
| 中-3 | `%v` での非 wrap エラーと、引数無し `fmt.Errorf` | **採用** | `CLAUDE.md` §4「エラーは必ず wrap する」。`%v` → `%w`、引数無しの `fmt.Errorf` → `errors.New` |
| 中-4 | `SUPP-001` §5.2 への `internal/desktop/` 追記請求が横断課題に無い | **採用** | 設計書の編集は製造の手番ではないので、請求だけを §7 の横断課題 8 へ足した。先例は `internal/recipehash/` の `CHANGE-132` |
| 中-5 | `check-md-emphasis.sh` の結果が報告に載っていない。変更統計も最終コミット時点へ | **採用** | 本節の表に結果を書き、§6 の変更統計を更新した |

**低（5 件・4 件採用 / 1 件不採用）。**

| # | 指摘 | 採否 | 対応・理由 |
|---|---|---|---|
| 低-1 | テスト値 `C:\work\moves` に移植元の作業パスが残る | **採用** | 本体らしい値（`%APPDATA%` 配下）へ差し替えた |
| 低-2 | `tray_windows.go` のインラインのマジックナンバー 3 点 | **採用** | `wmNull` / `iconFIcon` / `iconVersion3` として、同ファイルの既存の定数群へ揃えた（`CLAUDE.md` 共通規約） |
| 低-3 | `syscall.StringToUTF16` は deprecated で NUL を含む文字列で panic する | **採用** | `UTF16FromString` へ寄せ、変換できない場合は空文字を書いて続行する形にした。**現在の呼び出し元はリテラル由来だが、`M34-02` でツールチップを設定値から組み立てると panic 経路になる**（`CLAUDE.md` §4「パニックは原則使わない」）。⇒ 埋める側が現れる前に塞いだ |
| 低-4 | `check-windows` に `CGO_ENABLED=0` が無く `build-windows` と揃わない | **採用** | 3 行すべてに付けた。現状は無害だが、既存ターゲットと揃える |
| 低-5 | `check-windows` を `make test` から呼ぶか | **不採用** | **`make test` は `test-go` と `test-web` の合成であり、「テストを走らせる」入口である。クロス GOOS のビルド検査をそこへ混ぜると、ターゲットの意味が変わる。** レビュー自身も「実行時間との兼ね合いがあるため必須にはしない」としている。⇒ 門は `pr-checks.yml`（自動・全 PR）に置き、ローカルは `make check-windows` を明示的に叩く形のままとする |

### 取り込み後の再検証

| 実行したもの | 結果 |
|---|---|
| `go build ./...` / `go vet ./...`（Linux） | 緑 |
| `go test -count=1 ./...` | 緑（`FAIL` 0 件） |
| `make check-windows` | 緑 |
| `gofmt -l internal/desktop cmd/genicon` | 出力なし |
| `go run ./cmd/genicon` と `icon.ico` の `cmp` | バイト同一のまま（コメント変更は生成物に影響しない） |

---

## 9. 射程外として手を付けなかったもの

| # | 何を | なぜ |
|---|---|---|
| 1 | `-H=windowsgui` でのビルド | `M34-02`。先にやると失敗時に何も見えない状態で開発することになる |
| 2 | トレイの結線・ブラウザ起動・二重起動の判別・終了確認 | `M34-02`。**移植した時点で動く必要は無い**（指示書 §2.3-3） |
| 3 | `cmd/movestool/console_windows.go`（`AttachConsole`） | `M34-02`。`-H=windowsgui` と一体の話である。★実査 1 より、本体に CLI サブコマンドが無いので `attachStdio` の要否そのものが `M34-02` の判断になる |
| 4 | `scripts/build-windows.ps1` | `M34-02`（横断課題 4） |
| 5 | 待ち受けを `127.0.0.1` へ固定 | 判断 2 で「固定しない」と決着している。LAN 共有が壊れる |
| 6 | ログ・設定の基準の是正 | 開発者判断により `M34-02`（§4.4） |
| 7 | `gofmt` 非適合 2 件の是正 | 射程外（横断課題 1） |

---

## 10. 推測で進めた箇所

| # | 推測 | 確認方法 |
|---|---|---|
| 1 | **推測: ウィンドウクラス名を `TacpendiumTrayWindow` へ改名した。** 移植元の `INTAKE.md` は「移植時に変えるのは `TrayMenu` の文言と `-ldflags` と no-arg 分岐だけ」と書いており改名に触れていないが、ウィンドウクラス名は同一 OS 上で他アプリと衝突しうる識別子なので改名した | `M34-02` の実機確認でトレイが出れば足りる |
| 2 | **推測: アイコンの絵柄は移植元のものをそのまま持ち込んだ。** 移植元の `INTAKE.md` は「本体では差し替える」としているが、差し替えはトレイが実際に出る `M34-02` の判断であり、本サブでは `//go:embed` がコンパイルできることだけが要件である | `M34-02` で絵柄を決める。`cmd/genicon` を書き換えて再生成できる |

---

*以上、`M34-01` 完了報告。* **本サブは黒窓を消していない。消しても開発が止まらない足場を置いた。**
