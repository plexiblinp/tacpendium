import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  Combo,
  ComboDetail,
  ComboErrorResponse,
  ComboListResponse,
  ComboRecipeResponse,
  CreateComboRequest,
  CreateComboResponse,
  PutComboRequest,
  UpdateMetadataRequest,
  ValidationResult,
} from "./types";

export interface ComboListFilter {
  characterId?: number;
  isDraft?: boolean;
  tagIds?: number[];
  position?: string;
  hitType?: string;
  // ★M27-03(P4M-022): 始動技による絞り込み。BE の ListFilter.StarterMoveIDs へ落ちる。
  starterMoveId?: number;
  opponentStance?: string;
  // ★M37-07: 始動技の持続当てによる絞り込み(開発者裁定 2026-09-14)。BE の
  //   ListFilter.StarterMeaty へ落ちる。★列は NOT NULL のため 2 通りだけ。
  starterMeaty?: boolean;
  // 成立条件による絞り込み(M19-06)。setupResult が無いときは軸 2 つも効かない。
  setupResult?: string;
  setupTechType?: string;
  setupInCorner?: boolean;
  /**
   * ゲーム更新の影響による絞り込み(FR702・M28-02a の BE 経路)。
   *
   * ★★使うのは専用画面 /game-update/combos だけである。コンボ一覧・マイコンボの
   *   フィルタ欄には足さない(「一覧に常に 1 軸増えると邪魔」= 開発者の逐語)。
   *   ⇒ 一覧に増えるのはボタン 1 個だけである。
   */
  affectedByGameUpdate?: boolean;
  /** 取得上限。★BE 側で 1000 に丸められる(既定は 100)。 */
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

function buildQuery(filter: ComboListFilter): string {
  const params = new URLSearchParams();
  if (filter.characterId !== undefined) {
    params.set("character_id", String(filter.characterId));
  }
  if (filter.isDraft !== undefined) {
    params.set("is_draft", filter.isDraft ? "true" : "false");
  }
  if (filter.tagIds && filter.tagIds.length > 0) {
    params.set("tag_ids", filter.tagIds.join(","));
  }
  if (filter.position) {
    params.set("position", filter.position);
  }
  if (filter.hitType) {
    params.set("hit_type", filter.hitType);
  }
  if (filter.starterMoveId !== undefined) {
    params.set("starter_move_id", String(filter.starterMoveId));
  }
  if (filter.opponentStance) {
    params.set("opponent_stance", filter.opponentStance);
  }
  if (filter.starterMeaty !== undefined) {
    params.set("starter_meaty", filter.starterMeaty ? "true" : "false");
  }
  if (filter.setupResult) {
    params.set("setup_result", filter.setupResult);
  }
  if (filter.setupTechType) {
    params.set("setup_tech_type", filter.setupTechType);
  }
  if (filter.setupInCorner !== undefined) {
    params.set("setup_in_corner", filter.setupInCorner ? "true" : "false");
  }
  if (filter.affectedByGameUpdate !== undefined) {
    params.set(
      "affected_by_game_update",
      filter.affectedByGameUpdate ? "true" : "false",
    );
  }
  if (filter.limit !== undefined) {
    params.set("limit", String(filter.limit));
  }
  if (filter.sort) {
    params.set("sort", filter.sort);
  }
  if (filter.order) {
    params.set("order", filter.order);
  }
  return params.toString();
}

export function useCombos(filter: ComboListFilter) {
  return useQuery({
    queryKey: queryKeys.combos.list(filter),
    queryFn: () => {
      const qs = buildQuery(filter);
      const path = qs ? `/api/combos?${qs}` : "/api/combos";
      return fetchJSON<ComboListResponse>(path);
    },
  });
}

export function useCombo(id: number | string | null | undefined) {
  const numId = typeof id === "string" ? parseInt(id, 10) : id;
  return useQuery({
    queryKey: queryKeys.combo.detail(numId),
    queryFn: () => fetchJSON<ComboDetail>(`/api/combos/${id}`),
    enabled: id != null && id !== "" && !isNaN(Number(id)),
  });
}

export function useComboRecipe(
  comboId: number | string | undefined,
  presetId: number | undefined,
) {
  return useQuery({
    queryKey: queryKeys.combo.recipe(comboId, presetId),
    queryFn: () =>
      fetchJSON<ComboRecipeResponse>(
        `/api/combos/${comboId}/recipe?preset_id=${presetId}`,
      ),
    enabled:
      comboId !== undefined && comboId !== "" && presetId !== undefined,
  });
}

export function useDeleteCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // DELETE は 204 No Content を返すため fetchJSON ではなく raw fetch を使う。
      const res = await fetch(`/api/combos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      // ★★ゲーム更新の告知の件数は combos と同じ行から導かれる(M28-02c)。
      //   ⇒ 一緒に落とさないと、行数だけ先に減って件数が古いまま残る瞬間ができる。
      //   実害の例＝影響コンボの専用画面が「1 件中 0 件を表示しています」と嘘を言う。
      qc.invalidateQueries({ queryKey: queryKeys.notices.gameUpdate() });
    },
  });
}

// API エラー: HTTP ステータスとパース済みエラーボディを保持する。
// バリデーションエラー(400)、楽観衝突(409)、その他(5xx)を呼び出し元で分岐するために使う。
export class ApiError extends Error {
  status: number;
  body: ComboErrorResponse | null;

  constructor(status: number, body: ComboErrorResponse | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get validations(): ValidationResult | undefined {
    return this.body?.error?.details?.validations;
  }
}

async function requestJSON<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON パース失敗時は parsed=null のまま
    }
  }
  if (!res.ok) {
    const body = (parsed as ComboErrorResponse | null) ?? null;
    throw new ApiError(res.status, body, body?.error?.message ?? `HTTP ${res.status}`);
  }
  return parsed as T;
}

export function useCreateCombo() {
  const qc = useQueryClient();
  // ★戻り型は CreateComboResponse(= Combo + warnings)。M23-05 §4.6 で登録経路にも
  //   warnings が載るようになった。0 件のときはキー自体が来ない(サーバが omitempty)。
  return useMutation<CreateComboResponse, ApiError, CreateComboRequest>({
    mutationFn: (req) =>
      requestJSON<CreateComboResponse>("/api/combos", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      if (variables.setups && variables.setups.length > 0) {
        qc.invalidateQueries({ queryKey: queryKeys.setups.all() });
        qc.invalidateQueries({ queryKey: queryKeys.setupCandidates.all() });
      }
    },
  });
}

export function useUpdateComboMetadata(id: number) {
  const qc = useQueryClient();
  return useMutation<Combo, ApiError, UpdateMetadataRequest>({
    mutationFn: (req) =>
      requestJSON<Combo>(`/api/combos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      qc.invalidateQueries({ queryKey: queryKeys.combo.detail(id) });
    },
  });
}

export function useUpdateComboWithKeyChange(id: number) {
  const qc = useQueryClient();
  return useMutation<Combo, ApiError, PutComboRequest>({
    mutationFn: (req) =>
      requestJSON<Combo>(`/api/combos/${id}`, {
        method: "PUT",
        body: JSON.stringify(req),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      qc.removeQueries({ queryKey: queryKeys.combo.detail(id) });
      if (data.id && data.id !== id) {
        qc.setQueryData(queryKeys.combo.detail(data.id), data);
      }
    },
  });
}
