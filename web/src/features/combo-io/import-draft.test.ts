import { describe, expect, it } from "vitest";

import {
  countExcludedDrafts,
  isDraftExcluded,
  isImportSelectable,
} from "./import-draft";

function row(isDraft: boolean, importable = true) {
  return { isDraft, importable };
}

describe("isDraftExcluded", () => {
  it("仮登録の行を除外対象と判定する", () => {
    expect(isDraftExcluded(row(true))).toBe(true);
  });

  it("仮登録でない行は除外しない", () => {
    expect(isDraftExcluded(row(false))).toBe(false);
  });

  it("取込不可(importable=false)であっても、仮登録かどうかだけで判定する", () => {
    // ★2 つの概念を混ぜない。除外の理由が「仮登録」か「検証エラー」かは画面で区別して出す。
    expect(isDraftExcluded(row(true, false))).toBe(true);
    expect(isDraftExcluded(row(false, false))).toBe(false);
  });
});

describe("isImportSelectable", () => {
  // ★この関数が守っているもの: 既定チェックの初期化・全選択/全解除・送信対象の算出の
  //   3 か所が同じ条件を見る。条件が割れると「除外したつもりの行が送られる」。
  it("仮登録でなく取込可能な行だけ選べる", () => {
    expect(isImportSelectable(row(false, true))).toBe(true);
  });

  it("仮登録の行は、取込可能でも選べない", () => {
    expect(isImportSelectable(row(true, true))).toBe(false);
  });

  it("取込不可の行は、仮登録でなくても選べない", () => {
    expect(isImportSelectable(row(false, false))).toBe(false);
  });

  it("仮登録かつ取込不可の行も選べない", () => {
    expect(isImportSelectable(row(true, false))).toBe(false);
  });
});

describe("countExcludedDrafts", () => {
  it("除外した件数を数える(黙って減らさないための材料)", () => {
    expect(countExcludedDrafts([row(true), row(false), row(true)])).toBe(2);
  });

  it("仮登録が無ければ 0", () => {
    expect(countExcludedDrafts([row(false), row(false)])).toBe(0);
  });
});
