package combo

import (
	"context"
	"database/sql"
	"errors"
)

// ===========================================================================
// CharacterAdapter: validation.CharacterReader を満たす最小実装
// ===========================================================================
//
// 後続の指示書(M3 タグ、M6 ユーザー)で character リポジトリパッケージが整備される予定。
// M1-03 段階では VAL-C01 のためだけに characters テーブルへの SELECT を行う最小アダプタを
// 本サービス層パッケージに置く。

// CharacterAdapter は validation.CharacterReader を sql.DB ベースで実装する。
type CharacterAdapter struct {
	DB *sql.DB
}

// ExistsByID は characters テーブルに id が存在するか返す。
func (a *CharacterAdapter) ExistsByID(ctx context.Context, id int64) (bool, error) {
	var n int
	err := a.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM characters WHERE id = ?`, id).Scan(&n)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return n > 0, nil
}

// ===========================================================================
// MoveAdapter: validation.MoveReader を満たす最小実装
// ===========================================================================
//
// VAL-C08(技存在確認)と VAL-C12(ラッシュ版元技確認)用。

// MoveAdapter は validation.MoveReader を sql.DB ベースで実装する。
type MoveAdapter struct {
	DB *sql.DB
}

// ExistsForCharacter は (character_id, move_id) のペアが moves テーブルに存在するか返す。
func (a *MoveAdapter) ExistsForCharacter(ctx context.Context, characterID, moveID int64) (bool, error) {
	var n int
	err := a.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM moves WHERE id = ? AND character_id = ?`,
		moveID, characterID).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// FindOriginalMoveID は move_id がラッシュ版なら元技 move_id を、通常技なら nil を返す。
// 存在しない move_id の場合も (nil, nil)。
func (a *MoveAdapter) FindOriginalMoveID(ctx context.Context, moveID int64) (*int64, error) {
	var orig sql.NullInt64
	err := a.DB.QueryRowContext(ctx,
		`SELECT original_move_id FROM moves WHERE id = ?`, moveID).Scan(&orig)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if !orig.Valid {
		return nil, nil
	}
	v := orig.Int64
	return &v, nil
}

// IsRushVariant は move_id が category=rush_variant か判定する。
func (a *MoveAdapter) IsRushVariant(ctx context.Context, moveID int64) (bool, error) {
	var category sql.NullString
	err := a.DB.QueryRowContext(ctx,
		`SELECT category FROM moves WHERE id = ?`, moveID).Scan(&category)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return category.Valid && category.String == "rush_variant", nil
}
