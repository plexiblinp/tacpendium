package punish

import (
	"context"
	"database/sql"
	"fmt"
)

func (r *repository) ListMovesForScan(ctx context.Context, characterID int64) ([]ScanMove, error) {
	rows, err := r.db.QueryContext(ctx, listMovesForScanSQL, characterID)
	if err != nil {
		return nil, fmt.Errorf("list moves for scan: %w", err)
	}
	defer rows.Close()

	items := make([]ScanMove, 0)
	for rows.Next() {
		var (
			m        ScanMove
			startup  sql.NullInt64
			damage   sql.NullInt64
			onBlock  sql.NullInt64
			recovery sql.NullInt64
			total    sql.NullInt64
			firstHit sql.NullInt64
			nameJa   sql.NullString
		)
		if err := rows.Scan(
			&m.ID,
			&m.CharacterID,
			&m.Code,
			&m.Category,
			&startup,
			&damage,
			&onBlock,
			&recovery,
			&total,
			&m.IsProjectile,
			&m.IsAerial,
			&m.StartupBasis,
			&m.IsDerived,
			&firstHit,
			&nameJa,
		); err != nil {
			return nil, fmt.Errorf("scan move: %w", err)
		}
		m.Startup = nullInt64ToIntPtr(startup)
		m.Damage = nullInt64ToIntPtr(damage)
		m.OnBlock = nullInt64ToIntPtr(onBlock)
		m.Recovery = nullInt64ToIntPtr(recovery)
		m.Total = nullInt64ToIntPtr(total)
		m.FirstHitStartup = nullInt64ToIntPtr(firstHit)
		m.NameJa = nullStringToPtr(nameJa)
		items = append(items, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

func (r *repository) GetMovementTotals(ctx context.Context, characterID int64) (MovementTotals, error) {
	rows, err := r.db.QueryContext(ctx, movementTotalsSQL, characterID)
	if err != nil {
		return MovementTotals{}, fmt.Errorf("get movement totals: %w", err)
	}
	defer rows.Close()

	var mt MovementTotals
	for rows.Next() {
		var (
			code  string
			total sql.NullInt64
		)
		if err := rows.Scan(&code, &total); err != nil {
			return MovementTotals{}, fmt.Errorf("scan movement total: %w", err)
		}
		switch code {
		case "dash_forward":
			mt.DashForward = nullInt64ToIntPtr(total)
		case "jump_forward":
			mt.JumpForward = nullInt64ToIntPtr(total)
		}
	}
	if err := rows.Err(); err != nil {
		return MovementTotals{}, fmt.Errorf("rows: %w", err)
	}
	return mt, nil
}

func (r *repository) ListPrunedMoveIDs(ctx context.Context, selfCharacterID int64) (map[int64]bool, error) {
	rows, err := r.db.QueryContext(ctx, listPrunedMoveIDsSQL, selfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list pruned move ids: %w", err)
	}
	defer rows.Close()

	set := make(map[int64]bool)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan pruned id: %w", err)
		}
		set[id] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return set, nil
}

func (r *repository) ListStarterVerdicts(ctx context.Context, selfCharacterID int64) ([]StarterVerdict, error) {
	rows, err := r.db.QueryContext(ctx, listStarterVerdictsSQL, selfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list starter verdicts: %w", err)
	}
	defer rows.Close()

	items := make([]StarterVerdict, 0)
	for rows.Next() {
		var (
			sv   StarterVerdict
			note sql.NullString
		)
		if err := rows.Scan(&sv.OpponentMoveID, &sv.StarterMoveID, &sv.Verdict, &note); err != nil {
			return nil, fmt.Errorf("scan starter verdict: %w", err)
		}
		sv.Note = nullStringToPtr(note)
		items = append(items, sv)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

// ListPunishEntries は採用済み確定反撃を表示用投影で返す(M18-03a)。
//
// hit_type では絞らない。タブ内/タブ外の振り分けはサービス層が本結果 1 回分から行う
// (「どちらのタブにも出ない採用」を数え漏らさないため)。
func (r *repository) ListPunishEntries(ctx context.Context, f PunishEntryFilter) ([]PunishEntry, error) {
	query := listPunishEntriesBaseSQL
	args := []any{f.SelfCharacterID}
	if f.OpponentCharacterID != nil {
		query += opponentCharacterClause
		args = append(args, *f.OpponentCharacterID)
	}
	if f.ExcludeCurated {
		query += excludeCuratedClause
	}
	query += punishEntriesOrderSQL

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list punish entries: %w", err)
	}
	defer rows.Close()

	items := make([]PunishEntry, 0)
	for rows.Next() {
		var (
			e             PunishEntry
			note          sql.NullString
			oppNameJa     sql.NullString
			damage        sql.NullInt64
			hitType       sql.NullString
			starterID     sql.NullInt64
			starterCode   sql.NullString
			starterNameJa sql.NullString
			recipeCache   sql.NullString
			matFromID     sql.NullInt64
		)
		if err := rows.Scan(
			&e.ComboID,
			&e.OpponentMoveID,
			&note,
			&e.OpponentMoveCode,
			&oppNameJa,
			&e.OpponentCharacterID,
			&e.OpponentCharacterNameJa,
			&damage,
			&e.StepCount,
			&hitType,
			&starterID,
			&starterCode,
			&starterNameJa,
			&recipeCache,
			&matFromID,
		); err != nil {
			return nil, fmt.Errorf("scan punish entry: %w", err)
		}
		e.Note = nullStringToPtr(note)
		e.OpponentMoveNameJa = nullStringToPtr(oppNameJa)
		e.Damage = nullInt64ToIntPtr(damage)
		e.HitType = nullStringToPtr(hitType)
		e.StarterMoveID = nullInt64ToPtr(starterID)
		e.StarterMoveCode = nullStringToPtr(starterCode)
		e.StarterMoveNameJa = nullStringToPtr(starterNameJa)
		e.RecipeCache = nullStringToPtr(recipeCache)
		e.MaterializedFromComboID = nullInt64ToPtr(matFromID)
		items = append(items, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

// ListCurations は「使わない反撃」を表示用投影で返す。
func (r *repository) ListCurations(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]CurationEntry, error) {
	query := listCurationsBaseSQL
	args := []any{selfCharacterID}
	if opponentCharacterID != nil {
		query += opponentCharacterClause
		args = append(args, *opponentCharacterID)
	}
	query += curationsOrderSQL

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list curations: %w", err)
	}
	defer rows.Close()

	items := make([]CurationEntry, 0)
	for rows.Next() {
		var (
			e             CurationEntry
			note          sql.NullString
			oppNameJa     sql.NullString
			starterCode   sql.NullString
			starterNameJa sql.NullString
		)
		if err := rows.Scan(
			&e.ComboID,
			&e.OpponentMoveID,
			&note,
			&e.OpponentMoveCode,
			&oppNameJa,
			&e.OpponentCharacterID,
			&e.OpponentCharacterNameJa,
			&starterCode,
			&starterNameJa,
		); err != nil {
			return nil, fmt.Errorf("scan curation: %w", err)
		}
		e.Note = nullStringToPtr(note)
		e.OpponentMoveNameJa = nullStringToPtr(oppNameJa)
		e.StarterMoveCode = nullStringToPtr(starterCode)
		e.StarterMoveNameJa = nullStringToPtr(starterNameJa)
		items = append(items, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

// ListPrunings は「確定反撃のない技」を表示用投影で返す。
func (r *repository) ListPrunings(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]PruningEntry, error) {
	query := listPruningsBaseSQL
	args := []any{selfCharacterID}
	if opponentCharacterID != nil {
		query += opponentCharacterClause
		args = append(args, *opponentCharacterID)
	}
	query += pruningsOrderSQL

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list prunings: %w", err)
	}
	defer rows.Close()

	items := make([]PruningEntry, 0)
	for rows.Next() {
		var (
			e         PruningEntry
			note      sql.NullString
			oppNameJa sql.NullString
		)
		if err := rows.Scan(
			&e.OpponentMoveID,
			&note,
			&e.OpponentMoveCode,
			&oppNameJa,
			&e.OpponentCharacterID,
			&e.OpponentCharacterNameJa,
		); err != nil {
			return nil, fmt.Errorf("scan pruning: %w", err)
		}
		e.Note = nullStringToPtr(note)
		e.OpponentMoveNameJa = nullStringToPtr(oppNameJa)
		items = append(items, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

func (r *repository) ListAdoptedComboPunishes(ctx context.Context, selfCharacterID int64) ([]ComboPunishKey, error) {
	rows, err := r.db.QueryContext(ctx, listAdoptedComboPunishesSQL, selfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list adopted combo punishes: %w", err)
	}
	defer rows.Close()

	items := make([]ComboPunishKey, 0)
	for rows.Next() {
		var k ComboPunishKey
		if err := rows.Scan(&k.ComboID, &k.OpponentMoveID); err != nil {
			return nil, fmt.Errorf("scan combo punish key: %w", err)
		}
		items = append(items, k)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

func (r *repository) ListMaterializedBaseComboIDs(ctx context.Context, selfCharacterID int64) (map[int64]bool, error) {
	rows, err := r.db.QueryContext(ctx, listMaterializedBaseComboIDsSQL, selfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list materialized base combo ids: %w", err)
	}
	defer rows.Close()

	set := make(map[int64]bool)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan materialized base combo id: %w", err)
		}
		set[id] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return set, nil
}
