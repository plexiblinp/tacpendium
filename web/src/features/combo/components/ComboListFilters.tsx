import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/SearchableSelect";
import { UNSET_TAG_COLOR_FALLBACK } from "@/features/tag/constants/tagColorPalette";
import type { Tag } from "@/types/tag";
import {
  POSITION_VALUES,
  HIT_TYPE_VALUES,
  OPPONENT_STANCE_VALUES,
  POSITION_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  STARTER_MEATY_LABEL_KEYS,
  STARTER_MEATY_VALUES,
  HIT_TYPE_LABEL_KEYS,
  HIT_TYPE_SHORT_LABEL_KEYS,
  type ColumnVisibility,
} from "@/constants/combo-list";
import { OKI_TECH_TYPES, OKI_TECH_TYPE_LABEL_KEYS } from "@/constants/oki";
import { useMovesByCharacter } from "@/features/moves/api";
import {
  SETUP_RESULTS,
  SETUP_RESULT_UNVERIFIED,
  type SetupResultState,
} from "@/constants/setup-result";
import { DEFAULT_SORT_FIELD } from "@/constants/combo-list";
import {
  activeFilterKeys,
  type ActiveFilterKey,
  type ComboListFiltersState,
} from "../hooks/useComboListFilters";
import { useFilterPanelCollapsed } from "../hooks/useFilterPanelCollapsed";
import { CollapsibleFieldset } from "./CollapsibleFieldset";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import ComboSortControls from "./ComboSortControls";

// 折りたたみ時の要約に出す軸名。tagIds だけは件数を出すため別扱いにする。
const ACTIVE_FILTER_LABEL_KEYS: Record<Exclude<ActiveFilterKey, "tagIds">, string> = {
  isDraft: "comboList.filter.draft",
  position: "comboList.filter.position",
  hitType: "comboList.filter.hitType",
  starterMoveId: "comboList.filter.starterMove",
  opponentStance: "comboList.filter.opponentStance",
  starterMeaty: "comboList.filter.starterMeaty",
  setupResult: "comboList.filter.setupResult",
  setupTechType: "comboList.filter.setupTechType",
  setupInCorner: "comboList.filter.setupInCorner",
};

/**
 * 要約ピルに出す「選択中の値」のラベル(M24-02 追補・開発者要望)。
 *
 * ★★ラベルの式は、その軸の <select> が <option> に出しているものと同一にする。
 *   第 2 の語彙を作らない(`DES-005` §5.4 が「語彙は既存の正典を再利用する」と定める趣旨)。
 * ★軸ごとに散らさず 1 本に畳んである——散らすと軸が増えたとき片方だけ追随する
 *   (教訓 `E-76`。実際 M19-06 で 3 軸が増えている)。
 *
 * ★★軸名を前置する理由は「読みやすさ」だけではない。
 *   `setupResult.corner.midScreen`(「画面中央」)と `POSITION_LABELS.mid_screen`(「画面中央」)は
 *   **同一文字列**であり、値だけを出すと始動位置のピルと画面端のピルが見分けられない。
 */
function activeFilterValueLabel(
  key: Exclude<ActiveFilterKey, "tagIds">,
  filters: ComboListFiltersState,
  t: (key: string, options?: Record<string, unknown>) => string,
  // ★M27-03: 始動技の表示名だけは技マスタを引かないと分からないため、
  //   解決済みの文字列を渡す(本関数は純粋なまま保つ)。
  starterMoveLabel: string | null,
): string {
  switch (key) {
    case "isDraft":
      return filters.isDraft
        ? t("comboList.filter.draftOnly")
        : t("comboList.filter.officialOnly");
    case "position":
      return t(POSITION_LABEL_KEYS[filters.position!] ?? filters.position!);
    case "hitType":
      return t(HIT_TYPE_LABEL_KEYS[filters.hitType!] ?? filters.hitType!);
    case "starterMoveId":
      // ★名前が引けないときは id を出す(隠さない＝既存規約。formatStarterStatus と同じ)。
      return (
        starterMoveLabel ??
        t("comboCommon.starterMoveFallback", { id: filters.starterMoveId! })
      );
    case "opponentStance":
      return t(
        OPPONENT_STANCE_LABEL_KEYS[filters.opponentStance!] ?? filters.opponentStance!,
      );
    case "starterMeaty":
      // ★M37-07: 語は situation.starterMeaty.* を正典にする(第 2 の語彙を作らない)。
      return t(STARTER_MEATY_LABEL_KEYS[filters.starterMeaty ? "yes" : "no"]);
    case "setupResult":
      return t(`setupResult.state.${filters.setupResult}`);
    case "setupTechType":
      return t(OKI_TECH_TYPE_LABEL_KEYS[filters.setupTechType!]);
    case "setupInCorner":
      return filters.setupInCorner
        ? t("setupResult.corner.inCorner")
        : t("setupResult.corner.midScreen");
  }
}

// ★キャラクター選択は本部品にはない(M24-01 §4.1-4 / SM-119)。
//   「一覧のフィルタのプルダウンが新規登録の対象キャラ選択も兼ねている」のが不自然、
//   という要求に対し、選択そのものをヘッダのキャラクター欄へ移した(ComboListPage)。
//   ★兼ねている事実は消えない——消すと「一覧でキャラを選んでから新規登録」の流れが壊れ、
//   SM-044(戻ったときにキャラを維持したい)と正面衝突する。見える場所へ出して名前を付けた。
interface ComboListFiltersProps {
  filters: ComboListFiltersState;
  onFilterChange: (next: Partial<ComboListFiltersState>) => void;
  /**
   * ★M27-03(P4M-022): 始動技の選択肢を引くキャラ。
   * ★一覧のキャラは常に 1 体へ解決されるため必須である(未選択の状態が無い)。
   */
  characterId: number;
  availableTags: Tag[];
  visibility: ColumnVisibility;
  onVisibilityChange: (next: ColumnVisibility) => void;
  onVisibilityReset: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export default function ComboListFilters({
  filters,
  onFilterChange,
  characterId,
  availableTags,
  visibility,
  onVisibilityChange,
  onVisibilityReset,
  hasActiveFilters,
  onClearFilters,
}: ComboListFiltersProps) {
  const { t } = useTranslation();

  const { collapsed, setCollapsed } = useFilterPanelCollapsed();

  // ★★M27-03(P4M-021): 一覧の中はフル、閉じたトリガは短縮。値の集合は変えていない。
  //   ★先頭の「全て」は value:"" ——single モードの解除手段である。
  const hitTypeOptions: SearchableSelectOption<string>[] = [
    { value: "", label: t("comboList.filter.all") },
    ...HIT_TYPE_VALUES.map((v) => ({
      value: v as string,
      label: t(HIT_TYPE_LABEL_KEYS[v] ?? v),
      shortLabel: t(HIT_TYPE_SHORT_LABEL_KEYS[v] ?? v),
    })),
  ];

  // ★★M27-03(P4M-022): 始動技の選択肢。
  //
  // ★既存フックをそのまま使う(新しい取得経路を作らない)。キャラが決まっていれば
  //   必ず発火する——一覧のキャラは useResolvedCharacterId が 1 体へ解決するためである。
  // ★技を絞り込まない(system カテゴリも出す)。starter_move_id はレシピ先頭から
  //   自動決定される値であり、既存データに何が入っているかを製造が決め打ちできない。
  //   出さないと「登録済みなのに絞れない技」が生まれる。
  // ★0 は「全て」。single モードの onChange は null を返せないため、これが解除手段になる。
  const movesQuery = useMovesByCharacter(characterId);
  const starterMoveOptions: SearchableSelectOption<number>[] = [
    { value: 0, label: t("comboList.filter.all") },
    ...(movesQuery.data ?? []).map((m) => ({
      value: m.id,
      label: m.nameJa || m.code,
      // キャラ選択と同じ流儀。表示名でもコードでも引けるようにする。
      searchTexts: [m.nameJa, m.code].filter((x): x is string => !!x),
    })),
  ];

  // 要約ピル用。選択中の始動技の表示名(引けなければ null)。
  //
  // ★★M27-03 レビュー(中-2): 選択肢・トリガと**同じ規則**にする(`nameJa || code`)。
  //   ★`Move.nameJa` は null を取りうる——ラッシュ版は alias を持たないため実際に
  //     起こりうる(formatStarterStatus の godoc に逐語がある)。
  //   ★nameJa だけを見ていると、その技を選んだとき**トリガには技コード、ピルには
  //     「始動技#42」**と同一画面で別表記になる。⇒ 段 2(code)を飛ばさない。
  const starterMoveLabel =
    filters.starterMoveId === null
      ? null
      : (() => {
          const m = (movesQuery.data ?? []).find(
            (x) => x.id === filters.starterMoveId,
          );
          return m ? m.nameJa || m.code : null;
        })();

  const tagOptions: SearchableSelectOption<number>[] = availableTags.map((tag) => ({
    value: tag.id,
    label: tag.name,
    colorDot: tag.color || UNSET_TAG_COLOR_FALLBACK,
  }));

  const handleDraftChange = (value: string) => {
    if (value === "draft") onFilterChange({ isDraft: true });
    else if (value === "official") onFilterChange({ isDraft: false });
    else onFilterChange({ isDraft: null });
  };

  const draftValue =
    filters.isDraft === true
      ? "draft"
      : filters.isDraft === false
        ? "official"
        : "all";

  // ★M37-07: 始動技の持続当て(開発者裁定 2026-09-14＝一覧フィルタへ足す)。
  //   ★3 状態の <select> にしたのは横幅のためである —— 本行は `P-21` / `M27-03` で
  //     係争中の面に近く、ボタン群を増やすと最も先に折り返す。
  //     ★「指定なし」はフィルタの状態であって列の値ではない(列は 2 値のままである)。
  const handleStarterMeatyChange = (value: string) => {
    if (value === "yes") onFilterChange({ starterMeaty: true });
    else if (value === "no") onFilterChange({ starterMeaty: false });
    else onFilterChange({ starterMeaty: null });
  };

  const starterMeatyValue =
    filters.starterMeaty === true
      ? "yes"
      : filters.starterMeaty === false
        ? "no"
        : "all";

  // 成立条件フィルタ(M19-06)。3 状態は保存値 2 種 + 未検証で、語彙は
  // web/src/constants/setup-result.ts の既存定数を再利用する(第 3 の語彙を作らない)。
  const setupResultOptions: SetupResultState[] = [
    ...SETUP_RESULTS,
    SETUP_RESULT_UNVERIFIED,
  ];
  // ★成立条件が未指定のあいだは軸だけ指定しても絞り込みにならない(§2.2)ため、
  // 軸 2 つの select を無効化して「効かない指定」を作れないようにする。
  const axesDisabled = filters.setupResult === null;

  // 成立条件を「全て」へ戻すときは軸 2 つも一緒に落とす。
  // ★軸だけが URL・セッションに残ると、disabled のせいでユーザーが個別に消せず、
  // 絞り込みが 1 つも効いていないのに「フィルタあり」表示になり、
  // 次に成立条件を選んだ瞬間に意識していない軸が復活する(機械レビュー指摘・中1)。
  const handleSetupResultChange = (value: string) => {
    if (value === "") {
      onFilterChange({
        setupResult: null,
        setupTechType: null,
        setupInCorner: null,
      });
      return;
    }
    onFilterChange({ setupResult: value as SetupResultState });
  };

  const handleSetupInCornerChange = (value: string) => {
    if (value === "") onFilterChange({ setupInCorner: null });
    else onFilterChange({ setupInCorner: value === "true" });
  };

  // ★閉じていても「フィルタが効いている」ことが分かること(指示書 §4.2)。
  //   これが無いと、折りたたみによって「絞り込んだまま忘れる」事故が増える。
  //   CollapsibleFieldset の summary は開閉に関わらず常時表示される既存仕様であり、
  //   新しい機構を作らずにこの要求を満たせる(M15-05 追補で入った型)。
  const active = activeFilterKeys(filters);
  // ★ソートも「効いているのに見えない」対象である(M24-02 レビュー 中-1)。
  //   本部品の見出しは「フィルタ・ソート」であり、閉じるとソートの select も畳まれる。
  //   ★ただし activeFilterKeys へは足さない——同関数は「フィルタを解除」で消える軸の
  //     集合でもあり(sort / order は解除しても残る)、意味が違う。要約側で別枠にする。
  const sortActive = filters.sort !== DEFAULT_SORT_FIELD;
  const summary = (
    <div className="flex flex-wrap gap-1" data-testid="combo-list-filter-summary">
      {active.length === 0 && !sortActive ? (
        <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">
          {t("comboList.filter.summaryNone")}
        </span>
      ) : (
        active.map((key) => (
          // ★書式は「{軸名}: {値}」で統一する(2026-08-26 開発者要望)。
          //   区切りの ": " は翻訳対象ではないため i18n の書式キーにしていない。
          //   書式キーにすると、i18n を初期化しないテストで補間が消えて値を検証できなくなる
          //   (本リポジトリの vitest は setupFiles を持たない)。
          <span
            key={key}
            className="inline-block rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
          >
            {key === "tagIds"
              ? `${t("comboList.filter.tagFilter")}: ${t("comboList.filter.tagSelectedValue", { count: filters.tagIds.length })}`
              : `${t(ACTIVE_FILTER_LABEL_KEYS[key])}: ${activeFilterValueLabel(key, filters, t, starterMoveLabel)}`}
          </span>
        ))
      )}
      {sortActive && (
        <span
          data-testid="combo-list-filter-summary-sort"
          className="inline-block rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
        >
          {`${t("comboList.filter.sortAxis")}: ${t(`comboList.sort.${filters.sort}`)}`}
        </span>
      )}
    </div>
  );

  return (
    <CollapsibleFieldset
      legend={t("comboList.filter.panelLegend")}
      // ★既定は「開いた状態」。既定で閉じると「フィルタが効いているのに見えない」
      //   状態が初回から起きる(指示書 §4.2)。collapsed の初期値も false。
      open={!collapsed}
      onOpenChange={(next) => setCollapsed(!next)}
      openLabel={t("comboList.filter.panelHide")}
      closedLabel={t("comboList.filter.panelShow")}
      summary={summary}
      // ★見出し行の隣へ置く。1 行ぶん縦が減る(2026-08-26 開発者要望)。
      summaryPlacement="inline"
      className="bg-white border-slate-200 px-4 py-3 mb-4"
      contentClassName=""
      data-testid="combo-list-filter-panel"
    >
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-end">
        {/* 仮登録フィルタ */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.draft")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={draftValue}
            onChange={(e) => handleDraftChange(e.target.value)}
          >
            <option value="all">{t("comboList.filter.draftAll")}</option>
            <option value="draft">{t("comboList.filter.draftOnly")}</option>
            <option value="official">
              {t("comboList.filter.officialOnly")}
            </option>
          </select>
        </div>

        {/* 始動位置フィルタ */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.position")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={filters.position ?? ""}
            onChange={(e) =>
              onFilterChange({ position: e.target.value || null })
            }
          >
            <option value="">{t("comboList.filter.all")}</option>
            {POSITION_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(POSITION_LABEL_KEYS[v] ?? v)}
              </option>
            ))}
          </select>
        </div>

        {/* ★★M27-03(P4M-021): ヒット種別フィルタ。
            開発者の逐語＝「ヒット種別が非常に横長。中身を変えずに短くできないか？」
            ／「イメージとしては固定のサイズ＋短縮表記を表示。プルダウンメニュー内では
            フルの長さを表示。」

            ★★ここだけ native <select> ではない。HTML の仕様上、閉じた表示は
              選択中 <option> のテキストそのものであり、「閉じたら短縮・開いたらフル」を
              1 つの <select> では表現できないためである(2026-09-05 開発者確定)。
            ★新しい部品は作っていない。既存の SearchableSelect に任意の shortLabel を
              1 つ足しただけである。
            ★DES-005 §5.7 の「単一選択の欄は選択肢が 10 以下ならボタン群」は当てない
              ——同規則はエディタ入力面の規則であり、フィルタ欄は 1 つもボタン化されていない。
            ★「全て」は value:"" の選択肢として一覧の先頭に置く。single モードの
              onChange は null を返せないため、これが解除の手段になる。 */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.hitType")}
          </Label>
          <SearchableSelect
            mode="single"
            options={hitTypeOptions}
            selected={filters.hitType ?? ""}
            onChange={(v) => onFilterChange({ hitType: v || null })}
            placeholder={t("comboList.filter.all")}
            searchPlaceholder={t("comboList.filter.hitTypeSearchPlaceholder")}
            emptyMessage={t("comboList.filter.hitTypeNotFound")}
            triggerAriaLabel={t("comboList.filter.hitType")}
            // ★固定幅。値の長さで横幅が動かなくなることが本件の要求そのものである。
            triggerClassName="w-[7.5rem] justify-between"
            data-testid="combo-list-hit-type-filter"
          />
        </div>

        {/* ★★M27-03(P4M-022): 始動技フィルタ。
            開発者の逐語＝「コンボ一覧のフィルターで、始動技も指定したい。」

            ★★P4M-020(一覧から始動技の表示を消す)と逆向きに見えるが両立する
              ——消したのは「表示」であり、こちらは「絞り込み」である。
            ★既存の絞り込み部品を使う(新しい部品を作らない＝指示書 §2.3-3)。
              技は 1 キャラあたり数十件あり、DES-005 §5.7 の「10 以下ならボタン群」には
              掛からない。⇒ 検索付きの SearchableSelect が既存の線引き上の受け皿である。 */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.starterMove")}
          </Label>
          <SearchableSelect
            mode="single"
            options={starterMoveOptions}
            selected={filters.starterMoveId ?? 0}
            onChange={(v) => onFilterChange({ starterMoveId: v || null })}
            placeholder={t("comboList.filter.all")}
            searchPlaceholder={t("comboList.filter.starterMoveSearchPlaceholder")}
            emptyMessage={t("comboList.filter.starterMoveNotFound")}
            triggerAriaLabel={t("comboList.filter.starterMove")}
            // ★固定幅にしない。固定幅の要求はヒット種別だけであり(短縮表記のため)、
            //   こちらは内容で伸びてよい。下限だけ CharacterSelector と同じ流儀で置く。
            triggerClassName="min-w-[8rem] justify-between"
            data-testid="combo-list-starter-move-filter"
          />
        </div>

        {/* 相手の状態フィルタ */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.opponentStance")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={filters.opponentStance ?? ""}
            onChange={(e) =>
              onFilterChange({ opponentStance: e.target.value || null })
            }
          >
            <option value="">{t("comboList.filter.all")}</option>
            {OPPONENT_STANCE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(OPPONENT_STANCE_LABEL_KEYS[v] ?? v)}
              </option>
            ))}
          </select>
        </div>

        {/* ★M37-07: 始動技の持続当てフィルタ(開発者裁定 2026-09-14)。
            ★本要素は上の flex 行の直接の子として並べる —— ラッパで包むと
              項目数が変わり、レイアウトの組み替えになる(下の注記と同じ理由)。 */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.starterMeaty")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            data-testid="combo-list-filter-starter-meaty"
            value={starterMeatyValue}
            onChange={(e) => handleStarterMeatyChange(e.target.value)}
          >
            <option value="all">{t("comboList.filter.all")}</option>
            {STARTER_MEATY_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(STARTER_MEATY_LABEL_KEYS[v])}
              </option>
            ))}
          </select>
        </div>

        {/* 成立条件フィルタ (M19-06)。ok / ng / 未検証 の 3 状態を混ぜない。
            セットプレイを 1 つも持たないコンボはどの値にも該当しない(圏外)。

            ★★M24-07(SM-139): ここから 3 軸がセットプレイ由来である。コンボ由来の 4 軸と
              1 本の flex 行に区別なく並んでおり、どれがセットプレイの絞り込みか読めなかった。
              ⇒ **軸名そのものに「セットプレイの」を前置**して見分けさせる。
              ★並びは変えない(指示書 §1.6-7)。要約ピルが軸名前置で「画面中央」の衝突を
                解いているのと同じ作法であり、第 2 の仕組みを作らない。
              ★ラッパ要素を足していない —— 3 つを 1 つの div で包むと flex の項目数が
                変わり、レイアウトの組み替えになる。 */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.setupResult")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
            value={filters.setupResult ?? ""}
            onChange={(e) => handleSetupResultChange(e.target.value)}
          >
            <option value="">{t("comboList.filter.all")}</option>
            {setupResultOptions.map((v) => (
              <option key={v} value={v}>
                {t(`setupResult.state.${v}`)}
              </option>
            ))}
          </select>
        </div>

        {/* 受け身種別フィルタ (成立条件の軸1。ラベルの正典は OKI_TECH_TYPE_LABELS) */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.setupTechType")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            value={filters.setupTechType ?? ""}
            disabled={axesDisabled}
            onChange={(e) =>
              onFilterChange({
                setupTechType: (e.target.value ||
                  null) as ComboListFiltersState["setupTechType"],
              })
            }
          >
            <option value="">{t("comboList.filter.all")}</option>
            {OKI_TECH_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(OKI_TECH_TYPE_LABEL_KEYS[v])}
              </option>
            ))}
          </select>
        </div>

        {/* 画面端フィルタ (成立条件の軸2。combos.position とは意味が違う＝コンボ終了時に相手が端にいるか) */}
        <div>
          <Label className="block text-xs text-slate-500 mb-1">
            {t("comboList.filter.setupInCorner")}
          </Label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            value={filters.setupInCorner === null ? "" : String(filters.setupInCorner)}
            disabled={axesDisabled}
            onChange={(e) => handleSetupInCornerChange(e.target.value)}
          >
            <option value="">{t("comboList.filter.all")}</option>
            <option value="true">{t("setupResult.corner.inCorner")}</option>
            <option value="false">{t("setupResult.corner.midScreen")}</option>
          </select>
        </div>

        {/* タグフィルタ(M24-02 §4.1 / CHANGE-133)。
            旧: 全タグを平坦なチップ列で常時表示していた(C-24 で最大高さ+スクロールに制限)。
            ★実測(2026-08-26・Chromium): レイアウトは破綻しないが、20 件でスクロールが始まり、
              60 件では 48 件が隠れる。選択済み 2 件を選んで読み直すと初期表示で 0 件しか見えない。
              ⇒ 「絞り込んだまま忘れる」事故が実際に起きるため、ドロップダウン + 検索 + 件数バッジへ移した。 */}
        {availableTags.length > 0 && (
          <div>
            <Label className="block text-xs text-slate-500 mb-1">
              {t("comboList.filter.tagFilter")}
            </Label>
            <SearchableSelect
              mode="multi"
              options={tagOptions}
              selected={filters.tagIds}
              onChange={(tagIds) => onFilterChange({ tagIds })}
              triggerLabel={t("comboList.filter.tagFilter")}
              searchPlaceholder={t("comboList.filter.tagSearchPlaceholder")}
              emptyMessage={t("comboList.filter.tagNotFound")}
              clearLabel={(count) => t("comboList.filter.tagClearSelection", { count })}
              triggerAriaLabel={t("comboList.filter.tagFilter")}
              data-testid="combo-list-tag-filter"
            />
          </div>
        )}

        {/* ソート (C-17: マイコンボと共通の部品) */}
        <ComboSortControls
          sort={filters.sort}
          order={filters.order}
          onSortChange={(sort) => onFilterChange({ sort })}
          onOrderChange={(order) => onFilterChange({ order })}
        />

        {/* フィルタリセット + 表示列カスタマイズ */}
        <div className="ml-auto self-end flex items-center gap-2">
          {/* C-05: フィルタリセットを一覧に常設。有効なフィルタがある時のみ活性。 */}
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("comboList.clearFilters")}
          </button>
          <ColumnVisibilityMenu
            visibility={visibility}
            onChange={onVisibilityChange}
            onReset={onVisibilityReset}
          />
        </div>
      </div>
    </CollapsibleFieldset>
  );
}
