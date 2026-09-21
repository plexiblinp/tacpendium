import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { onUnauthorized } from "@/lib/http-interceptor";
import { queryKeys } from "@/lib/query-keys";

import LoginScreen from "./LoginScreen";

import { useAuthStatus } from "./useAuthStatus";

interface Props {
  children: ReactNode;
}

/**
 * AuthGate は入場ゲートを画面側で成立させる。
 *
 * ★App より上に置く。App は先頭で useConfig()(= GET /api/config)を呼ぶが、
 * 同経路は保護対象であり未認証では 401 になる。ゲートを App の内側に置くと
 * 「読めない問い合わせを投げて再試行を待つ」形になり、実測で約 7 秒の空転が出る
 * (M22-01 の E2E が固定した既知の状態)。⇒ 通っていない間は App を描かない。
 *
 * ★出し分けは GET /api/auth/status の passwordRequired(実効値)で決める
 * (指示書 §4.1)。GET /api/config の security.passwordEnabled(生値)は見ない。
 *
 * ★認証済みならログイン画面を出さない(同 §4.8-5)。戻る・進むで「済んだ画面」へ
 * 戻さないのは、本ゲートが URL を持たない条件表示だからである。
 */
export default function AuthGate({ children }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useAuthStatus();
  const queryClient = useQueryClient();

  // 一度でも通っていたかを覚える。切れたときに文言を変えるためだけに使う。
  const wasAuthenticated = useRef(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (data?.authenticated) {
      wasAuthenticated.current = true;
    }
  }, [data?.authenticated]);

  // ★保護対象の 401 を 1 か所で受ける(指示書 §4.3-2)。
  // サーバ再起動・パスワード変更でセッションが消えたときもここへ来る(同 §4.3-5)。
  useEffect(
    () =>
      onUnauthorized(() => {
        if (wasAuthenticated.current) setExpired(true);
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
      }),
    [queryClient],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  // ★status が読めなかったときは通す。ゲートの故障でアプリ全体を止めない
  // (保護が無効な利用者が大多数であり、既定は無効である＝最重要ゲート 2)。
  const needsLogin = data?.passwordRequired === true && !data.authenticated;
  if (needsLogin) {
    return <LoginScreen expired={expired} />;
  }

  return <>{children}</>;
}
