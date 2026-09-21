import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import GameUpdateCombosPage from "./GameUpdateCombosPage";

// M28-02c: 専用画面(DES-005 §5.19b)。
//
// ★★最重要は「取得に失敗したときに 0 件として扱わない」ことである
//   (先例の轍 = combo-list-setup-count-hides-fetch-failure)。
//   空の表を出すと「もう直っている」と読まれ、利用者は直す機会を失う。

vi.mock("@/components/Header", () => ({ default: () => null }));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GameUpdateCombosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 経路ごとに新しい Response を返す(ボディは 1 度しか読めないため使い回さない)。 */
function mockFetch(routes: Record<string, () => Response>) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : String(input);
    for (const [prefix, make] of Object.entries(routes)) {
      if (url.startsWith(prefix)) return Promise.resolve(make());
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

const okJSON = (body: unknown) => () =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const combo = (id: number, characterId: number) => ({
  id,
  characterId,
  isDraft: false,
  affectedByGameUpdate: true,
  affectedMoves: [
    { moveId: 10, code: "2MK", nameJa: "しゃがみ中キック", lastChangedGameVersion: "2026.09.10.01" },
  ],
  baselineVersion: "2026.08.03.01",
  stepCount: 2,
  defaultRecipe: "5LP > 236P",
  starterMoveCode: "5LP",
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GameUpdateCombosPage", () => {
  it("影響コンボをキャラごとの見出しと表で出す", async () => {
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 2,
      }),
      "/api/combos": okJSON({ items: [combo(1, 1), combo(2, 2)], count: 2 }),
      "/api/games/1/characters": okJSON({
        items: [
          { id: 1, nameJa: "リュウ", nameEn: "Ryu" },
          { id: 2, nameJa: "ケン", nameEn: "Ken" },
        ],
      }),
    });
    renderPage();

    expect(await screen.findByText("リュウ")).toBeTruthy();
    expect(await screen.findByText("ケン")).toBeTruthy();
    // ★変わった技が出ていること(これが本機能の目的そのものである)。
    const cells = await screen.findAllByTestId("combo-affected-moves");
    expect(cells[0].textContent).toBe("しゃがみ中キック");
    // ★印(更新未確認バッジ)は専用画面には置かない。全行が該当するので冗長である。
    expect(screen.queryByText("更新未確認")).toBeNull();
  });

  it("★★取得に失敗したときに「0 件」として扱わず、失敗として出す", async () => {
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 2,
      }),
      "/api/combos": () => new Response("boom", { status: 500 }),
      "/api/games/1/characters": okJSON({ items: [] }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("game-update-page-error")).toBeTruthy();
    });
    // ★「更新未確認のコンボはありません。」を出してはいけない ——
    //   取れていないだけなのに「もう直っている」と読まれる。
    expect(screen.queryByText("更新未確認のコンボはありません。")).toBeNull();
  });

  it("本当に 0 件のときだけ「ありません」と出す", async () => {
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 0,
      }),
      "/api/combos": okJSON({ items: [], count: 0 }),
      "/api/games/1/characters": okJSON({ items: [] }),
    });
    renderPage();

    expect(
      await screen.findByText("更新未確認のコンボはありません。"),
    ).toBeTruthy();
    expect(screen.queryByTestId("game-update-page-error")).toBeNull();
  });

  it("前提バージョンが無いときは「不明」と出す(「-」にしない)", async () => {
    const noBaseline = { ...combo(1, 1), baselineVersion: undefined };
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 1,
      }),
      "/api/combos": okJSON({ items: [noBaseline], count: 1 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    const cell = await screen.findByTestId("combo-baseline-version");
    expect(cell.textContent).toBe("不明");
  });

  it("★表示名が引けない技は code へ落とす", async () => {
    const rushOnly = {
      ...combo(1, 1),
      affectedMoves: [
        { moveId: 11, code: "rush_2MK", nameJa: null, lastChangedGameVersion: "2026.09.10.01" },
      ],
    };
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 1,
      }),
      "/api/combos": okJSON({ items: [rushOnly], count: 1 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    const cell = await screen.findByTestId("combo-affected-moves");
    expect(cell.textContent).toBe("rush_2MK");
  });

  it("★［コピー］は出さない(この画面では意味を持たない操作である)", async () => {
    // ★コピーで生まれる行は基準が現在版で埋まるため「影響なし」として生まれ、
    //   元の行は影響ありのまま残る。⇒ 直すための画面に置く操作ではない。
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 1,
      }),
      "/api/combos": okJSON({ items: [combo(1, 1)], count: 1 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    // 表が描かれていること(空表で「コピーが無い」を主張しないため)。
    expect(await screen.findByTestId("combo-acknowledge")).toBeTruthy();
    expect(screen.queryByText("コピー")).toBeNull();
    // ★詳細・編集・削除は残る。
    expect(screen.getByText("詳細")).toBeTruthy();
    expect(screen.getByText("編集")).toBeTruthy();
    expect(screen.getByText("削除")).toBeTruthy();
  });

  it("★［削除］は押すと確認ダイアログが出る(押しても何も起きないボタンにしない)", async () => {
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 1,
      }),
      "/api/combos": okJSON({ items: [combo(1, 1)], count: 1 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    await userEvent.click(await screen.findByText("削除"));
    expect(
      await screen.findByText("このコンボを削除しますか?(論理削除されます)"),
    ).toBeTruthy();
  });

  it("★★打ち切りの注記は上限に達したときだけ出す(総数との差だけで判定しない)", async () => {
    // ★総数(告知 API)と行数(一覧 API)は別のクエリであり、片方だけ先に更新される
    //   瞬間が実在する(削除した直後など)。差だけを見ると、その瞬間に
    //   「1 件中 0 件を表示しています」と嘘を言う。
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 5, // 行数より多いが、上限には達していない
      }),
      "/api/combos": okJSON({ items: [combo(1, 1)], count: 1 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    expect(await screen.findByTestId("combo-acknowledge")).toBeTruthy();
    expect(screen.queryByTestId("game-update-page-truncated")).toBeNull();
  });

  it("「問題なし」ボタンが 1 行につき 1 つ出る(一括は作らない)", async () => {
    mockFetch({
      "/api/notices/game-update": okJSON({
        currentDataVersion: "2026.09.10.01",
        affectedCount: 2,
      }),
      "/api/combos": okJSON({ items: [combo(1, 1), combo(2, 1)], count: 2 }),
      "/api/games/1/characters": okJSON({
        items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }],
      }),
    });
    renderPage();

    const buttons = await screen.findAllByTestId("combo-acknowledge");
    expect(buttons).toHaveLength(2);
    // ★一括の入口が無いこと。
    expect(screen.queryByText("すべて問題なしにする")).toBeNull();
  });
});
