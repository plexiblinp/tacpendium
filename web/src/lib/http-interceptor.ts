// http-interceptor は window.fetch を 1 度だけ包み、次の 2 つを 1 か所で担う。
//
//   (1) 保護対象の 401 を検知して購読者へ通知する(指示書 §4.3-2)
//   (2) 選択中の利用者を X-User-Id ヘッダで送る(同 §4.5)
//
// ★なぜ fetch を包むのか——API 呼び出しが lib/api-client.ts の fetchJSON へ
// 一本化されていないためである。features/tag は独自の request、features/combo は
// 独自の ApiError を持ち、素の fetch を直接呼ぶ箇所も複数ある。
// ⇒ 「401 の判断を 1 か所に置く」(E-76: 同じ判断が 2 か所にあると必ずドリフトする)
//    を実際に成立させられる層はここだけである。
//
// ★応答は改変しない。status も body も素通しする。副作用は通知だけである。
// ★password_enabled = false のときも余計な問い合わせは増えない(最重要ゲート 2)。
//   本モジュールは新しいリクエストを一切発行しない。

/** X-User-Id は「誰として操作するか」の札であって認証ではない(DES-002 §8)。 */
export const USER_ID_HEADER = "X-User-Id";

const API_PREFIX = "/api/";
// ★ログイン経路自身の 401 を巻き込まない(指示書 §4.3-4)。
// 巻き込むと、パスワードを間違えたときに入力欄が消えて理由も分からなくなる。
const AUTH_PREFIX = "/api/auth/";

type UnauthorizedListener = () => void;

const listeners = new Set<UnauthorizedListener>();
let userIdProvider: (() => number | null) | null = null;
let uninstall: (() => void) | null = null;

/**
 * onUnauthorized は保護対象の 401 を購読する。戻り値を呼ぶと解除する。
 *
 * ★セッション切れ(サーバ再起動・パスワード変更)も同じ経路で拾える
 * (DES-002 §8.1 の 12・14)。
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * setUserIdProvider は X-User-Id に載せる値の供給元を差し込む。
 *
 * ★null を返す間はヘッダを付けない。サーバ側は未指定なら users.id の最小値へ
 * フォールバックするため、いままでどおりの挙動になる(指示書 §4.5-4)。
 */
export function setUserIdProvider(provider: (() => number | null) | null): void {
  userIdProvider = provider;
}

/**
 * isUnauthorizedError は「認証が要る」応答に由来する失敗かを判定する。
 *
 * ★本リポジトリの API エラーには 3 つの形が併存する。片方だけを見ると取りこぼす。
 *   (a) status を持つ独自クラス —— TagApiError / AuthApiError
 *   (b) status を message へ埋めた Error —— lib/api-client.ts の fetchJSON が投げる
 *       `HTTP 401: <本文>`(status を構造化して持たないため、文字列で見るしかない)
 *   (c) 素の fetch を直に呼ぶ箇所 —— Response をそのまま扱うため本関数は通らない
 *
 * ⇒ (b) の文字列判定は fetchJSON の実装に結び付いている。fetchJSON が status を
 *    構造化して持つよう改めたら、ここも合わせて畳むこと。
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  if (status === 401) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.startsWith("HTTP 401");
}

/** 同一オリジンの /api/ 宛かを判定し、パスを返す。対象外なら null。 */
function apiPathOf(input: RequestInfo | URL): string | null {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname.startsWith(API_PREFIX) ? url.pathname : null;
  } catch {
    return null;
  }
}

/**
 * installHttpInterceptor は window.fetch を包む。多重設置は行わない。
 * 戻り値を呼ぶと元の fetch へ戻す(テスト用)。
 */
export function installHttpInterceptor(): () => void {
  if (uninstall) return uninstall;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = apiPathOf(input);
    if (path === null) {
      return original(input, init);
    }

    // (2) 利用者の札を載せる。既に明示されていれば尊重する。
    let nextInit = init;
    const userId = userIdProvider?.() ?? null;
    if (userId !== null) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has(USER_ID_HEADER)) {
        headers.set(USER_ID_HEADER, String(userId));
      }
      nextInit = { ...init, headers };
    }

    const res = await original(input, nextInit);

    // (1) 保護対象の 401 だけを通知する。
    if (res.status === 401 && !path.startsWith(AUTH_PREFIX)) {
      for (const listener of listeners) listener();
    }
    return res;
  };

  uninstall = () => {
    window.fetch = original;
    uninstall = null;
  };
  return uninstall;
}
