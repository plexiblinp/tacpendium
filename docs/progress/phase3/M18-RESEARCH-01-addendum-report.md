# M18-RESEARCH-01-addendum 調査報告: 非 projectile の recovery=0 技の列挙（データ品質チェック）

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M18-RESEARCH-01-addendum-recovery-zero-nonprojectile.md` v1.0.0 |
| 種別 | read-only データ品質チェック報告（事実列挙のみ。データ修正の要否判断は含めない） |
| 調査モード | auto（自由入力指示なし） |
| 作成日 | 2026-07-20 |
| dev DB 実測範囲 | `~/.local/share/combomgr/combomgr.db`（SELECT のみ・python3 標準 `sqlite3` モジュール経由。環境に `sqlite3` CLI が無いため代替。書込ゼロ） |
| CSV 実測範囲 | `character_data/*.csv`（全 12 ファイル。`csv.DictReader` でヘッダ名参照によりパース） |

---

## 0. 結論サマリ（冒頭）

- **DB 全体の `recovery = 0` の技**は **75 件**（`moves` テーブル全体。全 12 キャラ中、攻撃技を持つ 9 キャラに分布。`c_viper`/`dhalsim` は該当 0 件）。
- 75 件全件を `character_data/*.csv` の `is_projectile` 列と突合した結果、**`is_projectile=true` が 57 件・`is_projectile=false` が 18 件**（未確認・欠損は 0 件、全件が CSV 上で明示的な `true`/`false` 値を持つ）。`true` の 57 件は M18-RESEARCH-01-report の既報（B-2「projectile 候補 102 件中 recovery=0 が 57 件」）と一致する。
- **本指示書の主題である `is_projectile=false かつ recovery=0` の技は 18 件**。内訳: category 別 = `special` 15・`unique` 2・`target_combo` 1。キャラ別 = `kimberly` 12・`ken` 2・`ryu`/`lily`/`juri`/`mai` 各 1。全件列挙は §2 参照。
- CSV に `is_projectile` 列が無いファイル、または該当技の値が欠損（空欄）のケースは **0 件**（全 12 CSV ファイルに列が存在し、突合対象 75 件すべてに `true`/`false` いずれかの値が入っている）。

---

## 1. DB 側: `recovery = 0` の技（全列挙・母数）

### 母数

`moves` テーブル全体（category・キャラ問わず）で `recovery = 0` の行 = **75 件**。

category 別内訳（75 件全体）:

| category | 件数 |
|---|---:|
| special | 72 |
| unique | 2 |
| target_combo | 1 |
| （他 category: critical_art/normal/rush_variant/super_art/throw/system/drive_impact） | 0 |

キャラ別内訳（75 件全体。`character_id` → `characters.code` で解決）:

| character | 件数 |
|---|---:|
| guile | 22 |
| mai | 17 |
| kimberly | 12 |
| ingrid | 8 |
| ken | 6 |
| ryu | 5 |
| juri | 2 |
| terry | 2 |
| lily | 1 |
| c_viper / dhalsim / zangief | 0 |

### 全 75 件の実列挙（character / code / category / recovery / on_block）

| character | code | category | recovery | on_block |
|---|---|---|---:|---:|
| ryu | denjin_charge | special | 0 | NULL |
| ryu | hadoken_heavy | special | 0 | -9 |
| ryu | hadoken_light | special | 0 | -5 |
| ryu | hadoken_medium | special | 0 | -7 |
| ryu | hadoken_od | special | 0 | -1 |
| ken | hadoken_heavy | special | 0 | -11 |
| ken | hadoken_light | special | 0 | -7 |
| ken | hadoken_medium | special | 0 | -9 |
| ken | hadoken_od | special | 0 | -2 |
| ken | emergency_stop | unique | 0 | NULL |
| ken | quick_dash | unique | 0 | NULL |
| ingrid | od_sun_shot_heavy | special | 0 | 2 |
| ingrid | od_sun_shot_light | special | 0 | 1 |
| ingrid | od_sun_shot_medium | special | 0 | 1 |
| ingrid | sun_flare_light | special | 0 | NULL |
| ingrid | sun_shot_heavy | special | 0 | -5 |
| ingrid | sun_shot_holding_heavy | special | 0 | NULL |
| ingrid | sun_shot_light | special | 0 | -6 |
| ingrid | sun_shot_medium | special | 0 | -6 |
| terry | power_wave_light | special | 0 | -9 |
| terry | power_wave_od | special | 0 | -2 |
| guile | perfect_timing_heavy_sonic_boom | special | 0 | -3 |
| guile | perfect_timing_heavy_sonic_cross | special | 0 | NULL |
| guile | perfect_timing_light_sonic_boom | special | 0 | -3 |
| guile | perfect_timing_light_sonic_cross | special | 0 | NULL |
| guile | perfect_timing_medium_sonic_boom | special | 0 | -3 |
| guile | perfect_timing_medium_sonic_cross | special | 0 | NULL |
| guile | sonic_blade_heavy | special | 0 | -1 |
| guile | sonic_blade_light | special | 0 | -4 |
| guile | sonic_blade_medium | special | 0 | -7 |
| guile | sonic_blade_od | special | 0 | -4 |
| guile | sonic_boom_heavy | special | 0 | -3 |
| guile | sonic_boom_light | special | 0 | -3 |
| guile | sonic_boom_medium | special | 0 | -3 |
| guile | sonic_boom_od | special | 0 | 3 |
| guile | sonic_break_light | special | 0 | -2 |
| guile | sonic_break_od | special | 0 | 3 |
| guile | sonic_cross_2_meter_od | special | 0 | NULL |
| guile | sonic_cross_3_meter_od | special | 0 | NULL |
| guile | sonic_cross_heavy | special | 0 | NULL |
| guile | sonic_cross_light | special | 0 | NULL |
| guile | sonic_cross_medium | special | 0 | NULL |
| guile | sonic_cross_od | special | 0 | NULL |
| lily | condor_wind_light | special | 0 | NULL |
| kimberly | emergency_stop | special | 0 | NULL |
| kimberly | emergency_stop_od | special | 0 | NULL |
| kimberly | genius_at_play | special | 0 | NULL |
| kimberly | genius_at_play_od | special | 0 | NULL |
| kimberly | shuriken_bomb_heavy | special | 0 | NULL |
| kimberly | shuriken_bomb_light | special | 0 | NULL |
| kimberly | shuriken_bomb_medium | special | 0 | NULL |
| kimberly | shuriken_bomb_spread_heavy | special | 0 | NULL |
| kimberly | shuriken_bomb_spread_light | special | 0 | NULL |
| kimberly | shuriken_bomb_spread_medium | special | 0 | NULL |
| kimberly | sprint | special | 0 | NULL |
| kimberly | sprint_od | special | 0 | NULL |
| juri | fuha_saihasho | special | 0 | -3 |
| juri | saihasho_od | special | 0 | -2 |
| mai | flame_heavy_kachousen | special | 0 | -7 |
| mai | flame_heavy_kachousen_holding | special | 0 | -1 |
| mai | flame_light_kachousen | special | 0 | -3 |
| mai | flame_light_kachousen_holding | special | 0 | -1 |
| mai | flame_medium_kachousen | special | 0 | -5 |
| mai | flame_medium_kachousen_holding | special | 0 | -1 |
| mai | flame_od_kachousen | special | 0 | 1 |
| mai | flame_od_kachousen_holding | special | 0 | 46 |
| mai | kachousen_heavy | special | 0 | -11 |
| mai | kachousen_holding_heavy | special | 0 | -5 |
| mai | kachousen_holding_light | special | 0 | -5 |
| mai | kachousen_holding_od | special | 0 | 12 |
| mai | kachousen_light | special | 0 | -7 |
| mai | kachousen_medium | special | 0 | -9 |
| mai | kachousen_od | special | 0 | -5 |
| mai | hoshi_kujaku | target_combo | 0 | -11 |

（75 行。実行 SQL は指示書 §2 記載の骨子どおり `SELECT m.character_id, m.code, m.category, m.recovery, m.on_block FROM moves m WHERE m.recovery = 0 ORDER BY m.character_id, m.category, m.code`。`character_id` は `characters.code` に解決して表記。）

---

## 2. CSV 突合: `is_projectile=false` かつ `recovery=0` の技（全件列挙）

上記 75 件それぞれについて `character_data/{character}.csv` の該当行（`character_code` + `move_code` で一致）の `is_projectile` 列（20 列中 13 列目）を突合した。

- 突合結果: `is_projectile=true` 57 件／`is_projectile=false` 18 件／CSV 該当行が見つからない・値が空欄 0 件（全 75 件が突合済み）。

**`is_projectile=false` かつ `recovery=0` の技（全 18 件）**:

| character | code | category | on_block |
|---|---|---|---:|
| ryu | denjin_charge | special | NULL |
| ken | emergency_stop | unique | NULL |
| ken | quick_dash | unique | NULL |
| lily | condor_wind_light | special | NULL |
| kimberly | emergency_stop | special | NULL |
| kimberly | emergency_stop_od | special | NULL |
| kimberly | genius_at_play | special | NULL |
| kimberly | genius_at_play_od | special | NULL |
| kimberly | shuriken_bomb_heavy | special | NULL |
| kimberly | shuriken_bomb_light | special | NULL |
| kimberly | shuriken_bomb_medium | special | NULL |
| kimberly | shuriken_bomb_spread_heavy | special | NULL |
| kimberly | shuriken_bomb_spread_light | special | NULL |
| kimberly | shuriken_bomb_spread_medium | special | NULL |
| kimberly | sprint | special | NULL |
| kimberly | sprint_od | special | NULL |
| juri | fuha_saihasho | special | -3 |
| mai | hoshi_kujaku | target_combo | -11 |

---

## 3. 内訳（抽出結果＝上記 18 件に対する集計）

category 別:

| category | 件数 |
|---|---:|
| special | 15 |
| unique | 2 |
| target_combo | 1 |

キャラ別:

| character | 件数 |
|---|---:|
| kimberly | 12 |
| ken | 2 |
| ryu | 1 |
| lily | 1 |
| juri | 1 |
| mai | 1 |

on_block の充足状況（18 件中）: NULL 16 件・非 NULL 2 件（`juri.fuha_saihasho` = -3、`mai.hoshi_kujaku` = -11）。

---

## 4. CSV の `is_projectile` 列の欠損確認

- 全 12 CSV ファイル（`guile`/`ingrid`/`juri`/`ken`/`kimberly`/`lily`/`luke`/`mai`/`manon`/`ryu`/`terry`/`zangief`）いずれも 20 列目に `is_projectile` 列が存在する（列自体の欠損は 0 件）。
- 本調査の突合対象である DB 側 `recovery=0` の 75 件について、対応する CSV 行が見つからない、または `is_projectile` 値が空欄のケースは **0 件**（§2 記載のとおり全件が `true`/`false` いずれかの明示値を持つ）。
- 上記の理由により「未確認」に該当する技は無い。

---

*以上、read-only 追補調査報告。コード・マイグレーション・CSV・設計書への変更ゼロ。dev DB は SELECT のみ（python3 標準 `sqlite3` モジュール経由）。judgement-free（データ修正の要否・`is_projectile=false` 各技の妥当性判断は含めない。開発者判断用の事実提示のみ）。*
