import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import ja from "@/locales/ja.json";

import { toComboCandidates, toSetupCandidates } from "./preSaveDuplicateCheck";

// M23-09: 応答をダイアログの選択肢へ写す部分の単体テスト。
//
// ★i18n は「キーをそのまま返す」モックにしない。本ファイルが見たいのは
//   「代替名の翻訳キーが実在し、期待どおりの文面になること」であり、
//   キーを返すモックでは両方とも判定できない(M23-04 教訓 2)。
const t = ((key: string, vars?: Record<string, unknown>) => {
  const raw = key
    .split(".")
    .reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      ja,
    );
  if (typeof raw !== "string") return key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    String(vars?.[name] ?? ""),
  );
}) as unknown as TFunction;

describe("toComboCandidates", () => {
  it("memo をそのままラベルにする", () => {
    expect(toComboCandidates([{ id: 91, memo: "画面端 中央運び" }], t)).toEqual(
      [{ id: 91, label: "画面端 中央運び" }],
    );
  });

  it("★★memo が空の行も落とさない。落とすとその行は復元できなくなる", () => {
    // ★warningRefEntries(件数表示用)は空を落とすが、こちらは選択肢である。目的が違う。
    expect(
      toComboCandidates(
        [{ id: 91, memo: "" }, { id: 92, memo: null }, { id: 93 }],
        t,
      ),
    ).toEqual([
      { id: 91, label: "コンボ 91" },
      { id: 92, label: "コンボ 92" },
      { id: 93, label: "コンボ 93" },
    ]);
  });

  it("★空白だけの memo も代替名へ倒す", () => {
    expect(toComboCandidates([{ id: 91, memo: "   " }], t)).toEqual([
      { id: 91, label: "コンボ 91" },
    ]);
  });
});

describe("toSetupCandidates", () => {
  it("name をそのままラベルにする", () => {
    expect(toSetupCandidates([{ id: 22, name: "投げ後の重ね" }], t)).toEqual([
      { id: 22, label: "投げ後の重ね" },
    ]);
  });

  it("★★name が空の行も落とさない", () => {
    expect(toSetupCandidates([{ id: 22, name: null }], t)).toEqual([
      { id: 22, label: "セットプレイ 22" },
    ]);
  });

  it("★代替名の翻訳キーが実在する(キー返しになっていないこと)", () => {
    const [c] = toSetupCandidates([{ id: 22 }], t);
    expect(c.label).not.toContain("trash.warning");
  });
});
