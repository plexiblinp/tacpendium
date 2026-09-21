package auth

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// MaxBodyBytes は認証 API の要求本文の上限(DES-006 VAL-N07。CHANGE-119)。
//
// ★★掛ける範囲は /api/auth/* の 4 経路だけである(M22-08 §4.2-2)。全経路へ掛けては
// ならない——POST /api/import/* は利用者のファイルを丸ごと受ける経路であり、
// combo_file(≤10MiB)＋ setup_file(≤10MiB)＋ multipart の境界で正当な要求が
// 20MiB を超えうる(internal/api/comboio/handler.go の maxUploadBytes)。
// 全経路へ小さい上限を掛けると取り込みが壊れ、しかも「大きいファイルのときだけ」
// 失敗するため小さい CSV のテストは緑のまま通る(同 §4.2-4)。
//
// 8KiB の根拠: 最大の要求は
// {"currentPassword":"<128 文字>","newPassword":"<128 文字>"} で 300 バイト未満である。
// 25 倍以上の余裕を持たせつつ、鍵導出(約 315ms)を叩く前段で頭打ちにできる。
const MaxBodyBytes int64 = 8 << 10

// CodeBodyTooLarge は要求本文が上限を超えたことを表すエラーコード(VAL-N07)。
const CodeBodyTooLarge = "request_body_too_large"

// BodyLimit は要求本文を上限で頭打ちにするミドルウェアを返す。
//
// ★実体は標準ライブラリの http.MaxBytesReader である(M22-08 §4.6＝D-410)。
// バイト数の計上・上限ちょうどの値・読み取り途中での打ち切りといった境界の扱いは
// すべて標準側が持つ。本関数が足しているのは Echo のミドルウェア形式への接続と、
// 本プロジェクトの応答封筒への変換だけである。
//
// ★Echo の middleware.BodyLimit を採らなかった理由(完了報告にも記す):
// echo/v4/middleware パッケージは golang.org/x/time/rate を取り込むため、
// go.mod / go.sum へ golang.org/x/time が新規に載る。M22-08 §7.3 は
// go.mod / go.sum の diff 0 を完了条件に挙げており、§2.3 / §9.3-3 は新規依存の
// 追加を禁じている。⇒ 標準ライブラリ側の仕組みを使えば依存を増やさずに済む。
func BodyLimit(limit int64) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			req := c.Request()

			// 申告された長さが既に超えているなら、本文を読まずに弾く。
			// ★ContentLength は申告値であり、信用しきらない(下の頭打ちが本体である)。
			if req.ContentLength > limit {
				return bodyTooLarge(c)
			}

			// 申告が無い(chunked)・申告が偽っている場合に備えて実読み取りも頭打ちにする。
			req.Body = http.MaxBytesReader(c.Response(), req.Body, limit)

			err := next(c)

			// 取りこぼしの受け皿。ハンドラが上限超過を自分で畳まずに返した場合に
			// 413 へ寄せる。★応答済みなら触らない(二重書き込みを避ける)。
			//
			// ★ハンドラが c.Bind のエラーを自分で畳む経路では、ここへは来ない。
			// そちらは IsBodyTooLarge で判別する(handler.go)。
			if err != nil && IsBodyTooLarge(err) && !c.Response().Committed {
				return bodyTooLarge(c)
			}
			return err
		}
	}
}

// IsBodyTooLarge は err が要求本文の上限超過に由来するかを返す。
//
// ★c.Bind のエラーを自分で畳むハンドラは、畳む前にこれで判別すること。
// 判別しないと、上限超過が「JSON が壊れている」(400)として扱われ、
// Content-Length を申告しない要求だけ VAL-N07 の応答が変わってしまう。
func IsBodyTooLarge(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr)
}

// bodyTooLarge は 413 応答を組み立てる。
// ★受け取った値そのものは応答へ載せない(パスワードが混じるため)。
func bodyTooLarge(c echo.Context) error {
	return c.JSON(http.StatusRequestEntityTooLarge,
		model.NewAPIError(CodeBodyTooLarge, "request body is too large"))
}
