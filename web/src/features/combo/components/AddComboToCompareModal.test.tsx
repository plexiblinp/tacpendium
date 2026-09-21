import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import AddComboToCompareModal from "./AddComboToCompareModal";

vi.mock("../api", () => ({
  useCombos: vi.fn(),
}));

// CharacterSelector は Radix UI Select を使用するため jsdom では pointer capture API が未実装。
// モックに置き換えることで AddComboToCompareModal 側の状態配線をテスト可能にする。
vi.mock("@/features/mycombo/components/CharacterSelector", () => ({
  default: ({
    selectedCharacterId,
    onChange,
  }: {
    selectedCharacterId: number;
    onChange: (id: number) => void;
  }) => (
    <button
      data-testid="mock-character-selector"
      data-selected={selectedCharacterId}
      type="button"
      onClick={() => onChange(2)}
    >
      キャラ選択
    </button>
  ),
}));

import { useCombos } from "../api";

const mockedUseCombos = vi.mocked(useCombos);

const mockCombosChar2 = [
  {
    id: 3,
    characterId: 2,
    isDraft: false,
    damage: 400,
    starterMoveCode: "236K",
    defaultRecipe: "236K > SA2",
    stepCount: 2,
    version: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: [],
  },
];

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const mockCombos = [
  {
    id: 1,
    characterId: 1,
    isDraft: false,
    damage: 200,
    starterMoveCode: "5LP",
    defaultRecipe: "5LP > 5MP > 236P",
    stepCount: 3,
    version: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: [],
  },
  {
    id: 2,
    characterId: 1,
    isDraft: false,
    damage: 300,
    starterMoveCode: "2MK",
    defaultRecipe: "2MK > 236P > SA1",
    stepCount: 3,
    version: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    tags: [],
  },
];

describe("AddComboToCompareModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCombos.mockReturnValue({
      data: { items: mockCombos, count: 2 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCombos>);
  });

  it("open=false のとき dialog が存在しない", () => {
    render(
      <AddComboToCompareModal
        open={false}
        currentIds={[]}
        onAdd={vi.fn()}
        onOpenChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open=true のときコンボ一覧を表示する", () => {
    render(
      <AddComboToCompareModal
        open={true}
        currentIds={[]}
        onAdd={vi.fn()}
        onOpenChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("heading", { name: "コンボを追加" })).toBeTruthy();
    expect(screen.getAllByText(/5LP/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2MK/).length).toBeGreaterThan(0);
  });

  it("currentIds に含まれるコンボは disabled + 選択済みバッジ", () => {
    render(
      <AddComboToCompareModal
        open={true}
        currentIds={[1]}
        onAdd={vi.fn()}
        onOpenChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("選択済み")).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    const comboButton = buttons.find((b) => b.textContent?.includes("5LP") && b.textContent?.includes("選択済み"));
    expect(comboButton).toBeTruthy();
    expect(comboButton!.hasAttribute("disabled")).toBe(true);
  });

  it("未選択コンボをクリックすると onAdd が呼ばれる", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <AddComboToCompareModal
        open={true}
        currentIds={[]}
        onAdd={onAdd}
        onOpenChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const buttons = screen.getAllByRole("button");
    const comboButton = buttons.find((b) => b.textContent?.includes("2MK"));
    expect(comboButton).toBeTruthy();
    await user.click(comboButton!);
    expect(onAdd).toHaveBeenCalledWith(2);
  });

  describe("CharacterSelector 統合", () => {
    it("キャラセレクタとラベルが表示される", () => {
      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText("キャラクター:")).toBeTruthy();
      expect(screen.getByTestId("mock-character-selector")).toBeTruthy();
    });

    it("初期状態で useCombos が既定キャラ解決の段 4(= 1)で呼ばれる", () => {
      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(mockedUseCombos).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 1 }),
      );
    });

    it("初期キャラ(既定キャラ解決の段 4 = 1)でモーダルオープン時にコンボ候補が表示される", () => {
      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getAllByText(/5LP/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2MK/).length).toBeGreaterThan(0);
    });

    it("defaultCharacterId 指定時、その既定キャラで useCombos が呼ばれる(M10-02 文脈追従)", () => {
      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          defaultCharacterId={2}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(mockedUseCombos).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 2 }),
      );
      expect(
        screen.getByTestId("mock-character-selector").getAttribute("data-selected"),
      ).toBe("2");
    });

    it("defaultCharacterId 不在時は既定キャラ解決の段 4(= 1)で呼ばれる(後方互換)", () => {
      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(mockedUseCombos).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 1 }),
      );
    });

    it("他キャラに切替で useCombos が新 characterId で呼ばれる", async () => {
      const user = userEvent.setup();

      render(
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      mockedUseCombos.mockReturnValue({
        data: { items: mockCombosChar2, count: 1 },
        isLoading: false,
        isError: false,
      } as unknown as ReturnType<typeof useCombos>);

      const selector = screen.getByTestId("mock-character-selector");
      await user.click(selector);

      expect(mockedUseCombos).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 2 }),
      );
    });
  });
});
