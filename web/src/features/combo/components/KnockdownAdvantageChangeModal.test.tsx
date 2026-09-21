import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KnockdownAdvantageChangeModal } from "./KnockdownAdvantageChangeModal";
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

describe("KnockdownAdvantageChangeModal", () => {
  it("open=false のとき dialog が存在しない", () => {
    render(
      <KnockdownAdvantageChangeModal
        open={false}
        linkedSetups={[makeSetup(1)]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open=true でモーダルが表示される", () => {
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

  it("carry_all がデフォルト選択", () => {
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1)]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole("radio");
    const carryAll = radios[0];
    expect(carryAll.getAttribute("data-state")).toBe("checked");
  });

  it("carry_all で保存続行すると mode=carry_all で onConfirm", async () => {
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
    await user.click(screen.getByText("保存続行"));
    expect(onConfirm).toHaveBeenCalledWith({ mode: "carry_all" });
  });

  it("unlink_all を選択して保存続行", async () => {
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

  it("individual 選択でチェックボックスリスト表示", async () => {
    const user = userEvent.setup();
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1), makeSetup(2)]}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("個別に選択"));
    expect(screen.getByText("セットプレイ1")).toBeTruthy();
    expect(screen.getByText("セットプレイ2")).toBeTruthy();
  });

  it("individual でチェックを外して保存続行", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1), makeSetup(2)]}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("個別に選択"));
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(screen.getByText("保存続行"));
    expect(onConfirm).toHaveBeenCalledWith({
      mode: "individual",
      carrySetupIds: [1],
    });
  });

  it("キャンセルで onOpenChange(false) 呼出", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <KnockdownAdvantageChangeModal
        open={true}
        linkedSetups={[makeSetup(1)]}
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );
    await user.click(screen.getByText("キャンセル"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
