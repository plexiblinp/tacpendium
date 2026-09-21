import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "@/App";
import AuthGate from "@/features/auth/AuthGate";
import CurrentUserProvider from "@/features/user/CurrentUserProvider";
import { installHttpInterceptor, isUnauthorizedError } from "@/lib/http-interceptor";
import "@/lib/i18n";
import "@/index.css";

// ★401 の検知と X-User-Id の付与を 1 か所で行う(指示書 §4.3-2 / §4.5)。
// render より前に設置する——設置前に飛んだ問い合わせは素通りしてしまうため。
installHttpInterceptor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ★401 は再試行しない。認証が要るという応答は繰り返しても変わらず、
      // 既定の 3 回再試行は空転になる(実測で約 7 秒)。それ以外は既定どおり。
      retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 3,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* ★AuthGate は App の外側に置く。App は先頭で保護対象の GET /api/config を
            呼ぶため、内側に置くと未認証時に読めない問い合わせを投げてしまう。
            ★CurrentUserProvider はその内側。利用者の一覧は保護対象であり、
            入場を通ってからでないと読めない。 */}
        <AuthGate>
          <CurrentUserProvider>
            <App />
          </CurrentUserProvider>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
