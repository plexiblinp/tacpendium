import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCheckDuplicate, type CheckDuplicateInput } from "./useCheckDuplicate";

// ★M24-08 第 2 部 C(CO-010): 本フックは生 fetch + useEffect から TanStack Query へ移った。
//   ⇒ QueryClientProvider が要る。主張(何を呼ぶ / 何を返す)は変えていない。
//   ★retry を切る。既定の再試行が入ると、失敗系の主張が「1 回で失敗」でなくなる。
//   ★gcTime を 0 にする。テスト間でキャッシュが残ると「呼ばないはず」の主張が
//     前のテストの結果で通ってしまう。
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function makeInput(overrides?: Partial<CheckDuplicateInput>): CheckDuplicateInput {
  return {
    characterId: 1,
    starterMoveId: 10,
    position: "mid_screen",
    opponentStance: "standing",
    hitType: "normal",
    opponentSize: "standard",
    starterMeaty: false, // M37-07
    steps: [{ stepOrder: 1, moveId: 10 }],
    ...overrides,
  };
}

function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("useCheckDuplicate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("input が null なら API を呼ばず空配列を返す", async () => {
    const fetchSpy = mockFetchResponse({ duplicates: [] });
    const { result } = renderHook(() => useCheckDuplicate(null), { wrapper });

    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.duplicates).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("enabled=false なら API を呼ばない", async () => {
    const fetchSpy = mockFetchResponse({ duplicates: [] });
    const { result } = renderHook(() =>
      useCheckDuplicate(makeInput(), { enabled: false }),
    { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.duplicates).toEqual([]);
  });

  it("デバウンス後に API を呼び、重複なしの結果を返す", async () => {
    const fetchSpy = mockFetchResponse({ duplicates: [] });
    const { result } = renderHook(() =>
      useCheckDuplicate(makeInput(), { debounceMs: 100 }),
    { wrapper },
    );

    expect(fetchSpy).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(150));

    expect(fetchSpy).toHaveBeenCalledOnce();
    // ★TanStack は応答の解決が 1 tick 遅れる。debounce のタイマを進めるだけでは
    //   結果が確定していない(着手前の生 fetch 実装では同じ act で確定していた)。
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.duplicates).toEqual([]);
  });

  it("重複ありの結果を正しく返す", async () => {
    const dup = {
      id: 42,
      characterId: 1,
      starterMoveId: 10,
      position: "mid_screen",
      opponentStance: "standing",
      hitType: "normal",
      opponentSize: "standard",
      stepCount: 3,
    };
    const fetchSpy = mockFetchResponse({ duplicates: [dup] });
    const { result } = renderHook(() =>
      useCheckDuplicate(makeInput(), { debounceMs: 50 }),
    { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(100));

    expect(fetchSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(result.current.duplicates).toEqual([dup]));
  });

  it("HTTP エラー時に error を設定する", async () => {
    mockFetchResponse({ message: "server error" }, 500);
    const { result } = renderHook(() =>
      useCheckDuplicate(makeInput(), { debounceMs: 50 }),
    { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(100));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain("500");
    expect(result.current.duplicates).toEqual([]);
  });

  it("excludeComboId がリクエストボディに含まれる", async () => {
    const fetchSpy = mockFetchResponse({ duplicates: [] });
    renderHook(() =>
      useCheckDuplicate(makeInput({ excludeComboId: 99 }), { debounceMs: 50 }),
    { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(100));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const body = JSON.parse(
      fetchSpy.mock.calls[0][1]?.body as string,
    );
    expect(body.excludeComboId).toBe(99);
  });
});
