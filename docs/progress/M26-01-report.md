# M26-01 調査報告: 依存ライセンスの棚卸しと三層のパス割当（`A2` → `A1`）

| 項目 | 内容 |
|------|------|
| 作業 ID | `M26-01` |
| 指示書 | `docs/instructions/M26-01-license-inventory-and-three-layer.md` v1.0.0 |
| 実施日 | 2026-09-02 |
| baseline commit | `e1cd553cbb0940e1bc20f31c69ae9e7283a2a130`（2026-09-02） |
| 実装への書き込み | **無し**。本報告と `docs/progress/progress-log.md` の索引行、およびレビュー報告書のみ（§9 に `git diff --stat` を掲載） |
| CHANGE 消費 | **0 本**。`CHANGE-151` は本サブでは起票しない（指示書 §3.3） |
| マイグレ消費 | **0 本**。次に払い出す番号は `000081` のまま |

> **★本報告は法的助言ではない。** 一次源である `docs/human-notes/future-notes/combmgr-license-strategy-outline.md` が冒頭で「法的助言ではない。公開前に一次情報・必要なら専門家で確認すること」と自ら述べており、本報告も同じ制約を負う。以下の判定はすべて「〜と解される」「〜の可能性がある」の水準で読むこと。

---

## §0 調査条件

### §0.1 数えた範囲

| 対象 | 範囲 | 除外したもの |
|---|---|---|
| トップレベル要素 | リポジトリ直下の全エントリ（隠しファイル含む） | `.git` のみ |
| マイグレーション | `migrations/*.up.sql` | `*.down.sql` は指示書の対象外 |
| Go 依存 | `go.mod` の `require` ブロックで `// indirect` が付かない行 | — |
| フロント依存 | `web/package.json` の `dependencies` と `devDependencies` | 推移依存は件数のみ |
| 画像・ブランド資産 | リポジトリ全域 | `web/node_modules` / `.git` |

### §0.2 走査コマンド全文

```bash
# --- 母数 ---
ls -A | grep -v '^\.git$' | sort                       # トップレベル
ls -A | grep -v '^\.git$' | wc -l                      # → 27
ls migrations/*.up.sql | wc -l                         # → 80
ls migrations/*.up.sql | grep -c seed                  # → 35
ls migrations/ | sed -E 's/_.*//' | sort -u | tail -1  # → 000080（次は 000081）

awk '/^require \(/{f=1;next} /^\)/{f=0} f && !/\/\/ indirect/ && NF' go.mod | wc -l   # → 7
grep -c '// indirect' go.mod                                                          # → 15
jq -r '.dependencies    | length' web/package.json                                    # → 31
jq -r '.devDependencies | length' web/package.json                                    # → 14

find character_data -type f -name '*.csv'  | wc -l      # → 31
find character_data -type f ! -name '*.csv'             # → md 3 本

# --- ライセンス列（Go）: go-licenses が失敗したため手動法へ ---
go run github.com/google/go-licenses@latest csv ./...                       # 失敗（§1.1）
go run github.com/google/go-licenses@latest csv ./... --ignore github.com/plexiblinp/combomgr  # 同じく失敗
go mod download
awk '/^require \(/{f=1;next} /^\)/{f=0} f && !/\/\/ indirect/ && NF {print $1"@"$2}' go.mod \
  | while read -r m; do esc=$(echo "$m" | sed -E 's/([A-Z])/!\l\1/g');
      find "$(go env GOMODCACHE)/$esc" -maxdepth 1 -iregex '.*/\(LICEN[SC]E\|COPYING\)[^/]*'; done
grep -ci 'endorse or promote' <各 LICENSE>              # BSD-2 と BSD-3 の弁別

# --- 最終更新列 ---
awk '...' go.mod | xargs go list -m -json | jq -r 'select(.Path) | "\(.Path)\t\(.Version)\t\(.Time)"'
for n in $(jq -r '.dependencies | keys[]'    web/package.json); do pnpm view "$n" time.modified; done
for n in $(jq -r '.devDependencies | keys[]' web/package.json); do pnpm view "$n" time.modified; done

# --- ライセンス列（フロント）---
cd web && pnpm licenses list
cd web && pnpm licenses list --json

# --- 脆弱性列 ---
govulncheck ./...          # → 403（§1.3）
govulncheck -version       # → 対照。既知の偽陽性を再現（§1.3）
cd web && pnpm audit
cd web && pnpm audit --json

# --- 層 C / 層 D の探索（「無い」の根拠）---
find . -path ./web/node_modules -prune -o -path ./.git -prune -o -type f \
  \( -iname '*.svg' -o -iname '*.png' -o -iname '*.ico' -o -iname '*.jpg' \
     -o -iname '*.webp' -o -iname '*.gif' \) -print          # → 0 件
ls internal/                                                  # 層 C 候補の母集団
head -12 internal/<pkg>/*.go                                  # 各 godoc の主題を確認

# --- Dependabot ---
find . -maxdepth 3 -name 'dependabot.y*ml' -not -path './web/node_modules/*'   # → 0 件
find .github -type f                                                            # → workflow 2 本のみ

# --- マイグレの層判定 ---
for f in migrations/*.up.sql; do grep -m4 '^--' "$f"; done    # 各ファイルの意図コメント
grep -oiE '(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+[a-z_]+' migrations/*.up.sql
```

### §0.3 到達性の実測

| 対象 | 結果 |
|---|---|
| `proxy.golang.org` | 200 |
| `registry.npmjs.org` | 200 |
| **`vuln.go.dev`** | **到達不可**（`curl` で `000`、`govulncheck` で `403 Forbidden`） |

---

## §1 依存ライセンスの棚卸し（`A2`）＝ 成果物 1

### §1.1 走査手段の顛末（`go-licenses` は失敗した）

指示書 §2.1 が第一手に指定した `go run github.com/google/go-licenses@latest csv ./...` は **失敗し、CSV を 0 行しか出さなかった**。実出力（末尾）:

```
E0902 01:54:36.276341    5312 library.go:122] Failed to find license for github.com/plexiblinp/combomgr:
  cannot find a known open source license for "/home/user/combomgr" whose name matches regexp
  ^(?i)((UN)?LICEN(S|C)E|COPYING|README|NOTICE).*$ and locates up until "/home/user/combomgr"
E0902 01:54:36.276444    5312 library.go:117] Package embed does not have module info.
  Non go modules projects are no longer supported.
...
F0902 01:54:38.466134    5312 main.go:77] some errors occurred when loading direct and transitive dependency packages
exit status 1
```

**失敗の原因は 2 つある。**

1. **本体リポジトリに `LICENSE` ファイルが無いため、自モジュールのライセンスを解決できない。** ——**★これは本サブが解こうとしている当の課題であり、循環している。** `LICENSE` を置くのは `CHANGE-151` 反映後（指示書 §4-2）であるから、本サブの時点では原理的に解けない。
2. **`Package embed does not have module info` が標準ライブラリのパッケージ（`embed` / `io/fs` / `testing` / `context` 等）で多発する。** `go-licenses` の最新版は `v1.6.0`（2022 年）であり、**Go 1.26.4 の標準ライブラリの扱いに追随していない**と解される。

`--ignore github.com/plexiblinp/combomgr`（同ツール自身のフラグ）を付けて再実行したが、原因 2 が残るため同じく `exit status 1` / CSV 0 行であった。

**⇒ 指示書 §2.1 が定めたフォールバック**（「★失敗したら `go mod download` ＋ モジュールキャッシュ内の `LICENSE` を読む手動法へ落とす」）**に従った。新しいツールは導入していない**（§4-6）。

### §1.2 Go の direct 依存 — 母数 7 件（`go.mod` の `require` のうち `// indirect` が付かない行）

| # | モジュール | 版 | (a) ライセンス (SPDX) | 判定根拠 | (b) 最終更新 | (c) 既知脆弱性 |
|---|---|---|---|---|---|---|
| 1 | `github.com/BurntSushi/toml` | v1.6.0 | `MIT` | `COPYING` 冒頭 "The MIT License (MIT)" | 2025-12 | **確かめられなかった**（§1.3） |
| 2 | `github.com/golang-migrate/migrate/v4` | v4.19.1 | `MIT` | `LICENSE` 冒頭 "The MIT License (MIT)" | 2025-11 | **確かめられなかった** |
| 3 | `github.com/labstack/echo/v4` | v4.15.1 | `MIT` | `LICENSE` 冒頭 "The MIT License (MIT)" | 2026-02 | **確かめられなかった** |
| 4 | `github.com/pkg/browser` | v0.0.0-20240102092130 | `BSD-2-Clause` | `LICENSE` に 2 条のみ。"endorse or promote" 条項なし | 2024-01 | **確かめられなかった** |
| 5 | `golang.org/x/text` | v0.32.0 | `BSD-3-Clause` | `LICENSE` に "Neither the name of Google LLC … endorse or promote" 有り | 2025-12 | **確かめられなかった** |
| 6 | `gopkg.in/natefinch/lumberjack.v2` | v2.2.1 | `MIT` | `LICENSE` 冒頭 "The MIT License (MIT)" | 2023-02 | **確かめられなかった** |
| 7 | `modernc.org/sqlite` | v1.50.0 | `BSD-3-Clause` | `LICENSE` に 3 条目 "Neither the name of the copyright holder … endorse or promote" 有り | 2026-04 | **確かめられなかった** |

- **7 件すべてでライセンスファイルが実在した**（母数 7 / 発見 7）。「見つからなかった」セルは無い。
- (b) は `go list -m -json` の `.Time`（当該版の公開時刻）である。**モジュールの最終更新ではなく、採用している版の公開日である**ことに注意。

### §1.3 Go の脆弱性列は「クラウド環境では実行不可」

指示書 §2.1 の指示どおり `govulncheck ./...` を実行し、失敗の実出力を記録する。

```
$ govulncheck ./...
govulncheck: fetching vulnerabilities: Get "https://vuln.go.dev/index/modules.json.gz": Forbidden
（exit 1）
```

**対照として、既知の偽陽性も再現した**（followup `cloud-env-cannot-reach-vuln-go-dev` の記録どおり）:

```
$ govulncheck -version
Go: go1.26.4
Scanner: govulncheck@v1.1.4
DB: https://vuln.go.dev

No vulnerabilities found.
```

**★この "No vulnerabilities found." を到達性の証拠に使ってはならない。** 同コマンドはパッケージ引数を持たず走査対象がゼロであるため DB を引かず、**403 の環境でも同じ出力を返す**。到達可否の検査は必ず `govulncheck ./...` を打つこと。

**⇒ Go 側の (c) 列は「クラウド環境では実行不可」であり、開発者のローカル実行へ回す。**（指示書 §2.1 表。回避策は独自に作っていない。）

> **★補足: `govulncheck` のバイナリは在る。** `/root/.local/bin/govulncheck`（`v1.1.4`）。詰まっているのは `vuln.go.dev` への egress のみである。followup 台帳はこの状態を既に正しく記録している（`govulncheck-not-installed` は 2026-08-19 に「部分解消」へ更新済みで、追跡は §J の `cloud-env-cannot-reach-vuln-go-dev` が持つ）。**⇒ 台帳の更新は要らない。**

### §1.4 `// indirect` の全数 — **15 件**（notices の分量見積り用。一覧は指示書が不要としている）

なお `pnpm licenses list` が数えたフロント側の**推移依存を含む全パッケージ数は 315 件**であった。third-party notices の分量は、**フロント 315 件（direct 45 を含む総数）と Go 22 件（direct 7 ＋ `// indirect` 15）**が主たる母数になると解される。**★Go 側は direct も notices の対象であるため、`// indirect` の 15 件だけを並べると母数が非対称になる。**

### §1.5 フロントの direct 依存 — `dependencies` 母数 31 件

| # | パッケージ | 版指定 | (a) ライセンス (SPDX) | (b) 最終更新 | (c) 既知脆弱性 |
|---|---|---|---|---|---|
| 1 | `@hookform/resolvers` | `^5.4.0` | `MIT` | 2026-08 | 無し |
| 2 | `@radix-ui/react-accordion` | `^1.2.12` | `MIT` | 2026-07 | 無し |
| 3 | `@radix-ui/react-alert-dialog` | `^1.1.15` | `MIT` | 2026-07 | 無し |
| 4 | `@radix-ui/react-checkbox` | `^1.3.3` | `MIT` | 2026-07 | 無し |
| 5 | `@radix-ui/react-dialog` | `^1.1.15` | `MIT` | 2026-07 | 無し |
| 6 | `@radix-ui/react-dropdown-menu` | `^2.1.16` | `MIT` | 2026-07 | 無し |
| 7 | `@radix-ui/react-label` | `^2.1.8` | `MIT` | 2026-07 | 無し |
| 8 | `@radix-ui/react-popover` | `^1.1.15` | `MIT` | 2026-07 | 無し |
| 9 | `@radix-ui/react-radio-group` | `^1.3.8` | `MIT` | 2026-07 | 無し |
| 10 | `@radix-ui/react-select` | `^2.2.6` | `MIT` | 2026-07 | 無し |
| 11 | `@radix-ui/react-slot` | `^1.2.4` | `MIT` | 2026-07 | 無し |
| 12 | `@radix-ui/react-switch` | `^1.2.6` | `MIT` | 2026-07 | 無し |
| 13 | `@radix-ui/react-tabs` | `^1.1.13` | `MIT` | 2026-07 | 無し |
| 14 | `@radix-ui/react-tooltip` | `^1.2.8` | `MIT` | 2026-07 | 無し |
| 15 | `@tanstack/react-query` | `^5.62.0` | `MIT` | 2026-08 | 無し |
| 16 | `class-variance-authority` | `^0.7.1` | `Apache-2.0` | 2024-11 | 無し |
| 17 | `clsx` | `^2.1.1` | `MIT` | 2025-06 | 無し |
| 18 | `html-to-image` | `^1.11.13` | `MIT` | 2025-04 | 無し |
| 19 | `i18next` | `^23.16.6` | `MIT` | 2026-09 | 無し |
| 20 | `lucide-react` | `^0.460.0` | `ISC` | 2026-09 | 無し |
| 21 | `pdf-lib` | `^1.17.1` | `MIT` | 2022-05 | 無し |
| 22 | `qrcode.react` | `^4.2.0` | `ISC` | 2024-12 | 無し |
| 23 | `react` | `^18.3.1` | `MIT` | 2026-09 | 無し |
| 24 | `react-dom` | `^18.3.1` | `MIT` | 2026-09 | 無し |
| 25 | `react-hook-form` | `^7.76.1` | `MIT` | 2026-08 | 無し |
| 26 | `react-i18next` | `^15.1.3` | `MIT` | 2026-09 | 無し |
| 27 | `react-router-dom` | `^6.30.4` | `MIT` | 2026-08 | **有り**（§1.7） |
| 28 | `sonner` | `^2.0.7` | `MIT` | 2026-08 | 無し |
| 29 | `tailwind-merge` | `^3.6.0` | `MIT` | 2026-08 | 無し |
| 30 | `tailwindcss-animate` | `^1.0.7` | `MIT` | 2023-08 | 無し |
| 31 | `zod` | `^3.25.76` | `MIT` | 2026-08 | 無し |

### §1.6 フロントの direct 依存 — `devDependencies` 母数 14 件

| # | パッケージ | 版指定 | (a) ライセンス (SPDX) | (b) 最終更新 | (c) 既知脆弱性 |
|---|---|---|---|---|---|
| 1 | `@playwright/test` | `^1.60.0` | `Apache-2.0` | 2026-09 | 無し |
| 2 | `@testing-library/react` | `^16.0.1` | `MIT` | 2026-08 | 無し |
| 3 | `@testing-library/user-event` | `^14.6.1` | `MIT` | 2026-09 | 無し |
| 4 | `@types/node` | `^20.17.6` | `MIT` | 2026-09 | 無し |
| 5 | `@types/react` | `^18.3.12` | `MIT` | 2026-07 | 無し |
| 6 | `@types/react-dom` | `^18.3.1` | `MIT` | 2026-08 | 無し |
| 7 | `@vitejs/plugin-react` | `^4.3.3` | `MIT` | 2026-08 | 無し |
| 8 | `autoprefixer` | `^10.4.20` | `MIT` | 2026-07 | 無し |
| 9 | `jsdom` | `^25.0.1` | `MIT` | 2026-07 | 無し |
| 10 | `postcss` | `^8.4.49` | `MIT` | 2026-08 | **有り**（§1.7） |
| 11 | `tailwindcss` | `^3.4.15` | `MIT` | 2026-08 | 無し |
| 12 | `typescript` | `^5.6.3` | `Apache-2.0` | 2026-09 | 無し |
| 13 | `vite` | `^6.4.3` | `MIT` | 2026-08 | 無し |
| 14 | `vitest` | `^3.2.6` | `MIT` | 2026-08 | 無し |

- **45 件すべてで (a) と (b) が埋まった**（母数 31 + 14 = 45 / 解決 45）。「確かめられなかった」セルは無い。
- (b) は npm registry の `time.modified`（当該パッケージの最新公開時刻）である。**採用している版の公開日ではない。**
- (a) はツリー全体で観測された 9 種〔`MIT` / `MIT-0` / `ISC` / `Apache-2.0` / `BSD-2-Clause` / `BSD-3-Clause` / `0BSD` / `CC-BY-4.0` / `(MIT AND Zlib)`〕のうち、direct 依存に現れたのは **`MIT` / `ISC` / `Apache-2.0` の 3 種のみ**であった。

> **★参考: `SUPP-001` §5.7 の「最終更新が 2 年以上前」に照らした照合。**
>
> **どちらの読みを採ったか**: 同項の逐語は「最終更新が2年以上前(**2024年以前**)のライブラリは原則不使用」である。**括弧の側（2024 年以前＝ 2025-01 より前）を採った。** 前半の文字どおり（2026-09 起点で 2024-09 より前）を採ると該当は 4 件に減る。
>
> **母数は direct 依存の全体 52 件**（Go 7 ＋ フロント 45）。**該当は 6 件**——フロント 4 件〔`pdf-lib` 2022-05 ／ `tailwindcss-animate` 2023-08 ／ `class-variance-authority` 2024-11 ／ `qrcode.react` 2024-12〕、**Go 2 件**〔`gopkg.in/natefinch/lumberjack.v2` 2023-02 ／ `github.com/pkg/browser` 2024-01〕。
>
> **★これは既に採用済みの依存についての事実であり、同項は新規追加の規定であるから、違反を主張するものではない。** 判断材料として挙げるにとどめる。

### §1.7 フロントの脆弱性列 — `pnpm audit` は **11 件**を報告した（`high` 6 / `moderate` 4 / `low` 1）

| 深刻度 | パッケージ | 脆弱な版 | 修正版 | Advisory | direct か |
|---|---|---|---|---|---|
| high | `browserslist` | `<=4.28.6` | `>=4.28.7` | GHSA-73wf-gq98-2v4g | 推移（dev） |
| high | `browserslist` | `<=4.28.6` | `>=4.28.7` | GHSA-c83g-rgw3-j3cx | 推移（dev） |
| high | `nanoid` | `<3.3.12` | `>=3.3.12` | GHSA-xwg4-73v4-xw9w | 推移（dev） |
| high | `nanoid` | `<3.3.16` | `>=3.3.16` | GHSA-28wg-ghj8-5hjv | 推移（dev） |
| high | `nanoid` | `<3.3.18` | `>=3.3.18` | GHSA-2v37-7h3g-55p8 | 推移（dev） |
| high | `postcss` | `<=8.5.17` | `>=8.5.18` | GHSA-r28c-9q8g-f849 | **direct（dev）** |
| moderate | `postcss` | `<=8.5.22` | `>=8.5.23` | GHSA-fxqj-rqcc-2cmp | **direct（dev）** |
| moderate | `react-router` | `>=6.0.0 <7.18.0` | `>=7.18.0` | GHSA-wrjc-x8rr-h8h6 | 推移（**prod**） |
| moderate | `react-router` | `>=6.4.0 <7.18.0` | `>=7.18.0` | GHSA-337j-9hxr-rhxg | 推移（**prod**） |
| moderate | `react-router-dom` | `>=6.30.2 <=6.30.4` | **`<0.0.0`** | GHSA-jjmj-jmhj-qwj2 | **direct（prod）** |
| low | `postcss-selector-parser` | `>=6.1.0 <6.1.3` | `>=6.1.3` | GHSA-w9m9-85wc-3x92 | 推移（dev） |

**★注目すべき 1 件**: `react-router-dom` の GHSA-jjmj-jmhj-qwj2 は **`Patched versions: <0.0.0`**、すなわち **v6 系に修正版が存在しない**。修正には v7 系への移行が要ると解される。**★本サブは調査であり、依存の更新は行っていない**（指示書 §4-1「コードの変更」に当たる）。**⇒ §6 要判断へ回す。**

### §1.8 Dependabot alerts が現在有効か — **確かめられなかった**

どう探したか:

- `find . -maxdepth 3 -name 'dependabot.y*ml'` → **0 件**。`.github/` に在るのは `nightly-crossbuild.yml` と `pr-checks.yml` の workflow 2 本のみ。**⇒ リポジトリ内に Dependabot の設定ファイルは無い**（これは version updates の設定であり、alerts の有効・無効とは別物である）。
- **Dependabot alerts の有効・無効は GitHub のリポジトリ設定であり、作業ツリーからは観測できない。** 本環境では `.claude/settings.json` が `mcp__*` を deny しているため GitHub API 経路も使えない。

**⇒ 「現在有効か」は確かめられなかった。** 有効化の要否は `M26-04`（`A7`）の扱いであり、その時点で開発者が GitHub 画面で確認する必要がある。

---

## §2 三層のパス割当（`A1` の前提）＝ 成果物 2

### §2.0 割当に使った基準（指示書 §2.2 の表をそのまま用いた）

| 層 | SPDX | 基準（指示書の逐語） |
|---|---|---|
| A. アプリ本体 | `AGPL-3.0-or-later` | 配布バイナリの動作に寄与するソース。テスト・ビルド設定・CI もここ（本体と不可分） |
| B. ゲームデータ | `CC-BY-SA-4.0` | キャラクター・技・フレームデータ・手入力配布データ。「事実」を集めたもの |
| C. 汎用モジュール | `MIT` | ゲーム非依存で、単体で他プロジェクトへ持ち出せるもの |
| D. ブランド | 対象外 | ロゴ・名称。商標として別管理 |
| 未割当 | — | 上記のどれにも当てはまらない、または判断材料が足りないもの |

**★指示書 §0.2 が「基準に当てはまらないものは『未割当』と書くこと。推測で層へ入れない」と定めているため、下表では基準の文言に当てはまらないものを機械的に「未割当」へ寄せた。** 「未割当」は判断放棄ではなく、**基準側に受け皿が無いことの指摘**である（§6 で扱う）。

### §2.1 トップレベル全 27 件の割当

母数の実測は **27 件**（`ls -A | grep -v '^\.git$' | wc -l`。`.git` のみ除外）。

| # | パス | 層 | 根拠 |
|---|---|---|---|
| 1 | `.agents/` | **未割当** | AI 運用ルール（`skills/`）。配布バイナリの動作に寄与せず、ゲームデータでもなく、単体で持ち出す汎用モジュールでもない。★公開してよいことは `D-637` (3) で決着済みだが、層の受け皿が無い |
| 2 | `.claude/` | **未割当** | 同上（`commands/` `hooks/` `rules/` `settings.json`） |
| 3 | `.codex/` | **未割当** | 同上（`config.toml` `hooks.json` `rules/`） |
| 4 | `.devcontainer/` | **A** | 開発環境定義。基準の「ビルド設定」に当たると解される。★公開物から外すことは `P-47` で決定済みだが、**「公開しない」と「層の割当」は別問題**であり、層としては A |
| 5 | `.editorconfig` | **A** | 開発・ビルド設定 |
| 6 | `.gitattributes` | **A** | VCS 設定。本体と不可分 |
| 7 | `.github/` | **A** | CI（workflow 2 本）。基準が明示的に含めている |
| 8 | `.gitignore` | **A** | VCS 設定 |
| 9 | `AGENTS.md` | **未割当** | AI 運用ルール（`.codex/` 側の正本） |
| 10 | `CLAUDE.md` | **未割当** | AI 運用ルール（`.claude/` 側の正本） |
| 11 | `Makefile` | **A** | ビルド設定。基準が明示的に含めている |
| 12 | `README.md` | **A** | 開発者向け README。本体の説明文書 |
| 13 | `README.txt` | **A** | **配布版 README**（冒頭に「配布版 README」と明記）。**★単一バイナリと一緒に配られる＝配布物そのもの**であり、層 A である |
| 14 | `character_data/` | **★層が割れる** | §2.3 で内訳 |
| 15 | `cmd/` | **A** | Go エントリポイント（`combomgr` / `seedgen`） |
| 16 | `config.toml.example` | **A** | 設定ファイル雛形。配布物に含まれる |
| 17 | `docs/` | **未割当** | §2.5 で判断材料を提示。**最終判断は開発者**（指示書 §7） |
| 18 | `embed_migrations.go` | **A** | Go ソース（embed） |
| 19 | `embed_web_release.go` | **A** | Go ソース（embed） |
| 20 | `embed_web_stub.go` | **A** | Go ソース（embed） |
| 21 | `go.mod` | **A** | ビルド設定 |
| 22 | `go.sum` | **A** | ビルド設定 |
| 23 | `human-notes/` | **未割当** | 実体は `human-notes/codex/README.md` の 1 本のみ（Codex 派生物の同期ルール）。AI 運用ルールと同じ性質 |
| 24 | `internal/` | **A** | Go ソース。**★層 C の候補を含むが、判定の結果 0 件**（§2.4） |
| 25 | `migrations/` | **★層が割れる** | §2.2 で全 80 本の内訳 |
| 26 | `scripts/` | **A** | 30 エントリ（`.sh` 28 本 ／ `.sql` 1 本 ＝ `clear-validation-data.sql` ／ `.md` 1 本 ＝ `dev-throwaway-db-guide.md`）。機械検査・生成系。テスト・ビルド設定に類すると解される |
| 27 | `web/` | **A** | フロントエンドソース |

**内訳の総計**: 層 A **18 件** ／ 未割当 **7 件** ／ 層が割れる **2 件** = **27 件**（母数と一致・欠落 0）。
**層 B 単独・層 C・層 D に当たるトップレベル要素は 0 件**である（層 B は `migrations/` と `character_data/` の内側にのみ現れる）。

### §2.2 `migrations/` 全 80 本の層 A / 層 B 分割

母数の実測は **80 本**（`ls migrations/*.up.sql | wc -l`）。**「名前に `seed` が付く＝層 B」という機械的な規則は採らなかった**（指示書 §2.2-2）。判定は **各ファイルの意図コメントと、実際に書き込むテーブル・値の中身**で行った。

判定規則:

- **層 A** = スキーマ DDL ／ アプリ構造の変更 ／ **アプリの初期データ**（表記プリセット・タグ・既定ユーザー・ゲームマスタ）／ 合成テストデータ。
- **層 B** = SF6 の事実そのもの（ロスター・技・フレームデータ・コマンド・派生関係・キャラ固有ゲージ系・公式表記の技名）。

| # | ファイル | 層 | 根拠 |
|---|---|---|---|
| 1 | `000001_init_schema.up.sql` | **A** | スキーマ DDL のみ（全 13 テーブル + インデックス） |
| 2 | `000002_seed_games.up.sql` | **A** | games マスタ 1 行。SF6 のタイトル名のみでゲーム内事実を含まない |
| 3 | `000003_seed_characters.up.sql` | **B** | ryu の characters 行（ロスター事実） |
| 4 | `000004_seed_moves_ryu.up.sql` | **B** | ryu の技マスタ |
| 5 | `000005_seed_presets.up.sql` | **A** | 表記プリセット定義（アプリの記法体系。SF6 由来ではない） |
| 6 | `000006_seed_aliases_official_ja_move.up.sql` | **B** | 公式日本語技名（立ち弱P 等）を move_code へ対応づけ |
| 7 | `000007_seed_initial_tags_user1.up.sql` | **A** | 既定ユーザー + 予約カテゴリのタグ 3 件 |
| 8 | `000008_drop_gauge_consumed_total.up.sql` | **A** | 列削除 DDL |
| 9 | `000009_seed_characters_aki_jamie_guile.up.sql` | **B** | characters 行（ロスター事実） |
| 10 | `000010_seed_moves_aki_jamie_guile.up.sql` | **B** | 技マスタ |
| 11 | `000011_seed_aliases_official_ja_move_aki_jamie_guile.up.sql` | **B** | 公式日本語技名 |
| 12 | `000012_seed_combos_durability.up.sql` | **A** | 耐久テスト用の合成コンボ。ヘッダに「SF6 的正確性は不問」と明記 |
| 13 | `000013_add_moves_frame_columns.up.sql` | **A** | 列追加 DDL |
| 14 | `000014_seed_characters_classic5.up.sql` | **B** | characters 行（ロスター事実） |
| 15 | `000015_seed_custom_states_classic3.up.sql` | **B** | キャラ固有ゲージ系（custom_states）の定義 |
| 16 | `000016_change_drive_damage_to_real.up.sql` | **A** | 型変更 DDL |
| 17 | `000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` | **B** | seed 済みゲームデータの整理と move_code 統一（★FK=OFF のため CASCADE に頼れず、層 A 側の 4 表を明示 DELETE している。混在） |
| 18 | `000018_cleanup_moves_unobservable_columns.up.sql` | **A** | moves スキーマ整理 DDL |
| 19 | `000019_change_drive_available_at_start_to_real.up.sql` | **A** | 型変更 DDL |
| 20 | `000020_add_gauge_consumed_columns.up.sql` | **A** | 列追加 DDL |
| 21 | `000021_normalize_combo_oki_options.up.sql` | **A** | アプリ表の正規化 DDL + 移送 |
| 22 | `000022_unify_dash_to_system_move.up.sql` | **A** | combo_steps / setup_steps（利用者データ構造）の表現統一 |
| 23 | `000023_add_show_delta_ingrid_sun_crest.up.sql` | **B** | custom_states の表示挙動（キャラ固有） |
| 24 | `000024_seed_characters_first_wave.up.sql` | **B** | characters 行（ロスター事実） |
| 25 | `000025_seed_movement_system_moves_all.up.sql` | **B** | 移動 system move 9 種 + 別名 |
| 26 | `000026_seed_moves_first_wave.up.sql` | **B** | 技マスタ + 別名 + recovery |
| 27 | `000027_seed_custom_states_first_wave.up.sql` | **B** | キャラ固有ゲージ系の定義 |
| 28 | `000028_sweep_modifier_dash.up.sql` | **A** | combo_steps / setup_steps の残行掃き取り |
| 29 | `000029_clear_ryu_legacy_seed.up.sql` | **B** | seed 済みゲームデータの前段クリア |
| 30 | `000030_seed_moves_ryu.up.sql` | **B** | 手入力 CSV 由来の技マスタ |
| 31 | `000031_add_combo_media.up.sql` | **A** | 列追加 DDL |
| 32 | `000032_add_moves_is_derived.up.sql` | **A** | 列追加 DDL |
| 33 | `000033_create_move_commands.up.sql` | **A** | 表新設 DDL |
| 34 | `000034_backfill_moves_is_derived.up.sql` | **B** | 派生技フラグ（SF6 の事実） |
| 35 | `000035_seed_move_commands.up.sql` | **B** | command 索引（SF6 のコマンド） |
| 36 | `000036_create_combo_punishes.up.sql` | **A** | 表新設 DDL |
| 37 | `000037_create_combo_punish_prunings_and_curations.up.sql` | **A** | 表新設 DDL |
| 38 | `000038_add_combos_materialized_from.up.sql` | **A** | 列追加 DDL |
| 39 | `000039_add_moves_is_projectile.up.sql` | **B** | DDL 1 行 + 飛び道具判別 8 キャラ分（本文の大半が SF6 の事実。★混在） |
| 40 | `000040_create_combo_punish_starters.up.sql` | **A** | 表新設 DDL |
| 41 | `000041_backfill_movement_total.up.sql` | **B** | 移動技の全体フレーム |
| 42 | `000042_create_combo_setup_results.up.sql` | **A** | 表新設 DDL |
| 43 | `000043_seed_characters_manon.up.sql` | **B** | characters 行（ロスター事実） |
| 44 | `000044_seed_movement_system_moves_manon.up.sql` | **B** | 移動 system move + 別名 |
| 45 | `000045_seed_moves_manon.up.sql` | **B** | 技マスタ |
| 46 | `000046_backfill_moves_is_derived_manon.up.sql` | **B** | 派生技フラグ |
| 47 | `000047_seed_move_commands_manon.up.sql` | **B** | command 索引 |
| 48 | `000048_backfill_movement_total_manon.up.sql` | **B** | 移動技の全体フレーム |
| 49 | `000049_add_moves_frame_cost_columns.up.sql` | **A** | 列追加 + 表新設 DDL |
| 50 | `000050_backfill_moves_frame_cost.up.sql` | **B** | フレーム費用（機械決定分） |
| 51 | `000051_seed_moves_zangief_rapid.up.sql` | **B** | 技マスタ |
| 52 | `000052_backfill_moves_chain_cancel_total.up.sql` | **B** | 連打キャンセル実消費フレーム |
| 53 | `000053_seed_characters_third_wave.up.sql` | **B** | characters 行（ロスター事実） |
| 54 | `000054_seed_movement_system_moves_third_wave.up.sql` | **B** | 移動 system move + 別名 |
| 55 | `000055_seed_moves_third_wave.up.sql` | **B** | 技マスタ |
| 56 | `000056_backfill_moves_is_derived_third_wave.up.sql` | **B** | 派生技フラグ |
| 57 | `000057_seed_move_commands_third_wave.up.sql` | **B** | command 索引 |
| 58 | `000058_backfill_moves_is_projectile_third_wave.up.sql` | **B** | 飛び道具判別 |
| 59 | `000059_backfill_movement_total_third_wave.up.sql` | **B** | 移動技の全体フレーム |
| 60 | `000060_backfill_moves_chain_cancel_total_third_wave.up.sql` | **B** | 連打キャンセル実消費フレーム |
| 61 | `000061_seed_move_derivations_zangief_rapid.up.sql` | **B** | 技の親子関係 |
| 62 | `000062_backfill_moves_frame_cost_third_wave.up.sql` | **B** | フレーム費用 |
| 63 | `000063_correct_moves_data_m1904c.up.sql` | **B** | 技データの是正 10 行 |
| 64 | `000064_backfill_frame_cost_manual.up.sql` | **B** | 人手判断のフレーム値 |
| 65 | `000065_correct_frame_values_phase2.up.sql` | **B** | フレーム値の是正 |
| 66 | `000066_correct_jamie_freeflow_codes.up.sql` | **B** | move_code の是正 |
| 67 | `000067_backfill_frame_cost_manual_addendum.up.sql` | **B** | 人手判断のフレーム値（追補） |
| 68 | `000068_correct_fastest_unreachable_addendum.up.sql` | **B** | fastest_unreachable の是正 |
| 69 | `000069_m20_initial_presets_three.up.sql` | **A** | 組み込みプリセットの整理（記法体系＝アプリ側） |
| 70 | `000070_m20_preset_aliases_add_alias_text_en.up.sql` | **A** | 列追加 DDL |
| 71 | `000071_m20_seed_move_commands_od4.up.sql` | **B** | command 索引（OD 技 4 件） |
| 72 | `000072_m20_seed_aliases_numeric.up.sql` | **B** | seedgen が character_data/*.csv から生成した別名（生成物） |
| 73 | `000073_m20_seed_aliases_srk.up.sql` | **B** | seedgen が character_data/*.csv から生成した別名（生成物） |
| 74 | `000074_m20_preset_aliases_add_character_id.up.sql` | **A** | 列追加 + 構造的 backfill DDL |
| 75 | `000075_m20_preset_aliases_unique.up.sql` | **A** | 一意制約 DDL |
| 76 | `000076_m20_seed_aliases_p34_numeric.up.sql` | **B** | 別名投入（P-34 の 13 件） |
| 77 | `000077_m20_seed_aliases_p34_srk.up.sql` | **B** | 別名投入（P-34 の 13 件） |
| 78 | `000078_add_combos_superseded_by.up.sql` | **A** | 列追加 DDL |
| 79 | `000079_fix_character_display_names.up.sql` | **B** | キャラ表示名をインゲーム表示へ是正 |
| 80 | `000080_fix_ground_dash_label.up.sql` | **B** | 地上ダッシュの日本語表示語の是正 |

**内訳の総計**: 層 A **28 本** ／ 層 B **52 本** = **80 本**（母数と一致・欠落 0）。表の行名と `ls migrations/*.up.sql` の突合を `diff` で行い、**完全一致**（欠落・余剰 0）を確認した。

#### §2.2.1 指示書が名指しした 4 本の判定 — **4 本とも層 A であった**

指示書 §2.2-2 は「`seed_games` / `seed_presets` / `seed_initial_tags_user1` / `seed_combos_durability` はアプリの初期データであってゲームデータではない可能性がある。⇒ 中身を見て判定すること」と指示した。**中身を開いた結果、4 本とも層 A と解される。**

| ファイル | 中身 | 判定 |
|---|---|---|
| `000002_seed_games` | `INSERT INTO games (code, name_ja, name_en) VALUES ('sf6', 'ストリートファイター6', 'Street Fighter 6');` の 1 行のみ（全 5 行） | **A**。ゲームのタイトル名だけであり、ゲーム内の事実（技・フレーム）を一切含まない。★タイトル名は商標であり、そもそも著作権ライセンスの対象になじまないと解される |
| `000005_seed_presets` | 表記プリセット 5 種（`official_ja_move` / `numeric_ja` / `srk` 等）のレコード | **A**。**記法体系はアプリの設計物**であって SF6 由来ではない |
| `000007_seed_initial_tags_user1` | 既定ユーザー `id=1` と予約カテゴリ `mycombo_status` のタグ 3 件（使用中 / 練習中 / 頻度低下） | **A**。アプリの初期状態。ヘッダも「本来は M6 初回起動ウィザードで生成」と述べており、**ウィザードの代替**であることが明示されている |
| `000012_seed_combos_durability` | 耐久テスト用の合成コンボ 36 件 | **A**。**ヘッダが「SF6 的正確性は不問」と明記**しており、SF6 の事実を主張していない。テストフィクスチャである |

#### §2.2.2 層の境界が 1 ファイル内で割れているもの（**3 本**）

**★SPDX ヘッダは 1 ファイルに 1 つしか書けないため、この 3 本は開発者の判断が要る。**

判定方法: 層 B と判定した 52 本について、書き込み先テーブルを機械走査し、**層 A 側の表（`combos` 系・`setups` 系・`presets` 系・`tags` / `users`）へ書き込むもの**を抽出した。

| ファイル | 割れ方 | 本報告の第一候補 |
|---|---|---|
| `000039_add_moves_is_projectile.up.sql` | 13 行目の `ALTER TABLE` 1 行が層 A、残り約 40 行が 8 キャラ分の「どの技が飛び道具か」（層 B）。全 53 行のうち 1〜11 行はコメント、12 行は空行 | **B**（本文の大半が SF6 の事実であるため） |
| `000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` | 主目的は seed 済みゲームデータの整理と `move_code` 統一（層 B）だが、**層 A 側の 4 表**（`combos` / `combo_steps` / `combo_tags` / `combo_setups`）を明示 DELETE する | **B**（主目的が層 B のデータ整理であるため） |
| **`000029_clear_ryu_legacy_seed.up.sql`** | 主目的は ryu の seed 済みゲームデータの前段クリア（層 B）だが、**層 A 側の 7 表**（`combos` / `combo_tags` / `combo_oki_options` / `combo_setups` / `combo_steps` / `setups` / `setup_steps`）を明示 DELETE する。**★`000017` より触る範囲が広い** | **B**（主目的が層 B のデータ整理であるため） |

> **★「FK 連鎖で触れる」のではない。因果が逆である。** 両ファイルのヘッダが逐語で述べているとおり——「マイグレーション接続は `foreign_keys=OFF`(`migrate.go` が pragma 無しで接続。アプリ接続のみ `db.go` で FK=ON)。**よって `combos` を DELETE しても子テーブル(`combo_steps` 等の `ON DELETE CASCADE`)は連鎖削除されない。** orphan を残さないため、**子行を先に明示 DELETE する。**」——**連鎖しないからこそ、層 A 側の表を 1 つずつ明示的に消している。** SPDX を配置する後任がここを読み違えないよう明記する。

#### §2.2.3 `seedgen` の生成物であるマイグレ（`000072` / `000073`）についての注記

この 2 本はヘッダに「本ファイルは `cmd/seedgen` が `character_data/*.csv` から生成した成果物(手編集しない)」と明記されている。**⇒ §2.4 の境界規則（生成コード＝層 A ／ 生成物＝層 B）をそのまま適用し、層 B とした。**

> **★用語の衝突に注意**（想定外の発見。§8-3 でも扱う）。`000072` のヘッダは「**層順の原理: command が表記を決める行は層 A、move_code の構造が決める行は層 B**」と書いているが、**これは seedgen 内部の別概念であり、本報告のライセンス三層とは無関係である。** 同じ「層 A / 層 B」という語が別の意味で既に使われているため、**SPDX ヘッダを入れる際に読み違えを生む可能性がある。**

### §2.3 `character_data/` — **層が割れる**（指示書 §2.2-3 の懸念は現実であった）

母数の実測は **34 ファイル**（`*.csv` **31 件** ＋ `*.md` **3 件**）。

| 対象 | 件数 | 層 | 根拠 |
|---|---|---|---|
| `*.csv` | **31** | **B** | 手入力配布データ。ヘッダ列は `character_code,move_code,category,name_ja,startup,active,recovery,total,on_hit,on_block,damage,…` であり、**フレームデータそのもの**。基準の「手入力配布データ」に直接当たる |
| `chain-cancel-measurements.md` | 1 | **B** | 「連打キャンセル実測 成果表（`chain_cancel_total`）」。**実測したフレーム値の集合**であり、体裁が Markdown なだけで中身はゲームデータ |
| `command-correction-history.md` | 1 | **B** | 「command 補完履歴」。公式データとの突合で補完した **command の全件記録**（1774 行）。中身は SF6 のコマンド表記 |
| `seed-progress.md` | 1 | **A** | 「seed 投入進捗管理」。**投入作業の進捗管理**であってゲームデータではない。プロジェクト運用文書 |

**⇒ `character_data/` を丸ごと層 B として扱うことはできない。** 33 件が層 B、`seed-progress.md` の 1 件のみが層 A である。

### §2.4 `internal/seedgen/` の境界 — **生成コードは層 A、生成物が層 B**

| 対象 | 層 | 根拠 |
|---|---|---|
| `internal/seedgen/` （15 ファイル：`csv.go` / `format.go` / `model.go` / `generate.go` / `generate_m1702.go` / `generate_m2002.go` ＋ テスト 9 本） | **A** | **ゲームデータを生成するコードはコードである。** CSV を読み SQL を書き出すロジックであり、SF6 の事実そのものは持たない |
| `cmd/seedgen/main.go` | **A** | 同上（エントリポイント） |
| `character_data/*.csv`（入力） | **B** | §2.3 |
| `migrations/000072` / `000073`（出力） | **B** | §2.2.3 |

**⇒ 境界は「`internal/seedgen/` と `cmd/seedgen/` の内側＝層 A」「その入力と出力＝層 B」に引かれる。** コードは層 B のデータを読み書きするが、コード自体は層 B にならない。

### §2.5 `docs/` の層 — **未割当。判断材料を挙げ、最終判断は開発者へ回す**（指示書 §2.2-7 / §7）

**判断材料:**

1. **三層の骨子は `docs/` に一言も言及していない。** 骨子 §0 の三層表が挙げるのは「Go / React のコード」「moves・フレームデータ・手入力配布データ」「ゲーム非依存部」の 3 つだけである。**⇒ 受け皿が設計されていない。**
2. **`docs/` はアーカイブを含め全部公開する方針である**（開発者判断）。**⇒ 「公開するか」は決着済みで、残るのは「どの条件で公開するか」だけである。**
3. **`docs/` の中身は均質ではない。** 直下に 10 ディレクトリが在る——`audits` / `change-notes` / `design` / `handover` / `human-notes` / `instructions` / `process` / `progress` / `seed-data` / `usermanual`。
   - **`docs/usermanual/combmgr-friend-readme.html`** は**利用者向けの配布物**であり、`README.txt` と同じ性質を持つ（層 A に近い）。
   - **`docs/seed-data/`**（7 ファイル）は seed 入力の判断基準・エッジケース記録であり、**ゲームデータの周辺文書**である（層 B に近い）。
   - 残りは設計書・指示書・進捗ログといった**開発文書**である。
4. **層 A の基準（配布バイナリの動作に寄与するソース）に、文書は文言上当てはまらない。** 一方で「本体と不可分」という補足には当てはまりうる。
5. **文書に `CC-BY-SA-4.0`（層 B）を当てるのは、基準の「事実を集めたもの」に反する。** 設計書は事実の集合ではなく著作物である。

**⇒ 本報告としては、以下の 3 案を提示するにとどめる。**

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| 案1 | **`docs/` 全体を層 A に含める** | 単純。`LICENSE` 1 本で済む | `AGPL` は本来ソフトウェア向けであり、文書へ当てるのは素直でないと解される |
| 案2 | **文書用の第 4 の層を立てる**（例: `CC-BY-4.0` または `CC-BY-SA-4.0`） | 文書に適したライセンスを当てられる | 層が 1 つ増え、`LICENSES/` の管理対象が増える |
| 案3 | **`docs/` を層 A に含めつつ、`docs/usermanual/` と `docs/seed-data/` だけ個別に扱う** | 実態に最も近い | 境界が細かく、SPDX ヘッダの運用が煩雑になる |

**★本報告は案を選ばない。** 指示書 §7 が「報告を受けてから開発者が決める」と定めているためである。

### §2.6 AI 運用ルール群（`CLAUDE.md` / `.claude/` / `AGENTS.md` / `.codex/` / `.agents/`）の層 — **未割当**

**★公開してよいことは決着済みである**（`D-637` (3)）。**未割当としたのは、公開可否ではなく「三層の基準に受け皿が無い」ためである。**

- 層 A の基準「配布バイナリの動作に寄与するソース」——**寄与しない**。これらは開発時に AI が読むルールであり、バイナリには入らない。
- 補足の「テスト・ビルド設定・CI もここ（本体と不可分）」——**ビルド設定でも CI でもない**。ただし「本体と不可分」という点だけは当てはまる（このリポジトリの開発手順そのものであるため）。
- 層 B（事実の集合）でも、層 C（ゲーム非依存で持ち出せる汎用モジュール）でもない。
  - **★ただし層 C との関係は微妙である。** `.claude/commands/` の製造 CLI 群や `scripts/check-*.sh` は、**ゲームに一切依存せず、他プロジェクトへ持ち出せる**。`CLAUDE.md` 冒頭も「本ファイルを別プロジェクトに流用する際に書き換えるべき箇所」を `<!-- TEMPLATE NOTE -->` で示しており、**流用を前提に書かれている**。⇒ **層 C の定義に当てはまる可能性がある**（§2.7 で扱う）。

**⇒ 「層 A に含める」か「層 C とする」か「文書として §2.5 の判断に合わせる」かは、開発者の判断事項として §6 へ挙げる。**

### §2.7 層 C（汎用モジュール・`MIT`）の実体 — **ソースコードとしては 0 件**

**どう探したか:**

1. `ls internal/` で Go パッケージの母集団 **13 件**を得た〔`aliasindex` `aliasnorm` `api` `config` `infra` `model` `moveindex` `recipehash` `sanumber` `seedgen` `service` `repository` `testutil`〕。
2. このうち「独立モジュール」として設計されたと分かる 5 件（`aliasnorm` / `aliasindex` / `recipehash` / `sanumber` / `moveindex`）について、各パッケージの godoc を読んだ。

| パッケージ | godoc の主題 | ゲーム非依存か |
|---|---|---|
| `aliasnorm` | 「取込ヘルパーの逆引き(表記 → 内部表現)で使う照合用の正規化」 | **否**。SF6 の表記体系に依存 |
| `aliasindex` | 「取込ヘルパーの逆引き(表記 → 内部表現)の索引を構築する」 | **否**。同上 |
| `recipehash` | 「レシピ(ステップ列)から `recipe_hash` を計算する」 | **否**。コンボレシピという本アプリ固有のドメイン概念に依存 |
| `sanumber` | 「`move_code` から SA / CA の番号を機械抽出する規則」 | **否**。**SA / CA は SF6 の用語**であり、`move_code` の構造に依存 |
| `moveindex` | 「クリーンなトークン(正準 command 表記) → キャラ別 `move_code` の索引」 | **否**。同上 |

3. **骨子が層 C の例として挙げた「メモ機能（一人SNS）」を探したが、本リポジトリには存在しない。** メモ機能は Recurfold として独立アプリへ出ており、本体外である。

**⇒ 層 C に該当するソースコードは 0 件である。**

> **★ただし「0 件」と言い切れるのはソースコードについてだけである。** §2.6 で述べたとおり、**`.claude/` `scripts/` `AGENTS.md` 等の開発運用資産はゲーム非依存であり、層 C の定義（ゲーム非依存で、単体で他プロジェクトへ持ち出せるもの）に当てはまりうる。** 骨子が層 C を「メモ機能等のゲーム非依存**部**」とコード前提で書いているため文言上は外れるが、**基準の文言そのものはコードに限定していない。** ⇒ §6 の要判断へ。

### §2.8 層 D（ブランド）の実体 — **ファイルとしては 0 件**

**どう探したか:**

```bash
find . -path ./web/node_modules -prune -o -path ./.git -prune -o -type f \
  \( -iname '*.svg' -o -iname '*.png' -o -iname '*.ico' -o -iname '*.jpg' \
     -o -iname '*.webp' -o -iname '*.gif' \) -print
```

→ **出力 0 行**。`web/public/` に在るのは `.gitkeep` 1 件のみであり、`web/index.html` にも favicon 等のアイコン参照は無い（`<title>CombMgr</title>` のみ）。

**⇒ ロゴ・アイコンの画像ファイルはリポジトリ全域に 1 件も存在しない。**

**★ただし「名称」は別である。**

- 現行の名称 `CombMgr` / `combomgr` は、module path・`web/index.html` の `<title>`・`README` 等に散在する。
- **正式名は `Tacpendium` に決定済みであり**（`D-636`。商標クリアランス 5 点完了）、**リポジトリへの反映は `A5`＝`M28` で行われる。**

**⇒ 層 D は「対象となるファイルは 0 件だが、名称は存在し、商標として別管理される」状態である。** 名称の反映が `M28` で入る際に、層 D の実体（ロゴ画像等）が初めて生じる可能性がある。

### §2.9 利用者生成データ — **ファイル割当表に現れない**

指示書 §2.2-10 の確認。**コンボ・セットプレイ・タグ・プリセットエイリアスの「ユーザーが作った行」は、リポジトリ内のファイルではなく、実行時に生成される SQLite の DB 行である。**

- DB ファイル（`*.db` / `*.db-wal` / `*.db-shm`）は `.gitignore` で除外されており、リポジトリに存在しない（`.gitignore` に「データベースファイル(本番・開発兼用、誤コミット防止)」として明記）。
- **⇒ 上記 §2.1〜§2.8 のどの表にも現れない。これは欠落ではなく、正しい状態である。**
- 骨子 §5 の逐語: **「ユーザーが作ったデータ全般 ｜ 完全にユーザーのもの。アプリは一切の権利を主張しない」**。三層はいずれもこれに及ばない。

> **★リポジトリ内に在る「コンボの行」は 1 種類だけ存在する**——`migrations/000012_seed_combos_durability.up.sql` の耐久テスト用 36 件である。**これは開発者が作った合成データであって利用者生成データではない**（§2.2.1）。混同しないこと。

---

## §3 `AGPL-3.0-or-later` との互換性判定

### §3.1 判定の向き（取り違え防止）

指示書 §2.3-2 の指示どおり、**判定するのは「AGPL-3.0-or-later の配布物へ取り込めるか」という一方向**である。「AGPL が他のライセンスへ取り込めるか」ではない。

`AGPL-3.0-or-later` 側へ取り込めると一般に解されているもの: `MIT` / `BSD-2-Clause` / `BSD-3-Clause` / `ISC` / `0BSD` / `Apache-2.0` / `MPL-2.0` / `LGPL` / `GPL-3.0`。
**詰まるのは限られた組み合わせだけである**（代表例が `GPL-2.0-only`。骨子 §1 も「GPLv2-only は不可」と述べている）。

### §3.2 Go の direct 依存 7 件 — 1 件ずつの判定

| # | モジュール | ライセンス | AGPL-3.0-or-later の配布物へ取り込めるか |
|---|---|---|---|
| 1 | `github.com/BurntSushi/toml` | `MIT` | 取り込めると解される |
| 2 | `github.com/golang-migrate/migrate/v4` | `MIT` | 取り込めると解される |
| 3 | `github.com/labstack/echo/v4` | `MIT` | 取り込めると解される |
| 4 | `github.com/pkg/browser` | `BSD-2-Clause` | 取り込めると解される |
| 5 | `golang.org/x/text` | `BSD-3-Clause` | 取り込めると解される |
| 6 | `gopkg.in/natefinch/lumberjack.v2` | `MIT` | 取り込めると解される |
| 7 | `modernc.org/sqlite` | `BSD-3-Clause` | 取り込めると解される |

**⇒ 7 件中 0 件が非互換。**（母数 7 / 非互換 0）

### §3.3 フロントの direct 依存 45 件 — ライセンス種別ごとの判定

direct 依存に現れたライセンスは **3 種のみ**であった。

| ライセンス | 件数（母数 45 のうち） | AGPL-3.0-or-later の配布物へ取り込めるか |
|---|---|---|
| `MIT` | 40 | 取り込めると解される |
| `Apache-2.0` | 3（`class-variance-authority` / `@playwright/test` / `typescript`） | 取り込めると解される（`AGPLv3` は `Apache-2.0` と一方向互換とされる） |
| `ISC` | 2（`lucide-react` / `qrcode.react`） | 取り込めると解される |

**⇒ 45 件中 0 件が非互換。**（母数 45 / 非互換 0）

### §3.4 推移依存に現れたライセンス（母数 315 パッケージ）

`pnpm licenses list` がツリー全体で観測したライセンスは **9 種**である。

| ライセンス | AGPL 配布物への取り込み | 備考 |
|---|---|---|
| `MIT` / `MIT-0` / `ISC` / `0BSD` / `BSD-2-Clause` / `BSD-3-Clause` / `Apache-2.0` | 取り込めると解される | — |
| `(MIT AND Zlib)` | 取り込めると解される（`pako`） | `Zlib` も寛容型 |
| **`CC-BY-4.0`** | **判定に注意が要る**（`caniuse-lite` 1 件） | 下記 |

**`caniuse-lite`（`CC-BY-4.0`）について。**

- **これはブラウザ対応表のデータであり、`autoprefixer` / `browserslist` 経由の推移的な `devDependency` である。** ビルド時に参照されるだけで、**配布バイナリに同梱されるものではない**と解される。
- **★AGPL 配布物への取り込み可否は、確かめられなかった。** 一次情報（Creative Commons の互換ライセンス宣言）へ**本環境から到達できない**ためである。
- **★当初この欄には「Creative Commons は `CC BY 4.0` から `GPLv3` 系への一方向互換を公表している」と書いたが、撤回した。** Creative Commons が一方向互換を宣言しているのは **`CC BY-SA 4.0` → GPLv3**（ShareAlike Compatible Licenses）であり、**`CC BY 4.0` は ShareAlike 条項を持たないため宣言の対象ではない。** `BY` と `BY-SA` の取り違えであった。**⇒ この主張には走査コマンドも出力も無く、§3.1-4「推測で埋めない」と §3.1-5「実行したコマンドと出力を貼る」の双方に反していた。**
- **⇒ §6 の要判断へ移す。** なお `CC BY 4.0` が**表示のみを求める寛容型でコピーレフト条項を持たない**ことは、ライセンス本文から読み取れる事実である。**しかしそれが AGPL 配布物への取り込みを妨げないことの確認は、一次情報に当たる必要がある。**

### §3.5 `AGPL-3.0-or-later` と `CC-BY-SA-4.0` の同居 — 問うべきは「境界が引けているか」

指示書 §2.3-3 の指示どおり、**「同居してよいか」ではなく「境界が引けているか」を確認した**。

| 境界 | 引けているか | 根拠 |
|---|---|---|
| `migrations/` の層 A / 層 B | **引けている** | §2.2 で全 80 本を 28 / 52 に分割済み。**ただし 3 本（`000039` / `000017` / `000029`）が 1 ファイル内で割れており、SPDX ヘッダを 1 つしか書けない**（§2.2.2） |
| `seedgen` の生成コード / 生成物 | **引けている** | §2.4。`internal/seedgen/` `cmd/seedgen/` が層 A、`character_data/*.csv`（入力）と `migrations/000072` `000073`（出力）が層 B |
| `character_data/` の内部 | **引けている** | §2.3。33 件が層 B、`seed-progress.md` の 1 件のみが層 A |

**⇒ 境界は概ね引ける。残る問題は「1 ファイル内で層が割れる 3 本」だけである。** これは同居の可否の問題ではなく、**ファイル単位でしか SPDX ヘッダを持てないという運用上の制約**であり、§6 の要判断へ回す。

### §3.6 判定できなかったもの

- **既知脆弱性を根拠にした互換性判定は行っていない。** 脆弱性はライセンス互換性と無関係である。
- **`react-router-dom` の GHSA-jjmj-jmhj-qwj2 に修正版が無い件は、ライセンス互換性の問題ではない**（§1.7）。混同しないこと。
- **Go 側の脆弱性は確かめられなかった**（§1.3）。ただしこれも互換性判定には影響しない。

---

## §4 `SUPP-001` §5.7 の射程

### §4.1 同節の文面（`docs/design/supp-001-detailed-design.md:1111` 以降・逐語）

節題:

> `### 5.7 依存ライブラリ追加ポリシー`

禁止リスト（`:1124`）:

> **禁止ライセンス:** GPL-2.0 / GPL-3.0 / LGPL-2.1 / LGPL-3.0 / AGPL-3.0 / CC BY-SA / 独自プロプライエタリライセンス / デュアルライセンス(GPL or 商用)

追加ルール（`:1128` 以降）:

> - 新規依存の追加は**必ず開発者確認**を経る
> - メジャーライブラリ(Echo、TanStack Query、React、等)以外の依存追加は Claude Code が**先に開発者に提案**する
> - 重複機能ライブラリ(lodash代替のramda等)は導入しない
> - 最終更新が2年以上前(2024年以前)のライブラリは原則不使用
> - 依存追加時は `go.mod` / `package.json` への記載と同時に、なぜそのライブラリを選んだかを進捗ログに記録

### §4.2 inbound の規定であることの確認 — **文面からは「文脈上そう読める」までしか言えない**

指示書 §2.4-1 は「同節の**文面で**確認する」ことを求めている。**確認した結果を正確に述べる。**

**inbound と読める根拠（文面上のもの）:**

1. **節題が「依存ライブラリ**追加**ポリシー」である。** 主語は「追加する依存ライブラリ」であって、本体そのものではない。
2. **追加ルール 5 項がすべて「取り込む側」の話である。** 「新規依存の追加は」「依存追加は Claude Code が先に提案」「重複機能ライブラリは導入しない」「最終更新が 2 年以上前のライブラリは原則不使用」「依存追加時は `go.mod` / `package.json` への記載と同時に」——**5 項すべてが依存を取り込む行為を規律しており、本体を配布する行為に触れた文言は 1 つも無い。**
3. **許可リストの表題が「許可ライセンス」で、`MPL-2.0` の備考が「原則不使用、代替がない場合のみ開発者確認の上採用」である。** 「採用」＝取り込む行為である。
4. **`SUPP-001` §5.7 と対をなす outbound の規定は別に存在する**——`DES-001` §5「プロジェクトライセンス方針」（「本プロジェクト自体のライセンスは **MIT License** とする」）。**⇒ 本体のライセンスは §5.7 ではなく `DES-001` §5 が持っている。**

**★しかし、以下は正確に記録しておく必要がある。**

> **同節は「inbound」という語も、それに相当する限定句も、一度も書いていない。** 禁止リストの行は `**禁止ライセンス:** GPL-2.0 / … / AGPL-3.0 / CC BY-SA / …` とだけ書かれており、**文面だけを切り出せば「このプロジェクトでは AGPL-3.0 と CC BY-SA を禁止する」と無限定に読むこともできる。**

**⇒ 射程が明示されていない、というのが文面に即した所見である。** inbound であることは節題と追加ルール 5 項の文脈から導かれるのであって、**明示的に書かれてはいない。**

### §4.3 outbound を AGPL にすることが §5.7 に違反するか — **違反しないと解される**

指示書 §2.4-2 は「違反するなら、どの文面が違反しているかを逐語で示すこと」を求めている。

**逐語で示すべき違反箇所は無い。** §4.2 の根拠 1〜4 のとおり、同節が規律しているのは依存を取り込む行為であり、**本体を `AGPL-3.0-or-later` で配布する行為（outbound）を禁じた文言は同節に存在しない。**

**★ただし §4.2 末尾のとおり、文面は射程を明示していない。⇒ 「違反しない」という結論は、節題と追加ルールの文脈に依拠した解釈である。** 文面だけを無限定に読む立場からは、「AGPL-3.0 を禁止と書いてあるのに本体を AGPL にするのは矛盾である」と読まれうる。**⇒ この読み違いを塞ぐことが `CHANGE-151` の役割になる**（§4.5）。

### §4.4 outbound を AGPL にすると inbound の許容範囲は広がる（事実のみ）

指示書 §2.4-3 の指示どおり、**事実だけを書く。**

- 本体が `AGPL-3.0-or-later` になると、`LGPL` / `MPL-2.0` / `GPL-3.0` は AGPL 側の配布物へ取り込めるため、**技術的には採用可能になる。**
- 現在の禁止リストはこれらを禁じているが、**その禁止は MIT 本体を前提にしたものである。**

**★本報告はポリシーを緩める提案をしない**（指示書 §2.4-3・§4-7）。**`CLAUDE.md` §6 の依存追加ポリシーは不変であり、実際の依存は §3 のとおり全件が寛容型で、緩和を必要とする具体的な事案も生じていない。**

### §4.5 `CHANGE-151` に必要なのは「撤回」か「明確化」か — **明確化であると解される**

指示書 §2.4-4 の判定。**文面に即した結論は「明確化」である。**

| 選択肢 | 文面に照らした評価 |
|---|---|
| **撤回**（禁止リストから `AGPL-3.0` / `CC BY-SA` を消す） | **過剰である。** 禁止リストは inbound の規定として今も有効に機能している。`AGPL-3.0` の依存を取り込むことと、本体を `AGPL-3.0-or-later` で出すことは別の行為であり、前者を許す理由は生じていない |
| **明確化**（inbound と outbound を分けて書く） | **文面の実際の欠落に対応している。** §4.2 で確認したとおり、**同節は射程を一度も明示していない。** 「本節は取り込む依存のライセンスを規律する（inbound）。本体自身のライセンス（outbound）は `DES-001` §5 が定める」の一文を足せば、読み違いの余地が消える |

**⇒ `CHANGE-151` に必要なのは「inbound と outbound を分けて書く明確化」であると解される。**

**★あわせて必要になる改訂が 1 つある。** `DES-001` §5 は「本プロジェクト自体のライセンスは **MIT License** とする（確定。2026-06-28 開発者確定）」と**正典として確定**しており（`CHANGE-053`）、同 §6 の決定記録にも 2 行が対応している。**⇒ 三層へ移すには `DES-001` §5 / §6 の改訂が要る。これは明確化ではなく実質的な変更である。**

> **★製造は `docs/design/` を編集しない**（`CLAUDE.md` §8 / 指示書 §4-4）。上記はすべて設計卓への申し送りである。

---

## §5 設計卓が挙げた数字の数え直し

指示書 §3.1-3 の要求。**3 つとも数え直し、3 つとも合っていた。**

| 設計卓の観測 | 数え直しの実測 | 判定 | 実行したコマンド |
|---|---|---|---|
| トップレベル **27** 件 | **27** 件 | **合っていた** | `ls -A \| grep -v '^\.git$' \| wc -l` |
| `.up.sql` **80** 本 | **80** 本 | **合っていた** | `ls migrations/*.up.sql \| wc -l` |
| うち名に `seed` を持つもの **35** 本 | **35** 本 | **合っていた** | `ls migrations/*.up.sql \| grep -c seed` |

**★ただし 3 つ目については、数が合っていることと判定が正しいことは別である。** 指示書 §2.2-2 が警告したとおり、**「名に `seed` を持つ 35 本」と「層 B の 52 本」は一致しない。**

- 名に `seed` を持つ **35 本**のうち、**4 本は層 A** であった（`000002` / `000005` / `000007` / `000012`。§2.2.1）。
- 逆に、名に `seed` を持たない **45 本**のうち、**21 本が層 B** であった（`000034_backfill_*` / `000063_correct_*` / `000079_fix_character_display_names` 等の backfill・是正系）。
- **⇒ 「名前に `seed` が付く＝層 B」で分けていたら、25 本を取り違えていた**（35 本中 4 本の誤分類 ＋ 45 本中 21 本の見落とし）。

**その他、本報告が実測した母数:**

| 対象 | 実測 | コマンド |
|---|---|---|
| `go.mod` の direct 依存 | **7** 件 | `awk '/^require \(/{f=1;next} /^\)/{f=0} f && !/\/\/ indirect/ && NF' go.mod \| wc -l` |
| `go.mod` の `// indirect` | **15** 件 | `grep -c '// indirect' go.mod` |
| `web/package.json` の `dependencies` | **31** 件 | `jq -r '.dependencies \| length' web/package.json` |
| `web/package.json` の `devDependencies` | **14** 件 | `jq -r '.devDependencies \| length' web/package.json` |
| フロントの推移込み全パッケージ | **315** 件 | `pnpm licenses list --json` の集計 |
| `character_data/*.csv` | **31** 件 | `find character_data -type f -name '*.csv' \| wc -l` |
| `character_data/` の非 CSV | **3** 件 | `find character_data -type f ! -name '*.csv'` |
| マイグレの最大連番 | **000080** | `ls migrations/ \| sed -E 's/_.*//' \| sort -u \| tail -1` |
| 画像・ブランド資産 | **0** 件 | §2.8 の `find` |
| `internal/` の Go パッケージ | **13** 件 | `ls internal/` |
| `scripts/` のエントリ | **30**（`.sh` 28 ／ `.sql` 1 ／ `.md` 1） | `ls scripts/ \| wc -l` ／ `ls scripts/ \| sed -E 's/.*\.//' \| sort \| uniq -c` |

---

## §6 要判断の一覧（開発者へ）

**★本報告は以下を確定しない。** 指示書 §7 が定めた 2 件に加え、調査で見つかった 5 件を挙げる。

| # | 要判断事項 | 本報告の材料 | 出所 |
|---|---|---|---|
| **1** | **三層のパス割当表そのものの承認** | §2.1〜§2.9。トップレベル 27 件・`migrations/` 80 本・`character_data/` 34 件を全数割当済み | 指示書 §3.3 手順 2 |
| **2** | **`docs/` を層 A に入れるか、独立した層にするか、案3 の折衷にするか** | §2.5 に 3 案と長短を提示。★骨子は `docs/` に一言も言及していない | 指示書 §2.2-7 / §7 |
| **3** | **AI 運用ルール群（`CLAUDE.md` / `.claude/` / `AGENTS.md` / `.codex/` / `.agents/` / `human-notes/`）の層** | §2.6。三層の基準に受け皿が無いため「未割当」とした。★**層 C の定義（ゲーム非依存で単体で持ち出せる）に当てはまりうる**——`CLAUDE.md` 自身が `<!-- TEMPLATE NOTE -->` で他プロジェクトへの流用を前提に書かれている | §2.6 / §2.7 |
| **4** | **1 ファイル内で層が割れる 3 本の SPDX ヘッダをどうするか** | §2.2.2。`000039`（DDL 1 行 + SF6 事実 40 行）／ `000017`（層 A 側 4 表を明示 DELETE）／ `000029`（層 A 側 **7 表**を明示 DELETE）。★SPDX ヘッダは 1 ファイルに 1 つしか書けない。本報告の第一候補は 3 本とも層 B | §2.2.2 / §3.5 |
| **5** | **`react-router-dom` の GHSA-jjmj-jmhj-qwj2 に v6 系の修正版が無い件** | §1.7。`Patched versions: <0.0.0`。修正には v7 系への移行が要ると解される。★**ライセンスの問題ではなく脆弱性の問題**であり、`A2` の (c) 列として報告する。本サブでは依存を更新していない（指示書 §4-1） | §1.7 |
| **6** | **checklist `A1` が要求する「AGPL §13 の解釈整理」が骨子に無い** | `combmgr-prerelease-checklist.md` §1.1 の `A1` が「★M22 で LAN 共有が入ったため、AGPL §13 の解釈整理を骨子に 1 節足すこと」と要求しているが、**骨子に該当節が存在しない**（`§13` の言及を `grep` して 0 件）。★**`A1` 承認の前提が 1 つ欠けている**。★製造は `human-notes/` を編集しない | §8-1 |
| **8** | **`caniuse-lite`（`CC-BY-4.0`）を AGPL 配布物へ取り込めるか** | §3.4。**確かめられなかった**（一次情報へ本環境から到達できない）。★推移的な `devDependency` であり配布バイナリには入らないと解されるため、実害の可能性は低いが、**唯一「判定に注意が要る」とマークしたライセンスである** | §3.4 |
| **9** | **`migrations/*.down.sql` 80 本の層をどうするか** | 本サブの対象は指示書 §2.2-2 / §5-4 が定める `.up.sql` 80 本のみであり、`.down.sql` **80 本**は §0.1 のとおり範囲外とした。**★しかし SPDX ヘッダを配置する別サブ（指示書 §3.3 手順 5）は `.down.sql` にも同じ判定を要する。** 対応する `.up.sql` と同じ層を機械的に当てるか、down は全て層 A（構造の巻き戻し）とするかは判断を要する | §0.1 |
| **7** | **Go 側の脆弱性検査が未実施であること** | §1.3。`vuln.go.dev` へ到達できないため `govulncheck ./...` が 403 で失敗する。★**「脆弱性が無い」ではなく「検査していない」**。開発者のローカル実行が要る | §1.3 |

---

## §7 `docs/handover/followup-backlog.md` 本表への登録候補

**★本サブでは `followup-backlog.md` を編集していない**（指示書 §4-5 / `D-382`）。以下は**候補として挙げるだけ**であり、本表への登録は設計卓が畳む。

| 候補スラッグ | 内容 | 備考 |
|---|---|---|
| `react-router-dom-v6-unpatched-advisory` | `react-router-dom` の GHSA-jjmj-jmhj-qwj2 に v6 系の修正版が存在しない（`Patched versions: <0.0.0`）。v7 系への移行が要ると解される | §1.7 / §6-5 |
| `agpl-section13-not-in-strategy-outline` | checklist `A1` が要求する「AGPL §13 の解釈整理」の節が骨子に無い。`A1` 承認の前提が 1 つ欠けている | §6-6 / §8-1 |
| `three-layer-no-slot-for-docs-and-ai-rules` | 三層の基準に `docs/` と AI 運用ルール群の受け皿が無く、トップレベル 27 件中 7 件が未割当のまま残る | §2.5 / §2.6 / §6-2 / §6-3 |
| `spdx-header-cannot-split-within-file` | `migrations/000039` / `000017` / `000029` の 3 本は 1 ファイル内で層が割れるが、SPDX ヘッダは 1 ファイルに 1 つしか書けない | §2.2.2 / §6-4 |
| `down-sql-layer-unassigned` | `migrations/*.down.sql` 80 本の層が未割当のまま。SPDX ヘッダ配置サブが同じ判定を要する | §6-9 |
| `cc-by-4-agpl-compat-unverified` | `caniuse-lite` の `CC-BY-4.0` を AGPL 配布物へ取り込めるかを、一次情報に当たって確認できていない | §3.4 / §6-8 |

**★既存の登録で足りるもの（新規登録は不要）:**

- **Go の脆弱性未検査** → **`cloud-env-cannot-reach-vuln-go-dev`（§J）と `govulncheck-not-installed`（§L・部分解消）が既にこの状態を正確に持っている。** 本サブの実測はその記録を裏づけただけであり、**台帳の更新も新規登録も要らない**（§1.3 の補足）。

---

## §8 想定外の発見・矛盾の事実指摘

### §8-1 checklist `A1` が要求する「AGPL §13 の解釈整理」が骨子に無い

`docs/human-notes/combmgr-prerelease-checklist.md` §1.1 の `A1` 行は、逐語で次を要求している。

> **★M22 で LAN 共有が入ったため、AGPL §13 の解釈整理を骨子に 1 節足すこと**

**しかし骨子（`combmgr-license-strategy-outline.md`）に該当節は存在しない**（`§13` の言及を `grep` して 0 件）。

**★これは `A1`（三層の承認）の前提が 1 つ欠けていることを意味する。** AGPL §13 はネットワーク越しに改変版を提供する場合のソース提供義務を定めた条項であり、**M22 で LAN 共有が入った本アプリには直接効く。** 骨子 §1 は「AGPL が実際に効くのは『改変してデプロイ』した場合」「無改変デプロイでは追加価値ほぼゼロ」と述べているが、**LAN 共有という具体的な形態についての整理はしていない。**

**⇒ 製造は `human-notes/` を編集しない。§6-6 の要判断へ回す。**

### §8-2 骨子と `M26-overview` が `SUPP-001` §5.7 の扱いで食い違っている

| 出所 | 述べていること |
|---|---|
| 骨子 §8「文書影響」 | 「`SUPP-001` §5.7 依存ライセンス方針 ｜ GPL/AGPL/LGPL/CC BY-SA の「禁止」を撤廃し、AGPL 互換性を基準に書き換え。MPL-2.0 の「原則不使用」も見直し。GPLv2-only は禁止のまま」 |
| `M26-overview` §3 | 「**⇒ 必要なのは「撤回」ではなく「inbound と outbound を分けて書く」明確化である。**」「**⇒ §5.7 を緩めるかどうかは別の判断であり、本サブでは「広がった」事実だけを書き、ポリシーは据え置く**」 |

**★これは `CLAUDE.md` §8 の「設計書間の矛盾」には当たらない。** 骨子は `docs/human-notes/` の戦略メモ（自ら「法的助言ではない」「模索段階の到達点」と述べている）であり、設計書ではない。`M26-overview` は v1.1.0 で**開発者承認済み・より新しい**（2026-09-02）。**⇒ 止まらず、`M26-overview` の側を採った**（§4.5 の結論もこれと一致する）。

**★ただし骨子側は未修正のまま残る。** `CHANGE-151` の反映時に骨子 §8 の記述も追随させないと、**後任が骨子だけを読んで「撤廃する方針だった」と読む**可能性がある。§6 の要判断ではなく、設計卓への申し送りとして記録する。

### §8-3 `migrations/000072` のヘッダが「層 A / 層 B」という語を別の意味で既に使っている

`000072_m20_seed_aliases_numeric.up.sql` のヘッダ:

> 層順の原理: command が表記を決める行は層 A、move_code の構造が決める行は層 B。

**これは seedgen の内部概念であり、本報告のライセンス三層とは無関係である。** 同じファイルに SPDX ヘッダ（`CC-BY-SA-4.0` ＝ ライセンス上の層 B）を入れると、**同一ファイル内に「層 B」という語が 2 つの意味で並ぶ。** 実際に本文中には `-- ===== 層 C-1: 移動系 9 code x 19 キャラ =====` という見出しもあり、**「層 C」まで別の意味で使われている。**

**⇒ SPDX ヘッダを配置する別サブ（指示書 §3.3 手順 5）で読み違えを生む可能性がある。** 対処は「SPDX ヘッダ側で `SPDX-License-Identifier:` の形式を使い、地の文の『層』とは書式で区別する」で足りると解されるが、**気づかずに進むと混乱する。**

### §8-4 `go-licenses` が本サブの目的そのものによって失敗する（循環）

§1.1 のとおり、`go-licenses` は**本体リポジトリに `LICENSE` が無いことを失敗理由の 1 つに挙げた**。`LICENSE` を置くのは `CHANGE-151` 反映後（指示書 §4-2）であるから、**本サブの時点では原理的に解けない。**

**⇒ `LICENSE` 配置後（指示書 §3.3 手順 5 の後）に `go-licenses` を再実行すれば、この失敗要因は消える。** ただし**もう 1 つの失敗要因（`go-licenses v1.6.0` が Go 1.26 の標準ライブラリに追随していない）は残る**ため、再実行しても成功するとは限らない。**⇒ 手動法（§1.1）が当面の正本になると解される。**

### §8-5 配布禁止 HTML はリポジトリに入っていない

`M26-overview` §6-6 が実査項目に挙げた「配布禁止 HTML・検証用 CSV の所在」を、本サブの範囲で確認できた分だけ記録する。

- **`work_html/` は `.gitignore` で除外されている**（`.gitignore` に「# html保存」「`work_html/`」として明記）。`migrations/000010` のヘッダが「work_html から抽出」と述べている取得元がこれである。**⇒ 配布禁止 HTML はリポジトリに存在しない。**
- `find` で見つかった `.html` は、`web/index.html`（アプリの入口）／ `docs/usermanual/combmgr-friend-readme.html`（配布版マニュアル）／ `docs/progress/M24-*-mock/*.html`（モック 8 本）／ `docs/handover/codex-sandbox-rebuild-checklist.html` ／ `docs/process/parallel-ops.html` ／ `docs/human-notes/` 配下の学習資料と評価レポートであり、**いずれもカプコン由来の配布禁止物ではない。**
- **★これは `A3`（配布物のデータ来歴の切り分け）の一部であり、本サブの完了条件ではない。** `M26-03` での再点検を前提に、事実だけを記録する。

### §8-6 `README.txt` は配布物そのものである

トップレベルに `README.md`（199 行・開発者向け）と `README.txt`（123 行）が並んでいる。**`README.txt` は冒頭に「配布版 README」と明記されており、単一バイナリと一緒に配られる。**

**⇒ 層 A の中でも「実際に配布物へ入るファイル」であり、`LICENSE` / `NOTICE` の同梱先を決める際の起点になる。** 骨子 §1 が「リリースタグと版を対応づけ、『本バイナリのソースは tag vX.Y.Z』と NOTICE / README に明記する運用で満たす」と述べている「README」は、**`README.md` ではなく `README.txt` を指すと解される。**

---

## §9 変更範囲（実装への差分が空であることの立証）

指示書 §5-6「実装への差分が空である」の確認。着手基点は `e1cd553cbb0940e1bc20f31c69ae9e7283a2a130`。

```
$ git diff --stat e1cd553
 docs/progress/M26-01-report.md | 907 +++++++++++++++++++++++++++++++++++++++++
 docs/progress/m26-01-review.md | 287 +++++++++++++
 docs/progress/progress-log.md  |  20 +
 3 files changed, 1214 insertions(+)
```

> **★`M26-01-report.md` と `m26-01-review.md` は新規であり `+` のみ。**
> **`progress-log.md` の `+` は末尾への索引行の追記であり、`deletions` は 0 である**（既存の過去節は編集していない）。

**確認の観点**（教訓 `E-225`）:

- **新規作成したファイルに `deletions` が付いていないこと。** 本サブの成果物 `docs/progress/M26-01-report.md` は新規であり、`+` のみである。
- **`migrations/` / `internal/` / `web/` / `cmd/` / `character_data/` / `docs/design/` は 1 バイトも変更していない。**
- `LICENSE` / `LICENSES/` は作成していない（指示書 §4-2）。SPDX ヘッダも挿入していない（§4-3）。
- `docs/handover/followup-backlog.md` は編集していない（§4-5。§7 に候補として挙げるにとどめた）。
- `.claude/commands/` は編集していない（§4-8）。
- **新しいツールは導入していない**（§4-6）。`go-licenses` の失敗後に使ったのは、指示書 §2.1 が明示したフォールバック（`go mod download` ＋ モジュールキャッシュの `LICENSE` 読取）と、`pnpm` 自身のサブコマンド（`pnpm view`）だけである。

> **★`pnpm view` について。** 最終更新（年月）列を埋めるために使った。**`pnpm` は既に本プロジェクトの正規のパッケージマネージャであり**（`CLAUDE.md` §11）、`pnpm view` はその組み込みサブコマンドである。**新しい依存もバイナリも追加していない。** 指示書 §2.1 の表が挙げた `pnpm licenses list` と同じ性質のものと解して使用した。

---

## ■ 併せて更新が要るもの

| 対象 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** 本サブでは `CHANGE-151` を起票しない（指示書 §3.3）。⇒ `docs/handover/change-number-registry.md` §1 への登録も不要。**★「次に採番するのは `151`」の記載を動かしていない** |
| **その番号の写し先（4 か所）** | **該当なし。** 番号を消費していないため、registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 のいずれも変更不要 |
| **消費したマイグレ連番** | **なし。** `ls migrations/` の実査で最大は `000080`。**次に払い出す番号は `000081` のままであり、ボード §2.2 の記載と一致する** |
| **版を上げた文書の参照元** | **該当なし。** 本サブは設計書を編集しないため、版数を写している箇所の追随も不要 |
| **`docs/` への新設ファイル** | `docs/progress/M26-01-report.md` の 1 本。**`check-doc-inventory.sh` の許容型 `docs/progress :: ^M[0-9]+-[0-9]+-report\.md$` に合致**しており、`§10.Y` の「型に無い恒久ファイルの新設」には当たらない |
| **設計卓への申し送り** | §4.5（`DES-001` §5 / §6 の改訂が要ること）／ §8-2（骨子 §8 の記述を `CHANGE-151` 反映時に追随させること）／ §7（followup 本表への登録候補 4 件） |

---

## §10 レビューと取り込み

**レビュー報告書**: `docs/progress/m26-01-review.md`

指示書ヘッダは「レビュー: 不要（実装差分が 0 のため）」と定めているが、**開発者の判断で「事実性に絞ったレビュー」を実施した**（成果物が不可逆な法務の前提を作るため）。レビュアーはメイン会話の文脈を継承しない fresh subagent である。

| 項目 | 実測 |
|---|---|
| 指摘件数 | **14 件**（高 **3** ／ 中 **5** ／ 低 **6**） |
| 採用 | **14 件**（全件） |
| 不採用 | **0 件** |
| **「高」指摘の不採用** | **0 件** |
| 再レビュー往復 | **0 回**（初回のみ。上限 2 回に対して未使用） |

**「高」3 件の内容と対応:**

| # | 指摘 | 対応 |
|---|---|---|
| 高-1 | **§2.2.2 の「層が割れるファイル」に 3 本目 `000029_clear_ryu_legacy_seed.up.sql` が抜けている**（層 A 側 **7 表**を明示 DELETE しており、`000017` の 4 表より範囲が広い） | 採用。§2.2.2 を 2 本 → **3 本**へ。波及先の §3.5 ／ §6-4 ／ §7 も同時に是正 |
| 高-2 | **§3.4 の `CC BY 4.0` → GPLv3 互換の「公表しており」が未検証かつ誤り**（CC が一方向互換を宣言しているのは `CC BY-SA 4.0`。`BY` と `BY-SA` の取り違え） | 採用。**断定を撤回し「確かめられなかった」へ書き換え**、§6-8 の要判断へ移した |
| 高-3 | **`000017` の根拠「FK 連鎖で触れる」は因果が逆**（原文は「FK=OFF ゆえ CASCADE は発火しない。だから子行を明示 DELETE する」） | 採用。表の根拠欄と §2.2.2 を「FK=OFF のため CASCADE に頼れず明示 DELETE している」へ訂正 |

**「中」5 件**: §9 の `git diff --stat` が実測とずれていた（貼り替え）／ `scripts/` の「30 本のシェルスクリプト」が不正確（`.sh` 28 ／ `.sql` 1 ／ `.md` 1 へ）／ 2 年基準の照合が Go の direct 依存に及んでいなかった（母数を **52** へ、該当を **6 件**へ）／ `*.down.sql` **80 本**の層が下流へ申し送られていなかった（§6-9 と §7 へ追加）／ progress-log の索引行が未追記（**Phase D で実施**）。

**「低」6 件**: `000039` の `ALTER` 行番号（1 → 13）／ `web/public/` は空ではなく `.gitkeep` が 1 件／ `internal/seedgen/` の列挙が `model.go` を落としていた／ §8-5 の HTML 列挙が 2 本漏れ／ 2 年基準の閾値の読みを明示／ notices 母数の非対称（Go は direct 7 も対象で計 **22**）。

**⇒ 「高」指摘の不採用は 0 件であるため、Phase C の安全弁（重大指摘の自動棄却時のエスカレーション）は作動していない。**

> **★本節は Phase C の後に書いた**（`D-510` / `M23-04` の先例）。**レビュー実施前に「不採用 0 件」を断定したり、存在しない報告書へリンクを張ったりしていない。**

---

## §11 制約事項

- **本報告は法的助言ではない。** 一次源である骨子が自らそう述べており、本報告も同じ制約を負う（指示書 §3.1-6）。
- **本報告はコード上・ファイル上で判定できる範囲のみを対象とする。** 実際の権利関係の評価、商標の有効性、各ライセンスの解釈の当否は対象外である。
- **Go 側の既知脆弱性は検査できていない**（§1.3）。「脆弱性が無い」とは書いていない。「検査していない」である。
- **Dependabot alerts の有効・無効は確かめられなかった**（§1.8）。
- **層の割当は指示書 §2.2 の基準のみを用いた。** 基準に受け皿が無いものは「未割当」とし、推測で層へ入れていない（指示書 §0.2）。

---

*以上*
