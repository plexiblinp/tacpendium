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
  onOpenChange: (open: boolean) => void;
  // 「変更して入力を破棄」: フォーム全体を新キャラの新規初期状態へリセットする。
  onConfirm: () => void;
  // 「キャンセル」: キャラ変更を取り消し、選択を変更前へ戻す(フォーム保持)。
  onCancel: () => void;
}

// 新規/コピーモードでのキャラクター変更時に表示する確認ダイアログ(CHANGE-036 / DES-005 §5.7)。
// 入力済み内容がある(dirty)場合のみ ComboEditor から開かれる。
export function CharacterChangeConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-yellow-700">
            確認: キャラクターを変更すると入力内容が破棄されます
          </AlertDialogTitle>
          <AlertDialogDescription>
            レシピ・始動技・束ねたセットプレイは選択キャラクターの技で構成されるため、
            キャラクターを変更すると現在の入力内容は引き継げません。変更しますか?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            変更して入力を破棄
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
