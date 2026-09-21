import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import {
  COLUMN_DEFINITIONS,
  DEFAULT_COLUMN_VISIBILITY,
} from "@/constants/combo-list";

// ★件数をベタ書きしない(M24-01)。本来の主張は「定義した列がすべてメニューに出る」であり、
//   数そのものではない。ベタ書きすると列を 1 本足すたびに無関係なテストが赤くなる。
const COLUMN_COUNT = COLUMN_DEFINITIONS.length;

describe("ColumnVisibilityMenu", () => {
  const setup = (overrides = {}) => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const visibility = { ...DEFAULT_COLUMN_VISIBILITY, ...overrides };
    render(
      <ColumnVisibilityMenu
        visibility={visibility}
        onChange={onChange}
        onReset={onReset}
      />,
    );
    return { onChange, onReset, visibility };
  };

  it("opens and shows checkboxes on button click", async () => {
    setup();
    const user = userEvent.setup();
    const button = screen.getByRole("button");
    await user.click(button);
    const checkboxes = screen.getAllByRole("menuitemcheckbox");
    expect(checkboxes.length).toBe(COLUMN_COUNT);
  });

  it("fires onChange when a checkbox is toggled", async () => {
    const { onChange } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    const checkboxes = screen.getAllByRole("menuitemcheckbox");
    await user.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    // ★★M31-03: 先頭の列を **ベタ書きしない**。主張は「押した項目が反転すること」で
    //   あって「先頭がどの列か」ではない。
    //   ★着手前は "hitType" をベタ書きしており、案C への並べ替えで赤くなった
    //     (M27-03 のときも同じ理由で "starterSituation" から書き換えている)。
    //   ⇒ 並びの正本(COLUMN_DEFINITIONS)から引けば、次の並べ替えでは赤くならない。
    //   ★並び自体は ComboTable.test.tsx の「列の並び」describe が固定している。
    const firstKey = COLUMN_DEFINITIONS[0].key;
    expect(arg[firstKey]).toBe(false);
  });

  // C-23: 1列トグルしてもメニューが閉じず、連続して複数列を切り替えられる。
  it("stays open while toggling multiple columns", async () => {
    const { onChange } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));

    const checkboxes = screen.getAllByRole("menuitemcheckbox");
    await user.click(checkboxes[0]);

    // 1回目のトグル後もメニュー項目が残っている(=閉じていない)。
    const afterFirst = screen.getAllByRole("menuitemcheckbox");
    expect(afterFirst.length).toBe(COLUMN_COUNT);

    await user.click(afterFirst[1]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("menuitemcheckbox").length).toBe(COLUMN_COUNT);
  });

  it("fires onReset when reset button is clicked", async () => {
    const { onReset } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    const resetButton = screen.getByText("comboList.filter.resetColumns");
    await user.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
