import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SetupInputRow } from "./SetupInputRow";
import type { CreateSetupInput } from "@/features/setup/types";
import type { Move } from "@/features/moves/types";
import { RECIPE_EMPTY_LABEL } from "../recipeDisplay";

vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: ({ onChange }: { onChange: (v: unknown[]) => void }) => (
    <div data-testid="setup-recipe-editor">
      <button type="button" onClick={() => onChange([{ moveId: 99 }])}>
        mock-add-step
      </button>
    </div>
  ),
}));

const baseValue: CreateSetupInput = {
  characterId: 1,
  name: null,
  description: null,
  steps: [],
};

// M19-07 で VerifiedConditionsField(i18n を使う)を載せたため、i18next インスタンス
// 未初期化の警告を避けてキーをそのまま返す(SetupResultGrid.test.tsx と同じ流儀)。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// M19-07: この行は親コンボが未発番の面に載るため、保存経路を叩いてはならない
// (DES-005 §5.6 の v3 原則。即時保存は M19-01 の再発)。fetch を監視して固定する。
const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

afterEach(() => vi.clearAllMocks());

describe("SetupInputRow", () => {
  it("名前を入力すると onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <SetupInputRow
        value={baseValue}
        onChange={onChange}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("セットプレイ名"), {
      target: { value: "テスト名" },
    });
    expect(onChange).toHaveBeenCalledWith({ ...baseValue, name: "テスト名" });
  });

  it("名前を空にすると null が渡される", () => {
    const onChange = vi.fn();
    render(
      <SetupInputRow
        value={{ ...baseValue, name: "既存名" }}
        onChange={onChange}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("セットプレイ名"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: null }),
    );
  });

  it("説明を入力すると onChange が呼ばれる", () => {
    const onChange = vi.fn();
    render(
      <SetupInputRow
        value={baseValue}
        onChange={onChange}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("説明（省略可）"), {
      target: { value: "テスト説明" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      description: "テスト説明",
    });
  });

  it("削除ボタンで onRemove が呼ばれる", () => {
    const onRemove = vi.fn();
    render(
      <SetupInputRow
        value={baseValue}
        onChange={vi.fn()}
        onRemove={onRemove}
        characterId={1}
        index={0}
      />,
    );
    fireEvent.click(screen.getByText("削除"));
    expect(onRemove).toHaveBeenCalled();
  });

  it("SetupRecipeEditor が描画される", () => {
    render(
      <SetupInputRow
        value={baseValue}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
      />,
    );
    expect(screen.getByTestId("setup-recipe-editor")).toBeDefined();
  });

  it("index に応じたラベルが表示される", () => {
    render(
      <SetupInputRow
        value={baseValue}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        characterId={1}
        index={2}
      />,
    );
    expect(screen.getByText("セットプレイ 3")).toBeDefined();
  });

  // M15-05 追補: moves 伝播 → 技名1行サマリ表示(⑩ 一目で分かる欄)の結線回帰。
  it("moves を受け取ると steps を技名1行サマリで表示する", () => {
    const moves: Move[] = [
      {
        id: 10,
        characterId: 1,
        code: "2MK",
        category: "normal",
        isAerial: false,
        setupOnly: false,
        isDerived: false,
        nameJa: "中足",
      } as Move,
    ];
    render(
      <SetupInputRow
        value={{ ...baseValue, steps: [{ moveId: 10 }] }}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
        moves={moves}
      />,
    );
    expect(
      screen.getByTestId("setup-input-recipe-summary-0").textContent,
    ).toBe("中足");
  });

  it("steps 空ではサマリにプレースホルダを表示する", () => {
    render(
      <SetupInputRow
        value={baseValue}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        characterId={1}
        index={0}
        moves={[]}
      />,
    );
    expect(
      screen.getByTestId("setup-input-recipe-summary-0").textContent,
    // ★M24-07: 空表示の文言を既存定数 RECIPE_EMPTY_LABEL へ寄せた
    //   (半角括弧の `(レシピ未入力)` は廃止)。★リテラルではなく定数を主張する
    //   ——正典が動いたときにテストが一緒に動く形にしておくため。
    ).toContain(RECIPE_EMPTY_LABEL);
  });

  // ★M19-07: 同梱セットプレイの「確認できた条件」。
  // 保存はコンボ作成と同一 Tx で行うため、この行では一切保存しない(v3 原則)。
  describe("成立条件のステージング入力(M19-07)", () => {
    it("2×2 グリッドが出る", () => {
      render(
        <SetupInputRow
          value={baseValue}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          characterId={1}
          index={0}
        />,
      );
      expect(screen.getByTestId("setup-input-confirmed-0")).toBeDefined();
      for (const key of [
        "neutral_tech:false",
        "neutral_tech:true",
        "back_tech:false",
        "back_tech:true",
      ]) {
        expect(screen.getByTestId(`setup-input-confirmed-0-${key}`)).toBeDefined();
      }
    });

    it("★既定は全セル未チェック", () => {
      render(
        <SetupInputRow
          value={baseValue}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          characterId={1}
          index={0}
        />,
      );
      const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      expect(boxes).toHaveLength(4);
      expect(boxes.every((b) => !b.checked)).toBe(true);
    });

    it("★チェックは CreateSetupInput.verifiedConditions にステージングされる(即時保存しない)", () => {
      const onChange = vi.fn();
      render(
        <SetupInputRow
          value={baseValue}
          onChange={onChange}
          onRemove={vi.fn()}
          characterId={1}
          index={0}
        />,
      );

      fireEvent.click(screen.getByTestId("setup-input-confirmed-0-neutral_tech:false"));

      expect(onChange).toHaveBeenCalledWith({
        ...baseValue,
        verifiedConditions: [{ techType: "neutral_tech", inCorner: false }],
      });
      // 保存経路(fetch)は一切叩かれない。この行は親コンボが未発番の面に載る。
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("index ごとに testid が分かれる(複数行が混ざらない)", () => {
      render(
        <SetupInputRow
          value={baseValue}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          characterId={1}
          index={2}
        />,
      );
      expect(screen.getByTestId("setup-input-confirmed-2")).toBeDefined();
      expect(screen.queryByTestId("setup-input-confirmed-0")).toBeNull();
    });
  });
});
