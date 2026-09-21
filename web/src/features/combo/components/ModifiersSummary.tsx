// ステップに付いた修飾(modifiers)の要約表示。
//
// ★★【M24-05・SM-052】本部品は「新しい見せ方」ではない。コンボ側 StepRow が持って
//   いた renderModifiersSummary を挙動そのままで切り出したものである。
//
// ★切り出した理由——同じ「1 ステップの修飾を行内へ要約する」処理が 2 実装あり、
//   セットプレイ側(SetupRecipeEditor)だけが次の 5 点で食い違っていた:
//     (a) flags を MODIFIER_FLAGS へ通さず内部コードのまま出していた(`just` / `link`)
//     (b) notes を本文ごと行内へ展開していた(コンボ側は ※ 記号 + title)
//     (c) 1 個の span へ ", " で連結していた(コンボ側は flag ごとのバッジ)
//     (d) modifiers.type を内部コードのまま出していた
//     (e) ★型だけのステップ(parry_drive_rush / cancel_drive_rush)でも灰色のバッジを
//         描いていた。★★主ラベルが renderStepLabel で「パリィドライブラッシュ」と
//         日本語で出しているのと同じ情報が、バッジ側に内部コードで二重に出ていた
//         (コンボ側は flags も notes も無ければ null を返す)。
//         ★「中身が空のバッジが残る」ではない——完全に空の修飾は画面操作では作れない。
//           ModifiersEditor は中身がゼロなら undefined を返すため、旧実装の
//           「空文字を join して空のバッジを描く」分岐は理論上のものである。
//           ⇒ 実際に見えていたのは上記の二重表示のほうである。
//   memo の SM-052「セットプレイの modify(メモの方)の表示がコンボと不一致」の実体は
//   これである。★指示書 §4.2 は RecipeText で解けると見立てていたが、機序が違った
//   ——RecipeText は recipe_cache 由来の文字列を描く部品であり、修飾の要約は通らない。
//
// ★modifiers.type は要約に出さない。型はステップの主ラベル側(renderStepLabel)が
//   user 語彙で描くものであり、ここへ内部コードで再掲すると語彙が 2 系統になる。
import { MODIFIER_FLAGS } from "../labels";
import type { Modifiers } from "../types";

interface Props {
  modifiers?: Modifiers | null;
}

/**
 * 修飾の要約を 1 行で描く。
 *
 * ★flags も notes も無ければ何も描かない(null を返す)。型だけのステップで、
 *   主ラベルが既に日本語で出している情報を内部コードで再掲しないためである。
 */
export function ModifiersSummary({ modifiers }: Props) {
  if (!modifiers) return null;
  const flagLabels =
    modifiers.flags?.map(
      (f) => MODIFIER_FLAGS.find((x) => x.value === f)?.label ?? f,
    ) ?? [];
  const hasNotes = !!modifiers.notes && modifiers.notes.length > 0;

  if (flagLabels.length === 0 && !hasNotes) return null;

  return (
    <span
      className="flex items-center gap-1 text-xs text-gray-500"
      data-testid="modifiers-summary"
    >
      {flagLabels.map((l) => (
        <span key={l} className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
          {l}
        </span>
      ))}
      {hasNotes && (
        // ★本文は出さず記号 + ホバーにする。長いメモで行が伸びると
        //   レシピそのものが読めなくなるためである(セットプレイ側は展開していた)。
        <span title={modifiers.notes ?? ""} className="italic">
          ※
        </span>
      )}
    </span>
  );
}
