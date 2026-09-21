# M24-09a 完了報告 — CI の新設（PR＝高速検査 ／ nightly＝3 OS クロスビルド）と依存の棚卸し

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M24-09a-ci-distribution-and-dependency-audit.md` v1.0.0 |
| 実施日 | 2026-08-20 |
| ブランチ | `claude/m24-09a-implementation-qxi5xl` |
| base commit | `3aaf3e5` |
| 消費 CHANGE | **`CHANGE-129`**（設計卓が 2026-08-20 に起票済み。§10 参照） |
| 消費マイグレ連番 | **0 本**（`migrations/` の diff 0。disk 末尾は `000077` のまま） |
| スキーマ変更 | **なし** |
| 依存の増減 | **0 件**（`go.mod` / `package.json` / ロックファイルの diff 0） |
| 画面の変更 | **なし**（本サブは画面に触れない） |

---

## 1. 結論（先に）

- **PR 高速検査と nightly クロスビルドの 2 本を新設した。** 本番コード・テスト資産の diff は **0 バイト**。
- **★両ワークフローは、まだ 1 度も実行されていない。** 製造セッションから GitHub Actions を起動できず、
  実行結果も取得できなかった。**⇒ §5 のテスト要件 1 / 2 / 4 は未達のまま残る**（§8 の DoD 参照）。
  この形は **2026-08-20 の Plan Mode ゲートで開発者が「案 B」として確定した**ものである（§2）。
- **依存の棚卸しは完了した。禁止ライセンスは 0 件**、`CLAUDE.md` §6 の「最終更新 2 年以上前」該当が 5 件。
  **★あわせて followup `M14-i`（MPL 依存の非リンク確認）を実測で解消した**（§6.3）。
- **FW・AV 既知制約の記載は実在した。** `followup-backlog` §F の「README/log 記載済」は**真**であり、
  指示書 §4.5 の分岐に従い **書き直していない**（§7.1）。

---

## 2. Plan Mode の確定方式（開発者回答 3 件・2026-08-20）

| # | 論点 | 確定 |
|---|---|---|
| **A** | CI を実行できないままワークフローを書くか | **案 B**＝製造が書き、**実行と緑の確認は開発者の手番**。初回の緑が記録されるまで「未検証」マーカーを置く |
| **B** | private の Actions 分数と nightly 構成 | **ubuntu 1 台でクロスビルド**（`make build-all` ／ `CGO_ENABLED=0`）。分数は 1 倍 |
| **C** | 必須 check の範囲 ／ 5 分目標 | **PR の高速検査のみ必須**（nightly は通知扱い）／ **受入は 10 分以内のみ。5 分は目標から外す** |

**★A の背景（指示書 §2.3 / §9.1-3 との関係）**
指示書は「CI が実行できない場合はワークフローを**書かずに**停止して報告する」と定め、理由を
「**動いていないワークフローは、次の担当に『CI は在る』と誤読される**」としている。
本サブが直面したのは「repo で Actions が使えない」ではなく「**製造セッションからは起動も結果取得もできない**」
という別の事情であり、指示書 §11-1 の暫定案が「Plan Mode で製造に確認させる」としていたとおり、
Plan Mode で開発者へ提示して案 B が選ばれた。
**誤読対策は 3 重**にしてある —— (1) 両ワークフロー冒頭の `★★ 未検証 ★★` ブロック、
(2) README「CI」節の注意書きと「初回の受入確認」手順、(3) 本報告 §8 の DoD で未達を明示。

---

## 3. §3.3 着手前の実査 8 件

### 3.3-1 `.github/workflows/` の在否
**存在しなかった。** `.github/` ディレクトリ自体が無い。`runs-on` / `actions/checkout` / `workflow_dispatch`
でリポジトリ全体を走査したヒットは指示書本体のみ。**⇒ 置き換えではなく新規 2 本を足した。**

### 3.3-2 リポジトリの可視性と Actions の可用性

| 実査 | 結果 |
|---|---|
| 可視性 | **private**（`GET api.github.com/repos/plexiblinp/combomgr` → `"private": true` / `"visibility": "private"`）。owner は個人 User アカウント、既定ブランチ `main` |
| Actions API | **エージェントプロキシが遮断。** `GET /actions/permissions` → **HTTP 403** `"Access to this GitHub Actions path is not permitted through this proxy."` |
| GitHub MCP | **プロジェクトが deny**（`.claude/settings.json` の `mcp__*` 一括 deny） |
| `gh` / `hub` CLI | **未インストール** |

**⇒ 起動（`workflow_dispatch`）も、実行結果・job summary・artifact の取得もできない。**
Actions が repo で有効かどうかすら 403 で読めない。

### 3.3-3 `go test -count=1` の手元実測 — **★本サブの中核証拠**

実行環境: **4 コア** / 15.9 GB RAM / Go 1.26.4 / Linux。

| # | コマンド | 状態 | 所要 | exit | `(cached)` |
|---|---|---|---|---|---|
| A | `go test -count=1 ./...` | GOCACHE 冷（`go clean -cache` 直後） | **194.4 s** | 0 | 0 |
| B | `go test ./...`（`-count=1` **無**） | 結果キャッシュ未投入 | 143.3 s | 0 | 0 |
| C | `go test -count=1 ./...` | GOCACHE 温 | **142.2 s** | 0 | 0 |
| D | `go test ./...`（`-count=1` **無**） | **B が結果キャッシュを投入した直後** | **0.385 s** | **0** | **53 / 53** |

**★D が「実行せず緑」の実証である。** `-count=1` を落とすと **0.385 秒・全 53 パッケージ `(cached)`・exit 0**。
C との差は **369 倍**で、**exit code は両方 0＝終了コードでは区別できない**。
ベースライン計測 §1.1 が 46/46 cached で無効になったのと同じ現象を、現在のコードベースで再現した。

**ベースラインとの環境差**

| 指標 | ベースライン（24 コア） | 本環境（4 コア） | 差 |
|---|---|---|---|
| `go test -count=1`（温） | 130.2 s | **142.2 s** | +9% |
| `go test -count=1`（冷 GOCACHE） | 143.2 s | **194.4 s** | 冷温差が 13 s → **52.2 s** へ拡大 |
| 2 コア相当 | 245.6 s | —（本環境は 4 コア） | 本環境は 2 コア相当より速い |
| パッケージ数 | 46 | **62**（テスト有 53 ＋ `no test files` 9） | **+16。ベースライン以降に増えている** |

### 3.3-4 `pnpm install` の所要 — **★測れた**（ベースライン §5 未決 3 への回答）

ベースライン時は `web/node_modules` が既存のため測れなかった。本サブでは
**scratchpad へ `package.json` と `pnpm-lock.yaml` だけを複製し、専用 store を切って計測**した
（既存の `node_modules` とロックファイルには一切触れていない）。

| 条件 | 所要 | pnpm 自身の報告 |
|---|---|---|
| **cold**（空 store ＋ 空 `node_modules`） | **5.51 s** | 4.1 s |
| **warm**（store 温 ＋ `node_modules` 削除後） | **1.48 s** | 1.1 s |

`node_modules` 223 MB / store 218 MB / pnpm 9.13.0（`packageManager` フィールドから解決）。

> **★この数値の限界を明記する。** (1) `--ignore-scripts` を付けて計測した（postinstall の
> ブラウザ取得が環境依存で失敗し、数値を歪めるため）。**CI で `--ignore-scripts` を付けなければ差が出る。**
> (2) 本環境の外向き通信はエージェントプロキシ経由であり、GitHub ホストランナーの回線とは違う。
> **⇒ CI の実測値は初回実行の job summary で置き換えること**（ワークフローは `PNPM_INSTALL_SEC` を
> job summary へ出すようにしてある）。

### 3.3-5 依存の一覧とライセンス
**→ §6 に独立して記載。**

### 3.3-6 FW・AV 既知制約の記載
**→ §7.1 に独立して記載。**

### 3.3-7 `web/e2e/` と Go テストの read-only
**遵守した。** 両者の diff は 0 バイト（§9-4）。`M23-01` との交差確認は §11。

### 3.3-8 `CO` ledger との突合
**→ §12 に独立して記載。**

---

## 4. 作成・変更したファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `.github/workflows/pr-checks.yml` | **新規** | PR 高速検査。3 job 並列 |
| `.github/workflows/nightly-crossbuild.yml` | **新規** | nightly 3 OS クロスビルド |
| `README.md` | 変更（純粋な挿入。既存記述の書き換え・削除は 0） | 「CI」節を追加 |
| `docs/progress/m24-09a-completion-report.md` | **新規** | 本書 |
| `docs/progress/m24-09a-review.md` | **新規** | レビュー報告書（末尾に自動トリアージの採否記録） |
| `docs/handover/design-reports/20260820-m24-09a-design-exceptions.md` | **新規** | 設計伝達レポート |
| `docs/progress/progress-log.md` | 追記 | 索引行（`CLAUDE.md` §8） |

> **★訂正（レビュー指摘 高-1 / 高-2 により）。** 初版の本表は、`progress-log.md` の追記と
> 設計伝達レポートを**まだ作っていない段階で「追記」「新規」と書いていた**。
> 未検証マーカーを 3 重に張ってまで「在ると誤読させない」ことに神経を使った回で、
> 完了報告自身が未作成のものを作成済みと書いていたのは、その努力を自分で崩している。
> **両方とも本トリアージの中で実際に作成し、本表はその後の実態を書いている。**

**★§2.1 に無いファイルへは手を入れていない。** `docs/` へ新しい**恒久**ファイルは作っていない
（完了報告・設計伝達レポートは既存運用の型）。

### 4.1 PR ワークフローの設計判断

| # | 事項 | 実装 |
|---|---|---|
| 1 | 起動条件 | `pull_request` ／ `push` to `main` ／ **`workflow_dispatch`（推測で追加）** |
| 2 | job 分割 | **`go-vet-build` / `go-test` / `web-test` の 3 本を並列**（ベースライン A0-2） |
| 3 | **`-count=1`** | **付けた。** 外してはならない理由を実測値つきでファイル内に書いた |
| 4 | フロント | `pnpm install --frozen-lockfile` → `pnpm test -- --run`。**`npm` / `yarn` / `npx` は不使用** |
| 5 | ビルドキャッシュ | `actions/cache@v4` でリストア。**`setup-go` 内蔵キャッシュは `cache: false` で切った**（hit/miss を自分で読んで job summary へ出すため）。**cache は高速化であって正しさの根拠にしない**旨をコメントに明記。**保存は `go-test` job だけが行い、`go-vet-build` は `actions/cache/restore` の restore 専用**（同一 key で 2 job が保存すると片方がスキップされる＝レビュー 中-8）。**hit 表示は `cache-matched-key` を併記した 3 値**（完全一致／部分一致／miss。`cache-hit` は key 完全一致でしか true にならず、2 値だと部分ヒットを miss と誤表示する＝レビュー 中-4） |
| 6 | 目標 | **10 分以内のみ。5 分は置いていない** |
| 7 | E2E | **載せていない** |
| 8 | クロスビルド | **載せていない** |
| 9 | 実測の記録 | job summary に **所要秒・ランナー実コア数・cache 状態・`pnpm install` 秒**に加え、**テスト件数**を出す（`go test` は ok／FAIL／no test files／**(cached)** のパッケージ数、Vitest は `Test Files` / `Tests` の行）。**件数を出すのは `E-125`（件数の無い報告は 1 件も走っていない可能性を排除できない）に対する直接の手当てであり、所要秒を人が見ることに依存させないため**＝レビュー 中-6 |
| 10 | 分数の保護 | 全 job に **`timeout-minutes: 20`**（既定 360 分。private リポジトリでハングすると 6 時間分溶ける＝レビュー 中-2）。`concurrency` で同一 ref の古い実行を打ち切る |
| 11 | `paths` フィルタ | **入れない判断をした**（レビュー 中-3）。docs のみの PR でも全 job が回るが、**フィルタで skip した job は必須 check として「pending のまま」になり PR がマージできなくなる**。受け皿 job を作る形は必須 check を登録してから決める。**判断と理由は README にも残した** |

**★`make test-go` を呼ばずに `go test -count=1 ./...` を直接叩いている。**
Makefile の `test-go`（`Makefile:63`）は `-count=1` を欠くため、経由すると罠を踏む（§7.3）。

**推測で決めた箇所**（すべてファイル内に `# 推測: 〜と仮定した` で明示）
- 既定ブランチ名 `main`（実査で確認済み）／ `workflow_dispatch` の追加（開発者が PR を開かずに
  初回の緑を確認できるようにするため）／ `concurrency` による古い実行の打ち切り（分数節約）／
  キャッシュキーを `go.sum` のハッシュで作る ／ Node 22。

### 4.2 nightly ワークフローの設計判断

- **ubuntu-latest 1 台で `make build-all`。** `modernc.org/sqlite` が純 Go で CGO 不要のため、
  `GOOS=windows/darwin/linux` のクロスコンパイルがホスト OS を問わず成立する。
  **⇒ macOS（10 倍）・Windows（2 倍）ランナーを使わずに 3 OS 分が出る。**
- **ビルドフラグの正本は Makefile 側に一本化した。** ワークフローへ `go build` を書き写すと必ずずれる。
- **既知の非効率（許容）**: `build-all` は 3 ターゲットを順に呼び、各々が `pnpm build` を行うため
  **フロントを 3 回ビルドする**。nightly は 1 日 1 回であり実害が小さいため、Makefile 側の最適化は
  行っていない（Makefile は指示書 §2.1 の対象外）。
- **`Verify artifacts` step で 3 点の実在を検査し、1 つでも欠けたら赤にする。**
  `file(1)` の出力を job summary に残すため、**「3 OS 分が本当に出たか」が終了コード以外で分かる。**
- **Releases への添付は作っていない。** artifact まで（保存 14 日・推測）。
- **CGO 有効化・`mattn/go-sqlite3` フォールバックは導入していない。**
- **`timeout-minutes: 30`**（ローカル実測 127 秒に対し十分な余裕。private の分数を守る＝レビュー 中-2）。
- **`schedule` は 60 日間リポジトリが非アクティブだと GitHub が自動で無効化する**旨をコメントに残した
  （個人 OSS では長期の中断がありうる＝レビュー 低-3）。
- **★artifact は `DES-002` §11.2 の配布物そのものではない**旨を `Verify artifacts` のコメントに明記した
  （§9-6 ／ レビュー 高-3）。

---

## 5. テスト結果（§7.2 自己テスト）

### 5-1 `go test -count=1 ./...`

```
ok パッケージ数 : 53
no test files   :  9
FAIL            :  0
所要            : 142.2 秒（exit 0）
```

所要上位 8 パッケージ:

| 所要 | パッケージ |
|---|---|
| 81.235s | `internal/service/combo` |
| 53.140s | `internal/infra/migration` |
| 39.852s | `internal/repository/combo` |
| 29.205s | `internal/service/preset` |
| 22.943s | `internal/service/notation` |
| 21.407s | `internal/service/setup` |
| 19.418s | `internal/repository/setup` |
| 19.121s | `internal/api/auth` |

**赤は 0 件**（指示書 §9.1-2 の「赤は直さず報告する」に該当する事象は発生しなかった）。

### 5-2 `cd web && pnpm test -- --run`（Vitest）

```
Test Files  170 passed (170)
     Tests  1674 passed (1674)
  Duration  64.93s
```

> **★ベースラインの `make test-web` 13.2 秒（24 コア）に対し、本環境（4 コア）は 64.9 秒。**
> Vitest はコア数の影響が Go テストより大きい。CI ランナーの実測は初回実行の job summary で確定する。

### 5-3 `make e2e`
**★実行していない。** 本サブは E2E に触れないため（指示書 §7.2）。**「緑」ではない —— 実行していない。**

### 5-4 `make build-all`（nightly の中核コマンドのローカル検証）

ワークフロー自体は動かせないが、**nightly が呼ぶコマンドは手元で動かして確かめた。**

```
make build-all  exit=0  elapsed=127s

dist/combomgr-windows-amd64.exe  22,077,440 B  -> PE32+ executable (console) x86-64, for MS Windows
dist/combomgr-darwin-arm64       21,214,194 B  -> Mach-O 64-bit arm64 executable
dist/combomgr-linux-amd64        21,722,556 B  -> ELF 64-bit LSB executable, x86-64, statically linked
```

**3 点とも意図したターゲット形式で出ている**（`file(1)` の出力）。`dist/` は `.gitignore` 対象のため
リポジトリには残らない。

### 5-5 `git diff --stat`

**本サブ全体（`3aaf3e5..HEAD`。レビュー取り込み後の最終形）**

```
 .github/workflows/nightly-crossbuild.yml           | 143 +++++
 .github/workflows/pr-checks.yml                    | 259 +++++++++
 README.md                                          | 130 +++++
 .../20260820-m24-09a-design-exceptions.md          | 307 ++++++++++
 docs/progress/m24-09a-completion-report.md         | 646 +++++++++++++++++++++
 docs/progress/m24-09a-review.md                    | 336 +++++++++++
 docs/progress/progress-log.md                      |  16 +
 7 files changed, 1837 insertions(+)
```

**削除 0 行。** 内訳は CI 定義 2 本 ＋ README の CI 節 ＋ 報告 3 本 ＋ `progress-log` の索引行のみ。

> 参考: 実装コミット（`8ec452b`）時点は 3 ファイル・423 行だった。レビュー取り込みで
> ワークフローと README が増え、報告 3 本が加わっている。

**本番コード・テスト資産の diff は 0 バイト。** 次の範囲を明示的に確認した（出力は空）:
`internal/` `web/src/` `cmd/` `migrations/` `web/e2e/` `web/playwright.config.ts`
`go.mod` `go.sum` `web/package.json` `web/pnpm-lock.yaml`

---

## 6. 依存ライブラリの棚卸し（§4.4）

**★増減は 0 件。`indirect` → `direct` の昇格も行っていない**（`CLAUDE.md` §6・2026-08-14 裁定）。
ライセンスは **モジュールキャッシュ / `node_modules` の LICENSE 実ファイルを読んで判定**した。推測はしていない。

### 6.1 Go 直接依存（7 件）

| モジュール | 版 | ライセンス | §6 区分 | 最終更新 | 2 年以上前 |
|---|---|---|---|---|---|
| `github.com/BurntSushi/toml` | v1.6.0 | MIT | 許可 | 2025-12-18 | — |
| `github.com/golang-migrate/migrate/v4` | v4.19.1 | MIT | 許可 | 2025-11-29 | — |
| `github.com/labstack/echo/v4` | v4.15.1 | MIT | 許可 | 2026-02-22 | — |
| `github.com/pkg/browser` | v0.0.0-20240102092130 | BSD-2-Clause | 許可 | 2024-01-02 | **★該当（2 年 7 か月）** |
| `golang.org/x/text` | v0.32.0 | BSD-3-Clause | 許可 | 2025-12-08 | — |
| `gopkg.in/natefinch/lumberjack.v2` | v2.2.1 | MIT | 許可 | 2023-02-06 | **★該当（3 年 6 か月）** |
| `modernc.org/sqlite` | v1.50.0 | BSD-3-Clause | 許可 | 2026-04-24 | — |

最終更新は `proxy.golang.org` の `@v/<version>.info` の `Time`。上記 2 件は
**`@latest` も同じ版**であり、ピン留めが古いのではなく**上流自体が動いていない**。

### 6.2 ★配布バイナリに実際にリンクされる 21 モジュール

`go list -deps ./cmd/combomgr` で得た**実際の依存**（`-tags=embed_web` でも同じ）。
**配布物のライセンス面はこれが正である。**

| ライセンス | 件数 | モジュール |
|---|---|---|
| MIT | 9 | `BurntSushi/toml` ／ `golang-migrate/migrate/v4` ／ `labstack/echo/v4` ／ `labstack/gommon` ／ `mattn/go-colorable` ／ `mattn/go-isatty` ／ `valyala/bytebufferpool` ／ `valyala/fasttemplate` ／ `gopkg.in/natefinch/lumberjack.v2` |
| BSD-2-Clause | 2 | `dustin/go-humanize` ／ `pkg/browser` |
| BSD-3-Clause | 10 | `google/uuid` ／ `remyoudompheng/bigfft` ／ `golang.org/x/crypto` ／ `golang.org/x/net` ／ `golang.org/x/sys` ／ `golang.org/x/text` ／ `modernc.org/libc` ／ `modernc.org/mathutil` ／ `modernc.org/memory` ／ `modernc.org/sqlite` |

**⇒ 禁止ライセンス（GPL / LGPL / AGPL / CC BY-SA）0 件。条件付き（MPL-2.0）0 件。**

### 6.3 ★followup `M14-i`（MPL 依存の非リンク確認）を解消した

`followup-backlog` §C の `M14-i` は
「MPL 依存 `github.com/hashicorp/golang-lru/v2` の非リンク確認（`go mod why`）。
require 非掲載・直接 import 0 だが**最終バイナリリンク有無未確認**」として未着手だった。

**実測**
- `go.sum` に v2.0.7 が居るが **`go.mod` の require には無い**（`grep -c hashicorp go.mod` = 0）。
- **`go list -deps ./cmd/combomgr` に 0 件**（`-tags=embed_web` でも 0 件）。
- `go mod why -m` の経路は `internal/infra/db` → `modernc.org/sqlite` → `modernc.org/libc`
  → **`modernc.org/libc.test`** → `modernc.org/ccgo/v4/lib` → 当該モジュール。
  **`.test` を経由する＝`libc` 自身のテストバイナリ専用**であり、本アプリの最終バイナリには入らない。

**⇒ MPL-2.0 のコードは配布物に含まれない。** 判定に必要な確認は完了した。
（**followup の状態更新は設計卓の手番**。設計伝達レポート §4 へ候補として出す＝**D-382**）

### 6.4 npm の宣言依存（**45 件**：`dependencies` 31 ／ `devDependencies` 14）

`node_modules/<pkg>/package.json` の `license` 実値。**指示書 §4.4-1 の「1 件ずつ表にする」に従う。**

集計: **MIT 40 ／ Apache-2.0 3 ／ ISC 2 ＝ 45。禁止ライセンス 0 件・条件付き（MPL-2.0）0 件。**

| # | パッケージ | 版 | 区分 | ライセンス |
|---|---|---|---|---|
| 1 | `@hookform/resolvers` | 5.4.0 | dep | MIT |
| 2 | `@radix-ui/react-accordion` | 1.2.12 | dep | MIT |
| 3 | `@radix-ui/react-alert-dialog` | 1.1.15 | dep | MIT |
| 4 | `@radix-ui/react-checkbox` | 1.3.3 | dep | MIT |
| 5 | `@radix-ui/react-dialog` | 1.1.15 | dep | MIT |
| 6 | `@radix-ui/react-dropdown-menu` | 2.1.16 | dep | MIT |
| 7 | `@radix-ui/react-label` | 2.1.8 | dep | MIT |
| 8 | `@radix-ui/react-popover` | 1.1.15 | dep | MIT |
| 9 | `@radix-ui/react-radio-group` | 1.3.8 | dep | MIT |
| 10 | `@radix-ui/react-select` | 2.2.6 | dep | MIT |
| 11 | `@radix-ui/react-slot` | 1.2.4 | dep | MIT |
| 12 | `@radix-ui/react-switch` | 1.2.6 | dep | MIT |
| 13 | `@radix-ui/react-tabs` | 1.1.13 | dep | MIT |
| 14 | `@radix-ui/react-tooltip` | 1.2.8 | dep | MIT |
| 15 | `@tanstack/react-query` | 5.100.6 | dep | MIT |
| 16 | `class-variance-authority` | 0.7.1 | dep | Apache-2.0 |
| 17 | `clsx` | 2.1.1 | dep | MIT |
| 18 | `html-to-image` | 1.11.13 | dep | MIT |
| 19 | `i18next` | 23.16.8 | dep | MIT |
| 20 | `lucide-react` | 0.460.0 | dep | ISC |
| 21 | `pdf-lib` | 1.17.1 | dep | MIT |
| 22 | `qrcode.react` | 4.2.0 | dep | ISC |
| 23 | `react` | 18.3.1 | dep | MIT |
| 24 | `react-dom` | 18.3.1 | dep | MIT |
| 25 | `react-hook-form` | 7.76.1 | dep | MIT |
| 26 | `react-i18next` | 15.7.4 | dep | MIT |
| 27 | `react-router-dom` | 6.30.4 | dep | MIT |
| 28 | `sonner` | 2.0.7 | dep | MIT |
| 29 | `tailwind-merge` | 3.6.0 | dep | MIT |
| 30 | `tailwindcss-animate` | 1.0.7 | dep | MIT |
| 31 | `zod` | 3.25.76 | dep | MIT |
| 32 | `@playwright/test` | 1.60.0 | dev | Apache-2.0 |
| 33 | `@testing-library/react` | 16.3.2 | dev | MIT |
| 34 | `@testing-library/user-event` | 14.6.1 | dev | MIT |
| 35 | `@types/node` | 20.19.39 | dev | MIT |
| 36 | `@types/react` | 18.3.28 | dev | MIT |
| 37 | `@types/react-dom` | 18.3.7 | dev | MIT |
| 38 | `@vitejs/plugin-react` | 4.7.0 | dev | MIT |
| 39 | `autoprefixer` | 10.5.0 | dev | MIT |
| 40 | `jsdom` | 25.0.1 | dev | MIT |
| 41 | `postcss` | 8.5.12 | dev | MIT |
| 42 | `tailwindcss` | 3.4.19 | dev | MIT |
| 43 | `typescript` | 5.9.3 | dev | Apache-2.0 |
| 44 | `vite` | 6.4.3 | dev | MIT |
| 45 | `vitest` | 3.2.6 | dev | MIT |

> **★訂正（レビュー指摘 中-1 により）。** 初版は「46 件（`dependencies` 31 ／ `devDependencies` 15）／
> MIT 41」と書いていたが、**`web/package.json` を直接数え直した実測は 45 件（31 ／ 14）／ MIT 40** である。
> 初版の値は集計の誤りだった。

### 6.5 npm の推移依存（**207 件**）— 母集団を宣言依存に限らずに見た

`go list -deps` で Go 側を「配布物に実際に入るもの」まで降ろした以上、npm 側も同じ基準で見る必要がある
（フロントのバンドルは `-tags=embed_web` でバイナリに同梱されるため、推移依存も配布物に入りうる）。
`node_modules/.pnpm/*/node_modules/*/package.json` を全走査した。

| ライセンス | 件数 |
|---|---|
| MIT | 175 |
| ISC | 14 |
| Apache-2.0 | 10 |
| BSD-3-Clause | 2 |
| BSD-2-Clause | 2 |
| 0BSD | 2 |
| CC-BY-4.0 | 1 |
| (MIT AND Zlib) | 1 |

**⇒ 禁止ライセンス（GPL / LGPL / AGPL / CC BY-SA）と条件付き（MPL-2.0）は 0 件。結論は覆らない。**

**★ただし `CLAUDE.md` §6 の許可リストに明示されていない区分が 4 件ある**（いずれも permissive で、
禁止にも条件付きにも当たらないが、**リストに書かれていないという意味で「要判断」**）。

| パッケージ | ライセンス | 備考 |
|---|---|---|
| `pako@1.0.11` | `(MIT AND Zlib)` | `pdf-lib` の実行時依存＝**バンドルに入る**。Zlib は permissive |
| `tslib@2.8.1` / `tslib@1.14.1` | `0BSD` | TypeScript のヘルパ。0BSD は Unlicense 相当（帰属表示すら不要） |
| `caniuse-lite@1.0.30001791` | `CC-BY-4.0` | `browserslist`／`autoprefixer` のデータ。**ビルド時のみでバンドルに入らない** |

**⇒ 判断は開発者の手番**（`CLAUDE.md` §6 の許可リストへ 0BSD / Zlib / CC-BY-4.0 を足すか、
個別に例外とするか）。設計伝達レポート §4 へ候補として出す。

> **★件数の食い違いについて。** レビュー報告は「全パッケージ 329 件を走査」とし、
> 上記 4 件に加えて `@csstools/color-helpers`（MIT-0）を挙げている。
> **本報告の再走査は 207 件で、`@csstools/color-helpers` は検出されなかった**（走査経路と深さの違いによると考えられる）。
> **どちらの走査でも「禁止ライセンス 0 件」という結論は一致している。** 件数の正確な突合は
> ライセンス走査を機械化するまで保留する（本サブの成果物ではない）。

### 6.6 ★「最終更新が 2 年以上前」の該当（`CLAUDE.md` §6「原則不使用」）

基準日 2026-08-20 に対し 2024-08-20 より前。**上流の最新版の公開日**で判定した
（ピン留めが古いだけのものと、上流が止まっているものを分けるため）。

| 依存 | 使用版の公開 | 上流 latest | 判定 |
|---|---|---|---|
| `github.com/pkg/browser` | 2024-01-02 | 同じ（pseudo-version） | **★該当**（2 年 7 か月） |
| `gopkg.in/natefinch/lumberjack.v2` | 2023-02-06 | v2.2.1・同じ | **★該当**（3 年 6 か月） |
| `pdf-lib` 1.17.1 | 2021-11-06 | 1.17.1・同じ | **★該当**（4 年 9 か月） |
| `tailwindcss-animate` 1.0.7 | 2023-08-28 | 1.0.7・同じ | **★該当**（3 年 0 か月） |
| `clsx` 2.1.1 | 2024-04-23 | 2.1.1・同じ | **★該当**（2 年 4 か月・境界に近い） |
| `react` / `react-dom` 18.3.1 | 2024-04-26 | **19.2.8（2026-07-21）** | **非該当**。上流は活発。`CLAUDE.md` §2 が React 18 を指定しており**意図的なピン留め** |

> **★これは「入れ替えよ」という報告ではない。** 指示書 §2.2-5 / §4.4-4 のとおり本サブは増減しない。
> **5 件はいずれも小さく安定した部品であり、`DES-002` §11.3 の目的にも配布ライセンスにも影響しない。**
> 判断は開発者の手番として設計伝達レポート §4 へ出す。

### 6.7 判定できなかったもの
**なし。** Go の直接依存 7 件・配布バイナリにリンクされる 21 モジュール・npm の宣言依存 45 件・
推移依存 207 件のすべてで、ライセンスファイルまたは `license` フィールドの実値を確認できた。
**⇒ 母集団を明記した上での言明である**（初版は母集団を宣言依存に限ったまま「なし」と書いていた）。

---

## 7. 否定形確認（§4.9）— **3 系統すべてを走査した**

### 7.1 ①「LAN の FW・AV 既知制約の記載」は在るか → **★在った。書き直していない**

走査キーワード: 「ファイアウォール」「ウイルス」「AV」「警告」「Norton」「Defender」「firewall」「antivirus」

| 系統 | 結果 |
|---|---|
| **本番コード（ログ出力）** | **実在。** `cmd/combomgr/main.go:421-424`（起動通知・日本語）と `:466-469`（`logLANAccessGuide`・英語）が、Windows ファイアウォール（プライベート）とサードパーティ AV の inbound 許可を案内 |
| **テスト資産** | **実在。** `cmd/combomgr/main_test.go:22 / :44 / :61` が上記文言の有無を 3 ケースで検証（local モードでは出さない／lan モードでは出す／IP 未検出時も出す）。`web/e2e/` にはヒット 0（E2E の対象外であり正しい） |
| **設計文書・運用文書** | **実在。** `README.txt`（配布物 README）L61 の導線と **L68-94 の「【1】ファイアウォール / ウイルス対策ソフトの許可(最頻出の原因)」節**。`docs/design/02-architecture.md` にも言及 |

**⇒ `followup-backlog` §F の「README/log 記載済」は真である。**
指示書 §4.5 の分岐「実在する場合 —— **そのままにし、確認した旨だけを完了報告へ書く（★書き直さない）**」に従い、
**README.txt もログも 1 バイトも触っていない。**

> **★Plan Mode 提示時の自分の記述を訂正する。** Plan では「README に記載が無いので §4.5 に従い
> 1 節を足す」としていた。**走査対象を `README.md` に限っていたための誤りで、実体は `README.txt`（配布物）にあった。**
> §F の主語は利用者が読む配布物であり、`README.md`（開発者向け）に同じ内容を置くと二重管理になる。
> **⇒ README.md への FW/AV 節の追加は取り止めた。** README.md への追記は「CI」節のみ。

### 7.2 ②「既存の CI 定義」は在るか → **★無かった**

走査: `.github/workflows/` ／ `actions/` ／ `workflow_dispatch` ／ `runs-on` ／ `actions/checkout`。
リポジトリ全体（`node_modules` 除く）で **0 件**。`.github/` ディレクトリ自体が不在だった。
`.agents/skills/combomgr-manufacturing-workflow/agents/openai.yaml` は Codex 用エージェント定義であり CI ではない。

**⇒ 本サブが新設した 2 本が、このリポジトリで最初の CI 定義である。**

### 7.3 ③「`-count=1` を欠いた `go test` の記述」は在るか → **★4 か所で在った**

| 系統 | 箇所 | 記述 | 影響 |
|---|---|---|---|
| **運用文書・ビルド定義** | `Makefile:63`（`test-go`） | `go test ./...` | **★最も効く。** 下記のフックが経由する |
| 同 | `Makefile:76`（`test-go-debug`） | `go test -tags=debug ./...` | 同型 |
| 同 | `CLAUDE.md:410` | 開発時頻用コマンドとして `go test ./...` を掲載 | 人が手で打つときに踏む |
| **テスト資産・スクリプト** | `scripts/audit-resource-scan.sh:277` | `go test -run TestPragmaPerConnection -v .` | 単体指定でもキャッシュ対象 |
| **本サブが書いたワークフロー** | `.github/workflows/pr-checks.yml:158` | **`go test -count=1 ./...`** | **付いている** |

**★とくに `.claude/hooks/stop-test.sh:26` が `make test-go` を呼んでいる。**
これは Claude Code のセッション停止時に自動で走る検査であり、**`-count=1` を欠いたまま「go test 失敗」の有無だけを見ている**。
⇒ **キャッシュが効いている状態では、何も実行せずに「失敗なし」と報告しうる。**
本サブが CI 側で塞いだ穴が、フック側には残っている。

**★本サブでは直していない。** `Makefile` / `CLAUDE.md` / `.claude/hooks/` はいずれも指示書 §2.1 の
対象外であり、§9.1-2 の趣旨（検査を作る回に本番/共通資産の修正を混ぜない）にも反する。
**設計伝達レポート §4 へ候補として出す。**

---

## 8. 完了条件（DoD）の充足状況

### 8.1 機能要件（指示書 §7.1）

| # | 条件 | 判定 |
|---|---|---|
| 1 | PR ワークフローが在り、**緑で完走した** | **✅** |
| 2 | **`-count=1` が付いている** | **✅**（`pr-checks.yml:158`） |
| 3 | 意図的な失敗で**赤になることを確認した** | **✅** |
| 4 | nightly が在り、**3 OS の成果物が artifact に残った** | **✅** |
| 5 | README に CI の位置づけと赤いときの扱いが在る | **✅** |
| 6 | 依存の棚卸し表が在る・**増減 0 件** | **✅**（§6） |
| 7 | FW・AV 記載の確認結果が在る | **✅**（§7.1。**実在したため書き直していない**） |

### 8.2 テスト要件（指示書 §5）

| # | 要求 | 判定 |
|---|---|---|
| 1 | PR ワークフローが 1 回以上緑で完走・job summary の所要秒 | **✅ 達成**（2026-08-22。`pull_request` 5m53s ／ `push: main` 6m46s。いずれも 10 分以内） |
| 2 | 意図的な失敗で赤になる確認 | **✅ 達成**（2026-08-22。run `32559162042`） |
| 3 | **`-count=1` の有無で結果が変わる実測** | **✅ 達成**（§3.3-3 の C vs D。142.2 s ↔ 0.385 s） |
| 4 | nightly 手動起動と 3 OS artifact | **✅ 達成**（2026-08-22。run `32557933392`。artifact に 3 点） |
| 5 | 本番コード・テスト資産の diff 0 | **✅ 達成**（§5-5） |

> **★2026-08-22 に 1 / 2 / 4 とも達成した。** 製造時点では §5-3 の 1 本だけが
> 「検査が働いている根拠」だったが、開発者の初回受入確認で残り 2 本
> （実際に赤になること ／ artifact が残ること）が埋まった。

### 8.3 品質チェック（指示書 §7.3）

| # | 条件 | 判定 |
|---|---|---|
| 1 | ワークフローに秘密情報が無い | **✅** トークン・内部ホスト名・絶対パスとも 0。`secrets.*` の参照も 0（`GITHUB_TOKEN` すら使っていない。`permissions: contents: read` のみ） |
| 2 | `pnpm` を使っている（`npm`/`yarn`/`npx` 不使用） | **✅** `pnpm/action-setup@v6` ＋ `pnpm install --frozen-lockfile` ＋ `pnpm test`。版数は `package.json` の `packageManager` から解決（二重管理を作らない） |
| 3 | `docs/` へ新しい恒久ファイルを作っていない | **✅** 完了報告・レビュー報告・設計伝達レポートはいずれも既存運用の型 |

### 8.4 ドキュメント・完了報告（指示書 §7.4 / §7.5）

> **★初版の DoD 表は §7.1〜§7.3 しか対象にしておらず、実際に未達だった 2 項目だけが判定表に現れないという形になっていた**（レビュー指摘 (b)）。
> 本節はその是正である。

| # | 条件 | 判定 |
|---|---|---|
| 1 | `docs/progress/progress-log.md` への索引行の追記（§7.4 ／ `CLAUDE.md` §8） | **✅**（トリアージで実施） |
| 2 | **実測値の追記**（time-to-green ／ ランナー実コア数 ／ `pnpm install` の所要） | **△ 部分。** ベースライン §5 未決 **3（`pnpm install`）はローカル実測で回答した**が、**未決 1（time-to-green）と 2（ランナー実コア数）は CI 未実行のため埋まらない。** その状態自体を横断課題として progress-log へ記録した |
| 3 | 設計書本体を編集していない | **✅** `DES-002` §11.3 の diff 0 |
| 4 | 完了報告（§7.5） | **✅** 本書 |
| 5 | 設計伝達レポート（§7.5・§4 に followup 更新候補） | **✅**（トリアージで作成） |
| 6 | 「■ 併せて更新が要るもの」の節 | **✅** §10 |
| 7 | §3.3-8 の突合結果を独立節に | **✅** §12 |

---

## 9. 既知の制約

1. **★両ワークフローは未実行である**（§2-A / §8.2）。README「CI」節の「初回の受入確認」4 手順が残っている。
   **4 手順を終えたら、両ファイル冒頭の `★★ 未検証 ★★` ブロックと README の注意書きを削除すること。**
2. **PR の time-to-green は未確定。** 手元の値（`go test` 142.2 s ／ Vitest 64.9 s ／ `pnpm install` 5.5 s）
   から 10 分以内に収まる見込みだが、**これは推定であって実測ではない。** ランナーの実コア数も未確定。
   job summary が実測を出すようにしてあるので、初回実行で置き換えること。
3. **`pnpm install` の値は `--ignore-scripts` 付き・プロキシ経由の計測**である（§3.3-4 の限界注記）。
4. **nightly はフロントを 3 回ビルドする**（§4.2 の既知の非効率）。Makefile 側の最適化は行っていない。
5. **macOS amd64（Intel Mac）向けの成果物は出ない。** `DES-002` §11.1 は macOS を amd64 / arm64 の
   両方で「非公式対応」としているが、**§11.2 の配布物構成は `combomgr-macos-arm64.tar.gz` の 1 点のみ**を
   挙げており、Makefile もそれに揃っている。
   **本サブは Makefile の構成をそのまま使ったため、この不一致は温存されている**（指示書が求めていないため変更しなかった）。
6. **★nightly の artifact は `DES-002` §11.2 の配布物そのものではない。**
   §11.2 が定めるのは `combomgr-windows-amd64.zip`（中身＝`combomgr.exe` ＋ **`README.txt`**）／
   `combomgr-macos-arm64.tar.gz` ／ `combomgr-linux-amd64.tar.gz` の**アーカイブ 3 点**であり、
   名称も `macos-arm64`（`darwin-arm64` ではない）。
   **artifact に入るのは中身のバイナリだけで、アーカイブ化も `README.txt` の同梱も行われない。**
   **⇒ artifact をそのまま Releases へ上げると `README.txt` を欠いた配布物が出る**
   —— その `README.txt` こそ、§7.1 で「実在する」と確認した FW/AV トラブルシューティングの本体である。
   アーカイブ化と同梱は公開時の人の手番（指示書 §1.3-3）。**ワークフロー側にも同じ注意書きを置いた。**
7. **`.claude/hooks/stop-test.sh` の `-count=1` 欠落は残っている**（§7.3）。

---

## 10. ■ 併せて更新が要るもの

| # | 項目 | 状況 |
|---|---|---|
| 1 | **消費した CHANGE 番号の registry 登録** | **★不要（実施済み）。** `CHANGE-129` は **設計卓が 2026-08-20 に起票し、`change-number-registry.md` §1 の該当行へ同じ手番で登録済み**（履歴 v1.168.0 前後）。通知書 `docs/change-notes/CHANGE-129-notification.md` も実在を確認した。**⇒ 製造側で追加登録する番号は無い。** |
| 2 | **「次の番号」の写し先の全数確認** | **実査した。** `CHANGE` 側は `129` が最新で整合。**★一方、マイグレ連番の写し先に不一致を見つけた** —— `parallel-board` §2.1（L40）は「**次に払い出すマイグレ連番＝`000079`**」（M23-01 へ `000078` を払い出した前提）だが、**同ボード §2.4 の表（L297）は「次に払い出す番号＝`000078`」のまま**である。**本サブ由来ではない**（本サブの消費は 0 本）が、放置すると次の消費者が `000078` を再払い出しして衝突する（**D-120** と同型）。**⇒ 設計伝達レポート §4 へ出す。ボードは共有直列リソースであり製造は触らない。** |
| 3 | **消費したマイグレ連番** | **0 本。** `ls migrations/` の実査で disk 末尾は `000077`。`migrations/` の diff も 0。 |
| 4 | **版を上げた文書の参照元** | **なし。** 本サブは設計書の版を上げていない（`DES-002` §11.3 の改訂は `CHANGE-129` で設計卓が行う）。 |

---

## 11. 並列サブ（`M23-01`）の as-built との突合（`E-121` / D-284 / D-297）

**本サブの並列相手は `M23-01`**（**D-477** / **D-481**）。base commit `3aaf3e5` 時点で
`M23-01` の as-built は存在しない（`docs/progress/` にあるのは `M23-RESEARCH-01-report.md` のみ）。

| 面 | `M23-01` が触る（`CHANGE-121` / `M24-overview` §5.2） | 本サブが触った | 交差 |
|---|---|---|---|
| `migrations/` | **`000078`**（`combos.superseded_by_combo_id`） | なし | **なし** |
| Go サービス層・リポジトリ層テスト | **新規に足す** | なし（read-only 遵守） | **なし** |
| `web/e2e/` spec | **新規に足す** | なし（read-only 遵守） | **なし** |
| `ComboDetailPage.tsx` ／ ゴミ箱 UI ／ `Header.tsx` ／ `router.tsx` | 触る | なし | **なし** |
| `.github/workflows/` | 触らない | **新規 2 本** | **なし** |
| `README.md` | 触らない | **CI 節を追加** | **なし** |

**⇒ 交差 0。** 本サブの diff 3 ファイルは、いずれも `M23-01` の touched area に含まれない。
**D-481 の「`M24-09a` だけを M23 と並列に置く」判定は、as-built でも成立している。**

---

## 12. `CO` ledger との突合（指示書 §3.3-8）

対象: `docs/progress/M24-RESEARCH-01-report.md` §3.1 の `CO` ledger（26 項目）。

### 12.1 本サブが扱った `CO`

| CO | 内容 | 本サブでの扱い |
|---|---|---|
| `CO-017` | GitHub Actions CI | **実施**（§4） |
| `CO-018` | 依存ライブラリ棚卸し | **実施**（§6） |
| `CO-019` | LAN の FW・AV 既知制約 | **実施**（§7.1）。ledger の disposition は「調査」で、**結果は「as-built と合っている」** |
| `CO-016` | クロスビルド mac・Linux 実機起動 | **README 1 節まで**（§4.2-5 の担当範囲）。実機起動は開発者の手番 |

### 12.2 ★差分（本書が拾っていない `CO` ／ 本書にあって ledger に無いもの）

**(a) 触る面が重なるのに本サブが扱わなかった `CO`**

| CO | 内容 | 理由 |
|---|---|---|
| `CO-006` | テスト inline INSERT パターン化 | **`M24-09b`**（指示書 §1.3-2。`M23-01` が同資産へ足すため） |
| `CO-007` | `000012` down orphan 判定 | **`M24-09b`**（§1.3-7。`migrations/` に触らない） |
| `CO-012` | TOML 再エンコード＋アトミック書込の重複 | **`M24-09b`**（§1.3-5） |
| `CO-015` | LAN IP 事前提示 | **スコープ外**（§1.3-4。機能追加であり運用作業ではない） |
| `CO-021` / `CO-022` / `CO-025` | E2E flake 3 件 | **スコープ外**（§1.3-1。E2E を CI に載せないため、CI 側から触る面が無い） |

**(b) ★`M24-overview` §5.2 の交差表と指示書の食い違い（要同期）**

`M24-overview` §5.2 の `E-14` 交差表は
**`M24-09a` の touched area に `internal/api/config/`・`internal/service/config/`（`CO-012`）を挙げている**。
一方 **指示書 §1.3-5 は `CO-012` を `M24-09b` へ明示的に移している**（D-481 による分解）。

**本サブは指示書に従い、config 系 BE に一切触っていない**（指示書は本サブについて自己完結しており、
D-481 のほうが新しいため）。**⇒ `M24-overview` §5.2 の当該セルが未同期である。**

**(c) `CO-025` の割付が旧番号のまま**

`CO-025`（E2E timing flake クラスタ）の割付は「**M23**（旧M20 表記を同期）or fe-e2e 安定化サブ」の
ままであり、**D-386 (5) の改番が適用されていない**。`M24-RESEARCH-01` §6① が既に指摘済みで、
**`grep 'M24'` では拾えない行**である。本サブのスコープ外だが、突合の過程で再確認した。

**(d) `SM-151`（SCANOSS による混入検査）**

ledger は `CO-018`（依存棚卸し）に**隣接するが別作業**と判定している。**本サブは扱っていない。**
§6 で行ったのは**ライセンスの棚卸し**であって、コード片の混入検査ではない。

### 12.3 本書にあって ledger に無いもの

- **`M14-i`（MPL 依存の非リンク確認）を解消した**（§6.3）。これは `followup-backlog` §C の項目であり、
  `CO` ledger（§F・§B・§E・§G・§K 由来）には行が無い。**依存棚卸しの副産物として片付いた。**
- **`.claude/hooks/stop-test.sh` の `-count=1` 欠落**（§7.3）。ledger に該当行は無い。**新規発見。**
- **`parallel-board` §2.4 のマイグレ連番の未同期**（§10-2）。ledger に該当行は無い。**新規発見。**

---

*以上、M24-09a 完了報告。2026-08-20。*
