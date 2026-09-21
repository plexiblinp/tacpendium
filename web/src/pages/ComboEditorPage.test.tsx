import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KnockdownAdvantageChangeModal } from "@/features/combo/components/KnockdownAdvantageChangeModal";
import type { SetupSummary } from "@/features/setup/types";

const makeSetup = (id: number): SetupSummary => ({
  id,
  characterId: 1,
  name: `セットプレイ${id}`,
  description: null,
  stepCount: 2,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [1],
});

afterEach(() => vi.clearAllMocks());

describe("KnockdownAdvantageChangeModal — モーダル分岐ロジック", () => {
  it("open=true + linkedSetups ≥ 1 でモーダルが表示される", () => {
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1), makeSetup(2)]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("セットプレイの引き継ぎ確認")).toBeTruthy();
    expect(screen.getByText(/2 件/)).toBeTruthy();
  });

  it("open=false ではモーダルが非表示", () => {
    render(
      <KnockdownAdvantageChangeModal
        open={false}
        linkedSetups={[makeSetup(1)]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("セットプレイの引き継ぎ確認")).toBeNull();
  });

  it("linkedSetups=[] でも open=true ならモーダル表示（0 件と表示）", () => {
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("セットプレイの引き継ぎ確認")).toBeTruthy();
    expect(screen.getByText(/0 件/)).toBeTruthy();
  });

  it("confirm 後に正しい carry options が返る", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1)]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByText("紐付けをすべて外す"));
    await user.click(screen.getByText("保存続行"));

    expect(onConfirm).toHaveBeenCalledWith({ mode: "unlink_all" });
  });

  it("individual で選択を外すと carrySetupIds から除外", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1), makeSetup(2), makeSetup(3)]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByText("個別に選択"));
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByText("保存続行"));

    const result = onConfirm.mock.calls[0][0];
    expect(result.mode).toBe("individual");
    expect(result.carrySetupIds).toEqual(expect.arrayContaining([1, 3]));
    expect(result.carrySetupIds).not.toContain(2);
  });
});
