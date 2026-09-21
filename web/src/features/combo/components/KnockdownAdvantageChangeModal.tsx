import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SetupSummary } from "@/features/setup/types";

import type { SetupCarryOptionsInput } from "../types";

interface Props {
  open: boolean;
  linkedSetups: SetupSummary[];
  onConfirm: (options: SetupCarryOptionsInput) => void;
  onOpenChange: (open: boolean) => void;
}

export function KnockdownAdvantageChangeModal({
  open,
  linkedSetups,
  onConfirm,
  onOpenChange,
}: Props) {
  const [mode, setMode] = useState<SetupCarryOptionsInput["mode"]>("carry_all");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(
    () => new Set(linkedSetups.map((s) => s.id)),
  );

  const handleToggle = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (mode === "individual") {
      onConfirm({ mode, carrySetupIds: [...checkedIds] });
    } else {
      onConfirm({ mode });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>セットプレイの引き継ぎ確認</DialogTitle>
          <DialogDescription>
            knockdown_advantage が変わるため、紐づくセットプレイ{" "}
            {linkedSetups.length} 件が成立しなくなる可能性があります。
            引き継ぎますか？
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as SetupCarryOptionsInput["mode"])}
          className="space-y-2"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="carry_all" />
            すべて引き継ぐ
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="unlink_all" />
            紐付けをすべて外す
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="individual" />
            個別に選択
          </label>
        </RadioGroup>

        {mode === "individual" && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
            {linkedSetups.map((setup) => (
              <li key={setup.id}>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checkedIds.has(setup.id)}
                    onCheckedChange={() => handleToggle(setup.id)}
                  />
                  <span>{setup.name ?? `セットプレイ #${setup.id}`}</span>
                  <span className="text-xs text-gray-400">
                    {setup.stepCount} ステップ
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => onOpenChange(false)}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            onClick={handleConfirm}
          >
            保存続行
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
