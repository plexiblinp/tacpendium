import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { useConfig } from "@/features/config/useConfig";
import SettingsSectionBasic from "@/features/config/SettingsSectionBasic";
import SettingsSectionUser from "@/features/config/SettingsSectionUser";
import SettingsSectionNetwork from "@/features/config/SettingsSectionNetwork";
import SettingsSectionData from "@/features/config/SettingsSectionData";
import SettingsSectionPresetLink from "@/features/config/SettingsSectionPresetLink";
import SettingsSectionDetails from "@/features/config/SettingsSectionDetails";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: config, isLoading, error } = useConfig();
  // ★★?qr=1 は常駐アイコンの「設定画面をブラウザで開く」から来る(M34-02 段 3)。
  // トレイ側で QR を描くと Go の QR ライブラリと Win32 の描画ウィンドウが増えるため、
  // 既存の QR モーダル(QRCodeModal・FR407)を開くところまでにしている。
  //
  // ★★クエリは URL から落とさない(意図的。レビュー指摘 低-5) —— これはディープ
  // リンクであり、リロードすると同じ画面(QR が開いた設定画面)へ戻るのが素直である。
  // ★落とすと履歴を書き換えることになり、戻る操作の挙動が変わる。⇒ トレイから
  // 何度でも同じ URL を開ける方を採る。
  const [searchParams] = useSearchParams();
  const openQr = searchParams.get("qr") === "1";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {isLoading && <p className="text-gray-500">{t("common.loading")}</p>}
        {error && (
          <p className="text-red-600">
            {t("common.error", { message: error instanceof Error ? error.message : String(error) })}
          </p>
        )}
        {config && (
          <>
            <SettingsSectionBasic config={config} />
            <SettingsSectionUser />
            <SettingsSectionNetwork config={config} openQr={openQr} />
            <SettingsSectionData config={config} />
            <SettingsSectionPresetLink />
            <SettingsSectionDetails config={config} />
          </>
        )}
      </div>
    </main>
  );
}
