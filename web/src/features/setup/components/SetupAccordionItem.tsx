import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import RecipeText from "@/features/combo/components/RecipeText";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { SetupSummary } from "../types";
import { SetupResultGrid } from "./SetupResultGrid";
import { SetupResultEditor } from "./SetupResultEditor";

interface Props {
  setup: SetupSummary;
  onUnlink: (setupId: number) => void;
  isDeleting?: boolean;
  // ★M23-07 §4.1: セットプレイをゴミ箱へ入れる導線。opt-in である。
  // 未指定なら削除ボタンを出さない——本コンポーネントが別の面へ相乗りしたときに、
  // 破壊的な操作が勝手に付いてこないようにするためである。
  // ★★M31-01(P4M-019): 第 2 引数は「このコンボとの紐付けも外すか」。
  //   既定は false であり、着手前と同じ挙動である。
  onDelete?: (setup: SetupSummary, unlinkAlso: boolean) => void;
  isSoftDeleting?: boolean;
  onEdit?: () => void;
  // M19-03: 成立条件は「コンボ × セットプレイの組」に紐づくため comboId が要る。
  // 未指定なら成立条件の表示・編集導線を出さない(comboId を持たない画面での相乗りを防ぐ)。
  comboId?: number;
  // 成立条件の更新後の通知(任意)。画面の再取得は combo クエリの無効化で行われるため、
  // 親がここで refetch を重ねる必要はない(重ねると同一キーの GET が競合する)。
  onResultsChanged?: () => void;
}

// 注: コンポーネント名は SetupAccordionItem のままだが、M12-02 / C-13 で
// アコーディオン(展開機構)は撤去済み。レシピ等を常時表示し、行クリックで
// 編集/詳細へ遷移する。名称は ComboDetailPage / 既存テストとの整合のため据え置き。
export function SetupAccordionItem({
  setup,
  onUnlink,
  isDeleting = false,
  onDelete,
  isSoftDeleting = false,
  onEdit,
  comboId,
  onResultsChanged,
}: Props) {
  const { t } = useTranslation();
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  // ★M23-07 §4.1-2: 論理削除は取り消せる(ゴミ箱から戻せる)が、それでも確認を挟む。
  // セットプレイは複数のコンボから共有されうるため、消すと他のコンボからも見えなくなる。
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // ★★M31-01(P4M-019): 「紐付けも一緒に外す」の任意チェック。
  //   ★既定は OFF である——ON を既定にすると、復元しても戻らない操作が
  //     既定になってしまう(削除は論理削除であり、復元が前提の操作である)。
  const [unlinkAlso, setUnlinkAlso] = useState(false);
  // M19-03: 成立条件の編集はインライン展開。行クリックでの遷移とは別操作にする。
  const [editingResults, setEditingResults] = useState(false);
  const navigate = useNavigate();

  const handleRowClick = () => {
    if (onEdit) {
      onEdit();
    } else {
      navigate(`/setups/${setup.id}`);
    }
  };

  const handleUnlinkConfirm = () => {
    setShowUnlinkConfirm(false);
    onUnlink(setup.id);
  };

  // ★★onDelete はセットプレイの論理削除である。onUnlink(紐付け解除)と混ぜないこと。
  // ★呼び先を取り違えるとコンボ側の API を叩きうるため、テスト(§5.2-1)で固定してある。
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.(setup, unlinkAlso);
    // ★次に開いたときへ持ち越さない。破壊的な選択を既定として残さない。
    setUnlinkAlso(false);
  };

  // ★M23-07 レビュー低-1 / 低-2: 直書きの日本語フォールバックを i18n キーへ移した。
  //   本サブが setup.delete.confirmBody へこの値を差し込む露出面を作ったため、
  //   直書きのままだと en ロケールで日本語が混ざる。
  // ★`??` ではなく `?.trim() ||` にする。`??` は空文字を拾わず「「」をゴミ箱へ移動
  //   します」になる。TrashSetupListRow が既に `?.trim() ||` を使っており、
  //   同じ値の扱いが 2 画面で割れていた。
  const displayName = setup.name?.trim() || t("setup.unnamed", { id: setup.id });

  return (
    <div className="rounded border border-gray-200 bg-white">
      {/* C-13: 展開機構(▶/▼)を撤去。行クリックでの編集/詳細遷移は維持する。 */}
      <div
        role="button"
        tabIndex={0}
        // M19-03 実機確認: 成立条件で情報量が増え、行クリックで編集画面へ遷移することが
        // 分かりにくくなった(文字色が黒でリンクに見えない)。リンク色＋hover 下線にする。
        // 遷移そのものの挙動は不変。
        className="cursor-pointer px-4 py-3 text-sm font-medium text-blue-700 hover:bg-gray-50 hover:underline"
        onClick={handleRowClick}
        onKeyDown={(e) => e.key === "Enter" && handleRowClick()}
      >
        {displayName}
        <span className="ml-2 text-xs text-gray-500">
          {t("setup.item.stepCount", { stepCount: setup.stepCount })}
        </span>
      </div>

      {/* C-13: 説明・レシピ・紐付け解除を常時表示(従来はアコーディオン展開時のみ)。 */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="space-y-3">
          {setup.description && (
            <p className="text-sm text-gray-600">{setup.description}</p>
          )}
          <div className="rounded bg-gray-50 px-3 py-2">
            <p className="mb-1 text-xs text-gray-500">{t("setup.item.recipeHeading")}</p>
            {/* ★M24-05 §4.2: 共通部品 RecipeText を通す。
                ★★fullView は固定 true である——DES-005 §5.6 項目10 が
                「各セットプレイのレシピを全文〔複数行折返し〕表示」と定めており、
                省略側へ倒すと設計書に反する。★共有トグル(recipe-full-view-v1)へは
                繋がない。同キーは「コンボ側の面が 1 つの値を共有する」ものであり、
                読み手を増やすには台帳と DES-005 の変更が要る(§4.2 は表示の統一で
                あって、トグルの拡張ではない)。 */}
            <RecipeText
              recipe={setup.defaultRecipe}
              fullView
              className="break-words font-mono text-sm text-gray-800"
            />
          </div>
          {/* M19-03: 成立条件の表示(全 4 セル未検証なら要素自体が出ない)。
              既存のレシピ表示・紐付け解除の間に追加するのみで、面は再設計しない。 */}
          {comboId !== undefined && !editingResults && (
            <SetupResultGrid results={setup.results} />
          )}
          {comboId !== undefined && editingResults && (
            <SetupResultEditor
              comboId={comboId}
              setupId={setup.id}
              results={setup.results}
              onChanged={() => onResultsChanged?.()}
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              onClick={(e) => { e.stopPropagation(); setShowUnlinkConfirm(true); }}
              disabled={isDeleting}
            >
              {t("setup.item.unlink")}
            </button>
            {/* 行クリック(セットプレイ編集へ遷移)とは区別できる別操作にする(§4.4.3)。 */}
            {comboId !== undefined && (
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); setEditingResults((v) => !v); }}
                data-testid="setup-result-edit-toggle"
                aria-expanded={editingResults}
              >
                {editingResults ? t("setupResult.editDone") : t("setupResult.editStart")}
              </button>
            )}
            {/* ★★M23-07 §4.1-1: セットプレイをゴミ箱へ入れる導線。
                ★「紐付け解除」とは別物である——解除はこのコンボから外すだけで
                セットプレイ自体は残るが、削除はゴミ箱へ入れて全コンボから見えなくする。
                ⇒ 文言で区別し、区切り線で隣り合わせにしない。
                ★コンボの削除はページ最上部の操作バーに在り、面が物理的に離れている
                (「セットプレイを消したつもりがコンボが消えた」を起こさないため)。 */}
            {onDelete && (
              <button
                type="button"
                className="ml-auto rounded border border-red-600 bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-40"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                disabled={isSoftDeleting}
                data-testid="setup-soft-delete"
              >
                {t("setup.delete.action")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ★M23-07 §4.1-2: 参照しているコンボの件数を出す。材料は parentComboIds に
          既に在り、新しくデータを取りに行かない。 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("setup.delete.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* ★parentComboIds が欠けている面から呼ばれた場合、件数を断言しない。
                  「0 件のコンボすべてから見えなくなります」は日本語として成立しない。 */}
              {setup.parentComboIds
                ? t("setup.delete.confirmBody", {
                    name: displayName,
                    count: setup.parentComboIds.length,
                  })
                : t("setup.delete.confirmBodyUnknownCount", { name: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* ★★M31-01(P4M-019): 「このコンボとの紐付けも一緒に外す」の任意チェック。
              逐語＝「セットプレイ削除時にコンボとの紐づきを一緒に外す方法をつけたい」
              (phase4-memo.txt:63)。

              ★★警告文は飾りではない——削除は**論理削除**であり、M23-02(D-483/D-484)は
                「復元で紐付けが戻る」ようにするため論理削除時に combo_setups を残す形へ
                変えた。⇒ ここで外したぶんは、その復元の対象から外れる。
              ★comboId を持たない面では出さない(どのコンボとの紐付けか決まらないため)。 */}
          {comboId !== undefined && (
            <label
              className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm"
              data-testid="setup-delete-unlink-also"
            >
              <Checkbox
                checked={unlinkAlso}
                onCheckedChange={(v) => setUnlinkAlso(v === true)}
                className="mt-0.5"
                aria-label={t("setup.delete.unlinkAlsoLabel")}
              />
              <span>
                <span className="block">{t("setup.delete.unlinkAlsoLabel")}</span>
                <span className="mt-1 block text-xs text-amber-700">
                  {t("setup.delete.unlinkAlsoWarning")}
                </span>
              </span>
            </label>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("setup.delete.confirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("setup.delete.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("setup.item.unlinkConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("setup.item.unlinkConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("setup.item.unlinkConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlinkConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("setup.item.unlinkConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
