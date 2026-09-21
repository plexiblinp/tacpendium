import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

export function useDeleteSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    // ★★M31-01(P4M-019): unlinkFrom は「このコンボとの紐付けも外す」の任意指定。
    //   ★外した紐付けは復元しても戻らない。⇒ 画面が文面でそれを言うこと。
    mutationFn: ({
      id,
      unlinkFrom,
    }: {
      id: number;
      parentComboIds: number[];
      unlinkFrom?: number;
    }): Promise<void> => setupApi.remove(id, unlinkFrom),
    onSuccess: (_, { id, parentComboIds }) => {
      queryClient.removeQueries({ queryKey: queryKeys.setup.detail(id) });
      parentComboIds.forEach((comboId) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
      });
      // 削除したセットプレイが他コンボの「紐付け候補」一覧に残らないよう、
      // setupCandidates キャッシュ全体をプレフィックス無効化する
      queryClient.invalidateQueries({ queryKey: queryKeys.setupCandidates.all() });
    },
  });
}
