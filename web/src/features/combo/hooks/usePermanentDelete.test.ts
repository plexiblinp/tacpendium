import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

import { usePermanentDelete } from "./usePermanentDelete";

function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("usePermanentDelete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DELETE /api/combos/:id/permanent に送信する", async () => {
    const fetchSpy = mockFetchResponse({});
    const { result } = renderHook(() => usePermanentDelete(), {
      wrapper: makeWrapper(),
    });

    await act(() => result.current.mutateAsync(42));

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    const calledMethod = (fetchSpy.mock.calls[0][1] as RequestInit).method;
    expect(calledUrl).toBe("/api/combos/42/permanent");
    expect(calledMethod).toBe("DELETE");
  });

  it("404 エラー時に throw する", async () => {
    mockFetchResponse({ error: { code: "not_found", message: "combo not found" } }, 404);
    const { result } = renderHook(() => usePermanentDelete(), {
      wrapper: makeWrapper(),
    });

    await expect(act(() => result.current.mutateAsync(999))).rejects.toThrow("combo not found");
  });

  it("409 エラー時に throw する", async () => {
    mockFetchResponse(
      { error: { code: "combo_not_in_trash", message: "permanent delete requires the combo to be soft-deleted first" } },
      409,
    );
    const { result } = renderHook(() => usePermanentDelete(), {
      wrapper: makeWrapper(),
    });

    await expect(act(() => result.current.mutateAsync(1))).rejects.toThrow(
      "permanent delete requires the combo to be soft-deleted first",
    );
  });
});
