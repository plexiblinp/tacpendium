import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useSetupCandidates } from "./useSetupCandidates";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    getCandidates: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockGetCandidates = vi.mocked(setupApi.getCandidates);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  mockGetCandidates.mockReset();
});

describe("useSetupCandidates", () => {
  it("comboId が正の数なら fetch する", async () => {
    const mockData = [
      { id: 10, characterId: 1, name: "候補1", stepCount: 2, version: 1, defaultRecipe: "test", parentComboIds: [2] },
    ];
    mockGetCandidates.mockResolvedValue(mockData);

    const { result } = renderHook(() => useSetupCandidates(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(mockData);
    expect(mockGetCandidates).toHaveBeenCalledWith(1);
  });

  it("comboId が null なら fetch しない", () => {
    const { result } = renderHook(() => useSetupCandidates(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCandidates).not.toHaveBeenCalled();
  });

  it("comboId が undefined なら fetch しない", () => {
    const { result } = renderHook(() => useSetupCandidates(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCandidates).not.toHaveBeenCalled();
  });

  it("comboId が 0 なら fetch しない", () => {
    const { result } = renderHook(() => useSetupCandidates(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGetCandidates).not.toHaveBeenCalled();
  });
});
