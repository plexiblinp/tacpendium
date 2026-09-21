import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

export function useCharacterSetups(characterId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.setups.byCharacter(characterId),
    queryFn: () => setupApi.listByCharacter(characterId!),
    enabled: !!characterId && characterId > 0,
  });
}
