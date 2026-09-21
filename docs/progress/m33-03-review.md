# M33-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象サブ | M33-03（ガードと資料の作り直し） |
| 対象指示書 | `docs/instructions/M33-03-guards-docs-and-migration-path.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M33-03-review-checklist.md` v1.0.0 |
| 着手基点 | `9de8fa9` |
| レビュー時点の HEAD | `919ee71`（段 1〜6 の 7 本 ＋ 完了報告の 1 本） |
| レビュー日 | 2026-09-19 |

> 本レビュー中に `919ee71`（完了報告 ＋ `progress-log` 索引行）が着地した。
> 報告を入力に取る検査は、その着地後にもう一度回した（`D-890`。§検査の再実行）。

---

## 総評

分類の内訳・検算・破壊確認・未充足の明示という、本サブでいちばん落ちやすい 4 点はすべて満たされている。
歴史テスト 141 本の内訳（消した 102 ／ 書き直した 34 ／ 諮った 5）は git から独立に再構成して一致を確認し、
`000007` を指す 4 箇所も名指しで是正を確認した。ガードは空回りの是正・規則 (4a) の書き込み先検査・規則 (5) の新設まで
進んでおり、破壊確認 3 件はどれも「塞ぐ前は緑」と「赤くした規則番号」を示している。射程越境は 0（`migrations/` ／
`docs/design/` ／ `followup-backlog.md` ／ `squash-research/` の差分がいずれも 0 行）。

一方で「緑にするために主張を捨てていないか」の観点では、看過できない残りがある。第一に、契約テスト 39 本が
HEAD 終端へ移ったのに `SUPP-001` §5.5.2 規約 (2) が要求する専用ファイル・専用名前空間へ移されておらず、CHANGE 原稿も
出ていない。第二に、その結果として 10 ファイルに「HEAD を終端にしない」という設計原則の逐語が残り、同じファイルの
コード 3 行下で `m.Up()` を呼んでいる。第三に、削除した (i) 102 本の中に HEAD で表現できる主張が少なくとも 6 種類
含まれており、その期待値表だけが誰も読まない孤児として file 内に残っている。第四に、移行プロンプトが
`schema_migrations` を運ばない旨を書いておらず、乾式を行っていないため誰も気づいていない。

---

## 設計準拠性レビュー結果

| 束 | 観点 | 評価 | 要旨 |
|---|---|---|---|
| **A** | 失効参照の是正（段 1） | **◎** | 4 箇所を名指しで確認。番号だけ差し替えず出所（新）と経緯（旧）を分けた書き直しになっている。`000001_init_schema:106` の行番号参照まで実物と一致 |
| **B-1** | 141 本の分類と検算 | **◎** | 102 / 34 / 5 が git 由来の独立再構成と一致（§検算） |
| **B-2** | (iii) を諮ったか | **◎** | 5 本は消さずに諮り、述語の突き合わせへ作り直されている。母数の生存確認も各テストに入った |
| **B-3** | (i) の削除が妥当か | **×** | HEAD で表現できる主張を少なくとも 6 種類落としている。孤児の期待値表がその証跡（高-3） |
| **B-4** | 規約 (2) の遵守 | **×** | HEAD 終端へ移した 39 本がサブ名の名前空間に残り、CHANGE 原稿も無い（高-1） |
| **C** | golden 17 stem（段 3） | **○** | 対応が付かないことを諮って裁定を得た経路は正しい。ドリフト 0/34 の実測も良い。ただし `cmd/seedgen` の doc に恒常赤の手順が残る（高-5） |
| **D** | ガード（段 4） | **◎** | 空回りの是正・規則 (4a)/(5) の新設・破壊確認 3 件・自己検査 15 対照。どの規則が赤くしたかまで出力で示されている |
| **E** | 移行手順（段 6） | **△** | 投入順・2 パス・`sqlite_sequence` の 3 点は `migrations/000001` の `REFERENCES` と突き合わせて正しい。ただし `schema_migrations` の扱いが欠け（高-4）、`PRAGMA foreign_keys` が未指定（中-3）、hybrid 4 表の PK 飛ばしが編集済み行を黙って落とす（中-2） |
| **F** | 資料（段 5） | **○** | `code-facts` §10 は新系列 9 本と一致。`release-targets.sh` の 20 本 → 10 本も実施 |
| **G** | 射程（やらないこと） | **◎** | `ls migrations/*.up.sql` = 9 本。`migrations/` ／ `docs/design/` ／ `followup-backlog.md` ／ `squash-research/`（16 ファイル）の差分 0 |
| **H** | 報告 | **◎** | 内訳・実測・未充足・申し送り 8 件が揃っている。完了条件の逐条確認で ✗ を隠していない |

### ★検算（分類の内訳を自分で数え直した）

git の実体だけから再構成した。

```
9de8fa9 の internal/infra/migration の Test 関数     170 本
919ee71 の同                                          70 本
消えた名前 111 本 ／ 増えた名前 11 本 ／ 同名で残存 59 本
```

| 対応づけ | 本数 | 根拠 |
|---|---|---|
| (i) 消した | **102** | 消えた 111 − 改名 8 − 「緑だったが誤りなので消した」1 |
| 改名して残した（(ii) の一部） | **8** | `*_V63State` / `*_V106State` / `*_V107State` / `*_V108State` / `*_V110State` / `*_V111State` / `*_V112State` / `*_V115State` → いずれも `*_CorrectedState` |
| 同名で書き直した（(ii) の残り） | **26** | 残存 59 − 着手時から緑だった 28 − (iii) 5 |
| (ii) 合計 | **34** | 8 + 26 |
| (iii) | **5** | `TestM1905_*`（名前も本文も残存・全件改訂） |
| 141 の外 | 1 | `TestRun_M3503_FreshDBIsAlreadyCorrectBeforeTerminus`（緑だったが前提が消滅） |

**⇒ 102 + 34 + 5 = 141 は成立する。** 着手時の緑 29 本（170 − 141）も、残存 28 ＋ 削除 1 で辻褄が合う。
報告の主張は独立に検算できた。

### ★検査の再実行（自分で回した）

| 検査 | EXIT | 実測 |
|---|---|---|
| `check-artifact-integrity.sh` | 0 | 検査 17 件 ／ ALLOW 除外 1 件 ／ 生成物 4 件 OK |
| `go test ./...` | **0** | `--- FAIL` **0 件** ／ `ok` 60 パッケージ |
| `check-migration-license.sh` | 0 | 凍結表 層 A 4 本 / 層 B 5 本 |
| `check-migration-license.sh --self-test` | 0 | **全 15 対照 OK**（陽性 12 / 陰性 3。規則 (4a)/(4b)/(5) がそれぞれ名指しで赤くなることを確認） |
| `check-public-snapshot.sh` | 0 | 母数 3066 / 公開 3037 / 除外 29 |
| `check-doc-refs.sh` | 0 | dead reference なし |
| `check-derived-docs.sh` | 0 | `code-facts` **0 / 1080 件**（最新）。`docs-map` は 140 / 1710 件（8%）で陳腐化疑い。ただし源泉コミットは `9de8fa9` であり本サブ以前からの状態 |
| `check-progress-log-index.sh`（報告着地後） | 0 | 119 件すべて `progress-log` に現れる |
| `check-completion-report-md-emphasis.sh`（報告着地後） | 0 | 製造 CLI 4 本 ＋ テンプレート §7.4 の手順が残存 |
| `check-doc-inventory.sh` | 0 | 型に無いファイルなし |
| `check-md-emphasis.sh docs/progress/M33-03-completion-report.md` | 0 | 0 行 |
| `go run ./cmd/seedgen -check -migrations internal/seedgen/testdata` | 0 | OK: 生成物は既存ファイルと一致 |
| `go run ./cmd/seedgen -check`（doc が載せている形） | **1** | **DIFF 2 件**（高-5） |

`pnpm test` と `make e2e` は本レビューでは回していない（完了報告 §9.2 / §9.3 の実測値をそのまま引く。
独立確認はしていない旨を明記する）。

### ★`git diff --numstat 9de8fa9` の読み（`E-225`）

新規 36 ファイル（`internal/seedgen/testdata/` 34 ＋ `helpers_test.go` ＋ `scripts/migrate-userdata-prompt.md`）の
deletions 合計は **0**。新規のつもりのファイルに `-` は付いていない。

削除は **13 ファイル**（すべて `internal/infra/migration/migrate_*_test.go`。指示のあった「15 ファイル」は
`--diff-filter=D` の実測では 13 であり、`migrate_test.go` の `0 / 950` と `migrate_m1403f_test.go` の
`15 / 1127` は「ファイルは残り中身が大きく消えた」形である）。13 ファイルはいずれもテスト 0 本になったものであり、
ファイル単位の削除自体は妥当。**問題は中身の落とし方であり、それは高-3 に書く。**

---

## 設計準拠性以外の指摘事項

### 非参照になった宣言が 64 件以上残っている

コメントを除いた参照が宣言 1 行だけの識別子を数えた（実測 **63 件** ＋ `helpers_test.go` の `aliasText`）。
`go vet` も `gofmt` もパッケージ級の未使用宣言を見ないため、全部緑のまま残る。

| ファイル | 件数 | 代表例 |
|---|---|---|
| `migrate_m1403f_test.go` | 16 | `fourthWaveExpectation`（型ごと。フィールド 8 件を含む） / `m1403fSeeded17` / `m1403fMovementTotals` / `m1403fCustomStates` / `m1403fDerivationCounts` / `m1403fJumpDerivCounts` / `m1403fNew12` |
| `rules_m1905_test.go` | 15 | `m1905FillerCandidatesBefore` / `m1905TargetComboTotal` / `m1905ExclusionSetUnknown` ほか v68 の凍結リテラル群 |
| `migrate_m2003_test.go` | 7 | `aliasValueDigest` / `movesDigest` / `indexSQL` / `indexIsPartial` / `m2003Origin` / `m2003Unique` / `m2003ColumnAdded` |
| `migrate_m3007_test.go` | 6 | `assertRescuedValuesM3007`（関数ごと） / `m3007RescueUnsetValues` / `placeholdersM3007` / `toAnyM3007` / `m3007Before` / `m3007Terminus` |
| `migrate_m2006_test.go` | 3 | `m2006Origin = 75` / `m2006Numeric = 76` / `m2006SRK = 77` |
| `migrate_m1904c_test.go` | 3 | `m1904cTerminus = 63` / `m1904cProjectileTotal = 135` / `m1904cLegacyFrames` |
| `m2805` / `m3002` / `m3502` / `m3704` / `m3105` / `m3104` / `m1403d` | 各 1〜2 | `*Before` / `*Terminus` の版数定数 ／ `manonCSVMoves` / `manonMovementMoves` |
| `helpers_test.go` | 1 | `aliasText`（★移設した先で 0 呼び出し。同ファイルの基準「2 ファイル以上から使われること」に自分で反している） |

完了報告は「未使用になった宣言 25 件を削除」と書いているが、消し残りが同じ桁で残っている。
**版数定数（`m2006Origin = 75` 等）が残っているのは本サブの目的に照らして特に悪い**——本サブは「版数を直書きした
テストの処遇」そのものが射程であり、テスト本文からは消えたのに定数だけが 75 / 77 / 63 / 106 / 111 の値で居座っている。

### `GAME_TABLES` の `custom_states` は表ではなく列

`scripts/check-migration-license.sh:150` の `GAME_TABLES` に `custom_states` が入っているが、実体は
`characters.custom_states` の列であり、`migrations/000001_init_schema.up.sql` に同名の表は無い。
`_WRITE_RE` は表名位置しか捕まえないため害は無いが、規則 (4b) の対象集合に永久に当たらない要素が 1 つ混ざっている。
本サブ由来ではない（`M26-02` 期からの持ち越し）が、段 4 でこのタプルへ `APP_TABLES` を並べて足した手番で
気づける位置にあった。

### 規則 (5) の走査範囲が 1 ディレクトリのハードコードである

`REUSE.toml` の層 B は `character_data/**` ／ `docs/seed-data/**` ／ `migrations/*_data_*.sql` ／
`internal/seedgen/testdata/**` の 4 グロブで、規則 (5) が見るのは 4 つ目だけである。
実査した限り、いま層 A へ落ちている SF6 由来データは無い（`git ls-files` の `*.csv` / `*.sql` を層 B の 4 グロブと
`scripts/**`＝層 C の外で数えると、残るのは `docs/progress/20260906-squash-research/` の調査資料 4 件のみで、
これは DDL とメタデータであって SF6 の事実ではない）。**つまり「ほかに同型の穴」は現時点では見つからない。**
ただし塞ぎ方が「移した先の名前を 1 つ足す」形であるため、`D-777` の一般形（グロブから外れた先が既定）は
次に置き場が動いたときにまた開く。恒久形は「追跡ファイルの全数について解決先を出し、層 A に落ちた
`*.csv` / `*.sql` を報告する」である。

### `assertGolden` 周辺の doc が「コミット済み」を残している

`internal/seedgen/generate_m1702_test.go:182` ほか 17 箇所が「コミット済みの 000034 と一致することを保証する」と
書いており、直後の括弧で「出力先は `migrations/` ではなく `internal/seedgen/testdata/`」と補っている。
補足があるので誤読は避けられるが、主節が旧の言い方のままである。

### `TACPENDIUM_UPDATE_GOLDEN=1` は 34 本を一括上書きできる

再生成を CLI から test へ移したのは転記経路を消す良い変更だが、環境変数 1 つで 34 ファイルが書き換わる。
`assertGolden` の失敗メッセージは「特定してから更新すること」と言うが、機械的な歯止めは無い
（`-check` 時代は `diffHint` が同じ文言で、やはり歯止めは無かったので後退ではない）。
`git diff` が唯一の検出経路であることを `SUPP-001` §5.5 規約 (19) 側へ 1 行書いておくのが安い。

---

## 推奨修正（優先度別）

### 高（M33 完了前に修正必須）

**高-1. `SUPP-001` §5.5.2 規約 (2) に反した状態で着地しており、CHANGE 原稿も無い**

規約 (1) は「`m.Up()`（HEAD 終端）を使ってよいのは『HEAD が何であっても成り立つ』ことを意図的に主張したいときだけ」
と書いており、本サブの書き直しはその範囲内である。**問題は規約 (2) のほうである**——同規約は
「HEAD スコープの不変条件は、専用ファイル・専用の名前空間に置く。`migrate_head_test.go` に `TestRun_HEAD_*` として置き、
`TestRun_M14xx_*` のようなサブ名の名前空間へ相乗りさせない」と明示している。

実測（`919ee71`）:

| 区分 | 本数 | 置き場 |
|---|---|---|
| (ii) の書き直し 34 本 | **34** | `migrate_m1403b/c/d/f` / `m1801` / `m1802` / `m1903` / `m1904c` / `m2003` / `m2006` / `m2408` / `m2805` / `m3002` / `m3007` / `m3104` / `m3105` / `m3502` / `m3503` / `m3704` の 19 ファイル。名前は `TestRun_M28xx_*` 等のまま |
| (iii) の 5 本 | **5** | `rules_m1905_test.go`。名前は `TestM1905_*` のまま |
| `migrate_head_test.go` へ引き上げ | 2 | `TestRun_HEAD_DownUpRoundTrip` / `TestRun_HEAD_StartupBasisPartitionsAllMoves`（いずれも新設） |

39 本が HEAD の不変条件を主張しながらサブ名の名前空間に居る。規約 (2) が避けたかった害はそのまま起きる——
後続サブが seed を足して `TestRun_M3105_OptionsWellFormed` が落ちたとき、名前は M31-05 を指すが原因は新しい波にある。
規約 (2) は「契約テストが落ちたら実装を直す／HEAD テストが落ちたら期待値を更新するのが正しい対応になり得る」という
対応の違いを守るための規約なので、混ぜると次の担当が判断を誤る。

**⇒ 採るべきはどちらか。**
(a) 39 本を `migrate_head_test.go`（または `head_*_test.go` 群）へ移し `TestRun_HEAD_*` へ改名する。
(b) 規約 (1)/(2) が「区間が 1 つしかない世界」では成立しないことを CHANGE 通知書の原稿として起票し、
サブ名を残す形を as-built として明文化する（`migrate_head_test.go:10` のコメントが既に
「版数を名指しして区間を閉じる形そのものが成立しなくなった（区間が 1 つしか無い）」と書いており、
この認識は正しい。**書く先がコメントではなく設計書でなければならない、というだけである**）。

完了報告 §15 の申し送り 8 件に本件は入っていない。指示書 §2.7 は CHANGE 0〜2 本を見込んでいるので、
(b) を採るなら原稿 1 本が設計伝達レポート §1 / §6 へ要る。

**高-2. 撤回済みの設計原則の逐語が 10 ファイルに残り、同じファイルのコードが真逆を実行している**

`m.Up()` へ書き換えたのに、その理由づけのコメントを書き換えていない。実測:

| 箇所 | 残っている記述 | 実際のコード |
|---|---|---|
| `migrate_m1904c_test.go:49-60` | 「★HEAD（`m.Up()`）を終端にしない。`SUPP-001` §5.5 の規約 (1)——」＋ `const m1904cTerminus = 63` | `:196` で `m.Up()` |
| `migrate_m2006_test.go:10-11` | 「終端 = 本サブの最終連番 v77。`m.Up()`（HEAD 終端）を使わない——」 | `:85` `:141` で `m.Up()` |
| `migrate_m2003_test.go:11-12` | 同型（v73 → v75） | `:65` ほかで `m.Up()` |
| `migrate_m2805_test.go:45` / `m3002_test.go:47` / `m3007_test.go:34` / `m3104_test.go:28` / `m3502_test.go:57` / `m3503_test.go:75` | 「★HEAD（`m.Up()`）を終端にしない。`SUPP-001` §5.5 の規約 (1)——」 | いずれも `m.Up()` |
| `migrate_m1403c_test.go:44` | 「★終端は v30（自サブの最終連番）である。HEAD ではない」 | `:60` で `m.Up()` |

あわせて、同型の失効記述が次の箇所にもある。

| 箇所 | 残っている記述 | 実態 |
|---|---|---|
| `migrate_m1403f_test.go:8-12` | 「マイグレ 000082〜000091。…⇒ **本テストは v80 → v91 で移動する**」 | 4 箇所すべて `m.Up()` |
| `migrate_m1403f_test.go:404`（＋ファイル末尾に再掲） | 「★第一段(v91)・第二段(v95)・第三段(v99)・第四段(v101)の**テストは変更しない**」 | 4 段とも本サブで変更した |
| `migrate_m1403d_test.go:8-19` | 「消費連番は 000043〜000048」の 6 行表（各連番が何を投入するかを現在形で列挙） | 新系列に該当ファイルは無い。`m.Up()` で HEAD を見る |
| `migrate_m1904c_test.go:21` | 「down → re-up の往復が追随経路の実質的な検証になっている（**`TestRun_M1904c_DownUpRoundTrip`**）」 | 同テストは本サブで削除済み。存在しないテストを指している |
| `migrate_m1904c_test.go:10` / `:57` / `:122`（`assertV63StateM1904c`） / `:192` | 「v63 時点の状態で固定する」「`m1904cProjectileTotal = 135` も『v63 時点の値』として安定する」 | 135 の固定は本サブで外した。関数名も v63 を名乗るが HEAD を見る |
| `migrate_m1403c_test.go:9` | 「`movementCodes` は M14-03b（**000025**）投入の移動 system move 9 種」 | 新系列に `000025` は無い（旧の明示が無い） |

優先度較正に従って「高」に置く。理由は較正文のとおり——テストも lint も型検査も緑であり、
後任は本文をコピーして注記を読まない。とくに高-1 の判断（規約 (2) をどう畳むか）をこの先に行う担当は、
まずこの 10 ファイルのコメントを読んで「区間を閉じるのが正しい」と理解してしまう。

**高-3. 削除した (i) 102 本の中に、HEAD で表現できる主張が少なくとも 6 種類含まれている**

指示書 §0.3 / §3-3 の「緑にするために主張を捨てること」に当たる。**証跡は、期待値表だけが孤児として残っていること**である。
（もし本当に「新系列では言いたくない」主張なら、表も一緒に消えているはずである。）

| # | 落ちた主張 | 残っている孤児 | HEAD で言えるか | 現在のカバレッジ |
|---|---|---|---|---|
| 1 | **`preset_aliases` の `alias_text` が、同一プリセット・同一キャラの別技の `alias_text_en` と交差しないこと**（`D-317`） | — | 言える（版数に依存しない） | **どこにも無い**。`grep` で全 `*_test.go` を走査して 0 件。削除された `TestRun_M2006_UniqueIndexesIntact` (4) のコメント自身が「**列を跨ぐため UNIQUE では表現できず、検査でしか守れない**」と書いていた |
| 2 | **一意制約 3 本が実データで破れていないこと**（`(preset_id, move_id)` / `(preset_id, character_id, alias_text)` / 同 `_en`） | — | 言える | **無い**。残った `TestRun_M2003_ConstraintActuallyBites` は「制約が噛むか」を破壊テストで見るだけで、実データの違反 0 件は見ていない（`HAVING count(*) > 1` の走査が repo 全体で 0 件） |
| 3 | **P-34 の行が `character_id` を持っていること**（nullable なので入れなくても INSERT が通り、部分索引に当たらない） | — | 言える | 無い |
| 4 | **移動 system move の `total` が開発者提供の実測値であること** | `m1403fMovementTotals`（`:47`。「★開発者提供・実測値（2026-09-02 受領）」「残りは開発者提供が唯一の根拠」） | 言える | **無い**。新設の `TestRun_HEAD_SeedValuesMatchCSV` は「CSV に行が無い move は対象外（移動 system move・連打版）」と明記しており、移動 9 種は母集団の外。`TestRun_SeedRowCounts` も見ていない |
| 5 | **`move_derivations` のキャラ別 子件数・ペア数**（旧 `000101` / `000102` ぶん） | `m1403fDerivationCounts`（`:324`。「★1 つずつ固定する——`INSERT ... SELECT` は子や親が居なくても 0 行投入で成功してしまう（サイレント no-op）」） ／ `m1403fJumpDerivCounts`（`:408`。ファイル末尾の孤児） | 言える（配布シードの最終状態の事実） | 部分的（`TestRun_M1403f_JumpNormalsHaveNoParent` が jump 系だけを見る） |
| 6 | **第四波で投入した `custom_states` 9 状態** | `m1403fCustomStates`（`:63`） | 言える | 部分的（`TestRun_SeedRowCounts` は ryu / ingrid / c_viper の 3 件のみ） |
| 7 | 参考 | `fourthWaveExpectation` 型（`:17`。`csvMoves` / `derived` / `rush` / `indexRows` / `projectiles` / `sbStandalone` / `sbThrough` / `sbUnknown` / `fastestU` / `numeric` / `srk`） | `is_derived` / `is_projectile` / `move_commands` 件数は HEAD でも言える | `is_derived` / `is_projectile` / `command` は `TestRun_HEAD_SeedValuesMatchCSV` の 9 列（`category` / `damage` / `startup` / `active` / `total` / `on_hit` / `on_block` / `recovery` / `is_aerial`）に**入っていない** |

**⇒ 求めること。** (1)(2)(3) は行数を書かない形でそのまま HEAD テストへ移せる（元の SQL がそのまま使える）。
(4)(5)(6) は孤児の表をそのまま期待値として `TestRun_HEAD_*` へ移すか、**移さないなら表も消すこと**。
そのときは「なぜ主張をやめたか」を完了報告と設計伝達レポートへ 1 行ずつ書く。
どちらでもよいが、**いまの状態（表は残り、誰も読まない）だけは選べない**——次に触る担当は表を見て
「固定されている」と読む。

**高-4. 移行プロンプトが `schema_migrations` を運ばない旨を書いていない**

`scripts/migrate-userdata-prompt.md` は「運ばない（配布シード）」に 5 表、「運ぶ」に 16 表を挙げるが、
`schema_migrations` にも `sqlite_sequence` にも触れていない。ところが §3 は
`sqlite_sequence` を**運べ**と指示している。⇒ ローカル AI から見ると「列挙された 21 表 ＋ システム表の
`sqlite_sequence` は運ぶ」であり、**`schema_migrations` も同じ扱いに読める。**

運んだ場合の帰結は軽くない。`golang-migrate` は `schema_migrations` の 1 行だけで現在版数を持つため、
旧 DB の `version = 117` が入った新 DB は次回起動時に `no migration found for version 117` で abort する
（先例は `followup-backlog.md:357` の `distribution-existing-db-migration-failure` と
`20260907-m28-05-design-exceptions.md:130` の「`main` へ戻っても起動が落ちない」の記述）。
しかも 2 回目以降は dirty フラグが立って即停止するため、原因の切り分けが難しくなる。

**⇒ プロンプトへ 1 行足すこと。** 「`schema_migrations` は運ばない（新 DB の版数 9 をそのまま使う）。
運ぶと次回起動が `no migration found for version N` で止まる」。
乾式を行っていないため、この欠けは走らせるまで誰も踏まない。指示書 §4.3 が警告していたのは投入順だったが、
実際に最初に壊れるのはここである。

**高-5. `cmd/seedgen` の doc が載せている `go run ./cmd/seedgen -check` が恒常的に赤になる**

実測（本レビューで実行）:

```
$ go run ./cmd/seedgen -check
DIFF: migrations/000026_seed_moves_first_wave.up.sql は生成物と一致しません
DIFF: migrations/000026_seed_moves_first_wave.down.sql は生成物と一致しません
exit status 1
```

`cmd/seedgen/main.go:22` の使い方ブロックは `go run ./cmd/seedgen -check` を「生成物と既存ファイルの
差分のみ確認」として今も載せている。既定の `-migrations` は `migrations` であり、既定 stem は
`seedgen.FirstWaveStem`（= `000026_seed_moves_first_wave`）なので、比較先が存在しない。
`:38` に「★凍結 golden を CLI から触るときは `-migrations` で置き場を明示する」という正しい形が足されてはいるが、
上のブロックが直っていない。

**しかも失敗メッセージが誤誘導する**——`diffHint` は「`TACPENDIUM_UPDATE_GOLDEN=1 go test ./internal/seedgen/` で
更新すること」と言うが、それを実行しても `-check` は赤のままである（更新先が `testdata/` なので）。
これは同ファイル `:75` のコメント自身が警告している形そのものである——
「かつ `-check` が恒常的に赤になり、『赤いのが普通』になって実際のドリフトを検出できなくなる」。

あわせて副作用が 1 つある。`-check` を付けずに `go run ./cmd/seedgen` を実行すると、
`migrations/000026_seed_moves_first_wave.{up,down}.sql` を**新規に書き込む**（`main.go:245`）。
`check-migration-license.sh` の規則 (4b) が赤くするので気づけるが、既定の実行が凍結系列へファイルを
足す形になっているのは本サブ由来の後退である。

**⇒ 求めること。** (a) 使い方ブロックの `-check` 行を `-migrations internal/seedgen/testdata` つきへ直す。
(b) `formatFor`／`preM2003Stems` と同じ判定で「出力先 stem が凍結 golden なら `-migrations` の既定を
`internal/seedgen/testdata` にする」か、`-migrations` 未指定での凍結 stem の書き込みをエラーにする。
(c) `diffHint` の文言に「比較先が `testdata/` であることを確かめよ」を足す。

### 中（次サブ着手と並行可）

**中-1. 非参照になった宣言 64 件以上を消す**（§設計準拠性以外 の表）。とくに `m2006Origin = 75` /
`m2006Numeric = 76` / `m2006SRK = 77` / `m1904cTerminus = 63` / `m2805Terminus = 106` / `m3007Before = 111` /
`m2003Origin = 73` / `m3502Before` / `m3002Terminus` 等の**版数定数**は、本サブの射程そのものである。
`helpers_test.go` の `aliasText` は呼び出し元 0 のまま移設されている。

**中-2. 移行プロンプトの hybrid 4 表の「同じ主キーなら飛ばす」は、利用者が編集した seed 行を黙って落とす。**
`tags` の名前・色、`preset_aliases` の表記は利用者が編集できるユーザーデータである（`CLAUDE.md` §10.X が
「プリセットエイリアス」を DB 永続化対象のユーザー入力データとして名指ししている）。
旧 DB で seed 行を編集していると、主キーが一致するため飛ばされ、**新 DB の seed 値に戻る。**
プロンプトは「飛ばした件数を数えて報告」と書いているが、`preset_aliases` の飛ばし件数は 7,600 台になるので、
その中に紛れた数件は見えない。**⇒ 「飛ばす前に値を比較し、内容が違う行だけを列挙して報告する」へ変えること。**

**中-3. `PRAGMA foreign_keys` の状態を指定していない。** プロンプトは「投入順（外部キーの依存順）」を
「これが欠けると必ず失敗する」と書くが、Python の `sqlite3` は既定で FK 強制が OFF なので、順序を無視しても
INSERT は通り、最後の `foreign_key_check` だけで判定される。⇒ 記述が現物の挙動と合っていない。
どちらの運用を採るかを決めて書くこと（`PRAGMA foreign_keys=ON` で投入順を機械に守らせる／OFF のまま
最後の `foreign_key_check` を唯一の判定にする）。**なお投入順そのものは正しい**——
`migrations/000001_init_schema.up.sql` の `REFERENCES` 全 35 行と突き合わせ、
16 表すべての依存先が自分より前の群に入っていること、`combo_setup_results` の複合 FK が
`combo_setups` より後であること、`combos` の自己参照 2 本（`:164` `materialized_from_combo_id` /
`:165` `superseded_by_combo_id`）が 2 パスの対象として正しいことを確認した。
`combos` / `combo_oki_options` が 0 行でも `sqlite_sequence` に行を持つ点も `000001:309-310` の
明示 INSERT と一致する。

**中-4. `TestRun_M2006_P34Rows` の母集団の閉じ方で「余分に入れた」の検出範囲が縮んだ。**
着手時点は「当該プリセットで `alias_text_en` を持つ非 system 行が 13 行ちょうど」であり、
**P-34 以外の行に `alias_text_en` が付いたら赤くなった**。書き直し後は P-34 の 13 件を 1 件ずつ数える形なので、
その性質が消える（報告 §4.3 の「ガードの強さは変わらない」は、この点で正確でない）。
波が進むと落ちるという指摘は正しいので、次の形にすれば両方を満たせる。
「`alias_text_en` を持つ非 system 行の集合が P-34 を含み、かつ P-34 以外の要素は許可表に載っているものだけである」。

**中-5. `csv_db_sync_test.go:210` の「2 本あわせて CSV の全列が母集団になる」は不正確。**
`seedgen` の `moves` INSERT は 12 列（`internal/seedgen/generate.go:221`）であり、新テストが見る 9 列 ＋ `code` ＋
`character_id` ＋ `raw_data` で閉じる。一方 `csvColumns`（`internal/seedgen/model.go:30`）は 25 列あり、
**`is_projectile` / `is_derived` / `original_move_code` / `command` / `name_ja` は 2 本のどちらの母集団にも入らない**
（前者 2 つは別モード生成、`command` は `move_commands` 側、`name_ja` は alias 側）。
高-3 の 7 行目と同じ穴である。文言を実態へ合わせるか、列を足すこと。

**中-6. 規則 (5) を「層 A に落ちた `*.csv` / `*.sql` の全数報告」へ一般化する**（§設計準拠性以外）。
いま同型の穴は見つからないが、塞ぎ方が置き場の名前に依存している。

**中-7. `check-migration-license.sh` の `GAME_TABLES` から `custom_states` を外す**（列名であり表ではない）。
本サブ由来ではないが、`APP_TABLES` を足した手番に同じタプルを読んでいる。

### 低（将来対応）

**低-1.** `assertGolden` 群の doc の主節「コミット済みの 000034 と一致することを保証する」を
「凍結 golden の 000034」へ。括弧の補足で誤読は避けられるが主節が旧。

**低-2.** `TACPENDIUM_UPDATE_GOLDEN=1` の歯止めが `git diff` だけであることを
`SUPP-001` §5.5 規約 (19) 側へ 1 行（設計卓の手番）。

**低-3.** `assertV63StateM1904c` の関数名を役割で書き直す（`SUPP-001` §5.5.4 規約 (16) (d)「見出しは役割で書く」）。
高-2 と同じ手番で直るはず。

**低-4.** `docs-map` は 140 / 1710 件（8%）で陳腐化疑い。源泉コミットは `9de8fa9` なので本サブ以前からの
状態であり、完了報告 §8 の「Phase D の後に回す」判断は妥当。Phase D で実行されたかを取り込み時に確認すること。

**低-5.** `internal/seedgen/testdata/` の 34 ファイル（約 16,000 行）が公開スナップショットへ入る
（`ALLOW internal/**`）。旧 `migrations/` 時代も公開されていたので変化は無いが、
配布バイナリには入らないテストデータが公開物として増えた事実は `DES-001` §5.1 の反映時に一度見ておくとよい。

---

## 良かった点

- **分類の内訳が検算可能な形で書かれている。** 102 / 34 / 5 を git の実体から独立に再構成して一致した。
  さらに「機械判定 94 ＋ 書き直しを試みて (i) と判明した 8」まで分けて 8 本を名指ししており、
  「機械判定を鵜呑みにしていない」ことが検証できる。`TestRun_M3503_FreshDBIsAlreadyCorrectBeforeTerminus` を
  「緑だったが誤りなので消した（141 の外）」として別立てにしたのも正確である。
- **根本原因を先に潰している。** `versionBefore(t, 110)` が黙って 9 を返す（`t.Fatalf` は `best == 0` のときだけ）
  ことを見つけて先に直したのは、書き直したテストが同じ形を再生産するのを防いでいる。
  副産物として「緑だったが前提が消滅していた 1 本」を掘り出した。
- **(iii) を勝手に消さず、しかも書き直しがトートロジーになっていない。** `rules_m1905_test.go` の
  「旧規則＝テスト内の SQL 述語 / 新規則＝本番の `ProjectCandidates`」という分業が
  **同ファイルのコメント自身に既に書かれていた**ことを根拠にしている。さらに実測で「除外 23 行の理由は `fastest_unreachable` ただ 1 つ」が
  17 キャラ時点でしか成り立っていなかったことを見つけ、述語を 2 系統へ是正している。
  v68 の凍結リストを「当時人が確認した列挙」としてコメントに逐語で残した判断も良い。
- **ガードの破壊確認が本物である。** 3 件とも「塞ぐ前は EXIT=0」を実測し、赤くした規則を (4a) / (5) / (4b) と
  名指ししている（`M33-02` の教訓＝規則 (3) が赤くしたのを (4) と読んだ実例への回答）。
  自己検査を 11 → 15 対照へ増やし、違反メッセージへ規則番号を入れたのも効いている。
  **「凍結表を残したうえで凍結分にも規則 (4) を評価する」という判断は、設計卓の推し（外す）より厳密に強い**——
  規則 (3) だけが層の値を固定する、という理由づけが正しい。
- **段 3 が自分で作った穴を同じ手番で見つけて塞いだ。** `internal/seedgen/testdata/**` が
  `migrations/*_data_*.sql` のグロブから外れて既定の層 A へ静かに解決していたことを、
  どの検査も赤くならない状態で発見している（`D-777` の一般形）。
  golden を移す前後で旧コミット済み SQL と本体を突き合わせて**ドリフト 0 / 34** を実測したのも、
  「凍結したのは適用され検証された SQL そのものである」という主張を支えている。
- **未充足を隠していない。** 完了条件 §6-7（乾式）を ✗ と書き、`git diff --numstat` を貼り、
  失効参照の全数が「65 ではなく 85」であること（`M33-02` の式が stem 形を 20 件取りこぼす）まで
  自分の側から訂正している。`generate-code-facts.sh:745` のアサーションが「偶然通る」ことも申し送っている。
- **`helpers_test.go` の移設は忠実である。** `newMigrator` / `scanInt` / `fkCheck` / `scanStr` / `aliasText` の
  5 つとも本文と godoc が 1 文字も落ちていない（`fkCheck` の「`rows.Err()` を必ず確認すること」まで残っている）。
  「サブ名のファイルは主張が失効すると丸ごと消える」という置き場の理由づけも正しい。
- **`TestRun_HEAD_DownUpRoundTrip` の新設は、本サブで一番価値のある追加である。**
  新系列 9 本の `.down.sql` が 1 本もテストされていなかったこと、それが「48 本を消した穴ではなく着手時点から
  空いていた穴」であることを見分けた点が良い。`down` 全戻し後に `schema_migrations` 以外が残らないところまで
  見ているので「DROP を書き忘れた」が捕まる。
- **`D-187` の不変条件を申し送りへ回した判断**。「HEAD では 132 行違反しているので不変条件として足さない」。通すために主張を弱めるのでも、成立しない主張を足すのでもない扱いで正しい。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `pnpm test`（234 files / 2974 tests）と `make e2e`（364 passed）は本レビューでは回していない。
  完了報告 §9.2 / §9.3 の実測値を引いており、独立確認はしていない。
- **不明: 本サブ中に得たとされる開発者裁定 6 件の記録を検証できない。** `docs/process/parallel-board.md` の
  最終エントリは `D-904`（`d30c70e`・着手基点より前）であり、完了報告 §2 が挙げる 6 件
  （両方やる ／ testdata の層 ／ 乾式を行わない ／ `rules_m1905` の推奨案 ／ フロントと E2E も射程 ／
  `DownUpRoundTrip` の新設）は板に採番されていない。板への記録は設計卓の手番なので製造の欠けではないが、
  **レビュー側からは「裁定を得た」の真偽を判定できない。** とくに完了条件 §6-7 を ✗ にしている
  「乾式を行わない」は、裁定がなければ不合格条件 E-2 に当たるため、取り込みの手番で開発者に確認すること。
- 移行手順は乾式で走っていないため、本レビューもスキーマ（`migrations/000001_init_schema.up.sql` の
  `REFERENCES` 全 35 行）との突き合わせによる机上検証までである。高-4 / 中-2 / 中-3 を直しても
  「走れば通る」ことの保証にはならない。

---

## 取り込み結果（自動トリアージ・2026-09-19）

| 指標 | 値 |
|---|---|
| 指摘 | **17 件**（高 5 / 中 7 / 低 5） |
| **採用** | **17 件** |
| **不採用** | **0 件** |
| **「高」の不採用** | **0 件** ⇒ 安全弁は発動していない |
| 再レビュー往復 | **0 回** |

**★採否の詳細は完了報告 `docs/progress/M33-03-completion-report.md` §14 が正本である**
（§14.1 が「高」5 件の対応、§14.2 が高-3 の復元内容、§14.3 が中・低、§14.4 が
レビュアーの `不明` への回答）。

### 高 5 件の対応（要点）

| # | 対応 | 実測 |
|---|---|---|
| 高-1 | 規約 (2) の逐語を自分で確認。7 ファイルへ「終端は HEAD／名前空間は未解決」を明記し、**移設 or 規約改訂を CHANGE 原稿へ**（★39 本の移設は設計判断であり `CLAUDE.md` §8 により製造の独断で行わない） | 完了報告 §15-9 |
| 高-2 | 撤回済み段落 87 行を差し替え。`m1403f` / `m1403d` の旧連番記述も是正 | **コメントが指す非存在テスト 2 件 → 0 件** |
| 高-3 | **`head_seed_invariants_test.go` を新設し 7 本で復元**。孤児の期待値表はすべて復元テストが消費 | 7 本とも PASS |
| 高-4 | 「システム表のうち運ぶのは `sqlite_sequence` だけ」を追加（`schema_migrations` を運ぶと abort ＋ dirty） | プロンプト §4 |
| 高-5 | `outDirFor()` / `frozenGoldenStems`(17) を追加 | **`-check` が EXIT=1 / DIFF 2 件 → EXIT=0** |

### ★レビューが見つけた「製造の自作の失効参照」

段 1 で整えた `internal/repository/preset/queries.go:131` と
`internal/service/preset/service.go:277` のコメントが残っていた。
**⇒ 段 2 で製造自身が削除したテストを指していた。** `TestRun_HEAD_NoCrossingAliasTextEn` へ差し替えた。
**★段 1 と段 2 を別の手番として扱ったために生まれた矛盾である。**

### 取り込み後の実測

| 検査 | EXIT |
|---|---|
| `go test ./...` | **0**（FAIL 0 / ok 60） |
| `check-migration-license.sh` ／ `--self-test` | **0** ／ **0**（全 15 対照 OK） |
| `go run ./cmd/seedgen -check` | **0**（取り込み前は 1） |
| `gofmt -l` ／ `go vet ./...` ／ `go build ./...` | clean ／ 出力なし ／ OK |
| `cd web && pnpm exec tsc --noEmit` | **0** |
| 常設検査 13 本 | **すべて 0** |
| コード上で 1 度も使われない宣言 | **47 件 → 0 件** |

---

*以上、取り込み結果（自動トリアージ）。*
**★「高」の不採用は 0 件であり、開発者へのエスカレーションは発生していない。**
**★ただしレビューの `不明` は設計伝達レポート §3-1 へ全件を載せて設計卓へ回す**
（開発者裁定 6 件のボード未採番）。
