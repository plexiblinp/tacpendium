package setup

// combo_setup_results(セットプレイ成立条件の検証結果)の DB アクセス(M19-03 / CHANGE-087)。
//
// 帰属先は「コンボ × セットプレイの組」= combo_setups の組。本表は setup ドメインが
// combo_setups を所有しているため、同ドメイン配下に置く(新パッケージを作らない)。
//
// 三値の表現(§4.1.3):
//   - 行が無い          = 未検証
//   - 行があり result=ok = 成立
//   - 行があり result=ng = 不成立
//
// したがって「未検証へ戻す」は DeleteSetupResult(物理削除)であり、result に NULL や
// 「未検証」を意味する値を入れる経路は本ファイルに存在しない。

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

const listSetupResultsByComboIDSQL = `
SELECT setup_id, tech_type, in_corner, result, note
FROM combo_setup_results
WHERE combo_id = ?
ORDER BY setup_id, tech_type, in_corner`

// ListSetupResultsByComboID は 1 コンボに紐づく全セットプレイ分の検証結果を
// 1 クエリで返す(コンボ詳細で N+1 にしないため。§4.3.1 / §5.1-9)。
//
// 論理削除されたコンボの結果行は、そもそも呼び出し側が combo_setups 経由の
// セットプレイ一覧としか突き合わせないため表に出ない(§3.3-3)。
func (r *repository) ListSetupResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error) {
	rows, err := r.db.QueryContext(ctx, listSetupResultsByComboIDSQL, comboID)
	if err != nil {
		return nil, fmt.Errorf("list setup results by combo: %w", err)
	}
	defer rows.Close()

	results := make([]model.ComboSetupResult, 0)
	for rows.Next() {
		res := model.ComboSetupResult{ComboID: comboID}
		if err := rows.Scan(&res.SetupID, &res.TechType, &res.InCorner, &res.Result, &res.Note); err != nil {
			return nil, fmt.Errorf("scan setup result: %w", err)
		}
		results = append(results, res)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate setup results: %w", err)
	}
	return results, nil
}

const upsertSetupResultSQL = `
INSERT INTO combo_setup_results (combo_id, setup_id, tech_type, in_corner, result, note)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (combo_id, setup_id, tech_type, in_corner)
DO UPDATE SET result = excluded.result, note = excluded.note`

// UpsertSetupResult は 1 セル分の検証結果を作成または更新する(§4.3.2)。
// 同一キーへの 2 回目の書き込みは行を増やさず更新になる(PK による ON CONFLICT)。
func (r *repository) UpsertSetupResult(ctx context.Context, tx *sql.Tx, res model.ComboSetupResult) error {
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx, upsertSetupResultSQL,
		res.ComboID, res.SetupID, res.TechType, res.InCorner, res.Result, res.Note,
	); err != nil {
		return fmt.Errorf("upsert setup result: %w", err)
	}
	return nil
}

const deleteSetupResultSQL = `
DELETE FROM combo_setup_results
WHERE combo_id = ? AND setup_id = ? AND tech_type = ? AND in_corner = ?`

// DeleteSetupResult は 1 セル分の検証結果を物理削除する = 「未検証へ戻す」(§4.1.3)。
// 対象行が無くてもエラーにしない(既に未検証なら冪等)。
func (r *repository) DeleteSetupResult(ctx context.Context, tx *sql.Tx, comboID, setupID int64, techType string, inCorner bool) error {
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx, deleteSetupResultSQL, comboID, setupID, techType, inCorner); err != nil {
		return fmt.Errorf("delete setup result: %w", err)
	}
	return nil
}

// InsertSetupResultsTx は複数セル分の検証結果をまとめて書く(提案の採用時＝§4.5)。
// 呼び出し側は combo_setups を作った後・同一トランザクション内で呼ぶこと
// (紐付けが無い状態で書くと複合 FK が成立しない)。
func (r *repository) InsertSetupResultsTx(ctx context.Context, tx *sql.Tx, results []model.ComboSetupResult) error {
	for _, res := range results {
		if err := r.UpsertSetupResult(ctx, tx, res); err != nil {
			return err
		}
	}
	return nil
}
