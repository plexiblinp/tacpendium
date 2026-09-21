// M13-02 テスト用フィクスチャ(本番コードからは import しない)。
import type { Character } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "@/features/combo/types";

export const TEST_CHARACTERS: Character[] = [
  {
    id: 7,
    gameId: 1,
    code: "ryu",
    nameJa: "リュウ",
    nameEn: "Ryu",
    customStates: undefined,
  },
];

export function makeCombo(overrides: Partial<ComboDetail> = {}): ComboDetail {
  return {
    id: 1,
    characterId: 7,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    damage: 3000,
    driveDamage: 2.5,
    driveAvailableAtStart: 6,
    saAvailableAtStart: 3,
    knockdownAdvantage: 30,
    memo: "画面端限定の備考",
    position: "corner_self",
    opponentStance: "crouching",
    hitType: "punish_counter",
    opponentSize: "standard",
    situation: undefined,
    okiOptions: [
      { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
      { attackType: "shimmy", techType: "neutral_tech", usesDr: false },
    ],
    stepCount: 3,
    defaultRecipe: "2LK > 5HP > 236HK",
    starterMoveCode: "2LK",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tags: [{ id: 1, userId: 1, name: "起き攻め", category: undefined }],
    setups: [
      {
        id: 10,
        characterId: 7,
        name: "起き攻めA",
        description: null,
        stepCount: 1,
        version: 1,
        defaultRecipe: "5LP 重ね",
        parentComboIds: [1],
      },
    ],
    steps: [],
    ...overrides,
  };
}
