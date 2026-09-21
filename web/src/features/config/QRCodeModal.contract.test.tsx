import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/lib/i18n";

// ★QR に「符号化される値そのもの」を捕捉するためのモック(M22-06 §5.1-1)。
// 実物の QRCodeSVG は値を <svg> の矩形群へ符号化してしまい、テストから読み戻せない。
// ⇒ FR407 の「接続 URL だけを含める」は、渡す直前の値を捕まえる形でしか固定できない。
// ★既存 QRCodeModal.test.tsx の 3 ケースとは重複しない(指示書 §3.3-4)。
// あちらが主張するのは「URL テキストが出る」「role=dialog が在る」「onClose が 2 経路で
// 呼ばれる」の 3 点であり、QRCodeSVG が描画されたことも、そこへ渡る値も検査していない。
// ⇒ 実物を通して描画してもエラーにならないことを暗黙に踏んでいるだけである。
// 本ファイルは値の契約だけを見る。モーダルごと消えた場合は下の not.toBeNull() が拾う。
const qrProps = vi.hoisted(() => ({ current: null as { value: string } | null }));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: { value: string }) => {
    qrProps.current = props;
    return <svg />;
  },
}));

import QRCodeModal from "./QRCodeModal";

const LAN_URL = "http://192.168.1.50:47318";

beforeEach(() => {
  qrProps.current = null;
});

describe("QRCodeModal が QR へ符号化する内容の契約(FR407)", () => {
  // §5.1-1 / §4.1-1。破壊確認 A の受け皿。
  // value へパスワード・トークン相当を継ぎ足す実装に変えると、ここが赤くなる。
  it("QR に渡るのは接続 URL の 1 値だけである", () => {
    render(<QRCodeModal url={LAN_URL} onClose={vi.fn()} />);

    expect(qrProps.current).not.toBeNull();
    expect(qrProps.current?.value).toBe(LAN_URL);
  });

  // §4.1-3。「将来のために埋めておく」形を塞ぐ。
  // FR407 が禁じるのは値の中身であって長さではないため、クエリ・フラグメントという
  // 「後から何かを載せるための入れ物」が無いことを見る。
  it("パスワード・トークンを載せる入れ物(クエリ・フラグメント)を持たない", () => {
    render(<QRCodeModal url={LAN_URL} onClose={vi.fn()} />);

    // ★先に「QR が描画された」ことを主張する。これが無いと、QR ごと消えたときに
    //   値が空文字になり、下の 2 つの includes が空回りで緑になる。
    expect(qrProps.current).not.toBeNull();
    const value = qrProps.current?.value ?? "";
    expect(value.includes("?")).toBe(false);
    expect(value.includes("#")).toBe(false);
  });
});
