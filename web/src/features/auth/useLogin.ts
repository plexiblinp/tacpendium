import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { authApi } from "./authApi";
import type { LoginRequest } from "./types";

/**
 * useLogin は入場ゲートを通す。
 *
 * ★成功したら認証状態を引き直す。ゲートはその結果で閉じる。
 * ★失敗(401 invalid_password)は呼び出し側が入力欄のそばに出す。画面を遷移させない
 * (指示書 §4.3-4)。理由は書き分けない——サーバが invalid_password しか返さない
 * (DES-002 §8.1)。
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: LoginRequest) => authApi.login(req),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
    },
  });
}
