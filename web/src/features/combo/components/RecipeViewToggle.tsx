// レシピの全文表示モードのトグル(M24-03 §4.1・CHANGE-134)。
//
// ★★トグルは 1 つしか作らない。トグルを置く面(一覧・マイコンボ・詳細・比較・
//   比較の追加モーダル)は すべて本部品を置き、useRecipeFullView の同じ値を切り替える
//   (指示書 §4.1・E-76)。★【M24-07 で是正】旧記述「4 面」はマイコンボが漏れていた。
//   ★面の数を書かず列挙で持つ——数だけを書くと、面が増えたときに同じ失効が起きる。
//   「面ごとの既定」はトグルとは別の仕組み(useRecipeFullView の surfaceDefault)である。

import { useTranslation } from "react-i18next";
import { List, TextQuote } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRecipeFullView } from "../hooks/useRecipeFullView";

interface RecipeViewToggleProps {
  /** この面での既定(利用者が一度も切り替えていないときに効く)。 */
  surfaceDefault: boolean;
  className?: string;
}

export default function RecipeViewToggle({
  surfaceDefault,
  className,
}: RecipeViewToggleProps) {
  const { t } = useTranslation();
  const { fullView, toggle } = useRecipeFullView(surfaceDefault);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fullView}
      data-testid="recipe-view-toggle"
      title={t("comboCommon.recipeView.hint")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors",
        fullView
          ? "border-blue-300 bg-blue-50 font-semibold text-blue-700"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
        className,
      )}
    >
      {fullView ? <List size={14} /> : <TextQuote size={14} />}
      {t("comboCommon.recipeView.label")}
    </button>
  );
}
