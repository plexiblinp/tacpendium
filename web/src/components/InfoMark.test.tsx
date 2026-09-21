import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InfoMark } from "./InfoMark";

const TEXT = "これはテスト用の説明文です。";

describe("InfoMark", () => {
  it("ⓘ トリガが test-id で解決でき、初期状態では説明文が表示されない", () => {
    render(<InfoMark topic="demo" text={TEXT} />);
    expect(screen.getByTestId("info-mark-demo")).toBeTruthy();
    // Popover は閉じているため content は DOM に存在しない
    expect(screen.queryByTestId("info-mark-demo-content")).toBeNull();
  });

  it("クリックで説明文が表示される", async () => {
    const user = userEvent.setup();
    render(<InfoMark topic="demo" text={TEXT} />);
    await user.click(screen.getByTestId("info-mark-demo"));
    await waitFor(() => {
      const content = screen.getByTestId("info-mark-demo-content");
      expect(content.textContent).toContain(TEXT);
    });
  });

  it("aria-label は省略時に既定値、指定時に上書きされる", () => {
    const { rerender } = render(<InfoMark topic="demo" text={TEXT} />);
    expect(
      screen.getByTestId("info-mark-demo").getAttribute("aria-label"),
    ).toBe("説明を表示");
    rerender(<InfoMark topic="demo" text={TEXT} ariaLabel="modifier の説明" />);
    expect(
      screen.getByTestId("info-mark-demo").getAttribute("aria-label"),
    ).toBe("modifier の説明");
  });

  it("フォーム内でクリックしても submit を起こさない（type=button・副作用なし）", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <InfoMark topic="demo" text={TEXT} />
      </form>,
    );
    await user.click(screen.getByTestId("info-mark-demo"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
