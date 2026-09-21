import { useMemo, useCallback, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { useQuery } from "@tanstack/react-query";

import { MAX_COMPARE_COMBOS } from "@/constants/compare";
import { MAX_EXPORT_SELECTION } from "@/constants/export";
import { useSelectMode } from "@/features/combo/hooks/useSelectMode";
import ExportDialog from "@/features/combo-io/components/ExportDialog";

import {
  TAG_CATEGORY_MYCOMBO_STATUS,
  MYCOMBO_STATUS_VALUES,
  MYCOMBO_STATUS_TAG_NAMES,
  DEFAULT_MYCOMBO_STATUS,
  type MyComboStatus,
} from "@/constants/mycombo";
import {
  SORT_FIELD_VALUES,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_ORDER,
  type SortField,
  type SortOrder,
} from "@/constants/combo-list";
import { useCombos, useDeleteCombo, type ComboListFilter } from "@/features/combo/api";
import type { ComboSummary } from "@/features/combo/types";
import { useColumnVisibility } from "@/features/combo/hooks/useColumnVisibility";
import { useResolvedCharacterId } from "@/features/combo/hooks/useResolvedCharacterId";
import { tagApi } from "@/features/tag/api/tagApi";
import { queryKeys } from "@/lib/query-keys";

import { useMyComboStatusCounts } from "../hooks/useMyComboStatusCounts";
import { useUpdateMyComboStatus } from "../hooks/useUpdateMyComboStatus";
import ComboTable from "@/features/combo/components/ComboTable";
import RecipeViewToggle from "@/features/combo/components/RecipeViewToggle";
import ComboSortControls from "@/features/combo/components/ComboSortControls";
import ColumnVisibilityMenu from "@/features/combo/components/ColumnVisibilityMenu";
import { DeleteComboConfirm } from "@/features/combo/components/DeleteComboConfirm";
import CharacterInfoBar from "./CharacterInfoBar";
import CharacterSelector from "./CharacterSelector";
import MyComboStatusTabs from "./MyComboStatusTabs";

function isMyComboStatus(v: string | null): v is MyComboStatus {
  return MYCOMBO_STATUS_VALUES.includes(v as MyComboStatus);
}

function isSortField(v: string | null): v is SortField {
  return SORT_FIELD_VALUES.includes(v as SortField);
}

export default function MyComboPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isSelectMode,
    selectedIds,
    isAtMax,
    enterSelectMode,
    exitSelectMode,
    toggle,
    clear: clearSelection,
  } = useSelectMode(MAX_EXPORT_SELECTION);
  const [selectModeMessage, setSelectModeMessage] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const statusParam = searchParams.get("status");
  const status: MyComboStatus = isMyComboStatus(statusParam) ? statusParam : DEFAULT_MYCOMBO_STATUS;

  const sortParam = searchParams.get("sort");
  const sort: SortField = isSortField(sortParam) ? sortParam : DEFAULT_SORT_FIELD;

  const orderParam = searchParams.get("order");
  const order: SortOrder = orderParam === "asc" ? "asc" : "desc";

  // M7-04-2: 複数キャラ対応。キャラ選択を state 化し CharacterSelector の onChange を実配線する。
  //
  // M24-01 §4.1-7(SM-058 / D-545): コンボ一覧での選択キャラを引き継ぐ。
  // ★引き継ぐのは対象キャラだけである。タグ・状況・仮登録トグル・ソートは持ち込まない
  //   ——持ち込むと DES-005 §5.5 のステータス切替タブ(使用中/練習中/頻度低下)と衝突し、
  //   同 §5.4 / §5.5 の「戻り時のフィルタ/ソート保持は対象外」を破る。
  // ★画面内で切り替えたら、その手動選択(override)が解決順より優先される。
  // ★useState の初期化子で 1 回だけ読む形は採らない——config(GET /api/config)の到着が
  //   初回描画より後になるため、初期化子で読むと設定の既定キャラが永久に効かない。
  const resolvedCharacterId = useResolvedCharacterId();
  const [characterOverride, setCharacterOverride] = useState<number | null>(null);
  const characterId = characterOverride ?? resolvedCharacterId;

  const handleCharacterChange = useCallback(
    (next: number) => {
      clearSelection();
      setSelectModeMessage(null);
      setCharacterOverride(next);
    },
    [clearSelection],
  );

  const setStatus = useCallback(
    (next: MyComboStatus) => {
      clearSelection();
      setSelectModeMessage(null);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set("status", next);
        return p;
      });
    },
    [setSearchParams, clearSelection],
  );

  const setSort = useCallback(
    (field: SortField) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        // 既定(更新日時)へ戻すときは URL から省く。方向を持たない default(始動状況順)選択時は order も除く。
        if (field === DEFAULT_SORT_FIELD) {
          p.delete("sort");
          p.delete("order");
        } else {
          p.set("sort", field);
          if (field === "default") p.delete("order");
        }
        return p;
      });
    },
    [setSearchParams],
  );

  const setOrder = useCallback(
    (next: SortOrder) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next === DEFAULT_SORT_ORDER) p.delete("order");
        else p.set("order", next);
        return p;
      });
    },
    [setSearchParams],
  );

  const { data: statusCounts, isLoading: countsLoading } = useMyComboStatusCounts(characterId);

  const { visibility, updateVisibility, resetVisibility } = useColumnVisibility();

  const mycomboTagsQuery = useQuery({
    queryKey: queryKeys.tags.byCategory(false, TAG_CATEGORY_MYCOMBO_STATUS),
    queryFn: () => tagApi.list({ category: TAG_CATEGORY_MYCOMBO_STATUS }),
  });

  const tagId = useMemo<number | undefined>(() => {
    if (!mycomboTagsQuery.data) return undefined;
    const targetName = MYCOMBO_STATUS_TAG_NAMES[status];
    return mycomboTagsQuery.data.find((t) => t.name === targetName)?.id;
  }, [mycomboTagsQuery.data, status]);

  const apiFilter = useMemo<ComboListFilter>(() => {
    const f: ComboListFilter = {
      characterId,
      sort: sort === "default" ? undefined : sort,
      order,
    };
    if (tagId !== undefined) {
      f.tagIds = [tagId];
    }
    return f;
  }, [characterId, sort, order, tagId]);

  const { mutate: changeStatus, changingComboId } = useUpdateMyComboStatus();

  const combosQuery = useCombos(apiFilter);
  const deleteMutation = useDeleteCombo();

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      deleteMutation.mutate(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  const handleStatusChange = useCallback(
    (_comboId: number, combo: ComboSummary, newStatus: string) => {
      changeStatus({ combo, newStatus: newStatus as MyComboStatus | "" });
    },
    [changeStatus],
  );

  const handleToggleSelect = useCallback(
    (id: number) => {
      // M17-05b: エクスポート選択と共有するため toggle() 自体の上限は MAX_EXPORT_SELECTION。
      // 比較(M15-02)向けの「5件超」フィードバックは toggle の戻り値に頼らず、ここで直接判定する。
      const wasSelected = selectedIds.includes(id);
      const ok = toggle(id);
      if (!ok) {
        setSelectModeMessage({
          kind: "info",
          text: t("export.maxReached", { max: MAX_EXPORT_SELECTION }),
        });
        return;
      }
      const nextCount = wasSelected ? selectedIds.length - 1 : selectedIds.length + 1;
      if (nextCount > MAX_COMPARE_COMBOS) {
        setSelectModeMessage({
          kind: "info",
          text: t("compare.maxReached", { max: MAX_COMPARE_COMBOS }),
        });
      } else {
        setSelectModeMessage(null);
      }
    },
    [toggle, t, selectedIds],
  );

  const handleCompare = useCallback(() => {
    if (selectedIds.length > 0 && selectedIds.length <= MAX_COMPARE_COMBOS) {
      navigate(`/compare?ids=${selectedIds.join(",")}`);
    }
  }, [selectedIds, navigate]);

  const compareDisabled =
    selectedIds.length === 0 || selectedIds.length > MAX_COMPARE_COMBOS;

  // M17-05b: 選択ゼロは「現フィルタ結果の全件」(WYSIWYG)を対象にする。
  const exportComboIds =
    selectedIds.length > 0
      ? selectedIds
      : (combosQuery.data?.items.map((c) => c.id) ?? []);
  // ★★総数は count(= 応答に載った件数)ではなく total(絞り込みに一致する総数)を使う
  //   (M29-02 §2.1)。count を使うと、一覧が BE の上限で切れているときに
  //   「全 100 件をエクスポート」と表示して 100 件だけ出し、利用者は
  //   それが全件だと信じてしまう —— 着手前がその状態だった。
  const exportTotalCount =
    selectedIds.length > 0 ? selectedIds.length : (combosQuery.data?.total ?? 0);
  const exportButtonDisabled = !combosQuery.data || exportTotalCount === 0;
  const exportButtonLabel =
    selectedIds.length > 0
      ? t("export.buttonSelected", { count: exportTotalCount })
      : t("export.buttonAll", { count: exportTotalCount });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <CharacterSelector
            selectedCharacterId={characterId}
            onChange={handleCharacterChange}
          />
          <div className="flex items-center gap-2">
            {/* ★★M24-03 レビュー 中-1: 本画面は ComboTable / ComboTableRow を一覧と
                共有しているため、レシピの見せ方もメモ 1 行目も一覧と同じ規則で描かれる。
                ⇒ 切り替えの口をここにも置く。置かないと、この面にいる利用者だけが
                  他の面へ移動しないとモードを変えられない。
                ★値は他の面と同じ 1 つを共有する(トグルが増えるだけで値は増えない)。 */}
            <RecipeViewToggle surfaceDefault={false} />
            <button
              type="button"
              onClick={() => setExportDialogOpen(true)}
              disabled={exportButtonDisabled}
              data-testid="export-open-button"
              className={`text-sm font-medium px-3 py-1.5 rounded shadow-sm border ${
                exportButtonDisabled
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {exportButtonLabel}
            </button>
            {isSelectMode ? (
              <>
                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                  {t("selectMode.countPlain", { current: selectedIds.length })}
                </span>
                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={compareDisabled}
                  title={
                    selectedIds.length > MAX_COMPARE_COMBOS
                      ? t("compare.maxReached", { max: MAX_COMPARE_COMBOS })
                      : undefined
                  }
                  className={`text-sm font-medium px-3 py-1.5 rounded shadow-sm ${
                    compareDisabled
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                >
                  {t("selectMode.compare")}
                </button>
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1.5 border border-slate-300 rounded"
                >
                  {t("selectMode.exit")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enterSelectMode}
                className="text-sm text-slate-600 hover:text-blue-600 px-3 py-1.5 border border-slate-300 rounded"
              >
                {t("selectMode.enter")}
              </button>
            )}
          </div>
        </div>

        {countsLoading || !statusCounts ? (
          <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
            {t("common.loading")}
          </div>
        ) : (
          <>
            <CharacterInfoBar
              characterId={characterId}
              statusCounts={statusCounts}
            />

            <MyComboStatusTabs
              selected={status}
              onSelect={setStatus}
              counts={statusCounts}
            />

            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4">
              <div className="flex flex-wrap items-end gap-4">
                {/* C-17: コンボ一覧と共通のソート部品 */}
                <ComboSortControls
                  sort={sort}
                  order={order}
                  onSortChange={setSort}
                  onOrderChange={setOrder}
                />

                <div className="ml-auto">
                  <ColumnVisibilityMenu
                    visibility={visibility}
                    onChange={updateVisibility}
                    onReset={resetVisibility}
                  />
                </div>
              </div>
            </div>

            {(combosQuery.isLoading || tagId === undefined) && (
              <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
                {t("common.loading")}
              </div>
            )}
            {combosQuery.isError && tagId !== undefined && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-red-700">
                {t("common.error", {
                  message:
                    combosQuery.error instanceof Error
                      ? combosQuery.error.message
                      : String(combosQuery.error),
                })}
              </div>
            )}
            {selectModeMessage && (
              <div
                role="status"
                className={`rounded p-3 text-sm mb-4 ${
                  selectModeMessage.kind === "error"
                    ? "border border-red-300 bg-red-50 text-red-800"
                    : "border border-green-300 bg-green-50 text-green-800"
                }`}
              >
                {selectModeMessage.text}
              </div>
            )}
            {combosQuery.data && tagId !== undefined && (
              <ComboTable
                combos={combosQuery.data.items}
                onDelete={handleDelete}
                visibility={visibility}
                onStatusChange={handleStatusChange}
                statusChangingId={changingComboId}
                emptyMessage={t("myCombo.emptyStatus")}
                isSelectMode={isSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                isSelectionAtMax={isAtMax}
              />
            )}
          </>
        )}
      </div>

      <DeleteComboConfirm
        open={pendingDeleteId != null}
        message={t("comboList.deleteConfirm")}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
        onConfirm={confirmDelete}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        comboIds={exportComboIds}
        comboTotalCount={exportTotalCount}
        isSelectionActive={selectedIds.length > 0}
      />
    </main>
  );
}
