import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  COLUMN_TEST_IDS,
  DEFAULT_COLUMN_VISIBILITY,
  DETAIL_LINK_COLUMN,
} from "@/constants/combo-list";
import "@/lib/i18n";

import type { ComboSummary } from "../types";
import ComboTableRow from "./ComboTableRow";

// ★★M31-03: 本ファイルの主題は「**詳細への行内リンクがどの列に在るか**」である。
//
// ★★見た目のテストではない。塞いでいるのは M27-03 で実際に起きた事故であり、
//   その事故は **テストも lint も型検査も緑のまま** 通り抜けた ——
//   当時の規則は「詳細への導線は先頭の 1 セルだけに置く」で、置き場が
//   **並び順に従属**していた。「始動状況」1 列を 3 列へ割った瞬間、リンクは
//   誰も選んでいないヒット種別へ移り、開発者が画面で気づくまで残った。
//
// ⇒ 置き場を DETAIL_LINK_COLUMN(定数)で宣言し、実装がそれに従うことを
//   **行の td を全数走査して**固定する。「片方を消した」だけでは、もう片方が
//   残っていないことを示せない(M31-03 指示書 §5-2)。

const COMBO_ID = 42;

function combo(overrides: Partial<ComboSummary> = {}): ComboSummary {
  return {
    id: COMBO_ID,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 3,
    defaultRecipe: "5LP > 236LP > 623HP",
    starterMoveCode: "5LP",
    hitType: "punish_counter",
    position: "corner_opponent",
    opponentStance: "standing",
    damage: 3200,
    memo: "画面端限定。SA3 は 2 ゲージ残しから",
    version: 1,
    createdAt: "2026-09-09T00:00:00Z",
    updatedAt: "2026-09-09T00:00:00Z",
    tags: [],
    setups: [],
    ...overrides,
  };
}

function renderRow(
  props: Partial<React.ComponentProps<typeof ComboTableRow>> = {},
) {
  return render(
    <MemoryRouter>
      <table>
        <tbody>
          <ComboTableRow
            combo={combo()}
            expanded={false}
            canExpand={false}
            onToggleExpand={vi.fn()}
            visibility={DEFAULT_COLUMN_VISIBILITY}
            {...props}
          />
        </tbody>
      </table>
    </MemoryRouter>,
  );
}

/** 行の td のうち、**操作列(最後の td)を除いた**ものを返す。 */
function contentCells(): HTMLTableCellElement[] {
  const row = screen.getByRole("row");
  const cells = Array.from(row.querySelectorAll("td"));
  return cells.slice(0, -1);
}

describe("ComboTableRow — 詳細への行内リンクの置き場", () => {
  it("行内リンクは DETAIL_LINK_COLUMN の列にだけ在る(td を全数走査する)", () => {
    renderRow();

    const expectedTestId = COLUMN_TEST_IDS[DETAIL_LINK_COLUMN];

    // ★★「リンクを持つ td」を数え上げる。1 つだけであること、かつ
    //   それが宣言した列であることの 2 つを同時に見る。
    //   ⇒ 「移した」のか「増やした」のかが、これで区別できる。
    const holders = contentCells().filter(
      (cell) => cell.querySelectorAll(`a[href="/combos/${COMBO_ID}"]`).length > 0,
    );

    expect(holders).toHaveLength(1);
    expect(holders[0].getAttribute("data-testid")).toBe(expectedTestId);
  });

  it("ヒット種別の欄はリンクを持たない(着手前はここに在った)", () => {
    renderRow();

    const hitTypeCell = screen.getByTestId(COLUMN_TEST_IDS.hitType);
    expect(hitTypeCell.querySelector("a")).toBeNull();
    // ★消しすぎていないこと。ラベルそのものは残る。
    expect(hitTypeCell.textContent?.trim()).not.toBe("");
  });

  it("メモの 1 行目はリンクの外に在る(レシピの一部として読ませない)", () => {
    renderRow();

    const memoLine = screen.getByTestId("memo-first-line");
    // ★role="note" のメモ由来の 1 行を <a> の中へ入れると、支援技術が
    //   レシピの一部として読み上げる(M24-03 §4.4 の読み分けが崩れる)。
    expect(memoLine.closest("a")).toBeNull();
  });

  it("ルート列を非表示にすると行内リンクは消え、操作列の「詳細」は残る", () => {
    renderRow({
      visibility: { ...DEFAULT_COLUMN_VISIBILITY, recipe: false },
    });

    const holders = contentCells().filter(
      (cell) => cell.querySelectorAll(`a[href="/combos/${COMBO_ID}"]`).length > 0,
    );
    expect(holders).toHaveLength(0);

    // ★導線そのものは失われない —— 操作列の「詳細」は列設定に関わらず常に在る。
    const row = screen.getByRole("row");
    const actionsCell = Array.from(row.querySelectorAll("td")).at(-1)!;
    expect(
      actionsCell.querySelector(`a[href="/combos/${COMBO_ID}"]`),
    ).not.toBeNull();
  });

  // ★★M31-03 レビュー(中-5): レシピが空のコンボでもリンクは出る。
  //
  //   RecipeText はステップ 0 件のとき t("comboCommon.recipeEmpty") の
  //   プレースホルダを返す。⇒ そのプレースホルダごと <a> に包まれ、
  //   **リンクのアクセシブル名がプレースホルダ語になる**。
  //
  // ★★本テストは「今そうなっている」ことを固定するものであり、
  //   「そうあるべき」と決めたものではない。DES-005 に記述が無く、
  //   変えるなら開発者判断が要る(設計伝達レポート §4 の候補へ回した)。
  //   ⇒ 挙動を変えるときは、まずこのテストが赤くなる。
  it("レシピが空でもリンクは出る(プレースホルダごと包まれる)", () => {
    renderRow({ combo: combo({ defaultRecipe: undefined, stepCount: 0 }) });

    const cell = screen.getByTestId(COLUMN_TEST_IDS.recipe);
    const link = cell.querySelector(`a[href="/combos/${COMBO_ID}"]`);
    expect(link).not.toBeNull();
    // ★空表示の目印は残っている(リンクが中身を食っていない)。
    expect(cell.querySelector('[data-recipe-view="empty"]')).not.toBeNull();
    // ★アクセシブル名はプレースホルダ語になる。これが中-5 の論点そのものである。
    expect(link!.textContent?.trim()).not.toBe("");
  });
});
