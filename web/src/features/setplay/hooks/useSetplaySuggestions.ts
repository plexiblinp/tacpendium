import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { setplayApi, type GetSuggestionsParams } from "../api/setplayApi";

// useSetplaySuggestions は「提案を出す」で確定した applied パラメータで取得する。
// applied が null の間(未検索)は fetch しない(#1: 条件指定→提案を出す)。
export function useSetplaySuggestions(
  comboId: number | null | undefined,
  applied: GetSuggestionsParams | null,
) {
  return useQuery({
    // applied は全条件(mode・limit・gMin/gMax 等を含む)なので、条件変更・「さらに表示」で
    // queryKey が変わり再取得される(§4.3.4)。react-query が構造ハッシュで比較する。
    queryKey: queryKeys.setplaySuggestions.list(comboId, applied),
    queryFn: () => setplayApi.getSuggestions(comboId as number, applied as GetSuggestionsParams),
    enabled: applied != null && typeof comboId === "number" && comboId > 0,
  });
}
