// キャリブレーション／リマップの状態機械（M21-01 §4.3。★本サブの load-bearing な部分）。
//
// 開発者はアケコンを所有せず Firefox も未計測である。⇒ 我々が持っていない機体で動くための
// 唯一の手段がこれである（D-328）。すべて純粋関数で、副作用層から状態を差し替えて使う。

import { isSameBinding } from "./normalize";
import {
  CALIBRATION_ORDER,
  isDirectionCardinal,
  isRequiredTarget,
} from "./logicalButtons";
import {
  bindingOf,
  isProfileComplete,
  withBinding,
  withoutBinding,
} from "./profile";
import type {
  CalibrationButton,
  CalibrationTarget,
  DirectionCardinal,
  GamepadProfile,
  PhysicalBinding,
} from "./types";

/**
 * 同じ物理ボタンを 2 つの論理ボタンへ割り当てようとした状態（指示書 §4.3-7）。
 * 設計卓の見込み「警告して上書きを確認させる」を採用している——レバーレスでは同一物理ボタンを
 * 別用途へ充てる運用が現実にあるため、黙って弾かない。
 */
export interface CalibrationConflict {
  /** いま割り当てようとしている対象。 */
  target: CalibrationTarget;
  /** 既に同じ物理入力を使っている対象。 */
  existing: CalibrationTarget;
  binding: PhysicalBinding;
}

export interface CalibrationState {
  profile: GamepadProfile;
  order: readonly CalibrationTarget[];
  /** order 内の現在位置。order.length 以上なら終了。 */
  cursor: number;
  /** 未解決の二重割当。null 以外の間は次へ進まない。 */
  conflict: CalibrationConflict | null;
  /**
   * sequential = 順に案内する通常のキャリブレーション（全件）。
   * single     = 1 つだけ取り直す（指示書 §4.3-3）。
   * partial    = 一部だけを順に登録する（標準配置の既定にマクロだけを足す用途）。
   *
   * ★完了時の文言を出し分けるために保持する。1 件取り直しただけで
   *   「すべての案内が終わりました」と出るのは実機確認で不自然と指摘された（2026-08-13）。
   */
  mode: "sequential" | "single" | "partial";
  /**
   * 直前に取り直した対象。案内へ戻ったときに「何を取り直したか」を出すために持つ。
   * 次の記録で消える。
   */
  lastRetaken?: CalibrationTarget;
}

/** 既存プロファイル中で、当該バインディングを既に使っている対象を探す。 */
function findExistingUser(
  profile: GamepadProfile,
  binding: PhysicalBinding,
  exclude: CalibrationTarget,
): CalibrationTarget | null {
  const directions = profile.directions ?? {};
  for (const key of Object.keys(directions)) {
    const target = key as DirectionCardinal;
    if (target === exclude) continue;
    const existing = directions[target];
    if (existing && isSameBinding(existing, binding)) return target;
  }

  const buttons = profile.buttons ?? {};
  for (const key of Object.keys(buttons)) {
    const target = key as CalibrationButton;
    if (target === exclude) continue;
    const existing = buttons[target];
    if (existing && isSameBinding(existing, binding)) return target;
  }

  return null;
}

/** 未割当の最初の位置を返す（中断からの再開用。指示書 §4.3-2）。 */
function firstUnassignedIndex(
  profile: GamepadProfile,
  order: readonly CalibrationTarget[],
): number {
  const index = order.findIndex(
    (target) => bindingOf(profile, target) === undefined,
  );
  return index === -1 ? order.length : index;
}

/**
 * キャリブレーションを開始する。
 *
 * @param resume true なら未割当の最初の対象から再開する（中断した状態から続けられる）。
 *               false なら先頭から。既存の割当は保持したまま上書きしていく。
 */
export function startCalibration(
  profile: GamepadProfile,
  resume = true,
): CalibrationState {
  const order = CALIBRATION_ORDER;
  return {
    profile,
    order,
    cursor: resume ? firstUnassignedIndex(profile, order) : 0,
    conflict: null,
    mode: "sequential",
  };
}

/**
 * 1 つだけ取り直す（指示書 §4.3-3）。
 * 当該対象だけを対象にした 1 件の order を持つ状態を返す。
 */
export function startRetake(
  profile: GamepadProfile,
  target: CalibrationTarget,
): CalibrationState {
  return {
    profile,
    order: [target],
    cursor: 0,
    conflict: null,
    mode: "single",
  };
}

/**
 * 指定した対象だけを順に登録する（部分キャリブレーション）。
 *
 * 標準配置の既定が当たっている機体へ、マクロ（DI / DP / 投げ）だけを足す用途。
 * 既存の割当は保持したまま、渡した対象のみを案内する。
 */
export function startPartialCalibration(
  profile: GamepadProfile,
  targets: readonly CalibrationTarget[],
): CalibrationState {
  return {
    profile,
    order: targets,
    cursor: 0,
    conflict: null,
    mode: "partial",
  };
}

/**
 * 1 件の割当が済んだ直後に呼ぶ。
 *
 * ★取り直し（single）で 1 件を入れ終えたとき、**未割当の対象が他に残っていれば通常の案内へ戻す**。
 *   利用者の自然な操作は「設定を間違えた → 1 つ戻して入れ直す → 次の技から続ける」であり、
 *   初回設定の途中で手が止まるのは不自然であるため（2026-08-13 実機確認の指摘）。
 * ★全部埋まっていれば従来どおり停止する——後日の単発編集はこれで正しい。
 */
function resumeAfterRetake(
  state: CalibrationState,
  justAssigned: CalibrationTarget | undefined,
): CalibrationState {
  if (state.mode !== "single") return state;
  if (!isFinished(state)) return state;

  const resumed = startCalibration(state.profile, true);
  // 未割当が残っていなければ、取り直しだけで完了（従来どおり）。
  if (isFinished(resumed)) {
    return justAssigned === undefined
      ? state
      : { ...state, lastRetaken: justAssigned };
  }
  return { ...resumed, lastRetaken: justAssigned };
}

/** いま案内中の対象。終了していれば null。 */
export function currentTarget(state: CalibrationState): CalibrationTarget | null {
  if (state.cursor < 0 || state.cursor >= state.order.length) return null;
  return state.order[state.cursor];
}

export function isFinished(state: CalibrationState): boolean {
  return currentTarget(state) === null;
}

/**
 * 押された物理入力を現在の対象へ記録する。
 *
 * ★同じ物理入力が既に別の対象へ割り当てられていれば、書き込まずに conflict を立てる。
 *   利用者が confirmOverwrite() で確定するか、cancelConflict() で取り消す（指示書 §4.3-7）。
 * ★方向も同じ経路を通るため、buttons と axes のどちらで来ても記録できる（§4.3-5）。
 */
export function recordBinding(
  state: CalibrationState,
  binding: PhysicalBinding,
): CalibrationState {
  const target = currentTarget(state);
  if (target === null) return state;
  // 未解決の衝突がある間は新しい入力を受け付けない。
  if (state.conflict !== null) return state;

  const existing = findExistingUser(state.profile, binding, target);
  if (existing !== null) {
    return { ...state, conflict: { target, existing, binding } };
  }

  const assigned: CalibrationState = {
    ...state,
    profile: withBinding(state.profile, target, binding),
    cursor: state.cursor + 1,
    lastRetaken: undefined,
  };
  return resumeAfterRetake(assigned, target);
}

/**
 * 二重割当を承認して上書きする。
 * 既存側の割当は外す（同じ物理ボタンが 2 つの論理ボタンを同時に押す状態を作らないため）。
 */
export function confirmOverwrite(state: CalibrationState): CalibrationState {
  const { conflict } = state;
  if (conflict === null) return state;

  const cleared = withoutBinding(state.profile, conflict.existing);
  const assigned: CalibrationState = {
    ...state,
    profile: withBinding(cleared, conflict.target, conflict.binding),
    cursor: state.cursor + 1,
    conflict: null,
    lastRetaken: undefined,
  };
  // 上書きの承認も「1 件の割当が済んだ」形であるため、取り直しなら案内へ戻す。
  return resumeAfterRetake(assigned, conflict.target);
}

/** 二重割当を取り消す。対象は進めず、同じ対象の入力待ちに戻る。 */
export function cancelConflict(state: CalibrationState): CalibrationState {
  if (state.conflict === null) return state;
  return { ...state, conflict: null };
}

/** 現在の対象を飛ばして次へ進む（任意区間や、その機体に無いボタン用）。 */
export function skipCurrent(state: CalibrationState): CalibrationState {
  if (isFinished(state)) return state;
  const skipped: CalibrationState = {
    ...state,
    cursor: state.cursor + 1,
    conflict: null,
    lastRetaken: undefined,
  };
  // 取り直しを飛ばした場合も、未割当が残っていれば案内へ戻す（手を止めない）。
  return resumeAfterRetake(skipped, undefined);
}

/**
 * 中断する（指示書 §4.3-2）。
 * ★ここまでに登録した内容を持つプロファイルを返す。全部を埋めないと使えない形にしない。
 */
export function abortCalibration(state: CalibrationState): GamepadProfile {
  return state.profile;
}

/** 進捗（UI 表示用）。任意区間を含む全体に対する位置。 */
export function calibrationProgress(state: CalibrationState): {
  current: number;
  total: number;
  requiredRemaining: number;
  complete: boolean;
} {
  const requiredRemaining = state.order.filter(
    (target) =>
      isRequiredTarget(target) &&
      bindingOf(state.profile, target) === undefined,
  ).length;

  return {
    current: Math.min(state.cursor + 1, state.order.length),
    total: state.order.length,
    requiredRemaining,
    complete: isProfileComplete(state.profile),
  };
}

/** 登録済みの対象を列挙する（やり直し導線の一覧用）。 */
export function assignedTargets(
  profile: GamepadProfile,
): CalibrationTarget[] {
  return CALIBRATION_ORDER.filter(
    (target) => bindingOf(profile, target) !== undefined,
  );
}

/** バインディングの人間可読表現（UI の確認表示用）。 */
export function describeBinding(binding: PhysicalBinding): string {
  return binding.kind === "button"
    ? `ボタン ${binding.index}`
    : `軸 ${binding.index} ${binding.sign > 0 ? "+" : "-"}`;
}

export { isDirectionCardinal };
