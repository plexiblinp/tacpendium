import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ja from "@/locales/ja.json";
import { PermanentDeleteConfirm } from "./PermanentDeleteConfirm";

// ★M23-07 §4.4-1 で本コンポーネントを i18n 化した(直書き 5 件)。
// ★キー返しモックにしない(M23-04 教訓 2)。実 ja.json を引く t にすることで、
//   「キーは通っているが文面が抜けている」状態をテストが検出できる。
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

describe("PermanentDeleteConfirm", () => {
  it("open=false なら role=alertdialog が存在しない", () => {
    render(
      <PermanentDeleteConfirm open={false} count={1} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("open=true なら role=alertdialog が描画される", () => {
    render(
      <PermanentDeleteConfirm open={true} count={1} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("count=1 のとき単数形メッセージが表示される", () => {
    render(
      <PermanentDeleteConfirm open={true} count={1} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/このコンボを完全削除します/)).toBeTruthy();
  });

  it("count=3 のとき複数形メッセージが表示される", () => {
    render(
      <PermanentDeleteConfirm open={true} count={3} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/選択した 3 件のコンボを完全削除します/)).toBeTruthy();
  });

  it("キャンセルボタンで onOpenChange(false) が呼ばれる", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <PermanentDeleteConfirm open={true} count={1} onOpenChange={onOpenChange} onConfirm={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("完全削除するボタンで onConfirm が呼ばれる", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PermanentDeleteConfirm open={true} count={1} onOpenChange={vi.fn()} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole("button", { name: "完全削除する" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
