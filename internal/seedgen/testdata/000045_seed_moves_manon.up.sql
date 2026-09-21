-- 000045_seed_moves_manon.up.sql
-- M14-03d: manon の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(第二波)。
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 移動 system move は CSV に無い(seed の投入元は 000004_data_seed_moves)。
-- FK 依存順 characters→moves→preset_aliases。

-- ===== manon (72 moves) =====
INSERT INTO moves (character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data)
SELECT c.id, v.code, v.category, v.damage, v.startup, v.active, v.total, v.on_hit, v.on_block, v.recovery, v.is_aerial, v.raw_data
FROM characters c
CROSS JOIN (
        SELECT 'standing_light_punch' AS code, 'normal' AS category, 300 AS damage, 4 AS startup, 3 AS active, 16 AS total, 4 AS on_hit, -1 AS on_block, 10 AS recovery, 0 AS is_aerial, NULL AS raw_data
  UNION ALL SELECT 'standing_light_kick', 'normal', 300, 5, 2, 18, 2, -2, 12, 0, NULL
  UNION ALL SELECT 'standing_medium_punch', 'normal', 600, 7, 4, 25, 2, -2, 15, 0, NULL
  UNION ALL SELECT 'standing_medium_kick', 'normal', 600, 10, 3, 30, -2, -5, 18, 0, NULL
  UNION ALL SELECT 'standing_heavy_punch', 'normal', 800, 10, 4, 33, 0, -3, 20, 0, NULL
  UNION ALL SELECT 'standing_heavy_kick', 'normal', 900, 15, 3, 43, 1, -6, 26, 0, NULL
  UNION ALL SELECT 'crouching_light_punch', 'normal', 300, 4, 2, 16, 3, -2, 11, 0, NULL
  UNION ALL SELECT 'crouching_light_kick', 'normal', 200, 5, 2, 19, -1, -3, 13, 0, NULL
  UNION ALL SELECT 'crouching_medium_punch', 'normal', 600, 7, 3, 24, 6, -1, 15, 0, NULL
  UNION ALL SELECT 'crouching_medium_kick', 'normal', 600, 8, 4, 27, 3, -2, 16, 0, NULL
  UNION ALL SELECT 'crouching_heavy_punch', 'normal', 600, 10, 5, 35, -2, -8, 21, 0, NULL
  UNION ALL SELECT 'crouching_heavy_kick', 'normal', 900, 11, 2, 39, NULL, -12, 27, 0, NULL
  UNION ALL SELECT 'jumping_light_punch', 'normal', 300, 5, 10, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_light_kick', 'normal', 300, 6, 9, 46, NULL, NULL, 32, 1, NULL
  UNION ALL SELECT 'jumping_medium_punch', 'normal', 700, 8, 4, 46, NULL, NULL, 35, 1, NULL
  UNION ALL SELECT 'jumping_medium_kick', 'normal', 500, 7, 6, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_punch', 'normal', 800, 9, 4, 46, NULL, NULL, 34, 1, NULL
  UNION ALL SELECT 'jumping_heavy_kick', 'normal', 800, 11, 5, 46, NULL, NULL, 31, 1, NULL
  UNION ALL SELECT 'drive_impact', 'drive_impact', 800, 26, 2, 62, NULL, -3, 35, 0, NULL
  UNION ALL SELECT 'throw_forward', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'throw_back', 'throw', 1200, 5, 3, 30, NULL, NULL, 23, 0, NULL
  UNION ALL SELECT 'drive_parry', 'system', 0, 1, 12, 45, NULL, NULL, 33, 0, NULL
  UNION ALL SELECT 'reverence', 'unique', 800, 8, 6, 30, 3, 1, 17, 0, NULL
  UNION ALL SELECT 'tomoe_derriere', 'unique', 1000, 11, 9, 51, NULL, -23, 32, 0, NULL
  UNION ALL SELECT 'a_terre', 'target_combo', 1100, 10, 2, 28, 2, -5, 17, 0, NULL
  UNION ALL SELECT 'en_haut', 'target_combo', 1100, 14, 5, 39, -3, -11, 21, 0, NULL
  UNION ALL SELECT 'en_haut_1hit', 'unique', 600, 10, 4, 32, NULL, -3, 19, 0, NULL
  UNION ALL SELECT 'allonge', 'target_combo', 1100, 4, 4, 33, 1, -10, 26, 0, NULL
  UNION ALL SELECT 'temps_lie', 'target_combo', 1400, 5, 5, 26, 3, -8, 17, 0, NULL
  UNION ALL SELECT 'manege_dore_light', 'special', 2000, 10, 2, 60, NULL, NULL, 49, 0, NULL
  UNION ALL SELECT 'manege_dore_medium', 'special', 2000, 8, 2, 60, NULL, NULL, 51, 0, NULL
  UNION ALL SELECT 'manege_dore_heavy', 'special', 2000, 5, 2, 60, NULL, NULL, 54, 0, NULL
  UNION ALL SELECT 'manege_dore_od', 'special', 2000, 8, 2, 60, NULL, NULL, 51, 0, NULL
  UNION ALL SELECT 'rond_point_light', 'special', 900, 9, 7, 44, 3, -15, 29, 0, NULL
  UNION ALL SELECT 'rond_point_medium', 'special', 1000, 11, 9, 46, NULL, -14, 27, 0, NULL
  UNION ALL SELECT 'rond_point_heavy', 'special', 800, 14, 9, 46, NULL, -11, 24, 0, NULL
  UNION ALL SELECT 'rond_point_od', 'special', 800, 8, 9, 46, NULL, -19, 30, 0, NULL
  UNION ALL SELECT 'degage_light', 'special', 1000, 16, 16, 67, NULL, -24, 36, 0, NULL
  UNION ALL SELECT 'degage_medium', 'special', 1200, 16, 24, 61, NULL, -13, 22, 0, NULL
  UNION ALL SELECT 'degage_heavy', 'special', 1000, 20, 3, 46, 3, -9, 24, 0, NULL
  UNION ALL SELECT 'degage_od', 'special', 800, 22, 3, 46, 6, -3, 22, 0, NULL
  UNION ALL SELECT 'renverse_light', 'special', 1350, 22, 2, 60, NULL, -23, 37, 0, NULL
  UNION ALL SELECT 'renverse_medium', 'special', 1400, 25, 2, 60, NULL, -20, 34, 0, NULL
  UNION ALL SELECT 'renverse_heavy', 'special', 1500, 29, 2, 60, NULL, -16, 30, 0, NULL
  UNION ALL SELECT 'renverse_od', 'special', 1500, 25, 2, 60, NULL, -20, 34, 0, NULL
  UNION ALL SELECT 'renverse_feint_light', 'special', 0, 3, 13, 31, NULL, NULL, 16, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'renverse_feint_medium', 'special', 0, 3, 14, 32, NULL, NULL, 16, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'renverse_feint_heavy', 'special', 0, 3, 15, 33, NULL, NULL, 16, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'renverse_feint_od', 'special', 0, 4, 14, 33, NULL, NULL, 16, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'grand_fouette_light', 'special', 800, 27, 6, 54, NULL, -5, 22, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'grand_fouette_medium', 'special', 800, 28, 6, 55, NULL, -5, 22, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'grand_fouette_heavy', 'special', 800, 29, 6, 56, NULL, -5, 22, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'grand_fouette_od', 'special', 800, 25, 6, 52, NULL, -12, 22, 0, '{"notes_tool":"強度は派生元のランヴェルセと対応。ランヴェルセから最速で出した場合に消費できるフレームを記録"}'
  UNION ALL SELECT 'sa1_arabesque', 'super_art', 2000, 10, 4, 78, NULL, -49, 65, 0, NULL
  UNION ALL SELECT 'sa2_etoile', 'super_art', 2800, 7, 74, 152, NULL, -61, 72, 0, NULL
  UNION ALL SELECT 'sa3_pas_de_deux', 'super_art', 4000, 7, 2, 80, NULL, NULL, 72, 0, NULL
  UNION ALL SELECT 'ca_pas_de_deux', 'critical_art', 4500, 7, 2, 80, NULL, NULL, 72, 0, NULL
  UNION ALL SELECT 'rush_standing_light_punch', 'rush_variant', 300, 15, 3, 27, 8, 3, 10, 0, NULL
  UNION ALL SELECT 'rush_standing_light_kick', 'rush_variant', 300, 16, 2, 29, 6, 2, 12, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_punch', 'rush_variant', 600, 18, 4, 36, 6, 2, 15, 0, NULL
  UNION ALL SELECT 'rush_standing_medium_kick', 'rush_variant', 600, 21, 3, 41, 2, -1, 18, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_punch', 'rush_variant', 800, 21, 4, 44, 4, 1, 20, 0, NULL
  UNION ALL SELECT 'rush_standing_heavy_kick', 'rush_variant', 900, 26, 3, 54, 5, -2, 26, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_punch', 'rush_variant', 300, 15, 2, 27, 7, 2, 11, 0, NULL
  UNION ALL SELECT 'rush_crouching_light_kick', 'rush_variant', 200, 16, 2, 30, 3, 1, 13, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_punch', 'rush_variant', 600, 18, 3, 35, 10, 3, 15, 0, NULL
  UNION ALL SELECT 'rush_crouching_medium_kick', 'rush_variant', 600, 19, 4, 38, 7, 2, 16, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_punch', 'rush_variant', 600, 21, 5, 46, 2, -4, 21, 0, NULL
  UNION ALL SELECT 'rush_crouching_heavy_kick', 'rush_variant', 900, 22, 2, 50, NULL, -8, 27, 0, NULL
  UNION ALL SELECT 'rush_reverence', 'rush_variant', 800, 19, 6, 41, 7, 5, 17, 0, NULL
  UNION ALL SELECT 'rush_tomoe_derriere', 'rush_variant', 1000, 22, 9, 62, NULL, -19, 32, 0, NULL
  UNION ALL SELECT 'rush_en_haut_1hit', 'rush_variant', 600, 21, 4, 43, NULL, 1, 19, 0, NULL
) AS v
WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6');

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
        WHEN 'rush_reverence' THEN 'reverence'
        WHEN 'rush_tomoe_derriere' THEN 'tomoe_derriere'
        WHEN 'rush_en_haut_1hit' THEN 'en_haut_1hit'
    END)
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_reverence', 'rush_tomoe_derriere', 'rush_en_haut_1hit');

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
  UNION ALL SELECT 'reverence', 'レベランス'
  UNION ALL SELECT 'tomoe_derriere', 'トモエ・デリエール'
  UNION ALL SELECT 'a_terre', 'ア・テール'
  UNION ALL SELECT 'en_haut', 'アン・オー'
  UNION ALL SELECT 'en_haut_1hit', 'アン・オー(単発)'
  UNION ALL SELECT 'allonge', 'アロンジェ'
  UNION ALL SELECT 'temps_lie', 'タン・リエ'
  UNION ALL SELECT 'manege_dore_light', '弱マネージュ・ドレ'
  UNION ALL SELECT 'manege_dore_medium', '中マネージュ・ドレ'
  UNION ALL SELECT 'manege_dore_heavy', '強マネージュ・ドレ'
  UNION ALL SELECT 'manege_dore_od', 'ODマネージュ・ドレ'
  UNION ALL SELECT 'rond_point_light', '弱ロン・ポワン'
  UNION ALL SELECT 'rond_point_medium', '中ロン・ポワン'
  UNION ALL SELECT 'rond_point_heavy', '強ロン・ポワン'
  UNION ALL SELECT 'rond_point_od', 'ODロン・ポワン'
  UNION ALL SELECT 'degage_light', '弱デガジェ'
  UNION ALL SELECT 'degage_medium', '中デガジェ'
  UNION ALL SELECT 'degage_heavy', '強デガジェ'
  UNION ALL SELECT 'degage_od', 'ODデガジェ'
  UNION ALL SELECT 'renverse_light', '弱ランヴェルセ'
  UNION ALL SELECT 'renverse_medium', '中ランヴェルセ'
  UNION ALL SELECT 'renverse_heavy', '強ランヴェルセ'
  UNION ALL SELECT 'renverse_od', 'ODランヴェルセ'
  UNION ALL SELECT 'renverse_feint_light', '弱ランヴェルセ(フェイント)'
  UNION ALL SELECT 'renverse_feint_medium', '中ランヴェルセ(フェイント)'
  UNION ALL SELECT 'renverse_feint_heavy', '強ランヴェルセ(フェイント)'
  UNION ALL SELECT 'renverse_feint_od', 'ODランヴェルセ(フェイント)'
  UNION ALL SELECT 'grand_fouette_light', '弱グラン・フェッテ'
  UNION ALL SELECT 'grand_fouette_medium', '中グラン・フェッテ'
  UNION ALL SELECT 'grand_fouette_heavy', '強グラン・フェッテ'
  UNION ALL SELECT 'grand_fouette_od', 'ODグラン・フェッテ'
  UNION ALL SELECT 'sa1_arabesque', 'SA1 アラベスク'
  UNION ALL SELECT 'sa2_etoile', 'SA2 エトワール'
  UNION ALL SELECT 'sa3_pas_de_deux', 'SA3 パ・ド・ドゥ'
  UNION ALL SELECT 'ca_pas_de_deux', 'CA パ・ド・ドゥ'
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
  UNION ALL SELECT 'rush_reverence', 'レベランス(ラッシュ)'
  UNION ALL SELECT 'rush_tomoe_derriere', 'トモエ・デリエール(ラッシュ)'
  UNION ALL SELECT 'rush_en_haut_1hit', 'アン・オー(単発)(ラッシュ)'
) AS v
WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

