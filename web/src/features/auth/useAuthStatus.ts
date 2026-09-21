import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { authApi } from "./authApi";
import type { AuthStatus } from "./types";

/**
 * useAuthStatus は入場ゲートの状態を取得する。
 *
 * ★これが「ログイン画面を出すか」の唯一の判断材料である(指示書 §4.1-1)。
 * GET /api/config の security.passwordEnabled を見てはならない——
 * あちらは保護対象で未認証では読めず、かつ config.toml の生値であるため
 * 実効値と割れる(DES-002 §8.1 の 7)。
 *
 * ★retry しない。本経路は保護対象外であり、失敗は再試行で直る類ではない。
 * 既定の 3 回再試行を残すと、起動が無意味に遅くなる。
 */
export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: queryKeys.auth.status(),
    queryFn: () => authApi.status(),
    retry: false,
  });
}
