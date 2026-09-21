import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import "@/lib/i18n";

// ★UserManagement とパスワードの各フォームは本ファイルの関心外。
// 実物を通すと利用者一覧の問い合わせまで走るため、差し替える。
vi.mock("@/features/user/UserManagement", () => ({
  default: () => <div data-testid="stub-user-management" />,
}));
vi.mock("@/features/auth/PasswordSetForm", () => ({ default: () => <div /> }));
vi.mock("@/features/auth/PasswordChangeForm", () => ({ default: () => <div /> }));
vi.mock("@/features/auth/PasswordForgotHelp", () => ({ default: () => <div /> }));
vi.mock("@/features/auth/useAuthStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/useAuthStatus")>();
  return { ...actual, useAuthStatus: vi.fn() };
});
vi.mock("@/features/auth/useLogout", () => ({ useLogout: vi.fn() }));

import { useAuthStatus } from "@/features/auth/useAuthStatus";
import { useLogout } from "@/features/auth/useLogout";
import SettingsSectionUser from "./SettingsSectionUser";

const mockedUseAuthStatus = vi.mocked(useAuthStatus);
const mockedUseLogout = vi.mocked(useLogout);

let logoutMutate: ReturnType<typeof vi.fn>;

function setAuthStatus(status: {
  passwordRequired: boolean;
  passwordSet: boolean;
  authenticated?: boolean;
}) {
  mockedUseAuthStatus.mockReturnValue({
    data: { authenticated: true, ...status },
  } as unknown as ReturnType<typeof useAuthStatus>);
}

function renderSection(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  logoutMutate = vi.fn();
  mockedUseLogout.mockReturnValue({
    mutate: logoutMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useLogout>);
});

// ===========================================================================
// M22-08 §5.1-9: ログアウトの導線は「保護が有効なとき」だけ出る
// ===========================================================================

describe("M22-08 ログアウトの導線", () => {
  // ★これが既定の状態である(password_enabled = false)。
  // ★無効なときに出すと、押しても何も起きない導線になる(指示書 §4.3-2)。
  it("パスワード保護が無効なら出ない", () => {
    setAuthStatus({ passwordRequired: false, passwordSet: false });
    renderSection(<SettingsSectionUser />);

    expect(screen.queryByTestId("settings-user-logout")).toBeNull();
  });

  // ★「検証子は在るが password_enabled = false」の状態。
  // 一度掛けて外したあとがこれに当たり、通常の OFF 状態である(DES-002 §8.1)。
  // ★passwordSet で出し分けると、ここで誤って出る。
  it("検証子は在るがゲートが効いていないなら出ない", () => {
    setAuthStatus({ passwordRequired: false, passwordSet: true });
    renderSection(<SettingsSectionUser />);

    expect(screen.queryByTestId("settings-user-logout")).toBeNull();
  });

  it("パスワード保護が有効なら出て、押すとログアウトを呼ぶ", async () => {
    const user = userEvent.setup();
    setAuthStatus({ passwordRequired: true, passwordSet: true });
    renderSection(<SettingsSectionUser />);

    const button = screen.getByTestId("settings-user-logout");
    await user.click(button);

    expect(logoutMutate).toHaveBeenCalledTimes(1);
  });

  // ★「もう一度パスワードが要る」ことを先に述べる(文言方針 2)。
  it("押すとどうなるかを添える", () => {
    setAuthStatus({ passwordRequired: true, passwordSet: true });
    renderSection(<SettingsSectionUser />);

    expect(screen.getByText(/もう一度開くときに、パスワードの入力が必要になります/)).toBeTruthy();
  });

  // ★★ログアウトと「利用者の選び直し」を混ぜないこと(指示書 §4.3-4)。
  // あちらは UserManagement 側が持つ別物であり、入場ゲートを出るわけではない。
  it("「使う人を選び直す」を兼ねていない", () => {
    setAuthStatus({ passwordRequired: true, passwordSet: true });
    renderSection(<SettingsSectionUser />);

    const logout = screen.getByTestId("settings-user-logout");
    expect(logout.textContent).not.toContain("選び直");
    // 選び直しの導線は UserManagement 側にあり、本節が持つものではない。
    expect(screen.queryByTestId("settings-user-reselect")).toBeNull();
  });
});
