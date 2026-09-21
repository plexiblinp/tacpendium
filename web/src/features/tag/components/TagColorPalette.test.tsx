import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagColorPalette } from "./TagColorPalette";
import { TAG_COLOR_PALETTE } from "../constants/tagColorPalette";

import i18n from "@/lib/i18n";

// jsdom は ResizeObserver 未実装。Radix RadioGroup の bubble input(隠しネイティブ input)が
// 内部で使用するため、テスト用の最小スタブを用意する。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

describe("TagColorPalette", () => {
  it("パレットの全色が色名付きで表示される", () => {
    render(<TagColorPalette value="" onChange={vi.fn()} />);
    for (const { labelKey } of TAG_COLOR_PALETTE) {
      const label = i18n.t(labelKey);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("value と一致するスウォッチが選択中(aria-checked=true)になる", () => {
    render(<TagColorPalette value="#3b82f6" onChange={vi.fn()} />);
    expect(screen.getByTestId("tag-color-swatch-blue").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("tag-color-swatch-red").getAttribute("aria-checked")).toBe("false");
  });

  it("value がパレット外の色のときどのスウォッチも選択中にならない", () => {
    render(<TagColorPalette value="#123456" onChange={vi.fn()} />);
    for (const { key } of TAG_COLOR_PALETTE) {
      expect(screen.getByTestId(`tag-color-swatch-${key}`).getAttribute("aria-checked")).toBe("false");
    }
  });

  it("スウォッチをクリックすると onChange が該当 HEX で呼ばれる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagColorPalette value="" onChange={onChange} />);

    await user.click(screen.getByTestId("tag-color-swatch-red"));

    expect(onChange).toHaveBeenCalledWith("#ef4444");
  });
});
