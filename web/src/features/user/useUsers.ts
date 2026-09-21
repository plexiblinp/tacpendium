import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { userApi } from "./userApi";
import type { CreateUserRequest, UpdateUserRequest, User } from "./types";

/**
 * useUsers は利用者の一覧を取得する。
 *
 * ★件数で「ユーザー選択を出すか」が決まる。1 人なら出さない(FR502)。
 */
export function useUsers() {
  return useQuery<User[]>({
    queryKey: queryKeys.users(),
    queryFn: () => userApi.list(),
    retry: false,
  });
}

/** useCreateUser は利用者を作る。★サーバ側で既定タグ 3 件も同時に生成される。 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateUserRequest) => userApi.create(req),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}

/**
 * useRenameUser は利用者の名前を変える（`DES-005` §5.16 の「編集」）。
 *
 * ★成功したら一覧を引き直す。`CurrentUserProvider` は選択中の利用者を
 * `users.find((u) => u.id === selectedId)` で導出しているため、引き直せば
 * ヘッダの利用者表示が新しい名前へ追随する（M22-08 §4.5-4）。
 * ★追随は「自動でそうなる」形であり、だからこそ壊れても気づけない。
 * テストで固定してある。
 *
 * ★重複名の 409・空名の 400 はサーバ側が既に返す（`internal/api/user/handler.go`）。
 * 画面はそれを見せるだけであり、検証を作り直さないこと（同 §4.5-3）。
 */
export function useRenameUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...req }: UpdateUserRequest & { id: number }) =>
      userApi.rename(id, req),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}
