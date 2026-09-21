import { useTranslation } from "react-i18next";

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
import type { Tag } from "@/types/tag";

interface Props {
  open: boolean;
  tag: Tag | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function TagDeleteConfirmDialog({
  open,
  tag,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: Props) {
  const { t } = useTranslation();
  const usageCount = tag?.usageCount ?? 0;
  const isInUse = usageCount > 0;

  return (
    <AlertDialog open={open && tag != null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={isInUse ? "text-yellow-700" : undefined}>
            {isInUse ? t("tag.delete.titleInUse") : t("tag.delete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {tag && isInUse ? (
                <>
                  <p>{t("tag.delete.inUse", { name: tag.name, usageCount })}</p>
                  <p>{t("tag.delete.inUseConsequence")}</p>
                </>
              ) : tag ? (
                <p>{t("tag.delete.confirm", { name: tag.name })}</p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("tag.delete.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? t("tag.delete.deleting") : t("tag.delete.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
