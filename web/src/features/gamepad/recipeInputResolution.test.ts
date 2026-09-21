// 物理入力 → レシピのステップ の写像（M21-03 §5 (a) / (b)）。
//
// ★本スイートの主眼は「新しい解決規則が生えていないこと」である。
//   (a) 同じ入力を仮想 UI で行った場合と move_code が一致する
//   (b) 解決できない入力がステップにならない（黙って消えず理由が返る）

import { describe, expect, it } from "vitest";

import { SYSTEM_BUTTON_TO_MOVE_CODE } from "@/features/combo/components/VirtualController/useControllerInput";
import type {
  CommandIndexEntries,
  NumpadDirection,
} from "@/features/combo/inputResolutionStage2";
import {
  resolveDirectionalInput,
  resolveDirectionalRushInput,
} from "@/features/combo/inputResolutionStage2";
import type { Move } from "@/features/moves/types";

import {
  classifyButtons,
  isBackwardDirection,
  numpadFromDirection,
  resolvePhysicalStep,
} from "./recipeInputResolution";
import type { StepCandidate } from "./stepDetection";
import type { LogicalButton } from "./types";

const CHAR_ID = 1;

function makeMove(id: number, code: string, category = "normal"): Move {
  return {
    id,
    characterId: CHAR_ID,
    code,
    category,
    isAerial: code.startsWith("jumping_"),
    setupOnly: false,
    isDerived: false,
  };
}

const MOVES: Move[] = [
  makeMove(1, "standing_light_punch"),
  makeMove(2, "standing_medium_punch"),
  makeMove(3, "standing_heavy_punch"),
  makeMove(4, "standing_light_kick"),
  makeMove(5, "standing_medium_kick"),
  makeMove(6, "standing_heavy_kick"),
  makeMove(11, "crouching_light_punch"),
  makeMove(13, "crouching_medium_kick"),
  makeMove(15, "jumping_heavy_punch"),
  makeMove(20, "rush_standing_medium_punch", "rush_variant"),
  makeMove(40, "collar_bone_breaker", "unique"),
  makeMove(7, "drive_impact", "drive_impact"),
  makeMove(8, "drive_parry", "system"),
  makeMove(9, "throw_forward", "throw"),
  makeMove(10, "throw_back", "throw"),
  makeMove(33, "hadoken_od", "special"),
];

// 段階2 の解決表（6 + 中P → 特殊技）。段階1 では引けない経路を通すために置く。
const ENTRIES: CommandIndexEntries = { "6MP": "collar_bone_breaker" };

function candidate(
  buttons: LogicalButton[],
  direction: LogicalButton = "direction_neutral",
): StepCandidate {
  return {
    direction,
    buttons,
    startedAt: 1000,
    closedAt: 1090,
    mergedCount: buttons.length,
  };
}

const CTX = { moves: MOVES, entries: ENTRIES, rushOn: false };

describe("numpadFromDirection", () => {
  it("direction_neutral は 5 になる", () => {
    expect(numpadFromDirection("direction_neutral")).toBe(5);
  });

  it("direction_1〜9 はそのままテンキーになる", () => {
    for (const digit of [1, 2, 3, 4, 6, 7, 8, 9] as const) {
      expect(numpadFromDirection(`direction_${digit}` as LogicalButton)).toBe(
        digit,
      );
    }
  });

  it("後方成分を持つ方向だけが後方判定になる", () => {
    expect([1, 4, 7].every((d) => isBackwardDirection(d as NumpadDirection))).toBe(
      true,
    );
    expect(
      [2, 3, 5, 6, 8, 9].some((d) => isBackwardDirection(d as NumpadDirection)),
    ).toBe(false);
  });
});

describe("classifyButtons(§4.2-2 / §4.2-2′ / §4.2-3)", () => {
  it("攻撃 1 ボタンは通常の強度になる", () => {
    expect(classifyButtons(["heavy_punch"])).toEqual({
      kind: "attack",
      strength: "heavy",
      button: "punch",
    });
    expect(classifyButtons(["light_kick"])).toEqual({
      kind: "attack",
      strength: "light",
      button: "kick",
    });
  });

  it("同じ強度の P＋K は共通技の操作になる", () => {
    expect(classifyButtons(["heavy_punch", "heavy_kick"])).toEqual({
      kind: "system",
      button: "drive_impact",
    });
    expect(classifyButtons(["medium_punch", "medium_kick"])).toEqual({
      kind: "system",
      button: "drive_parry",
    });
    expect(classifyButtons(["light_punch", "light_kick"])).toEqual({
      kind: "system",
      button: "throw",
    });
  });

  it("専用の物理ボタン（マクロ）はそのまま共通技になる", () => {
    expect(classifyButtons(["drive_impact"])).toEqual({
      kind: "system",
      button: "drive_impact",
    });
  });

  // ★D-352: OD は物理から出さない。family を選ぶ写像は新設規則であり契約 F-3 に抵触する。
  it("同じ種類のボタン 2 つ（PP / KK）は OD へ写さず解決不能にする", () => {
    expect(classifyButtons(["light_punch", "medium_punch"])).toEqual({
      kind: "unresolvable",
      reason: "od_not_supported",
    });
    expect(classifyButtons(["medium_kick", "heavy_kick"])).toEqual({
      kind: "unresolvable",
      reason: "od_not_supported",
    });
  });

  it("強度をまたぐ組み合わせは解決不能にする", () => {
    expect(classifyButtons(["light_punch", "heavy_kick"])).toEqual({
      kind: "unresolvable",
      reason: "mixed_strength",
    });
  });

  it("3 ボタン以上は解決不能にする", () => {
    expect(
      classifyButtons(["light_punch", "medium_punch", "heavy_punch"]),
    ).toEqual({ kind: "unresolvable", reason: "too_many_buttons" });
  });

  it("対応する操作が無い論理ボタンは解決不能にする", () => {
    expect(classifyButtons(["step_commit"])).toEqual({
      kind: "unresolvable",
      reason: "unknown_combination",
    });
  });
});

// ★§5 (a)。物理側に独自の解決経路が生えていないことの主張である。
describe("(a) 出口: 同じ入力を仮想 UI で行った場合と move_code が一致する", () => {
  const CASES: Array<{
    label: string;
    direction: LogicalButton;
    dir: NumpadDirection;
    button: LogicalButton;
    strength: "light" | "medium" | "heavy";
    kind: "punch" | "kick";
  }> = [
    {
      label: "段階1（立ち）",
      direction: "direction_neutral",
      dir: 5,
      button: "light_punch",
      strength: "light",
      kind: "punch",
    },
    {
      label: "段階1（しゃがみ）",
      direction: "direction_2",
      dir: 2,
      button: "medium_kick",
      strength: "medium",
      kind: "kick",
    },
    {
      label: "段階1（ジャンプ・9 → 上系ゾーンへ縮約）",
      direction: "direction_9",
      dir: 9,
      button: "heavy_punch",
      strength: "heavy",
      kind: "punch",
    },
    {
      label: "段階2（解決表ヒット）",
      direction: "direction_6",
      dir: 6,
      button: "medium_punch",
      strength: "medium",
      kind: "punch",
    },
    {
      label: "段階1（下後ろ 1 → 下系ゾーンへ縮約）",
      direction: "direction_1",
      dir: 1,
      button: "light_punch",
      strength: "light",
      kind: "punch",
    },
  ];

  for (const c of CASES) {
    it(`${c.label}: 仮想 UI と同じ move_code になる`, () => {
      const virtual = resolveDirectionalInput(
        MOVES,
        ENTRIES,
        c.dir,
        c.strength,
        c.kind,
      );
      expect(virtual).not.toBeNull();
      // 仮想 UI は resolved.moveId を addResolvedMove へ渡し、moveCode は move.code から取る。
      const expectedMove = MOVES.find((m) => m.id === virtual?.moveId);

      const physical = resolvePhysicalStep(
        candidate([c.button], c.direction),
        CTX,
      );
      expect(physical.status).toBe("resolved");
      if (physical.status !== "resolved") return;
      expect(physical.step.moveId).toBe(expectedMove?.id);
      expect(physical.step.moveCode).toBe(expectedMove?.code);
    });
  }

  it("ラッシュ版トグル ON でも仮想 UI と同じ move_code になる", () => {
    const virtual = resolveDirectionalRushInput(
      MOVES,
      ENTRIES,
      5,
      "medium",
      "punch",
    );
    expect(virtual).not.toBeNull();
    const expectedMove = MOVES.find((m) => m.id === virtual?.moveId);

    const physical = resolvePhysicalStep(
      candidate(["medium_punch"], "direction_neutral"),
      { ...CTX, rushOn: true },
    );
    expect(physical.status).toBe("resolved");
    if (physical.status !== "resolved") return;
    expect(physical.step.moveCode).toBe(expectedMove?.code);
    expect(physical.step.moveCode).toBe("rush_standing_medium_punch");
  });

  it("共通技も既存の写像（SYSTEM_BUTTON_TO_MOVE_CODE）の結果と一致する", () => {
    const impact = resolvePhysicalStep(
      candidate(["heavy_punch", "heavy_kick"]),
      CTX,
    );
    expect(impact.status).toBe("resolved");
    if (impact.status !== "resolved") return;
    expect(impact.step.moveCode).toBe(
      SYSTEM_BUTTON_TO_MOVE_CODE["drive_impact"],
    );

    const parry = resolvePhysicalStep(
      candidate(["medium_punch", "medium_kick"]),
      CTX,
    );
    expect(parry.status === "resolved" && parry.step.moveCode).toBe(
      SYSTEM_BUTTON_TO_MOVE_CODE["drive_parry"],
    );
  });

  // ★§9.2-7: 設計卓の既定（throw_forward 固定）を覆した。実機のボタン割当と同じ形である。
  it("投げは既定が前投げ、後方入力なら後ろ投げになる", () => {
    const forward = resolvePhysicalStep(
      candidate(["light_punch", "light_kick"], "direction_neutral"),
      CTX,
    );
    expect(forward.status === "resolved" && forward.step.moveCode).toBe(
      "throw_forward",
    );

    const back = resolvePhysicalStep(
      candidate(["light_punch", "light_kick"], "direction_4"),
      CTX,
    );
    expect(back.status === "resolved" && back.step.moveCode).toBe("throw_back");
  });

  it("解決結果に modifiers を付けない（物理入力は flags を作らない）", () => {
    const resolved = resolvePhysicalStep(candidate(["light_punch"]), CTX);
    expect(resolved.status === "resolved" && resolved.step.modifiers).toBe(
      undefined,
    );
  });
});

// ★§5 (b)。黙って消さない——理由と入力内容を返す。
describe("(b) 解決不能: ステップにならず、理由が返る", () => {
  it("PP は OD へ写らず od_not_supported を返す", () => {
    const result = resolvePhysicalStep(
      candidate(["light_punch", "medium_punch"]),
      CTX,
    );
    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") return;
    expect(result.reason).toBe("od_not_supported");
    expect(result.buttons).toEqual(["light_punch", "medium_punch"]);
    expect(result.direction).toBe(5);
  });

  it("★moves に hadoken_od があっても OD へは解決しない（D-352）", () => {
    const result = resolvePhysicalStep(
      candidate(["medium_punch", "heavy_punch"]),
      CTX,
    );
    expect(result.status).toBe("unresolved");
    // 近い技を推測で選んでいないこと。
    expect(JSON.stringify(result)).not.toContain("_od");
  });

  it("当該キャラに該当技が無ければ move_not_found を返す", () => {
    const result = resolvePhysicalStep(candidate(["heavy_kick"]), {
      moves: [makeMove(1, "standing_light_punch")],
      entries: {},
      rushOn: false,
    });
    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") return;
    expect(result.reason).toBe("move_not_found");
  });

  it("ラッシュ版が無ければステップにしない（推測で通常版へ倒さない）", () => {
    const result = resolvePhysicalStep(candidate(["heavy_kick"]), {
      ...CTX,
      rushOn: true,
    });
    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") return;
    expect(result.reason).toBe("move_not_found");
  });

  // ★理由の取り違えを防ぐ（レビュー指摘 中-4）。この理由文は CHANGE-111 経由で
  //   DES-005 へ写るため、「そのキャラに技が無い」と混ぜない。
  it("ラッシュ ON ＋ 上系方向は move_not_found ではなく専用の理由を返す", () => {
    for (const direction of [
      "direction_7",
      "direction_8",
      "direction_9",
    ] as const) {
      const result = resolvePhysicalStep(
        candidate(["medium_punch"], direction),
        { ...CTX, rushOn: true },
      );
      expect(result.status).toBe("unresolved");
      if (result.status !== "unresolved") continue;
      expect(result.reason).toBe("rush_not_available_in_air");
    }
  });

  it("ラッシュ ON でも地上方向なら従来どおり解決する（上の分岐が効きすぎていない）", () => {
    const result = resolvePhysicalStep(
      candidate(["medium_punch"], "direction_neutral"),
      { ...CTX, rushOn: true },
    );
    expect(result.status === "resolved" && result.step.moveCode).toBe(
      "rush_standing_medium_punch",
    );
  });
});
