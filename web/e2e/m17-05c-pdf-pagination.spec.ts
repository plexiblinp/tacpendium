import { readFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { expectExportFilename } from "./support/combo-io";

import { characterIdOf, gotoComboListFor } from "./support/character";
import { PDFDocument } from "pdf-lib";
import { minimalDraftSteps } from "./support/draft-combo";

// M17-05c(A-4 / M13-g): PDF のページ分割 + PNG の canvas 上限対処。
//
// 前提: ウィザード完了済みのローカル開発環境。DB は spec が自前で作成・削除するため既存件数に依存しない。
// 仮登録(is_draft=true)で作成する(VAL-C02 重複判定は仮登録では非実行)。
//
// 出力文書の内容・レイアウト・28 項目は不変(CHANGE-052/068)。本サブは「どこで切るか」のみ。
// 既存 export(CSV/クリップボード/単独)の非回帰は combo-csv-io / m17-01-media-fields / m17-05b が担保。

async function createDraftCombos(
  request: import("@playwright/test").APIRequestContext,
  n: number,
  tag: string,
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await request.post("/api/combos", {
      data: {
        // ★キャラは code から解決する。id を直書きしない(M24-09c 追補 段 2)。
        characterId: await characterIdOf(request, "ryu"),
        isDraft: true,
        memo: `${tag}-${i}`,
        // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
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
  const path = await download.path();
  const bytes = readFileSync(path);
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

test.describe("M17-05c PDF ページ分割 / PNG 上限対処", () => {
  test("多数コンボ(5件)の PDF は複数ページに分割され、壊れていない", async ({
    page,
  }) => {
    const ts = Date.now();
    const ids = await createDraftCombos(page.request, 5, `e2e-pdf-multi-${ts}`);

    await gotoComboListFor(page, "ryu");
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    for (const id of ids) {
      await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();
    }

    await page.getByTestId("export-open-button").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // CSV(既定)は外し、PDF のみに(ダウンロードを PDF 1 本に絞る)
    await dialog.getByTestId("export-format-csv").click();
    await dialog.getByTestId("export-format-pdf").click();

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await downloadPromise;

    // ★M24-06: 自動命名(SM-075)。旧 combomgr-combos.pdf の「複数」を件数で明示する。
    expectExportFilename(download.suggestedFilename(), {
      extension: "pdf",
      count: ids.length,
    });
    // 比較表 5 件 → 4 列/ページの列分割で複数ページになる(M17-05c-fix で行分割は撤去・列分割は維持)。
    expect(await pdfPageCount(download)).toBeGreaterThanOrEqual(2);

    for (const id of ids) {
      const res = await page.request.delete(`/api/combos/${id}`);
      expect(res.ok()).toBeTruthy();
    }
  });

  test("単独コンボの PDF は 1 ページのまま(従来出力の非回帰)", async ({
    page,
  }) => {
    const ts = Date.now();
    const [id] = await createDraftCombos(page.request, 1, `e2e-pdf-single-${ts}`);

    await gotoComboListFor(page, "ryu");
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();

    await page.getByTestId("export-open-button").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("export-format-csv").click();
    await dialog.getByTestId("export-format-pdf").click();

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await downloadPromise;

    // ★M24-06: 自動命名(SM-075)。旧 combomgr-combo.pdf の「単独」を件数 1 で明示する。
    expectExportFilename(download.suggestedFilename(), {
      extension: "pdf",
      count: 1,
    });
    expect(await pdfPageCount(download)).toBe(1);

    const res = await page.request.delete(`/api/combos/${id}`);
    expect(res.ok()).toBeTruthy();
  });

  test("PNG 選択時は canvas 上限の注意書き(実測件数)が UI に出る", async ({
    page,
  }) => {
    const ts = Date.now();
    const ids = await createDraftCombos(page.request, 2, `e2e-png-hint-${ts}`);

    await gotoComboListFor(page, "ryu");
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    for (const id of ids) {
      await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();
    }

    await page.getByTestId("export-open-button").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // PNG を選ぶと上限注意書き(実測 22 件超)が現れ、PDF を促す。
    await expect(dialog.getByTestId("export-png-limit-hint")).toHaveCount(0);
    await dialog.getByTestId("export-format-png").click();
    await expect(dialog.getByTestId("export-png-limit-hint")).toBeVisible();
    await expect(dialog.getByTestId("export-png-limit-hint")).toContainText("22");
    await expect(dialog.getByTestId("export-png-limit-hint")).toContainText("PDF");

    for (const id of ids) {
      const res = await page.request.delete(`/api/combos/${id}`);
      expect(res.ok()).toBeTruthy();
    }
  });
});
