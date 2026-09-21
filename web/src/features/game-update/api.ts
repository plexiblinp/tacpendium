import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { GameUpdateNotice } from "./types";

const NOTICE_PATH = "/api/notices/game-update";

/**
 * ゲーム更新の告知を取る(FR702・M28-02c)。
 *
 * ★★バナーと一覧のボタンが同じ 1 本を見る。⇒ 件数の出どころが 1 つに保たれる。
 * ★★取得に失敗したときに「0 件」として扱わないこと —— 呼び手は isError を
 *   見て失敗として描く(先例の轍 = combo-list-setup-count-hides-fetch-failure)。
 * ★retry: false —— 失敗を失敗として早く出す(告知は再試行で粘るものではない)。
 */
export function useGameUpdateNotice() {
  return useQuery({
    queryKey: queryKeys.notices.gameUpdate(),
    queryFn: () => fetchJSON<GameUpdateNotice>(NOTICE_PATH),
    retry: false,
  });
}

/**
 * 次の版まで告知を延期する。
 *
 * ★★要求本文を取らない。版数はサーバが games.current_data_version を読んで書く
 *   (acknowledge-version が「版数をクライアントから受けない」を選んだのと同型)。
 * ★★抑止されるのはバナーだけである。一覧のボタンは消さない。
 */
export function usePostponeGameUpdateNotice() {
  const qc = useQueryClient();
  return useMutation({
    // ★fetchJSON を通す(同じ告知系の先例 = useDataMigrationNotice と揃える)。
    //   204 は undefined として返る実装であり、本経路の形そのものである。
    mutationFn: () =>
      fetchJSON<void>(`${NOTICE_PATH}/postpone`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notices.gameUpdate() });
    },
  });
}

/**
 * 1 件のコンボを「問題なし」にする(基準を現在の版へ進める)。
 *
 * ★★API 名は acknowledge-version のままである(画面のラベルとは意図的にずらしてある
 *   = CHANGE-162 §6.1)。
 * ★★一括は無い。1 件ずつだけである —— 一括で誤爆すると前の基準がどこにも残らない。
 * ★件数が減るため告知も無効化する。
 */
export function useAcknowledgeComboVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comboId: number) =>
      fetchJSON<void>(`/api/combos/${comboId}/acknowledge-version`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      qc.invalidateQueries({ queryKey: queryKeys.combo.all() });
      qc.invalidateQueries({ queryKey: queryKeys.notices.gameUpdate() });
    },
  });
}
