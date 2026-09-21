import { describe, expect, it } from "vitest";

import { buildIntakePrompt } from "./prompt";
import type { Move } from "@/features/moves/types";

function move(partial: Partial<Move>): Move {
  return {
    id: 1,
    characterId: 1,
    code: "standing_light_punch",
    category: "normal",
    isAerial: false,
    setupOnly: false,
    isDerived: false,
    ...partial,
  };
}

describe("buildIntakePrompt", () => {
  const moves = [
    move({ code: "crouching_medium_punch", category: "normal", nameJa: "しゃがみ中P" }),
    move({ code: "hadoken_light", category: "special", nameJa: "波動拳(弱)" }),
  ];

  it("キャラ名と技一覧(技名・カテゴリ)を埋め込み、内部コードは技一覧に載せない", () => {
    const prompt = buildIntakePrompt("リュウ", moves);
    expect(prompt).toContain("リュウ");
    expect(prompt).toContain("しゃがみ中P（通常技）");
    expect(prompt).toContain("波動拳(弱)（必殺技）");
    // 技一覧は技名/カテゴリのみ。move_code(内部コード)を渡さない(M17-04 §4.6)。
    expect(prompt).not.toContain("crouching_medium_punch");
    expect(prompt).not.toContain("hadoken_light");
  });

  it("死守事項の文言(パイプ表出力・コードを書かない・? 許容・24 種語彙)を含む", () => {
    const prompt = buildIntakePrompt("リュウ", moves);
    expect(prompt).toContain("Markdown 表（パイプ | 区切り）");
    expect(prompt).toContain("技コード（move_code）を生成・確定してはいけません");
    expect(prompt).toMatch(/推測で埋めず/);
  });

  it("nameJa 未登録なら code をフォールバック表示する", () => {
    const prompt = buildIntakePrompt("リュウ", [move({ code: "some_move", nameJa: null })]);
    expect(prompt).toContain("some_move（通常技）");
  });

  it("カスタム別名があれば辞書として同梱する(無ければ省略)", () => {
    const withAlias = buildIntakePrompt("リュウ", moves, ["屈中P = しゃがみ中P"]);
    expect(withAlias).toContain("あなたの別名辞書");
    expect(withAlias).toContain("屈中P = しゃがみ中P");

    const without = buildIntakePrompt("リュウ", moves);
    expect(without).not.toContain("あなたの別名辞書");
  });

  it("技一覧が空なら未登録の旨を出す", () => {
    const prompt = buildIntakePrompt("キャミィ", []);
    expect(prompt).toContain("技データはまだ登録されていません");
  });

  it("(b) 入力整形のお願い 3 件(回数展開・切れ目・分岐の行単位化)を含む", () => {
    const prompt = buildIntakePrompt("リュウ", moves);
    expect(prompt).toContain("回数表記の展開");
    expect(prompt).toContain("コンボの切れ目を明示");
    expect(prompt).toContain("分岐記法の行単位化");
    // 分岐の具体例(before/after)を含む。行単位に戻した後は始動「中足ラッシュ」が各行頭に付く。
    expect(prompt).toContain("中足ラッシュ > 強P > 強波掌撃 > 中竜巻");
    expect(prompt).toContain("中足ラッシュ > 強P > 引き強P > 強K > 強P > 強昇竜 > SA3");
  });

  it("(c) ユーザー独自ルールがあれば末尾へ結合する(空/空白のみなら結合しない)", () => {
    const withRules = buildIntakePrompt("リュウ", moves, [], "屈中P = しゃがみ中P");
    expect(withRules).toContain("あなた独自のルール");
    expect(withRules).toContain("屈中P = しゃがみ中P");

    const noRules = buildIntakePrompt("リュウ", moves);
    expect(noRules).not.toContain("あなた独自のルール");

    const blankRules = buildIntakePrompt("リュウ", moves, [], "   \n  ");
    expect(blankRules).not.toContain("あなた独自のルール");
  });

  it("(c) 自由ルールに $ 特殊置換パターンを含んでも verbatim で結合する(化けない)", () => {
    const tricky = "屈中P$&は $1 として $' 扱う";
    const prompt = buildIntakePrompt("リュウ", moves, [], tricky);
    expect(prompt).toContain(tricky);
  });

  it("(d) コンボメモがあれば本文へ埋め込み、空なら貼付案内プレースホルダを残す", () => {
    const memo = "中足ラッシュ > 強P > 引き強P > 強昇竜";
    const withMemo = buildIntakePrompt("リュウ", moves, [], "", memo);
    expect(withMemo).toContain(memo);
    // メモを入れたら「ここに貼り付けてください」の案内は出さない。
    expect(withMemo).not.toContain("あなたのコンボのメモをそのまま貼り付けてください");

    const noMemo = buildIntakePrompt("リュウ", moves);
    expect(noMemo).toContain("あなたのコンボのメモをそのまま貼り付けてください");
  });
});
