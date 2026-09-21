import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";
import RecipeText, { MemoFirstLine } from "./RecipeText";
import { RECIPE_EMPTY_LABEL } from "../recipeDisplay";

const RECIPE = "ジャンプ強K > 立ち中P > 中昇龍拳";

describe("RecipeText 省略表示(M24-03 §4.1)", () => {
  it("1 行で出し、全文を title(ホバー)へ入れる", () => {
    render(<RecipeText recipe={RECIPE} fullView={false} />);
    const el = screen.getByTestId("recipe-text");
    expect(el.getAttribute("data-recipe-view")).toBe("compact");
    expect(el.getAttribute("title")).toBe(RECIPE);
    expect(el.className).toContain("truncate");
  });

  it("呼び手が渡した表示制御クラスを適用する(面ごとに要求が違うため・D-628)", () => {
    render(
      <RecipeText recipe={RECIPE} fullView={false} compactClassName="max-w-xs" />,
    );
    expect(screen.getByTestId("recipe-text").className).toContain("max-w-xs");
  });

  it("★幅以外の表示制御クラスも通す(コンボ詳細は折返し制御を渡す・D-628)", () => {
    // ★★compactClassName は「幅制御クラス」ではない。DES-005 §5.4 が as-built として
    //   「コンボ詳細だけ折返し制御クラスを渡しており、幅の制約が無い」を意図として
    //   記録している。ここを幅だけで固定すると、その意図と逆行する変更が緑で通る。
    render(
      <RecipeText
        recipe={RECIPE}
        fullView={false}
        compactClassName="whitespace-pre-wrap break-words"
      />,
    );
    const el = screen.getByTestId("recipe-text");
    expect(el.className).toContain("whitespace-pre-wrap");
    expect(el.className).toContain("break-words");
  });
});

describe("RecipeText 全文表示(M24-03 §4.1)", () => {
  it("ステップごとに分かれて全部出る", () => {
    render(<RecipeText recipe={RECIPE} fullView={true} />);
    const el = screen.getByTestId("recipe-text");
    expect(el.getAttribute("data-recipe-view")).toBe("full");
    for (const step of ["ジャンプ強K", "立ち中P", "中昇龍拳"]) {
      expect(screen.getByText(step)).toBeTruthy();
    }
  });

  it("★★全文表示のときはツールチップを出さない(同じ情報が 2 か所に出る・SM-014)", () => {
    render(<RecipeText recipe={RECIPE} fullView={true} />);
    expect(screen.getByTestId("recipe-text").hasAttribute("title")).toBe(false);
  });

  it("★compactClassName は全文表示では効かせない(省略表示のための制御であるため)", () => {
    render(
      <RecipeText recipe={RECIPE} fullView={true} compactClassName="max-w-xs" />,
    );
    const el = screen.getByTestId("recipe-text");
    expect(el.className).not.toContain("max-w-xs");
    expect(el.className).not.toContain("truncate");
  });

  it("★button の中へ置ける markup である(比較の追加モーダルは候補が button)", () => {
    // ol/li は button の内容モデル(phrasing content)に入れられない。
    const { container } = render(
      <button type="button">
        <RecipeText recipe={RECIPE} fullView={true} />
      </button>,
    );
    expect(container.querySelector("button ol")).toBeNull();
    expect(container.querySelector("button li")).toBeNull();
    expect(screen.getByTestId("recipe-text")).toBeTruthy();
  });
});

describe("RecipeText 空のとき", () => {
  const EMPTY_CASES: Array<{ label: string; recipe: string | null | undefined }> = [
    { label: "空文字", recipe: "" },
    { label: "null", recipe: null },
    { label: "undefined", recipe: undefined },
  ];

  it.each(EMPTY_CASES)("$label は単一正典の文言を出す", ({ recipe }) => {
    render(<RecipeText recipe={recipe} fullView={false} />);
    expect(screen.getByText(RECIPE_EMPTY_LABEL)).toBeTruthy();
  });

  it("全文表示でも同じ文言になる(面・モードで文言が割れない)", () => {
    render(<RecipeText recipe="" fullView={true} />);
    expect(screen.getByText(RECIPE_EMPTY_LABEL)).toBeTruthy();
  });
});

describe("MemoFirstLine(M24-03 §4.4 / SM-089)", () => {
  it("メモの 1 行目を出す", () => {
    render(<MemoFirstLine memo={"安定重視。画面端限定\n2 行目は出さない"} />);
    const el = screen.getByTestId("memo-first-line");
    expect(el.textContent).toContain("安定重視。画面端限定");
    expect(el.textContent).not.toContain("2 行目は出さない");
  });

  it("★メモが空なら要素自体を出さない(空の行を作らない)", () => {
    render(<MemoFirstLine memo={undefined} />);
    expect(screen.queryByTestId("memo-first-line")).toBeNull();
  });

  it("★空白だけのメモでも要素を出さない", () => {
    render(<MemoFirstLine memo={"   "} />);
    expect(screen.queryByTestId("memo-first-line")).toBeNull();
  });

  it("★★メモ 1 行目とレシピが読み分けられる(M15-05 の技名 1 行サマリと混ざらない)", () => {
    // ledger の注記: M15-05 の技名 1 行サマリは「レシピ由来」であってメモ由来ではない。
    // 実査(§3.3-10)では両者は同じ面に出ないが、並んだ場合でも識別できることを固定する。
    render(
      <div>
        <MemoFirstLine memo="安定重視" />
        <RecipeText recipe={RECIPE} fullView={false} />
      </div>,
    );
    const memo = screen.getByTestId("memo-first-line");
    const recipe = screen.getByTestId("recipe-text");

    // 1) 別の要素である
    expect(memo).not.toBe(recipe);
    // 2) メモ側は「メモ由来」であることを支援技術へ名乗る
    expect(memo.getAttribute("aria-label")).toBe("メモの1行目");
    // 3) 互いの中身を含まない(混ざっていない)
    expect(memo.textContent).not.toContain("ジャンプ強K");
    expect(recipe.textContent).not.toContain("安定重視");
  });
});

// ============================================================================
// M37-06 問い (ii)・案 C: 修飾をバッジで描く。
//
// ★★★指示書 §5-7 は「バッジ化したなら、一覧と詳細で同じ見え方になること。
//   ⇒ 片方だけ変えていないこと」を求める。**本部品が全面の唯一の描画経路**である
//   (一覧・マイコンボ・詳細・比較・比較の追加モーダル ほか)ため、
//   省略表示と全文表示の両方でバッジが出ることを固定すれば、面ごとの分岐は存在しない。
//   ⇒ 「片方だけ」が起こりうるのは compact / full の 2 モードだけであり、両方を見る。
// ============================================================================
const RECIPE_WITH_FLAGS = "中足 > 中P {目押し} {ノーキャン} > 中昇龍拳";

describe("RecipeText 修飾バッジ(M37-06 問い (ii))", () => {
  it("★★省略表示でバッジが出る", () => {
    render(<RecipeText recipe={RECIPE_WITH_FLAGS} fullView={false} />);
    const badges = screen.getAllByTestId("recipe-modifier-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["目押し", "ノーキャン"]);
  });

  it("★★全文表示でも同じバッジが出る(片方だけ変えていないこと)", () => {
    render(<RecipeText recipe={RECIPE_WITH_FLAGS} fullView={true} />);
    const badges = screen.getAllByTestId("recipe-modifier-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["目押し", "ノーキャン"]);
  });

  // ★★★D-867: 波括弧は残す。バッジにできない面では修飾を示す唯一の代替である。
  //   ⇒ ホバー(title)は生文字列のままであることを固定する。
  it("★★★title(ホバー)は波括弧つきの生文字列のままである(D-867)", () => {
    render(<RecipeText recipe={RECIPE_WITH_FLAGS} fullView={false} />);
    expect(screen.getByTestId("recipe-text").getAttribute("title")).toBe(
      RECIPE_WITH_FLAGS,
    );
  });

  // ★逆向き —— 未知の修飾はバッジにならず、素のまま画面に出ること。
  //   これが無いと「バッジが出ている」ことが、表示語の一致を担保している証拠にならない。
  it("★未知の波括弧はバッジにならず素の文字列で出る", () => {
    render(<RecipeText recipe={"立ち弱P {od_lm}"} fullView={false} />);
    expect(screen.queryByTestId("recipe-modifier-badge")).toBeNull();
    expect(screen.getByTestId("recipe-text").textContent).toContain("{od_lm}");
  });

  // ★★★2026-09-14 開発者指示: 「modifier の情報を見てから技を見るという順番の方が自然」。
  //   ⇒ サーバ文字列は `技 {修飾}` だが、描画は `[修飾] 技` である。
  //   ★textContent の順で主張する —— DOM 上の並びそのものが要件だからである。
  it("★★★修飾は技の**左**に出る(省略表示)", () => {
    render(<RecipeText recipe={"中P {目押し}"} fullView={false} />);
    expect(screen.getByTestId("recipe-text").textContent).toBe("目押し中P");
  });

  it("★★★修飾は技の**左**に出る(全文表示)", () => {
    render(<RecipeText recipe={"中P {目押し}"} fullView={true} />);
    // ★全文表示は行頭に連番(`1.`)が付く。
    expect(screen.getByTestId("recipe-text").textContent).toBe("1.目押し中P");
  });

  // ★★★これが最も壊れやすい —— 省略表示はレシピ全体が 1 本の文字列で来る。
  //   ステップごとに分けずに処理すると、後段のステップの修飾が**先頭の技の前へ飛ぶ**。
  it("★★★複数ステップでも、修飾はそのステップの技の左に留まる", () => {
    render(
      <RecipeText recipe={"中足 > 中P {目押し} > 中昇龍拳"} fullView={false} />,
    );
    expect(screen.getByTestId("recipe-text").textContent).toBe(
      "中足 > 目押し中P > 中昇龍拳",
    );
  });

  it("修飾が無いレシピではバッジを 1 つも出さない", () => {
    render(<RecipeText recipe={RECIPE} fullView={false} />);
    expect(screen.queryByTestId("recipe-modifier-badge")).toBeNull();
    expect(screen.getByTestId("recipe-text").textContent).toBe(RECIPE);
  });
});
