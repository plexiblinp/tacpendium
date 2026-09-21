import { useState } from "react";
import type React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Header from "@/components/Header";

import { useCombo, useDeleteCombo } from "@/features/combo/api";
import type { ValidationResult } from "@/features/combo/types";
import ComboDetailHeader from "@/features/combo/components/ComboDetailHeader";
import ComboDetailMetadata from "@/features/combo/components/ComboDetailMetadata";
import ComboDetailRecipe from "@/features/combo/components/ComboDetailRecipe";
import { PromoteToFinalButton } from "@/features/combo/components/PromoteToFinalButton";
import { ValidationDisplay } from "@/features/combo/components/ValidationDisplay";
import { DeleteComboConfirm } from "@/features/combo/components/DeleteComboConfirm";
import { SetupAccordionItem } from "@/features/setup/components/SetupAccordionItem";
import { SetupCandidateList } from "@/features/setup/components/SetupCandidateList";
import { SetplaySuggestionSection } from "@/features/setplay/components/SetplaySuggestionSection";
import { useSetupCandidates } from "@/features/setup/hooks/useSetupCandidates";
import { useSetupAccordionActions } from "@/features/setup/hooks/useSetupAccordionActions";
import { useDeleteSetup } from "@/features/setup/hooks/useDeleteSetup";
import type { SetupSummary } from "@/features/setup/types";
import { useLeaveWithoutConfirm } from "@/features/navigation-guard/useUnsavedChangesGuard";

export default function ComboDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const comboQuery = useCombo(id);
  const deleteMutation = useDeleteCombo();
  const [deleteOpen, setDeleteOpen] = useState(false);
  // 本登録昇格時のバリデーションエラー(400)。アクションボタン行とは別位置(全幅)で表示する。
  const [promoteError, setPromoteError] =
    useState<ValidationResult | null>(null);
  const candidatesQuery = useSetupCandidates(comboQuery.data?.id);
  const accordionActions = useSetupAccordionActions(
    comboQuery.data?.id ?? 0,
    () => comboQuery.refetch(),
  );
  // ★★M23-07 §4.1: セットプレイをゴミ箱へ入れる導線。同フックは M20/M21 期から
  // 実在していたが、これを呼ぶ画面が 1 つも無かった(followup setup-soft-delete-ui-missing)。
  // ⇒ M23-02 が作ったゴミ箱のセットプレイ欄は、画面操作だけでは永久に空のままだった。
  // ★useDeleteCombo(コンボの削除)と取り違えないこと。取り違えると利用者のコンボが消える。
  const deleteSetupMutation = useDeleteSetup();

  // ★★M27-03(combo-detail-back-link-is-hardcoded): 「戻る」の行き先。
  //
  // 着手前は `<Link to="/combos">` のハードコードで、どこから来ても一覧へ着地していた。
  // 「比較 → 詳細 → 戻る → 一覧」で違和感が出る(開発者の手動確認・2026-08-26)。
  //
  // ★★素の `navigate(-1)` は呼ばない(useUnsavedChangesGuard.ts の規約)。番人の
  //   履歴エントリぶんの補正を持つ `leaveBack` を通す。本画面はガードを登録して
  //   いないため補正は 0 枚だが、第 2 の流儀を作らないために同じ入口を使う。
  const { leaveBack } = useLeaveWithoutConfirm();
  const location = useLocation();

  // ★★履歴が無い場合(直接 URL で開いた・別サイトから来た)のフォールバックは
  //   `<Link>` の href そのものである。⇒ 戻り先を二重に書かなくて済み、
  //   中クリック・別タブで開くも従来どおり効く。
  // ★react-router v6 は history.state に {usr, key, idx} を持つ
  //   (NavigationGuardProvider.tsx の前提と同じ)。idx が 0 なら、このタブでの
  //   最初のエントリであり戻り先が無い。
  // ★判定はクリック時に読む。描画時に固めると、同じ画面のまま履歴が伸びたときに古くなる。
  // ★★M27-03 追補: 保存直後に来たときは履歴を戻らない。
  //
  //   保存後の遷移は編集画面を履歴に残したまま行われるため、素直に戻ると
  //   **保存済みのフォームへ再入場する**（開発者の実機確認で報告された経路）。
  //   ⇒ 保存の目印が付いていたら、`<Link>` の href（一覧）へそのまま行かせる。
  //
  // ★履歴から編集画面を消す形は採らなかった。番人が react-router の `idx` を
  //   複製して積むため `history.go` を挟むとルータの位置の勘定が狂い、
  //   `M24-12 (3)` の契約（戻る 2 回で編集画面より前へ抜ける）も壊れる。
  const fromSave = (location.state as { fromSave?: boolean } | null)?.fromSave;

  const handleBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (fromSave) return; // href（/combos）へ素通しする
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      e.preventDefault();
      leaveBack();
    }
  };

  const handleDelete = () => {
    if (!id) return;
    setDeleteOpen(true);
  };

  // ★M23-07 §4.1-3: 消した直後にゴミ箱へ行ける導線をトーストへ置く。
  // ⇒ 「消した → 間違えた → 戻す」が 1 画面で完結する。
  // ★★M31-01(P4M-019): unlinkAlso は削除ダイアログの任意チェック(既定 OFF)。
  //   ON のとき、**この詳細画面のコンボとの紐付けだけ**を同じ操作で外す。
  //   ★外した紐付けは復元しても戻らない。ダイアログの文面がそれを言っている。
  const handleDeleteSetup = (setup: SetupSummary, unlinkAlso: boolean) => {
    deleteSetupMutation.mutate(
      {
        id: setup.id,
        parentComboIds: setup.parentComboIds ?? [],
        ...(unlinkAlso && id ? { unlinkFrom: Number(id) } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t("setup.delete.done"), {
            action: {
              label: t("setup.delete.openTrash"),
              onClick: () => navigate("/trash"),
            },
          });
          comboQuery.refetch();
        },
        onError: (err: unknown) => {
          toast.error(
            t("setup.delete.failed", {
              message: err instanceof Error ? err.message : t("trash.common.unknownError"),
            }),
          );
        },
      },
    );
  };

  const confirmDelete = () => {
    setDeleteOpen(false);
    if (!id) return;
    deleteMutation.mutate(Number(id), {
      onSuccess: () => navigate("/combos"),
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link
            to="/combos"
            onClick={handleBack}
            data-testid="combo-detail-back"
            className="text-sm text-blue-600 hover:underline"
          >
            ← {t("common.back")}
          </Link>
          {comboQuery.data && (
            <div className="flex items-center gap-2">
              <Link
                to={`/combos/${comboQuery.data.id}/edit`}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded"
              >
                {t("common.edit")}
              </Link>
              <Link
                to={`/combos/new?copyFrom=${comboQuery.data.id}`}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded border border-slate-200"
              >
                {t("common.copy")}
              </Link>
              {comboQuery.data.isDraft && (
                <PromoteToFinalButton
                  combo={comboQuery.data}
                  onPromoted={() => {
                    setPromoteError(null);
                    comboQuery.refetch();
                  }}
                  onValidationError={setPromoteError}
                />
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium px-3 py-1.5 rounded border border-red-200"
              >
                {t("common.delete")}
              </button>
            </div>
          )}
        </div>

        {/* 本登録昇格時のバリデーションエラー(バグ #5): ボタン行とは別に全幅で表示する。 */}
        <ValidationDisplay result={promoteError ?? undefined} />


        {comboQuery.isLoading && (
          <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
            {t("common.loading")}
          </div>
        )}
        {comboQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-red-700">
            {t("common.error", {
              message:
                comboQuery.error instanceof Error
                  ? comboQuery.error.message
                  : String(comboQuery.error),
            })}
          </div>
        )}
        {comboQuery.data && (
          <>
            <ComboDetailHeader combo={comboQuery.data} />
            {/* M24-03 §4.4(SM-089): メモの 1 行目をレシピの上に出すため memo を渡す。 */}
            <ComboDetailRecipe
              comboId={comboQuery.data.id}
              memo={comboQuery.data.memo}
            />
            <ComboDetailMetadata combo={comboQuery.data} />

            {/* セットプレイ展開セクション(DES-005 §5.6 item 8) */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {t("comboDetail.setups.heading")}
                </h2>
                <div className="flex gap-2">
                  <Link
                    to={`/combos/${comboQuery.data.id}/setups/new`}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    セットプレイ追加
                  </Link>
                </div>
              </div>

              {comboQuery.data.setups && comboQuery.data.setups.length > 0 ? (
                <div className="space-y-2">
                  {comboQuery.data.setups.map((setup) => (
                    <SetupAccordionItem
                      key={setup.id}
                      setup={setup}
                      onUnlink={accordionActions.handleUnlink}
                      isDeleting={accordionActions.isDeleting}
                      // ★M23-07 §4.1: 論理削除(ゴミ箱へ入れる)。紐付け解除とは別物。
                      onDelete={handleDeleteSetup}
                      isSoftDeleting={deleteSetupMutation.isPending}
                      // M19-03: 成立条件は「コンボ × セットプレイの組」に紐づく。
                      // 項目10 は comboId と setupId が両方揃う唯一の面(§4.4.1)。
                      comboId={comboQuery.data.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t("comboDetail.setups.placeholder")}
                </p>
              )}

            </section>

            {/* ★★M24-05 §4.1(CO-002): 紐付けの入口を候補表示へ一本化した。
                「既存から紐付け」ボタンと LinkExistingSetupModal は撤去済みである——
                実査で両者が同一 API・同一 SQL・同一 queryKey を見ており、出る候補が
                完全に同一であることを確かめたうえで消した(指示書 §3.3-2 のゲート)。
                ★消した理由は重複だけではない。KA が一致しないセットプレイを紐付け
                られること自体がヒューマンエラーの元である(開発者裁定 D-588)。
                ★★0 件でも出す(length > 0 の条件を外した)。消したままだと紐付けの面が
                画面から丸ごと消え、「機能が無くなった」と読まれる。 */}
            {candidatesQuery.data && (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <SetupCandidateList
                  parentComboId={comboQuery.data!.id}
                  candidates={candidatesQuery.data}
                />
              </section>
            )}

            {/* M19-01: セットプレイ自動提案(単一コンボ候補面に相乗り)。既存 FR011 候補は不変。 */}
            <SetplaySuggestionSection
              comboId={comboQuery.data.id}
              characterId={comboQuery.data.characterId}
              knockdownAdvantage={comboQuery.data.knockdownAdvantage ?? null}
              onAdopted={() => comboQuery.refetch()}
            />

          </>
        )}
      </div>

      <DeleteComboConfirm
        open={deleteOpen}
        message={t("comboDetail.deleteConfirm")}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
      />
    </main>
  );
}
