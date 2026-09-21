import { test, expect, type Page } from "@playwright/test";

import { characterIdOf } from "./support/character";

// 前提: ウィザード完了済み DB。バックエンド(:47390) および Vite dev(:5273) が起動していること。
//
// ★★本 spec はサーバ状態を 1 バイトも書き換えない(D-466 / 教訓 E-142)。
//   確認ダイアログは「一覧が上限で切れている」ときにだけ出るため、素直にやると
//   コンボを 101 件投入することになる。しかしそれは共有 DB を 100 件で埋め、
//   一覧を見る他ファイルの spec を道連れにする ——「同じ資源を奪い合う」型ではなく
//   「全 spec に影響する状態」であり、1 ファイルへ寄せても解けない。
//   ⇒ page.route で GET /api/combos の応答だけをこのブラウザコンテキストで差し替える。
//     復元も要らない。M22-01 が認証の ON/OFF で採った形と同じである。

function comboRow(id: number, characterId: number) {
  return {
    id,
    characterId,
    isDraft: true,
    stepCount: 1,
    defaultRecipe: "5LP",
    starterMoveCode: "standing_light_punch",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    okiOptions: [],
    tags: [],
    setups: [],
  };
}

/**
 * 一覧応答を差し替える。items は loaded 件、total は「本当は何件あるか」。
 * ★total > items が「上限で切り捨てた」の観測である。
 */
async function stubComboList(
  page: Page,
  characterId: number,
  loaded: number,
  total: number,
) {
  // ★glob ではなく述語で照合する。glob の `?` は 1 文字ワイルドカードとして扱われ、
  //   一覧(/api/combos?...)に当たらないまま詳細(/api/combos/{id})に当たりうる。
  //   pathname の完全一致なら、その取り違えが起きない。
  await page.route(
    (url) => url.pathname === "/api/combos",
    async (route) => {
      const items = Array.from({ length: loaded }, (_, i) =>
        comboRow(900000 + i, characterId),
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items, count: items.length, total }),
      });
    },
  );
}

/**
 * 書出応答を差し替える。
 *
 * ★一覧を stub した以上、載っている id は実在しない。⇒ 実 API を叩くと
 * 「そのコンボが無い」で 400 になり、出力が始まらない。本 spec が見たいのは
 * 「確認を出すか / 出さずに進むか」であって BE の書出そのものではないため、
 * 応答ごと差し替える(BE 側の観測は Go テストが担保している)。
 */
async function stubExport(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/export/csv",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/zip",
        headers: {
          "X-Export-Total": "1",
          "X-Export-Included": "1",
          "X-Export-Truncated": "false",
          "X-Export-Reimport-Blocked": "false",
        },
        body: "PKe2e",
      });
    },
  );
}

async function openList(page: Page, characterId: number) {
  await page.goto(`/combos?character_id=${characterId}`);
  await expect(page.getByTestId("export-open-button")).toBeEnabled();
}

test.describe("M29-02 書出の切り捨てを鳴らす(上限は変えない)", () => {
  test("★切り捨てるとき、黙って出力せず件数を示して選ばせる", async ({
    page,
  }) => {
    const characterId = await characterIdOf(page.request, "ryu");
    await stubComboList(page, characterId, 100, 250);
    await openList(page, characterId);

    // ── 件数表示 ──────────────────────────────────────────────────────
    // ★着手前は count(= 載った件数)を出していたため「全 100 件」と表示され、
    //   利用者にはそれが全件に見えた。
    await expect(page.getByTestId("export-open-button")).toHaveText(
      "全 250 件をエクスポート",
    );

    // ── 実行 ─────────────────────────────────────────────────────────
    await page.getByTestId("export-open-button").click();
    await page.getByRole("button", { name: "エクスポート実行" }).click();

    // ── 確認が出る ────────────────────────────────────────────────────
    const confirm = page.getByTestId("export-truncation-confirm");
    await expect(confirm).toBeVisible();
    const text = (await confirm.textContent()) ?? "";
    expect(text).toContain("250");
    expect(text).toContain("100");
    expect(text).toContain("150");

    // ── ★出力は始まっていない ──────────────────────────────────────────
    // 黙って一部だけ出すことが、本サブが直そうとしている事故の形である。
    const started = await page
      .waitForEvent("download", { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    expect(started).toBe(false);
  });

  test("対照: 切り捨てが無いときは確認を出さずそのまま出力する", async ({
    page,
  }) => {
    // ★この対照が無いと「常に確認を出す」実装でも上のテストは緑になる。
    const characterId = await characterIdOf(page.request, "ryu");
    await stubComboList(page, characterId, 100, 100);
    await stubExport(page);
    await openList(page, characterId);

    await page.getByTestId("export-open-button").click();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "エクスポート実行" }).click();

    await expect(page.getByTestId("export-truncation-confirm")).toHaveCount(0);
    await download;
  });

  test("確認したうえで続けると出力する", async ({ page }) => {
    const characterId = await characterIdOf(page.request, "ryu");
    await stubComboList(page, characterId, 100, 250);
    await stubExport(page);
    await openList(page, characterId);

    await page.getByTestId("export-open-button").click();
    await page.getByRole("button", { name: "エクスポート実行" }).click();
    await expect(page.getByTestId("export-truncation-confirm")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "このまま出力する" }).click();
    await download;
  });
});
