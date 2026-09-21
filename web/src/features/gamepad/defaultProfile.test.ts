import { describe, expect, it } from "vitest";

import {
  createStandardProfile,
  supportsStandardDefault,
} from "./defaultProfile";
import { OPTIONAL_TARGETS, REQUIRED_TARGETS } from "./logicalButtons";
import { bindingOf, isProfileComplete } from "./profile";

const PAD_ID = "Xbox One Game Controller (STANDARD GAMEPAD)";

describe("supportsStandardDefault", () => {
  it("standard を名乗る機体にだけ既定を当てる", () => {
    expect(supportsStandardDefault("standard")).toBe(true);
  });

  it("★standard でない機体には当てない（キャリブレーションへ倒す）", () => {
    // Firefox 形など。標準を「要件」にしないための検査。
    expect(supportsStandardDefault("")).toBe(false);
    expect(supportsStandardDefault("standard-gamepad")).toBe(false);
  });
});

describe("createStandardProfile", () => {
  const profile = createStandardProfile("chromium", PAD_ID);

  it("必須区間（方向 4 ＋ 攻撃 6）がすべて埋まる＝そのまま使える", () => {
    expect(isProfileComplete(profile)).toBe(true);
    for (const target of REQUIRED_TARGETS) {
      expect(bindingOf(profile, target)).toBeTruthy();
    }
  });

  it("★マクロは含めない（利用者が任意に割り当てるものを推測で当てない）", () => {
    for (const target of OPTIONAL_TARGETS) {
      expect(bindingOf(profile, target)).toBeUndefined();
    }
    expect(Object.keys(profile.buttons)).toHaveLength(6);
  });

  it("方向は D-pad（standard の 12〜15）に当たる", () => {
    expect(bindingOf(profile, "up")).toEqual({ kind: "button", index: 12 });
    expect(bindingOf(profile, "down")).toEqual({ kind: "button", index: 13 });
    expect(bindingOf(profile, "left")).toEqual({ kind: "button", index: 14 });
    expect(bindingOf(profile, "right")).toEqual({ kind: "button", index: 15 });
  });

  it("攻撃 6 ボタンは SF6 クラシック既定に当たる", () => {
    expect(bindingOf(profile, "light_punch")).toEqual({ kind: "button", index: 2 });
    expect(bindingOf(profile, "medium_punch")).toEqual({ kind: "button", index: 3 });
    expect(bindingOf(profile, "heavy_punch")).toEqual({ kind: "button", index: 5 });
    expect(bindingOf(profile, "light_kick")).toEqual({ kind: "button", index: 0 });
    expect(bindingOf(profile, "medium_kick")).toEqual({ kind: "button", index: 1 });
    expect(bindingOf(profile, "heavy_kick")).toEqual({ kind: "button", index: 7 });
  });

  it("同じ物理ボタンが 2 つの論理ボタンへ重複して当たっていない", () => {
    const indexes = [
      ...Object.values(profile.directions),
      ...Object.values(profile.buttons),
    ].map((b) => `${b.kind}:${b.index}`);

    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("渡した機体・ブラウザがそのまま入る（非破壊の新規オブジェクト）", () => {
    const a = createStandardProfile("firefox", "PadA");
    const b = createStandardProfile("chromium", "PadB");

    expect(a.browserKey).toBe("firefox");
    expect(a.padId).toBe("PadA");
    expect(b.directions).not.toBe(a.directions);
  });
});
