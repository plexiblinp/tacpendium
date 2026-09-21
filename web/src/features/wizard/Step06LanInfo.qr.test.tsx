/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://qr-wrong-host.invalid:9999/wizard" }
 *
 * ★QRCodeModal の消費側は設定画面だけではない。ウィザード Step 6 も同じモーダルへ
 * 接続 URL を渡している(M22-06 の否定形確認で判明。指示書・調査レポートのいずれも
 * 挙げていなかった)。
 *
 * ⇒ FR407「接続 URL のみ・サーバ由来」は消費側ごとに守られる必要がある。
 * 設定画面だけを固定すると、こちらを `window.location` から組み立てる実装に
 * 変えても全テストが緑のままになる。
 *
 * 本ファイルも location を別ホストへ固定して走る(SettingsSectionNetwork.qr.test.tsx
 * と同じ理由)。docblock が効かないと空回りするため、前提テストで先に固定する。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/lib/i18n";

const qrProps = vi.hoisted(() => ({ current: null as { value: string } | null }));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: { value: string }) => {
    qrProps.current = props;
    return <svg />;
  },
}));

import Step06LanInfo from "./Step06LanInfo";

const WRONG_HOST = "qr-wrong-host.invalid:9999";
const SERVER_LAN_URL = "http://192.168.1.50:47318";

const QR_BUTTON = "QR コード表示";

beforeEach(() => {
  qrProps.current = null;
});

describe("ウィザード Step 6 の接続 QR(FR407)", () => {
  it("前提: 本ファイルはサーバの LAN URL と無関係なホストで走っている", () => {
    expect(window.location.host).toBe(WRONG_HOST);
    expect(SERVER_LAN_URL.includes(WRONG_HOST)).toBe(false);
  });

  it("QR に渡る接続 URL はサーバ由来で、ブラウザのホストに引きずられない", async () => {
    const user = userEvent.setup();
    render(
      <Step06LanInfo
        network={{ primaryLanIp: "192.168.1.50", lanUrl: SERVER_LAN_URL }}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: QR_BUTTON }));

    expect(qrProps.current?.value).toBe(SERVER_LAN_URL);
    expect(qrProps.current?.value.includes(WRONG_HOST)).toBe(false);
  });

  it("lanUrl が空文字のとき、QR は出さずに理由を表示する", () => {
    render(
      <Step06LanInfo
        network={{ primaryLanIp: "", lanUrl: "" }}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: QR_BUTTON })).toBeNull();
    expect(screen.getByText("LAN IP を取得できませんでした")).toBeTruthy();
  });
});
