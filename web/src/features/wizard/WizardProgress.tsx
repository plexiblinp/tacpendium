import { useTranslation } from "react-i18next";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
  const { t } = useTranslation();
  const pct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="mb-6">
      <p className="text-sm text-gray-600 mb-2">
        {t("wizard.step", { current: currentStep, total: totalSteps })}
      </p>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
