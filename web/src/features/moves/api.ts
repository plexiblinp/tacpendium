import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  CommandIndexResponse,
  Move,
  MotionCommandsResponse,
  MoveDetail,
  MoveListResponse,
  UpdateMoveRequest,
} from "./types";

// 技マスタは M1 段階でほぼ静的(seed のみ更新)なので長めにキャッシュする。
const STALE_TIME_MS = 5 * 60 * 1000;

export function useMovesByCharacter(characterId: number | null | undefined) {
  return useQuery<Move[]>({
    queryKey: queryKeys.moves.byCharacter(characterId),
    enabled: typeof characterId === "number" && characterId > 0,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const resp = await fetchJSON<MoveListResponse>(
        `/api/moves?character_id=${characterId}`,
      );
      return resp.items;
    },
  });
}

// useCommandIndex は段階2 解決表を取得する(GET /api/characters/:id/command-index、M17-03)。
// キャラ選択時に 1 回取得(queryKey がキャラ単位 = 入力ごとの往復を作らない)。未 seed・不存在 ID は
// 200＋空 entries(壊れない仕様)。取得失敗時は消費側が空 entries 扱いで段階1 のみで続行する。
// invalidate: BE は畳み込み時に moves.is_aerial / category も読むため、moves を書き換える
// useUpdateMove の成功時に invalidate する(M17-03 レビュー指摘)。useGenerateRushVariant は
// 不要(生成行は is_derived=true で索引対象外)。
export function useCommandIndex(characterId: number | null | undefined) {
  return useQuery<CommandIndexResponse>({
    queryKey: queryKeys.commandIndex(characterId),
    enabled: typeof characterId === "number" && characterId > 0,
    staleTime: STALE_TIME_MS,
    queryFn: () =>
      fetchJSON<CommandIndexResponse>(
        `/api/characters/${characterId}/command-index`,
      ),
  });
}

// useMotionCommands はコマンド技入力モード用の索引を取得する
// (GET /api/characters/:id/motion-commands、M21-06 §4.6)。
//
// ★useCommandIndex と同じ流儀に揃えてある——キャラ単位の queryKey ＋ 同じ staleTime で、
// キャラ選択時に 1 回取得する。**入力ごとに往復しない**(§4.6-3)。揃えないと同じ画面に
// 2 通りの解決経路ができる。
//
// ★取得に失敗しても壊れない(§4.6-6)。消費側は空配列扱いでコマンド技入力モードに入れなく
// なるだけで、既存の入力経路(判定窓 → 一様フォールバック)は今までどおり動く。
//
// ★invalidate は useCommandIndex と同じく useUpdateMove の成功時に行う。本経路は
// moves の属性を読まないが、move_commands ⨝ moves の JOIN 越しに move_code を返すため。
export function useMotionCommands(characterId: number | null | undefined) {
  return useQuery<MotionCommandsResponse>({
    queryKey: queryKeys.motionCommands(characterId),
    enabled: typeof characterId === "number" && characterId > 0,
    staleTime: STALE_TIME_MS,
    queryFn: () =>
      fetchJSON<MotionCommandsResponse>(
        `/api/characters/${characterId}/motion-commands`,
      ),
  });
}

// useMoveDetail は編集グリッドの行展開時にフル項目を取得する(GET /api/moves/:id、M9-03)。
export function useMoveDetail(id: number | null | undefined) {
  return useQuery<MoveDetail>({
    queryKey: queryKeys.move.detail(id),
    enabled: typeof id === "number" && id > 0,
    queryFn: () => fetchJSON<MoveDetail>(`/api/moves/${id}`),
  });
}

// useUpdateMove は move を部分更新する(PATCH /api/moves/:id、M9-03)。
// 成功時に当該キャラの一覧と当該 move の詳細を invalidate する(code-facts §2 規約)。
export function useUpdateMove(characterId: number) {
  const qc = useQueryClient();
  return useMutation<MoveDetail, Error, { id: number; input: UpdateMoveRequest }>({
    mutationFn: ({ id, input }) =>
      fetchJSON<MoveDetail>(`/api/moves/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.moves.byCharacter(characterId) });
      qc.invalidateQueries({ queryKey: queryKeys.move.detail(id) });
      // 段階2 解決表は moves.is_aerial / category に依存して畳まれるため同時に無効化する(M17-03)。
      qc.invalidateQueries({ queryKey: queryKeys.commandIndex(characterId) });
      // コマンド技入力モード用の索引も move_commands ⨝ moves で move_code を返すため同時に
      // 無効化する(M21-06 §4.6)。
      qc.invalidateQueries({ queryKey: queryKeys.motionCommands(characterId) });
      // 確定反撃サーチの走査結果は moves の startup/on_block/recovery/damage/total/is_projectile に
      // 依存するため同時に無効化する(M18-02)。相手・自キャラどちらの編集でも影響し得るため前方一致で全無効化。
      qc.invalidateQueries({ queryKey: queryKeys.punishFinder.all() });
    },
  });
}

// useGenerateRushVariant はラッシュ版 move を派生生成する(POST /api/moves/:id/rush-variant、M9-03)。
// 成功時に当該キャラの一覧を invalidate して新しい rush_variant 行を反映する。
export function useGenerateRushVariant(characterId: number) {
  const qc = useQueryClient();
  return useMutation<MoveDetail, Error, { id: number }>({
    mutationFn: ({ id }) =>
      fetchJSON<MoveDetail>(`/api/moves/${id}/rush-variant`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.moves.byCharacter(characterId) });
    },
  });
}
