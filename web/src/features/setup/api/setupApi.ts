import { fetchJSON } from "@/lib/api-client";
import { ApiError } from "@/features/combo/api";
import type { ComboErrorResponse } from "@/features/combo/types";

import type {
  CreateSetupInput,
  CreateSetupResponse,
  ListSetupCandidatesResponse,
  RestoreSetupResponse,
  SetupListResponse,
  SetupResponse,
  SetupResultCell,
  SetupSummary,
  UpdateSetupInput,
  UpsertSetupResultInput,
} from "../types";

// requestSetupJSON は、エラー時に構造化された ApiError(HTTP ステータス +
// details.validations を保持)を投げる。バグ #6(VAL-S02)で登録・編集の
// バリデーションエラー(400)と楽観衝突(409)を画面で分岐するために使う。
// 成功時の挙動は fetchJSON と同じ(204 は空ボディ → null)。
async function requestSetupJSON<T>(path: string, init: RequestInit): Promise<T> {
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

export const setupApi = {
  create: (comboId: number, input: CreateSetupInput): Promise<CreateSetupResponse> =>
    requestSetupJSON<CreateSetupResponse>(`/api/combos/${comboId}/setups`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createLink: (comboId: number, setupId: number): Promise<void> =>
    fetchJSON<void>(`/api/combos/${comboId}/setup-links`, {
      method: "POST",
      body: JSON.stringify({ setupId }),
    }),

  deleteLink: (comboId: number, setupId: number): Promise<void> =>
    fetchJSON<void>(`/api/combos/${comboId}/setup-links/${setupId}`, {
      method: "DELETE",
    }),

  get: (id: number): Promise<SetupResponse> =>
    fetchJSON<SetupResponse>(`/api/setups/${id}`),

  listByCharacter: (characterId: number): Promise<SetupResponse[]> =>
    fetchJSON<SetupListResponse>(`/api/setups?characterId=${characterId}`).then(
      (r) => r.items,
    ),

  update: (id: number, input: UpdateSetupInput): Promise<SetupResponse> =>
    requestSetupJSON<SetupResponse>(`/api/setups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // ★★M31-01(P4M-019): unlinkFrom を渡すと、そのコンボとの紐付けも同時に外す。
  //   省略時は着手前と同じ挙動である(紐付けは残り、復元で戻る)。
  remove: (id: number, unlinkFrom?: number): Promise<void> =>
    fetchJSON<void>(
      unlinkFrom == null
        ? `/api/setups/${id}`
        : `/api/setups/${id}?unlinkFrom=${unlinkFrom}`,
      { method: "DELETE" },
    ),

  // --- M23-02: ゴミ箱(削除済み一覧・復元・完全削除) ---

  // ★引数の綴りはバックエンドの同経路に揃えてある(camelCase)。
  //   コンボ側は snake_case(character_id / only_deleted)だが別経路である。
  listDeletedByCharacter: (characterId: number): Promise<SetupResponse[]> =>
    fetchJSON<SetupListResponse>(
      `/api/setups?characterId=${characterId}&onlyDeleted=true`,
    ).then((r) => r.items),

  // ★M23-04: 復元の応答は warnings を持ちうる(§4.1＝警告で復元を止めない)。
  //   0 件のときはキー自体が無い(バックエンドが omitempty)。
  restore: (id: number): Promise<RestoreSetupResponse> =>
    requestSetupJSON<RestoreSetupResponse>(`/api/setups/${id}/restore`, {
      method: "POST",
    }),

  // ★requestSetupJSON を通す。生きたコンボから参照されている場合の 409
  //   (setup_in_use)を画面が code で分岐できるよう、ApiError を保つ必要がある。
  permanentDelete: (id: number): Promise<void> =>
    requestSetupJSON<void>(`/api/setups/${id}/permanent`, {
      method: "DELETE",
    }),

  getCandidates: (comboId: number): Promise<SetupSummary[]> =>
    fetchJSON<ListSetupCandidatesResponse>(
      `/api/combos/${comboId}/setup-candidates`,
    ).then((r) => r.items),

  // C-08: 新規登録時の紐付け候補(comboId 無し)。characterId + knockdownAdvantage で絞り込む。
  getCandidatesByCharacter: (
    characterId: number,
    knockdownAdvantage: number,
  ): Promise<SetupSummary[]> =>
    fetchJSON<ListSetupCandidatesResponse>(
      `/api/setups/candidates?characterId=${characterId}&knockdownAdvantage=${knockdownAdvantage}`,
    ).then((r) => r.items),

  // M19-03: 成立条件 1 セルの upsert。行が無ければ作成、あれば更新。
  upsertResult: (
    comboId: number,
    setupId: number,
    input: UpsertSetupResultInput,
  ): Promise<SetupResultCell> =>
    requestSetupJSON<SetupResultCell>(
      `/api/combos/${comboId}/setups/${setupId}/results`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  // M19-03: 成立条件 1 セルの削除 =「未検証へ戻す」(行の物理削除)。
  deleteResult: (
    comboId: number,
    setupId: number,
    techType: string,
    inCorner: boolean,
  ): Promise<void> =>
    fetchJSON<void>(
      `/api/combos/${comboId}/setups/${setupId}/results?techType=${encodeURIComponent(techType)}&inCorner=${inCorner}`,
      { method: "DELETE" },
    ),
};
