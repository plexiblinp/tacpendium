import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Preset } from "@/features/preset/types";

interface PresetSwitcherProps {
  presets: Preset[];
  selectedId: number | undefined;
  onChange: (presetId: number) => void;
  disabled?: boolean;
}

export default function PresetSwitcher({
  presets,
  selectedId,
  onChange,
  disabled,
}: PresetSwitcherProps) {
  const { t } = useTranslation();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500">
        {t("comboDetail.recipe.presetLabel")}:
      </span>
      <Select
        value={selectedId != null ? String(selectedId) : undefined}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger className="w-auto min-w-[120px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
