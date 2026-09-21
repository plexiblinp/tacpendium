-- 000030_seed_moves_ryu.up.sql
-- M14-03c: ryu の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(旧 seed は 000029 で削除済み)。
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 移動 system move は CSV に無い(seed の投入元は 000004_data_seed_moves)。
-- FK 依存順 characters→moves→preset_aliases。

-- ===== ryu (84 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 2, -4, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 4, 22, 7, -1, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 9, 3, 29, 4, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 5, 32, 4, -2, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 12, 4, 35, 9, 1, 20, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 14, 4, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 3, -1, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 24, 5, 0, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, 1, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 9, 6, 35, 1, -7, 21, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 3, 34, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 10, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 8, 46, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'collarbone_breaker', 'unique', 600, 20, 4, 42, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'solar_plexus_strike', 'unique', 800, 20, 5, 40, 6, 3, 16, 0, NULL
  UNION ALL SELECT 'short_uppercut', 'unique', 800, 7, 4, 35, 1, -13, 25, 0, NULL
  UNION ALL SELECT 'axe_kick', 'unique', 800, 10, 13, 43, 0, -4, 21, 0, NULL
  UNION ALL SELECT 'whirlwind_kick', 'unique', 800, 16, 4, 39, 2, -4, 20, 0, NULL
  UNION ALL SELECT 'high_double_strike', 'target_combo', 1800, 9, 4, 32, NULL, -8, 20, 0, NULL
  UNION ALL SELECT 'fuwa_triple_strike_2hits', 'target_combo', 900, 5, 3, 23, 1, -4, 16, 0, NULL
  UNION ALL SELECT 'fuwa_triple_strike', 'target_combo', 1620, 17, 4, 40, NULL, -8, 20, 0, NULL
  UNION ALL SELECT 'hadoken_light', 'special', 700, 16, 32, 47, 2, -5, 0, 0, NULL
  UNION ALL SELECT 'hadoken_medium', 'special', 700, 14, 34, 47, 0, -7, 0, 0, NULL
  UNION ALL SELECT 'hadoken_heavy', 'special', 700, 12, 36, 47, -2, -9, 0, 0, NULL
  UNION ALL SELECT 'denjin_charge_hadoken', 'special', 1000, 12, 25, 40, NULL, -1, 4, 0, NULL
  UNION ALL SELECT 'hadoken_od', 'special', 1000, 12, 29, 40, NULL, -1, 0, 0, NULL
  UNION ALL SELECT 'denjin_charge_od_hadoken', 'special', 1200, 12, 24, 38, NULL, 2, 3, 0, NULL
  UNION ALL SELECT 'shoryuken_light', 'special', 1100, 5, 10, 47, NULL, -23, 33, 0, NULL
  UNION ALL SELECT 'shoryuken_medium', 'special', 1200, 6, 10, 57, NULL, -32, 42, 0, NULL
  UNION ALL SELECT 'shoryuken_heavy', 'special', 1400, 7, 10, 62, NULL, -36, 46, 0, NULL
  UNION ALL SELECT 'shoryuken_od', 'special', 1600, 6, 10, 67, NULL, -40, 52, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', 'special', 900, 12, 3, 46, NULL, -15, 32, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', 'special', 1000, 14, 17, 61, NULL, -13, 31, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', 'special', 1200, 16, 32, 78, NULL, -13, 31, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_od', 'special', 1000, 13, 25, 60, NULL, -14, 23, 0, NULL
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku_od', 'special', 1500, 16, 18, 63, NULL, NULL, 30, 0, NULL
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku', 'special', 900, 16, 17, 91, NULL, NULL, 59, 0, NULL
  UNION ALL SELECT 'high_blade_kick_light', 'special', 1100, 14, 6, 41, NULL, -11, 22, 0, NULL
  UNION ALL SELECT 'high_blade_kick_medium', 'special', 1200, 18, 9, 48, NULL, -8, 22, 0, NULL
  UNION ALL SELECT 'high_blade_kick_heavy', 'special', 1300, 27, 9, 50, NULL, -3, 15, 0, NULL
  UNION ALL SELECT 'high_blade_kick_od', 'special', 800, 17, 5, 54, NULL, -18, 33, 0, NULL
  UNION ALL SELECT 'hashogeki_light', 'special', 700, 12, 6, 35, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'hashogeki_medium', 'special', 800, 19, 6, 41, 2, -6, 17, 0, NULL
  UNION ALL SELECT 'hashogeki_heavy', 'special', 800, 30, 6, 54, NULL, 2, 19, 0, NULL
  UNION ALL SELECT 'denjin_charge_hashogeki', 'special', 800, 20, 6, 44, NULL, 3, 19, 0, NULL
  UNION ALL SELECT 'hashogeki_od', 'special', 1100, 18, 6, 43, 3, 3, 20, 0, NULL
  UNION ALL SELECT 'denjin_charge_od_hashogeki', 'special', 800, 18, 6, 42, NULL, 4, 19, 0, NULL
  UNION ALL SELECT 'denjin_charge', 'special', 0, 1, 52, 52, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa1_shinku_hadoken', 'super_art', 2000, 7, 20, 86, NULL, -24, 60, 0, NULL
  UNION ALL SELECT 'denjin_charge_sa1_shinku_hadoken', 'super_art', 2400, 7, 16, 89, NULL, -24, 67, 0, NULL
  UNION ALL SELECT 'sa2_shin_hashogeki_lv1', 'super_art', 2800, 12, 6, 56, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'sa2_shin_hashogeki_lv2', 'super_art', 2900, 18, 6, 62, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'sa2_shin_hashogeki_lv3', 'super_art', 3000, 50, 6, 94, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv1', 'super_art', 3200, 12, 6, 56, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv2', 'super_art', 3300, 18, 6, 62, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv3', 'super_art', 3400, 50, 6, 94, NULL, -20, 39, 0, NULL
  UNION ALL SELECT 'sa3_shin_shoryuken', 'super_art', 4000, 5, 12, 87, NULL, -52, 71, 0, NULL
  UNION ALL SELECT 'ca_shin_shoryuken', 'critical_art', 4500, 5, 12, 87, NULL, -52, 71, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 6, 0, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 4, 33, 11, 3, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 20, 3, 40, 8, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 5, 43, 8, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 23, 4, 46, 13, 5, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 25, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 7, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 35, 9, 4, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 5, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 20, 6, 46, 5, -3, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 3, 45, NULL, -8, 23, 0, NULL
  UNION ALL SELECT 'rush_collarbone_breaker', 'rush_variant', 600, 31, 4, 53, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_solar_plexus_strike', 'rush_variant', 800, 31, 5, 51, 10, 7, 16, 0, NULL
  UNION ALL SELECT 'rush_short_uppercut', 'rush_variant', 800, 18, 4, 46, 5, -9, 25, 0, NULL
  UNION ALL SELECT 'rush_axe_kick', 'rush_variant', 800, 21, 13, 54, 4, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_whirlwind_kick', 'rush_variant', 800, 27, 4, 50, 6, 0, 20, 0, NULL
) AS v
WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

-- rush_variant の original_move_id を元技 code から解決
UPDATE moves SET original_move_id = (
    SELECT b.id FROM moves b WHERE b.character_id = moves.character_id AND b.code = CASE moves.code
        WHEN 'rush_standing_light_punch' THEN 'standing_light_punch'
        WHEN 'rush_standing_light_kick' THEN 'standing_light_kick'
        WHEN 'rush_standing_medium_punch' THEN 'standing_medium_punch'
        WHEN 'rush_standing_medium_kick' THEN 'standing_medium_kick'
        WHEN 'rush_standing_heavy_punch' THEN 'standing_heavy_punch'
        WHEN 'rush_standing_heavy_kick' THEN 'standing_heavy_kick'
        WHEN 'rush_crouching_light_punch' THEN 'crouching_light_punch'
        WHEN 'rush_crouching_light_kick' THEN 'crouching_light_kick'
        WHEN 'rush_crouching_medium_punch' THEN 'crouching_medium_punch'
        WHEN 'rush_crouching_medium_kick' THEN 'crouching_medium_kick'
        WHEN 'rush_crouching_heavy_punch' THEN 'crouching_heavy_punch'
        WHEN 'rush_crouching_heavy_kick' THEN 'crouching_heavy_kick'
        WHEN 'rush_collarbone_breaker' THEN 'collarbone_breaker'
        WHEN 'rush_solar_plexus_strike' THEN 'solar_plexus_strike'
        WHEN 'rush_short_uppercut' THEN 'short_uppercut'
        WHEN 'rush_axe_kick' THEN 'axe_kick'
        WHEN 'rush_whirlwind_kick' THEN 'whirlwind_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_collarbone_breaker', 'rush_solar_plexus_strike', 'rush_short_uppercut', 'rush_axe_kick', 'rush_whirlwind_kick');

INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, '立ち弱P' AS alias_text
  UNION ALL SELECT 'standing_light_kick', '立ち弱K'
  UNION ALL SELECT 'standing_medium_punch', '立ち中P'
  UNION ALL SELECT 'standing_medium_kick', '立ち中K'
  UNION ALL SELECT 'standing_heavy_punch', '立ち強P'
  UNION ALL SELECT 'standing_heavy_kick', '立ち強K'
  UNION ALL SELECT 'crouching_light_punch', 'しゃがみ弱P'
  UNION ALL SELECT 'crouching_light_kick', 'しゃがみ弱K'
  UNION ALL SELECT 'crouching_medium_punch', 'しゃがみ中P'
  UNION ALL SELECT 'crouching_medium_kick', 'しゃがみ中K'
  UNION ALL SELECT 'crouching_heavy_punch', 'しゃがみ強P'
  UNION ALL SELECT 'crouching_heavy_kick', 'しゃがみ強K'
  UNION ALL SELECT 'jumping_light_punch', 'ジャンプ弱P'
  UNION ALL SELECT 'jumping_light_kick', 'ジャンプ弱K'
  UNION ALL SELECT 'jumping_medium_punch', 'ジャンプ中P'
  UNION ALL SELECT 'jumping_medium_kick', 'ジャンプ中K'
  UNION ALL SELECT 'jumping_heavy_punch', 'ジャンプ強P'
  UNION ALL SELECT 'jumping_heavy_kick', 'ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'collarbone_breaker', '鎖骨割り'
  UNION ALL SELECT 'solar_plexus_strike', '鳩尾砕き'
  UNION ALL SELECT 'short_uppercut', '上げ突き'
  UNION ALL SELECT 'axe_kick', 'かかと落とし'
  UNION ALL SELECT 'whirlwind_kick', '旋風脚'
  UNION ALL SELECT 'high_double_strike', '上段二連撃'
  UNION ALL SELECT 'fuwa_triple_strike_2hits', '不破三連撃(2発止め)'
  UNION ALL SELECT 'fuwa_triple_strike', '不破三連撃'
  UNION ALL SELECT 'hadoken_light', '弱波動拳'
  UNION ALL SELECT 'hadoken_medium', '中波動拳'
  UNION ALL SELECT 'hadoken_heavy', '強波動拳'
  UNION ALL SELECT 'denjin_charge_hadoken', '[電刃錬気]波動拳'
  UNION ALL SELECT 'hadoken_od', 'OD波動拳'
  UNION ALL SELECT 'denjin_charge_od_hadoken', '[電刃錬気]OD波動拳'
  UNION ALL SELECT 'shoryuken_light', '弱昇龍拳'
  UNION ALL SELECT 'shoryuken_medium', '中昇龍拳'
  UNION ALL SELECT 'shoryuken_heavy', '強昇龍拳'
  UNION ALL SELECT 'shoryuken_od', 'OD昇龍拳'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', '弱竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', '中竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', '強竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_od', 'OD竜巻旋風脚'
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku_od', 'OD空中竜巻旋風脚'
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku', '空中竜巻旋風脚'
  UNION ALL SELECT 'high_blade_kick_light', '弱上段足刀蹴り'
  UNION ALL SELECT 'high_blade_kick_medium', '中上段足刀蹴り'
  UNION ALL SELECT 'high_blade_kick_heavy', '強上段足刀蹴り'
  UNION ALL SELECT 'high_blade_kick_od', 'OD上段足刀蹴り'
  UNION ALL SELECT 'hashogeki_light', '弱波掌撃'
  UNION ALL SELECT 'hashogeki_medium', '中波掌撃'
  UNION ALL SELECT 'hashogeki_heavy', '強波掌撃'
  UNION ALL SELECT 'denjin_charge_hashogeki', '[電刃錬気]波掌撃'
  UNION ALL SELECT 'hashogeki_od', 'OD波掌撃'
  UNION ALL SELECT 'denjin_charge_od_hashogeki', '[電刃錬気]OD波掌撃'
  UNION ALL SELECT 'denjin_charge', '電刃錬気'
  UNION ALL SELECT 'sa1_shinku_hadoken', 'SA1 真空波動拳'
  UNION ALL SELECT 'denjin_charge_sa1_shinku_hadoken', '[電刃錬気]SA1 真空波動拳'
  UNION ALL SELECT 'sa2_shin_hashogeki_lv1', 'SA2 真波掌撃(Lv1)'
  UNION ALL SELECT 'sa2_shin_hashogeki_lv2', 'SA2 真波掌撃(Lv2)'
  UNION ALL SELECT 'sa2_shin_hashogeki_lv3', 'SA2 真波掌撃(Lv3)'
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv1', '[電刃錬気]SA2 真波掌撃(Lv1)'
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv2', '[電刃錬気]SA2 真波掌撃(Lv2)'
  UNION ALL SELECT 'denjin_charge_sa2_shin_hashogeki_lv3', '[電刃錬気]SA2 真波掌撃(Lv3)'
  UNION ALL SELECT 'sa3_shin_shoryuken', 'SA3 真・昇龍拳'
  UNION ALL SELECT 'ca_shin_shoryuken', 'CA 真・昇龍拳'
  UNION ALL SELECT 'rush_standing_light_punch', '立ち弱P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_light_kick', '立ち弱K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_punch', '立ち中P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_kick', '立ち中K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_punch', '立ち強P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_kick', '立ち強K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_punch', 'しゃがみ弱P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_kick', 'しゃがみ弱K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'しゃがみ中P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'しゃがみ中K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'しゃがみ強P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'しゃがみ強K(ラッシュ)'
  UNION ALL SELECT 'rush_collarbone_breaker', '鎖骨割り(ラッシュ)'
  UNION ALL SELECT 'rush_solar_plexus_strike', '鳩尾砕き(ラッシュ)'
  UNION ALL SELECT 'rush_short_uppercut', '上げ突き(ラッシュ)'
  UNION ALL SELECT 'rush_axe_kick', 'かかと落とし(ラッシュ)'
  UNION ALL SELECT 'rush_whirlwind_kick', '旋風脚(ラッシュ)'
) AS v
WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

