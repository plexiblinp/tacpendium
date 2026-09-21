import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { useCharacters, useCharacterName } from "./useCharacters";

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

describe("useCharacters", () => {
  it("returns character list on success", async () => {
    const chars = [
      { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
    ];
    mockFetchResponse({ items: chars });

    const { result } = renderHook(() => useCharacters(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(chars);
  });

  it("uses correct query key", async () => {
    mockFetchResponse({ items: [] });

    const { result } = renderHook(() => useCharacters(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/games/1/characters",
      expect.any(Object),
    );
  });

  it("handles API error", async () => {
    mockFetchResponse({ message: "error" }, 500);

    const { result } = renderHook(() => useCharacters(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCharacterName", () => {
  it("returns nameJa for valid character ID", async () => {
    const chars = [
      { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
    ];
    mockFetchResponse({ items: chars });

    const { result } = renderHook(() => useCharacterName(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe("リュウ"));
  });

  it("returns empty string for null characterId", async () => {
    mockFetchResponse({ items: [] });

    const { result } = renderHook(() => useCharacterName(null), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe("");
  });

  it("returns empty string for undefined characterId", async () => {
    mockFetchResponse({ items: [] });

    const { result } = renderHook(() => useCharacterName(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe("");
  });

  it("returns empty string for non-existent characterId", async () => {
    const chars = [
      { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
    ];
    mockFetchResponse({ items: chars });

    const { result } = renderHook(() => useCharacterName(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(""));
  });
});
