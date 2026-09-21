-- 000047_seed_move_commands_manon.up.sql
-- M14-03d: manon の command 索引 move_commands の seed(非派生のみ)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- 非派生技(is_derived=false)のみ搭載。token_key は numpad 正規化済み(internal/moveindex が一元管理)。
-- 索引は広く持つ(必殺技・空中技も搭載)＝段階2 スコープへの絞り込みは消費者側(CHANGE-069 §1.5-6)。
-- 既存マイグレは非改変(新規連番で追加)。FK 依存順 characters→moves→move_commands。

-- ===== manon (45 commands) =====
INSERT INTO move_commands (move_id, character_id, token_key)
SELECT m.id, m.character_id, v.token_key
FROM moves m
JOIN characters c ON c.id = m.character_id
CROSS JOIN (
        SELECT 'sa2_etoile' AS code, '214214K' AS token_key
  UNION ALL SELECT 'degage_heavy', '214HK'
  UNION ALL SELECT 'degage_od', '214K+K'
  UNION ALL SELECT 'degage_light', '214LK'
  UNION ALL SELECT 'degage_medium', '214MK'
  UNION ALL SELECT 'sa1_arabesque', '236236K'
  UNION ALL SELECT 'sa3_pas_de_deux', '236236P'
  UNION ALL SELECT 'ca_pas_de_deux', '236236P'
  UNION ALL SELECT 'rond_point_heavy', '236HK'
  UNION ALL SELECT 'renverse_heavy', '236HP'
  UNION ALL SELECT 'rond_point_od', '236K+K'
  UNION ALL SELECT 'rond_point_light', '236LK'
  UNION ALL SELECT 'renverse_light', '236LP'
  UNION ALL SELECT 'rond_point_medium', '236MK'
  UNION ALL SELECT 'renverse_medium', '236MP'
  UNION ALL SELECT 'renverse_od', '236P+P'
  UNION ALL SELECT 'crouching_heavy_kick', '2HK'
  UNION ALL SELECT 'crouching_heavy_punch', '2HP'
  UNION ALL SELECT 'crouching_light_kick', '2LK'
  UNION ALL SELECT 'crouching_light_punch', '2LP'
  UNION ALL SELECT 'crouching_medium_kick', '2MK'
  UNION ALL SELECT 'crouching_medium_punch', '2MP'
  UNION ALL SELECT 'tomoe_derriere', '3HK'
  UNION ALL SELECT 'reverence', '4HP'
  UNION ALL SELECT 'throw_back', '4LP+LK'
  UNION ALL SELECT 'en_haut_1hit', '4MK'
  UNION ALL SELECT 'throw_forward', '5/6LP+LK'
  UNION ALL SELECT 'manege_dore_heavy', '63214HP'
  UNION ALL SELECT 'manege_dore_light', '63214LP'
  UNION ALL SELECT 'manege_dore_medium', '63214MP'
  UNION ALL SELECT 'manege_dore_od', '63214P+P'
  UNION ALL SELECT 'standing_heavy_kick', 'HK'
  UNION ALL SELECT 'jumping_heavy_kick', 'HK'
  UNION ALL SELECT 'standing_heavy_punch', 'HP'
  UNION ALL SELECT 'jumping_heavy_punch', 'HP'
  UNION ALL SELECT 'drive_impact', 'HP+HK'
  UNION ALL SELECT 'standing_light_kick', 'LK'
  UNION ALL SELECT 'jumping_light_kick', 'LK'
  UNION ALL SELECT 'standing_light_punch', 'LP'
  UNION ALL SELECT 'jumping_light_punch', 'LP'
  UNION ALL SELECT 'standing_medium_kick', 'MK'
  UNION ALL SELECT 'jumping_medium_kick', 'MK'
  UNION ALL SELECT 'standing_medium_punch', 'MP'
  UNION ALL SELECT 'jumping_medium_punch', 'MP'
  UNION ALL SELECT 'drive_parry', 'MP+MK'
) AS v
WHERE c.code = 'manon' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = v.code;

