-- 000090_seed_aliases_numeric_fourth_wave.up.sql
-- M14-03f: 第四波 14 キャラの表記プリセット numeric のエイリアス(移動系 9 code は新 12 キャラのみ)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- ★1 回きりの backfill ではなく「規則」の出力である(D-181)。新キャラ CSV を投入する
--   seed 波では、本規則を再適用して新しい連番のマイグレを起こすこと
--   (手順は character_data/seed-progress.md)。
-- 層順の原理: command が表記を決める行は層 A、move_code の構造が決める行は層 B。
-- 移動系 9 code は投入先キャラを明示列挙する(up と down を同じ集合で絞るため = H-2)。
-- 再適用時は NOT EXISTS ガードで skip する(upsert にしない = 既存行を書き換えない)。
-- 既存マイグレは非改変(新規連番で追加)。FK 依存順 characters→moves→preset_aliases。

-- ===== 層 C-1: 移動系 9 code x 12 キャラ =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text, alias_text_en)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text, v.alias_text_en
FROM moves m
JOIN characters c ON c.id = m.character_id
JOIN games g ON g.id = c.game_id AND g.code = 'sf6'
CROSS JOIN (
        SELECT 'forward' AS code, '6' AS alias_text, NULL AS alias_text_en
  UNION ALL SELECT 'back', '4', NULL
  UNION ALL SELECT 'dash_forward', '66', NULL
  UNION ALL SELECT 'dash_back', '44', NULL
  UNION ALL SELECT 'jump_neutral', '8', NULL
  UNION ALL SELECT 'jump_forward', '9', NULL
  UNION ALL SELECT 'jump_back', '7', NULL
  UNION ALL SELECT 'micro_forward', '微歩き', 'microwalk'
  UNION ALL SELECT 'micro_back', '微下がり', 'back microwalk'
) AS v
WHERE c.code IN ('aki', 'akuma', 'alex', 'blanka', 'cammy', 'chun_li', 'dee_jay', 'e_honda', 'ed', 'elena', 'sagat', 'yasmine')
  AND m.code = v.code AND m.category = 'system'
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== aki (61 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_claws_of_ya_zi' AS code, '236236P (CA)' AS alias_text
  UNION ALL SELECT 'chi_wen', '6HP'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'cruel_fate_heavy', '214HK'
  UNION ALL SELECT 'cruel_fate_light', '214LK'
  UNION ALL SELECT 'cruel_fate_medium', '214MK'
  UNION ALL SELECT 'cruel_fate_od', '214K+K'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hun_dun', 'LP>LP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'nightshade_pulse', '214LP'
  UNION ALL SELECT 'nightshade_pulse_od', '214P+P'
  UNION ALL SELECT 'orchid_spring', '214MP'
  UNION ALL SELECT 'pu_lao', '3MP'
  UNION ALL SELECT 'qiong_qi', 'HP>HP'
  UNION ALL SELECT 'qiu_niu', '6HK'
  UNION ALL SELECT 'rush_chi_wen', 'DR > 6HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_pu_lao', 'DR > 3MP'
  UNION ALL SELECT 'rush_qiu_niu', 'DR > 6HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'sa1_deadly_implication', '236236K (SA1)'
  UNION ALL SELECT 'sa2_tainted_talons', '214214P (SA2)'
  UNION ALL SELECT 'sa3_claws_of_ya_zi', '236236P (SA3)'
  UNION ALL SELECT 'serpent_lash_heavy', '236HP'
  UNION ALL SELECT 'serpent_lash_light', '236LP'
  UNION ALL SELECT 'serpent_lash_medium', '236MP'
  UNION ALL SELECT 'serpent_lash_od', '236P+P'
  UNION ALL SELECT 'sinister_slide', '2P+P'
  UNION ALL SELECT 'snake_step_heavy', '236HK'
  UNION ALL SELECT 'snake_step_light', '236LK'
  UNION ALL SELECT 'snake_step_medium', '236MK'
  UNION ALL SELECT 'snake_step_od', '236K+K'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'toxic_wreath', '214HP'
) AS v
WHERE c.code = 'aki' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== akuma (67 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text, alias_text_en)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text, v.alias_text_en
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'adamant_flame_1hit_heavy' AS code, '214HP' AS alias_text, NULL AS alias_text_en
  UNION ALL SELECT 'adamant_flame_1hit_light', '214LP', NULL
  UNION ALL SELECT 'adamant_flame_1hit_medium', '214MP', NULL
  UNION ALL SELECT 'adamant_flame_1hit_od', '214P+P', NULL
  UNION ALL SELECT 'ashura_senku_backward', '4K+K+K', NULL
  UNION ALL SELECT 'ashura_senku_forward', '6K+K+K', NULL
  UNION ALL SELECT 'ca_shun_goku_satsu', 'LP>LP>6>LK>HP (CA)', NULL
  UNION ALL SELECT 'ca_sip_of_calamity', '236236K (CA)', NULL
  UNION ALL SELECT 'crouching_heavy_kick', '2HK', NULL
  UNION ALL SELECT 'crouching_heavy_punch', '2HP', NULL
  UNION ALL SELECT 'crouching_light_kick', '2LK', NULL
  UNION ALL SELECT 'crouching_light_punch', '2LP', NULL
  UNION ALL SELECT 'crouching_medium_kick', '2MK', NULL
  UNION ALL SELECT 'crouching_medium_punch', '2MP', NULL
  UNION ALL SELECT 'demon_low_slash', '百鬼豪斬', 'demon low slash'
  UNION ALL SELECT 'demon_low_slash_od', 'OD百鬼豪斬', 'demon low slash OD'
  UNION ALL SELECT 'demon_raid_heavy', '236HK', NULL
  UNION ALL SELECT 'demon_raid_light', '236LK', NULL
  UNION ALL SELECT 'demon_raid_medium', '236MK', NULL
  UNION ALL SELECT 'demon_raid_od', '236K+K', NULL
  UNION ALL SELECT 'drive_impact', 'HP+HK', NULL
  UNION ALL SELECT 'drive_parry', 'MP+MK', NULL
  UNION ALL SELECT 'gou_shoryuken_heavy', '623HP', NULL
  UNION ALL SELECT 'gou_shoryuken_light', '623LP', NULL
  UNION ALL SELECT 'gou_shoryuken_medium', '623MP', NULL
  UNION ALL SELECT 'gou_shoryuken_od', '623P+P', NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK', NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP', NULL
  UNION ALL SELECT 'jumping_light_kick', 'j.LK', NULL
  UNION ALL SELECT 'jumping_light_punch', 'j.LP', NULL
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK', NULL
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP', NULL
  UNION ALL SELECT 'kikoku_combination_1hit', '6HP', NULL
  UNION ALL SELECT 'rago_high_kick', '4HK', NULL
  UNION ALL SELECT 'resso_snap_kick', '6MK', NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK', NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP', NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK', NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP', NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK', NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP', NULL
  UNION ALL SELECT 'rush_kikoku_combination_1hit', 'DR > 6HP', NULL
  UNION ALL SELECT 'rush_rago_high_kick', 'DR > 4HK', NULL
  UNION ALL SELECT 'rush_resso_snap_kick', 'DR > 6MK', NULL
  UNION ALL SELECT 'rush_skull_splitter', 'DR > 6MP', NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK', NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP', NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK', NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP', NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK', NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP', NULL
  UNION ALL SELECT 'sa1_messatsu_gohado', '236236P (SA1)', NULL
  UNION ALL SELECT 'sa2_empyreans_end', '214214P (SA2)', NULL
  UNION ALL SELECT 'sa3_sip_of_calamity', '236236K (SA3)', NULL
  UNION ALL SELECT 'skull_splitter', '6MP', NULL
  UNION ALL SELECT 'standing_heavy_kick', '5HK', NULL
  UNION ALL SELECT 'standing_heavy_punch', '5HP', NULL
  UNION ALL SELECT 'standing_light_kick', '5LK', NULL
  UNION ALL SELECT 'standing_light_punch', '5LP', NULL
  UNION ALL SELECT 'standing_medium_kick', '5MK', NULL
  UNION ALL SELECT 'standing_medium_punch', '5MP', NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_heavy', '214HK', NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_light', '214LK', NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_medium', '214MK', NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_od', '214K+K', NULL
  UNION ALL SELECT 'throw_back', '4LP+LK', NULL
  UNION ALL SELECT 'throw_forward', '5/6LP+LK', NULL
) AS v
WHERE c.code = 'akuma' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== alex (58 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_knee_smash_heavy' AS code, '623HK' AS alias_text
  UNION ALL SELECT 'aerial_knee_smash_light', '623LK'
  UNION ALL SELECT 'aerial_knee_smash_medium', '623MK'
  UNION ALL SELECT 'aerial_knee_smash_od', '623K+K'
  UNION ALL SELECT 'ca_the_final_prison', '236236P (CA)'
  UNION ALL SELECT 'chop', '6MP'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'flash_axe_light', '236LP'
  UNION ALL SELECT 'flash_axe_medium', '236MP'
  UNION ALL SELECT 'flash_chop', '236HP'
  UNION ALL SELECT 'flash_chop_od', '236P+P'
  UNION ALL SELECT 'illegal_knees', '2LP+LK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'oblique_stomp', '4MK'
  UNION ALL SELECT 'power_bomb_heavy', '63214HP'
  UNION ALL SELECT 'power_bomb_light', '63214LP'
  UNION ALL SELECT 'power_bomb_medium', '63214MP'
  UNION ALL SELECT 'power_bomb_od', '63214P+P'
  UNION ALL SELECT 'prowler_stance', '2P+P'
  UNION ALL SELECT 'rush_chop', 'DR > 6MP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_oblique_stomp', 'DR > 4MK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_kick_holding', 'DR > HK(hold)'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', 'DR > HP(hold)'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'sa1_raging_spear', '236236K (SA1)'
  UNION ALL SELECT 'sa2_sledgecross_hammer', '214214P (SA2)'
  UNION ALL SELECT 'sa3_the_final_prison', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_kick_holding', 'HK(hold)'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_heavy_punch_holding', 'HP(hold)'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'alex' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== blanka (73 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'amazon_river_run' AS code, '3HP' AS alias_text
  UNION ALL SELECT 'backstep_rolling_attack_heavy', '63214HK'
  UNION ALL SELECT 'backstep_rolling_attack_light', '63214LK'
  UNION ALL SELECT 'backstep_rolling_attack_medium', '63214MK'
  UNION ALL SELECT 'backstep_rolling_attack_od', '63214K+K'
  UNION ALL SELECT 'blanka_chan_bomb', '22P'
  UNION ALL SELECT 'ca_ground_shave_cannonball', '236236K (CA)'
  UNION ALL SELECT 'coward_crouch', '2P+P'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'double_knee_bombs', '6MK'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'electric_thunder', '214P'
  UNION ALL SELECT 'electric_thunder_holding', '214P(hold)'
  UNION ALL SELECT 'electric_thunder_holding_od', '214P+P(hold)'
  UNION ALL SELECT 'electric_thunder_od', '214P+P'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'neutral_jumping_heavy_punch', 'HP'
  UNION ALL SELECT 'rock_crusher', '6MP'
  UNION ALL SELECT 'rush_amazon_river_run', 'DR > 3HP'
  UNION ALL SELECT 'rush_coward_crouch', 'DR > 2P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_double_knee_bombs', 'DR > 6MK'
  UNION ALL SELECT 'rush_rock_crusher', 'DR > 6MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_surprise_back_hop', 'DR > 4K+K+K'
  UNION ALL SELECT 'rush_surprise_forward_hop', 'DR > 6K+K+K'
  UNION ALL SELECT 'rush_wild_edge', 'DR > 4MK'
  UNION ALL SELECT 'rush_wild_nail', 'DR > 6HP'
  UNION ALL SELECT 'sa1_shout_of_earth', '236236P (SA1)'
  UNION ALL SELECT 'sa2_lightning_beast', '214214P (SA2)'
  UNION ALL SELECT 'sa3_ground_shave_cannonball', '236236K (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'surprise_back_hop', '4K+K+K'
  UNION ALL SELECT 'surprise_forward_hop', '6K+K+K'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'vertical_rolling_attack_heavy', '[2]8HK'
  UNION ALL SELECT 'vertical_rolling_attack_light', '[2]8LK'
  UNION ALL SELECT 'vertical_rolling_attack_medium', '[2]8MK'
  UNION ALL SELECT 'vertical_rolling_attack_od', '[2]8K+K'
  UNION ALL SELECT 'wild_bites', 'LP+LK'
  UNION ALL SELECT 'wild_edge', '4MK'
  UNION ALL SELECT 'wild_hunt_heavy', '236HK'
  UNION ALL SELECT 'wild_hunt_light', '236LK'
  UNION ALL SELECT 'wild_hunt_medium', '236MK'
  UNION ALL SELECT 'wild_hunt_od', '236K+K'
  UNION ALL SELECT 'wild_nail', '6HP'
) AS v
WHERE c.code = 'blanka' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== cammy (67 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text, alias_text_en)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text, v.alias_text_en
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'assault_blade' AS code, '4HK' AS alias_text, NULL AS alias_text_en
  UNION ALL SELECT 'ca_delta_red_assault', '236236P (CA)', NULL
  UNION ALL SELECT 'cannon_spike_heavy', '623HK', NULL
  UNION ALL SELECT 'cannon_spike_light', '623LK', NULL
  UNION ALL SELECT 'cannon_spike_medium', '623MK', NULL
  UNION ALL SELECT 'cannon_spike_od', '623K+K', NULL
  UNION ALL SELECT 'cannon_strike_heavy', '214HK', NULL
  UNION ALL SELECT 'cannon_strike_light', '214LK', NULL
  UNION ALL SELECT 'cannon_strike_medium', '214MK', NULL
  UNION ALL SELECT 'cannon_strike_od', '214K+K', NULL
  UNION ALL SELECT 'crouching_heavy_kick', '2HK', NULL
  UNION ALL SELECT 'crouching_heavy_punch', '2HP', NULL
  UNION ALL SELECT 'crouching_light_kick', '2LK', NULL
  UNION ALL SELECT 'crouching_light_punch', '2LP', NULL
  UNION ALL SELECT 'crouching_medium_kick', '2MK', NULL
  UNION ALL SELECT 'crouching_medium_punch', '2MP', NULL
  UNION ALL SELECT 'delayed_ripper', '6HK', NULL
  UNION ALL SELECT 'drive_impact', 'HP+HK', NULL
  UNION ALL SELECT 'drive_parry', 'MP+MK', NULL
  UNION ALL SELECT 'hooligan_combination_heavy', '236HP', NULL
  UNION ALL SELECT 'hooligan_combination_light', '236LP', NULL
  UNION ALL SELECT 'hooligan_combination_medium', '236MP', NULL
  UNION ALL SELECT 'hooligan_combination_od', '236P+P', NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK', NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP', NULL
  UNION ALL SELECT 'jumping_light_kick', 'j.LK', NULL
  UNION ALL SELECT 'jumping_light_punch', 'j.LP', NULL
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK', NULL
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP', NULL
  UNION ALL SELECT 'leg_scissors_choke', 'LP+LK', NULL
  UNION ALL SELECT 'lift_uppercut', '4MP', NULL
  UNION ALL SELECT 'quick_spin_knuckle_heavy', '214HP', NULL
  UNION ALL SELECT 'quick_spin_knuckle_light', '214LP', NULL
  UNION ALL SELECT 'quick_spin_knuckle_medium', '214MP', NULL
  UNION ALL SELECT 'quick_spin_knuckle_od', '214P+P', NULL
  UNION ALL SELECT 'razors_edge_slicer', 'レイザーエッジスライサー(フーリガンコンビネーション派生)', 'razors edge slicer'
  UNION ALL SELECT 'razors_edge_slicer_holding', 'レイザーエッジスライサー(【ホールド】強フーリガンコンビネーション派生)', 'razors edge slicer holding'
  UNION ALL SELECT 'razors_edge_slicer_od', 'ODレイザーエッジスライサー(ODフーリガンコンビネーション派生)', 'razors edge slicer OD'
  UNION ALL SELECT 'rush_assault_blade', 'DR > 4HK', NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK', NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP', NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK', NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP', NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK', NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP', NULL
  UNION ALL SELECT 'rush_delayed_ripper', 'DR > 6HK', NULL
  UNION ALL SELECT 'rush_lift_uppercut', 'DR > 4MP', NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK', NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP', NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK', NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP', NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK', NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP', NULL
  UNION ALL SELECT 'sa1_spin_drive_smasher', '236236K (SA1)', NULL
  UNION ALL SELECT 'sa3_delta_red_assault', '236236P (SA3)', NULL
  UNION ALL SELECT 'spiral_arrow_heavy', '236HK', NULL
  UNION ALL SELECT 'spiral_arrow_light', '236LK', NULL
  UNION ALL SELECT 'spiral_arrow_medium', '236MK', NULL
  UNION ALL SELECT 'spiral_arrow_od', '236K+K', NULL
  UNION ALL SELECT 'standing_heavy_kick', '5HK', NULL
  UNION ALL SELECT 'standing_heavy_punch', '5HP', NULL
  UNION ALL SELECT 'standing_light_kick', '5LK', NULL
  UNION ALL SELECT 'standing_light_punch', '5LP', NULL
  UNION ALL SELECT 'standing_medium_kick', '5MK', NULL
  UNION ALL SELECT 'standing_medium_punch', '5MP', NULL
  UNION ALL SELECT 'throw_back', '4LP+LK', NULL
  UNION ALL SELECT 'throw_forward', '5/6LP+LK', NULL
) AS v
WHERE c.code = 'cammy' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== chun_li (67 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_soten_ranka' AS code, '214214K (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'falling_crane', '3HK'
  UNION ALL SELECT 'hakkei', '4HP'
  UNION ALL SELECT 'hazanshu_heavy', '214HK'
  UNION ALL SELECT 'hazanshu_light', '214LK'
  UNION ALL SELECT 'hazanshu_medium', '214MK'
  UNION ALL SELECT 'hazanshu_od', '214K+K'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'kikoken_heavy', '[4]6HP'
  UNION ALL SELECT 'kikoken_light', '[4]6LP'
  UNION ALL SELECT 'kikoken_medium', '[4]6MP'
  UNION ALL SELECT 'kikoken_od', '[4]6P+P'
  UNION ALL SELECT 'lightning_kick_barrage', 'K+K'
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_falling_crane', 'DR > 3HK'
  UNION ALL SELECT 'rush_hakkei', 'DR > 4HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_swift_thrust', 'DR > 4/6MP'
  UNION ALL SELECT 'rush_water_lotus_fist', 'DR > 3HP'
  UNION ALL SELECT 'rush_yokusen_kick', 'DR > 6HK'
  UNION ALL SELECT 'ryuseiraku', 'LP+LK'
  UNION ALL SELECT 'sa2_hoyoku_sen', '236236K (SA2)'
  UNION ALL SELECT 'sa3_soten_ranka', '214214K (SA3)'
  UNION ALL SELECT 'serenity_stream', '214P'
  UNION ALL SELECT 'spinning_bird_kick_heavy', '[2]8HK'
  UNION ALL SELECT 'spinning_bird_kick_light', '[2]8LK'
  UNION ALL SELECT 'spinning_bird_kick_medium', '[2]8MK'
  UNION ALL SELECT 'spinning_bird_kick_od', '[2]8K+K'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'swift_thrust', '4/6MP'
  UNION ALL SELECT 'tensho_kicks_heavy', '22HK'
  UNION ALL SELECT 'tensho_kicks_light', '22LK'
  UNION ALL SELECT 'tensho_kicks_medium', '22MK'
  UNION ALL SELECT 'tensho_kicks_od', '22K+K'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'water_lotus_fist', '3HP'
  UNION ALL SELECT 'yokusen_kick', '6HK'
) AS v
WHERE c.code = 'chun_li' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== dee_jay (61 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'air_slasher_heavy' AS code, '[4]6HP' AS alias_text
  UNION ALL SELECT 'air_slasher_light', '[4]6LP'
  UNION ALL SELECT 'air_slasher_medium', '[4]6MP'
  UNION ALL SELECT 'air_slasher_od', '[4]6P+P'
  UNION ALL SELECT 'ca_weekend_pleasure', '214214P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'double_rolling_sobat', '236HK'
  UNION ALL SELECT 'double_rolling_sobat_od', '236K+K'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'face_breaker', '4HK'
  UNION ALL SELECT 'jackknife_maximum_heavy', '[2]8HK'
  UNION ALL SELECT 'jackknife_maximum_light', '[2]8LK'
  UNION ALL SELECT 'jackknife_maximum_medium', '[2]8MK'
  UNION ALL SELECT 'jackknife_maximum_od', '[2]8K+K'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'jus_cool', '214K'
  UNION ALL SELECT 'jus_cool_od', '214K+K'
  UNION ALL SELECT 'machine_gun_uppercut_heavy', '214HP'
  UNION ALL SELECT 'machine_gun_uppercut_light', '214LP'
  UNION ALL SELECT 'machine_gun_uppercut_medium', '214MP'
  UNION ALL SELECT 'machine_gun_uppercut_od', '214P+P'
  UNION ALL SELECT 'quick_rolling_sobat', '236MK'
  UNION ALL SELECT 'roll_through_feint', '236LK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_face_breaker', 'DR > 4HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_sunrise_heel', 'DR > 6MK'
  UNION ALL SELECT 'sa1_the_greatest_sobat', '236236K (SA1)'
  UNION ALL SELECT 'sa2_headliner_sunrise_festival', '236236HP (SA2)'
  UNION ALL SELECT 'sa2_lowkey_sunrise_festival', '236236LP (SA2)'
  UNION ALL SELECT 'sa2_marvelous_sunrise_festival', '236236MP (SA2)'
  UNION ALL SELECT 'sa3_weekend_pleasure', '214214P (SA3)'
  UNION ALL SELECT 'speedy_maracas', '22P+P'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'sunrise_heel', '6MK'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'dee_jay' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== e_honda (63 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_the_final_bout' AS code, '214214P (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'double_slaps', 'LP>MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'harai_kick', '6HK'
  UNION ALL SELECT 'hundred_hand_slap_heavy', '214HP'
  UNION ALL SELECT 'hundred_hand_slap_light', '214LP'
  UNION ALL SELECT 'hundred_hand_slap_medium', '214MP'
  UNION ALL SELECT 'hundred_hand_slap_od', '214P+P'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'neko_damashi', '22P'
  UNION ALL SELECT 'neutral_jumping_heavy_punch', 'HP'
  UNION ALL SELECT 'oicho_throw_heavy', '63214HK'
  UNION ALL SELECT 'oicho_throw_light', '63214LK'
  UNION ALL SELECT 'oicho_throw_medium', '63214MK'
  UNION ALL SELECT 'oicho_throw_od', '63214K+K'
  UNION ALL SELECT 'power_stomp', '3HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_harai_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_power_stomp', 'DR > 3HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'sa1_show_of_force', '236236P (SA1)'
  UNION ALL SELECT 'sa2_ultimate_killer_head_ram', '[4]646K (SA2)'
  UNION ALL SELECT 'sa3_the_final_bout', '214214P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'sumo_dash', '236K'
  UNION ALL SELECT 'sumo_dash_od', '236K+K'
  UNION ALL SELECT 'sumo_headbutt_heavy', '[4]6HP'
  UNION ALL SELECT 'sumo_headbutt_light', '[4]6LP'
  UNION ALL SELECT 'sumo_headbutt_medium', '[4]6MP'
  UNION ALL SELECT 'sumo_headbutt_od', '[4]6P+P'
  UNION ALL SELECT 'sumo_smash_heavy', '[2]8HK'
  UNION ALL SELECT 'sumo_smash_light', '[2]8LK'
  UNION ALL SELECT 'sumo_smash_medium', '[2]8MK'
  UNION ALL SELECT 'sumo_smash_od', '[2]8K+K'
  UNION ALL SELECT 'sumo_spirit', '22K'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'toko_shizume', 'MP>3HK'
) AS v
WHERE c.code = 'e_honda' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== ed (59 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_psycho_chamber' AS code, '236236P (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'kill_rush_backward', '4K+K'
  UNION ALL SELECT 'kill_rush_forward', 'K+K'
  UNION ALL SELECT 'psycho_blitz_heavy', '214HP'
  UNION ALL SELECT 'psycho_blitz_light', '214LP'
  UNION ALL SELECT 'psycho_blitz_medium', '214MP'
  UNION ALL SELECT 'psycho_blitz_od', '214P+P'
  UNION ALL SELECT 'psycho_flicker_heavy', '236HK'
  UNION ALL SELECT 'psycho_flicker_holding_heavy', '236HK(hold)'
  UNION ALL SELECT 'psycho_flicker_holding_light', '236LK(hold)'
  UNION ALL SELECT 'psycho_flicker_holding_medium', '236MK(hold)'
  UNION ALL SELECT 'psycho_flicker_light', '236LK'
  UNION ALL SELECT 'psycho_flicker_medium', '236MK'
  UNION ALL SELECT 'psycho_flicker_od', '236K+K'
  UNION ALL SELECT 'psycho_shoot_light', '6LP'
  UNION ALL SELECT 'psycho_shoot_medium', '6MP'
  UNION ALL SELECT 'psycho_spark', '236P'
  UNION ALL SELECT 'psycho_spark_od', '236P+P'
  UNION ALL SELECT 'psycho_uppercut_heavy', '623HP'
  UNION ALL SELECT 'psycho_uppercut_light', '623LP'
  UNION ALL SELECT 'psycho_uppercut_medium', '623MP'
  UNION ALL SELECT 'psycho_uppercut_od', '623P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'sa1_psycho_storm', '236236K (SA1)'
  UNION ALL SELECT 'sa2_psycho_cannon', '214214P (SA2)'
  UNION ALL SELECT 'sa3_psycho_chamber', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'ed' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== elena (66 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_song_of_the_grasslands' AS code, '214214K (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'handstand_whip_1hit', '6MK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'lynx_song_heavy', '236HP'
  UNION ALL SELECT 'lynx_song_light', '236LP'
  UNION ALL SELECT 'lynx_song_medium', '236MP'
  UNION ALL SELECT 'lynx_song_od', '236P+P'
  UNION ALL SELECT 'moon_glider_1hit_heavy', '214HP'
  UNION ALL SELECT 'moon_glider_1hit_light', '214LP'
  UNION ALL SELECT 'moon_glider_1hit_medium', '214MP'
  UNION ALL SELECT 'moon_glider_1hit_od', '214P+P'
  UNION ALL SELECT 'rhino_horn_heavy', '236HK'
  UNION ALL SELECT 'rhino_horn_light', '236LK'
  UNION ALL SELECT 'rhino_horn_medium', '236MK'
  UNION ALL SELECT 'rhino_horn_od', '236K+K'
  UNION ALL SELECT 'round_arch', '4HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_handstand_whip_1hit', 'DR > 6MK'
  UNION ALL SELECT 'rush_round_arch', 'DR > 4HK'
  UNION ALL SELECT 'rush_slide', 'DR > 3HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_trunk_slap_1hit', 'DR > 6HP'
  UNION ALL SELECT 'sa1_meteor_volley', '236236K (SA1)'
  UNION ALL SELECT 'sa2_revival_dance', '236236P (SA2)'
  UNION ALL SELECT 'sa3_song_of_the_grasslands', '214214K (SA3)'
  UNION ALL SELECT 'scratch_wheel_heavy', '623HK'
  UNION ALL SELECT 'scratch_wheel_light', '623LK'
  UNION ALL SELECT 'scratch_wheel_medium', '623MK'
  UNION ALL SELECT 'scratch_wheel_od', '623K+K'
  UNION ALL SELECT 'slide', '3HK'
  UNION ALL SELECT 'spinning_scythe_heavy', '214HK'
  UNION ALL SELECT 'spinning_scythe_light', '214LK'
  UNION ALL SELECT 'spinning_scythe_medium', '214MK'
  UNION ALL SELECT 'spinning_scythe_od', '214K+K'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'trunk_slap_1hit', '6HP'
) AS v
WHERE c.code = 'elena' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== sagat (67 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_tiger_vanquisher' AS code, '236236K (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'high_step_kick', '6HK'
  UNION ALL SELECT 'high_tiger_shot_heavy', '236HP'
  UNION ALL SELECT 'high_tiger_shot_medium', '236MP'
  UNION ALL SELECT 'high_tiger_shot_od', '236MP+HP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'low_step_kick', '6LK'
  UNION ALL SELECT 'low_tiger_shot', '236LP'
  UNION ALL SELECT 'low_tiger_shot_od', '236P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_high_step_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_low_step_kick', 'DR > 6LK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_tiger_heavy_elbow', 'DR > 6MP'
  UNION ALL SELECT 'rush_tiger_monolith', 'DR > 4HP'
  UNION ALL SELECT 'sa1_tiger_cannon', '236236P (SA1)'
  UNION ALL SELECT 'sa2_savage_tiger_pendulum', '214214K>4 (SA2)'
  UNION ALL SELECT 'sa2_savage_tiger_raid', '214214K (SA2)'
  UNION ALL SELECT 'sa2_savage_tiger_stomp', '214214K>2 (SA2)'
  UNION ALL SELECT 'sa2_savage_tiger_zenith', '214214K>6 (SA2)'
  UNION ALL SELECT 'sa3_tiger_vanquisher', '236236K (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'tiger_heavy_elbow', '6MP'
  UNION ALL SELECT 'tiger_knee_crush_heavy', '236HK'
  UNION ALL SELECT 'tiger_knee_crush_light', '236LK'
  UNION ALL SELECT 'tiger_knee_crush_medium', '236MK'
  UNION ALL SELECT 'tiger_knee_crush_od', '236K+K'
  UNION ALL SELECT 'tiger_monolith', '4HP'
  UNION ALL SELECT 'tiger_nexus_heavy', '214HK'
  UNION ALL SELECT 'tiger_nexus_light', '214LK'
  UNION ALL SELECT 'tiger_nexus_medium', '214MK'
  UNION ALL SELECT 'tiger_nexus_od', '214K+K'
  UNION ALL SELECT 'tiger_uppercut_heavy', '623HP'
  UNION ALL SELECT 'tiger_uppercut_holding_heavy', '623HP(hold)'
  UNION ALL SELECT 'tiger_uppercut_light', '623LP'
  UNION ALL SELECT 'tiger_uppercut_medium', '623MP'
  UNION ALL SELECT 'tiger_uppercut_od', '623P+P'
) AS v
WHERE c.code = 'sagat' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== yasmine (63 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_pamumukadkad_ng_sampaguita' AS code, '236236P (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'daloy_ng_tubig_heavy', '236HP'
  UNION ALL SELECT 'daloy_ng_tubig_light', '236LP'
  UNION ALL SELECT 'daloy_ng_tubig_medium', '236MP'
  UNION ALL SELECT 'daloy_ng_tubig_od', '236P+P'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hiwang_pababa', '6MP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'linya_ng_liwanag', '4K+K'
  UNION ALL SELECT 'lipad_ng_agila_heavy', '623HK'
  UNION ALL SELECT 'lipad_ng_agila_light', '623LK'
  UNION ALL SELECT 'lipad_ng_agila_medium', '623MK'
  UNION ALL SELECT 'lipad_ng_agila_od', '623K+K'
  UNION ALL SELECT 'mukha_ng_langit_heavy', '236HK'
  UNION ALL SELECT 'mukha_ng_langit_light', '236LK'
  UNION ALL SELECT 'mukha_ng_langit_medium', '236MK'
  UNION ALL SELECT 'mukha_ng_langit_od', '236K+K'
  UNION ALL SELECT 'pangil_sa_likuran_heavy', '22HP'
  UNION ALL SELECT 'pangil_sa_likuran_light', '22LP'
  UNION ALL SELECT 'pangil_sa_likuran_medium', '22MP'
  UNION ALL SELECT 'pangil_sa_likuran_od', '22P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_hiwang_pababa', 'DR > 6MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_walis_na_pabagsak', 'DR > 4HK'
  UNION ALL SELECT 'sa1_hiwa_ng_kalangitan', '236236K (SA1)'
  UNION ALL SELECT 'sa2_nakatagong_lakas', '214214P (SA2)'
  UNION ALL SELECT 'sa3_pamumukadkad_ng_sampaguita', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'talim_ng_hangin_heavy', '214HP'
  UNION ALL SELECT 'talim_ng_hangin_light', '214LP'
  UNION ALL SELECT 'talim_ng_hangin_medium', '214MP'
  UNION ALL SELECT 'talim_ng_hangin_od', '214P+P'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'walis_na_pabagsak', '4HK'
) AS v
WHERE c.code = 'yasmine' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== c_viper (59 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'burning_kick_heavy' AS code, '236HK' AS alias_text
  UNION ALL SELECT 'burning_kick_light', '236LK'
  UNION ALL SELECT 'burning_kick_medium', '236MK'
  UNION ALL SELECT 'burning_kick_od', '236K+K'
  UNION ALL SELECT 'ca_hard_luck_rejector', '214214K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'double_kick', '6HK'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'focus_force', '214K'
  UNION ALL SELECT 'focus_force_od', '214K+K'
  UNION ALL SELECT 'high_jump', '28'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_double_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_high_jump', 'DR > 28'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_viper_elbow', 'DR > 6MP'
  UNION ALL SELECT 'sa1_limit_decoupler', '236236K (SA1)'
  UNION ALL SELECT 'sa2_mission_complete', '214214P (SA2)'
  UNION ALL SELECT 'sa3_hard_luck_rejector', '214214K (SA3)'
  UNION ALL SELECT 'seismic_hammer_heavy', '623HP'
  UNION ALL SELECT 'seismic_hammer_light', '623LP'
  UNION ALL SELECT 'seismic_hammer_medium', '623MP'
  UNION ALL SELECT 'seismic_hammer_od', '623P+P'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'thunder_dash_heavy', '214HP'
  UNION ALL SELECT 'thunder_dash_light', '214LP'
  UNION ALL SELECT 'thunder_dash_medium', '214MP'
  UNION ALL SELECT 'thunder_dash_od', '214P+P'
  UNION ALL SELECT 'viper_elbow', '6MP'
) AS v
WHERE c.code = 'c_viper' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

-- ===== dhalsim (74 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'numeric'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'agile_kick' AS code, '1LK' AS alias_text
  UNION ALL SELECT 'ca_merciless_yoga', '236236K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'divine_kick', '4MK'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'karma_kick', '1HK'
  UNION ALL SELECT 'nirvana_punch', '1HP'
  UNION ALL SELECT 'rush_agile_kick', 'DR > 1LK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > 2HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > 2HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > 2LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > 2LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > 2MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > 2MP'
  UNION ALL SELECT 'rush_divine_kick', 'DR > 4MK'
  UNION ALL SELECT 'rush_karma_kick', 'DR > 1HK'
  UNION ALL SELECT 'rush_nirvana_punch', 'DR > 1HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > 5HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > 5HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > 5LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > 5LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > 5MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > 5MP'
  UNION ALL SELECT 'rush_thrust_kick', 'DR > 1MK'
  UNION ALL SELECT 'rush_yoga_lance', 'DR > 4HP'
  UNION ALL SELECT 'rush_yoga_mountain', 'DR > 4HK'
  UNION ALL SELECT 'rush_yoga_uppercut', 'DR > 4MP'
  UNION ALL SELECT 'sa1_yoga_inferno_heavy', '236236HP (SA1)'
  UNION ALL SELECT 'sa1_yoga_inferno_light', '236236LP (SA1)'
  UNION ALL SELECT 'sa1_yoga_inferno_medium', '236236MP (SA1)'
  UNION ALL SELECT 'sa2_yoga_sunburst', '214214K (SA2)'
  UNION ALL SELECT 'sa3_merciless_yoga', '236236K (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', '5HK'
  UNION ALL SELECT 'standing_heavy_punch', '5HP'
  UNION ALL SELECT 'standing_light_kick', '5LK'
  UNION ALL SELECT 'standing_light_punch', '5LP'
  UNION ALL SELECT 'standing_medium_kick', '5MK'
  UNION ALL SELECT 'standing_medium_punch', '5MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'thrust_kick', '1MK'
  UNION ALL SELECT 'yoga_arch_heavy', '236HK'
  UNION ALL SELECT 'yoga_arch_light', '236LK'
  UNION ALL SELECT 'yoga_arch_medium', '236MK'
  UNION ALL SELECT 'yoga_arch_od', '236K+K'
  UNION ALL SELECT 'yoga_blast_heavy', '63214HK'
  UNION ALL SELECT 'yoga_blast_light', '63214LK'
  UNION ALL SELECT 'yoga_blast_medium', '63214MK'
  UNION ALL SELECT 'yoga_blast_od', '63214K+K'
  UNION ALL SELECT 'yoga_fire_heavy', '236HP'
  UNION ALL SELECT 'yoga_fire_holding_heavy', '236HP(hold)'
  UNION ALL SELECT 'yoga_fire_holding_light', '236LP(hold)'
  UNION ALL SELECT 'yoga_fire_holding_medium', '236MP(hold)'
  UNION ALL SELECT 'yoga_fire_light', '236LP'
  UNION ALL SELECT 'yoga_fire_medium', '236MP'
  UNION ALL SELECT 'yoga_fire_od', '236P+P'
  UNION ALL SELECT 'yoga_float', '2K+K'
  UNION ALL SELECT 'yoga_float_forward', '3K+K'
  UNION ALL SELECT 'yoga_lance', '4HP'
  UNION ALL SELECT 'yoga_mountain', '4HK'
  UNION ALL SELECT 'yoga_splash', '2LP+LK'
  UNION ALL SELECT 'yoga_uppercut', '4MP'
) AS v
WHERE c.code = 'dhalsim' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'numeric') AND pa.move_id = m.id
  );

