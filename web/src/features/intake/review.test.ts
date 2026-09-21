import { describe, expect, it } from "vitest";

import {
  buildCsvPayload,
  countUnresolved,
  effectiveMoveCode,
  isStepResolved,
  stepKey,
  unresolvedHint,
  unresolvedKind,
} from "./review";
import type { IntakeResolveResponse, IntakeResolvedStep } from "./types";

function step(partial: Partial<IntakeResolvedStep>): IntakeResolvedStep {
  return {
    stepOrder: 1,
    rawText: "",
    tokens: "",
    nameCandidate: "",
    confidence: "",
    note: "",
    moveCode: "",
    resolved: false,
    resolvedVia: "",
    candidates: [],
    ...partial,
  };
}

function resp(combos: IntakeResolveResponse["combos"]): IntakeResolveResponse {
  const total = combos.reduce((n, c) => n + c.steps.length, 0);
  const resolved = combos.reduce(
    (n, c) => n + c.steps.filter((s) => s.moveCode !== "").length,
    0,
  );
  return {
    characterCode: "ryu",
    movesAvailable: true,
    combos,
    summary: { totalSteps: total, resolved, unresolved: total - resolved },
  };
}

describe("effectiveMoveCode / override", () => {
  it("照合結果を返し、上書きがあれば上書きを優先する", () => {
    const s = step({ stepOrder: 2, moveCode: "hadoken_light" });
    expect(effectiveMoveCode(1, s, {})).toBe("hadoken_light");
    expect(effectiveMoveCode(1, s, { [stepKey(1, 2)]: "shoryuken_medium" })).toBe(
      "shoryuken_medium",
    );
  });

  it("空文字の上書きは未解決へ戻す", () => {
    const s = step({ stepOrder: 2, moveCode: "hadoken_light" });
    const ov = { [stepKey(1, 2)]: "" };
    expect(effectiveMoveCode(1, s, ov)).toBe("");
    expect(isStepResolved(1, s, ov)).toBe(false);
  });
});

describe("countUnresolved", () => {
  it("実効 move_code が空のステップを数える", () => {
    const r = resp([
      { comboIndex: 1, steps: [step({ stepOrder: 1, moveCode: "a" }), step({ stepOrder: 2 })] },
    ]);
    expect(countUnresolved(r, {})).toBe(1);
    // 未解決ステップを手動解決すると 0 になる。
    expect(countUnresolved(r, { [stepKey(1, 2)]: "b" })).toBe(0);
  });

  it("除外したステップは未解決に数えない(解決 or 除外で進める)", () => {
    const r = resp([
      { comboIndex: 1, steps: [step({ stepOrder: 1, moveCode: "a" }), step({ stepOrder: 2 })] },
    ]);
    expect(countUnresolved(r, {}, { [stepKey(1, 2)]: true })).toBe(0);
    // 除外を外すと再び未解決。
    expect(countUnresolved(r, {}, { [stepKey(1, 2)]: false })).toBe(1);
  });

  it("null なら 0", () => {
    expect(countUnresolved(null, {})).toBe(0);
  });
});

describe("buildCsvPayload", () => {
  it("解決済みステップだけで combos を組み立て、memo に元表記を連結する", () => {
    const r = resp([
      {
        comboIndex: 1,
        steps: [
          step({ stepOrder: 1, rawText: "屈中P", moveCode: "crouching_medium_punch" }),
          step({ stepOrder: 2, rawText: "弱波動", moveCode: "hadoken_light" }),
        ],
      },
    ]);
    const payload = buildCsvPayload("ryu", r, {});
    expect(payload.characterCode).toBe("ryu");
    expect(payload.combos).toHaveLength(1);
    expect(payload.combos[0].steps.map((s) => s.moveCode)).toEqual([
      "crouching_medium_punch",
      "hadoken_light",
    ]);
    expect(payload.combos[0].memo).toBe("屈中P > 弱波動");
    expect(payload.combos[0].isDraft).toBe(false);
  });

  it("除外したステップは CSV から落とす(残りは取り込む)", () => {
    const r = resp([
      {
        comboIndex: 1,
        steps: [
          step({ stepOrder: 1, rawText: "屈中P", moveCode: "crouching_medium_punch" }),
          step({ stepOrder: 2, rawText: "適当", moveCode: "some_code" }),
        ],
      },
    ]);
    // ステップ2 を除外 → CSV には残りの 1 手だけ。
    const payload = buildCsvPayload("ryu", r, {}, { [stepKey(1, 2)]: true });
    expect(payload.combos).toHaveLength(1);
    expect(payload.combos[0].steps.map((s) => s.moveCode)).toEqual([
      "crouching_medium_punch",
    ]);
    // memo は元表記を全て残す(除外行も記録)。
    expect(payload.combos[0].memo).toBe("屈中P > 適当");
  });

  it("未解決ステップは CSV から除外し、全行未解決のコンボは取込対象から外す", () => {
    const r = resp([
      {
        comboIndex: 1,
        steps: [
          step({ stepOrder: 1, rawText: "屈中P", moveCode: "crouching_medium_punch" }),
          step({ stepOrder: 2, rawText: "謎技", moveCode: "" }),
        ],
      },
      { comboIndex: 2, steps: [step({ stepOrder: 1, rawText: "?", moveCode: "" })] },
    ]);
    const payload = buildCsvPayload("ryu", r, {});
    expect(payload.combos).toHaveLength(1); // コンボ2(全行未解決)は除外
    expect(payload.combos[0].steps).toHaveLength(1); // コンボ1の未解決ステップは除外
  });
});

// ===========================================================================
// M20-07: 「解けなかった」と「そもそも候補に挙がらなかった」を分ける(§4.3-4・E-84)
// ===========================================================================

describe("unresolvedKind", () => {
  it("候補があるときは ambiguous(人が選ぶ作業)", () => {
    expect(unresolvedKind(step({ candidates: ["a", "b"] }))).toBe("ambiguous");
  });

  it("候補が無いときは no-match(人が探す作業)", () => {
    expect(unresolvedKind(step({ candidates: [] }))).toBe("no-match");
  });

  it("★2 つは必ず別の値になる(同じ顔で出さない)", () => {
    expect(unresolvedKind(step({ candidates: ["a"] }))).not.toBe(
      unresolvedKind(step({ candidates: [] })),
    );
  });
});

describe("unresolvedHint", () => {
  it("候補ありは件数と「選ぶ」導線を示す", () => {
    const hint = unresolvedHint(step({ candidates: ["a", "b"] }));
    expect(hint).toContain("2 件");
    expect(hint).toContain("候補");
  });

  it("候補なしは「探す」導線を示す", () => {
    expect(unresolvedHint(step({ candidates: [] }))).toContain("すべての技");
  });

  it("★文面そのものが別である(同じ文言を出さない)", () => {
    expect(unresolvedHint(step({ candidates: ["a"] }))).not.toBe(
      unresolvedHint(step({ candidates: [] })),
    );
  });
});
