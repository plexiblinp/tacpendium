import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";

import type { ComboDetail } from "../types";
import ComboDetailMetadata from "./ComboDetailMetadata";

// M28-02c: コンボ詳細の前提バージョン 1 行(DES-005 §5.6 / CHANGE-162 §5)。
//
// ★★印を出す面は詳細だけである。専用画面にも一覧にも置かない。
// ★★ゴミ箱詳細では印は出すが「問題なし」ボタンは出さず、理由を添える ——
//   判定式は deleted_at を見ないので印は載るが、acknowledge-version の母集団は
//   deleted_at IS NULL であり 404 になる。ボタンだけ黙って消すと
//   「確認できないのに警告だけ出る」形になる。

const makeCombo = (overrides: Partial<ComboDetail> = {}): ComboDetail => ({
  id: 1,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 2,
  defaultRecipe: "5LP > 236P",
  starterMoveCode: "5LP",
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
  ...overrides,
});

function renderMetadata(combo: ComboDetail, inTrash = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ComboDetailMetadata combo={combo} inTrash={inTrash} />
    </QueryClientProvider>,
  );
}

describe("ComboDetailMetadata のゲーム更新の 1 行", () => {
  it("前提バージョンを出す", () => {
    renderMetadata(makeCombo({ baselineVersion: "2026.08.03.01" }));
    expect(
      screen.getByTestId("combo-detail-baseline-version").textContent,
    ).toContain("2026.08.03.01");
  });

  it("★baselineVersion が無いときは「不明」と出す(「-」にしない)", () => {
    renderMetadata(makeCombo({ baselineVersion: undefined }));
    expect(
      screen.getByTestId("combo-detail-baseline-version").textContent,
    ).toContain("不明");
  });

  it("影響なしなら印もボタンも出ない", () => {
    renderMetadata(
      makeCombo({ baselineVersion: "2026.08.03.01", affectedByGameUpdate: false }),
    );
    expect(screen.queryByTestId("combo-detail-game-update-mark")).toBeNull();
    expect(screen.queryByTestId("combo-detail-acknowledge")).toBeNull();
  });

  it("影響ありなら印・変わった技・「問題なし」ボタンが出る", () => {
    renderMetadata(
      makeCombo({
        baselineVersion: "2026.08.03.01",
        affectedByGameUpdate: true,
        affectedMoves: [
          {
            moveId: 10,
            code: "2MK",
            nameJa: "しゃがみ中キック",
            lastChangedGameVersion: "2026.09.10.01",
          },
        ],
      }),
    );
    expect(screen.getByTestId("combo-detail-game-update-mark").textContent).toBe(
      "更新未確認",
    );
    expect(
      screen.getByTestId("combo-detail-affected-moves").textContent,
    ).toBe("しゃがみ中キック");
    expect(screen.getByTestId("combo-detail-acknowledge")).toBeTruthy();
  });

  it("★★真偽の正本は affectedByGameUpdate である(affectedMoves の長さではない)", () => {
    // ★列挙が空でも真偽が true なら印は出る。⇒ 長さで判定していないことの陽性対照。
    renderMetadata(
      makeCombo({ affectedByGameUpdate: true, affectedMoves: [] }),
    );
    expect(screen.getByTestId("combo-detail-game-update-mark")).toBeTruthy();
    expect(screen.getByTestId("combo-detail-acknowledge")).toBeTruthy();
  });

  it("★★ゴミ箱詳細では印は出すが「問題なし」ボタンを出さず、理由を添える", () => {
    renderMetadata(
      makeCombo({ affectedByGameUpdate: true, baselineVersion: "2026.08.03.01" }),
      true,
    );
    expect(screen.getByTestId("combo-detail-game-update-mark")).toBeTruthy();
    // ★ボタンだけ黙って消さない。
    expect(screen.queryByTestId("combo-detail-acknowledge")).toBeNull();
    expect(
      screen.getByTestId("combo-detail-acknowledge-trash-note").textContent,
    ).toBe("ゴミ箱の項目は確認できません。復元すると確認できます。");
  });
});
