import { useTranslation } from "react-i18next";

interface Props {
  onNext: () => void;
}

export default function Step01Welcome({ onNext }: Props) {
  const { t } = useTranslation();

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">{t("wizard.step1.title")}</h2>
      <p className="text-gray-600 mb-8">{t("wizard.step1.description")}</p>
      <button
        type="button"
        onClick={onNext}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {t("wizard.next")}
      </button>
    </div>
  );
}
