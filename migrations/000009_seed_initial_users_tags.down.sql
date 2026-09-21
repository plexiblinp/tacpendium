-- 000009_seed_initial_users_tags.down.sql
-- ★層 A(AGPL-3.0-or-later)。GAME_TABLES へ 1 行も書かないため `_data_` を持たない。

DELETE FROM tags;
DELETE FROM users;
DELETE FROM sqlite_sequence WHERE name IN ('tags', 'users');
