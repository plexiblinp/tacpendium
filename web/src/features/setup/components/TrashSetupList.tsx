import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { SetupResponse } from "../types";
import { TrashSetupListRow } from "./TrashSetupListRow";

// ゴミ箱のセットプレイ一覧(M23-02 §4.5-5 / 列と選択は M23-06 §4.3・§4.4)。
//
// ★コンボの表とは別のテーブルとして置く。混ぜる形は採れない——M23-01 が
//   ゴミ箱のコンボ表から残日数を撤去し、その撤去を E2E とコンポーネントテストが
//   列数で守っている。行や列を足すと巻き戻る。
// ★★一括選択は「この表の中だけ」で完結する(M23-06 §4.4-2)。選択状態はコンボ用と
//   セットプレイ用の 2 本に分けてあり(案 b)、1 本に混ぜていない——混ぜると id が
//   衝突し、コンボの id でセットプレイの API を叩く経路が構造的に作れてしまう。
//   ★取り違えると別のデータが消える。完全削除は不可逆である。
// ★選択状態はブラウザストレージへ保存しない(画面内の一時状態。CLAUDE.md §10.X)。
interface Props {
  setups: SetupResponse[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onSetupChanged: () => void;
}

export function TrashSetupList({
  setups,
  selectedIds,
  onSelectionChange,
  onSetupChanged,
}: Props) {
  const { t } = useTranslation();

  const allSelected = setups.length > 0 && selectedIds.length === setups.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < setups.length;

  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? setups.map((s) => s.id) : []);
  };

  const handleRowSelection = (id: number, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    }
  };

  if (setups.length === 0) {
    return (
      <p className="py-6 text-center text-slate-500">{t("trash.setup.empty")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
                aria-label={t("trash.setup.columnSelectAll")}
              />
            </TableHead>
            <TableHead>{t("trash.setup.columnName")}</TableHead>
            <TableHead>{t("trash.setup.columnDeletedAt")}</TableHead>
            <TableHead>{t("trash.setup.columnActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {setups.map((setup) => (
            <TrashSetupListRow
              key={setup.id}
              setup={setup}
              selected={selectedIds.includes(setup.id)}
              onSelectionChange={handleRowSelection}
              onSetupChanged={onSetupChanged}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
