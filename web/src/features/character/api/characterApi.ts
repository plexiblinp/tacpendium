import { fetchJSON } from "@/lib/api-client";

export interface Character {
  id: number;
  gameId: number;
  code: string;
  nameJa: string;
  nameEn: string;
  customStates?: string;
}

interface CharacterListResponse {
  items: Character[];
}

export const characterApi = {
  list(gameId: number): Promise<Character[]> {
    return fetchJSON<CharacterListResponse>(
      `/api/games/${gameId}/characters`,
    ).then((res) => res.items);
  },
};
