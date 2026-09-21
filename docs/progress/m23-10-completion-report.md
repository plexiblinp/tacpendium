# M23-10 完了報告: `P-04` の根治（FK をプール全体で有効にする ＋ 回帰ゲート）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M23-10-foreign-key-enforcement-root-fix.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-10-review-checklist.md` v1.0.0 |
| 実施 | 製造担当 Claude Code / 2026-08-24 |
| ブランチ | `claude/m23-10-implementation-plan-cpspyh` |
| 結果 | **`go test ./...` 53 パッケージ green（FAIL 0）／ `pnpm test` 182 files・1829 tests green ／ `make e2e` 175 passed・FAIL 0 ／ `tsc --noEmit` 緑 ／ `gofmt` `go vet` 緑** |
| 消費 | **マイグレーション 0 本 ／ CHANGE 0 件 ／ 新規依存 0 件 ／ `web/src` 0 バイト** |

> **★本サブの本体は約 5 行の DSN 変更ではない。** 成果物は「その 5 行が戻されたことを検出し続けるテスト」である。
> **★そのテストは書き方を 1 つ間違えると壊れた実装のままでも緑になる。** 破壊確認 2（§3）でその事実を実証した。

---

## 1. §3.3 着手前の実査 7 件（走査コマンドと件数付き）

### #1 ★★実 DB に在る orphan を、FK=ON の接続で触ったときに何が起きるか — **落ちる経路は無い**

**★設計卓は見立てを持たなかった項目であり、外れていれば §9.1-4 で停止する対象だった。**

**まず実 DB がこの実行環境に無いことを確認した**（クラウド実行環境はリポジトリのクリーンクローンであり、利用者の DB を持たない）。

```bash
$ find / -name "*.db" -path "*combomgr*" 2>/dev/null | head
（0 件）
$ ls -la ~/.local/share/combomgr 2>/dev/null
（存在しない）
```

**⇒ 実 DB そのものは触れない。代替として、実 DB が orphan を得たのと同じ経路を再現した。**
素の接続（`sql.Open` ＋ `SetMaxOpenConns(1)`、FK=OFF）で親コンボだけを消し、`combo_steps` 3 件 / `combo_oki_options` 2 件 / `combo_tags` 1 件の orphan を作ってから、**FK=ON の `db.Open` 接続で** それらを触る。

実装は `internal/infra/db/fkbehavior_test.go` の `TestOrphanRows_SurviveForeignKeysOn`（**★実査を恒久テストとして残した**）。

| 操作 | 結果 |
|---|---|
| orphan の `SELECT` | **落ちない** |
| orphan の **FK 列を触らない `UPDATE`**（`combo_steps.modifiers` / `combo_oki_options.tech_type`） | **落ちない** |
| orphan の **FK 列を有効な親へ再ポイントする `UPDATE`** | **落ちない** |
| orphan の `DELETE`（`combo_steps` / `combo_oki_options`） | **落ちない** |
| orphan が残る表への **正常な `INSERT`** | **落ちない** |
| **対照: 実在しない親を指す `INSERT`** | **★FK 違反で落ちる（＝FK は本当に効いている）** |

```
$ go test ./internal/infra/db/ -run TestOrphanRows_SurviveForeignKeysOn -count=1 -v
    fkbehavior_test.go:143: ★仕込んだ orphan: combo_steps=3 / combo_oki_options=2 / combo_tags=1
--- PASS: TestOrphanRows_SurviveForeignKeysOn (0.47s)
    --- PASS: .../orphan_のSELECTは落ちない (0.00s)
    --- PASS: .../orphan_のFK列を触らないUPDATEは落ちない (0.00s)
    --- PASS: .../orphan_のFK列を有効な親へ再ポイントするUPDATEは落ちない (0.00s)
    --- PASS: .../orphan_のDELETEは落ちない (0.00s)
    --- PASS: .../orphanが残る表への正常なINSERTは落ちない (0.00s)
    --- PASS: .../対照_実在しない親へのINSERTはFK違反で落ちる (0.00s)
```

**理由（推測ではなく SQLite の仕様）**: SQLite は接続時に既存行を検査しない。`UPDATE` の FK 検査は **子キー列が変更されたときにだけ**発火する。`DELETE` は子行側の操作であり、自分の FK を破ることがない。**⇒ 溜まった orphan は「触っても落ちない」まま静かに残る。**

**★対照ケースを置いた理由**: 上の 5 件が全部通るだけでは「FK が効いていないから通った」と区別がつかない。実在しない親への `INSERT` が落ちることで、**FK が効いている状態でこれらが通っている**ことを主張している。

**★ただし限界を明記する。** 本テストが再現したのは実 DB と**同じ形の** orphan であって、実 DB の 19 件そのものではない。言えるのは「この形の orphan は FK=ON でも落ちない」までである。

---

### #2 現行実装で FK が有効な接続の数 — **16 本中 1 本（見立てと完全一致）**

**同時に 16 接続を張って**（1 本も返さずに掴んだまま）各接続の PRAGMA を読んだ。実装は `TestOpen_AllPooledConnectionsHaveAppPragmas`。

```
$ go test ./internal/infra/db/ -run TestOpen_AllPooledConnectionsHaveAppPragmas -count=1 -v   # ★DSN 化する前
    fkgate_test.go:110: 同時に張った 16 接続のうち 15 本でアプリ標準 PRAGMA が効いていない:
          接続  1: foreign_keys=0(want 1) / busy_timeout=0(want 5000) / synchronous=2(want 1=NORMAL)
          接続  2: foreign_keys=0(want 1) / busy_timeout=0(want 5000) / synchronous=2(want 1=NORMAL)
          （…接続 3〜15 まで同一…）
--- FAIL: TestOpen_AllPooledConnectionsHaveAppPragmas (0.00s)
```

| 実装 | FK=OFF の接続数 |
|---|---:|
| **DSN 化前（現行）** | **16 本中 15 本**（設計卓の見立てと一致） |
| **DSN 化後** | **16 本中 0 本** |

**★指示書の見立てを超えた発見が 1 件ある。** 指示書と実現可能性レポートは `foreign_keys` だけを数えていたが、**`busy_timeout` と `synchronous` も同じ 15 本で効いていなかった。**
`busy_timeout=0`（既定）は WAL 下の書き込み競合で `SQLITE_BUSY` を即座に返す設定であり、`synchronous=2`（FULL）は既定より遅い。**⇒ `P-04` は FK だけの問題ではなかった。**
**`journal_mode` だけは全 16 接続で `wal` だった** —— DB 単位で永続化される設定だからであり、指示書 §4.1-2 の性質分類（`journal_mode` のみ DB 単位）を実測が裏づけている。
**⇒ 回帰ゲートは 4 つとも検査する形にした**（FK だけを守ると、同じ形で戻された残り 3 つを取り逃がす）。

---

### #3 接続を開く関数の呼び出し元の全数 — **マイグレーションは本サブの経路を通らない（見立てと一致）**

```bash
$ grep -rn "db\.Open(" --include=*.go .
./internal/infra/migration/migrate.go:40:  // マイグレーションは main.go の db.Open(親ディレクトリ作成)より前に走るため、   ← コメント内の言及
./internal/testutil/dbtest/dbtest.go:33:	conn, err := db.Open(dbPath)
./internal/testutil/dbtest/dbtest.go:53:	conn, err := db.Open(dbPath)
$ grep -rn "dbinfra\.Open(" --include=*.go cmd/
cmd/combomgr/main.go:117:	sqlDB, err := dbinfra.Open(dbPath)
```

**`dbinfra.Open` の実呼び出し元は 3 か所**（本番 1 ＝ `cmd/combomgr/main.go:117`、テストヘルパ 2 ＝ `dbtest`）。

```bash
$ grep -rn 'sql\.Open(' --include=*.go internal/infra/migration/ | grep -v _test
internal/infra/migration/migrate.go:55:	db, err := sql.Open("sqlite", dbPath)
```

**★`migration.Run` は `db.Open` を通らず独自に `sql.Open` している**（実物で確認）。**⇒ 表を作り直すマイグレーション（`000016` / `000019` / `000028`）は今までどおり FK=OFF で走る。** 本サブの前提は崩れていない（チェックリスト N-8 の意図どおり）。

**★あわせて棄却した代替案を記録する。** `modernc.org/sqlite v1.50.0` には `RegisterConnectionHook`（`sqlite.go:530`）が在り、接続ごとに PRAGMA を流す別解になりうる。**しかし同関数はパッケージ全体のシングルトン `Driver` に登録するため、`migration.Run` の `sql.Open("sqlite", ...)` にも掛かってしまう。** ⇒ 本項の前提（マイグレーションは FK=OFF）を壊すので採らなかった。**DSN 化が正しい手段である。**

---

### #4 DB ファイルのパスに `?` や `#` が含まれうるか — **含まれうる（見立てと一致）／★現行実装では既に壊れていた**

`internal/config/config.go:243` `ValidateDataPath` が検査するのは 2 点だけである。

1. `filepath.Clean` 後に `..` 要素を含むパスの拒否
2. 絶対パスをアプリ既定データディレクトリ／カレントディレクトリ配下に制限

**⇒ `?` `#` `%` は 1 文字も禁止していない。** 加えて `COMBOMGR_DB_PATH` 環境変数（`config.go:22`）でも任意パスを与えられる。

**★見立てを超えた発見**: ドライバ実装（`modernc.org/sqlite@v1.50.0/conn.go:44`）は DSN を **最初の `?`** でパスとクエリに割り、**`file:` 接頭辞が無い場合はパス側を `dsn[:pos]` に切り詰める**。
**⇒ `?` を含むパスは、DSN 化する前の実装でも既に壊れていた**（別名の DB ファイルが黙って作られる）。本サブはこれを直した側である。

対処は §2.2、テストは §4-4。

---

### #5 実行時に「親を消す」経路の全数 — **4 経路（見立てと一致）**

```bash
$ grep -rhoE "DELETE FROM [a-z_]+" --include=*.go internal/ | grep -v _test | sort | uniq -c | sort -rn
      7 DELETE FROM preset_aliases
      6 DELETE FROM combo_setups
      6 DELETE FROM combo_setup_results
      4 DELETE FROM combos
      3 DELETE FROM setup_steps
      3 DELETE FROM presets
      （…以下略。全 17 種…）
      1 DELETE FROM tags
      1 DELETE FROM setups
      1 DELETE FROM moves
```

FK の親になる表に絞った結果:

| 親 | 場所 | 子行の扱い | FK=ON にすると |
|---|---|---|---|
| `combos` | `internal/repository/combo/repository.go:1198` | 明示削除 7 表 ＋ self-FK 2 本の NULL 化（`M23-08`） | 影響なし |
| `setups` | `internal/repository/setup/restore.go:189` | 明示削除 4 表（`M23-02`） | 影響なし |
| `presets` | `internal/repository/preset/queries.go:154` | 明示削除（`deleteAliasesByPresetSQL`） | 影響なし |
| **`tags`** | `internal/repository/tag/repository.go:197` | **明示削除なし。CASCADE 頼み** | **★正しく CASCADE が発火するようになる＝直る側** |

**`internal/seedgen/generate.go:306` の `DELETE FROM moves` は実行時経路ではない** —— コード生成器がマイグレーション SQL の文字列として出力するものであり、マイグレーション内（FK=OFF）で走る。**実現可能性レポートの記述を実物で再現できた。**

---

### #6 ★`P-04` を根拠に「保証されない」と書いている記述の全数 — **明示参照 23 件 ＋ 同型記述 70 件**

**設計卓は件数の見立てを持たなかった項目。2 段で走査した。**

**走査 A（`P-04` の明示参照）**

```bash
$ grep -rn "P-04" --include=*.go --include=*.ts --include=*.tsx --include=*.sql internal/ cmd/ web/ migrations/ | grep -v node_modules | wc -l
23
```

**★`web/src` は 0 件**（画面側に `P-04` を根拠にした記述は無い）。

**走査 B（`P-04` の文字列を持たない同型記述）** —— **★A だけでは足りない。番号を引かずに同じ主張をしている箇所がある。**

```bash
$ grep -rnE "接続単位|接続プール全体|プール中の|FK=OFF|FK が効|foreign_keys (は|が)" \
    --include=*.go --include=*.ts --include=*.tsx --include=*.sql internal/ cmd/ web/ migrations/ \
    | grep -v node_modules | grep -v "P-04" | grep -vE "PRAGMA foreign_keys\"|pragma_foreign_key" | wc -l
70
```

**判定の内訳**（1 件ずつ内容を読んで分類した。機械的な置換はしていない）:

| 分類 | 件数の目安 | 扱い | 例 |
|---|---|---|---|
| **失効した「CASCADE は発火しない」型** | 実装 9 ファイル | **記述は残し、「効かないことがある」→「`M23-10` で効くようになったが、二重の保険として明示削除も残している」へ改めた** | `repository/preset/queries.go` / `repository/combo/repository.go` / `service/preset/service.go` / `repository/setup/restore.go` ほか |
| **失効した「自動削除される」型** | 1 件 | **「`M23-10` で初めて成り立つようになった」と読める形へ改めた** | `repository/tag/repository.go:195` |
| **失効した「接続ごとに変わりうる」型（テスト）** | 4 件 | **改めた。`t.Logf` で「実行ごとに変わりうる」と出していた箇所は、FK=1 を主張する `t.Errorf` へ置き換えた** | `service/preset/service_test.go` / `repository/preset/write_repository_test.go` |
| **生接続（`sql.Open`）を自前に開くテストの記述** | 3 ファイル | **★残す（内容は今も正しい）。** 「`db.Open` 経由は `M23-10` 以降すべて FK=ON」「本テストは自前に生接続を開くので影響を受けない」を添えた | `repository/combo/hard_delete_children_test.go` / `service/combo/setup_results_carry_test.go` / `migration/migrate_m2301_test.go` |
| **マイグレーション経路の記述** | 多数（`migrations/*.sql` の大半） | **★残す。** マイグレーション接続は今後も FK=OFF であり、記述は今も正しい。`migrate_head_test.go` だけは前段の「プール全体に効かず」が失効するため改めた | `migrations/000021` / `000029` / `000044` / `000049` ほか |
| **実装の性質を述べている記述** | 2 件 | **★残す。** 「`FK=OFF` の接続でも消える」は実装の性質であり今も正しい | `repository/setup/setup_results_test.go:268` ほか |
| **★適用済みマイグレーション本文** | **1 件** | **★編集していない。** 理由は §7 | `migrations/000078_add_combos_superseded_by.up.sql:8` |

**★「N か所」と書いたコメントは 1 件も増減させていない**（`M23-07` 教訓 7-1）。

---

### #7 接続文字列に載せる PRAGMA の現在の一覧 — **4 つ（見立てと一致）**

DSN 化前の `internal/infra/db/db.go:38-43`:

```go
pragmas := []string{
    "PRAGMA journal_mode = WAL",
    "PRAGMA foreign_keys = ON",
    "PRAGMA busy_timeout = 5000",
    "PRAGMA synchronous = NORMAL",
}
```

**⇒ §4.1-2 の判断どおり 4 つとも接続文字列へ移した。** 理由はコードに書き残してある（§2.1）。

---

## 2. as-built の最終形

### 2.1 `internal/infra/db/db.go` — PRAGMA の適用経路

**プール確立後の `conn.Exec` ループを撤去し、接続文字列で指定する形へ移した。**

```go
const dsnPragmaParams = "_pragma=busy_timeout(5000)" +
	"&_pragma=foreign_keys(1)" +
	"&_pragma=journal_mode(WAL)" +
	"&_pragma=synchronous(NORMAL)"
```

**★「なぜ 4 つとも移すのか」「なぜ `Exec` ではないのか」をコードのコメントに書き残した**（指示書 §4.1-2・チェックリスト §1 の必須項目）。要旨:

- **4 つとも移す理由**: 接続の開き方を 1 か所に集めるため。`journal_mode` は DB 単位で永続化される設定であり接続ごとに指定しても意味が変わらないが、**性質の違いは承知のうえで「指定箇所を割らないこと」を優先した。1 つずつ元へ戻さないこと。**
- **`Exec` ではない理由**: PRAGMA は接続単位の設定であり、`*sql.DB.Exec` はプールから 1 本借りて実行するだけである。実測値（16 本中 15 本が OFF）を注記に埋め込んである。
- **この形が戻されたことは `TestOpen_AllPooledConnectionsHaveAppPragmas` が検出する**、と明記した。

**あわせて `Open` の godoc に 3 点を追記した**: (a) プール確立後の Exec へ戻さないこと (b) `SetMaxOpenConns` は設定しない（FK とは独立の論点） (c) マイグレーションは本関数を通らない（意図的な分離）。

### 2.2 パスのエスケープ（**推測で進めた事項**）

**推測: `file:` URI 形式へ寄せ、パスをパーセントエンコードする方式を採ると仮定した**（指示書 §9.2-1 が方式の選択を製造裁量としている）。

```go
func escapeDBPath(dbPath string) string { return (&url.URL{Path: dbPath}).EscapedPath() }
func buildDSN(dbPath string) string     { return "file:" + escapeDBPath(dbPath) + "?" + dsnPragmaParams }
```

**選定理由**:

| 案 | 採否 | 理由 |
|---|---|---|
| **`file:` URI ＋ パーセントエンコード** | **採用** | ドライバは `file:` 接頭辞があるとき DSN 全体を `SQLITE_OPEN_URI` 付きで SQLite へ渡し、SQLite が `%HH` をデコードする。`/` と `:` を素のまま残すため Windows のドライブ文字と区切りを壊さない |
| 生パス ＋ `?` をエスケープしない | 不採用 | ドライバがパスを最初の `?` で切り詰める（＝現行の壊れ方そのもの） |
| `?` を含むパスを `ValidateDataPath` で拒否する | 不採用 | 設定検証の変更であり本サブの射程外。かつ既存利用者の設定を後から弾くことになる |
| `RegisterConnectionHook` | 不採用 | パッケージ全体のシングルトンに登録され、マイグレーション接続にも掛かる（§1-#3） |

**標準ライブラリのみで実装しており、新規依存は 0 件。**

**★残存リスクを明記する。** Windows の `C:\...` 形式は**この実行環境で実挙動を確かめられていない**。テストは DSN 文字列の形（`C:%5CUsers%5C...`）を固定するに留まる。SQLite の URI 解釈上、`file:` の直後が `//` でなければ authority 解析へ入らず、`%5C` はデコードされて `\` に戻るため動作すると判断したが、**実機確認は開発者の手番として残る。**

**★2026-08-24 追記——実機で確認済み。リスクは解消した**（開発者報告。手順と結果は §14.1 / §14.4）。**★上の段落は消さない**——**「未検証だったこと」と「検証して OK だったこと」は別の事実であり、前者を消すと「なぜテストが DSN 文字列の形止まりなのか」が読めなくなる。** **★CI に Windows ランナーが無い状況は変わっていないため、接続の開き方を変える改修が来たら再び実機確認が要る。**

### 2.3 回帰ゲート（**★本体**）

`internal/infra/db/fkgate_test.go` の `TestOpen_AllPooledConnectionsHaveAppPragmas`。

- **16 接続を「先に掴み切って」から** 1 本ずつ読む（指示書 §4.2-2）。
- **アプリ標準 PRAGMA 4 種すべて**を接続ごとに検査する（§1-#2 の発見を受けて FK だけにしなかった）。
- OFF だった接続の **index 一覧と本数**をエラーに出す（破壊確認の出力に「何本落ちたか」が残る）。
- **`SetMaxOpenConns` は呼ばない**（上限が無いからこそ同時要求が別接続になる）。
- **「1 本ずつ取って返す形へ書き換えてはならない」理由をテスト本文のコメントに書いた**（破壊確認 2 が実証した事実）。

---

## 3. ★§5.2 破壊確認 3 件（コマンドと出力）

### 破壊確認 1 — 接続の開き方を現行（旧）の形へ戻す

`Open` を `sql.Open(driverName, dbPath)` ＋ プール確立後の PRAGMA ループへ戻した。

```
$ go test ./internal/infra/db/ -run TestOpen_AllPooledConnectionsHaveAppPragmas -count=1
--- FAIL: TestOpen_AllPooledConnectionsHaveAppPragmas (0.01s)
    fkgate_test.go:110: 同時に張った 16 接続のうち 15 本でアプリ標準 PRAGMA が効いていない:
          接続  1: foreign_keys=0(want 1) / busy_timeout=0(want 5000) / synchronous=2(want 1=NORMAL)
          接続  2: foreign_keys=0(want 1) / busy_timeout=0(want 5000) / synchronous=2(want 1=NORMAL)
          （…接続 3〜15 まで同一…）
FAIL
FAIL	github.com/plexiblinp/combomgr/internal/infra/db	0.011s
```

**期待どおり赤。** 復元後は緑（`git diff` 空を確認済み）。

### 破壊確認 2 — ★★回帰ゲートを「1 本ずつ取って返す」形へ書き換える（**最重要**）

**実装を壊したまま**（＝破壊確認 1 の状態）、ゲートだけを `Conn()` → 読む → `Close()` の繰り返しへ書き換えた。

```
$ go test ./internal/infra/db/ -run TestOpen_AllPooledConnectionsHaveAppPragmas -count=1 -v
=== RUN   TestOpen_AllPooledConnectionsHaveAppPragmas
--- PASS: TestOpen_AllPooledConnectionsHaveAppPragmas (0.00s)
ok  	github.com/plexiblinp/combomgr/internal/infra/db	0.006s
```

**★壊れた実装のまま緑になった。** 同じことを別の形でも確かめてある（着手前の probe。FK=OFF の本数が **0 / 16** と報告された）:

```
$ go test ./internal/infra/db/ -run TestBroken_OneAtATime -count=1 -v   # 一時 probe。採取後に削除
    zz_wrongform_test.go:37: ★1 本ずつ取って返す形での FK=OFF 本数 = 0 / 16
--- PASS: TestBroken_OneAtATime (0.00s)
```

**⇒ 「同時に掴む」が要件であることの実証。** プールは返された接続を再利用するため、常に「唯一 PRAGMA が届いていた 1 本」だけを見ることになり、**16 回読んでも 16 回とも同じ接続を見ている。**

### 破壊確認 3 — 接続文字列から `foreign_keys` の指定だけを落とす

```
$ go test ./internal/infra/db/ -run 'TestOpen_AllPooledConnectionsHaveAppPragmas|TestForeignKeys_CascadeActuallyFires|TestOpen_AppliesPragmas' -count=1
--- FAIL: TestOpen_AppliesPragmas (0.00s)
    db_test.go:35: foreign_keys = 0, want 1 (ON)
--- FAIL: TestOpen_AllPooledConnectionsHaveAppPragmas (0.01s)
    fkgate_test.go:110: 同時に張った 16 接続のうち 16 本でアプリ標準 PRAGMA が効いていない:
          接続  1: foreign_keys=0(want 1)
          （…接続 2〜15 まで同一…）
--- FAIL: TestForeignKeys_CascadeActuallyFires (0.42s)
    fkbehavior_test.go:211: 前提が崩れている: この接続は FK=OFF(0)。M23-10 以降 db.Open 経由の接続は全て FK=ON のはず
FAIL
FAIL	github.com/plexiblinp/combomgr/internal/infra/db	0.437s
```

**期待どおり §5.1-1 と §5.1-2 が赤**（既存の `TestOpen_AppliesPragmas` も赤）。

**★1 点、指示書の期待とのずれを記録する。** §5.1-2（`TestForeignKeys_CascadeActuallyFires`）は「CASCADE が発火しなかった」ではなく、テスト冒頭の `requireForeignKeysOn` ガードで落ちた。**これは意図した設計である** —— ガードが無いと、FK=OFF の接続で「CASCADE が発火しなかった」ことを検出できず、**テストが緑のまま何も検証しない状態**に化ける。**赤くなる事実は指示書の期待どおりであり、落ち方が違うだけである。**

**★復元の確認**（3 件とも `git diff --stat` が空になることを確認してから次へ進んだ。`git checkout` / `git restore` は `CLAUDE.md` §10 の禁止操作のため、退避しておいた原本を書き戻す形で復元した）。

---

## 4. §5.1 テスト要件 4 件の対応

| # | 要件 | 実装 |
|---|---|---|
| **1** | **プールへ複数接続を同時に張り、すべてで FK が有効** | `fkgate_test.go` `TestOpen_AllPooledConnectionsHaveAppPragmas`（★4 種の PRAGMA すべてを検査） |
| 2 | FK が有効な接続で、親を消すと子が消える（**挙動**の主張） | `fkbehavior_test.go` `TestForeignKeys_CascadeActuallyFires`（`DELETE FROM tags` → `combo_tags` が消える。**★実行時 4 経路のうち CASCADE に依存している唯一の経路を選んだ**。あわせてコンボ側が無傷であること＝CASCADE の向きも主張） |
| 3 | 明示削除が残っている経路で二重に消しても落ちない | `fkbehavior_test.go` `TestExplicitChildDeleteThenParent_NoError`（Tx 内で子を明示削除 → 親を削除 → `Commit` まで通ることを主張） |
| 4 | DB パスに `?` を含めても接続できる | `dsn_test.go` `TestOpen_PathWithSpecialCharacters`（`?` `#` `%` 空白 非 ASCII の 5 ケース。**★DB ファイルが指定パスそのものに作られることまで主張** = 切り詰めの検出）＋ `TestBuildDSN`（8 ケースのテーブル駆動） |

**追加で 1 本置いた**（指示書が求めていないもの）: `TestOrphanRows_SurviveForeignKeysOn`（§1-#1）。**実 DB を持たない環境でこの経路を再現できる唯一の形であるため恒久化した。**

---

## 5. §4.4 否定形確認（**5 件すべて**）

1. **`tag.Delete` の明示削除化をしていない。** `internal/repository/tag/repository.go:197` は `DELETE FROM tags` 1 文のままであり、子行の明示削除を足していない（§1.5-1。**D-494** ＝ 揃えること自体は無償ではない）。
2. **既存の orphan を 1 件も消していない。** 実 DB がこの実行環境に無いため触れておらず、掃除 SQL の実行もしていない。**★`combo_tags` の orphan 1 件が生む実害は解消していない**（詳細は §6）。
3. **接続数の上限（`SetMaxOpenConns`）を設定していない。** `db.Open` に該当呼び出しは無い（回帰ゲートのテスト内でも呼んでいない —— 上限が無いことが「16 本が別接続になる」前提だからである）。
4. **`M23-08` が入れた明示削除を撤去していない。** `internal/repository/combo/repository.go` `HardDelete` の明示削除 7 表 ＋ self-FK 2 本の NULL 化は 1 行も削っていない。`M23-02` の `setup` 側 4 表、`preset` 側も同様。
5. **`PRAGMA defer_foreign_keys` を使っていない。**
   ```bash
   $ grep -rn "defer_foreign_keys" --include=*.go --include=*.sql . | grep -v node_modules
   （0 件）
   ```

---

## 6. ★`combo_tags` の orphan が生む実害は解消していない

**★「直ったように読める報告」を書かないための節である**（指示書 §7.5-4）。

- **本サブは orphan の「供給」を止めた** —— `tags` の削除で `combo_tags` が CASCADE 削除されるようになったため、この経路から新しい orphan は生まれない。
- **★しかし既に溜まった分は消えない。** 実 DB の `combo_tags` orphan 1 件はそのまま残る。
- **⇒ 「タグが `使用 0 件` と表示されているのに、画面からは削除できない」状態は本サブでは解消しない。**
  仕組み: `CountUsage`（`repository/tag/repository.go`）は `combo_tags` を素で数えるため orphan を 1 件として数える → `DeleteTag(force=false)` が `ErrTagInUse` を返す。一方で画面の表示件数は生きたコンボと結合した別経路から来るため `0` を出す。**利用者は `0` を見ているので `force` を立てる導線に入れず、永久に消せない。**
- **★解消には既存 orphan の掃除が要る。** データを消す変更であり開発者の判断である（`CLAUDE.md` §10）。掃除 SQL は `docs/progress/m23-08-completion-report.md` §4.1 に在る。
- 該当 followup: `tag-count-usage-inflated-by-orphan-combo-tags`（**★本サブでは畳んでいない**）。

### ★後日談（2026-08-24・**開発者報告**）

**開発者が本サブとは別の手番で、実 DB の orphan 19 件を掃除した。** **⇒ 上記の実害（タグが `使用 0 件` と表示されるのに消せない）は解消した。**

**★上の本文は書き換えない。** 本サブが解消しなかったことは今も事実であり、**解消したのは掃除という別の手番である。** 2 つを混ぜると「FK を直したら実害も消えた」と読め、**次に同じ状況が起きたとき「根治すれば残骸も消える」という誤った期待を持たせる。** **★FK=ON は供給を止めるだけで、溜まった分は消さない**——これは本サブの中心的な事実である。

| 何が | 誰が | いつ |
|---|---|---|
| orphan の**供給**を止めた（`tags` 削除で `combo_tags` が CASCADE される） | **本サブ（M23-10）** | 2026-08-24 |
| 既に溜まった orphan 19 件を**消した** | **開発者**（実 DB に対して直接） | 2026-08-24 |

**★本セッションは実 DB を持たないため、掃除の結果を検証していない**（`find / -name "*.db" -path "*combomgr*"` が 0 件＝§1-#1）。**上記は開発者報告であり、製造の実測ではない。** **⇒ 実機での確認（「使用 0 件」のタグが実際に消せること）は開発者の手番として残る。**

---

## 7. 契約違反の独自判断（**1 件**）

**★0 件ではない。1 件ある。**

### 判断 1 — `migrations/000078_add_combos_superseded_by.up.sql:8` のコメントを是正しなかった

**該当箇所**（適用済みマイグレーションの本文コメント）:

```sql
--   (ボード P-04)ため連鎖動作は保証されない。実装は「後継が完全削除された旧行がゴミ箱へ
```

**指示書 §4.3 は「`P-04` を根拠に書かれた記述のうち失効するものを是正する」と定めており、本記述は失効する側に当たる。** それでも編集しなかった。

**理由**:
1. **適用済みマイグレーションは歴史的記録である。** 実行済みの利用者の DB では、そこに書かれた前提のもとで既に実行が終わっている。本文を後から書き換えると、記録と実行の対応が崩れる。
2. `CLAUDE.md` §10 がマイグレーションの取り扱いを保守的に定めている。**コメントのみの変更は動作に影響しない**（`golang-migrate` はチェックサムを持たない）が、**「適用済みマイグレーションは編集しない」という運用の線をコメントの都合で越えるべきではないと判断した。**
3. **同じ内容の失効は、実装側で是正済みである** —— `internal/repository/combo/repository.go` の `HardDelete` が同じ論点を扱っており、そちらに「`M23-10` で全接続が FK=ON になり SET NULL も発火するようになったが、明示 NULL 化は二重の保険として残す」と書いた。**⇒ 現役のコードを読む経路では失効した記述に当たらない。**

**★覆る場合の手戻りは 1 行の書き換えのみである。** 設計卓・開発者が「マイグレーション本文も直す」と判断するなら、そのとおりにできる。

**★同型の記述は `migrations/` に多数あるが、その大半は失効していない** —— マイグレーション接続は今後も FK=OFF であり、記述は今も正しい（§1-#6）。

**★★2026-08-24 訂正（レビュー 高-2 を受けて）** —— 初版は「失効しているのはこの 1 件だけである」と書いていたが、**誤りである。マイグレーション本文の失効記述は 2 件ある。**

| # | 箇所 | 記述 | 失効しているのはどこか |
|---|---|---|---|
| 1 | `migrations/000078_add_combos_superseded_by.up.sql:8` | `PRAGMA foreign_keys が接続単位である(ボード P-04)ため連鎖動作は保証されない` | **全体が失効**（`db.Open` 経由では連鎖する） |
| 2 | **`migrations/000049_add_moves_frame_cost_columns.up.sql:37`** | `PRAGMA foreign_keys は接続単位の設定であり、接続プール全体には効かない。` **／ 次行** `さらにマイグレーション接続は FK=OFF である（000044 の down に明記）。` | **★前段のみ失効。次行（マイグレーション接続は FK=OFF）は今も正しい** |

再走査（`grep -rn "接続プール全体" migrations/` は 1 件、`000078` は別の言い回しのため文字列一致では拾えない）:

```bash
$ grep -rn "接続プール全体" migrations/
migrations/000049_add_moves_frame_cost_columns.up.sql:37:--     PRAGMA foreign_keys は接続単位の設定であり、接続プール全体には効かない。
$ grep -n "P-04" migrations/*.sql
migrations/000078_add_combos_superseded_by.up.sql:8:--   (ボード P-04)ため連鎖動作は保証されない。実装は「後継が完全削除された旧行がゴミ箱へ
```

**★なぜ落としたか**——初版は `P-04` の明示参照（走査 A）から `migrations/` の該当を数え、**同じ主張を別の言い回しでしている `000049` を走査 B の結果から拾い直さなかった。** 走査自体は当てているのに、**1 件ずつ判定する段で落とした（走査漏れではなく判定漏れ）。**

**⇒ どちらも編集しない判断は変えない**（理由は上記 1〜3 と同じ）。**★変えたのは件数の申告である。設計卓は `CHANGE-142` で 2 件とも拾うこと。**

---

## 8. テスト結果（件数付き）

```
$ go test ./... -count=1
ok: 53 パッケージ / FAIL: 0
（トップレベル PASS 1333 本 ／ サブテスト込み PASS 1582 本 ／ FAIL 0）
```

**★着手前は 1557 本（`M23-09` 完了時点）。+25 本はすべて本サブの新規テストである**
（回帰ゲート 1 ／ orphan 1 ＋ サブ 6 ／ CASCADE 1 ／ 二重削除 1 ／ `buildDSN` 1 ＋ サブ 8 ／ 特殊文字パス 1 ＋ サブ 5）。

```
$ cd web && pnpm test
 Test Files  182 passed (182)
      Tests  1829 passed (1829)
```

**★着手前と同一**（`M23-09` 完了時点も 182 files / 1829 tests）。**`web/src` を 1 バイトも触っていないことの裏づけである。**

```
$ make e2e
  175 passed (2.9m)
```

**★着手前と同一（175 passed）。flaky 0 / FAIL 0。**
**`M23-01`〜`M23-08` が足したテストを含め、1 本も落ちていない。**

```
$ cd web && pnpm exec tsc --noEmit    → exit 0
$ gofmt -l .                          → （空）
$ go vet ./...                        → （空）
$ bash scripts/check-enum-sync.sh     → ベースラインどおり(増加なし)
$ bash scripts/check-browser-storage-keys.sh → 台帳 9 件 / 本番コード 8 件・違反なし
```

---

## 9. 変更しなかったものの機械的確認

```bash
$ git diff --stat 184d0ad -- web/src
（空）                                    ← ★画面 0 バイト（指示書 §4.6 / §7.1-5）

$ git diff --stat 184d0ad -- migrations/
（空）                                    ← ★スキーマ・FK 句 未変更（§1.5-4）

$ ls migrations/ | tail -2
000078_add_combos_superseded_by.down.sql
000078_add_combos_superseded_by.up.sql    ← ★末尾は 000078 のまま＝消費 0 本（§4.5 / §7.1-6）

$ git diff --stat 184d0ad -- docs/design/
（空）                                    ← ★設計書本体 未編集（反映は設計卓が CHANGE-142 で行う）
```

---

## 10. `docs/handover/followup-backlog.md` §J へ書いた項目 — **1 件**

| ID（スラッグ） | 内容 |
|---|---|
| **`db-open-file-uri-unverified-on-windows`** | **`file:` URI 形式が Windows で未検証である**（§2.2 の残存リスク）。**Windows 利用者の DB オープン経路そのもの**であり、外すと起動不能になる。必須 5 フィールド（発生元／未解消の理由／再開に必要な条件／記録日・状態）を埋めて登録した。**★失敗した場合の代替案（`buildDSN` に 3 行の分岐で旧挙動へ戻す）も再開条件欄に書いてある。** **★★2026-08-24 に解消**——**開発者が Windows 実機で確認し OK だった**（§14.1）。**§J の状態欄を `完了` へ更新済み**（本文は不変）。 |

**★登録先の判断（レビュー 中-4 が「§J か設計伝達レポート §4 か決めよ」としていた点）**: **§J を選んだ。** 理由——(a) `CLAUDE.md` §10.Y が §J を「未解決事項・あとで判断する」の受け皿と定めており、**製造が直接書けるのは §J だけである**（**D-382**） (b) 本件は設計判断ではなく**実機確認という具体的な作業**であり、設計卓の裁定を待つ性質のものではない (c) `docs/progress/` の 1 行だけでは継続追跡の口が無い、というレビューの指摘に応えるため。**あわせて §12-6 から索引している**（本文は複製していない＝§J の作法）。

**★§J 以外の節は編集していない**（**D-382**）。

**★再レビュー往復の上限（2 回）には達していない**（初回レビュー 1 回のみ）。停止規律による停止ではなく、通常の完了である。

---

## 11. 射程の外に在る欠け（**直さずに報告**・指示書 §2.3 / §9.1-2）

1. **`cmd/seedgen/main.go:214,319` に `fmt.Println` が在る。** `CLAUDE.md` §10 は「`console.log` / `fmt.Println` を本番コードに残さない」としているが、**同ファイルは開発者が手で回すコード生成 CLI であり、標準出力への結果表示は正当な用途である。** 欠陥ではないと判断し、記録のみ残す。**本サブは触っていない。**
2. **`config.ValidateDataPath` は `?` `#` `%` を検証していない**（§1-#4）。本サブは接続側でエスケープして通るようにしたが、**設定検証をどうするかは別の論点である。** 変更していない。

---

## 12. 設計卓への申し送り（`CHANGE-142` の材料）

1. **`DES-003` §5 の但し書き**——「宣言された `ON DELETE` は意図の記録であって実挙動の保証ではない」は、**`db.Open` 経由の接続については成り立たなくなった。** ただし**マイグレーション接続は今後も FK=OFF** であり、マイグレーション内では但し書きが生きている。**⇒ 「どの接続の話か」で分ける形が正確である。**
2. **`DES-002` §4.2 の `P-04` 起源の注記**——同上。
3. **`architecture-patterns` §11 の 1 段目**（「SQLite の外部キー強制は接続単位であり、接続プール全体には効かない」）——**「接続プール全体に効く経路（DSN パラメータ等）で入れる」という同節の指示どおりに直した**ことと、**「独立した調査と全テーブルの回帰ゲートが要る」という同節の条件を満たした**ことを反映できる。
4. **★`P-04` は FK だけの問題ではなかった**（§1-#2）。`busy_timeout` と `synchronous` も同じ 15 本で効いていなかった。**ボードの `P-04` 本文が FK だけを挙げているなら、範囲を広げて記録するのが正確である。**
5. **★マイグレーション本文の失効記述は 2 件ある**（§7 の訂正表）。**`migrations/000078:8`（全体が失効）と `migrations/000049:37`（前段のみ失効。次行は今も正しい）。** 製造は適用済みマイグレーションを編集しない判断を採ったため、**設計卓が `CHANGE-142` で 2 件とも拾うこと。**
6. **★開発者の手番は残っていない**（2026-08-24 時点）。**(a) 既存 orphan 19 件の掃除＝実施済み**（§6 後日談） **(b) Windows での `file:` URI 形式の実機確認＝実施済み・OK**（§14.1。`followup-backlog.md` §J の `db-open-file-uri-unverified-on-windows` も `完了` へ更新済み）。**⇒ 本サブに残る手番は設計卓の `CHANGE-142` 反映だけである。**
7. **★手動確認 3 件の手順と結果欄を §14 に置いた。** **設計卓は本報告を読まないため、ここで所在だけ伝える**——**Windows 実機（必須）／実 dev DB での一巡／タグ削除**の 3 件で、**いずれも機械では確かめられない**（CI に Windows ランナーが無い ／ テストと E2E は使い捨て DB で走る ／ orphan 掃除は本サブの外で行われた）。**★結果欄が「未実施」のまま `M23-CLOSE` を迎えたら、そのことを引き継ぎに書くこと。**

---

## 13. ■ 併せて更新が要るもの（常設項目・`E-114` ／ **D-277** ／ **D-297**）

**★該当は 0 件である。以下は「無いことを確かめた」記録である**（節の欠落と、対象が無いことは違う）。

| 確認項目 | 実査 | 結果 |
|---|---|---|
| **消費した CHANGE 番号を registry へ登録したか** | `grep -n "CHANGE-142" docs/handover/change-number-registry.md` | **★本サブは CHANGE 番号を 1 本も消費していない。** `CHANGE-142` は **2026-08-23 に設計卓が起票登録済み**（registry §1 の `142` 行・改訂履歴 `1.188.0`＝**D-529**）。**⇒ 製造側で払い出した番号は無く、登録の手番も無い** |
| **その番号の写し先を全数直したか**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の 4 か所。**総数は都度実査**） | ボード §2.1 を実査 | **★該当なし。** ボード §2.1 は既に「**`141` は `M23-09`・`142` は `M23-10` が消費済み。残り 1 本（`143`）。次の空きブロックは `144` から**」と記録しており、**設計卓が起票時に更新済み。** 製造が直す箇所は無い |
| **消費したマイグレ連番** | `ls migrations/*.up.sql \| tail -1` → `000078_add_combos_superseded_by.up.sql`（全 78 本） | **★消費 0 本。** ボード §2.2 の「次に払い出すマイグレ連番 ＝ `000079`」と disk 末尾 `000078` は**一致しており、ズレは無い**（`000078` は `M23-01` が消費済み）。**⇒ §2.2 へ戻す値は無い** |
| **版を上げた文書の参照元** | — | **★該当なし。** 本サブは設計書・指示書・チェックリストのいずれも版を上げていない（`git diff --stat 184d0ad -- docs/design/ docs/instructions/` が空）。**⇒ `grep` で写し先を拾う対象が無い** |

**★あわせて、本サブが作った/触った文書の一覧**（新種の恒久ファイルは作っていない＝`CLAUDE.md` §10.Y）:

- **新規**: `docs/progress/m23-10-completion-report.md` ／ `docs/progress/m23-10-review.md` —— **いずれも既存運用の型どおり**（`bash scripts/check-doc-inventory.sh --list-allow` の型に合致）。
- **追記のみ**: `docs/progress/progress-log.md`（索引行）／ `docs/handover/followup-backlog.md` **§J**（1 件。**★§J 以外の節は編集していない＝D-382**）。
- **`docs/` へ新種の恒久ファイルは 1 つも作っていない。**

---

## 14. 開発者の手動確認（手順）

**★機械では確かめられない確認が 3 件ある。** 本節はその手順と結果の置き場である。

**★なぜ本節が要るか**——`followup-backlog.md` §J の `db-open-file-uri-unverified-on-windows` は「開発者が Windows 機で確認すること」としか書いておらず、**手順も結果の置き場も無かった。** **手順が会話の中にしか無いと失われる**（`docs/handover/session-prompts/README.md` §1 が同じ理由でディレクトリを設けている）。**⇒ サブの細部の正本である本報告へ置く**（先例＝`m23-09-completion-report.md` §15）。

### 14.0 共通の準備

**★本ブランチは `main` 未マージである。**

```bash
git fetch origin claude/m23-10-implementation-plan-cpspyh
git switch claude/m23-10-implementation-plan-cpspyh
```

### 14.1 【必須】Windows 実機での起動

**なぜ機械化できないか**: `db.Open` の DSN を `file:` URI 形式へ移し、パスをパーセントエンコードするようにした（§2.2）。Windows の既定パス `%APPDATA%\combomgr\combomgr.db` は `file:C:%5CUsers%5C…%5Ccombomgr.db?_pragma=…` になる。**CI に Windows ランナーが無く**（private リポジトリでは Windows ランナーが 2 倍課金＝`README.md` の nightly 節）、**実装セッションも Linux だった。** **`TestBuildDSN` の Windows ケースは DSN 文字列の形を固定するだけで、実際に開いていない。**

**手順**

1. **devContainer / WSL 側でクロスビルドする**（`modernc.org/sqlite` は純 Go のため Linux から Windows 向けに出せる）

   ```bash
   make build-windows      # → dist/combomgr-windows-amd64.exe
   ```

2. `dist/combomgr-windows-amd64.exe` を Windows 側の任意のフォルダへコピーして実行する。

3. **1 回目の判定**

   | 見るもの | 期待 |
   |---|---|
   | コンソール | ブラウザが自動で開き、`http://localhost:47318/` にコンボ一覧が出る |
   | `%APPDATA%\combomgr\` | `combomgr.db` ／ `combomgr.db-wal` ／ `combomgr.db-shm` ができている |

   **★失敗のサインは `fatal: open db: …` と出て即終了することである。**

   **★切り分けが 1 手でつく**——**マイグレーションは `db.Open` を通らず、先に走る**（`cmd/combomgr/main.go:109` の `migration.Run` → `:116` の `dbinfra.Open` の順）。**⇒ `combomgr.db` が正しい場所にできているのに `open db:` で落ちたなら、原因は確実に本サブの DSN 変更である。**

4. **★2 回目の起動が本命である**——**「起動した」だけでは「毎回新しい DB を作っている」可能性を排除できない。**

   1. 1 回目でコンボを 1 件登録する
   2. アプリを終了し、**もう一度起動する**
   3. **さっき登録したコンボが見えること**

   **⇒ 2 回とも同じ `%APPDATA%\combomgr\combomgr.db` を掴んだ証拠になる。**

5. **失敗した場合**: コンソール全文（または `logs\combomgr.log`）を残すこと。**代替案は用意してあり、`followup-backlog.md` §J `db-open-file-uri-unverified-on-windows` の再開条件欄に書いてある**——`buildDSN` に 3 行の分岐を足し、`?` `#` `%` を含まないパスは旧形式（生パス）へ落とす。

### 14.2 【推奨】実 dev DB でアプリを一巡

**なぜ機械化できないか**: **テストも E2E も使い捨て DB で走る**（`dbtest` は `t.TempDir()`、E2E は専用ポート＋使い捨て DB）。**FK が全接続で ON になったのは本サブが初めて**であり、影響は全 API の下に薄く効く。**実データ特有の状態は実機でしか通らない。**

**★先にバックアップを取ること**

```bash
cp ~/.local/share/combomgr/combomgr.db ~/combomgr-backup-$(date +%Y%m%d).db
```

**理由**——**タグ削除で `combo_tags` が実際に CASCADE されるようになった。** 従来は発火しないほうが多かった（16 接続中 15 本が FK=OFF＝§1-#2）。**意図した変更だが、実データの上で効くのは今回が初めてである。**

**手順**

```bash
go run ./cmd/combomgr        # リポジトリルートで。ブラウザが http://localhost:47318/ を開く
```

**一巡する操作**（`FOREIGN KEY constraint failed` が出なければ OK）

| # | 画面 | 操作 |
|---|---|---|
| 1 | `/combos` | コンボを 1 件 登録 → 編集 → 削除（ゴミ箱へ） |
| 2 | `/trash` | いま消したコンボを **復元** → もう一度削除 → **完全削除** |
| 3 | `/combos/:id` | セットプレイを 1 件 登録 → 削除 |
| 4 | `/trash` | セットプレイを復元 → **完全削除** |
| 5 | `/tags/manage` | タグを 1 件 作成 → コンボに付ける → タグを削除 |

**★とくに 2 と 4（完全削除）を落とさないこと。** `M23-08` / `M23-02` が入れた明示削除と、本サブで ON になった CASCADE が**同じトランザクションで走る**経路であり、二重に消しにいく形になる（§5.1-3 の `TestExplicitChildDeleteThenParent_NoError` が守っている経路の実機版）。

**★マイグレーション版数のエラーが出た場合**——`fatal: migration: up: no migration found for version NN` は**別ブランチが dev DB を先に進めた**ためであり、**本サブとは無関係である**（`scripts/dev-throwaway-db-guide.md`）。**本サブはマイグレーションを 1 本も消費していない**（§9）。その場合は `scripts/dev-throwaway-db.sh` で使い捨て DB を使う。

### 14.3 【推奨・1 分】タグ削除

**なぜ機械化できないか**: **orphan 掃除の効果の確認**であり、**掃除は本サブの外で行われた**（§6 後日談・開発者報告）。**製造は実 DB を持たず、掃除の結果を検証していない。**

**手順**

1. `http://localhost:47318/tags/manage` を開く
2. 以前「**使用 0 件と表示されているのに削除できなかった**」タグを探す
3. 削除する

**判定**: 消えれば OK。**`409 tag_in_use` で弾かれるなら orphan がまだ残っている。** その場合は実測できる（`sqlite3` が入っていれば）:

```bash
sqlite3 ~/.local/share/combomgr/combomgr.db "
SELECT COUNT(*) FROM combo_tags ct
WHERE NOT EXISTS (SELECT 1 FROM combos c WHERE c.id = ct.combo_id);"
```

**⇒ `0` なら掃除済み。** 掃除 SQL は `docs/progress/m23-08-completion-report.md` §4.1 にある。

### 14.4 結果（★実施したら埋めること）

**★欄を先に用意しておく。** 結果の置き場が無いと、**やったのかやっていないのかが後から分からなくなる。**

| # | 確認 | 状態 | 実施日 | 備考 |
|---|---|---|---|---|
| 1 | **Windows 実機での起動**（必須） | **★OK** | 2026-08-24 | **§J `db-open-file-uri-unverified-on-windows` を「完了」へ更新済み。** ⇒ §2.2 の残存リスクは解消 |
| 2 | 実 dev DB での一巡 | **★OK** | 2026-08-24 | **FK が全接続で ON になった状態で、実データの上でも既存経路が壊れていない**ことの実機確認 |
| 3 | タグ削除 | **★OK** | 2026-08-24 | **`combo_tags` orphan の掃除（開発者・§6 後日談）が効いたことの証拠。** ⇒ 「使用 0 件と表示されるのに消せない」状態は実機でも解消 |

**★いずれも開発者報告である**（製造は Windows 機も実 DB も持たない）。**★3 件とも「コードでは判定できない点」であり、機械検査に置き換わる見込みは無い**——CI に Windows ランナーが無く、テストと E2E は使い捨て DB で走る。**⇒ 接続の開き方や削除経路を変える改修が来たら、同じ 3 件をもう一度回すこと。**

---

*以上、M23-10 完了報告。約 5 行の変更より、その 5 行が戻されたことを検出し続けるテストのほうが価値がある。*
