import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";
import ComboDetailPage from "./ComboDetailPage";

const mockComboData = {
  id: 1, characterId: 1, isDraft: false, stepCount: 2, version: 1,
  createdAt: "", updatedAt: "", tags: [], steps: [],
  setups: [],
};

const mockUseCombo = vi.fn();
const mockUseSetupCandidates = vi.fn();

vi.mock("@/features/combo/api", () => ({
  useCombo: (...args: unknown[]) => mockUseCombo(...args),
  useDeleteCombo: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/features/setup/hooks/useSetupCandidates", () => ({
  useSetupCandidates: (...args: unknown[]) => mockUseSetupCandidates(...args),
}));

vi.mock("@/features/combo/components/ComboDetailHeader", () => ({
  default: () => React.createElement("div", null, "Header"),
}));
vi.mock("@/features/combo/components/ComboDetailMetadata", () => ({
  default: () => React.createElement("div", null, "Metadata"),
}));
vi.mock("@/features/combo/components/ComboDetailRecipe", () => ({
  default: () => React.createElement("div", null, "Recipe"),
}));
vi.mock("@/features/combo/components/PromoteToFinalButton", () => ({
  PromoteToFinalButton: () => null,
}));
vi.mock("@/features/setup/components/SetupAccordionItem", () => ({
  SetupAccordionItem: () => null,
}));
vi.mock("@/features/setup/components/SetupCandidateList", () => ({
  SetupCandidateList: ({ candidates }: { candidates: unknown[] }) =>
    React.createElement("div", { "data-testid": "candidate-list" }, `候補 ${candidates.length} 件`),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ★★M27-03 レビュー(低-1): 「一覧へ飛ばない」だけでは、leaveBack を丸ごと消して
//   e.preventDefault() だけ残した実装でも緑になる(＝リンクが死ぬ形を検出しない)。
//   ⇒ 実際に leaveBack が呼ばれたことを主張する。
const mockLeaveBack = vi.fn();
vi.mock("@/features/navigation-guard/useUnsavedChangesGuard", async (orig) => {
  const actual = await orig<
    typeof import("@/features/navigation-guard/useUnsavedChangesGuard")
  >();
  return {
    ...actual,
    useLeaveWithoutConfirm: () => ({ leaveTo: vi.fn(), leaveBack: mockLeaveBack }),
  };
});

function renderPage(state?: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider, { client: qc },
      React.createElement(
        MemoryRouter,
        { initialEntries: [{ pathname: "/combos/1", state: state ?? null }] },
        // ★M27-03: 「戻る」が useLeaveWithoutConfirm を通るため、Provider の内側で描く。
        React.createElement(NavigationGuardProvider, null,
          React.createElement(Routes, null,
            React.createElement(Route, {
              path: "/combos/:id",
              element: React.createElement(ComboDetailPage),
            }),
            // ★着地先の目印。ヘッダのナビにも「コンボ一覧」の文言が在るため、
            //   文言ではなく testid で見る(文言で見ると常に一致して空振りする)。
            React.createElement(Route, {
              path: "/combos",
              element: React.createElement("div", {
                "data-testid": "combo-list-route",
              }),
            }),
          ),
        ),
      ),
    ),
  );
}

afterEach(() => vi.clearAllMocks());

describe("ComboDetailPage — 候補セクション", () => {
  it("候補あり時にセクションが表示される", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({
      data: [
        { id: 10, characterId: 1, name: "候補1", stepCount: 2, version: 1, defaultRecipe: "", parentComboIds: [2] },
      ],
      isLoading: false,
    });

    renderPage();
    expect(screen.getByTestId("candidate-list")).toBeTruthy();
    expect(screen.getByText("候補 1 件")).toBeTruthy();
  });

  // ★★M24-05 §4.1: 挙動が反転した。旧テストは「0 件ならセクションを出さない」を
  //   固定していたが、「既存から紐付け」を撤去した以上、0 件で何も出さないと
  //   画面から紐付けの面が丸ごと消える。⇒ 0 件でも出すことを固定する。
  it("候補 0 件でもセクションを出す(D-588)", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });

    renderPage();
    expect(screen.getByTestId("candidate-list")).toBeTruthy();
    expect(screen.getByText("候補 0 件")).toBeTruthy();
  });

  // ★★撤去そのものを固定する(§4.1・CO-002)。これが無いと、あとから
  //   「入口が消えるから戻そう」でボタンが復活しても誰も気づけない。
  it("「既存から紐付け」ボタンが存在しない", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });

    renderPage();
    expect(screen.queryByText("既存から紐付け")).toBeNull();
  });

  it("候補 undefined 時(読込中)はセクションを出さない", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: undefined, isLoading: true });

    renderPage();
    expect(screen.queryByTestId("candidate-list")).toBeNull();
  });
});

// ★★M27-03(combo-detail-back-link-is-hardcoded): 「戻る」の行き先。
//
// 着手前は `<Link to="/combos">` のハードコードで、どこから来ても一覧へ着地していた
// (「比較 → 詳細 → 戻る → 一覧」で違和感が出る＝開発者の手動確認 2026-08-26)。
//
// ★判定材料は react-router v6 が history.state に持つ `idx` である。
//   0 なら「このタブでの最初のエントリ」＝戻り先が無い。
describe("ComboDetailPage — 戻る の行き先(M27-03)", () => {
  function setHistoryIdx(idx: number | undefined) {
    window.history.replaceState(idx === undefined ? null : { idx }, "");
  }

  afterEach(() => {
    setHistoryIdx(undefined);
    mockLeaveBack.mockClear();
  });

  it("★履歴が無いとき(直接 URL で開いた)は一覧へ行く＝href がフォールバックになる", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });
    setHistoryIdx(0);

    renderPage();
    fireEvent.click(screen.getByTestId("combo-detail-back"));

    expect(screen.getByTestId("combo-list-route")).toBeTruthy();
    // ★履歴が無いときは leaveBack を呼ばない(href の遷移に任せる)。
    expect(mockLeaveBack).not.toHaveBeenCalled();
  });

  it("★履歴が在るときは一覧へ飛ばない(既定の遷移を止めて履歴を戻る)", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });
    setHistoryIdx(2);

    renderPage();
    fireEvent.click(screen.getByTestId("combo-detail-back"));

    // ★「一覧が出ていない」ことを見る。history.go(-1) の着地先は jsdom では
    //   観測できないが、**ハードコードの /combos へ行かなくなった**ことが本件の要である。
    expect(screen.queryByTestId("combo-list-route")).toBeNull();
    // ★★「一覧へ行かない」だけでは足りない。実際に履歴を戻る入口を通ったことを見る。
    expect(mockLeaveBack).toHaveBeenCalledTimes(1);
  });

  // ★★M27-03 追補: 保存直後に来たときは履歴を戻らない(保存済みのフォームへ
  //   再入場してしまうため)。目印は保存後の遷移が渡す location.state.fromSave。
  it("★保存直後に来たときは履歴を戻らず一覧へ行く", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });
    setHistoryIdx(3); // 履歴は在る。それでも戻らないことを見る。

    renderPage({ fromSave: true });
    fireEvent.click(screen.getByTestId("combo-detail-back"));

    expect(screen.getByTestId("combo-list-route")).toBeTruthy();
    expect(mockLeaveBack).not.toHaveBeenCalled();
  });

  it("★href は残す(中クリック・別タブで開くを壊さない)", () => {
    mockUseCombo.mockReturnValue({ data: mockComboData, isLoading: false, isError: false });
    mockUseSetupCandidates.mockReturnValue({ data: [], isLoading: false });

    renderPage();
    expect(
      screen.getByTestId("combo-detail-back").getAttribute("href"),
    ).toBe("/combos");
  });
});
