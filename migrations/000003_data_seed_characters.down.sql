-- 000003_data_seed_characters.down.sql
-- ★層 B(CC-BY-SA-4.0)。SF6 の事実であり GAME_TABLES へ書くため `_data_` を持つ。

DELETE FROM characters;
DELETE FROM sqlite_sequence WHERE name = 'characters';
