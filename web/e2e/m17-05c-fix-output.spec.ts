import { readFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { expectExportFilename } from "./support/combo-io";

import { characterIdOf, gotoComboListFor } from "./support/character";
import { PDFDocument } from "pdf-lib";
import { minimalDraftSteps } from "./support/draft-combo";

// M17-05c-fix(CHANGE-073): 用紙寸法固定＋縮小フィット・メディア視覚除外・セットプレイ名称のみ・
// 総題削除・ExportDialog 形式別出し分け。
//
// 描画内容(総題なし/セットプレイ名称のみ/縮小注記/メディア非描画)はラスタ画像で E2E からは
// 検証できないため単体テストでカバーし、本 spec は動線・ページ数・ダイアログ出し分けを検証する。
// 既存 export の非回帰は m17-05b / combo-csv-io / m17-01 / m17-05c が担保。

async function createDraftCombos(
  request: import("@playwright/test").APIRequestContext,
  n: number,
  tag: string,
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await request.post("/api/combos", {
      // ★キャラは code から解決する。id を直書きしない(M24-09c 追補 段 2)。
      // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
      data: {
        characterId: await characterIdOf(request, "ryu"),
        isDraft: true,
        memo: `${tag}-${i}`,
        steps: minimalDraftSteps(),
      },
    });
    expect(res.ok()).toBeTruthy();
    const combo = (await res.json()) as { id: number };
    ids.push(combo.id);
  }
  return ids;
}

async function pdfPageCount(
  download: import("@playwright/test").Download,
): Promise<number> {
  const bytes = readFileSync(await download.path());
  return (await PDFDocument.load(bytes)).getPageCount();
}

async function openExportDialog(
  page: import("@playwright/test").Page,
  ids: number[],
) {
  // ★一覧は既定キャラで絞られる。作った行と同じキャラを明示して開く(段 2)。
  await gotoComboListFor(page, "ryu");
  await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
  for (const id of ids) {
    await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();
  }
  await page.getByTestId("export-open-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("M17-05c-fix 出力仕様是正", () => {
  test("ExportDialog: PDF のみは 15 項目(video/image 非表示)・CSV 含むは 17", async ({
    page,
  }) => {
    const ts = Date.now();
    const ids = await createDraftCombos(page.request, 2, `e2e-fix-dlg-${ts}`);
    const dialog = await openExportDialog(page, ids);

    // 既定 csv ON のまま PDF 追加 → CSV 含む = 17(video/image 表示)
    await dialog.getByTestId("export-format-pdf").click();
    await expect(dialog.getByTestId("export-item-videoPath")).toBeVisible();
    await expect(dialog.getByTestId("export-item-imagePath")).toBeVisible();

    // csv を外し PDF のみ = 15(video/image 非表示・link は残る)
    await dialog.getByTestId("export-format-csv").click();
    await expect(dialog.getByTestId("export-item-videoPath")).toHaveCount(0);
    await expect(dialog.getByTestId("export-item-imagePath")).toHaveCount(0);
    await expect(dialog.getByTestId("export-item-link")).toBeVisible();

    for (const id of ids) {
      expect((await page.request.delete(`/api/combos/${id}`)).ok()).toBeTruthy();
    }
  });

  test("単独 PDF は A4 縦 1 ページに収まる(26 項目・2 ページ化しない)", async ({
    page,
  }) => {
    const ts = Date.now();
    const [id] = await createDraftCombos(page.request, 1, `e2e-fix-single-${ts}`);
    const dialog = await openExportDialog(page, [id]);

    await dialog.getByTestId("export-format-csv").click();
    await dialog.getByTestId("export-format-pdf").click();
    const dl = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await dl;

    // ★M24-06: 自動命名(SM-075)。旧 combomgr-combo.pdf の「単独」を件数 1 で明示する。
    expectExportFilename(download.suggestedFilename(), {
      extension: "pdf",
      count: 1,
    });
    expect(await pdfPageCount(download)).toBe(1);

    expect((await page.request.delete(`/api/combos/${id}`)).ok()).toBeTruthy();
  });

  test("比較 5 件 PDF は 4 列/ページで列分割され 2 ページになる(壊れない)", async ({
    page,
  }) => {
    const ts = Date.now();
    const ids = await createDraftCombos(page.request, 5, `e2e-fix-cmp-${ts}`);
    const dialog = await openExportDialog(page, ids);

    await dialog.getByTestId("export-format-csv").click();
    await dialog.getByTestId("export-format-pdf").click();
    const dl = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await dl;

    // ★M24-06: 自動命名(SM-075)。旧 combomgr-combos.pdf の「複数」を件数で明示する。
    expectExportFilename(download.suggestedFilename(), {
      extension: "pdf",
      count: ids.length,
    });
    // 5 件 → ceil(5/4) = 2 ページ(列分割)。
    expect(await pdfPageCount(download)).toBe(2);

    for (const id of ids) {
      expect((await page.request.delete(`/api/combos/${id}`)).ok()).toBeTruthy();
    }
  });
});
