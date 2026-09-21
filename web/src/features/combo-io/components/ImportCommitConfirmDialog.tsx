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
  /** 取込対象として選ばれているコンボ行数。 */
  targetCount: number;
  /** 仮登録のため取込対象から外した行数(0 なら文へ出さない)。 */
  excludedDraftCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

// 取込実行の確認ダイアログ(SM-121 / M24-06 §4.6)。
//
// ★足した理由: 取込は DB へ行を作る取り消せない操作でありながら、押した瞬間に走っていた。
//   §3.3-7 の監査(取込・出力の面・母数 6)で「無いと事故になる」と判定した唯一の 1 件である。
//   ★他の 5 件(プレビュー・エクスポート実行・ヘルパーの CSV 生成・ファイルの選び直し)は
//     取り消せるか、読み取りだけであるため足していない(一律にダイアログにしない)。
//
// ★共有プリミティブ(components/ui/alert-dialog)を土台にすること(規則9)。
//   自作オーバーレイにすると M21-07 の物理入力抑止(lib/modal-presence)に乗らない。
//
// ★文言は固定 ja。ComboImportPage は可視文言をすべて直書きしており(i18n は VAL コードの
//   写像だけ)、DES-005 §5.19 も import/export 系を固定 ja の流儀としている。新しい流儀を作らない。
export function ImportCommitConfirmDialog({
  open,
  targetCount,
  excludedDraftCount,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>コンボを取り込みます</AlertDialogTitle>
          <AlertDialogDescription>
            {targetCount} 件のコンボを取り込みます。
            {excludedDraftCount > 0 &&
              `仮登録の ${excludedDraftCount} 件は取り込みません。`}
            この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>取り込む</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
