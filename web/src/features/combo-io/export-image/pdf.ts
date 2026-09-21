// PDF 出力アダプタ(薄い): PNG バイト列 → 同寸の 1 ページ PDF へ埋め込み。
// 方針(M13-02・正道): ラスタ埋め込み。文字は画像化され選択不可。
// 日本語フォントはブラウザ DOM レンダリング(html-to-image)で解決されるため、
// PDF 側のフォント埋込は不要。
//
// 出典: autopilot-combomgr/projects/combo-export-image src/adapters/pdf.ts。
// 本プロジェクトの先行内製成果物(LICENSE ファイル無し = 本体ライセンス下に取込。
// ランタイム依存 pdf-lib は MIT)。
// M13-02 で本体へソースコピー。原典の toPdf(resolveNode 依存)は本体側で
// React 描画 + capture を別途行うため除外し、pngToPdf のみを残した。
// TODO(M13-02 後続): 選択可能テキストのベクター PDF は SVG→svg2pdf 等へ差し替えで対応する。

import { PDFDocument } from "pdf-lib";

// CSS ピクセル(96dpi)→PDF ポイント(72dpi)換算係数。
export const PT_PER_CSS_PX = 72 / 96;

/** 1 ページ分の PNG ラスタ(バイト列とそのピクセル寸法)。 */
export interface PdfPageRaster {
  /** PNG バイト列。 */
  png: Uint8Array;
  /** ラスタのピクセル幅(= CSS幅 × pixelRatio)。 */
  width: number;
  /** ラスタのピクセル高さ。 */
  height: number;
  /**
   * 用紙固定(A4 等)時のページ幅・高さ(PDF ポイント)。両方指定すると、画像を用紙内へ
   * アスペクト維持で収める(原寸で収まれば原寸・左上配置／超過分は縮小フィット)。
   * 省略時は画像と同寸のページ(＝縮小せず原寸で出す。M17-05c-fix の下限 70% 未満ケース)。
   */
  paperWidthPt?: number;
  paperHeightPt?: number;
}

/**
 * 複数の PNG ラスタを 1 つの PDF へ順に埋め込む(M17-05c / M17-05c-fix)。
 * - paper 指定あり: ページ＝用紙寸法固定。画像を用紙にアスペクト維持で収める(左上・原寸優先)。
 * - paper 指定なし: ページ＝画像同寸(縮小しない原寸出力)。
 * ページ 1 枚でも呼べる。
 * @param pages ページ順のラスタ配列(空配列は不可)。
 * @param pixelRatio capture 時の pixelRatio(ページ寸法を CSS ピクセル基準へ戻すのに使う)。
 */
export async function pngsToPdf(
  pages: PdfPageRaster[],
  pixelRatio = 2,
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error("PDF ページが 0 枚です(ページ割付の不整合)");
  }
  const pdf = await PDFDocument.create();
  for (const raster of pages) {
    const image = await pdf.embedPng(raster.png);
    // ピクセル → CSS ピクセル → ポイントの画像実寸。
    const imgWpt = (raster.width / pixelRatio) * PT_PER_CSS_PX;
    const imgHpt = (raster.height / pixelRatio) * PT_PER_CSS_PX;

    if (raster.paperWidthPt !== undefined && raster.paperHeightPt !== undefined) {
      // 用紙固定＋縮小フィット: 拡大はせず(原寸まで)、はみ出す分だけ縮小。左上に配置。
      const scale = Math.min(
        raster.paperWidthPt / imgWpt,
        raster.paperHeightPt / imgHpt,
        1,
      );
      const drawW = imgWpt * scale;
      const drawH = imgHpt * scale;
      const page = pdf.addPage([raster.paperWidthPt, raster.paperHeightPt]);
      page.drawImage(image, {
        x: 0,
        y: raster.paperHeightPt - drawH,
        width: drawW,
        height: drawH,
      });
    } else {
      // 画像同寸ページ(原寸・余白なし)。
      const page = pdf.addPage([imgWpt, imgHpt]);
      page.drawImage(image, { x: 0, y: 0, width: imgWpt, height: imgHpt });
    }
  }
  return pdf.save();
}

/**
 * PNG バイト列を、画像と同寸の 1 ページ PDF へ埋め込む(pngsToPdf の 1 枚版・後方互換)。
 * @param png PNG バイト列。
 * @param pxWidth ラスタのピクセル幅(= CSS幅 × pixelRatio)。
 * @param pxHeight ラスタのピクセル高さ。
 * @param pixelRatio capture 時の pixelRatio(ページ寸法を CSS ピクセル基準へ戻すのに使う)。
 * @returns PDF の Uint8Array。
 */
export function pngToPdf(
  png: Uint8Array,
  pxWidth: number,
  pxHeight: number,
  pixelRatio = 2,
): Promise<Uint8Array> {
  return pngsToPdf([{ png, width: pxWidth, height: pxHeight }], pixelRatio);
}
