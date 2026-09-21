import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import PasswordChangeForm from "@/features/auth/PasswordChangeForm";
import PasswordForgotHelp from "@/features/auth/PasswordForgotHelp";
import PasswordSetForm from "@/features/auth/PasswordSetForm";
import { useAuthStatus } from "@/features/auth/useAuthStatus";
import { useLogout } from "@/features/auth/useLogout";
import UserManagement from "@/features/user/UserManagement";
import { queryKeys } from "@/lib/query-keys";

/**
 * SettingsSectionUser は利用者とパスワードの設定を扱う。
 *
 * ★パスワードが設定済みかは GET /api/auth/status の passwordSet で見る。
 * GET /api/config の security.passwordEnabled は config.toml の生値であり、
 * 「有効だが未設定」の状態で実態とずれる(DES-002 §8.1 の 7)。
 */
export default function SettingsSectionUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: authStatus } = useAuthStatus();
  const logout = useLogout();
  const [mode, setMode] = useState<"idle" | "set" | "change">("idle");
  const [showForgot, setShowForgot] = useState(false);

  const passwordSet = authStatus?.passwordSet ?? false;
  // ★ログアウトの導線は「パスワード保護が実際に効いているとき」だけ出す
  // (M22-08 §4.3-2)。無効なときに出すと、押しても何も起きない導線になる。
  // ★見るのは実効値 passwordRequired であり、passwordSet ではない——
  // 検証子が在っても password_enabled = false ならゲートは効いていない。
  const passwordRequired = authStatus?.passwordRequired ?? false;

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.user.heading")}</h2>

      <UserManagement />

      <div className="space-y-3 mt-6 pt-6 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">{t("settings.user.passwordEnabled")}:</span>
          <span className="text-sm text-gray-500" data-testid="settings-user-password-state">
            {passwordSet ? t("common.yes") : t("settings.user.passwordNotSet")}
          </span>
        </div>

        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode(passwordSet ? "change" : "set")}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
            data-testid="settings-user-password-action"
          >
            {passwordSet ? t("settings.user.changePassword") : t("settings.user.setPassword")}
          </button>
        )}

        {mode === "set" && (
          <PasswordSetForm
            onDone={() => {
              setMode("idle");
              toast.success(t("auth.setPassword.done"));
              // ★設定した瞬間にゲートが効き始める。認証状態を引き直すと
              // AuthGate がログイン画面へ切り替わる(正しい振る舞いである)。
              void queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
            }}
            onSkip={() => setMode("idle")}
          />
        )}

        {mode === "change" && <PasswordChangeForm onCancel={() => setMode("idle")} />}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="text-sm text-blue-600 underline-offset-4 hover:underline"
            data-testid="settings-user-forgot"
          >
            {t("settings.user.passwordRecoveryHint")}
          </button>
          {showForgot && (
            <div className="mt-3">
              <PasswordForgotHelp />
            </div>
          )}
        </div>
      </div>

      {/* ★ログアウト。保護が実際に効いているときだけ出す(M22-08 §4.3-2)。
          ★「使う人を選び直す」(UserManagement 側)とは別物である(同 §4.3-4)。
          あちらは誰として操作するかを変えるだけで、入場ゲートは出ない。
          ⇒ 別のまとまりとして罫線で仕切り、文言でも役割を書き分ける。 */}
      {passwordRequired && (
        <div className="space-y-3 mt-6 pt-6 border-t">
          <h3 className="text-sm font-medium text-gray-900">
            {t("settings.user.logoutHeading")}
          </h3>
          <p className="text-sm text-gray-600">{t("settings.user.logoutNote")}</p>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            data-testid="settings-user-logout"
          >
            {t("settings.user.logout")}
          </button>
        </div>
      )}
    </section>
  );
}
