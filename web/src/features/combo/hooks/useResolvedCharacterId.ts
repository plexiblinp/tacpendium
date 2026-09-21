import { useMemo } from "react";

import { useConfig } from "@/features/config/useConfig";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import {
  resolveCharacterId,
  type CharacterSources,
} from "@/features/combo/defaultCharacter";
import { readSessionCharacterId } from "./useComboListFilters";

interface UseResolvedCharacterIdOptions {
  /**
   * 段 1(URL のクエリ)の値。画面ごとに読み方が違う(`?character=` / `?character_id=`)ため、
   * 呼び出し側が読んで渡す。未指定・無効値は null/undefined を渡す。
   */
  urlCharacterId?: number | null;
}

/**
 * 「いま対象にしているキャラ ID」を返す(M24-01 §4.1-1)。A 群の全画面がここを通る。
 *
 * 解決順そのものは純粋関数 `resolveCharacterId` が持つ。本フックは各段の材料を集めるだけである。
 * ★段 3a(`users.main_character_id`)は本サブでは実装しない(§4.1-2a / D-545)。
 *   実装するときは defaultCharacter.ts の段の列挙へ 1 行足し、ここで材料を 1 つ増やす。
 */
export function useResolvedCharacterId(
  options: UseResolvedCharacterIdOptions = {},
): number {
  const { urlCharacterId } = options;
  const configQuery = useConfig();
  const charactersQuery = useCharacters();

  const configCharacterId = configQuery.data?.defaults?.characterId ?? null;
  const characters = charactersQuery.data;

  // 段 2 は sessionStorage の同期読取。描画のたびに読むが、キー 1 本の getItem であり
  // 段 1 が値を持つ通常の一覧遷移では結果が使われない。
  const sessionCharacterId = readSessionCharacterId();

  const knownCharacterIds = useMemo(
    () => characters?.map((c) => c.id) ?? null,
    [characters],
  );

  const sources: CharacterSources = {
    urlCharacterId,
    sessionCharacterId,
    configCharacterId,
    knownCharacterIds,
  };

  return resolveCharacterId(sources);
}
