package character

import (
	"context"
	"database/sql"
	"fmt"
)

const gameIDByCodeSQL = `SELECT id FROM games WHERE code = ?`

// GameIDByCode は games.code から id を解決する。
func (r *repository) GameIDByCode(ctx context.Context, code string) (int64, error) {
	var id int64
	if err := r.db.QueryRowContext(ctx, gameIDByCodeSQL, code).Scan(&id); err != nil {
		return 0, fmt.Errorf("game id by code (%s): %w", code, err)
	}
	return id, nil
}

// upsertCharacterSQL は (game_id, code) で衝突した場合は何もしない(seed の表示名を保持する)。
// 新規作成時のみ name_ja / name_en に code を暫定値として入れる(CSV に表示名が無いため)。
const upsertCharacterSQL = `
INSERT INTO characters (game_id, code, name_ja, name_en)
VALUES (?, ?, ?, ?)
ON CONFLICT(game_id, code) DO NOTHING`

const characterIDByCodeSQL = `SELECT id FROM characters WHERE game_id = ? AND code = ?`

// UpsertByCode は (game_id, code) でキャラクターを upsert し id を返す。
// DO NOTHING のため RETURNING は衝突時に行を返さない。確実に id を得るため、
// upsert 後に (game_id, code) で再 SELECT する。
func (r *repository) UpsertByCode(ctx context.Context, tx *sql.Tx, gameID int64, code string) (int64, error) {
	if tx == nil {
		return 0, fmt.Errorf("upsert character: tx is required")
	}
	// 推測: CSV に表示名が無いため、新規作成時の暫定表示名は code をそのまま用いる
	// (seed 済みキャラは 000003_data_seed_characters で正規名が入る。未 seed の code はここで暫定作成)。
	if _, err := tx.ExecContext(ctx, upsertCharacterSQL, gameID, code, code, code); err != nil {
		return 0, fmt.Errorf("upsert character (%s): %w", code, err)
	}
	var id int64
	if err := tx.QueryRowContext(ctx, characterIDByCodeSQL, gameID, code).Scan(&id); err != nil {
		return 0, fmt.Errorf("character id by code (%s): %w", code, err)
	}
	return id, nil
}
