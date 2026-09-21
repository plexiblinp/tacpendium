-- 000046_backfill_moves_is_derived_manon.up.sql
-- M14-03d: manon の is_derived backfill(CSV に載る code のみ UPDATE)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- CSV で is_derived=true の code のみ UPDATE する(触れない行は既定値 false のまま正しく振る舞う
-- ＝ユーザー生成行〔画面18 追加・rush-variant 生成〕に触れない。CHANGE-069 §2.1-d/-e)。
-- 既存マイグレは非改変(新規連番で追加)。

-- ===== manon (27 moves) =====
UPDATE moves SET is_derived = 1
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('a_terre', 'en_haut', 'allonge', 'temps_lie', 'renverse_feint_light', 'renverse_feint_medium', 'renverse_feint_heavy', 'renverse_feint_od', 'grand_fouette_light', 'grand_fouette_medium', 'grand_fouette_heavy', 'grand_fouette_od', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_reverence', 'rush_tomoe_derriere', 'rush_en_haut_1hit');

