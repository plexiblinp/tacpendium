import { useQuery } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { ComboDetail } from "../types";

/**
 * useDeletedCombo はゴミ箱の行から開く読み取り専用のコンボ詳細を取得する
 * (M23-07 §4.2-2。GET /api/combos/:id/deleted)。
 *
 * ★useCombo(GET /api/combos/:id)とは別の入口である。同経路は
 * deleted_at IS NULL で締め出すため、ゴミ箱の行を引くと 404 になる。
 * 既存経路にフラグを足さないのは、通常の詳細表示で削除済みが返る事故の
 * 余地を残さないためである(M23-06 の教訓)。
 *
 * ★queryKey も分ける。同じキーにすると通常詳細のキャッシュへ削除済みが
 * 混ざり、復元前の状態が通常画面に出る。
 */
export function useDeletedCombo(id: number | string | null | undefined) {
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  return useQuery({
    queryKey: queryKeys.combo.deleted(numId),
    queryFn: () => fetchJSON<ComboDetail>(`/api/combos/${numId}/deleted`),
    enabled: numId != null && !isNaN(Number(numId)),
  });
}
