package comboio

import (
	"context"
	"fmt"
)

// codeResolver は character_code↔id・move_code→id を解決し、csvcore.CodeLookup を実装する。
// キャラは構築時に全件プリロードし、技はキャラ単位で遅延ロード+キャッシュする。
//
// CodeLookup は csvcore の検証(VAL-I06/I07)から呼ばれるため、構築は parse 前に行う。
type codeResolver struct {
	ctx          context.Context
	moveRepo     MoveRepo
	charIDByCode map[string]int64
	charCodeByID map[int64]string
	// moveByChar[characterCode] = map[moveCode]moveID。遅延ロード。
	moveByChar map[string]map[string]int64
}

// newCodeResolver はキャラを全件プリロードした resolver を返す。
func newCodeResolver(ctx context.Context, charRepo CharRepo, moveRepo MoveRepo) (*codeResolver, error) {
	gameID, err := charRepo.GameIDByCode(ctx, gameCodeSF6)
	if err != nil {
		return nil, fmt.Errorf("resolve game id: %w", err)
	}
	chars, err := charRepo.ListByGame(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("list characters: %w", err)
	}
	r := &codeResolver{
		ctx:          ctx,
		moveRepo:     moveRepo,
		charIDByCode: make(map[string]int64, len(chars)),
		charCodeByID: make(map[int64]string, len(chars)),
		moveByChar:   make(map[string]map[string]int64),
	}
	for _, c := range chars {
		r.charIDByCode[c.Code] = c.ID
		r.charCodeByID[c.ID] = c.Code
	}
	return r, nil
}

// CharacterExists は VAL-I06 用。
func (r *codeResolver) CharacterExists(code string) bool {
	_, ok := r.charIDByCode[code]
	return ok
}

// MoveExists は VAL-I07 用(該当キャラに move_code が存在するか)。
func (r *codeResolver) MoveExists(characterCode, moveCode string) bool {
	m, err := r.movesFor(characterCode)
	if err != nil {
		return false
	}
	_, ok := m[moveCode]
	return ok
}

// characterID は character_code → id。存在しなければ ok=false。
func (r *codeResolver) characterID(code string) (int64, bool) {
	id, ok := r.charIDByCode[code]
	return id, ok
}

// characterCode は character_id → code(export 用)。
func (r *codeResolver) characterCode(id int64) (string, bool) {
	code, ok := r.charCodeByID[id]
	return code, ok
}

// moveID は (character_code, move_code) → move_id。存在しなければ ok=false。
func (r *codeResolver) moveID(characterCode, moveCode string) (int64, bool) {
	m, err := r.movesFor(characterCode)
	if err != nil {
		return 0, false
	}
	id, ok := m[moveCode]
	return id, ok
}

// movesFor は該当キャラの move_code→id マップを遅延ロード+キャッシュして返す。
func (r *codeResolver) movesFor(characterCode string) (map[string]int64, error) {
	if m, ok := r.moveByChar[characterCode]; ok {
		return m, nil
	}
	charID, ok := r.charIDByCode[characterCode]
	if !ok {
		// 未知キャラ: 空マップをキャッシュして以降の探索を無害化。
		empty := map[string]int64{}
		r.moveByChar[characterCode] = empty
		return empty, nil
	}
	items, err := r.moveRepo.ListByCharacter(r.ctx, charID)
	if err != nil {
		return nil, fmt.Errorf("list moves for character %q: %w", characterCode, err)
	}
	m := make(map[string]int64, len(items))
	for _, it := range items {
		m[it.Code] = it.ID
	}
	r.moveByChar[characterCode] = m
	return m, nil
}
