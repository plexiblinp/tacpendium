import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { authApi } from "./authApi";

/**
 * useLogout は入場ゲートを明示的に出る。
 *
 * ★成功したら認証状態を引き直す。`AuthGate` は `passwordRequired && !authenticated`
 * を見ているため、引き直した時点でログイン画面へ切り替わる（M22-08 §4.3-3）。
 * これは `M22-02` が作った 401 の捕捉と同じ経路である——あちらも
 * 認証状態のキーを invalidate してゲートを閉じ直す。
 *
 * ★「利用者の選び直し」とは別物である（同 §4.3-4）。あちらはヘッダの利用者表示が
 * 担う。ログアウトは入場ゲートを出ることであり、誰として操作するかとは無関係である。
 *
 * ★サーバ側は冪等である（セッションが無くても 204）。失敗しても画面を止めない。
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}
