// キーボードの押下集合 → 論理ボタン集合への正規化（M21-05 §4.5）。
//
// ★本ファイルは純粋関数だけで構成する。window にも document にも触らない。
//
// ★**出力は Gamepad 側と同じ `NormalizeResult` である**（`gamepad/types.ts`）。判定層
//   （`stepDetection.ts`）が食うのは `NormalizeResult` であって `GamepadSnapshot` ではないため、
//   ここで形を合わせておけば**判定層は 1 行も変わらない**（§4.5-1・§4.5-4／チェックリスト重大 1）。
//   ⇒ 「キーボードのときは」という分岐を判定層へ入れないための要が本ファイルである。
//
// ★SOCD と斜めの導出は `gamepad/logicalButtons.ts` の `cardinalsToNumpad` を**再利用する**。
//   ここへ書き写すと、SOCD 規則が 2 か所になり片方だけ古くなる（`E-76`）。
//
// ★**操作用のキーを一切参照しない**（§4.2-4／チェックリスト重大 5）。本関数は
//   `KeyboardBindings.moves` しか読まないため、操作用のキーが押下集合へ混ざる経路が**存在しない**。
//   Gamepad 側は同じ Record に格納したうえで `normalize.ts` が振り分けているが、キーボードは
//   保存の時点で分かれている（`types.ts` の {@link KeyboardBindings}）。

import {
  cardinalsToNumpad,
  numpadToLogicalButton,
} from "@/features/gamepad/logicalButtons";
import type {
  CardinalState,
  DirectionCardinal,
  LogicalButtonState,
  NormalizeResult,
} from "@/features/gamepad/types";
import { DIRECTION_CARDINALS } from "@/features/gamepad/types";

import { KEYBOARD_ATTACK_TARGETS, KEYBOARD_MACRO_TARGETS } from "./types";
import type { KeyboardBindings, KeyboardMoveButton } from "./types";

/**
 * 押下集合の走査順。
 *
 * ★`stepDetection.ts` の `BUTTON_ORDER`（攻撃 6 → マクロ 3）と同じ並びにしてある。
 *   確定したステップの `buttons` は判定側で並べ替えられるため出力順は結果に影響しないが、
 *   **同じ並びにしておくと Gamepad 側との突き合わせ（§5 (g) の同一性テスト）が読みやすい。**
 */
const MOVE_BUTTON_ORDER: readonly KeyboardMoveButton[] = [
  ...KEYBOARD_ATTACK_TARGETS,
  ...KEYBOARD_MACRO_TARGETS,
] as const;

/**
 * いま押されているキーの集合を、論理ボタンの状態へ正規化する。
 *
 * @param bindings  利用者が登録した割当。★既定は無い——未登録なら何も解決しない
 * @param heldCodes いま押されている `KeyboardEvent.code` の集合
 *
 * ★**未登録では `resolved: false` を返す**（§4.1-3）。Gamepad 側がプロファイル未解決のときに
 *   返すのと同じ形であり、判定層は `resolved !== true` の押下集合を空として扱う。
 *   ⇒ 「登録しないと 1 つも入力できない」が構造として保証される。
 */
export function normalizeKeyboard(
  bindings: KeyboardBindings,
  heldCodes: ReadonlySet<string>,
): NormalizeResult {
  // ★技側の割当が 1 つも無ければ解決しない。操作側だけ登録されていても技は出ない。
  if (Object.keys(bindings.moves).length === 0) {
    return { states: [], resolved: false };
  }

  const states: LogicalButtonState[] = [];

  // --- 方向 -------------------------------------------------------------------
  // ★Gamepad 側（normalize.ts）と同じ構造を作る。押されていない方向も `cardinals` に残す。
  const cardinals: Record<DirectionCardinal, CardinalState> = {
    up: { pressed: false, value: 0, source: "button" },
    down: { pressed: false, value: 0, source: "button" },
    left: { pressed: false, value: 0, source: "button" },
    right: { pressed: false, value: 0, source: "button" },
  };
  let anyDirectionBound = false;

  for (const cardinal of DIRECTION_CARDINALS) {
    const binding = bindings.moves[cardinal];
    if (binding === undefined) continue;
    anyDirectionBound = true;
    const pressed = heldCodes.has(binding.code);
    // ★キーはデジタルであり中間値を持たない。レバーの倒し量に相当するものは 0/1 になる。
    cardinals[cardinal] = { pressed, value: pressed ? 1 : 0, source: "button" };
  }

  if (anyDirectionBound) {
    const held = {
      up: cardinals.up.pressed,
      down: cardinals.down.pressed,
      left: cardinals.left.pressed,
      right: cardinals.right.pressed,
    };
    // ★斜めの導出と SOCD の解決は Gamepad と同じ 1 つの関数が行う。
    const digit = cardinalsToNumpad(held);
    const anyHeld = held.up || held.down || held.left || held.right;
    const isDiagonal = digit === 1 || digit === 3 || digit === 7 || digit === 9;

    states.push({
      button: numpadToLogicalButton(digit),
      // ★方向は「イベント」ではなく「状態」である。未入力でも direction_neutral が入る
      //   （`NormalizeResult.states` の注記と同じ流儀）。
      pressed: true,
      value: anyHeld ? 1 : 0,
      // 斜めは 2 入力の合成であるため由来を "derived" にする（Gamepad 側と同じ）。
      source: !anyHeld ? "derived" : isDiagonal ? "derived" : "button",
    });
  }

  // --- ボタン -----------------------------------------------------------------
  for (const button of MOVE_BUTTON_ORDER) {
    const binding = bindings.moves[button];
    if (binding === undefined) continue;
    if (!heldCodes.has(binding.code)) continue;
    states.push({ button, pressed: true, value: 1, source: "button" });
  }

  return {
    states,
    cardinals: anyDirectionBound ? cardinals : undefined,
    // ★キーボードに「操作用の論理ボタン」は存在しない。操作は論理ボタンを経由せず、
    //   `KeyboardBindings.actions` から直接 `PhysicalInputActionKind` へ写る（§4.2-1）。
    actions: [],
    resolved: true,
  };
}

/**
 * 押されたキーが起こす操作。割り当てられていなければ null。
 *
 * ★`M21-04` の `actionForFollowUp`（前置きの後続ボタン → 操作）とは別物である。**前置きを挟まず、
 *   1 つのキーが直接 1 つの操作に対応する**（§4.2-1・§4.2-2）。種別そのものは同じ列挙を共有する。
 */
export function actionForKey(
  bindings: KeyboardBindings,
  code: string,
): keyof KeyboardBindings["actions"] | null {
  for (const [action, binding] of Object.entries(bindings.actions)) {
    if (binding?.code === code) {
      return action as keyof KeyboardBindings["actions"];
    }
  }
  return null;
}

/** 当該キーが技用に登録されているか（押下集合へ入れるべきキーか）。 */
export function isMoveKey(bindings: KeyboardBindings, code: string): boolean {
  for (const binding of Object.values(bindings.moves)) {
    if (binding?.code === code) return true;
  }
  return false;
}
