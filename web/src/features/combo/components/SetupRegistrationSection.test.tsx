import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SetupRegistrationSection } from "./SetupRegistrationSection";
import type { CreateSetupInput, SetupSummary } from "@/features/setup/types";

vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: () => <div data-testid="setup-recipe-editor" />,
}));

vi.mock("@/features/setup/hooks/useSetupCandidatesByKnockdown", () => ({
  useSetupCandidatesByKnockdown: () => ({ data: [], isLoading: false }),
}));

const makeSetupSummary = (id: number): SetupSummary => ({
  id,
  characterId: 1,
  name: `既存セットプレイ${id}`,
  description: null,
  stepCount: 2,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [1],
});

afterEach(() => vi.clearAllMocks());

describe("SetupRegistrationSection", () => {
  it("「+ セットプレイを追加」で新規行が追加される", () => {
    const onChange = vi.fn();
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={onChange}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("+ セットプレイを追加"));
    expect(onChange).toHaveBeenCalledWith([
      { characterId: 1, name: null, description: null, steps: [] },
    ]);
  });

  it("既存 setup がある状態で追加するとリストの末尾に追加される", () => {
    const existing: CreateSetupInput = {
      characterId: 1,
      name: "既存",
      description: null,
      steps: [],
    };
    const onChange = vi.fn();
    render(
      <SetupRegistrationSection
        value={[existing]}
        onChange={onChange}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("+ セットプレイを追加"));
    expect(onChange).toHaveBeenCalledWith([
      existing,
      { characterId: 1, name: null, description: null, steps: [] },
    ]);
  });

  it("紐付け予定の既存セットプレイが表示される", () => {
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={vi.fn()}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[makeSetupSummary(10), makeSetupSummary(20)]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("既存セットプレイ10")).toBeDefined();
    expect(screen.getByText("既存セットプレイ20")).toBeDefined();
  });

  // ★M24-05 §4.2: 本箇所は followup の「5 か所」に入っていなかった 6 か所目である。
  //   RecipeText を通っていることを固定する(レビュー 中-1)。
  it("紐付け予定のレシピは RecipeText を通って描かれる", () => {
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={vi.fn()}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[makeSetupSummary(10)]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    const recipe = screen.getByTestId("recipe-text");
    expect(recipe.textContent).toBe("↓↘→P");
    expect(recipe.getAttribute("data-recipe-view")).toBe("compact");
  });

  it("紐付け予定の取消ボタンで onLinkedSetupsChange が呼ばれる", () => {
    const onLinkedSetupsChange = vi.fn();
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={vi.fn()}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[makeSetupSummary(10), makeSetupSummary(20)]}
        onLinkedSetupsChange={onLinkedSetupsChange}
      />,
    );
    const cancelButtons = screen.getAllByText("取消");
    fireEvent.click(cancelButtons[0]);
    expect(onLinkedSetupsChange).toHaveBeenCalledWith([makeSetupSummary(20)]);
  });

  it("「既存のセットプレイを紐付け」ボタンが存在する", () => {
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={vi.fn()}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("既存のセットプレイを紐付け")).toBeDefined();
  });

  it("セクション見出しが表示される", () => {
    render(
      <SetupRegistrationSection
        value={[]}
        onChange={vi.fn()}
        characterId={1}
        knockdownAdvantage={null}
        linkedSetups={[]}
        onLinkedSetupsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("このコンボに紐づくセットプレイ")).toBeDefined();
  });
});
