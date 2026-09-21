import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/lib/i18n";
import App from "./App";

vi.mock("@/features/config/useConfig", () => ({
  useConfig: vi.fn(),
  CONFIG_KEY: ["config"],
}));

vi.mock("@/router", () => ({
  default: () => <div data-testid="app-router">AppRouter</div>,
}));

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

import { useConfig } from "@/features/config/useConfig";
import { useIsMobile } from "@/hooks/useIsMobile";
const mockedUseConfig = vi.mocked(useConfig);
const mockedUseIsMobile = vi.mocked(useIsMobile);

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderApp(initialEntries: string[] = ["/"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<><App /><LocationDisplay /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const uninitializedConfig = {
  data: {
    server: { mode: "local" as const, port: 47318 },
    database: { path: "" },
    logging: { level: "info" as const, file: "", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
    security: { passwordEnabled: false },
    network: { primaryLanIp: "", lanUrl: "" },
    defaults: { characterId: 1, presetId: 1 },
    isInitialized: false,
    restartRequired: false,
  },
  isLoading: false,
} as ReturnType<typeof useConfig>;

const initializedConfig = {
  ...uninitializedConfig,
  data: { ...uninitializedConfig.data!, isInitialized: true },
} as ReturnType<typeof useConfig>;

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseIsMobile.mockReturnValue(false);
  });

  it("redirects to /wizard when isInitialized is false", () => {
    mockedUseConfig.mockReturnValue(uninitializedConfig);

    renderApp(["/"]);

    expect(screen.getByTestId("location").textContent).toBe("/wizard");
  });

  it("redirects PC users from / to /combos when initialized", () => {
    mockedUseConfig.mockReturnValue(initializedConfig);
    mockedUseIsMobile.mockReturnValue(false);

    renderApp(["/"]);

    expect(screen.getByTestId("location").textContent).toBe("/combos");
  });

  it("does not redirect mobile users from / when initialized", () => {
    mockedUseConfig.mockReturnValue(initializedConfig);
    mockedUseIsMobile.mockReturnValue(true);

    renderApp(["/"]);

    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(screen.getByTestId("app-router")).toBeTruthy();
  });

  it("does not redirect from /combos regardless of device", () => {
    mockedUseConfig.mockReturnValue(initializedConfig);
    mockedUseIsMobile.mockReturnValue(false);

    renderApp(["/combos"]);

    expect(screen.getByTestId("location").textContent).toBe("/combos");
    expect(screen.getByTestId("app-router")).toBeTruthy();
  });

  it("renders footer when not on /wizard", () => {
    mockedUseConfig.mockReturnValue(initializedConfig);
    mockedUseIsMobile.mockReturnValue(true);

    renderApp(["/"]);

    expect(screen.getByTestId("footer")).toBeTruthy();
  });

  it("does not render footer on /wizard", () => {
    mockedUseConfig.mockReturnValue(uninitializedConfig);

    renderApp(["/wizard"]);

    expect(screen.queryByTestId("footer")).toBeNull();
  });

  it("wizard redirect takes priority over mobile check", () => {
    mockedUseConfig.mockReturnValue(uninitializedConfig);
    mockedUseIsMobile.mockReturnValue(true);

    renderApp(["/"]);

    expect(screen.getByTestId("location").textContent).toBe("/wizard");
  });
});
