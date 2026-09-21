import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DuplicateInfo } from "../hooks/useCheckDuplicate";
import { DuplicateRealtimeWarning, buildDuplicateLabel } from "./DuplicateRealtimeWarning";

const MOVES = [
  { id: 10, characterId: 1, code: "5HP", category: "normal", isAerial: false, setupOnly: false, isDerived: false, nameJa: "立ち強P" },
];

function makeDuplicate(overrides?: Partial<DuplicateInfo>): DuplicateInfo {
  return {
    id: 42,
    characterId: 1,
    starterMoveId: 10,
    position: "mid_screen",
    opponentStance: "standing",
    hitType: "normal",
    opponentSize: "standard",
    starterMeaty: false, // M37-07
    stepCount: 3,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DuplicateRealtimeWarning", () => {
  it("duplicates が空なら何も描画しない", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { container } = renderWithProviders(
      <DuplicateRealtimeWarning duplicates={[]} moves={MOVES} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("duplicates があれば role=alert のバナーを描画する", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderWithProviders(
      <DuplicateRealtimeWarning duplicates={[makeDuplicate()]} moves={MOVES} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    // ★正確な鍵で見ること。"comboEditor.duplicateRealtime" は
    //   "comboEditor.duplicateRealtimeHeading" の部分文字列であり、
    //   前者で見ると鍵を差し替えても緑のまま通る(M24-07 の「ステップ」と同型の罠)。
    expect(alert.textContent).toContain("comboEditor.duplicateRealtimeHeading");
  });

  it("重複コンボ詳細へのリンクが含まれる", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderWithProviders(
      <DuplicateRealtimeWarning duplicates={[makeDuplicate({ id: 7 })]} moves={MOVES} />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/combos/7");
  });
});

describe("buildDuplicateLabel", () => {
  it("キャラ名・始動技名・状況ラベルを正しく解決する", () => {
    const label = buildDuplicateLabel(makeDuplicate(), MOVES, "リュウ");
    expect(label.character).toBe("リュウ");
    expect(label.starter).toBe("立ち強P");
    expect(label.hitType).toBe("通常");
    expect(label.position).toBe("画面中央");
    expect(label.stance).toBe("立ち");
    expect(label.size).toBe("標準");
  });

  it("始動技が moves に存在しない場合は 技#id フォールバックになる", () => {
    const label = buildDuplicateLabel(makeDuplicate({ starterMoveId: 999 }), MOVES, "リュウ");
    expect(label.starter).toBe("技#999");
  });

  it("starterMoveId が null なら '-' を返す", () => {
    const label = buildDuplicateLabel(makeDuplicate({ starterMoveId: null }), MOVES, "リュウ");
    expect(label.starter).toBe("-");
  });

  it("未知のキャラID はキャラ#id フォールバックになる", () => {
    const label = buildDuplicateLabel(makeDuplicate({ characterId: 99 }), MOVES, "");
    expect(label.character).toBe("キャラ#99");
  });
});

// ★★M24-08 第 2 部 C(SM-068): 遷移しなくても「どこが差分か」が読めること。
//
// ★前提の整理: 重複は「判定キー 7 項 ＋ recipe_hash の完全一致」で成立する(M37-07 で 6 → 7)。
//   ⇒ 一致した時点でキー項目とレシピの差分は原理的にゼロである。
//   差が出うるのは判定に使わない項目だけであり、本 describe はそこを見る。
describe("DuplicateRealtimeWarning の差分表示(M24-08 / SM-068)", () => {
  const DRAFT = {
    memo: "新しいメモ",
    damage: "2500",
    driveDamage: "",
    saGaugeConsumed: "1",
    driveGaugeConsumed: "3",
    knockdownAdvantage: "40",
    tagIds: [1, 2],
  };

  /** GET /api/combos/:id の応答を差し替える。 */
  function mockExistingCombo(body: Record<string, unknown>) {
    vi.spyOn(globalThis, "fetch").mockImplementation(((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("/api/combos/") ? body : { items: [] };
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch);
  }

  it("★判定に使わない項目の違いが、遷移せずにその場で読める", async () => {
    mockExistingCombo({
      id: 42,
      characterId: 1,
      memo: "既存のメモ",
      damage: 1800,
      saGaugeConsumed: 1,
      driveGaugeConsumed: 3,
      knockdownAdvantage: 40,
      tags: [{ id: 1, name: "a" }, { id: 2, name: "b" }],
      stepCount: 3,
      defaultRecipe: "",
      starterMoveCode: "5HP",
      isDraft: false,
      version: 1,
      createdAt: "",
      updatedAt: "",
    });

    renderWithProviders(
      <DuplicateRealtimeWarning
        duplicates={[makeDuplicate()]}
        moves={MOVES}
        draft={DRAFT}
      />,
    );

    const diff = await screen.findByTestId("duplicate-diff");
    // 違う 2 項目(メモ・ダメージ)は既存値 → 今の入力 の形で出る。
    await screen.findByText(/comboEditor.duplicateDiff.memo/);
    expect(diff.textContent).toContain("既存のメモ");
    expect(diff.textContent).toContain("新しいメモ");
    expect(diff.textContent).toContain("1800");
    expect(diff.textContent).toContain("2500");
    // 一致している項目は並べない(差分だけを出す)。
    expect(diff.textContent).not.toContain("comboEditor.duplicateDiff.knockdownAdvantage");
    expect(diff.textContent).not.toContain("comboEditor.duplicateDiff.tags");
  });

  it("判定に使わない項目まで同じなら、その旨を出す", async () => {
    mockExistingCombo({
      id: 42,
      characterId: 1,
      memo: "新しいメモ",
      damage: 2500,
      saGaugeConsumed: 1,
      driveGaugeConsumed: 3,
      knockdownAdvantage: 40,
      tags: [{ id: 1, name: "a" }, { id: 2, name: "b" }],
      stepCount: 3,
      defaultRecipe: "",
      starterMoveCode: "5HP",
      isDraft: false,
      version: 1,
      createdAt: "",
      updatedAt: "",
    });

    renderWithProviders(
      <DuplicateRealtimeWarning
        duplicates={[makeDuplicate()]}
        moves={MOVES}
        draft={DRAFT}
      />,
    );

    await screen.findByText("comboEditor.duplicateDiff.none");
  });

  it("既存コンボの名前代わり(memo)が見出しへ出る", async () => {
    mockExistingCombo({ id: 42, characterId: 1, tags: [] });
    renderWithProviders(
      <DuplicateRealtimeWarning
        duplicates={[makeDuplicate({ memo: "画面端コンボ" })]}
        moves={MOVES}
        draft={DRAFT}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("comboEditor.duplicateRealtimeHeading");
  });

  // ★★レビュー 高-5: 取得に失敗したときに「違いはありません」と断定しないこと。
  //   比較を 1 度も行っていないのに断定すると、差分欄そのものが利用者を誤らせる。
  it("★既存コンボの取得に失敗したら「違いはありません」と言わない", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/combos/")) {
        return Promise.resolve(new Response("boom", { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof fetch);

    renderWithProviders(
      <DuplicateRealtimeWarning
        duplicates={[makeDuplicate()]}
        moves={MOVES}
        draft={DRAFT}
      />,
    );

    await screen.findByText("comboEditor.duplicateDiff.loadError");
    expect(screen.queryByText("comboEditor.duplicateDiff.none")).toBeNull();
  });

  it("draft を渡さなければ差分欄は出ない(既存の呼び手を壊さない)", () => {
    mockExistingCombo({ id: 42, characterId: 1, tags: [] });
    renderWithProviders(
      <DuplicateRealtimeWarning duplicates={[makeDuplicate()]} moves={MOVES} />,
    );
    expect(screen.queryByTestId("duplicate-diff")).toBeNull();
  });
});
