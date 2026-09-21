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

// セットプレイの完全削除の確認(M23-02)。
//
// ★コンボ側の PermanentDeleteConfirm を流用しない。同コンポーネントの文言は
//   「このコンボを完全削除します」と対象を名指ししており、セットプレイに使うと
//   種類の違う対象を「コンボ」と呼ぶことになる。コンボ側には手を入れない(§2.2-2)。
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TrashSetupDeleteConfirm({ open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-700">{t("trash.setup.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("trash.setup.confirmBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("trash.setup.confirmCancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {t("trash.setup.permanentDelete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
