// PDF ページ分割プランナ(純関数・DOM 非依存)。M17-05c / M17-05c-fix(CHANGE-073)。
// 出力文書を「用紙寸法固定＋列分割」でページに割る。M17-05c-fix で行分割は廃止し、
// 用紙(A4)を超える場合は render 側で縮小フィット(下限 70%・下回れば注記して原寸)する。
// 本モジュールは「どの列(コンボ)をどのページに載せるか」だけを決める(高さは縮小フィットが吸収)。
//
// 実測(2026-07-18・Chromium・視覚 26 項目): 単独 720×1053px／比較 4 列は幅 1123px・
// 総高 1049〜1112px(レシピ6行まで)で A4 縦相当(1122.5px)に原寸で収まる。8 行激長で 97% 縮小。

/**
 * 比較表の 1 ページあたり列(コンボ)数。5 件以上で横方向に列分割する(名前付き定数＝将来の切替は 1 箇所)。
 * 実測 n=4 で A4 横幅(1122.5px)に収まり、レシピ 4 行まで A4 縦相当に原寸で収まる。
 */
export const PDF_COLUMNS_PER_PAGE = 4;

// 用紙寸法(PDF ポイント・72dpi)。CHANGE-073 §2.1(単独=A4 縦/比較=A4 横)＋§2.5(高さ基準は A4 縦相当)。
const MM_TO_PT = 72 / 25.4;
/** A4 縦: 210×297mm。単独出力の用紙。 */
export const A4_PORTRAIT_PT = { width: 210 * MM_TO_PT, height: 297 * MM_TO_PT };
/**
 * 比較表の用紙: 幅＝A4 横の長辺(297mm)／高さ＝A4 縦相当の長辺(297mm)。
 * ※厳密 A4 横(高 210mm)だと激長レシピで常時縮小になり §2.5「原寸で収まる」と食い違うため、
 * 高さ基準を A4 縦相当(297mm)に採る(印刷時はプリンタが A4 へ縮小)。
 */
export const COMPARISON_PAGE_PT = {
  width: 297 * MM_TO_PT,
  height: 297 * MM_TO_PT,
};

/** 縮小フィットの下限。これを下回る縮小率になる場合は縮小せず、原寸のまま注記して出力する(切らない)。 */
export const PDF_SHRINK_MIN_RATIO = 0.7;

/** 1 ページ分の割付結果(列分割のみ・行は常に全件)。 */
export interface ExportPagePlan {
  /** 1 始まりの通しページ番号。 */
  pageNumber: number;
  /** 比較表のみ: このページに載せる列(コンボ)の開始インデックス [含む]。 */
  columnStart?: number;
  /** 比較表のみ: このページに載せる列(コンボ)の終了インデックス [含まない]。 */
  columnEnd?: number;
}

/** planPages への入力。 */
export interface PaginateInput {
  mode: "single" | "comparison";
  /** 比較表のコンボ数(mode==="comparison" のとき必須)。 */
  columnCount?: number;
  /** 比較表の 1 ページ列数。既定 PDF_COLUMNS_PER_PAGE。 */
  columnsPerPage?: number;
}

/**
 * ページ割付を計算する(列分割のみ・行は常に全件＝行分割は M17-05c-fix で廃止)。
 * - 単独: 常に 1 ページ(A4 縦・超過は縮小フィット)。
 * - 比較: 4 列ずつに横分割(5 件以上)。各ページに項目名列＋コンボ名 thead を再掲(描画側)。
 */
export function planPages(input: PaginateInput): ExportPagePlan[] {
  if (input.mode === "single") {
    return [{ pageNumber: 1 }];
  }
  const columnCount = input.columnCount ?? 0;
  const columnsPerPage = input.columnsPerPage ?? PDF_COLUMNS_PER_PAGE;
  const pages: ExportPagePlan[] = [];
  let pageNumber = 0;
  for (let start = 0; start < columnCount; start += columnsPerPage) {
    pages.push({
      pageNumber: ++pageNumber,
      columnStart: start,
      columnEnd: Math.min(start + columnsPerPage, columnCount),
    });
  }
  // 列が無い(理論上 0 件)場合も 1 ページを返し、呼び出し側の分岐を単純化する。
  return pages.length > 0 ? pages : [{ pageNumber: 1 }];
}
