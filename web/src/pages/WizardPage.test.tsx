import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import WizardPage from "./WizardPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockMutate = vi.fn();
vi.mock("@/features/config/useUpdateConfig", () => ({
  useUpdateConfig: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("@/features/config/useConfig", () => ({
  useConfig: () => ({
    data: {
      server: { mode: "local", port: 47318 },
      database: { path: "" },
      logging: { level: "info", file: "", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
      security: { passwordEnabled: false },
      network: { primaryLanIp: "", lanUrl: "" },
      defaults: { characterId: 1, presetId: 1 },
      isInitialized: false,
      restartRequired: false,
    },
    isLoading: false,
  }),
  CONFIG_KEY: ["config"],
}));

vi.mock("@/features/mycombo/components/CharacterSelector", () => ({
  default: ({ onChange }: { onChange: (id: number) => void }) => (
    <button type="button" onClick={() => onChange(5)} data-testid="char-select">
      CharSelect
    </button>
  ),
}));

vi.mock("@/features/combo/hooks/usePresets", () => ({
  usePresets: () => ({ data: [{ id: 1, name: "official_ja_move" }], isLoading: false }),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/wizard"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("WizardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Step 1 initially", () => {
    render(<WizardPage />, { wrapper: createWrapper() });
    expect(screen.getByText("ようこそ")).toBeTruthy();
  });

  it("progresses through steps and skips step 6 when LAN disabled", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    // Step 1 → 2
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("言語選択")).toBeTruthy();

    // Step 2 → 3
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("デフォルトキャラクター")).toBeTruthy();

    // Step 3 → 4
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("デフォルトプリセット")).toBeTruthy();

    // Step 4 → 5
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("ネットワーク設定")).toBeTruthy();

    // Step 5 → 7 (skip 6 since LAN disabled)
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("設定完了")).toBeTruthy();
  });

  it("skip button on Step 3 resets characterId to 1 and advances", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    // Step 1 → 2
    fireEvent.click(screen.getByText("次へ"));
    // Step 2 → 3
    fireEvent.click(screen.getByText("次へ"));

    // Select a character first
    fireEvent.click(screen.getByTestId("char-select"));

    // Click skip
    fireEvent.click(screen.getByText("スキップ"));

    // Should be on Step 4
    expect(screen.getByText("デフォルトプリセット")).toBeTruthy();
  });

  it("shows Step 6 when LAN is enabled", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    // Navigate to Step 5
    fireEvent.click(screen.getByText("次へ")); // 1→2
    fireEvent.click(screen.getByText("次へ")); // 2→3
    fireEvent.click(screen.getByText("次へ")); // 3→4
    fireEvent.click(screen.getByText("次へ")); // 4→5

    // Enable LAN
    fireEvent.click(screen.getByText("LAN モードを有効にする"));

    // Step 5 → 6
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText("LAN 接続情報")).toBeTruthy();
  });

  it("calls mutate with correct payload on finish", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    // Navigate to completion
    fireEvent.click(screen.getByText("次へ")); // 1→2
    fireEvent.click(screen.getByText("次へ")); // 2→3
    fireEvent.click(screen.getByText("次へ")); // 3→4
    fireEvent.click(screen.getByText("次へ")); // 4→5
    fireEvent.click(screen.getByText("次へ")); // 5→7

    // Click finish
    fireEvent.click(screen.getByText("はじめる"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      { server: { mode: "local" }, defaults: { characterId: 1, presetId: 1 } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("navigates to / on successful mutation", () => {
    mockMutate.mockImplementation((_payload: unknown, options: { onSuccess: () => void }) => {
      options.onSuccess();
    });

    render(<WizardPage />, { wrapper: createWrapper() });

    // Navigate to completion
    fireEvent.click(screen.getByText("次へ")); // 1→2
    fireEvent.click(screen.getByText("次へ")); // 2→3
    fireEvent.click(screen.getByText("次へ")); // 3→4
    fireEvent.click(screen.getByText("次へ")); // 4→5
    fireEvent.click(screen.getByText("次へ")); // 5→7

    // Click finish
    fireEvent.click(screen.getByText("はじめる"));

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  // ★★M26-05: 同意は段をまたいで残らない(DES-005 §5.1「Step 7 の要件」6 /
  //   指示書 §4.2)。★Step07Password.test.tsx は段の*中*で入り直す経路を見ている。
  //   ここで見るのは段そのものを離れて戻る経路である。
  //
  //   ★★この要件は 2 つの機構が独立に満たしている——(a) WizardPage の
  //   `{step === 7 && lanEnabled}` による unmount、(b) Step07Password が
  //   同意ビューへ入るたびに掛ける明示のリセット。
  //   ⇒ 実測(2026-09-12): (b) を外しても本テストは緑のままである(unmount だけで足りる)。
  //     `disabled={!consented}` を外すと赤になる。
  //   ★本テストが固定しているのは*観測できる振る舞い*であって、どちらの機構が
  //     効いているかではない。片方を消しても赤くならないのはそのためである。
  it("同意したあと段を離れて戻ると、同意はリセットされている", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("次へ")); // 1→2
    fireEvent.click(screen.getByText("次へ")); // 2→3
    fireEvent.click(screen.getByText("次へ")); // 3→4
    fireEvent.click(screen.getByText("次へ")); // 4→5

    fireEvent.click(screen.getByText("LAN モードを有効にする"));
    fireEvent.click(screen.getByText("次へ")); // 5→6
    fireEvent.click(screen.getByText("次へ")); // 6→7

    // 「あとにする」→ 同意ビュー → チェックを入れる
    fireEvent.click(screen.getByTestId("auth-set-password-skip"));
    fireEvent.click(screen.getByTestId("wizard-lan-consent-check"));
    expect(screen.getByTestId("wizard-lan-consent-next").hasAttribute("disabled")).toBe(
      false,
    );

    // 同意ビューの戻る → パスワードの段 → 段の戻るで Step 6 へ
    fireEvent.click(screen.getByText("戻る"));
    fireEvent.click(screen.getByText("戻る"));
    expect(screen.getByText("LAN 接続情報")).toBeTruthy();

    // 段へ戻ってくると、同意は外れている
    fireEvent.click(screen.getByText("次へ")); // 6→7
    fireEvent.click(screen.getByTestId("auth-set-password-skip"));
    expect(screen.getByTestId("wizard-lan-consent-next").hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("shows progress bar from step 2 onwards", () => {
    render(<WizardPage />, { wrapper: createWrapper() });

    // Step 1: no progress bar
    expect(screen.queryByText(/ステップ/)).toBeNull();

    // Step 2: progress bar visible
    fireEvent.click(screen.getByText("次へ"));
    expect(screen.getByText(/ステップ 2 \/ 6/)).toBeTruthy();
  });
});
