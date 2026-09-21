import { useQueries } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { ComboDetail } from "../types";

export function useCompareCombos(ids: number[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.combo.detail(id),
      queryFn: () => fetchJSON<ComboDetail>(`/api/combos/${id}`),
      enabled: id > 0,
    })),
  });
}
