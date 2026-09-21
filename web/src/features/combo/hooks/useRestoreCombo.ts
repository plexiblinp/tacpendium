import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import type { RestoreComboResponse } from "../types";

/**
 * ゴミ箱のコンボを復元する。
 *
 * ★M23-04: 応答本文を返す。復元は成功していても warnings が載っていることがあり
 * (§4.1＝警告で復元を止めない)、呼び出し側がそれを利用者へ見せる必要がある。
 * ★warnings が 0 件のときはキー自体が無い(バックエンドが omitempty)。
 */
export function useRestoreCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<RestoreComboResponse> => {
      const res = await fetch(`/api/combos/${id}/restore`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        throw new Error(body.error?.message ?? body.error?.code ?? `HTTP ${res.status}`);
      }
      // ★本文のパース失敗で失敗扱いにしない。サーバ側では復元が成立しているのに
      //   画面へ「復元に失敗しました」と出るのが最悪の形である。warnings が読めない
      //   ことは、復元が落ちたことよりはるかに軽い。
      return await res.json().catch(() => ({})) as RestoreComboResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      // ★復元は基準に触らない(deleted_at と updated_at だけ)。⇒ 影響ありのコンボを
      //   復元すると件数は元へ戻る。告知も一緒に落として辻褄を合わせる(M28-02c)。
      qc.invalidateQueries({ queryKey: queryKeys.notices.gameUpdate() });
    },
  });
}
