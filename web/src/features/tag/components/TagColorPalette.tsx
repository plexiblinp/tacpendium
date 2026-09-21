import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useTranslation } from "react-i18next";

import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { TAG_COLOR_PALETTE } from "../constants/tagColorPalette";

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function TagColorPalette({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <RadioGroup
      value={value.toLowerCase()}
      onValueChange={onChange}
      className="grid grid-cols-5 gap-2"
      data-testid="tag-color-palette"
    >
      {TAG_COLOR_PALETTE.map(({ key, labelKey, hex }) => (
        <RadioGroupPrimitive.Item
          key={key}
          value={hex}
          aria-label={t(labelKey)}
          data-testid={`tag-color-swatch-${key}`}
          className={cn(
            "flex flex-col items-center gap-1 rounded border p-1.5 text-[0.65rem]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "border-slate-200 hover:border-slate-400",
            "data-[state=checked]:border-slate-900 data-[state=checked]:ring-2 data-[state=checked]:ring-slate-900/20",
          )}
        >
          <span
            className="h-6 w-6 rounded-full border border-black/10"
            style={{ backgroundColor: hex }}
            aria-hidden="true"
          />
          <span className="text-slate-600">{t(labelKey)}</span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroup>
  );
}
