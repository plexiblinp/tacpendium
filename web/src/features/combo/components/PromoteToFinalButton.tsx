import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateComboMetadata } from "../api";
import { parseComboApiError } from "../errors";
import type { Combo, ValidationIssue, ValidationResult } from "../types";
import { DuplicateWarning } from "./DuplicateWarning";

interface Props {
  combo: Combo;
  onPromoted?: (updatedCombo: Combo) => void;
  // 昇格時のバリデーションエラー(400)を親の ValidationDisplay に渡すためのコールバック。
  // 親はこれを ValidationDisplay に流し込み、ボタン横並び行とは別位置(全幅)で表示する。
  // 未指定でも昇格自体は動作する(重複ダイアログ・致命エラーのトーストは本コンポーネント内で完結)。
  onValidationError?: (result: ValidationResult | null) => void;
}

export function PromoteToFinalButton({
  combo,
  onPromoted,
  onValidationError,
}: Props) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [duplicateIssue, setDuplicateIssue] = useState<ValidationIssue | null>(
    null,
  );
  const patchMut = useUpdateComboMetadata(combo.id);

  if (!combo.isDraft) return null;

  const handleConfirm = () => {
    setShowConfirm(false);
    setDuplicateIssue(null);
    onValidationError?.(null);

    patchMut.mutate(
      { version: combo.version, isDraft: false },
      {
        onSuccess: (data) => {
          onPromoted?.(data);
        },
        onError: (err) => {
          const parsed = parseComboApiError(err);
          if (parsed.duplicateIssue) {
            setDuplicateIssue(parsed.duplicateIssue);
            return;
          }
          if (parsed.validations) {
            onValidationError?.(parsed.validations);
            return;
          }
          toast.error(parsed.fatalMessage ?? t("comboEditor.promoteError"));
        },
      },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={patchMut.isPending}
        className="rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        {patchMut.isPending
          ? t("common.loading")
          : t("comboEditor.promoteToFinal")}
      </button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-emerald-700">
              {t("comboEditor.promoteToFinal")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("comboEditor.promoteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateWarning
        open={duplicateIssue !== null}
        issue={duplicateIssue}
        onOpenChange={(open) => { if (!open) setDuplicateIssue(null); }}
      />
    </>
  );
}
