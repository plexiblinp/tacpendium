package move

// listByCharacterSQL は character_id に紐づく moves を ID 昇順で全件返す。
//
// LEFT JOIN で official_ja_move プリセットの alias_text を取得する。
// 表示名(NameJa)はエイリアスから取り、未登録なら NULL のまま返す。
const listByCharacterSQL = `
SELECT
    m.id,
    m.character_id,
    m.code,
    m.category,
    m.original_move_id,
    m.startup,
    m.active,
    m.total,
    m.on_hit,
    m.on_block,
    m.recovery,
    m.is_aerial,
    m.setup_only,
    m.is_derived,
    pa.alias_text AS name_ja
FROM moves m
LEFT JOIN preset_aliases pa
    ON pa.move_id = m.id
   AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')
WHERE m.character_id = ?
ORDER BY m.id`

// getByIDSQL は指定 id の moves 1 行をフル取得する(M9-03、GET /api/moves/:id)。
// model.Move の列を SELECT し、末尾に表示用 name_ja
// (official_ja_move エイリアス、結合由来)を付与する(CHANGE-032)。
//
// ★M30-04 で is_derived を足した。露出のためではなく、MoveDetail が model.Move を
//
//	埋め込む以上、SELECT しないと常に false が入る静かな罠になるためである
//	(MoveDetailResponse へは出さない＝GET /api/moves/:id の契約は不変)。
const getByIDSQL = `
SELECT
    m.id, m.character_id, m.code, m.category, m.original_move_id,
    m.startup, m.active, m.total, m.on_hit, m.on_block,
    m.damage, m.recovery, m.is_aerial, m.setup_only, m.is_derived, m.raw_data,
    pa.alias_text AS name_ja
FROM moves m
LEFT JOIN preset_aliases pa
    ON pa.move_id = m.id
   AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')
WHERE m.id = ?`
