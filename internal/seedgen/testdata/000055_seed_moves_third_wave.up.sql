-- 000055_seed_moves_third_wave.up.sql
-- M14-03e: m_bison / rashid / jamie / luke / marisa / jp の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(第三波)。
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 移動 system move は CSV に無い(seed の投入元は 000004_data_seed_moves)。
-- FK 依存順 characters→moves→preset_aliases。

-- ===== m_bison (79 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 2 AS active, 17 AS total, 4 AS on_hit, -3 AS on_block, 11 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 2, 15, 3, -1, 10, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 8, 3, 25, 6, 0, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 10, 3, 29, 2, -3, 17, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 1000, 19, 3, 41, 4, 1, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 13, 4, 35, 6, -2, 19, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 15, 4, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 4, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 3, 25, 5, -1, 17, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 10, 6, 36, 0, -9, 21, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 3, 39, NULL, -12, 26, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 4, 46, NULL, NULL, 38, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 7, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 4, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 7, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'psycho_hammer', 'unique', 800, 22, 3, 44, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'evil_knee', 'unique', 800, 10, 4, 30, 4, 1, 17, 0, NULL
  UNION ALL SELECT 'hover_kick', 'unique', 900, 15, 10, 47, NULL, -15, 23, 0, NULL
  UNION ALL SELECT 'psycho_crusher_attack_light', 'special', 1200, 14, 16, 53, NULL, -19, 24, 0, NULL
  UNION ALL SELECT 'mine_set_light_psycho_crusher_attack', 'special', 1700, 14, 16, 53, NULL, 6, 24, 0, NULL
  UNION ALL SELECT 'psycho_crusher_attack_medium', 'special', 1400, 20, 16, 59, NULL, -20, 24, 0, NULL
  UNION ALL SELECT 'mine_set_medium_psycho_crusher_attack', 'special', 1900, 20, 16, 59, NULL, 6, 24, 0, NULL
  UNION ALL SELECT 'psycho_crusher_attack_heavy', 'special', 1600, 24, 26, 73, NULL, -23, 24, 0, NULL
  UNION ALL SELECT 'mine_set_heavy_psycho_crusher_attack', 'special', 2100, 24, 26, 73, NULL, 5, 24, 0, NULL
  UNION ALL SELECT 'psycho_crusher_attack_od', 'special', 1300, 16, 16, 51, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'mine_set_od_psycho_crusher_attack', 'special', 1600, 16, 16, 51, NULL, 10, 20, 0, NULL
  UNION ALL SELECT 'double_knee_press_light', 'special', 800, 13, 5, 42, 2, -5, 25, 0, NULL
  UNION ALL SELECT 'double_knee_press_medium', 'special', 900, 17, 5, 46, 3, -5, 25, 0, NULL
  UNION ALL SELECT 'double_knee_press_heavy', 'special', 1200, 22, 5, 51, 3, -4, 25, 0, NULL
  UNION ALL SELECT 'double_knee_press_od', 'special', 800, 17, 25, 69, NULL, -15, 28, 0, NULL
  UNION ALL SELECT 'backfist_combo_light', 'special', 700, 13, 17, 54, NULL, -14, 25, 0, NULL
  UNION ALL SELECT 'mine_set_light_backfist_combo', 'special', 1300, 13, 17, 54, NULL, 9, 25, 0, NULL
  UNION ALL SELECT 'backfist_combo_medium', 'special', 800, 17, 17, 59, NULL, -15, 26, 0, NULL
  UNION ALL SELECT 'mine_set_medium_backfist_combo', 'special', 1400, 17, 17, 59, NULL, 9, 26, 0, NULL
  UNION ALL SELECT 'backfist_combo_heavy', 'special', 900, 22, 18, 65, NULL, -15, 26, 0, NULL
  UNION ALL SELECT 'mine_set_heavy_backfist_combo', 'special', 1500, 22, 18, 65, NULL, 9, 26, 0, NULL
  UNION ALL SELECT 'backfist_combo_od', 'special', 1200, 14, 50, 107, NULL, -25, 44, 0, NULL
  UNION ALL SELECT 'mine_set_od_backfist_combo', 'special', 1700, 14, 50, 107, NULL, 3, 44, 0, NULL
  UNION ALL SELECT 'shadow_rise_light', 'special', 0, 1, 53, 53, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shadow_rise_medium', 'special', 0, 1, 58, 58, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shadow_rise_heavy', 'special', 0, 1, 63, 63, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'shadow_rise_od', 'special', 0, 1, 55, 55, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'head_press_od', 'special', 2000, 31, 4, 46, NULL, 6, 12, 0, '{"notes_tool":"ガードフレームはODシャドウライズから出したものを記載"}'
  UNION ALL SELECT 'head_press', 'special', 800, 33, 6, 64, NULL, -35, 26, 0, NULL
  UNION ALL SELECT 'somersault_skull_diver', 'special', 800, 12, 10, 33, 8, 5, 12, 0, '{"notes_tool":"ガードフレームはODシャドウライズから出したものを記載"}'
  UNION ALL SELECT 'devil_reverse_od', 'special', 1400, 37, 13, 59, NULL, 10, 10, 0, NULL
  UNION ALL SELECT 'mine_set_od_devil_reverse', 'special', 2100, 37, 13, 59, NULL, 27, 10, 0, NULL
  UNION ALL SELECT 'devil_reverse', 'special', 800, 34, 21, 64, NULL, 7, 10, 0, NULL
  UNION ALL SELECT 'mine_set_devil_reverse', 'special', 2000, 34, 21, 64, NULL, 24, 10, 0, NULL
  UNION ALL SELECT 'psycho_mine_auto_detonation', 'special', 500, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'sa1_knee_press_nightmare', 'super_art', 2000, 10, 42, 113, NULL, -41, 62, 0, NULL
  UNION ALL SELECT 'sa2_psycho_punisher', 'super_art', 3000, 24, 7, 82, NULL, -34, 52, 0, NULL
  UNION ALL SELECT 'sa3_unlimited_psycho_crusher', 'super_art', 4000, 10, 6, 80, NULL, -46, 65, 0, NULL
  UNION ALL SELECT 'ca_unlimited_psycho_crusher', 'critical_art', 4500, 10, 6, 80, NULL, -46, 65, 0, NULL
  UNION ALL SELECT 'shadow_hammer', 'target_combo', 1400, 22, 3, 44, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'shadow_spear', 'target_combo', 1300, 16, 4, 39, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'hell_attack', 'target_combo', 1400, 7, 4, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 2, 28, 8, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 2, 26, 7, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 19, 3, 36, 10, 4, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 21, 3, 40, 6, 1, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 1000, 30, 3, 52, 8, 5, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 24, 4, 46, 10, 2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 26, 8, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 8, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 3, 36, 9, 3, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 21, 6, 47, 4, -5, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 3, 50, NULL, -8, 26, 0, NULL
  UNION ALL SELECT 'rush_psycho_hammer', 'rush_variant', 800, 33, 3, 55, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_evil_knee', 'rush_variant', 800, 21, 4, 41, 8, 5, 17, 0, NULL
  UNION ALL SELECT 'rush_hover_kick', 'rush_variant', 900, 26, 10, 58, NULL, -11, 23, 0, NULL
) AS v
WHERE c.code = 'm_bison' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_psycho_hammer' THEN 'psycho_hammer'
        WHEN 'rush_evil_knee' THEN 'evil_knee'
        WHEN 'rush_hover_kick' THEN 'hover_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'm_bison' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_psycho_hammer', 'rush_evil_knee', 'rush_hover_kick');

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
  UNION ALL SELECT 'psycho_hammer', 'サイコハンマー'
  UNION ALL SELECT 'evil_knee', 'イビルニー'
  UNION ALL SELECT 'hover_kick', 'ホバーキック'
  UNION ALL SELECT 'psycho_crusher_attack_light', '弱サイコクラッシャーアタック'
  UNION ALL SELECT 'mine_set_light_psycho_crusher_attack', '[サイコマイン付着中]弱サイコクラッシャーアタック'
  UNION ALL SELECT 'psycho_crusher_attack_medium', '中サイコクラッシャーアタック'
  UNION ALL SELECT 'mine_set_medium_psycho_crusher_attack', '[サイコマイン付着中]中サイコクラッシャーアタック'
  UNION ALL SELECT 'psycho_crusher_attack_heavy', '強サイコクラッシャーアタック'
  UNION ALL SELECT 'mine_set_heavy_psycho_crusher_attack', '[サイコマイン付着中]強サイコクラッシャーアタック'
  UNION ALL SELECT 'psycho_crusher_attack_od', 'ODサイコクラッシャーアタック'
  UNION ALL SELECT 'mine_set_od_psycho_crusher_attack', '[サイコマイン付着中]ODサイコクラッシャーアタック'
  UNION ALL SELECT 'double_knee_press_light', '弱ダブルニープレス'
  UNION ALL SELECT 'double_knee_press_medium', '中ダブルニープレス'
  UNION ALL SELECT 'double_knee_press_heavy', '強ダブルニープレス'
  UNION ALL SELECT 'double_knee_press_od', 'ODダブルニープレス'
  UNION ALL SELECT 'backfist_combo_light', '弱バックフィストコンボ'
  UNION ALL SELECT 'mine_set_light_backfist_combo', '[サイコマイン付着中]弱バックフィストコンボ'
  UNION ALL SELECT 'backfist_combo_medium', '中バックフィストコンボ'
  UNION ALL SELECT 'mine_set_medium_backfist_combo', '[サイコマイン付着中]中バックフィストコンボ'
  UNION ALL SELECT 'backfist_combo_heavy', '強バックフィストコンボ'
  UNION ALL SELECT 'mine_set_heavy_backfist_combo', '[サイコマイン付着中]強バックフィストコンボ'
  UNION ALL SELECT 'backfist_combo_od', 'ODバックフィストコンボ'
  UNION ALL SELECT 'mine_set_od_backfist_combo', '[サイコマイン付着中]ODバックフィストコンボ'
  UNION ALL SELECT 'shadow_rise_light', '弱シャドウライズ'
  UNION ALL SELECT 'shadow_rise_medium', '中シャドウライズ'
  UNION ALL SELECT 'shadow_rise_heavy', '強シャドウライズ'
  UNION ALL SELECT 'shadow_rise_od', 'ODシャドウライズ'
  UNION ALL SELECT 'head_press_od', 'ODヘッドプレス'
  UNION ALL SELECT 'head_press', 'ヘッドプレス'
  UNION ALL SELECT 'somersault_skull_diver', 'サマーソルトスカルダイバー'
  UNION ALL SELECT 'devil_reverse_od', 'ODデビルリバース'
  UNION ALL SELECT 'mine_set_od_devil_reverse', '[サイコマイン付着中]ODデビルリバース'
  UNION ALL SELECT 'devil_reverse', 'デビルリバース'
  UNION ALL SELECT 'mine_set_devil_reverse', '[サイコマイン付着中]デビルリバース'
  UNION ALL SELECT 'psycho_mine_auto_detonation', 'サイコマイン（自動爆発）'
  UNION ALL SELECT 'sa1_knee_press_nightmare', 'SA1 ニープレスナイトメア'
  UNION ALL SELECT 'sa2_psycho_punisher', 'SA2 サイコパニッシャー'
  UNION ALL SELECT 'sa3_unlimited_psycho_crusher', 'SA3 アンリミテッドサイコクラッシャー'
  UNION ALL SELECT 'ca_unlimited_psycho_crusher', 'CA アンリミテッドサイコクラッシャー'
  UNION ALL SELECT 'shadow_hammer', 'シャドウハンマー'
  UNION ALL SELECT 'shadow_spear', 'シャドウスピア'
  UNION ALL SELECT 'hell_attack', 'ヘルアタック'
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
  UNION ALL SELECT 'rush_psycho_hammer', 'サイコハンマー(ラッシュ)'
  UNION ALL SELECT 'rush_evil_knee', 'イビルニー(ラッシュ)'
  UNION ALL SELECT 'rush_hover_kick', 'ホバーキック(ラッシュ)'
) AS v
WHERE c.code = 'm_bison' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== rashid (99 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 2 AS active, 14 AS total, 4 AS on_hit, -1 AS on_block, 9 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 3, 16, 3, -1, 10, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 3, 22, 5, 1, 14, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 8, 3, 29, 6, -3, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 3, 32, 1, -4, 21, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 13, 8, 38, -1, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 5, 3, 14, 5, -1, 7, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 15, 3, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 22, 4, 1, 13, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 7, 3, 27, -1, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 12, 3, 37, 5, -6, 23, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 3, 35, NULL, -11, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 5, 46, NULL, NULL, 38, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 5, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 9, 5, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 8, 9, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 5, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'desert_slider', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'run', 'unique', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'buffed_dash_forward', 'unique', 0, 1, 18, 18, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'buffed_dash_back', 'unique', 0, 1, 25, 25, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'buffed_jump_forward', 'unique', 0, 1, 44, 44, NULL, NULL, 0, 1, NULL
  UNION ALL SELECT 'buffed_jump_neutral', 'unique', 0, 1, 41, 41, NULL, NULL, 0, 1, NULL
  UNION ALL SELECT 'buffed_jump_back', 'unique', 0, 1, 44, 44, NULL, NULL, 0, 1, NULL
  UNION ALL SELECT 'backup', 'unique', 800, 26, 10, 52, 7, -10, 17, 0, NULL
  UNION ALL SELECT 'tempest_moon', 'unique', 1200, 34, 9, 63, 3, -4, 21, 0, NULL
  UNION ALL SELECT 'buffed_tempest_moon', 'unique', 1400, 27, 32, 80, NULL, -5, 22, 0, NULL
  UNION ALL SELECT 'flapping_spin', 'unique', 600, 8, 18, 43, 1, -3, 18, 0, NULL
  UNION ALL SELECT 'beak_assault', 'unique', 800, 22, 3, 45, 3, -3, 21, 0, NULL
  UNION ALL SELECT 'crescent_kick', 'unique', 900, 16, 4, 42, 2, -3, 23, 0, NULL
  UNION ALL SELECT 'blitz_strike', 'unique', 850, 10, 5, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'aerial_shot', 'unique', 800, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'side_flip', 'unique', 0, 1, 32, 32, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'front_flip', 'unique', 0, 1, 69, 69, NULL, NULL, 0, 1, NULL
  UNION ALL SELECT 'wall_jump', 'unique', 0, 35, 42, 76, NULL, NULL, 0, 1, NULL
  UNION ALL SELECT 'spinning_mixer_light', 'special', 700, 8, 16, 47, 2, -3, 24, 0, NULL
  UNION ALL SELECT 'buffed_light_spinning_mixer', 'special', 1000, 6, 54, 74, 4, 2, 15, 0, NULL
  UNION ALL SELECT 'spinning_mixer_medium', 'special', 800, 8, 19, 74, NULL, -45, 48, 0, NULL
  UNION ALL SELECT 'buffed_medium_spinning_mixer', 'special', 1400, 5, 55, 120, NULL, -83, 61, 0, NULL
  UNION ALL SELECT 'spinning_mixer_heavy', 'special', 1200, 6, 34, 77, NULL, -55, 38, 0, NULL
  UNION ALL SELECT 'buffed_heavy_spinning_mixer', 'special', 1800, 5, 47, 104, NULL, -83, 53, 0, NULL
  UNION ALL SELECT 'spinning_mixer_od', 'special', 1400, 6, 43, 110, NULL, -53, 62, 0, NULL
  UNION ALL SELECT 'buffed_od_spinning_mixer', 'special', 1400, 4, 56, 119, NULL, -77, 60, 0, NULL
  UNION ALL SELECT 'eagle_spike_light', 'special', 1100, 15, 13, 58, NULL, -36, 31, 0, NULL
  UNION ALL SELECT 'buffed_light_eagle_spike', 'special', 1300, 14, 13, 59, NULL, -24, 33, 0, NULL
  UNION ALL SELECT 'eagle_spike_medium', 'special', 1300, 21, 13, 59, NULL, -36, 26, 0, NULL
  UNION ALL SELECT 'buffed_medium_eagle_spike', 'special', 1300, 17, 15, 81, NULL, -15, 50, 0, NULL
  UNION ALL SELECT 'eagle_spike_heavy', 'special', 1500, 26, 13, 65, NULL, -36, 27, 0, NULL
  UNION ALL SELECT 'buffed_heavy_eagle_spike', 'special', 1500, 17, 15, 81, NULL, -15, 50, 0, NULL
  UNION ALL SELECT 'eagle_spike_od', 'special', 1000, 21, 13, 59, NULL, -36, 26, 0, NULL
  UNION ALL SELECT 'buffed_od_eagle_spike', 'special', 1300, 18, 14, 56, NULL, -24, 25, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_light', 'special', 600, 17, 36, 52, -1, -9, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_holding_light', 'special', 900, 34, 36, 69, 5, 0, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_max_holding_light', 'special', 1000, 53, 36, 88, 16, 8, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_medium', 'special', 600, 17, 36, 52, -1, -9, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_holding_medium', 'special', 900, 34, 36, 69, 5, 0, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_max_holding_medium', 'special', 1000, 53, 36, 88, 16, 8, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_heavy', 'special', 600, 17, 36, 52, -1, -9, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_holding_heavy', 'special', 900, 34, 36, 69, 5, 0, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_max_holding_heavy', 'special', 1000, 53, 36, 88, 16, 8, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_od', 'special', 700, 17, 36, 52, NULL, -2, 0, 0, NULL
  UNION ALL SELECT 'whirlwind_shot_holding_od', 'special', 1200, 38, 36, 73, NULL, 10, 0, 0, NULL
  UNION ALL SELECT 'arabian_cyclone_light', 'special', 800, 15, 19, 47, 2, -6, 14, 0, NULL
  UNION ALL SELECT 'arabian_cyclone_medium', 'special', 900, 20, 19, 50, 4, -4, 12, 0, NULL
  UNION ALL SELECT 'arabian_cyclone_heavy', 'special', 1000, 27, 19, 69, NULL, -2, 24, 0, NULL
  UNION ALL SELECT 'arabian_cyclone_od', 'special', 800, 20, 30, 49, NULL, -10, 0, 0, NULL
  UNION ALL SELECT 'wing_stroke', 'special', 0, 1, 67, 67, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rolling_assault', 'special', 0, 1, 33, 33, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'nail_assault', 'special', 600, 17, 3, 45, NULL, -9, 26, 0, NULL
  UNION ALL SELECT 'arabian_skyhigh_light', 'special', 600, 24, 9, 82, NULL, NULL, 50, 0, NULL
  UNION ALL SELECT 'arabian_skyhigh_medium', 'special', 700, 29, 9, 90, NULL, NULL, 53, 0, NULL
  UNION ALL SELECT 'arabian_skyhigh_heavy', 'special', 800, 32, 9, 101, NULL, NULL, 61, 0, NULL
  UNION ALL SELECT 'arabian_skyhigh_od', 'special', 1500, 24, 9, 75, NULL, NULL, 43, 0, NULL
  UNION ALL SELECT 'sa1_super_rashid_kick', 'super_art', 2100, 9, 7, 91, NULL, -53, 76, 0, NULL
  UNION ALL SELECT 'sa2_ysaar', 'super_art', 1000, 11, NULL, NULL, NULL, 33, NULL, 0, NULL
  UNION ALL SELECT 'sa3_altair', 'super_art', 4000, 11, 18, 110, NULL, -75, 82, 0, NULL
  UNION ALL SELECT 'ca_altair', 'critical_art', 4500, 11, 18, 110, NULL, -75, 82, 0, NULL
  UNION ALL SELECT 'rising_kick', 'target_combo', 1000, 13, 4, 52, NULL, -20, 36, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 2, 25, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 3, 27, 7, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 3, 33, 9, 5, 14, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 19, 3, 40, 10, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 3, 43, 5, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 24, 8, 49, 3, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 16, 3, 25, 9, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 26, 7, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 33, 8, 5, 13, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 18, 3, 38, 3, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 23, 3, 48, 9, -2, 23, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 3, 46, NULL, -7, 24, 0, NULL
  UNION ALL SELECT 'rush_flapping_spin', 'rush_variant', 600, 19, 18, 54, 5, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_beak_assault', 'rush_variant', 800, 33, 3, 56, 7, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_crescent_kick', 'rush_variant', 900, 27, 4, 53, 6, 1, 23, 0, NULL
  UNION ALL SELECT 'rush_side_flip', 'rush_variant', 0, 12, 32, 43, NULL, NULL, 0, 0, NULL
) AS v
WHERE c.code = 'rashid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_flapping_spin' THEN 'flapping_spin'
        WHEN 'rush_beak_assault' THEN 'beak_assault'
        WHEN 'rush_crescent_kick' THEN 'crescent_kick'
        WHEN 'rush_side_flip' THEN 'side_flip'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'rashid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_flapping_spin', 'rush_beak_assault', 'rush_crescent_kick', 'rush_side_flip');

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
  UNION ALL SELECT 'desert_slider', 'デザート・スライダー'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'run', 'ラン'
  UNION ALL SELECT 'buffed_dash_forward', '【強化】前方ステップ'
  UNION ALL SELECT 'buffed_dash_back', '【強化】後方ステップ'
  UNION ALL SELECT 'buffed_jump_forward', '【強化】前ジャンプ'
  UNION ALL SELECT 'buffed_jump_neutral', '【強化】垂直ジャンプ'
  UNION ALL SELECT 'buffed_jump_back', '【強化】後ろジャンプ'
  UNION ALL SELECT 'backup', 'バックアップ'
  UNION ALL SELECT 'tempest_moon', 'テンペスト・ムーン'
  UNION ALL SELECT 'buffed_tempest_moon', '【強化】テンペスト・ムーン'
  UNION ALL SELECT 'flapping_spin', 'フラップ・スピン'
  UNION ALL SELECT 'beak_assault', 'アサルト・ビーク'
  UNION ALL SELECT 'crescent_kick', 'クレセントキック'
  UNION ALL SELECT 'blitz_strike', 'ブリッツストライク'
  UNION ALL SELECT 'aerial_shot', 'エリアルシュート'
  UNION ALL SELECT 'side_flip', 'サイド・フリップ'
  UNION ALL SELECT 'front_flip', 'フロント・フリップ'
  UNION ALL SELECT 'wall_jump', '三角飛び'
  UNION ALL SELECT 'spinning_mixer_light', '弱スピニング・ミキサー'
  UNION ALL SELECT 'buffed_light_spinning_mixer', '【強化】弱スピニング・ミキサー'
  UNION ALL SELECT 'spinning_mixer_medium', '中スピニング・ミキサー'
  UNION ALL SELECT 'buffed_medium_spinning_mixer', '【強化】中スピニング・ミキサー'
  UNION ALL SELECT 'spinning_mixer_heavy', '強スピニング・ミキサー'
  UNION ALL SELECT 'buffed_heavy_spinning_mixer', '【強化】強スピニング・ミキサー'
  UNION ALL SELECT 'spinning_mixer_od', 'ODスピニング・ミキサー'
  UNION ALL SELECT 'buffed_od_spinning_mixer', '【強化】ODスピニング・ミキサー'
  UNION ALL SELECT 'eagle_spike_light', '弱イーグル・スパイク'
  UNION ALL SELECT 'buffed_light_eagle_spike', '【強化】弱イーグル・スパイク'
  UNION ALL SELECT 'eagle_spike_medium', '中イーグル・スパイク'
  UNION ALL SELECT 'buffed_medium_eagle_spike', '【強化】中イーグル・スパイク'
  UNION ALL SELECT 'eagle_spike_heavy', '強イーグル・スパイク'
  UNION ALL SELECT 'buffed_heavy_eagle_spike', '【強化】強イーグル・スパイク'
  UNION ALL SELECT 'eagle_spike_od', 'ODイーグル・スパイク'
  UNION ALL SELECT 'buffed_od_eagle_spike', '【強化】ODイーグル・スパイク'
  UNION ALL SELECT 'whirlwind_shot_light', '弱ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_holding_light', '【ホールド】弱ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_max_holding_light', '【最大ホールド】弱ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_medium', '中ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_holding_medium', '【ホールド】中ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_max_holding_medium', '【最大ホールド】中ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_heavy', '強ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_holding_heavy', '【ホールド】強ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_max_holding_heavy', '【最大ホールド】強ワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_od', 'ODワールウインド・ショット'
  UNION ALL SELECT 'whirlwind_shot_holding_od', '【ホールド】ODワールウインド・ショット'
  UNION ALL SELECT 'arabian_cyclone_light', '弱アラビアン・サイクロン'
  UNION ALL SELECT 'arabian_cyclone_medium', '中アラビアン・サイクロン'
  UNION ALL SELECT 'arabian_cyclone_heavy', '強アラビアン・サイクロン'
  UNION ALL SELECT 'arabian_cyclone_od', 'ODアラビアン・サイクロン'
  UNION ALL SELECT 'wing_stroke', 'ウイング・ストローク'
  UNION ALL SELECT 'rolling_assault', 'アサルト・ロール'
  UNION ALL SELECT 'nail_assault', 'アサルト・ネイル'
  UNION ALL SELECT 'arabian_skyhigh_light', '弱アラビアン・スカイハイ'
  UNION ALL SELECT 'arabian_skyhigh_medium', '中アラビアン・スカイハイ'
  UNION ALL SELECT 'arabian_skyhigh_heavy', '強アラビアン・スカイハイ'
  UNION ALL SELECT 'arabian_skyhigh_od', 'ODアラビアン・スカイハイ'
  UNION ALL SELECT 'sa1_super_rashid_kick', 'SA1 スーパー・ラシード・キック'
  UNION ALL SELECT 'sa2_ysaar', 'SA2 イウサール'
  UNION ALL SELECT 'sa3_altair', 'SA3 アルタイル'
  UNION ALL SELECT 'ca_altair', 'CA アルタイル'
  UNION ALL SELECT 'rising_kick', 'ライジング・キック'
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
  UNION ALL SELECT 'rush_flapping_spin', 'フラップ・スピン(ラッシュ)'
  UNION ALL SELECT 'rush_beak_assault', 'アサルト・ビーク(ラッシュ)'
  UNION ALL SELECT 'rush_crescent_kick', 'クレセントキック(ラッシュ)'
  UNION ALL SELECT 'rush_side_flip', 'サイド・フリップ(ラッシュ)'
) AS v
WHERE c.code = 'rashid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== jamie (127 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 16 AS total, 2 AS on_hit, -3 AS on_block, 9 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'drink_level_1_standing_light_punch', 'normal', 270, 5, 2, 13, 5, 0, 7, 0, NULL
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 17, 3, -1, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 8, 4, 25, 6, 2, 14, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 9, 3, 29, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 5, 10, 34, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 15, 3, 38, 3, -5, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 250, 4, 2, 14, 5, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 17, 3, -3, 11, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 3, 23, 5, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 7, 3, 27, -1, -6, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 8, 5, 35, 0, -8, 23, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 800, 9, 7, 43, NULL, -11, 28, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 9, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 5, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 8, 12, 46, NULL, NULL, 27, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'forward_throw_drink', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'forward_throw_reach_drink_lv4', 'throw', 1259, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'tensei_kick', 'unique', 600, 9, 3, 33, NULL, -8, 22, 0, NULL
  UNION ALL SELECT 'phantom_sway_2hits', 'target_combo', 1300, 12, 3, 57, NULL, -28, 43, 0, NULL
  UNION ALL SELECT 'phantom_sway', 'target_combo', 1300, 12, 3, 75, NULL, -46, 61, 0, NULL
  UNION ALL SELECT 'phantom_sway_drink_and_reach_drink_lv4', 'target_combo', 1365, 12, 3, 75, NULL, -46, 61, 0, NULL
  UNION ALL SELECT 'bitter_strikes_2hits', 'target_combo', 460, 6, 2, 23, -3, -8, 16, 0, NULL
  UNION ALL SELECT 'bitter_strikes', 'target_combo', 810, 8, 3, 31, -1, -10, 21, 0, NULL
  UNION ALL SELECT 'full_moon_kick_2hits', 'target_combo', 1000, 15, 10, 52, NULL, -14, 28, 0, NULL
  UNION ALL SELECT 'full_moon_kick', 'target_combo', 1000, 15, 9, 84, NULL, -46, 61, 0, NULL
  UNION ALL SELECT 'full_moon_kick_drink_and_reach_drink_lv4', 'target_combo', 1050, 15, 9, 81, NULL, -43, 58, 0, NULL
  UNION ALL SELECT 'falling_star_kick', 'unique', 600, 22, 3, 44, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'hermits_elbow', 'unique', 800, 18, 4, 41, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'drink_level_3_hermits_elbow', 'unique', 840, 18, 4, 42, 1, -3, 21, 0, NULL
  UNION ALL SELECT 'senei_kick', 'unique', 900, 16, 3, 38, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'drink_level_4_senei_kick', 'unique', 990, 16, 4, 38, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'intoxicated_assault_1hit', 'target_combo', 630, 21, 4, 44, NULL, -11, 20, 0, NULL
  UNION ALL SELECT 'drink_level_3_intoxicated_assault', 'target_combo', 1470, 21, 3, 60, NULL, -20, 37, 0, NULL
  UNION ALL SELECT 'drink_level_4_ransui_haze_2_retreat', 'target_combo', 990, 16, 3, 93, NULL, -58, 75, 0, NULL
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_immediate', 'target_combo', 1925, 38, 5, 70, NULL, -13, 28, 0, NULL
  UNION ALL SELECT 'the_devil_inside', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_up2', 'special', 0, 1, 97, 97, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_up3', 'special', 0, 1, 146, 146, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_up4', 'special', 0, 1, 193, 193, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_reach_drink_lv4', 'special', 0, 1, 49, 49, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_up2_reach_drink_lv4', 'special', 0, 1, 95, 95, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'the_devil_inside_up3_reach_drink_lv4', 'special', 0, 1, 144, 144, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'freeflow_strikes_1hit_light', 'special', 350, 13, 2, 38, -1, -6, 24, 0, NULL
  UNION ALL SELECT 'freeflow_strikes_1hit_medium', 'special', 400, 16, 2, 41, -1, -6, 24, 0, NULL
  UNION ALL SELECT 'freeflow_strikes_1hit_heavy', 'special', 450, 19, 2, 44, -1, -6, 24, 0, NULL
  UNION ALL SELECT 'freeflow_strikes_1hit_od', 'special', 450, 13, 2, 38, 1, -3, 24, 0, NULL
  UNION ALL SELECT 'freeflow_strikes_2hits_light', 'special', 700, 33, 2, 62, -3, -13, 28, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_2hits_medium', 'special', 800, 39, 2, 68, -3, -11, 28, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_2hits_heavy', 'special', 900, 45, 2, 74, -3, -9, 28, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_2hits_od', 'special', 900, 35, 2, 64, -3, -9, 28, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_light', 'special', 1140, 53, 2, 84, NULL, -17, 30, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_medium', 'special', 1280, 62, 2, 93, NULL, -15, 30, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_heavy', 'special', 1420, 71, 2, 102, NULL, -13, 30, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_strikes_od', 'special', 1650, 54, 2, 85, NULL, -13, 30, 0, '{"notes_tool":"空振りでも発動可能、空ぶり時の全体フレームを記載"}'
  UNION ALL SELECT 'freeflow_kicks_2hit_light', 'special', 600, 14, 2, 47, -7, -15, 32, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_2hit_medium', 'special', 700, 17, 2, 50, -7, -15, 32, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_2hit_heavy', 'special', 750, 20, 2, 53, -7, -15, 32, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_2hit_od', 'special', 800, 14, 2, 47, -7, -15, 32, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_light', 'special', 960, 18, 2, 83, NULL, -49, 64, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_medium', 'special', 1100, 21, 2, 86, NULL, -49, 64, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_heavy', 'special', 1190, 24, 2, 89, NULL, -49, 64, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'freeflow_kicks_od', 'special', 1400, 18, 2, 83, NULL, -49, 64, 0, '{"notes_tool":"空振り無理、ガード発動可能"}'
  UNION ALL SELECT 'swagger_step_light', 'special', 900, 17, 9, 42, NULL, -6, 17, 0, NULL
  UNION ALL SELECT 'swagger_step_medium', 'special', 1000, 20, 9, 45, NULL, -6, 17, 0, NULL
  UNION ALL SELECT 'swagger_step_heavy', 'special', 1200, 25, 9, 49, NULL, -3, 16, 0, NULL
  UNION ALL SELECT 'swagger_step_od', 'special', 1100, 20, 9, 43, NULL, -1, 15, 0, NULL
  UNION ALL SELECT 'arrow_kick_light', 'special', 1000, 5, 10, 66, NULL, -45, 52, 0, NULL
  UNION ALL SELECT 'arrow_kick_medium', 'special', 1200, 8, 9, 67, NULL, -43, 51, 0, NULL
  UNION ALL SELECT 'arrow_kick_heavy', 'special', 1400, 10, 9, 69, NULL, -43, 51, 0, NULL
  UNION ALL SELECT 'arrow_kick_od', 'special', 1500, 6, 9, 65, NULL, -43, 51, 0, NULL
  UNION ALL SELECT 'luminous_dive_kick_light', 'special', 1000, 22, 13, 47, NULL, -7, 13, 0, NULL
  UNION ALL SELECT 'luminous_dive_kick_medium', 'special', 1000, 22, 13, 47, NULL, -7, 13, 0, NULL
  UNION ALL SELECT 'luminous_dive_kick_heavy', 'special', 1000, 22, 13, 47, NULL, -7, 13, 0, NULL
  UNION ALL SELECT 'luminous_dive_kick_od', 'special', 800, 22, 9, 43, NULL, -2, 13, 0, NULL
  UNION ALL SELECT 'bakkai_light', 'special', 1400, 18, 26, 67, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'bakkai_medium', 'special', 1600, 22, 38, 90, NULL, -16, 31, 0, NULL
  UNION ALL SELECT 'bakkai_heavy', 'special', 1800, 25, 68, 124, NULL, -17, 32, 0, NULL
  UNION ALL SELECT 'bakkai_od', 'special', 2000, 18, 83, 159, NULL, -43, 59, 0, NULL
  UNION ALL SELECT 'tenshin_od', 'special', 682, 8, 2, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'tenshin', 'special', 0, 8, 2, 61, 8, NULL, 52, 0, NULL
  UNION ALL SELECT 'swagger_hermit_punch_od', 'special', 1100, 19, 3, 60, NULL, -23, 39, 0, '{"notes_tool":"単発ダメージ記載。酔疾歩派生だが、一応単発で当たる事もあるため。"}'
  UNION ALL SELECT 'swagger_hermit_punch', 'special', 990, 19, 3, 60, NULL, -23, 39, 0, '{"notes_tool":"単発ダメージ記載。酔疾歩派生だが、一応単発で当たる事もあるため。"}'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_light', 'special', 440, 13, 14, 45, 1, -3, 19, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_medium', 'special', 550, 16, 14, 48, 1, -3, 19, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_heavy', 'special', 660, 19, 14, 51, 1, -3, 19, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_od', 'special', 660, 13, 14, 45, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_light', 'special', 935, 48, 9, 83, -2, -10, 27, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_medium', 'special', 1045, 51, 9, 86, -2, -10, 27, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_heavy', 'special', 1155, 54, 9, 89, -2, -10, 27, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_od', 'special', 1210, 48, 9, 83, -2, -10, 27, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_light', 'special', 1595, 78, 25, 130, NULL, -14, 28, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_medium', 'special', 1705, 81, 25, 133, NULL, -14, 28, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_heavy', 'special', 1815, 84, 25, 136, NULL, -14, 28, 0, NULL
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_od', 'special', 2145, 78, 25, 130, NULL, -14, 28, 0, NULL
  UNION ALL SELECT 'sa1_breakin', 'super_art', 2200, 8, 127, 208, NULL, -60, 74, 0, NULL
  UNION ALL SELECT 'sa2_the_devil_s_song', 'super_art', 0, 1, 6, 6, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa3_getsuga_saiho', 'super_art', 2600, 10, 19, 70, NULL, -27, 42, 0, NULL
  UNION ALL SELECT 'ca_getsuga_saiho', 'critical_art', 4500, 10, 19, 70, NULL, -27, 42, 0, NULL
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_delay', 'target_combo', 1320, 53, 25, 104, NULL, -9, 27, 0, NULL
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_drink_while_retreating', 'target_combo', 990, 15, 3, 132, NULL, -98, 115, 0, '{"notes_tool":"最速派生でのガードマイナスを記載"}'
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 27, 6, 1, 9, 0, NULL
  UNION ALL SELECT 'rush_drink_level_1_standing_light_punch', 'rush_variant', 270, 16, 2, 24, 9, 4, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 28, 7, 3, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 19, 4, 36, 10, 6, 14, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 20, 3, 40, 6, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 16, 10, 45, 5, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 26, 3, 49, 7, -1, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 250, 15, 2, 25, 9, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 28, 7, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 3, 34, 9, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 18, 3, 38, 3, -2, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 19, 5, 46, 4, -4, 23, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 800, 20, 7, 54, NULL, -7, 28, 0, NULL
  UNION ALL SELECT 'rush_tensei_kick', 'rush_variant', 600, 20, 3, 44, NULL, -4, 22, 0, NULL
  UNION ALL SELECT 'rush_falling_star_kick', 'rush_variant', 600, 33, 3, 55, 5, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_hermits_elbow', 'rush_variant', 800, 29, 4, 52, 5, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_drink_level_3_hermits_elbow', 'rush_variant', 840, 29, 4, 53, 5, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_senei_kick', 'rush_variant', 900, 27, 3, 49, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_drink_level_4_senei_kick', 'rush_variant', 990, 27, 4, 49, 7, 1, 19, 0, NULL
) AS v
WHERE c.code = 'jamie' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

-- rush_variant の original_move_id を元技 code から解決
UPDATE moves SET original_move_id = (
    SELECT b.id FROM moves b WHERE b.character_id = moves.character_id AND b.code = CASE moves.code
        WHEN 'rush_standing_light_punch' THEN 'standing_light_punch'
        WHEN 'rush_drink_level_1_standing_light_punch' THEN 'drink_level_1_standing_light_punch'
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
        WHEN 'rush_tensei_kick' THEN 'tensei_kick'
        WHEN 'rush_falling_star_kick' THEN 'falling_star_kick'
        WHEN 'rush_hermits_elbow' THEN 'hermits_elbow'
        WHEN 'rush_drink_level_3_hermits_elbow' THEN 'drink_level_3_hermits_elbow'
        WHEN 'rush_senei_kick' THEN 'senei_kick'
        WHEN 'rush_drink_level_4_senei_kick' THEN 'drink_level_4_senei_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'jamie' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_drink_level_1_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_tensei_kick', 'rush_falling_star_kick', 'rush_hermits_elbow', 'rush_drink_level_3_hermits_elbow', 'rush_senei_kick', 'rush_drink_level_4_senei_kick');

INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, '立ち弱P' AS alias_text
  UNION ALL SELECT 'drink_level_1_standing_light_punch', '[酔いレベル1]立ち弱P'
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
  UNION ALL SELECT 'forward_throw_drink', '前投げ(飲酒)'
  UNION ALL SELECT 'forward_throw_reach_drink_lv4', '前投げ(飲酒 / 酔いLv4到達)'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'tensei_kick', '天晴脚'
  UNION ALL SELECT 'phantom_sway_2hits', '幻酔舞'
  UNION ALL SELECT 'phantom_sway', '幻酔舞(飲酒)'
  UNION ALL SELECT 'phantom_sway_drink_and_reach_drink_lv4', '幻酔舞(飲酒 / 酔いLv4到達)'
  UNION ALL SELECT 'bitter_strikes_2hits', '鋭鍾打(2発止め)'
  UNION ALL SELECT 'bitter_strikes', '鋭鍾打'
  UNION ALL SELECT 'full_moon_kick_2hits', '円月脚'
  UNION ALL SELECT 'full_moon_kick', '円月脚(飲酒)'
  UNION ALL SELECT 'full_moon_kick_drink_and_reach_drink_lv4', '円月脚(飲酒 / 酔いLv4到達)'
  UNION ALL SELECT 'falling_star_kick', '落星脚'
  UNION ALL SELECT 'hermits_elbow', '仙姑肘'
  UNION ALL SELECT 'drink_level_3_hermits_elbow', '[酔いレベル3]仙姑肘'
  UNION ALL SELECT 'senei_kick', '旋影脚'
  UNION ALL SELECT 'drink_level_4_senei_kick', '[酔いレベル4]旋影脚'
  UNION ALL SELECT 'intoxicated_assault_1hit', '[酔いレベル3]酩酊襲(2発止め)'
  UNION ALL SELECT 'drink_level_3_intoxicated_assault', '[酔いレベル3]酩酊襲'
  UNION ALL SELECT 'drink_level_4_ransui_haze_2_retreat', '[酔いレベル4]乱酔旋(2段目/後退)'
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_immediate', '[酔いレベル4]乱酔旋(3段目/即時)'
  UNION ALL SELECT 'the_devil_inside', '魔身（酔い+1）'
  UNION ALL SELECT 'the_devil_inside_up2', '魔身（酔い+2）'
  UNION ALL SELECT 'the_devil_inside_up3', '魔身（酔い+3）'
  UNION ALL SELECT 'the_devil_inside_up4', '魔身（酔い+4）'
  UNION ALL SELECT 'the_devil_inside_reach_drink_lv4', '魔身(酔い+1 / 酔いLv4到達)'
  UNION ALL SELECT 'the_devil_inside_up2_reach_drink_lv4', '魔身(酔い+2 / 酔いLv4到達)'
  UNION ALL SELECT 'the_devil_inside_up3_reach_drink_lv4', '魔身(酔い+3 / 酔いLv4到達)'
  UNION ALL SELECT 'freeflow_strikes_1hit_light', '弱流酔拳(単発)'
  UNION ALL SELECT 'freeflow_strikes_1hit_medium', '中流酔拳(単発)'
  UNION ALL SELECT 'freeflow_strikes_1hit_heavy', '強流酔拳(単発)'
  UNION ALL SELECT 'freeflow_strikes_1hit_od', 'OD流酔拳(単発)'
  UNION ALL SELECT 'freeflow_strikes_2hits_light', '弱流酔拳(2発止め)'
  UNION ALL SELECT 'freeflow_strikes_2hits_medium', '中流酔拳(2発止め)'
  UNION ALL SELECT 'freeflow_strikes_2hits_heavy', '強流酔拳(2発止め)'
  UNION ALL SELECT 'freeflow_strikes_2hits_od', 'OD流酔拳(2発止め)'
  UNION ALL SELECT 'freeflow_strikes_light', '弱流酔拳'
  UNION ALL SELECT 'freeflow_strikes_medium', '中流酔拳'
  UNION ALL SELECT 'freeflow_strikes_heavy', '強流酔拳'
  UNION ALL SELECT 'freeflow_strikes_od', 'OD流酔拳'
  UNION ALL SELECT 'freeflow_kicks_2hit_light', '弱流酔脚(2発止め)'
  UNION ALL SELECT 'freeflow_kicks_2hit_medium', '中流酔脚(2発止め)'
  UNION ALL SELECT 'freeflow_kicks_2hit_heavy', '強流酔脚(2発止め)'
  UNION ALL SELECT 'freeflow_kicks_2hit_od', 'OD流酔脚(2発止め)'
  UNION ALL SELECT 'freeflow_kicks_light', '弱流酔脚'
  UNION ALL SELECT 'freeflow_kicks_medium', '中流酔脚'
  UNION ALL SELECT 'freeflow_kicks_heavy', '強流酔脚'
  UNION ALL SELECT 'freeflow_kicks_od', 'OD流酔脚'
  UNION ALL SELECT 'swagger_step_light', '弱酔疾歩'
  UNION ALL SELECT 'swagger_step_medium', '中酔疾歩'
  UNION ALL SELECT 'swagger_step_heavy', '強酔疾歩'
  UNION ALL SELECT 'swagger_step_od', 'OD酔疾歩'
  UNION ALL SELECT 'arrow_kick_light', '弱張弓腿'
  UNION ALL SELECT 'arrow_kick_medium', '中張弓腿'
  UNION ALL SELECT 'arrow_kick_heavy', '強張弓腿'
  UNION ALL SELECT 'arrow_kick_od', 'OD張弓腿'
  UNION ALL SELECT 'luminous_dive_kick_light', '弱無影蹴'
  UNION ALL SELECT 'luminous_dive_kick_medium', '中無影蹴'
  UNION ALL SELECT 'luminous_dive_kick_heavy', '強無影蹴'
  UNION ALL SELECT 'luminous_dive_kick_od', 'OD無影蹴'
  UNION ALL SELECT 'bakkai_light', '弱爆廻'
  UNION ALL SELECT 'bakkai_medium', '中爆廻'
  UNION ALL SELECT 'bakkai_heavy', '強爆廻'
  UNION ALL SELECT 'bakkai_od', 'OD爆廻'
  UNION ALL SELECT 'tenshin_od', 'OD点辰'
  UNION ALL SELECT 'tenshin', '点辰'
  UNION ALL SELECT 'swagger_hermit_punch_od', 'OD疾歩仙掌'
  UNION ALL SELECT 'swagger_hermit_punch', '疾歩仙掌'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_light', '[酔いレベル4]弱流酔拳(単発)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_medium', '[酔いレベル4]中流酔拳(単発)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_heavy', '[酔いレベル4]強流酔拳(単発)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_1hit_od', '[酔いレベル4]OD流酔拳(単発)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_light', '弱[酔いレベル4]流酔拳(2発止め)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_medium', '[酔いレベル4]中流酔拳(2発止め)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_heavy', '[酔いレベル4]強流酔拳(2発止め)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_2hits_od', '[酔いレベル4]OD流酔拳(2発止め)'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_light', '[酔いレベル4]弱流酔拳'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_medium', '[酔いレベル4]中流酔拳'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_heavy', '[酔いレベル4]強流酔拳'
  UNION ALL SELECT 'drink_level_4_freeflow_strikes_od', '[酔いレベル4]OD流酔拳'
  UNION ALL SELECT 'sa1_breakin', 'SA1 武麗禽'
  UNION ALL SELECT 'sa2_the_devil_s_song', 'SA2 絶唱魔身'
  UNION ALL SELECT 'sa3_getsuga_saiho', 'SA3 月牙叉炮'
  UNION ALL SELECT 'ca_getsuga_saiho', 'CA 月牙叉炮'
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_delay', '[酔いレベル4]乱酔旋(3段目/ディレイ)'
  UNION ALL SELECT 'drink_level_4_ransui_haze_3_drink_while_retreating', '[酔いレベル4]乱酔旋（3段目/後退飲酒）'
  UNION ALL SELECT 'rush_standing_light_punch', '立ち弱P(ラッシュ)'
  UNION ALL SELECT 'rush_drink_level_1_standing_light_punch', '[酔いレベル1]立ち弱P(ラッシュ)'
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
  UNION ALL SELECT 'rush_tensei_kick', '天晴脚(ラッシュ)'
  UNION ALL SELECT 'rush_falling_star_kick', '落星脚(ラッシュ)'
  UNION ALL SELECT 'rush_hermits_elbow', '仙姑肘(ラッシュ)'
  UNION ALL SELECT 'rush_drink_level_3_hermits_elbow', '[酔いレベル3]仙姑肘(ラッシュ)'
  UNION ALL SELECT 'rush_senei_kick', '旋影脚(ラッシュ)'
  UNION ALL SELECT 'rush_drink_level_4_senei_kick', '[酔いレベル4]旋影脚(ラッシュ)'
) AS v
WHERE c.code = 'jamie' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== luke (83 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 7 AS startup, 2 AS active, 22 AS total, 2 AS on_hit, -3 AS on_block, 14 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 3, -2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 9, 4, 28, 2, -3, 16, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 8, 3, 29, 1, -3, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 3, 35, 1, -5, 23, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 10, 7, 32, 2, -5, 16, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 15, 4, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 18, 0, -3, 11, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 2, 24, 5, 1, 17, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 7, 5, 35, 1, -13, 24, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 36, NULL, -9, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 9, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 6, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 9, 4, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'rawhide', 'unique', 600, 21, 2, 43, 2, -3, 21, 0, NULL
  UNION ALL SELECT 'suppressor', 'unique', 800, 16, 3, 38, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'outlaw_kick', 'unique', 1000, 12, 4, 39, 4, -3, 24, 0, NULL
  UNION ALL SELECT 'double_impact_1hit', 'unique', 800, 16, 3, 37, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'double_impact', 'target_combo', 1400, 11, 2, 46, NULL, -19, 34, 0, NULL
  UNION ALL SELECT 'sand_blast_light', 'special', 600, 14, 5, 47, -3, -8, 29, 0, NULL
  UNION ALL SELECT 'sand_blast_medium', 'special', 600, 17, 7, 47, 0, -5, 24, 0, NULL
  UNION ALL SELECT 'sand_blast_heavy', 'special', 600, 20, 10, 47, 3, -2, 18, 0, NULL
  UNION ALL SELECT 'sand_blast_od', 'special', 800, 16, 18, 40, NULL, -2, 7, 0, NULL
  UNION ALL SELECT 'fatal_shot', 'special', 1600, 8, 9, 50, NULL, -21, 34, 0, NULL
  UNION ALL SELECT 'flash_knuckle_light', 'special', 700, 13, 3, 42, NULL, -12, 27, 0, NULL
  UNION ALL SELECT 'flash_knuckle_holding_light', 'special', 800, 26, 4, 54, NULL, -8, 25, 0, NULL
  UNION ALL SELECT 'flash_knuckle_perfect_light', 'special', 900, 26, 4, 51, NULL, -8, 22, 0, NULL
  UNION ALL SELECT 'flash_knuckle_medium', 'special', 900, 19, 3, 48, 3, -8, 27, 0, NULL
  UNION ALL SELECT 'flash_knuckle_holding_medium', 'special', 1000, 29, 4, 58, NULL, -3, 26, 0, NULL
  UNION ALL SELECT 'flash_knuckle_perfect_medium', 'special', 1100, 29, 4, 58, NULL, -3, 26, 0, NULL
  UNION ALL SELECT 'flash_knuckle_heavy', 'special', 1000, 22, 3, 45, NULL, -4, 21, 0, NULL
  UNION ALL SELECT 'flash_knuckle_holding_heavy', 'special', 1300, 33, 4, 60, NULL, 4, 24, 0, NULL
  UNION ALL SELECT 'flash_knuckle_perfect_heavy', 'special', 1600, 33, 4, 60, NULL, 4, 24, 0, NULL
  UNION ALL SELECT 'flash_knuckle_od', 'special', 800, 15, 3, 56, NULL, -22, 39, 0, NULL
  UNION ALL SELECT 'ddt', 'special', 2500, 1, 161, 161, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'aerial_flash_knuckle_od', 'special', 1300, 25, 6, 75, NULL, NULL, 45, 0, NULL
  UNION ALL SELECT 'aerial_flash_knuckle_holding', 'special', 1000, 34, 6, 83, NULL, NULL, 44, 0, NULL
  UNION ALL SELECT 'aerial_flash_knuckle', 'special', 700, 25, 5, 72, NULL, NULL, 43, 0, NULL
  UNION ALL SELECT 'avenger_od', 'special', 0, 3, 33, 45, NULL, NULL, 10, 0, '{"notes_tool":"アーマーが出るまでを発生にしたがダメージのない技"}'
  UNION ALL SELECT 'avenger', 'special', 0, 1, 45, 45, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'no_chaser_od', 'special', 1300, 23, 10, 48, NULL, -6, 16, 0, NULL
  UNION ALL SELECT 'no_chaser', 'special', 900, 24, 10, 49, NULL, -6, 16, 0, NULL
  UNION ALL SELECT 'impaler_od', 'special', 1200, 24, 8, 50, NULL, -3, 19, 0, NULL
  UNION ALL SELECT 'impaler', 'special', 1200, 25, 8, 59, NULL, -8, 27, 0, NULL
  UNION ALL SELECT 'rising_uppercut_light', 'special', 900, 5, 10, 48, NULL, -27, 34, 0, NULL
  UNION ALL SELECT 'rising_uppercut_medium', 'special', 1000, 6, 10, 51, NULL, -29, 36, 0, NULL
  UNION ALL SELECT 'rising_uppercut_heavy', 'special', 1200, 9, 10, 58, NULL, -33, 40, 0, NULL
  UNION ALL SELECT 'rising_uppercut_od', 'special', 1400, 6, 10, 65, NULL, -40, 50, 0, NULL
  UNION ALL SELECT 'slam_dunk', 'special', 600, 16, 3, 48, NULL, NULL, 30, 0, NULL
  UNION ALL SELECT 'sa1_vulcan_blast', 'super_art', 2000, 6, 57, 108, NULL, -29, 46, 0, NULL
  UNION ALL SELECT 'sa2_eraser', 'super_art', 2800, 5, 3, 58, NULL, -29, 51, 0, NULL
  UNION ALL SELECT 'sa3_pale_rider', 'super_art', 4000, 10, 21, 122, NULL, -42, 92, 0, NULL
  UNION ALL SELECT 'ca_pale_rider', 'critical_art', 4500, 10, 21, 122, NULL, -42, 92, 0, NULL
  UNION ALL SELECT 'triple_impact_2hits', 'target_combo', 620, 8, 4, 31, -2, -9, 20, 0, NULL
  UNION ALL SELECT 'triple_impact', 'target_combo', 1180, 10, 3, 39, NULL, -14, 27, 0, NULL
  UNION ALL SELECT 'nose_breaker', 'target_combo', 980, 9, 3, 36, 2, -8, 25, 0, NULL
  UNION ALL SELECT 'snapback_combo_2hits', 'target_combo', 900, 12, 2, 36, NULL, -8, 23, 0, NULL
  UNION ALL SELECT 'snapback_combo_3hits', 'target_combo', 1140, 11, 2, 41, -6, -14, 29, 0, NULL
  UNION ALL SELECT 'snapback_combo', 'target_combo', 1490, 11, 2, 36, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 18, 2, 33, 6, 1, 14, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 7, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 20, 4, 39, 6, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 19, 3, 40, 5, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 3, 46, 5, -1, 23, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 21, 7, 43, 6, -1, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 26, 8, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 29, 4, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 2, 35, 9, 5, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 18, 5, 46, 5, -9, 24, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 47, NULL, -5, 24, 0, NULL
  UNION ALL SELECT 'rush_rawhide', 'rush_variant', 600, 32, 2, 54, 6, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_suppressor', 'rush_variant', 800, 27, 3, 49, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_outlaw_kick', 'rush_variant', 1000, 23, 4, 50, 8, 1, 24, 0, NULL
  UNION ALL SELECT 'rush_double_impact_1hit', 'rush_variant', 800, 27, 3, 48, 7, 1, 19, 0, NULL
) AS v
WHERE c.code = 'luke' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_rawhide' THEN 'rawhide'
        WHEN 'rush_suppressor' THEN 'suppressor'
        WHEN 'rush_outlaw_kick' THEN 'outlaw_kick'
        WHEN 'rush_double_impact_1hit' THEN 'double_impact_1hit'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'luke' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_rawhide', 'rush_suppressor', 'rush_outlaw_kick', 'rush_double_impact_1hit');

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
  UNION ALL SELECT 'rawhide', 'ローハイド'
  UNION ALL SELECT 'suppressor', 'サプレッサー'
  UNION ALL SELECT 'outlaw_kick', 'アウトローキック'
  UNION ALL SELECT 'double_impact_1hit', 'ダブルインパクト(単発)'
  UNION ALL SELECT 'double_impact', 'ダブルインパクト'
  UNION ALL SELECT 'sand_blast_light', '弱サンドブラスト'
  UNION ALL SELECT 'sand_blast_medium', '中サンドブラスト'
  UNION ALL SELECT 'sand_blast_heavy', '強サンドブラスト'
  UNION ALL SELECT 'sand_blast_od', 'ODサンドブラスト'
  UNION ALL SELECT 'fatal_shot', 'フェイタルショット'
  UNION ALL SELECT 'flash_knuckle_light', '弱フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_holding_light', '【ホールド】弱フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_perfect_light', '【ジャスト】弱フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_medium', '中フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_holding_medium', '【ホールド】中フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_perfect_medium', '【ジャスト】中フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_heavy', '強フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_holding_heavy', '【ホールド】強フラッシュナックル(ホールド)'
  UNION ALL SELECT 'flash_knuckle_perfect_heavy', '【ジャスト】強フラッシュナックル'
  UNION ALL SELECT 'flash_knuckle_od', 'ODフラッシュナックル'
  UNION ALL SELECT 'ddt', 'DDT'
  UNION ALL SELECT 'aerial_flash_knuckle_od', 'ODエアフラッシュナックル'
  UNION ALL SELECT 'aerial_flash_knuckle_holding', '【ホールド】エアフラッシュナックル'
  UNION ALL SELECT 'aerial_flash_knuckle', 'エアフラッシュナックル'
  UNION ALL SELECT 'avenger_od', 'ODアベンジャー'
  UNION ALL SELECT 'avenger', 'アベンジャー'
  UNION ALL SELECT 'no_chaser_od', 'ODノーチェイサー'
  UNION ALL SELECT 'no_chaser', 'ノーチェイサー'
  UNION ALL SELECT 'impaler_od', 'ODインパラー'
  UNION ALL SELECT 'impaler', 'インパラー'
  UNION ALL SELECT 'rising_uppercut_light', '弱ライジングアッパー'
  UNION ALL SELECT 'rising_uppercut_medium', '中ライジングアッパー'
  UNION ALL SELECT 'rising_uppercut_heavy', '強ライジングアッパー'
  UNION ALL SELECT 'rising_uppercut_od', 'ODライジングアッパー'
  UNION ALL SELECT 'slam_dunk', 'スラムダンク'
  UNION ALL SELECT 'sa1_vulcan_blast', 'SA1 バルカンブラスト'
  UNION ALL SELECT 'sa2_eraser', 'SA2 イレイザー'
  UNION ALL SELECT 'sa3_pale_rider', 'SA3 ペイルライダー'
  UNION ALL SELECT 'ca_pale_rider', 'CA ペイルライダー'
  UNION ALL SELECT 'triple_impact_2hits', 'トリプルインパクト(2発止め)'
  UNION ALL SELECT 'triple_impact', 'トリプルインパクト'
  UNION ALL SELECT 'nose_breaker', 'ノーズブレイカー'
  UNION ALL SELECT 'snapback_combo_2hits', 'スナップバックコンボ(2発止め)'
  UNION ALL SELECT 'snapback_combo_3hits', 'スナップバックコンボ(3発止め)'
  UNION ALL SELECT 'snapback_combo', 'スナップバックコンボ'
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
  UNION ALL SELECT 'rush_rawhide', 'ローハイド(ラッシュ)'
  UNION ALL SELECT 'rush_suppressor', 'サプレッサー(ラッシュ)'
  UNION ALL SELECT 'rush_outlaw_kick', 'アウトローキック(ラッシュ)'
  UNION ALL SELECT 'rush_double_impact_1hit', 'ダブルインパクト(単発)(ラッシュ)'
) AS v
WHERE c.code = 'luke' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== marisa (108 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 400 AS damage, 6 AS startup, 3 AS active, 19 AS total, 0 AS on_hit, -2 AS on_block, 11 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 400, 6, 2, 21, 0, -2, 14, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 7, 4, 27, 2, -1, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 800, 11, 4, 30, 4, -2, 16, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 1000, 12, 2, 36, 3, -3, 23, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch_holding', 'normal', 1200, 23, 2, 46, 7, 4, 22, 0, '{"notes_tool":"ホールドの発生は固定。発生早くなるタイミングはない"}'
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 1000, 15, 2, 41, 1, -3, 25, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick_holding', 'normal', 1200, 24, 2, 50, NULL, 1, 25, 0, '{"notes_tool":"ホールドの発生は固定。発生早くなるタイミングはない"}'
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 15, 4, -1, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 300, 5, 3, 19, 2, -3, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 700, 8, 3, 26, 3, -2, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 9, 3, 29, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 9, 5, 36, NULL, -6, 23, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch_holding', 'normal', 1000, 21, 6, 47, NULL, -3, 21, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 1000, 11, 3, 39, NULL, -11, 26, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick_holding', 'normal', 1200, 20, 3, 45, NULL, -3, 23, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 7, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 10, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 8, 8, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch_holding', 'normal', 1500, 28, 6, 46, NULL, NULL, 13, 1, '{"notes_tool":"ホールドの発生は固定。発生早くなるタイミングはない"}'
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick_holding', 'normal', 1500, 29, 6, 46, NULL, NULL, 12, 1, '{"notes_tool":"ホールドの発生は固定。発生早くなるタイミングはない"}'
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'caelum_arc', 'unique', 800, 9, 9, 46, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'caelum_arc_holding', 'unique', 1500, 28, 9, 46, NULL, NULL, 10, 1, NULL
  UNION ALL SELECT 'magna_bunker', 'unique', 900, 8, 2, 33, 3, -1, 24, 0, NULL
  UNION ALL SELECT 'magna_bunker_holding', 'unique', 1000, 20, 2, 45, 13, 4, 24, 0, NULL
  UNION ALL SELECT 'novacula', 'unique', 800, 9, 2, 30, 2, -3, 20, 0, NULL
  UNION ALL SELECT 'malleus_breaker_1hit', 'unique', 900, 21, 2, 43, 0, -3, 21, 0, NULL
  UNION ALL SELECT 'malleus_breaker_1hit_holding', 'unique', 1000, 28, 2, 48, 5, 2, 19, 0, NULL
  UNION ALL SELECT 'malleus_breaker', 'target_combo', 1800, 18, 2, 43, NULL, -12, 24, 0, '{"notes_tool":"ホールドではなくノーマル版始動での合計ダメージを記録。硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'falx_crusher_1hit', 'unique', 900, 14, 4, 38, 0, -3, 21, 0, NULL
  UNION ALL SELECT 'falx_crusher_1hit_holding', 'unique', 1000, 27, 4, 49, 10, 3, 19, 0, NULL
  UNION ALL SELECT 'falx_crusher', 'target_combo', 1900, 16, 5, 45, NULL, -12, 25, 0, '{"notes_tool":"ホールドではなくノーマル版始動での合計ダメージを記録。硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'gladius_light', 'special', 1200, 17, 4, 41, NULL, -5, 21, 0, NULL
  UNION ALL SELECT 'gladius_holding_light', 'special', 2400, 30, 4, 53, NULL, 4, 20, 0, NULL
  UNION ALL SELECT 'gladius_medium', 'special', 1400, 19, 4, 43, NULL, -5, 21, 0, NULL
  UNION ALL SELECT 'gladius_holding_medium', 'special', 2600, 35, 4, 58, NULL, 4, 20, 0, NULL
  UNION ALL SELECT 'gladius_heavy', 'special', 1600, 22, 4, 46, NULL, -5, 21, 0, NULL
  UNION ALL SELECT 'gladius_holding_heavy', 'special', 2800, 41, 4, 64, NULL, 4, 20, 0, NULL
  UNION ALL SELECT 'gladius_od', 'special', 1700, 19, 4, 43, NULL, -2, 21, 0, NULL
  UNION ALL SELECT 'gladius_holding_od', 'special', 2900, 35, 4, 58, NULL, 4, 20, 0, NULL
  UNION ALL SELECT 'dimachaerus_light', 'special', 1200, 13, 5, 40, NULL, NULL, 23, 0, '{"notes_tool":"ガード発動不可"}'
  UNION ALL SELECT 'dimachaerus_1hit_light', 'special', 600, 12, 4, 45, -3, -16, 30, 0, NULL
  UNION ALL SELECT 'dimachaerus_medium', 'special', 1300, 13, 5, 41, NULL, NULL, 24, 0, '{"notes_tool":"ガード発動不可"}'
  UNION ALL SELECT 'dimachaerus_1hit_medium', 'special', 700, 16, 4, 49, 0, -16, 30, 0, NULL
  UNION ALL SELECT 'dimachaerus_heavy', 'special', 1400, 18, 5, 45, NULL, NULL, 23, 0, '{"notes_tool":"ガード発動不可"}'
  UNION ALL SELECT 'dimachaerus_1hit_heavy', 'special', 800, 22, 4, 55, NULL, -16, 30, 0, NULL
  UNION ALL SELECT 'dimachaerus_od', 'special', 1200, 13, 5, 40, NULL, NULL, 23, 0, '{"notes_tool":"ガード発動不可"}'
  UNION ALL SELECT 'dimachaerus_1hit_od', 'special', 600, 16, 4, 45, NULL, -12, 26, 0, NULL
  UNION ALL SELECT 'phalanx_light', 'special', 1500, 25, 6, 45, NULL, 3, 15, 0, NULL
  UNION ALL SELECT 'phalanx_medium', 'special', 1600, 28, 6, 48, NULL, 3, 15, 0, NULL
  UNION ALL SELECT 'phalanx_heavy', 'special', 1700, 32, 6, 52, NULL, 3, 15, 0, NULL
  UNION ALL SELECT 'phalanx_od', 'special', 1400, 28, 6, 48, NULL, 4, 15, 0, NULL
  UNION ALL SELECT 'quadriga_light', 'special', 1400, 20, 4, 47, NULL, -6, 24, 0, NULL
  UNION ALL SELECT 'quadriga_medium', 'special', 1500, 24, 4, 49, NULL, -4, 22, 0, NULL
  UNION ALL SELECT 'quadriga_heavy', 'special', 1600, 29, 4, 53, NULL, -3, 21, 0, NULL
  UNION ALL SELECT 'quadriga_od', 'special', 1500, 24, 4, 51, NULL, -6, 24, 0, NULL
  UNION ALL SELECT 'scutum_od', 'special', 0, 1, 28, 57, NULL, NULL, 29, 0, '{"notes_tool":"放置して解ける時間"}'
  UNION ALL SELECT 'scutum', 'special', 0, 3, 26, 54, NULL, NULL, 26, 0, '{"notes_tool":"放置して解ける時間"}'
  UNION ALL SELECT 'scutum_max_holding_od', 'special', 0, 1, 58, 87, NULL, NULL, 29, 0, '{"notes_tool":"放置して解ける時間"}'
  UNION ALL SELECT 'scutum_max_holding', 'special', 0, 3, 116, 144, NULL, NULL, 26, 0, '{"notes_tool":"放置して解ける時間"}'
  UNION ALL SELECT 'scutum_counterattack_od', 'special', 840, NULL, NULL, NULL, 1, -3, NULL, 0, NULL
  UNION ALL SELECT 'scutum_counterattack', 'special', 840, NULL, NULL, NULL, 1, -3, NULL, 0, NULL
  UNION ALL SELECT 'tonitrus_1hit_od', 'special', 900, 23, 3, 50, 1, -3, 25, 0, NULL
  UNION ALL SELECT 'tonitrus_1hit', 'special', 900, 23, 3, 50, 1, -3, 25, 0, NULL
  UNION ALL SELECT 'tonitrus_od', 'special', 1900, 19, 3, 57, NULL, -21, 36, 0, '{"notes_tool":"前段ガードでも発動可能"}'
  UNION ALL SELECT 'tonitrus', 'special', 1900, 19, 3, 57, NULL, -21, 36, 0, '{"notes_tool":"前段ガードでも発動可能"}'
  UNION ALL SELECT 'procella_od', 'special', 1200, 24, 3, 63, NULL, -24, 37, 0, NULL
  UNION ALL SELECT 'procella', 'special', 1200, 24, 3, 63, NULL, -24, 37, 0, NULL
  UNION ALL SELECT 'enfold_od', 'special', 2500, 13, 3, 69, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'enfold', 'special', 2500, 13, 3, 69, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'sa1_javelin_of_marisa', 'super_art', 2200, 19, 5, 83, NULL, -43, 60, 0, '{"notes_tool":"実測では18F発生に見えるのだが、インゲームのフレームメーター、フレーム数、公式フレーム表記等の全てで19F発生。よく分からないがそこまで重大ではないので19Fで登録"}'
  UNION ALL SELECT 'sa1_javelin_of_marisa_holding', 'super_art', 2900, 42, 6, 107, NULL, -42, 60, 0, '{"notes_tool":"ホールド版が42F,43F溜めても出ない場合あり。ただしホールドしっぱなしで出す通常入力だと42Fで絶対出るので、軽微と考え42Fで登録"}'
  UNION ALL SELECT 'sa1_javelin_of_marisa_counterattack', 'super_art', 2400, 11, 5, 68, NULL, -42, 53, 0, NULL
  UNION ALL SELECT 'sa2_meteorite', 'super_art', 3000, 9, 43, 110, NULL, -44, 59, 0, NULL
  UNION ALL SELECT 'sa3_goddess_of_the_hunt', 'super_art', 4000, 13, 7, 79, NULL, -39, 60, 0, NULL
  UNION ALL SELECT 'ca_goddess_of_the_hunt', 'critical_art', 4500, 13, 7, 79, NULL, -39, 60, 0, NULL
  UNION ALL SELECT 'light_two_hitter', 'target_combo', 600, 14, 3, 38, -3, -6, 22, 0, '{"notes_tool":"ホールドではなくノーマル版始動での合計ダメージを記録。硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）コンボにならないので単発ダメージ。"}'
  UNION ALL SELECT 'medium_two_hitter', 'target_combo', 1300, 14, 2, 38, -3, -8, 23, 0, '{"notes_tool":"ホールドではなくノーマル版始動での合計ダメージを記録。硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'heavy_two_hitter', 'target_combo', 1900, 24, 3, 45, NULL, 2, 19, 0, '{"notes_tool":"ホールドではなくノーマル版始動での合計ダメージを記録。硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'volare_combo', 'target_combo', 1500, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL
  UNION ALL SELECT 'novacula_swipe', 'target_combo', 1600, 11, 2, 38, NULL, -12, 26, 0, '{"notes_tool":"硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'novacula_thrust', 'target_combo', 1600, 11, 4, 37, NULL, -10, 23, 0, '{"notes_tool":"硬直は無理やり空ぶらせたものを記録。（ヒットじゃないと出ない技だが上手い事調整）"}'
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 400, 17, 3, 30, 4, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 400, 17, 2, 32, 4, 2, 14, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 18, 4, 38, 6, 3, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 800, 22, 4, 41, 8, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 1000, 23, 2, 47, 7, 1, 23, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 1000, 26, 2, 52, 5, 1, 25, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 26, 8, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 300, 16, 3, 30, 6, 1, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 700, 19, 3, 37, 7, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 20, 3, 40, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 20, 5, 47, NULL, -2, 23, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 1000, 22, 3, 50, NULL, -7, 26, 0, NULL
  UNION ALL SELECT 'rush_magna_bunker', 'rush_variant', 900, 19, 2, 44, 7, 3, 24, 0, NULL
  UNION ALL SELECT 'rush_magna_bunker_holding', 'rush_variant', 1000, 31, 2, 56, 17, 8, 24, 0, NULL
  UNION ALL SELECT 'rush_novacula', 'rush_variant', 800, 20, 2, 41, 6, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_malleus_breaker_1hit', 'rush_variant', 900, 32, 2, 54, 4, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_malleus_breaker_1hit_holding', 'rush_variant', 1000, 39, 2, 59, 9, 6, 19, 0, NULL
  UNION ALL SELECT 'rush_falx_crusher_1hit', 'rush_variant', 900, 25, 4, 49, 4, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_falx_crusher_1hit_holding', 'rush_variant', 1000, 38, 4, 60, 14, 7, 19, 0, NULL
) AS v
WHERE c.code = 'marisa' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_magna_bunker' THEN 'magna_bunker'
        WHEN 'rush_magna_bunker_holding' THEN 'magna_bunker_holding'
        WHEN 'rush_novacula' THEN 'novacula'
        WHEN 'rush_malleus_breaker_1hit' THEN 'malleus_breaker_1hit'
        WHEN 'rush_malleus_breaker_1hit_holding' THEN 'malleus_breaker_1hit_holding'
        WHEN 'rush_falx_crusher_1hit' THEN 'falx_crusher_1hit'
        WHEN 'rush_falx_crusher_1hit_holding' THEN 'falx_crusher_1hit_holding'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'marisa' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_magna_bunker', 'rush_magna_bunker_holding', 'rush_novacula', 'rush_malleus_breaker_1hit', 'rush_malleus_breaker_1hit_holding', 'rush_falx_crusher_1hit', 'rush_falx_crusher_1hit_holding');

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
  UNION ALL SELECT 'standing_heavy_punch_holding', '【ホールド】立ち強P'
  UNION ALL SELECT 'standing_heavy_kick', '立ち強K'
  UNION ALL SELECT 'standing_heavy_kick_holding', '【ホールド】立ち強K'
  UNION ALL SELECT 'crouching_light_punch', 'しゃがみ弱P'
  UNION ALL SELECT 'crouching_light_kick', 'しゃがみ弱K'
  UNION ALL SELECT 'crouching_medium_punch', 'しゃがみ中P'
  UNION ALL SELECT 'crouching_medium_kick', 'しゃがみ中K'
  UNION ALL SELECT 'crouching_heavy_punch', 'しゃがみ強P'
  UNION ALL SELECT 'crouching_heavy_punch_holding', '【ホールド】しゃがみ強P'
  UNION ALL SELECT 'crouching_heavy_kick', 'しゃがみ強K'
  UNION ALL SELECT 'crouching_heavy_kick_holding', '【ホールド】しゃがみ強K'
  UNION ALL SELECT 'jumping_light_punch', 'ジャンプ弱P'
  UNION ALL SELECT 'jumping_light_kick', 'ジャンプ弱K'
  UNION ALL SELECT 'jumping_medium_punch', 'ジャンプ中P'
  UNION ALL SELECT 'jumping_medium_kick', 'ジャンプ中K'
  UNION ALL SELECT 'jumping_heavy_punch', 'ジャンプ強P'
  UNION ALL SELECT 'jumping_heavy_punch_holding', '【ホールド】ジャンプ強P'
  UNION ALL SELECT 'jumping_heavy_kick', 'ジャンプ強K'
  UNION ALL SELECT 'jumping_heavy_kick_holding', '【ホールド】ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'caelum_arc', 'カエルムアーク'
  UNION ALL SELECT 'caelum_arc_holding', '【ホールド】カエルムアーク'
  UNION ALL SELECT 'magna_bunker', 'マグナバンカー'
  UNION ALL SELECT 'magna_bunker_holding', '【ホールド】マグナバンカー'
  UNION ALL SELECT 'novacula', 'ノバキュラ(単発)'
  UNION ALL SELECT 'malleus_breaker_1hit', 'マレウスビート(単発)'
  UNION ALL SELECT 'malleus_breaker_1hit_holding', '【ホールド】マレウスビート(単発)'
  UNION ALL SELECT 'malleus_breaker', 'マレウスビート'
  UNION ALL SELECT 'falx_crusher_1hit', 'ファルクスクラッシュ(単発)'
  UNION ALL SELECT 'falx_crusher_1hit_holding', '【ホールド】ファルクスクラッシュ(単発)'
  UNION ALL SELECT 'falx_crusher', 'ファルクスクラッシュ'
  UNION ALL SELECT 'gladius_light', '弱グラディウス'
  UNION ALL SELECT 'gladius_holding_light', '【ホールド】弱グラディウス'
  UNION ALL SELECT 'gladius_medium', '中グラディウス'
  UNION ALL SELECT 'gladius_holding_medium', '【ホールド】中グラディウス'
  UNION ALL SELECT 'gladius_heavy', '強グラディウス'
  UNION ALL SELECT 'gladius_holding_heavy', '【ホールド】強グラディウス'
  UNION ALL SELECT 'gladius_od', 'ODグラディウス'
  UNION ALL SELECT 'gladius_holding_od', '【ホールド】ODグラディウス'
  UNION ALL SELECT 'dimachaerus_light', '弱ディマカイルス'
  UNION ALL SELECT 'dimachaerus_1hit_light', '弱ディマカイルス(単発)'
  UNION ALL SELECT 'dimachaerus_medium', '中ディマカイルス'
  UNION ALL SELECT 'dimachaerus_1hit_medium', '中ディマカイルス(単発)'
  UNION ALL SELECT 'dimachaerus_heavy', '強ディマカイルス'
  UNION ALL SELECT 'dimachaerus_1hit_heavy', '強ディマカイルス(単発)'
  UNION ALL SELECT 'dimachaerus_od', 'ODディマカイルス'
  UNION ALL SELECT 'dimachaerus_1hit_od', 'ODディマカイルス(単発)'
  UNION ALL SELECT 'phalanx_light', '弱ファランクス'
  UNION ALL SELECT 'phalanx_medium', '中ファランクス'
  UNION ALL SELECT 'phalanx_heavy', '強ファランクス'
  UNION ALL SELECT 'phalanx_od', 'ODファランクス'
  UNION ALL SELECT 'quadriga_light', '弱クアドリガ'
  UNION ALL SELECT 'quadriga_medium', '中クアドリガ'
  UNION ALL SELECT 'quadriga_heavy', '強クアドリガ'
  UNION ALL SELECT 'quadriga_od', 'ODクアドリガ'
  UNION ALL SELECT 'scutum_od', 'ODスクトゥム'
  UNION ALL SELECT 'scutum', 'スクトゥム'
  UNION ALL SELECT 'scutum_max_holding_od', '【最大ホールド】ODスクトゥム'
  UNION ALL SELECT 'scutum_max_holding', '【最大ホールド】スクトゥム'
  UNION ALL SELECT 'scutum_counterattack_od', 'ODスクトゥム(当身)'
  UNION ALL SELECT 'scutum_counterattack', 'スクトゥム(当身)'
  UNION ALL SELECT 'tonitrus_1hit_od', 'ODトニトルス(単発)'
  UNION ALL SELECT 'tonitrus_1hit', 'トニトルス(単発)'
  UNION ALL SELECT 'tonitrus_od', 'ODトニトルス'
  UNION ALL SELECT 'tonitrus', 'トニトルス'
  UNION ALL SELECT 'procella_od', 'ODプロケッラ'
  UNION ALL SELECT 'procella', 'プロケッラ'
  UNION ALL SELECT 'enfold_od', 'ODエンフォルド'
  UNION ALL SELECT 'enfold', 'エンフォルド'
  UNION ALL SELECT 'sa1_javelin_of_marisa', 'SA1 マリーザジャベリン'
  UNION ALL SELECT 'sa1_javelin_of_marisa_holding', '【ホールド】SA1 マリーザジャベリン'
  UNION ALL SELECT 'sa1_javelin_of_marisa_counterattack', 'SA1 マリーザジャベリン(当身)'
  UNION ALL SELECT 'sa2_meteorite', 'SA2 メテオリティス'
  UNION ALL SELECT 'sa3_goddess_of_the_hunt', 'SA3 アポロウーサ'
  UNION ALL SELECT 'ca_goddess_of_the_hunt', 'CA アポロウーサ'
  UNION ALL SELECT 'light_two_hitter', 'ライトワンツー'
  UNION ALL SELECT 'medium_two_hitter', 'ミドルワンツー'
  UNION ALL SELECT 'heavy_two_hitter', 'ヘビィーワンツー'
  UNION ALL SELECT 'volare_combo', 'ヴォラーレコンボ'
  UNION ALL SELECT 'novacula_swipe', 'ノバキュラスワイプ'
  UNION ALL SELECT 'novacula_thrust', 'ノバキュラシュート'
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
  UNION ALL SELECT 'rush_magna_bunker', 'マグナバンカー(ラッシュ)'
  UNION ALL SELECT 'rush_magna_bunker_holding', '【ホールド】マグナバンカー(ラッシュ)'
  UNION ALL SELECT 'rush_novacula', 'ノバキュラ(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_malleus_breaker_1hit', 'マレウスビート(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_malleus_breaker_1hit_holding', '【ホールド】マレウスビート(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_falx_crusher_1hit', 'ファルクスクラッシュ(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_falx_crusher_1hit_holding', '【ホールド】ファルクスクラッシュ(単発)(ラッシュ)'
) AS v
WHERE c.code = 'marisa' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== jp (75 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 6 AS startup, 3 AS active, 18 AS total, 4 AS on_hit, -2 AS on_block, 10 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 3, -2, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 12, 3, 35, 1, -6, 21, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 8, 3, 29, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 12, 2, 35, 3, -3, 22, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 12, 4, 32, 7, 2, 17, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 16, 4, -1, 11, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 6, 2, 17, 2, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 4, 24, 6, -2, 14, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 700, 9, 3, 28, 3, -3, 17, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 9, 6, 34, 1, -6, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 33, NULL, -6, 21, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 10, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 8, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 12, 3, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 600, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 5, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 11, 6, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'tornado', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'guillotinna', 'unique', 700, 22, 2, 42, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'malice', 'unique', 900, 16, 3, 49, NULL, -14, 31, 0, NULL
  UNION ALL SELECT 'bylina', 'unique', 900, 11, 6, 40, NULL, -5, 24, 0, NULL
  UNION ALL SELECT 'grom_strelka_1hit', 'unique', 500, 8, 3, 26, 5, -1, 16, 0, NULL
  UNION ALL SELECT 'grom_strelka', 'target_combo', 1000, 10, 3, 32, 3, -6, 20, 0, NULL
  UNION ALL SELECT 'triglav_light', 'special', 800, 22, 10, 55, NULL, -2, 24, 0, NULL
  UNION ALL SELECT 'triglav_medium', 'special', 800, 22, 10, 55, NULL, -2, 24, 0, NULL
  UNION ALL SELECT 'triglav_heavy', 'special', 800, 22, 10, 55, NULL, -2, 24, 0, NULL
  UNION ALL SELECT 'triglav_od', 'special', 1000, 20, 20, 53, NULL, 3, 14, 0, NULL
  UNION ALL SELECT 'stribog_light', 'special', 1000, 16, 6, 49, NULL, -10, 28, 0, NULL
  UNION ALL SELECT 'stribog_medium', 'special', 1200, 20, 7, 53, NULL, -8, 27, 0, NULL
  UNION ALL SELECT 'stribog_heavy', 'special', 800, 28, 15, 61, NULL, 4, 19, 0, NULL
  UNION ALL SELECT 'stribog_od', 'special', 1000, 19, 12, 52, NULL, 2, 22, 0, NULL
  UNION ALL SELECT 'departure_light', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'departure_medium', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'departure_heavy', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'departure_od', 'special', 0, 1, 40, 40, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'departure_window_double_warp_od', 'special', 0, 49, 20, 87, NULL, NULL, 19, 0, '{"notes_tool":"ODで二連続で使うと1回目のrecoveryが2F減って17になるので別枠として記録"}'
  UNION ALL SELECT 'departure_window', 'special', 0, 6, 20, 44, NULL, NULL, 19, 0, NULL
  UNION ALL SELECT 'departure_shadow_od', 'special', 1000, 20, 21, 40, NULL, 40, 0, 0, NULL
  UNION ALL SELECT 'departure_shadow', 'special', 800, 20, 21, 40, NULL, 10, 0, 0, NULL
  UNION ALL SELECT 'amnesia_od', 'special', 1200, 1, 20, 55, NULL, NULL, 35, 0, NULL
  UNION ALL SELECT 'amnesia', 'special', 800, 3, 18, 55, NULL, NULL, 35, 0, NULL
  UNION ALL SELECT 'torbalan_light', 'special', 800, 22, 6, 50, NULL, -6, 23, 0, NULL
  UNION ALL SELECT 'torbalan_medium', 'special', 1000, 26, 6, 50, 6, -8, 19, 0, NULL
  UNION ALL SELECT 'torbalan_heavy', 'special', 1000, 26, 6, 50, 6, -8, 19, 0, NULL
  UNION ALL SELECT 'torbalan_od', 'special', 800, 22, 27, 50, NULL, 25, 2, 0, NULL
  UNION ALL SELECT 'embrace_od', 'special', 2600, 26, 3, 72, NULL, NULL, 44, 0, NULL
  UNION ALL SELECT 'embrace', 'special', 1800, 26, 3, 72, NULL, NULL, 44, 0, NULL
  UNION ALL SELECT 'sa1_chornobog', 'super_art', 2000, 8, 22, 84, NULL, -33, 55, 0, NULL
  UNION ALL SELECT 'sa2_lovushka', 'super_art', 2000, 1, 13, 13, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa3_interdiction', 'super_art', 4000, 18, 6, 85, NULL, -50, 62, 0, NULL
  UNION ALL SELECT 'ca_interdiction', 'critical_art', 4500, 18, 6, 85, NULL, -50, 62, 0, NULL
  UNION ALL SELECT 'zilant', 'target_combo', 1300, 20, 3, 42, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'zilant_mid', 'target_combo', 1000, 21, 3, 45, 3, -4, 22, 0, '{"notes_tool":"コンボにならないので単発ダメージ"}'
  UNION ALL SELECT 'zilant_low', 'target_combo', 1000, 21, 3, 45, 3, -4, 22, 0, '{"notes_tool":"コンボにならないので単発ダメージ"}'
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 17, 3, 29, 8, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 7, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 23, 3, 46, 5, -2, 21, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 19, 3, 40, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 23, 2, 46, 7, 1, 22, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 23, 4, 43, 11, 6, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 27, 8, 3, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 17, 2, 28, 6, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 4, 35, 10, 2, 14, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 700, 20, 3, 39, 7, 1, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 20, 6, 45, 5, -2, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 44, NULL, -2, 21, 0, NULL
  UNION ALL SELECT 'rush_guillotinna', 'rush_variant', 700, 33, 2, 53, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_malice', 'rush_variant', 900, 27, 3, 60, NULL, -10, 31, 0, NULL
  UNION ALL SELECT 'rush_bylina', 'rush_variant', 900, 22, 6, 51, NULL, -1, 24, 0, NULL
  UNION ALL SELECT 'rush_grom_strelka_1hit', 'rush_variant', 500, 19, 3, 37, 9, 3, 16, 0, NULL
) AS v
WHERE c.code = 'jp' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_guillotinna' THEN 'guillotinna'
        WHEN 'rush_malice' THEN 'malice'
        WHEN 'rush_bylina' THEN 'bylina'
        WHEN 'rush_grom_strelka_1hit' THEN 'grom_strelka_1hit'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'jp' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_guillotinna', 'rush_malice', 'rush_bylina', 'rush_grom_strelka_1hit');

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
  UNION ALL SELECT 'tornado', 'タルナード'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'guillotinna', 'ギリオチーナ'
  UNION ALL SELECT 'malice', 'シャーロスチ'
  UNION ALL SELECT 'bylina', 'ヴィリーナ'
  UNION ALL SELECT 'grom_strelka_1hit', 'グロームストレルカ(単発)'
  UNION ALL SELECT 'grom_strelka', 'グロームストレルカ'
  UNION ALL SELECT 'triglav_light', '弱トリグラフ'
  UNION ALL SELECT 'triglav_medium', '中トリグラフ'
  UNION ALL SELECT 'triglav_heavy', '強トリグラフ'
  UNION ALL SELECT 'triglav_od', 'ODトリグラフ'
  UNION ALL SELECT 'stribog_light', '弱ストリボーグ'
  UNION ALL SELECT 'stribog_medium', '中ストリボーグ'
  UNION ALL SELECT 'stribog_heavy', '強ストリボーグ'
  UNION ALL SELECT 'stribog_od', 'ODストリボーグ'
  UNION ALL SELECT 'departure_light', '弱ヴィーハト'
  UNION ALL SELECT 'departure_medium', '中ヴィーハト'
  UNION ALL SELECT 'departure_heavy', '強ヴィーハト'
  UNION ALL SELECT 'departure_od', 'ODヴィーハト'
  UNION ALL SELECT 'departure_window_double_warp_od', 'ODヴィーハト・アクノ(二連続ワープ)'
  UNION ALL SELECT 'departure_window', 'ヴィーハト・アクノ'
  UNION ALL SELECT 'departure_shadow_od', 'ODヴィーハト・チェーニ'
  UNION ALL SELECT 'departure_shadow', 'ヴィーハト・チェーニ'
  UNION ALL SELECT 'amnesia_od', 'ODアムネジア'
  UNION ALL SELECT 'amnesia', 'アムネジア'
  UNION ALL SELECT 'torbalan_light', '弱トルバラン'
  UNION ALL SELECT 'torbalan_medium', '中トルバラン'
  UNION ALL SELECT 'torbalan_heavy', '強トルバラン'
  UNION ALL SELECT 'torbalan_od', 'ODトルバラン'
  UNION ALL SELECT 'embrace_od', 'ODアブニマーチ'
  UNION ALL SELECT 'embrace', 'アブニマーチ'
  UNION ALL SELECT 'sa1_chornobog', 'SA1 チェルノボーグ'
  UNION ALL SELECT 'sa2_lovushka', 'SA2 ラヴーシュカ'
  UNION ALL SELECT 'sa3_interdiction', 'SA3 ザプリェット'
  UNION ALL SELECT 'ca_interdiction', 'CA ザプリェット'
  UNION ALL SELECT 'zilant', 'ジラント'
  UNION ALL SELECT 'zilant_mid', 'ジラントルカー'
  UNION ALL SELECT 'zilant_low', 'ジラントナガー'
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
  UNION ALL SELECT 'rush_guillotinna', 'ギリオチーナ(ラッシュ)'
  UNION ALL SELECT 'rush_malice', 'シャーロスチ(ラッシュ)'
  UNION ALL SELECT 'rush_bylina', 'ヴィリーナ(ラッシュ)'
  UNION ALL SELECT 'rush_grom_strelka_1hit', 'グロームストレルカ(単発)(ラッシュ)'
) AS v
WHERE c.code = 'jp' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

