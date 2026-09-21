import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuthStatus } from "@/features/auth/useAuthStatus";
import type { ConfigResponse } from "./types";
import QRCodeModal from "./QRCodeModal";
import { LanModeConfirmDialog } from "./LanModeConfirmDialog";
import { useUpdateConfig } from "./useUpdateConfig";

interface Props {
  config: ConfigResponse;
  /**
   * 初期表示で QR モーダルを開くか(既定 false)。
   *
   * ★★トレイの「設定画面をブラウザで開く」のためにある(M34-02 段 3)。
   * 常駐アイコンから `/settings?qr=1` を開くと、この節の QR モーダルが最初から出る。
   * ⇒ トレイ側で QR を描かないための唯一の仕掛けである(Go の QR ライブラリと
   * Win32 の描画ウィンドウを増やさない)。
   *
   * ★クエリの解釈は SettingsPage が持つ(ルータを知っているのはページ側だから)。
   * ★LAN 共有が OFF のときは下の描画条件(isLan && lanUrl)で QR は出ない。これは
   * M22-06 が固定した「無効ではなく非描画」の仕様どおりであり、出し分けは作らない。
   */
  openQr?: boolean;
}

export default function SettingsSectionNetwork({ config, openQr = false }: Props) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(openQr);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const updateConfig = useUpdateConfig();
  // ★パスワードの設定状況で確認ダイアログの文面を出し分ける(DES-002 §8)。
  const { data: authStatus } = useAuthStatus();

  const isLan = config.server.mode === "lan";

  // mode 変更は再起動要(restartRequired)の挙動を踏襲し、ウィザードと同じ
  // useUpdateConfig 経路で server.mode を永続化する(WizardPage.tsx と同一)。
  const applyMode = (mode: "lan" | "local") => {
    updateConfig.mutate(
      { server: { mode } },
      {
        onSuccess: (data) => {
          toast.success(
            data.restartRequired
              ? t("settings.basic.restartRequired")
              : t("settings.basic.saved"),
          );
        },
        onError: () => toast.error(t("settings.validationError")),
      },
    );
  };

  // DES-002 §3.4: LAN 共有モードへの「有効化」時のみ確認ダイアログを表示する。
  // 無効化(local 化)は外部公開を減らす操作のため確認なしで即時適用する。
  const handleToggle = (next: boolean) => {
    if (next) {
      setShowEnableConfirm(true);
    } else {
      applyMode("local");
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.network.heading")}</h2>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={isLan}
            onCheckedChange={handleToggle}
            disabled={updateConfig.isPending}
            aria-label={t("settings.network.shareMode")}
          />
          <span className="text-sm font-medium text-gray-700">
            {t("settings.network.shareMode")}
          </span>
        </div>

        <div>
          <span className="text-sm text-gray-500">{t("settings.network.mode")}:</span>
          <span className="ml-2 text-sm font-medium">
            {isLan ? t("settings.network.modeLan") : t("settings.network.modeLocal")}
          </span>
        </div>

        <div>
          <span className="text-sm text-gray-500">{t("settings.network.port")}:</span>
          <span className="ml-2 text-sm font-mono">
            {isLan ? String(config.server.port) : `127.0.0.1:${config.server.port}`}
          </span>
        </div>

        {isLan && (
          <>
            <div>
              <span className="text-sm text-gray-500">{t("settings.network.ipAddress")}:</span>
              <span className="ml-2 text-sm font-mono">
                {config.network.primaryLanIp || t("settings.network.noLanIp")}
              </span>
            </div>

            {config.network.lanUrl && (
              <div>
                <span className="text-sm text-gray-500">{t("settings.network.lanUrl")}:</span>
                <span className="ml-2 text-sm font-mono text-blue-600 break-all">
                  {config.network.lanUrl}
                </span>
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className="ml-3 px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  {t("settings.network.showQr")}
                </button>
              </div>
            )}

            {/* ★状態を述べ、心当たりの無い人の不安を残さない(CHANGE-113 §3.9)。
                「ポートを開放しないでください」とは書かない——仕組みを理解して
                いない人には守れない指示になるため(開発者の指摘・2026-08-15)。 */}
            <p className="text-sm text-gray-500" data-testid="settings-network-external-note">
              {t("settings.network.externalNote")}
            </p>
          </>
        )}
      </div>

      {showQr && config.network.lanUrl && (
        <QRCodeModal url={config.network.lanUrl} onClose={() => setShowQr(false)} />
      )}

      <LanModeConfirmDialog
        open={showEnableConfirm}
        passwordSet={authStatus?.passwordSet ?? false}
        onOpenChange={setShowEnableConfirm}
        onConfirm={() => {
          setShowEnableConfirm(false);
          applyMode("lan");
        }}
      />
    </section>
  );
}
