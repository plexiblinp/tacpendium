# M13-RESEARCH-02 調査報告: 破壊的 FS 操作の全数監査 + 依存ライセンス軽量スイープ

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/phase3/M13-RESEARCH-02-fs-audit-and-license-sweep.md` v1.0.0 |
| 種別 | 調査報告(read-only。実装・依存追加・ファイル移動・ビルド/実行ゼロ) |
| 調査日 | 2026-06-28 |
| 調査範囲 | A. 破壊的 FS 操作の全数監査(F12-7)/ B. 依存ライセンス軽量スイープ(NFR403) |
| 根拠 | 実コード view・grep / Go module cache(`/home/node/go/pkg/mod`)・`web/node_modules` の実 LICENSE / package.json |

> **judgement-free**: 本報告は「削除して安全」「この順で是正すべき」等の決定を含まない。封じ込め判定・寛容判定は**事実分類**として記載し、配布可否の法的決定はしない。指示書 §0.3 が許可する範囲で「想定外の発見/明らかな齟齬」を事実として指摘する。

---

## 結論サマリ(冒頭集約)

- **A(破壊的 FS 操作)**: 非テストコードの破壊的 FS 操作は **全 16 ヒット**。内訳 = config アトミック書込(`os.Create`/`os.Rename`/`os.Remove` × 13)+ `os.MkdirAll` × 3。**`os.RemoveAll` / `os.Truncate` / `os.OpenFile` / `os.WriteFile`(非テスト)は 0 件**。書込/削除先は **すべて (a) 固定定数 `config.toml`(=実行時カレント配下)または (b) `database.path`/`logging.file`(CHANGE-049 で検証済み)由来のディレクトリ** に封じ込められている。**ユーザ入力(API ボディ/クエリ/CSV セル)由来のパスが破壊的 FS 操作に流入する箇所は 0 件**。
- **A(将来観点)**: ログローテーション(lumberjack)が rotate 時に内部で Rename/Create/Remove を行うが、対象は `logging.file` と同一ディレクトリの自前ローテーションファイルのみ。M13-01(export/import)の FS 書込は**現時点の本体 `internal/` に存在しない**(後述 A-3)。
- **B(Go)**: `go.mod` require(直接+間接、ビルドグラフ)**22 モジュールすべて MIT / BSD-2 / BSD-3 の寛容ライセンス**。コピーレフト 0。`go.sum` のみに現れる推移/テスト依存に **`github.com/hashicorp/golang-lru/v2` = MPL-2.0**(CLAUDE.md §6 の「条件付き」)が 1 件あるが、**`go.mod` require に無く・アプリソースから直接 import されていない**(事実)。
- **B(web)**: `web/package.json` の依存(dependencies + devDependencies)**全 44 件すべて MIT / Apache-2.0 / ISC の寛容ライセンス**。M13-01/02 見込みの `html-to-image` / `pdf-lib` は**現状未導入**(package.json・node_modules ともに不在)。
- **B(本体ライセンス表記の齟齬・事実)**: README.md §ライセンスは **「未定(リリース前に決定予定)」**。DES-001 **§5(プロジェクトライセンス方針)は MIT を推奨**と明記(§6 決定欄で 2026-04-10 に案C=Go+React 採用を記録)。一方で **DES-001 §2.1(案A)/§4.1 の技術スタック表に旧スタック〔Tauri / Rust / SQLx / scraper〕が「推奨案/総合推奨」として残置**。M13-RESEARCH-01-report §F-1 は乖離箇所を「DES-001 §5」と記すが、**実ファイル上、旧スタック表は §5 ではなく §2.1/§4.1**(事実補正)。

---

## A. 破壊的 FS 操作の全数監査(F12-7)

### A-1 / A-2: 破壊的 FS 操作の一覧(非テストコード全数)

grep 対象系統(snake/camel/部分一致を網羅): `os.Remove` / `os.RemoveAll` / `os.Rename` / `os.Truncate` / `os.Create` / `os.OpenFile` / `os.WriteFile` / `ioutil.WriteFile` / `os.Mkdir*` / `O_TRUNC|O_WRONLY|O_CREATE|O_RDWR` / `TempFile|MkdirTemp|.tmp|backup|.bak`。

| # | ファイル:行 | 操作 | 対象パスの算出元 | 封じ込め | CHANGE-049 射程 |
|---|------------|------|----------------|---------|----------------|
| 1 | `internal/service/config/service.go:257` | `os.Create(tmpPath)` | `tmpPath = s.configPath + ".tmp"`。`s.configPath` ← `main.go:206` で固定定数 `configPath = "config.toml"`(`main.go:61`)を注入 | 実行時カレント配下(固定定数・ユーザ入力非経由) | **射程外**(検証対象は `database.path`/`logging.file` であり config 自体のパスではない。ただし固定定数で非可変) |
| 2 | `internal/service/config/service.go:267` | `os.Remove(tmpPath)` | encode 失敗時の `.tmp` 後始末 | 同上 | 同上 |
| 3 | `internal/service/config/service.go:271` | `os.Remove(tmpPath)` | sync 失敗時の `.tmp` 後始末 | 同上 | 同上 |
| 4 | `internal/service/config/service.go:275` | `os.Remove(tmpPath)` | close 失敗時の `.tmp` 後始末 | 同上 | 同上 |
| 5 | `internal/service/config/service.go:279` | `os.Rename(tmpPath, path)` | `path = s.configPath`(固定定数) | 同上(アトミック置換) | 同上 |
| 6 | `internal/service/config/service.go:280` | `os.Remove(tmpPath)` | rename 失敗時の `.tmp` 後始末 | 同上 | 同上 |
| 7 | `internal/config/config.go:136` | `os.Create(tmpPath)` | `Save(path,...)` の `tmpPath = path + ".tmp"`。`path` ← `PersistPort(configPath,...)`(`main.go:155`)= 固定定数 `config.toml` | 実行時カレント配下(固定定数) | 射程外(固定定数・非可変) |
| 8 | `internal/config/config.go:144` | `os.Remove(tmpPath)` | encode 失敗時の後始末 | 同上 | 同上 |
| 9 | `internal/config/config.go:148` | `os.Remove(tmpPath)` | sync 失敗時の後始末 | 同上 | 同上 |
| 10 | `internal/config/config.go:152` | `os.Remove(tmpPath)` | close 失敗時の後始末 | 同上 | 同上 |
| 11 | `internal/config/config.go:155` | `os.Rename(tmpPath, path)` | `path`(固定定数 `config.toml`) | 同上(アトミック置換) | 同上 |
| 12 | `internal/config/config.go:156` | `os.Remove(tmpPath)` | rename 失敗時の後始末 | 同上 | 同上 |
| 13 | `internal/infra/db/db.go:28` | `os.MkdirAll(dir, 0o755)` | `dir = filepath.Dir(dbPath)`。`dbPath` ← `ResolveDBPath(cfg.Database.Path)`(空なら OS 既定データディレクトリ) | アプリ既定データディレクトリ or `database.path` 検証後 | **射程内**(`database.path` は `ValidateDataPath` で検証) |
| 14 | `internal/infra/migration/migrate.go:44` | `os.MkdirAll(dir, 0o755)` | `dir = filepath.Dir(dbPath)`(同上、`db.Open` より前に親作成) | 同上 | **射程内** |
| 15 | `internal/infra/log/log.go:38` | `os.MkdirAll(dir, 0o755)` | `dir = filepath.Dir(cfg.File)` | `logging.file` 検証後のディレクトリ | **射程内**(`logging.file` は `ValidateDataPath` で検証) |
| 16 | `internal/infra/log/log.go:43-49` | `lumberjack.Logger`(rotate 時に内部 Rename/Create/Remove) | `Filename = cfg.File`。rotate/MaxBackups 削除対象は lumberjack 自前のローテーション派生ファイル(`<name>-<timestamp>.log` 等) | `logging.file` と同一ディレクトリ配下 | **射程内**(基底パスは `ValidateDataPath` 検証済み。rotate 派生ファイルは基底と同階層) |

**0 件であった系統(明示)**: `os.RemoveAll`(0 件)/ `os.Truncate`・`.Truncate(`(0 件)/ `os.OpenFile`(0 件)/ `os.WriteFile`(**非テストコードは 0 件**。`os.WriteFile` の grep ヒットは `internal/config/config_test.go`・`internal/service/config/service_test.go` のテストフィクスチャのみ)/ `ioutil.WriteFile`(0 件)/ `MkdirTemp`・`os.TempDir`・`TempFile`(0 件)/ `backup`・`.bak`(0 件。`MaxBackups` は lumberjack 設定キーであり FS 操作ではない)。

**ユーザ入力由来パスの流入(A-2 核心)**: 上記 16 件いずれも、書込/削除先パスの算出元は **固定定数(`config.toml`)** または **config 由来(`database.path`/`logging.file`、CHANGE-049 検証済み)** のみ。**API リクエストボディ・クエリパラメータ・CSV セル等のユーザ入力が破壊的 FS 操作の対象パスに混入する箇所は 0 件**。

### A-3: CHANGE-049 射程との重複/非重複

- **CHANGE-049(=コード上は CHANGE-048 と注記、`ValidateDataPath`)の射程**: `internal/config/config.go:230` の `ValidateDataPath` が `database.path` / `logging.file` の 2 値に対し、(a) `filepath.Clean` 後の `..` 要素を拒否、(b) 絶対パスは `appDataRoots()`(= `db.DataDir()` のアプリ既定データディレクトリ + `os.Getwd()` の実行時カレント)配下のみ許可。`config.toml` ロード経路(`validate()` L207-211)と `PUT /api/config` 経路(`internal/service/config/service.go:237-247`)で同一規則を共有。
  - ※コード/コメントは「CHANGE-048」と記載(`config.go:223`・`service.go:235`)。指示書は「CHANGE-049」。**ID 表記の差**を事実として記録(検証ロジック自体は指示書 §3.2 の記述と一致)。
- **射程の外側にある破壊的操作**:
  - config ファイル書込(#1-12): 対象は固定定数 `config.toml`(ユーザ入力非経由)。`ValidateDataPath` の対象外だが、定数のため脱出経路なし。
  - ログローテーション(#16): lumberjack が rotate 時に Rename/Create/Remove を実行。基底 `cfg.File` は CHANGE-049 検証済み、rotate 派生ファイルは同階層に限定。
- **M13-01(export/import の FS 書込)を見越した将来観点(事実ベース)**:
  - 現時点で本体 `internal/` に**コンボ CSV を「ディスクへ書き出す」Go コードは存在しない**。`internal/` 内で `csv.` を含むのは `internal/service/movesimport/parse.go` のみで、同ファイルに FS 操作(`os.*`/`WriteFile`/`Create`/`Remove`/`Rename`)は 0 件(in-memory パース)。
  - M13-RESEARCH-01-report によると、コンボ CSV export(`csvexport.ExportCSV`)・image export は外部ツーリング/フロント側成果物で、本体 `internal/` 未統合(同 §B/§E)。
  - したがって export/import の FS 書込が本体に増えるのは **M13-01 実装時**。その際の書込先が `appDataRoots()` 等のアプリ管轄に封じ込められるか・ユーザ指定ファイル名がパスに流入しないかは、本サブ時点では**未実装ゆえ未確認(将来の検証対象)**。

### A-4: DB ファイル自体の扱い(migrate / 接続初期化)

- `internal/infra/migration/migrate.go`: `m.Up()` のみ実行(L94)。`Down`/`Drop`/`DROP` の呼び出しは**アプリソース全体で 0 件**(`grep -ni 'drop\|migrate.Down\|m.Drop'` ヒットなし)。`migrate.ErrNoChange` は no-op として吸収。
- `internal/infra/db/db.go`: `sql.Open("sqlite", dbPath)` + PRAGMA(`journal_mode=WAL`/`foreign_keys=ON`/`busy_timeout`/`synchronous=NORMAL`)のみ。DB ファイルの truncate/drop/削除は無し(modernc.org/sqlite は不在時に新規作成、既存ファイルは破壊しない)。
- **既存 DB を破壊しうる経路**: 誤った `database.path` 指定による別ファイル参照は、`ValidateDataPath`(CHANGE-049)が `..`・管轄外絶対パスを拒否することで封止。初期化時の DROP・無条件上書きは**存在しない**(事実)。

---

## B. 依存ライセンス軽量スイープ(NFR403)

### B-1: Go 依存(`go.mod` require = 直接+間接、ビルドグラフ)

実 LICENSE ファイル(module cache `/home/node/go/pkg/mod`)の本文識別による分類。

| 依存 | バージョン | ライセンス(実ファイル識別) | 寛容 |
|------|-----------|------------------------------|------|
| github.com/BurntSushi/toml | v1.6.0 | MIT | ○ |
| github.com/golang-migrate/migrate/v4 | v4.19.1 | MIT | ○ |
| github.com/labstack/echo/v4 | v4.15.1 | MIT | ○ |
| github.com/pkg/browser | v0.0.0-20240102092130 | BSD-2-Clause | ○ |
| gopkg.in/natefinch/lumberjack.v2 | v2.2.1 | MIT | ○ |
| modernc.org/sqlite | v1.50.0 | BSD-3-Clause | ○ |
| github.com/dustin/go-humanize | v1.0.1 | MIT(Expat) | ○ |
| github.com/google/uuid | v1.6.0 | BSD-3-Clause | ○ |
| github.com/labstack/gommon | v0.4.2 | MIT | ○ |
| github.com/mattn/go-colorable | v0.1.14 | MIT | ○ |
| github.com/mattn/go-isatty | v0.0.20 | MIT | ○ |
| github.com/ncruces/go-strftime | v1.0.0 | MIT | ○ |
| github.com/remyoudompheng/bigfft | v0.0.0-20230129092748 | BSD-3-Clause | ○ |
| github.com/valyala/bytebufferpool | v1.0.0 | MIT | ○ |
| github.com/valyala/fasttemplate | v1.2.2 | MIT | ○ |
| golang.org/x/crypto | v0.46.0 | BSD-3-Clause | ○ |
| golang.org/x/net | v0.48.0 | BSD-3-Clause | ○ |
| golang.org/x/sys | v0.42.0 | BSD-3-Clause | ○ |
| golang.org/x/text | v0.32.0 | BSD-3-Clause | ○ |
| modernc.org/libc | v1.72.0 | BSD-3-Clause | ○ |
| modernc.org/mathutil | v1.7.1 | BSD-3-Clause | ○ |
| modernc.org/memory | v1.11.0 | BSD-3-Clause | ○ |

→ **require グラフ 22 件すべて寛容(MIT/BSD-2/BSD-3)。非寛容(GPL/LGPL/AGPL/MPL/独自)は 0 件**。

#### B-1 補足: `go.sum` のみに現れるモジュール(推移/テスト依存。`go.mod` require 非掲載)

`go.sum` には require グラフ外のチェックサムも記録される(依存のテスト/ツール用推移依存)。実 LICENSE 識別結果:

| 依存 | ライセンス | 寛容 | 備考 |
|------|-----------|------|------|
| github.com/davecgh/go-spew | ISC | ○ | testify 連鎖 |
| github.com/google/pprof | Apache-2.0 | ○ | |
| **github.com/hashicorp/golang-lru/v2** | **MPL-2.0** | **△(条件付き)** | **require 非掲載・アプリソースから直接 import なし(`grep -rn 'hashicorp/golang-lru' --include='*.go'` 0 件)** |
| github.com/lib/pq | MIT | ○ | golang-migrate の他 DB ドライバ系 |
| github.com/pmezard/go-difflib | BSD-3-Clause | ○ | testify 連鎖 |
| github.com/stretchr/testify | MIT | ○ | テスト |
| golang.org/x/mod | BSD-3-Clause | ○ | |
| golang.org/x/sync | BSD-3-Clause | ○ | |
| golang.org/x/tools | BSD-3-Clause | ○ | |
| gopkg.in/yaml.v3 | MIT + Apache-2.0(デュアル・いずれも寛容) | ○ | LICENSE 冒頭に「two different licenses: MIT and Apache」明記 |
| modernc.org/ccgo/v4, cc/v4, fileutil, gc/v2, gc/v3, goabi0, opt, sortutil, strutil, token | すべて BSD-3-Clause | ○ | modernc ツールチェーン |

→ **事実指摘(要確認・判断は本サブ対象外)**: `hashicorp/golang-lru/v2` が **MPL-2.0**(CLAUDE.md §6 で「原則不使用、代替がない場合のみ開発者確認の上で採用」の条件付きライセンス)。ただし **`go.mod` require ブロックに掲載されておらず、アプリ Go ソースからの直接 import も 0 件**(=本モジュールの依存解決上「使用宣言」されていない推移依存)。最終バイナリへのリンク有無は本サブ(静的 view/grep のみ)では**未確認**。

### B-2: web 依存(`web/package.json` dependencies + devDependencies)

実 `node_modules/<pkg>/package.json` の `license` フィールドによる分類。

**dependencies(30 件)**: `@hookform/resolvers`=MIT / `@radix-ui/react-*`(accordion・alert-dialog・checkbox・dialog・dropdown-menu・label・popover・radio-group・select・slot・switch・tabs・tooltip = 14 件)=すべて MIT / `@tanstack/react-query`=MIT / **`class-variance-authority`=Apache-2.0** / `clsx`=MIT / `i18next`=MIT / **`lucide-react`=ISC** / **`qrcode.react`=ISC** / `react`=MIT / `react-dom`=MIT / `react-hook-form`=MIT / `react-i18next`=MIT / `react-router-dom`=MIT / `sonner`=MIT / `tailwind-merge`=MIT / `tailwindcss-animate`=MIT / `zod`=MIT。

**devDependencies(14 件)**: **`@playwright/test`=Apache-2.0** / `@testing-library/react`=MIT / `@testing-library/user-event`=MIT / `@types/node`=MIT / `@types/react`=MIT / `@types/react-dom`=MIT / `@vitejs/plugin-react`=MIT / `autoprefixer`=MIT / `jsdom`=MIT / `postcss`=MIT / `tailwindcss`=MIT / **`typescript`=Apache-2.0** / `vite`=MIT / `vitest`=MIT。

→ **web 全 44 件すべて寛容(MIT / Apache-2.0 / ISC)。非寛容は 0 件**。

**M13-01/02 見込み依存**: `html-to-image`・`pdf-lib` は **package.json 未記載・node_modules 不在**(現状未導入)。M13-RESEARCH-01-report はいずれも MIT 想定とするが、本サブ時点では実物が無く**ライセンス実確認は未実施(未導入)**。

### B-3: 本体ライセンス表記の現状(実ファイル裏取り)

- **LICENSE ファイル**: リポジトリルート・全ツリーに `LICENSE*`/`COPYING*` ファイルは**存在しない**(`find . -iname 'LICENSE*' -not -path '*/node_modules/*' -not -path '*/.git/*'` → 0 件)。
- **README.md §ライセンス(L78-80)**: 「**未定(リリース前に決定予定)。**」
- **README.txt**: ライセンス記述なし(`licen`/`ライセンス` ヒット 0 件)。
- **DES-001(`docs/design/01-tech-stack.md`)**:
  - **§5「プロジェクトライセンス方針」(L199-207)**: 「本プロジェクト自体のライセンスは **MIT License** を推奨する」。依存ライセンス(MIT/Apache-2.0/BSD-3/Public Domain)と互換、と明記。
  - **§6「決定事項の記録欄」(L213-220)**: 採用案 = **案C(Go + React)**、決定日 2026-04-10。「当初決定 案A(Rust + React / Tauri)→ LAN 対応必須化により再評価」と変更経緯を記録。
  - **旧スタック記載の所在(事実補正)**: Tauri / Rust(Tauri 内蔵)/ SQLx / scraper 等の旧スタックは **§2.1「案A:Rust + React(推奨案)」(L33-47)** と **§4.1「総合推奨:案A(Rust + React / Tauri)」(L181)** の技術スタック表に残置。**M13-RESEARCH-01-report §F-1 は乖離箇所を「DES-001 §5」と記すが、実ファイル上 §5 は MIT 方針のテキストのみで旧スタック表は含まず、旧スタックは §2.1/§4.1**。つまり「§6 で案C(Go)採用を記録済みだが、§2.1/§4.1 の推奨表が案A(Tauri/Rust)のまま更新されていない」という**節内の不整合**が実態(事実)。

---

## 配布判定 / M13-01 への含意(末尾集約)

> 以下は**事実の含意整理**であり、是正の意思決定・配布可否の法的判断はしない(指示書 §1.3)。

- **FS 安全(配布判定への入力)**:
  - 非テストの破壊的 FS 操作 16 件はすべて **固定定数 `config.toml`(cwd)** か **CHANGE-049 検証済みの `database.path`/`logging.file` 由来ディレクトリ** に封じ込め。**ユーザ入力由来パスの流入・管轄外脱出・既存 DB の DROP/無条件上書きはいずれも 0 件**。`os.RemoveAll` 不使用。
  - **未確認/将来観点**: (1) M13-01 で増える export/import の FS 書込は本体未実装ゆえ封じ込め未確認(実装時に `appDataRoots()` 封じ込め・ユーザ指定ファイル名のパス流入有無の検証が要点)。(2) lumberjack rotate の派生ファイル削除は基底パス検証の射程内だが、コード上の明示テストは本サブ対象外。
- **ライセンス上の懸念有無**:
  - Go require グラフ 22 件・web 44 件は**全数寛容**。配布バイナリ本体の依存に GPL/LGPL/AGPL は 0 件。
  - **唯一の非寛容フラグ** = `go.sum` の `hashicorp/golang-lru/v2`(MPL-2.0)。**require 非掲載・直接 import 0 件**だが、最終バイナリへのリンク有無は静的調査では**未確認**(配布判定前に `go mod why` 等での確認余地 — 本サブはコマンド実行せず事実列挙に留める)。
  - 本体ライセンス表記は **README「未定」 vs DES-001 §5「MIT 推奨」** が**未確定状態**。LICENSE ファイルは未配置。
- **DES-001 §5 是正の要否(事実)**: §5 のテキスト自体は MIT 方針で現行スタックと矛盾しない。**是正余地は §2.1/§4.1 の「推奨=案A(Tauri/Rust/SQLx)」表が §6 の案C 採用決定と未同期**な点(M14 の CHANGE 起票で別途、本サブは事実指摘のみ)。

---

## 完了条件(DoD)対照

- [x] §4 A・B を実コード・実依存ファイルの view・grep で確認して報告。
- [x] パス・関数・依存名・ライセンスを**実値**で報告(LICENSE 実ファイル/package.json `license` から取得。記憶代替なし)。確認不能は「未確認」と明記(MPL リンク有無・M13-01 将来 FS 書込・未導入 web 依存)。
- [x] 破壊的 FS 操作の封じ込め判定・依存ライセンスの寛容判定を配布判定に使える粒度でそろえた。
- [x] read-only 逸脱なし(書き込みは本報告ファイルのみ。実装・依存追加・ファイル移動・ビルド/テスト実行ゼロ)。

*以上、M13-RESEARCH-02 調査報告。*
