import { useTranslation } from "react-i18next";
import type { ComboDetail } from "../types";
import { formatStarterStatus, formatDamage } from "../utils";

interface CompareTargetListProps {
  combos: (ComboDetail | undefined)[];
  errors: (Error | null)[];
  loadings: boolean[];
  ids: number[];
  onRemove: (id: number) => void;
}

export default function CompareTargetList({
  combos,
  errors,
  loadings,
  ids,
  onRemove,
}: CompareTargetListProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {ids.map((id, index) => {
        const combo = combos[index];
        const hasError = !!errors[index];
        const isLoading = loadings[index];

        return (
          <div
            key={id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              hasError
                ? "border-red-200 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="min-w-0">
              {hasError ? (
                <span className="text-red-500 text-xs">
                  #{id} {t("compare.fetchErrorPartial")}
                </span>
              ) : isLoading ? (
                <div className="space-y-1">
                  <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                </div>
              ) : combo ? (
                <>
                  <div className="font-medium text-slate-800 truncate sm:max-w-[200px]">
                    {formatStarterStatus(combo, t)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("compare.row.damage")}: {formatDamage(combo.damage)}
                  </div>
                </>
              ) : (
                <span className="text-slate-400">#{id}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="text-slate-400 hover:text-red-500 flex-shrink-0"
              aria-label={t("compare.removeCombo")}
              title={t("compare.removeCombo")}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
