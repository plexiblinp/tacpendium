// 認証(簡易パスワードによる入場ゲート)の API 型。
// Go 側 internal/api/auth/dto.go と目視で対応させる(camelCase 統一)。
//
// ★「ユーザー選択」とは別物である(DES-002 §8)。ここで扱うのは入場の可否だけで、
// 誰が入ったかは区別しない。利用者の識別は features/user/ が持つ。

/** GET /api/auth/status の応答。★未認証でも読める唯一の経路。 */
export interface AuthStatus {
  /**
   * 入場ゲートが実際に効いているか(実効値)。
   *
   * ★GET /api/config の security.passwordEnabled(config.toml の生値)とは別物である。
   * password_enabled = true でもパスワード未設定なら false になり、両者は割れる
   * (DES-002 §8.1 の 7)。★画面が見るべきはこちらである。
   */
  passwordRequired: boolean;
  /** パスワードが設定済みか。初回設定か変更かの分岐に使う。 */
  passwordSet: boolean;
  /** 現在のリクエストが有効なセッションを持つか。 */
  authenticated: boolean;
}

/** POST /api/auth/login のリクエスト。 */
export interface LoginRequest {
  password: string;
}

/**
 * POST /api/auth/password のリクエスト。
 *
 * currentPassword は設定済みの場合に必須(DES-002 §8.1 の 13)。
 * 未設定からの初回設定では空でよい。
 */
export interface SetPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** API のエラー封筒(internal/model/api_error.go)。 */
export interface AuthErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
