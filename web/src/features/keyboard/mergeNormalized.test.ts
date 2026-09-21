import { describe, expect, it } from "vitest";

import { normalizeSnapshot } from "@/features/gamepad/normalize";
import type {
  GamepadProfile,
  GamepadSnapshot,
  NormalizeResult,
} from "@/features/gamepad/types";

import { mergeNormalized } from "./mergeNormalized";
import { normalizeKeyboard } from "./normalizeKeyboard";
import { createEmptyBindings, withBinding } from "./types";
import type { KeyboardBindings, KeyboardTarget } from "./types";

function cardinals(held: {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
}) {
  const one = (pressed: boolean | undefined) => ({
    pressed: pressed === true,
    value: pressed === true ? 1 : 0,
    source: "button" as const,
  });
  return {
    up: one(held.up),
    down: one(held.down),
    left: one(held.left),
    right: one(held.right),
  };
}

function result(
  direction: string,
  buttons: readonly string[],
  held: Parameters<typeof cardinals>[0],
): NormalizeResult {
  return {
    states: [
      {
        button: direction as NormalizeResult["states"][number]["button"],
        pressed: true,
        value: 0,
        source: "button",
      },
      ...buttons.map((b) => ({
        button: b as NormalizeResult["states"][number]["button"],
        pressed: true,
        value: 1,
        source: "button" as const,
      })),
    ],
    cardinals: cardinals(held),
    actions: [],
    resolved: true,
  };
}

describe("mergeNormalized", () => {
  it("両方とも未解決なら未解決", () => {
    expect(mergeNormalized(null, null).resolved).toBe(false);
    expect(
      mergeNormalized({ states: [], resolved: false }, null).resolved,
    ).toBe(false);
  });

  it("片方だけ解決していればそれをそのまま使う", () => {
    const only = result("direction_neutral", ["heavy_punch"], {});
    expect(mergeNormalized(only, null)).toBe(only);
    expect(mergeNormalized(null, only)).toBe(only);
    expect(mergeNormalized({ states: [], resolved: false }, only)).toBe(only);
  });

  // ★これが合流の要。押下集合が 1 本にならないと、片方の push がもう片方を「離した」と見せる。
  it("両源のボタンを 1 本の押下集合へ合流する", () => {
    const pad = result("direction_neutral", ["heavy_punch"], {});
    const key = result("direction_neutral", ["heavy_kick"], {});
    const merged = mergeNormalized(pad, key);

    const buttons = merged.states.map((s) => s.button);
    expect(buttons).toContain("heavy_punch");
    expect(buttons).toContain("heavy_kick");
  });

  it("同じボタンが両源から来ても 1 件にまとまる", () => {
    const pad = result("direction_neutral", ["heavy_punch"], {});
    const key = result("direction_neutral", ["heavy_punch"], {});
    const merged = mergeNormalized(pad, key);

    const heavy = merged.states.filter((s) => s.button === "heavy_punch");
    expect(heavy).toHaveLength(1);
    expect(heavy[0].pressed).toBe(true);
  });

  // ★方向は「どちらかの digit を選ぶ」のではなく、合流後の上下左右から採り直す。
  it("パッドの 6 とキーボードの 2 が合流して 3（下前）になる", () => {
    const pad = result("direction_6", [], { right: true });
    const key = result("direction_2", [], { down: true });
    const merged = mergeNormalized(pad, key);

    expect(merged.states[0].button).toBe("direction_3");
    expect(merged.states[0].source).toBe("derived");
  });

  it("合流後も SOCD 規則は 1 つ（左右は相殺）", () => {
    const pad = result("direction_6", [], { right: true });
    const key = result("direction_4", [], { left: true });
    const merged = mergeNormalized(pad, key);

    expect(merged.states[0].button).toBe("direction_neutral");
  });

  it("方向を持つのが片方だけなら、その方向がそのまま出る", () => {
    const pad: NormalizeResult = {
      states: [
        { button: "heavy_punch", pressed: true, value: 1, source: "button" },
      ],
      actions: [],
      resolved: true,
    };
    const key = result("direction_2", [], { down: true });
    const merged = mergeNormalized(pad, key);

    expect(merged.states[0].button).toBe("direction_2");
    expect(merged.states.map((s) => s.button)).toContain("heavy_punch");
  });

  it("操作用の状態も合流する（押下集合とは別枠のまま）", () => {
    const pad: NormalizeResult = {
      states: [],
      actions: [
        { button: "shortcut_prefix", pressed: true, value: 1, source: "button" },
      ],
      resolved: true,
    };
    const key = result("direction_neutral", ["heavy_punch"], {});
    const merged = mergeNormalized(pad, key);

    expect(merged.actions?.map((s) => s.button)).toEqual(["shortcut_prefix"]);
    expect(merged.states.map((s) => s.button)).not.toContain("shortcut_prefix");
  });
});

// ===========================================================================
// ★恒等性——**合流を通しても、判定層へ入る形が変わらないこと**（レビュー指摘 中-1）
// ===========================================================================
//
// ★上の 8 件は「合流したときに正しく混ざるか」を見ている。本節は逆に
//   **「合流しても壊れないか」**（片側が中立のときに元の結果と一致するか）を見る。
//   ★壊れ方としては後者のほうが静かである——**キーボードを一度でも触ったセッションだけ
//     判定への入力が変わる**という形になり、再現条件が「触ったかどうか」になる。

const PAD_ID = "identity-pad";

const PAD_PROFILE: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "chromium",
  directions: {
    up: { kind: "button", index: 0 },
    down: { kind: "button", index: 1 },
    left: { kind: "button", index: 2 },
    right: { kind: "button", index: 3 },
  },
  buttons: {
    heavy_punch: { kind: "button", index: 6 },
    heavy_kick: { kind: "button", index: 9 },
  },
};

function padSnapshot(pressed: readonly number[]): GamepadSnapshot {
  return {
    id: PAD_ID,
    index: 0,
    mapping: "standard",
    buttons: Array.from({ length: 12 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
    axes: [],
    timestamp: 0,
  };
}

function keyboardBindings(): KeyboardBindings {
  let b = createEmptyBindings();
  const pairs: readonly (readonly [KeyboardTarget, string])[] = [
    ["up", "KeyW"],
    ["down", "KeyS"],
    ["left", "KeyA"],
    ["right", "KeyD"],
    ["heavy_punch", "KeyO"],
  ];
  for (const [target, code] of pairs) {
    b = withBinding(b, target, { code, label: code });
  }
  return b;
}

describe("恒等性（合流しても判定への入力が変わらない）", () => {
  const NEUTRAL_KEYBOARD = () =>
    normalizeKeyboard(keyboardBindings(), new Set<string>());

  it("キーボードが中立なら、パッドの結果がそのまま出る（方向のみ）", () => {
    const pad = normalizeSnapshot(padSnapshot([1]), PAD_PROFILE); // 下
    expect(mergeNormalized(pad, NEUTRAL_KEYBOARD())).toEqual(pad);
  });

  it("キーボードが中立なら、パッドの結果がそのまま出る（方向＋ボタン）", () => {
    const pad = normalizeSnapshot(padSnapshot([1, 6]), PAD_PROFILE);
    expect(mergeNormalized(pad, NEUTRAL_KEYBOARD())).toEqual(pad);
  });

  it("キーボードが中立なら、パッドの結果がそのまま出る（斜め）", () => {
    const pad = normalizeSnapshot(padSnapshot([1, 3]), PAD_PROFILE); // 下前
    expect(mergeNormalized(pad, NEUTRAL_KEYBOARD())).toEqual(pad);
  });

  it("キーボードが中立なら、パッドの結果がそのまま出る（何も押していない）", () => {
    const pad = normalizeSnapshot(padSnapshot([]), PAD_PROFILE);
    expect(mergeNormalized(pad, NEUTRAL_KEYBOARD())).toEqual(pad);
  });

  // ★逆向きも同じでなければならない（パッド未接続でキーボードだけ使う利用者）。
  it("パッドが未解決なら、キーボードの結果がそのまま出る", () => {
    const keyboard = normalizeKeyboard(
      keyboardBindings(),
      new Set(["KeyS", "KeyO"]),
    );
    expect(mergeNormalized(null, keyboard)).toEqual(keyboard);
    expect(mergeNormalized({ states: [], resolved: false }, keyboard)).toEqual(
      keyboard,
    );
  });

  // ★★方向の `source` の採り方が `normalize.ts` と揃っていること（レビュー指摘 中-1）。
  //
  // ★**この形でしか差が出ない。** 差が出る条件は 3 つ揃ったときだけである——
  //   (1) 方向が 2 つ同時に押されている (2) その合成が**斜めではない**（斜めは両者とも
  //   "derived" に潰れる） (3) 2 つの由来が違う（axis と button）。
  //   ⇒ **上下同時押し（＝上優先で `direction_8`）で、上が axis・下が button** のときに、
  //     `normalize.ts` は「最後に当たった押下＝下＝button」を採り、
  //     素朴な `find` 実装は「最初に当たった押下＝上＝axis」を採って食い違う。
  //
  // ★`value` 側は**実は差が出ない**——`readBinding` の `pressed` は
  //   `projected >= threshold`、`value` は `clamp(projected)` であるため、
  //   **押されていない cardinal の値は必ず閾値未満＝押されている値以下**になる。
  //   ⇒ 「全体の最大」と「押下の最大」は一致する。それでも押下側で採るのは、
  //     規則を `normalize.ts` と同一の文面に保つためである（読み手が 2 通りを比べずに済む）。
  it("上下同時押し（上が axis・下が button）で source が normalize.ts と一致する", () => {
    const mixedProfile: GamepadProfile = {
      ...PAD_PROFILE,
      directions: {
        up: { kind: "axis", index: 0, sign: 1, threshold: 0.5 },
        down: { kind: "button", index: 1 },
        left: { kind: "button", index: 2 },
        right: { kind: "button", index: 3 },
      },
    };
    const snapshot: GamepadSnapshot = {
      ...padSnapshot([1]), // 下（button）を押す
      axes: [1], // 上（axis）も倒す
    };

    const pad = normalizeSnapshot(snapshot, mixedProfile);
    const padDirection = pad.states.find((s) =>
      s.button.startsWith("direction_"),
    );
    // 前提の確認: 上優先で 8、かつ斜めではないので source が実際に使われる。
    expect(padDirection?.button).toBe("direction_8");
    expect(padDirection?.source).toBe("button");

    const merged = mergeNormalized(pad, NEUTRAL_KEYBOARD());
    expect(merged.states.find((s) => s.button.startsWith("direction_"))?.source).toBe(
      padDirection?.source,
    );
  });

  // ★押していない cardinal の値が混ざらないこと（規則の文面を揃えるための担保）。
  it("方向の value / source の採り方が normalize.ts と一致する", () => {
    const pad = normalizeSnapshot(padSnapshot([3]), PAD_PROFILE); // 右
    const merged = mergeNormalized(pad, NEUTRAL_KEYBOARD());

    const padDirection = pad.states.find((s) => s.button.startsWith("direction_"));
    const mergedDirection = merged.states.find((s) =>
      s.button.startsWith("direction_"),
    );
    expect(mergedDirection?.value).toBe(padDirection?.value);
    expect(mergedDirection?.source).toBe(padDirection?.source);
  });
});
