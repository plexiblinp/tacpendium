import { describe, expect, it } from "vitest";

import {
  detectPressedBinding,
  isSameBinding,
  normalizeSnapshot,
} from "./normalize";
import type { GamepadProfile, GamepadSnapshot } from "./types";

// ---------------------------------------------------------------------------
// フィクスチャ
//
// ★入力データの由来（指示書 §7.5-6）
// - Chrome 形: M21-RESEARCH-01 の実測値。GameSir G7 SE = `Xbox One Game Controller
//   (STANDARD GAMEPAD)` / mapping `standard` / buttons 17 / axes 4（Chrome 151・USB）。
//   D-pad が buttons 側に出る形を採る。
// - Firefox 形: ★我々は Firefox を計測していない（D-329。実機確認は M21 完了時の 1 回のみ）。
//   よって実測ではなく、Firefox の公表挙動から組み立てた「そうなりうる形」である——
//   (1) mapping が "standard" にならない (2) D-pad が axes 側に出る
//   (3) Chrome / Edge に無い軸を 1 つ持ち index が全軸ずれる。
//   ★「Firefox ではこうなる」と断定する意図はない。index を仮定しない設計であることを
//     検査するための入力であって、Firefox の挙動の主張ではない（指示書 §9.1-3）。
// ---------------------------------------------------------------------------

/**
 * @param pressedAt   index → value（pressed も true になる。デジタル押下の表現）
 * @param analogOnly  index → value（★pressed は false のまま value だけが動く状態。
 *                    トリガーの押し込み途中がこれにあたる）
 */
function buttons(
  count: number,
  pressedAt: Record<number, number> = {},
  analogOnly: Record<number, number> = {},
) {
  return Array.from({ length: count }, (_, i) => ({
    pressed: (pressedAt[i] ?? 0) > 0,
    value: pressedAt[i] ?? analogOnly[i] ?? 0,
  }));
}

const CHROME_PAD_ID = "Xbox One Game Controller (STANDARD GAMEPAD)";
const FIREFOX_PAD_ID = "045e-02ea-Xbox One Game Controller";

/** Chrome 形: D-pad が buttons、axes は 4 本。 */
const chromeProfile: GamepadProfile = {
  version: 1,
  padId: CHROME_PAD_ID,
  browserKey: "chromium",
  directions: {
    up: { kind: "button", index: 12 },
    down: { kind: "button", index: 13 },
    left: { kind: "button", index: 14 },
    right: { kind: "button", index: 15 },
  },
  buttons: {
    heavy_punch: { kind: "button", index: 3 },
    heavy_kick: { kind: "button", index: 7 },
  },
};

/**
 * Firefox 形: D-pad が axes、axes は 5 本（Chrome より 1 本多く index が全体にずれている）。
 * ★同じ論理ボタンへ到達することを見るためのプロファイルであり、index は Chrome 側と一致しない。
 */
const firefoxProfile: GamepadProfile = {
  version: 1,
  padId: FIREFOX_PAD_ID,
  browserKey: "firefox",
  directions: {
    left: { kind: "axis", index: 1, sign: -1, threshold: 0.5 },
    right: { kind: "axis", index: 1, sign: 1, threshold: 0.5 },
    up: { kind: "axis", index: 2, sign: -1, threshold: 0.5 },
    down: { kind: "axis", index: 2, sign: 1, threshold: 0.5 },
  },
  buttons: {
    heavy_punch: { kind: "button", index: 3 },
    heavy_kick: { kind: "button", index: 7 },
  },
};

function chromeSnapshot(
  pressedAt: Record<number, number>,
  analogOnly: Record<number, number> = {},
): GamepadSnapshot {
  return {
    id: CHROME_PAD_ID,
    index: 0,
    mapping: "standard",
    buttons: buttons(17, pressedAt, analogOnly),
    axes: [0, 0, 0, 0],
    timestamp: 1000,
  };
}

function firefoxSnapshot(
  axes: number[],
  pressedAt: Record<number, number> = {},
): GamepadSnapshot {
  return {
    id: FIREFOX_PAD_ID,
    index: 0,
    // ★mapping が "standard" ではない形。
    mapping: "",
    buttons: buttons(17, pressedAt),
    // ★Chrome に無い軸を 1 つ持つ（先頭に 1 本多い）ため index が全軸ずれている。
    axes,
    timestamp: 1000,
  };
}

function pressedButtons(result: ReturnType<typeof normalizeSnapshot>) {
  return result.states.map((s) => s.button).sort();
}

describe("normalizeSnapshot", () => {
  // (a) Chrome 形
  it("(a) Chrome 形(mapping standard・D-pad が buttons)から論理ボタンが出る", () => {
    // 上 + 左 + 強P → direction_7
    const result = normalizeSnapshot(
      chromeSnapshot({ 12: 1, 14: 1, 3: 1 }),
      chromeProfile,
    );

    expect(result.resolved).toBe(true);
    expect(pressedButtons(result)).toEqual(["direction_7", "heavy_punch"]);
  });

  it("(a') 方向が押されていなければ direction_neutral になる", () => {
    const result = normalizeSnapshot(chromeSnapshot({ 3: 1 }), chromeProfile);

    expect(result.resolved).toBe(true);
    expect(pressedButtons(result)).toEqual(["direction_neutral", "heavy_punch"]);
  });

  // (b) ★本サブのテストの主眼
  it("(b) Firefox 形(mapping 非 standard・D-pad が axes・axes が 1 つ多い)から同じ論理ボタンが出る", () => {
    // axes[1] = -1 (左) / axes[2] = -1 (上) → direction_7。buttons[3] = 強P。
    const result = normalizeSnapshot(
      firefoxSnapshot([0, -1, -1, 0, 0], { 3: 1 }),
      firefoxProfile,
    );

    expect(result.resolved).toBe(true);
    expect(pressedButtons(result)).toEqual(["direction_7", "heavy_punch"]);
  });

  it("(b') Chrome 形と Firefox 形が同じ入力に対して同じ論理ボタン集合を返す", () => {
    const fromChrome = normalizeSnapshot(
      chromeSnapshot({ 13: 1, 15: 1, 3: 1 }), // 下 + 右 + 強P
      chromeProfile,
    );
    const fromFirefox = normalizeSnapshot(
      firefoxSnapshot([0, 1, 1, 0, 0], { 3: 1 }), // 右 + 下 + 強P
      firefoxProfile,
    );

    expect(pressedButtons(fromChrome)).toEqual(["direction_3", "heavy_punch"]);
    expect(pressedButtons(fromFirefox)).toEqual(pressedButtons(fromChrome));
  });

  it("(b'') axes のしきい値未満は押下として扱わない", () => {
    const result = normalizeSnapshot(
      firefoxSnapshot([0, -0.2, 0, 0, 0]),
      firefoxProfile,
    );

    expect(pressedButtons(result)).toEqual(["direction_neutral"]);
  });

  // (c) アナログ
  it("(c) pressed が false のまま value だけが動く状態も上へ渡す", () => {
    // ★パッドのトリガーの押し込み途中（PoC 実測の 12 段階のうちの 1 つ）。
    //   pressed はまだ false だが value は動いている。normalize.ts の
    //   `if (!reading.pressed && reading.value <= 0) continue;` が守っている経路。
    const partial = normalizeSnapshot(
      chromeSnapshot({}, { 7: 0.570869990224829 }),
      chromeProfile,
    );
    const analog = partial.states.find((s) => s.button === "heavy_kick");

    expect(analog).toBeTruthy();
    expect(analog?.pressed).toBe(false);
    expect(analog?.value).toBeCloseTo(0.570869990224829);
  });

  it("(c') 完全に押されていないボタンは states に入らない", () => {
    const none = normalizeSnapshot(chromeSnapshot({}), chromeProfile);

    expect(none.states.find((s) => s.button === "heavy_kick")).toBeUndefined();
  });

  it("(c'') レバーレスは同じボタンでも 0/1 の 2 値で pressed と value が揃う", () => {
    const digital = normalizeSnapshot(chromeSnapshot({ 7: 1 }), chromeProfile);
    const digitalState = digital.states.find((s) => s.button === "heavy_kick");

    expect(digitalState?.pressed).toBe(true);
    expect(digitalState?.value).toBe(1);
  });

  // (d) 未知の形
  it("(d) プロファイルが無ければ例外を投げず resolved: false を返す", () => {
    const result = normalizeSnapshot(chromeSnapshot({ 3: 1 }), null);

    expect(result.resolved).toBe(false);
    expect(result.states).toEqual([]);
  });

  it("(d') 別の機体のプロファイルを渡されても解決しない", () => {
    const result = normalizeSnapshot(chromeSnapshot({ 3: 1 }), firefoxProfile);

    expect(result.resolved).toBe(false);
  });

  it("(d'') 割当が 1 つも無いプロファイルは解決しない(キャリブレーションへ倒す)", () => {
    const empty: GamepadProfile = {
      version: 1,
      padId: CHROME_PAD_ID,
      browserKey: "chromium",
      directions: {},
      buttons: {},
    };

    expect(normalizeSnapshot(chromeSnapshot({ 3: 1 }), empty).resolved).toBe(
      false,
    );
  });

  it("(d''') buttons / axes が空・NaN でも例外を投げない", () => {
    const malformed: GamepadSnapshot = {
      id: CHROME_PAD_ID,
      index: 0,
      mapping: "",
      buttons: [],
      axes: [Number.NaN],
      timestamp: 0,
    };

    expect(() => normalizeSnapshot(malformed, chromeProfile)).not.toThrow();
    // index が範囲外でも「押されていない」として扱い、落とさない。
    const result = normalizeSnapshot(malformed, chromeProfile);
    expect(result.states.every((s) => s.button === "direction_neutral")).toBe(
      true,
    );
  });

  it("(d'''') axes の本数が想定より少なくても例外を投げない", () => {
    // Firefox 用プロファイル(axes 1・2 を参照)に対して axes 1 本しか無い入力。
    const shortAxes = firefoxSnapshot([0]);

    expect(() => normalizeSnapshot(shortAxes, firefoxProfile)).not.toThrow();
  });
});

describe("SOCD 相殺前の生の上下左右（cardinals）", () => {
  it("相殺前の押下状態が残る（M21-02 が別の SOCD 規則を採れるようにする）", () => {
    // 左右同時 = states 側はニュートラルへ相殺されるが、生の事実は cardinals に残る。
    const result = normalizeSnapshot(
      chromeSnapshot({ 14: 1, 15: 1 }),
      chromeProfile,
    );

    expect(pressedButtons(result)).toEqual(["direction_neutral"]);
    expect(result.cardinals?.left.pressed).toBe(true);
    expect(result.cardinals?.right.pressed).toBe(true);
  });

  it("上下同時は上優先へ潰れるが、下の押下も cardinals には残る", () => {
    const result = normalizeSnapshot(
      chromeSnapshot({ 12: 1, 13: 1 }),
      chromeProfile,
    );

    expect(pressedButtons(result)).toEqual(["direction_8"]);
    expect(result.cardinals?.down.pressed).toBe(true);
  });

  it("方向の割当が無ければ cardinals は undefined", () => {
    const noDirections = { ...chromeProfile, directions: {} };
    const result = normalizeSnapshot(chromeSnapshot({ 3: 1 }), noDirections);

    expect(result.cardinals).toBeUndefined();
  });

  it("方向のアナログ量（レバーの倒し量）が捨てられない", () => {
    // axes 由来の方向は倒し量が value に乗る。
    const result = normalizeSnapshot(
      firefoxSnapshot([0, 0, -0.8, 0, 0]),
      firefoxProfile,
    );

    expect(result.cardinals?.up.value).toBeCloseTo(0.8);
    const direction = result.states.find((s) => s.button === "direction_8");
    expect(direction?.value).toBeCloseTo(0.8);
  });
});

describe("detectPressedBinding", () => {
  it("押されている buttons を拾う", () => {
    expect(detectPressedBinding(chromeSnapshot({ 5: 1 }), 0.5)).toEqual({
      kind: "button",
      index: 5,
    });
  });

  it("axes をしきい値と符号つきで拾う", () => {
    expect(detectPressedBinding(firefoxSnapshot([0, 0, -1, 0, 0]), 0.5)).toEqual(
      { kind: "axis", index: 2, sign: -1, threshold: 0.5 },
    );
  });

  it("何も押されていなければ null", () => {
    expect(detectPressedBinding(chromeSnapshot({}), 0.5)).toBeNull();
  });

  // ★H-3 の回帰固定: 静止値が 0 でない軸を持つ機体
  it("★静止時に -1 を返す軸を押下として誤検出しない（静止値を渡した場合）", () => {
    // トリガーが axes として現れ、静止時に -1 を返す機体を想定。
    // 静止値を渡さないと毎フレーム「押されている」と返り、キャリブレーションが
    // 押下エッジ待ちのまま恒久的に固まる。
    const resting = firefoxSnapshot([0, 0, 0, -1, -1]);
    const baseline = [0, 0, 0, -1, -1];

    expect(detectPressedBinding(resting, 0.5, baseline)).toBeNull();
  });

  it("★静止値からの変位で押下を拾う", () => {
    const baseline = [0, 0, 0, -1, -1];
    // 軸 3 が -1（静止）から 0 へ動いた = 変位 +1。
    const pushed = firefoxSnapshot([0, 0, 0, 0, -1]);

    expect(detectPressedBinding(pushed, 0.5, baseline)).toEqual({
      kind: "axis",
      index: 3,
      sign: 1,
      threshold: 0.5,
    });
  });

  it("静止値を渡さなければ 0 を静止値とみなす（後方互換）", () => {
    expect(
      detectPressedBinding(firefoxSnapshot([0, 0, 0, -1, 0]), 0.5, null),
    ).toEqual({ kind: "axis", index: 3, sign: -1, threshold: 0.5 });
  });

  it("静止値の配列が短くても例外を投げない", () => {
    expect(() =>
      detectPressedBinding(firefoxSnapshot([0, 0, -1, 0, 0]), 0.5, [0]),
    ).not.toThrow();
  });
});

describe("isSameBinding", () => {
  it("同じ物理入力を同一と判定する", () => {
    expect(
      isSameBinding({ kind: "button", index: 3 }, { kind: "button", index: 3 }),
    ).toBe(true);
    expect(
      isSameBinding({ kind: "button", index: 3 }, { kind: "button", index: 4 }),
    ).toBe(false);
  });

  it("同じ軸でも符号が違えば別物として扱う", () => {
    expect(
      isSameBinding(
        { kind: "axis", index: 1, sign: 1, threshold: 0.5 },
        { kind: "axis", index: 1, sign: -1, threshold: 0.5 },
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M21-04: 操作用ボタンの分離
// ---------------------------------------------------------------------------

describe("操作用ボタンは states に混ぜない（M21-04）", () => {
  const profile: GamepadProfile = {
    version: 1,
    padId: CHROME_PAD_ID,
    browserKey: "chromium",
    directions: { right: { kind: "button", index: 15 } },
    buttons: {
      heavy_punch: { kind: "button", index: 5 },
      shortcut_prefix: { kind: "button", index: 9 },
    },
  };

  it("★前置きは actions へ入り、states には現れない", () => {
    // ★states へ混ざると stepDetection の押下集合に入り、前置きを押しただけで
    //   ステップ候補が立って `unknown_combination` として読取表示へ出る。
    const result = normalizeSnapshot(chromeSnapshot({ 9: 1 }), profile);

    expect(result.states.map((s) => s.button)).not.toContain("shortcut_prefix");
    expect(result.actions?.map((s) => s.button)).toEqual(["shortcut_prefix"]);
  });

  it("技のボタンは従来どおり states へ入る", () => {
    const result = normalizeSnapshot(chromeSnapshot({ 5: 1 }), profile);

    expect(result.states.map((s) => s.button)).toContain("heavy_punch");
    expect(result.actions).toEqual([]);
  });

  it("同時に押されていても、それぞれの側へ分かれる", () => {
    const result = normalizeSnapshot(chromeSnapshot({ 5: 1, 9: 1 }), profile);

    expect(result.states.map((s) => s.button)).toContain("heavy_punch");
    expect(result.states.map((s) => s.button)).not.toContain("shortcut_prefix");
    expect(result.actions?.map((s) => s.button)).toEqual(["shortcut_prefix"]);
  });
});
