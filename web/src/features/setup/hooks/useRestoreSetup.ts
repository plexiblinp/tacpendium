import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";
import type { RestoreSetupResponse } from "../types";

/**
 * ゴミ箱のセットプレイを復元する(M23-02 §4.2)。
 *
 * ★復元は紐付いていた全コンボへ一斉に戻る(案 P1 の撤回により紐付けが保たれている)。
 *   ⇒ 応答の parentComboIds に載っているコンボの詳細をすべて無効化する必要がある。
 *   1 コンボだけ無効化すると、他のコンボの画面に戻ったセットプレイが出ない。
 */
export function useRestoreSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<RestoreSetupResponse> => setupApi.restore(id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.setups.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.all() });
      restored.parentComboIds.forEach((comboId) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
      });
    },
  });
}
