// Package setplay(repository) はセットプレイ自動提案(M19-01)のための moves 読み取りを提供する。
//
// 提案の target 列挙(§4.2)には moves.is_derived が必要である。本リポジトリは提案生成のため
// BE 内で is_derived / is_projectile を参照する。
//
// ★★【2026-09-10 更新・M30-04】is_derived は「model.Move / GET /api/moves に露出していない
// DB 専用列」ではなくなった —— 必殺技ファミリー行の並び順に使うため、リスト DTO へ
// 露出した(model.Move.IsDerived / MoveResponse.isDerived)。
// ⇒ 本リポジトリが専用投影を持つ理由は「API 非露出だから」ではなく、提案生成が必要とする列
// (is_projectile / startup_basis / chain_cancel_total / fastest_unreachable)が
// リスト DTO に無いことである。is_projectile は引き続き API 非露出。
package setplay

import (
	"context"
	"database/sql"
	"fmt"
)

// MoveCandidate は提案生成に必要な moves の 1 行。
// フレーム列(Startup/Active/Total/Damage)は NULL 許容のためポインタ。
type MoveCandidate struct {
	ID             int64
	Code           string
	Category       string
	OriginalMoveID *int64 // rush_variant の元技(通常技/特殊技)を指す。rush 種別の判定に使う
	Startup        *int
	Active         *int
	Total          *int
	Damage         *int
	IsDerived      bool
	IsAerial       bool
	IsProjectile   bool
	SetupOnly      bool

	// StartupBasis は Startup の由来(model.MoveStartupBasis*)。DB では NOT NULL・既定 unknown。
	StartupBasis string
	// ChainCancelTotal はチェーン時の実消費フレーム(実測値)。
	// 非 NULL であること自体がチェーングループ員であることを兼ねる(DES-003 §3.3)。
	ChainCancelTotal *int
	// FastestUnreachable は「単独で最速入力しても地上の相手に当てられない」技(B/C 型)。
	// true = スカラー S の target にできない。
	FastestUnreachable bool
}

// MoveDerivation は move_derivations の 1 行(表記用親の参照)。
type MoveDerivation struct {
	ChildMoveID  int64
	ParentMoveID int64
}

// Repository はセットプレイ提案が参照する moves 読み取りを提供する。
type Repository interface {
	// ListCharacterMoveCandidates は character_id に紐づく moves を提案生成用の列だけ
	// ID 昇順で全件返す。target・filler 双方の母集団となる。
	ListCharacterMoveCandidates(ctx context.Context, characterID int64) ([]MoveCandidate, error)
	// ListCharacterMoveDerivations は character_id に紐づく move の親子関係を返す。
	// 子・親とも同一キャラの moves に限る(親が別キャラの行になることはない)。
	ListCharacterMoveDerivations(ctx context.Context, characterID int64) ([]MoveDerivation, error)
}

type repository struct{ db *sql.DB }

// New は Repository 実装を構築する。
func New(db *sql.DB) Repository { return &repository{db: db} }

// listCandidatesSQL は提案生成に必要な列のみを取得する。
// is_projectile は model.Move / GET /api/moves に露出していない DB 専用列で、
// target 種別フィルタ(category+is_projectile)のため BE 内でのみ参照する
// (§4.2・§2.3 例外の最小適用=API 非露出)。
// ★is_derived は M30-04 でリスト DTO へ露出した(並び順用)。ここで参照するのは派生技除外の
// ためであり、用途が別である —— 露出したことは本 SQL の必要性を変えない。
// M19-05: startup_basis / chain_cancel_total / fastest_unreachable を追加した。
// 契約 F-3(新列のエンジン・API 非露出)は M19-05 で解除され、消費が始まる。
// いずれも GET /api/moves には露出せず、提案生成のため BE 内でのみ参照する。
const listCandidatesSQL = `
SELECT m.id, m.code, m.category, m.original_move_id, m.startup, m.active, m.total, m.damage,
       m.is_derived, m.is_aerial, m.is_projectile, m.setup_only,
       m.startup_basis, m.chain_cancel_total, m.fastest_unreachable
FROM moves m
WHERE m.character_id = ?
ORDER BY m.id`

// listDerivationsSQL は同一キャラの親子関係を返す。子・親の順序を固定して決定論にする
// (表記展開で親が複数のとき move_code 昇順の先頭を採るため、サービス層が並べ替える)。
const listDerivationsSQL = `
SELECT d.child_move_id, d.parent_move_id
FROM move_derivations d
JOIN moves ch ON ch.id = d.child_move_id
WHERE ch.character_id = ?
ORDER BY d.child_move_id, d.parent_move_id`

func (r *repository) ListCharacterMoveCandidates(ctx context.Context, characterID int64) ([]MoveCandidate, error) {
	rows, err := r.db.QueryContext(ctx, listCandidatesSQL, characterID)
	if err != nil {
		return nil, fmt.Errorf("query move candidates: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := []MoveCandidate{}
	for rows.Next() {
		var m MoveCandidate
		if err := rows.Scan(&m.ID, &m.Code, &m.Category, &m.OriginalMoveID, &m.Startup, &m.Active, &m.Total, &m.Damage,
			&m.IsDerived, &m.IsAerial, &m.IsProjectile, &m.SetupOnly,
			&m.StartupBasis, &m.ChainCancelTotal, &m.FastestUnreachable); err != nil {
			return nil, fmt.Errorf("scan move candidate: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate move candidates: %w", err)
	}
	return out, nil
}

func (r *repository) ListCharacterMoveDerivations(ctx context.Context, characterID int64) ([]MoveDerivation, error) {
	rows, err := r.db.QueryContext(ctx, listDerivationsSQL, characterID)
	if err != nil {
		return nil, fmt.Errorf("query move derivations: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := []MoveDerivation{}
	for rows.Next() {
		var d MoveDerivation
		if err := rows.Scan(&d.ChildMoveID, &d.ParentMoveID); err != nil {
			return nil, fmt.Errorf("scan move derivation: %w", err)
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate move derivations: %w", err)
	}
	return out, nil
}
