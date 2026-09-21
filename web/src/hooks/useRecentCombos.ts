import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";
import type { ComboListResponse } from "@/features/combo/types";
import { queryKeys } from "@/lib/query-keys";

export function useRecentCombos() {
  return useQuery({
    queryKey: queryKeys.combos.recent(),
    queryFn: () =>
      fetchJSON<ComboListResponse>(
        "/api/combos?sort=updated_at&order=desc&limit=3",
      ),
  });
}
