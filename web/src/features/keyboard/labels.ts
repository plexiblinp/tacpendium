// 登録対象の表示ラベルと test-id 用の識別子（M21-05）。
//
// ★**ラベルの表を新しく作らない**（`E-76`）。技側は Gamepad の登録案内が既に持っている表
//   （`calibrationTargetLabel`）を、操作側は `M21-04` の `ACTION_LABEL` をそのまま引く。
//   ここで書き写すと、同じ語が 3 か所になり片方だけ古くなる。

import { calibrationTargetLabel, calibrationTargetSlug } from "@/features/gamepad/logicalButtons";
import { ACTION_LABEL } from "@/features/gamepad/shortcut";

import { isActionTarget } from "./types";
import type { KeyboardTarget } from "./types";

/** 登録対象の表示名。 */
export function keyboardTargetLabel(target: KeyboardTarget): string {
  return isActionTarget(target)
    ? ACTION_LABEL[target]
    : calibrationTargetLabel(target);
}

/**
 * `data-testid` の識別子部分。
 *
 * ★`DES-005` §6.8 の `recipe-<領域>-<識別子>` 規約に合わせたケバブケース。
 *
 * ★**旧記述「操作側（"delete" / "save" / "modifier"）は 1 語なのでそのまま使える」は失効した**
 *   （`M21-06`）。`command_mode` が加わり、そのまま使うと `recipe-keyboard-assigned-command_mode`
 *   という**スネークケース混じりの test-id** が出て §6.8 の規約から外れる。
 *   ⇒ 技側と同じ変換を通す。**1 語であるうちは結果が変わらないため、既存 test-id は不変である。**
 */
export function keyboardTargetSlug(target: KeyboardTarget): string {
  return isActionTarget(target)
    ? target.replace(/_/g, "-")
    : calibrationTargetSlug(target);
}

/**
 * 登録対象が何のためのものかの区分ラベル（案内の見出しに使う）。
 *
 * ★**操作は「技を出さない」ことを明示する。** 書かないと、利用者は削除キーを技のボタンだと
 *   思って登録し、入力中に押して驚く。
 */
export function keyboardTargetKindLabel(target: KeyboardTarget): string {
  return isActionTarget(target) ? "操作（技は出ません）" : "技";
}
