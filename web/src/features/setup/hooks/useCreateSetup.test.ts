import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useCreateSetup } from "./useCreateSetup";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    create: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockCreate = vi.mocked(setupApi.create);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("useCreateSetup", () => {
  it("mutate を呼ぶと setupApi.create が呼ばれる", async () => {
    const mockResp = {
      id: 10, characterId: 1, stepCount: 1, version: 1,
      parentComboIds: [5], steps: [], defaultRecipe: "立ち弱P",
      createdAt: "", updatedAt: "",
    };
    mockCreate.mockResolvedValue(mockResp);

    const { result } = renderHook(() => useCreateSetup(), { wrapper: createWrapper() });

    result.current.mutate({
      comboId: 5,
      input: { characterId: 1, name: null, description: null, steps: [] },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreate).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ characterId: 1 }),
    );
  });
});
