-- clear-validation-data.sql
-- フェーズ1完了時の検証用データ全クリア(SUPP-001 §3.1 手順1、M7-05 系統G)。
--
-- 目的: 開発期間中に作成した検証用のコンボ・セットプレイ(手動作成分 + マイグレーション
--       旧マイグレ 000012 の耐久テスト用 36 件)を物理削除し、フェーズ1完了の「クリーンな初期状態」を作る。
--
-- 保持するもの(マスタ/シードのため削除しない):
--   games / characters / moves / presets / preset_aliases / users / tags(定義)。
--   ※ tags は「定義」を保持。combo_tags(コンボ↔タグの関連)は下記で削除する。
--
-- 実行方法(アプリ停止中に、対象 DB ファイルへ):
--   sqlite3 <tacpendium.db> < scripts/clear-validation-data.sql
--   ※ 開発者が統合E2Eの回帰確認を終えてから実行する(M7-05 指示書 §5.3)。
--   ※ §10「データベースファイルの直接削除禁止」に抵触しない: 本スクリプトは行 DELETE であり
--      DB ファイル自体は削除しない。スキーマ変更も行わない。
--   ※ 破壊的操作のため、実行前に DB のバックアップ(VACUUM INTO 等)を取得することを推奨。
--
-- スコープ補足:
--   既定は「全キャラのコンボ・セットプレイを全削除」(= 完全なクリーンスレート)。
--   リュウ(character_id = 1)のみに限定したい場合は、末尾のコメント版 WHERE 句を参照。

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- 子テーブルを先に明示削除(foreign_keys=OFF の sqlite3 セッションでも確実に消すため。
-- ON DELETE CASCADE が効く環境では combos/setups 削除でも消えるが、二重の安全策)。
DELETE FROM combo_setups;
DELETE FROM combo_tags;
DELETE FROM combo_steps;
DELETE FROM setup_steps;

-- 本体
DELETE FROM setups;
DELETE FROM combos;

-- AUTOINCREMENT のシーケンスもリセットし、ID を 1 から再採番できるようにする。
DELETE FROM sqlite_sequence
 WHERE name IN ('combos', 'combo_steps', 'setups', 'setup_steps');

COMMIT;

-- 物理削除後の断片化解消(任意)。
VACUUM;

-- ---------------------------------------------------------------------------
-- リュウ限定で削除したい場合の参考(上記の DELETE FROM combos / setups を置き換える):
--
--   DELETE FROM combos WHERE character_id = 1;
--   DELETE FROM setups WHERE character_id = 1;
--
-- ただし子テーブル(combo_steps / combo_tags / combo_setups / setup_steps)は
-- PRAGMA foreign_keys = ON 下での ON DELETE CASCADE 任せ、もしくは対象 combo_id /
-- setup_id を絞った明示削除に切り替えること。
-- ---------------------------------------------------------------------------
