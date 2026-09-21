// Package game は games テーブル(DES-003 §3.1)のリポジトリである。
//
// ★★本パッケージは M28-02a で初めて作られた。games は 1 行(sf6)のマスタであり、
// それまで読む必要が無かった(character リポジトリの GameIDByCode が id を引くだけだった)。
// FR702 で「現在のデータバージョン」を games へ置いたため、読み出す持ち場が要る。
package game

import (
	"context"
	"database/sql"
	"fmt"
)

// CodeSF6 は本アプリが同梱するゲームの code。games は現状この 1 行のみ。
const CodeSF6 = "sf6"

// Repository は games の読み出しを担う。
type Repository interface {
	// CurrentDataVersion は現在のデータバージョン(`YYYY.MM.DD.NN`)を返す。
	// コンボの基準(combos.baseline_version)へ書く値の出どころである。
	CurrentDataVersion(ctx context.Context, gameCode string) (string, error)
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository { return &repository{db: db} }

const currentDataVersionSQL = `SELECT current_data_version FROM games WHERE code = ?`

func (r *repository) CurrentDataVersion(ctx context.Context, gameCode string) (string, error) {
	var v string
	if err := r.db.QueryRowContext(ctx, currentDataVersionSQL, gameCode).Scan(&v); err != nil {
		return "", fmt.Errorf("current data version (%s): %w", gameCode, err)
	}
	return v, nil
}
