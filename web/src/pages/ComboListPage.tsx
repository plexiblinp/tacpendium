import { useMemo, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";

import { MAX_COMPARE_COMBOS } from "@/constants/compare";
import { MAX_EXPORT_SELECTION } from "@/constants/export";
import { useSelectMode } from "@/features/combo/hooks/useSelectMode";
import ExportDialog from "@/features/combo-io/components/ExportDialog";

import { useCharacterName } from "@/features/character/hooks/useCharacters";
import { TAG_CATEGORY_MYCOMBO_STATUS, type MyComboStatus } from "@/constants/mycombo";
import { useCombos, useDeleteCombo, type ComboListFilter } from "@/features/combo/api";
import DataMigrationBanner from "@/features/data-migration/DataMigrationBanner";
import AffectedCombosButton from "@/features/game-update/AffectedCombosButton";
import GameUpdateBanner from "@/features/game-update/GameUpdateBanner";
import { useComboListFilters } from "@/features/combo/hooks/useComboListFilters";
import { useResolvedCharacterId } from "@/features/combo/hooks/useResolvedCharacterId";
import { useColumnVisibility } from "@/features/combo/hooks/useColumnVisibility";
import { useTagsForSelector } from "@/features/tag/hooks/useTagsForSelector";
import { Label } from "@/components/ui/label";
import ComboListFilters from "@/features/combo/components/ComboListFilters";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import type { ComboSummary } from "@/features/combo/types";
import ComboTable from "@/features/combo/components/ComboTable";
import RecipeViewToggle from "@/features/combo/components/RecipeViewToggle";
import { DeleteComboConfirm } from "@/features/combo/components/DeleteComboConfirm";
import { useUpdateMyComboStatus } from "@/features/mycombo/hooks/useUpdateMyComboStatus";

export default function ComboListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    isSelectMode,
    selectedIds,
    isAtMax,
    enterSelectMode,
    exitSelectMode,
    toggle,
  } = useSelectMode(MAX_EXPORT_SELECTION);
  const [selectModeMessage, setSelectModeMessage] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { filters, updateFilters, hasActiveFilters, clearFilters } = useComboListFilters();
  const { visibility, updateVisibility, resetVisibility } =
    useColumnVisibility();
  const { filteredTags } = useTagsForSelector({
    excludeCategories: [TAG_CATEGORY_MYCOMBO_STATUS],
  });

  // 現在選択中キャラ(M24-01 §4.1)。段 1 = URL クエリ(= フィルタの character_id)。
  // 情報バーの動的表示・一覧の取得・新規登録への文脈伝播のすべてがこの 1 値を通る。
  const selectedCharacterId = useResolvedCharacterId({
    urlCharacterId: filters.characterId,
  });

  const apiFilter = useMemo<ComboListFilter>(() => {
    const f: ComboListFilter = {
      characterId: selectedCharacterId,
      sort: filters.sort,
      order: filters.order,
    };
    if (filters.isDraft !== null) f.isDraft = filters.isDraft;
    if (filters.tagIds.length > 0) f.tagIds = filters.tagIds;
    if (filters.position !== null) f.position = filters.position;
    if (filters.hitType !== null) f.hitType = filters.hitType;
    if (filters.starterMoveId !== null) f.starterMoveId = filters.starterMoveId;
    if (filters.opponentStance !== null)
      f.opponentStance = filters.opponentStance;
    if (filters.starterMeaty !== null) f.starterMeaty = filters.starterMeaty;
    // 成立条件(M19-06)。軸は成立状態があるときだけ送る(BE も成立状態が無ければ
    // 軸を読まないが、意味の無いクエリを投げない＝キャッシュキーも汚さない)。
    if (filters.setupResult !== null) {
      f.setupResult = filters.setupResult;
      if (filters.setupTechType !== null)
        f.setupTechType = filters.setupTechType;
      if (filters.setupInCorner !== null)
        f.setupInCorner = filters.setupInCorner;
    }
    return f;
  }, [filters, selectedCharacterId]);

  // アバターの頭文字にだけ使う。キャラ一覧そのものは CharacterSelector が自分で引く
  // (M24-02 §4.3.2 でヘッダ帯を共有部品へ寄せたため、本画面は一覧を持たなくなった)。
  const selectedCharacterName = useCharacterName(selectedCharacterId);
  const newComboHref = `/combos/new?character=${selectedCharacterId}`;

  const combosQuery = useCombos(apiFilter);
  const deleteMutation = useDeleteCombo();
  const { mutate: changeStatus, changingComboId } = useUpdateMyComboStatus();

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
        {/* ★★M28-01 / M28-02c: 告知バナー 2 本のマウント先である。
            App.tsx のデスクトップ・リダイレクトにより 640px 以上では HomePage が
            一度も描画されない。⇒ ホームだけに置くと PC の利用者へ一度も届かない
            (移行告知が実際にそうなっていた = migration-banner-never-shown-on-desktop)。
            ★PC の実質的な入口は /combos である(上記リダイレクトの行き先そのもの)。 */}
        <div className="mb-4 space-y-3">
          <DataMigrationBanner />
          <GameUpdateBanner />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* M24-01 §4.1-4(SM-119): 対象キャラの選択。
              ★フィルタ欄からヘッダのキャラクター欄へ移した(2026-08-25 開発者判断)。
                「一覧のフィルタのプルダウンが新規登録の対象キャラ選択も兼ねている」のが
                不自然、という要求に対する形である。兼ねている事実は消さず——消すと
                「一覧でキャラを選んでから新規登録」の流れが壊れ、SM-044(戻ったときに
                キャラを維持したい)と正面衝突する——見える場所へ出して役割を書いた。
              ★キャラが増えたときにプルダウン以外の選択方法へ差し替える余地を残すため、
                余白のあるこの位置に置いてある(同判断)。
              ★キャラ名の大見出しは置かない(2026-08-25 開発者判断)——プルダウン自身が
                同じ名前を出しており、同じ情報が 2 か所に並ぶだけになる。
                アイコン → 対象キャラ → 登録件数 の順に並べる。 */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-lg font-bold text-slate-500">
              {selectedCharacterName.charAt(0) || "?"}
            </div>
            <div>
              {/* ★M24-02 §4.3.2: 独自の native select をやめ、共有部品へ寄せた。
                    ここは M24-01 が「キャラが増えたら別方式へ替えられる余白」として
                    移した張本人の面であり、その差し替えを実際に行ったのが本サブである。
                  ★共有部品にしたことで、検索・ロケール依存の昇順が他の 11 コントロールと
                    同時に揃う(§3.3-12 の実測 = 14 コントロール / 13 ファイル)。
                  ★キャラ一覧が未取得のときの受け皿(「---」)は共有部品側が持つ。 */}
              <Label className="block text-xs text-slate-500 mb-1">
                {t("comboList.characterScope.label")}
              </Label>
              <CharacterSelector
                selectedCharacterId={selectedCharacterId}
                // ★★M27-03(P4M-022): キャラを変えたら始動技フィルタを解除する。
                //   始動技はキャラに属するため、残すと別キャラの技 id で絞ったまま
                //   0 件の一覧が出て、利用者は原因を見つけられない
                //   (要約ピルには出るが、技名が引けず id のままになる)。
                onChange={(characterId) =>
                  updateFilters({ characterId, starterMoveId: null })
                }
                ariaLabel={t("comboList.characterScope.label")}
                data-testid="combo-list-character-scope"
              />
              <p className="mt-1 text-xs text-slate-400">
                {t("comboList.characterScope.note")}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {combosQuery.data
                ? t("comboList.registeredCount", {
                    count: combosQuery.data.count,
                  })
                : ""}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ★★M28-02c: 一覧に増えるのはこのボタン 1 個だけである(フィルタ軸は足さない)。
                ★バナーと同時に出す ——「バナーが出ている間はボタンを隠す」は採らない。
                  延期した瞬間にボタンが現れる形になり「消したのに別のものが出てきた」と読まれる。
                ★延期してもこのボタンは消えない(抑止するのはバナーだけである)。 */}
            <AffectedCombosButton />
            {/* M24-03 §4.1: レシピの全文表示モード。コンボ側の面に共通の 1 つの値を切り替える。 */}
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
              <>
                <button
                  type="button"
                  onClick={enterSelectMode}
                  className="text-sm text-slate-600 hover:text-blue-600 px-3 py-1.5 border border-slate-300 rounded"
                >
                  {t("selectMode.enter")}
                </button>
                <Link
                  to={newComboHref}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded shadow-sm"
                >
                  {t("common.new")}
                </Link>
              </>
            )}
          </div>
        </div>

        <ComboListFilters
          filters={filters}
          onFilterChange={updateFilters}
          // ★M27-03(P4M-022): 始動技の選択肢は「いま対象にしているキャラ」の技である。
          //   ★一覧のキャラは useResolvedCharacterId が必ず 1 体へ解決する
          //     (number を返す)。⇒ 「キャラ未選択」という状態はこの画面に存在しない。
          characterId={selectedCharacterId}
          availableTags={filteredTags}
          visibility={visibility}
          onVisibilityChange={updateVisibility}
          onVisibilityReset={resetVisibility}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        {combosQuery.isLoading && (
          <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
            {t("common.loading")}
          </div>
        )}
        {combosQuery.isError && (
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
        {combosQuery.data && (
          <ComboTable
            combos={combosQuery.data.items}
            onDelete={handleDelete}
            visibility={visibility}
            onStatusChange={handleStatusChange}
            statusChangingId={changingComboId}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            newComboHref={newComboHref}
            isSelectMode={isSelectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            isSelectionAtMax={isAtMax}
          />
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
