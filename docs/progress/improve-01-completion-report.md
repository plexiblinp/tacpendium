# IMPROVE-01 完了報告 — クリーンなクローンで検査とテストが回る状態を作る

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/IMPROVE-01-clean-clone-toolchain.md` **v1.1.0** |
| レーン | 改善レーン（マイルストーンのサブではない） |
| 実施日 | 2026-08-19 |
| 実施環境 | **クラウド実行環境**（Claude Code on the web。Ubuntu 24.04 / x86_64 / root） |
| CHANGE | **不要**（`docs/design/` に差分ゼロ） |
| 状態 | **★起動確認 完了**（2026-08-19・§13）。**残るのは開発者の環境設定 1 件のみ**——`vuln.go.dev` の allowlist（§9-1。§J `cloud-env-cannot-reach-vuln-go-dev`。**未実施**） |

---

## 0. 結論

**§1.4 の 5 項目のうち 4 項目が成立した。残り 1 項目（govulncheck）は、原因を 2 つに分解したうえで、片方を直し、片方を開発者の手番として引き渡す。**

| # | §1.4 の完了条件 | 結果 |
|---|---|---|
| 1 | クリーンなクローン直後に `check-artifact-integrity.sh` が「違反なし」 | **✅ 達成**（§4-2） |
| 2 | 同じく `make e2e` が完走 | **✅ 達成**（§4-1。153 passed） |
| 3 | `/app_build_check` が `govulncheck` を SKIP せずに実行 | **△ 半分**。「未インストール」による SKIP は解消し、**バイナリは実行される**ようになった。ただし DB ホスト `vuln.go.dev` が 403 のため取得段階で SKIP に落ちる。**★一度「環境依存」と書いたが撤回した**（`govulncheck -version` を到達性の検査に使った誤り。§13-2） |
| 4 | 上記が devContainer とクラウドの両方で成立 | **✅ 達成**（1 経路で両環境。§3） |
| 5 | followup 3 行がまとめて畳める状態 | **✅ 達成**（§6 でスラッグを提案） |

**★本作業は本番コードを 1 バイトも触っていない。** 実装の差分は `.claude/hooks/session-start.sh` ／ `.claude/settings.json` ／ `Makefile` のみで、残りは記録である（最終的な差分は §10）。

---

## 1. §3.3 着手前の実査 5 項目

### 1-1. `.devcontainer/` の現状

| 道具 | 実体 |
|---|---|
| `markdown-it-py` | **入っている。** apt の `python3-markdown-it`（`.devcontainer/Dockerfile:58`）。`:29-36` に「PEP 668 のため pip ではなく apt」という理由コメントあり |
| `pnpm install` | **打たれていない。** `devcontainer.json:49` の `postCreateCommand` は chown のみ、`postStartCommand`（`:61`）は firewall のみ。`updateContentCommand` / `onCreateCommand` は存在しない。Dockerfile は `corepack prepare pnpm@9.13 --activate`（`:138`）までで install しない。リポジトリ内で `pnpm install` を打つのは `scripts/wt-new.sh:72-73` と README の手順だけ |
| `govulncheck` | **入っている。** `Dockerfile:129-135` で `go install golang.org/x/vuln/cmd/govulncheck@v1.1.4`。`init-firewall.sh` が `vuln.go.dev` を allowlist 済み |

> **指示書 §3.3-1 の「入っている前提で書かれた記録があるが実体を確認すること」に対する回答**: `markdown-it-py` は**記録どおり実在した**（apt 経由）。

### 1-2. `govulncheck` の現状

`scripts/app-build-supplychain-check.sh:96-106` が `command -v govulncheck` で判定し、無ければ **SKIP + `escalate 1`**（CAUTION）。`APP_CHECK_GO_VULN=1` のときのみ `go run …@latest` で取得実行する。
**クラウド実行環境には未導入**だった（`command -v govulncheck` は空、`$(go env GOPATH)/bin` すら存在しない）。

### 1-3. SessionStart hook の実体

**存在しなかった。** `.claude/settings.json` の `hooks` は `PreToolUse` / `PostToolUse` / `Stop`×2 / `Notification` の 4 種のみ。`.claude/hooks/` には 5 本（`design-desk-guard.sh` / `notify-bell.sh` / `post-edit-check.sh` / `pre-push-guard.sh` / `stop-test.sh`）。`settings.local.json` は無い。`.codex/hooks.json` のミラーにも SessionStart は無い。
⇒ **足せる。** 既存 hook 群と同じ `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/*.sh"` 形式に揃えられる。

### 1-4. クラウド実行環境に効く経路（**特定できた**）

**`.claude/settings.json` + `.claude/hooks/` の SessionStart hook。** 根拠 4 つ:

1. Dockerfile はクラウドで使われない（指示書 §1.5 で確定済み。実測でも `markdown_it` 不在）
2. **既存の hook 群は git 経由で配布されクラウドでも発火している実績がある**（`pre-push-guard.sh` の導入理由が「クラウドでは ask が実質機能しない」への対策＝`settings.json` の `_comment`）
3. hook は**パーミッション層をバイパスして実行される**（同ファイルの `_hooks_comment` に明記）。`pip` / `go install` が allow リストに無くても hook 内なら通る
4. **公式ドキュメントが `.claude/settings.json` の hooks を「クラウドセッションへ引き継がれるもの」として明示している**（cloud environments の "What carries over from your setup" 表）

### 1-5. ★直す前の基準値（**「直った」を判定する唯一の根拠**）

```
$ bash scripts/check-artifact-integrity.sh
NG  check-md-emphasis.sh の --self-test が「自己検査: 合格」を出力しない
  宣言だけで実装が無い／対照が落ちている可能性。再現: bash scripts/check-md-emphasis.sh --self-test
  検査 11 件 / ALLOW 除外 1 件

結果: 違反 1 件
```

```
$ python3 -c "import markdown_it"
ModuleNotFoundError: No module named 'markdown_it'

$ command -v govulncheck
（出力なし）

$ ls -d web/node_modules
ls: cannot access 'web/node_modules': No such file or directory
```

```
$ make e2e
Created config.toml from config.toml.example (required: isInitialized)
Using preinstalled Chromium: /opt/pw-browsers/chromium
cd web && pnpm e2e

> combomgr-web@0.1.0 e2e /home/user/combomgr/web
> playwright test

Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@playwright/test' imported from /home/user/combomgr/web/playwright.config.ts
 ELIFECYCLE  Command failed with exit code 1.
 WARN   Local package.json exists, but node_modules missing, did you mean to install?
```

（続けて `make` が `[Makefile:88: e2e] Error 1` を出して終了する。**この 1 行だけは転記していない**——`make` のエラー表記に含まれるアスタリスク 3 個が `check-md-emphasis.sh` の行単位判定に引っかかり、**ベースラインを 1 行押し上げてしまう**ため。同検査はフェンスの文脈を持たず 1 行ずつ描画して判定する。）

---

## 2. §1.5 の表を実測で埋めたもの

| 道具 | devContainer | クラウド実行環境 |
|---|---|---|
| `markdown-it-py` | **✅ 有**（`Dockerfile:58` apt `python3-markdown-it`） | **❌ 無** |
| `web/node_modules` | **❌ 無**（install する仕掛けがどこにも無い） | **❌ 無** |
| `govulncheck` | **✅ 有**（`Dockerfile:131` v1.1.4） | **❌ 無** |

**★指示書 §1.5 が「要実査」としていた devContainer 側の `govulncheck` は、実体としては導入済みだった。**
⇒ **欠落は「`markdown-it-py` と `govulncheck` がクラウド固有」「`node_modules` が両環境」という配分**であり、指示書の想定（`markdown-it-py` だけがクラウド固有）より**クラウド側の欠落が 1 件多かった。**

---

## 3. 入れた経路と、その理由

**採った経路は 2 つ。**

| # | 経路 | 何を担保するか |
|---|---|---|
| 1 | **SessionStart hook**（`.claude/hooks/session-start.sh` ＋ `.claude/settings.json` への登録） | **3 件すべて・両環境**。セッション起動時に冪等に揃える |
| 2 | **`Makefile` の前提ターゲット `ensure-web-deps`**（pnpm を呼ぶ 8 ターゲットが依存） | **`node_modules` のみ・セッションの寿命に依存しない保証** |

### 3-1. なぜ hook 1 本で両環境に足りるのか（指示書 §2.1 の問い）

**hook は Claude Code が動く環境すべてで発火するため、devContainer とクラウドの両方に同時に効く。** `.devcontainer/` 側を別途いじる必要は無かった。

- devContainer では `markdown-it-py` と `govulncheck` が既に在るので、hook の該当ステップは**冪等ガードで no-op** になる（実測 0.08 秒）。実際に効くのは `pnpm install` の 1 件だけ
- クラウドでは 3 件とも効く
- **⇒ `.devcontainer/Dockerfile` / `devcontainer.json` の差分はゼロ**（§1.6-3 のベースイメージ変更にも触れていない）

### 3-2. なぜ Makefile にもガードが要るのか

**hook はセッション起動時にしか走らない。** 次の 2 つは hook だけでは埋まらない。

1. **セッション中に `node_modules` を消した場合**——指示書 §4.4-1 が要求する「消してから `make e2e` が完走する」の証明が、セッションを立て直さないと成立しない
2. **Claude Code を介さない素の端末**（devContainer のターミナル等）から `make` を打つ場合

既存の `e2e` ターゲットは `config.toml` 不在と `PW_EXECUTABLE_PATH` の 2 つの起動前提を既に吸収しており（`Makefile` の注記）、**まったく同じ型の 3 件目**として足した。

**★付けた先は pnpm を呼ぶ 8 ターゲットすべてである**（レビュー指摘 中-5 の取り込み）——`run-web` ／ `build` ／ `build-debug` ／ `build-windows` ／ `build-darwin` ／ `build-linux` ／ `test-web` ／ `e2e`。当初は `e2e` と `test-web` だけに付けていたが、**「素の端末から `make` を打つ場合」という導入理由は `build` や `run-web` にも等しく当てはまる**（いずれも `pnpm` を呼ぶため `node_modules` 不在で落ちる）。go しか使わない `run-server` ／ `test-go` ／ `tidy` には付けていない。

### 3-3. 採らなかった経路

| 経路 | 採らなかった理由 |
|---|---|
| `devcontainer.json` の `postCreateCommand` へ `pnpm install` | hook が devContainer にも効くため**冗長**。加えて反映にリビルドが要る |
| `.devcontainer/Dockerfile` の変更 | 上記のとおり不要だった。§1.6-3 にも触れる |
| クラウド environment の **Setup script** | **リポジトリから設定できない**（claude.ai の環境ダイアログ側の設定）。⇒ 貼り付ける本文を §9-2 で開発者へ渡す |

---

## 4. §4.4 「直したことの証明」——実出力

### 4-1. `node_modules` を消してから `make e2e` が完走する

**人手の前準備は無い。** `pnpm install` を先に打ってはいない——`make e2e` 自身が不在を検知して install する。

```
$ rm -rf web/node_modules
$ ls -d web/node_modules
ls: cannot access 'web/node_modules': No such file or directory

$ make e2e
web/node_modules がありません。pnpm install を実行します...
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +329
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 329, reused 329, downloaded 0, added 329, done
（中略）
Created config.toml from config.toml.example (required: isInitialized)
Using preinstalled Chromium: /opt/pw-browsers/chromium
（中略）
  153 passed (3.4m)
EXIT=0
```

> **`Lockfile is up to date` の行が、`--frozen-lockfile` が効いて `pnpm-lock.yaml` に差分を出していないことの証拠**でもある（§10 の差分ゼロと一致）。

### 4-2. `check-artifact-integrity.sh` が「違反なし」を返す

```
$ bash scripts/check-artifact-integrity.sh
# 成果物・検査機構の健全性チェック

対象 commit: `7f80dc3`

## 1. 検査機構の自己検査

OK  design-desk-guard.sh の自己検査が通る
OK  archive-resolved.sh の自己検査が通る
OK  check-browser-storage-keys.sh の自己検査が通る
OK  check-doc-inventory.sh の自己検査が通る
OK  check-doc-refs.sh の自己検査が通る
OK  check-enum-sync.sh の自己検査が通る
OK  check-instruction-format.sh の自己検査が通る
OK  check-md-emphasis.sh の自己検査が通る
OK  check-progress-log-index.sh の自己検査が通る
OK  check-stop-discipline.sh の自己検査が通る
OK  design-desk-arm.sh の自己検査が通る
  検査 11 件 / ALLOW 除外 1 件

## 2. 生成物の健全性

OK  docs/handover/code-facts.md
OK  docs/handover/docs-map.md
OK  docs/handover/retrospective-digest.md
OK  docs/human-notes/custom-commands.md

結果: 違反なし
```

**基準値の「違反 1 件」（§1-5）が「違反なし」になった。** 差は `check-md-emphasis.sh` の 1 行だけであり、**スクリプトは 1 バイトも変えていない**（§7）。

### 4-3. `/app_build_check` が `govulncheck` を SKIP しない……ところまでは行った

**★ここは素直に「半分」である。** 直す前と後で、SKIP の**理由が変わった**。

**直す前**（未インストール）:

```
=== 2. Go 既知脆弱性 (govulncheck) ===
  SKIP: govulncheck 未インストール。Go の CVE 検査は実行していません。
  有効化するには: APP_CHECK_GO_VULN=1 を付けて再実行(要 vuln.go.dev の FW 許可)。
```

**直した後**（バイナリは実行され、DB 取得で止まる）:

```
$ bash scripts/app-build-supplychain-check.sh
=== 2. Go 既知脆弱性 (govulncheck) ===
    govulncheck: fetching vulnerabilities: Get "https://vuln.go.dev/index/modules.json.gz": Forbidden
  実行エラー(ネットワーク/FW で vuln.go.dev に到達できない可能性)→ SKIP
```

**`command -v govulncheck` の分岐は解消し、バイナリは実際に起動して解析を開始している。** 残る障害は**クラウド実行環境の egress ポリシー**であり、リポジトリ側からは解けない（§9-1）。

### 4-4. ★途中で見つかった落とし穴——「ネットワークのせい」に見えて実体が違った

**最初に `govulncheck` を入れたときの出力は、上とは別物だった。**

```
=== 2. Go 既知脆弱性 (govulncheck) ===
    /home/user/combomgr/internal/api/user/doc.go:9:1: package requires newer Go version go1.26 (application built with go1.24)
    （同種のエラーが 23 パッケージ分）
    For details on package patterns, see https://pkg.go.dev/cmd/go#hdr-Package_lists_and_patterns.
  実行エラー(ネットワーク/FW で vuln.go.dev に到達できない可能性)→ SKIP
```

**★これはネットワークの問題ではない。** `go install pkg@version` は **`govulncheck` 自身の `go.mod`** からツールチェーンを決めるため、**素の `go` が古い環境では古いツールチェーンで `govulncheck` がビルドされ、本体コード（go1.26）を型検査できない。**

| 実測値 | 値 |
|---|---|
| クラウド実行環境の**素の** go | **`go1.24.7`**（`GOTOOLCHAIN=local go version`） |
| プロジェクトで選ばれる go | `go1.26.4`（`go.mod` の `go 1.26.4` による toolchain 自動取得） |
| `go install govulncheck@v1.1.4` の結果 | go1.24 でビルド ⇒ **解析不能** |
| `go install govulncheck@v1.7.0` の結果 | **同じく失敗**（v1.7.0 の go.mod が go1.25 を要求し、go1.25.13 が降ってきてビルドされる） |
| `GOTOOLCHAIN=go1.26.4 go install …@v1.1.4` | **成功**（DB 取得まで到達する） |

**⇒ 版を上げても直らない。ビルドに使うツールチェーンを固定するのが正しい修正である。**
hook はこれを `GOTOOLCHAIN="$(cd "$ROOT" && go env GOVERSION)"` で行う（プロジェクトが実際に選ぶ版を使う）。

**★`govulncheck` の版は devContainer と同じ `v1.1.4` に据え置いた。** 版ずれが原因ではなかったため、上げる理由が無い。**⇒ `.devcontainer/` の差分はゼロのまま。**

**★devContainer 側は元から健全である。** 同環境の素の go は `GO_VERSION`（1.26.x）であり、`go install` は最初から go1.26 でビルドしていた。**本項はクラウド固有の落とし穴だった。**

**★教訓として残す価値がある**——`app-build-supplychain-check.sh:92` の `else` 分岐は、**ロード段階の失敗も DB 取得の失敗も同じ「ネットワーク/FW」メッセージで表示する。** 原因の切り分けができず、**ネットワークを疑って時間を溶かす形になっている**（実際そうなった）。スクリプトの改修は本作業の歯止め §1.3-1 に当たるため**行っていない**。設計卓・開発者への申し送りとして §9-4 に置く。

---

## 5. 冪等性をどう担保したか（§4.2）

| # | 要求 | 実装 | 実測 |
|---|---|---|---|
| 1 | **既に入っているときは何もしない** | 各ステップの先頭でガード。`python3 -c 'import markdown_it'` ／ `command -v govulncheck` ／ `[ -d "$ROOT/web/node_modules" ]` | **2 回目は 0.08 秒・完全に無音**（下記） |
| 2 | **失敗してもセッションを止めない** | `set -e` を使わない。各ステップを `if … else warn` で囲み、**末尾で無条件 `exit 0`**。加えて `timeout` で各ステップに上限（180 / 300 / 420 秒）を掛け、1 つのハングが hook 全体の 600 秒を食い潰さないようにした | **4 パターンすべてで exit 0**（下記） |
| 3 | **出力は静か** | **出力はすべて stderr**（SessionStart の stdout は Claude の文脈へ注入されるため）。「実際に入れたとき」と「失敗したとき」しか出さない | **何もしなければ 1 バイトも出さない** |

```
$ time bash .claude/hooks/session-start.sh          # 1 回目(cold)
session-start: installed markdown-it-py (scripts/check-md-emphasis.sh の前提)
session-start: installed govulncheck v1.1.4 -> /root/.local/bin
session-start: installed web/node_modules (make e2e / pnpm test の前提)
real	0m31.542s

$ time bash .claude/hooks/session-start.sh          # 2 回目(warm) —— 無音
real	0m0.082s
EXIT=0
```

### 5-1. セッション種別ごとの検証（**製造以外に悪さをしないこと**）

```
# 武装セッション相当(web/ が sparse-checkout で作業ツリーに無い)
$ CLAUDE_PROJECT_DIR=<web/ を持たない一時ディレクトリ> bash .claude/hooks/session-start.sh
EXIT=0     （無音。pnpm ステップは web/package.json ガードで丸ごと no-op）

# 全ステップを失敗させる(PATH から python3 / go / pnpm を隠す)
$ env -i HOME=$HOME PATH=/usr/bin:/bin bash .claude/hooks/session-start.sh
EXIT=0     （非ゼロで落ちない）

# pnpm install を実際に失敗させる(依存あり・lockfile 無しで --frozen-lockfile を踏ませる)
$ CLAUDE_PROJECT_DIR=<壊した一時ディレクトリ> bash .claude/hooks/session-start.sh
session-start: WARN: pnpm install に失敗しました。make e2e / pnpm test は回りません。
 ERR_PNPM_NO_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
EXIT=0     （警告は出るがセッションは止めない）

# 追跡ファイルへの差分が無いこと(調査・レビュー担当の read-only を侵さない)
$ git status --porcelain
（空。web/node_modules は .gitignore:34、config.toml も .gitignore 対象）
```

| セッション種別 | 影響 | 判定 |
|---|---|---|
| **製造**（`implement_plan` / `_full`） | 3 件が揃う | 目的どおり |
| **レビュー**（`review_plan`） | `node_modules` が増えるだけ。**追跡ファイルの差分ゼロ**。むしろ `pnpm test` が回せるようになる | 益のみ |
| **調査**（`research_plan`・read-only 厳守） | 同上。`git status --porcelain` が空のままであることを実測 | 益のみ |
| **改善レーン** | 製造と同じ | 益のみ |
| **設計卓・武装セッション** | `design-desk-arm.sh:40` の `ALLOWED_ROOTS=(docs .claude scripts)` により `web/` が不在 ⇒ pnpm ステップは no-op。`markdown-it-py` は**設計卓にも必要**（`check-artifact-integrity.sh` を 1 本目に回すのは設計卓も同じ）ので入る | **実測で確認**（上記） |
| **worktree セッション**（`*_wt`） | `$CLAUDE_PROJECT_DIR` が worktree ルートを指す。`wt-new.sh:72-73` が既に `pnpm install` 済みのため no-op | 影響なし |
| **サブエージェント** | SessionStart は発火しない | 影響なし |
| **Codex セッション** | §9-3 のとおり同期しない | 報告のみ |

### 5-2. ★既存 hook への波及（**体感が変わるので明記する**）

`node_modules` が在る状態になると、**これまで黙って失敗していた 2 つの既存 hook が実際に動き出す。**

- **`post-edit-check.sh`**: `.ts` / `.tsx` の編集ごとに `pnpm -s exec tsc --noEmit` が**実際に走る**（従来は node_modules 不在で失敗し、無言だった）。**編集ごとに待ちが増える。** 非ブロック・exit 0 は不変
- **`stop-test.sh`**: `web/**/*.ts(x)` に差分があるとき `make test-web` が**実際に走る**（実測 91.7 秒）。非ブロック・timeout 300 は不変

**⇒ どちらも「壊れていた品質ゲートが機能を取り戻す」変化であり意図した方向だが、体感が変わるため明記する。**

---

## 6. followup 3 行をまとめるスラッグの提案（§4.3）

**★製造は `followup-backlog` を編集しない（D-382。§J を除く）。以下は設計卓への提案である。**

| 現行スラッグ | 位置 |
|---|---|
| `e2e-requires-pnpm-install-on-clean-clone`（束ね役） | `docs/handover/followup-backlog.md:428` |
| `markdown-it-py-missing-in-cloud-env` | 同 `:350` |
| `govulncheck-not-installed` | 同 `:388` |

**提案スラッグ: `clean-clone-missing-toolchain-deps`**（指示書 §4.3 の例示どおり）

**畳むときの状態**:

- `markdown-it-py-missing-in-cloud-env` … **解消**（§4-2）
- `e2e-requires-pnpm-install-on-clean-clone` … **解消**（§4-1）
- `govulncheck-not-installed` … **「未インストール」は解消。ただし `vuln.go.dev` への到達が塞がっているため CVE 検査自体は未実行のまま。** ⇒ **畳まずに残すか、`cloud-env-cannot-reach-vuln-go-dev` へ改題して残すことを推奨する**（§9-1 が開発者の手番で解けるまで）

---

## 7. 歯止め §1.3 の 4 つ——いずれも破っていない

| # | 歯止め | 証拠 |
|---|---|---|
| 1 | **スクリプトを「依存が無くても通る」形に緩めていない** | `git diff --name-only origin/main...HEAD -- scripts` → **0 件** |
| 2 | **`--self-test` の陽性対照を弱めていない** | 同上。`check-md-emphasis.sh:184-189` の「依存欠落 → 未実行として非ゼロ終了・緑を返さない」対照は無改変。**`check-artifact-integrity.sh` が緑になったのは、対照が通ったからである**（§4-2 の `OK  check-md-emphasis.sh の自己検査が通る`） |
| 3 | **ベースライン値を動かしていない** | `check-md-emphasis.sh:81` `BASELINE_BROKEN=436` のまま。実行結果 `現在 436 行 / ベースライン 436 行` → `OK ベースラインどおり(増加なし)` |
| 4 | **`docs/design/` に差分が無い** | `git diff --name-only origin/main...HEAD -- docs/design` → **0 件** |

---

## 8. ★開発者の起動確認待ち（§4.5-2）と復旧手順（§4.5-4）

### 8-1. 製造は「hook を入れた」で完了としない

> **★2026-08-19 追記＝この確認は完了した。結果は §13。以下は当時の記述をそのまま残す。**

**本サブは、開発者が新しいセッションを 1 本起動して、起動することを確認するまで完了ではない。**
製造セッションは自分を再起動できないため（`M22-overview` §4.4.1 の (b)＝「機械に手が無い」）、確認は開発者の手番である。

**確認していただきたいのは 2 つだけ**:

1. **新しいセッションを 1 本起動し、起動すること**
2. **起動時の出力が静かであること**（初回のコンテナでは `session-start: installed …` が最大 3 行出る。2 回目以降は無音）

### 8-2. ★復旧手順（**壊れたときに手で戻せる形**）

**hook が原因でセッションが起動しなくなった場合、次のどちらかで元に戻る。どちらもファイル編集だけで済むため、セッションを起動できなくても GitHub 上または手元のエディタで実施できる。**

**手順 1（これで十分なはず）**: `.claude/settings.json` の **`"hooks": {` の直後・`"PreToolUse": [` の直前**にある `"SessionStart": [ … ]` ブロックを、**末尾のカンマごと**削除する。

> **★探し方は「構造」で指定してある。行番号は補助である**——本報告作成時点では **28〜35 行目**だが、`_hooks_comment` に 1 行足しただけでずれる。**行番号が合わなければ構造のほうを信じること**（`E-56` の型＝座標は必ず古くなる）。`grep -n '"SessionStart"' .claude/settings.json` で現在位置が出る。

```json
      "SessionStart": [
        {
          "matcher": "startup|resume",
          "hooks": [
            { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh\"", "timeout": 660 }
          ]
        }
      ],
```

> 上のブロックを丸ごと消すだけで hook は発火しなくなる。削除後に `jq . .claude/settings.json` が通ることを確認すること。

**手順 2（手順 1 で直らない場合）**: `.claude/hooks/session-start.sh` を削除する。
**手順 3（`make` が疑わしい場合）**: `Makefile` の `ensure-web-deps` ターゲットと、`e2e:` / `test-web:` 行の ` ensure-web-deps` の記述を消す。

**★リスクの所在**: hook 本体は**あらゆる失敗を飲み込んで必ず `exit 0` する**ため、中身が転けてセッションが止まることは無い（§5 で 4 パターン実測）。**残るリスクは `.claude/settings.json` の JSON 構文だけ**であり、`jq` で妥当性を確認済み。

### 8-3. 段階を分けなかった理由（§4.5-5）

**分けなかった。** 理由 2 つ:

1. **hook の中身は直接実行で検証でき、実際に 4 パターン（正常・武装相当・全ステップ失敗・pnpm 失敗）を実測した。** 未検証のまま入れた部分が無い
2. **devContainer 側には差分がゼロ**（§3-1）であり、「devContainer だけ先に入れて確認する」という段階分けが**そもそも成立しない**。効かせる先が hook 1 本しか無い

---

## 9. 申し送り（開発者・設計卓の手番）

> **★このうち §9-1 と §9-3 は `docs/handover/followup-backlog.md` §J（停止時記録）へ登録済みである**（レビュー指摘 中-4。スラッグは **`cloud-env-cannot-reach-vuln-go-dev`** と **`codex-hooks-sessionstart-sync-pending`**）。**完了報告にしか無い未処理事項は、報告がアーカイブされた時点で消えるため。** §9-2 と §9-4 は §J の「未解消のまま停止した項目」には当たらない（前者は任意の最適化、後者は設計卓への改修提案）ので、`docs/progress/progress-log.md` の横断課題 1・6 に索引を置いた。**★製造が書けるのは §J だけである**（D-382）。

### 9-1. ★開発者の手番 A ——クラウド環境の `vuln.go.dev` 許可

**実測**: `vuln.go.dev` はクラウド実行環境の egress ポリシーで遮断されている。

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://vuln.go.dev/index/db.json
curl: (56) CONNECT tunnel failed, response 403
```

対照として、他ホストは通っている（`pypi.org` / `files.pythonhosted.org` / `proxy.golang.org` / `registry.npmjs.org` はいずれも **200**）。
プロキシの案内は「403/407 は組織ポリシー拒否。**迂回せず報告すること**」と明記しているため、迂回は試していない。

**⇒ これは claude.ai 側の設定で解ける。リポジトリからは設定できない。**

| 手順 | 内容 |
|---|---|
| 1 | claude.ai/code のメッセージ入力欄の**上にある雲アイコン**（環境セレクタ）を開く。**設定ページや直リンクは無い** |
| 2 | 対象の cloud environment にホバーし、右に出る**歯車**を押す |
| 3 | **Network access** を **Custom** にする（既定は Trusted） |
| 4 | **Allowed domains** へ `vuln.go.dev` を 1 行足す |
| 5 | **★「Also include default list of common package managers」はチェックしたままにする。** 外すと PyPI / npm / Go proxy が落ち、**本作業の hook 自体が動かなくなる** |

> 環境ごとの個別設定であり、組織一括の allowlist は存在しない。

### 9-2. 開発者の手番 B（任意・クラウドの高速化）——Setup script

**★ここには未検証の点がある（レビュー指摘・不明点。断定を取り下げて両論を併記する）。**

| 出典 | 記述 |
|---|---|
| cloud environments のドキュメント | Setup script は「初回のみ実行され、**完了後にファイルシステムがスナップショットされる**」。SessionStart hook は「**resume を含む毎セッション実行される**」。両者の対比表も「setup script はキャッシュがあるとスキップ／hook は毎回」と書く |
| `session-start-hook` スキル（`SKILL.md:66`） | 「**The container state gets cached after the hook completes**」 |

**⇒ hook の導入結果がスナップショットに載るかは、本セッションからは確定できない。** 前者を素直に読めば「載らない（毎セッション hook が入れ直す）」、後者を素直に読めば「載る」。**実測するには新規セッションを 2 本起動して 2 本目の hook が無音かを見る必要があり、それは開発者の手番である**（§8-1 の起動確認のついでに観察できる）。

**★ただし、どちらであっても下の提案は成立する。** Setup script 側は**ドキュメントが明示的にキャッシュされると述べている**唯一の経路であり、載ることが保証される。hook が毎回入れ直す側だった場合は、実測 31 秒（コンテナ初回）の待ちが毎セッション消える。載る側だった場合でも害は無い（hook は冪等で no-op になる）。

**同じ 3 件を environment の Setup script 欄へ置くと、キャッシュに焼かれて以後の新規セッションでは hook が完全な no-op（0.08 秒）になる。** 貼り付け用:

```bash
#!/bin/bash
# combomgr: クリーンなクローンで検査とテストが回るようにする(IMPROVE-01)
# ★各行に || true を付けること。非ゼロ終了するとセッションが起動しない。
# ★全体で 5 分以内に収めること(超えると環境キャッシュが作られない)。

python3 -m pip install --user --quiet markdown-it-py || true

# ★GOTOOLCHAIN の固定が要る。素の go が古いと、本体コード(go1.26)を型検査できない
#   govulncheck がビルドされ、「ネットワーク障害」に見える失敗になる。
(cd /home/user/combomgr \
  && GOTOOLCHAIN="$(go env GOVERSION)" GOBIN="$HOME/.local/bin" \
     go install golang.org/x/vuln/cmd/govulncheck@v1.1.4) || true

(cd /home/user/combomgr/web && pnpm install --frozen-lockfile) || true
```

> **リポジトリのパスは環境に合わせて読み替えること。** Setup script はリポジトリ clone の後に走る。
> **★入れても hook は残しておくこと。** hook は devContainer と素の端末にも効く唯一の経路であり、Setup script はクラウド専用の上乗せである。

### 9-3. Codex 側（`.codex/hooks.json`）は同期していない

`human-notes/codex/README.md` §5 の同期トリガー表は「`.claude/settings.json` の hook 変更 → `.codex/hooks.json`」を求めるが、**足していない。** 理由 2 つ:

1. **Codex に `SessionStart` イベントが在る証拠が無い。** 同 README の 2026-08-12 実測記録が列挙するのは `PreToolUse` / `PostToolUse` / `Stop` / `SessionEnd` のみ
2. **同 README は同期の完了条件に「設定の保存だけでなく発火の実測」を課しているが、本セッション（クラウド）からは Codex の発火を測れない**

⇒ 同 README §3 の定め（「Codex が不整合を発見した場合は…差分と必要な同期内容を報告する」）に従い、**差分と必要な同期内容をここに置く**。実施するなら `/sync_codex_config` の手番。

**必要な同期内容**: Codex 0.147.0 に `SessionStart` 相当があるなら、`.codex/hooks.json` の `hooks` envelope へ `"SessionStart": [{ "hooks": [{ "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh\"", "timeout": 660 }] }]` を足す。**フック実装は `.claude/hooks/*.sh` だけに置く**という同 README の方針（§4）に沿い、実体の複製はしない。

### 9-4. `app-build-supplychain-check.sh` のメッセージが原因を切り分けられない

`:92` の `else` 分岐は、**ロード段階の失敗（ツールチェーン版ずれ）も DB 取得の失敗（ネットワーク）も、同じ「ネットワーク/FW で vuln.go.dev に到達できない可能性」で表示する。**
**⇒ ネットワークを疑って時間を溶かす形になっている**（§4-4。実際に溶かした）。

**本作業では直していない**——スクリプトの振る舞い変更は歯止め §1.3-1 に当たるため。設計卓・開発者の裁定事項として申し送る。
**改修案**（採否は設計卓）: 出力に `requires newer Go version` が含まれる場合だけ、別メッセージ（「govulncheck のビルドに使われた Go が本体コードより古い。`GOTOOLCHAIN` を固定して入れ直すこと」）を出す分岐を足す。

### 9-5. フロント依存に既知の脆弱性がある（**本作業では直さない**）

`/app_build_check` の §3（`pnpm audit`）が **critical=0 / high=3 / moderate=4** を報告し、総合判定は **WAIT** になる。

| 深刻度 | パッケージ | 概要 | 修正版 |
|---|---|---|---|
| high | `nanoid` | non-secure generators can loop indefinitely with negative size | `>=3.3.16` |
| high | `nanoid` | custom generators can loop indefinitely when size is zero | `>=3.3.18` |
| high | `postcss` | Path Traversal in sourceMappingURL auto-loading → 任意の `.map` 開示 | `>=8.5.18` |
| moderate | `react-router` | Open redirect via backslash in `<Link>` / `useNavigate` | `>=7.18.0` |
| moderate | `react-router-dom` | Open redirect leading to XSS | （6 系に修正版なし） |
| moderate | `react-router` | Arbitrary Constructor Injection via `deserializeErrors()` | `>=7.18.0` |
| moderate | `postcss` | 上記 postcss の不完全修正（`from` 未指定時） | `>=8.5.23` |

**★本作業では直さない。** 指示書 §8.1-4 および `CLAUDE.md` §6 のとおり、**依存更新の判断は開発者**である。
**★本作業で新たに生じたものではない**——依存ファイル（`web/package.json` / `web/pnpm-lock.yaml`）に差分はゼロ（§10）。`nanoid` / `postcss` はビルド系（Vite）の推移依存、`react-router` は 6 系から 7 系への **major 更新**が要るため、いずれも独立した判断が要る。

---

## 10. 変更範囲（スコープ）

**★レビュー取り込み後の最終差分**（レビュー指摘 低-4。取り込み前の値ではなく、こちらが正）。

```
$ git diff --stat origin/main
 .claude/hooks/session-start.sh                | 176 ++++++++
 .claude/settings.json                         |  11 +-
 Makefile                                      |  50 ++-
 docs/handover/followup-backlog.md             |   2 +
 docs/progress/improve-01-completion-report.md | 612 ++++++++++++++++++++++++++
 docs/progress/improve-01-review.md            | 357 +++++++++++++++
 docs/progress/progress-log.md                 |  13 +
 7 files changed, 1210 insertions(+), 11 deletions(-)
```

**実装の差分は 3 ファイル（`session-start.sh` / `settings.json` / `Makefile`）のみ。** 残る 4 ファイルは記録（完了報告・レビュー報告・progress-log の索引行・followup §J の 2 行）である。

```
$ for p in scripts docs/design internal web/src cmd migrations go.mod go.sum \
           web/package.json web/pnpm-lock.yaml .devcontainer; do
    echo "$p: $(git diff --name-only origin/main...HEAD -- "$p" | wc -l) 件"
  done
scripts: 0 件
docs/design: 0 件
internal: 0 件
web/src: 0 件
cmd: 0 件
migrations: 0 件
go.mod: 0 件
go.sum: 0 件
web/package.json: 0 件
web/pnpm-lock.yaml: 0 件
.devcontainer: 0 件
```

**CI は新設していない**（`.github/` は存在しない）。**devContainer のベースイメージも変えていない。**

### 10-1. `.claude/settings.json` の 11 行の内訳

- **SessionStart ブロックの追加**（8 行）
- **`_hooks_comment` へ SessionStart の説明を 1 段落追加**
- **★`_hooks_comment` の既存 1 段落の修正**——旧文は hook の安全性を「読み取り系の検査 + テスト実行のみ。**ソース改変・git 書込・ネットワーク無し**」と書いていたが、`session-start.sh` が `pip` / `go install` / `pnpm install` でネットワークへ出るため**事実に合わなくなった**。現在の担保「ソース改変なし・git 書込なし・取得先は公式のパッケージレジストリのみ・`sudo` なし・パイプ実行なし」へ書き換え、変更の経緯も残した。
  **⇒ 失効した記述をそのまま残さないための修正であり、意図的なものである。**

---

## 11. 既存が壊れていないこと

```
$ go test ./...
（FAIL 0。ok 53 パッケージ）

$ make test-web
 Test Files  170 passed (170)
      Tests  1674 passed (1674)
   Duration  91.71s

$ make e2e
  153 passed (3.4m)

$ bash scripts/check-md-emphasis.sh
現在 436 行 / ベースライン 436 行
OK  ベースラインどおり(増加なし)
結果: 違反なし
```

**★下は「レビュー取り込み後」の再測値である**（レビュー指摘 高-1）。

> **★取り込み前の本報告は、`check-progress-log-index` を「違反なし」と書いていたが誤りだった。** 執筆時点では `docs/progress/progress-log.md` への索引行がまだ無く、**実測は「NG 作業 ID `improve-01` が現れない ／ 結果: 違反 1 件」だった**。「本報告と同じ手番で実施」と書いた予定を、実測値として書いてしまった形である。
> **⇒ 索引行を追記したうえで再測し、下の値へ差し替えた。** 予定を実測として書かないこと（本プロジェクトが「高」に置く「撤回済み・失効した記述」の型そのものだった）。

```
$ 常設検査の一括実行(レビュー取り込み後の再測)
check-stop-discipline            exit=0  結果: 違反なし
check-progress-log-index         exit=0  結果: 違反なし(検査した 44 件すべてが progress-log に現れる)
check-doc-inventory              exit=0  結果: 型に無いファイル 5 件
check-instruction-format         exit=0  結果: 違反なし
check-doc-refs                   exit=0  結果: dead reference なし
check-browser-storage-keys       exit=0  結果: 違反なし
check-artifact-integrity         exit=0  結果: 違反なし
check-md-emphasis                exit=0  現在 436 行 / ベースライン 436 行
```

> **`check-doc-inventory` の 5 件のうち 3 件は本作業の産物ではない**——`docs/handover/m20-desk-startup-prompt.md` ／ `docs/process/m21-measurement-scope-assessment.md` ／ `docs/instructions/IMPROVE-01-clean-clone-toolchain.md`（指示書そのもの）であり、着手前から同じ 3 件だった。
>
> **★4 件目と 5 件目は本作業の報告 2 本である**（`docs/progress/improve-01-completion-report.md` ／ `docs/progress/improve-01-review.md`）。**同検査の TYPES 表が想定する完了報告の型が `m{N}-{NN}-…` 形式であり、改善レーンの `IMPROVE-NN-…` を拾えていない。** 指示書そのもの（3 件目）が同じ理由で挙がっていることからも、**改善レーンという命名が型として未登録である**ことがわかる。
>
> **★本作業では TYPES 表にも EXCEPT 表にも足していない。** 理由 2 つ——(a) `scripts/` 配下は本作業の変更禁止領域である（指示書 §2.2-1。**検査を通すために検査を触るのは歯止め §1.3-1 そのもの**）、(b) `CLAUDE.md` §10.Y は「運用として定着した型だけを TYPES へ昇格させる」「EXCEPT へ足して黙らせるのは開発者の承認を得たときだけ」と定めており、**改善レーンの成果物はこれが 1 件目**で「定着した型」とは言えない。**⇒ 2 件目の改善レーンが出た時点で TYPES への昇格を判断することを推奨する**（設計卓・開発者の手番）。同検査は常に exit 0 の情報提供型であり、赤にはならない。

> **`make e2e` の初回実行では 1 件が flaky（`m18-03a-punish-mylist.spec.ts` がコンボ作成 API の 500 でリトライ後に成功）だったが、クリーンな状態からの再実行では 153 件すべてが 1 発で緑になった。** 本作業は本番コードを 1 バイトも触っていないため、当該 flake は既存のものである。

---

## ■ 併せて更新が要るもの

| 項目 | 結果 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** 指示書 §12 のとおり CHANGE 不要（`docs/design/` に差分ゼロ）。⇒ `docs/handover/change-number-registry.md` §1 への登録は発生しない |
| **「次の番号」の写し先（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4）** | **なし**（番号を消費していないため） |
| **消費したマイグレーション連番** | **なし**（`migrations/` に差分ゼロ） |
| **版を上げた文書とその参照元** | **なし。** 指示書・チェックリストとも版は据え置き（v1.1.0 のまま） |
| **その他** | `docs/progress/progress-log.md` への索引行の追記（本報告と同じ手番で実施） |

---

## 12. 推測で進めた事項（明示）

指示書 §8.2 が推測可としていた範囲のみ。

1. **インストール手段**——`python3 -m pip install --user` ／ `go install`（`GOTOOLCHAIN` 固定つき） ／ `pnpm install --frozen-lockfile` を採った。**`sudo` は使っていない。`curl … | bash` 等のパイプ実行も使っていない**（`CLAUDE.md` §10）
2. **hook の配置と命名**——`.claude/hooks/session-start.sh`。既存 5 本と同じディレクトリ・同じ `bash "$CLAUDE_PROJECT_DIR/…"` 呼び出し形式に揃えた
3. **`matcher` を `startup|resume` にした**——`clear` / `compact` では走らせない。冪等なので害は無いが無駄なため
4. **`govulncheck` の版を `v1.1.4` に据え置いた**——devContainer（`Dockerfile:131`）と揃えるため。§4-4 のとおり版を上げても問題は直らず、上げる理由が無かった

---

---

## 13. 起動確認の結果（2026-08-19・開発者実施）

**★§8-1 の「開発者の起動確認待ち」は解消した。判定は OK。**

| 項目 | 結果 |
|---|---|
| 確認環境 | クラウド実行環境。コンテナ起動 04:59:12 UTC の**初回セッション**（ブランチ `claude/session-start-hook-verify-la1qwk`・対象 commit `559103d`） |
| セッションの起動 | **起動した**（＝hook はセッションを壊していない） |
| `check-artifact-integrity.sh` | **結果: 違反なし** |
| `markdown_it` | 4.2.0 |
| `govulncheck` | `/root/.local/bin/govulncheck` ／ **Go: go1.26.4** ／ Scanner: govulncheck@v1.1.4 |
| `web/node_modules` | 存在する |
| `git status --porcelain` | **空**（追跡ファイルを汚していない） |
| hook 再実行（冪等性） | **0.064 秒・無音・exit 0** |

### 13-1. ★hook の出力は Claude からは観測できない（設計上の帰結）

**確認セッションの Claude には `session-start:` の行が 1 行も届かなかった。** これは「出なかった」ではない——
**本 hook は全出力を stderr に出しており、SessionStart で Claude の文脈へ注入されるのは stdout だけ**だからである（§5 の設計どおり）。

**⇒ 「出力が静かであること」（指示書 §4.2-3）は構造的に保証されている一方、発火の有無を Claude 側から言葉で確認する経路は無い。**
確認セッションはこれを**ファイルの mtime とコンテナ起動時刻の突合**で実測した。**この手法は次に同種の確認をする担当にとって有用なので残す。**

```
コンテナ起動 (uptime -s)          04:59:12 UTC   —
markdown_it パッケージ作成         04:59:26 UTC   +14 秒
/root/.local/bin/govulncheck 作成  04:59:49 UTC   +37 秒
web/node_modules 作成              04:59:53 UTC   +41 秒
```

**⇒ hook は起動時に発火し、クリーンなコンテナで欠けていた 3 件をすべて埋めた**（cold path 実測 41 秒）。

### 13-2. ★★`vuln.go.dev` は塞がったままである（**一度出した「環境依存」という結論を撤回する**）

**★本節は 2026-08-19 に二度書き換えている。経緯ごと残す。同じ穴に落ちないため。**

| 版 | 結論 | 根拠 |
|---|---|---|
| 初版 | クラウドでは塞がっている | 本作業の環境で `curl` が 403、`govulncheck ./...` が `Forbidden` |
| 二版（**誤り**） | 到達可否は environment ごとに違う | 起動確認セッションで `govulncheck -version` が `No vulnerabilities found.` を返した |
| **現行（確定）** | **塞がったままである。環境差ではない** | 下記 |

**★二版が誤りだった理由**——`govulncheck -version` は **DB へ到達しなくても `No vulnerabilities found.` を出す**。
**パッケージ引数が無いので走査対象がゼロであり、DB を引く必要が無いからである。**
`vuln.go.dev` が 403 である本作業の環境で、同じ出力が再現した。

```
$ curl -sS -o /dev/null -w "http_code=%{http_code}\n" https://vuln.go.dev/index/db.json
curl: (56) CONNECT tunnel failed, response 403
http_code=000

$ govulncheck -version          # ← 到達可否を測れない。引数が無いので DB を引かない
Go: go1.26.4
Scanner: govulncheck@v1.1.4
DB: https://vuln.go.dev

No vulnerabilities found.       # ★403 の環境でもこう出る
EXIT=0

$ govulncheck ./...             # ← これが到達可否の検査である
govulncheck: fetching vulnerabilities: Get "https://vuln.go.dev/index/modules.json.gz": Forbidden
EXIT=1
```

**★開発者は claude.ai/code の設定を一切変更していない**（2026-08-19 申告）。**環境差で説明する余地はそもそも無かった。**

**⇒ §9-1 の手順はそのまま必要である。** 「環境ごとに要否が変わる」という二版の記述は取り消す。

**★教訓が 2 つある。**

1. **`govulncheck -version` を到達性の検査に使わないこと。** 到達可否を見るなら **`govulncheck ./...`**（パッケージ引数つき）を打つ。
   **★これは `check-artifact-integrity.sh` §4.1 の「成功表示は証拠ではない」と同じ型である**——**緑を返した経路が、確かめたい対象を通っていなかった。**
2. **★製造が出した検証手順そのものに穴があった。** 起動確認プロンプトが `govulncheck -version` を指定しており、**確認担当はそのとおり正しく実行した。**
   **⇒ 誤りは実行側ではなく手順側にある。** さらに製造は自セッションで同じ出力を得ていながら、`head -3` / `head -4` で
   末尾を切り落としていたため `No vulnerabilities found.` の行を見ておらず、**矛盾に気づく機会を自分で潰していた。**
   **★出力を切るときは、切った先に判定材料が無いことを確かめること。**

#### 13-2-1. ★確認者による原因分析（2026-08-19・確認者 Claude 提供。**製造の分析より精密なので全文を採る**）

**製造は「引数が無いので DB を引かない」までしか掴めていなかった。確認者は判定材料が出力の中に在ったことまで特定した。**

| # | 原因 |
|---|---|
| 1（主因） | **検査手段と検査対象の取り違え。** 指示のコマンド列にあった `govulncheck -version` の期待値は「版が出るか」しか問うていない。**にもかかわらず、同じ出力に含まれていた別の行（`DB:` と `No vulnerabilities found.`）を疎通の証拠へ流用した**——求められた判定に無い結論を、手元の出力から拡張解釈で作った |
| 2 | **「それらしい出力」を検証せずに証拠として扱った。** `DB:` 行は `internal/scan/text.go:110-112` が**設定値 `cfg.db` をそのまま印字**しているだけで到達の有無と無関係。`No vulnerabilities found.` は `internal/scan/flags.go:72` で**パターンが空**（`-version` 単体）＝走査対象ゼロのため。**`curl` か実スキャンを 1 本足すだけで防げた** |
| 3 | **★陰性証拠（出ていない行）を見ていない。** `run.go:98` は `if mod, err := client.LastModifiedTime(ctx); err == nil { … }` と DB 取得の失敗を握り潰し、**成功時のみ** `text.go:113-115` が **`DB updated: <日時>`** を追加する。**⇒ 到達可否はこの行の有無に現れていた。初回の出力にこの行は無かった。** 「出ている行が期待どおりか」だけを見て「出るはずの行が出ていない」を見なかった |
| 4 | **既存の記録と矛盾する観測を、自分の観測を疑わずに上書きした。** §9-1 は 403 を `curl` の実測付きで明記し §J にも登録済みだった。**確立された記録と矛盾する観測を得た時点で、疑うべきは記録ではなく新しい観測のほうだった。** しかも §J を閉じる方向の判断材料まで提示しており、**記録が消える方向の誤りで害が大きい** |

**★再発防止——目的別に使うコマンドを固定する。**

| 確認したいこと | 使うコマンド | 判定 |
|---|---|---|
| `govulncheck` が入っているか・版・ビルド Go 版 | `govulncheck -version` | `Go:` / `Scanner:` 行 |
| **DB へ到達できるか** | **`govulncheck ./...`** または `curl https://vuln.go.dev/index/db.json` | rc / HTTP コード |
| （簡易）DB を引けたか | `govulncheck -version` | **`DB updated:` 行の有無。`DB:` 行では判定できない** |

**★原則**: **既存の記録（完了報告・`followup-backlog` §J）を覆す結論を出すときは、その結論だけを狙った独立の実測を 1 本足してから書く。副次的に出た出力の解釈で覆さない。**

### 13-3. PATH 警告の分岐には入っていない

`CLAUDE_ENV_FILE` は未設定だったが、`/root/.local/bin` が既に PATH 上にあるため
`pick_go_bindir()` が PATH 上の候補を拾い、レビュー指摘 中-2 で追加した警告分岐は発生しなかった。
**⇒ 警告は「必要なときだけ出る」形で正しく働いている**（冪等性は 0.064 秒の再実行で実証済み）。

### 13-4. ★GOTOOLCHAIN 固定が必要だったことの再確認

確認環境でも**素の go は go1.24.7** であり、プロジェクト内でのみ go1.26.4 が選ばれる状態は現存した。
実際にビルドされた `govulncheck` は **Go: go1.26.4** であり、**固定が効いていることを別環境で独立に確認できた**（§4-4）。

### 13-5. 残るもの

| # | 内容 | 状態 |
|---|---|---|
| 1 | **§9-2 の分岐（hook の結果が環境キャッシュに載るか）** | **未確定。** 確認セッションは当該コンテナの初回だったため分岐しない。**同一環境で新規セッションをもう 1 本起動し、2 本目が無音かを見れば決まる** |
| 2 | **`vuln.go.dev` の allowlist 設定** | **未実施。塞がったままである**（§13-2）。開発者は claude.ai/code の設定を一切変更していない。§J `cloud-env-cannot-reach-vuln-go-dev` |
| 3 | 起動時 3 行の目視 | **不要と判断した。** §13-1 のとおり mtime 突合で発火を実測できており、目視は同じ事実の弱い確認にしかならない |

*以上、IMPROVE-01 完了報告。**直したのは環境であって検査ではない。** 検査スクリプトとベースライン値は 1 バイトも動かしていない。*
