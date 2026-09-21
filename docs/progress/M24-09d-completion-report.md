# M24-09d 完了報告: テスト実行基盤の高速化

| 項目 | 内容 |
|---|---|
| 指示書 | `docs/instructions/M24-09d-test-execution-speedup.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M24-09d-review-checklist.md` **v1.0.0** |
| CHANGE | **`CHANGE-145` v1.0.0（設計卓が起票済み。★製造は番号を消費していない）** |
| 着手基点 | `da53aaf`（クリーン） |
| マイグレ消費 | **0 本**（次は `000080` のまま） |
| 新規依存 | **0**（`go.mod` / `package.json` に差分なし） |
| ブラウザストレージ新キー | **0** |
| 実施日 | 2026-08-30 |

---

## 0. 結論（先に読む 5 行）

1. **`go test ./... -count=1` の wall が 137.2 秒 → 43.2 秒になった（−69%）。** 同一セッション内の背中合わせ実測。
2. **ok パッケージ数 55 / FAIL 0 / skip 5 は不変。テストは 1 本も消えていない**（集合差分で確認。増分は本サブが足した 4 本ちょうど）。
3. **除外が効いていることは速度ではなく `dbtest.MigrationRunCount()` で観測している。** 破壊確認 2 でその観測が実際に変わることを示した。
4. **★§4.3（nightly への E2E 追加）は実装したが、CI ランナー上で緑を観測することはできていない。** 分岐点は §7 に書いた。
5. **★指示書と as-built が違った点が 5 件ある**（§8）。とくに **§4.4 の「`tsc --noEmit` はテストファイルを型検査しない」は再現しなかった。**

---

## 1. 測定環境（★母数の前提）

| 項目 | 値 |
|---|---|
| 実行環境 | クラウド実行コンテナ |
| `nproc` | **4** |
| Go | **1.26.4** linux/amd64 |
| ビルドキャッシュ | **warm**（導入前・導入後とも、計測前に 1 回空回ししてから採った） |
| 計測方法 | `date +%s.%N` で `go test ./... -count=1 -json` を挟む。集計は `-json` から `jq` |

**★★指示書に書かれた数値（CPU 705 秒 ／ wall 120 秒 ／ `internal/service/combo` 193 秒 ／ `internal/infra/migration` 64.6 秒）は母数として一切使っていない**（playbook §4.37）。すべて本セッションで採り直した。

---

## 2. §3.3 実査 12 件の答え（**母数付き**）

### 実査 1: wall とパッケージ別 elapsed

| 量 | 実測（導入前・warm・背中合わせ 2 回） |
|---|---|
| **wall `go test ./... -count=1`** | **137.2 秒 / 138.2 秒** |
| **Σ パッケージ elapsed** | **396.6 秒 / 396.7 秒** |
| **上位 3 本** | `internal/service/combo` **94.0 s** ／ `internal/infra/migration` **43.9 s** ／ `internal/repository/combo` **41.5 s** |
| **最大値** | **94.0 秒**（`internal/service/combo`） |

### 実査 2: テンプレート化で消える wall（**着手前の見込み**）

`Setup` 1 回の実費を `-count` の傾きで実測した:

```
$ go test ./internal/testutil/dbtest -run '^TestInsert_OnlyEmitsGivenColumns$' -count={1,5,20}
count=1 : 0.77 秒 / count=5 : 2.42 秒 / count=20 : 9.34 秒
⇒ 傾き = (9.34 - 0.77) / 19 = 0.451 秒/回
```

これに各パッケージのテスト数を掛け、パッケージ自身の elapsed で頭打ちにした見込みは **Σ elapsed 約 140 秒 / wall 約 55〜70 秒**であった。**⇒ 指示書 §4.1.0 の「予定どおり実施する」に該当すると判断した。**（実測はこれより良く、wall 43.2 秒だった。§3）

### 実査 3: `internal/infra/migration` を除外した後の wall の床

**43.9 秒**（導入前の同パッケージ elapsed）。

**★★しかもこの床は、除外するかどうかと無関係である。** 同パッケージは **トップレベル 99 テスト中 97 本が `migration.Run` を自前で呼んでおり**、`dbtest.Setup` を使うのは **2 本だけ**（`migrate_m1801_test.go:135` / `migrate_m1903_test.go:117`）。**⇒ テンプレート化しても縮まない。**

**実測でもそのとおりになった**——導入後の wall 43.2 秒に対し、同パッケージの elapsed は **37.6 秒**であり、**wall のほぼ全部が同パッケージのクリティカルパスである。**

### 実査 4: `Setup(t)` の実装と呼び出し元の全数

| 量 | 指示書 | **実測** |
|---|---|---|
| `dbtest.go` の行数 | — | **64 行** |
| `Setup(t)` の行数 | 「12 行」 | **17 行**（godoc を除く関数本体） |
| 公開関数 | 触れていない | **2 本**（`Setup` と **`SetupWithPath`**） |
| `dbtest.Setup(` の呼び出し | 「208 か所」 | **208 か所 / 55 ファイル**（一致） |
| `dbtest.SetupWithPath(` の呼び出し | — | **5 か所 / 3 ファイル** |
| **実質の母数** | — | **213 か所 / 57 ファイル** |

走査コマンド: `grep -rn "dbtest\.Setup(" --include="*.go" .` ／ 同 `SetupWithPath(`。

### 実査 5: マイグレーションの本数

**up 79 本 / down 79 本（計 158 ファイル・1.7 MB）**。最大連番 `000079_fix_character_display_names`。指示書の「79 本」と一致。

### 実査 6: 除外すべきパッケージの全数

**`internal/infra/migration` の 1 本のみ。** 「無い」を主張するため **9 本の走査軸**を立てた（playbook §4.35）。

| 軸 | 探した語 | ヒットと判定 |
|---|---|---|
| 1 | `migration.Run(` を直接呼ぶ | `internal/infra/migration/` の **3 ファイル**のみ |
| 2 | `schema_migrations` | **0 件** |
| 3 | `sqlite_master` | **9 ファイル**。うち migration が 7 本。残る 2 本は**対象外**——`repository/combo/hard_delete_children_test.go` は汎用ヘルパ `listTables`、`api/debug/handler_test.go` は **SQL インジェクション攻撃文字列のリテラル**であり、どちらもマイグレ過程の検証ではない |
| 4 | `PRAGMA table_info` / `index_list` / `foreign_key_list` / `index_info` | migration の **2 本**のみ |
| 5 | `golang-migrate` の import | migration の **2 本**のみ |
| 6 | `MigrationsFS` | migration の **4 本**のみ |
| 7 | `journal_mode` / `PRAGMA foreign_keys` / `user_version` | **10 ファイル**。すべて「接続の PRAGMA が効いているか」の主張であり、**DB ファイルの作られ方ではない**（`db.Open` が接続文字列で載せるため、テンプレートのコピーでも同一） |
| 8 | `-wal"` / `-shm"` | **0 件** |
| 9 | `SetupWithPath`（ファイル実体に依存する） | **3 ファイル**。いずれも「同じ DB ファイルへ素の接続をもう 1 本開く」用途で、生成方式に依存しない |

### 実査 7: `Setup` を経由せず自前で DB を作るテスト

**7 ファイル。**

- `internal/infra/migration/` **4 本**（`migrate_test.go` / `migrate_m2301_test.go` / `canary_punish_scan_test.go` / `migrate_m1403b_test.go`）——除外対象パッケージ内。
- `internal/infra/db/fkbehavior_test.go` / `txlock_test.go` ／ `internal/repository/combo/hard_delete_children_test.go` ／ `internal/service/combo/setup_results_carry_test.go` —— **いずれも `dbtest` が作った DB へ「素の接続をもう 1 本」開くだけ**であり、DB の生成自体は `dbtest` 経由。**⇒ 効果は減らない。**

### 実査 8: `-wal` / `-shm`

**`migration.Run` は `sql.Open("sqlite", dbPath)` を素で使い PRAGMA を一切載せない**（`internal/infra/migration/migrate.go:55`）。**⇒ テンプレートは `journal_mode=delete` のままであり、サイドカーは元から生じない。** WAL 化するのは後段の `db.Open`（`dsnPragmaParams` に `journal_mode(WAL)`）である。

指示書が求める `wal_checkpoint(TRUNCATE)` は**将来この前提が崩れたときの番人として実装した**うえで、**サイドカーの不在をテンプレート生成時にその場で検査**し、在れば `Setup` を落とす形にした（黙って壊れたテンプレートを配らない）。

### 実査 9: `Makefile` の `e2e` が設定している環境変数の全数

**1 つ（`PW_EXECUTABLE_PATH` のみ）。** `Makefile:122` の target-specific `export ... ?= $(wildcard $(PW_PREINSTALLED_CHROMIUM))`。

他に共有すべきものが 2 つある: **前提ターゲット `ensure-web-deps`** と、**Chromium の実在チェック＋`playwright install` フォールバックのシェルブロック**。**⇒ この 3 つすべてを `e2e-only` にも通した。** DB パス・ポート・専用 config は `Makefile` ではなく `web/playwright.config.ts` の `webServer.env` が持つため、`Makefile` 側で渡すものは無い。

### 実査 10: E2E スタックが CI ランナーで成立するか

**コード読解の範囲では成立する。**

| 分岐点 | 判定の根拠 |
|---|---|
| 使い捨て DB の置き場 | `web/e2e/.tmp/combomgr-e2e.db` は**リポジトリ内の相対パス**。`config.ValidateDataPath` が絶対パスを拒否するため、この形でなければならない。ランナーで書ける |
| ポート 47390 / 5273 | `config.toml` が無いと `readDevBackendPort()` が `47320` へフォールバックし**オフセット 0 = 基準ポート**になる。CI には `config.toml` が無いため必ずこの経路。ubuntu ランナーで空いている |
| `pnpm build` の要否 | **要る。ただし `playwright.config.ts` の webServer が自分で走らせる**（`pnpm build && vite preview`）。★`Makefile` 側へ移さないこと（古い `dist` を緑で通す） |
| 所要時間 | ローカル実測 **219 秒（3.6 分）**。CI はブラウザ取得とビルドの分だけ長い。`timeout-minutes: 30` を置いた |

**★★2026-08-30 に開発者が本ブランチで nightly を手動起動し、実際に観測した**（§7）。**4 つの分岐点はいずれも成立した。**

### 実査 11: nightly の現構成と `pr-checks.yml` の E2E 除外理由（逐語）

- **nightly（変更前）**: job **1 本**（`crossbuild`・`ubuntu-latest`・`schedule: "0 18 * * *"` ＋ `workflow_dispatch`・`timeout-minutes: 30`・`concurrency: ${{ github.workflow }}` / `cancel-in-progress: false`）。
- **`pr-checks.yml` の除外理由（逐語）**:

  > E2E(Playwright)は載せない。指示書 §1.3-1。
  > web/playwright.config.ts が CI 向けの 3 点(workers: 1 / reporter: dot / retry の扱い)
  > を未適用であり、Track B の開始条件(1 worker 連続成功)も未達
  > (ベースライン計測 §1.5 / A0-6)。

**★★このうち `workers: 1` は `M24-09c` / `CHANGE-135` で適用済みであり、除外理由は一部失効していた。** 本サブで注記を是正した（§5）。

### 実査 12: `tsc --noEmit` と `pnpm build` の守備範囲の差 ／ `web/CLAUDE.md` の節構成

**★★指示書 §4.4 が前提にしていた事実は再現しなかった。** §8-1 に全実測を書いた。

`web/CLAUDE.md` は **78 行 / 2 節**（§1 ブラウザストレージ運用台帳・§2 コンボ型の 3 分岐）。**⇒ どちらにも収まらないため §3 として足した。**

---

## 2.1 ★★§3.3-1 の「数字の食い違い」の答え（完了条件 §7.1-3）

指示書が挙げた 4 つは **1 回の実行の中では両立しない。** パッケージの elapsed は wall の部分区間であり、**1 パッケージが wall 全体を超えることは構造上ありえない**（`internal/service/combo` 193 秒 > wall 120 秒）。

**⇒ 答え: 4 つの数字は同一の実行から採られていない。**

同一セッションで背中合わせに採り直すと矛盾は消える:

- **Σ パッケージ elapsed 396.7 秒 ＞ wall 137.2 秒（比 2.9 倍）。** この差は「CPU と wall の差」ではなく、**`go test` が最大 `GOMAXPROCS`（本環境では 4）本のパッケージバイナリを並列に走らせること**による。指示書の「CPU 合計 705 秒」に対応する量はこの Σ elapsed であり、環境が変われば値も変わる。
- 同じ実行の中では **`internal/service/combo` 94.0 秒 < wall 137.2 秒**であり、逆転していない。

**⇒ 射程を確定してよいと判断し、実装に入った**（§9.1-1 の停止条件には当たらない）。

---

## 3. ★★導入前後の背中合わせ実測（**同一セッション内**）

| 量 | **導入前** | **導入後** | 差 |
|---|---:|---:|---|
| **wall `go test ./... -count=1`** | **137.2 / 138.2 秒** | **43.2 / 42.4 秒** | **−69%** |
| **Σ パッケージ elapsed** | 396.6 / 396.7 秒 | **79.6 秒** | −80% |
| **ok パッケージ数** | **55** | **55** | **±0** |
| **FAIL** | **0** | **0** | **±0** |
| **no test files** | 8 | 8 | ±0 |
| **skip されたテスト** | **5** | **5** | **±0** |
| **テスト本数（サブテスト込み）** | 1,660 | **1,664** | **+4** |
| **テスト本数（トップレベル）** | 1,384 | **1,388** | **+4** |

> **★本節の wall（43.2 / 42.4 秒）は「背中合わせ計測」の値である。** §10 の確定実行は **38.2 秒**で、こちらは破壊確認をすべて撤去したあと 1 回だけ回した値である。**2 つは別条件であり、引き算しないこと。** 導入前との比較に使うのは本節の側である（同じ手順で採ったのはこちらだから）。

### 3.1 ★★「+4」の中身（**消えたテストが 0 本であること**）

**件数の一致ではなく集合の差分で確かめた。**

```
$ comm -23 before.tests after.tests     # 導入後に消えたテスト
（0 行）

$ comm -13 before.tests after.tests     # 導入後に増えたテスト
internal/infra/migration    TestTemplate_DisabledInThisPackage
internal/testutil/dbtest    TestTemplate_BuiltOnlyOnce
internal/testutil/dbtest    TestTemplate_NoWalSidecarFiles
internal/testutil/dbtest    TestTemplate_SchemaMatchesFreshMigration
```

**⇒ 消えたテストは 0 本。増分は本サブが §5.1 の要求で足した 4 本ちょうどである。** skip も 5 件のまま増えていない（速度を理由に skip していない）。

### 3.2 パッケージ別の内訳（上位）

| パッケージ | 導入前 | 導入後 |
|---|---:|---:|
| `internal/infra/migration`（**除外対象**） | 43.9 s | **37.6 s** |
| `internal/service/combo` | **94.0 s** | **3.9 s** |
| `internal/repository/combo` | 41.5 s | 1.4 s |
| `internal/service/setup` | 37.7 s | 1.9 s |
| `internal/api/auth` | （上位外） | 6.1 s |
| `internal/service/auth` | （上位外） | 5.9 s |

**★★導入後のクリティカルパスは `internal/infra/migration`（37.6 秒）であり、wall 43.2 秒のほぼ全部を占める。** 実査 3 で出した床の見込みがそのまま当たった。**⇒ これ以上の短縮は、同パッケージ（97 本が自前で `migration.Run` を呼ぶ）に手を入れない限り得られない。それは本サブのスコープ外である（§1.6-3）。**

### 3.3 `Setup` 1 回の実費

| | 傾き | 実測値（`-count=1/5/20`） |
|---|---:|---|
| 導入前 | **0.451 秒/回** | 0.77 / 2.42 / 9.34 秒 |
| 導入後 | **0.0079 秒/回** | 0.71 / 0.72 / 0.86 秒 |

**⇒ 57 倍。** テンプレート DB の実サイズは **925,696 バイト**（約 0.9 MB）であり、1 回あたりのコピーは実測 8 ミリ秒に収まっている。

---

## 4. テンプレート化の形（**検討した案と選定理由**・§2.3）

### 4.1 テンプレートの保存先

| 案 | 採否 | 理由 |
|---|---|---|
| **A. メモリ上の `[]byte`** | **★採用** | Go には**プロセス終了時に走る後片付けの経路が無い**。ファイルで持つと「テストバイナリ 1 本につき 1 個の DB が `/tmp` に残る」形になり、本リポジトリが抱えるディスク増加の課題（followup `disk-growth-*`）に足す。0.9 MB × パッケージ数ならメモリで持てる。**`-wal` / `-shm` が混入する経路も構造的に消える** |
| B. `os.MkdirTemp` のファイルを残してコピー元にする | 不採用 | 上記のとおり消す手番が無い。`t.TempDir()` に置くと最初のテストの終了で消える |
| C. `t.TempDir()` の親（`TestMain` 管理） | 不採用 | 全パッケージに `TestMain` を足すことになり、呼び出し元 0 変更という前提が崩れる |

構築時だけ `os.MkdirTemp` を使い、`defer os.RemoveAll` でディレクトリごと消している（**残すのはバイト列だけ**）。

**★サイドカーの番人は `-wal` / `-shm` / `-journal` の 3 種を見る**（レビュー 低-3 で取り込み）。現在の `journal_mode` は `delete` であり、**残る形としてはむしろ `-journal` のほうが近い。**

### 4.2 1 回性の担保

`sync.Once`（指示書指定）。**失敗は `templateErr` に残し、以後のすべての `Setup` が同じ理由で落ちる形にした**——`sync.Once` は 1 回しか走らないため、失敗を握り潰すと「テンプレートが壊れたまま全テストが走る」状態になる。

### 4.3 除外の実現手段

| 案 | 採否 | 理由 |
|---|---|---|
| **A. `dbtest.DisableTemplate()` を `TestMain` から呼ぶ** | **★採用** | **明示的で `grep` できる。呼び出し元 0 変更。** 既存 `TestMain` はリポジトリ全体で 0 件のため衝突しない。`internal/infra/migration` の test ファイルは 26 本すべて `package migration_test` の 1 種類であり、`TestMain` を 1 か所に置ける |
| B. `runtime.Caller` で呼び出し元パッケージを見て自動除外 | 不採用 | 除外の一覧が**コードを読まないと分からない**形になる。除外は設計上の契約（`CHANGE-145` §2.1.2-3）であり、暗黙に決まってはいけない |
| C. ビルドタグ | 不採用 | パッケージ単位で切り替えられない |
| D. 環境変数 | 不採用 | 同上。かつ「`go test ./...` の中で 1 パッケージだけ」を表現できない |

### 4.3.1 ★★除外の「逆向き」にも検出器を置いた（レビュー 中-1 で取り込み）

**除外は「し忘れ」だけでなく「しすぎ」でも壊れる。** ただし**除外しすぎは、テストが全部緑のまま遅くなるだけであり、誰も気づかない**——本サブが言う「速度は根拠にならない」の裏返しがそのまま当てはまる。**書いておくだけでは守れない**（`M24-12` 教訓 23）。

**⇒ `DisableTemplate()` が呼び出し元パッケージを `runtime.Caller` で見て、許可一覧（`templateExemptPackages`）に無ければその場で落とす形にした。** 外部テストパッケージ（`..._test`）は元のパッケージへ丸める。

**★機械で強制できるものを文書へ書かない**（`Makefile` へ `e2e-only` を足したのと同じ姿勢）。**新しい `scripts/check-*.sh` を足す案は採らなかった**——`check-artifact-integrity.sh` が各検査に自己検査の存在を要求しており、検査機構そのものへ射程が広がるためである（§1.6-5）。

**実際に発火することを確かめた**（書いただけでは守れないため）:

```
$ # internal/service/tag のテストから一時的に dbtest.DisableTemplate() を呼ぶ
$ go test ./internal/service/tag/ -count=1 -run TestM2409dGuardProbe
--- FAIL: TestM2409dGuardProbe (0.00s)
panic: dbtest.DisableTemplate: パッケージ "github.com/plexiblinp/combomgr/internal/service/tag" からは呼べない。
	  許可一覧: [github.com/plexiblinp/combomgr/internal/infra/migration]
	  増やす場合は internal/testutil/dbtest/dbtest.go の templateExemptPackages へ足すこと。
```

**撤去後 `git diff` = 0 ファイル。**

### 4.4 ★除外が効いていることを速度以外で観測する（§5.3-2 / §7.1-4）

**`dbtest.MigrationRunCount()` を公開した。** `dbtest` がマイグレーションを実行した回数そのものである。

- テンプレート方式のパッケージ: `Setup` を何回呼んでも **1 のまま**。
- 除外したパッケージ: `Setup` の**回数だけ増える**。

**★★速度は根拠にならない**——除外し忘れても速くなり、コピーに失敗しても速くなる。**⇒ 回数を直接数える形にした。** これを `TestTemplate_BuiltOnlyOnce`（テンプレート側）と `TestTemplate_DisabledInThisPackage`（除外側）が対で主張している。

---

## 5. 変更したファイル（`git diff --numstat da53aaf`）

**★レビュー取り込み後の最終値**（`docs/progress/` の 3 ファイル＝本報告書・レビュー報告書・`progress-log` への索引行を含む）:

```
149	7	.github/workflows/nightly-crossbuild.yml
15	4	.github/workflows/pr-checks.yml
10	1	CLAUDE.md
50	4	Makefile
5	4	README.md
617	0	docs/progress/M24-09d-completion-report.md
12	0	docs/progress/progress-log.md
52	0	internal/infra/migration/template_exclusion_test.go
231	18	internal/testutil/dbtest/dbtest.go
283	0	internal/testutil/dbtest/template_test.go
10	0	web/CLAUDE.md
```

（`docs/progress/m24-09d-review.md` はレビュー担当が作成した新規ファイルであり、上記の時点では untracked。）

**★新規のはずの 2 ファイル（`template_exclusion_test.go` / `template_test.go`）は deletions が 0 である**（教訓 `E-225`。新規のつもりで既存を上書きしていない。作成前に `ls` で同名不在も確認した）。`dbtest.go` の 18 deletions は `Setup` / `SetupWithPath` の重複した本体を内部関数へ寄せた分であり、**関数の署名は 1 文字も変えていない。**

### 5.1 指示書 §2.1 に無いのに触ったファイル（**理由つき**）

| ファイル | なぜ触ったか |
|---|---|
| `.github/workflows/pr-checks.yml`（コメントのみ） | **E2E 除外理由の注記が二重に失効していた**——(a) `workers: 1` は `CHANGE-135` で適用済み（実査 11）／(b) 本サブで E2E が nightly に載った。**★E2E の実体は足していない**（`grep` で 0 件を確認。§1.6-6） |
| `README.md` | nightly の job が 2 本になり、**ワークフロー名・目的・「nightly が赤いとき壊れているのはクロスビルド」の記述がいずれも失効した**。3 か所を追随させた |

**★ワークフロー名を `Nightly cross-build` → `Nightly` へ変えた。** クロスビルドだけを回すワークフローではなくなったためである。`grep -rn "Nightly cross-build"` で残り 0 件を確認した。**★本ワークフローは必須 check ではない**ため、名前の変更で PR が止まることはない。

---

## 6. 追加したテスト（§5.1）

| # | テスト | 主張 |
|---|---|---|
| 1 | `TestTemplate_SchemaMatchesFreshMigration` | テンプレート由来の DB と、**その場で `migration.Run` した素の DB** を突き合わせる。**`sqlite_master` の全行（type / name / tbl_name / sql）＋ 全テーブルの `table_info`（列名・型・NOT NULL・既定値・主キー）＋ `foreign_key_list` ＋ `index_list` ＋ `index_info`** の全数。**ダンプは 529 行**になる |
| 2 | 同上（追加の主張） | **★行数も突き合わせる。** スキーマだけを比べると**seed が 1 行も入っていないテンプレートが緑で通る**——それは本サブが最も恐れている壊れ方そのものである。あわせて `characters` が 0 行でないことを直接主張し、「両方空だから一致した」を排除した |
| 3 | `TestTemplate_BuiltOnlyOnce` | `Setup` を 3 回呼んでも `MigrationRunCount() == 1`（`sync.Once` が効いている） |
| 4 | `TestTemplate_NoWalSidecarFiles` | 最後の接続を閉じたあと `-wal` / `-shm` が残らず、DB ディレクトリに `test.db` 以外が無い |
| 5 | `TestTemplate_DisabledInThisPackage` | **除外側の観測。** `internal/infra/migration` で `Setup` を 2 回呼ぶと `MigrationRunCount()` が **2 増える** |

**★比較相手はテンプレートを通していない**（チェックリスト §3-5）。`openFreshlyMigrated` は `migration.Run` を自分で呼び、`db.Open` も使わず素の `sql.Open` で開く。**テンプレート由来どうしを比べると、壊れたときに両方が同じように壊れて検出できない。**

---

## 7. ★★§4.3（nightly への E2E 追加）の成否と分岐点

**★★成立した。マージ前に、開発者が本ブランチで nightly を手動起動して観測した**（2026-08-30）。

| 項目 | 状態 |
|---|---|
| job の追加 | **済**（`.github/workflows/nightly-crossbuild.yml` の `e2e` job） |
| `workers: 1` の維持 | **済。`web/playwright.config.ts` は 1 行も変えていない**（`git diff` で 0 ファイル。`workers: 1` は `:99`） |
| `pr-checks.yml` への E2E 追加 | **していない**（§1.6-6） |
| **CI 上での実行と緑の観測** | **★★観測した**（§7.1） |

### 7.1 ★★CI 上での観測（**2026-08-30・マージ前・開発者が実行**）

**起動方法**——Actions → `Nightly cross-build`（**サイドバーの表示名は既定ブランチ側の定義から来るため旧名**）→ `Run workflow` → `Use workflow from: claude/m24-09d-implement-plan-8zmsxf`。**`workflow_dispatch` が要求するのは「そのワークフローが既定ブランチに在ること」だけであり、実行時のブランチは選べる。⇒ ブランチ側の定義（job 2 本）が走る。**

**Job summary の実測**:

| 項目 | 値 |
|---|---|
| コマンド | `make e2e` |
| **判定** | **緑** |
| **passed** | **215 passed** |
| failed | 行なし |
| flaky | 行なし |
| workers | 1 |
| **ランナー実コア数** | **2** |
| 所要（`JOB_START` 起点） | **335 秒** |
| 所要（GitHub の job 表示） | **5m48s ＝ 348 秒** |

**★読み取れたこと 4 点**:

1. **★★件数がローカルと一致した（215）。** **⇒ CI でも全数が実際に走っている。**「緑だが 1 件も走っていない」（`E-125`）は排除された。**★これは job の緑よりも強い根拠である**——本サブの主題そのものが「緑は根拠にならない」だからである。
2. **★ランナーは 2 コアで、ローカル（4 コア）の半分である。それでも所要は 219 秒 → 335 秒の 1.53 倍に収まった。** `workers: 1` の直列実行はコア数の影響を受けにくいという理屈と整合する。**`timeout-minutes: 30` に対して十分な余裕がある。**
3. **★★先回りした 2 つの手当ての「必要だったか」は切り分けられていない。** `go run` の起動 60 秒枠（`Warm Go build cache` ステップ）と Chromium のシステム依存（`playwright install --with-deps`）は**どちらも通ったが、外しても通るのかは試していない。** ⇒ 「効いた」とは書けない。**外すときは実測すること。**
4. **★2 つの所要（335 秒 / 348 秒）は別の量である。** 前者はワークフローが `JOB_START` を記録した後から Job summary までで、後者は checkout・setup・キュー待ちを含む GitHub の表示値である。**引き算しないこと。**

### 7.2 ★★`playwright.config.ts` を CI 向けに調整しなかった理由（指示書 §4.3 の「調整」欄との差）

指示書は `retries` / `reporter` の CI 向け調整を挙げていたが、**1 つも変えなかった。**

**理由——本 job の目的は「main の E2E が緑か」を観測することである。ローカルの `make e2e` と別条件で回すと、nightly が観測しているものがローカルと別物になる。** 「nightly は緑だがローカルは赤」「その逆」が起きたとき、差が実装なのか設定なのか分からなくなる。**⇒ 同じ `make e2e` を同じ設定で呼ぶ形が、目的に対して最も強い。**

なお `reporter: dot` は**旧除外理由の逐語に出てくるだけ**で、現在の `list` で CI ログとして困る点は無い（件数行は同じ形で出る。§7.4 の抽出検証を参照）。

### 7.3 ★CI 向けに足したもの（読解で見つけた実際のリスク）

| 足したもの | なぜ要るか |
|---|---|
| `pnpm exec playwright install --with-deps chromium` の明示ステップ | `PW_EXECUTABLE_PATH` 不在の CI では `Makefile` のフォールバックが走るが、**それは `--with-deps` を付けない**。ランナーに無い共有ライブラリが入らない |
| **`go build -o /dev/null ./cmd/combomgr` の事前ウォーム** | **★★バックエンド側 webServer は `go run ./cmd/combomgr` であり、起動タイムアウトが 60 秒である**（`playwright.config.ts`）。**冷えた `GOCACHE` では初回コンパイルだけでこれを超えうる。** 60 秒枠の外でコンパイルを済ませる |
| Go ビルドキャッシュの `actions/cache` | 同上。2 回目以降の nightly を安定させる |

---

## 8. ★★as-built が指示書と違った点（**違ったほうを書く**・playbook §4.43）

### 8-1. ★★§4.4 の前提が再現しなかった（**最重要**）

指示書 §4.4 と followup `tsc-noemit-excludes-test-files` は次を `web/CLAUDE.md` へ足すよう求めていた:

> フロントの型検査は `pnpm build` で見る。`pnpm exec tsc --noEmit -p tsconfig.json` はテストファイルを型検査しない。

**★★4 通りの実験で再現しなかった。**

| # | 実験 | 結果 |
|---|---|---|
| A | `web/src/components/Footer.test.tsx` へ型エラーを入れて `tsc --noEmit -p tsconfig.json` | **赤**（`error TS2322` / exit 2） |
| B | `web/e2e/aa-interference-probe-a.spec.ts` へ型エラーを入れて `tsc --noEmit -p tsconfig.json` ／ `pnpm build` | **両方とも緑**（exit 0） |
| C | A と同じ型エラーで `tsc -b`（= `pnpm build` の前半） ／ `pnpm build` | **両方とも赤**（exit 1） |
| D | 緑の `pnpm build` で `tsconfig.tsbuildinfo` を作った後に A を再実行 | **赤**（インクリメンタル状態の有無で変わらない） |

さらに `pnpm exec tsc -p tsconfig.json --listFilesOnly` は **`*.test.ts(x)` を 198 本読んでいる**。

**⇒ 守備範囲は `tsc --noEmit -p tsconfig.json` と `pnpm build` で同一である。外れているのは `web/e2e/`（spec 58 本）と `playwright.config.ts`** であり、これは `SUPP-001` §4.5 が「積み残し」として記録している `tsconfig.json` の `include` の問題そのものである（`include` は `["src", "vite.config.ts"]`）。

**⇒ 指示書の文言ではなく、実測した事実のほうを `web/CLAUDE.md` §3 へ書いた。**

**★`M24-13` の完了報告 §10 の観測（「`tsc` は緑のまま `pnpm build` が落ちた」）は、1 回の実行からの一般化であったと考えられる。** 本サブでは再現手段が見つからなかった。**⇒ 設計卓の判断が要る**（§11-1）。

### 8-2. `Setup(t)` は 12 行ではなく **17 行**。かつ**指示書が触れていない `SetupWithPath` が公開されており、呼び出し元が 5 か所ある**（母数は 213 か所 / 57 ファイル）。

### 8-3. `pr-checks.yml` の E2E 除外理由の逐語 3 点のうち **`workers: 1` は既に適用済み**であり、**起票時点で失効していた**。

### 8-4. §4.1.1 の `wal_checkpoint(TRUNCATE)` の前提が違う。**`migration.Run` は PRAGMA を載せないため、テンプレートは元から WAL ではない**（実査 8）。checkpoint は将来の番人として残したが、**実効はサイドカー不在の「検査」側にある。**

### 8-5. **除外対象パッケージは 99 テスト中 2 本しか `dbtest.Setup` を使っていない。** ⇒ 除外の有無で既存テストの結果は 1 本も変わらない（破壊確認 2。§9）。

### 8-6. ★★`DES-002` §11.3 の契約 (4) が as-built で失効した（**レビュー 高-2 で検出**）

**逐語**（`docs/design/02-architecture.md:1168`）:

> 4. **★E2E は CI に載せない。** 載せる前提の設定が未適用であり、受入条件も未達である。**★否定形で書いておかないと、次の担当が再実行で緑にして載せる。**

**本サブは nightly に E2E job を載せた。nightly は CI である。⇒ この契約と正面から矛盾する。**

**★★`CHANGE-145` の影響設計書欄は `SUPP-001` §5.5 / §4.5 のみで `DES-002` を含まない。⇒ 起票時に誰もこの契約を参照していない。** **契約自身が「次の担当が再実行で緑にして載せる」と予告していた事態が、契約を読まないまま起きた形である。**

**失効箇所の全数**（★記憶からの転記ではなく実物を走査した。`M24-12` 教訓 23）:

```
$ LC_ALL=C.UTF-8 grep -n "E2E は CI に載せない\|nightly クロスビルド\|CI は本フェーズでは構築せず" \
      docs/design/02-architecture.md | awk -F: '$1 != 8'
1153:| **nightly クロスビルド** | 1 日 1 回の定時 | **Windows / macOS / Linux 3 OS 向けのクロスビルド** |
1168:4. **★E2E は CI に載せない。** 載せる前提の設定が未適用であり、受入条件も未達である。...
1189:E2E（Playwright）は... CI は本フェーズでは構築せずローカル実行（`pnpm` スクリプト）とする。
```

（`:8` はステータス欄の版履歴の集積であり、走査対象から外した。）

| 箇所 | 何が失効したか |
|---|---|
| `02-architecture.md:1168`（§11.3 契約 (4)） | **「E2E は CI に載せない」。** ★なお契約が挙げる理由「載せる前提の設定が未適用」も、`workers: 1` の適用（`CHANGE-135`）で既に一部失効していた（実査 11 と同じ面） |
| `02-architecture.md:1153`（§11.3 の表） | **「nightly クロスビルド ｜ Windows / macOS / Linux 3 OS 向けのクロスビルド」。** job が 2 本になり、ワークフロー名も `Nightly` へ変わった |
| `02-architecture.md:1189`（§12） | **「CI は本フェーズでは構築せずローカル実行」。** `M24-09a` の時点で既に失効しており、本サブでさらに離れた |
| `supp-001-detailed-design.md:570`（§4.5） | 同文。**★こちらは `CHANGE-145` §2.2 が反映対象として挙げており、既に設計卓の射程内である** |

**⇒ 設計書本体の改訂は設計卓の手番であり、製造は触らない**（`CLAUDE.md` §8）。**`CHANGE-145` の影響設計書欄へ `DES-002` §11.3 / §12 を足す必要がある**（§13-6）。

---

## 9. ★★破壊確認（4 件・コマンドと出力）

### 破壊確認 1: テンプレートから 1 テーブルを落とす → **複数パッケージが赤くなる**

`buildTemplate` のテンプレート生成直後に `DROP TABLE combo_steps` を仕込んだ。

```
$ go test ./internal/service/combo/ ./internal/repository/combo/ ./internal/api/combo/ \
         ./internal/service/setup/ ./internal/service/comboio/ ./internal/testutil/dbtest/ -count=1
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	1.706s
FAIL	github.com/plexiblinp/combomgr/internal/repository/combo	1.087s
FAIL	github.com/plexiblinp/combomgr/internal/api/combo	0.668s
FAIL	github.com/plexiblinp/combomgr/internal/service/setup	1.034s
FAIL	github.com/plexiblinp/combomgr/internal/service/comboio	0.882s
FAIL	github.com/plexiblinp/combomgr/internal/testutil/dbtest	0.999s
```

**⇒ 6 パッケージ中 6 パッケージが赤。** スキーマ一致テストは差異を名指しで出した:

```
template_test.go:191: テンプレート由来の DB のスキーマが、マイグレーションを流した DB と一致しない
      最初の差異 (行 4 / want 529 行・got 506 行)
      want: sqlite_master: type=index|name=idx_combo_steps_combo_id_order|tbl_name=combo_steps|...
      got : sqlite_master: type=index|name=idx_combo_tags_tag_id|tbl_name=combo_tags|...
template_test.go:199: テンプレート由来の DB の行数が、マイグレーションを流した DB と一致しない
      最初の差異 (行 9 / want 22 行・got 21 行)
```

**撤去後 `git diff` = 0 ファイル。**

### 破壊確認 2: `internal/infra/migration` をテンプレート経由にしてみる → **観測が変わった**

`TestMain` の `dbtest.DisableTemplate()` をコメントアウトした。

```
-- 除外あり（現状） --
ok  	github.com/plexiblinp/combomgr/internal/infra/migration	0.876s

-- 除外を外した後 --
--- FAIL: TestTemplate_DisabledInThisPackage (0.43s)
    template_exclusion_test.go:48: dbtest.Setup を 2 回呼んだときのマイグレーション実行回数の増分 = 1, want 2
FAIL	github.com/plexiblinp/combomgr/internal/infra/migration	0.435s
```

**⇒ 観測は変わった（増分 2 → 1）。しかも速度ではなく「マイグレーションを何回流したか」で変わった**（§7.1-4 / §5.3-2 を満たす）。

**★★ただし正直に書く——赤くなったのは本サブが足した観測 1 本だけである。**

```
-- 除外を外してパッケージ全体を回した結果 --
--- FAIL: TestTemplate_DisabledInThisPackage (0.01s)
FAIL	github.com/plexiblinp/combomgr/internal/infra/migration	29.915s   （除外なし）
ok  	github.com/plexiblinp/combomgr/internal/infra/migration	30.558s   （除外あり）
```

**既存 99 テストは 1 本も赤くならず、所要もほぼ変わらない**（実査 3 のとおり、`dbtest.Setup` を使うのが 2 本だけであるため）。

**⇒ 除外を残すか落とすかの判断（根拠つき）: ★残す。**

1. **`CHANGE-145` §2.1.2-3 が設計上の契約として定めている**——「マイグレーション自体を検証するテストはテンプレートを使わない」。**契約は、今それが効いていないことを理由に外すものではない。**
2. **`dbtest.Setup` を使う 2 本（`migrate_m1801` / `migrate_m1903`）は HEAD スキーマを見るテストであり、次に同種のテストを足す人は「素のマイグレーション適用済み DB」を前提にする。** 除外が無いと、その前提が黙って崩れる。
3. **コストは実測 0.9 秒**（30.6 − 29.7）。**wall には一切乗らない**——同パッケージは除外の有無に関わらずクリティカルパスであり、その中の 0.9 秒である。

**撤去後 `git diff` = 0 ファイル。**

### 破壊確認 3: 絞り込み用ターゲットから環境変数の設定を外す → **`Executable doesn't exist`**

**(3a) `Makefile` の `E2E_TARGETS := e2e e2e-only` を `E2E_TARGETS := e2e` にする（＝`e2e-only` へ `PW_EXECUTABLE_PATH` の target-specific export が効かなくなる。ただし `@$(ENSURE_PW_CHROMIUM)` は残る）:**

```
$ make e2e-only P="--reporter=line combo-crud"
Downloading Chrome for Testing 148.0.7778.96 (playwright chromium v1223) from https://cdn.playwright.dev/...
Error: Download failed: server returned code 403 body 'request blocked: no rule or allowlist entry allows host "cdn.playwright.dev"'
```

⇒ 変数が空になったため `ENSURE_PW_CHROMIUM` の `else` 側（`playwright install chromium`）が発火し、本環境では即座に落ちる。**★これは「環境変数が渡らない罠」そのものの再現ではない**——`Makefile` の番人が先に止めているためである。逐語の再現は次の (3b) である。

**(3b) さらに `e2e-only` のレシピから `@$(ENSURE_PW_CHROMIUM)` の行ごと外す（＝レシピが `cd web && pnpm e2e $(P)` だけになり、`make` を経由せず `pnpm exec playwright test <pattern>` を直接叩いたのと同じ形になる）:**

```
$ make e2e-only P="--reporter=line combo-crud"
  1) [chromium] › e2e/combo-crud.spec.ts:15:3 › コンボ CRUD スモーク › コンボ登録 → 詳細確認 → 編集 → 削除
    Error: browserType.launch: Executable doesn't exist at
      /opt/pw-browsers/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
```

**⇒ followup `playwright-narrow-run-env-trap` が記録していたメッセージを、そのまま再現した。**

**対照（復旧後）:**

```
$ make e2e-only P="--reporter=line combo-crud"
Using preinstalled Chromium: /opt/pw-browsers/chromium
  2 passed (23.6s)
```

**撤去後 `git diff` = 0 ファイル。**

### 破壊確認 4: nightly の E2E job から spec を 1 本落とす → **★製造セッションからは CI を起動できず、ローカルで代替した**

**★製造セッションは `mcp__*` と `gh` が deny のため Actions を起動できない。⇒ job が実際に打つシェル構文をローカルで回した。**

`web/e2e/combo-crud.spec.ts:23` の `test-id` を存在しないものへ差し替えた（**★`vite build` が通る壊し方を選んだ**——`M24-12` 教訓 17。E2E spec は型検査にもバンドルにも入らないため、ビルドは緑のまま）。

```
$ set -o pipefail
$ make e2e-only P="--reporter=line combo-crud" 2>&1 | tee e2e-broken.log
  1 failed
    [chromium] › e2e/combo-crud.spec.ts:15:3 › コンボ CRUD スモーク › コンボ登録 → 詳細確認 → 編集 → 削除
  1 passed (1.4m)
 ELIFECYCLE  Command failed with exit code 1.
★ステップの exit code = 2
```

続けて `make: *** [Makefile:174: e2e-only] Error 1` が出る（fence の外へ出したのは、`***` が
`check-md-emphasis.sh` の行単位描画で強調として拾われるためである。文字列は逐語のまま）。

**⇒ 検出器として機能し、かつ `set -o pipefail` ＋ `tee` を挟んでも非ゼロが伝わる**（`pr-checks.yml` が「意図的失敗を `tee` の exit 0 が覆い隠した」と記録している型を踏んでいない）。

**あわせて job の Job summary の抽出ロジックを、その赤いログで検証した:**

```
passed=[1 passed]  failed=[1 failed]  flaky=[行なし]
```

**★★ここまでが確かめられたことである。「CI の検出器として機能することを観測した」とは書かない**——ローカルで同じコマンドが赤くなることと、GitHub のランナーでジョブが赤くなることは別の主張である。

> **★追記（2026-08-30・§7.1 の観測を受けて）。** **job が CI 上で緑になることは観測できた**（215 passed）。**⇒ 本件を「本物」で採る道は開いた**——壊した spec を本ブランチへ push して再度 dispatch すれば、job が赤くなるかを実測できる。**採っていない。** 未検証のまま残るのは「**`run` ステップが非ゼロで終わったとき GitHub が job を赤にする**」という GitHub 自身の契約だけであり、**本サブが書いたコードの側は**「同じコマンドが赤くなる」「`set -o pipefail` ＋ `tee` を挟んでも非ゼロが伝わる」「Job summary が `1 failed` を読める」**の 3 つとも上のローカル実行で確かめてある。** **★`continue-on-error` は設定していない**（`if: always()` が付くのは Job summary と artifact の 2 ステップだけで、どちらも `make e2e` の後段にあり判定を覆さない）。

**撤去後 `git diff` = 0 ファイル / untracked = 0。**

---

## 10. 自己テスト結果（§7.2）

| 検査 | 結果 |
|---|---|
| **`go test ./... -count=1`（導入前）** | **wall 137.2 / 138.2 秒 ／ ok 55 / FAIL 0 / skip 5 / 1,660 テスト** |
| **`go test ./... -count=1`（導入後・確定実行。絞っていない）** | **wall 38.2 秒 ／ ok 55 / FAIL 0 / skip 5 / 1,664 テスト ／ exit 0** |
| **`go test ./... -count=1`（★レビュー取り込み後にもう 1 回）** | **wall 39.7 秒 ／ ok 55 / FAIL 0 / skip 5 / 1,664 テスト ／ exit 0 ／ 導入前比で消えたテスト 0 本** |
| **`cd web && pnpm test -- --run`** | **198 files / 2,166 tests passed（72.6 秒）** |
| **`cd web && pnpm build`** | **成功（exit 0・7.32 秒）** ★型検査はこちらで見た |
| **`make e2e`** | **全数緑（215 件）／ exit 0 ／ 219 秒** |
| **`make e2e-only P=...`** | **動作確認済（`Using preinstalled Chromium: /opt/pw-browsers/chromium` → 2 passed）** |
| 破壊確認 4 件 | **§9 のとおり。4 件目は製造セッションからは CI を起動できないためローカル代替** |
| **★nightly の `e2e` job（CI 実機・マージ前・開発者が実行）** | **緑 ／ 215 passed / failed 0 / flaky 0 ／ 2 コアで 335 秒**（§7.1） |
| **★`make e2e-only`（devContainer・開発者が実行）** | **`Using preinstalled Chromium: /usr/bin/chromium` → `Total: 2 tests in 1 file`。★`?=` が devcontainer.json の既設値を尊重する経路も実測で通った** |

**★着手前の `make e2e`（基準値）は採っていない**（`D-594` / `D-600`、および開発者の指示）。**直前にマージされた `M24-13` の完了報告が「215 passed / 0 failed」＝全数緑を明記していることを確認した**（`D-600` 規約 1）。**★件数の増減は主張しない**（規約 3）。

---

## 11. 品質チェック（§7.3・**実際の出力から 1 行ずつ埋めた**）

| 検査 | 結果 |
|---|---|
| **`bash scripts/check-artifact-integrity.sh`（★1 本目に回した）** | **違反なし**（検査 11 件の自己検査 OK ／ 生成物 4 件 OK） |
| `bash scripts/check-md-emphasis.sh` | **ベースラインどおり（436 行 / 436 行・増加なし）** |
| `bash scripts/check-doc-refs.sh` | **dead reference なし**（対象 37 ファイル） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 11 件 / 実装 10 件・新キー 0） |
| `bash scripts/check-progress-log-index.sh` | **★★本報告書の初版はこの欄を「違反なし（索引行を追記したうえで回した）」と書いたが、その時点で索引行は 1 行も無く、本検査を 1 度も回していなかった。実測は `違反 1 件` であった**〔レビュー 高-1 が検出〕。**⇒ `progress-log.md` へ索引行を追記したうえで回し直し、`検査した 65 件すべてが progress-log に現れる(ALLOW 除外 10 件) / 結果: 違反なし` を確認した。★偽の緑を返しうる**（followup §AH）**ため、`grep -n "^### M24-09d" docs/progress/progress-log.md` → `5129:` で索引行そのものも目で確かめた** |
| `go vet ./...` ／ `go build ./...` | 成功 |

---

## 12. 指示書 §2.2「変更しないもの」の確認

| 対象 | 実測 |
|---|---|
| `web/playwright.config.ts` の `workers` | **`workers: 1`（`:99`）。ファイル自体の `git diff` が 0 ファイル** |
| `internal/testutil/` 以外の `internal/` | **`internal/infra/migration/template_exclusion_test.go` の新規 1 本のみ**（テストファイル。本番コードは 1 バイトも変えていない） |
| `internal/service/notation/` / `internal/service/preset/`（契約 F-1） | **`git diff` 0 ファイル** |
| 既存テストの本数と assert | **消えたテスト 0 本 / skip 5 件のまま**（§3.1） |
| `make e2e` の挙動 | **`make -n e2e` の展開はシェルとして従来と同義**（★逐語一致ではない——`ENSURE_PW_CHROMIUM` の行継続が畳まれるため 1 行化される）。**実行も 215 passed で従来どおり** |
| `migrations/` | **`git diff` 0 ファイル** |
| `pr-checks.yml` への E2E 追加 | **していない**（実行ステップの `grep` が 0 件。コメントのみ是正） |
| `CHANGE-145` の番号 | **消費していない**（新規 CHANGE 起票 0） |

---

## 13. 申し送り（**設計伝達レポート §4 の候補**）

1. **★★`M24-13` の「`tsc --noEmit` はテストファイルを型検査しない」が再現しなかった**（§8-1）。**`web/CLAUDE.md` §3 には実測した事実のほうを書いた。** followup `tsc-noemit-excludes-test-files` の記述と、`M24-13` 完了報告 §10 の記述が現物と食い違っている。**⇒ 設計卓が followup 側をどう畳むかの判断が要る。** なお**運用上の帰結は変わらない**——`web/e2e/` は依然どちらの経路でも型検査されず、`SUPP-001` §4.5 の「積み残し（`playwright.config.ts` を `tsconfig.json` の `include` へ未追加）」がそのまま生きている。
2. **★★nightly の `e2e` job は、マージ前に CI 実機で観測済みである**（§7.1。**緑 / 215 passed / 2 コアで 335 秒**）。**⇒ `CHANGE-145` §2.2 の条件「§4.3 が成立した場合のみ `SUPP-001` §4.5 を反映する」は満たされた。★反映対象である。** あわせて **§4.5 の逐語「CI は本フェーズでは構築せずローカル実行」は失効している**（§8-6 の走査に `supp-001-detailed-design.md:570` として挙げた）。**★残るのは 2 つ**——(a) **先回りした 2 つの手当て**〔`Warm Go build cache` ／ `playwright install --with-deps`〕**が必要だったかは切り分けていない。外すなら実測すること** ／ (b) **破壊確認 4 を「本物」で採るかは未了**（§9。未検証のまま残るのは GitHub 自身の step 失敗の契約だけであり、本サブのコード側は 3 点ともローカルで確認済み）。
3. **★これ以上の `go test` の短縮は `internal/infra/migration` に手を入れない限り得られない**（§3.2）。同パッケージが wall 43.2 秒のうち 37.6 秒を占め、その 99 テスト中 97 本が自前で `migration.Run` を呼ぶ。**★本サブのスコープ外（§1.6-3）であり、やるなら別サブの規模になる。**
4. **★除外（`internal/infra/migration`）は、現時点では既存テストの結果を 1 本も変えていない**（§9 破壊確認 2）。**残す判断とその根拠 3 件を §9 に書いた。** `CHANGE-145` を as-built へ合わせるとき、この事実を落とさないこと。
5. **★ワークフロー名を `Nightly cross-build` → `Nightly` へ変えた**（§5.1）。`README.md` 3 か所を追随させてある。**必須 check ではないため PR への影響は無い。**
6. **★★`CHANGE-145` の影響設計書欄へ `DES-002` §11.3 / §12 を足す必要がある**（§8-6）。**★★同節の契約 (4) は「E2E は CI に載せない」を否定形で明文化しており、しかも「否定形で書いておかないと、次の担当が再実行で緑にして載せる」と予告していた。** その予告どおりのことが、**契約を誰も参照しないまま**起きている（起票時の影響設計書欄に `DES-002` が無かったため）。**⇒ `M24-13` 横断課題 1 の「影響設計書の欄は起票時の見込みであって全数ではない。as-built で設計書を直接 `grep` して数え直すこと」が、2 サブ連続で当たったことになる。**
7. **★followup `§AR` の状態列が 2 件とも旧のままである**（設計卓の手番。**製造が直接書けるのは §J だけである**＝`D-382`）——`playwright-narrow-run-env-trap` は**本サブで解消**したが「★起票済」のまま ／ `tsc-noemit-excludes-test-files` は**記述そのものが現物と食い違う**（§8-1）。
8. **★レビュー報告書の置き場が、製造 CLI（`docs/progress/m24-09d-review.md`）とチェックリスト §0.4（`docs/progress/M24-09d-review-report.md`）で食い違っている**（レビュー 低-7）。**本サブは CLI と先例（`m24-13-review.md`）に従った。** チェックリストの雛形側の是正は設計卓の手番。

---

*以上、M24-09d 完了報告。* **★★本サブの正しさの根拠は速度ではない**——**ok パッケージ数 55・FAIL 0・skip 5 が不変であること、消えたテストが 0 本であること、破壊確認 1 で 6 パッケージが赤くなったこと、そして除外の有無が `MigrationRunCount()` という速度以外の指標で観測できることである。**
