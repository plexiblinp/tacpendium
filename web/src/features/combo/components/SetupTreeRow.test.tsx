import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { Table, TableBody } from "@/components/ui/table";
import SetupTreeRow from "./SetupTreeRow";
import type { SetupSummary } from "@/features/setup/types";

const mockNavigate = vi.fn();

import "@/lib/i18n";
import { RECIPE_EMPTY_LABEL } from "@/features/combo/recipeDisplay";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const makeSetup = (id: number, name: string | null, recipe: string): SetupSummary => ({
  id,
  characterId: 1,
  name,
  description: null,
  stepCount: 2,
  version: 1,
  defaultRecipe: recipe,
  parentComboIds: [10],
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(MemoryRouter, {}, children),
    );
}

function renderRow(setups: SetupSummary[], onSetupClick?: (id: number) => void) {
  return render(
    <Table>
      <TableBody>
        <SetupTreeRow setups={setups} colSpan={5} onSetupClick={onSetupClick} />
      </TableBody>
    </Table>,
    { wrapper: createWrapper() },
  );
}

describe("SetupTreeRow", () => {
  it("セットプレイが空の場合は何も表示しない", () => {
    const { container } = renderRow([]);
    expect(container.querySelector("tr")).toBeNull();
  });

  // ★M24-05 §4.2: レシピを共通部品 RecipeText へ通したため、角括弧と本文が
  //   別要素になった。★検証は緩めない——本文は RecipeText が描いていること
  //   (data-testid)を確かめ、括弧つきの見え方は包む span の textContent で確かめる。
  it("セットプレイ名とレシピを表示する(RecipeText 経由・角括弧つき)", () => {
    const { container } = renderRow([makeSetup(1, "テストセットプレイ", "↓↘→P")]);
    expect(screen.getByText("テストセットプレイ")).toBeTruthy();
    const recipe = screen.getByTestId("recipe-text");
    expect(recipe.textContent).toBe("↓↘→P");
    expect(recipe.parentElement?.textContent?.replace(/\s/g, "")).toBe("[↓↘→P]");
    expect(container.querySelector('[data-recipe-view="compact"]')).toBeTruthy();
  });

  it("名前が null の場合はフォールバック表示する", () => {
    renderRow([makeSetup(1, null, "↓↘→P")]);
    expect(screen.getByText("セットプレイ #1")).toBeTruthy();
  });

  it("レシピが空の場合は空レシピのラベルを表示する", () => {
    renderRow([makeSetup(1, "テスト", "")]);
    const recipe = screen.getByTestId("recipe-text");
    // ★★M29-01: 着手前は手書きリテラル `"（レシピなし）"` を直接主張していた
    //   (コメントは「RECIPE_EMPTY_LABEL を通る」と書いていたが、主張は写しだった)。
    //   ⇒ 源泉である ja.json 由来の定数で主張する。語が動いても追随する。
    expect(recipe.textContent).toBe(RECIPE_EMPTY_LABEL);
    expect(recipe.getAttribute("data-recipe-view")).toBe("empty");
    expect(recipe.parentElement?.textContent?.replace(/\s/g, "")).toBe(
      `[${RECIPE_EMPTY_LABEL}]`,
    );
  });

  it("クリックで onSetupClick が呼ばれる", () => {
    const onClick = vi.fn();
    renderRow([makeSetup(1, "テスト", "↓↘→P")], onClick);
    fireEvent.click(screen.getByText("テスト"));
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it("onSetupClick が未指定の場合は navigate が呼ばれる", () => {
    renderRow([makeSetup(1, "テスト", "↓↘→P")]);
    fireEvent.click(screen.getByText("テスト"));
    expect(mockNavigate).toHaveBeenCalledWith("/setups/1");
  });

  it("複数セットプレイを表示する", () => {
    renderRow([
      makeSetup(1, "セットプレイA", "↓↘→P"),
      makeSetup(2, "セットプレイB", "↓↙←K"),
    ]);
    expect(screen.getByText("セットプレイA")).toBeTruthy();
    expect(screen.getByText("セットプレイB")).toBeTruthy();
  });
});
