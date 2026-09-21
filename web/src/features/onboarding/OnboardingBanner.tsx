import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { onboardingStorage } from "./onboarding-storage";

export default function OnboardingBanner() {
  const { t } = useTranslation();
  const [seen, setSeen] = useState(() => onboardingStorage.load() === true);

  if (seen) {
    return null;
  }

  const handleDismiss = () => {
    onboardingStorage.save(true);
    setSeen(true);
  };

  return (
    <div className="relative bg-blue-50 border border-blue-200 rounded-lg px-4 py-4">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("onboarding.dismiss")}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="text-sm font-bold text-blue-800 pr-6">
        {t("onboarding.bannerTitle")}
      </h2>
      <p className="text-sm text-slate-700 mt-1 pr-6">
        {t("onboarding.bannerBody")}
      </p>
    </div>
  );
}
