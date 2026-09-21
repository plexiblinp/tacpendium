-- 000008_data_seed_preset_aliases.down.sql
-- ★層 B(CC-BY-SA-4.0)。SF6 の事実であり GAME_TABLES へ書くため `_data_` を持つ。

DELETE FROM preset_aliases;
DELETE FROM sqlite_sequence WHERE name = 'preset_aliases';
