-- 000047_seed_move_commands_manon.down.sql
-- M14-03d: manon の command 索引 move_commands の seed(非派生のみ)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 非派生技(is_derived=false)のみ搭載。token_key は numpad 正規化済み(internal/moveindex が一元管理)。
-- 索引は広く持つ(必殺技・空中技も搭載)＝段階2 スコープへの絞り込みは消費者側(CHANGE-069 §1.5-6)。
-- 既存マイグレは非改変(新規連番で追加)。FK 依存順 characters→moves→move_commands。

-- ===== manon =====
DELETE FROM move_commands WHERE move_id IN (
    SELECT m.id FROM moves m JOIN characters c ON c.id = m.character_id WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code IN ('sa2_etoile', 'degage_heavy', 'degage_od', 'degage_light', 'degage_medium', 'sa1_arabesque', 'sa3_pas_de_deux', 'ca_pas_de_deux', 'rond_point_heavy', 'renverse_heavy', 'rond_point_od', 'rond_point_light', 'renverse_light', 'rond_point_medium', 'renverse_medium', 'renverse_od', 'crouching_heavy_kick', 'crouching_heavy_punch', 'crouching_light_kick', 'crouching_light_punch', 'crouching_medium_kick', 'crouching_medium_punch', 'tomoe_derriere', 'reverence', 'throw_back', 'en_haut_1hit', 'throw_forward', 'manege_dore_heavy', 'manege_dore_light', 'manege_dore_medium', 'manege_dore_od', 'standing_heavy_kick', 'jumping_heavy_kick', 'standing_heavy_punch', 'jumping_heavy_punch', 'drive_impact', 'standing_light_kick', 'jumping_light_kick', 'standing_light_punch', 'jumping_light_punch', 'standing_medium_kick', 'jumping_medium_kick', 'standing_medium_punch', 'jumping_medium_punch', 'drive_parry'));

