import type {
  AuthErrorResponse,
  AuthStatus,
  LoginRequest,
  SetPasswordRequest,
} from "./types";

/**
 * AuthApiError は認証経路の失敗を status 付きで運ぶ。
 *
 * fetchJSON(lib/api-client.ts)は status を文字列へ埋め込むため分岐できない。
 * features/tag の TagApiError と同じ形にしてある。
 */
export class AuthApiError extends Error {
  status: number;
  body: AuthErrorResponse | null;

  constructor(status: number, body: AuthErrorResponse | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return this.body?.error.code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: AuthErrorResponse | null = null;
    try {
      body = (await res.json()) as AuthErrorResponse;
    } catch {
      // JSON パース失敗時は body=null のまま
    }
    throw new AuthApiError(res.status, body, `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  /** 認証状態を取得する。★保護対象外であり未認証でも読める。 */
  status: (): Promise<AuthStatus> => request<AuthStatus>("/api/auth/status"),

  /** 入場する。成功時はセッション Cookie が発行される(204・本文なし)。 */
  login: (req: LoginRequest): Promise<void> =>
    request<void>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  /** セッションを破棄する。冪等。 */
  logout: (): Promise<void> =>
    request<void>("/api/auth/logout", {
      method: "POST",
    }),

  /**
   * パスワードを設定・変更する。
   *
   * ★成功すると既存セッションが全破棄される(DES-002 §8.1 の 14)。
   * 変更した端末自身も切れるため、呼び出し側はログインへ戻す導線を出すこと。
   */
  setPassword: (req: SetPasswordRequest): Promise<void> =>
    request<void>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
