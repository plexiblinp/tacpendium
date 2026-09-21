import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useUpdateSetup } from "./useUpdateSetup";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    update: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockUpdate = vi.mocked(setupApi.update);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  mockUpdate.mockReset();
});

describe("useUpdateSetup", () => {
  it("mutate を呼ぶと setupApi.update が呼ばれる", async () => {
    const mockResp = {
      id: 3, characterId: 1, stepCount: 1, version: 2,
      parentComboIds: [5], steps: [], defaultRecipe: "立ち弱P",
      createdAt: "", updatedAt: "",
    };
    mockUpdate.mockResolvedValue(mockResp);

    const { result } = renderHook(() => useUpdateSetup(), { wrapper: createWrapper() });

    result.current.mutate({
      id: 3,
      input: { name: "updated", description: null, version: 1 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdate).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ version: 1 }),
    );
  });

  // 改善レーン F5: 編集後のセットプレイが他コンボの「紐付け候補」一覧に古い内容で
  // 残らないよう、setupCandidates キャッシュ全体(プレフィックス)を無効化する。
  it("更新成功時に setupCandidates キャッシュを無効化する", async () => {
    const mockResp = {
      id: 3, characterId: 1, stepCount: 1, version: 2,
      parentComboIds: [5], steps: [], defaultRecipe: "立ち弱P",
      createdAt: "", updatedAt: "",
    };
    mockUpdate.mockResolvedValue(mockResp);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateSetup(), { wrapper });

    result.current.mutate({
      id: 3,
      input: { name: "updated", description: null, version: 1 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(keys).toContainEqual({ queryKey: ["setupCandidates"] });
  });
});
