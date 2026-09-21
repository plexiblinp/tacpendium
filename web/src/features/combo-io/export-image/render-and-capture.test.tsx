import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { exportComboImage } from "./render-and-capture";
import { capture } from "./capture";
import { pngsToPdf, type PdfPageRaster } from "./pdf";
import { triggerDownload } from "../api";
import { DEFAULT_SELECTED_ITEMS } from "../export-items";
import { makeCombo, TEST_CHARACTERS } from "../export-test-helpers";

vi.mock("./capture", () => ({ capture: vi.fn() }));
vi.mock("./pdf", () => ({ pngsToPdf: vi.fn(), PT_PER_CSS_PX: 72 / 96 }));
vi.mock("../api", () => ({ triggerDownload: vi.fn() }));

const captureMock = capture as unknown as Mock;
const pngsToPdfMock = pngsToPdf as unknown as Mock;
const triggerDownloadMock = triggerDownload as unknown as Mock;

const SELECTED = DEFAULT_SELECTED_ITEMS;

// width/height は capture 結果のピクセル寸法(pixelRatio=2)。small=用紙内(原寸fit)、tall=用紙超過(縮小)。
function setupCapture(width = 200, height = 100) {
  captureMock.mockResolvedValue({
    png: new Uint8Array([1, 2, 3]),
    width,
    height,
  });
  pngsToPdfMock.mockResolvedValue(new Uint8Array([9]));
}

function makeCombos(n: number) {
  return Array.from({ length: n }, (_, i) => makeCombo({ id: i + 1 }));
}

// ★M24-06: 外側のファイル名は呼び出し側が決める(SM-075)。単独/複数の出し分けは
//   名前に入る件数が担うため、combomgr-combo(s) の分岐は無くなった。
const BASE_NAME = "combos_selected_1_20260830-143512";

describe("exportComboImage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("単独 PNG: 詳細レイアウトを 1 枚キャプチャして 自動命名で DL(分割しない)", async () => {
    setupCapture();
    await exportComboImage([makeCombo()], TEST_CHARACTERS, SELECTED, "png", BASE_NAME);

    expect(captureMock).toHaveBeenCalledTimes(1);
    const node = captureMock.mock.calls[0][0] as HTMLElement;
    expect(node.getAttribute("data-export-mode")).toBe("single");
    expect(pngsToPdfMock).not.toHaveBeenCalled();
    expect(triggerDownloadMock.mock.calls[0][1]).toBe(`${BASE_NAME}.png`);
  });

  it("複数 PNG: 比較表を 1 枚キャプチャして 自動命名で DL(分割しない)", async () => {
    setupCapture();
    await exportComboImage(makeCombos(2), TEST_CHARACTERS, SELECTED, "png", BASE_NAME);
    expect(captureMock).toHaveBeenCalledTimes(1);
    const node = captureMock.mock.calls[0][0] as HTMLElement;
    expect(node.getAttribute("data-export-mode")).toBe("comparison");
    expect(triggerDownloadMock.mock.calls[0][1]).toBe(`${BASE_NAME}.png`);
  });

  it("単独 PDF: 用紙固定(A4縦)で 1 ページ、原寸で収まれば paper 指定の縮小フィット", async () => {
    setupCapture(200, 100); // 小さい = 原寸で収まる
    await exportComboImage([makeCombo()], TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);

    expect(pngsToPdfMock).toHaveBeenCalledTimes(1);
    const rasters = pngsToPdfMock.mock.calls[0][0] as PdfPageRaster[];
    expect(rasters).toHaveLength(1);
    // 用紙固定(paper 指定あり)
    expect(rasters[0].paperWidthPt).toBeGreaterThan(0);
    expect(rasters[0].paperHeightPt).toBeGreaterThan(0);
    expect(triggerDownloadMock.mock.calls[0][1]).toBe(`${BASE_NAME}.pdf`);
  });

  it("複数 PDF: 9 件は 4 列/ページで 3 ページに列分割、各ページ用紙固定", async () => {
    setupCapture(200, 100);
    await exportComboImage(makeCombos(9), TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);

    // 3 ページ = 3 回描画・キャプチャ
    expect(captureMock).toHaveBeenCalledTimes(3);
    for (const call of captureMock.mock.calls) {
      const node = call[0] as HTMLElement;
      expect(node.getAttribute("data-export-mode")).toBe("comparison");
      expect(node.querySelector("[data-field='page-footer']")).not.toBeNull();
    }
    const rasters = pngsToPdfMock.mock.calls[0][0] as PdfPageRaster[];
    expect(rasters).toHaveLength(3);
    expect(rasters.every((r) => r.paperWidthPt !== undefined)).toBe(true);
    expect(triggerDownloadMock.mock.calls[0][1]).toBe(`${BASE_NAME}.pdf`);
  });

  it("縮小率 < 70%: 注記付きで再描画し、縮小せず原寸(paper 未指定)で出す", async () => {
    setupCapture(200, 10000); // 極端に縦長 = 用紙に対し縮小率が下限未満
    await exportComboImage([makeCombo()], TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);

    // 1 回目(注記なし)→ 下限未満 → 2 回目(注記あり)で再描画
    expect(captureMock).toHaveBeenCalledTimes(2);
    const notedNode = captureMock.mock.calls[1][0] as HTMLElement;
    expect(notedNode.querySelector("[data-field='overflow-note']")).not.toBeNull();
    const rasters = pngsToPdfMock.mock.calls[0][0] as PdfPageRaster[];
    // 原寸出力 = 用紙固定しない(paper 未指定)
    expect(rasters[0].paperWidthPt).toBeUndefined();
    expect(rasters[0].paperHeightPt).toBeUndefined();
  });

  // 用紙高 = A4 縦 297mm = 841.89pt。imgHpt = (height/2)*0.75 = height*0.375。
  // scale = 841.89 / (height*0.375) が 0.7 になる height ≒ 3207。境界近傍で fit/actual の切替を検証。
  it("縮小率が下限(70%)を上回る(height=3100・scale≒0.72): 用紙固定で縮小フィット", async () => {
    setupCapture(200, 3100);
    await exportComboImage([makeCombo()], TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);
    expect(captureMock).toHaveBeenCalledTimes(1); // 注記再描画は起きない
    const rasters = pngsToPdfMock.mock.calls[0][0] as PdfPageRaster[];
    expect(rasters[0].paperWidthPt).toBeGreaterThan(0); // 用紙固定(fit)
  });

  it("縮小率が下限(70%)を下回る(height=3300・scale≒0.68): 注記付きで原寸", async () => {
    setupCapture(200, 3300);
    await exportComboImage([makeCombo()], TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);
    expect(captureMock).toHaveBeenCalledTimes(2); // 注記付きで再描画
    const rasters = pngsToPdfMock.mock.calls[0][0] as PdfPageRaster[];
    expect(rasters[0].paperWidthPt).toBeUndefined(); // 原寸(actual)
  });

  it("キャプチャ後に画面外ノードが後始末される(DOM に残らない)", async () => {
    setupCapture(200, 100);
    await exportComboImage(makeCombos(9), TEST_CHARACTERS, SELECTED, "pdf", BASE_NAME);
    expect(document.querySelectorAll("[data-export-mode]")).toHaveLength(0);
  });
});
