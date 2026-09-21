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

interface Props {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function PermanentDeleteConfirm({ open, count, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  // ★単件と複数で文面を変える。件数を出さない単件の文面のほうが読みやすいため、
  //   i18next の count 複数形に寄せず 2 つのキーに分ける(ja は複数形を持たない)。
  const message =
    count === 1
      ? t("trash.combo.confirmBodySingle")
      : t("trash.combo.confirmBodyBulk", { count });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-700">{t("trash.combo.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("trash.combo.confirmCancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            {t("trash.combo.confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
