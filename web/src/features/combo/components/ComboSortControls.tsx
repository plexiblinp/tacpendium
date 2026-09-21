import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  SORT_FIELD_VALUES,
  SORT_FIELD_LABEL_KEYS,
  type SortField,
  type SortOrder,
} from "@/constants/combo-list";

interface ComboSortControlsProps {
  sort: SortField;
  order: SortOrder;
  onSortChange: (next: SortField) => void;
  onOrderChange: (next: SortOrder) => void;
}

/**
 * コンボ一覧・マイコンボで共有するソート UI（ソート項目 + 昇降切替）。
 * C-17: 両画面でソート挙動・表記を一致させるため部品化したもの。
 * "default"(始動状況順) は方向を持たないため昇降切替を非表示にする。
 */
export default function ComboSortControls({
  sort,
  order,
  onSortChange,
  onOrderChange,
}: ComboSortControlsProps) {
  const { t } = useTranslation();
  const currentSortLabels = SORT_FIELD_LABEL_KEYS[sort];

  return (
    <>
      <div>
        <Label className="block text-xs text-slate-500 mb-1">
          {t("comboList.filter.sortBy")}
        </Label>
        <select
          className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortField)}
        >
          {SORT_FIELD_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`comboList.sort.${v}`)}
            </option>
          ))}
        </select>
      </div>

      {sort !== "default" && (
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.order")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={order}
            onChange={(e) => onOrderChange(e.target.value as SortOrder)}
          >
            <option value="asc">
              {currentSortLabels.asc
                ? t(currentSortLabels.asc)
                : t("comboList.filter.ascending")}
            </option>
            <option value="desc">
              {currentSortLabels.desc
                ? t(currentSortLabels.desc)
                : t("comboList.filter.descending")}
            </option>
          </select>
        </div>
      )}
    </>
  );
}
