# 設計伝達レポート: M28-01（正式名リネーム `combomgr` → `Tacpendium`）

| 項目 | 内容 |
|------|------|
| 作業ID | M28-01 |
| 対象指示書 | `docs/instructions/M28-01-official-name-rename.md` **v1.0.1** ／ チェックリスト `docs/instructions/reviews/M28-01-review-checklist.md` |
| CHANGE | **未起票。★製造は番号を消費していない**＝`D-293`。**たたき台は §6。宛先は `DES-002` と `SUPP-001` の 2 本** |
| マイグレ | **消費 0 本**。`ls migrations/` の最大は `000102` のままで、ボード §2.2 の「次に払い出す番号 `000103`」とずれていない |
| 作成日 | 2026-09-06 |
| 実装コミット | `claude/m28-01-implementation-plan-wmkyq0`・`fae8118..dfb5f64`（**14 コミット・push 済み**）。差分（`docs/` 除く）＝**300 ファイル / +4638 / −937** |
| 源泉 | 完了報告 `docs/progress/M28-01-completion-report.md` ／ レビュー `docs/progress/m28-01-review.md`（重大 0 / 高 6 / 中 9 / 低 7・**高の不採用 0 件**）／ **設計卓の裁定 1 回（2026-09-05）・開発者裁定 3 回（2026-09-05 射程 ／ 2026-09-05 追補 2 ／ 2026-09-06 実データ検証）** ／ 実装直後の同一セッションで生成 |
| 宛先 | 設計卓（親チャット） |

**本レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 に絞る。指示書どおりの部分は割愛する。**

**★★最重要は §2-1（設計卓が付けた条件 (c) を、製造の判断で実装しなかった — 受理か差し戻しの裁定が要る）と §1-1（新設した API 2 本の契約。`DES-002` §4.2 の経路表に載る）である。**

> **★★設計卓は `docs/progress/` を読まない**＝2026-08-11 開発者裁定①。**したがって本レポートは参照だけを書かず、判断に要る中身をここへ埋めてある。**

> **★本サブは「名前を置換する」以上のものを作った。** 指示書 §2.3 が求めた「既定データディレクトリの自動移行」のために **新パッケージ `internal/infra/datadir`（8 ファイル）と新 API 2 本と新 UI 1 つ**を足している。**⇒ `DES-002` §4.2 の経路表と `SUPP-001` §5.8 に as-built が要る。**

---

## 1. 独自確定仕様（設計書に無い／設計書より細かい決めごと）

### ★★§1-1 新設 API 2 本の契約 — 全行

**★`DES-002` §4.2 の経路表に載る API を新設した。⇒ 参照ではなく中身を置く。**

**登録** `internal/api/notice/routes.go` ／ **実装** `internal/api/notice/handler.go` ／ **置き場は `/api` グループ配下**。

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/notices/data-migration` | 未読の移行告知を 1 件返す |
| `POST` | `/api/notices/data-migration/ack` | 告知を既読にする |

#### 応答の実 DTO（実行結果の転記ではなく、実際に返った本文）

```json
{"status":"migrated","message":"データの保存場所を /tmp/mig-rehearsal/share/combomgr から /tmp/mig-rehearsal/share/tacpendium へ移しました","from":"/tmp/mig-rehearsal/share/combomgr","to":"/tmp/mig-rehearsal/share/tacpendium","retiredTo":"/tmp/mig-rehearsal/share/combomgr.migrated-20260906","retireFailed":false,"at":"2026-09-06T03:33:25Z","acknowledged":false}
```

**フィールド**（`handler.go:23-36`。JSON タグは camelCase＝`CLAUDE.md` §4）:

| キー | 型 | 省略 | 意味 |
|---|---|---|---|
| `status` | string | 常に出る | `migrated` ／ `failed` ／ `skipped` |
| `reason` | string | omitempty | `status` を細分する機械可読コード。画面が文面を出し分ける |
| `message` | string | 常に出る | 利用者向けの 1 文 |
| `from` / `to` / `retiredTo` | string | omitempty | **絶対パス**。露出の判断は下記 |
| `retireFailed` | bool | **常に出る** | 退避に失敗したか |
| `at` | string | omitempty | RFC3339 |
| `acknowledged` | bool | 常に出る | 応答に載るのは常に `false`（下記の述語による） |

#### エラー契約の全行

| 状況 | 応答 |
|---|---|
| `GET`: 告知が存在しない | **204 No Content**（本文なし） |
| `GET`: 告知は在るが `acknowledged=true` | **204 No Content** ← `handler.go:60-61` |
| `GET`: 告知ファイルの読み取りに失敗 | **500**（`echo.NewHTTPError` に原因文字列） |
| `GET`: データディレクトリを解決できなかった起動 | **204**（`NewHandler("")` のとき常に告知なし） |
| `POST /ack`: 正常 | **204 No Content** |
| `POST /ack`: 書き込みに失敗 | **500** |
| `POST /ack`: 告知が無い | **204**（冪等。作らない） |

#### 母集団の述語（何を返し、何を返さないか）

**返すのは「未読の移行告知が 1 件」だけである。** 告知が作られるのは `NoticeFor` が真を返す 4 通りに限る（`internal/infra/datadir/notice.go:42-50`）:

| 契機 | 告知 | 再表示 |
|---|---|---|
| `migrated`（移行成功） | 出す | **1 度だけ**。閉じたら出ない |
| `failed`（検証に失敗して中止） | 出す | **毎起動**（設計卓の条件 (b)） |
| `skipped` + `new_db_exists`（新旧の両方が在る・良性） | 出す | **1 度だけ** |
| `skipped` + `old_data_stranded`（新が空で旧にデータが在る） | 出す | **毎起動・赤** |

**★上記以外の `skipped` は告知しない。** とくに `no_legacy_dir` ／ `no_legacy_db` ／ `explicit_db_path` ／ `legacy_dir_symlink` は**告知が作られない**。

#### ★★持たせなかった分岐（読む側が誤読しないために要る情報）

- **一覧も履歴も無い。** 告知は常に 0 件か 1 件で、データディレクトリ直下の `.migration-notice.json` 1 ファイルが正本である。**⇒ `id` を持たず、`GET /api/notices` のような親経路も無い。**
- **404 は無い。** 「無い」は 204 で表す。**⇒ フロントは `undefined` を受けてバナーを出さないだけであり、エラー処理を書いていない。**
- **`acknowledged=true` の告知は取得できない。** `GET` が 204 に化けるため、既読の告知を読み返す手段は API に無い（ファイルには残る）。**⇒ 「もう一度見せて」の要求が来たら経路の新設が要る。**
- **`POST /ack` は取り消せない。** 冪等だが逆操作を持たない。
- **DB を触らない。** 告知はファイルだけで完結しており、**マイグレを 1 本も消費していない**。
- **ブラウザストレージを使っていない。** `CLAUDE.md` §10.X の台帳に載っていないキーを増やすと `check-browser-storage-keys.sh` が赤くなり、台帳への追記が設計卓の手番になるため（`notice.go:24-25`）。**⇒ 既読の状態はサーバ側のファイルが持つ。**

#### ★露出について（設計卓の判断が要る点を明示する）

**本ルートは `/api` グループ配下であり `mw.Auth` を通る。ただし `mw.Auth` は `password_enabled = false` のとき素通しであり、それが既定である。** `lan` モードなら LAN 内の任意の端末から読める。**⇒ 応答に絶対パスが載る。**

**それでも載せている根拠は 2 つ**（`handler.go:15-22`）:
1. **同条件で `GET /api/config` が既に `database.path` を返しており、露出の種類が増えない**
2. **利用者が「移行前のデータがどこに残っているか」を知らないと、消してよいか判断できない**

**★露出を減らすなら `from` / `to` / `retiredTo` を落とし、退避先はログにだけ出す形になる。設計卓が別の読みを採るなら実装を変える。**

---

### §1-2 既定データディレクトリと DB のファイル名（`SUPP-001` §5.8 の as-built）

**★名前は 2 段で変わった。ディレクトリだけではない。**

| | 旧 | 新 | 定数 |
|---|---|---|---|
| データディレクトリ名 | `combomgr` | **`tacpendium`** | `db.appDirName` / `db.legacyAppDirName` |
| DB ファイル名 | `combomgr.db` | **`tacpendium.db`** | `db.dbFileName` / `db.legacyDBFileName` |
| ログ既定 | `logs/combomgr.log` | **`logs/tacpendium.log`** | `config.defaultLoggingFile` |
| Cookie | `combomgr_session` | **`tacpendium_session`** | — |
| 環境変数 4 本 | `COMBOMGR_*` | **`TACPENDIUM_*`** | `config.EnvLogLevel` 他 |

実装 `internal/infra/db/db.go:144-150`。**旧名の 2 定数は移行元の特定にのみ存在し、新規の書き込み先には使わない**旨をコード注記に書いた。

**★OS 別の既定パス**（`defaultDBPath`。`os.UserConfigDir()` は Linux で `~/.config` を返すため使わず手で組み立てている）:

| OS | 既定 |
|---|---|
| Windows | `%APPDATA%\tacpendium\tacpendium.db` |
| macOS | `~/Library/Application Support/tacpendium/tacpendium.db` |
| Linux | `$XDG_DATA_HOME/tacpendium/tacpendium.db`、未設定なら `~/.local/share/tacpendium/tacpendium.db` |

### §1-3 移行の不変条件（`DES-002` に明文化してほしい）

**「旧を 1 バイトも動かさない」ではない。正しくは「検証が通るまで、旧ディレクトリの中身は失われない」である。**

検証より前に旧へ 2 つの書き込みが起きる（`internal/infra/datadir/doc.go`。レビュー 高-5 で是正）:
1. ロックファイル `.migrating.lock` の作成
2. `PRAGMA wal_checkpoint(TRUNCATE)` による**移行元 DB への書き戻し**

**⇒ 破壊ではないが、初版の記述は実装より強かった。** 2026-09-06 の実データ検証で、退避先の mtime が全件保存され `combomgr.db-wal` / `-shm` だけが消えていることを実測した（完了報告 §7-4）。

### §1-4 移行の判定は「新 DB ファイルが在り非空か」で行う

**「移行先ディレクトリが空でなければ skip」にしていない。** `applog.Init` / `migration.Run` / `db.Open` は**いずれも書き込み先の親を `MkdirAll` する**ため、どれかが移行判定より先に走ると「ディレクトリはあるが DB は無い」状態になり、**経路 a が黙って経路 b へ化ける**（`decide.go` の注記）。⇒ 判定に使うのは新 DB ファイルの実在と非空だけ。

### §1-5 `GET /api/config` の `database.path` は変わっていない

**この経路の契約は不変である。** 移行後に `config.toml` の絶対パスを書き換えるため値は変わるが、**キーも型も意味も変えていない**。

---

## 2. 契約・設計に反する独自判断（★受理か差し戻しの裁定が要る）

### ★★§2-1 設計卓が付けた条件 (c) を、製造の判断で実装しなかった（**未裁定**）

**何に反したか**: 2026-09-05 に設計卓が解釈②を承認する際に付けた条件 (c) の逐語 —
**「検証に失敗して止まった後、新ディレクトリは残る。⇒ 次回起動は 4 経路の (b) に入り、検証に落ちた当のディレクトリを正本として掴む。失敗した新は消すか、マーカーを置いて (b) から外してほしい」**。

**なぜそう判断したか**: **★前提が成立しなかった。** 通常の検証失敗では**新ディレクトリが作られない** —
`populateStaging` の失敗は `committed = false` のまま `defer` が作業ディレクトリを消し、
**`newDir` を作る唯一の場所である `commitStaging` に到達しない**（`migrate.go`）。
残骸が出るのは `commitStaging` の途中失敗だけで、そこでも **DB を最後に置く**ので `Decide` は正本にしない。
**⇒ マーカー機構は「起こらないことへの備え」になる。**

**実装がどうなっているか**: **マーカーは作らず、失敗の出口で残骸を実測して `Result` に載せた**
（`internal/infra/datadir/migrate.go` の `observeRemnant`。`Result.RemnantDir` / `RemnantDB`）。
**「残っていない」を主張ではなく観測にする**ためであり、**将来 `commitStaging` を先に呼ぶ形へ変えたら報告とテストから見える。**

**★あわせて**: 2026-09-05 に開発者が**射程を「利用者は現在は開発者だけ」と確定**した（`combomgr` の一般利用者は存在しない）。
条件 (c) を切り、**取り残し検知は残す**という選択はこの裁定に基づく。**⇒ 設計卓の受理が要る。**

### ★★§2-2 指示書 §4-4 の禁止事項「`.claude/` の編集」を、開発者の明示指示で上書きした（**報告**）

**何に反したか**: 指示書 §4-4 が「やらないこと」に **`.claude/` の編集（★開発者のルールファイル）** を挙げている。

**なぜ**: 2026-09-05 に開発者が明示的に 3 件の実施を指示した。`.agents/` と `human-notes/codex/` は禁止列に無いが `sync_codex_config` の管轄として手番を回していたもので、同じ扱いにした。

**実装がどうなっているか**: 完了報告 §8.1（`553529b`）。
(1) skill 識別子を `tacpendium-manufacturing-workflow` へ（**11 か所を原子的に**）
(2) `.claude/commands/*_wt.md` 5 本と `sync_codex_config.md:31`
(3) `docs/human-notes/` 本文 177 箇所。

**★(2) は単純な改名をしていない。** 開発リポジトリのチェックアウト名は `combomgr` のまま存続するため `/workspaces/tacpendium` と書くと現状で嘘になる。⇒ **チェックアウト名に依存しない形**へ直した（`例 <リポジトリのチェックアウト>/wt-setplay` ／ `git rev-parse --show-toplevel の直下`）。

### §2-3 指示書 §2.3-2 と §2.3-4 の 2 件（**2026-09-05 に設計卓が承認済み。記録のみ**）

| # | 指示書の逐語 | 製造の読み | 状態 |
|---|---|---|---|
| ① | §2.3-4「`config.toml` も移す」 | **移す対象が存在しない。** `config.toml` はアプリ実行ディレクトリ直下であり（`SUPP-001` §5.8「配置場所: アプリ実行ディレクトリ直下」／ `README.txt:20` ／ **`README.txt:117-118` が DB の置き場と `config.toml` の置き場を対比している**）、データディレクトリの中に無い。⇒ 実際にやることは中の絶対パスの書き換えだけ | **承認済み** |
| ② | §2.3-2「何も動かさずに**止まり**、利用者へ理由を出す」 | **止めるのは移行であってアプリではない。** 検証に失敗しても旧データディレクトリで起動し、赤いバナーで理由を出す。**★起動を止めるのは「別プロセスが移行中」の 1 件だけ** | **承認済み**（条件 (a)(b)(c) 付き。(c) は §2-1） |

**⇒ 設計卓へ**: **指示書本文は依然として上の逐語のままである。** 後任が同じ指示書から読むと同じ解釈の分岐に当たる。**指示書の改版か、`DES-002` 側への明文化のどちらかが要る。**

---

## 3. 製造の判断

### 3-1 開発者へ確認して確定した点

| # | 論点 | 確定内容 | 日付 |
|---|---|---|---|
| 1 | Go module path のリネームは実リポジトリ名の変更を要するか | **要さない。** 開発リポジトリ `plexiblinp/combomgr` はプライベートで存続し、公開用 `plexiblinp/tacpendium` を新設して**一方向同期**する。module path はローカル解決なのでビルドに影響しない | 2026-09-05 |
| 2 | 条件 (c) の射程 | **「利用者は現在は開発者だけ」を前提に、(c) のマーカー機構は作らない。取り残し検知は残す** | 2026-09-05 |
| 3 | 残していた開発者手番 3 件 | **開発者の明示指示で製造が実施**（§2-2） | 2026-09-05 |
| 4 | 実データでの移行検証 | **実施して消化した**（完了報告 §7-4） | 2026-09-06 |

**★1 に付随して 1 か所を直した**: `.devcontainer/Dockerfile` の `cmds` エイリアスが `/workspaces/combomgr` を直書きしており、**チェックアウト名の違うミラー先で必ず外れる**。実行時に `/workspaces/*/scripts/list-commands.sh` を選ぶ形へ。

### 3-2 推測で進めた点

| # | 内容 | 根拠 |
|---|---|---|
| 1 | **`docs/human-notes/` のファイル名 52 件を据え置いた** | 被参照を全数調べたところ**歴史記録から約 86 行が参照**しており（`docs/progress/M25-RESEARCH-01-report.md` の 1 ファイルだけで **42 行**）、**歴史記録は編集できないので参照切れを直せない**。**★どの機械検査も捕まえない** — `check-doc-refs.sh` の走査範囲は `CLAUDE.md` / `web/CLAUDE.md` / `.claude/rules/` / `.claude/commands/` だけで、抽出はリポジトリ相対のフルパスのみ。参照はほぼ裸のファイル名なので **1 件も検出されない** |
| 2 | **`docs/audits/<日付>-*.md` の 3 行を書き換えた** | 根拠パスの追随のため。**歴史記録として扱うかの線引きが指示書に無い**。⇒ §4 へ |
| 3 | **`check-import-order.sh` と `check-md-emphasis.sh` のベースラインを動かさなかった** | どちらも着手基点から NG / ドリフト済みで**本サブ由来ではない**。本サブの成果でない改善を本サブの手番で床にすると、実際に減らした変更の記録が失われる |
| 4 | **他プロジェクト参照 206 出現を置換対象外にした** | `combomgr-importer`（FR701 の別リポジトリ）／ `autopilot-combomgr`。**本アプリの名前ではない** |

---

## 4. 設計担当が未把握の残課題・申し送り

**★`followup-backlog.md` の本表は製造が編集しない**＝`D-382`。**以下は設計卓が迷わず畳める形で書く。**

| スラッグ | 何が起きるか | 根拠 | 割付候補と理由 | 新規/更新 |
|---|---|---|---|---|
| `design-docs-still-say-combomgr` | **`docs/design/` 2 ファイル・35 出現が旧名のまま。** とくに `02-architecture.md:71` の「本書内の `combomgr.exe` / `combomgr` は仮称である」という**注記そのものが失効**しており、放置すると後任が「名前はまだ仮」を前提に複製する。ほかにリリースアーカイブ構成 `:1197`〜`1202` ／ Cookie 名 `:703` ／ 環境変数 4 本 `supp-001:1094` `:1160`〜`1162` が**実装と食い違っている** | 完了報告 §5.2 の全行 | **設計卓・CHANGE 1 本**。製造は `docs/design/` を編集しない契約 | **新規** |
| `datadir-copytree-drops-dir-permissions` | **移行がディレクトリのパーミッションを保存しない。** `copy.go:51-52` が `os.MkdirAll(target, 0o755)` 固定であるのに対しファイルは `info.Mode().Perm()` で保存する。⇒ 実データの `backups/` が **700 から 755 へ緩んだ**。中のファイルは 600 のままなので読まれはしない | `internal/infra/datadir/copy.go:51-52` ／ 実測＝完了報告 §7-4 | **改善レーン**。直すなら `MkdirAll` の後に `os.Chmod`。**`MkdirAll` に権限を渡すだけでは umask で削られるので一行では済まない** | **新規** |
| `datadir-migrated-dir-perm-differs-from-fresh-install` | **移行してきた環境だけ新データディレクトリが 700 になる。** staging を `os.MkdirTemp`（0700 固定）で作りリネームして確定させるため。**新規インストールは `MkdirAll(dir, 0o755)` で 755**。厳しい側なので実害は無いが、経路によって差が出る | `migrate.go:164` ／ レビュー 低-3（不採用・把握目的で残す）／ 実測＝完了報告 §7-4 | **改善レーン**。★上と併せて 1 手番で | **新規** |
| `notice-acknowledgedat-omitempty-inert` | **`Notice.AcknowledgedAt` の `omitempty` が効いていない。** `encoding/json` の `omitempty` は `time.Time` のような構造体に作用しないため、常に `0001-01-01T00:00:00Z` が書かれる。読み戻しは正常。フロントの DTO は当該フィールドを持たないので影響ゼロ | `internal/infra/datadir/notice.go` ／ 実測＝完了報告 §7-4 | **改善レーン**。1 行 | **新規** |
| `check-doc-refs-misses-bare-filename-references` | **`check-doc-refs.sh` が裸のファイル名の参照を 1 件も検出しない。** 走査範囲は `CLAUDE.md` / `web/CLAUDE.md` / `.claude/rules/` / `.claude/commands/` の 4 つだけで、抽出正規表現はリポジトリ相対のフルパスのみ。**⇒ `docs/` 配下でファイルを改名しても、約 86 行が黙って壊れて誰も気づかない。** `check-doc-inventory.sh` も `docs/human-notes/` を走査しない | `scripts/check-doc-refs.sh` L9・L45・L165-168 ／ 実測＝完了報告 §10.3 | **改善レーン**（**`scripts/` を触るので並走が解けている手番**＝`D-335`） | **新規** |
| `codex-skill-rename-unverified` | **改名した skill を Codex が読めるか未確認。** `.agents/skills/tacpendium-manufacturing-workflow/` へ移し `SKILL.md` の `name:` も揃えたが、**本セッションに Codex が無く実機確認できていない**。`sync_codex_config` も走らせていない | 完了報告 §7-3 の 4 ／ §8.1 | **開発者**（次に Codex を起動する手番） | **新規** |
| `usermanual-filename-still-combmgr` | `docs/usermanual/combmgr-friend-readme.html` の**ファイル名**が旧名のまま。本文は直した | 完了報告 §8 手番 4 | **開発者**（`docs-map` / `cleanup_docs` の参照元を追う要あり＝`D-196` 境界条件 3） | **新規** |
| `readme-txt-placement` | `README.txt` の置き場。**二重ではなく役割が違う**ことは実査済みで、**3 つの独立した根拠が必須成果物と定めている**（`nightly-crossbuild.yml:109-112` ／ `02-architecture.md:1199` ／ `cmd/tacpendium/main.go:447`）。案 3 つは完了報告 §6 | 完了報告 §6 | **開発者**（移動は `D-196` 境界条件 3） | **新規** |
| `windows-firewall-rule-name-changed` | **`README.txt:77` が案内する Windows ファイアウォール規則名を `"CombMgr"` から `"Tacpendium"` へ変えた。** 既に古い名前で規則を作っている利用者には**使われない規則が残る**。削除の案内を足すかは判断が要る | `README.txt:77` ／ 完了報告 §6 末尾 | **開発者** | **新規** |
| `query-keys-convention-test-blind-to-constant` | `query-keys.convention.test.ts` が「定数へ逃がした形」を検出できない | レビュー報告末尾の 4 件のうち 2 | **改善レーン** | **新規** |
| `app-name-hardcoded-outside-constants` | `internal/api/comboio/handler.go:62` と `web/src/components/Header.tsx:68` にアプリ名が直書き。**本サブでは定数化していない**（完了報告 §4.2「報告のみ」） | 同 3 | **改善レーン** | **新規** |
| `claude-md-repo-root-notation` | `CLAUDE.md` §3 のディレクトリ概略がリポジトリルートを `tacpendium/` と書くが、**開発リポジトリのチェックアウト名は `combomgr` のまま**。公開ミラー側の姿を先取りした記述である旨を 1 行添えるか、開発リポジトリ名に合わせるか | レビュー 低-5（**不採用＝設計卓・開発者の手番**）／ 同 4 | **設計卓** | **新規** |
| `docs-audits-historical-record-boundary` | **`docs/audits/<日付>-*.md` を歴史記録として扱うかの線引きが無い。** 本サブは根拠パスの追随のため 3 行書き換えた | レビュー報告末尾の 4 件のうち 1 | **設計卓**（線引きの裁定） | **新規** |
| `md-emphasis-baseline-per-lane-drift` | **`check-md-emphasis.sh` は着手基点から 436 → 431 へドリフト済み。`check-import-order.sh` は着手基点から NG（102 / 101）。どちらも本サブ由来ではない**ためベースラインを動かさなかった | 完了報告 §3.3 ／ レビュー 低-4（**5 本は変更したが import 行は 1 行も動いていない**） | **改善レーン**。★既存行 `md-emphasis-baseline-per-lane-drift` へ「M28-01 時点で 431」を追記する形が自然 | **★既存行の更新** |

**★停止時記録（§J）は不要。** 再レビュー往復 0 回・タイムボックス未達・「高」の不採用 0 件。

---

## 5. 参考（触れていない＝不変の証跡）

- **歴史記録 1150 出現 / 229 ファイルが 0 差分**: `git diff --stat fae8118 -- docs/change-notes docs/handover/design-reports docs/instructions/phase{1,2,3} docs/process/parallel-board.md docs/process/archive docs/design docs/human-notes/archive` が空
- `docs/human-notes/` の**改名 0 件**: `git diff --name-status fae8118 -- docs/human-notes | grep '^R'` が空
- 他プロジェクト参照 206 出現が不変: `git grep -c -E 'combomgr-importer|autopilot-combomgr'`
- マイグレ消費 0: `ls migrations/` の最大が `000102` のまま
- 検証層の不変テスト: `TestVerify_DetectsRowCountMismatch` / `…MissingTable` / `…IgnoresSqliteInternalTables` / `…UserVersionMismatch`
- 4 経路の不変テスト: `TestMigrate_A_OldOnly` / `TestMigrate_B_BothExist` / `TestMigrate_C_NoLegacyDir` / `TestMigrate_D1_RowCountMismatch_MovesNothing` / `TestMigrate_D2_CorruptCopy_MovesNothing` / `TestMigrate_D3_VerifyFailsWithPendingWAL_OldDataStillReadable`
- 全数緑: `go test ./...` ／ `pnpm test` 2381 件 ／ `make e2e` 239 passed
- 常設検査 9 本緑（`check-artifact-integrity` を 1 本目に実行）

---

## 6. CHANGE 起票のたたき台（設計担当向けチェックリスト）

**番号は起票時に registry で採番する。★製造は自採番していない**＝`D-293`。

**宛先は 2 本**: `DES-002`（`02-architecture.md`）／ `SUPP-001`（`supp-001-detailed-design.md`）。

| # | 反映先 | 内容 |
|---|---|---|
| 1 | `DES-002` §（冒頭注記） | **`:71` の「本書内の `combomgr.exe` / `combomgr` は仮称である。プロジェクト名は完成時に確定させる」を削除または確定済みへ改める。★ここが改訂の起点** |
| 2 | `DES-002` `:25` `:76` `:1269` `:1271` | 構成図・シーケンス図・ディレクトリ構成の `combomgr.exe` / `cmd/combomgr/` → `tacpendium` 系 |
| 3 | `DES-002` `:1197`〜`1202` | **リリースアーカイブ構成**を `tacpendium-windows-amd64.zip` / `tacpendium.exe` / `tacpendium-macos-arm64.tar.gz` / `tacpendium-linux-amd64.tar.gz` へ（Makefile / CI の実物と一致させる） |
| 4 | `DES-002` `:703` | Cookie 名 `combomgr_session` → **`tacpendium_session`** |
| 5 | `DES-002` `:769` ／ `SUPP-001` §5.8 | データディレクトリ `%APPDATA%\combomgr\` → `…\tacpendium\`。**あわせて自動移行の存在と §1-2 / §1-3 / §1-4 を明文化** |
| 6 | **`DES-002` §4.2 経路表** | **新設 API 2 本を追加**（`GET /api/notices/data-migration` ／ `POST /api/notices/data-migration/ack`）。**契約は本レポート §1-1 が as-built** |
| 7 | `SUPP-001` `:624` `:626` | §5.2 Go 側ディレクトリ構成のルートと `cmd/combomgr/` → `cmd/tacpendium/` |
| 8 | `SUPP-001` `:1090` `:1091` `:1213` | §5.6 ロギングの出力先 `logs/combomgr.log` → `logs/tacpendium.log` |
| 9 | `SUPP-001` `:1094` `:1160`〜`1162` | §5.8 環境変数 **4 本すべて** `COMBOMGR_*` → `TACPENDIUM_*` |
| 10 | `SUPP-001` `:1178`〜`1180` `:1186` | §5.8 設定ファイル書式の OS 別 DB 既定パス 3 行と `logging.file` |
| 11 | `SUPP-001` `:21` `:579` `:584` `:587` | 更新履歴と実装メモの本文。**当時の記録に近いので改訂するかは設計卓の判断** |
| 12 | 指示書 or `DES-002` | **§2-3 の解釈 2 件を明文化する**（指示書本文は依然として旧の逐語のまま） |

**★★置換してはならない 2 件**（`02-architecture.md:882` / `:918` の `combomgr-importer`）。**FR701 の別リポジトリの名前であり、本アプリの名前ではない。**

**マイグレ連番**: **消費 0 本。** 着手時に `ls migrations/` を実査して最大が `000102` であることを確認し、**払い出していない**。ボード §2.2 の「次に払い出す番号 `000103`」は不変。

---

## 7. 教訓（retrospective 行き）

**★親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映で、**実施者は設計担当**（反映担当は 2026-08-11 に廃止）。

1. **「1 つの綴りだけを数えない」に正面から失敗した。** 区分表は正規表現 `comb[o]?[-_ ]?mgr` で数え、綴り内訳は綴りを列挙していたため、**両者が別の集合を数えていた**（`combmgr` 329 件を落とした）。**⇒ 母数は「全綴りを 1 本のパターンで拾い、パスで排他的に振り分け、未分類を表に出す」形で数える。残差 0 が網羅性の証拠になる。**

2. **`go build` も `go test` も `pnpm test` も `tsc` も緑のまま、E2E だけが取りこぼしを捕まえた。** `web/playwright.config.ts:136` の `go run ./cmd/combomgr` が未修正で、1 回目の `make e2e` が全滅した。**⇒ TypeScript の文字列リテラルの中に在るパスは型検査の対象ではない。ディレクトリを動かす変更では、E2E を通すまで緑を信用しない。**

3. **★★同じ形の誤りを、是正の手番で作り込んだ。** 完了報告 §2 の数字を「全行を再実測した」と書いて是正したが、実際には歴史記録の内訳だけを数え直し、その下の行は元の値を引き写していた（2 件が誤ったまま残った）。**⇒ 「再実測した」と書くときは、書いた範囲と実測した範囲が同じであることを、書く前に確かめる。**

4. **★★説明文が「緑のまま壊れる」を作りうる。** `devcontainer.json` と完了報告に「`source` は変えていないのでリビルドすれば既存 dev データはそのまま新パスに現れる」と書いたが、**ファイルは現れてもアプリは開かない**（DB のファイル名も変わっているため）。しかも `Decide` / `CheckStranded` / `NoticeFor` の 3 段とも空振りし、**無言で空のアプリが立ち上がる**。**⇒ 移行の説明は「ファイルがどこに現れるか」ではなく「アプリが何を開くか」で書く。**

5. **行数ではなく「どの関数を通るか」でテストの空白を見る。** `datadir` の 683 行のテストは `prepareDataDir` を 1 度も通っておらず、フロントは全層で未実行だった。**レビューが出した実バグ 2 件はどちらもそこから出た。**

6. **ベースライン固定型の検査は、自サブ由来でないドリフトを自サブの手番で床にしない。** 実際に減らした変更の記録が失われる。

7. **★機械検査の緑は無罪の証明ではない。** `check-doc-refs.sh` は走査範囲が 4 ファイル群だけで抽出もフルパスのみのため、`docs/` 配下のファイル改名で壊れる約 86 行を **1 件も検出しない**。**⇒ 「検査が緑だから安全」と書く前に、その検査が何を見ているかを読む。**
