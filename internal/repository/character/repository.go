// Package character はキャラクターマスタへの読み取り専用アクセスを提供する。
package character

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

const listByGameSQL = `SELECT id, game_id, code, name_ja, name_en, custom_states
FROM characters
WHERE game_id = ?
ORDER BY id`

// Repository はキャラクターマスタのデータアクセスインタフェース。
//
// ListByGame は読み取り(GET /api/characters 等)で使用する。
// GameIDByCode / UpsertByCode は M9-02 の CSV 取込で使用する。
type Repository interface {
	// ListByGame は指定ゲームの全キャラクターを ID 昇順で返す。
	ListByGame(ctx context.Context, gameID int64) ([]model.Character, error)

	// GameIDByCode は games.code から id を解決する(取込時のキャラ upsert 用、M9-02)。
	// 見つからない場合は sql.ErrNoRows を wrap して返す。
	GameIDByCode(ctx context.Context, code string) (int64, error)

	// UpsertByCode は (game_id, code) でキャラクターを upsert し、その id を返す(M9-02、§4.6)。
	// 既存行(seed 投入済み)があれば表示名を上書きせず id のみ返す。CSV には表示名が無いため、
	// 新規作成時のみ name_ja / name_en に code を暫定値として入れる(後続マイルストーンで補正)。tx 必須。
	UpsertByCode(ctx context.Context, tx *sql.Tx, gameID int64, code string) (int64, error)
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListByGame(ctx context.Context, gameID int64) ([]model.Character, error) {
	rows, err := r.db.QueryContext(ctx, listByGameSQL, gameID)
	if err != nil {
		return nil, fmt.Errorf("list characters by game: %w", err)
	}
	defer rows.Close()

	items := make([]model.Character, 0)
	for rows.Next() {
		var (
			ch           model.Character
			customStates sql.NullString
		)
		if err := rows.Scan(
			&ch.ID,
			&ch.GameID,
			&ch.Code,
			&ch.NameJa,
			&ch.NameEn,
			&customStates,
		); err != nil {
			return nil, fmt.Errorf("scan character: %w", err)
		}
		if customStates.Valid {
			ch.CustomStates = &customStates.String
		}
		items = append(items, ch)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}
