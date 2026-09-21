import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ★★★M37-01 §5-2 / チェックリスト A-2 の破壊確認(層 2/3)。
//
// `D-731` の不変条件 2 ＝「区分を持つのは始動位置だけであり、運び量を区分へ丸めない」。
// **「運び量に区分を付けなかった」では不変条件にならない** —— 次に触る担当を止められない。
// ⇒ 付けられない形にする。本ファイルはそのうち「実装の中身」を見る層である。
//
// | 層 | 何を止めるか | どこ |
// |---|---|---|
// | 1 | props に区分の口を後から足すこと | MassPercentInput.test.tsx(props 完全一致の型テスト) |
// | 2 | 部品の中に区分の UI を直接書くこと | **本ファイル** |
// | 3 | 運び量の欄に区分が描画されること | ComboEditorBasicFields.test.tsx(RTL) |
//
// ★層 1 だけでは足りない —— props を増やさずに、部品の中へ区分ボタンを直接
//   書き込むことができてしまう。★層 3 だけでも足りない —— 描画条件を分ければ
//   テストの見ていない経路に区分が生える。⇒ 3 層で挟む。
//
// 先例: web/src/lib/query-keys.convention.test.ts(それ自身が
//       web/src/locales/retired-words.test.ts を先例として挙げている)。

const TARGET = join(
  process.cwd(),
  "src",
  "features",
  "combo",
  "components",
  "MassPercentInput.tsx",
);

/** 区分に関わる記号。★1 つでも本部品へ入ったら不変条件 2 が破れている。 */
const FORBIDDEN = [
  "POSITION_OPTIONS",
  "POSITION_BANDS",
  "POSITION_LABEL_JA",
  "POSITION_LABELS",
  "POSITION_LABEL_KEYS",
  "POSITION_VALUES",
  "OptionButtonGroup",
  "positionFromMass",
  "representativeMassOf",
  "withUnspecifiedFirst",
] as const;

/**
 * コメントを落とす。
 *
 * ★★これが要る理由 —— 本部品の godoc は「区分を持たない」ことを説明するために
 *   禁止語そのものを書いている。★注記を書けなくする検査は、注記を消させるだけである。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("MassPercentInput は区分を持てない(D-731 不変条件 2・破壊確認 層 2)", () => {
  const raw = readFileSync(TARGET, "utf8");
  const code = stripComments(raw);

  // ★検査そのものが壊れて素通りしないことを先に確かめる(先例と同じ自己点検)。
  it("走査対象が空でない(検査そのものが壊れていないこと)", () => {
    expect(raw.length).toBeGreaterThan(500);
    expect(code).toContain("export function MassPercentInput");
  });

  it.each(FORBIDDEN)("実装が %s を参照しない", (symbol) => {
    expect(code).not.toContain(symbol);
  });

  // ★陽性対照: 落としているのはコメントだけであり、実装は残っていること。
  //   これが無いと stripComments が全部消しても上のテストは緑になる。
  it("陽性対照: コメントだけが落ちている", () => {
    expect(raw).toContain("POSITION_OPTIONS"); // 注記の中には在る
    expect(code).toContain("percentToMass"); // 実装は残っている
    expect(code).toContain("massToPercent");
  });
});
