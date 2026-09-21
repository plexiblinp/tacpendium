import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ValidationIssue } from "../types";

interface Props {
  open: boolean;
  issue: ValidationIssue | null;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateWarning({ open, issue, onOpenChange }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-700">重複コンボの警告</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>入力内容と同一のコンボが既に登録されています。重複は登録できません。</p>
              {issue && (
                <p className="rounded bg-gray-50 p-2 text-xs text-gray-600">
                  <span className="font-mono">[{issue.code}]</span> {issue.message}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>閉じる</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
