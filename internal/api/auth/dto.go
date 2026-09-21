package auth

// LoginRequest は POST /api/auth/login のリクエスト DTO。
type LoginRequest struct {
	Password string `json:"password"`
}

// StatusResponse は GET /api/auth/status のレスポンス DTO。
//
// ★未認証でも読める唯一の経路である。画面はこれを見て「パスワードを求めるべきか」を
// 決める(M22-01 §4.4-4)。GET /api/config は保護対象になるため代わりに使えない。
//
// ★検証子・セッション ID は含めない。
type StatusResponse struct {
	// PasswordRequired は入場ゲートが実際に効いているか。
	//
	// ★GET /api/config の security.passwordEnabled とは別物である。あちらは
	// config.toml の生値、こちらは実効値であり、password_enabled = true かつ
	// パスワード未設定のときに両者は true / false へ割れる。
	// 同じ名前で違う値になるのを避けるため、名前を分けてある。
	// ★画面が見るべきはこちら(実効値)である。
	PasswordRequired bool `json:"passwordRequired"`
	// PasswordSet はパスワードが設定済みか。初回設定か変更かの分岐に使う。
	PasswordSet bool `json:"passwordSet"`
	// Authenticated は現在のリクエストが有効なセッションを持っているか。
	Authenticated bool `json:"authenticated"`
}

// SetPasswordRequest は POST /api/auth/password のリクエスト DTO。
//
// CurrentPassword は設定済みの場合に必須(M22-01 §4.4-3)。未設定からの初回設定では空でよい。
type SetPasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}
