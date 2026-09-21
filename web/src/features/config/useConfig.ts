import { useQuery } from "@tanstack/react-query";
import { configApi } from "@/lib/configApi";
import { queryKeys } from "@/lib/query-keys";

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config(),
    queryFn: configApi.get,
    staleTime: 60 * 1000,
  });
}
