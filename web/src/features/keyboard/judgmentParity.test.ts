// ★§5 (g)。判定の同一性——**同じ入力列に対して Gamepad とキーボードで同じステップ列が出る**。
//
// ★このテストが守っているのは「キーボードでも動く」ことではなく、**判定層が 1 つであること**である
//   （§4.5-2・§4.5-4／チェックリスト重大 1・2）。判定に「キーボードのときは」という分岐が入ると、
//   キーボードでもパッドでも正しく入力できてしまうためテストも手動確認も通ってしまい、
//   露見するのは次に判定を直す担当が片方だけ直したときになる。
//   ⇒ **両経路の出力を突き合わせることでしか捕まらない。**

import { describe, expect, it } from "vitest";

import { normalizeSnapshot } from "@/features/gamepad/normalize";
import { detectSteps } from "@/features/gamepad/stepDetection";
import type { GamepadSample } from "@/features/gamepad/stepDetection";
import type { PhysicalInputActionKind } from "@/features/gamepad/shortcut";
import type { GamepadProfile, GamepadSnapshot } from "@/features/gamepad/types";

import { normalizeKeyboard } from "./normalizeKeyboard";
import { KEYBOARD_ACTION_TARGETS, createEmptyBindings, withBinding } from "./types";
import type { KeyboardBindings, KeyboardTarget } from "./types";

// --- 対応する 2 つの割当 -------------------------------------------------------
// ★同じ論理ボタンに対して、Gamepad は物理 index、キーボードは code を割り当てる。
//   以下では「物理 index N ⇔ code KeyN」で 1 対 1 に対応させる。

const PAD_BUTTON_INDEX: Readonly<Record<string, number>> = {
  up: 0,
  down: 1,
  left: 2,
  right: 3,
  light_punch: 4,
  medium_punch: 5,
  heavy_punch: 6,
  light_kick: 7,
  medium_kick: 8,
  heavy_kick: 9,
};

const KEY_CODE: Readonly<Record<string, string>> = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  light_punch: "KeyU",
  medium_punch: "KeyI",
  heavy_punch: "KeyO",
  light_kick: "KeyJ",
  medium_kick: "KeyK",
  heavy_kick: "KeyL",
};

const PAD_PROFILE: GamepadProfile = {
  version: 1,
  padId: "parity-pad",
  browserKey: "chromium",
  directions: {
    up: { kind: "button", index: PAD_BUTTON_INDEX.up },
    down: { kind: "button", index: PAD_BUTTON_INDEX.down },
    left: { kind: "button", index: PAD_BUTTON_INDEX.left },
    right: { kind: "button", index: PAD_BUTTON_INDEX.right },
  },
  buttons: {
    light_punch: { kind: "button", index: PAD_BUTTON_INDEX.light_punch },
    medium_punch: { kind: "button", index: PAD_BUTTON_INDEX.medium_punch },
    heavy_punch: { kind: "button", index: PAD_BUTTON_INDEX.heavy_punch },
    light_kick: { kind: "button", index: PAD_BUTTON_INDEX.light_kick },
    medium_kick: { kind: "button", index: PAD_BUTTON_INDEX.medium_kick },
    heavy_kick: { kind: "button", index: PAD_BUTTON_INDEX.heavy_kick },
  },
};

const KEY_BINDINGS: KeyboardBindings = (() => {
  let bindings = createEmptyBindings();
  for (const [target, code] of Object.entries(KEY_CODE)) {
    bindings = withBinding(bindings, target as KeyboardTarget, {
      code,
      label: code,
    });
  }
  // ★操作キーもすべて登録しておく。押下集合へ混ざらないことが判定の同一性の前提である。
  //   ★件数を書き写さない（`M21-06` で 3 → 4 になった）。列挙から回して取りこぼさない。
  const ACTION_CODE: Record<PhysicalInputActionKind, string> = {
    delete: "Backspace",
    save: "KeyP",
    modifier: "KeyM",
    command_mode: "KeyC",
  };
  for (const action of KEYBOARD_ACTION_TARGETS) {
    bindings = withBinding(bindings, action, {
      code: ACTION_CODE[action],
      label: ACTION_CODE[action],
    });
  }
  return bindings;
})();

function padSnapshot(held: readonly string[]): GamepadSnapshot {
  const buttons = Array.from({ length: 10 }, () => ({
    pressed: false,
    value: 0,
  }));
  for (const target of held) {
    const index = PAD_BUTTON_INDEX[target];
    if (index !== undefined) buttons[index] = { pressed: true, value: 1 };
  }
  return {
    id: "parity-pad",
    index: 0,
    mapping: "standard",
    buttons,
    axes: [],
    timestamp: 0,
  };
}

function keyCodes(held: readonly string[]): Set<string> {
  return new Set(held.map((target) => KEY_CODE[target] ?? target));
}

/** 「時刻つきの押下状態列」を、両経路それぞれのサンプル列へ変換する。 */
function toSamples(
  frames: readonly (readonly [number, readonly string[]])[],
): { pad: GamepadSample[]; keyboard: GamepadSample[] } {
  return {
    pad: frames.map(([at, held]) => ({
      result: normalizeSnapshot(padSnapshot(held), PAD_PROFILE),
      at,
    })),
    keyboard: frames.map(([at, held]) => ({
      result: normalizeKeyboard(KEY_BINDINGS, keyCodes(held)),
      at,
    })),
  };
}

/** 入力列（時刻・押されているものの名前）→ 確定したステップ列 を両経路で比べる。 */
function expectSameSteps(
  frames: readonly (readonly [number, readonly string[]])[],
): void {
  const { pad, keyboard } = toSamples(frames);
  const padSteps = detectSteps(pad);
  const keyboardSteps = detectSteps(keyboard);

  expect(keyboardSteps).toEqual(padSteps);
  // ★片方が空でもう片方も空、では同一性の主張にならない。1 件以上出ていることを要求する。
  expect(padSteps.length).toBeGreaterThan(0);
}

describe("判定の同一性（Gamepad ⇔ キーボード）", () => {
  it("単発の 1 ボタン", () => {
    expectSameSteps([
      [0, []],
      [10, ["heavy_punch"]],
      [20, []],
      [500, []],
    ]);
  });

  it("判定窓の内側の同時押し（強P＋強K → 1 ステップ）", () => {
    expectSameSteps([
      [0, []],
      [10, ["heavy_punch"]],
      [30, ["heavy_punch", "heavy_kick"]],
      [60, []],
      [500, []],
    ]);
  });

  it("判定窓の外側は別ステップになる", () => {
    expectSameSteps([
      [0, []],
      [10, ["heavy_punch"]],
      [20, []],
      [300, ["heavy_kick"]],
      [310, []],
      [800, []],
    ]);
  });

  it("方向つきの入力（しゃがみ中K）", () => {
    expectSameSteps([
      [0, []],
      [10, ["down"]],
      [20, ["down", "medium_kick"]],
      [60, ["down"]],
      [500, []],
    ]);
  });

  it("斜め（下前）＋ボタン", () => {
    expectSameSteps([
      [0, []],
      [10, ["down", "right"]],
      [20, ["down", "right", "heavy_punch"]],
      [60, ["down", "right"]],
      [500, []],
    ]);
  });

  it("窓の内側で方向が後から入っても同じ結果になる", () => {
    expectSameSteps([
      [0, []],
      [10, ["heavy_punch"]],
      [25, ["heavy_punch", "right"]],
      [60, []],
      [500, []],
    ]);
  });

  it("連続入力（TC 相当）", () => {
    expectSameSteps([
      [0, []],
      [10, ["light_punch"]],
      [20, []],
      [200, ["medium_punch"]],
      [210, []],
      [400, ["heavy_punch"]],
      [410, []],
      [900, []],
    ]);
  });

  // ★操作用の入力が判定へ影響しないことも、両経路で同じでなければならない。
  //   キーボード側は操作キーを押しても押下集合が変わらないため、パッド側の「操作キーを押していない」
  //   入力列と同じ結果になる。
  it("操作用のキーを押しても判定結果は変わらない", () => {
    const withoutAction = toSamples([
      [0, []],
      [10, ["heavy_punch"]],
      [20, []],
      [500, []],
    ]);
    const keyboardWithAction = [
      [0, []],
      [10, ["heavy_punch"]],
      [15, ["heavy_punch", "Backspace"]],
      [20, []],
      [500, []],
    ].map(([at, held]) => ({
      result: normalizeKeyboard(
        KEY_BINDINGS,
        keyCodes(held as readonly string[]),
      ),
      at: at as number,
    }));

    expect(detectSteps(keyboardWithAction)).toEqual(
      detectSteps(withoutAction.pad),
    );
  });
});
