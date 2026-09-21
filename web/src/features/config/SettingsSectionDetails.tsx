import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJSON } from "@/lib/api-client";
import type { HealthResponse } from "@/types/api";
import OnboardingGuideDialog from "@/features/onboarding/OnboardingGuideDialog";
import type { ConfigResponse } from "./types";

interface Props {
  config: ConfigResponse;
}

export default function SettingsSectionDetails({ config }: Props) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchJSON<HealthResponse>("/api/health")
      .then((res) => {
        if (!cancelled) setVersion(res.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.details.heading")}</h2>

      <div className="space-y-3">
        <div>
          <span className="text-sm text-gray-500">{t("settings.details.logFile")}:</span>
          <span className="ml-2 text-sm font-mono">{config.logging.file}</span>
        </div>

        <div>
          <span className="text-sm text-gray-500">{t("settings.details.version")}:</span>
          <span className="ml-2 text-sm font-mono">{version || "..."}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <OnboardingGuideDialog />
      </div>
    </section>
  );
}
