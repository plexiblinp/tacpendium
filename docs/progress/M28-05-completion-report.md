# M28-05 完了報告: terry `quick_burn_light` の `move_code` 是正

| 項目 | 内容 |
|------|------|
| 作業 ID | **M28-05** |
| 対象指示書 | `docs/instructions/M28-05-terry-quick-burn-code-fix.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M28-05-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-07 |
| 着手基点 | `233f48e` |
| CHANGE 消費 | **0 本**（`docs/design/` の名指しは実査で 0 件） |
| マイグレ消費 | **1 本＝`000106`**（設計卓が払い出した番号。自採番していない） |
| 工程 | `implement_plan_full`（Phase A 実装 → Phase B 独立サブエージェントによるレビュー → Phase C 自動トリアージ） |

---

## 0. 総括

terry の `quick_burn_light` は**強度の区別が存在しない技**であり、`_light` 接尾辞が誤りであった（開発者のインゲーム確認・2026-09-06）。`sonic_break_light` → `sonic_break`（`M19-04c` / `000063` 節 A）と同型の是正を、**CSV 正本 → golden 4 本 → 追随マイグレ**の三点更新で実施した。

**本サブの本体は「1 行の改名」ではなく「動く golden が 4 本あることを取りこぼさないこと」であった。** `quick_burn_light` は `is_derived=0` かつ `command` 非空のため `move_commands` 索引に載っており、先例（`is_derived=1` で索引非搭載・動く golden 1 本）より射程が広い。

**★実測で確かめたこと**: 000035 の索引 1 行だけを改名前へ戻した状態で、`go run ./cmd/seedgen -check` は **`OK` / exit 0 を返した**（`go test` だけが exit 1）。**⇒ `-check` が守るのは `000026` だけである**という `CHANGE-163` §1 の主張を、本サブが最初に実測で裏付けた（§6-2）。

---

## 1. 母数の再実査（指示書 §2.1）

`grep -rn "quick_burn_light"` の今回実測と `M28-04` の実測の突合。

| 走査先 | `M28-04` 実測 | 今回の実測 | 判定 |
|---|---|---|---|
| `character_data/` | 2 | **2** | ✅ 一致 |
| `migrations/` | 10 | **10** | ✅ 一致 |
| `internal/` | 0 | **0** | ✅ 一致 |
| `web/`（src・e2e とも） | 0 | **0** | ✅ 一致 |
| `scripts/` | 0 | **0** | ✅ 一致 |
| **`docs/design/`** | **0** | **0** | ✅ 一致 ⇒ **CHANGE 不要が維持されている** |
| `docs/`（歴史記録） | 16 | **45** | ⚠ **差異 +29** |

### 1.1 ★`docs/` の差異は説明が付いた（**開発者裁定 2026-09-07＝続行**）

指示書 §2.1 は「一致しなければ止めて報告」と定めているため、**Plan Mode で報告し、開発者が「説明可能として続行」を裁定した**。

**差分 29 件の全数**（いずれも `M28-04` の母数実査より後に書かれた文書）:

| ファイル | 件数 |
|---|---|
| `docs/progress/m28-04-review.md` | 5 |
| `docs/handover/design-reports/20260906-m28-04-design-exceptions.md` | 9 |
| `docs/process/parallel-board.md` | 3 |
| `docs/instructions/M28-overview.md` | 2 |
| `docs/instructions/M28-05-terry-quick-burn-code-fix.md`（**本指示書そのもの**） | 6 |
| `docs/instructions/reviews/M28-05-review-checklist.md`（**本チェックリストそのもの**） | 2 |
| `docs/progress/progress-log.md` | 2 |
| **計** | **29** |

**16 の内訳も再構成できた**: `M14-RESEARCH-02-findings-analysis`(1) ＋ `M14-RESEARCH-02-report`(3) ＋ `docs/seed-data/official-data-edge-cases`(2) ＋ `M28-04-completion-report`(9) ＋ `followup-backlog`(1) = **16**。⇒ **16 + 29 = 45 で完全に説明が付く。**

**★教訓**: 母数を「歴史記録も含めた `docs/` の総件数」で置くと、**その母数を出した報告書自身と、それを受けて起票された指示書・チェックリストが母数を押し上げる**。⇒ 母数は「判断に効く区分」（実装・データ・`docs/design/`）で取り、`docs/` は件数ではなく「歴史記録である」という性質で扱うほうが安定する。

### 1.2 改名先の空き確認（再実査）

`grep -c '^terry,quick_burn,' character_data/terry.csv` = **0** ⇒ `UNIQUE (character_id, code)` の衝突なし・改名の順序制約なし（`sonic_break` のときのような `NOT EXISTS` の順序依存は不要）。

---

## 2. 変更したファイル

### 2.1 `git diff --stat 233f48e`

```
 character_data/command-correction-history.md       |   2 +-
 character_data/terry.csv                           |   2 +-
 internal/infra/migration/migrate_m2805_test.go     | 182 +++++++++++++++++++++
 migrations/000026_seed_moves_first_wave.down.sql   |   4 +-
 migrations/000026_seed_moves_first_wave.up.sql     |   4 +-
 migrations/000035_seed_move_commands.down.sql      |   2 +-
 migrations/000035_seed_move_commands.up.sql        |   2 +-
 .../000072_m20_seed_aliases_numeric.down.sql       |   2 +-
 migrations/000072_m20_seed_aliases_numeric.up.sql  |   2 +-
 migrations/000073_m20_seed_aliases_srk.down.sql    |   2 +-
 migrations/000073_m20_seed_aliases_srk.up.sql      |   2 +-
 ...106_data_correct_terry_quick_burn_code.down.sql |  25 +++
 ...00106_data_correct_terry_quick_burn_code.up.sql |  46 ++++++
 13 files changed, 265 insertions(+), 12 deletions(-)
```

**★上記は本報告書・`progress-log.md` を書く前（コミット `84da594` 時点）の値である。** 本報告書自身と Phase D の追記、および Phase C の取り込み分は含まない（レビュー 低-3）。

**★新規ファイルの健全性確認（教訓 `E-225`）**: 新規 3 ファイル（`migrate_m2805_test.go` 182 / `000106` up 46 / down 25）は**すべて `+` のみで deletions を持たない**。⇒ 「新規のつもりで既存を上書きした」形の事故は無い。各 Write の前に `ls` で同名の不在も確認した。

**変更 10 ファイルの deletions 12 行はすべて `quick_burn_light` → `quick_burn` の 1 対 1 置換**であり、想定外の削除は無い（§5 で全数を確認）。

### 2.2 CSV 正本（2 ファイル）

| ファイル | 内容 |
|---|---|
| `character_data/terry.csv` L32 | `terry,quick_burn_light,...` → `terry,quick_burn,...`。**★`quick_burn_od`(L33) は改名していない**（`quick_burn` / `quick_burn_od` の既存形へ合流するのが正しい） |
| `character_data/command-correction-history.md` L15 | terry 表の `move_code` セル `quick_burn_light` → `quick_burn`（**★開発者裁定 2026-09-07＝「改名して追随させる」**。他の列は当時の記録として据え置いた） |

**★CSV を直さずに DB だけ直してはならない**（次の seed 再生成で戻り、しかも戻ってもエラーは出ない）。本サブは CSV を先に直し、golden を CSV から再生成している。

**★補強根拠**: `command-correction-history.md` の「対応 dist code」欄は**元から `quick_burn`** であった（`M14-03b`・2026-07-13 の command 補完時、公式データ側の識別子と突合した記録）。⇒ **本アプリ側だけが `_light` を持っていた**ことが、本サブとは独立した記録から確認できる。

---

## 3. マイグレ `000106_data_correct_terry_quick_burn_code`

### 3.1 命名の根拠（層 B）

**ファイル名は `NNNNNN_data_*.sql`**（`CHANGE-158` の命名規約）。`moves` は `scripts/check-migration-license.sh` の `GAME_TABLES` に含まれるため、`_data_` を持たないと**層 A(AGPL) へ静かに落ちて赤**になる（実測は §6-3）。

`REUSE.toml` は `path = [..., "migrations/*_data_*.sql"]` で層 B(CC-BY-SA-4.0) へ解決するため、**`REUSE.toml` の編集は不要**（グロブで当たる）。`bash scripts/check-migration-license.sh` = 違反なし。

### 3.2 up の設計判断

```sql
UPDATE moves SET code = 'quick_burn'
WHERE character_id IN (
        SELECT c.id FROM characters c
        WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code = 'quick_burn_light'
  AND NOT EXISTS (SELECT 1 FROM moves m2
                  WHERE m2.character_id = moves.character_id
                    AND m2.code = 'quick_burn');
```

| 判断 | 理由 |
|---|---|
| **`WHERE` を `character_id` ＋ `code` の対で絞る** | `moves.code` はテーブル全体では一意でない（`UNIQUE` は `(character_id, code)`）。`code` だけで絞ると他キャラの同名を巻き添えにする。**★巻き添えは静かに起きる**（エラーにならない） |
| **`NOT EXISTS` ガードを付ける** | `SUPP-001` §5.5.4 (8)。新規 DB は golden 由来で既に `quick_burn` を持つため、素の `UPDATE` は `UNIQUE` 衝突で落ちる。ガードの意味は「改名先が既に埋まっている＝その改名は済んでいる」であり、済んでいる DB では 0 行、未適用の DB では 1 行に当たる |
| **DDL は書かない** | 本サブはデータの是正であり、スキーマは動かない |
| **改名の順序制約を入れない** | 改名先 `quick_burn` が空きであるため（§1.2）。`000063` の `sonic_cross` 系のような B-2 → B-3 の順序依存は不要 |
| **DB 側の追随 UPDATE を書かない** | `move_commands` / `preset_aliases` / `combo_steps` はいずれも `moves.id` 参照であり、`code` の改名で紐付きは切れない（`DES-003` §3.3 / §3.14）。**★これを実測で裏付けた**のが `TestRun_M2805_LinksSurvive`（§4） |

**★旧 code の文字列は残る**——`WHERE code = 'quick_burn_light'` として本マイグレ自身が名指しするためである（`SUPP-001` §5.5.4 (8)「リポジトリに 0 件を完了条件にしてはならない＝達成不能」）。**実測: リポジトリ全体（`docs/` を除く）の `quick_burn_light` 残存は 10 件**——`000106` の up 4 行 / down 4 行（コメントを含む）**＋ `internal/infra/migration/migrate_m2805_test.go` の 2 件**（L10 の godoc コメント / L32 の定数 `m2805OldCode`）。**⇒ `internal/` の母数は 0 → 2 になった。** これも規約 (8) が言う「消せない残存」である——**改名を固定するテストは、旧 code が 0 件であることを主張するために旧 code を名指しする必要がある**。（レビュー 中-3 で訂正）

### 3.3 ★down の中身と、down で失われるもの（指示書 §2.2-6）

**down の中身**: up の逆（`quick_burn` → `quick_burn_light`）。同じく `character_id` ＋ `code` で絞り、`NOT EXISTS ('quick_burn_light')` ガードを付ける。

| 観点 | down で何が起きるか |
|---|---|
| **失われる利用者データ** | **無い。** `move_commands` / `preset_aliases` / `combo_steps` はいずれも `moves.id` 参照であり、`code` を戻しても紐付きは切れない。**★実測で確認した**——`TestRun_M2805_LinksSurvive` が down 後も `move.id` が同一で索引の紐付きが残ることを固定している |
| **失われるもの** | **是正そのものだけ**（誤った `_light` 接尾辞へ戻る） |
| **★非対称がある** | golden 再生成後の新規 DB は **v26 の時点で既に `quick_burn` を持つ**。そこから v105 へ down すると `quick_burn_light` になるが、それは**その DB の v105 時点の本来の状態ではない**。⇒ down は「既存 DB（是正前）の状態」を作るのであって、新規 DB の履歴を巻き戻すわけではない。**三点更新（CSV 正本 → golden → 追随マイグレ）に固有の非対称であり、`000063` も同じ形を持つ**。保証するのは往復で復帰すること（`TestRun_M2805_DownUpRoundTrip`）だけである |

---

## 4. テスト `internal/infra/migration/migrate_m2805_test.go`（新設）

**★件数で固定していない**（`SUPP-001` §5.5.4 (6)）。golden にも同じ是正を入れてあるため、**新規 DB では `000106` の `UPDATE` は 0 行に当たって成功する**——「1 行に当たった」で固定すると CI では常に 0 行になり、何も守らない。

| テスト | 何を固定するか |
|---|---|
| `TestRun_M2805_V106State` | v106 時点で terry の `quick_burn_light` = **0 件** / `quick_burn` = **1 件**（**対で固定**。片方だけでは「旧が残っている」か「新が増えている」かを取り落とす）／ `quick_burn_od` = 1 件が不変。**あわせて v105 の時点で既に `quick_burn` であること**（＝golden が是正済みであること・`000106` が 0 行に当たる根拠） |
| `TestRun_M2805_DownUpRoundTrip` | v106 → v105 で旧 code へ戻り（1 件 / 0 件が反転）、re-up で復帰する。**★新規 DB では UPDATE が 0 行になるため、この往復だけが追随経路を実際に動かす唯一の検証である** |
| `TestRun_M2805_LinksSurvive` | 改名の前後で `move_commands` / `preset_aliases` が同一の `move_id` を指し続けること。**★件数だけでは「別の行に付け替わった」形の事故を取り落とす**ため、`move.id` の同一性で見る |

**区間終端は `const m2805Terminus = 106`（HEAD を終端にしない）**——`SUPP-001` §5.5 規約 (1)(2)。HEAD 終端だと後続サブの正当な是正でこのファイルが落ち、「期待値を緩める」誘惑が発生する。版数リテラルは名前付き定数 1 か所に閉じた（followup `migration-version-literals-in-tests`）。

**★本テスト自身が効くことを破壊確認した**（§6-4）。

---

## 5. golden 4 本の再生成 — ★動いた理由（**上書きの前に特定した**）

| # | golden | 何が載っているか | **動く理由** | 固定テスト |
|---|---|---|---|---|
| 1 | `000026_seed_moves_first_wave` | `moves` の INSERT ＋ `official_ja_move` 別名「クイックバーン」 | `code` を CSV から直接出力している（up L42 の INSERT 行・L140 の別名行、down L57/L59 の code 列挙） | `TestGolden_CommittedMigrationMatchesRegeneration` |
| 2 | `000035_seed_move_commands` | `token_key` = `214LP` | **`code` で INSERT 先を解決している**（up L19、down L46 の code 列挙）。**★`is_derived=0` かつ `command` 非空のため索引に載っている**——先例 `sonic_break_light`（`is_derived=1`）には索引が無かった | `TestGolden_MoveCommandsMatchesRegeneration` |
| 3 | `000072_m20_seed_aliases_numeric` | `214LP` | 同上（up L1211、down L18） | `TestGolden_M2002NumericAliasesMatchesRegeneration` |
| 4 | `000073_m20_seed_aliases_srk` | `214LP` | 同上（up L1223、down L18） | `TestGolden_M2002SRKAliasesMatchesRegeneration` |

**⇒ 動くのはいずれも「`code` で INSERT 先を解決している golden SQL」だけである**（`move_commands` / `preset_aliases` の実データは `moves.id` 参照なので DB 側の追随は不要）。

### 5.1 再生成に使ったコマンド（リポジトリルート）

4 本とも `cmd/seedgen` の `preM2003Stems` に含まれ、`formatFor(stem)` が `FormatPreM2003` を自動選択するため**追加フラグは不要**（フラグ方式にすると付け忘れた実行が適用済みファイルを壊すため、出力 stem で自動判別する設計）。

```bash
go run ./cmd/seedgen                                   # 000026（引数なし = FirstWaveOrder）
go run ./cmd/seedgen -mode move-commands \
  -chars terry,guile,lily,ingrid,kimberly,juri,ken,mai,zangief,ryu \
  -out 000035_seed_move_commands \
  -note "M17-02: command 索引 move_commands の seed(非派生のみ・CHANGE-069 §2.1-b)"
go run ./cmd/seedgen -mode aliases -preset numeric \
  -chars guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -movement-chars c_viper,dhalsim,guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -out 000072_m20_seed_aliases_numeric \
  -note "M20-02: 表記プリセット numeric のエイリアス投入(D-311 / D-314 / D-315 / D-321)"
# srk は -preset srk / -out 000073_m20_seed_aliases_srk / -note の numeric→srk 置換のみ
```

### 5.2 再生成の結果が想定どおりであることの確認

`git diff -U0 -- migrations/` を全数読み、**動いた 8 ファイル・12 行がすべて `quick_burn_light` → `quick_burn` の 1 対 1 置換であること**を確認した。行の増減・並び替え・他キャラへの波及は無い（`quick_burn` は `quick_burn_light` と同じソート位置に入るため、down の code 列挙の並びも変わらない）。

**★4 本すべてを再生成した。** 1 本だけ直して緑になったなら、それは残り 3 本を再生成していないだけである（§6-2 の実測がその危険を裏付けている）。

---

## 6. 破壊確認（**指示書 §2.4 の 3 件 ＋ 追加 1 件**）

いずれも実施後に**復元して `git status --short` が空（差分 0）であること**を確認した。

### 6-1. `character_data/terry.csv` を改名前へ戻して `-check`

```
$ sed -i '32s/^terry,quick_burn,/terry,quick_burn_light,/' character_data/terry.csv
$ go run ./cmd/seedgen -check
DIFF: migrations/000026_seed_moves_first_wave.up.sql は生成物と一致しません
DIFF: migrations/000026_seed_moves_first_wave.down.sql は生成物と一致しません
seedgen: 生成物と既存ファイルに差分あり。★000026_seed_moves_first_wave は適用済みマイグレであり
再生成してはならない(M20-03 §2.2 / SUPP-001 §5.5)。CSV 正本か変換規則が変わったということなので、
どちらが変わったかを特定すること
exit=1
```
**⇒ 期待どおり `DIFF` / exit 1。** terry は `FirstWaveOrder` の第一波なので引数なしで捕まる。復元後 `-check` = `OK` / exit 0。

### 6-2. ★★`000035` の索引だけを改名前へ戻す（**本サブ固有の確認**）

```
$ sed -i "s/UNION ALL SELECT 'quick_burn', '214LP'/UNION ALL SELECT 'quick_burn_light', '214LP'/" \
    migrations/000035_seed_move_commands.up.sql

$ go test ./internal/seedgen/ -run 'TestGolden_MoveCommandsMatchesRegeneration'
--- FAIL: TestGolden_MoveCommandsMatchesRegeneration (0.00s)
    generate_m1702_test.go:165: 000035_seed_move_commands.up.sql がコミット済みと不一致。…
FAIL
```
**⇒ 期待どおり赤。** 先例（`sonic_break_light`）には索引が無く、この確認は本サブが初めて行うものである。

**★あわせて実測した——同じ壊れた状態での引数なし `-check`**:
```
$ go run ./cmd/seedgen -check
OK: 生成物は既存ファイルと一致
exit=0                     ← ★緑を返す

$ go test ./internal/seedgen/
exit=1                     ← ★こちらだけが捕まえる
```
**⇒ `-check` が守るのは `000026` だけであり、索引・別名の 3 本は守らない**（`CHANGE-163` §1 / `SUPP-001` §5.5.4 (10)）。**「`-check` が緑だから golden は守られている」と読むと、守られていない区分を守っていることにできる。** 本サブはこの主張を実測で裏付けた最初の例である。復元後 `go test ./internal/seedgen/` = exit 0。

### 6-3. マイグレのファイル名から `data_` を外す

```
$ bash scripts/check-migration-license.sh
NG  ★静かな漏れ: migrations/000106_correct_terry_quick_burn_code.down.sql はゲームデータ表(moves)へ
    書くのに `_data_` を持たず層 A(AGPL)へ落ちている。⇒ 層 B なら
    `000106_data_correct_terry_quick_burn_code.down.sql` へ改名すること
NG  ★静かな漏れ: migrations/000106_correct_terry_quick_burn_code.up.sql は（同上）
結果: 違反 2 件
exit=1
```
**⇒ 期待どおり赤（up / down の 2 件）。** 復元後 exit 0。

### 6-4. ★追加: `000106` の down を空振りにして、新設テストが効くことを確認

指示書は求めていないが、**「テストが green であることと、テストが効くことは別である」**（`SUPP-001` §5.5.4 (10)）ため実施した。down の `AND code = 'quick_burn'` を当たらない値へ書き換えたところ:

```
--- FAIL: TestRun_M2805_DownUpRoundTrip (0.81s)
--- FAIL: TestRun_M2805_LinksSurvive (0.89s)
FAIL
```
**⇒ 期待どおり 2 本が赤。** 復元後 exit 0。`TestRun_M2805_V106State` が緑のままなのは正しい——同テストは v106 の最終状態だけを主張しており、down の中身には触れていない。

---

## 7. テスト結果（実測）

| # | 対象 | 結果 |
|---|---|---|
| 1 | `go test ./...` | **緑**（58 パッケージ ok / 0 FAIL / 9 は no test files） |
| 1b | golden 4 本（`TestGolden_(CommittedMigration\|MoveCommands\|M2002NumericAliases\|M2002SRKAliases)MatchesRegeneration`） | **4 本とも PASS** |
| 1c | `TestRun_M2805_*` 3 本 | **3 本とも PASS** |
| 2 | `cd web && pnpm test -- --run` | **緑**（Test Files 212 passed / Tests 2454 passed） |
| 3 | `make e2e`（**★リポジトリルートで実行**） | **緑**（247 passed / 5.2m） |
| 4 | `go run ./cmd/seedgen -check` | `OK: 生成物は既存ファイルと一致` / exit 0 |

**★`make e2e` はリポジトリルートで実行した。** `web/` で実行すると `Nothing to be done for 'e2e'.` が返り、**1 本も走らないのに赤も出ない**（`M28-04` が踏んだ）。

### 7.1 常設検査

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh`（**★1 本目に回した**） | exit 0・違反なし |
| `check-migration-license.sh` | exit 0・違反なし |
| `check-stop-discipline.sh` | exit 0・違反なし |
| `check-doc-refs.sh` | exit 0 |
| `check-browser-storage-keys.sh` | exit 0・違反なし |
| `check-enum-sync.sh` | exit 0（既存の INFO のみ。本サブ由来の増加なし） |
| `check-import-order.sh` | exit 0・違反なし |
| `check-instruction-format.sh` | exit 0・違反なし |
| `check-progress-log-index.sh` | **exit 0・違反なし**（Phase D の索引行を追記した後に測定。「検査した 77 件すべてが progress-log に現れる」） |
| `check-md-emphasis.sh` | **exit 0 / 判定は「違反 1 件」で赤。現在 495 行 / ベースライン 436 行。★本サブの寄与は 0 行**（`--list` に `M28-05` の行が 1 件も無い）。**⇒ 既知の `check-md-emphasis-baseline-stale`**（followup 登録済み・改善レーンの手番＝`D-761` で A 案確定済み）。**★執筆中に 1 行だけ増やしたので、その場で直した**——`それは**「…」ではない**` の形は、開き `**` の直後が約物のため CommonMark が強調と読まず `**` が残る |
| `check-doc-inventory.sh` | **exit 0・「型に無いファイルなし」**（型 18 件 / 既知の例外 28 件） |

**★成果物そのものが母数に入る 3 検査は、本報告書と `progress-log.md` を書いた後に測定した値である**（`M28-04` の教訓 4）。**書く前に測った値は完了時の値ではない。**

---

## 8. ■ 併せて更新が要るもの

| # | 事項 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の登録** | **不要。消費 0 本**（`docs/design/` の名指しは実査で 0 件＝§1）。⇒ `change-number-registry.md` §1 は動かない |
| 2 | **★マイグレ連番 `000106` を消費した** | **★設計卓の手番。** `D-382` により製造は `parallel-board.md` を書けない。⇒ **`docs/process/parallel-board.md` §2.2 の「次に払い出すマイグレ連番」を `000107` へ更新することを請求する** |
| 3 | **★★ボード §2.2 は既に大きく古い** | **現在の記載は `000092`。`migrations/` の実測末尾は本サブ適用後で `000106`。** ⇒ **14 本ぶんずれている**（`M14-03f` 等の消費が反映されていない）。**★この行は連番を消費するサブが完了するたびに古くなる**とボード自身が書いているが、実際に古くなっている。設計卓で実測に基づき取り直すことを請求する |
| 4 | **版を上げた文書の参照元** | **なし**（本サブは指示書・チェックリスト・設計書のいずれの版も上げていない） |
| 5 | **`docs/design/` に反映が要る箇所** | **★0 件**（§1 で実査済み。`docs/design/` に `quick_burn` / `quick_burn_light` の名指しは無い） |
| 6 | **★`followup-backlog.md` §BS の起票元行を閉じる** | **★設計卓の手番。** `terry-quick-burn-light-move-code-error`（状態＝「起票済み・投入可」）は本サブで解消した。⇒ 閉じてよい。**製造は §J 以外を編集できない**（`D-382`）。（レビュー 中-2） |

### 8.1 ★★請求の届け先（**「請求を書いた」と「請求が届く場所に置いた」は別である**）

**設計卓は `docs/progress/` を読まない**（2026-08-11 開発者裁定①。`M28-02b` の横断課題 1 と同型）。**⇒ 上表 2 / 3 / 6 は完了報告に書くだけでは届かない。**

**本サブが採った届け先**: **`docs/progress/progress-log.md` の索引行 ★横断課題 2**（本ファイルと同じ手番で追記済み）。同ファイルは**横断インデックス**であり（`CLAUDE.md` §8）、設計卓・後任サブがここから辿る。**★`implement_plan_full` の Phase 構成には設計伝達レポート（`/design_handover_report`）の生成が入っていない**ため、より強い届け先が要る場合は開発者が同コマンドを別途回す必要がある。

### 8.2 設計卓への伝達候補（**軽微・実害なし**）

| # | 内容 |
|---|---|
| 1 | **指示書 §2.1 の括弧書きが実物と違う**（レビュー 低-1）。「`character_data/` 2 件（`terry.csv` の `quick_burn_light` と `quick_burn_od` の対）」とあるが、`quick_burn_light` の grep が当たる 2 件は **`terry.csv` L32 と `command-correction-history.md` L15** である（`quick_burn_od` は `quick_burn_light` を含まない）。**件数は合っているが内訳が違う。** ⇒ 実装には影響しなかったが、内訳を信じて `command-correction-history.md` を見落とす経路があった |
| 2 | **`DES-004` §2.1 の必殺技パターンに「強度の区別が無い必殺技」の形が無い**（レビュー 低-4）。表は `<技名>_<強度>`（`hadoken_light` / `shoryuken_od`）だけを挙げており、`sonic_break` / `quick_burn` のような **`<技名>` 単体**の形が無い（特殊技の行から類推はできる）。**⇒ 本型の誤りは今回で 2 例目である。表に 1 行あれば入力時に防げる** |

### 8.3 次に同型の改名を行うサブへの申し送り（**製造判断で不採用**）

**`SUPP-001` §5.5.4 (8) は「転記キーを `move_code` 単独にしない・`name_ja` との対で確認する」と定めている**（レビュー 低-2）。本サブの `000106` は `character_id` ＋ `code` で絞っており、**`name_ja` を SQL 側では見ていない**。

**⇒ 不採用とした理由**: (i) **先例 `000063` 節 A も採っていない**（同じ規約の下で書かれている）。(ii) `moves` に `name_ja` 列は無く、`preset_aliases` / `official_ja_move` 経由の `EXISTS` になるため、**ガードが増える代わりに読みにくくなる**。(iii) 本サブは **`character_id` ＋ `code` の対＋`NOT EXISTS` ガード＋往復テスト**で「当たったこと」を三重に固定しており、**規約の趣旨（別の技を静かに上書きしない）は満たされている**。**★ただし「対で確認する」を SQL 側でも取りたくなる形はありうるので、選択肢として残す。**

---

## 9. やらなかったこと（指示書 §3）

| # | 内容 | 状態 |
|---|---|---|
| 1 | 全キャラ点検（`D-161`） | **行っていない。**`_light` 孤児の走査だけを軽く回した（§10） |
| 2 | `docs/` の歴史記録の書き換え | **行っていない**（45 件すべて据え置き） |
| 3 | `quick_burn_od` の改名 | **行っていない。**`quick_burn` / `quick_burn_od` の既存形へ合流した。テストで `quick_burn_od` = 1 件が不変であることを対照として固定してある |
| 4 | `code` だけで `UPDATE` を絞ること | **行っていない**（`character_id` ＋ `code` の対で絞った） |
| 5 | golden を理由なく上書きすること | **行っていない**（§5 で動いた理由を特定してから再生成した） |
| 6 | `docs/design/` の編集 ／ `followup-backlog.md` §J 以外の編集 ／ CHANGE 番号・マイグレ連番の自採番 | **いずれも行っていない** |

---

## 10. ★同型の報告（`D-161`＝**直さない。報告のみ**）

`_light` 孤児（同一キャラに `_medium` / `_heavy` の対を**どちらも持たない** `_light`）を全 CSV で再走査した。

- **`_light` 総数: 160**（`M28-04` 時点の 161 から、本サブの是正で 1 件減）
- **孤児: 1 件のみ** ＝ `ingrid` / `sun_flare_light` / 「**弱**サンフレア」

**⇒ 新たな同型は見つからなかった。** `sun_flare_light` は **2026-09-06 に開発者が「正しい」と確認済み**（`name_ja` に強度語「弱」が付いており、同系に `sun_flare_lv1`〜`lv3` がある）。⇒ **是正対象ではない。**

**★この走査は誤り検出ではない**（`D-161`）。`name_ja` の形から立てた仮説にすぎず、インゲームでの強度の実在は実機でしか確かめられない。**terry と ingrid の 2 件で目安が当たったことは、目安が正しいことの証明ではない。**

---

## 11. ★確かめられなかったこと・解釈したこと（断定に化けさせない）

| # | 内容 |
|---|---|
| 1 | **「`quick_burn` が正しい code である」ことの根拠は開発者のインゲーム確認（2026-09-06）である。** 製造はインゲームを確認していない。`DES-004` §2.1 の変種サフィックス表からの導出（強度の区別が無い技は `<技名>` 単体）と、`command-correction-history.md` の「対応 dist code = `quick_burn`」が傍証として整合する |
| 2 | **`docs/` の母数 16 → 45 の説明は「差分ファイルの作成日時が `M28-04` の母数実査より後であること」に基づく再構成である。** `M28-04` が実際にどの時点で `grep` を回したかは記録に無い。ただし 16 の内訳が過不足なく再構成できたため、確度は高い |
| 3 | ~~**DB 実測は「HEAD のマイグレを新規 DB へ全適用した状態」である。** 開発者の手元の既存 DB で `000106` の `UPDATE` が実際に 1 行に当たることは、`down` → `re-up` の往復で等価な状態を作って確かめたのみであり、実機の DB では確かめていない~~ **★【2026-09-07 解消】開発者の実 DB のコピーに対する実測で確かめた**（§14-B）——適用前に `000106` の `WHERE` 句が **`id=318` の 1 行に当たる**ことを確認し、適用後に同じ `id` で `quick_burn` へ改名されたことを確認した。**★ただし完全には解消していない**——**`combo_steps` の参照は 0 件だったため、「既存コンボの参照が改名を跨いで生きる」ことは実 DB では未観測である**（新規 DB では `TestRun_M2805_LinksSurvive` が固定している）。**⇒ 「確認して問題なかった」ではなく「その DB では観測できなかった」である** |
| 4 | **配布済み DB は対象外である**（`M26` の公開ゲート前であり、そもそも存在しない）。本サブが `M28` の窓のうちに行われる理由そのものである |

---

## 12. レビュー結果 ＋ トリアージ

**レビュー報告書**: `docs/progress/m28-05-review.md`（Phase B・**メイン会話文脈を継承しない独立サブエージェント**が実施。`fork` は使っていない）。**トリアージの全文は同書末尾の `## 取り込み結果（自動トリアージ）` にある。**

| 項目 | 実測 |
|---|---|
| **重大（チェックリスト §6 の 8 項目）** | **0 件** |
| 指摘の内訳 | **高 2 ／ 中 3 ／ 低 4 ＝ 計 9 件** |
| **採否** | **★全 9 件を採用。不採用 0 件。** ⇒ **「高」指摘の不採用は 0 件**であり、エスカレーションは発生していない |
| 再レビュー往復 | **0 回**（初回レビューのみ。上限 2 回に達していない） |

### 12.1 採用した指摘と、それによる変更

| # | 優先度 | 指摘 | 対応 |
|---|---|---|---|
| 高-1 | 高 | `progress-log` 未追記のまま §13-7 が **○** ／ §7.1 の 3 検査が「→ §11」を指すが §11 に測定値が無い | **Phase D で索引行を追記 → `check-progress-log-index.sh` 緑を確認 → §13-7 を実測付きへ。§7.1 の 3 行へ完了時点の実測値**（`check-md-emphasis` は 495/436 で赤・**本サブ寄与 0 行**という内訳まで）**を記入し、壊れた参照「→ §11」を消した**（§7.1 / §13） |
| 高-2 | 高 | 設計卓宛の請求が `docs/progress/` にしかなく届かない | **`progress-log.md` の索引行 ★横断課題 2 へ 3 件**〔(a) 次の連番は `000107` ／ (b) **ボード §2.2 が `000092` のままで 14 本ぶん古い** ／ (c) §BS の行を閉じてよい〕**を明記。完了報告にも §8.1「請求の届け先」を新設**（§8 / §8.1） |
| 中-3 | 中 | §3.2 の「旧 code 残存は `000106` の up/down のみ」が誤り | **実測 10 件へ訂正**（`000106` 8 件 ＋ `migrate_m2805_test.go` 2 件）。**`internal/` の母数が 0 → 2 になったことも明記**（§3.2） |
| 中-1 | 中 | `command-correction-history.md` に追随注記が無く、当時の登録が `quick_burn_light` だった事実が消えている | **同ファイルの terry 表の直下へ注記 3 行を追加**（改名日・作業 ID・当時の値・一次源）。**★開発者裁定（`move_code` セルは改名して追随）と両立する形にした** |
| 中-2 | 中 | `followup-backlog.md` §BS の起票元行を閉じる請求が §8 に無い | **§8 の表へ 6 行目として追加**（**閉じるのは設計卓の手番**＝`D-382`） |
| 低-1 | 低 | 指示書 §2.1 の括弧書きが実物と違う | **§8.2 の伝達候補 1 として記載** |
| 低-4 | 低 | `DES-004` §2.1 に「強度の区別が無い必殺技」の形が無い | **§8.2 の伝達候補 2 として記載** |
| 低-2 | 低 | `name_ja` との対を SQL 側でも取る選択肢 | **§8.3 に申し送りとして記載。★SQL への追加は製造判断で不採用**（先例 `000063` も採っておらず、`character_id`＋`code`＋`NOT EXISTS`＋往復テストで規約の趣旨は満たされている）**——不採用の理由を同節に明記した** |
| 低-3 | 低 | §2.1 の `git diff --stat` が自コミット前の値である旨の注記 | **§2.1 へ 1 行追加** |

**★不採用は 0 件である。** 低-2 は「SQL への `name_ja` ガード追加」を製造判断で採らなかったが、**指摘そのものは §8.3 の申し送りとして採用しており**、レビュアーも「採否は製造判断でよい」と明記している。

### 12.2 ★レビューが押し戻した本質

**指摘 9 件のうち 8 件が「記録」に対するものであり、コードへの指摘は 0 件だった**（中-3 も記述の訂正であってコードは直していない）。**⇒ 本サブで壊れやすかったのは実装ではなく、「やったこと」と「書いたこと」の一致である。** とくに高-1 は `D-510` とまったく同型（**観測していないことを断定した**）であり、**同じ工程で 2 度目である**ことを記録に残す。

---

## 13. 完了条件の充足（指示書 §6）

| # | 完了条件 | 判定 |
|---|---|---|
| 1 | §2.1 の母数が `M28-04` の実測と一致（不一致なら止めて報告） | **○** — 判断に効く 6 区分は一致。`docs/` のみ差異があり **Plan Mode で報告し開発者が続行を裁定**（§1.1） |
| 2 | `character_data/terry.csv` と DB の両方が直っている | **○**（§2.2 / §3） |
| 3 | golden 4 本が再生成され、動いた理由が報告に在る | **○**（§5） |
| 4 | §2.4 の破壊確認 3 件が実走されている | **○**（§6-1〜6-3。**＋追加 1 件＝§6-4**） |
| 5 | §5 のテストが緑 | **○**（§7） |
| 6 | `docs/design/` に反映が要る箇所が一覧になっている（0 件のはず） | **○ — 0 件**（§1 / §8-5） |
| 7 | `docs/progress/progress-log.md` へ追記されている | **○** — Phase D で索引行を追記し、**`bash scripts/check-progress-log-index.sh` が exit 0・違反なし**であることを確認した（§7.1）。**★レビュー 高-1 の是正**——初版は追記の前に **○** と書いており、`D-510` と同型の「観測していないことの断定」だった |
| — | **（指示書の完了条件外）開発者の手動確認** | **B＝実施済み・合格 ／ C＝未実施**（§14）。**★C は「未実施」であって「問題なし」ではない** |

---

## 14. ★開発者の手動確認（**コードでは判定できない項目**）

> **★状態（2026-09-07 時点）**
> - **B（既存 DB への追随確認）＝ 実施済み・全項目合格。** 実施は開発者 ＋ devContainer 側の AI エージェント（DB 操作パートを委託・アプリ起動は開発者）。
> - **C（画面の目視）＝ 未実施。** ⇒ **本節の C 欄は空のままであり、「確認して問題なかった」という意味ではない。**
> - **★「未実施」と「確認して問題なし」を区別すること**（`M27-01` §8.4 の流儀）。

**なぜ本節が要るか**: 本サブは三点更新（CSV 正本 → golden → 追随マイグレ）を採ったため、**新規 DB では `000106` の `UPDATE` は 0 行に当たって成功する**（`SUPP-001` §5.5.4 (6)）。**⇒ CI が緑でも「既存 DB が追随した」ことの証拠にはならない。** 1 行に当たる経路を持つのは開発者の手元の既存 DB だけであり、`*.db` は `.gitignore` 済みでクラウド側からは触れない。

### 14.1 B — 既存 DB への追随確認（**実施済み・合格**）

**方式**: **実 DB を直接触らず、実 DB のコピーに対して適用した**（開発者判断 2026-09-07）。コピーは中身がビット同一なので `UPDATE` の挙動は実 DB と同一であり、**実 DB は `schema_migrations` が 105 のまま残る**ため `main` へ戻っても起動が落ちない。

| 項目 | 実測 |
|---|---|
| 実 DB | `/home/node/.local/share/tacpendium/tacpendium.db`（1,732,608 bytes） |
| 検証コピー | `/home/node/.local/share/tacpendium/m2805-check.db`（DB 1,732,608 ／ **WAL 403,792** ／ SHM 32,768 bytes） |
| ブランチ | `claude/m28-05-implementation-plan-ihz72o` |

**★WAL を含めてコピーすることが必要だった。** 実行側は**本体のみの旧バックアップで取った値を破棄し、DB＋WAL＋SHM の揃ったコピーで取り直している**。WAL が 403KB あるため、**本体だけコピーしていたら古い状態を読んでいた**。

#### 適用前（B-3・生出力）

```
schema_migrations: [(105, 0)]
columns: id, code, is_derived
(318, 'quick_burn_light', 0)
(319, 'quick_burn_od', 0)
before move.id: 318
before move_commands: [(1,)]
before preset_aliases: [(4,)]
before combo_steps: [(0,)]
000106 WHERE matching rows: [(318,)]
```

**★最後の行が本検証の直接証拠である。** `000106` の `WHERE` 句（`character_id` ＋ `code` ＋ `NOT EXISTS` ガード）をそのまま適用前の DB に流し、**当たる行が `id=318` の 1 件であること**を確認している。**⇒ これは手順書には無く、実行側が自発的に足したものである。** 「0 行に当たっても成功する」性質を持つマイグレに対して、**当たったことを適用前に確定させる**唯一の直接的な方法であり、以後の同型サブでも採るべき形である。

#### 適用（B-4）

開発者が検証コピーを指定してアプリを起動し、適用完了を申告。**マイグレはアプリ起動時に `db.Open` より前で自動適用される**（`cmd/tacpendium/main.go:278`）。**AI 側はマイグレも手書き `UPDATE` も実行していない。**

#### 適用後（B-5・生出力）

```
schema_migrations: [(106, 0)]
(1) 改名: [('quick_burn', 1), ('quick_burn_od', 1)]
(2) move.id: [(318,)]
(3) 索引: [(1,)] 別名: [(4,)]
(4) コンボ参照: [(0,)]
```

#### 判定

| # | 期待 | 結果 |
|---|---|---|
| **0** | `version` = 106 / `dirty` = 0 | **○** マイグレ中断なし |
| **(1)** | 旧 code 0 件・新 code 1 件を**対で**、`_od` は不変 | **○** `quick_burn` 1 ／ `quick_burn_od` 1 ／ `quick_burn_light` は消えた |
| **(2)** | 適用前に控えた `id` と同一 | **○ `id=318` を維持**。⇒ **改名であって削除＋再作成ではない**（件数だけでは捕まえられない事故を排除） |
| **(3)** | `move_commands` / `preset_aliases` が適用前後で一致 | **○** 索引 1 件・別名 4 件で一致。⇒ **「`moves.id` 参照なので `code` の改名で紐付きは切れない」（`DES-003` §3.3 / §3.14）が実 DB で成立** |
| **(4)** | `combo_steps` が適用前後で一致 | **△ 0 件で一致。★ただし 0 件のため「既存コンボの参照が改名を跨いで生きる」ことは未観測である**（新規 DB では `TestRun_M2805_LinksSurvive` が固定している） |

**★`preset_aliases` 4 件の内訳は特定していない。** seed 由来で期待できるのは 3 本（`official_ja_move`＝`000026` ／ `numeric`＝`000072` ／ `srk`＝`000073`）であり、**4 件目は利用者がプリセット編集 UI で足した別名の可能性がある**（実 DB なので当然ありうる）。**判定条件は「適用前後で一致すること」であり、内訳は判定に不要**なので追っていない。

**★SQL の更新件数ログそのものは取得していない。** 判定は「適用前の `WHERE` 一致 1 行」と「適用後の同一 `id` の改名」の対で行っている。

### 14.2 B-7 — C の目視に渡す予測値（**データ面での先取り確認・合格**）

```
terry/quick_burn:  ファミリーで活性=[('quick_burn_od', 'od')] / ファミリー非対象=['quick_burn']
guile/sonic_break: ファミリーで活性=[('sonic_break_od', 'od')] / ファミリー非対象=['sonic_break']
```

**★terry と guile の形が一致した。** `parseSpecialCode`（`web/src/features/combo/inputResolution.ts:107-116`）は `_light` / `_medium` / `_heavy` / `_od` で終わる code しかファミリーに分解せず、接尾辞を持たない code は `null`（ファミリー UI 非対象 → プルダウンで網羅入力）にする。**⇒ 改名後は必殺技パネルで［弱］が非活性になり、`quick_burn` 本体はプルダウンからの入力になる。**

**★これは退行ではなく、`sonic_break`（`M19-04c` で同じ改名を行った先例）と同じ「単一強度の必殺技」の正しい姿である**——**対照が一致したことがその根拠**（`SUPP-001` §5.5.4 (10′)「対照実験を添える」）。**★ただし画面での実挙動は未確認であり、許容の判断は開発者の手番である**（§14.3）。

**★この観点は指示書・チェックリスト・レビューのいずれも触れていない。** 本セッションが手動確認の手順を組む過程で `inputResolution.ts` を読んで見つけた。

### 14.3 C — 画面の目視（**未実施**）

| # | 見ること | 期待 | 結果 |
|---|---|---|---|
| C-1 | 必殺技パネル「クイックバーン」の強度ボタン | **OD だけ活性・弱/中/強は非活性**。ファミリー名は「クイックバーン」のまま | **未実施** |
| C-1' | **★対照**: guile「ソニックブレイク」 | **terry と同じ形**（一致すれば先例どおりで正しい） | **未実施** |
| C-2-1 | `/moves/edit`（terry） | 「コード」列が `quick_burn` ／「表示名」列が「クイックバーン」 | **未実施** |
| C-2-2 | `/presets/:id/edit`（`numeric` / `srk`） | 「クイックバーン / `quick_burn`」の行の表記が `214LP` | **未実施** |
| C-2-3 | `/combos/:id` ／ `/combos/:id/edit` | 既存コンボの表示・編集保存が通る | **未実施** |
| C-2-4 | terry 以外（guile 等） | 巻き添えが無い | **未実施** |

**★C-2-2 が本サブ固有である。** 先例（`sonic_break_light`）は `is_derived=1` で索引・別名に非搭載であり、`000072` / `000073` が動く経路は今回が初めて。**`make e2e`（247 passed）は C-2 の 1・3・4 に近い経路を通すが、C-1 と C-2-2 は射程外**であり目視が唯一の確認手段。

### 14.4 ★手順上の相違（**手順書側の誤りと、その是正**）

**リレー手順書が指定した検証クエリは `moves.name_ja` を参照していたが、`moves` に `name_ja` 列は存在しない**（`migrations/000001_init_schema.up.sql:39-53`）。表示名は `presets.code='official_ja_move'` の `preset_aliases.alias_text` を引いて得る設計である（`internal/repository/move/queries.go:26,42`）。

- 実行側は初回に `no such column: m.name_ja` で**停止し、開発者の承認を得てから同列だけを除外して再実測**した。**⇒ 推測で埋めずに止めた点で正しい対応である。**
- **★手順書を書いた側（本セッション）の誤りである。** 「`moves` に表示名カラムは無い」という事実は手順書を組む過程で既に把握していたにもかかわらず、クエリに書いてしまった。
- 除外した列は**判定条件に一切関与しない**（判定 0〜(4) は `code` / `id` / 参照件数のみで成立する）。⇒ **結果の有効性には影響しない。**
- DB スキーマ・データ・リポジトリファイルは編集されていない。

### 14.5 残っている手番

| # | 内容 | 誰が |
|---|---|---|
| 1 | **C の実施**（§14.3） | 開発者 |
| 2 | **C-1 の挙動変化を許容と判断したら、その判断を記録に残す**（§8.1 の届け先経由）。残さないと次に単一強度の必殺技を扱うサブが同じ疑いをゼロから持ち直す | 開発者・設計卓 |
| 3 | **A（差分レビュー）／ D（マージ）** | 開発者 |
| 4 | §8 の 6 件（ボード §2.2 の連番・`followup` §BS の解消・裁定 2 件の記録 等） | 設計卓 |

---

*以上、M28-05 完了報告。* **★本サブの落とし穴は「1 行の改名だから軽い」と読むことであった。** 動く golden は 4 本あり、**`seedgen` の引数なし `-check` が守るのはそのうち 1 本だけである**——§6-2 でこれを実測し、`000035` を壊した状態で `-check` が `OK` / exit 0 を返すことを確かめた。**⇒ 恒久のガードは `-check` ではなく `go test ./...` の `TestGolden_*MatchesRegeneration` 群である。**
