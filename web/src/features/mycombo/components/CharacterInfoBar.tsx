import { useTranslation } from "react-i18next";

import { useCharacterName } from "@/features/character/hooks/useCharacters";
import type { MyComboStatusCounts } from "../hooks/useMyComboStatusCounts";

interface CharacterInfoBarProps {
  characterId: number;
  statusCounts: MyComboStatusCounts;
}

export default function CharacterInfoBar({
  characterId,
  statusCounts,
}: CharacterInfoBarProps) {
  const { t } = useTranslation();
  const characterName = useCharacterName(characterId);
  const initial = characterName ? characterName.charAt(0) : "?";
  const total = statusCounts.inUse + statusCounts.practicing + statusCounts.reduced;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-lg font-bold text-emerald-700">
          {initial}
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-900">
            {characterName || t("myCombo.unknownCharacter")} — {t("myCombo.title")}
          </div>
          <div className="text-xs text-emerald-600">
            {t("myCombo.subtitle")}
          </div>
        </div>
      </div>
      {/* C-07: ステータス別件数はステータス切替タブに集約。情報バーは合計のみ表示し、タブと役割を分離して紛らわしさを解消。 */}
      <div className="text-sm font-medium text-emerald-800 mt-3">
        {total === 0
          ? t("myCombo.noComboYet")
          : t("comboList.registeredCount", { count: total })}
      </div>
    </div>
  );
}
