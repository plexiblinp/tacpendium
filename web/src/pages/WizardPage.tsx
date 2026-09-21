import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfig } from "@/features/config/useConfig";
import { useUpdateConfig } from "@/features/config/useUpdateConfig";
import WizardProgress from "@/features/wizard/WizardProgress";
import Step01Welcome from "@/features/wizard/Step01Welcome";
import Step02Language from "@/features/wizard/Step02Language";
import Step03Character from "@/features/wizard/Step03Character";
import Step04Preset from "@/features/wizard/Step04Preset";
import Step05Network from "@/features/wizard/Step05Network";
import Step06LanInfo from "@/features/wizard/Step06LanInfo";
import Step07Password from "@/features/wizard/Step07Password";
import Step07Complete from "@/features/wizard/Step07Complete";

export default function WizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();

  const [step, setStep] = useState(1);
  const [characterId, setCharacterId] = useState(config?.defaults.characterId ?? 1);
  const [presetId, setPresetId] = useState(config?.defaults.presetId ?? 1);
  const [lanEnabled, setLanEnabled] = useState(config?.server.mode === "lan");

  // 段の構成: 1 ようこそ / 2 言語 / 3 キャラ / 4 プリセット / 5 LAN 共有 /
  //           6 LAN 接続情報(LAN 時のみ) / 7 パスワード(LAN 時のみ) / 8 完了
  //
  // ★6 と 7 は LAN 共有が有効なときだけ出る。無効なら 5 → 8 へ飛ぶ。
  // ★パスワードを LAN 時のみにするのは DES-005 §5.1「任意、LAN共有有効時のみ表示」
  //   に従う。1 人で使う間は何も要求しない(FR502)。
  const LAN_ONLY_STEPS = 2;
  const totalSteps = lanEnabled ? 8 : 6;

  const nextStep = () => {
    if (step === 5 && !lanEnabled) {
      setStep(8);
    } else {
      setStep((s) => Math.min(s + 1, 8));
    }
  };

  const prevStep = () => {
    if (step === 8 && !lanEnabled) {
      setStep(5);
    } else {
      setStep((s) => Math.max(s - 1, 1));
    }
  };

  const displayStep = (() => {
    if (!lanEnabled && step >= 6) {
      return step - LAN_ONLY_STEPS;
    }
    return step;
  })();

  const handleFinish = () => {
    updateConfig.mutate(
      {
        server: { mode: lanEnabled ? "lan" : "local" },
        defaults: { characterId, presetId },
      },
      {
        onSuccess: () => {
          navigate("/", { replace: true });
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-lg w-full">
        <h1 className="text-center text-lg font-semibold text-gray-500 mb-4">
          {t("wizard.title")}
        </h1>
        {step > 1 && (
          <WizardProgress currentStep={displayStep} totalSteps={totalSteps} />
        )}
        {step === 1 && <Step01Welcome onNext={nextStep} />}
        {step === 2 && <Step02Language onNext={nextStep} onPrev={prevStep} />}
        {step === 3 && (
          <Step03Character
            characterId={characterId}
            onChange={setCharacterId}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={() => { setCharacterId(1); nextStep(); }}
          />
        )}
        {step === 4 && (
          <Step04Preset
            presetId={presetId}
            onChange={setPresetId}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 5 && (
          <Step05Network
            lanEnabled={lanEnabled}
            onChange={setLanEnabled}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 6 && lanEnabled && (
          <Step06LanInfo
            network={config?.network ?? { primaryLanIp: "", lanUrl: "" }}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}
        {step === 7 && lanEnabled && (
          <Step07Password onNext={nextStep} onPrev={prevStep} />
        )}
        {step === 8 && (
          <Step07Complete onFinish={handleFinish} isPending={updateConfig.isPending} />
        )}
      </div>
    </div>
  );
}
