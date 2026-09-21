-- 000007_seed_presets.up.sql
-- M33-02(S06a): presets。行 3 / 最大 id 5(差 2 は削除済み 2 プリセットの跡)。
-- ★★presets はアプリの設計物であって SF6 の事実ではない ⇒ 層 A。`_data_` を入れないこと。
--   ⇒ GAME_TABLES に presets は入っていない。
--
-- ★組込 3 件はいずれも user_id IS NULL / is_builtin = 1 である(実測)。
--   ⇒ users(000009) より前に置いても FK は破れない。
--   ★利用者が足した presets はユーザーデータであり、移行の扱いは M33-03 の射程である。
-- ★層 A(AGPL-3.0-or-later)。GAME_TABLES へ 1 行も書かないため `_data_` を持たない。

INSERT INTO presets (id, user_id, code, name, base_preset_code, is_builtin) VALUES
  (1, NULL, 'official_ja_move', '公式表記(日本語・技名表示)改善版', NULL, 1),
  (3, NULL, 'numeric', 'ナンバリング記法', NULL, 1),
  (5, NULL, 'srk', 'SRK 記法', NULL, 1);
