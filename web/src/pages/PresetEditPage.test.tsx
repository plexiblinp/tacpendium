import { describe, expect, it } from "vitest";

import { collectDirtyAliases } from "./PresetEditPage";

describe("collectDirtyAliases", () => {
  it("値が変わった行だけを返す", () => {
    const original = new Map([
      [1, "5LP"],
      [2, "5MP"],
    ]);
    const got = collectDirtyAliases({ 1: "強P", 2: "5MP" }, original);
    expect(got).toEqual([{ moveId: 1, aliasText: "強P" }]);
  });

  it("★前後の空白だけの違いは変更と数えない(API 側でも trim されるため)", () => {
    const original = new Map([[1, "5LP"]]);
    expect(collectDirtyAliases({ 1: "  5LP  " }, original)).toEqual([]);
  });

  it("元の値を持たない move は送らない(技の追加はしない)", () => {
    const original = new Map([[1, "5LP"]]);
    expect(collectDirtyAliases({ 999: "未知" }, original)).toEqual([]);
  });

  it("空文字への変更は差分として送る(拒否の判断はサーバー側 VAL-P02)", () => {
    const original = new Map([[1, "5LP"]]);
    expect(collectDirtyAliases({ 1: "" }, original)).toEqual([
      { moveId: 1, aliasText: "" },
    ]);
  });

  it("編集が無ければ空を返す", () => {
    expect(collectDirtyAliases({}, new Map([[1, "5LP"]]))).toEqual([]);
  });
});
