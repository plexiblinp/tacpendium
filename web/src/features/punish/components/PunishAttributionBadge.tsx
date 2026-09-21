// 確定反撃サーチの帰属バッジ(M24-07・SM-133)。
//
// ★★相手の技と自分の始動技が同じ行・同じ形で並び、太さの差(font-semibold /
//   font-medium)しか手掛かりが無かったことへの対処である。
//
// ★★【M24-07 レビュー(中-6)で新設】以前は 3 面(PunishTree / PunishList /
//   HiddenItemsPanel)がそれぞれ直書きしており、自分側だけ「自分の技」と
//   「自分の始動技」の 2 語・バッジとプレーンテキストの 2 形に割れていた。
//   ★片側だけバッジにすると「バッジが付いているほうが相手」という第 2 の規則が
//     生まれてしまう。⇒ 語(constants/punish.ts)と形(本部品)を 1 本ずつにする。
//
// ★ラベルを足すだけであり、並び・階層・レイアウトは変えない(指示書 §1.6-7)。

import {
  PUNISH_ATTRIBUTION_OPPONENT_MOVE_LABEL,
  PUNISH_ATTRIBUTION_OWN_STARTER_LABEL,
} from "@/constants/punish";

interface PunishAttributionBadgeProps {
  /** opponent = 相手の技 / own = 自分の始動技。 */
  side: "opponent" | "own";
}

export default function PunishAttributionBadge({
  side,
}: PunishAttributionBadgeProps) {
  const isOpponent = side === "opponent";
  return (
    <span
      className={
        isOpponent
          ? "rounded bg-rose-50 px-1 py-0.5 text-[0.65rem] font-medium text-rose-700"
          : "rounded bg-sky-50 px-1 py-0.5 text-[0.65rem] font-medium text-sky-700"
      }
    >
      {isOpponent
        ? PUNISH_ATTRIBUTION_OPPONENT_MOVE_LABEL
        : PUNISH_ATTRIBUTION_OWN_STARTER_LABEL}
    </span>
  );
}
