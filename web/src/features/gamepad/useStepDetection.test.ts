import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIMULTANEOUS_PRESS_WINDOW_MS } from "./stepDetection";
import type { GamepadProfile, GamepadSnapshot } from "./types";
import { useStepDetection } from "./useStepDetection";

// ---------------------------------------------------------------------------
// ★本スイートの主眼は「押しっぱなしのときにステップが確定する唯一の経路」である。
//
//   `onSample` はスナップショットが変化したフレームでしか呼ばれない。OD 技を押して保持して
//   いる間は次のサンプルが来ないため、確定させるのはタイマー（`flushPendingStep`）だけになる。
//   ⇒ 最も一般的な操作の確定経路が、純粋関数側のテストではまったく通らない。
// ---------------------------------------------------------------------------

const PAD_ID = "Xbox One Game Controller (STANDARD GAMEPAD)";

/** 弱P = buttons[0]、中P = buttons[1] だけを割り当てた最小のプロファイル。 */
function profile(padId = PAD_ID): GamepadProfile {
  return {
    version: 1,
    padId,
    browserKey: "test",
    directions: {},
    buttons: {
      light_punch: { kind: "button", index: 0 },
      medium_punch: { kind: "button", index: 1 },
    },
  };
}

function snapshot(pressed: readonly number[]): GamepadSnapshot {
  return {
    id: PAD_ID,
    index: 0,
    mapping: "standard",
    buttons: Array.from({ length: 4 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
    axes: [0, 0],
    timestamp: 0,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("押しっぱなしの確定（タイマー経路）", () => {
  it("★立ち上がりのあと入力が止まっても、窓の経過でステップが確定する", () => {
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    act(() => result.current.onSample(snapshot([0, 1]), 0));
    // ここでは確定していない（窓が開いているだけ）。
    expect(result.current.steps).toHaveLength(0);

    // ★以降 onSample は 1 度も呼ばれない（押しっぱなし＝スナップショットが変化しない）。
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].buttons).toEqual([
      "light_punch",
      "medium_punch",
    ]);
    expect(result.current.steps[0].closedAt).toBe(SIMULTANEOUS_PRESS_WINDOW_MS);
  });

  it("窓の経過前は確定しない", () => {
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    act(() => result.current.onSample(snapshot([0]), 0));
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS - 1);
    });

    expect(result.current.steps).toHaveLength(0);
  });

  it("reset() で判定の途中状態と表示が捨てられる（切断時）", () => {
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    act(() => result.current.onSample(snapshot([0]), 0));
    act(() => result.current.reset());
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    });

    expect(result.current.steps).toHaveLength(0);
  });
});

describe("プロファイル差し替え時の種付け", () => {
  it("★差し替え直後に押しっぱなしのボタンでステップが出ない（幻のステップの抑止）", () => {
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    // 弱P を押したまま、キャリブレーションのやり直しでプロファイルが差し替わる。
    act(() => result.current.onSample(snapshot([0]), 0));
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
    });
    act(() => result.current.reset());
    act(() => result.current.setProfile(profile()));

    // 押しっぱなしのまま次のサンプルが来ても、押し直していないので確定しない。
    act(() => result.current.onSample(snapshot([0]), 200));
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    });

    expect(result.current.steps).toHaveLength(0);
  });

  it("★初回（null → プロファイル）は種付けしない——最初の押下こそが利用者の入力である", () => {
    // M21-01 の導線は「コントローラのボタンを 1 度押してください」であり、
    // プロファイルが解決するのはまさにその押下の瞬間である。ここで種付けすると初回入力を落とす。
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    act(() => result.current.onSample(snapshot([0]), 0));
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].buttons).toEqual(["light_punch"]);
  });
});

// ---------------------------------------------------------------------------
// M21-04: 前置きから抜けたときの同期（seedNow）
// ★明示確定（commitPending）のテストは D-364 の撤去に伴い削除した。
// ---------------------------------------------------------------------------

describe("seedNow（M21-04・前置きから抜けたときの同期）", () => {
  it("★押下状態を取り込むが立ち上がりは出さない", () => {
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));

    // 弱P を押した状態を「観測済みだが判定へは渡していない」ものとして同期する。
    act(() =>
      result.current.seedNow({
        result: { states: [{ button: "light_punch", pressed: true, value: 1, source: "button" }], resolved: true },
        at: 0,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    });

    // 種付けなのでステップにならない。
    expect(result.current.steps).toHaveLength(0);
  });

  it("★同期の直後に押されたボタンは、通常どおり立ち上がりとして観測される", () => {
    // ここが「次のサンプルを種にする」形との違い。あちらは抜けた直後の入力を 1 つ落とす。
    const { result } = renderHook(() => useStepDetection());
    act(() => result.current.setProfile(profile()));
    act(() =>
      result.current.seedNow({ result: { states: [], resolved: true }, at: 0 }),
    );

    act(() => result.current.onSample(snapshot([0]), 10));
    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].buttons).toEqual(["light_punch"]);
  });
});
