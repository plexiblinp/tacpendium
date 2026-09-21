import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import { useCompareCombos } from "./useCompareCombos";

vi.mock("@/lib/api-client", () => ({
  fetchJSON: vi.fn(),
}));

import { fetchJSON } from "@/lib/api-client";

const mockedFetchJSON = vi.mocked(fetchJSON);

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const makeCombo = (id: number) => ({
  id,
  characterId: 1,
  isDraft: false,
  damage: 100,
  stepCount: 3,
  defaultRecipe: "5LP > 5MP > 236P",
  starterMoveCode: "5LP",
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
});

describe("useCompareCombos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空配列を渡した場合、クエリは生成されない", () => {
    const { result } = renderHook(() => useCompareCombos([]), {
      wrapper: createWrapper(),
    });
    expect(result.current).toHaveLength(0);
  });

  it("複数 ID を渡すとそれぞれ並列取得する", async () => {
    mockedFetchJSON.mockImplementation((url: string) => {
      const id = Number(url.split("/").pop());
      return Promise.resolve(makeCombo(id));
    });

    const { result } = renderHook(() => useCompareCombos([1, 2, 3]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.every((q) => q.isSuccess)).toBe(true);
    });

    expect(result.current).toHaveLength(3);
    expect(result.current[0].data?.id).toBe(1);
    expect(result.current[1].data?.id).toBe(2);
    expect(result.current[2].data?.id).toBe(3);
    expect(mockedFetchJSON).toHaveBeenCalledTimes(3);
  });

  it("取得失敗時はエラー状態になる", async () => {
    mockedFetchJSON.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useCompareCombos([99]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current[0].isError).toBe(true);
    });

    expect(result.current[0].error).toBeInstanceOf(Error);
  });
});
