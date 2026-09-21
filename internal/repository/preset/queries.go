package preset

const listAllPresetsSQL = `
SELECT id, user_id, code, name, base_preset_code, is_builtin
FROM presets
ORDER BY id`

const findPresetByIDSQL = `
SELECT id, user_id, code, name, base_preset_code, is_builtin
FROM presets
WHERE id = ?`

const findPresetByCodeSQL = `
SELECT id, user_id, code, name, base_preset_code, is_builtin
FROM presets
WHERE code = ?`

const findAliasSQL = `
SELECT id, preset_id, move_id, alias_text
FROM preset_aliases
WHERE preset_id = ? AND move_id = ?`

const listAliasesByPresetSQL = `
SELECT id, preset_id, move_id, alias_text
FROM preset_aliases
WHERE preset_id = ?
ORDER BY id`

// listAliasEntriesByCharacterSQL は当該キャラの逆引き辞書を全プリセット横断で返す
// (M20-07。M17-04 の findMoveCodesByAliasSQL を置き換えたもの)。
//
// ★1 表記ずつ SQL で引かなくなった理由——逆引きの前段に NFKC 正規化を置くことになったが
// (D-307)、SQLite は NFKC を持たないため辞書側へ正規化を掛けられない。⇒ 照合そのものを
// Go 側(internal/aliasindex)へ移し、SQL は材料を返すだけにした。
//
// ★DISTINCT を付けていないのは、畳む役目が索引側(move.code の集合)へ移ったためである。
// 同一 move が複数プリセットで同じ表記を持つ重複(実測 714 件)は集合が 1 件に畳む。
//
// ★プリセットで絞らない。全プリセット横断はカスタムプリセットを逆引き辞書に使うための
// 仕様である(DES-003 §3.9・G-11)。⇒ プリセットを跨いだ 1:N は成立し、複数件は未解決に倒れる。
//
// ★キャラスコープは moves.character_id 経由で掛ける(preset_aliases.character_id は
// nullable であり、入れ忘れた行が静かに漏れるため鍵に使わない。DES-004 §5.7-1)。
//
// ★ORDER BY は索引の構築順を決定的にするためだけに付けてある(照合結果の順序は
// aliasindex が move.code 昇順で決める)。テストが行順に依存できるようにする意図。
const listAliasEntriesByCharacterSQL = `
SELECT m.code, pa.alias_text, pa.alias_text_en
FROM preset_aliases pa
JOIN moves m ON m.id = pa.move_id
JOIN characters c ON c.id = m.character_id
WHERE c.code = ?
ORDER BY m.code, pa.alias_text, pa.preset_id`

// ===========================================================================
// M20-04: 書き込み経路の SQL(本サブが preset_aliases への最初の本番 INSERT を持つ)
// ===========================================================================

const countPresetsSQL = `SELECT count(*) FROM presets`

// countPresetsByNameSQL は VAL-P03(プリセット名が同一ユーザー内で一意か)用。
// 第 3 引数は除外する id(更新時に自分自身を数えないため。新規作成時は 0 を渡す)。
const countPresetsByNameSQL = `
SELECT count(*) FROM presets
WHERE user_id = ? AND name = ? AND id <> ?`

// listCustomPresetCodesSQL は code 採番用。'custom_' 前方一致の判定は Go 側で行う
// (SQL の LIKE では '_' が 1 文字ワイルドカードになり、前方一致の意図がぼやけるため)。
const listCustomPresetCodesSQL = `SELECT code FROM presets WHERE is_builtin = 0`

// createPresetSQL は ★id を指定しない。AUTOINCREMENT に任せる。
// presets.id は preset_aliases / recipe_cache のキー / config / SUPP-001 §7.4.1 の
// 4 経路から参照されており、詰めたり振り直したりしてはならない(M20-01 の最重要ゲート)。
const createPresetSQL = `
INSERT INTO presets (user_id, code, name, base_preset_code, is_builtin)
VALUES (?, ?, ?, ?, 0)`

// copyAliasesSQL はベースプリセットの全エイリアスを新しい preset_id で複製する
// (DES-004 §6.1: カスタムプリセットは参照ではなく複製を持つ)。
//
// ★character_id を明示的に列挙している(DES-004 §5.7-1)。同列は nullable であり、
// 入れ忘れても INSERT は通るが、その行は UNIQUE(preset_id, character_id, alias_text) に
// 当たらず制約を静かにすり抜ける。落ちないため、抜けても誰も気づけない。
// ★alias_text_en も引き継ぐ(編集 UI は作らないが値は複製する。指示書 §4.3-3)。
const copyAliasesSQL = `
INSERT INTO preset_aliases (preset_id, move_id, alias_text, alias_text_en, character_id)
SELECT ?, move_id, alias_text, alias_text_en, character_id
FROM preset_aliases
WHERE preset_id = ?`

const countAliasesByPresetSQL = `SELECT count(*) FROM preset_aliases WHERE preset_id = ?`

// countAliasesWithNullCharacterSQL は「コピー直後に character_id が NULL の行が 0 件」を
// 主張するための検査用(指示書 §5 (b))。★これが落ちないバグの唯一の検出手段である。
const countAliasesWithNullCharacterSQL = `
SELECT count(*) FROM preset_aliases WHERE preset_id = ? AND character_id IS NULL`

// countOrphanAliasesSQL は親プリセットが実在しない preset_aliases 行を数える。
// サービス層が子行を明示削除していることを主張するための検査に使う(指示書 §4.5-3)。
//
// ★M23-10 以前は「PRAGMA foreign_keys が接続プール全体に効かないため CASCADE が
// 発火しない」ことが本検査の前提だった(ボード P-04)。M23-10 で全接続が FK=ON に
// なり CASCADE も発火するようになったが、明示削除は二重の保険として残している。
// ⇒ 孤児が出ないことを見る検査として今も有効である。
const countOrphanAliasesSQL = `
SELECT count(*) FROM preset_aliases pa
WHERE NOT EXISTS (SELECT 1 FROM presets p WHERE p.id = pa.preset_id)`

// listAliasDetailsSQL は編集画面(DES-005 §5.11)向けにキャラ 1 人分のエイリアスを返す。
//
// ref は official_ja_move の同 move のエイリアス(公式技名)。moves に技の表示名カラムは
// 無いため(SUPP-001 §7.3)、numeric / srk のような記法プリセットを編集するときに
// 「どの技の欄か」を人が判別する手掛かりがこれしかない。
const listAliasDetailsSQL = `
SELECT pa.move_id, m.code, m.category, pa.character_id, pa.alias_text, pa.alias_text_en,
       ref.alias_text
FROM preset_aliases pa
JOIN moves m ON m.id = pa.move_id
LEFT JOIN preset_aliases ref
       ON ref.preset_id = (SELECT id FROM presets WHERE code = ?)
      AND ref.move_id = pa.move_id
WHERE pa.preset_id = ? AND pa.character_id = ?
ORDER BY m.category, m.code`

// findCrossingAliasEnSQL は ★DB では守れない交差条件を検査する(D-317)。
//
// 「ある技の alias_text が、同一プリセット・同一キャラの別の技の alias_text_en と
// 一致する」は列を跨ぐ条件であるため UNIQUE では表現できない
// (DES-003 §3.9 の注記。旧 000075 が「★DB では守れないもの」として明文化していたが、
//
//	M33-02 が 9 群へ潰した際に当該ヘッダごと消えた=正本は DES-003 §3.9 と D-317)。
//
// seed 経路は TestRun_HEAD_NoCrossingAliasTextEn(internal/infra/migration)が 0 件を固定しているが、
// ★M20-04 が作った利用者編集の経路にはその検査が無い。
//
// 一致する行があれば、その move_id を返す。
const findCrossingAliasEnSQL = `
SELECT other.move_id
FROM preset_aliases other
JOIN preset_aliases target
  ON target.preset_id = other.preset_id
 AND target.character_id IS other.character_id
WHERE target.preset_id = ? AND target.move_id = ?
  AND other.move_id <> ?
  AND other.alias_text_en IS NOT NULL
  AND other.alias_text_en = ?
LIMIT 1`

// updateAliasTextSQL は ★alias_text のみを更新する。
// character_id は触らない(既存行が既に正しい値を持っており、上書きする理由が無い)。
// alias_text_en も触らない(生成規則が入れる列であり編集対象ではない。DES-004 §5.4)。
const updateAliasTextSQL = `
UPDATE preset_aliases SET alias_text = ? WHERE preset_id = ? AND move_id = ?`

const updatePresetNameSQL = `UPDATE presets SET name = ? WHERE id = ?`

// deleteAliasesByPresetSQL は ★CASCADE に頼らず子行を明示削除する。
// M23-10 以前は CASCADE の発火が接続次第だったため(P-04)、明示削除が唯一の担保だった。
// M23-10 で全接続が FK=ON になった後も、二重の保険として明示削除を残している。
const deleteAliasesByPresetSQL = `DELETE FROM preset_aliases WHERE preset_id = ?`

const deletePresetSQL = `DELETE FROM presets WHERE id = ?`
