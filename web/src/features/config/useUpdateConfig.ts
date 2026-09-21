import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configApi } from "@/lib/configApi";
import { clearSessionCharacterId } from "@/features/combo/hooks/useComboListFilters";
import { queryKeys } from "@/lib/query-keys";

import type { UpdateConfigRequest } from "./types";

export function useUpdateConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (req: UpdateConfigRequest) => configApi.update(req),
    onSuccess: (data, variables) => {
      qc.setQueryData(queryKeys.config(), data);

      // M24-01 追補②: 既定キャラ(解決順の段 3b)を書き換えたら、段 2 の記憶
      // (同一セッションで最後に選んだキャラ)を捨てる。
      //
      // ★捨てないと「設定やウィザードで既定キャラを変えたのに一覧が変わらない」。
      //   段 2 は段 3b より優先されるためで、開発者の実機確認で見つかった。
      // ★書き手が将来増えても効くよう、画面側ではなく本フックに置いてある
      //   ——既定キャラを書く経路は必ずここを通る。
      // ★characterId を含まない更新では捨てない。PresetListPage は
      //   { defaults: { presetId } } だけを送っており、その経路を壊さない。
      if (variables.defaults?.characterId !== undefined) {
        clearSessionCharacterId();
      }
    },
  });
}
