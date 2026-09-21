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
import type { Preset } from "../types";

interface Props {
  open: boolean;
  preset: Preset | null;
  /** 削除対象が config の既定プリセットに設定されているか(D-313)。 */
  isDefaultPreset?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export default function PresetDeleteConfirmDialog({
  open,
  preset,
  isDefaultPreset = false,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: Props) {
  return (
    <AlertDialog open={open && preset != null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={isDefaultPreset ? "text-yellow-700" : undefined}>
            {isDefaultPreset ? "既定のプリセットです" : "プリセットを削除"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {preset && isDefaultPreset ? (
                <p>
                  <strong>「{preset.name}」</strong>{" "}
                  は既定のプリセットに設定されているため削除できません。
                  設定画面で別のプリセットを既定にしてから削除してください。
                </p>
              ) : preset ? (
                <>
                  <p>
                    プリセット <strong>「{preset.name}」</strong> を削除しますか?
                  </p>
                  <p>このプリセットのエイリアスもすべて削除されます。元に戻せません。</p>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
          {!isDefaultPreset && (
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="preset-delete-confirm"
            >
              {isDeleting ? "削除中..." : "削除"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
