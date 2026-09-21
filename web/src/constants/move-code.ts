// 技 code のうち、実装が名指しで参照するもの。
// バックエンド internal/model/move.go の対応する const ブロックと 1:1 で同期する
// (CLAUDE.md §4。新規値追加時は両側を同時更新すること)。
//
// ★共通技タブが並べる 13 code は本ファイルに置かない —— あちらは「並び順そのもの」であり、
//   features/combo/moveSurfacing.ts の COMMON_MOVE_CODES が正本である(M30-01 / CHANGE-170 §2.2)。
//   ここに置くのは「1 件を名指しする」ための定数だけである。

/**
 * ドライブリバーサル(M31-04 / SM-098、マイグレ 000109)。
 *
 * ★category は system で、全キャラに 1 行ずつ在る。
 * ★確定反撃の走査には「相手技」として出る(ブロックタブのみ。ジャストパリィタブからは
 *   BE 側 justParryExcludedCodes が外す)。
 * ★入力面には出さない —— 防御リバーサルでありコンボ部品ではない(DES-002 §4)。
 *   除外の実体は features/combo/moveSurfacing.ts の INPUT_EXCLUDED_MOVE_CODES。
 */
export const MOVE_CODE_DRIVE_REVERSAL = "drive_reversal";
