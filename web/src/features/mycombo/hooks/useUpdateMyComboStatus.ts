import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { TAG_CATEGORY_MYCOMBO_STATUS, type MyComboStatus } from "@/constants/mycombo";
import type { ComboSummary } from "@/features/combo/types";
import { queryKeys } from "@/lib/query-keys";

import { useMyComboStatusTags } from "./useMyComboStatusTags";

interface StatusChangeArgs {
  combo: ComboSummary;
  newStatus: MyComboStatus | "";
}

export function useUpdateMyComboStatus() {
  const { statusToTagId, allTagIds, isLoading: tagsLoading } = useMyComboStatusTags();
  const qc = useQueryClient();
  const [changingComboId, setChangingComboId] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (args: { comboId: number; version: number; tagIds: number[] }) =>
      fetchJSON(`/api/combos/${args.comboId}`, {
        method: "PATCH",
        body: JSON.stringify({ version: args.version, tagIds: args.tagIds }),
      }),
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      qc.invalidateQueries({ queryKey: queryKeys.combo.detail(args.comboId) });
      qc.invalidateQueries({ queryKey: queryKeys.tags.byCategory(true, TAG_CATEGORY_MYCOMBO_STATUS) });
    },
    onSettled: () => setChangingComboId(null),
  });

  const mutate = ({ combo, newStatus }: StatusChangeArgs) => {
    // ステータスタグ一覧の未ロード中は変更しない: allTagIds が空だと旧ステータス
    // タグを判別・除去できず、新タグ追加で二重付与になるため。
    if (tagsLoading || allTagIds.size === 0) return;

    const nonStatusTagIds = combo.tags
      .filter((t) => !allTagIds.has(t.id))
      .map((t) => t.id);

    const newTagIds = [...nonStatusTagIds];
    if (newStatus !== "") {
      const tagId = statusToTagId.get(newStatus);
      if (tagId !== undefined) newTagIds.push(tagId);
    }

    setChangingComboId(combo.id);
    mutation.mutate({ comboId: combo.id, version: combo.version, tagIds: newTagIds });
  };

  return { mutate, changingComboId };
}
