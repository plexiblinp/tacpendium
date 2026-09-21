// PDF/PNG 生成のオーケストレーション(フロント生成・サーバ FS 書込ゼロ)。
// 出力レイアウト(ComboExportDocument)を画面外に React 描画 → html-to-image でラスタ →
// PNG はそのまま、PDF は pdf-lib(pngsToPdf)で埋め込み → ブラウザ DL を発火する。
//
// M17-05c / M17-05c-fix(CHANGE-073):
//  - PDF は用紙寸法固定(単独=A4 縦・比較=A4 横相当)。比較は 4 列ずつ列分割(planPages)し、各ページを
//    個別に描画・キャプチャ。各ページは用紙にアスペクト維持で収める(原寸優先・超過分は縮小フィット)。
//    縮小率が下限 70% を下回る場合は縮小せず、注記付きで原寸出力する(切らない)。
//  - PNG は 1 枚のまま(分割しない)。canvas 上限は capture 側のハード例外がバックストップ。
//  - 行分割は廃止(高さ超過は縮小フィットが吸収)。

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { Character } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "@/features/combo/types";
import ComboExportDocument from "../export-layout/ComboExportDocument";
import type { ExportItemKey } from "../export-items";
import { triggerDownload } from "../api";
import { withExtension } from "../export-filename";
import { capture } from "./capture";
import {
  planPages,
  A4_PORTRAIT_PT,
  COMPARISON_PAGE_PT,
  PDF_SHRINK_MIN_RATIO,
} from "./paginate";
import { pngsToPdf, PT_PER_CSS_PX, type PdfPageRaster } from "./pdf";
import type { ExportPageRender } from "../export-layout/ComboExportDocument";

export interface RenderHandle {
  node: HTMLElement;
  cleanup: () => void;
}

// React 要素を画面外(left:-100000px)に描画し、ラスタ対象のノードと後始末を返す。
// レイアウト無影響(画面外固定配置)・計算済みスタイル解決(マウント済み)のため html-to-image が機能する。
export async function renderHidden(
  element: React.ReactElement,
): Promise<RenderHandle> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  const root = createRoot(host);
  flushSync(() => root.render(element));

  // フォント/レイアウト確定のため 2 フレーム待つ。
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    } else {
      resolve();
    }
  });

  const node = (host.firstElementChild as HTMLElement | null) ?? host;
  const cleanup = () => {
    root.unmount();
    host.remove();
  };
  return { node, cleanup };
}

export type ImageFormat = "png" | "pdf";

const PIXEL_RATIO = 2;

interface Paper {
  width: number;
  height: number;
}

// 1 ページを描画・キャプチャし、用紙に収まるかで PdfPageRaster を決める。
// 縮小率 >= 70%: 用紙固定＋縮小フィット(paper 指定)。
// 縮小率 < 70%: 縮小せず注記付きで原寸出力(paper 未指定＝画像同寸ページ)。注記付き再描画は 1 回のみ。
async function renderPageRaster(
  combos: ComboDetail[],
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
  page: ExportPageRender,
  paper: Paper,
  withNote: boolean,
): Promise<PdfPageRaster> {
  const element = createElement(ComboExportDocument, {
    combos,
    characters,
    selected,
    page: { ...page, overflowNote: withNote },
  });
  const handle = await renderHidden(element);
  try {
    const { png, width, height } = await capture(handle.node, {
      pixelRatio: PIXEL_RATIO,
    });
    const imgWpt = (width / PIXEL_RATIO) * PT_PER_CSS_PX;
    const imgHpt = (height / PIXEL_RATIO) * PT_PER_CSS_PX;
    const scale = Math.min(paper.width / imgWpt, paper.height / imgHpt, 1);
    if (scale >= PDF_SHRINK_MIN_RATIO) {
      // 用紙固定＋縮小フィット(原寸で収まれば原寸)。
      return {
        png,
        width,
        height,
        paperWidthPt: paper.width,
        paperHeightPt: paper.height,
      };
    }
    if (withNote) {
      // 下限未満かつ注記済み: 縮小せず原寸(画像同寸ページ)で出す(切らない)。
      return { png, width, height };
    }
    // 下限未満・未注記: 下でクリーンアップしてから注記付きで 1 回だけ再描画する。
  } finally {
    handle.cleanup();
  }
  return renderPageRaster(combos, characters, selected, page, paper, true);
}

// 出力対象コンボを列分割し、各ページを用紙固定で PDF ラスタ化する(単独=A4 縦/比較=A4 横相当)。
async function buildPdfPageRasters(
  combos: ComboDetail[],
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
): Promise<PdfPageRaster[]> {
  const single = combos.length <= 1;
  const plan = planPages({
    mode: single ? "single" : "comparison",
    columnCount: combos.length,
  });
  const paper = single ? A4_PORTRAIT_PT : COMPARISON_PAGE_PT;

  const rasters: PdfPageRaster[] = [];
  for (const p of plan) {
    rasters.push(
      await renderPageRaster(
        combos,
        characters,
        selected,
        {
          pageNumber: p.pageNumber,
          pageCount: plan.length,
          columnStart: p.columnStart,
          columnEnd: p.columnEnd,
        },
        paper,
        false,
      ),
    );
  }
  return rasters;
}

// 出力対象コンボ(1=詳細 / 複数=比較表)を PNG または PDF にして DL する。
// ★baseName は拡張子を除いた外側のファイル名(SM-075・M24-06 §4.4)。
//   単独/複数の区別は名前に入る件数が担うため、combomgr-combo(s) の出し分けは要らなくなった。
export async function exportComboImage(
  combos: ComboDetail[],
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
  format: ImageFormat,
  baseName: string,
): Promise<void> {
  if (format === "png") {
    // PNG は 1 枚のまま(分割しない)。canvas 上限は capture 側のハード例外で担保。
    const element = createElement(ComboExportDocument, {
      combos,
      characters,
      selected,
    });
    const { node, cleanup } = await renderHidden(element);
    try {
      const { png } = await capture(node, { pixelRatio: PIXEL_RATIO });
      triggerDownload(
        new Blob([png as BlobPart], { type: "image/png" }),
        withExtension(baseName, "png"),
      );
    } finally {
      cleanup();
    }
    return;
  }

  // PDF: 列分割＋用紙固定＋縮小フィット。
  const rasters = await buildPdfPageRasters(combos, characters, selected);
  const pdf = await pngsToPdf(rasters, PIXEL_RATIO);
  triggerDownload(
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    withExtension(baseName, "pdf"),
  );
}
