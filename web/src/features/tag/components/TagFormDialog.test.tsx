import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import { TagFormDialog } from "./TagFormDialog";

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

describe("TagFormDialog", () => {
  it("open=false のとき dialog が存在しない", () => {
    render(
      <TagFormDialog open={false} onOpenChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open=true のとき「タグを新規作成」タイトルが表示される", () => {
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("タグを新規作成")).toBeTruthy();
  });

  it("既存タグを渡すと「タグを編集」タイトルが表示される", () => {
    const tag = { id: 1, userId: 1, name: "既存タグ" };
    render(<TagFormDialog open={true} tag={tag} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("タグを編集")).toBeTruthy();
  });

  it("VAL-T02: タグ名が空のままサブミットするとエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "作成" }));

    const err = await screen.findByText("タグ名は必須です");
    expect(err).toBeTruthy();
  });

  it("VAL-T02: スペースのみのタグ名でもエラーが表示される", async () => {
    const user = userEvent.setup();
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/タグ名/), "   ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    const err = await screen.findByText("タグ名は必須です");
    expect(err).toBeTruthy();
  });

  it("色フォーマット違反でエラーが表示される", async () => {
    const user = userEvent.setup();
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/タグ名/), "テスト");
    await user.type(screen.getByTestId("color-input"), "invalid-color");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(screen.getByText("色は #RRGGBB 形式で指定してください")).toBeTruthy();
    });
  });

  it("正常なデータではサブミットコールバックが呼ばれる", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/タグ名/), "新しいタグ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新しいタグ" }),
    );
  });

  it("FB⑭: 新規作成時は青スウォッチが既定で選択されている(灰色固定でない)", () => {
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId("tag-color-swatch-blue").getAttribute("aria-checked")).toBe("true");
  });

  it("スウォッチをクリックすると選択色でサブミットされる", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TagFormDialog open={true} onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/タグ名/), "新しいタグ");
    await user.click(screen.getByTestId("tag-color-swatch-red"));
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新しいタグ", color: "#ef4444" }),
    );
  });

  it("パレット外の HEX を持つ既存タグを編集してもどのスウォッチも選択されず値が保持される", async () => {
    const tag = { id: 1, userId: 1, name: "既存タグ", color: "#123456" };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TagFormDialog open={true} tag={tag} onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    expect((screen.getByTestId("color-input") as HTMLInputElement).value).toBe("#123456");
    const swatches = screen.getAllByTestId(/^tag-color-swatch-/);
    for (const swatch of swatches) {
      expect(swatch.getAttribute("aria-checked")).toBe("false");
    }

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: "#123456" }),
    );
  });
});
