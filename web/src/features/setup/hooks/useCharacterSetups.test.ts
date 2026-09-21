import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useCharacterSetups } from "./useCharacterSetups";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    listByCharacter: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockList = vi.mocked(setupApi.listByCharacter);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockList.mockReset();
});

describe("useCharacterSetups", () => {
  it("characterId が正の数なら fetch する", async () => {
    mockList.mockResolvedValue([]);
    const { result } = renderHook(() => useCharacterSetups(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockList).toHaveBeenCalledWith(1);
  });

  it("characterId が null なら fetch しない", () => {
    const { result } = renderHook(() => useCharacterSetups(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockList).not.toHaveBeenCalled();
  });
});
