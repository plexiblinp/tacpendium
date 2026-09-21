-- 000009_seed_initial_users_tags.up.sql
-- M33-02(S07): 初期 users(1 行) ＋ 予約 tags(3 行)。
-- ★★users / tags は SF6 の事実ではない ⇒ 層 A。`_data_` を入れないこと。
--   ⇒ GAME_TABLES に users / tags は入っていない(S07 が層 A である理由そのもの)。
--
-- ★★created_at は値を写さない。旧 000007 と同じく DEFAULT (datetime('now')) に任せる。
--   ⇒ 値は構築時刻であり、独立に構築した 2 つの DB では原理的に一致しない。
--     旧系列同士でも一致しない(実測: 3 回の独立構築で 3 つの異なる値)。
--   ★ここで値を固定すると、旧の意味論を*変えて*しまう。⇒ 意味論をそのまま再現する。
--
-- ★users / tags は hybrid 表である(seed 由来と利用者由来が混ざる)。
--   ⇒ 「seed 由来と利用者由来を分ける述語」は本サブでは決めない。M33-03 の入力である。
-- ★層 A(AGPL-3.0-or-later)。GAME_TABLES へ 1 行も書かないため `_data_` を持たない。

INSERT OR IGNORE INTO users (id, name, password_hash, main_character_id) VALUES
  (1, 'default', NULL, NULL);
INSERT INTO tags (id, user_id, name, category, color) VALUES
  (1, 1, '使用中', 'mycombo_status', '#10B981'),
  (2, 1, '練習中', 'mycombo_status', '#3B82F6'),
  (3, 1, '頻度低下', 'mycombo_status', '#6B7280');
