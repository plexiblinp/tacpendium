// モーダル表示中の物理入力の遮断（M21-07 §5.1 の 7 項目）。
//
// ★ハーネスは `commandMode.test.tsx` に倣う。時計を手で握り、判定窓の開閉を完全に再現する。
//
// ★**本スイートの中核は「破壊確認」である**（`SUPP-001` §5.5 (10′)）。抑止側の主張だけを
//   並べると、**全部を抑止していても緑になる。** ⇒ どの抑止の主張にも、モーダルを開かない
//   同じ操作で「従来どおり入る」ことを見る対照を対で置いてある。
//
// ★**特定のセレクタ・属性値を主張していない**（**D-380**）。主張しているのは
//   「モーダルが開いている間、受け手の面の状態が変わらない」という不変条件だけである。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent } from "@/components/ui/popover";
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

const PAD_INDEX = {
  light_punch: 2,
  heavy_kick: 3,
} as const;

const PAD_PROFILE: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "test-browser",
  directions: {},
  buttons: {
    light_punch: { kind: "button", index: PAD_INDEX.light_punch },
    heavy_kick: { kind: "button", index: PAD_INDEX.heavy_kick },
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

function seedBindings() {
  localStorage.setItem(
    KEYBOARD_BINDINGS_STORAGE_KEY,
    JSON.stringify(fullBindings()),
  );
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

function tap(code: string, advance = 10) {
  keyDown(code, advance);
  keyUp(code, advance);
}

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

/** 方向列を実際のレバー操作として流す（差分だけ動かす。`commandMode.test.tsx` と同じ）。 */
function roll(sequence: string) {
  let held: readonly string[] = [];
  for (const digit of sequence) {
    const next = DIR_KEYS[digit];
    for (const code of held) if (!next.includes(code)) keyUp(code);
    for (const code of next) if (!held.includes(code)) keyDown(code);
    held = next;
  }
  for (const code of held) keyUp(code);
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
// 供給元の一覧（★§5.1-7「軸が 1 か所であること」を性質として固定するために表で持つ）
// ---------------------------------------------------------------------------

/**
 * 「1 技分の入力を供給して確定させる」ことだけを知っている供給元の表。
 *
 * ★**特定の関数を呼んでいることでは固定しない。** 固定したいのは
 *   **「供給元を足しても穴が開かない」**という性質である。⇒ 供給元を表で持ち、
 *   **同じ主張を全供給元に対して回す。** 新しい供給元が増えたら本表へ 1 行足すだけで、
 *   抑止の主張が自動的にその供給元へも掛かる。
 *
 * ★★**本表が証明することと、しないことを取り違えないこと**（M21-07 レビュー指摘 中-3）。
 *   - **証明する**: いまある供給元がすべて抑止されること。**軸を 1 つ落とせば必ずどれかが落ちる。**
 *   - **証明しない**: 軸が**物理的に 1 か所しか無い**こと。**供給元ごとに同じ条件を二重化した
 *     実装でも本表は緑になる。** ⇒ **「1 か所であること」はコードを読んで確認するしかない**
 *     （チェックリスト §9-1 が「動作確認では捕まらない。コードで確認すること」と書いているのは
 *     この意味である）。**ここに静的な形の主張を足して埋めようとしないこと**——
 *     **守りたいのは形ではなく性質である**（§5.1-7）。
 */
const SOURCES: ReadonlyArray<{
  name: string;
  setup: () => void;
  /** 弱P を 1 回押して離す（窓は閉じない）。 */
  pressLightPunch: () => void;
  releaseAll: () => void;
}> = [
  {
    name: "キーボード（KeyboardEvent）",
    setup: seedBindings,
    pressLightPunch: () => keyDown(KEY.light_punch),
    releaseAll: () => keyUp(KEY.light_punch),
  },
  {
    name: "Gamepad（rAF ポーリング）",
    setup: () => {
      padProfile = PAD_PROFILE;
      pollingStatus = "connected";
    },
    pressLightPunch: () => padSample([PAD_INDEX.light_punch]),
    releaseAll: () => padSample([]),
  },
];

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
  makeMove(2, "standing_medium_punch"),
  makeMove(3, "standing_heavy_punch"),
  makeMove(4, "hadoken_light", "special"),
  makeMove(5, "sa1_shinku_hadoken", "super_art"),
];

// ★`236LP` と `236236LP` を両方載せる。**モーダル中に方向列が溜まったかどうかを、
//   確定した技そのもので弁別できる**（溜まっていれば 236236 になり別の技が出る）。
const MOTION_COMMANDS: MotionCommandDTO[] = [
  { tokenKey: "236LP", moveCode: "hadoken_light" },
  { tokenKey: "236236LP", moveCode: "sa1_shinku_hadoken" },
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
  qc.setQueryData(["motion-commands", CHAR_ID], {
    characterId: CHAR_ID,
    commands: MOTION_COMMANDS,
  });
  qc.setQueryData(["moves", "by-character", CHAR_ID], MOVES);
  return qc;
}

// ---------------------------------------------------------------------------
// ハーネス
// ---------------------------------------------------------------------------

/** 重なりの種類。★`dialog` だけがモーダルであり、`popover` は対照実験用である。 */
type Overlay = "none" | "dialog" | "popover";

interface SceneProps {
  overlay: Overlay;
  onSteps: (steps: Step[]) => void;
  onSave?: () => void;
  canSave?: boolean;
}

function Scene({ overlay, onSteps, onSave, canSave }: SceneProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  return (
    <>
      <RecipeBuilder
        characterId={CHAR_ID}
        steps={steps}
        moves={MOVES}
        movesLoading={false}
        onChange={(next) => {
          setSteps(next);
          onSteps(next);
        }}
        onSave={onSave}
        canSave={canSave}
      />
      {/* ★入力面と同じツリーに置いてあるが、実体は Portal で別の場所へ出る。
          ⇒ 入力面のマウント判定（ポーリングの可否）には影響しない。 */}
      <Dialog open={overlay === "dialog"}>
        <DialogContent>
          <DialogTitle>試験用モーダル</DialogTitle>
          <DialogDescription>本文</DialogDescription>
          <button type="button" data-testid="modal-button">
            ダイアログ内のボタン
          </button>
        </DialogContent>
      </Dialog>
      {/* ★対照実験用の「モーダルでない重なり」。 */}
      <Popover open={overlay === "popover"}>
        <PopoverContent>重なりの中身</PopoverContent>
      </Popover>
    </>
  );
}

interface RenderOptions {
  onSave?: () => void;
  canSave?: boolean;
}

function renderScene(options: RenderOptions = {}) {
  const onSteps = vi.fn();
  const tree = (overlay: Overlay) => (
    <QueryClientProvider client={queryClient}>
      <PhysicalInputProvider>
        <Scene
          overlay={overlay}
          onSteps={onSteps}
          onSave={options.onSave}
          canSave={options.canSave}
        />
      </PhysicalInputProvider>
    </QueryClientProvider>
  );
  const queryClient = makeQueryClient();
  const view = render(tree("none"));
  /** 重なりを切り替える。★`act` で包み、効果（抑止の遷移処理）まで流し切る。 */
  const setOverlay = (overlay: Overlay) => {
    act(() => {
      view.rerender(tree(overlay));
    });
  };
  return { onSteps, setOverlay };
}

/** 最後に onSteps へ渡ったステップ列。 */
function latestSteps(onSteps: ReturnType<typeof vi.fn>): Step[] {
  const calls = onSteps.mock.calls;
  return calls.length === 0 ? [] : (calls[calls.length - 1][0] as Step[]);
}

function actionText(): string {
  return screen.queryByTestId("recipe-gamepad-readout-action")?.textContent ?? "";
}

/** 弱P を 1 回入れて窓を閉じ切る（キーボード経路）。 */
function inputLightPunch() {
  keyDown(KEY.light_punch);
  closeWindow();
  keyUp(KEY.light_punch);
  closeWindow();
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
// (1) モーダル中は技ステップが受け手の面へ配送されない ＋ ★対照
// ===========================================================================

describe("(1) モーダル中は技ステップが配送されない", () => {
  it("★モーダルを開いていなければ従来どおりステップが入る（対照実験）", () => {
    seedBindings();
    const { onSteps } = renderScene();

    inputLightPunch();

    expect(latestSteps(onSteps)).toHaveLength(1);
  });

  it("モーダルが開いている間は、同じ入力でステップが入らない", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("dialog");
    inputLightPunch();

    expect(latestSteps(onSteps)).toHaveLength(0);
  });
});

// ===========================================================================
// (2) 操作 4 種すべてが起きない（★1 つだけ通っていても他が漏れる）
// ===========================================================================

describe("(2) モーダル中は操作 4 種が起きない", () => {
  it("削除（★対照＝モーダルを開いていなければ消える）", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();
    inputLightPunch();
    expect(latestSteps(onSteps)).toHaveLength(1);

    setOverlay("dialog");
    tap(KEY.delete);
    expect(latestSteps(onSteps)).toHaveLength(1);
    // ★結果表示にも何も出ない（「対象がありません」すら出ない＝そもそも起きていない）。
    expect(actionText()).toBe("");

    setOverlay("none");
    tap(KEY.delete);
    expect(latestSteps(onSteps)).toHaveLength(0);
  });

  it("保存（★対照＝モーダルを開いていなければ呼ばれる）", () => {
    seedBindings();
    const onSave = vi.fn();
    const { setOverlay } = renderScene({ onSave, canSave: true });

    setOverlay("dialog");
    tap(KEY.save);
    expect(onSave).not.toHaveBeenCalled();

    setOverlay("none");
    tap(KEY.save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("修飾トグル（★対照＝モーダルを開いていなければ編集ダイアログが開く）", () => {
    seedBindings();
    const { setOverlay } = renderScene();
    inputLightPunch();

    setOverlay("dialog");
    tap(KEY.modifier);
    expect(screen.queryByText(/ステップ編集:/)).toBeNull();

    setOverlay("none");
    tap(KEY.modifier);
    expect(screen.getByText(/ステップ編集:/).textContent).toContain(
      "standing_light_punch",
    );
  });

  // ★モードの出入りも操作の 1 つである（§4.4-4）。
  //
  // ★**「モードに入っていない」ことは、モードでない挙動そのもので見る。** 表示文言に
  //   頼ると、文言を変えただけでテストが壊れる／文言だけ合っていて実体が違う形を通す。
  it("モードの出入り（★対照＝モーダルを開いていなければモードへ入る）", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("dialog");
    tap(KEY.command_mode);
    setOverlay("none");

    // ★モードへ入れていれば、弱P は「モードでの確定」になり通常ステップにならない。
    //   通常ステップが 1 つ入る＝モードへ入っていない。
    inputLightPunch();
    expect(latestSteps(onSteps)).toHaveLength(1);

    // 対照: モーダルを開いていない状態で同じ操作をするとモードへ入る。
    tap(KEY.command_mode);
    keyDown(KEY.light_punch);
    closeWindow();
    keyUp(KEY.light_punch);
    closeWindow();
    // ★モード中の弱P は方向列 0 件の確定であり、解決できない＝ステップは増えない。
    expect(latestSteps(onSteps)).toHaveLength(1);
  });
});

// ===========================================================================
// (3) ★閉じたあとに「押されたまま」が残らない（本サブで最も落としやすい）
// ===========================================================================

describe("(3) 閉じたあとに押されたままが残らない", () => {
  it("開く → 押す → 閉じる → 離す で、ステップが増えない", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("dialog");
    keyDown(KEY.light_punch);
    setOverlay("none");
    keyUp(KEY.light_punch);
    closeWindow();

    expect(latestSteps(onSteps)).toHaveLength(0);
  });

  it("★その後の通常入力は正しく効く（観測を止めていれば、ここで押しっぱなしが残る）", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("dialog");
    keyDown(KEY.light_punch);
    setOverlay("none");
    keyUp(KEY.light_punch);
    closeWindow();

    inputLightPunch();
    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_light_punch");
  });

  // ★★**本サブで最も重要な契約テスト**（`SUPP-001` §5.5 (10′) の「代わりに守っていたもの」）。
  //
  // ★上の 2 件は**観測を止めても緑になる**。理由——判定層は**立ち上がり**で窓を開くため、
  //   抑止中に押下そのものを見落とせば、その解放も何も起こさない。**「押されたまま」の害は
  //   ステップが増える方向ではなく、ステップが増えなくなる方向に出る。**
  //
  // ★実際に壊れる筋道——**モーダルが開く前から押していたボタンを、開いている間に離す。**
  //   観測を止めていると判定層は「まだ押されている」と思い込んだままになり、
  //   **閉じたあとに押し直しても立ち上がりに見えず、その入力が黙って消える。**
  //   ⇒ 症状は「たまに入力が効かない」であり、原因がモーダルにあるとは誰も分からない。
  it("★モーダル中に離したボタンが「押されたまま」にならない（閉じたあとの再入力が効く）", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    // 開く前から押している。
    keyDown(KEY.light_punch);
    setOverlay("dialog");
    // ★開いている間に離す。ここを観測できないと判定層の押下状態が古いまま残る。
    keyUp(KEY.light_punch);
    setOverlay("none");

    // 閉じたあとに押し直す。
    inputLightPunch();

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("standing_light_punch");
  });

  // ★モーダルを開く前から押しっぱなしだった場合（§4.3-3 の「またぐ入力」）。
  it("開く前から押しっぱなしのボタンも、閉じたあと離すだけではステップにならない", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    keyDown(KEY.light_punch);
    setOverlay("dialog");
    setOverlay("none");
    keyUp(KEY.light_punch);
    closeWindow();

    // ★開いた時点で判定窓は閉じられている（溜めない＝§4.3-1）。
    expect(latestSteps(onSteps)).toHaveLength(0);
  });
});

// ===========================================================================
// (3′) ★点灯もモーダル中は出さない（開発者の実機確認・2026-08-15）
// ===========================================================================

/** いま点灯している要素の数（仮想コントローラの `data-held`）。 */
function litCount(): number {
  return document.querySelectorAll('[data-held="true"]').length;
}

describe("(3′) モーダル中は裏の仮想コントローラも光らない", () => {
  it("★対照 — モーダルを開いていなければ、押している間は光る", () => {
    seedBindings();
    renderScene();

    keyDown(KEY.light_punch);
    expect(litCount()).toBeGreaterThan(0);
    keyUp(KEY.light_punch);
    expect(litCount()).toBe(0);
  });

  it("モーダルが開いている間は、押しても光らない", () => {
    seedBindings();
    const { setOverlay } = renderScene();

    setOverlay("dialog");
    keyDown(KEY.light_punch);
    expect(litCount()).toBe(0);
    keyUp(KEY.light_punch);
  });

  // ★★**本件が「観測を止めた」のではないことの証拠**（§4.2）。
  //   伏せているのは出口の見せ方だけなので、**閉じた瞬間に「いま押されているもの」が光る。**
  //   観測まで止めていたら、押下を見落としているためここで光らない。
  it("★押しっぱなしのまま閉じると、その瞬間に点灯が復帰する", () => {
    seedBindings();
    const { setOverlay } = renderScene();

    setOverlay("dialog");
    keyDown(KEY.light_punch);
    expect(litCount()).toBe(0);

    setOverlay("none");
    expect(litCount()).toBeGreaterThan(0);

    keyUp(KEY.light_punch);
    expect(litCount()).toBe(0);
  });

  it("モーダルでない重なりでは従来どおり光る（対照）", () => {
    seedBindings();
    const { setOverlay } = renderScene();

    setOverlay("popover");
    keyDown(KEY.light_punch);
    expect(litCount()).toBeGreaterThan(0);
    keyUp(KEY.light_punch);
  });
});

// ===========================================================================
// (4) 閉じた瞬間にまとめて入らない
// ===========================================================================

describe("(4) 閉じた瞬間にまとめて入らない", () => {
  it("開いている間に複数回押しても、閉じたときにステップが 1 つも増えない", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("dialog");
    tap(KEY.light_punch);
    closeWindow();
    tap(KEY.medium_punch);
    closeWindow();
    tap(KEY.heavy_punch);
    closeWindow();

    setOverlay("none");
    closeWindow();

    expect(latestSteps(onSteps)).toHaveLength(0);
  });
});

// ===========================================================================
// (5) ★対照実験 — モーダルでない重なりでは従来どおり配送される
// ===========================================================================

describe("(5) モーダルでない重なりでは従来どおり効く", () => {
  it("重なりが出ていてもステップが入る", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    setOverlay("popover");
    inputLightPunch();

    expect(latestSteps(onSteps)).toHaveLength(1);
  });

  it("重なりが出ていても操作が効く", () => {
    seedBindings();
    const onSave = vi.fn();
    const { setOverlay } = renderScene({ onSave, canSave: true });

    setOverlay("popover");
    tap(KEY.save);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// (6) コマンド技入力モード中にモーダルが開いても方向列が溜まらない
// ===========================================================================

describe("(6) モード中にモーダルが開いても方向列が溜まらない", () => {
  // ★**溜まったかどうかを、確定した技そのもので弁別する。** 表示文言では
  //   「溜まっていないこと」と「表示が更新されていないこと」を区別できない。
  it("モード中にモーダルの裏で方向を振っても、列は伸びていない", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    tap(KEY.command_mode);
    roll("236");

    setOverlay("dialog");
    roll("236"); // ★裏で振る。溜まれば列は 236236 になる。
    setOverlay("none");

    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    // ★236LP。溜まっていれば 236236LP＝`sa1_shinku_hadoken` になる。
    expect(steps[0].moveCode).toBe("hadoken_light");
  });

  it("★対照 — モーダルを開かなければ 236 を 2 回振った列で解決する", () => {
    seedBindings();
    const { onSteps } = renderScene();

    tap(KEY.command_mode);
    roll("236");
    roll("236");

    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    expect(steps[0].moveCode).toBe("sa1_shinku_hadoken");
  });

  // ★モードから強制的に出さないこと（§4.4-2 の as-built）の固定。
  it("★モーダルを閉じたあともモードは続いている（強制的に出さない）", () => {
    seedBindings();
    const { onSteps, setOverlay } = renderScene();

    tap(KEY.command_mode);
    setOverlay("dialog");
    setOverlay("none");

    roll("236");
    keyDown(KEY.light_punch);
    keyUp(KEY.light_punch);

    const steps = latestSteps(onSteps);
    expect(steps).toHaveLength(1);
    // ★モードが解除されていれば、弱P は通常の `standing_light_punch` になる。
    expect(steps[0].moveCode).toBe("hadoken_light");
  });
});

// ===========================================================================
// (7) ★軸が 1 か所にしかないこと（性質として固定する）
// ===========================================================================

describe("(7) 軸は合流層に 1 本だけである", () => {
  // ★**供給元ごとに条件が書かれていたら、表のどれかで必ず落ちる。**
  //   ⇒ 新しい供給元を足す人は `SOURCES` へ 1 行足すだけでよく、抑止の主張が自動的に掛かる。
  for (const source of SOURCES) {
    it(`${source.name}: モーダル中は抑止され、閉じれば従来どおり入る`, () => {
      source.setup();
      const { onSteps, setOverlay } = renderScene();

      setOverlay("dialog");
      source.pressLightPunch();
      closeWindow();
      source.releaseAll();
      closeWindow();
      expect(latestSteps(onSteps)).toHaveLength(0);

      setOverlay("none");
      source.pressLightPunch();
      closeWindow();
      source.releaseAll();
      closeWindow();
      expect(latestSteps(onSteps)).toHaveLength(1);
    });

    // ★観測を止めていないことも、供給元ごとではなく性質として固定する。
    it(`${source.name}: モーダル中に離しても、閉じたあとの再入力が効く`, () => {
      source.setup();
      const { onSteps, setOverlay } = renderScene();

      source.pressLightPunch();
      setOverlay("dialog");
      source.releaseAll();
      setOverlay("none");

      source.pressLightPunch();
      closeWindow();
      source.releaseAll();
      closeWindow();
      expect(latestSteps(onSteps)).toHaveLength(1);
    });
  }
});
