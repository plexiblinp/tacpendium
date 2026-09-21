// 物理入力の供給と、受け手 1 面への配送（M21-03 §4.9 ／ ★M21-05 で供給元が 2 つになった）。
//
// ★**本ファイルは供給元に依存しない層である**（M21-06 §4.0・**D-375**）。旧名 `GamepadInputProvider`
//   は供給元が Gamepad だけだった時代の名前であり、`M21-05` がキーボードを合流させた時点で実体と
//   食い違った。⇒ `PhysicalInputProvider` へ改め、`features/gamepad/` から `features/physical-input/`
//   へ移した。Gamepad 固有のもの（ポーリング・プロファイル・キャリブレーション・正規化）は
//   `features/gamepad/` に残っている。**用語は `DES-005` §6.4.3 に合わせて「物理入力」で書く**
//   （「物理コントローラ」と書くとキーボード利用者に嘘になる）。
//
// ★**供給元は 2 つ・受け手の調停は 1 つ**（M21-05 §4.6-3）。M21-03 の時点では Gamepad だけで
//   あったため「供給元はアプリ全体で 1 個」と書いていたが、`M21-05` が `KeyboardEvent` の経路を
//   足したことでこの記述は失効した。**いま 1 個なのは「受け手」と「判定」と「配送チャネル」で
//   あって、供給元ではない。**
//
// ★2 つの供給元は `mergeNormalized` で**1 本の押下集合へ合流させてから**判定へ渡す。理由——
//   判定層は押下集合の**差分**で立ち上がりを採るため、各源が独立に push すると片方の push が
//   もう片方を「離した」と見せる（パッドを押したままキーを叩くと、離していない技がもう一度
//   立ち上がる）。⇒ 合流は「キーボード対応」ではなく、判定層を 1 つに保つための代償である。
//
// ★**排他にしない**（M21-05 §4.6-4）。「キーボードモード」は無く、どちらからでも同時に入る。
//
// ★なぜ provider が要るか（指示書が予見していなかった実査結果）——
//   コンボ編集画面は「レシピ」節の入力面 1 個に加えて、紐づくセットプレイ行ごとに入力面を
//   持ち、どちらも既定で展開される。入力面ごとにポーリングと判定を持つと
//   (a) rAF ループが面の数だけ増え（M21-01 §4.1-2 / M21-02 の「ループは 1 本」に反する）
//   (b) 1 回の物理入力が全部の面へ同時にステップを足す。
//   ⇒ ループ・判定・プロファイル解決を本 provider が 1 組だけ持ち、確定したステップ候補は
//     **受け手（owner）の 1 面にだけ**配送する。
//
// ★受け手の決め方は「最後に触った面」（2026-08-13 開発者判断）。選択中であることは
//   各入力面が可視で示す（GamepadStatusControl のバッジ）。
//
// ★本 provider は描画を持たない（children をそのまま返す）。解決も持たない——
//   move_code の解決は recipeInputResolution が 1 か所で行う（§4.9-3）。
//
// ★**M21-07 が「モーダルが開いている間」という軸を 1 本足した**（`DES-005` §6.4.3 項目 4″）。
//   **供給元ごとに置いていない。**——置くと、次の供給元を足したサブで同じ穴がもう一度開く。
//   **既に 2 度この形を通っている**（`M21-05` が 2 つ目の供給元を、`M21-06` がモードを足した）。
//   ⇒ 軸は `isAnyModalOpen()`（`lib/modal-presence`）1 本だけであり、**合流層の 2 つの入口**
//     （押下集合の `handleSources` ／ 操作の `dispatchAction`）が同じものを読む。
//   ★**入口が 2 つあるのは、操作が押下集合を通らないためである**——キーボードの操作キーは
//     押下集合へ混ぜない（`DES-005` §6.5「操作用のキーが押下集合へ混ざらない」）ので
//     `onAction` から直接 `dispatchAction` へ来る。**軸そのものは 1 本である。**
//   ★**観測は止めない。作用だけを止める**（§4.2）。止めると、モーダルが開いた瞬間に押されて
//     いたボタンの解放を観測できず、閉じたあとに「押されたまま」が残る——症状は「押していないのに
//     入り続ける」であり、原因がモーダルにあると誰も分からない（`DES-005` §6.5.1 (1) 項目 3 と同型）。
//   ★**溜めない。** 開いている間の入力を保持して閉じた瞬間に流す形は採らない。
//
// ★M21-04 が「ショートカット（前置きボタン ＋ 後続ボタン）」を足した。**同じ調停に相乗りする**——
//   操作も確定ステップと同様に受け手 1 面へだけ配送し、受け手を決める仕組みは 1 つのままである
//   （`DES-005` §6.4.3 の項目 4。別の調停を作ると 2 通りの答えが並ぶ）。
//   前置きの判定は `M21-02` の同時押し判定窓を通さない（`shortcut.ts` の冒頭を参照）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { NumpadDirection } from "@/features/combo/inputResolutionStage2";
import { normalizeSnapshot } from "@/features/gamepad/normalize";
import { numpadFromDirection } from "@/features/gamepad/recipeInputResolution";
import {
  SHORTCUT_PREFIX_BUTTON,
  SHORTCUT_PREFIX_TIMEOUT_MS,
  actionForFollowUp,
} from "@/features/gamepad/shortcut";
import type { PhysicalInputActionKind } from "@/features/gamepad/shortcut";
import {
  isDirectionButton,
  resolveDirection,
} from "@/features/gamepad/stepDetection";
import type {
  GamepadSample,
  StepCandidate,
} from "@/features/gamepad/stepDetection";
import { ATTACK_BUTTONS } from "@/features/gamepad/types";
import type {
  GamepadProfile,
  GamepadSnapshot,
  LogicalButton,
  NormalizeResult,
} from "@/features/gamepad/types";
import { useGamepadPolling } from "@/features/gamepad/useGamepadPolling";
import type {
  GamepadConnectionStatus,
  GamepadSampleListener,
} from "@/features/gamepad/useGamepadPolling";
import { useGamepadProfiles } from "@/features/gamepad/useGamepadProfiles";
import type { ProfileSource } from "@/features/gamepad/useGamepadProfiles";
import { useStepDetection } from "@/features/gamepad/useStepDetection";
import { mergeNormalized } from "@/features/keyboard/mergeNormalized";
import { normalizeKeyboard } from "@/features/keyboard/normalizeKeyboard";
import { createEmptyBindings } from "@/features/keyboard/types";
import type { KeyboardBindings } from "@/features/keyboard/types";
import { useKeyboardBindings } from "@/features/keyboard/useKeyboardBindings";
import { useKeyboardInput } from "@/features/keyboard/useKeyboardInput";
import { isAnyModalOpen, useAnyModalOpen } from "@/lib/modal-presence";

/** いま押されている論理ボタンと方向（点灯の状態源。★確定したステップではない）。 */
export interface HeldInput {
  /** 押されている攻撃・マクロボタン。方向は含まない。 */
  buttons: LogicalButton[];
  /** 現在の方向（SOCD 解決済み）。未入力なら `direction_neutral`。 */
  direction: LogicalButton;
}

const EMPTY_HELD: HeldInput = { buttons: [], direction: "direction_neutral" };

/**
 * コマンド技入力モードで確定した 1 件（M21-06 §4.1-5）。
 *
 * ★**判定窓を通っていない。** 溜まった方向列と、確定の契機になった攻撃ボタンだけを持つ。
 *   解決（前方一致 ＋ 最長一致）は受け手の面が行う——provider は解決を持たない
 *   （本ファイル冒頭の方針。`DES-005` §6.4.3 の項目 1 と同じ線）。
 */
export interface MotionCandidate {
  kind: "motion";
  /** 溜まった方向列（押された順）。 */
  directions: readonly NumpadDirection[];
  /**
   * 確定の契機になった攻撃ボタン。
   *
   * ★**モードを抜けたときに捨てた列は `null` である。** 黙って消さずに受け手へ渡し、
   *   読取表示に出すためにある（`E-84`／§4.1-7）。
   */
  button: LogicalButton | null;
  at: number;
}

/** 受け手が受け取る候補。★モードの有無で 2 形あるが、**配送チャネルは 1 本のままである**。 */
export type PhysicalInputCandidate = StepCandidate | MotionCandidate;

/** モードで確定した候補か。★`StepCandidate` は `kind` を持たない。 */
export function isMotionCandidate(
  candidate: PhysicalInputCandidate,
): candidate is MotionCandidate {
  return "kind" in candidate && candidate.kind === "motion";
}

/** 確定したステップ候補の受け取り口。★受け手の面にだけ呼ばれる。 */
export type StepCandidateHandler = (candidate: PhysicalInputCandidate) => void;

/**
 * コマンド技入力モードの状態（M21-06 §4.1）。★読取表示がそのまま出す。
 *
 * ★**時間で切れない**（§4.1-3）。本状態にタイマーを持たせないこと——持たせた瞬間に
 *   「非常にゆっくりな入力でも解決される」という要件そのものが壊れる。
 *   `ShortcutState`（前置き）は 2 秒で自動解除されるが、**あれとは別物である。**
 */
export interface CommandModeState {
  active: boolean;
  /** いま溜まっている方向列。★画面に出す（§4.1-6）。 */
  directions: readonly NumpadDirection[];
}

const IDLE_COMMAND_MODE: CommandModeState = { active: false, directions: [] };

/**
 * 確定の契機になりうるボタン（M21-06 §4.1-5）。
 *
 * ★**攻撃 6 ボタンだけである。** マクロ（DI / DP / 投げ）と操作用の前置きは含めない——
 *   索引のコマンドは「方向列 ＋ 攻撃ボタン 1 つ」の形で持たれており、マクロで確定させても
 *   一致する候補が無い（`commandMotion.ts` の `participates` と対になる制約）。
 * ★`ATTACK_BUTTONS`（`gamepad/types.ts`）から作る。**第 2 の一覧を書かない**（`E-76`）。
 */
const ATTACK_BUTTON_SET: ReadonlySet<string> = new Set(ATTACK_BUTTONS);

/**
 * ショートカット操作 1 件（M21-04）。★確定したステップ候補と**同じ調停**で受け手 1 面へ配送する。
 *
 * ★**operation はすべて受け手の面が実行する**（削除・保存・修飾のいずれも既存の画面側の導線）。
 *   provider は「どの操作を起こすか」を決めて配送するだけで、判定層へは効かせない。
 */
export interface PhysicalInputActionEvent {
  action: PhysicalInputActionKind;
}

/** ショートカット操作の受け取り口。★受け手の面にだけ呼ばれる。 */
export type PhysicalInputActionHandler = (event: PhysicalInputActionEvent) => void;

/** 前置き（ショートカット）の状態。★読取表示がそのまま出す。 */
export interface ShortcutState {
  /** いま前置き中か（次に押したボタンが操作になる）。 */
  active: boolean;
  /** 前置きボタンが登録されているか。false なら §4.4-3 の「割り当てが無い」状態。 */
  available: boolean;
}

const IDLE_SHORTCUT: ShortcutState = { active: false, available: false };

/**
 * キーボード側の状態（M21-05）。
 *
 * ★**`registered` が false は「未登録」であって「異常」ではない**（§4.1-4）。キーボードは
 *   既定の割当を持たないため、登録するまで 1 つも入力できない。これは失敗ではなく状態として
 *   利用者へ出す（`KeyboardStatusControl`）。
 */
export interface KeyboardInputState {
  bindings: KeyboardBindings;
  /** 技側の割当が 1 つでもあるか。 */
  registered: boolean;
  saveBindings: (bindings: KeyboardBindings) => boolean;
  clearBindings: () => void;
  /**
   * 登録中か。★true の間、通常のキーボード入力は止まる。
   *
   * ★これが無いと、登録ダイアログでキーを押すたびに**同時に技が入る**（登録画面を開いたまま
   *   レシピにステップが積まれる）。登録は「キーを技へ写す」作業そのものであるため、
   *   その最中だけは写しを止める必要がある。
   */
  capturing: boolean;
  /**
   * 登録中であることを申告する。★**面ごとの id で申告する**（`ownerId` の調停と同じ形）。
   *
   * ★**単一の boolean にしてはならない。** 入力面は同時に複数マウントされ（レシピ節 ＋
   *   セットプレイ行ごと）、面ごとに登録ダイアログを持つ。単一 boolean だと、
   *   **ダイアログを開いている最中に別の入力面がマウントされただけで、その面の効果が
   *   `false` を書き込んで通常入力が復活する**——登録中にキーを押すたびにレシピへ
   *   ステップが積まれる（本フィールドが防ごうとしている失敗そのもの）。
   *   ⇒ 申告中の id を集合で持ち、**1 つでも残っていれば止める**。
   */
  setCapturing: (id: string, capturing: boolean) => void;
}

export interface PhysicalInputContextValue {
  status: GamepadConnectionStatus;
  snapshot: GamepadSnapshot | null;
  axesBaseline: readonly number[] | null;
  padId: string | null;
  browserKey: string;
  profile: GamepadProfile | null;
  source: ProfileSource;
  saveProfile: (profile: GamepadProfile) => boolean;
  removeProfile: () => boolean;
  /** 押されている論理ボタン（点灯用）。★受け手かどうかに関わらず同じ値。 */
  held: HeldInput;
  /** いま受け手になっている入力面の id。誰も居なければ null。 */
  ownerId: string | null;
  /** 入力面の登録（マウント中だけポーリングを回すための参照カウント）。 */
  registerSurface: (id: string) => void;
  unregisterSurface: (id: string) => void;
  /** 受け手になる（最後に触った面が受け手＝2026-08-13 開発者判断）。 */
  claimSurface: (id: string) => void;
  /** 確定したステップ候補の受け取り口を登録する。 */
  setStepHandler: (id: string, handler: StepCandidateHandler | null) => void;
  /**
   * ショートカット操作の受け取り口を登録する（M21-04）。
   * ★`setStepHandler` と同じ形にしてある。受け手の調停は 1 つであり、別の調停を作らない。
   */
  setActionHandler: (id: string, handler: PhysicalInputActionHandler | null) => void;
  /**
   * 前置きの状態。★受け手かどうかに関わらず同じ値。
   *
   * ★これは **Gamepad の前置き**（M21-04）の状態である。キーボードは前置きを持たない
   *   （操作キーを直接割り当てる＝M21-05 §4.2-2）ため、本値には現れない。
   */
  shortcut: ShortcutState;
  /**
   * コマンド技入力モードの状態（M21-06）。★受け手かどうかに関わらず同じ値。
   *
   * ★**Gamepad とキーボードで共通である**（前置きと違い、両方から同じ操作で入れる＝§4.1-9）。
   */
  commandMode: CommandModeState;
  /**
   * コマンド技入力モードの入切を申告する（M21-06 §4.1-1）。
   *
   * ★**「入れるかどうか」を決めるのは受け手の面である。** 索引（`motion-commands`）を持って
   *   いるのは面の側であり、取得できていなければモードに入れない（§4.6-6）。
   *   ⇒ provider は状態を持つだけで、可否を判断しない。
   * ★**これは配送チャネルではない**（`setStepHandler` / `setActionHandler` のような登録では
   *   なく、単なる状態の setter である）。調停もチャネルも増やしていない（§4.4-2）。
   */
  setCommandModeActive: (active: boolean) => void;
  /** キーボード側の状態（M21-05）。 */
  keyboard: KeyboardInputState;
  /** provider の外で使われている（＝物理入力が効かない）ことを示す。 */
  available: boolean;
}

// ★provider の外でも壊れない既定値。テストや provider を張らない画面では
//   「物理入力は効かないが描画は従来どおり」になる。
const FALLBACK: PhysicalInputContextValue = {
  status: "idle",
  snapshot: null,
  axesBaseline: null,
  padId: null,
  browserKey: "",
  profile: null,
  source: "none",
  saveProfile: () => false,
  removeProfile: () => false,
  held: EMPTY_HELD,
  ownerId: null,
  registerSurface: () => {},
  unregisterSurface: () => {},
  claimSurface: () => {},
  setStepHandler: () => {},
  setActionHandler: () => {},
  shortcut: IDLE_SHORTCUT,
  commandMode: IDLE_COMMAND_MODE,
  setCommandModeActive: () => {},
  keyboard: {
    bindings: createEmptyBindings(),
    registered: false,
    saveBindings: () => false,
    clearBindings: () => {},
    capturing: false,
    setCapturing: () => {},
  } satisfies KeyboardInputState,
  available: false,
};

const PhysicalInputContext = createContext<PhysicalInputContextValue>(FALLBACK);

export function usePhysicalInputContext(): PhysicalInputContextValue {
  return useContext(PhysicalInputContext);
}

/** 入力面ごとに安定した id を得る。 */
export function usePhysicalInputSurfaceId(): string {
  return useId();
}

/** 押されているボタン集合が変わったかを値で比較する（順序は正規化側で決定的）。 */
function heldChanged(previous: HeldInput, next: HeldInput): boolean {
  if (previous.direction !== next.direction) return true;
  if (previous.buttons.length !== next.buttons.length) return true;
  for (let i = 0; i < next.buttons.length; i += 1) {
    if (previous.buttons[i] !== next.buttons[i]) return true;
  }
  return false;
}

export function PhysicalInputProvider({ children }: { children: ReactNode }) {
  const [surfaceIds, setSurfaceIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldInput>(EMPTY_HELD);

  const [shortcutActive, setShortcutActive] = useState(false);

  const heldRef = useRef<HeldInput>(EMPTY_HELD);
  const profileRef = useRef<GamepadProfile | null>(null);
  const handlersRef = useRef<Map<string, StepCandidateHandler>>(new Map());
  const actionHandlersRef = useRef<Map<string, PhysicalInputActionHandler>>(new Map());
  const ownerIdRef = useRef<string | null>(null);
  // 直前に配送済みのステップ候補（useStepDetection.steps は新しいものが先頭）。
  const lastDeliveredRef = useRef<StepCandidate | null>(null);

  // --- 2 つの供給元の最新の正規化結果（M21-05 §4.6-3） -------------------------
  // ★どちらか一方が変化したら、両者を合流させた 1 本の押下集合を判定へ渡す。各源が
  //   独立に push すると、片方の push がもう片方を「離した」と見せる。
  const padResultRef = useRef<NormalizeResult | null>(null);
  const keyboardResultRef = useRef<NormalizeResult | null>(null);

  // --- 前置き（ショートカット）の状態機械（M21-04 §4.2′） ---------------------
  // ★state ではなく ref を一次にする。rAF ループ（約 238 Hz）の内側で読むため。
  const shortcutActiveRef = useRef(false);
  // 前置きボタンの直前の押下状態（立ち上がりの検出用）。
  const prefixDownRef = useRef(false);
  // 前置き中に観測した後続ボタンの押下状態（立ち上がりの検出用）。
  const followUpDownRef = useRef<Set<LogicalButton>>(new Set());
  const shortcutTimerRef = useRef<number | null>(null);
  // 最後に観測したサンプル。★前置きから抜けた「その場」で判定側の押下状態を同期するために持つ
  //   （タイムアウトで抜けるときは手元にサンプルが無いため）。
  const lastSampleRef = useRef<GamepadSample | null>(null);

  // --- コマンド技入力モードの状態機械（M21-06 §4.1） -------------------------
  // ★**タイマーを 1 つも持たない。** 前置き（`shortcutTimerRef`）と対称に見えるが、あちらは
  //   2 秒で自動解除されるのに対し、こちらは**時間で切れてはならない**（§4.1-3）。
  //   ⇒ 本ブロックへ `setTimeout` を足さないこと。足した時点で要件が壊れる。
  const [commandMode, setCommandMode] =
    useState<CommandModeState>(IDLE_COMMAND_MODE);
  // ★state ではなく ref を一次にする（前置きと同じ理由＝rAF ループの内側で読むため）。
  const commandModeActiveRef = useRef(false);
  const commandDirectionsRef = useRef<NumpadDirection[]>([]);
  // 直前に観測した方向（立ち上がりの検出用）。★ニュートラルは 5。
  const commandLastDirectionRef = useRef<NumpadDirection>(5);
  // モード中に観測した攻撃ボタンの押下状態（立ち上がりの検出用）。
  const attackDownRef = useRef<Set<LogicalButton>>(new Set());

  // --- モーダル表示中の抑止（M21-07 §4.1。`DES-005` §6.4.3 項目 4″） -----------
  //
  // ★**軸はこの 1 本だけである。** 供給元ごとの条件を作らないこと。
  // ★**判定そのものは `isAnyModalOpen()` を直接読む。** 前置き・モードのように ref へ写さない——
  //   写すと、写す効果が走るまでの間だけ古い値を読む隙ができる（モーダルが開いた直後に来た
  //   1 サンプルが裏へ抜ける形）。**ストアはモジュールレベルの計数であり、読み取りは
  //   ref と同じだけ安い。**
  // ★`useAnyModalOpen()` は**再描画の契機を得るためだけ**に購読する（下の遷移の効果が要る）。
  const modalOpen = useAnyModalOpen();

  const detection = useStepDetection();
  const {
    steps,
    pushResult: detectionPushResult,
    setProfile,
    reset,
    seedNow,
  } = detection;

  const keyboardBindings = useKeyboardBindings();
  // ★登録ダイアログを開いている間は通常のキーボード入力を止める（`capturing` の注記を参照）。
  //   ★申告は面ごとの id で行う。単一 boolean だと、後からマウントされた面が
  //     「開いていない」を書き込んで、登録中のダイアログの抑止を解いてしまう。
  const capturingIdsRef = useRef<Set<string>>(new Set());
  const [keyboardCapturing, setKeyboardCapturing] = useState(false);

  const setCapturing = useCallback((id: string, capturing: boolean) => {
    const ids = capturingIdsRef.current;
    if (capturing) ids.add(id);
    else ids.delete(id);
    // 1 つでも申告が残っていれば止める。
    setKeyboardCapturing(ids.size > 0);
  }, []);

  // ★入力面が 1 つも無い間はループを回さない（M21-01 §4.1-2）。
  const enabled = surfaceIds.length > 0;

  const clearShortcutTimer = useCallback(() => {
    if (shortcutTimerRef.current !== null) {
      window.clearTimeout(shortcutTimerRef.current);
      shortcutTimerRef.current = null;
    }
  }, []);

  /**
   * 前置き状態から抜ける（指示書 §4.2′-4）。抜ける契機は 操作の実行 ／ 前置きの再押下 ／ タイムアウト。
   *
   * ★抜けた直後に「押されたままの後続ボタン」が立ち上がりとして観測されないよう、判定側の押下状態を
   *   同期する。これをしないと、前置き ＋ 強P のあと指を離すだけで強P のステップが入る。
   *
   * ★**同期は「抜けたその場」で行う**（`seedNow`）。**「次の 1 サンプルを種付け扱いにする」形は
   *   採らない**——それだと、抜けた直後に利用者が押した最初のボタンが種として食われて入力が
   *   1 つ落ちる（タイムアウトで抜けた直後に顕著。2026-08-14 にテストで検出して是正した）。
   */
  const leaveShortcut = useCallback(() => {
    if (!shortcutActiveRef.current) return;
    shortcutActiveRef.current = false;
    followUpDownRef.current.clear();
    clearShortcutTimer();
    // ★抜けた「その場」で判定側の押下状態を同期する。次のサンプルを種にすると、抜けた直後に
    //   利用者が押した最初のボタンが食われて入力が 1 つ落ちる（タイムアウトで抜けた直後に顕著）。
    const last = lastSampleRef.current;
    if (last !== null) seedNow(last);
    setShortcutActive(false);
  }, [clearShortcutTimer, seedNow]);

  /**
   * 操作を受け手の 1 面へ配送する（指示書 §4.1）。
   *
   * ★受け手が居なければ**何も起こさない**（§4.1-3）。どこかの面へ勝手に配送しない。
   * ★**provider は判定層へ一切効かせない。** 操作の中身は受け手の面が持つ既存の導線が実行する。
   *
   * ★**モーダルが開いている間は 1 つも起こさない**（M21-07 §4.4-4。`DES-005` §6.4.3 項目 4″）。
   *   **操作 4 種（削除・保存・修飾トグル・モードの出入り）はすべて本関数を通る**ため、
   *   ここ 1 か所で 4 種すべてが止まる。**「モードの出入り」も操作の 1 つである**——
   *   モーダルが開いている間にモードへ入る／出ることも起きない。
   * ★**本関数は合流層のもう 1 つの入口である**（もう一方は `handleSources`）。キーボードの
   *   操作キーは押下集合へ混ざらないため `handleSources` を通らず、ここへ直接来る。
   */
  const dispatchAction = useCallback((action: PhysicalInputActionKind) => {
    if (isAnyModalOpen()) return;
    // ★`owner` と名付ける（同名の state `ownerId` をシャドーイングしないため）。
    //   ref を読むのは rAF ループの内側から呼ばれ、1 レンダリング古い state を見ては困るから。
    const owner = ownerIdRef.current;
    if (owner === null) return;
    const handler = actionHandlersRef.current.get(owner);
    if (handler === undefined) return;
    handler({ action });
  }, []);

  /**
   * コマンド技入力モードで確定した 1 件を、受け手の 1 面へ配送する（M21-06 §4.1-5）。
   *
   * ★**既存のステップ候補と同じ `handlersRef` を使う。** 新しい配送チャネルも新しい調停も
   *   作らない（§4.4-2／チェックリスト重大 3）。運ぶものが 2 形あるだけで、
   *   「登録・解除・owner 1 面への配送」という仕組みは 1 つのままである。
   */
  const deliverMotion = useCallback(
    (
      directions: readonly NumpadDirection[],
      button: LogicalButton | null,
      at: number,
    ) => {
      const owner = ownerIdRef.current;
      if (owner === null) return;
      const handler = handlersRef.current.get(owner);
      if (handler === undefined) return;
      handler({ kind: "motion", directions, button, at });
    },
    [],
  );

  /**
   * コマンド技入力モードの入切（M21-06 §4.1-1・§4.1-7）。
   *
   * ★**抜けるときに溜めた列を黙って消さない**（`E-84`）。受け手へ `button: null` で渡し、
   *   読取表示に「解決されなかった入力」として出してから捨てる。
   *
   * ★**抜けた「その場」で判定側の押下状態を同期する**（`seedNow`）。前置きから抜けるときと
   *   まったく同じ理由である——同期しないと、モード中に押していたボタンを離すだけで
   *   ステップが 1 つ入る。
   *
   * ★**タイマーを張らない。** モードは時間で切れない（§4.1-3）。
   */
  const setCommandModeActive = useCallback(
    (active: boolean) => {
      if (commandModeActiveRef.current === active) return;
      commandModeActiveRef.current = active;
      attackDownRef.current.clear();

      if (active) {
        // ★**入るときに「すでに押されている攻撃ボタン」を先に取り込む**
        //   （レビュー指摘 中-2。前置き側が `prefixRose` で行っている処置と対称にする）。
        //
        //   ★これが無いと、モードへ入る後続ボタン（弱K）自身が確定の契機として
        //     誤検出される——**前置きを押したまま弱K を押し、前置きを先に離す**と、
        //     次のサンプルでモードの分岐に入った時点で弱K が「立ち上がり」に見え、
        //     方向を 1 つも入れていない確定が 1 件走る。
        //   ★方向も同様に、いま入っている方向を「直前の方向」として取り込む。
        //     取り込まないと、押しっぱなしの方向が入った瞬間に 1 つ溜まる。
        const last = lastSampleRef.current;
        if (last !== null) {
          for (const state of last.result.states) {
            if (state.pressed && ATTACK_BUTTON_SET.has(state.button)) {
              attackDownRef.current.add(state.button);
            }
          }
          commandLastDirectionRef.current = numpadFromDirection(
            resolveDirection(last.result.cardinals),
          );
        } else {
          commandLastDirectionRef.current = 5;
        }
      } else {
        commandLastDirectionRef.current = 5;
      }

      if (!active) {
        const leftover = commandDirectionsRef.current;
        if (leftover.length > 0) {
          deliverMotion(leftover, null, lastSampleRef.current?.at ?? 0);
        }
      }
      commandDirectionsRef.current = [];
      setCommandMode({ active, directions: [] });

      // ★判定側の押下状態を同期してから通常経路へ戻す（前置きと同じ）。
      const last = lastSampleRef.current;
      if (last !== null) seedNow(last);
    },
    [deliverMotion, seedNow],
  );

  /**
   * 2 つの供給元を合流させて、前置きの判定 → 判定層 → 点灯 へ流す（M21-05 §4.6-3）。
   *
   * ★**どちらの供給元から呼ばれても同じ経路を通る。** 供給元ごとに分岐を作らないこと——
   *   分岐を作った時点で、判定・前置き・点灯がそれぞれ 2 通りになる。
   * ★重い処理を書かない（約 238 Hz で呼ばれる環境がある）。集合が変わったときだけ setState する。
   */
  const handleSources = useCallback(
    (at: number) => {
      // ★合流後の押下集合が「いまの入力」の唯一の表現である。
      const result = mergeNormalized(
        padResultRef.current,
        keyboardResultRef.current,
      );
      lastSampleRef.current = { result, at };

      // --- 点灯（★観測であり、抑止中も更新する＝M21-07 §4.2） --------------------
      // ★**作用の分岐より前に置いてある**（M21-07 で末尾から移した）。位置を変えたのは
      //   「抑止中に早期 return しても点灯だけは動く」ことをコードの形で示すためであり、
      //   計算内容は 1 行も変えていない（`result` しか読まない純粋な写しである）。
      const buttons: LogicalButton[] = [];
      for (const state of result.states) {
        if (isDirectionButton(state.button)) continue;
        if (state.pressed) buttons.push(state.button);
      }
      const next: HeldInput = {
        buttons,
        direction: resolveDirection(result.cardinals),
      };
      if (heldChanged(heldRef.current, next)) {
        heldRef.current = next;
        setHeld(next);
      }

      // --- モーダル表示中の抑止（M21-07 §4.1・§4.2。`DES-005` §6.4.3 項目 4″） ----
      //
      // ★**観測は上で済ませた。ここから下の「作用」だけを止める。**
      // ★止めるのは——前置きの成立 ／ モードの方向蓄積と確定 ／ 判定層への投入。
      //   **操作の配送は `dispatchAction` の同じ軸が止める**（本関数を通らないため）。
      // ★**立ち上がり検出用の直前状態は同期し続ける。** しないと、モーダルを閉じた瞬間に
      //   「押されたままのボタン」が立ち上がりとして観測され、押していない技が入る。
      // ★`seedNow` は判定層の押下状態を取り込み直し、**張ってある窓のタイマーも落とす**。
      //   ⇒ 開く前から進行中だった判定窓の保留ステップはここで破棄される。
      //   **溜めて閉じた瞬間に流す形は採らない**（§4.3）。
      if (isAnyModalOpen()) {
        prefixDownRef.current = (result.actions ?? []).some(
          (state) => state.button === SHORTCUT_PREFIX_BUTTON && state.pressed,
        );
        commandLastDirectionRef.current = numpadFromDirection(
          resolveDirection(result.cardinals),
        );
        attackDownRef.current.clear();
        for (const state of result.states) {
          if (state.pressed && ATTACK_BUTTON_SET.has(state.button)) {
            attackDownRef.current.add(state.button);
          }
        }
        seedNow({ result, at });
        return;
      }

      // --- 前置きの判定（★判定窓を通さない。M21-02 の同時押し判定に乗せない） ------
      // ★前置きそのものは Gamepad にしか無い（キーボードは操作キーを直接割り当てる）。
      //   ただし後続ボタンは合流後の押下集合から採る——論理ボタン層は 1 つであり、
      //   「どちらのデバイスが押したか」で操作の成否を変える理由が無いため。
      const prefixDown = (result.actions ?? []).some(
        (state) => state.button === SHORTCUT_PREFIX_BUTTON && state.pressed,
      );
      const prefixRose = prefixDown && !prefixDownRef.current;
      prefixDownRef.current = prefixDown;

      if (prefixRose) {
        if (shortcutActiveRef.current) {
          // 前置き中にもう一度押したら取消（§4.2′-4 の抜け道その 2）。
          leaveShortcut();
        } else {
          shortcutActiveRef.current = true;
          followUpDownRef.current.clear();
          // 押されたままの後続ボタンを「立ち上がり」と誤認しないよう、現在の押下を先に取り込む。
          for (const state of result.states) {
            if (state.pressed && actionForFollowUp(state.button) !== null) {
              followUpDownRef.current.add(state.button);
            }
          }
          clearShortcutTimer();
          shortcutTimerRef.current = window.setTimeout(
            () => leaveShortcut(),
            SHORTCUT_PREFIX_TIMEOUT_MS,
          );
          setShortcutActive(true);
        }
      }

      if (shortcutActiveRef.current) {
        // ★前置き中はサンプルを判定へ渡さない。これが「前置き中に押した後続ボタンを
        //   ステップとして確定させない」（§4.2′-3）の実体である。
        let fired: PhysicalInputActionKind | null = null;
        for (const state of result.states) {
          const action = actionForFollowUp(state.button);
          if (action === null) continue;
          if (state.pressed) {
            if (!followUpDownRef.current.has(state.button)) {
              followUpDownRef.current.add(state.button);
              fired ??= action;
            }
          } else {
            followUpDownRef.current.delete(state.button);
          }
        }
        // ★`states` に現れないボタン（＝離された）も押下記録から落とす。
        const stillPressed = new Set(
          result.states.filter((s) => s.pressed).map((s) => s.button),
        );
        for (const button of [...followUpDownRef.current]) {
          if (!stillPressed.has(button)) followUpDownRef.current.delete(button);
        }
        if (fired !== null) {
          dispatchAction(fired);
          leaveShortcut();
        }
      } else if (commandModeActiveRef.current) {
        // ★コマンド技入力モード（M21-06 §4.1-4）。
        //
        // ★**前置きと同じ seam で、サンプルを判定へ渡さない。** これが「モード中に方向を
        //   ステップにしない」の実体である。**判定層に「モードのときは」という分岐を
        //   入れていない**（§4.4-1／チェックリスト重大 1）——分岐を入れても動いてしまい、
        //   露見するのは次に判定を直す担当が片方だけ直したときである。
        //
        // ★**判定窓を通さない。** 方向もボタンも立ち上がりだけを見る。時間は一切見ない
        //   （§4.1-3。ここに経過時間の比較を書かないこと）。

        // 方向の立ち上がりを列へ溜める。★ニュートラルは溜めない（方向は「状態」であり、
        //   未入力でも値が入っているため。`DES-005` §6.4.2 の項目 8 と同じ理由）。
        const numpad = numpadFromDirection(resolveDirection(result.cardinals));
        if (numpad !== commandLastDirectionRef.current) {
          commandLastDirectionRef.current = numpad;
          if (numpad !== 5) {
            commandDirectionsRef.current = [
              ...commandDirectionsRef.current,
              numpad,
            ];
            setCommandMode({
              active: true,
              directions: commandDirectionsRef.current,
            });
          }
        }

        // 確定の契機は攻撃ボタンである（§4.1-5）。★立ち上がりを 1 つだけ採る。
        let confirmed: LogicalButton | null = null;
        for (const state of result.states) {
          if (!ATTACK_BUTTON_SET.has(state.button)) continue;
          if (state.pressed) {
            if (!attackDownRef.current.has(state.button)) {
              attackDownRef.current.add(state.button);
              confirmed ??= state.button;
            }
          } else {
            attackDownRef.current.delete(state.button);
          }
        }
        // ★`states` に現れないボタン（＝離された）も押下記録から落とす（前置きと同じ）。
        const stillPressed = new Set(
          result.states.filter((s) => s.pressed).map((s) => s.button),
        );
        for (const button of [...attackDownRef.current]) {
          if (!stillPressed.has(button)) attackDownRef.current.delete(button);
        }

        if (confirmed !== null) {
          deliverMotion(commandDirectionsRef.current, confirmed, at);
          // ★1 技ごとに列を空にする。モードからは抜けない（続けて入力できる）。
          commandDirectionsRef.current = [];
          commandLastDirectionRef.current = numpad;
          setCommandMode({ active: true, directions: [] });
        }
      } else {
        // ★正規化済みの結果をそのまま渡す。判定層は供給元を知らない（§4.5-4）。
        detectionPushResult(result, at);
      }
    },
    // ★`deliverMotion` を落とさないこと（レビュー指摘 低-1）。いまは `[]` 依存で安定して
    //   いるため無害だが、`pnpm lint` の実体は `tsc --noEmit` であり
    //   `react-hooks/exhaustive-deps` は動いていない。⇒ 依存が付いた時点で、
    //   モードの配送だけが古いクロージャを掴む形で静かに壊れる。
    [
      clearShortcutTimer,
      deliverMotion,
      detectionPushResult,
      dispatchAction,
      leaveShortcut,
      seedNow,
    ],
  );

  /**
   * モーダルが開いた／閉じた瞬間の処置（M21-07 §4.3-3）。
   *
   * ★**開いた瞬間にだけ手当てが要る。閉じた瞬間には何もしない**——溜めていないため、
   *   流すものが無い（§4.3-1）。
   *
   * ★開いた瞬間にやること——
   *   1. **前置き状態から抜ける。** 前置きは「次に押すボタンが操作になる」保留状態であり、
   *      モーダルが開いている間に成立させるわけにはいかない。**放置すると `followUpDownRef` が
   *      古いまま残り、閉じた直後の後続ボタンが誤って操作として成立しうる。**
   *      ★これは §4.4-2 が言う「モードを意図せず失う」には当たらない——**前置きはもともと
   *        2 秒で自動解除される状態である**（`DES-005` §6.5 項目 7 の「時間経過」）。
   *   2. **判定層の押下状態を同期し、張ってある窓を閉じる**（`seedNow`）。
   *      ⇒ 開く前から進行中だった判定窓の保留ステップは破棄され、モーダルの裏で確定しない。
   *
   * ★**コマンド技入力モードからは強制的に出さない**（§4.4-2 の as-built）。
   *   「入る条件」と「出る条件」は別物であり、可用性の条件を出口へ掛けると利用者が意図せず
   *   モードを失う（playbook §4.4.1）。モーダルは一時的な状態であり、閉じれば元の作業に戻る。
   *   **モーダルの裏で方向列が溜まらないこと**は `handleSources` の抑止分岐が担う（§4.4-1）。
   */
  useEffect(() => {
    if (!modalOpen) return;
    leaveShortcut();
    const last = lastSampleRef.current;
    if (last !== null) seedNow(last);
  }, [modalOpen, leaveShortcut, seedNow]);

  // --- 供給元 1: Gamepad（rAF ポーリング） ------------------------------------
  const handleSample = useCallback<GamepadSampleListener>(
    (snapshot, at) => {
      padResultRef.current = normalizeSnapshot(snapshot, profileRef.current);
      handleSources(at);
    },
    [handleSources],
  );

  // --- 供給元 2: キーボード（KeyboardEvent） ----------------------------------
  // ★ポーリングではなくイベント駆動だが、**判定層はその差を知らない**。押下集合の形を
  //   供給側で合わせているためである（§4.5-4）。窓を閉じるのは既存のタイマーであり、
  //   「押しっぱなしでサンプルが来ない」性質は Gamepad 側で既に吸収済みである。
  const handleKeyboardHeld = useCallback(
    (heldCodes: ReadonlySet<string>, at: number) => {
      keyboardResultRef.current = normalizeKeyboard(
        keyboardBindings.bindings,
        heldCodes,
      );
      handleSources(at);
    },
    [handleSources, keyboardBindings.bindings],
  );

  useKeyboardInput({
    // ★登録中は購読しない。登録は「キーを技へ写す」作業そのものであり、その最中に写しが
    //   動いていると、キーを押すたびに登録と入力が同時に起きる。
    enabled: enabled && !keyboardCapturing,
    bindings: keyboardBindings.bindings,
    onHeldChange: handleKeyboardHeld,
    // ★操作は `M21-04` の配送チャネルへそのまま乗る。新しい調停も新しいチャネルも作らない
    //   （§4.6-1・§4.6-2）。前置きを挟まない点だけが Gamepad と違う。
    onAction: dispatchAction,
  });

  const { status, snapshot, axesBaseline } = useGamepadPolling(
    enabled,
    handleSample,
  );

  const padId = snapshot?.id ?? null;
  const { browserKey, profile, source, saveProfile, removeProfile } =
    useGamepadProfiles(padId, snapshot?.mapping ?? null);

  useEffect(() => {
    profileRef.current = profile;
    setProfile(profile);
  }, [profile, setProfile]);

  // 切断・入力面の消滅で判定の途中状態と点灯を捨てる。
  useEffect(() => {
    if (status === "connected" && enabled) return;
    // ★Gamepad の最新の正規化結果を捨てる（M21-05）。捨てないと、切断した時点で押されていた
    //   ボタンが合流に残り続け、**以後キーボードで入力するたびに幽霊の同時押しが混ざる**。
    padResultRef.current = null;
    // ★入力面が消えたときはキーボード側も捨てる。押されたままのキーが次のマウントへ持ち越されない。
    if (!enabled) keyboardResultRef.current = null;
    // ★以下は `padResultRef` と対称にするための破棄である（レビュー指摘 低-3）。
    //   割当を全消去すると以後キーイベントが来ないため、最後の解決済み結果が ref に残り続ける。
    reset();
    heldRef.current = EMPTY_HELD;
    setHeld(EMPTY_HELD);
    lastDeliveredRef.current = null;
    // ★前置きの途中状態も捨てる。切断したまま前置き中が残ると、再接続後の最初の入力が
    //   操作として吸われる。
    prefixDownRef.current = false;
    // ★観測済みサンプルも捨ててから抜ける。捨てないと `leaveShortcut` の同期が、
    //   直前に `reset()` で作り直した空の判定状態へ**切断前の古い押下状態**を種付けする。
    lastSampleRef.current = null;
    leaveShortcut();
    // ★コマンド技入力モードも捨てる（M21-06）。切断・入力面の消滅をまたいでモードが
    //   残ると、再接続後の最初の方向入力がステップにならず「入力が効かない」ように見える。
    //   ★`lastSampleRef` を捨てたあとに呼ぶ——`setCommandModeActive` は抜けるときに
    //     `seedNow` を撃つため、古い押下状態を種付けさせない（前置きと同じ順序）。
    setCommandModeActive(false);
  }, [status, enabled, reset, leaveShortcut, setCommandModeActive]);

  // ★キーボードの割当が無くなったら、最後の正規化結果も捨てる（`padResultRef` と対称にする）。
  //   捨てないと、「すべて消す」で全消去したあとも解決済みの結果が合流に残り続ける
  //   （以後キーイベントが来ないため更新されない）。残るのは中立方向だけで実害は観測できないが、
  //   片側だけ破棄する非対称を残さない（レビュー指摘 低-3）。
  useEffect(() => {
    if (keyboardBindings.registered) return;
    keyboardResultRef.current = null;
  }, [keyboardBindings.registered]);

  // アンマウント時にタイマーを落とす。
  useEffect(() => clearShortcutTimer, [clearShortcutTimer]);

  useEffect(() => {
    ownerIdRef.current = ownerId;
  }, [ownerId]);

  // ★確定したステップ候補を受け手の 1 面へ配送する。
  //   steps は新しいものが先頭・最大 5 件で、前回配送したものより手前が新着である。
  useEffect(() => {
    if (steps.length === 0) {
      lastDeliveredRef.current = null;
      return;
    }
    const previous = lastDeliveredRef.current;
    const seenIndex =
      previous === null ? -1 : steps.findIndex((s) => s === previous);
    const fresh = seenIndex === -1 ? steps : steps.slice(0, seenIndex);
    lastDeliveredRef.current = steps[0];
    if (fresh.length === 0) return;

    const handler =
      ownerIdRef.current === null
        ? undefined
        : handlersRef.current.get(ownerIdRef.current);
    if (handler === undefined) return;
    // 古い順に渡す（入力順どおりにレシピへ入る＝§5 (c)）。
    for (let i = fresh.length - 1; i >= 0; i -= 1) handler(fresh[i]);
  }, [steps]);

  // ★登録中の面を ref にも持つ。setState の updater は純粋でなければならず
  //   （StrictMode では二重に呼ばれる）、updater の内側から別の setState を呼べないため。
  const surfaceIdsRef = useRef<string[]>([]);

  const registerSurface = useCallback((id: string) => {
    if (!surfaceIdsRef.current.includes(id)) {
      surfaceIdsRef.current = [...surfaceIdsRef.current, id];
      setSurfaceIds(surfaceIdsRef.current);
    }
    // ★最初に現れた面を既定の受け手にする。以後は「最後に触った面」で移る。
    setOwnerId((prev) => prev ?? id);
  }, []);

  const unregisterSurface = useCallback((id: string) => {
    handlersRef.current.delete(id);
    actionHandlersRef.current.delete(id);
    const next = surfaceIdsRef.current.filter((s) => s !== id);
    surfaceIdsRef.current = next;
    setSurfaceIds(next);
    // ★受け手が消えたら残っている面の先頭へ移す。updater の外で決める。
    setOwnerId((owner) => (owner === id ? (next[0] ?? null) : owner));
  }, []);

  const claimSurface = useCallback((id: string) => {
    setOwnerId((prev) => (prev === id ? prev : id));
  }, []);

  const setStepHandler = useCallback(
    (id: string, handler: StepCandidateHandler | null) => {
      if (handler === null) handlersRef.current.delete(id);
      else handlersRef.current.set(id, handler);
    },
    [],
  );

  const setActionHandler = useCallback(
    (id: string, handler: PhysicalInputActionHandler | null) => {
      if (handler === null) actionHandlersRef.current.delete(id);
      else actionHandlersRef.current.set(id, handler);
    },
    [],
  );

  // ★前置きボタンが登録されているか。未登録なら「割り当てられるボタンが無い」状態として
  //   利用者へ伝える（§4.4-3）。失敗ではなく状態である。
  const shortcut = useMemo<ShortcutState>(
    () => ({
      active: shortcutActive,
      available: profile?.buttons?.[SHORTCUT_PREFIX_BUTTON] !== undefined,
    }),
    [shortcutActive, profile],
  );

  const keyboard = useMemo<KeyboardInputState>(
    () => ({
      bindings: keyboardBindings.bindings,
      registered: keyboardBindings.registered,
      saveBindings: keyboardBindings.save,
      clearBindings: keyboardBindings.clear,
      capturing: keyboardCapturing,
      setCapturing,
    }),
    [keyboardBindings, keyboardCapturing, setCapturing],
  );

  const value = useMemo<PhysicalInputContextValue>(
    () => ({
      status,
      snapshot,
      axesBaseline,
      padId,
      browserKey,
      profile,
      source,
      saveProfile,
      removeProfile,
      // ★モーダルが開いている間は点灯も出さない（M21-07。**開発者の実機確認で判明**＝2026-08-15）。
      //
      // ★**観測は止めていない。** `heldRef` / `setHeld` / `seedNow` は抑止中も動き続けており、
      //   ここで伏せているのは**出口の見せ方だけ**である。⇒ 閉じた瞬間に、そのとき押されている
      //   ものが正しく点灯する（`held` は最新のまま保たれているため）。
      // ★**なぜ要るか**——点灯は「受け手の面の状態」である。抑止していても裏の仮想コントローラが
      //   入力に連動して光ると、利用者からは「モーダルの裏で入力が通っている」ように見える。
      //   **実機では実際にそう見えた**（`D-383` の非対称が点灯にだけ残っていた形——キーボードは
      //   メモ欄にフォーカスがあると光らないが、Gamepad は DOM のフォーカスを経由しないため光る）。
      // ★**ここで伏せる**（受け手側ではなく合流層の出口）。軸は 1 本のままである。
      held: modalOpen ? EMPTY_HELD : held,
      ownerId,
      registerSurface,
      unregisterSurface,
      claimSurface,
      setStepHandler,
      setActionHandler,
      shortcut,
      commandMode,
      setCommandModeActive,
      keyboard,
      available: true,
    }),
    [
      status,
      snapshot,
      axesBaseline,
      padId,
      browserKey,
      profile,
      source,
      saveProfile,
      removeProfile,
      held,
      modalOpen,
      ownerId,
      registerSurface,
      unregisterSurface,
      claimSurface,
      setStepHandler,
      setActionHandler,
      shortcut,
      commandMode,
      setCommandModeActive,
      keyboard,
    ],
  );

  return (
    <PhysicalInputContext.Provider value={value}>
      {children}
    </PhysicalInputContext.Provider>
  );
}
