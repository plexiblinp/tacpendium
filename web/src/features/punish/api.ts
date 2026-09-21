import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type {
  CurationRequest,
  MaterializeResponse,
  PruningRequest,
  PunishList,
  PunishTree,
  StarterVerdictRequest,
} from "./types";

// usePunishTree は走査結果ツリーを取得する(GET /api/punish-finder)。
// BE が算出済みの 3 階層ツリー + 手動確認レーンを返す(FE は描くだけ)。
// self/opp/guard が揃うまで無効化。未 seed・不存在 ID は 200+空ツリー(壊れない)。
export function usePunishTree(
  selfCharacterId: number | null,
  opponentCharacterId: number | null,
  guardType: string,
) {
  return useQuery<PunishTree>({
    queryKey: queryKeys.punishFinder.byMatchup(selfCharacterId, opponentCharacterId, guardType),
    enabled:
      typeof selfCharacterId === "number" &&
      selfCharacterId > 0 &&
      typeof opponentCharacterId === "number" &&
      opponentCharacterId > 0 &&
      guardType.length > 0,
    queryFn: () =>
      fetchJSON<PunishTree>(
        `/api/punish-finder?self_character_id=${selfCharacterId}` +
          `&opponent_character_id=${opponentCharacterId}` +
          `&guard_type=${encodeURIComponent(guardType)}`,
      ),
  });
}

// usePunishList は確定反撃マイリストと隠したもの一覧を取得する(GET /api/punish-list)。
// 走査ではなく取得。self が揃うまで無効化。opp は任意(null なら全相手キャラ)。
export function usePunishList(
  selfCharacterId: number | null,
  opponentCharacterId: number | null,
  guardType: string,
) {
  return useQuery<PunishList>({
    queryKey: queryKeys.punishList.byMatchup(selfCharacterId, opponentCharacterId, guardType),
    enabled:
      typeof selfCharacterId === "number" &&
      selfCharacterId > 0 &&
      guardType.length > 0,
    queryFn: () => {
      const params = new URLSearchParams({
        self: String(selfCharacterId),
        guard: guardType,
      });
      if (typeof opponentCharacterId === "number" && opponentCharacterId > 0) {
        params.set("opp", String(opponentCharacterId));
      }
      return fetchJSON<PunishList>(`/api/punish-list?${params.toString()}`);
    },
  });
}

// useInvalidatePunish は punish 系の書き込み後に「探す」「使う」両画面を再取得させる。
//
// M18-02 は [punish-finder] だけを無効化していたが、M18-03a で使う画面が増え、8 つの
// mutation はいずれも両画面に影響し得る(探す画面での採用 → マイリストに行が増える /
// 隠したもの管理での pruning 解除 → 探す画面に技が戻る)。片側だけ無効化する組み合わせを
// 作ると必ずどちらかが stale になるため、1 本のヘルパーで両キーを無効化する
// (非公開関数のため外部影響なし。新しい流儀を増やさず既存ヘルパーを拡張する形を採る)。
function useInvalidatePunish() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.punishFinder.all() });
    void qc.invalidateQueries({ queryKey: queryKeys.punishList.all() });
  };
}

// useSetStarterVerdict は始動技の検証結果(採用/届かない)を登録/更新する。
export function useSetStarterVerdict() {
  const invalidate = useInvalidatePunish();
  return useMutation<void, Error, StarterVerdictRequest>({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-starters`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useDeleteStarterVerdict は始動技の検証結果を解除する。
export function useDeleteStarterVerdict() {
  const invalidate = useInvalidatePunish();
  return useMutation<
    void,
    Error,
    { selfCharacterId: number; opponentMoveId: number; starterMoveId: number }
  >({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-starters`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useAddPruning は相手技の pruning(物理的に届かない)を登録する。
export function useAddPruning() {
  const invalidate = useInvalidatePunish();
  return useMutation<void, Error, PruningRequest>({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-prunings`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useMaterialize は基底コンボから確定反撃(パニッシュカウンター版)を生成する
// (POST /api/combos/:id/materialize、M18-03b)。生成物は別コンボとして登録され、
// combo_punishes が同時に作られる。FR301 で既存が見つかった場合は生成されず既存 id が返る
// (alreadyExisted=true、エラーではない)。
//
// 成功後は探す/使う両画面(useInvalidatePunish)に加え、コンボ一覧・詳細
// (["combos"] / ["combo", 生成 id])も無効化する。materialize は新しいコンボを作るため。
export function useMaterialize() {
  const qc = useQueryClient();
  const invalidatePunish = useInvalidatePunish();
  return useMutation<
    MaterializeResponse,
    Error,
    { baseComboId: number; opponentMoveId: number; note?: string | null }
  >({
    mutationFn: ({ baseComboId, opponentMoveId, note }) =>
      fetchJSON<MaterializeResponse>(`/api/combos/${baseComboId}/materialize`, {
        method: "POST",
        body: JSON.stringify({ opponentMoveId, note: note ?? undefined }),
      }),
    onSuccess: (data) => {
      invalidatePunish();
      void qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.combo.detail(data.comboId) });
    },
  });
}

// useAddPunish は孫コンボを採用(keep)する(POST /api/combo-punishes)。
export function useAddPunish() {
  const invalidate = useInvalidatePunish();
  return useMutation<
    void,
    Error,
    { comboId: number; opponentMoveId: number; note?: string | null }
  >({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punishes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useRemovePunish はコンボ採用を解除する。
export function useRemovePunish() {
  const invalidate = useInvalidatePunish();
  return useMutation<
    void,
    Error,
    { comboId: number; opponentMoveId: number }
  >({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punishes`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useRemovePruning は相手技の pruning を解除する(隠したもの管理・DELETE は BE 実装済み)。
export function useRemovePruning() {
  const invalidate = useInvalidatePunish();
  return useMutation<
    void,
    Error,
    { selfCharacterId: number; opponentMoveId: number }
  >({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-prunings`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useAddCuration は「この反撃は使わない」を登録する。
//
// 登録導線は区分を判定できない反撃の行だけに置く。PC 系のマイリスト本体には置かない。
export function useAddCuration() {
  const invalidate = useInvalidatePunish();
  return useMutation<void, Error, CurationRequest>({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-curations`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}

// useRemoveCuration は「使わない反撃」を解除する(マイリストへ戻す)。
export function useRemoveCuration() {
  const invalidate = useInvalidatePunish();
  return useMutation<void, Error, { comboId: number; opponentMoveId: number }>({
    mutationFn: (body) =>
      fetchJSON<void>(`/api/combo-punish-curations`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
}
