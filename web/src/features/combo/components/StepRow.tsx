import type { Move } from "@/features/moves/types";

import { MODIFIER_NON_MOVE_TYPES } from "../labels";
import type { Step } from "../types";
import { ModifiersSummary } from "./ModifiersSummary";

interface Props {
  step: Step;
  index: number;
  total: number;
  movesById: Map<number, Move>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

// 1 ステップの表示行。「編集」ボタンから ModifiersEditor を開く(M2-01)。
export function StepRow({
  step,
  index,
  total,
  movesById,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
}: Props) {
  return (
    <li className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2">
      <span className="w-6 text-right text-sm font-mono text-gray-500">
        {index + 1}.
      </span>
      <span className="flex-1 text-sm text-gray-900">
        {renderStepLabel(step, movesById)}
      </span>
      <ModifiersSummary modifiers={step.modifiers} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="上へ"
          className="rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="下へ"
          className="rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="編集"
          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="削除"
          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          削除
        </button>
      </div>
    </li>
  );
}

function renderStepLabel(step: Step, movesById: Map<number, Move>): string {
  if (step.moveId != null) {
    const m = movesById.get(step.moveId);
    if (m) {
      return m.nameJa ?? m.code;
    }
    return `#${step.moveId}`;
  }
  if (step.modifiers?.type) {
    const t = MODIFIER_NON_MOVE_TYPES.find(
      (x) => x.value === step.modifiers?.type,
    );
    // M16-06(FB⑥): 未知 type の fallback で内部コードをそのまま露出させない(user 語彙へ)。
    return t?.label ?? "(不明なステップ)";
  }
  return "(不明なステップ)";
}
