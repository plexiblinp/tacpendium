import { fetchJSON } from "@/lib/api-client";
import type { ConfigResponse, UpdateConfigRequest } from "@/features/config/types";

export const configApi = {
  get: () => fetchJSON<ConfigResponse>("/api/config"),
  update: (req: UpdateConfigRequest) =>
    fetchJSON<ConfigResponse>("/api/config", {
      method: "PUT",
      body: JSON.stringify(req),
    }),
};
