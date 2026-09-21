import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";

import CharacterInfoBar from "./CharacterInfoBar";
import type { MyComboStatusCounts } from "../hooks/useMyComboStatusCounts";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => {
  vi.restoreAllMocks();
});

function mockCharacterFetch() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [{ id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

const COUNTS: MyComboStatusCounts = { inUse: 5, practicing: 3, reduced: 1 };

describe("CharacterInfoBar", () => {
  // C-07: ステータス別件数はタブへ集約。情報バーは合計件数のみ表示する。
  it("renders total registered count (not per-status breakdown)", () => {
    mockCharacterFetch();
    render(
      <CharacterInfoBar characterId={1} statusCounts={COUNTS} />,
      { wrapper: createWrapper() },
    );
    // 合計表示の要素(registeredCount ラベル)が出ている。per-status の内訳は出さない。
    expect(screen.getByText("comboList.registeredCount")).toBeDefined();
  });

  it("shows empty message when all counts are zero", () => {
    mockCharacterFetch();
    const zeroCounts: MyComboStatusCounts = { inUse: 0, practicing: 0, reduced: 0 };
    render(
      <CharacterInfoBar characterId={1} statusCounts={zeroCounts} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("myCombo.noComboYet")).toBeDefined();
  });

  it("does not show empty message when counts are nonzero", () => {
    mockCharacterFetch();
    render(
      <CharacterInfoBar characterId={1} statusCounts={COUNTS} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByText("myCombo.noComboYet")).toBeNull();
  });

  it("renders character initial in avatar", async () => {
    mockCharacterFetch();
    render(
      <CharacterInfoBar characterId={1} statusCounts={COUNTS} />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByText("リ")).toBeDefined();
    });
  });
});
