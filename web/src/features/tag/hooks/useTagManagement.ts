import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { tagApi } from "@/features/tag/api/tagApi";
import type { CreateTagInput, UpdateTagInput } from "@/types/tag";
import { queryKeys } from "@/lib/query-keys";

export function useTagManagement() {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: queryKeys.tags.list(true),
    queryFn: () => tagApi.list({ includeUsage: true }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tags.all() }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTagInput }) =>
      tagApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tags.all() }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: number; force: boolean }) =>
      tagApi.delete(id, force),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tags.all() }),
  });

  return { tagsQuery, createMutation, updateMutation, deleteMutation };
}
