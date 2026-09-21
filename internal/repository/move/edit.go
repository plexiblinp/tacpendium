package move

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

// GetByID は指定 id の move 1 行をフル取得する(M9-03)。存在しない場合は ErrNotFound。
func (r *repository) GetByID(ctx context.Context, id int64) (*MoveDetail, error) {
	row := r.db.QueryRowContext(ctx, getByIDSQL, id)
	d, err := scanMoveDetail(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get move by id (%d): %w", id, err)
	}
	return d, nil
}

// rowScanner は *sql.Row / *sql.Rows の Scan を抽象化する(GetByID と tx 内取得の共用)。
type rowScanner interface {
	Scan(dest ...any) error
}

// scanMoveDetail は getByIDSQL の列順で 1 行を MoveDetail(model.Move + NameJa)へスキャンする。
func scanMoveDetail(s rowScanner) (*MoveDetail, error) {
	var (
		d        MoveDetail
		origID   sql.NullInt64
		startup  sql.NullInt64
		active   sql.NullInt64
		total    sql.NullInt64
		onHit    sql.NullInt64
		onBlock  sql.NullInt64
		damage   sql.NullInt64
		recovery sql.NullInt64
		rawData  sql.NullString
		nameJa   sql.NullString
	)
	if err := s.Scan(
		&d.ID, &d.CharacterID, &d.Code, &d.Category, &origID,
		&startup, &active, &total, &onHit, &onBlock,
		&damage, &recovery, &d.IsAerial, &d.SetupOnly, &d.IsDerived, &rawData,
		&nameJa,
	); err != nil {
		return nil, err
	}
	if origID.Valid {
		v := origID.Int64
		d.OriginalMoveID = &v
	}
	d.Startup = nullInt64ToIntPtr(startup)
	d.Active = nullInt64ToIntPtr(active)
	d.Total = nullInt64ToIntPtr(total)
	d.OnHit = nullInt64ToIntPtr(onHit)
	d.OnBlock = nullInt64ToIntPtr(onBlock)
	d.Damage = nullInt64ToIntPtr(damage)
	d.Recovery = nullInt64ToIntPtr(recovery)
	d.RawData = nullStringToPtr(rawData)
	d.NameJa = nullStringToPtr(nameJa)
	return &d, nil
}

// nullStringToPtr は sql.NullString を *string へ変換する。NULL なら nil。
func nullStringToPtr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	v := n.String
	return &v
}

// UpdateFields は指定 id の move を部分更新する(M9-03)。nil フィールドは更新しない。
// COALESCE は使わず、明示的に指定された列のみ UPDATE する(combo.UpdateMetadata と同方式)。
func (r *repository) UpdateFields(ctx context.Context, id int64, f UpdateMoveFields) error {
	var (
		setParts []string
		args     []any
	)
	add := func(col string, val any) {
		setParts = append(setParts, col+" = ?")
		args = append(args, val)
	}
	if f.Total != nil {
		add("total", *f.Total)
	}
	if f.Startup != nil {
		add("startup", *f.Startup)
	}
	if f.Active != nil {
		add("active", *f.Active)
	}
	if f.OnHit != nil {
		add("on_hit", *f.OnHit)
	}
	if f.OnBlock != nil {
		add("on_block", *f.OnBlock)
	}
	if f.Damage != nil {
		add("damage", *f.Damage)
	}
	if f.Recovery != nil {
		add("recovery", *f.Recovery)
	}
	if f.IsAerial != nil {
		add("is_aerial", *f.IsAerial)
	}
	if f.RawData != nil {
		add("raw_data", *f.RawData)
	}

	if len(setParts) == 0 {
		// 更新フィールドが無い場合は存在確認のみ行い、ErrNotFound を識別する。
		var exists int
		if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM moves WHERE id = ?", id).Scan(&exists); err != nil {
			return fmt.Errorf("update move exists check: %w", err)
		}
		if exists == 0 {
			return ErrNotFound
		}
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE moves SET %s WHERE id = ?", strings.Join(setParts, ", "))
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update move fields (%d): %w", id, err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
