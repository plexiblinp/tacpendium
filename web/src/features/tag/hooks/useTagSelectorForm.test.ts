import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import "@/lib/i18n";
import { useTagSelectorForm } from "./useTagSelectorForm";
import { DEFAULT_TAG_COLOR } from "@/features/tag/constants/tagColorPalette";

const mockMutateAsync = vi.fn();

vi.mock("./useTagManagement", () => ({
  useTagManagement: vi.fn(() => ({
    createMutation: {
      mutateAsync: mockMutateAsync,
    },
  })),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTagSelectorForm", () => {
  it("handleCreateTag で mutateAsync が呼ばれて新しい tag id を返す", async () => {
    mockMutateAsync.mockResolvedValue({ id: 42, name: "新タグ" });

    const { result } = renderHook(() => useTagSelectorForm(), {
      wrapper: createWrapper(),
    });

    let tagId: number | null = null;
    await act(async () => {
      tagId = await result.current.handleCreateTag("新タグ");
    });

    expect(tagId).toBe(42);
    expect(mockMutateAsync).toHaveBeenCalledWith({ name: "新タグ", color: DEFAULT_TAG_COLOR });
  });

  it("FB⑭: quick-create でも既定色(青系・灰色固定でない)が付与される", async () => {
    mockMutateAsync.mockResolvedValue({ id: 1, name: "新タグ" });

    const { result } = renderHook(() => useTagSelectorForm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleCreateTag("新タグ");
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ color: DEFAULT_TAG_COLOR }),
    );
  });

  it("空文字の name では mutateAsync を呼ばず null を返す", async () => {
    const { result } = renderHook(() => useTagSelectorForm(), {
      wrapper: createWrapper(),
    });

    let tagId: number | null = null;
    await act(async () => {
      tagId = await result.current.handleCreateTag("");
    });

    expect(tagId).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("mutateAsync が失敗した場合は null を返す", async () => {
    mockMutateAsync.mockRejectedValue(new Error("API error"));

    const { result } = renderHook(() => useTagSelectorForm(), {
      wrapper: createWrapper(),
    });

    let tagId: number | null = null;
    await act(async () => {
      tagId = await result.current.handleCreateTag("新タグ");
    });

    expect(tagId).toBeNull();
  });

  it("creating は処理中に true になり完了後 false に戻る", async () => {
    let resolvePromise: (value: { id: number; name: string }) => void;
    mockMutateAsync.mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );

    const { result } = renderHook(() => useTagSelectorForm(), {
      wrapper: createWrapper(),
    });

    expect(result.current.creating).toBe(false);

    let promise: Promise<number | null>;
    act(() => {
      promise = result.current.handleCreateTag("テスト");
    });

    await waitFor(() => expect(result.current.creating).toBe(true));

    await act(async () => {
      resolvePromise!({ id: 1, name: "テスト" });
      await promise!;
    });

    expect(result.current.creating).toBe(false);
  });
});
