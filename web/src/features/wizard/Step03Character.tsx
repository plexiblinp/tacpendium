import { useTranslation } from "react-i18next";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";

interface Props {
  characterId: number;
  onChange: (id: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export default function Step03Character({ characterId, onChange, onNext, onPrev, onSkip }: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t("wizard.step3.title")}</h2>
      <p className="text-gray-600 mb-2">{t("wizard.step3.description")}</p>
      <p className="text-sm text-gray-400 mb-6">{t("wizard.step3.skipHint")}</p>
      <div className="mb-8">
        <CharacterSelector selectedCharacterId={characterId} onChange={onChange} />
      </div>
      <div className="flex justify-between">
        <button type="button" onClick={onPrev} className="px-4 py-2 text-gray-600 hover:text-gray-800">
          {t("wizard.prev")}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onSkip} className="px-4 py-2 text-gray-400 hover:text-gray-600">
            {t("wizard.skip")}
          </button>
          <button type="button" onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            {t("wizard.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
