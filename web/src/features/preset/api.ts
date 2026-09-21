import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  CreatePresetInput,
  Preset,
  PresetAliasDetail,
  PresetErrorResponse,
  UpdatePresetInput,
} from "./types";

/**
 * PresetApiError は API のエラー本体を保持する例外。
 *
 * ★lib/api-client.ts の fetchJSON はエラー本文を文字列へ畳んでしまうため、
 * 「どの表記が衝突したか」(alias_conflict の details.aliasText)を取り出せない。
 * 書き込み系は本クラスを投げる専用の request を通す。
 * 実装は features/tag/api/tagApi.ts の TagApiError と同じ形である。
 */
export class PresetApiError extends Error {
  status: number;
  body: PresetErrorResponse | null;

  constructor(status: number, body: PresetErrorResponse | null, message: string) {
    super(message);
    this.name = "PresetApiError";
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return this.body?.error.code;
  }

  /** サーバーが返した日本語メッセージ。無ければ undefined。 */
  get serverMessage(): string | undefined {
    return this.body?.error.message;
  }

  /** alias_conflict のとき、衝突した表記。 */
  get conflictAliasText(): string | undefined {
    const v = this.body?.error.details?.aliasText;
    return typeof v === "string" ? v : undefined;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: PresetErrorResponse | null = null;
    try {
      body = (await res.json()) as PresetErrorResponse;
    } catch {
      // JSON パース失敗時は body=null のまま
    }
    throw new PresetApiError(res.status, body, `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as Promise<T>;
}

export const presetApi = {
  list(): Promise<Preset[]> {
    return fetchJSON<Preset[]>("/api/presets");
  },

  /**
   * listAliases は 1 キャラ分のエイリアスを取得する。
   * character_id は必須である(1 プリセットのエイリアスは最大 1,653 行あり、
   * 全件を 1 応答で扱わない)。
   */
  listAliases(
    presetId: number,
    characterId: number,
    limit?: number,
  ): Promise<PresetAliasDetail[]> {
    const qs = new URLSearchParams({ character_id: String(characterId) });
    if (limit != null) qs.set("limit", String(limit));
    return request<PresetAliasDetail[]>(
      `/api/presets/${presetId}/aliases?${qs.toString()}`,
    );
  },

  create(input: CreatePresetInput): Promise<Preset> {
    return request<Preset>("/api/presets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: number, input: UpdatePresetInput): Promise<Preset> {
    return request<Preset>(`/api/presets/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  remove(id: number): Promise<void> {
    return request<void>(`/api/presets/${id}`, { method: "DELETE" });
  },

  /**
   * recipe_cache を当該プリセット分だけ作り直す(M24-08 第 2 部 B)。
   *
   * ★組み込みプリセットでも通る。作り直しは「編集」ではなくキャッシュ保守であり、
   *   むしろ組み込み(official_ja_move)でこそ必要になる —— 同プリセットは PUT が
   *   403 のため、エイリアス更新経由の再計算に乗せられないからである。
   */
  rebuildRecipeCache(id: number): Promise<{ presetId: number }> {
    return request<{ presetId: number }>(
      `/api/presets/${id}/recipe-cache/rebuild`,
      { method: "POST" },
    );
  },
};

export function usePresets() {
  return useQuery({
    queryKey: queryKeys.presets.all(),
    queryFn: () => presetApi.list(),
    staleTime: 5 * 60 * 1000, // プリセットは頻繁に変わらないため長めに保持
  });
}

export function usePresetAliases(
  presetId: number | undefined,
  characterId: number | undefined,
  limit?: number,
) {
  return useQuery({
    queryKey: queryKeys.presets.aliases(presetId, characterId, limit),
    queryFn: () => presetApi.listAliases(presetId!, characterId!, limit),
    enabled: presetId != null && characterId != null,
  });
}

/**
 * useRebuildRecipeCache は recipe_cache を作り直す(M24-08 第 2 部 B)。
 *
 * ★★無効化は onSuccess に置かない(レビュー 低-2)。設定画面は全プリセットを
 *   順に叩くため、mutation ごとに無効化すると枚数ぶん(最大 8 回)の再取得が走る。
 *   ⇒ 呼び出し側がまとめ終わったところで invalidateRecipeCacheConsumers() を 1 度呼ぶ。
 */
export function useRebuildRecipeCache() {
  return useMutation({
    mutationFn: (id: number) => presetApi.rebuildRecipeCache(id),
  });
}

/**
 * useInvalidateRecipeCacheConsumers は「recipe_cache 由来の表示」を持つクエリを落とす。
 *
 * ★作り直しの目的は「表示が新しい表記になること」であり、サーバのキャッシュだけ直して
 *   クライアントのキャッシュが古いままだと、利用者からは何も変わっていないように見える。
 * ★queryKeys.combo.all() は詳細・レシピ・削除済み詳細へ前方一致で届く。
 *   combos 側は一覧の defaultRecipe が recipe_cache 由来であるため同時に落とす。
 *   setups 側も同じ理由で落とす。
 */
export function useInvalidateRecipeCacheConsumers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.combo.all() });
    void qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
    void qc.invalidateQueries({ queryKey: queryKeys.setups.all() });
  };
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePresetInput) => presetApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.presets.all() });
    },
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdatePresetInput }) =>
      presetApi.update(id, input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.presets.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.presets.aliasesRoot(variables.id) });
      // ★この無効化でレシピ表示が実際に追従する(M20-05 で配線済み)。
      //
      // レシピは preset ごとにクライアントキャッシュを持つ(queryKey は
      // ["combo", comboId, "recipe", presetId] = 契約 F-2)。サーバーの
      // notation.ResolveComboRecipe は recipe_cache に当該 preset_id のエントリが
      // あればそれを返すため、サーバー側のキャッシュが作り直されていることが前提になる。
      // ⇒ PUT /api/presets の成功時に RecomputePresetCache が走る(D-360)ので、
      //   ここで無効化すれば新しい表記が引ける。
      void qc.invalidateQueries({ queryKey: queryKeys.combo.all() });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => presetApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.presets.all() });
    },
  });
}
