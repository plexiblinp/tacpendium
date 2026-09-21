// コマンド技入力モードの接続（M21-06 §5 の (a) (g) (h) (j) (k)）。
//
// ★ハーネスは `keyboard/keyboardRecipeInput.test.tsx` に倣う。時計を手で握り、判定窓の開閉を
//   完全に再現する（判定は時刻を引数で受け取る純粋関数であるため）。
//
// ★**本スイートの主張はすべて「モードでない側」と対で置いてある。** モード側だけを見ると、
//   モードに入れていなくても緑になる（`D-375` の対照実験の要求と同じ理由）。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeBuilder } from "@/features/combo/components/RecipeBuilder";
import type { CommandIndexEntries } from "@/features/combo/inputResolutionStage2";
import type { Step } from "@/features/combo/types";
import { SIMULTANEOUS_PRESS_WINDOW_MS } from "@/features/gamepad/stepDetection";
import type { GamepadProfile, GamepadSnapshot } from "@/features/gamepad/types";
import type { GamepadSampleListener } from "@/features/gamepad/useGamepadPolling";
import { KEYBOARD_BINDINGS_STORAGE_KEY } from "@/features/keyboard/keyboard-storage";
import { createEmptyBindings, withBinding } from "@/features/keyboard/types";
import type {
  KeyboardBindings,
  KeyboardTarget,
} from "@/features/keyboard/types";
import type { Move, MotionCommandDTO } from "@/features/moves/types";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import type { SetupStepInput } from "@/features/setup/types";

import { PhysicalInputProvider } from "./PhysicalInputProvider";

// ---------------------------------------------------------------------------
// Gamepad 側の差し替え
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

// パッド側の物理 index（★モードへ入るのは弱K＝`SHORTCUT_ASSIGNMENTS` の command_mode）。
const PAD_INDEX = {
  shortcut_prefix: 9,
  light_kick: 0,
  light_punch: 2,
  down: 13,
  right: 15,
} as const;

const PAD_PROFILE: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: {
    down: { kind: "button", index: PAD_INDEX.down },
    right: { kind: "button", index: PAD_INDEX.right },
  },
  buttons: {
    shortcut_prefix: { kind: "button", index: PAD_INDEX.shortcut_prefix },
    light_kick: { kind: "button", index: PAD_INDEX.light_kick },
    light_punch: { kind: "button", index: PAD_INDEX.light_punch },
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
  save: "KeyP",
  modifier: "KeyM",
  command_mode: "KeyC",
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
  localStorage.setItem(KEYBOARD_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
}

function keyDown(code: string, advance = 10) {
  clock += advance;
  act(() => {
    fireEvent.keyDown(window, { code, key: code, repeat: false });
  });
}

function keyUp(code: string, advance = 10) {
  clock += advance;
  act(() => {
    fireEvent.keyUp(window, { code, key: code });
  });
}

/** キーを押して離す（方向の 1 回入力に使う）。 */
function tap(code: string, advance = 10) {
  keyDown(code, advance);
  keyUp(code, advance);
}

// テンキー方向 → 押しておくべき方向キーの集合。
const DIR_KEYS: Record<string, readonly string[]> = {
  "1": [KEY.down, KEY.left],
  "2": [KEY.down],
  "3": [KEY.down, KEY.right],
  "4": [KEY.left],
  "5": [],
  "6": [KEY.right],
  "7": [KEY.up, KEY.left],
  "8": [KEY.up],
  "9": [KEY.up, KEY.right],
};

/**
 * 方向列を実際のレバー操作として流す（★中間の方向が紛れ込まないように差分だけ動かす）。
 *
 * ★**素朴に「各方向をタップする」形では書けない。** 3（下前）を出すのに下と前を順に押すと、
 *   途中で 2 が観測されて列が `23` になる。⇒ **離してから押す**順で差分だけを動かし、
 *   間に挟まる中立（5）は溜まらない性質に頼る。
 *
 * @param onEachDirection 方向を 1 つ入れるたびに呼ばれる（★時間を空けるために使う）
 */
function roll(sequence: string, onEachDirection?: () => void) {
  let held: readonly string[] = [];
  for (const digit of sequence) {
    const next = DIR_KEYS[digit];
    for (const code of held) if (!next.includes(code)) keyUp(code);
    for (const code of next) if (!held.includes(code)) keyDown(code);
    held = next;
    onEachDirection?.();
  }
  for (const code of held) keyUp(code);
}

/** 時計とタイマーをまとめて進める。 */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  clock += ms;
}

/** 窓が閉じるまで時間を進める（＝通常経路でステップが確定する）。 */
function closeWindow() {
  act(() => {
    vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
  });
  clock += SIMULTANEOUS_PRESS_WINDOW_MS;
}

/** パッドのボタン集合を 1 サンプル流す。 */
function padSample(pressedIndexes: number[], advance = 10) {
  clock += advance;
  act(() => {
    sampleListener?.(
      {
        ...SNAPSHOT_META,
        buttons: Array.from({ length: 16 }, (_, i) => ({
          pressed: pressedIndexes.includes(i),
          touched: false,
          value: pressedIndexes.includes(i) ? 1 : 0,
        })),
        timestamp: clock,
      },
      clock,
    );
  });
}

// ---------------------------------------------------------------------------
// 技データと索引
// ---------------------------------------------------------------------------

const CHAR_ID = 1;

function makeMove(id: number, code: string, category = "normal"): Move {
  return {
    id,
    characterId: CHAR_ID,
    code,
    category,
    isAerial: false,
    setupOnly: false,
    isDerived: false,
  };
}

const MOVES: Move[] = [
  makeMove(1, "standing_light_punch"),
  makeMove(2, "crouching_light_punch"),
  makeMove(3, "hadoken_light", "special"),
  makeMove(4, "sa1_shinku_hadoken", "super_art"),
  makeMove(5, "ca_shin_shoryuken", "critical_art"),
  makeMove(6, "sa3_shin_shoryuken", "super_art"),
  makeMove(7, "standing_light_kick"),
];

// 実 seed（ryu）と同じ形の索引。
const MOTION_COMMANDS: MotionCommandDTO[] = [
  { tokenKey: "2LP", moveCode: "crouching_light_punch" },
  { tokenKey: "236LP", moveCode: "hadoken_light" },
  { tokenKey: "236236P", moveCode: "sa1_shinku_hadoken" },
  // ★同一コマンドの 2 技（CA と SA3）。§4.2-4 の「解決しない」が実際に発火する組。
  { tokenKey: "236236K", moveCode: "ca_shin_shoryuken" },
  { tokenKey: "236236K", moveCode: "sa3_shin_shoryuken" },
];

const ENTRIES: CommandIndexEntries = {};

function makeQueryClient(motionCommands: MotionCommandDTO[] = MOTION_COMMANDS) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  qc.setQueryData(["command-index", CHAR_ID], {
    characterId: CHAR_ID,
    entries: ENTRIES,
  });
  qc.setQueryData(["motion-commands", CHAR_ID], {
    characterId: CHAR_ID,
    commands: motionCommands,
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

function renderRecipe(motionCommands?: MotionCommandDTO[]) {
  const onSteps = vi.fn();
  const utils = render(
    <QueryClientProvider client={makeQueryClient(motionCommands)}>
      <PhysicalInputProvider>
        <RecipeHarness onSteps={onSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onSteps, ...utils };
}

/** 最後に onSteps へ渡ったステップ列。 */
function latestSteps(onSteps: ReturnType<typeof vi.fn>): Step[] {
  const calls = onSteps.mock.calls;
  return calls.length === 0 ? [] : (calls[calls.length - 1][0] as Step[]);
}

function commandPane(): HTMLElement {
  return screen.getByTestId("recipe-gamepad-readout-command");
}

beforeEach(() => {
  vi.useFakeTimers();
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
// (a) モード中に方向を入れてもステップが増えない ＋ ★対照実験
// ===========================================================================

describe("(a) モード中は方向がステップにならない", () => {
  it("★モードでなければ方向 ＋ ボタンでステップが増える（対照実験）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.down);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    keyUp(KEY.down);

    expect(latestSteps(onSteps)).toHaveLength(1);
  });

  it("モード中は方向を何度振ってもステップが増えない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    tap(KEY.down);
    tap(KEY.right);
    tap(KEY.down);
    tap(KEY.right);
    // ★窓を閉じても何も確定しない（そもそも判定へ渡っていない）。
    closeWindow();

    expect(latestSteps(onSteps)).toHaveLength(0);
  });

  // ★★本サブで最も重要な契約テスト（D-375 の「守っていたものを特定してから置く」）。
  //
  // ★「モード中に方向を振ってもステップが増えない」だけでは**弱い**。判定層は
  //   `stepDetection.ts` の `pressedButtons`（:248）で方向を押下集合から除いており、
  //   窓が開くのは**ボタンの立ち上がり**だけである（:402）。⇒ 方向をいくら振っても、
  //   仮にモードのゲートが壊れていてもステップは増えない。**別の機構が代わりに守っている。**
  //
  // ★露出しているのは**確定の契機になる攻撃ボタン**である。ゲートが壊れてサンプルが判定へ
  //   流れると、その 1 押しが「モードでの確定」と「通常のステップ」の**両方**を起こす。
  //   ⇒ 攻撃ボタンを押し、窓を閉じ切ったうえで**ステップが 1 つだけ**であることを主張する。
  it("★モード中の確定ボタンは通常のステップを生まない（ゲートの契約）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");

    keyDown(KEY.light_punch);
    // ★窓を閉じ切る。ここを閉じないと、ゲートが壊れていても通常ステップが確定せず緑になる。
    closeWindow();
    keyUp(KEY.light_punch);
    closeWindow();

    const steps = latestSteps(onSteps);
    // ★モードで解決した 1 つだけ。判定層由来の 2 つ目が混ざっていない。
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("hadoken_light");
  });

  it("★モード中の方向は列として溜まり、画面に出る（§4.1-6）", () => {
    seedBindings(fullBindings());
    renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");

    expect(
      screen.getByTestId("recipe-gamepad-readout-command-directions")
        .textContent,
    ).toBe("236");
  });
});

// ===========================================================================
// (g) ★モードが時間で切れない（要件そのもの）
// ===========================================================================

describe("(g) モードは時間で切れない", () => {
  it("★方向のあいだに 60 秒空けても波動拳として解決する", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    // ★判定窓（90ms）どころか分単位で空ける。前置きの 2 秒タイムアウトも遥かに超える。
    //   モードが時間で切れる実装なら、ここで列が捨てられて解決しなくなる。
    roll("236", () => advance(60_000));

    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("hadoken_light");
  });

  it("★SA（236236）も長い間隔を空けて解決できる", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    roll("236236", () => advance(5_000));

    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    // ★最長一致。波動拳（236LP）ではなく SA（236236P）である。
    expect(steps[0].moveCode).toBe("sa1_shinku_hadoken");
  });
});

// ===========================================================================
// (h) モードを抜けたあとは方向 1 つ ＝ ステップ 1 つに戻る
// ===========================================================================

describe("(h) モードを抜けたら今までどおり", () => {
  it("抜けたあとは方向 ＋ ボタンでステップが増える", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    // 入る → 抜ける
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    keyDown(KEY.down);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    keyUp(KEY.down);

    expect(latestSteps(onSteps)).toHaveLength(1);
  });

  it("★抜けるとき、溜めた列が黙って消えない（E-84・§4.1-7）", () => {
    seedBindings(fullBindings());
    renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");

    // 抜ける
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    const pane = commandPane();
    expect(pane.textContent).toContain("236");
    expect(pane.textContent).toContain("モードを抜けたため確定していません");
  });
});

// ===========================================================================
// (j) Gamepad とキーボードのどちらからでもモードに入れる
// ===========================================================================

describe("(j) 両方の供給元からモードに入れる", () => {
  it("キーボードから入れる", () => {
    seedBindings(fullBindings());
    renderRecipe();

    expect(commandPane().textContent).toContain("切り替えます");
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    expect(commandPane().textContent).toContain("入力中");
  });

  it("★Gamepad からも入れる（前置き ＋ 弱K）", () => {
    seedBindings(null);
    pollingStatus = "connected";
    padProfile = PAD_PROFILE;
    renderRecipe();

    // 前置きを押す → 離す → 弱K を押す（順次入力＝M21-04 の方式）。
    padSample([PAD_INDEX.shortcut_prefix]);
    padSample([]);
    padSample([PAD_INDEX.light_kick]);
    padSample([]);

    expect(commandPane().textContent).toContain("入力中");
  });

  // ★★レビュー指摘 中-2 の回帰テスト。
  //
  //   **症状**: モードへ入る後続ボタン（弱K）は攻撃 6 ボタンの 1 つ＝**モード内では確定の契機**
  //   である。開始時に「すでに押されている攻撃ボタン」を取り込まないと、**前置きを先に離す**
  //   押し方で弱K が立ち上がりとして誤検出され、方向を 1 つも入れていない確定が 1 件走る。
  //   ★既存テストは「前置きを離してから弱K」の順しか駆動しておらず検出できていなかった。
  it("★前置きを押したまま弱K を押し、前置きを先に離しても空の確定が走らない", () => {
    seedBindings(null);
    pollingStatus = "connected";
    padProfile = PAD_PROFILE;
    renderRecipe();

    // 前置きを押す → 押したまま弱K を押す → ★前置きを先に離す → 弱K を離す。
    padSample([PAD_INDEX.shortcut_prefix]);
    padSample([PAD_INDEX.shortcut_prefix, PAD_INDEX.light_kick]);
    padSample([PAD_INDEX.light_kick]);
    padSample([]);

    expect(commandPane().textContent).toContain("入力中");
    // ★「（方向なし）＋ 弱キック — …ありません」が出ていないこと。
    expect(commandPane().textContent).not.toContain("（方向なし）");
  });

  it("★Gamepad で入ったモードへキーボードの方向が溜まる（合流層に乗っている）", () => {
    seedBindings(fullBindings());
    pollingStatus = "connected";
    padProfile = PAD_PROFILE;
    renderRecipe();

    padSample([PAD_INDEX.shortcut_prefix]);
    padSample([]);
    padSample([PAD_INDEX.light_kick]);
    padSample([]);

    roll("236");

    expect(
      screen.getByTestId("recipe-gamepad-readout-command-directions")
        .textContent,
    ).toBe("236");
  });
});

// ===========================================================================
// (k) 解決できなかった入力が読取表示に出る
// ===========================================================================

describe("(k) 解決できなかった入力を黙って捨てない", () => {
  it("★同じ長さで複数残る場合は解決せず、理由が出る（§4.2-4）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    // 236236 ＋ K → CA と SA3 が同長で残る。
    roll("236236");
    keyDown(KEY.light_kick);
    keyUp(KEY.light_kick);

    // ★どちらも選ばれていない。
    expect(latestSteps(onSteps)).toHaveLength(0);
    expect(commandPane().textContent).toContain(
      "同じコマンドの技が複数あるため",
    );
  });

  it("先頭にゴミがある入力は解決せず、理由が出る（§4.2-5）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    // 4（後ろ）から始める → 4 で始まるコマンドが無い。
    roll("4236");
    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    expect(latestSteps(onSteps)).toHaveLength(0);
    expect(commandPane().textContent).toContain(
      "この方向の並びに一致するコマンドがありません",
    );
  });
});

// ===========================================================================
// §4.6-6 取得に失敗してもモードに入れないだけで、既存の入力経路は動く
// ===========================================================================

describe("§4.6-6 索引を取得できていない場合", () => {
  it("モードに入れないことが状態として出る（エラーにしない）", () => {
    seedBindings(fullBindings());
    const { container } = renderRecipe([]);

    expect(commandPane().textContent).toContain("取得できていない");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("★モードへ入ろうとしても入らない", () => {
    seedBindings(fullBindings());
    renderRecipe([]);

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    expect(commandPane().textContent).not.toContain("入力中");
  });

  // ★★レビュー指摘 高-2 の回帰テスト。
  //
  //   **症状**: モードに入ったあとで索引が失われると、可否ガードが抜ける側にも掛かっており
  //   **モードから抜けられなくなる**（チェックリスト重大 8 の条件）。到達経路は 3 つ——
  //   キャラ切替中の再取得 ／ 再取得の失敗 ／ 未 seed キャラへの切替。
  //   そのとき方向はステップにならず・解決もせず・溜まった列は画面から消える。
  it("★索引が失われてもモードに閉じ込められない（抜けられる・列が消えない）", () => {
    seedBindings(fullBindings());
    const qc = makeQueryClient();
    const onSteps = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <PhysicalInputProvider>
          <RecipeHarness onSteps={onSteps} />
        </PhysicalInputProvider>
      </QueryClientProvider>,
    );

    // モードへ入って方向を溜める。
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");
    expect(commandPane().textContent).toContain("入力中");

    // ★索引を失わせる（キャラ切替中の再取得・失敗・未 seed キャラと同じ状態）。
    act(() => {
      qc.setQueryData(["motion-commands", CHAR_ID], {
        characterId: CHAR_ID,
        commands: [],
      });
      // React Query の通知はスケジューラ経由で流れる。fake timer を進めて反映させる。
      vi.advanceTimersByTime(50);
    });
    clock += 50;

    // ★モードは自動で畳まれ、溜めた列は黙って消えず読取表示に出る（E-84）。
    expect(commandPane().textContent).not.toContain("入力中");
    expect(commandPane().textContent).toContain("236");
    expect(commandPane().textContent).toContain(
      "モードを抜けたため確定していません",
    );

    // ★既存の入力経路は動く（閉じ込められていない）。
    keyDown(KEY.down);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    keyUp(KEY.down);
    expect(latestSteps(onSteps)).toHaveLength(1);
  });

  it("★既存の入力経路は今までどおり動く（壊れない）", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe([]);

    keyDown(KEY.down);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    keyUp(KEY.down);

    expect(latestSteps(onSteps)).toHaveLength(1);
  });
});

// ===========================================================================
// (i) §6.5.1 (3) の既定動作の抑止が、モード中も効いている
// ===========================================================================

describe("(i) モード中も既定動作の抑止が効く", () => {
  // ★`cancelable: true` を必ず付ける。付けないと `preventDefault()` を呼んでも
  //   `defaultPrevented` が false のままになり、**テストが常に緑になってしまう**
  //   （`keyboard/useKeyboardInput.test.ts` :43-56 と同じ注意）。
  function dispatch(code: string): KeyboardEvent {
    clock += 10;
    const event = new KeyboardEvent("keydown", {
      code,
      key: code,
      repeat: false,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it("★モード中でも、登録済みの方向キーは既定動作が抑止される", () => {
    seedBindings(fullBindings());
    renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    // ★M21-06 は方向キーを更に多用する。ここが漏れるとブラウザがスクロールする
    //   （`M21-05` の実機確認で実際に落ちた型）。
    expect(dispatch(KEY.down).defaultPrevented).toBe(true);
    expect(dispatch(KEY.right).defaultPrevented).toBe(true);
  });

  it("★対照実験——モード中でも、登録していないキーには触らない", () => {
    seedBindings(fullBindings());
    renderRecipe();

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);

    // ★これが無いと「全キーの既定動作を殺していても成立する」（§6.5.1 (3) の要求）。
    expect(dispatch("KeyZ").defaultPrevented).toBe(false);
    expect(dispatch("ArrowDown").defaultPrevented).toBe(false);
  });

  it("モードでない側も同じ（抑止の条件はモードに依存しない）", () => {
    seedBindings(fullBindings());
    renderRecipe();

    expect(dispatch(KEY.down).defaultPrevented).toBe(true);
    expect(dispatch("KeyZ").defaultPrevented).toBe(false);
  });
});

// ===========================================================================
// §9.2-3 モード中に操作キーが来たときの扱い（★製造判断）
// ===========================================================================

describe("§9.2-3 モード中の操作キー", () => {
  it("★削除が効いても、溜めた列は消えない", () => {
    seedBindings(fullBindings());
    const { onSteps } = renderRecipe();

    // 先に通常経路でステップを 1 つ入れておく。
    keyDown(KEY.down);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    keyUp(KEY.down);
    expect(latestSteps(onSteps)).toHaveLength(1);

    // モードへ入って方向を溜める。
    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");

    // 削除キー。
    keyDown(KEY.delete);
    keyUp(KEY.delete);

    // ★列は残っている（黙って消えない）。
    expect(
      screen.getByTestId("recipe-gamepad-readout-command-directions")
        .textContent,
    ).toBe("236");
  });
});

// ===========================================================================
// 2 面（レシピ ＋ セットプレイ）が同時にある場合
// ===========================================================================

describe("受け手 1 面への配送（モードでも同じ調停）", () => {
  it("★モードで確定した技も受け手の 1 面にだけ入る", () => {
    seedBindings(fullBindings());
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

    keyDown(KEY.command_mode);
    keyUp(KEY.command_mode);
    roll("236");
    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    // 既定の受け手は最初にマウントされた面（レシピ）。
    expect(latestSteps(onRecipeSteps)).toHaveLength(1);
    expect(onSetupSteps).not.toHaveBeenCalled();
  });
});
