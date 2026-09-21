import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PresetAliasEditor, { groupByCategory } from "./PresetAliasEditor";
import type { PresetAliasDetail } from "../types";

function detail(over: Partial<PresetAliasDetail> = {}): PresetAliasDetail {
  return {
    moveId: 1,
    moveCode: "standing_light_punch",
    moveCategory: "normal",
    characterId: 1,
    aliasText: "5LP",
    ...over,
  };
}

describe("groupByCategory", () => {
  it("カテゴリごとにまとめ、既定の順序で返す", () => {
    const groups = groupByCategory([
      detail({ moveId: 1, moveCategory: "special" }),
      detail({ moveId: 2, moveCategory: "normal" }),
      detail({ moveId: 3, moveCategory: "normal" }),
    ]);

    expect(groups.map((g) => g.category)).toEqual(["normal", "special"]);
    expect(groups[0].items.map((i) => i.moveId)).toEqual([2, 3]);
    expect(groups[0].label).toBe("通常技");
  });

  it("未知のカテゴリは末尾へ回し、コードをそのまま表示名にする", () => {
    const groups = groupByCategory([
      detail({ moveId: 1, moveCategory: "unknown_kind" }),
      detail({ moveId: 2, moveCategory: "normal" }),
    ]);

    expect(groups.map((g) => g.category)).toEqual(["normal", "unknown_kind"]);
    expect(groups[1].label).toBe("unknown_kind");
  });
});

describe("PresetAliasEditor", () => {
  it("公式技名を参照として表示する(moves に表示名カラムが無いため)", () => {
    render(
      <PresetAliasEditor
        details={[detail({ officialAliasText: "立ち弱P" })]}
        edits={{}}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("立ち弱P")).toBeTruthy();
    expect(screen.getByText("standing_light_punch")).toBeTruthy();
  });

  it("公式技名が無い場合は move code をラベルにする", () => {
    render(
      <PresetAliasEditor details={[detail()]} edits={{}} onChange={vi.fn()} />,
    );
    expect(screen.getAllByText("standing_light_punch").length).toBeGreaterThan(0);
  });

  it("★alias_text_en の編集欄を作らない(生成規則が入れる列であるため)", () => {
    render(
      <PresetAliasEditor
        details={[detail({ aliasTextEn: "micro forward" })]}
        edits={{}}
        onChange={vi.fn()}
      />,
    );

    // 入力欄はエイリアス 1 行につき 1 個だけ(alias_text のみ)。
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByDisplayValue("micro forward")).toBeNull();
  });

  it("編集中の値があればそれを表示し、無ければ元の値を表示する", () => {
    render(
      <PresetAliasEditor
        details={[detail({ moveId: 1 }), detail({ moveId: 2, aliasText: "5MP" })]}
        edits={{ 1: "編集中" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("alias-input-1")).toHaveProperty("value", "編集中");
    expect(screen.getByTestId("alias-input-2")).toHaveProperty("value", "5MP");
  });

  it("入力すると moveId と値を通知する", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PresetAliasEditor details={[detail()]} edits={{}} onChange={onChange} />,
    );

    await user.type(screen.getByTestId("alias-input-1"), "X");
    expect(onChange).toHaveBeenCalledWith(1, "5LPX");
  });

  it("readOnly では入力欄が無効になる(組み込みプリセットを開いたとき)", () => {
    render(
      <PresetAliasEditor
        details={[detail()]}
        edits={{}}
        onChange={vi.fn()}
        readOnly
      />,
    );
    const input = screen.getByTestId("alias-input-1") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("0 件のときは空表示にする", () => {
    render(<PresetAliasEditor details={[]} edits={{}} onChange={vi.fn()} />);
    expect(screen.getByTestId("alias-editor-empty")).toBeTruthy();
  });
});
