import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import {
  SORT_FIELD_VALUES,
  type SortField,
  type SortOrder,
} from "@/constants/combo-list";
import ComboSortControls from "./ComboSortControls";

// M24-01 §4.3(SM-004)。
//
// ★実査の結果、SM-004「マイコンボのソートがコンボ一覧と不一致」は M12-01 の C-17 で
//   既に解消していた——両画面が同一の ComboSortControls と同一の SORT_FIELD_VALUES を
//   使っている(MyComboPage.tsx / ComboListFilters.tsx)。⇒ 本サブでは実装しない。
// ★ただし同部品にはテストが 1 本も無かった。既に成立していることを固定するために足す。

function setup(
  props: Partial<React.ComponentProps<typeof ComboSortControls>> = {},
) {
  const onSortChange = vi.fn();
  const onOrderChange = vi.fn();
  const view = render(
    <ComboSortControls
      sort={"updated_at" as SortField}
      order={"desc" as SortOrder}
      onSortChange={onSortChange}
      onOrderChange={onOrderChange}
      {...props}
    />,
  );
  return { onSortChange, onOrderChange, view };
}

describe("ComboSortControls(コンボ一覧とマイコンボの共通部品)", () => {
  it("ソート項目は SORT_FIELD_VALUES の全数を出す(両画面で同じ集合)", () => {
    setup();
    // Label と select は htmlFor で結ばれていないため、順序で取る(1 本目 = ソート項目)。
    const [sortSelect] = screen.getAllByRole("combobox");
    const options = Array.from(sortSelect.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    // ★件数をベタ書きしない。主張は「定数に定義した項目がすべて出る」ことである。
    expect(options).toEqual([...SORT_FIELD_VALUES]);
  });

  it("マイコンボ側の項目集合で描画できる(一覧側と同一集合であることの固定)", () => {
    // ★マイコンボは MyComboPage.tsx で同じ SORT_FIELD_VALUES を isSortField に使い、
    //   同じ props で本部品を呼んでいる。どの項目を選んでも描画が壊れないことを確かめる。
    for (const field of SORT_FIELD_VALUES) {
      const { view } = setup({ sort: field });
      const [sortSelect] = screen.getAllByRole("combobox");
      expect(
        (sortSelect as HTMLSelectElement).value,
        `sort=${field} で描画できていない`,
      ).toBe(field);
      view.unmount();
    }
  });

  it('sort が "default"(始動状況順)のときは昇降切替を出さない', () => {
    setup({ sort: "default" as SortField });
    expect(screen.getAllByRole("combobox").length).toBe(1);
  });

  it('sort が "default" 以外のときは昇降切替を出す', () => {
    setup({ sort: "updated_at" as SortField });
    expect(screen.getAllByRole("combobox").length).toBe(2);
  });

  it("ソート項目を変えると onSortChange が選んだ値で呼ばれる", async () => {
    const user = userEvent.setup();
    const { onSortChange } = setup();
    const target = SORT_FIELD_VALUES.find((v) => v !== "updated_at")!;
    const [sortSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(sortSelect, target);
    expect(onSortChange).toHaveBeenCalledWith(target);
  });

  it("昇降を変えると onOrderChange が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onOrderChange } = setup();
    const [, orderSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(orderSelect, "asc");
    expect(onOrderChange).toHaveBeenCalledWith("asc");
  });
});
