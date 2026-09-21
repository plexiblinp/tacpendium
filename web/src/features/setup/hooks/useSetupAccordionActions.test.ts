import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useSetupAccordionActions } from "./useSetupAccordionActions";

const mockMutate = vi.fn();

vi.mock("./useSetupLinks", () => ({
  useDeleteSetupLink: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
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

describe("useSetupAccordionActions", () => {
  it("handleUnlink で mutate が comboId + setupId で呼ばれる", () => {
    const { result } = renderHook(
      () => useSetupAccordionActions(10),
      { wrapper: createWrapper() },
    );

    act(() => result.current.handleUnlink(5));

    expect(mockMutate).toHaveBeenCalledWith(
      { comboId: 10, setupId: 5 },
      expect.any(Object),
    );
  });

  it("isDeleting の初期値は false", () => {
    const { result } = renderHook(
      () => useSetupAccordionActions(10),
      { wrapper: createWrapper() },
    );

    expect(result.current.isDeleting).toBe(false);
  });
});
