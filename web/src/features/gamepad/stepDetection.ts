// 同時押しの集約と SOCD の解決（M21-02 §4.1・§4.2・§4.5。★本サブの中核）。
//
// ★本ファイルは純粋関数だけで構成する。navigator・window・Date・performance のいずれにも触らない
//   （指示書 §5.1「判定の純粋関数」／ チェックリスト §9-6）。時刻は呼び出し側が引数で渡す。
//   ⇒ テストから「時刻つき状態列」を直接食わせられる。
//
// ★入力は M21-01 の正規化結果（NormalizeResult）の列、出力はステップ候補の列である。
//
// ★方向は「まとめる対象」ではない（指示書 §4.1-2）。方向は状態であってイベントであり、
//   ステップは「その時点の方向 ＋ 窓の内側でまとまったボタン集合」で構成する。
//   方向の変化だけではステップは生まれない。
//
// ★SOCD は判定窓を通さない（指示書 §4.5-4）。1 スナップショット内の状態合成であって時間の話ではない。

import { cardinalsToNumpad, numpadToLogicalButton } from "./logicalButtons";
import type {
  CardinalState,
  DirectionCardinal,
  LogicalButton,
  NormalizeResult,
} from "./types";
import { ATTACK_BUTTONS, OPTIONAL_BUTTONS } from "./types";

// ---------------------------------------------------------------------------
// 判定窓（★唯一の定義。指示書 §4.2 の条件 3「1 か所から差し替えられる形にする」）
// ---------------------------------------------------------------------------

/**
 * 同時押しとみなす時間窓（**ミリ秒**）。
 *
 * ★ここが判定窓の唯一の定義である。差し替えるならこの 1 行だけを書き換える
 *   （利用者からの報告で調整しうるため＝指示書 §4.2 の条件 3）。
 *   関数側は `StepDetectionOptions.windowMs` で上書きできるが、既定値の出どころはここだけ。
 *
 * ★**ミリ秒が一次であり、フレーム数では持たない**（指示書 §4.2）。
 *   PoC の計測環境は約 238 Hz（rAF 間隔 中央値 4.20 ms）であり、60 Hz 環境では
 *   同じ実時間が約 1/4 のフレーム数になる。フレーム数で持つと環境で意味が変わる。
 *
 * **導出**（指示書 §4.2 の条件 1「`D-324` の実測最大を下回らせない」）——
 * 実測最大は押し始め 45.80 ms ／ 離し始め 83.30 ms。**大きいほうの 83.30 ms を下回らせない**
 * ことを条件とし、切り上げて 90 とした（余裕 6.7 ms）。本サブが判定に使うのは押し始めであり
 * （§4.1-4）、その実測最大 45.80 ms に対しては約 2 倍にあたる。
 * 60 Hz 環境の量子化（1 フレーム ≤ 16.7 ms）を足しても 45.80 + 16.7 = 62.5 ms で収まる。
 *
 * ★**Bluetooth は未計測である**（**D-328**。開発者が BT 接続の機体を所有していない）。
 *   かつ Gamepad API に接続方式を示すフィールドが無いため、実行時に接続方式で分岐もできない。
 *   本値は **USB・Chrome 151・2 機種**の実測から導いたものであり、BT で妥当かは分かっていない。
 */
export const SIMULTANEOUS_PRESS_WINDOW_MS = 90;

/**
 * `D-324` の実測: 押し始めのズレの最大値（ms）。パッド・USB・Chrome 151・標本 90。
 * ★判定窓がこれを下回ると、利用者の同時押しが 2 ステップに割れる。
 */
export const MEASURED_MAX_PRESS_SPREAD_MS = 45.8;

/**
 * `D-324` の実測: 離し始めのズレの最大値（ms）。パッド・USB・Chrome 151・標本 90。
 * ★本サブは押し始めを判定に使うため直接は参照しないが、指示書 §4.2 の条件 1 が
 *   両方の最大値を下限として挙げているため、窓はこちらも下回らない。
 */
export const MEASURED_MAX_RELEASE_SPREAD_MS = 83.3;

// ---------------------------------------------------------------------------
// 入出力
// ---------------------------------------------------------------------------

/** 時刻つきの正規化結果。★時刻は単調増加を期待するが、そうでなくても破綻しない（§5.1(k)）。 */
export interface GamepadSample {
  /** M21-01 の `normalizeSnapshot()` の戻り値。 */
  result: NormalizeResult;
  /**
   * 観測時刻（ミリ秒）。
   * ★副作用層は `requestAnimationFrame` のコールバック引数を渡す（`performance.now()` 起点・単調増加）。
   *   `Gamepad.timestamp` は使わない——状態変化時にしか更新されず（PoC B-3。更新率 2.2% / 4.2%）、
   *   かつブラウザ間の意味づけが未検証であるため。
   */
  at: number;
}

/**
 * まとまった 1 ステップの候補。
 *
 * ★**M21-03（レシピ接続・読取表示）と M21-05（キーボード）は既に本型へ乗っている。**
 *   フィールドを消すときは 2 サブへ影響する。
 *
 * ★**旧記述「M21-06（実モーション入力）が乗る見込みである」は失効した**（M21-06・2026-08-14）。
 *   **実際には本型へ乗らなかった**——コマンド技入力モードは判定窓を通らないため、
 *   `MotionCandidate`（`physical-input/PhysicalInputProvider.tsx`）という別の形を持ち、
 *   配送チャネルだけを共有している。⇒ **本型の変更が M21-06 へ波及することは無い。**
 *
 * ★**キーボードも同じ型を通る**（M21-05）。供給元は 2 つになったが、判定の出口は 1 つのままで
 *   ある——`NormalizeResult` の列を食って本型を出す経路は 1 本しかない。
 */
export interface StepCandidate {
  /**
   * 方向（`direction_neutral` ／ `direction_1`〜`direction_9`）。
   *
   * ★**窓の内側で観測された最後の非ニュートラル方向**である。1 つも観測されなければ
   *   `direction_neutral`。窓の起点の 1 点だけを見ない理由——**押し始めのズレ**
   *   （実測 中央値 8.30 ms / 最大 45.80 ms）**は方向にも等しく効く**。レバーレスでは方向も
   *   物理ボタンであり、`6 + 強P` を同時に押したとき 6 が数 ms 遅れて立ち上がることがある。
   *   起点固定にすると、この入力が `5 強P`（ニュートラル ＋ 強P）として確定してしまう。
   *
   * ★これは「方向をまとめる対象にする」ことではない（指示書 §4.1-2）——方向は依然として
   *   **1 つの状態**であり、方向の立ち上がりがステップを作ることも、集合へ加わることも無い。
   *   窓の内側のどの時点の状態を採るかを決めているだけである。
   *
   * ★SOCD 相殺前の生の上下左右（`NormalizeResult.cardinals`）は本型に持たない。
   *   ★**M21-06（実モーション入力）は生値を要さなかった**（2026-08-14）——モードは本型を
   *   通らず、合流結果から直接テンキー方向を採る。**⇒ 配管を戻す必要は生じていない。**
   */
  direction: LogicalButton;
  /** 窓の内側でまとまったボタン。★決定的な順序（弱P→強K→マクロ）で並ぶ。空にはならない。 */
  buttons: LogicalButton[];
  /** 窓の起点（最初の立ち上がりの時刻）。 */
  startedAt: number;
  /**
   * 窓が閉じた時刻。
   *
   * ★**時間経過で閉じた場合は `startedAt + windowMs` ちょうど**になる（観測が遅れても
   *   その遅れを含めない）。{@link closePendingStep} で明示的に確定した場合のみ、その時刻が入る。
   */
  closedAt: number;
  /**
   * 窓の内側でまとまった立ち上がりの数。
   * ★**同じボタンの再立ち上がりも 1 と数える**（生の事実を潰さない）。⇒ `buttons.length` とは
   *   一致しないことがある。「2 以上＝別のボタンがまとまった」とは読めない。
   */
  mergedCount: number;
}

export interface StepDetectionOptions {
  /** 判定窓（ms）。既定は {@link SIMULTANEOUS_PRESS_WINDOW_MS}。 */
  windowMs?: number;
}

interface PendingStep {
  startedAt: number;
  direction: LogicalButton;
  buttons: readonly LogicalButton[];
  mergedCount: number;
}

/** 判定の途中状態。★不変（各関数は新しい状態を返す）。 */
export interface StepDetectionState {
  /** 直前に観測した時刻。未観測なら null。 */
  readonly lastAt: number | null;
  /** 直前サンプルで押されていたボタン（方向を除く）。 */
  readonly held: readonly LogicalButton[];
  /** 開いている窓。無ければ null。 */
  readonly pending: PendingStep | null;
}

export interface StepDetectionResult {
  state: StepDetectionState;
  /** このサンプルで確定したステップ候補（通常 0〜1 件）。 */
  emitted: StepCandidate[];
}

// ---------------------------------------------------------------------------
// ボタンの整列順
// ---------------------------------------------------------------------------

/**
 * ステップ内のボタンの並び順。
 * ★キャリブレーションの案内順（攻撃 6 → マクロ 3）と同じにする。表示のたびに順序が変わらないよう
 *   決定的に並べる（`Set` の反復順は挿入順であり、押した順に依存してしまうため）。
 */
const BUTTON_ORDER: readonly LogicalButton[] = [
  ...ATTACK_BUTTONS,
  ...OPTIONAL_BUTTONS,
];

function buttonRank(button: LogicalButton): number {
  const index = BUTTON_ORDER.indexOf(button);
  // 割当対象外の論理ボタンが来ても落とさない（未知は末尾へ）。
  return index === -1 ? BUTTON_ORDER.length : index;
}

function sortButtons(buttons: readonly LogicalButton[]): LogicalButton[] {
  return [...buttons].sort((a, b) => {
    const diff = buttonRank(a) - buttonRank(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// 方向（SOCD）
// ---------------------------------------------------------------------------

/** 方向の論理ボタンの接頭辞（`controllerTypes.ts` の `direction_*` 枝）。 */
export const DIRECTION_BUTTON_PREFIX = "direction_";

/** 方向の論理ボタンか。★`states` から方向を除くための判定。 */
export function isDirectionButton(button: LogicalButton): boolean {
  return button.startsWith(DIRECTION_BUTTON_PREFIX);
}

/**
 * SOCD（相反する方向の同時入力）を解決して、その時点の方向を 1 つ返す。
 *
 * ★**本サブの SOCD 判断点はここである**（指示書 §4.5-2）。
 *   規則は **左右は相殺してニュートラル・上下は上優先** とする。M21-01 が防御的な既定として
 *   置いていたものを、本サブの決定として採る。理由は 2 つ——
 *   (1) SOCD クリーナの慣行として広く使われており、実機の多くはハードウェア側で同じ処理を済ませている。
 *   (2) ハード側で処理済みの機体では本規則はそもそも発火せず、未知の機体でだけ効く安全弁になる。
 *
 * ★**実測は無い**。PoC（`M21-RESEARCH-01`）は SOCD を課題に含めておらず、**未計測**である。
 *   「観測されなかった」ではない——測っていない（`E-84`）。
 *
 * ★**判定窓を通さない**（指示書 §4.5-4）。1 スナップショット内の状態合成であって時間の話ではない。
 *
 * @param cardinals SOCD 相殺前の生の上下左右（M21-01 の `NormalizeResult.cardinals`）。
 *                  方向の割当が 1 つも無い機体では undefined になる。
 */
export function resolveDirection(
  cardinals: Record<DirectionCardinal, CardinalState> | undefined,
): LogicalButton {
  if (cardinals === undefined || cardinals === null) {
    // 方向の割当が無い機体。「方向はニュートラルである」という状態として扱う。
    return numpadToLogicalButton(5);
  }
  // 斜めの導出と SOCD の潰し方は M21-01 の実装を再利用する（2 実装に割らないため）。
  return numpadToLogicalButton(
    cardinalsToNumpad({
      up: cardinals.up?.pressed === true,
      down: cardinals.down?.pressed === true,
      left: cardinals.left?.pressed === true,
      right: cardinals.right?.pressed === true,
    }),
  );
}

// ---------------------------------------------------------------------------
// 判定本体
// ---------------------------------------------------------------------------

/**
 * 押されているボタン（方向を除く）を取り出す。
 *
 * ★立ち上がりの判定には `pressed`（デジタル）を使い、`value`（アナログ）は使わない。
 *   M21-01 が本サブへ送った未決事項（同完了報告 §4 の申し送り 2）に対する判断である。理由——
 *   SF6 の入力はデジタルであり、アナログ値を採ると「どこから押下とみなすか」という
 *   第 2 の閾値が要る。トリガーを浅く触っただけでステップが生まれるのも望ましくない。
 *   （アナログ量は `LogicalButtonState.value` に残っており、必要になったサブが使える。）
 */
function pressedButtons(result: NormalizeResult): LogicalButton[] {
  if (!result || result.resolved !== true) return [];
  const states = Array.isArray(result.states) ? result.states : [];
  const out: LogicalButton[] = [];
  for (const state of states) {
    if (state === undefined || state === null) continue;
    if (isDirectionButton(state.button)) continue;
    if (state.pressed !== true) continue;
    if (!out.includes(state.button)) out.push(state.button);
  }
  return out;
}

function toCandidate(pending: PendingStep, closedAt: number): StepCandidate {
  return {
    direction: pending.direction,
    buttons: sortButtons(pending.buttons),
    startedAt: pending.startedAt,
    closedAt,
    mergedCount: pending.mergedCount,
  };
}

function resolveWindowMs(options?: StepDetectionOptions): number {
  const raw = options?.windowMs;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0
    ? raw
    : SIMULTANEOUS_PRESS_WINDOW_MS;
}

/** 初期状態。 */
export function createStepDetectionState(): StepDetectionState {
  return { lastAt: null, held: [], pending: null };
}

/**
 * 開いている窓の起点。開いていなければ null。
 *
 * ★副作用層が「いつ窓が閉じるか」を知るために使う（入力が止まると新しいサンプルが来ないため、
 *   タイマーで確定させる必要がある）。`StepDetectionState` の中身へ直接触らせないための入口。
 */
export function pendingStartedAt(state: StepDetectionState): number | null {
  return state.pending === null ? null : state.pending.startedAt;
}

/**
 * 時刻を単調増加へ均す。
 *
 * ★時刻が巻き戻る／同値になる入力でも例外を投げない（指示書 §5.1(k)）。
 *   巻き戻りは直前の時刻へクランプする——窓が「閉じたことになったり戻ったり」するより、
 *   同一時刻として扱うほうが判定が安定するため。NaN・非有限値も同じ扱いにする。
 */
function monotonicAt(state: StepDetectionState, at: number): number {
  const previous = state.lastAt;
  if (typeof at !== "number" || !Number.isFinite(at)) return previous ?? 0;
  if (previous === null) return at;
  return Math.max(at, previous);
}

/**
 * 開いている窓を、時間が経っていれば閉じる。経っていなければ何もしない。
 *
 * ★**押しっぱなしのときにステップが確定する唯一の経路がこれである。** `onSample` は
 *   スナップショットが変化したフレームでしか呼ばれず、最後の立ち上がりのあと指を離すまで
 *   次のサンプルが来ないため、副作用層（`useStepDetection`）はタイマーから本関数を呼ぶ。
 *
 * ★確定した候補の `closedAt` は `startedAt + windowMs` になる（観測が遅れてもその遅れを
 *   含めない）。時間の経過を無視して確定させたい場合は {@link closePendingStep}。
 */
export function flushPendingStep(
  state: StepDetectionState,
  at: number,
  options?: StepDetectionOptions,
): StepDetectionResult {
  const now = monotonicAt(state, at);
  const pending = state.pending;
  if (pending === null) {
    return { state: { ...state, lastAt: now }, emitted: [] };
  }
  // ★半開区間 [startedAt, startedAt + windowMs)。ちょうど境界の時刻で窓は閉じる（§5.1(c)）。
  const windowMs = resolveWindowMs(options);
  if (now - pending.startedAt < windowMs) {
    return { state: { ...state, lastAt: now }, emitted: [] };
  }
  return {
    state: { lastAt: now, held: state.held, pending: null },
    emitted: [toCandidate(pending, pending.startedAt + windowMs)],
  };
}

/**
 * 開いている窓を、時間の経過にかかわらず**その場で**閉じる。
 *
 * ★呼出元は {@link detectSteps}（列の終端・一括版）とテストである。**未使用の関数ではない。**
 *
 * ★**物理コントローラからの呼出元は無い。これは配線し忘れではなく、使わないと決めた結果である**
 *   （2026-08-14・**D-364**・開発者判断）。M21-04 が一度ショートカット（前置き ＋ 弱P）から
 *   本関数を呼ぶ導線を作ったが、**撤去した。**
 *   **理由＝判定窓（{@link SIMULTANEOUS_PRESS_WINDOW_MS} = 90 ms）が閉じた時点で自動確定する形を
 *   `M21-02` / `M21-03` が既に持っており、明示的な確定は実機で 10 回とも空振りしたため**
 *   （押しっぱなしでも変わらず。開発者所見＝「何をやる機能かもわかりにくい」）。
 *   **⇒ 機能が失われたのではなく、より良い形で既に実現されている。**
 *
 * ★**「呼び忘れている」と読んで配線し直さないこと。** 物理側から明示的に確定させる必要が生じたら、
 *   まず「自動確定では足りない理由」を示すこと。
 * ★**旧記述「`M21-06`（実モーション入力）が使いうるため本関数自体は残してある」は失効した**
 *   （2026-08-14）——**M21-06 は本関数を使わなかった**（モードは判定窓を通さないため）。
 *   **⇒ 現時点で本関数の呼出元はテストだけである。** 残す／畳むの判断は次に本ファイルを
 *   整理する担当の手番であり、**「M21-06 が使うから」は根拠として使えない。**
 * ★時間経過による通常の確定は {@link flushPendingStep} 側であり、本関数ではない。
 *   確定した候補の `closedAt` には引数の時刻がそのまま入る。
 */
export function closePendingStep(
  state: StepDetectionState,
  at: number,
): StepDetectionResult {
  const now = monotonicAt(state, at);
  const pending = state.pending;
  if (pending === null) {
    return { state: { ...state, lastAt: now }, emitted: [] };
  }
  return {
    state: { lastAt: now, held: state.held, pending: null },
    emitted: [toCandidate(pending, now)],
  };
}

/**
 * サンプルを 1 つ食わせる。
 *
 * **窓の起点は「最初の立ち上がり」に固定する**（指示書 §4.1-3）。設計卓の見込みを採用した。
 * 代案の「最後の立ち上がりから窓を延長する」形は、押し続けているかぎり結合し続けるため、
 * 意図しない連結（別々に入れたつもりの入力が 1 ステップに繋がる）が起きうる。
 *
 * **判定に使うのは押し始めである**（指示書 §4.1-4）。設計卓の見込みを採用した。離し始めは
 * 分布が広く（最大 50.00 / 83.30 ms 対 20.90 / 45.80 ms）、かつ利用者の意図は押した時点で
 * 確定しているため。
 *
 * ★チャタリング対策は実装していない（指示書 §4.4）。`D-324` の実測で観測されなかったためであり、
 *   詳細は完了報告に書く。窓の内側で同じボタンが再度立ち上がった場合は集合に吸収されるが、
 *   これは集合として扱っていることの帰結であって、チャタリング対策として設計したものではない。
 */
export function pushSample(
  state: StepDetectionState,
  sample: GamepadSample,
  options?: StepDetectionOptions,
): StepDetectionResult {
  const windowMs = resolveWindowMs(options);
  const now = monotonicAt(state, sample?.at);
  const emitted: StepCandidate[] = [];

  let pending = state.pending;

  // (1) 先に、時間が経っていれば開いている窓を閉じる。
  //     ★closedAt は「窓が閉じた時刻」であって「閉じたことに気づいた時刻」ではない。
  //       次の入力が来るまで気づけないため、now をそのまま入れると押しっぱなしの分だけ伸びる。
  if (pending !== null && now - pending.startedAt >= windowMs) {
    emitted.push(toCandidate(pending, pending.startedAt + windowMs));
    pending = null;
  }

  // (2) 立ち上がり（false → true）を拾う。★方向は含めない（§4.1-2）。
  const current = pressedButtons(sample?.result);
  const rising = current.filter((button) => !state.held.includes(button));

  for (const button of rising) {
    if (pending === null) {
      pending = {
        startedAt: now,
        // 方向は直後の (3) で入れる。ここでは仮の値を置くだけ。
        direction: numpadToLogicalButton(5),
        buttons: [button],
        mergedCount: 1,
      };
      continue;
    }
    pending = {
      ...pending,
      buttons: pending.buttons.includes(button)
        ? pending.buttons
        : [...pending.buttons, button],
      mergedCount: pending.mergedCount + 1,
    };
  }

  // (3) 窓が開いている間は、方向を観測しつづける。
  //     ★方向は「まとめる対象」ではない（§4.1-2）——集合には加えず、1 つの状態として上書きする。
  //       窓の起点の 1 点だけを見ると、実測の押し始めズレ（中央値 8.30 ms / 最大 45.80 ms）が
  //       方向にも効くため、`6 + 強P` が `5 強P` として確定してしまう。
  //     ★非ニュートラルのときだけ採る。指を離す順序で方向が先に抜けても、入力した方向が残る。
  if (pending !== null) {
    const direction = resolveDirection(sample?.result?.cardinals);
    if (direction !== numpadToLogicalButton(5)) {
      pending = { ...pending, direction };
    }
  }

  return { state: { lastAt: now, held: current, pending }, emitted };
}

/**
 * 立ち上がりを出さずに、押下状態だけを取り込む。
 *
 * ★**直前の状態を観測できていなかったときに使う。** 例＝キャリブレーションのやり直しで
 *   プロファイルが差し替わった直後。それまでのサンプルは別の対応表で読まれている（あるいは
 *   `resolved: false` で読めていない）ため、いま押されているボタンが「たったいま立ち上がった」
 *   のか「前から押されていた」のかを区別できない。
 *   ⇒ 押し直していないボタンでステップが確定するのを防ぐ。
 */
export function seedSample(
  state: StepDetectionState,
  sample: GamepadSample,
): StepDetectionState {
  return {
    lastAt: monotonicAt(state, sample?.at),
    held: pressedButtons(sample?.result),
    pending: null,
  };
}

/**
 * 時刻つき状態列 → ステップ候補の列（一括版）。
 *
 * ★本サブの入出力を 1 本の純粋関数として表したもの。テストの主対象である。
 *   列の終端では、窓が閉じていなくても確定させる（列がそこで終わっている以上、
 *   これ以上まとまる余地が無いため）。
 */
export function detectSteps(
  samples: readonly GamepadSample[],
  options?: StepDetectionOptions,
): StepCandidate[] {
  let state = createStepDetectionState();
  const out: StepCandidate[] = [];

  for (const sample of samples ?? []) {
    const step = pushSample(state, sample, options);
    state = step.state;
    out.push(...step.emitted);
  }

  const tail = closePendingStep(state, state.lastAt ?? 0);
  out.push(...tail.emitted);
  return out;
}
