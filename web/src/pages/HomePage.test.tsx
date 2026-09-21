import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import HomePage from "./HomePage";

// ★呼び出しごとに新しい Response を作る。Response のボディは 1 度しか読めないため、
// 同じインスタンスを使い回すと 2 本目以降の fetch が「読み取り済み」で落ちる。
// HomePage は複数のクエリを同時に投げる(コンボ一覧 / データ移行の告知)。
function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function renderHomePage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/"]}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders app logo and subtitle", () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    expect(screen.getByText("Tacpendium")).toBeTruthy();
    expect(screen.getByText("SF6 コンボマネージャー")).toBeTruthy();
  });

  it("shows the onboarding banner on first visit", () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    expect(screen.getByText("はじめてご利用の方へ")).toBeTruthy();
  });

  it("renders all 6 main function buttons", () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    expect(screen.getByText("コンボ一覧")).toBeTruthy();
    expect(screen.getByText("マイコンボ")).toBeTruthy();
    expect(screen.getByText("新規コンボ登録")).toBeTruthy();
    expect(screen.getByText("コンボ比較")).toBeTruthy();
    expect(screen.getByText("プリセット管理")).toBeTruthy();
    expect(screen.getByText("設定")).toBeTruthy();
  });

  // ★M20-04(2026-08-13)で主張を反転させた。
  //
  // 旧: "preset button is disabled with tooltip"。/presets が未実装で、
  // ホームのボタンが span + cursor-not-allowed だったことを守っていた。
  // M20-04 で画面が実装され、この主張は成立しなくなった。
  it("preset button links to /presets", () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    const presetBtn = screen.getByText("プリセット管理");
    expect(presetBtn.tagName).toBe("A");
    expect(presetBtn.className).not.toContain("cursor-not-allowed");
    expect(presetBtn.getAttribute("href")).toBe("/presets");
  });

  it("buttons link to correct routes", () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/combos");
    expect(hrefs).toContain("/mycombo");
    expect(hrefs).toContain("/combos/new");
    expect(hrefs).toContain("/compare");
    expect(hrefs).toContain("/presets");
    expect(hrefs).toContain("/settings");
  });

  it("shows loading state while fetching recent combos", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderHomePage();

    expect(screen.getByText("最近更新したコンボ")).toBeTruthy();
    expect(screen.getByText("読み込み中...")).toBeTruthy();
  });

  it("shows recent combos when data is loaded", async () => {
    const items = [
      { id: 10, updatedAt: "2026-05-24T10:00:00Z", defaultRecipe: "5LP > 5MP", starterMoveCode: "5LP", stepCount: 2, tags: [] },
      { id: 20, updatedAt: "2026-05-24T09:00:00Z", defaultRecipe: "2MK > 236P", starterMoveCode: "2MK", stepCount: 2, tags: [] },
    ];
    mockFetchResponse({ items, count: 2 });
    renderHomePage();

    const link10 = await screen.findByText("#10");
    expect(link10).toBeTruthy();
    expect(screen.getByText("#20")).toBeTruthy();
    expect(screen.getByText("5LP > 5MP")).toBeTruthy();
  });

  it("shows empty placeholder when no recent combos", async () => {
    mockFetchResponse({ items: [], count: 0 });
    renderHomePage();

    const emptyMsg = await screen.findByText("最近更新したコンボはありません");
    expect(emptyMsg).toBeTruthy();
  });

  it("shows error message when fetch fails", async () => {
    mockFetchResponse({ error: "internal_error" }, 500);
    renderHomePage();

    const errorMsg = await screen.findByText("コンボの取得に失敗しました");
    expect(errorMsg).toBeTruthy();
  });

  it("recent combo items link to detail pages", async () => {
    const items = [
      { id: 42, updatedAt: "2026-05-24T10:00:00Z", defaultRecipe: "5HP", starterMoveCode: "5HP", stepCount: 1, tags: [] },
    ];
    mockFetchResponse({ items, count: 1 });
    renderHomePage();

    await screen.findByText("#42");
    const comboLink = screen.getByText("#42").closest("a");
    expect(comboLink?.getAttribute("href")).toBe("/combos/42");
  });
});
