import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import type { ComboDetail } from "../types";
import ComboDetailHeader from "./ComboDetailHeader";

// useCharacters/useCharacterName は QueryClientProvider を要するため custom_states 定義つきでモック(M11-01)。
vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({
    data: [
      {
        id: 1,
        gameId: 1,
        code: "ryu",
        nameJa: "リュウ",
        nameEn: "Ryu",
        customStates: JSON.stringify({
          states: [
            {
              code: "denjin_charge",
              name_ja: "電刃錬気",
              type: "flag",
              value_definition: { kind: "boolean" },
            },
            {
              code: "sun_crest",
              name_ja: "サンシンボル",
              name_en: "Sun Crest",
              type: "level",
              value_definition: { kind: "integer", min: 0, max: 4 },
              show_delta: true,
            },
          ],
        }),
      },
    ],
  }),
  useCharacterName: () => "リュウ",
}));

const makeCombo = (overrides: Partial<ComboDetail> = {}): ComboDetail => ({
  id: 1,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  starterMoveCode: "5LP",
  defaultRecipe: "5LP > 236P",
  stepCount: 2,
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
  ...overrides,
});

describe("ComboDetailHeader キャラ固有状態(M11-01)", () => {
  it("M16-07: int state を ①②③ の明示ラベルで表示する(show_delta=true)", () => {
    const combo = makeCombo({
      situation: JSON.stringify({
        custom_states: { denjin_charge: true, sun_crest: { start_min: 1, end: 3 } },
      }),
    });
    render(<ComboDetailHeader combo={combo} />);
    expect(screen.getByText("キャラ固有状態")).toBeTruthy();
    expect(screen.getByText("電刃錬気")).toBeTruthy();
    // ①②③ の明示ラベル(名称 + 固定句)
    expect(screen.getByText("サンシンボル：始動時に必要な最低のストック数")).toBeTruthy();
    expect(screen.getByText("サンシンボル：終了時のストック数")).toBeTruthy();
    expect(screen.getByText("サンシンボル：ストック増減")).toBeTruthy();
    // ③増減 = ②3 − ①1 = +2(符号付き)
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("M16-07 移行: 旧スカラの既存コンボも壊れず ②(end) へ写像表示する", () => {
    const combo = makeCombo({
      situation: JSON.stringify({ custom_states: { sun_crest: 3 } }),
    });
    render(<ComboDetailHeader combo={combo} />);
    // ① は既定(0)、② は 3、③ = +3
    expect(screen.getByText("サンシンボル：終了時のストック数")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
  });

  it("(18) situation=NULL の既存コンボはセクションを表示しない(後方互換)", () => {
    render(<ComboDetailHeader combo={makeCombo()} />);
    expect(screen.queryByText("キャラ固有状態")).toBeNull();
    // 独立カラム「状況」は従来どおり表示される。
    expect(screen.getByText("状況")).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// M37-01: 始動位置のマス数を区分の隣に出す(指示書 §2.3-1)
// ══════════════════════════════════════════════════════════════════════════
describe("ComboDetailHeader — 始動位置のマス数(M37-01)", () => {
  it("区分の隣にマス数とパーセントが出る", () => {
    render(
      <ComboDetailHeader
        combo={makeCombo({ position: "mid_screen", startPositionMass: 80 })}
      />,
    );
    expect(
      screen.getByTestId("combo-detail-start-position-mass").textContent,
    ).toBe("80 マス (50%)");
  });

  // ★★区分だけの旧データが大半である(マス数は M28-02a 以降の列)。
  //   ⇒ 未入力のときに「-」を足すと、既存コンボの状況欄が一斉に汚れる。
  it("★マス数が未入力なら何も足さない(区分だけの旧データを汚さない)", () => {
    render(<ComboDetailHeader combo={makeCombo({ position: "mid_screen" })} />);
    expect(screen.queryByTestId("combo-detail-start-position-mass")).toBeNull();
  });
});
