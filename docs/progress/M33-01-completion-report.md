# M33-01 完了報告 — 凍結と実測（**統合の前に、消してよいものを数え切る**）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M33-01** |
| 指示書 | `docs/instructions/M33-01-freeze-and-survey.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M33-01-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-13 |
| **凍結点** | **`5576126`**（後述 §1） |
| CHANGE 消費 | **0 本** |
| マイグレ消費 | **0 本**（`migrations/` の差分 **0 バイト**） |
| 成果物 | **本報告 1 ファイルのみ**（＋ `progress-log.md` の索引行） |

> **★★本サブは「作らない」サブである。⇒ 7 群を作るのは `M33-02` である。**
>
> **★★成果は数である。⇒ 全項目を式で数え、式そのものを本報告に残した。**

---

## 0. 数値の読み方（**`M-157`・チェックリスト A-6**）

| 印 | 意味 |
|---|---|
| **実測** | **この手番でコマンドを回して得た値。式を併記してある** |
| **算出** | **実測値から計算した値**（例＝`40 − 2 = 38`） |
| **引用** | **他資料に書いてある値。この手番では確かめていない** |

**★断りの無い数値はすべて実測である。**

---

## 1. 凍結点（指示書 §2.1 ／ チェックリスト B-1 B-2 B-5 E-6）

### 1.1 ★着手前の版ゲート（指示書 §0.6・**3 点とも通過**）

| # | 確かめたこと | 結果 |
|---|---|---|
| **1** | `docs/instructions/reviews/M33-01-review-checklist.md` の存在 | **✅ 存在**（8198 バイト・v1.0.0・2026-09-13 発行） |
| **2** | 本指示書が v1.1.0 以上（**§0.5 と §0.6 が在るか**） | **✅ v1.1.0**。§0.5（凍結点の寿命）／ §0.6（版ゲート）を実物で確認 |
| **3** | `M30-07` / `M32-01` が `main` に着地 | **✅ 両方とも着地済み**（下記） |

```
$ git log --oneline -5
5576126 Merge pull request #210 from plexiblinp/claude/adoring-thompson-hl2142
4c9ac99 docs: M37-RESEARCH-01 を発行し、M36/M37 の確認事項 6 件を決着させる（D-855）
4d99cb4 docs: M37 を起票し、M33-01 のチェックリストを発行する（D-854）
73746a7 docs: リリース前要望の束を受理し M36 を起票する（D-853・M-170）
e8c9baa Merge pull request #209 from plexiblinp/claude/optimistic-bell-j9uzl0
```

- **`M30-07`** ＝ `e8c9baa`（PR #209）で着地。受理は `0fb9f01`（`D-852`）
- **`M32-01`** ＝ `0bdf0ca`（PR #206）で着地。受理は `e9fd85c`（`D-847`）
- **⇒ 凍結点の母集団は両サブを含む。指示書 §0.6-3 の「着地前なら明記」に当たらない。**

### 1.2 ★★投入順序の条件（指示書 §0.4）も満たしている

**★指示書は「`migrations/` へ版を足す 4 本が着地してから投入せよ」と言う。⇒ 4 本とも着地済みである。**

| サブ | 着地の証跡（完了報告） | 消費したマイグレ（`migrations/` に実在） |
|---|---|---|
| `M30-02` | `docs/progress/M30-02-completion-report.md` | `000107` |
| `M31-04` | `docs/progress/M31-04-completion-report.md` | `000109` |
| `M31-05` | `docs/progress/M31-05-completion-report.md` | `000110` |
| `M35-02` | `docs/progress/M35-02-completion-report.md` | `000108` |

**★あわせて `M28-05`（`000106`）／ `M35-03`（`000111`）／ `M30-07`（`000112`）も着地している。⇒ `migrations/` の最大は `000112` であり、ボード §2.1 の「次のマイグレ連番 ＝ `000113`」と一致する。**

### 1.3 ★★凍結点

**★★凍結点 ＝ `5576126`**（作業ブランチ `claude/upbeat-galileo-ejyts1` の枝元）。
**⇒ 以後 `M33-02` / `M33-03` はこの SHA を基準に語ること。★「HEAD」「最新」と書かない。**

### 1.4 `migrations/` の実測

**★★母集団を 1 行で書く**（`M-145`）——**本節が数えているのは `migrations/` に在るファイルであり、`schema_migrations` の行ではない。**

```bash
# 式1: up / down の本数
ls migrations/*.up.sql   | wc -l          # -> 111
ls migrations/*.down.sql | wc -l          # -> 111

# 式2: up と down が 1 対 1 か(差が出ないこと)
comm -3 <(ls migrations/*.up.sql   | sed 's|.*/||; s|\.up\.sql$||'   | sort) \
        <(ls migrations/*.down.sql | sed 's|.*/||; s|\.down\.sql$||' | sort)
#   -> 出力なし(＝対の欠けは 0 件)

# 式3: 連番の最小・最大
ls migrations/*.up.sql | sed 's|.*/||' | cut -d_ -f1 | sort -n | sed -n '1p;$p'
#   -> 000001 / 000112

# 式4: 欠番の全数
ls migrations/*.up.sql | sed 's|.*/||' | cut -d_ -f1 | sort -n \
  | awk '{n=$1+0; if(prev && n!=prev+1){for(i=prev+1;i<n;i++) printf "%06d\n", i} prev=n}'
#   -> 000012   (1 件のみ)
```

| 項目 | 値 | 種別 |
|---|---|---|
| `*.up.sql` | **111 本** | 実測 |
| `*.down.sql` | **111 本** | 実測 |
| up と down の対の欠け | **0 件** | 実測 |
| 連番の最小 / 最大 | **`000001` / `000112`** | 実測 |
| **欠番** | **`000012` の 1 件のみ** | 実測 |
| 検算（`112 − 1 = 111`） | **一致** | 算出 |

### 1.5 ★★`SUPP-001` §2.7 との突き合わせ（指示書 §2.1-3 ／ チェックリスト B-2）

| 項目 | `SUPP-001` §2.7（**引用**・2026-09-06 実測） | 本サブ（**実測**・2026-09-13） | 判定 |
|---|---|---|---|
| `*.up.sql` の本数 | **102 本** | **111 本** | **★食い違う（＋9）** |
| 連番の範囲 | `000001`〜`000103` | `000001`〜`000112` | **★食い違う** |
| **欠番** | **`000012` の 1 件のみ** | **`000012` の 1 件のみ** | **一致** |
| 欠番の理由 | `000012_seed_combos_durability` を 2026-09-05 に削除（由来が AI 生成または公式 HTML 由来の疑い） | — | **本サブは理由を検証していない** |

**★★食い違いの機序は判明している**——**`SUPP-001` §2.7 の実測日**（2026-09-06）**以降に `000104`〜`000112` の 9 本が足されたためである。**

```bash
# 式5: 2026-09-06 以降に足された up マイグレ
git log --since=2026-09-06 --diff-filter=A --name-only --pretty=format:'%h %ad %s' --date=short \
  -- 'migrations/*.up.sql'
```

| 番号 | 由来サブ |
|---|---|
| `000104` / `000105` | **`M28-02a`**（`40b6cfc`・PR #155・**2026-09-06 マージ**。**★`SUPP-001` §2.7 の実測と同日であり、実測がマージ前だったため範囲外になった**） |
| `000106` | `M28-05` |
| `000107` | `M30-02` |
| `000108` | `M35-02` |
| `000109` | `M31-04` |
| `000110` | `M31-05` |
| `000111` | `M35-03` |
| `000112` | `M30-07` |

**★★どちらが正かは本サブでは決めない**（指示書 §2.1-3 / §3-5）**。⇒ `SUPP-001` §2.7 の本数と範囲は設計卓の手番で as-built 化が要る。★欠番が `000012` の 1 件だけである点は今日も成立している。**

### 1.6 ★★★凍結点の寿命（指示書 §0.5 ／ チェックリスト B-5）

> **★★★本報告の対応表・3 つの一覧・基準 DB のハッシュは、すべて凍結点 `5576126` 時点のものである。**
>
> **★★以後 `migrations/` に版が足されたら、その分を追記すること。⇒ 本表を「最新である」と読まないこと。**
>
> **★安いのは「行が増えるだけで、既存行は動かない」からである。⇒ 追記で追いつく。作り直しにはならない。**
>
> **★★`M33-02` / `M33-03` は事情が違う**（実際に統合するため、後からマイグレが足されると**作り直し**になる）**。⇒ 本サブの「並列可」をあちらへ引き写さないこと。**

---

## 2. 対応表 — 旧 111 本が 7 群のどこへ行くか（指示書 §2.2 ／ チェックリスト B-3 B-4）

### 2.1 ★7 群の定義（`M33-overview` §0.5.3 ／ 調査 `01-squash-proposal.md:31-39`）

| 群 | 中身 | 設計卓が当てた層 |
|---|---|---|
| **S01** | 最終スキーマ | **A**（`AGPL-3.0-or-later`） |
| **S02** | games・characters・custom_states | **B**（`CC-BY-SA-4.0`） |
| **S03** | moves | **B** |
| **S04** | move_commands | **B** |
| **S05** | move_derivations | **B** |
| **S06** | presets・preset_aliases | **B** |
| **S07** | 初期 users・tags | **A** |

**★`S01`〜`S07` は論理 ID であり、払い出した番号ではない。**
**★`custom_states` は表ではない**——`characters` の JSON `TEXT` 列（`migrations/000001_init_schema.up.sql:31`）**。⇒ `M33-02` で表を作らないこと。**

### 2.2 ★★判定に使った式（**目視で割り当てていない**）

**★★各 up SQL から「書き込む表」と「DDL する表」を機械抽出し、表 → 群の対応で割り当てた。**

```python
# 式6: docs/progress/ には置いていない使い捨てスクリプト。以下が本体である。
#      コメント(-- ...)を落としてから字句走査する(check-migration-license.sh と同じ方針)。
WRITE = r'\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+(?:main\.)?[`"\[]?([A-Za-z_][A-Za-z0-9_]*)'
DDL   = r'\b(CREATE\s+(?:TEMP\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+INDEX(?:\s+IF\s+EXISTS)?)\s+(?:main\.)?[`"\[]?([A-Za-z_][A-Za-z0-9_]*)'

# 表 -> 群
{'games':'S02','characters':'S02','moves':'S03','move_commands':'S04',
 'move_derivations':'S05','presets':'S06','preset_aliases':'S06',
 'users':'S07','tags':'S07'}
# DDL を 1 つでも持てば S01 を加える(最終スキーマへ畳まれるため)
# combos / combo_* / setups / setup_steps だけへ書くものは「新規 DB では 0 行」= 廃止候補
```

**⇒ 111 行すべてを機械割当した後、調査資料 `01-migration-map.csv` の `target` 列と突き合わせ、食い違った行・廃止 7 本・新規 7 行だけを実物の SQL で精査した。**

### 2.3 ★★この式の限界（**過信しないこと**）

| # | 見えないもの | 実際に踏んだ例 |
|---|---|---|
| **1** | **列の `DEFAULT` に埋め込まれた値** | **`000104` は `ALTER TABLE games ADD COLUMN current_data_version TEXT NOT NULL DEFAULT '2026.08.03.01'`。⇒ `INSERT` が無いので式は `S02` を出さないが、`games` の値は確かに入る。調査資料は `S01,S02` と正しく書いていた** |
| 2 | 動的 SQL・トリガ経由の書き込み | 本 repo には無い（トリガ 0 件・実測） |
| 3 | `INSERT ... SELECT` が新規 DB で 0 行に当たるか | **式では区別できない。⇒ 廃止候補は実物で確かめた**（§2.5） |

### 2.4 ★★対応表（**1 行 1 本・全 111 行**）

**★「差」欄の `★` は調査資料と食い違った行である。⇒ 10 行**（内訳＝食い違い 3 行 ＋ 調査資料に無い新規 7 行）**。**

| 旧番号 | 名称 | 吸収先(本サブの判定) | 実測層 | 調査資料の target | 差 |
|---|---|---|---|---|---|
| `000001` | init_schema | **S01** | A | S01 | — |
| `000002` | seed_games | **S02** | A | S02 | — |
| `000003` | seed_characters | **S02** | B | S02 | — |
| `000004` | seed_moves_ryu | **S03** | B | S03 | — |
| `000005` | seed_presets | **S06** | A | S06 | — |
| `000006` | seed_aliases_official_ja_move | **S06** | B | S06 | — |
| `000007` | seed_initial_tags_user1 | **S07** | A | S07 | — |
| `000008` | drop_gauge_consumed_total | **S01** | A | S01 | — |
| `000009` | seed_characters_aki_jamie_guile | **S02** | B | S02 | — |
| `000010` | seed_moves_aki_jamie_guile | **廃止** | B | 廃止 | — |
| `000011` | seed_aliases_official_ja_move_aki_jamie_guile | **廃止** | B | 廃止 | — |
| `000013` | add_moves_frame_columns | **S01** | A | S01 | — |
| `000014` | seed_characters_classic5 | **S02** | B | S02 | — |
| `000015` | seed_custom_states_classic3 | **S02** | B | S02 | — |
| `000016` | change_drive_damage_to_real | **S01** | A | S01 | — |
| `000017` | cleanup_ajg_seed_and_unify_ryu_move_code | **S02,S03,S06** | B | S02,S03,S06 | — |
| `000018` | cleanup_moves_unobservable_columns | **S01,S03** | A | S01 | ★ |
| `000019` | change_drive_available_at_start_to_real | **S01** | A | S01 | — |
| `000020` | add_gauge_consumed_columns | **S01** | A | S01 | — |
| `000021` | normalize_combo_oki_options | **S01** | A | S01 | — |
| `000022` | unify_dash_to_system_move | **廃止** | A | 廃止 | — |
| `000023` | add_show_delta_ingrid_sun_crest | **S02** | B | S02 | — |
| `000024` | seed_characters_first_wave | **S02** | B | S02 | — |
| `000025` | seed_movement_system_moves_all | **S03,S06** | B | S03,S06 | — |
| `000026` | seed_moves_first_wave | **S03,S06** | B | S03,S06 | — |
| `000027` | seed_custom_states_first_wave | **S02** | B | S02 | — |
| `000028` | sweep_modifier_dash | **廃止** | A | 廃止 | — |
| `000029` | clear_ryu_legacy_seed | **廃止** | B | 廃止 | — |
| `000030` | seed_moves_ryu | **S03,S06** | B | S03,S06 | — |
| `000031` | add_combo_media | **S01** | A | S01 | — |
| `000032` | add_moves_is_derived | **S01** | A | S01 | — |
| `000033` | create_move_commands | **S01** | A | S01 | — |
| `000034` | backfill_moves_is_derived | **S03** | B | S03 | — |
| `000035` | seed_move_commands | **S04** | B | S04 | — |
| `000036` | create_combo_punishes | **S01** | A | S01 | — |
| `000037` | create_combo_punish_prunings_and_curations | **S01** | A | S01 | — |
| `000038` | add_combos_materialized_from | **S01** | A | S01 | — |
| `000039` | add_moves_is_projectile | **S01,S03** | B | S01,S03 | — |
| `000040` | create_combo_punish_starters | **S01** | A | S01 | — |
| `000041` | backfill_movement_total | **S03** | B | S03 | — |
| `000042` | create_combo_setup_results | **S01** | A | S01 | — |
| `000043` | seed_characters_manon | **S02** | B | S02 | — |
| `000044` | seed_movement_system_moves_manon | **S03,S06** | B | S03,S06 | — |
| `000045` | seed_moves_manon | **S03,S06** | B | S03,S06 | — |
| `000046` | backfill_moves_is_derived_manon | **S03** | B | S03 | — |
| `000047` | seed_move_commands_manon | **S04** | B | S04 | — |
| `000048` | backfill_movement_total_manon | **S03** | B | S03 | — |
| `000049` | add_moves_frame_cost_columns | **S01** | A | S01 | — |
| `000050` | backfill_moves_frame_cost | **S03** | B | S03 | — |
| `000051` | seed_moves_zangief_rapid | **S03,S06** | B | S03,S06 | — |
| `000052` | backfill_moves_chain_cancel_total | **S03** | B | S03 | — |
| `000053` | seed_characters_third_wave | **S02** | B | S02 | — |
| `000054` | seed_movement_system_moves_third_wave | **S03,S06** | B | S03,S06 | — |
| `000055` | seed_moves_third_wave | **S03,S06** | B | S03,S06 | — |
| `000056` | backfill_moves_is_derived_third_wave | **S03** | B | S03 | — |
| `000057` | seed_move_commands_third_wave | **S04** | B | S04 | — |
| `000058` | backfill_moves_is_projectile_third_wave | **S03** | B | S03 | — |
| `000059` | backfill_movement_total_third_wave | **S03** | B | S03 | — |
| `000060` | backfill_moves_chain_cancel_total_third_wave | **S03** | B | S03 | — |
| `000061` | seed_move_derivations_zangief_rapid | **S05** | B | S05 | — |
| `000062` | backfill_moves_frame_cost_third_wave | **S03** | B | S03 | — |
| `000063` | correct_moves_data_m1904c | **S03** | B | S03 | — |
| `000064` | backfill_frame_cost_manual | **S03,S05** | B | S03,S05 | — |
| `000065` | correct_frame_values_phase2 | **S03** | B | S03 | — |
| `000066` | correct_jamie_freeflow_codes | **S03** | B | S03 | — |
| `000067` | backfill_frame_cost_manual_addendum | **S03,S05** | B | S03,S05 | — |
| `000068` | correct_fastest_unreachable_addendum | **S03** | B | S03 | — |
| `000069` | m20_initial_presets_three | **S06** | A | S06 | — |
| `000070` | m20_preset_aliases_add_alias_text_en | **S01** | A | S01,S06 | ★ |
| `000071` | m20_seed_move_commands_od4 | **S04** | B | S04 | — |
| `000072` | m20_seed_aliases_numeric | **S06** | B | S06 | — |
| `000073` | m20_seed_aliases_srk | **S06** | B | S06 | — |
| `000074` | m20_preset_aliases_add_character_id | **S01,S06** | A | S01,S06 | — |
| `000075` | m20_preset_aliases_unique | **S01** | A | S01 | — |
| `000076` | m20_seed_aliases_p34_numeric | **S06** | B | S06 | — |
| `000077` | m20_seed_aliases_p34_srk | **S06** | B | S06 | — |
| `000078` | add_combos_superseded_by | **S01** | A | S01 | — |
| `000079` | fix_character_display_names | **S02** | B | S02 | — |
| `000080` | fix_ground_dash_label | **S06** | B | S06 | — |
| `000081` | rename_opponent_size_medium_to_standard | **廃止** | A | 廃止 | — |
| `000082` | seed_characters_fourth_wave | **S02** | B | S02 | — |
| `000083` | seed_movement_system_moves_fourth_wave | **S03,S06** | B | S03,S06 | — |
| `000084` | seed_moves_fourth_wave | **S03,S06** | B | S03,S06 | — |
| `000085` | backfill_moves_is_derived_fourth_wave | **S03** | B | S03 | — |
| `000086` | seed_move_commands_fourth_wave | **S04** | B | S04 | — |
| `000087` | backfill_moves_is_projectile_fourth_wave | **S03** | B | S03 | — |
| `000088` | backfill_moves_chain_cancel_total_fourth_wave | **S03** | B | S03 | — |
| `000089` | backfill_moves_frame_cost_fourth_wave | **S03** | B | S03 | — |
| `000090` | seed_aliases_numeric_fourth_wave | **S06** | B | S06 | — |
| `000091` | seed_aliases_srk_fourth_wave | **S06** | B | S06 | — |
| `000092` | backfill_movement_total_fourth_wave | **S03** | B | S03 | — |
| `000093` | seed_custom_states_fourth_wave | **S02** | B | S02 | — |
| `000094` | seed_custom_states_missing_seeded_chars | **S02** | B | S02 | — |
| `000095` | correct_kimberly_shuriken_bomb_max | **S02** | B | S02 | — |
| `000096` | add_combos_oki_verified | **S01** | A | S01 | — |
| `000097` | seed_moves_dhalsim_rapid | **S03,S06** | B | S03,S06 | — |
| `000098` | seed_move_derivations_dhalsim_rapid | **S05** | B | S05 | — |
| `000099` | backfill_moves_chain_cancel_total_fourth_wave_second_stage | **S03** | B | S03 | — |
| `000100` | rename_cammy_hooligan_combination_holding | **S03,S06** | B | S03,S06 | — |
| `000101` | seed_move_derivations_fourth_wave | **S05** | B | S05 | — |
| `000102` | seed_move_derivations_existing_chars | **S05** | B | S05 | — |
| `000103` | flip_drive_damage_sign | **廃止** | A | 廃止 | — |
| `000104` | add_game_update_tracking | **S01** | A | S01,S02 | ★ |
| `000105` | add_combos_position_mass | **S01** | A | S01 | — |
| `000106` | data_correct_terry_quick_burn_code | **S03** | B | —(調査資料に無い) | ★ |
| `000107` | data_correct_terry_round_wave_code | **S03** | B | —(調査資料に無い) | ★ |
| `000108` | data_correct_ryu_axe_kick_code | **S03** | B | —(調査資料に無い) | ★ |
| `000109` | data_seed_drive_reversal_system_move | **S03,S06** | B | —(調査資料に無い) | ★ |
| `000110` | data_seed_custom_states_placement_expansion | **S02** | B | —(調査資料に無い) | ★ |
| `000111` | data_correct_rush_original_move_refs | **S03,S06** | B | —(調査資料に無い) | ★ |
| `000112` | data_correct_guile_perfect_variant_codes | **S03,S05** | B | —(調査資料に無い) | ★ |

### 2.5 ★★独立処理を廃止できる 7 本 — **実物で裏を取った**（指示書 §2.2-2）

**★調査資料の主張であり、本サブが実物の SQL を読んで確かめた。⇒ 7 本すべて成立する。**

| 旧番号 | 実物の SQL が何をするか（**実測**） | 廃止してよい理由 |
|---|---|---|
| **`000010`** | `INSERT INTO moves`（aki / jamie / guile の旧技） | **`000017` が `DELETE FROM moves WHERE character_id IN (… 'aki','jamie','guile')` で全撤去する。⇒ 生存行 0** |
| **`000011`** | `INSERT INTO preset_aliases`（同 3 キャラの旧 alias） | **同上（`000017` が `DELETE FROM preset_aliases`）。⇒ 生存行 0** |
| **`000022`** | `UPDATE combo_steps` / `UPDATE setup_steps` のみ | **ユーザーデータ表だけを触る。⇒ 新規 DB では 0 行に当たる** |
| **`000028`** | `UPDATE combo_steps` / `UPDATE setup_steps` ＋ `CREATE TEMP TABLE _dash_sweep_check` → `INSERT INTO _dash_sweep_check` → `DROP` | **同上。★`TEMP` 表は本体スキーマに残らない**（基準 DB の `sqlite_master` にも無い＝実測） |
| **`000029`** | ryu 旧データの掃討（`DELETE FROM` combos 系 ＋ moves / preset_aliases） | **掃討であり、最終データは `000030` 以降が投入する。⇒ 新規 DB に不要** |
| **`000081`** | `UPDATE combos`（opponent_size medium→standard）のみ | **ユーザーデータ表だけ。⇒ 0 行に当たる** |
| **`000103`** | `UPDATE combos SET drive_damage = -drive_damage …` のみ | **同上。⇒ 0 行に当たる** |

> **★★「廃止」は*変換規則の廃止*ではない**（調査 `02-live-document-impact.md:99` の警告と同じ）。
> **`000081` / `000103` は、旧 DB・旧 CSV を受け入れる経路では規則として生き続ける。⇒ 消えるのは「独立したマイグレとして毎回走らせること」だけである。**

### 2.6 ★★★調査資料が挙げていない 8 本目の廃止候補 ＝ **`000009`**（**本サブの最大の成果**）

**★★★`000009_seed_characters_aki_jamie_guile` の投入行は、1 行も生存しない。⇒ 調査資料は本 1 本を「S02」に分類しており、廃止候補に挙げていない。**

**根拠（すべて実測）:**

```bash
# 式7: 000009 が入れるキャラ
grep -oE "'(aki|jamie|guile)'" migrations/000009_*.up.sql | sort -u
#   -> 'aki' 'guile' 'jamie'   (3 件)

# 式8: 000017 がそれを消すか
grep -A1 "DELETE FROM characters" migrations/000017_*.up.sql
#   -> DELETE FROM characters WHERE code IN ('aki', 'jamie', 'guile');   ⇒ 3 件とも消える

# 式9: どこで復活するか
grep -lE "'(aki|jamie)'" migrations/0000*_seed_characters*.up.sql
#   -> 000009(旧) / 000053(jamie) / 000082(aki)
grep -oE "'guile'" migrations/000024_*.up.sql | head -1
#   -> 'guile'   (000024 = 第一波)
```

| キャラ | `000009` で投入 | `000017` で削除 | **最終行の出所** |
|---|---|---|---|
| guile | ✅ | ✅ | **`000024`**（第一波） |
| jamie | ✅ | ✅ | **`000053`**（第三波） |
| aki | ✅ | ✅ | **`000082`**（第四波） |

**⇒ `000009` の生存行は 0 である。⇒ データ seed としては `000010` / `000011` と同型であり、廃止できる。**

> **★★★ただし「純粋な no-op」ではない。ここが本件の要である。**
>
> **`characters` は `AUTOINCREMENT` である。⇒ `000009` が消費した 3 つの id は、行が消えても `sqlite_sequence` に残る。**
>
> **実測（基準 DB）＝`characters` は 行 31 / `seq` 34。★差の 3 が、まさに `000009` の 3 行である。**
>
> **⇒ `M33-02` が `S02` を作るとき、`000009` を単に「無かったこと」にすると `sqlite_sequence` が 34 にならず、調査資料の完了条件 3（`sequence_equal`）が落ちる。★「廃止できる」と「書かなくてよい」は別である。**

### 2.7 ★調査資料と食い違った行（3 行）— **実物で精査した**

| 旧番号 | 本サブの判定 | 調査資料 | 精査の結果 |
|---|---|---|---|
| **`000018`** | **S01,S03** | S01 | **★本サブが正しいと考える。** 同マイグレは `ALTER TABLE moves DROP/ADD COLUMN`（S01）に加えて **`UPDATE moves SET raw_data = json_remove(…)` を持つ**（実測）。**⇒ `moves.raw_data` の最終値を形づくるため S03 にも掛かる。★調査資料は列操作だけを見て S01 に寄せている** |
| **`000070`** | **S01** | S01,S06 | **★調査資料の分類が広い。** 実体は `ALTER TABLE preset_aliases ADD COLUMN alias_text_en TEXT;` **1 文のみ**（実測）＝**純粋な DDL でありデータを 1 行も入れない。⇒ S06 が挙がるのは「この列の値は S06 が供給する」という意味であり、本マイグレ自身の吸収先ではない。★分類の粒度の違いであって誤りではない** |
| **`000104`** | **S01** | S01,S02 | **★調査資料が正しい。本サブの式の限界である**（§2.3-1）。`ALTER TABLE games ADD COLUMN current_data_version TEXT NOT NULL DEFAULT '2026.08.03.01'` の **`DEFAULT` に games の値が埋まっている**。**⇒ `INSERT` が無いため式は検出できなかった。★`M33-02` は `S02` 側で `current_data_version` を供給すること** |

**★★食い違い 3 行のうち、本サブの式が取り落としたのは `000104` の 1 行である。⇒ 式の限界を §2.3 に明記した。**

### 2.8 ★★層の交差検証 — **`S02` と `S06` は層が混ざった群である**（**重大**）

**★★チェックリスト A-5 は「層の仕分けは `check-migration-license.sh` の `GAME_TABLES` だけが基準」と言う。⇒ その基準で 7 群を検算した。**

```bash
# 式10: 各行の「吸収先の群が持つ層」と「--list が出した実測層」を突き合わせる
#   S01/S07 -> A、S02..S06 -> B として期待値を作り、実測層と比較する
#   -> 吸収先に S 群を持つ 104 行(= 111 - 廃止 7)のうち 食い違い 3 件
```

| 旧番号 | 吸収先 | 群の層（期待） | **実測層** | 書き込む表 |
|---|---|---|---|---|
| `000002` | **S02** | B | **A** | `games` |
| `000005` | **S06** | B | **A** | `presets` |
| `000069` | **S06** | B | **A** | `presets` |

#### ★★【レビュー 高-4 の是正】上の 3 件は全数ではない — **厳密条件では 5 行**

**★★★上の緩い条件には穴がある**——**`S01,S03` のように A 群と B 群を併せ持つ行は期待値が `{A, B}` になり、実測層が何であっても通ってしまう。⇒ 多群行を素通しする。**

```bash
# 式10（★実行可能な形。レビュー 中-4 の是正）
#   厳密条件＝「吸収先に B 群(S02..S06)を 1 つでも含むなら、実測層は B であるべき」
python3 - <<'PY2'
import json
SP='<scratch>'                                   # assign.json / layer.txt の置き場
assign=json.load(open(SP+'/assign.json'))        # {num: {'grp':[...], ...}}
layer=dict(l.split() for l in open(SP+'/layer.txt'))   # {num: 'A'|'B'}
B={'S02','S03','S04','S05','S06'}
for num in sorted(assign):
    g={x for x in assign[num]['grp'] if x.startswith('S')}
    if g & B and layer[num]!='B':
        print(num, ','.join(sorted(g)), '実測層='+layer[num])
PY2
#   -> 000002 S02 実測層=A / 000005 S06 実測層=A / 000018 S01,S03 実測層=A
#      000069 S06 実測層=A / 000074 S01,S06 実測層=A        (5 行)
```

| 旧番号 | 吸収先 | **実測層** | B 群 | 書き込む表 |
|---|---|---|---|---|
| `000002` | S02 | **A** | S02 | `games` |
| `000005` | S06 | **A** | S06 | `presets` |
| **`000018`** | **S01,S03** | **A** | **S03** | **`moves`**（`UPDATE moves SET raw_data = json_remove(…)`） |
| `000069` | S06 | **A** | S06 | `presets` |
| **`000074`** | **S01,S06** | **A** | **S06** | **`preset_aliases`**（`UPDATE preset_aliases SET character_id = …`） |

#### ★★★`000018` / `000074` は「凍結表の据置きだけで緑になっている 2 本」である（**最も重い事実**）

```bash
# 式10b: 全 111 本のうち GAME_TABLES へ書きながら層 A に解決するもの
#   (式6 の WRITE 正規表現で書込表を取り、GAME_TABLES との積が空でなく、--list の層が A の行)
#   -> 000018 -> moves
#      000074 -> preset_aliases          (2 件・実測)
```

**★★この 2 本は `GAME_TABLES` へ書くのに層 A である。⇒ 規則 (4) の「★静かな漏れ」判定に当たれば赤になるはずの形である。**

**★★★赤くならない理由＝両方とも凍結表に在るからである。** `check-migration-license.sh` の規則 (3) は凍結表の行を「表どおりか」だけで判定し、**規則 (4)（`_data_` と `GAME_TABLES` を見る本体）は凍結表に*無い*ファイルにしか当たらない。**

**⇒ `M33` は 111 本を 7 本へ潰す作業であり、その瞬間に凍結表の据置きが全部消える。⇒ この 2 本の効果は、規則 (4) の判定を受ける新しい群のどこかへ入る。**

**★分割で正しく分かれるか**——`000018` は DDL 部が `S01`（層 A）／ `raw_data` の最終値が `S03`（層 B）、`000074` は `ALTER` が `S01`（層 A）／ `character_id` の値が `S06`（層 B）**である。⇒ 分割すれば整合するが、分割しなければ層をまたぐ。★これも設計卓へ回す判断の一部である**（§11 原稿 1）。

**機序（実測）:**

```bash
# 式11: GAME_TABLES(層 B の唯一の基準)
sed -n '102,103p' scripts/check-migration-license.sh
#   GAME_TABLES = ("characters", "moves", "move_commands", "move_derivations",
#                  "preset_aliases", "custom_states")
```

| 表 | `GAME_TABLES` に在るか | ⇒ 層 |
|---|---|---|
| `characters` / `preset_aliases` | **在る** | **B** |
| **`games`** | **無い** | **A** |
| **`presets`** | **無い** | **A** |
| `users` / `tags` | 無い | A（＝S07 が層 A である理由。**整合している**） |

**⇒ 設計卓の 7 群定義は、`GAME_TABLES` の基準で見ると次の 2 群が層をまたいでいる。**

| 群 | 層 A 側の表 | 層 B 側の表 |
|---|---|---|
| **S02** | **`games`** | `characters` / `custom_states` |
| **S06** | **`presets`** | `preset_aliases` |

> **★★★しかも機械検査はこの向きを検出しない。**
>
> `check-migration-license.sh` の規則 (4) は——**(a) `_data_` を持つなら層 B に解決すること ／ (b) `_data_` を持たないなら層 A に解決し、かつ `GAME_TABLES` へ書かないこと**——である。
>
> **⇒ `NNNNNN_data_seed_games_characters.up.sql` は (a) を満たすため*緑になる*。`games` が層 A の表であることは見ない。**
>
> **★つまり `M33-02` が S02 / S06 を素直に 1 本ずつ作ると、`games` と `presets`**（アプリの設計物であって SF6 の事実ではない）**が `CC-BY-SA-4.0` へ静かに移る。⇒ 検査は緑のままである。**
>
> **★★開発者逐語の前例＝「一度 AGPL 化してから CC BY SA に戻すのは難しい認識」**（`check-migration-license.sh` ヘッダ）**。⇒ 向きは逆だが、戻しにくさは同じである。**
>
> **★★★これは `M33-overview` §2.3 の危険（ライセンスの層が混ざる）そのものであり、`M33-02` の着手前に設計卓の判断が要る。⇒ 本サブの射程は「出すこと」までである**（指示書 §3-5）。

---

## 3. 3 つの一覧（指示書 §2.3 ／ チェックリスト A-1〜A-6）

### 3.1 一覧 1 — `Migrate` / `Steps` で歴史時点へ移動するコード

> **★使った式と件数（A-1）。★調査資料の 28 は「古く」かつ「範囲が狭い」——両方である。**

```bash
# 式12a: 調査資料と同一の式(research.py:151)。internal/infra/migration/*.go にディレクトリ限定
grep -lE "\.Migrate\(|\.Steps\(" internal/infra/migration/*.go | wc -l                      # -> 35

# 式12b: 同ディレクトリ・.Up( .Version( .Force( .Down( まで広げる
grep -lE "\.(Migrate|Steps|Force|Version|Up|Down)\(" internal/infra/migration/*.go | wc -l   # -> 38

# 式12c: リポジトリ全体
grep -rlE "\.(Migrate|Steps|Force|Version|Up|Down)\(" --include='*.go' . | wc -l             # -> 40

# 式12d: 12c のうちディレクトリ外の 2 本
grep -rlE "\.(Migrate|Steps|Force|Version|Up|Down)\(" --include='*.go' . | grep -v '^./internal/infra/migration/'
#   -> ./cmd/tacpendium/main.go
#      ./internal/infra/datadir/migrate_test.go
```

| 式の範囲 | 件数 | 種別 |
|---|---|---|
| 調査資料の記載（2026-09-06） | **28** | **引用** |
| **式12a**（調査と同一の式を今日回す） | **35** | 実測 |
| **式12b**（`.Up(` `.Version(` まで拡張・同ディレクトリ） | **38** | 実測 |
| **式12c**（リポジトリ全体） | **40** | 実測 |
| **★偽陽性 2 本を除いた実体** | **38** | **算出**（`40 − 2`） |

**★★偽陽性 2 本の根拠**——**`cmd/tacpendium/main.go:174` と `internal/infra/datadir/migrate_test.go` の `Migrate` は `internal/infra/datadir` パッケージの「OS データディレクトリ移設」であり、スキーマのマイグレーションではない。⇒ 同名の別サブシステムである。**

#### 28 → 35 の差分（**7 本ちょうど・消失は 0 本**）

```bash
# 式13: 調査資料の一覧(evidence-core-counts.json の historical_version_test_files)と今日を比較
comm -13 <(python3 -c "import json;print('\n'.join(sorted(json.load(open('docs/progress/20260906-squash-research/evidence-core-counts.json'))['historical_version_test_files'])))") \
         <(grep -lE "\.Migrate\(|\.Steps\(" internal/infra/migration/*.go | sort)
```

| 増えたファイル | 由来サブ | 消費したマイグレ |
|---|---|---|
| `internal/infra/migration/migrate_m2805_test.go` | `M28-05` | `000106` |
| `internal/infra/migration/migrate_m3002_test.go` | `M30-02` | `000107` |
| `internal/infra/migration/migrate_m3502_test.go` | `M35-02` | `000108` |
| `internal/infra/migration/migrate_m3104_test.go` | `M31-04` | `000109` |
| `internal/infra/migration/migrate_m3105_test.go` | `M31-05` | `000110` |
| `internal/infra/migration/migrate_m3503_test.go` | `M35-03` | `000111` |
| `internal/infra/migration/migrate_m3007_test.go` | `M30-07` | `000112` |

**★消えたファイルは 0 本**（`comm -23` の出力が空）**。⇒ 28 + 7 = 35 で閉じる。★新しいマイグレ 7 本と、新しい契約テスト 7 本が 1 対 1 で対応している。**

#### 12a と 12b の差（3 本）＝ **`Migrate`/`Steps` を使わず `Up()`/`Version()` だけを使うファイル**

| ファイル | 何をするか |
|---|---|
| **`internal/infra/migration/migrate.go`** | **★本番の実行器**（`m.Version()` → `m.Up()` → `m.Version()`）。**歴史時点へは動かない。前へ進むだけである** |
| `internal/infra/migration/migrate_head_test.go` | HEAD まで上げて宙ぶらりん FK が無いことを見る |
| `internal/infra/migration/csv_db_sync_test.go` | HEAD まで上げて CSV と DB の同期を見る |

**⇒ この 3 本は「歴史時点へ移動する」には当たらない。★ただし `M33-03` が旧履歴専用 FS を分けるときは触る側である。**

#### 版数の与え方の内訳（**`M33-03` の書き換え量に直結する**）

```bash
# 式14: 版数を直書きしている箇所
grep -rnE '\.(Migrate|Steps|Force)\(\s*-?[0-9]+\s*\)' --include='*.go' . | wc -l   # -> 135
grep -rlE '\.(Migrate|Steps|Force)\(\s*-?[0-9]+\s*\)' --include='*.go' . | wc -l   # -> 18(ファイル)

# 式15: .Force( と .Down( は使われているか
grep -rE "\.Force\(" --include='*.go' . | wc -l   # -> 0
grep -rE "\.Down\("  --include='*.go' . | wc -l   # -> 0
```

| 与え方 | 件数 | 備考 |
|---|---|---|
| **`Migrate(<裸の整数>)` / `Steps(<負の整数>)`** | **135 箇所 / 18 ファイル** | **★18 ファイルすべてが `internal/infra/migration/` 配下である**（同ディレクトリ外は 0 件＝実測）**。⇒ 統合で全滅する候補** |
| 名前付き定数（`m3007Terminus = 112` 等） | **20 ファイル**（式＝`grep -rlE '(Head\|Terminus\|Before\|Origin\|Version)\s*(uint[0-9]*)?\s*=\s*[0-9]+' --include='*_test.go' internal/infra/migration \| wc -l`） | **実体は直書きの整数である。⇒ 同じく書き換え対象** |
| **`versionBefore(t, N)` による動的導出** | `migrate_test.go:1502` 定義ほか | **★新しい規約。`migrations/` を読んで直前版を算出するため、版数を直書きしない**（同関数の godoc が「版数を直書きしないための道具」と明言） |
| **`.Force(` / `.Down(`** | **0 件** | 実測。**⇒ 統合で壊れる経路がそのぶん少ない** |

**★★総数・最大版数を assert するテストは存在しない**（実測。`migrate_head_test.go` も FK だけを見る）**。⇒ 「111 本」「`000112`」という数そのものを固定しているコードは無い。**

### 3.2 一覧 2 — golden 群が読む旧 SQL（チェックリスト A-4）

> **★★「golden がある」ではなく「どの SQL を byte 比較しているか」を出す。**

```bash
# 式16: migrations/ を os.ReadFile している箇所(= byte 比較の入口)
grep -rn 'os\.ReadFile' --include='*.go' . | grep -i migration
#   -> internal/seedgen/generate_test.go:224
#      internal/seedgen/generate_test.go:261
#      internal/seedgen/generate_m1702_test.go:127   (func assertGolden の中)

# 式17: byte 比較される stem の全数
{ grep -rhoE 'assertGolden\(t, "[0-9]{6}_[a-z0-9_]+"' --include='*.go' internal/seedgen \
    | sed -E 's/.*"([^"]+)".*/\1/'
  grep -rhoE '\{"[0-9]{6}_[a-z0-9_]+\.up\.sql", res\.UpSQL\}' --include='*.go' internal/seedgen \
    | sed -E 's/.*"([0-9]{6}_[a-z0-9_]+)\.up\.sql".*/\1/'
} | sort -u | wc -l          # -> 17
```

| 項目 | 値 | 種別 |
|---|---|---|
| `os.ReadFile` の箇所 | **3 箇所 / 2 ファイル** | 実測 |
| **byte 比較される stem** | **17** | 実測 |
| **byte 比較される SQL ファイル** | **34**（17 × up/down） | 算出 |
| 設計卓が把握していた本数（`M33-overview:163`） | **4**（`000026`/`000035`/`000072`/`000073`） | **引用** |

**★★食い違い＝設計卓は 4 本と見ていたが、実測は 17 stem である。**

#### 17 stem の全数（**すべて実測層 B**）

| stem | 実測層 |
|---|---|
| `000026_seed_moves_first_wave` | B |
| `000030_seed_moves_ryu` | B |
| `000034_backfill_moves_is_derived` | B |
| `000035_seed_move_commands` | B |
| `000045_seed_moves_manon` | B |
| `000046_backfill_moves_is_derived_manon` | B |
| `000047_seed_move_commands_manon` | B |
| `000055_seed_moves_third_wave` | B |
| `000056_backfill_moves_is_derived_third_wave` | B |
| `000057_seed_move_commands_third_wave` | B |
| `000072_m20_seed_aliases_numeric` | B |
| `000073_m20_seed_aliases_srk` | B |
| `000084_seed_moves_fourth_wave` | B |
| `000085_backfill_moves_is_derived_fourth_wave` | B |
| `000086_seed_move_commands_fourth_wave` | B |
| `000090_seed_aliases_numeric_fourth_wave` | B |
| `000091_seed_aliases_srk_fourth_wave` | B |

**★17 stem はすべて `S03`（moves）／ `S04`（move_commands）／ `S06`（preset_aliases）へ吸収される。⇒ 層はすべて B であり、この一覧に層の混在は無い。**

**★あわせて `cmd/seedgen` の `-check` も byte 比較の経路である**（`cmd/seedgen/main.go:212,317` が `os.ReadFile` で `migDir` の同名ファイルと比べ、違えば `DIFF: …` を出す）**。⇒ テスト以外にも経路がある。**

> **★★【レビュー 中-2 の是正】初版は「`main.go:64-69` が `-check` 用の stem 表を持つ（6 件）」と書いていた。⇒ 不正確である。**
> **実体＝当該 6 件を持つのは `preM2003Stems`**（**`main.go:63-70`**）**であり、役割は「旧形式 `FormatPreM2003` で生成する stem の集合」で `formatFor()` から参照される。★`-check` 専用の表ではない。**
> **★`-check` は固定の stem 表を持たず、`-out` で渡された stem を `migDir` の同名ファイルと比べるだけである。**
> **⇒ `M33-03` が「6 件の表を直せばよい」と読むと、`formatFor` の分岐と 17 stem 側の再生成コマンドを取り落とす。**

**★★`os.ReadFile` はリポジトリ相対で `migrations/` を読む**（`filepath.Join(root, "migrations", c.name)`）**。⇒ `M33-03` が旧 SQL を `migrations/legacy/` へ退避すると、この 3 箇所はパスから直さないと落ちる。**

### 3.3 一覧 3 — 層 A / 層 B の仕分け（チェックリスト A-5）

> **★★★自分では判断していない。`scripts/check-migration-license.sh` の判定をそのまま採った。**

```bash
# 式18: 検査そのもの
bash scripts/check-migration-license.sh
#   凍結表: 層 A 30 本 / 層 B 72 本
#   結果: 違反なし                                    (exit 0)

# 式19: 全マイグレの解決結果を出す(--list)
bash scripts/check-migration-license.sh --list | grep '\.up\.sql' | awk '{print $1}' | sort | uniq -c
#   -> 32 A
#      79 B

# 式20: 凍結表に在るもの / 新規
bash scripts/check-migration-license.sh --list | grep '\.up\.sql' | awk '{print $2}' | sort | uniq -c
#   -> 102 凍結
#        9 新規
```

| 項目 | 値 | 種別 |
|---|---|---|
| up 111 本の層 | **A 32 / B 79** | 実測 |
| うち凍結表 | **102**（A 30 / B 72） | 実測 |
| うち新規（`000104`〜`000112`） | **9**（A 2 / B 7） | 実測 |
| 検算 | `30+2 = 32` ／ `72+7 = 79` | 算出・**一致** |

**★★凍結表は 2026-09-06 時点の 102 本しか持たない**（スクリプトのヘッダが明言）**。⇒ `000104` 以降は「`_data_` を持つか」という命名規約で判定されている。★`--list` はその両方を通した最終結果を出すため、本一覧の出所は `--list` である。**

**★層別の内訳は §2.4 の対応表の「実測層」欄に 1 行ずつ載せてある**（B-3 の 1 行 1 本と同じ表に統合した）。

**★★本一覧から出た最重要の所見は §2.8 である**（`S02` / `S06` が層をまたぐ）。

---

## 4. 検証環境内の移行の「下ごしらえ」（指示書 §2.4 ／ チェックリスト C-1〜C-5）

> **★★手順そのものは `M33-03` が書く。⇒ 本節は、手順を書くために要る事実だけを出す。**
>
> **★★★行数は数えていない**（C-4）**。⇒ 対象の DB は開発者の手元にあり、本セッションからは触れていない。数えるための式は §4.5 に置いた。**

### 4.1 最終スキーマの表（**21 表**）

```bash
# 式21: CREATE TABLE の全数(中間表を含む)
grep -hoiE 'CREATE TABLE(\s+IF NOT EXISTS)?\s+[a-z_]+' migrations/*.up.sql \
  | awk '{print tolower($NF)}' | sort -u | wc -l        # -> 22

# 式22（★レビュー 低-2 の是正。RENAME の「元」が拾える形にした）
#   ALTER TABLE <元> RENAME TO <先>  の <元> を取る ＋ TEMP 表を取る
grep -hoiE 'ALTER TABLE\s+[a-z_]+\s+RENAME TO\s+[a-z_]+' migrations/*.up.sql \
  | awk '{print tolower($3)}' | sort -u
#   -> new_combos          ★これが 22 から引く 1 である(000016/000019 が combos へ RENAME)
grep -hoiE 'CREATE TEMP(ORARY)? TABLE(\s+IF NOT EXISTS)?\s+[a-z_]+' migrations/*.up.sql \
  | awk '{print tolower($NF)}' | sort -u
#   -> _dash_sweep_check   (000028。★TEMP なので本体スキーマに残らない＝そもそも 22 に入らない)
```

| 項目 | 値 | 種別 |
|---|---|---|
| `CREATE TABLE` の名前（延べ） | **22** | 実測 |
| うち中間表 `new_combos`（→ `combos` へ RENAME） | 1 | 実測 |
| **最終スキーマの表** | **21** | **算出**（`22 − 1`） |
| 基準 DB で実際に在る表（`sqlite_%` 除く） | **22** ＝ 21 ＋ `schema_migrations` | 実測 |
| ビュー / トリガ / 仮想表 | **0 件** | 実測 |

**★`_dash_sweep_check` は `CREATE TEMP TABLE` であり本体スキーマに残らない**（基準 DB の `sqlite_master` に無い＝実測）。

**★★`combos` の正本定義は `000001` ではなく `000019` である**（`000016` / `000019` が SQLite の表再構築を行い、`drive_damage` と `drive_available_at_start` を `INTEGER` → `REAL` へ変えている）。**⇒ `000001` だけを読むと 2 列の型を取り違える。**

### 4.2 ★★ユーザーデータ表 / seed 表の仕分け（**判定根拠つき**・C-1）

```bash
# 式23（★実行可能な形。レビュー 中-4 の是正）: 各表へ INSERT する up マイグレの本数
#   0 なら「利用者しか入れない表」= ユーザーデータ表の候補
for t in games characters moves move_commands move_derivations presets preset_aliases \
         users tags combos combo_steps combo_tags combo_setups combo_setup_results \
         combo_oki_options combo_punishes combo_punish_prunings combo_punish_curations \
         combo_punish_starters setups setup_steps; do
  printf '%-24s %s\n' "$t" "$(grep -liE "INSERT( OR [A-Z]+)? INTO ${t}\b" migrations/*.up.sql | wc -l)"
done
```

#### (a) ユーザーデータ表 — **12 表**（移行の対象）

| 表 | INSERT する up | 判定の根拠 |
|---|---|---|
| `combos` | **0** | **seed が 1 本も無い。★`000016`/`000019` の `INSERT INTO new_combos … SELECT … FROM combos` は表再構築の写しであり seed ではない** |
| `combo_steps` | 0 | seed 無し |
| `combo_tags` | 0 | seed 無し |
| `combo_setups` | 0 | seed 無し |
| `combo_setup_results` | 0 | seed 無し |
| **`combo_oki_options`** | **1** | **★例外。`000021` の 6 文はすべて `INSERT … SELECT … FROM combos WHERE oki_* = 1` の backfill である**（実測）**。⇒ `combos` が空の新規 DB では 0 行に当たる。★「INSERT がある＝seed 表」ではない** |
| `combo_punishes` | 0 | seed 無し |
| `combo_punish_prunings` | 0 | seed 無し |
| `combo_punish_curations` | 0 | seed 無し |
| `combo_punish_starters` | 0 | seed 無し。ヘッダが「探す画面（`M18-02`）専用の検証作業状態」と明言 |
| `setups` | 0 | seed 無し |
| `setup_steps` | 0 | seed 無し |

#### (b) seed / 参照表 — **9 表**

| 表 | INSERT する up | `GAME_TABLES` | 備考 |
|---|---|---|---|
| `games` | 1（`000002`） | **無い（層 A）** | §2.8 の混在要因 |
| `characters` | 7 | 在る（層 B） | |
| `moves` | 14 | 在る（層 B） | |
| `move_commands` | 5 | 在る（層 B） | |
| `move_derivations` | 7 | 在る（層 B） | |
| `preset_aliases` | 21 | 在る（層 B） | 最多 |
| **`presets`** | 1（`000005`） | **無い（層 A）** | **★hybrid**——組込 3 件は `user_id IS NULL` / `is_builtin=1`。**利用者も行を足せる。⇒ 移行では「利用者が足した行」だけを運ぶ判断が要る** |
| **`users`** | 1（`000007`） | **無い（層 A）** | **★hybrid**——初期ユーザー 1 件 ＋ 利用者が足す行 |
| **`tags`** | 1（`000007`） | **無い（層 A）** | **★hybrid**——予約タグ 3 件 ＋ 利用者が作るタグ |

> **★★★hybrid の 3 表**（`presets` / `users` / `tags`）**は「seed 表だから運ばなくてよい」と読まないこと。⇒ 利用者が足した行はユーザーデータである。★`M33-03` は「seed 由来の行と利用者由来の行を分ける述語」を決める必要がある**（`presets` は `is_builtin` / `user_id` で分かれるが、`tags` / `users` の分け方は本サブでは確定していない）。

### 4.3 ★★投入順（**外部キーの依存から算出**・C-2）

```bash
# 式24（★実行可能な形。レビュー 中-4 の是正）
#   (i) migrations から静的に取る場合
grep -nE 'REFERENCES\s+[a-z_]+\s*\(' migrations/*.up.sql | wc -l
grep -nE 'ALTER TABLE .* ADD COLUMN .*REFERENCES' migrations/*.up.sql
#     -> 000038(materialized_from_combo_id) / 000078(superseded_by_combo_id) の 2 本
#        ★この 2 本を取り落とさないこと

#   (ii) 基準 DB から取る場合(こちらが確実。表の再構築後の姿を見る)
python3 - <<'PY2'
import sqlite3
c=sqlite3.connect('file:scratch-m33-01.db?mode=ro',uri=True)
ts=[r[0] for r in c.execute("select name from sqlite_master where type='table' "
      "and name not like 'sqlite_%' and name<>'schema_migrations' order by name")]
for t in ts:
    fks=sorted({(r[2],r[4]) for r in c.execute(f'pragma foreign_key_list("{t}")')})
    print(f'{t:24s} -> ' + (', '.join(f'{a}({b})' for a,b in fks) or '(無し)'))
PY2
#   -> 20 表が FK を持つ(games のみ持たない)。自己参照を除いてトポロジカルソートする
```

**★`ALTER TABLE … ADD COLUMN … REFERENCES` の 2 本を取り落とさないこと**（`000038` の `materialized_from_combo_id` ／ `000078` の `superseded_by_combo_id`）。**★`000074` の `preset_aliases.character_id` は `REFERENCES` を持たない**（FK ではない）。

| 表 | 依存先 |
|---|---|
| `games` | **（無し）** |
| `characters` | `games` |
| `users` | `characters`（nullable） |
| `moves` | `characters` / `moves`（自己・nullable） |
| `presets` | `users`（nullable） |
| `tags` | `users` |
| `preset_aliases` | `presets` / `moves` |
| `move_commands` | `moves` / `characters` |
| `move_derivations` | `moves` ×2（自己参照ではなく moves への 2 本） |
| `combos` | `characters` / `moves` / `combos` ×2（自己・nullable） |
| `setups` | `characters` |
| `combo_steps` | `combos` / `moves` |
| `setup_steps` | `setups` / `moves` |
| `combo_tags` | `combos` / `tags` |
| `combo_setups` | `combos` / `setups` |
| `combo_oki_options` | `combos` |
| `combo_punishes` | `combos` / `moves` |
| `combo_punish_curations` | `combos` / `moves` |
| `combo_punish_prunings` | `characters` / `moves` |
| `combo_punish_starters` | `characters` / `moves` |
| **`combo_setup_results`** | **`combo_setups(combo_id, setup_id)`** ← **★唯一の複合 FK** |

#### 算出された投入順（依存を持たない表から）

```
 1. games                    12. setup_steps
 2. characters               13. tags
 3. moves                    14. combo_oki_options
 4. setups                   15. combo_punish_curations
 5. users                    16. combo_punishes
 6. combo_punish_prunings    17. combo_setups
 7. combo_punish_starters    18. combo_steps
 8. combos                   19. combo_tags
 9. move_commands            20. preset_aliases
10. move_derivations         21. combo_setup_results
11. presets
```

**★★自己参照は 3 本ある**（`moves.original_move_id` / `combos.materialized_from_combo_id` / `combos.superseded_by_combo_id`）**。いずれも nullable である。⇒ 「NULL で入れてから UPDATE」の 2 パスで解ける。★遅延制約は要らない。**

**★★`combo_setup_results` は必ず `combo_setups` の後**（複合 FK の親が `id` ではないため）**。⇒ 上の順序はそれを満たしている。**

**★★注意＝マイグレーション接続は `foreign_keys=OFF` で走る**（`000016`/`000019`/`000021`/`000049` のヘッダが明言）**が、アプリ接続は `PRAGMA foreign_keys=ON` である**（`internal/infra/db/db.go`）**。⇒ 移行スクリプトを FK=ON で書くなら上の順序が要る。**

### 4.4 ★`sqlite_sequence` の扱い（**表ごとに 1 行**・C-3）

```bash
# 式25（★実行可能な形。レビュー 中-4 の是正）: AUTOINCREMENT を持つ表
#   ★基準 DB の sqlite_master を見る(表の再構築後の姿。new_combos ではなく combos として出る)
python3 -c "
import sqlite3
c=sqlite3.connect('file:scratch-m33-01.db?mode=ro',uri=True)
r=[n for n,s in c.execute(\"select name,sql from sqlite_master where type='table' \"
     \"and name not like 'sqlite_%' and name<>'schema_migrations'\") if 'AUTOINCREMENT' in s]
print(len(r), sorted(r))"
#   -> 16

# 式26: 複合 PRIMARY KEY の表(= AUTOINCREMENT を持たない)
grep -hoiE 'PRIMARY KEY \([a-z_, ]+\)' migrations/*.up.sql | sort -u    # -> 5 件
```

| 表 | `AUTOINCREMENT` | 基準 DB の `sqlite_sequence` | **移行時に運ぶ必要** |
|---|---|---|---|
| `games` | あり | `seq=1` | seed 側。**S02 が再現する** |
| `characters` | あり | **`seq=34`（行 31）** | **★★運ぶ。差 3 は `000009` の削除跡**（§2.6） |
| `moves` | あり | **`seq=3236`（行 3057）** | **★★運ぶ。差 179 は `000017`/`000029` の削除跡** |
| `presets` | あり | **`seq=5`（行 3）** | **★★運ぶ。差 2 は削除済み 2 プリセット** |
| `preset_aliases` | あり | **`seq=7816`（行 7637）** | **★★運ぶ。差 179。★`moves` と同値なのは偶然ではない**——**削除された技 1 件につき official_ja の alias が 1 件消えるためと考えられる**（`000072` 以降の numeric / srk エイリアスは削除より*後*に足されており、削除時点では official_ja しか無かった）**。⇒ ★この因果は推定であり実測していない** |
| `users` | あり | `seq=1` | seed 側。S07 が再現する |
| `tags` | あり | `seq=3` | seed 側。S07 が再現する |
| **`combos`** | あり | **`seq=0`（行 0）** | **★★★行が 0 でも `sqlite_sequence` に*行が在る*。⇒ 新 baseline でも `seq=0` の行を作らないと `sequence_equal` が落ちる** |
| **`combo_oki_options`** | あり | **`seq=0`（行 0）** | **★★★同上** |
| `combo_steps` | あり | **未登場** | 一度も INSERT されていない。**⇒ 行を作らない** |
| `setups` | あり | 未登場 | 同上 |
| `setup_steps` | あり | 未登場 | 同上 |
| `combo_punishes` | あり | 未登場 | 同上 |
| `combo_punish_prunings` | あり | 未登場 | 同上 |
| `combo_punish_curations` | あり | 未登場 | 同上 |
| `combo_punish_starters` | あり | 未登場 | 同上 |
| `combo_tags` | **なし**（複合 PK） | — | **`sqlite_sequence` に現れない** |
| `combo_setups` | なし（複合 PK） | — | 同上 |
| `move_commands` | なし（複合 PK） | — | 同上 |
| `move_derivations` | なし（複合 PK） | — | 同上 |
| `combo_setup_results` | なし（複合 PK） | — | 同上 |

**★AUTOINCREMENT 16 表 ＋ 複合 PK 5 表 ＝ 21 表**（算出・一致）**。★素の `INTEGER PRIMARY KEY`（AUTOINCREMENT 無し）の表は 0 である。**

> **★★★`combos` / `combo_oki_options` の `seq=0` が本節の要である。**
> **行数が 0 なので「触っていない表」に見えるが、`sqlite_sequence` には行が在る**（`combos` は `000016`/`000019` の表再構築、`combo_oki_options` は `000021` の backfill が、0 行の `INSERT` を走らせたため）**。**
> **⇒ 「空の表は飛ばす」と書くと、ここで静かにずれる。★`M33-02` の同一性比較で落ちる形である。**

### 4.5 ★★行数を数えるための式（**実行は開発者の手番**・C-4 / C-5）

> **★★★本セッションは開発者の DB に触れていない。⇒ 下の式は開発者が回すためのものである。**
>
> **★★★「ユーザーデータ表は 0 行だから移行は要らない」とは結論しない**（C-5）**。基準 DB が 0 行なのは、凍結した旧系列を新規に流しただけのツリーだからである。★開発者の手元には実データが在ることが確定している**（`D-790`。開発者逐語＝「今後もテスト用にデータは使うので検証環境内でのデータ移行はしたい」）。

```bash
# 開発者の手番: 実 dev DB の行数と sqlite_sequence を数える(read-only)
#   DB の既定パス: ~/.local/share/tacpendium/tacpendium.db
#   ★sqlite3 CLI が無い環境でも python3 標準ライブラリで読める。
DB=~/.local/share/tacpendium/tacpendium.db
python3 - "$DB" <<'PY'
import sqlite3,sys
c=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro',uri=True)
USER=['combos','combo_steps','combo_tags','combo_setups','combo_setup_results',
      'combo_oki_options','combo_punishes','combo_punish_prunings',
      'combo_punish_curations','combo_punish_starters','setups','setup_steps']
HYBRID=['presets','users','tags']
print('version,dirty =',c.execute('select version,dirty from schema_migrations').fetchone())
print('-- ユーザーデータ表 --')
for t in USER:
    print(f'  {t:24s} {c.execute(f"select count(*) from {t}").fetchone()[0]}')
print('-- hybrid 表(seed 由来と利用者由来が混ざる) --')
print('  presets(全体/利用者作成) =',
      c.execute('select count(*) from presets').fetchone()[0],'/',
      c.execute('select count(*) from presets where is_builtin=0').fetchone()[0])
for t in ['users','tags']:
    print(f'  {t:24s} {c.execute(f"select count(*) from {t}").fetchone()[0]}')
print('-- sqlite_sequence --')
for n,s in c.execute('select name,seq from sqlite_sequence order by name'): print(f'  {n:24s} seq={s}')
print('-- 整合性 --')
print('  foreign_key_check:', c.execute('pragma foreign_key_check').fetchall() or '0 件')
PY
```

**★★この式は `mode=ro` で開く。⇒ 開発者の DB を書き換えない。**

---

## 5. 基準 DB の作り方とハッシュ（指示書 §2.5 ／ チェックリスト D-1〜D-3）

### 5.1 ★実際に 1 度作って通した（D-1）

**★★この環境に `sqlite3` CLI は無い**（`which sqlite3` → 見つからない＝実測）**。⇒ 新規ファイルも新規依存も作らずに済ませるため、既存の経路と `python3` 標準ライブラリだけを使った。**

```bash
# 手順1: 凍結した旧系列を最後まで適用する(既存 scripts/dev-throwaway-db.sh と同じ経路)
#   ★TACPENDIUM_CONFIG_PATH を作業ツリー外へ逃がし、リポジトリを汚さない
#   ★TACPENDIUM_DB_PATH はリポジトリ直下の *.db(= .gitignore 済み)
cd <repo root>
TACPENDIUM_DB_PATH=scratch-m33-01.db \
TACPENDIUM_CONFIG_PATH=<作業ツリー外>/m33-config.toml \
  go run ./cmd/tacpendium
#   起動時に internal/infra/migration.Run() が embed.FS の 111 本を Up() で適用する。
#   schema_migrations が version=112 / dirty=0 になったらサーバを停止する。

# 手順2: 適用の完了を確かめる
python3 -c "
import sqlite3
c=sqlite3.connect('file:scratch-m33-01.db?mode=ro',uri=True)
print(c.execute('select version,dirty from schema_migrations').fetchone())"
#   -> (112, 0)
```

| 確認項目 | 結果 | 種別 |
|---|---|---|
| `schema_migrations` | **`version=112` / `dirty=0`** | 実測 |
| 表（`sqlite_%` 除く） | **22** ＝ アプリ 21 ＋ `schema_migrations` | 実測 |
| 明示索引 | **22** ＝ アプリ 21 ＋ `version_unique`（golang-migrate 由来） | 実測 |
| **アプリのスキーマオブジェクト** | **42**（表 21 ＋ 索引 21） | **算出**。**★調査資料 `verification.md:7-9` の「21 表 ＋ 21 明示索引 ＝ 42」と一致する** |
| `pragma foreign_key_check` | **0 件** | 実測 |
| `pragma integrity_check` | **`ok`** | 実測 |

### 5.2 ★★スキーマのハッシュ（D-3）

**★★ファイルのバイト列はハッシュしない**——ページ配置と `created_at DEFAULT (datetime('now'))` 由来の値で毎回変わる。**⇒ `sqlite_master` の正規化投影をハッシュする。**

```bash
# 手順3: スキーマの正規化 SHA-256
#   除外: sqlite_%(sqlite_sequence / sqlite_stat1 は ANALYZE と AUTOINCREMENT 使用で出没する)
#         schema_migrations / version_unique(golang-migrate の持ち物。新系列でも作られるが版数が違う)
#   整列: type, name の昇順(決定論)
python3 - <<'PY'
import sqlite3,hashlib
c=sqlite3.connect('file:scratch-m33-01.db?mode=ro',uri=True)
q=("SELECT type,name,sql FROM sqlite_master "
   "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' "
   "AND name<>'schema_migrations' AND name<>'version_unique' "
   "ORDER BY type,name")
rows=[f"{t}\t{n}\t{s.strip()}" for t,n,s in c.execute(q)]
print("objects:",len(rows))
print("sha256 :",hashlib.sha256(("\n".join(rows)+"\n").encode()).hexdigest())
PY
```

| ハッシュ | 対象 | 値 |
|---|---|---|
| **参考 A** | アプリスキーマ 42 オブジェクトの**生テキスト**（`schema_migrations` / `version_unique` を除く） | `bc8d4d73928402e5fda8f675ae1e3d52671bfde2df90774803bec25d3aa673cb` |
| 参考 B | 上記 ＋ `schema_migrations` ＋ `version_unique`（44 オブジェクト） | `33503b05983302cf3f10845933c8ee89fd821f7af85cf53fca4ea90c48dbcb26` |

**★決定論の確認＝同じ DB から 2 回取って同一ハッシュになることを実測した**（`bc8d4d73…` ×2）。

### 5.2.1 ★★★【レビュー 高-1 の是正】生テキストのハッシュを「正本」と呼んではいけない

**★★初版は参考 A を「正本（`M33-02` はこれと突き合わせる）」と掲げていた。⇒ 誤りである。⇒ 格下げした。**

**理由＝参考 A の入力は `sqlite_master.sql` の生テキストであり、旧系列が 111 本かけて積み上げた文字列そのものである。⇒ `M33-02` が `S01` を素直な `CREATE TABLE` 群として書き直すと、意味が完全に同じでも必ず食い違う。**

**実測した accretion（すべて基準 DB の `sqlite_master` から）:**

| 表 | 生テキストの実態 |
|---|---|
| `combos` | **`CREATE TABLE "combos" (`** ——**表名が引用符付き**。`000016`/`000019` の表再構築で `new_combos` → `RENAME TO combos` した跡である |
| `moves` | **`ALTER TABLE ADD COLUMN` の追記が 1 行に連なった形**で保存されている |
| `games` | 元の閉じ括弧の後ろへ `, current_data_version TEXT NOT NULL DEFAULT '2026.08.03.01' CHECK (…))` が追記された形 |
| **13 表** | **旧 SQL の `--` コメントを本文として含む**（実測＝`characters` / `moves` / `combos` ほか 13 表） |

**★★一致させる唯一の道は accreted なテキストを逐語で埋め込むことだが、調査資料の `README.md:40` 自身が「`evidence-final-schema.sql` は実行順に並べた新マイグレーションではない／仕様の正典にしない」と禁じている。**

**★★★調査資料の `schema_exact_equal=True` を「手書きの S01 でも一致する」と読まないこと。** 同値は `research.py:102,115` が**累積 DB の `sqlite_master.sql` をそのまま別 DB で実行し直して**得たものであり、**手書きの一致は一度も検証されていない**（レビューが独立に確認）。

#### ⇒ 正本は「正規化ハッシュ」とする

**★`pragma` 経由で構造だけを取り、テキストの見てくれを捨てる。**

```bash
python3 - <<'PY2'
import sqlite3,hashlib
c=sqlite3.connect('file:scratch-m33-01.db?mode=ro',uri=True)
tables=[r[0] for r in c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
  "AND name<>'schema_migrations' ORDER BY name")]
out=[]
for t in tables:
    out.append(f"TABLE {t}")
    for cid,name,typ,notnull,dflt,pk in c.execute(f'pragma table_info("{t}")'):
        out.append(f"  COL {name}|{typ}|notnull={notnull}|default={dflt}|pk={pk}")
    for row in sorted(c.execute(f'pragma foreign_key_list("{t}")'),
                      key=lambda r:(r[2],r[3] or '',r[4] or '')):
        _,_,tbl,fr,to,upd,dele,match=row
        out.append(f"  FK {fr}->{tbl}.{to}|on_update={upd}|on_delete={dele}")
    for _,iname,uniq,origin,partial in sorted(c.execute(f'pragma index_list("{t}")'),
                                              key=lambda r:r[1]):
        cols=",".join(r[2] for r in c.execute(f'pragma index_info("{iname}")'))
        out.append(f"  IDX {iname}|unique={uniq}|origin={origin}|partial={partial}|cols={cols}")
print("正規化スキーマ sha256 =",hashlib.sha256(("\n".join(out)+"\n").encode()).hexdigest())
seq=[f"{n}|{s}" for n,s in sorted(c.execute('select name,seq from sqlite_sequence'))]
print("sqlite_sequence sha256 =",hashlib.sha256(("\n".join(seq)+"\n").encode()).hexdigest())
PY2
```

| **★★正本（`M33-02` はこれと突き合わせる）** | 値 |
|---|---|
| **正規化スキーマ**（21 表・250 行） | **`9b87a96e67042850603e692fc3a3599e9002bdec3ac8a3f71ba6b3a2809ad77e`** |
| **`sqlite_sequence`** | **`694011b0fe4e87f8098b220eb3a9b1a414ea5df0cc1136208738d2aefe48fb69`** |

> **★★★正規化ハッシュの値は「レシピ」と対で意味を持つ。⇒ 上のスクリプトを 1 バイトでも変えると値が変わる。**
>
> **★実例＝レビュー担当が独立に算出した正規化ハッシュは `8a86d298…`、`sqlite_sequence` は `4343fdcc…` であり、本節の値と違う。★どちらも間違っていない**——**連結の書式が違うだけである。⇒ `M33-02` は「値」ではなく「上のスクリプトそのもの」を引き継ぐこと。**

### 5.2.2 ★★突き合わせは 3 点セットである（**レビュー 中-3 の是正**）

**★ハッシュが一致すれば突合完了、ではない。** 調査資料の完了条件は 3 つである（`research.py:115-116`）。

| # | 突合対象 | 本報告のどこに在るか |
|---|---|---|
| 1 | **`schema_exact_equal`**（スキーマ） | **§5.2.1 の正規化スキーマ sha256** |
| 2 | **`table_rows_exact_equal`**（全行・ID 込み） | **§4.5 の数え方 ＋ `M33-02` が旧最終状態と新 baseline を独立構築して比較する** |
| 3 | **`sequence_equal`**（`sqlite_sequence`） | **§4.4 の表 ＋ §5.2.1 の sqlite_sequence sha256** |

**★★とくに 3 は §2.6（`000009` の id 消費）と §4.4（`combos` / `combo_oki_options` の `seq=0`）が効く。⇒ ハッシュだけ見ていると落ちる。**

### 5.3 ★★実体を残さない（D-2）

| # | 措置 | 結果 |
|---|---|---|
| 1 | 基準 DB は `.gitignore` の下で作った | **`.gitignore:30` の `*.db`。⇒ `git status` に現れない**（実測） |
| 2 | `docs/` の下に置いていない | **置いていない**（`D-637` (3)＝`docs/` は丸ごと公開される） |
| 3 | 生成された `config.toml` | **作業ツリー外**（`TACPENDIUM_CONFIG_PATH`）**へ逃がした。⇒ リポジトリ直下に `config.toml` は作られていない**（実測） |

> **★★実体を残さない理由＝バイナリを repo へ置くと、以後それが「正しい基準」として一人歩きし、どの commit から作られたかが分からなくなる。⇒ 正本は凍結点 `5576126` と本節の手順である。**

**★★★後片付けは開発者の手番である。** `scratch-m33-01.db` が作業ツリー直下に残っている。**⇒ `CLAUDE.md` §10 が「データベースファイル（`*.db`）の直接削除」を禁じているため、本セッションでは消していない。** 開発者が次を実行して片付けること（`.gitignore` 済みのためコミットには影響しない）。

```bash
rm -f scratch-m33-01.db scratch-m33-01.db-wal scratch-m33-01.db-shm
```

---

## 6. ★★調査資料・設計卓の記載と食い違った点（指示書 §4-6 ／ チェックリスト B-4）

**★★合計 8 件。⇒ 「0 件」ではない。**

| # | 何が | 資料の記載（**引用**） | 実測 | 重さ |
|---|---|---|---|---|
| **1** | **対応表の母集団** | 調査資料 **104 組**（`000001`〜`000105`・基点 `5d1b7af`・2026-09-06） | **111 組**（〜`000112`） | **中**。`000106`〜`000112` の 7 行を本報告 §2.4 で新規に判定した |
| **2** | **`SUPP-001` §2.7 の本数** | **102 本 / `000001`〜`000103`** | **111 本 / 〜`000112`** | **中**。**★欠番が `000012` の 1 件だけである点は一致。⇒ as-built 化は設計卓の手番** |
| **3** | **`Migrate`/`Steps` の本数** | **28 ファイル** | **35**（同一の式）／ **38**（`.Up(` `.Version(` 込み）／ **40**（repo 全体・うち 2 本は別サブシステム） | **大**。**★増えた 7 本は新マイグレ 7 本と 1 対 1。消失は 0 本** |
| **4** | **golden の本数** | 設計卓 **4 本**（`M33-overview:163`） | **17 stem ／ 34 SQL ファイル** | **大**。`M33-03` の書き換え量が 4 倍以上になる |
| **5** | **★★`000009` が廃止候補である** | 調査資料は **`S02`**（廃止候補に挙げていない） | **生存行 0**（`000017` が全撤去し、`000024`/`000053`/`000082` が再投入） | **★★大。本サブの最大の成果**（§2.6）。**⇒ 廃止 7 本ではなく 8 本である。★ただし `sqlite_sequence` の 3 は再現が要る** |
| **6** | **★★`S02` / `S06` が層をまたぐ** | `M33-overview` §0.5.3 は **S02〜S06 を一律 層 B** としている | **`games`（S02）と `presets`（S06）は `GAME_TABLES` に無く 層 A**（`000002`/`000005`/`000069` が実測で層 A） | **★★★最大の危険**（§2.8）。**機械検査はこの向きを検出しない。⇒ `M33-02` 着手前に設計卓の判断が要る** |
| **7** | **`000018` の吸収先** | 調査 **`S01`** | **`S01,S03`**（`UPDATE moves SET raw_data = json_remove(…)` を持つ） | 小。分類の取り落とし |
| **8** | **`000070` の吸収先** | 調査 **`S01,S06`** | **`S01`**（`ALTER TABLE … ADD COLUMN` 1 文のみ・データ 0 行） | 小。**分類の粒度の違いであって誤りではない** |

**★逆に、本サブの式が取り落として調査資料が正しかったのは 1 件である**（`000104` の `DEFAULT` 埋め込み＝§2.7）。**⇒ 隠さずに出す。**

**★調査資料の主張のうち、実物で裏を取って*成立した*もの**: 独立処理廃止 7 本すべて（§2.5）／ ユーザーデータ表が基準 DB で 0 行であること（§4.2。**★ただし開発者の手元は別である**）／ `sqlite_sequence` の差分が削除履歴であること（§4.4）／ 42 スキーマオブジェクト（§5.1）。

---

## 7. ■ 併せて更新が要るもの

| # | 対象 | 要否 |
|---|---|---|
| 1 | **CHANGE 番号の登録**（`change-number-registry.md` §1） | **不要**。**CHANGE 消費 0 本・自採番なし**（`D-293`） |
| 2 | **マイグレ連番** | **不要**。**マイグレ消費 0 本。⇒ ボード §2.2 の「次に払い出す番号 ＝ `000113`」は動かない**（`ls migrations/` の実測最大 `000112` と整合） |
| 3 | **版を上げた文書の参照元** | **不要**。設計書を 1 つも改版していない |
| 4 | **★`SUPP-001` §2.7 の as-built 化** | **要**（本報告 §1.5 / §6-2）。**本数 102 → 111・範囲 `000103` → `000112`。★製造は設計書を直接編集しない**（`CLAUDE.md` §8）**。⇒ 設計卓の手番** |
| 5 | **★`M33-overview` §0.5.3 の層の割当** | **要**（§2.8 / §6-6）。**`S02` / `S06` が層をまたぐ。⇒ 設計卓の判断が要る** |
| 6 | **★`M33-overview` の「廃止 7 本」** | **要**（§2.6 / §6-5）。**`000009` を加えて 8 本になりうる** |
| 7 | **`scratch-m33-01.db` の削除** | **要**（§5.3）。**開発者の手番**（`*.db` の削除は `CLAUDE.md` §10 で禁止） |
| 8 | `docs/progress/progress-log.md` への索引行 | **★Phase D で追記する**（**★初版は「追記済み」と書いていた＝レビュー 高-2。⇒ 執筆時点で未実施であり、`check-progress-log-index.sh` が現に違反 1 件を返していた。★`D-510` と同型の「観測ではなく予測を書いた」誤りである**） |

---

## 8. 越境していないことの確認（チェックリスト 束 E）

| # | 観点 | 結果 |
|---|---|---|
| **E-1** | **`migrations/` の差分が 0 バイトか** | **✅ 0 バイト**（`git diff --stat -- migrations/` の出力が空＝実測） |
| **E-2** | 7 群を作っていないか | **✅ 作っていない**。`migrations/` に新規ファイル 0 件 |
| **E-3** | 歴史テストを直していないか ／ `migrations/legacy/` を作っていないか | **✅ どちらもしていない**。`internal/` の差分 0 |
| **E-4** | CHANGE 消費 0・マイグレ消費 0 か | **✅ 両方 0**。設計書の契約を 1 つも変えていない。**自採番なし** |
| **E-5** | **`docs/handover/followup-backlog.md` を 1 文字も編集していないか** | **✅ 1 文字も触っていない**（`D-838`。⇒ §10 に §J 行の原稿を置いた） |
| **E-6** | 着手時の版ゲートを通したか | **✅ 3 点とも通過**（§1.1） |
| **E-7** | `go test ./...` に変化が無いか ／ `check-migration-license.sh` が緑か | **§9 に実測を置く** |

### ★変更統計（`git diff --numstat 5576126`・**Phase C 完了時点**）

```
insertions  deletions  file
      1223          0  docs/progress/M33-01-completion-report.md
       249          0  docs/progress/m33-01-review.md      (Phase B のレビュー担当が作成)
        16          0  docs/progress/progress-log.md       (Phase D の索引行・追記のみ)
```

| 観点（教訓 `E-225`） | 判定 |
|---|---|
| **新規のつもりのファイルが `+` だけか** | **✅ 3 ファイルとも deletions 0** |
| **既存ファイルを上書きしていないか** | **✅ `progress-log.md` は 16 行の追記のみで deletions 0。⇒ 既存の過去節を 1 行も書き換えていない** |
| 同名の既存ファイルが無かったか | **✅ 着手前に `docs/progress/M33-01*` を確認し 0 件だった**（Phase A 補足の (a)） |
| コード・`migrations/` の差分 | **✅ 0**（`docs/progress/` の 3 ファイルのみ） |

**★★【レビュー 中-5 の是正】初版の §8 は「新規ファイル(untracked)」と書いており執筆時点で止まっていた。⇒ Phase C 完了時点の実測へ更新した。**

**★`scratch-m33-01.db` は `.gitignore` 済みのため `git status --porcelain --untracked-files=all` にも現れない**（実測）。

---

## 9. 検査（**Phase A 時点の実測**）

| # | 検査 | 結果 |
|---|---|---|
| **1** | **`bash scripts/check-artifact-integrity.sh`**（**★1 本目に回した**） | **✅ 違反なし**。検査 16 件の自己検査が全て OK ／ 生成物 4 件が健全 |
| 2 | `bash scripts/check-migration-license.sh` | **✅ 違反なし**（exit 0）。凍結表 層 A 30 / 層 B 72 |
| 3 | `bash scripts/check-md-emphasis.sh docs/progress/M33-01-completion-report.md` | **✅ 検出 0 行**（`D-775`。**★初回は 2 行を検出したため自分で直した**——`**` が 2 行に跨っており、1 行に畳んだ） |
| 4 | `git diff --stat -- migrations/` | **✅ 空**（E-1） |
| 5 | `go test ./...` | **§9.1** |
| 6 | `bash scripts/check-progress-log-index.sh` | **§9.2**（Phase D の直後に回した） |

### 9.1 実行結果

```bash
$ go test ./... > /tmp/gotest.txt 2>&1 ; echo $?     # -> 0
$ grep -c '^ok'   /tmp/gotest.txt                    # -> 60
$ grep -c '^?'    /tmp/gotest.txt                    # ->  9
$ grep -c '^FAIL' /tmp/gotest.txt                    # ->  0
$ go list ./... | wc -l                              # -> 69
```

| 検査 | 結果 | 種別 |
|---|---|---|
| **`go test ./...`** | **✅ 全緑**（`ok` **60** ／ `no test files` **9** ／ 合計 **69** パッケージ ／ **FAIL 0** ／ exit 0） | 実測 |

> **★★【レビュー 高-3 の是正】初版は「ok 37 / no test files 3」と書いていた。⇒ 誤りである。**
> **機序＝バックグラウンド実行を `go test ./... 2>&1 | tail -40` の形で回したため、保存された出力が末尾 40 行しか無く、その中の `ok` を数えていた。⇒ パイプで切った出力を母集団として数えた。**
> **★「実測」ラベルを付けた数が再現しないのは、本サブの評価軸そのものに触れる。★教訓＝件数を数える対象は、`tail` / `head` を通していない全出力であること。**
| **E-7 の「変化が無いか」** | **✅ 変化なし**。**★本サブは Go のコードもテストも 1 バイトも触っていない**（`git diff --stat` の追跡ファイル差分 0 行）**。⇒ 着手前と同じであることは差分 0 で担保されている** |
| `bash scripts/check-progress-log-index.sh` | **§9.2**（Phase D の直後に回した） | — |

### 9.2 Phase D の直後（**索引行の追記後**）

```bash
$ bash scripts/check-progress-log-index.sh
#   OK  検査した 104 件すべてが progress-log に現れる(ALLOW 除外 17 件)
#   結果: 違反なし                                   (exit 0)
```

**★★初回（Phase A 時点）は違反 1 件だった**——`NG  作業 ID \`m33-01\` が docs/progress/progress-log.md に現れない`。**⇒ レビュー 高-2 の指摘どおりであり、Phase D で実追記して緑になった。**

---

## 10. レビューと取り込み（Phase B / Phase C）

| 項目 | 内容 |
|---|---|
| レビュー報告書 | **`docs/progress/m33-01-review.md`**（249 行・レビュー時 HEAD `c92891b`） |
| 実施形態 | **fresh subagent**（メイン会話文脈を継承しない独立エージェント。**`fork` は使っていない**） |
| **指摘の件数** | **12 件（高 4 / 中 5 / 低 3）** |
| **「高」指摘の不採用** | **★★0 件。⇒ 不採用そのものが 0 件であり、12 件すべてを採用した** |
| 再レビュー往復 | **0 回**（初回のみ。停止規律の上限 2 回に達していない） |
| チェックリスト §0 の不合格 4 条件 | **4 条件とも該当しない**（レビュー判定） |

### 10.1 トリアージ結果（**全 12 件・採否と理由**）

| # | 優先度 | 指摘 | 採否 | 対応 |
|---|---|---|---|---|
| **高-1** | 高 | **生テキストのスキーマハッシュは `M33-02` の突合に耐えない** | **採用** | **§5.2.1 を新設。** 生テキストの 2 種を「参考 A / B」へ格下げし、**`pragma` 経由の正規化ハッシュを正本にした**（`9b87a96e…` / `sqlite_sequence` `694011b0…`）。**★指摘の裏を自分でも取った**——`CREATE TABLE "combos"`（引用符）・`moves` の追記連なり・`games` の `))` 追記・**`--` コメントを含む 13 表**を実測。**★さらにレビューの値**（`8a86d298…`）**と本報告の値が違うことを利用して「ハッシュはレシピと対で意味を持つ」を明記した** |
| **高-2** | 高 | **§7-8「progress-log 追記済み」が虚偽** | **採用** | **★製造の誤りである。** `D-510` と同型（観測ではなく予測を書いた）。**§7-8 を「Phase D で追記する」へ直し、Phase D で実追記して `check-progress-log-index.sh` の緑を §9.2 に記録した** |
| **高-3** | 高 | **§9.1 の `go test` 件数が誤り**（37/3 → 60/9/69） | **採用** | **★製造の誤りである。** 機序＝バックグラウンド実行を **`go test ./... 2>&1 \| tail -40`** の形で回し、**末尾 40 行だけの出力を母集団に数えた**。**§9.1 を実測値へ直し、機序と教訓も書いた** |
| **高-4** | 高 | **§2.8 の交差検証が多群行を素通し。厳密には 5 行。`000018`/`000074` が凍結表の据置きだけで緑** | **採用** | **★指摘のとおりであり、しかも最も重い部分**（`000018`/`000074`）**は本報告に無かった。** §2.8 へ厳密条件の 5 行表・**実行可能な式10 / 式10b**・**「`M33` が潰した瞬間に据置きが消えて規則 (4) の判定対象になる」**を追記。**★実測で 2 本ちょうどであることを自分で確認した** |
| **中-1** | 中 | 式10 のコメント「108 行」が誤り（正 104） | **採用** | 104 へ訂正（`111 − 廃止 7`）。**★対応表を機械パースして 104 を再確認した** |
| **中-2** | 中 | `cmd/seedgen/main.go` の記述が不正確 | **採用** | **実体を確認**（`preM2003Stems` は `main.go:63-70` の**形式選択表**であり `-check` 専用ではない。`-check` は `main.go:212,317` で `-out` の stem を比べるだけ）**。§3.2 を実体に合わせ、`M33-03` が誤読する経路も明記** |
| **中-3** | 中 | §5.2 が 3 点セットになっていない | **採用** | **§5.2.2 を新設**（`schema_exact_equal` / `table_rows_exact_equal` / `sequence_equal` と、本報告のどこが対応するか） |
| **中-4** | 中 | 式10 / 式23 / 式24 / 式25 が実行可能でない | **採用** | **4 つとも実行可能な形へ書き直した**（式23 は 21 表を展開、式24 は `pragma foreign_key_list` 版を追加、式25 は基準 DB 走査版、式10 は実コードを掲載） |
| **中-5** | 中 | §8 の変更統計が執筆時点で止まっている | **採用** | **§8 を Phase C 完了時点の実測へ更新** |
| **低-1** | 低 | `preset_aliases` の差 179 に因果が無い | **採用** | **機序を 1 行足し、「★この因果は推定であり実測していない」と明記**（`moves` と同値なのは 1 技 : 1 official_ja alias のため、と考えられる） |
| **低-2** | 低 | 式22 の出力から `22 − 1` の 1 が導けない | **採用** | **`RENAME TO` の「元」（`new_combos`）が拾える式へ差し替え**。TEMP 表はそもそも式21 の 22 に入らないことも明記 |
| **低-3** | 低 | §2.5 の `000028` に `INSERT INTO _dash_sweep_check` が落ちている | **採用** | 追記 |

### 10.2 ★★不採用は 0 件である

**★「高」の不採用が 0 件であるだけでなく、12 件すべてを採用した。⇒ 開発者へのエスカレーションは発生していない。**

**★★このうち 高-2 / 高-3 / 中-1 は製造が「実測」と書いた数が再現しなかったものである。⇒ 本サブの評価軸そのもの（成果は数である）に触れる誤りであり、機序と教訓を本文へ残した。**

---

## 11. 停止規律 — §J 行の原稿（`CLAUDE.md` §9 ／ `D-838`）

> **★★`docs/handover/followup-backlog.md` は 1 文字も編集していない**（E-5）**。⇒ 下記は「§J 行の原稿」であり、設計伝達レポート §4 へ移したうえで、設計卓が受理の手番で §J へ転記する。**

### 原稿 1

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `m33-groups-s02-s06-straddle-license-layers` |
| **発生元** | `M33-01`（本報告 §2.8 / §6-6） ／ レビュー報告書 `docs/progress/m33-01-review.md` |
| **未解消の理由** | **`M33-overview` §0.5.3 は S02〜S06 を一律 層 B とするが、`GAME_TABLES` の基準では `games`（S02）と `presets`（S06）は 層 A である。⇒ 7 群の定義そのものを変える判断であり、製造の裁量を超える**（指示書 §3-5＝契約を変えたくなったら射程外） |
| **再開に必要な条件** | **設計卓が (a) S02 / S06 を層ごとに分割する か (b) `games` / `presets` を層 B へ移すことを是とする か を裁定すること。★`M33-02` の着手前** |
| **記録日・状態** | 2026-09-13 ／ **未着手**（本サブの射程は「出すこと」まで） |

### 原稿 2

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `m33-000009-eighth-retirement-candidate` |
| **発生元** | `M33-01`（本報告 §2.6 / §6-5） |
| **未解消の理由** | **調査資料が挙げた廃止 7 本に `000009` が入っていない。実測では生存行 0 であり 8 本目に当たる。★ただし `sqlite_sequence` の 3 を再現する必要があり、単純な削除では `sequence_equal` が落ちる。⇒ 対応表の更新は設計卓の受理事項** |
| **再開に必要な条件** | **設計卓が `M33-overview` の「廃止 7 本」を 8 本へ改めるかを判定すること。⇒ `M33-02` の入力になる** |
| **記録日・状態** | 2026-09-13 ／ **未着手** |

### 原稿 3

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `supp001-s27-migration-count-as-built` |
| **発生元** | `M33-01`（本報告 §1.5 / §6-2） |
| **未解消の理由** | **`SUPP-001` §2.7 の「`migrations/*.up.sql` は 102 本、`000001`〜`000103`」が失効している**（実測 111 本・〜`000112`）**。★製造は設計書を直接編集しない**（`CLAUDE.md` §8） |
| **再開に必要な条件** | **設計卓が as-built 化すること。★欠番が `000012` の 1 件だけである点は今日も成立しており、そこは変えなくてよい** |
| **記録日・状態** | 2026-09-13 ／ **未着手** |

---

*以上、`M33-01` 完了報告。* **★★本サブはマイグレを 1 本も作っていない。⇒ 作るのは `M33-02` である。** **★★対応表・一覧・ハッシュはすべて凍結点 `5576126` 時点のものであり、以後 `migrations/` に版が足されたら追記が要る**（§1.6）**。** **★最大の成果は §2.8**（`S02` / `S06` が層をまたぐ）**と §2.6**（`000009` が 8 本目の廃止候補）**である。**
