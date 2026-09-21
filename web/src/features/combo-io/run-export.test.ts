import { beforeEach, describe, expect, it, vi } from "vitest";

import { runExport } from "./run-export";
import { DEFAULT_SELECTED_ITEMS } from "./export-items";
import { makeCombo, TEST_CHARACTERS } from "./export-test-helpers";
import type { ExportParams } from "./api";

const { resolveExportComboRes } = vi.hoisted(() => ({
  resolveExportComboRes: vi.fn(),
}));

vi.mock("./export-data", () => ({
  resolveExportCombos: resolveExportComboRes,
}));

const clipboardMocks = vi.hoisted(() => ({
  buildClipboardHtml: vi.fn(() => "<table></table>"),
  buildClipboardText: vi.fn(() => "text"),
  copyComboClipboard: vi.fn(async () => {}),
}));
vi.mock("./clipboard", () => clipboardMocks);

const imageMocks = vi.hoisted(() => ({
  exportComboImage: vi.fn(
    async (
      _combos: unknown,
      _characters: unknown,
      _selected: unknown,
      _format: "png" | "pdf",
    ) => {},
  ),
}));
vi.mock("./export-image/render-and-capture", () => imageMocks);

const exportParams: ExportParams = { range: "selected", ids: [1, 2] };

// 外側のファイル名(SM-075・M24-06 §4.4)。1 回の実行で全形式が同じベース名を共有する。
const BASE_NAME = "combos_selected_2_20260830-143512";

describe("runExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ★M29-02: resolveExportCombos は { combos, observation } を返すようになった。
    //   observation は「切り捨て無し」(total === included)を既定にする。
    resolveExportComboRes.mockResolvedValue({
      combos: [makeCombo({ id: 1 }), makeCombo({ id: 2 })],
      observation: { total: 2, included: 2, reimportBlocked: false },
    });
  });

  it("csv のみ選択時は resolveExportCombos を呼ばない", async () => {
    const exportCsv = vi.fn(async () => null);
    const result = await runExport({
      formats: new Set(["csv"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(resolveExportComboRes).not.toHaveBeenCalled();
    expect(exportCsv).toHaveBeenCalledWith({
      params: exportParams,
      baseName: BASE_NAME,
    });
    expect(result.results).toEqual([{ format: "csv", status: "success" }]);
  });

  it("visual format 選択時は resolveExportCombos を1回だけ呼ぶ(CSV+PDF+PNG+クリップボード同時でも)", async () => {
    const exportCsv = vi.fn(async () => null);
    const result = await runExport({
      formats: new Set(["csv", "pdf", "png"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(resolveExportComboRes).toHaveBeenCalledTimes(1);
    expect(imageMocks.exportComboImage).toHaveBeenCalledTimes(2);
    expect(result.results.map((r) => r.format)).toEqual(["csv", "pdf", "png"]);
    expect(result.results.every((r) => r.status === "success")).toBe(true);
  });

  it("固定順(csv→pdf→png→clipboard)で実行される", async () => {
    const order: string[] = [];
    const exportCsv = vi.fn(async () => {
      order.push("csv");
      return null;
    });
    imageMocks.exportComboImage.mockImplementation(async (_c, _ch, _s, format) => {
      order.push(format);
    });
    clipboardMocks.copyComboClipboard.mockImplementation(async () => {
      order.push("clipboard");
    });

    await runExport({
      formats: new Set(["clipboard", "png", "csv", "pdf"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(order).toEqual(["csv", "pdf", "png", "clipboard"]);
  });

  it("件数が imageWarnCount を超え PNG を含む場合のみ onImageWarn を呼ぶ(M17-05c: PDF は自動分割で対象外)", async () => {
    resolveExportComboRes.mockResolvedValue({
      combos: Array.from({ length: 25 }, (_, i) => makeCombo({ id: i + 1 })),
      observation: { total: 25, included: 25, reimportBlocked: false },
    });
    const onImageWarn = vi.fn();
    // PNG を含む → 警告する
    await runExport({
      formats: new Set(["png"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv: vi.fn(async () => null),
      imageWarnCount: 20,
      onImageWarn,
    });
    expect(onImageWarn).toHaveBeenCalledWith(25);

    // PDF のみ(PNG なし) → ページ分割されるため警告しない
    onImageWarn.mockClear();
    await runExport({
      formats: new Set(["pdf"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv: vi.fn(async () => null),
      imageWarnCount: 20,
      onImageWarn,
    });
    expect(onImageWarn).not.toHaveBeenCalled();

    // クリップボードのみ → 画像でないため警告しない
    onImageWarn.mockClear();
    await runExport({
      formats: new Set(["clipboard"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv: vi.fn(async () => null),
      imageWarnCount: 20,
      onImageWarn,
    });
    expect(onImageWarn).not.toHaveBeenCalled();
  });

  it("対象コンボが0件のとき、csv 以外は empty・csv は実行される", async () => {
    resolveExportComboRes.mockResolvedValue({
      combos: [],
      observation: { total: 0, included: 0, reimportBlocked: false },
    });
    const exportCsv = vi.fn(async () => null);
    const result = await runExport({
      formats: new Set(["csv", "pdf", "clipboard"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(exportCsv).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual([
      { format: "csv", status: "success" },
      { format: "pdf", status: "empty" },
      { format: "clipboard", status: "empty" },
    ]);
  });

  it("resolveExportCombos が失敗しても csv は独立して成功しうる", async () => {
    resolveExportComboRes.mockRejectedValue(new Error("network error"));
    const exportCsv = vi.fn(async () => null);
    const result = await runExport({
      formats: new Set(["csv", "png"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(exportCsv).toHaveBeenCalledTimes(1);
    const csvResult = result.results.find((r) => r.format === "csv");
    const pngResult = result.results.find((r) => r.format === "png");
    expect(csvResult?.status).toBe("success");
    expect(pngResult?.status).toBe("error");
    expect(pngResult?.error?.message).toBe("network error");
  });

  it("個別形式の生成失敗は他形式に影響しない", async () => {
    imageMocks.exportComboImage.mockRejectedValueOnce(new Error("capture failed"));
    const exportCsv = vi.fn(async () => null);
    const result = await runExport({
      formats: new Set(["pdf", "png"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });

    expect(result.results).toEqual([
      { format: "pdf", status: "error", error: expect.any(Error) },
      { format: "png", status: "success" },
    ]);
  });

  it("視覚出力(PDF/PNG)には video/image を渡さず link は残す(M17-05c-fix・CSV 非波及)", async () => {
    const exportCsv = vi.fn(async () => null);
    await runExport({
      formats: new Set(["csv", "pdf"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS, // 全 17(video/image 含む)
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });
    // 画像経路に渡る selected はメディアパスを除いた集合
    const sel = imageMocks.exportComboImage.mock.calls[0][2] as ReadonlySet<string>;
    expect(sel.has("videoPath")).toBe(false);
    expect(sel.has("imagePath")).toBe(false);
    expect(sel.has("link")).toBe(true);
    expect(sel.has("recipe")).toBe(true);
    // CSV は selected 非依存(exportParams のみ)で呼ばれる(往復 3 列維持)
    expect(exportCsv).toHaveBeenCalledWith({
      params: exportParams,
      baseName: BASE_NAME,
    });
  });

  it("クリップボードにも video/image を渡さない(M17-05c-fix)", async () => {
    const exportCsv = vi.fn(async () => null);
    await runExport({
      formats: new Set(["clipboard"]),
      exportParams,
      selectedItems: DEFAULT_SELECTED_ITEMS,
      characters: TEST_CHARACTERS,
      baseName: BASE_NAME,
      exportCsv,
      imageWarnCount: 20,
    });
    const sel = (clipboardMocks.buildClipboardHtml.mock.calls[0] as unknown[])[2] as ReadonlySet<string>;
    expect(sel.has("videoPath")).toBe(false);
    expect(sel.has("imagePath")).toBe(false);
    expect(sel.has("link")).toBe(true);
  });

  // =========================================================================
  // ★★M29-02 §2.1: 切り捨ての観測が呼び出し元まで届くこと。
  //
  // ★ここに主張が無いと、run-export の中で onTruncated を呼び忘れても
  //   ExportDialog 側のテスト(runExport をモックしている)は緑のまま通る。
  //   ⇒ 「1 経路だけ鳴らして他が黙ったまま残る」の典型(チェックリスト §0.4-1)。
  // =========================================================================
  describe("切り捨ての観測", () => {
    it("★FE 生成の書出が上限で切れたら onTruncated を呼ぶ", async () => {
      resolveExportComboRes.mockResolvedValue({
        combos: [makeCombo({ id: 1 })],
        observation: { total: 250, included: 100, reimportBlocked: false },
      });
      const onTruncated = vi.fn();
      await runExport({
        formats: new Set(["pdf"]),
        exportParams,
        selectedItems: DEFAULT_SELECTED_ITEMS,
        characters: TEST_CHARACTERS,
        baseName: BASE_NAME,
        exportCsv: vi.fn(async () => null),
        imageWarnCount: 20,
        onTruncated,
      });

      expect(onTruncated).toHaveBeenCalledWith({
        total: 250,
        included: 100,
        reimportBlocked: false,
      });
    });

    it("切り捨てが無ければ onTruncated を呼ばない(偽陽性を出さない)", async () => {
      const onTruncated = vi.fn();
      await runExport({
        formats: new Set(["pdf"]),
        exportParams,
        selectedItems: DEFAULT_SELECTED_ITEMS,
        characters: TEST_CHARACTERS,
        baseName: BASE_NAME,
        exportCsv: vi.fn(async () => null),
        imageWarnCount: 20,
        onTruncated,
      });
      expect(onTruncated).not.toHaveBeenCalled();
    });

    it("★BE 生成の CSV が返した観測も呼び出し元へ渡す(経路が別なので別に主張する)", async () => {
      const onTruncated = vi.fn();
      const onReimportBlocked = vi.fn();
      await runExport({
        formats: new Set(["csv"]),
        exportParams,
        selectedItems: DEFAULT_SELECTED_ITEMS,
        characters: TEST_CHARACTERS,
        baseName: BASE_NAME,
        exportCsv: vi.fn(async () => ({
          total: 1500,
          included: 1000,
          reimportBlocked: true,
        })),
        imageWarnCount: 20,
        onTruncated,
        onReimportBlocked,
      });

      expect(onTruncated).toHaveBeenCalledTimes(1);
      expect(onReimportBlocked).toHaveBeenCalledTimes(1);
    });

    it("★ヘッダが読めず観測が null のときは何も言わない(切り捨て無しと断定しない)", async () => {
      const onTruncated = vi.fn();
      await runExport({
        formats: new Set(["csv"]),
        exportParams,
        selectedItems: DEFAULT_SELECTED_ITEMS,
        characters: TEST_CHARACTERS,
        baseName: BASE_NAME,
        exportCsv: vi.fn(async () => null),
        imageWarnCount: 20,
        onTruncated,
      });
      expect(onTruncated).not.toHaveBeenCalled();
    });
  });
});
