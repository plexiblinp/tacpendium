import { describe, expect, it } from "vitest";

import en from "./en.json";
import { OKI_ATTACK_TYPES, OKI_TECH_TYPES, okiOptionLabel, okiTechAndGaugeLabel } from "@/constants/oki";
import { formatStarterStatus } from "@/features/combo/utils";
import type { ComboSummary } from "@/features/combo/types";

// ★★M24-07 レビュー(中-1)で足した観測。
//
// no-japanese-in-en.test.ts は **en.json そのもの**を走査する。⇒ 辞書に日本語が
// 入っていれば捕まえるが、**コードが辞書の値と直書きの文字を合成した結果**は見ない。
//
// 実際にそれで漏れた ——
//   - okiTechAndGaugeLabel が区切りを `・`(U+30FB)で直書きしており、解決関数に
//     英語の t を渡しても英語 UI に和文の中黒が出ていた。
//   - formatStarterStatus の 3 段目 `始動技#<id>` が解決関数を通っていなかった。
// どちらも「辞書は英語だが、画面に出る文字列は日本語混じり」である。
//
// ⇒ 本ファイルは **合成後の文字列**を英語ロケールで組み立てて走査する。
//   ★新しい合成関数を足したら、ここへ 1 行足すこと。

const JAPANESE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿！-｠]/;

/** en.json をドット区切りで引く。{{var}} は差し込む(i18next の代わり)。 */
function enT(key: string, vars?: Record<string, string | number>): string {
  let cur: unknown = en;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (typeof cur !== "string") return key;
  if (!vars) return cur;
  return cur.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** 合成後の文字列を集める。★空なら走査が壊れている(陽性対照で守る)。 */
function composedStrings(): Array<[string, string]> {
  const out: Array<[string, string]> = [];

  for (const attackType of OKI_ATTACK_TYPES) {
    for (const techType of OKI_TECH_TYPES) {
      for (const usesDr of [true, false]) {
        const o = { attackType, techType, usesDr };
        out.push([`okiOptionLabel(${attackType},${techType},${usesDr})`, okiOptionLabel(o, enT)]);
        out.push([
          `okiTechAndGaugeLabel(${attackType},${techType},${usesDr})`,
          okiTechAndGaugeLabel(o, enT),
        ]);
      }
    }
  }

  // ★formatStarterStatus は 3 段のフォールバックを持つ。**全段**を通す ——
  //   1 段目(表示名)だけを見ると、日本語が残っているのは 3 段目なので気付けない。
  const base = { hitType: "normal", position: "mid_screen" } as unknown as ComboSummary;
  out.push([
    "formatStarterStatus(nameJa)",
    formatStarterStatus({ ...base, starterMoveNameJa: "Stand LP" } as ComboSummary, enT),
  ]);
  out.push([
    "formatStarterStatus(code)",
    formatStarterStatus({ ...base, starterMoveCode: "5LP" } as ComboSummary, enT),
  ]);
  out.push([
    "formatStarterStatus(id)",
    formatStarterStatus({ ...base, starterMoveId: 42 } as ComboSummary, enT),
  ]);
  out.push(["formatStarterStatus(none)", formatStarterStatus(base, enT)]);

  return out;
}

describe("合成後の文字列にも日本語が出ない(英語ロケール・M24-07 レビュー 中-1)", () => {
  const composed = composedStrings();

  it("★走査対象が空でない(陽性対照)", () => {
    // ★「0 件だった」は「無い」ではなく「走査が壊れている」かもしれない(E-84)。
    expect(composed.length).toBeGreaterThan(20);
  });

  it("★★合成結果に日本語が含まれない", () => {
    const violations = composed
      .filter(([, value]) => JAPANESE.test(value))
      .map(([label, value]) => `${label} = ${value}`);
    expect(violations).toEqual([]);
  });

  it("★区切りは英語では和文中黒ではない(この漏れが実在した)", () => {
    const label = okiTechAndGaugeLabel(
      { attackType: "shimmy", techType: "back_tech", usesDr: false },
      enT,
    );
    expect(label).not.toContain("・");
    expect(label).toBe("Back tech / No gauge");
  });

  it("★始動技が解決できないときの代替表示も英語になる(3 段目)", () => {
    const s = formatStarterStatus(
      { hitType: "normal", position: "mid_screen", starterMoveId: 42 } as unknown as ComboSummary,
      enT,
    );
    expect(s).toContain("Starter move #42");
    expect(s).not.toContain("始動技");
  });
});
