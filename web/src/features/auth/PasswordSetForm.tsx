import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useUpdateConfig } from "@/features/config/useUpdateConfig";
import PasswordField from "./PasswordField";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRuleMessageKey,
  validateNewPassword,
} from "./passwordRules";
import { useSetPassword } from "./useSetPassword";

interface Props {
  /** 設定できたときに呼ばれる。ウィザードは次へ進み、設定画面は状態を引き直す。 */
  onDone: () => void;
  /** 「あとにする」を出すか。ウィザードでは出す(必須化しないため)。 */
  onSkip?: () => void;
}

/**
 * PasswordSetForm は初回のパスワード設定を受け取る(ウィザード / 設定画面)。
 *
 * ★現在のパスワードは要求しない(DES-002 §8.1 の 13)。
 * ★入力欄は表示を既定とする(D-396)。理由は失敗の代償が非対称であるため——
 * 初回設定のタイプミスは config.toml の編集を強いる。ログインは打ち直せば済む。
 * ★確認入力(2 回打たせる)は設けない。表示が既定であるため目で確認できる。
 * ★設定せずに進める(必須化しない＝D-396)。
 */
export default function PasswordSetForm({ onDone, onSkip }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [masked, setMasked] = useState(false);
  const setPasswordMutation = useSetPassword();
  const updateConfig = useUpdateConfig();

  // ★規則違反（DES-006 VAL-N05 / VAL-N06）。送る前に止めるために使う（M22-08 §4.1-7）。
  // ★入力が空のうちは出さない。打ち始める前から赤い文字を出すと、間違えたように読める。
  const violation = validateNewPassword(password);
  const showViolation = password !== "" && violation !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setPasswordMutation.isPending || updateConfig.isPending) return;
    if (password === "") return;
    // ★サーバ側にも同じ検査が在る。ここで止めるのは往復を省くためであり、
    //   サーバ側を省いてよいということではない（curl で直接叩ける）。
    if (violation !== null) return;
    setPasswordMutation.mutate(
      { currentPassword: "", newPassword: password },
      {
        // ★決めただけでは入場ゲートは効かない。
        // 検証子(password_hash)と有効化フラグ(password_enabled)は別物であり、
        // POST /api/auth/password は前者しか書かない(DES-002 §8.1 の 1・6。
        // M22-01 の as-built では SetPassword が PasswordEnabled を触らない)。
        // ⇒ 決めた直後に有効化まで通す。§3.4 の文言「ほかの機器からこのアプリを
        //    開くときに、このパスワードを入力してもらいます」はこれで事実になる。
        // ★順序が要る——検証子が未設定のまま有効化しようとすると
        //    DES-006 VAL-N03 が 422 で拒否する。設定 → 有効化の順に呼ぶこと。
        // ★有効化に失敗したら onDone を呼ばない。呼ぶと「決めたのにゲートが
        //    効いていない」状態を成功として畳んでしまう。失敗は下に出す。
        onSuccess: () =>
          updateConfig.mutate(
            { security: { passwordEnabled: true } },
            { onSuccess: () => onDone() },
          ),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-set-password">
      <p className="text-sm text-gray-600">{t("auth.setPassword.description")}</p>

      <PasswordField
        label={t("auth.setPassword.passwordLabel")}
        value={password}
        onChange={setPassword}
        masked={masked}
        onMaskedChange={setMasked}
        testIdPrefix="auth-set-password"
        disabled={setPasswordMutation.isPending || updateConfig.isPending}
      />

      {/* ★入力できる文字を先に述べる(文言方針 2: 状態を先に述べる)。 */}
      <p className="text-sm text-gray-600" data-testid="auth-set-password-rule">
        {t("auth.setPassword.rule")}
      </p>

      {/* ★「そのまま表示されます」を先に書く(文言方針 2: 状態を先に述べる)。 */}
      <p className="text-sm text-gray-600">{t("auth.setPassword.shownNote")}</p>

      <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
        <li>{t("auth.setPassword.hintOtherService")}</li>
        <li>{t("auth.setPassword.hintLater")}</li>
      </ul>

      {/* ★規則違反は「なぜ弾くか」まで書く(M22-08 §4.4 末尾)。
          「使えない文字です」だけだと、利用者は日本語が原因だと分からない。
          ★whitespace-pre-line は文言の改行を活かすため。 */}
      {showViolation && (
        <p
          className="text-sm text-red-600 whitespace-pre-line"
          role="alert"
          data-testid="auth-set-password-rule-error"
        >
          {/* ★下限・上限の数は定数から差し込む。文言側へ数を書くと
              サーバ側の定数と黙ってドリフトする(E-76)。 */}
          {t(passwordRuleMessageKey(violation), {
            min: PASSWORD_MIN_LENGTH,
            max: PASSWORD_MAX_LENGTH,
          })}
        </p>
      )}

      {(setPasswordMutation.isError || updateConfig.isError) && (
        <p className="text-sm text-red-600" role="alert" data-testid="auth-set-password-error">
          {t("auth.setPassword.failed")}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            password === "" ||
            violation !== null ||
            setPasswordMutation.isPending ||
            updateConfig.isPending
          }
          data-testid="auth-set-password-submit"
        >
          {t("auth.setPassword.submit")}
        </Button>
        {onSkip && (
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={setPasswordMutation.isPending || updateConfig.isPending}
            data-testid="auth-set-password-skip"
          >
            {t("auth.setPassword.later")}
          </Button>
        )}
      </div>
    </form>
  );
}
