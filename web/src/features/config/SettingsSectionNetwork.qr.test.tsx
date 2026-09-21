/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://qr-wrong-host.invalid:9999/settings" }
 *
 * ★本ファイルは jsdom の location を「サーバが返す LAN URL とは無関係な別ホスト」に
 * 固定して走る(M22-06 §5.1-4 の破壊確認 B)。
 *
 * 理由——接続 URL を `window.location` から組み立てる実装に変えても、設定画面は
 * ホスト機のブラウザで開くため画面上は正しく見え、QR も読み取れる。繋がらないのは
 * スマートフォンで試したときだけであり、開発者機では最後まで気づけない(指示書 §4.2-3)。
 * ⇒ location を実際に別ホストへ振っておけば、その実装に変えた瞬間に赤くなる。
 *
 * ★docblock が効かないと本ファイルの破壊確認は無言で空回りする。そのため下の
 * 「前提」テストで location が実際に差し替わっていることを先に固定する(E-84 の型)。
 *
 * ★「サーバ由来である」の合成の構図——本ファイルは `config` を props で受け取る
 * コンポーネントを直接描画するため、`GET /api/config` も `useConfig` も通らない。
 * ここで固定するのは「props → QR の値」までである。
 *   - API から画面までの経路: `web/e2e/m22-06-connection-qr.spec.ts` の B
 *   - QR の値とモーダルに出る文字列が同一であること: `QRCodeModal.contract.test.tsx`
 * 3 つが合わさって「サーバが返した lanUrl が QR に入る」が閉じる。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

import "@/lib/i18n";

// QR へ渡る値を捕捉する(QRCodeModal.contract.test.tsx と同じ理由)。
const qrProps = vi.hoisted(() => ({ current: null as { value: string } | null }));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: { value: string }) => {
    qrProps.current = props;
    return <svg />;
  },
}));

// 既存 SettingsSectionNetwork.test.tsx と同じ足場。
vi.mock("./useUpdateConfig", () => ({ useUpdateConfig: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

/** 本ファイルが走るブラウザのホスト(サーバ由来の LAN URL とは無関係な値)。 */
const WRONG_HOST = "qr-wrong-host.invalid:9999";
/** サーバが `GET /api/config` の `network.lanUrl` として返す値。 */
const SERVER_LAN_IP = "192.168.1.50";
const SERVER_LAN_URL = `http://${SERVER_LAN_IP}:47318`;

const QR_BUTTON = "QR コード表示";

function makeConfig(
  mode: "lan" | "local",
  network?: { primaryLanIp: string; lanUrl: string },
): ConfigResponse {
  return {
    server: { mode, port: 47318 },
    database: { path: "" },
    logging: {
      level: "info",
      file: "logs/app.log",
      maxSizeMb: 10,
      maxBackups: 5,
      maxAgeDays: 30,
    },
    security: { passwordEnabled: false },
    network:
      network ??
      (mode === "lan"
        ? { primaryLanIp: SERVER_LAN_IP, lanUrl: SERVER_LAN_URL }
        : { primaryLanIp: "", lanUrl: "" }),
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

beforeEach(() => {
  qrProps.current = null;
  mockedUseUpdateConfig.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateConfig>);
  mockedUseAuthStatus.mockReturnValue({
    data: { passwordRequired: false, passwordSet: false, authenticated: true },
  } as unknown as ReturnType<typeof useAuthStatus>);
});

describe("接続用 QR コード(FR407)", () => {
  // ★破壊確認 B が空回りしないための前提固定。
  it("前提: 本ファイルはサーバの LAN URL と無関係なホストで走っている", () => {
    expect(window.location.host).toBe(WRONG_HOST);
    expect(SERVER_LAN_URL.includes(WRONG_HOST)).toBe(false);
  });

  // §5.1-3 / §4.2-1。★本ケースが固定するのは「props で受けた network.lanUrl を
  // そのまま QR へ渡す」までである(合成の構図は冒頭の docblock を参照)。
  it("props で受けた network.lanUrl をそのまま QR へ渡す", async () => {
    const user = userEvent.setup();
    const config = makeConfig("lan");
    renderWithClient(<SettingsSectionNetwork config={config} />);

    await user.click(screen.getByRole("button", { name: QR_BUTTON }));

    expect(qrProps.current?.value).toBe(config.network.lanUrl);
  });

  // §5.1-4 破壊確認 B。`window.location` から組み立てる実装に変えると、
  // 値が現在のホスト(WRONG_HOST)由来になり、ここが赤くなる。
  it("ブラウザのホストが別でも、QR に渡る値はそれに引きずられない", async () => {
    const user = userEvent.setup();
    const config = makeConfig("lan");
    renderWithClient(<SettingsSectionNetwork config={config} />);

    await user.click(screen.getByRole("button", { name: QR_BUTTON }));

    const value = qrProps.current?.value ?? "";
    expect(value.includes(WRONG_HOST)).toBe(false);
    expect(value.includes(window.location.hostname)).toBe(false);
    expect(value).toBe(SERVER_LAN_URL);
  });

  // §5.1-5。DES-005 §5.16「LAN共有モードON時のみ有効」の as-built は
  // `disabled` ではなく非描画である(条件レンダリング)。押せない以前に存在しないため、
  // 「無反応なボタン」は発生しない。
  // ★本項目は着手前から画面層で守られていた。SettingsPage.test.tsx:60「shows QR button
  //   in LAN mode with lanUrl」と :67「does not show QR button in local mode」が
  //   QR ボタン専用のケースとして既に在る(:48 の「6 セクションの合成」とは別物)。
  //   ⇒ M22-06 の他の項目と違い、ここは「何も守っていなかった」わけではない。
  // ★それでもコンポーネント層へ置くのは、あちらが useConfig をモックした画面全体の
  //   組み立てを見るのに対し、こちらは §5.16 の条件そのものを props で直接固定するため。
  //   モーダルが描画されていないこと(qrProps が null)まで見るのも本ケースだけである。
  it("LAN 共有モード OFF のとき、QR ボタンは描画されない", () => {
    renderWithClient(<SettingsSectionNetwork config={makeConfig("local")} />);

    expect(screen.queryByRole("button", { name: QR_BUTTON })).toBeNull();
    expect(qrProps.current).toBeNull();
  });

  // §5.1-6 / §3.3-5。LAN モードだが代表 LAN IP を取得できなかった場合
  // (resolveNetwork が両フィールドを空で返す)。
  // SUPP-001 §2.6.2-5 が「設定画面等でエラーを表示」を求めている。
  it("lanUrl が空文字のとき、QR は出さずに理由を表示する", () => {
    renderWithClient(
      <SettingsSectionNetwork
        config={makeConfig("lan", { primaryLanIp: "", lanUrl: "" })}
      />,
    );

    expect(screen.queryByRole("button", { name: QR_BUTTON })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("LAN IP を取得できませんでした")).toBeTruthy();
  });
});
