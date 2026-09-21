# 設計伝達レポート: M28-04（`move_code` / `command` / `startup_basis` の是正）

| 項目 | 内容 |
|------|------|
| 作業ID | M28-04 |
| 対象指示書 | `docs/instructions/M28-04-move-code-and-command-corrections.md` **v1.1.0** ／ チェックリスト `docs/instructions/reviews/M28-04-review-checklist.md` **v1.0.0** |
| CHANGE | **消費 0 本。★製造は番号を消費していない**（`D-293`）**。★`docs/design/` に当該 3 code の名指しは 0 件であり、本サブ由来の起票は不要**（§6） |
| マイグレ | **★★消費 0 本。`000106` は未消費のまま返す。**⇒ ボード §2.2 の「次に払い出す番号」は動かない（`migrations/` の実測末尾は `000105`） |
| 作成日 | 2026-09-06 |
| 実装コミット | `claude/m28-04-implementation-plan-mhaf2o`・`25c9285..d0fe1d2`（4 コミット・**push 済み**）／ PR [plexiblinp/combomgr#161](https://github.com/plexiblinp/combomgr/pull/161)。**★差分は `docs/progress/` 3 ファイル ＋ 本レポート＝+1138 / −0。コード・CSV・マイグレの差分は 1 行も無い** |
| 源泉 | 完了報告 `docs/progress/M28-04-completion-report.md` ／ レビュー `docs/progress/m28-04-review.md`（高 4 / 中 3 / 低・所見 2・**高の不採用 0 件**・再レビュー往復 0 回）／ **開発者との確定 4 件**（2026-09-06。うち 1 件はインゲーム確認、1 件は手元 DB の実測）／ 実装直後の同一セッションで生成 |
| 宛先 | 設計卓（親チャット） |

**本レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 に絞る。指示書どおりの部分は割愛する。**

**★★最重要は §2-1（指示書が命じた是正を 1 件も実施していない — 受理して指示書・board・followup を更新するか、差し戻すかの裁定が要る）と §4-1（terry `quick_burn_light` の新規起票 — `M28` の窓のうちに）である。**

> **★★設計卓は `docs/progress/` を読まない**（2026-08-11 開発者裁定①）**。したがって本レポートは参照だけを書かず、判断に要る中身をここへ埋めてある。**

> **★`DES-002` §4.2 の経路表に載る API の新設・変更は 0 件である。** 本サブは `internal/` `cmd/` `web/` を 1 行も触っていない。⇒ 本レポートに API 契約の逐語は無い。

---

## 0. 本サブで実際に起きたこと（3 行で）

1. **指示書 §2.1「母数を出す」を実施した結果、射程 9 行**（guile 3 件 ＋ 同乗 6 行）**がすべて `M19-04c`（マイグレ `000063`・2026-08-03）で既に是正済みであることが判明した。**
2. **開発者判断により、実査報告だけで完了させた**（コード変更ゼロ）。**指示書自体の改訂・失効判断は設計卓へ請求のみ。**
3. **副産物として terry `quick_burn_light` が同型の誤りとして挙がり、開発者のインゲーム確認で確定した**（本サブの射程外・§4-1）。

---

## 1. 独自確定仕様（設計書に無い／設計書より細かい決めごと）

### ★★§1-1 `seedgen -check` の既定モードは第一波 9 キャラしか再生成しない（`SUPP-001` §5.5 へ追記が要る）

**`SUPP-001` §5.5 は (6)(7)(8) で三点更新・列種別・改名の作法を規約化しているが、「golden の検査をどう張るか」の射程には触れていない。** 本サブはそこで実際に踏み外した。

**実測**（`character_data/` を scratchpad へ複製し、複製側だけを壊して `-check`。リポジトリは無改変）:

| 破壊 | 対象行 | 既定モード `go run ./cmd/seedgen -data <複製> -check` |
|---|---|---|
| A | guile `sonic_cross_2_meter_od` のフレームを是正前へ | **`DIFF: 000026_...up.sql` / exit 1** ✅ |
| B | guile `sonic_break` → `sonic_break_light` へ逆改名 | **`DIFF:` up・down 2 本 / exit 1** ✅ |
| D | kimberly `bushin_prism_strikes` を是正前へ | **`DIFF: 000026_...up.sql` / exit 1** ✅ |
| **★★C** | **manon `temps_lie` を是正前（`5,1,23,28`）へ** | **★★`OK: 生成物は既存ファイルと一致` / exit 0 ＝ 捕まらない** |
| C' | 同じ複製に `-chars manon -out 000045_seed_moves_manon` を明示 | **`DIFF: 000045_...up.sql` / `.down.sql` / exit 1** ✅ |

**★機構**——`internal/seedgen/generate.go:20` の `FirstWaveOrder` は **`terry, guile, lily, ingrid, kimberly, juri, ken, mai, zangief` の 9 キャラ**であり、**manon は含まれない**（manon は `000045`）。**⇒ 引数なしの `-check` が突き合わせるのは `000026` 系だけである。**

**★実害の形**——**チェックリスト §6-1 は「CSV を直さずに DB だけ直した状態を作り、seed を再生成する／元へ戻ることを実測で示すこと。★★この確認が本サブの中心である」を必須の破壊確認に指定していた。** その手順を素直に実行すると、**第一波外のキャラでは緑が返り、「機構が守っている」の証拠として使えてしまう。⇒ 守られていない区分を守っていることにできる。**

**★守っているのは `go test ./...` の側である**——`TestGolden_ManonMovesMatchesRegeneration`（`internal/seedgen/generate_m1403d_test.go:38`）。**⇒ 本サブの 9 行の内訳は「`000026` の golden が 8 行 ／ `000045` の golden が 1 行」であった。**

**⇒ 反映依頼**: **`SUPP-001` §5.5 へ (10) として次を明文化してほしい。**

> **golden の破壊確認は、射程の全区分から 1 件ずつ取ること。**`seedgen` の引数なし `-check` は第一波（`FirstWaveOrder` の 9 キャラ＝`000026` 系）しか再生成しない。**第一波外のキャラ**（manon＝`000045`、第三波＝`000055`、第四波＝`000084` 等）**は `-chars` / `-out` を明示しないと突き合わせられず、壊しても緑が返る。** 恒久のガードは `go test ./...` の `TestGolden_*MatchesRegeneration` 群であり、**`-check` はその部分集合にすぎない。**

たたき台は §6。

### §1-2 確定反撃サーチの飛び道具除外は「相手技側だけ」で、始動技側には無い（as-built・明文が無い）

**設計書は 4 か所で「飛び道具は自動走査から除外して手動確認へ出す」と書いているが**（`DES-002` §4.2 の `/api/punish-finder` 行 ／ `DES-004` §2.5 ／ `DES-005` §5.20 ／ `DES-003` §3.3 の `is_projectile` 列）、**いずれも相手技側の話であり、始動技側に触れていない。**

**as-built**（`internal/service/punishfinder/service.go`）:

| 側 | 絞り込み | `is_projectile` |
|---|---|---|
| **相手技側**（`Scan` の pass 1） | `isNonPunishableTarget`（`is_aerial` ／ 移動 system move）で完全除外 → `damage=0` で完全除外 → pruning → `Damage == nil` は手動確認 → **`om.IsProjectile` は手動確認**（`:247-251`「c: 飛び道具は手動確認(距離依存)」） | **★除外する**（`ManualReviewNodes` の `distance_dependent` へ回し、有利フレームの算出に到達しない） |
| **始動技側**（`buildStarters`・`:345`） | `damage > 0` かつ `grounded = !sm.IsAerial`。地上レーンは `*sm.Startup <= adv` | **★★見ていない。⇒ 飛び道具も始動技候補に入る** |

**★走査 SQL `listMovesForScanSQL`（`internal/repository/punish/queries.go`）は `is_derived` / `startup_basis` / `category` を投影すらしない。** ⇒ 相手技/始動技で同じ行集合を取り、**除外の非対称はサービス層だけで表現されている。**

**★これが実際に効いた**——`D-158` が「6 行が確定反撃サーチの候補に入っているかは未確認」と残した点に対し、**mai の 2 行**（`midare_kachousen` / `flame_midare_kachousen`・ともに `is_projectile=1`）**は相手技側では手動確認レーンへ回るが、始動技側では候補に入る**という非対称な答えになった。

**⇒ 判断を仰ぎたい**: **(a) as-built を正として `DES-005` §5.20 または `DES-002` §4.2 へ「除外は相手技側のみ」と明文化する ／ (b) 始動技側にも飛び道具の除外を入れる。** **★製造は判断していない**（本サブはコードを 1 行も触っていない）。**★(a) を推す根拠は 1 つある**——`is_projectile` の除外理由は `DES-004` §2.5 の「着弾までが距離で変わるため `on_block` / `recovery` の単一値が有利フレームを意味しない」であり、**これは相手技として有利フレームを算出する側の理屈である。始動技側が使うのは `startup` であり、同じ理屈は当たらない。**

---

## 2. 契約・設計に反する独自判断（★親の裁定が要る）

### ★★§2-1 指示書が命じた是正を 1 件も実施していない

| 項目 | 内容 |
|---|---|
| **何に反したか** | 指示書 `M28-04` **v1.1.0** §2.2（3 件の是正）／ §2.6（6 行の是正）／ §2.4（DML マイグレ 1 本）／ ヘッダ「マイグレ消費 1 本（`000106`）」 |
| **実装がどうなっているか** | **`git diff --stat 25c9285` はコードに 1 行も掛かっていない**（追加は `docs/progress/` の 3 ファイルのみ・+893 / −0） |
| **なぜそう判断したか** | **射程 9 行がすべて `M19-04c`（`000063`・2026-08-03）で既に是正済みだったため**（証拠は §5）。**⇒ 素の `UPDATE` をもう 1 本書けば 0 行に当たって成功し、エラーにはならない**（`SUPP-001` §5.5 (6) が言う形）。`000106` を空振りで消費することになる |
| **開発者の承認** | **2026-09-06 に取得済み**（「実査報告で完了」「指示書の扱いは設計卓へ請求のみ」を選択） |

**★★それでも §2 に挙げる理由**——**開発者が承認したのは「本サブをどう畳むか」であって、「指示書・チェックリスト・board・followup をどう更新するか」ではない。それは設計卓の手番であり、未処理で流れることを避けたい。**

**⇒ 親の裁定が要るのは次の 4 点である**（材料は §4）:

1. 指示書 `M28-04` v1.1.0 とチェックリスト v1.0.0 の**失効判断**
2. `M28-overview` §4 のマイグレ消費表（`M28-04` = **1 本 → 0 本**）
3. `followup-backlog` §BK の 2 行（`guile-move-code-and-command-errors` ／ `startup-total-errors-six-rows`）の**クローズ**
4. `parallel-board` の `P-17` / `P-19` の**クローズ**

### ★★§2-2 指示書 §2.6-1・`D-742`・`D-753`・チェックリスト §0.4-7 の前提が事実と異なる

**4 か所が揃って「6 行のどの列がいくつ誤っているかは、どこにも記録されていない」「推測できるはずがない」と書いている。**

**★事実**——**`D-158`**（`docs/process/archive/parallel-board-rulings-M20.md:160`）**に 6 行の正しい値が全数逐語で記録されている。** 逐語（抜粋）:

> **(1) kimberly `bushin_prism_strikes`**（現行 startup 52 → 正は startup 26 / active 3 / recovery 19 / **total 47**）／**(2) lily `condor_dive_follow_up`**（正は **12 / 12 / 24 / 47**）／…／**(6) manon `temps_lie`**（現行 startup 28 → 正は **5 / 5 / 17 / 26**）

**⇒ 「唯一の記録は記入用コピーの備考欄である」は、`D-158` へ全数転記された 2026-08-02 の時点で失効していた。** しかも**その値は `000063` が既に適用済み**であり、現行 CSV / golden / DB / 回帰テストと一致する（§5）。

**⇒ 親の裁定**: **4 か所の記述を訂正するか、失効文書として畳むか。** **★製造は `docs/instructions/` と `docs/process/` を編集していない。**

### §2-3 チェックリスト §6 の破壊確認 2 件を実施していない

| チェックリスト | 実施 |
|---|---|
| §6-1「CSV を直さずに DB だけ直した状態を作り、seed を再生成する」 | **★是正が発生しないためその状態を作れない。⇒ 代替として §1-1 の破壊 A / B / C / C' / D を実走した** |
| §6-2「マイグレのファイル名から `data_` を外す」 | **★マイグレを作らないため対象が存在しない。**`scripts/check-migration-license.sh` が緑であることのみ確認 |

**★§7 の重大判定基準 1〜8 も同様に対象不存在である。** **⇒ レビュー担当（Phase B の独立サブエージェント）には、この読み替えを明示したうえで「是正済みという判定そのものが正しいか」を検証させた。**

---

## 3. 製造の判断

### 3-1 開発者へ確認して確定した点

| # | 事項 | 確定内容（2026-09-06） |
|---|---|---|
| 1 | **本サブの畳み方** | **実査報告で完了する**（コード変更ゼロ・マイグレ 0 本・CHANGE 0 本）。**指示書自体の扱いは設計卓へ請求のみ** |
| 2 | **指示書 §7-1（§2.2-3 の読みは (a) か (b) か）** | **★返答不要になった。両方だった**——`D-142` の逐語が「**`through` のフレームであるべきところに `standalone` のフレームが入っている**」と値と basis の両方を指しており、`000063` も B-3（数値 `10/29/0/38 → 15/46/11/71`）と B-3'（basis `standalone → through`）の 2 文で両方直している。**⇒ 指示書の二択そのものが後年の読み直しで生じたものである** |
| 3 | **terry `quick_burn_light`** | **★★インゲーム確認により「強度は存在しない」＝誤りで確定**（逐語＝「`quick_burn_light` として登録されているなら、それは誤りで、`quick_burn` に直す必要がある」）。**⇒ §4-1** |
| 4 | **ingrid `sun_flare_light`** | **誤りではないと確定**（逐語＝「正しい」）。**⇒ 閉じてよい** |
| 5 | **開発者の手元 DB の実値** | **★★21 行すべてが本サブの期待値と一致**（guile の sonic 系 15 行〔`sonic_cross_2_meter_od` の `startup_basis=through` を含む〕＋ §2.6 の 6 行。旧 code 2 つは不在）。**⇒ 既存 DB の追随経路が確かめられ、`000063` の `NOT EXISTS` ガードが空振りしていた可能性は消えた** |

### 3-2 推測で進めた点

| # | 内容 |
|---|---|
| 1 | **`D-723` の仕分けがなぜ `D-201` を追跡しなかったかの機序**（§4-3）。**★「`M19-04c` で解消済み」の側は推測ではない**——`D-201` の明示裁定である。**推測にとどまるのは、当時の判断の意図だけ** |
| 2 | **`startup_basis='unknown'` 51 行のうち「`M19-DESIGN-07` §4-1 の母数の外」を 36 行と数えた**（第四波キャラ分）。**★レビュー担当は同じ趣旨を 37 と数えている。⇒ 差の 1 は数え方の違いであり、母数 308 行の対象キャラを確定させないと決まらない。★確定させていない**（§4-6） |

---

## 4. 設計担当が未把握の残課題・申し送り

> **★`followup-backlog.md` の本表は製造が編集しない**（`D-382`）**。⇒ 設計卓が畳めるだけの材料を以下に揃える。**

### ★★4-1 terry `quick_burn_light` の `move_code` が誤り（**新規登録**・★`M28` の窓のうちに）

| 項目 | 内容 |
|---|---|
| **スラッグ案** | `terry-quick-burn-light-move-code-error` |
| **新規/更新** | **新規登録** |
| **何が起きるか** | terry の `quick_burn_light` は**強度の区別が無い技**であり、`_light` 接尾辞が誤り。**`quick_burn` へ改名が要る。⇒ `sonic_break_light` → `sonic_break`（`M19-04c` 節 A）とまったく同型** |
| **根拠** | **開発者のインゲーム確認**（2026-09-06・逐語は §3-1 の 3）／ 現物＝`character_data/terry.csv:32-33`（`quick_burn_light` と `quick_burn_od` の対のみ。`_medium` / `_heavy` は全 CSV 実査で不在）／ 正しい code は `DES-004` §2.1 の変種サフィックス表（`_od` の実例に `sonic_break_od` を挙げる）から導出可 |
| **★★前例より影響範囲が広い** | **`sonic_break_light` は `is_derived=1` で `move_commands` 索引に非搭載だったが、`quick_burn_light` は `is_derived=0` かつ `command` 非空のため索引に載っている**（`migrations/000035_seed_move_commands.up.sql` に `'quick_burn_light', '214LP'`）**。⇒ 動く golden は 1 本ではなく 4 本**：`000026`（moves ＋ `official_ja_move` 別名）／`000035`（索引）／`000072`（numeric alias）／`000073`（srk alias）。**★固定しているテストは順に `TestGolden_CommittedMigrationMatchesRegeneration` / `TestGolden_MoveCommandsMatchesRegeneration` / `TestGolden_M2002NumericAliasesMatchesRegeneration` / `TestGolden_M2002SRKAliasesMatchesRegeneration`** |
| **★DB 側の追随は不要** | `move_commands` も `preset_aliases` も `moves.id` 参照であり、`code` の改名で紐付きは切れない（`DES-003`）。**⇒ 動くのは「`code` で INSERT 先を解決している golden SQL」だけ** |
| **実査済み（起票時の再確認不要）** | 改名先 `quick_burn` は空き（`grep -c '^terry,quick_burn,' character_data/terry.csv` = 0）**⇒ `UNIQUE (character_id, code)` の衝突も改名の順序制約も無い**（`sonic_break` のときのような `NOT EXISTS` の順序依存は不要）／ 走査＝`character_data` 2・`migrations` 10・**`internal` 0・`web`（src・e2e とも）0・`scripts` 0**・`docs` 16（歴史記録）／ **`docs/design/` の名指しは 0 件 ⇒ CHANGE 不要**／ `quick_burn_od` は改名不要（`quick_burn` / `quick_burn_od` の既存形へ合流） |
| **割付の候補と理由** | **`M28` 内の新サブ**（**★`M28-04` の追補ではない**——本サブは完了済みであり、射程外の是正を後から足すと完了報告と実物がずれる）**。★理由＝`move_code` のリネームは配布 DB の識別子が変わる＝`M28` が「破壊的変更の窓」である族そのもの**（`D-725`）**。公開後に変えると利用者のデータに影響しうる** |
| **見込み射程** | DML マイグレ 1 本（`UPDATE moves SET code = 'quick_burn' … AND code = 'quick_burn_light'`・`NOT EXISTS` ガード付き・DDL 無し）／ `character_data/terry.csv` の 1 行／ **golden 4 本の再生成**／ **連番＝`000106`**（本サブが未消費で返した番号） |

> **★★いま起票しないと、次に誰かが `_light` の孤児を走査するまで誰も気づかない。** `D-161` により全キャラ点検は行わない方針であり、**機械検出は効かない**（`seedgen` の `validate()` は内部整合しか見ず、本行は通る）。

### 4-2 既存 2 行のクローズ（**既存行の更新**）

| スラッグ | 更新後の状態 | 根拠 |
|---|---|---|
| `guile-move-code-and-command-errors` | **解決済み・クローズ** | `migrations/000063_correct_moves_data_m1904c.up.sql` 節 A（`sonic_break_light` → `sonic_break`）／ `M19-04c` 指示書 §1.1 B-1〜B-3（`command` 3 件の是正後の値。**現行 `guile.csv:61-63` と完全一致**）／ 節 B-3・B-3'（フレームと `startup_basis`） |
| `startup-total-errors-six-rows` | **解決済み・クローズ**（現状の状態欄は「未着手」） | 同マイグレ節 C-1〜C-6 が**指示書 §2.6 と同一の 6 行**を是正。値の出所は `D-158`。**★開発者の手元 DB でも 6 行が是正後の値であることを実測**（§3-1 の 5） |

### ★★4-3 `D-201` が名指しした 3 か所のうち「引き継ぎ資料 §4」が未特定（**新規登録**）

| 項目 | 内容 |
|---|---|
| **スラッグ案** | `d201-named-stale-locations-not-closed` |
| **何が起きるか** | **`D-201`（2026-08-07）は「`M19-04c`（`000063`）で `P-19` の 6 行は解消済み」と裁定したうえで、「『起票が要る』という記述が ボード `D-158`・保留 `P-19`・引き継ぎ資料 §4 の 3 か所に残っており、未決と読まれる」と場所まで名指ししていた。⇒ 3 か所とも 1 か月後まで直らず、`M28-04` として再起票された。** |
| **根拠** | `docs/process/archive/parallel-board-rulings-M20.md:117`（`D-201` 全文） |
| **★未特定** | **「引き継ぎ資料 §4」がどのファイルかを製造は特定できていない**（`D-201` の記述はファイル名を書いていない）。**⇒ 設計卓が特定して閉じること。★本レポート §4-2 でも拾えていない第 3 の箇所である** |
| **割付の候補** | **設計卓**（`docs/handover/` の該当ファイルを特定して更新） |

### 4-4 `check-md-emphasis.sh` のベースラインが 58 行ぶん古い（**新規登録**）

| 項目 | 内容 |
|---|---|
| **スラッグ案** | `check-md-emphasis-baseline-stale` |
| **何が起きるか** | 着手基点 `25c9285` の時点で **494 行 / ベースライン 436 行 ＝ 58 行増**で赤。**⇒ 本サブが 1 行も触っていない状態で既に赤である。★赤が常態化すると、実際の増加を検出できなくなる** |
| **根拠** | 所在は `docs/handover/retrospective-digest.md`（41）／ `docs/progress/M26-02-completion-report.md`（40）／ `docs/progress/M21-RESEARCH-01-report.md`（40）等。**★本サブ由来の違反は 0 件**（完了報告が一度 7 行足したが Phase C で直した。**レビュー報告 `m28-04-review.md:95` の 1 行だけは意図的に残した**＝独立レビュアーの本文を製造が編集すると Phase B の独立性が弱まるため） |
| **割付の候補** | **改善レーン**（`scripts/` を触るので並走が解けている手番＝`D-335`） |

### 4-5 `is_derived=1` かつ `startup_basis='unknown'` が 51 行（**新規登録**・★性格が一様でない）

| 項目 | 内容 |
|---|---|
| **スラッグ案** | `startup-basis-unknown-51-rows-mixed-provenance` |
| **何が起きるか** | **51 行あるが、3 つの異なる性格が混在しており、一括して「未確定の残」とは呼べない** |
| **内訳（DB 実測）** | `elena 10 / blanka 8 / chun_li 7 / alex 4 / m_bison 4 / yasmine 4 / ken 3 / marisa 3 / dee_jay 2 / cammy 1 / guile 1 / ingrid 1 / jamie 1 / lily 1 / rashid 1` |
| **性格の切り分け** | **(i) 開発者が確定させた `unknown`**——guile `sonic_break_od`（`docs/progress/20260802-M19-04-manual-input-list-developer-decision.md:113` の逐語＝「`unknown, 扱いが難しいのでunknownでいい。`」）。**`DES-003` §3.3 の「三値目」そのものであり埋めるべき穴ではない**／ **(ii) `M19-DESIGN-07` §4-1 の Phase 2 母数（308 行・基準 2026-08-04）に載る未確定**／ **(iii) 第四波で後から入り母数の外にある 36 行**（`elena 10 / blanka 8 / chun_li 7 / alex 4 / yasmine 4 / dee_jay 2 / cammy 1`。第四波の seed は `000084`） |
| **★注意** | **`M19-DESIGN-07` §4-1 の「改名した 2 行は `startup_basis` を確定させていない」は `sonic_break` と `perfect_timing_sonic_cross_od` を指しており、どちらも `standalone` である**（DB 実測）**。⇒ `sonic_break_od` はそこに含まれない** |
| **割付の候補** | **フェーズ5 か、`startup_basis` を次に触るサブ**（**★切り分けが要るなら独立サブ**。本サブでは直していない＝`D-161`） |

---

## 5. 参考（触れていない＝不変の証跡）

- `git diff --stat 25c9285` ＝ `docs/progress/` の 3 ファイルのみ・**+893 / −0**（deletions ゼロ＝教訓 `E-225`）
- 是正済みの 4 点: `character_data/guile.csv:62-64` ／ `migrations/000026_...up.sql:248-251,370-373` ／ 使い捨て DB の `SELECT`（v105・旧 code 0 行）／ `internal/infra/migration/migrate_m1904c_test.go` の `m1904cFrames`
- **★`migrate_m1904c_test.go` の比較区間は `m1904cTerminus = 63` で閉じており、固定するのは v63 時点の状態**（HEAD を守るのは golden 2 本と `csv_db_sync_test.go`）
- 内部整合の破れ（`total ≠ startup+active-1+recovery`）は **3026 行中 0 件**
- `move_commands` に guile の当該 3 行は非搭載（**0 行**。`is_derived=1` ＋ `cond{` ＝`DES-003` §3.14）
- `docs/design/` の名指し: 3 code とも **0 件**（`04-notation-spec.md:131` の `sonic_break_od` のみ＝是正後の正しい code）
- `web/`（src・e2e とも）と `scripts/` の名指し: **3 code とも 0 件**
- `go test ./...` 緑 ／ `cd web && pnpm test` **2440 passed** ／ `make e2e` **247 passed**
- 常設検査: `check-artifact-integrity.sh`（1 本目）／ `check-migration-license.sh` ／ `check-progress-log-index.sh` ／ `check-stop-discipline.sh` ／ `check-doc-refs.sh` ／ `check-enum-sync.sh` ／ `check-import-order.sh` ／ `check-browser-storage-keys.sh` すべて緑
- **★`make e2e` はリポジトリルートで実行すること**——`web/` で実行すると `Nothing to be done for 'e2e'.` が返り、1 本も走らないのに赤も出ない（本サブで一度踏んだ）

---

## 6. CHANGE 起票のたたき台（設計担当向け）

> **番号は起票時に `change-number-registry` §1 で採番。★製造は消費していない。**

| # | 宛先 | 内容 |
|---|---|---|
| **1** | **`SUPP-001` §5.5** | **(10) として「golden の破壊確認は射程の全区分から 1 件ずつ取る」を追記**（§1-1）。**`seedgen` の引数なし `-check` は `FirstWaveOrder` の 9 キャラ＝`000026` 系しか再生成せず、第一波外は壊しても緑が返る。恒久のガードは `go test ./...` の `TestGolden_*MatchesRegeneration` 群である**旨 |
| **2** | **`DES-005` §5.20 または `DES-002` §4.2** | **確定反撃サーチの飛び道具除外が「相手技側のみ」である旨の明文化**（§1-2）。**★ただし (a) as-built を正とするか (b) 始動技側にも除外を入れるかは設計判断であり、先に裁定が要る** |

**★マイグレ連番**: **本サブは 0 本消費。`000106` は未消費のまま返す。**（`migrations/` の実測末尾は `000105`。恒久の欠番は `000012` の 1 件のみ。**★次サブ＝§4-1 の terry で `000106` を払い出すことになる見込み**）

**★本サブ由来の CHANGE は 0 本**（`docs/design/` に 3 code の名指しが 0 件のため）。上記 2 件は**本サブの実査で判明した設計書の不足**であり、`M28-04` の射程内の是正に伴うものではない。

---

## 7. 教訓（retrospective-log 行き）

> **★親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映で、実施者は設計担当（反映担当は 2026-08-11 に廃止）。

1. **★★裁定を書くことと、裁定が指す行を直すことは別の手番である。** `D-201` は「解消済み」と裁定し、**未決と読まれる記述が 3 か所に残っていることまで名指ししていた**。それでも 3 か所は 1 か月直らず、再起票された。**⇒ 「◯◯に古い記述が残っている」と書いた裁定には、それを直す割付を同じ手番で付けること。名指しは是正ではない。**
2. **★★是正を実行したサブが、一次源となった board / backlog 行を閉じる手番が無い。** `M19-04c` は完了報告に是正を全数記録したが、`P-17` / `P-19` へ「済んだ」と書き戻す手番がどこにも無かった。**⇒ 仕分けの側からは「1 か月放置された生きた課題」に見えた。**`M-117`（チェックリスト起票の落ち）と同型＝**手番と手番の間で情報が落ちる。**
3. **★★陽性対照を張る対象が偏ると、守られていない区分を守っていることにできる。** 本サブの初版は破壊確認 2 件をどちらも `guile.csv` に対して実施し、**射程 9 行のうち 1 行も §2.6 の 6 行を試していなかった**。第一波外の manon は `-check` で緑が返る（§1-1）。**⇒ 「機構が生きている」を実測で示すときは、射程の全区分から 1 件ずつ取る。**
4. **★★「常設検査は緑だった」と書くときは、いつ測ったかを併せて書く。** 成果物そのものが検査の母数に入る種類の検査（`check-md-emphasis` / `check-progress-log-index` / `check-doc-inventory`）では、**書く前に測った値は完了時の値ではない。** 本サブは初版でこれを踏み、レビュー 高-4 で是正した。
5. **★「どこにも記録されていない」と書く前に、`archive/` を検索する。** `D-742` / `D-753` / 指示書 §2.6-1 / チェックリスト §0.4-7 の 4 か所が揃って「6 行の値はどこにも記録されていない」と書いていたが、**`docs/process/archive/parallel-board-rulings-M20.md` の `D-158` に全数あった。⇒ アーカイブへ移した裁定は「無くなった」ではない。**
6. **★指示書が「母数を出す」を最初の成果物に置いていたことが、そのまま効いた。** 母数を出さずに実装へ入っていれば、`000063` と同じ是正をもう 1 本書いて `000106` を空振りさせていた——**`NOT EXISTS` ガードも `AND startup_basis = 'unknown'` も無い素の `UPDATE` は 0 行に当たって成功し、エラーにならない**（`SUPP-001` §5.5 (6)）。**⇒ データ系サブの「母数を最初に出す」は形式ではなく機能している。**

---

*以上、M28-04 設計伝達レポート。* **★★本サブの例外は「実装が設計に反した」型ではなく、「指示書が指す仕事が既に済んでいた」型である。** **★親が裁定すべきは §2-1 の 4 点（指示書・overview・followup 2 行・board 2 行の更新）と、§1-2 の (a)/(b) である。** **★★時間の制約があるのは §4-1（terry `quick_burn_light`）だけであり、`M28` が破壊的変更の窓であるうちに起票が要る。**
