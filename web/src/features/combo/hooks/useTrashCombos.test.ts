import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import { useTrashCombos } from "./useTrashCombos";

function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useTrashCombos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only_deleted=true を含む URL でリクエストを送る", async () => {
    const fetchSpy = mockFetchResponse({ items: [], count: 0 });
    const { result } = renderHook(() => useTrashCombos(1), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("only_deleted=true");
    expect(calledUrl).toContain("character_id=1");
  });

  it("正常系: コンボ一覧を返す", async () => {
    const items = [{ id: 1, characterId: 1, deletedAt: "2026-05-01T00:00:00Z" }];
    mockFetchResponse({ items, count: 1 });
    const { result } = renderHook(() => useTrashCombos(1), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it("HTTP エラー時に error をセットする", async () => {
    mockFetchResponse({ error: "internal_error" }, 500);
    const { result } = renderHook(() => useTrashCombos(1), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
