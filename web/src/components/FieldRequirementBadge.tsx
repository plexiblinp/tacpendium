import {
  FIELD_OPTIONAL,
  FIELD_REQUIRED,
  FIELD_REQUIREMENT_LABELS,
  type FieldRequirement,
} from "@/constants/field-requirement";
import { cn } from "@/lib/utils";

interface FieldRequirementBadgeProps {
  /** 表す状態。3 値のいずれか。 */
  requirement: FieldRequirement;
  /** test-id / aria 用の識別子(例: "damage" → data-testid="field-requirement-damage")。 */
  topic: string;
  className?: string;
}

// ★★状態ごとの見た目。**3 値の対応表をここに 1 つだけ置く**——
//   呼び出し側で色を組み立てると、欄ごとに見た目が割れる
//   (M24-03 レビュー 高-2 が起き攻めラベルで指摘したのと同じ型)。
const TONE: Record<FieldRequirement, string> = {
  [FIELD_REQUIRED]: "bg-rose-100 text-rose-700",
  [FIELD_OPTIONAL]: "bg-gray-100 text-gray-600",
};

/**
 * FieldRequirementBadge は入力欄の必須度(必須 / 任意)を表す小さな印。
 *
 * ★★「1 つの規則を全欄へ通す」の描画側の実体である(M27-overview §3 M27-02)。
 *   欄ごとに違う見せ方をしないため、印を出すのは**本部品だけ**にする。
 *
 * ★★`optional` は既定では描かない。任意は 13 欄あり、すべてに印を付けると
 *   任意バッジが並んで読めなくなるためである。⇒ 節の先頭に凡例
 *   (FIELD_REQUIREMENT_LEGEND)を 1 回だけ出し、「印の無い欄は任意」と規則で示す。
 *   ★規則は 1 つのままであり、`optional` の描画が「凡例に委ねる」なのである。
 */
export function FieldRequirementBadge({
  requirement,
  topic,
  className,
}: FieldRequirementBadgeProps) {
  if (requirement === FIELD_OPTIONAL) return null;
  return (
    <span
      data-testid={`field-requirement-${topic}`}
      className={cn(
        "ml-1 shrink-0 rounded px-1 py-px text-[10px] font-medium leading-none",
        TONE[requirement],
        className,
      )}
    >
      {FIELD_REQUIREMENT_LABELS[requirement]}
    </span>
  );
}
