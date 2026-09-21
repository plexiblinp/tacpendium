import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { SetupRecipeEditor } from "./SetupRecipeEditor";
import type { SetupStepInput } from "../types";

import "@/lib/i18n";
import { RECIPE_STEPS_EMPTY_LABEL } from "@/features/combo/recipeDisplay";

vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: vi.fn(),
  // ★M30-01(SM-100): 全技一覧の「ボタンで入力できる技を省く」トグルが
  //   仮想コントローラと同じ解決表を引く。本テストは省く挙動を見ないため空で足りる。
  useCommandIndex: () => ({ data: undefined }),
}));

import { useMovesByCharacter } from "@/features/moves/api";
const mockUseMoves = vi.mocked(useMovesByCharacter);

// ★★M31-06: モックが受け取った「面」を記録する。
//   ★★★型が止められるのは**渡し忘れ**だけである。`context="setup"` を `"combo"` へ
//     **倒した**場合は型検査を通り、実データの setup_only が 0 件のあいだは
//     他のどのテストも緑のまま通る。⇒ セットプレイ側の面が静かに減る
//     （本サブ最大の事故の形）。ここがその床である。
//   ★モックは外さない —— 外すと同ファイルの既存 14 本の前提が変わる。
//   ★vi.hoisted で作る（vi.mock のファクトリは import より上へ巻き上がるため）。
const mockVcProps = vi.hoisted(() => ({
  context: undefined as string | undefined,
}));

vi.mock(
  "@/features/combo/components/VirtualController/VirtualController",
  () => ({
    VirtualController: ({
      onStepAdd,
      onStepDelete,
      context,
    }: {
      onStepAdd: (s: { moveId?: number }) => void;
      onStepDelete: () => void;
      context?: string;
    }) => {
      mockVcProps.context = context;
      return React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          { onClick: () => onStepAdd({ moveId: 99 }) },
          "VC追加",
        ),
        React.createElement(
          "button",
          { onClick: () => onStepDelete() },
          "VC削除",
        ),
      );
    },
  }),
);

vi.mock("@/features/combo/components/ModifiersEditor", () => ({
  ModifiersEditor: ({
    onSave,
    onClose,
  }: {
    stepIndex: number;
    onSave: (idx: number, mods: unknown) => void;
    onClose: () => void;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        { onClick: () => onSave(0, { flags: ["test"] }) },
        "モディファイア保存",
      ),
      React.createElement("button", { onClick: onClose }, "モディファイア閉じる"),
    ),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  mockUseMoves.mockReturnValue({ data: [], isLoading: false } as never);
});

afterEach(() => vi.clearAllMocks());

describe("SetupRecipeEditor", () => {
  it("steps が空のとき空ステップのラベルを表示", () => {
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    // ★★M29-01: 文言ではなく data-testid で掴む(M27-03 教訓 7)。
    //   文面そのものは源泉の定数で主張する。
    const empty = screen.getByTestId("setup-recipe-steps-empty");
    expect(empty.textContent).toBe(RECIPE_STEPS_EMPTY_LABEL);
  });

  it("VC追加でステップが追加される", () => {
    const onChange = vi.fn();
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByText("VC追加"));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ moveId: 99 })]),
    );
  });

  it("VC削除でステップが末尾から削除される", () => {
    const onChange = vi.fn();
    const steps: SetupStepInput[] = [{ moveId: 1 }, { moveId: 2 }];
    render(
      <SetupRecipeEditor characterId={1} steps={steps} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByText("VC削除"));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ moveId: 1 })]);
  });

  it("削除ボタンでステップが削除される", () => {
    const onChange = vi.fn();
    const steps: SetupStepInput[] = [{ moveId: 1 }, { moveId: 2 }];
    render(
      <SetupRecipeEditor characterId={1} steps={steps} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    const deleteButtons = screen.getAllByText("削除");
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it("ステップが1件以上あるとき「編集ボタンについて」+ info-mark が描画される", () => {
    const steps: SetupStepInput[] = [{ moveId: 1 }];
    render(
      <SetupRecipeEditor characterId={1} steps={steps} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("編集ボタンについて")).toBeDefined();
    expect(screen.getByTestId("info-mark-setup-recipe-modifier")).toBeDefined();
  });

  it("ステップが0件のときは「編集ボタンについて」+ info-mark を表示しない", () => {
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByText("編集ボタンについて")).toBeNull();
    expect(screen.queryByTestId("info-mark-setup-recipe-modifier")).toBeNull();
  });

  it("技ステップは技コードではなく日本語名(nameJa)で表示される", () => {
    mockUseMoves.mockReturnValue({
      data: [
        {
          id: 5,
          characterId: 1,
          code: "standing_light_punch",
          category: "normal",
          nameJa: "立ち弱P",
        },
      ],
      isLoading: false,
    } as never);
    const steps: SetupStepInput[] = [{ moveId: 5 }];
    render(
      <SetupRecipeEditor characterId={1} steps={steps} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getAllByText("立ち弱P").length).toBeGreaterThan(0);
    expect(screen.queryByText("standing_light_punch")).toBeNull();
  });

  it("notes が 50 文字を超えると console.warn が発火する", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const longNotes = "a".repeat(51);
    const steps: SetupStepInput[] = [
      { moveId: undefined, modifiers: { notes: longNotes } },
    ];
    render(
      <SetupRecipeEditor characterId={1} steps={steps} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("SetupRecipeEditor dash は system move 一本化(M16-04)", () => {
  it("dash は「システム」optgroup(moveId)から載り、非技 optgroup には現れない", () => {
    // dash は system move(category=system の move)として渡す。
    mockUseMoves.mockReturnValue({
      data: [
        { id: 60, characterId: 1, code: "dash_forward", category: "system", nameJa: "前ダッシュ" },
      ],
      isLoading: false,
    } as never);
    const onChange = vi.fn();
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    const select = screen.getByTestId("recipe-move-select");
    // 非技 optgroup(modifiers.type)には dash 選択肢が無い(撤去済み)。
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(values).not.toContain("nonmove:dash_forward");
    // dash は「システム」optgroup の system move(moveId)として選ぶ。
    fireEvent.change(select, { target: { value: "60" } });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    // system move step として moveId のみで載る(modifiers.type dash にならない)。
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ moveId: 60, modifiers: undefined }),
    ]);
  });

  it("parry_drive_rush は従来どおり modifiers.type で載る(不変)", () => {
    mockUseMoves.mockReturnValue({ data: [], isLoading: false } as never);
    const onChange = vi.fn();
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    fireEvent.change(screen.getByTestId("recipe-move-select"), {
      target: { value: "nonmove:parry_drive_rush" },
    });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ moveId: undefined, modifiers: { type: "parry_drive_rush" } }),
    ]);
  });
});

describe("★セットプレイ面の SM-100(M30-01 レビュー 中-4)", () => {
  // ★コンボのレシピ入力面と同じ部品・同じフックを使うが、片面だけ壊れても
  //   もう片方のテストは緑のままである。⇒ 両面に観測を置く(部品コメントの警告そのもの)。
  const MOVES = [
    {
      id: 1,
      characterId: 1,
      code: "standing_light_punch",
      category: "normal",
      nameJa: "立ち弱P",
      isAerial: false,
      setupOnly: false,
      isDerived: false,
    },
    {
      id: 4,
      characterId: 1,
      // ★★【2026-09-10 更新・M30-03】省かれない側の代表を差し替えた。
      //   M30-02 は A1(`sonic_break`)→ A2 へ替えたが、その A2 も本サブで
      //   必殺技タブへ載るようになった。⇒ **必殺技はもう代表になれない。**
      //   ★区分 E(共通技 13 code 以外の投げ)を採る。
      code: "german_suplex",
      category: "throw",
      nameJa: "ジャーマンスープレックス",
      isAerial: false,
      setupOnly: false,
      isDerived: false,
    },
  ];

  function renderWithMoves() {
    mockUseMoves.mockReturnValue({ data: MOVES, isLoading: false } as never);
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    return screen.getByTestId("recipe-move-select") as HTMLSelectElement;
  }

  function optionLabels(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map((o) => o.textContent ?? "");
  }

  it("トグルが出て、既定は OFF である", () => {
    renderWithMoves();
    const toggle = screen.getByTestId(
      "recipe-omit-surfaced-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it("★ON にするとボタンで押せる技だけが省かれ、未掲載の技は残る", () => {
    const select = renderWithMoves();
    fireEvent.click(screen.getByTestId("recipe-omit-surfaced-toggle"));
    expect(optionLabels(select)).not.toContain("立ち弱P");
    expect(optionLabels(select)).toContain("ジャーマンスープレックス");
  });

  it("★消えた選択は残らない(高-4 と同じ形をこちらの面でも見る)", () => {
    // ★★`select.value` だけを見ないこと —— option が DOM から消えると
    //   `<select>` の value はブラウザ側の既定でも "" になるため、
    //   状態が残っていても緑になる(実測。M30-01 レビュー 高-4 の破壊確認で判明)。
    //   ⇒ 「積めなくなる」ことまで主張する。
    const onChange = vi.fn();
    mockUseMoves.mockReturnValue({ data: MOVES, isLoading: false } as never);
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={onChange} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "1" } });

    const add = screen.getByRole("button", { name: "ステップ追加" });
    expect(add.hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByTestId("recipe-omit-surfaced-toggle"));

    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.click(add);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ★★★M31-06 レビュー 高-2 派生: セットプレイ側の配線の床。
//
//   ★★型は「面を渡し忘れること」しか止めない。⇒ `SetupRecipeEditor` の `"setup"` を
//     `"combo"` へ**倒した**場合は型検査も通り、`pnpm test` も `make e2e` も緑のままである
//     (実データの `setup_only` が 0 件で、同ファイルに fixture が無かったため)。
//   ★★★本サブ最大の事故の形が「セットプレイからも消える」ことである以上、
//     **この面に 1 本テストが要る。** フック単体の対照では配線を守れない。
describe("★★SetupRecipeEditor — setup_only の技はこの面に出る(M31-06)", () => {
  const SETUP_ONLY_MOVES = [
    {
      id: 1,
      characterId: 1,
      code: "standing_light_punch",
      category: "normal",
      nameJa: "立ち弱P",
      isAerial: false,
      setupOnly: false,
      isDerived: false,
    },
    {
      id: 7,
      characterId: 1,
      code: "su_trap_light",
      category: "special",
      nameJa: "弱トラップ",
      isAerial: false,
      // ★★ここが本テストの肝である。⇒ コンボ側なら落ちる技を、この面では出す。
      setupOnly: true,
      isDerived: false,
    },
  ];

  it("★★全技プルダウンに setup_only の技が並ぶ(面を combo へ倒すと赤になる)", () => {
    mockUseMoves.mockReturnValue({
      data: SETUP_ONLY_MOVES,
      isLoading: false,
    } as never);
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent ?? "");
    expect(labels.join("|")).toContain("弱トラップ");
    // ★対照: 同じ面に居る普通の技も並んでいる(プルダウンごと空になっていない)。
    expect(labels.join("|")).toContain("立ち弱P");
  });
});

// ★★★M31-06 追補: セットプレイ側の配線の床（レビュー 高-2 派生の残り）。
describe("★★SetupRecipeEditor — 仮想コントローラへ渡す面(M31-06)", () => {
  it('★VirtualController へ context="setup" を渡している', () => {
    mockVcProps.context = undefined;
    render(
      <SetupRecipeEditor characterId={1} steps={[]} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    // ★★"combo" へ倒すとここが赤になる。⇒ タブの中身は
    //   VirtualController.test.tsx の「setup_only の配線」describe が持つ。
    expect(mockVcProps.context).toBe("setup");
  });
});
