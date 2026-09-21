import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setupApi } from "../api/setupApi";

// C-08: 新規コンボ登録時の紐付け候補を knockdown_advantage 一致で取得する。
// knockdownAdvantage が null(未入力)のときは候補なし(クエリ無効)。
export function useSetupCandidatesByKnockdown(
  characterId: number | null | undefined,
  knockdownAdvantage: number | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.setupCandidates.byKnockdown(characterId, knockdownAdvantage),
    queryFn: () =>
      setupApi.getCandidatesByCharacter(characterId!, knockdownAdvantage!),
    enabled:
      !!characterId &&
      characterId > 0 &&
      knockdownAdvantage !== null &&
      knockdownAdvantage !== undefined,
  });
}
