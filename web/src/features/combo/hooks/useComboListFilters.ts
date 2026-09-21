import { useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  SORT_FIELD_VALUES,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_ORDER,
  type SortField,
  type SortOrder,
} from "@/constants/combo-list";
import { createSessionStorageHelper } from "@/lib/browser-storage";
import { OKI_TECH_TYPES, type OkiTechType } from "@/constants/oki";
import {
  SETUP_RESULTS,
  SETUP_RESULT_UNVERIFIED,
  type SetupResultState,
} from "@/constants/setup-result";

// C-01/N-30: 一覧以外(詳細/編集/登録)へ遷移して戻った際にフィルタ/ソートを保持する。
// in-app セッション内のみの保持(タブを閉じると消える)。恒久ブラウザストレージ化はしない(フェーズ3)。
const FILTERS_STORAGE_KEY = "combo-list-filters-v1";
const filtersStorage = createSessionStorageHelper<string>(FILTERS_STORAGE_KEY);

export interface ComboListFiltersState {
  characterId: number | null;
  tagIds: number[];
  position: string | null;
  hitType: string | null;
  // ★★M27-03(P4M-022): 始動技による絞り込み。
  //   ★始動技はキャラに属する。⇒ キャラを切り替えたら解除する(ComboListPage)。
  //     残すと、別キャラの技 id で絞ったまま 0 件の一覧が出て原因が見えない。
  starterMoveId: number | null;
  opponentStance: string | null;
  // ★★M37-07: 始動技の持続当てによる絞り込み(開発者裁定 2026-09-14)。
  //   ★null = 絞り込みなし。列は NOT NULL のため値は true / false の 2 通りだけ。
  starterMeaty: boolean | null;
  isDraft: boolean | null;
  // 成立条件(combo_setup_results)による絞り込み(M19-06)。
  // setupResult が null のあいだは軸(setupTechType / setupInCorner)は効かない
  // ＝バックエンドの ListFilter と同じ扱い。UI 側も軸の select を無効化する。
  setupResult: SetupResultState | null;
  setupTechType: OkiTechType | null;
  setupInCorner: boolean | null;
  sort: SortField;
  order: SortOrder;
}

/**
 * 「効いている」フィルタ軸の一覧(M24-02 §4.2)。
 *
 * ★hasActiveFilters と、折りたたみ時の要約表示は本関数を唯一の源にする。
 *   同じ判定を 2 か所に持つと、軸が増えたとき片方だけ追随して他方が古い規則で
 *   動き続ける(教訓 E-76)。実際 M19-06 で 3 軸が増えている。
 * ★characterId / sort / order は含めない。
 *   キャラは「絞り込み」ではなく対象の指定であり(DES-005 §5.4 のヘッダ帯)、
 *   ソートは並べ替えであって絞り込みではないため。
 *   これは「フィルタを解除」が character_id / sort / order を残す挙動とも一致する。
 */
export const ACTIVE_FILTER_KEYS = [
  "tagIds",
  "isDraft",
  "position",
  "hitType",
  "starterMoveId",
  "opponentStance",
  "starterMeaty",
  "setupResult",
  "setupTechType",
  "setupInCorner",
] as const;

export type ActiveFilterKey = (typeof ACTIVE_FILTER_KEYS)[number];

export function activeFilterKeys(
  filters: ComboListFiltersState,
): ActiveFilterKey[] {
  return ACTIVE_FILTER_KEYS.filter((key) =>
    key === "tagIds" ? filters.tagIds.length > 0 : filters[key] !== null,
  );
}

// ★★M27-03 レビュー(中-1): 値域外の URL を null へ落とす。
//
// 他軸は parseSetupResultOrNull / parseOkiTechTypeOrNull / isValidSortField が
// 値域外を null にする流儀を持っており、**新軸だけがその外に居ると 4 つの不整合が
// 同時に起きる**——`?starter_move_id=0` で (1) 「効いているフィルタ」に数えられ
// (2) 要約ピルに「始動技#0」が出て (3) コントロールの表示は「全て」になり
// (4) BE が 400 を返して一覧そのものが出ない。
// ★BE の受け口(strconv.ParseInt + id <= 0)と同じ値域にしてある。
function parsePositiveIntOrNull(v: string | null): number | null {
  const n = parseIntOrNull(v);
  return n !== null && n > 0 ? n : null;
}

function parseIntOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/**
 * 既定キャラ解決の段 2(M24-01 §4.1-3)。セッションに残っている「最後に選んだキャラ」を読む。
 *
 * ★読むのはキャラクターだけである(§4.1-7)。タグ・状況・仮登録トグル・ソートは読まない
 *   ——読むと DES-005 §5.5「戻り時のフィルタ/ソート保持は対象外(コンボ一覧のみ)」を破る。
 * ★新しいキーを作らず、既存の combo-list-filters-v1 に相乗りする(先例 = CHANGE-095 / M19-06)。
 * ★読めない・壊れているときは null を返して段 3 へ落ちる(例外を投げない)。
 *   filtersStorage.load() が try-catch 済みで、失敗時は null を返す。
 */
export function readSessionCharacterId(): number | null {
  const saved = filtersStorage.load();
  if (typeof saved !== "string" || saved === "") return null;
  try {
    return parseIntOrNull(new URLSearchParams(saved).get("character_id"));
  } catch {
    return null;
  }
}

function parseTagIds(v: string | null): number[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function parseBoolOrNull(v: string | null): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function isValidSortField(v: string | null): v is SortField {
  return (
    v != null && (SORT_FIELD_VALUES as readonly string[]).includes(v)
  );
}

// 成立条件の 3 状態(M19-06)。値域外の URL は未指定として扱う(isValidSortField と同じ流儀)。
function parseSetupResultOrNull(v: string | null): SetupResultState | null {
  if (v == null) return null;
  if (v === SETUP_RESULT_UNVERIFIED) return SETUP_RESULT_UNVERIFIED;
  return (SETUP_RESULTS as readonly string[]).includes(v)
    ? (v as SetupResultState)
    : null;
}

function parseOkiTechTypeOrNull(v: string | null): OkiTechType | null {
  if (v == null) return null;
  return (OKI_TECH_TYPES as readonly string[]).includes(v)
    ? (v as OkiTechType)
    : null;
}

/**
 * 段 2 の記憶のうち「最後に選んだキャラ」だけを捨てる(M24-01 追補②)。
 *
 * ★呼び出し口は useUpdateConfig の onSuccess 1 か所だけである。画面側に置かない
 *   ——次に既定キャラを書く画面が現れたとき、呼び忘れても何も言わないため。
 *
 * ★なぜ要るか: 解決順は 段1 URL > 段2 セッション > 段3b config > 段4 であり、
 *   段 2 が残っている限り「設定やウィザードで既定キャラを変えても一覧が変わらない」。
 *   ⇒ 利用者が既定を明示的に宣言したイベントで、それ以前の記憶を無効化する。
 *   ★段の順序は変えない(段 3b を段 2 より先にすると SM-044〔一覧でキャラを選んで
 *   詳細へ行って戻ったら維持される〕が壊れる)。
 *
 * ★キャラ以外の軸(tag_ids / is_draft / sort / order / setup_*)は残す。
 *   既定キャラを変えただけで作業中の絞り込みまで飛ぶのは行き過ぎである。
 * ★未保存・壊れた値のときは何もしない(読めない値を書き換えて悪化させない)。
 */
export function clearSessionCharacterId(): void {
  const saved = filtersStorage.load();
  if (typeof saved !== "string" || saved === "") return;
  try {
    const params = new URLSearchParams(saved);
    if (!params.has("character_id")) return;
    params.delete("character_id");
    const rest = params.toString();
    if (rest === "") filtersStorage.remove();
    else filtersStorage.save(rest);
  } catch {
    // 壊れている値には触らない。次に読むとき readSessionCharacterId が null を返す。
  }
}

export function useComboListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredRef = useRef(false);

  // 初回マウント時、URL にパラメータが無ければ前回のセッション保存値からフィルタ/ソートを復元する。
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (searchParams.toString() === "") {
      const saved = filtersStorage.load();
      if (saved) {
        setSearchParams(new URLSearchParams(saved), { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  // フィルタ/ソート(=URL クエリ)が変わるたびにセッションへ保存する。
  useEffect(() => {
    filtersStorage.save(searchParams.toString());
  }, [searchParams]);

  const filters = useMemo<ComboListFiltersState>(() => {
    const sortRaw = searchParams.get("sort");
    return {
      characterId: parseIntOrNull(searchParams.get("character_id")),
      tagIds: parseTagIds(searchParams.get("tag_ids")),
      position: searchParams.get("position"),
      hitType: searchParams.get("hit_type"),
      starterMoveId: parsePositiveIntOrNull(searchParams.get("starter_move_id")),
      opponentStance: searchParams.get("opponent_stance"),
      starterMeaty: parseBoolOrNull(searchParams.get("starter_meaty")),
      isDraft: parseBoolOrNull(searchParams.get("is_draft")),
      setupResult: parseSetupResultOrNull(searchParams.get("setup_result")),
      setupTechType: parseOkiTechTypeOrNull(searchParams.get("setup_tech_type")),
      setupInCorner: parseBoolOrNull(searchParams.get("setup_in_corner")),
      sort: isValidSortField(sortRaw) ? sortRaw : DEFAULT_SORT_FIELD,
      order: searchParams.get("order") === "asc" ? "asc" : "desc",
    };
  }, [searchParams]);

  const updateFilters = useCallback(
    (next: Partial<ComboListFiltersState>) => {
      const merged = { ...filters, ...next };
      const params = new URLSearchParams();
      if (merged.characterId !== null)
        params.set("character_id", String(merged.characterId));
      if (merged.tagIds.length > 0)
        params.set("tag_ids", merged.tagIds.join(","));
      if (merged.position !== null) params.set("position", merged.position);
      if (merged.hitType !== null) params.set("hit_type", merged.hitType);
      if (merged.starterMoveId !== null)
        params.set("starter_move_id", String(merged.starterMoveId));
      if (merged.opponentStance !== null)
        params.set("opponent_stance", merged.opponentStance);
      if (merged.starterMeaty !== null)
        params.set("starter_meaty", String(merged.starterMeaty));
      if (merged.isDraft !== null)
        params.set("is_draft", String(merged.isDraft));
      if (merged.setupResult !== null)
        params.set("setup_result", merged.setupResult);
      if (merged.setupTechType !== null)
        params.set("setup_tech_type", merged.setupTechType);
      if (merged.setupInCorner !== null)
        params.set("setup_in_corner", String(merged.setupInCorner));
      if (merged.sort !== DEFAULT_SORT_FIELD) params.set("sort", merged.sort);
      if (merged.order !== DEFAULT_SORT_ORDER)
        params.set("order", merged.order);
      setSearchParams(params);
    },
    [filters, setSearchParams],
  );

  const hasActiveFilters = useMemo(
    () => activeFilterKeys(filters).length > 0,
    [filters],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.characterId !== null)
      params.set("character_id", String(filters.characterId));
    if (filters.sort !== DEFAULT_SORT_FIELD) params.set("sort", filters.sort);
    if (filters.order !== DEFAULT_SORT_ORDER)
      params.set("order", filters.order);
    setSearchParams(params);
  }, [filters.characterId, filters.sort, filters.order, setSearchParams]);

  return { filters, updateFilters, hasActiveFilters, clearFilters };
}
