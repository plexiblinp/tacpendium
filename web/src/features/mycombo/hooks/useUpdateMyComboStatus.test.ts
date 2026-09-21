import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { useUpdateMyComboStatus } from "./useUpdateMyComboStatus";
import type { ComboSummary } from "@/features/combo/types";

const STATUS_TAGS = [
  { id: 10, userId: 1, name: "使用中", category: "mycombo_status" },
  { id: 11, userId: 1, name: "練習中", category: "mycombo_status" },
  { id: 12, userId: 1, name: "頻度低下", category: "mycombo_status" },
];

const TAG_QUERY_KEY = ["tags", { include_usage: false, category: "mycombo_status" }];

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(TAG_QUERY_KEY, STATUS_TAGS);
  return {
    qc,
    Wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children),
  };
}

function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("/api/tags")) {
      return new Response(JSON.stringify(STATUS_TAGS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function makeCombo(overrides?: Partial<ComboSummary>): ComboSummary {
  return {
    id: 1,
    characterId: 1,
    damage: 3000,
    isDraft: false,
    version: 5,
    tags: [
      { id: 10, userId: 1, name: "使用中", category: "mycombo_status" },
      { id: 99, userId: 1, name: "カスタムタグ", category: null },
    ],
    ...overrides,
  } as ComboSummary;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUpdateMyComboStatus", () => {
  it("builds tagIds preserving non-status tags and adding new status tag", async () => {
    const fetchSpy = mockFetch();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo(), newStatus: "practicing" });
    });

    await waitFor(() => expect(result.current.changingComboId).toBeNull());

    const patchCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/combos/1"),
    );
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.tagIds).toContain(99);
    expect(body.tagIds).toContain(11);
    expect(body.tagIds).not.toContain(10);
  });

  it("removes all status tags when newStatus is empty string", async () => {
    const fetchSpy = mockFetch();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo(), newStatus: "" });
    });

    await waitFor(() => expect(result.current.changingComboId).toBeNull());

    const patchCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/combos/1"),
    );
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.tagIds).toEqual([99]);
  });

  it("sends version from combo in PATCH request", async () => {
    const fetchSpy = mockFetch();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo({ version: 42 }), newStatus: "in_use" });
    });

    await waitFor(() => expect(result.current.changingComboId).toBeNull());

    const patchCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/combos/1"),
    );
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.version).toBe(42);
  });

  it("invalidates combos and tags queries on success", async () => {
    mockFetch();
    const { qc, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo(), newStatus: "reduced" });
    });

    await waitFor(() => expect(result.current.changingComboId).toBeNull());

    const calls = invalidateSpy.mock.calls.map((call) => call[0]);
    expect(calls).toContainEqual({ queryKey: ["combos"] });
    expect(calls).toContainEqual(
      expect.objectContaining({
        queryKey: ["tags", expect.objectContaining({ include_usage: true, category: "mycombo_status" })],
      }),
    );
  });

  // 改善レーン F3: 詳細画面のキャッシュ(["combo", id])も無効化しないと、
  // 一覧でステータス変更→詳細を開いたとき旧ステータスタグが表示され続ける。
  it("invalidates the combo detail cache on success", async () => {
    mockFetch();
    const { qc, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo(), newStatus: "practicing" });
    });

    await waitFor(() => expect(result.current.changingComboId).toBeNull());

    const calls = invalidateSpy.mock.calls.map((call) => call[0]);
    expect(calls).toContainEqual({ queryKey: ["combo", 1] });
  });

  // 改善レーン F4: ステータスタグ一覧の取得完了前に mutate すると、旧ステータスタグを
  // 判別できず(allTagIds が空)除去されないまま新タグが追加され、二重付与になる。
  // 未ロード中は PATCH を発行しないこと。
  it("does not send PATCH while status tags are not yet loaded", async () => {
    const fetchSpy = mockFetch();
    // setQueryData しない = タグ未ロード状態のまま mutate する
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo(), newStatus: "practicing" });
    });

    // タグ取得の fetch は走ってよいが、/api/combos への PATCH は飛ばないこと
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const patchCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("/api/combos/"),
    );
    expect(patchCall).toBeUndefined();
    expect(result.current.changingComboId).toBeNull();
  });

  it("sets changingComboId during mutation", async () => {
    mockFetch();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateMyComboStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ combo: makeCombo({ id: 7 }), newStatus: "in_use" });
    });

    expect(result.current.changingComboId).toBe(7);

    await waitFor(() => expect(result.current.changingComboId).toBeNull());
  });
});
