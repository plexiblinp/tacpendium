// 物理コントローラ入力の接続（M21-03 §5 (b) / (c) / (d) / (e) / (f) / (h)）。
//
// ★実機コントローラと user gesture を要するため E2E からは模擬できない（M21-02 で確認済み）。
//   ⇒ ポーリング層だけを差し替え、rAF の観測（snapshot, now）を手で流して固定する。
//   判定そのものは M21-02 の実物がそのまま動く（本サブは判定を持たない）。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeBuilder } from "@/features/combo/components/RecipeBuilder";
import type { Step } from "@/features/combo/types";
import type { CommandIndexEntries } from "@/features/combo/inputResolutionStage2";
import type { Move } from "@/features/moves/types";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import type { SetupStepInput } from "@/features/setup/types";

import { PhysicalInputProvider } from "@/features/physical-input/PhysicalInputProvider";
import { GAMEPAD_INPUT_NOTICE_POINTS } from "./components/GamepadInputNotice";
import { SIMULTANEOUS_PRESS_WINDOW_MS } from "./stepDetection";
import type { GamepadProfile, GamepadSnapshot } from "./types";
import type { GamepadSampleListener } from "./useGamepadPolling";

// ---------------------------------------------------------------------------
// ポーリング層とプロファイル解決の差し替え
// ---------------------------------------------------------------------------

const PAD_ID = "test-pad";

// ★物理 index はこの 1 か所だけで決める（normalize は index を profile からしか受け取らない）。
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
} as const;

// ★同一参照を返し続けること。毎レンダリング新しい profile を返すと useStepDetection が
//   「差し替え」とみなして次サンプルを種付けに使い、入力が 1 つ落ちる。
const PROFILE: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: {
    up: { kind: "button", index: BUTTON_INDEX.up },
    down: { kind: "button", index: BUTTON_INDEX.down },
    left: { kind: "button", index: BUTTON_INDEX.left },
    right: { kind: "button", index: BUTTON_INDEX.right },
  },
  buttons: {
    light_punch: { kind: "button", index: BUTTON_INDEX.light_punch },
    medium_punch: { kind: "button", index: BUTTON_INDEX.medium_punch },
    heavy_punch: { kind: "button", index: BUTTON_INDEX.heavy_punch },
    light_kick: { kind: "button", index: BUTTON_INDEX.light_kick },
    medium_kick: { kind: "button", index: BUTTON_INDEX.medium_kick },
    heavy_kick: { kind: "button", index: BUTTON_INDEX.heavy_kick },
    drive_impact: { kind: "button", index: BUTTON_INDEX.drive_impact },
    drive_parry: { kind: "button", index: BUTTON_INDEX.drive_parry },
    throw: { kind: "button", index: BUTTON_INDEX.throw },
  },
};

let sampleListener: GamepadSampleListener | null = null;
// ★接続状態を差し替えられるようにする（未接続時の出し分けを固定するため。レビュー指摘 中-1）。
let pollingStatus: "idle" | "connected" | "disconnected" = "connected";

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
      status: enabled ? pollingStatus : "idle",
      snapshot: enabled ? SNAPSHOT_META : null,
      axesBaseline: null,
      getFrameIntervalMs: () => null,
    };
  },
}));

const saveProfile = vi.fn(() => true);
const removeProfile = vi.fn(() => true);

vi.mock("./useGamepadProfiles", () => ({
  useGamepadProfiles: () => ({
    browserKey: "test-browser",
    profile: PROFILE,
    source: "saved",
    saveProfile,
    removeProfile,
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

function releaseAll() {
  sample([]);
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
  makeMove(7, "drive_impact", "drive_impact"),
  makeMove(8, "drive_parry", "system"),
  makeMove(9, "throw_forward", "throw"),
  makeMove(10, "throw_back", "throw"),
  makeMove(33, "hadoken_od", "special"),
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
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <PhysicalInputProvider>
        <RecipeHarness onSteps={onSteps} />
      </PhysicalInputProvider>
    </QueryClientProvider>,
  );
  return { onSteps };
}

beforeEach(() => {
  vi.useFakeTimers();
  sampleListener = null;
  pollingStatus = "connected";
  clock = 1000;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("物理入力 → レシピのステップ（FR105）", () => {
  it("攻撃 1 ボタンが 1 ステップになる", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([BUTTON_INDEX.heavy_punch]);

    expect(onSteps).toHaveBeenCalledTimes(1);
    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_heavy_punch");
    expect(steps[0].stepOrder).toBe(1);
  });

  it("方向を押しながらのボタンが方向つきで解決される", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([BUTTON_INDEX.down, BUTTON_INDEX.medium_kick]);

    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps[0].moveCode).toBe("crouching_medium_kick");
  });

  it("同じ強度の P＋K が共通技になる（★OD ではない）", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([BUTTON_INDEX.heavy_punch, BUTTON_INDEX.heavy_kick]);

    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps[0].moveCode).toBe("drive_impact");
  });

  it("後方を押しながらの 弱P＋弱K が後ろ投げになる（§9.2-7）", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([
      BUTTON_INDEX.left,
      BUTTON_INDEX.light_punch,
      BUTTON_INDEX.light_kick,
    ]);

    const steps = onSteps.mock.calls[0][0] as Step[];
    expect(steps[0].moveCode).toBe("throw_back");
  });
});

// ★§5 (b)
describe("(b) 解決できない入力はステップにならず、読取表示に出る", () => {
  it("PP（OD）はステップにならず、理由が画面に出る", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([BUTTON_INDEX.medium_punch, BUTTON_INDEX.heavy_punch]);

    expect(onSteps).not.toHaveBeenCalled();

    const unresolved = screen.getByTestId("recipe-gamepad-readout-unresolved");
    expect(unresolved.textContent).toContain("必殺技タブ");
    // 何が入力されたかも出ていること（黙って捨てない）。
    expect(unresolved.textContent).toContain("中パンチ");
    expect(unresolved.textContent).toContain("強パンチ");
  });

  it("強度をまたぐ同時押しもステップにならない", () => {
    const { onSteps } = renderRecipe();
    pressAndConfirm([BUTTON_INDEX.light_punch, BUTTON_INDEX.heavy_kick]);

    expect(onSteps).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
    ).toContain("強度の違うボタン");
  });

  it("確定したステップは読取表示にも出る", () => {
    renderRecipe();
    pressAndConfirm([BUTTON_INDEX.light_punch]);

    expect(
      screen.getByTestId("recipe-gamepad-readout-resolved").textContent,
    ).toContain("standing_light_punch");
  });

  // ★レビュー指摘 中-5。成功入力が続いても理由が押し出されない（区画ごとに独立した上限）。
  it("解決できなかった入力は、そのあと成功入力が続いても押し出されない", () => {
    renderRecipe();

    pressAndConfirm([BUTTON_INDEX.medium_punch, BUTTON_INDEX.heavy_punch]);
    releaseAll();

    for (let i = 0; i < 6; i += 1) {
      pressAndConfirm([BUTTON_INDEX.light_punch]);
      releaseAll();
    }

    expect(
      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
    ).toContain("必殺技タブ");
  });
});

// ★§5 (c)
describe("(c) 物理と仮想の入力が混在でき、順序が入力順どおりになる", () => {
  it("物理 → 仮想クリック → 物理 の順に並ぶ", () => {
    const { onSteps } = renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAll();

    fireEvent.click(screen.getByTestId("recipe-normal-light-kick"));

    pressAndConfirm([BUTTON_INDEX.medium_kick]);

    const steps = onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[];
    expect(steps.map((s) => s.moveCode)).toEqual([
      "standing_heavy_punch",
      "standing_light_kick",
      "standing_medium_kick",
    ]);
    expect(steps.map((s) => s.stepOrder)).toEqual([1, 2, 3]);
  });
});

// ★§5 (d)
describe("(d) 点灯は論理ボタン層が状態源である", () => {
  it("押している間だけ点灯し、離すと消える", () => {
    renderRecipe();

    sample([BUTTON_INDEX.heavy_punch, BUTTON_INDEX.down]);
    expect(
      screen.getByTestId("recipe-normal-heavy-punch").getAttribute("data-held"),
    ).toBe("true");
    expect(screen.getByTestId("recipe-dir-2").getAttribute("data-held")).toBe(
      "true",
    );
    // 押していないボタンは点灯しない。
    expect(
      screen.getByTestId("recipe-normal-light-punch").getAttribute("data-held"),
    ).toBeNull();

    releaseAll();
    expect(
      screen.getByTestId("recipe-normal-heavy-punch").getAttribute("data-held"),
    ).toBeNull();
    expect(
      screen.getByTestId("recipe-dir-2").getAttribute("data-held"),
    ).toBeNull();
    // ★ニュートラル(5)は点灯させない。方向は「状態」なので未入力でも direction_neutral が
    //   入っているが、それを点灯へ回すと「押している間だけ光る」の規約と食い違う。
    expect(
      screen.getByTestId("recipe-dir-5").getAttribute("data-held"),
    ).toBeNull();
  });

  it("★ステップが確定しても、離していれば点灯は消える（状態源が確定ステップでないこと）", () => {
    renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    // 確定済み。ここで指を離す。
    releaseAll();

    expect(
      screen.getByTestId("recipe-normal-heavy-punch").getAttribute("data-held"),
    ).toBeNull();
    // 確定したステップのほうは残っている。
    expect(
      screen.getByTestId("recipe-gamepad-readout-resolved").textContent,
    ).toContain("standing_heavy_punch");
  });

  it("マクロの投げは方向に合わせて前投げ/後ろ投げが点灯する", () => {
    renderRecipe();
    // ★★M30-01 追補: 共通技は常設行から共通技タブへ移設した。
    //   点灯は DirectSpecPanel の `held` として保たれている(渡さないと静かに消える)。
    // ★Radix の TabsTrigger は mouseDown で切り替わる(click だけでは動かない)。
    fireEvent.mouseDown(screen.getByTestId("recipe-tab-common"));

    sample([BUTTON_INDEX.throw]);
    expect(
      screen.getByTestId("recipe-common-throw_forward").getAttribute("data-held"),
    ).toBe("true");

    sample([BUTTON_INDEX.throw, BUTTON_INDEX.left]);
    expect(
      screen.getByTestId("recipe-common-throw_back").getAttribute("data-held"),
    ).toBe("true");
    expect(
      screen.getByTestId("recipe-common-throw_forward").getAttribute("data-held"),
    ).toBeNull();
  });
});

// ★§5 (e)
describe("(e) 直前のステップを削除しても、点灯と判定が壊れない", () => {
  it("削除のあとも物理入力が続けて入る", () => {
    const { onSteps } = renderRecipe();

    pressAndConfirm([BUTTON_INDEX.heavy_punch]);
    releaseAll();

    fireEvent.click(screen.getByTestId("recipe-system-delete"));
    expect(
      (onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[]).length,
    ).toBe(0);

    // 削除の直後でも点灯は論理ボタン層のまま。
    sample([BUTTON_INDEX.light_kick]);
    expect(
      screen.getByTestId("recipe-normal-light-kick").getAttribute("data-held"),
    ).toBe("true");

    act(() => {
      vi.advanceTimersByTime(SIMULTANEOUS_PRESS_WINDOW_MS);
    });
    clock += SIMULTANEOUS_PRESS_WINDOW_MS;

    const steps = onSteps.mock.calls[onSteps.mock.calls.length - 1][0] as Step[];
    expect(steps.map((s) => s.moveCode)).toEqual(["standing_light_kick"]);
    expect(steps[0].stepOrder).toBe(1);
  });
});

// ★レビュー指摘 中-1。provider の有無ではなく接続状態で出し分ける。
describe("未接続のときは告知・読取表示・受け手バッジを出さない", () => {
  it("status が idle のあいだは常設されない", () => {
    pollingStatus = "idle";
    renderRecipe();

    expect(screen.queryByTestId("recipe-gamepad-notice")).toBeNull();
    expect(screen.queryByTestId("recipe-gamepad-readout")).toBeNull();
    expect(screen.queryByTestId("recipe-gamepad-owner")).toBeNull();
    // ★接続状態の表示そのもの(M21-01 の導線)は残る。
    expect(screen.getByTestId("recipe-gamepad-status")).toBeTruthy();
    // 入力面は従来どおり動く。
    expect(screen.getByTestId("recipe-normal-light-punch")).toBeTruthy();
  });

  it("接続されていれば出る", () => {
    renderRecipe();
    expect(screen.getByTestId("recipe-gamepad-notice")).toBeTruthy();
    expect(screen.getByTestId("recipe-gamepad-readout")).toBeTruthy();
    expect(screen.getAllByTestId("recipe-gamepad-owner").length).toBe(1);
  });
});

// ★§5 (f)
describe("(f) 告知の 3 点が画面にある", () => {
  it("3 点すべてが存在する（文言の完全一致ではなく存在を見る）", () => {
    renderRecipe();

    const notice = screen.getByTestId("recipe-gamepad-notice");
    expect(notice).toBeTruthy();
    for (let i = 1; i <= GAMEPAD_INPUT_NOTICE_POINTS.length; i += 1) {
      expect(
        screen.getByTestId(`recipe-gamepad-notice-point-${i}`).textContent,
      ).toBeTruthy();
    }
    expect(GAMEPAD_INPUT_NOTICE_POINTS).toHaveLength(3);
    // ★3 点目（不具合ではなく意図的な設定であること）が落ちていないこと。
    expect(notice.textContent).toContain("不具合ではなく");
  });

  it("★判定窓の実値を利用者向け文言へ写していない", () => {
    renderRecipe();
    const notice = screen.getByTestId("recipe-gamepad-notice");
    expect(notice.textContent).not.toContain(
      String(SIMULTANEOUS_PRESS_WINDOW_MS),
    );
    expect(notice.textContent).not.toContain("ミリ秒");
    expect(notice.textContent).not.toContain("ms");
  });
});

// ★§5 (h)
describe("(h) 2 面で同じ入力が同じ move_code になる", () => {
  it("レシピ入力面とセットプレイ入力面で一致する", () => {
    const onRecipeSteps = vi.fn();
    const onSetupSteps = vi.fn();

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PhysicalInputProvider>
          <RecipeHarness onSteps={onRecipeSteps} />
          <div data-testid="setup-surface">
            <SetupHarness onSteps={onSetupSteps} />
          </div>
        </PhysicalInputProvider>
      </QueryClientProvider>,
    );

    // 既定の受け手はレシピ入力面（最初に登録された面）。
    pressAndConfirm([BUTTON_INDEX.down, BUTTON_INDEX.medium_kick]);
    releaseAll();

    const recipeSteps = onRecipeSteps.mock.calls[0][0] as Step[];
    expect(recipeSteps[0].moveCode).toBe("crouching_medium_kick");
    expect(onSetupSteps).not.toHaveBeenCalled();

    // セットプレイ入力面を触ると受け手が移る（最後に触った面）。
    const setupSurface = screen.getByTestId("setup-surface");
    const setupHeading = setupSurface.querySelectorAll(
      "[data-testid='recipe-gamepad-readout']",
    )[0];
    expect(setupHeading).toBeTruthy();
    fireEvent.pointerDown(setupHeading as Element);

    pressAndConfirm([BUTTON_INDEX.down, BUTTON_INDEX.medium_kick]);

    const setupSteps = onSetupSteps.mock.calls[0][0] as SetupStepInput[];
    expect(setupSteps).toHaveLength(1);
    // ★同じ入力が同じ技へ解決されている（解決が 1 か所であることの主張）。
    expect(setupSteps[0].moveId).toBe(recipeSteps[0].moveId);
    // レシピ側へ二重に入っていないこと（受け手は常に 1 面）。
    expect(onRecipeSteps).toHaveBeenCalledTimes(1);
  });

  it("告知は両方の面に出る（同じ文言を 2 か所へ書き写していない）", () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <PhysicalInputProvider>
          <RecipeHarness onSteps={vi.fn()} />
          <SetupHarness onSteps={vi.fn()} />
        </PhysicalInputProvider>
      </QueryClientProvider>,
    );

    const notices = screen.getAllByTestId("recipe-gamepad-notice");
    expect(notices).toHaveLength(2);
    // 同一の定数から描かれているため文面は必ず一致する。
    expect(notices[0].textContent).toBe(notices[1].textContent);
  });
});
