-- 000001_init_schema.down.sql
-- M33-02(S01): 最終スキーマの撤去。★依存の逆順に落とす。
-- ★層 A(AGPL-3.0-or-later)。
--
-- ★索引は表と一緒に落ちるため個別に DROP しない。
-- ★sqlite_sequence はシステム表であり DROP できない。AUTOINCREMENT 表が全て落ちれば空になる。
DROP TABLE IF EXISTS combo_punish_starters;
DROP TABLE IF EXISTS combo_punish_prunings;
DROP TABLE IF EXISTS combo_punish_curations;
DROP TABLE IF EXISTS combo_punishes;
DROP TABLE IF EXISTS combo_oki_options;
DROP TABLE IF EXISTS combo_setup_results;
DROP TABLE IF EXISTS combo_setups;
DROP TABLE IF EXISTS combo_tags;
DROP TABLE IF EXISTS setup_steps;
DROP TABLE IF EXISTS combo_steps;
DROP TABLE IF EXISTS combos;
DROP TABLE IF EXISTS setups;
DROP TABLE IF EXISTS move_derivations;
DROP TABLE IF EXISTS move_commands;
DROP TABLE IF EXISTS preset_aliases;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS presets;
DROP TABLE IF EXISTS moves;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS games;
