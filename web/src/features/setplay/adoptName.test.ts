import { describe, it, expect } from "vitest";

import ja from "@/locales/ja.json";
import en from "@/locales/en.json";
import { buildAdoptedSetupName, lastMoveStep } from "./adoptName";
import type { SetplaySuggestionStep } from "./types";

// ★★M24-05(SM-088): これは「新しく作った規則」のテストではない。
//   開発者の実機確認(D-588)で「既に実装済み」と分かった自動生成が、
//   実際に成立していることを固定するテストである(指示書 §4.4 / §5.1)。
//
// ★★実測した規則を書く。設計卓の暫定案(`{attack_type}・{最後の技}`)は書かない
//   ——実装は `{技名} 持続{n}F目重ね` であり、暫定案とは一致しない。

const step = (moveId: number, code: string): SetplaySuggestionStep => ({
  moveId,
  code,
  role: "filler",
  counted: true,
});

// locales/ja.json の setplay.adoptNameFormat を、i18next の補間と同じ形で再現する。
const jaFormat = ({ move, n }: { move: string; n: number }) =>
  `${move} 持続${n}F目重ね`;

const names = new Map<number, string>([
  [1, "前ステップ"],
  [2, "鎖骨割り"],
]);
const displayName = (moveId: number, code: string) => names.get(moveId) ?? code;

// ★★下の jaFormat は locales の書式の複製である。複製したものをテストしても
//   実装は守れないため、まず「複製元が変わっていないこと」を固定する。
//   ⇒ 書式が変わればここが赤くなり、複製が静かにずれることは起きない。
describe("setplay.adoptNameFormat(規則の正本)", () => {
  it("ja の書式が実測どおりである", () => {
    expect(ja.setplay.adoptNameFormat).toBe("{{move}} 持続{{n}}F目重ね");
  });

  it("en の書式が実測どおりである", () => {
    expect(en.setplay.adoptNameFormat).toBe("{{move}} meaty on active frame {{n}}");
  });

  it("複製した jaFormat が正本と同じ結果を出す", () => {
    const rendered = ja.setplay.adoptNameFormat
      .replace("{{move}}", "鎖骨割り")
      .replace("{{n}}", "4");
    expect(rendered).toBe(jaFormat({ move: "鎖骨割り", n: 4 }));
  });
});

describe("lastMoveStep", () => {
  it("末尾のステップを返す(最後の技)", () => {
    const s = { steps: [step(1, "dash_forward"), step(2, "sokotsu")] };
    expect(lastMoveStep(s)?.moveId).toBe(2);
  });

  it("steps が空なら undefined", () => {
    expect(lastMoveStep({ steps: [] })).toBeUndefined();
  });

  it("ステップが 1 本ならそれが最後の技", () => {
    expect(lastMoveStep({ steps: [step(2, "sokotsu")] })?.moveId).toBe(2);
  });
});

describe("buildAdoptedSetupName", () => {
  it("最後の技の表示名と n から名前を組み立てる", () => {
    const s = { steps: [step(1, "dash_forward"), step(2, "sokotsu")], n: 4 };
    // ★逐語で固定する。区切りは半角スペース 1 個。
    expect(buildAdoptedSetupName(s, displayName, jaFormat)).toBe(
      "鎖骨割り 持続4F目重ね",
    );
  });

  it("技名が解決できないときは code へ落ちる", () => {
    const s = { steps: [step(99, "unknown_move")], n: 2 };
    expect(buildAdoptedSetupName(s, displayName, jaFormat)).toBe(
      "unknown_move 持続2F目重ね",
    );
  });

  it("最後の技だけを使う(手前のステップは名前に入らない)", () => {
    const s = { steps: [step(1, "dash_forward"), step(2, "sokotsu")], n: 3 };
    expect(buildAdoptedSetupName(s, displayName, jaFormat)).not.toContain(
      "前ステップ",
    );
  });

  it("attack_type の語彙(投げ重ね/シミー/打撃重ね)は使わない", () => {
    const s = { steps: [step(2, "sokotsu")], n: 4 };
    const name = buildAdoptedSetupName(s, displayName, jaFormat);
    // ★設計卓の暫定案との差を固定する。実装は「重ね」の 1 語しか持たない。
    expect(name).not.toContain("打撃重ね");
    expect(name).not.toContain("投げ重ね");
    expect(name).not.toContain("シミー");
    expect(name).not.toContain("・");
    expect(name).toContain("重ね");
  });

  it("steps が空なら空文字(VAL-S06 が保存を止める)", () => {
    expect(buildAdoptedSetupName({ steps: [], n: 4 }, displayName, jaFormat)).toBe("");
  });

  it("n はそのまま差し込まれる", () => {
    const s = { steps: [step(2, "sokotsu")], n: 12 };
    expect(buildAdoptedSetupName(s, displayName, jaFormat)).toBe(
      "鎖骨割り 持続12F目重ね",
    );
  });
});
