# M39-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象作業 | `M39-02`（ラッシュ版の生成経路が実行時に `D-187` を破る穴を塞ぐ） |
| 対象指示書 | `docs/instructions/M39-02-rush-variant-invariant-fix.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M39-02-review-checklist.md` v1.0.0 |
| 着手基点 | `0e50b76` ／ レビュー時 HEAD `57d4210` |
| レビュー日 | 2026-09-19 |
| レビュー方法 | コード読取 ＋ 検査スクリプト・`go test ./...`・`make e2e` の自走 ＋ `migrations/000004` の静的解析による独立追認 |

---

## 総評

チェックリスト §0 の不合格 8 項目はいずれも成立していない。とくに核である「是正の前に壊れることを実 API で再現した出力」「その状態で `M39-01` のガードが `EXIT=0` の緑のまま素通りした出力」「是正を外すと 3 本が赤くなる出力」「対照が緑のままである出力」の 4 点がすべて揃っており、本サブが何を直したのかが報告だけで読める。
射程の主張も独立に追認できた。`migrations/` の差分 0 行 ／ `*.up.sql` 9 本 ／ `docs/design/` と `followup-backlog.md` の差分 0 行 ／ 件数ハードガード 0 件 ／ `rushEligible` の差分 0 行は、いずれもレビュー側のコマンドで一致した。実測値（該当元技 3 件・`startup IS NULL` 362 行・seed 由来 rush 514 行が全件 `startup` 非 NULL）も `migrations/000004_data_seed_moves.up.sql` を列単位で解析して数値まで一致した。
実装そのものは小さく、`startup` の値と `startup_basis` の値を同じ 1 つのフィールドから導くため、両者が食い違う余地が構造的に無い。
不合格に当たる指摘は無い。高は 1 件で、完了報告と `progress-log` に書かれた「相互参照コメントを双方向に置いた」が事実と異なる点である。これはテストでも lint でも検出できず、記述だけが独り歩きする型であるため高に置いた。

---

## 設計準拠性レビュー結果

### A. 再現（段 1） — 総合 ◎

| # | 評価 | 所見 |
|---|---|---|
| A-1 | ◎ | `POST /api/moves/1364/rush-variant` の `201` 応答と、できた行（`rush_run` ／ `startup` NULL ／ `startup_basis='through'`）を完了報告 §2.2 / §2.3 に出力ごと掲載している。使い捨て DB `tmp/m39-02/repro.db` ＋ 専用ポート 47399 で行っており、dev DB と E2E スタックのいずれにも触れていない |
| A-2 | ◎ | 不変条件クエリが 0 から 1 へ増えることを掲載し、増えた 1 行の中身まで列挙している |
| A-3 | ◎ | 実 DB が違反 1 件を抱えたその時に `TestRun_HEAD_StartupBasis*` が `EXIT=0` であることを掲載。さらに「なぜ緑なのか」を `newMigrator` が `t.TempDir()` に別の DB を作る機構として説明しており、結論だけでなく理由が読める。本サブの存在理由の立証として十分である |
| A-4 | ◎ | 述語で引き直しており、id を引き写していない。レビュー側で `migrations/000004_data_seed_moves.up.sql` の `VALUES` タプルを列単位に分解して独立に数えたところ、`category IN (normal, unique)` かつ `is_aerial=0` かつ `startup IS NULL` はちょうど 3 行（1364 `run` ／ 2145 `prowler_stance` ／ 2555 `speedy_maracas`）で一致した |
| A-5 | ○ | 件数は 3 で一致したため発動しない。母数（`startup IS NULL` の 362 行）を併記して空振りでないことを示している点は良い。レビュー側の静的解析でも 362 行で一致した |

### B. 是正（段 2） — 総合 ◎

| # | 評価 | 所見 |
|---|---|---|
| B-1 | ◎ | 案 (a) を採り、(b) を不採用にした理由（UX が変わるため開発者承認が要る・(a) で足りる以上そちらを選ぶ理由が無い）が表で示されている。`internal/service/move/service.go` は差分 0 行であることをレビュー側でも確認した |
| B-2 | ◎ | `rushStartupBasis` は `srcStartup == nil` のときだけ分岐し、それ以外は `model.MoveStartupBasisThrough` を返す。`insertRushVariantSQL` の他のバインドは 1 つも変わっていない。実 API の対照（`juri/death_crest_2hits`）が是正の前後で `startup=12` ／ `total=34` ／ `through` と値まで一致している |
| B-3 | ◎ | `'through'` は一般には外れていない。SQL リテラルから定数バインドへ移しただけであり、列の明示列挙も維持されている（DEFAULT へ委ねていない）。`M19-04` §4.5 の懸念点がコメントに引き継がれている |
| B-4 | ◎ | Go 側に置いた理由が 4 点挙がっている。とくに「`CASE WHEN ? IS NULL` にすると `src.Startup` を 2 回バインドすることになる」は実物を見ないと書けない理由であり、設計卓が想像していた SQL の `CASE` を採らなかった根拠として妥当である。列挙定数をパッケージ定数へ戻せた点は `CLAUDE.md` §4 にも沿う |
| B-5 | ◎ | 変更は `startup_basis` のバインド 1 か所のみ。`total` / `active` / `recovery` / `damage` の扱いは不変であることを差分で確認した |

補足（レビュー側の独立確認）。`startup_basis` を書く経路はリポジトリ層全体で `internal/repository/move/rush.go` の 1 本だけである（`git grep startup_basis -- internal/repository internal/api` の非テスト行を全数確認）。もう一方の破り方である「`startup` を NULL へ戻す」経路は `internal/repository/move/edit.go:92` が `add("startup", *f.Startup)` と値をデリファレンスして渡すため存在しない。よって本是正で実行時の穴は塞ぎ切れている。

### C. テスト（段 3） — 総合 ◎（1 件の記述誤りは「設計準拠性以外」へ）

| # | 評価 | 所見 |
|---|---|---|
| C-1 | ◎ | `TestInsertRushVariant_StartupNullSourceKeepsInvariant` が実 DB へ `InsertRushVariant` を通して主張しており、新規 DB の最終状態では代用していない。母数 0 のとき `t.Fatalf` で落ちる空回り検出も入っている。加えて `TestHandler_RushVariant_201_then_409` が HTTP 層まで通した値を固定している |
| C-2 | ○ | 是正を外した状態の出力が完了報告 §4.3 に在り、3 本（repository 2 本 ＋ handler 1 本）が赤くなり、対照 1 本は PASS のままであることが読める。復元後にコミットとの差分が 0 であることも示している。レビュー側ではコードを変更できないため出力そのものの再現はしていないが、アサーションの構造上、`rushStartupBasis` が常に `'through'` を返せば当該 3 本が必ず赤くなることは読取りで確定できる |
| C-3 | ◎ | 既存 `TestInsertRushVariant_FrameCostColumnDefaults` の元技選択述語へ `m.startup IS NOT NULL` を足して対照として明示化し、さらに生成行の `startup` が元技のコピーであること（通し値の元が在ること）まで主張を足している。述語を足した理由がコメントに書かれている点が良い |
| C-4 | ◎ | 環境変数によるゲートは無い。`TACPENDIUM_AUDIT_DB` 型を踏まない旨がコメントに明記されている |
| C-5 | ◎ | ファイル名 `rush_runtime_invariant_test.go` と冒頭の対比表の両方から性格の違いが読める。対比表は HEAD ガードのテスト名まで名指ししており、規約 (24)-3 への参照も在る |

### D. 既存の違反行（段 4） — 総合 ◎

| # | 評価 | 所見 |
|---|---|---|
| D-1 | ◎ | 数えるクエリと、`category` 別の内訳クエリが手順に在る。内訳を足したのは `M39-01` 由来分と本経路由来分を切り分けるためであり、理由も書かれている |
| D-2 | ◎ | `UPDATE` 1 本 ＋ 確認クエリ ＋ `PRAGMA foreign_key_check` まで在る。`startup` 側は直さない旨の注記も在る |
| D-3 | ◎ | 開発者の検証 DB には触れていない。使い捨て DB で 2 から 4 を流した乾式の出力が在る。使い捨て DB を削除せずに申し送りにしたのも `CLAUDE.md` §10 に沿う正しい判断である |
| D-4 | ◎ | `scripts/migrate-userdata-prompt.md` へ節として追記しており、新規ファイルは作っていない。`M39-01` 節との違いを冒頭の引用で述べている点が親切である |

### E. 射程 — 総合 ◎（すべてレビュー側のコマンドで追認）

| # | 評価 | レビュー側の実測 |
|---|---|---|
| E-1 | ◎ | `git diff 0e50b76 -- migrations/ \| wc -l` = 0 ／ `ls migrations/*.up.sql \| wc -l` = 9 |
| E-2 | ◎ | `git diff 0e50b76 \| grep -icE "RAISE\(ABORT\|RAISE\(FAIL"` = 1 で、その 1 件は完了報告の「0 件」という本文そのもの。マイグレ側にも Go 側にも件数ハードガードは無い |
| E-3 | ◎ | `git diff 0e50b76 -- docs/design/ docs/handover/followup-backlog.md \| wc -l` = 0 ／ `internal/service/move/` も差分 0 行 |

### F. 報告 — 総合 ○（F-1 のみ現時点で判定不能）

| # | 評価 | 所見 |
|---|---|---|
| F-1 | △ | 設計伝達レポート `docs/handover/design-reports/` に `m39-02` は未作成であり、現時点では判定できない。ただし完了報告 §6 に CHANGE 原稿の素材が在り、「§1 と §6 へ置く・§4 ではない」と宛先も明示されている。Phase D で実物を確認すること。原稿の中身自体は妥当である（`DES-003` §3.3 の三値の述語と機械付与 (ii) には触れず、失効するのは「rush 生成経路は `'through'` を明示して INSERT する」の 1 文だけという切り分けは、レビュー側の `git grep` でも同じ 1 か所だった） |
| F-2 | ◎ | 完了報告と `progress-log` の索引行の双方が在る。索引行は日付・作業 ID・結果・報告書リンク ＋ 横断課題 7 件という `CLAUDE.md` §8 の形に沿っている |
| F-3 | ◎ | 完了報告を書いた後に回し直した 4 本の出力が §11.1 に貼られている。レビュー側で同じ 4 本を回し直し、すべて `EXIT=0` で内容も一致した。なお `check-progress-log-index.sh` と `check-doc-inventory.sh` はいずれも `find` で作業ツリーを走査する実装であり（`git ls-files` ではない）、完了報告が未コミットの状態でも検査対象に入る。したがって「121 件すべてが現れる」に本サブの完了報告が含まれているという主張は成立している |
| F-4 | ◎ | 全数テストの `EXIT=` と `FAIL` 件数が貼られ、E2E の 2 flaky は集計行だけで済ませず spec 名まで列挙している。`pnpm test -- --run` の `--` にも触れている |
| F-5 | ◎ | 版ゲート 6 点が §1 に在る。`docs/instructions/M39-overview.md` が v1.3.0 であることはレビュー側でも確認した |

### §0 の不合格 8 項目

| # | 判定 |
|---|---|
| 1 段 1 の再現の出力が無い | 該当しない（§2.2 / §2.3 に在る） |
| 2 ガードが緑のまま素通りしたことを示していない | 該当しない（§2.4 に `EXIT=0` の出力 ＋ 機構の説明） |
| 3 破壊確認の出力が無い | 該当しない（§4.3。常設の検出器対照も §4.2） |
| 4 対照が無い | 該当しない（§2.5 と §4.4 の実 API 対照 ＋ 常設テスト） |
| 5 `migrations/` に差分が在る | 該当しない（0 行を追認） |
| 6 件数のハードガードを置いている | 該当しない（0 件を追認） |
| 7 `rushEligible` を承認なしに変えている | 該当しない（差分 0 行を追認） |
| 8 報告作成後に回し直した検査の出力が無い | 該当しない（§11.1。レビュー側でも同値を再現） |

---

## 設計準拠性以外の指摘事項

### 1. 高 — 「相互参照コメントを双方向に置いた」が事実と異なる

完了報告 §4.1 と `progress-log.md` の横断課題 3 が、不変条件の検出式を 2 か所に持つことになった件について、次のように書いている。

> 新ファイルで同じ式を書き直し、相互参照コメント（「式を変えるときは両方」）を双方向に置いた。

実測では一方向しか置かれていない。

- 新ファイル `internal/repository/move/rush_runtime_invariant_test.go:36-39` には正本への参照が在る（「正本は `internal/infra/migration/head_seed_invariants_test.go` の `startupBasisInvariantSQL` である。式を変えるときは両方を変えること」）。
- 正本側 `internal/infra/migration/head_seed_invariants_test.go` には、`rush_runtime_invariant_test.go` も `M39-02` も 1 件も現れない（`grep` 0 件）。同ファイルは本サブの変更ファイル一覧にも入っていない。

危険なのは、参照が無いのが正本側だという点である。式を変える人は正本を編集するのであって複製を編集しない。つまり「両方を変えること」という注意書きが、それを読まない側にだけ置かれている。しかもこの状態はテストでも lint でも型検査でも検出できず、完了報告と `progress-log` の両方に「双方向に置いた」と記録されているため、次に読む人は複製の存在に気づく機会を失う。優先度較正の「撤回済み・失効した記述」と同型であるため高に置いた。

直し方はどちらでもよい。(a) 正本側の `startupBasisInvariantSQL` の godoc へ「同じ式の複製が `internal/repository/move/rush_runtime_invariant_test.go` に在る」を 1 行足す。(b) 足さないなら、完了報告と `progress-log` の記述を「複製側から正本への一方向である」へ直す。実効性が在るのは (a) である。

### 2. 中 — 「外部パッケージから import できないので共有できない」は置き場に限った事実である

完了報告 §4.1 は、式を共有できない理由として「同定数は package `migration_test` に属し外部パッケージから import できない」と書いている。定数の現在の置き場についてはそのとおりだが、「共有できない」の証明にはなっていない。

- `internal/testutil/dbtest` は本サブの新テストも `internal/infra/migration` のテスト群も既に import している（例 `internal/infra/migration/migrate_m1801_test.go:7`）。
- 依存の向きは `dbtest` → `internal/infra/migration` の一方向であり、`package migration_test` から `dbtest` を参照しても循環しない（現に既存テストがそうしている）。

よって式を `dbtest` 側の公開定数へ寄せる選択肢が在った。汎用ヘルパへ `D-187` 固有の式を置くことの是非は議論の余地があるため、寄せろとまでは言わない。指摘は記述の側である。「共有できない」ではなく「共有しないことを選んだ（理由はこれこれ）」と書けば、次に同じ式を 3 か所目へ増やす人が検討の出発点を得られる。

### 3. 中 — 値が変わったことの消費者側への影響が報告に無い

完了報告 §3.4 の失効記述の走査は、`git grep` の結果 177 行を `grep -icE "rush"` で 14 行へ絞っている。この絞り込みは失効記述を探すには妥当だが、`startup_basis` の値の変化が下流へ及ぼす影響を見るには狭い。rush という語を含まない消費者が母集団から落ちるためである。実際に落ちているのは次の 3 か所である。

- `internal/service/setplay/service.go:664`（`m.IsDerived && m.StartupBasis != through` なら target から除外）
- `internal/service/setplay/service.go:739`（`StartupBasis != through` なら親の射影を返さない）
- `internal/service/punishfinder/service.go:373`（`StartupBasis == standalone` の判定）

レビュー側で追認した結論は「影響 0」である。根拠は 3 つ。

1. `:664` のゲートは `if !isRushTargetType(ttype)` の内側に在る。`moveTargetType` は `category='rush_variant'` かつ元技が normal / unique の行を `normal_rush` / `unique_rush` へ落とすため、本サブが値を変える行はこのゲートを通らない。
2. `:739` は `chosen[m.ID]`（`move_derivations` 由来の親）が要る。実行時に生成される rush 行に親参照は付かないため、`'through'` でも `'unknown'` でも `nil` である。
3. `:373` は `standalone` のみを見るため、`'through'` と `'unknown'` の差を読まない。

加えて該当 3 行は seed 上いずれも `damage=0` であり、既定の target 列挙からは damage ゲートでも落ちる。結論は変わらないが、この追認が報告に無いままだと次のサブが同じ調査をやり直す。完了報告か設計伝達レポートへ 2 行で足しておくとよい。あわせて `web/src/locales/ja.json:862` の `M19-LIMITATION-NOTICE` は「target 列挙規則を変えたら文面も更新」と求めているが、本サブは規則を変えていない（値を変えただけである）ため更新は不要である。この判断も残しておくと次が早い。

### 4. 中 — 案 (b) を検討するための一次証拠が実データ側に在ることが報告に無い（設計卓・開発者宛）

`migrations/000004_data_seed_moves.up.sql:2412` の `dee_jay/speedy_maracas` の `raw_data.notes_tool` に、入力担当の手書きで次の一文が入っている。

> ボタンホールド時間で全体が自由に変わる技なのでフレームは省略。空中技ではないが、ラッシュ版はない。

つまり少なくともこの 1 件については、ゲーム上ラッシュ版が存在しないことがデータ側に明記されている。案 (a) を採った結果、実機に無いラッシュ版を利用者が作れる状態は残る。これは本サブの射程外であり、案 (b) は開発者承認事項であるから、製造が (a) を選んだこと自体は正しい。指摘は、案 (b) の是非を開発者が判断するための一次証拠が実データに在るのに、それが報告に上がっていない点である。`rushEligible` はユーザー体験に影響する選択であり `roles-and-routing.md` のハード列に当たるため、設計伝達レポート §4 へ 1 行として上げるのが筋である。

### 5. 低 — 完了報告 §7 のファイル一覧が古い

§7 に貼られた `git diff --numstat 0e50b76` は 5 ファイル、`--stat` は「5 files changed, 357 insertions(+), 19 deletions(-)」である。レビュー時点の実測は 7 ファイル・994 insertions・19 deletions であり、`docs/progress/M39-02-completion-report.md` と `docs/progress/progress-log.md` が入っていない。完了報告を書いている最中に取った値であるため原理的に避けにくいが、§11 で検査を回し直しているのと同じ理屈で、この 2 行も回し直せる。

なお `E-225` の観点そのものはレビュー側でも追認した。新規ファイルの deletions は 0 であり、`git grep "^func Test" 0e50b76` と `HEAD` を `internal/repository/move` と `internal/api/move` で突き合わせた差分は追加 2 本のみで、消えたテストは 1 本も無い。

### 6. 低 — `precheck_seed_data.md` の据え置きは妥当だが、一句足すと安い

`.claude/commands/precheck_seed_data.md:111` の「`category='rush_variant'` なら `startup_basis='through'` か」を据え置いた判断は妥当である。レビュー側でも `migrations/000004_data_seed_moves.up.sql` を静的解析し、`rush_variant` は 514 行ちょうどで、`startup` が NULL の行は 0 行、`startup_basis` は全件 `'through'` であることを追認した。完了報告の実測と一致する。

ただし同検査は CSV の期待値表であり、将来の seed 波が `startup` 空の rush 行を持てば誤った期待値を指す。「`startup` が在る場合」の一句を足しておくと安い。実害は fail-loud である（`M39-01` の HEAD ガードが新規 DB の最終状態で捕まえる）ため優先度は低い。

### 7. 低 — テストの期待値がリテラルである

新旧のテストが `model.MoveStartupBasisUnknown` ではなく `"unknown"` / `"through"` のリテラルを期待値に使っている。`CLAUDE.md` §4 は列挙的文字列の散在を禁じているが、テストの期待値をリテラルで書くのは「定数の値を変えたら落ちる」ことを狙う慣行でもあり、既存 `rush_test.go` も同じ形である。実装側（`rush.go`）はパッケージ定数へ寄せられており、むしろ規約に近づいている。現状維持でよいが、方針としてどちらかに揃えるなら次に触る手番で決めること。

### 8. 非指摘（確認したが指摘しない）

- `internal/repository/move/rush_test.go:38` が再折り返しの際に「`rush_standing_light_punch` は 000030 の seed に含まれる」を引き継いでいる。`M33` の付番変更で `000030` は現存しないが、旧付番を歴史的な識別子として書くのはリポジトリ全体の慣行であり（`internal/seedgen/` 配下だけで 000030 が 6 か所、旧付番全体では Go コメントに数百か所在る）、本サブ固有の失効ではない。
- `gofmt -l` は 0 件、`go vet` は変更 2 パッケージとも `EXIT=0`。
- `insertRushVariantSQL` の列 16 個とプレースホルダ 16 個（うちリテラル 1）とバインド引数 15 個の対応を数え直し、ずれが無いことを確認した。
- `startup` の値と `startup_basis` の値がどちらも `src.Startup` という同一のフィールドから導かれているため、両者が食い違う余地が構造的に無い。将来 `startup` のバインド元だけを変える改修が入っても、同じ引数を読む限り破れない。良い形である。

---

## レビュー側で回し直した検査（結論を採らず根拠を自分で回した結果）

| コマンド | 結果 |
|---|---|
| `go test ./... -count=1`（パイプ無し・出力はファイルへ全量） | `EXIT=0` ／ `^--- FAIL` 0 件 ／ `^ok` 60 件 |
| `bash scripts/check-artifact-integrity.sh`（1 本目） | `EXIT=0` ／ 検査 17 件 ／ 生成物 4 件すべて OK |
| `bash scripts/check-progress-log-index.sh` | `EXIT=0` ／ 121 件すべてが `progress-log` に現れる |
| `bash scripts/check-doc-inventory.sh` | `EXIT=0` ／ 型に無いファイルなし |
| `bash scripts/check-md-emphasis.sh docs/progress/M39-02-completion-report.md` | `EXIT=0` ／ 検出 0 行 |
| `bash scripts/check-md-emphasis.sh scripts/migrate-userdata-prompt.md` | `EXIT=0` ／ 検出 0 行 |
| `bash scripts/check-doc-refs.sh` | `EXIT=0` ／ dead reference なし |
| `bash scripts/check-completion-report-md-emphasis.sh` | `EXIT=0` |
| `bash scripts/check-stop-discipline.sh` | `EXIT=0` |
| `bash scripts/check-enum-sync.sh` ／ `check-import-order.sh` ／ `check-instruction-format.sh` | いずれも `EXIT=0`・ベースラインどおり |
| `make e2e` | `EXIT=0` ／ 363 passed ／ 1 flaky（`m31-02-tag-field-drag.spec.ts` の右方向のみ。完了報告は同 spec の右と下の 2 件を flaky として挙げており、レビュー実行では右だけが再試行になった。合計は両者とも 364 件で一致する）。本サブの影響面を通る 2 件（`m30-01-controller-surfacing.spec.ts:170` の生ラッシュ ／ `moves-edit.spec.ts:30` のラッシュ版生成）はいずれも緑 |

射程の主張の追認は E 節の表に、実測値（3 件 ／ 362 行 ／ 514 行）の追認は A 節と指摘 6 に記した。実測値は `migrations/000004_data_seed_moves.up.sql` の `VALUES` タプルを引用符とエスケープを尊重して列単位に分解し、独立に数えたものである。テスト用 DB を作らずに済ませたのは、本サブの主張がすべて seed の最終状態に関するものだからである。

---

## 推奨修正（優先度別）

- 高（M39 完了前に修正必須）:
  1. 指摘 1。正本側 `internal/infra/migration/head_seed_invariants_test.go` の `startupBasisInvariantSQL` の godoc へ複製の在り処を 1 行足す。足さない判断を採るなら、完了報告 §4.1 と `progress-log.md` 横断課題 3 の「双方向に置いた」を実態に合わせて直す。どちらか一方は必ず行うこと。
- 中（次サブ着手と並行可）:
  2. 指摘 2。「外部パッケージから import できない」を「共有しないことを選んだ」へ言い換え、`internal/testutil/dbtest` という選択肢が在ったことを 1 行残す。
  3. 指摘 3。`startup_basis` の消費者 3 か所への影響が 0 であることの根拠を、完了報告か設計伝達レポートへ 2 行で足す。`M19-LIMITATION-NOTICE` の更新が不要である判断もあわせて残す。
  4. 指摘 4。`speedy_maracas` の `notes_tool` に「ラッシュ版はない」と明記されている事実を、設計伝達レポート §4 へ 1 行として上げる（案 (b) の判断材料。宛先は開発者）。
- 低（将来対応）:
  5. 指摘 5。完了報告 §7 のファイル一覧と `--stat` を、docs コミットを含んだ値へ更新する。
  6. 指摘 6。`precheck_seed_data.md:111` へ「`startup` が在る場合」の一句を足す。
  7. 指摘 7。テスト期待値をリテラルにするかパッケージ定数にするかの方針を、次に同ファイルを触る手番で決める。

---

## 良かった点

- 「先に壊す」を実 API で本当にやっている。使い捨て DB と専用ポートを用意し、再現・対照・是正後・乾式検証の 4 場面すべてで出力を残している。`M39-01` のガードが緑である出力を、違反行が実在するその時点で取っている点が本サブの価値そのものであり、ここを外していない。
- 緑である理由を機構で説明している。`newMigrator` が `t.TempDir()` に別の DB を作るから緑なのだ、という 1 行が在ることで、読み手は「ガードが弱い」ではなく「ガードの射程が違う」と正しく理解できる。
- 値を決める規則に名前を付けた。`rushStartupBasis` という関数を 1 つ置いたことで、`DES-003` §3.3 (i) と `D-187` への参照が 1 か所に集まり、SQL の `CASE` にした場合より追跡しやすい。SQL 側を採らなかった理由を、実物のバインド個数という具体で説明している点も良い。
- 対照テストに述語を足した理由まで書いている。`m.startup IS NOT NULL` が無いと seed の母数が動いたとき対照の役を失う、という説明は、テストが何を見ているかを次の人へ伝える。
- 失効記述を「消さずに、失効した旨を明記して残す」形を採っている。`rush.go` の旧コメントの扱いは、後任が旧記述を前提として複製する事故を防ぐ良い形である。
- 手順書を新規ファイルではなく既存 `scripts/migrate-userdata-prompt.md` の節として足し、`M39-01` 節との違いを冒頭で述べている。`CLAUDE.md` §10.Y に素直である。
- 使い捨て DB を自分で消さず、`CLAUDE.md` §10 の機械強制を理由として申し送りに回している。ルールを目的から読み替えて回避していない。
- 完了報告 §10 を空のプレースホルダのままにし、存在しないレビュー報告へのリンクを張っていない。`D-510` を踏んでいない。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 破壊確認（是正を外すと赤くなること）は、レビュー側がコードを変更できないため出力の再現はしていない。アサーションの構造から結果が確定することの読取りと、完了報告 §4.3 の出力の突合にとどまる。
- `cd web && pnpm test` は再実行していない。本サブの差分に `web/` 配下のファイルが 1 つも含まれないため、フロントのテスト結果は本サブの影響を受けない。
- 不明: 設計伝達レポートが未作成のため、チェックリスト F-1（CHANGE 原稿が §1 と §6 に在るか）は現時点では判断できない。Phase D で確認すること。

---

## 取り込み結果（自動トリアージ）

**製造（`/implement_plan_full` Phase C）が 2026-09-19 に実施。** 指摘 **7 件（高 1 / 中 3 / 低 3）は全件採用・不採用 0 件。**
**⇒ 「高」指摘の不採用は 0 件であり、開発者エスカレーション（安全弁）は発動していない。再レビュー往復 0 回。**

**★採否の正本は完了報告 `docs/progress/M39-02-completion-report.md` §10.1 である**（表形式・各件の対応まで記載）。以下は要約。

| # | 優先度 | 採否 | 対応の要旨 |
|---|---|---|---|
| **高-1** | 高 | **採用** | **自分で `grep` して正本側 0 件を追認したうえで**、`internal/infra/migration/head_seed_invariants_test.go` の `startupBasisInvariantSQL` へ相互参照コメントを追加し、**「双方向」を事実にした**。完了報告 §4.1 に訂正の注記を残した |
| **中-2** | 中 | **採用** | 両パッケージが `internal/testutil/dbtest` を import 済みであることを自分で確認。⇒ 「共有できない」→「**共有しないことを選んだ**」へ言い換え、採らなかった理由（同 helper は DB を用意する道具であり述語の置き場ではない）と代償をコード・報告の両方へ明記 |
| **中-3** | 中 | **採用** | **レビューの結論（影響 0）を鵜呑みにせず 4 箇所の述語を実物で読み直した。** とくに `setplay/service.go:664` が `if !isRushTargetType(ttype)`（`:654`）の内側に在ることを確認。⇒ 完了報告 **§3.5** として根拠を表で追記。`damage=0` による独立の根拠も追加 |
| **中-4** | 中 | **採用** | `migrations/000004` の `speedy_maracas` の `notes_tool` 逐語（「空中技ではないが、ラッシュ版はない。」）を自分で引いて確認。⇒ **`rushEligible` は `roles-and-routing` のハード列（UX）であり製造の自己判断の対象外**。**設計伝達レポート §4 へ原稿として上げ、判断を開発者へ返す**（指示書 §7-1 / §3-5。★`rushEligible` は 1 行も触っていない） |
| 低-5 | 低 | **採用** | 完了報告 §7 の変更統計を Phase C まで含めた実測へ更新。Phase A 時点の実装面の値は「破壊確認・射程確認を読んだ母集団」として別掲 |
| 低-6 | 低 | **採用** | `.claude/commands/precheck_seed_data.md` の該当行へ「元技が `startup` を持つ場合」の括弧書きを追加（seed 済み rush 行 514 件は全件 `startup` を持つため現状の判定は不変） |
| 低-7 | 低 | **採用（記録のみ・コード変更なし）** | テスト期待値のリテラル/定数は**リポジトリ全体の方針**として決める話。⇒ 本サブだけ変えると同一ファイル内で書き方が割れるため据え置き、設計伝達レポート §4 へ候補として残す |

**★レビューが独立に回した検証はいずれも本報告の数値と一致した**（`go test ./...` EXIT=0・FAIL 0・60 pkg ／ 検査 10 本 EXIT=0 ／ `make e2e` EXIT=0・合計 364 ／ 射程 5 点 ／ `migrations/000004` の静的解析 6 項目）。**`make e2e` の内訳が 363+1 と 362+2 で割れたのは同一 spec（`m31-02-tag-field-drag.spec.ts`）の揺れであり、合計は一致している。**
