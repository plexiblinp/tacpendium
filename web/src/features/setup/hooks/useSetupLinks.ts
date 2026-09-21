import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

export function useCreateSetupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      setupId,
    }: {
      comboId: number;
      setupId: number;
    }): Promise<void> => setupApi.createLink(comboId, setupId),
    onSuccess: (_, { comboId, setupId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.detail(setupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.byCombo(comboId) });
    },
  });
}

export function useDeleteSetupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      comboId,
      setupId,
    }: {
      comboId: number;
      setupId: number;
    }): Promise<void> => setupApi.deleteLink(comboId, setupId),
    onSuccess: (_, { comboId, setupId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.detail(setupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.byCombo(comboId) });
    },
  });
}
