import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJSON } from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchJSON", () => {
  it("returns parsed JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", value: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const got = await fetchJSON<{ status: string; value: number }>("/api/test");
    expect(got).toEqual({ status: "ok", value: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns undefined on 204 No Content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const got = await fetchJSON<void>("/api/delete", { method: "DELETE" });
    expect(got).toBeUndefined();
  });

  it("throws on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("internal error", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJSON("/api/broken")).rejects.toThrow(/HTTP 500/);
  });

  it("merges custom headers without losing Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchJSON("/api/h", { headers: { "X-Custom": "1" } });
    const callArgs = fetchMock.mock.calls[0];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Custom"]).toBe("1");
  });
});
