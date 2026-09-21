import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

import "@/lib/i18n";

vi.mock("./useAuthStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useAuthStatus")>();
  return { ...actual, useAuthStatus: vi.fn() };
});
// ★破壊確認 A のための仕掛け。
// AuthGate が GET /api/config の security.passwordEnabled(生値)を見るように
// 書き換えられたら、下記「割れている」テストが赤くなる。
// ここでは生値を true(保護する)にしてあり、実効値は false(保護しない)である。
vi.mock("@/features/config/useConfig", () => ({ useConfig: vi.fn() }));

import AuthGate from "./AuthGate";
import { useAuthStatus } from "./useAuthStatus";
import { useConfig } from "@/features/config/useConfig";

const mockedUseAuthStatus = vi.mocked(useAuthStatus);
const mockedUseConfig = vi.mocked(useConfig);

function setStatus(
  status: { passwordRequired: boolean; passwordSet: boolean; authenticated: boolean } | undefined,
  isLoading = false,
) {
  mockedUseAuthStatus.mockReturnValue({
    data: status,
    isLoading,
  } as unknown as ReturnType<typeof useAuthStatus>);
}

function renderGate(ui?: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthGate>{ui ?? <p>アプリ本体</p>}</AuthGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // 生値は常に「保護する」側にしておく。実効値と割れた状態を作るためである。
  mockedUseConfig.mockReturnValue({
    data: { security: { passwordEnabled: true } },
    isLoading: false,
  } as unknown as ReturnType<typeof useConfig>);
});

describe("AuthGate", () => {
  // §5.1-2
  it("passwordRequired が真かつ未認証ならログイン画面が出る", async () => {
    setStatus({ passwordRequired: true, passwordSet: true, authenticated: false });
    renderGate();

    expect(await screen.findByTestId("auth-login-title")).toBeTruthy();
    expect(screen.queryByText("アプリ本体")).toBeNull();
  });

  // §5.1-2
  it("passwordRequired が偽ならログイン画面が出ない", async () => {
    setStatus({ passwordRequired: false, passwordSet: false, authenticated: false });
    renderGate();

    expect(await screen.findByText("アプリ本体")).toBeTruthy();
    expect(screen.queryByTestId("auth-login-title")).toBeNull();
  });

  // ★§5.1-1（最重要ゲート 1）。破壊確認 A の対象。
  // 生値(GET /api/config の security.passwordEnabled)は true、
  // 実効値(GET /api/auth/status の passwordRequired)は false。
  // ★この状態は config.toml を手で書いたときにだけ起きるため、通常の操作では
  //   再現しない。テストが唯一の網である(指示書 §4.1-4)。
  it("生値と実効値が割れているとき、実効値に従う(生値を見ない)", async () => {
    setStatus({ passwordRequired: false, passwordSet: false, authenticated: false });
    renderGate();

    // 実効値が偽なので通す。生値を見ていたらここでログイン画面が出て赤くなる。
    expect(await screen.findByText("アプリ本体")).toBeTruthy();
    expect(screen.queryByTestId("auth-login-title")).toBeNull();
  });

  // §5.1-16 / §4.8-5
  it("認証済みならログイン画面を出さない", async () => {
    setStatus({ passwordRequired: true, passwordSet: true, authenticated: true });
    renderGate();

    expect(await screen.findByText("アプリ本体")).toBeTruthy();
    expect(screen.queryByTestId("auth-login-title")).toBeNull();
  });

  // §5.1-15。更新は「同じ状態で作り直す」ことに等しい——セッションの実体は
  // サーバのメモリにあり、ブラウザは Cookie を運ぶだけである(DES-002 §8.1 の 9〜12)。
  it("同じ状態で作り直しても入り直しにならない", async () => {
    setStatus({ passwordRequired: true, passwordSet: true, authenticated: true });
    const first = renderGate();
    expect(await screen.findByText("アプリ本体")).toBeTruthy();
    first.unmount();

    renderGate();
    expect(await screen.findByText("アプリ本体")).toBeTruthy();
    expect(screen.queryByTestId("auth-login-title")).toBeNull();
  });

  it("状態を取得できないときはアプリを止めない", async () => {
    setStatus(undefined);
    renderGate();

    await waitFor(() => expect(screen.getByText("アプリ本体")).toBeTruthy());
  });

  it("取得中は読み込み表示にする", () => {
    setStatus(undefined, true);
    renderGate();

    expect(screen.queryByText("アプリ本体")).toBeNull();
    expect(screen.queryByTestId("auth-login-title")).toBeNull();
  });
});
