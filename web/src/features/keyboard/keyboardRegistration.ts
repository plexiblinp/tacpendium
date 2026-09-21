// キー登録の状態機械（M21-05 §4.1・§4.3）。純粋関数のみ。
//
// ★**Gamepad の `calibration.ts` を流用せず別に持つ。** 同ファイルの型は `GamepadProfile` /
//   `PhysicalBinding{kind:"button"|"axis"}` に固く結びついており、キーボードを通すには
//   `calibration.ts` / `profile.ts` / `types.ts` の一般化が要る。**それは「Gamepad 側の登録導線を
//   書き換えない」（指示書 §2.2-5／チェックリスト重大 16）に正面から触れる。**
//   ⇒ 導線を別に持つのは重複ではなく、凍結を守るための帰結である。
//
// ★**既定を持たない**（**D-370**）。開始時点の割当は「保存済みのもの」か「空」であり、
//   標準配置を当てる経路は存在しない。
//
// ★除外キーは**理由つきで**拒否する（§4.3-2）。無反応にしない——利用者は自分の押し方が悪いと
//   思って何度も押す。

import { keyExclusionReason, keyLabel } from "./excludedKeys";
import type { KeyExclusionReason, KeyModifierState } from "./excludedKeys";
import {
  KEYBOARD_REGISTRATION_ORDER,
  bindingOf,
  findConflict,
  withBinding,
  withoutBinding,
} from "./types";
import type { KeyBinding, KeyboardBindings, KeyboardTarget } from "./types";

/**
 * 同じキーを 2 つの対象へ割り当てようとした状態。
 *
 * ★黙って上書きしない。**確認させてから**上書きする（Gamepad 側の二重割当と同じ流儀）。
 */
export interface KeyboardConflict {
  target: KeyboardTarget;
  existing: KeyboardTarget;
  binding: KeyBinding;
}

/** 除外キーを押したことの記録。★次の記録・案内で消える一時的な状態である。 */
export interface KeyboardRejection {
  binding: KeyBinding;
  reason: KeyExclusionReason;
}

export interface KeyboardRegistrationState {
  bindings: KeyboardBindings;
  order: readonly KeyboardTarget[];
  /** order 内の現在位置。order.length 以上なら終了。 */
  cursor: number;
  /** 未解決の二重割当。null 以外の間は次へ進まない。 */
  conflict: KeyboardConflict | null;
  /** 直前に拒否された除外キー。★「未登録」とは別の状態として画面に出す（`E-84`）。 */
  rejection: KeyboardRejection | null;
  /** sequential = 全件を順に案内 ／ single = 1 件だけ取り直す。 */
  mode: "sequential" | "single";
  /** 直前に取り直した対象（案内へ戻ったときに何を取り直したか出すため）。 */
  lastRetaken?: KeyboardTarget;
}

/** 未割当の最初の位置（中断からの再開用）。 */
function firstUnassignedIndex(
  bindings: KeyboardBindings,
  order: readonly KeyboardTarget[],
): number {
  const index = order.findIndex(
    (target) => bindingOf(bindings, target) === undefined,
  );
  return index === -1 ? order.length : index;
}

/**
 * 登録を開始する。
 *
 * @param resume true なら未割当の最初の対象から再開する。false なら先頭から。
 */
export function startRegistration(
  bindings: KeyboardBindings,
  resume = true,
): KeyboardRegistrationState {
  return {
    bindings,
    order: KEYBOARD_REGISTRATION_ORDER,
    cursor: resume ? firstUnassignedIndex(bindings, KEYBOARD_REGISTRATION_ORDER) : 0,
    conflict: null,
    rejection: null,
    mode: "sequential",
  };
}

/** 1 件だけ取り直す。 */
export function startRetake(
  bindings: KeyboardBindings,
  target: KeyboardTarget,
): KeyboardRegistrationState {
  return {
    bindings,
    order: [target],
    cursor: 0,
    conflict: null,
    rejection: null,
    mode: "single",
  };
}

/** いま登録を待っている対象。終了していれば null。 */
export function currentTarget(
  state: KeyboardRegistrationState,
): KeyboardTarget | null {
  return state.cursor < state.order.length ? state.order[state.cursor] : null;
}

export function isFinished(state: KeyboardRegistrationState): boolean {
  return state.cursor >= state.order.length;
}

/**
 * キーの押下を記録する。
 *
 * ★戻り値は必ず新しい状態である。**拒否された場合も「何も起きない」ではなく、`rejection` を
 *   持った状態を返す**（§4.3-2）。呼び出し側はこれを画面に出す。
 */
export function recordKey(
  state: KeyboardRegistrationState,
  code: string,
  key: string,
  modifiers: KeyModifierState,
): KeyboardRegistrationState {
  const target = currentTarget(state);
  if (target === null) return state;
  // 未解決の二重割当がある間は次の記録を受け付けない。
  if (state.conflict !== null) return state;

  const binding: KeyBinding = { code, label: keyLabel(code, key) };

  const reason = keyExclusionReason(code, modifiers);
  if (reason !== null) {
    // ★カーソルを進めない。登録は完了しておらず、同じ対象を待ち続ける。
    return { ...state, rejection: { binding, reason } };
  }

  const existing = findConflict(state.bindings, code, target);
  if (existing !== null) {
    return {
      ...state,
      rejection: null,
      conflict: { target, existing, binding },
    };
  }

  return {
    ...state,
    bindings: withBinding(state.bindings, target, binding),
    cursor: state.cursor + 1,
    conflict: null,
    rejection: null,
    lastRetaken: state.mode === "single" ? target : undefined,
  };
}

/** 二重割当を承知で上書きする。★元の対象からは割当を外す（同じキーが 2 か所に残らない）。 */
export function confirmOverwrite(
  state: KeyboardRegistrationState,
): KeyboardRegistrationState {
  const conflict = state.conflict;
  if (conflict === null) return state;

  const cleared = withoutBinding(state.bindings, conflict.existing);
  return {
    ...state,
    bindings: withBinding(cleared, conflict.target, conflict.binding),
    cursor: state.cursor + 1,
    conflict: null,
    rejection: null,
    lastRetaken: state.mode === "single" ? conflict.target : undefined,
  };
}

/** 二重割当の取消（別のキーを押し直させる）。 */
export function cancelConflict(
  state: KeyboardRegistrationState,
): KeyboardRegistrationState {
  return state.conflict === null ? state : { ...state, conflict: null };
}

/** 拒否の表示を消す（次のキーを待つ）。 */
export function dismissRejection(
  state: KeyboardRegistrationState,
): KeyboardRegistrationState {
  return state.rejection === null ? state : { ...state, rejection: null };
}

/**
 * いまの対象を飛ばす。
 *
 * ★必須の対象も飛ばせる。**全部を埋めないと使えない形にしない**（Gamepad 側 §4.3-2 と同じ）。
 *   ただし方向・攻撃が欠けたままだとその入力は出せないため、画面側は未登録として出す。
 */
export function skipCurrent(
  state: KeyboardRegistrationState,
): KeyboardRegistrationState {
  if (isFinished(state)) return state;
  return {
    ...state,
    cursor: state.cursor + 1,
    conflict: null,
    rejection: null,
  };
}

/** 当該対象の割当を外す。 */
export function clearTarget(
  state: KeyboardRegistrationState,
  target: KeyboardTarget,
): KeyboardRegistrationState {
  return {
    ...state,
    bindings: withoutBinding(state.bindings, target),
    conflict: null,
    rejection: null,
  };
}

export interface RegistrationProgress {
  assigned: number;
  total: number;
}

/** 登録対象のうち何件が埋まっているか（★件数は `KEYBOARD_REGISTRATION_ORDER` が正）。 */
export function registrationProgress(
  bindings: KeyboardBindings,
): RegistrationProgress {
  const assigned = KEYBOARD_REGISTRATION_ORDER.filter(
    (target) => bindingOf(bindings, target) !== undefined,
  ).length;
  return { assigned, total: KEYBOARD_REGISTRATION_ORDER.length };
}
