import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SetupSelectorModal } from "./SetupSelectorModal";
import type { SetupSummary } from "@/features/setup/types";

const mockUseCandidates = vi.fn();

// C-08: 候補は knockdown_advantage 一致で取得する hook を使う。
vi.mock("@/features/setup/hooks/useSetupCandidatesByKnockdown", () => ({
  useSetupCandidatesByKnockdown: (...args: unknown[]) =>
    mockUseCandidates(...args),
}));

const makeSetup = (id: number): SetupSummary => ({
  id,
  characterId: 1,
  name: `セットプレイ${id}`,
  description: null,
  stepCount: 2,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [1],
});

afterEach(() => vi.clearAllMocks());

describe("SetupSelectorModal", () => {
  it("open=false のとき dialog が存在しない", () => {
    mockUseCandidates.mockReturnValue({ data: [], isLoading: false });
    render(
      <SetupSelectorModal
        open={false}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("excludeSetupIds に含まれるセットプレイを除外する", () => {
    mockUseCandidates.mockReturnValue({
      data: [makeSetup(1), makeSetup(2), makeSetup(3)],
      isLoading: false,
    });
    render(
      <SetupSelectorModal
        open={true}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[2]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("セットプレイ1")).toBeTruthy();
    expect(screen.queryByText("セットプレイ2")).toBeNull();
    expect(screen.getByText("セットプレイ3")).toBeTruthy();
  });

  it("候補 0 件のとき案内メッセージを表示する", () => {
    mockUseCandidates.mockReturnValue({ data: [], isLoading: false });
    render(
      <SetupSelectorModal
        open={true}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("同一有利フレームの紐付け候補がありません"),
    ).toBeTruthy();
  });

  it("候補クリックで onSelect が呼ばれる", () => {
    const setup = makeSetup(5);
    mockUseCandidates.mockReturnValue({
      data: [setup],
      isLoading: false,
    });
    const onSelect = vi.fn();
    render(
      <SetupSelectorModal
        open={true}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[]}
        onSelect={onSelect}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("セットプレイ5"));
    expect(onSelect).toHaveBeenCalledWith(setup);
  });

  // ★M24-05 §4.2: レシピが共通部品 RecipeText を通っていることを固定する
  //   (直書きへ差し戻すと赤くなる形にする。レビュー 中-1)。
  it("候補のレシピは RecipeText を通って描かれる", () => {
    mockUseCandidates.mockReturnValue({ data: [makeSetup(5)], isLoading: false });
    render(
      <SetupSelectorModal
        open={true}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const recipe = screen.getByTestId("recipe-text");
    expect(recipe.textContent).toBe("↓↘→P");
    expect(recipe.getAttribute("data-recipe-view")).toBe("compact");
  });

  it("閉じるボタンで onOpenChange(false) が呼ばれる", () => {
    mockUseCandidates.mockReturnValue({ data: [], isLoading: false });
    const onOpenChange = vi.fn();
    render(
      <SetupSelectorModal
        open={true}
        characterId={1}
        knockdownAdvantage={5}
        excludeSetupIds={[]}
        onSelect={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
