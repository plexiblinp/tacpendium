import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordSetForm from "@/features/auth/PasswordSetForm";
import { queryKeys } from "@/lib/query-keys";

interface Props {
  open: boolean;
  /** パスワードが設定済みか(GET /api/auth/status の passwordSet)。 */
  passwordSet: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

type Step = "warn" | "consent" | "setPassword";

/**
 * LanModeConfirmDialog は LAN 共有モードを「有効化」する操作の確認を取る。
 *
 * DES-002 §8 の運用 3 点を実装する。
 *   - パスワード未設定なら警告し、設定へ誘導する
 *   - 設定せずに続行を選んだら明示的な同意を得る(チェックを入れるまで押せない)
 *   - ★必須化はしない(D-396)。パスワードが無くても ON にできる——
 *     必須にすると、忘れたときに LAN 共有そのものが使えなくなる詰みが生まれる。
 *
 * ★文言は CHANGE-113 §3.1 / §3.2 / §3.3。「ポート」「平文」を説明なしに使わない
 * (開発者の指摘・2026-08-15)。ポート番号は設定画面のネットワーク欄に出ている。
 *
 * LAN 化を取り消す(local 化する)操作は露出を減らすため確認不要(呼び出し側で即時適用)。
 */
export function LanModeConfirmDialog({ open, passwordSet, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("warn");
  const [consented, setConsented] = useState(false);

  // 開き直すたびに最初の段からやり直す(同意を持ち越さない)。
  useEffect(() => {
    if (open) {
      setStep("warn");
      setConsented(false);
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {step === "warn" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-700">
                {t("settings.network.enableConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="whitespace-pre-line">
                {passwordSet
                  ? t("settings.network.enableConfirmBodyWithPassword")
                  : t("settings.network.enableConfirmBodyNoPassword")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {passwordSet ? (
                <Button onClick={onConfirm} data-testid="lan-confirm-enable">
                  {t("settings.network.enableConfirmAction")}
                </Button>
              ) : (
                <>
                  <Button onClick={() => setStep("setPassword")} data-testid="lan-confirm-set-password">
                    {t("settings.network.enableConfirmSetPassword")}
                  </Button>
                  {/* ★必須化しない。設定せずに進める経路を必ず残す(D-396)。 */}
                  <Button
                    variant="outline"
                    onClick={() => setStep("consent")}
                    data-testid="lan-confirm-skip-password"
                  >
                    {t("settings.network.enableConfirmSkipPassword")}
                  </Button>
                </>
              )}
              <AlertDialogCancel>{t("settings.network.enableConfirmCancel")}</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}

        {step === "consent" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-700">
                {t("settings.network.consentTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.network.consentBody")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={consented}
                onCheckedChange={(v) => setConsented(v === true)}
                data-testid="lan-consent-check"
              />
              {t("settings.network.consentCheck")}
            </label>

            <AlertDialogFooter>
              {/* ★チェックを入れるまで押せない。これが「明示的な同意」の実体である。 */}
              <Button disabled={!consented} onClick={onConfirm} data-testid="lan-consent-enable">
                {t("settings.network.consentAction")}
              </Button>
              <Button variant="outline" onClick={() => setStep("warn")}>
                {t("settings.network.consentBack")}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === "setPassword" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("auth.setPassword.title")}</AlertDialogTitle>
            </AlertDialogHeader>
            <PasswordSetForm
              onDone={() => {
                // 設定できたら警告段へ戻る。今度は「設定済み」の文面になる。
                void queryClient.invalidateQueries({ queryKey: queryKeys.auth.status() });
                setStep("warn");
              }}
              onSkip={() => setStep("warn")}
            />
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
