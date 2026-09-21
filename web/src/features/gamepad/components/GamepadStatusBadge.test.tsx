import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import GamepadStatusBadge from "./GamepadStatusBadge";

const PAD_ID = "Xbox One Game Controller (STANDARD GAMEPAD)";

function renderBadge(
  props: Partial<React.ComponentProps<typeof GamepadStatusBadge>> = {},
) {
  const onOpenCalibration = vi.fn();
  render(
    <GamepadStatusBadge
      status="idle"
      padId={null}
      source="none"
      onOpenCalibration={onOpenCalibration}
      {...props}
    />,
  );
  return { onOpenCalibration };
}

describe("(l) 接続状態の 3 状態", () => {
  it("(l-1) 未押下(idle)は『1 度押してください』の導線を出す", () => {
    renderBadge({ status: "idle" });

    const status = screen.getByTestId("recipe-gamepad-status");
    expect(status.getAttribute("data-status")).toBe("idle");
    expect(status.textContent).toContain("1 度押してください");
  });

  it("(l-2) 未認識(disconnected)は障害として別の文言を出す", () => {
    renderBadge({ status: "disconnected" });

    const status = screen.getByTestId("recipe-gamepad-status");
    expect(status.getAttribute("data-status")).toBe("disconnected");
    expect(status.textContent).toContain("認識していません");
  });

  it("(l-3) 認識済み(connected)は機体名を出す", () => {
    renderBadge({ status: "connected", padId: PAD_ID, source: "saved" });

    const status = screen.getByTestId("recipe-gamepad-status");
    expect(status.getAttribute("data-status")).toBe("connected");
    expect(status.textContent).toContain(PAD_ID);
  });

  it("★(l-4) 『認識していません』と『まだ 1 度も押されていません』が同じ文言になっていない", () => {
    // 指示書 §4.4-4: 前者は障害、後者は正常な初期状態である。
    const { container: idle } = render(
      <GamepadStatusBadge
        status="idle"
        padId={null}
        source="none"
        onOpenCalibration={vi.fn()}
      />,
    );
    const idleText = idle.textContent ?? "";

    const { container: disconnected } = render(
      <GamepadStatusBadge
        status="disconnected"
        padId={null}
        source="none"
        onOpenCalibration={vi.fn()}
      />,
    );
    const disconnectedText = disconnected.textContent ?? "";

    expect(idleText).not.toBe(disconnectedText);
    // 障害側に「押してください」と書かない（押しても直らないため）。
    expect(disconnectedText).not.toContain("押してください");
  });

  it("認識済みでも未キャリブレーションなら未設定であることが分かる", () => {
    renderBadge({ status: "connected", padId: PAD_ID, source: "none" });

    expect(screen.getByTestId("recipe-gamepad-status").textContent).toContain(
      "未設定",
    );
  });

  it("★標準配置を仮適用中は「未設定」と出さない（そのまま使えるため）", () => {
    renderBadge({ status: "connected", padId: PAD_ID, source: "default" });

    const text = screen.getByTestId("recipe-gamepad-status").textContent ?? "";
    expect(text).toContain("標準配置");
    expect(text).not.toContain("未設定");
  });

  it("登録済みなら標準配置とも未設定とも出さない", () => {
    renderBadge({ status: "connected", padId: PAD_ID, source: "saved" });

    const text = screen.getByTestId("recipe-gamepad-status").textContent ?? "";
    expect(text).not.toContain("標準配置");
    expect(text).not.toContain("未設定");
  });

  it("キャリブレーション導線を開ける", async () => {
    const user = userEvent.setup();
    const { onOpenCalibration } = renderBadge({ status: "idle" });

    await user.click(screen.getByTestId("recipe-gamepad-calibrate"));

    expect(onOpenCalibration).toHaveBeenCalledTimes(1);
  });
});
