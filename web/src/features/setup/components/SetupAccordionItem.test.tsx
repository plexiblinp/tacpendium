import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

import ja from "@/locales/ja.json";
import { SetupAccordionItem } from "./SetupAccordionItem";
import type { SetupSummary } from "../types";

// ★M23-07 §5.2-10 / M23-04 教訓 2: キー返しモックにしない。実 ja.json を引く t に
//   することで、キーは通っているが文面が抜けている状態をテストが検出できる。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const raw = key
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], ja);
      if (typeof raw !== "string") return key;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    },
  }),
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetup: SetupSummary = {
  id: 1,
  characterId: 1,
  name: "テストセットプレイ",
  description: "説明文",
  stepCount: 3,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [10],
};

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(MemoryRouter, {}, children),
    );
}

function renderItem(props?: {
  onEdit?: () => void;
  comboId?: number;
  setup?: SetupSummary;
  onDelete?: (setup: SetupSummary, unlinkAlso: boolean) => void;
}) {
  const onUnlink = vi.fn();
  const onResultsChanged = vi.fn();
  const result = render(
    <SetupAccordionItem
      setup={props?.setup ?? mockSetup}
      onUnlink={onUnlink}
      onEdit={props?.onEdit}
      comboId={props?.comboId}
      onResultsChanged={onResultsChanged}
      onDelete={props?.onDelete}
    />,
    { wrapper: createWrapper() },
  );
  return { ...result, onUnlink, onResultsChanged };
}

afterEach(() => vi.clearAllMocks());

describe("SetupAccordionItem", () => {
  // C-13: 展開機構(アコーディオン)を撤去し、レシピ等を常時表示する。
  it("レシピと紐付け解除ボタンがクリックなしで常時表示される", () => {
    renderItem();
    expect(screen.getByText("テストセットプレイ", { exact: false })).toBeTruthy();
    expect(screen.getByText("レシピ")).toBeTruthy();
    expect(screen.getByText("↓↘→P")).toBeTruthy();
    expect(screen.getByText("紐付け解除")).toBeTruthy();
  });

  // ★★M24-05 §4.2: レシピが共通部品 RecipeText を通っていることを固定する。
  //   これが無いと、直書きの `{setup.defaultRecipe || "（レシピなし）"}` へ差し戻しても
  //   全テストが緑のままになる(レビュー 中-1)。
  it("レシピは RecipeText を通り、全文表示で描かれる", () => {
    renderItem();
    const recipe = screen.getByTestId("recipe-text");
    expect(recipe.textContent).toContain("↓↘→P");
    // ★fullView 固定 true。DES-005 §5.6 項目10 が「全文〔複数行折返し〕表示」と定める。
    expect(recipe.getAttribute("data-recipe-view")).toBe("full");
  });

  it("開閉トグル(aria-expanded を持つボタン)が存在しない", () => {
    renderItem();
    expect(document.querySelector("button[aria-expanded]")).toBeNull();
    expect(document.querySelector("button[data-state='closed']")).toBeNull();
  });

  it("行ヘッダークリックで編集/詳細画面へ遷移する", async () => {
    const user = userEvent.setup();
    renderItem();
    const rowButton = screen.getByText("テストセットプレイ", { exact: false }).closest("[role=button]") as HTMLElement;
    await user.click(rowButton);
    expect(mockNavigate).toHaveBeenCalledWith("/setups/1");
  });

  it("onEdit が渡された場合は遷移の代わりに onEdit が呼ばれる", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderItem({ onEdit });
    const rowButton = screen.getByText("テストセットプレイ", { exact: false }).closest("[role=button]") as HTMLElement;
    await user.click(rowButton);
    expect(onEdit).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("紐付け解除ボタンクリックで確認ダイアログが表示される", async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByText("紐付け解除"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("このセットプレイの紐付けを解除しますか？")).toBeTruthy();
  });

  it("確認ダイアログで「解除」をクリックすると onUnlink が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onUnlink } = renderItem();
    await user.click(screen.getByText("紐付け解除"));
    await user.click(screen.getByRole("button", { name: "解除" }));
    expect(onUnlink).toHaveBeenCalledWith(1);
  });
});

// ===========================================================================
// M19-03: 成立条件(項目10 への追加分)。既存挙動は上のブロックで担保する。
// ===========================================================================

const withResults: SetupSummary = {
  ...mockSetup,
  results: [
    { setupId: 1, techType: "neutral_tech", inCorner: false, result: "ok" },
    { setupId: 1, techType: "back_tech", inCorner: false, result: "ng", note: "届かない" },
  ],
};

describe("SetupAccordionItem の成立条件(M19-03)", () => {
  it("comboId が渡され、検証済みのセルがあればグリッドを出す", () => {
    renderItem({ comboId: 42, setup: withResults });
    expect(screen.getByTestId("setup-result-grid")).toBeTruthy();
  });

  it("全 4 セル未検証ならグリッドを出さない(hidden-when-empty)", () => {
    renderItem({ comboId: 42, setup: { ...mockSetup, results: [] } });
    expect(screen.queryByTestId("setup-result-grid")).toBeNull();
  });

  it("comboId が無ければ表示も編集導線も出さない(保存先を特定できないため)", () => {
    renderItem({ setup: withResults });
    expect(screen.queryByTestId("setup-result-grid")).toBeNull();
    expect(screen.queryByTestId("setup-result-edit-toggle")).toBeNull();
  });

  it("編集導線は行クリックによる遷移とは別操作(遷移を誘発しない)", async () => {
    const user = userEvent.setup();
    renderItem({ comboId: 42, setup: withResults });

    await user.click(screen.getByTestId("setup-result-edit-toggle"));

    // 行クリックの遷移は起きない(stopPropagation)。
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("setup-result-editor")).toBeTruthy();
  });

  it("編集中はグリッド(表示専用)を出さず、閉じると戻る", async () => {
    const user = userEvent.setup();
    renderItem({ comboId: 42, setup: withResults });

    await user.click(screen.getByTestId("setup-result-edit-toggle"));
    expect(screen.queryByTestId("setup-result-grid")).toBeNull();

    await user.click(screen.getByTestId("setup-result-edit-toggle"));
    expect(screen.getByTestId("setup-result-grid")).toBeTruthy();
    expect(screen.queryByTestId("setup-result-editor")).toBeNull();
  });

  it("全セル未検証でも編集導線は出る(最初の 1 件を記録できる)", () => {
    renderItem({ comboId: 42, setup: { ...mockSetup, results: [] } });
    expect(screen.getByTestId("setup-result-edit-toggle")).toBeTruthy();
  });

  it("成立条件を足しても既存挙動(行クリック遷移・紐付け解除)は不変", async () => {
    const user = userEvent.setup();
    const { onUnlink } = renderItem({ comboId: 42, setup: withResults });

    const rowButton = screen
      .getByText("テストセットプレイ", { exact: false })
      .closest("[role=button]") as HTMLElement;
    await user.click(rowButton);
    expect(mockNavigate).toHaveBeenCalledWith("/setups/1");

    await user.click(screen.getByText("紐付け解除"));
    await user.click(screen.getByRole("button", { name: "解除" }));
    expect(onUnlink).toHaveBeenCalledWith(1);
  });

  // =========================================================================
  // ★★M23-07 §4.1: セットプレイをゴミ箱へ入れる導線
  // =========================================================================

  // ★opt-in である。onDelete を渡さない面には破壊的な操作が付いてこない。
  it("onDelete を渡さないとゴミ箱へ移動ボタンが出ない", () => {
    renderItem();
    expect(screen.queryByTestId("setup-soft-delete")).toBeNull();
  });

  it("onDelete を渡すとゴミ箱へ移動ボタンが出る", () => {
    renderItem({ onDelete: vi.fn() });
    expect(screen.getByTestId("setup-soft-delete")).toBeTruthy();
    expect(screen.getByTestId("setup-soft-delete").textContent).toContain(
      ja.setup.delete.action,
    );
  });

  // ★★§4.1-2: 論理削除の前に確認を挟む。押しただけでは消えない。
  it("ゴミ箱へ移動ボタンを押しただけでは onDelete が呼ばれない(確認を挟む)", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderItem({ onDelete });

    await user.click(screen.getByTestId("setup-soft-delete"));

    expect(onDelete).not.toHaveBeenCalled();
    // ★参照しているコンボの件数が出る(材料は parentComboIds。追加取得なし)。
    expect(
      screen.getByText(
        ja.setup.delete.confirmBody
          .replace("{{name}}", "テストセットプレイ")
          .replace("{{count}}", "1"),
      ),
    ).toBeTruthy();
  });

  it("確認して初めて onDelete が当該セットプレイで呼ばれる", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderItem({ onDelete });

    await user.click(screen.getByTestId("setup-soft-delete"));
    await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    // ★★M31-01(P4M-019): 第 2 引数は「紐付けも外すか」。**既定は false** である。
    //   ⇒ 触らずに削除したときの挙動は着手前と同じである。
    expect(onDelete).toHaveBeenCalledWith(mockSetup, false);
  });

  // =========================================================================
  // ★★M31-01(P4M-019): 削除ダイアログの「紐付けも一緒に外す」任意チェック
  //
  // 逐語＝「セットプレイ削除時にコンボとの紐づきを一緒に外す方法をつけたい
  // (詳細画面、ゴミ箱どっちが最適かは決めていない)」(phase4-memo.txt:63)。
  // ⇒ 置き場は削除ダイアログ(開発者裁定 2026-09-08)。
  // =========================================================================

  it("★チェックを入れて削除すると onDelete の第 2 引数が true になる", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderItem({ onDelete, comboId: 42 });

    await user.click(screen.getByTestId("setup-soft-delete"));
    await user.click(screen.getByLabelText(ja.setup.delete.unlinkAlsoLabel));
    await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));

    expect(onDelete).toHaveBeenCalledWith(mockSetup, true);
  });

  // ★★警告文が無いと、利用者は「復元すれば戻る」と読む。⇒ 文面ごと固定する。
  // ★comboId を持たない面(どのコンボとの紐付けか決まらない)では出さない。
  it("★comboId が無い面では「紐付けも外す」チェックを出さない", async () => {
    const user = userEvent.setup();
    renderItem({ onDelete: vi.fn() });

    await user.click(screen.getByTestId("setup-soft-delete"));

    expect(screen.queryByTestId("setup-delete-unlink-also")).toBeNull();
  });

  it("★「復元しても戻らない」旨の警告が出る", async () => {
    const user = userEvent.setup();
    renderItem({ onDelete: vi.fn(), comboId: 42 });

    await user.click(screen.getByTestId("setup-soft-delete"));

    expect(
      screen.getByTestId("setup-delete-unlink-also").textContent,
    ).toContain(ja.setup.delete.unlinkAlsoWarning);
  });

  // ★破壊的な選択を次回へ持ち越さない。
  it("★一度チェックして削除した後、開き直すとチェックは外れている", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderItem({ onDelete, comboId: 42 });

    await user.click(screen.getByTestId("setup-soft-delete"));
    await user.click(screen.getByLabelText(ja.setup.delete.unlinkAlsoLabel));
    await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));

    await user.click(screen.getByTestId("setup-soft-delete"));
    await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));

    expect(onDelete).toHaveBeenLastCalledWith(mockSetup, false);
  });

  // ★★削除と紐付け解除は別物である。取り違えると、消したつもりが外れただけ
  //   (あるいはその逆)になる。
  it("ゴミ箱へ移動は onUnlink を呼ばない", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const { onUnlink } = renderItem({ onDelete });

    await user.click(screen.getByTestId("setup-soft-delete"));
    await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onUnlink).not.toHaveBeenCalled();
  });
});
