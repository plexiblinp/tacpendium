import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import ComparePage from "./ComparePage";

vi.mock("@/lib/api-client", () => ({
  fetchJSON: vi.fn(),
}));

vi.mock("@/features/combo/api", () => ({
  useCombos: vi.fn().mockReturnValue({
    data: { items: [], count: 0 },
    isLoading: false,
    isError: false,
  }),
}));

import { fetchJSON } from "@/lib/api-client";

const mockedFetchJSON = vi.mocked(fetchJSON);

function createWrapper(initialEntries: string[] = ["/compare"]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ids パラメータなしの場合、空状態を表示する", () => {
    render(<ComparePage />, {
      wrapper: createWrapper(["/compare"]),
    });
    expect(screen.getByText("比較対象が選択されていません")).toBeTruthy();
  });

  it("ids パラメータありの場合、比較表を表示する", async () => {
    const makeCombo = (id: number) => ({
      id,
      characterId: 1,
      isDraft: false,
      damage: 200,
      starterMoveCode: "5LP",
      defaultRecipe: "5LP > 5MP",
      stepCount: 2,
      version: 1,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      tags: [],
    });

    mockedFetchJSON.mockImplementation((url: string) => {
      const id = Number(url.split("/").pop());
      return Promise.resolve(makeCombo(id));
    });

    render(<ComparePage />, {
      wrapper: createWrapper(["/compare?ids=1,2"]),
    });

    expect(screen.getByRole("heading", { name: "コンボ比較" })).toBeTruthy();
  });

  it("不正な ids 値は除外される", () => {
    render(<ComparePage />, {
      wrapper: createWrapper(["/compare?ids=1,abc,-3,0,2"]),
    });

    expect(screen.getByRole("heading", { name: "コンボ比較" })).toBeTruthy();
  });

  it("ヘッダにナビゲーションリンクが表示される", () => {
    render(<ComparePage />, {
      wrapper: createWrapper(["/compare"]),
    });

    expect(screen.getByText("Tacpendium")).toBeTruthy();
    expect(screen.getByText("コンボ一覧")).toBeTruthy();
    expect(screen.getByText("マイコンボ")).toBeTruthy();
  });

  it("コンボ一覧に戻るリンクが表示される", () => {
    render(<ComparePage />, {
      wrapper: createWrapper(["/compare"]),
    });

    expect(screen.getByText(/コンボ一覧に戻る/)).toBeTruthy();
  });
});
