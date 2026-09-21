# M28-04 完了報告: `move_code` / `command` / `startup_basis` の是正（guile 3 件 ＋ 同乗 6 行）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M28-04-move-code-and-command-corrections.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M28-04-review-checklist.md` **v1.0.0** |
| 着手基点 | `25c9285` |
| 実施日 | 2026-09-06 |
| **結論** | **★★射程 9 行はすべて `M19-04c`（マイグレ `000063`・2026-08-03）で既に是正済みだった。⇒ コード・CSV・マイグレの変更ゼロ。マイグレ 0 本・CHANGE 0 本。`000106` は未消費のまま返す** |

---

## 0. 変更統計（`git diff --stat 25c9285`）

```
（差分なし）
```

**★コード・CSV・マイグレへの差分は 1 行も無い。** 追加するのは本報告書と、Phase B のレビュー報告書 `docs/progress/m28-04-review.md`、および `docs/progress/progress-log.md` への索引行だけである（**★レビュー報告書と索引行は本報告書の初版時点では存在しない**＝`D-510`。§9 を参照）。

**★新規ファイルは作成前に `ls` で同名の不在を確認した**（教訓 `E-225`）。`docs/progress/M28-04-completion-report.md` / `m28-04-review.md` はいずれも不在だった。**deletions は 0 である**（そもそも変更が無い）。

### コミット

| # | 内容 |
|---|---|
| 1 | 本報告書（実査結果）＋ `progress-log.md` 索引行 |
| 2 | Phase B のレビュー報告書 ＋ Phase C のトリアージ追記 |

**★指示書 §2.6-5 が求める「コミットを guile 3 件と分ける」は、是正コミットが 1 本も発生しないため対象が存在しない。**

---

## 1. 母数（指示書 §2.1・チェックリスト 束 A）

### 1.1 ★★3 件それぞれの現物の値 — CSV と DB の両方

#### (1) `sonic_break_light`（指示書 §2.2-1）

| 面 | 現物 |
|---|---|
| **CSV** | **存在しない。**`grep -c sonic_break_light character_data/guile.csv` = **0**。現在の姿は `character_data/guile.csv:64`:<br>`guile,sonic_break,special,ソニックブレイク,11,26,0,36,,-2,600,false,true,true,,,,,,,standalone,,false,` |
| **DB** | **存在しない**（下記 SELECT C が 0 行）。`sonic_break` として `11/26/0/36`・`startup_basis=standalone`・`is_projectile=1`・`is_derived=1` |
| **golden** | `migrations/000026_seed_moves_first_wave.up.sql:250` = `UNION ALL SELECT 'sonic_break', 'special', 600, 11, 26, 36, NULL, -2, 0, 0, NULL` |

#### (2) `sonic_cross_2_meter_od` / `sonic_cross_3_meter_od` の `command`（指示書 §2.2-2）

**★改名の連鎖が入っているため、指示書が書く 2 つの code は現在それぞれ別の技を指す／存在しない。**

| 面 | 現物 |
|---|---|
| **CSV** | `guile.csv:62` `perfect_timing_sonic_cross_od`（【ジャスト】ODソニッククロス１）command = `r plus p or cond{（ソニックブレイド中に）} r plus p p`<br>`guile.csv:63` `sonic_cross_2_meter_od`（ODソニッククロス２）command = `r plus p p or cond{（ODソニックブレイド中に）} r plus p p`<br>`sonic_cross_3_meter_od` は**存在しない** |
| **DB** | `moves` に `command` 列は無い（`DES-004` §2.4 の index-only 方針）。`move_commands` にも当該 3 行は**非搭載**（下記 SELECT E が 0 行） |

**★是正後の正しい値の一次源は `M19-04c` 指示書 §1.1 の B 表である**（開発者から現行と是正後の CSV 行を受領・2026-08-02）。現行 CSV の 3 行はその値と**完全一致**する:

| B 表 | 是正後の command（M19-04c 指示書） | 現行 CSV |
|---|---|---|
| B-1 `sonic_cross_od` | `r plus p or cond{（ソニックブレイド中に）} r plus p p` | `:61` **一致** |
| B-2 → `perfect_timing_sonic_cross_od` | B-1 と同じ | `:62` **一致** |
| B-3 → `sonic_cross_2_meter_od` | `r plus p p or cond{（ODソニックブレイド中に）} r plus p p` | `:63` **一致** |

#### (3) `sonic_cross_3_meter_od` の `startup` 系（指示書 §2.2-3）

| 面 | 現物 |
|---|---|
| **CSV** | `guile.csv:63`（改名後の `sonic_cross_2_meter_od`）= `15/46/11/71`、`startup_basis=through` |
| **DB** | 同上（下記 SELECT B） |
| **golden** | `000026_...up.sql:249` = `'sonic_cross_2_meter_od', 'special', 1700, 15, 46, 71, NULL, NULL, 11, 0, NULL` |

### 1.2 ★★DB の実測（指示書 §2.1-1 の「DB 側」）

使い捨て DB（`scratch-m28-04-verify.db`。`*.db` は `.gitignore` 済み）を HEAD のマイグレ全適用まで上げて `SELECT` した。**★DB ファイルは削除していない**（`CLAUDE.md` §10）。

> **★再現の手順**: `sqlite3` CLI は本環境に無いため、`migration.Run(ctx, dbPath, tacpendium.MigrationsFS)` を呼んで `internal/infra/db.Open` で引く小さな `package main` を書いて実行した。**★リポジトリを汚さないよう `.gitignore` 済みの `tmp/` 配下に置き、実行後は scratchpad へ退避してリポジトリから外した**（`CLAUDE.md` §10.Y。**作業用に作ったファイルの置き場と寿命を先に決める**）。**⇒ 恒久ファイルは 1 つも増やしていない。**

```
===== A. schema_migrations =====
version | dirty
105 | 0

===== B. guile の sonic 系 全行 =====
code | name_ja | startup | active | recovery | total | startup_basis | is_projectile | is_derived | chain_cancel_total | fastest_unreachable
sonic_boom_light | 弱ソニックブーム | 10 | 31 | 0 | 40 | standalone | 1 | 0 | NULL | 0
sonic_boom_medium | 中ソニックブーム | 10 | 31 | 0 | 40 | standalone | 1 | 0 | NULL | 0
sonic_boom_heavy | 強ソニックブーム | 10 | 31 | 0 | 40 | standalone | 1 | 0 | NULL | 0
sonic_boom_od | ODソニックブーム | 10 | 29 | 0 | 38 | standalone | 1 | 0 | NULL | 0
sonic_blade_light | 弱ソニックブレイド | 16 | 27 | 0 | 42 | standalone | 1 | 0 | NULL | 0
sonic_blade_medium | 中ソニックブレイド | 21 | 30 | 0 | 50 | standalone | 1 | 0 | NULL | 0
sonic_blade_heavy | 強ソニックブレイド | 31 | 24 | 0 | 54 | standalone | 1 | 0 | NULL | 0
sonic_blade_od | ODソニックブレイド | 15 | 25 | 0 | 39 | standalone | 1 | 0 | NULL | 0
sonic_cross_light | 弱ソニッククロス | 10 | 29 | 0 | 38 | standalone | 1 | 1 | NULL | 0
sonic_cross_medium | 中ソニッククロス | 10 | 29 | 0 | 38 | standalone | 1 | 1 | NULL | 0
sonic_cross_heavy | 強ソニッククロス | 10 | 29 | 0 | 38 | standalone | 1 | 1 | NULL | 0
sonic_cross_od | ODソニッククロス１ | 10 | 29 | 0 | 38 | standalone | 1 | 1 | NULL | 0
sonic_cross_2_meter_od | ODソニッククロス２ | 15 | 46 | 11 | 71 | through | 1 | 1 | NULL | 0
sonic_break | ソニックブレイク | 11 | 26 | 0 | 36 | standalone | 1 | 1 | NULL | 0
sonic_break_od | ODソニックブレイク | 11 | 25 | 0 | 35 | unknown | 1 | 1 | NULL | 0
(15 rows)

===== C. 旧 code の残存 (期待: 0 rows) =====
(0 rows)      ← sonic_break_light / sonic_cross_3_meter_od とも DB に存在しない

===== D. §2.6 の 6 行 =====
ch | code | name_ja | startup | active | recovery | total | category | is_derived | is_aerial | is_projectile | setup_only | startup_basis
kimberly | bushin_prism_strikes | 武神天架拳 | 26 | 3 | 19 | 47 | target_combo | 1 | 0 | 0 | 0 | standalone
lily | condor_dive_follow_up | コンドルダイブ(派生) | 12 | 12 | 24 | 47 | special | 1 | 0 | 0 | 0 | standalone
lily | windclad_od_condor_dive_follow_up | ODコンドルダイブ(派生) | 12 | 10 | 24 | 45 | special | 1 | 0 | 0 | 0 | standalone
mai | flame_midare_kachousen | [焔版]乱れ花蝶扇 | 28 | 30 | 39 | 96 | special | 1 | 0 | 1 | 0 | standalone
mai | midare_kachousen | 乱れ花蝶扇 | 28 | 30 | 39 | 96 | special | 1 | 0 | 1 | 0 | standalone
manon | temps_lie | タン・リエ | 5 | 5 | 17 | 26 | target_combo | 1 | 0 | 0 | 0 | standalone
(6 rows)

===== E. move_commands: guile の当該 3 行が索引に載っているか (期待: 0 rows) =====
(0 rows)

===== F. 内部整合の破れ total != startup+active-1+recovery (期待: 0 rows) =====
(0 rows)

(moves 総行数: 3026)
```

**★D の 6 行は、`D-158`（`docs/process/archive/parallel-board-rulings-M20.md:160`）が記録する「正しい値」と全数一致する。**

### 1.3 ★★3 つの code のリポジトリ全体の走査（チェックリスト 束 A-2）

再現コマンド: `grep -rn "<code>" <dir> | wc -l`

| 対象 | `sonic_break_light` | `sonic_cross_2_meter_od` | `sonic_cross_3_meter_od` | 計 |
|---|---|---|---|---|
| `character_data/` | 2 | 3 | 1 | 6 |
| `migrations/` | 5 | 25 | 9 | 39 |
| `internal/` | 1 | 5 | 1 | 7 |
| **`web/`（src・e2e とも）** | **0** | **0** | **0** | **0** |
| **`scripts/`** | **0** | **0** | **0** | **0** |
| **`docs/design/`** | **0** | **0** | **0** | **0** |
| `docs/`（`docs/design/` を含む総数） | 47 | 91 | 46 | 184 |
| ルート直下 | 0 | 0 | 0 | 0 |
| **合計** | **55** | **124** | **57** | **236**（`docs/` を 1 回だけ数えると **182**） |

> **★本表は着手基点 `25c9285` 時点の値である。**本報告書とレビュー報告書が `docs/` に加わると `docs/` の数はそのぶん増える（**★成果物そのものが母数へ入る**）。**⇒ 後任が再現するときは基点を揃えること。**

**残存の性格**:

- **`character_data/`** — 実データ行は `guile.csv:63`（新 code）**1 件のみ**。残りは `command-correction-history.md` の改名履歴（歴史記録）
- **`migrations/` / `internal/`** — **「改名を実行する文」と「改名されたことを検証する文」自身**であり、原理的に除去できない（`m19-04c-completion-report.md` §11 が同じ結論を実測済み）
- **`web/` は 0 件** — 指示書 §2.3-3 が警戒する `migration-version-literals-in-tests` 型（名指しが静かに壊れる）の危険は**存在しない**。E2E spec も 3 code を名指ししていない
- **`docs/`（design 以外）は歴史記録**として据え置いた（指示書 §2.3-4・先例 `P-07`）。**1 行も直していない**

### 1.4 ★guile 以外の同型の軽走査（指示書 §2.1-3・**報告のみ。直していない**＝`D-161`）

機械的に拾える 3 型に限って走査した。**スクリプトは新設していない**（`CLAUDE.md` §10.Y）。

#### 型 1: `_light` の孤児（`sonic_break_light` と同型）

`_light` で終わる code のうち、同一キャラに `_medium` / `_heavy` の対を**どちらも持たない**もの。全 32 CSV・`_light` 総数 161 件に対し **2 件**:

| キャラ | code | `name_ja` | `command` | 所見 |
|---|---|---|---|---|
| **terry** | **`quick_burn_light`** | **「クイックバーン」** | `d dl l plus p_l` | **★★`sonic_break_light` と同型の強い候補。**`_light` / `_od` の対だけを持ち `_medium` / `_heavy` が無い。**`name_ja` に強度の語（弱／中／強）が付いていない**——これは `sonic_break`（「ソニックブレイク」）と同じ形である。対の `quick_burn_od`（「ODクイックバーン」）も強度語を持たない |
| ingrid | `sun_flare_light` | 「**弱**サンフレア」 | `d dl l plus p_l` | **★誤りとは言えない。**`name_ja` に強度語「弱」が付いており、同系に `sun_flare_lv1`〜`lv3`（`p_m` / `p_h` 使用）と `_lv1_od`〜`_lv3_od` がある。**強度の区別は存在し、中／強に当たるものが `_lv*` という別の軸で表現されている**とも読める |

> **★★本走査は誤り検出ではない。** `D-161` が確定した方針は「手入力データの全点検は行わない／誤りは利用者からの報告で受ける」であり、上記 2 件も **`name_ja` の形から立てた仮説にすぎない**。**インゲームで強度の区別が実在するかは実機でしか確かめられない。** ⇒ **本サブでは直していない。開発者・設計卓へ報告するだけである。**

#### 型 2: `startup_basis` の取り残し（`is_derived=1` かつ `unknown`）

DB 実測で **15 キャラ・計 51 行**:

```
elena 10 / blanka 8 / chun_li 7 / alex 4 / m_bison 4 / yasmine 4 / ken 3 / marisa 3 /
dee_jay 2 / cammy 1 / guile 1 / ingrid 1 / jamie 1 / lily 1 / rashid 1
```

> **★★【Phase C 是正・レビュー指摘 高-1】初版は「48 行」と書き、guile の 1 件を「`M19-DESIGN-07` §4-1 が記録する既知の残タスク」と帰属させていた。3 点とも誤りだったので差し替える。**

**(i) 件数は 51 行である**（上の内訳の合計＝`10+8+7+4+4+4+3+3+2+1+1+1+1+1+1`）。**初版の「48」は単純な足し算の誤りであり、内訳の側が正しい。**

**(ii) guile の 1 件 `sonic_break_od` は「取り残し」ではなく、開発者が `unknown` と確定させた行である**（`guile.csv:65`）。一次源は `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md:113` の逐語:

```
| guile | `sonic_break_od` | ODソニックブレイク | special | 1 | 0 | `p` | 11 | 35 |  |  | unknown, 扱いが難しいのでunknownでいい。 |
```

**⇒ `DES-003` §3.3 が言う「`unknown` は『まだ判らない』を明示的に保持する三値目」そのものであり、埋めるべき穴ではない。**

**(iii) `M19-DESIGN-07` §4-1 の当該記述は別の行を指している**——「改名した 2 行」とは `sonic_break_light`→`sonic_break` と 旧 `sonic_cross_2_meter_od`→`perfect_timing_sonic_cross_od` であり、**どちらも `startup_basis` は `standalone` である**（§1.2 の SELECT B）。**`sonic_break_od` はそこに含まれない。⇒ 初版の典拠は当たっていなかった。**

**(iv) 51 行のうち 36 行は第四波キャラである**〔`elena 10 / blanka 8 / chun_li 7 / alex 4 / yasmine 4 / dee_jay 2 / cammy 1`。第四波の名簿は `migrations/000082_seed_characters_fourth_wave.up.sql` の 12 キャラ＝`aki / akuma / alex / blanka / cammy / chun_li / dee_jay / e_honda / ed / elena / sagat / yasmine`。うち `aki` / `akuma` / `e_honda` / `ed` / `sagat` は 0 行〕。**第四波の seed は `000084`**（`M14-03f`）**であり、`M19-DESIGN-07` §4-1 の Phase 2 母数**〔308 行・基準 2026-08-04〕**はこれらを含みようがない。⇒ 51 行を一括して「§4-1 の既知の残」と呼ぶことはできない**。

> **★レビュー報告は同じ趣旨の行を 37 と数えている**〔`m28-04-review.md:95`〕**。⇒ 本報告は上の内訳から自分で数えた 36 を採る。差の 1 は数え方の違い**〔第四波以外のどの行を「母数の外」に含めるか〕**であり、どちらも「51 行を一括して §4-1 の既知の残とは呼べない」という結論は変えない。★どちらが正しいかは母数 308 行の対象キャラを確定させないと決まらない。⇒ 確定させていない**。

**⇒ 本項の正しい要約は「`is_derived=1` かつ `startup_basis='unknown'` が 51 行あり、その性格は一様ではない」である**（開発者が確定させた `unknown` ／ `M19-DESIGN-07` の Phase 2 母数に載る未確定 ／ 第四波で後から入り母数の外にある行 が混在する）**。⇒ 本サブでは直さず、性格の切り分けを含めて報告する**（§7-5）**。**

#### 型 3: 内部整合の破れ

`total ≠ startup + active - 1 + recovery` の行は **3026 行中 0 件**。

> **★これは「誤りが無いこと」の証明ではない。** `D-161` が実証したとおり、**`P-19` の 6 行は是正前もこの検算を通っていた**（値の組が内部整合していたため）。**⇒ 内部整合では手入力の誤りを検出できない。** 本項は「機械で拾える破れが無い」ことの確認にすぎない。

### 1.5 ★★§2.6 の 6 行について（指示書 §5-6・チェックリスト 束 A-4）

**値は届かなかったが、保留にもしていない。⇒ 既に是正済みだったためである。**

| 出所 | 内容 |
|---|---|
| **値の一次源** | **`D-158`**（`docs/process/archive/parallel-board-rulings-M20.md:160`。2026-08-02 の開発者申告） |
| **適用** | **`migrations/000063_correct_moves_data_m1904c.up.sql` の節 C-1〜C-6**（2026-08-03） |
| **現状** | CSV / golden / DB / 回帰テストの 4 点すべてで是正後の値（§1.2 の SELECT D） |

**★製造は 1 つも値を推測していない**（チェックリスト §0.4-7 / §7-6）。**そもそも値を書いていない。**

---

## 2. 判定 — 射程 9 行はすべて `M19-04c`（`000063`）で是正済み

### 2.1 指示書の射程と `000063` の対応

| 指示書 | `000063` の対応節 | 内容 |
|---|---|---|
| §2.2-1 `sonic_break_light` | **節 A** | `UPDATE moves SET code = 'sonic_break' ... AND code = 'sonic_break_light'`（`NOT EXISTS` ガード付き） |
| §2.2-2 `command` の入れ替わり | **`000063` の対象外 ＋ CSV 正本修正** | 同マイグレのヘッダが逐語で「**`command` は本マイグレの対象外。`moves` に `command` 列は無く、`move_commands` は非派生技のみ搭載である。是正した guile 3 行はすべて `is_derived=1` のため索引に元から非搭載であり、`command` の是正は `character_data/guile.csv` の正本修正で完結する**」。是正後の値は `M19-04c` 指示書 §1.1 B 表 |
| §2.2-3 `startup` 系 | **節 B-3 ＋ B-3'** | B-3 がフレームを `10/29/0/38 → 15/46/11/71`、B-3' が `startup_basis` を `unknown → through` |
| §2.6 の 6 行 | **節 C-1〜C-6** | 指示書が挙げる 6 行と**完全に同一** |
| （附随） | **節 B-2 / A'・B'** | 改名の順序制約を解く前置改名（`sonic_cross_2_meter_od` → `perfect_timing_sonic_cross_od`）と `is_projectile` の取り残し救済 |

### 2.2 ★★§2.2-3 の (a) / (b) の答え — **両方だった**

指示書 §2.2-3 は「**(a) `startup_basis` が誤り**〔値は正しいが `standalone` と書かれている〕**／ (b) `startup` の数値が誤り**〔basis は正しいが単独時の値が入っている〕」の二択を提示し、§7-1 で開発者へ返すよう求めている。

**現物を見た結果、答えは「両方」である。**

| 根拠 | 内容 |
|---|---|
| **一次源 `D-142`（逐語）** | 「`sonic_cross_3_meter_od` は派生元が OD ソニックブレイドのみなので **`through` のフレームであるべきところに `standalone` のフレームが入っている**」——**「`standalone` の*フレーム*」であり、値と basis の両方を指している** |
| **`M19-04c` 指示書 §1.1 B-3** | `10/29/0/38 → 15/46/11/71` （**数値の是正**）＋「**B-3 の `startup_basis` は `through` とする**」（**basis の是正**） |
| **`000063` の実装** | 節 B-3（数値）と節 B-3'（basis）の **2 文に分かれている** |

**⇒ 指示書 §2.2-3 の二択そのものが、一次源に無い後年の読み直しで生じたものである。**「値は正しいが basis だけ誤り」も「basis は正しいが値だけ誤り」も、`D-142` の記述には対応しない。

**★製造は解釈で埋めていない**（チェックリスト §0.4-4 / §7-4）。**現物（`D-142` の逐語・`M19-04c` の B 表・`000063` の 2 文）を並べて判定した。**

### 2.3 ★★正しい code の導出（チェックリスト 束 B-1）

**`sonic_break` は `DES-004` §2.1 から導かれる。製造が語を作ってはいない。**

| # | 導出の段 |
|---|---|
| 1 | `DES-004` §2.1 の**変種行のサフィックス表**が `_od`（OD 版）の**実例として `sonic_break_od` を名指ししている**（`docs/design/04-notation-spec.md:131`） |
| 2 | 同表の形は `<base>_<変種>` である。⇒ `sonic_break_od` の base は **`sonic_break`** |
| 3 | §2.1 の必殺技パターンは `<技名>_<強度>` だが、これは**強度の区別が存在する技についての規則**である。`sonic_break_medium` / `sonic_break_heavy` は CSV にも DB にも存在しない（実査済み） |
| 4 | **`M19-04c` も同じ導出を書いている**（`000063` 節 A のコメント逐語＝「`sonic_break` / `sonic_break_od` の対は既存形に合流する(`DES-004` §2.1 の `_od` の例がまさに `sonic_break_od`)」） |
| 5 | **先例 56 件**（`M19-04c` 指示書 §0.3 の実査＝`kimberly/arc_step`＋`arc_step_od`、`juri/shiren_sen`＋`shiren_sen_od`、`ken/senka_snap_kick`＋`senka_snap_kick_od` 等） |

### 2.4 ★★`move_commands`（command 索引）への波及 — **無し**（チェックリスト 束 B-2）

| # | 実査 |
|---|---|
| 1 | **索引は `command` 生文字列を持たない。**`move_commands` の列は `(move_id, character_id, token_key)` のみ（`migrations/000033_create_move_commands.up.sql`）。`token_key` は `internal/moveindex` が正規化した numpad 形（例 `2MP` / `[4]6LP`） |
| 2 | **明示インデックスは `idx_move_commands_char_token (character_id, token_key)`**。実運用の引き方は `WHERE mc.character_id = ?` でキャラ 1 体分を丸ごと取り出し、アプリ側で畳む（`internal/repository/movecommand/repository.go`） |
| 3 | **搭載対象は非派生技（`is_derived = false`）のみ**（`DES-003` §3.14）。**guile の当該 3 行はすべて `is_derived = 1`** であり、うち 2 行は `cond{` を含む（同節の非搭載条件） |
| 4 | **DB 実測で 0 行**（§1.2 の SELECT E） |

**⇒ `command` を交換しても索引は張り替わらない。** `000063` のヘッダも同じ結論を逐語で書いており（「段階 2 の解決表・FE キャッシュ無効化契約(`CHANGE-069`/`070`)には波及しない」）、実測がそれを裏づけた。

### 2.5 ★★`moves.code` の一意制約の形（指示書 §6-3）

**`UNIQUE (character_id, code)`**（`migrations/000001_init_schema.up.sql` の `moves` テーブル末尾のテーブル制約）。以後のマイグレで変更されていない。

**⇒ 指示書 §2.4-2 が警戒する「`code` だけで絞ると他キャラを巻き添えにする」は正しい懸念である。**`000063` の全 `UPDATE` は `character_id IN (SELECT c.id FROM characters c WHERE c.code = 'guile' AND c.game_id IN (...)) AND code = ...` の形で絞っており、**規約を満たしている**。

### 2.6 ★★§2.5 の波及と、`D-158` の「未確認」への答え

#### (a) `startup` を読む経路（指示書 §2.5-1）

| 経路 | 場所 | `startup` の使われ方 |
|---|---|---|
| **`M18-02` 確定反撃判定** | `internal/service/punishfinder/service.go` の `buildStarters` | 地上レーン `*sm.Startup <= adv` ／ ダッシュ経由レーン `*sm.Startup <= slack` |
| **`M19` の `S` 計算** | `internal/service/setplay/setplay.go` の `Suggest` | `budgetMax := knockdownAdvantage + 2 - nLo - target.Startup` |

#### (b) ★★6 行は確定反撃サーチの候補に入るか（`D-158` が「未確認」と書いた点・指示書 §2.6-6）

> **★★【Phase C 是正・レビュー指摘 高-2】初版は「★入る。両側とも」と書いたが、相手技側は 6 行中 4 行であり、mai の 2 行は成立レーンに入らない。差し替える。**

**★始動技側は 6 行とも入る。相手技側は 4 行が成立レーン・2 行が手動確認レーンである。**

| 側 | 絞り込み条件（`internal/service/punishfinder/service.go`） | 6 行の該当 |
|---|---|---|
| **始動技側** | `buildStarters`: `damage > 0` かつ `grounded = !is_aerial`。地上レーンは `startup <= adv` | **★6 行とも `damage>0`・`is_aerial=0`。⇒ 候補に入る**（実際に載るかは相手技の有利フレーム次第） |
| **相手技側**（成立レーン） | `Scan` の pass 1: `isNonPunishableTarget`（`is_aerial` ／ 移動 system move）で完全除外 → `damage=0` で完全除外 → pruning 済みで除外 → **`om.Damage == nil` は手動確認へ** → **★★`om.IsProjectile` は手動確認へ**（`service.go:247-251`＝「c: 飛び道具は手動確認(距離依存)」） | **★kimberly / lily×2 / manon の 4 行は成立レーンに入る**（`is_projectile=0`）<br>**★★mai の 2 行は `is_projectile=1` のため `ManualReviewNodes`（理由 `distance_dependent`）へ回り、有利フレームの算出そのものに到達しない** |

**★★`punishfinder` には `is_derived` / `category` によるフィルタは無い**（走査 SQL `listMovesForScanSQL` は `is_derived` / `startup_basis` を投影すらしない）。**⇒ `D-158` の見込み「6 行はいずれも target_combo／派生技であり除外されている」は、`M19` 側（filler 規則 `category != target_combo`）には当てはまるが、`M18-02` 側には当てはまらない**——**除外しているのは `category` ではなく `is_projectile` であり、それが効くのは mai の 2 行だけである。**

**⇒ 6 行のフレーム是正は確定反撃サーチの出力を動かしうる**（始動技側は 6 行とも、相手技側は 4 行）**。** ただし**その是正は 2026-08-03 に済んでおり、当時のテストが同じ手番で更新されている**（`migrate_m1904c_test.go`）**。★本サブで新たに動いた出力は無い**（コード・データを 1 行も変えていないため）。

#### (c) golden と E2E の期待値（指示書 §2.5-2）

**動いていない。** 変更が無いため。既存の固定は下記 §2.7 のとおり。

### 2.7 ★★既存の回帰ガード 3 本が 3 面すべてを固定している

**チェックリスト §0.4-1 が最重要の危険とする「DB だけ直して CSV が戻る」は、既に機構で塞がれている。**

| ガード | 何を固定するか |
|---|---|
| `internal/infra/migration/migrate_m1904c_test.go` の `m1904cFrames` / `m1904cLegacyFrames` | **9 行の是正後の値と是正前の値を両方直書きで固定**。`startup_basis` の `through` と down 後の `unknown` も。`total = su+act-1+rec` の内部整合も検証。**★★ただし比較区間の終端は `m1904cTerminus = 63` であり、固定しているのは「v63 時点の状態」である**（下記の注記） |
| `internal/seedgen/generate_test.go` の `TestGolden_CommittedMigrationMatchesRegeneration` | **現行 CSV から再生成した SQL と `000026`（第一波）を byte 単位で比較**。⇒ **第一波 9 キャラの CSV が戻れば golden が落ちる。★9 行のうち 8 行**〔guile 3 ＋ kimberly 1 ＋ lily 2 ＋ mai 2〕**がここに載る** |
| `internal/seedgen/generate_m1403d_test.go` の `TestGolden_ManonMovesMatchesRegeneration` | **同じ比較を `000045`（manon）に対して行う。★★残り 1 行**〔manon `temps_lie`〕**を守るのはこちらである** |
| `internal/infra/migration/csv_db_sync_test.go` の `TestCSVAndDBAgreeOnFrameCostColumns` | `startup_basis` / `chain_cancel_total` / `fastest_unreachable`（**`seedgen` が SQL へ出力しない 3 列**）の CSV↔DB 突合。⇒ `guile.csv:63` の `through` が DB と一致していることを固定 |

> **★★【Phase C 是正・レビュー指摘 高-3 / 中】初版は golden ガードを `TestGolden_CommittedMigrationMatchesRegeneration` 1 本だけ挙げ、`migrate_m1904c_test.go` を「HEAD を固定するもの」と書いていた。2 点とも正確でないので改めた。**
>
> **(i) 第一波は 9 キャラ**〔`terry, guile, lily, ingrid, kimberly, juri, ken, mai, zangief`＝`internal/seedgen/generate.go` の `FirstWaveOrder`〕**であり、manon は含まれない。⇒ §2.6 の 6 行のうち manon `temps_lie` だけは `000026` の golden では守られない。** 守っているのは `000045` 側の `TestGolden_ManonMovesMatchesRegeneration` である。**★初版の破壊確認は 2 件とも `guile.csv` に対するものであり、§2.6 の 6 行を 1 行も実際には試していなかった**（§4.2 で 2 件足した）。
>
> **(ii) `migrate_m1904c_test.go` の比較区間は `m1904cTerminus = 63` で閉じている。⇒ 同テストが固定するのは「`000063` を当てた直後の状態」であって HEAD ではない。** HEAD の値を守っているのは golden 2 本と `csv_db_sync_test.go` の側である。**★区別しないと「HEAD に回帰テストがある」と読めてしまう。**

### 2.8 ★golden は動いたか（指示書 §3-4・チェックリスト 束 E-2）

**動いていない。1 バイトも上書きしていない。** `seedgen -check` を無改変の CSV に対して走らせ、**「OK: 生成物は既存ファイルと一致」**（exit 0）を実測した（§4.2 の陰性対照）。

---

## 3. 指示書 v1.1.0 の前提のうち失効しているもの（★設計卓への請求）

**★製造は `docs/instructions/` を編集していない**（開発者判断 2026-09-06）。以下は**請求である。**

| # | 指示書／ボードの記述 | 実査結果 |
|---|---|---|
| **★★1** | **指示書 §2.2 / §2.6 の射程 9 行**（＝`followup` の `guile-move-code-and-command-errors` ／ `startup-total-errors-six-rows`） | **すべて `000063`（`M19-04c`・2026-08-03）で是正済み。⇒ 直す対象が存在しない** |
| **★★2** | **指示書 §2.6-1 / `D-742` / `D-753` / チェックリスト §0.4-7**:「**どの行のどの列がいくつ誤っているかは、どこにも記録されていない**」 | **誤り。`D-158`（`docs/process/archive/parallel-board-rulings-M20.md:160`）に 6 行の正しい値が全数逐語で記録されている**〔例:「(1) kimberly `bushin_prism_strikes`(現行 startup 52 → 正は startup 26 / active 3 / recovery 19 / **total 47**)」〕**。⇒ 「唯一の記録は記入用コピーの備考欄」は、`D-158` へ全数転記された時点で失効していた** |
| **★★3** | **指示書 §2.2-3 の二択**（(a) basis のみ／(b) 数値のみ） | **一次源 `D-142` は両方を指す。⇒ 二択そのものが後年の読み直しで生じた**（§2.2） |
| **★★4** | **指示書ヘッダ「マイグレ消費 1 本（`000106`）」／`M28-overview` §4 のマイグレ消費表** | **0 本。`000106` は未消費のまま返す。⇒ ボード §2.2 の「次に払い出す番号」は動かない** |
| **★5** | 指示書ヘッダ「CHANGE 消費 0〜1 本」 | **0 本**（§6） |
| **★6** | **`followup-backlog.md` §BK の 2 行**（状態欄が `startup-total-errors-six-rows` は「未着手」、`guile-move-code-and-command-errors` は「行き先が決まった」のまま） | **どちらも `M19-04c` で解決済み。⇒ クローズを請求する**（`D-382` により製造は §J 以外を編集しない） |
| **★7** | **`parallel-board.md` の `P-17` / `P-19`** | **同上。クローズを請求する** |
| **★★7-b** | **`D-201`（`docs/process/archive/parallel-board-rulings-M20.md:117`）が名指しした 3 か所のうち、`docs/handover/` の引き継ぎ資料 §4** | **★★`D-201` は 2026-08-07 に「起票が要るという記述が `D-158` / 保留 `P-19` / 引き継ぎ資料 §4 の 3 か所に残っており、未決と読まれる」と書いていた。⇒ 3 か所とも 1 か月後まで直らず、本サブの再起票につながった。★引き継ぎ資料 §4 は本報告の §3-6 / §3-7 でも拾えていない第 3 の箇所である** |
| **★8** | **チェックリスト v1.0.0 §6 の破壊確認 2 件・§7 の重大判定基準 1〜8** | **是正が発生しないため対象が存在しない**（代替を §4.2 に置いた） |

### 3.1 ★★なぜ 1 か月後に再起票されたか（根本原因）

| # | 経緯 |
|---|---|
| 1 | 2026-08-02、人手判断リストの備考欄から `D-142`（guile 3 件）と `D-158`（6 行）が起票され、board に `P-17` / `P-19` が立った |
| 2 | **`P-17` 行には「`D-162` の `M19-04c` として `P-19` と一緒に是正する（承認待ち）」と書かれていた** |
| 3 | 2026-08-03、**`M19-04c` がそのとおり実施され `000063` で 10 行を是正した**（guile 3 ＋ フレーム 6 ＋ `is_projectile` 追随） |
| 4 | **2026-08-07、ボードが `D-201` で「`M19-04c`（`000063`）で `P-19` の 6 行は解消済み」と明示的に裁定した。**同裁定は**「起票が要る」という記述が `D-158` ／ 保留 `P-19` ／ 引き継ぎ資料 §4 の 3 か所に残っており、未決と読まれる**とまで書いている（`docs/process/archive/parallel-board-rulings-M20.md:117`） |
| 5 | **2026-09-05 の保留仕分け（`D-723`）で、`P-17` 行の一文も `D-201` の裁定も追跡されなかった。**`P-17` / `P-19` は「生存」と判定され `followup` §BK へ移送された |
| 6 | `D-725` → `D-733`（`M28-04` 起票）→ `D-742` → `D-753`（6 行の同乗確定）を経て、**指示書 v1.1.0 とチェックリスト v1.0.0 が発行された。どちらにも `000063` / `M19-04c` / `D-201` への言及は 0 件である** |

> **★★横断課題＝是正を実行したサブが、一次源となった board / backlog 行を閉じる手順が無い。** `M19-04c` は完了報告で是正を全数記録したが、**`P-17` / `P-19` の行に「済んだ」と書き戻す手番がどこにも無かった。** ⇒ **仕分けの側からは「1 か月放置された生きた課題」に見え、実際は「1 か月前に済んでいた課題」だった。**
>
> **★★`D-201` が事態を一段重くしている**——**ボードは 2026-08-07 に「解消済み」と裁定しただけでなく、「未決と読まれる記述が 3 か所に残っている」と場所まで名指ししていた。⇒ 気づく機会は在り、記録も在った。それでも 1 か月後に再起票された。**
>
> **★裁定を書くことと、裁定が指す行を直すことは別の手番である。**`D-201` は前者だけで終わり、後者が誰の手番にもならなかった。**⇒ 「◯◯に古い記述が残っている」と書いた裁定には、それを直す割付が要る。**
>
> **★これは `M-117`（チェックリスト起票の落ち）と同型である**——**手番と手番の間で情報が落ちる。**

---

## 4. 検証の実測

### 4.1 常設検査

> **★★【Phase C 是正・レビュー指摘 高-4】初版は見出しを「着手前・完了後とも同一」とし、その値を最終結果のように書いていた。★実際には測定時点が Phase A の途中**（完了報告を書く前・`progress-log.md` へ追記する前）**であり、その後に本報告書自身が `check-md-emphasis` の母数へ入り、完了報告の存在が `check-progress-log-index` を赤にした。⇒ 下表は Phase D 完了後に測り直した値である。**

| 検査 | 結果 |
|---|---|
| **`scripts/check-artifact-integrity.sh`**（★1 本目） | **緑**（検査 14 件の自己検査 ＋ 生成物 4 件すべて OK。「結果: 違反なし」） |
| `scripts/check-migration-license.sh` | **緑**（「結果: 違反なし」）。**★`M26-02` が 2026-09-06 に入れた新検査**（`CHANGE-158`）。**本サブはマイグレを作らないため、層 B の命名規約〔`NNNNNN_data_*.sql`〕の適用先にはならなかった** |
| `scripts/check-stop-discipline.sh` | **緑** |
| `scripts/check-doc-refs.sh` | **緑**（dead reference なし） |
| `scripts/check-enum-sync.sh` | **緑**（ベースラインどおり） |
| `scripts/check-import-order.sh` | **緑**（ベースラインどおり） |
| `scripts/check-browser-storage-keys.sh` | **緑** |
| `scripts/check-progress-log-index.sh` | **緑**（Phase D の索引行を追記した後に測定。**★追記前は「作業 ID `m28-04` が現れない」で赤だった**——完了報告だけを先にコミットすれば必ずそうなる。**⇒ 初版が「緑」と書けたのは、完了報告をまだ書いていない時点で測ったからである**） |
| **`scripts/check-md-emphasis.sh`** | **★赤（違反 1 件）**——下記 §4.4。**★本報告書自身も違反行を出していたため、Phase C で自分の行は直した** |

### 4.2 ★★破壊確認（チェックリスト §6 の代替）

**チェックリスト §6 の 2 件はいずれも「是正を入れたこと」を前提にしており、本サブでは対象が存在しない。**

| チェックリスト | 本サブでの扱い |
|---|---|
| §6-1「CSV を直さずに DB だけ直した状態を作り、seed を再生成する」 | **是正が発生しないためその状態を作れない。⇒ 下記の代替を実走した** |
| §6-2「マイグレのファイル名から `data_` を外す」 | **マイグレを作らないため対象が存在しない**（`check-migration-license.sh` が緑であることのみ確認） |

**代替＝「CSV が戻れば golden が落ちる」機構が生きていることの陽性対照。**
`character_data/` を scratchpad へ複製し、複製側だけを壊して `seedgen -check`（**書き込まないモード**）を走らせた。**リポジトリ内のファイルは 1 行も触っていない。**

| # | 操作 | 結果 |
|---|---|---|
| **陰性対照** | 無改変の複製で `go run ./cmd/seedgen -data <複製> -migrations migrations -check` | **`OK: 生成物は既存ファイルと一致` / exit 0**（投入 moves 合計 = 752 / 索引キャラ数 = 9） |
| **破壊 A** | 複製の `guile.csv:63` のフレームを `M19-04c` 是正前（`10,29,0,38`）へ戻す | **`DIFF: migrations/000026_seed_moves_first_wave.up.sql は生成物と一致しません` / exit 1** |
| **破壊 B** | 複製の `guile.csv:64` の code を `sonic_break` → `sonic_break_light` へ戻す | **`DIFF:` up・down の 2 本とも不一致 / exit 1** |
| **★★破壊 C**（Phase C で追加） | 複製の `manon.csv:30` `temps_lie` を是正前（`5,1,23,28`）へ戻し、**既定モード**で `-check` | **★★`OK: 生成物は既存ファイルと一致` / exit 0 ＝ 捕まらない**（投入 moves 合計 = 752 / 索引キャラ数 = 9） |
| **★★破壊 C'**（同上） | 同じ複製に対し `-chars manon -out 000045_seed_moves_manon` を明示して `-check` | **`DIFF: migrations/000045_seed_moves_manon.up.sql` / `.down.sql` の 2 本とも不一致 / exit 1** |
| **★破壊 D**（Phase C で追加） | 複製の `kimberly.csv:78` `bushin_prism_strikes` を是正前（`26,3,24,52`）へ戻し、**既定モード**で `-check` | **`DIFF: migrations/000026_seed_moves_first_wave.up.sql` / exit 1** |

> **★★【Phase C 是正・レビュー指摘 高-3】初版は破壊 A / B の 2 件しか実走しておらず、どちらも `guile.csv` に対するものだった。⇒ §2.6 の 6 行を 1 行も試していなかった。** Phase C で C / C' / D を足した。
>
> **★★破壊 C が本サブで最も価値のある実測である**——**`seedgen -check` の既定モードは第一波 9 キャラ**〔`FirstWaveOrder`＝`terry, guile, lily, ingrid, kimberly, juri, ken, mai, zangief`〕**しか再生成しない。⇒ manon の行を是正前へ戻しても緑のまま通る。** **★これを「機構が守っている」の証拠として使っていたら、守っていない 1 行を守っていると書くところだった。**
>
> **★守っているのは `go test ./...` の中の `TestGolden_ManonMovesMatchesRegeneration` である**（破壊 C' が、同テストが行う比較を手で再現したもの）**。⇒ 9 行の内訳は「`000026` の golden が 8 行 ／ `000045` の golden が 1 行」である。**

**⇒ 「CSV を直さずに DB だけ直すと次の seed 再生成で黙って戻る」という危険は、golden 2 本（`000026` ＋ `000045`）によって既に塞がれている。**「戻る」ではなく「**戻せば赤になる**」が現状である。**★これは実測であり、記述ではない。★ただし赤にする経路は `go test ./...` であって `seedgen -check` の既定モードではない**（破壊 C）。

### 4.3 テスト

| 対象 | 結果 |
|---|---|
| `go test ./...` | **緑**（`internal/infra/migration` 45.6s を含む全パッケージ ok） |
| `cd web && pnpm test` | **緑**（212 files / **2440 tests** passed） |
| `make e2e` | **緑**（**247 passed** / 3.8m） |

> **★`make e2e` は必ずリポジトリルートで実行すること。**`web/` で実行すると同ディレクトリの `e2e/` に当たって **`make: Nothing to be done for 'e2e'.`** が返り、**1 本も走っていないのに赤も出ない**（本サブで実際に一度踏んだ）。**Bash の作業ディレクトリはコール間で持続するため、`cd web && pnpm test` の直後がまさにその状態になる。**

### 4.4 ★★`check-md-emphasis.sh` の赤について

> **★★【Phase C 是正・レビュー指摘 高-4】初版は「本サブの変更ではない」と断定し、`git status --porcelain` が空の時点で測った 494 行を根拠に置いていた。★★その測定は完了報告を書く前のものであり、書いた後は本報告書自身が 7 行ぶん違反を足していた**（`:377 :381 :390 :429-432`）**。⇒ 断定が成り立たなくなっていた。**

**内訳を測定時点つきで分ける。**

| 測定時点 | 値 |
|---|---|
| 着手基点 `25c9285`（`git status --porcelain` が空） | **494 行 / ベースライン 436 行 ＝ 58 行増** |
| 完了報告 初版のコミット直後 | **502 行 ＝ 66 行増**（**★うち 7 行は本報告書自身**） |
| **Phase C で自分の行を直した後** | **§4.1 の表のとおり**（**★本報告書由来の行は 0 に戻した**） |

- **★★着手基点で既に 58 行増えていた部分は、本サブの変更ではない**。所在は `docs/handover/retrospective-digest.md`（41）／ `docs/progress/M26-02-completion-report.md`（40）／ `docs/progress/M21-RESEARCH-01-report.md`（40）等であり、**本サブが 1 行も触っていないファイルである**
- **★★本報告書が足した 7 行は本サブの責任である。⇒ Phase C で直した**（閉じ `**` の直前の句点・約物を強調の外へ出す）
- **★★1 行だけ残した**——`docs/progress/m28-04-review.md:95`（Phase B のレビュー報告書の本文）。**★意図的に直していない。**体裁だけの是正であっても、**独立レビュアーが書いた報告書の本文を製造が編集すると、Phase B が担保している「独立の記録」という性質が弱まる**ためである。**⇒ 隠さずここに書いて残す**
- **⇒ 残る 58 行はベースラインの更新が落ちているものとして、設計卓・改善レーンへ報告する**（§7-4）

> **★チェックリスト §0.3-4 は「`check-md-emphasis.sh` / `check-import-order.sh` のベースラインが動いていないこと」を重大でないものに挙げているが、本件はベースラインが動いている**（58 行増）**。⇒ §0.3-4 の免責には当たらないため、赤として報告する。**
>
> **★★教訓＝「常設検査は緑だった」と書くときは、いつ測ったかを併せて書くこと。** 成果物そのものが検査の母数に入る種類の検査（`check-md-emphasis` / `check-progress-log-index` / `check-doc-inventory`）では、**書く前に測った値は完了時の値ではない。**

---

## 5. ■ 併せて更新が要るもの

| # | 項目 | 本サブでの結果 |
|---|---|---|
| 1 | **消費した CHANGE 番号を registry へ登録したか** | **消費 0 本。⇒ 登録不要**（`docs/handover/change-number-registry.md` §1 は無変更） |
| 2 | **「次の番号」の写し先を全数直したか**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4） | **★4 か所とも無変更でよい**。CHANGE を 1 本も消費していないため |
| 3 | **消費したマイグレ連番** | **★★0 本。`migrations/` の実測末尾は `000105`**（`ls migrations/` を連番走査。恒久の欠番は `000012` の 1 件のみ）**。⇒ ボード §2.2 の「次に払い出す番号 = `000106`」は動かない。`000106` は未消費のまま返す** |
| 4 | **版を上げた文書の参照元** | **★版を上げた文書は無い**（`docs/design/` ／ `docs/instructions/` ／ `docs/handover/` を 1 ファイルも編集していない） |

---

## 6. `docs/design/` に反映が要る箇所（★製造は直していない）

**★無い。**

| 検索語 | `docs/design/` でのヒット |
|---|---|
| `sonic_break_light` | **0 件** |
| `sonic_cross_2_meter_od` | **0 件** |
| `sonic_cross_3_meter_od` | **0 件** |
| `sonic_cross` | 0 件 |
| `sonic_break` | **1 件** → `docs/design/04-notation-spec.md:131`（変種サフィックス表の `_od` 行の実例 **`sonic_break_od`**） |

**⇒ 設計書は誤った code を 1 つも名指ししていない。唯一の名指し `sonic_break_od` は是正後の正しい code である。⇒ CHANGE の起票は要らない**（指示書 §2.3-4・§3-5 / チェックリスト 束 E-3）。

---

## 7. 開発者への確認事項

| # | 事項 | 製造の所見 |
|---|---|---|
| **★★1** | **指示書 §7-1（§2.2-3 の読み）** | **★返答は不要になった。**現物を見た結果、**(a) と (b) の両方**であり、かつ**2026-08-03 に是正済み**である（§2.2） |
| ~~**★★2**~~ | **terry `quick_burn_light` は `sonic_break_light` と同型か** | **★★決着＝同型の誤りで確定**（2026-09-06 開発者のインゲーム確認）**。逐語＝「`quick_burn_light` には強度は存在しません。`quick_burn_light` として登録されているなら、それは誤りで、`quick_burn` に直す必要がある」。⇒ §11 へ落とした**（本サブの射程外のため設計卓へ請求する） |
| ~~**★3**~~ | **ingrid `sun_flare_light`** | **★★決着＝誤りではない**（2026-09-06 開発者確認。逐語＝「正しい」）**。⇒ 本行を閉じる** |
| **★4** | **`check-md-emphasis.sh` のベースラインが 58 行ぶん古い** | **★本サブの変更ではない**（§4.4）。**⇒ ベースラインの更新は `scripts/` を触るため改善レーンの手番**（`D-335`） |
| **★5** | **`is_derived=1` かつ `startup_basis='unknown'` が 51 行ある** | **★性格が一様ではない**（§1.4 型 2）——**開発者が確定させた `unknown`**〔guile `sonic_break_od`＝「扱いが難しいのでunknownでいい」〕**／ `M19-DESIGN-07` §4-1 の Phase 2 母数に載る未確定 ／ 第四波で後から入り母数の外にある 36 行**が混在する。**⇒ 本サブの射程外。報告のみだが、切り分けが要るなら別サブになる** |
| **★★6** | **`D-201`（2026-08-07）が名指しした「未決と読まれる 3 か所」のうち、引き継ぎ資料 §4 が本報告でも拾えていない** | **★`docs/handover/` のどの引き継ぎ資料かを特定していない**（`D-201` の記述は「引き継ぎ資料 §4」までで、ファイル名を書いていない）**。⇒ 設計卓が特定して閉じることを請求する**（§3-7b） |

---

## 8. ★確かめられなかったこと・解釈したこと（断定に化けさせない）

| # | 内容 |
|---|---|
| **★★1** | **「9 行が是正済みである」は、CSV / golden / DB / 回帰テストの 4 点が是正後の値であることの確認である。**「開発者が現在も同じ値を正しいと考えているか」は確かめていない。**⇒ `M19-04c` 以降に SF6 のアップデートで値が変わっていれば、それは別の課題である**（`M28-02a` が入れた `last_changed_game_version` の射程） |
| **★★2** | **`command` の是正が「正しい」ことの根拠は、`M19-04c` 指示書 §1.1 の B 表（開発者から受領した是正後の CSV 行）である**。インゲームの実入力そのものは確かめていない |
| ~~**★3**~~ | **terry `quick_burn_light` / ingrid `sun_flare_light` の所見は仮説だった**——**★★2026-09-06 に開発者のインゲーム確認で両方とも決着した**（terry は誤りで確定／ingrid は誤りではない）**。⇒ 仮説ではなくなった。★ただし「`name_ja` に強度語が付いているか」という判定の目安が 2 件とも当たったことは、目安が正しいことの証明ではない**（`D-161`＝機械では検出できない） |
| **★4** | **§3.1 の経緯のうち、「`M19-04c` で解消済み」は再構成ではなく `D-201`（2026-08-07）の明示的な裁定である**（Phase C でレビュー指摘により追加）**。★再構成にとどまるのは「`D-723` の仕分けがなぜ `D-201` を追跡しなかったか」の部分だけであり、当時の判断の意図そのものは確かめていない** |
| ~~**★5**~~ | **DB 実測は「HEAD のマイグレを新規 DB へ全適用した状態」だった**——**★★2026-09-06 に開発者が手元の既存 DB で同じ 2 本のクエリを実行し、21 行すべてが本報告の期待値と一致した**（guile の sonic 系 15 行〔`sonic_cross_2_meter_od` の `startup_basis=through` を含む〕＋ §2.6 の 6 行。旧 code 2 つは不在）**。⇒ 既存 DB の追随経路も確かめられた。`000063` の `NOT EXISTS` ガードが空振りしていた可能性は消えた。★配布済み DB は依然として対象外である**（`M26` の公開ゲート前であり、そもそも存在しない） |

---

## 9. レビュー結果 ＋ トリアージ

**レビュー報告書**: `docs/progress/m28-04-review.md`（Phase B・独立サブエージェント）。**トリアージの全文は同書末尾の `## 取り込み結果（自動トリアージ）` にある。**

### 9.1 件数と優先度別内訳

| 優先度 | 件数 | 採用 | 不採用 |
|---|---|---|---|
| **高** | **4** | **4** | **★0** |
| 中 | 3 | 3 | 0 |
| 低・所見 | 2 | 1（注記のみ）／1 は再現報告 | 0 |

**★★「高」指摘の不採用は 0 件である**（実測。**★本節は Phase C の後に書いた**＝`D-510`）。**再レビューの往復は 0 回**（初回レビューの指摘をすべて採用したため、上限 2 回に達していない）。

### 9.2 ★★レビューが覆した断定 4 件（**いずれも実装の欠陥ではなく、報告の断定の誤り**）

| # | 初版の断定 | 是正後 | 反映先 |
|---|---|---|---|
| **高-1** | `startup_basis='unknown'` が **48 行**／guile の 1 件は `M19-DESIGN-07` §4-1 の既知の残 | **51 行**（内訳の合計。48 は足し算の誤り）／**guile の 1 件は開発者が確定させた `unknown`**〔「扱いが難しいのでunknownでいい」〕**であり取り残しではない**／**§4-1 の典拠は別の行を指す**／**51 行のうち 36 行は第四波で母数の外** | §1.4 型 2・§7-5 |
| **高-2** | 6 行は確定反撃サーチの候補に「**両側とも入る**」 | **始動技側は 6 行とも／相手技側は 4 行。mai の 2 行は `is_projectile=1` で手動確認レーンへ回り、有利フレームの算出に到達しない** | §2.6 (b) |
| **高-3** | 破壊確認 A / B で「機構が守っている」ことを実測した | **★A / B は 2 件とも `guile.csv` に対するもので、§2.6 の 6 行を 1 行も試していなかった。`seedgen -check` の既定モードは第一波 9 キャラのみで manon を見ない**（破壊 C で実測＝**緑のまま通る**）**。守っているのは `TestGolden_ManonMovesMatchesRegeneration` である** | §2.7・§4.2（C / C' / D を追加） |
| **高-4** | 常設検査は「着手前・完了後とも同一」で `check-md-emphasis` の赤は本サブの変更ではない | **★測定時点が完了報告を書く前だった。本報告書自身が 7 行ぶん違反を足しており、`check-progress-log-index` も赤だった。⇒ 自分の行を直し、Phase D 後に測り直した** | §4.1・§4.4 |

**★★中-3 が本レビュー最大の追加である**——**`D-201`（2026-08-07）が「`M19-04c`（`000063`）で `P-19` の 6 行は解消済み」と既に裁定し、未決と読まれる 3 か所まで名指ししていた**という事実を、初版は 1 度も引いていなかった。**⇒ §3.1 の経緯が「再構成」から「記録されていた裁定が追跡されなかった」へ変わり、横断課題が 1 段重くなった。**

### 9.3 ★受け取ったこと

**★4 件とも「テストも lint も型検査も緑のまま通り、人が読む以外に見つける経路が無い」型である**。とくに **高-3 は、こちらが陽性対照として提示した実測そのものが、守られていない 1 行を守っていることにしていた**——**対照を張る対象が偏っていた**（2 件とも同じ CSV）**という、対照実験の設計の穴である。⇒ 「機構が生きている」を実測で示すときは、射程の全区分から 1 件ずつ取ること。**

---

## 10. 完了条件（指示書 §5）との照合

| # | 完了条件 | 結果 |
|---|---|---|
| 1 | §2.1 の母数が出ている | **○**（§1。3 件の現物値・3 code の全走査 182 件・guile 以外の同型の軽走査） |
| 2 | 3 件が DB と CSV の両方で直っている（または片方だけでよい理由） | **○**（**どちらも直していない。既に両方とも是正後の値であるため**＝§1.1 / §1.2 / §2.1） |
| 3 | §2.2-3 が (a) / (b) のどちらだったかが確定し、その通りに直っている | **○**（**両方だった**。`000063` の B-3 ＋ B-3' で両方是正済み＝§2.2） |
| 4 | `go test ./...` / `cd web && pnpm test` / `make e2e` が緑 | **○**（§4.3） |
| 5 | 常設検査が緑（`check-artifact-integrity.sh` を 1 本目に） | **△**（`check-artifact-integrity.sh` を含む 8 本は緑。**`check-md-emphasis.sh` のみ赤。★着手基点で既に 58 行増えており、本報告書が足した 7 行は Phase C で直した**＝§4.4） |
| 6 | §2.6 の 6 行について、直したか／保留にしたかが書かれている | **○**（**どちらでもない——既に是正済みだった**。値の一次源は `D-158`＝§1.5） |
| 7 | `docs/design/` に反映が要る箇所が一覧になっている | **○**（**0 件**＝§6） |
| 8 | `docs/progress/progress-log.md` へ追記されている | **○**（Phase D） |

---

## 11. ★★【2026-09-06 追記】terry `quick_burn_light` の是正 — 設計卓への起票請求

**★本サブでは直していない。**`M28-04` の射程外であり、**マイグレ連番は設計卓が払い出す**（`D-293`）。**⇒ 新サブの指示書と `000106` の払い出しを請求する。**

### 11.1 確定した事実

**開発者のインゲーム確認**（2026-09-06。逐語）:

> `quick_burn_light` には強度は存在しません。`quick_burn_light` として登録されているなら、それは誤りで、`quick_burn` に直す必要がある。

**⇒ `sonic_break_light` → `sonic_break`（`M19-04c` 節 A）とまったく同型の誤りである。**

### 11.2 ★★ただし前例より影響範囲が広い（**ここが本項の要点**）

現物（`character_data/terry.csv:32-33`）:

```
terry,quick_burn_light,special,クイックバーン,10,14,23,46,,-5,900,false,false,false,,,,d dl l plus p_l,,,standalone,,false,
terry,quick_burn_od,special,ODクイックバーン,10,14,23,46,,-5,1400,false,false,false,,,,d dl l plus p_l p_m,,,standalone,,false,
```

| 観点 | `sonic_break_light`（`M19-04c` の前例） | **`quick_burn_light`** |
|---|---|---|
| `is_derived` | **1** | **★0** |
| `command` | 空 | **★`d dl l plus p_l`** |
| `move_commands`（command 索引） | **非搭載**（`DES-003` §3.14 の非搭載条件に該当） | **★★搭載されている**（`migrations/000035_seed_move_commands.up.sql` に `'quick_burn_light', '214LP'`） |
| 動く golden | **1 本**（`000026`） | **★★4 本** |

**★★動く golden 4 本と、それぞれを固定しているテスト**:

| golden | 何が載っているか | 固定しているテスト |
|---|---|---|
| `000026_seed_moves_first_wave` | `moves` の INSERT ＋ `official_ja_move` 別名「クイックバーン」 | `TestGolden_CommittedMigrationMatchesRegeneration` |
| `000035_seed_move_commands` | `token_key` = `214LP` | `TestGolden_MoveCommandsMatchesRegeneration` |
| `000072_m20_seed_aliases_numeric` | `214LP` | `TestGolden_M2002NumericAliasesMatchesRegeneration` |
| `000073_m20_seed_aliases_srk` | `214LP` | `TestGolden_M2002SRKAliasesMatchesRegeneration` |

**★DB 側の追随 UPDATE は要らない**——`move_commands` も `preset_aliases` も `moves.id` を参照しており、`code` の改名で紐付きは切れない（`DES-003`）。**⇒ 動くのは「`code` で INSERT 先を解決している golden SQL」だけである。**

### 11.3 実査済みの前提（起票時に再確認は要らない）

| # | 実査 |
|---|---|
| 1 | **改名先 `quick_burn` は空いている**（`grep -c '^terry,quick_burn,' character_data/terry.csv` = 0）。**⇒ `UNIQUE (character_id, code)` の衝突は起きない。`sonic_break` のときのような改名の順序制約も無い** |
| 2 | **`quick_burn_medium` / `_heavy` は存在しない**（全 CSV 実査。`_light` 孤児の走査で本行が挙がった経路そのもの） |
| 3 | **正しい code は `DES-004` §2.1 から導ける**——変種サフィックス表が `_od` の実例に `sonic_break_od` を挙げており、`<base>_od` の base が `quick_burn`。**★`sonic_break` と同じ導出であり、製造が語を作る必要は無い** |
| 4 | **走査結果**: `character_data` 2 ／ `migrations` 10 ／ **`internal` 0 ／ `web`（src・e2e とも）0 ／ `scripts` 0** ／ `docs` 16（歴史記録・据え置き）。**⇒ テスト・E2E の名指しはゼロ**（`migration-version-literals-in-tests` 型の危険なし） |
| 5 | **`quick_burn_od` は改名不要**。`quick_burn` / `quick_burn_od` の対になり、`sonic_break` / `sonic_break_od` と同じ既存形へ合流する |

### 11.4 見込まれる射程

- **DML マイグレ 1 本**（`UPDATE moves SET code = 'quick_burn' … WHERE character_id IN (…terry…) AND code = 'quick_burn_light'`。**★`NOT EXISTS` ガード付き**＝`000063` 節 A と同型。**★DDL 無し**）
- **`character_data/terry.csv` の 1 行**（`§0.1` の「面が 2 つ」。CSV を直さないと次の seed 再生成で戻る）
- **golden 4 本の再生成**（`M19-04c` が `000026` / `000034` / `000045` を再生成した許容枠と同じ扱い。**★本数が増えるので、動いた理由を報告に書いてから更新すること**）
- **`CHANGE` は 0 本の見込み**——`docs/design/` に `quick_burn` の名指しは無い（**★起票時に実査すること**）
- **マイグレ連番**＝**`000106`**（**★本サブが未消費のまま返した番号**。`migrations/` の実測末尾は `000105`）

### 11.5 ★なぜ `M28` の窓のうちに起票してほしいか

**`move_code` のリネームは配布 DB の識別子が変わる**（`M28` が「破壊的変更の窓」である理由そのもの＝`D-725`）。**★公開後に変えると利用者のデータに影響しうる。⇒ 公開前が安い。**

**★★本サブが `sonic_break_light` を「1 か月遅れで再起票された課題」として扱ったのと、まったく同じ構図がここで再現しうる**——**いま起票しなければ、次に誰かが `_light` の孤児を走査するまで誰も気づかない**（`D-161` により全キャラ点検は行わない方針であり、**機械検出は効かない**）。

### 11.6 請求する手番

| # | 誰が | 何を |
|---|---|---|
| 1 | **設計卓** | **`followup-backlog.md` へ起票**（`D-382` により製造は §J 以外を書けない）。スラッグ案＝`terry-quick-burn-light-move-code-error` |
| 2 | **設計卓** | **新サブの指示書を起票**（`M28` 内。**★`M28-04` の追補ではなく別サブ**——本サブは完了済みであり、射程外の是正を後から足すと完了報告と実物がずれる） |
| 3 | **開発者** | **連番 `000106` の払い出し承認**（`D-293`。**★先例＝`D-738` で `M28-02a` の `000105` を承認した経路**） |

---

*以上、M28-04 完了報告。* **★★本サブの本体は「9 行を直すこと」ではなく「既に直っていることを 4 点で固定し、なぜ再起票されたかを記録すること」になった。** **★指示書 §2.1 が「母数を出す」を最初の成果物に置いていたことが、そのまま効いた**——**母数を出さずに実装へ入っていたら、`000063` と同じ是正をもう 1 本書いて `000106` を空振りさせていた**（`NOT EXISTS` ガードも `AND startup_basis = 'unknown'` も無い素の `UPDATE` なら、**0 行に当たって成功し、エラーにはならない**）。
