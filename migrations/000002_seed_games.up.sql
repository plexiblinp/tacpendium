-- 000002_seed_games.up.sql
-- M33-02(S02a): games。
-- ★games はアプリの設計物であって SF6 の事実ではない ⇒ 層 A。`_data_` を入れないこと。
--   旧系列では 000002(初期投入)と 000104(current_data_version の DEFAULT) が作った最終状態。
-- ★層 A(AGPL-3.0-or-later)。GAME_TABLES へ 1 行も書かないため `_data_` を持たない。

INSERT INTO games (id, code, name_ja, name_en, current_data_version) VALUES
  (1, 'sf6', 'ストリートファイター6', 'Street Fighter 6', '2026.08.03.01');
