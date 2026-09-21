import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

/**
 * 論理削除済みのセットプレイ一覧を取得する(M23-02 §4.2-8)。
 *
 * ★生きた一覧(useCharacterSetups)とは queryKey を分けてある。同じキーに載せると、
 *   ゴミ箱を開いただけでコンボ画面のセットプレイ候補がゴミ箱の中身に置き換わる。
 */
export function useTrashSetups(characterId: number) {
  return useQuery({
    queryKey: queryKeys.setups.trash(characterId),
    queryFn: () => setupApi.listDeletedByCharacter(characterId),
  });
}
