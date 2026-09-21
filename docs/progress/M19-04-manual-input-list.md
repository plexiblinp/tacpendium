# M19-04 人手判断が必要な行の一覧

| 項目 | 内容 |
|---|---|
| 生成元 | 指示書 `docs/instructions/M19-04-frame-cost-columns.md` §4.7 / CHANGE-091 §2.3 |
| 生成時点 | マイグレ 000001〜000052 適用済みの clean DB（moves 総数 1028） |
| 補助列の出典 | `command` / `original_move_code` / `condition_ja` は DB に列が無いため `character_data/*.csv` から結合（`condition_ja` は 000018 で `raw_data` から除去済み、`original_move_code` は `original_move_id` へ解決されて投入される） |
| 並び順 | `character_code` 昇順 → `move_code` 昇順（差分が取れる安定ソート） |

> **記入先は `character_data/*.csv` の新 3 列**（本サブで空欄のまま追加済み）。記入後に Phase 2（§4.8）の seedgen 新モードが人手 backfill マイグレを生成する。
> **推測で埋めないこと。** 判断がつかない行は空欄のままにする（空欄の行は UPDATE 対象に含めない＝契約 F-4 の新形）。

## 件数サマリ

| # | 系統 | 抽出条件 | 件数 |
|---|---|---|---:|
| 1 | `startup_basis` | `is_derived=1` かつ `category<>'rush_variant'` かつ `startup_basis='unknown'` | 160 |
| 2 | `fastest_unreachable` の **B 型** | `is_aerial=1` かつ `code` が `jumping_` を含まない | 7 |
| 3 | `chain_cancel_total` | `category='normal'` かつ 地上弱通常技 4 種 かつ `chain_cancel_total IS NULL` | 10 |

---

## 1. `startup_basis`（160 行）

**判断すること**: その行の `startup` が「単独で出したときの値」か「連携の中で出したときの通し値」か。
記入値は `standalone` / `through` のいずれか（判断がつかなければ空欄＝`unknown` のまま）。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 記入: startup_basis |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guile | `double_shot` | ダブルバレット | target_combo | 1 | 0 | `d plus p_m chain d plus p_m` | 12 | 30 |  |  |  |
| guile | `drake_fang` | ドレイクファング | target_combo | 1 | 0 | `d plus k_m chain r plus p_m` | 20 | 43 |  |  |  |
| guile | `perfect_timing_heavy_somersault_kick` | 【ジャスト】強サマーソルトキック | special | 1 | 0 | `charge_d u plus k_h` | 7 | 55 |  |  |  |
| guile | `perfect_timing_heavy_sonic_boom` | 【ジャスト】強ソニックブーム | special | 1 | 0 | `charge_l r plus p_h` | 10 | 40 |  |  |  |
| guile | `perfect_timing_heavy_sonic_cross` | 【ジャスト】強ソニッククロス | special | 1 | 0 | `r plus p_h` | 10 | 38 |  |  |  |
| guile | `perfect_timing_light_somersault_kick` | 【ジャスト】弱サマーソルトキック | special | 1 | 0 | `charge_d u plus k_l` | 5 | 51 |  |  |  |
| guile | `perfect_timing_light_sonic_boom` | 【ジャスト】弱ソニックブーム | special | 1 | 0 | `charge_l r plus p_l` | 10 | 40 |  |  |  |
| guile | `perfect_timing_light_sonic_cross` | 【ジャスト】弱ソニッククロス | special | 1 | 0 | `r plus p_l` | 10 | 38 |  |  |  |
| guile | `perfect_timing_medium_somersault_kick` | 【ジャスト】中サマーソルトキック | special | 1 | 0 | `charge_d u plus k_m` | 6 | 53 |  |  |  |
| guile | `perfect_timing_medium_sonic_boom` | 【ジャスト】中ソニックブーム | special | 1 | 0 | `charge_l r plus p_m` | 10 | 40 |  |  |  |
| guile | `perfect_timing_medium_sonic_cross` | 【ジャスト】中ソニッククロス | special | 1 | 0 | `r plus p_m` | 10 | 38 |  |  |  |
| guile | `phantom_cutter` | ファントムカッター | target_combo | 1 | 0 | `d plus k_h chain dr plus k_h` | 10 | 37 |  |  |  |
| guile | `recoil_cannon` | リコイルキャノン | target_combo | 1 | 0 | `p_m chain l plus p_h` | 16 | 44 |  |  |  |
| guile | `sonic_break_light` | ソニックブレイク | special | 1 | 0 | `` | 11 | 36 |  |  |  |
| guile | `sonic_break_od` | ODソニックブレイク | special | 1 | 0 | `p` | 11 | 35 |  |  |  |
| guile | `sonic_cross_2_meter_od` | 【ジャスト】ODソニッククロス１ | special | 1 | 0 | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | 10 | 38 |  |  |  |
| guile | `sonic_cross_3_meter_od` | ODソニッククロス２ | special | 1 | 0 | `r plus p p` | 10 | 38 |  |  |  |
| guile | `sonic_cross_heavy` | 強ソニッククロス | special | 1 | 0 | `r plus p_h` | 10 | 38 |  |  |  |
| guile | `sonic_cross_light` | 弱ソニッククロス | special | 1 | 0 | `r plus p_l` | 10 | 38 |  |  |  |
| guile | `sonic_cross_medium` | 中ソニッククロス | special | 1 | 0 | `r plus p_m` | 10 | 38 |  |  |  |
| guile | `sonic_cross_od` | ODソニッククロス１ | special | 1 | 0 | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | 10 | 38 |  |  |  |
| ingrid | `glowing_touch` | グロータッチ | target_combo | 1 | 0 | `l k_m chain p_h` | 20 | 46 |  |  |  |
| ingrid | `luminous_uppercut` | ルミナスアッパー | target_combo | 1 | 0 | `l p_h chain p_h` | 23 | 46 |  |  |  |
| ingrid | `pretty_heel_kick` | エアリートス | target_combo | 1 | 0 | `p_m chain k_m` | 12 | 37 |  |  |  |
| ingrid | `satelite_leap` | サテライトリープ | target_combo | 1 | 0 | `k_h chain k_h` |  |  |  |  |  |
| juri | `death_crest` | 死紋蹴 | target_combo | 1 | 0 | `p_m chain l plus p_h chain p_h` | 17 | 46 |  |  |  |
| juri | `death_crest_2hits` | 死紋蹴(2発止め) | unique | 1 | 0 | `p_m chain l plus p_h` | 12 | 34 |  |  |  |
| juri | `fuha_ankensatsu` | [風破]暗剣殺 | special | 1 | 0 | `d dr r plus k_m` | 24 | 46 |  |  |  |
| juri | `fuha_go_ohsatsu` | [風破]五黄殺 | special | 1 | 0 | `d dr r plus k_h` | 18 | 63 |  |  |  |
| juri | `fuha_sa1_sakkai_fuhazan` | [風破]SA1 殺界風破斬 | super_art | 1 | 0 | `d dr r d dr r plus k` | 7 | 201 |  |  |  |
| juri | `fuha_saihasho` | [風破]歳破衝 | special | 1 | 0 | `d dr r plus k_l` | 16 | 45 |  |  |  |
| juri | `sa2_feng_shui_engine_dash` | SA2 風水エンジン(突進版) | super_art | 1 | 0 | `p hold` | 9 | 45 |  |  |  |
| juri | `shiren_sen` | 死連閃 | special | 1 | 0 | `k` | 6 | 75 |  |  |  |
| juri | `shiren_sen_od` | OD死連閃 | special | 1 | 0 | `k` | 6 | 73 |  |  |  |
| ken | `chin_buster` | 顎撥二連 | target_combo | 1 | 0 | `p_m chain p_h` | 11 | 40 |  |  |  |
| ken | `emergency_stop` | 急停止 | unique | 1 | 0 | `k_l` | 1 | 27 |  |  |  |
| ken | `forward_step_kick` | 踏み込み前蹴り | unique | 1 | 0 | `k_h` | 21 | 44 |  |  |  |
| ken | `gorai_axe_kick` | 轟雷落とし | special | 1 | 0 | `r plus k_m` | 18 | 40 |  |  |  |
| ken | `gorai_axe_kick_od` | OD轟雷落とし | special | 1 | 0 | `r plus k_m` | 17 | 43 |  |  |  |
| ken | `kasai_thrust_kick` | 火砕蹴(OD風鎌蹴り派生) | special | 1 | 0 | `r plus k` | 15 | 46 |  |  |  |
| ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | 火砕蹴(OD轟雷落とし派生) | special | 1 | 0 | `r plus k` | 11 | 42 |  |  |  |
| ken | `kasai_thrust_kick_during_od_senka_snap_kick` | 火砕蹴(OD閃火脚派生) | special | 1 | 0 | `r plus k` | 15 | 54 |  |  |  |
| ken | `kazekama_shin_kick` | 風鎌蹴り | special | 1 | 0 | `r plus k_l` | 6 | 28 |  |  |  |
| ken | `kazekama_shin_kick_od` | OD風鎌蹴り | special | 1 | 0 | `r plus k_l` | 6 | 28 |  |  |  |
| ken | `quick_dash_dragonlash_kick` | [奮迅脚]龍尾脚 | special | 1 | 0 | `r d dr plus k` | 20 | 58 |  |  |  |
| ken | `quick_dash_shoryuken` | [奮迅脚]昇龍拳 | special | 1 | 0 | `r d dr plus p` | 19 | 77 |  |  |  |
| ken | `quick_dash_tatsumaki_senpu_kyaku` | [奮迅脚]竜巻旋風脚 | special | 1 | 0 | `d dl l plus k` | 23 | 88 |  |  |  |
| ken | `senka_snap_kick` | 閃火脚 | special | 1 | 0 | `r plus k_h` | 10 | 37 |  |  |  |
| ken | `senka_snap_kick_od` | OD閃火脚 | special | 1 | 0 | `r plus k_h` | 10 | 33 |  |  |  |
| ken | `thunder_kick` | 紫電カカト落とし | unique | 1 | 0 | `k_m` | 29 | 51 |  |  |  |
| ken | `triple_flash_kicks` | 閃光連脚 | target_combo | 1 | 0 | `k_m chain k_m chain k_h` | 13 | 43 |  |  |  |
| ken | `triple_flash_kicks_2hits` | 閃光連脚(2発止め) | target_combo | 1 | 0 | `k_m chain k_m` | 11 | 39 |  |  |  |
| kimberly | `arc_step` | 弧空 | special | 1 | 0 | `` | 21 | 46 |  |  |  |
| kimberly | `arc_step_od` | OD弧空 | special | 1 | 0 | `` | 19 | 44 |  |  |  |
| kimberly | `bushin_hellchain` | 武神獄鎖拳 | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h chain k_h` | 15 | 41 |  |  |  |
| kimberly | `bushin_hellchain_3hits` | 武神獄鎖拳(3発止め) | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h` | 10 | 36 |  |  |  |
| kimberly | `bushin_hellchain_throw` | 武神獄鎖投げ | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h chain d plus k_h` | 15 | 40 |  |  |  |
| kimberly | `bushin_hojin_kick` | 武神鉾刃脚 | special | 1 | 0 | `k` | 13 | 44 |  |  |  |
| kimberly | `bushin_hojin_kick_od` | OD武神鉾刃脚 | special | 1 | 0 | `k` | 13 | 44 |  |  |  |
| kimberly | `bushin_izuna_otoshi` | 武神イズナ落とし | special | 1 | 0 | `p` | 13 | 58 |  |  |  |
| kimberly | `bushin_izuna_otoshi_od` | OD武神イズナ落とし | special | 1 | 0 | `p` | 13 | 58 |  |  |  |
| kimberly | `bushin_prism_strikes` | 武神天架拳 | target_combo | 1 | 0 | `p_l chain p_m chain p_h chain k_h` | 26 | 52 |  |  |  |
| kimberly | `bushin_prism_strikes_2hits` | 武神天架拳(2発止め) | target_combo | 1 | 0 | `p_l chain p_m` | 6 | 26 |  |  |  |
| kimberly | `bushin_prism_strikes_3hits` | 武神天架拳(3発止め) | target_combo | 1 | 0 | `p_l chain p_m chain p_h` | 12 | 38 |  |  |  |
| kimberly | `bushin_tiger_fangs` | 武神虎連牙 | target_combo | 1 | 0 | `p_m chain p_h` | 10 | 38 |  |  |  |
| kimberly | `emergency_stop` | 急停止 | special | 1 | 0 | `p` | 22 | 22 |  |  |  |
| kimberly | `emergency_stop_od` | OD急停止 | special | 1 | 0 | `p` | 19 | 19 |  |  |  |
| kimberly | `neck_hunter` | 首狩り | special | 1 | 0 | `k_h` | 27 | 50 |  |  |  |
| kimberly | `neck_hunter_od` | OD首狩り | special | 1 | 0 | `k_h` | 23 | 46 |  |  |  |
| kimberly | `sa1_bushin_thunderous_beats` | SA1 武神乱拍子・雷譜 | super_art | 1 | 0 | `d dr r d dr r plus k hold` | 10 | 64 |  |  |  |
| kimberly | `shadow_slide` | 影すくい | special | 1 | 0 | `k_m` | 18 | 48 |  |  |  |
| kimberly | `shadow_slide_od` | OD影すくい | special | 1 | 0 | `k_m` | 16 | 46 |  |  |  |
| kimberly | `step_up_backward` | 矢来越え(後方) | unique | 1 | 1 | `ul` | 30 | 33 |  |  |  |
| kimberly | `step_up_forward` | 矢来越え(前方) | unique | 1 | 1 | `ur` | 30 | 33 |  |  |  |
| kimberly | `step_up_neutral` | 矢来越え(垂直) | unique | 1 | 1 | `u` | 30 | 33 |  |  |  |
| kimberly | `torso_cleaver` | 胴刎ね | special | 1 | 0 | `k_l` | 29 | 51 |  |  |  |
| kimberly | `torso_cleaver_od` | OD胴刎ね | special | 1 | 0 | `k_l` | 25 | 47 |  |  |  |
| lily | `condor_dive_follow_up` | コンドルダイブ(派生) | special | 1 | 0 | `` | 12 | 48 |  |  |  |
| lily | `desert_storm` | デザートストーム | target_combo | 1 | 0 | `r plus p_h chain p_h chain p_h` | 20 | 61 |  |  |  |
| lily | `desert_storm_2hits` | デザートストーム(2発止め) | target_combo | 1 | 0 | `r plus p_h chain p_h` | 20 | 48 |  |  |  |
| lily | `double_arrow` | ダブルアロー | target_combo | 1 | 0 | `p_m chain p_m` |  |  |  | （ジャンプ中に） |  |
| lily | `windclad_condor_dive` | [風纏い]コンドルダイブ | special | 1 | 0 | `p p` | 26 | 60 |  |  |  |
| lily | `windclad_heavy_condor_spire` | [風纏い]強コンドルスパイア | special | 1 | 0 | `d dr r plus k_h` | 17 | 59 |  |  |  |
| lily | `windclad_heavy_tomahawk_buster` | [風纏い]強トマホークバスター | special | 1 | 0 | `r d dr plus p_h` | 8 | 61 |  |  |  |
| lily | `windclad_light_condor_spire` | [風纏い]弱コンドルスパイア | special | 1 | 0 | `d dr r plus k_l` | 9 | 51 |  |  |  |
| lily | `windclad_light_tomahawk_buster` | [風纏い]弱トマホークバスター | special | 1 | 0 | `r d dr plus p_l` | 4 | 49 |  |  |  |
| lily | `windclad_medium_condor_spire` | [風纏い]中コンドルスパイア | special | 1 | 0 | `d dr r plus k_m` | 13 | 55 |  |  |  |
| lily | `windclad_medium_tomahawk_buster` | [風纏い]中トマホークバスター | special | 1 | 0 | `r d dr plus p_m` | 6 | 56 |  |  |  |
| lily | `windclad_od_condor_dive` | [風纏い]ODコンドルダイブ | special | 1 | 0 | `p p p` | 26 | 59 |  |  |  |
| lily | `windclad_od_condor_dive_follow_up` | ODコンドルダイブ(派生) | special | 1 | 0 | `` | 12 | 48 |  |  |  |
| lily | `windclad_od_condor_spire` | [風纏い]ODコンドルスパイア | special | 1 | 0 | `` | 9 | 46 |  |  |  |
| lily | `windclad_od_tomahawk_buster` | [風纏い]ODトマホークバスター | special | 1 | 0 | `r d dr plus p p` | 4 | 60 |  |  |  |
| lily | `windclad_sa2_soaring_thunderbird` | SA2 [風纏い]スカイサンダーバード | super_art | 1 | 0 | `d dr r d dr r plus k` | 15 | 104 |  |  |  |
| lily | `windclad_sa2_thunderbird` | SA2 [風纏い]サンダーバード | super_art | 1 | 0 | `d dr r d dr r plus k` | 9 | 104 |  |  |  |
| mai | `flame_heavy_hishou_ryuuenjin` | [焔版]強飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_h` | 7 | 53 |  |  |  |
| mai | `flame_heavy_hissatsu_shinobi_bachi` | [焔版]強必殺忍蜂 | special | 1 | 0 | `d dr r plus k_h` | 18 | 68 |  |  |  |
| mai | `flame_heavy_kachousen` | [焔版]強花蝶扇 | special | 1 | 0 | `d dr r plus p_h` | 12 | 45 |  |  |  |
| mai | `flame_heavy_kachousen_holding` | [焔版]強花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_h hold` | 32 | 62 |  |  |  |
| mai | `flame_heavy_ryuuenbu` | [焔版]強龍炎舞 | special | 1 | 0 | `d dl l plus p_h` | 14 | 48 |  |  |  |
| mai | `flame_light_hishou_ryuuenjin` | [焔版]弱飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_l` | 5 | 52 |  |  |  |
| mai | `flame_light_hissatsu_shinobi_bachi` | [焔版]弱必殺忍蜂 | special | 1 | 0 | `d dr r plus k_l` | 10 | 55 |  |  |  |
| mai | `flame_light_kachousen` | [焔版]弱花蝶扇 | special | 1 | 0 | `d dr r plus p_l` | 16 | 45 |  |  |  |
| mai | `flame_light_kachousen_holding` | [焔版]弱花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_l hold` | 32 | 62 |  |  |  |
| mai | `flame_light_ryuuenbu` | [焔版]弱龍炎舞 | special | 1 | 0 | `d dl l plus p_l` | 14 | 35 |  |  |  |
| mai | `flame_medium_hishou_ryuuenjin` | [焔版]中飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_m` | 6 | 52 |  |  |  |
| mai | `flame_medium_hissatsu_shinobi_bachi` | [焔版]中必殺忍蜂 | special | 1 | 0 | `d dr r plus k_m` | 15 | 64 |  |  |  |
| mai | `flame_medium_kachousen` | [焔版]中花蝶扇 | special | 1 | 0 | `d dr r plus p_m` | 14 | 45 |  |  |  |
| mai | `flame_medium_kachousen_holding` | [焔版]中花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_m hold` | 32 | 62 |  |  |  |
| mai | `flame_medium_ryuuenbu` | [焔版]中龍炎舞 | special | 1 | 0 | `d dl l plus p_m` | 14 | 47 |  |  |  |
| mai | `flame_midare_kachousen` | [焔版]乱れ花蝶扇 | special | 1 | 0 | `r plus p` | 27 | 95 |  |  |  |
| mai | `flame_musasabi_no_mai` | [焔版]ムササビの舞 | special | 1 | 0 | `d dl l plus p` | 32 | 62 |  |  |  |
| mai | `flame_od_hishou_ryuuenjin` | [焔版]OD飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k k` | 6 | 57 |  |  |  |
| mai | `flame_od_hissatsu_shinobi_bachi` | [焔版]OD必殺忍蜂 | special | 1 | 0 | `d dr r plus k k` | 14 | 77 |  |  |  |
| mai | `flame_od_kachousen` | [焔版]OD花蝶扇 | special | 1 | 0 | `d dr r plus p p` | 12 | 42 |  |  |  |
| mai | `flame_od_kachousen_holding` | [焔版]OD花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p p hold` | 28 | 58 |  |  |  |
| mai | `flame_od_musasabi_no_mai` | [焔版]ODムササビの舞 | special | 1 | 0 | `d dl l plus p p` | 32 | 62 |  |  |  |
| mai | `flame_od_ryuuenbu` | [焔版]OD龍炎舞 | special | 1 | 0 | `d dl l plus p p` | 16 | 62 |  |  |  |
| mai | `flame_sa1_kagerou_no_mai` | [焔版]SA1 陽炎の舞 | super_art | 1 | 0 | `d dr r d dr r plus p` | 6 | 141 |  |  |  |
| mai | `flame_sa2_air_chou_hissatsu_shinobi_bachi` | [焔版]SA2 空中超必殺忍蜂 | super_art | 1 | 0 | `d dr r d dr r plus k` | 12 | 97 |  |  |  |
| mai | `flame_sa2_chou_hissatsu_shinobi_bachi` | [焔版]SA2 超必殺忍蜂 | super_art | 1 | 0 | `d dr r d dr r plus k` | 7 | 73 |  |  |  |
| mai | `hien_ren_kyaku` | 飛燕連脚 | target_combo | 1 | 0 | `k_l chain k_l chain k_l` | 10 | 39 |  |  |  |
| mai | `hien_ren_kyaku_2hits` | 飛燕連脚(2発止め) | target_combo | 1 | 0 | `k_l chain k_l` | 7 | 28 |  |  |  |
| mai | `hoshi_kujaku` | 星孔雀 | target_combo | 1 | 0 | `l plus k_h chain k_h` | 9 | 58 |  |  |  |
| mai | `midare_kachousen` | 乱れ花蝶扇 | special | 1 | 0 | `r plus p` | 27 | 95 |  |  |  |
| mai | `musasabi_no_mai` | ムササビの舞 | special | 1 | 0 | `d dl l plus p` | 32 | 62 |  |  |  |
| mai | `musasabi_no_mai_od` | ODムササビの舞 | special | 1 | 0 | `d dl l plus p p` | 32 | 62 |  |  |  |
| manon | `a_terre` | ア・テール | target_combo | 1 | 0 | `p_m chain k_m` | 10 | 28 |  |  |  |
| manon | `allonge` | アロンジェ | target_combo | 1 | 0 | `d plus p_h chain p_h` | 4 | 33 |  |  |  |
| manon | `en_haut` | アン・オー | target_combo | 1 | 0 | `l plus k_m chain k_m` | 14 | 39 |  |  |  |
| manon | `grand_fouette_heavy` | 強グラン・フェッテ | special | 1 | 0 | `` | 29 | 56 |  |  |  |
| manon | `grand_fouette_light` | 弱グラン・フェッテ | special | 1 | 0 | `` | 27 | 54 |  |  |  |
| manon | `grand_fouette_medium` | 中グラン・フェッテ | special | 1 | 0 | `` | 28 | 55 |  |  |  |
| manon | `grand_fouette_od` | ODグラン・フェッテ | special | 1 | 0 | `k` | 25 | 52 |  |  |  |
| manon | `renverse_feint_heavy` | 強ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 33 |  |  |  |
| manon | `renverse_feint_light` | 弱ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 31 |  |  |  |
| manon | `renverse_feint_medium` | 中ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 32 |  |  |  |
| manon | `renverse_feint_od` | ODランヴェルセ(フェイント) | special | 1 | 0 | `` | 4 | 33 |  |  |  |
| manon | `temps_lie` | タン・リエ | target_combo | 1 | 0 | `p_h chain p_h` | 5 | 28 |  |  |  |
| ryu | `denjin_charge_hadoken` | [電刃錬気]波動拳 | special | 1 | 0 | `d dr r plus p` | 12 | 40 |  |  |  |
| ryu | `denjin_charge_hashogeki` | [電刃錬気]波掌撃 | special | 1 | 0 | `d dl l plus p` | 20 | 44 |  |  |  |
| ryu | `denjin_charge_od_hadoken` | [電刃錬気]OD波動拳 | special | 1 | 0 | `d dr r plus p p` | 12 | 38 |  |  |  |
| ryu | `denjin_charge_od_hashogeki` | [電刃錬気]OD波掌撃 | special | 1 | 0 | `d dl l plus p p` | 18 | 42 |  |  |  |
| ryu | `denjin_charge_sa1_shinku_hadoken` | [電刃錬気]SA1 真空波動拳 | super_art | 1 | 0 | `d dr r d dr r plus p` | 7 | 89 |  |  |  |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv1` | [電刃錬気]SA2 真波掌撃(Lv1) | super_art | 1 | 0 | `d dl l d dl l plus p` | 12 | 56 |  |  |  |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv2` | [電刃錬気]SA2 真波掌撃(Lv2) | super_art | 1 | 0 | `d dl l d dl l plus p` | 18 | 62 |  |  |  |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv3` | [電刃錬気]SA2 真波掌撃(Lv3) | super_art | 1 | 0 | `d dl l d dl l plus p` | 50 | 94 |  |  |  |
| ryu | `fuwa_triple_strike` | 不破三連撃 | target_combo | 1 | 0 | `p_m chain k_l chain k_h` | 17 | 40 |  |  |  |
| ryu | `fuwa_triple_strike_2hits` | 不破三連撃(2発止め) | target_combo | 1 | 0 | `p_m chain k_l` | 5 | 23 |  |  |  |
| ryu | `high_double_strike` | 上段二連撃 | target_combo | 1 | 0 | `p_h chain k_h` | 9 | 32 |  |  |  |
| terry | `fire_kick` | ファイヤーキック | target_combo | 1 | 0 | `d plus k_m chain d plus k_h` | 13 | 42 |  |  |  |
| terry | `jumping_knee` | ジャンプニーアタック | target_combo | 1 | 0 | `p_m chain k_m chain k_m` | 24 | 45 |  |  |  |
| terry | `jumping_lariat` | ジャンプラリアットパンチ | target_combo | 1 | 0 | `p_m chain k_m chain p_m` | 24 | 43 |  |  |  |
| terry | `passing_sway` | パッシングスウェー | target_combo | 1 | 0 | `p_m chain k_m` | 13 | 52 |  |  |  |
| terry | `power_drive` | パワードライブ | target_combo | 1 | 0 | `p_m chain p_h` | 15 | 39 |  |  |  |
| terry | `power_dunk` | パワーダンク | target_combo | 1 | 0 | `p_m chain k_h chain k_h` | 18 | 80 |  |  |  |
| terry | `power_shoot` | パワーシュート | target_combo | 1 | 0 | `p_m chain k_h` | 18 | 51 |  |  |  |
| terry | `sa2_triple_geyser` | SA2 トリプルゲイザー | super_art | 1 | 0 | `p p` | 14 | 139 |  |  |  |
| terry | `sa2_twin_geyser` | SA2 ツインゲイザー | super_art | 1 | 0 | `p p` | 22 | 70 |  |  |  |
| zangief | `sa2_cyclone_lariat_back` | SA2 サイクロンラリアット(後ろ) | super_art | 1 | 0 | `d dr r d dr r plus p` | 18 | 171 |  |  |  |
| zangief | `sa2_cyclone_lariat_holding` | SA2 サイクロンラリアット(ホールド) | super_art | 1 | 0 | `d dr r d dr r plus p` | 18 | 171 |  |  |  |

## 2. `fastest_unreachable` の B 型（7 行）

**判断すること**: 単独で最速入力して地上の相手に当てられるか。当てられない（＝スカラー S の target にできない）なら `true`。
C 型（通常ジャンプ攻撃）は 000050 で機械付与済みのため本表には出ない。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 記入: fastest_unreachable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| kimberly | `elbow_drop` | 肘落とし | unique | 0 | 1 | `d plus p_m` | 27 | 47 |  |  |  |
| kimberly | `step_up_backward` | 矢来越え(後方) | unique | 1 | 1 | `ul` | 30 | 33 |  |  |  |
| kimberly | `step_up_forward` | 矢来越え(前方) | unique | 1 | 1 | `ur` | 30 | 33 |  |  |  |
| kimberly | `step_up_neutral` | 矢来越え(垂直) | unique | 1 | 1 | `u` | 30 | 33 |  |  |  |
| lily | `great_spin` | グレートスピン | unique | 0 | 1 | `d plus p_h` | 9 | 48 |  |  |  |
| zangief | `flying_body_press` | フライングボディプレス | unique | 0 | 1 | `d plus p_h` | 9 | 52 |  |  |  |
| zangief | `flying_headbutt` | フライングヘッドバット | unique | 0 | 1 | `u plus p_h` | 8 | 47 |  |  |  |

## 3. `chain_cancel_total`（10 行）

**判断すること**: 連打キャンセルがつながるか。つながるなら**実測値**を入れる。

> **絞り込み条件について**: 実測資料 `character_data/chain-cancel-measurements.md` v2.3.0 の確定ロースターは
> `Stand LP` / `Stand LK` / `Crouch LP` / `Crouch LK` の地上弱通常技 4 種のみである。seed 済み 11 キャラの
> 該当行は 44 行で、うち 34 行は実測済み（000052 で投入済み）。残る 10 行を本表に出している。
> **開発者確認済み**（2026-08-01）。なお必殺技に一部対象がある可能性は開発者が並行調査中のため本表には含めない。
>
> **★「total − 4」等の規則で埋めてはならない。** 実測資料 §1 が、同一の単発値が最大 3 通りの実消費に
> 割れることを多重検算つきで示している（例: `5/3/8/15` が 11 / 11 / 12 / 13）。**値は実測すること。**
> つながらない技は空欄のままにする（`chain_cancel_total` が NULL であること自体が「チェーングループ員でない」の意味）。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 記入: chain_cancel_total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guile | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| ingrid | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| juri | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 16 |  |  |  |
| ken | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| kimberly | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| mai | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 4 | 14 |  |  |  |
| manon | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| ryu | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| terry | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  |  |
| zangief | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 7 | 25 |  |  |  |

---

*以上。M19-04（CHANGE-091）§4.7 の成果物 7。*
