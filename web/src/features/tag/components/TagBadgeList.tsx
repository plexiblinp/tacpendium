import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/types/tag";
import { UNSET_TAG_COLOR_FALLBACK } from "../constants/tagColorPalette";

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function textColor(bgHex: string): string {
  return luminance(bgHex) > 128 ? "#1F2937" : "#FFFFFF";
}

interface TagBadgeListProps {
  tags: Tag[];
  excludeCategories?: string[];
  maxVisible?: number;
  size?: "sm" | "md";
}

export function TagBadgeList({
  tags,
  excludeCategories,
  maxVisible,
  size = "sm",
}: TagBadgeListProps) {
  const { t } = useTranslation();
  const visible = excludeCategories
    ? tags.filter((t) => !excludeCategories.includes(t.category ?? ""))
    : tags;

  if (visible.length === 0) return null;

  const shown = maxVisible !== undefined ? visible.slice(0, maxVisible) : visible;
  const hidden = maxVisible !== undefined ? visible.slice(maxVisible) : [];
  const overflow = hidden.length;
  const overflowLabel =
    overflow > 0
      ? t("tag.badge.overflow", {
          hiddenCount: overflow,
          names: hidden.map((tag) => tag.name).join(t("tag.badge.separator")),
        })
      : undefined;

  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((tag) => {
        const bg = tag.color || UNSET_TAG_COLOR_FALLBACK;
        return (
          <Badge
            key={tag.id}
            variant="secondary"
            className={`font-medium border-0 ${sizeClass}`}
            style={{ backgroundColor: bg, color: textColor(bg) }}
          >
            {tag.name}
          </Badge>
        );
      })}
      {overflow > 0 && (
        <Badge
          variant="secondary"
          className={`font-medium ${sizeClass}`}
          title={overflowLabel}
          aria-label={overflowLabel}
        >
          +{overflow}
        </Badge>
      )}
    </span>
  );
}
