import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import RecipeText from "@/features/combo/components/RecipeText";
import { queryKeys } from "@/lib/query-keys";

import { useCreateSetupLink } from "../hooks/useSetupLinks";
import type { SetupSummary } from "../types";

interface Props {
  parentComboId: number;
  candidates: SetupSummary[];
}

export function SetupCandidateList({ parentComboId, candidates }: Props) {
  const { t } = useTranslation();
  const linkMutation = useCreateSetupLink();
  const queryClient = useQueryClient();

  const handleLink = (setupId: number) => {
    linkMutation.mutate(
      { comboId: parentComboId, setupId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.setupCandidates.byCombo(parentComboId),
          });
        },
      },
    );
  };

  return (
    // ★★M24-05 §4.1: 候補 0 件でも本セクションを出す(D-588 で確定)。
    //   従来はセクションごと非表示だった(DES-005 §5.6 項目11)。「既存から紐付け」を
    //   撤去した以上、0 件で何も出さないと画面から紐付けの面が丸ごと消え、
    //   利用者には「機能が無くなった」と読める。⇒ 空でも見出しと文言を出す。
    <div data-testid="setup-candidates">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        {t("comboDetail.setups.candidatesHeading", {
          count: candidates.length,
        })}
      </h3>
      {candidates.length === 0 && (
        <p className="text-sm text-slate-500" data-testid="setup-candidates-empty">
          {t("comboDetail.setups.candidatesEmpty")}
        </p>
      )}
      <ul className="space-y-2">
        {candidates.map((setup) => {
          const displayName =
            setup.name ?? t("setup.candidate.fallbackName", { id: setup.id });
          return (
            <li
              key={setup.id}
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{displayName}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {t("setup.candidate.stepCount", { stepCount: setup.stepCount })}
                </span>
                {/* ★M24-05 §4.2: 共通部品 RecipeText を通す(手書きの
                    `|| "（レシピなし）"` を残さない)。★fullView は面ごとの固定値で
                    渡し、共有トグル(recipe-full-view-v1)へは繋がない——同キーは
                    DES-005 が「コンボ側の面が 1 つの値を共有する」と定めた鍵であり、
                    読み手を増やすと台帳と設計書の変更を伴うため(§4.2 は表示の統一で
                    あって、トグルの拡張ではない)。候補行は 1 行に収める面なので false。 */}
                <RecipeText
                  recipe={setup.defaultRecipe}
                  fullView={false}
                  className="ml-2 inline-block max-w-[24rem] align-bottom text-xs text-slate-400"
                />
              </div>
              <button
                type="button"
                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                onClick={() => handleLink(setup.id)}
                disabled={linkMutation.isPending}
              >
                {t("setup.candidate.linkToThisCombo")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
