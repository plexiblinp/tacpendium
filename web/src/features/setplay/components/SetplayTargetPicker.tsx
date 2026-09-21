import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMovesByCharacter } from "@/features/moves/api";
import {
  MOVE_CATEGORY_LABEL_JA,
  MOVE_CATEGORY_ORDER,
  type Move,
} from "@/features/moves/types";

interface Props {
  characterId: number;
  value: number | null; // 選択中の moveId
  onChange: (moveId: number | null) => void;
}

// SetplayTargetPicker は「特定の技から探す」ための target 技ピッカー。
// コンボ/セットプレイ登録の「区分フィルタ＋全技 select」流儀を踏襲する。
// category=system(ドライブパリィ等の非技)は除外する("systemの非技以外"・#4)。
const EXCLUDED_CATEGORY = "system";

export function SetplayTargetPicker({ characterId, value, onChange }: Props) {
  const { t } = useTranslation();
  const movesQ = useMovesByCharacter(characterId);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const moves = useMemo(
    () => (movesQ.data ?? []).filter((m) => m.category !== EXCLUDED_CATEGORY),
    [movesQ.data],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Move[]>();
    for (const m of moves) {
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return map;
  }, [moves]);

  const categories = MOVE_CATEGORY_ORDER.filter(
    (c) => c !== EXCLUDED_CATEGORY && (grouped.get(c)?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-2 rounded border border-slate-200 p-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600">
          {t("setplay.picker.category")}
          <select
            className="ml-1 rounded border border-slate-300 px-1 py-0.5 text-sm"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            data-testid="setplay-picker-category"
          >
            <option value="all">{t("setplay.picker.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {MOVE_CATEGORY_LABEL_JA[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        {value != null && (
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
            onClick={() => onChange(null)}
          >
            {t("setplay.picker.clear")}
          </button>
        )}
      </div>

      <select
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        value={value != null ? String(value) : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        data-testid="setplay-picker-move"
      >
        <option value="">{t("setplay.picker.placeholder")}</option>
        {categories
          .filter((c) => filterCategory === "all" || c === filterCategory)
          .map((c) => (
            <optgroup key={c} label={MOVE_CATEGORY_LABEL_JA[c] ?? c}>
              {(grouped.get(c) ?? []).map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.nameJa ?? m.code}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </div>
  );
}
