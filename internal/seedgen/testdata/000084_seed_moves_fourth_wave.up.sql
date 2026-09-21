-- 000084_seed_moves_fourth_wave.up.sql
-- M14-03f: 第四波 14 キャラ(未 seed 12 + 仮登録 2)の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(第四波)。
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 移動 system move は CSV に無い(seed の投入元は 000004_data_seed_moves)。
-- FK 依存順 characters→moves→preset_aliases。

-- ===== aki (72 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 2 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 3, 18, 3, -3, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 5, 26, 3, -3, 16, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 8, 3, 27, 6, -2, 17, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 12, 3, 35, 1, -4, 21, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 9, 4, 31, 4, -3, 19, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 14, 4, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 15, 3, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 3, 27, 1, -3, 18, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 7, 3, 25, 5, 1, 16, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 10, 3, 40, NULL, -8, 28, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 6, 35, 0, -3, 20, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 9, 46, NULL, NULL, 33, 1, '{"notes_tool":"通常飛びが45と他キャラクターより2多い。なので硬直が増えるジャンプ攻撃の全体も48になる。ジャンプ攻撃系は全部同じ。"}'
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 600, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 11, 6, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 8, 8, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'pu_lao', 'unique', 600, 24, 3, 44, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'chi_wen', 'unique', 900, 16, 4, 40, 3, -3, 21, 0, NULL
  UNION ALL SELECT 'qiu_niu', 'unique', 800, 14, 11, 48, 4, 2, 24, 0, NULL
  UNION ALL SELECT 'gong_fu', 'unique', 800, 9, 5, 48, NULL, NULL, 35, 1, '{"notes_tool":"ジャンプ攻撃と同じ系列の特殊技"}'
  UNION ALL SELECT 'nightshade_pulse_od', 'special', 774, 16, 29, 44, NULL, 1, 0, 0, NULL
  UNION ALL SELECT 'nightshade_pulse', 'special', 531, 17, 36, 52, -5, -10, 0, 0, NULL
  UNION ALL SELECT 'nightshade_chaser_od', 'special', 668, 48, 5, 80, NULL, -13, 28, 0, '{"notes_tool":"OD紫煙砲から派生、派生部分のみ当たったフレームとダメージを記載"}'
  UNION ALL SELECT 'nightshade_chaser', 'special', 531, 43, 2, 78, -4, -16, 34, 0, '{"notes_tool":"紫煙追から派生、派生部分のみ当たったフレームとダメージを記載"}'
  UNION ALL SELECT 'orchid_spring', 'special', 0, 1, 46, 46, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'toxic_wreath', 'special', 891, 13, 26, 51, NULL, -4, 13, 0, NULL
  UNION ALL SELECT 'serpent_lash_light', 'special', 536, 14, 3, 42, 1, -8, 26, 0, '{"notes_tool":"以下、全ての技についてだが、毒なし状態でのフレームとダメージを記載"}'
  UNION ALL SELECT 'serpent_lash_medium', 'special', 686, 14, 9, 43, NULL, -12, 21, 0, NULL
  UNION ALL SELECT 'serpent_lash_heavy', 'special', 796, 11, 6, 48, NULL, -20, 32, 0, NULL
  UNION ALL SELECT 'serpent_lash_od', 'special', 630, 21, 5, 50, 4, -14, 25, 0, NULL
  UNION ALL SELECT 'cruel_fate_light', 'special', 800, 24, 22, 63, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'cruel_fate_medium', 'special', 900, 28, 22, 67, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'cruel_fate_heavy', 'special', 1000, 33, 22, 72, 4, -3, 18, 0, NULL
  UNION ALL SELECT 'cruel_fate_od', 'special', 1732, 28, 22, 67, NULL, 2, 18, 0, NULL
  UNION ALL SELECT 'snake_step_light', 'special', 0, 1, 37, 37, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'snake_step_medium', 'special', 0, 1, 39, 39, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'snake_step_heavy', 'special', 0, 1, 43, 43, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'snake_step_side_switch_heavy', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'snake_step_od', 'special', 0, 1, 34, 42, NULL, NULL, 8, 0, NULL
  UNION ALL SELECT 'snake_step_side_switch_od', 'special', 0, 1, 48, 48, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sinister_slide', 'special', 0, 1, 216, 216, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sinister_slide_cancel', 'special', 0, 1, 49, 49, NULL, NULL, 0, 0, '{"notes_tool":"上入力で最速解除時"}'
  UNION ALL SELECT 'venomous_fang', 'special', 1178, 30, 15, 74, NULL, -25, 30, 0, '{"notes_tool":"Sinister Slideから派生"}'
  UNION ALL SELECT 'heel_strike', 'special', 600, 22, 15, 56, 4, -3, 20, 0, '{"notes_tool":"Sinister Slideから派生"}'
  UNION ALL SELECT 'entrapment', 'special', 1852, 34, 3, 91, NULL, NULL, 55, 0, '{"notes_tool":"Sinister Slideから派生"}'
  UNION ALL SELECT 'sa1_deadly_implication', 'super_art', 1876, 10, 3, 80, NULL, -46, 68, 0, NULL
  UNION ALL SELECT 'sa2_tainted_talons', 'super_art', 2671, 7, 93, 153, NULL, -19, 54, 0, NULL
  UNION ALL SELECT 'sa3_claws_of_ya_zi', 'super_art', 4000, 10, 3, 70, NULL, -36, 58, 0, NULL
  UNION ALL SELECT 'ca_claws_of_ya_zi', 'critical_art', 4500, 10, 3, 70, NULL, -36, 58, 0, NULL
  UNION ALL SELECT 'hun_dun', 'target_combo', 540, 8, 2, 24, 1, -3, 15, 0, NULL
  UNION ALL SELECT 'qiong_qi', 'target_combo', 1284, 14, 3, 40, NULL, -15, 24, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 2, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 3, 29, 7, 1, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 5, 37, 7, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 19, 3, 38, 10, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 23, 3, 46, 5, 0, 21, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 20, 4, 42, 8, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 25, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 26, 7, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 3, 38, 5, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 18, 3, 36, 9, 5, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 21, 3, 51, NULL, -4, 28, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 6, 46, 4, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_pu_lao', 'rush_variant', 600, 35, 3, 55, 7, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_chi_wen', 'rush_variant', 900, 27, 4, 50, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_qiu_niu', 'rush_variant', 800, 25, 11, 59, 8, 6, 24, 0, NULL
) AS v
WHERE c.code = 'aki' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_pu_lao' THEN 'pu_lao'
        WHEN 'rush_chi_wen' THEN 'chi_wen'
        WHEN 'rush_qiu_niu' THEN 'qiu_niu'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'aki' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_pu_lao', 'rush_chi_wen', 'rush_qiu_niu');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'pu_lao', '蒲牢'
  UNION ALL SELECT 'chi_wen', '螭吻'
  UNION ALL SELECT 'qiu_niu', '囚牛'
  UNION ALL SELECT 'gong_fu', '蚣蝮'
  UNION ALL SELECT 'nightshade_pulse_od', 'OD紫煙砲'
  UNION ALL SELECT 'nightshade_pulse', '紫煙砲'
  UNION ALL SELECT 'nightshade_chaser_od', 'OD紫煙追'
  UNION ALL SELECT 'nightshade_chaser', '紫煙追'
  UNION ALL SELECT 'orchid_spring', '紫泡泉'
  UNION ALL SELECT 'toxic_wreath', '紫泡撒'
  UNION ALL SELECT 'serpent_lash_light', '弱蛇頭鞭'
  UNION ALL SELECT 'serpent_lash_medium', '中蛇頭鞭'
  UNION ALL SELECT 'serpent_lash_heavy', '強蛇頭鞭'
  UNION ALL SELECT 'serpent_lash_od', 'OD蛇頭鞭'
  UNION ALL SELECT 'cruel_fate_light', '弱凶襲突'
  UNION ALL SELECT 'cruel_fate_medium', '中凶襲突'
  UNION ALL SELECT 'cruel_fate_heavy', '強凶襲突'
  UNION ALL SELECT 'cruel_fate_od', 'OD凶襲突'
  UNION ALL SELECT 'snake_step_light', '弱蛇軽功'
  UNION ALL SELECT 'snake_step_medium', '中蛇軽功'
  UNION ALL SELECT 'snake_step_heavy', '強蛇軽功'
  UNION ALL SELECT 'snake_step_side_switch_heavy', '強蛇軽功(裏回り)'
  UNION ALL SELECT 'snake_step_od', 'OD蛇軽功'
  UNION ALL SELECT 'snake_step_side_switch_od', 'OD蛇軽功(裏回り)'
  UNION ALL SELECT 'sinister_slide', '悪鬼蛇行'
  UNION ALL SELECT 'sinister_slide_cancel', '悪鬼蛇行(解除)'
  UNION ALL SELECT 'venomous_fang', '猛毒牙'
  UNION ALL SELECT 'heel_strike', '蛇連咬'
  UNION ALL SELECT 'entrapment', '雁字搦'
  UNION ALL SELECT 'sa1_deadly_implication', 'SA1 死屍累々'
  UNION ALL SELECT 'sa2_tainted_talons', 'SA2 紫煙裂爪'
  UNION ALL SELECT 'sa3_claws_of_ya_zi', 'SA3 睚眦'
  UNION ALL SELECT 'ca_claws_of_ya_zi', 'CA 睚眦'
  UNION ALL SELECT 'hun_dun', '渾沌'
  UNION ALL SELECT 'qiong_qi', '窮奇'
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
  UNION ALL SELECT 'rush_pu_lao', '蒲牢(ラッシュ)'
  UNION ALL SELECT 'rush_chi_wen', '螭吻(ラッシュ)'
  UNION ALL SELECT 'rush_qiu_niu', '囚牛(ラッシュ)'
) AS v
WHERE c.code = 'aki' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== akuma (107 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 2, -4, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 4, 22, 4, 1, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 7, 5, 26, 3, -3, 15, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 5, 31, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 13, 15, 43, 7, 3, 16, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 14, 5, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 3, -3, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 3, 24, 6, -1, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, 0, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 8, 8, 34, 1, -8, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 3, 34, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 10, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 4, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 12, 6, 46, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'skull_splitter', 'unique', 600, 20, 5, 42, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'resso_snap_kick', 'unique', 700, 10, 3, 31, 5, -4, 19, 0, NULL
  UNION ALL SELECT 'rago_high_kick', 'unique', 800, 12, 5, 43, NULL, -15, 27, 0, NULL
  UNION ALL SELECT 'viscera_piercer', 'target_combo', 1300, 7, 3, 30, -1, -6, 21, 0, NULL
  UNION ALL SELECT 'bone_crusher_axe_kick', 'target_combo', 2400, 20, 3, 42, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'kikoku_combination_1hit', 'unique', 800, 13, 4, 36, 4, -3, 20, 0, NULL
  UNION ALL SELECT 'kikoku_combination_2hits', 'target_combo', 1400, 10, 3, 36, NULL, -10, 24, 0, NULL
  UNION ALL SELECT 'kikoku_combination', 'target_combo', 2100, 9, 3, 35, NULL, -13, 24, 0, NULL
  UNION ALL SELECT 'tenmaku_blade_kick', 'unique', 800, 33, 13, 58, 2, -3, 13, 1, '{"notes_tool":"前ジャンプから。最速でも当たる。端、立ち相手でヒット、ガードフレームは計測。"}'
  UNION ALL SELECT 'gou_hadoken_light', 'special', 700, 16, 31, 46, 0, -4, 0, 0, '{"notes_tool":"公式はLv1記載かも"}'
  UNION ALL SELECT 'gou_hadoken_medium', 'special', 700, 14, 33, 46, -2, -6, 0, 0, '{"notes_tool":"公式はLv1記載かも"}'
  UNION ALL SELECT 'gou_hadoken_heavy', 'special', 700, 12, 35, 46, -4, -8, 0, 0, '{"notes_tool":"公式はLv1記載かも"}'
  UNION ALL SELECT 'gou_hadoken_od', 'special', 1000, 12, 30, 41, NULL, 2, 0, 0, '{"notes_tool":"公式はLv1記載かも"}'
  UNION ALL SELECT 'gou_hadoken_holding_light', 'special', 1000, 31, 30, 60, NULL, 2, 0, 0, '{"notes_tool":"公式はLv2記載かも"}'
  UNION ALL SELECT 'gou_hadoken_holding_medium', 'special', 1000, 31, 30, 60, NULL, 2, 0, 0, '{"notes_tool":"公式はLv2記載かも"}'
  UNION ALL SELECT 'gou_hadoken_holding_heavy', 'special', 1000, 31, 30, 60, NULL, 2, 0, 0, '{"notes_tool":"公式はLv2記載かも"}'
  UNION ALL SELECT 'gou_hadoken_holding_od', 'special', 1350, 31, 27, 57, NULL, 21, 0, 0, '{"notes_tool":"公式はLv2記載かも"}'
  UNION ALL SELECT 'gou_hadoken_max_holding_light', 'special', 1350, 56, 27, 82, NULL, 21, 0, 0, '{"notes_tool":"公式はLv3記載かも"}'
  UNION ALL SELECT 'gou_hadoken_max_holding_medium', 'special', 1350, 56, 27, 82, NULL, 21, 0, 0, '{"notes_tool":"公式はLv3記載かも"}'
  UNION ALL SELECT 'gou_hadoken_max_holding_heavy', 'special', 1350, 56, 27, 82, NULL, 21, 0, 0, '{"notes_tool":"公式はLv3記載かも"}'
  UNION ALL SELECT 'zanku_hadoken_light', 'special', 600, 25, 35, 59, NULL, NULL, 0, 0, '{"notes_tool":"前ジャンプから。ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'zanku_hadoken_medium', 'special', 600, 25, 35, 59, NULL, NULL, 0, 0, '{"notes_tool":"前ジャンプから。ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'zanku_hadoken_heavy', 'special', 600, 25, 35, 59, NULL, NULL, 0, 0, '{"notes_tool":"前ジャンプから。ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'zanku_hadoken_od', 'special', 900, 18, 48, 66, NULL, NULL, 1, 0, '{"notes_tool":"前か垂直ジャンプから。ジャンプ種別はフレームに影響しない。ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'gou_shoryuken_light', 'special', 1100, 5, 10, 47, NULL, -23, 33, 0, NULL
  UNION ALL SELECT 'gou_shoryuken_medium', 'special', 1300, 6, 10, 57, NULL, -30, 42, 0, NULL
  UNION ALL SELECT 'gou_shoryuken_heavy', 'special', 1500, 7, 11, 67, NULL, -36, 50, 0, NULL
  UNION ALL SELECT 'gou_shoryuken_od', 'special', 1700, 6, 11, 68, NULL, -41, 52, 0, NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_light', 'special', 600, 12, 2, 40, NULL, -13, 27, 0, NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_medium', 'special', 1000, 11, 18, 58, NULL, -13, 30, 0, NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_heavy', 'special', 1600, 7, 45, 92, NULL, -59, 41, 0, NULL
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_od', 'special', 1000, 13, 25, 63, NULL, -17, 26, 0, NULL
  UNION ALL SELECT 'aerial_tatsumaki_zanku_kyaku_od', 'special', 1300, 20, 18, 71, NULL, NULL, 34, 0, '{"notes_tool":"前ジャンプから。最速あたらない"}'
  UNION ALL SELECT 'aerial_tatsumaki_zanku_kyaku', 'special', 900, 20, 16, 88, NULL, NULL, 53, 0, '{"notes_tool":"前ジャンプから。最速あたらない"}'
  UNION ALL SELECT 'adamant_flame_1hit_light', 'special', 700, 15, 3, 40, 1, -8, 23, 0, NULL
  UNION ALL SELECT 'adamant_flame_1hit_medium', 'special', 800, 19, 3, 44, 2, -4, 23, 0, NULL
  UNION ALL SELECT 'adamant_flame_1hit_heavy', 'special', 900, 23, 3, 46, 3, -3, 21, 0, NULL
  UNION ALL SELECT 'adamant_flame_1hit_od', 'special', 700, 18, 3, 43, 1, -3, 23, 0, NULL
  UNION ALL SELECT 'adamant_flame_light', 'special', 1200, 7, 4, 28, 3, -10, 18, 0, '{"notes_tool":"同じ強度の単発版から派生。空振りで出ないターゲットコンボ風で、フレームはstandaloneでダメージは通し。"}'
  UNION ALL SELECT 'adamant_flame_medium', 'special', 1400, 7, 4, 42, NULL, -18, 32, 0, '{"notes_tool":"同じ強度の単発版から派生。空振りで出ないターゲットコンボ風で、フレームはstandaloneでダメージは通し。"}'
  UNION ALL SELECT 'adamant_flame_heavy', 'special', 1500, 11, 4, 42, NULL, -14, 28, 0, '{"notes_tool":"同じ強度の単発版から派生。空振りで出ないターゲットコンボ風で、フレームはstandaloneでダメージは通し。"}'
  UNION ALL SELECT 'adamant_flame_od', 'special', 1260, 7, 11, 42, NULL, -18, 25, 0, '{"notes_tool":"同じ強度の単発版から派生。空振りで出ないターゲットコンボ風で、フレームはstandaloneでダメージは通し。"}'
  UNION ALL SELECT 'demon_raid_light', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'demon_raid_medium', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'demon_raid_heavy', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'demon_raid_od', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'demon_low_slash_od', 'special', 1000, 53, 4, 75, NULL, 2, 19, 0, '{"notes_tool":"OD百鬼襲から派生。裏回りしてもフレーム変化なし"}'
  UNION ALL SELECT 'demon_low_slash', 'special', 1000, 53, 4, 75, NULL, 2, 19, 0, '{"notes_tool":"弱中強百鬼襲から派生。派生元フレーム影響なし。裏回りしてもフレーム変化なし。"}'
  UNION ALL SELECT 'demon_guillotine_od', 'special', 1300, 32, 6, 46, NULL, 5, 9, 0, '{"notes_tool":"OD百鬼襲から派生。派生元フレーム影響なし。裏回りしてもフレーム変化なし"}'
  UNION ALL SELECT 'demon_guillotine', 'special', 1300, 34, 7, 49, NULL, 4, 9, 0, '{"notes_tool":"弱中強百鬼襲から派生。派生元フレーム影響なし。裏回りすると強だけフレーム変化。"}'
  UNION ALL SELECT 'demon_guillotine_side_switch', 'special', 0, 36, 7, 51, NULL, NULL, 9, 0, '{"notes_tool":"強百鬼襲派生で裏回りした時限定。相手には当たらないので最速不可。"}'
  UNION ALL SELECT 'demon_blade_kick_od', 'special', 700, 29, 10, 52, 1, -4, 14, 0, '{"notes_tool":"OD百鬼襲から派生。派生元フレーム影響なし。なお押したキックボタンによって性能が変わるが、フレーム影響ないので省略。modifierなどでユーザーは記録する。"}'
  UNION ALL SELECT 'demon_blade_kick', 'special', 700, 31, 11, 55, 1, -4, 14, 0, '{"notes_tool":"弱中強百鬼襲から派生。派生元フレーム影響なし。裏回りすると強だけフレーム変化。。なお押したキックボタンによって性能が変わるが、フレーム影響ないので省略。modifierなどでユーザーは記録する。"}'
  UNION ALL SELECT 'demon_blade_kick_side_switch', 'special', 0, 33, 12, 58, NULL, NULL, 14, 0, '{"notes_tool":"強百鬼襲派生で裏回りした時限定。相手には当たらないので最速不可。。なお押したキックボタンによって性能が変わるが、フレーム影響ないので省略。modifierなどでユーザーは記録する。"}'
  UNION ALL SELECT 'demon_swoop_od', 'special', 0, 1, 45, 45, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'demon_swoop_side_switch_od', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'demon_swoop', 'special', 0, 1, 45, 45, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'demon_swoop_side_switch', 'special', 0, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'demon_gou_zanku', 'special', 900, 22, 50, 71, NULL, NULL, 0, 0, '{"notes_tool":"ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'demon_gou_rasen', 'special', 1300, 21, 19, 66, NULL, NULL, 27, 0, '{"notes_tool":"ヒット、ガードフレーム計測が難しいので、省略。"}'
  UNION ALL SELECT 'ashura_senku_forward', 'special', 0, 1, 51, 51, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'ashura_senku_backward', 'special', 0, 1, 49, 49, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'oboro_throw', 'special', 2200, 29, 3, 81, NULL, NULL, 50, 0, '{"notes_tool":"阿修羅閃空(前方)から派生"}'
  UNION ALL SELECT 'sa1_messatsu_gohado', 'super_art', 2200, 10, 40, 106, NULL, -41, 57, 0, NULL
  UNION ALL SELECT 'sa1_tenma_gozanku', 'super_art', 2000, 26, 30, 92, NULL, -26, 37, 0, '{"notes_tool":"前、垂直ジャンプから。"}'
  UNION ALL SELECT 'sa2_empyreans_end', 'super_art', 2800, 9, 3, 63, NULL, -35, 52, 0, NULL
  UNION ALL SELECT 'sa3_sip_of_calamity', 'super_art', 4000, 8, 4, 69, NULL, -41, 58, 0, NULL
  UNION ALL SELECT 'ca_sip_of_calamity', 'critical_art', 4500, 8, 4, 69, NULL, -41, 58, 0, NULL
  UNION ALL SELECT 'ca_shun_goku_satsu', 'critical_art', 4700, 6, 22, 84, NULL, NULL, 57, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 6, 0, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 4, 33, 8, 5, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 18, 5, 37, 7, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 5, 42, 7, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 24, 15, 54, 11, 7, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 25, 9, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 7, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 3, 35, 10, 3, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 4, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 19, 8, 45, 5, -4, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 3, 45, NULL, -8, 23, 0, NULL
  UNION ALL SELECT 'rush_skull_splitter', 'rush_variant', 600, 31, 5, 53, 7, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_resso_snap_kick', 'rush_variant', 700, 21, 3, 42, 9, 0, 19, 0, NULL
  UNION ALL SELECT 'rush_rago_high_kick', 'rush_variant', 800, 23, 5, 54, NULL, -11, 27, 0, NULL
  UNION ALL SELECT 'rush_kikoku_combination_1hit', 'rush_variant', 800, 24, 4, 47, 8, 1, 20, 0, NULL
) AS v
WHERE c.code = 'akuma' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_skull_splitter' THEN 'skull_splitter'
        WHEN 'rush_resso_snap_kick' THEN 'resso_snap_kick'
        WHEN 'rush_rago_high_kick' THEN 'rago_high_kick'
        WHEN 'rush_kikoku_combination_1hit' THEN 'kikoku_combination_1hit'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'akuma' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_skull_splitter', 'rush_resso_snap_kick', 'rush_rago_high_kick', 'rush_kikoku_combination_1hit');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'skull_splitter', '頭蓋破殺'
  UNION ALL SELECT 'resso_snap_kick', '裂槍脚'
  UNION ALL SELECT 'rago_high_kick', '羅豪脚'
  UNION ALL SELECT 'viscera_piercer', '六腑穿ち'
  UNION ALL SELECT 'bone_crusher_axe_kick', '骸斬り'
  UNION ALL SELECT 'kikoku_combination_1hit', '鬼哭連撃(単発)'
  UNION ALL SELECT 'kikoku_combination_2hits', '鬼哭連撃(2発止め)'
  UNION ALL SELECT 'kikoku_combination', '鬼哭連撃'
  UNION ALL SELECT 'tenmaku_blade_kick', '天魔空刃脚'
  UNION ALL SELECT 'gou_hadoken_light', '弱豪波動拳'
  UNION ALL SELECT 'gou_hadoken_medium', '中豪波動拳'
  UNION ALL SELECT 'gou_hadoken_heavy', '強豪波動拳'
  UNION ALL SELECT 'gou_hadoken_od', 'OD豪波動拳'
  UNION ALL SELECT 'gou_hadoken_holding_light', '【ホールド】弱豪波動拳'
  UNION ALL SELECT 'gou_hadoken_holding_medium', '【ホールド】中豪波動拳'
  UNION ALL SELECT 'gou_hadoken_holding_heavy', '【ホールド】強豪波動拳'
  UNION ALL SELECT 'gou_hadoken_holding_od', '【ホールド】OD豪波動拳'
  UNION ALL SELECT 'gou_hadoken_max_holding_light', '【最大ホールド】弱豪波動拳'
  UNION ALL SELECT 'gou_hadoken_max_holding_medium', '【最大ホールド】中豪波動拳'
  UNION ALL SELECT 'gou_hadoken_max_holding_heavy', '【最大ホールド】強豪波動拳'
  UNION ALL SELECT 'zanku_hadoken_light', '弱斬空波動拳'
  UNION ALL SELECT 'zanku_hadoken_medium', '中斬空波動拳'
  UNION ALL SELECT 'zanku_hadoken_heavy', '強斬空波動拳'
  UNION ALL SELECT 'zanku_hadoken_od', 'OD斬空波動拳'
  UNION ALL SELECT 'gou_shoryuken_light', '弱豪昇竜拳'
  UNION ALL SELECT 'gou_shoryuken_medium', '中豪昇竜拳'
  UNION ALL SELECT 'gou_shoryuken_heavy', '強豪昇竜拳'
  UNION ALL SELECT 'gou_shoryuken_od', 'OD豪昇竜拳'
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_light', '弱竜巻斬空脚'
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_medium', '中竜巻斬空脚'
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_heavy', '強竜巻斬空脚'
  UNION ALL SELECT 'tatsumaki_zanku_kyaku_od', 'OD竜巻斬空脚'
  UNION ALL SELECT 'aerial_tatsumaki_zanku_kyaku_od', 'OD空中竜巻斬空脚'
  UNION ALL SELECT 'aerial_tatsumaki_zanku_kyaku', '空中竜巻斬空脚'
  UNION ALL SELECT 'adamant_flame_1hit_light', '弱金剛灼火(単発)'
  UNION ALL SELECT 'adamant_flame_1hit_medium', '中金剛灼火(単発)'
  UNION ALL SELECT 'adamant_flame_1hit_heavy', '強金剛灼火(単発)'
  UNION ALL SELECT 'adamant_flame_1hit_od', 'OD金剛灼火(単発)'
  UNION ALL SELECT 'adamant_flame_light', '弱金剛灼火'
  UNION ALL SELECT 'adamant_flame_medium', '中金剛灼火'
  UNION ALL SELECT 'adamant_flame_heavy', '強金剛灼火'
  UNION ALL SELECT 'adamant_flame_od', 'OD金剛灼火'
  UNION ALL SELECT 'demon_raid_light', '弱百鬼襲'
  UNION ALL SELECT 'demon_raid_medium', '中百鬼襲'
  UNION ALL SELECT 'demon_raid_heavy', '強百鬼襲'
  UNION ALL SELECT 'demon_raid_od', 'OD百鬼襲'
  UNION ALL SELECT 'demon_low_slash_od', 'OD百鬼豪斬'
  UNION ALL SELECT 'demon_low_slash', '百鬼豪斬'
  UNION ALL SELECT 'demon_guillotine_od', 'OD百鬼豪衝'
  UNION ALL SELECT 'demon_guillotine', '百鬼豪衝'
  UNION ALL SELECT 'demon_guillotine_side_switch', '百鬼豪衝(強百鬼襲・裏回り)'
  UNION ALL SELECT 'demon_blade_kick_od', 'OD百鬼豪刃'
  UNION ALL SELECT 'demon_blade_kick', '百鬼豪刃'
  UNION ALL SELECT 'demon_blade_kick_side_switch', '百鬼豪刃(強百鬼襲・裏回り)'
  UNION ALL SELECT 'demon_swoop_od', 'OD百鬼潜影'
  UNION ALL SELECT 'demon_swoop_side_switch_od', 'OD百鬼潜影(裏回り)'
  UNION ALL SELECT 'demon_swoop', '百鬼潜影'
  UNION ALL SELECT 'demon_swoop_side_switch', '百鬼潜影(中強百鬼襲・裏回り)'
  UNION ALL SELECT 'demon_gou_zanku', '百鬼豪斬空'
  UNION ALL SELECT 'demon_gou_rasen', '百鬼豪螺旋'
  UNION ALL SELECT 'ashura_senku_forward', '阿修羅閃空(前方)'
  UNION ALL SELECT 'ashura_senku_backward', '阿修羅閃空(後方)'
  UNION ALL SELECT 'oboro_throw', '朧'
  UNION ALL SELECT 'sa1_messatsu_gohado', 'SA1 滅殺豪波動'
  UNION ALL SELECT 'sa1_tenma_gozanku', 'SA1 天魔豪斬空'
  UNION ALL SELECT 'sa2_empyreans_end', 'SA2 崩天劫火'
  UNION ALL SELECT 'sa3_sip_of_calamity', 'SA3 禍坏'
  UNION ALL SELECT 'ca_sip_of_calamity', 'CA 禍坏'
  UNION ALL SELECT 'ca_shun_goku_satsu', 'CA 瞬獄殺'
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
  UNION ALL SELECT 'rush_skull_splitter', '頭蓋破殺(ラッシュ)'
  UNION ALL SELECT 'rush_resso_snap_kick', '裂槍脚(ラッシュ)'
  UNION ALL SELECT 'rush_rago_high_kick', '羅豪脚(ラッシュ)'
  UNION ALL SELECT 'rush_kikoku_combination_1hit', '鬼哭連撃(単発)(ラッシュ)'
) AS v
WHERE c.code = 'akuma' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== alex (98 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 2 AS active, 14 AS total, 5 AS on_hit, -1 AS on_block, 9 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 6, 2, 20, 1, -5, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 7, 4, 27, 4, 0, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 9, 3, 30, 3, -4, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 12, 5, 35, 4, -3, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch_holding', 'normal', 1000, 23, 3, 47, 5, 2, 22, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 16, 3, 41, 1, -4, 23, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick_holding', 'normal', 1000, 25, 3, 47, NULL, 2, 20, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 5, 3, 15, 5, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 18, 2, -2, 11, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 8, 2, 29, 1, -2, 20, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 8, 3, 28, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 9, 6, 36, -3, -6, 22, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 1000, 10, 3, 38, NULL, -11, 26, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 8, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 9, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 700, 8, 7, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'illegal_knees', 'throw', 1300, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'prowler_stance', 'unique', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Prowler Stance CancelからDangerous Armbarが派生技。タイミング自由で全体等の概念がない。発生もインゲームでは計測できない。派生技は全て構えてからの最速行動で計測"}'
  UNION ALL SELECT 'prowler_stance_cancel', 'unique', 0, 1, 42, 42, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'low_rush', 'unique', 0, 1, 38, 38, NULL, NULL, 0, 0, '{"notes_tool":"ステップインから最速で技出して計測。なお恐らくバグがあり、タクティカルリープとエアスタンピートを最速で出す場合だけ、total35になる"}'
  UNION ALL SELECT 'low_retreat', 'unique', 0, 1, 49, 49, NULL, NULL, 0, 0, '{"notes_tool":"ステップアウトから最速で技出して計測"}'
  UNION ALL SELECT 'light_slashing_elbow', 'unique', 1000, 30, 4, 51, 3, -1, 18, 0, NULL
  UNION ALL SELECT 'medium_slashing_elbow', 'unique', 1000, 33, 4, 54, 3, -1, 18, 0, NULL
  UNION ALL SELECT 'heavy_slashing_elbow', 'unique', 1000, 36, 4, 57, 3, -1, 18, 0, NULL
  UNION ALL SELECT 'palm_jab', 'unique', 300, 22, 3, 57, -17, -23, 33, 0, '{"notes_tool":"技を出して即ブレイカー・スタンス解除のフレーム。解除をしないと構えが継続するので本来はより複雑だが扱わない。連続キャンセルが出来る技だが、複雑なので今はセットプレイで取り扱わない"}'
  UNION ALL SELECT 'shoulder_launcher', 'unique', 800, 25, 7, 48, NULL, -6, 17, 0, NULL
  UNION ALL SELECT 'heavy_lariat', 'unique', 1000, 30, 3, 51, 6, 3, 19, 0, NULL
  UNION ALL SELECT 'heavy_lariat_holding', 'unique', 1200, 39, 3, 60, 6, 5, 19, 0, NULL
  UNION ALL SELECT 'tactical_hop', 'unique', 0, 1, 57, 57, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'air_stampede', 'unique', 1100, 48, 2, 66, NULL, 2, 17, 0, NULL
  UNION ALL SELECT 'sweep_combination_1hit', 'unique', 600, 29, 3, 85, NULL, -41, 54, 0, '{"notes_tool":"技を出して即ブレイカー・スタンス解除のフレーム。解除をしないと構えが継続するので本来はより複雑だが扱わない。"}'
  UNION ALL SELECT 'sweep_combination', 'unique', 1200, 11, 3, 70, NULL, -44, 57, 0, '{"notes_tool":"技を出して即ブレイカー・スタンス解除のフレーム。解除をしないと構えが継続するので本来はより複雑だが扱わない。空振りで出せないターゲットコンボに近い必殺技。これはSweep Combination 1hitからの通しダメージ。standaloneのフレームを記載。"}'
  UNION ALL SELECT 'hyper_takedown', 'unique', 1200, 23, 3, 48, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'dangerous_armbar', 'unique', 2000, 39, 3, 73, NULL, NULL, 32, 0, NULL
  UNION ALL SELECT 'chop', 'unique', 800, 22, 2, 42, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'oblique_stomp', 'unique', 600, 7, 3, 24, 5, 2, 15, 0, NULL
  UNION ALL SELECT 'flying_cross_chop', 'unique', 800, 35, 11, 80, 7, -7, 35, 1, '{"notes_tool":"ジャンプからの最速"}'
  UNION ALL SELECT 'palm_strikes', 'target_combo', 1440, 15, 3, 38, NULL, -3, 21, 0, '{"notes_tool":"空振りからでないターゲットコンボ"}'
  UNION ALL SELECT 'twisted_drop', 'target_combo', 1000, 15, 3, 47, NULL, -15, 30, 0, '{"notes_tool":"空振りからでないターゲットコンボ。連続ヒットしないので、ダメージは単発"}'
  UNION ALL SELECT 'flash_axe_light', 'special', 800, 13, 3, 36, 3, -4, 21, 0, NULL
  UNION ALL SELECT 'flash_axe_medium', 'special', 1000, 17, 4, 43, NULL, -6, 23, 0, NULL
  UNION ALL SELECT 'flash_chop_od', 'special', 1300, 15, 4, 43, NULL, -4, 25, 0, NULL
  UNION ALL SELECT 'flash_chop', 'special', 1100, 26, 4, 48, 5, 2, 19, 0, NULL
  UNION ALL SELECT 'aerial_knee_smash_light', 'special', 1200, 6, 8, 56, NULL, NULL, 43, 0, '{"notes_tool":"地上から出す技だが、空中の相手にのみヒット"}'
  UNION ALL SELECT 'aerial_knee_smash_medium', 'special', 1400, 8, 9, 58, NULL, NULL, 42, 0, '{"notes_tool":"地上から出す技だが、空中の相手にのみヒット"}'
  UNION ALL SELECT 'aerial_knee_smash_heavy', 'special', 1500, 14, 8, 70, NULL, -42, 49, 0, '{"notes_tool":"強は当たる"}'
  UNION ALL SELECT 'aerial_knee_smash_od', 'special', 1700, 10, 8, 70, NULL, -46, 53, 0, '{"notes_tool":"ODは当たる"}'
  UNION ALL SELECT 'power_bomb_light', 'special', 2500, 9, 3, 61, NULL, NULL, 50, 0, NULL
  UNION ALL SELECT 'power_bomb_medium', 'special', 2500, 7, 3, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'power_bomb_heavy', 'special', 2500, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'power_bomb_od', 'special', 2900, 5, 3, 61, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'power_drop_od', 'special', 3450, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"ODパワーボムを特殊な当て方した場合の派生。フレーム等は省略"}'
  UNION ALL SELECT 'power_drop', 'special', 3220, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"弱中強パワーボムを特殊な当て方した場合の派生。フレーム等は省略"}'
  UNION ALL SELECT 'hyper_bomb', 'special', 3680, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"ODパワードロップからの派生。フレーム等は省略（確定でアニメーションが流れるだけなので、セットプレイに使わないので記録の意味がないため）"}'
  UNION ALL SELECT 'sa1_raging_spear', 'super_art', 2000, 9, 5, 68, NULL, -38, 55, 0, NULL
  UNION ALL SELECT 'sa2_sledgecross_hammer', 'super_art', 3000, 13, 4, 66, NULL, -29, 50, 0, NULL
  UNION ALL SELECT 'sa2_omega_wing_buster', 'super_art', 2500, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"ODパワードロップからの派生。フレーム等は省略（確定でアニメーションが流れるだけなので、セットプレイに使わないので記録の意味がないため）"}'
  UNION ALL SELECT 'sa3_the_final_prison', 'super_art', 4000, 12, 5, 69, NULL, -38, 53, 0, NULL
  UNION ALL SELECT 'ca_the_final_prison', 'critical_art', 4500, 12, 5, 69, NULL, -38, 53, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 2, 25, 9, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 17, 2, 31, 5, -1, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 18, 4, 38, 8, 4, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 20, 3, 41, 7, 0, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 23, 5, 46, 8, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', 'rush_variant', 1000, 34, 3, 58, 9, 6, 22, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 27, 3, 52, 5, 0, 23, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick_holding', 'rush_variant', 1000, 36, 3, 58, NULL, 6, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 16, 3, 26, 9, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 29, 6, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 19, 2, 40, 5, 2, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 19, 3, 39, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 20, 6, 47, 1, -2, 22, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 1000, 21, 3, 49, NULL, -7, 26, 0, NULL
  UNION ALL SELECT 'rush_prowler_stance_cancel', 'rush_variant', 0, 12, 42, 53, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_low_rush', 'rush_variant', 0, 12, 38, 49, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_low_retreat', 'rush_variant', 0, 12, 49, 60, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_light_slashing_elbow', 'rush_variant', 1000, 41, 4, 62, 3, -1, 18, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_medium_slashing_elbow', 'rush_variant', 1000, 44, 4, 65, 3, -1, 18, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_heavy_slashing_elbow', 'rush_variant', 1000, 47, 4, 68, 3, -1, 18, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_palm_jab', 'rush_variant', 300, 33, 3, 68, -17, -23, 33, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_shoulder_launcher', 'rush_variant', 800, 36, 7, 59, NULL, -6, 17, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_heavy_lariat', 'rush_variant', 1000, 41, 3, 62, 6, 3, 19, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_heavy_lariat_holding', 'rush_variant', 1200, 50, 3, 71, 6, 5, 19, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_tactical_hop', 'rush_variant', 0, 12, 57, 68, NULL, NULL, 0, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_air_stampede', 'rush_variant', 1100, 59, 2, 77, NULL, 2, 17, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_sweep_combination_1hit', 'rush_variant', 600, 40, 3, 96, NULL, -41, 54, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_hyper_takedown', 'rush_variant', 1200, 34, 3, 59, NULL, NULL, 23, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_dangerous_armbar', 'rush_variant', 2000, 50, 3, 84, NULL, NULL, 32, 0, '{"notes_tool":"これは特殊な技なのでヒット、ガードのフレームは増えない。通常版とヒット、ガードフレームを一致させる必要があるが機械的にやりたかったので、直していない"}'
  UNION ALL SELECT 'rush_chop', 'rush_variant', 800, 33, 2, 53, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_oblique_stomp', 'rush_variant', 600, 18, 3, 35, 9, 6, 15, 0, NULL
) AS v
WHERE c.code = 'alex' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_standing_heavy_kick_holding' THEN 'standing_heavy_kick_holding'
        WHEN 'rush_crouching_light_punch' THEN 'crouching_light_punch'
        WHEN 'rush_crouching_light_kick' THEN 'crouching_light_kick'
        WHEN 'rush_crouching_medium_punch' THEN 'crouching_medium_punch'
        WHEN 'rush_crouching_medium_kick' THEN 'crouching_medium_kick'
        WHEN 'rush_crouching_heavy_punch' THEN 'crouching_heavy_punch'
        WHEN 'rush_crouching_heavy_kick' THEN 'crouching_heavy_kick'
        WHEN 'rush_prowler_stance_cancel' THEN 'prowler_stance_cancel'
        WHEN 'rush_low_rush' THEN 'low_rush'
        WHEN 'rush_low_retreat' THEN 'low_retreat'
        WHEN 'rush_light_slashing_elbow' THEN 'light_slashing_elbow'
        WHEN 'rush_medium_slashing_elbow' THEN 'medium_slashing_elbow'
        WHEN 'rush_heavy_slashing_elbow' THEN 'heavy_slashing_elbow'
        WHEN 'rush_palm_jab' THEN 'palm_jab'
        WHEN 'rush_shoulder_launcher' THEN 'shoulder_launcher'
        WHEN 'rush_heavy_lariat' THEN 'heavy_lariat'
        WHEN 'rush_heavy_lariat_holding' THEN 'heavy_lariat_holding'
        WHEN 'rush_tactical_hop' THEN 'tactical_hop'
        WHEN 'rush_air_stampede' THEN 'air_stampede'
        WHEN 'rush_sweep_combination_1hit' THEN 'sweep_combination_1hit'
        WHEN 'rush_hyper_takedown' THEN 'hyper_takedown'
        WHEN 'rush_dangerous_armbar' THEN 'dangerous_armbar'
        WHEN 'rush_chop' THEN 'chop'
        WHEN 'rush_oblique_stomp' THEN 'oblique_stomp'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'alex' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_punch_holding', 'rush_standing_heavy_kick', 'rush_standing_heavy_kick_holding', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_prowler_stance_cancel', 'rush_low_rush', 'rush_low_retreat', 'rush_light_slashing_elbow', 'rush_medium_slashing_elbow', 'rush_heavy_slashing_elbow', 'rush_palm_jab', 'rush_shoulder_launcher', 'rush_heavy_lariat', 'rush_heavy_lariat_holding', 'rush_tactical_hop', 'rush_air_stampede', 'rush_sweep_combination_1hit', 'rush_hyper_takedown', 'rush_dangerous_armbar', 'rush_chop', 'rush_oblique_stomp');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'standing_heavy_kick_holding', '立ち強K(ホールド)'
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
  UNION ALL SELECT 'illegal_knees', 'イリーガルキック'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'prowler_stance', 'ブレイカー・スタンス'
  UNION ALL SELECT 'prowler_stance_cancel', 'ブレイカー・スタンス(解除)'
  UNION ALL SELECT 'low_rush', 'ステップイン'
  UNION ALL SELECT 'low_retreat', 'ステップアウト'
  UNION ALL SELECT 'light_slashing_elbow', '弱スラッシュエルボー'
  UNION ALL SELECT 'medium_slashing_elbow', '中スラッシュエルボー'
  UNION ALL SELECT 'heavy_slashing_elbow', '強スラッシュエルボー'
  UNION ALL SELECT 'palm_jab', 'パームコンタクト'
  UNION ALL SELECT 'shoulder_launcher', 'ショルダーランチャー'
  UNION ALL SELECT 'heavy_lariat', 'ヘビーラリアット'
  UNION ALL SELECT 'heavy_lariat_holding', '【ホールド】ヘビーラリアット'
  UNION ALL SELECT 'tactical_hop', 'タクティカルリープ'
  UNION ALL SELECT 'air_stampede', 'エアスタンピート'
  UNION ALL SELECT 'sweep_combination_1hit', 'スイープコンビネーション(単発)'
  UNION ALL SELECT 'sweep_combination', 'スイープコンビネーション'
  UNION ALL SELECT 'hyper_takedown', 'ハイパーリフト'
  UNION ALL SELECT 'dangerous_armbar', 'デンジャラスアプローチ'
  UNION ALL SELECT 'chop', 'チョップ'
  UNION ALL SELECT 'oblique_stomp', 'オブリークスタンプ'
  UNION ALL SELECT 'flying_cross_chop', 'フライングクロスチョップ'
  UNION ALL SELECT 'palm_strikes', 'パームストライク'
  UNION ALL SELECT 'twisted_drop', 'ツイストドロップ'
  UNION ALL SELECT 'flash_axe_light', '弱フラッシュアックス'
  UNION ALL SELECT 'flash_axe_medium', '中フラッシュアックス'
  UNION ALL SELECT 'flash_chop_od', 'ODフラッシュチョップ'
  UNION ALL SELECT 'flash_chop', 'フラッシュチョップ'
  UNION ALL SELECT 'aerial_knee_smash_light', '弱エアニースマッシュ'
  UNION ALL SELECT 'aerial_knee_smash_medium', '中エアニースマッシュ'
  UNION ALL SELECT 'aerial_knee_smash_heavy', '強エアニースマッシュ'
  UNION ALL SELECT 'aerial_knee_smash_od', 'ODエアニースマッシュ'
  UNION ALL SELECT 'power_bomb_light', '弱パワーボム'
  UNION ALL SELECT 'power_bomb_medium', '中パワーボム'
  UNION ALL SELECT 'power_bomb_heavy', '強パワーボム'
  UNION ALL SELECT 'power_bomb_od', 'ODパワーボム'
  UNION ALL SELECT 'power_drop_od', 'ODパワードロップ'
  UNION ALL SELECT 'power_drop', 'パワードロップ'
  UNION ALL SELECT 'hyper_bomb', 'ハイバーボム'
  UNION ALL SELECT 'sa1_raging_spear', 'SA1 レイジングスピアー'
  UNION ALL SELECT 'sa2_sledgecross_hammer', 'SA2 スレッジクロスハンマー'
  UNION ALL SELECT 'sa2_omega_wing_buster', 'SA2 オメガウィングバスター'
  UNION ALL SELECT 'sa3_the_final_prison', 'SA3 ファイナルキャプチュード'
  UNION ALL SELECT 'ca_the_final_prison', 'CA ファイナルキャプチュード'
  UNION ALL SELECT 'rush_standing_light_punch', '立ち弱P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_light_kick', '立ち弱K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_punch', '立ち中P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_medium_kick', '立ち中K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_punch', '立ち強P(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_punch_holding', '立ち強P(ホールド)(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_kick', '立ち強K(ラッシュ)'
  UNION ALL SELECT 'rush_standing_heavy_kick_holding', '立ち強K(ホールド)(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_punch', 'しゃがみ弱P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_light_kick', 'しゃがみ弱K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_punch', 'しゃがみ中P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_medium_kick', 'しゃがみ中K(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'しゃがみ強P(ラッシュ)'
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'しゃがみ強K(ラッシュ)'
  UNION ALL SELECT 'rush_prowler_stance_cancel', 'ブレイカー・スタンス(解除)(ラッシュ)'
  UNION ALL SELECT 'rush_low_rush', 'ステップイン(ラッシュ)'
  UNION ALL SELECT 'rush_low_retreat', 'ステップアウト(ラッシュ)'
  UNION ALL SELECT 'rush_light_slashing_elbow', '弱スラッシュエルボー(ラッシュ)'
  UNION ALL SELECT 'rush_medium_slashing_elbow', '中スラッシュエルボー(ラッシュ)'
  UNION ALL SELECT 'rush_heavy_slashing_elbow', '強スラッシュエルボー(ラッシュ)'
  UNION ALL SELECT 'rush_palm_jab', 'パームコンタクト(ラッシュ)'
  UNION ALL SELECT 'rush_shoulder_launcher', 'ショルダーランチャー(ラッシュ)'
  UNION ALL SELECT 'rush_heavy_lariat', 'ヘビーラリアット(ラッシュ)'
  UNION ALL SELECT 'rush_heavy_lariat_holding', '【ホールド】ヘビーラリアット(ラッシュ)'
  UNION ALL SELECT 'rush_tactical_hop', 'タクティカルリープ(ラッシュ)'
  UNION ALL SELECT 'rush_air_stampede', 'エアスタンピート(ラッシュ)'
  UNION ALL SELECT 'rush_sweep_combination_1hit', 'スイープコンビネーション(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_hyper_takedown', 'ハイパーリフト(ラッシュ)'
  UNION ALL SELECT 'rush_dangerous_armbar', 'デンジャラスアプローチ(ラッシュ)'
  UNION ALL SELECT 'rush_chop', 'チョップ(ラッシュ)'
  UNION ALL SELECT 'rush_oblique_stomp', 'オブリークスタンプ(ラッシュ)'
) AS v
WHERE c.code = 'alex' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== blanka (118 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 17 AS total, 3 AS on_hit, -3 AS on_block, 10 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 4, 14, 5, -2, 7, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 9, 3, 26, 3, -4, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 8, 3, 30, 5, -2, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 7, 38, 3, -3, 22, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 7, 9, 33, 6, -4, 18, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 6, 3, 16, 5, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 3, -3, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 9, 5, 29, -1, -5, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 28, 5, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 15, 5, 39, 0, -5, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 4, 37, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 5, 46, NULL, NULL, 38, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 7, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 4, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 11, 6, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_punch', 'normal', 800, 7, 3, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'wild_bites', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'rock_crusher', 'unique', 600, 20, 3, 42, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'double_knee_bombs', 'unique', 600, 9, 12, 38, 6, -2, 18, 0, NULL
  UNION ALL SELECT 'wild_edge', 'unique', 600, 9, 6, 30, 8, 2, 16, 0, NULL
  UNION ALL SELECT 'wild_nail', 'unique', 1100, 18, 4, 52, NULL, -15, 31, 0, NULL
  UNION ALL SELECT 'amazon_river_run', 'unique', 1000, 14, 10, 45, NULL, -18, 22, 0, NULL
  UNION ALL SELECT 'coward_crouch', 'unique', 0, 1, 98, 98, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'coward_crouch_cancel', 'unique', 0, 1, 47, 47, NULL, NULL, 0, 0, '{"notes_tool":"上入力で最速解除時"}'
  UNION ALL SELECT 'wild_lift', 'unique', 600, 26, 7, 63, NULL, -21, 31, 0, '{"notes_tool":"Coward Crouch派生。さらに通常ジャンプ攻撃を出せるが、他のキャラの似た技（アレックス、ラシード）と同じようにまだ扱わない"}'
  UNION ALL SELECT 'raid_jump', 'unique', 0, 1, 73, 73, NULL, NULL, 0, 0, '{"notes_tool":"Coward Crouch派生"}'
  UNION ALL SELECT 'surprise_forward_hop', 'unique', 0, 1, 27, 27, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'surprise_back_hop', 'unique', 0, 1, 32, 32, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'electric_thunder', 'special', 800, 10, 12, 38, NULL, -3, 17, 0, NULL
  UNION ALL SELECT 'electric_thunder_od', 'special', 1000, 10, 12, 38, NULL, 4, 17, 0, NULL
  UNION ALL SELECT 'electric_thunder_holding', 'special', 1000, 10, 70, 95, NULL, 2, 16, 0, NULL
  UNION ALL SELECT 'electric_thunder_holding_od', 'special', 1000, 10, 70, 95, NULL, 4, 16, 0, NULL
  UNION ALL SELECT 'lightning_beast_electric_thunder', 'special', 900, 10, 12, 38, NULL, -3, 17, 0, NULL
  UNION ALL SELECT 'lightning_beast_od_electric_thunder', 'special', 1100, 10, 12, 38, NULL, 4, 17, 0, NULL
  UNION ALL SELECT 'lightning_beast_electric_thunder_holding', 'special', 1100, 10, 70, 95, NULL, 2, 16, 0, NULL
  UNION ALL SELECT 'lightning_beast_od_electric_thunder_holding', 'special', 1100, 10, 70, 95, NULL, 4, 16, 0, NULL
  UNION ALL SELECT 'rolling_attack_light', 'special', 1000, 10, 11, 31, NULL, -23, 11, 0, NULL
  UNION ALL SELECT 'rolling_attack_medium', 'special', 1200, 12, 19, 41, NULL, -23, 11, 0, NULL
  UNION ALL SELECT 'rolling_attack_heavy', 'special', 1300, 22, 20, 66, NULL, -15, 25, 0, NULL
  UNION ALL SELECT 'rolling_attack_od', 'special', 800, 18, 22, 56, NULL, -7, 17, 0, NULL
  UNION ALL SELECT 'lightning_beast_light_rolling_attack', 'special', 1100, 10, 12, 31, NULL, -21, 10, 0, NULL
  UNION ALL SELECT 'lightning_beast_medium_rolling_attack', 'special', 1300, 12, 19, 41, NULL, -21, 11, 0, NULL
  UNION ALL SELECT 'lightning_beast_heavy_rolling_attack', 'special', 1400, 20, 22, 66, NULL, -21, 25, 0, NULL
  UNION ALL SELECT 'lightning_beast_od_rolling_attack', 'special', 900, 18, 22, 56, NULL, -7, 17, 0, NULL
  UNION ALL SELECT 'vertical_rolling_attack_light', 'special', 1200, 8, 19, 74, NULL, -27, 48, 0, NULL
  UNION ALL SELECT 'vertical_rolling_attack_medium', 'special', 1300, 8, 19, 74, NULL, -27, 48, 0, NULL
  UNION ALL SELECT 'vertical_rolling_attack_heavy', 'special', 1400, 8, 19, 74, NULL, -27, 48, 0, NULL
  UNION ALL SELECT 'vertical_rolling_attack_od', 'special', 1600, 7, 16, 70, NULL, -40, 48, 0, NULL
  UNION ALL SELECT 'lightning_beast_light_vertical_rolling_attack', 'special', 1300, 8, 19, 74, NULL, -18, 48, 0, NULL
  UNION ALL SELECT 'lightning_beast_medium_vertical_rolling_attack', 'special', 1400, 8, 19, 74, NULL, -19, 48, 0, NULL
  UNION ALL SELECT 'lightning_beast_heavy_vertical_rolling_attack', 'special', 1500, 8, 19, 74, NULL, -19, 48, 0, NULL
  UNION ALL SELECT 'lightning_beast_od_vertical_rolling_attack', 'special', 1750, 7, 16, 70, NULL, -40, 48, 0, NULL
  UNION ALL SELECT 'backstep_rolling_attack_light', 'special', 1000, 41, 24, 69, 9, 3, 5, 0, NULL
  UNION ALL SELECT 'backstep_rolling_attack_medium', 'special', 1000, 41, 27, 72, 8, 2, 5, 0, NULL
  UNION ALL SELECT 'backstep_rolling_attack_heavy', 'special', 1000, 41, 29, 74, 8, 4, 5, 0, NULL
  UNION ALL SELECT 'backstep_rolling_attack_od', 'special', 1000, 8, 59, 70, 10, 6, 4, 0, NULL
  UNION ALL SELECT 'lightning_beast_light_backstep_rolling_attack', 'special', 1100, 41, 24, 69, 9, 3, 5, 0, NULL
  UNION ALL SELECT 'lightning_beast_medium_backstep_rolling_attack', 'special', 1100, 41, 27, 72, 8, 2, 5, 0, NULL
  UNION ALL SELECT 'lightning_beast_heavy_backstep_rolling_attack', 'special', 1100, 41, 29, 74, 8, 4, 5, 0, NULL
  UNION ALL SELECT 'lightning_beast_od_backstep_rolling_attack', 'special', 1200, 8, 59, 70, 10, 6, 4, 0, NULL
  UNION ALL SELECT 'aerial_rolling_attack_light', 'special', 1000, 22, 4, 42, NULL, -5, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'aerial_rolling_attack_medium', 'special', 1000, 22, 4, 42, NULL, -5, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'aerial_rolling_attack_heavy', 'special', 1000, 22, 5, 43, NULL, -6, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'aerial_rolling_attack_od', 'special', 1200, 22, 4, 40, NULL, 1, 15, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'lightning_beast_light_aerial_rolling_attack', 'special', 1100, 22, 4, 42, NULL, -5, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'lightning_beast_medium_aerial_rolling_attack', 'special', 1100, 22, 4, 42, NULL, -5, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'lightning_beast_heavy_aerial_rolling_attack', 'special', 1100, 22, 5, 43, NULL, -6, 17, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'lightning_beast_od_aerial_rolling_attack', 'special', 1400, 22, 4, 40, NULL, 1, 15, 0, '{"notes_tool":"後方、垂直、前方ジャンプから派生。派生元によりフレーム変化はない。"}'
  UNION ALL SELECT 'wild_hunt_light', 'special', 1600, 34, 3, 93, NULL, NULL, 57, 0, NULL
  UNION ALL SELECT 'wild_hunt_medium', 'special', 1700, 39, 3, 98, NULL, NULL, 57, 0, NULL
  UNION ALL SELECT 'wild_hunt_heavy', 'special', 1800, 43, 3, 102, NULL, NULL, 57, 0, NULL
  UNION ALL SELECT 'wild_hunt_od', 'special', 2000, 30, 5, 91, NULL, NULL, 57, 0, NULL
  UNION ALL SELECT 'blanka_chan_bomb', 'special', NULL, 1, 50, 50, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'blanka_chan_bomb_activated', 'special', 800, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"フレームやコマンドの概念なし。ベガの自動爆発に近い扱い。"}'
  UNION ALL SELECT 'blanka_chan_bomb_activated_od', 'special', 1200, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"フレームやコマンドの概念なし。ベガの自動爆発に近い扱い。"}'
  UNION ALL SELECT 'rolling_cannon', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"派生経路と方向の組み合わせが膨大で、経路ごとのフレームを一意に定義できない。コンボ入力用として方向別に登録するが、startup / active / recovery / total / on_hit / on_block は意図的に空欄とし、startup_basis=unknown とする。セットプレイ計算には使用しない。"}'
  UNION ALL SELECT 'rolling_cannon_down', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_down_forward', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_back', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_forward', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_up_back', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_up', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'rolling_cannon_up_forward', 'special', 400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Rolling Cannon Down Backの付記と同じ"}'
  UNION ALL SELECT 'sa1_shout_of_earth', 'super_art', 2000, 8, 9, 78, NULL, -29, 62, 0, NULL
  UNION ALL SELECT 'lightning_beast_sa1_shout_of_earth', 'super_art', 2200, 8, 9, 78, NULL, -29, 62, 0, NULL
  UNION ALL SELECT 'sa2_lightning_beast', 'super_art', 0, 1, 10, 10, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa3_ground_shave_cannonball', 'super_art', 4000, 10, 3, 73, NULL, -46, 61, 0, NULL
  UNION ALL SELECT 'ca_ground_shave_cannonball', 'critical_art', 4500, 10, 3, 73, NULL, -46, 61, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 28, 7, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 4, 25, 9, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 20, 3, 37, 7, 0, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 19, 3, 41, 9, 2, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 7, 49, 7, 1, 22, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 18, 9, 44, 10, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 17, 3, 27, 9, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 7, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 20, 5, 40, 3, -1, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 39, 9, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 26, 5, 50, 4, -1, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 4, 48, NULL, -8, 23, 0, NULL
  UNION ALL SELECT 'rush_rock_crusher', 'rush_variant', 600, 31, 3, 53, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_double_knee_bombs', 'rush_variant', 600, 20, 12, 49, 10, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_wild_edge', 'rush_variant', 600, 20, 6, 41, 12, 6, 16, 0, NULL
  UNION ALL SELECT 'rush_wild_nail', 'rush_variant', 1100, 29, 4, 63, NULL, -11, 31, 0, NULL
  UNION ALL SELECT 'rush_amazon_river_run', 'rush_variant', 1000, 25, 10, 56, NULL, -14, 22, 0, NULL
  UNION ALL SELECT 'rush_coward_crouch', 'rush_variant', 0, 12, 98, 109, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_coward_crouch_cancel', 'rush_variant', 0, 12, 47, 58, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_wild_lift', 'rush_variant', 600, 37, 7, 74, NULL, -17, 31, 0, NULL
  UNION ALL SELECT 'rush_raid_jump', 'rush_variant', 0, 12, 73, 84, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_surprise_forward_hop', 'rush_variant', 0, 12, 27, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'rush_surprise_back_hop', 'rush_variant', 0, 12, 32, 43, NULL, NULL, 0, 0, NULL
) AS v
WHERE c.code = 'blanka' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_rock_crusher' THEN 'rock_crusher'
        WHEN 'rush_double_knee_bombs' THEN 'double_knee_bombs'
        WHEN 'rush_wild_edge' THEN 'wild_edge'
        WHEN 'rush_wild_nail' THEN 'wild_nail'
        WHEN 'rush_amazon_river_run' THEN 'amazon_river_run'
        WHEN 'rush_coward_crouch' THEN 'coward_crouch'
        WHEN 'rush_coward_crouch_cancel' THEN 'coward_crouch_cancel'
        WHEN 'rush_wild_lift' THEN 'wild_lift'
        WHEN 'rush_raid_jump' THEN 'raid_jump'
        WHEN 'rush_surprise_forward_hop' THEN 'surprise_forward_hop'
        WHEN 'rush_surprise_back_hop' THEN 'surprise_back_hop'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'blanka' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_rock_crusher', 'rush_double_knee_bombs', 'rush_wild_edge', 'rush_wild_nail', 'rush_amazon_river_run', 'rush_coward_crouch', 'rush_coward_crouch_cancel', 'rush_wild_lift', 'rush_raid_jump', 'rush_surprise_forward_hop', 'rush_surprise_back_hop');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'neutral_jumping_heavy_punch', '垂直ジャンプ強P'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'wild_bites', 'ワイルドバイツ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'rock_crusher', 'ロッククラッシュ'
  UNION ALL SELECT 'double_knee_bombs', 'ダブルニーボンバー'
  UNION ALL SELECT 'wild_edge', 'ワイルドエッジ'
  UNION ALL SELECT 'wild_nail', 'ワイルドネイル'
  UNION ALL SELECT 'amazon_river_run', 'アマゾンリバーダウン'
  UNION ALL SELECT 'coward_crouch', 'フィアーダウン'
  UNION ALL SELECT 'coward_crouch_cancel', 'フィアーダウン(解除)'
  UNION ALL SELECT 'wild_lift', 'ワイルドリフト'
  UNION ALL SELECT 'raid_jump', 'レイドジャンプ'
  UNION ALL SELECT 'surprise_forward_hop', 'サプライズフォワード'
  UNION ALL SELECT 'surprise_back_hop', 'サプライズバック'
  UNION ALL SELECT 'electric_thunder', 'エレクトリックサンダー'
  UNION ALL SELECT 'electric_thunder_od', 'ODエレクトリックサンダー'
  UNION ALL SELECT 'electric_thunder_holding', 'エレクトリックサンダー（ホールド）'
  UNION ALL SELECT 'electric_thunder_holding_od', 'ODエレクトリックサンダー（ホールド）'
  UNION ALL SELECT 'lightning_beast_electric_thunder', '【ライトニングビースト】エレクトリックサンダー'
  UNION ALL SELECT 'lightning_beast_od_electric_thunder', '【ライトニングビースト】ODエレクトリックサンダー'
  UNION ALL SELECT 'lightning_beast_electric_thunder_holding', '【ライトニングビースト】エレクトリックサンダー（ホールド）'
  UNION ALL SELECT 'lightning_beast_od_electric_thunder_holding', '【ライトニングビースト】ODエレクトリックサンダー（ホールド）'
  UNION ALL SELECT 'rolling_attack_light', '弱ローリングアタック'
  UNION ALL SELECT 'rolling_attack_medium', '中ローリングアタック'
  UNION ALL SELECT 'rolling_attack_heavy', '強ローリングアタック'
  UNION ALL SELECT 'rolling_attack_od', 'ODローリングアタック'
  UNION ALL SELECT 'lightning_beast_light_rolling_attack', '【ライトニングビースト】弱ローリングアタック'
  UNION ALL SELECT 'lightning_beast_medium_rolling_attack', '【ライトニングビースト】中ローリングアタック'
  UNION ALL SELECT 'lightning_beast_heavy_rolling_attack', '【ライトニングビースト】強ローリングアタック'
  UNION ALL SELECT 'lightning_beast_od_rolling_attack', '【ライトニングビースト】ODローリングアタック'
  UNION ALL SELECT 'vertical_rolling_attack_light', '弱バーチカルローリングアタック'
  UNION ALL SELECT 'vertical_rolling_attack_medium', '中バーチカルローリングアタック'
  UNION ALL SELECT 'vertical_rolling_attack_heavy', '強バーチカルローリングアタック'
  UNION ALL SELECT 'vertical_rolling_attack_od', 'ODバーチカルローリングアタック'
  UNION ALL SELECT 'lightning_beast_light_vertical_rolling_attack', '【ライトニングビースト】弱バーチカルローリングアタック'
  UNION ALL SELECT 'lightning_beast_medium_vertical_rolling_attack', '【ライトニングビースト】中バーチカルローリングアタック'
  UNION ALL SELECT 'lightning_beast_heavy_vertical_rolling_attack', '【ライトニングビースト】強バーチカルローリングアタック'
  UNION ALL SELECT 'lightning_beast_od_vertical_rolling_attack', '【ライトニングビースト】ODバーチカルローリングアタック'
  UNION ALL SELECT 'backstep_rolling_attack_light', '弱バックステップローリング'
  UNION ALL SELECT 'backstep_rolling_attack_medium', '中バックステップローリング'
  UNION ALL SELECT 'backstep_rolling_attack_heavy', '強バックステップローリング'
  UNION ALL SELECT 'backstep_rolling_attack_od', 'ODバックステップローリング'
  UNION ALL SELECT 'lightning_beast_light_backstep_rolling_attack', '【ライトニングビースト】弱バックステップローリング'
  UNION ALL SELECT 'lightning_beast_medium_backstep_rolling_attack', '【ライトニングビースト】中バックステップローリング'
  UNION ALL SELECT 'lightning_beast_heavy_backstep_rolling_attack', '【ライトニングビースト】強バックステップローリング'
  UNION ALL SELECT 'lightning_beast_od_backstep_rolling_attack', '【ライトニングビースト】ODバックステップローリング'
  UNION ALL SELECT 'aerial_rolling_attack_light', '弱エリアルローリング'
  UNION ALL SELECT 'aerial_rolling_attack_medium', '中エリアルローリング'
  UNION ALL SELECT 'aerial_rolling_attack_heavy', '強エリアルローリング'
  UNION ALL SELECT 'aerial_rolling_attack_od', 'ODエリアルローリング'
  UNION ALL SELECT 'lightning_beast_light_aerial_rolling_attack', '【ライトニングビースト】弱エリアルローリング'
  UNION ALL SELECT 'lightning_beast_medium_aerial_rolling_attack', '【ライトニングビースト】中エリアルローリング'
  UNION ALL SELECT 'lightning_beast_heavy_aerial_rolling_attack', '【ライトニングビースト】強エリアルローリング'
  UNION ALL SELECT 'lightning_beast_od_aerial_rolling_attack', '【ライトニングビースト】ODエリアルローリング'
  UNION ALL SELECT 'wild_hunt_light', '弱ワイルドハント'
  UNION ALL SELECT 'wild_hunt_medium', '中ワイルドハント'
  UNION ALL SELECT 'wild_hunt_heavy', '強ワイルドハント'
  UNION ALL SELECT 'wild_hunt_od', 'ODワイルドハント'
  UNION ALL SELECT 'blanka_chan_bomb', 'ブランカちゃん爆弾'
  UNION ALL SELECT 'blanka_chan_bomb_activated', 'ブランカちゃん爆弾（起動）'
  UNION ALL SELECT 'blanka_chan_bomb_activated_od', 'ODブランカちゃん爆弾（起動）'
  UNION ALL SELECT 'rolling_cannon', 'ローリングキャノン（後方斜め下）'
  UNION ALL SELECT 'rolling_cannon_down', 'ローリングキャノン（下）'
  UNION ALL SELECT 'rolling_cannon_down_forward', 'ローリングキャノン（前方斜め下）'
  UNION ALL SELECT 'rolling_cannon_back', 'ローリングキャノン（後方）'
  UNION ALL SELECT 'rolling_cannon_forward', 'ローリングキャノン（前方）'
  UNION ALL SELECT 'rolling_cannon_up_back', 'ローリングキャノン（後方斜め上）'
  UNION ALL SELECT 'rolling_cannon_up', 'ローリングキャノン（上）'
  UNION ALL SELECT 'rolling_cannon_up_forward', 'ローリングキャノン（前方斜め上）'
  UNION ALL SELECT 'sa1_shout_of_earth', 'SA1 シャウトオブアース'
  UNION ALL SELECT 'lightning_beast_sa1_shout_of_earth', '【ライトニングビースト】SA1 シャウトオブアース'
  UNION ALL SELECT 'sa2_lightning_beast', 'SA2 ライトニングビースト'
  UNION ALL SELECT 'sa3_ground_shave_cannonball', 'SA3 グランドシェイブキャノンボール'
  UNION ALL SELECT 'ca_ground_shave_cannonball', 'CA グランドシェイブキャノンボール'
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
  UNION ALL SELECT 'rush_rock_crusher', 'ロッククラッシュ(ラッシュ)'
  UNION ALL SELECT 'rush_double_knee_bombs', 'ダブルニーボンバー(ラッシュ)'
  UNION ALL SELECT 'rush_wild_edge', 'ワイルドエッジ(ラッシュ)'
  UNION ALL SELECT 'rush_wild_nail', 'ワイルドネイル(ラッシュ)'
  UNION ALL SELECT 'rush_amazon_river_run', 'アマゾンリバーダウン(ラッシュ)'
  UNION ALL SELECT 'rush_coward_crouch', 'フィアーダウン(ラッシュ)'
  UNION ALL SELECT 'rush_coward_crouch_cancel', 'フィアーダウン(解除)(ラッシュ)'
  UNION ALL SELECT 'rush_wild_lift', 'ワイルドリフト(ラッシュ)'
  UNION ALL SELECT 'rush_raid_jump', 'レイドジャンプ(ラッシュ)'
  UNION ALL SELECT 'rush_surprise_forward_hop', 'サプライズフォワード(ラッシュ)'
  UNION ALL SELECT 'rush_surprise_back_hop', 'サプライズバック(ラッシュ)'
) AS v
WHERE c.code = 'blanka' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== cammy (99 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 5 AS on_hit, -2 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 17, 2, -3, 10, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 4, 22, 6, -1, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 8, 3, 28, 3, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 8, 3, 30, 2, -3, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 11, 3, 34, 2, -3, 21, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 13, 5, -2, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 14, 3, -2, 7, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 3, 26, 5, -2, 17, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 28, 1, -5, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 700, 10, 4, 28, 7, 1, 15, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 3, 35, NULL, -10, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 4, 10, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 6, 8, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 600, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'leg_scissors_choke', 'throw', 1200, 5, 3, 46, NULL, NULL, 39, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'lift_uppercut', 'unique', 500, 5, 5, 21, 4, 1, 12, 0, NULL
  UNION ALL SELECT 'delayed_ripper', 'unique', 800, 18, 3, 45, NULL, -12, 25, 0, NULL
  UNION ALL SELECT 'assault_blade', 'unique', 800, 9, 3, 29, NULL, -7, 18, 0, NULL
  UNION ALL SELECT 'spiral_arrow_light', 'special', 800, 9, 13, 42, NULL, -12, 21, 0, NULL
  UNION ALL SELECT 'spiral_arrow_medium', 'special', 900, 9, 15, 44, NULL, -14, 21, 0, NULL
  UNION ALL SELECT 'spiral_arrow_heavy', 'special', 1000, 15, 16, 51, NULL, -12, 21, 0, '{"notes_tool":"公式差分OK。飛びフレームをこっちでは足してるから。"}'
  UNION ALL SELECT 'spiral_arrow_holding_heavy', 'special', 800, 25, 16, 60, NULL, -14, 20, 0, '{"notes_tool":"発生25F～27。最速は25でおしっぱは27。仮に使うならおしっぱの方が再現性あると思い、そちらで登録"}'
  UNION ALL SELECT 'spiral_arrow_od', 'special', 800, 13, 16, 48, NULL, -14, 20, 0, '{"notes_tool":"公式差分OK。飛びフレームをこっちでは足してるから。"}'
  UNION ALL SELECT 'cannon_spike_light', 'special', 900, 5, 12, 56, NULL, -36, 40, 0, NULL
  UNION ALL SELECT 'cannon_spike_medium', 'special', 1000, 6, 12, 58, NULL, -36, 41, 0, NULL
  UNION ALL SELECT 'cannon_spike_heavy', 'special', 1200, 7, 12, 62, NULL, -36, 44, 0, NULL
  UNION ALL SELECT 'cannon_spike_holding_heavy', 'special', 1500, 22, 12, 78, NULL, -40, 45, 0, '{"notes_tool":"発生22?~24。スパイラルアローと同じ計測。"}'
  UNION ALL SELECT 'cannon_spike_od', 'special', 1500, 6, 12, 63, NULL, -40, 46, 0, NULL
  UNION ALL SELECT 'quick_spin_knuckle_light', 'special', 800, 21, 4, 40, 2, -3, 16, 0, NULL
  UNION ALL SELECT 'quick_spin_knuckle_medium', 'special', 800, 24, 4, 43, 3, -2, 16, 0, NULL
  UNION ALL SELECT 'quick_spin_knuckle_heavy', 'special', 800, 28, 4, 48, 5, 3, 17, 0, NULL
  UNION ALL SELECT 'quick_spin_knuckle_od', 'special', 800, 25, 4, 45, 7, 3, 17, 0, '{"notes_tool":"裏に回るとガードフレームが-2になるが、今回は不問。表で計測。"}'
  UNION ALL SELECT 'cannon_strike_light', 'special', 600, 24, 9, 44, 1, -5, 12, 0, '{"notes_tool":"ジャンプからの最速入力。フレームは密着、立ち相手で計測"}'
  UNION ALL SELECT 'cannon_strike_medium', 'special', 600, 24, 9, 44, 1, -5, 12, 0, '{"notes_tool":"ジャンプからの最速入力フレームは密着、立ち相手で計測"}'
  UNION ALL SELECT 'cannon_strike_heavy', 'special', 600, 24, 9, 44, 1, -5, 12, 0, '{"notes_tool":"ジャンプからの最速入力フレームは密着、立ち相手で計測"}'
  UNION ALL SELECT 'cannon_strike_od', 'special', 800, 24, 9, 44, 0, -2, 12, 0, '{"notes_tool":"ジャンプからの最速入力フレームは密着、立ち相手で計測"}'
  UNION ALL SELECT 'hooligan_combination_light', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'hooligan_combination_medium', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'hooligan_combination_heavy', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'hooligan_combination_holding_heavy', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'hooligan_combination_od', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"単独でダメージがなく、特殊な技なので技名以外の入力なし"}'
  UNION ALL SELECT 'razors_edge_slicer_od', 'special', 1200, 50, 24, 90, NULL, 2, 17, 0, '{"notes_tool":"フーリガンから何もしなかったら出る技。フーリガン強度不問。"}'
  UNION ALL SELECT 'razors_edge_slicer', 'special', 1000, 50, 9, 71, NULL, 2, 13, 0, '{"notes_tool":"フーリガンから何もしなかったら出る技。フーリガン強度不問。"}'
  UNION ALL SELECT 'razors_edge_slicer_holding', 'special', 1200, 68, 24, 108, NULL, 2, 17, 0, '{"notes_tool":"フーリガンから何もしなかったら出る技"}'
  UNION ALL SELECT 'cannon_strike_light_hooligan_combination', 'special', 600, 33, 10, 54, 0, -6, 12, 0, '{"notes_tool":"弱フーリガン→強度不問キャノンストライク。キャノンストライク側はどの強度を選んでもセットプレイに関連する全体へのフレームに影響しない。ガード、ヒットフレームには影響があるが、ややこしくなるので、こちらは同じ強度のストライクを出した時のものを記録"}'
  UNION ALL SELECT 'cannon_strike_medium_hooligan_combination', 'special', 600, 33, 8, 52, 2, -4, 12, 0, '{"notes_tool":"中フーリガン→強度不問キャノンストライク。キャノンストライク側はどの強度を選んでもセットプレイに関連する全体へのフレームに影響しない。ガード、ヒットフレームには影響があるが、ややこしくなるので、こちらは同じ強度のストライクを出した時のものを記録"}'
  UNION ALL SELECT 'cannon_strike_heavy_hooligan_combination', 'special', 600, 33, 6, 50, 4, -2, 12, 0, '{"notes_tool":"強フーリガン→強度不問キャノンストライク。キャノンストライク側はどの強度を選んでもセットプレイに関連する全体へのフレームに影響しない。ガード、ヒットフレームには影響があるが、ややこしくなるので、こちらは同じ強度のストライクを出した時のものを記録"}'
  UNION ALL SELECT 'cannon_strike_heavy_hooligan_combination_holding', 'special', 800, 51, 6, 68, 4, 0, 12, 0, '{"notes_tool":"強フーリガン→強度不問キャノンストライク。キャノンストライク側はどの強度を選んでもセットプレイに関連する全体へのフレームに影響しない。ガード、ヒットフレームには影響があるが、ややこしくなるので、こちらは同じ強度のストライクを出した時のものを記録"}'
  UNION ALL SELECT 'cannon_strike_light_od_hooligan_combination_od', 'special', 800, 33, 9, 53, 1, -3, 12, 0, '{"notes_tool":"弱中同時押しフーリガンから。ODキャノンストライクには同時押しによる強度変化はなし"}'
  UNION ALL SELECT 'cannon_strike_medium_od_hooligan_combination_od', 'special', 800, 33, 7, 51, 3, -1, 12, 0, '{"notes_tool":"弱強同時押しフーリガンから。ODキャノンストライクには同時押しによる強度変化はなし"}'
  UNION ALL SELECT 'cannon_strike_heavy_od_hooligan_combination_od', 'special', 800, 33, 6, 50, 4, 0, 12, 0, '{"notes_tool":"中強同時押しフーリガンから。ODキャノンストライクには同時押しによる強度変化はなし"}'
  UNION ALL SELECT 'reverse_edge_light_hooligan_combination', 'special', 800, 38, 4, 56, 6, -4, 15, 0, NULL
  UNION ALL SELECT 'reverse_edge_medium_hooligan_combination', 'special', 800, 38, 4, 55, 7, -3, 14, 0, NULL
  UNION ALL SELECT 'reverse_edge_heavy_hooligan_combination', 'special', 800, 38, 4, 54, 8, -2, 13, 0, NULL
  UNION ALL SELECT 'reverse_edge_heavy_hooligan_combination_holding', 'special', 800, 56, 22, 90, 8, -2, 13, 0, NULL
  UNION ALL SELECT 'reverse_edge_od', 'special', 1200, 38, 22, 72, 8, -2, 13, 0, '{"notes_tool":"ODフーリガンの種類によってフレーム変わらず"}'
  UNION ALL SELECT 'fatal_leg_twister_light', 'special', 1800, 30, 3, 69, NULL, NULL, 37, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_medium', 'special', 1800, 30, 3, 67, NULL, NULL, 35, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_heavy', 'special', 1800, 30, 3, 64, NULL, NULL, 32, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_heavy_hooligan_combination_holding', 'special', 1000, 48, 3, 82, NULL, NULL, 32, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_light_od_hooligan_combination', 'special', 1000, 30, 3, 69, NULL, NULL, 37, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_medium_od_hooligan_combination', 'special', 1000, 30, 3, 67, NULL, NULL, 35, 0, NULL
  UNION ALL SELECT 'fatal_leg_twister_heavy_od_hooligan_combination', 'special', 1000, 30, 3, 64, NULL, NULL, 32, 0, NULL
  UNION ALL SELECT 'silent_step_light', 'special', 0, 1, 42, 42, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'silent_step_medium', 'special', 0, 1, 41, 41, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'silent_step_heavy', 'special', 0, 1, 40, 40, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'silent_step_light_od_hooligan_combination_od', 'special', 0, 1, 39, 39, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'silent_step_medium_od_hooligan_combination_od', 'special', 0, 1, 38, 38, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'silent_step_heavy_od_hooligan_combination_od', 'special', 0, 1, 37, 37, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa1_spin_drive_smasher', 'super_art', 2000, 9, 16, 62, NULL, -24, 38, 0, NULL
  UNION ALL SELECT 'sa2_killer_bee_spin', 'super_art', 3000, 13, 9, 58, NULL, -24, 37, 0, NULL
  UNION ALL SELECT 'sa2_aerial_killer_bee_spin', 'super_art', 1320, 23, 10, 69, NULL, -23, 37, 0, '{"notes_tool":"ジャンプからの最速入力。空中でヒットした時のダメージを入力。"}'
  UNION ALL SELECT 'sa3_delta_red_assault', 'super_art', 4000, 9, 15, 61, NULL, -33, 38, 0, NULL
  UNION ALL SELECT 'ca_delta_red_assault', 'critical_art', 4500, 9, 15, 61, NULL, -33, 38, 0, NULL
  UNION ALL SELECT 'lift_combination', 'target_combo', 1100, 9, 3, 34, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'swing_combination', 'target_combo', 1520, 13, 3, 44, NULL, -12, 29, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 9, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 28, 6, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 4, 33, 10, 3, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 19, 3, 39, 7, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 19, 3, 41, 6, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 22, 3, 45, 6, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 24, 9, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 25, 7, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 3, 37, 9, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 39, 5, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 700, 21, 4, 39, 11, 5, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 3, 46, NULL, -6, 24, 0, NULL
  UNION ALL SELECT 'rush_lift_uppercut', 'rush_variant', 500, 16, 5, 32, 8, 5, 12, 0, NULL
  UNION ALL SELECT 'rush_delayed_ripper', 'rush_variant', 800, 29, 3, 56, NULL, -8, 25, 0, NULL
  UNION ALL SELECT 'rush_assault_blade', 'rush_variant', 800, 20, 3, 40, NULL, -3, 18, 0, NULL
) AS v
WHERE c.code = 'cammy' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_lift_uppercut' THEN 'lift_uppercut'
        WHEN 'rush_delayed_ripper' THEN 'delayed_ripper'
        WHEN 'rush_assault_blade' THEN 'assault_blade'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'cammy' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_lift_uppercut', 'rush_delayed_ripper', 'rush_assault_blade');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'leg_scissors_choke', 'レッグシザースチョーク'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'lift_uppercut', 'リフトアッパー'
  UNION ALL SELECT 'delayed_ripper', 'ディレイリーパー'
  UNION ALL SELECT 'assault_blade', 'アサルトブレード'
  UNION ALL SELECT 'spiral_arrow_light', '弱スパイラルアロー'
  UNION ALL SELECT 'spiral_arrow_medium', '中スパイラルアロー'
  UNION ALL SELECT 'spiral_arrow_heavy', '強スパイラルアロー'
  UNION ALL SELECT 'spiral_arrow_holding_heavy', '【ホールド】強スパイラルアロー'
  UNION ALL SELECT 'spiral_arrow_od', 'ODスパイラルアロー'
  UNION ALL SELECT 'cannon_spike_light', '弱キャノンスパイク'
  UNION ALL SELECT 'cannon_spike_medium', '中キャノンスパイク'
  UNION ALL SELECT 'cannon_spike_heavy', '強キャノンスパイク'
  UNION ALL SELECT 'cannon_spike_holding_heavy', '【ホールド】強キャノンスパイク'
  UNION ALL SELECT 'cannon_spike_od', 'ODキャノンスパイク'
  UNION ALL SELECT 'quick_spin_knuckle_light', '弱アクセルスピンナックル'
  UNION ALL SELECT 'quick_spin_knuckle_medium', '中アクセルスピンナックル'
  UNION ALL SELECT 'quick_spin_knuckle_heavy', '強アクセルスピンナックル'
  UNION ALL SELECT 'quick_spin_knuckle_od', 'ODアクセルスピンナックル'
  UNION ALL SELECT 'cannon_strike_light', '弱キャノンストライク'
  UNION ALL SELECT 'cannon_strike_medium', '中キャノンストライク'
  UNION ALL SELECT 'cannon_strike_heavy', '強キャノンストライク'
  UNION ALL SELECT 'cannon_strike_od', 'ODキャノンストライク'
  UNION ALL SELECT 'hooligan_combination_light', '弱フーリガンコンビネーション'
  UNION ALL SELECT 'hooligan_combination_medium', '中フーリガンコンビネーション'
  UNION ALL SELECT 'hooligan_combination_heavy', '強フーリガンコンビネーション'
  UNION ALL SELECT 'hooligan_combination_holding_heavy', '【ホールド】強フーリガンコンビネーション'
  UNION ALL SELECT 'hooligan_combination_od', 'ODフーリガンコンビネーション'
  UNION ALL SELECT 'razors_edge_slicer_od', 'ODレイザーエッジスライサー(ODフーリガンコンビネーション派生)'
  UNION ALL SELECT 'razors_edge_slicer', 'レイザーエッジスライサー(フーリガンコンビネーション派生)'
  UNION ALL SELECT 'razors_edge_slicer_holding', 'レイザーエッジスライサー(【ホールド】強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'cannon_strike_light_hooligan_combination', 'キャノンストライク(弱フーリガンコンビネーション派生)'
  UNION ALL SELECT 'cannon_strike_medium_hooligan_combination', 'キャノンストライク(中フーリガンコンビネーション派生)'
  UNION ALL SELECT 'cannon_strike_heavy_hooligan_combination', 'キャノンストライク(強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'cannon_strike_heavy_hooligan_combination_holding', 'キャノンストライク(【ホールド】強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'cannon_strike_light_od_hooligan_combination_od', 'ODキャノンストライク(弱ODフーリガン派生)'
  UNION ALL SELECT 'cannon_strike_medium_od_hooligan_combination_od', 'ODキャノンストライク(中ODフーリガン派生)'
  UNION ALL SELECT 'cannon_strike_heavy_od_hooligan_combination_od', 'ODキャノンストライク(強ODフーリガン派生)'
  UNION ALL SELECT 'reverse_edge_light_hooligan_combination', 'リバースエッジ(弱フーリガンコンビネーション派生)'
  UNION ALL SELECT 'reverse_edge_medium_hooligan_combination', 'リバースエッジ(中フーリガンコンビネーション派生)'
  UNION ALL SELECT 'reverse_edge_heavy_hooligan_combination', 'リバースエッジ(強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'reverse_edge_heavy_hooligan_combination_holding', 'リバースエッジ(【ホールド】強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'reverse_edge_od', 'ODリバースエッジ(ODフーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_light', 'フェイタルレッグツイスター(弱フーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_medium', 'フェイタルレッグツイスター(中フーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_heavy', 'フェイタルレッグツイスター(強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_heavy_hooligan_combination_holding', 'フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_light_od_hooligan_combination', 'フェイタルレッグツイスター(弱ODフーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_medium_od_hooligan_combination', 'フェイタルレッグツイスター(中ODフーリガンコンビネーション派生)'
  UNION ALL SELECT 'fatal_leg_twister_heavy_od_hooligan_combination', 'フェイタルレッグツイスター(強ODフーリガンコンビネーション派生)'
  UNION ALL SELECT 'silent_step_light', 'サイレントステップ(弱フーリガン派生)'
  UNION ALL SELECT 'silent_step_medium', 'サイレントステップ(中フーリガン派生)'
  UNION ALL SELECT 'silent_step_heavy', 'サイレントステップ(強フーリガン派生)'
  UNION ALL SELECT 'silent_step_light_od_hooligan_combination_od', 'ODサイレントステップ(弱ODフーリガン派生)'
  UNION ALL SELECT 'silent_step_medium_od_hooligan_combination_od', 'ODサイレントステップ(中ODフーリガン派生)'
  UNION ALL SELECT 'silent_step_heavy_od_hooligan_combination_od', 'ODサイレントステップ(強ODフーリガン派生)'
  UNION ALL SELECT 'sa1_spin_drive_smasher', 'SA1 スピンドライブスマッシャー'
  UNION ALL SELECT 'sa2_killer_bee_spin', 'SA2 キラービースピン'
  UNION ALL SELECT 'sa2_aerial_killer_bee_spin', 'SA2 エアキラービースピン'
  UNION ALL SELECT 'sa3_delta_red_assault', 'SA3 デルタレッドアサルト'
  UNION ALL SELECT 'ca_delta_red_assault', 'CA デルタレッドアサルト'
  UNION ALL SELECT 'lift_combination', 'リフトコンビネーション'
  UNION ALL SELECT 'swing_combination', 'スイングコンビネーション'
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
  UNION ALL SELECT 'rush_lift_uppercut', 'リフトアッパー(ラッシュ)'
  UNION ALL SELECT 'rush_delayed_ripper', 'ディレイリーパー(ラッシュ)'
  UNION ALL SELECT 'rush_assault_blade', 'アサルトブレード(ラッシュ)'
) AS v
WHERE c.code = 'cammy' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== chun_li (87 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 5 AS on_hit, -3 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 17, 2, -2, 10, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 5, 4, 18, 6, 1, 10, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 500, 7, 4, 26, 4, -2, 16, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 13, 3, 35, 2, -3, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 14, 3, 34, 4, 0, 18, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 13, 4, -2, 7, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 4, 2, 15, 0, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 23, 4, -2, 14, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 7, 3, 28, -2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 11, 13, 41, 1, -3, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 9, 6, 33, NULL, -9, 19, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 10, 50, NULL, NULL, 37, 1, '{"notes_tool":"通常飛びが47と他キャラクターより4多い。なので硬直が増えるジャンプ攻撃の全体も50になる。ジャンプ攻撃系は全部同じ。"}'
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 4, 8, 50, NULL, NULL, 39, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 7, 15, 50, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 6, 5, 50, NULL, NULL, 40, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 50, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 8, 5, 50, NULL, NULL, 38, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'normal', 800, 8, 7, 50, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'ryuseiraku', 'throw', 1200, 5, 3, 50, NULL, NULL, 43, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'swift_thrust', 'unique', 600, 7, 3, 24, 2, -3, 15, 0, NULL
  UNION ALL SELECT 'hakkei', 'unique', 800, 8, 6, 27, 5, -1, 14, 0, NULL
  UNION ALL SELECT 'water_lotus_fist', 'unique', 800, 21, 3, 38, 2, -3, 15, 0, NULL
  UNION ALL SELECT 'yokusen_kick', 'unique', 800, 16, 2, 40, -1, -4, 23, 0, NULL
  UNION ALL SELECT 'falling_crane', 'unique', 800, 37, 2, 51, 7, 3, 13, 0, NULL
  UNION ALL SELECT 'yoso_kick', 'unique', 300, 7, 11, 49, NULL, NULL, 32, 1, '{"notes_tool":"ジャンプから最速で出して当たる。3回まで出せ微妙に性能が違うが、分ける必要を感じなかったので統一。"}'
  UNION ALL SELECT 'wall_jump', 'unique', 0, 32, 40, 71, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'soaring_eagle_punches', 'target_combo', 1000, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"エッジケース。空振りでも出せる空中ターゲットコンボ。ジャンプ強Pから派生。空中限定のため確定反撃の対象外であり、elena soaring_raid / ingrid satelite_leap と同じくフレームは入れない。"}'
  UNION ALL SELECT 'serenity_stream', 'unique', 0, 1, 89, 89, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'serenity_stream_cancel', 'unique', 0, 1, 37, 37, NULL, NULL, 0, 0, '{"notes_tool":"上入力で最速解除時"}'
  UNION ALL SELECT 'orchid_palm', 'unique', 500, 19, 5, 59, -22, -23, 36, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'snake_strike', 'unique', 750, 20, 12, 63, NULL, -28, 32, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'lotus_fist', 'unique', 900, 37, 10, 65, 2, 1, 19, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'forward_strike', 'unique', 500, 22, 5, 62, -23, -27, 36, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'senpu_kick', 'unique', 800, 24, 5, 74, -27, -33, 46, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'tenku_kick', 'unique', 700, 22, 5, 50, NULL, -9, 24, 0, '{"notes_tool":"行雲流水から最初に出して、その技で打ち切った場合」の通し値。構え継続した場合のフレームは複雑なので申し送り。"}'
  UNION ALL SELECT 'kikoken_light', 'special', 600, 15, 33, 47, -3, -7, 0, 0, NULL
  UNION ALL SELECT 'kikoken_medium', 'special', 600, 12, 34, 45, -3, -7, 0, 0, NULL
  UNION ALL SELECT 'kikoken_heavy', 'special', 600, 11, 25, 43, -2, -6, 8, 0, NULL
  UNION ALL SELECT 'kikoken_od', 'special', 800, 11, 29, 39, 5, 0, 0, 0, NULL
  UNION ALL SELECT 'hundred_lightning_kicks_light', 'special', 800, 5, 16, 40, 3, -8, 20, 0, NULL
  UNION ALL SELECT 'hundred_lightning_kicks_medium', 'special', 900, 12, 21, 54, 3, -8, 22, 0, NULL
  UNION ALL SELECT 'hundred_lightning_kicks_heavy', 'special', 1000, 23, 25, 62, NULL, -3, 15, 0, NULL
  UNION ALL SELECT 'hundred_lightning_kicks_od', 'special', 1000, 8, 26, 54, 3, -3, 21, 0, NULL
  UNION ALL SELECT 'lightning_kick_barrage', 'special', 1700, 11, 38, 73, NULL, -13, 25, 0, '{"notes_tool":"OD百裂脚からのみ派生。空振りではでないのでstandalone"}'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_light', 'special', 900, 19, 14, 53, 0, -3, 21, 0, '{"notes_tool":"ジャンプからのthrough。ヒット/ガードは立ち状態で当てた時のフレーム。ダメージは空中フルヒット。"}'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_medium', 'special', 1000, 21, 21, 64, 0, -4, 23, 0, '{"notes_tool":"ジャンプからのthrough。ヒット/ガードは立ち状態で当てた時のフレーム。ダメージは空中フルヒット。"}'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_heavy', 'special', 1100, 23, 24, 74, -3, -7, 28, 0, '{"notes_tool":"ジャンプからのthrough。ヒット/ガードは立ち状態で当てた時のフレーム。ダメージは空中フルヒット。"}'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_od', 'special', 1600, 15, 26, 60, NULL, -1, 20, 0, '{"notes_tool":"ジャンプからのthrough。ヒット/ガードは立ち状態で当てた時のフレーム。ダメージは空中フルヒット。"}'
  UNION ALL SELECT 'spinning_bird_kick_light', 'special', 1000, 9, 18, 56, NULL, -18, 30, 0, NULL
  UNION ALL SELECT 'spinning_bird_kick_medium', 'special', 1200, 16, 33, 77, NULL, -17, 29, 0, NULL
  UNION ALL SELECT 'spinning_bird_kick_heavy', 'special', 1400, 20, 45, 94, NULL, -18, 30, 0, NULL
  UNION ALL SELECT 'spinning_bird_kick_od', 'special', 800, 16, 40, 78, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'hazanshu_light', 'special', 700, 23, 3, 45, NULL, -4, 20, 0, NULL
  UNION ALL SELECT 'hazanshu_medium', 'special', 1000, 27, 3, 45, 2, -3, 16, 0, NULL
  UNION ALL SELECT 'hazanshu_heavy', 'special', 1200, 32, 3, 52, 6, -1, 18, 0, NULL
  UNION ALL SELECT 'hazanshu_od', 'special', 1200, 26, 3, 44, NULL, -5, 16, 0, NULL
  UNION ALL SELECT 'tensho_kicks_light', 'special', 900, 5, 14, 57, NULL, -37, 39, 0, NULL
  UNION ALL SELECT 'tensho_kicks_medium', 'special', 1000, 7, 14, 63, NULL, -41, 43, 0, NULL
  UNION ALL SELECT 'tensho_kicks_heavy', 'special', 1200, 9, 35, 81, NULL, -57, 38, 0, NULL
  UNION ALL SELECT 'tensho_kicks_od', 'special', 1400, 6, 11, 57, NULL, -40, 41, 0, NULL
  UNION ALL SELECT 'sa1_kikosho', 'super_art', 1700, 7, 70, 122, NULL, -22, 46, 0, NULL
  UNION ALL SELECT 'sa1_aerial_kikosho', 'super_art', 2000, 16, 50, 107, NULL, -20, 42, 0, NULL
  UNION ALL SELECT 'sa2_hoyoku_sen', 'super_art', 2000, 11, 86, 144, NULL, -35, 48, 0, NULL
  UNION ALL SELECT 'sa3_soten_ranka', 'super_art', 4000, 8, 35, 82, NULL, -24, 40, 0, NULL
  UNION ALL SELECT 'ca_soten_ranka', 'critical_art', 4500, 8, 35, 82, NULL, -24, 40, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 9, 1, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 28, 6, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 16, 4, 29, 10, 5, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 500, 18, 4, 37, 8, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 24, 3, 46, 6, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 25, 3, 45, 8, 4, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 2, 7, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 15, 2, 26, 4, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 34, 8, 2, 14, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 18, 3, 39, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 22, 13, 52, 5, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 20, 6, 44, NULL, -5, 19, 0, NULL
  UNION ALL SELECT 'rush_swift_thrust', 'rush_variant', 600, 18, 3, 35, 6, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_hakkei', 'rush_variant', 800, 19, 6, 38, 9, 3, 14, 0, NULL
  UNION ALL SELECT 'rush_water_lotus_fist', 'rush_variant', 800, 32, 3, 49, 6, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_yokusen_kick', 'rush_variant', 800, 27, 2, 51, 3, 0, 23, 0, NULL
  UNION ALL SELECT 'rush_falling_crane', 'rush_variant', 800, 48, 2, 62, 11, 7, 13, 0, NULL
) AS v
WHERE c.code = 'chun_li' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_swift_thrust' THEN 'swift_thrust'
        WHEN 'rush_hakkei' THEN 'hakkei'
        WHEN 'rush_water_lotus_fist' THEN 'water_lotus_fist'
        WHEN 'rush_yokusen_kick' THEN 'yokusen_kick'
        WHEN 'rush_falling_crane' THEN 'falling_crane'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'chun_li' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_swift_thrust', 'rush_hakkei', 'rush_water_lotus_fist', 'rush_yokusen_kick', 'rush_falling_crane');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'ryuseiraku', '龍星落'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'swift_thrust', '追突拳'
  UNION ALL SELECT 'hakkei', '発勁'
  UNION ALL SELECT 'water_lotus_fist', '水蓮掌'
  UNION ALL SELECT 'yokusen_kick', '翼旋脚'
  UNION ALL SELECT 'falling_crane', '鶴脚落'
  UNION ALL SELECT 'yoso_kick', '鷹爪脚'
  UNION ALL SELECT 'wall_jump', '三角飛び'
  UNION ALL SELECT 'soaring_eagle_punches', '鷹嘴連拳'
  UNION ALL SELECT 'serenity_stream', '行雲流水'
  UNION ALL SELECT 'serenity_stream_cancel', '行雲流水(解除)'
  UNION ALL SELECT 'orchid_palm', '蘭華'
  UNION ALL SELECT 'snake_strike', '這蛇突'
  UNION ALL SELECT 'lotus_fist', '蓮掌'
  UNION ALL SELECT 'forward_strike', '前突'
  UNION ALL SELECT 'senpu_kick', '仙風'
  UNION ALL SELECT 'tenku_kick', '天空脚'
  UNION ALL SELECT 'kikoken_light', '弱気功拳'
  UNION ALL SELECT 'kikoken_medium', '中気功拳'
  UNION ALL SELECT 'kikoken_heavy', '強気功拳'
  UNION ALL SELECT 'kikoken_od', 'OD気功拳'
  UNION ALL SELECT 'hundred_lightning_kicks_light', '弱百裂脚'
  UNION ALL SELECT 'hundred_lightning_kicks_medium', '中百裂脚'
  UNION ALL SELECT 'hundred_lightning_kicks_heavy', '強百裂脚'
  UNION ALL SELECT 'hundred_lightning_kicks_od', 'OD百裂脚'
  UNION ALL SELECT 'lightning_kick_barrage', '百裂連脚'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_light', '弱空中百裂脚'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_medium', '中空中百裂脚'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_heavy', '強空中百裂脚'
  UNION ALL SELECT 'aerial_hundred_lightning_kicks_od', 'OD空中百裂脚'
  UNION ALL SELECT 'spinning_bird_kick_light', '弱スピニングバードキック'
  UNION ALL SELECT 'spinning_bird_kick_medium', '中スピニングバードキック'
  UNION ALL SELECT 'spinning_bird_kick_heavy', '強スピニングバードキック'
  UNION ALL SELECT 'spinning_bird_kick_od', 'ODスピニングバードキック'
  UNION ALL SELECT 'hazanshu_light', '弱覇山蹴'
  UNION ALL SELECT 'hazanshu_medium', '中覇山蹴'
  UNION ALL SELECT 'hazanshu_heavy', '強覇山蹴'
  UNION ALL SELECT 'hazanshu_od', 'OD覇山蹴'
  UNION ALL SELECT 'tensho_kicks_light', '弱天昇脚'
  UNION ALL SELECT 'tensho_kicks_medium', '中天昇脚'
  UNION ALL SELECT 'tensho_kicks_heavy', '強天昇脚'
  UNION ALL SELECT 'tensho_kicks_od', 'OD天昇脚'
  UNION ALL SELECT 'sa1_kikosho', 'SA1 気功掌'
  UNION ALL SELECT 'sa1_aerial_kikosho', 'SA1 空中気功掌'
  UNION ALL SELECT 'sa2_hoyoku_sen', 'SA2 鳳翼扇'
  UNION ALL SELECT 'sa3_soten_ranka', 'SA3 蒼天乱華'
  UNION ALL SELECT 'ca_soten_ranka', 'CA 蒼天乱華'
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
  UNION ALL SELECT 'rush_swift_thrust', '追突拳(ラッシュ)'
  UNION ALL SELECT 'rush_hakkei', '発勁(ラッシュ)'
  UNION ALL SELECT 'rush_water_lotus_fist', '水蓮掌(ラッシュ)'
  UNION ALL SELECT 'rush_yokusen_kick', '翼旋脚(ラッシュ)'
  UNION ALL SELECT 'rush_falling_crane', '鶴脚落(ラッシュ)'
) AS v
WHERE c.code = 'chun_li' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== dee_jay (84 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 12 AS total, 4 AS on_hit, -1 AS on_block, 6 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 2, -2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 7, 3, 22, 5, 2, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 9, 3, 27, 6, -1, 16, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 6, 32, 3, -4, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 12, 3, 40, 1, -5, 26, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 5, 3, 15, 4, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 16, 2, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 24, 5, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 700, 8, 4, 30, NULL, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 8, 2, 29, 6, -2, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 14, 10, 38, NULL, -11, 15, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 7, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 4, 6, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 6, 4, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 8, 6, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 5, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'knee_shot', 'unique', 300, 16, 23, 41, 6, 3, 3, 1, '{"notes_tool":"ジャンプから派生。通常ジャンプ攻撃とのバリエーション型の特殊技ではなく、空中から出して即当たる系統の特殊技。豪鬼の空刃系列。"}'
  UNION ALL SELECT 'sunrise_heel', 'unique', 700, 19, 5, 39, 5, 1, 16, 0, NULL
  UNION ALL SELECT 'face_breaker', 'unique', 800, 7, 6, 32, 1, -5, 20, 0, NULL
  UNION ALL SELECT 'threebeat_combo_2hits', 'target_combo', 620, 9, 3, 31, 2, -3, 20, 0, NULL
  UNION ALL SELECT 'threebeat_combo', 'target_combo', 1058, 14, 3, 35, 3, -8, 19, 0, NULL
  UNION ALL SELECT 'dee_jay_special_2hits', 'target_combo', 1100, 11, 7, 41, 1, -11, 24, 0, NULL
  UNION ALL SELECT 'dee_jay_special', 'target_combo', 1580, 13, 3, 45, NULL, -13, 30, 0, NULL
  UNION ALL SELECT 'funky_dance_2hits', 'target_combo', 1100, 12, 2, 30, 2, -2, 17, 0, NULL
  UNION ALL SELECT 'funky_dance', 'target_combo', 900, 20, 2, 45, NULL, -8, 24, 0, '{"notes_tool":"コンボにならないので単発ダメージ"}'
  UNION ALL SELECT 'funky_dance_feint', 'target_combo', 0, 1, 22, 22, -3, -5, 0, 0, NULL
  UNION ALL SELECT 'party_in_the_air', 'target_combo', 1400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"空中ターゲットコンボなのでフレームなし"}'
  UNION ALL SELECT 'speedy_maracas', 'unique', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"ボタンホールド時間で全体が自由に変わる技なのでフレームは省略。空中技ではないが、ラッシュ版はない。"}'
  UNION ALL SELECT 'air_slasher_light', 'special', 0, 1, 21, 21, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'air_slasher_medium', 'special', 600, 17, 28, 44, 0, -5, 0, 0, NULL
  UNION ALL SELECT 'air_slasher_heavy', 'special', 1000, 17, 44, 60, 3, -3, 0, 0, NULL
  UNION ALL SELECT 'air_slasher_od', 'special', 1000, 10, 36, 45, 5, 2, 0, 0, NULL
  UNION ALL SELECT 'jackknife_maximum_light', 'special', 0, 1, 51, 51, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'jackknife_maximum_medium', 'special', 1100, 6, 17, 54, NULL, -32, 32, 0, NULL
  UNION ALL SELECT 'jackknife_maximum_heavy', 'special', 1300, 5, 29, 65, NULL, -44, 32, 0, NULL
  UNION ALL SELECT 'jackknife_maximum_od', 'special', 1500, 6, 28, 77, NULL, -55, 44, 0, NULL
  UNION ALL SELECT 'roll_through_feint', 'special', 0, 1, 26, 26, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'quick_rolling_sobat', 'special', 1000, 12, 3, 37, NULL, -6, 23, 0, NULL
  UNION ALL SELECT 'double_rolling_sobat', 'special', 1400, 15, 25, 63, 2, -10, 24, 0, NULL
  UNION ALL SELECT 'double_rolling_sobat_od', 'special', 1300, 17, 14, 49, NULL, -2, 19, 0, NULL
  UNION ALL SELECT 'machine_gun_uppercut_light', 'special', 1650, 15, 4, 53, NULL, -19, 35, 0, NULL
  UNION ALL SELECT 'machine_gun_uppercut_medium', 'special', 1900, 22, 4, 60, NULL, -19, 35, 0, NULL
  UNION ALL SELECT 'machine_gun_uppercut_heavy', 'special', 2200, 28, 4, 66, NULL, -19, 35, 0, NULL
  UNION ALL SELECT 'machine_gun_uppercut_od', 'special', 2500, 26, 4, 64, NULL, -19, 35, 0, NULL
  UNION ALL SELECT 'jus_cool_od', 'special', 500, 8, 5, 48, NULL, -18, 36, 0, NULL
  UNION ALL SELECT 'jus_cool', 'special', 0, 1, 37, 37, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'funky_slicer_od', 'special', 900, 34, 3, 60, 6, -2, 24, 0, NULL
  UNION ALL SELECT 'funky_slicer', 'special', 800, 25, 3, 52, 2, 3, 25, 0, NULL
  UNION ALL SELECT 'waning_moon_od', 'special', 1100, 44, 5, 65, 7, -2, 17, 0, NULL
  UNION ALL SELECT 'waning_moon', 'special', 1000, 38, 3, 56, NULL, 1, 16, 0, NULL
  UNION ALL SELECT 'maximum_strike_od', 'special', 1000, 36, 5, 61, NULL, -8, 21, 0, NULL
  UNION ALL SELECT 'maximum_strike', 'special', 1000, 28, 5, 57, NULL, -10, 25, 0, NULL
  UNION ALL SELECT 'juggling_dash_od', 'special', 0, 20, 17, 41, NULL, NULL, 5, 0, NULL
  UNION ALL SELECT 'juggling_dash', 'special', 0, 14, 20, 40, NULL, NULL, 7, 0, NULL
  UNION ALL SELECT 'juggling_sway_od', 'special', 0, 20, 16, 57, NULL, NULL, 22, 0, NULL
  UNION ALL SELECT 'juggling_sway', 'special', 0, 14, 17, 59, NULL, NULL, 29, 0, NULL
  UNION ALL SELECT 'sa1_the_greatest_sobat', 'super_art', 2000, 7, 4, 43, NULL, -12, 33, 0, NULL
  UNION ALL SELECT 'sa2_lowkey_sunrise_festival', 'super_art', 2600, 12, 5, 62, NULL, -29, 46, 0, NULL
  UNION ALL SELECT 'sa2_marvelous_sunrise_festival', 'super_art', 1700, 12, 5, 62, NULL, -29, 46, 0, NULL
  UNION ALL SELECT 'sa2_headliner_sunrise_festival', 'super_art', 1800, 12, 5, 62, NULL, -29, 46, 0, NULL
  UNION ALL SELECT 'sa2_climactic_strike', 'super_art', 1100, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Marvelous Sunrise FestivalかHeadliner Sunrise Festivalから派生。固定アニメーションなのでフレームは省略。ダメージはMarvelous派生のもの。Headliner派生なら1200になる。ダメージはそこまで重要ではないのとコンボ入力時にややこしくなるので1行だけ作成。"}'
  UNION ALL SELECT 'sa2_encore_beat', 'super_art', 1100, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"Marvelous Sunrise FestivalかHeadliner Sunrise Festivalから派生。固定アニメーションなのでフレームは省略。ダメージはMarvelous派生のもの。Headliner派生なら1200になる。ダメージはそこまで重要ではないのとコンボ入力時にややこしくなるので1行だけ作成。"}'
  UNION ALL SELECT 'sa3_weekend_pleasure', 'super_art', 4000, 9, 5, 61, NULL, -28, 48, 0, NULL
  UNION ALL SELECT 'ca_weekend_pleasure', 'critical_art', 4500, 9, 5, 61, NULL, -28, 48, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 23, 8, 3, 6, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 6, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 18, 3, 33, 9, 6, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 20, 3, 38, 10, 3, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 6, 43, 7, 0, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 23, 3, 51, 5, -1, 26, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 16, 3, 26, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 27, 6, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 35, 9, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 700, 19, 4, 41, NULL, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 19, 2, 40, 10, 2, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 25, 10, 49, NULL, -7, 15, 0, NULL
  UNION ALL SELECT 'rush_sunrise_heel', 'rush_variant', 700, 30, 5, 50, 9, 5, 16, 0, NULL
  UNION ALL SELECT 'rush_face_breaker', 'rush_variant', 800, 18, 6, 43, 5, -1, 20, 0, NULL
) AS v
WHERE c.code = 'dee_jay' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_sunrise_heel' THEN 'sunrise_heel'
        WHEN 'rush_face_breaker' THEN 'face_breaker'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'dee_jay' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_sunrise_heel', 'rush_face_breaker');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'knee_shot', 'ニーショット'
  UNION ALL SELECT 'sunrise_heel', 'サンライズヒール'
  UNION ALL SELECT 'face_breaker', 'フェイスブレイカー'
  UNION ALL SELECT 'threebeat_combo_2hits', '3ビートコンボ(2発止め)'
  UNION ALL SELECT 'threebeat_combo', '3ビートコンボ'
  UNION ALL SELECT 'dee_jay_special_2hits', 'ディージェイスペシャル(2発止め)'
  UNION ALL SELECT 'dee_jay_special', 'ディージェイスペシャル'
  UNION ALL SELECT 'funky_dance_2hits', 'ファンキーダンス(2発止め)'
  UNION ALL SELECT 'funky_dance', 'ファンキーダンス'
  UNION ALL SELECT 'funky_dance_feint', 'ファンキーダンス・フェイク'
  UNION ALL SELECT 'party_in_the_air', 'フライングパーティー'
  UNION ALL SELECT 'speedy_maracas', 'マラカスビート'
  UNION ALL SELECT 'air_slasher_light', '弱エアスラッシャー'
  UNION ALL SELECT 'air_slasher_medium', '中エアスラッシャー'
  UNION ALL SELECT 'air_slasher_heavy', '強エアスラッシャー'
  UNION ALL SELECT 'air_slasher_od', 'ODエアスラッシャー'
  UNION ALL SELECT 'jackknife_maximum_light', '弱ジャックナイフマキシマム'
  UNION ALL SELECT 'jackknife_maximum_medium', '中ジャックナイフマキシマム'
  UNION ALL SELECT 'jackknife_maximum_heavy', '強ジャックナイフマキシマム'
  UNION ALL SELECT 'jackknife_maximum_od', 'ODジャックナイフマキシマム'
  UNION ALL SELECT 'roll_through_feint', 'フェイクロールステップ'
  UNION ALL SELECT 'quick_rolling_sobat', 'クイックローリングソバット'
  UNION ALL SELECT 'double_rolling_sobat', 'ダブルローリングソバット'
  UNION ALL SELECT 'double_rolling_sobat_od', 'ODダブルローリングソバット'
  UNION ALL SELECT 'machine_gun_uppercut_light', '弱マシンガンアッパー'
  UNION ALL SELECT 'machine_gun_uppercut_medium', '中マシンガンアッパー'
  UNION ALL SELECT 'machine_gun_uppercut_heavy', '強マシンガンアッパー'
  UNION ALL SELECT 'machine_gun_uppercut_od', 'ODマシンガンアッパー'
  UNION ALL SELECT 'jus_cool_od', 'ODジョスクール'
  UNION ALL SELECT 'jus_cool', 'ジョスクール'
  UNION ALL SELECT 'funky_slicer_od', 'ODファンキースライサー'
  UNION ALL SELECT 'funky_slicer', 'ファンキースライサー'
  UNION ALL SELECT 'waning_moon_od', 'ODワニングムーン'
  UNION ALL SELECT 'waning_moon', 'ワニングムーン'
  UNION ALL SELECT 'maximum_strike_od', 'ODマキシマムストライク'
  UNION ALL SELECT 'maximum_strike', 'マキシマムストライク'
  UNION ALL SELECT 'juggling_dash_od', 'ODジャグリングステップ'
  UNION ALL SELECT 'juggling_dash', 'ジャグリングステップ'
  UNION ALL SELECT 'juggling_sway_od', 'ODジャグリングスウェイ'
  UNION ALL SELECT 'juggling_sway', 'ジャグリングスウェイ'
  UNION ALL SELECT 'sa1_the_greatest_sobat', 'SA1 グレイテストソバット'
  UNION ALL SELECT 'sa2_lowkey_sunrise_festival', 'SA2 サンライズフェスティバル・ライト'
  UNION ALL SELECT 'sa2_marvelous_sunrise_festival', 'SA2 サンライズフェスティバル・マーベラス'
  UNION ALL SELECT 'sa2_headliner_sunrise_festival', 'SA2 サンライズフェスティバル・マキシマム'
  UNION ALL SELECT 'sa2_climactic_strike', 'SA2 クライマックスブロー'
  UNION ALL SELECT 'sa2_encore_beat', 'SA2 アンコールビート'
  UNION ALL SELECT 'sa3_weekend_pleasure', 'SA3 サタデーナイト'
  UNION ALL SELECT 'ca_weekend_pleasure', 'CA サタデーナイト'
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
  UNION ALL SELECT 'rush_sunrise_heel', 'サンライズヒール(ラッシュ)'
  UNION ALL SELECT 'rush_face_breaker', 'フェイスブレイカー(ラッシュ)'
) AS v
WHERE c.code = 'dee_jay' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== e_honda (78 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 17 AS total, 4 AS on_hit, -1 AS on_block, 10 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 4, 2, 14, 5, -1, 9, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 10, 4, 30, 6, 1, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 10, 4, 29, 4, -3, 16, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 8, 7, 34, 1, -6, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 8, 7, 36, -1, -5, 22, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 16, 4, -1, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 15, 3, -3, 9, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 8, 4, 27, 3, -3, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 9, 3, 28, 6, -2, 17, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 11, 4, 33, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 14, 38, NULL, -10, 14, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 6, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 6, 8, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 700, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 4, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_punch', 'normal', 800, 10, 8, 46, NULL, NULL, 29, 1, '{"notes_tool":"さらに追加入力で後ろとか前へ進めるが、フレーム影響ないので無視"}'
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 8, 46, NULL, NULL, 29, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'harai_kick', 'unique', 900, 14, 3, 37, 1, -5, 21, 0, NULL
  UNION ALL SELECT 'power_stomp', 'unique', 800, 22, 6, 45, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'flying_sumo_press', 'unique', 500, 11, 9, 46, NULL, NULL, 27, 0, '{"notes_tool":"実質ジャンプ攻撃の特殊技"}'
  UNION ALL SELECT 'hundred_hand_slap_light', 'special', 800, 12, 20, 45, 2, -4, 14, 0, NULL
  UNION ALL SELECT 'hundred_hand_slap_medium', 'special', 1000, 16, 32, 64, 2, -8, 17, 0, NULL
  UNION ALL SELECT 'hundred_hand_slap_heavy', 'special', 1200, 19, 44, 79, 2, -8, 17, 0, NULL
  UNION ALL SELECT 'hundred_hand_slap_od', 'special', 800, 19, 43, 73, 4, -3, 12, 0, NULL
  UNION ALL SELECT 'sumo_spirit_light_hundred_hand_slap', 'special', 850, 12, 20, 45, 4, 0, 14, 0, NULL
  UNION ALL SELECT 'sumo_spirit_medium_hundred_hand_slap', 'special', 1050, 16, 32, 64, 4, -4, 17, 0, NULL
  UNION ALL SELECT 'sumo_spirit_heavy_hundred_hand_slap', 'special', 1250, 19, 44, 79, 4, -4, 17, 0, NULL
  UNION ALL SELECT 'sumo_spirit_od_hundred_hand_slap', 'special', 850, 19, 43, 73, 6, 1, 12, 0, NULL
  UNION ALL SELECT 'sumo_headbutt_light', 'special', 1400, 10, 22, 51, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'sumo_headbutt_medium', 'special', 1400, 10, 24, 53, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'sumo_headbutt_heavy', 'special', 1500, 14, 28, 61, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'sumo_headbutt_od', 'special', 1600, 9, 26, 54, NULL, -20, 20, 0, NULL
  UNION ALL SELECT 'sumo_smash_light', 'special', 1400, 11, 38, 65, NULL, 1, 17, 0, NULL
  UNION ALL SELECT 'sumo_smash_medium', 'special', 1400, 11, 35, 62, NULL, 1, 17, 0, NULL
  UNION ALL SELECT 'sumo_smash_heavy', 'special', 1400, 11, 32, 59, NULL, 1, 17, 0, NULL
  UNION ALL SELECT 'sumo_smash_od', 'special', 1400, 6, 34, 56, NULL, 2, 17, 0, NULL
  UNION ALL SELECT 'oicho_throw_light', 'special', 2000, 6, 4, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'oicho_throw_medium', 'special', 2200, 6, 4, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'oicho_throw_heavy', 'special', 2400, 6, 4, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'oicho_throw_od', 'special', 2800, 6, 4, 61, NULL, NULL, 52, 0, NULL
  UNION ALL SELECT 'sumo_dash_od', 'special', 0, 1, 34, 34, NULL, NULL, 0, 0, '{"notes_tool":"派生技を出さなかった場合のフレームを記載。攻撃力はない"}'
  UNION ALL SELECT 'sumo_dash', 'special', 0, 1, 44, 44, NULL, NULL, 0, 0, '{"notes_tool":"派生技を出さなかった場合のフレームを記載。攻撃力はない"}'
  UNION ALL SELECT 'teppo_triple_slap_1hit_od', 'special', 800, 22, 19, 57, 3, 3, 17, 0, '{"notes_tool":"OD相撲ステップから派生"}'
  UNION ALL SELECT 'teppo_triple_slap_1hit', 'special', 800, 22, 19, 62, NULL, -3, 22, 0, '{"notes_tool":"相撲ステップから派生"}'
  UNION ALL SELECT 'teppo_triple_slap_od', 'special', 1600, 14, 3, 54, NULL, -24, 38, 0, '{"notes_tool":"OD相撲ステップから派生"}'
  UNION ALL SELECT 'teppo_triple_slap', 'special', 1400, 14, 3, 54, NULL, -24, 38, 0, '{"notes_tool":"相撲ステップから派生"}'
  UNION ALL SELECT 'taiho_cannon_lift_od', 'special', 1000, 23, 22, 76, NULL, -22, 32, 0, '{"notes_tool":"OD相撲ステップから派生"}'
  UNION ALL SELECT 'taiho_cannon_lift', 'special', 800, 26, 22, 79, NULL, -22, 32, 0, '{"notes_tool":"相撲ステップから派生"}'
  UNION ALL SELECT 'neko_damashi', 'special', 600, 11, 5, 29, 3, -3, 14, 0, NULL
  UNION ALL SELECT 'sumo_spirit', 'special', 0, 1, 52, 52, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa1_show_of_force', 'super_art', 2000, 7, 5, 59, NULL, -33, 48, 0, NULL
  UNION ALL SELECT 'sa2_ultimate_killer_head_ram', 'super_art', 2850, 12, 12, 68, NULL, -27, 45, 0, NULL
  UNION ALL SELECT 'sa3_the_final_bout', 'super_art', 4000, 9, 14, 73, NULL, -34, 51, 0, NULL
  UNION ALL SELECT 'ca_the_final_bout', 'critical_art', 4500, 9, 14, 73, NULL, -34, 51, 0, NULL
  UNION ALL SELECT 'double_slaps', 'target_combo', 780, 4, 4, 27, NULL, -10, 20, 0, NULL
  UNION ALL SELECT 'toko_shizume', 'target_combo', 800, 22, 6, 45, 3, -3, 18, 0, '{"notes_tool":"コンボにならないので二段目単発ダメージを記載"}'
  UNION ALL SELECT 'toko_shizume_sumo_spirit', 'target_combo', 800, 22, 5, 78, -30, NULL, 52, 0, '{"notes_tool":"本来はコンボ用途。地上でそのまま当てた場合のヒット-30は正しい。なおヒットしていない場合はそもそもここへ派生できない"}'
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 28, 8, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 15, 2, 25, 9, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 21, 4, 41, 10, 5, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 21, 4, 40, 8, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 19, 7, 45, 5, -2, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 19, 7, 47, 3, -1, 22, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 27, 8, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 26, 7, 1, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 19, 4, 38, 7, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 20, 3, 39, 10, 2, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 22, 4, 44, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 14, 49, NULL, -6, 14, 0, NULL
  UNION ALL SELECT 'rush_harai_kick', 'rush_variant', 900, 25, 3, 48, 5, -1, 21, 0, NULL
  UNION ALL SELECT 'rush_power_stomp', 'rush_variant', 800, 33, 6, 56, 7, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_flying_sumo_press', 'rush_variant', 500, 22, 9, 57, NULL, NULL, 27, 0, NULL
) AS v
WHERE c.code = 'e_honda' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_harai_kick' THEN 'harai_kick'
        WHEN 'rush_power_stomp' THEN 'power_stomp'
        WHEN 'rush_flying_sumo_press' THEN 'flying_sumo_press'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'e_honda' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_harai_kick', 'rush_power_stomp', 'rush_flying_sumo_press');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'neutral_jumping_heavy_punch', '垂直ジャンプ強P'
  UNION ALL SELECT 'jumping_heavy_kick', 'ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'harai_kick', '払い蹴り'
  UNION ALL SELECT 'power_stomp', '力足'
  UNION ALL SELECT 'flying_sumo_press', 'フライングスモウプレス'
  UNION ALL SELECT 'hundred_hand_slap_light', '弱百裂張り手'
  UNION ALL SELECT 'hundred_hand_slap_medium', '中百裂張り手'
  UNION ALL SELECT 'hundred_hand_slap_heavy', '強百裂張り手'
  UNION ALL SELECT 'hundred_hand_slap_od', 'OD百裂張り手'
  UNION ALL SELECT 'sumo_spirit_light_hundred_hand_slap', '[肩屋入り版]弱百裂張り手'
  UNION ALL SELECT 'sumo_spirit_medium_hundred_hand_slap', '[肩屋入り版]中百裂張り手'
  UNION ALL SELECT 'sumo_spirit_heavy_hundred_hand_slap', '[肩屋入り版]強百裂張り手'
  UNION ALL SELECT 'sumo_spirit_od_hundred_hand_slap', '[肩屋入り版]OD百裂張り手'
  UNION ALL SELECT 'sumo_headbutt_light', '弱スーパー頭突き'
  UNION ALL SELECT 'sumo_headbutt_medium', '中スーパー頭突き'
  UNION ALL SELECT 'sumo_headbutt_heavy', '強スーパー頭突き'
  UNION ALL SELECT 'sumo_headbutt_od', 'ODスーパー頭突き'
  UNION ALL SELECT 'sumo_smash_light', '弱スーパー百貫落とし'
  UNION ALL SELECT 'sumo_smash_medium', '中スーパー百貫落とし'
  UNION ALL SELECT 'sumo_smash_heavy', '強スーパー百貫落とし'
  UNION ALL SELECT 'sumo_smash_od', 'ODスーパー百貫落とし'
  UNION ALL SELECT 'oicho_throw_light', '弱大銀杏投げ'
  UNION ALL SELECT 'oicho_throw_medium', '中大銀杏投げ'
  UNION ALL SELECT 'oicho_throw_heavy', '強大銀杏投げ'
  UNION ALL SELECT 'oicho_throw_od', 'OD大銀杏投げ'
  UNION ALL SELECT 'sumo_dash_od', 'OD相撲ステップ'
  UNION ALL SELECT 'sumo_dash', '相撲ステップ'
  UNION ALL SELECT 'teppo_triple_slap_1hit_od', 'OD鉄砲(単発)'
  UNION ALL SELECT 'teppo_triple_slap_1hit', '鉄砲(単発)'
  UNION ALL SELECT 'teppo_triple_slap_od', 'OD鉄砲'
  UNION ALL SELECT 'teppo_triple_slap', '鉄砲'
  UNION ALL SELECT 'taiho_cannon_lift_od', 'OD大砲'
  UNION ALL SELECT 'taiho_cannon_lift', '大砲'
  UNION ALL SELECT 'neko_damashi', '猫だまし'
  UNION ALL SELECT 'sumo_spirit', '肩屋入り'
  UNION ALL SELECT 'sa1_show_of_force', 'SA1 発揮爆砕'
  UNION ALL SELECT 'sa2_ultimate_killer_head_ram', 'SA2 スーパー鬼無双'
  UNION ALL SELECT 'sa3_the_final_bout', 'SA3 千秋楽'
  UNION ALL SELECT 'ca_the_final_bout', 'CA 千秋楽'
  UNION ALL SELECT 'double_slaps', '連ね張り手'
  UNION ALL SELECT 'toko_shizume', '地鎮'
  UNION ALL SELECT 'toko_shizume_sumo_spirit', '地鎮(肩屋入り)'
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
  UNION ALL SELECT 'rush_harai_kick', '払い蹴り(ラッシュ)'
  UNION ALL SELECT 'rush_power_stomp', '力足(ラッシュ)'
  UNION ALL SELECT 'rush_flying_sumo_press', 'フライングスモウプレス(ラッシュ)'
) AS v
WHERE c.code = 'e_honda' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== ed (75 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 13 AS total, 4 AS on_hit, -1 AS on_block, 7 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 6, 2, 20, 3, -3, 13, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 7, 3, 24, 6, -1, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 10, 2, 31, 0, -5, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 4, 31, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 10, 3, 24, 8, 4, 12, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 200, 4, 3, 16, 3, -3, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 300, 5, 2, 18, 2, -4, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 500, 8, 3, 29, 2, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 9, 2, 29, 8, -1, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 900, 10, 4, 37, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 800, 12, 2, 34, -1, -6, 21, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 5, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 8, 3, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 500, 8, 6, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 700, 10, 2, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 5, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 8, 2, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'psycho_knuckle', 'unique', 800, 39, 15, 88, NULL, 2, 35, 0, '{"notes_tool":"ガードフレームは端で計測。中央だとon_block-2になる。"}'
  UNION ALL SELECT 'psycho_knuckle_max_holding', 'unique', 1200, 69, 15, 118, NULL, 4, 35, 0, '{"notes_tool":"ノーマル版と違い、端でもフレーム変わらない"}'
  UNION ALL SELECT 'cobra_punch', 'unique', 900, 17, 3, 40, 1, -3, 21, 0, NULL
  UNION ALL SELECT 'flicker_combination_2hits', 'target_combo', 620, 7, 3, 24, 3, -3, 15, 0, NULL
  UNION ALL SELECT 'flicker_combination', 'target_combo', 1040, 7, 3, 25, 1, -8, 16, 0, NULL
  UNION ALL SELECT 'body_blow_combination', 'target_combo', 1000, 13, 2, 37, NULL, -8, 23, 0, NULL
  UNION ALL SELECT 'hitman_combination_2hits', 'target_combo', 900, 7, 2, 28, NULL, -6, 20, 0, NULL
  UNION ALL SELECT 'hitman_combination', 'target_combo', 1380, 11, 5, 38, NULL, -11, 23, 0, NULL
  UNION ALL SELECT 'low_smash_combination', 'target_combo', 1500, 10, 5, 33, NULL, -8, 19, 0, NULL
  UNION ALL SELECT 'psycho_spark_od', 'special', 400, 14, 12, 32, NULL, -2, 7, 0, NULL
  UNION ALL SELECT 'psycho_spark', 'special', 400, 14, 12, 33, 3, -5, 8, 0, NULL
  UNION ALL SELECT 'psycho_shoot_light', 'special', 600, 33, 31, 63, 3, -8, 0, 0, '{"notes_tool":"サイコスパーク派生"}'
  UNION ALL SELECT 'psycho_shoot_medium', 'special', 600, 33, 31, 63, 3, -8, 0, 0, '{"notes_tool":"サイコスパーク派生"}'
  UNION ALL SELECT 'psycho_shoot_heavy', 'special', 600, 33, 31, 63, 3, -8, 0, 0, '{"notes_tool":"サイコスパーク派生"}'
  UNION ALL SELECT 'psycho_shoot_od', 'special', 800, 30, 29, 58, NULL, -2, 0, 0, '{"notes_tool":"ODサイコスパーク派生"}'
  UNION ALL SELECT 'psycho_uppercut_light', 'special', 900, 10, 8, 45, NULL, -13, 28, 0, NULL
  UNION ALL SELECT 'psycho_uppercut_medium', 'special', 1000, 14, 6, 51, NULL, -20, 32, 0, NULL
  UNION ALL SELECT 'psycho_uppercut_heavy', 'special', 1200, 16, 6, 54, NULL, -21, 33, 0, NULL
  UNION ALL SELECT 'psycho_uppercut_od', 'special', 1600, 13, 6, 54, NULL, -28, 36, 0, NULL
  UNION ALL SELECT 'psycho_blitz_light', 'special', 800, 11, 19, 43, 3, -5, 14, 0, NULL
  UNION ALL SELECT 'psycho_blitz_medium', 'special', 900, 13, 24, 52, NULL, -12, 16, 0, NULL
  UNION ALL SELECT 'psycho_blitz_heavy', 'special', 1100, 15, 23, 60, NULL, -12, 23, 0, NULL
  UNION ALL SELECT 'psycho_blitz_od', 'special', 1400, 13, 32, 64, NULL, -4, 20, 0, NULL
  UNION ALL SELECT 'psycho_flicker_light', 'special', 800, 16, 4, 45, 1, -6, 26, 0, NULL
  UNION ALL SELECT 'psycho_flicker_medium', 'special', 900, 20, 4, 49, 3, -6, 26, 0, NULL
  UNION ALL SELECT 'psycho_flicker_heavy', 'special', 800, 17, 8, 42, NULL, NULL, 18, 0, '{"notes_tool":"地上から出す技だが、空中の相手にのみヒット。fastest_unreachable についてはtrueかfalseか迷っている"}'
  UNION ALL SELECT 'psycho_flicker_od', 'special', 800, 25, 4, 60, NULL, 4, 32, 0, NULL
  UNION ALL SELECT 'psycho_flicker_holding_light', 'special', 1000, 31, 5, 59, NULL, 4, 24, 0, NULL
  UNION ALL SELECT 'psycho_flicker_holding_medium', 'special', 1000, 35, 5, 63, NULL, 4, 24, 0, NULL
  UNION ALL SELECT 'psycho_flicker_holding_heavy', 'special', 1000, 35, 10, 63, NULL, NULL, 19, 0, '{"notes_tool":"地上から出す技だが、空中の相手にのみヒット。fastest_unreachable についてはtrueかfalseか迷っている"}'
  UNION ALL SELECT 'kill_rush_forward', 'special', 0, 1, 31, 31, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'kill_rush_backward', 'special', 0, 1, 31, 31, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'kill_switch_break', 'special', 600, 22, 3, 44, NULL, -4, 20, 0, '{"notes_tool":"Kill Rush Forwardから、押すタイミングで派生が変わる"}'
  UNION ALL SELECT 'kill_switch_chaser', 'special', 600, 24, 3, 46, NULL, -6, 20, 0, '{"notes_tool":"Kill Rush Forwardから、押すタイミングで派生が変わる"}'
  UNION ALL SELECT 'sa1_psycho_storm', 'super_art', 2000, 13, 55, 123, NULL, -32, 56, 0, NULL
  UNION ALL SELECT 'sa2_psycho_cannon', 'super_art', 1100, 8, 28, 35, NULL, 65, 0, 0, '{"notes_tool":"ボタンにより性能変化する。フレーム影響なし。modifyでユーザーは強度を扱えばいい。"}'
  UNION ALL SELECT 'sa3_psycho_chamber', 'super_art', 4000, 10, 10, 83, NULL, -49, 64, 0, NULL
  UNION ALL SELECT 'ca_psycho_chamber', 'critical_art', 4500, 10, 10, 83, NULL, -49, 64, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 24, 8, 3, 7, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 17, 2, 31, 7, 1, 13, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 18, 3, 35, 10, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 21, 2, 42, 4, -1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 4, 42, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 21, 3, 35, 12, 8, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 200, 15, 3, 27, 7, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 300, 16, 2, 29, 6, 0, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 500, 19, 3, 40, 6, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 20, 2, 40, 12, 3, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 900, 21, 4, 48, NULL, -8, 24, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 800, 23, 2, 45, 3, -2, 21, 0, NULL
  UNION ALL SELECT 'rush_psycho_knuckle', 'rush_variant', 800, 50, 15, 99, NULL, 6, 35, 0, NULL
  UNION ALL SELECT 'rush_psycho_knuckle_max_holding', 'rush_variant', 1200, 80, 15, 129, NULL, 8, 35, 0, NULL
  UNION ALL SELECT 'rush_cobra_punch', 'rush_variant', 900, 28, 3, 51, 5, 1, 21, 0, NULL
) AS v
WHERE c.code = 'ed' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_psycho_knuckle' THEN 'psycho_knuckle'
        WHEN 'rush_psycho_knuckle_max_holding' THEN 'psycho_knuckle_max_holding'
        WHEN 'rush_cobra_punch' THEN 'cobra_punch'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ed' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_psycho_knuckle', 'rush_psycho_knuckle_max_holding', 'rush_cobra_punch');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'psycho_knuckle', 'サイコナックル'
  UNION ALL SELECT 'psycho_knuckle_max_holding', '【最大ホールド】サイコナックル'
  UNION ALL SELECT 'cobra_punch', 'コブラパンチ'
  UNION ALL SELECT 'flicker_combination_2hits', 'フリッカーコンビネーション(2発止め)'
  UNION ALL SELECT 'flicker_combination', 'フリッカーコンビネーション'
  UNION ALL SELECT 'body_blow_combination', 'ボディブローコンビネーション'
  UNION ALL SELECT 'hitman_combination_2hits', 'ヒットマンコンビネーション(2発止め)'
  UNION ALL SELECT 'hitman_combination', 'ヒットマンコンビネーション'
  UNION ALL SELECT 'low_smash_combination', 'ロースマッシュコンビネーション'
  UNION ALL SELECT 'psycho_spark_od', 'ODサイコスパーク'
  UNION ALL SELECT 'psycho_spark', 'サイコスパーク'
  UNION ALL SELECT 'psycho_shoot_light', '弱サイコシュート'
  UNION ALL SELECT 'psycho_shoot_medium', '中サイコシュート'
  UNION ALL SELECT 'psycho_shoot_heavy', '強サイコシュート'
  UNION ALL SELECT 'psycho_shoot_od', 'ODサイコシュート'
  UNION ALL SELECT 'psycho_uppercut_light', '弱サイコアッパー'
  UNION ALL SELECT 'psycho_uppercut_medium', '中サイコアッパー'
  UNION ALL SELECT 'psycho_uppercut_heavy', '強サイコアッパー'
  UNION ALL SELECT 'psycho_uppercut_od', 'ODサイコアッパー'
  UNION ALL SELECT 'psycho_blitz_light', '弱サイコブリッツ'
  UNION ALL SELECT 'psycho_blitz_medium', '中サイコブリッツ'
  UNION ALL SELECT 'psycho_blitz_heavy', '強サイコブリッツ'
  UNION ALL SELECT 'psycho_blitz_od', 'ODサイコブリッツ'
  UNION ALL SELECT 'psycho_flicker_light', '弱サイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_medium', '中サイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_heavy', '強サイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_od', 'ODサイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_holding_light', '【ホールド】弱サイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_holding_medium', '【ホールド】中サイコフリッカー'
  UNION ALL SELECT 'psycho_flicker_holding_heavy', '【ホールド】強サイコフリッカー'
  UNION ALL SELECT 'kill_rush_forward', 'キルステップ(前方)'
  UNION ALL SELECT 'kill_rush_backward', 'キルステップ(後方)'
  UNION ALL SELECT 'kill_switch_break', 'キルスイッチ・ブレイク'
  UNION ALL SELECT 'kill_switch_chaser', 'キルスイッチ・チェイス'
  UNION ALL SELECT 'sa1_psycho_storm', 'SA1 サイコストーム'
  UNION ALL SELECT 'sa2_psycho_cannon', 'SA2 サイコキャノン'
  UNION ALL SELECT 'sa3_psycho_chamber', 'SA3 サイコチェンバー'
  UNION ALL SELECT 'ca_psycho_chamber', 'CA サイコチェンバー'
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
  UNION ALL SELECT 'rush_psycho_knuckle', 'サイコナックル(ラッシュ)'
  UNION ALL SELECT 'rush_psycho_knuckle_max_holding', '【最大ホールド】サイコナックル(ラッシュ)'
  UNION ALL SELECT 'rush_cobra_punch', 'コブラパンチ(ラッシュ)'
) AS v
WHERE c.code = 'ed' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== elena (99 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 4 AS active, 16 AS total, 4 AS on_hit, -2 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 2, -4, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 8, 5, 27, 3, -3, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 500, 6, 4, 24, 5, 1, 15, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 12, 4, 35, 2, -2, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 12, 4, 34, 2, -4, 19, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 5, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 15, 3, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 8, 3, 30, 1, -4, 20, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 9, 3, 29, 4, -3, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 9, 10, 38, 6, -7, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 3, 37, NULL, -12, 24, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 5, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 11, 46, NULL, NULL, 26, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'slide', 'unique', 900, 14, 9, 44, NULL, -10, 22, 0, NULL
  UNION ALL SELECT 'round_arch', 'unique', 900, 14, 4, 36, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'handstand_whip_1hit', 'unique', 600, 20, 3, 41, 2, -3, 19, 0, NULL
  UNION ALL SELECT 'starling_beak', 'target_combo', 1000, 17, 5, 50, -4, -10, 29, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'handstand_whip', 'target_combo', 1200, 14, 3, 42, NULL, -14, 26, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'hind_kick', 'target_combo', 900, 12, 3, 38, NULL, -8, 24, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'fluttering_lark', 'target_combo', 920, 15, 1, 35, 4, -23, 20, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。ガードフレームについて、このターゲットコンボは1段目をガードすると、2段目はスカる仕様なので、ちょっと他とは違うが、実質的に必要な情報は-23で満たしている"}'
  UNION ALL SELECT 'turning_tail', 'target_combo', 1600, 17, 11, 44, NULL, -3, 17, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'trunk_slap_1hit', 'unique', 900, 16, 4, 39, 1, -4, 20, 0, NULL
  UNION ALL SELECT 'trunk_slap_2hits', 'target_combo', 1400, 13, 3, 41, -2, -11, 26, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'trunk_slap', 'target_combo', 2000, 7, 11, 44, NULL, -16, 27, 0, '{"notes_tool":"空振りでは出ないターゲットコンボ。ダメージは通し。"}'
  UNION ALL SELECT 'soaring_raid', 'target_combo', 800, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"エッジケース。地上の相手にジャンプ弱Pを当てると、着地前にターゲットコンボを出せるという特殊な技。空中ターゲットコンボと同じ扱いにしフレームは入れなかった。"}'
  UNION ALL SELECT 'raptor_range', 'target_combo', 1400, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"空中ターゲットコンボ"}'
  UNION ALL SELECT 'rhino_horn_light', 'special', 1100, 13, 21, 52, NULL, -9, 19, 0, NULL
  UNION ALL SELECT 'rhino_horn_medium', 'special', 1200, 17, 22, 58, NULL, -9, 20, 0, NULL
  UNION ALL SELECT 'rhino_horn_heavy', 'special', 1300, 21, 22, 62, NULL, -9, 20, 0, NULL
  UNION ALL SELECT 'rhino_horn_od', 'special', 1200, 11, 25, 54, NULL, -9, 19, 0, NULL
  UNION ALL SELECT 'scratch_wheel_light', 'special', 1000, 5, 5, 48, NULL, -24, 39, 0, NULL
  UNION ALL SELECT 'scratch_wheel_medium', 'special', 1200, 6, 6, 55, NULL, -30, 44, 0, NULL
  UNION ALL SELECT 'scratch_wheel_heavy', 'special', 1400, 7, 6, 60, NULL, -33, 48, 0, NULL
  UNION ALL SELECT 'scratch_wheel_od', 'special', 1600, 6, 23, 72, NULL, -46, 44, 0, NULL
  UNION ALL SELECT 'lynx_song_light', 'special', 0, 11, 11, 28, NULL, NULL, 7, 0, NULL
  UNION ALL SELECT 'lynx_song_medium', 'special', 0, 11, 12, 36, NULL, NULL, 14, 0, NULL
  UNION ALL SELECT 'lynx_song_heavy', 'special', 0, 11, 14, 38, NULL, NULL, 14, 0, NULL
  UNION ALL SELECT 'lynx_song_od', 'special', 0, 8, 19, 29, NULL, NULL, 3, 0, NULL
  UNION ALL SELECT 'leopard_snap_od', 'special', 1200, 10, 13, 37, NULL, 1, 15, 0, '{"notes_tool":"ODリンクシング、または、ODリンクスワールからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'leopard_snap', 'special', 1000, 10, 5, 36, NULL, -5, 22, 0, '{"notes_tool":"リンクシングからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'buffed_leopard_snap', 'special', 1200, 10, 13, 37, NULL, 1, 15, 0, '{"notes_tool":"リンクスワール（スピンサイズ派生版含む）からの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'harvest_circle_od', 'special', 1300, 8, 12, 35, NULL, -4, 16, 0, '{"notes_tool":"ODリンクシング、または、ODリンクスワールからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'harvest_circle', 'special', 900, 8, 3, 33, NULL, -9, 23, 0, '{"notes_tool":"リンクシングからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'buffed_harvest_circle', 'special', 1300, 8, 12, 35, NULL, -4, 16, 0, '{"notes_tool":"リンクスワール（スピンサイズ派生版含む）からの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'mallet_smash_od', 'special', 1000, 8, 12, 35, 4, 3, 16, 0, '{"notes_tool":"ODリンクシング、または、ODリンクスワールからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'mallet_smash', 'special', 800, 22, 3, 43, 2, -3, 19, 0, '{"notes_tool":"リンクシングからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'buffed_mallet_smash', 'special', 1000, 22, 6, 43, 4, 3, 16, 0, '{"notes_tool":"リンクスワール（スピンサイズ派生版含む）からの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_od', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"ODリンクシング、または、ODリンクスワールからの派生。何度でも派生可能。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_light', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"リンクシング、または、任意強度のリンクスワール（スピンサイズ派生版含む）からの派生。何度でも派生可能。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_medium', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"リンクシング、または、任意強度のリンクスワール（スピンサイズ派生版含む）からの派生。何度でも派生可能。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_heavy', 'special', 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"リンクシング、または、任意強度のリンクスワール（スピンサイズ派生版含む）からの派生。何度でも派生可能。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'moon_glider_1hit_light', 'special', 800, 20, 3, 42, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'moon_glider_1hit_medium', 'special', 800, 24, 3, 45, 2, -2, 19, 0, NULL
  UNION ALL SELECT 'moon_glider_1hit_heavy', 'special', 800, 28, 3, 50, 2, -2, 20, 0, NULL
  UNION ALL SELECT 'moon_glider_1hit_od', 'special', 800, 23, 3, 45, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'moon_glider_light', 'special', 1400, 16, 10, 50, NULL, -13, 25, 0, '{"notes_tool":"同じ強度のMoon Glider派生。空振りではでないターゲットコンボ系のspecial"}'
  UNION ALL SELECT 'moon_glider_medium', 'special', 1400, 16, 10, 50, NULL, -13, 25, 0, '{"notes_tool":"同じ強度のMoon Glider派生。空振りではでないターゲットコンボ系のspecial"}'
  UNION ALL SELECT 'moon_glider_heavy', 'special', 1400, 16, 10, 50, NULL, -13, 25, 0, '{"notes_tool":"同じ強度のMoon Glider派生。空振りではでないターゲットコンボ系のspecial"}'
  UNION ALL SELECT 'moon_glider_od', 'special', 1900, 16, 32, 82, NULL, -19, 35, 0, '{"notes_tool":"同じ強度のMoon Glider派生。空振りではでないターゲットコンボ系のspecial"}'
  UNION ALL SELECT 'spinning_scythe_light', 'special', 900, 15, 53, 91, NULL, -12, 24, 0, '{"notes_tool":"ヒット時のみスピンサイズに派生可能でフレームやダメージが変わるが今回は取り扱わない"}'
  UNION ALL SELECT 'spinning_scythe_medium', 'special', 1000, 20, 57, 103, NULL, -14, 27, 0, '{"notes_tool":"ヒット時のみスピンサイズに派生可能でフレームやダメージが変わるが今回は取り扱わない"}'
  UNION ALL SELECT 'spinning_scythe_heavy', 'special', 1200, 24, 55, 101, NULL, -10, 23, 0, '{"notes_tool":"ヒット時のみスピンサイズに派生可能でフレームやダメージが変わるが今回は取り扱わない"}'
  UNION ALL SELECT 'spinning_scythe_od', 'special', 1000, 18, 51, 90, NULL, -10, 22, 0, '{"notes_tool":"ヒット時のみスピンサイズに派生可能でフレームやダメージが変わるが今回は取り扱わない"}'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_light', 'special', 0, NULL, NULL, NULL, NULL, -12, NULL, 0, '{"notes_tool":"弱中強スピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_medium', 'special', 0, NULL, NULL, NULL, NULL, -20, NULL, 0, '{"notes_tool":"弱中強スピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_heavy', 'special', 0, NULL, NULL, NULL, NULL, -22, NULL, 0, '{"notes_tool":"弱中強スピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。"}'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_light', 'special', 0, NULL, NULL, NULL, NULL, -10, NULL, 0, '{"notes_tool":"ODスピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。確定反撃を調べる需要があるため分けた。"}'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_medium', 'special', 0, NULL, NULL, NULL, NULL, -18, NULL, 0, '{"notes_tool":"ODスピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。確定反撃を調べる需要があるため分けた。"}'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_heavy', 'special', 0, NULL, NULL, NULL, NULL, -20, NULL, 0, '{"notes_tool":"ODスピンサイズからの派生。複雑な派生を持つため、とりあえずmoveは用意するが、セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある。確定反撃を調べる需要があるため分けた。"}'
  UNION ALL SELECT 'sa1_meteor_volley', 'super_art', 1800, 7, 33, 94, NULL, -68, 55, 0, NULL
  UNION ALL SELECT 'sa2_revival_dance', 'super_art', 2800, 12, 6, 79, NULL, -47, 62, 0, NULL
  UNION ALL SELECT 'sa2_revival_dance_healing', 'super_art', 1950, 12, 6, 79, NULL, -47, 62, 0, '{"notes_tool":"SA2 Revival Dance中に下入力。空振り時は発動せず、通常のSA2と同じフレームになるので、throughではなくstandalone"}'
  UNION ALL SELECT 'sa3_song_of_the_grasslands', 'super_art', 4000, 8, 4, 79, NULL, -54, 68, 0, NULL
  UNION ALL SELECT 'ca_song_of_the_grasslands', 'critical_art', 4500, 8, 4, 79, NULL, -54, 68, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 4, 27, 8, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 6, 0, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 19, 5, 38, 7, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 500, 17, 4, 35, 9, 5, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 23, 4, 46, 6, 2, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 23, 4, 45, 6, 0, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 9, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 26, 7, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 19, 3, 41, 5, 0, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 20, 3, 40, 8, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 20, 10, 49, 10, -3, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 3, 48, NULL, -8, 24, 0, NULL
  UNION ALL SELECT 'rush_slide', 'rush_variant', 900, 25, 9, 55, NULL, -6, 22, 0, NULL
  UNION ALL SELECT 'rush_round_arch', 'rush_variant', 900, 25, 4, 47, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_handstand_whip_1hit', 'rush_variant', 600, 31, 3, 52, 6, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_trunk_slap_1hit', 'rush_variant', 900, 27, 4, 50, 5, 0, 20, 0, NULL
) AS v
WHERE c.code = 'elena' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_slide' THEN 'slide'
        WHEN 'rush_round_arch' THEN 'round_arch'
        WHEN 'rush_handstand_whip_1hit' THEN 'handstand_whip_1hit'
        WHEN 'rush_trunk_slap_1hit' THEN 'trunk_slap_1hit'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'elena' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_slide', 'rush_round_arch', 'rush_handstand_whip_1hit', 'rush_trunk_slap_1hit');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'slide', 'スライディング'
  UNION ALL SELECT 'round_arch', 'ラウンドアーチ'
  UNION ALL SELECT 'handstand_whip_1hit', 'ハンドスタンドウィップ(単発)'
  UNION ALL SELECT 'starling_beak', 'スターリングビーク'
  UNION ALL SELECT 'handstand_whip', 'ハンドスタンドウィップ'
  UNION ALL SELECT 'hind_kick', 'ハインドキック'
  UNION ALL SELECT 'fluttering_lark', 'ラークフラッター'
  UNION ALL SELECT 'turning_tail', 'ターニングテイル'
  UNION ALL SELECT 'trunk_slap_1hit', 'トランクスラップ(単発)'
  UNION ALL SELECT 'trunk_slap_2hits', 'トランクスラップ(2発止め)'
  UNION ALL SELECT 'trunk_slap', 'トランクスラップ'
  UNION ALL SELECT 'soaring_raid', 'ソアーレイド'
  UNION ALL SELECT 'raptor_range', 'ラプターレンジ'
  UNION ALL SELECT 'rhino_horn_light', '弱ライノホーン'
  UNION ALL SELECT 'rhino_horn_medium', '中ライノホーン'
  UNION ALL SELECT 'rhino_horn_heavy', '強ライノホーン'
  UNION ALL SELECT 'rhino_horn_od', 'ODライノホーン'
  UNION ALL SELECT 'scratch_wheel_light', '弱スクラッチホイール'
  UNION ALL SELECT 'scratch_wheel_medium', '中スクラッチホイール'
  UNION ALL SELECT 'scratch_wheel_heavy', '強スクラッチホイール'
  UNION ALL SELECT 'scratch_wheel_od', 'ODスクラッチホイール'
  UNION ALL SELECT 'lynx_song_light', '弱リンクシング'
  UNION ALL SELECT 'lynx_song_medium', '中リンクシング'
  UNION ALL SELECT 'lynx_song_heavy', '強リンクシング'
  UNION ALL SELECT 'lynx_song_od', 'ODリンクシング'
  UNION ALL SELECT 'leopard_snap_od', 'ODレオパードスナップ'
  UNION ALL SELECT 'leopard_snap', 'レオパードスナップ'
  UNION ALL SELECT 'buffed_leopard_snap', '【強化】レオパードスナップ'
  UNION ALL SELECT 'harvest_circle_od', 'ODハーベストサークル'
  UNION ALL SELECT 'harvest_circle', 'ハーベストサークル'
  UNION ALL SELECT 'buffed_harvest_circle', '【強化】ハーベストサークル'
  UNION ALL SELECT 'mallet_smash_od', 'ODマレットスマッシュ'
  UNION ALL SELECT 'mallet_smash', 'マレットスマッシュ'
  UNION ALL SELECT 'buffed_mallet_smash', '【強化】マレットスマッシュ'
  UNION ALL SELECT 'lynx_whirl_od', 'ODリンクスワール'
  UNION ALL SELECT 'lynx_whirl_light', '弱リンクスワール'
  UNION ALL SELECT 'lynx_whirl_medium', '中リンクスワール'
  UNION ALL SELECT 'lynx_whirl_heavy', '強リンクスワール'
  UNION ALL SELECT 'moon_glider_1hit_light', '弱ムーングライド(単発)'
  UNION ALL SELECT 'moon_glider_1hit_medium', '中ムーングライド(単発)'
  UNION ALL SELECT 'moon_glider_1hit_heavy', '強ムーングライド(単発)'
  UNION ALL SELECT 'moon_glider_1hit_od', 'ODムーングライド(単発)'
  UNION ALL SELECT 'moon_glider_light', '弱ムーングライド'
  UNION ALL SELECT 'moon_glider_medium', '中ムーングライド'
  UNION ALL SELECT 'moon_glider_heavy', '強ムーングライド'
  UNION ALL SELECT 'moon_glider_od', 'ODムーングライド'
  UNION ALL SELECT 'spinning_scythe_light', '弱スピンサイズ'
  UNION ALL SELECT 'spinning_scythe_medium', '中スピンサイズ'
  UNION ALL SELECT 'spinning_scythe_heavy', '強スピンサイズ'
  UNION ALL SELECT 'spinning_scythe_od', 'ODスピンサイズ'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_light', '弱リンクスワール(スピンサイズ派生)'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_medium', '中リンクスワール(スピンサイズ派生)'
  UNION ALL SELECT 'lynx_whirl_spinning_scythe_heavy', '強リンクスワール(スピンサイズ派生)'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_light', '弱リンクスワール(ODスピンサイズ派生)'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_medium', '中リンクスワール(ODスピンサイズ派生)'
  UNION ALL SELECT 'lynx_whirl_od_spinning_scythe_heavy', '強リンクスワール(ODスピンサイズ派生)'
  UNION ALL SELECT 'sa1_meteor_volley', 'SA1 ミーティアボレー'
  UNION ALL SELECT 'sa2_revival_dance', 'SA2 リヴァイブダンス'
  UNION ALL SELECT 'sa2_revival_dance_healing', 'SA2 リヴァイブダンス(ヒーリング派生)'
  UNION ALL SELECT 'sa3_song_of_the_grasslands', 'SA3 グラスランドソング'
  UNION ALL SELECT 'ca_song_of_the_grasslands', 'CA グラスランドソング'
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
  UNION ALL SELECT 'rush_slide', 'スライディング(ラッシュ)'
  UNION ALL SELECT 'rush_round_arch', 'ラウンドアーチ(ラッシュ)'
  UNION ALL SELECT 'rush_handstand_whip_1hit', 'ハンドスタンドウィップ(単発)(ラッシュ)'
  UNION ALL SELECT 'rush_trunk_slap_1hit', 'トランクスラップ(単発)(ラッシュ)'
) AS v
WHERE c.code = 'elena' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== sagat (77 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 18 AS total, 4 AS on_hit, -3 AS on_block, 11 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 400, 7, 2, 25, 0, -4, 17, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 4, 24, 6, 2, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 11, 4, 33, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 15, 4, 43, 0, -5, 25, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 10, 6, 40, 1, -5, 25, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 15, 5, -1, 10, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 19, 1, -3, 12, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 3, 28, 4, -1, 19, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 9, 3, 29, 5, -2, 18, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 11, 4, 35, 1, -5, 21, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 3, 39, NULL, -12, 26, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 7, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 10, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 5, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 700, 8, 8, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 6, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'tiger_heavy_elbow', 'unique', 700, 22, 3, 43, 3, -3, 19, 0, NULL
  UNION ALL SELECT 'tiger_monolith', 'unique', 800, 8, 8, 40, NULL, -10, 25, 0, NULL
  UNION ALL SELECT 'low_step_kick', 'unique', 700, 18, 3, 41, 3, -3, 21, 0, NULL
  UNION ALL SELECT 'high_step_kick', 'unique', 900, 16, 4, 40, 7, 4, 21, 0, NULL
  UNION ALL SELECT 'middle_step_kick', 'target_combo', 1500, 16, 3, 41, NULL, -8, 23, 0, '{"notes_tool":"空振りで出ない"}'
  UNION ALL SELECT 'tiger_sting', 'target_combo', 2000, 16, 3, 45, NULL, -12, 27, 0, '{"notes_tool":"空振りで出ない"}'
  UNION ALL SELECT 'tiger_slash', 'target_combo', 700, 20, 3, 49, -2, -14, 27, 0, '{"notes_tool":"空振りで出ない、コンボにならないので単発ダメージ値"}'
  UNION ALL SELECT 'tiger_rise', 'target_combo', 1535, 18, 4, 47, NULL, -10, 26, 0, '{"notes_tool":"空振りで出ない"}'
  UNION ALL SELECT 'low_tiger_shot', 'special', 600, 14, 37, 50, -3, -7, 0, 0, NULL
  UNION ALL SELECT 'low_tiger_shot_od', 'special', 800, 12, 33, 44, NULL, -1, 0, 0, NULL
  UNION ALL SELECT 'high_tiger_shot_medium', 'special', 700, 16, 27, 42, 3, 3, 0, 0, NULL
  UNION ALL SELECT 'high_tiger_shot_heavy', 'special', 700, 12, 31, 42, -1, -1, 0, 0, NULL
  UNION ALL SELECT 'high_tiger_shot_od', 'special', 1000, 21, 28, 48, NULL, 6, 0, 0, NULL
  UNION ALL SELECT 'tiger_uppercut_light', 'special', 1100, 5, 10, 61, NULL, -37, 47, 0, NULL
  UNION ALL SELECT 'tiger_uppercut_medium', 'special', 1400, 10, 10, 74, NULL, -45, 55, 0, NULL
  UNION ALL SELECT 'tiger_uppercut_heavy', 'special', 1600, 18, 10, 82, NULL, -45, 55, 0, NULL
  UNION ALL SELECT 'tiger_uppercut_holding_heavy', 'special', 2800, 35, 10, 99, NULL, -45, 55, 0, NULL
  UNION ALL SELECT 'tiger_uppercut_od', 'special', 1600, 8, 12, 72, NULL, -43, 53, 0, NULL
  UNION ALL SELECT 'tiger_knee_crush_light', 'special', 800, 14, 11, 42, NULL, -8, 18, 0, NULL
  UNION ALL SELECT 'tiger_knee_crush_medium', 'special', 1000, 18, 11, 46, NULL, -7, 18, 0, NULL
  UNION ALL SELECT 'tiger_knee_crush_heavy', 'special', 1400, 22, 19, 58, NULL, -5, 18, 0, NULL
  UNION ALL SELECT 'tiger_knee_crush_od', 'special', 1600, 19, 18, 54, NULL, -2, 18, 0, NULL
  UNION ALL SELECT 'tiger_nexus_light', 'special', 500, 17, 3, 42, 2, -5, 23, 0, NULL
  UNION ALL SELECT 'tiger_nexus_medium', 'special', 500, 20, 3, 45, 2, -5, 23, 0, NULL
  UNION ALL SELECT 'tiger_nexus_heavy', 'special', 500, 28, 8, 55, 4, -3, 20, 0, NULL
  UNION ALL SELECT 'tiger_nexus_od', 'special', 500, 23, 8, 50, 4, -3, 20, 0, NULL
  UNION ALL SELECT 'mighty_tiger_od', 'special', 800, 15, 3, 39, 3, -3, 22, 0, '{"notes_tool":"ODタイガーネクサスから派生。ただし空振りでは出せない。"}'
  UNION ALL SELECT 'mighty_tiger', 'special', 800, 15, 3, 39, 3, -5, 22, 0, '{"notes_tool":"弱中強タイガーネクサスから派生。空振りでは出せない。"}'
  UNION ALL SELECT 'greedy_tiger_od', 'special', 1000, 17, 3, 36, NULL, 4, 17, 0, '{"notes_tool":"ODタイガーネクサスから派生。ただし空振りでは出せない。"}'
  UNION ALL SELECT 'greedy_tiger', 'special', 1000, 17, 3, 36, NULL, 4, 17, 0, '{"notes_tool":"弱中強タイガーネクサスから派生。空振りでは出せない。"}'
  UNION ALL SELECT 'nova_tiger_od', 'special', 800, 21, 3, 42, NULL, 2, 19, 0, '{"notes_tool":"ODタイガーネクサスから派生。ただし空振りでは出せない。"}'
  UNION ALL SELECT 'nova_tiger', 'special', 800, 21, 3, 42, NULL, 2, 19, 0, '{"notes_tool":"弱中強タイガーネクサスから派生。空振りでは出せない。"}'
  UNION ALL SELECT 'sa1_tiger_cannon', 'super_art', 2200, 13, 16, 109, NULL, -31, 81, 0, NULL
  UNION ALL SELECT 'sa2_savage_tiger_raid', 'super_art', 3000, 10, 5, 87, NULL, -58, 73, 0, NULL
  UNION ALL SELECT 'sa2_savage_tiger_zenith', 'super_art', 1700, 10, 5, 87, NULL, -58, 73, 0, NULL
  UNION ALL SELECT 'sa2_savage_tiger_pendulum', 'super_art', 2700, 10, 5, 87, NULL, -58, 73, 0, NULL
  UNION ALL SELECT 'sa2_savage_tiger_stomp', 'super_art', 2700, 10, 5, 87, NULL, -58, 73, 0, NULL
  UNION ALL SELECT 'sa3_tiger_vanquisher', 'super_art', 4000, 12, 4, 82, NULL, -51, 67, 0, NULL
  UNION ALL SELECT 'ca_tiger_vanquisher', 'critical_art', 4500, 12, 4, 82, NULL, -51, 67, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 29, 8, 1, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 400, 18, 2, 36, 4, 0, 17, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 4, 35, 10, 6, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 22, 4, 44, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 26, 4, 54, 4, -1, 25, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 21, 6, 51, 5, -1, 25, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 26, 9, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 30, 5, 1, 12, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 3, 39, 8, 3, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 20, 3, 40, 9, 2, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 22, 4, 46, 5, -1, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 3, 50, NULL, -8, 26, 0, NULL
  UNION ALL SELECT 'rush_tiger_heavy_elbow', 'rush_variant', 700, 33, 3, 54, 7, 1, 19, 0, NULL
  UNION ALL SELECT 'rush_tiger_monolith', 'rush_variant', 800, 19, 8, 51, NULL, -6, 25, 0, NULL
  UNION ALL SELECT 'rush_low_step_kick', 'rush_variant', 700, 29, 3, 52, 7, 1, 21, 0, NULL
  UNION ALL SELECT 'rush_high_step_kick', 'rush_variant', 900, 27, 4, 51, 11, 8, 21, 0, NULL
) AS v
WHERE c.code = 'sagat' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_tiger_heavy_elbow' THEN 'tiger_heavy_elbow'
        WHEN 'rush_tiger_monolith' THEN 'tiger_monolith'
        WHEN 'rush_low_step_kick' THEN 'low_step_kick'
        WHEN 'rush_high_step_kick' THEN 'high_step_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'sagat' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_tiger_heavy_elbow', 'rush_tiger_monolith', 'rush_low_step_kick', 'rush_high_step_kick');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'tiger_heavy_elbow', 'タイガーヘビーエルボー'
  UNION ALL SELECT 'tiger_monolith', 'タイガーモノリス'
  UNION ALL SELECT 'low_step_kick', 'ステップローキック'
  UNION ALL SELECT 'high_step_kick', 'ステップハイキック'
  UNION ALL SELECT 'middle_step_kick', 'ステップミドルキック'
  UNION ALL SELECT 'tiger_sting', 'タイガースティング'
  UNION ALL SELECT 'tiger_slash', 'タイガースラッシュ'
  UNION ALL SELECT 'tiger_rise', 'タイガーライズ'
  UNION ALL SELECT 'low_tiger_shot', 'グランドタイガーショット'
  UNION ALL SELECT 'low_tiger_shot_od', 'ODグランドタイガーショット'
  UNION ALL SELECT 'high_tiger_shot_medium', '中タイガーショット'
  UNION ALL SELECT 'high_tiger_shot_heavy', '強タイガーショット'
  UNION ALL SELECT 'high_tiger_shot_od', 'ODタイガーショット'
  UNION ALL SELECT 'tiger_uppercut_light', '弱タイガーアッパーカット'
  UNION ALL SELECT 'tiger_uppercut_medium', '中タイガーアッパーカット'
  UNION ALL SELECT 'tiger_uppercut_heavy', '強タイガーアッパーカット'
  UNION ALL SELECT 'tiger_uppercut_holding_heavy', '【ホールド】強タイガーアッパーカット'
  UNION ALL SELECT 'tiger_uppercut_od', 'ODタイガーアッパーカット'
  UNION ALL SELECT 'tiger_knee_crush_light', '弱タイガーニークラッシュ'
  UNION ALL SELECT 'tiger_knee_crush_medium', '中タイガーニークラッシュ'
  UNION ALL SELECT 'tiger_knee_crush_heavy', '強タイガーニークラッシュ'
  UNION ALL SELECT 'tiger_knee_crush_od', 'ODタイガーニークラッシュ'
  UNION ALL SELECT 'tiger_nexus_light', '弱タイガーネクサス'
  UNION ALL SELECT 'tiger_nexus_medium', '中タイガーネクサス'
  UNION ALL SELECT 'tiger_nexus_heavy', '強タイガーネクサス'
  UNION ALL SELECT 'tiger_nexus_od', 'ODタイガーネクサス'
  UNION ALL SELECT 'mighty_tiger_od', 'ODタイガーマイト'
  UNION ALL SELECT 'mighty_tiger', 'タイガーマイト'
  UNION ALL SELECT 'greedy_tiger_od', 'ODタイガーグリード'
  UNION ALL SELECT 'greedy_tiger', 'タイガーグリード'
  UNION ALL SELECT 'nova_tiger_od', 'ODタイガーノヴァ'
  UNION ALL SELECT 'nova_tiger', 'タイガーノヴァ'
  UNION ALL SELECT 'sa1_tiger_cannon', 'SA1 タイガーキャノン'
  UNION ALL SELECT 'sa2_savage_tiger_raid', 'SA2 サベージタイガーレイド'
  UNION ALL SELECT 'sa2_savage_tiger_zenith', 'SA2 サベージタイガーゼニス'
  UNION ALL SELECT 'sa2_savage_tiger_pendulum', 'SA2 サベージタイガーペンデュラム'
  UNION ALL SELECT 'sa2_savage_tiger_stomp', 'SA2 サベージタイガースタンプ'
  UNION ALL SELECT 'sa3_tiger_vanquisher', 'SA3 タイガーヴァンキッシュ'
  UNION ALL SELECT 'ca_tiger_vanquisher', 'CA タイガーヴァンキッシュ'
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
  UNION ALL SELECT 'rush_tiger_heavy_elbow', 'タイガーヘビーエルボー(ラッシュ)'
  UNION ALL SELECT 'rush_tiger_monolith', 'タイガーモノリス(ラッシュ)'
  UNION ALL SELECT 'rush_low_step_kick', 'ステップローキック(ラッシュ)'
  UNION ALL SELECT 'rush_high_step_kick', 'ステップハイキック(ラッシュ)'
) AS v
WHERE c.code = 'sagat' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== yasmine (84 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 5 AS startup, 3 AS active, 15 AS total, 4 AS on_hit, -1 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 2, -4, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 6, 12, 35, 2, -3, 18, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 10, 3, 31, 3, -4, 19, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 9, 20, 43, 2, -3, 15, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 14, 3, 36, 1, -4, 20, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 4, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 3, 17, 2, -2, 10, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 3, 26, 4, 0, 18, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 8, 3, 29, -1, -6, 19, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 8, 6, 36, 2, -11, 23, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 37, NULL, -10, 25, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 5, 46, NULL, NULL, 38, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 4, 6, 46, NULL, NULL, 37, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 7, 4, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 6, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'hiwang_pababa', 'unique', 600, 22, 3, 42, 3, -3, 18, 0, NULL
  UNION ALL SELECT 'walis_na_pabagsak', 'unique', 800, 22, 2, 48, NULL, -6, 25, 0, NULL
  UNION ALL SELECT 'kidlat_na_hiwa', 'target_combo', 620, 8, 2, 23, 1, -3, 14, 0, NULL
  UNION ALL SELECT 'tatlong_hiwa', 'target_combo', 1000, 12, 2, 40, NULL, -13, 27, 0, NULL
  UNION ALL SELECT 'sunod_sunod_na_sipa_2hits', 'target_combo', 1100, 13, 2, 47, -13, -13, 33, 0, NULL
  UNION ALL SELECT 'sunod_sunod_na_sipa', 'target_combo', 1500, 16, 3, 41, NULL, -9, 23, 0, NULL
  UNION ALL SELECT 'kumbinasyong_pampabagsak', 'target_combo', 900, 8, 2, 34, NULL, -10, 25, 0, NULL
  UNION ALL SELECT 'daloy_ng_tubig_light', 'special', 400, 12, 3, 36, 1, -6, 22, 0, NULL
  UNION ALL SELECT 'daloy_ng_tubig_medium', 'special', 400, 16, 3, 40, 1, -6, 22, 0, NULL
  UNION ALL SELECT 'daloy_ng_tubig_heavy', 'special', 400, 21, 3, 45, 3, -6, 22, 0, NULL
  UNION ALL SELECT 'daloy_ng_tubig_od', 'special', 400, 12, 3, 36, -2, -3, 22, 0, NULL
  UNION ALL SELECT 'alon_light', 'special', 1100, 13, 21, 57, 1, -12, 24, 0, '{"notes_tool":"弱ダロイ・ン・トゥビグ派生。空振りではでない"}'
  UNION ALL SELECT 'alon_medium', 'special', 1000, 13, 21, 57, NULL, -12, 24, 0, '{"notes_tool":"中ダロイ・ン・トゥビグ派生。空振りではでない"}'
  UNION ALL SELECT 'alon_heavy', 'special', 1000, 13, 21, 57, NULL, -12, 24, 0, '{"notes_tool":"強ダロイ・ン・トゥビグ派生。空振りではでない"}'
  UNION ALL SELECT 'alon_od', 'special', 1800, 13, 21, 57, NULL, -12, 24, 0, '{"notes_tool":"ODダロイ・ン・トゥビグ派生。空振りではでない"}'
  UNION ALL SELECT 'bayani_light_alon', 'special', 1300, 13, 41, 73, NULL, -1, 20, 0, '{"notes_tool":"バヤニモードで弱ダロイ・ン・トゥビグから弱アロンの替わりに派生。空振りではでない。バヤニモードを可読性のためにバヤニと表記。"}'
  UNION ALL SELECT 'bayani_medium_alon', 'special', 1100, 13, 47, 81, NULL, -2, 22, 0, '{"notes_tool":"バヤニモードで中ダロイ・ン・トゥビグ派生から中アロンの替わりに。空振りではでない。バヤニモードを可読性のためにバヤニと表記。"}'
  UNION ALL SELECT 'bayani_heavy_alon', 'special', 1100, 13, 47, 82, NULL, -3, 23, 0, '{"notes_tool":"バヤニモードで強ダロイ・ン・トゥビグ派生から中アロンの替わりに。空振りではでない。バヤニモードを可読性のためにバヤニと表記。"}'
  UNION ALL SELECT 'bayani_od_alon', 'special', 2200, 13, 41, 73, NULL, -1, 20, 0, '{"notes_tool":"バヤニモードでODダロイ・ン・トゥビグ派生からODアロンの替わりに。空振りではでない。バヤニモードを可読性のためにバヤニと表記。"}'
  UNION ALL SELECT 'talim_ng_hangin_light', 'special', 0, 1, 35, 35, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'talim_ng_hangin_medium', 'special', 1100, 21, 2, 46, 2, -3, 24, 0, NULL
  UNION ALL SELECT 'talim_ng_hangin_heavy', 'special', 1200, 30, 2, 48, NULL, 1, 17, 0, NULL
  UNION ALL SELECT 'talim_ng_hangin_od', 'special', 800, 20, 2, 49, NULL, -12, 28, 0, NULL
  UNION ALL SELECT 'mukha_ng_langit_light', 'special', 0, 1, 59, 59, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'mukha_ng_langit_medium', 'special', 0, 1, 59, 59, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'mukha_ng_langit_heavy', 'special', 0, 1, 59, 59, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'mukha_ng_langit_od', 'special', 0, 1, 59, 59, NULL, NULL, 0, 0, '{"notes_tool":"弱中強ODの概念がある技だが、フレームは変化しないので1行のみ。派生版は組み合わせによりフレームが変わる事がある。"}'
  UNION ALL SELECT 'ulan_light', 'special', 800, 40, 4, 59, 5, -3, 16, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。こちらは派生元との組み合わせに関わらずフレームは一定。将来的にはKulogと同じ不定系にする必要があるかも。"}'
  UNION ALL SELECT 'ulan_medium', 'special', 800, 40, 4, 59, 5, -3, 16, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。こちらは派生元との組み合わせに関わらずフレームは一定。将来的にはKulogと同じ不定系にする必要があるかも。"}'
  UNION ALL SELECT 'ulan_heavy', 'special', 800, 40, 4, 59, 5, -3, 16, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。こちらは派生元との組み合わせに関わらずフレームは一定。将来的にはKulogと同じ不定系にする必要があるかも。"}'
  UNION ALL SELECT 'ulan_od', 'special', 800, 40, 4, 59, 7, 0, 16, 0, '{"notes_tool":"弱中強ODムカ・ン・ランギットから派生。こちらは派生元との組み合わせに関わらずフレームは一定。将来的にはKulogと同じ不定系にする必要があるかも。"}'
  UNION ALL SELECT 'kulog_light', 'special', 700, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。ウランと異なり、派生元によりフレーム可変。複雑なのでいったんはコンボ一覧に出てセットプレイ自動走査にはでないようにする。（ベガのシャドウライズやエレナのリンクスワールと同系統）"}'
  UNION ALL SELECT 'kulog_medium', 'special', 700, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。ウランと異なり、派生元によりフレーム可変。複雑なのでいったんはコンボ一覧に出てセットプレイ自動走査にはでないようにする。（ベガのシャドウライズやエレナのリンクスワールと同系統）"}'
  UNION ALL SELECT 'kulog_heavy', 'special', 700, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"弱中強ムカ・ン・ランギットから派生。ウランと異なり、派生元によりフレーム可変。複雑なのでいったんはコンボ一覧に出てセットプレイ自動走査にはでないようにする。（ベガのシャドウライズやエレナのリンクスワールと同系統）"}'
  UNION ALL SELECT 'kulog_od', 'special', 700, NULL, NULL, NULL, NULL, NULL, NULL, 0, '{"notes_tool":"弱中強ODムカ・ン・ランギットから派生。ウランと異なり、派生元によりフレーム可変。複雑なのでいったんはコンボ一覧に出てセットプレイ自動走査にはでないようにする。（ベガのシャドウライズやエレナのリンクスワールと同系統）"}'
  UNION ALL SELECT 'lipad_ng_agila_light', 'special', 1000, 5, 10, 53, NULL, -29, 39, 0, NULL
  UNION ALL SELECT 'lipad_ng_agila_medium', 'special', 1200, 6, 10, 54, NULL, -29, 39, 0, NULL
  UNION ALL SELECT 'lipad_ng_agila_heavy', 'special', 1300, 7, 10, 55, NULL, -32, 39, 0, NULL
  UNION ALL SELECT 'lipad_ng_agila_od', 'special', 1600, 6, 10, 61, NULL, -40, 46, 0, NULL
  UNION ALL SELECT 'pangil_sa_likuran_light', 'special', 600, 25, 26, 50, 1, -4, 0, 0, NULL
  UNION ALL SELECT 'pangil_sa_likuran_medium', 'special', 600, 25, 26, 50, 1, -4, 0, 0, NULL
  UNION ALL SELECT 'pangil_sa_likuran_heavy', 'special', 600, 25, 26, 50, 1, -4, 0, 0, NULL
  UNION ALL SELECT 'pangil_sa_likuran_od', 'special', 900, 25, 26, 50, 2, -2, 0, 0, NULL
  UNION ALL SELECT 'linya_ng_liwanag', 'special', 1100, 22, 13, 54, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'sa1_hiwa_ng_kalangitan', 'super_art', 2000, 7, 6, 62, NULL, -34, 50, 0, NULL
  UNION ALL SELECT 'sa2_nakatagong_lakas', 'super_art', 0, 1, 10, 10, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'sa3_pamumukadkad_ng_sampaguita', 'super_art', 4000, 10, 3, 82, NULL, -48, 70, 0, NULL
  UNION ALL SELECT 'ca_pamumukadkad_ng_sampaguita', 'critical_art', 4500, 10, 3, 82, NULL, -48, 70, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 16, 3, 26, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 6, 0, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 17, 12, 46, 6, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 21, 3, 42, 7, 0, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 20, 20, 54, 6, 1, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 25, 3, 47, 5, 0, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 3, 28, 6, 2, 10, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 3, 37, 8, 4, 18, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 19, 3, 40, 3, -2, 19, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 19, 6, 47, 6, -7, 23, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 48, NULL, -6, 25, 0, NULL
  UNION ALL SELECT 'rush_hiwang_pababa', 'rush_variant', 600, 33, 3, 53, 7, 1, 18, 0, NULL
  UNION ALL SELECT 'rush_walis_na_pabagsak', 'rush_variant', 800, 33, 2, 59, NULL, -2, 25, 0, NULL
) AS v
WHERE c.code = 'yasmine' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_hiwang_pababa' THEN 'hiwang_pababa'
        WHEN 'rush_walis_na_pabagsak' THEN 'walis_na_pabagsak'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'yasmine' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_hiwang_pababa', 'rush_walis_na_pabagsak');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'hiwang_pababa', 'ヒワン・パババ'
  UNION ALL SELECT 'walis_na_pabagsak', 'ワリス・ナ・パバグサ'
  UNION ALL SELECT 'kidlat_na_hiwa', 'キドラット・ナ・ヒワ'
  UNION ALL SELECT 'tatlong_hiwa', 'タッロング・ヒワ'
  UNION ALL SELECT 'sunod_sunod_na_sipa_2hits', 'スノスノッド・ナ・シパ(2発止め)'
  UNION ALL SELECT 'sunod_sunod_na_sipa', 'スノスノッド・ナ・シパ'
  UNION ALL SELECT 'kumbinasyong_pampabagsak', 'コンビナション・パムパバッグサ'
  UNION ALL SELECT 'daloy_ng_tubig_light', '弱ダロイ・ン・トゥビグ'
  UNION ALL SELECT 'daloy_ng_tubig_medium', '中ダロイ・ン・トゥビグ'
  UNION ALL SELECT 'daloy_ng_tubig_heavy', '強ダロイ・ン・トゥビグ'
  UNION ALL SELECT 'daloy_ng_tubig_od', 'ODダロイ・ン・トゥビグ'
  UNION ALL SELECT 'alon_light', '弱アロン'
  UNION ALL SELECT 'alon_medium', '中アロン'
  UNION ALL SELECT 'alon_heavy', '強アロン'
  UNION ALL SELECT 'alon_od', 'ODアロン'
  UNION ALL SELECT 'bayani_light_alon', '【バヤニ】弱アロン'
  UNION ALL SELECT 'bayani_medium_alon', '【バヤニ】中アロン'
  UNION ALL SELECT 'bayani_heavy_alon', '【バヤニ】強アロン'
  UNION ALL SELECT 'bayani_od_alon', '【バヤニ】ODアロン'
  UNION ALL SELECT 'talim_ng_hangin_light', '弱タリム・ン・ハンギン'
  UNION ALL SELECT 'talim_ng_hangin_medium', '中タリム・ン・ハンギン'
  UNION ALL SELECT 'talim_ng_hangin_heavy', '強タリム・ン・ハンギン'
  UNION ALL SELECT 'talim_ng_hangin_od', 'ODタリム・ン・ハンギン'
  UNION ALL SELECT 'mukha_ng_langit_light', '弱ムカ・ン・ランギット'
  UNION ALL SELECT 'mukha_ng_langit_medium', '中ムカ・ン・ランギット'
  UNION ALL SELECT 'mukha_ng_langit_heavy', '強ムカ・ン・ランギット'
  UNION ALL SELECT 'mukha_ng_langit_od', 'ODムカ・ン・ランギット'
  UNION ALL SELECT 'ulan_light', '弱ウラン'
  UNION ALL SELECT 'ulan_medium', '中ウラン'
  UNION ALL SELECT 'ulan_heavy', '強ウラン'
  UNION ALL SELECT 'ulan_od', 'ODウラン'
  UNION ALL SELECT 'kulog_light', '弱クロッグ'
  UNION ALL SELECT 'kulog_medium', '中クロッグ'
  UNION ALL SELECT 'kulog_heavy', '強クロッグ'
  UNION ALL SELECT 'kulog_od', 'ODクロッグ'
  UNION ALL SELECT 'lipad_ng_agila_light', '弱リパ・ン・アギラ'
  UNION ALL SELECT 'lipad_ng_agila_medium', '中リパ・ン・アギラ'
  UNION ALL SELECT 'lipad_ng_agila_heavy', '強リパ・ン・アギラ'
  UNION ALL SELECT 'lipad_ng_agila_od', 'ODリパ・ン・アギラ'
  UNION ALL SELECT 'pangil_sa_likuran_light', '弱パンギル・サ・リクラン'
  UNION ALL SELECT 'pangil_sa_likuran_medium', '中パンギル・サ・リクラン'
  UNION ALL SELECT 'pangil_sa_likuran_heavy', '強パンギル・サ・リクラン'
  UNION ALL SELECT 'pangil_sa_likuran_od', 'ODパンギル・サ・リクラン'
  UNION ALL SELECT 'linya_ng_liwanag', 'リニャ・ン・リワナグ'
  UNION ALL SELECT 'sa1_hiwa_ng_kalangitan', 'SA1 ヒワン・ン・カラヒタン'
  UNION ALL SELECT 'sa2_nakatagong_lakas', 'SA2 ナカタゴン・ラカス'
  UNION ALL SELECT 'sa3_pamumukadkad_ng_sampaguita', 'SA3 パムムカドカッド・ン・サンパギータ'
  UNION ALL SELECT 'ca_pamumukadkad_ng_sampaguita', 'CA パムムカドカッド・ン・サンパギータ'
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
  UNION ALL SELECT 'rush_hiwang_pababa', 'ヒワン・パババ(ラッシュ)'
  UNION ALL SELECT 'rush_walis_na_pabagsak', 'ワリス・ナ・パバグサ(ラッシュ)'
) AS v
WHERE c.code = 'yasmine' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== c_viper (89 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 14 AS total, 4 AS on_hit, -2 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 3, 18, 3, -2, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 8, 4, 23, 6, 1, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 700, 8, 3, 30, 5, -3, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 900, 12, 3, 35, 3, -2, 21, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 10, 4, 33, 4, -3, 20, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 3, 14, 5, -1, 8, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 15, 4, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 6, 4, 25, 5, -2, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 8, 3, 27, 5, -1, 17, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 9, 3, 31, 2, -5, 20, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 10, 3, 37, NULL, -11, 25, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 6, 46, NULL, NULL, 36, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 5, 7, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 600, 8, 6, 46, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 11, 5, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 700, 8, 7, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'neutral_jumping_heavy_kick', 'normal', 800, 10, 7, 46, NULL, NULL, 30, 1, NULL
  UNION ALL SELECT 'high_jumping_light_punch', 'unique', 300, 5, 6, 49, NULL, NULL, 39, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_light_kick', 'unique', 300, 5, 7, 49, NULL, NULL, 38, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_medium_punch', 'unique', 600, 8, 6, 49, NULL, NULL, 36, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_medium_kick', 'unique', 500, 7, 6, 49, NULL, NULL, 37, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_heavy_punch', 'unique', 800, 11, 5, 49, NULL, NULL, 34, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_heavy_kick', 'unique', 700, 8, 7, 49, NULL, NULL, 35, 1, '{"notes_tool":"ハイジャンプ版。ヴァイパー特有。normalかuniqueか悩んでuniqueへ。全体が変わるだけで、性能はジャンプ攻撃と同じ"}'
  UNION ALL SELECT 'high_jumping_neutral_heavy_kick', 'unique', 700, 10, 7, 49, NULL, NULL, 33, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'viper_elbow', 'unique', 600, 22, 3, 44, 2, -3, 20, 0, NULL
  UNION ALL SELECT 'double_kick', 'unique', 900, 11, 21, 47, 4, -2, 16, 0, NULL
  UNION ALL SELECT 'high_jump', 'unique', 0, 1, 49, 49, NULL, NULL, 0, 0, '{"notes_tool":"前方と垂直方向に可能だがあえて区別せず（インゲーム記載では区別なし）"}'
  UNION ALL SELECT 'thunder_dash_light', 'special', 900, 17, 4, 43, 2, -4, 23, 0, NULL
  UNION ALL SELECT 'thunder_dash_medium', 'special', 900, 16, 4, 41, 1, -3, 22, 0, NULL
  UNION ALL SELECT 'thunder_dash_heavy', 'special', 900, 7, 10, 53, NULL, -24, 37, 0, NULL
  UNION ALL SELECT 'thunder_dash_od', 'special', 1600, 18, 24, 62, NULL, -2, 21, 0, '{"notes_tool":"OD版は派生なし"}'
  UNION ALL SELECT 'tracer_combination_light', 'special', 1500, 15, 3, 45, NULL, -15, 28, 0, '{"notes_tool":"弱サンダースラップ派生。ガード、ヒットで派生。"}'
  UNION ALL SELECT 'tracer_combination_medium', 'special', 1500, 21, 4, 49, NULL, -13, 25, 0, '{"notes_tool":"中サンダースラップ派生。ガード、ヒットで派生"}'
  UNION ALL SELECT 'tracer_combination_heavy', 'special', 1400, 17, 4, 57, NULL, NULL, 37, 0, '{"notes_tool":"強サンダースラップ派生。ヒット時のみ派生。"}'
  UNION ALL SELECT 'thunder_dash_feint_light', 'special', 0, 1, 24, 24, NULL, NULL, 0, 0, '{"notes_tool":"弱サンダースラップ派生。こちらはthrough"}'
  UNION ALL SELECT 'thunder_dash_feint_medium', 'special', 0, 1, 20, 20, NULL, NULL, 0, 0, '{"notes_tool":"中サンダースラップ派生。こちらはthrough"}'
  UNION ALL SELECT 'thunder_dash_feint_heavy', 'special', 0, 1, 18, 18, NULL, NULL, 0, 0, '{"notes_tool":"強サンダースラップ派生。こちらはthrough"}'
  UNION ALL SELECT 'burning_kick_light', 'special', 900, 23, 5, 47, NULL, -2, 20, 0, NULL
  UNION ALL SELECT 'burning_kick_medium', 'special', 900, 25, 5, 49, NULL, -2, 20, 0, NULL
  UNION ALL SELECT 'burning_kick_heavy', 'special', 900, 27, 5, 51, NULL, -2, 20, 0, NULL
  UNION ALL SELECT 'burning_kick_od', 'special', 1500, 8, 28, 56, NULL, -4, 21, 0, NULL
  UNION ALL SELECT 'knuckled_pursuit', 'special', 1700, 12, 4, 49, NULL, -15, 34, 0, '{"notes_tool":"弱中強バーニングキックから派生。ODと空中バーニングキックは対象外。派生元が変わってもフレーム変わらない。バーニングキック、ヒットかガードで派生。ダメージは通し値。"}'
  UNION ALL SELECT 'double_burn', 'special', 1500, 21, 5, 45, NULL, 2, 20, 0, '{"notes_tool":"弱中強バーニングキックから派生。ODと空中バーニングキックは対象外。派生元が変わってもフレーム変わらない。バーニングキック、ヒットかガードで派生。ダメージは通し値。"}'
  UNION ALL SELECT 'aerial_burning_kick_light', 'special', 900, 33, 7, 56, NULL, -2, 17, 0, '{"notes_tool":"垂直、前方ジャンプから派生"}'
  UNION ALL SELECT 'aerial_burning_kick_medium', 'special', 900, 31, 7, 53, NULL, -1, 16, 0, '{"notes_tool":"垂直、前方ジャンプから派生"}'
  UNION ALL SELECT 'aerial_burning_kick_heavy', 'special', 900, 29, 7, 53, NULL, -3, 18, 0, '{"notes_tool":"垂直、前方ジャンプから派生"}'
  UNION ALL SELECT 'aerial_burning_kick_od', 'special', 1000, 29, 7, 54, NULL, 2, 19, 0, '{"notes_tool":"垂直、前方ジャンプから派生"}'
  UNION ALL SELECT 'high_jump_light_aerial_burning_kick', 'special', 900, 31, 7, 50, NULL, 1, 13, 0, '{"notes_tool":"ハイジャンプから派生。垂直ハイジャンプの場合は"}'
  UNION ALL SELECT 'high_jump_medium_aerial_burning_kick', 'special', 900, 29, 7, 48, NULL, 1, 13, 0, '{"notes_tool":"ハイジャンプから派生"}'
  UNION ALL SELECT 'high_jump_heavy_aerial_burning_kick', 'special', 900, 27, 7, 48, NULL, -1, 15, 0, '{"notes_tool":"ハイジャンプから派生"}'
  UNION ALL SELECT 'high_jump_od_aerial_burning_kick', 'special', 1000, 27, 7, 48, NULL, 4, 15, 0, '{"notes_tool":"ハイジャンプから派生"}'
  UNION ALL SELECT 'seismic_hammer_light', 'special', 700, 24, 8, 57, NULL, -10, 26, 0, NULL
  UNION ALL SELECT 'seismic_hammer_medium', 'special', 700, 24, 8, 57, NULL, -10, 26, 0, NULL
  UNION ALL SELECT 'seismic_hammer_heavy', 'special', 700, 24, 8, 57, NULL, -10, 26, 0, NULL
  UNION ALL SELECT 'seismic_hammer_od', 'special', 900, 19, 8, 52, NULL, -6, 26, 0, NULL
  UNION ALL SELECT 'seismic_hammer_feint', 'special', 0, 1, 27, 27, NULL, NULL, 0, 0, '{"notes_tool":"弱中強セイスモハンマーから派生。派生元によってフレームは変化しない。OD派生はない"}'
  UNION ALL SELECT 'focus_force', 'special', 1000, 23, 12, 70, NULL, -16, 36, 0, NULL
  UNION ALL SELECT 'focus_force_od', 'special', 1500, 20, 12, 67, NULL, -16, 36, 0, NULL
  UNION ALL SELECT 'focus_force_holding', 'special', 1200, 30, 12, 77, NULL, -16, 36, 0, '{"notes_tool":"最速のホールド時間。実際は入力が難しいので、このタイミングではほぼ出せない。"}'
  UNION ALL SELECT 'focus_force_holding_od', 'special', 1700, 30, 12, 77, NULL, -16, 36, 0, NULL
  UNION ALL SELECT 'focus_force_max_holding', 'special', 1400, 69, 12, 116, NULL, -10, 36, 0, NULL
  UNION ALL SELECT 'focus_force_max_holding_od', 'special', 2000, 67, 12, 114, NULL, -10, 36, 0, NULL
  UNION ALL SELECT 'focus_force_forward_step', 'special', 0, 6, 6, 32, NULL, NULL, 21, 0, NULL
  UNION ALL SELECT 'focus_force_forward_step_od', 'special', 0, 3, 6, 29, NULL, NULL, 21, 0, NULL
  UNION ALL SELECT 'sa1_limit_decoupler', 'super_art', 2000, 8, 13, 73, NULL, -34, 53, 0, NULL
  UNION ALL SELECT 'sa2_mission_complete', 'super_art', 3000, 7, 4, 55, NULL, -29, 45, 0, NULL
  UNION ALL SELECT 'sa3_hard_luck_rejector', 'super_art', 4000, 10, 4, 67, NULL, -38, 54, 0, NULL
  UNION ALL SELECT 'ca_hard_luck_rejector', 'critical_art', 4500, 10, 4, 67, NULL, -38, 54, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 25, 8, 2, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 3, 29, 7, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 19, 4, 34, 10, 5, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 700, 19, 3, 41, 9, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 900, 23, 3, 46, 7, 2, 21, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 21, 4, 44, 8, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 3, 25, 9, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 26, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 17, 4, 36, 9, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 19, 3, 38, 9, 3, 17, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 20, 3, 42, 6, -1, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 21, 3, 48, NULL, -7, 25, 0, NULL
  UNION ALL SELECT 'rush_viper_elbow', 'rush_variant', 600, 33, 3, 55, 6, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_double_kick', 'rush_variant', 900, 22, 21, 58, 8, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_high_jump', 'rush_variant', 0, 12, 49, 60, NULL, NULL, 0, 0, NULL
) AS v
WHERE c.code = 'c_viper' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_viper_elbow' THEN 'viper_elbow'
        WHEN 'rush_double_kick' THEN 'double_kick'
        WHEN 'rush_high_jump' THEN 'high_jump'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'c_viper' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_viper_elbow', 'rush_double_kick', 'rush_high_jump');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'high_jumping_light_punch', 'ハイジャンプ弱P'
  UNION ALL SELECT 'high_jumping_light_kick', 'ハイジャンプ弱K'
  UNION ALL SELECT 'high_jumping_medium_punch', 'ハイジャンプ中P'
  UNION ALL SELECT 'high_jumping_medium_kick', 'ハイジャンプ中K'
  UNION ALL SELECT 'high_jumping_heavy_punch', 'ハイジャンプ強P'
  UNION ALL SELECT 'high_jumping_heavy_kick', 'ハイジャンプ強K'
  UNION ALL SELECT 'high_jumping_neutral_heavy_kick', 'ハイジャンプ垂直ジャンプ強K'
  UNION ALL SELECT 'drive_impact', 'ドライブインパクト'
  UNION ALL SELECT 'throw_forward', '前投げ'
  UNION ALL SELECT 'throw_back', '後ろ投げ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'viper_elbow', 'ヴァイパーエルボー'
  UNION ALL SELECT 'double_kick', 'ダブルキック'
  UNION ALL SELECT 'high_jump', 'ハイジャンプ'
  UNION ALL SELECT 'thunder_dash_light', '弱サンダースラップ'
  UNION ALL SELECT 'thunder_dash_medium', '中サンダースラップ'
  UNION ALL SELECT 'thunder_dash_heavy', '強サンダースラップ'
  UNION ALL SELECT 'thunder_dash_od', 'ODサンダースラップ'
  UNION ALL SELECT 'tracer_combination_light', '弱トレースコンビネーション'
  UNION ALL SELECT 'tracer_combination_medium', '中トレースコンビネーション'
  UNION ALL SELECT 'tracer_combination_heavy', '強トレースコンビネーション'
  UNION ALL SELECT 'thunder_dash_feint_light', '【サンダースラップ】弱フェイント'
  UNION ALL SELECT 'thunder_dash_feint_medium', '【サンダースラップ】中フェイント'
  UNION ALL SELECT 'thunder_dash_feint_heavy', '【サンダースラップ】強フェイント'
  UNION ALL SELECT 'burning_kick_light', '弱バーニングキック'
  UNION ALL SELECT 'burning_kick_medium', '中バーニングキック'
  UNION ALL SELECT 'burning_kick_heavy', '強バーニングキック'
  UNION ALL SELECT 'burning_kick_od', 'ODバーニングキック'
  UNION ALL SELECT 'knuckled_pursuit', 'チェイスナックル'
  UNION ALL SELECT 'double_burn', 'ダブルバーン'
  UNION ALL SELECT 'aerial_burning_kick_light', '弱空中バーニングキック'
  UNION ALL SELECT 'aerial_burning_kick_medium', '中空中バーニングキック'
  UNION ALL SELECT 'aerial_burning_kick_heavy', '強空中バーニングキック'
  UNION ALL SELECT 'aerial_burning_kick_od', 'OD空中バーニングキック'
  UNION ALL SELECT 'high_jump_light_aerial_burning_kick', '【ハイジャンプ】弱空中バーニングキック'
  UNION ALL SELECT 'high_jump_medium_aerial_burning_kick', '【ハイジャンプ】中空中バーニングキック'
  UNION ALL SELECT 'high_jump_heavy_aerial_burning_kick', '【ハイジャンプ】強空中バーニングキック'
  UNION ALL SELECT 'high_jump_od_aerial_burning_kick', '【ハイジャンプ】OD空中バーニングキック'
  UNION ALL SELECT 'seismic_hammer_light', '弱セイスモハンマー'
  UNION ALL SELECT 'seismic_hammer_medium', '中セイスモハンマー'
  UNION ALL SELECT 'seismic_hammer_heavy', '強セイスモハンマー'
  UNION ALL SELECT 'seismic_hammer_od', 'ODセイスモハンマー'
  UNION ALL SELECT 'seismic_hammer_feint', '【セイスモハンマー】フェイント'
  UNION ALL SELECT 'focus_force', 'セービングフォース'
  UNION ALL SELECT 'focus_force_od', 'ODセービングフォース'
  UNION ALL SELECT 'focus_force_holding', 'セービングフォース（ホールド）'
  UNION ALL SELECT 'focus_force_holding_od', 'ODセービングフォース（ホールド）'
  UNION ALL SELECT 'focus_force_max_holding', 'セービングフォース（最大ホールド）'
  UNION ALL SELECT 'focus_force_max_holding_od', 'ODセービングフォース（最大ホールド）'
  UNION ALL SELECT 'focus_force_forward_step', '【セービングフォース】前方ステップ'
  UNION ALL SELECT 'focus_force_forward_step_od', '【ODセービングフォース】前方ステップ'
  UNION ALL SELECT 'sa1_limit_decoupler', 'SA1 バウンサーステップ'
  UNION ALL SELECT 'sa2_mission_complete', 'SA2 ミッションオーバー'
  UNION ALL SELECT 'sa3_hard_luck_rejector', 'SA3 アンラックリジェクター'
  UNION ALL SELECT 'ca_hard_luck_rejector', 'CA アンラックリジェクター'
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
  UNION ALL SELECT 'rush_viper_elbow', 'ヴァイパーエルボー(ラッシュ)'
  UNION ALL SELECT 'rush_double_kick', 'ダブルキック(ラッシュ)'
  UNION ALL SELECT 'rush_high_jump', 'ハイジャンプ(ラッシュ)'
) AS v
WHERE c.code = 'c_viper' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

-- ===== dhalsim (97 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 14 AS total, 4 AS on_hit, -1 AS on_block, 8 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 9, 4, 23, 2, -6, 11, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 700, 14, 3, 35, 0, -5, 19, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 12, 3, 32, -2, -6, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 1000, 16, 4, 46, -6, -11, 27, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 800, 17, 3, 39, 3, -6, 20, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 5, 3, 16, 4, -1, 9, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 4, 7, 26, -5, -10, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 12, 3, 30, 0, -4, 16, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 500, 10, 13, 36, -3, -10, 14, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 800, 19, 4, 46, 3, -8, 24, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 12, 16, 47, NULL, -16, 20, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 4, 4, 74, NULL, NULL, 67, 1, '{"notes_tool":"ダルシムはジャンプが73Fのキャラクター"}'
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 4, 74, NULL, NULL, 65, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 9, 6, 74, NULL, NULL, 60, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 11, 6, 74, NULL, NULL, 58, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 13, 4, 74, NULL, NULL, 58, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 10, 10, 74, NULL, NULL, 55, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'yoga_splash', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'yoga_uppercut', 'unique', 700, 8, 6, 29, 2, -3, 16, 0, NULL
  UNION ALL SELECT 'yoga_lance', 'unique', 900, 14, 7, 49, -9, -16, 29, 0, NULL
  UNION ALL SELECT 'nirvana_punch', 'unique', 800, 10, 4, 33, 3, -3, 20, 0, NULL
  UNION ALL SELECT 'agile_kick', 'unique', 200, 5, 3, 17, 1, -3, 10, 0, NULL
  UNION ALL SELECT 'divine_kick', 'unique', 600, 7, 4, 27, 3, 0, 17, 0, NULL
  UNION ALL SELECT 'thrust_kick', 'unique', 500, 8, 3, 30, -3, -7, 20, 0, NULL
  UNION ALL SELECT 'yoga_mountain', 'unique', 1000, 14, 6, 39, 0, -9, 20, 0, NULL
  UNION ALL SELECT 'karma_kick', 'unique', 900, 9, 3, 33, NULL, -7, 22, 0, NULL
  UNION ALL SELECT 'yoga_mummy', 'unique', 500, 21, 17, 46, -8, -12, 9, 1, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'drill_kick', 'unique', 500, 20, 16, 46, -3, -10, 11, 1, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'medium_drill_kick', 'unique', 500, 20, 12, 42, -1, -6, 11, 1, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'heavy_drill_kick', 'unique', 500, 20, 10, 40, -1, -6, 11, 1, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_fire_light', 'special', 600, 15, 34, 48, -2, -6, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_medium', 'special', 600, 15, 34, 48, -2, -6, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_heavy', 'special', 600, 15, 34, 48, -2, -6, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_od', 'special', 1000, 12, 34, 45, NULL, -3, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_holding_light', 'special', 800, 43, 31, 73, NULL, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_holding_medium', 'special', 800, 43, 31, 73, NULL, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_fire_holding_heavy', 'special', 800, 43, 31, 73, NULL, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_arch_light', 'special', 600, 18, 28, 45, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_arch_medium', 'special', 600, 18, 28, 45, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_arch_heavy', 'special', 600, 18, 28, 45, 1, -1, 0, 0, NULL
  UNION ALL SELECT 'yoga_arch_od', 'special', 1000, 18, 28, 45, 2, -3, 0, 0, NULL
  UNION ALL SELECT 'yoga_flame_light', 'special', 800, 16, 15, 45, NULL, -4, 15, 0, NULL
  UNION ALL SELECT 'yoga_flame_medium', 'special', 900, 20, 15, 51, NULL, -4, 17, 0, NULL
  UNION ALL SELECT 'yoga_flame_heavy', 'special', 1200, 26, 17, 58, NULL, -4, 16, 0, NULL
  UNION ALL SELECT 'yoga_flame_od', 'special', 800, 18, 25, 66, NULL, -11, 24, 0, NULL
  UNION ALL SELECT 'yoga_blast_light', 'special', 1000, 12, 10, 44, NULL, -6, 23, 0, NULL
  UNION ALL SELECT 'yoga_blast_medium', 'special', 1200, 15, 10, 44, NULL, -3, 20, 0, NULL
  UNION ALL SELECT 'yoga_blast_heavy', 'special', 1200, 17, 10, 44, NULL, -1, 18, 0, NULL
  UNION ALL SELECT 'yoga_blast_od', 'special', 1000, 12, 10, 41, NULL, 0, 20, 0, NULL
  UNION ALL SELECT 'yoga_comet_light', 'special', 800, 38, 37, 74, -4, -2, 0, 0, '{"notes_tool":"ガードの方がフレームが大きいのは正しい。例外パターン。後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_comet_medium', 'special', 800, 38, 37, 74, -4, -2, 0, 0, '{"notes_tool":"ガードの方がフレームが大きいのは正しい。例外パターン。後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_comet_heavy', 'special', 800, 38, 37, 74, -4, -2, 0, 0, '{"notes_tool":"ガードの方がフレームが大きいのは正しい。例外パターン。後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_comet_od', 'special', 1200, 38, 32, 69, 5, 6, 0, 0, '{"notes_tool":"ガードの方がフレームが大きいのは正しい。例外パターン。後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_float', 'special', 0, 1, 144, 144, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'yoga_float_forward', 'special', 0, 1, 144, 144, NULL, NULL, 0, 0, NULL
  UNION ALL SELECT 'aerial_yoga_float', 'special', 0, 12, 102, 113, NULL, NULL, 0, 0, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'yoga_teleport', 'special', 0, 5, 11, 39, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'p_yoga_teleport_backward', 'special', 0, 5, 11, 46, NULL, NULL, 31, 0, NULL
  UNION ALL SELECT 'k_yoga_teleport_forward', 'special', 0, 5, 11, 39, NULL, NULL, 24, 0, NULL
  UNION ALL SELECT 'k_yoga_teleport_backward', 'special', 0, 5, 11, 46, NULL, NULL, 31, 0, NULL
  UNION ALL SELECT 'aerial_yoga_teleport', 'special', 0, 18, 6, 48, NULL, NULL, 25, 0, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'p_aerial_yoga_teleport_backward', 'special', 0, 18, 6, 56, NULL, NULL, 33, 0, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'k_aerial_yoga_teleport_forward', 'special', 0, 18, 6, 48, NULL, NULL, 25, 0, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'k_aerial_yoga_teleport_backward', 'special', 0, 18, 6, 56, NULL, NULL, 33, 0, '{"notes_tool":"後方、垂直、前方ジャンプから"}'
  UNION ALL SELECT 'sa1_yoga_inferno_light', 'super_art', 1920, 10, 104, 128, NULL, -10, 15, 0, NULL
  UNION ALL SELECT 'sa1_yoga_inferno_medium', 'super_art', 2100, 10, 104, 128, NULL, -10, 15, 0, NULL
  UNION ALL SELECT 'sa1_yoga_inferno_heavy', 'super_art', 2040, 10, 84, 133, NULL, -22, 40, 0, NULL
  UNION ALL SELECT 'sa2_yoga_sunburst', 'super_art', 2800, 7, 61, 67, NULL, -61, 0, 0, '{"notes_tool":"例外的にガードフレームではない。この技はしゃがみで回避して反撃を入れるという慣習があるため。"}'
  UNION ALL SELECT 'sa2_yoga_sunburst_holding', 'super_art', 3100, 7, 75, 81, NULL, -75, 0, 0, '{"notes_tool":"例外的にガードフレームではない。この技はしゃがみで回避して反撃を入れるという慣習があるため。実測困難なため正確な持続、全体ではない。"}'
  UNION ALL SELECT 'sa2_yoga_sunburst_max_holding', 'super_art', 4000, 7, 142, 148, NULL, -142, 0, 0, '{"notes_tool":"例外的にガードフレームではない。この技はしゃがみで回避して反撃を入れるという慣習があるため。"}'
  UNION ALL SELECT 'sa3_merciless_yoga', 'super_art', 4000, 10, 5, 89, NULL, -62, 75, 0, NULL
  UNION ALL SELECT 'ca_merciless_yoga', 'critical_art', 4500, 10, 5, 89, NULL, -62, 75, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 25, 8, 3, 8, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 20, 4, 34, 6, -2, 11, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 700, 25, 3, 46, 4, -1, 19, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 23, 3, 43, 2, -2, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 1000, 27, 4, 57, -2, -7, 27, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 800, 28, 3, 50, 7, -2, 20, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 16, 3, 27, 8, 3, 9, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 15, 7, 37, -1, -6, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 23, 3, 41, 4, 0, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 500, 21, 13, 47, 1, -6, 14, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 800, 30, 4, 57, 7, -4, 24, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 23, 16, 58, NULL, -12, 20, 0, NULL
  UNION ALL SELECT 'rush_yoga_uppercut', 'rush_variant', 700, 19, 6, 40, 6, 1, 16, 0, NULL
  UNION ALL SELECT 'rush_yoga_lance', 'rush_variant', 900, 25, 7, 60, -5, -12, 29, 0, NULL
  UNION ALL SELECT 'rush_nirvana_punch', 'rush_variant', 800, 21, 4, 44, 7, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_agile_kick', 'rush_variant', 200, 16, 3, 28, 5, 1, 10, 0, NULL
  UNION ALL SELECT 'rush_divine_kick', 'rush_variant', 600, 18, 4, 38, 7, 4, 17, 0, NULL
  UNION ALL SELECT 'rush_thrust_kick', 'rush_variant', 500, 19, 3, 41, 1, -3, 20, 0, NULL
  UNION ALL SELECT 'rush_yoga_mountain', 'rush_variant', 1000, 25, 6, 50, 4, -5, 20, 0, NULL
  UNION ALL SELECT 'rush_karma_kick', 'rush_variant', 900, 20, 3, 44, NULL, -3, 22, 0, NULL
) AS v
WHERE c.code = 'dhalsim' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_yoga_uppercut' THEN 'yoga_uppercut'
        WHEN 'rush_yoga_lance' THEN 'yoga_lance'
        WHEN 'rush_nirvana_punch' THEN 'nirvana_punch'
        WHEN 'rush_agile_kick' THEN 'agile_kick'
        WHEN 'rush_divine_kick' THEN 'divine_kick'
        WHEN 'rush_thrust_kick' THEN 'thrust_kick'
        WHEN 'rush_yoga_mountain' THEN 'yoga_mountain'
        WHEN 'rush_karma_kick' THEN 'karma_kick'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'dhalsim' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_yoga_uppercut', 'rush_yoga_lance', 'rush_nirvana_punch', 'rush_agile_kick', 'rush_divine_kick', 'rush_thrust_kick', 'rush_yoga_mountain', 'rush_karma_kick');

INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
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
  UNION ALL SELECT 'yoga_splash', 'ヨガスプラッシュ'
  UNION ALL SELECT 'drive_parry', 'ドライブパリィ'
  UNION ALL SELECT 'yoga_uppercut', 'ヨガアッパー'
  UNION ALL SELECT 'yoga_lance', 'ヨガランス'
  UNION ALL SELECT 'nirvana_punch', '涅槃パンチ'
  UNION ALL SELECT 'agile_kick', 'アジャイルキック'
  UNION ALL SELECT 'divine_kick', '合掌キック'
  UNION ALL SELECT 'thrust_kick', 'スラストキック'
  UNION ALL SELECT 'yoga_mountain', 'ヨガマウンテン'
  UNION ALL SELECT 'karma_kick', '因果キック'
  UNION ALL SELECT 'yoga_mummy', 'ドリル頭突き'
  UNION ALL SELECT 'drill_kick', '弱ドリルキック'
  UNION ALL SELECT 'medium_drill_kick', '中ドリルキック'
  UNION ALL SELECT 'heavy_drill_kick', '強ドリルキック'
  UNION ALL SELECT 'yoga_fire_light', '弱ヨガファイア'
  UNION ALL SELECT 'yoga_fire_medium', '中ヨガファイア'
  UNION ALL SELECT 'yoga_fire_heavy', '強ヨガファイア'
  UNION ALL SELECT 'yoga_fire_od', 'ODヨガファイア'
  UNION ALL SELECT 'yoga_fire_holding_light', '弱ヨガファイア（ホールド）'
  UNION ALL SELECT 'yoga_fire_holding_medium', '中ヨガファイア（ホールド）'
  UNION ALL SELECT 'yoga_fire_holding_heavy', '強ヨガファイア（ホールド）'
  UNION ALL SELECT 'yoga_arch_light', '弱ヨガアーチ'
  UNION ALL SELECT 'yoga_arch_medium', '中ヨガアーチ'
  UNION ALL SELECT 'yoga_arch_heavy', '強ヨガアーチ'
  UNION ALL SELECT 'yoga_arch_od', 'ODヨガアーチ'
  UNION ALL SELECT 'yoga_flame_light', '弱ヨガフレイム'
  UNION ALL SELECT 'yoga_flame_medium', '中ヨガフレイム'
  UNION ALL SELECT 'yoga_flame_heavy', '強ヨガフレイム'
  UNION ALL SELECT 'yoga_flame_od', 'ODヨガフレイム'
  UNION ALL SELECT 'yoga_blast_light', '弱ヨガブラスト'
  UNION ALL SELECT 'yoga_blast_medium', '中ヨガブラスト'
  UNION ALL SELECT 'yoga_blast_heavy', '強ヨガブラスト'
  UNION ALL SELECT 'yoga_blast_od', 'ODヨガブラスト'
  UNION ALL SELECT 'yoga_comet_light', '弱ヨガコメット'
  UNION ALL SELECT 'yoga_comet_medium', '中ヨガコメット'
  UNION ALL SELECT 'yoga_comet_heavy', '強ヨガコメット'
  UNION ALL SELECT 'yoga_comet_od', 'ODヨガコメット'
  UNION ALL SELECT 'yoga_float', 'ヨガフロート'
  UNION ALL SELECT 'yoga_float_forward', 'ヨガフロート（前方）'
  UNION ALL SELECT 'aerial_yoga_float', '空中ヨガフロート'
  UNION ALL SELECT 'yoga_teleport', 'Pヨガテレポート（前方）'
  UNION ALL SELECT 'p_yoga_teleport_backward', 'Pヨガテレポート（後方）'
  UNION ALL SELECT 'k_yoga_teleport_forward', 'Kヨガテレポート（前方）'
  UNION ALL SELECT 'k_yoga_teleport_backward', 'Kヨガテレポート（後方）'
  UNION ALL SELECT 'aerial_yoga_teleport', 'P空中ヨガテレポート（前方）'
  UNION ALL SELECT 'p_aerial_yoga_teleport_backward', 'P空中ヨガテレポート（後方）'
  UNION ALL SELECT 'k_aerial_yoga_teleport_forward', 'K空中ヨガテレポート（前方）'
  UNION ALL SELECT 'k_aerial_yoga_teleport_backward', 'K空中ヨガテレポート（後方）'
  UNION ALL SELECT 'sa1_yoga_inferno_light', 'SA1 ヨガインフェルノ（弱）'
  UNION ALL SELECT 'sa1_yoga_inferno_medium', 'SA1 ヨガインフェルノ（中）'
  UNION ALL SELECT 'sa1_yoga_inferno_heavy', 'SA1 ヨガインフェルノ（強）'
  UNION ALL SELECT 'sa2_yoga_sunburst', 'SA2 ヨガサンバースト'
  UNION ALL SELECT 'sa2_yoga_sunburst_holding', '【ホールド】SA2 ヨガサンバースト'
  UNION ALL SELECT 'sa2_yoga_sunburst_max_holding', '【最大ホールド】SA2 ヨガサンバースト'
  UNION ALL SELECT 'sa3_merciless_yoga', 'SA3 ヨガマーシレス'
  UNION ALL SELECT 'ca_merciless_yoga', 'CA ヨガマーシレス'
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
  UNION ALL SELECT 'rush_yoga_uppercut', 'ヨガアッパー(ラッシュ)'
  UNION ALL SELECT 'rush_yoga_lance', 'ヨガランス(ラッシュ)'
  UNION ALL SELECT 'rush_nirvana_punch', '涅槃パンチ(ラッシュ)'
  UNION ALL SELECT 'rush_agile_kick', 'アジャイルキック(ラッシュ)'
  UNION ALL SELECT 'rush_divine_kick', '合掌キック(ラッシュ)'
  UNION ALL SELECT 'rush_thrust_kick', 'スラストキック(ラッシュ)'
  UNION ALL SELECT 'rush_yoga_mountain', 'ヨガマウンテン(ラッシュ)'
  UNION ALL SELECT 'rush_karma_kick', '因果キック(ラッシュ)'
) AS v
WHERE c.code = 'dhalsim' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

