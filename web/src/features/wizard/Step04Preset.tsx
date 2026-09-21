import { useTranslation } from "react-i18next";
import PresetSwitcher from "@/features/combo/components/PresetSwitcher";
import { usePresets } from "@/features/preset/api";

interface Props {
  presetId: number;
  onChange: (id: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step04Preset({ presetId, onChange, onNext, onPrev }: Props) {
  const { t } = useTranslation();
  const { data: presets } = usePresets();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t("wizard.step4.title")}</h2>
      <p className="text-gray-600 mb-2">{t("wizard.step4.description")}</p>
      <p className="text-sm text-gray-400 mb-6">{t("wizard.step4.skipHint")}</p>
      <div className="mb-8">
        <PresetSwitcher
          presets={presets ?? []}
          selectedId={presetId}
          onChange={onChange}
        />
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
