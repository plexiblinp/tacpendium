import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import ComboListPage from "./ComboListPage";

// M28-02c: 告知バナーのマウント先(DES-005 §5.19b / CHANGE-162 §4)。
//
// ★★App.tsx のデスクトップ・リダイレクトにより 640px 以上では HomePage が一度も
//   描画されない(useIsMobile の閾値は (max-width: 639px))。⇒ 告知をホームだけに
//   置くと PC の利用者へ一度も届かない。
// ★★これは仮説ではなく実際に起きていた —— 既存の移行告知バナーの唯一のマウント先が
//   HomePage であり、PC では一度も表示されていなかった
//   (followup migration-banner-never-shown-on-desktop)。
// ★★「バナーが出る」を E2E のビューポートで確かめるだけでは足りない ——
//   本テストは「マウント先が 2 か所ある」ことそのものを固定する。

vi.mock("@/components/Header", () => ({ default: () => null }));

function renderPage(affectedCount: number) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : String(input);
    const json = (body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    if (url.startsWith("/api/notices/game-update")) {
      return json({ currentDataVersion: "2026.09.10.01", affectedCount });
    }
    if (url.startsWith("/api/notices/data-migration")) {
      return json({
        status: "migrated",
        message: "移行しました",
        acknowledged: false,
        retireFailed: false,
      });
    }
    if (url.startsWith("/api/combos")) return json({ items: [], count: 0 });
    if (url.includes("/characters")) {
      return json({ items: [{ id: 1, nameJa: "リュウ", nameEn: "Ryu" }] });
    }
    if (url.startsWith("/api/tags")) return json([]);
    if (url.startsWith("/api/moves")) return json({ items: [] });
    return json({});
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/combos"]}>
        <ComboListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ComboListPage の告知バナー", () => {
  it("★★ゲーム更新の告知バナーが一覧にもマウントされている(PC の実質的な入口)", async () => {
    renderPage(3);
    expect(await screen.findByTestId("game-update-banner")).toBeTruthy();
  });

  it("★★移行告知バナーも一覧にマウントされている(M28-01 の是正)", async () => {
    // ★M28-01 / CHANGE-156 の移行告知は HomePage の 1 か所にしかマウントされておらず、
    //   640px 以上では一度も表示されていなかった
    //   (followup migration-banner-never-shown-on-desktop)。
    // ★ここでは「マウントされていること」を告知の中身で確かめる。
    renderPage(0);
    expect(
      await screen.findByText("データの保存場所が変わりました"),
    ).toBeTruthy();
  });

  it("★一覧に増えるのはボタン 1 個だけである(フィルタ軸は足さない)", async () => {
    renderPage(3);
    expect(await screen.findByTestId("game-update-button")).toBeTruthy();
    // ★フィルタ欄に「ゲーム更新」の軸が生えていないこと。
    expect(screen.queryByLabelText(/ゲーム更新/)).toBeNull();
  });
});
