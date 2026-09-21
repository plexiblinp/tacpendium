import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { TAG_CATEGORY_MYCOMBO_STATUS } from "@/constants/mycombo";
import { TagBadgeList } from "@/features/tag/components/TagBadgeList";
import type { ComboSummary } from "../types";
import { formatStarterStatus, formatDamage } from "../utils";
import { useRestoreCombo } from "../hooks/useRestoreCombo";
import { usePermanentDelete } from "../hooks/usePermanentDelete";
import { PermanentDeleteConfirm } from "./PermanentDeleteConfirm";
import { formatRestoreWarnings } from "@/features/trash/restoreWarnings";

function formatDeletedAt(deletedAt: string): string {
  const d = new Date(deletedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  combo: ComboSummary;
  selected: boolean;
  onSelectionChange: (id: number, selected: boolean) => void;
  onComboChanged: () => void;
}

export function TrashListRow({ combo, selected, onSelectionChange, onComboChanged }: Props) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const navigate = useNavigate();
  const restoreMutation = useRestoreCombo();
  const permanentDeleteMutation = usePermanentDelete();

  const deletedAt = combo.deletedAt ?? null;

  const handleRestore = async () => {
    try {
      setRowError(null);
      const restored = await restoreMutation.mutateAsync(combo.id);
      // ★警告はエラーではない。復元は成功しているので、完了トーストと一緒に出す
      //   (DES-006 §11.1 / 指示書 §4.4)。★モーダルにしない。
      // ★0 件のときは warnings キー自体が無い。空配列で来ることはない(§4.3-2)。
      // ★★警告が無くても完了トーストを出す(M23-06 §4.6-1)。一括復元は 0 件でも出して
      //   おり、単件だけ黙っていると「単件は成功したのか判らない」状態になっていた。
      // ★警告があるときは 1 枚に畳む。完了と警告で 2 枚出さない。
      const warnings = restored.warnings ?? [];
      if (warnings.length > 0) {
        toast.warning(
          t("trash.warning.restoredWithWarnings", {
            warnings: formatRestoreWarnings(warnings, t),
          }),
        );
      } else {
        toast.success(t("trash.warning.restored"));
      }
      onComboChanged();
    } catch (err: unknown) {
      setRowError(
        t("trash.combo.restoreError", {
          message: err instanceof Error ? err.message : t("trash.common.unknownError"),
        }),
      );
    }
  };

  const handlePermanentDelete = async () => {
    try {
      setRowError(null);
      await permanentDeleteMutation.mutateAsync(combo.id);
      setConfirmOpen(false);
      onComboChanged();
    } catch (err: unknown) {
      setConfirmOpen(false);
      setRowError(
        t("trash.combo.permanentDeleteError", {
          message: err instanceof Error ? err.message : t("trash.common.unknownError"),
        }),
      );
    }
  };

  return (
    <>
      {/* ★M23-07 §4.2 / §5.2-5: 遷移先は 2 か所ある(行全体の onClick と 2 列目の
          <Link>)。どちらも /trash/combos/:id を向けること——片方だけ直すと、
          クリックした場所によって 404 になったりならなかったりする。 */}
      <TableRow
        className="cursor-pointer"
        onClick={() => navigate(`/trash/combos/${combo.id}`)}
      >
        <TableCell className="align-middle" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectionChange(combo.id, checked === true)}
            aria-label={t("trash.combo.columnSelect", { id: combo.id })}
          />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Link to={`/trash/combos/${combo.id}`} className="text-blue-600 hover:underline">
            {formatStarterStatus(combo, t)}
          </Link>
        </TableCell>
        <TableCell className="tabular-nums">
          {formatDamage(combo.damage)}
        </TableCell>
        <TableCell>
          <TagBadgeList
            tags={combo.tags}
            excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}
            maxVisible={3}
          />
        </TableCell>
        <TableCell className="text-slate-600 tabular-nums">
          {deletedAt ? formatDeletedAt(deletedAt) : "-"}
        </TableCell>
        <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoreMutation.isPending}
            className="mr-3 text-blue-600 hover:underline disabled:opacity-50"
          >
            {t("trash.combo.restore")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={permanentDeleteMutation.isPending}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {t("trash.combo.permanentDelete")}
          </button>
        </TableCell>
      </TableRow>
      {rowError && (
        <TableRow>
          <TableCell colSpan={6}>
            <div role="alert" className="px-3 py-1 text-sm text-red-600">
              {rowError}
            </div>
          </TableCell>
        </TableRow>
      )}
      <PermanentDeleteConfirm
        open={confirmOpen}
        count={1}
        onConfirm={handlePermanentDelete}
        onOpenChange={(open) => { if (!open) setConfirmOpen(false); }}
      />
    </>
  );
}
