import { useMutation } from "@tanstack/react-query";

import { authApi } from "./authApi";
import type { SetPasswordRequest } from "./types";

/**
 * useSetPassword はパスワードを設定・変更する。
 *
 * ★成功しても認証状態を自動では引き直さない。呼び出し側が明示的に行うこと。
 * 理由——変更が通ると既存セッションが全破棄され(DES-002 §8.1 の 14)、
 * 認証状態を引き直した瞬間に AuthGate がログイン画面へ切り替わる。
 * ここで自動化すると「パスワードを変えました。もう一度入ってください」を
 * 利用者が読む前に画面が消える。★黙って切れる形にしないのが要件である
 * (指示書 §4.4-4)。⇒ 引き直しは「ログイン画面へ」を押した時点で行う。
 */
export function useSetPassword() {
  return useMutation({
    mutationFn: (req: SetPasswordRequest) => authApi.setPassword(req),
  });
}
