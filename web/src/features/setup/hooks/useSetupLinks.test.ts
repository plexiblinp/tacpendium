import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useCreateSetupLink, useDeleteSetupLink } from "./useSetupLinks";

vi.mock("../api/setupApi", () => ({
  setupApi: {
    createLink: vi.fn(),
    deleteLink: vi.fn(),
  },
}));

import { setupApi } from "../api/setupApi";
const mockCreateLink = vi.mocked(setupApi.createLink);
const mockDeleteLink = vi.mocked(setupApi.deleteLink);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockCreateLink.mockReset();
  mockDeleteLink.mockReset();
});

describe("useCreateSetupLink", () => {
  it("成功時に combo / setup 両方のキャッシュを無効化する", async () => {
    mockCreateLink.mockResolvedValue(undefined);
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateSetupLink(), { wrapper });

    await act(async () => {
      result.current.mutate({ comboId: 2, setupId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateLink).toHaveBeenCalledWith(2, 1);
  });
});

describe("useDeleteSetupLink", () => {
  it("成功時に combo / setup 両方のキャッシュを無効化する", async () => {
    mockDeleteLink.mockResolvedValue(undefined);
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteSetupLink(), { wrapper });

    await act(async () => {
      result.current.mutate({ comboId: 2, setupId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteLink).toHaveBeenCalledWith(2, 1);
  });
});
