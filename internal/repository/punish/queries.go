package punish

// officialJaPresetSubquery は技名(name_ja)解決に使う official_ja_move プリセットの id。
// listMovesForScanSQL が採っている解決経路を M18-03a の各クエリでも使い回す
// (名前解決を二度実装しない＝指示書 §3.3-6)。
const officialJaPresetSubquery = `(SELECT id FROM presets WHERE code = 'official_ja_move')`

// listMovesForScanSQL は走査に必要な moves 列を投影する(相手技/自技共通)。
// name_ja は official_ja_move プリセットの alias_text を LEFT JOIN で取得する(未登録は NULL)。
//
// ★M37-04(B06): startup_basis / is_derived / first_hit_startup を足した。
//
//	理由は「startup が初段の値とは限らない行」をサービス層が見分けられないことである ——
//	category='target_combo' ∧ is_derived ∧ startup_basis='standalone' の 106 行は、
//	格納されている startup が*その段*の発生であって初段の発生ではない
//	(★M39-01 で 110 -> 106。D-187 の是正でフレームを持たない空中限定 4 行が unknown へ移った)
//	(実例: ryu fuwa_triple_strike_2hits は startup=5 だが初段の立中P は 6F)。
//	★M37-RESEARCH-01 §4.2 が「現投影に情報が足りない」と実測していた——本投影は
//	category しか持たず、is_derived も startup_basis も流れていなかった。
const listMovesForScanSQL = `
SELECT
    m.id,
    m.character_id,
    m.code,
    m.category,
    m.startup,
    m.damage,
    m.on_block,
    m.recovery,
    m.total,
    m.is_projectile,
    m.is_aerial,
    m.startup_basis,
    m.is_derived,
    m.first_hit_startup,
    pa.alias_text AS name_ja
FROM moves m
LEFT JOIN preset_aliases pa
    ON pa.move_id = m.id
   AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')
WHERE m.character_id = ?
ORDER BY m.id`

// movementTotalsSQL は自キャラの dash_forward / jump_forward の total を取得する。
const movementTotalsSQL = `
SELECT code, total
FROM moves
WHERE character_id = ?
  AND code IN ('dash_forward', 'jump_forward')`

// listPrunedMoveIDsSQL は自キャラで pruning 済みの相手技 id を返す。
const listPrunedMoveIDsSQL = `
SELECT opponent_move_id
FROM combo_punish_prunings
WHERE self_character_id = ?`

// listStarterVerdictsSQL は自キャラの始動技検証結果を返す。
const listStarterVerdictsSQL = `
SELECT opponent_move_id, starter_move_id, verdict, note
FROM combo_punish_starters
WHERE self_character_id = ?`

// listAdoptedComboPunishesSQL は自キャラのコンボに紐づく採用済み確定反撃(combo, 相手技)を返す。
//
// ★M23-03 §4.3: c.deleted_at IS NULL は同ファイルの listPunishEntriesBaseSQL と揃えるために
// 足してある(同じ combo_punishes を引きながら片方だけ述語を持つ非対称の解消)。
// ★2026-08-22 時点では実挙動は変わらない——このときの唯一の呼び元
// (service/punishfinder.Scan)は、combos リポジトリの List(既定で deleted_at IS NULL)で
// 並べた生存コンボにしか本結果を引かないため、削除済みの組は元から応答に出ていない。
// ⇒ 塞ぐ理由は「別の経路の絞り込みに守られているだけ」の状態をやめることである。
// ★呼び元を足すときは、この前提がまだ成り立つかを数え直すこと。
// 成り立たなくなった時点で、本述語が初めて実挙動として効く。
const listAdoptedComboPunishesSQL = `
SELECT cp.combo_id, cp.opponent_move_id
FROM combo_punishes cp
JOIN combos c ON c.id = cp.combo_id
WHERE c.character_id = ?
  AND c.deleted_at IS NULL`

// listMaterializedBaseComboIDsSQL は、自キャラの基底コンボを参照する有効な materialize
// 生成物があれば、その基底 id を返す。FR301 の重複キーに相手技が無いため
// opponent_move_id は関与せず、仮登録の生成物も「作成済み」とみなすため is_draft では絞らない。
//
// ★M23-03 §4.4: 基底(base)・生成物(child)の両側の論理削除済みを除外する。
// 以前は child 側だけに述語があった。2026-08-22 時点では実挙動は変わらない——
// このときの唯一の呼び元(service/punishfinder.Scan)は、この集合を生存コンボにしか
// 引かないため、削除済みの基底 id は過剰包含であって結果には出ていなかった。
// 揃えてあるほうが後で読みやすいため一律に除外する(開発者の指示)。
// ★呼び元を足すときは、この前提がまだ成り立つかを数え直すこと。
const listMaterializedBaseComboIDsSQL = `
SELECT DISTINCT child.materialized_from_combo_id
FROM combos child
JOIN combos base ON base.id = child.materialized_from_combo_id
WHERE base.character_id = ?
  AND base.deleted_at IS NULL
  AND child.deleted_at IS NULL`

// upsertStarterSQL は始動技検証結果を登録/更新する(UNIQUE 衝突時は verdict/note を更新)。
const upsertStarterSQL = `
INSERT INTO combo_punish_starters (self_character_id, opponent_move_id, starter_move_id, verdict, note)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT (self_character_id, opponent_move_id, starter_move_id)
DO UPDATE SET verdict = excluded.verdict, note = excluded.note, updated_at = datetime('now')`

const deleteStarterSQL = `
DELETE FROM combo_punish_starters
WHERE self_character_id = ? AND opponent_move_id = ? AND starter_move_id = ?`

// addPunishSQL はコンボ採用(keep)を登録/更新する(UNIQUE 衝突時は note を更新)。
const addPunishSQL = `
INSERT INTO combo_punishes (combo_id, opponent_move_id, note)
VALUES (?, ?, ?)
ON CONFLICT (combo_id, opponent_move_id)
DO UPDATE SET note = excluded.note, updated_at = datetime('now')`

const removePunishSQL = `
DELETE FROM combo_punishes WHERE combo_id = ? AND opponent_move_id = ?`

// addPruningSQL は相手技の pruning を登録/更新する(UNIQUE 衝突時は note を更新)。
const addPruningSQL = `
INSERT INTO combo_punish_prunings (self_character_id, opponent_move_id, note)
VALUES (?, ?, ?)
ON CONFLICT (self_character_id, opponent_move_id)
DO UPDATE SET note = excluded.note, updated_at = datetime('now')`

const removePruningSQL = `
DELETE FROM combo_punish_prunings WHERE self_character_id = ? AND opponent_move_id = ?`

// ---------------------------------------------------------------------------
// M18-03a: 確定反撃マイリスト(使う画面)と隠したもの管理の取得系。
//
// いずれも走査(フレーム判定・レーン判定)を伴わない「保存済みの事実の取得」であり、
// 相手技・始動技の技名は officialJaPresetSubquery 経由で解決する。
// ---------------------------------------------------------------------------

// listPunishEntriesBaseSQL は採用済み確定反撃を表示用投影で返す(マイリストの母集合)。
//
// 段 1(自キャラ絞り)と段 2(論理削除除外)を本 SQL に固定し、段 3(hit_type タブ絞り)は
// サービス層に委ねる。相手キャラ絞り(任意)と curation 除外は呼び出し側で句を足す。
const listPunishEntriesBaseSQL = `
SELECT
    cp.combo_id,
    cp.opponent_move_id,
    cp.note,
    om.code,
    opa.alias_text,
    oc.id,
    oc.name_ja,
    c.damage,
    c.step_count,
    c.hit_type,
    c.starter_move_id,
    sm.code,
    spa.alias_text,
    c.recipe_cache,
    c.materialized_from_combo_id
FROM combo_punishes cp
JOIN combos c ON c.id = cp.combo_id
JOIN moves om ON om.id = cp.opponent_move_id
JOIN characters oc ON oc.id = om.character_id
LEFT JOIN preset_aliases opa
    ON opa.move_id = om.id AND opa.preset_id = ` + officialJaPresetSubquery + `
LEFT JOIN moves sm ON sm.id = c.starter_move_id
LEFT JOIN preset_aliases spa
    ON spa.move_id = sm.id AND spa.preset_id = ` + officialJaPresetSubquery + `
WHERE c.character_id = ?
  AND c.deleted_at IS NULL`

// opponentCharacterClause は相手キャラでの任意絞り込み(相手キャラ id は
// opponent_move_id → moves.character_id で導出する＝明示列を持たない設計)。
const opponentCharacterClause = `
  AND om.character_id = ?`

// excludeCuratedClause は「使わない反撃」に指定済みの組をマイリストから外す(表示制御)。
const excludeCuratedClause = `
  AND NOT EXISTS (
      SELECT 1 FROM combo_punish_curations cc
      WHERE cc.combo_id = cp.combo_id
        AND cc.opponent_move_id = cp.opponent_move_id
  )`

// punishEntriesOrderSQL は相手キャラ → 相手技 → コンボの安定順。
const punishEntriesOrderSQL = `
ORDER BY oc.id, om.id, c.id`

// listCurationsBaseSQL は「使わない反撃」を表示用投影で返す(隠したもの管理)。
// 論理削除済みコンボに紐づく行は出さない(マイリスト本体と同じ扱いに揃える)。
const listCurationsBaseSQL = `
SELECT
    cc.combo_id,
    cc.opponent_move_id,
    cc.note,
    om.code,
    opa.alias_text,
    oc.id,
    oc.name_ja,
    sm.code,
    spa.alias_text
FROM combo_punish_curations cc
JOIN combos c ON c.id = cc.combo_id
JOIN moves om ON om.id = cc.opponent_move_id
JOIN characters oc ON oc.id = om.character_id
LEFT JOIN preset_aliases opa
    ON opa.move_id = om.id AND opa.preset_id = ` + officialJaPresetSubquery + `
LEFT JOIN moves sm ON sm.id = c.starter_move_id
LEFT JOIN preset_aliases spa
    ON spa.move_id = sm.id AND spa.preset_id = ` + officialJaPresetSubquery + `
WHERE c.character_id = ?
  AND c.deleted_at IS NULL`

const curationsOrderSQL = `
ORDER BY oc.id, om.id, cc.combo_id`

// listPruningsBaseSQL は「確定反撃のない技」を表示用投影で返す(隠したもの管理)。
// pruning はコンボ非依存(自キャラ × 相手技)のため combos を JOIN しない。
const listPruningsBaseSQL = `
SELECT
    cpp.opponent_move_id,
    cpp.note,
    om.code,
    opa.alias_text,
    oc.id,
    oc.name_ja
FROM combo_punish_prunings cpp
JOIN moves om ON om.id = cpp.opponent_move_id
JOIN characters oc ON oc.id = om.character_id
LEFT JOIN preset_aliases opa
    ON opa.move_id = om.id AND opa.preset_id = ` + officialJaPresetSubquery + `
WHERE cpp.self_character_id = ?`

const pruningsOrderSQL = `
ORDER BY oc.id, om.id`

// addCurationSQL は「使わない反撃」を登録/更新する(UNIQUE 衝突時は note を更新)。
// 重複時の返し方を pruning / starters と揃える(二重登録が行を増やさない)。
const addCurationSQL = `
INSERT INTO combo_punish_curations (combo_id, opponent_move_id, note)
VALUES (?, ?, ?)
ON CONFLICT (combo_id, opponent_move_id)
DO UPDATE SET note = excluded.note, updated_at = datetime('now')`

// removeCurationSQL は curation を UNIQUE キーで解除する(サロゲート id は使わない)。
// 採用解除時の連動削除(RemovePunish)でも同一の SQL を使う。
const removeCurationSQL = `
DELETE FROM combo_punish_curations WHERE combo_id = ? AND opponent_move_id = ?`
