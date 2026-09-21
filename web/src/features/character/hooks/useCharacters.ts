import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { characterApi, type Character } from "../api/characterApi";

export type { Character };

export const DEFAULT_GAME_ID = 1;

export function useCharacters(gameId: number = DEFAULT_GAME_ID) {
  return useQuery({
    queryKey: queryKeys.characters.list(gameId),
    queryFn: () => characterApi.list(gameId),
  });
}

export function useCharacterName(
  characterId: number | null | undefined,
): string {
  const { data: characters } = useCharacters();
  if (!characterId || !characters) return "";
  return characters.find((c) => c.id === characterId)?.nameJa ?? "";
}
