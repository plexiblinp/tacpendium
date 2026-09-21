import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { setupApi } from "./setupApi";
import { ApiError } from "@/features/combo/api";

vi.mock("@/lib/api-client", () => ({
  fetchJSON: vi.fn(),
}));

import { fetchJSON } from "@/lib/api-client";
const mockFetch = vi.mocked(fetchJSON);

beforeEach(() => {
  mockFetch.mockReset();
});

function mockGlobalFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// create / update は requestSetupJSON 経由(構造化 ApiError を投げる)なので
// 実 fetch をモックする。その他のエンドポイントは fetchJSON モックを使う。
describe("setupApi.create", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POST /api/combos/:comboId/setups を呼ぶ", async () => {
    const mockResp = { id: 1, characterId: 1, stepCount: 1, version: 1, parentComboIds: [2], steps: [], defaultRecipe: "" };
    const spy = mockGlobalFetch(mockResp);

    const result = await setupApi.create(2, { characterId: 1, steps: [] });
    expect(spy).toHaveBeenCalledWith("/api/combos/2/setups", expect.objectContaining({ method: "POST" }));
    expect(result).toEqual(mockResp);
  });

  it("400 バリデーションエラー時に ApiError(validations 付き)を投げる(バグ#6)", async () => {
    const validations = { issues: [{ code: "VAL-S02", severity: "error", field: "steps", message: "レシピが空です" }] };
    mockGlobalFetch({ error: { code: "validation_failed", details: { validations } } }, 400);

    expect.assertions(3);
    try {
      await setupApi.create(2, { characterId: 1, steps: [] });
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).validations).toEqual(validations);
    }
  });
});

describe("setupApi.createLink", () => {
  it("POST /api/combos/:comboId/setup-links を呼ぶ", async () => {
    mockFetch.mockResolvedValueOnce(undefined);
    await setupApi.createLink(2, 1);
    expect(mockFetch).toHaveBeenCalledWith("/api/combos/2/setup-links", expect.objectContaining({ method: "POST" }));
  });
});

describe("setupApi.deleteLink", () => {
  it("DELETE /api/combos/:comboId/setup-links/:setupId を呼ぶ", async () => {
    mockFetch.mockResolvedValueOnce(undefined);
    await setupApi.deleteLink(2, 1);
    expect(mockFetch).toHaveBeenCalledWith("/api/combos/2/setup-links/1", expect.objectContaining({ method: "DELETE" }));
  });
});

describe("setupApi.get", () => {
  it("GET /api/setups/:id を呼ぶ", async () => {
    const mockResp = { id: 1, characterId: 1, stepCount: 0, version: 1, parentComboIds: [], steps: [], defaultRecipe: "" };
    mockFetch.mockResolvedValueOnce(mockResp);
    const result = await setupApi.get(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/setups/1");
    expect(result).toBe(mockResp);
  });
});

describe("setupApi.listByCharacter", () => {
  it("GET /api/setups?characterId=X を呼ぶ", async () => {
    mockFetch.mockResolvedValueOnce({ items: [] });
    const result = await setupApi.listByCharacter(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/setups?characterId=1");
    expect(result).toEqual([]);
  });
});

describe("setupApi.update", () => {
  afterEach(() => vi.restoreAllMocks());

  it("PATCH /api/setups/:id を呼ぶ", async () => {
    const mockResp = { id: 1, characterId: 1, stepCount: 0, version: 2, parentComboIds: [], steps: [], defaultRecipe: "" };
    const spy = mockGlobalFetch(mockResp);
    const result = await setupApi.update(1, { version: 1 });
    expect(spy).toHaveBeenCalledWith("/api/setups/1", expect.objectContaining({ method: "PATCH" }));
    expect(result).toEqual(mockResp);
  });
});

describe("setupApi.remove", () => {
  it("DELETE /api/setups/:id を呼ぶ", async () => {
    mockFetch.mockResolvedValueOnce(undefined);
    await setupApi.remove(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/setups/1", expect.objectContaining({ method: "DELETE" }));
  });
});
