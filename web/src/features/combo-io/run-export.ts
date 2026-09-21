// M17-05b: エクスポートダイアログから複数形式(CSV/PDF/PNG/クリップボード)を
// 順次生成・ダウンロードするためのオーケストレーション。
// 生成自体は既存関数(resolveExportCombos/exportComboImage/clipboard.ts/useExportCombo)を
// そのまま呼び出す(新規の生成ロジックは作らない)。本ファイルは実行順序・結果集約のみを担う。

import type { Character } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "@/features/combo/types";
import type { ExportCsvVariables, ExportParams } from "./api";
import { toVisualSelected, type ExportItemKey } from "./export-items";
import { resolveExportCombos } from "./export-data";
import { isTruncated, type ExportObservation } from "./export-truncation";
import {
  buildClipboardHtml,
  buildClipboardText,
  copyComboClipboard,
} from "./clipboard";
import { exportComboImage } from "./export-image/render-and-capture";

export type ExportFormat = "csv" | "pdf" | "png" | "clipboard";

// 実行順序(固定)。CSV は BE 生成で resolveExportCombos に依存しないため、
// 他形式の解決に失敗しても独立して実行できる。
const FORMAT_ORDER: ExportFormat[] = ["csv", "pdf", "png", "clipboard"];

// ダウンロードを伴う形式間に挟む待機(ブラウザの多重ダウンロード抑止への簡易対策)。
// §3.3-3 で「軽微・持ち越し許容」と整理済みの論点のため、簡易対応に留める。
const DOWNLOAD_INTERVAL_MS = 300;

export interface RunExportParams {
  formats: ReadonlySet<ExportFormat>;
  exportParams: ExportParams;
  selectedItems: ReadonlySet<ExportItemKey>;
  characters: Character[] | undefined;
  /**
   * 拡張子を除いた外側のファイル名(SM-075・M24-06 §4.4)。
   * ★形式ごとに拡張子を付けるため、1 回の実行で選ばれた全形式が同じベース名を共有する。
   * ★ZIP の中のエントリ名には及ぼさない(DES-002 §7.6 の契約)。
   */
  baseName: string;
  /** useExportCombo().mutateAsync を呼び出し元(フック使用可能な場所)から注入する。 */
  /**
   * useExportCombo().mutateAsync。
   * ★戻り値の観測(切り捨て・往復不能)を捨てないこと —— 捨てると BE 生成の
   * CSV 経路だけが黙ったまま残る(M29-02 §2.1)。
   */
  exportCsv: (
    variables: ExportCsvVariables,
  ) => Promise<ExportObservation | null>;
  imageWarnCount: number;
  onImageWarn?: (count: number) => void;
  /**
   * FE 生成の書出(PDF/PNG/クリップボード)が上限で切り捨てたときに呼ばれる。
   * ★BE 生成の CSV は応答ヘッダ経由で別に観測される(useExportCombo)。
   */
  onTruncated?: (observation: ExportObservation) => void;
  /**
   * 出力したファイルを取込に掛けると上限で弾かれるとき(往復不能)に呼ばれる。
   * ★書出に行数・バイト数の上限が無いのに取込は上限で弾く、という非対称の観測。
   */
  onReimportBlocked?: (observation: ExportObservation) => void;
}

export type FormatResultStatus = "success" | "error" | "empty";

export interface FormatResult {
  format: ExportFormat;
  status: FormatResultStatus;
  error?: Error;
}

export interface RunExportResult {
  results: FormatResult[];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 選択された形式を固定順(csv→pdf→png→clipboard)で順次生成・ダウンロードする。 */
export async function runExport(
  params: RunExportParams,
): Promise<RunExportResult> {
  const {
    formats,
    exportParams,
    selectedItems,
    characters,
    baseName,
    exportCsv,
    imageWarnCount,
    onImageWarn,
    onTruncated,
    onReimportBlocked,
  } = params;

  // 視覚出力(PDF/PNG/クリップボード)はメディアのローカルパスを出さない(§5.13a・案B)。CSV は非波及。
  const visualSelected = toVisualSelected(selectedItems);

  const orderedFormats = FORMAT_ORDER.filter((f) => formats.has(f));
  const needsCombos = orderedFormats.some((f) => f !== "csv");
  // M17-05c: PDF は自動ページ分割で canvas 上限に当たらないため、件数警告は PNG 選択時のみ。
  const needsImageWarn = orderedFormats.includes("png");

  let combos: ComboDetail[] | null = null;
  let combosError: Error | null = null;
  if (needsCombos) {
    try {
      const resolved = await resolveExportCombos(exportParams);
      combos = resolved.combos;
      // ★FE 生成の書出が上限で切り捨てたことを呼び出し元へ伝える(M29-02 §2.1)。
      //   伝えないと「全件のつもりが 100 件だった」に気づく手立てが無い。
      if (isTruncated(resolved.observation)) {
        onTruncated?.(resolved.observation);
      }
      if (needsImageWarn && combos.length > imageWarnCount) {
        onImageWarn?.(combos.length);
      }
    } catch (e) {
      combosError = e as Error;
    }
  }

  const results: FormatResult[] = [];
  let downloadCount = 0;

  for (const format of orderedFormats) {
    if (format !== "csv") {
      if (combosError) {
        results.push({ format, status: "error", error: combosError });
        continue;
      }
      if (combos && combos.length === 0) {
        results.push({ format, status: "empty" });
        continue;
      }
    }

    if (downloadCount > 0) {
      await wait(DOWNLOAD_INTERVAL_MS);
    }

    try {
      if (format === "csv") {
        // CSV は BE 生成・selected 非依存(全列)。メディア 3 列も維持(往復インポート契約)。
        const csvObservation = await exportCsv({
          params: exportParams,
          baseName,
        });
        // ★BE が返した観測をそのまま呼び出し元へ渡す。ヘッダが読めなかった場合
        //   (null)は何も言わない —— 「切り捨てていない」と断定しないためである。
        if (csvObservation && isTruncated(csvObservation)) {
          onTruncated?.(csvObservation);
        }
        if (csvObservation?.reimportBlocked) {
          onReimportBlocked?.(csvObservation);
        }
      } else if (format === "clipboard") {
        // M17-05c-fix: 視覚出力はメディアのローカルパス(video/image)を出さない。CSV には波及しない。
        const html = buildClipboardHtml(combos!, characters, visualSelected);
        const text = buildClipboardText(combos!, characters, visualSelected);
        await copyComboClipboard(html, text);
      } else {
        await exportComboImage(combos!, characters, visualSelected, format, baseName);
      }
      results.push({ format, status: "success" });
    } catch (e) {
      results.push({ format, status: "error", error: e as Error });
    }
    downloadCount++;
  }

  return { results };
}
