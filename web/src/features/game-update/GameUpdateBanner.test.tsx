import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import AffectedCombosButton from "./AffectedCombosButton";
import GameUpdateBanner from "./GameUpdateBanner";
import type { GameUpdateNotice } from "./types";

// M28-02c: 告知バナーと一覧のボタン(CHANGE-162 §2.3 / §4)。
//
// ★★分水嶺 —— 延期が抑止するのはバナーだけであり、一覧のボタンは抑止しない。
//   LAN では 1 人の延期が全員に効くため、ボタンまで消すと他の利用者が入口を失う。
// ★★取得失敗を「0 件」として扱わない。両方の位置に失敗として出す。

function renderBoth(notice: GameUpdateNotice | "error") {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.startsWith("/api/notices/game-update")) {
      if (notice === "error") {
        return Promise.resolve(new Response("boom", { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(notice), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GameUpdateBanner />
        <AffectedCombosButton />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GameUpdateBanner / AffectedCombosButton", () => {
  it("影響コンボがあるとバナーとボタンが同時に出る", async () => {
    renderBoth({ currentDataVersion: "2026.09.10.01", affectedCount: 3 });

    expect(await screen.findByTestId("game-update-banner")).toBeTruthy();
    // ★★「バナーが出ている間はボタンを隠す」は採らない ——
    //   延期した瞬間にボタンが現れる形になり「消したのに別のものが出てきた」と読まれる。
    expect(await screen.findByTestId("game-update-button")).toBeTruthy();
    // ★件数はアプリ全体の合計である。⇒ 文面に「全キャラ」が明記されていること。
    expect(screen.getByTestId("game-update-button").textContent).toContain(
      "全キャラ",
    );
  });

  it("★★延期中はバナーが消えるが、一覧のボタンは消えない(分水嶺)", async () => {
    renderBoth({
      currentDataVersion: "2026.09.10.01",
      affectedCount: 3,
      postponedForVersion: "2026.09.10.01",
    });

    // ボタンは出る。
    expect(await screen.findByTestId("game-update-button")).toBeTruthy();
    // バナーは出ない。
    await waitFor(() => {
      expect(screen.queryByTestId("game-update-banner")).toBeNull();
    });
  });

  it("版が上がったら抑止が外れてバナーが戻る", async () => {
    renderBoth({
      currentDataVersion: "2026.10.01.00",
      affectedCount: 3,
      postponedForVersion: "2026.09.10.01", // 前の版のまま
    });
    expect(await screen.findByTestId("game-update-banner")).toBeTruthy();
  });

  it("0 件ならどちらも出さない", async () => {
    renderBoth({ currentDataVersion: "2026.09.10.01", affectedCount: 0 });

    await waitFor(() => {
      expect(screen.queryByTestId("game-update-banner")).toBeNull();
    });
    expect(screen.queryByTestId("game-update-button")).toBeNull();
  });

  it("★★取得に失敗したら「0 件」ではなく失敗として出す(バナーの位置にもボタンの位置にも)", async () => {
    renderBoth("error");

    expect(await screen.findByTestId("game-update-banner-error")).toBeTruthy();
    expect(await screen.findByTestId("game-update-button-error")).toBeTruthy();
    // ★静かに消えないこと —— 消えると「影響コンボは無い」と読まれる。
    expect(screen.queryByTestId("game-update-button")).toBeNull();
  });

  it("延期ボタンは要求本文を送らない(版数はサーバが決める)", async () => {
    renderBoth({ currentDataVersion: "2026.09.10.01", affectedCount: 3 });
    await screen.findByTestId("game-update-banner");

    await userEvent.click(screen.getByTestId("game-update-postpone"));

    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls;
      const postponeCall = calls.find(([input]) =>
        String(input).includes("/postpone"),
      );
      expect(postponeCall).toBeTruthy();
      const init = postponeCall?.[1] as RequestInit | undefined;
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeUndefined();
    });
  });
});
