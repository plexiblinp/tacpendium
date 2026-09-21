import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { COLUMN_DEFINITIONS, type ColumnVisibility } from "@/constants/combo-list";
import type { ComboSummary } from "../types";
import ComboTableRow from "./ComboTableRow";
import SetupTreeRow from "./SetupTreeRow";

interface ComboTableProps {
  combos: ComboSummary[];
  /** 削除の通知。★渡さない面では［削除］を描かない(no-op を渡さないこと)。 */
  onDelete?: (id: number) => void;
  visibility: ColumnVisibility;
  onStatusChange?: (comboId: number, combo: ComboSummary, newStatus: string) => void;
  statusChangingId?: number | null;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  emptyMessage?: string;
  newComboHref?: string;
  isSelectMode?: boolean;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  isSelectionAtMax?: boolean;
  /**
   * ゲーム更新の影響コンボ専用画面のときだけ 3 列を足す(M28-02c / DES-005 §5.19b-4)。
   *
   * ★★列設定の共有物には一切触れない —— COLUMN_DEFINITIONS / ColumnVisibility /
   *   保存キー combo-list-columns-v1 に足すと、コンボ一覧とマイコンボの列設定にまで
   *   影響が出る(表示列カスタマイズのメニューにも自動で出てしまう)。
   * ★★足し方は既存の「optional prop があると 1 列生える」型に揃えてある
   *   (先例 = onStatusChange のステータス列 / isSelectMode のチェックボックス列)。
   */
  /** ［コピー］を描くか(既定 true)。★専用画面では出さない(ComboTableRow の注記を参照)。 */
  showCopy?: boolean;
  showGameUpdateColumns?: boolean;
  /** 「問題なし」を押したときの通知。★1 件ずつだけである(一括は作らない)。 */
  onAcknowledge?: (comboId: number) => void;
  /** 「問題なし」を送信中のコンボ id。 */
  acknowledgingId?: number | null;
  /** ★★「問題なし」に失敗したコンボ id。失敗を黙って消さないために要る。 */
  acknowledgeFailedId?: number | null;
}

export default function ComboTable({
  combos,
  onDelete,
  visibility,
  onStatusChange,
  statusChangingId,
  hasActiveFilters,
  onClearFilters,
  emptyMessage,
  newComboHref,
  isSelectMode,
  selectedIds,
  onToggleSelect,
  isSelectionAtMax,
  showCopy,
  showGameUpdateColumns,
  onAcknowledge,
  acknowledgingId,
  acknowledgeFailedId,
}: ComboTableProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useSessionStorage<number[]>(
    "combo-list-expanded-ids-v1",
    [],
  );

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (combos.length === 0) {
    if (emptyMessage) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
          {emptyMessage}
        </div>
      );
    }
    if (hasActiveFilters) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
          <p>{t("comboList.emptyFiltered")}</p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              {t("comboList.clearFilters")}
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
        <p>{t("comboList.empty")}</p>
        {newComboHref && (
          <Link
            to={newComboHref}
            className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded shadow-sm"
          >
            {t("comboList.emptyCta")}
          </Link>
        )}
      </div>
    );
  }

  // ★★M27-03 追補: 表示中の列数は **COLUMN_DEFINITIONS の並びから数える**。
  //
  //   ★`Object.values(visibility)` で数えてはいけない——`useColumnVisibility` は
  //     `{ ...DEFAULT, ...loaded }` でマージするため、**保存済みの古いキー
  //     (`starterSituation` 等)が余分なプロパティとして残り、1 列ぶん水増しする**。
  //     ⇒ 型に在る列だけを数える形にすると、この種の事故が構造的に起きなくなる。
  //   ★キーのバージョンは上げていない(上げると利用者の列設定が失われる)。
  const colSpan =
    2 +
    COLUMN_DEFINITIONS.filter((c) => visibility[c.key]).length +
    (onStatusChange ? 1 : 0) +
    (isSelectMode ? 1 : 0) +
    // ★専用画面の 3 列(変わった技 / 前提バージョン / 問題なし)。
    (showGameUpdateColumns ? 3 : 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {isSelectMode && <TableHead className="w-10"></TableHead>}
            <TableHead className="w-10"></TableHead>
            {/* ★★M31-03(開発者確定 2026-09-09・案C): 列の並びは
                  ルート / ダメージ / ヒット種別 / 始動位置 / 相手の状態 /
                  タグ / 登録状態 / 備考 / セットプレイ数
                ★★並びの正本は 3 か所に分かれている —— 本ヘッダ ／ ComboTableRow の
                  セル ／ constants の COLUMN_DEFINITIONS(表示列メニューの並び)。
                  ⇒ 1 つだけ直すと見出しとセルがずれるが、tsc もテストも検出しない。
                  ★ComboTable.test.tsx の「3 か所の並びが一致する」検査が固定している。 */}
            {visibility.recipe && (
              <TableHead>{t("comboList.column.recipe")}</TableHead>
            )}
            {visibility.damage && (
              <TableHead>{t("comboList.column.damage")}</TableHead>
            )}
            {visibility.hitType && (
              <TableHead>{t("comboList.column.hitType")}</TableHead>
            )}
            {visibility.position && (
              <TableHead>{t("comboList.column.position")}</TableHead>
            )}
            {visibility.opponentStance && (
              <TableHead>{t("comboList.column.opponentStance")}</TableHead>
            )}
            {visibility.tags && (
              <TableHead>{t("comboList.column.tags")}</TableHead>
            )}
            {visibility.draftStatus && (
              <TableHead>{t("comboList.column.draftState")}</TableHead>
            )}
            {visibility.memo && (
              <TableHead>{t("comboList.column.memo")}</TableHead>
            )}
            {visibility.setupCount && (
              <TableHead className="text-right">
                {t("comboList.column.setupCount")}
              </TableHead>
            )}
            {showGameUpdateColumns && (
              <>
                <TableHead>{t("gameUpdate.columnAffectedMoves")}</TableHead>
                <TableHead>{t("gameUpdate.columnBaselineVersion")}</TableHead>
                <TableHead>{t("gameUpdate.columnAcknowledge")}</TableHead>
              </>
            )}
            {onStatusChange && (
              <TableHead>{t("myCombo.statusColumn")}</TableHead>
            )}
            <TableHead>{t("comboList.column.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combos.map((combo) => {
            const canExpand = (combo.setups?.length ?? 0) > 0;
            const isExpanded = expandedIds.includes(combo.id);
            return (
              <Fragment key={combo.id}>
                <ComboTableRow
                  combo={combo}
                  expanded={canExpand && isExpanded}
                  canExpand={canExpand}
                  onToggleExpand={toggleExpand}
                  onDelete={onDelete}
                  visibility={visibility}
                  onStatusChange={onStatusChange}
                  statusChanging={statusChangingId === combo.id}
                  showCopy={showCopy}
                  showGameUpdateColumns={showGameUpdateColumns}
                  onAcknowledge={onAcknowledge}
                  acknowledging={acknowledgingId === combo.id}
                  acknowledgeFailed={acknowledgeFailedId === combo.id}
                  isSelectMode={isSelectMode}
                  selected={selectedIds?.includes(combo.id)}
                  onToggleSelect={onToggleSelect}
                  selectionDisabled={!!isSelectionAtMax && !selectedIds?.includes(combo.id)}
                />
                {canExpand && isExpanded && (
                  <SetupTreeRow
                    setups={combo.setups!}
                    colSpan={colSpan}
                  />
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
