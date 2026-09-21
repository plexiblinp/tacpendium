# M14-RESEARCH-03 調査結果レポート: seed 波 1 回あたりの工程の全数

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-RESEARCH-03-seed-wave-work-inventory.md` v1.0.1 |
| 調査日 | 2026-09-01 |
| 調査担当 | 製造担当 Claude Code（`/research_plan` 自動モード） |
| 実行ブランチ | `claude/m14-research-03-plan-l8rl27`（HEAD `f0ebe20`） |
| 差分 | **コード・CSV・マイグレは 1 バイトも変更していない**（§6 に `git status` を掲載） |
| 判断 | **していない**。事実と母数のみ |

---

## §0 結論サマリ（事実のみ）

| # | 事実 | 指示書の把握との差 |
|---|------|--------------------|
| **1** | **`characters` テーブルは 19 行**（母数 19）。31 行ではない | **★指示書 §2.1 errata の「`characters` は 31 行」は誤り。** M25-RESEARCH-01 §4.3 の本文も「31 行」とは書いておらず、「全31体」はゲームのロースター＝`character_data/*.csv` のファイル数を指している |
| **2** | **19 行のうち 2 行（`c_viper` / `dhalsim`）は移動 system move 9 種のみを持つ仮登録**（攻撃技 0・`total` 全 NULL） | **★§2.3-4 の「仮登録は現在も在るか」＝在る。** M25-RESEARCH-01 が「seed 済み 19」と数えたのは `COUNT(moves)>0` 判定であり、仮登録 2 体を本 seed 済みに算入している |
| **3** | **本 seed 済み＝17 キャラ／残り＝14 キャラ**（＝ `characters` 行が無い 12 ＋ 仮登録 2） | **★ボード §1.3 の「全 31 / seed 済み 17 / 残り 14」は 3 つとも合っていた。** 指示書 §2.1 errata の「残り 12」は仮登録 2 体を差し引いた数 |
| **4** | **§2.1-6 の「差の 2 キャラ」＝ `blanka` と `yasmine`** | 名指しできた（§2.1-6） |
| **5** | **`character_data/*.csv` は 31 ファイル**（17 ではない）。31 キャラすべてが `seed-progress.md` で `precheck=済` | 指示書の「17 ファイル」は失効。M25 の「30 ファイル」は `dhalsim.csv` 追加（2026-09-01 `698e669`）前の値 |
| **6** | **★★第三波が実際に消費したマイグレは 9 本**（`000053`〜`000060` ＋ `000062`）。設計卓の把握「`000053`〜`000059`＝7 本」は **2 本少ない** | §2.2-1 |
| **7** | **★★第二波は 6 本**（`000043`〜`000048`）。**設計卓の把握と一致していた** | §2.2-1 |
| **8** | **★★設計卓が数えた「5 種類」は、実測では最低 13 段**（第三波の as-built 9 段 ＋ M20 期に積まれた 4 段）。条件付きでさらに 3 種 | §2.2 全体・**本調査の核心** |
| **9** | **★★`M18`〜`M24` に `moves` / `characters` / `custom_states` / `move_derivations` へ追加された列は 0**。**追加されたのは `preset_aliases` の 2 列（`alias_text_en`＝`000070` / `character_id`＝`000074`）と `combos.superseded_by_combo_id`（`000078`）だけ**。新表は 0 | §2.2-9。**★列の追加より「1 回きりの backfill が第四波の行を拾わない」経路のほうが数が多い** |
| **10** | **`M14-overview.md` §3 の「前提マイグレ 2 本を含む 5〜6 段」は、第三波の実績（9 段）に対しても既に不足していた** | §2.2-1 |
| **11** | **★§2.3-1 `combo-csv-io-ken` は失効している。** 現行 `web/e2e/combo-csv-io.spec.ts` は **`ryu`** を使い、`ken` は**コメント 1 か所にしか出現しない** | §2.3-1 |
| **12** | **★`chain_cancel_total` の実測資料は 55 件・18 キャラ。DB に入っているのは 53 件・17 キャラ。差の 2 件は `elena`（未 seed）** | §2.2-9・第四波の工程 |
| **13** | 手順の一部は **1 か所にまとまっている**——`character_data/seed-progress.md` §「seed 波ごとに再適用する規則」に **seedgen 5 コマンド**が記載されている。ただし同節は `characters` 行・移動 9 種・`is_projectile`・移動 `total`・`chain_cancel_total`・frame_cost・`custom_states` を**含まない** | §2.2-6 |

---

## §1 調査方法（母数の取り方）

`sqlite3` CLI は本環境に無い。Go / Python3（sqlite 3.45.1）は在る。
**リポジトリを一切変更せずに実測するため、スクラッチ領域に空 DB を作り `migrations/*.up.sql` を連番順に全適用した。**

```bash
$ python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
3.45.1
$ which sqlite3 || echo "sqlite3 なし"
sqlite3 なし
$ go version
go version go1.26.4 linux/amd64
```

```python
# <scratchpad>/build_db.py — リポジトリ外の使い捨て DB へ全 up マイグレを適用
import sqlite3, glob, os, sys
db = "<scratchpad>/scratch.db"
if os.path.exists(db): os.remove(db)
con = sqlite3.connect(db)
con.execute("PRAGMA foreign_keys=ON")
files = sorted(glob.glob("/home/user/combomgr/migrations/*.up.sql"))
print("up migrations:", len(files))
for f in files:
    con.executescript(open(f, encoding="utf-8").read()); con.commit()
print("ALL APPLIED OK. last =", os.path.basename(files[-1]))
```

```
up migrations: 80
ALL APPLIED OK. last = 000080_fix_ground_dash_label.up.sql
```

**全 80 本が 1 本も落ちずに適用できた。** 以降の DB 実測値はすべてこの DB（＝新規クリーン DB の最終状態）に対するもの。

```bash
$ ls migrations/*.up.sql | wc -l
80
$ ls migrations/*.down.sql | wc -l
80
$ ls migrations/*.up.sql | tail -1
migrations/000080_fix_ground_dash_label.up.sql
```

> **★指示書の「次に払い出す番号は `000081`」は合っていた。** disk 末尾は `000080_fix_ground_dash_label`。

**限界（明示）**: 本 DB は「新規クリーン DB」であり、**開発者の手元 dev DB・配布済み DB とは一致しない可能性がある**。`000063` / `000071` のように「新規 DB では 0 行に当たる」と自己申告しているマイグレが実在する（それぞれのヘッダに明記）。本レポートの数値は**新規クリーン DB の値**である。

---

## §2.1 残キャラの全数と顔ぶれ

### §2.1-1 `characters` テーブルの行数（母数）と全数列挙

```sql
SELECT COUNT(*) AS characters_total FROM characters;
```
```
characters_total
19
```

```sql
SELECT c.id, c.code, c.name_ja, c.name_en, (c.custom_states IS NOT NULL) AS has_custom_states
FROM characters c ORDER BY c.id;
```
```
id | code     | name_ja      | name_en  | has_custom_states
1  | ryu      | リュウ         | Ryu      | 1
5  | ken      | ケン          | Ken      | 0
6  | ingrid   | イングリッド     | Ingrid   | 1
7  | c_viper  | C.ヴァイパー    | C.Viper  | 1
8  | dhalsim  | ダルシム       | Dhalsim  | 0
9  | terry    | テリー         | Terry    | 0
10 | guile    | ガイル         | Guile    | 1
11 | lily     | リリー         | Lily     | 1
12 | kimberly | キンバリー      | Kimberly | 1
13 | juri     | ジュリ         | Juri     | 1
14 | mai      | 舞            | Mai      | 1
15 | zangief  | ザンギエフ      | Zangief  | 0
16 | manon    | マノン         | Manon    | 0
17 | m_bison  | ベガ          | M. Bison | 0
18 | rashid   | ラシード       | Rashid   | 0
19 | jamie    | ジェイミー      | Jamie    | 0
20 | luke     | ルーク         | Luke     | 0
21 | marisa   | マリーザ       | Marisa   | 0
22 | jp       | JP           | JP       | 0
(19 rows)
```

- **母数＝19 行。** `id` は 1〜22 で **2 / 3 / 4 が欠番**（`000017_cleanup_ajg_seed_and_unify_ryu_move_code` 等の過去の整理による。本調査では追跡していない）。
- `INSERT INTO characters` を持つマイグレは **6 本**（母数 6）:
  ```bash
  $ grep -ln "INSERT INTO characters" migrations/*.up.sql
  migrations/000003_seed_characters.up.sql
  migrations/000009_seed_characters_aki_jamie_guile.up.sql
  migrations/000014_seed_characters_classic5.up.sql
  migrations/000024_seed_characters_first_wave.up.sql
  migrations/000043_seed_characters_manon.up.sql
  migrations/000053_seed_characters_third_wave.up.sql
  ```
  > **★`M14-overview.md` §3 は「`INSERT INTO characters` を持つマイグレは `000003` / `000009` / `000014` / `000024` の 4 本のみ」と書いている。** 第二波・第三波の 2 本が加わって **現在は 6 本**である（同記述は 2026-08-01 時点の把握）。

### §2.1-2 `moves` が 1 行以上ある `character_id` の全数（「17」の数え直し）

```sql
SELECT COUNT(*) AS chars_with_moves FROM (SELECT DISTINCT character_id FROM moves);
```
```
chars_with_moves
19
```

```sql
SELECT c.id, c.code, COUNT(m.id) AS moves_cnt FROM characters c
LEFT JOIN moves m ON m.character_id = c.id GROUP BY c.id, c.code ORDER BY moves_cnt DESC, c.id;
```
```
id | code     | moves_cnt
19 | jamie    | 136
21 | marisa   | 117
18 | rashid   | 108
14 | mai      | 105
12 | kimberly | 104
6  | ingrid   | 100
10 | guile    | 97
1  | ryu      | 93
20 | luke     | 92
11 | lily     | 90
15 | zangief  | 90
5  | ken      | 89
17 | m_bison  | 88
22 | jp       | 84
13 | juri     | 82
16 | manon    | 81
9  | terry    | 79
7  | c_viper  | 9
8  | dhalsim  | 9
(19 rows)
```

**★`COUNT(moves) > 0` では 19 だが、`c_viper` / `dhalsim` の 9 件は移動 system move 9 種のみである。**

```sql
SELECT c.code, m.code AS move_code, m.category, m.total FROM moves m
JOIN characters c ON c.id = m.character_id WHERE c.code IN ('c_viper','dhalsim') ORDER BY c.code, m.code;
```
```
code    | move_code     | category | total
c_viper | back          | system   |
c_viper | dash_back     | system   |
c_viper | dash_forward  | system   |
c_viper | forward       | system   |
c_viper | jump_back     | system   |
c_viper | jump_forward  | system   |
c_viper | jump_neutral  | system   |
c_viper | micro_back    | system   |
c_viper | micro_forward | system   |
dhalsim | back          | system   |
dhalsim | dash_back     | system   |
dhalsim | dash_forward  | system   |
dhalsim | forward       | system   |
dhalsim | jump_back     | system   |
dhalsim | jump_forward  | system   |
dhalsim | jump_neutral  | system   |
dhalsim | micro_back    | system   |
dhalsim | micro_forward | system   |
(18 rows)
```

**⇒ 「17」は数え直した結果、判定基準を「CSV 由来の攻撃技を持つ」に取れば合っていた。**
19 − 仮登録 2 ＝ **17**。`followup-backlog.md` L138「残キャラ網羅表」も **「手入力 CSV 17 キャラ / moves 投入済み 17 キャラ ＋ 仮登録 2（c_viper/dhalsim＝移動 9 種のみ・攻撃技 0）」** と、はじめから 17 と 2 を分けて書いている。

### §2.1-3 差集合＝未 seed キャラの全数と顔ぶれ

`character_data/*.csv` のファイル名と `characters.code` の差集合を取った。

```bash
$ ls character_data/*.csv | sed 's|.*/||; s|\.csv$||' | sort > csv_codes.txt
$ # DB 側 code を SELECT して db_codes.txt へ
$ comm -23 csv_codes.txt db_codes.txt
aki
akuma
alex
blanka
cammy
chun_li
dee_jay
e_honda
ed
elena
sagat
yasmine
$ comm -23 csv_codes.txt db_codes.txt | wc -l
12
$ comm -13 csv_codes.txt db_codes.txt   # DB にあって CSV に無いもの
（0 件）
```

| 区分 | 母数 | 顔ぶれ |
|---|---:|---|
| `character_data/*.csv` 全数 | **31** | （§2.1-4） |
| `characters` 行あり | **19** | §2.1-1 のとおり |
| **`characters` 行なし（＝未 seed）** | **12** | `aki` `akuma` `alex` `blanka` `cammy` `chun_li` `dee_jay` `e_honda` `ed` `elena` `sagat` `yasmine` |
| **仮登録（`characters` 行あり・攻撃技 0）** | **2** | `c_viper` `dhalsim` |
| **本 seed 済み** | **17** | `ryu` `ken` `ingrid` `terry` `guile` `lily` `kimberly` `juri` `mai` `zangief` `manon` `m_bison` `rashid` `jamie` `luke` `marisa` `jp` |
| **残り（第四波以降の対象）** | **14** | 未 seed 12 ＋ 仮登録 2 |
| DB にあって CSV に無い | **0** | — |

**★開発者の列挙 12 との差**（指示書 §2.1 の表）:

開発者の列挙＝`aki` / `akuma` / `cammy` / `chun_li` / `e_honda` / `ed` / `elena` / `alex` / `dee_jay` / `sagat` / `c_viper` / `dhalsim`

| 差の内容 | 件数 | コード |
|---|---:|---|
| 開発者の列挙に**あり**、実測の「未 seed 12」に**なし** | **2** | `c_viper` `dhalsim`（＝`characters` 行は在る仮登録。実測では「残り 14」側には入る） |
| 開発者の列挙に**なし**、実測の「未 seed 12」に**あり** | **2** | **`blanka`** **`yasmine`** |

**⇒ 集合としては開発者の列挙 12 と実測 12 は要素が 2 つずつ違う。** ただし、**「残り」を「本 seed が済んでいないキャラ」と取れば 14 であり、開発者の列挙 12 はそこから `blanka` / `yasmine` が抜けている。**

### §2.1-4 `character_data/*.csv` のファイル数（「17 ファイル」の数え直し）

```bash
$ ls character_data/*.csv | wc -l
31
```

**31 ファイル。指示書の「17 ファイル」は失効している。**
M25-RESEARCH-01 §4.3 の「30 ファイル」も既に失効している——`dhalsim.csv` が 2026-09-01 に追加された。

```bash
$ for f in blanka c_viper dhalsim yasmine; do echo -n "$f: "; \
    git log --diff-filter=A --format="%ad %h %s" --date=short -- character_data/$f.csv | tail -1; done
blanka:  2026-08-30 9315b25 docs:キャラデータの追加。ついでにMemoも更新。
c_viper: 2026-08-30 9315b25 docs:キャラデータの追加。ついでにMemoも更新。
dhalsim: 2026-09-01 698e669 docs: ダルシム挿入
yasmine: 2026-08-23 1523172 docs: character data追加
```

**`character_data/seed-progress.md` の表は 31 行**（L15〜L45）で、**31 キャラすべてが `precheck=済`**。`seed_imported=済` は **17**（＝本 seed 済み 17 と一致）、`seed_imported=未` は **14**（＝未 seed 12 ＋ `c_viper` / `dhalsim`）。**同表と DB 実測は完全に一致している。**

> `blanka` 行が同表に入ったのは 2026-09-01（`8af480c chore: preseed check`）。

### §2.1-5 `yasmine` の在否

| 確かめたこと | 結果 |
|---|---|
| `characters` に在るか | **無い**（§2.1-1 の 19 行に `yasmine` は無い。`grep -c "yasmine" migrations/*.up.sql` も全 80 本で 0 件） |
| `moves` は在るか | **無い**（`characters` 行が無いため 0 件） |
| `character_data/yasmine.csv` | **在る**（2026-08-23 追加・84 行・`precheck=済`） |

**★`yasmine` は「未 seed 12」に含まれる。**

### §2.1-6 差の 2 キャラの名指し

**★`blanka` と `yasmine` である。**

- **`blanka`**: `character_data/blanka.csv` は 2026-08-30 に追加（118 行）。`seed-progress.md` への行追加は 2026-09-01。**開発者の列挙（2026-08-30）の時点では、CSV は同日追加され `seed-progress.md` にはまだ載っていなかった。**
- **`yasmine`**: CSV は 2026-08-23 追加（84 行）。2026-08-04 のアップデートで追加されたキャラ（指示書 §2.1-5 の記載）。

**⇒ §5-2（完了条件）は満たした。開発者しか知らない事情での説明を要しない。** 両者とも CSV は在り `precheck=済` であり、`characters` 行が無いだけである。

---

## §2.2 seed 波 1 回あたりの工程の全数（本調査の主題）

### §2.2-1 過去 2 波が実際に消費したマイグレの連番と内容

```bash
$ ls migrations/*.up.sql | sed 's|.*/||; s|\.up\.sql$||' | awk -F_ '$1>="000043"'
000043_seed_characters_manon
000044_seed_movement_system_moves_manon
000045_seed_moves_manon
000046_backfill_moves_is_derived_manon
000047_seed_move_commands_manon
000048_backfill_movement_total_manon
000049_add_moves_frame_cost_columns
000050_backfill_moves_frame_cost
000051_seed_moves_zangief_rapid
000052_backfill_moves_chain_cancel_total
000053_seed_characters_third_wave
000054_seed_movement_system_moves_third_wave
000055_seed_moves_third_wave
000056_backfill_moves_is_derived_third_wave
000057_seed_move_commands_third_wave
000058_backfill_moves_is_projectile_third_wave
000059_backfill_movement_total_third_wave
000060_backfill_moves_chain_cancel_total_third_wave
000061_seed_move_derivations_zangief_rapid
000062_backfill_moves_frame_cost_third_wave
000063_correct_moves_data_m1904c
000064_backfill_frame_cost_manual
000065_correct_frame_values_phase2
000066_correct_jamie_freeflow_codes
000067_backfill_frame_cost_manual_addendum
000068_correct_fastest_unreachable_addendum
000069_m20_initial_presets_three
000070_m20_preset_aliases_add_alias_text_en
000071_m20_seed_move_commands_od4
000072_m20_seed_aliases_numeric
000073_m20_seed_aliases_srk
000074_m20_preset_aliases_add_character_id
000075_m20_preset_aliases_unique
000076_m20_seed_aliases_p34_numeric
000077_m20_seed_aliases_p34_srk
000078_add_combos_superseded_by
000079_fix_character_display_names
000080_fix_ground_dash_label
```

#### 第二波（`M14-03d`・manon 1 キャラ）＝ **6 本**（母数 6）

| 連番 | 内容 | 生成手段 |
|---|---|---|
| `000043` | `characters` 行の投入（★前提） | 手書き |
| `000044` | 移動 system move 9 種 ＋ `official_ja_move` alias（★前提） | 手書き |
| `000045` | `moves` 本体 ＋ `official_ja_move` alias ＋ `original_move_id` 解決 | **seedgen `-mode moves`** |
| `000046` | `moves.is_derived` backfill | **seedgen `-mode derived-backfill`** |
| `000047` | `move_commands` 索引 | **seedgen `-mode move-commands`** |
| `000048` | 移動 5 code の `total` backfill | 手書き（開発者提供の実測値） |

**★設計卓の把握「`000043`〜`000048`」＝合っていた。**

#### 第三波（`M14-03e`・6 キャラ）＝ **9 本**（母数 9）

| 連番 | 内容 | 生成手段 |
|---|---|---|
| `000053` | `characters` 行の投入（★前提。`custom_states` は **NULL のまま＝スコープ外**と本文に明記） | 手書き |
| `000054` | 移動 system move 9 種 ＋ `official_ja_move` alias（★前提） | 手書き |
| `000055` | `moves` 本体 ＋ `official_ja_move` alias ＋ `original_move_id` | **seedgen `-mode moves`** |
| `000056` | `moves.is_derived` backfill | **seedgen `-mode derived-backfill`** |
| `000057` | `move_commands` 索引 | **seedgen `-mode move-commands`** |
| `000058` | `moves.is_projectile` backfill（31 件） | 手書き（CSV が一次源） |
| `000059` | 移動 5 code の `total` backfill（6×5＝30 行） | 手書き（開発者提供の実測値） |
| **`000060`** | `chain_cancel_total`（16 行） | 手書き（`chain-cancel-measurements.md` が一次源） |
| **`000062`** | `startup_basis` / `fastest_unreachable` の機械 backfill | 手書き（`000050` の規則を踏襲） |

**★設計卓の把握「`000053`〜`000059`＝7 本」は 2 本少ない。** `000060` と `000062` も**ファイル名に `third_wave` を持ち、第三波 6 キャラだけを対象にしている**。
（間の `000061_seed_move_derivations_zangief_rapid` は zangief 向けで第三波の対象外。）

#### 「前提マイグレ 2 本 ＋ 本体」という段構成は現在も同じか

**★段構成は維持されているが、段数が違う。**

`docs/instructions/M14-overview.md` §3（L103〜L112）は次の 6 段を挙げている:

```
| 段 | 内容 |
| 1 | characters 行の投入（★前提） |
| 2 | 移動 system move 9 種の投入（★前提） |
| 3 | moves 本体（seedgen 生成） |
| 4 | preset_aliases（seedgen 生成） |
| 5 | is_projectile backfill |
| 6 | 移動 5 code の total（実測値を受領できた場合のみ） |
```

**実測との差**:

| 差 | 事実 |
|---|---|
| 段 3 と段 4 は**同一マイグレ 1 本**である | `000055` の中身＝`INSERT INTO moves` 6 回・`INSERT INTO preset_aliases` 6 回・`UPDATE moves` 6 回（`grep -oE "INSERT INTO [a-z_]+\|UPDATE [a-z_]+" migrations/000055_seed_moves_third_wave.up.sql \| sort \| uniq -c`）。seedgen の `moves` モードが両方を 1 ファイルへ書く（`internal/seedgen/generate.go` L82〜L84） |
| **`is_derived` backfill が表に無い** | `000046` / `000056` として実在（各波 1 本） |
| **`move_commands` が表に無い** | `000047` / `000057` として実在（各波 1 本） |
| **`chain_cancel_total` が表に無い** | `000060` として実在 |
| **frame_cost（`startup_basis` / `fastest_unreachable`）が表に無い** | `000062` として実在 |
| **M20 のエイリアス再適用が表に無い** | M20 は 2026-08-13 以降＝同注記（2026-08-01）より後 |

### §2.2-2 `internal/seedgen` が現在生成するものの全数

`cmd/seedgen` の `-mode` は **4 値**（母数 4。`cmd/seedgen/main.go` L103・L112）:

```go
mode = flag.String("mode", "moves", "生成モード(moves / derived-backfill / move-commands / aliases。M17-02 §4.6/§4.1、M20-02)")
...
case "moves", "derived-backfill", "move-commands", "aliases":
```

| モード | 生成する SQL | 実装 |
|---|---|---|
| `moves`（既定） | `INSERT INTO moves`（**12 列**）＋ rush_variant の `UPDATE moves SET original_move_id`＋`INSERT INTO preset_aliases`（`official_ja_move`）。down は `DELETE FROM preset_aliases` → `DELETE FROM moves` | `generate.go` `GenerateWithHeader` |
| `derived-backfill` | `UPDATE moves SET is_derived = 1`（up）／`= 0`（down）。CSV で `is_derived=true` の code のみ列挙 | `generate_m1702.go` `GenerateDerivedBackfill` |
| `move-commands` | `INSERT INTO move_commands (move_id, character_id, token_key)` | `generate_m1702.go` `GenerateMoveCommands` |
| `aliases` | `INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text, alias_text_en)`（`-preset numeric` / `srk`。`-noinput-only` で層 C-3 のみ） | `generate_m2002.go` `GenerateAliases` |

**★`moves` モードが出す 12 列（`generate.go` L199）**:

```go
b.WriteString("INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)\n")
```

**★`moves` テーブルの現在の列は 19 列**（`PRAGMA table_info(moves)`）。**seedgen が出さない 7 列**（母数 7）:

| 列 | seedgen が出さない理由（`internal/seedgen/model.go` L8〜L17 の逐語） | 投入手段 |
|---|---|---|
| `id` | AUTOINCREMENT | — |
| `original_move_id` | 別の `UPDATE` 文で解決（rush_variant のみ） | seedgen（同じファイル内） |
| `setup_only` | CSV に列が無い | 現状 全 19 キャラで 0 件（`SUM(setup_only)=0`） |
| **`is_derived`** | 「索引フィルタ用・SQL 非投入」 | **`-mode derived-backfill`** |
| **`is_projectile`** | 「列 000039 で追加済だが seedgen は SQL 非投入のまま＝初期値は 000039 の backfill で投入」 | **手書き backfill マイグレ** |
| **`startup_basis`** | 「列 000049 で追加済だが同じく SQL 非投入」 | **手書き backfill マイグレ** |
| **`chain_cancel_total`** | 同上 | **手書き backfill マイグレ**（一次源は `chain-cancel-measurements.md`） |
| **`fastest_unreachable`** | 同上 | **手書き backfill マイグレ** |

> **★CSV には列そのものは在る。** `character_data/*.csv` は **23 列**（`internal/seedgen/model.go` `csvColumns`）で、`is_projectile` / `is_derived` / `startup_basis` / `chain_cancel_total` / `fastest_unreachable` を含む。**値は CSV に在るが seedgen が SQL へ出さない**という構造である。

```bash
$ head -1 character_data/ryu.csv
character_code,move_code,category,name_ja,startup,active,recovery,total,on_hit,on_block,damage,is_aerial,is_projectile,is_derived,notes,notes_tool,original_move_code,command,condition_ja,condition_en,startup_basis,chain_cancel_total,fastest_unreachable
$ for f in character_data/*.csv; do head -1 "$f"; done | sort -u | wc -l
1
```
**31 ファイルすべてがこの 23 列で同一ヘッダ。**

#### 過去 2 波の時点から増えたもの

| 増えたもの | 時期 | 第二波（`000043`〜）・第三波（`000053`〜）への影響 |
|---|---|---|
| `-mode aliases`（`generate_m2002.go`） | M20-02（2026-08-13） | **両波とも実行していない**（M20 より前） |
| `-noinput-only`（層 C-3・P-34） | M20-06 | 同上 |
| 出力への `character_id` 付与（`FormatCurrent`） | M20-03（`000074`） | `000026` / `000030` / `000045` / `000055` / `000072` / `000073` は**旧形式で適用済み**。`cmd/seedgen` が stem で判別する（`preM2003Stems`。`seed-progress.md` L85） |
| `alias_text_en` の出力 | M20-02（`000070`） | 同上 |

### §2.2-3 `moves.is_projectile` の backfill が現在も要るか／何を見て値を決めるか

**★要る。** seedgen は `is_projectile` を出力しない（§2.2-2）。

**値の一次源＝`character_data/*.csv` の `is_projectile` 列。** `000058` のヘッダが逐語でそう書いている:

```
-- 000058_backfill_moves_is_projectile_third_wave.up.sql
-- M14-03e(第三波): CSV で is_projectile=true の 31 moves を backfill する。
-- seedgen の moves INSERT は変換規則を byte-identical に保つため is_projectile を出力しない。
-- 値の一次源は character_data/*.csv。false 行は DDL の DEFAULT 0 のままにする。
```

**未 seed 12 キャラの CSV 実測（`is_projectile=true` の行数・母数＝各 CSV の全行）**:

| キャラ | CSV 全行 | `is_projectile=true` |
|---|---:|---:|
| aki | 72 | 3 |
| akuma | 107 | 18 |
| alex | 98 | **0** |
| blanka | 118 | 5 |
| cammy | 99 | **0** |
| chun_li | 87 | 6 |
| dee_jay | 84 | **0** |
| e_honda | 78 | **0** |
| ed | 75 | 7 |
| elena | 99 | **0** |
| sagat | 77 | 6 |
| yasmine | 84 | 4 |
| **合計** | **1078** | **49** |

**⇒ 第四波（未 seed 12 キャラ）で backfill が要る行数＝49 行**（母数 1078 行中）。5 キャラは 0 件（＝既定値 0 が正）。

現行 DB の状態（母数 19 キャラ）:

```sql
SELECT c.code, COUNT(m.id) AS moves, SUM(m.is_projectile) AS is_projectile_1 ... GROUP BY c.code;
```
```
code     | moves | is_projectile_1
c_viper  |     9 |  0
dhalsim  |     9 |  0
guile    |    97 | 24
ingrid   |   100 | 33
jamie    |   136 |  0
jp       |    84 | 12
juri     |    82 |  5
ken      |    89 |  4
kimberly |   104 |  6
lily     |    90 |  0
luke     |    92 |  6
m_bison  |    88 |  1
mai      |   105 | 20
manon    |    81 |  0
marisa   |   117 |  0
rashid   |   108 | 12
ryu      |    93 |  8
terry    |    79 |  4
zangief  |    90 |  0
(19 rows)
```

### §2.2-4 移動 system move の `total` の backfill が現在も要るか

**★要る。** seedgen は移動 9 種を **drop する**（`generate.go` L68〜L71 `isMovementSystem()`）ため、そもそも移動 move を投入しない。投入元は静的 seed（`000025` / `000044` / `000054`）で、そこには `total` が入らない。

対象 5 code（`dash_forward` / `dash_back` / `jump_neutral` / `jump_forward` / `jump_back`）の現況（母数 19 キャラ × 5 code）:

```sql
SELECT c.code, SUM(CASE WHEN m.total IS NOT NULL THEN 1 ELSE 0 END) AS movement_total_set,
       COUNT(*) AS movement_moves
FROM moves m JOIN characters c ON c.id = m.character_id
WHERE m.code IN ('dash_forward','dash_back','jump_neutral','jump_forward','jump_back')
GROUP BY c.code ORDER BY movement_total_set, c.code;
```
```
code     | movement_total_set | movement_moves
c_viper  | 0 | 5
dhalsim  | 0 | 5
guile    | 5 | 5
ingrid   | 5 | 5
jamie    | 5 | 5
jp       | 5 | 5
juri     | 5 | 5
ken      | 5 | 5
kimberly | 5 | 5
lily     | 5 | 5
luke     | 5 | 5
m_bison  | 5 | 5
mai      | 5 | 5
manon    | 5 | 5
marisa   | 5 | 5
rashid   | 5 | 5
ryu      | 5 | 5
terry    | 5 | 5
zangief  | 5 | 5
(19 rows)
```

**⇒ 本 seed 済み 17 キャラは 17×5＝85 行すべて充足。仮登録 2 キャラの 10 行は NULL。**
**⇒ 第四波では 14 キャラ × 5 code ＝ 70 行が対象**（母数 70）。

**★値の出所は CSV でも DB でもない。** `000059` のヘッダの逐語:

```
-- 【値の出所】開発者提供・実測値・2026-08-01 受領。
--   DB/CSV/既存マイグレには存在しない一次源のため、再検証可能性を保つ目的でここに記録する。
```

**⇒ 第四波では、開発者から 14 キャラ分の実測値（`dash_forward` / `dash_back` / `jump_*`）を受領しないと埋められない。** `forward` / `back` / `micro_forward` / `micro_back` の 4 code は対象外（`total` は NULL のまま）＝`000059` 本文に明記。

### §2.2-5 `custom_states` の `show_delta` 付与が要るキャラが残キャラに何人いるか

**まず「4 キャラ」の数え直し。** followup L127 は「int custom_state def を持つ 4 キャラ（Mai/Lily/Juri/Kimberly）」と書いている。

```sql
SELECT code, custom_states FROM characters WHERE custom_states IS NOT NULL ORDER BY code;
```

| code | state code | type / kind | `show_delta` |
|---|---|---|---|
| `c_viper` | `limit_decoupler` | flag / boolean | 無し |
| `guile` | `solid_puncher` | flag / boolean | 無し |
| **`ingrid`** | `sun_crest` | **level / integer(0-4)** | **`true`** |
| **`juri`** | `fuha_stock` | **stock / integer(0-3)** | **`true`** |
| `juri` | `feng_shui_engine` | flag / boolean | 無し |
| **`kimberly`** | `shuriken_bomb_stock` | **stock / integer(0-2)** | **`true`** |
| **`lily`** | `windclad` | **stock / integer(0-3)** | **`true`** |
| **`mai`** | `flame_stock` | **stock / integer(0-5)** | **`true`** |
| `ryu` | `denjin_charge` | flag / boolean | 無し |

- **`custom_states` を持つキャラは 8**（母数 19 キャラ中）。**int（level / stock）の def を持つのは 5 キャラ**（`ingrid` `juri` `kimberly` `lily` `mai`）——**followup の「4 キャラ」は `ingrid` が漏れている**（`ingrid/sun_crest` は `000023_add_show_delta_ingrid_sun_crest` で先に `show_delta` が付いた）。
- **5 キャラとも `show_delta:true` が付与済み**であり、**5 キャラとも本 seed 済み 17 に含まれる。**

**残キャラ 14 のうち `custom_states` 定義が要るキャラの母数**:

| 区分 | 母数 | 内容 |
|---|---:|---|
| `custom_states` が既に在る | **1** | `c_viper`（`limit_decoupler`・flag/boolean。**`show_delta` は不要な型**） |
| `custom_states` が NULL | **13** | `dhalsim` ＋ 未 seed 12 |
| **リポジトリ内に定義本体が在る未 seed キャラ** | **0** | `character_data/*.csv` に `custom_states` / `show_delta` 列は無い（`grep -l "custom_state\|show_delta" character_data/*.csv` → 0 件）。`migrations/` にも未 seed 12 キャラの `custom_states` は無い |
| **「定義対象」と決まっているが定義本体が未作成** | **1** | **`yasmine`**。`character_data/seed-progress.md` L138 の逐語＝**「`yasmine` のバヤニモードは `custom_states` の定義対象（開発者判断 2026-08-25）。`lily`/`juri`/`mai`/`kimberly` と同じ状態機構として扱う。種別・値域・増減の定義と、`moves` seed との前後関係は投入波の設計で決める」** |

**⇒ 「残キャラの中に該当者がいるか」＝ 現時点でリポジトリから判定できるのは `yasmine` 1 件のみ。** 他 13 キャラについては、**`custom_states` の要否を判定する情報がリポジトリ内に無い**（探し方＝`character_data/*.csv` の全列走査・`migrations/*.up.sql` の `custom_states` grep・`docs/seed-data/` の走査。いずれもヒット 0 件）。

**★`custom_states` は波の工程に入っていた実績がある**（母数＝波 3 回中 1 回）:
- `000015_seed_custom_states_classic3`（`000014` の classic5 に対して）
- `000027_seed_custom_states_first_wave`（第一波。対象＝`guile` `juri` `kimberly` `lily` `mai` `ryu` の 6 code）
- 第二波（`000043`）: manon は `custom_states` 無し
- **第三波（`000053`）: 本文に「`custom_states` は本サブのスコープ外のため NULL のまま」と明記**

### §2.2-6 ★★M20 のエイリアス生成規則の再適用に何が要るか

#### プリセットは何本あるか

```sql
SELECT id, code, name, is_builtin FROM presets ORDER BY id;
```
```
id | code             | name                      | is_builtin
1  | official_ja_move | 公式表記(日本語・技名表示)改善版 | 1
3  | numeric          | ナンバリング記法              | 1
5  | srk              | SRK 記法                   | 1
(3 rows)
```

**プリセットは 3 本**（母数 3）。`id` は 1 / 3 / 5 で欠番あり。

```sql
SELECT p.code AS preset, COUNT(*) AS alias_rows, COUNT(DISTINCT m.character_id) AS chars_covered,
       SUM(CASE WHEN pa.character_id IS NULL THEN 1 ELSE 0 END) AS char_id_null,
       SUM(CASE WHEN pa.alias_text_en IS NULL THEN 1 ELSE 0 END) AS alias_en_null
FROM preset_aliases pa JOIN presets p ON p.id = pa.preset_id JOIN moves m ON m.id = pa.move_id
GROUP BY p.code ORDER BY p.code;
```
```
preset           | alias_rows | chars_covered | char_id_null | alias_en_null
numeric          |       1258 |            19 |            0 |          1207
official_ja_move |       1653 |            19 |            0 |          1653
srk              |       1273 |            19 |            0 |          1222
(3 rows)
```

- **`preset_aliases` 総数 4184 行**（母数）。**3 プリセットとも 19 キャラを網羅**。`character_id` の NULL は **0 件**。
- **⇒ 波ごとに再適用が要るのは 3 本すべて**。`official_ja_move` は seedgen の `moves` モードが同じファイルへ出す（＝波の段 3 に内包）。**`numeric` / `srk` は別モード（`-mode aliases`）で別マイグレを起こす。**

#### 再適用の手順は在るか

**★在る。`character_data/seed-progress.md` §「seed 波ごとに再適用する規則」（L49〜L85）に手順が bash で書かれている。** 逐語:

```bash
# 1) moves / is_derived / move_commands（従来どおり）
go run ./cmd/seedgen -chars <新キャラ> -out <連番>_seed_moves_<波> -note "..."
go run ./cmd/seedgen -mode derived-backfill -chars <新キャラ> -out <連番>_backfill_moves_is_derived_<波> -note "..."
go run ./cmd/seedgen -mode move-commands    -chars <新キャラ> -out <連番>_seed_move_commands_<波>   -note "..."

# 2) ★表記プリセットのエイリアス（M20-02 で追加。2 プリセット分を必ず両方走らせる）
#    ★-movement-chars には「その波で増えたキャラ」を渡す（省略すると -chars と同じ）。
go run ./cmd/seedgen -mode aliases -preset numeric -chars <新キャラ> -movement-chars <新キャラ> \
  -out <連番>_seed_aliases_numeric_<波> -note "..." -alias-report tmp/aliases-numeric.md
go run ./cmd/seedgen -mode aliases -preset srk     -chars <新キャラ> -movement-chars <新キャラ> \
  -out <連番>_seed_aliases_srk_<波>     -note "..." -alias-report tmp/aliases-srk.md
```

**同節が記載している注意点（事実の列挙）**:

| # | 内容 |
|---|---|
| 1 | **規則の実体は `internal/seedgen/generate_m2002.go`**。マイグレはその出力で**手編集しない**（golden テストが drift を検出） |
| 2 | **★移動系 9 code も波ごとに再適用が要る。** `000072` / `000073` は**適用時点の 19 キャラを明示列挙して**投入しており新キャラには当たらない |
| 3 | **`-movement-chars` は「その波で増えたキャラ」を渡す。前の波のキャラを混ぜてはならない**（down が前波の投入分まで消す。生成器テスト `TestAliases_MovementDownIsScopedToItsOwnChars` が守っている） |
| 4 | 再適用は**冪等**（`NOT EXISTS` ガード・upsert ではない） |
| 5 | **`-alias-report` を必ず出す。** 衝突・元技未解決 rush・command 無し派生は投入されない |
| 6 | **`-alias-report` に出ない衝突が 1 種類ある**（`numeric`/`srk` が同キャラ別 move の `official_ja_move` 表記と一致する型。現状 0 件）。**⇒ `go test ./internal/infra/migration/` まで回す** |
| 7 | **M20-03（`000075`）以降、生成器のフィルタを抜けた衝突は UNIQUE 違反でマイグレ適用時に落ちる**（静かな欠落ではなくなった） |
| 8 | **適用済み 6 件（`000026`/`000030`/`000045`/`000055`/`000072`/`000073`）を再生成しない**。`cmd/seedgen` が stem で旧形式を判別する（`preM2003Stems`） |

**★同節が挙げていないのは P-34（層 C-3）の 2 本である。** `000076_m20_seed_aliases_p34_numeric` / `000077_m20_seed_aliases_p34_srk`（M20-06）は `-noinput-only` フラグで生成される。両ファイルのヘッダは同じ再適用要求を持つ:

```
-- ★1 回きりの backfill ではなく「規則」の出力である(D-181)。新キャラ CSV を投入する
--   seed 波では、本規則を再適用して新しい連番のマイグレを起こすこと
--   (手順は character_data/seed-progress.md)。
```

**⇒ 第四波で起こす M20 系マイグレは 4 本**（`numeric` / `srk` / P-34 `numeric` / P-34 `srk`）。**手順が明文化されているのは前 2 本のみ。**

### §2.2-7 移動 9 種 seed（`000025`）が当たっていないキャラを遡って埋める工程

**★要る。** `000025_seed_movement_system_moves_all.up.sql` は `characters` を `CROSS JOIN` する形だが、**適用時点に存在した行にしか当たらない**。

現況（母数 19 キャラ）:

```sql
SELECT c.code, COUNT(*) AS sys9 FROM moves m JOIN characters c ON c.id = m.character_id
WHERE m.code IN ('forward','back','micro_forward','micro_back','dash_forward','dash_back',
                 'jump_neutral','jump_forward','jump_back')
GROUP BY c.code ORDER BY sys9, c.code;
```
```
（19 キャラすべて sys9 = 9）
```

**⇒ 19 キャラ × 9 code ＝ 171 行がすべて充足。未 seed 12 キャラは `characters` 行が無いため 0 行。**

**第二波・第三波がどう処理したか**: **専用の前提マイグレを 1 本ずつ起こした。**

| 波 | マイグレ | 内容 |
|---|---|---|
| 第二波 | `000044_seed_movement_system_moves_manon` | `INSERT INTO moves` 1 回 ＋ `INSERT INTO preset_aliases` 1 回 |
| 第三波 | `000054_seed_movement_system_moves_third_wave` | 同上 |

**★`000025` を遡って再実行するのではなく、波ごとに同型のマイグレを新規連番で起こしている。**
followup L137 の逐語＝**「`NOT EXISTS` は冪等性のためで、後から追加されたキャラを遡って埋めない」「characters 行が無いまま seedgen 生成 SQL を流すと `WHERE c.code='<char>'` が 0 件ヒットし、マイグレ成功のまま 0 行投入＝サイレント no-op」**。

### §2.2-8 `move_derivations` の明示削除責務が seed 波の down に要るか

**現況**（母数 88 行 / 19 キャラ中 9 キャラ）:

```sql
SELECT c.code, COUNT(*) AS derivations FROM move_derivations d
JOIN moves m ON m.id = d.child_move_id JOIN characters c ON c.id = m.character_id
GROUP BY c.code ORDER BY c.code;
```
```
code     | derivations
guile    | 15
jamie    | 20
ken      | 15
kimberly |  3
luke     |  5
m_bison  | 14
marisa   |  6
rashid   |  1
zangief  |  9
(9 rows)
```

**行の出所（母数 3 本）**:

```bash
$ grep -ln "INSERT INTO move_derivations" migrations/*.up.sql
migrations/000061_seed_move_derivations_zangief_rapid.up.sql
migrations/000064_backfill_frame_cost_manual.up.sql
migrations/000067_backfill_frame_cost_manual_addendum.up.sql
```

**★seed 波のマイグレは `move_derivations` を 1 行も入れていない。** 投入したのは M19-04 の人手判断 backfill（`000064` / `000067`）と zangief 連打版（`000061`）である。

**down の実測**:

```bash
$ grep -c "move_derivations" migrations/000055_seed_moves_third_wave.down.sql \
    migrations/000053_seed_characters_third_wave.down.sql migrations/000045_seed_moves_manon.down.sql
migrations/000055_seed_moves_third_wave.down.sql:0
migrations/000053_seed_characters_third_wave.down.sql:0
migrations/000045_seed_moves_manon.down.sql:0

$ grep -c "DELETE FROM move_derivations" migrations/000064_backfill_frame_cost_manual.down.sql \
    migrations/000067_backfill_frame_cost_manual_addendum.down.sql \
    migrations/000061_seed_move_derivations_zangief_rapid.down.sql
migrations/000064_backfill_frame_cost_manual.down.sql:38
migrations/000067_backfill_frame_cost_manual_addendum.down.sql:16
migrations/000061_seed_move_derivations_zangief_rapid.down.sql:2
```

**事実の整理**:

- 第三波キャラ（`m_bison` / `rashid` / `jamie` / `luke` / `marisa`）は **46 行**の `move_derivations` を持つ（`jp` は 0）。それらを入れたのは `000064` / `000067` である。
- **第三波の down（`000055.down`）は `move_derivations` に触れない。**
- ただし `000064.down` / `000067.down` は自分が入れた行を `DELETE FROM move_derivations` している（それぞれ 38 文 / 16 文）。**golang-migrate は head から連番の降順に down を実行するため、`000055.down` に到達する前に `000067.down` → `000064.down` が走る。**
- **⇒ 第三波の down 単体に明示削除は無いが、head からの順次ロールバックでは先行する down が削除する。**

**第四波の down に要るか**: **第四波のマイグレが `move_derivations` へ INSERT する場合は要る。** followup `move-derivations-explicit-delete-on-reseed`（L259）の逐語＝**「`move_derivations` は `ON DELETE CASCADE` に依存しない設計のため、親 `moves` を物理削除する側が該当行を明示削除する責務を負う」「危険な経路は seed の再生成波——`DELETE` → `INSERT` で `moves.id` が再発番される型（`000029` → `000030` が実例）では、残った行が再発番された別の技を指す。削除エラーにはならず、静かに壊れる」**。同 followup の状態は **未着手**（「規約は DES-003 §3.20 に着地済み。次の seed 波の着手時に指示書へ展開する」）。

### §2.2-9 ★★`M18`〜`M24` の期間に積まれた「seed 波で埋める必要のある列・テーブル」

#### (A) スキーマ差分（`000059` 時点 → 現在 `000080`）

第三波の最終連番 `000059` までを適用した DB と、`000080` まで適用した DB のテーブル／列を機械比較した。

```python
# at59.db = 000059 まで適用 / scratch.db = 000080 まで適用
# 各テーブルの PRAGMA table_info を列名で出力して diff
```

```
=== 000059 時点のテーブル数: 21 / 現在(000080): 21 ===
=== diff (000059 -> 000080) ===
11c11
< combos: ... materialized_from_combo_id
---
> combos: ... materialized_from_combo_id, superseded_by_combo_id
16c16
< preset_aliases: id, preset_id, move_id, alias_text
---
> preset_aliases: id, preset_id, move_id, alias_text, alias_text_en, character_id
```

**★結果（母数付き）**:

| 観点 | 母数 | 結果 |
|---|---:|---|
| **新規テーブル** | 21 → 21 | **0 本** |
| **`moves` の列追加** | 19 列 | **0 列** |
| **`characters` の列追加** | 6 列 | **0 列** |
| **`move_derivations` の列追加** | 2 列 | **0 列** |
| **`move_commands` の列追加** | 3 列 | **0 列** |
| **`preset_aliases` の列追加** | 4 → 6 列 | **2 列**＝`alias_text_en`（`000070`）／`character_id`（`000074`） |
| **`combos` の列追加** | 27 → 28 列 | **1 列**＝`superseded_by_combo_id`（`000078`）。**利用者データの列であり seed 対象ではない**（`combos` は新規 DB で 0 行） |

**⇒ `M18`〜`M24` に seed 波が埋めるべき列として増えたのは `preset_aliases` の 2 列のみ。** ただし**両列とも seedgen `-mode aliases` / `-mode moves` が自動的に出す**（`generate_m2002.go` L761・`generate.go` L269）。

#### (B) ★列の追加ではなく「1 回きりの backfill が第四波の行を拾わない」経路

**★こちらのほうが数が多い。** `000062` のヘッダが、この型を逐語で一般化している:

```
-- ★なぜ必要か: 000050(機械 backfill)は 000053〜000059(第三波 seed)より前に適用される。そして
--   000053〜000059 は startup_basis / fastest_unreachable に一切触れていない(grep ヒット 0)。
--   その結果、第三波 6 キャラの 625 行は startup_basis='unknown' / fastest_unreachable=0 の
--   DDL 既定値のまま取り残されていた。
--
-- ★一般化: 「1 回きりの backfill マイグレ」は、その後に INSERT される行を拾えない。
--   取り残しはエラーにならず、unknown / false のまま静かに残る。
--   ...
--   → 今後の seed 波は、既存の backfill マイグレの内容を自波の行にも適用すること。
```

**第四波が追随を要する「1 回きり」マイグレの全数**（`migrations/` 全 80 本を走査し、`moves` / `characters` / `preset_aliases` / `move_commands` / `move_derivations` を対象とする `UPDATE` / `INSERT` を持つものを列挙。母数 80 本）:

| # | 一次源 | 現在の代表マイグレ | 第四波での要否 | 第四波の対象行数（実測） |
|---|---|---|---|---|
| 1 | `characters` 行 | `000053` | **要**（前提。無いとサイレント no-op） | 14 キャラ |
| 2 | 移動 system move 9 種 ＋ `official_ja_move` alias | `000054` | **要**（前提） | 12 キャラ×9＝108 行（仮登録 2 は投入済み） |
| 3 | `moves` 本体 ＋ `official_ja_move` alias ＋ `original_move_id` | `000055`（seedgen） | **要** | 未 seed 12＝1078 行 ＋ `c_viper`/`dhalsim` の CSV 行 |
| 4 | `moves.is_derived` | `000056`（seedgen） | **要** | 未 seed 12 で `is_derived=true` **445 行** |
| 5 | `move_commands` | `000057`（seedgen） | **要** | 未 seed 12 で `command` 非空 **854 行**（1:N 展開前） |
| 6 | `moves.is_projectile` | `000058` | **要** | **49 行**（§2.2-3） |
| 7 | 移動 5 code の `total` | `000059` | **要**（開発者の実測値受領が前提） | 14×5＝**70 行** |
| 8 | `moves.chain_cancel_total` | `000060`（一次源＝`chain-cancel-measurements.md`） | **要** | **2 行**（`elena` のみ。下記） |
| 9 | `startup_basis` / `fastest_unreachable` の機械 backfill | `000062`（規則は `000050`） | **要** | 未 seed 12 の全 1078 行が対象規則にかかる |
| 10 | `fastest_unreachable` の人手判断分 | `000068_correct_fastest_unreachable_addendum` | **要否は CSV 次第** | 未 seed 12 CSV で `fastest_unreachable=true` **87 行** |
| 11 | `numeric` エイリアス | `000072`（seedgen `-mode aliases`） | **要** | 未実測（生成時に確定） |
| 12 | `srk` エイリアス | `000073`（seedgen `-mode aliases`） | **要** | 同上 |
| 13 | P-34 `numeric`（層 C-3） | `000076`（`-noinput-only`） | **要** | 同上 |
| 14 | P-34 `srk`（層 C-3） | `000077`（`-noinput-only`） | **要** | 同上 |
| 15 | `custom_states`（`show_delta` 含む） | `000027` / `000023` | **`yasmine` は「定義対象」と確定。他 13 は不明** | §2.2-5 |
| 16 | `move_derivations` | `000064` / `000067`（人手判断） | **不明**（§2.2-8。第四波が入れるなら down の明示削除も） | 未実測 |

> **★#8 の母数**: `character_data/chain-cancel-measurements.md` §「確定値」は「**55 件・18 キャラ**」と自己申告している。DB の実測は:
> ```sql
> SELECT COUNT(*) AS chain_cancel_rows FROM moves WHERE chain_cancel_total IS NOT NULL;  -- 53
> ```
> **53 件・17 キャラ。差の 2 件・1 キャラは `elena`**（同資料 L20/L21＝`エレナ Crouch LP` / `エレナ Crouch LK`）。`elena` は未 seed 12 に含まれる。**53 ＋ 2 ＝ 55 で説明が付く。**

#### (C) 未 seed 12 キャラ CSV の実測（第四波の母数）

```
キャラ    CSV全行  is_projectile=T  is_derived=T  command有  chain_cancel  fastest_unreach
aki          72          3            23           56            0              6
akuma       107         18            50           86            0             14
alex         98          0            53           66            0              8
blanka      118          5            55           95            0              7
cammy        99          0            48           81            0              6
chun_li      87          6            24           67            0              7
dee_jay      84          0            34           70            0              6
e_honda      78          0            26           63            0              7
ed           75          7            23           57            0              8
elena        99          0            48           82            0              6
sagat        77          6            26           61            0              6
yasmine      84          4            35           70            0              6
合計       1078         49           445          854            0             87
```

対照＝本 seed 済み 17 キャラの CSV（母数 17 キャラ）:
```
合計       1479        135           581         1180            0             34
```

> **★CSV と DB の突合（本 seed 済み 17 キャラ）**: `is_projectile` は CSV 135 件・DB 135 件で**一致**。`is_derived` は CSV 581 件・DB 584 件で**差 3**——`000051_seed_moves_zangief_rapid` の zangief 連打版 3 行（CSV 非由来）で説明が付く。

- **★`chain_cancel_total` は 31 CSV すべてで 0 件**。値の正本は `chain-cancel-measurements.md`（`000060` ヘッダの逐語＝「CSV にも書くと同じ値が 2 か所に存在してどちらが正か分からなくなるため転記しない」）。
- **★CSV から移動 9 種の行は既に除かれている**（31 CSV すべてで `move_code` が移動 9 種の行は 0 件）。
- DB 実測（本 seed 済み 17 キャラ・移動 9 種を除く）＝**1482 行**。CSV 実測 **1479 行**との差 **3 行**は `000051_seed_moves_zangief_rapid`（zangief 連打版 3 行・CSV 非由来）で説明が付く。

#### (D) seed データを持つテーブルの全数

```
table                            rows  character_id 列 / moves 経由
characters                         19  -
combo_oki_options                   0  -
combo_punish_curations              0  -
combo_punish_prunings               0  -
combo_punish_starters               0  -
combo_punishes                      0  -
combo_setup_results                 0  -
combo_setups                        0  -
combo_steps                         0  moves 経由
combo_tags                          0  -
combos                              0  character_id 直
games                               1  -
move_commands                     898  character_id 直, moves 経由
move_derivations                   88  moves 経由
moves                            1653  character_id 直
preset_aliases                   4184  character_id 直, moves 経由
presets                             3  -
setup_steps                         0  moves 経由
setups                              0  character_id 直
tags                                3  -
users                               1  -
```

**⇒ 全 21 テーブル中、キャラに紐づく seed データを持つのは 5 テーブル**（`characters` / `moves` / `move_commands` / `move_derivations` / `preset_aliases`）。他は 0 行（利用者データ・`games` 1 行・`presets` 3 行・`tags` 3 行・`users` 1 行）。

`move_commands` のキャラ別（母数 17 キャラ・898 行）:
```
guile 48 / ingrid 71 / jamie 49 / jp 51 / juri 48 / ken 50 / kimberly 55 / lily 49 / luke 50
m_bison 45 / mai 50 / manon 45 / marisa 66 / rashid 60 / ryu 56 / terry 48 / zangief 57
```
`c_viper` / `dhalsim` は 0 行（`command` を持たないため）。

### §2.2-10 各工程が「1 波につき 1 回」か「1 キャラにつき 1 回」か

**★マイグレのファイル本数はすべて「1 波につき 1 本」である。** 実測（母数＝波 2 回）:

| 波 | キャラ数 | マイグレ本数 | 1 キャラあたり本数 |
|---|---:|---:|---:|
| 第二波（manon） | 1 | 6 | 6.0 |
| 第三波 | 6 | 9 | 1.5 |

**⇒ 本数はキャラ数に比例していない。** 第二波の 6 本は「1 キャラでも全段が必要」であることを示し、第三波はそこに `chain_cancel_total` と frame_cost の 2 段が加わって 9 本になった。

**中身は「1 キャラにつき 1 ブロック」である**:

```bash
$ grep -oE "INSERT INTO [a-z_]+|UPDATE [a-z_]+" migrations/000055_seed_moves_third_wave.up.sql | sort | uniq -c
      6 INSERT INTO moves
      6 INSERT INTO preset_aliases
      6 UPDATE moves
```
**第三波 6 キャラ＝各文が 6 回**。seedgen が `charOrder` を回して 1 キャラ 1 ブロックを書く（`generate.go` L64〜L87）。

**「1 キャラにつき 1 回」の性格を持つ入力**（＝キャラ数に比例して人手・受領が要るもの）:

| 工程 | 性格 | 根拠 |
|---|---|---|
| 移動 5 code の `total` | **1 キャラにつき 1 回の実測値受領** | `000059` ヘッダ「開発者提供・実測値・2026-08-01 受領。DB/CSV/既存マイグレには存在しない一次源」 |
| `chain_cancel_total` | **1 キャラにつき 1 回の実測** | `chain-cancel-measurements.md` の「確定ロースター」がキャラごとに非対称（`000060` ヘッダ「対象は 16 行であって『4 技 × 6 キャラ = 24 行』ではない」） |
| `custom_states` の定義 | **1 キャラにつき 1 回の設計判断** | `seed-progress.md` L138（`yasmine`） |
| `-alias-report` の確認 | **1 波につき 1 回**（ただし行数はキャラ数に比例） | `seed-progress.md` L77 |
| `-movement-chars` の指定 | **1 波につき 1 回**（前の波のキャラを混ぜない） | `seed-progress.md` L78 |

---

## §2.3 失効している前提が無いか（1 件ずつ判定）

### §2.3-1 `combo-csv-io-ken` — **★失効している**

followup L128 の逐語:
> **`web/e2e/combo-csv-io.spec.ts` は ken の moves 件数 >0 を断定（L64-67）するが ken の moves seed は存在しない**。現状 dev DB 残渣（73 件）で通過＝**クリーンなマイグレ DB では 0 件→失敗**。

**実測**:

```bash
$ grep -c "ken" web/e2e/combo-csv-io.spec.ts
1
```

現行 L28〜L42（逐語）:
```ts
    // ryu を使う: ryu は最古から moves seed を持つ安定基準(M14-03c の 000029/000030 で
    // 手入力 CSV 由来へ再 seed 済み)。M14-03b(000026)で ken 等も seed 済みになったが、
    // 本 spec は特定キャラに依存せず ryu で件数非依存(>0)に確認する。
    const charsRes = await page.request.get("/api/games/1/characters");
    ...
    const ryu = chars.items.find((c) => c.code === "ryu");
    expect(ryu, "seed で ryu が存在するはず").toBeTruthy();

    const movesRes = await page.request.get(`/api/moves?character_id=${ryu!.id}`);
    expect(movesRes.ok()).toBeTruthy();
    const moves = (await movesRes.json()) as { items: { code: string }[] };
    expect(moves.items.length, "ryu の moves seed が存在するはず").toBeGreaterThan(0);
```

**失効している点は 3 つ**:

| # | followup の記述 | 実測 |
|---|---|---|
| 1 | 「ken の moves 件数 >0 を断定」 | **断定していない。** `ken` は L29 のコメント 1 か所にしか出現しない。断定対象は `ryu` |
| 2 | 「L64-67」 | 現行 L64-67 は CSV 行の組み立て部分（`csvRow({...})`）。行番号も失効 |
| 3 | 「ken の moves seed は存在しない」 | **存在する。** `ken` は本 seed 済み 17 に含まれ、moves 89 件（§2.1-2） |

**⇒ followup が提示していた対処 (a)「対象を ryu へ変更」は既に実施済みである。**

### §2.3-2 `character-down-migrations-orphan-user-combos` が第四波の down にも当てはまるか

**当てはまる**（同じ形の down になる場合）。実測:

```bash
$ grep -v "^--" migrations/000024_seed_characters_first_wave.down.sql | grep -v "^$"
DELETE FROM characters
WHERE game_id IN (SELECT id FROM games WHERE code = 'sf6')
  AND code IN ('terry', 'guile', 'lily', 'kimberly', 'juri', 'mai', 'zangief');

$ grep -v "^--" migrations/000053_seed_characters_third_wave.down.sql | grep -v "^$"
DELETE FROM characters
WHERE game_id IN (SELECT id FROM games WHERE code = 'sf6')
  AND code IN ('m_bison', 'rashid', 'jamie', 'luke', 'marisa', 'jp');
```

**両 down とも `DELETE FROM characters` の 1 文のみ**（followup L801 の記述どおり）。第四波の `seed_characters_fourth_wave.down.sql` を同型で書けば同じ経路になる。

**followup L801 の状態**: **(i) 設計卓が `architecture-patterns` §11 へ規約を置いた（2026-08-25・`D-552`）＝済 ／ (ii) 開発者の手番＝未着手。** フェーズ4 へ割付済み（`D-646`）。

**★本調査では規約 (i) の内容そのものは確認していない**（`docs/process/architecture-patterns.md` §11 の中身は §2.3 のスコープ外と判断し、`followup-backlog.md` の記述を引いた）。

### §2.3-3 followup「未 seed 波の必須前提」群のうち既に解消しているもの（1 件ずつ）

| followup ID（行） | 記述の要旨 | **判定** | 根拠 |
|---|---|---|---|
| **【未 seed 波の必須前提】未 seed キャラは `characters` に存在しない**（L137） | 各未 seed 波で「characters 行」＋「移動 9 種＋alias」の前提マイグレ 2 本と件数固定テストが必要 | **解消していない（継続）** | 未 seed 12 キャラは `characters` に 0 行（§2.1-3）。`000025` は遡って埋めない（§2.2-7） |
| **`M14-03-is-projectile-backfill`**（L132） | 未 seed キャラの seed 波では `moves.is_projectile` を backfill する | **解消していない（継続）** | seedgen は `is_projectile` を出力しない（§2.2-2 の 12 列）。`model.go` L12〜L13 が逐語で「SQL 非投入のまま」と宣言 |
| **`M14-03-dash-total-backfill`**（L133） | 移動 system move の `total` を backfill する | **解消していない（継続）** | seedgen は移動 9 種を drop（§2.2-4）。第四波の対象 70 行 |
| **`M14-03b-custom-states-stock`**（L127） | (a) int custom_state def 4 キャラへ `show_delta` 付与 / (b) Ingrid ①②③ ＋ 4 キャラ E2E / (c) remap の 2 値 situation 構造 | **(a) 解消**（ただし母数は 4 ではなく 5）／**(b) 部分的に解消**／**(c) 未確認** | (a) int def を持つ 5 キャラ（`ingrid` `juri` `kimberly` `lily` `mai`）とも `show_delta:true` 付与済み・全員 seed 済み（§2.2-5）。(b) `web/e2e/m14-03b-custom-states-realdata.spec.ts`（69 行・1 test）が存在するが、同 spec L11〜L12 の逐語は「**ingrid の sun_crest を代表として UI E2E で行使する。M14-03b(000027)で新規投入した lily/kimberly/juri/mai の def は**（後略）」であり、**4 キャラ個別の E2E は同 spec には無い**。(c) remap の 2 値 situation 構造は本調査で確認していない |
| **`combo-csv-io-ken`**（L128） | ken の moves 前提 | **★失効**（§2.3-1） | — |
| **`pre-dist-e2e-clean`**（L130） | 配布前に一度クリーン DB で全 E2E スイートを実行 | **解消していない（未着手）** | §2.3-6 |
| **`character-down-migrations-orphan-user-combos`**（L801） | 第一波・第三波の down が利用者コンボを orphan にする | **(i) 済 ／ (ii) 未着手** | §2.3-2 |
| **`move-derivations-explicit-delete-on-reseed`**（L259） | seed 再生成波での明示削除責務 | **未着手** | §2.2-8。followup 自身が「次の seed 波の着手時に指示書へ展開する」と状態を持つ |
| **残キャラ網羅表**（L138） | 手入力 CSV 17 キャラ / 投入済み 17 / 仮登録 2 / 残り 13 キャラは手入力待ち | **数値が失効・構造は正しい** | 「17 / 仮登録 2」は現在も正しい。**「手入力 CSV 17 キャラ」→ 31 ファイル**、**「残り 13 キャラは手入力待ち」→ 手入力待ち 0**（31 キャラすべて `precheck=済`）。「配布 blocker は全 30〔/31〕キャラ充足時点」は本調査では判定していない |

### §2.3-4 `c_viper` / `dhalsim` の仮登録は現在も在るか／UNIQUE 衝突経路は成立するか

**★仮登録は現在も在る。** §2.1-2 の実測（両者とも移動 system move 9 種のみ・攻撃技 0・`total` 全 NULL・`is_projectile` 等すべて 0）。

**⇒ 指示書 §2.3-4 の「`M25-RESEARCH-01` §4.3 は両者を『seed 済み 19』に数えている。⇒ 仮登録ではなくなっている疑いが強い」は、実測では成立しない。** M25 の判定基準が `COUNT(moves)>0` であり、移動 9 種だけで条件を満たしたためである。

**UNIQUE 衝突で起動不能になる経路が現在も成立するか**:

**★本調査では「成立する／しない」を実行して確かめていない。** 確かめられた事実は次のとおり:

| 事実 | 根拠 |
|---|---|
| `moves` に `UNIQUE (character_id, code)` が在る | `sqlite_master` の DDL |
| `preset_aliases` に M20-03 で UNIQUE が 2 本張られた | `000075_m20_preset_aliases_unique`。`UNIQUE(preset_id, character_id, alias_text)` と `UNIQUE(preset_id, character_id, alias_text_en) WHERE alias_text_en IS NOT NULL` |
| `m20-contract.md` L99 の逐語 | **「★制約の投入順序に条件がある。UNIQUE を先に入れると、後続 seed 波の INSERT が衝突して起動不能になる経路が実在する——先例＝`c_viper` / `dhalsim` が『UNIQUE 衝突で起動不能の経路』として最終波指定されている（ボード §1.3）」** |
| **`c_viper` / `dhalsim` の CSV は既に在る** | `c_viper.csv`（2026-08-30 追加）／`dhalsim.csv`（2026-09-01 追加）。両者とも `seed-progress.md` で `precheck=済` |
| 両者の現在の `preset_aliases` 行 | 移動 9 種分のみ（`official_ja_move` / `numeric` / `srk` の 3 プリセット × 9 code） |

**⇒ 「必ず最終波」の制約が失効しているかは、本調査では判定できない。** 判定には `c_viper` / `dhalsim` の CSV から実際に seedgen を回し、`000075` の UNIQUE 下でマイグレを適用してみる必要がある（＝生成物の作成にあたるため §4「やらないこと」に触れる）。**確かめられたのは「仮登録は在る」までである。**

### §2.3-5 `precheck_seed_data` スキルが参照するファイルの実在

`.claude/commands/precheck_seed_data.md` からパス様の文字列を機械抽出し、`ls` で実在を確認した（母数 16 パターン）。

```
OK   character_data/*.csv
OK   character_data/chain-cancel-measurements.md
OK   character_data/command-correction-history.md
OK   character_data/seed-progress.md
OK   cmd/seedgen
OK   docs/process/remote-ops.md
OK   docs/seed-data/
OK   docs/seed-data/*.md
OK   docs/seed-data/README.md
OK   docs/seed-data/check-criteria.md
OK   docs/seed-data/input-notes.md
OK   docs/seed-data/moves-input-background.md
OK   docs/seed-data/target-combo-and-derived-flag-rules.md
OK   internal/seedgen/generate_m2002.go
OK   internal/seedgen/model.go
MISS web/worktree
```

**★`MISS web/worktree` は抽出の誤検出である。** 実体は L177 の散文「出力先はローカル= `tmp/` 配下、**web/worktree**=セッション scratchpad」＝「web 版 / worktree 運用」の意味であり、ファイルパスではない。

**⇒ 参照ファイルは 15 パターンすべて実在する。** 指示書が名指しした `internal/seedgen/generate_m2002.go` も実在（48,706 バイト）。

**★ただし本調査は「実在するか」しか見ていない。** 参照先の**内容が現況と合っているか**（例: `generate_m2002.go` の記述が現行のフラグ体系と一致するか）は確かめていない。

### §2.3-6 `pre-dist-e2e-clean` の判断材料（★判断はしない）

| 材料 | 事実 |
|---|---|
| followup の状態 | **未着手（配布前ゲート）**（L130）。出所＝`M14-03a` 報告 まとめ4 |
| E2E spec の総数 | **60 本**（`ls web/e2e/*.spec.ts \| wc -l`） |
| 実行環境 | `CLAUDE.md` §5＝「使い捨て DB ＋ 専用ポート（バックエンド 47390 / Vite 5273）の独立スタックで実行され、dev DB・dev サーバに影響しない」。全数は `make e2e` |
| **本 followup が想定していた「残渣依存テスト」の代表例** | `combo-csv-io` — **★§2.3-1 のとおり、既に `ryu` へ変更済みで残渣に依存しない** |
| 他に残渣依存の疑いがある spec を探した結果 | **本調査では網羅していない。** `web/e2e/*.spec.ts` 60 本のうち、キャラ code を直書きしているものを `grep -ln "'ken'\|\"ken\"" web/e2e/*.spec.ts` 等で部分的に確認したにとどまる（`ken` は 6 spec が参照）。**「残渣依存テストが他に無い」ことは確かめていない** |
| 第四波がクリーン DB の内容を変えるか | **変える。** 第四波でキャラが 19 → 31 になると、`/api/games/1/characters` の件数を固定している spec があれば影響する。**本調査では該当 spec の有無を確かめていない** |

---

## §2.4 見積りの材料

### §2.4-1 過去 2 波の実所要

**★記録が無い。**

探し方（すべて 0 件）:
```bash
$ grep -niE "所要|時間|分|工数|hour|min" docs/progress/m14-03d-completion-report.md
（ヒットはあるが、いずれも「時間」ではなく「分割」「10 分」等の別語脈。実所要の記録は無い）
$ grep -niE "所要|時間|工数" docs/progress/m14-03e-completion-report.md
（0 件）
```

`m14-03d-completion-report.md` / `m14-03e-completion-report.md` のいずれにも **wall-clock の所要時間・工数の記録は無い**。
代替の材料として `M25-RESEARCH-01` §5.3 に「全 Go テスト 1 回の wall は 84.410 秒」がある（seed 波の所要そのものではない）。

### §2.4-2 1 キャラあたりの moves 件数の中央値と最大値

**DB 実測（本 seed 済み 17 キャラ・移動 9 種込み。母数 17）**:

```
母数     = 17
最小     = 79  (terry)
中央値   = 92
最大     = 136 (jamie)
合計     = 1635
平均     = 96.2
```

**移動 9 種を除いた（CSV 由来）件数**:
```
最小 = 70 / 中央値 = 83 / 最大 = 127 / 合計 = 1482
```

**CSV 実測（母数 17 キャラ）**: 最小 70 / 中央値 83 / 最大 127 / 合計 **1479**
（DB 1482 との差 3 は `000051_seed_moves_zangief_rapid` の zangief 連打版 3 行）

**未 seed 12 キャラの CSV（母数 12）**: 最小 72（aki）/ 中央値 85.5 / 最大 118（blanka）/ 合計 **1078**

> **★未 seed 12 キャラは、既 seed 17 キャラより 1 キャラあたりが やや多い**（中央値 85.5 対 83）。

### §2.4-3 第四波を 1 波でやる場合のマイグレ本数の見込み

**★「見込み」である。** 実測から算出した根拠付きの数であって、確定値ではない。

**過去 2 波の実績（母数 2 波）**:

| 波 | キャラ数 | マイグレ本数 |
|---|---:|---:|
| 第二波 | 1 | 6 |
| 第三波 | 6 | 9 |

**本数はキャラ数に比例していない**（§2.2-10）。**段の数で決まる。**

**第四波（14 キャラを 1 波でやる場合）の段の見込み**:

| 区分 | 本数 | 内訳 |
|---|---:|---|
| 第三波の as-built をそのまま踏襲 | **9** | `characters` / 移動 9 種 / `moves`+alias / `is_derived` / `move_commands` / `is_projectile` / 移動 `total` / `chain_cancel_total` / frame_cost |
| M20 期に積まれた再適用（§2.2-6） | **+4** | `numeric` / `srk` / P-34 `numeric` / P-34 `srk` |
| **小計（確度が高い分）** | **13** | |
| 条件付き | **+0〜3** | `custom_states`（`yasmine` の定義が要るなら +1）／`fastest_unreachable` 人手判断分（+0〜1）／`move_derivations`（+0〜1） |
| **見込み合計** | **13〜16 本** | ⇒ 次連番 `000081` から `000093`〜`000096` |

**★これは「1 波でやる場合」の本数である。** 波を分割すると、**段の数（13）が波の数だけ掛かる**（第二波が 1 キャラでも 6 本だった実績がこれを示す）。

### §2.4-4 1 波を何キャラで切るかの材料

#### マイグレ 1 本あたりの行数の上限が実務上在るか

**★上限を宣言した記述はリポジトリ内に見つからなかった。**
探し方: `migrations/` 全 80 本のヘッダコメント走査、`docs/design/supp-001-detailed-design.md` §5.5 系の走査、`m20-contract.md` の走査。いずれも「1 マイグレの行数上限」に相当する記述は 0 件。

**実測の最大値**（母数＝波の `seed_moves` 3 本）:

```bash
$ for f in 000026_seed_moves_first_wave 000045_seed_moves_manon 000055_seed_moves_third_wave; do
    echo -n "$f  行数="; wc -l < migrations/$f.up.sql | tr -d ' '
    echo -n "   バイト="; stat -c%s migrations/$f.up.sql; done
000026_seed_moves_first_wave  行数=1856
   バイト=146261
000045_seed_moves_manon  行数=188
   バイト=15453
000055_seed_moves_third_wave  行数=1387
   バイト=115232
```

| 波 | キャラ数 | `seed_moves` の行数 | バイト | 1 キャラあたり |
|---|---:|---:|---:|---:|
| 第一波 | 9 | 1856 | 146,261 | 206 行 / 16.3 KB |
| 第二波 | 1 | 188 | 15,453 | 188 行 / 15.5 KB |
| 第三波 | 6 | 1387 | 115,232 | 231 行 / 19.2 KB |

**⇒ 実績上の最大は第一波の 1856 行 / 146 KB。** 14 キャラを 1 本に収めると **約 2,900〜3,200 行 / 約 220〜270 KB** の見込み（1 キャラあたり 206〜231 行の実績から線形外挿）。

**波あたりの総バイト（up + down 合算）**:
```bash
$ du -cb migrations/00004[3-8]_*.sql | tail -1     # 第二波 6 本
37740	total
$ du -cb migrations/0000{53,54,55,56,57,58,59,60,62}_*.sql | tail -1   # 第三波 9 本
225935	total
```

#### 1 波の適用に要する時間

**★測っていない。** 本調査で行った「80 本の全適用」は体感で即時に完了したが、**計測していないため数値を出せない**。
`M25-RESEARCH-01` §5.3 に `dbtest.Setup` が 1.07 秒（全 80 マイグレ適用を含む）という実測がある——**ただし同値は「同テストの小さい SELECT/INSERT と test harness を含む上限寄りの値」と同報告が自己申告している。**

#### down の複雑さがキャラ数に比例するか

**★比例する。** seedgen の down はキャラ単位のブロックを逆順に連結する（`generate.go` L86〜L92）:

```go
downBlocks = append(downBlocks, buildCharDown(code, insertRows))
...
// down はキャラ逆順で結合(投入と逆順)。
for i := len(downBlocks) - 1; i >= 0; i-- {
    down.WriteString(downBlocks[i])
}
```

`buildCharDown` は 1 キャラにつき `DELETE FROM preset_aliases`（move_code 列挙）→ `DELETE FROM moves`（同列挙）の 2 文を書く。**⇒ down の文数は 2 × キャラ数。列挙する code 数は moves 件数に比例。**

**★ただし down の「難しさ」はキャラ数に比例しない要素を 2 つ持つ**（事実の列挙）:

| 要素 | 事実 |
|---|---|
| `move_derivations` の明示削除 | §2.2-8。キャラ数ではなく「その波が `move_derivations` を入れたか」で決まる |
| 移動系 alias の `-movement-chars` スコープ | `seed-progress.md` L78＝**「前の波のキャラを混ぜてはならない——down が前の波の投入分まで消す」**。キャラ数ではなく**集合の切り方**で決まる |

---

## §3 指示書が挙げた数字の 1 つずつの数え直し（§3-3 の要求）

| # | 指示書の数字 | 数え直した結果 | 判定 |
|---|---|---|---|
| 1 | **31**（全キャラ） | `character_data/*.csv` = **31 ファイル**／`seed-progress.md` の表 = **31 行**／**`characters` テーブルは 19 行** | **合っていた**（ただし「`characters` は 31 行」という errata の読みは誤り） |
| 2 | **17**（seed 済み） | 本 seed 済み（CSV 由来の攻撃技を持つ）= **17** | **合っていた** |
| 3 | **14**（残り） | 未 seed 12 ＋ 仮登録 2 = **14** | **合っていた** |
| 4 | **12**（開発者の列挙） | `characters` 行が無いキャラ = **12**。ただし顔ぶれが 2 つずつ違う（§2.1-3） | **数は合い、集合が違った** |
| 5 | **5 種類**（設計卓が数えた工程） | 第三波 as-built **9 段** ＋ M20 期の **4 段** = **13 段**（条件付き +3） | **合っていない（過少）** |
| 6 | **`000043`〜`000048`**（第二波） | **6 本。一致** | **合っていた** |
| 7 | **`000053`〜`000059`**（第三波） | **9 本**（`000053`〜`000060` ＋ `000062`）。`third_wave` を名に持つ 2 本が漏れていた | **合っていない（過少 2 本）** |
| 8 | **17 ファイル**（CSV） | **31 ファイル** | **失効** |
| 9 | **`000081`**（次の連番） | disk 末尾 `000080_fix_ground_dash_label`。次は **`000081`** | **合っていた** |
| 10 | **4 キャラ**（int custom_state def） | **5 キャラ**（`ingrid` が漏れていた） | **合っていない（過少 1）** |
| 11 | **移動 5 code**（`dash_forward`/`dash_back`/`jump_*`） | **5 code。一致** | **合っていた** |
| 12 | **`000025` は 12 キャラにしか INSERT していない** | `000025` 適用時点の `characters` 行数は本調査では復元していない。**確かめられなかった**（`000025` までを適用した DB を別途作れば確かめられるが、本調査では作っていない） | **確かめられなかった** |

---

## §4 想定外の発見（事実のみ・§0.3 の範囲）

| # | 発見 |
|---|---|
| **1** | **★指示書 §2.1 の errata が M25-RESEARCH-01 を誤って要約している。** errata は「`characters` は 31 行。`moves` が 1 行以上ある `character_id` は 19。⇒ 残り 12」と書くが、M25 報告 §4.3 の本文は **「マイグレーションの最終状態で characters と moves を持つ seed 済みは19体」「全31体との差は12体」** であり、**`characters` が 31 行だとは書いていない**。実測は 19 行。 |
| **2** | **★M25-RESEARCH-01 §4.3 の「seed 済み19」は仮登録 2 体を含む。** 同報告は「旧記録の17は manon と c_viper/dhalsim の扱いを数え違えており……これで『差2』は説明できる」と結論しているが、**実測では旧記録の 17 のほうが「本 seed 済み」として正しく、`c_viper`/`dhalsim` は仮登録のままである**（§2.1-2・§2.3-4）。**⇒ 「差 2」の説明は成立するが、その内訳が違う。** |
| **3** | **★`M14-overview.md` §3 の「5〜6 段」は、それが書かれた 2026-08-01 時点の第三波実績（9 段）に対しても既に不足していた**（`is_derived` backfill・`move_commands`・`chain_cancel_total`・frame_cost の 4 段が表に無い）。§3 の同注記は「M14-03d の実測により確定」と書いており、**第二波（6 段）を基準にしている**。 |
| **4** | **★`000062` のヘッダが、本調査の主題そのものを 2026-08-02 時点で一般化して書き残している。** 逐語＝**「一般化: 『1 回きりの backfill マイグレ』は、その後に INSERT される行を拾えない。取り残しはエラーにならず、unknown / false のまま静かに残る。……→ 今後の seed 波は、既存の backfill マイグレの内容を自波の行にも適用すること。」** ただし**この一般化は followup にも `M14-overview` にも転記されていない**（`grep` で両ファイルに該当記述 0 件）。 |
| **5** | **★`chain-cancel-measurements.md` の「確定値 55 件・18 キャラ」のうち 2 件・1 キャラ（`elena`）が未投入。** DB 実測 53 件・17 キャラ。`elena` は未 seed 12 に含まれるため、**第四波の工程に `chain_cancel_total` 2 行が確定して存在する**（§2.2-9 (B) #8）。 |
| **6** | **★`seed-progress.md` の「seed 波ごとに再適用する規則」節は P-34（層 C-3）の 2 本を挙げていない。** 同節は `numeric` / `srk` の 2 本のみを書くが、`000076` / `000077`（M20-06・`-noinput-only`）のヘッダは同じ再適用要求を持つ。**⇒ 手順どおりに実行すると P-34 の 2 本が落ちる。** |
| **7** | **★`move_derivations` は seed 波が一度も投入していない**（母数 3 本の投入元はすべて M19-04 系の人手判断 backfill と zangief 連打版）。第三波キャラの 46 行は `000064` / `000067` が入れたものであり、**第三波の down（`000055.down`）は `move_derivations` に触れない**。ただし head からの順次ロールバックでは `000067.down` / `000064.down` が先に走って削除する（§2.2-8）。 |
| **8** | **★`characters.id` に 2 / 3 / 4 の欠番、`presets.id` に 2 / 4 の欠番がある。** 第四波で `characters` へ INSERT すると id は 23 から採番される。**本調査では欠番の原因を追跡していない。** |
| **9** | **★`docs/handover/code-facts.md` は鮮度が保たれている**（生成 2026-09-01 / commit `4063d61`）。§10 のマイグレ一覧は `000080` まで載っている。`m14-03d-completion-report.md` §5-9 が指摘していた「`000042` で止まっている」問題は解消済み。 |
| **10** | **★`setup_only` は 19 キャラ全体で 0 件**（母数 1653 moves）。CSV に対応列が無く、投入経路が現時点で存在しない。 |

---

## §5 確かめられなかったこと（推測で埋めていない項目）

| # | 項目 | 理由 |
|---|---|---|
| 1 | **`c_viper` / `dhalsim` の UNIQUE 衝突による起動不能経路が現在も成立するか**（§2.3-4） | 判定には seedgen を回して生成物を作り、`000075` の UNIQUE 下でマイグレを適用する必要がある。指示書 §4「やらないこと」#2/#3 に触れるため実行していない |
| 2 | **`000025` 適用時点の `characters` 行数が 12 だったか**（§3 #12） | `000025` までを適用した DB を作れば確かめられるが、本調査では作っていない |
| 3 | **過去 2 波の実所要（wall-clock）**（§2.4-1） | 完了報告 2 本に記録が無い（探し方は §2.4-1 に記載） |
| 4 | **1 波の適用に要する時間**（§2.4-4） | 計測していない |
| 5 | **未 seed 12 キャラのうち `custom_states` が要るキャラ**（`yasmine` 以外の 11）（§2.2-5） | リポジトリ内に判定材料が無い（CSV に列なし・migrations に記載なし・`docs/seed-data/` に記載なし） |
| 6 | **`numeric` / `srk` / P-34 のエイリアスが第四波で何行になるか**（§2.4-3） | seedgen を回さないと確定しない（生成物の作成にあたる） |
| 7 | **残渣依存 E2E spec が `combo-csv-io` 以外に在るか**（§2.3-6） | 60 spec の全数走査は行っていない。キャラ code 直書きの部分的確認にとどまる |
| 8 | **`architecture-patterns.md` §11 の規約 (i) の内容**（§2.3-2） | `followup-backlog.md` の記述を引くにとどめた |
| 9 | **`precheck_seed_data` の参照先の内容が現況と合っているか**（§2.3-5） | 実在確認のみ行った |
| 10 | **開発者の dev DB・配布済み DB の状態** | 本調査の実測はすべて新規クリーン DB（§1 の限界） |

---

## §6 差分 0 の確認（完了条件 #6）

```bash
$ git status --short
docs/progress/M14-RESEARCH-03-report.md   （本レポートのみ・新規）
$ git diff --stat
（既存ファイルへの変更 0）
```

- **`migrations/` / `internal/` / `web/` / `character_data/` / `docs/design/` / `docs/handover/followup-backlog.md` は 1 バイトも変更していない。**
- スクラッチ DB（`scratch.db` / `at59.db`）と補助スクリプトはすべてセッション scratchpad 配下にあり、リポジトリ外である。
- 追記した `docs/progress/progress-log.md` は `CLAUDE.md` §8 の要求による（完了条件 #7）。

---

## §7 followup-backlog への登録候補（★本レポートは登録しない。`D-382`）

`CLAUDE.md` §10.Y／`D-382` により、製造が直接書けるのは `followup-backlog.md` §J のみである。以下は**設計卓が畳むための候補**として列挙する（本調査では `followup-backlog.md` を編集していない）。

| # | 候補 | 根拠（本レポートの節） |
|---|---|---|
| 1 | `combo-csv-io-ken` は失効。閉じる候補 | §2.3-1 |
| 2 | 「残キャラ網羅表」の数値更新（CSV 17 → 31・手入力待ち 13 → 0） | §2.3-3 |
| 3 | `M14-03b-custom-states-stock` (a) は解消・母数は 4 ではなく 5 | §2.2-5 / §2.3-3 |
| 4 | `M14-overview.md` §3 の「5〜6 段」を as-built（13 段）へ同期 | §2.2-1 / §2.4-3 |
| 5 | `seed-progress.md` の手順に P-34 の 2 本が無い | §4-6 |
| 6 | `000062` の一般化が followup / overview へ転記されていない | §4-4 |
| 7 | `elena` の `chain_cancel_total` 2 行が第四波の確定工程として存在する | §4-5 |
| 8 | `yasmine` の `custom_states` 定義（種別・値域・増減）が未作成 | §2.2-5 |
| 9 | 移動 5 code の `total` は 14 キャラ分の実測値受領が前提（開発者の手番） | §2.2-4 |

---

*以上*
