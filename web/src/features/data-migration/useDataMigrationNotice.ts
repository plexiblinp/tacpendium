import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { DataMigrationNotice } from "./types";

const NOTICE_PATH = "/api/notices/data-migration";

// 告知が無いとき、バックエンドは 204 を返す(fetchJSON は undefined を返す)。
export function useDataMigrationNotice() {
  return useQuery<DataMigrationNotice | undefined>({
    queryKey: queryKeys.notices.dataMigration(),
    queryFn: () => fetchJSON<DataMigrationNotice | undefined>(NOTICE_PATH),
    // 移行は生涯 1 度しか起きない。再取得で騒がしくしない。
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // ★取得に失敗しても再試行しない。告知が出ないだけであり、業務は止まらない。
    retry: false,
  });
}

export function useAckDataMigrationNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJSON<void>(`${NOTICE_PATH}/ack`, { method: "POST" }),
    // ★★キャッシュを undefined にしても消えない ————————————————————————
    // TanStack Query の setQueryData は undefined を「更新しない」の合図として扱う。
    // つまり `setQueryData(key, undefined)` は no-op であり、閉じてもバナーが残る。
    // ⇒ acknowledged を立てた値を書く(実際に値が変わるので再描画される)。
    // ★押した瞬間に消えてほしいので onMutate に置く。ack は冪等であり、
    // 失敗しても次の起動でもう一度出るだけで害は無い。
    onMutate: () => {
      queryClient.setQueryData<DataMigrationNotice | undefined>(
        queryKeys.notices.dataMigration(),
        (old) => (old ? { ...old, acknowledged: true } : old),
      );
    },
  });
}
