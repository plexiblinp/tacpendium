import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  installHttpInterceptor,
  isUnauthorizedError,
  onUnauthorized,
  setUserIdProvider,
  USER_ID_HEADER,
} from "./http-interceptor";

// ★本モジュールは「401 を捕まえる場所は 1 か所」(指示書 §4.3-2・§5.1-5)と
// 「利用者の札を載せる場所は 1 か所」(§4.5)の実体である。
// 画面ごとに 401 を書かないことの網はここに置く(E-76)。

let uninstall: (() => void) | null = null;
let originalFetch: typeof window.fetch;

function stubFetch(status: number, body = "{}") {
  const impl = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(body, { status, headers: { "Content-Type": "application/json" } }),
  );
  window.fetch = impl as unknown as typeof window.fetch;
  return impl;
}

beforeEach(() => {
  originalFetch = window.fetch;
  setUserIdProvider(null);
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
  window.fetch = originalFetch;
  setUserIdProvider(null);
});

describe("http-interceptor: 401 の検知", () => {
  it("保護対象の 401 を通知する", async () => {
    stubFetch(401);
    uninstall = installHttpInterceptor();
    const seen = vi.fn();
    onUnauthorized(seen);

    await window.fetch("/api/combos");

    expect(seen).toHaveBeenCalledTimes(1);
  });

  // ★§4.3-4: ログイン経路自身の 401 を巻き込まない。
  // 巻き込むと、パスワードを間違えたときに入力欄が消えて理由も分からなくなる。
  it("ログイン経路の 401 は通知しない", async () => {
    stubFetch(401);
    uninstall = installHttpInterceptor();
    const seen = vi.fn();
    onUnauthorized(seen);

    await window.fetch("/api/auth/login", { method: "POST" });
    await window.fetch("/api/auth/status");

    expect(seen).not.toHaveBeenCalled();
  });

  it("成功時は通知しない(対照)", async () => {
    stubFetch(200);
    uninstall = installHttpInterceptor();
    const seen = vi.fn();
    onUnauthorized(seen);

    await window.fetch("/api/combos");

    expect(seen).not.toHaveBeenCalled();
  });

  it("/api/ 以外は素通しする", async () => {
    stubFetch(401);
    uninstall = installHttpInterceptor();
    const seen = vi.fn();
    onUnauthorized(seen);

    await window.fetch("/src/features/tag/api/tagApi.ts");

    expect(seen).not.toHaveBeenCalled();
  });

  // ★応答を改変しない。副作用は通知だけである。
  it("応答の status と本文を変えない", async () => {
    stubFetch(401, JSON.stringify({ error: { code: "unauthorized" } }));
    uninstall = installHttpInterceptor();

    const res = await window.fetch("/api/combos");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "unauthorized" } });
  });

  it("多重設置しない", async () => {
    stubFetch(401);
    uninstall = installHttpInterceptor();
    installHttpInterceptor();
    const seen = vi.fn();
    onUnauthorized(seen);

    await window.fetch("/api/combos");

    // 2 回包んでいたら 2 回通知される。
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("購読を解除できる", async () => {
    stubFetch(401);
    uninstall = installHttpInterceptor();
    const seen = vi.fn();
    const off = onUnauthorized(seen);
    off();

    await window.fetch("/api/combos");

    expect(seen).not.toHaveBeenCalled();
  });
});

describe("http-interceptor: 利用者の札", () => {
  it("供給元が値を返すと X-User-Id を載せる", async () => {
    const impl = stubFetch(200);
    uninstall = installHttpInterceptor();
    setUserIdProvider(() => 7);

    await window.fetch("/api/tags");

    const init = impl.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get(USER_ID_HEADER)).toBe("7");
  });

  it("供給元が null を返すとヘッダを付けない(既存の挙動を変えない)", async () => {
    const impl = stubFetch(200);
    uninstall = installHttpInterceptor();
    setUserIdProvider(() => null);

    await window.fetch("/api/tags");

    const init = impl.mock.calls[0][1] as RequestInit | undefined;
    const headers = new Headers(init?.headers);
    expect(headers.has(USER_ID_HEADER)).toBe(false);
  });

  it("/api/ 以外にはヘッダを付けない", async () => {
    const impl = stubFetch(200);
    uninstall = installHttpInterceptor();
    setUserIdProvider(() => 7);

    await window.fetch("/assets/app.js");

    const init = impl.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).has(USER_ID_HEADER)).toBe(false);
  });
});

describe("isUnauthorizedError", () => {
  it("status を持つエラーを判定できる", () => {
    expect(isUnauthorizedError({ status: 401 })).toBe(true);
    expect(isUnauthorizedError({ status: 500 })).toBe(false);
  });

  // ★fetchJSON は status を message へ埋める(lib/api-client.ts)。
  it("fetchJSON が投げる形の Error を判定できる", () => {
    expect(isUnauthorizedError(new Error('HTTP 401: {"error":{}}'))).toBe(true);
    expect(isUnauthorizedError(new Error("HTTP 500: boom"))).toBe(false);
  });

  it("それ以外は偽", () => {
    expect(isUnauthorizedError(null)).toBe(false);
    expect(isUnauthorizedError("HTTP 401")).toBe(false);
  });
});
