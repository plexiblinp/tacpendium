// PNG/PDF 出力コアの公開型。
//
// 出典: autopilot-combomgr/projects/combo-export-image src/types.ts。
// 本プロジェクトの先行内製成果物(LICENSE ファイル無し = 本体ライセンス下に取込)。
// M13-02 で本体へソースコピーし、ラスタ化コアが必要とする型のみを残した
// (コンボ DTO 系〔ComboDTO/ComboStepDTO/ExportInput〕は本体の ComboDetail を直接使うため除外)。

/** 1 回のラスタライズ結果(PNG バイト列とそのピクセル寸法)。 */
export interface RasterResult {
  /** PNG のバイト列。 */
  png: Uint8Array;
  /** ラスタライズ後のピクセル幅(= CSS幅 × pixelRatio)。 */
  width: number;
  /** ラスタライズ後のピクセル高さ。 */
  height: number;
}

/**
 * ノード→PNG ラスタライザの差し替え口。既定は html-to-image を用いる実装(core/capture.ts)。
 * テストでは差し替え可能なよう関数で抽象化する。
 */
export type RasterFn = (
  node: HTMLElement,
  options: ExportOptions,
) => Promise<RasterResult>;

/** PNG/PDF 出力の共通オプション。 */
export interface ExportOptions {
  /** PNG 解像度倍率(既定 2)。canvas 幅 = CSS幅 × pixelRatio。 */
  pixelRatio?: number;
  /** 背景色(既定 "#ffffff")。透過にしたい場合は "transparent"。 */
  backgroundColor?: string;
  /** ラスタライザの差し替え。未指定なら既定(html-to-image)。 */
  raster?: RasterFn;
}
