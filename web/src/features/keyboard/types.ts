// キーボード入力の型と登録対象（M21-05 §4.1・§4.2）。
//
// ★**既定のキー割当を持たない**（**D-370**・開発者判断）。`gamepad/defaultProfile.ts` に相当する
//   ものを本 feature へ作らないこと。キーボードは利用者により操作設定がかなり変わるため、推測で
//   当てた既定は「間違った割当が黙って入っている」状態になる。
//   ⇒ **登録しないと 1 つも入力できない。** これは失敗ではなく状態として利用者へ出す（§4.1-4）。
//
// ★操作の種別は `M21-04` と**同じ列挙を共有する**（§4.2-3）。別の列挙を作らない——作ると、操作を
//   1 つ足すたびに 2 か所を直すことになり、片方だけ古くなる（`E-76`）。
//   ★**`M21-06` で 3 値 → 4 値になったが、直したのは `gamepad/shortcut.ts` の 1 か所だけである**——
//     本ファイルは同型を import しているため自動的に追随した。**共有していることの実証である。**

import type { PhysicalInputActionKind } from "@/features/gamepad/shortcut";
import type {
  CalibrationButton,
  DirectionCardinal,
} from "@/features/gamepad/types";
import { DIRECTION_CARDINALS } from "@/features/gamepad/types";

/**
 * 技を出すために登録するボタン。
 *
 * ★`shortcut_prefix` を除く——**前置きボタン方式を採らないため**（§4.2-2）。`M21-04` が前置きを
 *   採ったのは「余りボタンが尽きる機体がある」ためであり（**D-358**）、キーボードにその制約は無い。
 */
export type KeyboardMoveButton = Exclude<CalibrationButton, "shortcut_prefix">;

/** 方向 ＋ 技ボタン。 */
export type KeyboardMoveTarget = DirectionCardinal | KeyboardMoveButton;

/**
 * 登録対象。技用と操作用を 1 つの型で扱う。
 *
 * ★操作側は `PhysicalInputActionKind` **そのもの**である（値の列挙は `gamepad/shortcut.ts` の
 *   1 か所にある。**ここへ写さない**——写すと `M21-06` のように値が増えたとき片方だけ古くなる）。
 *   下の {@link KeyboardTargetsAreDisjoint} が、技用の名前と衝突しないことを型で固定している。
 */
export type KeyboardTarget = KeyboardMoveTarget | PhysicalInputActionKind;

type AssertNever<T extends never> = T;

/**
 * ★技用と操作用の名前が衝突しないことの静的な保証。
 *
 * 衝突すると {@link KeyboardBindings} の 2 つの Record を 1 つの `KeyboardTarget` で索く操作が
 * 曖昧になる。どちらかに同名が現れた時点で、`AssertNever` の制約違反として**ここが赤くなる**。
 *
 * ★型として export しているのは「未使用」と判定させないためであり、値としての用途は無い。
 */
export type KeyboardTargetsAreDisjoint = AssertNever<
  Extract<KeyboardMoveTarget, PhysicalInputActionKind>
>;

/**
 * 1 つの登録結果。
 *
 * ★`code` が同一性、`label` は表示専用である（`excludedKeys.ts` の {@link keyLabel} 参照）。
 *   `label` を同一性に使わないこと——同じ物理キーでも配列で文字が変わる。
 */
export interface KeyBinding {
  /** `KeyboardEvent.code`（物理位置）。 */
  code: string;
  /** 利用者へ見せる文字。 */
  label: string;
}

/**
 * 保存する割当の全体。
 *
 * ★**技用と操作用を別の Record に持つ。** 同じ Record へ混ぜると、操作用のキーが技の押下集合へ
 *   紛れ込む経路ができる（§4.2-4／チェックリスト重大 5）。分けておけば、
 *   `normalizeKeyboard` が操作用を**参照すらしない**ため構造的に混ざらない。
 */
export interface KeyboardBindings {
  version: 1;
  moves: Partial<Record<KeyboardMoveTarget, KeyBinding>>;
  actions: Partial<Record<PhysicalInputActionKind, KeyBinding>>;
}

/** 何も登録されていない状態。★これが初期状態である（既定プロファイルではない）。 */
export function createEmptyBindings(): KeyboardBindings {
  return { version: 1, moves: {}, actions: {} };
}

// ---------------------------------------------------------------------------
// 登録対象の並び
// ---------------------------------------------------------------------------

/** 技ボタン（必須）。★Gamepad の `ATTACK_BUTTONS` と同じ 6 件。 */
export const KEYBOARD_ATTACK_TARGETS: readonly KeyboardMoveButton[] = [
  "light_punch",
  "medium_punch",
  "heavy_punch",
  "light_kick",
  "medium_kick",
  "heavy_kick",
] as const;

/**
 * マクロ（任意）。
 *
 * ★SF6 側でマクロを 1 キーに割り当てている利用者が居るため置く。**任意区間であり、
 *   登録しなくても入力は壊れない**——DI / DP / 投げは強P+強K 等の同時押しからも出せる。
 */
export const KEYBOARD_MACRO_TARGETS: readonly KeyboardMoveButton[] = [
  "drive_impact",
  "drive_parry",
  "throw",
] as const;

/**
 * 操作（任意）。★**それぞれ 1 つのキーへ直接割り当てる**（§4.2-1）。前置きは挟まない。
 *
 * ★並びは `M21-04` の割当表と同じ順（修飾 → 保存 → 削除）にしてある。
 * ★**`M21-06` で `command_mode` が 4 件目として加わった。** 列挙そのものは
 *   `gamepad/shortcut.ts` の 1 か所にあり、本配列はその**並び順**だけを決めている
 *   （`E-76`。キーボード用の列挙を別に作らない）。
 */
export const KEYBOARD_ACTION_TARGETS: readonly PhysicalInputActionKind[] = [
  "modifier",
  "save",
  "delete",
  "command_mode",
] as const;

/**
 * 必須区間＝方向 4 ＋ 攻撃 6 の 10 件。
 * ★ここまで埋まれば技の入力は成立する（Gamepad 側の `REQUIRED_TARGETS` と同じ考え方）。
 */
export const KEYBOARD_REQUIRED_TARGETS: readonly KeyboardTarget[] = [
  ...DIRECTION_CARDINALS,
  ...KEYBOARD_ATTACK_TARGETS,
] as const;

/** 任意区間＝マクロ 3 ＋ 操作 4 の 7 件（★`M21-06` で操作が 3 → 4 になった）。 */
export const KEYBOARD_OPTIONAL_TARGETS: readonly KeyboardTarget[] = [
  ...KEYBOARD_MACRO_TARGETS,
  ...KEYBOARD_ACTION_TARGETS,
] as const;

/**
 * 案内順の全体＝**17 件**（★`M21-06` で 16 → 17。操作が 3 → 4 になったため）。
 *
 * ★Gamepad の 14 件（`logicalButtons.ts` の `CALIBRATION_ORDER`）とは件数が違う。
 *   **キーボードは前置き 1 件を持たない代わりに、操作を直接持つ**ため差が出る（§4.2-5）。
 *   ⇒ **どちらかの件数を動かすとき、もう一方を釣られて直さないこと。別々の理由で決まっている。**
 *   ★実際 `M21-06` は**キーボード側だけ 1 件増え、Gamepad 側は 14 件のまま**である——
 *     Gamepad は後続ボタンが 1 つ増えただけで、登録する前置きボタンは 1 件のままだからである。
 */
export const KEYBOARD_REGISTRATION_ORDER: readonly KeyboardTarget[] = [
  ...KEYBOARD_REQUIRED_TARGETS,
  ...KEYBOARD_OPTIONAL_TARGETS,
] as const;

const ACTION_TARGET_SET: readonly string[] = KEYBOARD_ACTION_TARGETS;

/** 操作用の登録対象か（技用と操作用で保存先の Record が違うため、索く前に判別する）。 */
export function isActionTarget(
  target: KeyboardTarget,
): target is PhysicalInputActionKind {
  return ACTION_TARGET_SET.includes(target);
}

export function isRequiredTarget(target: KeyboardTarget): boolean {
  return KEYBOARD_REQUIRED_TARGETS.includes(target);
}

/** 当該対象に登録済みのキー。未登録なら undefined。 */
export function bindingOf(
  bindings: KeyboardBindings,
  target: KeyboardTarget,
): KeyBinding | undefined {
  return isActionTarget(target)
    ? bindings.actions[target]
    : bindings.moves[target];
}

/** 割当を 1 件足した新しい割当を返す（不変）。 */
export function withBinding(
  bindings: KeyboardBindings,
  target: KeyboardTarget,
  binding: KeyBinding,
): KeyboardBindings {
  if (isActionTarget(target)) {
    return {
      ...bindings,
      actions: { ...bindings.actions, [target]: binding },
    };
  }
  return { ...bindings, moves: { ...bindings.moves, [target]: binding } };
}

/** 割当を 1 件外した新しい割当を返す（不変）。 */
export function withoutBinding(
  bindings: KeyboardBindings,
  target: KeyboardTarget,
): KeyboardBindings {
  if (isActionTarget(target)) {
    const actions = { ...bindings.actions };
    delete actions[target];
    return { ...bindings, actions };
  }
  const moves = { ...bindings.moves };
  delete moves[target];
  return { ...bindings, moves };
}

/**
 * 同じ `code` を既に使っている別の対象を探す（二重割当の検出）。
 *
 * ★技用と操作用を**またいで**探す。またがないと、保存キーに技用と同じキーを当てられてしまい、
 *   1 回の打鍵で技と保存が同時に起きる。
 */
export function findConflict(
  bindings: KeyboardBindings,
  code: string,
  exclude: KeyboardTarget,
): KeyboardTarget | null {
  for (const target of KEYBOARD_REGISTRATION_ORDER) {
    if (target === exclude) continue;
    if (bindingOf(bindings, target)?.code === code) return target;
  }
  return null;
}

/** 技側の割当が 1 つでもあるか。★false なら「未登録」であり、入力は 1 つも成立しない。 */
export function hasAnyMoveBinding(bindings: KeyboardBindings): boolean {
  return Object.keys(bindings.moves).length > 0;
}

/** 必須 10 件がすべて埋まっているか。 */
export function isRegistrationComplete(bindings: KeyboardBindings): boolean {
  return KEYBOARD_REQUIRED_TARGETS.every(
    (target) => bindingOf(bindings, target) !== undefined,
  );
}
