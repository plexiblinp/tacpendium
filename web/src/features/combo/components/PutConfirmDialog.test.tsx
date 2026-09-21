import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PutConfirmDialog } from "./PutConfirmDialog";

describe("PutConfirmDialog", () => {
  it("open=false なら role=alertdialog が存在しない", () => {
    render(
      <PutConfirmDialog open={false} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("open=true なら role=alertdialog が描画される", () => {
    render(
      <PutConfirmDialog open={true} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("キャンセルボタンで onOpenChange(false) が呼ばれる", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <PutConfirmDialog open={true} onOpenChange={onOpenChange} onConfirm={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("確認ボタンで onConfirm が呼ばれる", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PutConfirmDialog open={true} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: "再登録する" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
