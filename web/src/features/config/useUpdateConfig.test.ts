import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { useUpdateConfig } from "./useUpdateConfig";

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
  defaults: { characterId: 5, presetId: 1 },
  isInitialized: true,
  restartRequired: false,
};

const FILTERS_KEY = "combo-list-filters-v1";

describe("useUpdateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("sends PUT and returns updated config", async () => {
    mockedFetchJSON.mockResolvedValueOnce(mockConfigResponse);

    const { result } = renderHook(() => useUpdateConfig(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ defaults: { characterId: 5 } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetchJSON).toHaveBeenCalledWith("/api/config", {
      method: "PUT",
      body: JSON.stringify({ defaults: { characterId: 5 } }),
    });
  });

  // ── M24-01 追補②: 既定キャラを書き換えたら段 2 の記憶を捨てる ──────────
  //
  // ★呼び出し口は本フックの onSuccess 1 か所だけである。画面側(ウィザード・設定)には
  //   置いていない——次に既定キャラを書く画面が現れたとき、呼び忘れても何も言わないため。
  //   ⇒ 両導線がこの 1 本のテストで守られる。
  describe("既定キャラの更新でセッションの段 2 を捨てる", () => {
    const savedFilters = () => {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      return raw === null ? null : (JSON.parse(raw) as string);
    };

    async function runMutation(
      req: Parameters<ReturnType<typeof useUpdateConfig>["mutate"]>[0],
      opts: { fail?: boolean } = {},
    ) {
      if (opts.fail) mockedFetchJSON.mockRejectedValueOnce(new Error("boom"));
      else mockedFetchJSON.mockResolvedValueOnce(mockConfigResponse);
      const { result } = renderHook(() => useUpdateConfig(), {
        wrapper: createWrapper(),
      });
      await act(async () => {
        result.current.mutate(req);
      });
      await waitFor(() => {
        expect(opts.fail ? result.current.isError : result.current.isSuccess).toBe(true);
      });
    }

    it("defaults.characterId を送ると character_id が消える(他の軸は残る)", async () => {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify("character_id=4&tag_ids=1,2&sort=damage"),
      );
      await runMutation({ defaults: { characterId: 5 } });
      expect(savedFilters()).toBe("tag_ids=1%2C2&sort=damage");
    });

    it("★defaults.presetId だけのときは消えない(PresetListPage の経路)", async () => {
      // PresetListPage は { defaults: { presetId } } だけを送る。既定キャラは動いていない。
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify("character_id=4"));
      await runMutation({ defaults: { presetId: 3 } });
      expect(savedFilters()).toBe("character_id=4");
    });

    it("★defaults を含まない更新では消えない", async () => {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify("character_id=4"));
      await runMutation({ server: { mode: "lan" } });
      expect(savedFilters()).toBe("character_id=4");
    });

    it("★失敗した更新では消えない(onSuccess でしか呼ばない)", async () => {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify("character_id=4"));
      await runMutation({ defaults: { characterId: 5 } }, { fail: true });
      expect(savedFilters()).toBe("character_id=4");
    });
  });
});
