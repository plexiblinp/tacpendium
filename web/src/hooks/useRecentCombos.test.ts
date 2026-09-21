import { createElement, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRecentCombos } from "./useRecentCombos";

/** 応答本文を差し替え、呼ばれた fetch の spy を返す。 */
function stubFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** テストごとに独立した QueryClient を張る(再試行は無効)。 */
function withQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

/**
 * spy が受けた 1 回目の要求先を URL として取り出す。
 *
 * ★`?.` で握り潰さない。fetch が 1 度も呼ばれていないとき `new URL("undefined", ...)` は
 *   成功してしまい、`pathname` が `/undefined` という読めない失敗になる。
 *   ⇒ 先に呼ばれたことを主張し、何が起きたか分かる形で落とす。
 */
function firstRequestUrl(spy: ReturnType<typeof stubFetch>): URL {
  expect(spy, "fetch が 1 度も呼ばれていない").toHaveBeenCalled();
  return new URL(String(spy.mock.calls[0][0]), "http://localhost");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRecentCombos", () => {
  it("更新日時の降順で 3 件だけを要求する", async () => {
    const fetchSpy = stubFetch({ items: [], count: 0, total: 0 });

    const { result } = renderHook(() => useRecentCombos(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = firstRequestUrl(fetchSpy);
    expect(url.pathname).toBe("/api/combos");
    // ★部分文字列で見ると `limit=30` も `order=descending` も通ってしまう。
    //   ⇒ クエリを解析し、値そのものを突き合わせる。
    expect(url.searchParams.get("sort")).toBe("updated_at");
    expect(url.searchParams.get("order")).toBe("desc");
    expect(url.searchParams.get("limit")).toBe("3");
  });

  it("成功時は応答のコンボを順序どおり返す", async () => {
    const items = [
      { id: 1, updatedAt: "2026-05-24T10:00:00Z", defaultRecipe: "5LP > 5MP", starterMoveCode: "5LP" },
      { id: 2, updatedAt: "2026-05-24T09:00:00Z", defaultRecipe: "2MK > 236P", starterMoveCode: "2MK" },
      { id: 3, updatedAt: "2026-05-24T08:00:00Z", defaultRecipe: "5HP > 214K", starterMoveCode: "5HP" },
    ];
    stubFetch({ items, count: 3, total: 3 });

    const { result } = renderHook(() => useRecentCombos(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(3);
    // ★件数だけでは「中身が入れ替わっていない」ことを言えない。
    expect(result.current.data?.items.map((combo) => combo.id)).toEqual([1, 2, 3]);
    expect(result.current.data?.items[0].defaultRecipe).toBe("5LP > 5MP");
    expect(result.current.data?.count).toBe(3);
  });

  it("HTTP エラー応答はエラー状態として扱い、再試行しない", async () => {
    const fetchSpy = stubFetch({ error: "internal_error" }, 500);

    const { result } = renderHook(() => useRecentCombos(), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
