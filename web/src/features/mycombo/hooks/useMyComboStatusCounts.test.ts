import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { useMyComboStatusCounts } from "./useMyComboStatusCounts";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMyComboStatusCounts", () => {
  it("aggregates usage counts from 3 tags", async () => {
    mockFetchResponse([
      { id: 1, userId: 1, name: "使用中", category: "mycombo_status", usageCount: 5 },
      { id: 2, userId: 1, name: "練習中", category: "mycombo_status", usageCount: 3 },
      { id: 3, userId: 1, name: "頻度低下", category: "mycombo_status", usageCount: 1 },
    ]);

    const { result } = renderHook(() => useMyComboStatusCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      inUse: 5,
      practicing: 3,
      reduced: 1,
    });
  });

  it("returns 0 for missing tags", async () => {
    mockFetchResponse([
      { id: 1, userId: 1, name: "使用中", category: "mycombo_status", usageCount: 2 },
    ]);

    const { result } = renderHook(() => useMyComboStatusCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      inUse: 2,
      practicing: 0,
      reduced: 0,
    });
  });

  it("returns 0 for tags without usageCount", async () => {
    mockFetchResponse([
      { id: 1, userId: 1, name: "使用中", category: "mycombo_status" },
      { id: 2, userId: 1, name: "練習中", category: "mycombo_status" },
      { id: 3, userId: 1, name: "頻度低下", category: "mycombo_status" },
    ]);

    const { result } = renderHook(() => useMyComboStatusCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      inUse: 0,
      practicing: 0,
      reduced: 0,
    });
  });

  it("returns undefined while loading", () => {
    mockFetchResponse([]);

    const { result } = renderHook(() => useMyComboStatusCounts(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("E-3: characterId を character_id クエリとして付与する(キャラ追従)", async () => {
    const fetchSpy = mockFetchResponse([
      { id: 1, userId: 1, name: "使用中", category: "mycombo_status", usageCount: 2 },
    ]);

    const { result } = renderHook(() => useMyComboStatusCounts(7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("character_id=7");
    expect(calledUrl).toContain("include_usage=true");
  });
});
