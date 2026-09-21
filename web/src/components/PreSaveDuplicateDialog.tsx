// 保存前の重複ダイアログ(M23-09 §4.2〜§4.4)。コンボ登録・セットプレイ登録の両方が使う。
//
// ★★本部品の存在理由は「保存する前に選ばせる」ことである(§1.2)。M23-05 は同じ目的を
// 「保存が成功した後のトースト」で果たそうとして失敗した——保存後に告げるものは、
// 定義上「作り直す前」に告げられない(D-518)。
//
// ★★WARNING でモーダルを出すのは逸脱ではない(§4.2-2)。区別は「警告の表示」か
// 「操作の分岐」かであり、選ばないと次へ進めないものはモーダルが正しい。
// 先例＝VAL-N02(DES-006 §7。WARNING で明示的な同意ダイアログ)。
//
// ★★「両方入れる」の選択肢は出さない(§1.4-1・D-518)。禁止された状態ではないが、
// ボタン 1 つで重複を作れるようにすると、重複を減らすための導線が重複を増やす。
// ⇒ 「選択肢が足りない」と読んで足さないこと。
//
// ★AlertDialogContent 経由であること。自作オーバーレイにすると M21-07 の物理入力抑止
// (lib/modal-presence)に参加せず、モーダルの裏でレシピにステップが入る。
//
// ★DES-006 §11.2 の 4 点との対応(§4.4):
//   1. 入力を保持したまま表示する  → 本部品はフォームの state に一切触れない。
//   2. 進む道を示す                → 「復元する」「新しく作る」の 2 つ。
//   3. 消えることを押す前に伝える  → restoreCaution を復元ボタンの直上に常時表示する。
//                                     ★押した後の通知ではない。開いた瞬間から見えている。
//   4. 「失敗」と書かない          → 重複が在ることは失敗ではない。文言に「失敗」「エラー」を
//                                     使わない(復元が実際に落ちたときの restoreFailed は別)。

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DuplicateCandidate } from "@/features/trash/preSaveDuplicateCheck";

export interface PreSaveDuplicateDialogProps {
  /** ★0 件では開かない。呼び出し側が候補を空にすることで閉じる。 */
  candidates: DuplicateCandidate[];
  /** "combo" | "setup"。本文の文面だけが変わる。 */
  kind: "combo" | "setup";
  /** 送信中はすべてのボタンを押せなくする(§4.6-1)。 */
  busy: boolean;
  /** 復元に失敗したときに出す一文。★失敗してもダイアログは閉じない(§4.9 #11)。 */
  restoreFailed?: boolean;
  onRestore: (id: number) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function PreSaveDuplicateDialog({
  candidates,
  kind,
  busy,
  restoreFailed = false,
  onRestore,
  onCreateNew,
  onCancel,
}: PreSaveDuplicateDialogProps) {
  const { t } = useTranslation();
  const open = candidates.length > 0;

  // ★該当が 1 件かどうかの判定は 1 か所に寄せる。同じ式を 2 か所に書くと片方だけ直る。
  const single = useMemo(
    () => (candidates.length === 1 ? candidates[0].id : null),
    [candidates],
  );

  // ★複数のときは既定選択を置かない。「1 件目を復元」にしないこと(§4.3-2)——
  //   どれが戻るか分からないまま操作させるのは、選ばせているように見えて選ばせていない。
  const [selectedId, setSelectedId] = useState<number | null>(single);
  useEffect(() => {
    setSelectedId(single);
  }, [single]);

  const canRestore = !busy && selectedId !== null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !next && !busy && onCancel()}
    >
      {/* ★aria-describedby を明示し、最重要の一文(restoreCaution)を読み上げ対象へ含める。
          ★★Radix は既定で AlertDialogDescription だけを読む。restoreCaution を外に置いた
            ままにすると、スクリーンリーダー利用者はフォーカスで辿り着くまでこの一文を
            聞かない——「押す前に伝える」(§4.4)が視覚利用者にしか成立しない状態になる。
          ★表示位置(復元ボタンの直上)は変えていない。読み上げの対象に足しただけである。 */}
      <AlertDialogContent
        data-testid="pre-save-duplicate-dialog"
        aria-describedby="pre-save-duplicate-body pre-save-duplicate-caution"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("trash.preSaveDuplicate.title")}
          </AlertDialogTitle>
          <AlertDialogDescription id="pre-save-duplicate-body">
            {kind === "combo"
              ? t("trash.preSaveDuplicate.bodyCombo", {
                  count: candidates.length,
                })
              : t("trash.preSaveDuplicate.bodySetup", {
                  count: candidates.length,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* ★ラジオ群は AlertDialogDescription の外に置く。中に入れると aria-describedby の
            対象となり、読み上げ時に説明文として一括で読まれる。 */}
        {candidates.length > 1 ? (
          <div className="space-y-2">
            <p
              className="text-sm font-medium"
              data-testid="pre-save-duplicate-select-prompt"
            >
              {t("trash.preSaveDuplicate.selectPrompt")}
            </p>
            <RadioGroup
              value={selectedId === null ? "" : String(selectedId)}
              onValueChange={(v) => setSelectedId(Number(v))}
            >
              {candidates.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem
                    value={String(c.id)}
                    disabled={busy}
                    data-testid={`pre-save-duplicate-option-${c.id}`}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        ) : (
          <p className="text-sm" data-testid="pre-save-duplicate-single">
            {candidates[0]?.label}
          </p>
        )}

        {restoreFailed && (
          <p
            className="text-sm text-red-700"
            data-testid="pre-save-duplicate-restore-failed"
          >
            {t("trash.preSaveDuplicate.restoreFailed")}
          </p>
        )}

        {/* ★★最重要ゲート(§4.4)。復元ボタンの直上に常時置く。
            押した後に「消えました」と伝えるのでは遅い。 */}
        <p
          id="pre-save-duplicate-caution"
          className="text-sm font-medium text-yellow-800"
          data-testid="pre-save-duplicate-restore-caution"
        >
          {t("trash.preSaveDuplicate.restoreCaution")}
        </p>

        <AlertDialogFooter>
          {/* ★復元・新しく作るは素の button である。AlertDialogAction にすると押下で
              必ず閉じてしまい、復元が失敗したときに導線が両方消える(§4.9 #11)。 */}
          <button
            type="button"
            disabled={!canRestore}
            onClick={() => selectedId !== null && onRestore(selectedId)}
            data-testid="pre-save-duplicate-restore"
            className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("trash.preSaveDuplicate.restore")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCreateNew}
            data-testid="pre-save-duplicate-create-new"
            className="inline-flex items-center justify-center rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("trash.preSaveDuplicate.createNew")}
          </button>
          {/* ★キャンセルだけは AlertDialogCancel に揃える(初期フォーカスと Escape の配線が乗る)。
              ★閉じるだけで、フォームの state には触れない(§4.6-2)。 */}
          <AlertDialogCancel
            disabled={busy}
            onClick={onCancel}
            data-testid="pre-save-duplicate-cancel"
          >
            {t("trash.preSaveDuplicate.cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>

        <p
          className="text-xs text-gray-600"
          data-testid="pre-save-duplicate-create-new-caution"
        >
          {t("trash.preSaveDuplicate.createNewCaution")}
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
