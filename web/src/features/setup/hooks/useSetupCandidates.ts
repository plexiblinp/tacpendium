import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

export function useSetupCandidates(comboId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.setupCandidates.byCombo(comboId),
    queryFn: () => setupApi.getCandidates(comboId!),
    enabled: !!comboId && comboId > 0,
  });
}
