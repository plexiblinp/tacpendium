package punish

import (
	"context"
	"fmt"
)

func (r *repository) UpsertStarter(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64, verdict string, note *string) error {
	if _, err := r.db.ExecContext(ctx, upsertStarterSQL, selfCharacterID, opponentMoveID, starterMoveID, verdict, noteArg(note)); err != nil {
		return fmt.Errorf("upsert starter: %w", err)
	}
	return nil
}

func (r *repository) DeleteStarter(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64) error {
	if _, err := r.db.ExecContext(ctx, deleteStarterSQL, selfCharacterID, opponentMoveID, starterMoveID); err != nil {
		return fmt.Errorf("delete starter: %w", err)
	}
	return nil
}

func (r *repository) AddPunish(ctx context.Context, comboID, opponentMoveID int64, note *string) error {
	if _, err := r.db.ExecContext(ctx, addPunishSQL, comboID, opponentMoveID, noteArg(note)); err != nil {
		return fmt.Errorf("add punish: %w", err)
	}
	return nil
}

// RemovePunish はコンボ採用を解除し、同一キーの curation も同一トランザクションで削除する。
//
// curation は「combo_punishes にある組を隠す」指定なので、採用が消えた組に curation だけが
// 残る状態は意味を持たない(孤児・指示書 §4.1)。片方だけ消えるのを防ぐため 2 文を 1 トランザクション
// にまとめ、途中失敗時は両方とも残す。
func (r *repository) RemovePunish(ctx context.Context, comboID, opponentMoveID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin remove punish: %w", err)
	}
	// Commit 済みなら Rollback は no-op(sql.ErrTxDone)。
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, removePunishSQL, comboID, opponentMoveID); err != nil {
		return fmt.Errorf("remove punish: %w", err)
	}
	if _, err := tx.ExecContext(ctx, removeCurationSQL, comboID, opponentMoveID); err != nil {
		return fmt.Errorf("remove curation with punish: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit remove punish: %w", err)
	}
	return nil
}

func (r *repository) AddPruning(ctx context.Context, selfCharacterID, opponentMoveID int64, note *string) error {
	if _, err := r.db.ExecContext(ctx, addPruningSQL, selfCharacterID, opponentMoveID, noteArg(note)); err != nil {
		return fmt.Errorf("add pruning: %w", err)
	}
	return nil
}

func (r *repository) RemovePruning(ctx context.Context, selfCharacterID, opponentMoveID int64) error {
	if _, err := r.db.ExecContext(ctx, removePruningSQL, selfCharacterID, opponentMoveID); err != nil {
		return fmt.Errorf("remove pruning: %w", err)
	}
	return nil
}

func (r *repository) AddCuration(ctx context.Context, comboID, opponentMoveID int64, note *string) error {
	if _, err := r.db.ExecContext(ctx, addCurationSQL, comboID, opponentMoveID, noteArg(note)); err != nil {
		return fmt.Errorf("add curation: %w", err)
	}
	return nil
}

func (r *repository) RemoveCuration(ctx context.Context, comboID, opponentMoveID int64) error {
	if _, err := r.db.ExecContext(ctx, removeCurationSQL, comboID, opponentMoveID); err != nil {
		return fmt.Errorf("remove curation: %w", err)
	}
	return nil
}
