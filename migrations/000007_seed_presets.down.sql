-- 000007_seed_presets.down.sql
-- ★層 A(AGPL-3.0-or-later)。GAME_TABLES へ 1 行も書かないため `_data_` を持たない。

DELETE FROM presets;
DELETE FROM sqlite_sequence WHERE name = 'presets';
