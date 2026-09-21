import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import PunishListPage from "./PunishListPage";
import PunishSearchPage from "./PunishSearchPage";

// ===========================================================================
// ★★M31-01(P4M-015): 確定反撃の自キャラ既定値
//
// 逐語＝「確定反撃の自キャラはデフォルト、または、前回選択キャラを自動で出したい。
// 今は空。**相手は空のままでいい**」(phase4-memo.txt:54)。
//
// ★★主張は 2 つある。
//   (1) 自キャラは URL が空でも埋まる(＝取得フックが有効化される)
//   (2) 相手キャラは空のまま(＝勝手に絞り込まない)
// ★解決順そのものは defaultCharacter.test.ts が固定している。ここでは
//   「確定反撃の 2 画面がその規則を通っているか」だけを見る。
// ===========================================================================

const selfIds: (number | null)[] = [];
const oppIds: (number | null)[] = [];

vi.mock("@/features/punish/api", () => ({
  usePunishList: (self: number | null, opp: number | null) => {
    selfIds.push(self);
    oppIds.push(opp);
    return { isLoading: false, isError: false, data: undefined };
  },
  usePunishTree: (self: number | null, opp: number | null) => {
    selfIds.push(self);
    oppIds.push(opp);
    return { isLoading: false, isError: false, data: undefined };
  },
}));

// ★共通フックは実物を通す。モックすると「規則を通っているか」を見られない。
//   材料(config / characters)だけを差し替える。
vi.mock("@/features/config/useConfig", () => ({
  useConfig: () => ({ data: { defaults: { characterId: 7, presetId: 1 } } }),
}));
vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({ data: [{ id: 7, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" }] }),
}));

function renderPage(el: React.ReactElement, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/x" element={el} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  selfIds.length = 0;
  oppIds.length = 0;
  window.sessionStorage.clear();
});

describe("確定反撃の自キャラ既定値(P4M-015)", () => {
  it("★マイリスト: URL に self が無くても config の既定キャラが入る", () => {
    renderPage(<PunishListPage />, "/x");
    expect(selfIds.at(-1)).toBe(7);
  });

  it("★サーチ: URL に self が無くても config の既定キャラが入る", () => {
    renderPage(<PunishSearchPage />, "/x");
    expect(selfIds.at(-1)).toBe(7);
  });

  // ★★逐語「相手は空のままでいい」。⇒ 埋めると絞り込みが既定になってしまう。
  it("★相手キャラは空のまま(既定値を入れない)", () => {
    renderPage(<PunishListPage />, "/x");
    expect(oppIds.at(-1)).toBeNull();
  });

  // ★URL が段 1 として優先されること(既定に上書きされない)。
  it("★URL の self が指定されていればそちらが勝つ", () => {
    renderPage(<PunishListPage />, "/x?self=3");
    expect(selfIds.at(-1)).toBe(3);
  });

  // ★「自キャラを選択すると…」の空状態は起きなくなった。死んだ枝を残さない。
  it("★自キャラ未選択の案内文は出ない", () => {
    renderPage(<PunishListPage />, "/x");
    expect(screen.queryByText(/自キャラを選択すると/)).toBeNull();
  });
});
