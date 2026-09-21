# M28-03 完了報告: ツールチェーンと依存の版上げ

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M28-03-toolchain-and-dependency-bump.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M28-03-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-06 |
| 着手基点 | `56b06cb`（作業ツリーはクリーン） |
| ブランチ | `claude/m28-03-implementation-plan-p9vdy2` ／ PR [plexiblinp/combomgr#157](https://github.com/plexiblinp/combomgr/pull/157)（Claude Code UI が起票。**本文は製造が触っていない**） |
| CHANGE 消費 | **0 本**（**★`DES-001` の改訂が要る。設計卓へ請求する＝§6-1。自採番していない**） |
| マイグレ消費 | **0 本** |

---

## 0. 変更統計（`git diff --stat 56b06cb`）

```
 .devcontainer/Dockerfile        |    2 +-
 .devcontainer/devcontainer.json |    2 +-
 CLAUDE.md                       |    2 +-
 README.md                       |    2 +-
 go.mod                          |   24 +-
 go.sum                          |   77 +-
 web/package.json                |   67 +-
 web/pnpm-lock.yaml              | 1947 +++++++++++++++++++--------------------
 8 files changed, 1059 insertions(+), 1064 deletions(-)
```

**★新規ファイルは 1 本も作っていない**（8 件すべて既存ファイルの変更）。本報告書 `docs/progress/M28-03-completion-report.md` だけが新規で、作成前に同名の不在を実査した（教訓 `E-225`）。

### コミット（指示書 §2.7 の 5 段。★2〜5 はそれぞれ単独で revert できる）

| 段 | コミット | 内容 |
|---|---|---|
| 1 | `6957ff6` | 版数の記載の同期のみ（`CLAUDE.md` / `README.md`。コードは動かない） |
| 2 | `526aa2b` | Go ツールチェーン（`go.mod` の `toolchain` 行のみ） |
| 3 | `ce6d7cc` | Go 依存（`go.mod` / `go.sum`） |
| 4 | `26cfb57` | フロント依存（`web/package.json` / `web/pnpm-lock.yaml`） |
| 5 | `7462f81` | devContainer の版数反映（`.devcontainer/` 2 本） |

---

## 1. 母数 — 版数を書いている場所の全数と、**直す前の食い違い**（§2.1）

### 1.1 Go（★★実効値が 4 種類に割れていた）

| # | 場所 | **着手時の記載** | 処遇 |
|---|---|---|---|
| 1 | `go.mod:3` | `go 1.26.4` | **動かさない**（§2.2-1 / §4-2） |
| 2 | `go.mod`（`toolchain` 行） | **不在** | `toolchain go1.26.8` を追加 |
| 3 | `.devcontainer/Dockerfile:12` | `ARG GO_VERSION=1.26.4` | → `1.26.8` |
| 4 | `.devcontainer/devcontainer.json:11` | `"GO_VERSION": "1.26.2"` ← **★実効値** | → `1.26.8` |
| 5 | `CLAUDE.md:39` | `- Go 1.26.2 以上` | → `Go 1.26.4 以上(devContainer / CI は 1.26.8)` |
| 6 | `README.md:9` | `- Go 1.22 以上(devContainer は 1.26.2)` | → 同上 |
| 7 | `docs/design/01-tech-stack.md:120`（`DES-001`） | `Go 1.22+` | **★製造は直さない。設計卓へ請求**（§4-8） |
| 8 | `.claude/commands/research_plan.md:16` | `Go 1.26.2+` | **★報告のみ**（`.claude/` は編集しない＝§4-7） |
| 9 | `docs/process/remote-ops.md:48` | `Go 1.26.x` | 粗い表記。patch 上げで失効しない ⇒ 据え置き |
| 10 | `docs/process/remote-ops-proposal.md:129,307` | `Go 1.26.x` | 同上 |
| 11 | `docs/handover/followup-backlog.md:113` | followup `M14-h` が**この食い違いを既に起票済み**だった | 本サブで解消（§8-3） |
| 12 | `.github/workflows/pr-checks.yml:64,151` | `go-version-file: go.mod` | **★リテラル無し。go.mod に追従** ⇒ 編集不要 |
| 13 | `.github/workflows/nightly-crossbuild.yml:70,183` | `go-version-file: go.mod` | 同上 |

**★★食い違いは 4 種類の値だった**——`1.26.4`（go.mod / Dockerfile 既定）／ `1.26.2`（devcontainer.json の上書き ＝ 実効値・`CLAUDE.md` ／ `research_plan.md`）／ `1.22`（`README.md` / `DES-001`）／ `1.26.x`（`remote-ops`）。

> **★★本サブで最も危険だった実測**: `devcontainer.json:11` が `Dockerfile:12` を上書きしていたため、**devContainer の実効 Go は `1.26.2` であり、`go.mod:3` の `go 1.26.4` を満たしていなかった**。`GOTOOLCHAIN=auto` の自動ダウンロードで隠れていただけである。**⇒ `Dockerfile` 側の既定値 `1.26.4` は誰も使っていない死んだ値だった。** 両方を `1.26.8` に揃えたので、以後は上書き値と既定値が一致する。
>
> **★`README.md` / `DES-001` の「Go 1.22」は意図的な下限表記ではなく更新漏れである**（§6-4 への回答）。`go.mod` が `1.26.4` を要求している以上、Go 1.22 ではビルドできない。

### 1.2 Node（**動かしていない**。食い違いなし）

| 場所 | 記載 |
|---|---|
| `.devcontainer/Dockerfile:7,9` | `Node.js 22(LTS)` ／ `FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm` |
| `.github/workflows/pr-checks.yml:232` | `node-version: 22` |
| `.github/workflows/nightly-crossbuild.yml:78,202` | `node-version: 22` |
| `README.md:10` | `- Node.js 20 以上(devContainer は 22)` |
| `scripts/devcontainer-supplychain-prompt.sh:58` | `- Node.js: 22.x (LTS)`（★ここだけ直書き。他は Dockerfile の ARG から自動導出） |

`web/package.json` に `engines` フィールドは**無い**。`.nvmrc` / `.go-version` / `.tool-versions` も**リポジトリ内に存在しない**。**⇒ 22 で揃っており、本サブの射程外として据え置いた。**

### 1.3 pnpm（**動かしていない**。食い違いなし）

| 場所 | 記載 |
|---|---|
| `web/package.json:6` | `"packageManager": "pnpm@9.13.0"` |
| `.devcontainer/Dockerfile:13,138` | `ARG PNPM_VERSION=9.13` ／ `corepack prepare "pnpm@${PNPM_VERSION}" --activate` |
| `.devcontainer/devcontainer.json:12` | `"PNPM_VERSION": "9.13"` |
| `CLAUDE.md:426` | `pnpm 9.13` ／ `"pnpm@9.13.x"` |
| `README.md:11,14` | `pnpm 9.13 以上` ／ `pnpm@9.13.0` を固定 |
| `.github/workflows/*.yml` | **版数を持たない**（`pnpm/action-setup@v6` が `package_json_file: web/package.json` から読む。`pr-checks.yml:223-224` に「ここに版数を書くと二重管理になり必ずずれる」と理由が明記されている） |

**⇒ 動かす理由が無いので据え置いた**（§2.4-4）。

> **★本クラウド実行環境の ambient `pnpm` は 10.33.0 だった。** ただし pnpm 10 は `packageManager` フィールドを尊重して corepack 管理下の **9.13.0 へ委譲する**ため、実際に走ったのは 9.13.0 である（`pnpm --version` → `9.13.0` で実査）。**⇒ lock は 9.13.0 が書いた。**

### 1.4 Codex 派生物（§6-3 への回答）

**`AGENTS.md` / `.codex/` / `.agents/` に Go / Node / pnpm の版数リテラルは 0 件。** `.codex/hooks.json` / `.codex/config.toml` / `.codex/rules/default.rules` / `.agents/skills/tacpendium-manufacturing-workflow/` / `human-notes/codex/` を実査した。**⇒ `/sync_codex_config` の射程に触れない。**

### 1.5 `.claude/` の直書き（§2.1-4。**★報告のみ・編集していない**）

| 場所 | 記載 |
|---|---|
| `.claude/commands/research_plan.md:16` | `Go 1.26.2+`（**★実際の要求は 1.26.4。既に古い**） |
| `.claude/hooks/session-start.sh:111-125` | `GOTOOLCHAIN` を `$(go env GOVERSION)` から導出（**リテラル無し**）。ただしコメント内に `go1.24.7` / `go1.26.4` が説明として在る |
| `.claude/hooks/session-start.sh:83` | `GOVULNCHECK_VERSION="v1.1.4"`（**★`Dockerfile:17` と同じ値の 2 本目の写し。黙ってドリフトしうる**） |

### 1.6 その他の同じ「上げ面」（**本サブでは動かしていない**）

`.devcontainer/Dockerfile` の `GOPLS_VERSION=v0.21.1` / `DLV_VERSION=v1.26.1` / `GOLANGCI_LINT_VERSION=v2.11.4` / `GOVULNCHECK_VERSION=v1.1.4` / `CODEX_CLI_VERSION=0.144.6`。`npm install -g @anthropic-ai/claude-code` は**意図的に未固定**（`:149` にその旨のコメント）。

---

## 2. 上げた版（§3-2）

### 2.1 Go ツールチェーン: `go1.26.4` → **`go1.26.8`**

**★`go.mod` の `go` ディレクティブ（`1.26.4`）は動かしていない。`toolchain go1.26.8` 行を追加しただけである。**

```diff
 go 1.26.4
+
+toolchain go1.26.8
```

**★`toolchain` 行を選んだ理由**——`.github/workflows/` は Go の版を直書きしておらず、4 か所すべてが `go-version-file: go.mod` である。**⇒ `go.mod` を触らないと CI は 1 mm も動かない。** `toolchain` 行なら `setup-go` も手元の `GOTOOLCHAIN=auto` も追従し、**言語仕様・`vet` の既定・標準ライブラリの挙動は `1.26.4` のまま据え置ける**。実測: モジュール内で `go version` → `go version go1.26.8 linux/amd64`。

> **★★【2026-09-06 注記】「`setup-go` も追従する」は推論であって、まだ観測していない。**
>
> 手元（`GOTOOLCHAIN=auto`）が追従することは実測した（上記）。**しかし CI 側は未観測である**——`actions/setup-go@v7` が `go-version-file: go.mod` から **`toolchain` 行を読むのか、`go` ディレクティブだけを読むのか**を、ログで確かめていない。
>
> **★Nightly の E2E が緑（§4.1 追補）でも区別がつかない**——次の 2 経路は**どちらもテストが緑になる**:
>
> | | `setup-go` が入れる版 | ビルドに使われる Go |
> |---|---|---|
> | `toolchain` 行を読む | 1.26.8 | **1.26.8** |
> | `go` ディレクティブだけ読む | 1.26.4 | **1.26.8**（`GOTOOLCHAIN=auto` がビルド時に取得） |
>
> **⇒ 実害は無い。どちらの経路でもビルドは `1.26.8` で行われるので、`CLAUDE.md:39` / `README.md:9` の「(devContainer / CI は 1.26.8)」は結果として正しい。★未確定なのは機構だけである。**
>
> **★それでも書き残すのは `D-510` と同型だからである**——断定を書いた時点で、**それが観測ではなく予測であったことが記録から消える。** 確定手段は **PR [#157](https://github.com/plexiblinp/combomgr/pull/157) の `Setup Go` ステップのログ**（インストールした版を印字する）。§7-10 へ回した。

上げ幅は**同 minor の最新 patch**（§2.2-2）。`go1.27.1` は公開済みだが**跨いでいない**。

> **★`toolchain` 行が持ち込む挙動変化**（レビュー指摘 M-4）。`toolchain` 行は `GOTOOLCHAIN=local` では無視され、**強制されるのは `go` ディレクティブ（1.26.4）のまま**である ⇒ `CLAUDE.md:39` / `README.md:9` の「Go 1.26.4 以上」は文言として正しい。**ただし既定（`GOTOOLCHAIN=auto`）では、Go 1.26.4〜1.26.7 を持つ利用者は初回ビルドで `proxy.golang.org` から go1.26.8 を取得するようになった。** これは本サブが持ち込んだ新しいネットワーク前提である。**実害は小さい**——`init-firewall.sh:31` に `proxy.golang.org` が入っており devContainer では通る。**着手前も `go 1.26.4` > コンテナの実効 1.26.2 で同じ自動取得が起きていた**（§1.1 の注記）。**★オフライン環境の利用者にとっては挙動が変わっている。**

#### ★どのセキュリティ修正が入るのか（§2.2-3）

| 版 | 日付 | 内容 |
|---|---|---|
| **`1.26.5`** | 2026-07-07 | **セキュリティ 2 件**。`os`: Root escape via symlink plus trailing slash（**CVE-2026-39822**）／ `crypto/tls`: Encrypted Client Hello の PSK identity 漏洩（**CVE-2026-42505**） |
| **`1.26.6`** | 2026-08-11 | **セキュリティ 10 件**。影響パッケージ＝ `go command` / `crypto/tls` / `encoding/asn1` / `encoding/xml` / `html/template` / `net` / `net/http` / `net/url`。内容の例＝sumdb の `GOSUMDB` バイパスとモジュールキャッシュ汚染 ／ `html/template` の XSS ／ `encoding/asn1`・`encoding/xml` の stack exhaustion ／ `net/http` が h2c の preface 探査に `ReadHeaderTimeout` を適用していなかった件 |
| **`1.26.7`** | 2026-08 | **★セキュリティ修正ではない。** `1.26.6` の修正が壊した h2c（暗号化なし HTTP/2）の回帰修正 |
| **`1.26.8`** | 2026-09-01 | `cgo` / compiler / runtime / `debug/elf` / `os`。**セキュリティ修正なし** |

**★本アプリ（単一バイナリ配布）へ届く面を実査した。**

- **届く**: `net/http` と `net`（**★標準ライブラリが vendor している `golang.org/x/net/dns/dnsmessage` を含む**——クロスビルド中の compile コマンドで実際にコンパイルされていることを確認）。Echo 経由でバイナリに入る。
- **届かない（直接 import していない）**: `html/template` ／ `text/template` ／ `encoding/xml` ／ `encoding/asn1` ／ `crypto/tls` ／ `os.Root` / `os.OpenRoot`（`grep -rn --include=*.go` で 0 件）。
- **ビルド時に効く**: `go command` / sumdb 系。利用者へ届くバイナリではなく、**開発者がビルドするときのサプライチェーンを守る**。

> **★情報源の制約（正直に書く）**: 本クラウド実行環境は `go.dev` と `vuln.go.dev` が egress ブロックである（実測 403 / `connect_rejected`）。**⇒ 一次資料（`go.dev/doc/devel/release`・golang-announce）を直接開けていない。** 上表は `WebSearch` 経由で得た内容であり、**影響パッケージの一覧は複数の検索で一致したが、`1.26.6` の 10 件の個別 CVE 番号は出所によって食い違いがあったため、番号の割り当ては断定していない**。番号まで要る場合は、egress の通る環境で一次資料を引き直すこと。

### 2.2 Go 依存（§2.3）

`go get -u ./...` ＋ `go mod tidy`。**★Go の `-u` はメジャーを跨がない**（メジャーはモジュールパスが変わるため構造的に到達しない）。

#### ■ 意図して上げた分（`go.mod` に現れる 11 本）

| 種別 | モジュール | 版 | 内容 |
|---|---|---|---|
| direct | `github.com/labstack/echo/v4` | v4.15.1 → **v4.15.4** | **★セキュリティ修正を含む**。v4.15.3/v4.15.4 の **"Encoded slash (/) bypasses route-level protection and exposes static files"（GHSA-vfp3-v2gw-7wfq / CVE-2026-55677）**。**★★【2026-09-06 訂正】初版は「本アプリは embed した `web/dist` を Echo の静的配信で返すため直接効く面である」と書いたが、これは踏み込みすぎだった。実測の結論は §4.4 を正とする**——**本脆弱性が影響するのは `StaticDirectoryHandler`（`e.Static` / `e.StaticFS`）と Static ミドルウェアであり、本アプリはそのいずれも使っていない**（使用 0 件）。**自前の `internal/api/static` を使っており、実バイナリでの v4.15.1 との対照実験でも 10 本すべて挙動が同一だった。⇒ 本アプリは影響を受けない。** v4.15.2 は `Context.Scheme()` のヘッダ検証 |
| direct | `golang.org/x/text` | v0.32.0 → **v0.41.0** | 定期リリース。`internal/aliasnorm` が `unicode/norm` を使う |
| direct | `modernc.org/sqlite` | v1.50.0 → **v1.58.0** | **★指示書 §0.2-2 の懸念の本体** |
| indirect | `github.com/labstack/gommon` | v0.4.2 → v0.5.0 | echo の依存 |
| indirect | `github.com/mattn/go-colorable` | v0.1.14 → v0.1.15 | |
| indirect | `github.com/mattn/go-isatty` | v0.0.20 → v0.0.24 | |
| indirect | `golang.org/x/crypto` | v0.46.0 → v0.56.0 | `echo/v4` → `acme` 経由（`go mod why` で実査） |
| indirect | `golang.org/x/net` | v0.48.0 → v0.58.0 | `echo/v4` → `http2` 経由（同上） |
| indirect | `golang.org/x/sys` | v0.42.0 → v0.47.0 | |
| indirect | `modernc.org/libc` | v1.72.0 → v1.75.7 | sqlite の依存 |
| indirect | `modernc.org/memory` | v1.11.0 → v1.12.1 | 同上 |

#### ■ `go mod tidy` の結果として出た分（§2.3-5。**`go.sum` のみ・`go.mod` に現れない**）

ビルドグラフ上だけの版更新 **8 本**——`github.com/google/pprof` / `golang.org/x/mod` / `golang.org/x/sync` / `golang.org/x/tools` / `modernc.org/cc/v4` / `modernc.org/ccgo/v4` / `modernc.org/gc/v3` / `modernc.org/opt`。
**＋ 重複エントリ `golang.org/x/sys v0.6.0` の削除 1 件。**

#### ■ ★やっていないこと（`git diff go.mod` で実査）

- **新規依存の追加は 0 件。**
- **`indirect → direct` 昇格は 0 件**（`// indirect` が外れた行は 1 行も無い）。
- **メジャー版上げは 0 件。**

### 2.3 フロント依存（§2.4）

`pnpm update`（pnpm **9.13.0**＝`packageManager` の指定どおり）。範囲内更新のためメジャーは構造的に入らない。
**★`npm` / `yarn` / `npx` は使っていない。★`package-lock.json` / `yarn.lock` は生まれていない**（`find` で実査）。

| 種別 | パッケージ | 版 |
|---|---|---|
| dep | `@hookform/resolvers` | 5.4.0 → 5.9.1 |
| dep | `@radix-ui/react-accordion` | 1.2.12 → 1.2.20 |
| dep | `@radix-ui/react-alert-dialog` | 1.1.15 → 1.1.23 |
| dep | `@radix-ui/react-checkbox` | 1.3.3 → 1.3.11 |
| dep | `@radix-ui/react-dialog` | 1.1.15 → 1.1.23 |
| dep | `@radix-ui/react-dropdown-menu` | 2.1.16 → 2.1.24 |
| dep | `@radix-ui/react-label` | 2.1.8 → 2.1.15 |
| dep | `@radix-ui/react-popover` | 1.1.15 → 1.1.23 |
| dep | `@radix-ui/react-radio-group` | 1.3.8 → 1.4.7 |
| dep | `@radix-ui/react-select` | 2.2.6 → 2.3.7 |
| dep | `@radix-ui/react-slot` | 1.2.4 → 1.3.3 |
| dep | `@radix-ui/react-switch` | 1.2.6 → 1.3.7 |
| dep | `@radix-ui/react-tabs` | 1.1.13 → 1.1.21 |
| dep | `@radix-ui/react-tooltip` | 1.2.8 → 1.2.16 |
| dep | `@tanstack/react-query` | 5.100.6 → 5.102.8 |
| dep | `react-hook-form` | 7.76.1 → 7.87.0 |
| dep | `react-router-dom` | 6.30.4 → 6.30.6 |
| dep | `sonner` | 2.0.7 → 2.0.8 |
| devDep | `@playwright/test` | 1.60.0 → 1.63.0 |
| devDep | `@testing-library/react` | 16.3.2 → 16.3.3 |
| devDep | `@testing-library/user-event` | 14.6.1 → 14.6.7 |
| devDep | `@types/node` | 20.19.39 → 20.19.43 |
| devDep | `@types/react` | 18.3.28 → 18.3.31 |
| devDep | `@types/react-dom` | 18.3.7（据え置き。レンジのみ更新） |
| devDep | `autoprefixer` | 10.5.0 → 10.5.5 |
| devDep | `postcss` | 8.5.12 → 8.5.28 |
| devDep | `vitest` | 3.2.6 → 3.2.7 |

#### ★推移依存の変化（レビュー指摘 M-1。**★lock の更新はサプライチェーンの変更である**）

`web/pnpm-lock.yaml` の `packages:` エントリを着手基点と突合した実測:

| 指標 | 実測 |
|---|---|
| エントリ総数 | 基点 **379** → 現在 **370** |
| 新規側にのみ在るエントリ | **126** |
| うち直接依存 | **26**（§2.3 の表と一致） |
| **うち推移依存** | **★100** |

推移依存の主な動き: `rollup 4.60.2 → 4.63.1`（`vite` 経由。**★`vite@6.4.3` と `esbuild@0.25.12` 自体は不動**）／ `@babel/{parser,traverse,types,generator} → 7.29.8` ／ `@floating-ui/{core,dom} → 1.8.0` ／ `@jridgewell/sourcemap-codec 1.5.5 → 1.6.0` ／ `nwsapi`（§2.4）／ `ws 8.21.0 → 8.21.3` ／ `playwright-core 1.60.0 → 1.63.0`。

**★パッケージ名として完全に新規に入ったのは 2 本、消えたのは 2 本である。**

| 出入り | パッケージ | 由来 |
|---|---|---|
| **＋** | **`@napi-rs/lzma-linux-x64-gnu@1.5.1`** | **★ネイティブバイナリ。** `rollup@4.63.1` の `optionalDependencies` 経由。**⇒ `dist` を作るビルド環境へ入る** |
| ＋ | `@radix-ui/react-use-is-hydrated` | radix-ui 各種の内部依存 |
| − | `@radix-ui/react-use-escape-keydown` | 同上（radix-ui 側の整理） |
| − | `pify` | |

> **★計画からの逸脱（報告）**: 計画では「`package.json` の `^` レンジは書き換えない」としていたが、**pnpm 9 の `update` は既定でレンジ側も引き上げる**（32 行）。**メジャーの跨ぎは 0 件**——`react ^18` / `react-dom ^18` / `i18next ^23` / `react-i18next ^15` / `react-router-dom ^6` / `tailwindcss ^3` / `typescript ^5` / `vite ^6` / `vitest ^3` / `zod ^3` / `jsdom ^25` / `@types/react ^18` / `@types/node ^20` / `lucide-react ^0.460.0` / `@vitejs/plugin-react ^4` はすべて据え置き。実害は無いと判断してそのまま採った。
>
> **★このうち「レンジだけが動き、導入版は不動」だったものが 6 件ある**（レビュー指摘 L-2。§2.3 の表に無いのはそのため）——`typescript ^5.6.3→^5.9.3`（導入版は着手前から `5.9.3`）／ `tailwindcss ^3.4.15→^3.4.19`（同 `3.4.19`）／ `i18next ^23.16.6→^23.16.8`（同 `23.16.8`）／ `react-i18next ^15.1.3→^15.7.4`（同 `15.7.4`）／ `@vitejs/plugin-react ^4.3.3→^4.7.0`（同 `4.7.0`）／ `@tanstack/react-query ^5.62.0→^5.102.8`（★これだけは導入版も 5.100.6→5.102.8 と動いており §2.3 の表にも在る。レンジの開きが大きかったため両方に現れる）。**⇒ レンジが実態に追いついただけである。**

### 2.4 ★★`nwsapi` を `2.2.25` へ固定した（**回帰の実測と対処**）

`pnpm update` をそのまま入れると **Vitest が 59 件落ちた（10 ファイル）**。すべて `Test timed out in 5000ms` の形で、`userEvent` を使うテストである。

**二分探索の実測**（対象＝`src/features/tag/components/TagSelector.test.tsx` / 19 件）:

| 状態 | 結果 |
|---|---|
| 版上げ前（`nwsapi 2.2.23`） | **19 passed / 2.87s** |
| `@testing-library/user-event` だけ 14.6.7 へ | 19 passed / 2.83s |
| ＋ `@testing-library/react` 16.3.3 | 19 passed / 2.64s |
| ＋ `@radix-ui/react-popover` 1.1.23 | 19 passed / 2.74s |
| ＋ `@tanstack/react-query` 5.102.8 | 19 passed / 2.91s |
| ＋ `vitest` 3.2.7 | 19 passed / 2.76s |
| ＋ radix-ui 残り 12 本 | 19 passed / 2.67s |
| ＋ 残りの直接依存すべて | 19 passed / 2.67s |
| **`pnpm update` 全適用（`nwsapi 2.2.27`）** | **15 failed / 721.73s** ／ 再現時 `--bail=1` で 1 failed / 42.84s |
| `nwsapi` を **2.2.24** に固定 | 19 passed / 2.88s |
| `nwsapi` を **2.2.25** に固定 | 19 passed / 2.87s |
| `nwsapi` を **2.2.26** に固定 | **1 failed / 43.24s**（`--bail=1`） |

**⇒ 直接依存 26 本はすべて無罪であり、犯人は推移依存の `nwsapi`（jsdom の CSS セレクタエンジン）である。★`2.2.26` が回帰の入り口で、`2.2.27` も同じ。** `getByRole` 等の照会が約 250 倍遅くなり、`userEvent` を使うテストが 5 秒のタイムアウトに掛かる。

**対処**: `web/package.json` の既存 `pnpm.overrides` に **`"nwsapi": "2.2.25"`**（既知の最新の健全版）を追加した。

- **★これはテストの skip / disable / quarantine ではない**（§2.6-6 / §4-5）。**回帰した版を上げ幅から外しただけ**であり、§3-3「上げなかったものとその理由」の扱いである。
- **★新規依存の追加でもない**（§4-4）。`nwsapi` は jsdom の推移依存であり、`dependencies` / `devDependencies` には現れず、コードから import もしない。**`indirect → direct` 昇格に相当しない。**
- **★JSON にコメントを書けない**ため、根拠は本報告書・コミット `26cfb57` ／ `docs/progress/progress-log.md` の `### M28-03` 索引行（横断課題 1）に置いた（レビュー指摘 H-2 の是正。**初版は「`progress-log.md` に置いた」と書きながら、その追記自体が存在しなかった**）。
- **★★固定の形を「自己解除する条件付き」にした**（レビュー指摘 H-2）。初版は裸の exact pin `"nwsapi": "2.2.25"` で、**既存 override 4 件がすべて下限引き上げ型なのに 1 本だけ無条件の上限固定**という非対称があった。**⇒ `"nwsapi@>=2.2.26 <2.3.0": "2.2.25"` へ改めた。** 2.2.x 系の 2.2.26 以上を掴んだときだけ効き、**jsdom が `nwsapi ^2.3` を要求する版へ上がれば条件に合致しなくなって黙って無害化する**。現状 `jsdom@25.0.1` は `nwsapi ^2.2.12` を要求しており 2.2.25 で満たせる（lock で実査）。解決結果が `nwsapi@2.2.25` のままであることも実測した。
- **★★2.2.26 は「性能回帰」であって「正しさの修正に伴う低速化」ではない**（レビュー指摘 M-2 への回答）。**上流の changelog は本環境の egress 制約で引けなかった**ため（`github.com` もブロック）、**実測で弁別した**——`nwsapi 2.2.26` に固定したまま `--testTimeout=180000` で `TagSelector.test.tsx` を回すと **19 件すべて passed（719.98s。1 件あたり最大 47,034ms）**。**⇒ assertion は 1 件も落ちていない。挙動は同一で、遅いだけである。** したがって 2.2.25 への固定が**セレクタ照会の正しさを巻き戻している可能性は否定できる**。
- **★影響範囲**: `nwsapi` の消費者は `jsdom`（`devDependencies`）1 本だけであり、**本番バンドルには一切入らない**（lock で実査）。影響はテスト環境の CSS セレクタ照会に閉じる。
- **★`CLAUDE.md` §6 との関係**（レビュー指摘 M-3）: 形式上は抵触しない（`dependencies` に現れず import も 0 件、`indirect → direct` 昇格でもない）。**ただし §6 の根拠——「その版の更新・撤去の判断が本体の責任になる」——は exact pin にもそのまま当てはまる。⇒ 開発者の追認を得るまでは暫定である**（§7-4 ／ progress-log 横断課題 1）。

### 2.5 devContainer / CI（§2.5）

- `.devcontainer/Dockerfile:12` `ARG GO_VERSION=1.26.4` → **`1.26.8`**
- `.devcontainer/devcontainer.json:11` `"GO_VERSION": "1.26.2"` → **`"1.26.8"`**
- **★`.github/workflows/` は編集不要**（`go-version-file: go.mod` で追従。§1.1 参照）。
- **★`.devcontainer/devcontainer-lock.json` は差分ゼロ**（§2.5-3）。中身は `ghcr.io/devcontainers/features/github-cli` の 1 件だけで、Go / Node / pnpm と無関係。**⇒ サプライチェーン面の変化なし。**
- **★`init-firewall.sh` の許可リストは広げていない**（§4-12）。広げる必要は出ていない。**Go の tarball は `dl.google.com` から取るが、イメージビルド時でありファイアウォールが立つ前なので許可は不要**（現状のまま通る）。
- **★リビルドはしていない**（§2.5-2 / §4-11。**開発者の手番**）。製造の環境でリビルドしても開発者の環境で同じものが再現する保証がない。**リビルド前に `/devcontainer_rebuild_check`（`scripts/devcontainer-supplychain-prompt.sh`）を回すこと。**

---

## 3. 上げなかったものと、その理由（§3-3）

| # | 上げなかったもの | 理由 |
|---|---|---|
| 1 | **`go.mod` の `go` ディレクティブ（`1.26.4`）** | 指示書 §2.2-1 / §4-2。**上げると言語仕様・`vet` の既定・標準ライブラリの挙動が変わりうる**（先例＝1.22 の loopvar）。セキュリティ更新が目的ならツールチェーンだけで足りる。**⇒ §7-1 へ回す** |
| 2 | **Go `1.27.1`（minor 跨ぎ）** | §2.2-2 の既定は「同 minor の最新 patch」。**跨ぐ必要が生じていない**——1.26.5〜1.26.8 で必要なセキュリティ修正はすべて入る。**⇒ §7-3 は不発（該当なし）** |
| 3 | **フロントのメジャー版上げ** | §2.4-3 / §4-3。見送った先: `react` / `react-dom` 18→19、`@types/react` 18→19、`@types/react-dom` 18→19、`@types/node` 20→26、`i18next` 23→26、`react-i18next` 15→17、`react-router-dom` 6→7、`jsdom` 25→30、`tailwindcss` 3→4、`typescript` 5→7、`vite` 6→8、`vitest` 3→5、`zod` 3→4、`lucide-react` 0.460→1.41、`@vitejs/plugin-react` 4→6 |
| 4 | **`nwsapi` 2.2.26 / 2.2.27** | §2.4 の実測（約 250 倍の性能回帰）。**2.2.25 に固定した** |
| 5 | **Node（22）** | 全 6 か所で揃っており食い違いが無い。本サブの射程は Go ツールチェーンと依存 |
| 6 | **pnpm（9.13）** | 全 7 か所で揃っている。`CLAUDE.md` が 9.13 を規約として明記しており、動かす理由が無い（§2.4-4） |
| 7 | **`GOPLS` / `DLV` / `GOLANGCI_LINT` / `GOVULNCHECK` / `CODEX_CLI`** | devContainer の開発ツール。本サブの射程外 |

---

## 4. 検証（§2.6 の 3 点 ＋ 常設検査）

| # | コマンド | 結果 |
|---|---|---|
| **1** | `bash scripts/check-artifact-integrity.sh` | **緑**（着手前・完了後とも「違反なし」。検査 12 件 / 生成物 4 件） |
| **2** | `go test ./...` | **緑**（FAIL 0。ツールチェーン上げ後・Go 依存上げ後の 2 回とも） |
| **3** | **`make build-all`** | **★3 OS それぞれ緑** — 下表 |
| **4** | `cd web && pnpm test -- --run` | **緑** — 211 ファイル / **2429 件すべて passed** / **108.46s**（★回帰時は 1125.34s / 59 failed）。**★Phase C で override の形を変えたあと再実行し、211 / 2429 passed / 110.35s で緑を再確認した** |
| **5** | **`make e2e`（全数）** | **緑** — **247 passed / 5.2m**。★`make e2e-only` では代用していない |
| **6** | `cd web && pnpm lint`（`tsc --noEmit`） | **緑** |
| **7** | `bash scripts/app-build-supplychain-check.sh` | **CAUTION** — §4.2 に原文。**★2026-09-06 追補: 開発者の devContainer で `APP_CHECK_GO_VULN=1` 付きを実行し、`govulncheck` は `OK: 既知脆弱性なし`（自コード 0 / import 0 / `require` のみ 1・未 call）。⇒ Go 側 CVE 検査は達成された。`CAUTION` の残る要因は `pnpm audit` の `moderate=2` だけである** |
| **8** | 他の常設検査 8 本 | **全緑** — §4.3 |

### 4.1 ★`make build-all` の 3 OS 個別の結果

| GOOS/GOARCH | 出力 | 結果 |
|---|---|---|
| `windows/amd64` | `dist/tacpendium-windows-amd64.exe`（23,616,512 B） | **緑** |
| `darwin/arm64` | `dist/tacpendium-darwin-arm64`（22,763,474 B） | **緑** |
| `linux/amd64` | `dist/tacpendium-linux-amd64`（23,375,500 B） | **緑** |

> **★★§0.2-2 / §6-2 への回答**: **`modernc.org/sqlite v1.58.0` は Go 1.26.8 で 3 OS すべてクロスビルドが成立した。** 設計卓の懸念（純 Go 実装が Go の版に敏感）は**本プロジェクトでは顕在化しなかった**。`CGO_ENABLED=0` のまま `-tags=embed_web` で通る。

#### ★★【2026-09-06 追補】GitHub ランナー上でも E2E が緑（Nightly の `E2E (Playwright)` job）

**上の 3 OS クロスビルドと §4 の `make e2e` 247 passed は、すべて製造のコンテナでのローカル実測である**（`make build-all` と `make e2e` は PR では走らない＝下記）。**開発者が Nightly を手動 `workflow_dispatch` で起動し、GitHub ランナー上の実測が得られた**（開発者報告・2026-09-06）:

| 項目 | 値 |
|---|---|
| job | **`E2E (Playwright)`** — `make e2e` |
| 所要（job 全体） | **322 秒** |
| 結果 | **247 passed** ／ failed **0 行** ／ flaky **0 行** |
| workers | **1**（`SUPP-001` §5.5 / `CHANGE-135`。**★外さないこと**） |
| ランナー実コア数 | 2 |

**★★これは本サブにとって決定的な確認である。** `nightly-crossbuild.yml:70,183` の `go-version-file: go.mod` により、**GitHub ランナー上で `go1.26.8` が使われた初めての実行**である（`toolchain` 行の追加が CI へ届いたことの実証＝§2.1）。**ローカル実測（247 passed / 5.2 分 ＝ 312 秒）と件数が完全一致し、所要もほぼ同じ。⇒ ツールチェーン上げはランナー環境でも回帰を起こしていない。**

> **★未確認**: **同じワークフローのもう 1 つの job（`crossbuild` ＝ `make build-all`）の結果は受け取っていない。** 受け取ったのは `E2E (Playwright)` job の要約のみである。**⇒ 「Nightly が緑」と丸めて書かない。** 3 OS クロスビルドのランナー上での結果は**依然としてローカル実測のみ**である。
>
> **★CI のトリガは非対称である**（progress-log `### M28-03` 横断課題 13）——`pr-checks.yml` は `pull_request` を持つが `go vet` / `go build` / `go test` / Vitest **だけ**、`nightly-crossbuild.yml` は **`schedule` ＋ `workflow_dispatch` のみで `pull_request` を持たない**。**⇒ `make build-all` と `make e2e` は PR では 1 度も走らない。**

### 4.2 `/app_build_check` の総合判定（§2.3-1 / §3-5。**★原文のまま。要約・上書きしていない**）

```
アプリビルド前 サプライチェーン安全確認  (2026-09-06 06:03)
  WAIT 閾値: high 以上

=== 1. Go 依存の整合性 (go mod verify) ===
  OK: all modules verified

=== 2. Go 既知脆弱性 (govulncheck) ===
    govulncheck: fetching vulnerabilities: Get "https://vuln.go.dev/index/modules.json.gz": Forbidden
  実行エラー(ネットワーク/FW で vuln.go.dev に到達できない可能性)→ SKIP

=== 3. フロント依存 既知脆弱性 (pnpm audit) ===
  検出: critical=0 high=0 moderate=2 low=0
  詳細は: (cd web && pnpm audit) / 個別調査は pnpm why <pkg>

=== 総合判定 ===
CAUTION
  軽微な指摘またはスキップした検査があります。内容を確認の上で判断してください。
  ※ 本チェックは「既知 CVE + 整合性」の確認です。公開直後の速報的な侵害までは
    カバーしません。必要なら AI プロンプト版の併用を検討してください。
```

**★`govulncheck` の SKIP は本クラウド実行環境の egress ポリシーによるものである**（実測 403 / `connect_rejected`）。**⇒ Go 側の CVE 検査は製造の環境では実行できていない**（上の原文はその時点の記録であり、消さずに残す）。

#### ★★【2026-09-06 追補】開発者の devContainer で `govulncheck` を実行した（**Go 側 CVE 検査は達成された**）

**リビルド後の devContainer で `APP_CHECK_GO_VULN=1 bash scripts/app-build-supplychain-check.sh` を実行した結果**（開発者実測・2026-09-06 09:47。**★判定原文のまま**）:

```
=== 2. Go 既知脆弱性 (govulncheck) ===
    === Symbol Results ===

    No vulnerabilities found.

    Your code is affected by 0 vulnerabilities.
    This scan also found 0 vulnerabilities in packages you import and 1
    vulnerability in modules you require, but your code doesn't appear to call these
    vulnerabilities.
    Use '-show verbose' for more details.
  OK: 既知脆弱性なし
```

前提の実測もあわせて取れている——`go version` → **`go1.26.8 linux/amd64`** ／ `go env GOVERSION` → **`go1.26.8`**。**⇒ §2.1 のツールチェーン上げが devContainer に反映されていることが確認された。**

| 層 | 結果 |
|---|---|
| **自コードが呼んでいる脆弱性** | **0 件** |
| **import しているパッケージの脆弱性** | **0 件** |
| **`require` にのみ在る脆弱性** | **1 件（★呼んでいない）** |

**★★総合判定が `CAUTION` のままである理由が変わった。** 製造の環境では「`govulncheck` が SKIP だったから」だったが、**devContainer では `govulncheck` は `OK` を返しており、残る要因は `pnpm audit` の `moderate=2`（react-router。下記）だけである。**

#### ★★`require` にのみ在る 1 件の正体 = `GO-2026-5932`（**恒久的に出続ける指摘であり、追いかけない**）

開発者が `govulncheck -show verbose ./...` で特定した（2026-09-06。**★出力原文**）:

```
Vulnerability #1: GO-2026-5932
    The golang.org/x/crypto/openpgp package is unmaintained, unsafe by design,
    and has known security issues
  More info: https://pkg.go.dev/vuln/GO-2026-5932
  Module: golang.org/x/crypto
    Found in: golang.org/x/crypto@v0.56.0
    Fixed in: N/A
Your code is affected by 0 vulnerabilities.
```

**★★これは「まだ直っていない脆弱性」ではなく「消えない指摘」である。** 製造が実査で裏を取った 4 点:

| # | 実測 | 意味 |
|---|---|---|
| **1** | **`Fixed in: N/A`** | **どの版へ上げても消えない。** `x/crypto/openpgp` は非推奨パッケージであり、**修正版という概念が無い** |
| **2** | **本アプリは `openpgp` を使っていない** — `grep -rn 'openpgp' --include=*.go .` が **0 件** | 呼んでいないので実行時の露出は無い（`govulncheck` の「自コード 0 / import 0」と整合） |
| **3** | **`x/crypto` は `echo/v4` → `golang.org/x/crypto/acme` 経由の indirect** — `go mod why -m golang.org/x/crypto` | **依存グラフから外せない。** Echo を使う限り付いてくる |
| **4** | **着手基点にも `golang.org/x/crypto v0.46.0 // indirect` が在った** — `git show 56b06cb:go.mod` | **本サブが持ち込んだものではない。** `Fixed in: N/A` である以上、v0.46.0 も同じく該当していた |

**⇒ `x/crypto` を上げても `replace` で回避しても消えない。⇒ 追いかけないこと。**

> **★★なぜこれを書き残すか**——**次に `govulncheck` を回す担当は必ずこの 1 件を見る。** 記録が無いと「上げ残しがある」と誤読して追いかけ、**上げても消えないので時間を溶かす。** **★本プロジェクトが繰り返し潰してきた「緑に見えない緑」の型である**（`check-artifact-integrity.sh` §4.1 の「成功表示は証拠ではない」の裏返しで、**赤に見える表示が欠陥とは限らない**）。

> **★★【2026-09-06 訂正】初版は「devContainer 側は `init-firewall.sh` に `vuln.go.dev` が入っていないため同様に SKIP になる」と書いていたが、これは事実誤認である。** 実測: **`vuln.go.dev` は `.devcontainer/init-firewall.sh:34` に、`go.dev` は `:35` に在る。** 着手基点 `56b06cb` の時点で既に在り（`git show 56b06cb:.devcontainer/init-firewall.sh`）、本サブは同ファイルを 1 バイトも触っていない（`git diff 56b06cb -- .devcontainer/init-firewall.sh` は空）。**入ったのは 2026-08-26（`62b0240`）で本サブより 10 日以上前である**（`git log -S'vuln.go.dev'`）。**⇒ devContainer では SKIP にならないはずであり、開発者が 1 回実行すれば本サブの上げ幅を事後検証できる**（§7-6）。
>
> **★誤りの出所と、なぜ通ったか**——レビュー指摘 `M-6` の根拠（`docs/progress/m28-03-review.md:211`「許可リストにも `vuln.go.dev` は無い（`:31-47` を実査）」）を**製造が実測せずに本文へ写した**。同じレビューの `M-1`（推移依存の件数）は独立に再実測したのに、`M-6` の根拠だけ検証を省いている。**★レビューの指摘は「直す対象」であって「検証済みの事実」ではない。⇒ 取り込む前に、根拠そのものを実測すること。**
>
> **★同じ誤りが `progress-log.md:3179`（過去サブの節）にも在るが、過去節は編集しない**（`CLAUDE.md` §8）。

**★`moderate=2` の中身**（`pnpm audit` の実測）:

| 深刻度 | 内容 | パッケージ | 修正版 |
|---|---|---|---|
| moderate | React Router: Open redirect via backslash in `<Link>` and `useNavigate`（CVE-2025-68470 bypass）／ GHSA-wrjc-x8rr-h8h6 | `react-router@6.30.6`（`react-router-dom` 経由） | **>=7.18.0** |
| moderate | React Router: Arbitrary Constructor Injection via `deserializeErrors()`（SSR Hydration）／ GHSA-337j-9hxr-rhxg | 同上 | **>=7.18.0** |

**★どちらも修正版が 7.18.0 以上＝メジャー版上げであり、本サブの射程外**（§2.4-3 / §4-3）。**⇒ §7-2 へ回す。★版上げ前の `react-router-dom 6.30.4` も同じ脆弱範囲内であり、本サブが持ち込んだものではない。**（なお本アプリは SSR を使っていないため、2 件目の SSR Hydration 経路は成立しない。）

### 4.3 常設検査（着手前・完了後とも全緑）

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh` | 違反なし |
| `check-doc-refs.sh` | dead reference なし |
| `check-browser-storage-keys.sh` | 違反なし |
| `check-enum-sync.sh` | ベースラインどおり（増加なし） |
| `check-import-order.sh` | 違反なし（ベースラインどおり） |
| `check-instruction-format.sh` | 違反なし |
| `check-md-emphasis.sh` | 違反なし |
| `check-stop-discipline.sh` | 違反なし |
| `check-doc-inventory.sh` | 型に無いファイルなし |
| `check-progress-log-index.sh` | **★着手時は緑。完了報告を追加した時点で赤（exit 1・違反 1 件）になり、`docs/progress/progress-log.md` の `### M28-03` 索引行を追記して緑（exit 0）へ戻した**（レビュー指摘 H-1。初版の本セルは「緑を確認」と**未実施のまま書いていた**＝`D-510` と同型の断定） |

> **★`check-md-emphasis.sh` は「現在 434 行 / ベースライン 436 行」でベースラインより 2 行少ないが、ベースラインは動かしていない**（チェックリスト §0.3-4）。**本サブが触った `.md` は `CLAUDE.md` と `README.md` の 2 本だけで、どちらも `**` を含まない行の変更である ⇒ 本サブ由来のドリフトではない。**

### 4.4 ★事後検証: Echo v4.15.4 のセキュリティ修正は本アプリに効くか（2026-09-06 追補）

**動機**——レビューの破壊確認で「**Go 依存 11 本を着手基点へ丸ごと戻しても `go build` も `go test` も緑のまま**」＝上げた効果を裏づけるテストが 0 件であることが実測された（`m28-03-review.md` 破壊確認 1）。**⇒ 「壊れなかった」の証拠は在るが「上げた効果が在る」の証拠が無い。** そこで §2.2 で上げた `echo v4.15.1 → v4.15.4` の **"Encoded slash (/) bypasses route-level protection and exposes static files"（GHSA-vfp3-v2gw-7wfq / CVE-2026-55677）** を、実バイナリで対照実験した。

**脆弱性の内容**（`WebSearch` で取得。★`github.com` は egress ブロックのため一次資料の直接取得はできていない）: ルータは**エンコードされたまま**のパスでルートを照合するのに、`StaticDirectoryHandler` は `%2f` を `/` へ**復元してから**ファイルパスを解決するため両者が食い違い、**ルート単位のアクセス制御を迂回して静的ファイルを読める**。影響するのは **`StaticDirectoryHandler`（`e.Static` / `e.StaticFS` が使う）と Static ミドルウェア**。4.15.3 で修正。

**★本アプリのコード上の事実（実査）**:

| # | 実測 | 意味 |
|---|---|---|
| 1 | **`e.Static` / `e.StaticFS` / `middleware.Static` / `StaticDirectoryHandler` の使用は 0 件**（`grep -rn --include=*.go`、テスト除く） | **脆弱なコード経路をそもそも通らない。** 本アプリは自前の `internal/api/static`（`e.GET("/*")` の catch-all で `c.Request().URL.Path` を読み `fs.FS` から返す）を使う |
| 2 | **認証ミドルウェアは `e.Use(mw.Auth(...))` でグローバル登録**（`cmd/tacpendium/main.go:469`）。ルート単位・グループ単位ではない | **本脆弱性の前提である「兄弟ルートに掛けたルート単位の保護を迂回する」という非対称が存在しない。** ルーティング結果によらず全リクエストで認証が走る |

**実機での対照実験**——`echo v4.15.4` の配布バイナリ（`dist/tacpendium-linux-amd64`）と、`echo v4.15.1` へ落として同条件でビルドした対照バイナリを、それぞれ起動して同じ 10 本を投げた。

| リクエスト（`curl --path-as-is`） | **v4.15.1（版上げ前）** | **v4.15.4（版上げ後）** |
|---|---|---|
| `/` | 200 / 395B | 200 / 395B |
| `/index.html` | 200 / 395B | 200 / 395B |
| `/api/health` | 200 / 34B | 200 / 34B |
| `/api%2fhealth` | **404** | **404** |
| `/api%2F..%2Findex.html` | **404** | **404** |
| `/assets%2f..%2findex.html` | 200 / 395B | 200 / 395B |
| `/..%2f..%2fgo.mod` | 200 / 395B | 200 / 395B |
| `/%2e%2e%2fgo.mod` | 200 / 395B | 200 / 395B |
| `/assets/nonexistent.js` | **404** | **404** |
| `/some/client/route` | 200 / 395B | 200 / 395B |

**★★結論: 10 本すべてで挙動が同一であり、どちらの版でも漏洩は起きない。**

- `395B` は `web/dist/index.html` のサイズと一致し、**本文が `<!doctype html>` で始まることを両版で確認した**（`go.mod` の中身は返っていない）＝ SPA フォールバックが効いているだけである。
- `/api%2f...` が **404 になるのは自前ハンドラの `/api` ガードが効いているため**（`URL.Path` は Go の `net/http` が復元済みの値を持つので、`%2f` は `/` として判定される）。**⇒ 本アプリでは復元の向きが安全側に働いている。**
- **⇒ 本アプリは GHSA-vfp3-v2gw-7wfq の影響を受けない。** echo を上げたこと自体は正しい（他の修正と多層防御のため）が、**この修正に限れば挙動は変わらない**。§2.2 の「本アプリは静的配信を持つため直接効く面である」という初版の書き方は**踏み込みすぎだった**。上表を正とする。

**★実験の後始末**: `go.mod` / `go.sum` は `git show HEAD:<path>` の出力で復元し、`git status --porcelain` が空であることを確認した（`git checkout` / `restore` は禁止操作のため不使用）。対照バイナリはスクラッチパッドに置きリポジトリへ入れていない。**★対照バイナリを既定設定で 1 度起動してしまったため、コンテナの既定データディレクトリ（`~/.local/share/tacpendium/`。リポジトリ外・本セッション限りの使い捨て環境）に空の DB が 1 つ残っている。`*.db` の直接削除は `CLAUDE.md` §10 の禁止操作なので消していない。**

---

## 5. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の消費・登録** | **なし。★本サブは CHANGE を 1 本も起票していない**（`DES-001` の改訂は設計卓へ請求する＝§6-1）。⇒ `docs/handover/change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1・§2.4 の 4 か所とも**更新不要** |
| 2 | **マイグレ連番の消費** | **なし**（`ls migrations/` は着手前と同一。ボード §2.2 の「次に払い出す番号」は動かない） |
| 3 | **版を上げた文書の参照元** | **なし**（本サブは文書の**版数**を上げていない。指示書・チェックリストとも v1.0.0 のまま） |
| 4 | **`docs/design/` への反映** | **★要る（§6-1）。製造は直さない** |
| 5 | **`docs/handover/followup-backlog.md` の `M14-h`** | **★解消したのは「`README.md` の Go 要求版数の是正」の 1 項目だけである**（2026-08-20 追記分）。**★同じ行が持つ「LICENSE ファイル追加（MIT 確定）＋ README『未定』の更新」と「ライセンス許可リストの区分 3 つ」は未着手**（レビュー指摘 M-5）。**⇒ 行ごと畳むと OSS 公開前ゲートである LICENSE 追加が黙って消える。** **★製造は §J 以外を編集できない**（`D-382`）⇒ 設計卓の手番 |

---

## 6. `docs/design/` に反映が要る箇所（**★製造は直していない**）

| # | 場所 | 現状 | あるべき姿 |
|---|---|---|---|
| **1** | `docs/design/01-tech-stack.md:120`（`DES-001` 技術スタック表） | `\| バックエンド \| Go 1.22+ \| BSD-3-Clause \| API処理、ビジネスロジック \|` | **`Go 1.26.4+`**（`go.mod` の実要求）。**★「1.22+」は意図的な下限表記ではなく更新漏れである**——go.mod が 1.26.4 を要求している以上 Go 1.22 ではビルドできない（§6-4 への回答）。**⇒ CHANGE 1 本が要る。★製造は自採番していない（`D-293`）** |

---

## 7. 開発者への確認事項（§7 ＋ 本サブで新たに出たもの）

| # | 確認事項 | 製造の判断・現状 |
|---|---|---|
| **1** | **`go.mod` の `go` ディレクティブを上げるか**（§7-1） | **上げていない。** 設計卓の暫定案（上げない）に従った。**★現状で困っていない**——`toolchain` 行で CI も手元も 1.26.8 になり、セキュリティ修正はすべて届く |
| **2** | **メジャー版上げが必要な依存**（§7-2） | **★`react-router-dom` 6 → 7 が実際に該当した。** `pnpm audit` の moderate 2 件はどちらも修正版が **7.18.0 以上**であり、6.x には修正が来ない。**⇒ 別サブへ送ることを推す**（設計卓の暫定案どおり）。react-router 7 は API が変わり、`web/src` 全体の導線に触れる |
| **3** | **minor を跨ぐ Go の版上げ**（§7-3） | **該当なし。** 1.26 系の最新 patch で必要な修正はすべて入る |
| **4** | **★新規: `nwsapi` の固定（`web/package.json` の `pnpm.overrides`）** | §2.4 の実測に基づき **`"nwsapi@>=2.2.26 <2.3.0": "2.2.25"`** を追加した（**★自己解除する条件付きの形**。jsdom が `^2.3` を要求する版へ上がれば黙って無害化する）。**★上流が 2.2.26 の性能回帰を直したら外すべき固定である。** 実測で「挙動は同一・遅いだけ」であることを確認済み（§2.4）。本サブでは「回帰した版を上げ幅から外す」判断として自己判断で進めた（`CLAUDE.md` §9 共通原則 2）。**異論があれば戻す。撤去条件は progress-log `### M28-03` の横断課題 1 にも置いた** |
| **5** | **★新規: devContainer のリビルド** | **開発者の手番**（§4-11）。Go が 1.26.2 → 1.26.8 へ動くため**リビルドが要る**。**★リビルド前に `/devcontainer_rebuild_check` を回すこと** |
| **6** | ~~**★★新規: `govulncheck` が 1 度も走っておらず、本サブの目的の一部が未達である**~~ **⇒ ★★【2026-09-06 解消】開発者の devContainer で実行され、Go 側 CVE 検査は達成された** | **★実測**（§4.2 追補に原文）: `govulncheck` → **`OK: 既知脆弱性なし`**。自コードが呼んでいる脆弱性 **0 件** ／ import しているパッケージ **0 件** ／ **`require` にのみ在るもの 1 件（呼んでいない）**。**⇒ 完了条件 3・4 に加えて、本サブの目的である「上げた結果、既知 CVE が残っていないか」の確認も済んだ。** **★★【2026-09-06 追補・残件も解消】`require` にのみ在る 1 件は `GO-2026-5932`（`golang.org/x/crypto/openpgp` は非推奨・`Fixed in: N/A`）と特定された**（§4.2 に原文と実査 4 点）。**★どの版へ上げても消えない指摘であり、`openpgp` は本アプリで不使用（grep 0 件）、`x/crypto` は `echo/v4 → acme` 経由の indirect で外せず、着手基点にも在った。⇒ 本サブ由来ではなく、追いかけない。** **⇒ 本サブに残る検証上の未達は 0 件。**<br>**★★【訂正の経緯】初版は「devContainer も許可リストに未登録で到達できない／足すかは開発者判断」と書いたが事実誤認だった**（§4.2 の訂正注記）。**`vuln.go.dev` は `init-firewall.sh:34` に 2026-08-26 から在る。⇒ 許可リストの追加も、それを足すかの判断も要らなかった。** 到達できなかったのは**本クラウド実行環境だけ**である（組織の egress ポリシーで 403。リポジトリ側からは動かせない）。<br>**★あわせて記録**: `govulncheck -version` の `No vulnerabilities found.` を到達性の証拠に使わないこと——走査対象ゼロで DB を引かないため 403 の環境でも同じ出力が出る（`progress-log.md:4740` で再現済み）。**到達性を測るなら `govulncheck ./...` を打つ。** SKIP が出る場合に疑うのは FW ではなく `go install` した `govulncheck` のツールチェーン版ずれ（`progress-log.md:4732`）だが、**本サブでツールチェーンを 1.26.8 へ上げた devContainer では素の go が go.mod の要求を満たすため、この経路も解消している** |
| **7** | **★新規: `.claude/commands/research_plan.md:16` の `Go 1.26.2+`** | **★製造は `.claude/` を編集しない**（§4-7）。実要求は 1.26.4、devContainer / CI は 1.26.8 |
| **8** | **★新規: `.claude/hooks/session-start.sh:83` の `GOVULNCHECK_VERSION="v1.1.4"`** | `Dockerfile:17` と同じ値の**2 本目の写し**であり、黙ってドリフトしうる。報告のみ |
| **9** | **★★新規: `.claude/hooks/session-start.sh:119` のコメントが本サブで失効した**（レビュー指摘 H-3） | 逐語＝「実測: クラウド実行環境の素の go は go1.24.7 で、**`go1.26.4` は go.mod 由来の toolchain 自動取得でのみ現れる**」。**★本サブが `toolchain go1.26.8` を足したため、実測は `go env GOVERSION` → `go1.26.8` になった**（素の go は `GOTOOLCHAIN=local go version` → `go1.24.7` で不変）。**★このコメントは `GOTOOLCHAIN` を固定する処理の「なぜ」を説明しており、値が 1 つずれたまま残ると次の担当が「1.26.4 が出るはずなのに 1.26.8 が出る」で時間を溶かす。動作は正しいままなのでどの検査も赤くならない。** **★製造は `.claude/` を編集しない（§4-7）ので報告のみ。開発者の手番。** |
| **10** | **★★新規: `setup-go` が `toolchain` 行を読むかが未観測である**（§2.1 の注記） | **★「CI は 1.26.8」は推論であって観測ではない。** `actions/setup-go@v7` が `go-version-file: go.mod` から `toolchain` 行を読むのか `go` ディレクティブだけを読むのかを、ログで確かめていない。**★Nightly の E2E が緑でも区別がつかない**——`setup-go` が 1.26.4 を入れても `GOTOOLCHAIN=auto` がビルド時に 1.26.8 を取得するため、**どちらの経路でもテストは緑になる。⇒ 実害は無く、未確定なのは機構だけである。** **★確定手段**: PR [#157](https://github.com/plexiblinp/combomgr/pull/157) の `Setup Go` ステップのログ（インストールした版を印字する）を 1 度見る。**★★製造は PR を読めない**——`gh` CLI が無く、GitHub MCP ツールは `.claude/settings.json` の deny（`mcp__*`）、`subscribe_pr_activity` も本セッションでは利用不可。**⇒ 開発者が貼る必要がある。** **★`pr-checks.yml` へ版数を直書きして解決しないこと**——`:223-224` が「ここに版数を書くと二重管理になり必ずずれる」と明記しており、**正本が `go.mod` 1 か所に寄っている設計は正しい** |
| **11** | **★新規: Nightly の `crossbuild` job（`make build-all`）の結果が未受領である** | 受け取ったのは `E2E (Playwright)` job の要約のみ（§4.1 追補）。**⇒ 3 OS クロスビルドの GitHub ランナー上での結果は未確認であり、§4.1 の 3 OS 緑は製造のコンテナでのローカル実測にとどまる。** **★「Nightly が緑」と丸めないこと。** 同じワークフローの job なので、Actions の該当 run を開けば確認できる。**★製造は読めない（上記 10 と同じ理由）** |

---

## 8. その他、実査で分かったこと

1. **★`.github/workflows/` は Go / pnpm の版を持たない設計になっている。** `go-version-file: go.mod` と `pnpm/action-setup@v6` の `package_json_file` により、**正本を 1 か所に保つ形が既に採られている**（`pr-checks.yml:223-224` に理由が明記）。**⇒ 本サブで CI を編集する必要が無かったのは偶然ではない。** 一方 **Node だけは 3 か所に `node-version: 22` が直書き**されており、この設計から外れている。
2. **★`.devcontainer/verify-env.sh:63-72` は版数の期待値を持たない。** `go version` / `node --version` / `pnpm --version` を実行して**表示する**だけなので、**§1.1 のような食い違いを検出しない。**
3. **★`docs/handover/followup-backlog.md:113` の followup `M14-h` が、この食い違いを既に起票していた**——逐語で「`Go 1.22 以上(devContainer は 1.26.2)` と書いてあるが go.mod は `go 1.26.4`」。**★この 1 項目だけを本サブで解消した。同じ行が持つ LICENSE 追加とライセンス許可リストの区分は未着手である**（§5-5）。**★製造は §J 以外を編集できない（`D-382`）ため、当該行の扱いは設計卓の手番である。★行ごと畳まないこと。**
4. **★版数の同期を守る機械検査は存在しない**（チェックリスト §7-2 が予告していたとおり）。`check-doc-refs.sh` はファイル参照だけを見る。**⇒ §1 の食い違いはどの検査も捕まえなかったし、次に同じことが起きても捕まえない。** 本サブの構造的な弱点として記録する。
5. **★本クラウド実行環境の ambient `pnpm` は 10.33.0 だが、`packageManager` フィールドにより実際に走ったのは corepack 管理下の 9.13.0 である**（実測）。**⇒ lock は規約どおりの pnpm が書いた。**

---

## 9. レビュー結果

- **レビュー報告書**: `docs/progress/m28-03-review.md`（Phase B。**メイン会話文脈を継承しない fresh subagent** が作成。`fork` は使っていない）
- **指摘の件数・優先度別内訳**: **重大 0 件 ／ 高 3 件 ／ 中 6 件 ／ 低 3 件**（計 12 件）
- **★「高」指摘の不採用は 0 件**（全 3 件を採用・是正済み）
- **採否**: 採用 **11 件** ／ 不採用 **1 件**（`L-1` のみ。理由は §9.1）
- **再レビュー往復の回数**: **0 回**（初回レビューのみ。上限 2 回に達していない ⇒ `followup-backlog.md` §J への停止時記録は不要）

### 9.1 トリアージ（採否と理由）

| ID | 優先度 | 指摘 | 採否 | 対応・理由 |
|---|---|---|---|---|
| **H-1** | 高 | `progress-log.md` への `### M28-03` 追記が無く、かつ §4.3 が該当検査を「緑」と誤記 | **採用** | `docs/progress/progress-log.md` の `### M28-03` 索引行を追記し、`check-progress-log-index.sh` が **exit 0** になることを目視してから §4.3 を実測どおりに書き直した。**★指摘のとおり `D-510` と同型の断定であり、私が本コマンドの Phase D-0 で避けるべきだった型そのものである** |
| **H-2** | 高 | `nwsapi` 固定の撤去条件が実在しない置き場に書かれている／裸の上限固定 | **採用** | (1) 撤去条件を progress-log `### M28-03` の横断課題 1 へ実在させ、§2.4 の案内を訂正 (2) **override の形を `"nwsapi@>=2.2.26 <2.3.0": "2.2.25"` へ変更**——既存 4 件と同じ条件付き型で、jsdom が `^2.3` を要求すれば黙って無害化する。**★解決結果が `nwsapi@2.2.25` のまま変わらないことを lock の `packages:` 集合突合で実測**（コミット `26cfb57` 時点と**差分ゼロ**） |
| **H-3** | 高 | `.claude/hooks/session-start.sh:119` のコメントが本サブで失効 | **採用** | §7-9 として追加し開発者へ回した。**★`.claude/` は製造の編集対象外（§4-7）なので報告のみが正しい対応である** |
| **M-1** | 中 | フロント lock の推移依存の変化が 1 件も報告されていない | **採用** | §2.3 に「推移依存の変化」節を追加。**★独立に再実測した結果、レビューが挙げた `@napi-rs/lzma-linux-x64-gnu` に加えて `@radix-ui/react-use-is-hydrated` も新規流入していた**（消えたのは `@radix-ui/react-use-escape-keydown` と `pify`） |
| **M-2** | 中 | `nwsapi` 回帰の一次資料が引かれておらず、性能回帰か正しさの修正か弁別していない | **採用** | **上流の changelog は egress 制約で引けなかった**（`go.dev` / `github.com` ともブロック）。**⇒ 実測で弁別した**——2.2.26 に固定したまま `--testTimeout=180000` で回すと **19 件すべて passed（719.98s）**。**assertion は 1 件も落ちない ⇒ 挙動は同一で遅いだけ＝性能回帰**。§2.4 に追記 |
| **M-3** | 中 | `pnpm.overrides` への追加は §6 の文言には当たらないが §6 の根拠は当てはまる | **採用** | §2.4 に「形式上は抵触しないが §6 の根拠は当てはまる ⇒ 開発者の追認を得るまで暫定」と明記し、§7-4 と progress-log にも残した |
| **M-4** | 中 | `GOTOOLCHAIN` 既定下の挙動変化が書かれていない | **採用** | §2.1 に追記。**★レビューの実測（`GOTOOLCHAIN=local` では `toolchain` 行が無視され `go` ディレクティブが効く）を確認して採った** |
| **M-5** | 中 | `M14-h` を「解消した」と書いているが解消したのは行の半分 | **採用** | §5-5 と §8-3 を「Go 版数の是正のみ解消。LICENSE 追加＋ライセンス許可リストは未着手」に限定。**★行ごと畳むと OSS 公開前ゲートが消えるという指摘は妥当である** |
| **M-6** | 中 | Go 側の CVE 検査が 1 度も走っていないまま完了扱いになっている | **採用** | §7-6 を「開発者判断」で終わらせず「**本サブの目的の一部が未達**」と明記した |
| **L-1** | 低 | `26cfb57` が「フロント依存の版上げ」と「`nwsapi` 固定」を 1 本に含む | **★不採用** | **理由 2 つ。** (1) レビュー自身が「§2.7 の段としては同じ『4: フロント依存』なので**違反ではない**」「H-2 の恒久記録が用意されれば実害は消える」と述べており、その恒久記録は H-2 で用意した (2) **既に push 済みのコミットを分け直すには履歴改変が要り、`CLAUDE.md` §10 で機械的に禁止されている**（rebase / reset は deny）。**⇒ 将来 override を足すときの指針としては妥当なので、progress-log の横断課題 4 に残した** |
| **L-2** | 低 | `package.json` のレンジだけが動いたものが一覧から落ちている | **採用** | §2.3 の逸脱注記へ 6 件の内訳を追記。**★導入版が不動であることを lock で再実測して確認した** |
| **L-3** | 低 | `verify-env.sh` が版数の期待値を持たない件が恒久記録に残っていない | **採用** | progress-log の横断課題 3 として残した |

### 9.2 ★レビューの破壊確認から受け取ったこと

レビューは §7 の破壊確認を **2 件**実施している（いずれも復元済み・`git status` で確認済み）。

1. **`go.mod` / `go.sum` を着手基点へ丸ごと戻しても `go build` も `go test` も緑のまま。** **⇒ 上げた Go 依存 11 本は「壊れなかった」ことしか示せていない。** とくに **Echo v4.15.4 のセキュリティ修正（GHSA-vfp3-v2gw-7wfq）に対応する回帰テストは 0 件**である。**★これは本サブの是正対象ではない**（指示書 §4-1「足すものは無い」）が、**「build-all が緑」は「上げた効果がある」の証拠ではない**という位置づけを受け入れ、progress-log の横断課題 2 に残した。
2. **`CLAUDE.md:39` の版数だけを改変しても、常設検査 10 本のうち版数について何か言った検査は 0 本。** **⇒ チェックリスト §7-2 の予告どおり、版数同期を守る機械検査は存在しない**（§8-4 と同じ結論を独立に再現）。

---

*以上、M28-03 完了報告。* **★本サブの落とし穴は「`go test` が緑になった時点で終わったと思うこと」だった**（指示書 §0.2）。**★実際に落ちたのは Vitest であり、`go test` も `make build-all` も `tsc` も緑のままだった。** 犯人は直接依存ではなく推移依存 1 本である。
