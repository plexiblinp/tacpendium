import { describe, it, expect } from "vitest";

import { countErrorsByTab, tabOfIssueField } from "./editorTabs";
import type { ValidationIssue } from "./types";

function issue(over: Partial<ValidationIssue>): ValidationIssue {
  return {
    code: "X",
    severity: "error",
    message: "m",
    ...over,
  } as ValidationIssue;
}

// M24-04(SM-148): エラーが「今見ていないタブ」に在ることが分かるための振り分け。
describe("tabOfIssueField", () => {
  it("レシピで直すものはレシピ側", () => {
    expect(tabOfIssueField("steps")).toBe("recipe");
  });

  it("★始動技はレシピ側である(基本情報では読み取り専用で、直すにはレシピを触る)", () => {
    expect(tabOfIssueField("starterMoveId")).toBe("recipe");
  });

  it.each(["damage", "opponentStance", "driveAvailableAtStart", "memo"])(
    "%s は基本情報側",
    (field) => {
      expect(tabOfIssueField(field)).toBe("basic");
    },
  );

  // ★★ステップ配下は添字付きで来る。完全一致だけで判定すると「基本情報」へ
  //   誤って計上され、利用者を直す欄の無いタブへ誘導する。
  it.each([
    // バックエンド(internal/service/validation/combo.go の VAL-C08 / VAL-C12)
    "steps[0].moveId",
    "steps[1].moveId",
    "steps[12].moveId",
    // フロント zod(i.path.map(String).join("."))
    "steps.0.moveId",
    "steps.0.modifiers.type",
  ])("添字付きのステップ配下(%s)もレシピ側である", (field) => {
    expect(tabOfIssueField(field)).toBe("recipe");
  });

  it("★steps で始まるだけの別フィールドは巻き込まない", () => {
    expect(tabOfIssueField("stepsCount")).toBe("basic");
  });

  // ★★M27-02a(editor-tab-badge-misroutes-setups-errors): 同梱セットプレイの
  //   エラーは「基本情報」タブのバッジに計上されていたが、直す欄は「レシピ」タブの
  //   セットプレイ登録の節に在る(D-593)。★開発者の実機確認で裏取り済み。
  it.each([
    // バックエンド(internal/service/combo/service.go が同梱 setups の issue を組み直す)
    "setups[0].steps",
    "setups[1].steps",
    "setups[12].name",
    // field が空の issue(VAL-S04 等)は添字だけが付く
    "setups[0]",
    // FE zod が将来 setups を検証したときの書式
    "setups.0.steps",
  ])("同梱セットプレイ(%s)はレシピ側である", (field) => {
    expect(tabOfIssueField(field)).toBe("recipe");
  });

  it("★setups で始まるだけの別フィールドは巻き込まない", () => {
    expect(tabOfIssueField("setupsCount")).toBe("basic");
  });

  it.each([undefined, null, ""])(
    "field が無いもの(%s)はどちらとも言えない",
    (field) => {
      expect(tabOfIssueField(field)).toBeNull();
    },
  );
});

describe("countErrorsByTab", () => {
  it("タブごとに数える", () => {
    const counts = countErrorsByTab([
      issue({ field: "steps" }),
      issue({ field: "damage" }),
      issue({ field: "memo" }),
    ]);
    expect(counts).toEqual({ basic: 2, recipe: 1 });
  });

  it("★警告は数えない(保存を止めないため、原因の指し示しには混ぜない)", () => {
    const counts = countErrorsByTab([
      issue({ field: "steps", severity: "warning" }),
      issue({ field: "damage", severity: "info" }),
    ]);
    expect(counts).toEqual({ basic: 0, recipe: 0 });
  });

  it("どちらとも言えないものは数に入らない(リスト本体には出る)", () => {
    expect(countErrorsByTab([issue({ field: undefined })])).toEqual({
      basic: 0,
      recipe: 0,
    });
  });

  it("★添字付きの ERROR はレシピ側に数える(誤って基本情報へ載せない)", () => {
    const counts = countErrorsByTab([
      issue({ code: "VAL-C12", field: "steps[1].moveId" }),
      issue({ code: "CLIENT", field: "steps.0.moveId" }),
      issue({ field: "damage" }),
    ]);
    expect(counts).toEqual({ basic: 1, recipe: 2 });
  });

  it("★同梱セットプレイの ERROR はレシピ側に数える(直す欄が在るタブを指す)", () => {
    const counts = countErrorsByTab([
      issue({ code: "VAL-S02", field: "setups[0].steps" }),
      issue({ code: "VAL-S04", field: "setups[1]" }),
      issue({ field: "damage" }),
    ]);
    expect(counts).toEqual({ basic: 1, recipe: 2 });
  });

  it("issues が無くても落ちない", () => {
    expect(countErrorsByTab(undefined)).toEqual({ basic: 0, recipe: 0 });
  });
});
