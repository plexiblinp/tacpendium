package notice

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/model"
)

// GameUpdateResponse はゲーム更新の告知(FR702・M28-02c / CHANGE-162 §2)。
//
// ★★常に 200 で返す。204 の作法から意図して外れている ——
// 返すのは「有無」ではなく件数と現在版であり、204 では表現できない。
// ★一覧のボタンは延期中でも件数が要る。⇒ 告知の有無と件数を同じ 1 本から取り、
// 出どころを 1 つに保つ。
//
// ★★代替は原理的に不可能である(CHANGE-162 §2.2) ——
// GET /api/combos?affected_by_game_update=true&limit=1 の count はそのページの
// 件数であり、limit も丸められる。⇒ 判定式を共有した COUNT が要る。
type GameUpdateResponse struct {
	// CurrentDataVersion は games.current_data_version(初の HTTP 露出)。
	CurrentDataVersion string `json:"currentDataVersion"`
	// AffectedCount は影響可能性ありのコンボの総数(全キャラ合計)。
	//
	// ★★延期中でも返す。抑止するのはバナーだけであり、一覧のボタンは抑止しない。
	AffectedCount int `json:"affectedCount"`
	// PostponedForVersion は「この版のあいだはバナーを出さない」と記録された版。
	//
	// ★現在版と一致するときだけ載る。⇒ 版が上がれば消え、抑止が外れる。
	// ★omitempty —— 延期していない状態はキーごと出ない。
	PostponedForVersion string `json:"postponedForVersion,omitempty"`
}

// GameUpdateHandler はゲーム更新の告知を配信し、延期を記録する。
//
// ★dir はデータディレクトリ(= filepath.Dir(dbPath))。既存の Handler と同じ形で DI する。
// ★dir が空なら延期を持てない。⇒ 告知は返すが、延期は常に「していない」になる。
type GameUpdateHandler struct {
	dir     string
	count   func(c echo.Context) (int, error)
	version func(c echo.Context) (string, error)
	now     func() time.Time
}

// NewGameUpdateHandler は GameUpdateHandler を生成する。
func NewGameUpdateHandler(
	dir string,
	count func(c echo.Context) (int, error),
	version func(c echo.Context) (string, error),
) *GameUpdateHandler {
	return &GameUpdateHandler{dir: dir, count: count, version: version, now: time.Now}
}

// Get は GET /api/notices/game-update を処理する。
//
// エラー契約(CHANGE-159 §1.1 と同じ粒度):
//
//	成功                   200
//	write lock を取れない  503 database_busy
//	それ以外               500 internal_error
func (h *GameUpdateHandler) Get(c echo.Context) error {
	version, err := h.version(c)
	if err != nil {
		return gameUpdateError(c, err)
	}
	count, err := h.count(c)
	if err != nil {
		return gameUpdateError(c, err)
	}

	res := GameUpdateResponse{CurrentDataVersion: version, AffectedCount: count}
	if h.dir != "" {
		postponed, active, rErr := datadir.PostponedForCurrentVersion(h.dir, version)
		if rErr != nil {
			return gameUpdateError(c, rErr)
		}
		// ★★現在版と一致するときだけ載せる。⇒ 版が上がったら抑止が外れる。
		if active {
			res.PostponedForVersion = postponed
		}
	}
	return c.JSON(http.StatusOK, res)
}

// Postpone は POST /api/notices/game-update/postpone を処理する。
//
// ★★要求本文を取らない。サーバが games.current_data_version を読んで書く
// (acknowledge-version が「版数をクライアントから受けない」を選んだのと同型)。
// ⇒ 任意の版へ「延期した」ことにできない。
//
// ★語を /ack ではなく /postpone にしてある ——「永久に既読」と「次の版まで延期」は
// 意味が違う。
func (h *GameUpdateHandler) Postpone(c echo.Context) error {
	// ★★保存できないのに成功を返さない —— それは「失敗を成功として扱う」ことであり、
	//   利用者は「延期したのに次も出る」を説明できない。⇒ 500 で正直に失敗させる。
	//   ★現在の配線では dir は常に非空である(filepath.Dir(dbPath))。
	if h.dir == "" {
		return gameUpdateError(c, errors.New("game update notice: data dir is not configured"))
	}
	version, err := h.version(c)
	if err != nil {
		return gameUpdateError(c, err)
	}
	if err := datadir.PostponeGameUpdateNotice(h.dir, version, h.now()); err != nil {
		return gameUpdateError(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ErrDatabaseBusy は write lock を取れなかったことを表すセンチネル。
//
// ★★本経路にサービス層は無い —— 件数と現在版はリポジトリを直接呼ぶクロージャで取る
// (cmd/tacpendium/main.go)。⇒ 呼び手が包んでくれることを当てにできない。
// そこで gameUpdateError が dbinfra.IsBusy でも判定する。本センチネルは
// 「呼び手が既に翻訳済みのとき」と「テストが 503 を直接起こすとき」のための入口である。
//
// ★★包み忘れると 503 の契約が黙って到達不能になる —— 実装は 500 を返し続けるが、
// センチネルを直接注入するテストは緑のまま通る。⇒ 判定を 2 本立てにしてある。
var ErrDatabaseBusy = errors.New("notice: database busy")

func gameUpdateError(c echo.Context, err error) error {
	if errors.Is(err, ErrDatabaseBusy) || dbinfra.IsBusy(err) {
		return c.JSON(http.StatusServiceUnavailable,
			model.NewAPIError(model.ErrorCodeDatabaseBusy,
				"データベースが混み合っています。少し待って再試行してください"))
	}
	slog.ErrorContext(c.Request().Context(), "game update notice", slog.String("err", err.Error()))
	return c.JSON(http.StatusInternalServerError,
		model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
}
