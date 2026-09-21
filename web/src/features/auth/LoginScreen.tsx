import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import PasswordField from "./PasswordField";
import PasswordForgotHelp from "./PasswordForgotHelp";
import { normalizePassword } from "./passwordRules";
import { useLogin } from "./useLogin";

interface Props {
  /**
   * expired は「一度入っていたのに、また求められている」状態。
   *
   * ★サーバの再起動とパスワードの変更で起きる(DES-002 §8.1 の 12・14)。
   * ★時間切れの説明は書かない——セッションタイムアウトは設けていない(D-395)。
   */
  expired?: boolean;
}

/**
 * LoginScreen は入場ゲートのパスワードを受け取る。
 *
 * ★失敗は入力欄のすぐ下に出す。画面を遷移させない(指示書 §4.3-4)——
 * 遷移させると入力欄が消えて理由も分からなくなる。
 * ★理由は書き分けない(DES-002 §8.1)——サーバは invalid_password しか返さない。
 * ★入力欄はマスクを既定とする(D-397)。
 */
export default function LoginScreen({ expired = false }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [masked, setMasked] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const login = useLogin();

  // ★★ここで止めるのは「空」だけである(M22-08 §4.1-8＝最重要ゲート 1 の画面側)。
  // 空の検証子は作れないため、空での送信は必ず失敗する ⇒ 送って 401 を待つ必要が無い。
  // ★文字種(VAL-N05)・長さ(VAL-N06)の検査は絶対に掛けないこと。掛けると、既に
  // 非 ASCII や短いパスワードで決めた利用者が、正しい値を打っても押せなくなる。
  // ★前後の空白はサーバ側でも除去されるため(同 §4.1-5)、空白だけの入力は空と同じである。
  const isEmpty = normalizePassword(password) === "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login.isPending) return;
    if (isEmpty) return;
    login.mutate({ password });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-lg font-semibold mb-2" data-testid="auth-login-title">
          {expired ? t("auth.login.expiredTitle") : t("auth.login.title")}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {expired ? t("auth.login.expiredDescription") : t("auth.login.description")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label={t("auth.login.passwordLabel")}
            value={password}
            onChange={setPassword}
            masked={masked}
            onMaskedChange={setMasked}
            testIdPrefix="auth-login-password"
            autoFocus
            disabled={login.isPending}
          />

          {/* ★入力欄のすぐ下。ここが消えないことが要件である。 */}
          {login.isError && (
            <p className="text-sm text-red-600" role="alert" data-testid="auth-login-error">
              {t("auth.login.failed")}
            </p>
          )}

          <Button
            type="submit"
            disabled={isEmpty || login.isPending}
            data-testid="auth-login-submit"
          >
            {login.isPending ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
        </form>

        <div className="mt-6 border-t pt-4">
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="text-sm text-blue-600 underline-offset-4 hover:underline"
            data-testid="auth-login-forgot"
          >
            {t("auth.login.forgotLink")}
          </button>
          {showForgot && (
            <div className="mt-3">
              <PasswordForgotHelp />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
