package auth

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/plexiblinp/tacpendium/internal/model"
	authsvc "github.com/plexiblinp/tacpendium/internal/service/auth"
)

// パスワードを決める要求を拒否するときのエラーコード(DES-006 VAL-N05 / VAL-N06)。
//
// ★要件は「理由を区別できること」である(M22-08 §4.1-6)。綴りそのものは製造判断
// (同 §9.2-2)であり、auth パッケージの既存の流儀(フラットなドメインコード)に揃えた。
//
// ★invalid_password(ログイン失敗)と混ぜないこと——あちらは理由を区別しないのが
// 仕様である(DES-002 §8.1)。こちらは「決めるとき」だけに出るため、区別してよい。
const (
	// CodePasswordCharsetInvalid は VAL-N05: 印字可能な ASCII 以外を含む。
	CodePasswordCharsetInvalid = "password_charset_invalid"
	// CodePasswordLengthInvalid は VAL-N06: 前後の空白を除去した長さが範囲外。
	CodePasswordLengthInvalid = "password_length_invalid"
)

// Handler は簡易パスワードの HTTP ハンドラ。
type Handler struct {
	svc *authsvc.Service
}

// NewHandler は Handler を生成する。
func NewHandler(svc *authsvc.Service) *Handler {
	return &Handler{svc: svc}
}

// Login は POST /api/auth/login を処理する。
//
// 照合に通ればセッション Cookie を発行して 204 を返す。
// ★失敗の理由は区別しない(M22-01 §4.4-1)。パスワード未設定・不一致・入場ゲート無効の
// いずれも同じ 401 を返し、Cookie も付けない。
//
// ★入場ゲートが無効なら、正しいパスワードでも 401 である(Service.Login が
// Enabled() を見る)。OFF のときに Set-Cookie が付かないことは §4.9-4 の要件であり、
// TestLogin_DisabledButPasswordSet_IssuesNoCookie が固定している。
func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		// ★上限超過を「JSON が壊れている」へ潰さない(VAL-N07)。
		if IsBodyTooLarge(err) {
			return bodyTooLarge(c)
		}
		return badRequest(c, "invalid JSON body")
	}

	sessionID, ok := h.svc.Login(req.Password)
	if !ok {
		return c.JSON(http.StatusUnauthorized, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "invalid_password",
				Message: "incorrect password",
			},
		})
	}

	issueSession(c, sessionID)
	return c.NoContent(http.StatusNoContent)
}

// Logout は POST /api/auth/logout を処理する。
//
// セッションが無い・既に失効している場合も 204 を返す(冪等)。
func (h *Handler) Logout(c echo.Context) error {
	if id := sessionIDFrom(c); id != "" {
		h.svc.Logout(id)
	}
	clearSession(c)
	return c.NoContent(http.StatusNoContent)
}

// Status は GET /api/auth/status を処理する。
func (h *Handler) Status(c echo.Context) error {
	return c.JSON(http.StatusOK, StatusResponse{
		PasswordRequired: h.svc.Enabled(),
		PasswordSet:      h.svc.PasswordSet(),
		Authenticated:    h.svc.Validate(sessionIDFrom(c)),
	})
}

// SetPassword は POST /api/auth/password を処理する。
//
// ★本経路は認証ミドルウェアの保護対象から外れている(初回設定を通すため)。
// 設定済みの場合の保護は、サービス層が現在のパスワードを要求することで成立する
// (M22-01 §4.4-3。routes.go の注記も参照)。
func (h *Handler) SetPassword(c echo.Context) error {
	var req SetPasswordRequest
	if err := c.Bind(&req); err != nil {
		// ★上限超過を「JSON が壊れている」へ潰さない(VAL-N07)。
		if IsBodyTooLarge(err) {
			return bodyTooLarge(c)
		}
		return badRequest(c, "invalid JSON body")
	}

	err := h.svc.SetPassword(req.CurrentPassword, req.NewPassword)
	switch {
	case err == nil:
		// パスワードが変わると既存セッションはすべて失効する。
		// 手元の Cookie も併せて落としておく(残しても通らないため紛らわしいだけである)。
		clearSession(c)
		return c.NoContent(http.StatusNoContent)
	case errors.Is(err, authsvc.ErrEmptyPassword):
		return badRequest(c, "newPassword must not be empty")
	case errors.Is(err, authsvc.ErrPasswordCharset):
		return badRequestCode(c, CodePasswordCharsetInvalid,
			"newPassword must use printable ASCII characters only")
	case errors.Is(err, authsvc.ErrPasswordLength):
		return badRequestCode(c, CodePasswordLengthInvalid,
			fmt.Sprintf("newPassword must be between %d and %d characters",
				authsvc.PasswordMinLength, authsvc.PasswordMaxLength))
	case errors.Is(err, authsvc.ErrCurrentPasswordRequired):
		return c.JSON(http.StatusUnauthorized, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "invalid_password",
				Message: "incorrect current password",
			},
		})
	default:
		return c.JSON(http.StatusInternalServerError, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "password_write_failed",
				Message: "failed to save the password",
			},
		})
	}
}

// badRequest は理由を区別しない 400 応答を組み立てる。
// ★受け取った値そのものは応答へ載せない(パスワードが混じるため)。
func badRequest(c echo.Context, message string) error {
	return badRequestCode(c, "invalid_request", message)
}

// badRequestCode は理由を区別できるコード付きで 400 応答を組み立てる。
// ★受け取った値そのものは応答へ載せない(パスワードが混じるため)。
func badRequestCode(c echo.Context, code, message string) error {
	return c.JSON(http.StatusBadRequest, model.NewAPIError(code, message))
}
