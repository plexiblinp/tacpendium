import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

/**
 * ゴミ箱のセットプレイを完全削除する(M23-02 §4.3)。
 *
 * ★生きたコンボから参照されている間は 409 setup_in_use で拒否される(D-484)。
 *   拒否は ApiError として呼び出し側へ伝わる。画面は参照元コンボを列挙しないが
 *   (D-485)、拒否されたことは必ず利用者へ届ける(§4.4-3c)。
 */
export function usePermanentDeleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<void> => setupApi.permanentDelete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.setup.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.setups.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.all() });
    },
  });
}
