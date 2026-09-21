import { describe, it, expect } from "vitest";

import { filterByText, normalizeForSearch } from "./text-filter";

interface Item {
  name: string;
}
const byName = (i: Item) => [i.name] as const;

const TAGS: Item[] = [
  { name: "起き攻め" },
  { name: "画面端" },
  { name: "SA3 締め" },
  { name: "ドライブラッシュ始動" },
  { name: "Corner Carry" },
];

describe("normalizeForSearch", () => {
  it("NFKC・trim・小文字化を掛ける", () => {
    expect(normalizeForSearch("  ＳＡ３  ")).toBe("sa3");
    expect(normalizeForSearch("ＡＢＣ")).toBe("abc");
    expect(normalizeForSearch("ｶﾀｶﾅ")).toBe("カタカナ");
  });
});

describe("filterByText", () => {
  it("検索語が空なら全件を返す", () => {
    expect(filterByText(TAGS, "", byName)).toHaveLength(TAGS.length);
  });

  it("★空白のみの検索語も「空」として全件を返す(TagSelector の trim 漏れの是正)", () => {
    expect(filterByText(TAGS, "   ", byName)).toHaveLength(TAGS.length);
  });

  it("前後に空白があっても一致する", () => {
    const got = filterByText(TAGS, "  画面端  ", byName);
    expect(got.map((t) => t.name)).toEqual(["画面端"]);
  });

  it("部分一致で引ける(前方一致ではない)", () => {
    const got = filterByText(TAGS, "攻め", byName);
    expect(got.map((t) => t.name)).toEqual(["起き攻め"]);
  });

  it("大文字小文字を区別しない", () => {
    expect(filterByText(TAGS, "corner", byName).map((t) => t.name)).toEqual([
      "Corner Carry",
    ]);
    expect(filterByText(TAGS, "CORNER", byName).map((t) => t.name)).toEqual([
      "Corner Carry",
    ]);
  });

  it("★全角で入力しても半角の値を引ける(NFKC)", () => {
    expect(filterByText(TAGS, "ＳＡ３", byName).map((t) => t.name)).toEqual([
      "SA3 締め",
    ]);
  });

  it("一致が無ければ 0 件を返す", () => {
    expect(filterByText(TAGS, "存在しないタグ", byName)).toHaveLength(0);
  });

  it("複数の検索対象のいずれかに一致すれば残る", () => {
    const chars = [
      { nameJa: "リュウ", nameEn: "Ryu", code: "ryu" },
      { nameJa: "ケン", nameEn: "Ken", code: "ken" },
    ];
    const targets = (c: (typeof chars)[number]) =>
      [c.nameJa, c.nameEn, c.code] as const;

    expect(filterByText(chars, "リュ", targets).map((c) => c.code)).toEqual(["ryu"]);
    expect(filterByText(chars, "ryu", targets).map((c) => c.code)).toEqual(["ryu"]);
    expect(filterByText(chars, "Ryu", targets).map((c) => c.code)).toEqual(["ryu"]);
  });

  it("入力配列を破壊しない", () => {
    const before = [...TAGS];
    filterByText(TAGS, "端", byName);
    expect(TAGS).toEqual(before);
  });
});
