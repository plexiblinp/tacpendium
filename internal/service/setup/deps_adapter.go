package setup

import (
	"context"
	"database/sql"

	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
)

// ===========================================================================
// SetupDuplicateAdapter: VAL-S04 の判定を書き込み tx の内側で行うためのアダプタ
// ===========================================================================
//
// ★★M24-13 §4.6 / CHANGE-139。M24-11 が VAL-C02 に対して採った形
// (combo.ComboDuplicateAdapter)をそのまま踏襲している。★2 つ目の形を作らない。
//
// ★★なぜアダプタが tx を握るのか————————————————————————————————
// ValidationDeps はインタフェースだけで組まれた DB 非依存の集合である。判定の
// トランザクション境界のためにその層を database/sql へ結び付けるのは代償が大きい。
// ⇒ tx はアダプタ側が握り、SetupDuplicateChecker の署名は変えない。
//
// ★nil のまま使う経路が正当に在る: 保存前チェック(POST /api/setups/check-duplicate)は
// 何も書かないためトランザクションを開かない。
type SetupDuplicateAdapter struct {
	Repo setuprepo.Repository

	// Tx は判定を行うトランザクション。nil なら *sql.DB 直読み。
	Tx *sql.Tx
}

// WithTx は tx を束ねた複製を返す。元のアダプタは変更しない。
func (a *SetupDuplicateAdapter) WithTx(tx *sql.Tx) *SetupDuplicateAdapter {
	return &SetupDuplicateAdapter{Repo: a.Repo, Tx: tx}
}

// FindDuplicateInCombo は VAL-S04 の重複判定を、束ねた tx の内側で行う。
//
// ★★束ねた tx を「読みにも使う」ことが要である(D-360)。受け取るだけで使わなければ
// 未コミットの行が見えず、判定を内側へ移した意味が無い。
func (a *SetupDuplicateAdapter) FindDuplicateInCombo(
	ctx context.Context,
	comboID int64,
	characterID int64,
	recipeHash string,
	excludeSetupID *int64,
) (*int64, error) {
	return a.Repo.FindDuplicateInComboTx(ctx, a.Tx, comboID, characterID, recipeHash, excludeSetupID)
}
