import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { tagApi } from "@/features/tag/api/tagApi";
import type { Tag } from "@/types/tag";
import { queryKeys } from "@/lib/query-keys";

interface Options {
  excludeCategories?: string[];
}

export function useTagsForSelector(options?: Options) {
  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.list(false),
    queryFn: () => tagApi.list({ includeUsage: false }),
  });

  const filteredTags = useMemo<Tag[]>(() => {
    if (!tagsQuery.data) return [];
    const exclude = options?.excludeCategories;
    if (!exclude || exclude.length === 0) return tagsQuery.data;
    return tagsQuery.data.filter(
      (t) => !exclude.includes(t.category ?? ""),
    );
  }, [tagsQuery.data, options?.excludeCategories]);

  return { tagsQuery, filteredTags };
}
