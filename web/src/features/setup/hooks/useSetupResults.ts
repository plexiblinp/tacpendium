import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";
import type { UpsertSetupResultInput } from "../types";

// セットプレイ成立条件の更新フック(M19-03)。
//
// 取得は行わない —— 成立条件はコンボ詳細レスポンスに同梱されるため(§4.3.1 の (a))、
// 更新後は combo クエリを無効化して親が引き直す。専用の取得クエリを持つと
// コンボ詳細と二重に取ることになる。
export function useSetupResultMutations(
  comboId: number,
  setupId: number,
  onChanged?: () => void,
) {
  const queryClient = useQueryClient();

  // invalidate は「再取得の完了まで待つ」Promise を返す。これを onSuccess から返すことで
  // 再取得が終わるまで isPending が true のままになり、ボタンが disabled のまま保たれる。
  //
  // 待たないと、連続操作で次の無効化が「まだ飛んでいる前回の GET」に相乗り(dedupe)し、
  // その GET は次の PUT より前の状態を返すため、画面が 1 手前の状態で止まる。
  // 追加の再取得も走らないので自然回復しない。
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.combo.detail(comboId) });
    onChanged?.();
  };

  const upsertMutation = useMutation({
    mutationFn: (input: UpsertSetupResultInput) =>
      setupApi.upsertResult(comboId, setupId, input),
    onSuccess: invalidate,
  });

  // 「未検証へ戻す」= 行の物理削除(§4.1.3)。
  const deleteMutation = useMutation({
    mutationFn: ({ techType, inCorner }: { techType: string; inCorner: boolean }) =>
      setupApi.deleteResult(comboId, setupId, techType, inCorner),
    onSuccess: invalidate,
  });

  return {
    upsert: (input: UpsertSetupResultInput) => upsertMutation.mutate(input),
    remove: (techType: string, inCorner: boolean) =>
      deleteMutation.mutate({ techType, inCorner }),
    isPending: upsertMutation.isPending || deleteMutation.isPending,
    isError: upsertMutation.isError || deleteMutation.isError,
  };
}
