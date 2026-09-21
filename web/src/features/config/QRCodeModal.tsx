import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

import { ModalPresenceMarker } from "@/lib/modal-presence";

interface QRCodeModalProps {
  url: string;
  onClose: () => void;
}

export default function QRCodeModal({ url, onClose }: QRCodeModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("qrModal.title")}
        tabIndex={-1}
        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ★本モーダルは共有プリミティブ（`components/ui/dialog`）を通らない自作である。
            ⇒ 「モーダルが開いている間は物理入力を受け手へ配送しない」（`DES-005` §6.4.3
            項目 4″）に自分で参加する必要がある。**共有プリミティブが自動で拾ってくれるのは
            そちらを通ったものだけである。** */}
        <ModalPresenceMarker />
        <h2 className="text-lg font-semibold mb-2">{t("qrModal.title")}</h2>
        <p className="text-sm text-gray-600 mb-4">{t("qrModal.description")}</p>
        <div className="flex justify-center mb-4">
          <QRCodeSVG value={url} size={200} />
        </div>
        <p className="text-center text-sm text-gray-700 mb-4 break-all">{url}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            {t("qrModal.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
