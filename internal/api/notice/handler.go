// Package notice は起動時の告知(現在はデータディレクトリ移行のみ)を配信する。
package notice

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
)

// Response はデータ移行の告知。JSON タグは camelCase(CLAUDE.md §4)。
//
// ★★絶対パスを含める。露出の条件を正確に書いておく ————————————————————
// 本ルートは /api グループ配下であり mw.Auth を通る(GET /api/health のような
// 素通しルートではない)。**ただし mw.Auth は password_enabled = false のとき素通しであり、
// その既定のままなら未認証で読める。** lan モードなら LAN 内の任意の端末から読める。
//
// ★それでも絶対パスを載せているのは、(1) 同条件で GET /api/config が既に
// database.path を返しており露出の種類が増えないこと、(2) 利用者が「移行前のデータが
// どこに残っているか」を知らないと、開発者が消してよいか判断できないこと、による。
// ★露出を減らすなら From / To / RetiredTo を落とし、退避先はログにだけ出す形になる。
type Response struct {
	Status string `json:"status"`
	// Reason は Status を細分する機械可読なコード。画面が文面を出し分けるのに使う
	// (とくに「新旧の両方が在る」の良性形と、データが取り残されている危険形)。
	Reason       string `json:"reason,omitempty"`
	Message      string `json:"message"`
	From         string `json:"from,omitempty"`
	To           string `json:"to,omitempty"`
	RetiredTo    string `json:"retiredTo,omitempty"`
	RetireFailed bool   `json:"retireFailed"`
	At           string `json:"at,omitempty"`
	Acknowledged bool   `json:"acknowledged"`
}

// Handler はデータディレクトリ直下の告知ファイルを読み書きする。
type Handler struct {
	// dir は告知ファイルを置くディレクトリ(実際に使っているデータディレクトリ)。
	dir string
	now func() time.Time
}

// NewHandler は Handler を生成する。dir が空なら告知は常に「無し」になる。
func NewHandler(dir string) *Handler {
	return &Handler{dir: dir, now: time.Now}
}

// Get は GET /api/notices/data-migration を処理する。
// 告知が無い、または既に閉じられていれば 204 を返す。
func (h *Handler) Get(c echo.Context) error {
	if h.dir == "" {
		return c.NoContent(http.StatusNoContent)
	}
	n, ok, err := datadir.ReadNotice(h.dir)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	if !ok || n.Acknowledged {
		return c.NoContent(http.StatusNoContent)
	}
	res := Response{
		Status:       string(n.Status),
		Reason:       string(n.Reason),
		Message:      n.Message,
		From:         n.From,
		To:           n.To,
		RetiredTo:    n.RetiredTo,
		RetireFailed: n.RetireFailed,
		Acknowledged: n.Acknowledged,
	}
	if !n.At.IsZero() {
		res.At = n.At.Format(time.RFC3339)
	}
	return c.JSON(http.StatusOK, res)
}

// Ack は POST /api/notices/data-migration/ack を処理する。
func (h *Handler) Ack(c echo.Context) error {
	if h.dir == "" {
		return c.NoContent(http.StatusNoContent)
	}
	if err := datadir.AckNotice(h.dir, h.now()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
