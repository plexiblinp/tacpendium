import { describe, expect, it } from "vitest";

import {
  MEASURED_MAX_PRESS_SPREAD_MS,
  MEASURED_MAX_RELEASE_SPREAD_MS,
  SIMULTANEOUS_PRESS_WINDOW_MS,
  closePendingStep,
  createStepDetectionState,
  detectSteps,
  flushPendingStep,
  pushSample,
  resolveDirection,
  seedSample,
} from "./stepDetection";
import type { GamepadSample } from "./stepDetection";
import type {
  CardinalState,
  DirectionCardinal,
  LogicalButton,
  NormalizeResult,
} from "./types";

// ---------------------------------------------------------------------------
// フィクスチャ
//
// ★本サブの入力は「M21-01 の正規化結果 ＋ 時刻」である。正規化そのものは M21-01 の
//   normalize.test.ts が見ているため、ここでは正規化の出力形だけを組み立てる。
// ★時刻はすべてミリ秒。フレーム数は使わない（指示書 §4.2。60 Hz 環境で意味が変わるため）。
// ---------------------------------------------------------------------------

type Held = Partial<Record<DirectionCardinal, boolean>>;

function cardinal(pressed: boolean): CardinalState {
  return { pressed, value: pressed ? 1 : 0, source: "button" };
}

function cardinals(held: Held): Record<DirectionCardinal, CardinalState> {
  return {
    up: cardinal(held.up === true),
    down: cardinal(held.down === true),
    left: cardinal(held.left === true),
    right: cardinal(held.right === true),
  };
}

/**
 * 正規化結果を組み立てる。
 *
 * ★M21-01 の実際の出力に合わせる——方向は割当があれば `states` に**常に 1 つ**入り
 *   （未入力時は `direction_neutral` が `pressed: true`）、ボタンは押されているものだけが入る
 *   （`M21-01-completion-report.md` §4 の申し送り 1）。
 */
function normalized(
  pressed: readonly LogicalButton[],
  held: Held = {},
  direction: LogicalButton = "direction_neutral",
): NormalizeResult {
  return {
    states: [
      { button: direction, pressed: true, value: 0, source: "button" },
      ...pressed.map((button) => ({
        button,
        pressed: true,
        value: 1,
        source: "button" as const,
      })),
    ],
    cardinals: cardinals(held),
    resolved: true,
  };
}

function sample(
  at: number,
  pressed: readonly LogicalButton[],
  held: Held = {},
  direction: LogicalButton = "direction_neutral",
): GamepadSample {
  return { at, result: normalized(pressed, held, direction) };
}

const LP: LogicalButton = "light_punch";
const MP: LogicalButton = "medium_punch";
const HP: LogicalButton = "heavy_punch";
const HK: LogicalButton = "heavy_kick";

// ---------------------------------------------------------------------------
// (a)(b)(c)(e) 判定窓
// ---------------------------------------------------------------------------

describe("同時押しの集約（判定窓）", () => {
  it("(a) 窓の内側で立ち上がった 2 ボタンが 1 ステップにまとまる", () => {
    // 実測の中央値 8.30 ms 相当のズレ（D-324）。
    const steps = detectSteps([
      sample(0, []),
      sample(10, [LP]),
      sample(18.3, [LP, MP]),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP, MP]);
    expect(steps[0].startedAt).toBe(10);
    expect(steps[0].mergedCount).toBe(2);
  });

  it("(b) 窓の外側なら 2 ステップに割れる", () => {
    const steps = detectSteps([
      sample(0, []),
      sample(10, [LP]),
      sample(10 + SIMULTANEOUS_PRESS_WINDOW_MS + 20, [LP, MP]),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].buttons).toEqual([LP]);
    expect(steps[1].buttons).toEqual([MP]);
  });

  it("(c) 境界値ちょうど（t0 + 窓）は新しいステップになる＝半開区間 [t0, t0+W)", () => {
    const exactly = detectSteps([
      sample(0, [LP]),
      sample(SIMULTANEOUS_PRESS_WINDOW_MS, [LP, MP]),
    ]);
    expect(exactly).toHaveLength(2);
    expect(exactly[0].buttons).toEqual([LP]);
    expect(exactly[1].buttons).toEqual([MP]);
  });

  it("(c') 境界の 1 つ内側はまとまる", () => {
    const inside = detectSteps([
      sample(0, [LP]),
      sample(SIMULTANEOUS_PRESS_WINDOW_MS - 0.1, [LP, MP]),
    ]);
    expect(inside).toHaveLength(1);
    expect(inside[0].buttons).toEqual([LP, MP]);
  });

  it("(e) 3 ボタン以上の同時押しがまとまる", () => {
    const steps = detectSteps([
      sample(0, []),
      sample(5, [LP]),
      sample(9.2, [LP, MP]),
      sample(16.7, [LP, MP, HP]),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP, MP, HP]);
    expect(steps[0].mergedCount).toBe(3);
  });

  it("窓の起点は最初の立ち上がりに固定される（最後の立ち上がりから延長しない）", () => {
    // 窓の 8 割ずつずらして 3 つ押す。起点固定なら 3 つ目は別ステップになる。
    const w = SIMULTANEOUS_PRESS_WINDOW_MS;
    const steps = detectSteps([
      sample(0, [LP]),
      sample(w * 0.8, [LP, MP]),
      sample(w * 1.6, [LP, MP, HP]),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].buttons).toEqual([LP, MP]);
    expect(steps[1].buttons).toEqual([HP]);
  });

  it("ボタンの並びは押した順ではなく決定的な順序になる", () => {
    const steps = detectSteps([sample(0, [HK]), sample(5, [HK, LP])]);
    expect(steps[0].buttons).toEqual([LP, HK]);
  });

  it("窓の内側で同じボタンが再度立ち上がっても集合に吸収される", () => {
    // ★チャタリング対策として設計したものではない（指示書 §4.4）。集合として扱っていることの帰結。
    const steps = detectSteps([
      sample(0, [LP]),
      sample(5, []),
      sample(10, [LP]),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP]);
    expect(steps[0].mergedCount).toBe(2);
  });

  it("判定窓は呼び出し側から差し替えられる（定数に固定されていない）", () => {
    const samples = [sample(0, [LP]), sample(30, [LP, MP])];
    expect(detectSteps(samples, { windowMs: 90 })).toHaveLength(1);
    expect(detectSteps(samples, { windowMs: 20 })).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// (f) ★本サブのテストの主眼（指示書 §5.1・チェックリスト §9-2）
// ---------------------------------------------------------------------------

describe("(f) 判定窓と D-324 の実測分布の関係", () => {
  it("★判定窓が実測の最大値を下回らない（下回ると利用者の入力が黙って落ちる）", () => {
    // D-324: USB・Chrome 151・rAF 間隔 中央値 4.20 ms・標本 各 90・2 機種。
    expect(MEASURED_MAX_PRESS_SPREAD_MS).toBe(45.8);
    expect(MEASURED_MAX_RELEASE_SPREAD_MS).toBe(83.3);

    expect(SIMULTANEOUS_PRESS_WINDOW_MS).toBeGreaterThanOrEqual(
      MEASURED_MAX_PRESS_SPREAD_MS,
    );
    expect(SIMULTANEOUS_PRESS_WINDOW_MS).toBeGreaterThanOrEqual(
      MEASURED_MAX_RELEASE_SPREAD_MS,
    );
  });

  it("★判定窓は DES-005 §6.4 の「例：16ms」ではない（実測の p95 に届かないため）", () => {
    // 押し始めの p95 は 20.90 / 33.30 ms。CHANGE-107 で是正される記述。
    expect(SIMULTANEOUS_PRESS_WINDOW_MS).not.toBe(16);
  });

  it("実測最大のズレ（押し始め 45.80 ms）で入れた 2 ボタンが 1 ステップにまとまる", () => {
    const steps = detectSteps([
      sample(0, [LP]),
      sample(MEASURED_MAX_PRESS_SPREAD_MS, [LP, MP]),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP, MP]);
  });

  it("実測最大のズレ（離し始め 83.30 ms）でも 1 ステップにまとまる", () => {
    const steps = detectSteps([
      sample(0, [LP]),
      sample(MEASURED_MAX_RELEASE_SPREAD_MS, [LP, MP]),
    ]);
    expect(steps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// (d)(g)(h)(i) 方向と SOCD
// ---------------------------------------------------------------------------

describe("方向と SOCD", () => {
  it("(d) 窓の起点で押されていた方向がステップに含まれる", () => {
    const steps = detectSteps([
      sample(0, [], { right: true }, "direction_6"),
      sample(10, [LP], { right: true }, "direction_6"),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].direction).toBe("direction_6");
    expect(steps[0].buttons).toEqual([LP]);
  });

  it("★(d') 窓の内側で立ち上がった方向も採る（レバーレスの 6+強P で方向が数 ms 遅れる形）", () => {
    // 実測の押し始めズレ 中央値 8.30 ms は方向にも等しく効く。起点固定だと `5 強P` になる。
    const steps = detectSteps([
      sample(0, []),
      sample(10, [HP]),
      sample(18.3, [HP], { right: true }),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].direction).toBe("direction_6");
    expect(steps[0].buttons).toEqual([HP]);
  });

  it("★(d'') 窓の内側で方向を先に離しても、入力した方向が残る", () => {
    const steps = detectSteps([
      sample(0, [], { right: true }, "direction_6"),
      sample(10, [HP], { right: true }, "direction_6"),
      // 方向を先に離す（離し始めのズレは実測で押し始めより大きい）。
      sample(30, [HP]),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].direction).toBe("direction_6");
  });

  it("★(d''') 窓の外側で立ち上がった方向は前のステップに入らない", () => {
    const steps = detectSteps([
      sample(0, [HP]),
      sample(SIMULTANEOUS_PRESS_WINDOW_MS + 10, [HP], { right: true }),
      sample(SIMULTANEOUS_PRESS_WINDOW_MS + 20, [HP, LP], { right: true }),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].direction).toBe("direction_neutral");
    expect(steps[1].direction).toBe("direction_6");
  });

  it("(g) 左右同時は相殺してニュートラルになる", () => {
    expect(resolveDirection(cardinals({ left: true, right: true }))).toBe(
      "direction_neutral",
    );
  });

  it("(h) 上下同時は上優先になる", () => {
    expect(resolveDirection(cardinals({ up: true, down: true }))).toBe(
      "direction_8",
    );
  });

  it("斜めは 2 つの生の押下から導出される", () => {
    expect(resolveDirection(cardinals({ down: true, right: true }))).toBe(
      "direction_3",
    );
    expect(resolveDirection(cardinals({ up: true, left: true }))).toBe(
      "direction_7",
    );
  });

  it("(i) 方向は states ではなく cardinals（相殺前の生値）から解決される", () => {
    // states 側の方向は direction_neutral のまま、cardinals にだけ右が立っている入力。
    // cardinals を読んでいれば direction_6 になる。
    const steps = detectSteps([
      sample(0, [], { right: true }, "direction_neutral"),
      sample(10, [LP], { right: true }, "direction_neutral"),
    ]);

    expect(steps[0].direction).toBe("direction_6");
  });

  it("方向の割当が無い機体（cardinals が undefined）でもニュートラルとして扱う", () => {
    expect(resolveDirection(undefined)).toBe("direction_neutral");
  });

  it("★方向はまとめる対象ではない——方向の変化だけではステップが生まれない", () => {
    const steps = detectSteps([
      sample(0, [], { right: true }, "direction_6"),
      sample(20, [], { down: true }, "direction_2"),
      sample(40, [], {}, "direction_neutral"),
    ]);

    expect(steps).toEqual([]);
  });

  it("★SOCD は判定窓を通さない——同一スナップショット内で解決される", () => {
    // 左右が同時に立っている 1 サンプルだけで、時間の経過なしに相殺される。
    const state = createStepDetectionState();
    const { emitted } = pushSample(
      state,
      sample(0, [LP], { left: true, right: true }),
    );
    expect(emitted).toEqual([]);
    const closed = closePendingStep(
      pushSample(state, sample(0, [LP], { left: true, right: true })).state,
      0,
    );
    expect(closed.emitted[0].direction).toBe("direction_neutral");
  });
});

// ---------------------------------------------------------------------------
// (k) 時刻源の頑健性
// ---------------------------------------------------------------------------

describe("(k) 時刻が単調増加しない入力", () => {
  it("巻き戻っても例外を投げず、直前の時刻へクランプされる", () => {
    const run = () =>
      detectSteps([sample(100, [LP]), sample(50, [LP, MP]), sample(60, [])]);

    expect(run).not.toThrow();
    const steps = run();
    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP, MP]);
  });

  it("同値の時刻が続いても破綻しない", () => {
    const steps = detectSteps([
      sample(500, [LP]),
      sample(500, [LP, MP]),
      sample(500, [LP, MP, HP]),
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0].buttons).toEqual([LP, MP, HP]);
  });

  it("NaN・非有限値でも例外を投げない", () => {
    const run = () =>
      detectSteps([
        sample(Number.NaN, [LP]),
        sample(Number.POSITIVE_INFINITY, [LP, MP]),
        sample(10, [LP, MP, HP]),
      ]);

    expect(run).not.toThrow();
    expect(run()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 未解決の入力・窓の明示的な確定
// ---------------------------------------------------------------------------

describe("頑健性と確定の導線", () => {
  it("resolved: false（プロファイル未登録）は押下なしとして扱い、例外を投げない", () => {
    const unresolved: GamepadSample = {
      at: 0,
      result: { states: [], resolved: false },
    };
    expect(() => detectSteps([unresolved, sample(10, [LP])])).not.toThrow();
    expect(detectSteps([unresolved])).toEqual([]);
  });

  it("states が空・欠損でも落ちない", () => {
    const broken = {
      at: 0,
      result: { states: undefined, resolved: true },
    } as unknown as GamepadSample;
    expect(() => detectSteps([broken])).not.toThrow();
  });

  it("flushPendingStep は窓が経過していれば確定し、経過前なら確定しない", () => {
    const opened = pushSample(createStepDetectionState(), sample(0, [LP]));

    const early = flushPendingStep(
      opened.state,
      SIMULTANEOUS_PRESS_WINDOW_MS - 1,
    );
    expect(early.emitted).toEqual([]);
    expect(early.state.pending).not.toBeNull();

    const late = flushPendingStep(early.state, SIMULTANEOUS_PRESS_WINDOW_MS);
    expect(late.emitted).toHaveLength(1);
    expect(late.state.pending).toBeNull();
  });

  it("★closedAt は「気づいた時刻」ではなく「窓が閉じた時刻」になる", () => {
    // 押しっぱなしで 5 秒放置してから次の入力が来ても、closedAt は startedAt + 窓。
    const steps = detectSteps([sample(0, [LP]), sample(5000, [LP, MP])]);

    expect(steps).toHaveLength(2);
    expect(steps[0].closedAt).toBe(SIMULTANEOUS_PRESS_WINDOW_MS);

    // タイマー経路（flushPendingStep）でも同じ。
    const opened = pushSample(createStepDetectionState(), sample(0, [LP]));
    const flushed = flushPendingStep(opened.state, 5000);
    expect(flushed.emitted[0].closedAt).toBe(SIMULTANEOUS_PRESS_WINDOW_MS);
  });

  it("★seedSample は押下状態だけを取り込み、立ち上がりを出さない", () => {
    // プロファイル差し替え直後。押しっぱなしのボタンでステップを作らせない。
    const seeded = seedSample(createStepDetectionState(), sample(0, [LP, MP]));
    expect(seeded.pending).toBeNull();
    expect(seeded.held).toEqual([LP, MP]);

    // 種付け後は、そのまま押し続けても新しいステップは出ない。
    const next = pushSample(seeded, sample(10, [LP, MP]));
    expect(next.state.pending).toBeNull();
    expect(next.emitted).toEqual([]);

    // 押し直せば拾う。
    const after = pushSample(next.state, sample(20, [LP, MP, HP]));
    expect(after.state.pending).not.toBeNull();
  });

  it("closePendingStep は窓の経過を待たず確定する", () => {
    const opened = pushSample(createStepDetectionState(), sample(0, [LP]));
    const closed = closePendingStep(opened.state, 1);

    expect(closed.emitted).toHaveLength(1);
    expect(closed.emitted[0].closedAt).toBe(1);
    expect(closed.state.pending).toBeNull();
  });

  it("開いている窓が無いときの確定は空を返す", () => {
    const state = createStepDetectionState();
    expect(closePendingStep(state, 0).emitted).toEqual([]);
    expect(flushPendingStep(state, 1000).emitted).toEqual([]);
  });
});
