-- 000026_seed_moves_first_wave.up.sql
-- M14-03b: 第一波キャラの moves + official_ja_move alias + recovery を投入する。
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 移動 system move は CSV に無い(seed の投入元は 000004_data_seed_moves)。
-- ryu は本サブ対象外(M14-03c)。FK 依存順 characters→moves→preset_aliases。

-- ===== terry (70 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 2, -2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 7, 3, 25, 2, -3, 16, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 9, 3, 29, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 4, 30, 2, 1, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 12, 4, 36, 1, -4, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 4, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 17, 3, -2, 11, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 24, 5, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 8, 6, 35, 1, -4, 22, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 36, NULL, -11, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 7, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 7, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'hammer_punch', 'unique', 800, 22, 3, 43, 2, -3, 19, 0, NULL
  UNION ALL SELECT 'power_wave_light', 'special', 600, 14, 36, 49, -3, -9, 0, 0, NULL
  UNION ALL SELECT 'power_wave_medium', 'special', 700, 16, 14, 48, 0, -6, 19, 0, NULL
  UNION ALL SELECT 'power_wave_od', 'special', 800, 15, 29, 43, 2, -2, 0, 0, NULL
  UNION ALL SELECT 'round_wave', 'special', 900, 29, 9, 51, 8, 5, 14, 0, NULL
  UNION ALL SELECT 'power_charge_light', 'special', 700, 14, 5, 42, 3, -9, 24, 0, NULL
  UNION ALL SELECT 'power_charge_medium', 'special', 800, 20, 6, 48, NULL, -11, 23, 0, NULL
  UNION ALL SELECT 'power_charge_heavy', 'special', 800, 25, 9, 60, NULL, -16, 27, 0, NULL
  UNION ALL SELECT 'power_charge_od', 'special', 800, 19, 8, 50, NULL, -14, 24, 0, NULL
  UNION ALL SELECT 'quick_burn', 'special', 900, 10, 14, 46, NULL, -5, 23, 0, NULL
  UNION ALL SELECT 'quick_burn_od', 'special', 1400, 10, 14, 46, NULL, -5, 23, 0, NULL
  UNION ALL SELECT 'burning_knuckle_medium', 'special', 1000, 14, 9, 42, NULL, -6, 20, 0, NULL
  UNION ALL SELECT 'burning_knuckle_heavy', 'special', 1200, 23, 14, 53, NULL, -8, 17, 0, NULL
  UNION ALL SELECT 'burning_knuckle_od', 'special', 1400, 19, 14, 49, NULL, -8, 17, 0, NULL
  UNION ALL SELECT 'crack_shoot_light', 'special', 700, 16, 4, 37, 1, -3, 18, 0, NULL
  UNION ALL SELECT 'crack_shoot_medium', 'special', 900, 17, 7, 41, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'crack_shoot_heavy', 'special', 1100, 23, 11, 52, NULL, -1, 19, 0, NULL
  UNION ALL SELECT 'crack_shoot_od', 'special', 1200, 20, 4, 42, NULL, -2, 19, 0, NULL
  UNION ALL SELECT 'rising_tackle_light', 'special', 1000, 5, 10, 47, NULL, -23, 33, 0, NULL
  UNION ALL SELECT 'rising_tackle_medium', 'special', 1200, 6, 10, 55, NULL, -26, 40, 0, NULL
  UNION ALL SELECT 'rising_tackle_heavy', 'special', 1300, 7, 20, 68, NULL, -36, 42, 0, NULL
  UNION ALL SELECT 'rising_tackle_od', 'special', 1600, 6, 15, 69, NULL, -42, 49, 0, NULL
  UNION ALL SELECT 'sa1_buster_wolf', 'super_art', 2000, 7, 12, 78, NULL, -26, 60, 0, NULL
  UNION ALL SELECT 'sa2_power_geyser', 'super_art', 2600, 13, 13, 79, NULL, -27, 54, 0, NULL
  UNION ALL SELECT 'sa2_twin_geyser', 'super_art', 3400, 22, 6, 70, NULL, NULL, 43, 0, NULL
  UNION ALL SELECT 'sa2_triple_geyser', 'super_art', 4040, 14, 1, 139, NULL, NULL, 125, 0, NULL
  UNION ALL SELECT 'sa3_rising_fang', 'super_art', 4000, 8, 27, 91, NULL, -50, 57, 0, NULL
  UNION ALL SELECT 'ca_rising_fang', 'critical_art', 4500, 8, 27, 91, NULL, -50, 57, 0, NULL
  UNION ALL SELECT 'power_drive', 'target_combo', 1470, 15, 3, 39, NULL, -5, 22, 0, NULL
  UNION ALL SELECT 'power_shoot', 'target_combo', 1300, 18, 3, 51, NULL, -14, 31, 0, NULL
  UNION ALL SELECT 'power_dunk', 'target_combo', 1300, 18, 30, 80, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'passing_sway', 'target_combo', 1100, 13, 2, 52, -3, -12, 38, 0, NULL
  UNION ALL SELECT 'jumping_lariat', 'target_combo', 1000, 24, 2, 43, 4, 3, 18, 0, '{"notes":"地上では繋がらない。単発ダメージを記載。"}'
  UNION ALL SELECT 'jumping_knee', 'target_combo', 1000, 24, 2, 45, 3, -2, 20, 0, '{"notes":"地上では繋がらない。単発ダメージを記載。"}'
  UNION ALL SELECT 'fire_kick', 'target_combo', 900, 13, 2, 42, NULL, -16, 28, 0, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 6, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 18, 3, 36, 6, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 20, 3, 40, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 4, 41, 6, 5, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 23, 4, 47, 5, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 28, 7, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 35, 9, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 19, 6, 46, 5, 0, 22, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 47, NULL, -7, 24, 0, NULL
  UNION ALL SELECT 'rush_hammer_punch', 'rush_variant', 800, 33, 3, 54, 6, 1, 19, 0, NULL
) AS v
WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_hammer_punch' THEN 'hammer_punch'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_hammer_punch');

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
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'hammer_punch', 'ハンマーパンチ'
  UNION ALL SELECT 'power_wave_light', '弱パワーウェイブ'
  UNION ALL SELECT 'power_wave_medium', '中パワーウェイブ'
  UNION ALL SELECT 'power_wave_od', 'ODパワーウェイブ'
  UNION ALL SELECT 'round_wave', 'ラウンドウェイブ'
  UNION ALL SELECT 'power_charge_light', '弱パワーチャージ'
  UNION ALL SELECT 'power_charge_medium', '中パワーチャージ'
  UNION ALL SELECT 'power_charge_heavy', '強パワーチャージ'
  UNION ALL SELECT 'power_charge_od', 'ODパワーチャージ'
  UNION ALL SELECT 'quick_burn', 'クイックバーン'
  UNION ALL SELECT 'quick_burn_od', 'ODクイックバーン'
  UNION ALL SELECT 'burning_knuckle_medium', '中バーンナックル'
  UNION ALL SELECT 'burning_knuckle_heavy', '強バーンナックル'
  UNION ALL SELECT 'burning_knuckle_od', 'ODバーンナックル'
  UNION ALL SELECT 'crack_shoot_light', '弱クラックシュート'
  UNION ALL SELECT 'crack_shoot_medium', '中クラックシュート'
  UNION ALL SELECT 'crack_shoot_heavy', '強クラックシュート'
  UNION ALL SELECT 'crack_shoot_od', 'ODクラックシュート'
  UNION ALL SELECT 'rising_tackle_light', '弱ライジングタックル'
  UNION ALL SELECT 'rising_tackle_medium', '中ライジングタックル'
  UNION ALL SELECT 'rising_tackle_heavy', '強ライジングタックル'
  UNION ALL SELECT 'rising_tackle_od', 'ODライジングタックル'
  UNION ALL SELECT 'sa1_buster_wolf', 'SA1 バスターウルフ'
  UNION ALL SELECT 'sa2_power_geyser', 'SA2 パワーゲイザー'
  UNION ALL SELECT 'sa2_twin_geyser', 'SA2 ツインゲイザー'
  UNION ALL SELECT 'sa2_triple_geyser', 'SA2 トリプルゲイザー'
  UNION ALL SELECT 'sa3_rising_fang', 'SA3 ライジングファング'
  UNION ALL SELECT 'ca_rising_fang', 'CA ライジングファング'
  UNION ALL SELECT 'power_drive', 'パワードライブ'
  UNION ALL SELECT 'power_shoot', 'パワーシュート'
  UNION ALL SELECT 'power_dunk', 'パワーダンク'
  UNION ALL SELECT 'passing_sway', 'パッシングスウェー'
  UNION ALL SELECT 'jumping_lariat', 'ジャンプラリアットパンチ'
  UNION ALL SELECT 'jumping_knee', 'ジャンプニーアタック'
  UNION ALL SELECT 'fire_kick', 'ファイヤーキック'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
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
  UNION ALL SELECT 'rush_hammer_punch', 'ハンマーパンチ(ラッシュ)'
) AS v
WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== guile (88 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 14 AS total, 4 AS on_hit, -2 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 3, -1, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 7, 3, 24, 6, 0, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 7, 5, 29, 1, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 7, 3, 32, -1, -6, 23, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 13, 3, 36, 4, -4, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 5, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 18, 1, -3, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 3, 24, 4, -2, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 28, 4, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 9, 5, 33, 0, -9, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 21, 50, NULL, -12, 21, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 10, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 3, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 600, 7, 7, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 4, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 5, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'recoil_cannon', 'target_combo', 1200, 16, 3, 44, NULL, -9, 26, 0, NULL
  UNION ALL SELECT 'double_shot', 'target_combo', 960, 12, 3, 30, NULL, -6, 16, 0, NULL
  UNION ALL SELECT 'drake_fang', 'target_combo', 1140, 20, 3, 43, 1, -5, 21, 0, NULL
  UNION ALL SELECT 'phantom_cutter', 'target_combo', 930, 10, 3, 37, NULL, -12, 25, 0, '{"notes_tool":"ガードフレームはこれが正しい。インゲームで全てガード設定だとCPUが立つのが遅いので-10になる。"}'
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'flying_mare', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'flying_buster_drop', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'full_bullet_magnum', 'unique', 800, 20, 3, 41, 2, -3, 19, 0, NULL
  UNION ALL SELECT 'burning_straight', 'unique', 800, 9, 3, 32, 1, -4, 21, 0, NULL
  UNION ALL SELECT 'spinning_back_knuckle', 'unique', 800, 16, 3, 38, 5, 3, 20, 0, NULL
  UNION ALL SELECT 'knee_bazooka', 'unique', 500, 8, 5, 27, 0, -4, 15, 0, NULL
  UNION ALL SELECT 'rolling_sobat', 'unique', 700, 11, 3, 31, 3, -6, 18, 0, NULL
  UNION ALL SELECT 'reverse_spin_kick', 'unique', 1000, 17, 3, 45, -1, -8, 26, 0, NULL
  UNION ALL SELECT 'guile_high_kick', 'unique', 1000, 10, 3, 35, 0, -9, 23, 0, NULL
  UNION ALL SELECT 'sonic_boom_light', 'special', 550, 10, 31, 40, 3, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_perfect_light', 'special', 600, 10, 31, 40, 4, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_medium', 'special', 550, 10, 31, 40, 3, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_perfect_medium', 'special', 600, 10, 31, 40, 4, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_heavy', 'special', 550, 10, 31, 40, 3, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_perfect_heavy', 'special', 600, 10, 31, 40, 4, -3, 0, 0, NULL
  UNION ALL SELECT 'sonic_boom_od', 'special', 1000, 10, 29, 38, NULL, 3, 0, 0, NULL
  UNION ALL SELECT 'somersault_kick_light', 'special', 1000, 5, 6, 51, NULL, -30, 41, 0, NULL
  UNION ALL SELECT 'somersault_kick_perfect_light', 'special', 1200, 5, 6, 51, NULL, -30, 41, 0, NULL
  UNION ALL SELECT 'somersault_kick_medium', 'special', 1100, 6, 6, 53, NULL, -31, 42, 0, NULL
  UNION ALL SELECT 'somersault_kick_perfect_medium', 'special', 1300, 6, 6, 53, NULL, -31, 42, 0, NULL
  UNION ALL SELECT 'somersault_kick_heavy', 'special', 1200, 7, 6, 55, NULL, -32, 43, 0, NULL
  UNION ALL SELECT 'somersault_kick_perfect_heavy', 'special', 1400, 7, 6, 55, NULL, -32, 43, 0, NULL
  UNION ALL SELECT 'somersault_kick_od', 'special', 1600, 6, 6, 57, NULL, -33, 46, 0, NULL
  UNION ALL SELECT 'sonic_blade_light', 'special', 400, 16, 27, 42, -3, -4, 0, 0, NULL
  UNION ALL SELECT 'sonic_blade_medium', 'special', 400, 21, 30, 50, -6, -7, 0, 0, NULL
  UNION ALL SELECT 'sonic_blade_heavy', 'special', 500, 31, 24, 54, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'sonic_blade_od', 'special', 300, 15, 25, 39, NULL, -4, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_light', 'special', 1000, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_perfect_light', 'special', 1200, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_medium', 'special', 1000, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_perfect_medium', 'special', 1200, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_heavy', 'special', 1000, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_perfect_heavy', 'special', 1200, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_od', 'special', 1300, 10, 29, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sonic_cross_perfect_od', 'special', 1300, 10, 29, 38, NULL, NULL, 0, 0, '{"notes_tool":"ジャストとそうでないもので性能差ないが、インゲームでは一応別"}'
  UNION ALL SELECT 'sonic_cross_2_meter_od', 'special', 1700, 15, 46, 71, NULL, NULL, 11, 0, NULL
  UNION ALL SELECT 'sonic_break', 'special', 600, 11, 26, 36, NULL, -2, 0, 0, NULL
  UNION ALL SELECT 'sonic_break_od', 'special', 1000, 11, 25, 35, NULL, 3, 0, 0, NULL
  UNION ALL SELECT 'sa1_sonic_hurricane_up', 'super_art', 1800, 7, 52, 75, NULL, -2, 17, 0, NULL
  UNION ALL SELECT 'sa1_sonic_hurricane_side', 'super_art', 2000, 8, 51, 89, NULL, -26, 31, 0, NULL
  UNION ALL SELECT 'sa2_solid_puncher', 'super_art', 0, 6, 0, 6, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'sa3_crossfire_somersault', 'super_art', 4000, 9, 6, 84, NULL, -59, 70, 0, NULL
  UNION ALL SELECT 'ca_crossfire_somersault', 'critical_art', 4500, 9, 6, 84, NULL, -59, 70, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 25, 8, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 7, 3, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 18, 3, 35, 10, 4, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 18, 5, 40, 5, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 18, 3, 43, 3, -2, 23, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 24, 3, 47, 8, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 9, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 29, 5, 1, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 3, 35, 8, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 39, 8, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 20, 5, 44, 4, -5, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 21, 61, NULL, -8, 21, 0, NULL
  UNION ALL SELECT 'rush_full_bullet_magnum', 'rush_variant', 800, 31, 3, 52, 6, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_burning_straight', 'rush_variant', 800, 20, 3, 43, 5, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_spinning_back_knuckle', 'rush_variant', 800, 27, 3, 49, 9, 7, 20, 0, NULL
  UNION ALL SELECT 'rush_knee_bazooka', 'rush_variant', 500, 19, 5, 38, 4, 0, 15, 0, NULL
  UNION ALL SELECT 'rush_rolling_sobat', 'rush_variant', 700, 22, 3, 42, 7, -2, 18, 0, NULL
  UNION ALL SELECT 'rush_reverse_spin_kick', 'rush_variant', 1000, 28, 3, 56, 3, -4, 26, 0, NULL
  UNION ALL SELECT 'rush_guile_high_kick', 'rush_variant', 1000, 21, 3, 46, 4, -5, 23, 0, NULL
) AS v
WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_full_bullet_magnum' THEN 'full_bullet_magnum'
        WHEN 'rush_burning_straight' THEN 'burning_straight'
        WHEN 'rush_spinning_back_knuckle' THEN 'spinning_back_knuckle'
        WHEN 'rush_knee_bazooka' THEN 'knee_bazooka'
        WHEN 'rush_rolling_sobat' THEN 'rolling_sobat'
        WHEN 'rush_reverse_spin_kick' THEN 'reverse_spin_kick'
        WHEN 'rush_guile_high_kick' THEN 'guile_high_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_full_bullet_magnum', 'rush_burning_straight', 'rush_spinning_back_knuckle', 'rush_knee_bazooka', 'rush_rolling_sobat', 'rush_reverse_spin_kick', 'rush_guile_high_kick');

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
  UNION ALL SELECT 'recoil_cannon', 'リコイルキャノン'
  UNION ALL SELECT 'double_shot', 'ダブルバレット'
  UNION ALL SELECT 'drake_fang', 'ドレイクファング'
  UNION ALL SELECT 'phantom_cutter', 'ファントムカッター'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'flying_mare', 'フライングメイヤー'
  UNION ALL SELECT 'flying_buster_drop', 'フライングバスタードロップ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'full_bullet_magnum', 'フルブレットマグナム'
  UNION ALL SELECT 'burning_straight', 'バーンストレート'
  UNION ALL SELECT 'spinning_back_knuckle', 'スピニングバックナックル'
  UNION ALL SELECT 'knee_bazooka', 'ニーバズーカ'
  UNION ALL SELECT 'rolling_sobat', 'ローリングソバット'
  UNION ALL SELECT 'reverse_spin_kick', 'リバースピンキック'
  UNION ALL SELECT 'guile_high_kick', 'ガイルハイキック'
  UNION ALL SELECT 'sonic_boom_light', '弱ソニックブーム'
  UNION ALL SELECT 'sonic_boom_perfect_light', '【ジャスト】弱ソニックブーム'
  UNION ALL SELECT 'sonic_boom_medium', '中ソニックブーム'
  UNION ALL SELECT 'sonic_boom_perfect_medium', '【ジャスト】中ソニックブーム'
  UNION ALL SELECT 'sonic_boom_heavy', '強ソニックブーム'
  UNION ALL SELECT 'sonic_boom_perfect_heavy', '【ジャスト】強ソニックブーム'
  UNION ALL SELECT 'sonic_boom_od', 'ODソニックブーム'
  UNION ALL SELECT 'somersault_kick_light', '弱サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_perfect_light', '【ジャスト】弱サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_medium', '中サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_perfect_medium', '【ジャスト】中サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_heavy', '強サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_perfect_heavy', '【ジャスト】強サマーソルトキック'
  UNION ALL SELECT 'somersault_kick_od', 'ODサマーソルトキック'
  UNION ALL SELECT 'sonic_blade_light', '弱ソニックブレイド'
  UNION ALL SELECT 'sonic_blade_medium', '中ソニックブレイド'
  UNION ALL SELECT 'sonic_blade_heavy', '強ソニックブレイド'
  UNION ALL SELECT 'sonic_blade_od', 'ODソニックブレイド'
  UNION ALL SELECT 'sonic_cross_light', '弱ソニッククロス'
  UNION ALL SELECT 'sonic_cross_perfect_light', '【ジャスト】弱ソニッククロス'
  UNION ALL SELECT 'sonic_cross_medium', '中ソニッククロス'
  UNION ALL SELECT 'sonic_cross_perfect_medium', '【ジャスト】中ソニッククロス'
  UNION ALL SELECT 'sonic_cross_heavy', '強ソニッククロス'
  UNION ALL SELECT 'sonic_cross_perfect_heavy', '【ジャスト】強ソニッククロス'
  UNION ALL SELECT 'sonic_cross_od', 'ODソニッククロス１'
  UNION ALL SELECT 'sonic_cross_perfect_od', '【ジャスト】ODソニッククロス１'
  UNION ALL SELECT 'sonic_cross_2_meter_od', 'ODソニッククロス２'
  UNION ALL SELECT 'sonic_break', 'ソニックブレイク'
  UNION ALL SELECT 'sonic_break_od', 'ODソニックブレイク'
  UNION ALL SELECT 'sa1_sonic_hurricane_up', 'SA1 ソニックハリケーン （上）'
  UNION ALL SELECT 'sa1_sonic_hurricane_side', 'SA1 ソニックハリケーン （横）'
  UNION ALL SELECT 'sa2_solid_puncher', 'SA2 ソリッドパンチャー'
  UNION ALL SELECT 'sa3_crossfire_somersault', 'SA3 クロスファイアサマーソルト'
  UNION ALL SELECT 'ca_crossfire_somersault', 'CA クロスファイアサマーソルト'
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
  UNION ALL SELECT 'rush_full_bullet_magnum', 'フルブレットマグナム(ラッシュ)'
  UNION ALL SELECT 'rush_burning_straight', 'バーンストレート(ラッシュ)'
  UNION ALL SELECT 'rush_spinning_back_knuckle', 'スピニングバックナックル(ラッシュ)'
  UNION ALL SELECT 'rush_knee_bazooka', 'ニーバズーカ(ラッシュ)'
  UNION ALL SELECT 'rush_rolling_sobat', 'ローリングソバット(ラッシュ)'
  UNION ALL SELECT 'rush_reverse_spin_kick', 'リバースピンキック(ラッシュ)'
  UNION ALL SELECT 'rush_guile_high_kick', 'ガイルハイキック(ラッシュ)'
) AS v
WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== lily (81 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 350 AS damage, 5 AS startup, 3 AS active, 15 AS total, 6 AS on_hit, -1 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 3, 14, 5, -1, 8, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 800, 9, 4, 29, 1, -4, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 7, 3, 24, 2, -1, 15, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 10, 3, 34, 0, -5, 22, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 1000, 14, 4, 38, 1, -5, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 6, 3, 16, 6, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 18, 2, -2, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 700, 8, 3, 28, 1, -3, 18, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 9, 3, 29, 1, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 1000, 10, 6, 37, 0, -2, 22, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 10, 44, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 9, 48, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 6, 48, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 9, 4, 48, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 8, 5, 48, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 10, 6, 48, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 11, 6, 48, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'ridge_thrust', 'unique', 900, 25, 3, 45, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'horn_breaker', 'unique', 1000, 14, 4, 35, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'great_spin', 'unique', 800, 9, 11, 48, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'desert_storm_1hits', 'unique', 900, 16, 2, 41, 2, -4, 24, 0, NULL
  UNION ALL SELECT 'condor_wind_light', 'special', NULL, 1, 47, 47, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'condor_wind_medium', 'special', 900, 23, 4, 51, 2, -8, 25, 0, NULL
  UNION ALL SELECT 'condor_wind_heavy', 'special', 1100, 25, 4, 53, NULL, -8, 25, 0, NULL
  UNION ALL SELECT 'condor_wind_od', 'special', 1200, 19, 4, 45, NULL, -5, 23, 0, NULL
  UNION ALL SELECT 'condor_spire_light', 'special', 800, 17, 13, 45, NULL, -8, 16, 0, NULL
  UNION ALL SELECT 'windclad_light_condor_spire', 'special', 1000, 9, 29, 51, NULL, 1, 14, 0, NULL
  UNION ALL SELECT 'condor_spire_medium', 'special', 900, 21, 13, 49, NULL, -8, 16, 0, NULL
  UNION ALL SELECT 'windclad_medium_condor_spire', 'special', 1100, 13, 29, 55, NULL, 1, 14, 0, NULL
  UNION ALL SELECT 'condor_spire_heavy', 'special', 1000, 25, 13, 53, NULL, -8, 16, 0, NULL
  UNION ALL SELECT 'windclad_heavy_condor_spire', 'special', 1200, 17, 29, 59, NULL, 1, 14, 0, NULL
  UNION ALL SELECT 'condor_spire_od', 'special', 1000, 15, 13, 40, NULL, -8, 13, 0, NULL
  UNION ALL SELECT 'windclad_od_condor_spire', 'special', 1200, 9, 24, 46, NULL, 2, 14, 0, '{"notes_tool":"追加入力（弱中or弱強か中強）で性能変わるがフレーム影響なし"}'
  UNION ALL SELECT 'tomahawk_buster_light', 'special', 900, 6, 11, 49, NULL, -27, 33, 0, NULL
  UNION ALL SELECT 'windclad_light_tomahawk_buster', 'special', 1000, 4, 13, 49, NULL, -25, 33, 0, NULL
  UNION ALL SELECT 'tomahawk_buster_medium', 'special', 1000, 8, 12, 56, NULL, -32, 37, 0, NULL
  UNION ALL SELECT 'windclad_medium_tomahawk_buster', 'special', 1200, 6, 14, 56, NULL, -30, 37, 0, NULL
  UNION ALL SELECT 'tomahawk_buster_heavy', 'special', 1200, 10, 14, 61, NULL, -35, 38, 0, NULL
  UNION ALL SELECT 'windclad_heavy_tomahawk_buster', 'special', 1400, 8, 16, 61, NULL, -33, 38, 0, NULL
  UNION ALL SELECT 'tomahawk_buster_od', 'special', 1400, 6, 12, 60, NULL, -35, 43, 0, NULL
  UNION ALL SELECT 'windclad_od_tomahawk_buster', 'special', 1600, 4, 14, 60, NULL, -35, 43, 0, NULL
  UNION ALL SELECT 'condor_dive_od', 'special', 1400, 26, 10, 59, NULL, -24, 24, 0, NULL
  UNION ALL SELECT 'condor_dive', 'special', 800, 26, 11, 60, NULL, -24, 24, 0, NULL
  UNION ALL SELECT 'windclad_od_condor_dive', 'special', 1600, 26, 10, 59, NULL, -23, 24, 0, NULL
  UNION ALL SELECT 'windclad_condor_dive', 'special', 1000, 26, 11, 60, NULL, -23, 24, 0, NULL
  UNION ALL SELECT 'windclad_od_condor_dive_follow_up', 'special', 1200, 12, 10, 45, NULL, -23, 24, 0, NULL
  UNION ALL SELECT 'condor_dive_follow_up', 'special', 800, 12, 12, 47, NULL, -23, 24, 0, NULL
  UNION ALL SELECT 'mexican_typhoon_light', 'special', 2000, 5, 3, 60, NULL, NULL, 53, 0, NULL
  UNION ALL SELECT 'mexican_typhoon_medium', 'special', 2400, 5, 3, 60, NULL, NULL, 53, 0, NULL
  UNION ALL SELECT 'mexican_typhoon_heavy', 'special', 2800, 5, 3, 60, NULL, NULL, 53, 0, NULL
  UNION ALL SELECT 'mexican_typhoon_od', 'special', 2900, 5, 3, 60, NULL, NULL, 53, 0, NULL
  UNION ALL SELECT 'sa1_breezing_hawk', 'super_art', 2200, 10, 38, 101, NULL, -36, 54, 0, NULL
  UNION ALL SELECT 'sa2_thunderbird', 'super_art', 2600, 9, 33, 104, NULL, -60, 63, 0, NULL
  UNION ALL SELECT 'windclad_sa2_thunderbird', 'super_art', 2900, 9, 63, 104, NULL, -59, 33, 0, NULL
  UNION ALL SELECT 'sa2_soaring_thunderbird', 'super_art', 2600, 15, 33, 104, NULL, -54, 57, 0, NULL
  UNION ALL SELECT 'windclad_sa2_soaring_thunderbird', 'super_art', 2900, 15, 33, 104, NULL, -51, 57, 0, NULL
  UNION ALL SELECT 'sa3_raging_typhoon', 'super_art', 4500, 7, 2, 114, NULL, NULL, 106, 0, NULL
  UNION ALL SELECT 'ca_raging_typhoon', 'critical_art', 5000, 7, 2, 114, NULL, NULL, 106, 0, NULL
  UNION ALL SELECT 'desert_storm_2hits', 'target_combo', 1400, 20, 2, 48, 0, -9, 27, 0, NULL
  UNION ALL SELECT 'desert_storm', 'target_combo', 2040, 20, 3, 61, NULL, -23, 39, 0, NULL
  UNION ALL SELECT 'double_arrow', 'target_combo', 1400, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 350, 16, 3, 26, 10, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 3, 25, 9, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 800, 20, 4, 40, 5, 0, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 18, 3, 35, 6, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 21, 3, 45, 4, -1, 22, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 1000, 25, 4, 49, 5, -1, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 17, 3, 27, 10, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 29, 6, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 700, 19, 3, 39, 5, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 20, 3, 40, 5, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 1000, 21, 6, 48, 4, 2, 22, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 10, 55, NULL, -8, 24, 0, NULL
  UNION ALL SELECT 'rush_ridge_thrust', 'rush_variant', 900, 36, 3, 56, 6, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_horn_breaker', 'rush_variant', 1000, 25, 4, 46, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_desert_storm_1hits', 'rush_variant', 900, 27, 2, 52, 6, 0, 24, 0, NULL
) AS v
WHERE c.code = 'lily' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_ridge_thrust' THEN 'ridge_thrust'
        WHEN 'rush_horn_breaker' THEN 'horn_breaker'
        WHEN 'rush_desert_storm_1hits' THEN 'desert_storm_1hits'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'lily' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_ridge_thrust', 'rush_horn_breaker', 'rush_desert_storm_1hits');

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
  UNION ALL SELECT 'ridge_thrust', 'スラストリッジ'
  UNION ALL SELECT 'horn_breaker', 'ホーンブレイク'
  UNION ALL SELECT 'great_spin', 'グレートスピン'
  UNION ALL SELECT 'desert_storm_1hits', 'デザートストーム(単発)'
  UNION ALL SELECT 'condor_wind_light', '弱コンドルウィンド'
  UNION ALL SELECT 'condor_wind_medium', '中コンドルウィンド'
  UNION ALL SELECT 'condor_wind_heavy', '強コンドルウィンド'
  UNION ALL SELECT 'condor_wind_od', 'ODコンドルウィンド'
  UNION ALL SELECT 'condor_spire_light', '弱コンドルスパイア'
  UNION ALL SELECT 'windclad_light_condor_spire', '[風纏い]弱コンドルスパイア'
  UNION ALL SELECT 'condor_spire_medium', '中コンドルスパイア'
  UNION ALL SELECT 'windclad_medium_condor_spire', '[風纏い]中コンドルスパイア'
  UNION ALL SELECT 'condor_spire_heavy', '強コンドルスパイア'
  UNION ALL SELECT 'windclad_heavy_condor_spire', '[風纏い]強コンドルスパイア'
  UNION ALL SELECT 'condor_spire_od', 'ODコンドルスパイア'
  UNION ALL SELECT 'windclad_od_condor_spire', '[風纏い]ODコンドルスパイア'
  UNION ALL SELECT 'tomahawk_buster_light', '弱トマホークバスター'
  UNION ALL SELECT 'windclad_light_tomahawk_buster', '[風纏い]弱トマホークバスター'
  UNION ALL SELECT 'tomahawk_buster_medium', '中トマホークバスター'
  UNION ALL SELECT 'windclad_medium_tomahawk_buster', '[風纏い]中トマホークバスター'
  UNION ALL SELECT 'tomahawk_buster_heavy', '強トマホークバスター'
  UNION ALL SELECT 'windclad_heavy_tomahawk_buster', '[風纏い]強トマホークバスター'
  UNION ALL SELECT 'tomahawk_buster_od', 'ODトマホークバスター'
  UNION ALL SELECT 'windclad_od_tomahawk_buster', '[風纏い]ODトマホークバスター'
  UNION ALL SELECT 'condor_dive_od', 'ODコンドルダイブ'
  UNION ALL SELECT 'condor_dive', 'コンドルダイブ'
  UNION ALL SELECT 'windclad_od_condor_dive', '[風纏い]ODコンドルダイブ'
  UNION ALL SELECT 'windclad_condor_dive', '[風纏い]コンドルダイブ'
  UNION ALL SELECT 'windclad_od_condor_dive_follow_up', 'ODコンドルダイブ(派生)'
  UNION ALL SELECT 'condor_dive_follow_up', 'コンドルダイブ(派生)'
  UNION ALL SELECT 'mexican_typhoon_light', '弱メキシカンタイフーン'
  UNION ALL SELECT 'mexican_typhoon_medium', '中メキシカンタイフーン'
  UNION ALL SELECT 'mexican_typhoon_heavy', '強メキシカンタイフーン'
  UNION ALL SELECT 'mexican_typhoon_od', 'ODメキシカンタイフーン'
  UNION ALL SELECT 'sa1_breezing_hawk', 'SA1 ブリージングホーク'
  UNION ALL SELECT 'sa2_thunderbird', 'SA2 サンダーバード'
  UNION ALL SELECT 'windclad_sa2_thunderbird', 'SA2 [風纏い]サンダーバード'
  UNION ALL SELECT 'sa2_soaring_thunderbird', 'SA2 スカイサンダーバード'
  UNION ALL SELECT 'windclad_sa2_soaring_thunderbird', 'SA2 [風纏い]スカイサンダーバード'
  UNION ALL SELECT 'sa3_raging_typhoon', 'SA3 レイジングタイフーン'
  UNION ALL SELECT 'ca_raging_typhoon', 'CA レイジングタイフーン'
  UNION ALL SELECT 'desert_storm_2hits', 'デザートストーム(2発止め)'
  UNION ALL SELECT 'desert_storm', 'デザートストーム'
  UNION ALL SELECT 'double_arrow', 'ダブルアロー'
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
  UNION ALL SELECT 'rush_ridge_thrust', 'スラストリッジ(ラッシュ)'
  UNION ALL SELECT 'rush_horn_breaker', 'ホーンブレイク(ラッシュ)'
  UNION ALL SELECT 'rush_desert_storm_1hits', 'デザートストーム(ラッシュ)'
) AS v
WHERE c.code = 'lily' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== ingrid (91 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 5 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 2, -3, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 5, 23, 1, 0, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 8, 4, 27, 3, -3, 16, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 12, 4, 35, 3, -5, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 9, 9, 36, 4, -2, 19, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 14, 4, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 3, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 4, 25, 6, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, 1, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 12, 3, 34, 1, -1, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 37, NULL, -12, 25, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 10, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 8, 4, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 8, 6, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 12, 7, 46, NULL, NULL, 28, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'sun_bright', 'unique', 600, 21, 4, 40, 3, -3, 16, 0, NULL
  UNION ALL SELECT 'halo_flight', 'unique', 900, 17, 3, 43, NULL, -4, 24, 0, NULL
  UNION ALL SELECT 'pretty_heel_kick', 'target_combo', 1300, 12, 3, 37, -3, -11, 23, 0, NULL
  UNION ALL SELECT 'glowing_touch_1hits', 'unique', 700, 9, 3, 29, 4, -4, 18, 0, NULL
  UNION ALL SELECT 'glowing_touch', 'target_combo', 1500, 20, 6, 46, NULL, -11, 21, 0, NULL
  UNION ALL SELECT 'luminous_uppercut_1hits', 'unique', 800, 14, 5, 38, NULL, -8, 20, 0, NULL
  UNION ALL SELECT 'luminous_uppercut', 'target_combo', 1600, 23, 8, 46, NULL, -10, 16, 0, NULL
  UNION ALL SELECT 'satelite_leap', 'target_combo', 1400, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'sun_shot_light', 'special', 700, 17, 33, 49, -2, -6, 0, 0, NULL
  UNION ALL SELECT 'sun_shot_medium', 'special', 700, 17, 33, 49, -2, -6, 0, 0, NULL
  UNION ALL SELECT 'sun_shot_heavy', 'special', 700, 15, 34, 48, -1, -5, 0, 0, NULL
  UNION ALL SELECT 'sun_shot_holding_heavy', 'special', 700, 15, 32, 46, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'od_sun_shot_light', 'special', 1000, 17, 29, 45, NULL, 1, 0, 0, NULL
  UNION ALL SELECT 'od_sun_shot_medium', 'special', 1000, 17, 29, 45, NULL, 1, 0, 0, NULL
  UNION ALL SELECT 'od_sun_shot_heavy', 'special', 1000, 15, 30, 44, NULL, 2, 0, 0, NULL
  UNION ALL SELECT 'sun_flare_light', 'special', 0, 1, 48, 48, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sun_flare_lv1', 'special', 900, 21, 6, 47, NULL, -4, 21, 0, NULL
  UNION ALL SELECT 'sun_flare_lv2', 'special', 1100, 18, 15, 46, NULL, 4, 14, 0, NULL
  UNION ALL SELECT 'sun_flare_lv3', 'special', 1350, 18, 15, 46, NULL, 5, 14, 0, NULL
  UNION ALL SELECT 'sun_flare_lv1_od', 'special', 1100, 18, 15, 46, NULL, 4, 14, 0, NULL
  UNION ALL SELECT 'sun_flare_lv2_od', 'special', 1350, 18, 15, 46, NULL, 5, 14, 0, NULL
  UNION ALL SELECT 'sun_flare_lv3_od', 'special', 1800, 18, 18, 46, NULL, 9, 11, 0, NULL
  UNION ALL SELECT 'solar_burst_lv1_neutral_od', 'special', 1100, 34, 8, 65, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'solar_burst_lv1_forward_od', 'special', 1100, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_lv2_neutral_od', 'special', 1350, 34, 8, 66, NULL, NULL, 25, 0, NULL
  UNION ALL SELECT 'solar_burst_lv2_forward_od', 'special', 1350, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_lv3_neutral_od', 'special', 1800, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_lv3_forward_od', 'special', 1800, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_light_neutral', 'special', 0, 47, 1, 48, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'solar_burst_light_forward', 'special', 0, 47, 1, 48, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'solar_burst_lv1_neutral', 'special', 900, 34, 8, 65, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'solar_burst_lv1_forward', 'special', 900, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_lv2_neutral', 'special', 1100, 34, 8, 65, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'solar_burst_lv2_forward', 'special', 1100, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'solar_burst_lv3_neutral', 'special', 1350, 34, 8, 66, NULL, NULL, 25, 0, NULL
  UNION ALL SELECT 'solar_burst_lv3_forward', 'special', 1350, 34, 8, 63, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'sun_rise_light', 'special', 1000, 8, 10, 51, NULL, -24, 34, 0, NULL
  UNION ALL SELECT 'sun_rise_medium', 'special', 1200, 13, 32, 77, NULL, -23, 33, 0, NULL
  UNION ALL SELECT 'sun_rise_heavy', 'special', 1300, 27, 27, 94, NULL, -25, 41, 0, NULL
  UNION ALL SELECT 'sun_rise_od', 'special', 1600, 14, 22, 56, NULL, -3, 21, 0, NULL
  UNION ALL SELECT 'sun_veil_od', 'special', 1200, 1, 20, 55, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'sun_veil', 'special', 1000, 6, 15, 55, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'vanishing_sun_backward', 'special', NULL, 13, 14, 48, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'vanishing_sun_upward', 'special', 1100, 43, 4, 59, NULL, 2, 13, 0, NULL
  UNION ALL SELECT 'vanishing_sun_forward', 'special', 1000, 36, 4, 57, NULL, NULL, 18, 0, NULL
  UNION ALL SELECT 'sa1_shining_sun_lv1', 'super_art', 1900, 11, 40, 129, NULL, -99, 79, 0, NULL
  UNION ALL SELECT 'sa1_shining_sun_lv2', 'super_art', 2300, 11, 40, 129, NULL, -99, 79, 0, NULL
  UNION ALL SELECT 'sa1_shining_sun_lv3', 'super_art', 2700, 11, 40, 129, NULL, -99, 79, 0, NULL
  UNION ALL SELECT 'sa2_order_of_the_sun_lv1', 'super_art', 1600, 13, 0, 13, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'sa2_order_of_the_sun_lv2', 'super_art', 2400, 13, 0, 13, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'sa2_order_of_the_sun_lv3', 'super_art', 3400, 13, 0, 13, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'sa3_cosmic_ray', 'super_art', 4000, 20, 3, 90, NULL, -45, 68, 0, NULL
  UNION ALL SELECT 'ca_cosmic_ray', 'critical_art', 4500, 20, 3, 90, NULL, -45, 68, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 9, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 6, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 5, 34, 5, 4, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 19, 4, 38, 7, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 23, 4, 46, 7, -1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 20, 9, 47, 8, 2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 25, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 7, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 4, 36, 10, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 5, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 23, 3, 45, 5, 3, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 48, NULL, -8, 25, 0, NULL
  UNION ALL SELECT 'rush_sun_bright', 'rush_variant', 600, 32, 4, 51, 7, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_halo_flight', 'rush_variant', 900, 28, 3, 54, NULL, 0, 24, 0, NULL
  UNION ALL SELECT 'rush_glowing_touch_1hits', 'rush_variant', 700, 20, 3, 40, 8, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_luminous_uppercut_1hits', 'rush_variant', 800, 25, 5, 49, NULL, -4, 20, 0, NULL
) AS v
WHERE c.code = 'ingrid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_sun_bright' THEN 'sun_bright'
        WHEN 'rush_halo_flight' THEN 'halo_flight'
        WHEN 'rush_glowing_touch_1hits' THEN 'glowing_touch_1hits'
        WHEN 'rush_luminous_uppercut_1hits' THEN 'luminous_uppercut_1hits'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ingrid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_sun_bright', 'rush_halo_flight', 'rush_glowing_touch_1hits', 'rush_luminous_uppercut_1hits');

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
  UNION ALL SELECT 'sun_bright', 'サンブライト'
  UNION ALL SELECT 'halo_flight', 'ヘイローステップ'
  UNION ALL SELECT 'pretty_heel_kick', 'エアリートス'
  UNION ALL SELECT 'glowing_touch_1hits', 'グロータッチ(単発)'
  UNION ALL SELECT 'glowing_touch', 'グロータッチ'
  UNION ALL SELECT 'luminous_uppercut_1hits', 'ルミナスアッパー(単発)'
  UNION ALL SELECT 'luminous_uppercut', 'ルミナスアッパー'
  UNION ALL SELECT 'satelite_leap', 'サテライトリープ'
  UNION ALL SELECT 'sun_shot_light', '弱サンシュート'
  UNION ALL SELECT 'sun_shot_medium', '中サンシュート'
  UNION ALL SELECT 'sun_shot_heavy', '強サンシュート'
  UNION ALL SELECT 'sun_shot_holding_heavy', '強サンシュート(ホールド)'
  UNION ALL SELECT 'od_sun_shot_light', '弱ODサンシュート'
  UNION ALL SELECT 'od_sun_shot_medium', '中ODサンシュート'
  UNION ALL SELECT 'od_sun_shot_heavy', '強ODサンシュート'
  UNION ALL SELECT 'sun_flare_light', '弱サンフレア'
  UNION ALL SELECT 'sun_flare_lv1', 'サンフレア(Lv1)'
  UNION ALL SELECT 'sun_flare_lv2', 'サンフレア(Lv2)'
  UNION ALL SELECT 'sun_flare_lv3', 'サンフレア(Lv3)'
  UNION ALL SELECT 'sun_flare_lv1_od', 'ODサンフレア(Lv1)'
  UNION ALL SELECT 'sun_flare_lv2_od', 'ODサンフレア(Lv2)'
  UNION ALL SELECT 'sun_flare_lv3_od', 'ODサンフレア(Lv3)'
  UNION ALL SELECT 'solar_burst_lv1_neutral_od', 'ODソーラーフレア(Lv1)（垂直）'
  UNION ALL SELECT 'solar_burst_lv1_forward_od', 'ODソーラーフレア(Lv1)（前方）'
  UNION ALL SELECT 'solar_burst_lv2_neutral_od', 'ODソーラーフレア(Lv2)（垂直）'
  UNION ALL SELECT 'solar_burst_lv2_forward_od', 'ODソーラーフレア(Lv2)（前方）'
  UNION ALL SELECT 'solar_burst_lv3_neutral_od', 'ODソーラーフレア(Lv3)（垂直）'
  UNION ALL SELECT 'solar_burst_lv3_forward_od', 'ODソーラーフレア(Lv3)（前方）'
  UNION ALL SELECT 'solar_burst_light_neutral', '弱ソーラーフレア（垂直）'
  UNION ALL SELECT 'solar_burst_light_forward', '弱ソーラーフレア（前方）'
  UNION ALL SELECT 'solar_burst_lv1_neutral', 'ソーラーフレア(Lv1)（垂直）'
  UNION ALL SELECT 'solar_burst_lv1_forward', 'ソーラーフレア(Lv1)（前方）'
  UNION ALL SELECT 'solar_burst_lv2_neutral', 'ソーラーフレア(Lv2)（垂直）'
  UNION ALL SELECT 'solar_burst_lv2_forward', 'ソーラーフレア(Lv2)（前方）'
  UNION ALL SELECT 'solar_burst_lv3_neutral', 'ソーラーフレア(Lv3)（垂直）'
  UNION ALL SELECT 'solar_burst_lv3_forward', 'ソーラーフレア(Lv3)（前方）'
  UNION ALL SELECT 'sun_rise_light', '弱サンライズ'
  UNION ALL SELECT 'sun_rise_medium', '中サンライズ'
  UNION ALL SELECT 'sun_rise_heavy', '強サンライズ'
  UNION ALL SELECT 'sun_rise_od', 'ODサンライズ'
  UNION ALL SELECT 'sun_veil_od', 'ODサンヴェール'
  UNION ALL SELECT 'sun_veil', 'サンヴェール'
  UNION ALL SELECT 'vanishing_sun_backward', 'サンバニッシュ（後方）'
  UNION ALL SELECT 'vanishing_sun_upward', 'サンバニッシュ（上）'
  UNION ALL SELECT 'vanishing_sun_forward', 'サンバニッシュ（前方）'
  UNION ALL SELECT 'sa1_shining_sun_lv1', 'SA1 サンシャイン(Lv1)'
  UNION ALL SELECT 'sa1_shining_sun_lv2', 'SA1 サンシャイン(Lv2)'
  UNION ALL SELECT 'sa1_shining_sun_lv3', 'SA1 サンシャイン(Lv3)'
  UNION ALL SELECT 'sa2_order_of_the_sun_lv1', 'SA2 サンオーダー(Lv1)'
  UNION ALL SELECT 'sa2_order_of_the_sun_lv2', 'SA2 サンオーダー(Lv2)'
  UNION ALL SELECT 'sa2_order_of_the_sun_lv3', 'SA2 サンオーダー(Lv3)'
  UNION ALL SELECT 'sa3_cosmic_ray', 'SA3 コズミックレイ'
  UNION ALL SELECT 'ca_cosmic_ray', 'CA コズミックレイ'
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
  UNION ALL SELECT 'rush_sun_bright', 'サンブライト(ラッシュ)'
  UNION ALL SELECT 'rush_halo_flight', 'ヘイローステップ(ラッシュ)'
  UNION ALL SELECT 'rush_glowing_touch_1hits', 'グロータッチ(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_luminous_uppercut_1hits', 'ルミナスアッパー(単発)(ラッシュ)'
) AS v
WHERE c.code = 'ingrid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== kimberly (95 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 270 AS damage, 5 AS startup, 2 AS active, 14 AS total, 5 AS on_hit, -2 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 270, 5, 3, 18, 1, -3, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 540, 6, 3, 26, 3, -2, 18, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 540, 8, 3, 28, 1, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 630, 9, 3, 31, 3, -4, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 630, 12, 4, 32, 7, 2, 17, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 270, 4, 3, 13, 4, -1, 7, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 180, 5, 3, 14, 4, -2, 7, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 500, 6, 3, 23, 7, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 540, 7, 3, 25, 5, 1, 16, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 720, 8, 6, 30, 3, -2, 17, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 810, 8, 3, 34, NULL, -10, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 270, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 270, 5, 10, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 450, 6, 4, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 540, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 630, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 630, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 720, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1082, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1082, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'water_slicer_slide', 'unique', 450, 11, 10, 36, 1, -5, 16, 0, NULL
  UNION ALL SELECT 'windmill_kick', 'unique', 720, 22, 2, 42, 4, -3, 19, 0, NULL
  UNION ALL SELECT 'hisen_kick', 'unique', 720, 27, 3, 50, 1, -3, 21, 0, NULL
  UNION ALL SELECT 'step_up_backward', 'unique', 0, 30, 1, 33, -10, -22, 3, 1, NULL
  UNION ALL SELECT 'step_up_neutral', 'unique', 0, 30, 1, 33, -10, -22, 3, 1, NULL
  UNION ALL SELECT 'step_up_forward', 'unique', 0, 30, 1, 33, -10, -22, 3, 1, NULL
  UNION ALL SELECT 'elbow_drop', 'unique', 540, 27, 13, 47, 5, -2, 8, 1, NULL
  UNION ALL SELECT 'bushin_senpukyaku_light', 'special', 990, 6, 31, 59, NULL, -30, 23, 0, NULL
  UNION ALL SELECT 'bushin_senpukyaku_medium', 'special', 1080, 7, 31, 62, NULL, -32, 25, 0, NULL
  UNION ALL SELECT 'bushin_senpukyaku_heavy', 'special', 1170, 8, 31, 66, NULL, -35, 28, 0, NULL
  UNION ALL SELECT 'bushin_senpukyaku_od', 'special', 1410, 7, 29, 64, NULL, -40, 29, 0, NULL
  UNION ALL SELECT 'aerial_bushin_senpukyaku_od', 'special', 1350, 14, 20, 48, 5, 1, 15, 0, NULL
  UNION ALL SELECT 'aerial_bushin_senpukyaku', 'special', 900, 14, 20, 48, 5, 1, 15, 0, NULL
  UNION ALL SELECT 'sprint_od', 'special', 0, 1, 54, 54, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sprint', 'special', 0, 1, 55, 55, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'emergency_stop_od', 'special', 0, 19, 1, 19, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'emergency_stop', 'special', 0, 22, 1, 22, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'torso_cleaver_od', 'special', 1080, 25, 7, 47, NULL, 3, 16, 0, NULL
  UNION ALL SELECT 'torso_cleaver', 'special', 900, 29, 7, 51, NULL, 1, 16, 0, NULL
  UNION ALL SELECT 'shadow_slide_od', 'special', 900, 16, 12, 46, NULL, -10, 19, 0, NULL
  UNION ALL SELECT 'shadow_slide', 'special', 720, 18, 12, 48, NULL, -12, 19, 0, NULL
  UNION ALL SELECT 'neck_hunter_od', 'special', 1080, 23, 5, 46, NULL, -1, 19, 0, NULL
  UNION ALL SELECT 'neck_hunter', 'special', 900, 27, 5, 50, NULL, -3, 19, 0, NULL
  UNION ALL SELECT 'arc_step_od', 'special', 270, 19, 1, 44, 3, -6, 25, 0, NULL
  UNION ALL SELECT 'arc_step', 'special', 450, 21, 1, 46, 3, -6, 25, 0, NULL
  UNION ALL SELECT 'bushin_izuna_otoshi_od', 'special', 900, 13, 6, 58, NULL, NULL, 40, 0, NULL
  UNION ALL SELECT 'bushin_izuna_otoshi', 'special', 1440, 13, 6, 58, NULL, NULL, 40, 0, NULL
  UNION ALL SELECT 'bushin_hojin_kick_od', 'special', 630, 13, 6, 44, NULL, -8, 26, 0, NULL
  UNION ALL SELECT 'bushin_hojin_kick', 'special', 630, 13, 6, 44, NULL, -8, 26, 0, NULL
  UNION ALL SELECT 'vagabond_edge_light', 'special', 810, 10, 3, 33, 3, -4, 21, 0, NULL
  UNION ALL SELECT 'vagabond_edge_medium', 'special', 1080, 17, 2, 46, NULL, -12, 28, 0, NULL
  UNION ALL SELECT 'vagabond_edge_heavy', 'special', 540, 24, 2, 53, NULL, -12, 28, 0, NULL
  UNION ALL SELECT 'vagabond_edge_od', 'special', 540, 17, 2, 46, NULL, -12, 28, 0, NULL
  UNION ALL SELECT 'hidden_variable_od', 'special', 0, 19, 8, 45, NULL, NULL, 19, 0, NULL
  UNION ALL SELECT 'hidden_variable', 'special', 0, 19, 8, 43, NULL, NULL, 17, 0, NULL
  UNION ALL SELECT 'genius_at_play_od', 'special', 0, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'genius_at_play', 'special', 0, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_light', 'special', 450, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_medium', 'special', 450, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_heavy', 'special', 450, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_spread_light', 'special', 900, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_spread_medium', 'special', 900, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shuriken_bomb_spread_heavy', 'special', 900, 44, 1, 44, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'nue_twister_od', 'special', 900, 10, 3, 63, NULL, NULL, 51, 0, NULL
  UNION ALL SELECT 'nue_twister', 'special', 1440, 10, 3, 63, NULL, NULL, 51, 0, NULL
  UNION ALL SELECT 'sa1_bushin_beats', 'super_art', 1800, 10, 15, 64, NULL, -25, 40, 0, NULL
  UNION ALL SELECT 'sa1_bushin_thunderous_beats', 'super_art', 2200, 10, 15, 64, NULL, -25, 40, 0, NULL
  UNION ALL SELECT 'sa2_bushin_scramble', 'super_art', 2800, 13, 8, 59, NULL, -26, 39, 0, NULL
  UNION ALL SELECT 'sa2_soaring_bushin_scramble', 'super_art', 2800, 23, 10, 71, NULL, -26, 39, 0, '{"notes_tool":"ジャンプ9F 10F目からキャンセル可能 なぜかインゲームで出てくるフレームもおかしい（硬直39なのに、全体は70）"}'
  UNION ALL SELECT 'sa3_bushin_ninjastar_cypher', 'super_art', 4000, 8, 6, 64, NULL, -35, 51, 0, NULL
  UNION ALL SELECT 'ca_bushin_ninjastar_cypher', 'critical_art', 4500, 8, 6, 64, NULL, -35, 51, 0, NULL
  UNION ALL SELECT 'bushin_tiger_fangs', 'target_combo', 900, 10, 3, 38, NULL, -12, 26, 0, NULL
  UNION ALL SELECT 'bushin_prism_strikes_2hits', 'target_combo', 558, 6, 3, 26, 1, -6, 18, 0, NULL
  UNION ALL SELECT 'bushin_prism_strikes_3hits', 'target_combo', 866, 12, 2, 38, NULL, -10, 25, 0, NULL
  UNION ALL SELECT 'bushin_prism_strikes', 'target_combo', 1178, 26, 3, 47, NULL, -12, 19, 0, NULL
  UNION ALL SELECT 'bushin_hellchain_3hits', 'target_combo', 964, 10, 2, 36, 2, -10, 25, 0, NULL
  UNION ALL SELECT 'bushin_hellchain', 'target_combo', 1414, 15, 3, 41, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'bushin_hellchain_throw', 'target_combo', 1414, 15, 3, 40, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 270, 16, 2, 25, 9, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 270, 16, 3, 29, 5, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 540, 17, 3, 37, 7, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 540, 19, 3, 39, 5, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 630, 20, 3, 42, 7, 0, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 630, 23, 4, 43, 11, 6, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 270, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 180, 16, 3, 25, 8, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 500, 17, 3, 34, 11, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 540, 18, 3, 36, 9, 5, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 720, 19, 6, 41, 7, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 810, 19, 3, 45, NULL, -6, 24, 0, NULL
  UNION ALL SELECT 'rush_water_slicer_slide', 'rush_variant', 450, 22, 10, 47, 5, -1, 16, 0, NULL
  UNION ALL SELECT 'rush_windmill_kick', 'rush_variant', 720, 33, 2, 53, 8, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_hisen_kick', 'rush_variant', 720, 38, 3, 61, 5, 1, 21, 0, NULL
) AS v
WHERE c.code = 'kimberly' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_water_slicer_slide' THEN 'water_slicer_slide'
        WHEN 'rush_windmill_kick' THEN 'windmill_kick'
        WHEN 'rush_hisen_kick' THEN 'hisen_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'kimberly' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_water_slicer_slide', 'rush_windmill_kick', 'rush_hisen_kick');

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
  UNION ALL SELECT 'water_slicer_slide', '水切り蹴り'
  UNION ALL SELECT 'windmill_kick', '風車'
  UNION ALL SELECT 'hisen_kick', '飛箭蹴'
  UNION ALL SELECT 'step_up_backward', '矢来越え(後方)'
  UNION ALL SELECT 'step_up_neutral', '矢来越え(垂直)'
  UNION ALL SELECT 'step_up_forward', '矢来越え(前方)'
  UNION ALL SELECT 'elbow_drop', '肘落とし'
  UNION ALL SELECT 'bushin_senpukyaku_light', '弱武神旋風脚'
  UNION ALL SELECT 'bushin_senpukyaku_medium', '中武神旋風脚'
  UNION ALL SELECT 'bushin_senpukyaku_heavy', '強武神旋風脚'
  UNION ALL SELECT 'bushin_senpukyaku_od', 'OD武神旋風脚'
  UNION ALL SELECT 'aerial_bushin_senpukyaku_od', 'OD空中武神旋風脚'
  UNION ALL SELECT 'aerial_bushin_senpukyaku', '空中武神旋風脚'
  UNION ALL SELECT 'sprint_od', 'OD疾駆け'
  UNION ALL SELECT 'sprint', '疾駆け'
  UNION ALL SELECT 'emergency_stop_od', 'OD急停止'
  UNION ALL SELECT 'emergency_stop', '急停止'
  UNION ALL SELECT 'torso_cleaver_od', 'OD胴刎ね'
  UNION ALL SELECT 'torso_cleaver', '胴刎ね'
  UNION ALL SELECT 'shadow_slide_od', 'OD影すくい'
  UNION ALL SELECT 'shadow_slide', '影すくい'
  UNION ALL SELECT 'neck_hunter_od', 'OD首狩り'
  UNION ALL SELECT 'neck_hunter', '首狩り'
  UNION ALL SELECT 'arc_step_od', 'OD弧空'
  UNION ALL SELECT 'arc_step', '弧空'
  UNION ALL SELECT 'bushin_izuna_otoshi_od', 'OD武神イズナ落とし'
  UNION ALL SELECT 'bushin_izuna_otoshi', '武神イズナ落とし'
  UNION ALL SELECT 'bushin_hojin_kick_od', 'OD武神鉾刃脚'
  UNION ALL SELECT 'bushin_hojin_kick', '武神鉾刃脚'
  UNION ALL SELECT 'vagabond_edge_light', '弱流転一文字'
  UNION ALL SELECT 'vagabond_edge_medium', '中流転一文字'
  UNION ALL SELECT 'vagabond_edge_heavy', '強流転一文字'
  UNION ALL SELECT 'vagabond_edge_od', 'OD流転一文字'
  UNION ALL SELECT 'hidden_variable_od', 'OD彩隠形'
  UNION ALL SELECT 'hidden_variable', '彩隠形'
  UNION ALL SELECT 'genius_at_play_od', 'OD召雷細工'
  UNION ALL SELECT 'genius_at_play', '召雷細工'
  UNION ALL SELECT 'shuriken_bomb_light', '弱細工手裏剣'
  UNION ALL SELECT 'shuriken_bomb_medium', '中細工手裏剣'
  UNION ALL SELECT 'shuriken_bomb_heavy', '強細工手裏剣'
  UNION ALL SELECT 'shuriken_bomb_spread_light', '弱乱れ細工手裏剣'
  UNION ALL SELECT 'shuriken_bomb_spread_medium', '中乱れ細工手裏剣'
  UNION ALL SELECT 'shuriken_bomb_spread_heavy', '強乱れ細工手裏剣'
  UNION ALL SELECT 'nue_twister_od', 'OD荒鵺捻り'
  UNION ALL SELECT 'nue_twister', '荒鵺捻り'
  UNION ALL SELECT 'sa1_bushin_beats', 'SA1 武神乱拍子'
  UNION ALL SELECT 'sa1_bushin_thunderous_beats', 'SA1 武神乱拍子・雷譜'
  UNION ALL SELECT 'sa2_bushin_scramble', 'SA2 武神天翔亢竜'
  UNION ALL SELECT 'sa2_soaring_bushin_scramble', 'SA2 空中武神天翔亢竜'
  UNION ALL SELECT 'sa3_bushin_ninjastar_cypher', 'SA3 武神顕現神楽'
  UNION ALL SELECT 'ca_bushin_ninjastar_cypher', 'CA 武神顕現神楽'
  UNION ALL SELECT 'bushin_tiger_fangs', '武神虎連牙'
  UNION ALL SELECT 'bushin_prism_strikes_2hits', '武神天架拳(2発止め)'
  UNION ALL SELECT 'bushin_prism_strikes_3hits', '武神天架拳(3発止め)'
  UNION ALL SELECT 'bushin_prism_strikes', '武神天架拳'
  UNION ALL SELECT 'bushin_hellchain_3hits', '武神獄鎖拳(3発止め)'
  UNION ALL SELECT 'bushin_hellchain', '武神獄鎖拳'
  UNION ALL SELECT 'bushin_hellchain_throw', '武神獄鎖投げ'
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
  UNION ALL SELECT 'rush_water_slicer_slide', '水切り蹴り(ラッシュ)'
  UNION ALL SELECT 'rush_windmill_kick', '風車(ラッシュ)'
  UNION ALL SELECT 'rush_hisen_kick', '飛箭蹴(ラッシュ)'
) AS v
WHERE c.code = 'kimberly' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== juri (73 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 4 AS active, 14 AS total, 5 AS on_hit, -2 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 16, 2, -3, 9, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 4, 21, 7, 2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 5, 6, 27, 3, -4, 17, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 3, 36, -1, -5, 24, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 17, 4, 39, 2, -3, 19, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 4, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 15, 3, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 24, 5, -2, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, 1, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 8, 4, 34, 3, -11, 23, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 35, NULL, -11, 23, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 4, 6, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 500, 7, 5, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 6, 6, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 900, 12, 6, 46, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'normal', 800, 10, 4, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'air_throw', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'kyosesho', 'unique', 600, 8, 3, 27, 4, -3, 17, 0, NULL
  UNION ALL SELECT 'senkai_kick', 'unique', 600, 21, 2, 45, 2, -3, 23, 0, NULL
  UNION ALL SELECT 'renko_kicks', 'unique', 1000, 15, 11, 48, 2, -4, 23, 0, NULL
  UNION ALL SELECT 'korenzan', 'unique', 800, 10, 12, 40, 2, -6, 19, 0, NULL
  UNION ALL SELECT 'death_crest_2hits', 'unique', 1100, 12, 3, 34, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'fuhajin_light', 'special', 600, 10, 4, 34, NULL, -4, 21, 0, NULL
  UNION ALL SELECT 'fuhajin_medium', 'special', 600, 13, 4, 37, NULL, -6, 21, 0, NULL
  UNION ALL SELECT 'fuhajin_heavy', 'special', 500, 25, 5, 48, NULL, -8, 19, 0, NULL
  UNION ALL SELECT 'fuhajin_od', 'special', 600, 12, 6, 38, NULL, -12, 21, 0, NULL
  UNION ALL SELECT 'saihasho_od', 'special', 800, 11, 28, 38, NULL, -2, 0, 0, NULL
  UNION ALL SELECT 'saihasho', 'special', 400, 16, 10, 45, -2, -8, 20, 0, NULL
  UNION ALL SELECT 'fuha_saihasho', 'special', 600, 16, 30, 45, 1, -3, 0, 0, NULL
  UNION ALL SELECT 'ankensatsu_od', 'special', 800, 24, 4, 46, 9, -8, 19, 0, NULL
  UNION ALL SELECT 'ankensatsu', 'special', 600, 24, 4, 46, 5, -8, 19, 0, NULL
  UNION ALL SELECT 'fuha_ankensatsu', 'special', 600, 24, 4, 46, 8, -8, 19, 0, NULL
  UNION ALL SELECT 'go_ohsatsu_od', 'special', 1200, 18, 52, 97, NULL, -16, 28, 0, NULL
  UNION ALL SELECT 'go_ohsatsu', 'special', 1000, 18, 4, 48, NULL, -11, 27, 0, NULL
  UNION ALL SELECT 'fuha_go_ohsatsu', 'special', 1200, 18, 19, 63, NULL, -12, 27, 0, NULL
  UNION ALL SELECT 'tensenrin_light', 'special', 800, 11, 7, 39, NULL, -8, 22, 0, NULL
  UNION ALL SELECT 'tensenrin_medium', 'special', 1200, 5, 20, 62, NULL, -37, 38, 0, NULL
  UNION ALL SELECT 'tensenrin_heavy', 'special', 1200, 5, 20, 62, NULL, -37, 38, 0, NULL
  UNION ALL SELECT 'tensenrin_od', 'special', 1600, 6, 19, 75, NULL, -48, 51, 0, NULL
  UNION ALL SELECT 'shiku_sen_od', 'special', 300, 27, 6, 50, NULL, -7, 18, 0, NULL
  UNION ALL SELECT 'shiku_sen', 'special', 400, 29, 5, 51, NULL, -9, 18, 0, NULL
  UNION ALL SELECT 'shiren_sen_od', 'special', 900, 6, 33, 73, NULL, NULL, 35, 0, NULL
  UNION ALL SELECT 'shiren_sen', 'special', 1200, 6, 33, 75, NULL, NULL, 37, 0, NULL
  UNION ALL SELECT 'sa1_sakkai_fuhazan', 'super_art', 1800, 7, 137, 201, NULL, -32, 58, 0, NULL
  UNION ALL SELECT 'fuha_sa1_sakkai_fuhazan', 'super_art', 2100, 7, 138, 201, NULL, -32, 57, 0, NULL
  UNION ALL SELECT 'sa2_feng_shui_engine', 'super_art', 0, 7, 0, 7, NULL, NULL, 1, 0, NULL
  UNION ALL SELECT 'sa2_feng_shui_engine_dash', 'super_art', 300, 9, 11, 45, NULL, -17, 26, 0, NULL
  UNION ALL SELECT 'sa3_kaisen_dankai_raku', 'super_art', 4000, 10, 4, 65, NULL, -36, 52, 0, NULL
  UNION ALL SELECT 'ca_kaisen_dankai_raku', 'critical_art', 4500, 10, 4, 65, NULL, -36, 52, 0, NULL
  UNION ALL SELECT 'death_crest', 'target_combo', 1580, 17, 3, 46, NULL, -16, 27, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 4, 25, 9, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 27, 6, 1, 9, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 4, 32, 11, 6, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 16, 6, 38, 7, 0, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 3, 47, 3, -1, 24, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 28, 4, 50, 6, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 26, 7, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 35, 9, 2, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 5, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 19, 4, 45, 7, -7, 23, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 46, NULL, -7, 23, 0, NULL
  UNION ALL SELECT 'rush_kyosesho', 'rush_variant', 600, 19, 3, 38, 8, 1, 17, 0, NULL
  UNION ALL SELECT 'rush_senkai_kick', 'rush_variant', 600, 32, 2, 56, 6, 1, 23, 0, NULL
  UNION ALL SELECT 'rush_renko_kicks', 'rush_variant', 1000, 26, 11, 59, 6, 0, 23, 0, NULL
  UNION ALL SELECT 'rush_korenzan', 'rush_variant', 800, 21, 12, 51, 6, -2, 19, 0, NULL
) AS v
WHERE c.code = 'juri' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_kyosesho' THEN 'kyosesho'
        WHEN 'rush_senkai_kick' THEN 'senkai_kick'
        WHEN 'rush_renko_kicks' THEN 'renko_kicks'
        WHEN 'rush_korenzan' THEN 'korenzan'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'juri' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_kyosesho', 'rush_senkai_kick', 'rush_renko_kicks', 'rush_korenzan');

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
  UNION ALL SELECT 'neutral_jumping_heavy_kick', '垂直ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'air_throw', '空投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'kyosesho', '狂背掌'
  UNION ALL SELECT 'senkai_kick', '殲廻脚'
  UNION ALL SELECT 'renko_kicks', '連剋脚'
  UNION ALL SELECT 'korenzan', '鉤鎌斬'
  UNION ALL SELECT 'death_crest_2hits', '死紋蹴(2発止め)'
  UNION ALL SELECT 'fuhajin_light', '弱風破刃'
  UNION ALL SELECT 'fuhajin_medium', '中風破刃'
  UNION ALL SELECT 'fuhajin_heavy', '強風破刃'
  UNION ALL SELECT 'fuhajin_od', 'OD風破刃'
  UNION ALL SELECT 'saihasho_od', 'OD歳破衝'
  UNION ALL SELECT 'saihasho', '歳破衝'
  UNION ALL SELECT 'fuha_saihasho', '[風破]歳破衝'
  UNION ALL SELECT 'ankensatsu_od', 'OD暗剣殺'
  UNION ALL SELECT 'ankensatsu', '暗剣殺'
  UNION ALL SELECT 'fuha_ankensatsu', '[風破]暗剣殺'
  UNION ALL SELECT 'go_ohsatsu_od', 'OD五黄殺'
  UNION ALL SELECT 'go_ohsatsu', '五黄殺'
  UNION ALL SELECT 'fuha_go_ohsatsu', '[風破]五黄殺'
  UNION ALL SELECT 'tensenrin_light', '弱天穿輪'
  UNION ALL SELECT 'tensenrin_medium', '中天穿輪'
  UNION ALL SELECT 'tensenrin_heavy', '強天穿輪'
  UNION ALL SELECT 'tensenrin_od', 'OD天穿輪'
  UNION ALL SELECT 'shiku_sen_od', 'OD疾空閃'
  UNION ALL SELECT 'shiku_sen', '疾空閃'
  UNION ALL SELECT 'shiren_sen_od', 'OD死連閃'
  UNION ALL SELECT 'shiren_sen', '死連閃'
  UNION ALL SELECT 'sa1_sakkai_fuhazan', 'SA1 殺界風破斬'
  UNION ALL SELECT 'fuha_sa1_sakkai_fuhazan', '[風破]SA1 殺界風破斬'
  UNION ALL SELECT 'sa2_feng_shui_engine', 'SA2 風水エンジン'
  UNION ALL SELECT 'sa2_feng_shui_engine_dash', 'SA2 風水エンジン(突進版)'
  UNION ALL SELECT 'sa3_kaisen_dankai_raku', 'SA3 回旋断界落'
  UNION ALL SELECT 'ca_kaisen_dankai_raku', 'CA 回旋断界落'
  UNION ALL SELECT 'death_crest', '死紋蹴'
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
  UNION ALL SELECT 'rush_kyosesho', '狂背掌(ラッシュ)'
  UNION ALL SELECT 'rush_senkai_kick', '殲廻脚(ラッシュ)'
  UNION ALL SELECT 'rush_renko_kicks', '連剋脚(ラッシュ)'
  UNION ALL SELECT 'rush_korenzan', '鉤鎌斬(ラッシュ)'
) AS v
WHERE c.code = 'juri' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== ken (80 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 0, -2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 5, 4, 22, 4, -2, 14, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 8, 3, 30, 3, -5, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 5, 31, 3, -2, 17, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 12, 2, 38, 1, -5, 25, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 14, 5, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 17, 1, -3, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 700, 6, 3, 24, 3, 0, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 7, 3, 28, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 8, 4, 35, 3, -7, 24, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 8, 3, 34, NULL, -10, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 7, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 6, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 6, 4, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'normal', 900, 6, 6, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'quick_dash', 'unique', 0, 1, 45, 45, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'emergency_stop', 'unique', 0, 1, 27, 27, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'thunder_kick', 'unique', 1000, 29, 3, 51, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'forward_step_kick', 'unique', 800, 21, 4, 44, 3, -4, 20, 0, NULL
  UNION ALL SELECT 'hadoken_light', 'special', 600, 16, 34, 49, -1, -7, 0, 0, NULL
  UNION ALL SELECT 'hadoken_medium', 'special', 600, 14, 36, 49, -3, -9, 0, 0, NULL
  UNION ALL SELECT 'hadoken_heavy', 'special', 600, 12, 38, 49, -5, -11, 0, 0, NULL
  UNION ALL SELECT 'hadoken_od', 'special', 800, 12, 29, 40, 2, -2, 0, 0, NULL
  UNION ALL SELECT 'shoryuken_light', 'special', 1100, 5, 10, 47, NULL, -23, 33, 0, NULL
  UNION ALL SELECT 'shoryuken_medium', 'special', 1300, 6, 10, 55, NULL, -28, 40, 0, NULL
  UNION ALL SELECT 'shoryuken_heavy', 'special', 1400, 7, 10, 66, NULL, -36, 50, 0, NULL
  UNION ALL SELECT 'shoryuken_od', 'special', 1600, 6, 34, 89, NULL, -40, 50, 0, NULL
  UNION ALL SELECT 'quick_dash_shoryuken', 'special', 1700, 19, 11, 77, NULL, -35, 48, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', 'special', 700, 4, 11, 46, NULL, -14, 32, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', 'special', 900, 14, 17, 61, NULL, -12, 31, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', 'special', 1000, 16, 32, 78, NULL, -12, 31, 0, NULL
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_od', 'special', 1700, 9, 48, 90, NULL, -61, 34, 0, NULL
  UNION ALL SELECT 'quick_dash_tatsumaki_senpu_kyaku', 'special', 1200, 23, 46, 88, 3, -9, 20, 0, NULL
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku', 'special', 900, 16, 17, 90, NULL, NULL, 58, 0, NULL
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku_od', 'special', 1800, 16, 18, 64, NULL, NULL, 31, 0, NULL
  UNION ALL SELECT 'dragonlash_kick_light', 'special', 1000, 18, 6, 44, 2, -4, 21, 0, NULL
  UNION ALL SELECT 'dragonlash_kick_medium', 'special', 1100, 23, 5, 52, 3, -8, 25, 0, NULL
  UNION ALL SELECT 'dragonlash_kick_heavy', 'special', 1200, 28, 5, 53, 3, 1, 21, 0, NULL
  UNION ALL SELECT 'dragonlash_kick_od', 'special', 700, 9, 15, 47, 1, -9, 24, 0, NULL
  UNION ALL SELECT 'quick_dash_dragonlash_kick', 'special', 700, 20, 15, 58, 2, -8, 24, 0, NULL
  UNION ALL SELECT 'jinrai_kick_light', 'special', 500, 12, 3, 42, 1, -11, 28, 0, NULL
  UNION ALL SELECT 'jinrai_kick_medium', 'special', 600, 16, 3, 42, 2, -7, 24, 0, NULL
  UNION ALL SELECT 'jinrai_kick_heavy', 'special', 700, 25, 3, 46, NULL, -2, 19, 0, NULL
  UNION ALL SELECT 'jinrai_kick_od', 'special', 600, 13, 3, 40, -4, -7, 25, 0, NULL
  UNION ALL SELECT 'kazekama_shin_kick_od', 'special', 500, 26, 3, 48, 3, -5, 20, 0, NULL
  UNION ALL SELECT 'kazekama_shin_kick', 'special', 600, 6, 4, 28, 3, -5, 19, 0, NULL
  UNION ALL SELECT 'gorai_axe_kick_od', 'special', 1000, 37, 3, 63, -3, -7, 24, 0, NULL
  UNION ALL SELECT 'gorai_axe_kick', 'special', 1000, 18, 3, 40, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'senka_snap_kick_od', 'special', 800, 28, 6, 51, NULL, -4, 18, 0, NULL
  UNION ALL SELECT 'senka_snap_kick', 'special', 800, 10, 3, 37, NULL, -3, 25, 0, NULL
  UNION ALL SELECT 'kasai_thrust_kick', 'special', 500, 45, 3, 76, NULL, -12, 29, 0, NULL
  UNION ALL SELECT 'kasai_thrust_kick_during_od_gorai_axe_kick', 'special', 500, 54, 3, 85, NULL, -12, 29, 0, NULL
  UNION ALL SELECT 'kasai_thrust_kick_during_od_senka_snap_kick', 'special', 500, 54, 3, 93, NULL, -20, 37, 0, NULL
  UNION ALL SELECT 'sa1_dragonlash_flame', 'super_art', 2000, 7, 3, 50, NULL, -24, 41, 0, NULL
  UNION ALL SELECT 'sa2_shippu_jinrai_kyaku', 'super_art', 2800, 6, 56, 89, NULL, -5, 28, 0, NULL
  UNION ALL SELECT 'sa3_shinryu_reppa', 'super_art', 4000, 7, 39, 100, NULL, -40, 55, 0, NULL
  UNION ALL SELECT 'ca_shinryu_reppa', 'critical_art', 4500, 7, 39, 100, NULL, -40, 55, 0, NULL
  UNION ALL SELECT 'chin_buster', 'target_combo', 1000, 11, 3, 40, NULL, -14, 27, 0, NULL
  UNION ALL SELECT 'triple_flash_kicks_2hits', 'target_combo', 1000, 11, 2, 39, NULL, -12, 27, 0, NULL
  UNION ALL SELECT 'triple_flash_kicks', 'target_combo', 1560, 13, 3, 43, NULL, -11, 28, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 4, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 16, 4, 33, 8, 2, 14, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 19, 3, 41, 7, -2, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 5, 42, 7, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 23, 2, 49, 5, -1, 25, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 25, 9, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 28, 5, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 700, 17, 3, 35, 7, 4, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 18, 3, 39, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 19, 4, 46, 7, -3, 24, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 19, 3, 45, NULL, -6, 24, 0, NULL
) AS v
WHERE c.code = 'ken' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ken' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick');

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
  UNION ALL SELECT 'neutral_jumping_heavy_kick', '垂直ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'quick_dash', '奮迅脚'
  UNION ALL SELECT 'emergency_stop', '急停止'
  UNION ALL SELECT 'thunder_kick', '紫電カカト落とし'
  UNION ALL SELECT 'forward_step_kick', '踏み込み前蹴り'
  UNION ALL SELECT 'hadoken_light', '弱波動拳'
  UNION ALL SELECT 'hadoken_medium', '中波動拳'
  UNION ALL SELECT 'hadoken_heavy', '強波動拳'
  UNION ALL SELECT 'hadoken_od', 'OD波動拳'
  UNION ALL SELECT 'shoryuken_light', '弱昇龍拳'
  UNION ALL SELECT 'shoryuken_medium', '中昇龍拳'
  UNION ALL SELECT 'shoryuken_heavy', '強昇龍拳'
  UNION ALL SELECT 'shoryuken_od', 'OD昇龍拳'
  UNION ALL SELECT 'quick_dash_shoryuken', '[奮迅脚]昇龍拳'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_light', '弱竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_medium', '中竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_heavy', '強竜巻旋風脚'
  UNION ALL SELECT 'tatsumaki_senpu_kyaku_od', 'OD竜巻旋風脚'
  UNION ALL SELECT 'quick_dash_tatsumaki_senpu_kyaku', '[奮迅脚]竜巻旋風脚'
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku', '空中竜巻旋風脚'
  UNION ALL SELECT 'aerial_tatsumaki_senpu_kyaku_od', 'OD空中竜巻旋風脚'
  UNION ALL SELECT 'dragonlash_kick_light', '弱龍尾脚'
  UNION ALL SELECT 'dragonlash_kick_medium', '中龍尾脚'
  UNION ALL SELECT 'dragonlash_kick_heavy', '強龍尾脚'
  UNION ALL SELECT 'dragonlash_kick_od', 'OD龍尾脚'
  UNION ALL SELECT 'quick_dash_dragonlash_kick', '[奮迅脚]龍尾脚'
  UNION ALL SELECT 'jinrai_kick_light', '弱迅雷脚'
  UNION ALL SELECT 'jinrai_kick_medium', '中迅雷脚'
  UNION ALL SELECT 'jinrai_kick_heavy', '強迅雷脚'
  UNION ALL SELECT 'jinrai_kick_od', 'OD迅雷脚'
  UNION ALL SELECT 'kazekama_shin_kick_od', 'OD風鎌蹴り'
  UNION ALL SELECT 'kazekama_shin_kick', '風鎌蹴り'
  UNION ALL SELECT 'gorai_axe_kick_od', 'OD轟雷落とし'
  UNION ALL SELECT 'gorai_axe_kick', '轟雷落とし'
  UNION ALL SELECT 'senka_snap_kick_od', 'OD閃火脚'
  UNION ALL SELECT 'senka_snap_kick', '閃火脚'
  UNION ALL SELECT 'kasai_thrust_kick', '火砕蹴(OD風鎌蹴り派生)'
  UNION ALL SELECT 'kasai_thrust_kick_during_od_gorai_axe_kick', '火砕蹴(OD轟雷落とし派生)'
  UNION ALL SELECT 'kasai_thrust_kick_during_od_senka_snap_kick', '火砕蹴(OD閃火脚派生)'
  UNION ALL SELECT 'sa1_dragonlash_flame', 'SA1 龍尾烈脚'
  UNION ALL SELECT 'sa2_shippu_jinrai_kyaku', 'SA2  疾風迅雷脚'
  UNION ALL SELECT 'sa3_shinryu_reppa', 'SA3 神龍烈破'
  UNION ALL SELECT 'ca_shinryu_reppa', 'CA 神龍烈破'
  UNION ALL SELECT 'chin_buster', '顎撥二連'
  UNION ALL SELECT 'triple_flash_kicks_2hits', '閃光連脚(2発止め)'
  UNION ALL SELECT 'triple_flash_kicks', '閃光連脚'
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
) AS v
WHERE c.code = 'ken' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== mai (96 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 5 AS on_hit, -2 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 3, 14, 1, -1, 8, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 8, 4, 26, 2, -3, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 9, 3, 29, 5, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 3, 32, 1, -3, 21, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 14, 3, 38, 3, -3, 22, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 13, 4, -1, 7, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 15, 2, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 26, 5, -3, 17, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 7, 3, 28, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 10, 13, 41, 4, -3, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 3, 36, NULL, -11, 25, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 9, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 7, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 7, 5, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 5, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 5, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'air_throw', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'senkotsu_uchi', 'unique', 600, 20, 3, 40, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'hien_ren_kyaku_2hits', 'target_combo', 620, 7, 2, 28, -2, -10, 20, 0, NULL
  UNION ALL SELECT 'hien_ren_kyaku', 'target_combo', 970, 10, 2, 39, 3, -10, 28, 0, NULL
  UNION ALL SELECT 'hoshi_kujaku_1hits', 'unique', 800, 8, 5, 32, 3, -1, 20, 0, NULL
  UNION ALL SELECT 'hoshi_kujaku', 'target_combo', 2000, 9, 50, 58, NULL, -11, 0, 0, NULL
  UNION ALL SELECT 'kachousen_light', 'special', 500, 16, 33, 48, -1, -7, 0, 0, NULL
  UNION ALL SELECT 'kachousen_holding_light', 'special', 700, 32, 33, 64, -1, -5, 0, 0, NULL
  UNION ALL SELECT 'flame_light_kachousen', 'special', 600, 16, 30, 45, 1, -3, 0, 0, NULL
  UNION ALL SELECT 'flame_light_kachousen_holding', 'special', 800, 32, 31, 62, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'kachousen_medium', 'special', 500, 14, 35, 48, -3, -9, 0, 0, NULL
  UNION ALL SELECT 'kachousen_holding_medium', 'special', 700, 32, 33, 64, -1, -5, 0, 0, NULL
  UNION ALL SELECT 'flame_medium_kachousen', 'special', 600, 14, 32, 45, -1, -5, 0, 0, NULL
  UNION ALL SELECT 'flame_medium_kachousen_holding', 'special', 800, 32, 31, 62, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'kachousen_heavy', 'special', 500, 12, 37, 48, -5, -11, 0, 0, NULL
  UNION ALL SELECT 'kachousen_holding_heavy', 'special', 700, 32, 33, 64, -1, -5, 0, 0, NULL
  UNION ALL SELECT 'flame_heavy_kachousen', 'special', 600, 12, 34, 45, -3, -7, 0, 0, NULL
  UNION ALL SELECT 'flame_heavy_kachousen_holding', 'special', 800, 32, 31, 62, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'kachousen_od', 'special', 700, 12, 31, 42, 3, -5, 0, 0, NULL
  UNION ALL SELECT 'kachousen_holding_od', 'special', 600, 28, 31, 58, 14, 12, 0, 0, NULL
  UNION ALL SELECT 'flame_od_kachousen', 'special', 800, 12, 31, 42, 3, 1, 0, 0, NULL
  UNION ALL SELECT 'flame_od_kachousen_holding', 'special', 700, 28, 31, 58, 45, 46, 0, 0, NULL
  UNION ALL SELECT 'midare_kachousen', 'special', 1200, 28, 30, 96, NULL, 0, 39, 0, NULL
  UNION ALL SELECT 'flame_midare_kachousen', 'special', 1400, 28, 30, 96, NULL, 33, 39, 0, NULL
  UNION ALL SELECT 'ryuuenbu_light', 'special', 800, 14, 7, 35, 3, -4, 15, 0, NULL
  UNION ALL SELECT 'flame_light_ryuuenbu', 'special', 900, 14, 7, 35, NULL, -2, 15, 0, NULL
  UNION ALL SELECT 'ryuuenbu_medium', 'special', 1000, 14, 18, 47, NULL, -6, 16, 0, NULL
  UNION ALL SELECT 'flame_medium_ryuuenbu', 'special', 1100, 14, 18, 47, NULL, -6, 16, 0, NULL
  UNION ALL SELECT 'ryuuenbu_heavy', 'special', 800, 15, 22, 48, NULL, -6, 12, 0, NULL
  UNION ALL SELECT 'flame_heavy_ryuuenbu', 'special', 900, 14, 23, 48, NULL, -6, 12, 0, NULL
  UNION ALL SELECT 'ryuuenbu_od', 'special', 1000, 16, 31, 62, NULL, -12, 16, 0, NULL
  UNION ALL SELECT 'flame_od_ryuuenbu', 'special', 1100, 16, 31, 62, NULL, -12, 16, 0, NULL
  UNION ALL SELECT 'hissatsu_shinobi_bachi_light', 'special', 800, 10, 30, 55, NULL, -10, 16, 0, NULL
  UNION ALL SELECT 'flame_light_hissatsu_shinobi_bachi', 'special', 900, 10, 30, 55, NULL, -10, 16, 0, NULL
  UNION ALL SELECT 'hissatsu_shinobi_bachi_medium', 'special', 900, 15, 30, 64, NULL, -12, 20, 0, NULL
  UNION ALL SELECT 'flame_medium_hissatsu_shinobi_bachi', 'special', 1000, 15, 30, 64, NULL, -12, 20, 0, NULL
  UNION ALL SELECT 'hissatsu_shinobi_bachi_heavy', 'special', 1000, 18, 30, 68, NULL, -13, 21, 0, NULL
  UNION ALL SELECT 'flame_heavy_hissatsu_shinobi_bachi', 'special', 1100, 18, 30, 68, NULL, -13, 21, 0, NULL
  UNION ALL SELECT 'hissatsu_shinobi_bachi_od', 'special', 800, 14, 32, 77, NULL, -12, 32, 0, NULL
  UNION ALL SELECT 'flame_od_hissatsu_shinobi_bachi', 'special', 900, 14, 32, 77, NULL, -12, 32, 0, NULL
  UNION ALL SELECT 'hishou_ryuuenjin_light', 'special', 900, 5, 18, 52, NULL, -29, 30, 0, NULL
  UNION ALL SELECT 'flame_light_hishou_ryuuenjin', 'special', 1000, 5, 18, 52, NULL, -29, 30, 0, NULL
  UNION ALL SELECT 'hishou_ryuuenjin_medium', 'special', 1100, 6, 18, 52, NULL, -28, 29, 0, NULL
  UNION ALL SELECT 'flame_medium_hishou_ryuuenjin', 'special', 1200, 6, 19, 52, NULL, -28, 28, 0, NULL
  UNION ALL SELECT 'hishou_ryuuenjin_heavy', 'special', 1200, 7, 18, 53, NULL, -31, 29, 0, NULL
  UNION ALL SELECT 'flame_heavy_hishou_ryuuenjin', 'special', 1300, 7, 18, 53, NULL, -31, 29, 0, NULL
  UNION ALL SELECT 'hishou_ryuuenjin_od', 'special', 1600, 6, 17, 57, NULL, -40, 35, 0, NULL
  UNION ALL SELECT 'flame_od_hishou_ryuuenjin', 'special', 1700, 6, 18, 57, NULL, -40, 34, 0, NULL
  UNION ALL SELECT 'musasabi_no_mai_od', 'special', 1200, 32, 6, 62, NULL, -6, 25, 0, '{"notes_tool":"立相手、画面端、最低空で計測。ガードフレーム公式と違う"}'
  UNION ALL SELECT 'musasabi_no_mai', 'special', 1000, 32, 6, 62, NULL, -6, 25, 0, '{"notes_tool":"立相手、画面端、最低空で計測。ガードフレーム公式と違う"}'
  UNION ALL SELECT 'flame_od_musasabi_no_mai', 'special', 1300, 32, 6, 62, NULL, -3, 25, 0, '{"notes_tool":"立相手、画面端、最低空で計測。ガードフレーム公式と違う"}'
  UNION ALL SELECT 'flame_musasabi_no_mai', 'special', 1100, 32, 6, 62, NULL, -3, 25, 0, '{"notes_tool":"立相手、画面端、最低空で計測。ガードフレーム公式と違う"}'
  UNION ALL SELECT 'sa1_kagerou_no_mai', 'super_art', 2000, 6, 34, 90, NULL, -31, 51, 0, NULL
  UNION ALL SELECT 'flame_sa1_kagerou_no_mai', 'super_art', 2300, 6, 90, 141, NULL, -26, 46, 0, NULL
  UNION ALL SELECT 'sa2_chou_hissatsu_shinobi_bachi', 'super_art', 2800, 7, 36, 68, NULL, -24, 26, 0, NULL
  UNION ALL SELECT 'flame_sa2_chou_hissatsu_shinobi_bachi', 'super_art', 3000, 7, 36, 73, NULL, -24, 31, 0, NULL
  UNION ALL SELECT 'sa2_air_chou_hissatsu_shinobi_bachi', 'super_art', 2800, 12, 20, 97, NULL, -53, 66, 0, NULL
  UNION ALL SELECT 'flame_sa2_air_chou_hissatsu_shinobi_bachi', 'super_art', 3000, 12, 24, 97, NULL, -48, 62, 0, NULL
  UNION ALL SELECT 'sa3_shiranui_ryuu_enbu_ada_zakura', 'super_art', 4000, 10, 39, 94, NULL, -33, 46, 0, NULL
  UNION ALL SELECT 'ca_shiranui_ryuu_enbu_ada_zakura', 'critical_art', 4500, 10, 39, 94, NULL, -33, 46, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 9, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 3, 25, 5, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 19, 4, 37, 6, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 20, 3, 40, 9, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 3, 43, 5, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 25, 3, 49, 7, 1, 22, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 26, 6, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 37, 9, 1, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 18, 3, 39, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 21, 13, 52, 8, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 3, 47, NULL, -7, 25, 0, NULL
  UNION ALL SELECT 'rush_senkotsu_uchi', 'rush_variant', 600, 31, 3, 51, 6, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_hoshi_kujaku_1hits', 'rush_variant', 800, 19, 5, 43, 7, 3, 20, 0, NULL
) AS v
WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_senkotsu_uchi' THEN 'senkotsu_uchi'
        WHEN 'rush_hoshi_kujaku_1hits' THEN 'hoshi_kujaku_1hits'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_senkotsu_uchi', 'rush_hoshi_kujaku_1hits');

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
  UNION ALL SELECT 'air_throw', '空投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'senkotsu_uchi', '扇骨打ち'
  UNION ALL SELECT 'hien_ren_kyaku_2hits', '飛燕連脚(2発止め)'
  UNION ALL SELECT 'hien_ren_kyaku', '飛燕連脚'
  UNION ALL SELECT 'hoshi_kujaku_1hits', '星孔雀(単発)'
  UNION ALL SELECT 'hoshi_kujaku', '星孔雀'
  UNION ALL SELECT 'kachousen_light', '弱花蝶扇'
  UNION ALL SELECT 'kachousen_holding_light', '弱花蝶扇（ホールド）'
  UNION ALL SELECT 'flame_light_kachousen', '[焔版]弱花蝶扇'
  UNION ALL SELECT 'flame_light_kachousen_holding', '[焔版]弱花蝶扇（ホールド）'
  UNION ALL SELECT 'kachousen_medium', '中花蝶扇'
  UNION ALL SELECT 'kachousen_holding_medium', '中花蝶扇（ホールド）'
  UNION ALL SELECT 'flame_medium_kachousen', '[焔版]中花蝶扇'
  UNION ALL SELECT 'flame_medium_kachousen_holding', '[焔版]中花蝶扇（ホールド）'
  UNION ALL SELECT 'kachousen_heavy', '強花蝶扇'
  UNION ALL SELECT 'kachousen_holding_heavy', '強花蝶扇（ホールド）'
  UNION ALL SELECT 'flame_heavy_kachousen', '[焔版]強花蝶扇'
  UNION ALL SELECT 'flame_heavy_kachousen_holding', '[焔版]強花蝶扇（ホールド）'
  UNION ALL SELECT 'kachousen_od', 'OD花蝶扇'
  UNION ALL SELECT 'kachousen_holding_od', 'OD花蝶扇（ホールド）'
  UNION ALL SELECT 'flame_od_kachousen', '[焔版]OD花蝶扇'
  UNION ALL SELECT 'flame_od_kachousen_holding', '[焔版]OD花蝶扇（ホールド）'
  UNION ALL SELECT 'midare_kachousen', '乱れ花蝶扇'
  UNION ALL SELECT 'flame_midare_kachousen', '[焔版]乱れ花蝶扇'
  UNION ALL SELECT 'ryuuenbu_light', '弱龍炎舞'
  UNION ALL SELECT 'flame_light_ryuuenbu', '[焔版]弱龍炎舞'
  UNION ALL SELECT 'ryuuenbu_medium', '中龍炎舞'
  UNION ALL SELECT 'flame_medium_ryuuenbu', '[焔版]中龍炎舞'
  UNION ALL SELECT 'ryuuenbu_heavy', '強龍炎舞'
  UNION ALL SELECT 'flame_heavy_ryuuenbu', '[焔版]強龍炎舞'
  UNION ALL SELECT 'ryuuenbu_od', 'OD龍炎舞'
  UNION ALL SELECT 'flame_od_ryuuenbu', '[焔版]OD龍炎舞'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_light', '弱必殺忍蜂'
  UNION ALL SELECT 'flame_light_hissatsu_shinobi_bachi', '[焔版]弱必殺忍蜂'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_medium', '中必殺忍蜂'
  UNION ALL SELECT 'flame_medium_hissatsu_shinobi_bachi', '[焔版]中必殺忍蜂'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_heavy', '強必殺忍蜂'
  UNION ALL SELECT 'flame_heavy_hissatsu_shinobi_bachi', '[焔版]強必殺忍蜂'
  UNION ALL SELECT 'hissatsu_shinobi_bachi_od', 'OD必殺忍蜂'
  UNION ALL SELECT 'flame_od_hissatsu_shinobi_bachi', '[焔版]OD必殺忍蜂'
  UNION ALL SELECT 'hishou_ryuuenjin_light', '弱飛翔龍炎陣'
  UNION ALL SELECT 'flame_light_hishou_ryuuenjin', '[焔版]弱飛翔龍炎陣'
  UNION ALL SELECT 'hishou_ryuuenjin_medium', '中飛翔龍炎陣'
  UNION ALL SELECT 'flame_medium_hishou_ryuuenjin', '[焔版]中飛翔龍炎陣'
  UNION ALL SELECT 'hishou_ryuuenjin_heavy', '強飛翔龍炎陣'
  UNION ALL SELECT 'flame_heavy_hishou_ryuuenjin', '[焔版]強飛翔龍炎陣'
  UNION ALL SELECT 'hishou_ryuuenjin_od', 'OD飛翔龍炎陣'
  UNION ALL SELECT 'flame_od_hishou_ryuuenjin', '[焔版]OD飛翔龍炎陣'
  UNION ALL SELECT 'musasabi_no_mai_od', 'ODムササビの舞'
  UNION ALL SELECT 'musasabi_no_mai', 'ムササビの舞'
  UNION ALL SELECT 'flame_od_musasabi_no_mai', '[焔版]ODムササビの舞'
  UNION ALL SELECT 'flame_musasabi_no_mai', '[焔版]ムササビの舞'
  UNION ALL SELECT 'sa1_kagerou_no_mai', 'SA1 陽炎の舞'
  UNION ALL SELECT 'flame_sa1_kagerou_no_mai', '[焔版]SA1 陽炎の舞'
  UNION ALL SELECT 'sa2_chou_hissatsu_shinobi_bachi', 'SA2 超必殺忍蜂'
  UNION ALL SELECT 'flame_sa2_chou_hissatsu_shinobi_bachi', '[焔版]SA2 超必殺忍蜂'
  UNION ALL SELECT 'sa2_air_chou_hissatsu_shinobi_bachi', 'SA2 空中超必殺忍蜂'
  UNION ALL SELECT 'flame_sa2_air_chou_hissatsu_shinobi_bachi', '[焔版]SA2 空中超必殺忍蜂'
  UNION ALL SELECT 'sa3_shiranui_ryuu_enbu_ada_zakura', 'SA3 不知火流・炎舞仇桜'
  UNION ALL SELECT 'ca_shiranui_ryuu_enbu_ada_zakura', 'CA 不知火流・炎舞仇桜'
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
  UNION ALL SELECT 'rush_senkotsu_uchi', '扇骨打ち(ラッシュ)'
  UNION ALL SELECT 'rush_hoshi_kujaku_1hits', '星孔雀(単発)(ラッシュ)'
) AS v
WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== zangief (78 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 400 AS damage, 7 AS startup, 3 AS active, 18 AS total, 4 AS on_hit, 2 AS on_block, 9 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 400, 7, 2, 25, -2, -4, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 9, 4, 29, 2, -2, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 900, 10, 4, 32, 1, -4, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 1000, 16, 3, 42, 3, -3, 24, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch_holding', 'normal', 1400, 32, 3, 58, NULL, 3, 24, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 1000, 13, 4, 37, 3, 1, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 6, 2, 15, 6, 1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 250, 4, 3, 18, 0, -3, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 700, 8, 3, 26, 3, -1, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 700, 9, 3, 29, 3, -2, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 1000, 11, 9, 54, NULL, -20, 35, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 1000, 12, 3, 41, NULL, -13, 27, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 7, 47, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 10, 47, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 5, 47, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 8, 8, 47, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 47, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 47, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick_holding', 'normal', 1500, 32, 6, 64, NULL, NULL, 27, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1400, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'german_suplex', 'throw', 1500, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'spinebuster', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'russian_drop', 'throw', 1500, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'brain_buster', 'throw', 1500, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'hellstab', 'unique', 800, 7, 3, 30, -1, -3, 21, 0, NULL
  UNION ALL SELECT 'knee_hammer', 'unique', 700, 14, 7, 33, 1, -4, 13, 0, NULL
  UNION ALL SELECT 'headbutt', 'unique', 1000, 14, 5, 35, 8, 4, 17, 0, NULL
  UNION ALL SELECT 'cyclone_wheel_kick', 'unique', 1300, 22, 7, 53, NULL, -9, 25, 0, NULL
  UNION ALL SELECT 'smetana_dropkick', 'unique', 1000, 16, 4, 59, NULL, -18, 40, 0, NULL
  UNION ALL SELECT 'flying_body_press', 'unique', 800, 9, 9, 52, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'flying_headbutt', 'unique', 900, 8, 4, 47, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'double_lariat_od', 'special', 1700, 12, 25, 62, NULL, -11, 26, 0, NULL
  UNION ALL SELECT 'double_lariat', 'special', 1400, 15, 31, 72, NULL, -12, 27, 0, NULL
  UNION ALL SELECT 'screw_piledriver_light', 'special', 2500, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'screw_piledriver_medium', 'special', 2900, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'screw_piledriver_heavy', 'special', 3300, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'screw_piledriver_od', 'special', 3400, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'borscht_dynamite', 'special', 2900, 10, 3, 49, NULL, NULL, 37, 0, NULL
  UNION ALL SELECT 'borscht_dynamite_od', 'special', 3000, 10, 3, 49, NULL, NULL, 37, 0, NULL
  UNION ALL SELECT 'russian_suplex', 'special', 2900, 10, 2, 61, NULL, NULL, 50, 0, NULL
  UNION ALL SELECT 'russian_suplex_od', 'special', 3200, 10, 2, 61, NULL, NULL, 50, 0, NULL
  UNION ALL SELECT 'siberian_express', 'special', 2700, 28, 2, 70, NULL, NULL, 41, 0, NULL
  UNION ALL SELECT 'siberian_express_od', 'special', 3000, 23, 2, 68, NULL, NULL, 44, 0, NULL
  UNION ALL SELECT 'tundra_storm', 'special', 2400, 6, 50, 79, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'sa1_aerial_russian_slam', 'super_art', 3500, 11, 7, 77, NULL, NULL, 60, 0, NULL
  UNION ALL SELECT 'sa2_cyclone_lariat_forward', 'super_art', 3060, 18, 102, 171, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'sa2_cyclone_lariat_back', 'super_art', 3160, 18, 102, 171, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'sa2_cyclone_lariat_holding', 'super_art', 1100, 18, 102, 171, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'sa3_bolshoi_storm_buster', 'super_art', 4800, 6, 2, 123, NULL, NULL, 116, 0, NULL
  UNION ALL SELECT 'ca_bolshoi_storm_buster', 'critical_art', 5300, 6, 2, 123, NULL, NULL, 116, 0, NULL
  UNION ALL SELECT 'machine_gun_chops_2hits', 'target_combo', 600, 9, 4, 32, 2, -6, 20, 0, '{"notes":"通常繋がらないので単発ダメージ記載"}'
  UNION ALL SELECT 'machine_gun_chops', 'target_combo', 1500, 9, 51, 91, NULL, -17, 32, 0, NULL
  UNION ALL SELECT 'power_stomps_1hits', 'unique', 500, 9, 3, 28, 4, -3, 17, 0, NULL
  UNION ALL SELECT 'power_stomps_2hits', 'target_combo', 1000, 9, 21, 48, -3, -4, 19, 0, NULL
  UNION ALL SELECT 'power_stomps', 'target_combo', 700, 10, 40, 72, -2, -10, 23, 0, '{"notes":"通常繋がらないので単発ダメージ記載"}'
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 400, 18, 3, 29, 8, 6, 9, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 400, 18, 2, 36, 2, 0, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 20, 4, 40, 6, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 900, 21, 4, 43, 5, 0, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 1000, 27, 3, 53, 7, 1, 24, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', 'rush_variant', 1400, 43, 3, 69, NULL, 7, 24, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 1000, 24, 4, 48, 7, 5, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 17, 2, 26, 10, 5, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 250, 15, 3, 29, 4, 1, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 700, 19, 3, 37, 7, 3, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 700, 20, 3, 40, 7, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 1000, 22, 9, 65, NULL, -16, 35, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 1000, 23, 3, 52, NULL, -9, 27, 0, NULL
  UNION ALL SELECT 'rush_hellstab', 'rush_variant', 800, 18, 3, 41, 3, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_knee_hammer', 'rush_variant', 700, 25, 7, 44, 5, 0, 13, 0, NULL
  UNION ALL SELECT 'rush_headbutt', 'rush_variant', 1000, 25, 5, 46, 12, 8, 17, 0, NULL
  UNION ALL SELECT 'rush_cyclone_wheel_kick', 'rush_variant', 1300, 33, 7, 64, NULL, -5, 25, 0, NULL
  UNION ALL SELECT 'rush_smetana_dropkick', 'rush_variant', 1000, 27, 4, 70, NULL, -14, 40, 0, NULL
  UNION ALL SELECT 'rush_power_stomps_1hits', 'rush_variant', 500, 20, 3, 39, 8, 1, 17, 0, NULL
) AS v
WHERE c.code = 'zangief' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

-- rush_variant の original_move_id を元技 code から解決
UPDATE moves SET original_move_id = (
    SELECT b.id FROM moves b WHERE b.character_id = moves.character_id AND b.code = CASE moves.code
        WHEN 'rush_standing_light_punch' THEN 'standing_light_punch'
        WHEN 'rush_standing_light_kick' THEN 'standing_light_kick'
        WHEN 'rush_standing_medium_punch' THEN 'standing_medium_punch'
        WHEN 'rush_standing_medium_kick' THEN 'standing_medium_kick'
        WHEN 'rush_standing_heavy_punch' THEN 'standing_heavy_punch'
        WHEN 'rush_standing_heavy_punch_holding' THEN 'standing_heavy_punch_holding'
        WHEN 'rush_standing_heavy_kick' THEN 'standing_heavy_kick'
        WHEN 'rush_crouching_light_punch' THEN 'crouching_light_punch'
        WHEN 'rush_crouching_light_kick' THEN 'crouching_light_kick'
        WHEN 'rush_crouching_medium_punch' THEN 'crouching_medium_punch'
        WHEN 'rush_crouching_medium_kick' THEN 'crouching_medium_kick'
        WHEN 'rush_crouching_heavy_punch' THEN 'crouching_heavy_punch'
        WHEN 'rush_crouching_heavy_kick' THEN 'crouching_heavy_kick'
        WHEN 'rush_hellstab' THEN 'hellstab'
        WHEN 'rush_knee_hammer' THEN 'knee_hammer'
        WHEN 'rush_headbutt' THEN 'headbutt'
        WHEN 'rush_cyclone_wheel_kick' THEN 'cyclone_wheel_kick'
        WHEN 'rush_smetana_dropkick' THEN 'smetana_dropkick'
        WHEN 'rush_power_stomps_1hits' THEN 'power_stomps_1hits'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'zangief' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_punch_holding', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_hellstab', 'rush_knee_hammer', 'rush_headbutt', 'rush_cyclone_wheel_kick', 'rush_smetana_dropkick', 'rush_power_stomps_1hits');

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
  UNION ALL SELECT 'standing_heavy_punch_holding', '立ち強P(ホールド)'
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
  UNION ALL SELECT 'jumping_heavy_kick_holding', 'ジャンプ強K(ホールド)'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'german_suplex', 'ジャーマンスープレックス'
  UNION ALL SELECT 'spinebuster', 'スパインバスター'
  UNION ALL SELECT 'russian_drop', 'ロシアンドロップ'
  UNION ALL SELECT 'brain_buster', 'ブレーンバスター'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'hellstab', 'ヘルスタブ'
  UNION ALL SELECT 'knee_hammer', 'ニーバット'
  UNION ALL SELECT 'headbutt', 'ヘッドバット'
  UNION ALL SELECT 'cyclone_wheel_kick', 'サイクロンニールキック'
  UNION ALL SELECT 'smetana_dropkick', 'スメタナドロップキック'
  UNION ALL SELECT 'flying_body_press', 'フライングボディプレス'
  UNION ALL SELECT 'flying_headbutt', 'フライングヘッドバット'
  UNION ALL SELECT 'double_lariat_od', 'ODダブルラリアット'
  UNION ALL SELECT 'double_lariat', 'ダブルラリアット'
  UNION ALL SELECT 'screw_piledriver_light', '弱スクリューパイルドライバー'
  UNION ALL SELECT 'screw_piledriver_medium', '中スクリューパイルドライバー'
  UNION ALL SELECT 'screw_piledriver_heavy', '強スクリューパイルドライバー'
  UNION ALL SELECT 'screw_piledriver_od', 'ODスクリューパイルドライバー'
  UNION ALL SELECT 'borscht_dynamite', 'ボルシチダイナマイト'
  UNION ALL SELECT 'borscht_dynamite_od', 'ODボルシチダイナマイト'
  UNION ALL SELECT 'russian_suplex', 'ロシアンスープレックス'
  UNION ALL SELECT 'russian_suplex_od', 'ODロシアンスープレックス'
  UNION ALL SELECT 'siberian_express', 'シベリアンエクスプレス'
  UNION ALL SELECT 'siberian_express_od', 'ODシベリアンエクスプレス'
  UNION ALL SELECT 'tundra_storm', 'ツンドラストーム'
  UNION ALL SELECT 'sa1_aerial_russian_slam', 'SA1 エアリアルロシアンスラム'
  UNION ALL SELECT 'sa2_cyclone_lariat_forward', 'SA2 サイクロンラリアット(前)'
  UNION ALL SELECT 'sa2_cyclone_lariat_back', 'SA2 サイクロンラリアット(後ろ)'
  UNION ALL SELECT 'sa2_cyclone_lariat_holding', 'SA2 サイクロンラリアット(ホールド)'
  UNION ALL SELECT 'sa3_bolshoi_storm_buster', 'SA3 ボリショイストームバスター'
  UNION ALL SELECT 'ca_bolshoi_storm_buster', 'CA ボリショイストームバスター'
  UNION ALL SELECT 'machine_gun_chops_2hits', 'マシンガンチョップ(2段止め)'
  UNION ALL SELECT 'machine_gun_chops', 'マシンガンチョップ'
  UNION ALL SELECT 'power_stomps_1hits', 'ストンピング(単発)'
  UNION ALL SELECT 'power_stomps_2hits', 'ストンピング(2段止め)'
  UNION ALL SELECT 'power_stomps', 'ストンピング'
  UNION ALL SELECT 'rush_standing_light_punch', '立ち弱P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_light_kick', '立ち弱K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_punch', '立ち中P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_kick', '立ち中K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_punch', '立ち強P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', '立ち強P(ホールド)(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_kick', '立ち強K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_punch', 'しゃがみ弱P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_kick', 'しゃがみ弱K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'しゃがみ中P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'しゃがみ中K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'しゃがみ強P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'しゃがみ強K(ラッシュ)'
  UNION ALL SELECT 'rush_hellstab', 'ヘルスタブ(ラッシュ)'
  UNION ALL SELECT 'rush_knee_hammer', 'ニーバット(ラッシュ)'
  UNION ALL SELECT 'rush_headbutt', 'ヘッドバット(ラッシュ)'
  UNION ALL SELECT 'rush_cyclone_wheel_kick', 'サイクロンニールキック(ラッシュ)'
  UNION ALL SELECT 'rush_smetana_dropkick', 'スメタナドロップキック(ラッシュ)'
  UNION ALL SELECT 'rush_power_stomps_1hits', 'ストンピング(単発)(ラッシュ)'
) AS v
WHERE c.code = 'zangief' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

