// コンボ詳細画面のレシピ表示。プリセット切替 UI とレシピ本体を含む。
// プリセット選択時は GET /api/combos/:id/recipe?preset_id=X を叩く。
// 取得できないプリセットは notation サービス側でフォールバック処理(SUPP-001 §3.4)。

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useComboRecipe } from "../api";
import { usePresets } from "@/features/preset/api";
import { BUILTIN_PRESET_CODES } from "@/features/preset/types";
import { useRecipeFullView } from "../hooks/useRecipeFullView";
import PresetSwitcher from "./PresetSwitcher";
import RecipeText, { MemoFirstLine } from "./RecipeText";
import RecipeViewToggle from "./RecipeViewToggle";

interface ComboDetailRecipeProps {
  comboId: number;
  // M24-03 §4.4(SM-089): メモの 1 行目をレシピの上に薄く出す。
  // ★本コンポーネントは comboId しか持たないため、呼び手(ComboDetailPage)が渡す。
  memo?: string;
}

export default function ComboDetailRecipe({
  comboId,
  memo,
}: ComboDetailRecipeProps) {
  const { t } = useTranslation();
  // M24-03 §4.1: ★詳細だけ「全文表示」を既定にする(SM-022 の要求は詳細で縦に読みたい)。
  // ★これは「面ごとの既定」であって 2 つ目のトグルではない——利用者が一度でも
  //   切り替えれば、その値が購読している面すべてを支配する(useRecipeFullView の注記)。
  const { fullView } = useRecipeFullView(true);
  const presetsQuery = usePresets();
  const [selectedPresetId, setSelectedPresetId] = useState<number | undefined>(
    undefined,
  );

  // 初期選択: official_ja_move を優先(M1-02 でエイリアス投入済み)。
  // なければプリセットの先頭を選ぶ。
  useEffect(() => {
    if (selectedPresetId !== undefined) return;
    if (!presetsQuery.data || presetsQuery.data.length === 0) return;
    const officialJa = presetsQuery.data.find(
      (p) => p.code === BUILTIN_PRESET_CODES.officialJaMove,
    );
    setSelectedPresetId(officialJa?.id ?? presetsQuery.data[0].id);
  }, [presetsQuery.data, selectedPresetId]);

  const recipeQuery = useComboRecipe(comboId, selectedPresetId);

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">
          {t("comboDetail.recipe.heading")}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <RecipeViewToggle surfaceDefault={true} />
          {presetsQuery.data && (
            <PresetSwitcher
              presets={presetsQuery.data}
              selectedId={selectedPresetId}
              onChange={setSelectedPresetId}
            />
          )}
        </div>
      </div>

      {recipeQuery.isLoading && (
        <p className="text-slate-500 text-sm">
          {t("comboDetail.recipe.loading")}
        </p>
      )}
      {recipeQuery.isError && (
        <p className="text-red-600 text-sm">
          {t("common.error", {
            message:
              recipeQuery.error instanceof Error
                ? recipeQuery.error.message
                : String(recipeQuery.error),
          })}
        </p>
      )}
      {recipeQuery.data && (
        <>
          <MemoFirstLine memo={memo} className="mb-2" />
          <RecipeText
            recipe={recipeQuery.data.text}
            fullView={fullView}
            className="font-mono text-base"
            compactClassName="whitespace-pre-wrap break-words"
          />
        </>
      )}
      <p className="text-xs text-slate-400 mt-2">
        {t("comboDetail.recipe.fallbackHint")}
      </p>
    </section>
  );
}
