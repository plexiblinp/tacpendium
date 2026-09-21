import { fetchJSON } from "@/lib/api-client";

import type {
  SetplayMode,
  SetplaySort,
  SetplaySuggestionsResponse,
  SetplayTargetType,
} from "../types";

export interface GetSuggestionsParams {
  nMin: number;
  nMax: number; // N の上限(meaty のみ。0=上限なし。持続の長い技で深い N を除外)
  sort: SetplaySort;
  targetTypes: SetplayTargetType[];
  includeZeroDamage: boolean;
  targetMoveId?: number | null;
  mode: SetplayMode; // "meaty" | "gap"(M19-02)
  gMin: number; // gap の G 下限(mode=gap のときのみ意味を持つ)
  gMax: number; // gap の G 上限
  limit: number; // 返却件数上限(「さらに表示」で増やす)
}

export const setplayApi = {
  // GET /api/combos/:comboId/setplay-suggestions(副作用なし)。
  getSuggestions: (
    comboId: number,
    {
      nMin,
      nMax,
      sort,
      targetTypes,
      includeZeroDamage,
      targetMoveId,
      mode,
      gMin,
      gMax,
      limit,
    }: GetSuggestionsParams,
  ): Promise<SetplaySuggestionsResponse> => {
    const params = new URLSearchParams();
    params.set("n_min", String(nMin));
    // n_max は meaty のときだけ送る（gap では無視されるため）。0/未指定は上限なし。
    if (mode !== "gap" && nMax > 0) {
      params.set("n_max", String(nMax));
    }
    params.set("sort", sort);
    // 明示 target 指定時は種別/damage は無視されるが、無指定時のため常に送る。
    params.set("target_types", targetTypes.join(","));
    params.set("include_zero_damage", String(includeZeroDamage));
    if (targetMoveId != null) {
      params.set("target_move_id", String(targetMoveId));
    }
    params.set("mode", mode);
    if (mode === "gap") {
      params.set("g_min", String(gMin));
      params.set("g_max", String(gMax));
    }
    params.set("limit", String(limit));
    return fetchJSON<SetplaySuggestionsResponse>(
      `/api/combos/${comboId}/setplay-suggestions?${params.toString()}`,
    );
  },
};
