import { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Header from "@/components/Header";

import { MAX_COMPARE_COMBOS } from "@/constants/compare";
import { useCompareCombos } from "@/features/combo/hooks/useCompareCombos";
import CompareTable from "@/features/combo/components/CompareTable";
import CompareTargetList from "@/features/combo/components/CompareTargetList";
import AddComboToCompareModal from "@/features/combo/components/AddComboToCompareModal";
import RecipeViewToggle from "@/features/combo/components/RecipeViewToggle";
import { useResolvedCharacterId } from "@/features/combo/hooks/useResolvedCharacterId";

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export default function ComparePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);

  const ids = useMemo(() => {
    return parseIds(searchParams.get("ids")).slice(0, MAX_COMPARE_COMBOS);
  }, [searchParams]);

  useEffect(() => {
    const parsed = parseIds(searchParams.get("ids"));
    if (parsed.length > MAX_COMPARE_COMBOS) {
      toast.info(t("compare.maxExceeded", { max: MAX_COMPARE_COMBOS }));
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("ids", parsed.slice(0, MAX_COMPARE_COMBOS).join(","));
          return p;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams, t]);

  const queries = useCompareCombos(ids);

  const combos = queries.map((q) => q.data);
  const errors = queries.map((q) => (q.error as Error) ?? null);
  const loadings = queries.map((q) => q.isLoading);

  const addComboId = useCallback(
    (id: number) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        const current = parseIds(p.get("ids"));
        if (current.includes(id) || current.length >= MAX_COMPARE_COMBOS)
          return p;
        p.set("ids", [...current, id].join(","));
        return p;
      });
      setModalOpen(false);
    },
    [setSearchParams],
  );

  const removeComboId = useCallback(
    (id: number) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        const current = parseIds(p.get("ids")).filter((x) => x !== id);
        if (current.length === 0) {
          p.delete("ids");
        } else {
          p.set("ids", current.join(","));
        }
        return p;
      });
    },
    [setSearchParams],
  );

  const isAtMax = ids.length >= MAX_COMPARE_COMBOS;

  // コンボ追加モーダルの既定キャラ(M10-02)。比較画面はページレベルのキャラ選択を
  // 持たないため、比較リスト先頭コンボのキャラを文脈とする。
  // ★空のときの落ち先だけを既定キャラの解決順(M24-01 §4.1-2)へ差し替えた。
  //   先頭コンボのキャラを優先する既存の文脈ロジックは 1 行も変えていない。
  const resolvedCharacterId = useResolvedCharacterId();
  const defaultCharacterId =
    combos.find((c) => c != null)?.characterId ?? resolvedCharacterId;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-slate-800">
            {t("compare.title")}
          </h1>
          <div className="flex items-center gap-2">
            {/* M24-03 §4.1: レシピの全文表示モード。コンボ側の面に共通の 1 つの値を切り替える。 */}
            <RecipeViewToggle surfaceDefault={false} />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={isAtMax}
              className={`text-sm font-medium px-4 py-2 rounded shadow-sm ${
                isAtMax
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              title={
                isAtMax ? t("compare.maxItems", { max: MAX_COMPARE_COMBOS }) : undefined
              }
            >
              {t("compare.addCombo")}
            </button>
          </div>
        </div>

        {ids.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg px-6 py-16 text-center">
            <p className="text-slate-500 mb-4">{t("compare.empty")}</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded shadow-sm"
            >
              {t("compare.addCombo")}
            </button>
          </div>
        ) : (
          <>
            <CompareTargetList
              combos={combos}
              errors={errors}
              loadings={loadings}
              ids={ids}
              onRemove={removeComboId}
            />

            <CompareTable
              combos={combos}
              errors={errors}
              loadings={loadings}
              ids={ids}
              onRemove={removeComboId}
            />
          </>
        )}

        <div className="mt-6">
          <Link
            to="/combos"
            className="text-sm text-blue-600 hover:underline"
          >
            ← {t("compare.backToList")}
          </Link>
        </div>
      </div>

      <AddComboToCompareModal
        open={modalOpen}
        currentIds={ids}
        defaultCharacterId={defaultCharacterId}
        onAdd={addComboId}
        onOpenChange={(open) => { if (!open) setModalOpen(false); }}
      />
    </main>
  );
}
