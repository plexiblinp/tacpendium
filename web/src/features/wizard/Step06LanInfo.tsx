import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NetworkInfo } from "@/features/config/types";
import QRCodeModal from "@/features/config/QRCodeModal";

interface Props {
  network: NetworkInfo;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step06LanInfo({ network, onNext, onPrev }: Props) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t("wizard.step6.title")}</h2>
      <p className="text-gray-600 mb-6">{t("wizard.step6.description")}</p>
      {network.lanUrl ? (
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">{t("settings.network.lanUrl")}</p>
          <p className="font-mono text-blue-600 break-all">{network.lanUrl}</p>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="mt-3 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
          >
            {t("wizard.step6.showQr")}
          </button>
        </div>
      ) : (
        <p className="text-gray-400 mb-6">{t("settings.network.noLanIp")}</p>
      )}
      <div className="flex justify-between">
        <button type="button" onClick={onPrev} className="px-4 py-2 text-gray-600 hover:text-gray-800">
          {t("wizard.prev")}
        </button>
        <button type="button" onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {t("wizard.next")}
        </button>
      </div>
      {showQr && network.lanUrl && (
        <QRCodeModal url={network.lanUrl} onClose={() => setShowQr(false)} />
      )}
    </div>
  );
}
