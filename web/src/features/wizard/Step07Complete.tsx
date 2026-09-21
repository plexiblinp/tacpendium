import { useTranslation } from "react-i18next";

interface Props {
  onFinish: () => void;
  isPending: boolean;
}

export default function Step07Complete({ onFinish, isPending }: Props) {
  const { t } = useTranslation();

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">{t("wizard.step7.title")}</h2>
      <p className="text-gray-600 mb-8">{t("wizard.step7.description")}</p>
      <button
        type="button"
        onClick={onFinish}
        disabled={isPending}
        className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? t("common.loading") : t("wizard.step7.finish")}
      </button>
    </div>
  );
}
