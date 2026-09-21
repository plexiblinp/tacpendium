import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import PresetSwitcher from "@/features/combo/components/PresetSwitcher";
import { usePresets } from "@/features/preset/api";
import { useUpdateConfig } from "./useUpdateConfig";
import type { ConfigResponse } from "./types";

interface Props {
  config: ConfigResponse;
}

export default function SettingsSectionBasic({ config }: Props) {
  const { t, i18n } = useTranslation();
  const { data: presets } = usePresets();
  const updateConfig = useUpdateConfig();

  const [characterId, setCharacterId] = useState(config.defaults.characterId);
  const [presetId, setPresetId] = useState(config.defaults.presetId);

  const handleSave = () => {
    updateConfig.mutate(
      { defaults: { characterId, presetId } },
      {
        onSuccess: (data) => {
          toast.success(
            data.restartRequired
              ? t("settings.basic.restartRequired")
              : t("settings.basic.saved"),
          );
        },
        onError: () => toast.error(t("settings.validationError")),
      },
    );
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.basic.heading")}</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.basic.language")}
          </label>
          <select
            className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <option value="ja">{t("settings.basic.languageJa")}</option>
            <option value="en">{t("settings.basic.languageEn")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.basic.defaultCharacter")}
          </label>
          <CharacterSelector selectedCharacterId={characterId} onChange={setCharacterId} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.basic.defaultPreset")}
          </label>
          <PresetSwitcher
            presets={presets ?? []}
            selectedId={presetId}
            onChange={setPresetId}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {t("settings.basic.save")}
          </button>
        </div>
      </div>
    </section>
  );
}
