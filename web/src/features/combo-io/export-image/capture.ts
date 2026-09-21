// 汎用エクスポートコア: HTMLElement → PNG ラスタ。PNG/PDF アダプタは共にここを使う。
// 既定ラスタライザは html-to-image(MIT)。ExportOptions.raster で差し替え可能(疎結合)。
//
// 出典: autopilot-combomgr/projects/combo-export-image src/core/capture.ts。
// 本プロジェクトの先行内製成果物(LICENSE ファイル無し = 本体ライセンス下に取込。
// ランタイム依存 html-to-image / pdf-lib は MIT)。M13-02 で本体へソースコピー(ロジックは原典どおり)。

import * as htmlToImage from "html-to-image";
import type { ExportOptions, RasterFn, RasterResult } from "./types";

// ブラウザの canvas 寸法上限(各社の実装下限に合わせた安全値)。これを超えると
// canvas は空/切れた描画になり、html-to-image が黙って壊れた画像を返す。
// 巨大な一覧(多数コンボ × pixelRatio)で起きうるため、沈黙の破綻を明示エラーへ変える。
// M17-05c: PDF は自動ページ分割で上限を回避する(paginate/render-and-capture)。PNG は 1 枚のまま
// (分割しない = 承認方針)ため、上限到達時は本例外がバックストップとなる(静かに壊れない)。
// 事前警告は EXPORT_IMAGE_WARN_COUNT(=実測 22)で PNG 選択時に発火し PDF を促す。
const MAX_CANVAS_DIMENSION = 16384;

/**
 * 既定のラスタライザ: html-to-image でノードを canvas 化し PNG バイト列を得る。
 * canvas.width/height からピクセル寸法も返す(PDF のページ寸法算出に使う)。
 */
export const defaultRaster: RasterFn = async (
  node: HTMLElement,
  options: ExportOptions,
): Promise<RasterResult> => {
  const canvas = await htmlToImage.toCanvas(node, {
    pixelRatio: options.pixelRatio ?? 2,
    backgroundColor: options.backgroundColor ?? "#ffffff",
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("ラスタライズ結果の寸法が 0 です(描画対象が空の可能性)");
  }
  if (
    canvas.width > MAX_CANVAS_DIMENSION ||
    canvas.height > MAX_CANVAS_DIMENSION
  ) {
    throw new Error(
      `ラスタ寸法 ${canvas.width}x${canvas.height}px が canvas 上限(${MAX_CANVAS_DIMENSION}px)を超過。` +
        `PNG は 1 枚出力のため対象が多いと上限に達します。PDF(自動ページ分割)での出力、` +
        `または出力対象を絞ってください。`,
    );
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("canvas.toBlob が null を返しました(PNG 生成失敗)");

  const png = new Uint8Array(await blob.arrayBuffer());
  return { png, width: canvas.width, height: canvas.height };
};

/** ノードを PNG ラスタへ変換する(ラスタライザは options.raster で差し替え可能)。 */
export function capture(
  node: HTMLElement,
  options: ExportOptions = {},
): Promise<RasterResult> {
  const raster = options.raster ?? defaultRaster;
  return raster(node, options);
}
