import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { useConfig } from "./useConfig";

vi.mock("@/lib/api-client", () => ({
  fetchJSON: vi.fn(),
}));

import { fetchJSON } from "@/lib/api-client";
const mockedFetchJSON = vi.mocked(fetchJSON);

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockConfigResponse = {
  server: { mode: "local", port: 47318 },
  database: { path: "" },
  logging: { level: "info", file: "logs/tacpendium.log", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
  security: { passwordEnabled: false },
  network: { primaryLanIp: "", lanUrl: "" },
  defaults: { characterId: 1, presetId: 1 },
  isInitialized: true,
  restartRequired: false,
};

describe("useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches config and returns data", async () => {
    mockedFetchJSON.mockResolvedValueOnce(mockConfigResponse);

    const { result } = renderHook(() => useConfig(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.server.port).toBe(47318);
    expect(result.current.data?.defaults.characterId).toBe(1);
    expect(result.current.data?.network.primaryLanIp).toBe("");
  });
});
