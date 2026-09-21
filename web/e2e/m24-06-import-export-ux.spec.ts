import { readFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import { gotoComboListFor } from "./support/character";
import {
  buildComboCsv,
  commitImport,
  deleteCombosByMemoPrefix,
  expectExportFilename,
  openExportDialog,
  previewComboCsv,
  previewComboFile,
} from "./support/combo-io";
import {
  characterIdByCode,
  createComboWithSteps,
  deleteCombos,
  moveIdsOf,
} from "./support/recipe-view";

// M24-06「取込・出力の UX」の E2E(指示書 §5.1・4 ケース)。
//
// (1) 仮登録を含む CSV を取り込むと仮登録が除外され、件数が出る (SM-071)
// (2) 0 件ファイルをプレビューすると 0 件だと分かる                (SM-076)
// (3) 連続でエクスポートしてファイル名が衝突しない                 (SM-075)
// (4) 自動命名で出力した ZIP をそのまま取り込める                  (§4.4.1・往復対称)
//
// DB 前提: 件数非依存・self-contained。fixture は memo の接頭辞で同定して掃除する。

const CHARACTER_CODE = "ryu";

async function ryuRecipe(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = items.find((c) => c.code === CHARACTER_CODE);
  expect(ryu, `seed に ${CHARACTER_CODE} が存在するはず`).toBeTruthy();
  const moves = await request.get(`/api/moves?character_id=${ryu!.id}`);
  const moveCode = ((await moves.json()).items as Array<{ code: string }>)[0].code;
  return {
    characterId: ryu!.id,
    recipe: `[{"move_code":"${moveCode}","modifiers":{}}]`,
  };
}

test.describe("M24-06 取込・出力の UX", () => {
  test("(1) 仮登録を含む CSV は仮登録が除外され、除外件数が出る", async ({ page }) => {
    const ts = Date.now();
    const memo = `e2e-m2406-draft-${ts}`;
    await deleteCombosByMemoPrefix(page.request, "e2e-m2406-draft-");
    const { recipe } = await ryuRecipe(page.request);

    // 本登録 1 行 + 仮登録 2 行。
    const csv = buildComboCsv([
      // ★M27-02b(VAL-C15) / ★★M38-01: 本登録行が埋める欄(仮登録行には要らない)。
      //   ★M38-01 で必須欄が 2 欄になり、CSV が咎めるのは
      //     damage / knockdown_advantage の 2 列だけになった。
      {
        local_id: "n1",
        character_code: CHARACTER_CODE,
        is_draft: "false",
        damage: "1500",
        knockdown_advantage: "30",
        sa_gauge_consumed: "0",
        drive_gauge_consumed: "1",
        memo,
        recipe,
      },
      {
        local_id: "d1",
        character_code: CHARACTER_CODE,
        is_draft: "true",
        memo: `${memo}-draft-a`,
        recipe,
      },
      {
        local_id: "d2",
        character_code: CHARACTER_CODE,
        is_draft: "true",
        memo: `${memo}-draft-b`,
        recipe,
      },
    ]);

    await previewComboCsv(page, csv);

    // 3 行出るが、既定で選ばれるのは仮登録でない 1 行だけ。
    await expect(page.getByText(/3 行中 1 行を取込対象に選択中/)).toBeVisible();

    // 除外件数が出る(黙って減らさない)。
    await expect(page.getByTestId("import-draft-excluded")).toHaveText(
      /仮登録の 2 行を取込対象から除外しました/,
    );

    // 行は消さずに残す。仮登録の行はチェックできない。
    await expect(page.getByLabel("2行目を取込対象にする")).toBeDisabled();
    await expect(page.getByLabel("3行目を取込対象にする")).toBeDisabled();
    await expect(page.getByLabel("1行目を取込対象にする")).toBeEnabled();

    // 「全選択」を押しても仮登録は選ばれない(条件が 3 か所で割れていないことの観測)。
    await page.getByRole("button", { name: "全選択" }).click();
    await expect(page.getByText(/3 行中 1 行を取込対象に選択中/)).toBeVisible();

    await commitImport(page);
    await expect(page.getByText(/取込完了/)).toBeVisible();

    // 仮登録の行は DB に入っていない。
    const listRes = await page.request.get("/api/combos?is_draft=true");
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { items: { memo?: string }[] };
    expect(
      list.items.some((c) => c.memo?.startsWith(`${memo}-draft`)),
      "仮登録の行は取り込まれない",
    ).toBeFalsy();

    await deleteCombosByMemoPrefix(page.request, "e2e-m2406-draft-");
  });

  test("(2) 0 件ファイルをプレビューすると 0 件だと分かる", async ({ page }) => {
    // 見出し行だけの CSV(BE は FileError を立てず 0 行を返す)。
    await previewComboCsv(page, buildComboCsv([]), "e2e-m2406-empty.csv");

    await expect(page.getByTestId("import-empty-preview")).toBeVisible();
    await expect(page.getByTestId("import-empty-preview")).toContainText(
      "取り込めるコンボ行がありません(0 件)",
    );
    // 取込対象の行が無いので取込実行は出ない(プレビュー節ごと描かれない)。
    await expect(page.getByRole("button", { name: "取込実行" })).toHaveCount(0);
  });

  test("(3) 連続でエクスポートしてもファイル名が衝突しない", async ({ page }) => {
    const ts = Date.now();
    const characterId = await characterIdByCode(page.request, CHARACTER_CODE);
    const moveIds = await moveIdsOf(page.request, characterId);
    const { id } = await createComboWithSteps(page.request, {
      characterId,
      moveIds,
      stepCount: 1,
      memo: `e2e-m2406-name-${ts}`,
    });

    await gotoComboListFor(page, CHARACTER_CODE);
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();

    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      const dialog = await openExportDialog(page);
      const downloadPromise = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "エクスポート実行" }).click();
      names.push((await downloadPromise).suggestedFilename());
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    // ★1 回しか出さないテストでは衝突を検出できない。2 回出して名前が違うことを見る。
    expect(names[0]).not.toBe(names[1]);
    for (const name of names) {
      expectExportFilename(name, { extension: "zip", count: 1 });
    }

    await deleteCombos(page.request, [id]);
  });

  test("(4) 自動命名で出力した ZIP をそのまま取り込める(往復対称)", async ({ page }) => {
    const ts = Date.now();
    const characterId = await characterIdByCode(page.request, CHARACTER_CODE);
    const moveIds = await moveIdsOf(page.request, characterId);
    const { id } = await createComboWithSteps(page.request, {
      characterId,
      moveIds,
      stepCount: 1,
      memo: `e2e-m2406-roundtrip-${ts}`,
    });

    await gotoComboListFor(page, CHARACTER_CODE);
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();

    const dialog = await openExportDialog(page);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await downloadPromise;
    const zipName = download.suggestedFilename();
    expectExportFilename(zipName, { extension: "zip", count: 1 });

    const zipPath = await download.path();
    expect(zipPath, "ダウンロードした zip の実体が取れる").toBeTruthy();

    // ★出した ZIP を、自動命名された名前のまま取込へ流す(DES-002 §7.6 の往復対称)。
    //   ZIP の中のエントリ名に自動命名を及ぼしていれば、取込側は combos.csv を
    //   見つけられず「zip 内に combos.csv が見つかりません」で落ちる。
    await previewComboFile(page, {
      name: zipName,
      mimeType: "application/zip",
      buffer: readFileSync(zipPath!),
    });

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(/1 行中/)).toBeVisible();

    await deleteCombos(page.request, [id]);
  });
});
