import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";
import type { SetupResponse, UpdateSetupInput } from "../types";

export function useUpdateSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateSetupInput;
    }): Promise<SetupResponse> => setupApi.update(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.setup.detail(data.id), data);
      data.parentComboIds.forEach((comboId) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
      });
      // 編集後のセットプレイが他コンボの「紐付け候補」一覧に古い内容で残らないよう、
      // setupCandidates キャッシュ全体をプレフィックス無効化する
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.all() });
    },
  });
}
