//go:build debug

package debug

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/gameversion"
	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	gamerepo "github.com/plexiblinp/tacpendium/internal/repository/game"
)

// ★★本ファイルが在る理由(M28-02c) ————————————————————————————————
//
// FR702 の判定は moves.last_changed_game_version が非 NULL であることを要求するが、
// マーカーを立てる経路は **DML マイグレしか無い**(cmd/seedgen -mode game-version)。
// HTTP には読み書きどちらの口も無く、PATCH /api/moves/{id} も対象外である。
//
// ⇒ E2E から「影響コンボが 1 件以上ある状態」を作れない。
//   ★★しかも初回は必ず 0 件である(D-725 により既存コンボの基準は最新)。
//     「画面を開いても何も出ない」ので、動かして確認したことが証拠にならない。
//
// ★本エンドポイントは **debug ビルドにしか存在しない**。本番バイナリには 1 バイトも
//   出ない(routes_noop.go 側は不変であり、本ファイルは //go:build debug 配下)。
// ★E2E は web/playwright.config.ts が go run -tags=debug で起動する。
//   代償は「E2E が本番ビルドではなく debug ビルドを検査すること」であり、
//   差分は debug ルートの登録だけである(2026-09-07 開発者確定)。

// setMoveGameVersionRequest は POST /api/debug/moves/:id/game-version の要求。
type setMoveGameVersionRequest struct {
	// LastChangedGameVersion は立てるマーカー。空文字は NULL へ戻す。
	LastChangedGameVersion string `json:"lastChangedGameVersion"`
}

// SetMoveGameVersion は技のマーカーを立てる(配信者の DML マイグレを模す)。
//
// POST /api/debug/moves/:id/game-version
// 本文: {"lastChangedGameVersion": "2026.09.10.01"}  ("" なら NULL へ戻す)
//
// ★書式は gameversion.Validate を通す —— ゼロ埋めが崩れた値を入れると辞書順が
// 静かに壊れる。DB 側の CHECK 制約も同じ書式を見ているので、通さないと 500 になる。
func (h *Handler) SetMoveGameVersion(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid move id")
	}
	var req setMoveGameVersionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	ctx := c.Request().Context()
	if req.LastChangedGameVersion == "" {
		if _, err := h.db.ExecContext(ctx,
			`UPDATE moves SET last_changed_game_version = NULL WHERE id = ?`, id); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		return c.NoContent(http.StatusNoContent)
	}
	if err := gameversion.Validate(req.LastChangedGameVersion); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	res, err := h.db.ExecContext(ctx,
		`UPDATE moves SET last_changed_game_version = ? WHERE id = ?`,
		req.LastChangedGameVersion, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "move not found")
	}
	return c.NoContent(http.StatusNoContent)
}

// setComboBaselineRequest は POST /api/debug/combos/:id/baseline-version の要求。
type setComboBaselineRequest struct {
	// BaselineVersion はコンボの基準。空文字は NULL へ戻す
	// (★基準が NULL は「影響可能性あり」側である。2 種類の NULL の向きを試せる)。
	BaselineVersion string `json:"baselineVersion"`
}

// SetComboBaselineVersion はコンボの基準を直接書き換える(登録時期の違いを模す)。
//
// POST /api/debug/combos/:id/baseline-version
//
// ★判定は「基準 < マーカー」であり対称なので、マーカーを上げる代わりに基準を下げても
// 同じ状態を作れる。E2E では「他のコンボを巻き込まずに 1 件だけ影響ありにする」ために要る
// (マーカーは技に立つので、同じ技を使う全コンボへ及ぶ)。
func (h *Handler) SetComboBaselineVersion(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid combo id")
	}
	var req setComboBaselineRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}

	ctx := c.Request().Context()
	var execErr error
	if req.BaselineVersion == "" {
		_, execErr = h.db.ExecContext(ctx,
			`UPDATE combos SET baseline_version = NULL WHERE id = ?`, id)
	} else {
		if err := gameversion.Validate(req.BaselineVersion); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		_, execErr = h.db.ExecContext(ctx,
			`UPDATE combos SET baseline_version = ? WHERE id = ?`, req.BaselineVersion, id)
	}
	if execErr != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, execErr.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// GetCurrentDataVersion は games.current_data_version を返す(E2E の前提合わせ用)。
//
// GET /api/debug/game-version
func (h *Handler) GetCurrentDataVersion(c echo.Context) error {
	v, err := gamerepo.New(h.db).CurrentDataVersion(c.Request().Context(), gamerepo.CodeSF6)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]any{"currentDataVersion": v})
}

// ClearGameUpdateNotice はゲーム更新の告知の「延期」の記録を消す。
//
// DELETE /api/debug/notices/game-update
//
// ★★E2E が共有状態を元へ戻すために要る(D-399 (1))。本番には「延期の解除」という
// 操作が無い(版が上がれば自然に外れる)ので、本番経路としては作らない。
// ⇒ 戻せない状態を E2E が残すと、告知を見る spec が後から増えたときに黙って落ちる。
func (h *Handler) ClearGameUpdateNotice(c echo.Context) error {
	if h.dir == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "data dir is not configured")
	}
	if err := datadir.RemoveGameUpdateNotice(h.dir); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
