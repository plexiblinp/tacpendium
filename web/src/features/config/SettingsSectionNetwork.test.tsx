import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

import "@/lib/i18n";

// useUpdateConfig / sonner はモックして mutate 呼び出しと分岐のみ検証する。
vi.mock("./useUpdateConfig", () => ({ useUpdateConfig: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// 認証状態はダイアログの文面を出し分ける入力なので、テストごとに差し替える。
vi.mock("@/features/auth/useAuthStatus", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/useAuthStatus")>();
  return { ...actual, useAuthStatus: vi.fn() };
});

import SettingsSectionNetwork from "./SettingsSectionNetwork";
import { useUpdateConfig } from "./useUpdateConfig";
import { useAuthStatus } from "@/features/auth/useAuthStatus";
import type { ConfigResponse } from "./types";

const mockedUseUpdateConfig = vi.mocked(useUpdateConfig);
const mockedUseAuthStatus = vi.mocked(useAuthStatus);

function makeConfig(mode: "lan" | "local"): ConfigResponse {
  return {
    server: { mode, port: 47318 },
    database: { path: "" },
    logging: { level: "info", file: "logs/app.log", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
    security: { passwordEnabled: false },
    network: {
      primaryLanIp: mode === "lan" ? "192.168.1.50" : "",
      lanUrl: mode === "lan" ? "http://192.168.1.50:47318" : "",
    },
    defaults: { characterId: 1, presetId: 1 },
    isInitialized: true,
    restartRequired: false,
  };
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/** passwordSet だけを差し替える(他のフィールドは本テストの判定に使わない)。 */
function setPasswordSet(passwordSet: boolean) {
  mockedUseAuthStatus.mockReturnValue({
    data: { passwordRequired: passwordSet, passwordSet, authenticated: true },
  } as unknown as ReturnType<typeof useAuthStatus>);
}

let mutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mutate = vi.fn();
  mockedUseUpdateConfig.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateConfig>);
  setPasswordSet(false);
});

describe("SettingsSectionNetwork", () => {
  it("local 時にトグル ON で確認ダイアログを表示し、即時には mutate しない", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    await user.click(screen.getByRole("switch"));

    expect(screen.getByText("ほかの機器から使えるようにします")).toBeTruthy();
    // 確認前は mutate を呼ばない。
    expect(mutate).not.toHaveBeenCalled();
  });

  // ★§5.1-8: パスワードの設定状況でダイアログが出し分かる。
  it("パスワード未設定なら「決めずに ON にする」と設定への誘導が出る", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    await user.click(screen.getByRole("switch"));

    expect(screen.getByTestId("lan-confirm-set-password")).toBeTruthy();
    expect(screen.getByTestId("lan-confirm-skip-password")).toBeTruthy();
    // 未設定のときは「そのまま ON にする」を直接は出さない(同意を挟む)。
    expect(screen.queryByTestId("lan-confirm-enable")).toBeNull();
  });

  it("パスワード設定済みなら同意を挟まずに ON にできる", async () => {
    setPasswordSet(true);
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByTestId("lan-confirm-enable"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ server: { mode: "lan" } });
  });

  // ★§5.1-8 / D-396: 未設定でも続行できる(必須化しない)。ただし明示的な同意が要る。
  it("未設定でも同意すれば ON にできる。同意するまで押せない", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByTestId("lan-confirm-skip-password"));

    const enable = screen.getByTestId("lan-consent-enable");
    expect(enable.hasAttribute("disabled")).toBe(true);
    await user.click(enable);
    expect(mutate).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("lan-consent-check"));
    expect(enable.hasAttribute("disabled")).toBe(false);
    await user.click(enable);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ server: { mode: "lan" } });
  });

  it("確認ダイアログをキャンセルすると mutate しない", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByText("やめる"));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("lan 時にトグル OFF で確認なしに mode=local で即時 mutate する", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsSectionNetwork config={makeConfig("lan")} />);

    await user.click(screen.getByRole("switch"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ server: { mode: "local" } });
    // 無効化では確認ダイアログを出さない。
    expect(screen.queryByText("ほかの機器から使えるようにします")).toBeNull();
  });

  // ★CHANGE-113 §3.9: 状態を述べる注記。LAN 有効時に出す。
  it("LAN 有効時に外から入れる場合の注記が出る", () => {
    renderWithClient(<SettingsSectionNetwork config={makeConfig("lan")} />);
    expect(screen.getByTestId("settings-network-external-note")).toBeTruthy();
  });
});
