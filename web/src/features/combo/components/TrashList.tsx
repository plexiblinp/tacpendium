import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { ComboSummary } from "../types";
import { TrashListRow } from "./TrashListRow";

// ゴミ箱のコンボ一覧(M23-06 §4.1 / §4.2 で列を確定)。
//
// ★列は 6 つ＝選択 / 始動状況 / ダメージ / タグ / 削除日時 / 操作。
// ★「ルート」列は撤去した(§4.1)。空表示に変えたのではなく列ごと消してある——
//   論理削除の時点で combos.recipe_cache が NULL になるため、削除済み行に出せる
//   レシピは構造的に存在せず、列を残す限り常に定数になる。「存在しない概念の列を
//   残さない」は D-458(残日数)と同じ論理である。
// ★★セットプレイ側のレシピは逆に「出す」(§4.3)。根は同じでも答えは違う——
//   コンボは memo と始動状況で行を識別できるが、セットプレイは名前が空だと
//   識別手段がゼロになり、完全削除が不可逆であるぶん取り違えが取り返しつかない。
// ★選択状態はコンボ id の配列のままである。セットプレイの選択は別の配列で持つ
//   (§4.4 案 b)——1 本に混ぜると id が衝突し、コンボの id でセットプレイの API を
//   叩く経路が作れてしまう。
interface Props {
  combos: ComboSummary[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onComboChanged: () => void;
}

export function TrashList({ combos, selectedIds, onSelectionChange, onComboChanged }: Props) {
  const { t } = useTranslation();

  const allSelected = combos.length > 0 && selectedIds.length === combos.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < combos.length;

  // ★「全選択」の対象は、この表に出ているコンボだけである(§4.4-2)。
  //   セットプレイは独立したテーブルであり、そちらの全選択はそちらが持つ。
  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? combos.map((c) => c.id) : []);
  };

  const handleRowSelection = (id: number, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    }
  };

  if (combos.length === 0) {
    return (
      <p className="py-8 text-center text-slate-500">{t("trash.combo.empty")}</p>
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
                aria-label={t("trash.combo.columnSelectAll")}
              />
            </TableHead>
            <TableHead>{t("trash.combo.columnStarter")}</TableHead>
            <TableHead>{t("trash.combo.columnDamage")}</TableHead>
            <TableHead>{t("trash.combo.columnTags")}</TableHead>
            <TableHead>{t("trash.combo.columnDeletedAt")}</TableHead>
            <TableHead>{t("trash.combo.columnActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combos.map((combo) => (
            <TrashListRow
              key={combo.id}
              combo={combo}
              selected={selectedIds.includes(combo.id)}
              onSelectionChange={handleRowSelection}
              onComboChanged={onComboChanged}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
