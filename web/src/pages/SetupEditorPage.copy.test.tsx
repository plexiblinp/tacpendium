import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

import { SetupEditorPage } from "./SetupEditorPage";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// ★★M24-05(SM-011): セットプレイ編集のコピー。
//   コンボ側と同じ作法(?copyFrom= で新規登録モードへ初期値を投入)であることと、
//   成立条件を引き継がないことを固定する。

const mockComboData = { id: 5, characterId: 1 };

// コピー元。親コンボを 2 つ持つ——「先頭を採る」を検証するためである。
const sourceSetup = {
  id: 3,
  characterId: 1,
  name: "コピー元セットプレイ",
  description: "元の説明",
  steps: [{ moveId: 11, modifiers: { flags: ["just"] } }],
  version: 2,
  defaultRecipe: "↓↘→P",
  parentComboIds: [7, 9],
  stepCount: 1,
  createdAt: "",
  updatedAt: "",
};

// 親が 1 つも無いセットプレイ(導線を出さない側)。
const orphanSetup = { ...sourceSetup, id: 4, parentComboIds: [] as number[] };

let setupById: Record<number, unknown> = {};

vi.mock("@/features/combo/api", async (importActual) => {
  const actual = await importActual<typeof import("@/features/combo/api")>();
  return {
    ...actual,
    useCombo: vi.fn(() => ({ data: mockComboData, isLoading: false, isError: false })),
  };
});

vi.mock("@/features/setup/hooks/useSetup", () => ({
  useSetup: vi.fn((id: number | null) => ({
    data: id == null ? undefined : setupById[id],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/features/setup/hooks/useCreateSetup", () => ({
  useCreateSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock("@/features/setup/hooks/useUpdateSetup", () => ({
  useUpdateSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// 名前・説明の投入結果を読むためのスタブ(実フォームは i18n と入力欄を持つ)。
vi.mock("@/features/setup/components/SetupBasicInfoForm", () => ({
  SetupBasicInfoForm: ({
    name,
    description,
  }: {
    name: string | null;
    description: string | null;
  }) => (
    <div>
      <span data-testid="name-value">{name ?? ""}</span>
      <span data-testid="description-value">{description ?? ""}</span>
    </div>
  ),
}));

// レシピは steps の件数だけ読めれば足りる。
vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: ({ steps }: { steps: unknown[] }) => (
    <span data-testid="steps-count">{steps.length}</span>
  ),
}));

// ★M24-07: 本画面を i18n 化した。モックはキーを返す形のままだが、補間値も
//   「キー#値」で見えるようにする——コピー元 ID が渡っていることを検証するため。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { id?: number }) =>
      opts?.id === undefined ? key : `${key}#${opts.id}`,
  }),
}));

function renderAt(path: string, routePattern: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider, { client: qc },
      React.createElement(
        MemoryRouter, { initialEntries: [path] },
        React.createElement(NavigationGuardProvider, null,
          React.createElement(Routes, null,
            React.createElement(Route, {
              path: routePattern,
              element: React.createElement(SetupEditorPage),
            }),
          ),
        ),
      ),
    ),
  );
}

afterEach(() => {
  setupById = {};
  vi.clearAllMocks();
});

describe("SetupEditorPage — コピー(SM-011)", () => {
  it("編集モードにコピー導線があり、先頭の親コンボへ向く", () => {
    setupById = { 3: sourceSetup };
    renderAt("/setups/3", "/setups/:setupId");
    const link = screen.getByTestId("setup-editor-copy");
    // ★親が複数あり得るため先頭を採る(DES-005 §5.9 の既存規則)。
    expect(link.getAttribute("href")).toBe("/combos/7/setups/new?copyFrom=3");
  });

  it("親コンボが 1 つも無ければコピー導線を出さない", () => {
    setupById = { 4: orphanSetup };
    renderAt("/setups/4", "/setups/:setupId");
    // ★VAL-S05 が親コンボ ID 必須のため、親が無いと作成そのものが成立しない。
    expect(screen.queryByTestId("setup-editor-copy")).toBeNull();
  });

  it("新規登録モードではコピー導線を出さない", () => {
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    expect(screen.queryByTestId("setup-editor-copy")).toBeNull();
  });

  it("コピー先では名前・説明・レシピが投入される", () => {
    setupById = { 3: sourceSetup };
    renderAt("/combos/7/setups/new?copyFrom=3", "/combos/:comboId/setups/new");
    expect(screen.getByTestId("name-value").textContent).toBe("コピー元セットプレイ");
    expect(screen.getByTestId("description-value").textContent).toBe("元の説明");
    expect(screen.getByTestId("steps-count").textContent).toBe("1");
  });

  it("コピー先のタイトルにコピー元が出る", () => {
    setupById = { 3: sourceSetup };
    renderAt("/combos/7/setups/new?copyFrom=3", "/combos/:comboId/setups/new");
    expect(screen.getByText("setup.editor.createFromCopyTitle#3")).toBeTruthy();
  });

  // ★★DES-005 §5.6:「コピー時は成立条件を引き継がない(全セル未検証で開始)」。
  //   引き継ぐと、未検証のものが検証済みに見える——この誤認のほうが手間より害が大きい。
  it("コピーでも成立条件は全セル未検証で始まる", () => {
    setupById = { 3: sourceSetup };
    renderAt("/combos/7/setups/new?copyFrom=3", "/combos/:comboId/setups/new");
    // 面そのものは出る(新規登録の面であるため。§1.6-2 の「編集画面には置かない」とは別)。
    expect(screen.getByTestId("setup-editor-confirmed")).toBeTruthy();
    // 受け身 2 × 端 2 = 4 セルすべてが未チェックであること。
    for (const tech of ["neutral_tech", "back_tech"]) {
      for (const corner of ["false", "true"]) {
        const cell = screen.getByTestId(
          `setup-editor-confirmed-${tech}:${corner}`,
        ) as HTMLInputElement;
        expect(cell.checked).toBe(false);
      }
    }
  });

  // ★★M24-05 §3.4 / レビュー 中-3: コピー元を投入したあと、離脱ガードの基準値を
  //   採り直していることを観測する。採り直さないと「読み込みが終わった瞬間に
  //   入力が変わったことになり、何も触っていないのに離脱確認が出る」。
  //   ★この 1 ケースが無いと、setDirtyBaseline の行を消しても全テストが緑のままになる。
  it("コピー直後は離脱ガードが張られない(基準値を採り直している)", () => {
    setupById = { 3: sourceSetup };
    renderAt("/combos/7/setups/new?copyFrom=3", "/combos/:comboId/setups/new");
    // 投入は済んでいる。
    expect(screen.getByTestId("name-value").textContent).toBe("コピー元セットプレイ");
    // それでもガードは張られていない(＝現在値と基準値が一致している)。
    expect(screen.queryByTestId("unsaved-changes-armed")).toBeNull();
  });

  it("copyFrom が無ければ何も投入しない(素の新規登録)", () => {
    setupById = { 3: sourceSetup };
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    expect(screen.getByTestId("name-value").textContent).toBe("");
    expect(screen.getByTestId("steps-count").textContent).toBe("0");
    expect(screen.getByText("setup.editor.createTitle")).toBeTruthy();
  });

  it("編集モードでは copyFrom を見ない(自分自身を読み直さない)", () => {
    setupById = { 3: sourceSetup };
    renderAt("/setups/3?copyFrom=4", "/setups/:setupId");
    expect(screen.getByText("setup.editor.editTitle")).toBeTruthy();
    expect(screen.getByTestId("name-value").textContent).toBe("コピー元セットプレイ");
  });
});
