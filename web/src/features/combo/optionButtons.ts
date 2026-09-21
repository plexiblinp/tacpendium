// M24-12: 選択肢をボタン化するかどうかの判定と、数字キーのショートカット割当。
//
// ★★線引きの出所は開発者の逐語である——「10を超えるものはボタン化の対象外。」
//   (D-578(4))。理由は数字キーが 10 個しか無いことと同じである: 1〜9 と 0 で
//   ちょうど 10 個であり、11 個目には押すキーが無い。
//
// ★本ファイルは純粋関数だけを置く(描画は OptionButtonGroup.tsx)。
//   ⇒ 「個数からの分岐」を画面を組まずにテストできる(指示書 §5.1)。

/**
 * 数字キーを割り当てられる上限。
 * ★1〜9 と 0 で 10 個。これがボタン化の線引きそのものである。
 */
export const MAX_BUTTONIZED_OPTIONS = 10;

/**
 * その個数の選択肢をボタン化してよいか。
 *
 * ★★本関数は**線引きを機械で固定するための仕様である**。画面側の分岐からは呼ばない
 *   ——ボタン化するかは欄ごとに人が決めており（実査 §3.3-3 の結果に基づく静的な判断）、
 *   実行時に個数から自動で切り替える設計にはしていない。
 *   ★では何を守っているのか: **「10 を超えたらボタン化しない」という線引きそのもの**を
 *     テストで固定し、後任が線を動かしたときに気づけるようにしている
 *     （`optionButtons.test.ts` が実際の欄の個数を並べて判定している）。
 *   ★実行時に上限が破れないことは `shortcutKeyForIndex` が担保する——11 個目以降には
 *     数字を割り当てない（`OptionButtonGroup` はその戻り値が null なら数字を出さない）。
 *
 * ★0 個は「ボタン化する対象が無い」であって「ボタン化できない」ではないが、
 *   呼び出し側で分岐させないよう false を返す(描くものが無い)。
 */
export function shouldButtonizeOptions(count: number): boolean {
  return count > 0 && count <= MAX_BUTTONIZED_OPTIONS;
}

/**
 * n 番目(0 始まり)の選択肢に割り当てる数字キー。
 * ★0..8 → "1".."9"、9 → "0"。10 番目以降は割り当てない(null)。
 *
 * ★★"0" を 10 番目に置くのはキーボードの並び順どおりだからである
 *   ——数字列は 1234567890 であり、0 は 9 の右隣にある。
 */
export function shortcutKeyForIndex(index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (index >= MAX_BUTTONIZED_OPTIONS) return null;
  return index === MAX_BUTTONIZED_OPTIONS - 1 ? "0" : String(index + 1);
}

/**
 * 押された数字キーが何番目(0 始まり)の選択肢を指すか。
 * ★shortcutKeyForIndex の逆。数字キー以外は null。
 */
export function indexForShortcutKey(key: string): number | null {
  if (key.length !== 1) return null;
  if (key === "0") return MAX_BUTTONIZED_OPTIONS - 1;
  if (key >= "1" && key <= "9") return Number(key) - 1;
  return null;
}
