import type { Move } from "@/features/moves/types";

import type { Modifiers, Step } from "../../types";
import type { LogicalButton } from "./controllerTypes";

export type StepInput = Pick<Step, "moveId" | "moveCode" | "modifiers">;

interface UseControllerInputProps {
  characterId: number;
  moves: Move[];
  onStepAdd: (step: StepInput) => void;
  onStepDelete: () => void;
}

// システム行の論理ボタン → 検索する move.code のマッピング(§4.2.2)。
// code は正典(DES-004 §2.1 = 新形)。throw ボタン = 前投げ(throw_forward)。
// M15-03: 通常技(standing/crouching/jumping)は段階1 で addResolvedMove 経由に移行したため、
// ここは非段階1 のシステム技(DI/DP/投げ)のみを保持する。
//
// ★M21-03: 物理コントローラ経路(features/gamepad)もこの写像を使う。export しているのは
//   「共通技の move_code への写像を 2 か所に割らない」ためであり(指示書 §4.2-2′)、物理側で
//   同じ対応表を書き直すことは新設規則にあたる(契約 F-3・差し戻し事由 2)。
export const SYSTEM_BUTTON_TO_MOVE_CODE: Partial<Record<LogicalButton, string>> = {
  drive_impact: "drive_impact",
  drive_parry: "drive_parry",
  throw: "throw_forward", // 後方互換(旧・単一「投げ」)
  throw_forward: "throw_forward", // 前投げ(指摘14)
  throw_back: "throw_back", // 後ろ投げ(指摘14)
  dash_forward: "dash_forward", // 前ステップ(指摘15、system 技 move_code)
  dash_back: "dash_back", // 後ろステップ(指摘15、system 技 move_code)
};

// 共通技(DI/DP/投げ/ステップ)の論理ボタンを StepInput へ解決する既存の入口。
// 該当 move が当該キャラの moves に無ければ null(データ駆動。誤引き当て・例外送出はしない)。
//
// ★M21-03: 物理コントローラ経路もこの関数を呼ぶ。呼び出し側で move.code を組み立て直さないこと
//   (指示書 §4.1-5「物理入力が決めるのは、仮想 UI のどの操作に当たるかまで」)。
export function resolveSystemButtonStep(
  moves: Move[],
  button: LogicalButton,
): StepInput | null {
  const code = SYSTEM_BUTTON_TO_MOVE_CODE[button];
  if (code === undefined) return null;
  const move = moves.find((m) => m.code === code);
  if (!move) return null;
  return { moveId: move.id, moveCode: move.code };
}

// 仮想コントローラの入力をステップ追加・削除に変換するフック(§4.4)。
// - addResolvedMove: 段階1/直接指定/必殺技 OD で解決済みの moveId をステップ化(flags 付与可)。
// - handleSystemButton: システム行(DI/DP/投げ/ラッシュ/削除)。move が無ければ console.warn で無視。
export function useControllerInput({
  characterId,
  moves,
  onStepAdd,
  onStepDelete,
}: UseControllerInputProps) {
  // 解決済み moveId をステップ化する(出口 = move_code)。flags は必殺技 OD 変種で付与。
  const addResolvedMove = (moveId: number, flags?: string[]) => {
    const move = moves.find((m) => m.id === moveId);
    if (!move) {
      console.warn(
        `VirtualController: move not found - characterId=${characterId}, moveId=${moveId}`,
      );
      return;
    }
    const modifiers: Modifiers | undefined =
      flags && flags.length > 0 ? { flags } : undefined;
    onStepAdd({ moveId, moveCode: move.code, modifiers });
  };

  const handleSystemButton = (button: LogicalButton) => {
    const code = SYSTEM_BUTTON_TO_MOVE_CODE[button];
    if (code !== undefined) {
      // 解決は resolveSystemButtonStep が持つ(物理コントローラ経路と同じ入口)。
      const step = resolveSystemButtonStep(moves, button);
      if (!step) {
        console.warn(
          `VirtualController: move not found - characterId=${characterId}, code=${code}`,
        );
        return;
      }
      onStepAdd(step);
      return;
    }

    switch (button) {
      case "parry_drive_rush": {
        const modifiers: Modifiers = { type: "parry_drive_rush" };
        onStepAdd({ moveId: undefined, modifiers });
        break;
      }
      case "step_delete":
        onStepDelete();
        break;
    }
  };

  return { addResolvedMove, handleSystemButton };
}
