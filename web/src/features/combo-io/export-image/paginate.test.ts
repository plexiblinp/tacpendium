import { describe, expect, it } from "vitest";

import { planPages, PDF_COLUMNS_PER_PAGE } from "./paginate";

// M17-05c-fix: 行分割は廃止。planPages は列分割(比較の 4 列/ページ)のみを担う。
describe("planPages — 列分割のみ", () => {
  it("単独は常に 1 ページ(列概念なし)", () => {
    expect(planPages({ mode: "single" })).toEqual([{ pageNumber: 1 }]);
  });

  it("比較: 4 列以下は 1 ページ", () => {
    const pages = planPages({ mode: "comparison", columnCount: 4 });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      columnStart: 0,
      columnEnd: 4,
    });
  });

  it("比較: 5 件は 2 ページ(4+1)に列分割", () => {
    expect(planPages({ mode: "comparison", columnCount: 5 })).toEqual([
      { pageNumber: 1, columnStart: 0, columnEnd: 4 },
      { pageNumber: 2, columnStart: 4, columnEnd: 5 },
    ]);
  });

  it("比較: 9 件は 3 ページ(4+4+1)・ページ番号が通し", () => {
    const pages = planPages({ mode: "comparison", columnCount: 9 });
    expect(pages.map((p) => [p.columnStart, p.columnEnd])).toEqual([
      [0, 4],
      [4, 8],
      [8, 9],
    ]);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
  });

  it("列数は PDF_COLUMNS_PER_PAGE(=4・名前付き定数)に従う", () => {
    expect(PDF_COLUMNS_PER_PAGE).toBe(4);
    expect(planPages({ mode: "comparison", columnCount: 8 })).toHaveLength(2);
  });

  it("境界: 1 件でも 1 ページ", () => {
    expect(planPages({ mode: "comparison", columnCount: 1 })).toEqual([
      { pageNumber: 1, columnStart: 0, columnEnd: 1 },
    ]);
  });
});
