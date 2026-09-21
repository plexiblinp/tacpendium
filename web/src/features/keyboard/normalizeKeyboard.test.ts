import { describe, expect, it } from "vitest";

import { normalizeKeyboard, actionForKey, isMoveKey } from "./normalizeKeyboard";
import { createEmptyBindings, withBinding } from "./types";
import type { KeyboardBindings, KeyboardTarget } from "./types";

function bind(
  pairs: readonly (readonly [KeyboardTarget, string])[],
): KeyboardBindings {
  let bindings = createEmptyBindings();
  for (const [target, code] of pairs) {
    bindings = withBinding(bindings, target, { code, label: code });
  }
  return bindings;
}

const FULL = bind([
  ["up", "KeyW"],
  ["down", "KeyS"],
  ["left", "KeyA"],
  ["right", "KeyD"],
  ["light_punch", "KeyU"],
  ["medium_punch", "KeyI"],
  ["heavy_punch", "KeyO"],
  ["light_kick", "KeyJ"],
  ["medium_kick", "KeyK"],
  ["heavy_kick", "KeyL"],
  ["delete", "Backspace"],
  ["save", "KeyP"],
  ["modifier", "KeyM"],
]);

describe("normalizeKeyboard", () => {
  it("未登録では解決しない（既定を当てない＝§4.1-3）", () => {
    const result = normalizeKeyboard(createEmptyBindings(), new Set(["KeyW"]));
    expect(result.resolved).toBe(false);
    expect(result.states).toHaveLength(0);
  });

  it("方向は状態として常に入る（未入力ならニュートラル）", () => {
    const result = normalizeKeyboard(FULL, new Set());
    expect(result.resolved).toBe(true);
    expect(result.states).toHaveLength(1);
    expect(result.states[0].button).toBe("direction_neutral");
    expect(result.states[0].pressed).toBe(true);
  });

  it("押したキーが論理ボタンへ写る", () => {
    const result = normalizeKeyboard(FULL, new Set(["KeyO"]));
    const buttons = result.states.map((s) => s.button);
    expect(buttons).toContain("heavy_punch");
  });

  it("斜めは 2 つの同時押しから導出する（登録するのは 4 方向だけ）", () => {
    const result = normalizeKeyboard(FULL, new Set(["KeyS", "KeyD"]));
    expect(result.states[0].button).toBe("direction_3");
    expect(result.states[0].source).toBe("derived");
  });

  it("SOCD は Gamepad と同じ規則（左右は相殺・上下は上優先）", () => {
    const leftRight = normalizeKeyboard(FULL, new Set(["KeyA", "KeyD"]));
    expect(leftRight.states[0].button).toBe("direction_neutral");

    const upDown = normalizeKeyboard(FULL, new Set(["KeyW", "KeyS"]));
    expect(upDown.states[0].button).toBe("direction_8");
  });

  // ★§5 (e)。チェックリスト重大 5。
  it("操作用のキーは押下集合に入らない", () => {
    const result = normalizeKeyboard(
      FULL,
      new Set(["Backspace", "KeyP", "KeyM"]),
    );
    const buttons = result.states.map((s) => s.button);
    // 方向のニュートラル 1 件だけが入り、操作キーは 1 つも現れない。
    expect(buttons).toEqual(["direction_neutral"]);
    expect(result.actions).toEqual([]);
  });

  it("操作用のキーは技用の割当としても引けない", () => {
    expect(isMoveKey(FULL, "Backspace")).toBe(false);
    expect(isMoveKey(FULL, "KeyO")).toBe(true);
  });

  it("操作用のキーは操作として引ける（前置きを挟まない＝§4.2-1）", () => {
    expect(actionForKey(FULL, "Backspace")).toBe("delete");
    expect(actionForKey(FULL, "KeyP")).toBe("save");
    expect(actionForKey(FULL, "KeyM")).toBe("modifier");
    expect(actionForKey(FULL, "KeyO")).toBe(null);
  });

  it("方向を 1 つも登録していなければ方向の状態を作らない", () => {
    const onlyButtons = bind([["heavy_punch", "KeyO"]]);
    const result = normalizeKeyboard(onlyButtons, new Set(["KeyO"]));
    expect(result.cardinals).toBeUndefined();
    expect(result.states.map((s) => s.button)).toEqual(["heavy_punch"]);
  });
});
