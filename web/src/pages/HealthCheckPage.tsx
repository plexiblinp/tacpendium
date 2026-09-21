import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJSON } from "@/lib/api-client";
import type { HealthResponse } from "@/types/api";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; version: string }
  | { kind: "error"; message: string };

export default function HealthCheckPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchJSON<HealthResponse>("/api/health")
      .then((res) => {
        if (cancelled) return;
        setStatus({ kind: "ok", version: res.version });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h1 className="text-xl font-semibold mb-4">{t("app.title")}</h1>
        {status.kind === "loading" && (
          <p className="text-slate-600">{t("health.loading")}</p>
        )}
        {status.kind === "ok" && (
          <p className="text-emerald-600 font-medium">
            {t("health.ok", { version: status.version })}
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-red-600 font-medium">
            {t("health.error", { message: status.message })}
          </p>
        )}
      </div>
    </main>
  );
}
