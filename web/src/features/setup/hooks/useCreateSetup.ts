import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";
import type { CreateSetupInput, CreateSetupResponse } from "../types";

export function useCreateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      input,
    }: {
      comboId: number;
      input: CreateSetupInput;
    }): Promise<CreateSetupResponse> => setupApi.create(comboId, input),
    onSuccess: (data, { comboId }) => {
      queryClient.setQueryData(queryKeys.setup.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
    },
  });
}
