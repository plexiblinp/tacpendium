import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

export function useSetup(setupId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.setup.detail(setupId),
    queryFn: () => setupApi.get(setupId!),
    enabled: !!setupId && setupId > 0,
  });
}
