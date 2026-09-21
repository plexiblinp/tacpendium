import { useQuery } from "@tanstack/react-query";

import { tagApi } from "@/features/tag/api/tagApi";
import {
  TAG_CATEGORY_MYCOMBO_STATUS,
  MYCOMBO_STATUS_IN_USE,
  MYCOMBO_STATUS_PRACTICING,
  MYCOMBO_STATUS_REDUCED,
  MYCOMBO_STATUS_TAG_NAMES,
  type MyComboStatus,
} from "@/constants/mycombo";
import { queryKeys } from "@/lib/query-keys";

export interface MyComboStatusCounts {
  inUse: number;
  practicing: number;
  reduced: number;
}

function findCount(
  tags: { name: string; usageCount?: number }[],
  status: MyComboStatus,
): number {
  const tagName = MYCOMBO_STATUS_TAG_NAMES[status];
  return tags.find((t) => t.name === tagName)?.usageCount ?? 0;
}

// E-3: characterId を渡すと、件数を当該キャラのコンボのみで集計する(マイコンボの
// ステータス件数を選択キャラに追従させる)。未指定時は全キャラ集計。
export function useMyComboStatusCounts(characterId?: number): {
  data: MyComboStatusCounts | undefined;
  isLoading: boolean;
} {
  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.statusCounts(TAG_CATEGORY_MYCOMBO_STATUS, characterId),
    queryFn: () =>
      tagApi.list({
        includeUsage: true,
        category: TAG_CATEGORY_MYCOMBO_STATUS,
        characterId,
      }),
  });

  const counts: MyComboStatusCounts | undefined = tagsQuery.data
    ? {
        inUse: findCount(tagsQuery.data, MYCOMBO_STATUS_IN_USE),
        practicing: findCount(tagsQuery.data, MYCOMBO_STATUS_PRACTICING),
        reduced: findCount(tagsQuery.data, MYCOMBO_STATUS_REDUCED),
      }
    : undefined;

  return { data: counts, isLoading: tagsQuery.isLoading };
}
