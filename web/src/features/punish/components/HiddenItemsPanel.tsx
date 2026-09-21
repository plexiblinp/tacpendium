import { toast } from "sonner";

import { useRemoveCuration, useRemovePruning } from "../api";
import type { PunishList as PunishListData } from "../types";
import PunishAttributionBadge from "./PunishAttributionBadge";

function moveLabel(nameJa: string | undefined, code: string): string {
  return nameJa && nameJa.length > 0 ? nameJa : code;
}

// HiddenItemsPanel は「隠したもの管理」タブ。
//
// pruning と curation は粒度が違う(自キャラ × 相手技 / コンボ × 相手技)ため、
// セクションを分けて粒度を文言で明示する。同じ「隠す」でも意味が違うことを誤解させない。
// 解除すると探す画面／マイリストに再び現れる(片道操作を残さない)。
export function HiddenItemsPanel({
  list,
  selfCharacterId,
}: {
  list: PunishListData;
  selfCharacterId: number;
}) {
  const removePruning = useRemovePruning();
  const removeCuration = useRemoveCuration();

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-700">確定反撃のない技</h2>
        <p className="mb-2 text-xs text-gray-500">
          この相手技には確定反撃がないとして、探す画面から隠したものです。
        </p>
        {list.hiddenPrunings.length === 0 ? (
          <p className="text-sm text-gray-500">隠している相手技はありません。</p>
        ) : (
          <ul className="space-y-1">
            {list.hiddenPrunings.map((p) => (
              <li
                key={p.opponentMoveId}
                className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2 text-sm"
              >
                <span className="font-medium">{moveLabel(p.nameJa, p.code)}</span>
                <span className="text-xs text-gray-500">
                  {p.opponentCharacterNameJa}
                </span>
                {p.note != null && p.note.length > 0 && (
                  <span className="text-xs text-gray-500">理由: {p.note}</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    removePruning.mutate(
                      { selfCharacterId, opponentMoveId: p.opponentMoveId },
                      {
                        onSuccess: () => toast.success("再表示しました"),
                        // 失敗を黙って握らない(解除できたように見えて隠れたままになるのを防ぐ)。
                        onError: (e) =>
                          toast.error(`解除に失敗しました: ${e.message}`),
                      },
                    )
                  }
                  className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  解除して再表示
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700">使わない反撃</h2>
        <p className="mb-2 text-xs text-gray-500">
          この反撃は使わないとして、マイリストから隠したものです。
        </p>
        {list.hiddenCurations.length === 0 ? (
          <p className="text-sm text-gray-500">隠している反撃はありません。</p>
        ) : (
          <ul className="space-y-1">
            {list.hiddenCurations.map((c) => (
              <li
                key={`${c.comboId}:${c.opponentMoveId}`}
                className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2 text-sm"
              >
                {/* ★M24-07(SM-133): 帰属ラベル。1 行に相手の技と自分の始動技が並ぶ。 */}
                <PunishAttributionBadge side="opponent" />
                <span className="font-medium">{moveLabel(c.nameJa, c.code)}</span>
                <span className="text-xs text-gray-500">
                  {c.opponentCharacterNameJa}
                </span>
                <span className="text-xs text-gray-600">コンボ #{c.comboId}</span>
                <PunishAttributionBadge side="own" />
                <span className="text-xs text-gray-500">
                  {moveLabel(c.starterMoveNameJa, c.starterMoveCode ?? "-")}
                </span>
                {c.note != null && c.note.length > 0 && (
                  <span className="text-xs text-gray-500">理由: {c.note}</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    removeCuration.mutate(
                      { comboId: c.comboId, opponentMoveId: c.opponentMoveId },
                      {
                        onSuccess: () => toast.success("再表示しました"),
                        onError: (e) =>
                          toast.error(`解除に失敗しました: ${e.message}`),
                      },
                    )
                  }
                  className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  解除して再表示
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
