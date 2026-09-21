import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COLUMN_DEFINITIONS,
  type ColumnVisibility,
} from "@/constants/combo-list";

interface ColumnVisibilityMenuProps {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
  onReset: () => void;
}

export default function ColumnVisibilityMenu({
  visibility,
  onChange,
  onReset,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation();

  const handleToggle = (key: keyof ColumnVisibility) => {
    onChange({ ...visibility, [key]: !visibility[key] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white hover:bg-slate-50"
          aria-label={t("comboList.filter.columnVisibility")}
        >
          <Settings size={14} />
          <span>{t("comboList.filter.columnVisibility")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {COLUMN_DEFINITIONS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visibility[col.key]}
            onCheckedChange={() => handleToggle(col.key)}
            // C-23: 列を1つ切り替えるたびにメニューが閉じないよう、選択時の既定の閉じ挙動を抑止して連続トグル可能にする。
            onSelect={(e) => e.preventDefault()}
          >
            {t(col.labelKey)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <button
          type="button"
          onClick={onReset}
          className="w-full px-2 py-1.5 text-left text-xs text-blue-600 hover:underline"
        >
          {t("comboList.filter.resetColumns")}
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
