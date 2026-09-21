// Package movecommand は command 索引テーブル move_commands のリポジトリ層である(M17-02 G-k)。
//
// 索引の物理実体(move_commands)は seed マイグレ(000005_data_seed_move_commands)が投入し、
// 本パッケージは読取のみを提供する
// (本体は索引を書かない=index-only・CHANGE-069 §2.1-b)。消費者は段階2 解決サービス(inputresolve)と
// M17-04 他から引っ越し(LoadIndex 経由で moveindex IF を引く)。
package movecommand

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/moveindex"
)

// Row は move_commands ⨝ moves の 1 候補(段階2 解決表の畳み込み入力)。
// Category/IsAerial は畳み込み(特殊技優先・空中除外)の判定に、MoveID はタイブレークに使う。
type Row struct {
	MoveID   int64
	MoveCode string
	TokenKey string // 正規化済み索引キー(numpad 形。internal/moveindex が正規化を一元管理)
	Category string
	IsAerial bool
}

// Repository は move_commands の読取 IF。
type Repository interface {
	// ListByCharacter は 1 キャラ分の索引候補を moves 属性付きで返す(move_id 昇順=タイブレーク安定)。
	// 未 seed キャラ・存在しないキャラは空を返す(エラーにしない=段階1 のみが動く・壊れない)。
	ListByCharacter(ctx context.Context, characterID int64) ([]Row, error)
	// LoadIndex は move_commands 全体から moveindex.Index を再構築する
	// (M14-03b IF の本体ランタイム消費=M17-02 §2.3。charKey はキャラ code、id は moves.id)。
	LoadIndex(ctx context.Context) (*moveindex.Index, error)
}

type repository struct {
	db *sql.DB
}

// New はリポジトリを構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

// ListByCharacter は Repository.ListByCharacter を実装する。
func (r *repository) ListByCharacter(ctx context.Context, characterID int64) ([]Row, error) {
	const q = `
SELECT mc.move_id, m.code, mc.token_key, m.category, m.is_aerial
FROM move_commands mc
JOIN moves m ON m.id = mc.move_id
WHERE mc.character_id = ?
ORDER BY mc.move_id, mc.token_key`
	rows, err := r.db.QueryContext(ctx, q, characterID)
	if err != nil {
		return nil, fmt.Errorf("query move_commands by character %d: %w", characterID, err)
	}
	defer rows.Close()

	var out []Row
	for rows.Next() {
		var row Row
		if err := rows.Scan(&row.MoveID, &row.MoveCode, &row.TokenKey, &row.Category, &row.IsAerial); err != nil {
			return nil, fmt.Errorf("scan move_commands row: %w", err)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate move_commands rows: %w", err)
	}
	return out, nil
}

// LoadIndex は Repository.LoadIndex を実装する。
// token_key は seed 時に正規化済みのため AddIndexed(skip 判定・再正規化なし)で投入する
// (Lookup 側のクエリ正規化は語彙外断片を verbatim 通過するため、正準トークン列・numpad 形の
// どちらのクエリでも同じキーへ畳まれる)。
func (r *repository) LoadIndex(ctx context.Context) (*moveindex.Index, error) {
	const q = `
SELECT c.code, m.code, mc.token_key, mc.move_id
FROM move_commands mc
JOIN moves m ON m.id = mc.move_id
JOIN characters c ON c.id = mc.character_id
ORDER BY mc.character_id, mc.move_id, mc.token_key`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query move_commands for index: %w", err)
	}
	defer rows.Close()

	ix := moveindex.New()
	for rows.Next() {
		var charKey, moveCode, tokenKey string
		var moveID int64
		if err := rows.Scan(&charKey, &moveCode, &tokenKey, &moveID); err != nil {
			return nil, fmt.Errorf("scan move_commands index row: %w", err)
		}
		ix.AddIndexed(charKey, moveCode, tokenKey, int(moveID))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate move_commands index rows: %w", err)
	}
	return ix, nil
}
