import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import { Table, TableBody } from "@/components/ui/table";
import { DEFAULT_COLUMN_VISIBILITY } from "@/constants/combo-list";
import type { ComboDetail, ComboSummary } from "../types";
import { __resetRecipeFullViewForTest } from "./useRecipeFullView";

// ★★本テストは指示書 §5.1 の「全文表示モードのトグルが 5 面で同じ値を見ていること」を
//   固定する。チェックリスト 1-2 / 5-3 を守る唯一の機械的な網であり、
//   破壊確認 2(5 面が見る値を面ごとに分ける)が赤くなる経路そのものである。
//
// ★5 面を「本物のコンポーネントとして」同一ツリーへ並べる。部品を作り直して並べても
//   「実装が共有しているか」は分からないためである。
//
// ★★【M24-07 で是正】旧記述「4 面」は失効していた——マイコンボが漏れていた。
//   マイコンボは一覧と同じ表部品(ComboTableRow)を使うが、面としては自前のトグルを
//   置いている(MyComboPage)。⇒ 「同じ行部品を 2 回並べる」だけでは 5 面目の観測に
//   ならないため、surface-mycombo には自前のトグルを添えて「2 つ目のトグルから
//   押しても 5 面すべてへ伝わる」ことを主張させている。

vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({
    data: [{ id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" }],
  }),
  useCharacterName: () => "リュウ",
  DEFAULT_GAME_ID: 1,
}));

vi.mock("@/features/config/useConfig", () => ({
  useConfig: () => ({ data: { defaults: { characterId: 1 } } }),
}));

vi.mock("@/features/preset/api", () => ({
  usePresets: () => ({ data: [{ id: 1, code: "official_ja_move", name: "公式日本語" }] }),
}));

vi.mock("@/features/mycombo/components/CharacterSelector", () => ({
  default: () => <span data-testid="mock-character-selector">キャラ選択</span>,
}));

vi.mock("../api", () => ({
  useCombos: () => ({
    data: { items: [modalCombo], count: 1 },
    isLoading: false,
    isError: false,
  }),
  useComboRecipe: () => ({
    data: { text: RECIPE },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

const RECIPE = "ジャンプ強K > 立ち中P > 中昇龍拳";

const modalCombo = {
  id: 9,
  characterId: 1,
  isDraft: false,
  damage: 100,
  starterMoveCode: "5LP",
  defaultRecipe: RECIPE,
  stepCount: 3,
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
} as unknown as ComboSummary;

const listCombo = { ...modalCombo, id: 7 } as ComboSummary;
const compareCombo = {
  ...modalCombo,
  id: 8,
  position: "mid_screen",
  hitType: "normal",
  okiOptions: [],
  tags: [],
} as unknown as ComboDetail;

// import は vi.mock のあとに評価させる(モック対象を先に差し替える)。
import ComboTableRow from "../components/ComboTableRow";
import ComboDetailRecipe from "../components/ComboDetailRecipe";
import CompareTable from "../components/CompareTable";
import AddComboToCompareModal from "../components/AddComboToCompareModal";
import RecipeViewToggle from "../components/RecipeViewToggle";

/** 5 面 + ページ側トグル 2 つ(一覧・マイコンボ)を同じツリーへ並べる。 */
function AllSurfaces() {
  return (
    <div>
      <RecipeViewToggle surfaceDefault={false} />

      <div data-testid="surface-list">
        <Table>
          <TableBody>
            <ComboTableRow
              combo={listCombo}
              expanded={false}
              canExpand={false}
              onToggleExpand={vi.fn()}
              onDelete={vi.fn()}
              visibility={DEFAULT_COLUMN_VISIBILITY}
            />
          </TableBody>
        </Table>
      </div>

      {/* ★マイコンボは一覧と同じ ComboTableRow を使うが、トグルは自前で置く。 */}
      <div data-testid="surface-mycombo">
        <RecipeViewToggle surfaceDefault={false} />
        <Table>
          <TableBody>
            <ComboTableRow
              combo={listCombo}
              expanded={false}
              canExpand={false}
              onToggleExpand={vi.fn()}
              onDelete={vi.fn()}
              visibility={DEFAULT_COLUMN_VISIBILITY}
            />
          </TableBody>
        </Table>
      </div>

      <div data-testid="surface-detail">
        <ComboDetailRecipe comboId={8} />
      </div>

      <div data-testid="surface-compare">
        <CompareTable
          combos={[compareCombo]}
          errors={[null]}
          loadings={[false]}
          ids={[8]}
          onRemove={vi.fn()}
        />
      </div>

      <div data-testid="surface-modal">
        <AddComboToCompareModal
          open={true}
          currentIds={[]}
          onAdd={vi.fn()}
          onOpenChange={vi.fn()}
        />
      </div>
    </div>
  );
}

function renderAll() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AllSurfaces />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// モーダルは Radix の portal で body 直下へ出るため、面ごとの取り出しは testid ではなく
// role="dialog" 側から引く。
function recipeViewOf(
  surface: "list" | "mycombo" | "detail" | "compare" | "modal",
): string[] {
  if (surface === "modal") {
    const dialog = screen.getByRole("dialog");
    return within(dialog)
      .getAllByTestId("recipe-text")
      .map((e) => e.getAttribute("data-recipe-view") ?? "");
  }
  const root = screen.getByTestId(`surface-${surface}`);
  return within(root)
    .getAllByTestId("recipe-text")
    .map((e) => e.getAttribute("data-recipe-view") ?? "");
}

const SURFACES = ["list", "mycombo", "detail", "compare", "modal"] as const;

// ★クリックは fireEvent で行う。userEvent は pointer-events を検査するが、Radix Dialog は
//   開いているあいだ body へ pointer-events:none を置くため、ダイアログ外のトグルを
//   押せなくなる(実ブラウザではダイアログが前面にあるだけで、本質ではない)。
function clickToggle(el: HTMLElement) {
  fireEvent.click(el);
}

/** ダイアログの外(ページ側)に置かれたトグル。一覧の面のもの。 */
function pageToggle(): HTMLElement {
  return within(screen.getByTestId("surface-list").parentElement as HTMLElement)
    .getAllByTestId("recipe-view-toggle")[0];
}

/** マイコンボの面が自前で置いているトグル。 */
function myComboToggle(): HTMLElement {
  return within(screen.getByTestId("surface-mycombo")).getByTestId(
    "recipe-view-toggle",
  );
}

/** ダイアログの中に置かれたトグル。 */
function modalToggle(): HTMLElement {
  return within(screen.getByRole("dialog")).getByTestId("recipe-view-toggle");
}

describe("全文表示モードは 5 面で 1 つの値を共有する(M24-03 §4.1・E-76)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetRecipeFullViewForTest();
  });
  afterEach(() => {
    window.localStorage.clear();
    __resetRecipeFullViewForTest();
  });

  it("★5 面すべてにレシピが描かれている(前提の確認)", () => {
    renderAll();
    for (const s of SURFACES) {
      expect(recipeViewOf(s).length, `${s} にレシピが無い`).toBeGreaterThan(0);
    }
  });

  it("★★トグルを 1 回押すと 5 面すべてが全文表示になる", () => {
    renderAll();

    clickToggle(pageToggle());

    for (const s of SURFACES) {
      expect(
        recipeViewOf(s).every((v) => v === "full"),
        `${s} が全文表示になっていない(5 面で値を共有していない)`,
      ).toBe(true);
    }
  });

  it("★★もう一度押すと 5 面すべてが省略表示へ戻る", () => {
    renderAll();

    clickToggle(pageToggle());
    clickToggle(pageToggle());

    for (const s of SURFACES) {
      expect(
        recipeViewOf(s).every((v) => v === "compact"),
        `${s} が省略表示へ戻っていない`,
      ).toBe(true);
    }
  });

  it("★面ごとの既定: 未操作のときだけ効く(詳細のみ全文・他 4 面は省略)", () => {
    renderAll();
    expect(recipeViewOf("detail").every((v) => v === "full")).toBe(true);
    for (const s of ["list", "mycombo", "compare", "modal"] as const) {
      expect(recipeViewOf(s).every((v) => v === "compact"), `${s} の既定が省略でない`).toBe(
        true,
      );
    }
  });

  it("★一度切り替えたら、面ごとの既定より共有された値が優先する(トグルは 1 つ)", () => {
    renderAll();
    // 詳細は既定 true。押して false にすると、詳細も省略表示へ落ちる。
    clickToggle(pageToggle());
    clickToggle(pageToggle());
    expect(recipeViewOf("detail").every((v) => v === "compact")).toBe(true);
  });

  it("★★マイコンボが自前で置いたトグルからでも、5 面すべてへ同時に伝わる", () => {
    // ★★M24-07 で「4 面」が失効記述だと分かった際に足した観測。マイコンボは一覧と
    //   同じ行部品を使うが、トグルは自前で置いている。⇒ 「行部品を共有しているから
    //   自動的に及ぶ」だけでは 5 面目の主張にならないため、2 つ目のトグルから押して
    //   全面へ伝わることを直接固定する。
    renderAll();

    clickToggle(myComboToggle());

    for (const s of SURFACES) {
      expect(
        recipeViewOf(s).every((v) => v === "full"),
        `${s} へ伝わっていない(5 面で値を共有していない)`,
      ).toBe(true);
    }
  });

  it("★★比較の追加ダイアログの中で切り替えても、他の 4 面へ同時に伝わる", () => {
    // ★これが useState ではなく購読機構にした理由そのものである——/compare では
    //   比較表と追加ダイアログが同時にマウントされる。面ごとに state を持つと
    //   ダイアログ側の操作が比較表へ伝わらない(再マウントまで古い値を見る)。
    renderAll();

    clickToggle(modalToggle());

    for (const s of SURFACES) {
      expect(
        recipeViewOf(s).every((v) => v === "full"),
        `${s} へ伝わっていない(5 面で値を共有していない)`,
      ).toBe(true);
    }
  });

  it("★値は localStorage の公認キーへ保存される(台帳 #11)", () => {
    renderAll();
    clickToggle(pageToggle());
    expect(window.localStorage.getItem("recipe-full-view-v1")).toBe("true");
  });

  it("★保存済みの値は次回の描画で 5 面すべてに効く(面ごとの既定を上書きする)", () => {
    window.localStorage.setItem("recipe-full-view-v1", "true");
    __resetRecipeFullViewForTest();
    renderAll();
    for (const s of SURFACES) {
      expect(recipeViewOf(s).every((v) => v === "full"), `${s} が復元されていない`).toBe(
        true,
      );
    }
  });
});
