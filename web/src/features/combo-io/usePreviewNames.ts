import { useMemo } from "react";

import { useQueries } from "@tanstack/react-query";

import { useCharacters } from "@/features/character/hooks/useCharacters";
import type { Move, MoveListResponse } from "@/features/moves/types";
import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { ComboImportPreviewResponse } from "./types";

// B-3(M17-05a): プレビューの内部コード(characterCode / starterMoveCode)を表示名へ解決する。
// 既存の表示解決機構(キャラ nameJa・move の official_ja_move エイリアス=nameJa)を流用する。
// preview DTO は id を持たない(コード文字列のみ)ため、useCharacters で code→id を引き、
// preview 内の distinct キャラ分だけ moves を取得して (characterCode, moveCode)→nameJa を作る。
// 未投入キャラ・未知 code は引数コードをそのまま返す(隠さない=それ自体がエラーの手がかり)。

const STALE_TIME_MS = 5 * 60 * 1000;

export interface PreviewNameResolver {
  resolveCharacter: (characterCode: string) => string;
  resolveMove: (characterCode: string, moveCode: string) => string;
}

export function usePreviewNames(
  preview: ComboImportPreviewResponse | null,
): PreviewNameResolver {
  const { data: characters } = useCharacters();

  const codeToChar = useMemo(() => {
    const m = new Map<string, { id: number; nameJa: string }>();
    for (const c of characters ?? []) {
      m.set(c.code, { id: c.id, nameJa: c.nameJa });
    }
    return m;
  }, [characters]);

  // preview 内の distinct なキャラコード → id(既知キャラのみ)。
  const distinct = useMemo(() => {
    const set = new Set<string>();
    for (const r of preview?.combos ?? []) {
      if (r.characterCode) set.add(r.characterCode);
    }
    return [...set]
      .map((code) => ({ code, id: codeToChar.get(code)?.id }))
      .filter((x): x is { code: string; id: number } => typeof x.id === "number");
  }, [preview, codeToChar]);

  // distinct キャラごとに moves を取得(queryKey は useMovesByCharacter と同一=キャッシュ共有)。
  const moveQueries = useQueries({
    queries: distinct.map(({ id }) => ({
      queryKey: queryKeys.moves.byCharacter(id),
      staleTime: STALE_TIME_MS,
      queryFn: async (): Promise<Move[]> => {
        const resp = await fetchJSON<MoveListResponse>(
          `/api/moves?character_id=${id}`,
        );
        return resp.items;
      },
    })),
  });

  // (characterCode::moveCode) → nameJa。
  const moveNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    distinct.forEach(({ code }, i) => {
      const items = moveQueries[i]?.data ?? [];
      for (const mv of items) {
        if (mv.nameJa) m.set(`${code}::${mv.code}`, mv.nameJa);
      }
    });
    return m;
    // moveQueries は毎レンダー新規配列だが、preview テーブルの再計算は軽量で許容する。
  }, [distinct, moveQueries]);

  return useMemo<PreviewNameResolver>(
    () => ({
      resolveCharacter: (characterCode) =>
        codeToChar.get(characterCode)?.nameJa || characterCode,
      resolveMove: (characterCode, moveCode) =>
        moveNameByKey.get(`${characterCode}::${moveCode}`) || moveCode,
    }),
    [codeToChar, moveNameByKey],
  );
}
