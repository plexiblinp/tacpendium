-- 000034_backfill_moves_is_derived.down.sql
-- M17-02: 投入済み 10 キャラの is_derived backfill(CHANGE-069 §2.1-d。CSV に載る code のみ UPDATE)
-- 本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)。
-- CSV で is_derived=true の code のみ UPDATE する(触れない行は既定値 false のまま正しく振る舞う
-- ＝ユーザー生成行〔画面18 追加・rush-variant 生成〕に触れない。CHANGE-069 §2.1-d/-e)。
-- 既存マイグレは非改変(新規連番で追加)。

-- ===== ryu =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('high_double_strike', 'fuwa_triple_strike_2hits', 'fuwa_triple_strike', 'denjin_charge_hadoken', 'denjin_charge_od_hadoken', 'denjin_charge_hashogeki', 'denjin_charge_od_hashogeki', 'denjin_charge_sa1_shinku_hadoken', 'denjin_charge_sa2_shin_hashogeki_lv1', 'denjin_charge_sa2_shin_hashogeki_lv2', 'denjin_charge_sa2_shin_hashogeki_lv3', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_collarbone_breaker', 'rush_solar_plexus_strike', 'rush_short_uppercut', 'rush_axe_kick', 'rush_whirlwind_kick');

-- ===== zangief =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'zangief' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('sa2_cyclone_lariat_back', 'sa2_cyclone_lariat_holding', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_punch_holding', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_hellstab', 'rush_knee_hammer', 'rush_headbutt', 'rush_cyclone_wheel_kick', 'rush_smetana_dropkick', 'rush_power_stomps_1hits');

-- ===== mai =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'mai' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('hien_ren_kyaku_2hits', 'hien_ren_kyaku', 'hoshi_kujaku', 'flame_light_kachousen', 'flame_light_kachousen_holding', 'flame_medium_kachousen', 'flame_medium_kachousen_holding', 'flame_heavy_kachousen', 'flame_heavy_kachousen_holding', 'flame_od_kachousen', 'flame_od_kachousen_holding', 'midare_kachousen', 'flame_midare_kachousen', 'flame_light_ryuuenbu', 'flame_medium_ryuuenbu', 'flame_heavy_ryuuenbu', 'flame_od_ryuuenbu', 'flame_light_hissatsu_shinobi_bachi', 'flame_medium_hissatsu_shinobi_bachi', 'flame_heavy_hissatsu_shinobi_bachi', 'flame_od_hissatsu_shinobi_bachi', 'flame_light_hishou_ryuuenjin', 'flame_medium_hishou_ryuuenjin', 'flame_heavy_hishou_ryuuenjin', 'flame_od_hishou_ryuuenjin', 'musasabi_no_mai_od', 'musasabi_no_mai', 'flame_od_musasabi_no_mai', 'flame_musasabi_no_mai', 'flame_sa1_kagerou_no_mai', 'flame_sa2_chou_hissatsu_shinobi_bachi', 'flame_sa2_air_chou_hissatsu_shinobi_bachi', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_senkotsu_uchi', 'rush_hoshi_kujaku_1hits');

-- ===== ken =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ken' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('emergency_stop', 'thunder_kick', 'forward_step_kick', 'quick_dash_shoryuken', 'quick_dash_tatsumaki_senpu_kyaku', 'quick_dash_dragonlash_kick', 'kazekama_shin_kick_od', 'kazekama_shin_kick', 'gorai_axe_kick_od', 'gorai_axe_kick', 'senka_snap_kick_od', 'senka_snap_kick', 'kasai_thrust_kick', 'kasai_thrust_kick_during_od_gorai_axe_kick', 'kasai_thrust_kick_during_od_senka_snap_kick', 'chin_buster', 'triple_flash_kicks_2hits', 'triple_flash_kicks', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick');

-- ===== juri =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'juri' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('death_crest_2hits', 'fuha_saihasho', 'fuha_ankensatsu', 'fuha_go_ohsatsu', 'shiren_sen_od', 'shiren_sen', 'fuha_sa1_sakkai_fuhazan', 'sa2_feng_shui_engine_dash', 'death_crest', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_kyosesho', 'rush_senkai_kick', 'rush_renko_kicks', 'rush_korenzan');

-- ===== kimberly =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'kimberly' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('step_up_backward', 'step_up_neutral', 'step_up_forward', 'emergency_stop_od', 'emergency_stop', 'torso_cleaver_od', 'torso_cleaver', 'shadow_slide_od', 'shadow_slide', 'neck_hunter_od', 'neck_hunter', 'arc_step_od', 'arc_step', 'bushin_izuna_otoshi_od', 'bushin_izuna_otoshi', 'bushin_hojin_kick_od', 'bushin_hojin_kick', 'sa1_bushin_thunderous_beats', 'bushin_tiger_fangs', 'bushin_prism_strikes_2hits', 'bushin_prism_strikes_3hits', 'bushin_prism_strikes', 'bushin_hellchain_3hits', 'bushin_hellchain', 'bushin_hellchain_throw', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_water_slicer_slide', 'rush_windmill_kick', 'rush_hisen_kick');

-- ===== ingrid =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'ingrid' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('pretty_heel_kick', 'glowing_touch', 'luminous_uppercut', 'satelite_leap', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_sun_bright', 'rush_halo_flight', 'rush_glowing_touch_1hits', 'rush_luminous_uppercut_1hits');

-- ===== lily =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'lily' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('windclad_light_condor_spire', 'windclad_medium_condor_spire', 'windclad_heavy_condor_spire', 'windclad_od_condor_spire', 'windclad_light_tomahawk_buster', 'windclad_medium_tomahawk_buster', 'windclad_heavy_tomahawk_buster', 'windclad_od_tomahawk_buster', 'windclad_od_condor_dive', 'windclad_condor_dive', 'windclad_od_condor_dive_follow_up', 'condor_dive_follow_up', 'windclad_sa2_thunderbird', 'windclad_sa2_soaring_thunderbird', 'desert_storm_2hits', 'desert_storm', 'double_arrow', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_ridge_thrust', 'rush_horn_breaker', 'rush_desert_storm_1hits');

-- ===== guile =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('recoil_cannon', 'double_shot', 'drake_fang', 'phantom_cutter', 'sonic_boom_perfect_light', 'sonic_boom_perfect_medium', 'sonic_boom_perfect_heavy', 'somersault_kick_perfect_light', 'somersault_kick_perfect_medium', 'somersault_kick_perfect_heavy', 'sonic_cross_light', 'sonic_cross_perfect_light', 'sonic_cross_medium', 'sonic_cross_perfect_medium', 'sonic_cross_heavy', 'sonic_cross_perfect_heavy', 'sonic_cross_od', 'sonic_cross_perfect_od', 'sonic_cross_2_meter_od', 'sonic_break', 'sonic_break_od', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_full_bullet_magnum', 'rush_burning_straight', 'rush_spinning_back_knuckle', 'rush_knee_bazooka', 'rush_rolling_sobat', 'rush_reverse_spin_kick', 'rush_guile_high_kick');

-- ===== terry =====
UPDATE moves SET is_derived = 0
WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code IN ('sa2_twin_geyser', 'sa2_triple_geyser', 'power_drive', 'power_shoot', 'power_dunk', 'passing_sway', 'jumping_lariat', 'jumping_knee', 'fire_kick', 'rush_standing_light_punch', 'rush_standing_light_kick', 'rush_standing_medium_punch', 'rush_standing_medium_kick', 'rush_standing_heavy_punch', 'rush_standing_heavy_kick', 'rush_crouching_light_punch', 'rush_crouching_light_kick', 'rush_crouching_medium_punch', 'rush_crouching_medium_kick', 'rush_crouching_heavy_punch', 'rush_crouching_heavy_kick', 'rush_hammer_punch');

