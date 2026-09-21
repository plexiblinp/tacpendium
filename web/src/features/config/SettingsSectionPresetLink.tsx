import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function SettingsSectionPresetLink() {
  const { t } = useTranslation();

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.presetLink.heading")}</h2>
      {/* M20-04: /presets が実装されたためリンクを有効化した。 */}
      <Link
        to="/presets"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        data-testid="settings-goto-presets"
      >
        {t("settings.presetLink.goToPresets")}
      </Link>
    </section>
  );
}
