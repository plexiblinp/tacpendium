// セットプレイ自動提案を「採用」するときの、セットプレイ名の既定値。
//
// ★★【M24-05・SM-088】本ファイルは新しい規則ではない。
//   SetplaySuggestionSection のインライン式を、挙動を 1 文字も変えずに
//   切り出したものである。切り出した理由は 2 つ:
//     (1) 指示書 §5.1 が「SM-088 の成立を固定する純粋関数テスト」を求めている。
//     (2) 指示書 §5.3 の破壊確認 3 が「自動生成を止めると赤くなる」ことを求めている。
//   インラインのままでは、どちらも書けない(＝成立していることが固定されない)。
//
// ★★memo の SM-088「セットプレイ名は自動で〇〇重ねと最後の技から生成されるように
//   したい」は、開発者の実機確認(2026-08-29・D-588)で「既に実装済み」と判明した。
//   ⇒ 本サブは実装しない。実測した規則をここで固定するだけである。
//
// ★実測した規則(逐語):
//     ja: "{{move}} 持続{{n}}F目重ね"   (locales/ja.json の setplay.adoptNameFormat)
//     en: "{{move}} meaty on active frame {{n}}"
//   ★設計卓の暫定案は `{attack_type の表示名}・{最後の技}`(例「打撃重ね・弱P」)で
//     あったが、実装は上記であり一致しない。★実装側を正とする(指示書 §5.1)。
//   ★区切りは半角スペース 1 個。attack_type の表示語彙(投げ重ね/シミー/打撃重ね)は
//     使っていない——「重ね」の 1 語だけが入る。
//   ★gap モード(あえて重ねない)でも同じ書式が使われる。名前側にモード分岐は無い。
import type { SetplaySuggestion, SetplaySuggestionStep } from "./types";

/**
 * 提案の「最後の技」を返す。
 *
 * ★★単純な末尾要素である。`move_id` を持つ最後のステップを探す走査はしていない
 *   ——提案の step は `moveId: number` が必須の型であり、この経路には
 *   DES-004 §2.2 の非技ステップ(`move_id` が NULL のドライブラッシュ類)が
 *   入ってこないためである。★入ってくる経路を作るなら、ここも変える必要がある。
 */
export function lastMoveStep(
  suggestion: Pick<SetplaySuggestion, "steps">,
): SetplaySuggestionStep | undefined {
  return suggestion.steps[suggestion.steps.length - 1];
}

/**
 * 採用時のセットプレイ名の既定値を組み立てる。
 *
 * @param suggestion 対象の提案
 * @param displayName 技 ID → 表示名の解決(呼び手が moves から作る)
 * @param format i18n の `setplay.adoptNameFormat` を解決する関数
 *
 * ★空文字を返しうる(steps が空のとき)。VAL-S06(名前必須)は撤回していないため、
 *   その場合は保存が止まる——名前を必須のまま「空なら埋める」形を保つ。
 */
export function buildAdoptedSetupName(
  suggestion: Pick<SetplaySuggestion, "steps" | "n">,
  displayName: (moveId: number, code: string) => string,
  format: (vars: { move: string; n: number }) => string,
): string {
  const target = lastMoveStep(suggestion);
  if (!target) return "";
  return format({ move: displayName(target.moveId, target.code), n: suggestion.n });
}
