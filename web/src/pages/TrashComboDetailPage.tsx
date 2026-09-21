// ゴミ箱の行から開く読み取り専用のコンボ詳細(M23-07 §4.2。DES-005 §5.15)。
//
// ★★ComboDetailPage を readOnly モードで流用していない。同ページは書き込み導線が
// 7 か所の JSX に散在し、mutation フックを 3 本無条件に生成する。条件分岐で潰すと
// 生きたコンボの画面の全編集経路が条件付きになり、退行の面がそこまで広がる。
// ⇒ 表示層(ComboDetailHeader / ComboDetailMetadata)だけを再利用し、ページは分けた。
//
// ★出さないもの: 編集 / コピー / 削除 / セットプレイの追加・編集・紐付け / タグ編集。
// ★出すもの: 復元 / 完全削除 / ゴミ箱へ戻る。
// ★押せないボタンを並べるのではなく、出さない(§4.2-3)。
//
// ★レシピは ComboDetailRecipe を使わない。同コンポーネントは
// GET /api/combos/:id/recipe を自分で引くが、その経路は削除済み行を締め出す
// (M23-03 が combos 側と setups 側を「2 つで 1 組」として塞いだ)。
// ⇒ 読み取り専用取得の応答に載った defaultRecipe をそのまま描画する。

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import Header from "@/components/Header";
import ComboDetailHeader from "@/features/combo/components/ComboDetailHeader";
import ComboDetailMetadata from "@/features/combo/components/ComboDetailMetadata";
import { PermanentDeleteConfirm } from "@/features/combo/components/PermanentDeleteConfirm";
import { useDeletedCombo } from "@/features/combo/hooks/useDeletedCombo";
import { useRestoreCombo } from "@/features/combo/hooks/useRestoreCombo";
import { usePermanentDelete } from "@/features/combo/hooks/usePermanentDelete";
import { RECIPE_EMPTY_LABEL_KEY } from "@/features/combo/recipeDisplay";
import { formatRestoreWarnings } from "@/features/trash/restoreWarnings";

export default function TrashComboDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const comboQuery = useDeletedCombo(id);
  // ★★M23-07 §5.1-7 の裁定により、本経路は削除済みでない行も返す。
  //   ⇒ 画面側で見分けないと、生きたコンボに対して「ゴミ箱にあるコンボです」と
  //   出し、復元・完全削除まで並ぶ。★到達経路は実在する——読み取り専用詳細から
  //   復元すると /trash へ遷移するが、ブラウザバックで同じ URL へ戻れる。
  //   そのときコンボはもう生きている。
  //   ★データは壊れない(復元も完全削除もサーバ側で弾かれる)。壊れるのは文面である。
  const isInTrash = comboQuery.data != null && comboQuery.data.deletedAt != null;
  const restoreMutation = useRestoreCombo();
  const permanentDeleteMutation = usePermanentDelete();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!id) return;
    try {
      setActionError(null);
      const restored = await restoreMutation.mutateAsync(Number(id));
      // 一覧側(TrashListRow)と同じ見せ方に揃える。警告があれば 1 枚に畳む。
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
      navigate("/trash");
    } catch (err: unknown) {
      setActionError(
        t("trash.combo.restoreError", {
          message: err instanceof Error ? err.message : t("trash.common.unknownError"),
        }),
      );
    }
  };

  const handlePermanentDelete = async () => {
    if (!id) return;
    try {
      setActionError(null);
      await permanentDeleteMutation.mutateAsync(Number(id));
      setConfirmOpen(false);
      navigate("/trash");
    } catch (err: unknown) {
      setConfirmOpen(false);
      setActionError(
        t("trash.combo.permanentDeleteError", {
          message: err instanceof Error ? err.message : t("trash.common.unknownError"),
        }),
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/trash" className="text-sm text-blue-600 hover:underline">
            ← {t("trash.detail.backToTrash")}
          </Link>
          {isInTrash && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t("trash.combo.restore")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={permanentDeleteMutation.isPending}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {t("trash.combo.permanentDelete")}
              </button>
            </div>
          )}
        </div>

        {/* ★読み取り専用であることを画面でも伝える。URL(/trash/combos/:id)だけに
            頼ると、リンクを踏んだ利用者には編集できない理由が分からない。
            ★★取得できてから出す。存在しない id やロード中に「ゴミ箱にあるコンボです」
            と断言しない。 */}
        {isInTrash && (
          <div
            role="note"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          >
            {t("trash.detail.readOnlyNotice")}
          </div>
        )}

        {/* ★生きたコンボをこの URL で開いたとき。ゴミ箱の文面を出さず、通常の詳細へ導く。 */}
        {comboQuery.data && !isInTrash && (
          <div
            role="note"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            {t("trash.detail.notInTrashNotice")}{" "}
            <Link
              to={`/combos/${comboQuery.data.id}`}
              className="text-blue-600 hover:underline"
            >
              {t("trash.detail.openNormalDetail")}
            </Link>
          </div>
        )}

        {actionError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {comboQuery.isLoading && (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
            {t("trash.loading")}
          </div>
        )}
        {comboQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
            {t("trash.detail.loadError")}
          </div>
        )}

        {comboQuery.data && (
          <>
            <ComboDetailHeader combo={comboQuery.data} />

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold">
                {t("comboDetail.recipe.heading")}
              </h2>
              {/* ★一覧のルート列は M23-06 が消したが、詳細ではレシピを出す。
                  矛盾ではない——一覧は識別、詳細は確認であり目的が違う(§1.3)。
                  完全削除は不可逆であるため、押す前に中身を見せる。
                  ★解決に失敗した場合は空文字で来る(サーバ側の縮退)。欄だけを
                  空にし、詳細そのものは出す。
                  ★★M29-01: 文言を他の 14 面と同じ `comboCommon.recipeEmpty` へ寄せた。
                    旧文言「レシピを表示できませんでした」は**起きていない失敗を
                    主張していた**——この分岐は `!defaultRecipe` であり、
                    ステップが 0 件のコンボでも真になるためである。 */}
              {comboQuery.data.defaultRecipe ? (
                <p className="whitespace-pre-wrap break-words font-mono text-base">
                  {comboQuery.data.defaultRecipe}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  {t(RECIPE_EMPTY_LABEL_KEY)}
                </p>
              )}
            </section>

            <ComboDetailMetadata combo={comboQuery.data} inTrash />
          </>
        )}
      </div>

      <PermanentDeleteConfirm
        open={confirmOpen}
        count={1}
        onConfirm={handlePermanentDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      />
    </main>
  );
}
