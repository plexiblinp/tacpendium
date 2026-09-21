import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";

import MyComboPage from "./MyComboPage";

function createWrapper(initialEntries = ["/mycombo"]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(MemoryRouter, { initialEntries }, children),
    );
}

const TAGS_RESPONSE = [
  { id: 10, userId: 1, name: "使用中", category: "mycombo_status", usageCount: 2 },
  { id: 11, userId: 1, name: "練習中", category: "mycombo_status", usageCount: 1 },
  { id: 12, userId: 1, name: "頻度低下", category: "mycombo_status", usageCount: 0 },
];

const CHARACTERS_RESPONSE = {
  items: [
    { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
    { id: 3, gameId: 1, code: "ken", nameJa: "ケン", nameEn: "Ken" },
    { id: 5, gameId: 1, code: "dhalsim", nameJa: "ダルシム", nameEn: "Dhalsim" },
  ],
};

// M24-01: 設定の既定キャラ(段 3b)。既定では未設定(= config を返さない)。
let configDefaultCharacterId: number | undefined;

const COMBOS_RESPONSE = {
  items: [],
  count: 0,
};

function mockFetchResponses() {
  const requested: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    requested.push(url);
    if (url.includes("/api/config")) {
      if (configDefaultCharacterId === undefined) {
        return Promise.resolve(new Response("Not found", { status: 404 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ defaults: { characterId: configDefaultCharacterId, presetId: 1 } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url.includes("/api/games/") && url.includes("/characters")) {
      return Promise.resolve(
        new Response(JSON.stringify(CHARACTERS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/api/tags")) {
      return Promise.resolve(
        new Response(JSON.stringify(TAGS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/api/combos")) {
      return Promise.resolve(
        new Response(JSON.stringify(COMBOS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("Not found", { status: 404 }));
  });
  return {
    comboListUrls: () => requested.filter((u) => u.startsWith("/api/combos")),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  configDefaultCharacterId = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MyComboPage", () => {
  it("renders header with navigation links", () => {
    mockFetchResponses();
    render(<MyComboPage />, { wrapper: createWrapper() });
    expect(screen.getByText("Tacpendium")).toBeDefined();
    expect(screen.getByText("コンボ一覧")).toBeDefined();
    expect(screen.getByText("設定")).toBeDefined();
  });

  it("shows loading state initially", () => {
    mockFetchResponses();
    render(<MyComboPage />, { wrapper: createWrapper() });
    expect(screen.getByText("common.loading")).toBeDefined();
  });

  it("renders status tabs after loading", async () => {
    mockFetchResponses();
    render(<MyComboPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("(2)")).toBeDefined();
    });
    expect(screen.getByText("(1)")).toBeDefined();
    expect(screen.getByText("(0)")).toBeDefined();
  });

  it("renders sort controls after loading", async () => {
    mockFetchResponses();
    render(<MyComboPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("comboList.filter.sortBy")).toBeDefined();
    });
  });

  // ── M24-01 §4.1-7(SM-058 / D-545) ──────────────────────────────────────
  describe("SM-058: コンボ一覧での選択キャラを引き継ぐ(★キャラだけ)", () => {
    it("セッションに残ったキャラ(段 2)で一覧を引く", async () => {
      sessionStorage.setItem(
        "combo-list-filters-v1",
        JSON.stringify("character_id=3&tag_ids=1,2&is_draft=true&sort=damage&order=asc"),
      );
      const { comboListUrls } = mockFetchResponses();
      render(<MyComboPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(
          comboListUrls().some((u) => u.includes("character_id=3")),
          "セッションのキャラで一覧を引いていない",
        ).toBe(true);
      });
    });

    it("★キャラ以外は持ち込まない(DES-005 §5.5 の除外を破らない)", async () => {
      // 同じセッション値にはタグ・仮登録トグル・ソートも入っているが、
      // マイコンボが読むのはキャラだけである(指示書 §4.1-7)。
      sessionStorage.setItem(
        "combo-list-filters-v1",
        JSON.stringify("character_id=3&tag_ids=1,2&is_draft=true&sort=damage&order=asc"),
      );
      const { comboListUrls } = mockFetchResponses();
      render(<MyComboPage />, { wrapper: createWrapper() });
      // 先に「対象が実際に描画された」ことを確かめてから否定形を主張する(M23-07 の型)。
      await waitFor(() => expect(screen.getByText("(2)")).toBeDefined());
      const urls = comboListUrls();
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        const q = new URLSearchParams(u.split("?")[1] ?? "");
        // ★部分文字列で判定しない。マイコンボ自身は自分のステータスタグ(id=10 等)を
        //   正当に送るため、"tag_ids=1" は "tag_ids=10" にも当たってしまう。
        const tagIds = (q.get("tag_ids") ?? "").split(",").filter(Boolean);
        expect(tagIds, `一覧のタグを持ち込んでいる: ${u}`).not.toContain("1");
        expect(tagIds, `一覧のタグを持ち込んでいる: ${u}`).not.toContain("2");
        expect(q.get("is_draft"), `仮登録トグルを持ち込んでいる: ${u}`).toBeNull();
        expect(q.get("sort"), `一覧のソートを持ち込んでいる: ${u}`).not.toBe("damage");
        expect(q.get("order"), `一覧の昇降を持ち込んでいる: ${u}`).not.toBe("asc");
      }
    });

    it("セッションが無ければ設定の既定キャラ(段 3b)で引く", async () => {
      configDefaultCharacterId = 5;
      const { comboListUrls } = mockFetchResponses();
      render(<MyComboPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(comboListUrls().some((u) => u.includes("character_id=5"))).toBe(true);
      });
    });

    it("どちらも無ければフォールバック定数(段 4 = 1)で引く", async () => {
      const { comboListUrls } = mockFetchResponses();
      render(<MyComboPage />, { wrapper: createWrapper() });
      await waitFor(() => {
        expect(comboListUrls().some((u) => u.includes("character_id=1"))).toBe(true);
      });
    });
  });
});
