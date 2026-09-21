import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { InfoMark } from "@/components/InfoMark";
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
import { Textarea } from "@/components/ui/textarea";
import type { Move } from "@/features/moves/types";

import { MODIFIER_FLAGS_COMMON, MODIFIER_NON_MOVE_TYPES } from "../labels";
import type { Modifiers, Step } from "../types";
import { ModifierOdVariantFields } from "./ModifierOdVariantFields";

const NOTES_MAX_LENGTH = 50;

interface Props {
  open: boolean;
  step: Step | undefined;
  stepIndex: number | null;
  movesById: Map<number, Move>;
  onSave: (stepIndex: number, newModifiers: Modifiers | undefined) => void;
  onOpenChange: (open: boolean) => void;
}

export function ModifiersEditor({ open, step, stepIndex, movesById, onSave, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [localFlags, setLocalFlags] = useState<string[]>([]);
  const [localType, setLocalType] = useState<string>("");
  const [localNotes, setLocalNotes] = useState<string>("");

  useEffect(() => {
    if (open && step) {
      setLocalFlags(step.modifiers?.flags ?? []);
      setLocalType(step.modifiers?.type ?? "");
      setLocalNotes(step.modifiers?.notes ?? "");
    }
  }, [open, step]);

  const isNonMove = step?.moveId == null;
  const stepLabel = step ? renderStepLabel(step, movesById) : "";
  const notesOver = localNotes.length > NOTES_MAX_LENGTH;

  useEffect(() => {
    if (localNotes.length > NOTES_MAX_LENGTH) {
      console.warn(`localNotes が 50 文字を超えています: ${localNotes.length} 文字`);
    }
  }, [localNotes]);

  const toggleFlag = (flag: string) => {
    setLocalFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  const handleSave = () => {
    if (stepIndex === null) return;
    const m: Modifiers = {};
    if (localFlags.length > 0) m.flags = localFlags;
    if (isNonMove && localType) m.type = localType;
    if (localNotes.trim().length > 0) m.notes = localNotes.trim();
    const hasContent =
      (m.flags != null && m.flags.length > 0) || !!m.type || !!m.notes;
    onSave(stepIndex, hasContent ? m : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>ステップ編集: {stepLabel}</DialogTitle>
            <InfoMark
              topic="modifier"
              text={t("help.modifier")}
              ariaLabel="modifier の説明"
            />
          </div>
          <DialogDescription className="sr-only">
            ステップの修飾情報を編集します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">
              補足(入力のコツ・状況、複数選択可)
            </p>
            {/*
              ★M37-06 段 1/段 4 の計測アンカー。★描画には影響しない属性であり、
                これが無いと段 1(変更前)と段 4(変更後)で同じ要素を測れない
                (先例＝`M37-02` の `recipe-controller-root`)。

              ★★★M37-06 段 4: 縦 1 列(space-y-1)から **2 列グリッド**へ変えた。
                理由＝選択肢が 7 → 11 になり、縦 1 列のままだと 4 行ぶん縦が伸びる。
                `M37-02` は縦の消費を減らすサブであり、その成果を食う(指示書 §4.5)。
                ⇒ 2 列にすると 11 項目は 6 行に収まり、着手前の 7 行より短くなる。
              ★★分類の見出しは置かない —— 見出しを 4 本置くと、畳んだぶんがそのまま戻る。
                分類は並び順(labels.ts のコメント)で表し、画面には出さない。
              ★modifier の欄は `MAX_BUTTONIZED_OPTIONS`(数字キー割当・上限 10)の
                対象ではない(段 1-3 の実測)。本欄は素のチェックボックスであり、
                OptionButtonGroup を通っていない。⇒ 14 値でも上限には当たらない。
            */}
            <div
              className="grid grid-cols-2 gap-x-3 gap-y-1"
              data-testid="modifier-flags-dialog"
            >
              {MODIFIER_FLAGS_COMMON.map((f) => (
                <label
                  key={f.value}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <Checkbox
                    checked={localFlags.includes(f.value)}
                    onCheckedChange={() => toggleFlag(f.value)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            {/* ★M30-02(SD-020): OD 強度組合せは既定非表示 ＋ 必殺技の OD のときだけ選択可。 */}
            <div className="mt-2">
              <ModifierOdVariantFields
                flags={localFlags}
                onToggle={toggleFlag}
                move={step?.moveId != null ? movesById.get(step.moveId) : undefined}
                layout="dialog"
              />
            </div>
          </div>

          {isNonMove && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">type</p>
              <RadioGroup
                value={localType}
                onValueChange={setLocalType}
                className="space-y-1"
              >
                {MODIFIER_NON_MOVE_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex items-center gap-2 text-sm text-gray-800"
                  >
                    <RadioGroupItem value={t.value} />
                    {t.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          <div>
            <label
              htmlFor="modifiers-notes"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              メモ
              <span className="ml-1 text-xs font-normal text-gray-500">
                (50文字以内目安)
              </span>
            </label>
            <Textarea
              id="modifiers-notes"
              rows={2}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              className={
                notesOver
                  ? "border-red-400 bg-red-50 text-red-900"
                  : ""
              }
            />
            {notesOver && (
              <p className="mt-0.5 text-xs text-red-600">
                {localNotes.length} 文字 — 50文字超です
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded bg-gray-200 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderStepLabel(step: Step, movesById: Map<number, Move>): string {
  if (step.moveId != null) {
    const m = movesById.get(step.moveId);
    if (m) return m.nameJa ?? m.code;
    return `#${step.moveId}`;
  }
  // ★★M37-02(B04): 内部 type をそのまま返していた —— ダイアログ見出しが
  //   「ステップ編集: parry_drive_rush」になっていた。⇒ 利用者語彙へ引き当てる。
  //   同型の是正は StepRow.tsx が M16-06(FB⑥)で既に済ませており、そちらへ揃えた。
  if (step.modifiers?.type) {
    const t = MODIFIER_NON_MOVE_TYPES.find(
      (x) => x.value === step.modifiers?.type,
    );
    return t?.label ?? "(不明なステップ)";
  }
  return "(不明なステップ)";
}
