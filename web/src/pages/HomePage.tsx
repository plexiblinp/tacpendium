import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRecentCombos } from "@/hooks/useRecentCombos";
import DataMigrationBanner from "@/features/data-migration/DataMigrationBanner";
import GameUpdateBanner from "@/features/game-update/GameUpdateBanner";
import OnboardingBanner from "@/features/onboarding/OnboardingBanner";

export default function HomePage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useRecentCombos();

  // M20-04: /presets を実装したため有効化した。これで無効な行が 1 つも
  // 無くなったため、disabled 分岐(span + cursor-not-allowed + tooltip)は
  // 到達不能になり削除した。再び無効な行が要るときは Git 履歴から戻せる。
  const mainButtons = [
    { label: t("home.combos"), to: "/combos" },
    { label: t("home.myCombos"), to: "/mycombo" },
    { label: t("home.newCombo"), to: "/combos/new" },
    { label: t("home.compare"), to: "/compare" },
    { label: t("home.presets"), to: "/presets" },
    { label: t("home.settings"), to: "/settings" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="bg-white border-b border-slate-200 px-4 py-6 text-center">
        <h1 className="text-2xl font-bold text-blue-600">{t("app.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("home.subtitle")}</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <DataMigrationBanner />
        {/* ★M28-02c: ゲーム更新の告知。★ComboListPage にも同じものを置いてある
            (640px 以上では本ページが描画されないため。片方だけにしないこと)。 */}
        <GameUpdateBanner />
        <OnboardingBanner />

        <section>
          <div className="flex flex-col gap-3">
            {mainButtons.map((btn) => (
              <Link
                key={btn.to}
                to={btn.to}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-4 text-center font-medium text-slate-800 hover:bg-blue-50 hover:border-blue-300 shadow-sm"
              >
                {btn.label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            {t("home.recentCombos")}
          </h2>

          {isLoading && (
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-6 text-center text-slate-500">
              {t("common.loading")}
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {t("home.recentCombosError")}
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-6 text-center text-slate-500 text-sm">
              {t("home.recentCombosEmpty")}
            </div>
          )}

          {data && data.items.length > 0 && (
            <ul className="space-y-2">
              {data.items.map((combo) => (
                <li key={combo.id}>
                  <Link
                    to={`/combos/${combo.id}`}
                    className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:bg-blue-50 hover:border-blue-300"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-800">
                          #{combo.id}
                        </span>
                        <span className="ml-2 text-sm text-slate-600">
                          {combo.defaultRecipe || combo.starterMoveNameJa || combo.starterMoveCode}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(combo.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {combo.damage != null && (
                      <div className="text-xs text-slate-500 mt-1">
                        {t("comboDetail.metadata.damage")}: {combo.damage}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
