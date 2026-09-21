import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { SetupCandidateList } from "./SetupCandidateList";
import type { SetupSummary } from "../types";

const mockMutate = vi.fn();

vi.mock("../hooks/useSetupLinks", () => ({
  useCreateSetupLink: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

// ★M24-05: 見出しは defaultValue を廃し ja/en の実キーへ移した(旧実装は
//   locales に存在しないキーを defaultValue で描いていた)。
//   ⇒ モックもキー + 補間値を返す形にし、count が渡っていることを検証できる形を保つ。
//   ★M24-07: 本部品の残りの直書き(候補名のフォールバック / ステップ数 / 紐付けボタン)も
//     locale へ移した。モックは補間値を「キー#値」で返す形のまま、id / stepCount も
//     見えるようにして「どの値が渡ったか」を検証できる形を保つ。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; id?: number; stepCount?: number }) => {
      const v = opts?.count ?? opts?.id ?? opts?.stepCount;
      return v === undefined ? key : `${key}#${v}`;
    },
  }),
}));

const makeCandidate = (id: number, name?: string): SetupSummary => ({
  id,
  characterId: 1,
  name: name ?? `候補${id}`,
  description: null,
  stepCount: 3,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [2],
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => vi.clearAllMocks());

describe("SetupCandidateList", () => {
  it("候補リストを描画する", () => {
    render(
      <SetupCandidateList
        parentComboId={1}
        candidates={[makeCandidate(10), makeCandidate(20)]}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("候補10")).toBeTruthy();
    expect(screen.getByText("候補20")).toBeTruthy();
    expect(screen.getByText("comboDetail.setups.candidatesHeading#2")).toBeTruthy();
  });

  it("紐付けボタン押下で mutate が呼ばれる", () => {
    render(
      <SetupCandidateList
        parentComboId={1}
        candidates={[makeCandidate(10)]}
      />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByText("setup.candidate.linkToThisCombo"));
    expect(mockMutate).toHaveBeenCalledWith(
      { comboId: 1, setupId: 10 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("name が null の場合はフォールバック表示", () => {
    const candidate = makeCandidate(5);
    candidate.name = null;
    render(
      <SetupCandidateList
        parentComboId={1}
        candidates={[candidate]}
      />,
      { wrapper: createWrapper() },
    );
    // ★キーに id が付く形＝フォールバックへ落ちて id が渡っていることの観測。
    expect(screen.getByText("setup.candidate.fallbackName#5")).toBeTruthy();
  });

  // ★★M24-05 §4.1 / 破壊確認 2: 候補 0 件でもセクションと「候補はありません」を出す。
  //   「既存から紐付け」を撤去したため、0 件で何も出さないと紐付けの面が画面から
  //   丸ごと消え、「機能が無くなった」と読まれる(D-588)。
  it("候補 0 件でもセクションと『候補はありません』を出す", () => {
    render(
      <SetupCandidateList
        parentComboId={1}
        candidates={[]}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("setup-candidates")).toBeTruthy();
    expect(screen.getByText("comboDetail.setups.candidatesHeading#0")).toBeTruthy();
    expect(screen.getByTestId("setup-candidates-empty").textContent).toBe(
      "comboDetail.setups.candidatesEmpty",
    );
  });

  // ★レシピが共通部品 RecipeText を通っていることを固定する(§4.2)。
  //   通していないと data-testid="recipe-text" が出ない。
  it("レシピを RecipeText で描く", () => {
    render(
      <SetupCandidateList parentComboId={1} candidates={[makeCandidate(10)]} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("recipe-text").textContent).toBe("↓↘→P");
  });
});
