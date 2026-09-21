import { useTranslation } from "react-i18next";

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function Step02Language({ onNext, onPrev }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t("wizard.step2.title")}</h2>
      <p className="text-gray-600 mb-6">{t("wizard.step2.description")}</p>
      <div className="flex flex-col gap-3 mb-8">
        <button
          type="button"
          onClick={() => i18n.changeLanguage("ja")}
          className={`px-4 py-3 border rounded text-left ${i18n.language === "ja" ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
        >
          {t("settings.basic.languageJa")}
        </button>
        <button
          type="button"
          onClick={() => i18n.changeLanguage("en")}
          className={`px-4 py-3 border rounded text-left ${i18n.language === "en" ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
        >
          {t("settings.basic.languageEn")}
        </button>
      </div>
      <div className="flex justify-between">
        <button type="button" onClick={onPrev} className="px-4 py-2 text-gray-600 hover:text-gray-800">
          {t("wizard.prev")}
        </button>
        <button type="button" onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {t("wizard.next")}
        </button>
      </div>
    </div>
  );
}
