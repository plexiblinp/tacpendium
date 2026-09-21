import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import SettingsPage from "./SettingsPage";

vi.mock("@/features/config/useConfig", () => ({
  useConfig: vi.fn(),
}));

// M24-08 第 2 部 B: データ管理の「キャッシュ再構築」がプリセット一覧を読むようになった。
// ★モックしないと isLoading のまま disabled になり、「実装したのに無効」を
//   本テストが見分けられなくなる(実際、着手直後は取り違えて緑のまま通っていた)。
vi.mock("@/features/preset/api", () => ({
  usePresets: () => ({ data: [{ id: 1, name: "公式技名(日本語)" }], isLoading: false }),
  useRebuildRecipeCache: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInvalidateRecipeCacheConsumers: () => vi.fn(),
}));

import { useConfig } from "@/features/config/useConfig";
const mockedUseConfig = vi.mocked(useConfig);

const mockConfig = {
  server: { mode: "local" as const, port: 47318 },
  database: { path: "data/tacpendium.db" },
  logging: { level: "info" as const, file: "logs/tacpendium.log", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
  security: { passwordEnabled: false },
  network: { primaryLanIp: "", lanUrl: "" },
  defaults: { characterId: 1, presetId: 1 },
  isInitialized: true,
  restartRequired: false,
};

const mockLanConfig = {
  ...mockConfig,
  server: { mode: "lan" as const, port: 47318 },
  network: { primaryLanIp: "192.168.1.100", lanUrl: "http://192.168.1.100:47318" },
};

function createWrapper(entry = "/settings") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 6 sections when config is loaded", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText("基本設定")).toBeTruthy();
    expect(screen.getByText("ユーザー管理")).toBeTruthy();
    expect(screen.getByText("ネットワーク")).toBeTruthy();
    expect(screen.getByText("データ管理")).toBeTruthy();
    expect(screen.getAllByText("プリセット管理").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("詳細情報")).toBeTruthy();
  });

  it("shows QR button in LAN mode with lanUrl", () => {
    mockedUseConfig.mockReturnValue({ data: mockLanConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText("QR コード表示")).toBeTruthy();
  });

  // ★★M34-02 段 3: 常駐アイコンの「設定画面をブラウザで開く」は /settings?qr=1 を開く。
  // ⇒ トレイ側で QR を描かずに済ませるための唯一の仕掛けである(Go の QR ライブラリと
  // Win32 の描画ウィンドウを増やさない = 指示書 §3-3)。
  it("★?qr=1 で開くと QR モーダルが最初から出る(トレイの導線)", () => {
    mockedUseConfig.mockReturnValue({ data: mockLanConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper("/settings?qr=1") });

    // モーダルは role="dialog" で出て、lanUrl をそのまま見せる(QRCodeModal の契約)。
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("http://192.168.1.100:47318");
  });

  it("★クエリが無ければ QR モーダルは出ない(従来どおり)", () => {
    mockedUseConfig.mockReturnValue({ data: mockLanConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    // ボタンは在るが、モーダルは閉じている。
    expect(screen.getByText("QR コード表示")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ★LAN 共有が OFF のときは ?qr=1 でも QR は出ない —— 「無効ではなく非描画」という
  // M22-06 の仕様どおりであり、出し分けは作らない(開発者判断・2026-09-09)。
  it("★local モードでは ?qr=1 でも QR は出ない(出し分けを作らない)", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper("/settings?qr=1") });

    expect(screen.queryByText("QR コード表示")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show QR button in local mode", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.queryByText("QR コード表示")).toBeNull();
  });

  // ★M24-08 第 2 部 B(2026-08-30)で主張を一部反転させた
  // (旧: renders data section buttons as disabled)。
  // 「キャッシュ再構築」は disabled のプレースホルダだったが、本サブで実装した。
  // ★バックアップ / リストアは未実装のままであり、そちらの主張は残す
  //   (先例＝M22-02 が同じファイルで「パスワード変更」について同じ形の反転を行った)。
  it("バックアップ / リストアは未実装のまま disabled である", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    const backupBtn = screen.getByText("バックアップ");
    const restoreBtn = screen.getByText("リストア");

    expect((backupBtn as HTMLButtonElement).disabled).toBe(true);
    expect((restoreBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("★キャッシュ再構築は押せる(M24-08 で実装した)", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    const cacheBtn = screen.getByTestId("settings-cache-rebuild");
    expect((cacheBtn as HTMLButtonElement).disabled).toBe(false);
  });

  // ★M22-02(2026-08-15)で主張を反転させた(旧: renders user section buttons as disabled)。
  // 「パスワード変更」は disabled のプレースホルダだったが、本サブで設定・変更を
  // 実装した(指示書 §4.4)。★「ユーザー追加」は段 2 で実装する。
  it("renders an enabled password action in the user section", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    const passwordBtn = screen.getByTestId("settings-user-password-action");
    expect((passwordBtn as HTMLButtonElement).disabled).toBe(false);
    // 未設定なので「決める」側の導線が出る(GET /api/auth/status を読めない環境では
    // passwordSet=false として扱う)。
    expect(passwordBtn.textContent).toBe("パスワードを決める");
  });

  // ★M20-04(2026-08-13)で主張を反転させた(旧: renders preset link button as disabled)。
  it("renders preset link button as an enabled link to /presets", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    const presetBtn = screen.getByText("プリセット管理へ");
    expect(presetBtn.tagName).toBe("A");
    expect(presetBtn.getAttribute("href")).toBe("/presets");
  });

  it("shows 127.0.0.1:<port> in local mode network section", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText("127.0.0.1:47318")).toBeTruthy();
  });

  it("shows LAN IP address in LAN mode network section", () => {
    mockedUseConfig.mockReturnValue({ data: mockLanConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText("192.168.1.100")).toBeTruthy();
  });

  it("shows error message when LAN IP is empty in LAN mode", () => {
    const mockLanNoIp = {
      ...mockConfig,
      server: { mode: "lan" as const, port: 47318 },
      network: { primaryLanIp: "", lanUrl: "" },
    };
    mockedUseConfig.mockReturnValue({ data: mockLanNoIp, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText("LAN IP を取得できませんでした")).toBeTruthy();
  });

  // ★M20-04(2026-08-13)で主張を反転させた
  // (旧: renders disabled preset navigation link in header)。
  it("renders enabled preset navigation link in header", () => {
    mockedUseConfig.mockReturnValue({ data: mockConfig, isLoading: false, error: null } as ReturnType<typeof useConfig>);
    render(<SettingsPage />, { wrapper: createWrapper() });

    // 「プリセット管理」は設定セクションの見出し(h2)にも出るため、
    // ヘッダのナビゲーション要素だけを取り出す。
    const navLinks = screen
      .getAllByText("プリセット管理")
      .filter((el) => el.tagName !== "H2");
    expect(navLinks.length).toBeGreaterThan(0);
    for (const el of navLinks) {
      expect(el.tagName).toBe("A");
      expect(el.getAttribute("href")).toBe("/presets");
      expect(el.className).not.toContain("cursor-not-allowed");
    }
  });
});
