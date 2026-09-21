import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { tagApi } from "@/features/tag/api/tagApi";
import {
  TAG_CATEGORY_MYCOMBO_STATUS,
  MYCOMBO_STATUS_VALUES,
  MYCOMBO_STATUS_TAG_NAMES,
  type MyComboStatus,
} from "@/constants/mycombo";
import { queryKeys } from "@/lib/query-keys";

export interface MyComboStatusTagMap {
  statusToTagId: Map<MyComboStatus, number>;
  tagIdToStatus: Map<number, MyComboStatus>;
  allTagIds: Set<number>;
  isLoading: boolean;
}

export function useMyComboStatusTags(): MyComboStatusTagMap {
  const query = useQuery({
    queryKey: queryKeys.tags.byCategory(false, TAG_CATEGORY_MYCOMBO_STATUS),
    queryFn: () => tagApi.list({ category: TAG_CATEGORY_MYCOMBO_STATUS }),
  });

  return useMemo(() => {
    const statusToTagId = new Map<MyComboStatus, number>();
    const tagIdToStatus = new Map<number, MyComboStatus>();
    const allTagIds = new Set<number>();

    if (query.data) {
      for (const status of MYCOMBO_STATUS_VALUES) {
        const tagName = MYCOMBO_STATUS_TAG_NAMES[status];
        const tag = query.data.find((t) => t.name === tagName);
        if (tag) {
          statusToTagId.set(status, tag.id);
          tagIdToStatus.set(tag.id, status);
          allTagIds.add(tag.id);
        }
      }
    }

    return { statusToTagId, tagIdToStatus, allTagIds, isLoading: query.isLoading };
  }, [query.data, query.isLoading]);
}
