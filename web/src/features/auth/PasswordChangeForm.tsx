import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";

import { AuthApiError } from "./authApi";
import PasswordField from "./PasswordField";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRuleMessageKey,
  validateNewPassword,
} from "./passwordRules";
import { useSetPassword } from "./useSetPassword";

interface Props {
  onCancel: () => void;
}

/**
 * PasswordChangeForm は設定画面からのパスワード変更を受け取る。
 *
 * ★現在のパスワードを要求する(DES-002 §8.1 の 13)。
 * ★変更が通ると既存セッションが全破棄される(同 14)。変更した端末自身も切れるため、
 * 「もう一度入ってください」と伝えてログインへ戻す導線を出す(指示書 §4.4-4)。
 * ★黙って 401 が出るだけにしない——それが本フォームの主眼である。
 */
export default function PasswordChangeForm({ onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  // ★現在欄はマスク既定、新パスワード欄は表示既定。既定値だけが非対称である(下記)。
  const [currentMasked, setCurrentMasked] = useState(true);
  const [masked, setMasked] = useState(false);
  const [done, setDone] = useState(false);
  const changePassword = useSetPassword();

  // ★★検査は「新しいパスワード」欄にだけ掛ける(M22-08 §4.1-2＝最重要ゲート 1)。
  // 「いまのパスワード」欄へ掛けてはならない——既に非 ASCII や短いパスワードで
  // 決めた利用者が、変更もできなくなる。詰みが生まれる。
  const violation = validateNewPassword(next);
  const showViolation = next !== "" && violation !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (changePassword.isPending) return;
    if (current === "" || next === "") return;
    if (violation !== null) return;
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      { onSuccess: () => setDone(true) },
    );
  };

  // ★成功後。ここで認証状態を引き直すと AuthGate がログイン画面へ切り替わる。
  // 引き直しを押下まで遅らせているのは、この案内を読ませるためである。
  if (done) {
    return (
      <div className="space-y-3" data-testid="auth-change-password-done">
        <p className="text-sm">{t("auth.changePassword.doneTitle")}</p>
        <Button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
          }}
          data-testid="auth-change-password-done-action"
        >
          {t("auth.changePassword.doneAction")}
        </Button>
      </div>
    );
  }

  const wrongCurrent =
    changePassword.error instanceof AuthApiError && changePassword.error.status === 401;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-change-password">
      {/* ★2 つの欄は「既定値」だけが非対称で、切替はどちらも持つ。
          現在欄＝マスク既定。人が見ている前で開くことがあり、既に決めてある値を
          最初から晒す理由が無い(ログイン欄と同じ考え方＝D-397)。
          新パスワード欄＝表示既定(D-396)。初回入力のタイプミスは config.toml の
          編集を招くため、代償が非対称である。
          ★現在欄にも切替を付けたのは開発者の実機確認による(2026-08-16 の指摘 ④)。
          打ち間違えても「いまのパスワードが違います」しか返らず、確かめる手段が
          無かった。CHANGE-113 §3.7 の図は現在欄に切替を描いていない——as-built が
          正であり、差分は設計伝達レポートで通知してある。 */}
      <PasswordField
        label={t("auth.changePassword.currentLabel")}
        value={current}
        onChange={setCurrent}
        masked={currentMasked}
        onMaskedChange={setCurrentMasked}
        testIdPrefix="auth-change-password-current"
        disabled={changePassword.isPending}
      />

      <PasswordField
        label={t("auth.changePassword.newLabel")}
        value={next}
        onChange={setNext}
        masked={masked}
        onMaskedChange={setMasked}
        testIdPrefix="auth-change-password-new"
        disabled={changePassword.isPending}
      />

      {/* ★入力できる文字は「新しいパスワード」欄にだけ掛かる規則である。 */}
      <p
        className="text-sm text-gray-600"
        data-testid="auth-change-password-rule"
      >
        {t("auth.setPassword.rule")}
      </p>

      <p className="text-sm text-gray-600">{t("auth.changePassword.warning")}</p>

      {/* ★規則違反は「なぜ弾くか」まで書く(M22-08 §4.4 末尾)。 */}
      {showViolation && (
        <p
          className="text-sm text-red-600 whitespace-pre-line"
          role="alert"
          data-testid="auth-change-password-rule-error"
        >
          {/* ★下限・上限の数は定数から差し込む。文言側へ数を書くと
              サーバ側の定数と黙ってドリフトする(E-76)。 */}
          {t(passwordRuleMessageKey(violation), {
            min: PASSWORD_MIN_LENGTH,
            max: PASSWORD_MAX_LENGTH,
          })}
        </p>
      )}

      {changePassword.isError && (
        <p className="text-sm text-red-600" role="alert" data-testid="auth-change-password-error">
          {wrongCurrent
            ? t("auth.changePassword.wrongCurrent")
            : t("auth.setPassword.failed")}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            current === "" ||
            next === "" ||
            violation !== null ||
            changePassword.isPending
          }
          data-testid="auth-change-password-submit"
        >
          {t("auth.changePassword.submit")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("auth.changePassword.cancel")}
        </Button>
      </div>
    </form>
  );
}
