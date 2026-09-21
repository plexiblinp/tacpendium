import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ja from "@/locales/ja.json";
import { TrashSetupList } from "./TrashSetupList";
import type { SetupResponse } from "../types";

// ★i18n は実 ja.json を引く(M23-04 教訓 2 / M23-06 §5.1)。
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

// 行は本ファイルの関心ではない(行の主張は TrashSetupListRow.test.tsx が持つ)。
// ★選択の配線だけを見たいので、行はチェックボックスとラベルだけの薄いものへ置き換える。
vi.mock("./TrashSetupListRow", () => ({
  TrashSetupListRow: ({
    setup,
    selected,
    onSelectionChange,
  }: {
    setup: SetupResponse;
    selected: boolean;
    onSelectionChange: (id: number, selected: boolean) => void;
  }) => (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`setup-${setup.id}`}
          checked={selected}
          onChange={(e) => onSelectionChange(setup.id, e.target.checked)}
        />
      </td>
    </tr>
  ),
}));

function makeSetup(id: number): SetupResponse {
  return {
    id,
    characterId: 1,
    name: `セットプレイ${id}`,
    description: null,
    stepCount: 1,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: "2026-04-09T00:00:00Z",
    steps: [],
    defaultRecipe: "",
    parentComboIds: [],
  };
}

function renderList(
  setups: SetupResponse[],
  selectedIds: number[] = [],
  onSelectionChange = vi.fn(),
) {
  return render(
    <TrashSetupList
      setups={setups}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onSetupChanged={vi.fn()}
    />,
  );
}

describe("TrashSetupList(M23-06 §4.4)", () => {
  it("空のとき、空メッセージを出す", () => {
    renderList([]);
    expect(screen.getByText(ja.trash.setup.empty)).toBeTruthy();
  });

  it("列は 4 つ(選択 / 名前 / 削除日時 / 操作)", () => {
    renderList([makeSetup(1)]);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(4);
    expect(headers[1].textContent).toBe(ja.trash.setup.columnName);
  });

  // =========================================================================
  // ★★§5.1-5: 「全選択」の対象は、この表に出ているセットプレイだけである
  //
  //   ★コンボ表の全選択とは独立している。選択状態を 2 本の配列に分けたのは
  //   このためであり、混ぜるとコンボの id でセットプレイの API を叩く経路が
  //   構造的に作れてしまう(取り違えると別のデータが消える)。
  // =========================================================================
  it("★全選択は、この表の setup id だけを返す(コンボの id が混ざらない)", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([makeSetup(11), makeSetup(12)], [], onSelectionChange);

    await user.click(screen.getByLabelText(ja.trash.setup.columnSelectAll));

    // ★この表に出ている 2 件ちょうど。1 回の呼び出しで完結する。
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith([11, 12]);
  });

  it("全選択を外すと空配列になる", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([makeSetup(11), makeSetup(12)], [11, 12], onSelectionChange);

    await user.click(screen.getByLabelText(ja.trash.setup.columnSelectAll));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("一部だけ選ばれているとき、全選択は indeterminate になる", () => {
    renderList([makeSetup(11), makeSetup(12)], [11]);

    const selectAll = screen.getByLabelText(ja.trash.setup.columnSelectAll);
    expect(selectAll.getAttribute("data-state")).toBe("indeterminate");
  });

  it("行の選択が、その行の setup id で伝わる", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([makeSetup(11), makeSetup(12)], [], onSelectionChange);

    await user.click(screen.getByLabelText("setup-12"));

    // ★既に選ばれている分へ追加する形(置き換えない)。
    expect(onSelectionChange).toHaveBeenCalledWith([12]);
  });

  it("選択済みの行を外すと、その id だけが落ちる", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([makeSetup(11), makeSetup(12)], [11, 12], onSelectionChange);

    await user.click(screen.getByLabelText("setup-11"));

    expect(onSelectionChange).toHaveBeenCalledWith([12]);
  });
});
