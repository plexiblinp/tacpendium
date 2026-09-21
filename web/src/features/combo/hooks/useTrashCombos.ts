import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { ComboListResponse } from "../types";

export function useTrashCombos(characterId: number) {
  return useQuery({
    queryKey: queryKeys.combos.trash(characterId),
    queryFn: () =>
      fetchJSON<ComboListResponse>(
        `/api/combos?character_id=${characterId}&only_deleted=true`,
      ),
  });
}
