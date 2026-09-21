// ショートカット（前置きボタン ＋ 後続ボタン）の接続（M21-04 §5 (a)〜(j)）。
//
// ★実機コントローラと user gesture を要するため E2E からは模擬できない（M21-02 / M21-03 で確認済み）。
//   ⇒ ポーリング層とプロファイル解決だけを差し替え、rAF の観測（snapshot, now）を手で流す。
//   前置きの状態機械も、同時押しの判定も、既存導線の呼び出しもすべて実物が動く。
//
// ★本サブで最も落ちやすいのは「前置き中に押した後続ボタンがステップとして入る」である
//   （§4.2′-3 / 重大 15）。**操作もステップ追加も両方「成功」するため、動作を見ても気づけない。**
//   ⇒ (f2) がそれを固定する。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeBuilder } from "@/features/combo/components/RecipeBuilder";
import type { CommandIndexEntries } from "@/features/combo/inputResolutionStage2";
import type { Step } from "@/features/combo/types";
import type { Move } from "@/features/moves/types";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import type { SetupStepInput } from "@/features/setup/types";

import { PhysicalInputProvider } from "@/features/physical-input/PhysicalInputProvider";
import { SHORTCUT_PREFIX_TIMEOUT_MS } from "./shortcut";
import { SIMULTANEOUS_PRESS_WINDOW_MS } from "./stepDetection";
import type { GamepadProfile, GamepadSnapshot } from "./types";
import type { GamepadSampleListener } from "./useGamepadPolling";

// ---------------------------------------------------------------------------
// ポーリング層とプロファイル解決の差し替え
// ---------------------------------------------------------------------------

const PAD_ID = "test-pad";

// ★物理 index はこの 1 か所だけで決める。
//   index 13 は M21-03 のハーネスでは未使用であり、前置き（技に使っていないボタン）に充てる。
const BUTTON_INDEX = {
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
  drive_impact: 10,
  drive_parry: 11,
  throw: 12,
  shortcut_prefix: 13,
} as const;

const BASE_BUTTONS: GamepadProfile["buttons"] = {
  light_punch: { kind: "button", index: BUTTON_INDEX.light_punch },
  medium_punch: { kind: "button", index: BUTTON_INDEX.medium_punch },
  heavy_punch: { kind: "button", index: BUTTON_INDEX.heavy_punch },
  light_kick: { kind: "button", index: BUTTON_INDEX.light_kick },
  medium_kick: { kind: "button", index: BUTTON_INDEX.medium_kick },
  heavy_kick: { kind: "button", index: BUTTON_INDEX.heavy_kick },
  drive_impact: { kind: "button", index: BUTTON_INDEX.drive_impact },
  drive_parry: { kind: "button", index: BUTTON_INDEX.drive_parry },
  throw: { kind: "button", index: BUTTON_INDEX.throw },
};

const DIRECTIONS: GamepadProfile["directions"] = {
  up: { kind: "button", index: BUTTON_INDEX.up },
  down: { kind: "button", index: BUTTON_INDEX.down },
  left: { kind: "button", index: BUTTON_INDEX.left },
  right: { kind: "button", index: BUTTON_INDEX.right },
};

// ★同一参照を返し続けること。毎レンダリング新しい profile を返すと useStepDetection が
//   「差し替え」とみなして次サンプルを種付けに使い、入力が 1 つ落ちる。
const PROFILE_WITH_PREFIX: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: DIRECTIONS,
  buttons: {
    ...BASE_BUTTONS,
    shortcut_prefix: { kind: "button", index: BUTTON_INDEX.shortcut_prefix },
  },
};

/** ★前置きを 1 件も登録していないプロファイル（§5 (g)）。 */
const PROFILE_WITHOUT_PREFIX: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: DIRECTIONS,
  buttons: BASE_BUTTONS,
};

let sampleListener: GamepadSampleListener | null = null;
let activeProfile: GamepadProfile = PROFILE_WITH_PREFIX;

const SNAPSHOT_META: GamepadSnapshot = {
  id: PAD_ID,
  index: 0,
  mapping: "standard",
  buttons: [],
  axes: [],
  timestamp: 0,
};

vi.mock("./useGamepadPolling", () => ({
  useGamepadPolling: (enabled: boolean, onSample?: GamepadSampleListener) => {
    sampleListener = enabled ? (onSample ?? null) : null;
    return {
      status: enabled ? "connected" : "idle",
      snapshot: enabled ? SNAPSHOT_META : null,
      axesBaseline: null,
      getFrameIntervalMs: () => null,
    };
  },
}));

vi.mock("./useGamepadProfiles", () => ({
  useGamepadProfiles: () => ({
    browserKey: "test-browser",
    profile: activeProfile,
    source: "saved",
    saveProfile: () => true,
    removeProfile: () => true,
  }),
}));

// ---------------------------------------------------------------------------
// 入力の流し込み
// ---------------------------------------------------------------------------

const BUTTON_COUNT = 16;

function snapshotWith(pressed: readonly number[]): GamepadSnapshot {
  return {
    ...SNAPSHOT_META,
    buttons: Array.from({ length: BUTTON_COUNT }, (_, index) => ({
      pressed: pressed.includes(index),
      value: pressed.includes(index) ? 1 : 0,
    })),
  };
}

let clock = 1000;

function sample(pressed: readonly number[]) {
  clock += 10;
  const at = clock;
  act(() => {
    sampleListener?.(snapshotWith(pressed), at);
  });
}

/** 押す → 窓が閉じるまで進める（押しっぱなしのままステップが確定する経路）。 */
function pressAndConfirm(pressed: readonly number[]) {
  sample(pressed);
  act(() => {
    vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
  });
  clock += SIMULTANEOUS_PRESS_WINDOW_MS;
}

/**
 * 前置き ＋ 後続 の順次入力を流す（★同時押しにしない＝D-358）。
 *
 * 前置きを押す → 離す → 後続を押す → 離す、の 4 サンプル。**同じフレームで両方を押さない。**
 */
function shortcut(followUp: number) {
  sample([BUTTON_INDEX.shortcut_prefix]);
  sample([]);
  sample([followUp]);
  sample([]);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  clock += ms;
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

interface RecipeHarnessProps {
  onSteps?: (steps: Step[]) => void;
  onSave?: () => void;
  canSave?: boolean;
}

function RecipeHarness({ onSteps, onSave, canSave }: RecipeHarnessProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  return (
    <RecipeBuilder
      characterId={CHAR_ID}
      steps={steps}
      moves={MOVES}
      movesLoading={false}
      onChange={(next) => {
        setSteps(next);
        onSteps?.(next);
      }}
      onSave={onSave}
      canSave={canSave}
    />
  );
}

function SetupHarness({ onSteps }: { onSteps?: (s: SetupStepInput[]) => void }) {
  const [steps, setSteps] = useState<SetupStepInput[]>([]);
  return (
    <SetupRecipeEditor
      characterId={CHAR_ID}
      steps={steps}
      onChange={(next) => {
        setSteps(next);
        onSteps?.(next);
      }}
    />
  );
}

function renderRecipe(props: RecipeHarnessProps = {}) {
  const onSteps = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <PhysicalInputProvider>
        <RecipeHarness {...props} onSteps={onSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onSteps };
}

/** レシピ入力面 ＋ セットプレイ入力面を同時にマウントする（受け手の調停の試験用）。 */
function renderBothSurfaces() {
  const onRecipeSteps = vi.fn();
  const onSetupSteps = vi.fn();
  const onRecipeSave = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <PhysicalInputProvider>
        <RecipeHarness onSteps={onRecipeSteps} onSave={onRecipeSave} canSave />
        <SetupHarness onSteps={onSetupSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onRecipeSteps, onSetupSteps, onRecipeSave };
}

function actionText(): string {
  return screen.queryByTestId("recipe-gamepad-readout-action")?.textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
  sampleListener = null;
  activeProfile = PROFILE_WITH_PREFIX;
  clock = 1000;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// (f2) 前置きの吸収 —— ★本サブで最も落ちやすい
// ---------------------------------------------------------------------------

describe("(f2) 前置き中に押した後続ボタンはステップにならない", () => {
  it("前置き ＋ 強P で、強P のステップが入らない", () => {
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    // ★後続を押しっぱなしにして判定窓を跨いでも、ステップにならないこと。
    sample([BUTTON_INDEX.heavy_punch]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    sample([]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("前置きを押したまま後続を押しても、ステップにならない（押しっぱなし方式）", () => {
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([BUTTON_INDEX.shortcut_prefix, BUTTON_INDEX.heavy_punch]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    sample([]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("★前置き中に押した『割当の無いボタン』もステップにならない", () => {
    // ★弱K はショートカットに割り当てていない。⇒ 操作は起きず前置きも解除されないが、
    //   前置き中の入力である以上ステップにもしない（利用者は操作を選ぶ状態にいる）。
    // ★このケースを守っているのは「前置き中は判定へサンプルを渡さない」ガードだけである。
    //   抜けるときの同期（seedNow）では守れない——抜けていないため。
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    sample([BUTTON_INDEX.light_kick]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
    sample([]);
    advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);

    expect(onSteps).not.toHaveBeenCalled();
  });

  it("前置きボタン単体もステップにならない（解決できなかった入力にも出さない）", () => {
    const { onSteps } = renderRecipe();

    pressAndConfirm([BUTTON_INDEX.shortcut_prefix]);
    releaseAllAndSettle();

    expect(onSteps).not.toHaveBeenCalled();
    const unresolved = screen.getByTestId("recipe-gamepad-readout-unresolved");
    expect(unresolved.textContent).toContain("ありません");
  });
});

function releaseAllAndSettle() {
  sample([]);
  advance(SIMULTANEOUS_PRESS_WINDOW_MS * 2);
}

// ---------------------------------------------------------------------------
// (f3) 前置きから抜けられる / (f4) 前置きを使わない入力は変わらない
// ---------------------------------------------------------------------------

describe("(f3) 前置き状態から抜けられる", () => {
  it("前置きをもう一度押すと取消され、次の入力は通常どおりステップになる", () => {
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    expect(shortcutText()).toContain("前置き中");

    // 取消。
    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    expect(shortcutText()).not.toContain("前置き中");

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    expect(onSteps).toHaveBeenCalledTimes(1);
  });

  it("時間が経つと自動で抜ける（押したまま入力できなくなる形にしない）", () => {
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    expect(shortcutText()).toContain("前置き中");

    advance(SHORTCUT_PREFIX_TIMEOUT_MS + 10);
    expect(shortcutText()).not.toContain("前置き中");

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    expect(onSteps).toHaveBeenCalledTimes(1);
  });

  it("操作を起こしたあとは前置きが解除される", () => {
    renderRecipe();
    shortcut(BUTTON_INDEX.heavy_kick);
    expect(shortcutText()).not.toContain("前置き中");
  });

  it("★前置きへ入り直すと直前の操作結果が消える（古い結果を現在の状態に見せない）", () => {
    renderRecipe();

    shortcut(BUTTON_INDEX.heavy_kick);
    expect(actionText()).toContain("削除する対象がありません");

    // 次の操作を選ぶ状態へ入った時点で、前回の結果は消える。
    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    expect(shortcutText()).toContain("前置き中");
    expect(actionText()).toBe("");
  });
});

function shortcutText(): string {
  return (
    screen.queryAllByTestId("recipe-gamepad-readout-shortcut")[0]?.textContent ??
    ""
  );
}

describe("(f4) 前置きを押していないときの挙動は M21-03 から変わらない", () => {
  it("後続に割り当てたボタン単体は、通常どおりステップになる", () => {
    const { onSteps } = renderRecipe();

    // 強K は「削除」に割り当てているが、前置き無しなら通常の技である。
    pressAndConfirm([BUTTON_INDEX.heavy_kick]);
    releaseAllAndSettle();

    expect(onSteps).toHaveBeenCalledTimes(1);
    expect(onSteps.mock.calls[0][0][0].moveId).toBe(6);
  });

  it("前置きを使った直後でも、次の入力は通常どおりステップになる", () => {
    const { onSteps } = renderRecipe();

    shortcut(BUTTON_INDEX.heavy_kick); // 削除（対象なし）
    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();

    expect(onSteps).toHaveBeenCalledTimes(1);
    expect(onSteps.mock.calls[0][0][0].moveId).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (c) 削除 / (d) 保存 / (f) 修飾 —— いずれも既存導線を呼ぶ
// ---------------------------------------------------------------------------

describe("(c) 物理からの削除が画面の削除導線と同じ結果になる", () => {
  it("前置き ＋ 強K で最後のステップが消える", () => {
    const { onSteps } = renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();
    pressAndConfirm([BUTTON_INDEX.light_punch]);
    releaseAllAndSettle();
    expect(onSteps).toHaveBeenLastCalledWith([
      expect.objectContaining({ moveId: 3 }),
      expect.objectContaining({ moveId: 1 }),
    ]);

    shortcut(BUTTON_INDEX.heavy_kick);

    // ★画面の「削除」ボタン（recipe-system-delete）と同じ結果＝最後の 1 件だけが消える。
    expect(onSteps).toHaveBeenLastCalledWith([
      expect.objectContaining({ moveId: 3 }),
    ]);
    expect(actionText()).toContain("削除しました");
  });

  it("ステップが無いときは何も起こさず、対象が無いことを出す", () => {
    const { onSteps } = renderRecipe();
    shortcut(BUTTON_INDEX.heavy_kick);

    expect(onSteps).not.toHaveBeenCalled();
    expect(actionText()).toContain("削除する対象がありません");
  });
});

describe("(d) 物理からの保存が画面の保存導線を呼ぶ", () => {
  it("前置き ＋ 強P で保存導線が呼ばれる", () => {
    const onSave = vi.fn();
    renderRecipe({ onSave, canSave: true });

    shortcut(BUTTON_INDEX.heavy_punch);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(actionText()).toContain("保存しました");
  });

  it("★保存できない状態のときは呼ばず、その旨を出す（画面の保存ボタンと同じ条件）", () => {
    const onSave = vi.fn();
    renderRecipe({ onSave, canSave: false });

    shortcut(BUTTON_INDEX.heavy_punch);

    expect(onSave).not.toHaveBeenCalled();
    expect(actionText()).toContain("保存できる状態ではありません");
  });

  it("★保存導線が無い面では何も起こさず、行えないことを出す", () => {
    // コンボへ同梱されるセットプレイ行がこの形（保存は親コンボが持つ）。
    renderRecipe({ onSave: undefined });

    shortcut(BUTTON_INDEX.heavy_punch);

    expect(actionText()).toContain("保存はこの面では行えません");
  });
});

describe("(f) 物理からの修飾が既存の編集ダイアログを開く", () => {
  it("前置き ＋ 中P で、直前に確定したステップの編集が開く", () => {
    renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();
    pressAndConfirm([BUTTON_INDEX.light_punch]);
    releaseAllAndSettle();

    shortcut(BUTTON_INDEX.medium_punch);

    // ★既存の ModifiersEditor が開く。対象は直前に確定したステップ（弱P）である。
    expect(screen.getByText(/ステップ編集:/).textContent).toContain(
      "standing_light_punch",
    );
    // ★「修飾しました」とは書かない。実際に起きたのは編集ダイアログを開いたことだけであり、
    //   値を決めるのは利用者である（`DES-003` §3.5 の固定選択式）。
    expect(actionText()).toContain("修飾の編集を開きました");
  });

  it("ステップが無いときは開かず、対象が無いことを出す", () => {
    renderRecipe();
    shortcut(BUTTON_INDEX.medium_punch);

    expect(screen.queryByText(/ステップ編集:/)).toBeNull();
    expect(actionText()).toContain("修飾する対象がありません");
  });
});

// ---------------------------------------------------------------------------
// (a) / (b) 受け手の調停
// ---------------------------------------------------------------------------

describe("(a) 操作は受け手の 1 面にだけ効く", () => {
  it("受け手でない面のレシピは動かない", () => {
    const { onRecipeSteps, onSetupSteps } = renderBothSurfaces();

    // 既定の受け手は最初に現れた面（レシピ入力面）。
    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();
    expect(onRecipeSteps).toHaveBeenCalledTimes(1);
    expect(onSetupSteps).not.toHaveBeenCalled();

    shortcut(BUTTON_INDEX.heavy_kick);

    // ★削除はレシピ側にだけ効く。セットプレイ側は 1 度も呼ばれない。
    expect(onRecipeSteps).toHaveBeenLastCalledWith([]);
    expect(onSetupSteps).not.toHaveBeenCalled();
  });

  it("受け手が移ると、操作の効き先も移る", () => {
    const { onRecipeSteps, onSetupSteps, onRecipeSave } = renderBothSurfaces();

    // セットプレイ面を触って受け手にする（pointerdown で claim する既存の調停）。
    const setupControllers = screen.getAllByTestId("recipe-gamepad-readout");
    fireEvent.pointerDown(setupControllers[1]);

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();
    expect(onSetupSteps).toHaveBeenCalledTimes(1);
    expect(onRecipeSteps).not.toHaveBeenCalled();

    // ★保存はレシピ面にしか渡していない。受け手はセットプレイ面なので呼ばれない。
    shortcut(BUTTON_INDEX.heavy_punch);
    expect(onRecipeSave).not.toHaveBeenCalled();
  });
});

// ★(b)「受け手が 1 面も無い」は公開 API から到達できない —— 入力面が 0 になると
//   provider の `enabled` が false になりポーリングが止まるため、サンプルが流れない。
//   ⇒ **テストとして書けない**（書かなかったのではない＝`E-84`）。ガード自体は
//   `dispatchAction` の `ownerId === null` で実装してあり、上の (a) が
//   「受け手でない面には配送されない」側を固定している。

// ---------------------------------------------------------------------------
// (g) 前置きが未登録でも壊れない / (i) 効かなかったことが分かる
// ---------------------------------------------------------------------------

describe("(g) 前置きの割当が無くても M21-03 までの入力は壊れない", () => {
  beforeEach(() => {
    activeProfile = PROFILE_WITHOUT_PREFIX;
  });

  it("通常の入力はそのままステップになる", () => {
    const { onSteps } = renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAllAndSettle();

    expect(onSteps).toHaveBeenCalledTimes(1);
    expect(onSteps.mock.calls[0][0][0].moveId).toBe(3);
  });

  it("前置きに使うはずの物理ボタンを押しても、何も起きない", () => {
    const { onSteps } = renderRecipe();

    sample([BUTTON_INDEX.shortcut_prefix]);
    sample([]);
    expect(shortcutText()).not.toContain("前置き中");

    // 後続ボタンは吸収されず、通常どおりステップになる。
    pressAndConfirm([BUTTON_INDEX.heavy_kick]);
    releaseAllAndSettle();
    expect(onSteps).toHaveBeenCalledTimes(1);
  });

  it("★未登録であることが状態として画面に出る（失敗として扱わない）", () => {
    renderRecipe();
    expect(shortcutText()).toContain("未登録");
  });
});
