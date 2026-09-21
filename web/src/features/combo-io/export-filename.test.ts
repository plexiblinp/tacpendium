import { describe, expect, it } from "vitest";

import {
  EXPORT_RANGE_SLUG,
  createExportBaseNameIssuer,
  formatExportBaseName,
  formatExportTimestamp,
  sanitizeExportBaseName,
  withExtension,
} from "./export-filename";
import type { ExportRange } from "./types";

// ローカル時刻で組み立てるため、Date のローカル解釈で作る(UTC 文字列にしない)。
const AT = new Date(2026, 7, 30, 14, 35, 12); // 2026-08-30 14:35:12
const AT_PADDED = new Date(2026, 0, 2, 3, 4, 5); // 2026-01-02 03:04:05

describe("formatExportTimestamp", () => {
  it("YYYYMMDD-HHmmss で組み立てる", () => {
    expect(formatExportTimestamp(AT)).toBe("20260830-143512");
  });

  it("月・日・時・分・秒を 2 桁へゼロ詰めする", () => {
    expect(formatExportTimestamp(AT_PADDED)).toBe("20260102-030405");
  });
});

describe("EXPORT_RANGE_SLUG", () => {
  it("DES-005 §5.13 の 4 値をすべて持つ", () => {
    const ranges: ExportRange[] = ["all", "filter", "selected", "mycombo"];
    expect(Object.keys(EXPORT_RANGE_SLUG).sort()).toEqual([...ranges].sort());
  });

  it("ワイヤ値 filter は filtered へ写す(指示書 §4.4 の例に合わせる)", () => {
    expect(EXPORT_RANGE_SLUG.filter).toBe("filtered");
  });

  it("日本語を含まない(OS・ツールでの文字化けを避ける)", () => {
    for (const slug of Object.values(EXPORT_RANGE_SLUG)) {
      expect(/^[a-z]+$/.test(slug)).toBe(true);
    }
  });
});

describe("formatExportBaseName", () => {
  it("combos_{種別}_{件数}_{日時} の形になる", () => {
    expect(formatExportBaseName({ range: "filter", count: 42, now: AT })).toBe(
      "combos_filtered_42_20260830-143512",
    );
  });

  it("4 種別すべてで種別が名前へ入る", () => {
    const ranges: ExportRange[] = ["all", "filter", "selected", "mycombo"];
    for (const range of ranges) {
      expect(formatExportBaseName({ range, count: 1, now: AT })).toBe(
        `combos_${EXPORT_RANGE_SLUG[range]}_1_20260830-143512`,
      );
    }
  });

  it("件数が名前へ入る(連続出力で目的のほうを見分ける材料)", () => {
    expect(formatExportBaseName({ range: "selected", count: 7, now: AT })).toContain(
      "_7_",
    );
    expect(formatExportBaseName({ range: "selected", count: 0, now: AT })).toContain(
      "_0_",
    );
  });

  it("拡張子を含まない(形式ごとに呼び出し側が付ける)", () => {
    expect(formatExportBaseName({ range: "all", count: 3, now: AT })).not.toContain(".");
  });

  it("同じ入力なら同じ結果を返す(純粋)", () => {
    const a = formatExportBaseName({ range: "all", count: 3, now: AT });
    const b = formatExportBaseName({ range: "all", count: 3, now: AT });
    expect(a).toBe(b);
  });
});

describe("createExportBaseNameIssuer", () => {
  // ★本 describe が守っているもの: 書式は秒までしか持たないため、
  //   同じ秒のうちに 2 回出すと formatExportBaseName だけでは同じ名前になる。
  it("同じ秒に連続で呼んでも名前が衝突しない", () => {
    const issue = createExportBaseNameIssuer();
    const first = issue({ range: "filter", count: 42, now: AT });
    const second = issue({ range: "filter", count: 42, now: AT });
    expect(first).toBe("combos_filtered_42_20260830-143512");
    expect(second).not.toBe(first);
  });

  it("同じ秒に 3 回以上連続で呼んでも全部違う名前になる", () => {
    const issue = createExportBaseNameIssuer();
    const names = [1, 2, 3, 4, 5].map(() =>
      issue({ range: "all", count: 9, now: AT }),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("秒が変われば連番は付かず、素の書式へ戻る", () => {
    const issue = createExportBaseNameIssuer();
    issue({ range: "all", count: 9, now: AT });
    issue({ range: "all", count: 9, now: AT }); // ここで連番が立つ
    const later = issue({
      range: "all",
      count: 9,
      now: new Date(2026, 7, 30, 14, 35, 13),
    });
    expect(later).toBe("combos_all_9_20260830-143513");
  });

  it("同じ秒でも対象や件数が違えば連番は付かない", () => {
    const issue = createExportBaseNameIssuer();
    const a = issue({ range: "all", count: 9, now: AT });
    const b = issue({ range: "all", count: 10, now: AT });
    expect(a).toBe("combos_all_9_20260830-143512");
    expect(b).toBe("combos_all_10_20260830-143512");
  });

  it("払い出し口ごとに独立している", () => {
    const one = createExportBaseNameIssuer();
    const other = createExportBaseNameIssuer();
    expect(one({ range: "all", count: 1, now: AT })).toBe(
      other({ range: "all", count: 1, now: AT }),
    );
  });
});

describe("withExtension", () => {
  it("1 つのベース名から形式ごとの名前を作れる", () => {
    const base = formatExportBaseName({ range: "selected", count: 2, now: AT });
    expect(withExtension(base, "zip")).toBe("combos_selected_2_20260830-143512.zip");
    expect(withExtension(base, "pdf")).toBe("combos_selected_2_20260830-143512.pdf");
    expect(withExtension(base, "png")).toBe("combos_selected_2_20260830-143512.png");
  });
});

describe("sanitizeExportBaseName", () => {
  it("そのまま使える名前は変えない", () => {
    expect(sanitizeExportBaseName("combos_all_3_20260830-143512")).toBe(
      "combos_all_3_20260830-143512",
    );
  });

  it("パス区切りを落とす(別ディレクトリへ書かせない)", () => {
    // 先頭の ".." は「前後のドットを落とす」規則でさらに消える(先頭ドットは環境によって
    // 隠しファイル扱いになるため意図どおり)。
    expect(sanitizeExportBaseName("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(sanitizeExportBaseName("a\\b")).toBe("a_b");
  });

  it("環境によって使えない文字を落とす", () => {
    expect(sanitizeExportBaseName('a:b*c?d"e<f>g|h')).toBe("a_b_c_d_e_f_g_h");
  });

  it("前後の空白とドットを落とす", () => {
    expect(sanitizeExportBaseName("  .name.  ")).toBe("name");
  });

  it("空白だけなら空文字を返す(呼び出し側が自動値へ倒す)", () => {
    expect(sanitizeExportBaseName("   ")).toBe("");
  });

  it("長すぎる名前を切り詰める", () => {
    expect(sanitizeExportBaseName("a".repeat(300)).length).toBe(120);
  });

  it("日本語は残す(利用者が付けた名前を尊重する)", () => {
    expect(sanitizeExportBaseName("リュウの中足始動")).toBe("リュウの中足始動");
  });
});

describe("createExportBaseNameIssuer(対象を入れ替えた場合)", () => {
  // ★直前 1 件しか覚えていないと、A → B → A の 3 回目が 1 回目と衝突する。
  it("同じ秒に対象を入れ替えて戻っても、前に出した名前と衝突しない", () => {
    const issue = createExportBaseNameIssuer();
    const first = issue({ range: "all", count: 1, now: AT });
    const other = issue({ range: "selected", count: 1, now: AT });
    const again = issue({ range: "all", count: 1, now: AT });
    expect(new Set([first, other, again]).size).toBe(3);
  });
});
