import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ★M30-02 レビュー 中-5: 新設文言を locale へ寄せたため、実 ja.json を引く
//   (VirtualController.test.tsx と同じ流儀)。
import "@/lib/i18n";
import type { Move } from "@/features/moves/types";

import { RecipeBuilder } from "./RecipeBuilder";
import { RECIPE_EMPTY_LABEL } from "../recipeDisplay";

// M17-03: RecipeBuilder は VirtualController(useCommandIndex)を実体描画するため
// QueryClientProvider でラップする。解決表は空 entries を注入(段階1 のみ = 本ファイルの
// 関心事はプルダウン/notes/info-mark なので十分。実 fetch は staleTime 内で発火しない)。
function render(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  qc.setQueryData(["command-index", 1], { characterId: 1, entries: {} });
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeMove(id: number, code: string, category: string, nameJa: string): Move {
  return { id, characterId: 1, code, category, isAerial: false, setupOnly: false, isDerived: false, nameJa };
}

// 全技プルダウンは既定折りたたみ(指摘16)のため、セレクタ/notes を触る前に展開する。
async function expandPulldown(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("recipe-pulldown-toggle"));
}

describe("RecipeBuilder draftNotes 警告", () => {
  function renderBuilder() {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={[]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  it("notes 入力欄が存在する(プルダウン展開後)", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    expect(screen.getByPlaceholderText("ステップメモ(任意)")).toBeTruthy();
  });

  it("notes 50文字以下では警告クラスが付与されない", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)") as HTMLInputElement;
    await user.type(input, "あ".repeat(50));
    expect(input.className).not.toMatch(/border-red/);
    expect(screen.queryByText(/50文字超です/)).toBeNull();
  });

  it("notes 51文字以上で警告色クラスが付与される", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)") as HTMLInputElement;
    await user.type(input, "あ".repeat(51));
    expect(input.className).toMatch(/border-red/);
  });

  it("notes 51文字以上で文字数メッセージが表示される", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)") as HTMLInputElement;
    await user.type(input, "あ".repeat(51));
    expect(screen.getByText(/51 文字 — 50文字超です/)).toBeTruthy();
  });
});

describe("RecipeBuilder info-mark (⑤ 編集ボタンについて・追加ボタンの下/最初の編集ボタンの上)", () => {
  function renderBuilderWithStep() {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={[{ stepOrder: 1, moveId: 1 }]}
        moves={[]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  it("ステップが1件以上あるとき「編集ボタンについて」+ info-mark が描画される", () => {
    renderBuilderWithStep();
    expect(screen.getByText("編集ボタンについて")).toBeTruthy();
    expect(screen.getByTestId("info-mark-recipe-modifier")).toBeTruthy();
    // 未クリック時は説明 Popover が開いていない
    expect(screen.queryByTestId("info-mark-recipe-modifier-content")).toBeNull();
  });

  it("ステップが0件のときは「編集ボタンについて」+ info-mark を表示しない", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={[]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("編集ボタンについて")).toBeNull();
    expect(screen.queryByTestId("info-mark-recipe-modifier")).toBeNull();
  });

  it("info-mark クリックで説明が表示される", async () => {
    const user = userEvent.setup();
    renderBuilderWithStep();
    await user.click(screen.getByTestId("info-mark-recipe-modifier"));
    // ★M30-02 レビュー 中-5 で実 ja.json を読むようにしたため、キーではなく本文が出る。
    const content = screen.getByTestId("info-mark-recipe-modifier-content");
    expect(content.textContent).toContain("補足設定");
  });
});

describe("RecipeBuilder プルダウン残置＋区分絞り込み(FB④)", () => {
  const MOVES: Move[] = [
    makeMove(1, "standing_light_punch", "normal", "立ち弱P"),
    makeMove(2, "crouching_medium_kick", "normal", "しゃがみ中K"),
    makeMove(30, "hadoken_light", "special", "波動拳・弱"),
    // 別技(moves の別行)。プルダウンで網羅入力できることの確認用。
    makeMove(40, "shoryuken_hold", "special", "溜め昇龍"),
    makeMove(50, "collar_bone_breaker", "unique", "肘打ち"),
  ];

  function renderBuilder() {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  function moveSelect(): HTMLSelectElement {
    return screen.getByTestId("recipe-move-select") as HTMLSelectElement;
  }
  function optgroupOptionCount(): number {
    return moveSelect().querySelectorAll("optgroup option").length;
  }

  it("全技プルダウンが展開でき、全カテゴリの技が出る(網羅フォールバック・別技も選べる)", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const texts = Array.from(moveSelect().querySelectorAll("option")).map((o) => o.textContent);
    expect(texts).toContain("立ち弱P");
    expect(texts).toContain("波動拳・弱");
    expect(texts).toContain("肘打ち");
    expect(texts).toContain("溜め昇龍"); // 別技も取りこぼしなし
  });

  it("プルダウンは既定折りたたみで、展開ボタンの隣に説明が出る(指摘16)", () => {
    renderBuilder();
    // 未展開ではセレクタが存在しない
    expect(screen.queryByTestId("recipe-move-select")).toBeNull();
    expect(screen.getByTestId("recipe-pulldown-toggle")).toBeTruthy();
    expect(screen.getByText(/ボタンで入れられない細かい技名はこちら/)).toBeTruthy();
  });

  it("区分(カテゴリ)で絞り込むと表示技数が減る", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    // 実技 5 件 + 非技ステップ optgroup 2 件(parry/cancel。dash は M16-04 で撤去)= 7
    const allCount = optgroupOptionCount();
    expect(allCount).toBe(7);
    await user.selectOptions(screen.getByTestId("recipe-category-filter"), "special");
    const specialCount = optgroupOptionCount();
    expect(specialCount).toBeLessThan(allCount);
    expect(specialCount).toBe(2); // hadoken_light / shoryuken_hold のみ(非技ステップは非表示)
  });

  it("dash は「システム」optgroup(moveId)で載り、非技 optgroup には現れない(M16-04 一本化)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        // dash は system move(category=system の move)として渡す。
        moves={[...MOVES, makeMove(60, "dash_forward", "system", "前ダッシュ")]}
        movesLoading={false}
        onChange={onChange}
      />,
    );
    await expandPulldown(user);
    // 非技ステップ optgroup(modifiers.type)は parry/cancel の 2 件のみ。dash は撤去済み。
    await user.selectOptions(screen.getByTestId("recipe-category-filter"), "__nonmove__");
    expect(optgroupOptionCount()).toBe(2);
    const nonmoveValues = Array.from(moveSelect().querySelectorAll("option")).map(
      (o) => o.value,
    );
    expect(nonmoveValues).not.toContain("nonmove:dash_forward");
    // dash は「システム」optgroup の system move(moveId)として選ぶ。
    await user.selectOptions(screen.getByTestId("recipe-category-filter"), "all");
    await user.selectOptions(moveSelect(), "60");
    await user.click(screen.getByTestId("recipe-add-step"));
    // 通常の system move step と同一表現: moveId のみ(modifiers.type dash にならない)。
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ moveId: 60, modifiers: undefined }),
    ]);
  });

  it("dash_back も「システム」optgroup(moveId)で載る(対称・M16-04)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={[...MOVES, makeMove(61, "dash_back", "system", "後ろダッシュ")]}
        movesLoading={false}
        onChange={onChange}
      />,
    );
    await expandPulldown(user);
    await user.selectOptions(moveSelect(), "61");
    await user.click(screen.getByTestId("recipe-add-step"));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ moveId: 61, modifiers: undefined }),
    ]);
  });

  it("区分=非技ステップ で parry_drive_rush を選ぶと従来どおり modifiers.type が載る(不変)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={onChange}
      />,
    );
    await expandPulldown(user);
    await user.selectOptions(screen.getByTestId("recipe-category-filter"), "__nonmove__");
    await user.selectOptions(moveSelect(), "nonmove:parry_drive_rush");
    await user.click(screen.getByTestId("recipe-add-step"));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ moveId: undefined, modifiers: { type: "parry_drive_rush" } }),
    ]);
  });
});

describe("RecipeBuilder draftNotes 50文字超 console.warn 警告", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  function renderBuilder() {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={[]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("50文字以下では console.warn が発火しない", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)");
    await user.type(input, "あ".repeat(50));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("51文字以上で console.warn が1回発火し「50文字を超えています」を含む", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)");
    await user.type(input, "あ".repeat(51));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("50 文字を超えています"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("51"));
  });

  it("50文字超→50文字以下に減らした際、追加発火がない", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const input = screen.getByPlaceholderText("ステップメモ(任意)");
    await user.type(input, "あ".repeat(51));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    await user.clear(input);
    await user.type(input, "あ".repeat(50));
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("RecipeBuilder レシピサマリ/折りたたみ(M15-05 追補・一目で分かる欄)", () => {
  const moves = [
    makeMove(10, "2MK", "normal", "中足"),
    makeMove(20, "236P", "special", "波動拳"),
  ];

  it("steps の技名を1行サマリで表示する", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[
          { stepOrder: 1, moveId: 10 },
          { stepOrder: 2, moveId: 20 },
        ]}
        moves={moves}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("combo-editor-recipe-summary").textContent).toBe(
      "中足 > 波動拳",
    );
  });

  it("steps 空ではプレースホルダを表示する", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={moves}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("combo-editor-recipe-summary").textContent,
    // ★M24-07: 空表示の文言を既存定数 RECIPE_EMPTY_LABEL へ寄せた
    //   (半角括弧の `(レシピ未入力)` は廃止)。★リテラルではなく定数を主張する
    //   ——正典が動いたときにテストが一緒に動く形にしておくため。
    ).toContain(RECIPE_EMPTY_LABEL);
  });

  it("見出しクリックでレシピ節を折りたためるが、サマリは常時残る", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[{ stepOrder: 1, moveId: 10 }]}
        moves={moves}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    const section = screen.getByTestId("combo-editor-recipe-section");
    const header = section.querySelector("button") as HTMLButtonElement;
    // 展開中は全技プルダウンのトグルが見える
    expect(screen.getByTestId("recipe-pulldown-toggle")).toBeTruthy();
    fireEvent.click(header);
    // 折りたたむと中身は消えるが、サマリは残る
    expect(screen.queryByTestId("recipe-pulldown-toggle")).toBeNull();
    expect(screen.getByTestId("combo-editor-recipe-summary")).toBeTruthy();
  });
});

describe("★全技一覧の「ボタンで入力できる技を省く」(M30-01 / SM-100)", () => {
  // ★区分の名指し: 「ファミリー UI に載らないため省かれてはならない」技を含める。
  //   ★★M30-02(P4M-016)で A1(`sonic_break`)が、M30-03 で A2
  //     (`lightning_beast_light_rolling_attack`)が**載るようになった**。
  //   ★★⇒ **省かれてはならない必殺技はもう存在しない。** 残るのは必殺技以外
  //     (ここでは区分 E の投げ `german_suplex`)だけである。
  const MOVES: Move[] = [
    makeMove(1, "standing_light_punch", "normal", "立ち弱P"),
    makeMove(2, "collar_bone_breaker", "unique", "肘打ち"),
    makeMove(3, "hadoken_light", "special", "弱波動拳"),
    makeMove(4, "sonic_break", "special", "ソニックブレイク"),
    makeMove(5, "sonic_break_od", "special", "ODソニックブレイク"),
    makeMove(6, "german_suplex", "throw", "ジャーマンスープレックス"),
    makeMove(
      7,
      "lightning_beast_light_rolling_attack",
      "special",
      "[エレキ]弱ローリングアタック",
    ),
  ];

  function renderBuilder() {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  function optionLabels(): string[] {
    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    return Array.from(select.options).map((o) => o.textContent ?? "");
  }

  it("★既定は OFF である(全件が並ぶ)", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const toggle = screen.getByTestId(
      "recipe-omit-surfaced-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    for (const name of MOVES.map((m) => m.nameJa as string)) {
      expect(optionLabels()).toContain(name);
    }
  });

  it("★★ON にするとボタンで押せる技だけが省かれ、押せない技は残る", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    await user.click(screen.getByTestId("recipe-omit-surfaced-toggle"));
    const labels = optionLabels();
    // 省かれる側(コントローラのいずれかの面から押せる)。
    expect(labels).not.toContain("立ち弱P"); // 通常技タブ(段階1)
    expect(labels).not.toContain("肘打ち"); // 特殊技タブ
    expect(labels).not.toContain("弱波動拳"); // 必殺技タブ
    expect(labels).not.toContain("ODソニックブレイク"); // 必殺技タブ(OD)
    // ★★M30-02(P4M-016): 素の版も「強度なし通常版」として押せるようになった。
    expect(labels).not.toContain("ソニックブレイク");
    // ★★M30-03: A2(強度語が code の途中に在る形)も必殺技タブから押せるようになった。
    expect(labels).not.toContain("[エレキ]弱ローリングアタック");
    // ★★残る側 = 未分類タブに並ぶ集合と一致する。⇒ 入力手段が消える技は 1 件も無い。
    expect(labels).toContain("ジャーマンスープレックス"); // 共通技行の 6 code 以外の投げ
  });

  it("OFF へ戻すと全件が戻る", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    const toggle = screen.getByTestId("recipe-omit-surfaced-toggle");
    await user.click(toggle);
    expect(optionLabels()).not.toContain("立ち弱P");
    await user.click(toggle);
    expect(optionLabels()).toContain("立ち弱P");
  });
});

describe("★消えた選択を残さない(M30-01 レビュー 高-4)", () => {
  const MOVES: Move[] = [
    makeMove(1, "standing_light_punch", "normal", "立ち弱P"),
    // ★★【2026-09-10 更新・M30-03】省かれない側の代表を差し替えた。
    //   M30-02 は A1 → A2 へ替えたが、その A2 も本サブで押せるようになった。
    //   ⇒ **必殺技はもう「省かれない側」の代表になれない。** 区分 E の投げを採る。
    makeMove(4, "german_suplex", "throw", "ジャーマンスープレックス"),
  ];

  it("★★ボタンで押せる技を選んだ後にトグルを ON にすると、［追加］が積めなくなる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId("recipe-pulldown-toggle"));

    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    await user.selectOptions(select, "1");
    const add = screen.getByRole("button", { name: "追加" });
    expect(add.hasAttribute("disabled")).toBe(false);

    await user.click(screen.getByTestId("recipe-omit-surfaced-toggle"));

    expect(select.value).toBe("");
    expect(add.hasAttribute("disabled")).toBe(true);
    await user.click(add);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("★省かれない技を選んでいるときは選択が残る", async () => {
    const user = userEvent.setup();
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("recipe-pulldown-toggle"));
    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    await user.selectOptions(select, "4");
    await user.click(screen.getByTestId("recipe-omit-surfaced-toggle"));
    expect(select.value).toBe("4");
  });
});

describe("★★M30-02(SD-020): 全技一覧の補足欄の OD 強度組合せ", () => {
  // ★★本 describe は「もう片面」である —— ダイアログ側は
  //   ModifiersEditor.test.tsx が見ている。片面だけのテストだと、
  //   もう片面の退行が緑のまま通る(followup `sd-020-od-variants-two-surfaces`)。
  const MOVES = [
    makeMove(1, "crouching_light_punch", "normal", "しゃがみ弱P"),
    makeMove(2, "hadoken_od", "special", "OD波動拳"),
  ];

  function renderBuilder(onChange = vi.fn()) {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[]}
        moves={MOVES}
        movesLoading={false}
        onChange={onChange}
      />,
    );
    return onChange;
  }

  /** 技を選んでから OD 節を開く。★節は技を選ぶまで存在しない。 */
  async function selectAndOpen(
    user: ReturnType<typeof userEvent.setup>,
    value: string,
  ) {
    await expandPulldown(user);
    await user.selectOptions(screen.getByTestId("recipe-move-select"), value);
    await user.click(screen.getByRole("button", { name: /OD 強度組合せ/ }));
  }

  const odLm = () =>
    screen.getByText("OD(弱中)").closest("label")?.querySelector("input");

  it("★★技を選んでいないときは節ごと出ない(2026-09-09 開発者判断)", async () => {
    // ★着手時点は「常に節を出して中身を disabled」だった。⇒ 出さない形へ変えた。
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    expect(screen.queryByTestId("recipe-od-variant-section-inline")).toBeNull();
  });

  it("★★しゃがみ弱P でも節ごと出ない(着手時点はここで OD 組を付けられた)", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    await user.selectOptions(screen.getByTestId("recipe-move-select"), "1");
    expect(screen.queryByTestId("recipe-od-variant-section-inline")).toBeNull();
  });

  it("★対照: OD 技を選ぶと節が現れる。★ただし既定は畳まれている", async () => {
    // ★★この対照が無いと「常に出さない」でも上 2 件は緑になる。
    const user = userEvent.setup();
    renderBuilder();
    await expandPulldown(user);
    await user.selectOptions(screen.getByTestId("recipe-move-select"), "2");
    expect(screen.getByTestId("recipe-od-variant-section-inline")).toBeTruthy();
    expect(screen.queryByText("OD(弱中)")).toBeNull();
  });

  it("★OD波動拳では選べて、追加したステップの flags に載る", async () => {
    const user = userEvent.setup();
    const onChange = renderBuilder();
    await selectAndOpen(user, "2");
    const cb = odLm();
    expect(cb).toHaveProperty("disabled", false);
    await user.click(cb as HTMLInputElement);
    await user.click(screen.getByTestId("recipe-add-step"));
    const [steps] = onChange.mock.calls.at(-1) as [
      Array<{ moveId?: number; modifiers?: { flags?: string[] } }>,
    ];
    expect(steps[0].moveId).toBe(2);
    expect(steps[0].modifiers?.flags).toEqual(["od_lm"]);
  });

  it("★★OD 技で選んでから通常技へ変えて追加しても、OD 組は載らない(レビュー 高-3)", async () => {
    // ★値が入っている間は節が残る(外せるようにするため)。⇒ 抑止は追加時に効く。
    const user = userEvent.setup();
    const onChange = renderBuilder();
    await selectAndOpen(user, "2");
    await user.click(odLm() as HTMLInputElement);
    await user.selectOptions(screen.getByTestId("recipe-move-select"), "1");
    // ★★非適用へ変えても、値が入っているので節は残っている(消えて外せなくなる状態を作らない)。
    expect(screen.getByTestId("recipe-od-variant-section-inline")).toBeTruthy();
    await user.click(screen.getByTestId("recipe-add-step"));
    const [steps] = onChange.mock.calls.at(-1) as [
      Array<{ moveId?: number; modifiers?: { flags?: string[] } }>,
    ];
    expect(steps[0].moveId).toBe(1);
    expect(steps[0].modifiers?.flags).toBeUndefined();
  });

  it("★対照: 常時出す群の flag は通常技でもそのまま載る(全部を濾していない)", async () => {
    const user = userEvent.setup();
    const onChange = renderBuilder();
    await expandPulldown(user);
    await user.selectOptions(screen.getByTestId("recipe-move-select"), "1");
    await user.click(
      screen.getByText("目押し").closest("label")?.querySelector("input") as HTMLInputElement,
    );
    await user.click(screen.getByTestId("recipe-add-step"));
    const [steps] = onChange.mock.calls.at(-1) as [
      Array<{ modifiers?: { flags?: string[] } }>,
    ];
    expect(steps[0].modifiers?.flags).toEqual(["link"]);
  });
});

// ★★★M31-06: 隠す先を**表示面へ広げていない**ことの陽性対照。
//
//   ★★★開発者の逐語(2026-09-10)＝「なお `setup_only` の技が始動技になることはあるので、
//     一覧や詳細では出すことは記録をお願いします」。
//   ⇒ 入力面から外した技が既存レシピの表示からも消えると、**その技を使ったコンボが
//     一覧で読めなくなる。** 保存済みのコンボが壊れて見える形の事故である(指示書 §0.2)。
//
//   ★★一覧・詳細・比較は `moves` を 1 度も引かない —— RecipeText がサーバ組み立て済みの
//     `recipe_cache` 由来文字列を割るだけである(recipeDisplay.ts の逐語注記)。
//     ⇒ 入力面の母集団を絞っても**届く経路が構造上存在しない**。
//   ★★★したがってコードで測れるのは**エディタ側の既存ステップ**である ——
//     こちらは movesById / formatRecipeLine で `moves` を引くため、
//     もし母集団を上流で絞ってしまえば技名が `#<id>` へ退行する。
describe("★★RecipeBuilder — setup_only の既存ステップは表示・再編集できる(M31-06)", () => {
  const SETUP_ONLY_MOVE: Move = {
    ...makeMove(777, "su_trap_light", "special", "弱トラップ"),
    setupOnly: true,
  };

  it("★既存ステップの技名が表示される(#id へ退行しない)", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[{ stepOrder: 1, moveId: 777 }]}
        moves={[SETUP_ONLY_MOVE]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    const list = screen.getByTestId("recipe-step-list");
    expect(list.textContent).toContain("弱トラップ");
    expect(list.textContent).not.toContain("#777");
  });

  it("★1 行プレビュー(formatRecipeLine)にも技名で出る", () => {
    render(
      <RecipeBuilder
        characterId={1}
        steps={[{ stepOrder: 1, moveId: 777 }]}
        moves={[SETUP_ONLY_MOVE]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("combo-editor-recipe-summary").textContent,
    ).toContain("弱トラップ");
  });

  it("★★対照: 同じ技は入力面(全技プルダウン)からは外れている", () => {
    // ★★これが無いと、上の 2 本は「そもそも除外が効いていない」でも緑になる。
    //   ⇒ 表示に出ることと入力面から外れることを、同じ技で対にして測る。
    render(
      <RecipeBuilder
        characterId={1}
        steps={[{ stepOrder: 1, moveId: 777 }]}
        moves={[SETUP_ONLY_MOVE]}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("recipe-pulldown-toggle"));
    const select = screen.getByTestId("recipe-move-select") as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.textContent);
    expect(optionTexts.join("|")).not.toContain("弱トラップ");
  });
});


// ============================================================================
// M37-02 / B12: レシピのサマリ行（2026-09-13 開発者選択＝トグルで展開 ＋ sticky）。
//
// ★★この行は `B09`「レシピが見えたまま入力できる」の担保でもある。
//   `CollapsibleFieldset` が summary を開閉に関わらず常時描くため、仮想コントローラの
//   真上に必ず在り、`sticky` で操作中も視界に残る。
// ============================================================================
describe("M37-02 B12: レシピサマリの全文表示", () => {
  const MOVES = [
    makeMove(1, "crouching_medium_kick", "normal", "中足"),
    makeMove(2, "hadoken_medium", "special", "波動拳"),
  ];

  function renderSummary(steps: Array<{ stepOrder: number; moveId: number }>) {
    return render(
      <RecipeBuilder
        characterId={1}
        steps={steps}
        moves={MOVES}
        movesLoading={false}
        onChange={vi.fn()}
      />,
    );
  }

  const TWO_STEPS = [
    { stepOrder: 1, moveId: 1 },
    { stepOrder: 2, moveId: 2 },
  ];

  it("★既定は 1 行（truncate）である", () => {
    renderSummary(TWO_STEPS);
    const summary = screen.getByTestId("combo-editor-recipe-summary");
    expect(summary.className).toContain("truncate");
  });

  it("★★明示操作で縦へ展開する（`...` で要約されない）", async () => {
    const user = userEvent.setup();
    renderSummary(TWO_STEPS);

    await user.click(screen.getByTestId("combo-editor-recipe-summary-toggle"));

    const summary = screen.getByTestId("combo-editor-recipe-summary");
    expect(summary.className).not.toContain("truncate");
    expect(summary.className).toContain("whitespace-pre-wrap");
  });

  it("★展開しても上限を持つ（sticky バーが縦を食い返さない）", async () => {
    const user = userEvent.setup();
    renderSummary(TWO_STEPS);

    await user.click(screen.getByTestId("combo-editor-recipe-summary-toggle"));

    const summary = screen.getByTestId("combo-editor-recipe-summary");
    expect(summary.className).toContain("max-h-[4.5rem]");
    expect(summary.className).toContain("overflow-y-auto");
  });

  it("★★textContent は変えていない（既存の床を書き換えていないことの対照）", () => {
    renderSummary(TWO_STEPS);
    expect(
      screen.getByTestId("combo-editor-recipe-summary").textContent,
    ).toBe("中足 > 波動拳");
  });

  it("★レシピが空ならトグルを出さない", () => {
    renderSummary([]);
    expect(screen.getByTestId("combo-editor-recipe-summary")).toBeTruthy();
    expect(
      screen.queryByTestId("combo-editor-recipe-summary-toggle"),
    ).toBeNull();
  });
});
