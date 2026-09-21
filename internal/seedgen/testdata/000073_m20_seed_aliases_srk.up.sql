-- 000073_m20_seed_aliases_srk.up.sql
-- M20-02: 表記プリセット srk のエイリアス投入(D-311 / D-314 / D-315 / D-321)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- ★1 回きりの backfill ではなく「規則」の出力である(D-181)。新キャラ CSV を投入する
--   seed 波では、本規則を再適用して新しい連番のマイグレを起こすこと
--   (手順は character_data/seed-progress.md)。
-- 層順の原理: command が表記を決める行は層 A、move_code の構造が決める行は層 B。
-- 移動系 9 code は characters を CROSS JOIN するため、CSV を持たないキャラにも当たる。
-- 再適用時は NOT EXISTS ガードで skip する(upsert にしない = 既存行を書き換えない)。
-- 既存マイグレは非改変(新規連番で追加)。FK 依存順 characters→moves→preset_aliases。

-- ===== 層 C-1: 移動系 9 code x 19 キャラ =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text, alias_text_en)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text, v.alias_text_en
FROM moves m
JOIN characters c ON c.id = m.character_id
JOIN games g ON g.id = c.game_id AND g.code = 'sf6'
CROSS JOIN (
        SELECT 'forward' AS code, 'f' AS alias_text, NULL AS alias_text_en
  UNION ALL SELECT 'back', 'b', NULL
  UNION ALL SELECT 'dash_forward', 'dash', NULL
  UNION ALL SELECT 'dash_back', 'backdash', NULL
  UNION ALL SELECT 'jump_neutral', 'nj', NULL
  UNION ALL SELECT 'jump_forward', 'fj', NULL
  UNION ALL SELECT 'jump_back', 'bj', NULL
  UNION ALL SELECT 'micro_forward', '微歩き', 'microwalk'
  UNION ALL SELECT 'micro_back', '微下がり', 'back microwalk'
) AS v
WHERE c.code IN ('c_viper', 'dhalsim', 'guile', 'ingrid', 'jamie', 'jp', 'juri', 'ken', 'kimberly', 'lily', 'luke', 'm_bison', 'mai', 'manon', 'marisa', 'rashid', 'ryu', 'terry', 'zangief')
  AND m.code = v.code AND m.category = 'system'
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== guile (63 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'burning_straight' AS code, '4HP' AS alias_text
  UNION ALL SELECT 'ca_crossfire_somersault', '[4]646K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'full_bullet_magnum', '6MP'
  UNION ALL SELECT 'guile_high_kick', '3HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'knee_bazooka', '4LK'
  UNION ALL SELECT 'reverse_spin_kick', '6HK'
  UNION ALL SELECT 'rolling_sobat', '4MK'
  UNION ALL SELECT 'rush_burning_straight', 'DR > 4HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_full_bullet_magnum', 'DR > 6MP'
  UNION ALL SELECT 'rush_guile_high_kick', 'DR > 3HK'
  UNION ALL SELECT 'rush_knee_bazooka', 'DR > 4LK'
  UNION ALL SELECT 'rush_reverse_spin_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_rolling_sobat', 'DR > 4MK'
  UNION ALL SELECT 'rush_spinning_back_knuckle', 'DR > 6HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_sonic_hurricane_side', '[4]646LP/MP (SA1)'
  UNION ALL SELECT 'sa1_sonic_hurricane_up', '[4]646HP (SA1)'
  UNION ALL SELECT 'sa2_solid_puncher', '214214P (SA2)'
  UNION ALL SELECT 'sa3_crossfire_somersault', '[4]646K (SA3)'
  UNION ALL SELECT 'somersault_kick_heavy', '[2]8HK'
  UNION ALL SELECT 'somersault_kick_light', '[2]8LK'
  UNION ALL SELECT 'somersault_kick_medium', '[2]8MK'
  UNION ALL SELECT 'somersault_kick_od', '[2]8K+K'
  UNION ALL SELECT 'sonic_blade_heavy', '214HP'
  UNION ALL SELECT 'sonic_blade_light', '214LP'
  UNION ALL SELECT 'sonic_blade_medium', '214MP'
  UNION ALL SELECT 'sonic_blade_od', '214P+P'
  UNION ALL SELECT 'sonic_boom_heavy', '[4]6HP'
  UNION ALL SELECT 'sonic_boom_light', '[4]6LP'
  UNION ALL SELECT 'sonic_boom_medium', '[4]6MP'
  UNION ALL SELECT 'sonic_boom_od', '[4]6P+P'
  UNION ALL SELECT 'spinning_back_knuckle', '6HP'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
) AS v
WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== ingrid (62 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_cosmic_ray' AS code, '236236P (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'glowing_touch_1hits', '4MK'
  UNION ALL SELECT 'halo_flight', '6HP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'luminous_uppercut_1hits', '4HP'
  UNION ALL SELECT 'od_sun_shot_heavy', '236MP+HP'
  UNION ALL SELECT 'od_sun_shot_light', '236LP+MP'
  UNION ALL SELECT 'od_sun_shot_medium', '236LP+HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_glowing_touch_1hits', 'DR > 4MK'
  UNION ALL SELECT 'rush_halo_flight', 'DR > 6HP'
  UNION ALL SELECT 'rush_luminous_uppercut_1hits', 'DR > 4HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_sun_bright', 'DR > 6MP'
  UNION ALL SELECT 'sa1_shining_sun_lv1', '236236K (SA1)'
  UNION ALL SELECT 'sa2_order_of_the_sun_lv1', '214214P (SA2)'
  UNION ALL SELECT 'sa3_cosmic_ray', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'sun_bright', '6MP'
  UNION ALL SELECT 'sun_rise_heavy', '236HK'
  UNION ALL SELECT 'sun_rise_light', '236LK'
  UNION ALL SELECT 'sun_rise_medium', '236MK'
  UNION ALL SELECT 'sun_rise_od', '236K+K'
  UNION ALL SELECT 'sun_shot_heavy', '236HP'
  UNION ALL SELECT 'sun_shot_holding_heavy', '236HP(hold)'
  UNION ALL SELECT 'sun_shot_light', '236LP'
  UNION ALL SELECT 'sun_shot_medium', '236MP'
  UNION ALL SELECT 'sun_veil', '22K'
  UNION ALL SELECT 'sun_veil_od', '22K+K'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'vanishing_sun_backward', '4K+K+K'
  UNION ALL SELECT 'vanishing_sun_forward', '6K+K+K'
  UNION ALL SELECT 'vanishing_sun_upward', '2K+K+K'
) AS v
WHERE c.code = 'ingrid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== jamie (65 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'arrow_kick_heavy' AS code, '623HK' AS alias_text
  UNION ALL SELECT 'arrow_kick_light', '623LK'
  UNION ALL SELECT 'arrow_kick_medium', '623MK'
  UNION ALL SELECT 'arrow_kick_od', '623K+K'
  UNION ALL SELECT 'bakkai_heavy', '236HK'
  UNION ALL SELECT 'bakkai_light', '236LK'
  UNION ALL SELECT 'bakkai_medium', '236MK'
  UNION ALL SELECT 'bakkai_od', '236K+K'
  UNION ALL SELECT 'ca_getsuga_saiho', '236236P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'falling_star_kick', '6MK'
  UNION ALL SELECT 'hermits_elbow', '4HP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'luminous_dive_kick_heavy', '214HK'
  UNION ALL SELECT 'luminous_dive_kick_light', '214LK'
  UNION ALL SELECT 'luminous_dive_kick_medium', '214MK'
  UNION ALL SELECT 'luminous_dive_kick_od', '214K+K'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_falling_star_kick', 'DR > 6MK'
  UNION ALL SELECT 'rush_hermits_elbow', 'DR > 4HP'
  UNION ALL SELECT 'rush_senei_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_tensei_kick', 'DR > 2K+K'
  UNION ALL SELECT 'sa1_breakin', '236236K (SA1)'
  UNION ALL SELECT 'sa2_the_devil_s_song', '214214P (SA2)'
  UNION ALL SELECT 'sa3_getsuga_saiho', '236236P (SA3)'
  UNION ALL SELECT 'senei_kick', '6HK'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'swagger_step_heavy', '214HP'
  UNION ALL SELECT 'swagger_step_light', '214LP'
  UNION ALL SELECT 'swagger_step_medium', '214MP'
  UNION ALL SELECT 'swagger_step_od', '214P+P'
  UNION ALL SELECT 'tensei_kick', '2K+K'
  UNION ALL SELECT 'tenshin', '63214K'
  UNION ALL SELECT 'tenshin_od', '63214K+K'
  UNION ALL SELECT 'the_devil_inside', '22P'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'jamie' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== jp (67 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'amnesia' AS code, '22K' AS alias_text
  UNION ALL SELECT 'amnesia_od', '22K+K'
  UNION ALL SELECT 'bylina', '6HK'
  UNION ALL SELECT 'ca_interdiction', '236236K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'departure_heavy', '214HP'
  UNION ALL SELECT 'departure_light', '214LP'
  UNION ALL SELECT 'departure_medium', '214MP'
  UNION ALL SELECT 'departure_od', '214P+P'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'embrace', '214K'
  UNION ALL SELECT 'embrace_od', '214K+K'
  UNION ALL SELECT 'grom_strelka_1hit', '4MP'
  UNION ALL SELECT 'guillotinna', '6MK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'malice', '3HP'
  UNION ALL SELECT 'rush_bylina', 'DR > 6HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_grom_strelka_1hit', 'DR > 4MP'
  UNION ALL SELECT 'rush_guillotinna', 'DR > 6MK'
  UNION ALL SELECT 'rush_malice', 'DR > 3HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_chornobog', '236236P (SA1)'
  UNION ALL SELECT 'sa2_lovushka', '214214P (SA2)'
  UNION ALL SELECT 'sa3_interdiction', '236236K (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'stribog_heavy', '236HP'
  UNION ALL SELECT 'stribog_light', '236LP'
  UNION ALL SELECT 'stribog_medium', '236MP'
  UNION ALL SELECT 'stribog_od', '236P+P'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'torbalan_heavy', '236HK'
  UNION ALL SELECT 'torbalan_light', '236LK'
  UNION ALL SELECT 'torbalan_medium', '236MK'
  UNION ALL SELECT 'torbalan_od', '236K+K'
  UNION ALL SELECT 'tornado', 'LP+LK'
  UNION ALL SELECT 'triglav_heavy', '22HP'
  UNION ALL SELECT 'triglav_light', '22LP'
  UNION ALL SELECT 'triglav_medium', '22MP'
  UNION ALL SELECT 'triglav_od', '22P+P'
) AS v
WHERE c.code = 'jp' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== juri (62 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'air_throw' AS code, 'LP+LK' AS alias_text
  UNION ALL SELECT 'ankensatsu', '236MK'
  UNION ALL SELECT 'ankensatsu_od', '236LK+HK'
  UNION ALL SELECT 'ca_kaisen_dankai_raku', '214214K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'fuhajin_heavy', '214HK'
  UNION ALL SELECT 'fuhajin_light', '214LK'
  UNION ALL SELECT 'fuhajin_medium', '214MK'
  UNION ALL SELECT 'go_ohsatsu', '236HK'
  UNION ALL SELECT 'go_ohsatsu_od', '236MK+HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'korenzan', '4HK'
  UNION ALL SELECT 'kyosesho', '6MP'
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'HK'
  UNION ALL SELECT 'renko_kicks', '6HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_korenzan', 'DR > 4HK'
  UNION ALL SELECT 'rush_kyosesho', 'DR > 6MP'
  UNION ALL SELECT 'rush_renko_kicks', 'DR > 6HP'
  UNION ALL SELECT 'rush_senkai_kick', 'DR > 6MK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_sakkai_fuhazan', '236236K (SA1)'
  UNION ALL SELECT 'sa2_feng_shui_engine', '214214P (SA2)'
  UNION ALL SELECT 'sa3_kaisen_dankai_raku', '214214K (SA3)'
  UNION ALL SELECT 'saihasho', '236LK'
  UNION ALL SELECT 'saihasho_od', '236LK+MK'
  UNION ALL SELECT 'senkai_kick', '6MK'
  UNION ALL SELECT 'shiku_sen', '214K'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'tensenrin_heavy', '623HP'
  UNION ALL SELECT 'tensenrin_light', '623LP'
  UNION ALL SELECT 'tensenrin_medium', '623MP'
  UNION ALL SELECT 'tensenrin_od', '623P+P'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'juri' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== ken (60 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_tatsumaki_senpu_kyaku' AS code, '214K' AS alias_text
  UNION ALL SELECT 'ca_shinryu_reppa', '236236P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'dragonlash_kick_heavy', '623HK'
  UNION ALL SELECT 'dragonlash_kick_light', '623LK'
  UNION ALL SELECT 'dragonlash_kick_medium', '623MK'
  UNION ALL SELECT 'dragonlash_kick_od', '623K+K'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hadoken_heavy', '236HP'
  UNION ALL SELECT 'hadoken_light', '236LP'
  UNION ALL SELECT 'hadoken_medium', '236MP'
  UNION ALL SELECT 'hadoken_od', '236P+P'
  UNION ALL SELECT 'jinrai_kick_heavy', '236HK'
  UNION ALL SELECT 'jinrai_kick_light', '236LK'
  UNION ALL SELECT 'jinrai_kick_medium', '236MK'
  UNION ALL SELECT 'jinrai_kick_od', '236K+K'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'HK'
  UNION ALL SELECT 'quick_dash', 'K+K'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_dragonlash_flame', '214214K (SA1)'
  UNION ALL SELECT 'sa2_shippu_jinrai_kyaku', '236236K (SA2)'
  UNION ALL SELECT 'sa3_shinryu_reppa', '236236P (SA3)'
  UNION ALL SELECT 'shoryuken_heavy', '623HP'
  UNION ALL SELECT 'shoryuken_light', '623LP'
  UNION ALL SELECT 'shoryuken_medium', '623MP'
  UNION ALL SELECT 'shoryuken_od', '623P+P'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', '214HK'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', '214LK'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', '214MK'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'ken' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== kimberly (64 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_bushin_senpukyaku' AS code, '214K' AS alias_text
  UNION ALL SELECT 'bushin_senpukyaku_heavy', '214HK'
  UNION ALL SELECT 'bushin_senpukyaku_light', '214LK'
  UNION ALL SELECT 'bushin_senpukyaku_medium', '214MK'
  UNION ALL SELECT 'ca_bushin_ninjastar_cypher', '236236P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'elbow_drop', '2MP'
  UNION ALL SELECT 'genius_at_play', '22P'
  UNION ALL SELECT 'genius_at_play_od', '22P+P'
  UNION ALL SELECT 'hidden_variable', '214P'
  UNION ALL SELECT 'hidden_variable_od', '214P+P'
  UNION ALL SELECT 'hisen_kick', '6HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'nue_twister', '236P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_hisen_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_water_slicer_slide', 'DR > 3MK'
  UNION ALL SELECT 'rush_windmill_kick', 'DR > 4HK'
  UNION ALL SELECT 'sa1_bushin_beats', '236236K (SA1)'
  UNION ALL SELECT 'sa3_bushin_ninjastar_cypher', '236236P (SA3)'
  UNION ALL SELECT 'shuriken_bomb_heavy', '22HP'
  UNION ALL SELECT 'shuriken_bomb_light', '22LP'
  UNION ALL SELECT 'shuriken_bomb_medium', '22MP'
  UNION ALL SELECT 'shuriken_bomb_spread_heavy', '22MP+HP'
  UNION ALL SELECT 'shuriken_bomb_spread_light', '22LP+MP'
  UNION ALL SELECT 'shuriken_bomb_spread_medium', '22LP+HP'
  UNION ALL SELECT 'sprint', '236K'
  UNION ALL SELECT 'sprint_od', '236K+K'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'vagabond_edge_heavy', '236HP'
  UNION ALL SELECT 'vagabond_edge_light', '236LP'
  UNION ALL SELECT 'vagabond_edge_medium', '236MP'
  UNION ALL SELECT 'water_slicer_slide', '3MK'
  UNION ALL SELECT 'windmill_kick', '4HK'
) AS v
WHERE c.code = 'kimberly' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== lily (62 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_raging_typhoon' AS code, '214214P (CA)' AS alias_text
  UNION ALL SELECT 'condor_dive', 'P+P'
  UNION ALL SELECT 'condor_dive_od', 'P+P+P'
  UNION ALL SELECT 'condor_spire_heavy', '236HK'
  UNION ALL SELECT 'condor_spire_light', '236LK'
  UNION ALL SELECT 'condor_spire_medium', '236MK'
  UNION ALL SELECT 'condor_spire_od', '236K+K'
  UNION ALL SELECT 'condor_wind_heavy', '214HP'
  UNION ALL SELECT 'condor_wind_light', '214LP'
  UNION ALL SELECT 'condor_wind_medium', '214MP'
  UNION ALL SELECT 'condor_wind_od', '214P+P'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'desert_storm_1hits', '6HP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'great_spin', '2HP'
  UNION ALL SELECT 'horn_breaker', '4HP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'mexican_typhoon_heavy', '360HP'
  UNION ALL SELECT 'mexican_typhoon_light', '360LP'
  UNION ALL SELECT 'mexican_typhoon_medium', '360MP'
  UNION ALL SELECT 'mexican_typhoon_od', '360P+P'
  UNION ALL SELECT 'ridge_thrust', '3HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_desert_storm_1hits', 'DR > 6HP'
  UNION ALL SELECT 'rush_horn_breaker', 'DR > 4HP'
  UNION ALL SELECT 'rush_ridge_thrust', 'DR > 3HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_breezing_hawk', '236236P (SA1)'
  UNION ALL SELECT 'sa3_raging_typhoon', '214214P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'tomahawk_buster_heavy', '623HP'
  UNION ALL SELECT 'tomahawk_buster_light', '623LP'
  UNION ALL SELECT 'tomahawk_buster_medium', '623MP'
  UNION ALL SELECT 'tomahawk_buster_od', '623P+P'
) AS v
WHERE c.code = 'lily' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== luke (64 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_flash_knuckle' AS code, '214P' AS alias_text
  UNION ALL SELECT 'aerial_flash_knuckle_holding', '214P(hold)'
  UNION ALL SELECT 'avenger', '236K'
  UNION ALL SELECT 'avenger_od', '236K+K'
  UNION ALL SELECT 'ca_pale_rider', '236236K (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'double_impact_1hit', '6HP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'flash_knuckle_heavy', '214HP'
  UNION ALL SELECT 'flash_knuckle_holding_heavy', '214HP(hold)'
  UNION ALL SELECT 'flash_knuckle_holding_light', '214LP(hold)'
  UNION ALL SELECT 'flash_knuckle_holding_medium', '214MP(hold)'
  UNION ALL SELECT 'flash_knuckle_light', '214LP'
  UNION ALL SELECT 'flash_knuckle_medium', '214MP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'outlaw_kick', '4HK'
  UNION ALL SELECT 'rawhide', '6MP'
  UNION ALL SELECT 'rising_uppercut_heavy', '623HP'
  UNION ALL SELECT 'rising_uppercut_light', '623LP'
  UNION ALL SELECT 'rising_uppercut_medium', '623MP'
  UNION ALL SELECT 'rising_uppercut_od', '623P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_double_impact_1hit', 'DR > 6HP'
  UNION ALL SELECT 'rush_outlaw_kick', 'DR > 4HK'
  UNION ALL SELECT 'rush_rawhide', 'DR > 6MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_suppressor', 'DR > 4HP'
  UNION ALL SELECT 'sa1_vulcan_blast', '236236P (SA1)'
  UNION ALL SELECT 'sa2_eraser', '214214P (SA2)'
  UNION ALL SELECT 'sa3_pale_rider', '236236K (SA3)'
  UNION ALL SELECT 'sand_blast_heavy', '236HP'
  UNION ALL SELECT 'sand_blast_light', '236LP'
  UNION ALL SELECT 'sand_blast_medium', '236MP'
  UNION ALL SELECT 'sand_blast_od', '236P+P'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'suppressor', '4HP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'luke' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== m_bison (60 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'backfist_combo_heavy' AS code, '214HP' AS alias_text
  UNION ALL SELECT 'backfist_combo_light', '214LP'
  UNION ALL SELECT 'backfist_combo_medium', '214MP'
  UNION ALL SELECT 'backfist_combo_od', '214P+P'
  UNION ALL SELECT 'ca_unlimited_psycho_crusher', '236236P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'double_knee_press_heavy', '236HK'
  UNION ALL SELECT 'double_knee_press_light', '236LK'
  UNION ALL SELECT 'double_knee_press_medium', '236MK'
  UNION ALL SELECT 'double_knee_press_od', '236K+K'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'evil_knee', '4HK'
  UNION ALL SELECT 'hover_kick', '3HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'psycho_crusher_attack_heavy', '[4]6HP'
  UNION ALL SELECT 'psycho_crusher_attack_light', '[4]6LP'
  UNION ALL SELECT 'psycho_crusher_attack_medium', '[4]6MP'
  UNION ALL SELECT 'psycho_crusher_attack_od', '[4]6P+P'
  UNION ALL SELECT 'psycho_hammer', '6HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_evil_knee', 'DR > 4HK'
  UNION ALL SELECT 'rush_hover_kick', 'DR > 3HK'
  UNION ALL SELECT 'rush_psycho_hammer', 'DR > 6HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_knee_press_nightmare', '236236K (SA1)'
  UNION ALL SELECT 'sa2_psycho_punisher', '214214K (SA2)'
  UNION ALL SELECT 'sa3_unlimited_psycho_crusher', '236236P (SA3)'
  UNION ALL SELECT 'shadow_rise_heavy', '[2]8HK'
  UNION ALL SELECT 'shadow_rise_light', '[2]8LK'
  UNION ALL SELECT 'shadow_rise_medium', '[2]8MK'
  UNION ALL SELECT 'shadow_rise_od', '[2]8K+K'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'm_bison' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== mai (62 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'air_throw' AS code, 'LP+LK' AS alias_text
  UNION ALL SELECT 'ca_shiranui_ryuu_enbu_ada_zakura', '214214P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hishou_ryuuenjin_heavy', '623HK'
  UNION ALL SELECT 'hishou_ryuuenjin_light', '623LK'
  UNION ALL SELECT 'hishou_ryuuenjin_medium', '623MK'
  UNION ALL SELECT 'hishou_ryuuenjin_od', '623K+K'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_heavy', '236HK'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_light', '236LK'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_medium', '236MK'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_od', '236K+K'
  UNION ALL SELECT 'hoshi_kujaku_1hits', '4HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'kachousen_heavy', '236HP'
  UNION ALL SELECT 'kachousen_holding_heavy', '236HP(hold)'
  UNION ALL SELECT 'kachousen_holding_light', '236LP(hold)'
  UNION ALL SELECT 'kachousen_holding_medium', '236MP(hold)'
  UNION ALL SELECT 'kachousen_holding_od', '236P+P(hold)'
  UNION ALL SELECT 'kachousen_light', '236LP'
  UNION ALL SELECT 'kachousen_medium', '236MP'
  UNION ALL SELECT 'kachousen_od', '236P+P'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_hoshi_kujaku_1hits', 'DR > 4HK'
  UNION ALL SELECT 'rush_senkotsu_uchi', 'DR > 6MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'ryuuenbu_heavy', '214HP'
  UNION ALL SELECT 'ryuuenbu_light', '214LP'
  UNION ALL SELECT 'ryuuenbu_medium', '214MP'
  UNION ALL SELECT 'ryuuenbu_od', '214P+P'
  UNION ALL SELECT 'sa1_kagerou_no_mai', '236236P (SA1)'
  UNION ALL SELECT 'sa3_shiranui_ryuu_enbu_ada_zakura', '214214P (SA3)'
  UNION ALL SELECT 'senkotsu_uchi', '6MP'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== manon (60 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_pas_de_deux' AS code, '236236P (CA)' AS alias_text
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'degage_heavy', '214HK'
  UNION ALL SELECT 'degage_light', '214LK'
  UNION ALL SELECT 'degage_medium', '214MK'
  UNION ALL SELECT 'degage_od', '214K+K'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'en_haut_1hit', '4MK'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'manege_dore_heavy', '63214HP'
  UNION ALL SELECT 'manege_dore_light', '63214LP'
  UNION ALL SELECT 'manege_dore_medium', '63214MP'
  UNION ALL SELECT 'manege_dore_od', '63214P+P'
  UNION ALL SELECT 'renverse_heavy', '236HP'
  UNION ALL SELECT 'renverse_light', '236LP'
  UNION ALL SELECT 'renverse_medium', '236MP'
  UNION ALL SELECT 'renverse_od', '236P+P'
  UNION ALL SELECT 'reverence', '4HP'
  UNION ALL SELECT 'rond_point_heavy', '236HK'
  UNION ALL SELECT 'rond_point_light', '236LK'
  UNION ALL SELECT 'rond_point_medium', '236MK'
  UNION ALL SELECT 'rond_point_od', '236K+K'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_en_haut_1hit', 'DR > 4MK'
  UNION ALL SELECT 'rush_reverence', 'DR > 4HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_tomoe_derriere', 'DR > 3HK'
  UNION ALL SELECT 'sa1_arabesque', '236236K (SA1)'
  UNION ALL SELECT 'sa2_etoile', '214214K (SA2)'
  UNION ALL SELECT 'sa3_pas_de_deux', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'tomoe_derriere', '3HK'
) AS v
WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== marisa (79 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'ca_goddess_of_the_hunt' AS code, '236236K (CA)' AS alias_text
  UNION ALL SELECT 'caelum_arc', '2HP'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_kick_holding', '2HK(hold)'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'dimachaerus_1hit_heavy', '214HP'
  UNION ALL SELECT 'dimachaerus_1hit_light', '214LP'
  UNION ALL SELECT 'dimachaerus_1hit_medium', '214MP'
  UNION ALL SELECT 'dimachaerus_1hit_od', '214P+P'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'falx_crusher_1hit', '6HK'
  UNION ALL SELECT 'falx_crusher_1hit_holding', '6HK(hold)'
  UNION ALL SELECT 'gladius_heavy', '236HP'
  UNION ALL SELECT 'gladius_holding_heavy', '236HP(hold)'
  UNION ALL SELECT 'gladius_holding_light', '236LP(hold)'
  UNION ALL SELECT 'gladius_holding_medium', '236MP(hold)'
  UNION ALL SELECT 'gladius_holding_od', '236P+P(hold)'
  UNION ALL SELECT 'gladius_light', '236LP'
  UNION ALL SELECT 'gladius_medium', '236MP'
  UNION ALL SELECT 'gladius_od', '236P+P'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'magna_bunker', '4HP'
  UNION ALL SELECT 'magna_bunker_holding', '4HP(hold)'
  UNION ALL SELECT 'malleus_breaker_1hit', '3HP'
  UNION ALL SELECT 'malleus_breaker_1hit_holding', '3HP(hold)'
  UNION ALL SELECT 'novacula', '6MP'
  UNION ALL SELECT 'phalanx_heavy', '623HP'
  UNION ALL SELECT 'phalanx_light', '623LP'
  UNION ALL SELECT 'phalanx_medium', '623MP'
  UNION ALL SELECT 'phalanx_od', '623P+P'
  UNION ALL SELECT 'quadriga_heavy', '236HK'
  UNION ALL SELECT 'quadriga_light', '236LK'
  UNION ALL SELECT 'quadriga_medium', '236MK'
  UNION ALL SELECT 'quadriga_od', '236K+K'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_falx_crusher_1hit', 'DR > 6HK'
  UNION ALL SELECT 'rush_falx_crusher_1hit_holding', 'DR > 6HK(hold)'
  UNION ALL SELECT 'rush_magna_bunker', 'DR > 4HP'
  UNION ALL SELECT 'rush_magna_bunker_holding', 'DR > 4HP(hold)'
  UNION ALL SELECT 'rush_malleus_breaker_1hit', 'DR > 3HP'
  UNION ALL SELECT 'rush_malleus_breaker_1hit_holding', 'DR > 3HP(hold)'
  UNION ALL SELECT 'rush_novacula', 'DR > 6MP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_javelin_of_marisa', '236236P (SA1)'
  UNION ALL SELECT 'sa1_javelin_of_marisa_holding', '236236P(hold) (SA1)'
  UNION ALL SELECT 'sa2_meteorite', '214214P (SA2)'
  UNION ALL SELECT 'sa3_goddess_of_the_hunt', '236236K (SA3)'
  UNION ALL SELECT 'scutum', '214K'
  UNION ALL SELECT 'scutum_max_holding', '214K(hold)'
  UNION ALL SELECT 'scutum_max_holding_od', '214K+K(hold)'
  UNION ALL SELECT 'scutum_od', '214K+K'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'marisa' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== rashid (62 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_shot' AS code, '8HK' AS alias_text
  UNION ALL SELECT 'arabian_cyclone_heavy', '214HP'
  UNION ALL SELECT 'arabian_cyclone_light', '214LP'
  UNION ALL SELECT 'arabian_cyclone_medium', '214MP'
  UNION ALL SELECT 'arabian_cyclone_od', '214P+P'
  UNION ALL SELECT 'beak_assault', '6HP'
  UNION ALL SELECT 'blitz_strike', '2HP'
  UNION ALL SELECT 'ca_altair', '236236P (CA)'
  UNION ALL SELECT 'crescent_kick', '6HK'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'desert_slider', 'LP+LK'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'flapping_spin', '6MP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'rush_beak_assault', 'DR > 6HP'
  UNION ALL SELECT 'rush_crescent_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_flapping_spin', 'DR > 6MP'
  UNION ALL SELECT 'rush_side_flip', 'DR > 6K+K'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_super_rashid_kick', '236236K (SA1)'
  UNION ALL SELECT 'sa2_ysaar', '214214K (SA2)'
  UNION ALL SELECT 'sa3_altair', '236236P (SA3)'
  UNION ALL SELECT 'side_flip', '6K+K'
  UNION ALL SELECT 'spinning_mixer_heavy', '236HP'
  UNION ALL SELECT 'spinning_mixer_light', '236LP'
  UNION ALL SELECT 'spinning_mixer_medium', '236MP'
  UNION ALL SELECT 'spinning_mixer_od', '236P+P'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'whirlwind_shot_heavy', '236HK'
  UNION ALL SELECT 'whirlwind_shot_holding_od', '236K+K(hold)'
  UNION ALL SELECT 'whirlwind_shot_light', '236LK'
  UNION ALL SELECT 'whirlwind_shot_medium', '236MK'
  UNION ALL SELECT 'whirlwind_shot_od', '236K+K'
) AS v
WHERE c.code = 'rashid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== ryu (68 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'aerial_tatsumaki_senpu_kyaku' AS code, '214K' AS alias_text
  UNION ALL SELECT 'axe_kick', '4HK'
  UNION ALL SELECT 'ca_shin_shoryuken', '236236K (CA)'
  UNION ALL SELECT 'collarbone_breaker', '6MP'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'denjin_charge', '22P'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hadoken_heavy', '236HP'
  UNION ALL SELECT 'hadoken_light', '236LP'
  UNION ALL SELECT 'hadoken_medium', '236MP'
  UNION ALL SELECT 'hadoken_od', '236P+P'
  UNION ALL SELECT 'hashogeki_heavy', '214HP'
  UNION ALL SELECT 'hashogeki_light', '214LP'
  UNION ALL SELECT 'hashogeki_medium', '214MP'
  UNION ALL SELECT 'hashogeki_od', '214P+P'
  UNION ALL SELECT 'high_blade_kick_heavy', '236HK'
  UNION ALL SELECT 'high_blade_kick_light', '236LK'
  UNION ALL SELECT 'high_blade_kick_medium', '236MK'
  UNION ALL SELECT 'high_blade_kick_od', '236K+K'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'rush_axe_kick', 'DR > 4HK'
  UNION ALL SELECT 'rush_collarbone_breaker', 'DR > 6MP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_short_uppercut', 'DR > 4HP'
  UNION ALL SELECT 'rush_solar_plexus_strike', 'DR > 6HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'rush_whirlwind_kick', 'DR > 6HK'
  UNION ALL SELECT 'sa1_shinku_hadoken', '236236P (SA1)'
  UNION ALL SELECT 'sa3_shin_shoryuken', '236236K (SA3)'
  UNION ALL SELECT 'short_uppercut', '4HP'
  UNION ALL SELECT 'shoryuken_heavy', '623HP'
  UNION ALL SELECT 'shoryuken_light', '623LP'
  UNION ALL SELECT 'shoryuken_medium', '623MP'
  UNION ALL SELECT 'shoryuken_od', '623P+P'
  UNION ALL SELECT 'solar_plexus_strike', '6HP'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', '214HK'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', '214LK'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', '214MK'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'whirlwind_kick', '6HK'
) AS v
WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== terry (61 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'burning_knuckle_heavy' AS code, '214HP' AS alias_text
  UNION ALL SELECT 'burning_knuckle_medium', '214MP'
  UNION ALL SELECT 'burning_knuckle_od', '214P+P'
  UNION ALL SELECT 'ca_rising_fang', '236236P (CA)'
  UNION ALL SELECT 'crack_shoot_heavy', '214HK'
  UNION ALL SELECT 'crack_shoot_light', '214LK'
  UNION ALL SELECT 'crack_shoot_medium', '214MK'
  UNION ALL SELECT 'crack_shoot_od', '214K+K'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'hammer_punch', '6HP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'power_charge_heavy', '236HK'
  UNION ALL SELECT 'power_charge_light', '236LK'
  UNION ALL SELECT 'power_charge_medium', '236MK'
  UNION ALL SELECT 'power_charge_od', '236K+K'
  UNION ALL SELECT 'power_wave_light', '236LP'
  UNION ALL SELECT 'power_wave_medium', '236MP'
  UNION ALL SELECT 'power_wave_od', '236P+P'
  UNION ALL SELECT 'quick_burn', '214LP'
  UNION ALL SELECT 'quick_burn_od', '214LP+MP'
  UNION ALL SELECT 'rising_tackle_heavy', '623HP'
  UNION ALL SELECT 'rising_tackle_light', '623LP'
  UNION ALL SELECT 'rising_tackle_medium', '623MP'
  UNION ALL SELECT 'rising_tackle_od', '623P+P'
  UNION ALL SELECT 'round_wave', '236HP'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_hammer_punch', 'DR > 6HP'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'sa1_buster_wolf', '236236K (SA1)'
  UNION ALL SELECT 'sa2_power_geyser', '214214P (SA2)'
  UNION ALL SELECT 'sa3_rising_fang', '236236P (SA3)'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
) AS v
WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

-- ===== zangief (72 aliases) =====
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'srk'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'borscht_dynamite' AS code, '360K' AS alias_text
  UNION ALL SELECT 'borscht_dynamite_od', '360K+K'
  UNION ALL SELECT 'brain_buster', '2LP+LK'
  UNION ALL SELECT 'ca_bolshoi_storm_buster', '360360P (CA)'
  UNION ALL SELECT 'crouching_heavy_kick', 'cr.HK'
  UNION ALL SELECT 'crouching_heavy_punch', 'cr.HP'
  UNION ALL SELECT 'crouching_light_kick', 'cr.LK'
  UNION ALL SELECT 'crouching_light_punch', 'cr.LP'
  UNION ALL SELECT 'crouching_medium_kick', 'cr.MK'
  UNION ALL SELECT 'crouching_medium_punch', 'cr.MP'
  UNION ALL SELECT 'cyclone_wheel_kick', '6HK'
  UNION ALL SELECT 'double_lariat', 'P+P'
  UNION ALL SELECT 'double_lariat_od', 'LP+MP+HP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
  UNION ALL SELECT 'flying_body_press', '2HP'
  UNION ALL SELECT 'flying_headbutt', '8HP'
  UNION ALL SELECT 'german_suplex', '6LP+LK'
  UNION ALL SELECT 'headbutt', '6HP'
  UNION ALL SELECT 'hellstab', '3MP'
  UNION ALL SELECT 'jumping_heavy_kick', 'j.HK'
  UNION ALL SELECT 'jumping_heavy_kick_holding', 'HK(hold)'
  UNION ALL SELECT 'jumping_heavy_punch', 'j.HP'
  UNION ALL SELECT 'jumping_light_kick', 'j.LK'
  UNION ALL SELECT 'jumping_light_punch', 'j.LP'
  UNION ALL SELECT 'jumping_medium_kick', 'j.MK'
  UNION ALL SELECT 'jumping_medium_punch', 'j.MP'
  UNION ALL SELECT 'knee_hammer', '6MK'
  UNION ALL SELECT 'machine_gun_chops', 'MP>MP>MP'
  UNION ALL SELECT 'machine_gun_chops_2hits', 'MP>MP'
  UNION ALL SELECT 'power_stomps', '22MK>MK>MK'
  UNION ALL SELECT 'power_stomps_1hits', '22MK'
  UNION ALL SELECT 'power_stomps_2hits', '22MK>MK'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'DR > cr.HK'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'DR > cr.HP'
  UNION ALL SELECT 'rush_crouching_light_kick', 'DR > cr.LK'
  UNION ALL SELECT 'rush_crouching_light_punch', 'DR > cr.LP'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'DR > cr.MK'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'DR > cr.MP'
  UNION ALL SELECT 'rush_cyclone_wheel_kick', 'DR > 6HK'
  UNION ALL SELECT 'rush_headbutt', 'DR > 6HP'
  UNION ALL SELECT 'rush_hellstab', 'DR > 3MP'
  UNION ALL SELECT 'rush_knee_hammer', 'DR > 6MK'
  UNION ALL SELECT 'rush_power_stomps_1hits', 'DR > 22MK'
  UNION ALL SELECT 'rush_smetana_dropkick', 'DR > 3HK'
  UNION ALL SELECT 'rush_standing_heavy_kick', 'DR > st.HK'
  UNION ALL SELECT 'rush_standing_heavy_punch', 'DR > st.HP'
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', 'DR > HP(hold)'
  UNION ALL SELECT 'rush_standing_light_kick', 'DR > st.LK'
  UNION ALL SELECT 'rush_standing_light_punch', 'DR > st.LP'
  UNION ALL SELECT 'rush_standing_medium_kick', 'DR > st.MK'
  UNION ALL SELECT 'rush_standing_medium_punch', 'DR > st.MP'
  UNION ALL SELECT 'russian_drop', '1LP+LK'
  UNION ALL SELECT 'sa1_aerial_russian_slam', '236236K (SA1)'
  UNION ALL SELECT 'sa2_cyclone_lariat_forward', '236236P (SA2)'
  UNION ALL SELECT 'sa3_bolshoi_storm_buster', '360360P (SA3)'
  UNION ALL SELECT 'screw_piledriver_heavy', '360HP'
  UNION ALL SELECT 'screw_piledriver_light', '360LP'
  UNION ALL SELECT 'screw_piledriver_medium', '360MP'
  UNION ALL SELECT 'screw_piledriver_od', '360P+P'
  UNION ALL SELECT 'smetana_dropkick', '3HK'
  UNION ALL SELECT 'spinebuster', '3LP+LK'
  UNION ALL SELECT 'standing_heavy_kick', 'st.HK'
  UNION ALL SELECT 'standing_heavy_punch', 'st.HP'
  UNION ALL SELECT 'standing_heavy_punch_holding', 'HP(hold)'
  UNION ALL SELECT 'standing_light_kick', 'st.LK'
  UNION ALL SELECT 'standing_light_punch', 'st.LP'
  UNION ALL SELECT 'standing_medium_kick', 'st.MK'
  UNION ALL SELECT 'standing_medium_punch', 'st.MP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'throw_forward', '5LP+LK'
  UNION ALL SELECT 'tundra_storm', '22HK'
) AS v
WHERE c.code = 'zangief' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code
  AND NOT EXISTS (
      SELECT 1 FROM preset_aliases pa
      WHERE pa.preset_id = (SELECT id FROM presets WHERE code = 'srk') AND pa.move_id = m.id
  );

