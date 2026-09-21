// キーボード入力の接続（M21-05 §5 (a) (d) (e) (f) (h) (i)）。
//
// ★ハーネスは M21-03 / M21-04 の `gamepadRecipeInput.test.tsx` に倣う。違いは 2 点——
//   (1) キーボードはポーリング層を持たないため、`fireEvent.keyDown` を実 DOM へ流すだけでよい。
//   (2) `performance.now()` を手で進める。判定は時刻を引数で受け取る純粋関数であるため、
//       時計を握れば窓の開閉を完全に再現できる。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeBuilder } from "@/features/combo/components/RecipeBuilder";
import type { CommandIndexEntries } from "@/features/combo/inputResolutionStage2";
import type { Step } from "@/features/combo/types";
import { PhysicalInputProvider } from "@/features/physical-input/PhysicalInputProvider";
import { SIMULTANEOUS_PRESS_WINDOW_MS } from "@/features/gamepad/stepDetection";
import type { GamepadProfile, GamepadSnapshot } from "@/features/gamepad/types";
import type { GamepadSampleListener } from "@/features/gamepad/useGamepadPolling";
import type { Move } from "@/features/moves/types";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import type { SetupStepInput } from "@/features/setup/types";

import "@/lib/i18n";
import { KEYBOARD_BINDINGS_STORAGE_KEY } from "./keyboard-storage";
import { createEmptyBindings, withBinding } from "./types";
import type { KeyboardBindings, KeyboardTarget } from "./types";

// ★M24-07(CO-020): 仮想コントローラを i18n 化したため実 ja.json を引く
//   (既存作法)。文言そのものは 1 文字も変えていないので、以下の主張は不変。

// ---------------------------------------------------------------------------
// Gamepad 側の差し替え（★既定は「パッド無し」。キーボードだけの利用者を再現する）
// ---------------------------------------------------------------------------

const PAD_ID = "test-pad";

let sampleListener: GamepadSampleListener | null = null;
let pollingStatus: "idle" | "connected" | "disconnected" = "idle";
let padProfile: GamepadProfile | null = null;

const SNAPSHOT_META: GamepadSnapshot = {
  id: PAD_ID,
  index: 0,
  mapping: "standard",
  buttons: [],
  axes: [],
  timestamp: 0,
};

vi.mock("@/features/gamepad/useGamepadPolling", () => ({
  useGamepadPolling: (enabled: boolean, onSample?: GamepadSampleListener) => {
    sampleListener = enabled ? (onSample ?? null) : null;
    return {
      status: enabled ? pollingStatus : "idle",
      snapshot: enabled && pollingStatus === "connected" ? SNAPSHOT_META : null,
      axesBaseline: null,
      getFrameIntervalMs: () => null,
    };
  },
}));

vi.mock("@/features/gamepad/useGamepadProfiles", () => ({
  useGamepadProfiles: () => ({
    browserKey: "test-browser",
    profile: padProfile,
    source: padProfile === null ? "none" : "saved",
    saveProfile: () => true,
    removeProfile: () => true,
  }),
}));

const PAD_BUTTON_INDEX = { heavy_kick: 9 } as const;

const PAD_PROFILE: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: {},
  buttons: {
    heavy_kick: { kind: "button", index: PAD_BUTTON_INDEX.heavy_kick },
  },
};

// ---------------------------------------------------------------------------
// 時計と入力
// ---------------------------------------------------------------------------

let clock = 1000;

const KEY = {
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
  delete: "Backspace",
  // ★Enter は除外キーであるため、保存には実在する別のキーを充てる（KeyP）。
  save: "KeyP",
  modifier: "KeyM",
} as const;

function fullBindings(): KeyboardBindings {
  let bindings = createEmptyBindings();
  for (const [target, code] of Object.entries(KEY)) {
    bindings = withBinding(bindings, target as KeyboardTarget, {
      code,
      label: code,
    });
  }
  return bindings;
}

function seedBindings(bindings: KeyboardBindings | null) {
  if (bindings === null) {
    localStorage.removeItem(KEYBOARD_BINDINGS_STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    KEYBOARD_BINDINGS_STORAGE_KEY,
    JSON.stringify(bindings),
  );
}

/** キーを押す（既定では時計を 10ms 進める）。 */
function keyDown(code: string, options: { repeat?: boolean; advance?: number } = {}) {
  clock += options.advance ?? 10;
  act(() => {
    fireEvent.keyDown(window, { code, key: code, repeat: options.repeat === true });
  });
}

function keyUp(code: string, advance = 10) {
  clock += advance;
  act(() => {
    fireEvent.keyUp(window, { code, key: code });
  });
}

/** 窓が閉じるまで時間を進める（＝ステップが確定する）。 */
function closeWindow() {
  act(() => {
    vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
  });
  clock += SIMULTANEOUS_PRESS_WINDOW_MS;
}

/** 押して確定させる。 */
function pressAndConfirm(code: string) {
  keyDown(code);
  closeWindow();
  keyUp(code);
}

// ---------------------------------------------------------------------------
// 技データ
// ---------------------------------------------------------------------------

const CHAR_ID = 1;

function makeMove(id: number, code: string, category = "normal"): Move {
  return {
    id,
    characterId: CHAR_ID,
    code,
    category,
    isAerial: code.startsWith("jumping_"),
    setupOnly: false,
    isDerived: false,
  };
}

const MOVES: Move[] = [
  makeMove(1, "standing_light_punch"),
  makeMove(2, "standing_medium_punch"),
  makeMove(3, "standing_heavy_punch"),
  makeMove(4, "standing_light_kick"),
  makeMove(5, "standing_medium_kick"),
  makeMove(6, "standing_heavy_kick"),
  makeMove(13, "crouching_medium_kick"),
  makeMove(14, "crouching_heavy_kick"),
];

const ENTRIES: CommandIndexEntries = {};

function makeQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  qc.setQueryData(["command-index", CHAR_ID], {
    characterId: CHAR_ID,
    entries: ENTRIES,
  });
  qc.setQueryData(["moves", "by-character", CHAR_ID], MOVES);
  return qc;
}

// ---------------------------------------------------------------------------
// ハーネス
// ---------------------------------------------------------------------------

function RecipeHarness({ onSteps }: { onSteps: (steps: Step[]) => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  return (
    <RecipeBuilder
      characterId={CHAR_ID}
      steps={steps}
      moves={MOVES}
      movesLoading={false}
      onChange={(next) => {
        setSteps(next);
        onSteps(next);
      }}
    />
  );
}

function SetupHarness({
  onSteps,
}: {
  onSteps: (steps: SetupStepInput[]) => void;
}) {
  const [steps, setSteps] = useState<SetupStepInput[]>([]);
  return (
    <SetupRecipeEditor
      characterId={CHAR_ID}
      steps={steps}
      onChange={(next) => {
        setSteps(next);
        onSteps(next);
      }}
    />
  );
}

function renderRecipe() {
  const onSteps = vi.fn();
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <PhysicalInputProvider>
        <RecipeHarness onSteps={onSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onSteps, ...utils };
}

function renderBothSurfaces() {
  const onRecipeSteps = vi.fn();
  const onSetupSteps = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <PhysicalInputProvider>
        <RecipeHarness onSteps={onRecipeSteps} />
        <SetupHarness onSteps={onSetupSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onRecipeSteps, onSetupSteps };
}

beforeEach(() => {
  vi.useFakeTimers();
  // ★`performance.now()` を手で握る。判定は時刻を引数で受け取るため、これで窓を完全に再現できる。
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  sampleListener = null;
  pollingStatus = "idle";
  padProfile = null;
  clock = 1000;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ===========================================================================
// (a) 未登録の状態
// ===========================================================================

describe("(a) 未登録の状態で入力面に立つ", () => {
  it("登録が要ることが分かる", () => {
    seedBindings(null);
    renderRecipe();

    const status = screen.getByTestId("recipe-keyboard-status");
    expect(status.getAttribute("data-state")).toBe("unregistered");
    expect(status.textContent).toContain("登録");
    // 登録導線が同じ場所にある。
    expect(screen.getByTestId("recipe-keyboard-configure")).toBeTruthy();
  });

  // ★§4.1-4。失敗ではなく状態として出す。
  it("エラーとして出さない（role=alert を使わない）", () => {
    seedBindings(null);
    const { container } = renderRecipe();

    expect(container.querySelector('[role="alert"]')).toBe(null);
    const status = screen.getByTestId("recipe-keyboard-status");
    expect(status.getAttribute("role")).toBe(null);
  });

  it("未登録では、キーを押しても何も入らない（既定を持たない＝D-370）", () => {
    seedBindings(null);
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("登録済みなら使える状態として出る", () => {
    seedBindings(fullBindings());
    renderRecipe();

    const status = screen.getByTestId("recipe-keyboard-status");
    expect(status.getAttribute("data-state")).toBe("ready");
  });
});

// ===========================================================================
// キーボードだけでレシピを入力できる（§7.1）
// ===========================================================================

describe("キーボードからのステップ追加", () => {
  it("1 キーの入力がレシピへ 1 ステップ入る", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).toHaveBeenCalledTimes(1);
    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_heavy_punch");
  });

  it("方向つきの入力が方向込みで解決される", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.down);
    keyDown(KEY.medium_kick);
    closeWindow();

    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps[0].moveCode).toBe("crouching_medium_kick");
  });

  it("判定窓の外は別ステップになる", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.light_punch);
    pressAndConfirm(KEY.medium_punch);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(2);
    expect(steps[0].moveCode).toBe("standing_light_punch");
    expect(steps[1].moveCode).toBe("standing_medium_punch");
  });
});

// ===========================================================================
// (d) テキスト入力欄との衝突回避
// ===========================================================================

describe("(d) 編集可能な要素にフォーカスがある間は発火しない", () => {
  // ★手で足した要素は必ず片付ける。残すと、**前のテストで focus した要素が次のテストでも
  //   activeElement のまま残り**、ガードが効いて入力が入らない（実際に踏んだ）。
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    for (const host of hosts) host.remove();
    hosts.length = 0;
    (document.activeElement as HTMLElement | null)?.blur();
  });

  function focusEditable(html: string): HTMLElement {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    hosts.push(host);
    const el = host.firstElementChild as HTMLElement;
    el.focus();
    return el;
  }

  it("技入力が発火しない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    focusEditable(`<input type="text" />`);
    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("textarea でも発火しない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    focusEditable(`<textarea></textarea>`);
    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("contenteditable でも発火しない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    focusEditable(`<div contenteditable="true" tabindex="0"></div>`);
    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).not.toHaveBeenCalled();
  });

  // ★§4.4-3。**操作キーも同じ扱いである。** メモ欄を打っている最中に削除が走らない。
  it("操作キー（削除）も発火しない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    // 先に 1 ステップ入れてから、テキスト欄で削除キーを打つ。
    pressAndConfirm(KEY.heavy_punch);
    const before = onSteps.mock.calls.length;

    focusEditable(`<textarea></textarea>`);
    keyDown(KEY.delete);

    expect(onSteps.mock.calls.length).toBe(before);
    const steps = onSteps.mock.calls[before - 1][0] as Step[];
    expect(steps).toHaveLength(1);
  });

  it("フォーカスが外れれば再び発火する", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    const el = focusEditable(`<input type="text" />`);
    pressAndConfirm(KEY.heavy_punch);
    expect(onSteps).not.toHaveBeenCalled();

    el.blur();
    pressAndConfirm(KEY.heavy_punch);
    expect(onSteps).toHaveBeenCalledTimes(1);
  });

  // ★文字入力ではない操作子ではガードが効かない（＝入力が死なない）。
  //   要素の種類で分岐していると、ここを取りこぼして「チェックボックスの上では技が出ない」になる。
  it("チェックボックスにフォーカスがあっても技は出る", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    focusEditable(`<input type="checkbox" />`);
    pressAndConfirm(KEY.heavy_punch);

    expect(onSteps).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// (e) 操作用のキーが押下集合に入らない
// ===========================================================================

describe("(e) 操作用のキーは押下集合に入らない", () => {
  it("削除キーを押してもステップ候補が立たない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.delete);

    expect(onSteps).not.toHaveBeenCalled();
    // ★「解決できなかった入力」としても出ない（M21-04 が実測した壊れ方の同型）。
    //   区画そのものは常設であるため、中身が空であることを主張する。
    expect(
      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
    ).toContain("ありません");
  });

  it("技と一緒に押しても、技だけが確定する", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.heavy_punch);
    keyDown(KEY.modifier);
    closeWindow();

    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_heavy_punch");
  });
});

// ===========================================================================
// 操作（前置きを挟まない直接割当）★件数を書かない——増えたときに黙って古くなる
// ===========================================================================

describe("操作キーの直接割当（§4.2-1）", () => {
  it("削除キーで最後のステップが消える（前置き不要）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.heavy_punch);
    pressAndConfirm(KEY.light_punch);
    expect(
      (onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[]).length,
    ).toBe(2);

    keyDown(KEY.delete);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_heavy_punch");
  });
});

// ===========================================================================
// (f) キーリピート
// ===========================================================================

describe("(f) キーリピート", () => {
  it("押しっぱなしのリピートで同じステップが並ばない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.heavy_punch);
    // OS のキーリピートが届く（押しっぱなし）。
    for (let i = 0; i < 5; i += 1) {
      keyDown(KEY.heavy_punch, { repeat: true, advance: 30 });
    }
    closeWindow();
    keyUp(KEY.heavy_punch);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(1);
  });

  it("repeat を報告しない環境でも、押下集合が変わらなければ並ばない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.heavy_punch);
    // ★`repeat: false` のまま同じキーの keydown が繰り返し届く形。
    for (let i = 0; i < 5; i += 1) {
      keyDown(KEY.heavy_punch, { advance: 30 });
    }
    closeWindow();
    keyUp(KEY.heavy_punch);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(1);
  });

  it("離して押し直せば別ステップになる", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.heavy_punch);
    pressAndConfirm(KEY.heavy_punch);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(2);
  });
});

// ===========================================================================
// (h) 受け手は 1 面
// ===========================================================================

describe("(h) 受け手は 1 面である", () => {
  it("入力面が 2 つあっても、最後に触った面にだけ入る", () => {
    seedBindings(fullBindings());
    const { onRecipeSteps, onSetupSteps } = renderBothSurfaces();

    // 既定の受け手（最初に登録された面）へ入る。
    pressAndConfirm(KEY.heavy_punch);
    expect(onRecipeSteps).toHaveBeenCalledTimes(1);
    expect(onSetupSteps).not.toHaveBeenCalled();

    // セットプレイ面を触って受け手を移す。
    const controllers = screen.getAllByText("クイック入力(ボタン)");
    act(() => {
      fireEvent.pointerDown(controllers[1]);
    });

    pressAndConfirm(KEY.light_punch);
    expect(onSetupSteps).toHaveBeenCalledTimes(1);
    expect(onRecipeSteps).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// (i) 排他にしない
// ===========================================================================

describe("(i) Gamepad とキーボードのどちらからでも入る", () => {
  function padSample(pressed: readonly number[]) {
    clock += 10;
    act(() => {
      sampleListener?.(
        {
          ...SNAPSHOT_META,
          buttons: Array.from({ length: 16 }, (_, index) => ({
            pressed: pressed.includes(index),
            value: pressed.includes(index) ? 1 : 0,
          })),
        },
        clock,
      );
    });
  }

  it("キーボードで入れた直後にパッドでも入る（キーボードモードを作らない）", () => {
    pollingStatus = "connected";
    padProfile = PAD_PROFILE;
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    pressAndConfirm(KEY.heavy_punch);
    expect(
      (onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[]).length,
    ).toBe(1);

    padSample([PAD_BUTTON_INDEX.heavy_kick]);
    closeWindow();
    padSample([]);

    const steps = onSteps.mock.calls[
      onSteps.mock.calls.length - 1
    ][0] as Step[];
    expect(steps).toHaveLength(2);
    expect(steps[1].moveCode).toBe("standing_heavy_kick");
  });

  // ★★合流の要。**これが本サブで最も落ちやすい壊れ方である。**
  //   判定層は押下集合の「差分」で立ち上がりを採るため、2 源が各自の押下集合を独立に push すると
  //   片方の push がもう片方を「離した」と見せる。結果、離していないボタンが後からもう一度
  //   立ち上がり、押していないステップが増える。
  it("パッドを押したままキーを叩いても、パッド側が離されたことにならない", () => {
    pollingStatus = "connected";
    padProfile = PAD_PROFILE;
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    // パッドの強K を押す（窓が開く）。
    padSample([PAD_BUTTON_INDEX.heavy_kick]);
    // 窓の内側でキーボードの「下」を足す。★方向は状態でありステップを作らないが、
    //   合流していなければ、この push でパッドの強K が押下集合から消える。
    keyDown(KEY.down, { advance: 20 });
    closeWindow();

    // ★両源が同時に効いていることの証明——パッドのボタン ＋ キーボードの方向で
    //   「しゃがみ強K」になる。どちらか一方だけなら別の技になる。
    expect(onSteps).toHaveBeenCalledTimes(1);
    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("crouching_heavy_kick");

    // ★離しても幽霊の立ち上がりが起きない（合流が壊れていると、ここで 2 本目が生える）。
    padSample([]);
    keyUp(KEY.down);
    closeWindow();
    expect(
      (onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[]).length,
    ).toBe(1);
  });
});
