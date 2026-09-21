import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useDeleteSetup } from "./useDeleteSetup";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    remove: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockRemove = vi.mocked(setupApi.remove);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  mockRemove.mockReset();
});

describe("useDeleteSetup", () => {
  it("mutate を呼ぶと setupApi.remove が呼ばれる", async () => {
    mockRemove.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteSetup(), { wrapper: createWrapper() });

    result.current.mutate({ id: 3, parentComboIds: [5] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // ★★M31-01(P4M-019): 第 2 引数は unlinkFrom(任意)。**指定しなければ undefined**
    //   であり、API は従来どおりクエリ無しの DELETE を投げる。
    expect(mockRemove).toHaveBeenCalledWith(3, undefined);
  });

  // ★★M31-01(P4M-019): unlinkFrom を渡すと API へ素通しされる。
  //   ⇒ 「このコンボとの紐付けも外す」チェックが実際に効くのはここである。
  it("★unlinkFrom を渡すと setupApi.remove の第 2 引数へ渡る", async () => {
    mockRemove.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteSetup(), { wrapper: createWrapper() });

    result.current.mutate({ id: 3, parentComboIds: [5], unlinkFrom: 5 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRemove).toHaveBeenCalledWith(3, 5);
  });

  // 改善レーン F5: 削除したセットプレイが他コンボの「紐付け候補」一覧に残らないよう、
  // setupCandidates キャッシュ全体(プレフィックス)を無効化する。
  it("削除成功時に setupCandidates キャッシュを無効化する", async () => {
    mockRemove.mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDeleteSetup(), { wrapper });

    result.current.mutate({ id: 3, parentComboIds: [5] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(keys).toContainEqual({ queryKey: ["setupCandidates"] });
  });
});
