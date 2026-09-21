import { describe, expect, it } from "vitest";

import {
  MEMO_FIRST_LINE_MAX_LENGTH,
  RECIPE_EMPTY_LABEL,
  RECIPE_STEP_CONNECTOR,
  firstMemoLine,
  splitRecipeSteps,
  splitStepParts,
} from "./recipeDisplay";

describe("splitRecipeSteps(M24-03 §4.1)", () => {
  it("区切りは internal/service/notation/resolver.go の connector と同じ ' > ' である", () => {
    expect(RECIPE_STEP_CONNECTOR).toBe(" > ");
  });

  it("単一ステップは 1 件になる", () => {
    expect(splitRecipeSteps("立ち中P")).toEqual(["立ち中P"]);
  });

  it("複数ステップをステップごとに分ける", () => {
    expect(splitRecipeSteps("ジャンプ強K > 立ち中P > 中昇龍拳")).toEqual([
      "ジャンプ強K",
      "立ち中P",
      "中昇龍拳",
    ]);
  });

  it("修飾情報を含むステップは 1 件のまま保つ(ステップ内の空白では割らない)", () => {
    // resolver.go:155 はステップ内の修飾を空白区切りで足す。区切りは ' > ' だけである。
    expect(splitRecipeSteps("しゃがみ中K (ヒット確認) > 弱波動拳")).toEqual([
      "しゃがみ中K (ヒット確認)",
      "弱波動拳",
    ]);
  });

  it("空文字・空白のみ・null・undefined は空配列", () => {
    expect(splitRecipeSteps("")).toEqual([]);
    expect(splitRecipeSteps("   ")).toEqual([]);
    expect(splitRecipeSteps(null)).toEqual([]);
    expect(splitRecipeSteps(undefined)).toEqual([]);
  });

  it("前後の余分な空白と空ステップは落とす", () => {
    expect(splitRecipeSteps("  立ち弱P >  > 立ち中P  ")).toEqual([
      "立ち弱P",
      "立ち中P",
    ]);
  });

  it("空表示の文言は単一の正典を持つ", () => {
    expect(RECIPE_EMPTY_LABEL).toBe("（レシピなし）");
  });
});

describe("firstMemoLine(M24-03 §4.4 / SM-089)", () => {
  it("空・null・undefined は空文字を返す(呼び手は要素自体を出さない)", () => {
    expect(firstMemoLine("")).toBe("");
    expect(firstMemoLine(null)).toBe("");
    expect(firstMemoLine(undefined)).toBe("");
  });

  it("空白だけのメモも空文字を返す(空の行を作らない)", () => {
    expect(firstMemoLine("   ")).toBe("");
    expect(firstMemoLine("  \n 2 行目 ")).toBe("");
  });

  it("改行が無いメモはそのまま返す", () => {
    expect(firstMemoLine("安定重視")).toBe("安定重視");
  });

  it("改行があるときは 1 行目だけを返す(LF)", () => {
    expect(firstMemoLine("1 行目\n2 行目\n3 行目")).toBe("1 行目");
  });

  it("CRLF でも 1 行目だけを返す", () => {
    expect(firstMemoLine("1 行目\r\n2 行目")).toBe("1 行目");
  });

  it("長文は既定の閾値で切って … を付ける", () => {
    const long = "あ".repeat(MEMO_FIRST_LINE_MAX_LENGTH + 10);
    const got = firstMemoLine(long);
    expect(got).toBe("あ".repeat(MEMO_FIRST_LINE_MAX_LENGTH) + "…");
    expect(got.length).toBe(MEMO_FIRST_LINE_MAX_LENGTH + 1);
  });

  it("閾値ちょうどは切らない(境界)", () => {
    const exact = "あ".repeat(MEMO_FIRST_LINE_MAX_LENGTH);
    expect(firstMemoLine(exact)).toBe(exact);
  });

  it("閾値は呼び手から変えられる", () => {
    expect(firstMemoLine("abcdefghij", 4)).toBe("abcd…");
  });

  it("★1 行目が長いときも 1 行目だけを見る(2 行目を混ぜない)", () => {
    const memo = "あ".repeat(MEMO_FIRST_LINE_MAX_LENGTH + 5) + "\n2 行目";
    expect(firstMemoLine(memo)).not.toContain("2 行目");
  });
});

// ============================================================================
// M37-06 問い (ii)・案 C: ステップ文字列を「修飾」と「それ以外」へ分ける。
//
// ★★開発者の要望＝「新規登録、編集の段階で modifier をつけた時の見た目と一致させたい」。
//   ⇒ 一覧・詳細が描いている `recipe_cache` はステップ構造を持たない平文だが、
//     その中に `{表示語}` が既に入っている。⇒ 描画時にそこだけバッジへ替える。
// ★★★描画は **`[修飾] 技` の順**である(2026-09-14 開発者指示＝「modifier の情報を見てから
//   技を見るという順番の方が自然です」)。⇒ 本関数が修飾を切り出して先に返す形にしてある。
// ============================================================================
describe("splitStepParts(M37-06・修飾バッジ)", () => {
  it("修飾が無いステップは flags が空で rest がそのまま", () => {
    expect(splitStepParts("立ち中P")).toEqual({ flags: [], rest: "立ち中P" });
  });

  it("★修飾 1 件を切り出す(波括弧は落とし、rest の末尾に空白を残さない)", () => {
    expect(splitStepParts("立ち中P {目押し}")).toEqual({
      flags: ["目押し"],
      rest: "立ち中P",
    });
  });

  // ★★指示書 §5-5: link と no_cancel は排他ではない。両方付いた行が両方描かれること。
  it("★★修飾 2 件(link + no_cancel)を並び順のまま切り出す", () => {
    expect(splitStepParts("中P {目押し} {ノーキャン}")).toEqual({
      flags: ["目押し", "ノーキャン"],
      rest: "中P",
    });
  });

  // ★★★指示書 §4.1: 選択肢から外した 3 値も既存行が持っている。⇒ バッジになること。
  //   ならないと「外した値だけ見た目が違う」が残り、揃えた意味が薄れる。
  it("★★★選択肢から外した flag(垂直ジャンプ中 等)もバッジになる", () => {
    expect(splitStepParts("ジャンプ強K {垂直ジャンプ中}")).toEqual({
      flags: ["垂直ジャンプ中"],
      rest: "ジャンプ強K",
    });
  });

  it("★表示語に丸括弧を含む OD 組も 1 件として切り出せる", () => {
    expect(splitStepParts("OD波動拳 {OD(弱中)}")).toEqual({
      flags: ["OD(弱中)"],
      rest: "OD波動拳",
    });
  });

  // ★★★これが本関数の要である。未知の `{...}` を**バッジにしない**。
  //   Go 側に表示語が無いと `{od_lm}` のような内部識別子が出る(M37-02 / B04 が
  //   消したかった状態)。それをバッジで飾ると**壊れているのに整って見える**。
  it("★★★未知の波括弧は rest に残す(壊れていることを隠さない)", () => {
    expect(splitStepParts("立ち弱P {unknown_flag}")).toEqual({
      flags: [],
      rest: "立ち弱P {unknown_flag}",
    });
  });

  it("★ステップメモの丸括弧は修飾ではないので rest に残る", () => {
    expect(splitStepParts("中P {目押し} (2F 目押し)")).toEqual({
      flags: ["目押し"],
      rest: "中P (2F 目押し)",
    });
  });

  // ★修飾を抜いた跡の空白を畳んでいること。⇒ `中P  (メモ)` のように二重にならない。
  it("★修飾が語の間に在っても、抜いた跡の空白は 1 つに畳まれる", () => {
    expect(splitStepParts("中P {目押し} {ノーキャン} (メモ)")).toEqual({
      flags: ["目押し", "ノーキャン"],
      rest: "中P (メモ)",
    });
  });

  // ★グローバル正規表現の lastIndex 持ち回りを踏んでいないことの確認。
  //   ⇒ 2 回連続で呼んで同じ結果になること(1 回目の走査位置が残ると 2 回目が壊れる)。
  it("★連続で呼んでも結果が変わらない(正規表現の状態を持ち越さない)", () => {
    const step = "中P {目押し}";
    expect(splitStepParts(step)).toEqual(splitStepParts(step));
  });
});
