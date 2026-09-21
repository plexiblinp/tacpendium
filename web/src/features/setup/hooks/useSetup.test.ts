import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useSetup } from "./useSetup";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    get: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockGet = vi.mocked(setupApi.get);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  mockGet.mockReset();
});

describe("useSetup", () => {
  it("setupId が正の数なら fetch する", async () => {
    const mockResp = { id: 1, characterId: 1, stepCount: 1, version: 1, parentComboIds: [], steps: [], defaultRecipe: "龍波動拳", createdAt: "", updatedAt: "" };
    mockGet.mockResolvedValue(mockResp);

    const { result } = renderHook(() => useSetup(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(mockResp);
    expect(mockGet).toHaveBeenCalledWith(1);
  });

  it("setupId が null なら fetch しない", () => {
    const { result } = renderHook(() => useSetup(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("setupId が 0 なら fetch しない", () => {
    const { result } = renderHook(() => useSetup(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });
});
